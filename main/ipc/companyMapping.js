const fs   = require('fs');
const path = require('path');
const { dialog, shell } = require('electron');
const { USER_DATA, getMainWindow, loadMappings, saveMappingsFile } = require('../shared/state');
const { loadHubDirectory, saveHubDirectory, ensureServiceMappings, DEFAULT_SERVICE_MAPPINGS } = require('../shared/hubDirectory');
const { getPax8Token, pax8Paginate, resolveProductDetails } = require('../shared/pax8');
const { atFetch, atQuery } = require('../shared/at');
const { parseCSVLine, mkProductKey, termLabel } = require('../shared/csvMappings');

async function loadSpMappings() {
  return loadHubDirectory().catch(e => {
    console.warn('[CompanyMapping] SP load failed, falling back to local:', e.message);
    return null;
  });
}

async function saveSpMappings(data) {
  return saveHubDirectory(data);
}

// Load from SP first, fall back to local file. Updates local cache on SP hit.
async function loadMappingsCentral() {
  const spData = await loadSpMappings();
  if (spData) {
    saveMappingsFile(spData);
    return { ...spData, _storageSource: 'sharepoint' };
  }
  return { ...loadMappings(), _storageSource: 'local' };
}

// Save to SP (primary) and local file (backup).
async function saveMappingsCentral(data) {
  const { _storageSource: _s, ...clean } = data;
  await saveSpMappings(clean);
  saveMappingsFile(clean);
}

// ─── v2 format helpers ─────────────────────────────────────────────────────────

// Expand AT-centric v2 companies array into flat rows (one per Pax8 entry).
// The flat format is what the UI consumes.
function v2ToFlat(companies) {
  const flat = [];
  for (const entry of (companies || [])) {
    const pax8All = Array.isArray(entry.platforms?.pax8) ? entry.platforms.pax8
                  : entry.platforms?.pax8 ? [entry.platforms.pax8] : [];
    // Only count entries with real Pax8 IDs (empty IDs come from a corrupt migration run)
    const validPax8 = pax8All.filter(p => p.id);

    if (validPax8.length === 0) {
      // No valid Pax8 entries — AT/BP-only entry; skip for the Company Directory UI.
      // These are visible only after a sync re-populates platforms.pax8 from the API.
      continue;
    }
    for (const p of validPax8) {
      flat.push({
        pax8Id:     p.id,
        pax8Name:   p.name || '',
        atId:       entry.atId || null,
        atName:     entry.atName || '',
        confidence: p.confidence || 'low',
        source:     p.source || 'none',
        accepted:   !!entry.atId && !entry.excluded && p.confidence !== 'unmatched',
        excluded:   entry.excluded || false,
      });
    }
  }
  return flat;
}

// Find the v2 entry + pax8 sub-entry that has the given pax8Id.
function findByPax8Id(companies, pax8Id) {
  for (const entry of (companies || [])) {
    const pax8List = Array.isArray(entry.platforms?.pax8) ? entry.platforms.pax8
                   : entry.platforms?.pax8 ? [entry.platforms.pax8] : [];
    const idx = pax8List.findIndex(p => p.id === pax8Id);
    if (idx >= 0) return { entry, pax8List, idx };
  }
  return null;
}

// Ensure data is in v2 format; if it's an old flat format, return as-is (no conversion).
function isV2(data) { return data && data._version >= 2; } // v2 = AT-centric; v3 = AT-centric + serviceMappings

// ─── Name normalisation ───────────────────────────────────────────────────────
const normName = s => (s || '').toLowerCase()
  .replace(/\binc\.?\b|\bllc\.?\b|\bltd\.?\b|\bcorp\.?\b|\bco\.?\b/g, '')
  .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

let _lastMappingSyncResult = null;

module.exports = function registerCompanyMapping(ipcMain) {

  // ── Full sync from Pax8 + Autotask ─────────────────────────────────────────
  ipcMain.handle('run-company-mapping-sync', async () => {
    const send = (msg, type = 'info') => getMainWindow().webContents.send('mapping-log', { msg, type });

    try {
      send('Authenticating with Pax8...');
      const token = await getPax8Token();
      send('✓ Pax8 token obtained', 'success');

      send('Fetching Pax8 companies...');
      const pax8Companies = await pax8Paginate(token, '/companies');
      send(`✓ ${pax8Companies.length} Pax8 companies`, 'success');

      send('Fetching Autotask companies...');
      let atCompanies = [];
      try {
        atCompanies = await atQuery('/Companies', []);
        send(`✓ ${atCompanies.length} Autotask companies`, 'success');
      } catch (e) { send(`⚠ AT companies unavailable: ${e.message}`, 'warn'); }

      const atCById   = new Map(atCompanies.map(c => [c.id, c]));
      const atCByNorm = new Map();
      for (const c of atCompanies) {
        const n = normName(c.companyName || c.name || '');
        if (n && !atCByNorm.has(n)) atCByNorm.set(n, c);
      }

      // Load existing data — preserve BP mappings and manual AT assignments
      send('Loading existing mappings...');
      const existing   = await loadMappingsCentral();
      const prevByAtId = new Map();
      const prevByPax8 = new Map();

      if (isV2(existing)) {
        for (const entry of (existing.companies || [])) {
          if (entry.atId) prevByAtId.set(entry.atId, entry);
          const pax8List = Array.isArray(entry.platforms?.pax8) ? entry.platforms.pax8 : [];
          for (const p of pax8List) { if (p.id) prevByPax8.set(p.id, entry); }
        }
      } else {
        // Old flat format in local cache — convert to rough prev lookup
        for (const c of (existing.companies || [])) {
          if (c.pax8Id) prevByPax8.set(c.pax8Id, { atId: c.atId, atName: c.atName,
            excluded: c.excluded, platforms: { pax8: [{ id: c.pax8Id, name: c.pax8Name,
              confidence: c.confidence, source: c.source }] } });
        }
      }

      // ── Build AT-centric map ───────────────────────────────────────────────
      const byAtId  = new Map();
      const unmatched = [];
      let coHigh = 0, coLow = 0, coNone = 0;

      for (const co of pax8Companies) {
        const prevEntry = prevByPax8.get(co.id);

        // Preserve manually confirmed matches
        if (prevEntry?.platforms?.pax8) {
          const prevPax8 = (Array.isArray(prevEntry.platforms.pax8) ? prevEntry.platforms.pax8 : [prevEntry.platforms.pax8])
            .find(p => p.id === co.id);
          if (prevPax8?.source === 'manual' && prevEntry.atId) {
            const entry = byAtId.get(prevEntry.atId) || (() => {
              const e = { atId: prevEntry.atId, atName: prevEntry.atName, excluded: prevEntry.excluded || false, platforms: {} };
              if (prevEntry.platforms?.blackpoint) e.platforms.blackpoint = prevEntry.platforms.blackpoint;
              if (prevEntry.platforms?.kaseya)     e.platforms.kaseya     = prevEntry.platforms.kaseya;
              byAtId.set(prevEntry.atId, e);
              return e;
            })();
            if (!entry.platforms.pax8) entry.platforms.pax8 = [];
            if (!entry.platforms.pax8.find(p => p.id === co.id))
              entry.platforms.pax8.push({ id: co.id, name: co.name || '', confidence: 'manual', source: 'manual' });
            coHigh++;
            continue;
          }
        }

        const rawId   = co.externalId ?? co.psaId ?? co.psaCompanyId ?? co.crmId
                        ?? co.psa?.companyId ?? co.provisioningId ?? null;
        const atIdNum = rawId != null ? parseInt(String(rawId), 10) || null : null;

        if (atIdNum && atIdNum > 0) {
          const atCo    = atCById.get(atIdNum);
          const prev    = prevByAtId.get(atIdNum);
          const entry   = byAtId.get(atIdNum) || (() => {
            const e = {
              atId: atIdNum,
              atName: atCo?.companyName || atCo?.name || prev?.atName || '',
              excluded: prev?.excluded ?? false,
              platforms: {},
            };
            if (prev?.platforms?.blackpoint) e.platforms.blackpoint = prev.platforms.blackpoint;
            if (prev?.platforms?.kaseya)     e.platforms.kaseya     = prev.platforms.kaseya;
            byAtId.set(atIdNum, e);
            return e;
          })();
          if (!entry.platforms.pax8) entry.platforms.pax8 = [];
          if (!entry.platforms.pax8.find(p => p.id === co.id))
            entry.platforms.pax8.push({ id: co.id, name: co.name || '', confidence: 'high', source: 'pax8_api' });
          coHigh++;
        } else {
          const norm    = normName(co.name || '');
          const matched = norm ? atCByNorm.get(norm) : null;
          if (matched) {
            const prev  = prevByAtId.get(matched.id);
            const entry = byAtId.get(matched.id) || (() => {
              const e = {
                atId: matched.id,
                atName: matched.companyName || matched.name || '',
                excluded: prev?.excluded ?? false,
                platforms: {},
              };
              if (prev?.platforms?.blackpoint) e.platforms.blackpoint = prev.platforms.blackpoint;
              if (prev?.platforms?.kaseya)     e.platforms.kaseya     = prev.platforms.kaseya;
              byAtId.set(matched.id, e);
              return e;
            })();
            if (!entry.platforms.pax8) entry.platforms.pax8 = [];
            if (!entry.platforms.pax8.find(p => p.id === co.id))
              entry.platforms.pax8.push({ id: co.id, name: co.name || '', confidence: 'low', source: 'name_match' });
            coLow++;
          } else {
            const prev    = prevEntry;
            const prevPax8 = prev ? (Array.isArray(prev.platforms?.pax8) ? prev.platforms.pax8 : []).find(p => p.id === co.id) : null;
            if (prevPax8?.source === 'manual' && prev?.atId) {
              // Previously manually matched
              const entry = byAtId.get(prev.atId) || (() => {
                const e = { atId: prev.atId, atName: prev.atName || '', excluded: prev.excluded || false, platforms: {} };
                if (prev.platforms?.blackpoint) e.platforms.blackpoint = prev.platforms.blackpoint;
                if (prev.platforms?.kaseya)     e.platforms.kaseya     = prev.platforms.kaseya;
                byAtId.set(prev.atId, e);
                return e;
              })();
              if (!entry.platforms.pax8) entry.platforms.pax8 = [];
              if (!entry.platforms.pax8.find(p => p.id === co.id))
                entry.platforms.pax8.push({ id: co.id, name: co.name || '', confidence: 'manual', source: 'manual' });
              coHigh++;
            } else {
              unmatched.push({
                atId: null, atName: null,
                excluded: prev?.excluded ?? false,
                platforms: { pax8: [{ id: co.id, name: co.name || '', confidence: 'unmatched', source: 'none' }] },
              });
              coNone++;
            }
          }
        }
      }

      // Preserve AT-centric entries (Kaseya, Blackpoint) that have no Pax8 match
      if (isV2(existing)) {
        for (const entry of (existing.companies || [])) {
          if (!entry.atId) continue;
          if (!byAtId.has(entry.atId) && (entry.platforms?.blackpoint || entry.platforms?.kaseya)) {
            byAtId.set(entry.atId, { ...entry, platforms: { ...entry.platforms, pax8: entry.platforms.pax8 || [] } });
          }
        }
      }

      send(`Companies: ${coHigh} auto-mapped, ${coLow} name-matched, ${coNone} unmatched`, coLow + coNone ? 'warn' : 'success');

      // ── Services (unchanged logic) ─────────────────────────────────────────
      send('Fetching Pax8 active subscriptions...');
      const allSubs = await pax8Paginate(token, '/subscriptions?status=Active');
      send(`✓ ${allSubs.length} active subscriptions`, 'success');

      const productMap = new Map();
      for (const sub of allSubs) {
        const pid = sub.productId || sub.product?.id;
        if (!pid) continue;
        const key = mkProductKey(sub);
        if (productMap.has(key)) continue;
        const rawSvcId = sub.externalId ?? sub.psaServiceId ?? sub.psaSubscriptionId
                         ?? sub.provisioningId ?? sub.externalServiceId ?? null;
        const svcId = rawSvcId != null ? parseInt(String(rawSvcId), 10) || null : null;
        const tLabel = termLabel(sub);
        productMap.set(key, { key, productId: pid, name: sub.productName || sub.product?.name || null, vendorName: null, vendorSku: null, termLabel: tLabel, svcId });
      }
      for (const [, p] of productMap) {
        const details = await resolveProductDetails(token, p.productId);
        if (!p.name)       p.name       = details.name;
        if (!p.vendorName) p.vendorName = details.vendorName;
        if (!p.vendorSku)  p.vendorSku  = details.vendorSku;
      }

      send('Fetching Autotask services...');
      let atServices = [];
      try {
        atServices = await atQuery('/Services', []);
        send(`✓ ${atServices.length} Autotask services`, 'success');
      } catch (e) { send(`⚠ AT services unavailable: ${e.message}`, 'warn'); }

      const atSById   = new Map(atServices.map(s => [s.id, s]));
      const atSByNorm = new Map();
      for (const s of atServices) {
        const n = normName(s.name || '');
        if (n && !atSByNorm.has(n)) atSByNorm.set(n, s);
      }

      const prevSvcByPax8 = new Map((existing.services || []).map(s => [s.pax8ProductId, s]));
      const services = [];
      let svcHigh = 0, svcLow = 0, svcNone = 0;

      for (const [key, p] of productMap) {
        const prev        = prevSvcByPax8.get(key);
        const displayName = p.termLabel ? `${p.name || p.productId} — ${p.termLabel}` : (p.name || p.productId);
        const base        = { pax8ProductId: key, pax8ProductName: displayName, vendorName: p.vendorName || '', vendorSku: p.vendorSku || '', termLabel: p.termLabel || '' };
        if (p.svcId && p.svcId > 0) {
          const atS = atSById.get(p.svcId);
          services.push({ ...base, atServiceId: p.svcId, atServiceName: atS?.name || prev?.atServiceName || '',
            confidence: 'high', source: 'pax8_api', accepted: true });
          svcHigh++;
        } else if (p.name) {
          const norm    = normName(p.name);
          const matched = norm ? atSByNorm.get(norm) : null;
          if (matched) {
            services.push({ ...base, atServiceId: matched.id, atServiceName: matched.name || '',
              confidence: 'low', source: 'name_match', accepted: prev?.accepted ?? false });
            svcLow++;
          } else {
            services.push({ ...base, atServiceId: prev?.atServiceId ?? null, atServiceName: prev?.atServiceName ?? '',
              confidence: 'unmatched', source: prev?.source ?? 'none', accepted: prev?.accepted ?? false });
            svcNone++;
          }
        }
      }
      send(`Services: ${svcHigh} auto-mapped, ${svcLow} name-matched, ${svcNone} unmatched`, svcLow + svcNone ? 'warn' : 'success');

      send('Saving to SharePoint...');
      const companies = [
        ...[...byAtId.values()].sort((a, b) => (a.atName || '').localeCompare(b.atName || '')),
        ...unmatched.sort((a, b) => (a.platforms?.pax8?.[0]?.name || '').localeCompare(b.platforms?.pax8?.[0]?.name || '')),
      ];
      const newData = { _version: 2, _updated: new Date().toISOString(), companies, services };
      await saveMappingsCentral(newData);

      _lastMappingSyncResult = {
        atCompanies: atCompanies.map(c => ({ id: c.id, name: c.companyName || c.name || '' })),
        atServices:  atServices.map(s => ({ id: s.id, name: s.name || '' })),
      };

      send('────────────────────────────', 'divider');
      send('Sync complete. Mappings saved to SharePoint (shared with all users).', 'success');

      const flatCompanies = v2ToFlat(companies);
      return {
        success: true, lastSync: newData._updated,
        companies: flatCompanies, services,
        atCompanies: _lastMappingSyncResult.atCompanies,
        atServices:  _lastMappingSyncResult.atServices,
        stats: { coHigh, coLow, coNone, svcHigh, svcLow, svcNone },
        storageSource: 'sharepoint',
      };
    } catch (err) {
      send(`Fatal: ${err.message}`, 'error');
      return { success: false, error: err.message };
    }
  });

  // ── Accept a company match (may include manual atId/atName) ─────────────────
  ipcMain.handle('accept-company-match', async (_, { pax8Id, atId, atName }) => {
    const data = await loadMappingsCentral();

    if (!isV2(data)) {
      // Legacy flat format fallback
      const companies = (data.companies || []).map(c => {
        if (c.pax8Id !== pax8Id) return c;
        const update = { ...c, accepted: true, excluded: false };
        if (atId) { update.atId = atId; update.atName = atName || c.atName;
                    update.confidence = 'manual'; update.source = 'manual'; }
        return update;
      });
      await saveMappingsCentral({ ...data, companies });
      return { success: true };
    }

    const companies = [...(data.companies || [])];
    const found = findByPax8Id(companies, pax8Id);

    if (found) {
      const { entry, pax8List, idx } = found;
      const updated = { ...pax8List[idx] };

      if (atId && atId !== entry.atId) {
        // Moving to a different AT company — need to reorganize entries
        const oldEntry = entry;
        // Remove this pax8 entry from old AT entry
        oldEntry.platforms.pax8 = pax8List.filter((_, i) => i !== idx);

        // Find or create the target AT entry
        let targetEntry = companies.find(e => e.atId === atId);
        if (!targetEntry) {
          targetEntry = { atId, atName: atName || '', excluded: false, platforms: {} };
          companies.push(targetEntry);
        } else if (atName && !targetEntry.atName) {
          targetEntry.atName = atName;
        }
        if (!targetEntry.platforms.pax8) targetEntry.platforms.pax8 = [];
        updated.confidence = 'manual';
        updated.source     = 'manual';
        targetEntry.platforms.pax8.push(updated);
      } else {
        // Same AT company — just update confidence/source
        if (atId) {
          pax8List[idx] = { ...updated, confidence: 'manual', source: 'manual' };
          if (atName && !entry.atName) entry.atName = atName;
        }
        entry.excluded = false;
      }
    } else if (atId) {
      // pax8Id not found — create a new entry
      let targetEntry = companies.find(e => e.atId === atId);
      if (!targetEntry) {
        targetEntry = { atId, atName: atName || '', excluded: false, platforms: {} };
        companies.push(targetEntry);
      }
      if (!targetEntry.platforms.pax8) targetEntry.platforms.pax8 = [];
      targetEntry.platforms.pax8.push({ id: pax8Id, name: '', confidence: 'manual', source: 'manual' });
    }

    await saveMappingsCentral({ ...data, companies });
    return { success: true };
  });

  // ── Exclude / un-exclude a company ──────────────────────────────────────────
  ipcMain.handle('set-company-excluded', async (_, { pax8Id, excluded }) => {
    const data = await loadMappingsCentral();

    if (!isV2(data)) {
      const companies = (data.companies || []).map(c =>
        c.pax8Id === pax8Id ? { ...c, excluded: !!excluded, accepted: !excluded && c.accepted } : c
      );
      if (!companies.find(c => c.pax8Id === pax8Id))
        companies.push({ pax8Id, excluded: !!excluded, confidence: 'excluded', accepted: false });
      await saveMappingsCentral({ ...data, companies });
      return { success: true };
    }

    const companies = [...(data.companies || [])];
    const found = findByPax8Id(companies, pax8Id);
    if (found) {
      found.entry.excluded = !!excluded;
    } else {
      // pax8Id not in any entry — add as a new unmatched excluded entry
      companies.push({
        atId: null, atName: null,
        excluded: !!excluded,
        platforms: { pax8: [{ id: pax8Id, name: '', confidence: 'excluded', source: 'none' }] },
      });
    }

    await saveMappingsCentral({ ...data, companies });
    return { success: true };
  });

  // ── Get current mappings (SP primary, local fallback) ───────────────────────
  ipcMain.handle('get-mappings', async () => {
    const data = await loadMappingsCentral();
    const flatCompanies = isV2(data) ? v2ToFlat(data.companies) : (data.companies || []);
    return {
      companies:   flatCompanies,
      services:    data.services || [],
      lastSync:    isV2(data) ? data._updated : data.lastSync,
      _storageSource: data._storageSource,
      atCompanies: _lastMappingSyncResult?.atCompanies || [],
      atServices:  _lastMappingSyncResult?.atServices  || [],
    };
  });

  // ── Save mappings (called from CSV import) ───────────────────────────────────
  ipcMain.handle('save-mappings', async (_, { companies, services }) => {
    const existing = await loadMappingsCentral();
    if (!isV2(existing)) {
      await saveMappingsCentral({ ...existing, companies, services });
      return { success: true };
    }
    // Re-integrate flat companies back into v2 format
    const byAtId  = new Map((existing.companies || []).filter(e => e.atId).map(e => [e.atId, e]));
    const byPax8  = new Map();
    for (const e of (existing.companies || [])) {
      const pax8List = Array.isArray(e.platforms?.pax8) ? e.platforms.pax8 : [];
      for (const p of pax8List) { if (p.id) byPax8.set(p.id, e); }
    }
    for (const c of (companies || [])) {
      if (!c.pax8Id) continue;
      let entry = byPax8.get(c.pax8Id);
      if (!entry && c.atId) entry = byAtId.get(c.atId);
      if (!entry) {
        entry = { atId: c.atId || null, atName: c.atName || '', excluded: c.excluded || false, platforms: {} };
        if (c.atId) { byAtId.set(c.atId, entry); existing.companies.push(entry); }
        else         { existing.companies.push(entry); }
      }
      if (!entry.platforms.pax8) entry.platforms.pax8 = [];
      const idx = entry.platforms.pax8.findIndex(p => p.id === c.pax8Id);
      const newPax8 = { id: c.pax8Id, name: c.pax8Name || '', confidence: c.confidence || 'low', source: c.source || 'none' };
      if (idx >= 0) entry.platforms.pax8[idx] = newPax8;
      else          entry.platforms.pax8.push(newPax8);
      entry.excluded = c.excluded || false;
      if (c.atName && !entry.atName) entry.atName = c.atName;
    }
    await saveMappingsCentral({ ...existing, services: services || existing.services });
    return { success: true };
  });

  // ── Search Autotask companies by name (for manual matching) ─────────────────
  ipcMain.handle('cm-search-at-companies', async (_, name) => {
    try {
      const cleaned = (name || '').replace(/[^a-z0-9\s]/gi, ' ').trim();
      const words   = cleaned.split(/\s+/);
      const alphaPart = words.map(w => w.replace(/^\d+/, '')).find(w => w.length >= 3);
      const term    = (alphaPart || words.find(w => w.length >= 3) || cleaned).substring(0, 15);
      if (!term) return [];
      const companies = await atQuery('/Companies', [
        { field: 'companyName', op: 'contains', value: term },
        { field: 'isActive',    op: 'eq',       value: true },
      ]);
      return (companies || []).slice(0, 10).map(c => ({ id: c.id, name: c.companyName || c.name || '' }));
    } catch { return []; }
  });

  // ── CSV Export ───────────────────────────────────────────────────────────────
  function buildMappingCsvs(data, includeAll = false) {
    const esc = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
    // Flatten v2 or use flat directly
    const flatCos = isV2(data) ? v2ToFlat(data.companies) : (data.companies || []);
    const companies = includeAll ? flatCos : flatCos.filter(c => !c.atId);
    const coHeader  = 'pax8_company_id,pax8_company_name,at_company_id,at_company_name,confidence,accepted,excluded\n';
    const coRows    = companies
      .map(c => [c.pax8Id, c.pax8Name, c.atId ?? '', c.atName ?? '', c.confidence, c.accepted ? 'yes' : 'no', c.excluded ? 'yes' : 'no']
      .map(esc).join(',')).join('\n');
    const services  = includeAll ? (data.services || []) : (data.services || []).filter(s => !s.atServiceId);
    const svcHeader = 'pax8_product_id,pax8_product_name,term,vendor_name,vendor_sku,at_service_id,at_service_name,confidence,accepted\n';
    const svcRows   = services
      .map(s => [s.pax8ProductId, s.pax8ProductName, s.termLabel ?? '', s.vendorName ?? '', s.vendorSku ?? '', s.atServiceId ?? '', s.atServiceName ?? '', s.confidence, s.accepted ? 'yes' : 'no']
      .map(esc).join(',')).join('\n');
    return { coHeader, coRows, svcHeader, svcRows, coCount: companies.length, svcCount: services.length };
  }

  ipcMain.handle('export-mapping-csv', async () => {
    const data = await loadMappingsCentral();
    const { coHeader, coRows, svcHeader, svcRows, coCount, svcCount } = buildMappingCsvs(data, false);
    const coPath  = path.join(USER_DATA, 'anchor-company-mappings.csv');
    const svcPath = path.join(USER_DATA, 'anchor-service-mappings.csv');
    fs.writeFileSync(coPath,  coHeader + coRows,  'utf8');
    fs.writeFileSync(svcPath, svcHeader + svcRows, 'utf8');
    shell.showItemInFolder(coPath);
    return { success: true, coPath, svcPath, coCount, svcCount };
  });

  ipcMain.handle('export-full-mapping-csv', async () => {
    const data = await loadMappingsCentral();
    const { coHeader, coRows, svcHeader, svcRows, coCount, svcCount } = buildMappingCsvs(data, true);
    const coPath  = path.join(USER_DATA, 'anchor-company-mappings-full.csv');
    const svcPath = path.join(USER_DATA, 'anchor-service-mappings-full.csv');
    fs.writeFileSync(coPath,  coHeader + coRows,  'utf8');
    fs.writeFileSync(svcPath, svcHeader + svcRows, 'utf8');
    const refRows = (_lastMappingSyncResult?.atServices || [])
      .map(s => `"${s.id}","${String(s.name || '').replace(/"/g, '""')}"`)
      .join('\n');
    if (refRows) {
      const refPath = path.join(USER_DATA, 'at-services-reference.csv');
      fs.writeFileSync(refPath, 'at_service_id,at_service_name\n' + refRows, 'utf8');
    }
    shell.showItemInFolder(coPath);
    return { success: true, coPath, svcPath, coCount, svcCount, hasRef: !!refRows };
  });

  // ── Refresh AT Classification labels from Autotask API ──────────────────────
  // Reads the integer `classification` field directly on the Companies entity
  // and writes the resolved label back to hub entries as atClassification.
  // Only writes to hub when at least one value actually changes.
  const AT_CLASSIFICATION_MAP = {
    18: 'TC', 19: 'TC-Lite', 16: 'TC+', 20: 'Legacy',
    200: 'Needs Some Love!', 13: 'At Risk Account', 15: 'Break Fix',
    201: 'Co Managed', 9: 'Canceled', 10: 'Delinquent', 17: 'Vendor',
    202: 'Onboarding', 203: 'Offboarding', 5: 'Block Hour',
    6: 'Call List', 7: 'Target', 8: 'No Fit Now',
  };

  ipcMain.handle('cm-update-at-classifications', async () => {
    try {
      const hub = await loadMappingsCentral();

      // Paginate through all active companies, reading only id + classification
      const allCos = [];
      let maxId = 0;
      while (true) {
        const r = await atFetch('/Companies/query', {
          method: 'POST',
          body: JSON.stringify({
            filter: [
              { field: 'isActive',       op: 'eq', value: true },
              { field: 'id',             op: 'gt', value: maxId },
            ],
            includeFields: ['id', 'classification'],
          }),
        });
        const items = r.items || [];
        if (!items.length) break;
        allCos.push(...items);
        maxId = Math.max(...items.map(i => i.id));
        if (items.length < 500) break;
      }

      const byId = new Map(allCos.map(c => [c.id, c]));
      let changed = 0;
      for (const entry of (hub.companies || [])) {
        if (!entry.atId) continue;
        const co = byId.get(entry.atId);
        if (!co) continue;
        const label = AT_CLASSIFICATION_MAP[co.classification] || null;
        if (label !== (entry.atClassification || null)) {
          if (label) entry.atClassification = label;
          else        delete entry.atClassification;
          changed++;
        }
      }
      if (changed > 0) {
        hub._updated = new Date().toISOString();
        await saveMappingsCentral(hub);
      }
      return { ok: true, updated: changed };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // ── Get full hub data (AT-centric companies + serviceMappings) ───────────────
  ipcMain.handle('cm-get-hub-data', async () => {
    const hub = await loadMappingsCentral();
    ensureServiceMappings(hub);

    // Filter hub companies to only those with an active AT record.
    // Query once, build a Set of active IDs, then filter.
    let activeAtIds = null;
    try {
      const atCos = await atQuery('/Companies', [{ field: 'isActive', op: 'eq', value: true }]);
      activeAtIds = new Set((atCos || []).map(c => c.id));
    } catch { /* if AT is unavailable, show all */ }

    const allCompanies = hub.companies || [];
    // Only filter when we got a non-empty result — an empty Set means the query returned
    // nothing useful (rate limit, transient error), so fall back to showing all.
    const companies = (activeAtIds && activeAtIds.size > 0)
      ? allCompanies.filter(c => !c.atId || activeAtIds.has(c.atId))
      : allCompanies;

    return {
      companies,
      serviceMappings: hub.serviceMappings || JSON.parse(JSON.stringify(DEFAULT_SERVICE_MAPPINGS)),
      lastSync:        hub._updated || hub.lastSync || null,
      _storageSource:  hub._storageSource,
    };
  });

  // ── Search Autotask services by name (live search for mapping editor) ────────
  ipcMain.handle('cm-search-at-services', async (_, name) => {
    try {
      const term = (name || '').trim().substring(0, 25);
      if (!term) return [];
      const services = await atQuery('/Services', [
        { field: 'name', op: 'contains', value: term },
      ]);
      return (services || []).slice(0, 15).map(s => ({ id: s.id, name: s.name || '' }));
    } catch { return []; }
  });

  // ── Save (upsert) a service mapping entry ───────────────────────────────────
  ipcMain.handle('cm-save-service-mapping', async (_, { tool, mapping }) => {
    try {
      const hub = await loadMappingsCentral();
      ensureServiceMappings(hub);
      if (!hub.serviceMappings[tool]) hub.serviceMappings[tool] = [];
      const idx = hub.serviceMappings[tool].findIndex(m => m.id === mapping.id);
      if (idx >= 0) hub.serviceMappings[tool][idx] = { ...hub.serviceMappings[tool][idx], ...mapping };
      else          hub.serviceMappings[tool].push(mapping);
      hub._version = 3;
      hub._updated = new Date().toISOString();
      await saveMappingsCentral(hub);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // ── Delete a service mapping entry ──────────────────────────────────────────
  ipcMain.handle('cm-delete-service-mapping', async (_, { tool, id }) => {
    try {
      const hub = await loadMappingsCentral();
      if (hub.serviceMappings?.[tool]) {
        hub.serviceMappings[tool] = hub.serviceMappings[tool].filter(m => m.id !== id);
      }
      hub._updated = new Date().toISOString();
      await saveMappingsCentral(hub);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // ── Exclude / un-exclude an AT-centric company by atId ──────────────────────
  ipcMain.handle('cm-set-at-excluded', async (_, { atId, excluded }) => {
    try {
      const hub = await loadMappingsCentral();
      const entry = (hub.companies || []).find(e => e.atId === atId);
      if (!entry) return { ok: false, error: `AT company ${atId} not found` };
      if (excluded) entry.excluded = true;
      else          delete entry.excluded;
      hub._updated = new Date().toISOString();
      await saveMappingsCentral(hub);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // ── Remove a platform mapping from a hub entry ──────────────────────────────
  // platform: 'kaseya' | 'blackpoint' | 'pax8'
  // platformName: the name value used to identify the specific item to remove
  ipcMain.handle('cm-remove-platform-mapping', async (_, { atId, platform, platformName }) => {
    try {
      const hub = await loadMappingsCentral();
      const entry = (hub.companies || []).find(e => e.atId === atId);
      if (!entry) return { ok: false, error: 'Entry not found' };
      if (platform === 'blackpoint') {
        delete entry.platforms.blackpoint;
      } else if (platform === 'kaseya') {
        const arr = Array.isArray(entry.platforms.kaseya) ? entry.platforms.kaseya : (entry.platforms.kaseya ? [entry.platforms.kaseya] : []);
        entry.platforms.kaseya = arr.filter(k => k.name !== platformName);
        if (!entry.platforms.kaseya.length) delete entry.platforms.kaseya;
      } else if (platform === 'pax8') {
        const arr = Array.isArray(entry.platforms.pax8) ? entry.platforms.pax8 : (entry.platforms.pax8 ? [entry.platforms.pax8] : []);
        entry.platforms.pax8 = arr.filter(p => p.name !== platformName);
      }
      hub._updated = new Date().toISOString();
      await saveMappingsCentral(hub);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // ── Reassign a platform mapping to a different AT company ────────────────────
  // Moves the platform entry from fromAtId to toAtId (creates toAtId entry if needed).
  ipcMain.handle('cm-reassign-platform', async (_, { fromAtId, toAtId, toAtName, platform, platformName }) => {
    try {
      const hub = await loadMappingsCentral();
      const companies = hub.companies || [];
      const fromEntry = companies.find(e => e.atId === fromAtId);
      if (!fromEntry) return { ok: false, error: 'Source entry not found' };

      let toEntry = companies.find(e => e.atId === toAtId);
      if (!toEntry) {
        toEntry = { atId: toAtId, atName: toAtName || '', excluded: false, platforms: {} };
        companies.push(toEntry);
      } else if (toAtName && !toEntry.atName) {
        toEntry.atName = toAtName;
      }

      if (platform === 'blackpoint') {
        const data = fromEntry.platforms.blackpoint;
        delete fromEntry.platforms.blackpoint;
        toEntry.platforms.blackpoint = data;
      } else if (platform === 'kaseya') {
        const arr = Array.isArray(fromEntry.platforms.kaseya) ? fromEntry.platforms.kaseya : (fromEntry.platforms.kaseya ? [fromEntry.platforms.kaseya] : []);
        const idx = arr.findIndex(k => k.name === platformName);
        if (idx < 0) return { ok: false, error: 'Kaseya entry not found' };
        const [item] = arr.splice(idx, 1);
        fromEntry.platforms.kaseya = arr.length ? arr : undefined;
        if (!fromEntry.platforms.kaseya) delete fromEntry.platforms.kaseya;
        if (!Array.isArray(toEntry.platforms.kaseya)) toEntry.platforms.kaseya = toEntry.platforms.kaseya ? [toEntry.platforms.kaseya] : [];
        toEntry.platforms.kaseya.push(item);
      } else if (platform === 'pax8') {
        const arr = Array.isArray(fromEntry.platforms.pax8) ? fromEntry.platforms.pax8 : [];
        const idx = arr.findIndex(p => p.name === platformName);
        if (idx < 0) return { ok: false, error: 'Pax8 entry not found' };
        const [item] = arr.splice(idx, 1);
        fromEntry.platforms.pax8 = arr;
        if (!Array.isArray(toEntry.platforms.pax8)) toEntry.platforms.pax8 = [];
        toEntry.platforms.pax8.push(item);
      }

      hub._updated = new Date().toISOString();
      await saveMappingsCentral(hub);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // ── Add a new platform name mapping to an AT company ────────────────────────
  // For kaseya/blackpoint: platformName is the display name in that system.
  ipcMain.handle('cm-add-platform-mapping', async (_, { atId, platform, platformName }) => {
    try {
      const hub = await loadMappingsCentral();
      const entry = (hub.companies || []).find(e => e.atId === atId);
      if (!entry) return { ok: false, error: 'Entry not found' };
      if (!entry.platforms) entry.platforms = {};
      const data = { name: platformName, confidence: 1, confirmedAt: new Date().toISOString() };
      if (platform === 'blackpoint') {
        entry.platforms.blackpoint = data;
      } else if (platform === 'kaseya') {
        if (!Array.isArray(entry.platforms.kaseya)) entry.platforms.kaseya = entry.platforms.kaseya ? [entry.platforms.kaseya] : [];
        entry.platforms.kaseya.push(data);
      }
      hub._updated = new Date().toISOString();
      await saveMappingsCentral(hub);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // ── CSV Import ───────────────────────────────────────────────────────────────
  ipcMain.handle('import-mapping-csv', async (_, type) => {
    const { filePaths } = await dialog.showOpenDialog(getMainWindow(), {
      title: type === 'companies' ? 'Import Company Mappings CSV' : 'Import Service Mappings CSV',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      properties: ['openFile'],
    });
    if (!filePaths || !filePaths[0]) return { cancelled: true };

    const lines    = fs.readFileSync(filePaths[0], 'utf8').split(/\r?\n/);
    const header   = lines[0].toLowerCase().replace(/\s/g, '');
    const existing = await loadMappingsCentral();

    if (type === 'companies') {
      const cols_h       = header.split(',');
      const idxPax8Id    = cols_h.indexOf('pax8_company_id');
      const idxPax8Name  = cols_h.indexOf('pax8_company_name');
      const idxAtId      = cols_h.indexOf('at_company_id');
      const idxAtName    = cols_h.indexOf('at_company_name');
      const idxAccepted  = cols_h.indexOf('accepted');
      const idxExcluded  = cols_h.indexOf('excluded');
      if (idxPax8Id < 0 || idxAtId < 0) return { error: 'Missing required columns: pax8_company_id, at_company_id' };

      // Parse CSV into flat entries
      const csvEntries = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols    = parseCSVLine(lines[i]);
        const pax8Id  = cols[idxPax8Id]?.trim();
        const atId    = parseInt(cols[idxAtId]?.trim(), 10) || null;
        const atName  = cols[idxAtName]?.trim() || '';
        const pax8Name= cols[idxPax8Name]?.trim() || '';
        const accepted= idxAccepted >= 0 ? cols[idxAccepted]?.trim().toLowerCase() !== 'no' : !!atId;
        const excluded= idxExcluded >= 0 ? cols[idxExcluded]?.trim().toLowerCase() === 'yes' : false;
        if (!pax8Id) continue;
        csvEntries.push({ pax8Id, pax8Name, atId, atName,
          accepted: !excluded && accepted && !!atId, excluded, confidence: atId ? 'csv' : 'unmatched', source: 'csv' });
      }

      if (!isV2(existing)) {
        // Legacy flat format — just replace
        const prevFlat = existing.companies || [];
        const updated  = csvEntries.map(e => {
          const prev = prevFlat.find(c => c.pax8Id === e.pax8Id) || {};
          return { ...prev, ...e };
        });
        await saveMappingsCentral({ ...existing, companies: updated });
        return { success: true, count: updated.length };
      }

      // v2 format — integrate CSV into existing hub structure
      const companies = [...(existing.companies || [])];
      const byAtId = new Map(companies.filter(e => e.atId).map(e => [e.atId, e]));
      const byPax8 = new Map();
      for (const e of companies) {
        const pax8List = Array.isArray(e.platforms?.pax8) ? e.platforms.pax8 : [];
        for (const p of pax8List) { if (p.id) byPax8.set(p.id, e); }
      }

      for (const ce of csvEntries) {
        let entry = byPax8.get(ce.pax8Id);
        if (!entry && ce.atId) {
          // Move pax8 entry to target AT company
          entry = byAtId.get(ce.atId);
          if (!entry) {
            entry = { atId: ce.atId, atName: ce.atName || '', excluded: ce.excluded, platforms: {} };
            companies.push(entry);
            byAtId.set(ce.atId, entry);
          }
        }
        if (!entry) {
          entry = { atId: null, atName: null, excluded: ce.excluded, platforms: {} };
          companies.push(entry);
        }
        if (!entry.platforms.pax8) entry.platforms.pax8 = [];
        const idx = entry.platforms.pax8.findIndex(p => p.id === ce.pax8Id);
        const newP = { id: ce.pax8Id, name: ce.pax8Name || '', confidence: ce.atId ? 'csv' : 'unmatched', source: 'csv' };
        if (idx >= 0) entry.platforms.pax8[idx] = newP;
        else          entry.platforms.pax8.push(newP);
        entry.excluded = ce.excluded;
        if (ce.atId && ce.atName && !entry.atName) entry.atName = ce.atName;
      }
      await saveMappingsCentral({ ...existing, companies });
      return { success: true, count: csvEntries.length };

    } else {
      const cols_h = header.split(',');
      const isPsaExport = cols_h.some(c => c.trim() === 'product id') && cols_h.some(c => c.trim() === 'psa product id');

      let idxPid, idxPname, idxSvcId, idxSvcName, idxAccepted;
      if (isPsaExport) {
        idxPid      = cols_h.findIndex(c => c.trim() === 'product id');
        idxPname    = cols_h.findIndex(c => c.trim() === 'product name');
        idxSvcId    = cols_h.findIndex(c => c.trim() === 'psa product id');
        idxSvcName  = cols_h.findIndex(c => c.trim() === 'psa product name');
        idxAccepted = -1;
      } else {
        idxPid      = cols_h.indexOf('pax8_product_id');
        idxPname    = cols_h.indexOf('pax8_product_name');
        idxSvcId    = cols_h.indexOf('at_service_id');
        idxSvcName  = cols_h.indexOf('at_service_name');
        idxAccepted = cols_h.indexOf('accepted');
      }
      if (idxPid < 0 || idxSvcId < 0) return { error: 'Unrecognised format. Expected Anchor export or Pax8 PSA export CSV.' };

      const updated = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols    = parseCSVLine(lines[i]);
        const pid     = cols[idxPid]?.trim();
        const svcId   = parseInt(cols[idxSvcId]?.trim(), 10) || null;
        const svcName = idxSvcName >= 0 ? (cols[idxSvcName]?.trim() || '') : '';
        const pname   = idxPname  >= 0 ? (cols[idxPname]?.trim()  || '') : '';
        const accepted= idxAccepted >= 0 ? cols[idxAccepted]?.trim().toLowerCase() !== 'no' : !!svcId;
        if (!pid) continue;
        const prev = (existing.services || []).find(s => s.pax8ProductId === pid) || {};
        updated.push({ ...prev, pax8ProductId: pid, pax8ProductName: pname || prev.pax8ProductName || '',
          atServiceId: svcId, atServiceName: svcName, accepted: accepted && !!svcId,
          source: isPsaExport ? 'psa_export' : (prev.source || 'csv') });
      }
      await saveMappingsCentral({ ...existing, services: updated });
      return { success: true, count: updated.length, isPsaExport };
    }
  });
};
