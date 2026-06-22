const fs   = require('fs');
const path = require('path');
const { dialog, shell } = require('electron');
const { USER_DATA, getMainWindow } = require('../shared/state');
const { loadPromptTemplates, DEFAULT_KASEYA_PROMPT_HEADER, firstOfCurrentMonth, lastOfCurrentMonth } = require('../shared/promptTemplates');

// Kaseya settings live in app directory (not userData) — same as original main.js
const KASEYA_SETTINGS_FILE  = path.join(path.resolve(__dirname, '../..'), 'pax8hub-kaseya-settings.json');
const KASEYA_SNAPSHOTS_FILE = path.join(USER_DATA, 'kaseya-snapshots.json');

function loadKaseyaSnapshots() {
  try { return JSON.parse(fs.readFileSync(KASEYA_SNAPSHOTS_FILE, 'utf8')); } catch { return {}; }
}
function saveKaseyaSnapshots(snaps) {
  fs.writeFileSync(KASEYA_SNAPSHOTS_FILE, JSON.stringify(snaps, null, 2));
}

const DEFAULT_KASEYA_SETTINGS = {
  psa:    { strategic: 35, serviceDelivery: 25, admin: 15, coManaged: 25 },
  rmm:    { strategic: 50, serviceDelivery: 50 },
  itGlue: { strategic: 50, serviceDelivery: 35, admin: 15 },
  saas:   { bundledPct: 36 },
  dwp:    { bundledPct: 7 },
};

const KASEYA_QBO = {
  saasStandalone: 'Cost of Services-Recurring Svcs:Managed Cloud Services:Cloud Email Management',
  saasBundled:    'Cost of Services-Recurring Svcs:Managed IT Services:Cloud Email Management-Bundled',
  dwpStandalone:  'Cost of Services-Recurring Svcs:Managed Cloud Services:Cloud File Sync & Share',
  dwpBundled:     'Cost of Services-Recurring Svcs:Managed IT Services:Cloud File Sync & Share-Bundled',
  cloudTools:     'Cloud IT Platform Tools',
  itsTools:       'Cost of Services-Recurring Svcs:Managed IT Services:IT Service Delivery Tools',
  bdr:            'Cost of Services-Recurring Svcs:Managed Backup Services:BDR-Services',
  antivirus:      'Cost of Services-Recurring Svcs:Managed IT Services:AntiVirus Endpoint Protection',
  networking:     'Cost of Services-Recurring Svcs:Managed IT Services:TaaS:Managed Networking Services',
};

function loadKaseyaSettings() {
  if (!fs.existsSync(KASEYA_SETTINGS_FILE)) return JSON.parse(JSON.stringify(DEFAULT_KASEYA_SETTINGS));
  try {
    const s = JSON.parse(fs.readFileSync(KASEYA_SETTINGS_FILE, 'utf8'));
    return {
      psa:    { ...DEFAULT_KASEYA_SETTINGS.psa,    ...(s.psa    || {}) },
      rmm:    { ...DEFAULT_KASEYA_SETTINGS.rmm,    ...(s.rmm    || {}) },
      itGlue: { ...DEFAULT_KASEYA_SETTINGS.itGlue, ...(s.itGlue || {}) },
      saas:   { ...DEFAULT_KASEYA_SETTINGS.saas,   ...(s.saas   || {}) },
      dwp:    { ...DEFAULT_KASEYA_SETTINGS.dwp,    ...(s.dwp    || {}) },
    };
  } catch { return JSON.parse(JSON.stringify(DEFAULT_KASEYA_SETTINGS)); }
}

function buildKaseyaQboEntries(modules, settings) {
  const entries = [];
  const r2 = (v) => Math.round(v * 100) / 100;

  const saas = modules['SaaS Protection']?.total || 0;
  if (saas !== 0) {
    const bundled = r2(saas * settings.saas.bundledPct / 100);
    entries.push({ description: `Datto SaaS – Standalone (${100 - settings.saas.bundledPct}%)`, amount: r2(saas - bundled), account: KASEYA_QBO.saasStandalone, class: '' });
    if (bundled !== 0) entries.push({ description: `Datto SaaS – Bundled (${settings.saas.bundledPct}%)`, amount: bundled, account: KASEYA_QBO.saasBundled, class: '' });
  }

  const dwp = modules['DWP']?.total || 0;
  const dfp = modules['DFP']?.total || 0;
  if (dwp !== 0 || dfp !== 0) {
    const dwpBundled = r2(dwp * settings.dwp.bundledPct / 100);
    entries.push({ description: `DWP + DFP – Standalone (${100 - settings.dwp.bundledPct}%)`, amount: r2((dwp - dwpBundled) + dfp), account: KASEYA_QBO.dwpStandalone, class: '' });
    if (dwpBundled !== 0) entries.push({ description: `DWP – Bundled (${settings.dwp.bundledPct}%)`, amount: dwpBundled, account: KASEYA_QBO.dwpBundled, class: '' });
  }

  const psa = modules['PSA']?.total || 0;
  if (psa !== 0) {
    const { strategic, serviceDelivery, admin, coManaged } = settings.psa;
    entries.push({ description: `PSA – Strategic Services (${strategic}%)`,   amount: r2(psa * strategic / 100),      account: KASEYA_QBO.cloudTools, class: 'Strategic Services' });
    entries.push({ description: `PSA – Service Delivery (${serviceDelivery}%)`, amount: r2(psa * serviceDelivery / 100), account: KASEYA_QBO.cloudTools, class: 'Service Delivery' });
    entries.push({ description: `PSA – Admin (${admin}%)`,                    amount: r2(psa * admin / 100),           account: KASEYA_QBO.cloudTools, class: 'Admin' });
    entries.push({ description: `PSA – Co-Managed (${coManaged}%)`,           amount: r2(psa * coManaged / 100),       account: KASEYA_QBO.cloudTools, class: '' });
  }

  const rmm = modules['RMM']?.total || 0;
  if (rmm !== 0) {
    const { strategic, serviceDelivery } = settings.rmm;
    entries.push({ description: `Datto RMM – Strategic Services (${strategic}%)`,   amount: r2(rmm * strategic / 100),      account: KASEYA_QBO.itsTools, class: 'Strategic Services' });
    entries.push({ description: `Datto RMM – Service Delivery (${serviceDelivery}%)`, amount: r2(rmm * serviceDelivery / 100), account: KASEYA_QBO.itsTools, class: 'Service Delivery' });
  }

  const itGlue = modules['IT Glue']?.total || 0;
  if (itGlue !== 0) {
    const { strategic, serviceDelivery, admin } = settings.itGlue;
    entries.push({ description: `IT Glue – Strategic Services (${strategic}%)`,   amount: r2(itGlue * strategic / 100),      account: KASEYA_QBO.itsTools, class: 'Strategic Services' });
    entries.push({ description: `IT Glue – Service Delivery (${serviceDelivery}%)`, amount: r2(itGlue * serviceDelivery / 100), account: KASEYA_QBO.itsTools, class: 'Service Delivery' });
    entries.push({ description: `IT Glue – Admin (${admin}%)`,                    amount: r2(itGlue * admin / 100),           account: KASEYA_QBO.itsTools, class: 'Admin' });
  }

  const continuity = modules['Cloud Continuity']?.total || 0;
  if (continuity !== 0) entries.push({ description: 'Datto Cloud Continuity', amount: continuity, account: KASEYA_QBO.bdr, class: '' });

  const bcdr = (modules['BCDR']?.total || 0) + (modules['Azure Cloud Siris']?.total || 0);
  if (bcdr !== 0) entries.push({ description: 'Datto BCDR (reconcile separately)', amount: bcdr, account: KASEYA_QBO.bdr, class: '', manual: true });

  const networking = modules['Networking']?.total || 0;
  if (networking !== 0) entries.push({ description: 'Networking (reconcile separately)', amount: networking, account: KASEYA_QBO.networking, class: '', manual: true });

  const av = modules['Antivirus']?.total || 0;
  if (av !== 0) entries.push({ description: 'BitDefender Antivirus', amount: av, account: KASEYA_QBO.antivirus, class: '' });

  const cbNames = ['ConnectBooster', 'Connect Booster', 'Connectbooster', 'connectbooster'];
  for (const name of cbNames) {
    const cb = modules[name]?.total || 0;
    if (cb !== 0) { entries.push({ description: 'ConnectBooster', amount: cb, account: KASEYA_QBO.cloudTools, class: '' }); break; }
  }

  if (modules['Payment']?.total) {
    entries.push({ description: 'Payment/Credit (verify in QB)', amount: modules['Payment'].total, account: KASEYA_QBO.cloudTools, class: '', manual: true });
  }

  const known = new Set(['SaaS Protection', 'DWP', 'DFP', 'PSA', 'RMM', 'IT Glue', 'Cloud Continuity', 'BCDR', 'Azure Cloud Siris', 'Networking', 'Antivirus', 'ConnectBooster', 'Connect Booster', 'Connectbooster', 'connectbooster', 'Payment']);
  for (const [name, data] of Object.entries(modules)) {
    if (!known.has(name) && data.total !== 0) {
      entries.push({ description: `${name} (unclassified — check manually)`, amount: data.total, account: '(unknown)', class: '', manual: true });
    }
  }
  return entries;
}

module.exports = function registerKaseyaProcessor(ipcMain) {
  ipcMain.handle('get-kaseya-settings', () => loadKaseyaSettings());

  ipcMain.handle('save-kaseya-settings', (_, settings) => {
    fs.writeFileSync(KASEYA_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    return { success: true };
  });

  ipcMain.handle('browse-kaseya-xls', async () => {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      title: 'Select Kaseya Invoice',
      filters: [{ name: 'Excel Files', extensions: ['xls', 'xlsx'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return { canceled: true };
    return { filePath: result.filePaths[0] };
  });

  ipcMain.handle('process-kaseya-xls', (_, { filePath }) => {
    try {
      const XLSX = require('xlsx');
      const wb   = XLSX.readFile(filePath, { cellDates: false, raw: false });

      const sheetName = wb.SheetNames.find(n => n === 'Details')
                     || wb.SheetNames.find(n => n === 'Details2')
                     || wb.SheetNames.find(n => /detail/i.test(n))
                     || wb.SheetNames[0];
      if (!sheetName) throw new Error('No sheets found in workbook.');
      const ws = wb.Sheets[sheetName];
      if (!ws['!ref']) throw new Error(`Sheet "${sheetName}" is empty. Available sheets: ${wb.SheetNames.join(', ')}`);

      const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rawRows.length) throw new Error(`No data rows in sheet "${sheetName}".`);

      const rows = rawRows.map(row => {
        const clean = {};
        for (const [k, v] of Object.entries(row)) {
          clean[String(k).trim()] = typeof v === 'string' ? v.trim() : v;
        }
        return clean;
      });

      const sample = rows[0];
      const keys   = Object.keys(sample);
      const findCol = (...candidates) =>
        candidates.find(c => c in sample) ||
        keys.find(k => candidates.some(c => k.toLowerCase().includes(c.toLowerCase())));

      const companyCol      = findCol('Organization (Client) Name', 'Organization', 'Client Name', 'Company Name', 'Company', 'Client');
      const moduleCol       = findCol('Module', 'Product Module', 'Module Name');
      const categoryCol     = findCol('Category', 'Product Category');
      const qtyCol          = findCol('Billed Quantity', 'Quantity', 'Qty', 'Units');
      const licenseUsageCol = findCol('License Usage', 'Licensed Qty', 'License Qty', 'Licenses Used', 'Usage Qty');
      const rateCol         = findCol('Rate', 'Unit Rate', 'Unit Price', 'Price');
      const totalCol        = findCol('Total (Pre-Tax)', 'Total Pre-Tax', 'Monthly Fee', 'Total', 'Amount');
      const descCol         = findCol('Product Description', 'Description', 'Item Description', 'Product Name');
      const productCol      = findCol('Product Item', 'Product', 'Item', 'SKU');
      const svcStartCol     = findCol('Service Period Start Date', 'Start Date', 'Period Start');

      if (!moduleCol) throw new Error(`Cannot find a module column. Columns: ${keys.slice(0, 15).join(', ')}`);
      if (!totalCol)  throw new Error(`Cannot find a total column. Columns: ${keys.slice(0, 15).join(', ')}`);

      const parseNum = v => parseFloat(String(v ?? '').replace(/[$,\s\r\n]/g, '')) || 0;
      const cleanCompany = raw => {
        if (!raw) return '';
        return raw.split(/\s+/).map(w => w.replace(/^[.,\-'"]+|[.,\-'"]+$/g, '')).filter(Boolean).join(' ');
      };

      const fname       = path.basename(filePath, path.extname(filePath));
      const dateMatch   = fname.match(/_(\d{8})_/);
      const invoiceDate = dateMatch ? `${dateMatch[1].slice(0,4)}-${dateMatch[1].slice(4,6)}-${dateMatch[1].slice(6,8)}` : '';
      const billingStart = firstOfCurrentMonth(invoiceDate);
      const billingEnd   = lastOfCurrentMonth(invoiceDate);

      const moduleMap   = new Map();
      const categoryMap = new Map();
      const clientMap   = new Map();

      const workplaceModules = new Set(['DWP', 'DFP']);
      const backupModules    = new Set(['BCDR', 'Cloud Continuity', 'Azure Cloud Siris', 'Networking']);
      const wkProductMap  = new Map();
      const wkUsageMap    = new Map();
      const atProductMap  = new Map();
      const backupModMap  = new Map();
      const netProductMap = new Map();
      const bcdrClientMap = new Map();
      const saasClientMap = new Map();

      for (const row of rows) {
        const company  = cleanCompany(companyCol ? String(row[companyCol] ?? '') : '');
        const module   = String(row[moduleCol] ?? '').trim();
        const category = categoryCol ? String(row[categoryCol] ?? '').trim() : '';
        const product  = productCol  ? String(row[productCol]  ?? '').trim() : '';
        const qty        = parseNum(row[qtyCol]);
        const licenseQty = licenseUsageCol ? parseNum(row[licenseUsageCol]) : 0;
        const rate       = parseNum(row[rateCol]);
        const total    = parseNum(row[totalCol]);

        if (!module) continue;

        if (!moduleMap.has(module)) moduleMap.set(module, { total: 0, qty: 0, lineCount: 0 });
        const mm = moduleMap.get(module);
        mm.total += total; mm.qty += qty; mm.lineCount++;

        if (category) categoryMap.set(category, (categoryMap.get(category) || 0) + total);

        const clientKey = company || '(blank)';
        if (!clientMap.has(clientKey)) clientMap.set(clientKey, { total: 0, totalQty: 0, totalLicQty: 0, modules: new Map() });
        const cm = clientMap.get(clientKey);
        cm.total += total; cm.totalQty += qty; cm.totalLicQty += licenseQty;
        if (!cm.modules.has(module)) cm.modules.set(module, { total: 0, qty: 0 });
        cm.modules.get(module).total += total;
        cm.modules.get(module).qty   += qty;

        if (workplaceModules.has(module)) {
          if (!wkProductMap.has(product)) wkProductMap.set(product, { qty: 0, rates: [], total: 0 });
          const wp = wkProductMap.get(product);
          wp.qty += qty; if (rate > 0) wp.rates.push(rate); wp.total += total;
          if (company) {
            if (!wkUsageMap.has(company)) wkUsageMap.set(company, new Map());
            const cu = wkUsageMap.get(company);
            cu.set(product, (cu.get(product) || 0) + qty);
          }
        }

        if (!company && !workplaceModules.has(module) && !backupModules.has(module)) {
          if (!atProductMap.has(product)) atProductMap.set(product, { qty: 0, rates: [], total: 0 });
          const ap = atProductMap.get(product);
          ap.qty += qty; if (rate > 0) ap.rates.push(rate); ap.total += total;
        }

        if (backupModules.has(module)) {
          if (!backupModMap.has(module)) backupModMap.set(module, { qty: 0, rates: [], total: 0 });
          const bm = backupModMap.get(module);
          bm.qty += qty; if (rate > 0) bm.rates.push(rate); bm.total += total;
          if (module === 'Networking') {
            if (!netProductMap.has(product)) netProductMap.set(product, { qty: 0, rates: [], total: 0 });
            const np = netProductMap.get(product);
            np.qty += qty; if (rate > 0) np.rates.push(rate); np.total += total;
          }
          if (module === 'BCDR' && company) bcdrClientMap.set(company, (bcdrClientMap.get(company) || 0) + total);
        }

        if (module === 'SaaS Protection' && company) saasClientMap.set(company, (saasClientMap.get(company) || 0) + qty);
      }

      const r2      = v => parseFloat(v.toFixed(2));
      const avgRate = arr => arr.length ? r2(arr.reduce((s, r) => s + r, 0) / arr.length) : 0;
      const sortByName = arr => arr.sort((a, b) => {
        if (a.name === '(blank)') return 1;
        if (b.name === '(blank)') return -1;
        return a.name.localeCompare(b.name);
      });

      const modules = {};
      for (const [name, d] of moduleMap) modules[name] = { total: r2(d.total), qty: d.qty, lineCount: d.lineCount };

      const categories = {};
      for (const [name, total] of categoryMap) categories[name] = r2(total);

      const clients = [];
      for (const [name, d] of clientMap) {
        if (d.totalQty === 0 && d.totalLicQty === 0) continue;
        const mods = {};
        for (const [mName, mData] of d.modules) mods[mName] = { total: r2(mData.total), qty: mData.qty };
        clients.push({ name, total: r2(d.total), modules: mods });
      }
      sortByName(clients);

      const ctArray     = clients.map(c => ({ name: c.name, total: c.total }));
      const grandTotal  = r2(clients.reduce((s, c) => s + c.total, 0));

      const workplaceProducts = [...wkProductMap.entries()]
        .map(([name, d]) => ({ name, qty: d.qty, avgRate: avgRate(d.rates), total: r2(d.total) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      const workplaceProductNames = workplaceProducts.map(p => p.name);
      const workplaceUsage = [...wkUsageMap.entries()]
        .map(([client, prods]) => ({ client, products: Object.fromEntries(prods) }))
        .sort((a, b) => a.client.localeCompare(b.client));

      const anchorTools = [...atProductMap.entries()]
        .map(([name, d]) => ({ name, qty: d.qty, avgRate: avgRate(d.rates), total: r2(d.total) }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const backupOrder = ['Azure Cloud Siris', 'BCDR', 'Cloud Continuity', 'Networking'];
      const backupProducts = backupOrder
        .filter(m => backupModMap.has(m))
        .map(name => { const d = backupModMap.get(name); return { name, qty: d.qty, avgRate: avgRate(d.rates), total: r2(d.total) }; });

      const networkingProducts = [...netProductMap.entries()]
        .map(([name, d]) => ({ name, qty: d.qty, avgRate: avgRate(d.rates), total: r2(d.total) }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const bcdrCosts = [...bcdrClientMap.entries()]
        .map(([name, total]) => ({ name, total: r2(total) }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const saasCosts = [...saasClientMap.entries()]
        .map(([name, qty]) => ({ name, qty }))
        .sort((a, b) => a.name.localeCompare(b.name));

      const settings   = loadKaseyaSettings();
      const qboEntries = buildKaseyaQboEntries(modules, settings);

      const snapKey = invoiceDate ? invoiceDate.slice(0, 7) : new Date().toISOString().slice(0, 7);
      const columnsDetectedSnap = { company: companyCol || '(not found)', module: moduleCol, qty: qtyCol, rate: rateCol, total: totalCol };
      try {
        const snaps = loadKaseyaSnapshots();
        snaps[snapKey] = { savedAt: new Date().toISOString(), invoiceDate, fileName: fname, grandTotal, totalLines: rows.length, sheetUsed: sheetName, columnsDetected: columnsDetectedSnap, modules, categories, clients: clients.map(c => ({ name: c.name, total: c.total, modules: c.modules })), qboEntries };
        saveKaseyaSnapshots(snaps);
      } catch (_) { /* non-fatal */ }

      return { success: true, fileName: fname, invoiceDate, billingStart, billingEnd, snapKey, modules, categories, grandTotal, totalLines: rows.length, sheetUsed: sheetName, columnsDetected: { company: companyCol || '(not found)', module: moduleCol, qty: qtyCol, rate: rateCol, total: totalCol }, clients, clientTotals: ctArray, qboEntries, workplaceProducts, workplaceProductNames, workplaceUsage, anchorTools, saasCosts, backupProducts, networkingProducts, bcdrCosts };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('export-kaseya-report', async (_, data) => {
    try {
      const result = await dialog.showSaveDialog(getMainWindow(), {
        title: 'Save Kaseya Report',
        defaultPath: `${data.fileName || 'Kaseya'}.xlsx`,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
      });
      if (result.canceled) return { canceled: true };

      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Anchor Hub';
      wb.created = new Date();

      const ORANGE = 'FFD0641C', ORANGE_L = 'FFFFDDB8', SECTION = 'FF2D4D6B';
      const YELLOW = 'FFFFF3B0', LIGHT_O = 'FFFFDDB8', ROW_ALT = 'FFF7F7F7';
      const r2 = v => Math.round(v * 100) / 100;
      const fill = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
      const fmt$ = '#,##0.00', fmtN = '#,##0';

      const ws4 = wb.addWorksheet('Invoice Summary');
      const s4 = (row, col, val, opts = {}) => {
        const c = ws4.getCell(row, col);
        c.value = val;
        if (opts.bold || opts.white || opts.color) c.font = { bold: !!opts.bold, color: { argb: opts.white ? 'FFFFFFFF' : (opts.color || 'FF000000') } };
        if (opts.numFmt) c.numFmt = opts.numFmt;
        if (opts.fill)   c.fill = fill(opts.fill);
        if (opts.align)  c.alignment = { horizontal: opts.align, vertical: 'middle', wrapText: false };
      };
      const hdrCell = (row, col, val) => s4(row, col, val, { bold: true, fill: ORANGE, white: true, align: 'left' });
      const secCell = (row, col, val) => s4(row, col, val, { bold: true, fill: SECTION, white: true });
      const gtCell  = (row, col, val, numFmt, align) => s4(row, col, val, { bold: true, fill: ORANGE_L, numFmt, align });

      const colW = [35,16,2,35,16,2,35,14,14,16,2,40,14,14,16,2,35,14,14,16];
      colW.forEach((w, i) => { ws4.getColumn(i + 1).width = w; });

      let rowA = 1, rowD = 1, rowG = 1, rowL = 1, rowQ = 1;
      const altFill = (i, ...cells) => { if (i % 2 === 0) cells.forEach(([r, c]) => { ws4.getCell(r, c).fill = fill(ROW_ALT); }); };

      secCell(rowA, 1, 'Totals by Module'); rowA++;
      hdrCell(rowA, 1, 'Module'); hdrCell(rowA, 2, 'Amount'); rowA++;
      const modEntries = Object.entries(data.modules || {}).sort((a, b) => b[1].total - a[1].total);
      let modGT = 0;
      modEntries.forEach(([name, m], i) => {
        s4(rowA, 1, name); s4(rowA, 2, r2(m.total), { numFmt: fmt$ });
        altFill(i, [rowA, 1], [rowA, 2]); modGT += m.total; rowA++;
      });
      gtCell(rowA, 1, 'Grand Total'); gtCell(rowA, 2, r2(modGT), fmt$); rowA++;
      rowA += 1;

      secCell(rowA, 1, 'Totals by Category'); rowA++;
      hdrCell(rowA, 1, 'Category'); hdrCell(rowA, 2, 'Amount'); rowA++;
      const catEntries = Object.entries(data.categories || {}).sort((a, b) => b[1] - a[1]);
      let catGT = 0;
      catEntries.forEach(([name, total], i) => {
        s4(rowA, 1, name); s4(rowA, 2, r2(total), { numFmt: fmt$ });
        altFill(i, [rowA, 1], [rowA, 2]); catGT += total; rowA++;
      });
      gtCell(rowA, 1, 'Grand Total'); gtCell(rowA, 2, r2(catGT), fmt$);

      secCell(rowD, 4, 'TOTAL COSTS BY CLIENT'); rowD++;
      hdrCell(rowD, 4, 'Client'); hdrCell(rowD, 5, 'Amount'); rowD++;
      let clientGT = 0;
      (data.clientTotals || []).forEach((c, i) => {
        s4(rowD, 4, c.name); s4(rowD, 5, r2(c.total), { numFmt: fmt$ });
        altFill(i, [rowD, 4], [rowD, 5]); clientGT += c.total; rowD++;
      });
      gtCell(rowD, 4, 'Grand Total'); gtCell(rowD, 5, r2(clientGT), fmt$);

      secCell(rowG, 7, 'DATTO WORKPLACE COSTS'); rowG++;
      hdrCell(rowG, 7, 'Product'); hdrCell(rowG, 8, 'Qty'); hdrCell(rowG, 9, 'Avg Rate'); hdrCell(rowG, 10, 'Amount'); rowG++;
      const wp = data.workplaceProducts || [];
      let wpQtyT = 0, wpTotT = 0;
      wp.forEach((p, i) => {
        s4(rowG, 7, p.name); s4(rowG, 8, p.qty, { numFmt: fmtN, align: 'right' }); s4(rowG, 9, r2(p.avgRate), { numFmt: fmt$, align: 'right' }); s4(rowG, 10, r2(p.total), { numFmt: fmt$, align: 'right' });
        altFill(i, [rowG,7],[rowG,8],[rowG,9],[rowG,10]); wpQtyT += p.qty; wpTotT += p.total; rowG++;
      });
      gtCell(rowG, 7, 'Grand Total'); gtCell(rowG, 8, wpQtyT, fmtN, 'right'); gtCell(rowG, 10, r2(wpTotT), fmt$, 'right');
      rowG += 2;

      secCell(rowG, 7, 'DATTO WORKPLACE USAGE'); rowG++;
      const wkUsage = data.workplaceUsage || [];
      const wpProdNames = data.workplaceProductNames || [];
      if (wkUsage.length && wpProdNames.length) {
        hdrCell(rowG, 7, 'Client');
        wpProdNames.forEach((pn, i) => hdrCell(rowG, 8 + i, pn)); rowG++;
        wkUsage.forEach(({ client, products }, i) => {
          s4(rowG, 7, client);
          wpProdNames.forEach((pn, j) => { const v = products[pn] || 0; if (v) s4(rowG, 8 + j, v, { numFmt: fmtN, align: 'right' }); });
          if (i % 2 === 0) [7, ...wpProdNames.map((_, j) => 8 + j)].forEach(c => { ws4.getCell(rowG, c).fill = fill(ROW_ALT); });
          rowG++;
        });
      }

      secCell(rowL, 12, 'ANCHOR TOOLS'); rowL++;
      hdrCell(rowL, 12, 'Product'); hdrCell(rowL, 13, 'Qty'); hdrCell(rowL, 14, 'Avg Rate'); hdrCell(rowL, 15, 'Amount'); rowL++;
      const at = data.anchorTools || [];
      let atQtyT = 0, atTotT = 0;
      at.forEach((p, i) => {
        s4(rowL, 12, p.name); s4(rowL, 13, p.qty, { numFmt: fmtN, align: 'right' }); s4(rowL, 14, r2(p.avgRate), { numFmt: fmt$, align: 'right' }); s4(rowL, 15, r2(p.total), { numFmt: fmt$, align: 'right' });
        altFill(i, [rowL,12],[rowL,13],[rowL,14],[rowL,15]); atQtyT += p.qty; atTotT += p.total; rowL++;
      });
      gtCell(rowL, 12, 'Grand Total'); gtCell(rowL, 13, atQtyT, fmtN, 'right'); gtCell(rowL, 15, r2(atTotT), fmt$, 'right');
      rowL += 2;

      secCell(rowL, 12, 'DATTO SAAS COSTS'); rowL++;
      hdrCell(rowL, 12, 'Client'); hdrCell(rowL, 13, 'Qty'); rowL++;
      (data.saasCosts || []).forEach((s, i) => {
        s4(rowL, 12, s.name); s4(rowL, 13, s.qty, { numFmt: fmtN, align: 'right' });
        altFill(i, [rowL,12],[rowL,13]); rowL++;
      });

      secCell(rowQ, 17, 'DATTO BACKUP AND NETWORKING'); rowQ++;
      hdrCell(rowQ, 17, 'Module'); hdrCell(rowQ, 18, 'Qty'); hdrCell(rowQ, 19, 'Avg Rate'); hdrCell(rowQ, 20, 'Amount'); rowQ++;
      const bp = data.backupProducts || [];
      let bpQtyT = 0, bpTotT = 0;
      bp.forEach((p, i) => {
        s4(rowQ, 17, p.name); s4(rowQ, 18, p.qty, { numFmt: fmtN, align: 'right' }); s4(rowQ, 19, r2(p.avgRate), { numFmt: fmt$, align: 'right' }); s4(rowQ, 20, r2(p.total), { numFmt: fmt$, align: 'right' });
        altFill(i, [rowQ,17],[rowQ,18],[rowQ,19],[rowQ,20]); bpQtyT += p.qty; bpTotT += p.total; rowQ++;
      });
      gtCell(rowQ, 17, 'Grand Total'); gtCell(rowQ, 18, bpQtyT, fmtN, 'right'); gtCell(rowQ, 20, r2(bpTotT), fmt$, 'right');
      rowQ += 3;

      secCell(rowQ, 17, 'DATTO NETWORKING'); rowQ++;
      hdrCell(rowQ, 17, 'Product'); hdrCell(rowQ, 18, 'Qty'); hdrCell(rowQ, 19, 'Avg Rate'); hdrCell(rowQ, 20, 'Amount'); rowQ++;
      (data.networkingProducts || []).forEach((p, i) => {
        s4(rowQ, 17, p.name); s4(rowQ, 18, p.qty, { numFmt: fmtN, align: 'right' }); s4(rowQ, 19, r2(p.avgRate), { numFmt: fmt$, align: 'right' }); s4(rowQ, 20, r2(p.total), { numFmt: fmt$, align: 'right' });
        altFill(i, [rowQ,17],[rowQ,18],[rowQ,19],[rowQ,20]); rowQ++;
      });
      rowQ += 2;

      secCell(rowQ, 17, 'DATTO BCDR'); rowQ++;
      hdrCell(rowQ, 17, 'Client'); hdrCell(rowQ, 18, 'Amount'); rowQ++;
      const bcdr = data.bcdrCosts || [];
      let bcdrGT = 0;
      bcdr.forEach((b, i) => {
        s4(rowQ, 17, b.name); s4(rowQ, 18, r2(b.total), { numFmt: fmt$, align: 'right' });
        altFill(i, [rowQ,17],[rowQ,18]); bcdrGT += b.total; rowQ++;
      });
      gtCell(rowQ, 17, 'Grand Total'); gtCell(rowQ, 18, r2(bcdrGT), fmt$, 'right');

      const ws1 = wb.addWorksheet('QBO Entries');
      ws1.columns = [{ width: 50 }, { width: 58 }, { width: 22 }, { width: 14 }];
      const qboHdr = ws1.addRow(['Description', 'QBO Account', 'Class', 'Amount']);
      qboHdr.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      qboHdr.eachCell(c => { c.fill = fill(ORANGE); c.alignment = { vertical: 'middle' }; });
      let qboTotal = 0;
      for (const e of (data.qboEntries || [])) {
        const row = ws1.addRow([e.description, e.account, e.class || '', e.amount]);
        row.getCell(4).numFmt = fmt$;
        if (e.manual) row.eachCell(c => { c.fill = fill(YELLOW); });
        qboTotal += e.amount;
      }
      const totRow = ws1.addRow(['TOTAL', '', '', r2(qboTotal)]);
      totRow.font = { bold: true }; totRow.getCell(4).numFmt = fmt$;
      totRow.eachCell(c => { c.fill = fill(LIGHT_O); });

      await wb.xlsx.writeFile(result.filePath);
      shell.openPath(result.filePath);
      return { success: true, filePath: result.filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('generate-kaseya-at-prompt', (_, data) => {
    try {
      const invoiceRef   = data.fileName || '';
      const billingStart = data.billingStart || firstOfCurrentMonth('');
      const billingEnd   = data.billingEnd   || lastOfCurrentMonth('');
      const templates    = loadPromptTemplates();
      let header = (templates.kaseyaPromptHeader ?? DEFAULT_KASEYA_PROMPT_HEADER)
        .replace(/\{invoiceRef\}/g,    invoiceRef)
        .replace(/\{billingStart\}/g,  billingStart)
        .replace(/\{billingEnd\}/g,    billingEnd)
        .replace(/\{\{BILLING_MONTH_START\}\}/g, billingStart)
        .replace(/\{\{BILLING_MONTH_END\}\}/g,   billingEnd);

      const lines = [header];
      const mods = [
        { key: 'SaaS Protection', label: 'SAAS PROTECTION' },
        { key: 'BCDR',            label: 'BCDR' },
        { key: 'DWP',             label: 'DATTO WORKPLACE (DWP)' },
        { key: 'RMM',             label: 'DATTO RMM' },
        { key: 'Antivirus',       label: 'ANTIVIRUS' },
        { key: 'Cloud Continuity', label: 'CLOUD CONTINUITY' },
      ];
      for (const mod of mods) {
        const clients = (data.clients || []).filter(c => (c.modules[mod.key]?.qty || 0) > 0);
        if (!clients.length) continue;
        lines.push(''); lines.push(`--- ${mod.label} ---`);
        for (const c of clients) {
          const m = c.modules[mod.key];
          lines.push(`Company: ${c.name} — Qty: ${Math.ceil(m.qty)} | Cost: $${m.total.toFixed(2)}`);
        }
      }
      return { prompt: lines.join('\n') };
    } catch (e) { return { prompt: `Error: ${e.message}` }; }
  });

  ipcMain.handle('get-kaseya-snapshots', () => {
    const snaps = loadKaseyaSnapshots();
    return Object.entries(snaps)
      .map(([key, s]) => ({ key, invoiceDate: s.invoiceDate, fileName: s.fileName, grandTotal: s.grandTotal, savedAt: s.savedAt }))
      .sort((a, b) => b.key.localeCompare(a.key));
  });

  ipcMain.handle('delete-kaseya-snapshot', (_, key) => {
    try {
      const snaps = loadKaseyaSnapshots();
      delete snaps[key];
      saveKaseyaSnapshots(snaps);
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('load-kaseya-snapshot', (_, key) => {
    try {
      const snaps = loadKaseyaSnapshots();
      const s = snaps[key];
      if (!s) return { success: false, error: 'Snapshot not found' };
      const clientsSorted = [...(s.clients || [])].sort((a, b) => b.total - a.total);
      return { success: true, fileName: s.fileName || '', invoiceDate: s.invoiceDate || '', grandTotal: s.grandTotal || 0, modules: s.modules || {}, categories: s.categories || {}, clients: s.clients || [], clientTotals: clientsSorted, qboEntries: s.qboEntries || [], totalLines: s.totalLines || 0, sheetUsed: s.sheetUsed || '', columnsDetected: s.columnsDetected || {}, snapKey: key };
    } catch (e) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('compare-kaseya-snapshots', (_, { keyA, keyB }) => {
    try {
      const snaps = loadKaseyaSnapshots();
      const a = snaps[keyA], b = snaps[keyB];
      if (!a) return { error: `Snapshot "${keyA}" not found` };
      if (!b) return { error: `Snapshot "${keyB}" not found` };

      const r2  = v => Math.round(v * 100) / 100;
      const pct = (av, bv) => av !== 0 ? Math.round((bv - av) / Math.abs(av) * 1000) / 10 : null;
      const status = (av, bv) => av === 0 && bv > 0 ? 'new' : bv === 0 && av > 0 ? 'dropped' : bv > av ? 'up' : bv < av ? 'down' : 'same';

      const grandTotal = { a: a.grandTotal, b: b.grandTotal, delta: r2(b.grandTotal - a.grandTotal), pct: pct(a.grandTotal, b.grandTotal) };

      const allModKeys = [...new Set([...Object.keys(a.modules || {}), ...Object.keys(b.modules || {})])].sort();
      const modules = allModKeys.map(name => {
        const av = a.modules[name]?.total || 0, bv = b.modules[name]?.total || 0;
        return { name, a: av, b: bv, delta: r2(bv - av), pct: pct(av, bv), status: status(av, bv) };
      }).filter(m => m.delta !== 0);

      const allCatKeys = [...new Set([...Object.keys(a.categories || {}), ...Object.keys(b.categories || {})])].sort();
      const categories = allCatKeys.map(name => {
        const av = a.categories[name] || 0, bv = b.categories[name] || 0;
        return { name, a: av, b: bv, delta: r2(bv - av), pct: pct(av, bv), status: status(av, bv) };
      }).filter(c => c.delta !== 0);

      const aMap = Object.fromEntries((a.clients || []).map(c => [c.name, c]));
      const bMap = Object.fromEntries((b.clients || []).map(c => [c.name, c]));
      const allNames = [...new Set([...(a.clients || []).map(c => c.name), ...(b.clients || []).map(c => c.name)])].sort();

      const clients = allNames.map(name => {
        const ac = aMap[name], bc = bMap[name];
        const av = ac?.total || 0, bv = bc?.total || 0;
        if (av === bv) return null;
        const aMods = ac?.modules || {}, bMods = bc?.modules || {};
        const allMNames = [...new Set([...Object.keys(aMods), ...Object.keys(bMods)])];
        const modDeltas = allMNames.map(m => {
          const amv = aMods[m]?.total || 0, bmv = bMods[m]?.total || 0;
          const amq = aMods[m]?.qty  || 0, bmq = bMods[m]?.qty  || 0;
          if (amv === bmv && amq === bmq) return null;
          return { name: m, aAmt: amv, bAmt: bmv, deltaAmt: r2(bmv - amv), aQty: amq, bQty: bmq, deltaQty: bmq - amq };
        }).filter(Boolean).sort((x, y) => Math.abs(y.deltaAmt) - Math.abs(x.deltaAmt));
        return { name, a: av, b: bv, delta: r2(bv - av), pct: pct(av, bv), status: status(av, bv), modDeltas };
      }).filter(Boolean).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

      return { keyA, keyB, grandTotal, modules, categories, clients };
    } catch (e) { return { error: e.message }; }
  });
};
