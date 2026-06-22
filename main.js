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

// ─── Microsoft SSO / Entra ID ─────────────────────────────────────────────────
require('./main/ipc/auth')(ipcMain);

// ─── Azure Key Vault ──────────────────────────────────────────────────────────
const { kvGetSecret } = require('./main/shared/kv');
require('./main/ipc/kv')(ipcMain);

// ─── Duo Management API ───────────────────────────────────────────────────────
require('./main/ipc/duo')(ipcMain);

// ─── Datto RMM ────────────────────────────────────────────────────────────────
require('./main/ipc/datto')(ipcMain);

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

// ─── Shared state / mapping store ────────────────────────────────────────────
const { readState, writeState, savePushLogEntry, loadMappings, saveMappingsFile,
        MAPPINGS_FILE, SERVICE_NAME, setMainWindow, getMainWindow } = require('./main/shared/state');

// (Prompt templates, CSV helpers, and all IPC handlers below are now in main/ipc/ modules)


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
  setMainWindow(mainWindow);
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
const { getPax8Token, pax8Paginate, resolveProductName, resolveProductDetails } = require('./main/shared/pax8');

// ─── Autotask API ─────────────────────────────────────────────────────────────
const { atFetch, atQuery, atBatchLookup, getAtBaseUrl, getContractServices } = require('./main/shared/at');


// ── AT Contract Auto-Push ─────────────────────────────────────────────────────
require('./main/ipc/atPush')(ipcMain);

// ── Subscription Audit ──────────────────────────────────────────────────────────
require('./main/ipc/subscriptionAudit')(ipcMain);

// ── Invoice Monitor ─────────────────────────────────────────────────────────────
require('./main/ipc/invoiceMonitor')(ipcMain);

// ── Margin Analyzer ─────────────────────────────────────────────────────────────
require('./main/ipc/marginAnalyzer')(ipcMain);

// ── Company Mapping ─────────────────────────────────────────────────────────────
require('./main/ipc/companyMapping')(ipcMain);

// ── Invoice Processor ────────────────────────────────────────────────────────────
require('./main/ipc/invoiceProcessor')(ipcMain);

// ── Kaseya Processor ─────────────────────────────────────────────────────────────
require('./main/ipc/kaseyaProcessor')(ipcMain);

// ── MSC Agreements ────────────────────────────────────────────────────────────
require('./main/ipc/mscAgreements')(ipcMain);

// ── Sidebar Config + Margin Scheduler ────────────────────────────────────────
require('./main/ipc/sidebar')(ipcMain);

// ── Contract Changes ────────────────────────────────────────────────────────
require('./main/ipc/contractChanges')(ipcMain);

// ── Contract Renewals ───────────────────────────────────────────────────────
require('./main/ipc/contractRenewals')(ipcMain);

// ── Blackpoint / CompassOne ────────────────────────────────────────────────
require('./main/ipc/blackpoint')(ipcMain);

// ── Project Time Summary ────────────────────────────────────────────────────
require('./main/ipc/projectTimeSummary')(ipcMain);

// ── Project Profitability ───────────────────────────────────────────────────
require('./main/ipc/projectProfitability')(ipcMain);
