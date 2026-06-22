const { kvGetSecret } = require('../shared/kv');

module.exports = function registerKv(ipcMain) {
  ipcMain.handle('kv-get-secret', async (_, secretName) => {
    try { return { value: await kvGetSecret(secretName) }; }
    catch (e) { return { error: e.message }; }
  });
};
