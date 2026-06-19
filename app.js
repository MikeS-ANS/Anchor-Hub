window.onerror = (msg, src, line, col, err) => console.error('[app.js uncaught]', msg, `${src}:${line}:${col}`, err);
window.onunhandledrejection = (e) => console.error('[app.js unhandled rejection]', e.reason);

// Window controls
document.getElementById('btn-min').addEventListener('click', () => window.api.minimize());
document.getElementById('btn-max').addEventListener('click', () => window.api.maximize());
document.getElementById('btn-close').addEventListener('click', () => window.api.close());

// ─── Auth / SSO ───────────────────────────────────────────────────────────────
let _currentUser = null;

function renderLogin(errorMsg) {
  document.getElementById('sidebar').style.display = 'none';
  document.getElementById('update-banner').style.display = 'none';
  document.getElementById('content').innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                height:100%;gap:20px;background:var(--bg)">
      <img src="./Anchor_Logo_High.png" style="height:80px;width:auto;object-fit:contain" />
      <div style="text-align:center">
        <div style="font-size:22px;font-weight:700;color:var(--text);letter-spacing:-.3px">Anchor Hub</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">Anchor Network Solutions</div>
      </div>
      ${errorMsg ? `<div style="color:var(--error);font-size:12px;max-width:280px;text-align:center">${escHtml(errorMsg)}</div>` : ''}
      <button id="sso-login-btn" style="
        background:#0078d4;color:#fff;border:none;border-radius:6px;
        padding:11px 24px;font-size:13px;font-weight:600;cursor:pointer;
        display:flex;align-items:center;gap:10px;transition:background .15s">
        <svg width="16" height="16" viewBox="0 0 21 21" fill="none">
          <rect width="10" height="10" fill="#f25022"/>
          <rect x="11" width="10" height="10" fill="#7fba00"/>
          <rect y="11" width="10" height="10" fill="#00a4ef"/>
          <rect x="11" y="11" width="10" height="10" fill="#ffb900"/>
        </svg>
        Sign in with Microsoft
      </button>
      <div id="sso-status" style="font-size:11px;color:var(--text-muted);min-height:16px"></div>
    </div>`;

  const btn = document.getElementById('sso-login-btn');
  btn.onmouseenter = () => btn.style.background = '#106ebe';
  btn.onmouseleave = () => btn.style.background = '#0078d4';
  btn.onclick = async () => {
    btn.disabled = true;
    btn.style.opacity = '0.65';
    document.getElementById('sso-status').textContent = 'Opening browser for sign-in…';
    const result = await window.api.authLogin();
    if (result?.error) {
      renderLogin(result.error);
    } else if (result?.name) {
      _currentUser = result;
      initApp();
    } else {
      renderLogin('Sign-in did not complete. Please try again.');
    }
  };
}

function renderUserChip(user) {
  const el = document.getElementById('titlebar-user');
  if (!el) return;
  const initials = user.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const avatarSmall = user.photo
    ? `<img src="${user.photo}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;flex-shrink:0" />`
    : `<div style="width:22px;height:22px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0">${escHtml(initials)}</div>`;
  const avatarLarge = user.photo
    ? `<img src="${user.photo}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;flex-shrink:0" />`
    : `<div style="width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;flex-shrink:0">${escHtml(initials)}</div>`;
  el.innerHTML = `
    <div id="user-chip" style="display:flex;align-items:center;gap:7px;cursor:pointer;
         padding:3px 8px 3px 3px;border-radius:20px;transition:background .15s"
         onmouseenter="this.style.background='var(--hover)'"
         onmouseleave="this.style.background='transparent'">
      ${avatarSmall}
      <span style="font-size:11px;color:var(--text-muted);max-width:120px;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(user.name)}</span>
    </div>
    <div id="user-menu" style="display:none;position:absolute;top:36px;right:8px;
         background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;
         padding:6px;min-width:200px;z-index:9999;box-shadow:0 4px 16px rgba(0,0,0,.4)">
      <div style="padding:10px;border-bottom:1px solid var(--border);margin-bottom:4px;display:flex;align-items:center;gap:10px">
        ${avatarLarge}
        <div style="min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(user.name)}</div>
          <div style="font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(user.email)}</div>
          ${user.isAdmin ? '<div style="font-size:10px;color:var(--accent);margin-top:2px">Admin</div>' : ''}
        </div>
      </div>
      <div id="user-signout-btn" style="padding:6px 10px;font-size:12px;color:var(--text);
           cursor:pointer;border-radius:5px;transition:background .15s"
           onmouseenter="this.style.background='var(--hover)'"
           onmouseleave="this.style.background='transparent'">Sign out</div>
    </div>`;
  el.style.position = 'relative';

  document.getElementById('user-chip').onclick = (e) => {
    e.stopPropagation();
    const menu = document.getElementById('user-menu');
    menu.style.display = menu.style.display === 'none' ? '' : 'none';
  };
  document.addEventListener('click', () => {
    const menu = document.getElementById('user-menu');
    if (menu) menu.style.display = 'none';
  }, { capture: true });
  document.getElementById('user-signout-btn').onclick = async () => {
    await window.api.authLogout();
    _currentUser = null;
    renderLogin();
  };
}

async function initApp() {
  document.getElementById('sidebar').style.display = '';
  renderUserChip(_currentUser);
  window.api.getSidebarConfig().then(cfg => { renderSidebar(cfg); navigate('home'); });
}

// ─── Auth gate — check for existing session, show login if none ───────────────
(async () => {
  try {
    const user = (typeof window.api?.authGetUser === 'function')
      ? await window.api.authGetUser()
      : null;
    if (user?.name) {
      _currentUser = user;
      initApp();
    } else {
      renderLogin();
    }
  } catch (err) {
    console.error('[Auth gate]', err);
    renderLogin('Could not reach authentication service. ' + (err?.message || String(err)));
  }
})();

const content = document.getElementById('content');
// ─── Invoice step tracker ─────────────────────────────────────────────────────
let _invoiceSteps = [];
let _invoiceLoadingStep = null;

const CHECK_SVG = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const SPIN_SVG  = `<span class="spinner" style="width:9px;height:9px;border-width:1.5px;border-color:var(--accent)30;border-top-color:var(--accent)"></span>`;

function invoiceStepAdd(id, title, subtitle = '', done = true) {
  const idx = _invoiceSteps.findIndex(s => s.id === id);
  if (idx >= 0) { _invoiceSteps[idx] = { id, title, subtitle, done }; }
  else { _invoiceSteps.push({ id, title, subtitle, done }); }
  invoiceStepsRender();
}
function invoiceStepsRender() {
  const el = document.getElementById('invoice-steps');
  if (!el) return;
  el.innerHTML = _invoiceSteps.map(s => `
    <div class="step-item">
      <div class="step-check ${s.done ? 'done' : 'running'}">${s.done ? CHECK_SVG : SPIN_SVG}</div>
      <div class="step-body">
        <div class="step-title">${escHtml(s.title)}</div>
        ${s.subtitle ? `<div class="step-subtitle">${escHtml(s.subtitle)}</div>` : ''}
      </div>
    </div>`).join('');
}
function invoiceStepsReset() { _invoiceSteps = []; _invoiceLoadingStep = null; invoiceStepsRender(); }

function invoiceParseLog(msg, type) {
  if (type === 'success') {
    if (/token obtained/i.test(msg))
      invoiceStepAdd('auth', 'Authenticated with Pax8', 'Token obtained');
    else if (/invoices found/i.test(msg))
      invoiceStepAdd('fetch', 'Fetched partner invoices', msg.replace(/^[✓\s]+/, ''));
    else if (/line items/i.test(msg) && _invoiceLoadingStep)
      invoiceStepAdd(_invoiceLoadingStep, _invoiceLoadingStep.replace('inv-', 'Loaded ') + ' invoice', msg.replace(/^[\s✓]+/, ''));
    else if (/AI analysis complete/i.test(msg))
      invoiceStepAdd('ai', 'AI Analysis', 'Complete');
  } else if (type === 'info' && /Loading \d{4}/i.test(msg)) {
    const d = msg.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
    if (d) {
      _invoiceLoadingStep = `inv-${d}`;
      invoiceStepAdd(_invoiceLoadingStep, `Loaded ${d} invoice`, 'Loading…', false);
    }
  }
}

function setLastRun(label) {
  const el = document.getElementById('titlebar-lastrun');
  const txt = document.getElementById('lastrun-text');
  if (el && txt) { txt.textContent = `Last run: ${label}`; el.style.display = 'flex'; }
}

let auditLogUnsubscribe   = null;
let invoiceLogUnsubscribe = null;
let marginLogUnsubscribe  = null;
let mappingLogUnsubscribe = null;

// ─── Result cache (persists across navigation) ────────────────────────────────
const cache = {
  subscriptionAudit: { logHtml: '', statusText: '', summaryHtml: '' },
  invoiceMonitor:    { logHtml: '', statusText: '', results: null },
  marginAnalyzer:    { logHtml: '', statusText: '', summary: null },
  contractChanges:   { rows: null, dateFrom: '', dateTo: '' },
};

// ─── Tool stat persistence (drives home-page cards) ───────────────────────────
function saveToolStat(key, summary, status) {
  try {
    localStorage.setItem(`toolStats_${key}`, JSON.stringify({
      date: new Date().toISOString(),
      summary,
      status,   // 'ok' | 'warn' | 'error'
    }));
  } catch (_) {}
}

function loadToolStat(key) {
  try {
    const raw = localStorage.getItem(`toolStats_${key}`);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function navigate(view) {
  document.querySelectorAll('.nav-item[data-view]').forEach(el => el.classList.remove('active'));
  const active = document.querySelector(`.nav-item[data-view="${view}"]`);
  if (active) active.classList.add('active');

  if (auditLogUnsubscribe)   { auditLogUnsubscribe();   auditLogUnsubscribe   = null; }
  if (marginLogUnsubscribe)  { marginLogUnsubscribe();  marginLogUnsubscribe  = null; }
  if (mappingLogUnsubscribe) { mappingLogUnsubscribe(); mappingLogUnsubscribe = null; }

  if (view === 'home') renderHome();
  else if (view === 'subscription-audit')  renderSubscriptionAudit();
  else if (view === 'invoice-monitor')     renderInvoiceMonitor();
  else if (view === 'margin-analyzer')     renderMarginAnalyzer();
  else if (view === 'company-mapping')     renderCompanyMapping();
  else if (view === 'invoice-processor')   renderInvoiceProcessor();
  else if (view === 'kaseya-processor')    renderKaseyaProcessor();
  else if (view === 'project-time-summary') renderProjectTimeSummary();
  else if (view === 'contract-changes')    renderContractChanges();
  else if (view === 'contract-renewals')   renderContractRenewals();
  else if (view === 'blackpoint-processor') renderBlackpointProcessor();
  else if (view === 'msc-agreements')      renderMscAgreements();
  else if (view === 'duo-management')      renderDuoManagement();
  else if (view === 'project-profitability') renderProjectProfitability();
  else if (view === 'settings') renderSettings();
  else if (view === 'help')     renderHelp();
}

document.querySelectorAll('.nav-item:not(.coming-soon)').forEach(item => {
  item.addEventListener('click', () => navigate(item.dataset.view));
});
document.getElementById('btn-settings').addEventListener('click', () => navigate('settings'));
document.getElementById('btn-help').addEventListener('click', () => navigate('help'));

// ─── Sidebar / Tool Defs ──────────────────────────────────────────────────────
const TOOL_DEFS = [
  { key: 'subscription-audit',  label: 'M365 Subscription Comparison',
    icon: `<path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>` },
  { key: 'invoice-monitor',     label: 'Pax8 Invoice Comparison',
    icon: `<rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 7h6M5 10h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>` },
  { key: 'margin-analyzer',     label: 'M365 Margin Analyzer',
    icon: `<path d="M2 12l4-4 3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="14" cy="4" r="1.5" fill="currentColor" opacity="0.6"/>` },
  { key: 'company-mapping',     label: 'Company Mapping',
    icon: `<circle cx="4" cy="8" r="2.5" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="8" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M6.5 8h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>` },
  { key: 'invoice-processor',   label: 'Pax8 Invoice Processor',
    icon: `<rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 5h6M5 8h6M5 11h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>` },
  { key: 'kaseya-processor',    label: 'Kaseya Invoice Processor',
    icon: `<rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 4h6M5 7h6M5 10h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M9 11.5l1.5 1.5L13 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: 'project-time-summary', label: 'Project Time Summary',
    icon: `<rect x="1" y="2" width="14" height="12" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M4 6h4M4 9h6M4 12h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M10 8l2 2 3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: 'msc-agreements',      label: 'MSC Agreements',
    icon: `<rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 4h6M5 7h6M5 10h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="11" cy="11" r="3" fill="var(--bg,#0d0f14)" stroke="currentColor" stroke-width="1.2"/><path d="M11 9.8v1.2l.8.8" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: 'duo-management',     label: 'Duo Management',
    icon: `<circle cx="8" cy="6" r="3" stroke="currentColor" stroke-width="1.4"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="13" cy="5" r="2" fill="var(--bg,#0d0f14)" stroke="currentColor" stroke-width="1.2"/><path d="M12.3 5l.7.7 1.2-1.2" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: 'contract-changes',    label: 'Autotask Contract Changes',
    icon: `<rect x="2" y="2" width="9" height="12" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 5.5h5M5 8.5h3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="12.5" cy="12.5" r="2.8" fill="var(--bg,#0d0f14)" stroke="currentColor" stroke-width="1.3"/><path d="M12.5 11.3v1.2l.9.9" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: 'contract-renewals',   label: 'Autotask Contract Renewals',
    icon: `<path d="M13 8A5 5 0 1 1 8 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M8 1l3 2-3 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 8h2v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: 'blackpoint-processor', label: 'BlackPoint Usage',
    icon: `<path d="M8 1.5L2 4.5v4c0 3.3 2.4 5.5 6 6 3.6-.5 6-2.7 6-6v-4L8 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.5 8l1.5 1.5L10.5 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: 'project-profitability', label: 'Project Profitability',
    icon: `<path d="M2 12l3-4 3 2 3-5 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 14H2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>` },
];

let _sidebarConfig  = { visibility: {}, layout: [] };
const _bucketExpanded = {};

function renderSidebar(config) {
  if (config) _sidebarConfig = config;
  const { visibility = {}, layout = [] } = _sidebarConfig;
  const toolsNav = document.getElementById('tools-nav');
  if (!toolsNav) return;

  const activeView = document.querySelector('.nav-item.active')?.dataset.view;
  let html = '';

  for (const item of layout) {
    if (item.type === 'tool') {
      if (visibility[item.key] === false) continue;
      const def = TOOL_DEFS.find(d => d.key === item.key);
      if (!def) continue;
      const active = activeView === item.key ? ' active' : '';
      html += `<li class="nav-item${active}" data-view="${item.key}">
        <div class="nav-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none">${def.icon}</svg></div>
        <span>${def.label}</span>
      </li>`;
    } else if (item.type === 'bucket') {
      const visItems = (item.items || []).filter(k => visibility[k] !== false && TOOL_DEFS.find(d => d.key === k));
      if (!visItems.length) continue;
      const expanded = _bucketExpanded[item.id] !== false;
      html += `<li class="nav-bucket${expanded ? ' expanded' : ''}" data-bucket-id="${item.id}">
        <div class="nav-bucket-header" data-bucket-id="${item.id}">
          <svg class="nav-bucket-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M3 2l4 3-4 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>${escHtml(item.name)}</span>
        </div>
        <ul class="nav-bucket-tools">`;
      for (const key of visItems) {
        const def = TOOL_DEFS.find(d => d.key === key);
        const active = activeView === key ? ' active' : '';
        html += `<li class="nav-item nav-nested${active}" data-view="${key}">
          <div class="nav-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none">${def.icon}</svg></div>
          <span>${def.label}</span>
        </li>`;
      }
      html += `</ul></li>`;
    }
  }

  toolsNav.innerHTML = html;

  toolsNav.querySelectorAll('.nav-item[data-view]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.view));
  });
  toolsNav.querySelectorAll('.nav-bucket-header').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const id = hdr.dataset.bucketId;
      _bucketExpanded[id] = _bucketExpanded[id] === false; // toggle (default=expanded)
      renderSidebar();
    });
  });

  // If the currently active view is hidden, go home
  if (activeView && activeView !== 'home') {
    const still = toolsNav.querySelector(`.nav-item[data-view="${activeView}"]`);
    if (!still) navigate('home');
  }
}


// ─── Home / Dashboard ─────────────────────────────────────────────────────────
const HOME_CARDS = [
  {
    key:   'subscription-audit',
    label: 'M365 Subscription Comparison',
    desc:  'Compare Pax8 subscriptions against Autotask contracts to catch billing gaps.',
    icon:  `<svg width="24" height="24" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h8M2 12h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  },
  {
    key:   'invoice-monitor',
    label: 'Pax8 Invoice Comparison',
    desc:  'Monitor invoice changes between billing cycles and catch unexpected cost shifts.',
    icon:  `<svg width="24" height="24" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 7h6M5 10h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  },
  {
    key:   'margin-analyzer',
    label: 'M365 Margin Analyzer',
    desc:  'Analyze service margins across all companies and identify pricing mismatches.',
    icon:  `<svg width="24" height="24" viewBox="0 0 16 16" fill="none"><path d="M2 12l4-4 3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="14" cy="4" r="1.5" fill="currentColor" opacity="0.6"/></svg>`,
  },
  {
    key:   'company-mapping',
    label: 'Company Mapping',
    desc:  'Sync and map Pax8 companies and services to their Autotask counterparts.',
    icon:  `<svg width="24" height="24" viewBox="0 0 16 16" fill="none"><circle cx="4" cy="8" r="2.5" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="8" r="2.5" stroke="currentColor" stroke-width="1.3"/><path d="M6.5 8h3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  },
  {
    key:   'invoice-processor',
    label: 'Pax8 Invoice Processor',
    desc:  'Process Pax8 invoices and generate formatted Excel reports with margin data.',
    icon:  `<svg width="24" height="24" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 5h6M5 8h6M5 11h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  },
  {
    key:   'kaseya-processor',
    label: 'Kaseya Invoice Processor',
    desc:  'Import and process Kaseya billing exports for reconciliation and reporting.',
    icon:  `<svg width="24" height="24" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 4h6M5 7h6M5 10h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M9 11.5l1.5 1.5L13 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    key:   'contract-changes',
    label: 'Autotask Contract Changes',
    desc:  'Audit contract modifications — track changes made by humans, AI, and integrations.',
    icon:  `<svg width="24" height="24" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="9" height="12" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 5.5h5M5 8.5h3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="12.5" cy="12.5" r="2.8" fill="var(--bg,#0d0f14)" stroke="currentColor" stroke-width="1.3"/><path d="M12.5 11.3v1.2l.9.9" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    key:   'contract-renewals',
    label: 'Autotask Contract Renewals',
    desc:  'Find expiring contracts with no renewal, review services, update pricing, and generate a Claude renewal prompt.',
    icon:  `<svg width="24" height="24" viewBox="0 0 16 16" fill="none"><path d="M13 8A5 5 0 1 1 8 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M8 1l3 2-3 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 8h2v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    key:   'blackpoint-processor',
    label: 'BlackPoint Usage',
    desc:  'Track BlackPoint protected endpoint counts per client, compare month-over-month, and generate a Claude prompt to update Security+ quantities in Autotask.',
    icon:  `<svg width="24" height="24" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L2 4.5v4c0 3.3 2.4 5.5 6 6 3.6-.5 6-2.7 6-6v-4L8 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.5 8l1.5 1.5L10.5 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    key:   'project-time-summary',
    label: 'Project Time Summary',
    desc:  'Pull active Professional Services projects from Autotask, view hours vs. estimates, flag at-risk projects, and email a formatted report.',
    icon:  `<svg width="24" height="24" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="12" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M4 6h4M4 9h6M4 12h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M10 8l2 2 3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    key:   'msc-agreements',
    label: 'MSC Agreements',
    desc:  'View Managed Service Client agreement rates from your shared OneDrive file. TC Increase and S+ Increase rates are surfaced directly in the Contract Renewals tool.',
    icon:  `<svg width="24" height="24" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 4h6M5 7h6M5 10h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="12" cy="12" r="3.2" fill="var(--surface,#141720)" stroke="currentColor" stroke-width="1.2"/><path d="M12 10.8v1.2l.9.9" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    key:   'duo-management',
    label: 'Duo Management',
    desc:  'Manage Duo MFA for employee onboarding and offboarding. Create admin accounts, enroll phones on the anchor user across all administrative units, and send Duo Mobile activation SMS.',
    icon:  `<svg width="24" height="24" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="6" r="3" stroke="currentColor" stroke-width="1.4"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="13" cy="5" r="2" fill="var(--surface,#141720)" stroke="currentColor" stroke-width="1.2"/><path d="M12.3 5l.7.7 1.2-1.2" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    key:   'project-profitability',
    label: 'Project Profitability',
    desc:  'Analyze completed project margins, invoiced revenue vs cost of delivery, and lead performance.',
    icon:  `<svg width="24" height="24" viewBox="0 0 16 16" fill="none"><path d="M2 12l3-4 3 2 3-5 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 14H2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  },
];

async function renderHome() {
  content.innerHTML = `<div style="padding:32px;color:var(--text-muted);font-size:13px">Loading…</div>`;

  const [vis, version] = await Promise.all([
    window.api.getToolVisibility(),
    window.api.getAppVersion ? window.api.getAppVersion() : Promise.resolve(''),
  ]);

  const visibleCards = HOME_CARDS.filter(c => vis[c.key] !== false);

  const cardHtml = visibleCards.map(c => {
    const stat      = loadToolStat(c.key);
    const dotClass  = stat ? `home-dot-${stat.status}` : 'home-dot-none';
    const statText  = stat ? stat.summary : 'Never run';
    const dateText  = stat ? new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    return `
      <div class="home-card" data-nav="${c.key}" tabindex="0" role="button">
        <div class="home-card-top">
          <div class="home-card-icon">${c.icon}</div>
          <span class="home-dot ${dotClass}" title="${statText}"></span>
        </div>
        <div class="home-card-name">${c.label}</div>
        <div class="home-card-desc">${c.desc}</div>
        <div class="home-card-stat">
          <span class="home-stat-label">${escHtml(statText)}</span>
          ${dateText ? `<span class="home-stat-date">${dateText}</span>` : ''}
        </div>
      </div>`;
  }).join('');

  content.innerHTML = `
    <div class="home-wrap">
      <div class="home-header">
        <div class="home-title-block">
          <div class="home-app-name">Anchor Hub</div>
          ${version ? `<div class="home-version">v${version}</div>` : ''}
        </div>
        <button class="btn btn-ghost btn-sm home-update-btn" id="home-check-updates">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M13 7A6 6 0 1 1 7 1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M9 1h4v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Check for Updates
        </button>
      </div>
      ${visibleCards.length === 0
        ? `<div class="home-empty">All tools are hidden. <a href="#" id="home-go-settings" style="color:var(--accent)">Open Settings</a> to enable some.</div>`
        : `<div class="home-grid">${cardHtml}</div>`}
    </div>`;

  // Card click + keyboard
  content.querySelectorAll('.home-card[data-nav]').forEach(card => {
    const go = () => navigate(card.dataset.nav);
    card.addEventListener('click', go);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go(); });
  });

  // Manual update check
  const updateBtn = document.getElementById('home-check-updates');
  if (updateBtn) {
    updateBtn.addEventListener('click', async () => {
      updateBtn.disabled = true;
      const origHtml = updateBtn.innerHTML;
      updateBtn.textContent = 'Checking…';
      try {
        const res = await window.api.checkForUpdates();
        if (res.checked) {
          updateBtn.textContent = res.updateAvailable ? '⬇ Update available!' : '✓ Up to date';
        } else {
          updateBtn.textContent = res.reason === 'dev' ? '(dev build)' : `Error: ${res.reason}`;
        }
      } catch (e) {
        updateBtn.textContent = 'Check failed';
      }
      setTimeout(() => {
        if (updateBtn) { updateBtn.disabled = false; updateBtn.innerHTML = origHtml; }
      }, 4000);
    });
  }

  const goSettings = document.getElementById('home-go-settings');
  if (goSettings) goSettings.addEventListener('click', e => { e.preventDefault(); navigate('settings'); });
}

// ─── M365 Subscription Comparison ───────────────────────────────────────────────────────
function renderSubscriptionAudit() {
  content.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">M365 Subscription Comparison</h1>
        <p class="view-desc">Compare Pax8 subscription quantities against Autotask PSA contract items and automatically create tickets for any mismatches.</p>
      </div>
      <img class="view-header-deco" src="Anchor_Logo_Vertical_High.png" alt="" draggable="false" />
    </div>
    <div id="creds-warning" class="alert alert-warn hidden">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2L1.5 11.5h11L7 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M7 6v3M7 10.5v.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
      API credentials not configured.&nbsp;<button class="link-btn" id="go-settings">Go to Settings →</button>
    </div>
    <div class="audit-controls">
      <button class="btn btn-primary" id="btn-run-audit">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2l9 5-9 5V2z" fill="currentColor"/></svg>
        Run Audit
      </button>
      <button class="btn btn-danger hidden" id="btn-stop-audit">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor"/></svg>
        Stop
      </button>
      <label class="dry-run-toggle">
        <input type="checkbox" id="chk-dry-run" checked />
        <span>Dry Run</span>
        <span class="dry-run-hint">(no tickets)</span>
      </label>
      <span class="audit-status-text" id="audit-status"></span>
    </div>
    <div class="log-container">
      <div class="log-empty" id="log-empty">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" opacity="0.3"><rect x="4" y="6" width="24" height="20" rx="3" stroke="currentColor" stroke-width="1.5"/><path d="M9 12h14M9 17h10M9 22h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <p>No audit has been run yet.<br/>Click "Run Audit" to start.</p>
      </div>
      <div class="log-output" id="log-output"></div>
    </div>
    <div class="results-summary hidden" id="results-summary"></div>
  `;

  const goSettings = document.getElementById('go-settings');
  if (goSettings) goSettings.addEventListener('click', () => navigate('settings'));
  document.getElementById('btn-run-audit').addEventListener('click', runAudit);
  document.getElementById('btn-stop-audit').addEventListener('click', stopAudit);
  checkCredsWarning();

  // Restore cached state
  if (cache.subscriptionAudit.logHtml) {
    document.getElementById('log-empty').classList.add('hidden');
    document.getElementById('log-output').innerHTML    = cache.subscriptionAudit.logHtml;
    document.getElementById('audit-status').textContent = cache.subscriptionAudit.statusText;
  }
}

async function stopAudit() {
  const btn = document.getElementById('btn-stop-audit');
  if (btn) { btn.disabled = true; btn.textContent = 'Stopping…'; }
  await window.api.abortAudit();
}

async function checkCredsWarning() {
  try {
    const { pax8, autotask } = await window.api.checkCreds();
    const el = document.getElementById('creds-warning');
    if (el) el.classList.toggle('hidden', pax8 && autotask);
  } catch {}
}

async function runAudit() {
  const btn = document.getElementById('btn-run-audit');
  const logOutput = document.getElementById('log-output');
  const logEmpty = document.getElementById('log-empty');
  const statusEl = document.getElementById('audit-status');
  const summary = document.getElementById('results-summary');

  const dryRun = document.getElementById('chk-dry-run')?.checked ?? true;
  btn.disabled = true;
  btn.classList.add('hidden');
  document.getElementById('btn-stop-audit').classList.remove('hidden');
  btn.innerHTML = `<span class="spinner"></span> Running…`;
  logEmpty.classList.add('hidden');
  logOutput.innerHTML = '';
  summary.classList.add('hidden');
  statusEl.textContent = 'Audit in progress…';

  auditLogUnsubscribe = window.api.onAuditLog(({ msg, type }) => {
    if (type === 'divider') {
      logOutput.innerHTML += `<div class="log-divider"></div>`;
    } else {
      logOutput.innerHTML += `<div class="log-line log-${type || 'info'}">${escHtml(msg)}</div>`;
    }
    logOutput.scrollTop = logOutput.scrollHeight;
    cache.subscriptionAudit.logHtml = logOutput.innerHTML;
  });

  try {
    const { success, results, error } = await window.api.runSubscriptionAudit({ dryRun });

    if (success && results) {
      const bad = results.discrepancies.length > 0;
      cache.subscriptionAudit.statusText = `Audit complete — ${results.discrepancies.length} discrepanc${results.discrepancies.length === 1 ? 'y' : 'ies'} found.`;
      saveToolStat('subscription-audit', `${results.discrepancies.length} discrepanc${results.discrepancies.length === 1 ? 'y' : 'ies'} found`, bad ? 'warn' : 'ok');
      summary.classList.remove('hidden');
      summary.innerHTML = `
        <div class="summary-grid">
          <div class="summary-card"><div class="summary-num">${results.checked}</div><div class="summary-label">Checked</div></div>
          <div class="summary-card success"><div class="summary-num">${results.matched}</div><div class="summary-label">Matched</div></div>
          <div class="summary-card ${bad ? 'error' : 'success'}"><div class="summary-num">${results.discrepancies.length}</div><div class="summary-label">Discrepancies</div></div>
          <div class="summary-card"><div class="summary-num">${results.ticketsCreated}</div><div class="summary-label">Tickets Created</div></div>
        </div>
        ${bad ? `<div style="margin-top:12px"><button class="btn btn-ghost" id="btn-export-disc">↓ Export Discrepancies CSV</button><span class="save-status" id="export-status" style="margin-left:10px"></span></div>` : ''}`;
      if (bad) {
        document.getElementById('btn-export-disc').addEventListener('click', async () => {
          const exportStatus = document.getElementById('export-status');
          try {
            const r = await window.api.exportDiscrepancies(results.discrepancies);
            if (r.cancelled) return;
            if (exportStatus) { exportStatus.textContent = '✓ Exported'; exportStatus.className = 'save-status success'; }
          } catch (e) {
            if (exportStatus) { exportStatus.textContent = `Error: ${e.message}`; exportStatus.className = 'save-status error'; }
          }
        });
      }
      statusEl.textContent = `Audit complete — ${results.discrepancies.length} discrepanc${results.discrepancies.length === 1 ? 'y' : 'ies'} found.`;
    } else {
      statusEl.textContent = `Audit failed: ${error || 'Unknown error'}`;
    }
  } catch (e) {
    statusEl.textContent = `Error: ${e.message}`;
  }

  btn.disabled = false;
  btn.classList.remove('hidden');
  document.getElementById('btn-stop-audit')?.classList.add('hidden');
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2l9 5-9 5V2z" fill="currentColor"/></svg> Run Audit`;
}

// ─── Invoice Monitor ──────────────────────────────────────────────────────────
function renderInvoiceMonitor() {
  content.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Pax8 Invoice Comparison</h1>
        <p class="view-desc">Fetch Pax8 invoices, compare against history, and use Claude AI to flag anomalies like new charges, quantity spikes, or missing recurring items.</p>
      </div>
      <img class="view-header-deco" src="Anchor_Logo_Vertical_High.png" alt="" draggable="false" />
    </div>
    <div class="audit-controls" style="flex-wrap:wrap;gap:12px">
      <button class="btn btn-primary" id="btn-run-invoice">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2l9 5-9 5V2z" fill="currentColor"/></svg>
        Run Analysis
      </button>
      <button class="btn btn-danger hidden" id="btn-stop-invoice">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor"/></svg>
        Stop
      </button>
      <input class="field-input" id="invoice-company-filter" type="text" placeholder="Filter by company name (leave blank for all)" style="width:260px;flex-shrink:0" />
      <select class="field-input" id="invoice-compare-count" style="width:auto;flex-shrink:0">
        <option value="1">Compare to last invoice</option>
        <option value="2">Compare to last 2 invoices</option>
        <option value="3">Compare to last 3 invoices</option>
      </select>
    </div>
    <div class="analysis-status-bar" id="invoice-status"></div>

    <div class="analysis-grid hidden" id="invoice-analysis-grid">
      <div class="analysis-card">
        <div class="analysis-card-title">Analysis Summary</div>
        <div class="step-list" id="invoice-steps"></div>
      </div>
      <div class="analysis-card">
        <div class="analysis-card-title">Top Changes by Company</div>
        <div id="invoice-top-changes" style="color:var(--text-muted);font-size:12px">Running analysis…</div>
      </div>
    </div>

    <div class="hidden" id="invoice-results"></div>
  `;

  document.getElementById('btn-run-invoice').addEventListener('click', runInvoiceAudit);
  document.getElementById('btn-stop-invoice').addEventListener('click', async () => {
    const btn = document.getElementById('btn-stop-invoice');
    if (btn) { btn.disabled = true; btn.textContent = 'Stopping…'; }
    await window.api.abortInvoiceAudit();
  });

  content.addEventListener('click', async (e) => {
    if (e.target.id !== 'btn-print-report') return;
    const btn = e.target;
    const origText = btn.textContent;
    btn.disabled = true; btn.textContent = 'Exporting…';
    try {
      const r = await window.api.printReport();
      if (r && r.error) { alert(`Export failed: ${r.error}`); btn.disabled = false; btn.textContent = origText; }
      else if (r && r.success) { btn.textContent = '✓ Saved to Downloads'; setTimeout(() => { btn.disabled = false; btn.textContent = origText; }, 3000); }
      else { alert('Export returned unexpected response'); btn.disabled = false; btn.textContent = origText; }
    } catch (err) {
      alert(`Export error: ${err.message}`);
      btn.disabled = false; btn.textContent = origText;
    }
  });

  // Restore cached state
  if (cache.invoiceMonitor.logHtml) {
    invoiceStepsReset();
    document.getElementById('invoice-status').textContent = cache.invoiceMonitor.statusText;
    document.getElementById('invoice-analysis-grid').classList.remove('hidden');
  }
  if (cache.invoiceMonitor.results) {
    renderInvoiceResults(cache.invoiceMonitor.results, document.getElementById('invoice-results'));
  }
}

async function runInvoiceAudit() {
  const btn       = document.getElementById('btn-run-invoice');
  const statusEl  = document.getElementById('invoice-status');
  const resultsEl = document.getElementById('invoice-results');
  const filter       = document.getElementById('invoice-company-filter')?.value?.trim() || '';
  const compareCount = parseInt(document.getElementById('invoice-compare-count')?.value || '1', 10);

  btn.disabled = true;
  btn.classList.add('hidden');
  document.getElementById('btn-stop-invoice').classList.remove('hidden');
  resultsEl.classList.add('hidden');
  resultsEl.innerHTML = '';
  statusEl.textContent = 'Analysis in progress…';

  invoiceStepsReset();
  document.getElementById('invoice-analysis-grid').classList.remove('hidden');

  if (invoiceLogUnsubscribe) invoiceLogUnsubscribe();
  invoiceLogUnsubscribe = window.api.onInvoiceLog(({ msg, type }) => {
    invoiceParseLog(msg, type);
    cache.invoiceMonitor.logHtml = 'has-run';
  });

  try {
    const { success, results, error } = await window.api.runInvoiceAudit({ companyFilter: filter, compareCount });

    if (success && results) {
      const msg = `Analysis complete — ${results.anomalies.length} change${results.anomalies.length === 1 ? '' : 's'} found across ${results.analyzed} companies.`;
      statusEl.textContent = msg;
      cache.invoiceMonitor.statusText = msg;
      cache.invoiceMonitor.results    = results;
      saveToolStat('invoice-monitor', `${results.anomalies.length} change${results.anomalies.length === 1 ? '' : 's'} across ${results.analyzed} companies`, results.anomalies.length > 0 ? 'warn' : 'ok');
      renderTopChanges(results.anomalies);
      renderInvoiceResults(results, resultsEl);
      if (results.anomalies.length) resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setLastRun(new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }));
    } else {
      statusEl.textContent = `Failed: ${error || 'Unknown error'}`;
    }
  } catch (e) {
    statusEl.textContent = `Error: ${e.message}`;
  }

  btn.disabled = false;
  btn.classList.remove('hidden');
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2l9 5-9 5V2z" fill="currentColor"/></svg> Run Analysis`;
  document.getElementById('btn-stop-invoice')?.classList.add('hidden');
}

function renderTopChanges(anomalies) {
  const el = document.getElementById('invoice-top-changes');
  if (!el) return;
  if (!anomalies.length) {
    el.innerHTML = '<p style="font-size:12px;color:var(--success)">No changes detected.</p>';
    return;
  }
  const warnSvg = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="color:var(--warn);flex-shrink:0"><path d="M6 1L1 10.5h10L6 1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
  const sorted = [...anomalies].sort((a, b) => b.changes.length - a.changes.length);
  const top = sorted.slice(0, 7);
  el.innerHTML = `<div class="changes-list">
    ${top.map(a => `
      <div class="change-row">
        ${warnSvg}
        <span class="change-company">${escHtml(a.company)}</span>
        <span class="change-count">${a.changes.length} change${a.changes.length !== 1 ? 's' : ''}</span>
      </div>`).join('')}
    ${sorted.length > 7 ? `<a class="view-all-link" id="link-view-all">⇓ View all ${sorted.length} changes</a>` : ''}
  </div>`;
  document.getElementById('link-view-all')?.addEventListener('click', () =>
    document.getElementById('invoice-results')?.scrollIntoView({ behavior: 'smooth' })
  );
}

function renderInvoiceResults(results, container) {
  container.classList.remove('hidden');
  const invMeta = results.invoiceId
    ? `Invoice ${escHtml(results.invoiceId)} · ${escHtml(results.invoiceDate || '')}${results.invoiceTotal != null ? ` · $${Number(results.invoiceTotal).toLocaleString()}` : ''}`
    : '';

  if (!results.anomalies.length) {
    container.innerHTML = `
      <div class="finding-clean">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7.5" stroke="var(--success)" stroke-width="1.5"/><path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="var(--success)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        All ${results.analyzed} companies are unchanged vs. prior invoices.
      </div>`;
    return;
  }

  const totalFmt = results.invoiceTotal != null ? `$${Number(results.invoiceTotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

  container.innerHTML = `
    <div class="report-header" style="margin-bottom:16px">
      <div>
        <div class="report-title">Invoice Analysis Report</div>
        <div class="report-subtitle">${invMeta}</div>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-print-report">↓ Export Excel</button>
    </div>
    <div class="metric-strip">
      <div class="metric-card"><span class="metric-num">${results.analyzed}</span><span class="metric-label">On Invoice</span></div>
      <div class="metric-card m-warn"><span class="metric-num">${results.anomalies.length}</span><span class="metric-label">Changes</span></div>
      <div class="metric-card m-clean"><span class="metric-num">${results.clean}</span><span class="metric-label">Unchanged</span></div>
      <div class="metric-card m-orange"><span class="metric-num" style="font-size:18px">${totalFmt}</span><span class="metric-label">Total Amount</span></div>
    </div>
    <div class="ai-summary"><div class="ai-summary-label">AI Summary</div><p class="ai-summary-text">${results.aiSummary ? escHtml(results.aiSummary) : '<em style="opacity:0.5">AI analysis did not return a result for this run. Check that your Claude API key is set in Settings.</em>'}</p></div>
    <div id="finding-cards"></div>
  `;

  // Helpers for delta rendering
  const truncateDesc = desc => {
    if (!desc) return desc;
    // Step 1: strip "- Azure subscription N - ..." (Beta Health format)
    let r = desc.replace(/\s*[-–]\s*Azure subscription\s+\d+.*$/i, '').trim();
    // Step 2: strip "- UUID..." or " UUID..." (Bradford format: "Microsoft Azure - UUID Microsoft Azure...")
    r = r.replace(/\s*[-–]?\s*[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}.*$/i, '').trim();
    // Step 3: for any Microsoft Azure item cap at 2 dash-segments to catch remaining edge cases
    if (/^Microsoft Azure/i.test(r)) {
      const parts = r.split(/\s*[-–]\s*/);
      r = parts.slice(0, 2).join(' - ');
    }
    return r || desc;
  };
  const fmtD = v => {
    const abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v >= 0 ? '+' : '−') + '$' + abs;
  };
  const calcDollar = c => {
    if (typeof c === 'string') return 0;
    switch (c.type) {
      case 'QTY_CHANGE':   return (c.qtyDelta  || 0) * (c.currentPrice || 0);
      case 'PRICE_CHANGE': return (c.priceDelta || 0) * (c.currentQty   || 0);
      case 'NEW':          return (c.currentQty || 0) * (c.currentPrice || 0);
      case 'REMOVED':      return -((c.prevQty  || 0) * (c.prevPrice    || 0));
      default:             return 0;
    }
  };
  const dColor = v => v > 0 ? 'var(--warn)' : v < 0 ? '#4caf97' : 'var(--text-muted)';

  const cards = document.getElementById('finding-cards');
  let grandDollar = 0;

  for (const a of results.anomalies) {
    const card = document.createElement('div');
    card.className = 'finding-card';
    const items = a.changes || [];

    let cardDollar = 0;
    const listItems = items.filter(l => l.trim ? l.trim() : true).map(l => {
      if (typeof l === 'string') return `<li style="padding:4px 0">${escHtml(l.replace(/^[-•*]\s*/, ''))}</li>`;
      const delta = calcDollar(l);
      cardDollar += delta;
      const desc  = truncateDesc(l.description || l.type || '');
      const isSpecial = l.type === 'NEW_CLIENT' || l.type === 'CLIENT_REMOVED';

      // Right-side badges (qty + dollar)
      let badges = '';
      if (l.type === 'QTY_CHANGE' && l.prevQty != null && l.currentQty != null) {
        const sign = l.qtyDelta >= 0 ? '+' : '';
        badges += `<span style="font-size:10.5px;font-family:var(--font-mono);color:var(--text-muted);background:rgba(255,255,255,.06);padding:1px 6px;border-radius:4px;white-space:nowrap">${l.prevQty}→${l.currentQty} (${sign}${l.qtyDelta})</span>`;
      }
      if (!isSpecial) {
        // Always show dollar for qty changes (even $0.00); show for others only if non-zero
        if (l.type === 'QTY_CHANGE' || Math.abs(delta) >= 0.01) {
          badges += `<span style="font-size:11.5px;font-weight:700;font-family:var(--font-mono);color:${dColor(delta)};white-space:nowrap">${fmtD(delta)}</span>`;
        }
      }

      return `<li style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)">
        <span style="flex:1;min-width:0">${escHtml(desc)}</span>
        ${badges ? `<span style="display:inline-flex;align-items:center;gap:6px;flex-shrink:0">${badges}</span>` : ''}
      </li>`;
    });

    grandDollar += cardDollar;

    const cardTotalHtml = Math.abs(cardDollar) >= 0.01
      ? `<span style="font-size:12px;font-family:var(--font-mono);font-weight:700;color:${dColor(cardDollar)}">${fmtD(cardDollar)}</span>`
      : '';

    card.innerHTML = `
      <div class="finding-header">
        <span class="finding-company">${escHtml(a.company)}</span>
        <div style="display:flex;align-items:center;gap:10px">
          ${cardTotalHtml}
          <span class="finding-meta">${items.length} change${items.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <ul class="finding-list" style="list-style:none;padding:0;margin:0">${listItems.join('')}</ul>
    `;
    cards.appendChild(card);
  }

  // Grand total net change banner
  if (results.anomalies.length && Math.abs(grandDollar) >= 0.01) {
    const banner = document.createElement('div');
    banner.style.cssText = 'margin-top:12px;padding:10px 18px;border-radius:var(--radius);background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between';
    banner.innerHTML = `
      <span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Estimated Net Invoice Change</span>
      <span style="font-size:18px;font-weight:800;font-family:var(--font-mono);color:${dColor(grandDollar)}">${fmtD(grandDollar)}</span>
    `;
    cards.after(banner);
  }
}

// ─── M365 Margin Analyzer ──────────────────────────────────────────────────────────
function renderMarginAnalyzer() {
  content.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">M365 Margin Analyzer</h1>
        <p class="view-desc">Compare Pax8 invoice costs and suggested prices against Autotask contract billing rates to identify pricing gaps and calculate margins per client and product.</p>
      </div>
      <img class="view-header-deco" src="Anchor_Logo_Vertical_High.png" alt="" draggable="false" />
    </div>
    <div class="audit-controls" style="flex-wrap:wrap;gap:12px">
      <button class="btn btn-primary" id="btn-run-margin">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2l9 5-9 5V2z" fill="currentColor"/></svg>
        Run Analysis
      </button>
      <button class="btn btn-danger hidden" id="btn-stop-margin">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor"/></svg>
        Stop
      </button>
      <input class="field-input" id="margin-company-filter" type="text" placeholder="Filter by company name (leave blank for all)" style="width:280px;flex-shrink:0" />
      <span class="audit-status-text" id="margin-status"></span>
    </div>
    <div class="log-container">
      <div class="log-empty" id="margin-log-empty">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" opacity="0.3"><path d="M4 24l8-8 6 6 10-12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <p>No analysis run yet.<br/>Click "Run Analysis" to compare Pax8 costs against Autotask billing.</p>
      </div>
      <div class="log-output" id="margin-log-output"></div>
    </div>
    <div class="hidden" id="margin-results"></div>
  `;

  document.getElementById('btn-run-margin').addEventListener('click', runMarginAnalysis);
  document.getElementById('btn-stop-margin').addEventListener('click', async () => {
    const btn = document.getElementById('btn-stop-margin');
    if (btn) { btn.disabled = true; btn.textContent = 'Stopping…'; }
    await window.api.abortMarginAnalysis();
  });

  content.addEventListener('click', async (e) => {
    if (e.target.id !== 'btn-export-margin') return;
    const btn = e.target;
    const origText = btn.textContent;
    btn.disabled = true; btn.textContent = 'Exporting…';
    try {
      const r = await window.api.exportMarginReport();
      if (r && r.error) { alert(`Export failed: ${r.error}`); btn.disabled = false; btn.textContent = origText; }
      else if (r && r.success) { btn.textContent = '✓ Saved to Downloads'; setTimeout(() => { btn.disabled = false; btn.textContent = origText; }, 3000); }
    } catch (err) { alert(`Export error: ${err.message}`); btn.disabled = false; btn.textContent = origText; }
  });

  if (cache.marginAnalyzer.logHtml) {
    document.getElementById('margin-log-empty').classList.add('hidden');
    document.getElementById('margin-log-output').innerHTML = cache.marginAnalyzer.logHtml;
    document.getElementById('margin-status').textContent   = cache.marginAnalyzer.statusText;
  }
  if (cache.marginAnalyzer.summary) renderMarginSummary(cache.marginAnalyzer.summary);
}

async function runMarginAnalysis() {
  const btn       = document.getElementById('btn-run-margin');
  const logOutput = document.getElementById('margin-log-output');
  const logEmpty  = document.getElementById('margin-log-empty');
  const statusEl  = document.getElementById('margin-status');
  const resultsEl = document.getElementById('margin-results');
  const filter    = document.getElementById('margin-company-filter')?.value?.trim() || '';

  btn.disabled = true; btn.classList.add('hidden');
  document.getElementById('btn-stop-margin').classList.remove('hidden');
  logEmpty.classList.add('hidden');
  logOutput.innerHTML = '';
  resultsEl.classList.add('hidden'); resultsEl.innerHTML = '';
  statusEl.textContent = 'Analysis in progress…';

  if (marginLogUnsubscribe) marginLogUnsubscribe();
  marginLogUnsubscribe = window.api.onMarginLog(({ msg, type }) => {
    if (type === 'divider') {
      logOutput.innerHTML += `<div class="log-divider"></div>`;
    } else {
      logOutput.innerHTML += `<div class="log-line log-${type || 'info'}">${escHtml(msg)}</div>`;
    }
    logOutput.scrollTop = logOutput.scrollHeight;
    cache.marginAnalyzer.logHtml = logOutput.innerHTML;
  });

  try {
    const { success, summary, error } = await window.api.runMarginAnalysis({ companyFilter: filter });
    if (success && summary) {
      const msg = `Analysis complete — ${summary.companies} companies, ${summary.mismatches} price mismatch${summary.mismatches !== 1 ? 'es' : ''}, ${summary.unmapped} unmapped.`;
      statusEl.textContent = msg;
      cache.marginAnalyzer.statusText = msg;
      cache.marginAnalyzer.summary    = summary;
      saveToolStat('margin-analyzer', `${summary.companies} companies · ${summary.mismatches} mismatch${summary.mismatches !== 1 ? 'es' : ''}`, summary.mismatches > 0 ? 'warn' : 'ok');
      renderMarginSummary(summary);
    } else {
      statusEl.textContent = `Failed: ${error || 'Unknown error'}`;
    }
  } catch (e) { statusEl.textContent = `Error: ${e.message}`; }

  btn.disabled = false; btn.classList.remove('hidden');
  document.getElementById('btn-stop-margin')?.classList.add('hidden');
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2l9 5-9 5V2z" fill="currentColor"/></svg> Run Analysis`;
}

function renderMarginSummary(summary) {
  const el = document.getElementById('margin-results');
  if (!el) return;
  el.classList.remove('hidden');
  const marginColor = summary.totalMarginPct == null ? 'var(--text-muted)'
    : summary.totalMarginPct >= 20 ? 'var(--success)'
    : summary.totalMarginPct >= 10 ? 'var(--warn)'
    : 'var(--error)';
  el.innerHTML = `
    <div class="report-header">
      <div>
        <div class="report-title">Margin Analysis Results</div>
        <div class="report-subtitle">Invoice cost vs. Autotask billing rates</div>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-export-margin">↓ Export Excel</button>
    </div>
    <div class="report-stats">
      <div class="report-stat"><span class="report-stat-num">${summary.companies}</span><span class="report-stat-label">Companies</span></div>
      <div class="report-stat ${summary.mismatches > 0 ? 'warn' : 'clean'}"><span class="report-stat-num">${summary.mismatches}</span><span class="report-stat-label">Price Mismatches</span></div>
      <div class="report-stat ${summary.unmapped > 0 ? 'warn' : 'clean'}"><span class="report-stat-num">${summary.unmapped}</span><span class="report-stat-label">Unmapped</span></div>
      <div class="report-stat" style="border-color:${marginColor}40;background:${marginColor}08">
        <span class="report-stat-num" style="color:${marginColor}">${summary.totalMarginPct != null ? summary.totalMarginPct.toFixed(1) + '%' : 'N/A'}</span>
        <span class="report-stat-label">Overall Margin</span>
      </div>
      <div class="report-stat"><span class="report-stat-num" style="font-size:16px">$${Number(summary.totalPax8Cost).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span><span class="report-stat-label">Pax8 Cost</span></div>
      <div class="report-stat clean"><span class="report-stat-num" style="font-size:16px">$${Number(summary.totalATBilled).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span><span class="report-stat-label">AT Billed</span></div>
    </div>
  `;
}

// ─── Company Mapping ──────────────────────────────────────────────────────────
function renderCompanyMapping() {
  content.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Company Mapping</h1>
        <p class="view-desc">Sync Pax8 companies and products to Autotask IDs. Export the result as CSV, fill in any missing IDs in Excel, then re-import to activate.</p>
      </div>
      <img class="view-header-deco" src="Anchor_Logo_Vertical_High.png" alt="" draggable="false" />
    </div>

    <div class="settings-section" style="max-width:680px">
      <h2 class="section-title">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v2.5M7 10.5V13M1 7h2.5M10.5 7H13M2.93 2.93l1.77 1.77M9.3 9.3l1.77 1.77M2.93 11.07l1.77-1.77M9.3 4.7l1.77-1.77" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        Step 1 — Sync from Pax8 &amp; Autotask
      </h2>
      <p class="field-hint" style="margin-bottom:14px">Pulls all Pax8 companies and active subscriptions, matches against Autotask. Companies already linked via the PSA integration are auto-accepted.</p>
      <button class="btn btn-primary" id="btn-run-mapping">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v2.5M7 10.5V13M1 7h2.5M10.5 7H13M2.93 2.93l1.77 1.77M9.3 9.3l1.77 1.77M2.93 11.07l1.77-1.77M9.3 4.7l1.77-1.77" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        Sync Now
      </button>
      <span class="audit-status-text" id="mapping-status" style="margin-left:12px"></span>
    </div>

    <div class="log-container" style="max-width:680px;margin-bottom:20px">
      <div class="log-empty" id="mapping-log-empty">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" opacity="0.3"><circle cx="9" cy="14" r="5" stroke="currentColor" stroke-width="1.4"/><circle cx="19" cy="14" r="5" stroke="currentColor" stroke-width="1.4"/><path d="M14 14h0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <p>No sync run yet. Click "Sync Now" to start.</p>
      </div>
      <div class="log-output" id="mapping-log-output"></div>
    </div>

    <div class="hidden" id="mapping-sync-stats"></div>

    <div class="settings-section" style="max-width:680px">
      <h2 class="section-title">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v9M3.5 7l3.5 3.5L10.5 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M1 12h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        Step 2 — Export &amp; Fill In
      </h2>
      <p class="field-hint" style="margin-bottom:14px">Exports two CSV files to the app folder: one for companies, one for products. Products include vendor name and vendor SKU to help identify the correct AT service. Open in Excel, fill in any blank <code>at_company_id</code> or <code>at_service_id</code> columns, then save.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-ghost" id="btn-export-mapping-csv">
          ↓ Export Unmapped CSVs
        </button>
        <button class="btn btn-ghost" id="btn-export-full-mapping-csv">
          ↓ Full Export (all + AT reference)
        </button>
      </div>
      <span class="save-status" id="export-mapping-status" style="margin-top:8px;display:block"></span>
    </div>

    <div class="settings-section" style="max-width:680px">
      <h2 class="section-title">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 13V4M3.5 7L7 3.5 10.5 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M1 12h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        Step 3 — Import Back
      </h2>
      <p class="field-hint" style="margin-bottom:14px">Once you've filled in the CSVs, import each one. All tools (M365 Subscription Comparison, M365 Margin Analyzer) will immediately use the new mappings.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-ghost" id="btn-import-co-csv">↑ Import Companies CSV</button>
        <button class="btn btn-ghost" id="btn-import-svc-csv">↑ Import Services CSV</button>
        <span class="save-status" id="import-mapping-status" style="margin-left:2px"></span>
      </div>
    </div>

    <div class="hidden" id="mapping-current-status"></div>
  `;

  document.getElementById('btn-run-mapping').addEventListener('click', runMappingSync);
  document.getElementById('btn-export-mapping-csv').addEventListener('click', exportMappingCsv);
  document.getElementById('btn-export-full-mapping-csv').addEventListener('click', exportFullMappingCsv);
  document.getElementById('btn-import-co-csv').addEventListener('click', () => importMappingCsv('companies'));
  document.getElementById('btn-import-svc-csv').addEventListener('click', () => importMappingCsv('services'));

  loadExistingMappingStatus();
}

async function loadExistingMappingStatus() {
  try {
    const data = await window.api.getMappings();
    if (data?.lastSync) {
      const statusEl = document.getElementById('mapping-status');
      if (statusEl) statusEl.textContent = `Last sync: ${new Date(data.lastSync).toLocaleString()}`;
      renderMappingSyncStats(data, data.companies || [], data.services || []);
    }
  } catch {}
}

async function runMappingSync() {
  const btn       = document.getElementById('btn-run-mapping');
  const logOutput = document.getElementById('mapping-log-output');
  const logEmpty  = document.getElementById('mapping-log-empty');
  const statusEl  = document.getElementById('mapping-status');

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Syncing…`;
  logEmpty.classList.add('hidden');
  logOutput.innerHTML = '';
  statusEl.textContent = 'Sync in progress…';

  if (mappingLogUnsubscribe) mappingLogUnsubscribe();
  mappingLogUnsubscribe = window.api.onMappingLog(({ msg, type }) => {
    if (type === 'divider') logOutput.innerHTML += `<div class="log-divider"></div>`;
    else logOutput.innerHTML += `<div class="log-line log-${type || 'info'}">${escHtml(msg)}</div>`;
    logOutput.scrollTop = logOutput.scrollHeight;
  });

  try {
    const r = await window.api.runMappingSync();
    if (r.success) {
      const coMapped  = r.stats.coHigh + r.stats.coLow;
      const svcMapped = r.stats.svcHigh + r.stats.svcLow;
      statusEl.textContent = `Sync complete — ${coMapped} companies, ${svcMapped} services.`;
      saveToolStat('company-mapping', `${coMapped} companies · ${svcMapped} services mapped`, 'ok');
      renderMappingSyncStats(r, r.companies || [], r.services || []);
    } else {
      statusEl.textContent = `Sync failed: ${r.error || 'Unknown error'}`;
    }
  } catch (e) {
    statusEl.textContent = `Error: ${e.message}`;
  }

  btn.disabled = false;
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v2.5M7 10.5V13M1 7h2.5M10.5 7H13M2.93 2.93l1.77 1.77M9.3 9.3l1.77 1.77M2.93 11.07l1.77-1.77M9.3 4.7l1.77-1.77" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg> Sync Now`;
}

function renderMappingSyncStats(data, companies, services) {
  const el = document.getElementById('mapping-sync-stats');
  if (!el) return;

  const coAccepted  = companies.filter(c => c.accepted && c.atId).length;
  const coExcluded  = companies.filter(c => c.excluded).length;
  const coUnfilled  = companies.filter(c => !c.accepted && !c.excluded && !c.atId).length;
  const coNameMatch = companies.filter(c => !c.accepted && !c.excluded && c.atId).length;
  const svcAccepted = services.filter(s => s.accepted && s.atServiceId).length;
  const svcFlagged  = services.filter(s => !s.accepted || !s.atServiceId).length;

  // Unmatched / unfilled companies to show with Exclude buttons
  const needsAction = companies.filter(c => !c.accepted && !c.excluded);

  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="report-stats" style="margin-bottom:${needsAction.length ? 16 : 20}px">
      <div class="report-stat clean"><span class="report-stat-num">${coAccepted}</span><span class="report-stat-label">Companies Mapped</span></div>
      <div class="report-stat ${coUnfilled + coNameMatch > 0 ? 'warn' : 'clean'}"><span class="report-stat-num">${coUnfilled + coNameMatch}</span><span class="report-stat-label">Needs Review</span></div>
      <div class="report-stat"><span class="report-stat-num">${coExcluded}</span><span class="report-stat-label">Excluded</span></div>
      <div class="report-stat clean"><span class="report-stat-num">${svcAccepted}</span><span class="report-stat-label">Services Mapped</span></div>
      <div class="report-stat ${svcFlagged > 0 ? 'warn' : 'clean'}"><span class="report-stat-num">${svcFlagged}</span><span class="report-stat-label">Services Unfilled</span></div>
    </div>
    ${needsAction.length ? `
    <div class="settings-section" style="max-width:680px;margin-bottom:20px;padding:16px 20px">
      <div style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Companies needing action</div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">
        Name-matched companies need your confirmation. Accept if the Autotask name is correct, or Exclude to skip this client in all tools.
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${needsAction.map(c => {
          const hasMatch = !!c.atId;
          return `
          <div class="mapping-action-row" data-pax8id="${escHtml(c.pax8Id)}" style="display:flex;align-items:center;gap:10px;padding:7px 10px;background:var(--bg);border-radius:6px;border:1px solid var(--border)">
            <span style="font-size:13px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(c.pax8Name || c.pax8Id)}">${escHtml(c.pax8Name || c.pax8Id)}</span>
            <span style="font-size:11px;color:${hasMatch ? 'var(--text-dim)' : 'var(--text-muted)'};flex-shrink:0;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${hasMatch ? `→ ${escHtml(c.atName)}` : 'No Autotask match found'}
            </span>
            ${hasMatch ? `<button class="btn btn-ghost btn-sm accept-company-btn" style="flex-shrink:0;font-size:11px;padding:3px 10px;color:var(--success);border-color:var(--success)40"
              data-pax8id="${escHtml(c.pax8Id)}">Accept</button>` : ''}
            <button class="btn btn-ghost btn-sm exclude-company-btn" style="flex-shrink:0;font-size:11px;padding:3px 10px;color:var(--warn);border-color:var(--warn)30"
              data-pax8id="${escHtml(c.pax8Id)}">Exclude</button>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}
  `;
}

// Event delegation for Accept / Exclude buttons in Company Mapping
content.addEventListener('click', async (e) => {
  const acceptBtn  = e.target.closest('.accept-company-btn');
  const excludeBtn = e.target.closest('.exclude-company-btn');
  if (!acceptBtn && !excludeBtn) return;

  const btn    = acceptBtn || excludeBtn;
  const pax8Id = btn.dataset.pax8id;
  if (!pax8Id) return;

  btn.disabled = true;
  btn.textContent = acceptBtn ? 'Accepting…' : 'Excluding…';

  try {
    if (acceptBtn) {
      await window.api.acceptCompanyMatch({ pax8Id });
    } else {
      await window.api.setCompanyExcluded({ pax8Id, excluded: true });
    }
    // Fade and update the whole row
    const row = btn.closest('.mapping-action-row');
    if (row) {
      row.style.opacity = '0.4';
      row.querySelectorAll('button').forEach(b => { b.disabled = true; });
      btn.textContent = acceptBtn ? '✓ Accepted' : '✓ Excluded';
    }
    await loadExistingMappingStatus();
  } catch (err) { btn.textContent = 'Error'; btn.disabled = false; }
});

async function exportMappingCsv() {
  const btn    = document.getElementById('btn-export-mapping-csv');
  const status = document.getElementById('export-mapping-status');
  btn.disabled = true;
  try {
    const r = await window.api.exportMappingCsv();
    if (r.error) { status.textContent = `Error: ${r.error}`; status.className = 'save-status error'; }
    else { status.textContent = `✓ Exported ${r.coCount} unmapped companies & ${r.svcCount} unmapped services — folder opened`; status.className = 'save-status success'; }
  } catch (e) { status.textContent = `Error: ${e.message}`; status.className = 'save-status error'; }
  btn.disabled = false;
}

async function exportFullMappingCsv() {
  const btn    = document.getElementById('btn-export-full-mapping-csv');
  const status = document.getElementById('export-mapping-status');
  btn.disabled = true; btn.textContent = 'Exporting…';
  try {
    const r = await window.api.exportFullMappingCsv();
    if (r.error) { status.textContent = `Error: ${r.error}`; status.className = 'save-status error'; }
    else {
      const refNote = r.hasRef ? ' + AT services reference' : '';
      status.textContent = `✓ Full export: ${r.coCount} companies, ${r.svcCount} services${refNote} — folder opened`;
      status.className = 'save-status success';
    }
  } catch (e) { status.textContent = `Error: ${e.message}`; status.className = 'save-status error'; }
  btn.disabled = false; btn.textContent = '↓ Full Export (all + AT reference)';
  setTimeout(() => { if (status) { status.textContent = ''; status.className = 'save-status'; } }, 5000);
}

async function importMappingCsv(type) {
  const status = document.getElementById('import-mapping-status');
  try {
    const r = await window.api.importMappingCsv(type);
    if (r.cancelled) return;
    if (r.error) { status.textContent = `Error: ${r.error}`; status.className = 'save-status error'; }
    else {
      const label = r.isPsaExport ? `${r.count} products from Pax8 PSA export` : `${r.count} ${type}`;
      status.textContent = `✓ ${label} imported`;
      status.className = 'save-status success';
      loadExistingMappingStatus();
    }
  } catch (e) { status.textContent = `Error: ${e.message}`; status.className = 'save-status error'; }
  setTimeout(() => { if (status) { status.textContent = ''; status.className = 'save-status'; } }, 4000);
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function renderSettings(activeTab = 'general') {
  content.innerHTML = `
    <div class="view-header" style="margin-bottom:0">
      <h1 class="view-title">Settings</h1>
    </div>

    <!-- Tab nav -->
    <div class="stab-nav">
      <button class="stab ${activeTab==='general'?'active':''}" data-tab="general">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2.2" stroke="currentColor" stroke-width="1.3"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.93 2.93l1.06 1.06M10.01 10.01l1.06 1.06M2.93 11.07l1.06-1.06M10.01 3.99l1.06-1.06" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        General
      </button>
      <button class="stab ${activeTab==='customize'?'active':''}" data-tab="customize">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>
        Customize
      </button>
      <button class="stab ${activeTab==='prompts'?'active':''}" data-tab="prompts">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 3h10M2 6.5h7M2 10h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        AI Prompts
      </button>
      <button class="stab ${activeTab==='api'?'active':''}" data-tab="api">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="5" cy="9" r="3.2" stroke="currentColor" stroke-width="1.3"/><path d="M7.5 6.5L11 3M11 3h-2M11 3v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        API &amp; Accounts
      </button>
    </div>

    <!-- ── Tab: Customize ── -->
    <div class="stab-panel ${activeTab==='customize'?'active':''}" data-panel="customize">
      <div class="settings-section wide">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:4px">
          <h2 class="section-title" style="margin:0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="1" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="1" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/><rect x="8" y="8" width="5" height="5" rx="1" stroke="currentColor" stroke-width="1.3"/></svg>
            Sidebar Layout
          </h2>
          <div style="display:flex;align-items:center;gap:8px">
            <button class="btn btn-ghost btn-sm" id="cust-add-group">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2v8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              Add Group
            </button>
            <button class="btn btn-primary btn-sm" id="cust-save">Save Layout</button>
            <span class="save-status" id="cust-save-status"></span>
          </div>
        </div>
        <p class="field-hint" style="margin-bottom:16px">Check tools to show them in the sidebar and home screen. Drag <strong style="color:var(--text)">⠿</strong> to reorder. Use groups to create named sections — drag tools into or out of them.</p>
        <div id="cust-list" class="cust-list"></div>
      </div>
    </div>

    <!-- ── Tab 1: General ── -->
    <div class="stab-panel ${activeTab==='general'?'active':''}" data-panel="general">

      <div class="settings-section">
        <h2 class="section-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 12l4-4 3 3 5-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          M365 Margin Analyzer
        </h2>
        <div class="field-group">
          <label class="field-label">Azure Contract Name to Exclude</label>
          <input class="field-input" id="margin-azure-contract" type="text" placeholder="Microsoft Azure Cloud Services" autocomplete="off" />
          <p class="field-hint">Autotask contract name for Azure — excluded from price comparison since Azure costs are billed at actuals.</p>
        </div>
        <div class="field-group">
          <label class="field-label">Azure ContractService ID</label>
          <input class="field-input" id="margin-azure-service-id" type="number" placeholder="110" style="width:100px" autocomplete="off" />
          <p class="field-hint">The Autotask serviceID for the Azure pay-as-you-go line. Used when generating the AT update prompt in Pax8 Invoice Processor.</p>
        </div>
        <div class="field-group">
          <label class="field-label">Scheduled Run — Day of Month</label>
          <input class="field-input" id="margin-schedule-day" type="number" min="1" max="28" placeholder="10" style="width:80px" />
          <p class="field-hint">App will auto-run the margin analysis on this day each month (requires app to be open).</p>
        </div>
        <div class="field-group">
          <label class="dry-run-toggle">
            <input type="checkbox" id="margin-schedule-enabled" />
            Enable scheduled monthly run
          </label>
        </div>
        <div id="margin-last-run" class="field-hint" style="margin-top:8px"></div>
        <div style="margin-top:14px">
          <button class="btn btn-primary btn-sm" id="btn-save-margin-settings">Save</button>
          <span class="save-status" id="margin-save-status"></span>
        </div>
      </div>

      <div class="settings-section">
        <h2 class="section-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 4h6M5 7h6M5 10h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M9 11.5l1.5 1.5L13 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Kaseya Invoice Processor
        </h2>
        <p class="field-hint" style="margin-bottom:14px">Configure how Kaseya invoice costs are split across QBO accounts and classes. All percentages within a category must add up to 100%.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div>
            <div class="field-label" style="margin-bottom:8px">PSA (Autotask) splits</div>
            <div class="field-group"><label class="field-label" style="font-size:11px;color:var(--text-muted)">Strategic Services %</label><input class="field-input" id="ks-psa-strategic" type="number" min="0" max="100" style="width:80px" /></div>
            <div class="field-group"><label class="field-label" style="font-size:11px;color:var(--text-muted)">Service Delivery %</label><input class="field-input" id="ks-psa-serviceDelivery" type="number" min="0" max="100" style="width:80px" /></div>
            <div class="field-group"><label class="field-label" style="font-size:11px;color:var(--text-muted)">Admin %</label><input class="field-input" id="ks-psa-admin" type="number" min="0" max="100" style="width:80px" /></div>
            <div class="field-group"><label class="field-label" style="font-size:11px;color:var(--text-muted)">Co-Managed %</label><input class="field-input" id="ks-psa-coManaged" type="number" min="0" max="100" style="width:80px" /></div>
          </div>
          <div>
            <div class="field-label" style="margin-bottom:8px">RMM (Datto) splits</div>
            <div class="field-group"><label class="field-label" style="font-size:11px;color:var(--text-muted)">Strategic Services %</label><input class="field-input" id="ks-rmm-strategic" type="number" min="0" max="100" style="width:80px" /></div>
            <div class="field-group"><label class="field-label" style="font-size:11px;color:var(--text-muted)">Service Delivery %</label><input class="field-input" id="ks-rmm-serviceDelivery" type="number" min="0" max="100" style="width:80px" /></div>
          </div>
          <div>
            <div class="field-label" style="margin-bottom:8px">IT Glue splits</div>
            <div class="field-group"><label class="field-label" style="font-size:11px;color:var(--text-muted)">Strategic Services %</label><input class="field-input" id="ks-itGlue-strategic" type="number" min="0" max="100" style="width:80px" /></div>
            <div class="field-group"><label class="field-label" style="font-size:11px;color:var(--text-muted)">Service Delivery %</label><input class="field-input" id="ks-itGlue-serviceDelivery" type="number" min="0" max="100" style="width:80px" /></div>
            <div class="field-group"><label class="field-label" style="font-size:11px;color:var(--text-muted)">Admin %</label><input class="field-input" id="ks-itGlue-admin" type="number" min="0" max="100" style="width:80px" /></div>
          </div>
          <div>
            <div class="field-label" style="margin-bottom:8px">Bundled splits</div>
            <div class="field-group"><label class="field-label" style="font-size:11px;color:var(--text-muted)">SaaS Protection — Bundled %</label><input class="field-input" id="ks-saas-bundledPct" type="number" min="0" max="100" style="width:80px" /><p class="field-hint">Remainder → Standalone (Cloud Email Mgmt)</p></div>
            <div class="field-group" style="margin-top:8px"><label class="field-label" style="font-size:11px;color:var(--text-muted)">DWP — Bundled %</label><input class="field-input" id="ks-dwp-bundledPct" type="number" min="0" max="100" style="width:80px" /><p class="field-hint">Remainder → Standalone (Cloud File Sync). DFP always Standalone.</p></div>
          </div>
        </div>
        <div style="margin-top:16px">
          <button class="btn btn-primary btn-sm" id="btn-save-kaseya-settings">Save</button>
          <span class="save-status" id="ks-save-status"></span>
        </div>
      </div>

      <div class="settings-section">
        <h2 class="section-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 8A5 5 0 1 1 8 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M8 1l3 2-3 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Autotask Contract Renewals
        </h2>
        <div class="field-group">
          <label class="field-label">Eligible Services for % Price Increase <span class="field-hint" style="font-weight:400">(partial match, one per line)</span></label>
          <p class="field-hint" style="margin-bottom:8px">Services whose name contains any of these phrases will show the % increase column at renewal.</p>
          <textarea id="renewal-eligible" class="field-input" rows="5" style="font-family:var(--font-mono);font-size:12px;resize:vertical">Security+
Total CommITment
Total CommITment Core</textarea>
        </div>
        <div style="margin-top:12px">
          <button class="btn btn-primary btn-sm" id="btn-save-renewal-eligible">Save</button>
          <span class="save-status" id="renewal-eligible-status"></span>
        </div>
      </div>

      <div class="settings-section">
        <h2 class="section-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h5v2H2V4zm7 0h5v2H9V4zM2 9h5v2H2V9zm7 0h5v2H9V9z" fill="currentColor" opacity="0.8"/></svg>
          Pax8 → PSA Mappings
        </h2>
        <p class="field-hint" style="margin-bottom:14px">Use the <strong>Company Mapping</strong> tool to sync mappings from the Pax8 PSA integration. CSV files are used as a fallback if no JSON mappings exist.</p>
        <div id="csv-status" class="field-hint">Checking…</div>
        <div style="margin-top:12px">
          <button class="btn btn-ghost btn-sm" id="btn-open-csv-folder">Open App Folder</button>
        </div>
      </div>

      <div class="settings-section">
        <h2 class="section-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 4h6M5 7h6M5 10h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          MSC Agreements File
        </h2>
        <p class="field-hint" style="margin-bottom:8px">Path to the MSC Agreements Excel file on OneDrive. The file stays on your machine — it is never stored in the app or uploaded anywhere.</p>
        <div class="field-group">
          <label class="field-label">File Path</label>
          <div class="field-row">
            <input class="field-input" id="msc-file-path" type="text"
              placeholder="C:\\Users\\...\\OneDrive - Anchor Network Solutions\\ANS-Finance\\Managed Service Clients\\MSC Agreements Tab.xlsx"
              autocomplete="off" spellcheck="false" />
            <button class="btn btn-ghost btn-sm" id="btn-browse-msc">Browse</button>
          </div>
        </div>
        <div style="margin-top:12px;display:flex;gap:10px;align-items:center">
          <button class="btn btn-primary btn-sm" id="btn-save-msc-settings">Save</button>
          <span class="save-status" id="msc-settings-status"></span>
        </div>
      </div>

    </div><!-- /general -->

    <!-- ── Tab 2: AI Prompts ── -->
    <div class="stab-panel ${activeTab==='prompts'?'active':''}" data-panel="prompts">

      <div class="settings-section">
        <h2 class="section-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M1 3h14M1 8h10M1 13h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
          Pax8 Invoice Processor — Prompt Templates
        </h2>
        <p class="field-hint" style="margin-bottom:14px">
          Customize the instruction block sent to Claude. Company/service data is appended automatically after the header.<br/>
          <strong>Azure placeholders:</strong>
          <code class="ph">{invoiceRef}</code> <code class="ph">{effectiveDate}</code> <code class="ph">{azureServiceId}</code><br/>
          <strong>Service placeholders:</strong>
          <code class="ph">{{INVOICE_ID}}</code> <code class="ph">{{INVOICE_DATE}}</code> <code class="ph">{{BILLING_MONTH_START}}</code> <code class="ph">{{BILLING_MONTH_END}}</code>
        </p>
        <div class="field-group">
          <label class="field-label">Azure Prompt Header</label>
          <textarea id="pt-azure-header" class="field-input pt-ta" rows="14" spellcheck="false"></textarea>
        </div>
        <div class="field-group" style="margin-top:12px">
          <label class="field-label">Service Quantities Prompt Header</label>
          <textarea id="pt-service-header" class="field-input pt-ta" rows="14" spellcheck="false"></textarea>
        </div>
        <div style="margin-top:14px;display:flex;gap:10px;align-items:center">
          <button class="btn btn-primary btn-sm" id="btn-save-prompt-templates">Save Templates</button>
          <button class="btn btn-ghost btn-sm" id="btn-reset-prompt-templates">Reset to Defaults</button>
          <span class="save-status" id="pt-save-status"></span>
        </div>
      </div>

      <div class="settings-section">
        <h2 class="section-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 4h6M5 7h6M5 10h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M9 11.5l1.5 1.5L13 10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Kaseya Invoice Processor — Prompt Template
        </h2>
        <p class="field-hint" style="margin-bottom:8px">
          <strong>Placeholders:</strong>
          <code class="ph">{invoiceRef}</code> <code class="ph">{billingStart}</code> <code class="ph">{billingEnd}</code>
        </p>
        <div class="field-group">
          <textarea id="pt-kaseya-header" class="field-input pt-ta" rows="10" spellcheck="false"></textarea>
        </div>
        <div style="margin-top:14px;display:flex;gap:10px;align-items:center">
          <button class="btn btn-primary btn-sm" id="btn-save-kaseya-prompt">Save</button>
          <button class="btn btn-ghost btn-sm" id="btn-reset-kaseya-prompt">Reset to Default</button>
          <span class="save-status" id="kp-save-status"></span>
        </div>
      </div>

      <div class="settings-section">
        <h2 class="section-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 8A5 5 0 1 1 8 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M8 1l3 2-3 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Contract Renewals — Comparison Prompt Template
        </h2>
        <p class="field-hint" style="margin-bottom:8px">
          Used by the "Compare All with Claude" button on already-renewed contracts. Leave blank for the built-in default.<br/>
          <strong>Tokens:</strong>
          <code class="ph">{companyName}</code> <code class="ph">{companyID}</code> <code class="ph">{contractName}</code> <code class="ph">{oldContractId}</code> <code class="ph">{newContractId}</code> <code class="ph">{oldEndDate}</code> <code class="ph">{newStartDate}</code>
        </p>
        <div class="field-group">
          <textarea id="renewal-info-prompt" class="field-input pt-ta" rows="8" spellcheck="false" placeholder="Leave blank to use the built-in default…"></textarea>
        </div>
        <div style="margin-top:12px">
          <button class="btn btn-primary btn-sm" id="btn-save-renewal-settings">Save</button>
          <span class="save-status" id="renewal-settings-status"></span>
        </div>
      </div>

    </div><!-- /prompts -->

    <!-- ── Tab 3: API & Accounts ── -->
    <div class="stab-panel ${activeTab==='api'?'active':''}" data-panel="api">

      <p class="stab-desc">All credentials are stored securely in Windows Credential Manager — never written to disk as plain text.</p>

      <div class="settings-section">
        <h2 class="section-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M1 6h14" stroke="currentColor" stroke-width="1.3"/></svg>
          Pax8
        </h2>
        <div class="field-group">
          <label class="field-label">Client ID</label>
          <input class="field-input" id="pax8-client-id" type="text" placeholder="Pax8 OAuth2 Client ID" autocomplete="off" spellcheck="false" />
        </div>
        <div class="field-group">
          <label class="field-label">Client Secret</label>
          <input class="field-input" id="pax8-client-secret" type="password" placeholder="Pax8 OAuth2 Client Secret" autocomplete="off" />
        </div>
      </div>

      <div class="settings-section">
        <h2 class="section-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2C5.79 2 4 3.79 4 6v1H3a1 1 0 00-1 1v5a1 1 0 001 1h10a1 1 0 001-1V8a1 1 0 00-1-1h-1V6c0-2.21-1.79-4-4-4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
          Autotask PSA
        </h2>
        <div class="field-group">
          <label class="field-label">Username</label>
          <input class="field-input" id="at-username" type="text" placeholder="API username (email)" autocomplete="off" spellcheck="false" />
        </div>
        <div class="field-group">
          <label class="field-label">API Key</label>
          <input class="field-input" id="at-api-key" type="password" placeholder="Autotask API secret key" autocomplete="off" />
        </div>
        <div class="field-group">
          <label class="field-label">Integration Code</label>
          <input class="field-input" id="at-integration-code" type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" autocomplete="off" spellcheck="false" />
          <p class="field-hint">Tracking identifier GUID — Admin &gt; Extensions &amp; Integrations &gt; Other Extensions &amp; Tools &gt; Web Services API.</p>
        </div>
        <div class="field-group">
          <label class="field-label">API Base URL <span class="field-optional">(auto-detected)</span></label>
          <div class="field-row">
            <input class="field-input" id="at-url" type="url" placeholder="Auto-detected on first use" autocomplete="off" spellcheck="false" />
            <button class="btn btn-ghost btn-sm" id="btn-detect-zone">Detect</button>
          </div>
          <p class="field-hint">Leave blank to auto-detect. Click Detect to look it up now.</p>
        </div>
      </div>

      <div class="settings-section">
        <h2 class="section-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          Claude (Anthropic)
        </h2>
        <div class="field-group">
          <label class="field-label">API Key</label>
          <input class="field-input" id="claude-api-key" type="password" placeholder="sk-ant-..." autocomplete="off" />
          <p class="field-hint">Used for Pax8 Invoice Comparison AI analysis. Get your key at console.anthropic.com.</p>
        </div>
      </div>

      <div class="settings-section">
        <h2 class="section-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5L2 4.5v4c0 3.3 2.4 5.5 6 6 3.6-.5 6-2.7 6-6v-4L8 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.5 8l1.5 1.5L10.5 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          BlackPoint / CompassOne
        </h2>
        <div class="field-group">
          <label class="field-label">API Key</label>
          <input class="field-input" id="bp-api-key" type="password" placeholder="bpc_..." autocomplete="off" />
          <p class="field-hint">Used for the BlackPoint Endpoint Usage tool. Find your API key in the CompassOne portal under API settings.</p>
        </div>
      </div>

      <div class="settings-actions">
        <button class="btn btn-primary" id="btn-save-creds">Save Credentials</button>
        <button class="btn btn-ghost" id="btn-clear-creds">Clear All</button>
        <span class="save-status" id="save-status"></span>
      </div>

    </div><!-- /api -->
  `;

  // ── Tab switching ──
  content.querySelectorAll('.stab').forEach(btn => {
    btn.addEventListener('click', () => {
      content.querySelectorAll('.stab').forEach(b => b.classList.remove('active'));
      content.querySelectorAll('.stab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      content.querySelector(`.stab-panel[data-panel="${btn.dataset.tab}"]`).classList.add('active');
    });
  });

  // ── Wire all controls ──
  loadCredentials();
  document.getElementById('btn-save-creds').addEventListener('click', saveCredentials);
  document.getElementById('btn-clear-creds').addEventListener('click', clearCredentials);
  document.getElementById('btn-detect-zone').addEventListener('click', detectZone);
  document.getElementById('btn-open-csv-folder').addEventListener('click', () => window.api.openCsvFolder());
  loadCsvStatus();
  loadMarginSettings();
  document.getElementById('btn-save-margin-settings').addEventListener('click', saveMarginSettings);
  custInit();
  loadPromptTemplateSettings();
  document.getElementById('btn-save-prompt-templates').addEventListener('click', savePromptTemplateSettings);
  document.getElementById('btn-reset-prompt-templates').addEventListener('click', resetPromptTemplateSettings);
  // Kaseya prompt save/reset wired to new dedicated buttons on the prompts tab
  document.getElementById('btn-save-kaseya-prompt').addEventListener('click', savePromptTemplateSettings);
  document.getElementById('btn-reset-kaseya-prompt').addEventListener('click', resetPromptTemplateSettings);
  loadKaseyaSettings();
  document.getElementById('btn-save-kaseya-settings').addEventListener('click', saveKaseyaSettingsUI);
  loadRenewalSettingsUI();
  document.getElementById('btn-save-renewal-eligible').addEventListener('click', saveRenewalSettingsUI);
  document.getElementById('btn-save-renewal-settings').addEventListener('click', saveRenewalSettingsUI);
  loadMscSettingsUI();
  document.getElementById('btn-save-msc-settings').addEventListener('click', saveMscSettingsUI);
  document.getElementById('btn-browse-msc').addEventListener('click', async () => {
    const fp = await window.api.browseMscFile();
    if (fp) document.getElementById('msc-file-path').value = fp;
  });
}

// ─── Customize Tab ────────────────────────────────────────────────────────────
let _custLayout = [];  // working copy of layout being edited
let _custVis    = {};  // working copy of visibility being edited
let _custDragKey     = null;  // tool key being dragged
let _custDragBucket  = null;  // source bucket id ('top' or id string)
let _custDragBktId   = null;  // bucket id being dragged (bucket drag)

async function custInit() {
  const cfg = await window.api.getSidebarConfig();
  _custLayout = JSON.parse(JSON.stringify(cfg.layout));
  _custVis    = { ...cfg.visibility };
  custRender();
  document.getElementById('cust-save').addEventListener('click', custSave);
  document.getElementById('cust-add-group').addEventListener('click', custAddGroup);
}

function custRender() {
  const list = document.getElementById('cust-list');
  if (!list) return;

  let html = '';
  for (let i = 0; i < _custLayout.length; i++) {
    const item = _custLayout[i];
    if (item.type === 'tool') {
      html += custToolRowHtml(item.key, i, 'top');
    } else if (item.type === 'bucket') {
      html += custBucketHtml(item, i);
    }
  }
  // Drop zone at end of top-level list
  html += `<div class="cust-drop-zone" data-zone="end" data-container="top" style="height:32px"></div>`;
  list.innerHTML = html;
  custWireEvents(list);
}

function custToolRowHtml(key, idx, container) {
  const def     = TOOL_DEFS.find(d => d.key === key) || { label: key };
  const checked = _custVis[key] !== false;
  const nested  = container !== 'top';
  return `
    <div class="cust-row${nested ? ' cust-nested' : ''}" draggable="true"
         data-key="${key}" data-idx="${idx}" data-container="${container}">
      <span class="cust-handle" title="Drag to reorder">⠿</span>
      <label class="cust-label">
        <input type="checkbox" data-vis="${key}" ${checked ? 'checked' : ''}
               style="accent-color:var(--accent);cursor:pointer;width:15px;height:15px;flex-shrink:0" />
        <span style="font-size:13px">${def.label}</span>
      </label>
    </div>`;
}

function custBucketHtml(bucket, idx) {
  const tools = (bucket.items || []).map((key, ti) => custToolRowHtml(key, ti, bucket.id)).join('');
  return `
    <div class="cust-group" data-bucket-id="${bucket.id}" data-idx="${idx}">
      <div class="cust-group-header" draggable="true" data-bucket-id="${bucket.id}" data-idx="${idx}">
        <span class="cust-handle" title="Drag to reorder">⠿</span>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style="flex-shrink:0;opacity:.7">
          <path d="M1 4.5C1 3.4 1.9 2.5 3 2.5h2.6l1.4 1.5H11c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2H3c-1.1 0-2-.9-2-2V4.5z" stroke="currentColor" stroke-width="1.3"/>
        </svg>
        <input type="text" class="cust-group-name" value="${escHtml(bucket.name)}"
               data-bucket-id="${bucket.id}"
               placeholder="Group name"
               style="background:transparent;border:none;border-bottom:1px solid var(--border);
                      color:var(--text);font-size:13px;font-weight:600;padding:1px 4px;
                      flex:1;min-width:0;outline:none" />
        <button class="cust-group-del btn-icon" data-bucket-id="${bucket.id}"
                title="Remove group — tools return to main list"
                style="color:var(--text-muted);font-size:14px;padding:0 4px;background:none;border:none;cursor:pointer;line-height:1">✕</button>
      </div>
      <div class="cust-group-body" data-bucket-id="${bucket.id}">
        ${tools}
        <div class="cust-drop-zone" data-zone="bucket-end" data-container="${bucket.id}"
             style="height:28px;display:flex;align-items:center;justify-content:center;
                    font-size:11px;color:var(--text-muted);opacity:.5;pointer-events:all">
          Drop tools here
        </div>
      </div>
    </div>`;
}

function custWireEvents(list) {
  // Visibility checkboxes
  list.querySelectorAll('input[data-vis]').forEach(cb => {
    cb.addEventListener('change', () => { _custVis[cb.dataset.vis] = cb.checked; });
  });

  // Group name live-edit
  list.querySelectorAll('.cust-group-name').forEach(inp => {
    inp.addEventListener('input', () => {
      const b = _custLayout.find(x => x.type === 'bucket' && x.id === inp.dataset.bucketId);
      if (b) b.name = inp.value;
    });
    // Prevent drag propagation from input
    inp.addEventListener('mousedown', e => e.stopPropagation());
  });

  // Delete group — move tools back to top level
  list.querySelectorAll('.cust-group-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const id  = btn.dataset.bucketId;
      const idx = _custLayout.findIndex(x => x.type === 'bucket' && x.id === id);
      if (idx === -1) return;
      const tools = (_custLayout[idx].items || []).map(k => ({ type: 'tool', key: k }));
      _custLayout.splice(idx, 1, ...tools);
      custRender();
    });
  });

  // ── Drag-and-drop ──
  list.querySelectorAll('[draggable="true"]').forEach(el => {
    el.addEventListener('dragstart', e => {
      if (el.classList.contains('cust-row')) {
        _custDragKey    = el.dataset.key;
        _custDragBucket = el.dataset.container;
        _custDragBktId  = null;
      } else if (el.classList.contains('cust-group-header')) {
        _custDragBktId  = el.dataset.bucketId;
        _custDragKey    = null;
        _custDragBucket = null;
      }
      el.classList.add('cust-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.stopPropagation();
    });
    el.addEventListener('dragend', () => {
      list.querySelectorAll('.cust-dragging, .cust-over-top, .cust-over-bottom, .cust-over-bucket')
          .forEach(x => x.classList.remove('cust-dragging','cust-over-top','cust-over-bottom','cust-over-bucket'));
    });
  });

  // Rows: dragover shows top/bottom indicator; drop reorders or moves into group
  list.querySelectorAll('.cust-row').forEach(row => {
    row.addEventListener('dragover', e => {
      e.preventDefault(); e.stopPropagation();
      const rect = row.getBoundingClientRect();
      const half = e.clientY < rect.top + rect.height / 2;
      row.classList.toggle('cust-over-top',    half);
      row.classList.toggle('cust-over-bottom', !half);
    });
    row.addEventListener('dragleave', () => {
      row.classList.remove('cust-over-top', 'cust-over-bottom');
    });
    row.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      row.classList.remove('cust-over-top', 'cust-over-bottom');
      if (!_custDragKey) return;
      const rect     = row.getBoundingClientRect();
      const before   = e.clientY < rect.top + rect.height / 2;
      const targetKey     = row.dataset.key;
      const targetContainer = row.dataset.container;
      custMoveTool(_custDragKey, _custDragBucket, targetKey, targetContainer, before);
      custRender();
    });
  });

  // Group headers: dragover highlights whole group for tool drops
  list.querySelectorAll('.cust-group-header').forEach(hdr => {
    hdr.addEventListener('dragover', e => {
      e.preventDefault(); e.stopPropagation();
      if (_custDragKey) {
        hdr.classList.add('cust-over-bucket');
      } else if (_custDragBktId) {
        // Bucket reorder — show top/bottom on the group container
        const group = hdr.closest('.cust-group');
        const rect  = group.getBoundingClientRect();
        group.classList.toggle('cust-over-top',    e.clientY < rect.top + rect.height / 2);
        group.classList.toggle('cust-over-bottom', e.clientY >= rect.top + rect.height / 2);
      }
    });
    hdr.addEventListener('dragleave', () => {
      hdr.classList.remove('cust-over-bucket');
      hdr.closest('.cust-group')?.classList.remove('cust-over-top','cust-over-bottom');
    });
    hdr.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      hdr.classList.remove('cust-over-bucket');
      const group = hdr.closest('.cust-group');
      group?.classList.remove('cust-over-top','cust-over-bottom');

      if (_custDragKey) {
        // Move tool into this bucket (at the start)
        const bucketId = hdr.dataset.bucketId;
        custRemoveTool(_custDragKey, _custDragBucket);
        const bucket = _custLayout.find(x => x.type === 'bucket' && x.id === bucketId);
        if (bucket) bucket.items.unshift(_custDragKey);
        custRender();
      } else if (_custDragBktId && _custDragBktId !== hdr.dataset.bucketId) {
        // Reorder buckets
        const rect   = group.getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        custMoveBucket(_custDragBktId, hdr.dataset.bucketId, before);
        custRender();
      }
    });
  });

  // Drop zones (end of list, end of bucket body)
  list.querySelectorAll('.cust-drop-zone').forEach(dz => {
    dz.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); dz.classList.add('cust-over-bucket'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('cust-over-bucket'));
    dz.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      dz.classList.remove('cust-over-bucket');
      if (!_custDragKey) return;
      const container = dz.dataset.container;
      custRemoveTool(_custDragKey, _custDragBucket);
      if (container === 'top') {
        _custLayout.push({ type: 'tool', key: _custDragKey });
      } else {
        const bucket = _custLayout.find(x => x.type === 'bucket' && x.id === container);
        if (bucket) bucket.items.push(_custDragKey);
      }
      custRender();
    });
  });
}

function custRemoveTool(key, fromContainer) {
  if (fromContainer === 'top') {
    const i = _custLayout.findIndex(x => x.type === 'tool' && x.key === key);
    if (i !== -1) _custLayout.splice(i, 1);
  } else {
    const bucket = _custLayout.find(x => x.type === 'bucket' && x.id === fromContainer);
    if (bucket) bucket.items = bucket.items.filter(k => k !== key);
  }
}

function custMoveTool(key, fromContainer, targetKey, targetContainer, insertBefore) {
  custRemoveTool(key, fromContainer);
  if (targetContainer === 'top') {
    const ti = _custLayout.findIndex(x => x.type === 'tool' && x.key === targetKey);
    if (ti !== -1) _custLayout.splice(insertBefore ? ti : ti + 1, 0, { type: 'tool', key });
    else           _custLayout.push({ type: 'tool', key });
  } else {
    const bucket = _custLayout.find(x => x.type === 'bucket' && x.id === targetContainer);
    if (bucket) {
      const ti = bucket.items.indexOf(targetKey);
      if (ti !== -1) bucket.items.splice(insertBefore ? ti : ti + 1, 0, key);
      else           bucket.items.push(key);
    }
  }
}

function custMoveBucket(dragId, targetId, insertBefore) {
  const di = _custLayout.findIndex(x => x.type === 'bucket' && x.id === dragId);
  if (di === -1) return;
  const [bucket] = _custLayout.splice(di, 1);
  const ti = _custLayout.findIndex(x => x.type === 'bucket' && x.id === targetId);
  if (ti !== -1) _custLayout.splice(insertBefore ? ti : ti + 1, 0, bucket);
  else           _custLayout.push(bucket);
}

function custAddGroup() {
  const id = `b-${Date.now()}`;
  _custLayout.push({ type: 'bucket', id, name: 'New Group', items: [] });
  custRender();
  // Focus the name input of the new group
  setTimeout(() => {
    const inp = document.querySelector(`.cust-group-name[data-bucket-id="${id}"]`);
    if (inp) { inp.focus(); inp.select(); }
  }, 50);
}

async function custSave() {
  const status = document.getElementById('cust-save-status');
  try {
    const config = { visibility: _custVis, layout: _custLayout };
    await window.api.saveSidebarConfig(config);
    renderSidebar(config);
    status.textContent = '✓ Saved';
    status.className = 'save-status success';
  } catch (e) {
    status.textContent = `Error: ${e.message}`;
    status.className = 'save-status error';
  }
  setTimeout(() => { const el = document.getElementById('cust-save-status'); if (el) { el.textContent = ''; el.className = 'save-status'; } }, 3000);
}

// ─── Prompt Template Settings ─────────────────────────────────────────────────
async function loadPromptTemplateSettings() {
  try {
    const t = await window.api.getPromptTemplates();
    const azEl  = document.getElementById('pt-azure-header');
    const svcEl = document.getElementById('pt-service-header');
    const kasEl = document.getElementById('pt-kaseya-header');
    if (azEl)  azEl.value  = t.azurePromptHeader   || '';
    if (svcEl) svcEl.value = t.servicePromptHeader || '';
    if (kasEl) kasEl.value = t.kaseyaPromptHeader  || '';
  } catch {}
}

async function savePromptTemplateSettings() {
  const status = document.getElementById('pt-save-status');
  try {
    const azEl  = document.getElementById('pt-azure-header');
    const svcEl = document.getElementById('pt-service-header');
    const kasEl = document.getElementById('pt-kaseya-header');
    await window.api.savePromptTemplates({
      azurePromptHeader:   azEl  ? azEl.value  : '',
      servicePromptHeader: svcEl ? svcEl.value : '',
      kaseyaPromptHeader:  kasEl ? kasEl.value : '',
    });
    status.textContent = '✓ Saved'; status.className = 'save-status success';
    setTimeout(() => { if (status) { status.textContent = ''; status.className = 'save-status'; } }, 2500);
  } catch (e) { status.textContent = `Error: ${e.message}`; status.className = 'save-status error'; }
}

async function resetPromptTemplateSettings() {
  const status = document.getElementById('pt-save-status');
  try {
    await window.api.savePromptTemplates({});
    await loadPromptTemplateSettings();
    status.textContent = '✓ Reset to defaults'; status.className = 'save-status success';
    setTimeout(() => { if (status) { status.textContent = ''; status.className = 'save-status'; } }, 2500);
  } catch (e) { status.textContent = `Error: ${e.message}`; status.className = 'save-status error'; }
}

// ─── Kaseya Settings ──────────────────────────────────────────────────────────
async function loadKaseyaSettings() {
  try {
    const s = await window.api.getKaseyaSettings();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    set('ks-psa-strategic',        s.psa?.strategic);
    set('ks-psa-serviceDelivery',  s.psa?.serviceDelivery);
    set('ks-psa-admin',            s.psa?.admin);
    set('ks-psa-coManaged',        s.psa?.coManaged);
    set('ks-rmm-strategic',        s.rmm?.strategic);
    set('ks-rmm-serviceDelivery',  s.rmm?.serviceDelivery);
    set('ks-itGlue-strategic',     s.itGlue?.strategic);
    set('ks-itGlue-serviceDelivery', s.itGlue?.serviceDelivery);
    set('ks-itGlue-admin',         s.itGlue?.admin);
    set('ks-saas-bundledPct',      s.saas?.bundledPct);
    set('ks-dwp-bundledPct',       s.dwp?.bundledPct);
  } catch {}
}

async function saveKaseyaSettingsUI() {
  const status = document.getElementById('ks-save-status');
  try {
    const g = (id) => parseFloat(document.getElementById(id)?.value) || 0;
    const settings = {
      psa:    { strategic: g('ks-psa-strategic'), serviceDelivery: g('ks-psa-serviceDelivery'), admin: g('ks-psa-admin'), coManaged: g('ks-psa-coManaged') },
      rmm:    { strategic: g('ks-rmm-strategic'), serviceDelivery: g('ks-rmm-serviceDelivery') },
      itGlue: { strategic: g('ks-itGlue-strategic'), serviceDelivery: g('ks-itGlue-serviceDelivery'), admin: g('ks-itGlue-admin') },
      saas:   { bundledPct: g('ks-saas-bundledPct') },
      dwp:    { bundledPct: g('ks-dwp-bundledPct') },
    };
    await window.api.saveKaseyaSettings(settings);
    status.textContent = '✓ Saved'; status.className = 'save-status success';
    setTimeout(() => { if (status) { status.textContent = ''; status.className = 'save-status'; } }, 2500);
  } catch (e) { status.textContent = `Error: ${e.message}`; status.className = 'save-status error'; }
}

const CRED_MAP = {
  'pax8-client-id':       'pax8_client_id',
  'pax8-client-secret':   'pax8_client_secret',
  'at-username':          'autotask_username',
  'at-api-key':           'autotask_api_key',
  'at-integration-code':  'autotask_integration_code',
  'at-url':               'autotask_url',
  'claude-api-key':       'claude_api_key',
  'bp-api-key':           'blackpoint_api_key',
};

async function loadCredentials() {
  for (const [elId, key] of Object.entries(CRED_MAP)) {
    try {
      const val = await window.api.getCred(key);
      const el = document.getElementById(elId);
      if (el && val) el.value = val;
    } catch {}
  }
}

async function saveCredentials() {
  const btn = document.getElementById('btn-save-creds');
  const status = document.getElementById('save-status');
  btn.disabled = true;
  try {
    for (const [elId, key] of Object.entries(CRED_MAP)) {
      const val = document.getElementById(elId)?.value?.trim();
      if (val) await window.api.saveCred(key, val);
    }
    status.textContent = '✓ Saved to Windows Credential Manager';
    status.className = 'save-status success';
    setTimeout(() => { if (status) { status.textContent = ''; status.className = 'save-status'; } }, 3500);
  } catch (e) {
    status.textContent = `Error: ${e.message}`;
    status.className = 'save-status error';
  }
  btn.disabled = false;
}

async function clearCredentials() {
  if (!confirm('Clear all saved credentials from Windows Credential Manager?')) return;
  for (const key of Object.values(CRED_MAP)) {
    try { await window.api.deleteCred(key); } catch {}
  }
  Object.keys(CRED_MAP).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const status = document.getElementById('save-status');
  if (status) { status.textContent = 'Credentials cleared.'; status.className = 'save-status'; }
}

async function detectZone() {
  const btn = document.getElementById('btn-detect-zone');
  const urlInput = document.getElementById('at-url');
  const status = document.getElementById('save-status');
  btn.disabled = true;
  btn.textContent = 'Detecting…';
  try {
    const url = await window.api.detectAtZone();
    if (urlInput) urlInput.value = url;
    if (status) { status.textContent = `✓ Zone detected: ${url}`; status.className = 'save-status success'; }
    setTimeout(() => { if (status) { status.textContent = ''; status.className = 'save-status'; } }, 4000);
  } catch (e) {
    if (status) { status.textContent = `Detection failed: ${e.message}`; status.className = 'save-status error'; }
  }
  btn.disabled = false;
  btn.textContent = 'Detect';
}

// ─── Margin Settings ──────────────────────────────────────────────────────────
async function loadMarginSettings() {
  try {
    const s = await window.api.getMarginSettings();
    const azEl  = document.getElementById('margin-azure-contract');
    const dayEl = document.getElementById('margin-schedule-day');
    const enEl  = document.getElementById('margin-schedule-enabled');
    const lrEl  = document.getElementById('margin-last-run');
    const svcEl = document.getElementById('margin-azure-service-id');
    if (azEl)  azEl.value   = s.azureContract  || '';
    if (dayEl) dayEl.value  = s.scheduleDay    || 10;
    if (enEl)  enEl.checked = s.scheduleEnabled !== false;
    if (svcEl) svcEl.value  = s.azureServiceId || 110;
    if (lrEl)  lrEl.textContent = s.lastRun ? `Last scheduled run: ${new Date(s.lastRun).toLocaleString()}` : 'No scheduled run recorded yet.';
  } catch {}
}

async function saveMarginSettings() {
  const btn    = document.getElementById('btn-save-margin-settings');
  const status = document.getElementById('margin-save-status');
  btn.disabled = true;
  try {
    await window.api.saveMarginSettings({
      azureContract:   document.getElementById('margin-azure-contract')?.value?.trim()    || 'Microsoft Azure Cloud Services',
      scheduleDay:     parseInt(document.getElementById('margin-schedule-day')?.value     || '10'),
      scheduleEnabled: document.getElementById('margin-schedule-enabled')?.checked        ?? true,
      azureServiceId:  parseInt(document.getElementById('margin-azure-service-id')?.value || '110'),
    });
    status.textContent = '✓ Saved'; status.className = 'save-status success';
    setTimeout(() => { if (status) { status.textContent = ''; status.className = 'save-status'; } }, 3000);
  } catch (e) { status.textContent = `Error: ${e.message}`; status.className = 'save-status error'; }
  btn.disabled = false;
}

// ─── CSV Status ───────────────────────────────────────────────────────────────
async function loadCsvStatus() {
  const el = document.getElementById('csv-status');
  if (!el) return;
  try {
    const [{ services, clients }, jsonData] = await Promise.all([
      window.api.getCsvStatus(),
      window.api.getMappings().catch(() => null),
    ]);

    const jsonCos  = (jsonData?.companies || []).filter(c => c.accepted && c.atId).length;
    const jsonSvcs = (jsonData?.services  || []).filter(s => s.accepted && s.atServiceId).length;
    const hasJson  = jsonCos > 0 || jsonSvcs > 0;

    const jsonLine = hasJson
      ? `<span style="color:var(--success)">✓ JSON mappings (active): ${jsonCos} companies, ${jsonSvcs} services</span>`
      : `<span style="color:var(--text-muted)">— No JSON mappings yet (run Company Mapping sync)</span>`;

    const svcLine = !hasJson
      ? (services.found
        ? `<span style="color:var(--success)">✓ Fallback CSV — Service mappings: ${services.count} products</span>`
        : `<span style="color:var(--error)">✗ Service mappings CSV not found (<code>Pax8 Autotask Service Mappings.csv</code>)</span>`)
      : '';
    const cliLine = !hasJson
      ? (clients.found
        ? `<span style="color:var(--success)">✓ Fallback CSV — Client mappings: ${clients.count} companies</span>`
        : `<span style="color:var(--error)">✗ Client mappings CSV not found (<code>Pax8 Autotask Client Mapping.csv</code>)</span>`)
      : '';

    el.innerHTML = [jsonLine, svcLine, cliLine].filter(Boolean).join('<br style="margin:4px 0">');
  } catch (e) {
    el.textContent = `Error checking mappings: ${e.message}`;
  }
}

// ─── Invoice Processor ────────────────────────────────────────────────────────
let _invoiceData     = null;
let _invoiceFilePath = null;

function renderInvoiceProcessor() {
  content.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Pax8 Invoice Processor</h1>
        <p class="view-desc">Import a raw Pax8 invoice CSV to generate QBO breakdowns, Azure per-client pricing, one-time charges, service quantities, and an Excel export.</p>
      </div>
      <img class="view-header-deco" src="Anchor_Logo_Vertical_High.png" alt="" draggable="false" />
    </div>

    <div class="settings-section">
      <div class="section-title">Step 1 — Select Invoice</div>
      <p class="field-hint" style="margin-bottom:12px">Load directly from Pax8, or browse for a local CSV export.</p>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <button class="btn btn-primary" id="ip-load-pax8-btn">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style="margin-right:4px"><path d="M6.5 1C3.46 1 1 3.46 1 6.5S3.46 12 6.5 12 12 9.54 12 6.5 9.54 1 6.5 1zm0 2v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          Load from Pax8…
        </button>
        <span style="color:var(--text-muted);font-size:12px">or</span>
        <button class="btn btn-ghost" id="ip-browse-btn">Browse CSV…</button>
        <span id="ip-filename" style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono)"></span>
      </div>
      <div id="ip-invoice-picker" style="display:none;margin-bottom:12px">
        <select id="ip-invoice-select" style="background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:13px;min-width:320px">
          <option value="">— select an invoice —</option>
        </select>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <button class="btn btn-primary" id="ip-process-btn" disabled>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style="margin-right:4px"><path d="M2 2.5l9 4-9 4V2.5z" fill="currentColor"/></svg>
          Process Invoice
        </button>
        <span id="ip-status" class="save-status"></span>
      </div>
    </div>

    <div id="ip-results" style="display:none">
      <!-- Metric strip -->
      <div class="metric-strip" id="ip-metrics" style="margin-bottom:16px"></div>

      <!-- QBO Breakdown -->
      <div class="settings-section">
        <div class="section-title">QBO Breakdown</div>
        <p class="field-hint" style="margin-bottom:10px">Enter these totals into QuickBooks by account.</p>
        <div id="ip-qbo-table"></div>
      </div>

      <!-- Azure per Client -->
      <div class="settings-section">
        <div class="section-title">Azure per Client</div>
        <p class="field-hint" style="margin-bottom:10px">Edit Margin % or Client Price directly. Prices are rounded up to the nearest $5. Set price to $0 to update cost only (e.g. internal accounts).</p>
        <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;align-items:center">
          <button class="btn btn-ghost" id="ip-recalc-btn" style="font-size:12px">Reset to Default</button>
          <button class="btn btn-ghost" id="ip-at-prompt-btn" style="font-size:12px">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="margin-right:3px"><rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M3 4h6M3 6h4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
            Copy Autotask Prompt
          </button>
          <span id="ip-at-copied" style="font-size:11px;color:var(--success);display:none">Copied!</span>
        </div>
        <div id="ip-azure-table" style="overflow-x:auto"></div>
      </div>

      <!-- One-Time Charges -->
      <div class="settings-section" id="ip-onetime-section" style="display:none">
        <div class="section-title">One-Time Charges</div>
        <div id="ip-onetime-table" style="overflow-x:auto"></div>
      </div>

      <!-- Service Quantities -->
      <div class="settings-section" id="ip-services-section" style="display:none">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px">
          <div class="section-title" style="margin-bottom:0">Service Quantities</div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-ghost" id="ip-svc-prompt-btn" style="font-size:12px">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="margin-right:3px"><rect x="1" y="1" width="10" height="10" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M3 4h6M3 6h4" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
              Copy Service Prompt
            </button>
            <span id="ip-svc-copied" style="font-size:11px;color:var(--success);display:none">Copied!</span>
          </div>
        </div>
        <div id="ip-services-tables"></div>
      </div>

      <!-- Export -->
      <div class="settings-section">
        <div class="section-title">Export</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <button class="btn btn-primary" id="ip-export-btn">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style="margin-right:4px"><path d="M1 9V11h11V9M6.5 1v7M3.5 4.5l3-3 3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Export to Excel
          </button>
          <span id="ip-export-status" class="save-status"></span>
        </div>
      </div>
    </div>
  `;

  let _pax8InvoiceList = []; // cached invoice list from Pax8

  // Load from Pax8 button
  document.getElementById('ip-load-pax8-btn').addEventListener('click', async () => {
    const btn = document.getElementById('ip-load-pax8-btn');
    const status = document.getElementById('ip-status');
    btn.disabled = true; btn.textContent = 'Loading…';
    status.textContent = 'Fetching invoices from Pax8…'; status.className = 'save-status';
    try {
      const res = await window.api.fetchPax8InvoiceList();
      if (!res.success) { status.textContent = `Error: ${res.error}`; status.className = 'save-status error'; return; }
      _pax8InvoiceList = res.invoices;
      const sel = document.getElementById('ip-invoice-select');
      sel.innerHTML = '<option value="">— select an invoice —</option>' +
        res.invoices.map(inv => `<option value="${escHtml(inv.id)}" data-date="${escHtml(inv.invoiceDate)}">${escHtml(inv.label)}</option>`).join('');
      document.getElementById('ip-invoice-picker').style.display = '';
      document.getElementById('ip-filename').textContent = '';
      _invoiceFilePath = null;
      sel.addEventListener('change', () => {
        document.getElementById('ip-process-btn').disabled = !sel.value;
      });
      status.textContent = `✓ ${res.invoices.length} invoices loaded`; status.className = 'save-status success';
    } catch(e) { status.textContent = `Error: ${e.message}`; status.className = 'save-status error'; }
    finally { btn.disabled = false; btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" style="margin-right:4px"><path d="M6.5 1C3.46 1 1 3.46 1 6.5S3.46 12 6.5 12 12 9.54 12 6.5 9.54 1 6.5 1zm0 2v3.5l2.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>Load from Pax8…'; }
  });

  // Browse CSV button
  document.getElementById('ip-browse-btn').addEventListener('click', async () => {
    const res = await window.api.browseInvoiceCsv();
    if (res.cancelled) return;
    _invoiceFilePath = res.filePath;
    document.getElementById('ip-filename').textContent = res.filePath.split(/[/\\]/).pop();
    document.getElementById('ip-invoice-picker').style.display = 'none';
    document.getElementById('ip-process-btn').disabled = false;
    document.getElementById('ip-status').textContent = '';
  });

  // Process button
  document.getElementById('ip-process-btn').addEventListener('click', async () => {
    const btn = document.getElementById('ip-process-btn');
    const status = document.getElementById('ip-status');
    btn.disabled = true; status.textContent = 'Processing…'; status.className = 'save-status';
    try {
      let result;
      if (_invoiceFilePath) {
        result = await window.api.processInvoiceCsv({ filePath: _invoiceFilePath, defaultMarginPct: 20 });
      } else {
        const sel = document.getElementById('ip-invoice-select');
        const invoiceId = sel.value;
        const invoiceDate = sel.options[sel.selectedIndex]?.dataset?.date || '';
        result = await window.api.processPax8Invoice({ invoiceId, invoiceDate, defaultMarginPct: 20 });
      }
      if (!result.success) { status.textContent = `Error: ${result.error}`; status.className = 'save-status error'; return; }
      _invoiceData = result;
      status.textContent = `✓ Processed ${result.totalLines} lines — ${result.invoiceDate}`; status.className = 'save-status success';
      saveToolStat('invoice-processor', `${result.totalLines} lines — ${result.invoiceDate || ''}`.trim().replace(/ — $/, ''), 'ok');
      renderInvoiceProcessorResults(result);
    } catch(e) { status.textContent = `Error: ${e.message}`; status.className = 'save-status error'; }
    finally { btn.disabled = false; }
  });

  // Restore previous results if any
  if (_invoiceData) {
    renderInvoiceProcessorResults(_invoiceData);
    const status = document.getElementById('ip-status');
    status.textContent = `✓ ${_invoiceData.totalLines} lines — ${_invoiceData.invoiceDate}`; status.className = 'save-status success';
    document.getElementById('ip-process-btn').disabled = false;
  }
}

function renderInvoiceProcessorResults(data) {
  const resultsEl = document.getElementById('ip-results');
  if (!resultsEl) return;
  resultsEl.style.display = '';

  // Metrics strip
  const metricsEl = document.getElementById('ip-metrics');
  const fmt = (v) => '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  metricsEl.innerHTML = `
    <div class="metric-card"><div class="metric-value">${fmt(data.qbo.total)}</div><div class="metric-label">Total Partner Cost</div></div>
    <div class="metric-card"><div class="metric-value">${fmt(data.qbo.azure)}</div><div class="metric-label">Azure</div></div>
    <div class="metric-card"><div class="metric-value">${fmt(data.qbo.o365)}</div><div class="metric-label">O365</div></div>
    <div class="metric-card"><div class="metric-value">${data.totalLines}</div><div class="metric-label">Total Lines</div></div>
  `;

  // QBO table
  const qboEl = document.getElementById('ip-qbo-table');
  const qboRows = [
    ['Microsoft O365',  'Cost of Services-Recurring Svcs:…:Microsoft Office 365', data.qbo.o365],
    ['Azure',           'Cost of Services-Recurring Svcs:…:Cloud Infrastructure',  data.qbo.azure],
    ['Nerdio',          'Cost of Services-Recurring Svcs:…:Cloud Infrastructure',  data.qbo.nerdio],
    ['Exclaimer',       'Cost of Services-Recurring Svcs:…:Cloud Email Management', data.qbo.exclaimer],
    ['Ironscales',      'Cost of Services-Recurring Svcs:…:Cloud Email Management', data.qbo.ironscales],
    ['Printix',         'Cost of Services-Recurring Svcs:…:Cloud Other',           data.qbo.printix],
    ['Intuit/QBO',      'Cloud IT Platform Tools',                                 data.qbo.intuit],
    ['One-Time',        '(manual)',                                                 data.qbo.oneTime],
  ].filter(r => r[2] > 0);

  const qboHtml = `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:rgba(45,77,107,.75);color:#fff">
          <th style="text-align:left;padding:6px 10px;font-weight:600">Category</th>
          <th style="text-align:left;padding:6px 10px;font-weight:600">QBO Account</th>
          <th style="text-align:right;padding:6px 10px;font-weight:600">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${qboRows.map((r, i) => `
          <tr style="background:${i % 2 === 0 ? 'rgba(255,255,255,.025)' : 'transparent'}">
            <td style="padding:5px 10px;font-weight:500;color:var(--text)">${escHtml(r[0])}</td>
            <td style="padding:5px 10px;color:var(--text-muted);font-family:var(--font-mono);font-size:11px">${escHtml(r[1])}</td>
            <td style="padding:5px 10px;text-align:right;font-family:var(--font-mono);color:var(--text)">${fmt(r[2])}</td>
          </tr>`).join('')}
        <tr style="background:rgba(45,77,107,.2);border-top:2px double var(--border)">
          <td colspan="2" style="padding:6px 10px;font-weight:700;color:var(--text)">TOTAL</td>
          <td style="padding:6px 10px;text-align:right;font-weight:700;font-family:var(--font-mono);color:var(--text)">${fmt(data.qbo.total)}</td>
        </tr>
      </tbody>
    </table>`;
  qboEl.innerHTML = qboHtml;

  // Azure table
  renderAzureTable(data.azure || []);

  // Reset to original computed values
  document.getElementById('ip-recalc-btn').addEventListener('click', () => {
    renderAzureTable(_invoiceData.azure || []);
  });

  // Wire AT prompt copy
  document.getElementById('ip-at-prompt-btn').addEventListener('click', async () => {
    const copiedEl = document.getElementById('ip-at-copied');
    try {
      const updated        = getInvoiceDataWithCurrentMargins();
      const marginSettings = await window.api.getMarginSettings();
      const payload = { ..._invoiceData, azure: updated, azureServiceId: marginSettings.azureServiceId || 110 };
      const res = await window.api.generateAtPrompt(payload);
      await navigator.clipboard.writeText(res.prompt);
      copiedEl.style.display = 'inline';
      setTimeout(() => { copiedEl.style.display = 'none'; }, 2500);
    } catch (e) {
      copiedEl.textContent = `Error: ${e.message}`;
      copiedEl.style.display = 'inline';
      copiedEl.style.color = 'var(--error)';
    }
  });

  // One-time charges
  const oneTimeSection = document.getElementById('ip-onetime-section');
  const oneTimeEl = document.getElementById('ip-onetime-table');
  if ((data.oneTime || []).length > 0) {
    oneTimeSection.style.display = '';
    oneTimeEl.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:rgba(45,77,107,.75);color:#fff">
            <th style="text-align:left;padding:5px 8px;font-weight:600">Company</th>
            <th style="text-align:left;padding:5px 8px;font-weight:600">SKU</th>
            <th style="text-align:left;padding:5px 8px;font-weight:600">Description</th>
            <th style="text-align:right;padding:5px 8px;font-weight:600">Qty</th>
            <th style="text-align:right;padding:5px 8px;font-weight:600">Unit Cost</th>
            <th style="text-align:right;padding:5px 8px;font-weight:600">Total Cost</th>
            <th style="text-align:right;padding:5px 8px;font-weight:600">Unit Price</th>
            <th style="text-align:right;padding:5px 8px;font-weight:600">Total Price</th>
          </tr>
        </thead>
        <tbody>
          ${(data.oneTime || []).map((r, i) => `
            <tr style="background:${i % 2 === 0 ? 'rgba(255,255,255,.025)' : 'transparent'}">
              <td style="padding:4px 8px">${escHtml(r.company)}</td>
              <td style="padding:4px 8px;font-family:var(--font-mono);font-size:11px">${escHtml(r.sku)}</td>
              <td style="padding:4px 8px">${escHtml(r.description)}</td>
              <td style="padding:4px 8px;text-align:right">${r.qty}</td>
              <td style="padding:4px 8px;text-align:right;font-family:var(--font-mono)">${fmt(r.unitCost)}</td>
              <td style="padding:4px 8px;text-align:right;font-family:var(--font-mono)">${fmt(r.costTotal)}</td>
              <td style="padding:4px 8px;text-align:right;font-family:var(--font-mono)">${fmt(r.unitPrice)}</td>
              <td style="padding:4px 8px;text-align:right;font-family:var(--font-mono)">${fmt(r.subtotal)}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
  }

  // Service quantities
  const svcSection = document.getElementById('ip-services-section');
  const svcEl = document.getElementById('ip-services-tables');
  const svcDefs = [
    { key: 'nerdio',     label: 'Nerdio'     },
    { key: 'exclaimer',  label: 'Exclaimer'  },
    { key: 'ironscales', label: 'Ironscales' },
    { key: 'printix',    label: 'Printix'    },
    { key: 'intuit',     label: 'Intuit/QBO' },
  ];
  const svcHtmlParts = [];
  for (const svc of svcDefs) {
    const rows = data[svc.key] || [];
    if (!rows.length) continue;
    svcHtmlParts.push(`
      <div style="margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">${escHtml(svc.label)}</div>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:rgba(45,77,107,.75);color:#fff">
              <th style="text-align:left;padding:5px 10px;font-weight:600">Company</th>
              <th style="text-align:right;padding:5px 10px;font-weight:600">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r, i) => `
              <tr style="background:${i % 2 === 0 ? 'rgba(255,255,255,.025)' : 'transparent'}">
                <td style="padding:4px 10px;color:var(--text)">${escHtml(r.company)}</td>
                <td style="padding:4px 10px;text-align:right;font-family:var(--font-mono);color:var(--text)">${r.qty}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`);
  }
  if (svcHtmlParts.length > 0) {
    svcSection.style.display = '';
    svcEl.innerHTML = svcHtmlParts.join('');
    // Wire service prompt button
    const svcPromptBtn = document.getElementById('ip-svc-prompt-btn');
    if (svcPromptBtn) {
      svcPromptBtn.addEventListener('click', async () => {
        const copiedEl = document.getElementById('ip-svc-copied');
        try {
          const res = await window.api.generateServicePrompt({ ..._invoiceData });
          await navigator.clipboard.writeText(res.prompt);
          copiedEl.style.display = 'inline';
          copiedEl.style.color = 'var(--success)';
          copiedEl.textContent = 'Copied!';
          setTimeout(() => { copiedEl.style.display = 'none'; }, 2500);
        } catch (e) {
          copiedEl.textContent = `Error: ${e.message}`;
          copiedEl.style.display = 'inline';
          copiedEl.style.color = 'var(--error)';
        }
      });
    }
  }

  // Wire export
  document.getElementById('ip-export-btn').addEventListener('click', async () => {
    const btn = document.getElementById('ip-export-btn');
    const status = document.getElementById('ip-export-status');
    btn.disabled = true;
    status.textContent = 'Exporting…';
    status.className = 'save-status';
    try {
      const currentAzure = getInvoiceDataWithCurrentMargins();
      const payload = { ..._invoiceData, azure: currentAzure };
      const res = await window.api.exportInvoiceBreakdown(payload);
      if (res.success) {
        status.textContent = '✓ Exported and opened';
        status.className = 'save-status success';
      } else {
        status.textContent = `Error: ${res.error}`;
        status.className = 'save-status error';
      }
    } catch (e) {
      status.textContent = `Error: ${e.message}`;
      status.className = 'save-status error';
    } finally {
      btn.disabled = false;
      setTimeout(() => { const s = document.getElementById('ip-export-status'); if (s) { s.textContent = ''; s.className = 'save-status'; } }, 5000);
    }
  });
}

function azureMarginColor(mPct) {
  return mPct >= 20 ? '#34d399' : mPct >= 10 ? '#f59e0b' : '#f87171';
}

function renderAzureTable(azureRows) {
  const el = document.getElementById('ip-azure-table');
  if (!el) return;
  const fmt = (v) => '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let totalCost = 0, totalPrice = 0;
  azureRows.forEach(r => { totalCost += r.cost; totalPrice += (r.price || 0); });

  el.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px" id="ip-azure-tbl">
      <thead>
        <tr style="background:rgba(45,77,107,.75);color:#fff">
          <th style="text-align:left;padding:6px 10px;font-weight:600">Company</th>
          <th style="text-align:left;padding:6px 10px;font-weight:600">AT Company</th>
          <th style="text-align:right;padding:6px 10px;font-weight:600">Pax8 Cost</th>
          <th style="text-align:center;padding:6px 10px;font-weight:600">Margin %</th>
          <th style="text-align:right;padding:6px 10px;font-weight:600">Client Price</th>
        </tr>
      </thead>
      <tbody>
        ${azureRows.map((r, i) => {
          const price       = r.price != null ? r.price : (r.marginPct < 100 ? Math.ceil(r.cost / (1 - r.marginPct / 100) / 5) * 5 : r.cost);
          const mColor      = azureMarginColor(r.marginPct);
          const rowBg       = i % 2 === 0 ? 'rgba(255,255,255,.025)' : 'transparent';
          return `
            <tr style="background:${rowBg};border-left:3px solid ${mColor}" data-row="${i}" data-cost="${r.cost}">
              <td style="padding:5px 10px;color:var(--text)">${escHtml(r.company)}</td>
              <td style="padding:5px 10px;color:${r.atCompanyId ? 'var(--text)' : 'var(--text-muted)'}">${escHtml(r.atCompanyName || '(not mapped)')}</td>
              <td style="padding:5px 10px;text-align:right;font-family:var(--font-mono);color:var(--text)">${fmt(r.cost)}</td>
              <td style="padding:5px 10px;text-align:center">
                <input type="number" class="margin-input" value="${r.marginPct}" min="0" max="99" step="0.1"
                  style="width:56px;text-align:center;background:var(--surface-2);color:${mColor};border:1px solid ${mColor}40;border-radius:4px;padding:2px 4px;font-size:12px;font-family:var(--font-mono);font-weight:700" />
              </td>
              <td style="padding:3px 6px;text-align:right">
                <input type="number" class="price-input" value="${price.toFixed(2)}" min="0" step="5"
                  style="width:90px;text-align:right;background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:4px;padding:2px 6px;font-size:12px;font-family:var(--font-mono)" />
              </td>
            </tr>`;
        }).join('')}
      </tbody>
      <tfoot>
        <tr style="background:rgba(45,77,107,.2);font-weight:700;border-top:2px double var(--border);border-left:3px solid transparent">
          <td colspan="2" style="padding:6px 10px;color:var(--text)">TOTALS</td>
          <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);color:var(--text)">${fmt(totalCost)}</td>
          <td></td>
          <td id="ip-az-total-price" style="padding:6px 10px;text-align:right;font-family:var(--font-mono);color:var(--text)">${fmt(totalPrice)}</td>
        </tr>
      </tfoot>
    </table>`;

  // Wire real-time margin ↔ price sync
  el.querySelectorAll('tr[data-row]').forEach(tr => {
    const cost        = parseFloat(tr.dataset.cost) || 0;
    const marginInput = tr.querySelector('.margin-input');
    const priceInput  = tr.querySelector('.price-input');

    marginInput.addEventListener('input', () => {
      const mPct     = parseFloat(marginInput.value) || 0;
      const rawPrice = mPct < 100 ? cost / (1 - mPct / 100) : cost;
      const rounded  = Math.ceil(rawPrice / 5) * 5;
      priceInput.value = rounded.toFixed(2);
      const mc = azureMarginColor(mPct);
      tr.style.borderLeft = `3px solid ${mc}`;
      marginInput.style.color = mc;
      marginInput.style.borderColor = mc + '40';
      refreshAzureTotalPrice(el);
    });

    priceInput.addEventListener('input', () => {
      const price = parseFloat(priceInput.value) || 0;
      const mPct  = price > 0 && cost > 0 ? ((price - cost) / price) * 100 : 0;
      marginInput.value = mPct.toFixed(1);
      const mc = azureMarginColor(mPct);
      tr.style.borderLeft = `3px solid ${mc}`;
      marginInput.style.color = mc;
      marginInput.style.borderColor = mc + '40';
      refreshAzureTotalPrice(el);
    });
  });
}

function refreshAzureTotalPrice(el) {
  let total = 0;
  (el || document.getElementById('ip-azure-table')).querySelectorAll('.price-input').forEach(inp => { total += parseFloat(inp.value) || 0; });
  const cell = document.getElementById('ip-az-total-price');
  if (cell) cell.textContent = '$' + total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getInvoiceDataWithCurrentMargins() {
  if (!_invoiceData) return [];
  const rows = _invoiceData.azure || [];
  const tbl  = document.getElementById('ip-azure-tbl');
  return rows.map((r, i) => {
    const tr          = tbl ? tbl.querySelector(`tr[data-row="${i}"]`) : null;
    const marginInput = tr ? tr.querySelector('.margin-input') : null;
    const priceInput  = tr ? tr.querySelector('.price-input')  : null;
    const mPct  = marginInput ? (parseFloat(marginInput.value) || 0) : r.marginPct;
    const price = priceInput  ? (parseFloat(priceInput.value)  || 0) : (r.price || 0);
    return { ...r, marginPct: mPct, price };
  });
}

// ─── Kaseya Invoice Processor ────────────────────────────────────────────────
let _kaseyaData = null;

function renderKaseyaProcessor() {
  content.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Kaseya Invoice Processor</h1>
        <p class="view-desc">Import a Kaseya invoice XLS file to generate QBO journal entries, module summaries, and client breakdowns. Optionally generate an Autotask prompt for quantity updates.</p>
      </div>
      <img class="view-header-deco" src="Anchor_Logo_Vertical_High.png" alt="" draggable="false" />
    </div>

    <div class="settings-section">
      <div class="section-title">Step 1 — Load Invoice File</div>
      <p class="field-hint" style="margin-bottom:12px">Browse for the Kaseya invoice XLS file downloaded from the Kaseya vendor portal.</p>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <button class="btn btn-primary" id="kp-browse-btn">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style="margin-right:4px"><path d="M2 10V4a1 1 0 011-1h3l1 1h4a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1z" stroke="currentColor" stroke-width="1.3"/></svg>
          Browse XLS…
        </button>
        <span id="kp-filename" style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono)"></span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        <button class="btn btn-primary" id="kp-process-btn" disabled>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style="margin-right:4px"><path d="M2 2.5l9 4-9 4V2.5z" fill="currentColor"/></svg>
          Process Invoice
        </button>
        <span id="kp-status" class="save-status"></span>
      </div>
      <!-- Load previous invoice from snapshot -->
      <div style="display:flex;align-items:center;gap:8px;padding-top:12px;border-top:1px solid var(--border);flex-wrap:wrap">
        <span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap">Load Previous</span>
        <select id="kp-load-prev-sel" class="field-input" style="min-width:240px;max-width:380px">
          <option value="">— select a stored invoice —</option>
        </select>
        <button class="btn btn-ghost btn-sm" id="kp-load-prev-btn" disabled>Load</button>
        <span id="kp-load-prev-status" class="save-status"></span>
      </div>
    </div>

    <div id="kp-results" style="display:none">
      <!-- Metric strip -->
      <div class="metric-strip" id="kp-metrics" style="margin-bottom:16px"></div>

      <!-- Action bar -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn btn-primary" id="kp-export-btn">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style="margin-right:4px"><path d="M1 10v1.5a.5.5 0 00.5.5h10a.5.5 0 00.5-.5V10M6.5 1v8M4 6.5L6.5 9 9 6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Export Excel
        </button>
        <button class="btn btn-ghost" id="kp-at-prompt-btn">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style="margin-right:4px"><rect x="1" y="1" width="11" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M3.5 4.5h6M3.5 6.5h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
          Generate AT Prompt
        </button>
        <span id="kp-export-status" class="save-status"></span>
      </div>

      <!-- QBO Journal Entries — full width -->
      <div class="settings-section wide">
        <div class="section-title">QBO Journal Entries</div>
        <p class="field-hint" style="margin-bottom:10px">Enter these as a journal entry in QuickBooks. Highlighted rows cover items (BCDR, Networking) that need to be reconciled and split per-client separately — the total amount is correct but the per-client allocation is manual.</p>
        <div id="kp-qbo-table" style="overflow-x:auto"></div>
      </div>

      <!-- Summary box: Module left, Category right -->
      <div class="settings-section wide">
        <div class="section-title">Invoice Summary</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:start">
          <div>
            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:8px">By Module</div>
            <div id="kp-module-table"></div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:8px">By Category</div>
            <div id="kp-category-table"></div>
          </div>
        </div>
      </div>

      <!-- AT Prompt -->
      <div class="settings-section wide" id="kp-at-section" style="display:none">
        <div class="section-title" style="display:flex;align-items:center;justify-content:space-between">
          <span>Autotask Update Prompt</span>
          <button class="btn btn-ghost btn-sm" id="kp-at-copy-btn">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="margin-right:3px"><rect x="1" y="3" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M3 3V2a1 1 0 011-1h5a1 1 0 011 1v6a1 1 0 01-1 1h-1" stroke="currentColor" stroke-width="1.2"/></svg>
            Copy
          </button>
        </div>
        <p class="field-hint" style="margin-bottom:10px">Paste this prompt into Claude MCP to update Autotask contract service quantities.</p>
        <textarea id="kp-at-ta" readonly style="width:100%;min-height:260px;font-family:var(--font-mono);font-size:12px;background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:10px 12px;resize:vertical;line-height:1.5;box-sizing:border-box"></textarea>
      </div>
    </div>

    <!-- Delta Comparison — always visible if snapshots exist, outside kp-results -->
    <div class="settings-section wide" id="kp-delta-section" style="display:none">
      <div class="section-title" style="display:flex;align-items:center;justify-content:space-between">
        <span>Invoice Delta Comparison</span>
        <span id="kp-delta-saved-badge" style="font-size:11px;color:var(--success);display:none">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style="margin-right:3px;vertical-align:-1px"><circle cx="5.5" cy="5.5" r="4.5" stroke="currentColor" stroke-width="1.2"/><path d="M3.5 5.5l1.5 1.5 2.5-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Snapshot saved
        </span>
      </div>
      <p class="field-hint" style="margin-bottom:12px">Compare any two stored invoices to see what changed — new clients, dropped clients, cost increases, quantity shifts. Each invoice you process is automatically saved as a snapshot.</p>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        <div style="display:flex;flex-direction:column;gap:4px">
          <label style="font-size:11px;color:var(--text-muted)">Baseline (Month A)</label>
          <select id="kp-delta-a" class="field-input" style="min-width:200px"><option value="">— select month —</option></select>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <label style="font-size:11px;color:var(--text-muted)">Compare (Month B)</label>
          <select id="kp-delta-b" class="field-input" style="min-width:200px"><option value="">— select month —</option></select>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <label style="font-size:11px;color:transparent">run</label>
          <button class="btn btn-primary" id="kp-delta-run-btn">Compare</button>
        </div>
        <span id="kp-delta-status" class="save-status"></span>
      </div>
      <div id="kp-delta-results"></div>
      <div id="kp-delta-manage" style="margin-top:12px;display:none">
        <details style="font-size:12px;color:var(--text-muted)">
          <summary style="cursor:pointer;user-select:none">Manage stored snapshots</summary>
          <div id="kp-delta-snap-list" style="margin-top:8px;display:flex;flex-direction:column;gap:4px"></div>
        </details>
      </div>
    </div>
  `;

  let _filePath = null;

  document.getElementById('kp-browse-btn').addEventListener('click', async () => {
    const result = await window.api.browseKaseyaXls();
    if (!result || !result.filePath) return;
    _filePath = result.filePath;
    document.getElementById('kp-filename').textContent = result.fileName || result.filePath.split(/[\\/]/).pop();
    document.getElementById('kp-process-btn').disabled = false;
  });

  document.getElementById('kp-process-btn').addEventListener('click', async () => {
    const status = document.getElementById('kp-status');
    status.textContent = 'Processing…'; status.className = 'save-status';
    document.getElementById('kp-process-btn').disabled = true;
    try {
      const data = await window.api.processKaseyaXls({ filePath: _filePath });
      if (!data.success) throw new Error(data.error || 'Processing failed');
      _kaseyaData = data;
      renderKaseyaResults(data);
      saveToolStat('kaseya-processor', `${data.clients ? data.clients.length : 0} clients · ${data.totalLines || 0} rows`, 'ok');
      status.textContent = '✓ Done'; status.className = 'save-status success';
    } catch (e) {
      status.textContent = `Error: ${e.message}`; status.className = 'save-status error';
    } finally {
      document.getElementById('kp-process-btn').disabled = false;
    }
  });

  // Populate "Load Previous" dropdown from stored snapshots
  (async () => {
    try {
      const snaps = await window.api.getKaseyaSnapshots();
      const sel = document.getElementById('kp-load-prev-sel');
      const btn = document.getElementById('kp-load-prev-btn');
      if (!sel || !snaps || !snaps.length) return;
      snaps.forEach(s => {
        const label = s.invoiceDate
          ? new Date(s.invoiceDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) + ` — $${(s.grandTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : `${s.key} — $${(s.grandTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        const opt = document.createElement('option');
        opt.value = s.key;
        opt.textContent = label;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => {
        btn.disabled = !sel.value;
      });
      btn.addEventListener('click', async () => {
        const key = sel.value;
        if (!key) return;
        const st = document.getElementById('kp-load-prev-status');
        st.textContent = 'Loading…'; st.className = 'save-status';
        btn.disabled = true;
        try {
          const data = await window.api.loadKaseyaSnapshot(key);
          if (!data.success) throw new Error(data.error || 'Load failed');
          _kaseyaData = data;
          renderKaseyaResults(data);
          saveToolStat('kaseya-processor', `${data.clients ? data.clients.length : 0} clients · ${data.totalLines || 0} rows`, 'ok');
          st.textContent = '✓ Loaded'; st.className = 'save-status success';
          setTimeout(() => { st.textContent = ''; }, 3000);
        } catch (e) {
          st.textContent = `Error: ${e.message}`; st.className = 'save-status error';
        } finally {
          btn.disabled = false;
        }
      });
    } catch (_) { /* non-fatal — snapshots may not exist yet */ }
  })();

  // Load delta section on tool open (show available snapshots even before processing)
  kpLoadDeltaSection(null);
}

function renderKaseyaResults(data) {
  const resultsEl = document.getElementById('kp-results');
  if (!resultsEl) return;
  resultsEl.style.display = '';
  const fmtAmt = v => '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Metric strip
  const metricsEl = document.getElementById('kp-metrics');
  const clientCount = data.clients ? data.clients.length : 0;
  const invoiceDateLabel = data.invoiceDate
    ? new Date(data.invoiceDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
    : '—';
  metricsEl.innerHTML = `
    <div class="metric-card m-orange"><div class="metric-value">${fmtAmt(data.grandTotal)}</div><div class="metric-label">Invoice Total</div></div>
    <div class="metric-card"><div class="metric-value" style="font-size:16px">${invoiceDateLabel}</div><div class="metric-label">Invoice Date</div></div>
    <div class="metric-card"><div class="metric-value">${clientCount}</div><div class="metric-label">Clients</div></div>
  `;

  // Debug info — sheet + columns detected (replace if already exists)
  const existingDebug = document.getElementById('kp-debug-info');
  if (existingDebug) existingDebug.remove();
  if (data.columnsDetected || data.sheetUsed) {
    const cd = data.columnsDetected || {};
    const debugEl = document.createElement('p');
    debugEl.id = 'kp-debug-info';
    debugEl.style.cssText = 'font-size:10px;color:var(--text-muted);font-family:var(--font-mono);margin:0 0 12px;opacity:.7';
    debugEl.textContent = `Sheet: "${data.sheetUsed}" | Company→"${cd.company}" Module→"${cd.module}" Qty→"${cd.qty}" Total→"${cd.total}"`;
    metricsEl.after(debugEl);
  }

  // QBO table
  const qboEl = document.getElementById('kp-qbo-table');
  const entries = data.qboEntries || [];
  if (entries.length === 0) {
    qboEl.innerHTML = '<p class="field-hint">No entries generated.</p>';
  } else {
    const qboTotal = entries.reduce((s, e) => s + e.amount, 0);
    const classPill = cls => {
      const map = {
        'Strategic Services': 'background:rgba(139,92,246,.18);color:#c4b5fd',
        'Service Delivery':   'background:rgba(59,130,246,.18);color:#93c5fd',
        'Admin':              'background:rgba(148,163,184,.15);color:#94a3b8',
      };
      const s = map[cls];
      return s
        ? `<span style="display:inline-block;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:700;${s}">${escHtml(cls)}</span>`
        : `<span style="color:var(--text-muted);font-size:11px">—</span>`;
    };
    const thStyle = 'padding:9px 12px;text-align:left;font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.75);white-space:nowrap';
    qboEl.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead>
          <tr style="background:rgba(45,77,107,.75)">
            <th style="${thStyle}">Description</th>
            <th style="${thStyle}">QBO Account</th>
            <th style="${thStyle}">Class</th>
            <th style="${thStyle};text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${entries.map((e, i) => `
            <tr style="border-top:1px solid rgba(255,255,255,.06);${e.manual ? 'background:rgba(245,197,24,.07)' : i % 2 === 1 ? 'background:rgba(255,255,255,.025)' : ''}">
              <td style="padding:8px 12px">
                ${escHtml(e.description)}
                ${e.manual ? '<span style="margin-left:6px;font-size:10px;font-weight:700;color:#f5c518;background:rgba(245,197,24,.12);padding:1px 6px;border-radius:3px">⚠ reconcile</span>' : ''}
              </td>
              <td style="padding:8px 12px;font-size:11px;font-family:var(--font-mono);color:var(--text-muted)">${escHtml(e.account)}</td>
              <td style="padding:8px 12px">${classPill(e.class || '')}</td>
              <td style="padding:8px 12px;text-align:right;font-family:var(--font-mono);font-weight:600">${fmtAmt(e.amount)}</td>
            </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr style="border-top:2px solid rgba(45,77,107,.6);background:rgba(45,77,107,.2)">
            <td colspan="3" style="padding:9px 12px;font-weight:700">Total</td>
            <td style="padding:9px 12px;text-align:right;font-family:var(--font-mono);font-weight:700">${fmtAmt(qboTotal)}</td>
          </tr>
        </tfoot>
      </table>`;
  }

  // Shared bar-table builder for Module and Category summaries
  const buildBarTable = (rows, gtTotal) => {
    if (!rows.length) return '<p class="field-hint">No data.</p>';
    return `
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <tbody>
          ${rows.map((r, i) => {
            const pct = gtTotal > 0 ? (r.val / gtTotal * 100) : 0;
            return `<tr style="${i > 0 ? 'border-top:1px solid rgba(255,255,255,.04)' : ''}">
              <td style="padding:7px 10px;font-weight:500">${escHtml(r.name)}</td>
              <td style="padding:7px 10px;width:90px">
                <div style="background:rgba(255,255,255,.08);border-radius:3px;height:5px;overflow:hidden">
                  <div style="height:100%;width:${pct.toFixed(1)}%;background:var(--accent);border-radius:3px"></div>
                </div>
              </td>
              <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono);font-size:12px">${fmtAmt(r.val)}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="border-top:2px solid rgba(255,255,255,.1)">
            <td colspan="2" style="padding:8px 10px;font-weight:700;font-size:12px">Total</td>
            <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-weight:700;font-size:12px">${fmtAmt(gtTotal)}</td>
          </tr>
        </tfoot>
      </table>`;
  };

  // Module summary — sorted by total desc
  const modEl = document.getElementById('kp-module-table');
  const mods = data.modules || {};
  const modKeys = Object.keys(mods).sort((a, b) => (mods[b].total || 0) - (mods[a].total || 0));
  const modGT = modKeys.reduce((s, m) => s + (mods[m].total || 0), 0);
  modEl.innerHTML = buildBarTable(modKeys.map(m => ({ name: m, val: mods[m].total || 0 })), modGT);

  // Category summary — sorted by total desc
  const catEl = document.getElementById('kp-category-table');
  if (catEl) {
    const cats = data.categories || {};
    const catKeys = Object.keys(cats).sort((a, b) => (cats[b] || 0) - (cats[a] || 0));
    const catGT = catKeys.reduce((s, k) => s + (cats[k] || 0), 0);
    catEl.innerHTML = buildBarTable(catKeys.map(k => ({ name: k, val: cats[k] || 0 })), catGT);
  }

  // Wire export + AT prompt buttons
  document.getElementById('kp-export-btn').addEventListener('click', async () => {
    if (!_kaseyaData) return;
    const btn = document.getElementById('kp-export-btn');
    const st  = document.getElementById('kp-export-status');
    btn.disabled = true;
    if (st) { st.textContent = 'Exporting…'; st.className = 'save-status'; }
    try {
      const r = await window.api.exportKaseyaReport(_kaseyaData);
      if (r.canceled) { if (st) { st.textContent = ''; } return; }
      if (!r.success) throw new Error(r.error || 'Export failed');
      if (st) { st.textContent = '✓ Saved'; st.className = 'save-status success'; setTimeout(() => { if (st) st.textContent = ''; }, 3000); }
    } catch (e) {
      if (st) { st.textContent = `Error: ${e.message}`; st.className = 'save-status error'; }
      else alert('Export error: ' + e.message);
    } finally { btn.disabled = false; }
  });

  document.getElementById('kp-at-prompt-btn').addEventListener('click', async () => {
    if (!_kaseyaData) return;
    try {
      const r = await window.api.generateKaseyaAtPrompt(_kaseyaData);
      if (!r || !r.prompt) throw new Error('No prompt returned');
      const section = document.getElementById('kp-at-section');
      const ta      = document.getElementById('kp-at-ta');
      if (ta) ta.value = r.prompt;
      if (section) section.style.display = '';
      ta?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { alert('Error: ' + e.message); }
  });

  const atCopyBtn = document.getElementById('kp-at-copy-btn');
  if (atCopyBtn) {
    atCopyBtn.addEventListener('click', async () => {
      const ta = document.getElementById('kp-at-ta');
      if (!ta?.value) return;
      try {
        await navigator.clipboard.writeText(ta.value);
        atCopyBtn.textContent = '✓ Copied';
        setTimeout(() => { atCopyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="margin-right:3px"><rect x="1" y="3" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M3 3V2a1 1 0 011-1h5a1 1 0 011 1v6a1 1 0 01-1 1h-1" stroke="currentColor" stroke-width="1.2"/></svg>Copy'; }, 2000);
      } catch { alert('Copy failed'); }
    });
  }

  // Load delta section after snapshot auto-save has completed
  kpLoadDeltaSection(data.snapKey);
}

async function kpLoadDeltaSection(currentSnapKey) {
  const section = document.getElementById('kp-delta-section');
  const selA    = document.getElementById('kp-delta-a');
  const selB    = document.getElementById('kp-delta-b');
  if (!section || !selA || !selB) return;

  const snaps = await window.api.getKaseyaSnapshots();
  if (!snaps || snaps.length < 1) return;

  // Show section
  section.style.display = '';

  // Show "snapshot saved" badge briefly if we just processed one
  if (currentSnapKey) {
    const badge = document.getElementById('kp-delta-saved-badge');
    if (badge) { badge.style.display = ''; setTimeout(() => { badge.style.display = 'none'; }, 4000); }
  }

  // Populate dropdowns
  const opts = snaps.map(s => {
    const label = s.invoiceDate
      ? new Date(s.invoiceDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
      : s.key;
    const amt = '$' + (s.grandTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `<option value="${escHtml(s.key)}">${escHtml(label)} — ${amt}</option>`;
  }).join('');
  selA.innerHTML = '<option value="">— Baseline month —</option>' + opts;
  selB.innerHTML = '<option value="">— Compare month —</option>' + opts;

  // Auto-select: A = second newest, B = newest (most common use case)
  if (snaps.length >= 2) { selA.value = snaps[1].key; selB.value = snaps[0].key; }
  else if (snaps.length === 1) { selB.value = snaps[0].key; }

  // Compare button
  document.getElementById('kp-delta-run-btn').addEventListener('click', async () => {
    const keyA = selA.value, keyB = selB.value;
    const st = document.getElementById('kp-delta-status');
    if (!keyA || !keyB) { if (st) { st.textContent = 'Select both months.'; st.className = 'save-status error'; } return; }
    if (keyA === keyB) { if (st) { st.textContent = 'Select two different months.'; st.className = 'save-status error'; } return; }
    if (st) { st.textContent = 'Comparing…'; st.className = 'save-status'; }
    try {
      const result = await window.api.compareKaseyaSnapshots({ keyA, keyB });
      if (result.error) throw new Error(result.error);
      kpRenderDelta(result, snaps);
      if (st) { st.textContent = ''; }
    } catch (e) {
      if (st) { st.textContent = `Error: ${e.message}`; st.className = 'save-status error'; }
    }
  });

  // Snapshot manager
  const mgr = document.getElementById('kp-delta-manage');
  const lst = document.getElementById('kp-delta-snap-list');
  if (mgr && lst && snaps.length > 0) {
    mgr.style.display = '';
    lst.innerHTML = snaps.map(s => {
      const label = s.invoiceDate
        ? new Date(s.invoiceDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
        : s.key;
      const saved = s.savedAt ? new Date(s.savedAt).toLocaleDateString() : '?';
      return `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:4px 8px;background:var(--surface-2);border-radius:4px">
        <span>${escHtml(label)} <span style="color:var(--text-muted);font-size:10px">(saved ${saved})</span></span>
        <button class="btn btn-ghost btn-sm kp-del-snap" data-key="${escHtml(s.key)}" style="padding:2px 8px;font-size:11px">Delete</button>
      </div>`;
    }).join('');
    lst.querySelectorAll('.kp-del-snap').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Delete snapshot for ${btn.dataset.key}?`)) return;
        await window.api.deleteKaseyaSnapshot(btn.dataset.key);
        await kpLoadDeltaSection(null); // reload
      });
    });
  }
}

function kpRenderDelta(d, snaps) {
  const el = document.getElementById('kp-delta-results');
  if (!el) return;

  const fmtAmt = v => '$' + Math.abs(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtSgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + fmtAmt(v);
  const pctStr = p => p != null ? (p > 0 ? '+' : '') + p + '%' : '—';
  const snapLabel = key => {
    const s = snaps.find(x => x.key === key);
    if (!s || !s.invoiceDate) return key;
    return new Date(s.invoiceDate + 'T12:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  };

  const statusBadge = s => {
    const map = { new: ['var(--success)', 'NEW'], dropped: ['var(--error)', 'GONE'], up: ['var(--warn)', '↑'], down: ['#4caf97', '↓'], same: ['var(--text-muted)', '–'] };
    const [color, label] = map[s] || ['var(--text-muted)', '?'];
    return `<span style="font-size:10px;font-weight:700;color:${color};font-family:var(--font-mono)">${label}</span>`;
  };
  const deltaColor = v => v > 0 ? 'var(--warn)' : v < 0 ? '#4caf97' : 'var(--text-muted)';

  // Grand total banner
  const gt = d.grandTotal;
  const gtColor = deltaColor(gt.delta);
  const cardBase = 'background:var(--surface-2);border-radius:var(--radius);padding:18px 22px;display:flex;flex-direction:column;align-items:center;gap:6px;border:1px solid var(--border)';
  let html = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px">
      <div style="${cardBase};border-left:4px solid #5b8dd9">
        <div class="metric-value">$${gt.a.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div class="metric-label">${escHtml(snapLabel(d.keyA))}</div>
      </div>
      <div style="${cardBase};border-left:4px solid #34d399">
        <div class="metric-value">$${gt.b.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div class="metric-label">${escHtml(snapLabel(d.keyB))}</div>
      </div>
      <div style="${cardBase};border-left:4px solid ${gtColor}">
        <div class="metric-value" style="color:${gtColor}">${fmtSgn(gt.delta)}</div>
        <div class="metric-label">Change (${pctStr(gt.pct)})</div>
      </div>
    </div>`;

  // Module deltas
  if (d.modules && d.modules.length > 0) {
    html += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;align-items:start">`;

    // Modules table
    html += `<div>
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:8px">Module Changes</div>
      <table class="data-table">
        <thead><tr><th></th><th>Module</th><th style="text-align:right">${escHtml(snapLabel(d.keyA))}</th><th style="text-align:right">${escHtml(snapLabel(d.keyB))}</th><th style="text-align:right">Δ</th></tr></thead>
        <tbody>
          ${d.modules.map(m => `<tr>
            <td style="width:28px">${statusBadge(m.status)}</td>
            <td>${escHtml(m.name)}</td>
            <td style="text-align:right;font-family:var(--font-mono)">${m.a ? fmtAmt(m.a) : '—'}</td>
            <td style="text-align:right;font-family:var(--font-mono)">${m.b ? fmtAmt(m.b) : '—'}</td>
            <td style="text-align:right;font-family:var(--font-mono);color:${deltaColor(m.delta)}">${fmtSgn(m.delta)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

    // Category deltas
    if (d.categories && d.categories.length > 0) {
      html += `<div>
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:8px">Category Changes</div>
        <table class="data-table">
          <thead><tr><th></th><th>Category</th><th style="text-align:right">${escHtml(snapLabel(d.keyA))}</th><th style="text-align:right">${escHtml(snapLabel(d.keyB))}</th><th style="text-align:right">Δ</th></tr></thead>
          <tbody>
            ${d.categories.map(c => `<tr>
              <td style="width:28px">${statusBadge(c.status)}</td>
              <td>${escHtml(c.name)}</td>
              <td style="text-align:right;font-family:var(--font-mono)">${c.a ? fmtAmt(c.a) : '—'}</td>
              <td style="text-align:right;font-family:var(--font-mono)">${c.b ? fmtAmt(c.b) : '—'}</td>
              <td style="text-align:right;font-family:var(--font-mono);color:${deltaColor(c.delta)}">${fmtSgn(c.delta)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    }
    html += `</div>`; // close grid
  }

  // Client deltas
  if (d.clients && d.clients.length > 0) {
    html += `
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:8px">
        Client Changes <span style="font-weight:400;text-transform:none;letter-spacing:0">(${d.clients.length} changed)</span>
      </div>
      <table class="data-table" id="kp-delta-client-tbl">
        <thead><tr>
          <th style="width:28px"></th>
          <th>Client</th>
          <th style="text-align:right">${escHtml(snapLabel(d.keyA))}</th>
          <th style="text-align:right">${escHtml(snapLabel(d.keyB))}</th>
          <th style="text-align:right">Δ Amount</th>
          <th style="text-align:right">Δ %</th>
          <th style="width:28px"></th>
        </tr></thead>
        <tbody>
          ${d.clients.map((c, i) => {
            const hasMods = c.modDeltas && c.modDeltas.length > 0;
            const detailId = `kp-dc-${i}`;
            return `<tr class="kp-delta-client-row" data-detail="${detailId}" style="cursor:${hasMods ? 'pointer' : 'default'}">
              <td>${statusBadge(c.status)}</td>
              <td>${escHtml(c.name)}</td>
              <td style="text-align:right;font-family:var(--font-mono)">${c.a ? fmtAmt(c.a) : '—'}</td>
              <td style="text-align:right;font-family:var(--font-mono)">${c.b ? fmtAmt(c.b) : '—'}</td>
              <td style="text-align:right;font-family:var(--font-mono);color:${deltaColor(c.delta)}">${fmtSgn(c.delta)}</td>
              <td style="text-align:right;font-family:var(--font-mono);color:${deltaColor(c.delta)}">${pctStr(c.pct)}</td>
              <td style="text-align:center;color:var(--text-muted);font-size:11px">${hasMods ? '▶' : ''}</td>
            </tr>
            ${hasMods ? `<tr id="${detailId}" style="display:none;background:var(--surface-2)">
              <td colspan="7" style="padding:8px 12px 8px 36px">
                <table style="width:100%;border-collapse:collapse;font-size:12px">
                  <thead><tr>
                    <th style="text-align:left;padding:3px 8px;color:var(--text-muted);font-weight:500">Module</th>
                    <th style="text-align:right;padding:3px 8px;color:var(--text-muted);font-weight:500">Qty A→B</th>
                    <th style="text-align:right;padding:3px 8px;color:var(--text-muted);font-weight:500">Amount A</th>
                    <th style="text-align:right;padding:3px 8px;color:var(--text-muted);font-weight:500">Amount B</th>
                    <th style="text-align:right;padding:3px 8px;color:var(--text-muted);font-weight:500">Δ</th>
                  </tr></thead>
                  <tbody>
                    ${c.modDeltas.map(m => `<tr>
                      <td style="padding:3px 8px">${escHtml(m.name)}</td>
                      <td style="text-align:right;padding:3px 8px;font-family:var(--font-mono)">${m.aQty || '—'} → ${m.bQty || '—'}</td>
                      <td style="text-align:right;padding:3px 8px;font-family:var(--font-mono)">${m.aAmt ? fmtAmt(m.aAmt) : '—'}</td>
                      <td style="text-align:right;padding:3px 8px;font-family:var(--font-mono)">${m.bAmt ? fmtAmt(m.bAmt) : '—'}</td>
                      <td style="text-align:right;padding:3px 8px;font-family:var(--font-mono);color:${deltaColor(m.deltaAmt)}">${fmtSgn(m.deltaAmt)}</td>
                    </tr>`).join('')}
                  </tbody>
                </table>
              </td>
            </tr>` : ''}`;
          }).join('')}
        </tbody>
      </table>`;
  }

  if (!d.modules?.length && !d.clients?.length) {
    html += `<p class="field-hint" style="margin-top:8px">No differences found between the two selected months.</p>`;
  }

  el.innerHTML = html;

  // Wire expand/collapse on client rows
  el.querySelectorAll('.kp-delta-client-row').forEach(row => {
    const detailId = row.dataset.detail;
    const detail = document.getElementById(detailId);
    if (!detail) return;
    const arrow = row.querySelector('td:last-child');
    row.addEventListener('click', () => {
      const open = detail.style.display !== 'none';
      detail.style.display = open ? 'none' : '';
      if (arrow) arrow.textContent = open ? '▶' : '▼';
    });
  });
}

// ─── Autotask Contract Changes ─────────────────────────────────────────────────────────
let _ccData = null; // raw rows from last successful run

function ccTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Project Time Summary ─────────────────────────────────────────────────────
let _ptsData     = null;
let _ptsExcluded = new Set();  // project IDs unchecked from HTML export
let _ptsSortKey  = 'accountName';
let _ptsSortDir  = 1;

function renderProjectTimeSummary() {
  content.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Project Time Summary</h1>
        <p class="view-desc">Pulls active Professional Services projects from Autotask, shows hours worked vs. estimated, and flags projects at risk — then exports a report you can email directly from the app.</p>
      </div>
      <img class="view-header-deco" src="Anchor_Logo_Vertical_High.png" alt="" draggable="false" />
    </div>

    <div class="settings-section wide">
      <h2 class="section-title">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2l9 5-9 5V2z" fill="currentColor"/></svg>
        Run Report
      </h2>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <button class="btn btn-primary" id="pts-run-btn">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2l9 5-9 5V2z" fill="currentColor"/></svg>
          Fetch Projects
        </button>
        <span class="audit-status-text" id="pts-status"></span>
      </div>
    </div>

    <div id="pts-results" style="display:none">
      <!-- Metric cards -->
      <div id="pts-metrics" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px"></div>

      <!-- Action bar -->
      <div class="settings-section wide" style="padding:12px 18px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <span style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;margin-right:4px">Export</span>
          <button class="btn btn-ghost" id="pts-export-btn" style="font-size:12px">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v9M3.5 7l3.5 3.5L10.5 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M1 12h12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
            Save HTML Report
          </button>
          <button class="btn btn-primary" id="pts-email-btn" style="font-size:12px">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M1 4l6 4 6-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            Email Report
          </button>
          <span class="save-status" id="pts-action-status" style="margin-left:4px"></span>
        </div>
      </div>

      <!-- Results table -->
      <div class="settings-section wide" style="padding:0;overflow:hidden">
        <div id="pts-table-wrap" style="overflow-x:auto"></div>
      </div>

      <!-- Key -->
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;margin-bottom:4px">
        <div style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text-muted)">
          <div style="width:24px;height:13px;background:rgba(255,193,7,.25);border:1px solid rgba(255,193,7,.5);border-radius:2px"></div>
          Worked hours ≥ 50% of estimated
        </div>
        <div style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text-muted)">
          <div style="width:24px;height:13px;background:rgba(239,68,68,.2);border:1px solid rgba(239,68,68,.4);border-radius:2px"></div>
          Worked hours exceed estimated
        </div>
        <div style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--text-muted)">
          <div style="width:24px;height:13px;background:rgba(100,200,120,.15);border:1px solid rgba(100,200,120,.35);border-radius:2px"></div>
          Active in last 7 days
        </div>
      </div>
    </div>

    <!-- Settings row: Email + Exclusions side by side -->
    <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;margin-top:8px">

      <div class="settings-section" id="pts-email-settings" style="flex:1;min-width:300px;max-width:480px">
        <h2 class="section-title">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="12" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M1 4l6 4 6-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          Email Settings
        </h2>
        <div class="field-group">
          <label class="field-label">To (email address)</label>
          <input class="field-input" id="pts-email-to" type="email" placeholder="manager@company.com" />
        </div>
        <div class="field-group" style="margin-top:10px">
          <label class="field-label">Subject</label>
          <input class="field-input" id="pts-email-subject" type="text" placeholder="Project Time Summary Report" />
        </div>
        <div class="field-group" style="margin-top:10px">
          <label class="field-label">Body</label>
          <textarea class="field-input" id="pts-email-body" rows="4" style="resize:vertical;font-family:var(--font-mono);font-size:12px"></textarea>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:12px">
          <button class="btn btn-ghost" id="pts-save-settings-btn" style="font-size:12px">Save Settings</button>
          <span class="save-status" id="pts-settings-status"></span>
        </div>
      </div>

      <div class="settings-section" style="flex:1;min-width:240px;max-width:340px">
        <h2 class="section-title">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M4.5 7l1.5 1.5L9.5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Always Exclude Projects
        </h2>
        <p class="field-hint" style="margin-bottom:10px">Project numbers to permanently hide from the GUI and all reports. One per line or comma-separated. Re-fetch after saving.</p>
        <div class="field-group">
          <label class="field-label">Project Numbers</label>
          <textarea class="field-input" id="pts-exclude-nums" rows="5"
            style="resize:vertical;font-family:var(--font-mono);font-size:12px"
            placeholder="P20260101.0001&#10;P20260102.0002"></textarea>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:12px">
          <button class="btn btn-ghost" id="pts-save-exclude-btn" style="font-size:12px">Save &amp; Re-fetch</button>
          <span class="save-status" id="pts-exclude-status"></span>
        </div>
      </div>

      <div class="settings-section" style="flex:1;min-width:260px;max-width:400px">
        <h2 class="section-title">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 3h12M3 7h8M5 11h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
          Project Filters
        </h2>
        <p class="field-hint" style="margin-bottom:10px">Controls which projects are fetched from Autotask. Match these exactly to your Autotask status/department/type labels.</p>
        <div class="field-group">
          <label class="field-label">Exclude Statuses <span class="field-hint" style="font-weight:400">(one per line, exact label)</span></label>
          <textarea class="field-input" id="pts-exclude-statuses" rows="6"
            style="resize:vertical;font-family:var(--font-mono);font-size:12px"
            placeholder="Complete&#10;Canceled&#10;Inactive"></textarea>
        </div>
        <div class="field-group" style="margin-top:10px">
          <label class="field-label">Department Filter <span class="field-hint" style="font-weight:400">(leave blank = all departments)</span></label>
          <input class="field-input" id="pts-dept-filter" type="text" placeholder="Professional Services" />
        </div>
        <div class="field-group" style="margin-top:10px">
          <label class="field-label">Project Type Filter <span class="field-hint" style="font-weight:400">(leave blank = all types)</span></label>
          <input class="field-input" id="pts-type-filter" type="text" placeholder="Client" />
        </div>
        <div style="border-top:1px solid var(--border);margin-top:14px;padding-top:12px">
          <p class="field-hint" style="margin-bottom:8px"><strong>Read-only API account?</strong> If filters don't apply, click "Resolve IDs" to look up numeric IDs once and save them as overrides. These bypass the admin-only Departments endpoint.</p>
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
            <button class="btn btn-ghost" id="pts-resolve-ids-btn" style="font-size:12px">Resolve IDs</button>
            <span class="save-status" id="pts-resolve-status"></span>
          </div>
          <div class="field-group">
            <label class="field-label">Department ID <span class="field-hint" style="font-weight:400">(overrides name lookup)</span></label>
            <input class="field-input" id="pts-dept-id" type="text" placeholder="e.g. 29" style="font-family:var(--font-mono);font-size:12px" />
          </div>
          <div class="field-group" style="margin-top:8px">
            <label class="field-label">Project Type ID <span class="field-hint" style="font-weight:400">(overrides type label lookup)</span></label>
            <input class="field-input" id="pts-type-id" type="text" placeholder="e.g. 5" style="font-family:var(--font-mono);font-size:12px" />
          </div>
          <div class="field-group" style="margin-top:8px">
            <label class="field-label">Status IDs to Exclude <span class="field-hint" style="font-weight:400">(comma-separated, overrides labels)</span></label>
            <input class="field-input" id="pts-status-ids" type="text" placeholder="e.g. 5,8,12,14" style="font-family:var(--font-mono);font-size:12px" />
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:12px">
          <button class="btn btn-ghost" id="pts-save-filters-btn" style="font-size:12px">Save Filters</button>
          <span class="save-status" id="pts-filters-status"></span>
        </div>
      </div>

    </div>
  `;

  // Load saved email settings
  (async () => {
    try {
      const s = await window.api.getProjectReportSettings();
      document.getElementById('pts-email-to').value          = s.emailTo               || '';
      document.getElementById('pts-email-subject').value     = s.emailSubject          || '';
      document.getElementById('pts-email-body').value        = s.emailBody             || '';
      document.getElementById('pts-exclude-nums').value      = s.excludeProjectNumbers || '';
      document.getElementById('pts-exclude-statuses').value  = s.excludeStatuses       || '';
      document.getElementById('pts-dept-filter').value       = s.departmentFilter      || '';
      document.getElementById('pts-type-filter').value       = s.projectTypeFilter     || '';
      document.getElementById('pts-dept-id').value           = s.departmentId          || '';
      document.getElementById('pts-type-id').value           = s.projectTypeId         || '';
      document.getElementById('pts-status-ids').value        = s.statusIds             || '';
    } catch {}
  })();

  // Restore previous results if any
  if (_ptsData) {
    ptsRenderResults(_ptsData);
    document.getElementById('pts-status').textContent = `✓ ${_ptsData.length} project${_ptsData.length !== 1 ? 's' : ''} loaded`;
    document.getElementById('pts-status').className = 'audit-status-text success';
  }

  // Run button
  document.getElementById('pts-run-btn').addEventListener('click', async () => {
    const btn    = document.getElementById('pts-run-btn');
    const status = document.getElementById('pts-status');
    btn.disabled = true;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="animation:spin 1s linear infinite"><path d="M7 1a6 6 0 1 1-4.24 1.76" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Fetching…`;
    status.textContent = 'Pulling projects and time entries from Autotask…';
    status.className = 'audit-status-text';
    try {
      const res = await window.api.runProjectTimeSummary();
      if (!res.success) throw new Error(res.error || 'Unknown error');
      _ptsData = res.projects;
      ptsRenderResults(res.projects);
      status.textContent = `✓ ${res.projects.length} project${res.projects.length !== 1 ? 's' : ''} loaded`;
      status.className = 'audit-status-text success';
    } catch (e) {
      status.textContent = `Error: ${e.message}`;
      status.className = 'audit-status-text error';
    } finally {
      btn.disabled = false;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 2l9 5-9 5V2z" fill="currentColor"/></svg> Fetch Projects`;
    }
  });

  // Export HTML
  document.getElementById('pts-export-btn').addEventListener('click', async () => {
    if (!_ptsData) return;
    const actionStatus = document.getElementById('pts-action-status');
    actionStatus.textContent = 'Saving…';
    actionStatus.className = 'save-status';
    try {
      const visible = _ptsData.filter(p => !_ptsExcluded.has(p.id));
      const res = await window.api.exportProjectReport({ projects: visible });
      if (res.success) {
        actionStatus.textContent = `✓ Saved to Downloads (${visible.length} project${visible.length !== 1 ? 's' : ''})`;
        actionStatus.className = 'save-status success';
      } else throw new Error(res.error);
    } catch (e) {
      actionStatus.textContent = `Error: ${e.message}`;
      actionStatus.className = 'save-status error';
    }
    setTimeout(() => { const el = document.getElementById('pts-action-status'); if (el) { el.textContent = ''; el.className = 'save-status'; } }, 5000);
  });

  // Email Report — opens default mail app, saves HTML to Downloads
  document.getElementById('pts-email-btn').addEventListener('click', async () => {
    if (!_ptsData) return;
    const actionStatus = document.getElementById('pts-action-status');
    actionStatus.textContent = 'Saving report…';
    actionStatus.className = 'save-status';
    try {
      const visible = _ptsData.filter(p => !_ptsExcluded.has(p.id));
      const res = await window.api.emailProjectReport({ projects: visible });
      if (res.success) {
        actionStatus.textContent = '✓ Compose window opened + report highlighted in Explorer — drag it in to attach';
        actionStatus.className = 'save-status success';
      } else throw new Error(res.error);
    } catch (e) {
      actionStatus.textContent = `Error: ${e.message}`;
      actionStatus.className = 'save-status error';
    }
    setTimeout(() => { const el = document.getElementById('pts-action-status'); if (el) { el.textContent = ''; el.className = 'save-status'; } }, 7000);
  });

  const ptsSaveAllSettings = () => ({
    emailTo:               document.getElementById('pts-email-to').value.trim(),
    emailSubject:          document.getElementById('pts-email-subject').value.trim(),
    emailBody:             document.getElementById('pts-email-body').value,
    excludeProjectNumbers: document.getElementById('pts-exclude-nums').value.trim(),
    excludeStatuses:       document.getElementById('pts-exclude-statuses').value.trim(),
    departmentFilter:      document.getElementById('pts-dept-filter').value.trim(),
    projectTypeFilter:     document.getElementById('pts-type-filter').value.trim(),
    departmentId:          document.getElementById('pts-dept-id').value.trim(),
    projectTypeId:         document.getElementById('pts-type-id').value.trim(),
    statusIds:             document.getElementById('pts-status-ids').value.trim(),
  });

  // Save email settings
  document.getElementById('pts-save-settings-btn').addEventListener('click', async () => {
    const settingsStatus = document.getElementById('pts-settings-status');
    try {
      await window.api.saveProjectReportSettings(ptsSaveAllSettings());
      settingsStatus.textContent = '✓ Saved';
      settingsStatus.className = 'save-status success';
    } catch (e) {
      settingsStatus.textContent = `Error: ${e.message}`;
      settingsStatus.className = 'save-status error';
    }
    setTimeout(() => { const el = document.getElementById('pts-settings-status'); if (el) { el.textContent = ''; el.className = 'save-status'; } }, 3000);
  });

  // Save exclude list + re-fetch
  document.getElementById('pts-save-exclude-btn').addEventListener('click', async () => {
    const excludeStatus = document.getElementById('pts-exclude-status');
    try {
      await window.api.saveProjectReportSettings(ptsSaveAllSettings());
      excludeStatus.textContent = '✓ Saved — re-fetching…';
      excludeStatus.className = 'save-status success';
      document.getElementById('pts-run-btn').click();
    } catch (e) {
      excludeStatus.textContent = `Error: ${e.message}`;
      excludeStatus.className = 'save-status error';
    }
    setTimeout(() => { const el = document.getElementById('pts-exclude-status'); if (el) { el.textContent = ''; el.className = 'save-status'; } }, 5000);
  });

  // Resolve IDs button — looks up numeric Autotask IDs and fills the override fields
  document.getElementById('pts-resolve-ids-btn').addEventListener('click', async () => {
    const btn    = document.getElementById('pts-resolve-ids-btn');
    const status = document.getElementById('pts-resolve-status');
    btn.disabled = true;
    status.textContent = 'Resolving…';
    status.className = 'save-status';
    try {
      const deptName     = document.getElementById('pts-dept-filter').value.trim();
      const typeLabel    = document.getElementById('pts-type-filter').value.trim();
      const statusLabels = document.getElementById('pts-exclude-statuses').value
        .split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
      const ids = await window.api.resolvePtsIds({ deptName, typeLabel, statusLabels });
      if (ids.departmentId)  document.getElementById('pts-dept-id').value    = ids.departmentId;
      if (ids.projectTypeId) document.getElementById('pts-type-id').value    = ids.projectTypeId;
      if (ids.statusIds)     document.getElementById('pts-status-ids').value = ids.statusIds;
      const found = [ids.departmentId && 'Dept', ids.projectTypeId && 'Type', ids.statusIds && 'Statuses'].filter(Boolean);
      status.textContent = found.length ? `✓ Found: ${found.join(', ')} — click Save Filters` : 'No IDs resolved (check API permissions)';
      status.className = found.length ? 'save-status success' : 'save-status error';
    } catch (e) {
      status.textContent = `Error: ${e.message}`;
      status.className = 'save-status error';
    }
    btn.disabled = false;
    setTimeout(() => { const el = document.getElementById('pts-resolve-status'); if (el) { el.textContent = ''; el.className = 'save-status'; } }, 6000);
  });

  // Save project filters
  document.getElementById('pts-save-filters-btn').addEventListener('click', async () => {
    const filtersStatus = document.getElementById('pts-filters-status');
    try {
      await window.api.saveProjectReportSettings(ptsSaveAllSettings());
      filtersStatus.textContent = '✓ Saved — re-fetch to apply';
      filtersStatus.className = 'save-status success';
    } catch (e) {
      filtersStatus.textContent = `Error: ${e.message}`;
      filtersStatus.className = 'save-status error';
    }
    setTimeout(() => { const el = document.getElementById('pts-filters-status'); if (el) { el.textContent = ''; el.className = 'save-status'; } }, 3000);
  });
}

const PTS_COLS = [
  { key: 'accountName',      label: 'Account Name',   align: 'left',  num: false },
  { key: 'projectName',      label: 'Project Name',   align: 'left',  num: false },
  { key: 'contractName',     label: 'Contract Name',  align: 'left',  num: false },
  { key: 'projectNumber',    label: 'Project #',      align: 'left',  num: false },
  { key: 'projectLead',      label: 'Project Lead',  align: 'left',  num: false },
  { key: 'estimatedHours',   label: 'Est. Hours',    align: 'right', num: true  },
  { key: 'workedHours',      label: 'Worked Hours',  align: 'right', num: true  },
  { key: 'billableHours',    label: 'Billable',      align: 'right', num: true  },
  { key: 'nonBillableHours', label: 'Non-Billable',  align: 'right', num: true  },
  { key: 'last7Hours',       label: 'Last 7 Days',   align: 'right', num: true  },
];

function ptsSortBy(key) {
  if (_ptsSortKey === key) {
    _ptsSortDir = -_ptsSortDir;
  } else {
    _ptsSortKey = key;
    _ptsSortDir = 1;
  }
  if (_ptsData) ptsRenderTable(_ptsData);
}

function ptsRenderResults(projects) {
  const resultsEl = document.getElementById('pts-results');
  if (!resultsEl) return;
  resultsEl.style.display = '';

  // Metric cards
  const over   = projects.filter(p => p.estimatedHours > 0 && p.workedHours > p.estimatedHours).length;
  const atRisk = projects.filter(p => p.estimatedHours > 0 && p.workedHours <= p.estimatedHours && p.workedHours / p.estimatedHours >= 0.5).length;
  const recent = projects.filter(p => p.last7Hours > 0).length;
  const metricsEl = document.getElementById('pts-metrics');
  metricsEl.innerHTML = `
    <div class="metric-card"><div class="metric-value">${projects.length}</div><div class="metric-label">Active Projects</div></div>
    <div class="metric-card" style="${over > 0 ? 'border-top:3px solid var(--error)' : ''}">
      <div class="metric-value" style="${over > 0 ? 'color:var(--error)' : ''}">${over}</div>
      <div class="metric-label">Over Budget</div>
    </div>
    <div class="metric-card" style="${atRisk > 0 ? 'border-top:3px solid var(--warn)' : ''}">
      <div class="metric-value" style="${atRisk > 0 ? 'color:var(--warn)' : ''}">${atRisk}</div>
      <div class="metric-label">At Risk (≥50%)</div>
    </div>
    <div class="metric-card"><div class="metric-value">${recent}</div><div class="metric-label">Active Last 7 Days</div></div>
  `;

  ptsRenderTable(projects);
}

function ptsRenderTable(projects) {
  const tableWrap = document.getElementById('pts-table-wrap');
  if (!tableWrap) return;

  // Sort
  const sorted = [...projects].sort((a, b) => {
    const av = a[_ptsSortKey];
    const bv = b[_ptsSortKey];
    if (typeof av === 'number') return ((av || 0) - (bv || 0)) * _ptsSortDir;
    return String(av || '').localeCompare(String(bv || '')) * _ptsSortDir;
  });

  const fmt = v => (v || 0).toFixed(2);

  // Sortable header cells
  const thCells = PTS_COLS.map(col => {
    const active = _ptsSortKey === col.key;
    const arrow  = active ? (_ptsSortDir === 1 ? ' ▲' : ' ▼') : ' ⇅';
    const arrowClr = active ? '#fff' : 'rgba(255,255,255,.3)';
    return `<th data-sort="${col.key}" style="padding:7px 10px;text-align:${col.align};font-weight:600;font-size:12px;cursor:pointer;user-select:none;white-space:nowrap">
      ${col.label}<span style="color:${arrowClr};font-size:10px;margin-left:3px">${arrow}</span>
    </th>`;
  }).join('');

  const rows = sorted.map(p => {
    const pct       = p.estimatedHours > 0 ? p.workedHours / p.estimatedHours : 0;
    const over      = p.estimatedHours > 0 && p.workedHours > p.estimatedHours;
    const atRisk    = !over && pct >= 0.5;
    const hasRecent = p.last7Hours > 0;
    const excluded  = _ptsExcluded.has(p.id);

    let rowBg = '';
    if (!excluded) {
      if (over)            rowBg = 'rgba(239,68,68,.15)';
      else if (atRisk)     rowBg = 'rgba(255,193,7,.15)';
      else if (hasRecent)  rowBg = 'rgba(100,200,120,.08)';
    }
    const rowStyle = `${excluded ? 'opacity:.4;' : ''}${rowBg ? 'background:' + rowBg + ';' : ''}`;

    const pctBar = p.estimatedHours > 0
      ? `<div style="height:4px;border-radius:2px;background:var(--border);margin-top:4px;overflow:hidden">
           <div style="height:100%;width:${Math.min(pct * 100, 100).toFixed(1)}%;background:${over ? 'var(--error)' : atRisk ? 'var(--warn)' : 'var(--success)'}"></div>
         </div>`
      : '';

    const noteVal = escHtml(p.note || '');

    return `
      <tr style="${rowStyle}">
        <td style="padding:5px 8px;text-align:center;vertical-align:middle">
          <input type="checkbox" data-exclude-id="${p.id}" ${excluded ? '' : 'checked'}
            title="${excluded ? 'Excluded from export — click to include' : 'Included in export — click to exclude'}"
            style="cursor:pointer;accent-color:var(--accent);width:14px;height:14px" />
        </td>
        <td style="padding:6px 10px;font-size:12px;color:var(--text)">${escHtml(p.accountName)}</td>
        <td style="padding:6px 10px;font-size:12px;color:var(--text)">${escHtml(p.projectName)}</td>
        <td style="padding:6px 10px;font-size:12px;color:var(--text-muted)">${escHtml(p.contractName || '—')}</td>
        <td style="padding:6px 10px;font-size:11px;font-family:var(--font-mono);color:var(--text-muted);white-space:nowrap">${escHtml(p.projectNumber)}</td>
        <td style="padding:6px 10px;font-size:12px;white-space:nowrap;color:var(--text)">${escHtml(p.projectLead)}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:12px;color:var(--text)">${fmt(p.estimatedHours)}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:12px;font-weight:700;color:${over ? 'var(--error)' : atRisk ? 'var(--warn)' : 'var(--text)'}">
          ${fmt(p.workedHours)}${pctBar}
        </td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:12px;color:var(--text)">${fmt(p.billableHours)}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:12px;color:var(--text-muted)">${fmt(p.nonBillableHours)}</td>
        <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-size:12px;color:${hasRecent ? 'var(--success)' : 'var(--text-muted)'}">
          ${hasRecent ? fmt(p.last7Hours) : '—'}
        </td>
        <td style="padding:4px 6px;min-width:180px;max-width:260px">
          <textarea data-project-id="${p.id}" rows="2"
            style="width:100%;background:transparent;border:1px solid transparent;border-radius:4px;
                   color:var(--text);font-size:11px;font-family:inherit;resize:vertical;padding:3px 6px;
                   box-sizing:border-box;transition:border-color .15s"
            placeholder="Click to add note…">${noteVal}</textarea>
        </td>
      </tr>`;
  }).join('');

  tableWrap.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:rgba(45,77,107,.75);color:#fff">
          <th style="padding:7px 8px;width:30px" title="Uncheck to exclude row from export/email"></th>
          ${thCells}
          <th style="padding:7px 10px;text-align:left;font-weight:600;font-size:12px">Notes</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;

  // Sortable column headers
  tableWrap.querySelectorAll('th[data-sort]').forEach(th => {
    th.addEventListener('click', () => ptsSortBy(th.dataset.sort));
  });

  // Checkbox → _ptsExcluded, update row appearance inline
  tableWrap.querySelectorAll('input[data-exclude-id]').forEach(cb => {
    cb.addEventListener('change', () => {
      const id  = Number(cb.dataset.excludeId);
      const row = cb.closest('tr');
      if (cb.checked) {
        _ptsExcluded.delete(id);
        if (row) row.style.opacity = '';
      } else {
        _ptsExcluded.add(id);
        if (row) row.style.opacity = '0.4';
      }
      cb.title = cb.checked
        ? 'Included in export — click to exclude'
        : 'Excluded from export — click to include';
    });
  });

  // Note textarea — focus/blur styles + save on blur
  tableWrap.querySelectorAll('textarea[data-project-id]').forEach(ta => {
    ta.addEventListener('focus', () => { ta.style.borderColor = 'var(--border)'; ta.style.background = 'var(--surface-2)'; });
    ta.addEventListener('blur', async () => {
      ta.style.borderColor = 'transparent';
      ta.style.background = 'transparent';
      const projectId = Number(ta.dataset.projectId);
      const note      = ta.value;
      const proj = (_ptsData || []).find(p => p.id === projectId);
      if (proj) proj.note = note.trim();
      try { await window.api.saveProjectNote({ projectId, note }); } catch {}
    });
  });
}

// ─── Contract Changes ─────────────────────────────────────────────────────────
function renderContractChanges() {
  // Restore date range from cache, default to today
  const today      = ccTodayStr();
  const cachedFrom = cache.contractChanges.dateFrom || today;
  const cachedTo   = cache.contractChanges.dateTo   || today;
  _ccData          = cache.contractChanges.rows;

  content.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Autotask Contract Changes</h1>
        <p class="view-desc">Audit log of Autotask contract changes. Rows tagged by actor type (👤 Human · 🤖 AI · ⚡ Integration). Click any row to expand details.</p>
      </div>
    </div>

    <div class="audit-controls" style="flex-wrap:wrap;gap:12px;margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:8px">
        <label class="field-label" style="margin:0;white-space:nowrap">From</label>
        <input class="field-input" type="date" id="cc-date-from" value="${cachedFrom}" style="width:148px" />
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <label class="field-label" style="margin:0;white-space:nowrap">To</label>
        <input class="field-input" type="date" id="cc-date-to" value="${cachedTo}" style="width:148px" />
      </div>
      <button class="btn btn-primary" id="cc-run-btn">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 4-8 4V2z" fill="currentColor"/></svg>
        Run
      </button>
      <button class="btn btn-ghost" id="cc-export-btn" ${_ccData ? '' : 'disabled'}>
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 10v1a1 1 0 001 1h8a1 1 0 001-1v-1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        Export Excel
      </button>
      <span id="cc-status" style="font-size:12px;color:var(--text-muted);margin-left:4px"></span>
    </div>

    <div id="cc-filter-bar" class="${_ccData ? '' : 'hidden'}" style="display:flex;align-items:center;gap:8px;margin-bottom:14px;flex-wrap:wrap">

      <!-- Changed By multi-select (populated dynamically from data) -->
      <div class="ms-wrap">
        <button class="field-input ms-btn" type="button" id="ms-btn-by">
          Changed By <span class="ms-count" id="ms-cnt-by" style="display:none"></span>
        </button>
        <div class="ms-panel" id="ms-panel-by"></div>
      </div>

      <!-- Change Type multi-select (static options) -->
      <div class="ms-wrap">
        <button class="field-input ms-btn" type="button" id="ms-btn-type">
          Change Type <span class="ms-count" id="ms-cnt-type" style="display:none"></span>
        </button>
        <div class="ms-panel" id="ms-panel-type">
          ${['Unit Price','Unit Cost','Units Changed','Service Added','Service Removed','Contract Created','Notification','Other'].map(t =>
            `<label class="ms-item"><input type="checkbox" value="${t}" />${t}</label>`).join('')}
        </div>
      </div>

      <!-- Actor multi-select (static options) -->
      <div class="ms-wrap">
        <button class="field-input ms-btn" type="button" id="ms-btn-actor">
          Actor <span class="ms-count" id="ms-cnt-actor" style="display:none"></span>
        </button>
        <div class="ms-panel" id="ms-panel-actor">
          <label class="ms-item"><input type="checkbox" value="human" />👤 Human</label>
          <label class="ms-item"><input type="checkbox" value="ai" />🤖 AI</label>
          <label class="ms-item"><input type="checkbox" value="integration" />⚡ Integration</label>
          <label class="ms-item"><input type="checkbox" value="system" />⚙ System</label>
        </div>
      </div>

      <!-- Effective Date filter -->
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <span style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap">Eff. Date</span>
        <input class="field-input" type="date" id="cc-eff-from" style="width:140px;height:34px" title="Effective from" />
        <span style="color:var(--text-muted);font-size:13px">→</span>
        <input class="field-input" type="date" id="cc-eff-to" style="width:140px;height:34px" title="Effective to" />
        <button class="btn btn-ghost btn-sm" id="cc-eff-clear" style="padding:5px 9px;height:34px;opacity:.7" title="Clear effective date">✕</button>
      </div>

      <!-- Search -->
      <div style="position:relative;flex:1;min-width:200px">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--text-muted);pointer-events:none"><circle cx="5.5" cy="5.5" r="4" stroke="currentColor" stroke-width="1.3"/><path d="M9 9l3.5 3.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <input class="field-input" type="text" id="cc-search" placeholder="Search service, user, title…" style="padding-left:28px;height:34px;width:100%;box-sizing:border-box" />
      </div>
      <span id="cc-count" style="font-size:12px;color:var(--text-muted);white-space:nowrap"></span>
    </div>

    <div id="cc-results"></div>
  `;

  document.getElementById('cc-run-btn').addEventListener('click', ccRunQuery);
  document.getElementById('cc-export-btn').addEventListener('click', ccExportExcel);
  document.getElementById('cc-search').addEventListener('input', ccApplyFilters);

  // Multi-select panel toggle behaviour
  const msToggle = (btnId, panelId) => {
    const btn   = document.getElementById(btnId);
    const panel = document.getElementById(panelId);
    if (!btn || !panel) return;
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = panel.style.display === 'block';
      document.querySelectorAll('.ms-panel').forEach(p => { p.style.display = 'none'; });
      if (!isOpen) panel.style.display = 'block';
    });
  };
  msToggle('ms-btn-by',    'ms-panel-by');
  msToggle('ms-btn-type',  'ms-panel-type');
  msToggle('ms-btn-actor', 'ms-panel-actor');

  // Close all panels when clicking outside a ms-wrap
  content.addEventListener('click', e => {
    if (!e.target.closest('.ms-wrap')) {
      document.querySelectorAll('.ms-panel').forEach(p => { p.style.display = 'none'; });
    }
  });

  // Wire static panels (type + actor) — changed by is wired in ccPopulateFilterDropdowns
  ['ms-panel-type', 'ms-panel-actor'].forEach(panelId => {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    const cntId = panelId.replace('ms-panel-', 'ms-cnt-');
    panel.addEventListener('change', () => {
      ccUpdateBadge(panelId, cntId);
      ccApplyFilters();
    });
  });

  // Effective date
  document.getElementById('cc-eff-from')?.addEventListener('change', ccApplyFilters);
  document.getElementById('cc-eff-to')?.addEventListener('change', ccApplyFilters);
  document.getElementById('cc-eff-clear')?.addEventListener('click', () => {
    const f = document.getElementById('cc-eff-from');
    const t = document.getElementById('cc-eff-to');
    if (f) f.value = '';
    if (t) t.value = '';
    ccApplyFilters();
  });

  // Restore results if cached
  if (_ccData) {
    ccPopulateFilterDropdowns(_ccData);
    ccApplyFilters();
  }
}

async function ccRunQuery() {
  const fromEl   = document.getElementById('cc-date-from');
  const toEl     = document.getElementById('cc-date-to');
  const statusEl = document.getElementById('cc-status');
  const runBtn   = document.getElementById('cc-run-btn');

  const dateFrom = fromEl?.value;
  const dateTo   = toEl?.value;
  if (!dateFrom || !dateTo) {
    if (statusEl) statusEl.textContent = 'Select a date range first.';
    return;
  }

  if (statusEl) statusEl.textContent = 'Querying Autotask…';
  if (runBtn)   runBtn.disabled = true;

  // Convert local calendar dates to UTC ISO for the ContractNotes filter.
  // Pass the plain YYYY-MM-DD strings too — used for the Contracts createDate filter
  // which is a date-only field and doesn't accept ISO datetimes.
  const fromUtc = new Date(dateFrom + 'T00:00:00').toISOString();
  const toUtc   = new Date(dateTo   + 'T23:59:59.999').toISOString();

  try {
    const res = await window.api.runContractChanges({
      dateFrom, dateTo,       // local YYYY-MM-DD for Contracts entity
      fromUtc,  toUtc,        // UTC ISO for ContractNotes entity
    });
    if (!res.success) throw new Error(res.error || 'Query failed');

    _ccData = res.rows;
    cache.contractChanges.rows     = res.rows;
    cache.contractChanges.dateFrom = dateFrom;
    cache.contractChanges.dateTo   = dateTo;

    if (statusEl) {
      statusEl.style.color = '';
      statusEl.textContent = `${res.total} record${res.total !== 1 ? 's' : ''} found`;
    }
    saveToolStat('contract-changes', `${res.total} record${res.total !== 1 ? 's' : ''} found`, 'ok');

    const exportBtn = document.getElementById('cc-export-btn');
    if (exportBtn) exportBtn.disabled = false;

    const filterBar = document.getElementById('cc-filter-bar');
    if (filterBar) filterBar.classList.remove('hidden');

    ccPopulateFilterDropdowns(res.rows);
    ccApplyFilters();
  } catch (e) {
    if (statusEl) statusEl.textContent = `Error: ${e.message}`;
  } finally {
    if (runBtn) runBtn.disabled = false;
  }
}

// Update the count badge on a multi-select button
function ccUpdateBadge(panelId, cntId) {
  const panel = document.getElementById(panelId);
  const cnt   = document.getElementById(cntId);
  if (!panel || !cnt) return;
  const checked = panel.querySelectorAll('input[type=checkbox]:checked').length;
  cnt.textContent  = checked;
  cnt.style.display = checked > 0 ? '' : 'none';
}

function ccPopulateFilterDropdowns(rows) {
  const panel = document.getElementById('ms-panel-by');
  if (!panel) return;
  const users = [...new Set(rows.map(r => r.changedBy).filter(Boolean))].sort();
  panel.innerHTML = users.map(u =>
    `<label class="ms-item"><input type="checkbox" value="${escHtml(u)}" />${escHtml(u)}</label>`
  ).join('');
  panel.addEventListener('change', () => {
    ccUpdateBadge('ms-panel-by', 'ms-cnt-by');
    ccApplyFilters();
  });
}

// Returns the currently filtered rows based on all active filter controls.
function ccGetFiltered() {
  if (!_ccData) return [];
  const checked = panelId => Array.from(
    (document.getElementById(panelId) || { querySelectorAll: () => [] })
      .querySelectorAll('input[type=checkbox]:checked')
  ).map(cb => cb.value);

  const byVals    = checked('ms-panel-by');
  const typeVals  = checked('ms-panel-type');
  const actorVals = checked('ms-panel-actor');
  const searchVal = (document.getElementById('cc-search')?.value || '').toLowerCase().trim();
  const effFrom   = document.getElementById('cc-eff-from')?.value || '';
  const effTo     = document.getElementById('cc-eff-to')?.value   || '';

  return _ccData.filter(r => {
    if (byVals.length    && !byVals.includes(r.changedBy    || '')) return false;
    if (typeVals.length  && !typeVals.includes(r.changeType  || '')) return false;
    if (actorVals.length && !actorVals.includes(r.actorType  || '')) return false;
    if (effFrom || effTo) {
      const eff = (r.effectiveDate || '').slice(0, 10);
      if (eff) {
        if (effFrom && eff < effFrom) return false;
        if (effTo   && eff > effTo)   return false;
      }
    }
    if (searchVal) {
      const hay = [
        r.serviceName, r.changedBy, r.title, r.description,
        r.contractName, r.companyName, String(r.contractID || ''),
      ].join(' ').toLowerCase();
      if (!hay.includes(searchVal)) return false;
    }
    return true;
  });
}

function ccApplyFilters() {
  if (!_ccData) return;
  const filtered = ccGetFiltered();
  const countEl  = document.getElementById('cc-count');
  if (countEl) countEl.textContent = `${filtered.length} row${filtered.length !== 1 ? 's' : ''}`;
  ccRenderTable(filtered);
}

function ccRenderTable(rows) {
  const el = document.getElementById('cc-results');
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = `<p style="color:var(--text-muted);font-size:13px;padding:20px 0">No records match the current filters.</p>`;
    return;
  }

  // ── Summary strip ──────────────────────────────────────────────────────────
  const typeCounts  = {};
  const actorCounts = { ai: 0, integration: 0, human: 0, system: 0 };
  for (const r of rows) {
    const t = r.changeType || 'Other';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
    actorCounts[r.actorType || 'human'] = (actorCounts[r.actorType || 'human'] || 0) + 1;
  }
  const TYPE_ORDER = ['Unit Price','Unit Cost','Units Changed','Service Added','Service Removed','Contract Created','Notification','Other'];
  const typePills = TYPE_ORDER
    .filter(t => typeCounts[t])
    .map(t => `<span class="cc-badge cc-sum-pill ${ccChangeBadgeClass(t)}">${escHtml(t)} <b>${typeCounts[t]}</b></span>`)
    .join('');
  const actorPills = [
    actorCounts.ai          ? `<span class="cc-actor-sum cc-actor-ai">🤖 AI <b>${actorCounts.ai}</b></span>`                         : '',
    actorCounts.integration ? `<span class="cc-actor-sum cc-actor-integration">⚡ Integration <b>${actorCounts.integration}</b></span>` : '',
    actorCounts.human       ? `<span class="cc-actor-sum cc-actor-human">👤 Human <b>${actorCounts.human}</b></span>`                  : '',
    actorCounts.system      ? `<span class="cc-actor-sum cc-actor-system">⚙ System <b>${actorCounts.system}</b></span>`                : '',
  ].filter(Boolean).join('');

  // ── Table rows ─────────────────────────────────────────────────────────────
  const rowsHtml = rows.map(r => {
    const contractIdStr = String(r.contractID || '');
    const companyLine   = r.companyName  ? `<div class="cc-cell-primary">${escHtml(r.companyName)}</div>`   : '';
    const contractLine  = r.contractName ? `<div class="cc-cell-secondary">${escHtml(r.contractName)}</div>` : '';
    const idChip = `<span class="cc-copyable cc-id-chip" title="Click to copy ID"
      data-val="${escHtml(contractIdStr)}"
      onclick="event.stopPropagation();navigator.clipboard.writeText(this.dataset.val);this.classList.add('cc-copied');setTimeout(()=>this.classList.remove('cc-copied'),1200)"
      >${escHtml(contractIdStr)}</span>`;
    const actorBadge  = ccActorBadge(r.actorType);
    const svcDisplay  = escHtml(r.serviceName || r.title || '');
    const svcTitle    = escHtml(r.serviceName || r.title || '');
    return `
      <tr class="cc-row">
        <td class="cc-td-mono cc-nowrap">${escHtml(ccFormatDate(r.createDateTime))}</td>
        <td>${companyLine}${contractLine}${(companyLine || contractLine) ? idChip : `<span class="cc-copyable" title="Click to copy ID" data-val="${escHtml(contractIdStr)}" onclick="event.stopPropagation();navigator.clipboard.writeText(this.dataset.val);this.classList.add('cc-copied');setTimeout(()=>this.classList.remove('cc-copied'),1200)">${escHtml(contractIdStr)}</span>`}</td>
        <td>${escHtml(r.changedBy || '')}${actorBadge}</td>
        <td>${ccChangeBadge(r.changeType)}</td>
        <td title="${svcTitle}" class="cc-cell-svc">${svcDisplay}</td>
        <td class="cc-val">${escHtml(r.newValue || '')}</td>
        <td class="cc-nowrap">${escHtml(r.effectiveDate || '')}</td>
        <td class="cc-expand-icon">▸</td>
      </tr>
      <tr class="cc-detail-row">
        <td colspan="8">
          <div class="cc-detail-body">
            ${r.title       ? `<div><span class="cc-detail-label">Title:</span> ${escHtml(r.title)}</div>` : ''}
            ${r.description ? `<div style="margin-top:4px"><span class="cc-detail-label">Description:</span><pre class="cc-detail-pre">${escHtml(r.description)}</pre></div>` : ''}
            ${(!r.title && !r.description) ? `<div style="color:var(--text-muted);font-style:italic">No additional detail available.</div>` : ''}
          </div>
        </td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="cc-summary-strip">
      <div class="cc-sum-types">${typePills}</div>
      ${actorPills ? `<div class="cc-sum-sep"></div><div class="cc-sum-actors">${actorPills}</div>` : ''}
    </div>
    <div class="cc-table-wrap">
      <table class="cc-table">
        <thead>
          <tr>
            <th style="width:130px">Date / Time</th>
            <th>Company / Contract</th>
            <th style="width:165px">Changed By</th>
            <th style="width:130px">Change Type</th>
            <th>Service</th>
            <th style="width:100px">New Value</th>
            <th style="width:100px">Effective</th>
            <th style="width:20px"></th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;

  // Wire up expand/collapse via event delegation (no global function needed)
  el.querySelectorAll('tr.cc-row').forEach(row => {
    row.addEventListener('click', () => {
      const det  = row.nextElementSibling;
      if (!det || !det.classList.contains('cc-detail-row')) return;
      const open = det.style.display !== 'none';
      det.style.display = open ? 'none' : '';
      const icon = row.querySelector('.cc-expand-icon');
      if (icon) icon.textContent = open ? '▸' : '▾';
    });
  });
}

function ccFormatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone:  'America/Denver',
      month:     'short',
      day:       'numeric',
      year:      'numeric',
      hour:      'numeric',
      minute:    '2-digit',
      hour12:    true,
    });
  } catch { return iso; }
}

// Returns just the CSS class for a change type badge (used by both the badge
// renderer and the summary strip pills).
function ccChangeBadgeClass(type) {
  return {
    'Unit Price':        'cc-badge-blue',
    'Unit Cost':         'cc-badge-orange',
    'Units Changed':     'cc-badge-green',
    'Service Added':     'cc-badge-purple',
    'Service Removed':   'cc-badge-pink',
    'Contract Created':  'cc-badge-teal',
    'Notification':      'cc-badge-muted',
  }[type] || 'cc-badge-muted';
}

function ccChangeBadge(type) {
  return `<span class="cc-badge ${ccChangeBadgeClass(type)}">${escHtml(type || 'Other')}</span>`;
}

// Returns an inline actor badge for AI / Integration / System accounts.
// Returns empty string for humans (no badge needed — they're the default).
function ccActorBadge(actorType) {
  const cfg = {
    ai:          { cls: 'cc-actor-ai',          label: '🤖 AI' },
    integration: { cls: 'cc-actor-integration', label: '⚡ Integ.' },
    system:      { cls: 'cc-actor-system',       label: '⚙ System' },
  }[actorType];
  if (!cfg) return '';
  return `<span class="cc-actor-badge ${cfg.cls}">${cfg.label}</span>`;
}

async function ccExportExcel() {
  if (!_ccData) return;
  try {
    const res = await window.api.exportContractChangesExcel(ccGetFiltered());
    if (res.cancelled) return;
    if (!res.success) throw new Error(res.error || 'Export failed');
  } catch (e) { alert('Export error: ' + e.message); }
}

// ─── Utility ──────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Auto-update banner ───────────────────────────────────────────────────────
if (window.api.onUpdateDownloaded) {
  window.api.onUpdateDownloaded((info) => {
    const banner = document.getElementById('update-banner');
    if (!banner || banner.style.display !== 'none') return;
    const v = info?.version ? `v${info.version}` : 'a new version';
    banner.innerHTML = `
      <span class="update-banner-msg">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="flex-shrink:0">
          <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.3"/>
          <path d="M7 4v3.5l2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
        </svg>
        Anchor Hub ${v} is ready to install — this will restart the app, not your computer
      </span>
      <div class="update-banner-actions">
        <button class="btn btn-sm update-btn-restart" onclick="window.api.restartAndInstall()">Restart App Now</button>
        <button class="btn btn-sm update-btn-later" onclick="document.getElementById('update-banner').style.display='none'">Later</button>
      </div>`;
    banner.style.display = '';
  });
}

// ─── Autotask Contract Renewals ────────────────────────────────────────────────────────
let crData     = { contracts: [], renewed: [] };
let crWindow   = 30;
let crEligible = [];
let crSelected = new Set(); // indices of contracts selected for combined prompt
let _mscData   = null;     // cached MSC agreement rows, loaded on first use
let _mscEdits  = {};      // pending edits: { rowNum: { field: value } }

function mscNorm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mscFindClient(companyName) {
  if (!_mscData || !_mscData.length) return null;
  const target = mscNorm(companyName);
  if (!target) return null;
  let best = null, bestScore = 0;
  for (const row of _mscData) {
    const cand = mscNorm(row.company);
    if (!cand) continue;
    if (target === cand) return row;
    let score = 0;
    if (target.includes(cand) || cand.includes(target)) {
      score = Math.min(target.length, cand.length) / Math.max(target.length, cand.length) * 0.9;
    } else {
      const wt = companyName.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const wc = row.company.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      const overlap = wt.filter(w => wc.some(c => c === w));
      if (overlap.length) score = overlap.length / Math.max(wt.length, wc.length) * 0.8;
    }
    if (score > bestScore) { bestScore = score; best = row; }
  }
  return bestScore >= 0.55 ? best : null;
}

async function renderContractRenewals() {
  content.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Autotask Contract Renewals</h1>
        <p class="view-subtitle">Active contracts expiring soon with no renewal on record</p>
      </div>
    </div>
    <div class="view-body">
      <div class="cr-controls">
        <div class="cr-window-tabs">
          <button class="cr-tab ${crWindow===30?'active':''}" data-days="30">30 days</button>
          <button class="cr-tab ${crWindow===60?'active':''}" data-days="60">60 days</button>
          <button class="cr-tab ${crWindow===90?'active':''}" data-days="90">90 days</button>
        </div>
        <button class="btn btn-primary" id="cr-run-btn">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3 2l9 5-9 5V2z" fill="currentColor"/></svg>
          Run
        </button>
      </div>
      <div class="cr-status" id="cr-status"></div>
      <div id="cr-results"></div>
    </div>`;

  const settings = await window.api.getRenewalSettings();
  crEligible = settings.eligibleServices || [];

  // Load MSC data silently so contract blocks can show agreement rates
  if (!_mscData) {
    window.api.getMscSettings().then(s => {
      if (s.filePath) window.api.readMscData(s.filePath).then(r => { if (r.success) _mscData = r.data; });
    });
  }

  document.querySelectorAll('.cr-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cr-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      crWindow = parseInt(tab.dataset.days);
    });
  });
  document.getElementById('cr-run-btn').addEventListener('click', crRunQuery);

  if (crData.contracts.length || crData.renewed.length) crRenderResults();
}

async function crRunQuery() {
  const statusEl = document.getElementById('cr-status');
  const runBtn   = document.getElementById('cr-run-btn');
  if (!statusEl || !runBtn) return;

  runBtn.disabled = true;
  runBtn.innerHTML = 'Running…';
  statusEl.textContent = 'Fetching contracts…';

  try {
    const res = await window.api.runContractRenewals({ windowDays: crWindow });

    // Decorate each service with eligibility + editable values (start at current values)
    for (const c of res.contracts) {
      for (const s of c.services) {
        s._origCost  = s.unitCost;
        s._origPrice = s.unitPrice;
        s.newCost    = s.unitCost;
        s.newPrice   = s.unitPrice;
        s.isEligible = crEligible.some(e => s.serviceName.toLowerCase().includes(e.toLowerCase()));
      }
    }
    crData = res;
    crSelected = new Set();
    crRenderResults();
    statusEl.textContent = `${res.contracts.length} need renewal · ${res.renewed.length} already renewed`;
    saveToolStat('contract-renewals', `${res.contracts.length} need renewal`, res.contracts.length > 0 ? 'warn' : 'ok');
  } catch (e) {
    statusEl.textContent = `Error: ${e.message}`;
    console.error(e);
  }

  runBtn.disabled = false;
  runBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3 2l9 5-9 5V2z" fill="currentColor"/></svg> Run`;
}

function crRenderResults() {
  const el = document.getElementById('cr-results');
  if (!el) return;
  const { contracts, renewed } = crData;

  if (!contracts.length && !renewed.length) {
    el.innerHTML = `<div class="cr-empty">No active contracts expiring in the next ${crWindow} days.</div>`;
    return;
  }

  el.innerHTML = `
    ${contracts.length ? `
      <div class="cr-section-hdr cr-section-warn">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" stroke="var(--warn)" stroke-width="1.3"/>
          <path d="M7 4v3.5" stroke="var(--warn)" stroke-width="1.3" stroke-linecap="round"/>
          <circle cx="7" cy="10.2" r="0.8" fill="var(--warn)"/>
        </svg>
        ${contracts.length} Need${contracts.length === 1 ? 's' : ''} Renewal
      </div>
      <div class="cr-bulk-bar">
        <label class="cr-select-all-label">
          <input type="checkbox" id="cr-select-all" /> Select All
        </label>
        <span class="cr-bulk-count" id="cr-bulk-count">${crSelected.size ? `${crSelected.size} selected` : ''}</span>
        <button class="btn btn-primary btn-sm" id="cr-combined-btn" ${crSelected.size ? '' : 'disabled'}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Combined Renewal Prompt${crSelected.size ? ` (${crSelected.size})` : ''}
        </button>
      </div>
      <div class="cr-combined-wrap" id="cr-combined-wrap" style="display:none">
        <textarea class="cr-prompt-ta" id="cr-combined-ta" rows="24" readonly spellcheck="false"></textarea>
        <div class="cr-prompt-actions">
          <button class="btn btn-ghost btn-sm" id="cr-combined-copy">Copy</button>
        </div>
      </div>
      ${contracts.map((c, i) => crContractBlock(c, i)).join('')}
    ` : `<div class="cr-all-good">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="var(--success)" stroke-width="1.3"/><path d="M4.5 7l2 2 3-3" stroke="var(--success)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        All expiring contracts in this window have been renewed.
      </div>`}

    ${renewed.length ? `
      <details class="cr-renewed-wrap">
        <summary class="cr-section-hdr cr-section-ok">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="var(--success)" stroke-width="1.3"/>
            <path d="M4.5 7l2 2 3-3" stroke="var(--success)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          ${renewed.length} Already Renewed
          <span class="cr-toggle-hint">(click to expand)</span>
        </summary>
        <div class="cr-renewed-actions">
          <button class="btn btn-ghost btn-sm" id="cr-compare-all-btn">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 4h4v6H2zM8 4h4v6H8z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M6 7h2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            Compare All with Claude
          </button>
        </div>
        <div class="cr-combined-wrap" id="cr-compare-wrap" style="display:none">
          <textarea class="cr-prompt-ta" id="cr-compare-ta" rows="24" readonly spellcheck="false"></textarea>
          <div class="cr-prompt-actions">
            <button class="btn btn-ghost btn-sm" id="cr-compare-copy">Copy</button>
          </div>
        </div>
        <table class="cr-table cr-renewed-table">
          <thead><tr><th>Company</th><th>Contract</th><th>Old ID</th><th>New ID</th><th>Expires</th><th>Renewal Starts</th></tr></thead>
          <tbody>
            ${renewed.map(c => `
              <tr>
                <td>${escHtml(c.companyName)}</td>
                <td>${escHtml(c.contractName)}</td>
                <td class="cr-id-cell">#${c.id}</td>
                <td class="cr-id-cell" style="color:var(--success)">${c.renewal ? `#${c.renewal.id}` : '—'}</td>
                <td>${crFmtDate(c.endDate)}</td>
                <td style="color:var(--success)">${c.renewal ? crFmtDate(c.renewal.startDate) : '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </details>
    ` : ''}`;

  // ── Wire up expand toggles ──
  el.querySelectorAll('.cr-row-header').forEach(header => {
    header.addEventListener('click', () => {
      const block = header.closest('.cr-block');
      const detail = block.querySelector('.cr-block-detail');
      const icon   = header.querySelector('.cr-chevron');
      const open   = block.classList.toggle('cr-open');
      detail.style.display = open ? '' : 'none';
      icon.textContent = open ? '▼' : '▶';
    });
  });

  // ── Wire price inputs ──
  el.querySelectorAll('.cr-price-input').forEach(input => {
    input.addEventListener('input', () => {
      const ci = +input.dataset.ci, si = +input.dataset.si, f = input.dataset.f;
      if (crData.contracts[ci]?.services[si]) {
        crData.contracts[ci].services[si][f] = parseFloat(input.value) || 0;
      }
    });
  });

  // ── Wire per-service % inputs ──
  el.querySelectorAll('.cr-pct-svc-input').forEach(input => {
    input.addEventListener('input', () => {
      const ci  = +input.dataset.ci;
      const si  = +input.dataset.si;
      const pct = parseFloat(input.value) || 0;
      const s   = crData.contracts[ci]?.services[si];
      if (!s) return;
      s._pct     = pct;
      s.newPrice = Math.round(s._origPrice * (1 + pct / 100) * 100) / 100;
      const priceEl = el.querySelector(`.cr-price-input[data-ci="${ci}"][data-si="${si}"][data-f="newPrice"]`);
      if (priceEl) { priceEl.value = s.newPrice.toFixed(2); priceEl.classList.toggle('cr-changed', s.newPrice !== s._origPrice); }
    });
  });

  // ── Wire Apply MSC Rates buttons ──
  el.querySelectorAll('.cr-apply-msc-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ci    = +btn.dataset.ci;
      const tcPct = parseFloat(btn.dataset.tc) || 0;
      const spPct = parseFloat(btn.dataset.sp) || 0;
      crData.contracts[ci]?.services.forEach(s => {
        if (!s.isEligible) return;
        const isSP = s.serviceName.toLowerCase().includes('security');
        const pct  = isSP ? spPct : tcPct;
        if (!pct) return;
        s._pct     = pct;
        s.newPrice = Math.round(s._origPrice * (1 + pct / 100) * 100) / 100;
      });
      crRenderResults();
    });
  });

  // ── Wire generate-prompt buttons ──
  el.querySelectorAll('.cr-gen-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ci      = +btn.dataset.ci;
      const area    = el.querySelector(`.cr-prompt-wrap[data-ci="${ci}"]`);
      const ta      = el.querySelector(`.cr-prompt-ta[data-ci="${ci}"]`);
      if (!area || !ta) return;
      ta.value = crBuildPrompt(crData.contracts[ci]);
      area.style.display = '';
      area.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });

  // ── Wire copy buttons ──
  el.querySelectorAll('.cr-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const ta = el.querySelector(`.cr-prompt-ta[data-ci="${btn.dataset.ci}"]`);
      if (!ta) return;
      navigator.clipboard.writeText(ta.value).then(() => {
        btn.textContent = '✓ Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2500);
      });
    });
  });

  // ── Wire contract checkboxes ──
  function crUpdateBulkBar() {
    const countEl  = el.querySelector('#cr-bulk-count');
    const combBtn  = el.querySelector('#cr-combined-btn');
    const selectAll = el.querySelector('#cr-select-all');
    const n = crSelected.size;
    if (countEl) countEl.textContent = n ? `${n} selected` : '';
    if (combBtn) {
      combBtn.disabled = n === 0;
      combBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg> Combined Renewal Prompt${n ? ` (${n})` : ''}`;
    }
    if (selectAll) selectAll.indeterminate = n > 0 && n < crData.contracts.length;
    if (selectAll) selectAll.checked = n > 0 && n === crData.contracts.length;
  }

  el.querySelectorAll('.cr-contract-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const ci = +cb.dataset.ci;
      if (cb.checked) crSelected.add(ci); else crSelected.delete(ci);
      crUpdateBulkBar();
    });
  });

  // ── Wire Select All ──
  const selectAllEl = el.querySelector('#cr-select-all');
  if (selectAllEl) {
    selectAllEl.addEventListener('change', () => {
      if (selectAllEl.checked) {
        crData.contracts.forEach((_, i) => crSelected.add(i));
      } else {
        crSelected.clear();
      }
      el.querySelectorAll('.cr-contract-cb').forEach(cb => { cb.checked = crSelected.has(+cb.dataset.ci); });
      crUpdateBulkBar();
    });
  }

  // ── Wire Combined Renewal Prompt ──
  const combBtn = el.querySelector('#cr-combined-btn');
  if (combBtn) {
    combBtn.addEventListener('click', () => {
      const wrap = el.querySelector('#cr-combined-wrap');
      const ta   = el.querySelector('#cr-combined-ta');
      if (!wrap || !ta) return;
      const selected = [...crSelected].sort((a, b) => a - b).map(i => crData.contracts[i]);
      ta.value = crBuildCombinedPrompt(selected);
      wrap.style.display = '';
      wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
  const combCopy = el.querySelector('#cr-combined-copy');
  if (combCopy) {
    combCopy.addEventListener('click', () => {
      const ta = el.querySelector('#cr-combined-ta');
      if (!ta) return;
      navigator.clipboard.writeText(ta.value).then(() => {
        combCopy.textContent = '✓ Copied!';
        setTimeout(() => { combCopy.textContent = 'Copy'; }, 2500);
      });
    });
  }

  // ── Wire Compare All Renewed ──
  const compareBtn = el.querySelector('#cr-compare-all-btn');
  if (compareBtn) {
    compareBtn.addEventListener('click', e => {
      e.stopPropagation(); // don't toggle the <details>
      const wrap = el.querySelector('#cr-compare-wrap');
      const ta   = el.querySelector('#cr-compare-ta');
      if (!wrap || !ta) return;
      ta.value = crBuildAllRenewedPrompt(crData.renewed);
      wrap.style.display = '';
      wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
  const compareCopy = el.querySelector('#cr-compare-copy');
  if (compareCopy) {
    compareCopy.addEventListener('click', () => {
      const ta = el.querySelector('#cr-compare-ta');
      if (!ta) return;
      navigator.clipboard.writeText(ta.value).then(() => {
        compareCopy.textContent = '✓ Copied!';
        setTimeout(() => { compareCopy.textContent = 'Copy'; }, 2500);
      });
    });
  }
}

function crContractBlock(c, ci) {
  const daysLeft  = Math.ceil((new Date(c.endDate + 'T00:00:00') - Date.now()) / 86400000);
  const urgClass  = daysLeft <= 14 ? 'cr-urgent' : daysLeft <= 30 ? 'cr-soon' : '';
  const mscMatch  = mscFindClient(c.companyName);
  const mscTcPct  = mscMatch?.tcIncrease    != null ? mscMatch.tcIncrease    * 100 : null;
  const mscSpPct  = mscMatch?.splusIncrease != null ? mscMatch.splusIncrease * 100 : null;
  const hasElig   = c.services.some(s => s.isEligible);
  const mscStrip  = mscMatch ? `
    <div class="cr-msc-strip">
      <span class="cr-msc-label">
        <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="10" height="12" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M4 4h6M4 7h6M4 10h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
        MSC Agreement
      </span>
      ${mscTcPct  != null ? `<span class="cr-msc-chip">TC ↑ ${mscTcPct.toFixed(1)}%</span>`  : ''}
      ${mscSpPct  != null ? `<span class="cr-msc-chip cr-msc-chip-sp">S+ ↑ ${mscSpPct.toFixed(1)}%</span>` : ''}
      ${mscMatch.yearSigned ? `<span class="cr-msc-chip cr-msc-dim">Signed ${mscMatch.yearSigned}</span>` : ''}
      ${(mscTcPct != null || mscSpPct != null) && hasElig
        ? `<button class="btn btn-ghost btn-xs cr-apply-msc-btn" data-ci="${ci}" data-tc="${mscTcPct ?? 0}" data-sp="${mscSpPct ?? 0}">Apply Rates</button>`
        : ''}
    </div>` : '';

  const serviceRows = c.services.map((s, si) => {
    const costChanged  = s.newCost  !== s._origCost;
    const priceChanged = s.newPrice !== s._origPrice;
    return `
      <tr class="cr-svc-row">
        <td>
          <div class="cr-svc-name">${escHtml(s.serviceName)}</div>
          ${s.isEligible ? `<span class="cr-elig-badge">✦ eligible</span>` : ''}
        </td>
        <td class="cr-td-center">${s.quantity}</td>
        <td class="cr-td-cp">
          <div class="cr-cp-current">$${s._origCost.toFixed(2)}</div>
          <div class="cr-cp-new">
            <span class="cr-dollar">$</span>
            <input type="number" class="cr-price-input ${costChanged ? 'cr-changed' : ''}"
              data-ci="${ci}" data-si="${si}" data-f="newCost"
              value="${s.newCost.toFixed(2)}" step="0.01" min="0" />
          </div>
        </td>
        <td class="cr-td-cp">
          <div class="cr-cp-current">$${s._origPrice.toFixed(2)}</div>
          <div class="cr-cp-new">
            <span class="cr-dollar">$</span>
            <input type="number" class="cr-price-input ${priceChanged ? 'cr-changed' : ''}"
              data-ci="${ci}" data-si="${si}" data-f="newPrice"
              value="${s.newPrice.toFixed(2)}" step="0.01" min="0" />
          </div>
        </td>
        <td class="cr-td-pct">
          <div class="cr-pct-svc">
            <input type="number" class="cr-pct-svc-input"
              data-ci="${ci}" data-si="${si}"
              value="${s._pct != null ? s._pct : ''}"
              placeholder="0" step="0.5" min="0" max="100" />
            <span class="cr-pct-sym">%</span>
          </div>
        </td>
      </tr>`;
  }).join('');

  return `
    <div class="cr-block">
      <div class="cr-row-header">
        <label class="cr-select-check" onclick="event.stopPropagation()">
          <input type="checkbox" class="cr-contract-cb" data-ci="${ci}" ${crSelected.has(ci) ? 'checked' : ''} />
        </label>
        <span class="cr-chevron">▶</span>
        <div class="cr-row-names">
          <span class="cr-co-name">${escHtml(c.companyName)}</span>
          <div class="cr-ct-row">
            <span class="cr-ct-name">${escHtml(c.contractName)}</span>
            <span class="cr-id-chip">#${c.id}</span>
          </div>
        </div>
        <div class="cr-row-right">
          <span class="cr-svc-pill">${c.services.length} svc</span>
          <span class="cr-expires ${urgClass}">Expires ${crFmtDate(c.endDate)}</span>
          <span class="cr-days ${urgClass}">${daysLeft}d</span>
        </div>
      </div>
      <div class="cr-block-detail" style="display:none">
        ${mscStrip}
        ${c.services.length ? `
          <table class="cr-table cr-svc-table">
            <thead><tr>
              <th>Service</th>
              <th class="cr-th-center">Qty</th>
              <th>Cost <span class="cr-th-sub">current → new</span></th>
              <th>Price <span class="cr-th-sub">current → new</span></th>
              <th class="cr-th-center">% ↑</th>
            </tr></thead>
            <tbody>${serviceRows}</tbody>
          </table>
        ` : `<div class="cr-no-svc">No services found on this contract.</div>`}
        <div class="cr-detail-actions">
          <button class="btn btn-primary btn-sm cr-gen-btn" data-ci="${ci}">
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M7 2l5 5-5 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Generate Renewal Prompt
          </button>
        </div>
        <div class="cr-prompt-wrap" data-ci="${ci}" style="display:none">
          <textarea class="cr-prompt-ta" data-ci="${ci}" rows="20" readonly spellcheck="false"></textarea>
          <div class="cr-prompt-actions">
            <button class="btn btn-ghost btn-sm cr-copy-btn" data-ci="${ci}">Copy</button>
          </div>
        </div>
      </div>
    </div>`;
}

function crBuildPrompt(c) {
  const newStart = crDateAdd(c.endDate, 1);
  const newEnd   = crDateAddYears(c.endDate, 1); // same date next year

  const serviceLines = c.services.map(s => {
    const tag = (s.newCost !== s._origCost || s.newPrice !== s._origPrice) ? '  ← price updated' : '';
    return `  • "${s.serviceName}" (Service ID: ${s.serviceID})\n    Quantity: ${s.quantity}  |  Unit Cost: $${s.newCost.toFixed(2)}  |  Unit Price: $${s.newPrice.toFixed(2)}${tag}`;
  }).join('\n');

  const priceNote = c.services.some(s => s.newCost !== s._origCost || s.newPrice !== s._origPrice)
    ? '\n⚠ Price/cost updates have been applied to eligible services as shown above.'
    : '';

  return `Please renew the following Autotask contract using the Autotask MCP tools.

════════════════════════════════════════════════
  COMPANY:          ${c.companyName}
  COMPANY ID:       ${c.companyID}
  CONTRACT:         "${c.contractName}"
  EXISTING ID:      ${c.id}
  CURRENT PERIOD:   ${c.startDate}  →  ${c.endDate}
  NEW PERIOD:       ${newStart}  →  ${newEnd}
════════════════════════════════════════════════

STEP 1 — Create the new contract
  Create a new contract for company ID ${c.companyID}:
    Contract Name:  "${c.contractName}"
    Start Date:     ${newStart}
    End Date:       ${newEnd}
    Contract Type:  Match existing contract ID ${c.id}
    Status:         Active

STEP 2 — Add services to the new contract
  Add each of the following services:

${serviceLines}

  For quantity, match the current active quantities on existing contract ${c.id}.
  Do not modify the existing contract.

STEP 3 — Confirm
  Once complete, confirm:
    • New contract ID and name
    • Start and end dates
    • Each service added with its unit cost and unit price
${priceNote}`;
}

function crBuildRenewedPrompt(c, template) {
  const oldId  = c.id;
  const newId  = c.renewal ? c.renewal.id : '(unknown)';
  const newStart = c.renewal ? crFmtDate(c.renewal.startDate) : '—';
  const defaultTemplate = `Please look up the following renewed Autotask contract and provide a summary.

════════════════════════════════════════════════
  COMPANY:          ${c.companyName}
  COMPANY ID:       ${c.companyID}
  CONTRACT:         "${c.contractName}"
  OLD CONTRACT ID:  ${oldId}
  NEW CONTRACT ID:  ${newId}
  OLD PERIOD END:   ${crFmtDate(c.endDate)}
  RENEWAL START:    ${newStart}
════════════════════════════════════════════════

Please use the Autotask MCP tools to:
1. Retrieve the new contract (ID: ${newId}) and confirm its details
2. List the services on the new contract with quantities, unit costs, and unit prices
3. Compare against the old contract (ID: ${oldId}) and note any differences`;

  if (!template || !template.trim()) return defaultTemplate;

  // Replace tokens in the user's custom template
  return template
    .replace(/\{companyName\}/g, c.companyName)
    .replace(/\{companyID\}/g, c.companyID)
    .replace(/\{contractName\}/g, c.contractName)
    .replace(/\{oldContractId\}/g, oldId)
    .replace(/\{newContractId\}/g, newId)
    .replace(/\{oldEndDate\}/g, crFmtDate(c.endDate))
    .replace(/\{newStartDate\}/g, newStart);
}

function crBuildCombinedPrompt(contracts) {
  if (!contracts.length) return '';
  const total = contracts.length;
  const sections = contracts.map((c, idx) => {
    const newStart = crDateAdd(c.endDate, 1);
    const newEnd   = crDateAddYears(c.endDate, 1);
    const serviceLines = c.services.map(s => {
      const tag = (s.newCost !== s._origCost || s.newPrice !== s._origPrice) ? '  ← price updated' : '';
      return `    • "${s.serviceName}" (Service ID: ${s.serviceID})\n      Qty: ${s.quantity}  |  Unit Cost: $${s.newCost.toFixed(2)}  |  Unit Price: $${s.newPrice.toFixed(2)}${tag}`;
    }).join('\n');
    return `${'═'.repeat(56)}
  CONTRACT ${idx + 1} OF ${total}
${'═'.repeat(56)}
  COMPANY:        ${c.companyName}
  COMPANY ID:     ${c.companyID}
  CONTRACT:       "${c.contractName}"
  EXISTING ID:    ${c.id}
  CURRENT PERIOD: ${c.startDate}  →  ${c.endDate}
  NEW PERIOD:     ${newStart}  →  ${newEnd}

  SERVICES:
${serviceLines || '    (no services found)'}`;
  }).join('\n\n');

  return `Please renew the following ${total} Autotask contract${total > 1 ? 's' : ''} using the Autotask MCP tools. Handle them one at a time in the order listed.

${sections}

${'═'.repeat(56)}
  INSTRUCTIONS (apply to each contract above)
${'═'.repeat(56)}

For each contract:

STEP 1 — Create the new contract
  Create a new contract for the listed company ID:
    • Contract Name:  same as existing
    • Start Date:     as listed above (NEW PERIOD start)
    • End Date:       as listed above (NEW PERIOD end)
    • Contract Type:  match the existing contract
    • Status:         Active

STEP 2 — Add services
  Add each listed service with the exact quantity, unit cost, and unit price shown.

STEP 3 — Confirm each contract
  After creating each contract, confirm:
    • New contract ID and name
    • Start and end dates
    • Each service with its unit cost and unit price

Do not modify the existing contracts.`;
}

function crBuildAllRenewedPrompt(renewed) {
  if (!renewed.length) return '';
  const sections = renewed.map((c, idx) => {
    const oldId   = c.id;
    const newId   = c.renewal ? c.renewal.id : '(unknown)';
    const newStart = c.renewal ? crFmtDate(c.renewal.startDate) : '—';
    const newEnd   = c.renewal ? crFmtDate(c.renewal.endDate)   : '—';
    return `  ${idx + 1}. ${c.companyName} — "${c.contractName}"
     Old Contract ID: ${oldId}   (ended ${crFmtDate(c.endDate)})
     New Contract ID: ${newId}   (starts ${newStart}, ends ${newEnd})`;
  }).join('\n\n');

  return `Please review the following recently-renewed contracts in Autotask and provide a comparison report for each pair.

For each entry:
1. Look up the OLD contract by ID and list its services with quantities, unit costs, and unit prices
2. Look up the NEW contract by ID and list its services with quantities, unit costs, and unit prices
3. Compare the two and clearly report any differences in:
   • Services added or removed
   • Quantity changes
   • Unit cost changes
   • Unit price changes
   • Contract dates
4. If nothing changed, say "No changes detected"

${'═'.repeat(56)}
CONTRACTS TO COMPARE (${renewed.length} total)
${'═'.repeat(56)}

${sections}

Please work through them in order and present a clean summary for each.`;
}

// ─── MSC Agreements ───────────────────────────────────────────────────────────
async function renderMscAgreements() {
  content.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">MSC Agreements</h1>
        <p class="view-subtitle">Managed Service Client agreement rates — TC &amp; S+ increase % used in Contract Renewals</p>
      </div>
      <button class="btn btn-ghost btn-sm" id="msc-reload-btn">
        <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M13 8A5 5 0 1 1 8 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M8 1l3 2-3 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Reload
      </button>
    </div>
    <div class="view-body">
      <div id="msc-status" class="tool-status" style="display:none"></div>
      <div id="msc-content"></div>
    </div>`;

  document.getElementById('msc-reload-btn').addEventListener('click', () => {
    _mscData = null;
    mscLoad();
  });
  await mscLoad();
}

async function mscLoad() {
  const statusEl  = document.getElementById('msc-status');
  const contentEl = document.getElementById('msc-content');
  if (!statusEl || !contentEl) return;

  statusEl.style.display = '';
  statusEl.className = 'tool-status running';
  statusEl.textContent = 'Loading MSC data…';
  contentEl.innerHTML = '';

  const settings = await window.api.getMscSettings();
  if (!settings.filePath) {
    statusEl.className = 'tool-status warn';
    statusEl.innerHTML = `No file configured. Go to <strong>Settings → General</strong> and set the MSC Agreements file path.`;
    return;
  }

  const res = await window.api.readMscData(settings.filePath);
  if (res.error) {
    statusEl.className = 'tool-status error';
    statusEl.textContent = `Error: ${res.error}`;
    return;
  }

  _mscData = res.data;
  statusEl.style.display = 'none';
  mscRenderTable(res.data);
}

const MSC_COLS = [
  { key: 'company',       label: 'Company',        type: 'text',     align: 'left'   },
  { key: 'userSupport',   label: 'Users',           type: 'number',   align: 'right'  },
  { key: 'msaTotal',      label: 'Monthly MSA',     type: 'currency', align: 'right'  },
  { key: 'month',         label: 'Month',           type: 'text',     align: 'center' },
  { key: 'yearSigned',    label: 'Year Signed',     type: 'text',     align: 'center' },
  { key: 'tcIncrease',    label: 'TC Increase',     type: 'rate',     align: 'center' },
  { key: 'splusIncrease', label: 'S+ Increase',     type: 'rate',     align: 'center' },
  { key: 'industry',      label: 'Industry',        type: 'text',     align: 'left'   },
  { key: 'lifetimeValue', label: 'Lifetime Value',  type: 'currency', align: 'right'  },
];

function mscFmtDisplay(val, type) {
  if (val == null) return '—';
  if (type === 'currency') return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (type === 'rate')     return `${(val * 100).toFixed(1)}%`;
  if (type === 'number')   return String(val);
  return escHtml(String(val));
}

function mscRateClass(val) {
  if (val == null) return 'msc-rate-none';
  return val >= 0.05 ? 'msc-rate-high' : val >= 0.03 ? 'msc-rate-mid' : 'msc-rate-low';
}

function mscCellHtml(r, col) {
  const edited  = _mscEdits[r.rowNum]?.[col.key] !== undefined;
  const val     = edited ? _mscEdits[r.rowNum][col.key] : r[col.key];
  const editCls = edited ? ' msc-edited' : '';
  const alignCls = col.align === 'right' ? ' msc-td-num' : col.align === 'center' ? ' msc-td-center' : '';
  let inner;
  if (col.type === 'rate') {
    inner = `<span class="msc-rate ${mscRateClass(val)}">${mscFmtDisplay(val, 'rate')}</span>`;
  } else {
    inner = mscFmtDisplay(val, col.type);
  }
  return `<td class="msc-cell${alignCls}${editCls}" data-rownum="${r.rowNum}" data-field="${col.key}" data-type="${col.type}">${inner}</td>`;
}

function mscRenderTable(data) {
  const contentEl = document.getElementById('msc-content');
  if (!contentEl) return;

  const total      = data.length;
  const withRates  = data.filter(r => r.tcIncrease != null || r.splusIncrease != null).length;
  const totalMsa   = data.reduce((s, r) => s + (r.msaTotal || 0), 0);
  const avgMonthly = totalMsa / (total || 1);
  const fmtCur     = v => `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const rows = data.map(r =>
    `<tr data-rownum="${r.rowNum}">${MSC_COLS.map(col => mscCellHtml(r, col)).join('')}</tr>`
  ).join('');

  const editCount = Object.keys(_mscEdits).length;

  contentEl.innerHTML = `
    <div class="msc-stats">
      <div class="msc-stat-card"><span class="msc-stat-val">${total}</span><span class="msc-stat-label">Total Clients</span></div>
      <div class="msc-stat-card"><span class="msc-stat-val">${fmtCur(totalMsa)}</span><span class="msc-stat-label">Total Monthly MSA</span></div>
      <div class="msc-stat-card"><span class="msc-stat-val">${fmtCur(avgMonthly)}</span><span class="msc-stat-label">Avg Monthly MSA</span></div>
      <div class="msc-stat-card"><span class="msc-stat-val">${withRates}</span><span class="msc-stat-label">With Increase Rates</span></div>
    </div>
    <div class="msc-toolbar">
      <input type="text" id="msc-search" class="field-input" placeholder="Search by company name…" style="max-width:280px" />
      <span class="field-hint">${total} clients — click any cell to edit</span>
      <div style="margin-left:auto;display:flex;gap:8px;align-items:center">
        <span class="msc-edit-count" id="msc-edit-count" style="${editCount ? '' : 'display:none'}">${editCount} unsaved change${editCount !== 1 ? 's' : ''}</span>
        <button class="btn btn-primary btn-sm" id="msc-save-btn" ${editCount ? '' : 'disabled'}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Save to Excel
        </button>
      </div>
    </div>
    <div class="msc-table-wrap">
      <table class="msc-table">
        <thead><tr>${MSC_COLS.map(c =>
          `<th class="${c.align === 'right' ? 'msc-th-num' : c.align === 'center' ? 'msc-th-center' : ''}">${c.label}</th>`
        ).join('')}</tr></thead>
        <tbody id="msc-tbody">${rows}</tbody>
      </table>
    </div>`;

  // Search filter
  document.getElementById('msc-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('#msc-tbody tr').forEach(tr => {
      tr.style.display = tr.cells[0]?.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  // Inline cell editing
  document.getElementById('msc-tbody').addEventListener('click', e => {
    const td = e.target.closest('.msc-cell');
    if (!td || td.querySelector('input')) return; // already editing

    const rowNum = +td.dataset.rownum;
    const field  = td.dataset.field;
    const type   = td.dataset.type;
    const row    = _mscData.find(r => r.rowNum === rowNum);
    if (!row) return;

    const currentVal = _mscEdits[rowNum]?.[field] !== undefined ? _mscEdits[rowNum][field] : row[field];

    // Determine editable raw value
    let editVal = '';
    if (currentVal != null) {
      if (type === 'rate')     editVal = (currentVal * 100).toFixed(1);
      else if (type === 'currency' || type === 'number') editVal = String(currentVal);
      else editVal = String(currentVal);
    }

    td.innerHTML = `<input class="msc-edit-input" type="${type === 'text' ? 'text' : 'number'}" value="${escHtml(editVal)}" step="${type === 'rate' ? '0.1' : type === 'currency' ? '1' : '1'}" />`;
    const input = td.querySelector('input');
    input.focus();
    input.select();

    const commit = () => {
      const raw = input.value.trim();
      let newVal = null;
      if (raw !== '') {
        if (type === 'rate')     newVal = parseFloat(raw) / 100;
        else if (type === 'currency' || type === 'number') newVal = parseFloat(raw) || null;
        else newVal = raw;
      }

      // Only store if actually changed from original
      const origVal = row[field];
      const changed = newVal !== origVal;
      if (changed) {
        if (!_mscEdits[rowNum]) _mscEdits[rowNum] = {};
        _mscEdits[rowNum][field] = newVal;
      } else if (_mscEdits[rowNum]) {
        delete _mscEdits[rowNum][field];
        if (!Object.keys(_mscEdits[rowNum]).length) delete _mscEdits[rowNum];
      }

      // Re-render just this cell
      const col    = MSC_COLS.find(c => c.key === field);
      const edited = _mscEdits[rowNum]?.[field] !== undefined;
      td.className = `msc-cell${col.align === 'right' ? ' msc-td-num' : col.align === 'center' ? ' msc-td-center' : ''}${edited ? ' msc-edited' : ''}`;
      if (col.type === 'rate') {
        td.innerHTML = `<span class="msc-rate ${mscRateClass(newVal)}">${mscFmtDisplay(newVal, 'rate')}</span>`;
      } else {
        td.innerHTML = mscFmtDisplay(newVal, col.type);
      }

      // Update save button state
      const count    = Object.keys(_mscEdits).length;
      const countEl  = document.getElementById('msc-edit-count');
      const saveBtn  = document.getElementById('msc-save-btn');
      if (countEl) { countEl.textContent = `${count} unsaved change${count !== 1 ? 's' : ''}`; countEl.style.display = count ? '' : 'none'; }
      if (saveBtn)   saveBtn.disabled = count === 0;
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { td.innerHTML = mscCellHtml(row, MSC_COLS.find(c => c.key === field)).replace(/^<td[^>]*>/, '').replace(/<\/td>$/, ''); }
    });
  });

  // Save to Excel
  document.getElementById('msc-save-btn').addEventListener('click', async () => {
    const saveBtn = document.getElementById('msc-save-btn');
    const settings = await window.api.getMscSettings();
    if (!settings.filePath) {
      alert('No file path configured. Go to Settings → General.');
      return;
    }
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    const changes = [];
    for (const [rowNum, fields] of Object.entries(_mscEdits)) {
      for (const [field, value] of Object.entries(fields)) {
        changes.push({ rowNum: +rowNum, field, value });
      }
    }

    const res = await window.api.saveMscData({ filePath: settings.filePath, changes });
    if (res.error) {
      alert(`Save failed: ${res.error}`);
      saveBtn.disabled = false;
      saveBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg> Save to Excel`;
    } else {
      // Apply edits to in-memory data
      for (const { rowNum, field, value } of changes) {
        const row = _mscData.find(r => r.rowNum === rowNum);
        if (row) row[field] = value;
      }
      _mscEdits = {};
      const countEl = document.getElementById('msc-edit-count');
      if (countEl) countEl.style.display = 'none';
      saveBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg> Save to Excel`;
      saveBtn.disabled = true;
      // Flash success
      const statusEl = document.getElementById('msc-status');
      if (statusEl) { statusEl.className = 'tool-status success'; statusEl.style.display = ''; statusEl.textContent = `✓ ${res.count} change${res.count !== 1 ? 's' : ''} saved to Excel.`; }
      setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 3000);
    }
  });
}

function crFmtDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function crDateAdd(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function crDateAddYears(dateStr, years) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split('T')[0];
}

// ─── Renewal Settings UI (used by renderSettings) ─────────────────────────────
async function loadRenewalSettingsUI() {
  try {
    const s = await window.api.getRenewalSettings();
    const elSvc   = document.getElementById('renewal-eligible');
    const elPrompt = document.getElementById('renewal-info-prompt');
    if (elSvc)    elSvc.value    = (s.eligibleServices || []).join('\n');
    if (elPrompt) elPrompt.value = s.renewalInfoPrompt || '';
  } catch (e) { console.warn('loadRenewalSettingsUI:', e.message); }
}

async function saveRenewalSettingsUI() {
  // Status may be on either the General tab or the Prompts tab button — update both
  const statusEls = [
    document.getElementById('renewal-settings-status'),
    document.getElementById('renewal-eligible-status'),
  ].filter(Boolean);
  const elSvc    = document.getElementById('renewal-eligible');
  const elPrompt = document.getElementById('renewal-info-prompt');
  if (!elSvc) return;
  const lines = elSvc.value.split('\n').map(l => l.trim()).filter(Boolean);
  const renewalInfoPrompt = elPrompt ? elPrompt.value : '';
  try {
    await window.api.saveRenewalSettings({ eligibleServices: lines, renewalInfoPrompt });
    statusEls.forEach(s => { s.textContent = '✓ Saved'; s.className = 'save-status success'; });
  } catch (e) {
    statusEls.forEach(s => { s.textContent = `Error: ${e.message}`; s.className = 'save-status error'; });
  }
  setTimeout(() => { statusEls.forEach(s => { s.textContent = ''; }); }, 2500);
}

async function loadMscSettingsUI() {
  try {
    const s  = await window.api.getMscSettings();
    const el = document.getElementById('msc-file-path');
    if (el) el.value = s.filePath || '';
  } catch (e) { console.warn('loadMscSettingsUI:', e.message); }
}

async function saveMscSettingsUI() {
  const statusEl = document.getElementById('msc-settings-status');
  const pathEl   = document.getElementById('msc-file-path');
  if (!pathEl) return;
  try {
    await window.api.saveMscSettings({ filePath: pathEl.value.trim() });
    _mscData = null; // clear cache so next use re-reads from file
    if (statusEl) { statusEl.textContent = '✓ Saved'; statusEl.className = 'save-status success'; }
  } catch (e) {
    if (statusEl) { statusEl.textContent = `Error: ${e.message}`; statusEl.className = 'save-status error'; }
  }
  setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 2500);
}

// ─── BlackPoint Endpoint Usage ────────────────────────────────────────────────
let bpData = null;

function renderBlackpointProcessor() {
  content.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">BlackPoint Endpoint Usage</h1>
        <p class="view-subtitle">Track protected endpoint counts per client and identify billing deltas month over month</p>
      </div>
      <div class="view-actions">
        <button class="btn btn-ghost btn-sm" id="bp-export-btn" disabled>
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M1 10v1.5A1.5 1.5 0 002.5 13h9A1.5 1.5 0 0013 11.5V10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          Export Excel
        </button>
        <button class="btn btn-primary" id="bp-run-btn">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/>
            <path d="M5.5 4.5l4 2.5-4 2.5V4.5z" fill="currentColor"/>
          </svg>
          Run Query
        </button>
      </div>
    </div>
    <div class="view-body">
      <div id="bp-status" class="bp-status-area" style="display:none"></div>
      <div id="bp-results"></div>
    </div>`;

  document.getElementById('bp-run-btn').addEventListener('click', bpRunQuery);
  document.getElementById('bp-export-btn').addEventListener('click', bpExportReport);

  // Restore previous results if available
  if (bpData) bpRenderResults();
}

async function bpRunQuery() {
  const runBtn    = document.getElementById('bp-run-btn');
  const statusDiv = document.getElementById('bp-status');
  const resultsDiv = document.getElementById('bp-results');
  if (!runBtn || !statusDiv) return;

  runBtn.disabled = true;
  statusDiv.style.display = '';
  statusDiv.innerHTML = `
    <div class="bp-loading">
      <span class="spinner" style="width:14px;height:14px;border-width:2px"></span>
      <span>Fetching tenants and endpoint counts from BlackPoint… This may take a minute.</span>
    </div>`;
  if (resultsDiv) resultsDiv.innerHTML = '';

  try {
    bpData = await window.api.runBlackpointUsage();
    statusDiv.style.display = 'none';
    bpRenderResults();
    const exportBtn = document.getElementById('bp-export-btn');
    if (exportBtn) exportBtn.disabled = false;
    saveToolStat('blackpoint-processor', `${bpData.totalTenants} tenants · ${bpData.totalActive} active agents`, 'ok');
  } catch (e) {
    statusDiv.innerHTML = `<div class="bp-error"><strong>Error:</strong> ${escHtml(e.message)}</div>`;
    saveToolStat('blackpoint-processor', `Error: ${e.message}`, 'error');
  } finally {
    runBtn.disabled = false;
  }
}

function bpRenderResults() {
  const el = document.getElementById('bp-results');
  if (!el || !bpData) return;

  const { tenants, prevDate, totalTenants, totalActive } = bpData;

  const increased  = tenants.filter(t => t.delta > 0).length;
  const decreased  = tenants.filter(t => t.delta < 0).length;
  const newClients = tenants.filter(t => t.delta == null && !t.error).length;
  const noChange   = tenants.filter(t => t.delta === 0).length;
  const errCount   = tenants.filter(t => t.error).length;

  const fmtDate = iso => iso
    ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;
  const prevDateStr = fmtDate(prevDate);
  const runDateStr  = fmtDate(bpData.runDate) || 'Today';

  const rows = tenants.map(t => {
    const status = t.error     ? 'error'
                 : t.delta == null ? 'new'
                 : t.delta > 0     ? 'up'
                 : t.delta < 0     ? 'down'
                 :                   'same';
    const statusLabel = t.error     ? 'Error'
                      : t.delta == null ? 'New'
                      : t.delta > 0     ? `▲ +${t.delta}`
                      : t.delta < 0     ? `▼ ${t.delta}`
                      :                   '✓';
    const deltaHtml = t.delta == null   ? '<span class="bp-delta-new">New</span>'
                    : t.delta > 0       ? `<span class="bp-delta-up">+${t.delta}</span>`
                    : t.delta < 0       ? `<span class="bp-delta-down">${t.delta}</span>`
                    :                     `<span class="bp-delta-same">—</span>`;
    return `
      <tr class="bp-row">
        <td class="bp-td-name">${escHtml(t.name)}</td>
        <td class="bp-td-num">${t.activeAgents != null ? t.activeAgents : '<span class="bp-err-text">Error</span>'}</td>
        <td class="bp-td-num bp-td-prev">${t.prevActiveAgents != null ? t.prevActiveAgents : '—'}</td>
        <td class="bp-td-delta">${deltaHtml}</td>
        <td class="bp-td-status"><span class="bp-badge bp-badge-${status}">${statusLabel}</span></td>
      </tr>`;
  }).join('');

  el.innerHTML = `
    <div class="bp-summary">
      <div class="bp-sum-item">
        <span class="bp-sum-num">${totalTenants}</span>
        <span class="bp-sum-lbl">Tenants</span>
      </div>
      <div class="bp-sum-item">
        <span class="bp-sum-num">${totalActive}</span>
        <span class="bp-sum-lbl">Active Agents</span>
      </div>
      ${prevDate ? `
      <div class="bp-sum-item bp-sum-up">
        <span class="bp-sum-num">${increased}</span>
        <span class="bp-sum-lbl">Increased</span>
      </div>
      <div class="bp-sum-item bp-sum-down">
        <span class="bp-sum-num">${decreased}</span>
        <span class="bp-sum-lbl">Decreased</span>
      </div>
      <div class="bp-sum-item bp-sum-new">
        <span class="bp-sum-num">${newClients}</span>
        <span class="bp-sum-lbl">New</span>
      </div>
      <div class="bp-sum-item bp-sum-same">
        <span class="bp-sum-num">${noChange}</span>
        <span class="bp-sum-lbl">No Change</span>
      </div>` : ''}
      ${errCount ? `<div class="bp-sum-item bp-sum-err"><span class="bp-sum-num">${errCount}</span><span class="bp-sum-lbl">Errors</span></div>` : ''}
      <div class="bp-sum-snapshot">
        ${prevDateStr
          ? `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.2"/><path d="M6 3.5V6l1.5 1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg> Snapshot: ${prevDateStr} → ${runDateStr}`
          : `<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.2"/><path d="M6 3.5V6l1.5 1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg> First run — saved as baseline`}
      </div>
    </div>

    <table class="bp-table">
      <thead>
        <tr>
          <th>Company</th>
          <th style="text-align:center">Active Agents</th>
          <th style="text-align:center">Previous</th>
          <th style="text-align:center">Change</th>
          <th style="text-align:center">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="bp-prompt-box">
      <div class="bp-prompt-hdr">
        <div>
          <div class="bp-prompt-title">Generate Autotask Update Prompt</div>
          <div class="bp-prompt-sub">Creates a Claude MCP prompt to update Security+ service quantities in Autotask for all clients.</div>
        </div>
        <button class="btn btn-primary btn-sm" id="bp-gen-btn">Generate Prompt</button>
      </div>
      <div id="bp-prompt-wrap" style="display:none">
        <textarea class="bp-prompt-ta" id="bp-prompt-ta" rows="22" readonly></textarea>
        <div class="cr-prompt-actions">
          <button class="btn btn-ghost btn-sm" id="bp-copy-btn">Copy</button>
        </div>
      </div>
    </div>`;

  document.getElementById('bp-gen-btn').addEventListener('click', () => {
    const wrap = document.getElementById('bp-prompt-wrap');
    const ta   = document.getElementById('bp-prompt-ta');
    if (!wrap || !ta) return;
    ta.value = bpBuildPrompt(tenants);
    wrap.style.display = '';
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  document.getElementById('bp-copy-btn').addEventListener('click', () => {
    const ta = document.getElementById('bp-prompt-ta');
    if (ta) navigator.clipboard.writeText(ta.value).catch(() => {});
  });
}

function bpBuildPrompt(tenants) {
  const runDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const lines = tenants
    .filter(t => t.activeAgents != null)
    .map(t => {
      const note = t.delta == null    ? ' (NEW client — no prior count)'
                 : t.delta > 0        ? ` (+${t.delta} since last snapshot)`
                 : t.delta < 0        ? ` (${t.delta} since last snapshot)`
                 :                      '';
      return `  - ${t.name}: ${t.activeAgents} active agent${t.activeAgents !== 1 ? 's' : ''}${note}`;
    })
    .join('\n');

  return `# BlackPoint Endpoint Count — Autotask Security+ Update
# Generated: ${runDate}

## Task
The list below shows the current BlackPoint CompassOne protected endpoint (active agent) count for each client as of ${runDate}. Please update each client's **Security+** contract service quantity in Autotask to match their current agent count.

## Current BlackPoint Active Agent Counts
${lines}

## Instructions
Work through each client listed above:
1. Use autotask_search_companies to find the company by name
2. Use autotask_search_contracts to find their active contract (status = 1)
3. Look for a ContractService where the service name contains "Security+" (you can use autotask_search_services or look at the contract's services)
4. Compare the current unit quantity against the BlackPoint count above
5. If the quantity doesn't match, update it with autotask_update_contract_service
6. If a client can't be found or has no Security+ service, note it and move on

When finished, provide a summary:
- ✅ Updated: [company] — [old qty] → [new qty]
- ✓ Already correct: [company] — [qty] matches
- ⚠ Not found: [company] — [reason]`;
}

async function bpExportReport() {
  if (!bpData) return;
  const btn = document.getElementById('bp-export-btn');
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Exporting…'; }
  try {
    const res = await window.api.exportBlackpointReport(bpData);
    if (res.error) alert(`Export failed: ${res.error}`);
  } catch (e) {
    alert(`Export failed: ${e.message}`);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
  }
}

// ─── Help ─────────────────────────────────────────────────────────────────────
function renderHelp() {
  const SECTIONS = [
    {
      id: 'getting-started',
      icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1l1.8 3.6L14 5.6l-3 2.9.7 4.1L8 10.5l-3.7 2.1.7-4.1-3-2.9 4.2-.9L8 1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
      title: 'Getting Started',
      open: true,
      body: `
        <p class="help-intro">Follow these steps to get Anchor Hub fully configured. The whole process takes about 5 minutes.</p>
        <ol class="help-steps">
          <li>
            <span class="help-step-num">1</span>
            <div>
              <strong>Open Settings → API &amp; Accounts</strong>
              <p>Click the Settings button at the bottom of the sidebar, then select the <em>API &amp; Accounts</em> tab.</p>
            </div>
          </li>
          <li>
            <span class="help-step-num">2</span>
            <div>
              <strong>Enter your Pax8 credentials</strong>
              <p>Add your Pax8 OAuth2 Client ID and Client Secret. See the <em>API Keys</em> section below for where to find these.</p>
            </div>
          </li>
          <li>
            <span class="help-step-num">3</span>
            <div>
              <strong>Enter your Autotask credentials</strong>
              <p>Add your API Username, API Key, and Integration Code. Click <strong>Detect</strong> to auto-detect your Autotask data center zone — this only needs to be done once.</p>
            </div>
          </li>
          <li>
            <span class="help-step-num">4</span>
            <div>
              <strong>Save your credentials</strong>
              <p>Click <strong>Save Credentials</strong>. All credentials are stored securely in Windows Credential Manager — never in plain text on disk.</p>
            </div>
          </li>
          <li>
            <span class="help-step-num">5</span>
            <div>
              <strong>Run Company Mapping</strong>
              <p>Navigate to <em>Company Mapping</em> and run a sync. This links your Pax8 companies to their matching Autotask accounts and is required for most tools to work correctly.</p>
            </div>
          </li>
          <li>
            <span class="help-step-num">6</span>
            <div>
              <strong>(Optional) Add your Claude API key</strong>
              <p>Required only for the AI analysis feature in Pax8 Invoice Comparison. Add it under Settings → API &amp; Accounts → Claude.</p>
            </div>
          </li>
        </ol>`
    },
    {
      id: 'api-keys',
      icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="10" r="3.5" stroke="currentColor" stroke-width="1.3"/><path d="M8.5 7.5L13 3M13 3h-2.5M13 3v2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      title: 'Where to Find Your API Keys',
      body: `
        <div class="help-api-block">
          <div class="help-api-header">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M1 6h14" stroke="currentColor" stroke-width="1.3"/></svg>
            Pax8
          </div>
          <ol class="help-api-steps">
            <li>Log in to <strong>partner.pax8.com</strong></li>
            <li>Click your profile icon (top right) → <strong>Profile</strong></li>
            <li>Scroll to <strong>Client Credentials</strong> → click <strong>Generate Credentials</strong></li>
            <li>Copy the <strong>Client ID</strong> and <strong>Client Secret</strong> — the secret is only shown once</li>
          </ol>
        </div>

        <div class="help-api-block">
          <div class="help-api-header">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2C5.79 2 4 3.79 4 6v1H3a1 1 0 00-1 1v5a1 1 0 001 1h10a1 1 0 001-1V8a1 1 0 00-1-1h-1V6c0-2.21-1.79-4-4-4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
            Autotask PSA — API Username &amp; Key
          </div>
          <ol class="help-api-steps">
            <li>Go to <strong>Admin → Resources (Users)</strong></li>
            <li>Create a new resource (or use an existing one) — set the <strong>Security Level</strong> to <em>API User (System)</em></li>
            <li>The <strong>email address</strong> of that resource is your API Username</li>
            <li>On the resource record, go to the <strong>API Tracking Identifier</strong> tab → <strong>Generate Key</strong></li>
            <li>Copy the generated key — this is your API Key</li>
          </ol>
        </div>

        <div class="help-api-block">
          <div class="help-api-header">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 2C5.79 2 4 3.79 4 6v1H3a1 1 0 00-1 1v5a1 1 0 001 1h10a1 1 0 001-1V8a1 1 0 00-1-1h-1V6c0-2.21-1.79-4-4-4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
            Autotask PSA — Integration Code
          </div>
          <ol class="help-api-steps">
            <li>Go to <strong>Admin → Extensions &amp; Integrations → Other Extensions &amp; Tools → Web Services API</strong></li>
            <li>Click <strong>New</strong> to create a tracking identifier</li>
            <li>Give it a name (e.g. <em>Anchor Hub</em>) and save</li>
            <li>Copy the generated <strong>GUID</strong> — this is your Integration Code</li>
          </ol>
        </div>

        <div class="help-api-block">
          <div class="help-api-header">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            Claude (Anthropic) — Optional
          </div>
          <ol class="help-api-steps">
            <li>Go to <strong>console.anthropic.com</strong> and sign in</li>
            <li>Click <strong>API Keys</strong> in the left sidebar → <strong>Create Key</strong></li>
            <li>Copy the key — it starts with <code>sk-ant-</code></li>
            <li>This is only required for the AI analysis feature in <em>Pax8 Invoice Comparison</em></li>
          </ol>
        </div>`
    },
    {
      id: 'tools',
      icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M5 8h6M5 5h3M5 11h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
      title: 'Tools Overview',
      body: `
        <div class="help-tool-grid">
          <div class="help-tool-card">
            <div class="help-tool-name">M365 Subscription Comparison</div>
            <p>Compares your Microsoft 365 subscriptions between Pax8 and Autotask contract services to surface billing discrepancies — seats that exist in one system but not the other. Run this monthly before invoicing clients.</p>
          </div>
          <div class="help-tool-card">
            <div class="help-tool-name">Pax8 Invoice Comparison</div>
            <p>Pulls a Pax8 invoice and compares line items against Autotask contract services to detect price changes, new charges, and removed items. Optionally uses Claude AI to summarize what changed and why.</p>
          </div>
          <div class="help-tool-card">
            <div class="help-tool-name">M365 Margin Analyzer</div>
            <p>Pulls Autotask contract service pricing and compares it against current Pax8 costs to show your margin per client. Identifies underpriced services and helps you stay ahead of cost increases.</p>
          </div>
          <div class="help-tool-card">
            <div class="help-tool-name">Company Mapping</div>
            <p>Syncs and manages the link between your Pax8 company names and their matching Autotask accounts. Run this first during setup and again whenever you add new clients. Most other tools depend on accurate mappings.</p>
          </div>
          <div class="help-tool-card">
            <div class="help-tool-name">Pax8 Invoice Processor</div>
            <p>Downloads and processes Pax8 invoices into a structured breakdown by client. Generates Claude MCP prompts to update Autotask contract service quantities and Azure costs automatically.</p>
          </div>
          <div class="help-tool-card">
            <div class="help-tool-name">Kaseya Invoice Processor</div>
            <p>Imports Kaseya/Datto invoices and splits costs across QuickBooks Online accounts and classes based on your configured percentages (PSA, RMM, IT Glue, bundled products). Generates an Autotask update prompt.</p>
          </div>
          <div class="help-tool-card">
            <div class="help-tool-name">Autotask Contract Changes</div>
            <p>Audits recent changes made to Autotask contracts — showing who changed what field and when. Useful for tracking unexpected modifications, auditing renewals, and seeing what the AI updated after running a prompt.</p>
          </div>
          <div class="help-tool-card">
            <div class="help-tool-name">Autotask Contract Renewals</div>
            <p>Finds active contracts expiring within your chosen window (30/60/90 days) that don't have a renewal on record. Review services, adjust pricing, and generate a Claude MCP prompt to create the renewal contract — individually or as a batch for multiple clients at once.</p>
          </div>
          <div class="help-tool-card">
            <div class="help-tool-name">BlackPoint Usage</div>
            <p>Fetches the current protected endpoint (active agent) count for every client from the BlackPoint CompassOne API. Compares against the last saved snapshot to show month-over-month changes, then generates a Claude MCP prompt to update Security+ service quantities in Autotask to match.</p>
          </div>
        </div>`
    },
    {
      id: 'troubleshooting',
      icon: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8 4.5v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11" r="0.8" fill="currentColor"/></svg>`,
      title: 'Troubleshooting',
      body: `
        <div class="help-faq">
          <div class="help-faq-item">
            <div class="help-faq-q">The app says my credentials are invalid</div>
            <p>Go to <strong>Settings → API &amp; Accounts</strong> and re-enter your credentials. Make sure there are no leading or trailing spaces — especially in copied API keys. Click Save, then try the tool again.</p>
          </div>
          <div class="help-faq-item">
            <div class="help-faq-q">Autotask zone detection isn't working</div>
            <p>Make sure your API <strong>Username</strong> is filled in first — the zone is derived from your username's associated data center. Then click <strong>Detect</strong>. If it still fails, your zone can be found in the Autotask URL when you're logged in (e.g. <code>ww14</code> in <code>ww14.autotask.net</code>).</p>
          </div>
          <div class="help-faq-item">
            <div class="help-faq-q">Contract Renewals is still showing project contracts</div>
            <p>The tool filters by <strong>Contract Category</strong> (not Contract Type). If your Autotask instance uses a non-standard category name for projects, they may still appear. You can identify them by the contract name and ignore them — this will be configurable in a future update.</p>
          </div>
          <div class="help-faq-item">
            <div class="help-faq-q">Company Mapping shows no matches</div>
            <p>Make sure both Pax8 and Autotask credentials are saved, then run a fresh sync from the <em>Company Mapping</em> tool. The matching is fuzzy but requires reasonably similar company names in both systems.</p>
          </div>
          <div class="help-faq-item">
            <div class="help-faq-q">No contracts or subscriptions are loading</div>
            <p>Check that your Autotask API user has sufficient permissions — it needs read access to Contracts, ContractServices, and Companies at minimum. The API user's Security Level should be <em>API User (System)</em>.</p>
          </div>
          <div class="help-faq-item">
            <div class="help-faq-q">An update is available but won't download</div>
            <p>Click <strong>Check for Updates</strong> on the Home page to trigger a manual check. Make sure you're connected to the internet. If it still fails, you can download the latest installer directly from the <a href="https://github.com/MikeS-ANS/Anchor-Hub/releases" target="_blank" class="help-link">GitHub Releases page</a>.</p>
          </div>
          <div class="help-faq-item">
            <div class="help-faq-q">The app won't open after an update</div>
            <p>Download and run the latest installer from the <a href="https://github.com/MikeS-ANS/Anchor-Hub/releases" target="_blank" class="help-link">GitHub Releases page</a>. A fresh install over the top will fix most post-update issues without affecting your saved settings.</p>
          </div>
          <div class="help-faq-item">
            <div class="help-faq-q">A Claude prompt ran but nothing changed in Autotask</div>
            <p>Claude uses the Autotask MCP tools to make changes — make sure you're running Claude with the Autotask MCP server connected and authenticated before pasting a generated prompt. You can verify the connection with the test tool in the Autotask MCP server.</p>
          </div>
        </div>`
    }
  ];

  content.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Help</h1>
        <p class="view-subtitle">Setup guide, API key locations, tool descriptions, and troubleshooting</p>
      </div>
    </div>
    <div class="view-body help-body">
      ${SECTIONS.map(s => `
        <div class="help-section ${s.open ? 'help-open' : ''}" data-id="${s.id}">
          <div class="help-section-header">
            <span class="help-icon">${s.icon}</span>
            <span class="help-section-title">${s.title}</span>
            <span class="help-chevron">${s.open ? '▼' : '▶'}</span>
          </div>
          <div class="help-section-body" ${s.open ? '' : 'style="display:none"'}>
            ${s.body}
          </div>
        </div>`).join('')}
      <div class="help-footer">
        <span>Anchor Hub · v<span id="help-version">…</span></span>
        <a href="https://github.com/MikeS-ANS/Anchor-Hub/releases" target="_blank" class="help-link">GitHub Releases</a>
        <a href="https://github.com/MikeS-ANS/Anchor-Hub/issues" target="_blank" class="help-link">Report an Issue</a>
      </div>
    </div>`;

  // Accordion toggle
  content.querySelectorAll('.help-section-header').forEach(header => {
    header.addEventListener('click', () => {
      const sec   = header.closest('.help-section');
      const body  = sec.querySelector('.help-section-body');
      const chev  = header.querySelector('.help-chevron');
      const open  = sec.classList.toggle('help-open');
      body.style.display = open ? '' : 'none';
      chev.textContent   = open ? '▼' : '▶';
    });
  });

  // Show version
  window.api.getAppVersion().then(v => {
    const el = document.getElementById('help-version');
    if (el) el.textContent = v;
  }).catch(() => {});
}

// ─── Duo Management ───────────────────────────────────────────────────────────
function renderDuoManagement() {
  const content = document.getElementById('content');

  const roles = _currentUser?.roles || [];
  const isFullAccess = roles.includes('hub.it') || roles.includes('hub.admin');
  const isStandard   = roles.includes('hub.standard');
  const hasAccess    = isFullAccess || isStandard;

  if (!hasAccess) {
    content.innerHTML = `
      <div class="tool-header"><h2>Duo Management</h2></div>
      <div style="display:flex;align-items:center;justify-content:center;height:200px;
                  color:var(--text-muted);font-size:14px;flex-direction:column;gap:8px;">
        <div style="font-size:20px;">🔒</div>
        <div>You need the <strong style="color:var(--text-primary);">hub.it</strong> or <strong style="color:var(--text-primary);">hub.standard</strong> role to access this tool.</div>
      </div>`;
    return;
  }

  // admin:true tabs are hidden from hub.standard users
  const ALL_TABS = [
    { key: 'audit',         label: 'Audit',               admin: true  },
    { key: 'new-hire',      label: 'New Hire',             admin: true  },
    { key: 'termination',   label: 'Termination',          admin: true  },
    { key: 'new-sub',       label: 'New Client Account',   admin: true  },
    { key: 'new-user',      label: 'New Client User',      admin: false },
    { key: 'phone-replace', label: 'Replace Phone',        admin: false },
    { key: 'offboard-user', label: 'Offboard User',        admin: false },
    { key: 'term-sub',      label: 'Term Client Account',  admin: true  },
  ];

  const TABS = isFullAccess ? ALL_TABS : ALL_TABS.filter(t => !t.admin);

  let activeTab   = TABS[0].key;
  let isRunning   = false;
  let prefillTerm = null; // { email, phone } — set by "Start Termination" from Audit

  function render() {
    content.innerHTML = `
      <div class="tool-header">
        <h2>Duo Management</h2>
        <p class="tool-subtitle">Manage Duo MFA for employee onboarding and offboarding</p>
      </div>

      <div style="display:flex;gap:6px;margin-bottom:20px;flex-wrap:wrap;">
        ${TABS.map(t => `
          <button data-duo-tab="${t.key}" style="
            padding:8px 18px;border-radius:6px;cursor:pointer;font-size:14px;font-weight:600;
            border:2px solid ${activeTab===t.key ? 'var(--accent)' : 'var(--border)'};
            background:${activeTab===t.key ? 'rgba(99,102,241,.12)' : 'transparent'};
            color:${activeTab===t.key ? 'var(--accent)' : 'var(--text-muted)'};
            transition:all .15s;">
            ${t.label}
          </button>`).join('')}
      </div>

      <div id="duo-tab-content"></div>`;

    content.querySelectorAll('[data-duo-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.dataset.duoTab;
        render();
      });
    });

    const tc = document.getElementById('duo-tab-content');
    if      (activeTab === 'new-hire')    renderNewHireTab(tc);
    else if (activeTab === 'termination') renderTermTab(tc);
    else if (activeTab === 'audit')       renderAuditTab(tc);
    else if (activeTab === 'new-sub')     renderNewSubTab(tc);
    else if (activeTab === 'new-user')      renderNewUserTab(tc);
    else if (activeTab === 'phone-replace') renderPhoneReplaceTab(tc);
    else if (activeTab === 'offboard-user') renderOffboardUserTab(tc);
    else if (activeTab === 'term-sub')      renderTermSubTab(tc);
  }

  // ── Shared helpers ──────────────────────────────────────────────────────────
  function makeLogEl(id) {
    return `<div id="${id}" style="font-family:monospace;font-size:12px;min-height:280px;
      max-height:420px;overflow-y:auto;background:var(--bg-secondary);border-radius:6px;
      padding:12px;color:var(--text-muted);">Ready — fill in the form and click Run.</div>`;
  }

  function appendLog(logEl, msg, type) {
    const colors = { error: '#f87171', success: '#4ade80', warn: '#fbbf24' };
    const line = document.createElement('div');
    line.style.cssText = `color:${colors[type] || 'var(--text-primary)'};margin-bottom:3px;`;
    line.textContent = msg;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function inputStyle() {
    return `width:100%;box-sizing:border-box;padding:8px 10px;background:var(--bg-secondary);
            border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:13px;`;
  }

  function labelStyle() {
    return `font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;`;
  }

  // ── New Hire Tab ────────────────────────────────────────────────────────────
  function renderNewHireTab(tc) {
    tc.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="glass-card" style="padding:20px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:16px;">Employee Details</div>

          <div style="margin-bottom:12px;">
            <label style="${labelStyle()}">Full Name</label>
            <input id="duo-nh-name" type="text" placeholder="Jane Smith" style="${inputStyle()}">
          </div>
          <div style="margin-bottom:12px;">
            <label style="${labelStyle()}">Work Email</label>
            <input id="duo-nh-email" type="email" placeholder="jane.smith@example.com" style="${inputStyle()}">
          </div>
          <div style="margin-bottom:16px;">
            <label style="${labelStyle()}">Mobile Phone Number</label>
            <input id="duo-nh-phone" type="tel" placeholder="+13055551234" style="${inputStyle()}">
          </div>

          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;
                        font-size:13px;margin-bottom:10px;">
            <input id="duo-nh-admin-chk" type="checkbox">
            Create as Duo Admin (parent account)
          </label>
          <div id="duo-admin-opts" style="display:none;margin-left:22px;padding:12px;
               background:var(--bg-secondary);border-radius:6px;margin-bottom:14px;">
            <label style="${labelStyle()}">Admin Role</label>
            <select id="duo-nh-role" style="${inputStyle()}padding:7px 10px;background:#1a1d2e;color:#e8e8e8;">
              <option value="help_desk"           style="background:#1a1d2e;color:#e8e8e8;">Help Desk</option>
              <option value="read_only"           style="background:#1a1d2e;color:#e8e8e8;">Read-only</option>
              <option value="user_manager"        style="background:#1a1d2e;color:#e8e8e8;">User Manager</option>
              <option value="security_analyst"    style="background:#1a1d2e;color:#e8e8e8;">Security Analyst</option>
              <option value="application_manager" style="background:#1a1d2e;color:#e8e8e8;">Application Manager</option>
              <option value="service_manager"     style="background:#1a1d2e;color:#e8e8e8;">Administrator</option>
              <option value="owner"               style="background:#1a1d2e;color:#e8e8e8;">Owner</option>
            </select>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;
                          font-size:13px;margin-top:10px;">
              <input id="duo-nh-send-email" type="checkbox" checked>
              Send activation email to new admin
            </label>
          </div>

          <button id="duo-nh-run" style="width:100%;padding:9px;background:var(--accent);
            border:none;border-radius:6px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">
            Run New Hire Setup
          </button>
        </div>

        <div class="glass-card" style="padding:20px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:12px;">Progress</div>
          ${makeLogEl('duo-nh-log')}
        </div>
      </div>`;

    document.getElementById('duo-nh-admin-chk').addEventListener('change', e => {
      document.getElementById('duo-admin-opts').style.display = e.target.checked ? '' : 'none';
    });

    document.getElementById('duo-nh-run').addEventListener('click', async () => {
      if (isRunning) return;
      const name      = document.getElementById('duo-nh-name').value.trim();
      const email     = document.getElementById('duo-nh-email').value.trim();
      const phone     = document.getElementById('duo-nh-phone').value.trim();
      const mkAdmin   = document.getElementById('duo-nh-admin-chk').checked;
      const roleId    = document.getElementById('duo-nh-role')?.value || 'help_desk';
      const sendEmail = document.getElementById('duo-nh-send-email')?.checked ?? true;

      if (!name || !phone) { alert('Full name and phone number are required.'); return; }

      const logEl = document.getElementById('duo-nh-log');
      logEl.innerHTML = '';
      const log = (msg, type) => appendLog(logEl, msg, type);
      isRunning = true;
      document.getElementById('duo-nh-run').disabled = true;

      try {
        // Step 1 (optional) — create admin in parent account
        if (mkAdmin) {
          if (!email) { log('⚠ Email required to create admin — skipping admin creation.', 'warn'); }
          else {
            log('→ Creating Duo admin account…');
            const r = await window.api.duoCreateAdmin({ email, name, phone, roleId, sendEmail });
            if (r.error) log(`✗ Create admin: ${r.error}`, 'error');
            else {
              log(`✓ Admin created: ${r.admin.name} (${r.admin.role || roleId})`, 'success');
              if (sendEmail) log(`  Activation email queued for ${email}`);
            }
          }
        }

        // Step 2 — find anchor user(s)
        log('→ Looking up anchor user…');
        const usersR = await window.api.duoFindUsers('anchor');
        if (usersR.error) { log(`✗ Anchor user lookup: ${usersR.error}`, 'error'); return; }
        if (!usersR.users.length) {
          log('✗ No user with username "anchor" found in Duo.', 'error'); return;
        }
        log(`✓ Found ${usersR.users.length} anchor user(s)`);

        // Step 3 — create phone
        log(`→ Creating phone ${phone}…`);
        const phoneR = await window.api.duoCreatePhone({ number: phone, name });
        if (phoneR.error) { log(`✗ Create phone: ${phoneR.error}`, 'error'); return; }
        const phoneId = phoneR.phone.phone_id;
        log(`✓ Phone created (${phone})`);

        // Step 4 — associate with each anchor user
        for (const user of usersR.users) {
          log(`→ Associating with anchor user (${user.user_id})…`);
          const assocR = await window.api.duoAssociatePhone({ userId: user.user_id, phoneId });
          if (assocR.error) log(`✗ Associate: ${assocR.error}`, 'error');
          else log(`✓ Phone associated`, 'success');
        }

        // Step 5 — send SMS activation (parent)
        log('→ Sending Duo Mobile activation SMS…');
        const actR = await window.api.duoSendActivation(phoneId);
        if (actR.error) log(`✗ Activation SMS: ${actR.error}`, 'error');
        else log('✓ Activation SMS sent (install link included)', 'success');

        // Step 6 — repeat for each sub-account
        log('──────────────────────────────────');
        log('→ Loading sub-accounts…');
        const subListR = await window.api.duoListSubAccounts();
        if (subListR.error) {
          log(`✗ Sub-account list: ${subListR.error}`, 'error');
        } else {
          log(`  ${subListR.accounts.length} sub-accounts found`);
          for (const acct of subListR.accounts) {
            log(`→ [${acct.name}]`);
            const suR = await window.api.duoSubFindUsers({ accountId: acct.account_id, username: 'anchor' });
            if (suR.error) { log(`  ✗ Anchor lookup: ${suR.error}`, 'error'); continue; }
            if (!suR.users.length) { log(`  — No anchor user found, skipping`); continue; }
            const subUser = suR.users[0];

            const spR = await window.api.duoSubCreatePhone({ accountId: acct.account_id, number: phone, name });
            if (spR.error) { log(`  ✗ Create phone: ${spR.error}`, 'error'); continue; }
            const subPhoneId = spR.phone.phone_id;

            const saR = await window.api.duoSubAssociatePhone({ accountId: acct.account_id, userId: subUser.user_id, phoneId: subPhoneId });
            if (saR.error) { log(`  ✗ Associate: ${saR.error}`, 'error'); continue; }

            const ssR = await window.api.duoSubSendActivation({ accountId: acct.account_id, phoneId: subPhoneId });
            if (ssR.error) { log(`  ✗ Activation SMS: ${ssR.error}`, 'error'); continue; }

            log(`  ✓ Done`, 'success');
          }
        }

        log('──────────────────────────────────');
        log('New hire setup complete.', 'success');
      } finally {
        isRunning = false;
        const btn = document.getElementById('duo-nh-run');
        if (btn) btn.disabled = false;
      }
    });
  }

  // ── Termination Tab ─────────────────────────────────────────────────────────
  function renderTermTab(tc) {
    tc.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="glass-card" style="padding:20px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:16px;">Employee to Remove</div>

          <div style="margin-bottom:12px;">
            <label style="${labelStyle()}">Work Email <span style="color:var(--text-muted);font-weight:400;">(for admin account deletion)</span></label>
            <input id="duo-term-email" type="email" placeholder="jane.smith@example.com" style="${inputStyle()}">
          </div>
          <div style="margin-bottom:20px;">
            <label style="${labelStyle()}">Mobile Phone Number <span style="color:var(--text-muted);font-weight:400;">(to remove from Duo)</span></label>
            <input id="duo-term-phone" type="tel" placeholder="+13055551234" style="${inputStyle()}">
          </div>

          <div style="margin-bottom:16px;padding:10px 12px;background:#7f1d1d22;
               border:1px solid #f8717144;border-radius:6px;font-size:12px;color:#f87171;">
            This permanently deletes the admin account and phone from Duo. This cannot be undone.
          </div>

          <button id="duo-term-run" style="width:100%;padding:9px;background:#dc2626;
            border:none;border-radius:6px;color:#fff;font-size:13px;font-weight:600;cursor:pointer;">
            Run Termination
          </button>
        </div>

        <div class="glass-card" style="padding:20px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:12px;">Progress</div>
          ${makeLogEl('duo-term-log')}
        </div>
      </div>`;

    // Pre-fill if launched from Audit "Start Termination"
    if (prefillTerm) {
      document.getElementById('duo-term-email').value = prefillTerm.email || '';
      document.getElementById('duo-term-phone').value = prefillTerm.phone || '';
      prefillTerm = null;
    }

    document.getElementById('duo-term-run').addEventListener('click', async () => {
      if (isRunning) return;
      const email = document.getElementById('duo-term-email').value.trim();
      const phone = document.getElementById('duo-term-phone').value.trim();

      if (!email && !phone) { alert('Enter at least an email or phone number.'); return; }
      if (!confirm(`Remove Duo access for ${email || phone}?\n\nThis cannot be undone.`)) return;

      const logEl = document.getElementById('duo-term-log');
      logEl.innerHTML = '';
      const log = (msg, type) => appendLog(logEl, msg, type);
      isRunning = true;
      document.getElementById('duo-term-run').disabled = true;

      try {
        // Admin removal
        if (email) {
          log(`→ Looking up admin: ${email}…`);
          const findR = await window.api.duoFindAdmin(email);
          if (findR.error) {
            log(`✗ Admin lookup: ${findR.error}`, 'error');
          } else if (!findR.admins.length) {
            log(`  No admin found with email ${email} (may already be removed)`);
          } else {
            for (const admin of findR.admins) {
              log(`  Found: ${admin.name} (${admin.role || admin.role_id})`);
              const delR = await window.api.duoDeleteAdmin(admin.admin_id);
              if (delR.error) log(`✗ Delete admin: ${delR.error}`, 'error');
              else log(`✓ Admin account deleted`, 'success');
            }
          }
        }

        // Phone removal — parent account
        if (phone) {
          log(`→ Looking up phone: ${phone}…`);
          const phoneR = await window.api.duoFindPhones(phone);
          if (phoneR.error) {
            log(`✗ Phone lookup: ${phoneR.error}`, 'error');
          } else if (!phoneR.phones.length) {
            log(`  No phone found with number ${phone} (may already be removed)`);
          } else {
            for (const p of phoneR.phones) {
              log(`  Found: ${p.phone_id} (${p.number})`);
              const delR = await window.api.duoDeletePhone(p.phone_id);
              if (delR.error) log(`✗ Delete phone: ${delR.error}`, 'error');
              else log(`✓ Phone removed from parent account`, 'success');
            }
          }

          // Phone removal — sub-accounts
          log('──────────────────────────────────');
          log('→ Removing phone from sub-accounts…');
          const subListR = await window.api.duoListSubAccounts();
          if (subListR.error) {
            log(`✗ Sub-account list: ${subListR.error}`, 'error');
          } else {
            for (const acct of subListR.accounts) {
              const sfR = await window.api.duoSubFindPhones({ accountId: acct.account_id, number: phone });
              if (sfR.error) { log(`  ✗ [${acct.name}] ${sfR.error}`, 'error'); continue; }
              if (!sfR.phones.length) { log(`  — [${acct.name}] Not found`); continue; }
              for (const p of sfR.phones) {
                const sdR = await window.api.duoSubDeletePhone({ accountId: acct.account_id, phoneId: p.phone_id });
                if (sdR.error) log(`  ✗ [${acct.name}] ${sdR.error}`, 'error');
                else log(`  ✓ [${acct.name}] Removed`, 'success');
              }
            }
          }
        }

        log('──────────────────────────────────');
        log('Termination complete.', 'success');
      } finally {
        isRunning = false;
        const btn = document.getElementById('duo-term-run');
        if (btn) btn.disabled = false;
      }
    });
  }

  // ── Audit Tab ────────────────────────────────────────────────────────────────
  // Persists across tab switches — cleared only on explicit reload
  const _auditCache = { admins: null, parentPhones: null, driftArgs: null };
  let _excludedIds = new Set();

  async function renderAuditTab(tc) {
    const excR = await window.api.duoGetExcludedAccounts().catch(() => ({ excluded: [] }));
    _excludedIds = new Set(excR.excluded || []);

    tc.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:16px;">

        <div class="glass-card" style="padding:20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
            <div style="font-size:13px;font-weight:600;">Duo Administrators</div>
            <button id="duo-load-admins" style="padding:6px 14px;background:var(--accent);
              border:none;border-radius:6px;color:#fff;font-size:12px;cursor:pointer;">Load</button>
          </div>
          <div id="duo-admins-out">
            <div style="font-size:12px;color:var(--text-muted);">Click Load to fetch current admins.</div>
          </div>
        </div>

        <div class="glass-card" style="padding:20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
            <div style="font-size:13px;font-weight:600;">Parent Account — Anchor Phones</div>
            <button id="duo-load-phones" style="padding:6px 14px;background:var(--accent);
              border:none;border-radius:6px;color:#fff;font-size:12px;cursor:pointer;">Load</button>
          </div>
          <div id="duo-phones-out">
            <div style="font-size:12px;color:var(--text-muted);">Click Load to fetch phones on the anchor user.</div>
          </div>
        </div>

        <div class="glass-card" style="padding:20px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
            <div>
              <div style="font-size:13px;font-weight:600;">Sub-Account Phone Drift Report</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Parent anchor phones are the source of truth. Shows missing, unactivated, and orphaned phones only.</div>
            </div>
            <button id="duo-load-sub-phones" style="padding:6px 14px;background:var(--accent);
              border:none;border-radius:6px;color:#fff;font-size:12px;cursor:pointer;">Run Audit</button>
          </div>
          <div id="duo-sub-phones-out">
            <div style="font-size:12px;color:var(--text-muted);">Click Run Audit to compare all sub-accounts against the parent anchor phone list.</div>
          </div>
        </div>

      </div>`;

    const TH = `text-align:left;padding:6px 8px;border-bottom:1px solid var(--border);color:var(--text-muted);font-weight:500;font-size:12px;`;
    const TD = `padding:6px 8px;border-bottom:1px solid var(--border)22;font-size:12px;`;
    const BTN = `padding:3px 8px;background:none;border:1px solid var(--border);border-radius:4px;color:var(--text-muted);font-size:11px;cursor:pointer;`;

    document.addEventListener('click', function _dismissDuoMenus(e) {
      if (!e.target.closest('.duo-am') && !e.target.closest('.duo-amb')) {
        document.querySelectorAll('.duo-am').forEach(m => m.style.display = 'none');
      }
    });

    // ── Render helpers (called on load AND on cache restore) ──────────────────

    function renderAdmins(admins) {
      const el = document.getElementById('duo-admins-out');
      const sorted = [...admins].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      el.innerHTML = `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr>
              <th style="${TH}">Name</th><th style="${TH}">Email</th>
              <th style="${TH}">Role</th><th style="${TH}">Status</th><th style="${TH}"></th>
            </tr></thead>
            <tbody>
              ${sorted.map((a, i) => `<tr>
                <td style="${TD}">${a.name || '—'}</td>
                <td style="${TD}color:var(--text-muted);">${a.email || '—'}</td>
                <td style="${TD}">${a.role || a.role_id || '—'}</td>
                <td style="${TD}color:${a.status === 'Active' ? '#4ade80' : '#fbbf24'};">${a.status || '—'}</td>
                <td style="${TD}position:relative;white-space:nowrap;">
                  <button class="duo-amb" data-i="${i}"
                    style="background:none;border:1px solid var(--border);border-radius:4px;
                           color:var(--text-muted);cursor:pointer;padding:1px 7px;font-size:14px;">⋯</button>
                  <div class="duo-am" id="duo-am-${i}"
                    style="display:none;position:absolute;right:0;top:100%;z-index:300;
                           background:var(--bg-primary);border:1px solid var(--border);
                           border-radius:6px;min-width:170px;box-shadow:0 4px 14px rgba(0,0,0,.5);">
                    <button class="duo-am-term" data-email="${a.email || ''}"
                      style="display:block;width:100%;text-align:left;padding:9px 14px;
                             background:none;border:none;color:var(--text-primary);font-size:12px;cursor:pointer;">
                      Start Termination
                    </button>
                    <button class="duo-am-del" data-id="${a.admin_id}" data-name="${(a.name||'').replace(/"/g,'')}"
                      style="display:block;width:100%;text-align:left;padding:9px 14px;
                             background:none;border:none;color:#f87171;font-size:12px;cursor:pointer;">
                      Delete Admin
                    </button>
                  </div>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:8px;">${sorted.length} admin(s)</div>`;
      document.getElementById('duo-load-admins').textContent = 'Reload';

      el.querySelectorAll('.duo-amb').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const menu = document.getElementById(`duo-am-${btn.dataset.i}`);
          document.querySelectorAll('.duo-am').forEach(m => { if (m !== menu) m.style.display = 'none'; });
          menu.style.display = menu.style.display === 'none' ? '' : 'none';
        });
      });
      el.querySelectorAll('.duo-am-term').forEach(btn => {
        btn.addEventListener('click', () => {
          prefillTerm = { email: btn.dataset.email, phone: '' };
          activeTab = 'termination'; render();
        });
      });
      el.querySelectorAll('.duo-am-del').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm(`Delete admin "${btn.dataset.name}"? This cannot be undone.`)) return;
          const r2 = await window.api.duoDeleteAdmin(btn.dataset.id);
          if (r2.error) alert(`Delete failed: ${r2.error}`);
          else { _auditCache.admins = null; document.getElementById('duo-load-admins').click(); }
        });
      });
    }

    function renderParentPhones(phones) {
      const el = document.getElementById('duo-phones-out');
      if (!phones.length) {
        el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">No phones enrolled on anchor user.</div>';
        return;
      }
      el.innerHTML = `
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr>
              <th style="${TH}">Name</th><th style="${TH}">Number</th>
              <th style="${TH}">Platform</th><th style="${TH}">Activated</th>
              <th style="${TH}">Phone ID</th><th style="${TH}"></th>
            </tr></thead>
            <tbody>
              ${phones.map(p => `<tr>
                <td style="${TD}">${p.name || '—'}</td>
                <td style="${TD}">${p.number || '—'}</td>
                <td style="${TD}color:var(--text-muted);">${p.platform || '—'}</td>
                <td style="${TD}color:${p.activated ? '#4ade80' : '#fbbf24'};">${p.activated ? 'Yes' : 'No'}</td>
                <td style="${TD}color:var(--text-muted);font-family:monospace;font-size:11px;">${p.phone_id}</td>
                <td style="${TD}">
                  <button class="duo-resend" data-id="${p.phone_id}" style="${BTN}">Resend SMS</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:8px;">${phones.length} phone(s) enrolled</div>`;
      document.getElementById('duo-load-phones').textContent = 'Reload';

      el.querySelectorAll('.duo-resend').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true; btn.textContent = 'Sending…';
          const r2 = await window.api.duoSendActivation(btn.dataset.id);
          if (r2.error) { btn.textContent = 'Failed'; btn.style.color = '#f87171'; }
          else           { btn.textContent = 'Sent ✓'; btn.style.color = '#4ade80'; }
        });
      });
    }

    function renderDrift(parentPhones, results, subAccounts) {
      const el = document.getElementById('duo-sub-phones-out');
      const btn = document.getElementById('duo-load-sub-phones');
      const normalize = n => (n || '').replace(/\D/g, '');
      const parentByNum = {};
      parentPhones.forEach(p => { parentByNum[normalize(p.number)] = p; });

      const ISSUE = {
        missing:     { label: 'Missing',       color: '#f87171', bg: '#f8717118' },
        unactivated: { label: 'Not Activated',  color: '#fbbf24', bg: '#fbbf2418' },
        orphan:      { label: 'Not in Parent',  color: '#a78bfa', bg: '#a78bfa18' },
      };

      // Build name map for all accounts (needed by exceptions bar even after filtering)
      const allAccountNames = {};
      results.forEach(r => { allAccountNames[r.acct.account_id] = r.acct.name; });
      const filteredResults = results.filter(r => !_excludedIds.has(r.acct.account_id));

      const dirty = filteredResults.filter(r => r.issues.length);
      const clean = filteredResults.length - dirty.length;

      if (!dirty.length) {
        el.innerHTML = `<div style="font-size:12px;color:#4ade80;">All ${filteredResults.length} sub-account${filteredResults.length!==1?'s':''}${_excludedIds.size ? ` (${_excludedIds.size} excepted)` : ''} are in sync with the parent. No issues found.</div>`;
        btn.disabled = false; btn.textContent = 'Re-run Audit'; return;
      }

      // Flatten all issue rows once; also build per-account phone map for Show All
      const allRows = [];
      dirty.forEach(({ acct, issues }) => {
        issues.forEach(issue => allRows.push({ acctName: acct.name, acctId: acct.account_id, ...issue }));
      });
      // Map accountId → { acct, subPhones } for Show All mode
      const acctDataMap = {};
      filteredResults.forEach(r => { acctDataMap[r.acct.account_id] = r; });

      const counts = { missing: 0, unactivated: 0, orphan: 0 };
      allRows.forEach(r => { if (counts[r.type] !== undefined) counts[r.type]++; });

      // Sorted account list for dropdown
      const sortedAccts = [...filteredResults].sort((a, b) => a.acct.name.localeCompare(b.acct.name));

      // State
      let sortCol = 'account';
      let sortDir = 'asc';
      const activeFilters = new Set(['missing', 'unactivated', 'orphan']);
      let searchQ = '';
      let selectedAcctId = '';   // '' = all accounts
      let showAllPhones = false;

      const ACCT_STATUS = {
        active:      { label: 'Active',         color: '#4ade80', bg: '#4ade8018' },
        unactivated: { label: 'Not Activated',  color: '#fbbf24', bg: '#fbbf2418' },
        missing:     { label: 'Missing',        color: '#f87171', bg: '#f8717118' },
        orphan:      { label: 'Not in Parent',  color: '#a78bfa', bg: '#a78bfa18' },
      };

      // ── Scaffold ──────────────────────────────────────────────────────────────
      el.innerHTML = `
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;">
          ${['missing','unactivated','orphan'].map(t => `
            <button class="drift-chip" data-type="${t}"
              style="padding:4px 10px;border-radius:20px;border:1px solid ${ISSUE[t].color}55;
                     background:${ISSUE[t].bg};color:${ISSUE[t].color};font-size:11px;cursor:pointer;
                     font-weight:500;transition:opacity .15s;">
              ${ISSUE[t].label}
              <span class="chip-count" style="margin-left:4px;opacity:.75;">${counts[t]}</span>
            </button>`).join('')}
          <div style="margin-left:auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            <select id="drift-acct-sel"
              style="color-scheme:dark;padding:4px 8px;font-size:12px;background:#1e1e2e;
                     border:1px solid #334155;border-radius:6px;color:#e2e8f0;
                     cursor:pointer;outline:none;">
              <option style="background:#1e1e2e;color:#e2e8f0;" value="">All Accounts</option>
              ${sortedAccts.map(r => `<option style="background:#1e1e2e;color:#e2e8f0;" value="${r.acct.account_id}">${r.acct.name}</option>`).join('')}
            </select>
            <button id="drift-exclude-btn" style="display:none;padding:4px 10px;border-radius:6px;
              border:1px solid #f8717155;background:#f8717108;color:#f87171;
              font-size:11px;cursor:pointer;">&#8856; Exclude</button>
            <button id="drift-show-all" style="padding:4px 12px;border-radius:6px;
              border:1px solid var(--border);background:var(--bg-secondary);
              color:var(--text-muted);font-size:11px;cursor:pointer;display:none;">Show All Phones</button>
            <input id="drift-search" placeholder="Search…"
              style="padding:4px 10px;font-size:12px;background:var(--bg-secondary);
                     border:1px solid var(--border);border-radius:6px;color:var(--text-primary);
                     outline:none;width:160px;">
            <button id="drift-fix-all" style="padding:4px 12px;border-radius:6px;border:1px solid #4ade8066;
              background:#4ade8012;color:#4ade80;font-size:11px;cursor:pointer;font-weight:500;
              display:none;">Fix All Missing</button>
          </div>
        </div>
        <div id="drift-exceptions-bar" style="display:none;margin-bottom:6px;"></div>
        <div id="drift-status" style="font-size:11px;color:var(--text-muted);margin-bottom:8px;"></div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead id="drift-thead"><tr></tr></thead>
            <tbody id="drift-tbody"></tbody>
          </table>
        </div>`;

      btn.disabled = false; btn.textContent = 'Re-run Audit';

      // ── Sort indicator helper ─────────────────────────────────────────────────
      function updateSortHeaders() {
        el.querySelectorAll('.drift-th').forEach(th => {
          const ind = th.querySelector('.sort-ind');
          if (!ind) return;
          if (th.dataset.col === sortCol) {
            ind.textContent = sortDir === 'asc' ? '▲' : '▼'; ind.style.opacity = '1';
          } else {
            ind.textContent = '▲▼'; ind.style.opacity = '.25';
          }
        });
      }

      function attachSortHeaders() {
        el.querySelectorAll('.drift-th').forEach(th => {
          th.addEventListener('click', () => {
            if (sortCol === th.dataset.col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
            else { sortCol = th.dataset.col; sortDir = 'asc'; }
            redraw();
          });
        });
      }

      // ── Enroll helper ─────────────────────────────────────────────────────────
      async function enrollPhone(b) {
        b.disabled = true; b.textContent = 'Enrolling…';
        const uR = await window.api.duoSubFindUsers({ accountId: b.dataset.accountId, username: 'anchor' });
        if (uR.error || !uR.users.length) { b.disabled = false; b.textContent = 'No anchor user'; b.style.color = '#f87171'; return; }
        const userId = uR.users[0].user_id;
        const cpR = await window.api.duoSubCreatePhone({ accountId: b.dataset.accountId, number: b.dataset.number, name: b.dataset.empName });
        if (cpR.error) { b.disabled = false; b.textContent = 'Create failed'; b.style.color = '#f87171'; return; }
        const phoneId = cpR.phone.phone_id;
        const asR = await window.api.duoSubAssociatePhone({ accountId: b.dataset.accountId, userId, phoneId });
        if (asR.error) { b.disabled = false; b.textContent = 'Assoc. failed'; b.style.color = '#f87171'; return; }
        const smR = await window.api.duoSubSendActivation({ accountId: b.dataset.accountId, phoneId });
        if (smR.error) { b.textContent = 'Enrolled — SMS failed'; b.style.color = '#fbbf24'; b.title = smR.error; }
        else            { b.textContent = 'Enrolled ✓'; b.style.color = '#4ade80'; }
        _auditCache.driftArgs = null;
      }

      // ── Redraw ────────────────────────────────────────────────────────────────
      function redraw() {
        const q = searchQ.toLowerCase();
        const isAcctMode = !!selectedAcctId;
        const thead = document.getElementById('drift-thead').querySelector('tr');
        const tbody = document.getElementById('drift-tbody');

        if (isAcctMode && showAllPhones) {
          // ── Show All Phones for one account ───────────────────────────────────
          const acctData = acctDataMap[selectedAcctId];
          const subPhones = acctData ? (acctData.subPhones || []) : [];
          const subByNum = {};
          subPhones.forEach(p => { subByNum[normalize(p.number)] = p; });

          // Build full rows: parent phones first, then orphans
          let fullRows = [];
          parentPhones.forEach(pp => {
            const num = normalize(pp.number);
            const sp = subByNum[num];
            if (sp) {
              fullRows.push({ status: sp.activated ? 'active' : 'unactivated',
                name: pp.name, deviceName: sp.name || '', number: pp.number, platform: sp.platform || '—',
                phoneId: sp.phone_id, acctId: selectedAcctId, acctName: acctData.acct.name });
            } else {
              fullRows.push({ status: 'missing', name: pp.name, deviceName: '', number: pp.number, platform: '—',
                phoneId: null, acctId: selectedAcctId, acctName: acctData.acct.name });
            }
          });
          subPhones.forEach(sp => {
            if (!parentByNum[normalize(sp.number)]) {
              fullRows.push({ status: 'orphan', name: sp.name || '—', deviceName: sp.name || '', number: sp.number,
                platform: sp.platform || '—', phoneId: sp.phone_id,
                acctId: selectedAcctId, acctName: acctData.acct.name });
            }
          });

          if (q) fullRows = fullRows.filter(r =>
            (r.name||'').toLowerCase().includes(q) || (r.number||'').toLowerCase().includes(q));

          const colMap = { employee: 'name', number: 'number', platform: 'platform', status: 'status' };
          if (!colMap[sortCol]) sortCol = 'employee';
          fullRows.sort((a, b) => {
            const va = (a[colMap[sortCol]] || '').toLowerCase();
            const vb = (b[colMap[sortCol]] || '').toLowerCase();
            return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
          });

          thead.innerHTML = ['employee','number','platform','status'].map(col => `
            <th class="drift-th" data-col="${col}" style="${TH}cursor:pointer;user-select:none;white-space:nowrap;">
              ${col.charAt(0).toUpperCase()+col.slice(1)}
              <span class="sort-ind" style="font-size:10px;margin-left:3px;"></span>
            </th>`).join('') + `<th style="${TH}"></th>`;
          attachSortHeaders(); updateSortHeaders();

          const activeCnt = fullRows.filter(r => r.status === 'active').length;
          const issueCnt  = fullRows.length - activeCnt;
          document.getElementById('drift-status').textContent =
            `${acctData.acct.name} · ${fullRows.length} phones · ${activeCnt} active · ${issueCnt} with issues`;
          document.getElementById('drift-fix-all').style.display =
            fullRows.filter(r => r.status === 'missing').length ? '' : 'none';

          tbody.innerHTML = fullRows.length ? fullRows.map(r => {
            const s = ACCT_STATUS[r.status];
            const isDefaultDevName = !r.deviceName || /^phone\d+$/i.test(r.deviceName.trim());
            const nameMatches = !isDefaultDevName && r.deviceName.trim().toLowerCase() === (r.name||'').trim().toLowerCase();
            let deviceTag = '';
            if (r.phoneId) {
              if (nameMatches)        deviceTag = `<div style="font-size:10px;color:#4ade80;margin-top:2px;">✓ ${escHtml(r.deviceName)}</div>`;
              else if (!isDefaultDevName) deviceTag = `<div style="font-size:10px;color:#fbbf24;margin-top:2px;">⚠ ${escHtml(r.deviceName)}</div>`;
              else                    deviceTag = `<div style="font-size:10px;color:#f87171;margin-top:2px;">✗ Not set</div>`;
            }
            const editPrefill = (!isDefaultDevName ? r.deviceName : r.name || '').replace(/"/g,'&quot;');
            return `<tr>
              <td style="${TD}">
                <div style="display:flex;align-items:flex-start;gap:6px;">
                  <div>
                    <div>${escHtml(r.name || '—')}</div>
                    ${deviceTag}
                  </div>
                  ${r.phoneId ? `<button class="da" data-action="edit-name" style="${BTN}margin-top:1px;font-size:10px;padding:1px 5px;opacity:.5;flex-shrink:0;"
                    data-phone-id="${r.phoneId}" data-acct-id="${r.acctId}"
                    data-current-name="${editPrefill}">✏</button>` : ''}
                </div>
              </td>
              <td style="${TD}">${escHtml(r.number)}</td>
              <td style="${TD}color:var(--text-muted);">${r.platform}</td>
              <td style="${TD}"><span style="padding:2px 8px;border-radius:10px;background:${s.bg};
                color:${s.color};font-size:11px;font-weight:500;">${s.label}</span></td>
              <td style="${TD}white-space:nowrap;">
                ${r.status === 'unactivated' ? `<button class="da" data-action="resend" style="${BTN}"
                  data-account-id="${r.acctId}" data-phone-id="${r.phoneId}">Resend SMS</button>` : ''}
                ${r.status === 'missing' ? `<button class="da" data-action="enroll" style="${BTN}color:#4ade80;border-color:#4ade8066;"
                  data-account-id="${r.acctId}"
                  data-number="${(r.number||'').replace(/"/g,'')}"
                  data-emp-name="${(r.name||'').replace(/"/g,'')}">Enroll</button>` : ''}
                ${r.status === 'orphan' ? `<button class="da" data-action="remove" style="${BTN}color:#f87171;border-color:#f8717166;"
                  data-account-id="${r.acctId}" data-phone-id="${r.phoneId}"
                  data-number="${(r.number||'').replace(/"/g,'')}"
                  data-acct-name="${r.acctName.replace(/"/g,'')}">Remove</button>` : ''}
              </td>
            </tr>`;
          }).join('') :
          `<tr><td colspan="5" style="${TD}color:var(--text-muted);text-align:center;padding:16px;">No phones match.</td></tr>`;

        } else {
          // ── Issues / drift view ───────────────────────────────────────────────
          const colMap = { account: 'acctName', employee: 'name', number: 'number', issue: 'type' };
          if (!colMap[sortCol]) sortCol = 'account';

          let visible = allRows.filter(r =>
            activeFilters.has(r.type) &&
            (!selectedAcctId || r.acctId === selectedAcctId) &&
            (!q || r.acctName.toLowerCase().includes(q) || (r.name||'').toLowerCase().includes(q))
          );
          visible.sort((a, b) => {
            const va = (a[colMap[sortCol]] || '').toLowerCase();
            const vb = (b[colMap[sortCol]] || '').toLowerCase();
            return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
          });

          thead.innerHTML = ['account','employee','number','issue'].map(col => `
            <th class="drift-th" data-col="${col}" style="${TH}cursor:pointer;user-select:none;white-space:nowrap;">
              ${col.charAt(0).toUpperCase()+col.slice(1)}
              <span class="sort-ind" style="font-size:10px;margin-left:3px;"></span>
            </th>`).join('') + `<th style="${TH}"></th>`;
          attachSortHeaders(); updateSortHeaders();

          document.getElementById('drift-fix-all').style.display =
            visible.filter(r => r.type === 'missing').length ? '' : 'none';
          document.getElementById('drift-status').textContent =
            `${visible.length} of ${allRows.length} issue${allRows.length !== 1 ? 's' : ''} shown  ·  ${clean} account${clean !== 1 ? 's' : ''} clean`;

          tbody.innerHTML = visible.length ? visible.map(r => `
            <tr>
              <td style="${TD}color:var(--text-muted);">${r.acctName}</td>
              <td style="${TD}">${r.name || '—'}</td>
              <td style="${TD}">${r.number || '—'}</td>
              <td style="${TD}color:${ISSUE[r.type].color};font-weight:500;">${ISSUE[r.type].label}</td>
              <td style="${TD}white-space:nowrap;">
                ${r.type === 'unactivated' ? `<button class="da" data-action="resend" style="${BTN}"
                  data-account-id="${r.acctId}" data-phone-id="${r.phoneId}">Resend SMS</button>` : ''}
                ${r.type === 'missing' ? `<button class="da" data-action="enroll" style="${BTN}color:#4ade80;border-color:#4ade8066;"
                  data-account-id="${r.acctId}"
                  data-number="${(r.number||'').replace(/"/g,'')}"
                  data-emp-name="${(r.name||'').replace(/"/g,'')}">Enroll</button>` : ''}
                ${r.type === 'orphan' ? `<button class="da" data-action="remove" style="${BTN}color:#f87171;border-color:#f8717166;"
                  data-account-id="${r.acctId}" data-phone-id="${r.phoneId}"
                  data-number="${(r.number||'').replace(/"/g,'')}"
                  data-acct-name="${r.acctName.replace(/"/g,'')}">Remove</button>` : ''}
              </td>
            </tr>`).join('') :
            `<tr><td colspan="5" style="${TD}color:var(--text-muted);text-align:center;padding:16px;">No issues match the current filter.</td></tr>`;
        }
      }

      redraw();

      // ── Account selector ──────────────────────────────────────────────────────
      document.getElementById('drift-acct-sel').addEventListener('change', e => {
        selectedAcctId = e.target.value;
        showAllPhones = false;
        sortCol = selectedAcctId ? 'employee' : 'account';
        const showAllBtn = document.getElementById('drift-show-all');
        showAllBtn.style.display = selectedAcctId ? '' : 'none';
        showAllBtn.textContent = 'Show All Phones';
        const excludeBtn = document.getElementById('drift-exclude-btn');
        if (excludeBtn) excludeBtn.style.display = selectedAcctId ? '' : 'none';
        document.getElementById('drift-search').placeholder = selectedAcctId ? 'Search employee or number…' : 'Search…';
        redraw();
      });

      document.getElementById('drift-show-all').addEventListener('click', () => {
        showAllPhones = !showAllPhones;
        sortCol = showAllPhones ? 'employee' : 'account';
        document.getElementById('drift-show-all').textContent = showAllPhones ? 'Issues Only' : 'Show All Phones';
        redraw();
      });

      // ── Chip toggles ──────────────────────────────────────────────────────────
      el.querySelectorAll('.drift-chip').forEach(chip => {
        chip.addEventListener('click', () => {
          const t = chip.dataset.type;
          if (activeFilters.has(t)) {
            if (activeFilters.size === 1) return;
            activeFilters.delete(t); chip.style.opacity = '.35';
          } else {
            activeFilters.add(t); chip.style.opacity = '1';
          }
          redraw();
        });
      });

      // ── Search ────────────────────────────────────────────────────────────────
      document.getElementById('drift-search').addEventListener('input', e => {
        searchQ = e.target.value; redraw();
      });

      // ── Action buttons (event delegation) ────────────────────────────────────
      document.getElementById('drift-tbody').addEventListener('click', async e => {
        const b = e.target.closest('.da');
        if (!b || b.disabled) return;
        if (b.dataset.action === 'resend') {
          b.disabled = true; b.textContent = 'Sending…';
          const r2 = await window.api.duoSubSendActivation({ accountId: b.dataset.accountId, phoneId: b.dataset.phoneId });
          if (r2.error) { b.disabled = false; b.textContent = 'Failed'; b.style.color = '#f87171'; }
          else           { b.textContent = 'Sent ✓'; b.style.color = '#4ade80'; }
        }
        if (b.dataset.action === 'enroll') await enrollPhone(b);
        if (b.dataset.action === 'edit-name') {
          const td = b.closest('td');
          const phoneId = b.dataset.phoneId;
          const acctId  = b.dataset.acctId;
          const cur     = b.dataset.currentName;
          td.innerHTML = `
            <input class="drift-name-inp" value="${cur.replace(/"/g,'&quot;')}"
              style="width:130px;padding:3px 6px;background:#1e1e2e;color:#e2e8f0;
                border:1px solid #334155;border-radius:4px;font-size:12px;outline:none;">
            <button class="drift-name-save" style="${BTN}margin-left:4px;color:#4ade80;border-color:#4ade8066;">Save</button>
            <button class="drift-name-cancel" style="${BTN}margin-left:2px;">✕</button>`;
          const inp     = td.querySelector('.drift-name-inp');
          const saveBtn = td.querySelector('.drift-name-save');
          td.querySelector('.drift-name-cancel').addEventListener('click', () => redraw());
          async function doSave() {
            const name = inp.value.trim();
            if (!name) return;
            saveBtn.disabled = true; saveBtn.textContent = '…';
            const r2 = await window.api.duoSubUpdatePhone({ accountId: acctId, phoneId, name });
            if (r2.error) { saveBtn.disabled = false; saveBtn.textContent = 'Failed'; saveBtn.style.color = '#f87171'; }
            else {
              // Update deviceName in the row data so redraw reflects the new name immediately
              const row = allRows.find(r => r.phoneId === phoneId) ||
                          (acctDataMap[acctId]?.subPhones || []).find(p => p.phone_id === phoneId);
              if (row) row.deviceName = name;
              const sp = (acctDataMap[acctId]?.subPhones || []).find(p => p.phone_id === phoneId);
              if (sp) sp.name = name;
              _auditCache.driftArgs = null;
              redraw();
            }
          }
          saveBtn.addEventListener('click', doSave);
          inp.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); if (e.key === 'Escape') redraw(); });
          inp.focus(); inp.select();
        }
        if (b.dataset.action === 'remove') {
          if (!confirm(`Remove ${b.dataset.number} from ${b.dataset.acctName}?`)) return;
          b.disabled = true; b.textContent = 'Removing…';
          const r2 = await window.api.duoSubDeletePhone({ accountId: b.dataset.accountId, phoneId: b.dataset.phoneId });
          if (r2.error) { b.disabled = false; b.textContent = 'Failed'; b.style.color = '#f87171'; }
          else           { b.textContent = 'Removed ✓'; b.style.color = '#4ade80'; _auditCache.driftArgs = null; }
        }
      });

      // ── Fix All Missing ───────────────────────────────────────────────────────
      document.getElementById('drift-fix-all').addEventListener('click', async () => {
        const fixBtn = document.getElementById('drift-fix-all');
        if (!confirm('Enroll all visible missing phones? This will create phones and send activation SMS.')) return;
        fixBtn.disabled = true; fixBtn.textContent = 'Working…';
        const missing = [...document.querySelectorAll('#drift-tbody .da[data-action="enroll"]')].filter(b => !b.disabled);
        for (const b of missing) await enrollPhone(b);
        fixBtn.disabled = false; fixBtn.textContent = 'Fix All Missing';
      });

      // ── Exclude account from drift report ────────────────────────────────────
      document.getElementById('drift-exclude-btn').addEventListener('click', async () => {
        if (!selectedAcctId) return;
        _excludedIds.add(selectedAcctId);
        await window.api.duoSaveExcludedAccounts({ excluded: [..._excludedIds] });
        renderDrift(parentPhones, results, subAccounts);
      });

      // ── Exceptions bar (shows excluded accounts with restore buttons) ─────────
      function updateExclusionsBar() {
        const bar = document.getElementById('drift-exceptions-bar');
        if (!bar) return;
        if (!_excludedIds.size) { bar.style.display = 'none'; bar.innerHTML = ''; return; }
        bar.style.display = '';
        const tags = [..._excludedIds].map(id => {
          const name = allAccountNames[id] || id;
          return `<span style="display:inline-flex;align-items:center;gap:3px;padding:2px 6px 2px 8px;
            border:1px solid var(--border);border-radius:10px;font-size:11px;color:var(--text-muted);">
            ${escHtml(name)}
            <button data-restore="${id}" style="background:none;border:none;color:var(--text-muted);
              cursor:pointer;font-size:15px;padding:0 2px;line-height:1;margin-left:1px;">&#215;</button>
          </span>`;
        }).join(' ');
        bar.innerHTML = `<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;padding:3px 0;">
          <span style="font-size:11px;color:var(--text-muted);font-weight:500;white-space:nowrap;">Excepted from report:</span>
          ${tags}
        </div>`;
        bar.querySelectorAll('[data-restore]').forEach(restoreBtn => {
          restoreBtn.addEventListener('click', async () => {
            _excludedIds.delete(restoreBtn.dataset.restore);
            await window.api.duoSaveExcludedAccounts({ excluded: [..._excludedIds] });
            renderDrift(parentPhones, results, subAccounts);
          });
        });
      }

      updateExclusionsBar();
    }

    // ── Restore cached data on tab switch ─────────────────────────────────────
    if (_auditCache.admins)      renderAdmins(_auditCache.admins);
    if (_auditCache.parentPhones) renderParentPhones(_auditCache.parentPhones);
    if (_auditCache.driftArgs)   renderDrift(..._auditCache.driftArgs);

    // ── Load button handlers ───────────────────────────────────────────────────
    document.getElementById('duo-load-admins').addEventListener('click', async () => {
      const el = document.getElementById('duo-admins-out');
      el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">Loading…</div>';
      const r = await window.api.duoListAdmins();
      if (r.error) { el.innerHTML = `<div style="font-size:12px;color:#f87171;">Error: ${r.error}</div>`; return; }
      _auditCache.admins = r.admins;
      renderAdmins(r.admins);
    });

    document.getElementById('duo-load-phones').addEventListener('click', async () => {
      const el = document.getElementById('duo-phones-out');
      el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">Loading…</div>';
      const usersR = await window.api.duoFindUsers('anchor');
      if (usersR.error) { el.innerHTML = `<div style="font-size:12px;color:#f87171;">Error: ${usersR.error}</div>`; return; }
      if (!usersR.users.length) { el.innerHTML = '<div style="font-size:12px;color:#f87171;">No "anchor" user found.</div>'; return; }
      const phones = [...(usersR.users[0].phones || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      _auditCache.parentPhones = phones;
      renderParentPhones(phones);
    });

    document.getElementById('duo-load-sub-phones').addEventListener('click', async () => {
      const el = document.getElementById('duo-sub-phones-out');
      const btn = document.getElementById('duo-load-sub-phones');
      btn.disabled = true; btn.textContent = 'Running…';
      el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">Loading parent anchor phones…</div>';

      const parentR = await window.api.duoFindUsers('anchor');
      if (parentR.error || !parentR.users.length) {
        el.innerHTML = `<div style="font-size:12px;color:#f87171;">Could not load parent anchor user: ${parentR.error || 'not found'}</div>`;
        btn.disabled = false; btn.textContent = 'Run Audit'; return;
      }
      const parentPhones = parentR.users[0].phones || [];
      const normalize = n => (n || '').replace(/\D/g, '');
      const parentByNum = {};
      parentPhones.forEach(p => { parentByNum[normalize(p.number)] = p; });

      el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">Loading sub-accounts…</div>';
      const subListR = await window.api.duoListSubAccounts();
      if (subListR.error) {
        el.innerHTML = `<div style="font-size:12px;color:#f87171;">Error: ${subListR.error}</div>`;
        btn.disabled = false; btn.textContent = 'Run Audit'; return;
      }

      el.innerHTML = `<div style="font-size:12px;color:var(--text-muted);">Comparing ${subListR.accounts.length} sub-accounts…</div>`;

      const results = await Promise.all(subListR.accounts.map(async acct => {
        const uR = await window.api.duoSubFindUsers({ accountId: acct.account_id, username: 'anchor' });
        const subPhones = (uR.error || !uR.users.length) ? [] : (uR.users[0].phones || []);
        const subByNum = {};
        subPhones.forEach(p => { subByNum[normalize(p.number)] = p; });
        const issues = [];
        parentPhones.forEach(pp => {
          const num = normalize(pp.number);
          if (!subByNum[num]) issues.push({ type: 'missing', name: pp.name, number: pp.number, phoneId: null });
        });
        subPhones.forEach(sp => {
          const num = normalize(sp.number);
          const pp = parentByNum[num];
          if (pp && !sp.activated) issues.push({ type: 'unactivated', name: pp.name, number: sp.number, phoneId: sp.phone_id });
        });
        subPhones.forEach(sp => {
          const num = normalize(sp.number);
          if (!parentByNum[num]) issues.push({ type: 'orphan', name: sp.name, number: sp.number, phoneId: sp.phone_id });
        });
        return { acct, issues, subPhones };
      }));

      _auditCache.driftArgs = [parentPhones, results, subListR.accounts];
      renderDrift(parentPhones, results, subListR.accounts);
    });
  }

  // ── New Sub Account Tab ──────────────────────────────────────────────────────
  function renderNewSubTab(tc) {
    function escHtml(str) {
      return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function initState() {
      return {
        scenario: null, step: 0,
        accountType: 'parent', subAccountId: null, subAccountLabel: null,
        newAccountName: '', newAccountId: null,
        appName: '', app: null,
        anchorLog: [],
        clientUsername: '', clientPhone: '', clientSkipped: false,
        manualConfirmed: false,
        retireAppIkey: null,
        siteUid: null, siteName: null, sites: [],
        selectedDevices: [], devices: [],
        jobResults: [], jobLog: [],
        accountId: null, accountName: null,
      };
    }

    let s = initState();

    function scenarioSteps() {
      if (s.scenario === 1) return ['choose-account','create-app','choose-server','deploy'];
      if (s.scenario === 2) return ['create-account','create-app','setup-anchor','client-user','choose-server','deploy'];
      if (s.scenario === 3) return ['create-account','create-app','setup-anchor','manual-notice','remove-parent-app','choose-server','deploy'];
      return [];
    }

    function stepLabel(id) {
      return { 'choose-account':'Choose Account','create-account':'Create Account','create-app':'Create App',
        'setup-anchor':'Setup Anchor','client-user':'Client User','manual-notice':'Uninstall Notice',
        'remove-parent-app':'Remove Old App','choose-server':'Select Servers','deploy':'Deploy' }[id] || id;
    }

    function logBox(lines) {
      return `<div style="background:#0d1117;border:1px solid var(--border);border-radius:6px;padding:12px;
        font-family:monospace;font-size:12px;line-height:1.6;max-height:220px;overflow-y:auto;
        color:#e2e8f0;white-space:pre-wrap;">${escHtml(lines.join('\n')) || '—'}</div>`;
    }

    function render() {
      if (!s.scenario) { renderScenarioPicker(); } else { renderWizard(); }
    }

    function renderScenarioPicker() {
      tc.innerHTML = `
        <div class="glass-card" style="padding:24px;">
          <div style="font-size:15px;font-weight:600;margin-bottom:4px;">New Sub Account Wizard</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px;">Choose the scenario that fits your situation</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
            ${[
              { n:1, icon:'&#128421;', title:'Add Duo to Server',     desc:'Deploy Duo to a server using the parent Anchor account or an existing sub-account. No new account needed.' },
              { n:2, icon:'&#10133;',  title:'New Client Sub Account', desc:'Create a new Duo sub-account for a client, set up anchor phones, optionally add a client user, then deploy.' },
              { n:3, icon:'&#128260;', title:'Transition to Sub Account', desc:'Move a client from the Anchor parent account to their own sub-account. Includes app creation, anchor setup, and uninstall steps.' },
            ].map(({ n, icon, title, desc }) => `
              <div data-scenario="${n}" style="border:1px solid var(--border);border-radius:10px;padding:20px;cursor:pointer;
                transition:border-color 0.15s,background 0.15s;background:rgba(255,255,255,0.03);"
                onmouseover="this.style.borderColor='var(--accent)';this.style.background='rgba(99,102,241,0.08)'"
                onmouseout="this.style.borderColor='var(--border)';this.style.background='rgba(255,255,255,0.03)'">
                <div style="font-size:22px;margin-bottom:10px;">${icon}</div>
                <div style="font-size:13px;font-weight:600;color:var(--accent);margin-bottom:8px;">${title}</div>
                <div style="font-size:12px;color:var(--text-muted);line-height:1.5;">${desc}</div>
              </div>`).join('')}
          </div>
        </div>`;
      tc.querySelectorAll('[data-scenario]').forEach(card => {
        card.addEventListener('click', () => {
          s.scenario = parseInt(card.dataset.scenario);
          s.step = 0;
          render();
        });
      });
    }

    function renderWizard() {
      const steps = scenarioSteps();
      const stepId = steps[s.step];
      const total  = steps.length;
      const scenarioTitles = ['','Add Duo to Server','New Client Sub Account','Transition to Sub Account'];

      tc.innerHTML = `
        <div class="glass-card" style="padding:24px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
            <div>
              <div style="font-size:15px;font-weight:600;">${scenarioTitles[s.scenario]}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Step ${s.step+1} of ${total}: ${stepLabel(stepId)}</div>
            </div>
            <button id="wiz-reset" style="padding:5px 12px;background:transparent;border:1px solid var(--border);
              border-radius:6px;color:var(--text-muted);font-size:12px;cursor:pointer;">Start Over</button>
          </div>

          <div style="display:flex;align-items:center;gap:0;margin-bottom:24px;flex-wrap:wrap;gap:4px;">
            ${steps.map((id, i) => `
              <div style="display:flex;align-items:center;gap:4px;">
                <div title="${stepLabel(id)}" style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;
                  font-size:10px;font-weight:600;flex-shrink:0;
                  ${i < s.step ? 'background:var(--green,#22c55e);color:#fff;' : i === s.step ? 'background:var(--accent);color:#fff;' : 'background:var(--border);color:var(--text-muted);'}">
                  ${i < s.step ? '✓' : i+1}
                </div>
                ${i < steps.length-1 ? `<div style="width:16px;height:2px;background:${i < s.step ? 'var(--green,#22c55e)' : 'var(--border)'};flex-shrink:0;"></div>` : ''}
              </div>`).join('')}
          </div>

          <div id="wiz-step-content"></div>

          <div style="display:flex;gap:10px;margin-top:20px;align-items:center;">
            ${s.step > 0 ? `<button id="wiz-back" style="padding:7px 16px;background:transparent;border:1px solid var(--border);
              border-radius:6px;color:var(--text-muted);font-size:13px;cursor:pointer;">← Back</button>` : ''}
            <button id="wiz-next" style="padding:7px 18px;background:var(--accent);border:none;border-radius:6px;
              color:#fff;font-size:13px;cursor:pointer;font-weight:500;opacity:0.4;" disabled>
              ${s.step < total-1 ? 'Continue →' : 'Finish'}
            </button>
          </div>
        </div>`;

      document.getElementById('wiz-reset').addEventListener('click', () => { s = initState(); render(); });
      const backBtn = document.getElementById('wiz-back');
      if (backBtn) backBtn.addEventListener('click', () => { s.step--; render(); });
      const nextBtn = document.getElementById('wiz-next');

      renderStep(stepId, document.getElementById('wiz-step-content'), nextBtn);
    }

    function nextStep() {
      const steps = scenarioSteps();
      if (s.step < steps.length - 1) { s.step++; render(); }
    }

    function enableNext(nextBtn) {
      nextBtn.disabled = false;
      nextBtn.style.opacity = '1';
    }

    function renderStep(stepId, el, nextBtn) {
      switch (stepId) {
        case 'choose-account':    renderChooseAccount(el, nextBtn);   break;
        case 'create-account':    renderCreateAccount(el, nextBtn);   break;
        case 'create-app':        renderCreateApp(el, nextBtn);       break;
        case 'setup-anchor':      renderSetupAnchor(el, nextBtn);     break;
        case 'client-user':       renderClientUser(el, nextBtn);      break;
        case 'manual-notice':     renderManualNotice(el, nextBtn);    break;
        case 'remove-parent-app': renderRemoveParentApp(el, nextBtn); break;
        case 'choose-server':     renderChooseServer(el, nextBtn);    break;
        case 'deploy':            renderDeploy(el, nextBtn);          break;
      }
    }

    // ── choose-account (Scenario 1) ──────────────────────────────────────────
    async function renderChooseAccount(el, nextBtn) {
      el.innerHTML = `
        <div style="margin-bottom:14px;">
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:8px;">Account to deploy into</label>
          <div style="display:flex;gap:16px;">
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
              <input type="radio" name="acct-type" value="parent" ${s.accountType==='parent'?'checked':''}> Parent (Anchor)
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
              <input type="radio" name="acct-type" value="sub" ${s.accountType==='sub'?'checked':''}> Existing Sub Account
            </label>
          </div>
        </div>
        <div id="sub-picker" style="${s.accountType==='sub'?'':'display:none;'}margin-bottom:12px;">
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Select Sub Account</label>
          <select id="sub-account-select" style="color-scheme:dark;width:100%;padding:6px 10px;background:#1e1e2e;
            color:#e2e8f0;border:1px solid #334155;border-radius:6px;font-size:13px;">
            <option style="background:#1e1e2e;color:#e2e8f0;" value="">Loading accounts...</option>
          </select>
        </div>`;

      el.querySelectorAll('input[name="acct-type"]').forEach(r => {
        r.addEventListener('change', () => {
          s.accountType = r.value;
          el.querySelector('#sub-picker').style.display = r.value === 'sub' ? '' : 'none';
          if (r.value === 'parent') { s.accountId = null; s.accountName = 'Anchor (Parent)'; enableNext(nextBtn); }
          else { nextBtn.disabled = true; nextBtn.style.opacity = '0.4'; }
        });
      });

      const subSelect = el.querySelector('#sub-account-select');
      const listR = await window.api.duoListSubAccounts();
      if (listR.error) {
        subSelect.innerHTML = `<option style="background:#1e1e2e;color:#e2e8f0;" value="">Error: ${escHtml(listR.error)}</option>`;
      } else {
        const accts = (listR.accounts || []).sort((a,b) => a.name.localeCompare(b.name));
        subSelect.innerHTML = `<option style="background:#1e1e2e;color:#e2e8f0;" value="">— Select account —</option>` +
          accts.map(a => `<option style="background:#1e1e2e;color:#e2e8f0;" value="${a.account_id}">${escHtml(a.name)}</option>`).join('');
        if (s.subAccountId) subSelect.value = s.subAccountId;
      }
      subSelect.addEventListener('change', () => {
        s.subAccountId = subSelect.value;
        const opt = subSelect.options[subSelect.selectedIndex];
        s.subAccountLabel = opt ? opt.textContent : '';
        if (s.subAccountId) { nextBtn.disabled = false; nextBtn.style.opacity = '1'; }
        else { nextBtn.disabled = true; nextBtn.style.opacity = '0.4'; }
      });

      if (s.accountType === 'parent') enableNext(nextBtn);

      nextBtn.addEventListener('click', () => {
        if (s.accountType === 'parent') {
          s.accountId = null; s.accountName = 'Anchor (Parent)';
        } else {
          if (!s.subAccountId) return;
          s.accountId = s.subAccountId; s.accountName = s.subAccountLabel;
        }
        if (!s.appName) s.appName = `RDP - ${s.accountName}`;
        nextStep();
      });
    }

    // ── create-account (Scenario 2/3) ────────────────────────────────────────
    function renderCreateAccount(el, nextBtn) {
      if (s.newAccountId) {
        el.innerHTML = `
          <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:12px;">
            <div style="font-size:13px;font-weight:600;color:var(--green,#22c55e);">✓ Account created: ${escHtml(s.newAccountName)}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">Account ID: ${escHtml(s.newAccountId)}</div>
          </div>`;
        enableNext(nextBtn);
        nextBtn.addEventListener('click', nextStep);
        return;
      }
      el.innerHTML = `
        <div id="acct-api-section">
          <div style="margin-bottom:12px;">
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Account Name (Company Name) *</label>
            <input id="acct-name" type="text" value="${escHtml(s.newAccountName)}" placeholder="e.g. Acme Corp"
              style="width:100%;padding:7px 10px;background:#1e1e2e;color:#e2e8f0;border:1px solid #334155;
                border-radius:6px;font-size:13px;box-sizing:border-box;outline:none;">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">City (optional)</label>
              <input id="acct-city" type="text" placeholder="City"
                style="width:100%;padding:7px 10px;background:#1e1e2e;color:#e2e8f0;border:1px solid #334155;
                  border-radius:6px;font-size:13px;box-sizing:border-box;outline:none;">
            </div>
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">State (optional)</label>
              <input id="acct-state" type="text" placeholder="State"
                style="width:100%;padding:7px 10px;background:#1e1e2e;color:#e2e8f0;border:1px solid #334155;
                  border-radius:6px;font-size:13px;box-sizing:border-box;outline:none;">
            </div>
          </div>
          <div id="acct-error" style="display:none;color:#f87171;font-size:12px;margin-bottom:8px;font-family:monospace;"></div>
          <div style="display:flex;gap:10px;align-items:center;">
            <button id="create-acct-btn" style="padding:8px 18px;background:var(--accent);border:none;
              border-radius:6px;color:#fff;font-size:13px;cursor:pointer;font-weight:500;">Create Duo Account</button>
            <button id="acct-manual-toggle" style="padding:7px 12px;background:transparent;border:1px solid var(--border);
              border-radius:6px;color:var(--text-muted);font-size:12px;cursor:pointer;">Enter ID manually</button>
          </div>
        </div>
        <div id="acct-manual-section" style="display:none;margin-top:14px;">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">
            Create the account in the <a href="https://admin.duosecurity.com" target="_blank" style="color:var(--accent);">Duo admin portal</a>,
            then paste the Account ID here.
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Account Name *</label>
              <input id="manual-acct-name" type="text" value="${escHtml(s.newAccountName)}" placeholder="Company name"
                style="width:100%;padding:7px 10px;background:#1e1e2e;color:#e2e8f0;border:1px solid #334155;
                  border-radius:6px;font-size:13px;box-sizing:border-box;outline:none;">
            </div>
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Account ID *</label>
              <input id="manual-acct-id" type="text" placeholder="e.g. DA1XXXXXXXXXXXXXXXXX"
                style="width:100%;padding:7px 10px;background:#1e1e2e;color:#e2e8f0;border:1px solid #334155;
                  border-radius:6px;font-size:13px;box-sizing:border-box;outline:none;">
            </div>
          </div>
          <div id="manual-acct-error" style="display:none;color:#f87171;font-size:12px;margin-bottom:8px;"></div>
          <button id="manual-acct-btn" style="padding:8px 18px;background:var(--accent);border:none;
            border-radius:6px;color:#fff;font-size:13px;cursor:pointer;font-weight:500;">Use This Account</button>
        </div>`;

      el.querySelector('#acct-name').addEventListener('input', e => { s.newAccountName = e.target.value.trim(); });

      el.querySelector('#acct-manual-toggle').addEventListener('click', () => {
        const api = el.querySelector('#acct-api-section');
        const manual = el.querySelector('#acct-manual-section');
        const isManual = manual.style.display !== 'none';
        manual.style.display = isManual ? 'none' : '';
        api.style.display = isManual ? '' : 'none';
        el.querySelector('#acct-manual-toggle').textContent = isManual ? 'Enter ID manually' : 'Try API creation';
      });

      el.querySelector('#create-acct-btn').addEventListener('click', async () => {
        const name  = el.querySelector('#acct-name').value.trim();
        const city  = el.querySelector('#acct-city').value.trim();
        const state = el.querySelector('#acct-state').value.trim();
        const errEl = el.querySelector('#acct-error');
        if (!name) { errEl.style.display=''; errEl.textContent='Account name is required.'; return; }
        const btn = el.querySelector('#create-acct-btn');
        btn.disabled = true; btn.textContent = 'Creating...'; errEl.style.display = 'none';
        const params = { name };
        if (city)  params.city  = city;
        if (state) params.state = state;
        const r = await window.api.duoCreateAccount(params);
        if (r.error) {
          errEl.style.display=''; errEl.textContent=r.error;
          btn.disabled=false; btn.textContent='Create Duo Account'; return;
        }
        s.newAccountId = r.account.account_id;
        s.newAccountName = name;
        s.accountId = s.newAccountId;
        s.accountName = name;
        if (!s.appName) s.appName = `RDP - ${name}`;
        renderCreateAccount(el, nextBtn);
      });

      el.querySelector('#manual-acct-btn').addEventListener('click', () => {
        const name = el.querySelector('#manual-acct-name').value.trim();
        const id   = el.querySelector('#manual-acct-id').value.trim();
        const errEl = el.querySelector('#manual-acct-error');
        if (!name) { errEl.style.display=''; errEl.textContent='Account name is required.'; return; }
        if (!id)   { errEl.style.display=''; errEl.textContent='Account ID is required.'; return; }
        s.newAccountId = id;
        s.newAccountName = name;
        s.accountId = id;
        s.accountName = name;
        if (!s.appName) s.appName = `RDP - ${name}`;
        renderCreateAccount(el, nextBtn);
      });
    }

    // ── create-app ───────────────────────────────────────────────────────────
    function renderCreateApp(el, nextBtn) {
      if (s.app) {
        el.innerHTML = `
          <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:14px;">
            <div style="font-size:13px;font-weight:600;color:var(--green,#22c55e);margin-bottom:8px;">&#10003; Application: ${escHtml(s.app.name)}</div>
            <div style="font-size:12px;display:grid;gap:4px;font-family:monospace;">
              <div><span style="color:var(--text-muted);">IKEY: </span>${escHtml(s.app.integration_key)}</div>
              <div><span style="color:var(--text-muted);">SKEY: </span>${escHtml(s.app.secret_key||'(hidden)')}</div>
              <div><span style="color:var(--text-muted);">HOST: </span>${escHtml(s.app.api_hostname)}</div>
            </div>
            <button id="change-app" style="margin-top:8px;padding:4px 10px;border:1px solid var(--border);border-radius:5px;
              background:transparent;color:var(--text-muted);font-size:11px;cursor:pointer;">Change App</button>
          </div>`;
        enableNext(nextBtn);
        nextBtn.addEventListener('click', nextStep);
        el.querySelector('#change-app').addEventListener('click', () => { s.app=null; renderCreateApp(el, nextBtn); });
        return;
      }
      const acctLabel = s.accountName ? ` in <strong>${escHtml(s.accountName)}</strong>` : ' in the parent Anchor account';
      el.innerHTML = `
        <div style="display:flex;gap:8px;margin-bottom:14px;">
          <button id="tab-create" style="flex:1;padding:6px 0;border:1px solid var(--accent);border-radius:6px;
            background:var(--accent);color:#fff;font-size:12px;cursor:pointer;font-weight:500;">Create New</button>
          <button id="tab-existing" style="flex:1;padding:6px 0;border:1px solid var(--border);border-radius:6px;
            background:transparent;color:var(--text-muted);font-size:12px;cursor:pointer;">Use Existing</button>
        </div>
        <div id="pane-create">
          <div style="margin-bottom:12px;">
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Application Name *</label>
            <input id="app-name-input" type="text" value="${escHtml(s.appName)}" placeholder="e.g. RDP - Acme Corp"
              style="width:100%;padding:7px 10px;background:#1e1e2e;color:#e2e8f0;border:1px solid #334155;
                border-radius:6px;font-size:13px;box-sizing:border-box;outline:none;">
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Creates a Duo RDP application${acctLabel}.</div>
          </div>
          <div id="app-error" style="display:none;font-size:12px;margin-bottom:8px;font-family:monospace;white-space:pre-wrap;"></div>
          <button id="create-app-btn" style="padding:8px 18px;background:var(--accent);border:none;
            border-radius:6px;color:#fff;font-size:13px;cursor:pointer;font-weight:500;">Create Application</button>
        </div>
        <div id="pane-existing" style="display:none;">
          <div id="existing-loading" style="font-size:12px;color:var(--text-muted);">Loading applications...</div>
          <div id="existing-list" style="display:none;max-height:240px;overflow-y:auto;display:grid;gap:6px;"></div>
          <div id="existing-error" style="display:none;font-size:12px;"></div>
        </div>`;

      function setTab(t) {
        const isCreate = t === 'create';
        el.querySelector('#tab-create').style.cssText    += `;background:${isCreate?'var(--accent)':'transparent'};color:${isCreate?'#fff':'var(--text-muted)'};border-color:${isCreate?'var(--accent)':'var(--border)'}`;
        el.querySelector('#tab-existing').style.cssText  += `;background:${!isCreate?'var(--accent)':'transparent'};color:${!isCreate?'#fff':'var(--text-muted)'};border-color:${!isCreate?'var(--accent)':'var(--border)'}`;
        el.querySelector('#pane-create').style.display   = isCreate ? '' : 'none';
        el.querySelector('#pane-existing').style.display = isCreate ? 'none' : '';
        if (!isCreate) loadExisting();
      }

      let existingLoaded = false;
      async function loadExisting() {
        if (existingLoaded) return;
        existingLoaded = true;
        const loadEl = el.querySelector('#existing-loading');
        const listEl = el.querySelector('#existing-list');
        const errEl  = el.querySelector('#existing-error');
        loadEl.style.display = ''; listEl.style.display = 'none'; errEl.style.display = 'none';
        const r = await window.api.duoListApplications(s.accountId ? { accountId: s.accountId } : {});
        loadEl.style.display = 'none';
        if (r.error) { errEl.style.display=''; errEl.style.color='#f87171'; errEl.textContent=r.error; return; }
        const apps = r.apps || [];
        if (!apps.length) { errEl.style.display=''; errEl.style.color='var(--text-muted)'; errEl.textContent='No RDP applications found.'; return; }
        listEl.style.display = 'grid';
        listEl.innerHTML = apps.map(a => `
          <div data-ikey="${escHtml(a.integration_key)}" data-skey="${escHtml(a.secret_key||'')}"
            data-host="${escHtml(a.api_hostname||'')}" data-name="${escHtml(a.name)}"
            style="padding:8px 12px;border:1px solid var(--border);border-radius:6px;cursor:pointer;
              transition:border-color 0.15s,background 0.15s;"
            onmouseover="this.style.borderColor='var(--accent)';this.style.background='rgba(99,102,241,0.08)'"
            onmouseout="this.style.borderColor='var(--border)';this.style.background='transparent'">
            <div style="font-size:13px;font-weight:500;">${escHtml(a.name)}</div>
            <div style="font-size:11px;color:var(--text-muted);font-family:monospace;">${escHtml(a.integration_key)}</div>
          </div>`).join('');
        listEl.querySelectorAll('[data-ikey]').forEach(row => {
          row.addEventListener('click', () => {
            s.app = { name: row.dataset.name, integration_key: row.dataset.ikey, secret_key: row.dataset.skey, api_hostname: row.dataset.host };
            renderCreateApp(el, nextBtn);
          });
        });
      }

      el.querySelector('#tab-create').addEventListener('click', () => setTab('create'));
      el.querySelector('#tab-existing').addEventListener('click', () => setTab('existing'));
      el.querySelector('#app-name-input').addEventListener('input', e => { s.appName = e.target.value.trim(); });

      el.querySelector('#create-app-btn').addEventListener('click', async () => {
        const name  = el.querySelector('#app-name-input').value.trim();
        const errEl = el.querySelector('#app-error');
        if (!name) { errEl.style.display=''; errEl.style.color='#f87171'; errEl.textContent='Application name is required.'; return; }
        const btn = el.querySelector('#create-app-btn');
        btn.disabled=true; btn.textContent='Creating...'; errEl.style.display='none';
        const r = s.accountId
          ? await window.api.duoCreateSubApplication({ accountId: s.accountId, name })
          : await window.api.duoCreateParentApplication({ name });
        if (r.error) {
          errEl.style.display=''; errEl.style.color='#f87171'; errEl.textContent=r.error;
          btn.disabled=false; btn.textContent='Create Application';
          return;
        }
        s.app = { name, integration_key: r.app.integration_key, secret_key: r.app.secret_key, api_hostname: r.app.api_hostname };
        if (r.app._userAccessWarning) {
          errEl.style.display=''; errEl.style.color='#f59e0b';
          errEl.textContent=`App created — but user access could not be set automatically (${r.app._userAccessWarning}). Set "User access" to "Enable for all users" manually in Duo.`;
        }
        renderCreateApp(el, nextBtn);
      });
    }

    // ── setup-anchor ─────────────────────────────────────────────────────────
    async function renderSetupAnchor(el, nextBtn) {
      if (s.anchorLog.length && s.anchorLog[s.anchorLog.length-1] === 'Done.') {
        el.innerHTML = `<div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Anchor setup complete:</div>${logBox(s.anchorLog)}`;
        enableNext(nextBtn); nextBtn.addEventListener('click', nextStep); return;
      }
      el.innerHTML = `
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">
          Copying parent anchor phones to the new sub-account…
        </div>
        <div id="anchor-log-box" style="background:#0d1117;border:1px solid var(--border);border-radius:6px;
          padding:12px;font-family:monospace;font-size:12px;line-height:1.6;max-height:220px;overflow-y:auto;
          color:#e2e8f0;white-space:pre-wrap;"></div>`;

      const logEl = el.querySelector('#anchor-log-box');
      function addLog(line) {
        s.anchorLog.push(line);
        logEl.textContent += (logEl.textContent ? '\n' : '') + line;
        logEl.scrollTop = logEl.scrollHeight;
      }

      try {
        addLog('Fetching parent anchor phones...');
        const parentR = await window.api.duoFindUsers('anchor');
        if (parentR.error) throw new Error(parentR.error);
        if (!parentR.users || !parentR.users.length) throw new Error('No anchor user found in parent account');
        const parentPhones = (parentR.users[0].phones || []).sort((a,b)=>(a.number||'').localeCompare(b.number||''));
        addLog(`Found ${parentPhones.length} phone(s) in parent account`);

        addLog('Looking up anchor user in sub-account...');
        const subUserR = await window.api.duoSubFindUsers({ accountId: s.accountId, username: 'anchor' });
        let subUserId;
        if (!subUserR.error && subUserR.users && subUserR.users.length) {
          subUserId = subUserR.users[0].user_id;
          addLog('Anchor user already exists');
        } else {
          addLog('Creating anchor user...');
          const createR = await window.api.duoSubCreateUser({ accountId: s.accountId, username: 'anchor', realname: 'Anchor User' });
          if (createR.error) throw new Error(`Create user failed: ${createR.error}`);
          subUserId = createR.user.user_id;
          addLog('Anchor user created');
        }

        for (const phone of parentPhones) {
          const num = phone.number;
          addLog(`Enrolling ${num}${phone.name ? ' (' + phone.name + ')' : ''}...`);
          const createR = await window.api.duoSubCreatePhone({ accountId: s.accountId, number: num, name: phone.name || undefined });
          if (createR.error) { addLog(`  ✗ Create failed: ${createR.error}`); continue; }
          const phoneId = createR.phone.phone_id;
          const assocR  = await window.api.duoSubAssociatePhone({ accountId: s.accountId, userId: subUserId, phoneId });
          if (assocR.error) { addLog(`  ✗ Associate failed: ${assocR.error}`); continue; }
          const smsR = await window.api.duoSubSendActivation({ accountId: s.accountId, phoneId });
          addLog(smsR.error ? `  ~ Enrolled (SMS failed: ${smsR.error})` : '  ✓ Enrolled + activation SMS sent');
        }

        addLog('Done.');
        enableNext(nextBtn); nextBtn.addEventListener('click', nextStep);

      } catch (e) {
        addLog(`ERROR: ${e.message}`);
        el.insertAdjacentHTML('beforeend', `
          <div style="margin-top:10px;">
            <button id="anchor-retry" style="padding:7px 14px;background:var(--accent);border:none;
              border-radius:6px;color:#fff;font-size:12px;cursor:pointer;">Retry</button>
          </div>`);
        el.querySelector('#anchor-retry').addEventListener('click', () => { s.anchorLog=[]; renderSetupAnchor(el, nextBtn); });
      }
    }

    // ── client-user (Scenario 2) ─────────────────────────────────────────────
    function renderClientUser(el, nextBtn) {
      if (s.clientSkipped || s.clientUser) {
        el.innerHTML = s.clientUser
          ? `<div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:12px;">
               <div style="font-size:13px;font-weight:600;color:var(--green,#22c55e);">✓ Client user set up: ${escHtml(s.clientUser)}</div>
             </div>`
          : `<div style="font-size:13px;color:var(--text-muted);">Skipped — client end user can be added later in the Duo portal.</div>`;
        enableNext(nextBtn); nextBtn.addEventListener('click', nextStep); return;
      }
      el.innerHTML = `
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;">
          Optionally add a client end user now. You can also do this later in the Duo admin portal.
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Username</label>
            <input id="client-uname" type="text" value="${escHtml(s.clientUsername)}" placeholder="jdoe or jdoe@acme.com"
              style="width:100%;padding:7px 10px;background:#1e1e2e;color:#e2e8f0;border:1px solid #334155;
                border-radius:6px;font-size:13px;box-sizing:border-box;outline:none;">
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Phone Number</label>
            <input id="client-phone" type="text" value="${escHtml(s.clientPhone)}" placeholder="+15551234567"
              style="width:100%;padding:7px 10px;background:#1e1e2e;color:#e2e8f0;border:1px solid #334155;
                border-radius:6px;font-size:13px;box-sizing:border-box;outline:none;">
          </div>
        </div>
        <div id="client-error" style="display:none;color:#f87171;font-size:12px;margin-bottom:8px;"></div>
        <div style="display:flex;gap:10px;">
          <button id="client-setup-btn" style="padding:7px 16px;background:var(--accent);border:none;
            border-radius:6px;color:#fff;font-size:13px;cursor:pointer;font-weight:500;">Setup Client User</button>
          <button id="client-skip-btn" style="padding:7px 14px;background:transparent;border:1px solid var(--border);
            border-radius:6px;color:var(--text-muted);font-size:13px;cursor:pointer;">Skip for Now</button>
        </div>`;

      el.querySelector('#client-uname').addEventListener('input',  e => { s.clientUsername = e.target.value; });
      el.querySelector('#client-phone').addEventListener('input',  e => { s.clientPhone    = e.target.value; });
      el.querySelector('#client-skip-btn').addEventListener('click', () => { s.clientSkipped=true; nextStep(); });

      el.querySelector('#client-setup-btn').addEventListener('click', async () => {
        const username = el.querySelector('#client-uname').value.trim();
        const phone    = el.querySelector('#client-phone').value.trim();
        const errEl    = el.querySelector('#client-error');
        if (!username) { errEl.style.display=''; errEl.textContent='Username is required.'; return; }
        if (!phone)    { errEl.style.display=''; errEl.textContent='Phone number is required.'; return; }
        const btn = el.querySelector('#client-setup-btn');
        btn.disabled=true; btn.textContent='Setting up...'; errEl.style.display='none';

        const userR = await window.api.duoSubCreateUser({ accountId: s.accountId, username });
        if (userR.error) { errEl.style.display=''; errEl.textContent=`Create user: ${userR.error}`; btn.disabled=false; btn.textContent='Setup Client User'; return; }

        const phoneR = await window.api.duoSubCreatePhone({ accountId: s.accountId, number: phone });
        if (phoneR.error) { errEl.style.display=''; errEl.textContent=`Create phone: ${phoneR.error}`; btn.disabled=false; btn.textContent='Setup Client User'; return; }

        const phoneId = phoneR.phone.phone_id;
        const assocR  = await window.api.duoSubAssociatePhone({ accountId: s.accountId, userId: userR.user.user_id, phoneId });
        if (assocR.error) { errEl.style.display=''; errEl.textContent=`Associate: ${assocR.error}`; btn.disabled=false; btn.textContent='Setup Client User'; return; }

        await window.api.duoSubSendActivation({ accountId: s.accountId, phoneId });
        s.clientUser = username;
        renderClientUser(el, nextBtn);
      });
    }

    // ── manual-notice (Scenario 3) ───────────────────────────────────────────
    function renderManualNotice(el, nextBtn) {
      el.innerHTML = `
        <div style="background:rgba(251,146,60,0.1);border:1px solid rgba(251,146,60,0.4);border-radius:8px;padding:16px;margin-bottom:16px;">
          <div style="font-size:13px;font-weight:600;color:#fb923c;margin-bottom:10px;">&#9888; Manual Action Required Before Continuing</div>
          <div style="font-size:12px;color:#e2e8f0;line-height:1.8;">
            1. RDP into the target server<br>
            2. Uninstall <strong>Duo Authentication for Windows Logon</strong> (Programs and Features)<br>
            3. Reboot the server<br>
            4. Return here and check the box below
          </div>
          <div style="margin-top:12px;">
            <a href="https://anchornetworksolutions.sharepoint.com/sites/Intranet/_layouts/15/DocIdRedir.aspx?ID=ANCHOR-402312107-6558"
              target="_blank" style="color:var(--accent);font-size:12px;text-decoration:none;">
              &#128196; KB: Adding DUO to a Server &#8594;
            </a>
          </div>
        </div>
        <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;user-select:none;">
          <input type="checkbox" id="manual-confirm" ${s.manualConfirmed?'checked':''}>
          I have uninstalled Duo and rebooted the server
        </label>`;

      nextBtn.disabled = !s.manualConfirmed; nextBtn.style.opacity = s.manualConfirmed ? '1' : '0.4';
      el.querySelector('#manual-confirm').addEventListener('change', e => {
        s.manualConfirmed = e.target.checked;
        nextBtn.disabled = !s.manualConfirmed; nextBtn.style.opacity = s.manualConfirmed ? '1' : '0.4';
      });
      nextBtn.addEventListener('click', () => { if (s.manualConfirmed) nextStep(); });
    }

    // ── remove-parent-app (Scenario 3) ───────────────────────────────────────
    async function renderRemoveParentApp(el, nextBtn) {
      el.innerHTML = `
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">
          Select the parent account RDP application that was used for this client. Deleting it removes those credentials from the parent account.
        </div>
        <div id="rpa-loading" style="font-size:12px;color:var(--text-muted);">Loading parent applications...</div>
        <div id="rpa-content" style="display:none;">
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">RDP Application to Delete</label>
          <select id="parent-app-sel" style="color-scheme:dark;width:100%;padding:6px 10px;background:#1e1e2e;
            color:#e2e8f0;border:1px solid #334155;border-radius:6px;font-size:13px;margin-bottom:12px;">
            <option style="background:#1e1e2e;color:#e2e8f0;" value="">— Select application —</option>
          </select>
          <div id="rpa-error" style="display:none;color:#f87171;font-size:12px;margin-bottom:8px;"></div>
          <div style="display:flex;gap:10px;">
            <button id="delete-app-btn" disabled style="padding:7px 16px;background:#dc2626;border:none;
              border-radius:6px;color:#fff;font-size:13px;cursor:pointer;opacity:0.4;">Delete Application</button>
            <button id="skip-delete-btn" style="padding:7px 14px;background:transparent;border:1px solid var(--border);
              border-radius:6px;color:var(--text-muted);font-size:13px;cursor:pointer;">Skip</button>
          </div>
        </div>`;

      const appsR = await window.api.duoListParentApplications();
      el.querySelector('#rpa-loading').style.display = 'none';
      el.querySelector('#rpa-content').style.display = '';

      const sel = el.querySelector('#parent-app-sel');
      if (appsR.error) {
        sel.innerHTML = `<option style="background:#1e1e2e;color:#e2e8f0;" value="">Error: ${escHtml(appsR.error)}</option>`;
      } else {
        const apps = (appsR.apps || []).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
        sel.innerHTML = `<option style="background:#1e1e2e;color:#e2e8f0;" value="">— Select application —</option>` +
          apps.map(a => `<option style="background:#1e1e2e;color:#e2e8f0;" value="${a.integration_key}">${escHtml(a.name)}</option>`).join('');
        if (s.retireAppIkey) sel.value = s.retireAppIkey;
      }

      const deleteBtn = el.querySelector('#delete-app-btn');
      sel.addEventListener('change', () => {
        s.retireAppIkey = sel.value;
        deleteBtn.disabled = !sel.value; deleteBtn.style.opacity = sel.value ? '1' : '0.4';
      });

      el.querySelector('#skip-delete-btn').addEventListener('click', () => nextStep());

      deleteBtn.addEventListener('click', async () => {
        if (!s.retireAppIkey) return;
        const errEl = el.querySelector('#rpa-error');
        deleteBtn.disabled=true; deleteBtn.textContent='Deleting...'; errEl.style.display='none';
        const r = await window.api.duoDeleteParentApplication({ integrationKey: s.retireAppIkey });
        if (r.error) {
          errEl.style.display=''; errEl.textContent=r.error;
          deleteBtn.disabled=false; deleteBtn.textContent='Delete Application'; return;
        }
        el.querySelector('#rpa-content').innerHTML = `
          <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:12px;">
            <div style="font-size:13px;font-weight:600;color:var(--green,#22c55e);">✓ Parent application deleted</div>
          </div>`;
        enableNext(nextBtn); nextBtn.addEventListener('click', nextStep);
      });
    }

    // ── choose-server ────────────────────────────────────────────────────────
    async function renderChooseServer(el, nextBtn) {
      if (s.selectedDevices.length) {
        el.innerHTML = `
          <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:12px;margin-bottom:12px;">
            <div style="font-size:13px;font-weight:600;color:var(--green,#22c55e);margin-bottom:6px;">
              &#10003; ${s.selectedDevices.length} server${s.selectedDevices.length>1?'s':''} selected
            </div>
            <div style="font-size:12px;display:grid;gap:2px;">
              ${s.selectedDevices.map(d=>`<div>&#8226; ${escHtml(d.name)}</div>`).join('')}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">Site: ${escHtml(s.siteName||'')}</div>
          </div>
          <button id="change-srv" style="padding:5px 12px;background:transparent;border:1px solid var(--border);
            border-radius:6px;color:var(--text-muted);font-size:12px;cursor:pointer;">Change Servers</button>`;
        enableNext(nextBtn); nextBtn.addEventListener('click', nextStep);
        el.querySelector('#change-srv').addEventListener('click', () => { s.selectedDevices=[]; renderChooseServer(el, nextBtn); });
        return;
      }

      el.innerHTML = `
        <div style="display:flex;gap:10px;align-items:flex-end;margin-bottom:12px;">
          <div style="flex:1;">
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">Client Site (Datto RMM)</label>
            <select id="site-sel" style="color-scheme:dark;width:100%;padding:6px 10px;background:#1e1e2e;
              color:#e2e8f0;border:1px solid #334155;border-radius:6px;font-size:13px;">
              <option style="background:#1e1e2e;color:#e2e8f0;" value="">Loading sites...</option>
            </select>
          </div>
          <button id="load-srv-btn" disabled style="padding:7px 14px;background:var(--accent);border:none;
            border-radius:6px;color:#fff;font-size:13px;cursor:pointer;opacity:0.4;white-space:nowrap;">Load Servers</button>
        </div>
        <div id="server-area"></div>
        <div id="confirm-area" style="display:none;margin-top:10px;">
          <button id="confirm-sel-btn" style="padding:7px 18px;background:var(--accent);border:none;
            border-radius:6px;color:#fff;font-size:13px;cursor:pointer;font-weight:500;">Confirm Selection</button>
        </div>
        <div id="srv-error" style="display:none;color:#f87171;font-size:12px;margin-top:6px;font-family:monospace;white-space:pre-wrap;"></div>
        <div id="manual-srv-section" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border);border-radius:6px;transition:border-color .2s,background .2s;">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;">— or enter device details manually —</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:8px;">
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:3px;">Server Name</label>
              <input id="manual-hostname" type="text" placeholder="SERVERNAME" value=""
                style="width:100%;padding:6px 10px;background:#1e1e2e;color:#e2e8f0;border:1px solid #334155;
                  border-radius:6px;font-size:13px;box-sizing:border-box;outline:none;">
            </div>
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:3px;">Datto Device UID</label>
              <input id="manual-uid" type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value=""
                style="width:100%;padding:6px 10px;background:#1e1e2e;color:#e2e8f0;border:1px solid #334155;
                  border-radius:6px;font-size:13px;box-sizing:border-box;outline:none;">
            </div>
          </div>
          <button id="manual-srv-btn" style="padding:6px 14px;background:transparent;border:1px solid var(--border);
            border-radius:6px;color:var(--text-muted);font-size:12px;cursor:pointer;">Add Server</button>
        </div>`;

      el.querySelector('#manual-srv-btn').addEventListener('click', () => {
        const hostname = el.querySelector('#manual-hostname').value.trim();
        const uid      = el.querySelector('#manual-uid').value.trim();
        if (!hostname || !uid) return;
        s.selectedDevices = [{ uid, name: hostname }];
        s.siteName = 'Manual Entry';
        renderChooseServer(el, nextBtn);
      });

      el.querySelector('#confirm-sel-btn').addEventListener('click', () => {
        const checked = [...el.querySelectorAll('#server-area input[type=checkbox]:checked')];
        if (!checked.length) return;
        s.selectedDevices = checked.map(cb => ({ uid: cb.dataset.uid, name: cb.dataset.name }));
        renderChooseServer(el, nextBtn);
      });

      const siteSel = el.querySelector('#site-sel');
      const loadBtn = el.querySelector('#load-srv-btn');

      const sitesR = s.sites.length ? { sites: s.sites } : await window.api.dattoListSites();
      if (sitesR.error) {
        siteSel.innerHTML = `<option style="background:#1e1e2e;color:#e2e8f0;" value="">Datto unavailable — use manual entry below</option>`;
        el.querySelector('#srv-error').style.display=''; el.querySelector('#srv-error').textContent=sitesR.error;
        const manualSection = el.querySelector('#manual-srv-section');
        if (manualSection) {
          manualSection.style.borderColor = 'var(--accent)';
          manualSection.style.background = 'rgba(99,102,241,0.06)';
          setTimeout(() => manualSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
        }
      } else {
        s.sites = sitesR.sites || [];
        siteSel.innerHTML = `<option style="background:#1e1e2e;color:#e2e8f0;" value="">— Select site —</option>` +
          s.sites.map(st => `<option style="background:#1e1e2e;color:#e2e8f0;" value="${st.uid}">${escHtml(st.name)}</option>`).join('');
        if (s.siteUid) { siteSel.value = s.siteUid; loadBtn.disabled=false; loadBtn.style.opacity='1'; }
      }

      siteSel.addEventListener('change', () => {
        s.siteUid = siteSel.value;
        s.siteName = siteSel.options[siteSel.selectedIndex]?.textContent || '';
        loadBtn.disabled = !s.siteUid; loadBtn.style.opacity = s.siteUid ? '1' : '0.4';
        el.querySelector('#server-area').innerHTML = '';
        el.querySelector('#confirm-area').style.display = 'none';
        s.devices = [];
      });

      function updateConfirmArea() {
        const anyChecked = el.querySelectorAll('#server-area input[type=checkbox]:checked').length > 0;
        el.querySelector('#confirm-area').style.display = anyChecked ? '' : 'none';
      }

      async function loadServers() {
        if (!s.siteUid) return;
        const area   = el.querySelector('#server-area');
        const errEl  = el.querySelector('#srv-error');
        area.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">Loading servers...</div>';
        el.querySelector('#confirm-area').style.display = 'none';
        errEl.style.display = 'none'; loadBtn.disabled = true;
        const r = await window.api.dattoListSiteServers({ siteUid: s.siteUid });
        loadBtn.disabled = false; loadBtn.style.opacity = '1';
        if (r.error) { area.innerHTML=''; errEl.style.display=''; errEl.textContent=r.error; return; }
        s.devices = r.devices || [];
        if (!s.devices.length) { area.innerHTML='<div style="font-size:12px;color:var(--text-muted);">No servers found in this site.</div>'; return; }
        area.innerHTML = `
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">Select one or more servers:</div>
          <div style="display:grid;gap:6px;max-height:220px;overflow-y:auto;">
            ${s.devices.map(d => `
              <label style="padding:8px 12px;border:1px solid var(--border);border-radius:6px;cursor:pointer;
                display:flex;align-items:center;gap:10px;transition:border-color 0.15s,background 0.15s;"
                onmouseover="this.style.borderColor='var(--accent)';this.style.background='rgba(99,102,241,0.08)'"
                onmouseout="this.style.borderColor='var(--border)';this.style.background='transparent'">
                <input type="checkbox" data-uid="${d.uid}" data-name="${escHtml(d.hostname)}"
                  style="accent-color:var(--accent);width:15px;height:15px;flex-shrink:0;cursor:pointer;" />
                <div>
                  <div style="font-size:13px;font-weight:500;">${escHtml(d.hostname)}</div>
                  <div style="font-size:11px;color:var(--text-muted);">${escHtml(d.os||'Windows Server')}</div>
                </div>
              </label>`).join('')}
          </div>`;
        area.querySelectorAll('input[type=checkbox]').forEach(cb => {
          cb.addEventListener('change', updateConfirmArea);
        });
      }

      loadBtn.addEventListener('click', loadServers);
      if (s.siteUid && s.devices.length) loadServers();
    }

    // ── deploy ───────────────────────────────────────────────────────────────
    function renderDeploy(el, nextBtn) {
      if (s.jobResults.length) {
        const succeeded = s.jobResults.filter(r => !r.error);
        const failed    = s.jobResults.filter(r => r.error);
        el.innerHTML = `
          <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:8px;padding:14px;margin-bottom:12px;">
            <div style="font-size:13px;font-weight:600;color:var(--green,#22c55e);">
              &#10003; ${succeeded.length} quick job${succeeded.length!==1?'s':''} submitted to Datto RMM
            </div>
            ${failed.length ? `<div style="font-size:12px;color:#f87171;margin-top:4px;">&#9888; ${failed.length} failed — see log below</div>` : ''}
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Check Datto RMM for completion status.</div>
          </div>
          ${logBox(s.jobLog)}`;
        enableNext(nextBtn);
        nextBtn.textContent = 'Finish';
        nextBtn.addEventListener('click', () => {
          const serverList = s.selectedDevices.map(d => d.name).join(', ');
          tc.innerHTML = `
            <div class="glass-card" style="padding:40px;text-align:center;">
              <div style="font-size:40px;margin-bottom:14px;">&#9989;</div>
              <div style="font-size:15px;font-weight:600;margin-bottom:6px;">All Done!</div>
              <div style="font-size:13px;color:var(--text-muted);margin-bottom:6px;">
                Duo Quick Job submitted for <strong>${s.selectedDevices.length} server${s.selectedDevices.length!==1?'s':''}</strong>.
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-bottom:16px;">${escHtml(serverList)}</div>
              <div style="font-size:12px;color:var(--text-muted);margin-bottom:20px;">
                The install will run in the background via Datto RMM.
              </div>
              <button id="wiz-new" style="padding:8px 18px;background:var(--accent);border:none;
                border-radius:6px;color:#fff;font-size:13px;cursor:pointer;font-weight:500;">Start New Wizard</button>
            </div>`;
          document.getElementById('wiz-new').addEventListener('click', () => { s = initState(); render(); });
        });
        return;
      }

      const serverSummary = s.selectedDevices.length
        ? s.selectedDevices.map(d => escHtml(d.name)).join(', ')
        : '—';
      el.innerHTML = `
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:16px;font-size:13px;">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;">Deployment summary</div>
          <div style="display:grid;gap:4px;">
            <div><span style="color:var(--text-muted);">Account: </span>${escHtml(s.accountName||'Anchor (Parent)')}</div>
            <div><span style="color:var(--text-muted);">Application: </span>${escHtml(s.app?.name||'—')}</div>
            <div><span style="color:var(--text-muted);">Servers (${s.selectedDevices.length}): </span>${serverSummary}</div>
            <div><span style="color:var(--text-muted);">Site: </span>${escHtml(s.siteName||'—')}</div>
          </div>
        </div>
        <div id="deploy-log-area" style="margin-bottom:12px;"></div>
        <div id="deploy-error" style="display:none;color:#f87171;font-size:12px;margin-bottom:8px;"></div>
        <button id="deploy-btn" style="padding:8px 20px;background:var(--accent);border:none;
          border-radius:6px;color:#fff;font-size:13px;cursor:pointer;font-weight:500;">
          &#128640; Run Quick Job${s.selectedDevices.length>1?'s':''}</button>`;

      el.querySelector('#deploy-btn').addEventListener('click', async () => {
        const btn     = el.querySelector('#deploy-btn');
        const errEl   = el.querySelector('#deploy-error');
        const logArea = el.querySelector('#deploy-log-area');
        btn.disabled=true; btn.textContent='Submitting...'; errEl.style.display='none';

        function addLog(line) {
          s.jobLog.push(line);
          logArea.innerHTML = logBox(s.jobLog);
        }

        try {
          if (!s.app) throw new Error('No application configured — go back and create an app first.');
          if (!s.selectedDevices.length) throw new Error('No servers selected — go back and select a server.');

          addLog(`Submitting Quick Job${s.selectedDevices.length>1?'s':''} to Datto RMM...`);
          addLog(`  App IKEY: ${s.app.integration_key}`);
          addLog(`  App HOST: ${s.app.api_hostname}`);

          for (const device of s.selectedDevices) {
            addLog(`  &#8594; ${device.name}...`);
            const r = await window.api.dattoRunDuoQuickjob({
              deviceUid:   device.uid,
              ikey:        s.app.integration_key,
              skey:        s.app.secret_key,
              apiHostname: s.app.api_hostname,
            });
            if (r.error) {
              addLog(`    &#10007; Failed: ${r.error}`);
              s.jobResults.push({ uid: device.uid, name: device.name, error: r.error });
            } else {
              addLog(`    &#10003; Submitted${r.jobUid ? ` (UID: ${r.jobUid})` : ''}`);
              s.jobResults.push({ uid: device.uid, name: device.name, jobUid: r.jobUid });
            }
          }

          renderDeploy(el, nextBtn);

        } catch(e) {
          addLog(`&#10007; Error: ${e.message}`);
          errEl.style.display=''; errEl.textContent=e.message;
          btn.disabled=false; btn.textContent=`&#128640; Run Quick Job${s.selectedDevices.length>1?'s':''}`;
        }
      });
    }

    render();
  }

  // ── Term Sub Account Tab ─────────────────────────────────────────────────────
  // ── Phone Replace Tab ─────────────────────────────────────────────────────────
  async function renderPhoneReplaceTab(tc) {
    const S = 'width:100%;box-sizing:border-box;padding:8px 10px;background:var(--bg-secondary);' +
              'border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:13px;';
    const L = 'font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;';

    tc.innerHTML = `
      <div class="glass-card" style="padding:20px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
          <div>
            <div style="font-size:13px;font-weight:600;margin-bottom:14px;">Replace Client Phone</div>

            <div style="margin-bottom:10px;">
              <label style="${L}">Sub-Account *</label>
              <select id="pr-acct" style="${S}color-scheme:dark;"><option value="">Loading…</option></select>
            </div>

            <div style="display:flex;gap:8px;margin-bottom:10px;">
              <div style="flex:1;">
                <label style="${L}">Username *</label>
                <input id="pr-username" type="text" placeholder="jsmith" style="${S}">
              </div>
              <div style="display:flex;align-items:flex-end;">
                <button id="pr-find" style="padding:8px 14px;background:var(--bg-secondary);border:1px solid var(--border);
                  border-radius:6px;color:var(--text-primary);font-size:13px;cursor:pointer;white-space:nowrap;">Find User</button>
              </div>
            </div>

            <div id="pr-user-info" style="display:none;background:var(--bg-secondary);border:1px solid var(--border);
              border-radius:6px;padding:10px;margin-bottom:10px;font-size:12px;"></div>

            <div id="pr-phone-fields" style="display:none;">
              <div style="margin-bottom:10px;">
                <label style="${L}">New Phone Number *</label>
                <input id="pr-new-phone" type="tel" placeholder="+15551234567" style="${S}">
              </div>
              <div style="margin-bottom:16px;">
                <label style="${L}">Device Name <span style="font-size:10px;opacity:.7;">(carried over from old phone)</span></label>
                <input id="pr-device" type="text" placeholder="John Smith" style="${S}">
              </div>
              <div id="pr-error" style="display:none;color:#f87171;font-size:12px;margin-bottom:8px;"></div>
              <button id="pr-run" style="padding:8px 20px;background:var(--accent);border:none;border-radius:6px;
                color:#fff;font-size:13px;cursor:pointer;font-weight:500;">Replace Phone</button>
            </div>
          </div>

          <div>
            <div style="font-size:13px;font-weight:600;margin-bottom:14px;">Progress</div>
            <div id="pr-log" style="font-family:monospace;font-size:11px;line-height:1.7;min-height:80px;"></div>
          </div>
        </div>
      </div>`;

    // Load sub-accounts
    const acctSel = tc.querySelector('#pr-acct');
    const r = await window.api.duoListSubAccounts();
    if (r.error) {
      acctSel.innerHTML = `<option value="">Error: ${escHtml(r.error)}</option>`;
    } else {
      const sorted = (r.accounts || []).sort((a, b) => a.name.localeCompare(b.name));
      acctSel.innerHTML = `<option style="background:#1e1e2e;color:#e2e8f0;" value="">— Select account —</option>` +
        sorted.map(a => `<option style="background:#1e1e2e;color:#e2e8f0;" value="${a.account_id}">${escHtml(a.name)}</option>`).join('');
    }

    let foundUser = null;
    let oldPhones = [];

    tc.querySelector('#pr-find').addEventListener('click', async () => {
      const accountId = acctSel.value;
      const username  = tc.querySelector('#pr-username').value.trim();
      const infoEl    = tc.querySelector('#pr-user-info');
      const fieldsEl  = tc.querySelector('#pr-phone-fields');
      const logEl     = tc.querySelector('#pr-log');
      logEl.innerHTML = ''; foundUser = null; oldPhones = [];
      infoEl.style.display = 'none'; fieldsEl.style.display = 'none';
      if (!accountId) { infoEl.style.display=''; infoEl.style.color='#f87171'; infoEl.textContent='Select a sub-account first.'; return; }
      if (!username)  { infoEl.style.display=''; infoEl.style.color='#f87171'; infoEl.textContent='Enter a username.'; return; }
      infoEl.style.display=''; infoEl.style.color='var(--text-muted)'; infoEl.textContent='Looking up user…';
      const uR = await window.api.duoSubFindUsers({ accountId, username });
      if (uR.error || !uR.users.length) {
        infoEl.style.color='#f87171'; infoEl.textContent = uR.error ? `Error: ${uR.error}` : `No user found for "${username}".`; return;
      }
      foundUser = uR.users[0];
      oldPhones = foundUser.phones || [];
      const phoneList = oldPhones.length
        ? oldPhones.map(p => `${p.number || '—'} (${p.name || 'no device name'})`).join(', ')
        : 'No phones enrolled';
      infoEl.style.color = 'var(--text-primary)';
      infoEl.innerHTML = `<strong>${escHtml(foundUser.realname || foundUser.username)}</strong>
        <span style="color:var(--text-muted);margin-left:8px;">${escHtml(foundUser.email || '')}</span><br>
        <span style="color:var(--text-muted);font-size:11px;">Current phone${oldPhones.length!==1?'s':''}: ${escHtml(phoneList)}</span>`;
      // Pre-fill device name from first found phone
      if (oldPhones.length) tc.querySelector('#pr-device').value = oldPhones[0].name || '';
      fieldsEl.style.display = '';
    });

    tc.querySelector('#pr-username').addEventListener('keydown', e => {
      if (e.key === 'Enter') tc.querySelector('#pr-find').click();
    });

    tc.querySelector('#pr-run').addEventListener('click', async () => {
      const accountId = acctSel.value;
      const newPhone  = tc.querySelector('#pr-new-phone').value.trim();
      const deviceName = tc.querySelector('#pr-device').value.trim();
      const errEl     = tc.querySelector('#pr-error');
      const logEl     = tc.querySelector('#pr-log');
      errEl.style.display = 'none';
      if (!foundUser) { errEl.style.display=''; errEl.textContent='Find a user first.'; return; }
      if (!newPhone)  { errEl.style.display=''; errEl.textContent='Enter the new phone number.'; return; }
      const btn = tc.querySelector('#pr-run');
      btn.disabled = true; btn.textContent = 'Replacing…';
      const lines = [];
      const log = (msg, ok) => {
        const c = ok===true ? '#4ade80' : ok===false ? '#f87171' : 'var(--text-muted)';
        const i = ok===true ? '✓' : ok===false ? '✗' : '·';
        lines.push(`<span style="color:${c}">${i} ${escHtml(msg)}</span>`);
        logEl.innerHTML = lines.join('<br>');
      };
      try {
        for (const ph of oldPhones) {
          log(`Removing old phone ${ph.number || ph.phone_id}…`);
          const dR = await window.api.duoSubDeletePhone({ accountId, phoneId: ph.phone_id });
          if (dR.error) throw new Error(`Remove old phone failed: ${dR.error}`);
          log(`Old phone removed`, true);
        }
        log(`Adding new phone ${newPhone}…`);
        const pR = await window.api.duoSubCreatePhone({ accountId, number: newPhone, name: deviceName || undefined });
        if (pR.error) throw new Error(pR.error);
        log(`Phone added${deviceName ? ` — device name: "${deviceName}"` : ''}`, true);
        log(`Associating phone with ${foundUser.username}…`);
        const aR = await window.api.duoSubAssociatePhone({ accountId, userId: foundUser.user_id, phoneId: pR.phone.phone_id });
        if (aR.error) throw new Error(aR.error);
        log(`Phone associated`, true);
        log(`Sending activation SMS…`);
        const sR = await window.api.duoSubSendActivation({ accountId, phoneId: pR.phone.phone_id });
        if (sR.error) { log(`Activation SMS failed: ${sR.error}`, false); }
        else           { log(`Activation SMS sent`, true); }
        log(`Done — phone replaced for ${foundUser.username}`, true);
        btn.textContent = 'Replace Another';
        btn.disabled = false;
        btn.addEventListener('click', () => {
          ['#pr-username','#pr-new-phone','#pr-device'].forEach(sel => { const el2 = tc.querySelector(sel); if (el2) el2.value = ''; });
          tc.querySelector('#pr-user-info').style.display = 'none';
          tc.querySelector('#pr-phone-fields').style.display = 'none';
          logEl.innerHTML = ''; lines.length = 0; foundUser = null; oldPhones = [];
          btn.textContent = 'Replace Phone';
        }, { once: true });
      } catch (e) {
        log(e.message, false);
        errEl.style.display=''; errEl.textContent = e.message;
        btn.disabled = false; btn.textContent = 'Replace Phone';
      }
    });
  }

  // ── Offboard User Tab ─────────────────────────────────────────────────────────
  async function renderOffboardUserTab(tc) {
    const S = 'width:100%;box-sizing:border-box;padding:8px 10px;background:var(--bg-secondary);' +
              'border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:13px;';
    const L = 'font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;';

    tc.innerHTML = `
      <div class="glass-card" style="padding:20px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
          <div>
            <div style="font-size:13px;font-weight:600;margin-bottom:14px;">Offboard Client User from Duo</div>

            <div style="margin-bottom:10px;">
              <label style="${L}">Sub-Account *</label>
              <select id="ob-acct" style="${S}color-scheme:dark;"><option value="">Loading…</option></select>
            </div>

            <div style="display:flex;gap:8px;margin-bottom:10px;">
              <div style="flex:1;">
                <label style="${L}">Username *</label>
                <input id="ob-username" type="text" placeholder="jsmith" style="${S}">
              </div>
              <div style="display:flex;align-items:flex-end;">
                <button id="ob-find" style="padding:8px 14px;background:var(--bg-secondary);border:1px solid var(--border);
                  border-radius:6px;color:var(--text-primary);font-size:13px;cursor:pointer;white-space:nowrap;">Find User</button>
              </div>
            </div>

            <div id="ob-user-info" style="display:none;background:var(--bg-secondary);border:1px solid var(--border);
              border-radius:6px;padding:10px;margin-bottom:10px;font-size:12px;"></div>

            <div id="ob-confirm-section" style="display:none;">
              <div style="padding:10px 12px;background:#f8717110;border:1px solid #f8717133;border-radius:6px;
                margin-bottom:12px;font-size:12px;color:#f87171;">
                This will remove all phones and permanently delete the user from this sub-account.
              </div>
              <div id="ob-error" style="display:none;color:#f87171;font-size:12px;margin-bottom:8px;"></div>
              <button id="ob-run" style="padding:8px 20px;background:#f87171;border:none;border-radius:6px;
                color:#fff;font-size:13px;cursor:pointer;font-weight:500;">Offboard User</button>
            </div>
          </div>

          <div>
            <div style="font-size:13px;font-weight:600;margin-bottom:14px;">Progress</div>
            <div id="ob-log" style="font-family:monospace;font-size:11px;line-height:1.7;min-height:80px;"></div>
          </div>
        </div>
      </div>`;

    // Load sub-accounts
    const acctSel = tc.querySelector('#ob-acct');
    const r = await window.api.duoListSubAccounts();
    if (r.error) {
      acctSel.innerHTML = `<option value="">Error: ${escHtml(r.error)}</option>`;
    } else {
      const sorted = (r.accounts || []).sort((a, b) => a.name.localeCompare(b.name));
      acctSel.innerHTML = `<option style="background:#1e1e2e;color:#e2e8f0;" value="">— Select account —</option>` +
        sorted.map(a => `<option style="background:#1e1e2e;color:#e2e8f0;" value="${a.account_id}">${escHtml(a.name)}</option>`).join('');
    }

    let foundUser = null;

    tc.querySelector('#ob-find').addEventListener('click', async () => {
      const accountId = acctSel.value;
      const username  = tc.querySelector('#ob-username').value.trim();
      const infoEl    = tc.querySelector('#ob-user-info');
      const confirmEl = tc.querySelector('#ob-confirm-section');
      const logEl     = tc.querySelector('#ob-log');
      logEl.innerHTML = ''; foundUser = null;
      infoEl.style.display = 'none'; confirmEl.style.display = 'none';
      if (!accountId) { infoEl.style.display=''; infoEl.style.color='#f87171'; infoEl.textContent='Select a sub-account first.'; return; }
      if (!username)  { infoEl.style.display=''; infoEl.style.color='#f87171'; infoEl.textContent='Enter a username.'; return; }
      infoEl.style.display=''; infoEl.style.color='var(--text-muted)'; infoEl.textContent='Looking up user…';
      const uR = await window.api.duoSubFindUsers({ accountId, username });
      if (uR.error || !uR.users.length) {
        infoEl.style.color='#f87171'; infoEl.textContent = uR.error ? `Error: ${uR.error}` : `No user found for "${username}".`; return;
      }
      foundUser = uR.users[0];
      const phones = foundUser.phones || [];
      const phoneList = phones.length
        ? phones.map(p => `${p.number || '—'} (${p.name || 'no device name'})`).join(', ')
        : 'No phones enrolled';
      infoEl.style.color = 'var(--text-primary)';
      infoEl.innerHTML = `<strong>${escHtml(foundUser.realname || foundUser.username)}</strong>
        <span style="color:var(--text-muted);margin-left:8px;">${escHtml(foundUser.email || '')}</span><br>
        <span style="color:var(--text-muted);font-size:11px;">Phone${phones.length!==1?'s':''}: ${escHtml(phoneList)}</span>`;
      confirmEl.style.display = '';
    });

    tc.querySelector('#ob-username').addEventListener('keydown', e => {
      if (e.key === 'Enter') tc.querySelector('#ob-find').click();
    });

    tc.querySelector('#ob-run').addEventListener('click', async () => {
      const accountId = acctSel.value;
      const errEl     = tc.querySelector('#ob-error');
      const logEl     = tc.querySelector('#ob-log');
      errEl.style.display = 'none';
      if (!foundUser) { errEl.style.display=''; errEl.textContent='Find a user first.'; return; }
      if (!confirm(`Permanently remove ${foundUser.username} from this sub-account?`)) return;
      const btn = tc.querySelector('#ob-run');
      btn.disabled = true; btn.textContent = 'Offboarding…';
      const lines = [];
      const log = (msg, ok) => {
        const c = ok===true ? '#4ade80' : ok===false ? '#f87171' : 'var(--text-muted)';
        const i = ok===true ? '✓' : ok===false ? '✗' : '·';
        lines.push(`<span style="color:${c}">${i} ${escHtml(msg)}</span>`);
        logEl.innerHTML = lines.join('<br>');
      };
      try {
        const phones = foundUser.phones || [];
        for (const ph of phones) {
          log(`Removing phone ${ph.number || ph.phone_id}…`);
          const dR = await window.api.duoSubDeletePhone({ accountId, phoneId: ph.phone_id });
          if (dR.error) throw new Error(`Remove phone failed: ${dR.error}`);
          log(`Phone removed`, true);
        }
        log(`Deleting user ${foundUser.username}…`);
        const delR = await window.api.duoSubDeleteUser({ accountId, userId: foundUser.user_id });
        if (delR.error) throw new Error(delR.error);
        log(`User deleted`, true);
        log(`Done — ${foundUser.username} has been offboarded`, true);
        tc.querySelector('#ob-confirm-section').style.display = 'none';
        btn.disabled = false;
      } catch (e) {
        log(e.message, false);
        errEl.style.display=''; errEl.textContent = e.message;
        btn.disabled = false; btn.textContent = 'Offboard User';
      }
    });
  }

  function renderTermSubTab(tc) {
    tc.innerHTML = `
      <div class="glass-card" style="padding:32px;text-align:center;">
        <div style="font-size:15px;font-weight:600;margin-bottom:8px;">Terminate Sub Account</div>
        <div style="font-size:13px;color:var(--text-muted);">
          Sub-account termination is handled manually in the Duo Admin portal.
        </div>
      </div>`;
  }

  // ── New Client User Tab ───────────────────────────────────────────────────────
  async function renderNewUserTab(tc) {
    const S = 'width:100%;box-sizing:border-box;padding:8px 10px;background:var(--bg-secondary);' +
              'border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-size:13px;';
    const L = 'font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;';

    tc.innerHTML = `
      <div class="glass-card" style="padding:20px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;">
          <div>
            <div style="font-size:13px;font-weight:600;margin-bottom:14px;">Add User to Client Sub-Account</div>

            <div style="margin-bottom:10px;">
              <label style="${L}">Sub-Account *</label>
              <select id="nu-acct" style="${S}color-scheme:dark;">
                <option value="">Loading…</option>
              </select>
            </div>

            <div style="margin-bottom:10px;">
              <label style="${L}">Username * <span style="font-size:10px;opacity:.7;">(AD username, e.g. jsmith)</span></label>
              <input id="nu-username" type="text" placeholder="jsmith" style="${S}">
            </div>

            <div style="margin-bottom:10px;">
              <label style="${L}">Display Name</label>
              <input id="nu-realname" type="text" placeholder="John Smith" style="${S}">
            </div>

            <div style="margin-bottom:10px;">
              <label style="${L}">Email Address</label>
              <input id="nu-email" type="email" placeholder="jsmith@client.com" style="${S}">
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
              <div>
                <label style="${L}">First Name</label>
                <input id="nu-first" type="text" placeholder="John" style="${S}">
              </div>
              <div>
                <label style="${L}">Last Name</label>
                <input id="nu-last" type="text" placeholder="Smith" style="${S}">
              </div>
            </div>

            <div style="margin-bottom:10px;">
              <label style="${L}">Mobile Phone Number *</label>
              <input id="nu-phone" type="tel" placeholder="+15551234567" style="${S}">
            </div>

            <div style="margin-bottom:16px;">
              <label style="${L}">Device Name <span style="font-size:10px;opacity:.7;">(auto-filled from first + last name)</span></label>
              <input id="nu-device" type="text" placeholder="John Smith" style="${S}">
            </div>

            <div id="nu-error" style="display:none;color:#f87171;font-size:12px;margin-bottom:8px;"></div>
            <button id="nu-run" style="padding:8px 20px;background:var(--accent);border:none;border-radius:6px;
              color:#fff;font-size:13px;cursor:pointer;font-weight:500;">Add User</button>
          </div>

          <div>
            <div style="font-size:13px;font-weight:600;margin-bottom:14px;">Progress</div>
            <div id="nu-log" style="font-family:monospace;font-size:11px;line-height:1.7;min-height:80px;"></div>
          </div>
        </div>
      </div>`;

    // Load sub-accounts
    const acctSel = tc.querySelector('#nu-acct');
    const r = await window.api.duoListSubAccounts();
    if (r.error) {
      acctSel.innerHTML = `<option value="">Error: ${escHtml(r.error)}</option>`;
    } else {
      const sorted = (r.accounts || []).sort((a, b) => a.name.localeCompare(b.name));
      acctSel.innerHTML = `<option style="background:#1e1e2e;color:#e2e8f0;" value="">— Select account —</option>` +
        sorted.map(a => `<option style="background:#1e1e2e;color:#e2e8f0;" value="${a.account_id}">${escHtml(a.name)}</option>`).join('');
    }

    // Auto-fill device name when first/last changes
    function syncDevice() {
      const first = tc.querySelector('#nu-first').value.trim();
      const last  = tc.querySelector('#nu-last').value.trim();
      const combined = [first, last].filter(Boolean).join(' ');
      if (combined) tc.querySelector('#nu-device').value = combined;
    }
    tc.querySelector('#nu-first').addEventListener('input', syncDevice);
    tc.querySelector('#nu-last').addEventListener('input', syncDevice);

    tc.querySelector('#nu-run').addEventListener('click', async () => {
      const accountId  = acctSel.value;
      const username   = tc.querySelector('#nu-username').value.trim();
      const realname   = tc.querySelector('#nu-realname').value.trim();
      const email      = tc.querySelector('#nu-email').value.trim();
      const firstname  = tc.querySelector('#nu-first').value.trim();
      const lastname   = tc.querySelector('#nu-last').value.trim();
      const phone      = tc.querySelector('#nu-phone').value.trim();
      const deviceName = tc.querySelector('#nu-device').value.trim();
      const errEl      = tc.querySelector('#nu-error');
      const logEl      = tc.querySelector('#nu-log');

      errEl.style.display = 'none';
      if (!accountId) { errEl.style.display = ''; errEl.textContent = 'Select a sub-account.'; return; }
      if (!username)  { errEl.style.display = ''; errEl.textContent = 'Username is required.'; return; }
      if (!phone)     { errEl.style.display = ''; errEl.textContent = 'Phone number is required.'; return; }

      const btn = tc.querySelector('#nu-run');
      btn.disabled = true; btn.textContent = 'Adding…';
      const lines = [];
      const log = (msg, ok) => {
        const c = ok === true ? '#4ade80' : ok === false ? '#f87171' : 'var(--text-muted)';
        const i = ok === true ? '✓' : ok === false ? '✗' : '·';
        lines.push(`<span style="color:${c}">${i} ${escHtml(msg)}</span>`);
        logEl.innerHTML = lines.join('<br>');
      };

      try {
        log(`Creating user "${username}"…`);
        const uR = await window.api.duoSubCreateUser({
          accountId,
          username,
          realname:  realname  || undefined,
          email:     email     || undefined,
          firstname: firstname || undefined,
          lastname:  lastname  || undefined,
        });
        if (uR.error) throw new Error(uR.error);
        log(`User created (ID: ${uR.user.user_id})`, true);

        log(`Adding phone ${phone}…`);
        const pR = await window.api.duoSubCreatePhone({ accountId, number: phone, name: deviceName || undefined });
        if (pR.error) throw new Error(pR.error);
        log(`Phone added${deviceName ? ` — device name: "${deviceName}"` : ''}`, true);

        log(`Associating phone with user…`);
        const aR = await window.api.duoSubAssociatePhone({ accountId, userId: uR.user.user_id, phoneId: pR.phone.phone_id });
        if (aR.error) throw new Error(aR.error);
        log(`Phone associated`, true);

        log(`Sending activation SMS…`);
        const sR = await window.api.duoSubSendActivation({ accountId, phoneId: pR.phone.phone_id });
        if (sR.error) { log(`Activation SMS failed: ${sR.error}`, false); }
        else           { log(`Activation SMS sent`, true); }

        const acctName = acctSel.options[acctSel.selectedIndex]?.textContent || '';
        log(`Done — ${username} added to ${acctName.trim()}`, true);
        btn.textContent = 'Add Another';
        btn.disabled = false;
        btn.addEventListener('click', () => {
          ['#nu-username','#nu-realname','#nu-email','#nu-first','#nu-last','#nu-phone','#nu-device']
            .forEach(sel => { const el2 = tc.querySelector(sel); if (el2) el2.value = ''; });
          logEl.innerHTML = ''; lines.length = 0;
          btn.textContent = 'Add User';
        }, { once: true });

      } catch (e) {
        log(e.message, false);
        errEl.style.display = ''; errEl.textContent = e.message;
        btn.disabled = false; btn.textContent = 'Add User';
      }
    });
  }

  render();
}

// navigate('home') is called from initApp() after successful authentication


// --- Project Profitability ---
let _profData = null;
let _profSettings = null;

async function renderProjectProfitability() {
  const settings = await window.api.getProfitabilitySettings();
  _profSettings = settings;

  content.innerHTML = [
    '<div class="view-header">',
    '  <div>',
    '    <h1 class="view-title">Project Profitability</h1>',
    '    <p class="view-subtitle">Analyze completed project margins, invoiced revenue vs cost of delivery, and lead performance</p>',
    '  </div>',
    '  <div class="view-actions">',
    '    <button class="btn btn-ghost btn-sm" id="prof-export-btn" disabled>',
    '      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">',
    '        <path d="M7 1v8M4 6l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
    '        <path d="M1 10v1.5A1.5 1.5 0 002.5 13h9A1.5 1.5 0 0013 11.5V10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    '      </svg>',
    '      Export Excel',
    '    </button>',
    '  </div>',
    '</div>',
    '<div class="settings-section" style="margin-bottom:16px">',
    '  <div class="section-header" style="cursor:pointer;display:flex;align-items:center;justify-content:space-between" id="prof-settings-toggle">',
    '    <span style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Settings</span>',
    '    <svg id="prof-settings-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none" style="transition:transform .2s">',
    '      <path d="M3 5l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>',
    '    </svg>',
    '  </div>',
    '  <div id="prof-settings-body" style="display:none;margin-top:12px">',
    '    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">',
    '      <div><label class="field-label">Blended Labor Rate ($/hr)</label>',
    '        <input class="field-input" id="prof-labor-rate" type="number" step="0.01" value="' + settings.blendedLaborRate + '" /></div>',
    '      <div><label class="field-label">Standard Billable Rate ($/hr)</label>',
    '        <input class="field-input" id="prof-bill-rate" type="number" step="0.01" value="' + settings.standardBillRate + '" /></div>',
    '      <div><label class="field-label">Margin Warning Threshold (%)</label>',
    '        <input class="field-input" id="prof-margin-threshold" type="number" step="1" value="' + settings.marginWarnThreshold + '" /></div>',
    '    </div>',
    '    <button class="btn btn-ghost btn-sm" id="prof-save-settings-btn">Save Settings</button>',
    '    <span id="prof-settings-status" style="font-size:11px;color:var(--text-muted);margin-left:10px"></span>',
    '  </div>',
    '</div>',
    '<div style="display:flex;align-items:flex-end;gap:12px;margin-bottom:16px;flex-wrap:wrap">',
    '  <div><label class="field-label">Start Date</label>',
    '    <input class="field-input" id="prof-start" type="date" style="width:160px" /></div>',
    '  <div><label class="field-label">End Date</label>',
    '    <input class="field-input" id="prof-end" type="date" style="width:160px" /></div>',
    '  <div style="display:flex;align-items:center;gap:8px;padding-bottom:2px">',
    '    <input type="checkbox" id="prof-include-active" style="accent-color:var(--accent);width:14px;height:14px" />',
    '    <label for="prof-include-active" style="font-size:12px;color:var(--text-muted);cursor:pointer">Include active projects</label>',
    '  </div>',
    '  <button class="btn btn-primary" id="prof-run-btn">',
    '    <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3 2l9 5-9 5V2z" fill="currentColor"/></svg>',
    '    Run Report',
    '  </button>',
    '</div>',
    '<div id="prof-status" style="display:none;padding:12px;border-radius:8px;background:var(--bg-surface);margin-bottom:12px;font-size:12px;color:var(--text-muted);align-items:center;gap:10px"></div>',
    '<div id="prof-results"></div>',
  ].join('\n');

  const now = new Date();
  const twoYearsAgo = new Date(now);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  document.getElementById('prof-start').value = twoYearsAgo.toISOString().slice(0, 10);
  document.getElementById('prof-end').value = now.toISOString().slice(0, 10);

  document.getElementById('prof-settings-toggle').onclick = function() {
    const body = document.getElementById('prof-settings-body');
    const chevron = document.getElementById('prof-settings-chevron');
    const open = body.style.display === 'none';
    body.style.display = open ? '' : 'none';
    chevron.style.transform = open ? 'rotate(180deg)' : '';
  };

  document.getElementById('prof-save-settings-btn').onclick = async function() {
    const s = {
      blendedLaborRate:    parseFloat(document.getElementById('prof-labor-rate').value)       || 83.50,
      standardBillRate:    parseFloat(document.getElementById('prof-bill-rate').value)        || 200.00,
      marginWarnThreshold: parseFloat(document.getElementById('prof-margin-threshold').value) || 20,
    };
    await window.api.saveProfitabilitySettings(s);
    _profSettings = s;
    const status = document.getElementById('prof-settings-status');
    status.textContent = 'Saved.';
    setTimeout(function() { if (status) status.textContent = ''; }, 2000);
  };

  if (_profData) profRenderResults(_profData, _profSettings);
  document.getElementById('prof-run-btn').onclick = profRunReport;
  document.getElementById('prof-export-btn').onclick = profExport;
}

async function profRunReport() {
  const runBtn     = document.getElementById('prof-run-btn');
  const statusDiv  = document.getElementById('prof-status');
  const resultsDiv = document.getElementById('prof-results');
  const exportBtn  = document.getElementById('prof-export-btn');
  const startDate     = document.getElementById('prof-start').value || null;
  const endDate       = document.getElementById('prof-end').value   || null;
  const includeActive = document.getElementById('prof-include-active').checked;

  runBtn.disabled = true;
  exportBtn.disabled = true;
  statusDiv.style.display = 'flex';
  statusDiv.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px"></span>'
    + '<span>Fetching projects from Autotask\u2026 This may take a few minutes.</span>';
  resultsDiv.innerHTML = '';

  try {
    const result = await window.api.runProjectProfitability({ startDate, endDate, includeActive });
    _profData     = result.projects;
    _profSettings = result.settings;
    statusDiv.style.display = 'none';
    profRenderResults(_profData, _profSettings);
    exportBtn.disabled = !_profData.length;
    saveToolStat('project-profitability', _profData.length + ' projects', 'ok');
  } catch (e) {
    statusDiv.innerHTML = '<span style="color:var(--error)"><strong>Error:</strong> ' + escHtml(e.message) + '</span>';
    saveToolStat('project-profitability', 'Error: ' + e.message, 'error');
  } finally {
    runBtn.disabled = false;
  }
}

function profFmtDollar(n) {
  if (n == null) return '\u2014';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function profFmtPct(n) {
  if (n == null) return '\u2014';
  return n.toFixed(1) + '%';
}

function profRenderResults(rows, settings) {
  const el = document.getElementById('prof-results');
  if (!el) return;

  if (!rows || !rows.length) {
    el.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted);font-size:13px">No projects found for the selected date range.</div>';
    return;
  }

  const totalInvoiced = rows.reduce(function(s, r) { return s + (r.invoicedAmt || 0); }, 0);
  const totalCost     = rows.reduce(function(s, r) { return s + (r.costOfDelivery || 0); }, 0);
  const totalMargin   = totalInvoiced > 0 ? (totalInvoiced - totalCost) / totalInvoiced * 100 : 0;
  const totalPending  = rows.reduce(function(s, r) { return s + (r.pendingAmt || 0); }, 0);
  const flaggedCount  = rows.filter(function(r) { return r.flags; }).length;

  const marginColor = totalMargin >= settings.marginWarnThreshold + 10 ? 'var(--success,#4ade80)'
    : totalMargin >= settings.marginWarnThreshold ? 'var(--warn,#fbbf24)' : 'var(--error,#f87171)';

  const statCards = [
    ['Projects',         String(rows.length),          'var(--text)'],
    ['Total Invoiced',   profFmtDollar(totalInvoiced),  'var(--success,#4ade80)'],
    ['Gross Margin',     profFmtPct(totalMargin),        marginColor],
    ['Pending Unbilled', profFmtDollar(totalPending),    totalPending > 0 ? 'var(--warn,#fbbf24)' : 'var(--text)'],
    ['Flagged',          String(flaggedCount),           flaggedCount > 0 ? 'var(--error,#f87171)' : 'var(--text)'],
  ];

  const cardHtml = statCards.map(function(item) {
    return '<div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px">'
      + '<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">' + item[0] + '</div>'
      + '<div style="font-size:18px;font-weight:700;color:' + item[2] + '">' + escHtml(item[1]) + '</div>'
      + '</div>';
  }).join('');

  const colDefs = [
    ['Project #',    'projectNumber'],
    ['Project Name', 'projectName'],
    ['Client',       'company'],
    ['Lead',         'lead'],
    ['Type',         'billingType'],
    ['Year',         'year'],
    ['Est. Hrs',     'estHours'],
    ['Billed Hrs',   'billedHours'],
    ['Total Hrs',    'totalHours'],
    ['Hrs Var %',    'hoursVariancePct'],
    ['Invoiced',     'invoicedAmt'],
    ['Pending',      'pendingAmt'],
    ['Cost',         'costOfDelivery'],
    ['Margin %',     'grossMarginPct'],
    ['Eff. Rate',    'effectiveRate'],
    ['vs Rack',      'discountVsRack'],
  ];

  const headerHtml = colDefs.map(function(c) {
    return '<th data-col="' + c[1] + '" style="cursor:pointer;white-space:nowrap">'
      + c[0] + ' <span class="sort-arrow"></span></th>';
  }).join('') + '<th>Flags</th>';

  const rowsHtml = rows.map(function(r, i) {
    const altBg    = i % 2 === 1 ? 'background:var(--bg-surface)' : '';
    const marginBg = r.grossMarginPct == null ? '' :
      r.grossMarginPct < settings.marginWarnThreshold      ? 'background:#ffc7ce30' :
      r.grossMarginPct < settings.marginWarnThreshold + 10 ? 'background:#ffeb9c30' : 'background:#c6efce30';
    const typeBg   = r.billingType === 'Fixed Price'      ? 'background:#e2efda30' :
                     r.billingType === 'Time & Materials' ? 'background:#ddeeff30' :
                     r.billingType === 'Block Hours'      ? 'background:#fff2cc30' :
                     r.billingType === 'No Contract'      ? 'background:#ffc7ce30' : '';
    const varBg    = r.hoursVariancePct == null ? '' :
      r.hoursVariancePct > 50 ? 'background:#ffc7ce30' :
      r.hoursVariancePct > 20 ? 'background:#ffeb9c30' : '';
    const rackBg   = r.discountVsRack == null ? '' :
      r.discountVsRack >= 0 ? 'background:#c6efce30' : 'background:#ffeb9c30';
    const pendBg   = r.pendingAmt > 0 ? 'background:#ffeb9c30' : '';
    const flagColor = r.flags ? 'var(--warn,#fbbf24)' : 'var(--text-muted)';
    return '<tr style="' + altBg + '">'
      + '<td style="white-space:nowrap;font-family:monospace;font-size:11px">' + escHtml(r.projectNumber || '') + '</td>'
      + '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escHtml(r.projectName) + '">' + escHtml(r.projectName) + '</td>'
      + '<td style="white-space:nowrap">' + escHtml(r.company) + '</td>'
      + '<td style="white-space:nowrap">' + escHtml(r.lead) + '</td>'
      + '<td style="white-space:nowrap;' + typeBg + '">' + escHtml(r.billingType) + '</td>'
      + '<td style="text-align:center">' + escHtml(r.year || '') + '</td>'
      + '<td style="text-align:right">' + (r.estHours != null ? Number(r.estHours).toFixed(1) : '\u2014') + '</td>'
      + '<td style="text-align:right">' + (r.billedHours != null ? Number(r.billedHours).toFixed(1) : '\u2014') + '</td>'
      + '<td style="text-align:right;color:var(--text-muted)">' + (r.totalHours != null ? Number(r.totalHours).toFixed(1) : '\u2014') + '</td>'
      + '<td style="text-align:right;' + varBg + '">' + (r.hoursVariancePct != null ? r.hoursVariancePct.toFixed(1) + '%' : '\u2014') + '</td>'
      + '<td style="text-align:right">' + (r.invoicedAmt != null ? profFmtDollar(r.invoicedAmt) : '\u2014') + '</td>'
      + '<td style="text-align:right;' + pendBg + '">' + (r.pendingAmt > 0 ? profFmtDollar(r.pendingAmt) : '\u2014') + '</td>'
      + '<td style="text-align:right">' + (r.costOfDelivery != null ? profFmtDollar(r.costOfDelivery) : '\u2014') + '</td>'
      + '<td style="text-align:right;' + marginBg + '">' + (r.grossMarginPct != null ? r.grossMarginPct.toFixed(1) + '%' : '\u2014') + '</td>'
      + '<td style="text-align:right">' + (r.effectiveRate != null ? profFmtDollar(r.effectiveRate) + '/hr' : '\u2014') + '</td>'
      + '<td style="text-align:right;' + rackBg + '">' + (r.discountVsRack != null ? profFmtDollar(r.discountVsRack) : '\u2014') + '</td>'
      + '<td style="font-size:11px;color:' + flagColor + ';max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escHtml(r.flags || '') + '">' + escHtml(r.flags || '') + '</td>'
      + '</tr>';
  }).join('');

  el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:16px">' + cardHtml + '</div>'
    + '<div style="overflow-x:auto"><table class="data-table" id="prof-table">'
    + '<thead><tr>' + headerHtml + '</tr></thead>'
    + '<tbody>' + rowsHtml + '</tbody></table></div>';

  const numCols = new Set(['estHours','billedHours','totalHours','hoursVariancePct','invoicedAmt','pendingAmt','costOfDelivery','grossMarginPct','effectiveRate','discountVsRack','year']);
  let sortCol = null, sortDir = 1;
  el.querySelectorAll('th[data-col]').forEach(function(th) {
    th.addEventListener('click', function() {
      const key = th.dataset.col;
      if (sortCol === key) { sortDir *= -1; } else { sortCol = key; sortDir = 1; }
      el.querySelectorAll('th .sort-arrow').forEach(function(s) { s.textContent = ''; });
      th.querySelector('.sort-arrow').textContent = sortDir === 1 ? ' \u25b2' : ' \u25bc';
      const tbody = document.querySelector('#prof-table tbody');
      const thList = Array.from(document.querySelectorAll('#prof-table th[data-col]'));
      const idx = thList.findIndex(function(c) { return c.dataset.col === key; });
      const rowEls = Array.from(tbody.querySelectorAll('tr'));
      rowEls.sort(function(a, b) {
        const av = a.cells[idx] ? a.cells[idx].textContent.trim().replace(/[$,/hr%]/g, '') : '';
        const bv = b.cells[idx] ? b.cells[idx].textContent.trim().replace(/[$,/hr%]/g, '') : '';
        if (numCols.has(key)) { return ((parseFloat(av) || 0) - (parseFloat(bv) || 0)) * sortDir; }
        return av.localeCompare(bv) * sortDir;
      });
      rowEls.forEach(function(r) { tbody.appendChild(r); });
    });
  });
}

async function profExport() {
  const btn = document.getElementById('prof-export-btn');
  const origHtml = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = 'Exporting\u2026';
  try {
    const result = await window.api.exportProfitabilityReport({ rows: _profData, settings: _profSettings });
    if (result.canceled) { return; }
    if (result.error) { alert('Export failed: ' + result.error); }
  } catch (e) {
    alert('Export failed: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHtml;
  }
}
