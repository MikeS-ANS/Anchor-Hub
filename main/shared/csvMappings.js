const fs   = require('fs');
const path = require('path');
const { USER_DATA, loadMappings } = require('./state');

function parseCSVLine(line) {
  const cols = []; let cur = ''; let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

function parseCSVFull(content) {
  const records = []; let record = []; let field = ''; let inQ = false; let i = 0;
  while (i < content.length) {
    const ch = content[i];
    if (inQ) {
      if (ch === '"' && content[i + 1] === '"') { field += '"'; i += 2; }
      else if (ch === '"') { inQ = false; i++; }
      else { field += ch; i++; }
    } else {
      if (ch === '"') { inQ = true; i++; }
      else if (ch === ',') { record.push(field); field = ''; i++; }
      else if (ch === '\r' && content[i + 1] === '\n') {
        record.push(field); field = '';
        if (record.some(f => f !== '')) records.push(record);
        record = []; i += 2;
      } else if (ch === '\n') {
        record.push(field); field = '';
        if (record.some(f => f !== '')) records.push(record);
        record = []; i++;
      } else { field += ch; i++; }
    }
  }
  if (field || record.length) { record.push(field); if (record.some(f => f !== '')) records.push(record); }
  return records;
}

function csvMappingsPath()    { return path.join(USER_DATA, 'Pax8 Autotask Service Mappings.csv'); }
function clientMappingsPath() { return path.join(USER_DATA, 'Pax8 Autotask Client Mapping.csv'); }

function loadClientMappings() {
  // JSON mappings take precedence when they have accepted entries
  const json = loadMappings();
  const accepted = (json.companies || []).filter(c => c.accepted && c.atId > 0);
  if (accepted.length > 0) {
    const map = new Map();
    for (const c of accepted) map.set(c.pax8Id, { atCompanyId: c.atId, atCompanyName: c.atName || '' });
    return map;
  }
  // Fall back to CSV
  const p = clientMappingsPath();
  if (!fs.existsSync(p)) return new Map();
  const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVLine(lines[i]);
    const pax8Id = cols[0]?.trim();
    const atCompanyId = parseInt(cols[2]?.trim(), 10);
    const atCompanyName = cols[3]?.trim() || '';
    if (pax8Id && !isNaN(atCompanyId) && atCompanyId > 0) {
      map.set(pax8Id, { atCompanyId, atCompanyName });
    }
  }
  return map;
}

function loadCsvMappings() {
  // JSON mappings take precedence when they have accepted entries
  const json = loadMappings();
  const accepted = (json.services || []).filter(s => s.accepted && s.atServiceId > 0);
  if (accepted.length > 0) {
    const map = new Map();
    for (const s of accepted) map.set(s.pax8ProductId, { atServiceId: s.atServiceId, atServiceName: s.atServiceName || '' });
    return map;
  }
  // Fall back to CSV
  const csvPath = csvMappingsPath();
  if (!fs.existsSync(csvPath)) return new Map();
  const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/);
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVLine(lines[i]);
    const pax8Id = cols[0]?.trim();
    const atServiceId = parseInt(cols[2]?.trim(), 10);
    const atServiceName = cols[3]?.trim() || '';
    if (pax8Id && !isNaN(atServiceId) && atServiceId > 0) {
      map.set(pax8Id, { atServiceId, atServiceName });
    }
  }
  return map;
}

// Pax8 subscriptions with the same productId can map to DIFFERENT AT services
// depending on commitment term (Monthly/Annual/Triennial) and billing term.
function mkProductKey(sub) {
  const pid = sub.productId || sub.product?.id || sub.product_id || '';
  const ct  = (sub.commitmentTerm || sub.term?.duration || sub.termDuration || '').toUpperCase().replace(/\s+/g, '_');
  const bt  = (sub.billingTerm || sub.billingCycle || sub.term?.billingCycle || '').toUpperCase().replace(/\s+/g, '_');
  if (!ct && !bt) return pid;
  return `${pid}|${ct}|${bt}`;
}

function termLabel(sub) {
  const ct = (sub.commitmentTerm || sub.term?.duration || sub.termDuration || '').toUpperCase();
  const bt = (sub.billingTerm || sub.billingCycle || sub.term?.billingCycle || '').toUpperCase();
  const ctMap = { MONTHLY: 'Monthly', ANNUAL: 'Annual', TRIENNIAL: '3-Year',
                  P1M: 'Monthly', P1Y: 'Annual', P3Y: '3-Year' };
  const btMap = { MONTHLY: 'Monthly Billing', ANNUAL: 'Annual Billing' };
  const ctStr = ctMap[ct] || ct;
  const btStr = btMap[bt] || bt;
  if (!ctStr && !btStr) return '';
  if (ctStr === btStr || !btStr) return ctStr;
  if (!ctStr) return btStr;
  return `${ctStr} / ${btStr}`;
}

module.exports = {
  parseCSVLine, parseCSVFull,
  csvMappingsPath, clientMappingsPath,
  loadClientMappings, loadCsvMappings,
  mkProductKey, termLabel,
};
