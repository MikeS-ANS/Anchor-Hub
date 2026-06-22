const fs   = require('fs');
const path = require('path');
const { app, dialog, shell } = require('electron');
const { getMainWindow, loadMappings, saveMappingsFile, readState } = require('../shared/state');
const { getPax8Token, pax8Paginate } = require('../shared/pax8');
const { atQuery } = require('../shared/at');
const { parseCSVFull } = require('../shared/csvMappings');
const {
  PROMPT_TEMPLATES_FILE,
  DEFAULT_AZURE_PROMPT_HEADER,
  DEFAULT_SERVICE_PROMPT_HEADER,
  DEFAULT_KASEYA_PROMPT_HEADER,
  loadPromptTemplates,
  firstOfNextMonth, firstOfCurrentMonth, lastOfCurrentMonth,
} = require('../shared/promptTemplates');
const { pax8FetchInvoiceItems } = require('./invoiceMonitor');

const QBO_ACCOUNTS = {
  o365:       { account: 'Cost of Services-Recurring Svcs:Managed Cloud Services:Microsoft Office 365', label: 'Microsoft O365' },
  azure:      { account: 'Cost of Services-Recurring Svcs:Managed Cloud Services:Cloud Infrastructure', label: 'Azure' },
  nerdio:     { account: 'Cost of Services-Recurring Svcs:Managed Cloud Services:Cloud Infrastructure', label: 'Nerdio' },
  exclaimer:  { account: 'Cost of Services-Recurring Svcs:Managed Cloud Services:Cloud Email Management', label: 'Exclaimer' },
  ironscales: { account: 'Cost of Services-Recurring Svcs:Managed Cloud Services:Cloud Email Management', label: 'Ironscales' },
  printix:    { account: 'Cost of Services-Recurring Svcs:Managed Cloud Services:Cloud Other', label: 'Printix' },
  intuit:     { account: 'Cloud IT Platform Tools', label: 'Intuit/QBO' },
  'one-time': { account: '(manual)', label: 'One-Time' },
};

function categorizeInvoiceLine(row) {
  const desc = row.description || '';
  const type = (row.type || '').toLowerCase();
  if (/nerdio/i.test(desc)) return 'nerdio';
  if (/exclaimer/i.test(desc)) return 'exclaimer';
  if (/ironscales/i.test(desc)) return 'ironscales';
  if (/printix/i.test(desc)) return 'printix';
  if (/intuit|quickbooks/i.test(desc)) return 'intuit';
  if (/microsoft azure|azure reserved/i.test(desc)) return 'azure';
  if (type === 'one-time') return 'one-time';
  return 'o365';
}

function normalizeInvoiceItem(item) {
  return {
    company_name:     item.company_name || item.companyName || '',
    company_id:       String(item.company_id || item.companyId || ''),
    type:             item.type || item.chargeType || '',
    description:      item.description || '',
    quantity:         parseFloat(item.quantity) || 0,
    cost:             parseFloat(item.cost ?? item.unitCost) || 0,
    cost_total:       parseFloat(item.cost_total ?? item.costTotal) || 0,
    price:            parseFloat(item.price ?? item.unitPrice) || 0,
    subtotal:         parseFloat(item.subtotal) || 0,
    partner_subtotal: parseFloat(item.partner_subtotal ?? item.costTotal ?? item.cost_total ?? item.partnerSubtotal)
                      || (parseFloat((item.cost ?? item.unitCost) || 0) * parseFloat(item.quantity || 1))
                      || parseFloat(item.total ?? item.amount_due) || 0,
    sku:          item.sku || '',
    invoice_date: item.invoice_date || item.invoiceDate || '',
  };
}

function processInvoiceRows(rows, defaultMarginPct, mappingData) {
  const companyMap = new Map();
  for (const c of (mappingData?.companies || [])) {
    if (c.pax8Id) companyMap.set(c.pax8Id, { atCompanyId: c.atId || null, atCompanyName: c.atName || '' });
  }

  const qboTotals   = { o365: 0, azure: 0, nerdio: 0, exclaimer: 0, ironscales: 0, printix: 0, intuit: 0, 'one-time': 0 };
  const azureMap    = new Map();
  const oneTimeRows = [];
  const serviceMap  = { nerdio: new Map(), exclaimer: new Map(), ironscales: new Map(), printix: new Map(), intuit: new Map() };

  for (const row of rows) {
    const cat = categorizeInvoiceLine(row);
    const amt = row.partner_subtotal;
    if (cat in qboTotals) qboTotals[cat] += amt;

    if (cat === 'azure') {
      const key = row.company_name;
      if (!azureMap.has(key)) azureMap.set(key, { pax8CompanyId: row.company_id, cost: 0 });
      azureMap.get(key).cost += amt;
    } else if (cat === 'one-time') {
      oneTimeRows.push({ company: row.company_name, pax8CompanyId: row.company_id, sku: row.sku, description: row.description, qty: row.quantity, unitCost: row.cost, costTotal: row.cost_total, unitPrice: row.price, subtotal: row.subtotal });
    } else if (cat in serviceMap) {
      const key = row.company_name;
      if (!serviceMap[cat].has(key)) {
        const atInfo = companyMap.get(row.company_id) || {};
        serviceMap[cat].set(key, { qty: 0, atCompanyId: atInfo.atCompanyId || null, atCompanyName: atInfo.atCompanyName || '' });
      }
      serviceMap[cat].get(key).qty += row.quantity;
    }
  }

  const azureArr = Array.from(azureMap.entries()).map(([company, v]) => {
    const atInfo = companyMap.get(v.pax8CompanyId) || {};
    return { company, pax8CompanyId: v.pax8CompanyId,
      atCompanyId: atInfo.atCompanyId || null, atCompanyName: atInfo.atCompanyName || '',
      cost: v.cost, marginPct: defaultMarginPct,
      price: Math.ceil((defaultMarginPct < 100 ? v.cost / (1 - defaultMarginPct / 100) : v.cost) / 5) * 5 };
  }).sort((a, b) => a.company.localeCompare(b.company));

  const buildServiceArr = (map, ceilQty = false) =>
    Array.from(map.entries()).map(([company, v]) => ({
      company, qty: ceilQty ? Math.ceil(v.qty) : v.qty,
      atCompanyId: v.atCompanyId || null, atCompanyName: v.atCompanyName || ''
    })).sort((a, b) => a.company.localeCompare(b.company));

  const total = Object.values(qboTotals).reduce((s, v) => s + v, 0);
  return { qboTotals, total, azureArr, oneTimeRows,
    nerdio: buildServiceArr(serviceMap.nerdio, true), exclaimer: buildServiceArr(serviceMap.exclaimer),
    ironscales: buildServiceArr(serviceMap.ironscales), printix: buildServiceArr(serviceMap.printix),
    intuit: buildServiceArr(serviceMap.intuit) };
}

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
  const wb2 = new Set(nb.split(' ').filter(w => w.length > 2));
  if (!wa.size || !wb2.size) return 0;
  const overlap = [...wa].filter(w => wb2.has(w)).length;
  return (overlap / Math.max(wa.size, wb2.size)) * 0.75;
}

async function findBestAtCompanyMatch(companyName) {
  const term = companyName.replace(/[^a-z0-9\s]/gi, ' ').split(/\s+/).find(w => w.length >= 4) || companyName.substring(0, 10);
  let candidates;
  try {
    candidates = await atQuery('/Companies', [
      { field: 'companyName', op: 'contains', value: term.substring(0, 15) },
      { field: 'isActive',    op: 'eq',       value: true },
    ]);
  } catch { return null; }
  if (!candidates || !candidates.length) return null;
  let best = null, bestScore = 0;
  for (const c of candidates) {
    const s = fuzzyMatchScore(companyName, c.companyName);
    if (s > bestScore) { bestScore = s; best = c; }
  }
  return bestScore >= 0.5 ? { atCompanyId: best.id, atCompanyName: best.companyName, confidence: bestScore } : null;
}

async function autoMatchCompanies(rawRows, mappingData) {
  const mapped   = new Set((mappingData.companies || []).filter(c => c.atId).map(c => c.pax8Id));
  const unmapped = new Map();
  for (const row of rawRows) {
    if (row.company_id && !mapped.has(row.company_id)) unmapped.set(row.company_id, row.company_name);
  }
  if (!unmapped.size) return { autoMapped: [], suggestions: [] };

  const autoMapped = [], suggestions = [];
  for (const [pax8Id, companyName] of unmapped) {
    try {
      const match = await findBestAtCompanyMatch(companyName);
      if (!match) continue;
      if (match.confidence >= 0.85) {
        const data     = loadMappings();
        const existing = data.companies.find(c => c.pax8Id === pax8Id);
        if (existing) { existing.atId = match.atCompanyId; existing.atName = match.atCompanyName; }
        else data.companies.push({ pax8Id, pax8Name: companyName, atId: match.atCompanyId, atName: match.atCompanyName, autoMapped: true });
        saveMappingsFile(data);
        autoMapped.push({ pax8Id, pax8Name: companyName, atCompanyId: match.atCompanyId, atCompanyName: match.atCompanyName, confidence: match.confidence });
      } else {
        suggestions.push({ pax8Id, pax8Name: companyName, atCompanyId: match.atCompanyId, atCompanyName: match.atCompanyName, confidence: match.confidence });
      }
    } catch { /* AT unavailable or match failed */ }
  }
  return { autoMapped, suggestions };
}

module.exports = function registerInvoiceProcessor(ipcMain) {
  ipcMain.handle('get-prompt-templates', () => {
    const saved = loadPromptTemplates();
    return {
      azurePromptHeader:   saved.azurePromptHeader   ?? DEFAULT_AZURE_PROMPT_HEADER,
      servicePromptHeader: saved.servicePromptHeader ?? DEFAULT_SERVICE_PROMPT_HEADER,
      kaseyaPromptHeader:  saved.kaseyaPromptHeader  ?? DEFAULT_KASEYA_PROMPT_HEADER,
    };
  });

  ipcMain.handle('save-prompt-templates', (_, templates) => {
    fs.writeFileSync(PROMPT_TEMPLATES_FILE, JSON.stringify(templates, null, 2), 'utf8');
    return { success: true };
  });

  ipcMain.handle('browse-invoice-csv', async () => {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      title: 'Select Pax8 Invoice CSV',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
      properties: ['openFile'],
    });
    if (result.cancelled || !result.filePaths.length) return { cancelled: true };
    return { filePath: result.filePaths[0] };
  });

  ipcMain.handle('process-invoice-csv', async (_, { filePath, defaultMarginPct = 20 }) => {
    try {
      const raw     = fs.readFileSync(filePath, 'utf8');
      const records = parseCSVFull(raw);
      if (records.length < 2) return { success: false, error: 'CSV has no data rows.' };

      const headers = records[0].map(h => h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''));
      const idx = name => headers.indexOf(name);
      const iCompany = idx('company_name'), iCompanyId = idx('company_id'), iType = idx('type');
      const iDesc = idx('description'), iQty = idx('quantity'), iCost = idx('cost');
      const iCostTotal = idx('cost_total'), iPrice = idx('price'), iSubtotal = idx('subtotal');
      const iPartner = idx('partner_subtotal'), iSku = idx('sku'), iDate = idx('invoice_date');

      const rows = records.slice(1).map(cols => ({
        company_name:    cols[iCompany]   || '',
        company_id:      cols[iCompanyId] || '',
        type:            cols[iType]      || '',
        description:     cols[iDesc]      || '',
        quantity:        parseFloat(cols[iQty])      || 0,
        cost:            parseFloat(cols[iCost])     || 0,
        cost_total:      parseFloat(cols[iCostTotal])|| 0,
        price:           parseFloat(cols[iPrice])    || 0,
        subtotal:        parseFloat(cols[iSubtotal]) || 0,
        partner_subtotal:parseFloat(cols[iPartner])  || 0,
        sku:             iSku  >= 0 ? (cols[iSku]  || '') : '',
        invoice_date:    iDate >= 0 ? (cols[iDate] || '') : '',
      }));

      const invoiceName  = path.basename(filePath, path.extname(filePath));
      const firstDate    = rows.find(r => r.invoice_date)?.invoice_date || '';
      const invoiceDate  = firstDate ? firstDate.split('T')[0] : '';
      const { qboTotals, total, azureArr, oneTimeRows, nerdio, exclaimer, ironscales, printix, intuit } =
        processInvoiceRows(rows, defaultMarginPct, loadMappings());

      return { success: true, invoiceId: invoiceName, invoiceDate, totalLines: rows.length,
        qbo: { o365: qboTotals.o365, azure: qboTotals.azure, nerdio: qboTotals.nerdio,
          exclaimer: qboTotals.exclaimer, ironscales: qboTotals.ironscales, printix: qboTotals.printix,
          intuit: qboTotals.intuit, oneTime: qboTotals['one-time'], total },
        azure: azureArr, oneTime: oneTimeRows, nerdio, exclaimer, ironscales, printix, intuit };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('fetch-pax8-invoice-list', async () => {
    try {
      const token    = await getPax8Token();
      const invoices = await pax8Paginate(token, '/invoices');
      invoices.sort((a, b) => new Date(b.invoiceDate || 0) - new Date(a.invoiceDate || 0));
      return { success: true, invoices: invoices.slice(0, 18).map(inv => {
        const m = (inv.invoiceDate || '').match(/^(\d{4})-(\d{2})/);
        const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const dateLabel = m ? `${MONTHS[parseInt(m[2],10)-1]} ${m[1]}` : (inv.invoiceDate || inv.id);
        const amount = Number(inv.total ?? inv.amount ?? 0);
        return { id: inv.id, invoiceDate: inv.invoiceDate || '', total: inv.total ?? inv.amount ?? null, dateLabel, label: `${dateLabel}  —  $${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` };
      }) };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('process-pax8-invoice', async (_, { invoiceId, invoiceDate, defaultMarginPct = 20 }) => {
    try {
      const token       = await getPax8Token();
      const items       = await pax8FetchInvoiceItems(token, invoiceId);
      const rows        = items.map(normalizeInvoiceItem);
      const mappingData = loadMappings();
      let autoMapped = [], suggestions = [];
      try { ({ autoMapped, suggestions } = await autoMatchCompanies(rows, mappingData)); } catch {}
      const { qboTotals, total, azureArr, oneTimeRows, nerdio, exclaimer, ironscales, printix, intuit } =
        processInvoiceRows(rows, defaultMarginPct, loadMappings());
      return { success: true, invoiceId, invoiceDate, totalLines: rows.length,
        qbo: { o365: qboTotals.o365, azure: qboTotals.azure, nerdio: qboTotals.nerdio,
          exclaimer: qboTotals.exclaimer, ironscales: qboTotals.ironscales, printix: qboTotals.printix,
          intuit: qboTotals.intuit, oneTime: qboTotals['one-time'], total },
        azure: azureArr, oneTime: oneTimeRows, nerdio, exclaimer, ironscales, printix, intuit,
        autoMapped, suggestions };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('ip-confirm-mapping', async (_, { pax8Id, pax8Name, atCompanyId, atCompanyName }) => {
    try {
      const data = loadMappings();
      const existing = data.companies.find(c => c.pax8Id === pax8Id);
      if (existing) { existing.atId = atCompanyId; existing.atName = atCompanyName; }
      else data.companies.push({ pax8Id, pax8Name, atId: atCompanyId, atName: atCompanyName, autoMapped: true });
      saveMappingsFile(data);
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('ip-get-push-log', async () => {
    try { return { success: true, log: readState().invoicePushLog || [] }; }
    catch { return { success: true, log: [] }; }
  });

  ipcMain.handle('export-invoice-breakdown', async (_, data) => {
    try {
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Pax8 Hub';
      wb.created = new Date();

      const ORANGE = 'FFD0641C', WHITE = 'FFFFFFFF', GREEN = 'FFD6F5DD', YELLOW = 'FFFFF8CC';
      const LIGHT_ORANGE = 'FFFFEEDD', LIGHT_RED = 'FFFFD6CC', LIGHT_BLUE = 'FFD6EEFF';
      const LIGHT_PURPLE = 'FFEEDBFF', LIGHT_GREEN = 'FFD6F5DD', LIGHT_TEAL = 'FFD6F5F0';
      const LIGHT_GRAY = 'FFF5F5F5';

      function hdrStyle(fill) {
        return { font: { bold: true, color: { argb: WHITE } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fill || ORANGE } }, alignment: { vertical: 'middle' } };
      }
      function applyHdr(row, fill) { row.eachCell(cell => { cell.style = hdrStyle(fill); }); row.height = 18; }
      function cellFill(argb) { return { type: 'pattern', pattern: 'solid', fgColor: { argb } }; }
      function cur(v) { return { numFmt: '$#,##0.00', value: Math.round(v * 100) / 100 }; }

      const ws1 = wb.addWorksheet('Summary');
      ws1.columns = [{ width: 34 }, { width: 58 }, { width: 16 }];
      applyHdr(ws1.addRow(['Invoice Breakdown Summary', '', '']), ORANGE);
      ws1.mergeCells('A1:C1');
      ws1.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      ws1.addRow([]);
      ws1.addRow(['Invoice ID', data.invoiceId, '']);
      ws1.addRow(['Invoice Date', data.invoiceDate, '']);
      ws1.addRow(['Total Lines', data.totalLines, '']);
      ws1.addRow(['Grand Total (Partner Cost)', '', data.qbo.total]);
      ws1.getCell('C6').numFmt = '$#,##0.00';
      ws1.addRow([]);
      applyHdr(ws1.addRow(['Category', 'QBO Account', 'Amount']), ORANGE);
      const qboRows = [
        ['Microsoft O365', QBO_ACCOUNTS.o365.account, data.qbo.o365],
        ['Azure', QBO_ACCOUNTS.azure.account, data.qbo.azure],
        ['Nerdio', QBO_ACCOUNTS.nerdio.account, data.qbo.nerdio],
        ['Exclaimer', QBO_ACCOUNTS.exclaimer.account, data.qbo.exclaimer],
        ['Ironscales', QBO_ACCOUNTS.ironscales.account, data.qbo.ironscales],
        ['Printix', QBO_ACCOUNTS.printix.account, data.qbo.printix],
        ['Intuit/QBO', QBO_ACCOUNTS.intuit.account, data.qbo.intuit],
        ['One-Time', QBO_ACCOUNTS['one-time'].account, data.qbo.oneTime],
      ];
      qboRows.forEach((r, i) => {
        const row = ws1.addRow(r);
        row.getCell(3).numFmt = '$#,##0.00';
        row.eachCell(cell => { cell.fill = cellFill(i % 2 === 0 ? LIGHT_GRAY : WHITE); });
      });
      const totRow = ws1.addRow(['TOTAL', '', data.qbo.total]);
      totRow.getCell(3).numFmt = '$#,##0.00';
      totRow.font = { bold: true };
      totRow.eachCell(cell => { cell.fill = cellFill('FFFFDDB8'); });

      const ws2 = wb.addWorksheet('Azure per Client');
      ws2.columns = [{ width: 32 }, { width: 28 }, { width: 16 }, { width: 12 }, { width: 16 }];
      applyHdr(ws2.addRow(['Company', 'AT Company', 'Pax8 Cost', 'Margin %', 'Client Price']), ORANGE);
      let azTotal = 0, azPriceTotal = 0;
      (data.azure || []).forEach(row => {
        const price = row.marginPct < 100 ? row.cost / (1 - row.marginPct / 100) : row.cost;
        azTotal += row.cost; azPriceTotal += price;
        const r = ws2.addRow([row.company, row.atCompanyName || '(not mapped)', row.cost, row.marginPct / 100, price]);
        r.getCell(3).numFmt = '$#,##0.00'; r.getCell(4).numFmt = '0.0%'; r.getCell(5).numFmt = '$#,##0.00';
        const fillArgb = row.marginPct >= 20 ? LIGHT_GREEN : row.marginPct >= 10 ? YELLOW : LIGHT_ORANGE;
        r.eachCell(cell => { cell.fill = cellFill(fillArgb); });
      });
      const azTotRow = ws2.addRow(['TOTALS', '', azTotal, '', azPriceTotal]);
      azTotRow.font = { bold: true }; azTotRow.getCell(3).numFmt = '$#,##0.00'; azTotRow.getCell(5).numFmt = '$#,##0.00';
      azTotRow.eachCell(cell => { cell.fill = cellFill('FFFFDDB8'); });

      const ws3 = wb.addWorksheet('One-Time Charges');
      ws3.columns = [{ width: 28 }, { width: 20 }, { width: 32 }, { width: 8 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }];
      applyHdr(ws3.addRow(['Company', 'SKU', 'Description', 'Qty', 'Unit Cost', 'Total Cost', 'Unit Price', 'Total Price']), ORANGE);
      (data.oneTime || []).forEach(row => {
        const r = ws3.addRow([row.company, row.sku, row.description, row.qty, row.unitCost, row.costTotal, row.unitPrice, row.subtotal]);
        [5,6,7,8].forEach(n => r.getCell(n).numFmt = '$#,##0.00');
        r.eachCell(cell => { cell.fill = cellFill(YELLOW); });
      });

      const ws4 = wb.addWorksheet('Service Quantities');
      ws4.columns = [{ width: 32 }, { width: 14 }];
      const svcs = [
        { key: 'nerdio', label: 'Nerdio', fill: LIGHT_BLUE },
        { key: 'exclaimer', label: 'Exclaimer', fill: LIGHT_PURPLE },
        { key: 'ironscales', label: 'Ironscales', fill: LIGHT_ORANGE },
        { key: 'printix', label: 'Printix', fill: LIGHT_TEAL },
        { key: 'intuit', label: 'Intuit/QBO', fill: LIGHT_GREEN },
      ];
      svcs.forEach(svc => {
        const rows = data[svc.key] || [];
        if (!rows.length) return;
        applyHdr(ws4.addRow([svc.label, 'Quantity']), ORANGE);
        rows.forEach(row => { const r = ws4.addRow([row.company, row.qty]); r.eachCell(cell => { cell.fill = cellFill(svc.fill); }); });
        ws4.addRow([]);
      });

      const ws5 = wb.addWorksheet('O365 Detail');
      ws5.columns = [{ width: 32 }, { width: 16 }];
      applyHdr(ws5.addRow(['Company', 'O365 Total']), ORANGE);
      if (data.o365Companies && data.o365Companies.length) {
        data.o365Companies.forEach((row, i) => {
          const r = ws5.addRow([row.company, row.total]);
          r.getCell(2).numFmt = '$#,##0.00';
          r.eachCell(cell => { cell.fill = cellFill(i % 2 === 0 ? LIGHT_GRAY : WHITE); });
        });
      } else {
        ws5.addRow(['O365 total (all companies)', data.qbo.o365]).getCell(2).numFmt = '$#,##0.00';
      }

      const downloadsDir = app.getPath('downloads');
      const safeName = (data.invoiceId || 'invoice').replace(/[^\w\-\.]/g, '_');
      const outPath  = path.join(downloadsDir, `Pax8_Invoice_Breakdown_${safeName}.xlsx`);
      await wb.xlsx.writeFile(outPath);
      await shell.openPath(outPath);
      return { success: true, path: outPath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('generate-at-prompt', (_, data) => {
    try {
      const azure          = data.azure || [];
      const azureServiceId = data.azureServiceId || 110;
      const invoiceId      = data.invoiceId   || '';
      const invoiceDate    = data.invoiceDate || '';
      const effectiveDate  = firstOfNextMonth(invoiceDate);
      const invoiceRef     = `${invoiceId} dated ${invoiceDate}`;

      const templates = loadPromptTemplates();
      let header = (templates.azurePromptHeader ?? DEFAULT_AZURE_PROMPT_HEADER)
        .replace(/\{invoiceRef\}/g, invoiceRef)
        .replace(/\{effectiveDate\}/g, effectiveDate)
        .replace(/\{azureServiceId\}/g, String(azureServiceId));

      const mapped   = azure.filter(r => r.atCompanyId);
      const unmapped = azure.filter(r => !r.atCompanyId);
      const lines = [header];
      for (const row of mapped) {
        const price = Number(row.price ?? 0);
        lines.push('');
        lines.push(`Company: ${row.company} (AT ID: ${row.atCompanyId})`);
        lines.push(`unitCost = $${row.cost.toFixed(2)} | unitPrice = $${price.toFixed(2)}`);
      }
      if (unmapped.length) {
        lines.push(''); lines.push('--- NEEDS MANUAL LOOKUP (no AT mapping) ---');
        for (const row of unmapped) {
          const price = Number(row.price ?? 0);
          lines.push('');
          lines.push(`Company: ${row.company} (AT ID: NOT MAPPED)`);
          lines.push(`unitCost = $${row.cost.toFixed(2)} | unitPrice = $${price.toFixed(2)}`);
        }
      }
      return { prompt: lines.join('\n') };
    } catch (e) { return { prompt: `Error generating prompt: ${e.message}` }; }
  });

  ipcMain.handle('generate-service-prompt', (_, data) => {
    try {
      const invoiceId    = data.invoiceId   || '';
      const invoiceDate  = data.invoiceDate || '';
      const billingStart = firstOfCurrentMonth(invoiceDate);
      const billingEnd   = lastOfCurrentMonth(invoiceDate);
      const invoiceRef   = `${invoiceId} dated ${invoiceDate}`;

      const templates = loadPromptTemplates();
      let header = (templates.servicePromptHeader ?? DEFAULT_SERVICE_PROMPT_HEADER)
        .replace(/\{\{INVOICE_ID\}\}/g,          invoiceId)
        .replace(/\{\{INVOICE_DATE\}\}/g,         invoiceDate)
        .replace(/\{\{BILLING_MONTH_START\}\}/g,  billingStart)
        .replace(/\{\{BILLING_MONTH_END\}\}/g,    billingEnd)
        .replace(/\{invoiceRef\}/g,    invoiceRef)
        .replace(/\{effectiveDate\}/g, billingStart);

      const svcDefs = [
        { key: 'nerdio',     label: 'NERDIO' },
        { key: 'exclaimer',  label: 'EXCLAIMER' },
        { key: 'ironscales', label: 'IRONSCALES' },
        { key: 'printix',    label: 'PRINTIX' },
        { key: 'intuit',     label: 'INTUIT/QBO' },
      ];
      const lines = [header];
      for (const svc of svcDefs) {
        const rows = (data[svc.key] || []).filter(r => r.qty > 0);
        if (!rows.length) continue;
        lines.push(''); lines.push(`--- ${svc.label} ---`);
        for (const row of rows) {
          const atPart = row.atCompanyId ? ` (AT ID: ${row.atCompanyId})` : ' (AT ID: NOT MAPPED)';
          lines.push(`Company: ${row.company}${atPart} — Qty: ${row.qty}`);
        }
      }
      return { prompt: lines.join('\n') };
    } catch (e) { return { prompt: `Error generating service prompt: ${e.message}` }; }
  });
};
