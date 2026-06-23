const fetch       = require('node-fetch');
const { msalApp } = require('./msal');

const GRAPH     = 'https://graph.microsoft.com/v1.0';
const SCOPES    = ['https://graph.microsoft.com/Sites.Manage.All'];
const SP_HOST   = 'anchornetworksolutions.sharepoint.com';
const SP_PATH   = '/sites/Intranet';
const ROLE_COLS = ['Admin','Manager','Delivery','Tam','Strategic','Projects','Finance','Sales','Wsd'];

let _siteId       = null;
let _listIds      = {};
let _matrix       = null;   // Map<toolKey, Set<hubRole>>
let _overrides    = null;   // Map<email, Set<toolKey>>
let _userRoles    = null;   // string[] — all roles from the Azure AD token
let _userEmail    = null;   // string — signed-in user's UPN

async function getToken() {
  const accounts = await msalApp.getAllAccounts();
  if (!accounts.length) return null;
  try {
    const res = await msalApp.acquireTokenSilent({ account: accounts[0], scopes: SCOPES });
    return res.accessToken;
  } catch { return null; }
}

async function gGet(token, path) {
  const r = await fetch(`${GRAPH}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Graph ${r.status}: ${path}`);
  return r.json();
}

async function getSiteId(token) {
  if (_siteId) return _siteId;
  const d = await gGet(token, `/sites/${SP_HOST}:${SP_PATH}`);
  _siteId = d.id;
  return _siteId;
}

async function getListId(token, siteId, displayName) {
  if (_listIds[displayName]) return _listIds[displayName];
  const d = await gGet(token, `/sites/${siteId}/lists?$select=displayName,id`);
  for (const l of (d.value || [])) _listIds[l.displayName] = l.id;
  return _listIds[displayName] || null;
}

async function getListItems(token, siteId, listId) {
  const items = [];
  let url = `${GRAPH}/sites/${siteId}/lists/${listId}/items?expand=fields&$top=200`;
  while (url) {
    const d = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
    items.push(...(d.value || []));
    url = d['@odata.nextLink'] || null;
  }
  return items;
}

async function loadMatrix(token, siteId) {
  if (_matrix) return _matrix;
  const listId = await getListId(token, siteId, 'Hub Role Matrix');
  if (!listId) return null;
  const items = await getListItems(token, siteId, listId);
  _matrix = new Map();
  for (const item of items) {
    const f = item.fields || {};
    if (!f.ToolKey) continue;
    const allowed = new Set();
    for (const col of ROLE_COLS) {
      if (f[`Role${col}`]) allowed.add(`hub.${col.toLowerCase()}`);
    }
    _matrix.set(f.ToolKey, allowed);
  }
  return _matrix;
}

// Loads "Hub User Overrides" list → Map<email (lowercase), Set<toolKey>>
async function loadOverrides(token, siteId) {
  if (_overrides) return _overrides;
  _overrides = new Map();
  const listId = await getListId(token, siteId, 'Hub User Overrides');
  if (!listId) return _overrides;
  const items = await getListItems(token, siteId, listId);
  for (const item of items) {
    const f = item.fields || {};
    if (!f.Title || !f.ToolKey) continue;
    const email = f.Title.toLowerCase().trim();
    if (!_overrides.has(email)) _overrides.set(email, new Set());
    _overrides.get(email).add(f.ToolKey.trim());
  }
  return _overrides;
}

async function getUserRoles() {
  if (_userRoles !== null) return _userRoles;
  const accounts = await msalApp.getAllAccounts();
  if (!accounts.length) { _userRoles = []; return _userRoles; }
  _userEmail = accounts[0].username?.toLowerCase() || null;
  try {
    const res    = await msalApp.acquireTokenSilent({ account: accounts[0], scopes: SCOPES });
    const claims = res.idTokenClaims || accounts[0].idTokenClaims || {};
    _userRoles   = Array.isArray(claims.roles) ? claims.roles : [];
  } catch (e) {
    console.error('[roleMatrix] getUserRoles error:', e.message);
    _userRoles = [];
  }
  return _userRoles;
}

// Convenience: primary role for display purposes.
async function getUserRole() {
  const roles = await getUserRoles();
  return roles[0] || null;
}

// Returns the Set of tool keys the user can access.
// Sources: (1) Hub Role Matrix filtered by their Azure AD role(s),
//          (2) Hub User Overrides — individual grants, unioned in.
// Returns null if neither source is configured (show all tools as fallback).
async function getAllowedToolKeys() {
  const roles = await getUserRoles();
  const email = _userEmail;

  const token = await getToken();
  if (!token) return null;

  try {
    const siteId   = await getSiteId(token);
    const matrix   = await loadMatrix(token, siteId);
    const overrides = await loadOverrides(token, siteId);

    const userOverrides = email ? (overrides.get(email) || new Set()) : new Set();

    // No role and no individual overrides → show all tools (user not yet configured)
    if (!roles.length && !userOverrides.size) return null;

    const allowed = new Set(userOverrides);

    if (roles.length && matrix) {
      for (const [toolKey, toolRoles] of matrix) {
        if (roles.some(r => toolRoles.has(r))) allowed.add(toolKey);
      }
    }

    return allowed;
  } catch (e) {
    console.error('[roleMatrix] getAllowedToolKeys error:', e.message);
    return null;
  }
}

function clearRoleCache() {
  _siteId    = null;
  _listIds   = {};
  _matrix    = null;
  _overrides = null;
  _userRoles = null;
  _userEmail = null;
}

module.exports = { getUserRole, getUserRoles, getAllowedToolKeys, clearRoleCache };
