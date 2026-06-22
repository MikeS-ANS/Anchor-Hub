const crypto              = require('crypto');
const fetch               = require('node-fetch');
const { kvGetSecret }     = require('../shared/kv');
const { readState, writeState } = require('../shared/state');

function duoEncode(str) {
  return encodeURIComponent(String(str)).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function duoSign(ikey, skey, method, host, path, params) {
  const date = new Date().toUTCString();
  const canonParams = Object.keys(params).sort()
    .map(k => `${duoEncode(k)}=${duoEncode(params[k])}`)
    .join('&');
  const canon = [date, method.toUpperCase(), host.toLowerCase(), path, canonParams].join('\n');
  const sig = crypto.createHmac('sha1', skey).update(canon).digest('hex');
  const auth = Buffer.from(`${ikey}:${sig}`).toString('base64');
  return { date, auth };
}

async function duoRequest(ikey, skey, host, method, path, params = {}) {
  const { date, auth } = duoSign(ikey, skey, method, host, path, params);
  let url = `https://${host}${path}`;
  const headers = { Authorization: `Basic ${auth}`, Date: date };
  const opts = { method, headers };

  if (method === 'GET' || method === 'DELETE') {
    const qs = Object.keys(params).sort()
      .map(k => `${duoEncode(k)}=${duoEncode(params[k])}`).join('&');
    if (qs) url += `?${qs}`;
  } else if (method === 'POST' || method === 'PUT') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = Object.keys(params).sort()
      .map(k => `${duoEncode(k)}=${duoEncode(params[k])}`).join('&');
  }

  const res = await fetch(url, opts);
  const rawText = await res.text();
  let data;
  try { data = JSON.parse(rawText); } catch { throw new Error(`Duo API ${res.status}: ${rawText.slice(0, 200)}`); }
  if (data.stat !== 'OK') throw new Error(`${data.message || 'Duo API error'} (HTTP ${res.status}, code ${data.code ?? '?'})`);
  return data.response;
}

async function getDuoAdminCreds() {
  const [ikey, skey, host] = await Promise.all([
    kvGetSecret('duo-admin-ikey'),
    kvGetSecret('duo-admin-skey'),
    kvGetSecret('duo-admin-host'),
  ]);
  return { ikey, skey, host };
}

module.exports = function registerDuo(ipcMain) {
  ipcMain.handle('duo-list-admins', async () => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      const admins = await duoRequest(ikey, skey, host, 'GET', '/admin/v1/admins');
      return { admins: Array.isArray(admins) ? admins : [] };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-find-admin', async (_, email) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      const all = await duoRequest(ikey, skey, host, 'GET', '/admin/v1/admins');
      const found = (Array.isArray(all) ? all : []).filter(a =>
        (a.email || '').toLowerCase() === email.toLowerCase()
      );
      return { admins: found };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-create-admin', async (_, { email, name, phone, roleId, sendEmail }) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      const params = { email, name };
      if (phone) params.phone = phone;
      if (roleId) params.role_id = roleId;
      params.send_email = sendEmail ? '1' : '0';
      const admin = await duoRequest(ikey, skey, host, 'POST', '/admin/v1/admins', params);
      return { admin };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-delete-admin', async (_, adminId) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      await duoRequest(ikey, skey, host, 'DELETE', `/admin/v1/admins/${adminId}`);
      return { success: true };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-find-users', async (_, username) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      const result = await duoRequest(ikey, skey, host, 'GET', '/admin/v1/users', { username });
      const users = Array.isArray(result) ? result : (result ? [result] : []);
      return { users };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-create-phone', async (_, { number, name }) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      const params = { number, type: 'mobile', platform: 'generic smartphone' };
      if (name) params.name = name;
      const phone = await duoRequest(ikey, skey, host, 'POST', '/admin/v1/phones', params);
      return { phone };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-find-phones', async (_, number) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      const result = await duoRequest(ikey, skey, host, 'GET', '/admin/v1/phones', { number });
      return { phones: Array.isArray(result) ? result : [] };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-associate-phone', async (_, { userId, phoneId }) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      await duoRequest(ikey, skey, host, 'POST', `/admin/v1/users/${userId}/phones`, { phone_id: phoneId });
      return { success: true };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-delete-phone', async (_, phoneId) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      await duoRequest(ikey, skey, host, 'DELETE', `/admin/v1/phones/${phoneId}`);
      return { success: true };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-send-activation', async (_, phoneId) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      const result = await duoRequest(ikey, skey, host, 'POST',
        `/admin/v1/phones/${phoneId}/send_sms_activation`, { install: '1' });
      return { result };
    } catch (e) { return { error: e.message }; }
  });

  // Sub-account handlers
  ipcMain.handle('duo-list-sub-accounts', async () => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      const result = await duoRequest(ikey, skey, host, 'POST', '/accounts/v1/account/list');
      const accounts = Array.isArray(result) ? result : (result ? [result] : []);
      return { accounts };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-sub-find-users', async (_, { accountId, username }) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      const result = await duoRequest(ikey, skey, host, 'GET', '/admin/v1/users',
        { username, account_id: accountId });
      const users = Array.isArray(result) ? result : (result ? [result] : []);
      return { users };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-sub-create-phone', async (_, { accountId, number, name }) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      const params = { number, type: 'mobile', platform: 'generic smartphone', account_id: accountId };
      if (name) params.name = name;
      const phone = await duoRequest(ikey, skey, host, 'POST', '/admin/v1/phones', params);
      return { phone };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-sub-associate-phone', async (_, { accountId, userId, phoneId }) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      await duoRequest(ikey, skey, host, 'POST', `/admin/v1/users/${userId}/phones`,
        { phone_id: phoneId, account_id: accountId });
      return { success: true };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-sub-send-activation', async (_, { accountId, phoneId }) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      const result = await duoRequest(ikey, skey, host, 'POST',
        `/admin/v1/phones/${phoneId}/send_sms_activation`,
        { install: '1', account_id: accountId });
      return { result };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-sub-find-phones', async (_, { accountId, number }) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      const result = await duoRequest(ikey, skey, host, 'GET', '/admin/v1/phones',
        { number, account_id: accountId });
      return { phones: Array.isArray(result) ? result : [] };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-sub-delete-phone', async (_, { accountId, phoneId }) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      await duoRequest(ikey, skey, host, 'DELETE', `/admin/v1/phones/${phoneId}`,
        { account_id: accountId });
      return { success: true };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-sub-delete-user', async (_, { accountId, userId }) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      await duoRequest(ikey, skey, host, 'DELETE', `/admin/v1/users/${userId}`,
        { account_id: accountId });
      return { success: true };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-sub-update-phone', async (_, { accountId, phoneId, name }) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      await duoRequest(ikey, skey, host, 'POST', `/admin/v1/phones/${phoneId}`,
        { account_id: accountId, name });
      return { success: true };
    } catch (e) { return { error: e.message }; }
  });

  // Account + application management
  ipcMain.handle('duo-create-account', async (_, { name, phone, addr1, addr2, city, state, zip, country }) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      const params = { name };
      if (phone)   params.phone   = phone;
      if (addr1)   params.addr1   = addr1;
      if (addr2)   params.addr2   = addr2;
      if (city)    params.city    = city;
      if (state)   params.state   = state;
      if (zip)     params.zip     = zip;
      if (country) params.country = country;
      const account = await duoRequest(ikey, skey, host, 'POST', '/accounts/v1/account/create', params);
      return { account };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-create-parent-application', async (_, { name }) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      const app = await duoRequest(ikey, skey, host, 'POST', '/admin/v1/integrations', { name, type: 'rdp' });
      app.api_hostname = app.api_hostname || host;
      try {
        await duoRequest(ikey, skey, host, 'POST', `/admin/v1/integrations/${app.integration_key}`,
          { user_access: 'ALL_USERS' });
      } catch (e2) { app._userAccessWarning = e2.message; }
      return { app };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-create-sub-application', async (_, { accountId, name }) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      const app = await duoRequest(ikey, skey, host, 'POST', '/admin/v1/integrations',
        { name, type: 'rdp', account_id: accountId });
      app.api_hostname = app.api_hostname || host;
      try {
        await duoRequest(ikey, skey, host, 'POST', `/admin/v1/integrations/${app.integration_key}`,
          { account_id: accountId, user_access: 'ALL_USERS' });
      } catch (e2) { app._userAccessWarning = e2.message; }
      return { app };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-list-parent-applications', async () => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      const apps = await duoRequest(ikey, skey, host, 'GET', '/admin/v1/integrations');
      const rdpApps = (Array.isArray(apps) ? apps : []).filter(a => a.type === 'rdp');
      return { apps: rdpApps };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-list-applications', async (_, { accountId } = {}) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      const params = accountId ? { account_id: accountId } : {};
      const apps = await duoRequest(ikey, skey, host, 'GET', '/admin/v1/integrations', params);
      const rdpApps = (Array.isArray(apps) ? apps : []).filter(a => a.type === 'rdp');
      rdpApps.forEach(a => { if (!a.api_hostname) a.api_hostname = host; });
      return { apps: rdpApps };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-delete-parent-application', async (_, { integrationKey }) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      await duoRequest(ikey, skey, host, 'DELETE', `/admin/v1/integrations/${integrationKey}`);
      return { success: true };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-sub-create-user', async (_, { accountId, username, realname, email, firstname, lastname }) => {
    try {
      const { ikey, skey, host } = await getDuoAdminCreds();
      const params = { username, account_id: accountId };
      if (realname)  params.realname  = realname;
      if (email)     params.email     = email;
      if (firstname) params.firstname = firstname;
      if (lastname)  params.lastname  = lastname;
      const user = await duoRequest(ikey, skey, host, 'POST', '/admin/v1/users', params);
      return { user };
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('duo-get-excluded-accounts', () => {
    return { excluded: readState().duoExcludedAccounts || [] };
  });

  ipcMain.handle('duo-save-excluded-accounts', (_, { excluded }) => {
    writeState({ duoExcludedAccounts: Array.isArray(excluded) ? excluded : [] });
    return { success: true };
  });
};
