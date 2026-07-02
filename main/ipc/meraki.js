const fetch = require('node-fetch');
const { kvGetSecret } = require('../shared/kv');
const { loadHubDirectory, saveHubDirectory } = require('../shared/hubDirectory');

const MERAKI_BASE = 'https://api.meraki.com/api/v1';

async function merakiRequest(method, path, body) {
  const apiKey = await kvGetSecret('meraki-api-key');
  const opts = {
    method,
    headers: {
      'X-Cisco-Meraki-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${MERAKI_BASE}${path}`, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Meraki ${res.status}: ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function isAnsOrg(org) {
  return (org.name || '').toLowerCase().includes('anchor network');
}

function isAnsAdmin(admin) {
  return (admin.email || '').toLowerCase().endsWith('@anchornetworksolutions.com');
}

function isTemplateOrg(org) {
  return (org.name || '').toLowerCase().includes('organization template');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function fmtLastActive(ts) {
  if (!ts) return null;
  try {
    const d = new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return null; }
}

async function getExcludedOrgIds() {
  try {
    const hub = await loadHubDirectory();
    const list = (hub && hub.excludedMerakiOrgs) || [];
    return new Set(list.map(e => e.id));
  } catch { return new Set(); }
}

module.exports = function registerMeraki(ipcMain) {

  // ── Org list (lightweight — no admins) ──────────────────────────────────────
  ipcMain.handle('meraki-get-orgs', async () => {
    try {
      const [orgs, excludedIds] = await Promise.all([
        merakiRequest('GET', '/organizations'),
        getExcludedOrgIds(),
      ]);
      return {
        ok: true,
        orgs: (orgs || []).map(o => ({
          id:         o.id,
          name:       o.name,
          isAns:      isAnsOrg(o),
          isTemplate: isTemplateOrg(o),
          isExcluded: excludedIds.has(o.id),
        })),
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Get excluded org list ────────────────────────────────────────────────────
  ipcMain.handle('meraki-get-excluded-orgs', async () => {
    try {
      const hub = await loadHubDirectory();
      return { ok: true, orgs: (hub && hub.excludedMerakiOrgs) || [] };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Exclude / un-exclude an org ──────────────────────────────────────────────
  ipcMain.handle('meraki-set-org-excluded', async (_, { orgId, orgName, excluded }) => {
    try {
      const hub = await loadHubDirectory();
      if (!hub) return { ok: false, error: 'Hub not loaded' };
      if (!hub.excludedMerakiOrgs) hub.excludedMerakiOrgs = [];
      if (excluded) {
        if (!hub.excludedMerakiOrgs.find(e => e.id === orgId)) {
          hub.excludedMerakiOrgs.push({ id: orgId, name: orgName, excludedAt: new Date().toISOString() });
        }
      } else {
        hub.excludedMerakiOrgs = hub.excludedMerakiOrgs.filter(e => e.id !== orgId);
      }
      hub._updated = new Date().toISOString();
      await saveHubDirectory(hub);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Audit: all orgs + their admins ──────────────────────────────────────────
  ipcMain.handle('meraki-audit', async () => {
    try {
      const [orgs, excludedIds] = await Promise.all([
        merakiRequest('GET', '/organizations'),
        getExcludedOrgIds(),
      ]);
      const result = [];
      for (const org of (orgs || [])) {
        let admins = [];
        try {
          const raw = await merakiRequest('GET', `/organizations/${org.id}/admins`);
          admins = (raw || []).map(a => ({
            id:         a.id,
            email:      a.email,
            name:       a.name,
            orgAccess:  a.orgAccess,
            lastActive: fmtLastActive(a.lastActive),
            isAns:      isAnsAdmin(a),
          }));
        } catch (e) {
          admins = [{ error: e.message }];
        }
        result.push({
          id:         org.id,
          name:       org.name,
          isAns:      isAnsOrg(org),
          isExcluded: excludedIds.has(org.id),
          admins,
        });
        await sleep(150);
      }
      return { ok: true, orgs: result };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Add admin to one specific org ───────────────────────────────────────────
  ipcMain.handle('meraki-add-admin-to-org', async (_, { orgId, email, name }) => {
    try {
      const admins = (await merakiRequest('GET', `/organizations/${orgId}/admins`)) || [];
      const exists = admins.some(a => (a.email || '').toLowerCase() === email.toLowerCase());
      if (exists) return { ok: true, status: 'exists' };
      const admin = await merakiRequest('POST', `/organizations/${orgId}/admins`, { email, name, orgAccess: 'full' });
      return { ok: true, status: 'added', admin };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Remove admin from one specific org ──────────────────────────────────────
  ipcMain.handle('meraki-remove-admin-from-org', async (_, { orgId, adminId }) => {
    try {
      await merakiRequest('DELETE', `/organizations/${orgId}/admins/${adminId}`);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Add admin to all active client orgs ─────────────────────────────────────
  ipcMain.handle('meraki-add-admin', async (event, { email, name }) => {
    const results = [];
    try {
      const [orgs, excludedIds] = await Promise.all([
        merakiRequest('GET', '/organizations'),
        getExcludedOrgIds(),
      ]);
      const clientOrgs = (orgs || []).filter(o => !isAnsOrg(o) && !excludedIds.has(o.id));

      for (const org of clientOrgs) {
        try {
          const admins = (await merakiRequest('GET', `/organizations/${org.id}/admins`)) || [];
          const exists = admins.some(a => (a.email || '').toLowerCase() === email.toLowerCase());
          if (exists) {
            results.push({ orgId: org.id, orgName: org.name, status: 'exists' });
            event.sender.send('meraki-add-progress', { orgName: org.name, status: 'exists' });
          } else {
            await merakiRequest('POST', `/organizations/${org.id}/admins`, { email, name, orgAccess: 'full' });
            results.push({ orgId: org.id, orgName: org.name, status: 'added' });
            event.sender.send('meraki-add-progress', { orgName: org.name, status: 'added' });
          }
        } catch (e) {
          results.push({ orgId: org.id, orgName: org.name, status: 'error', error: e.message });
          event.sender.send('meraki-add-progress', { orgName: org.name, status: 'error', error: e.message });
        }
        await sleep(150);
      }
      return { ok: true, results };
    } catch (e) {
      return { ok: false, error: e.message, results };
    }
  });

  // ── Remove admin from all active client orgs ─────────────────────────────────
  ipcMain.handle('meraki-remove-admin', async (event, { email }) => {
    const results = [];
    try {
      const [orgs, excludedIds] = await Promise.all([
        merakiRequest('GET', '/organizations'),
        getExcludedOrgIds(),
      ]);
      const clientOrgs = (orgs || []).filter(o => !isAnsOrg(o) && !excludedIds.has(o.id));

      for (const org of clientOrgs) {
        try {
          const admins = (await merakiRequest('GET', `/organizations/${org.id}/admins`)) || [];
          const admin = admins.find(a => (a.email || '').toLowerCase() === email.toLowerCase());
          if (!admin) {
            results.push({ orgId: org.id, orgName: org.name, status: 'not_found' });
            event.sender.send('meraki-remove-progress', { orgName: org.name, status: 'not_found' });
          } else {
            await merakiRequest('DELETE', `/organizations/${org.id}/admins/${admin.id}`);
            results.push({ orgId: org.id, orgName: org.name, status: 'removed' });
            event.sender.send('meraki-remove-progress', { orgName: org.name, status: 'removed' });
          }
        } catch (e) {
          results.push({ orgId: org.id, orgName: org.name, status: 'error', error: e.message });
          event.sender.send('meraki-remove-progress', { orgName: org.name, status: 'error', error: e.message });
        }
        await sleep(150);
      }
      return { ok: true, results };
    } catch (e) {
      return { ok: false, error: e.message, results };
    }
  });
};

// Export for reuse by other modules (e.g. merakiExpiration.js)
module.exports.merakiRequest = merakiRequest;
module.exports.isAnsOrg      = isAnsOrg;
