const fs                                    = require('fs');
const fetch                                 = require('node-fetch');
const { shell }                             = require('electron');
const { msalApp, MSAL_SCOPES, MSAL_CACHE_FILE } = require('../shared/msal');

async function fetchGraphPhoto(accessToken) {
  try {
    const res = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return `data:image/jpeg;base64,${Buffer.from(buf).toString('base64')}`;
  } catch { return null; }
}

async function buildUserInfo(res) {
  const claims = res.idTokenClaims || {};
  const roles  = Array.isArray(claims.roles) ? claims.roles : [];
  const photo  = res.accessToken ? await fetchGraphPhoto(res.accessToken) : null;
  return {
    name:    claims.name || res.account?.name || '',
    email:   claims.preferred_username || res.account?.username || '',
    roles,
    isAdmin: roles.includes('hub.admin'),
    photo,
  };
}

async function msalGetSilent() {
  const accounts = await msalApp.getAllAccounts();
  if (!accounts.length) return null;
  try {
    const res = await msalApp.acquireTokenSilent({ account: accounts[0], scopes: MSAL_SCOPES });
    return await buildUserInfo(res);
  } catch { return null; }
}

module.exports = function registerAuth(ipcMain) {
  ipcMain.handle('auth-get-user', async () => {
    try { return await msalGetSilent(); } catch { return null; }
  });

  ipcMain.handle('auth-login', async () => {
    try {
      const res = await msalApp.acquireTokenInteractive({
        scopes: MSAL_SCOPES,
        openBrowser: async (url) => { await shell.openExternal(url); },
        successTemplate: `<!DOCTYPE html><html><head><style>
          body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;
          font-family:-apple-system,sans-serif;background:#0d0d0d;color:#e8e8e8;flex-direction:column;gap:12px}
          h2{font-size:18px;font-weight:600;margin:0}p{font-size:13px;color:#888;margin:0}
        </style></head><body><h2>Login successful</h2><p>You can close this tab.</p></body></html>`,
        errorTemplate: `<!DOCTYPE html><html><head><style>
          body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;
          font-family:-apple-system,sans-serif;background:#0d0d0d;color:#e8e8e8;flex-direction:column;gap:12px}
          h2{font-size:18px;font-weight:600;margin:0;color:#f87171}p{font-size:13px;color:#888;margin:0}
        </style></head><body><h2>Login failed</h2><p>Please close this tab and try again.</p></body></html>`,
      });
      return await buildUserInfo(res);
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('auth-logout', async () => {
    try {
      const accounts = await msalApp.getAllAccounts();
      for (const acct of accounts) await msalApp.clearCache({ account: acct });
      try { fs.unlinkSync(MSAL_CACHE_FILE); } catch {}
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  });
};
