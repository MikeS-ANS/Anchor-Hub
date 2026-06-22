const fetch          = require('node-fetch');
const { msalApp }    = require('./msal');

const KV_VAULT_URL = 'https://anchor-hub-vault.vault.azure.net';
const KV_SCOPES    = ['https://vault.azure.net/user_impersonation'];
const _kvCache     = {};

async function kvGetSecret(secretName) {
  if (_kvCache[secretName]) return _kvCache[secretName];
  const accounts = await msalApp.getAllAccounts();
  if (!accounts.length) throw new Error('Not authenticated — sign in before accessing Key Vault');
  const res = await msalApp.acquireTokenSilent({ account: accounts[0], scopes: KV_SCOPES });
  const resp = await fetch(
    `${KV_VAULT_URL}/secrets/${encodeURIComponent(secretName)}?api-version=7.4`,
    { headers: { Authorization: `Bearer ${res.accessToken}` } }
  );
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body?.error?.message || `Key Vault returned ${resp.status} for secret "${secretName}"`);
  }
  const data = await resp.json();
  _kvCache[secretName] = data.value;
  return data.value;
}

module.exports = { kvGetSecret, KV_VAULT_URL, KV_SCOPES };
