const { app } = require('electron');
const path    = require('path');
const fs      = require('fs');

const SERVICE_NAME  = 'Pax8Hub';
const STATE_FILE    = path.join(app.getPath('userData'), 'pax8hub-state.json');
const MAPPINGS_FILE = path.join(app.getPath('userData'), 'pax8hub-mappings.json');

// USER_DATA: packaged builds write to userData, dev builds write to __dirname
// Modules that need USER_DATA for their own file paths can require this value.
const USER_DATA = app.isPackaged ? app.getPath('userData') : require('path').resolve(__dirname, '../..');

function readState()       { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } }
function writeState(patch) { fs.writeFileSync(STATE_FILE, JSON.stringify({ ...readState(), ...patch }), 'utf8'); }

function savePushLogEntry(entry) {
  const s = readState();
  const log = Array.isArray(s.invoicePushLog) ? s.invoicePushLog : [];
  log.unshift(entry);
  if (log.length > 100) log.length = 100;
  writeState({ invoicePushLog: log });
}

function loadMappings() {
  if (!fs.existsSync(MAPPINGS_FILE)) return { companies: [], services: [], lastSync: null };
  try { return JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf8')); }
  catch { return { companies: [], services: [], lastSync: null }; }
}

function saveMappingsFile(data) {
  fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// Main window reference — set by main.js after createWindow()
let _mainWindow = null;
function setMainWindow(win) { _mainWindow = win; }
function getMainWindow()    { return _mainWindow; }

module.exports = {
  SERVICE_NAME,
  STATE_FILE,
  MAPPINGS_FILE,
  USER_DATA,
  readState,
  writeState,
  savePushLogEntry,
  loadMappings,
  saveMappingsFile,
  setMainWindow,
  getMainWindow,
};
