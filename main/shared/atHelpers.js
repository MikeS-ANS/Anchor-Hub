'use strict';

/**
 * Runtime Autotask ID resolution helpers.
 * All results are cached for the session so each name is looked up at most once.
 * Use resolvePicklistValue() for any field not covered by the named helpers.
 */

const { atFetch, atQuery } = require('./at');

// ─── Session cache ─────────────────────────────────────────────────────────────
const _cache = new Map();

// ─── Generic picklist resolver ────────────────────────────────────────────────
// Fetches entity field definitions and returns the numeric value for a picklist
// label (case-insensitive). Result cached by entityPath+fieldName.
async function resolvePicklistValue(entityPath, fieldName, label) {
  const cacheKey = `picklist:${entityPath}:${fieldName}`;
  if (!_cache.has(cacheKey)) {
    const res = await atFetch(`${entityPath}/entityInformation/fields`);
    const field = (res.fields || []).find(
      f => (f.name || '').toLowerCase() === fieldName.toLowerCase()
    );
    if (!field) {
      const available = (res.fields || []).map(f => f.name).join(', ');
      throw new Error(`Field "${fieldName}" not found on ${entityPath}. Available: ${available}`);
    }
    const map = new Map(
      (field.picklistValues || []).map(v => [(v.label || '').toLowerCase(), v.value])
    );
    _cache.set(cacheKey, map);
  }
  const map = _cache.get(cacheKey);
  const norm = (label || '').toLowerCase();
  if (!map.has(norm)) {
    throw new Error(
      `Picklist value "${label}" not found for ${entityPath}.${fieldName}. ` +
      `Available: ${[...map.keys()].join(', ')}`
    );
  }
  return Number(map.get(norm));
}

// ─── Queue ID ──────────────────────────────────────────────────────────────────
// Resolves the numeric queueID picklist value for the given queue name.
async function resolveQueueId(name) {
  return resolvePicklistValue('/Tickets', 'queueID', name);
}

// ─── Ticket Priority ───────────────────────────────────────────────────────────
// Tries to match preferredLabel exactly (case-insensitive), then falls back to
// any label containing "medium", then to the numerically middle active value.
// Logs available labels on fallback so the correct label can be configured.
async function resolveTicketPriority(preferredLabel) {
  const cacheKey = 'picklist:/Tickets:priority';
  if (!_cache.has(cacheKey)) {
    const res = await atFetch('/Tickets/entityInformation/fields');
    const field = (res.fields || []).find(f => (f.name || '').toLowerCase() === 'priority');
    if (!field) throw new Error('priority field not found on Tickets entity');
    const map = new Map(
      (field.picklistValues || [])
        .filter(v => v.isActive !== false)
        .map(v => [(v.label || '').toLowerCase(), Number(v.value)])
    );
    _cache.set(cacheKey, map);
  }
  const map = _cache.get(cacheKey);

  // 1. Exact match
  const norm = (preferredLabel || '').toLowerCase();
  if (map.has(norm)) return map.get(norm);

  // 2. Contains "medium"
  const medEntry = [...map.entries()].find(([label]) => label.includes('medium'));
  if (medEntry) {
    console.log(`[atHelpers] priority "${preferredLabel}" not found; using "${medEntry[0]}" (${medEntry[1]}). Available: ${[...map.keys()].join(', ')}`);
    return medEntry[1];
  }

  // 3. Middle active value
  const sorted = [...map.entries()].sort((a, b) => a[1] - b[1]);
  if (sorted.length) {
    const mid = sorted[Math.floor(sorted.length / 2)];
    console.log(`[atHelpers] priority "${preferredLabel}" not found; using middle value "${mid[0]}" (${mid[1]}). Available: ${sorted.map(([l, v]) => `${l}(${v})`).join(', ')}`);
    return mid[1];
  }

  throw new Error(`No active priority values found on Tickets entity`);
}

// ─── Issue Type ID ────────────────────────────────────────────────────────────
// Resolves the numeric issueType picklist value for the given label.
// Called "workType" in the spec — in AT this maps to Tickets.issueType.
async function resolveWorkTypeId(name) {
  return resolvePicklistValue('/Tickets', 'issueType', name);
}

// ─── SLA ID ───────────────────────────────────────────────────────────────────
// SLAs are a real entity; query by name (case-insensitive). All active SLAs are
// fetched in one call and cached together.
async function resolveSlaId(name) {
  const cacheKey = `sla:${(name || '').toLowerCase()}`;
  if (_cache.has(cacheKey)) return _cache.get(cacheKey);

  const items = await atQuery('/ServiceLevelAgreements', [
    { op: 'eq', field: 'isActive', value: true },
  ]);
  for (const sla of items) {
    _cache.set(`sla:${(sla.name || '').toLowerCase()}`, sla.id);
  }

  const id = _cache.get(cacheKey);
  if (id === undefined) {
    throw new Error(
      `SLA "${name}" not found. Available: ${items.map(s => s.name).join(', ')}`
    );
  }
  return id;
}

// ─── Resources by first name ──────────────────────────────────────────────────
// Resolves a map of { FirstName: resourceId } for the given first names.
// Looks up only names not already cached; each name gets its own AT query.
// Returns only names that were found (no error on missing — caller decides).
async function resolveResourcesByFirstName(firstNames) {
  const missing = firstNames.filter(n => !_cache.has(`resource:${(n || '').toLowerCase()}`));

  for (const firstName of missing) {
    try {
      const items = await atQuery('/Resources', [
        { op: 'eq', field: 'firstName', value: firstName },
        { op: 'eq', field: 'isActive',  value: true },
      ]);
      const res = (items || [])[0];
      if (res) _cache.set(`resource:${firstName.toLowerCase()}`, res.id);
    } catch (e) {
      console.warn(`[atHelpers] resolveResourcesByFirstName("${firstName}") failed:`, e.message);
    }
  }

  const result = {};
  for (const name of firstNames) {
    const id = _cache.get(`resource:${(name || '').toLowerCase()}`);
    if (id !== undefined) result[name] = id;
  }
  return result;
}

// ─── Billing Code (Work Type) ID ──────────────────────────────────────────────
// Work Types in the AT UI are stored as BillingCodes. Fetches all active ones
// and returns the ID matching the given name (case-insensitive).
async function resolveBillingCodeId(name) {
  const cacheKey = `billingcode:${(name || '').toLowerCase()}`;
  if (_cache.has(cacheKey)) return _cache.get(cacheKey);

  const items = await atQuery('/BillingCodes', [
    { op: 'eq', field: 'isActive', value: true },
  ]);
  for (const bc of (items || [])) {
    _cache.set(`billingcode:${(bc.name || '').toLowerCase()}`, bc.id);
  }
  const id = _cache.get(cacheKey);
  if (id === undefined) {
    const available = (items || []).map(b => b.name).join(', ');
    throw new Error(`Billing code/work type "${name}" not found. Available: ${available}`);
  }
  return id;
}

// ─── Role ID by name ──────────────────────────────────────────────────────────
// Fetches all active Roles and returns the ID matching the given name (case-insensitive).
async function resolveRoleId(name) {
  const cacheKey = `role:${(name || '').toLowerCase()}`;
  if (_cache.has(cacheKey)) return _cache.get(cacheKey);

  const items = await atQuery('/Roles', [{ op: 'eq', field: 'isActive', value: true }]);
  for (const role of (items || [])) {
    _cache.set(`role:${(role.name || '').toLowerCase()}`, role.id);
  }
  const id = _cache.get(cacheKey);
  if (id === undefined) {
    const available = (items || []).map(r => r.name).join(', ');
    throw new Error(`Role "${name}" not found. Available: ${available}`);
  }
  return id;
}

// ─── Resource ID + Role ID ─────────────────────────────────────────────────────
// Resolves both the resourceId and their roleId in one call.
// If roleName is provided, looks up that specific role by name.
// Falls back to the resource's default/primary role if named lookup fails.
// AT requires BOTH fields together when assigning a resource to a ticket.
async function resolveResourceWithRole(firstName, roleName) {
  const resources = await resolveResourcesByFirstName([firstName]);
  const resourceId = resources[firstName];
  if (!resourceId) return null;

  // Try named role first
  if (roleName) {
    try {
      const roleId = await resolveRoleId(roleName);
      return { resourceId, roleId };
    } catch (e) {
      console.warn(`[atHelpers] resolveResourceWithRole: role "${roleName}" not found, falling back to primary:`, e.message);
    }
  }

  // Fall back to the resource's default/primary role from ResourceRoles
  const cacheKey = `resource-role:${resourceId}`;
  if (_cache.has(cacheKey)) {
    return { resourceId, roleId: _cache.get(cacheKey) };
  }
  try {
    const roles = await atQuery('/ResourceRoles', [
      { op: 'eq', field: 'resourceID', value: resourceId },
    ]);
    const entry = (roles || []).find(r => r.isDefault || r.isPrimary) || (roles || [])[0];
    const roleId = entry?.roleID ?? null;
    if (roleId != null) _cache.set(cacheKey, roleId);
    return { resourceId, roleId };
  } catch (e) {
    console.warn(`[atHelpers] resolveResourceWithRole("${firstName}") role fetch failed:`, e.message);
    return { resourceId, roleId: null };
  }
}

// ─── Ticket Category ID ────────────────────────────────────────────────────────
// TicketCategory is a real entity (not a picklist). Queries /TicketCategories
// and returns the numeric ID matching the given name (case-insensitive).
async function resolveTicketCategoryId(name) {
  const cacheKey = `ticketcategory:${(name || '').toLowerCase()}`;
  if (_cache.has(cacheKey)) return _cache.get(cacheKey);

  const items = await atQuery('/TicketCategories', [
    { op: 'eq', field: 'isActive', value: true },
  ]);
  for (const cat of (items || [])) {
    _cache.set(`ticketcategory:${(cat.name || '').toLowerCase()}`, cat.id);
  }

  const id = _cache.get(cacheKey);
  if (id === undefined) {
    const available = (items || []).map(c => c.name).join(', ');
    throw new Error(`Ticket category "${name}" not found. Available: ${available}`);
  }
  return id;
}

// ─── Contract ID by name (per company) ────────────────────────────────────────
// Returns the first active contract ID for a company whose contractName contains
// the given string (case-insensitive). Returns null if none found (no error —
// callers skip contractID gracefully).
async function resolveContractByName(companyId, contractName) {
  const cacheKey = `contract:${companyId}:${(contractName || '').toLowerCase()}`;
  if (_cache.has(cacheKey)) return _cache.get(cacheKey);

  try {
    const items = await atQuery('/Contracts', [
      { op: 'eq', field: 'companyID', value: companyId },
      { op: 'eq', field: 'status',    value: 1 },  // 1 = Active
    ]);
    const norm  = (contractName || '').toLowerCase();
    const match = (items || []).find(c => (c.contractName || '').toLowerCase().includes(norm));
    const id    = match?.id ?? null;
    _cache.set(cacheKey, id);
    return id;
  } catch (e) {
    console.warn(`[atHelpers] resolveContractByName("${contractName}") failed:`, e.message);
    return null;
  }
}

// ─── Prefetch defaults for Meraki tickets ─────────────────────────────────────
// Call once during tool init to warm the cache in parallel.
async function prefetchMerakiTicketDefaults() {
  const [resources] = await Promise.allSettled([
    resolveResourcesByFirstName(['Gary', 'Shawn']),
    resolveQueueId('CS - Subscription Procurement'),
    resolvePicklistValue('/Tickets', 'issueType',    'Sales Ordering'),
    resolvePicklistValue('/Tickets', 'subIssueType', 'Software Order'),
    resolvePicklistValue('/Tickets', 'source',       'Other'),
    resolveTicketPriority('Standard - 3'),
    resolveSlaId('Sales & Procurement'),
    resolveBillingCodeId('Sales & Procurement'),
  ]);
  return {
    resources: resources.status === 'fulfilled' ? resources.value : {},
  };
}

// ─── Current user's AT resource ───────────────────────────────────────────────
// Resolves the AT resource for the currently logged-in M365 user by matching
// their UPN/email against AT Resource.emailAddress. Result cached for the session.
// Returns { resourceId, roleId, firstName, lastName, email } or null if no match.
let _currentUserResource = undefined;  // undefined = not fetched yet, null = not found

async function resolveCurrentUserResource() {
  if (_currentUserResource !== undefined) return _currentUserResource;
  try {
    const { msalApp } = require('./msal');
    const accounts = await msalApp.getAllAccounts();
    if (!accounts.length) { _currentUserResource = null; return null; }
    const email = accounts[0].username;
    if (!email) { _currentUserResource = null; return null; }

    const items = await atQuery('/Resources', [
      { op: 'eq', field: 'email',    value: email },
      { op: 'eq', field: 'isActive', value: true },
    ]);
    const resource = (items || [])[0];
    if (!resource) {
      console.warn(`[atHelpers] resolveCurrentUserResource: no AT resource found for "${email}" — verify the AT resource email matches the M365 UPN exactly`);
      _currentUserResource = null;
      return null;
    }

    let roleId = null;
    try {
      const roles = await atQuery('/ResourceRoles', [
        { op: 'eq', field: 'resourceID', value: resource.id },
      ]);
      const entry = (roles || []).find(r => r.isDefault || r.isPrimary) || (roles || [])[0];
      roleId = entry?.roleID ?? null;
    } catch {}

    _currentUserResource = {
      resourceId: resource.id,
      roleId,
      firstName:  resource.firstName,
      lastName:   resource.lastName,
      email,
    };
    // Warm the firstName cache so resolveResourcesByFirstName hits it instantly
    _cache.set(`resource:${resource.firstName.toLowerCase()}`, resource.id);
    return _currentUserResource;
  } catch (e) {
    console.warn('[atHelpers] resolveCurrentUserResource:', e.message);
    return null;  // Don't cache errors — allow retry on next call
  }
}

// ─── Cache management ─────────────────────────────────────────────────────────
function clearAtHelpersCache() {
  _cache.clear();
  _currentUserResource = undefined;
}

module.exports = {
  resolvePicklistValue,
  resolveQueueId,
  resolveWorkTypeId,
  resolveTicketPriority,
  resolveSlaId,
  resolveBillingCodeId,
  resolveRoleId,
  resolveResourcesByFirstName,
  resolveResourceWithRole,
  resolveCurrentUserResource,
  resolveTicketCategoryId,
  resolveContractByName,
  prefetchMerakiTicketDefaults,
  clearAtHelpersCache,
};
