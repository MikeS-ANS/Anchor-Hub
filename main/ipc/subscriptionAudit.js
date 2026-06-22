const fs     = require('fs');
const path   = require('path');
const keytar = require('keytar');
const { dialog, shell } = require('electron');
const { SERVICE_NAME, USER_DATA, getMainWindow, loadMappings } = require('../shared/state');
const { getPax8Token, pax8Paginate, resolveProductName, clearProductNameCache } = require('../shared/pax8');
const { atFetch, atQuery, getAtBaseUrl, getContractServices, resetCsWorkingPath } = require('../shared/at');
const { loadCsvMappings, loadClientMappings, mkProductKey } = require('../shared/csvMappings');

function loadExcludedCompanies() {
  return new Set((loadMappings().companies || []).filter(c => c.excluded).map(c => c.pax8Id));
}

const atServiceCache = new Map();
async function resolveAtServiceName(serviceId) {
  if (atServiceCache.has(serviceId)) return atServiceCache.get(serviceId);
  try {
    const r = await atFetch(`/Services/${serviceId}`);
    const name = r.item?.name || r.name || null;
    atServiceCache.set(serviceId, name);
    return name;
  } catch { atServiceCache.set(serviceId, null); return null; }
}

module.exports = function registerSubscriptionAudit(ipcMain) {
  ipcMain.handle('get-csv-status', () => {
    const { csvMappingsPath, clientMappingsPath } = require('../shared/csvMappings');
    const svcMap = loadCsvMappings();
    const cliMap = loadClientMappings();
    return {
      services: { found: fs.existsSync(csvMappingsPath()), count: svcMap.size },
      clients:  { found: fs.existsSync(clientMappingsPath()), count: cliMap.size },
    };
  });

  ipcMain.handle('open-csv-folder', () => {
    shell.openPath(USER_DATA);
    return true;
  });

  ipcMain.handle('export-discrepancies', async (_, discrepancies) => {
    const { filePath } = await dialog.showSaveDialog(getMainWindow(), {
      title: 'Export Discrepancies',
      defaultPath: `pax8-audit-${new Date().toISOString().slice(0,10)}.csv`,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });
    if (!filePath) return { cancelled: true };
    const esc = s => `"${String(s).replace(/"/g, '""')}"`;
    const header = 'Company,Product,Pax8 Qty\n';
    const rows = discrepancies.map(d => `${esc(d.company)},${esc(d.product)},${d.pax8Qty}`).join('\n');
    fs.writeFileSync(filePath, header + rows, 'utf8');
    return { success: true, filePath };
  });

  let auditAbortFlag = false;
  ipcMain.handle('abort-audit', () => { auditAbortFlag = true; return true; });

  ipcMain.handle('run-subscription-audit', async (event, { dryRun = false } = {}) => {
    auditAbortFlag = false;
    resetCsWorkingPath();
    const send = (msg, type = 'info') => getMainWindow().webContents.send('audit-log', { msg, type, ts: new Date().toISOString() });
    const results = { discrepancies: [], matched: 0, checked: 0, ticketsCreated: 0, errors: [] };
    const excludedCompanies = loadExcludedCompanies();
    clearProductNameCache();
    atServiceCache.clear();

    try {
      if (dryRun) send('⚠ DRY RUN MODE — no tickets will be created', 'warn');

      const csvMappings    = loadCsvMappings();
      const clientMappings = loadClientMappings();
      send(`ℹ ${csvMappings.size} product mappings, ${clientMappings.size} client mappings loaded`, 'info');

      send('Authenticating with Pax8...');
      const token = await getPax8Token();
      send('✓ Pax8 token obtained', 'success');

      send('Fetching Pax8 companies...');
      const companies = await pax8Paginate(token, '/companies');
      send(`✓ Found ${companies.length} Pax8 companies`, 'success');

      send('Fetching all active Pax8 subscriptions...');
      const allSubs = await pax8Paginate(token, '/subscriptions?status=Active');
      send(`✓ Found ${allSubs.length} active subscriptions`, 'success');

      const subsByCompany = {};
      for (const sub of allSubs) {
        const cid = sub.companyId;
        if (!subsByCompany[cid]) subsByCompany[cid] = [];
        subsByCompany[cid].push(sub);
      }

      for (const company of companies) {
        if (auditAbortFlag) { send('⚠ Audit stopped by user.', 'warn'); break; }
        if (excludedCompanies.has(company.id)) continue;
        const subs = subsByCompany[company.id] || [];
        if (!subs.length) continue;
        send(`Checking ${company.name} (${subs.length} subscriptions)...`);

        const clientEntry = clientMappings.get(company.id);
        if (!clientEntry) {
          send(`  — No client mapping for: ${company.name} (${company.id})`, 'warn');
          continue;
        }
        const atCompanyId = clientEntry.atCompanyId;

        let contracts = [];
        try {
          contracts = await atQuery('/Contracts', [
            { op: 'eq', field: 'companyID', value: atCompanyId },
            { op: 'eq', field: 'status', value: 1 }
          ]);
        } catch (e) {
          send(`  ⚠ Contract lookup failed for ${company.name}: ${e.message}`, 'warn');
          results.errors.push({ company: company.name, error: e.message });
          continue;
        }

        if (!contracts.length) {
          send(`  — No active Autotask contracts for ${company.name}`, 'warn');
          continue;
        }

        const psaServiceIds = new Set();
        for (const contract of contracts) {
          try {
            const items = await getContractServices(contract.id, send);
            for (const cs of items) {
              const sId = cs.serviceID ?? cs.id;
              if (sId != null) psaServiceIds.add(sId);
            }
          } catch (e) {
            send(`  ⚠ Contract services fetch failed (contract ${contract.id}): ${e.message}`, 'warn');
          }
        }

        for (const sub of subs) {
          results.checked++;
          const productName = await resolveProductName(token, sub);
          if (!productName) { send(`  — Skipping subscription ${sub.id}: product name unresolvable`, 'warn'); continue; }
          const pax8Qty = Number(sub.quantity) || 0;

          let matchedServiceId = null;
          const csvEntry = csvMappings.get(mkProductKey(sub)) || csvMappings.get(sub.productId || sub.product?.id || '');

          if (csvEntry) {
            if (psaServiceIds.has(csvEntry.atServiceId)) {
              matchedServiceId = csvEntry.atServiceId;
            } else if (csvEntry.atServiceName) {
              const csvNameLower = csvEntry.atServiceName.toLowerCase();
              for (const sId of psaServiceIds) {
                const sName = await resolveAtServiceName(sId);
                if (!sName) continue;
                const sLower = sName.toLowerCase();
                if (sLower.includes(csvNameLower) || csvNameLower.includes(sLower)) {
                  matchedServiceId = sId; break;
                }
              }
            }
          }

          if (matchedServiceId === null) {
            const pLower = productName.toLowerCase();
            for (const sId of psaServiceIds) {
              const sName = await resolveAtServiceName(sId);
              if (!sName) continue;
              const sLower = sName.toLowerCase();
              if (sLower.includes(pLower) || pLower.includes(sLower)) {
                matchedServiceId = sId; break;
              }
            }
          }

          if (matchedServiceId === null) {
            const diff = pax8Qty;
            results.discrepancies.push({ company: company.name, product: productName, pax8Qty, psaQty: 0, diff });
            send(`  ✗ MISSING FROM PSA: ${productName} (Pax8 qty: ${pax8Qty})`, 'error');
            if (dryRun) {
              send(`    → [DRY RUN] Would create ticket`, 'info');
              results.ticketsCreated++;
            } else {
              try {
                const dueDateTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
                await atFetch('/Tickets', {
                  method: 'POST',
                  body: JSON.stringify({
                    title: `[Pax8 Audit] Service Missing from PSA: ${productName} — ${company.name}`,
                    description: `Pax8 Subscription Audit found a product with no matching service on any active Autotask contract.\n\nCompany: ${company.name}\nProduct: ${productName}\nPax8 Qty: ${pax8Qty}\nPSA Contract: Not found\n\nPlease add this service to the appropriate Autotask contract.`,
                    companyID: atCompanyId,
                    status: 1, priority: 2, queueID: 8,
                    dueDateTime
                  })
                });
                results.ticketsCreated++;
                send(`    → Ticket created`, 'success');
              } catch (e) { send(`    ⚠ Ticket creation failed: ${e.message}`, 'warn'); }
            }
          } else {
            results.matched++;
            send(`  ✓ ${productName} found in PSA`, 'success');
          }
        }
      }

      send('────────────────────────────', 'divider');
      send(`Subscriptions checked: ${results.checked}`);
      send(`Found in PSA (existence confirmed): ${results.matched}`, 'success');
      send(`Discrepancies found: ${results.discrepancies.length}`, results.discrepancies.length > 0 ? 'error' : 'success');
      send(`Tickets created in Autotask: ${results.ticketsCreated}`, 'info');
      if (results.errors.length) send(`Errors encountered: ${results.errors.length}`, 'warn');

      return { success: true, results };
    } catch (err) {
      send(`Fatal: ${err.message}`, 'error');
      return { success: false, error: err.message, results };
    }
  });

  ipcMain.handle('detect-at-zone', async () => {
    const username = await keytar.getPassword(SERVICE_NAME, 'autotask_username');
    if (!username) throw new Error('Enter your Autotask username first.');
    await keytar.deletePassword(SERVICE_NAME, 'autotask_url');
    const url = await getAtBaseUrl(username);
    return url;
  });

  ipcMain.handle('fetch-pax8-companies', async () => {
    const token = await getPax8Token();
    return pax8Paginate(token, '/companies');
  });
};
