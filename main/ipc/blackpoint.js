const fs    = require('fs');
const path  = require('path');
const fetch = require('node-fetch');
const { app, shell } = require('electron');
const { atFetch, atQuery } = require('../shared/at');
const { kvGetSecret }      = require('../shared/kv');
const { USER_DATA, getMainWindow } = require('../shared/state');
const { loadHubDirectory, saveHubDirectory, getServiceMappings, getSvcAtServiceIds } = require('../shared/hubDirectory');

const BP_BASE          = 'https://api.blackpointcyber.com';
const BP_SNAPSHOT_FILE = path.join(USER_DATA, 'anchor-bp-snapshot.json');
const ANS_AT_ID        = 30528635;

const SP_SITE_URL     = 'https://graph.microsoft.com/v1.0/sites/anchornetworksolutions.sharepoint.com:/sites/Intranet:';
const GRAPH_SCOPES    = ['https://graph.microsoft.com/Files.ReadWrite.All'];
const SP_INVOICES_LIB = 'ANS-Vendors';
const SP_INVOICES     = '/Blackpoint/invoices';
const SP_MAPPINGS_LIB = 'ANS-Company Shared';
const SP_MAPPINGS     = '/Anchor%20Hub/hub-company-mappings.json'; // central AT-centric directory
const SP_PUSH_LOG     = '/Blackpoint/push-log.json';

// ─── Bulk AT data cache (30-min TTL) ─────────────────────────────────────────
let _bpBulkCache   = null;
let _bpBulkCacheAt = 0;
const BP_BULK_TTL  = 30 * 60 * 1000;
function getBulkCache()      { return (_bpBulkCache && Date.now() - _bpBulkCacheAt < BP_BULK_TTL) ? _bpBulkCache : null; }
function setBulkCache(data)  { _bpBulkCache = data; _bpBulkCacheAt = Date.now(); }
function clearBulkCache()    { _bpBulkCache = null; }

// Preferred Security+ service ID — updated during bulk load by scanning existing contracts
let _preferredSpServiceId = 119;

// ─── Graph API ────────────────────────────────────────────────────────────────

// SharePoint download.aspx URLs cause ECONNRESET with node-fetch and Node's https module.
// Electron's net module uses Chromium's networking stack and handles them correctly.
function spDownload(url) {
  const { net } = require('electron');
  return new Promise((resolve, reject) => {
    const req = net.request({ url, method: 'GET' });
    const chunks = [];
    req.on('response', (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`SP download failed: ${res.statusCode}`));
      }
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

let _spSiteId  = null;
let _spDriveBases = {};  // library name → `drives/{id}/root:`

async function getGraphToken() {
  const { msalApp } = require('../shared/msal');
  const accounts = await msalApp.getAllAccounts();
  if (!accounts.length) throw new Error('Not signed in — sign in via Microsoft SSO first');
  try {
    return await msalApp.acquireTokenSilent({ account: accounts[0], scopes: GRAPH_SCOPES });
  } catch (e) {
    if (e.name === 'InteractionRequiredAuthError' || (e.message && e.message.includes('interaction_required'))) {
      throw new Error('SharePoint access requires re-authentication. Sign out and sign back in to grant file access permissions.');
    }
    throw e;
  }
}

async function getSpDriveBase(libraryName, tokenRes) {
  if (_spDriveBases[libraryName]) return _spDriveBases[libraryName];

  // Resolve site ID on first use
  if (!_spSiteId) {
    const r = await fetch(SP_SITE_URL, { headers: { Authorization: `Bearer ${tokenRes.accessToken}` } });
    if (!r.ok) throw new Error(`SharePoint site lookup failed (${r.status}): ${await r.text().catch(() => '')}`);
    _spSiteId = (await r.json()).id;
  }

  // List all document libraries (drives) on the site
  const r2 = await fetch(`https://graph.microsoft.com/v1.0/sites/${_spSiteId}/drives`, {
    headers: { Authorization: `Bearer ${tokenRes.accessToken}` },
  });
  if (!r2.ok) throw new Error(`SharePoint drives lookup failed (${r2.status}): ${await r2.text().catch(() => '')}`);
  const drives = (await r2.json()).value || [];

  // Cache all drives we find so we don't have to re-list for the second library
  for (const d of drives) {
    _spDriveBases[d.name] = `https://graph.microsoft.com/v1.0/drives/${d.id}/root:`;
  }

  if (!_spDriveBases[libraryName]) {
    const names = drives.map(d => `"${d.name}"`).join(', ');
    throw new Error(`SharePoint library "${libraryName}" not found on the Intranet site. Available: ${names}`);
  }
  return _spDriveBases[libraryName];
}

async function graphFetch(spPath, opts = {}) {
  const tokenRes = await getGraphToken();
  const library  = opts.library || SP_INVOICES_LIB;
  const base     = await getSpDriveBase(library, tokenRes);
  const fetchOpts = {
    method: opts.method || 'GET',
    headers: { Authorization: `Bearer ${tokenRes.accessToken}`, ...opts.headers },
  };
  if (opts.body !== undefined) fetchOpts.body = opts.body;
  const res = await fetch(`${base}${spPath}`, fetchOpts);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Graph ${res.status}: ${body.slice(0, 300)}`);
  }
  if (opts.rawText) return res.text();
  return res.json();
}

// ─── CSV parsing ──────────────────────────────────────────────────────────────

function parseCsvLine(line) {
  const fields = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      fields.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function parseBpCsv(csvText) {
  const lines = csvText.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const hdr   = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  const cIdx  = hdr.findIndex(h => h === 'customer');
  const mIdx  = hdr.findIndex(h => h.includes('mdr'));
  const crIdx = hdr.findIndex(h => h.includes('cloud response'));
  if (cIdx < 0 || mIdx < 0 || crIdx < 0) {
    throw new Error('CSV missing expected columns (Customer, MDR Devices, Cloud Response Devices)');
  }
  return lines.slice(1).map(line => {
    const cols = parseCsvLine(line);
    const customer = cols[cIdx]?.trim() || '';
    if (!customer) return null;
    return {
      customer,
      securityPlus:  parseInt(cols[mIdx]  || '0', 10) || 0,
      cloudResponse: parseInt(cols[crIdx] || '0', 10) || 0,
    };
  }).filter(Boolean);
}

// ─── Fuzzy matching ───────────────────────────────────────────────────────────

function fuzzyMatchScore(a, b) {
  const norm = s => s.toLowerCase()
    .replace(/\b(llc|inc|corp|ltd|co\.?|company|the|group|tech|technology|technologies|solutions|services|systems|consulting|it)\b/g, ' ')
    .replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const na = norm(a), nb = norm(b);
  if (a.toLowerCase() === b.toLowerCase()) return 0.99;
  if (na === nb) return 0.97;
  if (na.startsWith(nb) || nb.startsWith(na)) return 0.90;
  if (na.includes(nb) || nb.includes(na)) return 0.82;
  const wa = new Set(na.split(' ').filter(w => w.length > 2));
  const wb = new Set(nb.split(' ').filter(w => w.length > 2));
  if (!wa.size || !wb.size) return 0;
  const overlap = [...wa].filter(w => wb.has(w)).length;
  return (overlap / Math.max(wa.size, wb.size)) * 0.75;
}

async function findAtCompanyMatch(companyName) {
  const cleaned = companyName.replace(/[^a-z0-9\s]/gi, ' ').trim();
  const words   = cleaned.split(/\s+/);
  // Strip leading digits from each word so "39North" → "North" for AT contains search
  const alphaPart = words.map(w => w.replace(/^\d+/, '')).find(w => w.length >= 4);
  const term = alphaPart || words.find(w => w.length >= 4) || cleaned.substring(0, 15);
  let companies;
  try {
    companies = await atQuery('/Companies', [
      { field: 'companyName', op: 'contains', value: term.substring(0, 15) },
      { field: 'isActive',    op: 'eq',       value: true },
    ]);
  } catch { return { best: null, candidates: [] }; }
  if (!companies || !companies.length) return { best: null, candidates: [] };
  const scored = companies
    .map(c => ({ atCompanyId: c.id, atCompanyName: c.companyName, confidence: fuzzyMatchScore(companyName, c.companyName) }))
    .sort((a, b) => b.confidence - a.confidence);
  const best = scored[0].confidence >= 0.5 ? scored[0] : null;
  return { best, candidates: scored.slice(0, 5) };
}

// ─── AT helpers ───────────────────────────────────────────────────────────────

async function bpFindContract(companyId, effectiveDate) {
  const all = await atQuery('/Contracts', [
    { field: 'companyID',    op: 'eq', value: parseInt(companyId, 10) },
    { field: 'contractName', op: 'eq', value: 'Managed Security Services' },
    { field: 'status',       op: 'eq', value: 1 },
  ]);
  const eligible = all
    .filter(c => new Date(c.startDate) <= new Date(effectiveDate))
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  return eligible[0] || null;
}

async function bpFindNextContract(companyId, excludeId, afterDate) {
  const all = await atQuery('/Contracts', [
    { field: 'companyID',    op: 'eq', value: parseInt(companyId, 10) },
    { field: 'contractName', op: 'eq', value: 'Managed Security Services' },
    { field: 'status',       op: 'eq', value: 1 },
  ]);
  return all
    .filter(c => c.id !== excludeId && new Date(c.startDate) > new Date(afterDate))
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))[0] || null;
}

async function bpFindCsSP(contractId, spServiceIds = [119, 263]) {
  for (const svcId of spServiceIds) {
    const rows = await atQuery('/ContractServices', [
      { field: 'contractID', op: 'eq', value: contractId },
      { field: 'serviceID',  op: 'eq', value: svcId },
    ]);
    if (rows.length) return rows[0];
  }
  return null;
}

async function bpFindCsDef(contractId, defServiceId = 226) {
  const rows = await atQuery('/ContractServices', [
    { field: 'contractID', op: 'eq', value: contractId },
    { field: 'serviceID',  op: 'eq', value: defServiceId },
  ]);
  return rows[0] || null;
}

// Look up a service's default unit price from the AT catalog
let _svcPriceCache = {};
async function bpGetServiceUnitPrice(serviceId) {
  if (_svcPriceCache[serviceId] != null) return _svcPriceCache[serviceId];
  try {
    const res = await atFetch(`/Services/${serviceId}`);
    const item = res.item || res;
    _svcPriceCache[serviceId] = item.unitPrice ?? 0;
  } catch {
    _svcPriceCache[serviceId] = 0;
  }
  return _svcPriceCache[serviceId];
}

// Create a ContractService line on a contract and return the new row
async function bpCreateContractService(contract, serviceId) {
  const unitPrice = await bpGetServiceUnitPrice(serviceId);
  const body = {
    contractID: contract.id,
    serviceID:  serviceId,
    startDate:  contract.startDate,
    endDate:    contract.endDate   || null,
    unitPrice:  unitPrice,
    unitCost:   0,
  };
  const result = await atFetch('/ContractServices', { method: 'POST', body: JSON.stringify(body) });
  const newId = result.itemId ?? result.item?.id ?? result.id;
  if (!newId) throw new Error('ContractService creation returned no ID');
  return { id: newId, contractID: contract.id, serviceID: serviceId };
}

async function bpGetCurrentUnits(contractServiceId) {
  const all = await atQuery('/ContractServiceUnits', [
    { field: 'contractServiceID', op: 'eq', value: contractServiceId },
  ]);
  if (!all.length) return 0;
  const now = new Date();
  const current = all
    .filter(u => new Date(u.startDate || 0) <= now)
    .sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0));
  return current.length ? (current[0].units || 0) : 0;
}

function firstOfThisMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}

function firstOfNextMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
}

// ─── SharePoint mapping store (reads/writes hub-company-mappings.json v2) ────
//
// Internal v2 format: { _version: 2, companies: [{ atId, atName, platforms: { blackpoint: {...} } }] }
// BP compatibility format (what bp-get-at-comparison needs): { mappings: { "BPName": { atCompanyId, atCompanyName, confidence } }, excluded: {...} }
//
// loadSpMappings() returns: { _version: 2, _hubRaw: <full hub>, mappings: {...}, excluded: {...} }
// saveSpMappings() accepts that same shape and writes back to the hub file.

async function loadSpMappings() {
  try {
    const hub = await loadHubDirectory();
    if (!hub) return { _version: 2, _hubRaw: null, mappings: {}, excluded: {} };

    if (hub._version < 2) return hub; // legacy flat format passthrough

    // Build BP compatibility layer from v2 hub
    const mappings = {}, excluded = {};
    for (const entry of (hub.companies || [])) {
      const bp = entry.platforms?.blackpoint;
      if (!bp?.name) continue;
      if (bp.excluded || entry.excluded) {
        excluded[bp.name] = true;
      } else {
        mappings[bp.name] = {
          atCompanyId:   entry.atId,
          atCompanyName: entry.atName || '',
          confidence:    bp.confidence || 0,
          ...(bp.confirmedAt ? { confirmedAt: bp.confirmedAt } : {}),
        };
      }
    }
    return { _version: 2, _hubRaw: hub, mappings, excluded };
  } catch (e) {
    console.warn('[Blackpoint] Hub load failed:', e.message);
    return { _version: 2, _hubRaw: null, mappings: {}, excluded: {} };
  }
}

async function saveSpMappings(data) {
  if (data._version !== 2) {
    return saveHubDirectory(data); // legacy format passthrough
  }
  if (!data._hubRaw) {
    // Hub data unavailable — load a fresh copy rather than risk corrupting the file
    const fresh = await loadHubDirectory();
    if (!fresh) return; // SP truly unreachable; skip save
    data = { ...data, _hubRaw: fresh };
  }

  // Merge BP changes back into the hub file
  const hub = JSON.parse(JSON.stringify(data._hubRaw));
  const byAtId   = new Map(hub.companies.filter(e => e.atId).map(e => [e.atId, e]));
  const byBpName = new Map();
  for (const e of hub.companies) {
    if (e.platforms?.blackpoint?.name) byBpName.set(e.platforms.blackpoint.name, e);
  }

  for (const [bpName, bpData] of Object.entries(data.mappings || {})) {
    let entry = byAtId.get(bpData.atCompanyId) || byBpName.get(bpName);
    if (!entry) {
      entry = { atId: bpData.atCompanyId, atName: bpData.atCompanyName || '', excluded: false, platforms: {} };
      hub.companies.push(entry);
      if (bpData.atCompanyId) byAtId.set(bpData.atCompanyId, entry);
    }
    if (!entry.atName && bpData.atCompanyName) entry.atName = bpData.atCompanyName;
    entry.platforms.blackpoint = {
      name:       bpName,
      confidence: bpData.confidence || 0,
      ...(bpData.confirmedAt ? { confirmedAt: bpData.confirmedAt } : {}),
    };
    delete entry.platforms.blackpoint.excluded;
    byBpName.set(bpName, entry);
  }

  for (const [bpName, excl] of Object.entries(data.excluded || {})) {
    const entry = byBpName.get(bpName);
    if (entry?.platforms?.blackpoint) {
      if (excl) entry.platforms.blackpoint.excluded = true;
      else      delete entry.platforms.blackpoint.excluded;
    }
  }

  hub._updated = new Date().toISOString();
  return saveHubDirectory(hub);
}

// ─── Push audit log ───────────────────────────────────────────────────────────

async function appendPushLog(entry) {
  try {
    let log = [];
    try {
      const meta = await graphFetch(`${SP_PUSH_LOG}:`);
      const url = meta['@microsoft.graph.downloadUrl'];
      if (url) log = JSON.parse(await spDownload(url));
    } catch (e) {
      if (!/404|itemNotFound/.test(e.message)) throw e;
    }
    log.push(entry);
    const body = Buffer.from(JSON.stringify(log, null, 2), 'utf8');
    await graphFetch(`${SP_PUSH_LOG}:/content`, {
      method:  'PUT',
      body,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  } catch (e) {
    console.warn('Push audit log write failed:', e.message);
  }
}

// ─── Blackpoint API (preserved for future use) ────────────────────────────────

async function bpFetch(bpPath, tenantId = null) {
  const apiKey = await kvGetSecret('blackpoint-api-key');
  if (!apiKey) throw new Error('Blackpoint API key not in Key Vault (blackpoint-api-key). Contact your admin.');
  const headers = { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' };
  if (tenantId) headers['x-tenant-id'] = tenantId;
  const res = await fetch(`${BP_BASE}${bpPath}`, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`BlackPoint API error (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ─── Module export ────────────────────────────────────────────────────────────

module.exports = function registerBlackpoint(ipcMain) {

  // List SharePoint year folders and CSV files in one call
  ipcMain.handle('bp-list-sp-files', async () => {
    const yearsData = await graphFetch(`${SP_INVOICES}:/children`);
    const years = (yearsData.value || [])
      .filter(i => i.folder)
      .map(i => i.name)
      .sort((a, b) => b.localeCompare(a));

    const allFiles = [];
    await Promise.all(years.map(async year => {
      try {
        const fd = await graphFetch(`${SP_INVOICES}/${encodeURIComponent(year)}:/children`);
        const csvs = (fd.value || [])
          .filter(f => f.file && f.name.toLowerCase().endsWith('.csv'))
          .map(f => ({ name: f.name, year }));
        allFiles.push(...csvs);
      } catch {}
    }));

    return { years, files: allFiles };
  });

  // Download and parse a CSV from SharePoint
  ipcMain.handle('bp-load-sp-csv', async (_, { year, fileName }) => {
    // Get file metadata to retrieve the pre-authenticated download URL.
    // Fetching :/content directly causes ECONNRESET because node-fetch forwards
    // the Authorization header across the Graph→SharePoint redirect boundary.
    const meta = await graphFetch(
      `${SP_INVOICES}/${encodeURIComponent(year)}/${encodeURIComponent(fileName)}:`
    );
    const downloadUrl = meta['@microsoft.graph.downloadUrl'];
    if (!downloadUrl) throw new Error('No download URL returned for file — check permissions');
    const csvText = await spDownload(downloadUrl);
    const rows = parseBpCsv(csvText);
    return { rows, fileName, loadedAt: new Date().toISOString() };
  });

  // Load company mappings from SharePoint — returns { mappings, excluded } shape for UI
  ipcMain.handle('bp-load-company-mappings', async () => {
    const data = await loadSpMappings();
    // Strip _hubRaw (large) before sending to renderer
    const { _hubRaw: _h, ...safe } = data;
    return safe;
  });

  // Compare CSV rows against Autotask contract units.
  // Bulk-loads all AT data in ~4 queries (or reuses 30-min cache) then processes rows in memory.
  // Pass force:true to bypass cache (used by "Load & Compare"); force:false uses cache (used by retry/re-run).
  ipcMain.handle('bp-get-at-comparison', async (_, { rows, force }) => {
    const spData   = await loadSpMappings();
    const mappings = spData.mappings || {};
    const excluded = spData.excluded || {};
    const bpSvcMaps = getServiceMappings(spData._hubRaw, 'blackpoint');
    const spEntry   = bpSvcMaps.find(m => m.id === 'sp' || m.id === 'sp-primary');
    const spSvcIds  = spEntry ? getSvcAtServiceIds(spEntry)
                     : bpSvcMaps.filter(m => m.id === 'sp-alt').flatMap(m => getSvcAtServiceIds(m));
    const defEntry  = bpSvcMaps.find(m => m.id === '365-defense');
    const defSvcId  = defEntry ? (getSvcAtServiceIds(defEntry)[0] ?? 226) : 226;
    const today    = new Date().toISOString();

    let bulk = force ? null : getBulkCache();

    if (!bulk) {
      // ── 1. All active AT companies (one query, for in-memory fuzzy matching)
      const atCompanies = await atQuery('/Companies', [
        { field: 'isActive', op: 'eq', value: true },
      ]);

      // ── 2. All "Managed Security Services" contracts (one query)
      const allContracts = await atQuery('/Contracts', [
        { field: 'contractName', op: 'eq', value: 'Managed Security Services' },
        { field: 'status',       op: 'eq', value: 1 },
      ]);
      const contractsByCompany = {};
      for (const c of allContracts) {
        if (!contractsByCompany[c.companyID]) contractsByCompany[c.companyID] = [];
        contractsByCompany[c.companyID].push(c);
      }
      for (const arr of Object.values(contractsByCompany)) {
        arr.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
      }

      // ── 3. All ContractServices for those contracts (batched by 200 IDs)
      const allCsRows = [];
      const contractIds = allContracts.map(c => c.id);
      for (let i = 0; i < contractIds.length; i += 200) {
        try {
          const svcs = await atQuery('/ContractServices', [
            { field: 'contractID', op: 'in', value: contractIds.slice(i, i + 200) },
          ]);
          allCsRows.push(...svcs);
        } catch {}
      }
      // contractID → { sp: row|null, def: row|null }
      const servicesByContract = {};
      for (const s of allCsRows) {
        if (!servicesByContract[s.contractID]) servicesByContract[s.contractID] = {};
        if (spSvcIds.includes(s.serviceID) && !servicesByContract[s.contractID].sp)
          servicesByContract[s.contractID].sp = s;
        else if (s.serviceID === defSvcId && !servicesByContract[s.contractID].def)
          servicesByContract[s.contractID].def = s;
      }

      // Detect which Security+ service ID (119 vs 263) is more common across existing contracts
      let count0 = 0, count1 = 0;
      for (const s of allCsRows) {
        if (spSvcIds[0] && s.serviceID === spSvcIds[0]) count0++;
        else if (spSvcIds[1] && s.serviceID === spSvcIds[1]) count1++;
      }
      _preferredSpServiceId = (spSvcIds[1] && count1 > count0) ? spSvcIds[1] : (spSvcIds[0] ?? 119);

      // ── 4. All ContractServiceUnits for those services (batched by 200 IDs)
      const allUnits = [];
      const svcIds = allCsRows.map(s => s.id);
      for (let i = 0; i < svcIds.length; i += 200) {
        try {
          const units = await atQuery('/ContractServiceUnits', [
            { field: 'contractServiceID', op: 'in', value: svcIds.slice(i, i + 200) },
          ]);
          allUnits.push(...units);
        } catch {}
      }
      // contractServiceID → most-recent units value with startDate ≤ today
      const nowTs = Date.now();
      const unitsByService = {};
      for (const u of allUnits) {
        if (new Date(u.startDate || 0).getTime() > nowTs) continue; // skip future records
        const ex = unitsByService[u.contractServiceID];
        if (!ex || new Date(u.startDate || 0) > new Date(ex.startDate || 0))
          unitsByService[u.contractServiceID] = u;
      }

      bulk = { atCompanies, contractsByCompany, servicesByContract, unitsByService };
      setBulkCache(bulk);
    }

    const { atCompanies, contractsByCompany, servicesByContract, unitsByService } = bulk;

    // ── Process rows in memory (no further AT calls) ──────────────────────────
    const results        = [];
    const newAutoMatches = {};
    const effectiveDate  = firstOfThisMonth();

    for (const row of rows) {
      const included365D = Math.floor(row.securityPlus * 1.3);
      const billable365D = Math.max(0, row.cloudResponse - included365D);

      if (excluded[row.customer]) {
        results.push({ customer: row.customer, securityPlus: row.securityPlus, cloudResponse: row.cloudResponse,
          included365D, billable365D, matchStatus: 'excluded',
          atCompanyId: null, atCompanyName: null, confidence: null, candidates: [],
          atSP: null, atDef: null, spDelta: null, defDelta: null });
        continue;
      }

      let atCompanyId = null, atCompanyName = null, confidence = null,
          matchStatus = 'unmatched', candidates = [];

      const cached = mappings[row.customer];
      if (cached) {
        atCompanyId   = cached.atCompanyId;
        atCompanyName = cached.atCompanyName;
        confidence    = cached.confidence || 1.0;
        matchStatus   = confidence >= 0.85 ? 'matched' : 'low_confidence';
      } else {
        const scored = atCompanies
          .filter(c => c.id !== ANS_AT_ID)
          .map(c => ({ atCompanyId: c.id, atCompanyName: c.companyName, confidence: fuzzyMatchScore(row.customer, c.companyName) }))
          .sort((a, b) => b.confidence - a.confidence);
        candidates = scored.slice(0, 5).filter(c => c.confidence >= 0.3);
        const best = scored[0];
        if (best && best.confidence >= 0.85) {
          ({ atCompanyId, atCompanyName, confidence } = best);
          matchStatus = 'auto_match';
          newAutoMatches[row.customer] = { atCompanyId, atCompanyName, confidence };
        } else if (best && best.confidence >= 0.3) {
          ({ atCompanyId, atCompanyName, confidence } = best);
          matchStatus = 'low_confidence';
        }
      }

      if (atCompanyId === ANS_AT_ID) {
        results.push({ customer: row.customer, securityPlus: row.securityPlus, cloudResponse: row.cloudResponse,
          included365D, billable365D, matchStatus: 'skipped', atCompanyId, atCompanyName, confidence, candidates,
          atSP: null, atDef: null, spDelta: null, defDelta: null });
        continue;
      }

      if (!atCompanyId || matchStatus === 'low_confidence') {
        results.push({ customer: row.customer, securityPlus: row.securityPlus, cloudResponse: row.cloudResponse,
          included365D, billable365D, matchStatus, atCompanyId, atCompanyName, confidence, candidates,
          atSP: null, atDef: null, spDelta: null, defDelta: null });
        continue;
      }

      let atSP = null, atDef = null, spDelta = null, defDelta = null, atError = null;
      try {
        const contracts = contractsByCompany[atCompanyId] || [];
        const contract  = contracts.find(c => new Date(c.startDate) <= new Date(effectiveDate)) || contracts[0];
        if (contract) {
          const svcs = servicesByContract[contract.id] || {};
          atSP  = svcs.sp  ? (unitsByService[svcs.sp.id]?.units  ?? 0) : null;
          atDef = svcs.def ? (unitsByService[svcs.def.id]?.units ?? 0) : null;
          if (atSP  != null) spDelta  = row.securityPlus - atSP;
          if (atDef != null) defDelta = billable365D - atDef;
        }
      } catch (e) {
        atError = e.message;
      }

      results.push({ customer: row.customer, securityPlus: row.securityPlus, cloudResponse: row.cloudResponse,
        included365D, billable365D, matchStatus, atCompanyId, atCompanyName, confidence, candidates,
        atSP, atDef, spDelta, defDelta, atError });
    }

    if (Object.keys(newAutoMatches).length) {
      Object.assign(spData.mappings, newAutoMatches);
      spData._updated = today;
      await saveSpMappings(spData).catch(() => {});
    }

    return { rows: results };
  });

  // Confirm a manual company match — store in SP JSON
  ipcMain.handle('bp-confirm-company-match', async (_, { customer, atCompanyId, atCompanyName }) => {
    const spData = await loadSpMappings();
    spData.mappings = spData.mappings || {};
    spData.mappings[customer] = {
      atCompanyId,
      atCompanyName,
      confidence:  1.0,
      confirmedAt: new Date().toISOString(),
    };
    spData._updated = new Date().toISOString();
    await saveSpMappings(spData);
    return { ok: true };
  });

  // Exclude / un-exclude a Blackpoint company from billing
  ipcMain.handle('bp-set-excluded', async (_, { customer, excluded }) => {
    const spData = await loadSpMappings();
    spData.excluded = spData.excluded || {};
    if (excluded) {
      spData.excluded[customer] = true;
    } else {
      delete spData.excluded[customer];
    }
    spData._updated = new Date().toISOString();
    await saveSpMappings(spData);
    return { ok: true };
  });

  // Search AT companies for the match modal
  ipcMain.handle('bp-search-at-companies', async (_, { query }) => {
    if (!query || query.trim().length < 3) return [];
    const companies = await atQuery('/Companies', [
      { field: 'companyName', op: 'contains', value: query.trim().substring(0, 20) },
      { field: 'isActive',    op: 'eq',       value: true },
    ]);
    return companies.slice(0, 15).map(c => ({ atCompanyId: c.id, atCompanyName: c.companyName }));
  });

  // Push unit changes to Autotask ContractServiceAdjustments
  ipcMain.handle('bp-push', async (_, { rows, serviceType }) => {
    const mainWindow = getMainWindow();
    const emit = (company, status, detail = '') => {
      if (mainWindow) mainWindow.webContents.send('bp-push-progress', { company, status, detail });
    };

    const hub = await loadHubDirectory();
    const bpMaps = getServiceMappings(hub, 'blackpoint');
    const spEntry2     = bpMaps.find(m => m.id === 'sp' || m.id === 'sp-primary');
    const spServiceIds = spEntry2 ? getSvcAtServiceIds(spEntry2)
                         : bpMaps.filter(m => m.id === 'sp-alt').flatMap(m => getSvcAtServiceIds(m));
    const defEntry2    = bpMaps.find(m => m.id === '365-defense');
    const defServiceId = defEntry2 ? (getSvcAtServiceIds(defEntry2)[0] ?? 226) : 226;
    const preferredSpId = spServiceIds[0] ?? _preferredSpServiceId;

    const isSP    = serviceType === 'security_plus';
    const results = [];

    for (const row of rows) {
      if (!row.atCompanyId || row.atCompanyId === ANS_AT_ID) continue;
      const bpQty = isSP ? row.securityPlus : row.billable365D;
      emit(row.customer, 'working');
      try {
        const today    = new Date().toISOString();
        const contract = await bpFindContract(row.atCompanyId, today);
        if (!contract) {
          emit(row.customer, 'no_contract', 'No "Managed Security Services" contract');
          results.push({ company: row.customer, status: 'no_contract' });
          continue;
        }

        let cs = isSP ? await bpFindCsSP(contract.id, spServiceIds) : await bpFindCsDef(contract.id, defServiceId);
        if (!cs) {
          // Service line doesn't exist — create it from the catalog price
          const serviceId = isSP ? preferredSpId : defServiceId;
          try {
            cs = await bpCreateContractService(contract, serviceId);
            emit(row.customer, 'working', `Created ${isSP ? 'Security+' : '365 Defense'} service line on contract`);
          } catch (e) {
            emit(row.customer, 'no_service', `Could not create service line: ${e.message}`);
            results.push({ company: row.customer, status: 'no_service' });
            continue;
          }
        }

        const currentQty = await bpGetCurrentUnits(cs.id);
        const unitChange = bpQty - currentQty;
        if (unitChange === 0) {
          emit(row.customer, 'no_change', `Already at ${currentQty}`);
          results.push({ company: row.customer, status: 'no_change', qty: bpQty });
          continue;
        }

        const effectiveDate = unitChange > 0 ? firstOfThisMonth() : firstOfNextMonth();
        const payload = { contractID: contract.id, contractServiceID: cs.id, effectiveDate, unitChange };

        try {
          await atFetch('/ContractServiceAdjustments', { method: 'POST', body: JSON.stringify(payload) });
          emit(row.customer, 'success', `${unitChange > 0 ? '+' : ''}${unitChange} (${currentQty}→${bpQty})`);
          results.push({ company: row.customer, status: 'success', unitChange, previousQty: currentQty, newQty: bpQty });
        } catch (e) {
          const msg = e.message.toLowerCase();
          if (msg.includes('effectivedate must be between') || msg.includes('effective date must be between')) {
            const next = await bpFindNextContract(row.atCompanyId, contract.id, today);
            if (!next) throw new Error('Contract rollover: no next contract found');
            const nextCs = isSP ? await bpFindCsSP(next.id, spServiceIds) : await bpFindCsDef(next.id, defServiceId);
            if (!nextCs) throw new Error('Contract rollover: service line not on next contract');
            await atFetch('/ContractServiceAdjustments', {
              method: 'POST',
              body: JSON.stringify({ ...payload, contractID: next.id, contractServiceID: nextCs.id }),
            });
            emit(row.customer, 'success', `Rolled to next contract · ${unitChange > 0 ? '+' : ''}${unitChange} (${currentQty}→${bpQty})`);
            results.push({ company: row.customer, status: 'success', unitChange, previousQty: currentQty, newQty: bpQty, rolled: true });
          } else if (msg.includes('negative')) {
            emit(row.customer, 'negative_qty', `Would go negative — skipped (current: ${currentQty}, change: ${unitChange})`);
            results.push({ company: row.customer, status: 'negative_qty', currentQty, unitChange });
          } else {
            throw e;
          }
        }
      } catch (e) {
        emit(row.customer, 'error', e.message);
        results.push({ company: row.customer, status: 'error', error: e.message });
      }
    }

    const summary = {
      updated: results.filter(r => r.status === 'success').length,
      skipped: results.filter(r => ['no_change', 'no_contract', 'no_service', 'negative_qty'].includes(r.status)).length,
      errors:  results.filter(r => r.status === 'error').length,
    };

    // Write audit log to SharePoint (non-blocking — don't delay push result on log failure)
    const { msalApp } = require('../shared/msal');
    let pushedBy = 'unknown';
    try {
      const accounts = await msalApp.getAllAccounts();
      pushedBy = accounts[0]?.username || 'unknown';
    } catch {}
    appendPushLog({ date: new Date().toISOString(), user: pushedBy, serviceType, results, summary }).catch(() => {});

    return { results, summary };
  });

  // Export comparison table to Excel
  ipcMain.handle('bp-export-comparison', async (_, { rows }) => {
    try {
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Anchor Hub'; wb.created = new Date();
      const ws = wb.addWorksheet('BP vs AT Comparison');
      const H_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      const H_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
      const BORDER = { style: 'thin', color: { argb: 'FFE2E8F0' } };
      const ALL_B  = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
      ws.columns = [
        { header: 'Company (Blackpoint)',  key: 'customer',  width: 36 },
        { header: 'Company (AT)',          key: 'atName',    width: 36 },
        { header: 'Match Status',          key: 'match',     width: 16 },
        { header: 'MDR Devices',           key: 'bpSP',      width: 14 },
        { header: 'Billed Security+',      key: 'atSP',      width: 16 },
        { header: 'Security+ Change',      key: 'spDelta',   width: 16 },
        { header: 'CR Included',           key: 'incl365',   width: 14 },
        { header: 'CR Used',               key: 'cr',        width: 12 },
        { header: 'CR Billable',           key: 'bill365',   width: 14 },
        { header: 'Billed 365 Defense',    key: 'atDef',     width: 18 },
        { header: '365D Change',           key: 'defDelta',  width: 14 },
      ];
      ws.getRow(1).eachCell(c => {
        c.fill = H_FILL; c.font = H_FONT; c.border = ALL_B;
        c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });
      ws.getRow(1).height = 28;
      (rows || []).forEach((r, i) => {
        const spD  = r.spDelta  != null ? (r.spDelta  > 0 ? `+${r.spDelta}`  : String(r.spDelta))  : '—';
        const defD = r.defDelta != null ? (r.defDelta > 0 ? `+${r.defDelta}` : String(r.defDelta)) : '—';
        const row = ws.addRow({
          customer: r.customer,
          atName:   r.atCompanyName || '—',
          match:    r.matchStatus,
          bpSP:     r.securityPlus,
          atSP:     r.atSP   != null ? r.atSP   : '—',
          spDelta:  spD,
          incl365:  r.included365D,
          cr:       r.cloudResponse,
          bill365:  r.billable365D,
          atDef:    r.atDef  != null ? r.atDef  : '—',
          defDelta: defD,
        });
        if (i % 2 === 1) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
        if (r.spDelta > 0)  row.getCell('spDelta').fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE5D0' } };
        if (r.spDelta < 0)  row.getCell('spDelta').fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0E8FF' } };
        if (r.defDelta > 0) row.getCell('defDelta').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE5D0' } };
        if (r.defDelta < 0) row.getCell('defDelta').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0E8FF' } };
        row.eachCell(c => { c.border = ALL_B; c.alignment = { vertical: 'middle' }; });
        row.height = 18;
      });
      const filePath = path.join(app.getPath('downloads'), `blackpoint-comparison-${new Date().toISOString().slice(0, 10)}.xlsx`);
      await wb.xlsx.writeFile(filePath);
      shell.showItemInFolder(filePath);
      return { ok: true, filePath };
    } catch (e) {
      return { error: e.message };
    }
  });

  // ── Endpoint Usage (Blackpoint API — preserved for future use) ───────────────

  ipcMain.handle('run-blackpoint-usage', async () => {
    const tenants = [];
    let page = 1;
    while (true) {
      const r = await bpFetch(`/v1/tenants?pageSize=50&page=${page}`);
      const batch = r.data || [];
      tenants.push(...batch);
      const meta = r.meta || {};
      const totalPages = meta.totalPages || meta.pageCount || 1;
      if (page >= totalPages || batch.length === 0) break;
      page++;
    }

    const BATCH = 8;
    const sleep = ms => new Promise(res => setTimeout(res, ms));
    for (let i = 0; i < tenants.length; i += BATCH) {
      await Promise.all(tenants.slice(i, i + BATCH).map(async t => {
        try {
          let activeAgents = 0, totalDevices = 0, devPage = 1;
          while (true) {
            const r = await bpFetch(`/v1/assets?class=DEVICE&pageSize=200&page=${devPage}`, t.id);
            const devices = r.data || [];
            totalDevices += devices.length;
            activeAgents += devices.filter(d => !d.agentDeactivated).length;
            const meta = r.meta || {};
            if (devPage >= (meta.totalPages || meta.pageCount || 1) || devices.length === 0) break;
            devPage++;
          }
          t.activeAgents = activeAgents;
          t.totalDevices = totalDevices;
        } catch (e) {
          t.activeAgents = null; t.totalDevices = null; t.fetchError = e.message;
        }
      }));
      if (i + BATCH < tenants.length) await sleep(150);
    }

    let prevSnapshot = {};
    if (fs.existsSync(BP_SNAPSHOT_FILE)) {
      try { prevSnapshot = JSON.parse(fs.readFileSync(BP_SNAPSHOT_FILE, 'utf8')); } catch {}
    }
    const prevDate = prevSnapshot._date || null;

    const result = tenants
      .map(t => ({
        id: t.id, name: t.name || t.displayName || 'Unknown',
        activeAgents: t.activeAgents, totalDevices: t.totalDevices,
        prevActiveAgents: prevSnapshot[t.id] != null ? prevSnapshot[t.id].activeAgents : null,
        delta: (t.activeAgents != null && prevSnapshot[t.id] != null) ? t.activeAgents - prevSnapshot[t.id].activeAgents : null,
        error: t.fetchError || null,
      }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const newSnapshot = { _date: new Date().toISOString() };
    tenants.forEach(t => {
      if (t.activeAgents != null) newSnapshot[t.id] = { activeAgents: t.activeAgents, name: t.name };
    });
    fs.writeFileSync(BP_SNAPSHOT_FILE, JSON.stringify(newSnapshot, null, 2));

    return {
      tenants:      result,
      prevDate,
      runDate:      newSnapshot._date,
      totalTenants: result.length,
      totalActive:  result.reduce((s, t) => s + (t.activeAgents || 0), 0),
    };
  });

  ipcMain.handle('export-blackpoint-report', async (_, data) => {
    try {
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Anchor Hub'; wb.created = new Date();
      const ws = wb.addWorksheet('Endpoint Usage');
      const H_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0641C' } };
      const H_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
      const BORDER = { style: 'thin', color: { argb: 'FFE2E8F0' } };
      const ALL_B  = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
      ws.columns = [
        { header: 'Company',        key: 'name',   width: 38 },
        { header: 'Active Agents',  key: 'active', width: 16 },
        { header: 'Previous Count', key: 'prev',   width: 16 },
        { header: 'Change',         key: 'delta',  width: 12 },
        { header: '% Change',       key: 'pct',    width: 12 },
        { header: 'Status',         key: 'status', width: 18 },
      ];
      ws.getRow(1).eachCell(c => { c.fill = H_FILL; c.font = H_FONT; c.border = ALL_B; c.alignment = { vertical: 'middle', horizontal: 'center' }; });
      ws.getRow(1).height = 22;
      (data.tenants || []).forEach((t, i) => {
        const prev = t.prevActiveAgents, delta = t.delta;
        const pct        = delta != null && prev != null && prev > 0 ? ((delta / prev) * 100).toFixed(1) + '%' : '—';
        const statusText = t.error ? 'Error' : delta == null ? 'New Client' : delta > 0 ? 'Increased' : delta < 0 ? 'Decreased' : 'No Change';
        const deltaStr   = delta == null ? 'New' : delta > 0 ? `+${delta}` : delta === 0 ? '0' : `${delta}`;
        const row = ws.addRow({ name: t.name, active: t.activeAgents ?? 'Error', prev: prev != null ? prev : '—', delta: deltaStr, pct, status: statusText });
        if (i % 2 === 1) row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; });
        const statusFg = delta == null ? 'FFFFF3CD' : delta > 0 ? 'FFFFE5D0' : delta < 0 ? 'FFD0E8FF' : 'FFF0F0F0';
        row.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusFg } };
        row.eachCell(c => { c.border = ALL_B; c.alignment = { vertical: 'middle' }; });
        row.height = 18;
      });
      ws.addRow({});
      const totRow = ws.addRow({ name: 'TOTAL ACTIVE AGENTS', active: data.totalActive || '' });
      totRow.getCell('name').font = { bold: true }; totRow.getCell('active').font = { bold: true };
      const filePath = path.join(app.getPath('downloads'), `blackpoint-endpoint-${new Date().toISOString().slice(0, 10)}.xlsx`);
      await wb.xlsx.writeFile(filePath);
      shell.showItemInFolder(filePath);
      return { ok: true, filePath };
    } catch (e) {
      return { error: e.message };
    }
  });
};
