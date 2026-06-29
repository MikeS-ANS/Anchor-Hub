const { atFetch, atQuery } = require('../shared/at');
const { savePushLogEntry } = require('../shared/state');
const { loadHubDirectory, getServiceMappings, getSvcAtServiceIds } = require('../shared/hubDirectory');

// Module-level fallback constants (used when hub service mappings are unavailable).
const DEFAULT_AT_SVC_IDS = {
  azure:      110,
  nerdio:     159,
  exclaimer:  [262, 288],
  ironscales: 275,
  printix:    266,
};
const DEFAULT_AT_CONTRACT_NAME = {
  azure:      ['Azure'],
  nerdio:     ['Azure'],
  exclaimer:  ['Managed Cloud'],
  ironscales: ['Managed Cloud', 'Managed Security'],
  printix:    ['Managed Cloud'],
};

// Build AT_SVC_IDS and AT_CONTRACT_NAME from hub service mappings (pax8 group).
function buildAtPax8Maps(hub) {
  const svcIds = {};
  const contractNames = {};
  for (const m of getServiceMappings(hub, 'pax8')) {
    if (!m.vendorKey) continue;
    const ids = getSvcAtServiceIds(m);
    if (!ids.length) continue;
    for (const id of ids) {
      if (svcIds[m.vendorKey] == null) {
        svcIds[m.vendorKey] = id;
        contractNames[m.vendorKey] = [...(m.contracts || [])];
      } else {
        svcIds[m.vendorKey] = [].concat(svcIds[m.vendorKey], id);
        for (const c of (m.contracts || [])) {
          if (!contractNames[m.vendorKey].includes(c)) contractNames[m.vendorKey].push(c);
        }
      }
    }
  }
  return { svcIds, contractNames };
}

async function atFindContract(companyId, namePattern, effectiveDate) {
  const all = await atQuery('/Contracts', [
    { field: 'companyID',    op: 'eq',       value: parseInt(companyId, 10) },
    { field: 'contractName', op: 'contains', value: namePattern },
    { field: 'status',       op: 'eq',       value: 1 },
  ]);
  const eligible = all
    .filter(c => new Date(c.startDate) <= new Date(effectiveDate))
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  return eligible[0] || null;
}

async function atFindContractService(contractId, serviceId) {
  const all = await atQuery('/ContractServices', [
    { field: 'contractID', op: 'eq', value: contractId },
    { field: 'serviceID',  op: 'eq', value: serviceId  },
  ]);
  return all[0] || null;
}

async function atGetCurrentUnits(contractServiceId) {
  const all = await atQuery('/ContractServiceUnits', [
    { field: 'contractServiceID', op: 'eq', value: contractServiceId },
  ]);
  if (!all.length) return 0;
  all.sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0));
  return all[0].units || 0;
}

async function atLocateService(companyId, serviceType, effectiveDate, svcIds, contractNames) {
  const serviceIds = [].concat(svcIds[serviceType] ?? []);
  const patterns   = contractNames[serviceType] ?? [];
  for (const pattern of patterns) {
    const contract = await atFindContract(companyId, pattern, effectiveDate);
    if (!contract) continue;
    for (const svcId of serviceIds) {
      const cs = await atFindContractService(contract.id, svcId);
      if (cs) return { contract, cs };
    }
  }
  return null;
}

module.exports = function registerAtPush(ipcMain) {
  ipcMain.handle('at-push-azure', async (_, { rows, effectiveDate }) => {
    const hub = await loadHubDirectory();
    const { svcIds, contractNames } = buildAtPax8Maps(hub);
    const results = [];
    for (const row of rows) {
      if (!row.atCompanyId) { results.push({ company: row.company, status: 'no_mapping' }); continue; }
      try {
        const found = await atLocateService(row.atCompanyId, 'azure', effectiveDate, svcIds, contractNames);
        if (!found) { results.push({ company: row.company, status: 'no_contract' }); continue; }
        const { contract, cs } = found;
        await atFetch('/ContractServiceAdjustments', {
          method: 'POST',
          body: JSON.stringify({
            contractID:        contract.id,
            contractServiceID: cs.id,
            effectiveDate,
            adjustedUnitCost:  row.cost,
            adjustedUnitPrice: row.price,
          }),
        });
        const verify = await atFindContractService(contract.id, cs.serviceID);
        const ok = verify &&
                   Math.abs(verify.unitCost  - row.cost)  < 0.005 &&
                   Math.abs(verify.unitPrice - row.price) < 0.005;
        results.push({ company: row.company, status: 'success', verified: ok,
                       contractId: contract.id, serviceLineId: cs.id });
      } catch (e) {
        results.push({ company: row.company, status: 'error', message: e.message });
      }
    }
    const summary = {
      success: results.filter(r => r.status === 'success').length,
      skipped: results.filter(r => ['no_mapping','no_contract','no_change'].includes(r.status)).length,
      errors:  results.filter(r => r.status === 'error').length,
    };
    savePushLogEntry({ ts: new Date().toISOString(), serviceType: 'azure', effectiveDate, results, summary });
    return { results };
  });

  async function atPushQtyService(rows, serviceType, effectiveDate, svcIds, contractNames) {
    const results = [];
    for (const row of rows) {
      if (!row.atCompanyId) { results.push({ company: row.company, status: 'no_mapping' }); continue; }
      try {
        const found = await atLocateService(row.atCompanyId, serviceType, effectiveDate, svcIds, contractNames);
        if (!found) { results.push({ company: row.company, status: 'no_contract' }); continue; }
        const { contract, cs } = found;
        const currentUnits = await atGetCurrentUnits(cs.id);
        const unitChange   = row.qty - currentUnits;
        if (unitChange === 0) {
          results.push({ company: row.company, status: 'no_change', qty: row.qty }); continue;
        }
        await atFetch('/ContractServiceAdjustments', {
          method: 'POST',
          body: JSON.stringify({
            contractID:        contract.id,
            contractServiceID: cs.id,
            effectiveDate,
            unitChange,
          }),
        });
        results.push({ company: row.company, status: 'success',
                       contractId: contract.id, serviceLineId: cs.id,
                       previousQty: currentUnits, newQty: row.qty, unitChange });
      } catch (e) {
        results.push({ company: row.company, status: 'error', message: e.message });
      }
    }
    const summary = {
      success: results.filter(r => r.status === 'success').length,
      skipped: results.filter(r => ['no_mapping','no_contract','no_change'].includes(r.status)).length,
      errors:  results.filter(r => r.status === 'error').length,
    };
    savePushLogEntry({ ts: new Date().toISOString(), serviceType, effectiveDate, results, summary });
    return { results };
  }

  async function atPushQtyWithHub(rows, serviceType, effectiveDate) {
    const hub = await loadHubDirectory();
    const { svcIds, contractNames } = buildAtPax8Maps(hub);
    return atPushQtyService(rows, serviceType, effectiveDate, svcIds, contractNames);
  }

  ipcMain.handle('at-push-nerdio',     async (_, d) => atPushQtyWithHub(d.rows, 'nerdio',     d.effectiveDate));
  ipcMain.handle('at-push-exclaimer',  async (_, d) => atPushQtyWithHub(d.rows, 'exclaimer',  d.effectiveDate));
  ipcMain.handle('at-push-ironscales', async (_, d) => atPushQtyWithHub(d.rows, 'ironscales', d.effectiveDate));
  ipcMain.handle('at-push-printix',    async (_, d) => atPushQtyWithHub(d.rows, 'printix',    d.effectiveDate));
};
