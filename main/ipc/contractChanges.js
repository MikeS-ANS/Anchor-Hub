const { app, dialog, shell } = require('electron');
const { atFetch, atBatchLookup } = require('../shared/at');
const { getMainWindow } = require('../shared/state');

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

// Parse the structured description block that Autotask writes into ContractNotes
// fired by the "New Contract Created" workflow rule.
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

  let changeType = 'Other';
  if (/Notification sent via Workflow Rule[^"]*"New Contract Created"/i.test(title))
                                                            changeType = 'Contract Created';
  else if (/unit price/i.test(title))                       changeType = 'Unit Price';
  else if (/unit cost/i.test(title))                        changeType = 'Unit Cost';
  else if (/units were changed/i.test(title))               changeType = 'Units Changed';
  else if (/service was added/i.test(title))                changeType = 'Service Added';
  else if (/service was (?:removed|deleted)/i.test(title))  changeType = 'Service Removed';
  else if (/note notification was sent/i.test(title))       changeType = 'Notification';
  else if (/Notification sent via Workflow Rule/i.test(title)) changeType = 'Notification';

  const userMatch = title.match(/User\s+\[([^\]]+)\]/);
  const changedBy = userMatch ? userMatch[1].trim() : '';

  let serviceName = '';
  if (changeType === 'Units Changed') {
    const m = title.match(/(?:increased|decreased)\s+\[(.+?)\]\s+units\s+by\s+\[/i);
    if (m) serviceName = m[1].trim();
  } else if (changeType === 'Unit Price' || changeType === 'Unit Cost') {
    const m = title.match(/changed\s+\[(.+?)\]\s+Unit\s+(?:Price|Cost)\b/i);
    if (m) {
      serviceName = m[1].trim();
    } else {
      const fb = title.match(/changed\s+\[([^\]]+)\]/);
      if (fb) serviceName = fb[1].trim();
    }
  } else if (changeType === 'Service Added') {
    const m = title.match(/added\s+\[(.+?)\]\s+to\s+the\s+contract/i);
    if (m) serviceName = m[1].trim();
  } else if (changeType === 'Service Removed') {
    const m = title.match(/(?:removed|deleted)\s+\[(.+?)\]\s+from\s+the\s+contract/i);
    if (m) serviceName = m[1].trim();
  }

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

  const dateMatch = title.match(/effective\s+\[([^\]]+)\]/);
  const effectiveDate = dateMatch ? dateMatch[1].trim() : '';

  return { changeType, changedBy, serviceName, newValue, effectiveDate };
}

module.exports = function registerContractChanges(ipcMain) {
  ipcMain.handle('run-contract-changes', async (_, { dateFrom, dateTo, fromUtc, toUtc } = {}) => {
    try {
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

      const rows = [...noteRows];
      rows.sort((a, b) => new Date(b.createDateTime) - new Date(a.createDateTime));
      return { success: true, rows, total: rows.length };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('export-contract-changes-excel', async (_, rows) => {
    const { filePath } = await dialog.showSaveDialog(getMainWindow(), {
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
      'Unit Price':       { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbeafe' } },
      'Unit Cost':        { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFffedd5' } },
      'Units Changed':    { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdcfce7' } },
      'Service Added':    { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFede9fe' } },
      'Service Removed':  { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFfce7f3' } },
      'Contract Created': { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFccfbf1' } },
      'Notification':     { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf1f5f9' } },
      'Other':            { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFf3f4f6' } },
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
    const THIN   = { style: 'thin', color: { argb: 'FFe2e8f0' } };
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
};
