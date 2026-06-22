const { app }                    = require('electron');
const { PublicClientApplication } = require('@azure/msal-node');
const path                        = require('path');
const fs                          = require('fs');

const MSAL_CACHE_FILE = path.join(app.getPath('userData'), 'anchor-msal-cache.json');
const MSAL_CLIENT_ID  = '77dedc7f-7fe0-4814-b243-1a0ed8a5bb7e';
const MSAL_TENANT_ID  = '56946bea-f25a-4d9c-ab2e-0cc6945e4daa';
const MSAL_SCOPES     = ['openid', 'profile', 'email', 'User.Read'];

const msalCachePlugin = {
  beforeCacheAccess: async (ctx) => {
    try { ctx.tokenCache.deserialize(fs.readFileSync(MSAL_CACHE_FILE, 'utf8')); } catch {}
  },
  afterCacheAccess: async (ctx) => {
    if (ctx.cacheHasChanged) fs.writeFileSync(MSAL_CACHE_FILE, ctx.tokenCache.serialize());
  },
};

const msalApp = new PublicClientApplication({
  auth: {
    clientId: MSAL_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${MSAL_TENANT_ID}`,
  },
  cache: { cachePlugin: msalCachePlugin },
});

module.exports = { msalApp, MSAL_SCOPES, MSAL_CACHE_FILE };
