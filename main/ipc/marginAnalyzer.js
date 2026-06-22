const keytar = require('keytar');
const { app, shell } = require('electron');
const path   = require('path');
const { SERVICE_NAME, getMainWindow, loadMappings } = require('../shared/state');
const { getPax8Token, pax8Paginate } = require('../shared/pax8');
const { atFetch, atQuery, getContractServices } = require('../shared/at');
const { loadCsvMappings, loadClientMappings, mkProductKey } = require('../shared/csvMappings');
const { pax8FetchInvoiceItems, PARTIAL_RE } = require('./invoiceMonitor');

const AZURE_RE = /azure/i;
let marginAbortFlag   = false;
let lastMarginExportData = null;

function loadExcludedCompanies() {
  return new Set((loadMappings().companies || []).filter(c => c.excluded).map(c => c.pax8Id));
}

const atServiceCache = new Map();
async function resolveAtServiceName(serviceId) {
  if (atServiceCache.has(serviceId)) return atServiceCache.get(serviceId);
  try {
    const r = await atFetch(`/Services/${serviceId}`);
    const name = r.item?.name || r.name || null;
    atServiceCache.set(serviceId, name);
    return name;
  } catch { atServiceCache.set(serviceId, null); return null; }
}

async function fetchContractServicesWithPricing(contractId) {
  return getContractServices(contractId, null);
}

module.exports = function registerMarginAnalyzer(ipcMain) {
  ipcMain.handle('abort-margin-analysis', () => { marginAbortFlag = true; return true; });

  ipcMain.handle('get-margin-settings', async () => {
    const azureContract   = await keytar.getPassword(SERVICE_NAME, 'margin_azure_contract')    || 'Microsoft Azure Cloud Services';
    const scheduleDay     = await keytar.getPassword(SERVICE_NAME, 'margin_schedule_day')       || '10';
    const scheduleEnabled = await keytar.getPassword(SERVICE_NAME, 'margin_schedule_enabled')   || 'true';
    const azureServiceId  = await keytar.getPassword(SERVICE_NAME, 'margin_azure_service_id')   || '110';
    const { readState } = require('../shared/state');
    const state = readState();
    return { azureContract, scheduleDay: parseInt(scheduleDay), scheduleEnabled: scheduleEnabled === 'true', azureServiceId: parseInt(azureServiceId) || 110, lastRun: state.marginLastRun || null };
  });

  ipcMain.handle('save-margin-settings', async (_, { azureContract, scheduleDay, scheduleEnabled, azureServiceId }) => {
    await keytar.setPassword(SERVICE_NAME, 'margin_azure_contract',    azureContract  || 'Microsoft Azure Cloud Services');
    await keytar.setPassword(SERVICE_NAME, 'margin_schedule_day',      String(scheduleDay  || 10));
    await keytar.setPassword(SERVICE_NAME, 'margin_schedule_enabled',  scheduleEnabled ? 'true' : 'false');
    await keytar.setPassword(SERVICE_NAME, 'margin_azure_service_id',  String(azureServiceId || 110));
    return { success: true };
  });

  ipcMain.handle('run-margin-analysis', async (event, { companyFilter = '' } = {}) => {
    marginAbortFlag = false;
    const send = (msg, type = 'info') => getMainWindow().webContents.send('margin-log', { msg, type });
    const { writeState } = require('../shared/state');

    try {
      const csvMappings       = loadCsvMappings();
      const clientMappings    = loadClientMappings();
      const excludedCompanies = loadExcludedCompanies();
      const azureContractKeyword = (await keytar.getPassword(SERVICE_NAME, 'margin_azure_contract') || 'Microsoft Azure Cloud Services').toLowerCase();

      send('Authenticating with Pax8...');
      const token = await getPax8Token();
      send('✓ Pax8 token obtained', 'success');

      send('Fetching current invoice...');
      const allInvoices = await pax8Paginate(token, '/invoices');
      allInvoices.sort((a, b) => new Date(b.invoiceDate || 0) - new Date(a.invoiceDate || 0));
      if (!allInvoices.length) throw new Error('No invoices found.');
      const currentInv   = allInvoices[0];
      const invoiceItems = await pax8FetchInvoiceItems(token, currentInv.id);
      send(`✓ ${invoiceItems.length} line items loaded (${currentInv.invoiceDate})`, 'success');

      const isProrate = i => (i.type || i.chargeType || '').toLowerCase() === 'prorate'
        || PARTIAL_RE.test(i.description || '')
        || /\(Canceled\)\s*prorated/i.test(i.description || '');

      const byCompany = {};
      for (const item of invoiceItems.filter(i => !isProrate(i))) {
        const cid   = String(item.company_id || item.companyId || 'unknown');
        const cname = item.company_name || item.companyName || cid;
        if (!byCompany[cid]) byCompany[cid] = { name: cname, regular: [], azure: [] };
        if (AZURE_RE.test(item.description || '') || AZURE_RE.test(item.sku || '')) {
          byCompany[cid].azure.push(item);
        } else {
          byCompany[cid].regular.push(item);
        }
      }

      const filter = companyFilter.trim().toLowerCase();
      const allRows = [], mismatches = [], azureRows = [], unmappedRows = [], noContractRows = [], orphanedAtRows = [], companySummaries = [];

      send('────────────────────────────', 'divider');
      send(`Invoice: ${currentInv.id} — ${currentInv.invoiceDate}`);
      send(`Analyzing ${Object.keys(byCompany).length} companies...`);
      send('────────────────────────────', 'divider');

      for (const [pax8Cid, { name: cname, regular: regItems, azure: azItems }] of Object.entries(byCompany)) {
        if (marginAbortFlag) { send('⚠ Stopped by user.', 'warn'); break; }
        if (excludedCompanies.has(pax8Cid)) continue;
        if (filter && !cname.toLowerCase().includes(filter)) continue;

        const clientEntry = clientMappings.get(pax8Cid);
        if (!clientEntry) {
          send(`  ⚠ ${cname}: no AT client mapping — skipping`, 'warn');
          for (const item of [...regItems, ...azItems]) {
            unmappedRows.push({ company: cname, sku: item.sku || '', description: item.description || '', reason: 'No client mapping in CSV' });
          }
          continue;
        }
        const atCompanyId = clientEntry.atCompanyId;

        let contracts = [];
        try {
          contracts = await atQuery('/Contracts', [
            { op: 'eq', field: 'companyID', value: atCompanyId },
            { op: 'eq', field: 'status',    value: 1 },
          ]);
        } catch (e) { send(`  ⚠ ${cname}: contract fetch failed — ${e.message}`, 'warn'); }

        if (!contracts.length) {
          send(`  ⚠ ${cname}: no active AT contracts`, 'warn');
          noContractRows.push({ company: cname, atCompanyId });
          continue;
        }

        const servicePricing = new Map();
        const pricingByName  = new Map();
        const m365Services   = new Map();
        let azureAtContract  = null;

        for (const contract of contracts) {
          const ctrName = (contract.contractName || contract.name || '').toLowerCase();
          if (AZURE_RE.test(ctrName)) { azureAtContract = contract; continue; }
          const isM365Contract = /microsoft\s*365\s*licens/i.test(contract.contractName || contract.name || '');
          let csItems = [];
          try { csItems = await fetchContractServicesWithPricing(contract.id); }
          catch (e) { send(`  ⚠ ${cname}: skipping contract "${contract.contractName || contract.id}" — ${e.message}`, 'warn'); continue; }
          for (const cs of csItems) {
            const sId = cs.serviceID ?? cs.id;
            if (sId == null) continue;
            const svcName = await resolveAtServiceName(sId);
            const entry = {
              unitPrice:    cs.unitPrice ?? cs.unitBillingPrice ?? null,
              unitCost:     cs.unitCost  ?? null,
              contractName: contract.contractName || contract.name || '',
              serviceName:  svcName,
            };
            if (!servicePricing.has(sId)) servicePricing.set(sId, entry);
            if (svcName && !pricingByName.has(svcName.toLowerCase())) pricingByName.set(svcName.toLowerCase(), entry);
            if (isM365Contract && !m365Services.has(sId)) m365Services.set(sId, entry);
          }
        }

        if (azItems.length) {
          const pax8AzureCost = azItems.reduce((s, i) => {
            const uCost = Number(i.cost || i.unitCost || 0) || (Number(i.cost_total || i.costTotal || 0) / Math.max(Number(i.quantity || 1), 1));
            return s + uCost * Math.max(Number(i.quantity || 1), 1);
          }, 0);
          let atAzurePrice = null;
          if (azureAtContract) {
            try {
              const azureCS = await fetchContractServicesWithPricing(azureAtContract.id);
              const match = azureCS.find(cs => /azure.*program|program.*azure/i.test(cs.invoiceDescription || '')) || azureCS[0];
              if (match) atAzurePrice = match.unitPrice ?? match.unitBillingPrice ?? null;
            } catch {}
          }
          azureRows.push({ company: cname, pax8Lines: azItems.length, pax8TotalCost: pax8AzureCost, atPrice: atAzurePrice, variance: atAzurePrice != null ? atAzurePrice - pax8AzureCost : null });
        }

        let companyPax8Cost = 0, companyATBilled = 0, companyMismatches = 0, companyUnmapped = 0;
        const usedAtServiceIds = new Set();

        for (const item of regItems) {
          const qty            = Math.max(Number(item.quantity || 1), 1);
          const pax8UnitCost   = Number(item.cost || item.unitCost || 0) || (Number(item.cost_total || item.costTotal || 0) / qty);
          const pax8SuggestedPrice = Number(item.price || 0);
          const itemTotalCost  = pax8UnitCost * qty;
          const productId      = item.product_id || item.productId || item.sku || '';
          const csvEntry       = csvMappings.get(mkProductKey(item)) || csvMappings.get(productId) || csvMappings.get(item.sku || '');
          const atServiceId    = csvEntry?.atServiceId ?? null;

          let atUnitPrice = null;
          let status      = 'unmapped';

          if (atServiceId != null) {
            let pricing = servicePricing.get(atServiceId);
            if (!pricing && csvEntry?.atServiceName) {
              pricing = pricingByName.get(csvEntry.atServiceName.toLowerCase());
            }
            if (!pricing) {
              const normalize = s => s
                .replace(/\s*\[.*?\]/g, '').replace(/\s*\(.*?\)/g, '')
                .replace(/\bNew Commerce Experience\b/gi, '').replace(/\bNCE\b/gi, '')
                .replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
              const descNorm = normalize(item.description || '');
              let bestMatch = null, bestLen = 0;
              for (const [name, p] of pricingByName) {
                const nameNorm = normalize(name);
                if (nameNorm === descNorm) { pricing = p; break; }
                let common = 0;
                while (common < nameNorm.length && common < descNorm.length && nameNorm[common] === descNorm[common]) common++;
                if (common >= 10 && common > bestLen) { bestLen = common; bestMatch = p; }
              }
              if (!pricing && bestMatch) pricing = bestMatch;
            }
            if (pricing) { atUnitPrice = pricing.unitPrice; status = 'matched'; usedAtServiceIds.add(atServiceId); }
            else { status = 'not_in_contract'; }
          }

          const atTotalBilled     = atUnitPrice != null ? atUnitPrice * qty : null;
          const marginPct         = (atUnitPrice != null && atUnitPrice > 0) ? ((atUnitPrice - pax8UnitCost) / atUnitPrice) * 100 : null;
          const totalMarginDollar = atTotalBilled != null ? atTotalBilled - itemTotalCost : null;
          const priceMismatch     = atUnitPrice != null && Math.abs(atUnitPrice - pax8SuggestedPrice) > 0.005;
          const row = { company: cname, sku: item.sku || '', description: item.description || '', qty, pax8UnitCost, pax8TotalCost: itemTotalCost, pax8SuggestedPrice, atUnitPrice, atTotalBilled, marginPct, totalMarginDollar, priceMismatch, status };
          allRows.push(row);

          if (status === 'unmapped' || status === 'not_in_contract') {
            unmappedRows.push({ company: cname, sku: item.sku || '', description: item.description || '', reason: status === 'unmapped' ? 'No product mapping in CSV' : 'Mapped service not found in AT contract' });
            companyUnmapped++;
          }
          if (priceMismatch) { mismatches.push(row); companyMismatches++; }
          companyPax8Cost += itemTotalCost;
          if (atUnitPrice != null) companyATBilled += atUnitPrice * qty;
        }

        for (const [sId, entry] of m365Services) {
          if (!usedAtServiceIds.has(sId)) {
            orphanedAtRows.push({ company: cname, serviceId: sId, serviceName: entry.serviceName || '', unitPrice: entry.unitPrice, contractName: entry.contractName });
          }
        }

        const companyMarginPct = companyATBilled > 0 ? ((companyATBilled - companyPax8Cost) / companyATBilled) * 100 : null;
        companySummaries.push({ company: cname, totalPax8Cost: companyPax8Cost, totalATBilled: companyATBilled, marginPct: companyMarginPct, mismatches: companyMismatches, unmapped: companyUnmapped });

        const mStr = companyMarginPct != null ? ` — ${companyMarginPct.toFixed(1)}% margin` : '';
        const warnStr = companyMismatches ? ` ⚠ ${companyMismatches} price mismatch${companyMismatches > 1 ? 'es' : ''}` : '';
        send(`  ${companyMismatches ? '⚠' : '✓'} ${cname}${mStr}${warnStr}`, companyMismatches ? 'warn' : 'success');
      }

      const totalPax8Cost  = companySummaries.reduce((s, c) => s + c.totalPax8Cost,  0);
      const totalATBilled  = companySummaries.reduce((s, c) => s + c.totalATBilled,  0);
      const totalMarginPct = totalATBilled > 0 ? ((totalATBilled - totalPax8Cost) / totalATBilled) * 100 : null;

      send('────────────────────────────', 'divider');
      send(`Companies: ${companySummaries.length}  |  Mismatches: ${mismatches.length}  |  Unmapped: ${unmappedRows.length}  |  AT Only (no Pax8): ${orphanedAtRows.length}`, (mismatches.length || orphanedAtRows.length) ? 'warn' : 'success');
      if (totalMarginPct != null) send(`Overall margin: ${totalMarginPct.toFixed(1)}%  (Cost $${totalPax8Cost.toFixed(2)} → Billed $${totalATBilled.toFixed(2)})`, totalMarginPct < 10 ? 'warn' : 'success');

      lastMarginExportData = { invoiceId: currentInv.id, invoiceDate: currentInv.invoiceDate, runDate: new Date().toISOString(), allRows, mismatches, azureRows, unmappedRows, noContractRows, orphanedAtRows, companySummaries, totalPax8Cost, totalATBilled, totalMarginPct };
      writeState({ marginLastRun: new Date().toISOString() });

      return { success: true, summary: { companies: companySummaries.length, mismatches: mismatches.length, unmapped: unmappedRows.length, totalPax8Cost, totalATBilled, totalMarginPct } };
    } catch (err) {
      send(`Fatal: ${err.message}`, 'error');
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('export-margin-report', async () => {
    const d = lastMarginExportData;
    if (!d) return { error: 'No analysis data — run the margin analyzer first.' };
    try {
      const ExcelJS  = require('exceljs');
      const filePath = path.join(app.getPath('downloads'), `pax8-margin-report-${d.invoiceDate || new Date().toISOString().slice(0,10)}.xlsx`);
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Pax8 Hub';

      const H_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      const H_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      const BOLD   = { bold: true };
      const G_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      const Y_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
      const O_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFED7AA' } };
      const R_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      const AZ_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };

      function mFill(pct) {
        if (pct == null) return null;
        if (pct >= 20) return G_FILL;
        if (pct >= 10) return Y_FILL;
        if (pct >= 5)  return O_FILL;
        return R_FILL;
      }
      function hdr(ws, cols) {
        const row = ws.addRow(cols.map(c => c.header));
        row.eachCell(cell => { cell.fill = H_FILL; cell.font = H_FONT; cell.alignment = { vertical: 'middle' }; });
        row.height = 20;
        cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.width || 18; });
        ws.views = [{ state: 'frozen', ySplit: 1 }];
        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
      }

      const wsSumm = wb.addWorksheet('Summary');
      wsSumm.getColumn(1).width = 36; wsSumm.getColumn(2).width = 20;
      const t1 = wsSumm.addRow(['Pax8 Margin Analysis Report']);
      t1.getCell(1).font = { bold: true, size: 16 }; wsSumm.mergeCells('A1:B1');
      wsSumm.addRow([]);
      [['Invoice', d.invoiceId], ['Invoice Date', d.invoiceDate], ['Run Date', new Date(d.runDate).toLocaleString()]].forEach(([k, v]) => { const r = wsSumm.addRow([k, v]); r.getCell(1).font = BOLD; });
      wsSumm.addRow([]);
      const r7 = wsSumm.addRow(['Total Pax8 Cost', Number(d.totalPax8Cost)]); r7.getCell(1).font = BOLD; r7.getCell(2).numFmt = '$#,##0.00';
      const r8 = wsSumm.addRow(['Total AT Billed', Number(d.totalATBilled)]); r8.getCell(1).font = BOLD; r8.getCell(2).numFmt = '$#,##0.00';
      const r9 = wsSumm.addRow(['Overall Margin', d.totalMarginPct != null ? d.totalMarginPct / 100 : '']); r9.getCell(1).font = BOLD; r9.getCell(2).numFmt = '0.0%';
      if (d.totalMarginPct != null) { const f = mFill(d.totalMarginPct); if (f) r9.getCell(2).fill = f; }
      const r10 = wsSumm.addRow(['Price Mismatches', d.mismatches.length]); r10.getCell(1).font = BOLD;
      const r11 = wsSumm.addRow(['Unmapped Products', d.unmappedRows.length]); r11.getCell(1).font = BOLD;
      const r11b = wsSumm.addRow(['AT Only (No Pax8)', (d.orphanedAtRows || []).length]); r11b.getCell(1).font = BOLD;
      if ((d.orphanedAtRows || []).length > 0) r11b.getCell(2).fill = R_FILL;
      wsSumm.addRow([]);
      const shRow = wsSumm.addRow(['Company', 'Pax8 Cost', 'AT Billed', 'Margin %', 'Mismatches', 'Unmapped']);
      shRow.eachCell(c => { c.fill = H_FILL; c.font = H_FONT; }); shRow.height = 20;
      [1,2,3,4,5,6].forEach(i => { wsSumm.getColumn(i).width = [36,16,16,12,13,12][i-1]; });
      wsSumm.autoFilter = { from: { row: shRow.number, column: 1 }, to: { row: shRow.number, column: 6 } };
      for (const c of d.companySummaries) {
        const row = wsSumm.addRow([c.company, Number(c.totalPax8Cost), Number(c.totalATBilled), c.marginPct != null ? c.marginPct / 100 : '', c.mismatches, c.unmapped]);
        row.getCell(2).numFmt = '$#,##0.00'; row.getCell(3).numFmt = '$#,##0.00'; row.getCell(4).numFmt = '0.0%';
        if (c.marginPct != null) { const f = mFill(c.marginPct); if (f) row.getCell(4).fill = f; }
      }

      const wsAll = wb.addWorksheet('All Margins');
      hdr(wsAll, [{ header: 'Company', width: 34 }, { header: 'SKU', width: 22 }, { header: 'Product', width: 50 }, { header: 'Qty', width: 8 }, { header: 'Pax8 Unit Cost', width: 16 }, { header: 'Pax8 Total Cost', width: 16 }, { header: 'Pax8 Suggest Price', width: 18 }, { header: 'AT Unit Price', width: 16 }, { header: 'AT Total Billed', width: 16 }, { header: 'Total Margin $', width: 14 }, { header: 'Margin %', width: 12 }, { header: 'Price Match', width: 13 }, { header: 'Status', width: 18 }]);
      for (const r of d.allRows) {
        const row = wsAll.addRow([r.company, r.sku, r.description, r.qty, r.pax8UnitCost != null ? Number(r.pax8UnitCost) : '', r.pax8TotalCost != null ? Number(r.pax8TotalCost) : '', r.pax8SuggestedPrice != null ? Number(r.pax8SuggestedPrice) : '', r.atUnitPrice != null ? Number(r.atUnitPrice) : '', r.atTotalBilled != null ? Number(r.atTotalBilled) : '', r.totalMarginDollar != null ? Number(r.totalMarginDollar) : '', r.marginPct != null ? r.marginPct / 100 : '', r.atUnitPrice != null ? (r.priceMismatch ? 'MISMATCH' : '✓') : 'N/A', r.status]);
        [5,6,7,8,9,10].forEach(n => { if (row.getCell(n).value !== '') row.getCell(n).numFmt = '$#,##0.00'; });
        if (row.getCell(11).value !== '') row.getCell(11).numFmt = '0.0%';
        if (r.marginPct != null) { const f = mFill(r.marginPct); if (f) row.getCell(11).fill = f; }
        if (r.priceMismatch) row.getCell(12).fill = O_FILL;
      }

      const wsMM = wb.addWorksheet('Price Mismatches');
      hdr(wsMM, [{ header: 'Company', width: 34 }, { header: 'SKU', width: 22 }, { header: 'Product', width: 50 }, { header: 'Qty', width: 8 }, { header: 'Pax8 Suggest Price', width: 18 }, { header: 'AT Billed Price', width: 16 }, { header: 'Unit Difference', width: 15 }, { header: 'Total Difference', width: 15 }, { header: 'Pax8 Unit Cost', width: 16 }, { header: 'Pax8 Total Cost', width: 16 }, { header: 'AT Total Billed', width: 16 }, { header: 'Margin %', width: 12 }]);
      for (const r of d.mismatches) {
        const unitDiff = r.atUnitPrice != null ? r.atUnitPrice - r.pax8SuggestedPrice : null;
        const totalDiff = unitDiff != null ? unitDiff * r.qty : null;
        const row = wsMM.addRow([r.company, r.sku, r.description, r.qty, Number(r.pax8SuggestedPrice), r.atUnitPrice != null ? Number(r.atUnitPrice) : '', unitDiff != null ? Number(unitDiff) : '', totalDiff != null ? Number(totalDiff) : '', Number(r.pax8UnitCost), r.pax8TotalCost != null ? Number(r.pax8TotalCost) : '', r.atTotalBilled != null ? Number(r.atTotalBilled) : '', r.marginPct != null ? r.marginPct / 100 : '']);
        [5,6,7,8,9,10,11].forEach(n => { if (row.getCell(n).value !== '') row.getCell(n).numFmt = '$#,##0.00'; });
        if (row.getCell(12).value !== '') row.getCell(12).numFmt = '0.0%';
        row.eachCell(cell => { cell.fill = O_FILL; });
        if (r.marginPct != null) { const f = mFill(r.marginPct); if (f) row.getCell(12).fill = f; }
      }

      const wsAz = wb.addWorksheet('Azure');
      hdr(wsAz, [{ header: 'Company', width: 34 }, { header: 'Pax8 Line Items', width: 16 }, { header: 'Pax8 Total Cost', width: 16 }, { header: 'AT Program Price', width: 18 }, { header: 'Variance', width: 14 }, { header: 'Note', width: 46 }]);
      for (const r of d.azureRows) {
        const row = wsAz.addRow([r.company, r.pax8Lines, Number(r.pax8TotalCost), r.atPrice != null ? Number(r.atPrice) : 'Not found in AT', r.variance != null ? Number(r.variance) : '', 'Price variance expected — Azure billed at monthly actuals']);
        row.eachCell(cell => { cell.fill = AZ_FILL; });
        [3,4,5].forEach(n => { if (typeof row.getCell(n).value === 'number') row.getCell(n).numFmt = '$#,##0.00'; });
      }

      const wsUM = wb.addWorksheet('Not Mapped');
      hdr(wsUM, [{ header: 'Company', width: 34 }, { header: 'SKU', width: 22 }, { header: 'Product', width: 50 }, { header: 'Reason', width: 36 }]);
      for (const r of d.unmappedRows) wsUM.addRow([r.company, r.sku, r.description, r.reason]);

      const wsNC = wb.addWorksheet('No AT Contract');
      hdr(wsNC, [{ header: 'Company', width: 34 }, { header: 'AT Company ID', width: 16 }]);
      for (const r of d.noContractRows) wsNC.addRow([r.company, r.atCompanyId || '']);

      const wsOrph = wb.addWorksheet('AT Only (No Pax8)');
      hdr(wsOrph, [{ header: 'Company', width: 34 }, { header: 'AT Service Name', width: 50 }, { header: 'AT Unit Price', width: 16 }, { header: 'Contract', width: 36 }, { header: 'AT Service ID', width: 16 }, { header: 'Note', width: 50 }]);
      for (const r of (d.orphanedAtRows || [])) {
        const row = wsOrph.addRow([r.company, r.serviceName || '', r.unitPrice != null ? Number(r.unitPrice) : '', r.contractName || '', r.serviceId || '', 'In M365 Licenses contract but no matching active Pax8 subscription']);
        row.eachCell(cell => { cell.fill = R_FILL; });
        if (typeof row.getCell(3).value === 'number') row.getCell(3).numFmt = '$#,##0.00';
      }

      await wb.xlsx.writeFile(filePath);
      shell.openPath(filePath);
      return { success: true };
    } catch (err) {
      console.error('Margin export error:', err);
      return { success: false, error: err.message };
    }
  });
};
