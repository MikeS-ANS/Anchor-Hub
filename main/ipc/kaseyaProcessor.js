const fs   = require('fs');
const path = require('path');
const { dialog, shell } = require('electron');
const { USER_DATA, getMainWindow } = require('../shared/state');
const { loadPromptTemplates, DEFAULT_KASEYA_PROMPT_HEADER, firstOfCurrentMonth, lastOfCurrentMonth } = require('../shared/promptTemplates');
const { loadHubDirectory, saveHubDirectory, buildPlatformLookup, upsertPlatformEntry, upsertKaseyaEntry, setPlatformExcluded,
        getGraphToken, getSpDriveBase, spDownload } = require('../shared/hubDirectory');
const fetch = require('node-fetch');
const { atQuery, atFetch } = require('../shared/at');

// SharePoint: ANSVendors library, /Kaseya/Invoices/{year}/*.xls
const SP_VENDORS_LIB       = 'ANSVendors';
const KASEYA_SP_BASE_PATH  = '/Kaseya/Invoices';

async function spGraphFetch(spPath, opts = {}) {
  const tokenRes  = await getGraphToken();
  const base      = await getSpDriveBase(tokenRes, SP_VENDORS_LIB);
  const fetchOpts = {
    method: opts.method || 'GET',
    headers: { Authorization: `Bearer ${tokenRes.accessToken}`, ...opts.headers },
  };
  if (opts.body !== undefined) fetchOpts.body = opts.body;
  const res = await fetch(`${base}${spPath}`, fetchOpts);
  if (!res.ok) {
    if (res.status === 404) return null;
    const body = await res.text().catch(() => '');
    throw new Error(`SP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// List year subfolders under /Kaseya/Invoices
async function spListYears() {
  const result = await spGraphFetch(`${KASEYA_SP_BASE_PATH}:/children`);
  return (result?.value || [])
    .filter(i => i.folder && /^\d{4}$/.test(i.name))
    .map(i => i.name)
    .sort((a, b) => b.localeCompare(a));
}

// List .xls/.xlsx files inside a year folder
async function spListFiles(year) {
  const result = await spGraphFetch(`${KASEYA_SP_BASE_PATH}/${year}:/children`);
  return (result?.value || [])
    .filter(i => i.file && /\.xls$/i.test(i.name))
    .map(i => ({
      name:          i.name,
      downloadUrl:   i['@microsoft.graph.downloadUrl'] || null,
      driveItemId:   i.id,
      size:          i.size,
      lastModified:  i.lastModifiedDateTime,
    }))
    .sort((a, b) => {
      const da = (a.name.match(/_(\d{8})/) || [])[1] || '';
      const db = (b.name.match(/_(\d{8})/) || [])[1] || '';
      return db.localeCompare(da) || (b.lastModified || '').localeCompare(a.lastModified || '');
    });
}

// Download a file by driveItemId and return a Buffer
async function spDownloadFile(driveItemId) {
  const tokenRes  = await getGraphToken();
  const base      = await getSpDriveBase(tokenRes, SP_VENDORS_LIB);

  // Step 1: fetch item metadata to get a pre-authenticated download URL (no auth on redirect)
  const itemUrl = `${base.replace('/root:', `/items/${driveItemId}`)}`;
  const metaRes = await fetch(itemUrl, {
    headers: { Authorization: `Bearer ${tokenRes.accessToken}` },
  });
  if (!metaRes.ok) throw new Error(`SP file lookup failed: ${metaRes.status}`);
  const meta   = await metaRes.json();
  const dlUrl  = meta['@microsoft.graph.downloadUrl'];
  if (!dlUrl) throw new Error('SharePoint did not return a download URL for this file');

  // Step 2: download binary with retry up to ~31 s to handle intermittent ECONNRESET
  const MAX_ATTEMPTS = 6;
  let lastErr;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    try {
      const res = await fetch(dlUrl);
      if (!res.ok) throw new Error(`SP download ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      lastErr = e;
      if (i < MAX_ATTEMPTS - 1) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
  throw lastErr;
}

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
  workplaceBundles: [],
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
      workplaceBundles: Array.isArray(s.workplaceBundles) ? s.workplaceBundles : [],
    };
  } catch { return JSON.parse(JSON.stringify(DEFAULT_KASEYA_SETTINGS)); }
}

// bundledAmounts: { saas: $, dwp: $ } — actual dollar amounts from bundle overrides/flags.
// saas is 0 at processing time (requires async Revenue file); updated later from renderer.
// dwp is computed from workplaceBundles seat counts × per-seat rate.
function buildKaseyaQboEntries(modules, settings, bundledAmounts = {}) {
  const entries = [];
  const r2 = (v) => Math.round(v * 100) / 100;

  const saas = modules['SaaS Protection']?.total || 0;
  if (saas !== 0) {
    const bundled = r2(bundledAmounts.saas || 0);
    entries.push({ description: 'Datto SaaS – Standalone', amount: r2(saas - bundled), account: KASEYA_QBO.saasStandalone, class: '' });
    if (bundled !== 0) entries.push({ description: 'Datto SaaS – Bundled', amount: bundled, account: KASEYA_QBO.saasBundled, class: '' });
  }

  const dwp = modules['DWP']?.total || 0;
  const dfp = modules['DFP']?.total || 0;
  if (dwp !== 0 || dfp !== 0) {
    const dwpBundled = r2(bundledAmounts.dwp || 0);
    entries.push({ description: 'DWP + DFP – Standalone', amount: r2((dwp - dwpBundled) + dfp), account: KASEYA_QBO.dwpStandalone, class: '' });
    if (dwpBundled !== 0) entries.push({ description: 'DWP – Bundled', amount: dwpBundled, account: KASEYA_QBO.dwpBundled, class: '' });
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
  if (bcdr !== 0) entries.push({ description: 'Datto BCDR', amount: bcdr, account: KASEYA_QBO.bdr, class: '' });

  const networking = modules['Networking']?.total || 0;
  if (networking !== 0) entries.push({ description: 'Networking', amount: networking, account: KASEYA_QBO.networking, class: '' });

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

// ─── Revenue file (ANS-Finance › Managed Service Clients) ────────────────────
const REVENUE_LIB  = 'ANS-Finance';
const REVENUE_PATH = '/Managed%20Service%20Clients/Managed%20Service%20Client%20MSC.xlsx:';
let _revenueCache = null;

async function loadRevenueData() {
  if (_revenueCache) return _revenueCache;
  const tokenRes = await getGraphToken();
  const base = await getSpDriveBase(tokenRes, REVENUE_LIB);

  const metaRes = await fetch(`${base}${REVENUE_PATH}`, {
    headers: { Authorization: `Bearer ${tokenRes.accessToken}` },
  });
  if (!metaRes.ok) throw new Error(`Revenue file not found in ANS-Finance library (${metaRes.status})`);
  const meta = await metaRes.json();
  const dlUrl = meta['@microsoft.graph.downloadUrl'];
  if (!dlUrl) throw new Error('No pre-auth download URL for Revenue file');

  const fileRes = await fetch(dlUrl);
  if (!fileRes.ok) throw new Error(`Revenue file download failed: ${fileRes.status}`);
  const buffer = Buffer.from(await fileRes.arrayBuffer());

  const XLSX = require('xlsx');
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const ws = wb.Sheets['Revenue'];
  if (!ws) throw new Error(`Revenue tab not found (available: ${wb.SheetNames.join(', ')})`);

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const client = String(rows[i][1] || '').trim();
    const seats  = parseInt(rows[i][2], 10);
    if (client && !isNaN(seats) && seats > 0) result.push({ client, includedSeats: seats });
  }
  _revenueCache = result;
  return result;
}

module.exports = function registerKaseyaProcessor(ipcMain) {
  ipcMain.handle('get-kaseya-settings', () => loadKaseyaSettings());

  ipcMain.handle('save-kaseya-settings', (_, settings) => {
    fs.writeFileSync(KASEYA_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    return { success: true };
  });

  // ── SharePoint invoice listing ──────────────────────────────────────────────

  // Returns { ok, years: ['2026','2025',...] }
  ipcMain.handle('kaseya-sp-list-years', async () => {
    try {
      const years = await spListYears();
      return { ok: true, years };
    } catch (e) { return { ok: false, error: e.message, years: [] }; }
  });

  // Returns { ok, files: [{ name, driveItemId, lastModified, size }] }
  ipcMain.handle('kaseya-sp-list-files', async (_, { year }) => {
    try {
      const files = await spListFiles(year);
      return { ok: true, files };
    } catch (e) { return { ok: false, error: e.message, files: [] }; }
  });

  // Download a file from SP by driveItemId and process it — same parsing logic as process-kaseya-xls
  ipcMain.handle('kaseya-sp-process-file', async (_, { driveItemId, fileName }) => {
    try {
      const buf = await spDownloadFile(driveItemId);
      return await processKaseyaBuffer(buf, fileName || 'invoice.xls');
    } catch (e) { return { success: false, error: e.message }; }
  });

// ── Core XLS parser (shared by local file + SP download) ─────────────────────
async function processKaseyaBuffer(buf, fileName) {
  try {
      const XLSX = require('xlsx');
      const wb   = XLSX.read(buf, { cellDates: false, raw: false });

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
        let s = raw.replace(/\s*-\s*evergreen\s*$/i, '').trim();
        return s.split(/\s+/).map(w => w.replace(/^[.,\-'"]+|[.,\-'"]+$/g, '')).filter(Boolean).join(' ');
      };

      const fname       = path.basename(fileName, path.extname(fileName));
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
      const blankModuleRows  = [];
      let   blankCategoryCount = 0;

      for (const row of rows) {
        const company  = cleanCompany(companyCol ? String(row[companyCol] ?? '') : '');
        let   module   = String(row[moduleCol] ?? '').trim().replace(/\s*-\s*evergreen\s*$/i, '');
        const category = categoryCol ? String(row[categoryCol] ?? '').trim().replace(/\s*-\s*evergreen\s*$/i, '') : '';
        const product  = productCol  ? String(row[productCol]  ?? '').trim().replace(/\s*-\s*evergreen\s*$/i, '') : '';
        const desc     = descCol     ? String(row[descCol]     ?? '').trim() : '';
        const qty        = parseNum(row[qtyCol]);
        const licenseQty = licenseUsageCol ? parseNum(row[licenseUsageCol]) : 0;
        const rate       = parseNum(row[rateCol]);
        const total    = parseNum(row[totalCol]);

        // Hard-coded fallbacks for rows where Kaseya leaves Module blank
        if (!module) {
          const sig = (desc + ' ' + product).toLowerCase();
          if (/connectbooster/.test(sig))              module = 'Payment';
          else if (/shipping/.test(sig))               module = 'Shipping';
          else if (/bitdefender|antivirus/.test(sig))  module = 'Antivirus';
        }

        if (!module) {
          blankModuleRows.push({ company: company || '(no company)', desc: desc || product || '(unknown)', total });
          continue;
        }

        if (!category) blankCategoryCount++;

        if (!moduleMap.has(module)) moduleMap.set(module, { total: 0, qty: 0, lineCount: 0 });
        const mm = moduleMap.get(module);
        mm.total += total; mm.qty += qty; mm.lineCount++;

        if (category) categoryMap.set(category, (categoryMap.get(category) || 0) + total);

        const clientKey = company || '(blank)';
        if (!clientMap.has(clientKey)) clientMap.set(clientKey, { total: 0, totalQty: 0, totalLicQty: 0, modules: new Map(), productItems: new Map() });
        const cm = clientMap.get(clientKey);
        cm.total += total; cm.totalQty += qty; cm.totalLicQty += licenseQty;
        if (!cm.modules.has(module)) cm.modules.set(module, { total: 0, qty: 0, licenseQty: 0 });
        cm.modules.get(module).total      += total;
        cm.modules.get(module).qty        += qty;
        cm.modules.get(module).licenseQty += licenseQty;
        const productKey = product || desc || module;
        if (!cm.productItems.has(productKey)) cm.productItems.set(productKey, { total: 0, qty: 0, licenseQty: 0, module });
        cm.productItems.get(productKey).total      += total;
        cm.productItems.get(productKey).qty        += qty;
        cm.productItems.get(productKey).licenseQty += licenseQty;

        if (workplaceModules.has(module)) {
          if (!wkProductMap.has(product)) wkProductMap.set(product, { qty: 0, rates: [], total: 0 });
          const wp = wkProductMap.get(product);
          wp.qty += qty; if (rate > 0) wp.rates.push(rate); wp.total += total;
          if (company) {
            if (!wkUsageMap.has(company)) wkUsageMap.set(company, new Map());
            const cu = wkUsageMap.get(company);
            // DWP/DFP seat count is in Billed Quantity; License Usage is a fallback
            cu.set(product, (cu.get(product) || 0) + (licenseQty || qty));
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

        if (module === 'SaaS Protection' && company) saasClientMap.set(company, (saasClientMap.get(company) || 0) + licenseQty);
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
        if (d.total === 0 && d.totalQty === 0 && d.totalLicQty === 0) continue;
        const mods = {};
        for (const [mName, mData] of d.modules) mods[mName] = { total: r2(mData.total), qty: mData.qty, licenseQty: mData.licenseQty || 0 };
        const prods = {};
        for (const [pName, pData] of d.productItems) prods[pName] = { total: r2(pData.total), qty: pData.qty, licenseQty: pData.licenseQty || 0, module: pData.module };
        clients.push({ name, total: r2(d.total), modules: mods, productItems: prods });
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

      const settings = loadKaseyaSettings();

      // Compute DWP/DFP bundled amount: bundledSeats × avg rate per product from this invoice
      const wpRateMap = new Map(workplaceProducts.map(p => [p.name, p.avgRate]));
      const dwpBundledAmt = r2((settings.workplaceBundles || []).reduce((s, b) => {
        const rate = wpRateMap.get(b.product) || 0;
        return s + (b.bundledSeats || 0) * rate;
      }, 0));

      // saas bundled amount starts at 0 — renderer updates it after loading Revenue SP file
      const qboEntries = buildKaseyaQboEntries(modules, settings, { saas: 0, dwp: dwpBundledAmt });

      const snapKey = invoiceDate ? invoiceDate.slice(0, 7) : new Date().toISOString().slice(0, 7);
      const columnsDetectedSnap = { company: companyCol || '(not found)', module: moduleCol, qty: qtyCol, rate: rateCol, total: totalCol };
      try {
        const snaps = loadKaseyaSnapshots();
        snaps[snapKey] = { savedAt: new Date().toISOString(), invoiceDate, fileName: fname, grandTotal, totalLines: rows.length, sheetUsed: sheetName, columnsDetected: columnsDetectedSnap, modules, categories, clients: clients.map(c => ({ name: c.name, total: c.total, modules: c.modules })), qboEntries };
        saveKaseyaSnapshots(snaps);
      } catch (_) { /* non-fatal */ }

      // Enrich clients with AT company data from the central hub
      try {
        const hub = await loadHubDirectory();
        if (hub) {
          const lookup = buildPlatformLookup(hub, 'kaseya');
          for (const c of clients) {
            const match = lookup.get((c.name || '').toLowerCase().trim());
            if (match) { c.atId = match.atId; c.atName = match.atName; }
          }
        }
      } catch (_) { /* non-fatal — continue without AT enrichment */ }

      return { success: true, fileName: fname, invoiceDate, billingStart, billingEnd, snapKey, modules, categories, grandTotal, totalLines: rows.length, sheetUsed: sheetName, columnsDetected: { company: companyCol || '(not found)', module: moduleCol, qty: qtyCol, rate: rateCol, total: totalCol }, clients, clientTotals: ctArray, qboEntries, workplaceProducts, workplaceProductNames, workplaceUsage, anchorTools, saasCosts, backupProducts, networkingProducts, bcdrCosts, blankModuleRows, blankCategoryCount };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

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

  // Download + process two SP files and diff them (no local snapshot required)
  ipcMain.handle('compare-kaseya-sp-files', async (_, { idA, nameA, idB, nameB }) => {
    try {
      const [bufA, bufB] = await Promise.all([spDownloadFile(idA), spDownloadFile(idB)]);
      const [resA, resB] = await Promise.all([
        processKaseyaBuffer(bufA, nameA || 'invoice_a.xls'),
        processKaseyaBuffer(bufB, nameB || 'invoice_b.xls'),
      ]);
      if (!resA.success) return { error: `File A: ${resA.error}` };
      if (!resB.success) return { error: `File B: ${resB.error}` };

      const a = resA, b = resB;
      const r2     = v => Math.round(v * 100) / 100;
      const pct    = (av, bv) => av !== 0 ? Math.round((bv - av) / Math.abs(av) * 1000) / 10 : null;
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
      const allNames = [...new Set([...(a.clients || []).map(c => c.name), ...(b.clients || []).map(c => c.name)])]
        .filter(n => n && n !== '(blank)').sort();
      const clients = allNames.map(name => {
        const ac = aMap[name], bc = bMap[name];
        const av = ac?.total || 0, bv = bc?.total || 0;
        const aProds = ac?.productItems || {}, bProds = bc?.productItems || {};
        const allPNames = [...new Set([...Object.keys(aProds), ...Object.keys(bProds)])];
        // Compute productDeltas first — includes usage-qty changes even when dollar total is unchanged
        const productDeltas = allPNames.map(p => {
          const apv  = aProds[p]?.total      || 0, bpv  = bProds[p]?.total      || 0;
          const apq  = aProds[p]?.qty        || 0, bpq  = bProds[p]?.qty        || 0;
          const aplq = aProds[p]?.licenseQty || 0, bplq = bProds[p]?.licenseQty || 0;
          const mod  = bProds[p]?.module || aProds[p]?.module || '';
          if (apv === bpv && apq === bpq && aplq === bplq) return null;
          return { name: p, module: mod, aAmt: apv, bAmt: bpv, deltaAmt: r2(bpv - apv), aQty: apq, bQty: bpq, deltaQty: bpq - apq, aLicQty: aplq, bLicQty: bplq, deltaLicQty: bplq - aplq };
        }).filter(Boolean).sort((x, y) => Math.abs(y.deltaAmt) - Math.abs(x.deltaAmt));
        // Skip only if truly nothing changed
        if (av === bv && !productDeltas.length) return null;
        return { name, status: status(av, bv), productDeltas };
      }).filter(Boolean).sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));

      // Use invoice dates as display labels (fall through to file name if absent)
      const labelA = a.invoiceDate ? new Date(a.invoiceDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : (a.fileName || nameA);
      const labelB = b.invoiceDate ? new Date(b.invoiceDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : (b.fileName || nameB);

      // keyA/keyB are used by kpRenderDelta as display labels when snaps array is empty
      return { keyA: labelA, keyB: labelB, grandTotal, modules, categories, clients };
    } catch (e) { return { error: e.message }; }
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

  ipcMain.handle('load-kaseya-snapshot', async (_, key) => {
    try {
      const snaps = loadKaseyaSnapshots();
      const s = snaps[key];
      if (!s) return { success: false, error: 'Snapshot not found' };
      const clients = (s.clients || []).map(c => ({ ...c }));
      // Re-enrich clients from hub on every load (mappings may have been confirmed after snapshot was saved)
      try {
        const hub = await loadHubDirectory();
        if (hub) {
          const lookup = buildPlatformLookup(hub, 'kaseya');
          for (const c of clients) {
            const match = lookup.get((c.name || '').toLowerCase().trim());
            if (match) { c.atId = match.atId; c.atName = match.atName; }
          }
        }
      } catch (_) { /* non-fatal */ }
      const clientsSorted = [...clients].sort((a, b) => b.total - a.total);
      return { success: true, fileName: s.fileName || '', invoiceDate: s.invoiceDate || '', grandTotal: s.grandTotal || 0, modules: s.modules || {}, categories: s.categories || {}, clients, clientTotals: clientsSorted, qboEntries: s.qboEntries || [], totalLines: s.totalLines || 0, sheetUsed: s.sheetUsed || '', columnsDetected: s.columnsDetected || {}, snapKey: key };
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

  // ── Kaseya → AT company bulk matching ───────────────────────────────────────

  // Cache to avoid hammering AT API on every re-render (30 min TTL)
  let _atCompCache = null;
  let _atCompCacheAt = 0;

  async function getAllAtCompanies() {
    if (_atCompCache && (Date.now() - _atCompCacheAt) < 30 * 60 * 1000) return _atCompCache;
    const raw = await atQuery('/Companies', [{ field: 'isActive', op: 'eq', value: true }]);
    _atCompCache = (raw || []).map(c => ({ atId: c.id, atName: c.companyName }));
    _atCompCacheAt = Date.now();
    return _atCompCache;
  }

  function normalizeOrgName(name) {
    return (name || '')
      .toLowerCase()
      .replace(/\s*,?\s*(inc\.?|llc\.?|ltd\.?|corp\.?|corporation\.?|l\.p\.?|lp)\.?\s*$/i, '')
      .replace(/^the\s+/i, '')
      .replace(/&/g, 'and')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function tokenJaccard(a, b) {
    const ta = new Set(a.split(' ').filter(Boolean));
    const tb = new Set(b.split(' ').filter(Boolean));
    if (!ta.size && !tb.size) return 1;
    let inter = 0;
    for (const t of ta) if (tb.has(t)) inter++;
    return inter / (ta.size + tb.size - inter);
  }

  function findBestAtMatch(kaseyaName, atCompanies) {
    const normK = normalizeOrgName(kaseyaName);
    let best = null, bestScore = 0;
    for (const co of atCompanies) {
      const normA = normalizeOrgName(co.atName);
      if (normK === normA) return { ...co, score: 1.0 };
      let score = tokenJaccard(normK, normA);
      // Boost when one name fully contains the other (after normalization)
      if (normK && normA && (normK.includes(normA) || normA.includes(normK))) {
        score = Math.max(score, 0.80);
      }
      if (score > bestScore) { bestScore = score; best = { ...co, score }; }
    }
    return bestScore >= 0.55 ? best : null;
  }

  // Bulk-suggest AT matches for a list of Kaseya org names.
  // Uses all active AT companies (cached). Returns { [kaseyaName]: { atId, atName, score } }.
  ipcMain.handle('kaseya-bulk-suggest', async (_, { names }) => {
    try {
      const atCompanies = await getAllAtCompanies();
      const suggestions = {};
      for (const name of (names || [])) {
        const match = findBestAtMatch(name, atCompanies);
        if (match) suggestions[name] = { atId: match.atId, atName: match.atName, score: match.score };
      }
      return { ok: true, suggestions };
    } catch (e) { return { ok: false, suggestions: {}, error: e.message }; }
  });

  // ── Kaseya → AT company mapping ──────────────────────────────────────────────

  // Confirm a single Kaseya org → AT match.
  ipcMain.handle('kaseya-confirm-match', async (_, { kaseyaName, atId, atName }) => {
    try {
      let hub = await loadHubDirectory();
      if (!hub) hub = { _version: 2, _updated: new Date().toISOString(), companies: [] };
      upsertKaseyaEntry(hub, atId, atName, kaseyaName, { name: kaseyaName, confidence: 1.0, confirmedAt: new Date().toISOString() });
      await saveHubDirectory(hub);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // Confirm multiple matches in a single read→modify all→write to avoid SP eventual-consistency races.
  ipcMain.handle('kaseya-bulk-confirm-matches', async (_, { matches }) => {
    try {
      let hub = await loadHubDirectory();
      if (!hub) hub = { _version: 2, _updated: new Date().toISOString(), companies: [] };
      const now = new Date().toISOString();
      for (const { kaseyaName, atId, atName } of (matches || [])) {
        upsertKaseyaEntry(hub, atId, atName, kaseyaName, { name: kaseyaName, confidence: 1.0, confirmedAt: now });
      }
      await saveHubDirectory(hub);
      return { ok: true, count: matches.length };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // Exclude a Kaseya org from matching (handles both array and legacy single formats).
  ipcMain.handle('kaseya-set-excluded', async (_, { kaseyaName, excluded }) => {
    try {
      let hub = await loadHubDirectory();
      if (!hub) hub = { _version: 2, _updated: new Date().toISOString(), companies: [] };
      const norm = s => (s || '').toLowerCase().trim();
      for (const entry of (hub.companies || [])) {
        const k = entry.platforms?.kaseya;
        if (!k) continue;
        const items = Array.isArray(k) ? k : [k];
        const item = items.find(i => norm(i.name) === norm(kaseyaName));
        if (item) {
          if (excluded) item.excluded = true;
          else delete item.excluded;
          hub._updated = new Date().toISOString();
          break;
        }
      }
      await saveHubDirectory(hub);
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  });

  // Search AT companies by name (for the match UI).
  ipcMain.handle('kaseya-search-at-companies', async (_, { query }) => {
    if (!query || query.trim().length < 3) return [];
    try {
      const companies = await atQuery('/Companies', [
        { field: 'companyName', op: 'contains', value: query.trim().substring(0, 20) },
        { field: 'isActive',    op: 'eq',       value: true },
      ]);
      return (companies || []).slice(0, 15).map(c => ({ atId: c.id, atName: c.companyName }));
    } catch { return []; }
  });

  // Load all current Kaseya→AT mappings for admin display.
  ipcMain.handle('kaseya-load-mappings', async () => {
    try {
      const hub = await loadHubDirectory();
      if (!hub) return { mappings: {}, excluded: {} };
      const mappings = {}, excluded = {};
      for (const entry of (hub.companies || [])) {
        if (entry.excluded) continue;
        const k = entry.platforms?.kaseya;
        if (!k) continue;
        const items = Array.isArray(k) ? k : [k];
        for (const item of items) {
          if (!item?.name) continue;
          if (item.excluded) excluded[item.name] = true;
          else mappings[item.name] = { atId: entry.atId, atName: entry.atName, confidence: item.confidence, confirmedAt: item.confirmedAt };
        }
      }
      return { mappings, excluded };
    } catch (e) { return { mappings: {}, excluded: {}, error: e.message }; }
  });

  // ── AT Contract Push helpers ──────────────────────────────────────────────────

  function kpFirstOfThisMonth() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  }
  function kpFirstOfNextMonth() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
  }

  // Find the most-recent active contract whose name contains contractKeyword
  async function kpFindContract(companyId, contractKeyword) {
    const all = await atQuery('/Contracts', [
      { field: 'companyID', op: 'eq', value: parseInt(companyId, 10) },
      { field: 'status',    op: 'eq', value: 1 },
    ]);
    const kw = (contractKeyword || '').toLowerCase().trim();
    const eligible = all
      .filter(c => !kw || (c.contractName || '').toLowerCase().includes(kw))
      .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    return eligible[0] || null;
  }

  // Find a service ID by name (exact match, case-insensitive, cached per session)
  const _kpServiceIdCache = new Map();
  async function kpGetServiceId(serviceName) {
    const key = serviceName.toLowerCase().trim();
    if (_kpServiceIdCache.has(key)) return _kpServiceIdCache.get(key);
    const results = await atQuery('/Services', [{ field: 'name', op: 'eq', value: serviceName }]);
    const id = results[0]?.id ?? null;
    _kpServiceIdCache.set(key, id);
    return id;
  }

  async function kpFindContractService(contractId, serviceId) {
    const rows = await atQuery('/ContractServices', [
      { field: 'contractID', op: 'eq', value: contractId },
      { field: 'serviceID',  op: 'eq', value: serviceId },
    ]);
    return rows[0] || null;
  }

  async function kpGetCurrentUnits(contractServiceId) {
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

  // Hard-coded product item → AT service ID mapping (no user config needed)
  const KASEYA_AT_MAP = {
    'DWP Metered Plan - User License':     [{ serviceId: 58,  contracts: ['Managed Cloud Services'] }],
    'DWP Metered Plan - Server License':   [{ serviceId: 111, contracts: ['Managed Cloud Services'] }],
    'DWP Unlimited Plan - Server License': [{ serviceId: 126, contracts: ['Managed Cloud Services'] }],
    'DWP Unlimited Plan - User License':   [{ serviceId: 125, contracts: ['Managed Cloud Services'] }],
    'DFP Unlimited Plan - Server License': [{ serviceId: 253, contracts: ['Managed Cloud Services'] }],
    'SaaS Protection Infinite Cloud Retention Monthly': [
      { serviceId: 98, contracts: ['Managed Cloud Services', 'Managed Security Services'] },
      { serviceId: 88, contracts: ['Managed Cloud Services', 'Managed Security Services'] },
    ],
  };

  async function kpPushOneService(companyId, contractKeyword, serviceIdOrName, newQty) {
    const contract = await kpFindContract(companyId, contractKeyword);
    if (!contract) return { status: 'no_contract', detail: `No "${contractKeyword}" contract` };

    const serviceId = typeof serviceIdOrName === 'number' ? serviceIdOrName : await kpGetServiceId(serviceIdOrName);
    if (!serviceId) return { status: 'no_service', detail: `Service "${serviceIdOrName}" not found in AT catalog` };

    let cs = await kpFindContractService(contract.id, serviceId);
    if (!cs) {
      // If pushing 0, no need to create a service line that doesn't exist
      if (newQty === 0) return { status: 'no_change', detail: 'Service not on contract (already at 0)' };
      try {
        const svcRes = await atFetch(`/Services/${serviceId}`);
        const svcData = svcRes.item || svcRes;
        const body = { contractID: contract.id, serviceID: serviceId, startDate: contract.startDate, endDate: contract.endDate || null, unitPrice: svcData.unitPrice ?? 0, unitCost: 0 };
        const r = await atFetch('/ContractServices', { method: 'POST', body: JSON.stringify(body) });
        const newId = r.itemId ?? r.item?.id ?? r.id;
        if (!newId) throw new Error('No ID returned');
        cs = { id: newId, contractID: contract.id, serviceID: serviceId };
      } catch (e) {
        return { status: 'no_service', detail: `Could not create service line: ${e.message}` };
      }
    }

    const currentQty = await kpGetCurrentUnits(cs.id);
    const unitChange = newQty - currentQty;
    if (unitChange === 0) return { status: 'no_change', detail: `Already at ${currentQty}` };

    const effectiveDate = kpFirstOfThisMonth();
    const payload = { contractID: contract.id, contractServiceID: cs.id, effectiveDate, unitChange };
    try {
      await atFetch('/ContractServiceAdjustments', { method: 'POST', body: JSON.stringify(payload) });
      return { status: 'success', detail: `${unitChange > 0 ? '+' : ''}${unitChange} (${currentQty}→${newQty})` };
    } catch (e) {
      const msg = (e.message || '').toLowerCase();
      if (msg.includes('effectivedate must be between') || msg.includes('effective date must be between')) {
        const next = (await atQuery('/Contracts', [
          { field: 'companyID', op: 'eq', value: parseInt(companyId, 10) },
          { field: 'status', op: 'eq', value: 1 },
        ])).filter(c => c.id !== contract.id && (c.contractName || '').toLowerCase().includes((contractKeyword || '').toLowerCase()) && new Date(c.startDate) > new Date(contract.startDate))
           .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))[0];
        if (!next) throw new Error('Contract rollover: no next contract found');
        const nextCs = await kpFindContractService(next.id, serviceId);
        if (!nextCs) throw new Error('Contract rollover: service not on next contract');
        await atFetch('/ContractServiceAdjustments', { method: 'POST', body: JSON.stringify({ ...payload, contractID: next.id, contractServiceID: nextCs.id }) });
        return { status: 'success', detail: `Rolled to next contract · ${unitChange > 0 ? '+' : ''}${unitChange} (${currentQty}→${newQty})` };
      }
      if (msg.includes('negative')) return { status: 'negative_qty', detail: `Would go negative (current: ${currentQty}, change: ${unitChange})` };
      throw e;
    }
  }

  // Push Datto Workplace + DFP usage to AT contracts (hard-coded service IDs)
  ipcMain.handle('kaseya-at-push-workplace', async (_, { rows }) => {
    const mainWindow = getMainWindow();
    const emit = (company, product, status, detail = '') => {
      if (mainWindow) mainWindow.webContents.send('kaseya-push-progress', { company, product, status, detail });
    };

    const results = [];
    for (const row of rows) {
      if (!row.atId) continue;
      for (const [product, qty] of Object.entries(row.products || {})) {
        const mapping = KASEYA_AT_MAP[product];
        if (!mapping) {
          emit(row.name, product, 'no_service', `No AT mapping for "${product}"`);
          results.push({ company: row.name, product, status: 'no_service', detail: `No AT mapping for "${product}"` });
          continue;
        }
        emit(row.name, product, 'working');
        try {
          const { serviceId, contracts } = mapping[0];
          const r = await kpPushOneService(row.atId, contracts[0], serviceId, qty);
          emit(row.name, product, r.status, r.detail);
          results.push({ company: row.name, product, ...r });
        } catch (e) {
          emit(row.name, product, 'error', e.message);
          results.push({ company: row.name, product, status: 'error', detail: e.message });
        }
      }
    }
    const summary = {
      updated: results.filter(r => r.status === 'success').length,
      skipped: results.filter(r => ['no_change', 'no_contract', 'no_service', 'negative_qty'].includes(r.status)).length,
      errors:  results.filter(r => r.status === 'error').length,
    };
    return { results, summary };
  });

  // Push Datto SaaS Protection license counts to AT contracts (hard-coded service IDs 98 + 88)
  ipcMain.handle('kaseya-at-push-saas', async (_, { rows }) => {
    const mainWindow = getMainWindow();
    const emit = (company, product, status, detail = '') => {
      if (mainWindow) mainWindow.webContents.send('kaseya-push-progress', { company, product, status, detail });
    };

    const saasEntries = KASEYA_AT_MAP['SaaS Protection Infinite Cloud Retention Monthly'];
    const results = [];
    for (const row of rows) {
      if (!row.atId) continue;
      emit(row.name, 'SaaS Protection', 'working');
      let anyPushed = false;
      for (const { serviceId, contracts } of saasEntries) {
        for (const kw of contracts) {
          try {
            const r = await kpPushOneService(row.atId, kw, serviceId, row.qty);
            if (r.status === 'no_contract') continue;
            emit(row.name, `SaaS (svc ${serviceId})`, r.status, r.detail);
            results.push({ company: row.name, product: `SaaS Protection (svc ${serviceId})`, ...r, contractKeyword: kw });
            anyPushed = true;
            break;
          } catch (e) {
            emit(row.name, `SaaS (svc ${serviceId})`, 'error', e.message);
            results.push({ company: row.name, product: `SaaS Protection (svc ${serviceId})`, status: 'error', detail: e.message });
            anyPushed = true;
            break;
          }
        }
      }
      if (!anyPushed) {
        emit(row.name, 'SaaS Protection', 'no_contract', 'No matching contract found');
        results.push({ company: row.name, product: 'SaaS Protection', status: 'no_contract', detail: 'No Managed Cloud/Security Services contract found' });
      }
    }
    const summary = {
      updated: results.filter(r => r.status === 'success').length,
      skipped: results.filter(r => ['no_change', 'no_contract', 'no_service', 'negative_qty'].includes(r.status)).length,
      errors:  results.filter(r => r.status === 'error').length,
    };
    return { results, summary };
  });

  // Load Revenue SP file + SaaS bundled flags from hub directory
  ipcMain.handle('kaseya-load-revenue-bundles', async () => {
    const result = {};
    // Hub directory (saasBundled flags) — fast, always attempt
    try {
      const hub = await loadHubDirectory();
      const saasBundled = {};
      const saasBundledQtyOverride = {};
      for (const company of (hub?.companies || [])) {
        if (company.saasBundled) saasBundled[company.atId] = true;
        if (company.saasBundledQtyOverride != null) saasBundledQtyOverride[company.atId] = company.saasBundledQtyOverride;
      }
      result.saasBundled = saasBundled;
      result.saasBundledQtyOverride = saasBundledQtyOverride;
    } catch (e) {
      result.saasBundled = {};
      result.saasBundledQtyOverride = {};
      result.saasBundledError = e.message;
    }
    // Revenue SP file — slow, optional (enables Bundled Qty / Billable columns)
    try {
      result.revenueBundles = await loadRevenueData();
      result.ok = true;
    } catch (e) {
      result.ok = false;
      result.error = e.message;
    }
    return result;
  });

  // Set/clear a manual override for SaaS bundled qty
  ipcMain.handle('kaseya-set-saas-qty-override', async (_, { atId, qty }) => {
    try {
      const hub = await loadHubDirectory();
      if (!hub) return { ok: false, error: 'Hub directory not available' };
      const entry = (hub.companies || []).find(e => e.atId === atId);
      if (!entry) return { ok: false, error: `Company atId ${atId} not found in hub directory` };
      if (qty != null) entry.saasBundledQtyOverride = qty;
      else delete entry.saasBundledQtyOverride;
      hub._updated = new Date().toISOString();
      await saveHubDirectory(hub);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  // Toggle SaaS bundled flag for a company in hub directory
  ipcMain.handle('kaseya-set-saas-bundled', async (_, { atId, bundled }) => {
    try {
      const hub = await loadHubDirectory();
      if (!hub) return { ok: false, error: 'Hub directory not available' };
      const entry = (hub.companies || []).find(e => e.atId === atId);
      if (!entry) return { ok: false, error: `Company atId ${atId} not found in hub directory` };
      if (bundled) entry.saasBundled = true;
      else delete entry.saasBundled;
      hub._updated = new Date().toISOString();
      await saveHubDirectory(hub);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
};
