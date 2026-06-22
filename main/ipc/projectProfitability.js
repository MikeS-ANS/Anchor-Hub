const fs   = require('fs');
const path = require('path');
const { app, dialog, shell } = require('electron');
const { USER_DATA, getMainWindow } = require('../shared/state');
const { atQuery, atBatchLookup } = require('../shared/at');

const PROFITABILITY_SETTINGS_FILE = path.join(USER_DATA, 'profitability-settings.json');

const PROFITABILITY_DEFAULTS = {
  blendedLaborRate:    83.50,
  standardBillRate:    200.00,
  marginWarnThreshold: 20,
};

const PROF_EXCLUDED_COMPANY_IDS = new Set([0, 30528635]);
const PROF_EXCLUDED_NAME_PATTERNS = [
  'client time tracking', 'client facing time', 'client success time',
  'internal admin time', 'admin time tracking', 'time tracking',
  'co-managed account setup', 'co-managed it setup',
  'client onboarding', 'client offboarding', 'site review',
  'security+ deployment', 'security + deployment',
];
const PROF_EXCLUDED_CONTRACT_TYPES = new Set([7]); // 7 = Recurring Service

function profIsExcluded(project) {
  if (PROF_EXCLUDED_COMPANY_IDS.has(project.companyID)) return true;
  const name = (project.projectName || '').toLowerCase();
  return PROF_EXCLUDED_NAME_PATTERNS.some(p => name.includes(p));
}

module.exports = function registerProjectProfitability(ipcMain) {
  ipcMain.handle('get-profitability-settings', () => {
    try {
      if (fs.existsSync(PROFITABILITY_SETTINGS_FILE)) {
        return { ...PROFITABILITY_DEFAULTS, ...JSON.parse(fs.readFileSync(PROFITABILITY_SETTINGS_FILE, 'utf8')) };
      }
    } catch {}
    return { ...PROFITABILITY_DEFAULTS };
  });

  ipcMain.handle('save-profitability-settings', (_, settings) => {
    fs.writeFileSync(PROFITABILITY_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    return { success: true };
  });

  ipcMain.handle('run-project-profitability', async (_, { startDate, endDate, includeActive, projectNumber }) => {
    const STATUS_COMPLETE = 5;
    const STATUS_ACTIVE   = [1,3,4,6,7,8,9,10,11,12,15,16,17,18,19,20,21,22,24,25,26,27];
    const CONTRACT_TYPE_LABELS = {
      1: 'Time & Materials', 3: 'Fixed Price', 4: 'Block Hours',
      6: 'Retainer', 7: 'Recurring Service', 8: 'Per Ticket', 9: 'Umbrella',
    };
    const STATUS_LABELS = {
      0:'Inactive',1:'New',3:'In Progress',4:'Followup',5:'Complete',
      6:'Waiting Parts',7:'Waiting Client',8:'In Progress 25%',9:'In Progress 50%',
      10:'In Progress 75%',11:'Parts In',12:'Waiting Vendor',13:'Proposal',
      14:'Waiting Client Success',15:'Queued',16:'Go-Live in Progress',
      17:'IKO Scheduled',18:'CKO Scheduled',19:'Go-Live Completed',
      20:'Project Close Scheduled',21:'Client Hold',22:'Go-Live Targeted',
      23:'Canceled',24:'ANS Hold',25:'Schedule IKO',26:'Schedule CKO',27:'Schedule Close',
    };

    // 1. Fetch projects — by project number (direct lookup) or by date range
    let inRange;
    if (projectNumber) {
      inRange = await atQuery('/Projects', [{ op: 'eq', field: 'projectNumber', value: projectNumber }]);
    } else {
      const statusValues = includeActive ? [STATUS_COMPLETE, ...STATUS_ACTIVE] : [STATUS_COMPLETE];
      const projects = await atQuery('/Projects', [{ op: 'in', field: 'status', value: statusValues }]);
      const filtered = projects.filter(p => !profIsExcluded(p));
      inRange = filtered.filter(p => {
        const dt = (p.completedDateTime || p.endDateTime || p.startDateTime || '').slice(0, 10);
        if (!dt) return true;
        if (startDate && dt < startDate) return false;
        if (endDate   && dt > endDate)   return false;
        return true;
      });
    }

    // Load settings before early return so user's saved values are preserved
    let settings = { ...PROFITABILITY_DEFAULTS };
    try {
      if (fs.existsSync(PROFITABILITY_SETTINGS_FILE))
        settings = { ...PROFITABILITY_DEFAULTS, ...JSON.parse(fs.readFileSync(PROFITABILITY_SETTINGS_FILE, 'utf8')) };
    } catch {}

    if (!inRange.length) return { projects: [], settings };

    // 2. Batch lookups
    const companyIds  = [...new Set(inRange.map(p => p.companyID).filter(Boolean))];
    const resourceIds = [...new Set(inRange.map(p => p.projectLeadResourceID).filter(Boolean))];
    const contractIds = [...new Set(inRange.map(p => p.contractID).filter(Boolean))];

    const [companies, resources, contracts] = await Promise.all([
      atBatchLookup('Companies', companyIds),
      atBatchLookup('Resources', resourceIds),
      atBatchLookup('Contracts', contractIds),
    ]);

    const companyMap  = Object.fromEntries(companies.map(c => [c.id, c.companyName || 'ID:' + c.id]));
    const resourceMap = Object.fromEntries(resources.map(r => [r.id, ((r.firstName||'') + ' ' + (r.lastName||'')).trim() || 'ID:' + r.id]));
    const contractMap = Object.fromEntries(contracts.map(c => [c.id, { type: CONTRACT_TYPE_LABELS[c.contractType] || 'Type:' + c.contractType, typeId: c.contractType, name: c.contractName || '' }]));

    const withValidContracts = inRange.filter(p => {
      if (!p.contractID) return true;
      const ct = contractMap[p.contractID];
      return !ct || !PROF_EXCLUDED_CONTRACT_TYPES.has(ct.typeId);
    });

    // 3. Fetch milestones for non-block-hour projects (dedupe by contractID)
    const milestoneMap = {};
    const seenContractIds = new Set();
    for (const p of withValidContracts) {
      if (!p.contractID) continue;
      if (seenContractIds.has(p.contractID)) continue;
      seenContractIds.add(p.contractID);
      const ct = contractMap[p.contractID];
      if (ct && ct.typeId === 4) continue; // Block Hours handled separately
      try {
        const milestones = await atQuery('/ContractMilestones', [{ op: 'eq', field: 'contractID', value: p.contractID }]);
        milestoneMap[p.contractID] = {
          billed:  milestones.filter(m => m.status === 3).reduce((s, m) => s + (m.amount || 0), 0),
          pending: milestones.filter(m => m.status === 1 || m.status === 2).reduce((s, m) => s + (m.amount || 0), 0),
        };
      } catch {
        milestoneMap[p.contractID] = { billed: 0, pending: 0 };
      }
    }

    // 4. Fetch BillingItems revenue for block hour projects
    const blockHourRevenueMap = {};
    const blockHourProjects = withValidContracts.filter(p => {
      if (!p.contractID) return false;
      const ct = contractMap[p.contractID];
      return ct && ct.typeId === 4;
    });

    for (const p of blockHourProjects) {
      try {
        const tasks = await atQuery('/Tasks', [{ op: 'eq', field: 'projectID', value: p.id }]);
        if (!tasks.length) { blockHourRevenueMap[p.id] = 0; continue; }
        const taskIds = tasks.map(t => t.id);
        let totalRevenue = 0;
        const chunkSize = 50;
        for (let i = 0; i < taskIds.length; i += chunkSize) {
          const chunk = taskIds.slice(i, i + chunkSize);
          try {
            const items = await atQuery('/BillingItems', [
              { op: 'in', field: 'taskID',     value: chunk },
              { op: 'eq', field: 'nonBillable', value: false },
            ]);
            totalRevenue += items.reduce((s, item) => s + (item.extendedPrice || 0), 0);
          } catch { /* skip chunk */ }
        }
        blockHourRevenueMap[p.id] = totalRevenue;
      } catch {
        blockHourRevenueMap[p.id] = 0;
      }
    }

    // 5. Fetch time entries by contractID to get contract-level hours
    //    (project fields like actualHours only count project tasks, missing ticket time on same contract)
    const contractHourMap = {};
    const TE_CHUNK = 50;
    const billedContractIds = [...seenContractIds].filter(cid => {
      const ct = contractMap[cid];
      return !ct || ct.typeId !== 4; // block-hour contracts use billing items, not time entries
    });
    for (let i = 0; i < billedContractIds.length; i += TE_CHUNK) {
      const chunk = billedContractIds.slice(i, i + TE_CHUNK);
      try {
        const entries = await atQuery('/TimeEntries', [{ op: 'in', field: 'contractID', value: chunk }]);
        for (const te of entries) {
          if (!te.contractID) continue;
          const cid = te.contractID;
          if (!contractHourMap[cid]) contractHourMap[cid] = { total: 0, billable: 0 };
          const hrs = typeof te.hoursWorked === 'number' ? te.hoursWorked : (parseFloat(te.hoursWorked) || 0);
          contractHourMap[cid].total += hrs;
          if (!te.isNonBillable) contractHourMap[cid].billable += hrs;
        }
      } catch { /* skip chunk */ }
    }

    // 6. Build rows
    const rows = withValidContracts.map(p => {
      const contractInfo = p.contractID ? (contractMap[p.contractID] || {}) : {};
      const nameSuffix   = (contractInfo.name || '').match(/[\s\-]+(T&M|FF)$/i);
      const billingType  = nameSuffix
        ? (nameSuffix[1].toUpperCase() === 'FF' ? 'Fixed Price' : 'Time & Materials')
        : (contractInfo.type || (p.contractID ? 'Unknown' : 'No Contract'));
      const isBlockHours = contractInfo.typeId === 4;

      let invoicedAmt, pendingAmt;
      if (isBlockHours) {
        invoicedAmt = blockHourRevenueMap[p.id] || 0;
        pendingAmt  = 0;
      } else {
        const ms    = p.contractID ? (milestoneMap[p.contractID] || { billed: 0, pending: 0 }) : { billed: 0, pending: 0 };
        invoicedAmt = ms.billed;
        pendingAmt  = ms.pending;
      }

      const estHours    = parseFloat(p.estimatedTime) || 0;
      const cHours      = p.contractID ? (contractHourMap[p.contractID] || null) : null;
      const totalHours  = cHours ? cHours.total    : (parseFloat(p.actualHours)       || 0);
      const billedHours = cHours ? cHours.billable : (parseFloat(p.actualBilledHours) || 0);

      const totalRevenue      = invoicedAmt + pendingAmt;
      const costOfDelivery    = totalHours * settings.blendedLaborRate;
      const grossMarginDollar = totalRevenue - costOfDelivery;
      const grossMarginPct    = totalRevenue > 0 ? (grossMarginDollar / totalRevenue) * 100 : null;
      const effectiveRate     = totalHours   > 0 ? totalRevenue / totalHours : null;
      const hoursVariancePct  = estHours     > 0 ? ((totalHours - estHours) / estHours) * 100 : null;
      const endDtStr          = p.completedDateTime || p.endDateTime || '';

      const fmtDate = s => {
        if (!s) return '';
        try { return new Date(s).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }); }
        catch { return s.slice(0, 10); }
      };

      const flags = [];
      if (!p.contractID) flags.push('No contract linked');
      if (!isBlockHours && invoicedAmt === 0 && pendingAmt === 0 && billingType !== 'Time & Materials')
        flags.push('No milestones billed or pending');
      if (isBlockHours && invoicedAmt === 0) flags.push('Block Hours: no billable items found');
      if (pendingAmt > 0) flags.push('$' + pendingAmt.toLocaleString() + ' pending — not yet invoiced');
      if (estHours === 0) flags.push('No hour estimate');
      if (grossMarginPct !== null && grossMarginPct < settings.marginWarnThreshold)
        flags.push('Margin ' + grossMarginPct.toFixed(1) + '% below ' + settings.marginWarnThreshold + '% threshold');
      if (billingType === 'Time & Materials' && billedHours < totalHours * 0.9 && totalHours > 0)
        flags.push('T&M: ~' + (totalHours - billedHours).toFixed(1) + ' unbilled hours');

      return {
        projectNumber:     p.projectNumber || ('ID:' + p.id),
        projectName:       p.projectName || '',
        company:           companyMap[p.companyID] || ('ID:' + p.companyID),
        lead:              resourceMap[p.projectLeadResourceID] || '',
        billingType,
        status:            STATUS_LABELS[p.status] || String(p.status),
        year:              endDtStr ? parseInt(endDtStr.slice(0, 4), 10) || null : null,
        startDate:         fmtDate(p.startDateTime),
        endDate:           fmtDate(endDtStr),
        estHours:          estHours    || null,
        billedHours:       billedHours || null,
        totalHours:        totalHours  || null,
        hoursVariancePct:  hoursVariancePct  !== null ? parseFloat(hoursVariancePct.toFixed(1))  : null,
        invoicedAmt:       invoicedAmt || null,
        pendingAmt:        pendingAmt  || null,
        costOfDelivery:    billedHours ? costOfDelivery    : null,
        grossMarginDollar: totalRevenue ? grossMarginDollar : null,
        grossMarginPct:    grossMarginPct !== null ? parseFloat(grossMarginPct.toFixed(1))  : null,
        effectiveRate:     effectiveRate  !== null ? parseFloat(effectiveRate.toFixed(2))   : null,
        flags:             flags.join(' | '),
      };
    });

    return { projects: rows, settings };
  });

  ipcMain.handle('export-profitability-report', async (_, { rows, settings }) => {
    const ExcelJS = require('exceljs');
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10);
    const { filePath, canceled } = await dialog.showSaveDialog(getMainWindow(), {
      title: 'Save Project Profitability Report',
      defaultPath: path.join(app.getPath('documents'), 'Project_Profitability_' + dateStr + '.xlsx'),
      filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
    });
    if (canceled || !filePath) return { canceled: true };

    const wb = new ExcelJS.Workbook();
    const NAVY='1F3864', ALTROW='EEF3FB', WARN='FFEB9C', BAD='FFC7CE', GOOD='C6EFCE', WHITE='FFFFFF';
    const hdrFont   = { name:'Arial', bold:true,  color:{ argb:WHITE }, size:10 };
    const bodyFont  = { name:'Arial', bold:false, size:10 };
    const mutedFont = { name:'Arial', bold:false, size:10, color:{ argb:'888888' } };
    const thinBorder = {
      top:    { style:'thin', color:{ argb:'BFBFBF' } },
      bottom: { style:'thin', color:{ argb:'BFBFBF' } },
      left:   { style:'thin', color:{ argb:'BFBFBF' } },
      right:  { style:'thin', color:{ argb:'BFBFBF' } },
    };

    function styleHeader(ws, row, n) {
      for (let c = 1; c <= n; c++) {
        const cell = ws.getCell(row, c);
        cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:NAVY } };
        cell.font = hdrFont;
        cell.border = thinBorder;
        cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true };
      }
    }
    function styleData(ws, row, n, alt) {
      for (let c = 1; c <= n; c++) {
        const cell = ws.getCell(row, c);
        cell.font = bodyFont;
        cell.border = thinBorder;
        if (alt) cell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:ALTROW } };
      }
    }
    function fillCell(ws, r, c, argb) {
      ws.getCell(r, c).fill = { type:'pattern', pattern:'solid', fgColor:{ argb:argb } };
    }
    function money(ws, r, c) {
      Object.assign(ws.getCell(r, c), { numFmt:'$#,##0.00', alignment:{ horizontal:'right' } });
    }
    function hours(ws, r, c) {
      Object.assign(ws.getCell(r, c), { numFmt:'#,##0.00', alignment:{ horizontal:'right' } });
    }
    function pct(ws, r, c) {
      Object.assign(ws.getCell(r, c), { numFmt:'0.0"%"', alignment:{ horizontal:'center' } });
    }

    // ── Sheet 1: Project Summary ──────────────────────────────────────────────
    const ws1 = wb.addWorksheet('Project Summary');
    ws1.mergeCells('A1:Q1');
    Object.assign(ws1.getCell('A1'), {
      value: 'Project Profitability Report — Anchor Network Solutions',
      font: { name:'Arial', bold:true, size:14, color:{ argb:NAVY } },
      alignment: { horizontal:'left', vertical:'middle' },
    });
    ws1.getRow(1).height = 22;
    ws1.mergeCells('A2:Q2');
    ws1.getCell('A2').value = 'Generated: ' + today.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })
      + '  |  Projects: ' + rows.length
      + '  |  Labor Rate: $' + settings.blendedLaborRate + '/hr'
      + '  |  Rack Rate: $' + settings.standardBillRate + '/hr';
    ws1.getCell('A2').font = { name:'Arial', italic:true, size:10, color:{ argb:'595959' } };
    ws1.getRow(2).height = 16;
    ws1.getRow(3).height = 6;

    const S1 = [
      ['Project #',        'projectNumber',    16],
      ['Project Name',     'projectName',      38],
      ['Client',           'company',          28],
      ['Project Lead',     'lead',             20],
      ['Billing Type',     'billingType',      16],
      ['Status',           'status',           12],
      ['Year',             'year',              7],
      ['Est. Hours',       'estHours',         10],
      ['Billed Hours',     'billedHours',      11],
      ['Total Hours',      'totalHours',       11],
      ['Hours Var %',      'hoursVariancePct', 11],
      ['Invoiced ($)',     'invoicedAmt',      13],
      ['Pending ($)',      'pendingAmt',       12],
      ['Cost of Delivery', 'costOfDelivery',   15],
      ['Gross Margin ($)', 'grossMarginDollar',15],
      ['Gross Margin %',   'grossMarginPct',   13],
      ['Effective Rate',   'effectiveRate',    13],
    ];

    S1.forEach(function(col, i) {
      ws1.getColumn(i + 1).width = col[2];
      ws1.getCell(4, i + 1).value = col[0];
    });
    styleHeader(ws1, 4, S1.length);
    ws1.getRow(4).height = 30;
    ws1.views = [{ state:'frozen', ySplit:4 }];

    const D1 = 5;
    rows.forEach(function(row, i) {
      const r = D1 + i;
      const alt = i % 2 === 1;
      S1.forEach(function(col, ci) { ws1.getCell(r, ci + 1).value = row[col[1]] != null ? row[col[1]] : null; });
      styleData(ws1, r, S1.length, alt);

      ws1.getCell(r, 1).alignment = { horizontal:'left' };

      if      (row.billingType === 'Fixed Price')       fillCell(ws1, r, 5, 'E2EFDA');
      else if (row.billingType === 'Time & Materials')  fillCell(ws1, r, 5, 'DDEEFF');
      else if (row.billingType === 'Block Hours')       fillCell(ws1, r, 5, 'FFF2CC');
      else if (row.billingType === 'No Contract')       fillCell(ws1, r, 5, BAD);

      ws1.getCell(r, 7).numFmt = '0';
      ws1.getCell(r, 7).alignment = { horizontal:'center' };
      hours(ws1, r, 8); hours(ws1, r, 9);
      hours(ws1, r, 10);

      if (row.hoursVariancePct != null) {
        pct(ws1, r, 11);
        if      (row.hoursVariancePct > 50)  fillCell(ws1, r, 11, BAD);
        else if (row.hoursVariancePct > 20)  fillCell(ws1, r, 11, WARN);
        else if (row.hoursVariancePct < -10) fillCell(ws1, r, 11, GOOD);
      }

      money(ws1, r, 12);
      money(ws1, r, 13);
      money(ws1, r, 14);
      money(ws1, r, 15);
      money(ws1, r, 17);

      if (row.grossMarginPct != null) {
        pct(ws1, r, 16);
        fillCell(ws1, r, 16,
          row.grossMarginPct < settings.marginWarnThreshold       ? BAD  :
          row.grossMarginPct < settings.marginWarnThreshold + 10  ? WARN : GOOD);
      }
    });

    const last1 = D1 + rows.length - 1;
    ws1.autoFilter = { from:{ row:4, column:1 }, to:{ row:last1, column:S1.length } };

    // ── Sheet 2: Flags & Issues ───────────────────────────────────────────────
    const ws2 = wb.addWorksheet('Flags & Issues');
    const flagged = rows.filter(function(r) { return r.flags; });
    ws2.mergeCells('A1:I1');
    Object.assign(ws2.getCell('A1'), {
      value: 'Projects Requiring Attention',
      font: { name:'Arial', bold:true, size:13, color:{ argb:'C00000' } },
      alignment: { horizontal:'left', vertical:'middle' },
    });
    ws2.getRow(1).height = 20;
    ws2.getRow(2).height = 6;

    const S2 = [
      ['Project #',      'projectNumber',    16],
      ['Project Name',   'projectName',      38],
      ['Client',         'company',          28],
      ['Billing Type',   'billingType',      16],
      ['Invoiced ($)',   'invoicedAmt',      14],
      ['Cost',           'costOfDelivery',   14],
      ['Gross Margin %', 'grossMarginPct',   14],
      ['Effective Rate', 'effectiveRate',    13],
      ['Flags',          'flags',            65],
    ];
    S2.forEach(function(col, i) { ws2.getColumn(i + 1).width = col[2]; ws2.getCell(3, i + 1).value = col[0]; });
    styleHeader(ws2, 3, S2.length);
    ws2.getRow(3).height = 28;
    ws2.views = [{ state:'frozen', ySplit:3 }];

    if (!flagged.length) {
      Object.assign(ws2.getCell(4, 1), {
        value: 'No issues found — all projects look clean.',
        font: { name:'Arial', italic:true, color:{ argb:'595959' }, size:10 },
      });
    } else {
      flagged.forEach(function(row, i) {
        const r = 4 + i;
        const alt = i % 2 === 1;
        S2.forEach(function(col, ci) { ws2.getCell(r, ci + 1).value = row[col[1]] != null ? row[col[1]] : null; });
        styleData(ws2, r, S2.length, alt);
        ws2.getCell(r, 1).alignment = { horizontal:'left' };
        money(ws2, r, 5); money(ws2, r, 6); money(ws2, r, 8);
        if (row.grossMarginPct != null) {
          pct(ws2, r, 7);
          fillCell(ws2, r, 7, row.grossMarginPct < settings.marginWarnThreshold ? BAD :
            row.grossMarginPct < settings.marginWarnThreshold + 10 ? WARN : GOOD);
        }
        fillCell(ws2, r, 9, WARN);
      });
      ws2.autoFilter = { from:{ row:3, column:1 }, to:{ row:3 + flagged.length, column:S2.length } };
    }

    // ── Sheet 3: Lead Summary ─────────────────────────────────────────────────
    const ws3 = wb.addWorksheet('Lead Summary');
    const leadMap = {};
    rows.forEach(function(row) {
      const lead = row.lead || '(Unassigned)';
      if (!leadMap[lead]) leadMap[lead] = { projects:0, invoiced:0, cost:0, estHours:0, billedHours:0, overruns:0, noEstimate:0, belowMargin:0 };
      const d = leadMap[lead];
      d.projects++;
      d.invoiced    += row.invoicedAmt    || 0;
      d.cost        += row.costOfDelivery || 0;
      d.estHours    += row.estHours       || 0;
      d.billedHours += row.billedHours    || 0;
      if (!row.estHours) d.noEstimate++;
      if (row.estHours && row.hoursVariancePct > 25) d.overruns++;
      if (row.grossMarginPct != null && row.grossMarginPct < settings.marginWarnThreshold) d.belowMargin++;
    });

    const leadRows = Object.entries(leadMap).map(function(entry) {
      const lead = entry[0], d = entry[1];
      const margin  = d.invoiced > 0 ? (d.invoiced - d.cost) / d.invoiced * 100 : null;
      const effRate = d.billedHours > 0 ? d.invoiced / d.billedHours : null;
      return { lead:lead, projects:d.projects, invoiced:d.invoiced, cost:d.cost,
               estHours:d.estHours, billedHours:d.billedHours,
               overruns:d.overruns, noEstimate:d.noEstimate, belowMargin:d.belowMargin,
               margin:margin, effRate:effRate,
               overrunRate: d.projects ? d.overruns / d.projects * 100 : 0 };
    }).sort(function(a, b) { return b.invoiced - a.invoiced; });

    ws3.mergeCells('A1:L1');
    Object.assign(ws3.getCell('A1'), {
      value: 'Project Lead Performance Summary',
      font: { name:'Arial', bold:true, size:13, color:{ argb:NAVY } },
      alignment: { horizontal:'left', vertical:'middle' },
    });
    ws3.getRow(1).height = 20;
    ws3.getRow(2).height = 6;

    const S3 = [
      ['Project Lead',     'lead',         24],
      ['Projects',         'projects',     10],
      ['Total Invoiced',   'invoiced',     16],
      ['Total Cost',       'cost',         14],
      ['Gross Margin %',   'margin',       14],
      ['Eff. Rate ($/hr)', 'effRate',      15],
      ['Est. Hours',       'estHours',     11],
      ['Billed Hours',     'billedHours',  12],
      ['Overrun Projects', 'overruns',     14],
      ['Overrun Rate %',   'overrunRate',  13],
      ['Below Margin',     'belowMargin',  13],
      ['No Estimate',      'noEstimate',   12],
    ];
    S3.forEach(function(col, i) { ws3.getColumn(i + 1).width = col[2]; ws3.getCell(3, i + 1).value = col[0]; });
    styleHeader(ws3, 3, S3.length);
    ws3.getRow(3).height = 28;
    ws3.views = [{ state:'frozen', ySplit:3 }];

    leadRows.forEach(function(row, i) {
      const r = 4 + i;
      const alt = i % 2 === 1;
      S3.forEach(function(col, ci) { ws3.getCell(r, ci + 1).value = row[col[1]] != null ? row[col[1]] : null; });
      styleData(ws3, r, S3.length, alt);
      [3, 4, 6].forEach(function(c) { money(ws3, r, c); });
      [7, 8].forEach(function(c) { hours(ws3, r, c); });
      [2, 9, 11, 12].forEach(function(c) { ws3.getCell(r, c).alignment = { horizontal:'center' }; });
      if (row.margin != null) {
        pct(ws3, r, 5);
        fillCell(ws3, r, 5, row.margin < settings.marginWarnThreshold ? BAD :
          row.margin < settings.marginWarnThreshold + 10 ? WARN : GOOD);
      }
      if (row.overrunRate != null) {
        pct(ws3, r, 10);
        fillCell(ws3, r, 10, row.overrunRate > 50 ? BAD : row.overrunRate > 25 ? WARN : GOOD);
      }
    });

    await wb.xlsx.writeFile(filePath);
    return { success: true, filePath };
  });
};
