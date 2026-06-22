const fs    = require('fs');
const path  = require('path');
const fetch = require('node-fetch');
const keytar = require('keytar');
const { app, shell } = require('electron');
const { SERVICE_NAME, USER_DATA } = require('../shared/state');

const BP_BASE          = 'https://api.blackpointcyber.com';
const BP_SNAPSHOT_FILE = path.join(USER_DATA, 'anchor-bp-snapshot.json');

async function bpFetch(bpPath, tenantId = null) {
  const apiKey = await keytar.getPassword(SERVICE_NAME, 'blackpoint_api_key');
  if (!apiKey) throw new Error('BlackPoint API key not configured. Go to Settings → API & Accounts.');
  const headers = { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' };
  if (tenantId) headers['x-tenant-id'] = tenantId;
  const res = await fetch(`${BP_BASE}${bpPath}`, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`BlackPoint API error (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json();
}

module.exports = function registerBlackpoint(ipcMain) {
  ipcMain.handle('run-blackpoint-usage', async () => {
    // 1. Fetch all tenants (paginated)
    const tenants = [];
    let page = 1;
    while (true) {
      const r = await bpFetch(`/v1/tenants?pageSize=50&page=${page}`);
      const batch = r.data || [];
      tenants.push(...batch);
      const meta = r.meta || {};
      const totalPages = meta.totalPages || meta.pageCount || 1;
      if (page >= totalPages || batch.length === 0) break;
      page++;
    }

    // 2. Fetch device counts for each tenant in batches of 8
    const BATCH = 8;
    const sleep = ms => new Promise(res => setTimeout(res, ms));

    for (let i = 0; i < tenants.length; i += BATCH) {
      const batch = tenants.slice(i, i + BATCH);
      await Promise.all(batch.map(async t => {
        try {
          let activeAgents = 0;
          let totalDevices = 0;
          let devPage = 1;
          while (true) {
            const r = await bpFetch(`/v1/assets?class=DEVICE&pageSize=200&page=${devPage}`, t.id);
            const devices = r.data || [];
            totalDevices += devices.length;
            activeAgents += devices.filter(d => !d.agentDeactivated).length;
            const meta = r.meta || {};
            const devTotalPages = meta.totalPages || meta.pageCount || 1;
            if (devPage >= devTotalPages || devices.length === 0) break;
            devPage++;
          }
          t.activeAgents = activeAgents;
          t.totalDevices = totalDevices;
        } catch (e) {
          t.activeAgents = null;
          t.totalDevices = null;
          t.fetchError   = e.message;
        }
      }));
      if (i + BATCH < tenants.length) await sleep(150);
    }

    // 3. Load previous snapshot for delta comparison
    let prevSnapshot = {};
    if (fs.existsSync(BP_SNAPSHOT_FILE)) {
      try { prevSnapshot = JSON.parse(fs.readFileSync(BP_SNAPSHOT_FILE, 'utf8')); } catch {}
    }
    const prevDate = prevSnapshot._date || null;

    // 4. Build result rows with deltas, sorted by name
    const result = tenants
      .map(t => ({
        id:               t.id,
        name:             t.name || t.displayName || 'Unknown',
        activeAgents:     t.activeAgents,
        totalDevices:     t.totalDevices,
        prevActiveAgents: prevSnapshot[t.id] != null ? prevSnapshot[t.id].activeAgents : null,
        delta:            (t.activeAgents != null && prevSnapshot[t.id] != null)
                            ? t.activeAgents - prevSnapshot[t.id].activeAgents
                            : null,
        error:            t.fetchError || null,
      }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // 5. Save new snapshot (overwrites previous)
    const newSnapshot = { _date: new Date().toISOString() };
    tenants.forEach(t => {
      if (t.activeAgents != null) {
        newSnapshot[t.id] = { activeAgents: t.activeAgents, name: t.name };
      }
    });
    fs.writeFileSync(BP_SNAPSHOT_FILE, JSON.stringify(newSnapshot, null, 2));

    const totalActive = result.reduce((sum, t) => sum + (t.activeAgents || 0), 0);

    return {
      tenants:      result,
      prevDate,
      runDate:      newSnapshot._date,
      totalTenants: result.length,
      totalActive,
    };
  });

  ipcMain.handle('export-blackpoint-report', async (_, data) => {
    try {
      const ExcelJS = require('exceljs');
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Anchor Hub';
      wb.created = new Date();

      const ws = wb.addWorksheet('Endpoint Usage');

      const H_FILL   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD0641C' } };
      const H_FONT   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
      const BORDER   = { style: 'thin', color: { argb: 'FFE2E8F0' } };
      const ALL_BORD = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

      ws.columns = [
        { header: 'Company',        key: 'name',    width: 38 },
        { header: 'Active Agents',  key: 'active',  width: 16 },
        { header: 'Previous Count', key: 'prev',    width: 16 },
        { header: 'Change',         key: 'delta',   width: 12 },
        { header: '% Change',       key: 'pct',     width: 12 },
        { header: 'Status',         key: 'status',  width: 18 },
      ];

      ws.getRow(1).eachCell(cell => {
        cell.fill = H_FILL; cell.font = H_FONT; cell.border = ALL_BORD;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      ws.getRow(1).height = 22;

      (data.tenants || []).forEach((t, i) => {
        const prev  = t.prevActiveAgents;
        const delta = t.delta;
        const pct   = (delta != null && prev != null && prev > 0)
                        ? ((delta / prev) * 100).toFixed(1) + '%'
                        : '—';
        const statusText = t.error     ? 'Error'
                         : delta == null ? 'New Client'
                         : delta > 0     ? 'Increased'
                         : delta < 0     ? 'Decreased'
                         :                 'No Change';
        const deltaStr = delta == null ? 'New'
                       : delta > 0    ? `+${delta}`
                       : delta === 0  ? '0'
                       :                `${delta}`;

        const row = ws.addRow({
          name:   t.name,
          active: t.activeAgents ?? 'Error',
          prev:   prev != null ? prev : '—',
          delta:  deltaStr,
          pct,
          status: statusText,
        });

        // Alternate row fill
        if (i % 2 === 1) {
          row.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          });
        }

        // Status cell colour
        const statusFg = delta == null ? 'FFFFF3CD'   // new  – yellow
                       : delta > 0    ? 'FFFFE5D0'   // up   – orange
                       : delta < 0    ? 'FFD0E8FF'   // down – blue
                       :                'FFF0F0F0';  // same – grey
        const statusCell = row.getCell('status');
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusFg } };

        row.eachCell(cell => { cell.border = ALL_BORD; cell.alignment = { vertical: 'middle' }; });
        row.height = 18;
      });

      // Totals row
      ws.addRow({});
      const totRow = ws.addRow({ name: 'TOTAL ACTIVE AGENTS', active: data.totalActive || '' });
      totRow.getCell('name').font  = { bold: true };
      totRow.getCell('active').font = { bold: true };

      const filePath = path.join(
        app.getPath('downloads'),
        `blackpoint-endpoint-${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      await wb.xlsx.writeFile(filePath);
      shell.showItemInFolder(filePath);
      return { ok: true, filePath };
    } catch (e) {
      return { error: e.message };
    }
  });
};
