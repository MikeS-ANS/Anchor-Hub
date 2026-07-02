'use strict';

const keytar = require('keytar');
const { SERVICE_NAME }                       = require('../shared/state');
const { merakiRequest, isAnsOrg }            = require('./meraki');
const { atQuery, atFetch }                   = require('../shared/at');
const { loadHubDirectory, saveHubDirectory } = require('../shared/hubDirectory');
const { loadHubFile, saveHubFile }           = require('../shared/hubDirectory');
const {
  prefetchMerakiTicketDefaults,
  resolveQueueId,
  resolvePicklistValue,
  resolveTicketPriority,
  resolveSlaId,
  resolveBillingCodeId,
  resolveResourceWithRole,
  resolveResourcesByFirstName,
  resolveRoleId,
  resolveTicketCategoryId,
  resolveContractByName,
} = require('../shared/atHelpers');

// ─── SharePoint filenames ──────────────────────────────────────────────────────
const CACHE_FILE = 'hub-meraki-scan-cache.json';
const AUDIT_FILE = 'hub-meraki-audit.json';

// ─── Settings keys (keytar, SERVICE_NAME) ─────────────────────────────────────
const K_THRESHOLD   = 'meraki_exp_threshold_days';
const K_SCHED_EN    = 'meraki_exp_schedule_enabled';
const K_SCHED_TYPE  = 'meraki_exp_schedule_type';
const K_SCHED_DAY   = 'meraki_exp_schedule_day';
const K_SCHED_TIME  = 'meraki_exp_schedule_time';
const K_CONCURRENCY = 'meraki_exp_concurrency';
const K_LAST_SCAN   = 'meraki_exp_last_scan';

const DEFAULTS = {
  thresholdDays:   90,
  scheduleEnabled: true,
  scheduleType:    'weekly',
  scheduleDay:     'Monday',
  scheduleTime:    '08:00',
  concurrency:     5,
};

// Cached last-scan timestamp so scheduler can read it synchronously
let _lastScanRun = null;
// Pre-load from keytar so it's available before the first scheduler check
keytar.getPassword(SERVICE_NAME, K_LAST_SCAN).then(v => { if (v) _lastScanRun = v; }).catch(() => {});

async function getSettings() {
  const [threshold, schedEnabled, schedType, schedDay, schedTime, concurrency] = await Promise.all([
    keytar.getPassword(SERVICE_NAME, K_THRESHOLD),
    keytar.getPassword(SERVICE_NAME, K_SCHED_EN),
    keytar.getPassword(SERVICE_NAME, K_SCHED_TYPE),
    keytar.getPassword(SERVICE_NAME, K_SCHED_DAY),
    keytar.getPassword(SERVICE_NAME, K_SCHED_TIME),
    keytar.getPassword(SERVICE_NAME, K_CONCURRENCY),
  ]);
  return {
    thresholdDays:   threshold   ? parseInt(threshold, 10)   : DEFAULTS.thresholdDays,
    scheduleEnabled: schedEnabled ? schedEnabled === 'true'   : DEFAULTS.scheduleEnabled,
    scheduleType:    schedType    || DEFAULTS.scheduleType,
    scheduleDay:     schedDay     || DEFAULTS.scheduleDay,
    scheduleTime:    schedTime    || DEFAULTS.scheduleTime,
    concurrency:     concurrency  ? parseInt(concurrency, 10) : DEFAULTS.concurrency,
  };
}

// ─── Audit trail ──────────────────────────────────────────────────────────────
// writeAuditEntry: abstracted so the backend can be swapped to Azure Table Storage later.
// To migrate: replace the body of this function — all callers stay unchanged.
async function writeAuditEntry(entry) {
  try {
    const existing = (await loadHubFile(AUDIT_FILE)) || { entries: [] };
    const full = {
      timestamp:     new Date().toISOString(),
      actor:         'Hub User',
      orgName:       null,
      atCompanyName: null,
      deviceSerial:  null,
      deviceName:    null,
      oldValue:      null,
      newValue:      null,
      result:        'success',
      errorDetail:   null,
      ...entry,
    };
    existing.entries.unshift(full);
    if (existing.entries.length > 500) existing.entries = existing.entries.slice(0, 500);
    await saveHubFile(AUDIT_FILE, existing);
  } catch (e) {
    console.warn('[MerakiExp] writeAuditEntry failed:', e.message);
  }
}

// ─── Company map: Meraki org name → AT company ────────────────────────────────
function buildMerakiOrgMap(hub) {
  const map = new Map();
  for (const entry of (hub?.companies || [])) {
    if (entry.excluded) continue;
    const raw = entry.platforms?.meraki;
    if (!raw) continue;
    const items = Array.isArray(raw) ? raw : [raw];
    for (const item of items) {
      if (!item?.name || item.excluded) continue;
      map.set(item.name.toLowerCase().trim(), { atId: entry.atId, atName: entry.atName });
    }
  }
  return map;
}

// ─── Severity classification ───────────────────────────────────────────────────
const SEVERITY_ORDER = { expired: 0, critical: 1, warning: 2, notice: 3, clean: 4 };

function classifyDate(dateStr, threshold) {
  if (!dateStr) return null;
  const daysLeft = Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
  if (daysLeft < 0)                         return { severity: 'expired',  daysLeft };
  if (daysLeft < threshold * 0.33)          return { severity: 'critical', daysLeft };
  if (daysLeft < threshold * 0.67)          return { severity: 'warning',  daysLeft };
  if (daysLeft < threshold)                 return { severity: 'notice',   daysLeft };
  return                                           { severity: 'clean',    daysLeft };
}

function worstSeverity(a, b) {
  if (!a) return b;
  if (!b) return a;
  return SEVERITY_ORDER[a.severity] <= SEVERITY_ORDER[b.severity] ? a : b;
}

// ─── Per-device processing ────────────────────────────────────────────────────
function processDevice(device, isCoterm, cotermExpiry, statusMap, threshold) {
  const licenseExpiry = isCoterm ? cotermExpiry : (device.licenseExpirationDate || null);
  const eosDate       = device.eox?.endOfSupportAt  || null;
  const eosaleDate    = device.eox?.endOfSaleAt      || null;

  // A non-coterm device with no license date has never been assigned a license — treat as expired
  const licenseClass = licenseExpiry
    ? classifyDate(licenseExpiry, threshold)
    : (!isCoterm ? { severity: 'expired', daysLeft: null } : null);
  const eosClass     = classifyDate(eosDate,       threshold);
  const worst        = worstSeverity(licenseClass, eosClass) || { severity: 'clean', daysLeft: null };

  const hasLicenseIssue = licenseClass && licenseClass.severity !== 'clean';
  const hasEosIssue     = eosClass     && eosClass.severity     !== 'clean';
  const issueType = (hasLicenseIssue && hasEosIssue) ? 'both'
                  : hasLicenseIssue                  ? 'license'
                  : hasEosIssue                      ? 'eos'
                  :                                    'clean';

  return {
    serial:        device.serial,
    name:          device.name   || device.serial,
    model:         device.model  || '',
    productType:   device.productType || '',
    networkId:     device.networkId   || null,
    deviceStatus:  statusMap.get(device.serial) || 'unknown',
    licenseExpiry,
    eosDate,
    eosaleDate,
    severity:      worst.severity,
    daysLeft:      worst.daysLeft,
    issueType,
    isCoterm,
    isUnclaimed:   !device.networkId,
    atMatch:       null,  // filled in after AT lookup
  };
}

// ─── AT CI lookup with concurrency limit ─────────────────────────────────────
async function batchATLookup(devices, concurrency) {
  const results = new Array(devices.length).fill(null);
  let idx = 0;

  async function worker() {
    while (idx < devices.length) {
      const i = idx++;
      const device = devices[i];
      try {
        const items = await atQuery('/ConfigurationItems', [
          { op: 'eq', field: 'serialNumber', value: device.serial },
        ]);
        const ci = (items || [])[0];
        results[i] = ci ? {
          id:                    ci.id,
          warrantyExpirationDate: ci.warrantyExpirationDate || null,
          companyID:             ci.companyID,
          isActive:              ci.isActive,
        } : null;
      } catch (e) {
        results[i] = { error: e.message };
      }
    }
  }

  const workers = Math.min(concurrency, devices.length);
  if (workers > 0) await Promise.all(Array.from({ length: workers }, worker));
  return results;
}

// ─── Scan one org ─────────────────────────────────────────────────────────────
async function scanOrg(org, hub, companyMap, threshold, concurrency) {
  const isCoterm = (org.licensing?.model || '') === 'co-term';

  // Parallel: inventory + statuses + co-term license overview + unused licenses
  const [inventory, statuses, cotermLicense, allLicenses] = await Promise.all([
    merakiRequest('GET', `/organizations/${org.id}/inventoryDevices`),
    merakiRequest('GET', `/organizations/${org.id}/devices/statuses`).catch(() => []),
    isCoterm
      ? merakiRequest('GET', `/organizations/${org.id}/licenses/overview`).catch(() => null)
      : Promise.resolve(null),
    !isCoterm
      ? merakiRequest('GET', `/organizations/${org.id}/licenses`).catch(() => [])
      : Promise.resolve([]),
  ]);

  const unusedLicenses = (allLicenses || [])
    .filter(l => (l.state === 'unused' || l.state === 'unusedActive' || l.state === 'recentlyQueued')
              && !l.licenseType?.startsWith('MT'))
    .map(l => ({ id: l.id, licenseType: l.licenseType, licenseKey: l.licenseKey, durationInDays: l.durationInDays }));

  const statusMap   = new Map((statuses || []).map(s => [s.serial, s.status]));
  // Meraki overview returns expirationDate as "Dec 15, 2026 UTC" — normalize to YYYY-MM-DD
  const cotermExpiry = (() => {
    const raw = cotermLicense?.expirationDate;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  })();

  // Company + exclusion lookup
  const orgNameNorm   = (org.name || '').toLowerCase().trim();
  const atCompany     = companyMap.get(orgNameNorm) || null;
  const companyEntry  = atCompany
    ? (hub.companies || []).find(c => c.atId === atCompany.atId)
    : null;
  const exclusions       = companyEntry?.exclusions    || {};
  const globalExclModels = new Set(
    ((hub.globalExclusions?.models) || []).map(m => (m.model || '').toUpperCase())
  );
  const companyExclModels = new Set(
    ((exclusions.models) || []).map(m => (m.model || '').toUpperCase())
  );
  const companyExclSerials = new Set(
    ((exclusions.devices) || []).map(d => d.serial)
  );

  // Skip entire org if excluded
  if (exclusions.excludeOrg) {
    return {
      orgId: org.id, orgName: org.name, isCoterm,
      atCompanyId: atCompany?.atId || null,
      atCompanyName: atCompany?.atName || null,
      skipped: true, skipReason: exclusions.orgExclusionReason || 'Org excluded',
      devices: [],
    };
  }

  // Process devices — separate claimed (need AT lookup) from unclaimed
  const processed  = [];
  const toQuery    = [];   // [{ device, processedIdx }]

  for (const device of (inventory || [])) {
    // Apply exclusions
    if (globalExclModels.has((device.model || '').toUpperCase()))  continue;
    if (companyExclModels.has((device.model || '').toUpperCase())) continue;
    if (companyExclSerials.has(device.serial))                     continue;

    const p = processDevice(device, isCoterm, cotermExpiry, statusMap, threshold);
    processed.push(p);
    if (!p.isUnclaimed) toQuery.push({ device, idx: processed.length - 1 });
  }

  // AT CI lookups
  const atResults = await batchATLookup(toQuery.map(t => t.device), concurrency);
  for (let i = 0; i < toQuery.length; i++) {
    const ci = atResults[i];
    const p  = processed[toQuery[i].idx];
    p.atMatch = ci;

    // Flag date discrepancy — fires when either side has a date the other lacks, or dates differ
    if (ci && !ci.error) {
      const toYmd = s => { if (!s) return ''; const d = new Date(s); return isNaN(d) ? s.slice(0, 10) : d.toISOString().slice(0, 10); };
      const merakiYmd = toYmd(p.licenseExpiry);
      const atYmd     = toYmd(ci.warrantyExpirationDate);
      // Only flag if at least one side has a date (both blank = no mismatch)
      p.atDateMismatch = (merakiYmd || atYmd) ? (merakiYmd !== atYmd) : false;
    }
  }

  return {
    orgId:          org.id,
    orgName:        org.name,
    isCoterm,
    atCompanyId:    atCompany?.atId   || null,
    atCompanyName:  atCompany?.atName || null,
    unusedLicenses: unusedLicenses,
    devices:        processed,
  };
}

// ─── Full scan (called by IPC handler and scheduler) ─────────────────────────
// opts.scheduled = true → apply multi-instance dedup (bail if another instance
// already claimed the scan within the last 10 minutes).
async function runScan(send, opts = {}) {
  if (opts.scheduled) {
    // Claim the scan slot by writing our start time. If someone else already
    // wrote within the last 10 minutes, bail out silently.
    const LOCK_WINDOW_MS = 10 * 60 * 1000;
    try {
      const existing = await loadHubFile(CACHE_FILE);
      const prior = existing?.scanStartedAt ? new Date(existing.scanStartedAt).getTime() : 0;
      if (Date.now() - prior < LOCK_WINDOW_MS) {
        console.log('[MerakiExp] Scheduled scan skipped — another instance already started within 10 min');
        return existing;
      }
      // Claim: write our timestamp before the expensive work begins
      await saveHubFile(CACHE_FILE, { ...(existing || {}), scanStartedAt: new Date().toISOString() });
    } catch (e) {
      console.warn('[MerakiExp] Could not check/write scanStartedAt — proceeding anyway:', e.message);
    }
  }

  send({ msg: 'Loading hub directory…', orgsDone: 0, orgsTotal: 0, phase: 'init' });

  const settings    = await getSettings();
  const threshold   = settings.thresholdDays;
  const concurrency = settings.concurrency;

  const hub        = await loadHubDirectory();
  const companyMap = buildMerakiOrgMap(hub || {});

  send({ msg: 'Fetching Meraki organizations…', orgsDone: 0, orgsTotal: 0, phase: 'init' });

  const allOrgs      = await merakiRequest('GET', '/organizations');
  const excludedIds  = new Set(((hub?.excludedMerakiOrgs) || []).map(e => e.id));
  const clientOrgs   = (allOrgs || []).filter(o => !excludedIds.has(o.id));
  const total        = clientOrgs.length;

  await writeAuditEntry({ actionType: 'SCAN_STARTED', newValue: `${total} orgs queued` });
  send({ msg: `Starting scan of ${total} organizations…`, orgsDone: 0, orgsTotal: total, phase: 'scan' });

  const orgResults = [];
  for (let i = 0; i < clientOrgs.length; i++) {
    const org = clientOrgs[i];
    send({ msg: `Scanning org ${i + 1} of ${total}: ${org.name}`, orgsDone: i, orgsTotal: total, phase: 'scan' });
    try {
      orgResults.push(await scanOrg(org, hub || {}, companyMap, threshold, concurrency));
    } catch (e) {
      orgResults.push({
        orgId: org.id, orgName: org.name, isCoterm: false,
        atCompanyId: null, atCompanyName: null,
        error: e.message, devices: [],
      });
    }
  }

  const cache = {
    scannedAt:     new Date().toISOString(),
    thresholdDays: threshold,
    orgs:          orgResults,
  };

  send({ msg: 'Saving results to SharePoint…', orgsDone: total, orgsTotal: total, phase: 'save' });
  await saveHubFile(CACHE_FILE, cache);

  const totalDevices = orgResults.reduce((n, o) => n + (o.devices?.length || 0), 0);
  const flaggedDevices = orgResults.reduce((n, o) =>
    n + (o.devices || []).filter(d => d.issueType !== 'clean').length, 0);

  await writeAuditEntry({
    actionType: 'SCAN_COMPLETED',
    newValue:   `${total} orgs, ${totalDevices} devices, ${flaggedDevices} flagged`,
    result:     'success',
  });

  send({ msg: `Scan complete — ${flaggedDevices} devices flagged across ${total} orgs`, orgsDone: total, orgsTotal: total, phase: 'done' });
  return cache;
}

// ─── IPC registration ─────────────────────────────────────────────────────────
module.exports = function registerMerakiExpiration(ipcMain) {

  // ── Settings ────────────────────────────────────────────────────────────────

  ipcMain.handle('meraki-exp-get-settings', async () => {
    try   { return { ok: true,  data: await getSettings() }; }
    catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('meraki-exp-save-settings', async (_, s) => {
    try {
      await Promise.all([
        keytar.setPassword(SERVICE_NAME, K_THRESHOLD,   String(s.thresholdDays   ?? DEFAULTS.thresholdDays)),
        keytar.setPassword(SERVICE_NAME, K_SCHED_EN,    String(s.scheduleEnabled ?? DEFAULTS.scheduleEnabled)),
        keytar.setPassword(SERVICE_NAME, K_SCHED_TYPE,  s.scheduleType  || DEFAULTS.scheduleType),
        keytar.setPassword(SERVICE_NAME, K_SCHED_DAY,   s.scheduleDay   || DEFAULTS.scheduleDay),
        keytar.setPassword(SERVICE_NAME, K_SCHED_TIME,  s.scheduleTime  || DEFAULTS.scheduleTime),
        keytar.setPassword(SERVICE_NAME, K_CONCURRENCY, String(s.concurrency ?? DEFAULTS.concurrency)),
      ]);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // ── Cache ────────────────────────────────────────────────────────────────────

  ipcMain.handle('meraki-exp-get-cache', async () => {
    try {
      const data = await loadHubFile(CACHE_FILE);
      return { ok: true, data };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // ── Scan ─────────────────────────────────────────────────────────────────────

  ipcMain.handle('meraki-exp-scan', async (event) => {
    const send = (data) => {
      try { event.sender.send('meraki-exp-progress', data); } catch {}
    };
    try {
      const cache = await runScan(send);
      return { ok: true, data: cache };
    } catch (e) {
      send({ msg: `Scan failed: ${e.message}`, phase: 'error' });
      await writeAuditEntry({ actionType: 'SCAN_COMPLETED', result: 'error', errorDetail: e.message });
      return { ok: false, error: e.message };
    }
  });

  // ── Audit log ────────────────────────────────────────────────────────────────

  ipcMain.handle('meraki-exp-get-audit', async () => {
    try {
      const data = await loadHubFile(AUDIT_FILE);
      return { ok: true, data: data || { entries: [] } };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // ── Exclusions ──────────────────────────────────────────────────────────────

  ipcMain.handle('meraki-exp-get-exclusions', async () => {
    try {
      const hub = await loadHubDirectory();
      if (!hub) return { ok: true, data: { companies: [], globalExclusions: { models: [] } } };
      const companies = (hub.companies || [])
        .filter(c => c.exclusions)
        .map(c => ({ atId: c.atId, atName: c.atName, exclusions: c.exclusions }));
      return { ok: true, data: { companies, globalExclusions: hub.globalExclusions || { models: [] } } };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('meraki-exp-add-exclusion', async (_, opts) => {
    // opts: { type, atId?, serial?, model?, reason?, orgExclusionReason?, excludedBy? }
    // type: 'device' | 'company-model' | 'org' | 'global-model'
    try {
      const hub = await loadHubDirectory();
      if (!hub) return { ok: false, error: 'Hub directory not available' };

      const now   = new Date().toISOString();
      const actor = opts.excludedBy || 'Hub User';

      if (opts.type === 'global-model') {
        if (!hub.globalExclusions)         hub.globalExclusions = { models: [] };
        if (!hub.globalExclusions.models)  hub.globalExclusions.models = [];
        const exists = hub.globalExclusions.models.some(
          m => (m.model || '').toUpperCase() === (opts.model || '').toUpperCase()
        );
        if (!exists) {
          hub.globalExclusions.models.push({ model: opts.model, reason: opts.reason || '', excludedAt: now, excludedBy: actor });
        }
      } else {
        const company = (hub.companies || []).find(c => c.atId === opts.atId);
        if (!company) return { ok: false, error: `Company ${opts.atId} not found in hub` };
        if (!company.exclusions) {
          company.exclusions = { devices: [], models: [], excludeOrg: false, orgExclusionReason: '' };
        }
        if (opts.type === 'device') {
          const exists = (company.exclusions.devices || []).some(d => d.serial === opts.serial);
          if (!exists) {
            if (!company.exclusions.devices) company.exclusions.devices = [];
            company.exclusions.devices.push({ serial: opts.serial, reason: opts.reason || '', excludedAt: now, excludedBy: actor });
          }
        } else if (opts.type === 'company-model') {
          const exists = (company.exclusions.models || []).some(
            m => (m.model || '').toUpperCase() === (opts.model || '').toUpperCase()
          );
          if (!exists) {
            if (!company.exclusions.models) company.exclusions.models = [];
            company.exclusions.models.push({ model: opts.model, reason: opts.reason || '', excludedAt: now, excludedBy: actor });
          }
        } else if (opts.type === 'org') {
          company.exclusions.excludeOrg = true;
          company.exclusions.orgExclusionReason = opts.orgExclusionReason || opts.reason || '';
        }
      }

      hub._updated = now;
      await saveHubDirectory(hub);

      const companyName = opts.atId
        ? ((hub.companies || []).find(c => c.atId === opts.atId)?.atName || String(opts.atId))
        : null;
      await writeAuditEntry({
        actionType:    'EXCLUSION_ADDED',
        atCompanyName: companyName,
        deviceSerial:  opts.serial || null,
        newValue:      JSON.stringify({ type: opts.type, model: opts.model || null, serial: opts.serial || null }),
        result:        'success',
      });

      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  ipcMain.handle('meraki-exp-remove-exclusion', async (_, opts) => {
    // opts: { type, atId?, serial?, model? }
    try {
      const hub = await loadHubDirectory();
      if (!hub) return { ok: false, error: 'Hub directory not available' };

      if (opts.type === 'global-model') {
        if (hub.globalExclusions?.models) {
          hub.globalExclusions.models = hub.globalExclusions.models.filter(
            m => (m.model || '').toUpperCase() !== (opts.model || '').toUpperCase()
          );
        }
      } else {
        const company = (hub.companies || []).find(c => c.atId === opts.atId);
        if (!company?.exclusions) return { ok: true };

        if (opts.type === 'device') {
          company.exclusions.devices = (company.exclusions.devices || [])
            .filter(d => d.serial !== opts.serial);
        } else if (opts.type === 'company-model') {
          company.exclusions.models = (company.exclusions.models || [])
            .filter(m => (m.model || '').toUpperCase() !== (opts.model || '').toUpperCase());
        } else if (opts.type === 'org') {
          company.exclusions.excludeOrg = false;
          company.exclusions.orgExclusionReason = '';
        }
      }

      hub._updated = new Date().toISOString();
      await saveHubDirectory(hub);

      const companyName = opts.atId
        ? ((hub.companies || []).find(c => c.atId === opts.atId)?.atName || String(opts.atId))
        : null;
      await writeAuditEntry({
        actionType:    'EXCLUSION_REMOVED',
        atCompanyName: companyName,
        deviceSerial:  opts.serial || null,
        newValue:      JSON.stringify({ type: opts.type, model: opts.model || null, serial: opts.serial || null }),
        result:        'success',
      });

      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // ── AT defaults (warms cache + returns Gary/Shawn resource IDs) ─────────────

  ipcMain.handle('meraki-exp-at-lookup-defaults', async () => {
    try {
      const data = await prefetchMerakiTicketDefaults();
      return { ok: true, data };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // ── License Renewal ─────────────────────────────────────────────────────────
  // opts: { orgId, orgName, atCompanyId, atCompanyName, keys: string[] }
  ipcMain.handle('meraki-exp-renew-license', async (_, opts) => {
    const steps = [];
    const step = (name, ok, extra = {}) => { steps.push({ step: name, ok, ...extra }); };

    // ── Step 1: Claim license key(s) to org ─────────────────────────────────
    try {
      const body = { licenses: opts.keys.map(k => ({ key: k.trim(), mode: 'addDevices' })) };
      await merakiRequest('POST', `/organizations/${opts.orgId}/claim`, body);
      step('claim', true, { count: opts.keys.length });
    } catch (e) {
      step('claim', false, { error: e.message });
      return { ok: false, steps };
    }

    // ── Step 2: Auto-assign unused licenses to expired/expiring devices ──────
    // Fetch all unassigned licenses for this org, then match by licenseType to
    // device model. ENT licenses map to MR (wireless AP) devices.
    let assignedCount = 0;
    let assignErrors  = [];
    try {
      const allLicenses = await merakiRequest('GET', `/organizations/${opts.orgId}/licenses`);
      const unused = (allLicenses || []).filter(l =>
        (l.state === 'unused' || l.state === 'unusedActive' || l.state === 'recentlyQueued')
        && !l.licenseType?.startsWith('MT')
      );

      if (unused.length > 0) {
        // Get expired/expiring devices from the scan cache for this org
        const cache    = await loadHubFile(CACHE_FILE);
        const orgEntry = cache?.orgs?.find(o => o.orgId === opts.orgId);
        const expiredDevices = (orgEntry?.devices || [])
          .filter(d => d.severity === 'expired' || d.severity === 'critical' || d.severity === 'warning')
          .filter(d => d.serial && !d.isCoterm && !d.isUnclaimed
                    && d.deviceStatus !== 'dormant' && d.deviceStatus !== 'inventory');

        // Match unused license to device: exact model match, MX67-SEC → MX67, or ENT → MR devices
        const usedLicIds  = new Set();
        const usedSerials = new Set();

        for (const lic of unused) {
          if (usedLicIds.has(lic.id)) continue;
          const match = expiredDevices.find(d => {
            if (usedSerials.has(d.serial)) return false;
            if (lic.licenseType === d.model) return true;
            // MX security/advanced licenses have a suffix: MX67-SEC matches device MX67
            if (lic.licenseType.startsWith(d.model + '-')) return true;
            // ENT / ENT-PLUS licenses are for MR (wireless AP) devices
            if ((lic.licenseType === 'ENT' || lic.licenseType === 'ENT-PLUS') &&
                (d.model || '').startsWith('MR')) return true;
            return false;
          });
          if (!match) continue;

          try {
            await merakiRequest('PUT', `/organizations/${opts.orgId}/licenses/${lic.id}`, {
              deviceSerial: match.serial,
            });
            usedLicIds.add(lic.id);
            usedSerials.add(match.serial);
            assignedCount++;
          } catch (assignErr) {
            assignErrors.push(`${match.serial}: ${assignErr.message}`);
          }
        }
        step('assign', assignErrors.length === 0, {
          assigned: assignedCount,
          skipped:  unused.length - assignedCount,
          errors:   assignErrors.length ? assignErrors.join('; ') : undefined,
        });
      } else {
        step('assign', null, { skipped: 'No unused licenses found after claim — may need a rescan' });
      }
    } catch (e) {
      step('assign', false, { error: e.message });
    }

    // ── Step 3: Audit ────────────────────────────────────────────────────────
    await writeAuditEntry({
      actionType:    'LICENSE_CLAIMED',
      orgName:       opts.orgName,
      atCompanyName: opts.atCompanyName,
      newValue:      `${opts.keys.length} key(s) claimed; ${assignedCount} license(s) assigned`,
    });

    return { ok: true, steps };
  });

  // ── Assign unused licenses to expired devices (standalone — no claim needed) ──
  // opts: { orgId, orgName, assignments?: [{ licenseId, deviceSerial }] }
  //   assignments — optional manual pairings from the UI picker.
  //                 When omitted, auto-matches by model.
  ipcMain.handle('meraki-exp-assign-unused-licenses', async (_, opts) => {
    try {
      const allLicenses = await merakiRequest('GET', `/organizations/${opts.orgId}/licenses`);
      const unused = (allLicenses || []).filter(l =>
        (l.state === 'unused' || l.state === 'unusedActive' || l.state === 'recentlyQueued')
        && !l.licenseType?.startsWith('MT')
      );
      if (!unused.length) return { ok: true, assigned: 0, skipped: 0, message: 'No unused licenses found for this org' };

      let assigned = 0, skipped = 0;
      const errors = [];
      const usedLicIds  = new Set();

      if (opts.assignments?.length) {
        // Manual mode: user specified exact license → device pairings
        for (const { licenseId, deviceSerial } of opts.assignments) {
          if (usedLicIds.has(licenseId)) continue;
          try {
            await merakiRequest('PUT', `/organizations/${opts.orgId}/licenses/${licenseId}`, {
              deviceSerial,
            });
            usedLicIds.add(licenseId);
            assigned++;
          } catch (e) {
            errors.push(`${deviceSerial}: ${e.message}`);
            skipped++;
          }
        }
      } else {
        // Auto mode: match unused licenses to expired/critical/warning devices by model
        const cache    = await loadHubFile(CACHE_FILE);
        const orgEntry = cache?.orgs?.find(o => o.orgId === opts.orgId);
        const expiredDevices = (orgEntry?.devices || [])
          .filter(d => d.severity === 'expired' || d.severity === 'critical' || d.severity === 'warning')
          .filter(d => d.serial && !d.isCoterm && !d.isUnclaimed
                    && d.deviceStatus !== 'dormant' && d.deviceStatus !== 'inventory');

        const usedSerials = new Set();
        for (const lic of unused) {
          if (usedLicIds.has(lic.id)) continue;
          const match = expiredDevices.find(d => {
            if (usedSerials.has(d.serial)) return false;
            if (lic.licenseType === d.model) return true;
            if (lic.licenseType.startsWith(d.model + '-')) return true;
            if ((lic.licenseType === 'ENT' || lic.licenseType === 'ENT-PLUS') &&
                (d.model || '').startsWith('MR')) return true;
            return false;
          });
          if (!match) { skipped++; continue; }
          try {
            await merakiRequest('PUT', `/organizations/${opts.orgId}/licenses/${lic.id}`, {
              deviceSerial: match.serial,
            });
            usedLicIds.add(lic.id);
            usedSerials.add(match.serial);
            assigned++;
          } catch (e) {
            errors.push(`${match.serial}: ${e.message}`);
            skipped++;
          }
        }
      }

      // Update cache unusedLicenses count so badge refreshes without a full rescan
      try {
        const cacheForUpdate = await loadHubFile(CACHE_FILE);
        const orgForUpdate = cacheForUpdate?.orgs?.find(o => o.orgId === opts.orgId);
        if (orgForUpdate) {
          orgForUpdate.unusedLicenses = (orgForUpdate.unusedLicenses || [])
            .filter(l => !usedLicIds.has(l.id));
          await saveHubFile(CACHE_FILE, cacheForUpdate);
        }
      } catch (e) { console.warn('[merakiExp] cache update after assign failed:', e.message); }

      await writeAuditEntry({
        actionType:    'LICENSE_ASSIGNED',
        orgName:       opts.orgName,
        newValue:      `${assigned} assigned, ${skipped} unmatched`,
      });

      return { ok: true, assigned, skipped, errors: errors.length ? errors : undefined };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Get unused licenses + eligible devices for the assignment picker ────────────
  // opts: { orgId }
  // Returns { ok, licenses: [...], devices: [...] }
  ipcMain.handle('meraki-exp-get-assign-candidates', async (_, opts) => {
    try {
      const [allLicenses, cache] = await Promise.all([
        merakiRequest('GET', `/organizations/${opts.orgId}/licenses`),
        loadHubFile(CACHE_FILE),
      ]);
      const licenses = (allLicenses || [])
        .filter(l => (l.state === 'unused' || l.state === 'unusedActive' || l.state === 'recentlyQueued')
                  && !l.licenseType?.startsWith('MT'))
        .map(l => ({ id: l.id, licenseType: l.licenseType, durationInDays: l.durationInDays }));

      const orgEntry = cache?.orgs?.find(o => o.orgId === opts.orgId);
      const devices = (orgEntry?.devices || [])
        .filter(d => !d.isCoterm && !d.isUnclaimed
                  && d.deviceStatus !== 'dormant' && d.deviceStatus !== 'inventory')
        .map(d => ({
          serial:    d.serial,
          name:      d.name || d.serial,
          model:     d.model || '',
          severity:  d.severity,
          status:    d.deviceStatus,
        }));

      return { ok: true, licenses, devices };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Sync AT warranty date to match Meraki license expiry ─────────────────────
  ipcMain.handle('meraki-exp-sync-at-date', async (_, opts) => {
    // opts: { ciId, newDate, orgName, atCompanyName, deviceSerial, deviceName }
    try {
      // GET the full CI first so we PUT back all required fields unchanged
      const existing = await atFetch(`/ConfigurationItems/${opts.ciId}`);
      const ci = existing?.item || existing;
      if (!ci || !ci.id) throw new Error('Could not fetch CI record before update');
      // Normalize to ISO datetime — AT rejects human-readable strings like "Dec 15, 2026 UTC"
      const toAtIso = s => { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d.toISOString().slice(0, 10) + 'T00:00:00Z'; };
      const warrantyDate = toAtIso(opts.newDate);
      if (!warrantyDate) throw new Error(`Cannot parse date for AT: "${opts.newDate}"`);
      await atFetch('/ConfigurationItems', {
        method: 'PUT',
        body:   JSON.stringify({ ...ci, warrantyExpirationDate: warrantyDate }),
      });
      await writeAuditEntry({
        actionType:    'AT_DATE_UPDATED',
        orgName:       opts.orgName       || '',
        atCompanyName: opts.atCompanyName || '',
        deviceSerial:  opts.deviceSerial  || '',
        deviceName:    opts.deviceName    || '',
        oldValue:      opts.oldDate       || null,
        newValue:      opts.newDate       || null,
      });
      // Update cached value so the UI reflects the change without a re-scan
      try {
        const cache = await loadHubFile(CACHE_FILE) || {};
        for (const org of (cache.orgs || [])) {
          const dev = (org.devices || []).find(d => d.serial === opts.deviceSerial);
          if (dev?.atMatch) {
            dev.atMatch.warrantyExpirationDate = opts.newDate;
            dev.atDateMismatch = false;
            await saveHubFile(CACHE_FILE, cache);
          }
        }
      } catch (e) { console.warn('[merakiExp] cache update after date sync failed:', e.message); }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Ticket status picklist ────────────────────────────────────────────────────
  ipcMain.handle('meraki-exp-get-ticket-statuses', async () => {
    try {
      const res    = await atFetch('/Tickets/entityInformation/fields');
      const field  = (res.fields || []).find(f => (f.name || '').toLowerCase() === 'status');
      const values = (field?.picklistValues || [])
        .filter(v => v.isActive !== false)
        .map(v => ({ label: v.label, value: Number(v.value) }))
        .sort((a, b) => a.value - b.value);
      return { ok: true, statuses: values };
    } catch (e) {
      return { ok: false, error: e.message, statuses: [] };
    }
  });

  // ── Check existing open tickets for a company ─────────────────────────────────
  ipcMain.handle('meraki-exp-check-ticket', async (_, opts) => {
    // opts: { atCompanyId }
    try {
      const items = await atQuery('/Tickets', [
        { op: 'eq',    field: 'companyID', value: parseInt(opts.atCompanyId) },
        { op: 'noteq', field: 'status',    value: 5 },  // 5 = Complete
      ]);
      return {
        ok: true,
        tickets: (items || []).map(t => ({
          id:           t.id,
          ticketNumber: t.ticketNumber,
          title:        t.title,
          status:       t.status,
          createDate:   t.createDate,
        })),
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Create a Meraki license/EoL review ticket ─────────────────────────────────
  // opts: { atCompanyId, atCompanyName, orgName, devices: [{ serial, name, model,
  //         ciId, severity, licenseExpiry, eosDate }], assignTo }
  ipcMain.handle('meraki-exp-create-ticket', async (_, opts) => {
    try {
      // Step 1: Resolve all IDs in parallel — fail-safe per field so one bad
      // picklist value never blocks the entire ticket creation.
      // Use caller overrides when provided, otherwise fall back to hardcoded defaults
      const queueName       = opts.queueName       || 'CS - Subscription Procurement';
      const issueTypeName   = opts.issueTypeName   || 'Sales Ordering';
      const subIssueType    = opts.subIssueType    || 'Software Order';
      const sourceName      = opts.sourceName      || 'Other';
      const slaName         = opts.slaName         || 'Sales & Procurement';
      const priorityName    = opts.priorityName    || 'Standard - 3';
      const billingCodeName = opts.billingCodeName || 'Sales & Procurement';

      const [
        queueRes,
        issueTypeRes,
        subIssueTypeRes,
        sourceRes,
        slaRes,
        ticketCategoryRes,
        priorityRes,
        billingCodeRes,
        resourceRes,
        contractRes,
      ] = await Promise.allSettled([
        resolveQueueId(queueName),
        resolvePicklistValue('/Tickets', 'issueType',    issueTypeName),
        resolvePicklistValue('/Tickets', 'subIssueType', subIssueType),
        resolvePicklistValue('/Tickets', 'source',       sourceName),
        resolveSlaId(slaName),
        resolveTicketCategoryId('Sales'),
        resolveTicketPriority(priorityName),
        resolveBillingCodeId(billingCodeName),
        opts.assignTo ? resolveResourceWithRole(opts.assignTo, 'CSM') : Promise.resolve(null),
        resolveContractByName(parseInt(opts.atCompanyId), 'Sales & Procurement Contract'),
      ]);

      // Log any resolution failures (non-fatal)
      const failures = [
        ['queue', queueRes], ['issueType', issueTypeRes], ['subIssueType', subIssueTypeRes],
        ['source', sourceRes], ['sla', slaRes], ['ticketCategory', ticketCategoryRes],
        ['priority', priorityRes],
      ].filter(([, r]) => r.status === 'rejected');
      if (failures.length) {
        failures.forEach(([name, r]) =>
          console.warn(`[MerakiExp] ID resolution failed for "${name}" (continuing):`, r.reason?.message));
      }

      // Step 2: Build title
      const title = 'Meraki License Renewal';

      // Step 3: Build description — device list with expiry dates
      const fmtExp = ds => {
        if (!ds) return null;
        try {
          const d = new Date(ds);
          if (isNaN(d)) return ds;
          const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const days  = Math.ceil((d - Date.now()) / 86400000);
          return days < 0 ? `${label} (EXPIRED ${Math.abs(days)}d ago)` : `${label} (in ${days}d)`;
        } catch { return ds; }
      };

      const deviceLines = (opts.devices || []).map(d => {
        const lines = [`  • ${d.name || d.serial} (${d.serial})${d.model ? ` – ${d.model}` : ''}`];
        if (d.licenseExpiry) lines.push(`    License Expiry: ${fmtExp(d.licenseExpiry)}`);
        if (d.eosDate)       lines.push(`    End of Support: ${fmtExp(d.eosDate)}`);
        return lines.join('\n');
      });

      const description = [
        `Org: ${opts.orgName || opts.atCompanyName}`,
        '',
        'The following Meraki devices require license renewal:',
        '',
        ...deviceLines,
        '',
        'Please review and process renewal orders as needed.',
        '',
        'Created via Anchor Hub Meraki License Management.',
      ].join('\n');

      // Step 4: POST ticket — due date 7 days out, 30 min estimated
      const dueDateTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const ticketBody = {
        companyID:      parseInt(opts.atCompanyId),
        title,
        description,
        status:         1,   // New
        estimatedHours: opts.estimatedHours != null ? Number(opts.estimatedHours) : 0.5,
        dueDateTime,
      };

      if (queueRes.status          === 'fulfilled') ticketBody.queueID                    = queueRes.value;
      if (issueTypeRes.status      === 'fulfilled') ticketBody.issueType                  = issueTypeRes.value;
      if (subIssueTypeRes.status   === 'fulfilled') ticketBody.subIssueType               = subIssueTypeRes.value;
      if (sourceRes.status         === 'fulfilled') ticketBody.source                     = sourceRes.value;
      if (slaRes.status            === 'fulfilled') ticketBody.serviceLevelAgreementID    = slaRes.value;
      if (ticketCategoryRes.status === 'fulfilled') ticketBody.ticketCategory             = ticketCategoryRes.value;
      if (priorityRes.status       === 'fulfilled') ticketBody.priority                   = priorityRes.value;
      if (billingCodeRes.status    === 'fulfilled') ticketBody.billingCodeID              = billingCodeRes.value;
      if (contractRes.status       === 'fulfilled' && contractRes.value) ticketBody.contractID = contractRes.value;

      // Both resource fields are required together — skip assignment if role can't be resolved
      const resource = resourceRes.status === 'fulfilled' ? resourceRes.value : null;
      if (resource?.resourceId && resource?.roleId) {
        ticketBody.assignedResourceID     = resource.resourceId;
        ticketBody.assignedResourceRoleID = resource.roleId;
      } else if (resource?.resourceId) {
        console.warn('[MerakiExp] Skipping resource assignment — roleId could not be resolved');
      }

      const ticketRes = await atFetch('/Tickets', {
        method: 'POST',
        body:   JSON.stringify(ticketBody),
      });
      const ticketId = ticketRes?.itemId || ticketRes?.item?.id;

      // Fetch the created ticket to get its human-readable ticket number (e.g. T20240101.0001)
      let ticketNumber = null;
      try {
        const detail = await atFetch(`/Tickets/${ticketId}`);
        ticketNumber = detail?.item?.ticketNumber || detail?.ticketNumber || null;
      } catch (e) {
        console.warn('[MerakiExp] Could not fetch ticket number:', e.message);
      }

      // Step 5: Add CI notes for each device that has a ciId
      let ciNotesAdded = 0;
      for (const d of (opts.devices || [])) {
        if (!d.ciId) continue;
        try {
          await atFetch('/ConfigurationItemNotes', {
            method: 'POST',
            body:   JSON.stringify({
              configurationItemID: parseInt(d.ciId),
              title:               'Meraki license renewal ticket created',
              description:         `Ticket #${ticketId} opened for Meraki license renewal.\nDevice: ${d.name} (${d.serial})`,
              noteType:            1,
              publish:             1,
            }),
          });
          ciNotesAdded++;
        } catch (e) {
          console.warn(`[MerakiExp] CI note failed for ${d.serial}:`, e.message);
        }
      }

      // Step 6: Audit entry
      await writeAuditEntry({
        actionType:    'TICKET_CREATED',
        atCompanyName: opts.atCompanyName,
        orgName:       opts.orgName || null,
        newValue:      JSON.stringify({ ticketId, deviceCount: (opts.devices || []).length }),
        result:        'success',
      });

      return { ok: true, ticketId, ticketNumber, ciNotesAdded };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Add a time entry to an existing ticket ───────────────────────────────────
  // opts: { ticketId, resourceName, hoursWorked, summaryNotes, atCompanyName }
  ipcMain.handle('meraki-exp-add-time-entry', async (_, opts) => {
    try {
      // Resolve resource ID and their default role ID together
      const resolved = await resolveResourceWithRole(opts.resourceName);
      const { resourceId, roleId } = resolved || {};
      if (!resourceId) throw new Error(`Resource "${opts.resourceName}" not found in Autotask.`);
      if (!roleId) throw new Error(`No role found for resource "${opts.resourceName}" in Autotask.`);

      const hoursWorked = parseFloat(opts.hoursWorked) || 0.5;
      const endDt      = new Date();
      const startDt    = new Date(endDt.getTime() - hoursWorked * 3600000);
      const dateWorked = endDt.toISOString().slice(0, 10);

      await atFetch('/TimeEntries', {
        method: 'POST',
        body:   JSON.stringify({
          ticketID:      parseInt(opts.ticketId),
          resourceID:    resourceId,
          roleID:        roleId,
          dateWorked,
          startDateTime: startDt.toISOString(),
          endDateTime:   endDt.toISOString(),
          hoursWorked,
          summaryNotes:  opts.summaryNotes || 'Meraki license renewal follow-up',
          timeEntryType: 1,   // 1 = Regular (standard picklist value)
          isNonBillable: false,
        }),
        // Impersonate the resource so the entry shows as created by them
        headers: { ImpersonationResourceId: String(resourceId) },
      });

      // Optionally update ticket status in the same call
      if (opts.newStatus != null) {
        await atFetch('/Tickets', {
          method: 'PATCH',
          body:   JSON.stringify({ id: parseInt(opts.ticketId), status: opts.newStatus }),
        });
      }

      await writeAuditEntry({
        actionType:    'TICKET_NOTE_ADDED',
        atCompanyName: opts.atCompanyName || null,
        newValue:      `Time entry (${hoursWorked}h) added to ticket ${opts.ticketId} by ${opts.resourceName}${opts.newStatus != null ? ` · status → ${opts.newStatus}` : ''}`,
        result:        'success',
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // ── Mark a ticket complete ────────────────────────────────────────────────────
  // opts: { ticketId, ticketNumber, atCompanyName }
  ipcMain.handle('meraki-exp-complete-ticket', async (_, opts) => {
    try {
      // status 5 = Complete in Autotask
      // AT REST API: PATCH goes to the collection endpoint with id in the body
      await atFetch('/Tickets', {
        method: 'PATCH',
        body:   JSON.stringify({ id: parseInt(opts.ticketId), status: 5 }),
      });
      await writeAuditEntry({
        actionType:    'TICKET_UPDATED',
        atCompanyName: opts.atCompanyName || null,
        newValue:      `Ticket ${opts.ticketNumber || opts.ticketId} marked complete`,
        result:        'success',
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
};

// Exported for use by the scheduler (Phase 10)
module.exports.getSettings     = getSettings;
module.exports.runScan         = runScan;
module.exports.writeAuditEntry = writeAuditEntry;

/**
 * Register the Meraki expiration scan job with the app-wide scheduler.
 * Call from main.js after startScheduler() — mainWindow is provided at run time.
 */
module.exports.registerWithScheduler = function(scheduler) {
  scheduler.registerJob({
    name:       'meraki-expiration-scan',

    getEnabled: async () => {
      const s = await getSettings();
      return s.scheduleEnabled;
    },

    getSchedule: async () => {
      const s = await getSettings();
      return { type: s.scheduleType, day: s.scheduleDay, time: s.scheduleTime };
    },

    getLastRun: () => {
      // Synchronous — the value is read from keytar cache if pre-fetched,
      // but keytar is async. We store the last-run timestamp in a module var
      // so the scheduler can read it synchronously.
      return _lastScanRun;
    },

    setLastRun: async (iso) => {
      _lastScanRun = iso;
      await keytar.setPassword(SERVICE_NAME, K_LAST_SCAN, iso);
    },

    run: async (mainWindow) => {
      const send = (data) => {
        try { mainWindow.webContents.send('meraki-exp-progress', data); } catch {}
      };
      await runScan(send, { scheduled: true });
      await writeAuditEntry({ actionType: 'SCHEDULE_RUN', result: 'success' });
    },
  });
};
