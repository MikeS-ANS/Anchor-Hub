const fs   = require('fs');
const path = require('path');
const { dialog, shell } = require('electron');
const { USER_DATA, getMainWindow, loadMappings, saveMappingsFile } = require('../shared/state');
const { getPax8Token, pax8Paginate, resolveProductDetails } = require('../shared/pax8');
const { atFetch, atQuery } = require('../shared/at');
const { parseCSVLine, mkProductKey, termLabel } = require('../shared/csvMappings');

let _lastMappingSyncResult = null;

const normName = s => (s || '').toLowerCase()
  .replace(/\binc\.?\b|\bllc\.?\b|\bltd\.?\b|\bcorp\.?\b|\bco\.?\b/g, '')
  .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

module.exports = function registerCompanyMapping(ipcMain) {
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
        if (n && !atCById.has(n)) atCByNorm.set(n, c);
      }

      const existing   = loadMappings();
      const prevByPax8 = new Map((existing.companies || []).map(c => [c.pax8Id, c]));

      const companies = [];
      let coHigh = 0, coLow = 0, coNone = 0;

      for (const co of pax8Companies) {
        const prev    = prevByPax8.get(co.id);
        const rawId   = co.externalId ?? co.psaId ?? co.psaCompanyId ?? co.crmId
                        ?? co.psa?.companyId ?? co.provisioningId ?? null;
        const atIdNum = rawId != null ? parseInt(String(rawId), 10) || null : null;

        if (atIdNum && atIdNum > 0) {
          const atCo = atCById.get(atIdNum);
          companies.push({ pax8Id: co.id, pax8Name: co.name || '', atId: atIdNum,
            atName: atCo?.companyName || atCo?.name || prev?.atName || '',
            confidence: 'high', source: 'pax8_api', accepted: true });
          coHigh++;
        } else {
          const norm    = normName(co.name || '');
          const matched = norm ? atCByNorm.get(norm) : null;
          if (matched) {
            companies.push({ pax8Id: co.id, pax8Name: co.name || '',
              atId: matched.id, atName: matched.companyName || matched.name || '',
              confidence: 'low', source: 'name_match', accepted: prev?.accepted ?? false });
            coLow++;
          } else {
            companies.push({ pax8Id: co.id, pax8Name: co.name || '',
              atId: prev?.atId ?? null, atName: prev?.atName ?? '',
              confidence: 'unmatched', source: prev?.source ?? 'none', accepted: prev?.accepted ?? false });
            coNone++;
          }
        }
      }
      send(`Companies: ${coHigh} auto-mapped, ${coLow} name-matched, ${coNone} unmatched`, coLow + coNone ? 'warn' : 'success');

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
      send(`  ℹ ${productMap.size} unique product+term combinations from ${allSubs.length} subscriptions`, 'info');

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

      const lastSync = new Date().toISOString();
      saveMappingsFile({ lastSync, companies, services });

      _lastMappingSyncResult = {
        atCompanies: atCompanies.map(c => ({ id: c.id, name: c.companyName || c.name || '' })),
        atServices:  atServices.map(s => ({ id: s.id, name: s.name || '' })),
      };

      send('────────────────────────────', 'divider');
      send(`Sync complete. Mappings saved to pax8hub-mappings.json`, 'success');

      return {
        success: true, lastSync, companies, services,
        atCompanies: _lastMappingSyncResult.atCompanies,
        atServices:  _lastMappingSyncResult.atServices,
        stats: { coHigh, coLow, coNone, svcHigh, svcLow, svcNone },
      };
    } catch (err) {
      send(`Fatal: ${err.message}`, 'error');
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('set-company-excluded', (_, { pax8Id, excluded }) => {
    const data = loadMappings();
    const companies = (data.companies || []).map(c => c.pax8Id === pax8Id ? { ...c, excluded: !!excluded } : c);
    if (!companies.find(c => c.pax8Id === pax8Id))
      companies.push({ pax8Id, excluded: !!excluded, confidence: 'excluded', accepted: false });
    saveMappingsFile({ ...data, companies });
    return { success: true };
  });

  ipcMain.handle('accept-company-match', (_, { pax8Id }) => {
    const data = loadMappings();
    const companies = (data.companies || []).map(c =>
      c.pax8Id === pax8Id ? { ...c, accepted: true, excluded: false } : c
    );
    saveMappingsFile({ ...data, companies });
    return { success: true };
  });

  function buildMappingCsvs(data, includeAll = false) {
    const esc = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const companies  = includeAll ? (data.companies || []) : (data.companies || []).filter(c => !c.atId);
    const coHeader   = 'pax8_company_id,pax8_company_name,at_company_id,at_company_name,confidence,accepted,excluded\n';
    const coRows     = companies
      .map(c => [c.pax8Id, c.pax8Name, c.atId ?? '', c.atName ?? '', c.confidence, c.accepted ? 'yes' : 'no', c.excluded ? 'yes' : 'no']
      .map(esc).join(',')).join('\n');
    const services   = includeAll ? (data.services || []) : (data.services || []).filter(s => !s.atServiceId);
    const svcHeader  = 'pax8_product_id,pax8_product_name,term,vendor_name,vendor_sku,at_service_id,at_service_name,confidence,accepted\n';
    const svcRows    = services
      .map(s => [s.pax8ProductId, s.pax8ProductName, s.termLabel ?? '', s.vendorName ?? '', s.vendorSku ?? '', s.atServiceId ?? '', s.atServiceName ?? '', s.confidence, s.accepted ? 'yes' : 'no']
      .map(esc).join(',')).join('\n');
    return { coHeader, coRows, svcHeader, svcRows, coCount: companies.length, svcCount: services.length };
  }

  ipcMain.handle('export-mapping-csv', async () => {
    const data = loadMappings();
    const { coHeader, coRows, svcHeader, svcRows, coCount, svcCount } = buildMappingCsvs(data, false);
    const coPath  = path.join(USER_DATA, 'anchor-company-mappings.csv');
    const svcPath = path.join(USER_DATA, 'anchor-service-mappings.csv');
    fs.writeFileSync(coPath,  coHeader + coRows,  'utf8');
    fs.writeFileSync(svcPath, svcHeader + svcRows, 'utf8');
    shell.showItemInFolder(coPath);
    return { success: true, coPath, svcPath, coCount, svcCount };
  });

  ipcMain.handle('export-full-mapping-csv', async () => {
    const data = loadMappings();
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

  ipcMain.handle('import-mapping-csv', async (_, type) => {
    const { filePaths } = await dialog.showOpenDialog(getMainWindow(), {
      title: type === 'companies' ? 'Import Company Mappings CSV' : 'Import Service Mappings CSV',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      properties: ['openFile'],
    });
    if (!filePaths || !filePaths[0]) return { cancelled: true };

    const lines    = fs.readFileSync(filePaths[0], 'utf8').split(/\r?\n/);
    const header   = lines[0].toLowerCase().replace(/\s/g, '');
    const existing = loadMappings();

    if (type === 'companies') {
      const cols_h       = header.split(',');
      const idxPax8Id    = cols_h.indexOf('pax8_company_id');
      const idxPax8Name  = cols_h.indexOf('pax8_company_name');
      const idxAtId      = cols_h.indexOf('at_company_id');
      const idxAtName    = cols_h.indexOf('at_company_name');
      const idxAccepted  = cols_h.indexOf('accepted');
      const idxExcluded  = cols_h.indexOf('excluded');
      if (idxPax8Id < 0 || idxAtId < 0) return { error: 'Missing required columns: pax8_company_id, at_company_id' };

      const updated = [];
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
        const prev = (existing.companies || []).find(c => c.pax8Id === pax8Id) || {};
        updated.push({ ...prev, pax8Id, pax8Name: pax8Name || prev.pax8Name || '', atId, atName,
          accepted: !excluded && accepted && !!atId, excluded });
      }
      saveMappingsFile({ ...existing, companies: updated });
      return { success: true, count: updated.length };
    } else {
      const cols_h = header.split(',');
      const isPsaExport = cols_h.some(c => c.trim() === 'product id') && cols_h.some(c => c.trim() === 'psa product id');

      let idxPid, idxPname, idxSvcId, idxSvcName, idxAccepted;
      if (isPsaExport) {
        idxPid     = cols_h.findIndex(c => c.trim() === 'product id');
        idxPname   = cols_h.findIndex(c => c.trim() === 'product name');
        idxSvcId   = cols_h.findIndex(c => c.trim() === 'psa product id');
        idxSvcName = cols_h.findIndex(c => c.trim() === 'psa product name');
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
      saveMappingsFile({ ...existing, services: updated });
      return { success: true, count: updated.length, isPsaExport };
    }
  });

  ipcMain.handle('get-mappings', () => {
    const saved = loadMappings();
    return {
      ...saved,
      atCompanies: _lastMappingSyncResult?.atCompanies || [],
      atServices:  _lastMappingSyncResult?.atServices  || [],
    };
  });

  ipcMain.handle('save-mappings', (_, { companies, services }) => {
    const existing = loadMappings();
    saveMappingsFile({ ...existing, companies, services });
    return { success: true };
  });
};
