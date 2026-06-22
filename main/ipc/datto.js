const fetch           = require('node-fetch');
const { kvGetSecret } = require('../shared/kv');

const _dattoTokens = {};

async function getDattoToken(type) {
  const now = Date.now();
  if (_dattoTokens[type] && _dattoTokens[type].exp > now + 60_000) {
    return _dattoTokens[type].token;
  }
  const baseUrl = (await kvGetSecret('datto-rmm-url')).replace(/\/+$/, '');
  const user    = await kvGetSecret(`datto-rmm-user-${type}`);
  const secret  = await kvGetSecret(`datto-rmm-secret-${type}`);

  // Datto OAuth: Basic auth = fixed public-client:public, API keys go in body as username/password
  const clientCreds = Buffer.from('public-client:public').toString('base64');
  const r = await fetch(`${baseUrl}/auth/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'Authorization': `Basic ${clientCreds}`,
    },
    body: `grant_type=password&username=${encodeURIComponent(user)}&password=${encodeURIComponent(secret)}`,
  });
  const txt = await r.text();
  let result;
  try { result = { status: r.status, data: JSON.parse(txt) }; }
  catch { result = { status: r.status, error: `HTTP ${r.status}: ${txt.slice(0, 300)}` }; }

  if (!result.data?.access_token) {
    const detail = result.error || `${result.data?.error_description || result.data?.error || JSON.stringify(result.data)}`;
    throw new Error(`Datto auth failed — verify datto-rmm-user-${type} / datto-rmm-secret-${type} in Key Vault. Detail: ${detail}`);
  }
  const data = result.data;
  _dattoTokens[type] = { token: data.access_token, exp: now + ((data.expires_in || 86400) * 1000) };
  return data.access_token;
}

async function dattoRequest(type, method, urlPath, body = null) {
  const baseUrl = (await kvGetSecret('datto-rmm-url')).replace(/\/+$/, '');
  const token = await getDattoToken(type);
  const opts = { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${baseUrl}${urlPath}`, opts);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Datto ${res.status}: ${err}`);
  }
  return res.json();
}

let _duoComponentUid = null;

module.exports = function registerDatto(ipcMain) {
  ipcMain.handle('datto-list-sites', async () => {
    try {
      const data = await dattoRequest('ro', 'GET', '/api/v2/account/sites');
      const sites = (data.sites || []).map(s => ({ uid: s.uid, name: s.name }));
      sites.sort((a, b) => a.name.localeCompare(b.name));
      return { sites };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('datto-list-site-servers', async (_, { siteUid }) => {
    try {
      const data = await dattoRequest('ro', 'GET', `/api/v2/site/${siteUid}/devices`);
      const devices = (data.devices || [])
        .filter(d => {
          const cat = (d.deviceType && d.deviceType.category) || '';
          const os  = (d.operatingSystem || '').toLowerCase();
          return cat.toLowerCase() === 'server' || os.includes('server');
        })
        .map(d => ({ uid: d.uid, hostname: d.hostname, os: d.operatingSystem }));
      devices.sort((a, b) => (a.hostname || '').localeCompare(b.hostname || ''));
      return { devices };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('datto-run-duo-quickjob', async (_, { deviceUid, ikey, skey, apiHostname }) => {
    try {
      if (!_duoComponentUid) {
        const data = await dattoRequest('full', 'GET', '/api/v2/account/components');
        const components = data.components || [];
        const duo = components.find(c => c.name && c.name.includes('ANS - DUO Install'));
        if (!duo) throw new Error('Component "ANS - DUO Install" not found in Datto RMM. Check the component name.');
        _duoComponentUid = duo.uid;
      }
      const job = await dattoRequest('full', 'PUT', `/api/v2/device/${deviceUid}/quickjob`, {
        jobName: 'ANS - DUO Install',
        jobComponent: {
          componentUid: _duoComponentUid,
          variables: [
            { name: 'IKEY', value: ikey },
            { name: 'SKEY', value: skey },
            { name: 'HOST', value: apiHostname },
          ],
        },
      });
      const jobUid = job?.job?.uid || job?.job?.id || null;
      return { jobUid };
    } catch (e) { return { error: e.message }; }
  });
};
