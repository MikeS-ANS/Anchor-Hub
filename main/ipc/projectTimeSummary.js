const fs   = require('fs');
const path = require('path');
const { app, shell } = require('electron');
const { USER_DATA } = require('../shared/state');
const { atFetch, atQuery, atBatchLookup } = require('../shared/at');

const PROJECT_NOTES_FILE           = path.join(USER_DATA, 'project-notes.json');
const PROJECT_REPORT_SETTINGS_FILE = path.join(USER_DATA, 'project-report-settings.json');

function loadProjectNotes() {
  try { return JSON.parse(fs.readFileSync(PROJECT_NOTES_FILE, 'utf8')); } catch { return {}; }
}
function saveProjectNotesFn(notes) {
  fs.writeFileSync(PROJECT_NOTES_FILE, JSON.stringify(notes, null, 2));
}
function loadProjectReportSettings() {
  const defaults = {
    emailTo:               '',
    emailSubject:          'Project Time Summary Report',
    emailBody:             'Hi,\n\nPlease find this week\'s Project Time Summary Report attached.\n\nThank you,\nAnchor Network Solutions',
    excludeProjectNumbers: '',
    excludeStatuses:       'ANS Hold\nCanceled\nCancelled\nClient Hold\nComplete\nInactive\nProposal\nQueued',
    departmentFilter:      'Professional Services',
    projectTypeFilter:     'Client',
    departmentId:          '',
    projectTypeId:         '',
    statusIds:             '',
  };
  try {
    const saved = JSON.parse(fs.readFileSync(PROJECT_REPORT_SETTINGS_FILE, 'utf8'));
    return { ...defaults, ...saved };
  } catch { return defaults; }
}
function saveProjectReportSettingsFn(s) {
  fs.writeFileSync(PROJECT_REPORT_SETTINGS_FILE, JSON.stringify(s, null, 2));
}

function ptsEsc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildProjectReportHtml(projects) {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const fmt     = v => Number(v || 0).toFixed(2);

  const rows = projects.map(p => {
    const pct    = p.estimatedHours > 0 ? p.workedHours / p.estimatedHours : 0;
    const over   = p.estimatedHours > 0 && p.workedHours > p.estimatedHours;
    const atRisk = !over && pct >= 0.5;
    const cls    = over ? 'row-over' : atRisk ? 'row-risk' : '';
    return `
      <tr class="${cls}" data-account="${ptsEsc(p.accountName)}" data-project="${ptsEsc(p.projectName)}"
          data-contract="${ptsEsc(p.contractName)}" data-num="${ptsEsc(p.projectNumber)}"
          data-lead="${ptsEsc(p.projectLead)}" data-est="${p.estimatedHours}" data-worked="${p.workedHours}"
          data-bill="${p.billableHours}" data-nonbill="${p.nonBillableHours}" data-last7="${p.last7Hours}">
        <td>${ptsEsc(p.accountName)}</td>
        <td>${ptsEsc(p.projectName)}</td>
        <td>${ptsEsc(p.contractName)}</td>
        <td class="num">${ptsEsc(p.projectNumber)}</td>
        <td class="num">${ptsEsc(p.projectLead)}</td>
        <td class="r">${fmt(p.estimatedHours)}</td>
        <td class="r bold">${fmt(p.workedHours)}</td>
        <td class="r">${fmt(p.billableHours)}</td>
        <td class="r">${fmt(p.nonBillableHours)}</td>
        <td class="r">${p.last7Hours > 0 ? fmt(p.last7Hours) : '—'}</td>
        <td>${ptsEsc(p.note)}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Project Time Summary</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 10.5pt; margin: 28px; color: #222; }
  .brand { color: #D0641C; font-size: 13pt; font-weight: 700; margin-bottom: 2px; }
  h1 { font-size: 15pt; margin: 0 0 2px; }
  .subtitle { color: #666; font-size: 9.5pt; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #D0641C; color: #fff; padding: 6px 9px; text-align: left; font-size: 9.5pt;
       font-weight: 600; white-space: nowrap; cursor: pointer; user-select: none; }
  th:hover { background: #b8541a; }
  th .sort-arrow { margin-left: 4px; opacity: .6; }
  td { padding: 5px 9px; border-bottom: 1px solid #e0e0e0; font-size: 9.5pt; vertical-align: top; }
  tbody tr:nth-child(even) td { background: rgba(0,0,0,.03); }
  tr.row-over td { background: #f8c8c8 !important; }
  tr.row-risk td { background: #fff59d !important; }
  .r { text-align: right; }
  .num { white-space: nowrap; }
  .bold { font-weight: bold; }
  .key { margin-top: 20px; border: 1px solid #ccc; display: inline-block; padding: 10px 18px; border-radius: 4px; }
  .key b { display: block; margin-bottom: 6px; font-size: 9.5pt; }
  .key-row { display: flex; align-items: center; gap: 10px; margin: 3px 0; font-size: 9.5pt; }
  .swatch { width: 30px; height: 14px; border: 1px solid #bbb; flex-shrink: 0; }
</style>
</head>
<body>
  <div class="brand">Anchor Network Solutions</div>
  <h1>Project Time Summary Report</h1>
  <div class="subtitle">Generated: ${ptsEsc(dateStr)} &nbsp;·&nbsp; Click any column header to sort</div>
  <table id="pts-tbl">
    <thead>
      <tr>
        <th data-col="account">Account Name<span class="sort-arrow"></span></th>
        <th data-col="project">Project Name<span class="sort-arrow"></span></th>
        <th data-col="contract">Contract Name<span class="sort-arrow"></span></th>
        <th data-col="num">Project #<span class="sort-arrow"></span></th>
        <th data-col="lead">Project Lead<span class="sort-arrow"></span></th>
        <th data-col="est" class="r">Est. Hours<span class="sort-arrow"></span></th>
        <th data-col="worked" class="r">Worked Hours<span class="sort-arrow"></span></th>
        <th data-col="bill" class="r">Billable<span class="sort-arrow"></span></th>
        <th data-col="nonbill" class="r">Non-Billable<span class="sort-arrow"></span></th>
        <th data-col="last7" class="r">Last 7 Days<span class="sort-arrow"></span></th>
        <th data-col="notes">Notes<span class="sort-arrow"></span></th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="key">
    <b>KEY</b>
    <div class="key-row"><div class="swatch" style="background:#fff59d"></div>Worked hours ≥ 50% of estimated</div>
    <div class="key-row"><div class="swatch" style="background:#f8c8c8"></div>Worked hours exceed estimated</div>
  </div>
<script>
(function(){
  var tbl=document.getElementById('pts-tbl'), col=null, dir=1;
  var dataAttr={account:'account',project:'project',contract:'contract',num:'num',lead:'lead',
                est:'est',worked:'worked',bill:'bill',nonbill:'nonbill',last7:'last7',notes:'notes'};
  tbl.querySelectorAll('th[data-col]').forEach(function(th){
    th.addEventListener('click',function(){
      var key=th.getAttribute('data-col');
      if(col===key) dir*=-1; else{col=key;dir=1;}
      tbl.querySelectorAll('th .sort-arrow').forEach(function(s){s.textContent='';});
      th.querySelector('.sort-arrow').textContent=dir===1?' ▲':' ▼';
      var tbody=tbl.querySelector('tbody');
      var rows=Array.from(tbody.querySelectorAll('tr'));
      var numCols={est:1,worked:1,bill:1,nonbill:1,last7:1};
      rows.sort(function(a,b){
        var av=a.getAttribute('data-'+key)||'', bv=b.getAttribute('data-'+key)||'';
        if(numCols[key]){return((parseFloat(av)||0)-(parseFloat(bv)||0))*dir;}
        return av.localeCompare(bv)*dir;
      });
      rows.forEach(function(r){tbody.appendChild(r);});
    });
  });
})();
</script>
</body>
</html>`;
}

module.exports = function registerProjectTimeSummary(ipcMain) {
  ipcMain.handle('run-project-time-summary', async () => {
    try {
      const rptSettings = loadProjectReportSettings();

      // Build exclusion list from settings (one label per line, case-insensitive exact match)
      const excludeStatusLabels = (rptSettings.excludeStatuses || '')
        .split(/[\n,]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
      const deptFilterName  = (rptSettings.departmentFilter  || '').trim();
      const typeFilterLabel = (rptSettings.projectTypeFilter || '').trim().toLowerCase();

      // 1. Get project field metadata — status picklist + projectType picklist
      let excludeStatusIds = [];
      let clientTypeId     = null;
      try {
        const fieldsRes = await atFetch('/Projects/entityInformation/fields');
        const fields    = fieldsRes.fieldInformation || fieldsRes.fields || [];

        const statusField = fields.find(f => f.name === 'status');
        if (statusField?.picklistValues && excludeStatusLabels.length) {
          excludeStatusIds = statusField.picklistValues
            .filter(v => excludeStatusLabels.includes((v.label || '').trim().toLowerCase()))
            .map(v => Number(v.value));
        }

        if (typeFilterLabel) {
          const typeField = fields.find(f => f.name === 'projectType' || f.name === 'type');
          if (typeField?.picklistValues) {
            const cv = typeField.picklistValues.find(v => (v.label || '').trim().toLowerCase() === typeFilterLabel);
            if (cv) clientTypeId = Number(cv.value);
          }
        }
      } catch {}

      // Fall back to configured numeric ID overrides (for read-only API accounts that
      // can't access entityInformation/fields)
      if (!excludeStatusIds.length && rptSettings.statusIds) {
        excludeStatusIds = rptSettings.statusIds.split(',').map(s => Number(s.trim())).filter(Boolean);
      }
      if (clientTypeId === null && rptSettings.projectTypeId) {
        clientTypeId = Number(rptSettings.projectTypeId) || null;
      }

      // 2. Find department ID — prefer configured numeric ID, then resolve by name
      let psDeptId = null;
      if (rptSettings.departmentId) {
        psDeptId = Number(rptSettings.departmentId) || null;
      } else if (deptFilterName) {
        try {
          const depts  = await atQuery('/Departments');
          const psDept = depts.find(d => (d.name || '').toLowerCase().includes(deptFilterName.toLowerCase()));
          psDeptId = psDept?.id ?? null;
        } catch {}
      }

      // 3. Query projects — only API-filterable fields (status, projectType)
      const projectFilters = [];
      if (excludeStatusIds.length) projectFilters.push({ op: 'notIn', field: 'status',      value: excludeStatusIds });
      if (clientTypeId !== null)   projectFilters.push({ op: 'eq',    field: 'projectType', value: clientTypeId });
      if (!projectFilters.length)  projectFilters.push({ op: 'gt',    field: 'id',          value: 0 });

      let projects = await atQuery('/Projects', projectFilters);

      // 4. Client-side department filter (departmentID is not queryable via API)
      if (psDeptId !== null && projects.length) {
        const psDeptIdNum = Number(psDeptId);
        const filtered = projects.filter(p => {
          const d = p.departmentID ?? p.department ?? p.departmentId;
          return Number(d) === psDeptIdNum;
        });
        if (filtered.length > 0) projects = filtered;
      }

      if (!projects.length) return { success: true, projects: [] };

      const projectIds = projects.map(p => p.id);
      const CHUNK = 50;

      // 5. Batch-lookup company names, project lead resources, and contract names
      const companyIds   = [...new Set(projects.map(p => p.companyID).filter(Boolean))];
      const resourceIds  = [...new Set(projects.map(p => p.projectLeadResourceID).filter(Boolean))];
      const contractIds  = [...new Set(projects.map(p => p.contractID).filter(Boolean))];
      const [companies, resources, contracts] = await Promise.all([
        atBatchLookup('Companies', companyIds),
        atBatchLookup('Resources', resourceIds),
        contractIds.length ? atBatchLookup('Contracts', contractIds) : Promise.resolve([]),
      ]);
      const companyMap   = Object.fromEntries(companies.map(c => [c.id, c.companyName || c.name || '']));
      const resourceMap  = Object.fromEntries(
        resources.map(r => [r.id, [r.lastName, r.firstName].filter(Boolean).join(', ')])
      );
      const contractMap  = Object.fromEntries(contracts.map(c => [c.id, c.contractName || c.name || '']));

      // 6. Get Tasks — build taskId→projectId map AND sum estimatedHours per project
      //    (report uses AggSum({*Task.Estimated Hours}), so task-level is authoritative)
      const taskMap      = new Map(); // taskId → projectId
      const estHoursMap  = {};        // projectId → summed task estimatedHours
      for (let i = 0; i < projectIds.length; i += CHUNK) {
        const chunk = projectIds.slice(i, i + CHUNK);
        try {
          const tasks = await atQuery('/Tasks', [{ op: 'in', field: 'projectID', value: chunk }]);
          for (const t of tasks) {
            taskMap.set(t.id, t.projectID);
            if (t.projectID) {
              estHoursMap[t.projectID] = (estHoursMap[t.projectID] || 0) + (t.estimatedHours || 0);
            }
          }
        } catch {}
      }

      // 7. Fetch time entries — direct (projectID) and task-linked (taskID), deduplicated
      const teById = new Map();
      const addEntries = (entries, tMap) => {
        for (const te of entries) {
          if (!te.projectID && te.taskID && tMap) te.projectID = tMap.get(te.taskID) || null;
          if (te.projectID) teById.set(te.id, te);
        }
      };

      for (let i = 0; i < projectIds.length; i += CHUNK) {
        const chunk = projectIds.slice(i, i + CHUNK);
        try {
          addEntries(await atQuery('/TimeEntries', [{ op: 'in', field: 'projectID', value: chunk }]), null);
        } catch {}
      }

      const taskIds = [...taskMap.keys()];
      for (let i = 0; i < taskIds.length; i += 100) {
        const chunk = taskIds.slice(i, i + 100);
        try {
          addEntries(await atQuery('/TimeEntries', [{ op: 'in', field: 'taskID', value: chunk }]), taskMap);
        } catch {}
      }

      // 8. Aggregate worked/billable/nonBillable/last7 hours per project from time entries
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const hoursMap = {}; // projectId → { total, billable, nonBillable, last7 }
      for (const te of teById.values()) {
        const pid = te.projectID;
        if (!pid) continue;
        if (!hoursMap[pid]) hoursMap[pid] = { total: 0, billable: 0, nonBillable: 0, last7: 0 };
        const hrs = typeof te.hoursWorked === 'number' ? te.hoursWorked : 0;
        hoursMap[pid].total += hrs;
        if (te.isNonBillable) hoursMap[pid].nonBillable += hrs;
        else                  hoursMap[pid].billable     += hrs;
        const worked = (te.dateWorked || '').slice(0, 10);
        if (worked && worked >= sevenDaysAgo) hoursMap[pid].last7 += hrs;
      }

      // 9. Load saved notes and build result
      const notes    = loadProjectNotes();
      const settings = loadProjectReportSettings();
      const excludeNums = new Set(
        (settings.excludeProjectNumbers || '')
          .split(/[\n,]+/)
          .map(s => s.trim().toLowerCase())
          .filter(Boolean)
      );
      const round2 = v => Math.round(v * 100) / 100;
      const result = projects
        .map(p => ({
          id:               p.id,
          projectName:      p.projectName || p.name || '',
          projectNumber:    p.projectNumber || '',
          contractName:     contractMap[p.contractID] || '',
          accountName:      companyMap[p.companyID] || '',
          projectLead:      resourceMap[p.projectLeadResourceID] || '',
          estimatedHours:   round2(estHoursMap[p.id] || p.estimatedHours || 0),
          workedHours:      round2(hoursMap[p.id]?.total        || 0),
          billableHours:    round2(hoursMap[p.id]?.billable     || 0),
          nonBillableHours: round2(hoursMap[p.id]?.nonBillable  || 0),
          last7Hours:       round2(hoursMap[p.id]?.last7        || 0),
          note:             notes[p.id] || '',
        }))
        .filter(p => !excludeNums.has((p.projectNumber || '').toLowerCase()))
        .sort((a, b) => a.accountName.localeCompare(b.accountName) || a.projectName.localeCompare(b.projectName));

      return { success: true, projects: result };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('get-project-notes', () => loadProjectNotes());

  ipcMain.handle('save-project-note', (_, { projectId, note }) => {
    const notes = loadProjectNotes();
    if (note?.trim()) notes[projectId] = note.trim();
    else              delete notes[projectId];
    saveProjectNotesFn(notes);
    return { success: true };
  });

  ipcMain.handle('get-project-report-settings', () => loadProjectReportSettings());

  ipcMain.handle('save-project-report-settings', (_, s) => {
    saveProjectReportSettingsFn(s);
    return { success: true };
  });

  // Resolves department/project-type/status IDs from Autotask and returns them so
  // the user can save them as overrides (needed for read-only API accounts).
  ipcMain.handle('resolve-pts-ids', async (_, { deptName, typeLabel, statusLabels }) => {
    const result = { departmentId: '', projectTypeId: '', statusIds: '' };
    try {
      const fieldsRes = await atFetch('/Projects/entityInformation/fields');
      const fields    = fieldsRes.fieldInformation || fieldsRes.fields || [];
      if (typeLabel) {
        const typeField = fields.find(f => f.name === 'projectType' || f.name === 'type');
        if (typeField?.picklistValues) {
          const cv = typeField.picklistValues.find(v => (v.label || '').trim().toLowerCase() === typeLabel.toLowerCase());
          if (cv) result.projectTypeId = String(cv.value);
        }
      }
      if (statusLabels?.length) {
        const statusField = fields.find(f => f.name === 'status');
        if (statusField?.picklistValues) {
          const ids = statusField.picklistValues
            .filter(v => statusLabels.map(s => s.toLowerCase()).includes((v.label || '').trim().toLowerCase()))
            .map(v => v.value);
          result.statusIds = ids.join(',');
        }
      }
    } catch {}
    try {
      if (deptName) {
        const depts = await atQuery('/Departments');
        const d = depts.find(dept => (dept.name || '').toLowerCase().includes(deptName.toLowerCase()));
        if (d) result.departmentId = String(d.id);
      }
    } catch {}
    return result;
  });

  ipcMain.handle('export-project-report', async (_, { projects }) => {
    try {
      const settings = loadProjectReportSettings();
      const html     = buildProjectReportHtml(projects, settings);
      const dateStr  = new Date().toISOString().slice(0, 10);
      const filePath = path.join(app.getPath('downloads'), `project-time-summary-${dateStr}.html`);
      fs.writeFileSync(filePath, html, 'utf8');
      return { success: true, filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('email-project-report', async (_, { projects }) => {
    try {
      const settings       = loadProjectReportSettings();
      const html           = buildProjectReportHtml(projects, settings);
      const dateStr        = new Date().toISOString().slice(0, 10);
      const reportFilename = `project-time-summary-${dateStr}.html`;
      const filePath       = path.join(app.getPath('downloads'), reportFilename);
      fs.writeFileSync(filePath, html, 'utf8');

      // No email protocol supports attachments natively (mailto: is attachment-less,
      // and .eml opens as a received message in new Outlook). Best cross-client UX:
      // open a compose window pre-filled via mailto: and reveal the file in Explorer
      // so the user can drag it into the email in one move.
      const to      = settings.emailTo      || '';
      const subject = encodeURIComponent(settings.emailSubject || 'Project Time Summary Report');
      const body    = encodeURIComponent(settings.emailBody    || '');
      shell.openExternal(`mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`);
      shell.showItemInFolder(filePath);

      return { success: true, filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
};
