// One-time setup: creates Hub Role Matrix and Hub Title Roles lists on SharePoint.
// Run from the project root:  node scripts/setup-role-matrix.js
//
// FIRST-TIME REQUIREMENT:
//   When prompted, open the URL in a browser signed in as Mike (Global Admin) and
//   check "Consent on behalf of your organization" before accepting.
//   This grants Sites.Manage.All for the whole tenant — needed once, persists forever.

const { PublicClientApplication } = require('@azure/msal-node');
const fetch = require('node-fetch');

const CLIENT_ID = '77dedc7f-7fe0-4814-b243-1a0ed8a5bb7e';
const TENANT_ID = '56946bea-f25a-4d9c-ab2e-0cc6945e4daa';
const SCOPES    = ['https://graph.microsoft.com/Sites.Manage.All'];
const GRAPH     = 'https://graph.microsoft.com/v1.0';
const SP_HOST   = 'anchornetworksolutions.sharepoint.com';
const SP_PATH   = '/sites/Intranet';

// ── Seed data ────────────────────────────────────────────────────────────────

const TITLE_ROLES = [
  { title: 'Managing Director',                                     role: 'hub.admin' },
  { title: 'Director of Service Delivery',                          role: 'hub.admin' },
  { title: 'Director of Strategic Services',                        role: 'hub.admin' },
  { title: 'Director of Client Success',                            role: 'hub.admin' },
  { title: 'Manager of Service Delivery',                           role: 'hub.manager' },
  { title: 'Manager of Professional Services',                      role: 'hub.manager' },
  { title: 'Technical Account Manager',                             role: 'hub.tam' },
  { title: 'Account Manager',                                       role: 'hub.strategic' },
  { title: 'Client Experience Manager',                             role: 'hub.strategic' },
  { title: 'Technology Strategist',                                 role: 'hub.strategic' },
  { title: 'Talent Acquisition and Learning Manager',               role: 'hub.strategic' },
  { title: 'Technical Project Engineer',                            role: 'hub.projects' },
  { title: 'Project Engineer',                                      role: 'hub.projects' },
  { title: 'Service Desk Engineer',                                 role: 'hub.delivery' },
  { title: 'Service Desk Team Lead',                                role: 'hub.delivery' },
  { title: 'Service Desk Technical Coordinator',                    role: 'hub.delivery' },
  { title: 'Co-Managed Technical Lead',                             role: 'hub.delivery' },
  { title: 'Centralized Technical Services Engineer',               role: 'hub.delivery' },
  { title: 'Cybersecurity Administrator',                           role: 'hub.delivery' },
  { title: 'Office Administrator',                                  role: 'hub.delivery' },
  { title: 'Accountant',                                            role: 'hub.finance' },
  { title: 'Accounting Assistant',                                  role: 'hub.finance' },
  { title: 'Business Development',                                  role: 'hub.sales' },
  { title: 'Business Development Manager',                          role: 'hub.sales' },
  { title: 'Workstation Deployment Specialist',                     role: 'hub.wsd' },
  { title: 'WorkStation Deployment Specialist',                     role: 'hub.wsd' },
  { title: 'Workstation Deployment Specialist / Security Analyst',  role: 'hub.wsd' },
];

const ROLES = ['Admin','Manager','Delivery','Tam','Strategic','Projects','Finance','Sales','Wsd'];

// tool key → display name + per-role access
const TOOL_MATRIX = [
  { key: 'subscription-audit',    name: 'M365 Subscription Comparison', Admin:1, Manager:1, Delivery:0, Tam:0, Strategic:0, Projects:0, Finance:1, Sales:0, Wsd:0 },
  { key: 'invoice-monitor',       name: 'Pax8 Invoice Processor',       Admin:1, Manager:0, Delivery:0, Tam:0, Strategic:0, Projects:0, Finance:1, Sales:0, Wsd:0 },
  { key: 'margin-analyzer',       name: 'M365 Margin Analyzer',         Admin:1, Manager:0, Delivery:0, Tam:0, Strategic:0, Projects:0, Finance:1, Sales:0, Wsd:0 },
  { key: 'company-mapping',       name: 'Company Mapping',              Admin:1, Manager:0, Delivery:0, Tam:0, Strategic:0, Projects:0, Finance:0, Sales:0, Wsd:0 },
  { key: 'invoice-processor',     name: 'Pax8 Invoice Comparison',      Admin:1, Manager:0, Delivery:0, Tam:0, Strategic:0, Projects:0, Finance:1, Sales:0, Wsd:0 },
  { key: 'kaseya-processor',      name: 'Kaseya Invoice Processor',     Admin:1, Manager:0, Delivery:0, Tam:0, Strategic:0, Projects:0, Finance:1, Sales:0, Wsd:0 },
  { key: 'project-time-summary',  name: 'Project Time Summary',         Admin:1, Manager:1, Delivery:0, Tam:0, Strategic:0, Projects:1, Finance:0, Sales:0, Wsd:0 },
  { key: 'contract-changes',      name: 'Autotask Contract Changes',    Admin:1, Manager:0, Delivery:0, Tam:0, Strategic:0, Projects:0, Finance:1, Sales:0, Wsd:0 },
  { key: 'contract-renewals',     name: 'Autotask Contract Renewals',   Admin:1, Manager:0, Delivery:0, Tam:0, Strategic:0, Projects:0, Finance:1, Sales:0, Wsd:0 },
  { key: 'blackpoint-processor',  name: 'BlackPoint Usage',             Admin:1, Manager:0, Delivery:0, Tam:0, Strategic:1, Projects:0, Finance:1, Sales:0, Wsd:0 },
  { key: 'msc-agreements',        name: 'MSC Agreements',               Admin:1, Manager:0, Delivery:0, Tam:0, Strategic:1, Projects:0, Finance:1, Sales:0, Wsd:0 },
  { key: 'duo-management',        name: 'Duo Management',               Admin:1, Manager:1, Delivery:1, Tam:1, Strategic:1, Projects:0, Finance:0, Sales:0, Wsd:0 },
  { key: 'project-profitability', name: 'Project Profitability',        Admin:1, Manager:1, Delivery:0, Tam:0, Strategic:0, Projects:1, Finance:0, Sales:0, Wsd:0 },
];

// ── Auth ─────────────────────────────────────────────────────────────────────

async function getToken() {
  const msal = new PublicClientApplication({
    auth: { clientId: CLIENT_ID, authority: `https://login.microsoftonline.com/${TENANT_ID}` },
  });
  const result = await msal.acquireTokenByDeviceCode({
    scopes: SCOPES,
    deviceCodeCallback: (r) => { console.log('\n' + r.message + '\n'); },
  });
  return result.accessToken;
}

// ── Graph helpers ─────────────────────────────────────────────────────────────

async function gFetch(token, path, opts = {}) {
  const r = await fetch(`${GRAPH}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Graph ${r.status} ${path}: ${body?.error?.message || JSON.stringify(body)}`);
  return body;
}

async function getSiteId(token) {
  const d = await gFetch(token, `/sites/${SP_HOST}:${SP_PATH}`);
  return d.id;
}

async function createList(token, siteId, displayName) {
  console.log(`  Creating list: ${displayName}`);
  const d = await gFetch(token, `/sites/${siteId}/lists`, {
    method: 'POST',
    body: JSON.stringify({ displayName, list: { template: 'genericList' } }),
  });
  return d.id;
}

async function addColumn(token, siteId, listId, name, type = 'boolean') {
  let body;
  if (type === 'text')     body = { name, text: {} };
  else if (type === 'number') body = { name, number: {} };
  else if (type === 'dateTime') body = { name, dateTime: {} };
  else                     body = { name, boolean: {} };
  await gFetch(token, `/sites/${siteId}/lists/${listId}/columns`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

async function addItem(token, siteId, listId, fields) {
  await gFetch(token, `/sites/${siteId}/lists/${listId}/items`, {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });
}

async function listExists(token, siteId, displayName) {
  const d = await gFetch(token, `/sites/${siteId}/lists?$select=displayName,id`);
  return (d.value || []).find(l => l.displayName === displayName);
}

// ── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  try {
    console.log('Anchor Hub — Role Matrix Setup');
    console.log('================================\n');
    console.log('Authenticating...');
    const token  = await getToken();
    console.log('✓ Authenticated\n');

    const siteId = await getSiteId(token);
    console.log(`✓ Site ID: ${siteId}\n`);

    // ── Hub Title Roles ──────────────────────────────────────────────────────
    let titleListId;
    const existingTitleList = await listExists(token, siteId, 'Hub Title Roles');
    if (existingTitleList) {
      titleListId = existingTitleList.id;
      console.log(`  Hub Title Roles already exists (${titleListId}) — skipping creation`);
    } else {
      titleListId = await createList(token, siteId, 'Hub Title Roles');
      await addColumn(token, siteId, titleListId, 'HubRole', 'text');
      console.log('  Seeding title → role mappings...');
      for (const { title, role } of TITLE_ROLES) {
        await addItem(token, siteId, titleListId, { Title: title, HubRole: role });
        process.stdout.write('.');
      }
      console.log(`\n✓ Hub Title Roles created with ${TITLE_ROLES.length} entries\n`);
    }

    // ── Hub Role Matrix ──────────────────────────────────────────────────────
    let matrixListId;
    const existingMatrix = await listExists(token, siteId, 'Hub Role Matrix');
    if (existingMatrix) {
      matrixListId = existingMatrix.id;
      console.log(`  Hub Role Matrix already exists (${matrixListId}) — skipping creation`);
    } else {
      matrixListId = await createList(token, siteId, 'Hub Role Matrix');
      await addColumn(token, siteId, matrixListId, 'ToolKey', 'text');
      for (const role of ROLES) {
        await addColumn(token, siteId, matrixListId, `Role${role}`);
      }
      console.log('  Seeding tool access matrix...');
      for (const tool of TOOL_MATRIX) {
        const fields = { Title: tool.name, ToolKey: tool.key };
        for (const role of ROLES) fields[`Role${role}`] = !!tool[role];
        await addItem(token, siteId, matrixListId, fields);
        process.stdout.write('.');
      }
      console.log(`\n✓ Hub Role Matrix created with ${TOOL_MATRIX.length} tools\n`);
    }

    // ── Hub User Overrides ───────────────────────────────────────────────────
    const existingOverrides = await listExists(token, siteId, 'Hub User Overrides');
    if (existingOverrides) {
      console.log(`  Hub User Overrides already exists — skipping creation`);
    } else {
      const overridesListId = await createList(token, siteId, 'Hub User Overrides');
      await addColumn(token, siteId, overridesListId, 'ToolKey', 'text');
      console.log('✓ Hub User Overrides created (empty — add rows to grant per-user tool access)\n');
    }

    // ── Hub Announcements ────────────────────────────────────────────────────
    const existingAnnounce = await listExists(token, siteId, 'Hub Announcements');
    if (existingAnnounce) {
      console.log(`  Hub Announcements already exists — skipping creation`);
    } else {
      const announceListId = await createList(token, siteId, 'Hub Announcements');
      await addColumn(token, siteId, announceListId, 'Message',   'text');
      await addColumn(token, siteId, announceListId, 'StartsAt',  'dateTime');
      await addColumn(token, siteId, announceListId, 'ExpiresAt', 'dateTime');
      await addColumn(token, siteId, announceListId, 'IsActive',  'boolean');
      console.log('✓ Hub Announcements created\n');
      console.log('  Columns: Title (subject), Message (body text), StartsAt, ExpiresAt, IsActive\n');
    }

    // ── Hub Quick Links ──────────────────────────────────────────────────────
    const existingLinks = await listExists(token, siteId, 'Hub Quick Links');
    if (existingLinks) {
      console.log(`  Hub Quick Links already exists — skipping creation`);
    } else {
      const linksListId = await createList(token, siteId, 'Hub Quick Links');
      await addColumn(token, siteId, linksListId, 'URL',       'text');
      await addColumn(token, siteId, linksListId, 'Icon',      'text');
      await addColumn(token, siteId, linksListId, 'SortOrder', 'number');
      // Seed 5 starter links
      const SEED_LINKS = [
        { Title: 'Autotask',       URL: 'https://www.autotask.net/',                              Icon: '🎫', SortOrder: 1 },
        { Title: 'IT Glue',        URL: 'https://app.itglue.com/',                                Icon: '📓', SortOrder: 2 },
        { Title: 'Datto RMM',      URL: 'https://portal.centrastage.net/',                        Icon: '🖥️',  SortOrder: 3 },
        { Title: 'M365 Admin',     URL: 'https://admin.microsoft.com/',                           Icon: '☁️',  SortOrder: 4 },
        { Title: 'Pax8',           URL: 'https://app.pax8.com/',                                  Icon: '📦', SortOrder: 5 },
      ];
      console.log('  Seeding starter quick links...');
      for (const link of SEED_LINKS) {
        await addItem(token, siteId, linksListId, link);
        process.stdout.write('.');
      }
      console.log(`\n✓ Hub Quick Links created with ${SEED_LINKS.length} starter links\n`);
    }

    console.log('Setup complete.');
    console.log(`\nSharePoint URL to manage the lists:`);
    console.log(`https://anchornetworksolutions.sharepoint.com/sites/Intranet/Lists/\n`);
  } catch (e) {
    console.error('\nSetup failed:', e.message);
    process.exit(1);
  }
})();
