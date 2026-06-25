/**
 * Shared access to the central hub-company-mappings.json (v2) on SharePoint.
 * Consumed by companyMapping.js, blackpoint.js, kaseyaProcessor.js, and any
 * future tool that needs to map its org names to Autotask companies.
 */

const fetch = require('node-fetch');

const SP_SITE_URL     = 'https://graph.microsoft.com/v1.0/sites/anchornetworksolutions.sharepoint.com:/sites/Intranet:';
const GRAPH_SCOPES    = ['https://graph.microsoft.com/Files.ReadWrite.All'];
const SP_MAPPINGS_LIB = 'ANS-Company Shared';
const SP_HUB_PATH     = '/Anchor%20Hub/hub-company-mappings.json';

let _spSiteId     = null;
let _spDriveBases = {};

async function spDownload(url) {
  const MAX_ATTEMPTS = 5;
  let lastErr;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`SP download ${res.status}`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (i < MAX_ATTEMPTS - 1) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

async function getGraphToken() {
  const { msalApp } = require('./msal');
  const accounts = await msalApp.getAllAccounts();
  if (!accounts.length) throw new Error('Not signed in');
  try {
    return await msalApp.acquireTokenSilent({ account: accounts[0], scopes: GRAPH_SCOPES });
  } catch (e) {
    if (e.name === 'InteractionRequiredAuthError' || (e.message || '').includes('interaction_required'))
      throw new Error('SharePoint access requires re-authentication. Sign out and sign back in.');
    throw e;
  }
}

// libName defaults to SP_MAPPINGS_LIB; pass a different name to access other libraries.
async function getSpDriveBase(tokenRes, libName) {
  const lib = libName || SP_MAPPINGS_LIB;
  if (_spDriveBases[lib]) return _spDriveBases[lib];
  if (!_spSiteId) {
    const r = await fetch(SP_SITE_URL, { headers: { Authorization: `Bearer ${tokenRes.accessToken}` } });
    if (!r.ok) throw new Error(`SharePoint site lookup failed (${r.status})`);
    _spSiteId = (await r.json()).id;
  }
  const r2 = await fetch(`https://graph.microsoft.com/v1.0/sites/${_spSiteId}/drives`, {
    headers: { Authorization: `Bearer ${tokenRes.accessToken}` },
  });
  if (!r2.ok) throw new Error(`SharePoint drives lookup failed (${r2.status})`);
  const drives = (await r2.json()).value || [];
  for (const d of drives) {
    const base = `https://graph.microsoft.com/v1.0/drives/${d.id}/root:`;
    _spDriveBases[d.name] = base;
    // Also index by URL path segment (last segment of webUrl, lowercased) for flexible lookup
    if (d.webUrl) {
      const urlSeg = d.webUrl.split('/').pop();
      if (urlSeg && urlSeg !== d.name) _spDriveBases[urlSeg] = base;
    }
  }
  if (!_spDriveBases[lib]) {
    const available = drives.map(d => `"${d.name}"`).join(', ');
    throw new Error(`SharePoint library "${lib}" not found. Available: ${available}`);
  }
  return _spDriveBases[lib];
}

async function hubGraphFetch(spPath, opts = {}) {
  const tokenRes  = await getGraphToken();
  const base      = await getSpDriveBase(tokenRes);
  const fetchOpts = {
    method: opts.method || 'GET',
    headers: { Authorization: `Bearer ${tokenRes.accessToken}`, ...opts.headers },
  };
  if (opts.body !== undefined) fetchOpts.body = opts.body;
  const res = await fetch(`${base}${spPath}`, fetchOpts);
  if (!res.ok) {
    if (res.status === 404) return null;
    const body = await res.text().catch(() => '');
    throw new Error(`Graph ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

// Load hub-company-mappings.json from SharePoint. Returns null on failure.
async function loadHubDirectory() {
  try {
    const meta = await hubGraphFetch(`${SP_HUB_PATH}:`);
    if (!meta) return null;
    const dlUrl = meta['@microsoft.graph.downloadUrl'];
    if (!dlUrl) return null;
    return JSON.parse(await spDownload(dlUrl));
  } catch (e) {
    console.warn('[HubDirectory] SP load failed:', e.message);
    return null;
  }
}

// Save hub-company-mappings.json to SharePoint (retries up to 4x on network errors).
async function saveHubDirectory(data) {
  const body = Buffer.from(JSON.stringify(data, null, 2), 'utf8');
  const MAX_ATTEMPTS = 4;
  let lastErr;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      await hubGraphFetch(`${SP_HUB_PATH}:/content`, {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/octet-stream' },
      });
      return;
    } catch (e) {
      lastErr = e;
      if (i < MAX_ATTEMPTS - 1) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

// ─── Platform helpers ─────────────────────────────────────────────────────────

// Find the hub entry where entry.platforms[platform].name === name (case-insensitive).
function findEntryByPlatformName(hub, platform, name) {
  const norm = s => (s || '').toLowerCase().trim();
  return (hub.companies || []).find(e => norm(e.platforms?.[platform]?.name) === norm(name)) || null;
}

// Get or create a hub entry by atId. Creates a new entry and appends to hub.companies.
function getOrCreateEntry(hub, atId, atName) {
  let entry = (hub.companies || []).find(e => e.atId === atId);
  if (!entry) {
    entry = { atId, atName: atName || '', excluded: false, platforms: {} };
    if (!hub.companies) hub.companies = [];
    hub.companies.push(entry);
  } else {
    if (atName && !entry.atName) entry.atName = atName;
    if (!entry.platforms) entry.platforms = {};
  }
  return entry;
}

// Upsert a platform sub-entry onto an AT-centric hub entry.
// platformData: { name, confidence, confirmedAt?, ... }
function upsertPlatformEntry(hub, atId, atName, platform, platformData) {
  const entry = getOrCreateEntry(hub, atId, atName);
  entry.platforms[platform] = platformData;
  hub._version = 2;
  hub._updated = new Date().toISOString();
  return entry;
}

// Mark/unmark a platform name as excluded.
function setPlatformExcluded(hub, platform, platformName, excluded) {
  const entry = findEntryByPlatformName(hub, platform, platformName);
  if (entry?.platforms?.[platform]) {
    if (excluded) entry.platforms[platform].excluded = true;
    else          delete entry.platforms[platform].excluded;
    hub._updated = new Date().toISOString();
  }
}

// Build a name→{atId,atName} lookup map for a given platform.
// Handles both single-object (legacy) and array (current) kaseya entries.
// Returns Map<platformName, { atId, atName, confidence, confirmedAt? }>
function buildPlatformLookup(hub, platform) {
  const map = new Map();
  for (const entry of (hub?.companies || [])) {
    if (entry.excluded) continue;
    const p = entry.platforms?.[platform];
    if (!p) continue;
    const items = Array.isArray(p) ? p : [p];
    for (const item of items) {
      if (!item?.name || item.excluded) continue;
      map.set(item.name.toLowerCase().trim(), { atId: entry.atId, atName: entry.atName, confidence: item.confidence, confirmedAt: item.confirmedAt });
    }
  }
  return map;
}

// Kaseya-specific upsert: one AT company can have MULTIPLE Kaseya names (N:1).
// Stores platforms.kaseya as an array; auto-upgrades legacy single-object entries.
function upsertKaseyaEntry(hub, atId, atName, kaseyaName, platformData) {
  const entry = getOrCreateEntry(hub, atId, atName);
  const raw = entry.platforms.kaseya;
  let arr = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  const norm = s => (s || '').toLowerCase().trim();
  const idx = arr.findIndex(e => norm(e.name) === norm(kaseyaName));
  if (idx >= 0) arr[idx] = platformData;
  else arr.push(platformData);
  entry.platforms.kaseya = arr;
  hub._version = 2;
  hub._updated = new Date().toISOString();
  return entry;
}

module.exports = {
  loadHubDirectory,
  saveHubDirectory,
  findEntryByPlatformName,
  getOrCreateEntry,
  upsertPlatformEntry,
  upsertKaseyaEntry,
  setPlatformExcluded,
  buildPlatformLookup,
  // Exported for other SP tools to reuse auth + drive lookup
  getGraphToken,
  getSpDriveBase,
  spDownload,
  SP_SITE_URL,
  GRAPH_SCOPES,
};
