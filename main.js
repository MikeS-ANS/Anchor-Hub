const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const keytar = require('keytar');
const fetch = require('node-fetch');

// ─── User data directory ──────────────────────────────────────────────────────
// In production (packaged app) __dirname is inside the read-only app.asar, so
// all user-writable files (mappings, CSV exports, etc.) must live in userData.
// In dev we keep using __dirname so the project folder stays the working dir.
const USER_DATA = app.isPackaged ? app.getPath('userData') : __dirname;
if (app.isPackaged && !fs.existsSync(USER_DATA)) fs.mkdirSync(USER_DATA, { recursive: true });

// ─── Auto-updater ─────────────────────────────────────────────────────────────
// Only runs when the app is packaged (not during local dev with npm start/dev).
autoUpdater.autoDownload     = true;   // download silently in background
autoUpdater.autoInstallOnAppQuit = false; // we'll prompt the user instead

autoUpdater.on('update-downloaded', (info) => {
  // Tell the renderer so it can show the "restart to update" banner
  if (mainWindow) mainWindow.webContents.send('update-downloaded', { version: info.version });
});

autoUpdater.on('error', (err) => {
  console.warn('Auto-updater error:', err.message);
});

// Restart the app and install the downloaded update
ipcMain.on('restart-and-install', () => {
  autoUpdater.quitAndInstall();
});

// Manual update check triggered from the home page
ipcMain.handle('check-for-updates', async () => {
  try {
    if (app.isPackaged) {
      const result = await autoUpdater.checkForUpdates();
      return { checked: true, updateAvailable: !!result?.updateInfo };
    }
    return { checked: false, reason: 'dev' };
  } catch (e) {
    return { checked: false, reason: e.message };
  }
});

// App version
ipcMain.handle('get-app-version', () => app.getVersion());

// ─── JSON Mapping Store ───────────────────────────────────────────────────────
const MAPPINGS_FILE = path.join(USER_DATA, 'pax8hub-mappings.json');

function loadMappings() {
  if (!fs.existsSync(MAPPINGS_FILE)) return { companies: [], services: [], lastSync: null };
  try { return JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf8')); }
  catch { return { companies: [], services: [], lastSync: null }; }
}

function saveMappingsFile(data) {
  fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ─── Prompt Templates ─────────────────────────────────────────────────────────
const PROMPT_TEMPLATES_FILE = path.join(USER_DATA, 'pax8hub-prompt-templates.json');

const DEFAULT_AZURE_PROMPT_HEADER =
`You are updating Autotask ContractService pricing records for Azure charges billed through Pax8.
Invoice Reference: {invoiceRef}
Effective Date: {effectiveDate}

Instructions:
For each company below:

Using the provided Autotask Company ID, query /Contracts/query with filters: companyID = [AT ID], contractName contains "Azure", status = 1. If multiple active Azure contracts exist for a company, select the one whose startDate is closest to and on or before {effectiveDate}.
Using the contract ID found, query /ContractServices/query with filter: contractID = [contract ID]. Find the service line where serviceID = {azureServiceId}. This is the Microsoft Azure - Program (pay-as-you-go consumption) line.
PATCH that ContractService record: set unitCost to the Pax8 Cost value and unitPrice to the Client Price value below. Do not modify any other service lines on the contract.
After each update, confirm the company name, ContractService record ID, new unitCost, and new unitPrice.

Do not create new contracts or service lines. Do not modify any service line other than serviceID {azureServiceId}.

Companies to update:`;

const DEFAULT_SERVICE_PROMPT_HEADER =
`You are updating Autotask ContractServiceUnit quantity records for services billed through Pax8.
Invoice Reference: {{INVOICE_ID}} dated {{INVOICE_DATE}}
Billing Period: {{BILLING_MONTH_START}} through {{BILLING_MONTH_END}}

Instructions:
For each company and service below:

Using the Autotask Company ID, locate the correct contract using the service lookup rules defined below. If the service line is not found in the preferred contract, search all other active contracts (status = 1) for that company before giving up.
Using the contract ID, query /ContractServices/query filtering by contractID and serviceID to find the correct service line.
Query /ContractServiceUnits/query filtering by contractServiceID and startDate = {{BILLING_MONTH_START}} to find the current month's unit record.
PATCH that ContractServiceUnit record to update only the units field to the new quantity. Do not modify unitCost, unitPrice, or any other field.
After each update, confirm: company name, service name, ContractServiceUnit record ID, and new unit count.

If a service line is not found in any active contract for a company, do not skip it silently. Instead, pause and ask the user: "No [service name] service line was found for [company name] in any active contract. Would you like me to create it? If yes, please confirm which contract it should be added to and provide the unitCost and unitPrice." Wait for a response before continuing to the next company.
If a ContractServiceUnit record for {{BILLING_MONTH_START}} does not exist on an otherwise valid service line, report it as an exception and ask the user how to proceed before continuing.
Do not create new contracts. Do not create new service lines or unit records unless explicitly confirmed by the user per the prompt above.
Note: Anchor Network Solutions is Anchor's internal account. Skip all Anchor Network Solutions entries silently without prompting.

Service lookup rules:
NERDIO → serviceID: 159 ("Azure Virtual Desktop License")
Preferred contract: contractName contains "Azure", status = 1
If multiple active Azure contracts exist, select the one with startDate closest to and on or before {{BILLING_MONTH_START}}.
If not found there, search all other active contracts for this company.

EXCLAIMER → serviceID: 262 ("Cloud Email Signature Management") OR 288 ("Cloud Email Signature Management - Pro - Monthly")
Preferred contract: contractName contains "Managed Cloud", status = 1
Try serviceID 262 first; if not found try serviceID 288.
If neither is found in the Managed Cloud contract, search all other active contracts for this company using both serviceIDs.

IRONSCALES → serviceID: 275 ("Advance Email Protect")
Preferred contract: contractName contains "Managed Cloud", status = 1
If not found there, search all other active contracts for this company.

PRINTIX → serviceID: 266 ("Cloud Print Management")
Preferred contract: contractName contains "Managed Cloud", status = 1
If not found there, search all other active contracts for this company.

Companies and quantities:`;

function loadPromptTemplates() {
  if (!fs.existsSync(PROMPT_TEMPLATES_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(PROMPT_TEMPLATES_FILE, 'utf8')); }
  catch { return {}; }
}

// Date helpers — parse string directly to avoid UTC/local timezone shifts
function firstOfNextMonth(dateStr) {
  if (!dateStr) {
    const n = new Date();
    const nm = n.getMonth() + 2 > 12 ? 1 : n.getMonth() + 2;
    const ny = n.getMonth() + 2 > 12 ? n.getFullYear() + 1 : n.getFullYear();
    return `${ny}-${String(nm).padStart(2, '0')}-01`;
  }
  const parts = dateStr.split('-').map(Number);
  const yr = parts[0], mo = parts[1];
  const nm = mo === 12 ? 1 : mo + 1;
  const ny = mo === 12 ? yr + 1 : yr;
  return `${ny}-${String(nm).padStart(2, '0')}-01`;
}

function firstOfCurrentMonth(dateStr) {
  if (!dateStr) {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
  }
  const parts = dateStr.split('-').map(Number);
  return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-01`;
}

function lastOfCurrentMonth(dateStr) {
  if (!dateStr) {
    const n = new Date();
    const last = new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  }
  const parts = dateStr.split('-').map(Number);
  const yr = parts[0], mo = parts[1];
  const last = new Date(yr, mo, 0).getDate();
  return `${yr}-${String(mo).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
}

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

// ─── CSV helpers ──────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const cols = []; let cur = ''; let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

// Full-document CSV parser — handles quoted fields that contain newlines (e.g. Azure meter descriptions)
function parseCSVFull(content) {
  const records = [];
  let i = 0, field = '', inQ = false;
  let record = [];
  while (i < content.length) {
    const ch = content[i];
    if (inQ) {
      if (ch === '"' && content[i + 1] === '"') { field += '"'; i += 2; } // escaped quote
      else if (ch === '"') { inQ = false; i++; }
      else { field += ch; i++; } // newlines inside quotes are part of the field
    } else {
      if (ch === '"') { inQ = true; i++; }
      else if (ch === ',') { record.push(field); field = ''; i++; }
      else if (ch === '\r' && content[i + 1] === '\n') {
        record.push(field); field = '';
        if (record.some(f => f !== '')) records.push(record);
        record = []; i += 2;
      } else if (ch === '\n') {
        record.push(field); field = '';
        if (record.some(f => f !== '')) records.push(record);
        record = []; i++;
      } else { field += ch; i++; }
    }
  }
  if (field || record.length) { record.push(field); if (record.some(f => f !== '')) records.push(record); }
  return records;
}

function csvMappingsPath()    { return path.join(USER_DATA, 'Pax8 Autotask Service Mappings.csv'); }
function clientMappingsPath() { return path.join(USER_DATA, 'Pax8 Autotask Client Mapping.csv'); }

function loadClientMappings() {
  // JSON mappings take precedence when they have accepted entries
  const json = loadMappings();
  const accepted = (json.companies || []).filter(c => c.accepted && c.atId > 0);
  if (accepted.length > 0) {
    const map = new Map();
    for (const c of accepted) map.set(c.pax8Id, { atCompanyId: c.atId, atCompanyName: c.atName || '' });
    return map;
  }
  // Fall back to CSV
  const p = clientMappingsPath();
  if (!fs.existsSync(p)) return new Map();
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVLine(lines[i]);
    const pax8Id = cols[0]?.trim();
    const atCompanyId = parseInt(cols[2]?.trim(), 10);
    const atCompanyName = cols[3]?.trim() || '';
    if (pax8Id && !isNaN(atCompanyId) && atCompanyId > 0) {
      map.set(pax8Id, { atCompanyId, atCompanyName });
    }
  }
  return map;
}

function loadCsvMappings() {
  // JSON mappings take precedence when they have accepted entries
  const json = loadMappings();
  const accepted = (json.services || []).filter(s => s.accepted && s.atServiceId > 0);
  if (accepted.length > 0) {
    const map = new Map();
    for (const s of accepted) map.set(s.pax8ProductId, { atServiceId: s.atServiceId, atServiceName: s.atServiceName || '' });
    return map;
  }
  // Fall back to CSV
  const csvPath = csvMappingsPath();
  if (!fs.existsSync(csvPath)) return new Map();
  const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/);
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVLine(lines[i]);
    const pax8Id = cols[0]?.trim();
    const atServiceId = parseInt(cols[2]?.trim(), 10);
    const atServiceName = cols[3]?.trim() || '';
    if (pax8Id && !isNaN(atServiceId) && atServiceId > 0) {
      map.set(pax8Id, { atServiceId, atServiceName });
    }
  }
  return map;
}

// ─── Pax8 product composite key helpers ───────────────────────────────────────
// Pax8 subscriptions with the same productId can map to DIFFERENT AT services
// depending on commitment term (Monthly/Annual/Triennial) and billing term.
function mkProductKey(sub) {
  const pid = sub.productId || sub.product?.id || sub.product_id || '';
  const ct  = (sub.commitmentTerm || sub.term?.duration || sub.termDuration || '').toUpperCase().replace(/\s+/g, '_');
  const bt  = (sub.billingTerm || sub.billingCycle || sub.term?.billingCycle || '').toUpperCase().replace(/\s+/g, '_');
  if (!ct && !bt) return pid;
  return `${pid}|${ct}|${bt}`;
}

function termLabel(sub) {
  const ct = (sub.commitmentTerm || sub.term?.duration || sub.termDuration || '').toUpperCase();
  const bt = (sub.billingTerm || sub.billingCycle || sub.term?.billingCycle || '').toUpperCase();
  const ctMap = { MONTHLY: 'Monthly', ANNUAL: 'Annual', TRIENNIAL: '3-Year',
                  P1M: 'Monthly', P1Y: 'Annual', P3Y: '3-Year' };
  const btMap = { MONTHLY: 'Monthly Billing', ANNUAL: 'Annual Billing' };
  const ctStr = ctMap[ct] || ct;
  const btStr = btMap[bt] || bt;
  if (!ctStr && !btStr) return '';
  if (ctStr === btStr || !btStr) return ctStr;
  if (!ctStr) return btStr;
  return `${ctStr} / ${btStr}`;
}

ipcMain.handle('get-csv-status', () => {
  const svcMap = loadCsvMappings();
  const cliMap = loadClientMappings();
  return {
    services: { found: fs.existsSync(csvMappingsPath()), count: svcMap.size },
    clients:  { found: fs.existsSync(clientMappingsPath()), count: cliMap.size },
  };
});

ipcMain.handle('open-csv-folder', () => {
  // Open the user-data folder itself (works whether or not the CSV file exists yet)
  shell.openPath(USER_DATA);
  return true;
});

ipcMain.handle('export-discrepancies', async (_, discrepancies) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Discrepancies',
    defaultPath: `pax8-audit-${new Date().toISOString().slice(0,10)}.csv`,
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });
  if (!filePath) return { cancelled: true };
  const esc = s => `"${String(s).replace(/"/g, '""')}"`;
  const header = 'Company,Product,Pax8 Qty\n';
  const rows = discrepancies.map(d => `${esc(d.company)},${esc(d.product)},${d.pax8Qty}`).join('\n');
  fs.writeFileSync(filePath, header + rows, 'utf8');
  return { success: true, filePath };
});

const SERVICE_NAME = 'Pax8Hub';
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 900, minHeight: 600,
    frame: false, backgroundColor: '#0d0f14',
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
}

app.whenReady().then(() => {
  createWindow();
  // Check for updates 8s after launch (non-blocking) — only in packaged builds
  if (app.isPackaged) {
    setTimeout(() => autoUpdater.checkForUpdates(), 8000);
    setInterval(() => autoUpdater.checkForUpdates(), 60 * 60 * 1000); // re-check hourly
  }
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// Window controls
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('window-close', () => mainWindow.close());

// Credentials via Windows Credential Manager
ipcMain.handle('creds-save', async (_, key, value) => { await keytar.setPassword(SERVICE_NAME, key, value); return true; });
ipcMain.handle('creds-get', async (_, key) => keytar.getPassword(SERVICE_NAME, key));
ipcMain.handle('creds-delete', async (_, key) => keytar.deletePassword(SERVICE_NAME, key));
ipcMain.handle('creds-check', async () => {
  const pax8Id = await keytar.getPassword(SERVICE_NAME, 'pax8_client_id');
  const pax8Secret = await keytar.getPassword(SERVICE_NAME, 'pax8_client_secret');
  const atUser = await keytar.getPassword(SERVICE_NAME, 'autotask_username');
  const atKey = await keytar.getPassword(SERVICE_NAME, 'autotask_api_key');
  const atCode = await keytar.getPassword(SERVICE_NAME, 'autotask_integration_code');
  return { pax8: !!(pax8Id && pax8Secret), autotask: !!(atUser && atKey && atCode) };
});

// ─── Pax8 API ─────────────────────────────────────────────────────────────────
async function getPax8Token() {
  const clientId = await keytar.getPassword(SERVICE_NAME, 'pax8_client_id');
  const clientSecret = await keytar.getPassword(SERVICE_NAME, 'pax8_client_secret');
  if (!clientId || !clientSecret) throw new Error('Pax8 credentials not configured. Please go to Settings.');
  const res = await fetch('https://api.pax8.com/v1/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, audience: 'https://api.pax8.com', grant_type: 'client_credentials' })
  });
  if (!res.ok) throw new Error(`Pax8 auth failed (${res.status}): ${await res.text()}`);
  return (await res.json()).access_token;
}

async function pax8Paginate(token, endpoint) {
  let all = [], page = 0;
  while (true) {
    const sep = endpoint.includes('?') ? '&' : '?';
    const res = await fetch(`https://api.pax8.com/v1${endpoint}${sep}page=${page}&size=200`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Pax8 error ${res.status} on ${endpoint}`);
    const data = await res.json();
    const items = data.data || data.content || (Array.isArray(data) ? data : []);
    if (!items.length) break;
    all = all.concat(items);
    page++;
    if (items.length < 200) break;
  }
  return all;
}

// ─── Autotask API ─────────────────────────────────────────────────────────────
async function getAtBaseUrl(username) {
  let stored = await keytar.getPassword(SERVICE_NAME, 'autotask_url');
  if (stored) {
    // Patch cached URLs that are missing the version path
    if (!stored.toLowerCase().endsWith('/v1.0')) {
      stored = `${stored.replace(/\/$/, '')}/v1.0`;
      await keytar.setPassword(SERVICE_NAME, 'autotask_url', stored);
    }
    return stored;
  }
  // Zone discovery — returns the correct data-center URL for this account
  const res = await fetch(`https://webservices2.autotask.net/atservicesrest/v1.0/zoneInformation?user=${encodeURIComponent(username)}`);
  if (!res.ok) throw new Error(`Zone discovery failed (${res.status}) — set API Base URL in Settings manually.`);
  const data = await res.json();
  let url = (data.url || '').replace(/\/$/, '');
  if (!url) throw new Error('Zone discovery returned no URL — set API Base URL in Settings manually.');
  if (!url.toLowerCase().endsWith('/v1.0')) url = `${url}/v1.0`;
  await keytar.setPassword(SERVICE_NAME, 'autotask_url', url);
  return url;
}

async function atFetch(path, opts = {}) {
  const username = await keytar.getPassword(SERVICE_NAME, 'autotask_username');
  const apiKey = await keytar.getPassword(SERVICE_NAME, 'autotask_api_key');
  const integrationCode = await keytar.getPassword(SERVICE_NAME, 'autotask_integration_code');
  if (!username || !apiKey) throw new Error('Autotask credentials not configured. Please go to Settings.');
  if (!integrationCode) throw new Error('Autotask Integration Code not configured. Please go to Settings.');
  const baseUrl = await getAtBaseUrl(username);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      ...opts,
      signal: controller.signal,
      headers: { 'ApiIntegrationCode': integrationCode, 'UserName': username, 'Secret': apiKey, 'Content-Type': 'application/json', ...(opts.headers || {}) }
    });
    if (!res.ok) throw new Error(`Autotask ${res.status}: ${await res.text()}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ─── Pax8 product name/details cache ──────────────────────────────────────────
const productNameCache   = new Map();
const productDetailsCache = new Map();

async function resolveProductName(token, sub) {
  const direct = sub.productName || sub.product?.name || sub.name;
  if (direct) return direct;
  const id = sub.productId || sub.product?.id;
  if (!id) return null;
  if (productNameCache.has(id)) return productNameCache.get(id);
  const details = await resolveProductDetails(token, id);
  return details.name;
}

async function resolveProductDetails(token, productId) {
  if (!productId) return { name: null, vendorName: null, vendorSku: null };
  if (productDetailsCache.has(productId)) return productDetailsCache.get(productId);
  try {
    const res = await fetch(`https://api.pax8.com/v1/products/${productId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) { const empty = { name: null, vendorName: null, vendorSku: null }; productDetailsCache.set(productId, empty); return empty; }
    const p = await res.json();
    const prod = p.data || p;
    const rawSku = prod.vendorSku || prod.sku || prod.partNumber || prod.vendorPartNumber || null;
    let vendorSku = rawSku;
    if (typeof rawSku === 'string' && rawSku.trim().startsWith('{')) {
      try { const parsed = JSON.parse(rawSku); vendorSku = parsed.productId || parsed.skuId || rawSku; } catch {}
    } else if (rawSku && typeof rawSku === 'object') {
      vendorSku = rawSku.productId || rawSku.skuId || JSON.stringify(rawSku);
    }
    const details = {
      name:       prod.name || prod.productName || null,
      vendorName: prod.vendorName || prod.vendor?.name || null,
      vendorSku,
    };
    productDetailsCache.set(productId, details);
    productNameCache.set(productId, details.name);
    return details;
  } catch {
    const empty = { name: null, vendorName: null, vendorSku: null };
    productDetailsCache.set(productId, empty);
    return empty;
  }
}

// ─── Autotask paginated query — POST body, ID-cursor based (max 500/page) ─────
async function atQuery(entityPath, filters = []) {
  let all = [], maxId = 0;
  while (true) {
    const r = await atFetch(`${entityPath}/query`, {
      method: 'POST',
      body: JSON.stringify({ filter: [...filters, { op: 'gt', field: 'id', value: maxId }] })
    });
    const items = r.items || [];
    if (!items.length) break;
    all = all.concat(items);
    maxId = Math.max(...items.map(i => i.id));
    if (items.length < 500) break;
  }
  return all;
}

// ─── ContractServices path auto-detector ──────────────────────────────────────
// Autotask docs are ambiguous about whether child resource or top-level query
// is correct. Try all known variants and cache the first one that works.
let _csWorkingPath = null;

async function getContractServices(contractId, send) {
  const makeAttempts = (id) => [
    ['child /Contracts/{id}/ContractServices/',  () => atFetch(`/Contracts/${id}/ContractServices/`)],
    ['child /Contracts/{id}/Services/',          () => atFetch(`/Contracts/${id}/Services/`)],
    ['POST /ContractServices/query',             () => atFetch('/ContractServices/query', { method: 'POST', body: JSON.stringify({ filter: [{ op: 'eq', field: 'contractID', value: id }] }) })],
    ['GET /ContractServices/query?search=…',     () => atFetch(`/ContractServices/query?search=${encodeURIComponent(JSON.stringify({ filter: [{ op: 'eq', field: 'contractID', value: id }] }))}`)],
  ];

  if (_csWorkingPath) {
    const attempt = makeAttempts(contractId).find(([name]) => name === _csWorkingPath);
    if (attempt) {
      const r = await attempt[1]();
      return r.items || [];
    }
  }

  // First run — discover which path works
  for (const [name, fn] of makeAttempts(contractId)) {
    try {
      const r = await fn();
      if (r && r.items !== undefined) {
        _csWorkingPath = name;
        if (send) send(`  ℹ ContractServices path: ${name}`, 'info');
        return r.items;
      }
    } catch (e) {
      if (!/Autotask 404/.test(e.message)) throw e;
    }
  }
  if (send) send(`  ⚠ All ContractServices path attempts 404'd for contract ${contractId}`, 'warn');
  return [];
}

// ─── Excluded companies helper ────────────────────────────────────────────────
function loadExcludedCompanies() {
  return new Set((loadMappings().companies || []).filter(c => c.excluded).map(c => c.pax8Id));
}

// ─── AT service name cache ─────────────────────────────────────────────────────
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

// ─── Integration: Subscription Audit ─────────────────────────────────────────
let auditAbortFlag = false;
ipcMain.handle('abort-audit', () => { auditAbortFlag = true; return true; });

ipcMain.handle('run-subscription-audit', async (event, { dryRun = false } = {}) => {
  auditAbortFlag = false;
  _csWorkingPath = null;
  const send = (msg, type = 'info') => mainWindow.webContents.send('audit-log', { msg, type, ts: new Date().toISOString() });
  const results = { discrepancies: [], matched: 0, checked: 0, ticketsCreated: 0, errors: [] };
  const excludedCompanies = loadExcludedCompanies();
  productNameCache.clear();
  atServiceCache.clear();

  try {
    if (dryRun) send('⚠ DRY RUN MODE — no tickets will be created', 'warn');

    const csvMappings   = loadCsvMappings();
    const clientMappings = loadClientMappings();
    send(`ℹ ${csvMappings.size} product mappings, ${clientMappings.size} client mappings loaded`, 'info');

    send('Authenticating with Pax8...');
    const token = await getPax8Token();
    send('✓ Pax8 token obtained', 'success');

    send('Fetching Pax8 companies...');
    const companies = await pax8Paginate(token, '/companies');
    send(`✓ Found ${companies.length} Pax8 companies`, 'success');

    send('Fetching all active Pax8 subscriptions...');
    const allSubs = await pax8Paginate(token, '/subscriptions?status=Active');
    send(`✓ Found ${allSubs.length} active subscriptions`, 'success');

    const subsByCompany = {};
    for (const sub of allSubs) {
      const cid = sub.companyId;
      if (!subsByCompany[cid]) subsByCompany[cid] = [];
      subsByCompany[cid].push(sub);
    }

    for (const company of companies) {
      if (auditAbortFlag) { send('⚠ Audit stopped by user.', 'warn'); break; }
      if (excludedCompanies.has(company.id)) continue; // silently skip excluded clients
      const subs = subsByCompany[company.id] || [];
      if (!subs.length) continue;
      send(`Checking ${company.name} (${subs.length} subscriptions)...`);

      // Resolve Autotask company ID from client mapping
      const clientEntry = clientMappings.get(company.id);
      if (!clientEntry) {
        send(`  — No client mapping for: ${company.name} (${company.id})`, 'warn');
        continue;
      }
      const atCompanyId = clientEntry.atCompanyId;

      // Fetch active contracts for this company by companyID
      let contracts = [];
      try {
        contracts = await atQuery('/Contracts', [
          { op: 'eq', field: 'companyID', value: atCompanyId },
          { op: 'eq', field: 'status', value: 1 }
        ]);
      } catch (e) {
        send(`  ⚠ Contract lookup failed for ${company.name}: ${e.message}`, 'warn');
        results.errors.push({ company: company.name, error: e.message });
        continue;
      }

      if (!contracts.length) {
        send(`  — No active Autotask contracts for ${company.name}`, 'warn');
        continue;
      }

      // Collect all service IDs on this company's active contracts.
      // ContractServices are child resources: /Contracts/{id}/ContractServices/
      // NOTE: Unit counts are stored in ContractServiceAdjustments which is
      // write-only (create-only) — the Autotask REST API does not expose current
      // unit counts as a queryable field. We check service existence only.
      const psaServiceIds = new Set();

      for (const contract of contracts) {
        try {
          const items = await getContractServices(contract.id, send);
          for (const cs of items) {
            // /Contracts/{id}/Services/ returns Service objects (use cs.id)
            // /ContractServices/query returns ContractService objects (use cs.serviceID)
            const sId = cs.serviceID ?? cs.id;
            if (sId != null) psaServiceIds.add(sId);
          }
        } catch (e) {
          send(`  ⚠ Contract services fetch failed (contract ${contract.id}): ${e.message}`, 'warn');
        }
      }

      // Compare each Pax8 subscription: does a matching service exist in the PSA?
      for (const sub of subs) {
        results.checked++;
        const productName = await resolveProductName(token, sub);
        if (!productName) { send(`  — Skipping subscription ${sub.id}: product name unresolvable`, 'warn'); continue; }
        const pax8Qty = Number(sub.quantity) || 0;

        let matchedServiceId = null;
        const csvEntry = csvMappings.get(mkProductKey(sub)) || csvMappings.get(sub.productId || sub.product?.id || '');

        if (csvEntry) {
          if (psaServiceIds.has(csvEntry.atServiceId)) {
            // Exact ID match
            matchedServiceId = csvEntry.atServiceId;
          } else if (csvEntry.atServiceName) {
            // ID not in contract — match by AT service name from the CSV
            const csvNameLower = csvEntry.atServiceName.toLowerCase();
            for (const sId of psaServiceIds) {
              const sName = await resolveAtServiceName(sId);
              if (!sName) continue;
              const sLower = sName.toLowerCase();
              if (sLower.includes(csvNameLower) || csvNameLower.includes(sLower)) {
                matchedServiceId = sId; break;
              }
            }
          }
        }

        if (matchedServiceId === null) {
          // No CSV entry or CSV name didn't match — try raw product name
          const pLower = productName.toLowerCase();
          for (const sId of psaServiceIds) {
            const sName = await resolveAtServiceName(sId);
            if (!sName) continue;
            const sLower = sName.toLowerCase();
            if (sLower.includes(pLower) || pLower.includes(sLower)) {
              matchedServiceId = sId; break;
            }
          }
        }

        if (matchedServiceId === null) {
          const diff = pax8Qty;
          results.discrepancies.push({ company: company.name, product: productName, pax8Qty, psaQty: 0, diff });
          send(`  ✗ MISSING FROM PSA: ${productName} (Pax8 qty: ${pax8Qty})`, 'error');
          if (dryRun) {
            send(`    → [DRY RUN] Would create ticket`, 'info');
            results.ticketsCreated++;
          } else {
            try {
              const dueDateTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
              await atFetch('/Tickets', {
                method: 'POST',
                body: JSON.stringify({
                  title: `[Pax8 Audit] Service Missing from PSA: ${productName} — ${company.name}`,
                  description: `Pax8 Subscription Audit found a product with no matching service on any active Autotask contract.\n\nCompany: ${company.name}\nProduct: ${productName}\nPax8 Qty: ${pax8Qty}\nPSA Contract: Not found\n\nPlease add this service to the appropriate Autotask contract.`,
                  companyID: atCompanyId,
                  status: 1, priority: 2, queueID: 8,
                  dueDateTime
                })
              });
              results.ticketsCreated++;
              send(`    → Ticket created`, 'success');
            } catch (e) { send(`    ⚠ Ticket creation failed: ${e.message}`, 'warn'); }
          }
        } else {
          results.matched++;
          send(`  ✓ ${productName} found in PSA`, 'success');
        }
      }
    }

    send('────────────────────────────', 'divider');
    send(`Subscriptions checked: ${results.checked}`);
    send(`Found in PSA (existence confirmed): ${results.matched}`, 'success');
    send(`Discrepancies found: ${results.discrepancies.length}`, results.discrepancies.length > 0 ? 'error' : 'success');
    send(`Tickets created in Autotask: ${results.ticketsCreated}`, 'info');
    if (results.errors.length) send(`Errors encountered: ${results.errors.length}`, 'warn');

    return { success: true, results };
  } catch (err) {
    send(`Fatal: ${err.message}`, 'error');
    return { success: false, error: err.message, results };
  }
});

ipcMain.handle('detect-at-zone', async () => {
  const username = await keytar.getPassword(SERVICE_NAME, 'autotask_username');
  if (!username) throw new Error('Enter your Autotask username first.');
  await keytar.deletePassword(SERVICE_NAME, 'autotask_url'); // force re-discover
  const url = await getAtBaseUrl(username);
  return url;
});

ipcMain.handle('fetch-pax8-companies', async () => {
  const token = await getPax8Token();
  return pax8Paginate(token, '/companies');
});

// ─── Claude API ───────────────────────────────────────────────────────────────
async function callClaude(apiKey, prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || '';
}

function detectChanges(currentItems, prevData) {
  const changes = [];

  const currentBySku = {};
  for (const item of currentItems) {
    const sku = item.sku || item.description;
    if (sku) currentBySku[sku] = item;
  }

  const prevBySku = {};
  for (const { items } of prevData) {
    for (const item of items) {
      const sku = item.sku || item.description;
      if (sku && !prevBySku[sku]) prevBySku[sku] = item;
    }
  }

  for (const [sku, item] of Object.entries(currentBySku)) {
    const prev = prevBySku[sku];
    const desc = item.description || sku;
    if (!prev) {
      changes.push({ type: 'NEW', sku, description: desc, currentQty: item.quantity, prevQty: null, currentPrice: item.price, prevPrice: null, currentCost: item.cost_total ?? item.total ?? null });
      continue;
    }
    const qtyDelta = item.quantity - prev.quantity;
    const qtyPct   = prev.quantity ? Math.abs(qtyDelta / prev.quantity * 100) : 0;
    if (qtyPct >= 20) {
      changes.push({ type: 'QTY_CHANGE', sku, description: desc, currentQty: item.quantity, prevQty: prev.quantity, qtyDelta, qtyPct, currentPrice: item.price, prevPrice: prev.price, currentCost: item.cost_total ?? item.total ?? null });
    }
    const priceDelta = (item.price ?? 0) - (prev.price ?? 0);
    if (Math.abs(priceDelta) > 0.01) {
      changes.push({ type: 'PRICE_CHANGE', sku, description: desc, currentQty: item.quantity, prevQty: prev.quantity, currentPrice: item.price, prevPrice: prev.price, priceDelta, currentCost: item.cost_total ?? item.total ?? null });
    }
  }

  for (const [sku, prev] of Object.entries(prevBySku)) {
    if (!currentBySku[sku]) {
      changes.push({ type: 'REMOVED', sku, description: prev.description || sku, currentQty: null, prevQty: prev.quantity, currentPrice: null, prevPrice: prev.price, currentCost: null });
    }
  }

  return changes;
}

function changeToString(c) {
  switch (c.type) {
    case 'NEW':           return `NEW: ${c.description} (qty: ${c.currentQty}, cost: $${c.currentCost ?? '?'})`;
    case 'QTY_CHANGE':    return `QTY CHANGE: ${c.description} — ${c.prevQty} → ${c.currentQty} (${c.qtyDelta > 0 ? '+' : ''}${c.qtyDelta}, ${c.qtyPct?.toFixed(0)}%)`;
    case 'PRICE_CHANGE':  return `PRICE CHANGE: ${c.description} — $${c.prevPrice} → $${c.currentPrice}`;
    case 'REMOVED':       return `REMOVED: ${c.description} (was qty: ${c.prevQty})`;
    case 'NEW_CLIENT':    return `NEW CLIENT — first appearance on this invoice`;
    case 'CLIENT_REMOVED':return `CLIENT REMOVED — had charges before but absent from current invoice`;
    default: return c.description || '';
  }
}

function buildInvoiceChangesPrompt(invoice, companyChanges) {
  const lines = companyChanges.map(c =>
    `${c.company}:\n${c.changes.map(ch => `  - ${changeToString(ch)}`).join('\n')}`
  ).join('\n\n');

  return `You are a billing analyst reviewing an MSP's monthly Pax8 invoice.

Invoice ${invoice.id}, dated ${invoice.invoiceDate}, Total: $${invoice.total ?? invoice.totalAmount}

Changes detected vs. prior months:

${lines}

Write a concise plain-text executive summary (4-6 sentences) of the most significant billing changes. Do NOT use markdown, bold, asterisks, or headers — plain sentences only. Call out anything that looks like a potential error or needs immediate attention. Be specific about company names and dollar amounts. End with a recommended action if warranted.`;
}

function buildInvoicePrompt(companyName, invoice, lineItems, history) {
  const date   = invoice.invoiceDate || invoice.date || 'Unknown';
  const total  = invoice.totalAmount ?? invoice.total ?? 'Unknown';

  const itemsText = lineItems.length
    ? lineItems.map(i => {
        const name  = i.productName || i.name || i.description || 'Unknown';
        const qty   = i.quantity != null ? ` | Qty: ${i.quantity}` : '';
        const price = i.unitPrice != null ? ` | Unit: $${i.unitPrice}` : '';
        const tot   = i.totalAmount != null ? ` | Total: $${i.totalAmount}` : '';
        return `  - ${name}${qty}${price}${tot}`;
      }).join('\n')
    : '  (No line items available)';

  const histText = history.length
    ? history.map(inv => {
        const d = inv.invoiceDate || inv.date || '?';
        const t = inv.totalAmount ?? inv.total ?? '?';
        return `  - ${d}: $${t}`;
      }).join('\n')
    : '  (No history available)';

  return `You are a billing analyst reviewing MSP client invoices. Analyze this Pax8 invoice for "${companyName}".

CURRENT INVOICE:
Date: ${date}  |  Invoice ID: ${invoice.id}  |  Total: $${total}

LINE ITEMS:
${itemsText}

INVOICE HISTORY (${history.length} previous invoices):
${histText}

Look for anomalies such as:
- New charges not seen in prior invoices
- Quantity increases or decreases greater than 20%
- Price changes on existing products
- Missing recurring charges that appeared before
- Unusually large total amount change vs. trend

If everything looks normal respond ONLY with: NO_ANOMALY
If anomalies are found, respond with a concise bullet list (max 5 items). Be specific — name the product and the change.`;
}

// ─── Invoice Monitor ──────────────────────────────────────────────────────────
let invoiceAuditAbortFlag = false;
let lastInvoiceExportData = null; // stored server-side so no large IPC payload
ipcMain.handle('abort-invoice-audit', () => { invoiceAuditAbortFlag = true; return true; });

async function pax8FetchInvoiceItems(token, invoiceId) {
  const items = [];
  let page = 0;
  while (true) {
    const r = await fetch(`https://api.pax8.com/v1/invoices/${invoiceId}/items?page=${page}&size=200`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const d = r.ok ? await r.json() : {};
    const batch = d.content || d.data || d.items || [];
    items.push(...batch);
    const totalPages = d.totalPages ?? d.page?.totalPages ?? (d.totalElements != null ? Math.ceil(d.totalElements / 200) : null);
    if (!batch.length || page + 1 >= (totalPages ?? 1)) break;
    page++;
  }
  return items;
}

const PARTIAL_RE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+Partial:/i;

ipcMain.handle('run-invoice-audit', async (event, { companyFilter = '', compareCount = 1 } = {}) => {
  invoiceAuditAbortFlag = false;
  const send = (msg, type = 'info') => mainWindow.webContents.send('invoice-log', { msg, type });
  const results = { analyzed: 0, anomalies: [], clean: 0, errors: [], invoiceId: null, invoiceDate: null, invoiceTotal: null, aiSummary: null };

  try {
    const claudeKey = await keytar.getPassword(SERVICE_NAME, 'claude_api_key');
    if (!claudeKey) throw new Error('Claude API key not configured. Please add it in Settings.');

    send('Authenticating with Pax8...');
    const token = await getPax8Token();
    send('✓ Pax8 token obtained', 'success');

    // Fetch all partner invoices, sort newest first
    send('Fetching partner invoices...');
    const allInvoices = await pax8Paginate(token, '/invoices');
    allInvoices.sort((a, b) => new Date(b.invoiceDate || 0) - new Date(a.invoiceDate || 0));
    if (!allInvoices.length) throw new Error('No invoices found.');
    send(`✓ ${allInvoices.length} invoices found — loading ${compareCount + 1} months`, 'success');

    // Fetch line items for current + compareCount previous invoices
    const toFetch = allInvoices.slice(0, compareCount + 1);
    const itemsMap = {};
    for (const inv of toFetch) {
      if (invoiceAuditAbortFlag) break;
      send(`  Loading ${inv.invoiceDate || inv.id}...`);
      try {
        itemsMap[inv.id] = await pax8FetchInvoiceItems(token, inv.id);
        send(`    ✓ ${itemsMap[inv.id].length} line items`, 'success');
      } catch (e) { itemsMap[inv.id] = []; }
    }

    const currentInv   = toFetch[0];
    const currentItems = itemsMap[currentInv.id] || [];
    const prevInvoices = toFetch.slice(1);

    results.invoiceId    = currentInv.id;
    results.invoiceDate  = currentInv.invoiceDate;
    results.invoiceTotal = currentInv.total ?? currentInv.totalAmount;

    send('────────────────────────────', 'divider');
    send(`Current invoice: ${currentInv.id} (${currentInv.invoiceDate}) — $${results.invoiceTotal}`);

    const isInvoiceProrate = i => PARTIAL_RE.test(i.description || '')
      || (i.type || i.chargeType || '').toLowerCase() === 'prorate'
      || /\(Canceled\)\s*prorated/i.test(i.description || '');

    // Separate partial/prorate items (they change every month by design)
    const partialItems   = currentItems.filter(i => isInvoiceProrate(i));
    const regularItems   = currentItems.filter(i => !isInvoiceProrate(i));

    // Group current (regular) items by company
    const currentByCompany = {};
    for (const item of regularItems) {
      const cid   = String(item.company_id || item.companyId || 'unknown');
      const cname = item.company_name || item.companyName || cid;
      if (!currentByCompany[cid]) currentByCompany[cid] = { name: cname, items: [] };
      currentByCompany[cid].items.push(item);
    }

    // Group previous items by company
    const prevByCompany = {};
    for (const inv of prevInvoices) {
      for (const item of (itemsMap[inv.id] || [])) {
        const cid = String(item.company_id || item.companyId || 'unknown');
        if (!prevByCompany[cid]) prevByCompany[cid] = [];
        prevByCompany[cid].push({ ...item, _invoiceDate: inv.invoiceDate });
      }
    }

    const allPrevIds = new Set(Object.keys(prevByCompany));
    const companyChanges = [];
    const filter = companyFilter.trim().toLowerCase();

    // Check each company in current invoice
    for (const [cid, { name: cname, items: currItems }] of Object.entries(currentByCompany)) {
      if (filter && !cname.toLowerCase().includes(filter)) continue;
      results.analyzed++;

      const prevItems = prevByCompany[cid] || [];
      const prevData  = prevItems.length ? [{ items: prevItems }] : [];
      const changes = prevData.length
        ? detectChanges(currItems, prevData)
        : [{ type: 'NEW_CLIENT', description: 'First appearance on invoice' }];

      if (changes.length) {
        companyChanges.push({ company: cname, changes });
        send(`  ⚠ ${cname}: ${changes.length} change${changes.length > 1 ? 's' : ''}`, 'warn');
      } else {
        results.clean++;
      }
    }

    // Clients that were on previous invoices but not current
    for (const cid of allPrevIds) {
      if (!currentByCompany[cid]) {
        const sample = prevByCompany[cid]?.[0];
        const cname  = sample?.company_name || sample?.companyName || cid;
        if (filter && !cname.toLowerCase().includes(filter)) continue;
        companyChanges.push({ company: cname, changes: [{ type: 'CLIENT_REMOVED', description: cname }] });
        send(`  ⚠ ${cname}: removed from invoice`, 'warn');
      }
    }

    results.anomalies     = companyChanges;
    results.currentItems  = regularItems;
    results.partialItems  = partialItems;
    lastInvoiceExportData = results;

    if (!companyChanges.length) {
      send('✓ No billing changes detected vs. prior invoices', 'success');
    } else {
      send(`Sending ${companyChanges.length} changes to Claude for analysis...`);
      try {
        results.aiSummary = await callClaude(claudeKey, buildInvoiceChangesPrompt(currentInv, companyChanges));
        send('✓ AI analysis complete', 'success');
      } catch (e) {
        send(`⚠ AI analysis failed: ${e.message}`, 'warn');
        results.aiSummary = null;
      }
    }

    send('────────────────────────────', 'divider');
    send(`Companies on invoice: ${results.analyzed}`);
    send(`Companies with changes: ${companyChanges.length}`, companyChanges.length ? 'warn' : 'success');

    return { success: true, results };
  } catch (err) {
    send(`Fatal: ${err.message}`, 'error');
    return { success: false, error: err.message, results };
  }
});

ipcMain.handle('print-report', async () => {
  const results = lastInvoiceExportData;
  if (!results) return { error: 'No audit data — run the invoice monitor first.' };
  try {
  const ExcelJS = require('exceljs');
  const filePath = path.join(app.getPath('downloads'), `pax8-invoice-report-${results.invoiceDate || new Date().toISOString().slice(0,10)}.xlsx`);

  const wb  = new ExcelJS.Workbook();
  wb.creator = 'Pax8 Hub';

  const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
  const WARN_FILL   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
  const NEW_FILL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
  const DEL_FILL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
  const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  const BOLD        = { bold: true };

  function addHeaderRow(ws, cols) {
    const row = ws.addRow(cols.map(c => c.header));
    row.eachCell(cell => { cell.fill = HEADER_FILL; cell.font = HEADER_FONT; cell.alignment = { vertical: 'middle' }; });
    row.height = 20;
    cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.width || 20; });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  }

  // ── Tab 1: Summary ───────────────────────────────────────────────
  const wsSummary = wb.addWorksheet('Summary');
  wsSummary.getColumn(1).width = 28;
  wsSummary.getColumn(2).width = 60;

  const titleRow = wsSummary.addRow(['Pax8 Invoice Analysis Report']);
  titleRow.getCell(1).font = { bold: true, size: 16 };
  wsSummary.mergeCells('A1:B1');
  wsSummary.addRow([]);
  wsSummary.addRow(['Invoice ID',    results.invoiceId]);
  wsSummary.addRow(['Invoice Date',  results.invoiceDate]);
  wsSummary.addRow(['Invoice Total', results.invoiceTotal != null ? Number(results.invoiceTotal) : '']);
  wsSummary.getRow(5).getCell(2).numFmt = '$#,##0.00';
  wsSummary.addRow(['Run Date',      new Date().toLocaleString()]);
  wsSummary.addRow([]);
  wsSummary.addRow(['Companies on Invoice', results.analyzed]);
  wsSummary.addRow(['Unchanged',            results.clean]);
  wsSummary.addRow(['With Changes',         results.anomalies.length]);
  [3,4,5,6,8,9,10].forEach(r => { wsSummary.getRow(r).getCell(1).font = BOLD; });
  wsSummary.addRow([]);
  wsSummary.addRow(['AI Summary']);
  wsSummary.getRow(12).getCell(1).font = BOLD;
  if (results.aiSummary) {
    const aiRow = wsSummary.addRow(['', results.aiSummary]);
    aiRow.getCell(2).alignment = { wrapText: true };
    aiRow.height = 120;
    wsSummary.mergeCells(`B13:B13`);
  }

  // ── Tab 2: All Changes ───────────────────────────────────────────
  const wsChanges = wb.addWorksheet('Changes');
  addHeaderRow(wsChanges, [
    { header: 'Company',        width: 36 },
    { header: 'Change Type',    width: 16 },
    { header: 'Product',        width: 52 },
    { header: 'SKU',            width: 22 },
    { header: 'Prev Qty',       width: 12 },
    { header: 'Current Qty',    width: 12 },
    { header: 'Qty Change %',   width: 14 },
    { header: 'Prev Unit Price',width: 16 },
    { header: 'Curr Unit Price',width: 16 },
    { header: 'Current Cost',   width: 16 },
  ]);
  const typeFill = { NEW: NEW_FILL, NEW_CLIENT: NEW_FILL, REMOVED: DEL_FILL, CLIENT_REMOVED: DEL_FILL, QTY_CHANGE: WARN_FILL, PRICE_CHANGE: WARN_FILL };
  for (const a of results.anomalies) {
    for (const c of a.changes) {
      const row = wsChanges.addRow([
        a.company,
        c.type.replace(/_/g, ' '),
        c.description,
        c.sku || '',
        c.prevQty ?? '',
        c.currentQty ?? '',
        c.qtyPct != null ? c.qtyPct / 100 : '',
        c.prevPrice != null ? Number(c.prevPrice) : '',
        c.currentPrice != null ? Number(c.currentPrice) : '',
        c.currentCost != null ? Number(c.currentCost) : '',
      ]);
      const fill = typeFill[c.type];
      if (fill) row.eachCell(cell => { cell.fill = fill; });
      if (c.qtyPct != null) row.getCell(7).numFmt = '0.0%';
      [8,9,10].forEach(n => { if (row.getCell(n).value) row.getCell(n).numFmt = '$#,##0.00'; });
    }
  }

  // ── Tab 3: Current Invoice ───────────────────────────────────────
  const wsInvoice = wb.addWorksheet('Current Invoice');
  addHeaderRow(wsInvoice, [
    { header: 'Company',    width: 36 },
    { header: 'SKU',        width: 22 },
    { header: 'Product',    width: 52 },
    { header: 'Qty',        width: 10 },
    { header: 'Unit Price', width: 14 },
    { header: 'Cost Total', width: 14 },
    { header: 'Period Start',width: 14 },
    { header: 'Period End',  width: 14 },
  ]);
  for (const item of (results.currentItems || [])) {
    const row = wsInvoice.addRow([
      item.company_name || item.companyName || '',
      item.sku || '',
      item.description || '',
      item.quantity != null ? Number(item.quantity) : '',
      item.price    != null ? Number(item.price)    : '',
      item.cost != null ? Number(item.cost) * Math.max(Number(item.quantity || 1), 1) : (item.cost_total != null ? Number(item.cost_total) : (item.total != null ? Number(item.total) : '')),
      item.start_period || '',
      item.end_period   || '',
    ]);
    [5,6].forEach(n => { if (row.getCell(n).value) row.getCell(n).numFmt = '$#,##0.00'; });
  }

  // ── Tab 4: New Items ─────────────────────────────────────────────
  const wsNew = wb.addWorksheet('New Items');
  addHeaderRow(wsNew, [
    { header: 'Company',    width: 36 },
    { header: 'Product',    width: 52 },
    { header: 'SKU',        width: 22 },
    { header: 'Qty',        width: 10 },
    { header: 'Unit Price', width: 14 },
    { header: 'Cost Total', width: 14 },
  ]);
  for (const a of results.anomalies) {
    for (const c of a.changes.filter(x => x.type === 'NEW' || x.type === 'NEW_CLIENT')) {
      const row = wsNew.addRow([a.company, c.description, c.sku || '', c.currentQty ?? '', c.currentPrice != null ? Number(c.currentPrice) : '', c.currentCost != null ? Number(c.currentCost) : '']);
      row.eachCell(cell => { cell.fill = NEW_FILL; });
      [5,6].forEach(n => { if (row.getCell(n).value) row.getCell(n).numFmt = '$#,##0.00'; });
    }
  }

  // ── Tab 5: Removed Items ─────────────────────────────────────────
  const wsRemoved = wb.addWorksheet('Removed Items');
  addHeaderRow(wsRemoved, [
    { header: 'Company',    width: 36 },
    { header: 'Product',    width: 52 },
    { header: 'SKU',        width: 22 },
    { header: 'Prev Qty',   width: 12 },
    { header: 'Prev Price', width: 14 },
  ]);
  for (const a of results.anomalies) {
    for (const c of a.changes.filter(x => x.type === 'REMOVED' || x.type === 'CLIENT_REMOVED')) {
      const row = wsRemoved.addRow([a.company, c.description, c.sku || '', c.prevQty ?? '', c.prevPrice != null ? Number(c.prevPrice) : '']);
      row.eachCell(cell => { cell.fill = DEL_FILL; });
      if (row.getCell(5).value) row.getCell(5).numFmt = '$#,##0.00';
    }
  }

  // ── Tab 6: Partial Charges ───────────────────────────────────────
  const wsPartial = wb.addWorksheet('Partial Charges');
  addHeaderRow(wsPartial, [
    { header: 'Company',     width: 36 },
    { header: 'Product',     width: 52 },
    { header: 'SKU',         width: 22 },
    { header: 'Qty',         width: 10 },
    { header: 'Unit Price',  width: 14 },
    { header: 'Cost Total',  width: 14 },
  ]);
  const PARTIAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
  for (const item of (results.partialItems || [])) {
    const row = wsPartial.addRow([
      item.company_name || item.companyName || '',
      item.description || '',
      item.sku || '',
      item.quantity != null ? Number(item.quantity) : '',
      item.price     != null ? Number(item.price)    : '',
      item.cost != null ? Number(item.cost) * Math.max(Number(item.quantity || 1), 1) : (item.cost_total != null ? Number(item.cost_total) : (item.total != null ? Number(item.total) : '')),
    ]);
    row.eachCell(cell => { cell.fill = PARTIAL_FILL; });
    [5,6].forEach(n => { if (row.getCell(n).value) row.getCell(n).numFmt = '$#,##0.00'; });
  }

  await wb.xlsx.writeFile(filePath);
  shell.openPath(filePath);
  return { success: true };
  } catch (err) {
    console.error('Excel export error:', err);
    return { success: false, error: err.message };
  }
});

// ─── Margin Analyzer ──────────────────────────────────────────────────────────
const AZURE_RE = /azure/i;
let marginAbortFlag  = false;
let lastMarginExportData = null;

const STATE_FILE = path.join(app.getPath('userData'), 'pax8hub-state.json');
function readState()       { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } }
function writeState(patch) { fs.writeFileSync(STATE_FILE, JSON.stringify({ ...readState(), ...patch }), 'utf8'); }

// Reuses getContractServices (with path auto-detection) and extracts pricing fields.
// Service objects (/Services/ path): id = catalogId, unitPrice = default price
// ContractService objects (/ContractServices/ path): serviceID = catalogId, unitPrice = contract price
async function fetchContractServicesWithPricing(contractId) {
  const items = await getContractServices(contractId, null);
  return items; // getContractServices already returns full objects with unitPrice
}

ipcMain.handle('abort-margin-analysis', () => { marginAbortFlag = true; return true; });

ipcMain.handle('get-margin-settings', async () => {
  const azureContract   = await keytar.getPassword(SERVICE_NAME, 'margin_azure_contract')    || 'Microsoft Azure Cloud Services';
  const scheduleDay     = await keytar.getPassword(SERVICE_NAME, 'margin_schedule_day')       || '10';
  const scheduleEnabled = await keytar.getPassword(SERVICE_NAME, 'margin_schedule_enabled')   || 'true';
  const azureServiceId  = await keytar.getPassword(SERVICE_NAME, 'margin_azure_service_id')   || '110';
  const state           = readState();
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
  const send = (msg, type = 'info') => mainWindow.webContents.send('margin-log', { msg, type });

  try {
    const csvMappings        = loadCsvMappings();
    const clientMappings     = loadClientMappings();
    const excludedCompanies  = loadExcludedCompanies();
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

    // Filter out prorate, partial-month, and Azure items
    const regularItems  = invoiceItems.filter(i => !isProrate(i) && !AZURE_RE.test(i.description || '') && !AZURE_RE.test(i.sku || ''));
    const azureInvItems = invoiceItems.filter(i => !isProrate(i) && (AZURE_RE.test(i.description || '') || AZURE_RE.test(i.sku || '')));

    // Group by company
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
    const allRows         = [];
    const mismatches      = [];
    const azureRows       = [];
    const unmappedRows    = [];
    const noContractRows  = [];
    const orphanedAtRows  = [];
    const companySummaries = [];

    send('────────────────────────────', 'divider');
    send(`Invoice: ${currentInv.id} — ${currentInv.invoiceDate}`);
    send(`Analyzing ${Object.keys(byCompany).length} companies...`);
    send('────────────────────────────', 'divider');

    for (const [pax8Cid, { name: cname, regular: regItems, azure: azItems }] of Object.entries(byCompany)) {
      if (marginAbortFlag) { send('⚠ Stopped by user.', 'warn'); break; }
      if (excludedCompanies.has(pax8Cid)) continue; // silently skip excluded clients
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

      // Build service pricing map (non-Azure contracts)
      const servicePricing = new Map(); // serviceId → { unitPrice, unitCost, contractName, serviceName }
      const pricingByName  = new Map(); // serviceName.lower → entry (fallback when CSV IDs are stale)
      const m365Services   = new Map(); // serviceId → entry — only from M365 Licenses contracts
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
          const svcName = await resolveAtServiceName(sId); // cached
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

      // Azure reconciliation
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
        azureRows.push({
          company:       cname,
          pax8Lines:     azItems.length,
          pax8TotalCost: pax8AzureCost,
          atPrice:       atAzurePrice,
          variance:      atAzurePrice != null ? atAzurePrice - pax8AzureCost : null,
        });
      }

      // Regular item analysis
      let companyPax8Cost = 0, companyATBilled = 0, companyMismatches = 0, companyUnmapped = 0;
      const usedAtServiceIds = new Set();

      for (const item of regItems) {
        const qty            = Math.max(Number(item.quantity || 1), 1);
        const pax8UnitCost   = Number(item.cost || item.unitCost || 0) || (Number(item.cost_total || item.costTotal || 0) / qty);
        const pax8SuggestedPrice = Number(item.price || 0);
        const itemTotalCost  = pax8UnitCost * qty;

        const productId = item.product_id || item.productId || item.sku || '';
        const csvEntry  = csvMappings.get(mkProductKey(item)) || csvMappings.get(productId) || csvMappings.get(item.sku || '');
        const atServiceId = csvEntry?.atServiceId ?? null;

        let atUnitPrice = null;
        let status      = 'unmapped';

        if (atServiceId != null) {
          // Tier 1: exact CSV service ID match
          let pricing = servicePricing.get(atServiceId);
          // Tier 2: name match (handles stale CSV IDs)
          if (!pricing && csvEntry?.atServiceName) {
            pricing = pricingByName.get(csvEntry.atServiceName.toLowerCase());
          }
          // Tier 3: normalized product description match against service names
          if (!pricing) {
            const normalize = s => s
              .replace(/\s*\[.*?\]/g, '')      // remove [NCE] etc
              .replace(/\s*\(.*?\)/g, '')       // remove (Plan 1) etc
              .replace(/\bNew Commerce Experience\b/gi, '')
              .replace(/\bNCE\b/gi, '')
              .replace(/[^\w\s]/g, ' ')
              .replace(/\s+/g, ' ').trim().toLowerCase();
            const descNorm = normalize(item.description || '');
            let bestMatch = null, bestLen = 0;
            for (const [name, p] of pricingByName) {
              const nameNorm = normalize(name);
              if (nameNorm === descNorm) { pricing = p; break; }
              // longest common leading substring of at least 10 chars
              let common = 0;
              while (common < nameNorm.length && common < descNorm.length && nameNorm[common] === descNorm[common]) common++;
              if (common >= 10 && common > bestLen) { bestLen = common; bestMatch = p; }
            }
            if (!pricing && bestMatch) pricing = bestMatch;
          }
          if (pricing) {
            atUnitPrice = pricing.unitPrice;
            status      = 'matched';
            usedAtServiceIds.add(atServiceId);
          } else {
            status = 'not_in_contract';
          }
        }

        const atTotalBilled   = atUnitPrice != null ? atUnitPrice * qty : null;
        const marginPct       = (atUnitPrice != null && atUnitPrice > 0) ? ((atUnitPrice - pax8UnitCost) / atUnitPrice) * 100 : null;
        const totalMarginDollar = atTotalBilled != null ? atTotalBilled - itemTotalCost : null;
        const priceMismatch   = atUnitPrice != null && Math.abs(atUnitPrice - pax8SuggestedPrice) > 0.005;

        const row = {
          company: cname, sku: item.sku || '', description: item.description || '',
          qty, pax8UnitCost, pax8TotalCost: itemTotalCost, pax8SuggestedPrice,
          atUnitPrice, atTotalBilled, marginPct, totalMarginDollar, priceMismatch, status,
        };
        allRows.push(row);

        if (status === 'unmapped' || status === 'not_in_contract') {
          unmappedRows.push({ company: cname, sku: item.sku || '', description: item.description || '', reason: status === 'unmapped' ? 'No product mapping in CSV' : 'Mapped service not found in AT contract' });
          companyUnmapped++;
        }
        if (priceMismatch) { mismatches.push(row); companyMismatches++; }

        companyPax8Cost += itemTotalCost;
        if (atUnitPrice != null) companyATBilled += atUnitPrice * qty;
      }

      // Orphaned AT services — in M365 contract but no matching Pax8 subscription
      for (const [sId, entry] of m365Services) {
        if (!usedAtServiceIds.has(sId)) {
          orphanedAtRows.push({
            company:      cname,
            serviceId:    sId,
            serviceName:  entry.serviceName || '',
            unitPrice:    entry.unitPrice,
            contractName: entry.contractName,
          });
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

    const H_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
    const H_FONT  = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const BOLD    = { bold: true };
    const G_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
    const Y_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
    const O_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFED7AA' } };
    const R_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
    const AZ_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };

    function mFill(pct) {
      if (pct == null) return null;
      if (pct >= 20)  return G_FILL;
      if (pct >= 10)  return Y_FILL;
      if (pct >= 5)   return O_FILL;
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

    // ── Tab 1: Summary ──────────────────────────────────────────────────────────
    const wsSumm = wb.addWorksheet('Summary');
    wsSumm.getColumn(1).width = 36; wsSumm.getColumn(2).width = 20;

    const t1 = wsSumm.addRow(['Pax8 Margin Analysis Report']);
    t1.getCell(1).font = { bold: true, size: 16 }; wsSumm.mergeCells('A1:B1');
    wsSumm.addRow([]);
    const r3 = wsSumm.addRow(['Invoice', d.invoiceId]); r3.getCell(1).font = BOLD;
    const r4 = wsSumm.addRow(['Invoice Date', d.invoiceDate]); r4.getCell(1).font = BOLD;
    const r5 = wsSumm.addRow(['Run Date', new Date(d.runDate).toLocaleString()]); r5.getCell(1).font = BOLD;
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

    // Per-company table in Summary
    const shRow = wsSumm.addRow(['Company', 'Pax8 Cost', 'AT Billed', 'Margin %', 'Mismatches', 'Unmapped']);
    shRow.eachCell(c => { c.fill = H_FILL; c.font = H_FONT; });
    shRow.height = 20; [1,2,3,4,5,6].forEach(i => { wsSumm.getColumn(i).width = [36,16,16,12,13,12][i-1]; });
    wsSumm.autoFilter = { from: { row: shRow.number, column: 1 }, to: { row: shRow.number, column: 6 } };
    for (const c of d.companySummaries) {
      const row = wsSumm.addRow([c.company, Number(c.totalPax8Cost), Number(c.totalATBilled), c.marginPct != null ? c.marginPct / 100 : '', c.mismatches, c.unmapped]);
      row.getCell(2).numFmt = '$#,##0.00'; row.getCell(3).numFmt = '$#,##0.00'; row.getCell(4).numFmt = '0.0%';
      if (c.marginPct != null) { const f = mFill(c.marginPct); if (f) row.getCell(4).fill = f; }
    }

    // ── Tab 2: All Margins ──────────────────────────────────────────────────────
    const wsAll = wb.addWorksheet('All Margins');
    hdr(wsAll, [
      { header: 'Company',             width: 34 },
      { header: 'SKU',                 width: 22 },
      { header: 'Product',             width: 50 },
      { header: 'Qty',                 width: 8  },
      { header: 'Pax8 Unit Cost',      width: 16 },
      { header: 'Pax8 Total Cost',     width: 16 },
      { header: 'Pax8 Suggest Price',  width: 18 },
      { header: 'AT Unit Price',       width: 16 },
      { header: 'AT Total Billed',     width: 16 },
      { header: 'Total Margin $',      width: 14 },
      { header: 'Margin %',            width: 12 },
      { header: 'Price Match',         width: 13 },
      { header: 'Status',              width: 18 },
    ]);
    for (const r of d.allRows) {
      const row = wsAll.addRow([
        r.company, r.sku, r.description, r.qty,
        r.pax8UnitCost      != null ? Number(r.pax8UnitCost)      : '',
        r.pax8TotalCost     != null ? Number(r.pax8TotalCost)     : '',
        r.pax8SuggestedPrice!= null ? Number(r.pax8SuggestedPrice): '',
        r.atUnitPrice       != null ? Number(r.atUnitPrice)       : '',
        r.atTotalBilled     != null ? Number(r.atTotalBilled)     : '',
        r.totalMarginDollar != null ? Number(r.totalMarginDollar) : '',
        r.marginPct         != null ? r.marginPct / 100           : '',
        r.atUnitPrice != null ? (r.priceMismatch ? 'MISMATCH' : '✓') : 'N/A',
        r.status,
      ]);
      [5,6,7,8,9,10].forEach(n => { if (row.getCell(n).value !== '') row.getCell(n).numFmt = '$#,##0.00'; });
      if (row.getCell(11).value !== '') row.getCell(11).numFmt = '0.0%';
      if (r.marginPct != null) { const f = mFill(r.marginPct); if (f) row.getCell(11).fill = f; }
      if (r.priceMismatch) row.getCell(12).fill = O_FILL;
    }

    // ── Tab 3: Price Mismatches ─────────────────────────────────────────────────
    const wsMM = wb.addWorksheet('Price Mismatches');
    hdr(wsMM, [
      { header: 'Company',             width: 34 },
      { header: 'SKU',                 width: 22 },
      { header: 'Product',             width: 50 },
      { header: 'Qty',                 width: 8  },
      { header: 'Pax8 Suggest Price',  width: 18 },
      { header: 'AT Billed Price',     width: 16 },
      { header: 'Unit Difference',     width: 15 },
      { header: 'Total Difference',    width: 15 },
      { header: 'Pax8 Unit Cost',      width: 16 },
      { header: 'Pax8 Total Cost',     width: 16 },
      { header: 'AT Total Billed',     width: 16 },
      { header: 'Margin %',            width: 12 },
    ]);
    for (const r of d.mismatches) {
      const unitDiff  = r.atUnitPrice != null ? r.atUnitPrice - r.pax8SuggestedPrice : null;
      const totalDiff = unitDiff != null ? unitDiff * r.qty : null;
      const row = wsMM.addRow([
        r.company, r.sku, r.description, r.qty,
        Number(r.pax8SuggestedPrice),
        r.atUnitPrice  != null ? Number(r.atUnitPrice)  : '',
        unitDiff       != null ? Number(unitDiff)       : '',
        totalDiff      != null ? Number(totalDiff)      : '',
        Number(r.pax8UnitCost),
        r.pax8TotalCost != null ? Number(r.pax8TotalCost) : '',
        r.atTotalBilled != null ? Number(r.atTotalBilled) : '',
        r.marginPct != null ? r.marginPct / 100 : '',
      ]);
      [5,6,7,8,9,10,11].forEach(n => { if (row.getCell(n).value !== '') row.getCell(n).numFmt = '$#,##0.00'; });
      if (row.getCell(12).value !== '') row.getCell(12).numFmt = '0.0%';
      row.eachCell(cell => { cell.fill = O_FILL; });
      if (r.marginPct != null) { const f = mFill(r.marginPct); if (f) row.getCell(12).fill = f; }
    }

    // ── Tab 4: Azure ────────────────────────────────────────────────────────────
    const wsAz = wb.addWorksheet('Azure');
    hdr(wsAz, [
      { header: 'Company',          width: 34 },
      { header: 'Pax8 Line Items',  width: 16 },
      { header: 'Pax8 Total Cost',  width: 16 },
      { header: 'AT Program Price', width: 18 },
      { header: 'Variance',         width: 14 },
      { header: 'Note',             width: 46 },
    ]);
    for (const r of d.azureRows) {
      const row = wsAz.addRow([
        r.company, r.pax8Lines, Number(r.pax8TotalCost),
        r.atPrice != null ? Number(r.atPrice) : 'Not found in AT',
        r.variance != null ? Number(r.variance) : '',
        'Price variance expected — Azure billed at monthly actuals',
      ]);
      row.eachCell(cell => { cell.fill = AZ_FILL; });
      [3,4,5].forEach(n => { if (typeof row.getCell(n).value === 'number') row.getCell(n).numFmt = '$#,##0.00'; });
    }

    // ── Tab 5: Not Mapped ───────────────────────────────────────────────────────
    const wsUM = wb.addWorksheet('Not Mapped');
    hdr(wsUM, [
      { header: 'Company',     width: 34 },
      { header: 'SKU',         width: 22 },
      { header: 'Product',     width: 50 },
      { header: 'Reason',      width: 36 },
    ]);
    for (const r of d.unmappedRows) {
      wsUM.addRow([r.company, r.sku, r.description, r.reason]);
    }

    // ── Tab 6: No AT Contract ───────────────────────────────────────────────────
    const wsNC = wb.addWorksheet('No AT Contract');
    hdr(wsNC, [
      { header: 'Company',        width: 34 },
      { header: 'AT Company ID',  width: 16 },
    ]);
    for (const r of d.noContractRows) {
      wsNC.addRow([r.company, r.atCompanyId || '']);
    }

    // ── Tab 7: AT Only (No Pax8) ────────────────────────────────────────────────
    const wsOrph = wb.addWorksheet('AT Only (No Pax8)');
    hdr(wsOrph, [
      { header: 'Company',         width: 34 },
      { header: 'AT Service Name', width: 50 },
      { header: 'AT Unit Price',   width: 16 },
      { header: 'Contract',        width: 36 },
      { header: 'AT Service ID',   width: 16 },
      { header: 'Note',            width: 50 },
    ]);
    for (const r of (d.orphanedAtRows || [])) {
      const row = wsOrph.addRow([
        r.company, r.serviceName || '', r.unitPrice != null ? Number(r.unitPrice) : '',
        r.contractName || '', r.serviceId || '',
        'In M365 Licenses contract but no matching active Pax8 subscription',
      ]);
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

// ─── Company Mapping Sync ─────────────────────────────────────────────────────
let _lastMappingSyncResult = null; // holds AT lookup lists in memory (not persisted)

const normName = s => (s || '').toLowerCase()
  .replace(/\binc\.?\b|\bllc\.?\b|\bltd\.?\b|\bcorp\.?\b|\bco\.?\b/g, '')
  .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

ipcMain.handle('run-company-mapping-sync', async () => {
  const send = (msg, type = 'info') => mainWindow.webContents.send('mapping-log', { msg, type });

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

    // AT company lookups
    const atCById    = new Map(atCompanies.map(c => [c.id, c]));
    const atCByNorm  = new Map();
    for (const c of atCompanies) {
      const n = normName(c.companyName || c.name || '');
      if (n && !atCById.has(n)) atCByNorm.set(n, c);
    }

    const existing  = loadMappings();
    const prevByPax8 = new Map((existing.companies || []).map(c => [c.pax8Id, c]));

    const companies = [];
    let coHigh = 0, coLow = 0, coNone = 0;

    for (const co of pax8Companies) {
      const prev = prevByPax8.get(co.id);
      // Pax8 PSA integration stores AT company ID as externalId or similar
      const rawId = co.externalId ?? co.psaId ?? co.psaCompanyId ?? co.crmId
                    ?? co.psa?.companyId ?? co.provisioningId ?? null;
      const atIdNum = rawId != null ? parseInt(String(rawId), 10) || null : null;

      if (atIdNum && atIdNum > 0) {
        const atCo = atCById.get(atIdNum);
        companies.push({ pax8Id: co.id, pax8Name: co.name || '', atId: atIdNum,
          atName: atCo?.companyName || atCo?.name || prev?.atName || '',
          confidence: 'high', source: 'pax8_api', accepted: true });
        coHigh++;
      } else {
        const norm = normName(co.name || '');
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

    // ── Product/Service mappings ──────────────────────────────────────────────
    send('Fetching Pax8 active subscriptions...');
    const allSubs = await pax8Paginate(token, '/subscriptions?status=Active');
    send(`✓ ${allSubs.length} active subscriptions`, 'success');

    // Unique products from subscriptions — keyed by productId+term composite
    // (same product can map to different AT services based on commitment/billing term)
    const productMap = new Map(); // compositeKey → { productId, name, vendorName, vendorSku, termLabel, svcId }
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

    // Resolve product details (name, vendor, SKU) for all products
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
      const prev = prevSvcByPax8.get(key);
      const displayName = p.termLabel ? `${p.name || p.productId} — ${p.termLabel}` : (p.name || p.productId);
      const base = { pax8ProductId: key, pax8ProductName: displayName, vendorName: p.vendorName || '', vendorSku: p.vendorSku || '', termLabel: p.termLabel || '' };
      if (p.svcId && p.svcId > 0) {
        const atS = atSById.get(p.svcId);
        services.push({ ...base, atServiceId: p.svcId, atServiceName: atS?.name || prev?.atServiceName || '',
          confidence: 'high', source: 'pax8_api', accepted: true });
        svcHigh++;
      } else if (p.name) {
        const norm = normName(p.name);
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

  const companies = includeAll ? (data.companies || []) : (data.companies || []).filter(c => !c.atId);
  const coHeader = 'pax8_company_id,pax8_company_name,at_company_id,at_company_name,confidence,accepted,excluded\n';
  const coRows   = companies
    .map(c => [c.pax8Id, c.pax8Name, c.atId ?? '', c.atName ?? '', c.confidence, c.accepted ? 'yes' : 'no', c.excluded ? 'yes' : 'no']
    .map(esc).join(',')).join('\n');

  const services = includeAll ? (data.services || []) : (data.services || []).filter(s => !s.atServiceId);
  const svcHeader = 'pax8_product_id,pax8_product_name,term,vendor_name,vendor_sku,at_service_id,at_service_name,confidence,accepted\n';
  const svcRows   = services
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

  // Also write a full AT services reference list if available
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
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: type === 'companies' ? 'Import Company Mappings CSV' : 'Import Service Mappings CSV',
    defaultPath: __dirname,
    filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    properties: ['openFile'],
  });
  if (!filePaths || !filePaths[0]) return { cancelled: true };

  const lines = fs.readFileSync(filePaths[0], 'utf8').split(/\r?\n/);
  const header = lines[0].toLowerCase().replace(/\s/g, '');
  const existing = loadMappings();

  if (type === 'companies') {
    const cols_h  = header.split(',');
    const idxPax8Id   = cols_h.indexOf('pax8_company_id');
    const idxPax8Name = cols_h.indexOf('pax8_company_name');
    const idxAtId     = cols_h.indexOf('at_company_id');
    const idxAtName   = cols_h.indexOf('at_company_name');
    const idxAccepted = cols_h.indexOf('accepted');
    const idxExcluded = cols_h.indexOf('excluded');
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
    // Auto-detect Pax8 PSA export format: "product id, product name, psa product id, psa product name"
    const isPsaExport = cols_h.some(c => c.trim() === 'product id') && cols_h.some(c => c.trim() === 'psa product id');

    let idxPid, idxPname, idxSvcId, idxSvcName, idxAccepted;
    if (isPsaExport) {
      idxPid    = cols_h.findIndex(c => c.trim() === 'product id');
      idxPname  = cols_h.findIndex(c => c.trim() === 'product name');
      idxSvcId  = cols_h.findIndex(c => c.trim() === 'psa product id');
      idxSvcName= cols_h.findIndex(c => c.trim() === 'psa product name');
      idxAccepted = -1;
    } else {
      idxPid    = cols_h.indexOf('pax8_product_id');
      idxPname  = cols_h.indexOf('pax8_product_name');
      idxSvcId  = cols_h.indexOf('at_service_id');
      idxSvcName= cols_h.indexOf('at_service_name');
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

// ─── Invoice Processor ────────────────────────────────────────────────────────
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

// Normalize invoice items from either CSV row or Pax8 API item into a common shape
function normalizeInvoiceItem(item) {
  return {
    company_name:            item.company_name || item.companyName || '',
    company_id:              String(item.company_id || item.companyId || ''),
    type:                    item.type || item.chargeType || '',
    description:             item.description || '',
    quantity:                parseFloat(item.quantity) || 0,
    cost:                    parseFloat(item.cost ?? item.unitCost) || 0,
    cost_total:              parseFloat(item.cost_total ?? item.costTotal) || 0,
    price:                   parseFloat(item.price ?? item.unitPrice) || 0,
    subtotal:                parseFloat(item.subtotal) || 0,
    partner_subtotal:        parseFloat(item.partner_subtotal ?? item.costTotal ?? item.cost_total ?? item.partnerSubtotal)
                             || (parseFloat((item.cost ?? item.unitCost) || 0) * parseFloat(item.quantity || 1))
                             || parseFloat(item.total ?? item.amount_due) || 0,
    sku:                     item.sku || '',
    invoice_date:            item.invoice_date || item.invoiceDate || '',
  };
}

// Shared processing logic — works on normalized rows from CSV or API
function processInvoiceRows(rows, defaultMarginPct, mappingData) {
  const companyMap = new Map();
  for (const c of (mappingData?.companies || [])) {
    if (c.pax8Id) companyMap.set(c.pax8Id, { atCompanyId: c.atId || null, atCompanyName: c.atName || '' });
  }

  const qboTotals  = { o365: 0, azure: 0, nerdio: 0, exclaimer: 0, ironscales: 0, printix: 0, intuit: 0, 'one-time': 0 };
  const azureMap   = new Map();
  const oneTimeRows = [];
  const serviceMap = { nerdio: new Map(), exclaimer: new Map(), ironscales: new Map(), printix: new Map(), intuit: new Map() };

  for (const row of rows) {
    const cat = categorizeInvoiceLine(row);
    const amt = row.partner_subtotal;
    if (cat in qboTotals) qboTotals[cat] += amt;

    if (cat === 'azure') {
      const key = row.company_name;
      if (!azureMap.has(key)) azureMap.set(key, { pax8CompanyId: row.company_id, cost: 0 });
      azureMap.get(key).cost += amt;
    } else if (cat === 'one-time') {
      oneTimeRows.push({ company: row.company_name, pax8CompanyId: row.company_id, sku: row.sku,
        description: row.description, qty: row.quantity,
        unitCost: row.cost, costTotal: row.cost_total, unitPrice: row.price, subtotal: row.subtotal });
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

ipcMain.handle('browse-invoice-csv', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
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

    const invoiceName = path.basename(filePath, path.extname(filePath));
    const firstDate   = rows.find(r => r.invoice_date)?.invoice_date || '';
    const invoiceDate = firstDate ? firstDate.split('T')[0] : '';
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

// Fetch list of recent Pax8 invoices for the picker
ipcMain.handle('fetch-pax8-invoice-list', async () => {
  try {
    const token    = await getPax8Token();
    const invoices = await pax8Paginate(token, '/invoices');
    invoices.sort((a, b) => new Date(b.invoiceDate || 0) - new Date(a.invoiceDate || 0));
    return { success: true, invoices: invoices.slice(0, 18).map(inv => ({
      id: inv.id, invoiceDate: inv.invoiceDate || '', total: inv.total ?? inv.amount ?? null,
      label: `${inv.invoiceDate || inv.id}  —  $${Number(inv.total ?? inv.amount ?? 0).toFixed(2)}`
    })) };
  } catch (e) { return { success: false, error: e.message }; }
});

// Process a Pax8 invoice directly from the API (no CSV needed)
ipcMain.handle('process-pax8-invoice', async (_, { invoiceId, invoiceDate, defaultMarginPct = 20 }) => {
  try {
    const token = await getPax8Token();
    const items = await pax8FetchInvoiceItems(token, invoiceId);
    const rows  = items.map(normalizeInvoiceItem);
    const { qboTotals, total, azureArr, oneTimeRows, nerdio, exclaimer, ironscales, printix, intuit } =
      processInvoiceRows(rows, defaultMarginPct, loadMappings());
    return { success: true, invoiceId, invoiceDate, totalLines: rows.length,
      qbo: { o365: qboTotals.o365, azure: qboTotals.azure, nerdio: qboTotals.nerdio,
        exclaimer: qboTotals.exclaimer, ironscales: qboTotals.ironscales, printix: qboTotals.printix,
        intuit: qboTotals.intuit, oneTime: qboTotals['one-time'], total },
      azure: azureArr, oneTime: oneTimeRows, nerdio, exclaimer, ironscales, printix, intuit };
  } catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('export-invoice-breakdown', async (_, data) => {
  try {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Pax8 Hub';
    wb.created = new Date();

    const ORANGE = 'FFD0641C';
    const WHITE  = 'FFFFFFFF';
    const GREEN  = 'FFD6F5DD';
    const YELLOW = 'FFFFF8CC';
    const LIGHT_ORANGE = 'FFFFEEDD';
    const LIGHT_RED    = 'FFFFD6CC';
    const LIGHT_BLUE   = 'FFD6EEFF';
    const LIGHT_PURPLE = 'FFEEDBFF';
    const LIGHT_GREEN  = 'FFD6F5DD';
    const LIGHT_TEAL   = 'FFD6F5F0';
    const LIGHT_GRAY   = 'FFF5F5F5';

    function hdrStyle(fill) {
      return { font: { bold: true, color: { argb: WHITE } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fill || ORANGE } }, alignment: { vertical: 'middle' } };
    }
    function applyHdr(row, fill) {
      row.eachCell(cell => { cell.style = hdrStyle(fill); });
      row.height = 18;
    }
    function cellFill(argb) {
      return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    }
    function cur(v) { return { numFmt: '$#,##0.00', value: Math.round(v * 100) / 100 }; }
    function pct(v) { return { numFmt: '0.0"%"', value: v }; }

    // ── Sheet 1: Summary ──────────────────────────────────────────────────────
    const ws1 = wb.addWorksheet('Summary');
    ws1.columns = [{ width: 34 }, { width: 58 }, { width: 16 }];

    applyHdr(ws1.addRow(['Invoice Breakdown Summary', '', '']), ORANGE);
    ws1.mergeCells('A1:C1');
    ws1.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

    ws1.addRow([]);
    ws1.addRow(['Invoice ID',   data.invoiceId,   '']);
    ws1.addRow(['Invoice Date', data.invoiceDate, '']);
    ws1.addRow(['Total Lines',  data.totalLines,  '']);
    ws1.addRow(['Grand Total (Partner Cost)', '', data.qbo.total]);
    ws1.getCell('C6').numFmt = '$#,##0.00';
    ws1.addRow([]);

    applyHdr(ws1.addRow(['Category', 'QBO Account', 'Amount']), ORANGE);
    const qboRows = [
      ['Microsoft O365', QBO_ACCOUNTS.o365.account, data.qbo.o365],
      ['Azure',          QBO_ACCOUNTS.azure.account, data.qbo.azure],
      ['Nerdio',         QBO_ACCOUNTS.nerdio.account, data.qbo.nerdio],
      ['Exclaimer',      QBO_ACCOUNTS.exclaimer.account, data.qbo.exclaimer],
      ['Ironscales',     QBO_ACCOUNTS.ironscales.account, data.qbo.ironscales],
      ['Printix',        QBO_ACCOUNTS.printix.account, data.qbo.printix],
      ['Intuit/QBO',     QBO_ACCOUNTS.intuit.account, data.qbo.intuit],
      ['One-Time',       QBO_ACCOUNTS['one-time'].account, data.qbo.oneTime],
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

    // ── Sheet 2: Azure per Client ─────────────────────────────────────────────
    const ws2 = wb.addWorksheet('Azure per Client');
    ws2.columns = [{ width: 32 }, { width: 28 }, { width: 16 }, { width: 12 }, { width: 16 }];
    applyHdr(ws2.addRow(['Company', 'AT Company', 'Pax8 Cost', 'Margin %', 'Client Price']), ORANGE);

    let azTotal = 0, azPriceTotal = 0;
    (data.azure || []).forEach(row => {
      const price = row.marginPct < 100 ? row.cost / (1 - row.marginPct / 100) : row.cost;
      azTotal += row.cost; azPriceTotal += price;
      const r = ws2.addRow([row.company, row.atCompanyName || '(not mapped)', row.cost, row.marginPct / 100, price]);
      r.getCell(3).numFmt = '$#,##0.00';
      r.getCell(4).numFmt = '0.0%';
      r.getCell(5).numFmt = '$#,##0.00';
      const fillArgb = row.marginPct >= 20 ? LIGHT_GREEN : row.marginPct >= 10 ? YELLOW : LIGHT_ORANGE;
      r.eachCell(cell => { cell.fill = cellFill(fillArgb); });
    });
    const azTotRow = ws2.addRow(['TOTALS', '', azTotal, '', azPriceTotal]);
    azTotRow.font = { bold: true };
    azTotRow.getCell(3).numFmt = '$#,##0.00';
    azTotRow.getCell(5).numFmt = '$#,##0.00';
    azTotRow.eachCell(cell => { cell.fill = cellFill('FFFFDDB8'); });

    // ── Sheet 3: One-Time Charges ─────────────────────────────────────────────
    const ws3 = wb.addWorksheet('One-Time Charges');
    ws3.columns = [{ width: 28 }, { width: 20 }, { width: 32 }, { width: 8 }, { width: 13 }, { width: 13 }, { width: 13 }, { width: 13 }];
    applyHdr(ws3.addRow(['Company', 'SKU', 'Description', 'Qty', 'Unit Cost', 'Total Cost', 'Unit Price', 'Total Price']), ORANGE);
    (data.oneTime || []).forEach(row => {
      const r = ws3.addRow([row.company, row.sku, row.description, row.qty, row.unitCost, row.costTotal, row.unitPrice, row.subtotal]);
      r.getCell(5).numFmt = '$#,##0.00';
      r.getCell(6).numFmt = '$#,##0.00';
      r.getCell(7).numFmt = '$#,##0.00';
      r.getCell(8).numFmt = '$#,##0.00';
      r.eachCell(cell => { cell.fill = cellFill(YELLOW); });
    });

    // ── Sheet 4: Service Quantities ───────────────────────────────────────────
    const ws4 = wb.addWorksheet('Service Quantities');
    ws4.columns = [{ width: 32 }, { width: 14 }];
    const svcs = [
      { key: 'nerdio',     label: 'Nerdio',     fill: LIGHT_BLUE },
      { key: 'exclaimer',  label: 'Exclaimer',  fill: LIGHT_PURPLE },
      { key: 'ironscales', label: 'Ironscales', fill: LIGHT_ORANGE },
      { key: 'printix',    label: 'Printix',    fill: LIGHT_TEAL },
      { key: 'intuit',     label: 'Intuit/QBO', fill: LIGHT_GREEN },
    ];
    svcs.forEach(svc => {
      const rows = data[svc.key] || [];
      if (!rows.length) return;
      applyHdr(ws4.addRow([svc.label, 'Quantity']), ORANGE);
      rows.forEach(row => {
        const r = ws4.addRow([row.company, row.qty]);
        r.eachCell(cell => { cell.fill = cellFill(svc.fill); });
      });
      ws4.addRow([]);
    });

    // ── Sheet 5: O365 Detail ──────────────────────────────────────────────────
    const ws5 = wb.addWorksheet('O365 Detail');
    ws5.columns = [{ width: 32 }, { width: 16 }];
    applyHdr(ws5.addRow(['Company', 'O365 Total']), ORANGE);

    // Build O365 totals — need to recalculate from original data not passed here,
    // so we just show a note if raw breakdown wasn't passed
    if (data.o365Companies && data.o365Companies.length) {
      data.o365Companies.forEach((row, i) => {
        const r = ws5.addRow([row.company, row.total]);
        r.getCell(2).numFmt = '$#,##0.00';
        r.eachCell(cell => { cell.fill = cellFill(i % 2 === 0 ? LIGHT_GRAY : WHITE); });
      });
    } else {
      ws5.addRow(['O365 total (all companies)', data.qbo.o365]).getCell(2).numFmt = '$#,##0.00';
    }

    // Save
    const downloadsDir = app.getPath('downloads');
    const safeName = (data.invoiceId || 'invoice').replace(/[^\w\-\.]/g, '_');
    const outPath = path.join(downloadsDir, `Pax8_Invoice_Breakdown_${safeName}.xlsx`);
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
      lines.push('');
      lines.push('--- NEEDS MANUAL LOOKUP (no AT mapping) ---');
      for (const row of unmapped) {
        const price = Number(row.price ?? 0);
        lines.push('');
        lines.push(`Company: ${row.company} (AT ID: NOT MAPPED)`);
        lines.push(`unitCost = $${row.cost.toFixed(2)} | unitPrice = $${price.toFixed(2)}`);
      }
    }
    return { prompt: lines.join('\n') };
  } catch (e) {
    return { prompt: `Error generating prompt: ${e.message}` };
  }
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
      // New double-brace placeholders
      .replace(/\{\{INVOICE_ID\}\}/g,          invoiceId)
      .replace(/\{\{INVOICE_DATE\}\}/g,         invoiceDate)
      .replace(/\{\{BILLING_MONTH_START\}\}/g,  billingStart)
      .replace(/\{\{BILLING_MONTH_END\}\}/g,    billingEnd)
      // Legacy single-brace placeholders
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
      lines.push('');
      lines.push(`--- ${svc.label} ---`);
      for (const row of rows) {
        const atPart = row.atCompanyId ? ` (AT ID: ${row.atCompanyId})` : ' (AT ID: NOT MAPPED)';
        lines.push(`Company: ${row.company}${atPart} — Qty: ${row.qty}`);
      }
    }
    return { prompt: lines.join('\n') };
  } catch (e) {
    return { prompt: `Error generating service prompt: ${e.message}` };
  }
});

// ─── Kaseya Invoice Processor ─────────────────────────────────────────────────
const KASEYA_SETTINGS_FILE = path.join(__dirname, 'pax8hub-kaseya-settings.json');

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

const DEFAULT_KASEYA_PROMPT_HEADER =
`You are updating Autotask ContractService records for services billed through Kaseya.
Invoice Reference: {invoiceRef}
Billing Period: {billingStart} through {billingEnd}

[Configure this prompt template in Settings → Kaseya Settings]

Services and quantities to update:`;

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

  // SaaS Protection
  const saas = modules['SaaS Protection']?.total || 0;
  if (saas !== 0) {
    const bundled = r2(saas * settings.saas.bundledPct / 100);
    entries.push({ description: `Datto SaaS – Standalone (${100 - settings.saas.bundledPct}%)`, amount: r2(saas - bundled), account: KASEYA_QBO.saasStandalone, class: '' });
    if (bundled !== 0) entries.push({ description: `Datto SaaS – Bundled (${settings.saas.bundledPct}%)`, amount: bundled, account: KASEYA_QBO.saasBundled, class: '' });
  }

  // DWP + DFP
  const dwp = modules['DWP']?.total || 0;
  const dfp = modules['DFP']?.total || 0;
  if (dwp !== 0 || dfp !== 0) {
    const dwpBundled = r2(dwp * settings.dwp.bundledPct / 100);
    entries.push({ description: `DWP + DFP – Standalone (${100 - settings.dwp.bundledPct}%)`, amount: r2((dwp - dwpBundled) + dfp), account: KASEYA_QBO.dwpStandalone, class: '' });
    if (dwpBundled !== 0) entries.push({ description: `DWP – Bundled (${settings.dwp.bundledPct}%)`, amount: dwpBundled, account: KASEYA_QBO.dwpBundled, class: '' });
  }

  // PSA (Autotask)
  const psa = modules['PSA']?.total || 0;
  if (psa !== 0) {
    const { strategic, serviceDelivery, admin, coManaged } = settings.psa;
    entries.push({ description: `PSA – Strategic Services (${strategic}%)`,   amount: r2(psa * strategic      / 100), account: KASEYA_QBO.cloudTools, class: 'Strategic Services' });
    entries.push({ description: `PSA – Service Delivery (${serviceDelivery}%)`, amount: r2(psa * serviceDelivery / 100), account: KASEYA_QBO.cloudTools, class: 'Service Delivery' });
    entries.push({ description: `PSA – Admin (${admin}%)`,                    amount: r2(psa * admin          / 100), account: KASEYA_QBO.cloudTools, class: 'Admin' });
    entries.push({ description: `PSA – Co-Managed (${coManaged}%)`,           amount: r2(psa * coManaged      / 100), account: KASEYA_QBO.cloudTools, class: '' });
  }

  // RMM
  const rmm = modules['RMM']?.total || 0;
  if (rmm !== 0) {
    const { strategic, serviceDelivery } = settings.rmm;
    entries.push({ description: `Datto RMM – Strategic Services (${strategic}%)`,   amount: r2(rmm * strategic      / 100), account: KASEYA_QBO.itsTools, class: 'Strategic Services' });
    entries.push({ description: `Datto RMM – Service Delivery (${serviceDelivery}%)`, amount: r2(rmm * serviceDelivery / 100), account: KASEYA_QBO.itsTools, class: 'Service Delivery' });
  }

  // IT Glue
  const itGlue = modules['IT Glue']?.total || 0;
  if (itGlue !== 0) {
    const { strategic, serviceDelivery, admin } = settings.itGlue;
    entries.push({ description: `IT Glue – Strategic Services (${strategic}%)`,   amount: r2(itGlue * strategic      / 100), account: KASEYA_QBO.itsTools, class: 'Strategic Services' });
    entries.push({ description: `IT Glue – Service Delivery (${serviceDelivery}%)`, amount: r2(itGlue * serviceDelivery / 100), account: KASEYA_QBO.itsTools, class: 'Service Delivery' });
    entries.push({ description: `IT Glue – Admin (${admin}%)`,                    amount: r2(itGlue * admin          / 100), account: KASEYA_QBO.itsTools, class: 'Admin' });
  }

  // Cloud Continuity
  const continuity = modules['Cloud Continuity']?.total || 0;
  if (continuity !== 0) entries.push({ description: 'Datto Cloud Continuity', amount: continuity, account: KASEYA_QBO.bdr, class: '' });

  // BCDR (includes Azure Cloud Siris)
  const bcdr = (modules['BCDR']?.total || 0) + (modules['Azure Cloud Siris']?.total || 0);
  if (bcdr !== 0) entries.push({ description: 'Datto BCDR (reconcile separately)', amount: bcdr, account: KASEYA_QBO.bdr, class: '', manual: true });

  // Networking
  const networking = modules['Networking']?.total || 0;
  if (networking !== 0) entries.push({ description: 'Networking (reconcile separately)', amount: networking, account: KASEYA_QBO.networking, class: '', manual: true });

  // Antivirus / Bitdefender
  const av = modules['Antivirus']?.total || 0;
  if (av !== 0) entries.push({ description: 'BitDefender Antivirus', amount: av, account: KASEYA_QBO.antivirus, class: '' });

  // ConnectBooster (try several possible module names)
  const cbNames = ['ConnectBooster', 'Connect Booster', 'Connectbooster', 'connectbooster'];
  for (const name of cbNames) {
    const cb = modules[name]?.total || 0;
    if (cb !== 0) { entries.push({ description: 'ConnectBooster', amount: cb, account: KASEYA_QBO.cloudTools, class: '' }); break; }
  }

  // Payment module (often ConnectBooster in Kaseya) — flag for review
  if (modules['Payment']?.total) {
    entries.push({ description: 'Payment/Credit (verify in QB)', amount: modules['Payment'].total, account: KASEYA_QBO.cloudTools, class: '', manual: true });
  }

  // Catch unrecognized modules
  const known = new Set(['SaaS Protection', 'DWP', 'DFP', 'PSA', 'RMM', 'IT Glue',
    'Cloud Continuity', 'BCDR', 'Azure Cloud Siris', 'Networking', 'Antivirus',
    'ConnectBooster', 'Connect Booster', 'Connectbooster', 'connectbooster', 'Payment']);
  for (const [name, data] of Object.entries(modules)) {
    if (!known.has(name) && data.total !== 0) {
      entries.push({ description: `${name} (unclassified — check manually)`, amount: data.total, account: '(unknown)', class: '', manual: true });
    }
  }

  return entries;
}

ipcMain.handle('get-kaseya-settings', () => loadKaseyaSettings());

ipcMain.handle('save-kaseya-settings', (_, settings) => {
  fs.writeFileSync(KASEYA_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  return { success: true };
});

ipcMain.handle('browse-kaseya-xls', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
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

    // Try Details2 first (has Company Name), fall back to Details, then any sheet
    const sheetName = wb.SheetNames.find(n => n === 'Details2')
                   || wb.SheetNames.find(n => n === 'Details')
                   || wb.SheetNames.find(n => /detail/i.test(n))
                   || wb.SheetNames[0];
    if (!sheetName) throw new Error('No sheets found in workbook.');
    const ws   = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!rows.length) {
      // Try to figure out what sheets exist for better error message
      throw new Error(`No data rows in sheet "${sheetName}". Available sheets: ${wb.SheetNames.join(', ')}`);
    }

    // Detect column names from first row
    const sample = rows[0];
    const keys   = Object.keys(sample);

    // Flexible column finders (case-insensitive substring match)
    const findCol = (...candidates) =>
      candidates.find(c => c in sample) ||
      keys.find(k => candidates.some(c => k.toLowerCase().includes(c.toLowerCase())));

    const companyCol  = findCol('Company Name', 'Organization (Client) Name', 'Client Name', 'Company', 'Client');
    const moduleCol   = findCol('Module', 'Product Module', 'Category', 'Module Name');
    const qtyCol      = findCol('Billed Quantity', 'Quantity', 'Qty', 'Units');
    const rateCol     = findCol('Rate', 'Unit Rate', 'Unit Price', 'Price');
    const totalCol    = findCol('Total (Pre-Tax)', 'Total Pre-Tax', 'Monthly Fee', 'Total', 'Amount', 'Subtotal');
    const descCol     = findCol('Product Description', 'Description', 'Item Description', 'Product Name');
    const productCol  = findCol('Product Item', 'Product', 'Item', 'SKU');
    const svcStartCol = findCol('Service Period Start Date', 'Start Date', 'Period Start');

    if (!companyCol) throw new Error(`Cannot find a company/client column. Columns found: ${keys.slice(0, 15).join(', ')}`);
    if (!moduleCol)  throw new Error(`Cannot find a module/category column. Columns found: ${keys.slice(0, 15).join(', ')}`);
    if (!totalCol)   throw new Error(`Cannot find a total/amount column. Columns found: ${keys.slice(0, 15).join(', ')}`);

    // Extract billing date from filename: K00340989_YYYYMMDD_CI_xxx
    const fname      = path.basename(filePath, path.extname(filePath));
    const dateMatch  = fname.match(/_(\d{8})_/);
    const invoiceDate = dateMatch
      ? `${dateMatch[1].slice(0,4)}-${dateMatch[1].slice(4,6)}-${dateMatch[1].slice(6,8)}`
      : '';
    const billingStart = firstOfCurrentMonth(invoiceDate);
    const billingEnd   = lastOfCurrentMonth(invoiceDate);

    const moduleMap = new Map();  // module → { total, qty, lines[] }
    const clientMap = new Map();  // company → { total, modules: Map }

    for (const row of rows) {
      const company = String(row[companyCol] || '').trim();
      const module  = String(row[moduleCol]  || '').trim();
      const qty     = parseFloat(String(row[qtyCol]   || '').replace(/,/g, '')) || 0;
      const rate    = parseFloat(String(row[rateCol]  || '').replace(/[$,]/g, '')) || 0;
      const total   = parseFloat(String(row[totalCol] || '').replace(/[$,]/g, '')) || 0;
      const desc    = descCol     ? String(row[descCol]     || '').trim() : '';
      const product = productCol  ? String(row[productCol]  || '').trim() : '';
      const svcStart = svcStartCol ? String(row[svcStartCol] || '').trim() : '';

      if (!company || !module) continue;

      // Module map
      if (!moduleMap.has(module)) moduleMap.set(module, { total: 0, qty: 0, lines: [] });
      const mod = moduleMap.get(module);
      mod.total += total;
      mod.qty   += qty;
      mod.lines.push({ company, desc, product, qty, rate, total, svcStart });

      // Client map
      if (!clientMap.has(company)) clientMap.set(company, { total: 0, modules: new Map() });
      const client = clientMap.get(company);
      client.total += total;
      if (!client.modules.has(module)) client.modules.set(module, { total: 0, qty: 0 });
      client.modules.get(module).total += total;
      client.modules.get(module).qty   += qty;
    }

    // Serialize
    const modules = {};
    for (const [name, data] of moduleMap) {
      modules[name] = { total: parseFloat(data.total.toFixed(2)), qty: data.qty };
    }

    const clients = [];
    for (const [name, data] of clientMap) {
      const mods = {};
      for (const [mName, mData] of data.modules) mods[mName] = parseFloat(mData.total.toFixed(2));
      clients.push({ name, total: parseFloat(data.total.toFixed(2)), modules: mods });
    }
    clients.sort((a, b) => a.name.localeCompare(b.name));

    const settings   = loadKaseyaSettings();
    const qboEntries = buildKaseyaQboEntries(modules, settings);
    const grandTotal = parseFloat(clients.reduce((s, c) => s + c.total, 0).toFixed(2));

    return {
      success: true, fileName: fname, invoiceDate, billingStart, billingEnd,
      modules, clients, qboEntries, grandTotal, totalLines: rows.length,
      sheetUsed: sheetName,
      columnsDetected: { company: companyCol, module: moduleCol, qty: qtyCol, rate: rateCol, total: totalCol }
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('export-kaseya-report', async (_, data) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Kaseya Report',
      defaultPath: `Kaseya-${data.billingStart || 'report'}.xlsx`,
      filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
    });
    if (result.canceled) return { canceled: true };

    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ORANGE = 'FFD0641C', LIGHT_OR = 'FFFFDDB8', YELLOW = 'FFFFF3B0', RED_BG = 'FFFFE0D0';
    const applyHdr = (row, argb) => {
      row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }; c.alignment = { vertical: 'middle' }; });
    };
    const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
    const fmt$ = '$#,##0.00';

    // Sheet 1: QBO Entries
    const ws1 = wb.addWorksheet('QBO Entries');
    ws1.columns = [{ width: 48 }, { width: 58 }, { width: 20 }, { width: 14 }];
    applyHdr(ws1.addRow(['Description', 'QBO Account', 'Class', 'Amount']), ORANGE);
    let qboTotal = 0;
    for (const e of (data.qboEntries || [])) {
      const row = ws1.addRow([e.description, e.account, e.class || '', e.amount]);
      row.getCell(4).numFmt = fmt$;
      if (e.manual) row.eachCell(c => { c.fill = fill(YELLOW); });
      qboTotal += e.amount;
    }
    const tot1 = ws1.addRow(['TOTAL', '', '', qboTotal]);
    tot1.font = { bold: true }; tot1.getCell(4).numFmt = fmt$;
    tot1.eachCell(c => { c.fill = fill(LIGHT_OR); });

    // Sheet 2: Module Summary
    const ws2 = wb.addWorksheet('Module Summary');
    ws2.columns = [{ width: 28 }, { width: 14 }];
    applyHdr(ws2.addRow(['Module', 'Total']), ORANGE);
    const modEntries = Object.entries(data.modules || {}).sort((a, b) => b[1].total - a[1].total);
    let modTotal = 0;
    for (const [name, m] of modEntries) {
      const row = ws2.addRow([name, m.total]);
      row.getCell(2).numFmt = fmt$;
      modTotal += m.total;
    }
    const tot2 = ws2.addRow(['GRAND TOTAL', modTotal]);
    tot2.font = { bold: true }; tot2.getCell(2).numFmt = fmt$;
    tot2.eachCell(c => { c.fill = fill(LIGHT_OR); });

    // Sheet 3: Client Breakdown
    const allModules = Object.keys(data.modules || {}).sort();
    const ws3 = wb.addWorksheet('Client Breakdown');
    ws3.columns = [{ width: 32 }, ...allModules.map(() => ({ width: 14 })), { width: 14 }];
    applyHdr(ws3.addRow(['Company', ...allModules, 'Total']), ORANGE);
    for (const client of (data.clients || [])) {
      const vals = allModules.map(m => client.modules[m]?.total || '');
      const row  = ws3.addRow([client.company, ...vals, client.total]);
      const lastCol = allModules.length + 2;
      for (let c = 2; c <= lastCol; c++) {
        if (row.getCell(c).value !== '') row.getCell(c).numFmt = fmt$;
      }
    }

    // Sheet 4: Raw Line Items (from modules.lines — not stored in data, but modules totals are)
    // We store module totals only, so sheet 4 is a client×module pivot
    ws3.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: allModules.length + 2 } };

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
        lines.push(`Company: ${c.company} — Qty: ${Math.ceil(m.qty)} | Cost: $${m.total.toFixed(2)}`);
      }
    }
    return { prompt: lines.join('\n') };
  } catch (e) { return { prompt: `Error: ${e.message}` }; }
});

// ─── Tool Visibility ──────────────────────────────────────────────────────────
const TOOL_VIS_KEY = 'tool_visibility';
const DEFAULT_TOOL_VIS = {
  'subscription-audit':  true,
  'invoice-monitor':     true,
  'margin-analyzer':     true,
  'company-mapping':     true,
  'invoice-processor':   true,
  'kaseya-processor':    true,
};

ipcMain.handle('get-tool-visibility', async () => {
  try {
    const raw = await keytar.getPassword(SERVICE_NAME, TOOL_VIS_KEY);
    if (!raw) return { ...DEFAULT_TOOL_VIS };
    return { ...DEFAULT_TOOL_VIS, ...JSON.parse(raw) };
  } catch { return { ...DEFAULT_TOOL_VIS }; }
});

ipcMain.handle('save-tool-visibility', async (_, vis) => {
  await keytar.setPassword(SERVICE_NAME, TOOL_VIS_KEY, JSON.stringify(vis));
  return { success: true };
});

// ─── Margin Scheduler ─────────────────────────────────────────────────────────
async function checkMarginSchedule() {
  try {
    const enabled = await keytar.getPassword(SERVICE_NAME, 'margin_schedule_enabled');
    if (enabled === 'false') return;
    const dayStr = await keytar.getPassword(SERVICE_NAME, 'margin_schedule_day') || '10';
    const today  = new Date();
    if (today.getDate() !== parseInt(dayStr)) return;
    const state = readState();
    if (state.marginLastRun) {
      const last = new Date(state.marginLastRun);
      if (last.getFullYear() === today.getFullYear() && last.getMonth() === today.getMonth()) return;
    }
    // Run is due — trigger analysis
    mainWindow.webContents.send('margin-log', { msg: '⏰ Scheduled margin analysis starting...', type: 'info' });
    const result = await ipcMain.emit('run-margin-analysis', null, {});
    const { Notification } = require('electron');
    new Notification({ title: 'Pax8 Hub — Margin Report', body: 'Monthly margin analysis complete. Report saved to Downloads.' }).show();
  } catch (e) { console.error('Margin scheduler error:', e); }
}

app.whenReady().then(() => {
  setTimeout(checkMarginSchedule, 5000); // check 5s after startup
  setInterval(checkMarginSchedule, 60 * 60 * 1000); // re-check every hour
});

// ─── Contract Changes ─────────────────────────────────────────────────────────

// Classify a display name as 'ai', 'integration', 'human', or 'system'.
// Rules (first match wins):
//   AI:          any account whose name includes "API Account" (future standard)
//                OR legacy account "Claude Integration" / "Integration Claude"
//   Integration: platform sync accounts — Pax8/Licensing or "Integration"
//                without "Claude" (e.g. Pax8↔Autotask sync, Licensing, Pax8)
//   System:      empty name (workflow-fired with no user token in title)
//   Human:       everyone else
function classifyActor(changedBy) {
  if (!changedBy) return 'system';
  const n = changedBy.toLowerCase();
  if (n.includes('api account'))                          return 'ai';
  if (n.includes('claude') && n.includes('integration')) return 'ai';
  if (n.includes('licensing') || n.includes('pax8'))     return 'integration';
  if (n.includes('integration'))                         return 'integration';
  return 'human';
}

// Fetch records from any entity by a list of IDs using the "in" operator.
// Chunks automatically to stay under API limits (~500 per call).
async function atBatchLookup(entity, ids) {
  if (!ids || !ids.length) return [];
  const CHUNK = 200;
  const results = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    try {
      const r = await atFetch(`/${entity}/query`, {
        method: 'POST',
        body: JSON.stringify({ filter: [{ op: 'in', field: 'id', value: chunk }] }),
      });
      results.push(...(r.items || []));
    } catch (e) {
      console.warn(`atBatchLookup(${entity}) chunk failed:`, e.message);
    }
  }
  return results;
}

// Parse the structured description block that Autotask writes into ContractNotes
// fired by the "New Contract Created" workflow rule.  Example description body:
//   Contract Name: Acme Corp - Microsoft 365
//   Contract Type: Recurring Service
//   Category: Managed Services
//   Start Date: 01/01/2025
//   End Date: 12/31/2025
//   Business Unit: Default
function parseContractCreatedDescription(description) {
  if (!description) return {};
  const get = (label) => {
    const m = description.match(new RegExp(label + ':\\s*([^\\r\\n]+)', 'i'));
    return m ? m[1].trim() : '';
  };
  return {
    contractName: get('Contract Name'),
    startDate:    get('Start Date'),
    endDate:      get('End Date'),
    contractType: get('Contract Type'),
  };
}

function parseContractNoteTitle(title) {
  if (!title) return { changeType: 'Other', changedBy: '', serviceName: '', newValue: '', effectiveDate: '' };

  // ── Change type ────────────────────────────────────────────────────────────
  // "Unit Price was changed: ..."
  // "Unit Cost was changed: ..."
  // "Units were changed: ..."
  // "Service was added: ..."
  // "Service was removed/deleted: ..."
  let changeType = 'Other';
  // "Notification sent via Workflow Rule "New Contract Created"" — check BEFORE
  // the generic Notification catch-all so it gets its own dedicated type.
  if (/Notification sent via Workflow Rule[^"]*"New Contract Created"/i.test(title))
                                                              changeType = 'Contract Created';
  else if (/unit price/i.test(title))                        changeType = 'Unit Price';
  else if (/unit cost/i.test(title))                         changeType = 'Unit Cost';
  else if (/units were changed/i.test(title))                changeType = 'Units Changed';
  else if (/service was added/i.test(title))                 changeType = 'Service Added';
  else if (/service was (?:removed|deleted)/i.test(title))   changeType = 'Service Removed';
  else if (/note notification was sent/i.test(title))        changeType = 'Notification';
  else if (/Notification sent via Workflow Rule/i.test(title)) changeType = 'Notification';

  // ── Changed By: "User [Name]" ──────────────────────────────────────────────
  const userMatch = title.match(/User\s+\[([^\]]+)\]/);
  const changedBy = userMatch ? userMatch[1].trim() : '';

  // ── Service name ───────────────────────────────────────────────────────────
  // Units format:       "increased/decreased [SERVICE] units by [N]"
  // Price/Cost format:  "changed [SERVICE] Unit Price/Cost ..."
  // Service Added:      "added [SERVICE] to the contract"
  // Service Removed:    "removed/deleted [SERVICE] from the contract"
  //
  // Lazy .+? anchored to the next keyword prevents stopping at inner brackets
  // (e.g. "Microsoft 365 [New Commerce Experience] - Monthly").
  let serviceName = '';
  if (changeType === 'Units Changed') {
    const m = title.match(/(?:increased|decreased)\s+\[(.+?)\]\s+units\s+by\s+\[/i);
    if (m) serviceName = m[1].trim();
  } else if (changeType === 'Unit Price' || changeType === 'Unit Cost') {
    // Anchor to "] Unit " — handles both "to [VALUE]" and "from [OLD] to [NEW]" variants
    const m = title.match(/changed\s+\[(.+?)\]\s+Unit\s+(?:Price|Cost)\b/i);
    if (m) {
      serviceName = m[1].trim();
    } else {
      const fb = title.match(/changed\s+\[([^\]]+)\]/);
      if (fb) serviceName = fb[1].trim();
    }
  } else if (changeType === 'Service Added') {
    // "...added [SERVICE] to the contract effective [DATE]"
    const m = title.match(/added\s+\[(.+?)\]\s+to\s+the\s+contract/i);
    if (m) serviceName = m[1].trim();
  } else if (changeType === 'Service Removed') {
    // "...removed/deleted [SERVICE] from the contract"
    const m = title.match(/(?:removed|deleted)\s+\[(.+?)\]\s+from\s+the\s+contract/i);
    if (m) serviceName = m[1].trim();
  }

  // ── New value ──────────────────────────────────────────────────────────────
  // Units: "units by [N]" — prefix with + or - based on increased/decreased
  // Price/Cost: "to [VALUE]"
  let newValue = '';
  if (changeType === 'Units Changed') {
    const byMatch = title.match(/units\s+by\s+\[([^\]]+)\]/i);
    if (byMatch) {
      const action = title.match(/\b(increased|decreased)\b/i);
      const sign   = action ? (action[1].toLowerCase() === 'increased' ? '+' : '-') : '';
      newValue = sign + byMatch[1].trim();
    }
  } else {
    const toMatch = title.match(/\bto\s+\[([^\]]+)\]/);
    if (toMatch) newValue = toMatch[1].trim();
  }

  // ── Effective date: "effective [Date]" ────────────────────────────────────
  const dateMatch = title.match(/effective\s+\[([^\]]+)\]/);
  const effectiveDate = dateMatch ? dateMatch[1].trim() : '';

  return { changeType, changedBy, serviceName, newValue, effectiveDate };
}

ipcMain.handle('run-contract-changes', async (_, { dateFrom, dateTo, fromUtc, toUtc } = {}) => {
  try {
    // ── ContractNotes query (datetime range, ID-cursor POST pagination) ────────
    // ContractNotes returns 405 on GET nextPageUrl, so we use ID-cursor POST only.
    const noteFilters = [];
    const noteDateFrom = fromUtc || dateFrom;
    const noteDateTo   = toUtc   || dateTo;
    if (noteDateFrom) noteFilters.push({ op: 'gte', field: 'createDateTime', value: noteDateFrom });
    if (noteDateTo)   noteFilters.push({ op: 'lte', field: 'createDateTime', value: noteDateTo });

    const allNotes = [];
    let maxId = 0;
    while (true) {
      const r = await atFetch('/ContractNotes/query', {
        method: 'POST',
        body: JSON.stringify({
          filter: [...noteFilters, { op: 'gt', field: 'id', value: maxId }],
        }),
      });
      const items = r.items || [];
      if (!items.length) break;
      allNotes.push(...items);
      maxId = Math.max(...items.map(i => i.id));
      if (!r.pageDetails?.nextPageUrl) break;
    }

    const noteRows = allNotes.map(note => {
      const parsed = parseContractNoteTitle(note.title || '');
      // For "Contract Created" rows the structured data lives in the description,
      // not the title — enrich serviceName / effectiveDate / newValue from there.
      if (parsed.changeType === 'Contract Created') {
        const info = parseContractCreatedDescription(note.description || '');
        if (info.contractName) parsed.serviceName   = info.contractName;
        if (info.startDate)    parsed.effectiveDate = info.startDate;
        if (info.contractType) parsed.newValue      = info.contractType;
      }
      return {
        id:                note.id,
        contractID:        note.contractID,
        createDateTime:    note.createDateTime,
        creatorResourceID: note.creatorResourceID,
        title:             note.title       || '',
        description:       note.description || '',
        contractName:      '',
        companyName:       '',
        actorType:         'human',
        ...parsed,
      };
    });

    // ── Enrich: company name, contract name, resolved resource names ──────────
    // All three lookups run concurrently; best-effort — a failure doesn't abort.
    try {
      const contractIds = [...new Set(noteRows.map(r => r.contractID).filter(Boolean))];
      const contracts   = await atBatchLookup('Contracts', contractIds);
      const contractMap = Object.fromEntries(contracts.map(c => [c.id, c]));

      const companyIds = [...new Set(contracts.map(c => c.companyID).filter(Boolean))];
      const companies  = await atBatchLookup('Companies', companyIds);
      const companyMap = Object.fromEntries(companies.map(c => [c.id, c.companyName]));

      // Resources lookup fills in changedBy for rows where the note title had
      // no "User [Name]" token (e.g. Contract Created workflow notes).
      const resourceIds = [...new Set(
        noteRows.map(r => r.creatorResourceID).filter(id => id && id !== 4)
      )];
      const resources   = await atBatchLookup('Resources', resourceIds);
      const resourceMap = Object.fromEntries(
        resources.map(res => [res.id, `${res.firstName || ''} ${res.lastName || ''}`.trim()])
      );

      for (const row of noteRows) {
        const contract   = contractMap[row.contractID] || {};
        row.contractName = contract.contractName || '';
        row.companyName  = companyMap[contract.companyID] || '';
        // Fill changedBy from resolved resource if title had no "User [...]" token
        if (!row.changedBy && row.creatorResourceID && resourceMap[row.creatorResourceID]) {
          row.changedBy = resourceMap[row.creatorResourceID];
        }
      }
    } catch (enrichErr) {
      console.warn('Contract Changes enrichment failed:', enrichErr.message);
    }

    // Actor type is always computed — works even if enrichment failed because
    // changedBy extracted from the title text is sufficient for classification.
    for (const row of noteRows) row.actorType = classifyActor(row.changedBy);

    // ── Sort newest-first ─────────────────────────────────────────────────────
    const rows = [...noteRows];
    rows.sort((a, b) => new Date(b.createDateTime) - new Date(a.createDateTime));
    return { success: true, rows, total: rows.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('export-contract-changes-excel', async (_, rows) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Contract Changes',
    defaultPath: `contract-changes-${new Date().toISOString().slice(0, 10)}.xlsx`,
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
  });
  if (!filePath) return { cancelled: true };

  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Anchor Hub';
  wb.created = new Date();

  const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };

  // Change-type fills (light pastel so text is readable without custom font color)
  const CT_FILL = {
    'Unit Price':      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbeafe' } }, // blue tint
    'Unit Cost':       { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFffedd5' } }, // orange tint
    'Units Changed':   { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdcfce7' } }, // green tint
    'Service Added':    { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFede9fe' } }, // purple tint
    'Service Removed':  { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFfce7f3' } }, // pink tint
    'Contract Created': { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFccfbf1' } }, // teal tint
    'Notification':     { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf1f5f9' } }, // slate tint
    'Other':            { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf3f4f6' } }, // gray tint
  };
  const CT_FONT = {
    'Unit Price':       { bold: true, color: { argb: 'FF1d4ed8' } },
    'Unit Cost':        { bold: true, color: { argb: 'FFc2410c' } },
    'Units Changed':    { bold: true, color: { argb: 'FF166534' } },
    'Service Added':    { bold: true, color: { argb: 'FF6d28d9' } },
    'Service Removed':  { bold: true, color: { argb: 'FFbe185d' } },
    'Contract Created': { bold: true, color: { argb: 'FF0f766e' } },
    'Notification':     { bold: true, color: { argb: 'FF64748b' } },
    'Other':            { bold: true, color: { argb: 'FF6b7280' } },
  };

  function fmtMdt(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString('en-US', {
        timeZone: 'America/Denver',
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
      });
    } catch { return iso; }
  }

  const ACTOR_FILL = {
    ai:          { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFede9fe' } },
    integration: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFfff7ed' } },
    system:      { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf8fafc' } },
  };
  const ACTOR_FONT = {
    ai:          { bold: true, color: { argb: 'FF6d28d9' } },
    integration: { bold: true, color: { argb: 'FFc2410c' } },
    system:      { bold: true, color: { argb: 'FF94a3b8' } },
  };
  const ACTOR_LABEL = { ai: 'AI', integration: 'Integration', human: 'Human', system: 'System' };

  const ws = wb.addWorksheet('Contract Changes');

  const cols = [
    { header: 'Date / Time (MDT)', key: 'datetime',      width: 26 },
    { header: 'Company',           key: 'companyName',   width: 35 },
    { header: 'Contract Name',     key: 'contractName',  width: 40 },
    { header: 'Contract ID',       key: 'contractID',    width: 14 },
    { header: 'Changed By',        key: 'changedBy',     width: 28 },
    { header: 'Actor',             key: 'actorType',     width: 14 },
    { header: 'Change Type',       key: 'changeType',    width: 16 },
    { header: 'Service Name',      key: 'serviceName',   width: 52 },
    { header: 'New Value',         key: 'newValue',      width: 14 },
    { header: 'Effective Date',    key: 'effectiveDate', width: 20 },
  ];

  // Header row
  const hdr = ws.addRow(cols.map(c => c.header));
  hdr.height = 22;
  hdr.eachCell(cell => {
    cell.fill      = HEADER_FILL;
    cell.font      = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border    = { bottom: { style: 'medium', color: { argb: 'FF3B82F6' } } };
  });
  cols.forEach((c, i) => { ws.getColumn(i + 1).width = c.width; });

  // AutoFilter + freeze header
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  // Data rows
  const THIN = { style: 'thin', color: { argb: 'FFe2e8f0' } };
  const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN };

  for (const r of rows) {
    const ct  = r.changeType || 'Other';
    const act = r.actorType  || 'human';
    const row = ws.addRow([
      fmtMdt(r.createDateTime),
      r.companyName   || '',
      r.contractName  || '',
      r.contractID    || '',
      r.changedBy     || '',
      ACTOR_LABEL[act] || act,
      ct,
      r.serviceName   || '',
      r.newValue      || '',
      r.effectiveDate || '',
    ]);
    row.height = 17;
    row.eachCell({ includeEmpty: true }, cell => {
      cell.border    = BORDER;
      cell.alignment = { vertical: 'middle' };
    });
    // Colour Change Type cell (col 7)
    const ctCell = row.getCell(7);
    ctCell.fill = CT_FILL[ct] || CT_FILL['Other'];
    ctCell.font = CT_FONT[ct] || CT_FONT['Other'];
    // Colour Actor cell (col 6)
    if (ACTOR_FILL[act]) {
      const actCell = row.getCell(6);
      actCell.fill = ACTOR_FILL[act];
      actCell.font = ACTOR_FONT[act];
    }
  }

  await wb.xlsx.writeFile(filePath);
  shell.openPath(filePath);
  return { success: true, filePath };
});

// ─── Contract Renewals ────────────────────────────────────────────────────────
const RENEWAL_SETTINGS_FILE = path.join(USER_DATA, 'anchor-renewal-settings.json');

function loadRenewalSettings() {
  const defaults = { eligibleServices: ['Security+', 'Total CommITment', 'Total CommITment Core'], renewalInfoPrompt: '' };
  if (!fs.existsSync(RENEWAL_SETTINGS_FILE)) return defaults;
  try {
    const saved = JSON.parse(fs.readFileSync(RENEWAL_SETTINGS_FILE, 'utf8'));
    return { ...defaults, ...saved };
  }
  catch { return defaults; }
}

ipcMain.handle('get-renewal-settings', () => loadRenewalSettings());

ipcMain.handle('save-renewal-settings', (_, settings) => {
  fs.writeFileSync(RENEWAL_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  return { success: true };
});

ipcMain.handle('run-contract-renewals', async (_, { windowDays }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + windowDays);
  const fmt = d => d.toISOString().split('T')[0];
  const todayStr     = fmt(today);
  const windowEndStr = fmt(windowEnd);

  // ── Get contractCategory picklist to identify Project category ───────────
  // contractCategory is the correct field — contractType is the billing style (Fixed Price etc.)
  let projectCategoryId = null;
  try {
    const info = await atFetch('/Contracts/entityInformation/fields', { method: 'GET' });
    const fieldList = info.fieldInformation || info.fields || info.items || [];
    const catField = fieldList.find(f => (f.name || '').toLowerCase() === 'contractcategory');
    if (catField) {
      const pvList = catField.picklistValues || catField.pickListValues || [];
      const pv = pvList.find(p => /^project$/i.test((p.label || '').trim()));
      if (pv && pv.value != null) projectCategoryId = Number(pv.value);
    }
    if (projectCategoryId === null) console.warn('Could not find Project category ID in contractCategory picklist');
  } catch (e) {
    console.warn('Contract category picklist lookup failed:', e.message);
  }

  // ── Fetch expiring active contracts in window ─────────────────────────────
  const baseFilter = [
    { op: 'eq',  field: 'status',  value: 1 },
    { op: 'gte', field: 'endDate', value: todayStr },
    { op: 'lte', field: 'endDate', value: windowEndStr },
  ];
  if (projectCategoryId !== null) {
    baseFilter.push({ op: 'ne', field: 'contractCategory', value: projectCategoryId });
  }

  const contractsRaw = [];
  let lastId = 0;
  while (true) {
    const r = await atFetch('/Contracts/query', {
      method: 'POST',
      body: JSON.stringify({ filter: [...baseFilter, { op: 'gt', field: 'id', value: lastId }] }),
    });
    const items = r.items || [];
    contractsRaw.push(...items);
    if (!items.length || !r.pageDetails?.nextPageUrl) break;
    lastId = items[items.length - 1].id;
  }
  // Belt-and-suspenders: strip Project contracts client-side too
  const filtered = projectCategoryId !== null
    ? contractsRaw.filter(c => c.contractCategory !== projectCategoryId)
    : contractsRaw;

  if (!filtered.length) return { contracts: [], renewed: [] };

  // ── Batch lookup company names ────────────────────────────────────────────
  const companyIds = [...new Set(filtered.map(c => c.companyID).filter(Boolean))];
  const companies  = await atBatchLookup('Companies', companyIds);
  const companyMap = Object.fromEntries(companies.map(c => [c.id, c.companyName]));

  // ── Check for existing renewals ───────────────────────────────────────────
  // Renewal = same companyID + same contractName + startDate >= today (excluding the expiring contract itself)
  const expiringIds = new Set(filtered.map(c => c.id));
  let potentialRenewals = [];
  const CHUNK = 200;
  for (let i = 0; i < companyIds.length; i += CHUNK) {
    const chunk = companyIds.slice(i, i + CHUNK);
    let lastRenId = 0;
    while (true) {
      try {
        const r = await atFetch('/Contracts/query', {
          method: 'POST',
          body: JSON.stringify({
            filter: [
              { op: 'in',  field: 'companyID',  value: chunk },
              { op: 'gte', field: 'startDate',  value: todayStr },
              { op: 'gt',  field: 'id',         value: lastRenId },
            ],
          }),
        });
        const items = r.items || [];
        potentialRenewals.push(...items);
        if (!items.length || !r.pageDetails?.nextPageUrl) break;
        lastRenId = items[items.length - 1].id;
      } catch (e) {
        console.warn('Renewal check batch failed:', e.message);
        break;
      }
    }
  }

  // Build renewal lookup: "companyID|normalised contractName" → renewal contract
  const renewalMap = {};
  for (const r of potentialRenewals) {
    if (expiringIds.has(r.id)) continue;
    const key = `${r.companyID}|${(r.contractName || '').trim().toLowerCase()}`;
    if (!renewalMap[key] || new Date(r.startDate) > new Date(renewalMap[key].startDate)) {
      renewalMap[key] = r;
    }
  }

  // ── Fetch ContractServices for expiring contracts ─────────────────────────
  const contractIds = filtered.map(c => c.id);
  let csRows = [];
  for (let i = 0; i < contractIds.length; i += CHUNK) {
    const chunk = contractIds.slice(i, i + CHUNK);
    let lastCsId = 0;
    while (true) {
      try {
        const r = await atFetch('/ContractServices/query', {
          method: 'POST',
          body: JSON.stringify({
            filter: [
              { op: 'in', field: 'contractID', value: chunk },
              { op: 'gt', field: 'id',         value: lastCsId },
            ],
          }),
        });
        const items = r.items || [];
        csRows.push(...items);
        if (!items.length || !r.pageDetails?.nextPageUrl) break;
        lastCsId = items[items.length - 1].id;
      } catch (e) {
        console.warn('ContractServices fetch failed:', e.message);
        break;
      }
    }
  }

  // ── Fetch service names ───────────────────────────────────────────────────
  const serviceIds = [...new Set(csRows.map(s => s.serviceID).filter(Boolean))];
  const services   = await atBatchLookup('Services', serviceIds);
  const serviceMap = Object.fromEntries(
    services.map(s => [s.id, s.name || s.serviceName || s.description || `Service ${s.id}`])
  );

  // ── Fetch current quantities from ContractServiceUnits (current month) ────
  const csIds = csRows.map(cs => cs.id);
  let csuRows = [];
  if (csIds.length) {
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstOfMonthStr = fmt(firstOfMonth);
    for (let i = 0; i < csIds.length; i += CHUNK) {
      const chunk = csIds.slice(i, i + CHUNK);
      try {
        const r = await atFetch('/ContractServiceUnits/query', {
          method: 'POST',
          body: JSON.stringify({
            filter: [
              { op: 'in',  field: 'contractServiceID', value: chunk },
              { op: 'gte', field: 'startDate',          value: firstOfMonthStr },
            ],
          }),
        });
        csuRows.push(...(r.items || []));
      } catch (e) {
        console.warn('ContractServiceUnits fetch skipped:', e.message);
      }
    }
  }
  // Latest CSU record per contractServiceID
  const csuMap = {};
  for (const u of csuRows) {
    const cur = csuMap[u.contractServiceID];
    if (!cur || new Date(u.startDate) > new Date(cur.startDate)) csuMap[u.contractServiceID] = u;
  }

  // ── Group services by contractID ──────────────────────────────────────────
  const servicesByContract = {};
  for (const cs of csRows) {
    if (!servicesByContract[cs.contractID]) servicesByContract[cs.contractID] = [];
    const csu = csuMap[cs.id];
    servicesByContract[cs.contractID].push({
      id:          cs.id,
      serviceID:   cs.serviceID,
      serviceName: serviceMap[cs.serviceID] || `Service ${cs.serviceID}`,
      quantity:    csu ? (csu.units ?? csu.quantity ?? 1) : 1,
      unitCost:    cs.unitCost  || 0,
      unitPrice:   cs.unitPrice || 0,
    });
  }

  // ── Split: needs renewal vs already renewed ───────────────────────────────
  const needs   = [];
  const renewed = [];
  for (const c of filtered) {
    const key     = `${c.companyID}|${(c.contractName || '').trim().toLowerCase()}`;
    const renewal = renewalMap[key] || null;
    const entry   = {
      id:           c.id,
      contractName: c.contractName || '',
      companyID:    c.companyID,
      companyName:  companyMap[c.companyID] || `Company ${c.companyID}`,
      contractType: c.contractType,
      startDate:    (c.startDate || '').split('T')[0],
      endDate:      (c.endDate   || '').split('T')[0],
      services:     servicesByContract[c.id] || [],
      renewal:      renewal ? {
        id:        renewal.id,
        startDate: (renewal.startDate || '').split('T')[0],
        endDate:   (renewal.endDate   || '').split('T')[0],
      } : null,
    };
    if (renewal) renewed.push(entry);
    else         needs.push(entry);
  }

  needs.sort(  (a, b) => a.companyName.localeCompare(b.companyName) || new Date(a.endDate) - new Date(b.endDate));
  renewed.sort((a, b) => a.companyName.localeCompare(b.companyName) || new Date(a.endDate) - new Date(b.endDate));

  return { contracts: needs, renewed };
});
