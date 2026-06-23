const keytar          = require('keytar');
const fetch           = require('node-fetch');
const { kvGetSecret } = require('./kv');
const { SERVICE_NAME } = require('./state');

async function getAtBaseUrl(username) {
  let stored = await keytar.getPassword(SERVICE_NAME, 'autotask_url');
  if (stored) {
    if (!stored.toLowerCase().endsWith('/v1.0')) {
      stored = `${stored.replace(/\/$/, '')}/v1.0`;
      await keytar.setPassword(SERVICE_NAME, 'autotask_url', stored);
    }
    return stored;
  }
  const res = await fetch(`https://webservices2.autotask.net/atservicesrest/v1.0/zoneInformation?user=${encodeURIComponent(username)}`);
  if (!res.ok) throw new Error(`Zone discovery failed (${res.status}) — set API Base URL in Settings manually.`);
  const data = await res.json();
  let url = (data.url || '').replace(/\/$/, '');
  if (!url) throw new Error('Zone discovery returned no URL — set API Base URL in Settings manually.');
  if (!url.toLowerCase().endsWith('/v1.0')) url = `${url}/v1.0`;
  await keytar.setPassword(SERVICE_NAME, 'autotask_url', url);
  return url;
}

async function atFetch(path, opts = {}) {
  let username        = await keytar.getPassword(SERVICE_NAME, 'autotask_username');
  let apiKey          = await keytar.getPassword(SERVICE_NAME, 'autotask_api_key');
  let integrationCode = await keytar.getPassword(SERVICE_NAME, 'autotask_integration_code');
  if (!username || !apiKey || !integrationCode) {
    username        = await kvGetSecret('autotask-username');
    apiKey          = await kvGetSecret('autotask-secret');
    integrationCode = await kvGetSecret('autotask-integration-code');
  }
  if (!username || !apiKey) throw new Error('Autotask credentials not configured. Add your personal key in Settings or contact your admin.');
  if (!integrationCode) throw new Error('Autotask Integration Code not configured.');
  const baseUrl = await getAtBaseUrl(username);

  for (let attempt = 0; attempt < 4; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    let res;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        ...opts,
        signal: controller.signal,
        headers: { 'ApiIntegrationCode': integrationCode, 'UserName': username, 'Secret': apiKey, 'Content-Type': 'application/json', ...(opts.headers || {}) }
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 429) {
      const wait = parseInt(res.headers.get('retry-after') || '10', 10);
      await new Promise(r => setTimeout(r, wait * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`Autotask ${res.status}: ${await res.text()}`);
    return res.json();
  }
  throw new Error('Autotask rate limit: too many retries (429). Try again in a moment.');
}

async function atQuery(entityPath, filters = []) {
  let all = [], maxId = 0;
  while (true) {
    const r = await atFetch(`${entityPath}/query`, {
      method: 'POST',
      body: JSON.stringify({ filter: [...filters, { op: 'gt', field: 'id', value: maxId }] })
    });
    const items = r.items || [];
    if (!items.length) break;
    all = all.concat(items);
    maxId = Math.max(...items.map(i => i.id));
    if (items.length < 500) break;
  }
  return all;
}

async function atBatchLookup(entity, ids) {
  if (!ids || !ids.length) return [];
  const CHUNK = 200;
  const results = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    try {
      const r = await atFetch(`/${entity}/query`, {
        method: 'POST',
        body: JSON.stringify({ filter: [{ op: 'in', field: 'id', value: chunk }] }),
      });
      results.push(...(r.items || []));
    } catch (e) {
      console.warn(`atBatchLookup(${entity}) chunk failed:`, e.message);
    }
  }
  return results;
}

// ContractServices path auto-detector — tries 4 variants, caches the first that works
let _csWorkingPath = null;

async function getContractServices(contractId, send) {
  const makeAttempts = (id) => [
    ['child /Contracts/{id}/ContractServices/',  () => atFetch(`/Contracts/${id}/ContractServices/`)],
    ['child /Contracts/{id}/Services/',          () => atFetch(`/Contracts/${id}/Services/`)],
    ['POST /ContractServices/query',             () => atFetch('/ContractServices/query', { method: 'POST', body: JSON.stringify({ filter: [{ op: 'eq', field: 'contractID', value: id }] }) })],
    ['GET /ContractServices/query?search=…',     () => atFetch(`/ContractServices/query?search=${encodeURIComponent(JSON.stringify({ filter: [{ op: 'eq', field: 'contractID', value: id }] }))}`)],
  ];

  if (_csWorkingPath) {
    const attempt = makeAttempts(contractId).find(([name]) => name === _csWorkingPath);
    if (attempt) {
      const r = await attempt[1]();
      return r.items || [];
    }
  }

  for (const [name, fn] of makeAttempts(contractId)) {
    try {
      const r = await fn();
      if (r && r.items !== undefined) {
        _csWorkingPath = name;
        if (send) send(`  ℹ ContractServices path: ${name}`, 'info');
        return r.items;
      }
    } catch (e) {
      if (!/Autotask 404/.test(e.message)) throw e;
    }
  }
  if (send) send(`  ⚠ All ContractServices path attempts 404'd for contract ${contractId}`, 'warn');
  return [];
}

function resetCsWorkingPath() { _csWorkingPath = null; }

module.exports = { atFetch, atQuery, atBatchLookup, getAtBaseUrl, getContractServices, resetCsWorkingPath };
