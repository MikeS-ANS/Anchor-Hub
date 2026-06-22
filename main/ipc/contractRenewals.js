const fs   = require('fs');
const path = require('path');
const { USER_DATA } = require('../shared/state');
const { atFetch, atBatchLookup } = require('../shared/at');

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

module.exports = function registerContractRenewals(ipcMain) {
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
};
