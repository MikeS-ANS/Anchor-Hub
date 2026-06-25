/**
 * Migrates bp-company-mappings.json + hub-company-mappings.json
 * into the new AT-centric hub-company-mappings.json (v2).
 *
 * Run once: node scripts/migrate-company-directory.js
 */

const fs   = require('fs');
const path = require('path');

const SP_LOCAL = path.join(
  'C:\\Users\\Mstew\\OneDrive - Anchor Network Solutions',
  'ANS-Company Shared\\Anchor Hub'
);

const bpPath  = path.join(SP_LOCAL, 'bp-company-mappings.json');
const hubPath = path.join(SP_LOCAL, 'hub-company-mappings.json');
const outPath = hubPath; // overwrite in-place

console.log('Reading source files...');
const bpRaw  = JSON.parse(fs.readFileSync(bpPath,  'utf8'));
const hubRaw = JSON.parse(fs.readFileSync(hubPath, 'utf8'));

// Guard: don't re-migrate if already v2
if (hubRaw._version === 2) {
  console.log('hub-company-mappings.json is already v2 — nothing to do.');
  console.log('Pax8 data will be repopulated from the API when running a sync in the Company Directory.');
  process.exit(0);
}

// ── Build map: atId → entry ────────────────────────────────────────────────
const byAtId = new Map();

// Helper: get or create entry
function getEntry(atId, atName) {
  if (!byAtId.has(atId)) {
    byAtId.set(atId, { atId, atName: atName || '', excluded: false, platforms: {} });
  }
  return byAtId.get(atId);
}

// ── Process Pax8 (hub) mappings ────────────────────────────────────────────
const unmatched = []; // Pax8 companies not yet linked to AT

for (const co of (hubRaw.companies || [])) {
  if (co.atId) {
    const entry = getEntry(co.atId, co.atName);
    // Preserve better atName (non-empty, trimmed)
    if (co.atName && co.atName.trim() && !entry.atName.trim()) entry.atName = co.atName.trim();
    // Only mark excluded at the global level if explicitly excluded in hub
    if (co.excluded) entry.excluded = true;
    // pax8 is an array (multiple Pax8 companies can map to the same AT ID)
    if (!entry.platforms.pax8) entry.platforms.pax8 = [];
    entry.platforms.pax8.push({
      id:         co.pax8Id   || '',
      name:       co.pax8Name || '',
      confidence: co.confidence || 'low',
      source:     co.source     || 'none',
    });
  } else {
    // Unmatched or excluded-only Pax8 company
    unmatched.push({
      atId:     null,
      atName:   null,
      excluded: co.excluded || false,
      platforms: {
        pax8: [{ // array even for single entries
          id:         co.pax8Id   || '',
          name:       co.pax8Name || '',
          confidence: co.confidence || 'unmatched',
          source:     co.source     || 'none',
        }],
      },
    });
  }
}

// ── Process BlackPoint mappings ────────────────────────────────────────────
const bpExcluded = new Set(Object.keys(bpRaw.excluded || {}));

for (const [bpName, bpData] of Object.entries(bpRaw.mappings || {})) {
  const atId = bpData.atCompanyId;
  if (!atId) continue;
  const entry = getEntry(atId, bpData.atCompanyName);
  if (bpData.atCompanyName && !entry.atName.trim()) entry.atName = bpData.atCompanyName;

  entry.platforms.blackpoint = {
    name:       bpName,
    confidence: bpData.confidence || 0,
  };
  if (bpData.confirmedAt) entry.platforms.blackpoint.confirmedAt = bpData.confirmedAt;
  // If name appears in BP excluded list, mark it excluded in the BP platform entry
  if (bpExcluded.has(bpName)) entry.platforms.blackpoint.excluded = true;
}

// ── Companies with no Pax8 match (BP-only entries) ────────────────────────
// These came in via byAtId from the BP loop above — they're already in the map.
// No extra work needed.

// ── Sort and assemble ──────────────────────────────────────────────────────
const matched = [...byAtId.values()].sort((a, b) =>
  (a.atName || '').toLowerCase().localeCompare((b.atName || '').toLowerCase())
);

// Unmatched go after matched, sorted by Pax8 name
unmatched.sort((a, b) =>
  (a.platforms?.pax8?.name || '').toLowerCase().localeCompare((b.platforms?.pax8?.name || '').toLowerCase())
);

const companies = [...matched, ...unmatched];

const output = {
  _updated: new Date().toISOString(),
  _version: 2,
  companies,
  services: hubRaw.services || [],
};

// ── Write ──────────────────────────────────────────────────────────────────
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');

const hasPax8   = c => Array.isArray(c.platforms?.pax8) && c.platforms.pax8.length > 0;
const bpOnly    = matched.filter(c => !hasPax8(c) && c.platforms.blackpoint).length;
const pax8Only  = matched.filter(c =>  hasPax8(c) && !c.platforms.blackpoint).length;
const both      = matched.filter(c =>  hasPax8(c) &&  c.platforms.blackpoint).length;

console.log(`\n✓ Migration complete → ${outPath}`);
console.log(`  ${matched.length}  matched companies (anchored to AT ID)`);
console.log(`    ${both}     have both Pax8 + BlackPoint data`);
console.log(`    ${pax8Only}     have Pax8 only`);
console.log(`    ${bpOnly}      have BlackPoint only`);
console.log(`  ${unmatched.length}  unmatched Pax8 companies (no AT link yet)`);
console.log(`  ${(hubRaw.services || []).length}  services carried over unchanged`);
console.log('\nOneDrive will sync this to SharePoint automatically.');
console.log('The old bp-company-mappings.json can be deleted once BlackPoint tool is updated.');
