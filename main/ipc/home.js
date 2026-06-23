const { shell } = require('electron');
const fetch     = require('node-fetch');
const { msalApp } = require('../shared/msal');
const { atFetch } = require('../shared/at');

const GRAPH    = 'https://graph.microsoft.com/v1.0';
const SP_HOST  = 'anchornetworksolutions.sharepoint.com';
const SP_PATH  = '/sites/Intranet';
const SP_SCOPES  = ['https://graph.microsoft.com/Sites.Manage.All'];
const CAL_SCOPES = ['https://graph.microsoft.com/Calendars.Read'];

let _siteId        = null;
let _listIds       = {};
let _atResourceId  = null;  // cached for session

async function getGraphToken(scopes) {
  const accounts = await msalApp.getAllAccounts();
  if (!accounts.length) return null;
  try {
    const res = await msalApp.acquireTokenSilent({ account: accounts[0], scopes });
    return res.accessToken;
  } catch { return null; }
}

async function gGet(token, path) {
  const r = await fetch(`${GRAPH}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`Graph ${r.status}: ${path}`);
  return r.json();
}

async function getSiteId(token) {
  if (_siteId) return _siteId;
  const d = await gGet(token, `/sites/${SP_HOST}:${SP_PATH}`);
  _siteId = d.id;
  return _siteId;
}

async function getListId(token, siteId, displayName) {
  if (_listIds[displayName]) return _listIds[displayName];
  const d = await gGet(token, `/sites/${siteId}/lists?$select=displayName,id`);
  for (const l of (d.value || [])) _listIds[l.displayName] = l.id;
  return _listIds[displayName] || null;
}

async function getListItems(token, siteId, listId) {
  const items = [];
  let url = `${GRAPH}/sites/${siteId}/lists/${listId}/items?expand=fields&$top=200`;
  while (url) {
    const d = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
    items.push(...(d.value || []));
    url = d['@odata.nextLink'] || null;
  }
  return items;
}

module.exports = function registerHome(ipcMain) {

  ipcMain.handle('home-open-url', (_, url) => {
    if (url && /^https?:\/\//.test(url)) shell.openExternal(url);
  });

  ipcMain.handle('home-get-announcements', async () => {
    try {
      const token = await getGraphToken(SP_SCOPES);
      if (!token) return [];
      const siteId = await getSiteId(token);
      const listId = await getListId(token, siteId, 'Hub Announcements');
      if (!listId) return [];
      const now   = new Date();
      const items = await getListItems(token, siteId, listId);
      return items
        .filter(item => {
          const f = item.fields || {};
          if (!f.IsActive) return false;
          if (f.StartsAt && new Date(f.StartsAt) > now) return false;
          if (f.ExpiresAt && new Date(f.ExpiresAt) < now) return false;
          return true;
        })
        .map(item => {
          const f = item.fields || {};
          return { title: f.Title || '', message: f.Message || '' };
        });
    } catch (e) {
      console.error('[home] announcements error:', e.message);
      return [];
    }
  });

  ipcMain.handle('home-get-quick-links', async () => {
    try {
      const token = await getGraphToken(SP_SCOPES);
      if (!token) return [];
      const siteId = await getSiteId(token);
      const listId = await getListId(token, siteId, 'Hub Quick Links');
      if (!listId) return [];
      const items = await getListItems(token, siteId, listId);
      return items
        .map(item => {
          const f = item.fields || {};
          return { title: f.Title || '', url: f.URL || '', icon: f.Icon || '🔗', order: f.SortOrder || 0 };
        })
        .filter(l => l.url)
        .sort((a, b) => a.order - b.order);
    } catch (e) {
      console.error('[home] quick-links error:', e.message);
      return [];
    }
  });

  ipcMain.handle('home-get-calendar', async () => {
    try {
      const token = await getGraphToken(CAL_SCOPES);
      if (!token) return { error: 'no_token' };
      const now   = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
      const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
      const r = await fetch(
        `${GRAPH}/me/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}&$select=subject,start,end,isAllDay,location&$orderby=start/dateTime&$top=20`,
        { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="America/New_York"' } }
      );
      if (!r.ok) { console.error('[home] calendar', r.status); return { error: 'api_error' }; }
      const data = await r.json();
      return (data.value || []).map(e => ({
        subject:  e.subject || '(No title)',
        startDt:  e.start?.dateTime || '',
        endDt:    e.end?.dateTime || '',
        isAllDay: e.isAllDay || false,
        location: e.location?.displayName || '',
      }));
    } catch (e) {
      console.error('[home] calendar error:', e.message);
      return { error: e.message };
    }
  });

  ipcMain.handle('home-get-at-tickets', async (_, email) => {
    try {
      if (!email) return { error: 'no_email' };

      // Look up this user's AT resource ID once per session
      // AT stores login email in the 'userName' field on the Resources entity
      if (!_atResourceId) {
        const res = await atFetch('/Resources/query', {
          method: 'POST',
          body: JSON.stringify({ filter: [{ op: 'eq', field: 'userName', value: email }] }),
        });
        const resource = (res.items || [])[0];
        if (resource) _atResourceId = resource.id;
        console.log('[home] AT resource lookup for', email, '→ id:', resource?.id ?? 'not found');
      }

      const [assignedRes, totalRes] = await Promise.all([
        _atResourceId
          ? atFetch('/Tickets/query', {
              method: 'POST',
              body: JSON.stringify({
                filter: [
                  { op: 'eq',    field: 'assignedResourceID', value: _atResourceId },
                  { op: 'noteq', field: 'status',             value: 5 },
                ],
                MaxRecords: 50,
              }),
            })
          : Promise.resolve({ items: [] }),
        atFetch('/Tickets/query', {
          method: 'POST',
          body: JSON.stringify({
            filter: [{ op: 'noteq', field: 'status', value: 5 }],
            MaxRecords: 1,
          }),
        }).catch(() => ({ items: [], pageDetails: null })),
      ]);

      const assigned  = assignedRes.items || [];
      const totalOpen = (totalRes.pageDetails?.count) ?? (totalRes.items || []).length;

      // Fetch company names for top 5 assigned tickets
      const top5 = assigned.slice(0, 5);
      const companyIds = [...new Set(top5.map(t => t.companyID).filter(Boolean))];
      const companyMap = {};
      if (companyIds.length) {
        try {
          const co = await atFetch('/Companies/query', {
            method: 'POST',
            body: JSON.stringify({ filter: [{ op: 'in', field: 'id', value: companyIds }] }),
          });
          for (const c of (co.items || [])) companyMap[c.id] = c.companyName;
        } catch {}
      }

      return {
        assignedCount: assigned.length,
        totalOpen,
        tickets: top5.map(t => ({
          id:          t.id,
          title:       t.title || '(No title)',
          priority:    t.priority || 4,
          companyName: companyMap[t.companyID] || '',
        })),
      };
    } catch (e) {
      console.error('[home] at-tickets error:', e.message);
      return { error: e.message };
    }
  });
};
