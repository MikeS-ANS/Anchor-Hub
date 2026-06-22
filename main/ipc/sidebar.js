const fs      = require('fs');
const path    = require('path');
const keytar  = require('keytar');
const { app, Notification } = require('electron');
const { SERVICE_NAME, USER_DATA, readState, getMainWindow } = require('../shared/state');

const SIDEBAR_CONFIG_FILE = path.join(USER_DATA, 'sidebar-config.json');
const TOOL_VIS_KEY        = 'tool_visibility'; // kept for migration from old keytar store

// Master list of all known tool keys — order here is the out-of-the-box default.
// New tools added in future updates should be appended to this array; they will
// automatically default to visibility=false for existing users.
const ALL_TOOL_KEYS = [
  'subscription-audit',
  'invoice-monitor',
  'margin-analyzer',
  'company-mapping',
  'invoice-processor',
  'kaseya-processor',
  'project-time-summary',
  'contract-changes',
  'contract-renewals',
  'blackpoint-processor',
  'msc-agreements',
  'duo-management',
  'project-profitability',
];

function getDefaultSidebarConfig() {
  return {
    visibility: Object.fromEntries(ALL_TOOL_KEYS.map(k => [k, false])),
    layout:     ALL_TOOL_KEYS.map(k => ({ type: 'tool', key: k })),
  };
}

function mergeSidebarConfig(saved) {
  const def = getDefaultSidebarConfig();
  // Merge visibility — new tool keys default to false
  const visibility = { ...def.visibility, ...(saved.visibility || {}) };
  // Find which tool keys are already placed in the saved layout
  const placed = new Set();
  (saved.layout || []).forEach(item => {
    if (item.type === 'tool')   placed.add(item.key);
    if (item.type === 'bucket') (item.items || []).forEach(k => placed.add(k));
  });
  // Append missing tool keys (added by an update) at the end with visibility=false
  const missing = ALL_TOOL_KEYS.filter(k => !placed.has(k));
  const layout  = [...(saved.layout || def.layout), ...missing.map(k => ({ type: 'tool', key: k }))];
  return { visibility, layout };
}

module.exports = function registerSidebar(ipcMain) {
  ipcMain.handle('get-sidebar-config', async () => {
    try {
      const raw = JSON.parse(fs.readFileSync(SIDEBAR_CONFIG_FILE, 'utf8'));
      return mergeSidebarConfig(raw);
    } catch {
      // No config file yet — try to migrate existing keytar visibility for existing users
      try {
        const raw    = await keytar.getPassword(SERVICE_NAME, TOOL_VIS_KEY);
        const oldVis = raw ? JSON.parse(raw) : null;
        const config = getDefaultSidebarConfig();
        if (oldVis) ALL_TOOL_KEYS.forEach(k => { if (k in oldVis) config.visibility[k] = oldVis[k]; });
        fs.writeFileSync(SIDEBAR_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
        return config;
      } catch {
        return getDefaultSidebarConfig();
      }
    }
  });

  ipcMain.handle('save-sidebar-config', (_, config) => {
    fs.writeFileSync(SIDEBAR_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    return { success: true };
  });

  // Backward-compat: get-tool-visibility reads from sidebar config
  ipcMain.handle('get-tool-visibility', async () => {
    try {
      const raw = JSON.parse(fs.readFileSync(SIDEBAR_CONFIG_FILE, 'utf8'));
      return mergeSidebarConfig(raw).visibility;
    } catch { return getDefaultSidebarConfig().visibility; }
  });

  // Backward-compat: save-tool-visibility patches visibility in sidebar config
  ipcMain.handle('save-tool-visibility', async (_, vis) => {
    try {
      let config;
      try   { config = JSON.parse(fs.readFileSync(SIDEBAR_CONFIG_FILE, 'utf8')); }
      catch { config = getDefaultSidebarConfig(); }
      config.visibility = { ...config.visibility, ...vis };
      fs.writeFileSync(SIDEBAR_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    } catch {}
    return { success: true };
  });

  // ─── Margin Scheduler ───────────────────────────────────────────────────────
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
      getMainWindow().webContents.send('margin-log', { msg: '⏰ Scheduled margin analysis starting...', type: 'info' });
      ipcMain.emit('run-margin-analysis', null, {});
      new Notification({ title: 'Pax8 Hub — Margin Report', body: 'Monthly margin analysis complete. Report saved to Downloads.' }).show();
    } catch (e) { console.error('Margin scheduler error:', e); }
  }

  app.whenReady().then(() => {
    setTimeout(checkMarginSchedule, 5000); // check 5s after startup
    setInterval(checkMarginSchedule, 60 * 60 * 1000); // re-check every hour
  });
};
