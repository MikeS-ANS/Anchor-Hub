const fs   = require('fs');
const path = require('path');
const { app, dialog } = require('electron');
const { USER_DATA, getMainWindow } = require('../shared/state');

const MSC_SETTINGS_FILE = path.join(USER_DATA, 'anchor-msc-settings.json');

function loadMscSettings() {
  const defaults = { filePath: '' };
  if (!fs.existsSync(MSC_SETTINGS_FILE)) return defaults;
  try { return { ...defaults, ...JSON.parse(fs.readFileSync(MSC_SETTINGS_FILE, 'utf8')) }; }
  catch { return defaults; }
}

const MSC_FIELD_COL = {
  company: 2, userSupport: 3, msaTotal: 4, month: 5,
  yearSigned: 6, tcIncrease: 7, splusIncrease: 8, industry: 9, lifetimeValue: 10,
};

module.exports = function registerMscAgreements(ipcMain) {
  ipcMain.handle('get-msc-settings', () => loadMscSettings());

  ipcMain.handle('save-msc-settings', (_, s) => {
    fs.writeFileSync(MSC_SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf8');
    return { success: true };
  });

  ipcMain.handle('browse-msc-file', async () => {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      title: 'Select MSC Agreements Excel File',
      defaultPath: path.join(app.getPath('home'), 'OneDrive - Anchor Network Solutions', 'ANS-Finance', 'Managed Service Clients'),
      filters: [{ name: 'Excel Files', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('read-msc-data', async (_, filePath) => {
    try {
      if (!filePath) return { error: 'No file path configured. Set it in Settings → General.' };
      if (!fs.existsSync(filePath)) return { error: `File not found: ${filePath}` };
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(filePath);
      const ws = wb.worksheets[0];
      const rows = [];

      // Extract plain value from a cell — handles rich text, formulas, plain text, numbers
      const cellVal = cell => {
        const v = cell.value;
        if (v == null) return null;
        if (typeof v === 'string') return v.trim() || null;
        if (typeof v === 'number') return v;
        if (typeof v === 'boolean') return v;
        if (v && v.richText) return v.richText.map(r => r.text || '').join('').trim() || null;
        if (v && v.text != null) return String(v.text).trim() || null;
        if (v && v.result != null) return v.result; // formula cell
        return null;
      };

      const parseRate = cell => {
        const v = cellVal(cell);
        if (v == null) return null;
        if (typeof v === 'number') return v <= 1 ? v : v / 100;
        const m = String(v).match(/([\d.]+)/);
        return m ? parseFloat(m[1]) / 100 : null;
      };

      const parseCurrency = cell => {
        const v = cellVal(cell);
        if (v == null) return null;
        if (typeof v === 'number') return v;
        const m = String(v).replace(/[$,]/g, '').match(/(-?[\d.]+)/);
        return m ? parseFloat(m[1]) : null;
      };

      const parseNum = cell => {
        const v = cellVal(cell);
        if (v == null) return null;
        if (typeof v === 'number') return v;
        const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
        return isNaN(n) ? null : n;
      };

      const parseText = cell => {
        const v = cellVal(cell);
        if (v == null) return null;
        return String(v).trim() || null;
      };

      ws.eachRow((row, rowNum) => {
        if (rowNum < 3) return; // row 1 = super-header, row 2 = column labels
        const company = parseText(row.getCell(2));
        if (!company) return;
        if (company.toLowerCase().startsWith('average') || company.toLowerCase().startsWith('total')) return;
        rows.push({
          rowNum,
          company,
          userSupport:   parseNum(row.getCell(3)),
          msaTotal:      parseCurrency(row.getCell(4)),
          month:         parseText(row.getCell(5)),
          yearSigned:    parseText(row.getCell(6)),
          tcIncrease:    parseRate(row.getCell(7)),
          splusIncrease: parseRate(row.getCell(8)),
          industry:      parseText(row.getCell(9)),
          lifetimeValue: parseCurrency(row.getCell(10)),
        });
      });
      return { success: true, data: rows };
    } catch (e) {
      return { error: e.message };
    }
  });

  ipcMain.handle('save-msc-data', async (_, { filePath, changes }) => {
    try {
      if (!filePath || !fs.existsSync(filePath)) return { error: `File not found: ${filePath}` };
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(filePath);
      const ws = wb.worksheets[0];

      for (const { rowNum, field, value } of changes) {
        const col = MSC_FIELD_COL[field];
        if (!col) continue;
        const cell = ws.getRow(rowNum).getCell(col);
        // rates stored as decimals (0.04 = 4%), currencies/numbers as plain numbers
        cell.value = value;
      }

      await wb.xlsx.writeFile(filePath);
      return { success: true, count: changes.length };
    } catch (e) {
      return { error: e.message };
    }
  });
};
