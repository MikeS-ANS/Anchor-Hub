/**
 * Shared access to the central hub-company-mappings.json on SharePoint.
 * Consumed by companyMapping.js, blackpoint.js, kaseyaProcessor.js, atPush.js,
 * and any future tool that needs to map its org names to Autotask companies.
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

// ─── Service mapping defaults ─────────────────────────────────────────────────
// These mirror the hardcoded constants in kaseyaProcessor.js, atPush.js, and
// blackpoint.js. They are seeded into hub.serviceMappings on first load so
// that the Company Mapping UI can show and edit them without a code change.

const DEFAULT_SERVICE_MAPPINGS = {
  kaseya: [
    { id: 'dwp-metered-user',   vendorName: 'DWP Metered Plan - User License',                  atServiceId: 58,  atServiceName: '', contracts: ['Managed Cloud Services'] },
    { id: 'dwp-metered-server', vendorName: 'DWP Metered Plan - Server License',                atServiceId: 111, atServiceName: '', contracts: ['Managed Cloud Services'] },
    { id: 'dwp-unlim-server',   vendorName: 'DWP Unlimited Plan - Server License',              atServiceId: 126, atServiceName: '', contracts: ['Managed Cloud Services'] },
    { id: 'dwp-unlim-user',     vendorName: 'DWP Unlimited Plan - User License',                atServiceId: 125, atServiceName: '', contracts: ['Managed Cloud Services'] },
    { id: 'dfp-unlim-server',   vendorName: 'DFP Unlimited Plan - Server License',              atServiceId: 253, atServiceName: '', contracts: ['Managed Cloud Services'] },
    { id: 'saas-monthly',       vendorName: 'SaaS Protection Infinite Cloud Retention Monthly', atServiceId: 98,  atServiceName: '', contracts: ['Managed Cloud Services', 'Managed Security Services'] },
    { id: 'saas-monthly-seat',  vendorName: 'SaaS Protection Infinite Cloud Retention Monthly', atServiceId: 88,  atServiceName: '', contracts: ['Managed Cloud Services', 'Managed Security Services'], note: 'Seat variant' },
  ],
  pax8: [
    { id: 'azure',              vendorKey: 'azure',      vendorLabel: 'Azure',               atServiceId: 110, atServiceName: '', contracts: ['Azure'] },
    { id: 'nerdio',             vendorKey: 'nerdio',     vendorLabel: 'Nerdio',              atServiceId: 159, atServiceName: '', contracts: ['Azure'] },
    { id: 'exclaimer-cloud',    vendorKey: 'exclaimer',  vendorLabel: 'Exclaimer',           atServiceId: 262, atServiceName: '', contracts: ['Managed Cloud'] },
    { id: 'exclaimer-security', vendorKey: 'exclaimer',  vendorLabel: 'Exclaimer (Security)',atServiceId: 288, atServiceName: '', contracts: ['Managed Security'] },
    { id: 'ironscales',         vendorKey: 'ironscales', vendorLabel: 'Ironscales',          atServiceId: 275, atServiceName: '', contracts: ['Managed Cloud', 'Managed Security'] },
    { id: 'printix',            vendorKey: 'printix',    vendorLabel: 'Printix',             atServiceId: 266, atServiceName: '', contracts: ['Managed Cloud'] },
  ],
  blackpoint: [
    { id: 'sp', vendorName: 'Security Plus', atServices: [{ id: 119, name: '' }, { id: 263, name: '' }], contracts: ['Managed Security Services'] },
    { id: '365-defense', vendorName: '365 Defense', atServices: [{ id: 226, name: '' }], contracts: ['Managed Security Services'] },
  ],
};

// Seed hub.serviceMappings from defaults if not present (in-memory only; written on next save).
function ensureServiceMappings(hub) {
  if (!hub || hub.serviceMappings) return;
  hub.serviceMappings = JSON.parse(JSON.stringify(DEFAULT_SERVICE_MAPPINGS));
}

// Return serviceMappings for a tool from hub, falling back to the built-in defaults.
function getServiceMappings(hub, tool) {
  return hub?.serviceMappings?.[tool] ?? DEFAULT_SERVICE_MAPPINGS[tool] ?? [];
}

// Get all AT service IDs for a mapping entry.
// Handles both the old single-id format ({ atServiceId }) and the new array format ({ atServices }).
// Also handles legacy sp-primary/sp-alt entries by treating them as single-service entries.
function getSvcAtServiceIds(m) {
  if (Array.isArray(m.atServices) && m.atServices.length)
    return m.atServices.map(s => s.id).filter(Boolean);
  if (m.atServiceId) return [m.atServiceId];
  return [];
}

// Load hub-company-mappings.json from SharePoint. Returns null on failure.
async function loadHubDirectory() {
  try {
    const meta = await hubGraphFetch(`${SP_HUB_PATH}:`);
    if (!meta) return null;
    const dlUrl = meta['@microsoft.graph.downloadUrl'];
    if (!dlUrl) return null;
    const data = JSON.parse(await spDownload(dlUrl));

    // Detect old Blackpoint compat format accidentally saved to the hub file.
    // Shape: { _version: 2, _hubRaw: <hub|null>, mappings: {}, excluded: {} }
    // If _hubRaw is a valid hub, extract it. Otherwise start with an empty hub.
    // Either way, immediately overwrite SP to repair the file for next load.
    if ('_hubRaw' in data && 'mappings' in data && 'excluded' in data) {
      const recovered = (data._hubRaw && Array.isArray(data._hubRaw.companies))
        ? data._hubRaw
        : { _version: 3, companies: [] };
      console.warn('[HubDirectory] Detected corrupted hub file (BP compat format). Recovering...');
      ensureServiceMappings(recovered);
      saveHubDirectory(recovered).catch(e => console.warn('[HubDirectory] Recovery overwrite failed:', e.message));
      return recovered;
    }

    ensureServiceMappings(data);
    return data;
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
  // Service mapping helpers
  DEFAULT_SERVICE_MAPPINGS,
  ensureServiceMappings,
  getServiceMappings,
  getSvcAtServiceIds,
  // Exported for other SP tools to reuse auth + drive lookup
  getGraphToken,
  getSpDriveBase,
  spDownload,
  SP_SITE_URL,
  GRAPH_SCOPES,
};
