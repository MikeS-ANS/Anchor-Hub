window.onerror = (msg, src, line, col, err) => console.error('[app.js uncaught]', msg, `${src}:${line}:${col}`, err);
window.onunhandledrejection = (e) => console.error('[app.js unhandled rejection]', e.reason);

// Window controls
document.getElementById('btn-min').addEventListener('click', () => window.api.minimize());
document.getElementById('btn-max').addEventListener('click', () => window.api.maximize());
document.getElementById('btn-close').addEventListener('click', () => window.api.close());

// ─── Background visual layers: constellation anchor (upper-right) + orange webbing (lower-left) ──
(function injectBgLayers() {
  if (document.getElementById('hub-bg')) return;

  // Orange network webbing — computed ray + arc intersection SVG
  const VW = 700, VH = 540;
  const ox = 0, oy = VH;
  const rayEnds = [
    [0, 0], [90, 0], [210, 0], [370, 0], [545, 0],
    [700, 0], [700, 130], [700, 300], [700, 460]
  ];
  const rings = [165, 320, 462];

  const arcPts = rings.map(d =>
    rayEnds.map(([ex, ey]) => {
      const dx = ex - ox, dy = ey - oy;
      const L = Math.hypot(dx, dy);
      return [+(ox + d * dx / L).toFixed(1), +(oy + d * dy / L).toFixed(1)];
    })
  );

  const rayLines = rayEnds.map(([ex, ey]) =>
    `<line x1="${ox}" y1="${oy}" x2="${ex}" y2="${ey}"/>`
  ).join('');

  const crossLines = arcPts.map(ring => {
    let s = '';
    for (let i = 0; i < ring.length - 1; i++)
      s += `<line x1="${ring[i][0]}" y1="${ring[i][1]}" x2="${ring[i+1][0]}" y2="${ring[i+1][1]}"/>`;
    return s;
  }).join('');

  const nodeDots = arcPts.flat()
    .filter(([x, y]) => x >= 0 && x <= VW && y >= 0 && y <= VH)
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2"/>`)
    .join('');

  const wsvg = `<svg id="bg-webbing" viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMinYMax meet">
    <g stroke="rgba(194,118,55,0.22)" stroke-width="0.9" fill="none">${rayLines}${crossLines}</g>
    <g fill="rgba(194,118,55,0.50)">${nodeDots}<circle cx="0" cy="${VH}" r="3.5"/></g>
  </svg>`;

  // Constellation anchor — subtle anchor outline + star field + connecting lines
  const asvg = `<svg id="bg-anchor" viewBox="0 0 300 360" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMaxYMin meet">
    <defs>
      <radialGradient id="anchorGlow" cx="50%" cy="44%" r="52%">
        <stop offset="0%" stop-color="rgba(59,130,160,0.14)"/>
        <stop offset="100%" stop-color="rgba(59,130,160,0)"/>
      </radialGradient>
    </defs>
    <ellipse cx="152" cy="165" rx="118" ry="138" fill="url(#anchorGlow)"/>
    <g stroke="rgba(148,163,184,0.22)" stroke-width="1.6" fill="none" stroke-linecap="round">
      <circle cx="152" cy="52" r="24"/>
      <line x1="152" y1="28" x2="152" y2="278"/>
      <line x1="80" y1="96" x2="224" y2="96"/>
      <path d="M 152 278 C 120 278 74 258 52 228"/>
      <path d="M 52 228 C 38 210 44 194 58 190"/>
      <path d="M 152 278 C 184 278 230 258 252 228"/>
      <path d="M 252 228 C 266 210 260 194 246 190"/>
    </g>
    <g fill="rgba(148,163,184,0.52)">
      <circle cx="152" cy="28" r="2.8"/>
      <circle cx="152" cy="52" r="3.2"/>
      <circle cx="80" cy="96" r="2.8"/>
      <circle cx="224" cy="96" r="2.8"/>
      <circle cx="152" cy="187" r="2.2"/>
      <circle cx="152" cy="278" r="2.8"/>
      <circle cx="52" cy="228" r="2.8"/>
      <circle cx="252" cy="228" r="2.8"/>
      <circle cx="58" cy="190" r="2.2"/>
      <circle cx="246" cy="190" r="2.2"/>
    </g>
    <g fill="rgba(148,163,184,0.70)">
      <circle cx="26" cy="32" r="1.8"/>
      <circle cx="278" cy="18" r="1.4"/>
      <circle cx="10" cy="150" r="1.2"/>
      <circle cx="290" cy="120" r="1.8"/>
      <circle cx="28" cy="258" r="1.4"/>
      <circle cx="274" cy="274" r="1.2"/>
      <circle cx="62" cy="14" r="1.2"/>
      <circle cx="240" cy="12" r="1.5"/>
      <circle cx="8" cy="310" r="1.8"/>
      <circle cx="292" cy="340" r="1.2"/>
      <circle cx="110" cy="350" r="1.2"/>
      <circle cx="200" cy="352" r="1.5"/>
      <circle cx="168" cy="6" r="1.2"/>
      <circle cx="140" cy="345" r="1.0"/>
    </g>
    <g stroke="rgba(148,163,184,0.11)" stroke-width="0.75" fill="none">
      <line x1="26" y1="32" x2="80" y2="96"/>
      <line x1="278" y1="18" x2="224" y2="96"/>
      <line x1="26" y1="32" x2="152" y2="28"/>
      <line x1="278" y1="18" x2="152" y2="28"/>
      <line x1="10" y1="150" x2="80" y2="96"/>
      <line x1="290" y1="120" x2="224" y2="96"/>
      <line x1="28" y1="258" x2="52" y2="228"/>
      <line x1="274" y1="274" x2="252" y2="228"/>
      <line x1="8" y1="310" x2="52" y2="228"/>
      <line x1="292" y1="340" x2="252" y2="228"/>
      <line x1="62" y1="14" x2="80" y2="96"/>
      <line x1="240" y1="12" x2="224" y2="96"/>
      <line x1="168" y1="6" x2="152" y2="28"/>
      <line x1="110" y1="350" x2="52" y2="228"/>
      <line x1="200" y1="352" x2="252" y2="228"/>
      <line x1="140" y1="345" x2="152" y2="278"/>
    </g>
  </svg>`;

  const bg = document.createElement('div');
  bg.id = 'hub-bg';
  bg.setAttribute('aria-hidden', 'true');
  bg.innerHTML = wsvg + asvg;
  document.body.insertBefore(bg, document.body.firstChild);
}());

// ─── Auth / SSO ───────────────────────────────────────────────────────────────
let _currentUser        = null;
let _currentAtResource  = null;  // { resourceId, roleId, firstName, lastName, email } or null

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
         onmouseenter="this.style.background='rgba(255,255,255,0.07)'"
         onmouseleave="this.style.background='transparent'">
      ${avatarSmall}
      <span style="font-size:11px;color:var(--text-muted);max-width:120px;
            overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(user.name)}</span>
    </div>
    <div id="user-menu" style="display:none;position:absolute;top:36px;right:8px;
         background:#131B2A;border:1px solid var(--border-2);border-radius:8px;
         padding:6px;min-width:200px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.6)">
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
           onmouseenter="this.style.background='rgba(255,255,255,0.07)'"
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
  _initGlobalScanPill();
  // Resolve AT resource for current user in background — used by time entry forms
  window.api.atGetCurrentResource().then(r => { _currentAtResource = r || null; }).catch(() => {});
}

// ─── Global background-scan status pill ───────────────────────────────────────
// Floats in the bottom-right corner whenever a scheduled scan is running,
// regardless of which tool is currently open.
function _initGlobalScanPill() {
  const pill = document.createElement('div');
  pill.id = 'global-scan-pill';
  pill.style.cssText = `
    position:fixed;bottom:20px;right:20px;z-index:9999;
    background:#1e2130;border:1px solid var(--border);border-radius:999px;
    padding:8px 16px;display:none;align-items:center;gap:10px;
    font-size:12px;color:var(--text-muted);box-shadow:0 4px 20px rgba(0,0,0,.5);
    transition:opacity .3s;
  `;
  pill.innerHTML = `
    <span style="width:8px;height:8px;border-radius:50%;background:#3b82f6;
      display:inline-block;animation:pulse-dot 1.4s ease-in-out infinite"></span>
    <span id="global-scan-pill-text">Meraki scan running…</span>
  `;
  document.body.appendChild(pill);

  // Inject keyframe if not already present
  if (!document.getElementById('pulse-dot-style')) {
    const s = document.createElement('style');
    s.id = 'pulse-dot-style';
    s.textContent = `@keyframes pulse-dot{0%,100%{opacity:1}50%{opacity:.3}}`;
    document.head.appendChild(s);
  }

  let _scanHideTimer = null;

  window.api.onMerakiExpProgress(data => {
    const textEl = document.getElementById('global-scan-pill-text');
    if (!textEl) return;

    // Don't interfere if the user is already watching the Meraki tool's own progress UI
    const onMerakiTool = !!document.getElementById('mexp-scan-progress');
    if (onMerakiTool) { pill.style.display = 'none'; return; }

    clearTimeout(_scanHideTimer);
    pill.style.display = 'flex';

    if (data.phase === 'complete' || data.phase === 'done') {
      textEl.textContent = 'Meraki scan complete';
      pill.style.borderColor = 'rgba(74,222,128,.4)';
      pill.querySelector('span').style.background = '#4ade80';
      _scanHideTimer = setTimeout(() => { pill.style.display = 'none'; pill.style.borderColor = ''; }, 5000);
    } else if (data.orgsTotal > 0) {
      textEl.textContent = `Meraki scan: ${data.orgsDone || 0} / ${data.orgsTotal} orgs`;
    } else {
      textEl.textContent = data.msg ? `Meraki scan: ${data.msg}` : 'Meraki scan running…';
    }
  });
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
  else if (view === 'tools') renderTools();
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
  else if (view === 'meraki-admin')         renderMerakiAdmin();
  else if (view === 'meraki-expiration')   renderMerakiExpiration();
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
  { key: 'meraki-admin',        label: 'Meraki Admin Management',
    icon: `<path d="M8 1.5L2 4.5v4c0 3.3 2.4 5.5 6 6 3.6-.5 6-2.7 6-6v-4L8 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.8" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 8h1M9.5 8h1M8 5.5v1M8 9.5v1" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>` },
  { key: 'duo-management',     label: 'Duo Management',
    icon: `<circle cx="8" cy="6" r="3" stroke="currentColor" stroke-width="1.4"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="13" cy="5" r="2" fill="var(--bg,#0d0f14)" stroke="currentColor" stroke-width="1.2"/><path d="M12.3 5l.7.7 1.2-1.2" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: 'contract-changes',    label: 'Autotask Contract Changes',
    icon: `<rect x="2" y="2" width="9" height="12" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 5.5h5M5 8.5h3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="12.5" cy="12.5" r="2.8" fill="var(--bg,#0d0f14)" stroke="currentColor" stroke-width="1.3"/><path d="M12.5 11.3v1.2l.9.9" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: 'contract-renewals',   label: 'Autotask Contract Renewals',
    icon: `<path d="M13 8A5 5 0 1 1 8 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M8 1l3 2-3 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 8h2v2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: 'blackpoint-processor', label: 'BlackPoint Invoice Processor',
    icon: `<path d="M8 1.5L2 4.5v4c0 3.3 2.4 5.5 6 6 3.6-.5 6-2.7 6-6v-4L8 1.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M5.5 8l1.5 1.5L10.5 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>` },
  { key: 'project-profitability', label: 'Project Profitability',
    icon: `<path d="M2 12l3-4 3 2 3-5 3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 14H2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>` },
  { key: 'meraki-expiration', label: 'Meraki License Management',
    icon: `<rect x="1" y="5" width="14" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M4 9h4M10 9h2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="12.5" cy="4.5" r="3" fill="var(--bg,#0d0f14)" stroke="currentColor" stroke-width="1.2"/><path d="M12.5 3.3v1.2l.9.9" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>` },
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
    label: 'BlackPoint Invoice Processor',
    desc:  'Process BlackPoint Account Usage Report CSVs, compare against Autotask Security+ billing, and push unit changes directly.',
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
  {
    key:   'meraki-expiration',
    label: 'Meraki License Management',
    desc:  'Track Meraki license renewals and hardware end-of-life across all client orgs. Cross-references Autotask CI records and flags date mismatches.',
    icon:  `<svg width="24" height="24" viewBox="0 0 16 16" fill="none"><rect x="1" y="5" width="14" height="8" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M4 9h4M10 9h2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><circle cx="12.5" cy="4.5" r="3" fill="var(--surface,#141720)" stroke="currentColor" stroke-width="1.2"/><path d="M12.5 3.3v1.2l.9.9" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
];

// ─── Start Page ───────────────────────────────────────────────────────────────
function renderHome() {
  const u     = _currentUser || {};
  const first = (u.name || 'there').split(' ')[0];
  const h     = new Date().getHours();
  const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const initials = (u.name || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const avatar = u.photo
    ? `<img src="${u.photo}" class="start-avatar" />`
    : `<div class="start-avatar start-avatar-init">${escHtml(initials)}</div>`;
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  content.innerHTML = `
    <div class="start-wrap">
      <div class="start-greeting-bar">
        <div class="start-greeting-left">
          ${avatar}
          <div>
            <div class="start-greeting">${escHtml(greet)}, ${escHtml(first)}</div>
            <div class="start-date">${escHtml(dateStr)}</div>
          </div>
        </div>
      </div>

      <div id="start-announce" style="display:none"></div>

      <div class="start-section">
        <div class="start-section-header">
          <span class="start-section-title">Quick links</span>
          <button class="start-add-btn" id="start-add-link-btn">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            Add link
          </button>
        </div>
        <div id="start-links-row" class="start-links">
          <div class="start-link-loading">Loading…</div>
        </div>
        <div id="start-add-link-form" class="start-add-form" style="display:none">
          <input id="sal-title" class="start-input" placeholder="Label" style="width:120px" />
          <input id="sal-url"   class="start-input" placeholder="https://…" style="flex:1;min-width:180px" />
          <input id="sal-icon"  class="start-input" placeholder="🔗" style="width:52px;text-align:center" />
          <button class="btn btn-sm btn-primary" id="sal-save">Add</button>
          <button class="btn btn-sm btn-ghost" id="sal-cancel">Cancel</button>
        </div>
      </div>

      <div class="start-widgets">
        <div class="start-widget">
          <div class="start-widget-title">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M1 5h12M4 1v2M10 1v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            Today's calendar
          </div>
          <div id="start-cal-body"><div class="start-widget-loading">Loading…</div></div>
        </div>
        <div class="start-widget">
          <div class="start-widget-title">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M2 2h10a1 1 0 011 1v8a1 1 0 01-1 1H2a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" stroke-width="1.3"/><path d="M4 5h6M4 7.5h4M4 10h2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            Autotask tickets
          </div>
          <div id="start-tickets-body"><div class="start-widget-loading">Loading…</div></div>
        </div>
      </div>

      <div class="start-footer">
        <span id="start-version" class="start-version-text"></span>
        <button class="btn btn-ghost btn-xs start-update-btn" id="start-check-updates">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
            <path d="M13 7A6 6 0 1 1 7 1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <path d="M9 1h4v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Check for updates
        </button>
      </div>
    </div>`;

  // Load all data in parallel
  _loadAnnouncements();
  _loadQuickLinks();
  _loadCalendar();
  _loadTickets();

  // Version + update check
  if (window.api.getAppVersion) {
    window.api.getAppVersion().then(v => {
      const el = document.getElementById('start-version');
      if (el && v) el.textContent = `Anchor Hub v${v}`;
    });
  }
  const updateBtn = document.getElementById('start-check-updates');
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
      } catch {
        updateBtn.textContent = 'Check failed';
      }
      setTimeout(() => {
        if (updateBtn) { updateBtn.disabled = false; updateBtn.innerHTML = origHtml; }
      }, 4000);
    });
  }

  // Add link form toggle
  document.getElementById('start-add-link-btn').addEventListener('click', () => {
    document.getElementById('start-add-link-form').style.display = 'flex';
    document.getElementById('start-add-link-btn').style.display  = 'none';
    document.getElementById('sal-title').focus();
  });
  document.getElementById('sal-cancel').addEventListener('click', _hideAddForm);
  document.getElementById('sal-save').addEventListener('click', _savePersonalLink);
  document.getElementById('sal-url').addEventListener('keydown', e => { if (e.key === 'Enter') _savePersonalLink(); });
}

function _hideAddForm() {
  const form = document.getElementById('start-add-link-form');
  const btn  = document.getElementById('start-add-link-btn');
  if (form) form.style.display = 'none';
  if (btn)  btn.style.display  = '';
  ['sal-title','sal-url','sal-icon'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

function _savePersonalLink() {
  const title = (document.getElementById('sal-title')?.value || '').trim();
  const url   = (document.getElementById('sal-url')?.value   || '').trim();
  const icon  = (document.getElementById('sal-icon')?.value  || '').trim() || '🔗';
  if (!title || !url) return;
  try {
    const links = JSON.parse(localStorage.getItem('hub_personal_links') || '[]');
    links.push({ title, url, icon, personal: true });
    localStorage.setItem('hub_personal_links', JSON.stringify(links));
  } catch {}
  _hideAddForm();
  _loadQuickLinks();
}

function _removePersonalLink(idx) {
  try {
    const links = JSON.parse(localStorage.getItem('hub_personal_links') || '[]');
    links.splice(idx, 1);
    localStorage.setItem('hub_personal_links', JSON.stringify(links));
  } catch {}
  _loadQuickLinks();
}

async function _loadAnnouncements() {
  try {
    const items = await window.api.homeGetAnnouncements();
    const el = document.getElementById('start-announce');
    if (!el || !items.length) return;
    const item = items[0];
    const key  = `announce_dismissed_${item.title}`;
    if (sessionStorage.getItem(key)) return;
    el.innerHTML = `
      <div class="start-announce">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 10.5L7 1l6 9.5H1z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M7 5.5v2M7 9.5v.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
        <div class="start-announce-body">
          <div class="start-announce-title">${escHtml(item.title)}</div>
          ${item.message ? `<div class="start-announce-msg">${escHtml(item.message)}</div>` : ''}
        </div>
        <button class="start-announce-close" aria-label="Dismiss">
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M1 1l9 9M10 1l-9 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        </button>
      </div>`;
    el.style.display = '';
    el.querySelector('.start-announce-close').addEventListener('click', () => {
      sessionStorage.setItem(key, '1');
      el.style.display = 'none';
    });
  } catch {}
}

async function _loadQuickLinks() {
  const row = document.getElementById('start-links-row');
  if (!row) return;
  try {
    const [adminLinks, personalLinks] = await Promise.all([
      window.api.homeGetQuickLinks().catch(() => []),
      Promise.resolve(JSON.parse(localStorage.getItem('hub_personal_links') || '[]')),
    ]);
    const all = [...adminLinks, ...personalLinks.map((l, i) => ({ ...l, _personalIdx: i }))];
    if (!all.length) {
      row.innerHTML = `<div class="start-links-empty">No quick links yet — add one with the button above.</div>`;
      return;
    }
    row.innerHTML = all.map(l => `
      <div class="start-link-tile" data-url="${escHtml(l.url)}" tabindex="0" role="button" aria-label="Open ${escHtml(l.title)}">
        <div class="start-link-icon">${escHtml(l.icon || '🔗')}</div>
        <div class="start-link-label">${escHtml(l.title)}</div>
        ${l._personalIdx !== undefined
          ? `<button class="start-link-remove" data-pidx="${l._personalIdx}" aria-label="Remove ${escHtml(l.title)}">×</button>`
          : ''}
      </div>`).join('');
    row.querySelectorAll('.start-link-tile').forEach(tile => {
      const go = () => window.api.homeOpenUrl(tile.dataset.url);
      tile.addEventListener('click', e => { if (!e.target.closest('.start-link-remove')) go(); });
      tile.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') go(); });
    });
    row.querySelectorAll('.start-link-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        _removePersonalLink(parseInt(btn.dataset.pidx));
      });
    });
  } catch (e) {
    if (row) row.innerHTML = `<div class="start-links-empty">Could not load links.</div>`;
  }
}

async function _loadCalendar() {
  const el = document.getElementById('start-cal-body');
  if (!el) return;
  try {
    const result = await window.api.homeGetCalendar();
    if (!Array.isArray(result)) {
      el.innerHTML = result?.error === 'no_token'
        ? `<div class="start-widget-empty">Sign out and back in to connect your calendar.</div>`
        : `<div class="start-widget-empty">Calendar unavailable.</div>`;
      return;
    }
    if (!result.length) {
      el.innerHTML = `<div class="start-widget-empty">No meetings today.</div>`;
      return;
    }
    const fmtTime = dt => {
      if (!dt) return '';
      // Graph returns tz-naive UTC strings — append Z so Date() parses as UTC,
      // then display in the user's local system timezone (set correctly in Windows).
      const d = new Date(dt.includes('Z') || dt.includes('+') ? dt : dt + 'Z');
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        .replace(/\s(AM|PM)$/i, m => m.trim().toLowerCase());
    };
    el.innerHTML = result.slice(0, 6).map(e => `
      <div class="start-cal-event">
        <div class="start-cal-time">${e.isAllDay ? 'all day' : fmtTime(e.startDt)}</div>
        <div class="start-cal-dot"></div>
        <div class="start-cal-info">
          <div class="start-cal-subject">${escHtml(e.subject)}</div>
          ${e.location ? `<div class="start-cal-loc">${escHtml(e.location)}</div>` : ''}
        </div>
      </div>`).join('');
  } catch {
    if (el) el.innerHTML = `<div class="start-widget-empty">Calendar unavailable.</div>`;
  }
}

async function _loadTickets() {
  const el = document.getElementById('start-tickets-body');
  if (!el) return;
  try {
    const result = await window.api.homeGetAtTickets(_currentUser?.email || '');
    if (result?.error) {
      el.innerHTML = (result.error.includes('credentials') || result.error.includes('not configured'))
        ? `<div class="start-widget-empty">Configure Autotask in <a href="#" class="start-link-inline" onclick="navigate('settings');return false">Settings</a>.</div>`
        : `<div class="start-widget-empty">Autotask unavailable.<br><span style="font-size:11px;opacity:0.6">${escHtml(result.error)}</span></div>`;
      return;
    }
    const priColor = p => p <= 1 ? 'var(--error)' : p === 2 ? 'var(--warn)' : 'var(--success)';
    const priLabel = p => p <= 1 ? 'Critical' : p === 2 ? 'High' : p === 3 ? 'Medium' : 'Low';
    const atUrl = 'https://ww5.autotask.net/';

    const buckets = [
      { label: 'Critical & High', count: result.critHighCount  ?? 0, hot: (result.critHighCount  ?? 0) > 0 },
      { label: 'Due Today',       count: result.dueTodayCount  ?? 0, hot: (result.dueTodayCount  ?? 0) > 0 },
      { label: 'Overdue',         count: result.overdueCount   ?? 0, hot: (result.overdueCount   ?? 0) > 0 },
      { label: 'Total Assigned',  count: result.assignedCount  ?? 0, hot: false },
    ];

    el.innerHTML = `
      <div class="start-ticket-buckets">
        ${buckets.map(b => `
          <div class="start-ticket-bucket">
            <span class="start-bucket-label">${escHtml(b.label)}</span>
            <span class="start-bucket-count${b.hot ? ' start-bucket-hot' : ''}">${b.count}</span>
          </div>`).join('')}
      </div>
      ${result.tickets.length ? `
        <div class="start-ticket-list">
          ${result.tickets.map(t => `
            <div class="start-ticket-row">
              <span class="start-pri-dot" style="background:${priColor(t.priority)}" title="${priLabel(t.priority)}"></span>
              <div class="start-ticket-meta">
                <span class="start-ticket-name" title="${escHtml(t.title)}">${escHtml(t.title)}</span>
                ${t.companyName ? `<span class="start-ticket-company">${escHtml(t.companyName)}</span>` : ''}
              </div>
            </div>`).join('')}
        </div>` : ''}
      <div class="start-open-at">
        <a href="#" class="start-link-inline" id="start-open-at-link">Open Autotask
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2 10L10 2M10 2H5M10 2v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
      </div>`;
    const atLink = document.getElementById('start-open-at-link');
    if (atLink) atLink.addEventListener('click', e => { e.preventDefault(); window.api.homeOpenUrl(atUrl); });
  } catch {
    if (el) el.innerHTML = `<div class="start-widget-empty">Autotask unavailable.</div>`;
  }
}

// ─── Tools (formerly Home) ────────────────────────────────────────────────────
async function renderTools() {
  content.innerHTML = `<div style="padding:32px;color:var(--text-muted);font-size:13px">Loading…</div>`;

  const vis = await window.api.getToolVisibility();

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
    <div class="ai-summary"><div class="ai-summary-label">AI Summary</div><p class="ai-summary-text">${results.aiSummary ? escHtml(results.aiSummary) : '<em style="opacity:0.5">AI analysis did not return a result for this run.</em>'}</p></div>
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

// ─── Company Directory ────────────────────────────────────────────────────────
let _cdCurrentData  = null;
let _cdHubData      = null;
let _cdActiveTab    = 'companies';
let _cdSearchTimer  = null;
let _cdSvcEditId    = null;
let _cdSvcEditDraft = null; // { vendorName, atServices:[{id,name}], contracts:string } during edit
let _cdShowExcluded = false;
let _cdEditCell     = null; // { atId, platform, platformName } for inline reassign/add

function renderCompanyMapping() {
  const isAdmin = _currentUser?.isAdmin || _currentUser?.roles?.includes('hub.admin');

  content.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Company Directory</h1>
        <p class="view-desc">Cross-platform company and service mappings. Shared via SharePoint — changes apply to all users instantly.</p>
      </div>
      <img class="view-header-deco" src="Anchor_Logo_Vertical_High.png" alt="" draggable="false" />
    </div>

    <div class="cd-status-bar">
      <span class="cd-sync-info" id="cd-sync-info">Loading…</span>
      <span class="save-status" id="cd-action-status"></span>
    </div>

    <div class="stab-nav" style="max-width:1000px;margin-bottom:0">
      <button class="stab ${_cdActiveTab==='companies'?'active':''}" data-cdtab="companies">Companies</button>
      <button class="stab ${_cdActiveTab==='svcmap'?'active':''}" data-cdtab="svcmap">Service Mappings</button>
      <button class="stab ${_cdActiveTab==='services'?'active':''}" data-cdtab="services">
        Pax8 Sync <span class="cd-tab-badge" id="cd-svc-badge"></span>
      </button>
      <button class="stab ${_cdActiveTab==='meraki'?'active':''}" data-cdtab="meraki">Meraki Orgs</button>
    </div>

    <!-- ── Tab 1: Companies (AT-centric hub view) ──────────────────── -->
    <div class="cd-panel ${_cdActiveTab==='companies'?'':'hidden'}" id="cd-panel-companies">
      <div class="settings-section" style="max-width:1000px;padding:0;margin-top:16px">
        <div class="cd-table-header">
          <div style="display:flex;align-items:center;gap:10px">
            <span class="section-title" style="font-size:11px">All Clients</span>
            ${isAdmin ? `<button class="btn btn-ghost btn-sm" id="btn-update-classifications" style="font-size:11px;padding:2px 8px">↻ Update Classifications</button>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-muted);cursor:pointer">
              <input type="checkbox" id="cd-show-excluded" ${_cdShowExcluded ? 'checked' : ''}> Show excluded
            </label>
            <input type="text" class="cd-search" id="cd-hub-search" placeholder="Search by AT name or platform name…">
          </div>
        </div>
        <div class="cd-table-scroll">
          <table class="cd-table">
            <thead><tr>
              <th style="min-width:180px">Autotask Company</th>
              <th>Kaseya</th>
              <th>Blackpoint</th>
              <th>Pax8</th>
              <th>Meraki</th>
              <th style="width:90px;text-align:center">Status</th>
            </tr></thead>
            <tbody id="cd-hub-tbody"><tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">Loading…</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── Tab 2: Service Mappings ─────────────────────────────────── -->
    <div class="cd-panel ${_cdActiveTab==='svcmap'?'':'hidden'}" id="cd-panel-svcmap">
      <div style="max-width:1000px;margin-top:16px;display:flex;flex-direction:column;gap:16px">
        <div class="settings-section" style="padding:0">
          <div class="cd-svcmap-hdr">
            <span class="cd-svcmap-tool-label" style="color:#3b82f6">Pax8</span>
            <span class="cd-svcmap-tool-desc">Vendor key → AT service line + contract type</span>
          </div>
          <div id="cd-svcmap-pax8"></div>
        </div>
        <div class="settings-section" style="padding:0">
          <div class="cd-svcmap-hdr">
            <span class="cd-svcmap-tool-label" style="color:#10b981">Kaseya</span>
            <span class="cd-svcmap-tool-desc">Product name → AT service line + contract type</span>
          </div>
          <div id="cd-svcmap-kaseya"></div>
        </div>
        <div class="settings-section" style="padding:0">
          <div class="cd-svcmap-hdr">
            <span class="cd-svcmap-tool-label" style="color:#ef4444">Blackpoint</span>
            <span class="cd-svcmap-tool-desc">Product → AT service line + contract type</span>
          </div>
          <div id="cd-svcmap-blackpoint"></div>
        </div>
      </div>
    </div>

    <!-- ── Tab 3: Pax8 Sync (existing review + confirmed tables) ───── -->
    <div class="cd-panel ${_cdActiveTab==='services'?'':'hidden'}" id="cd-panel-services">
      ${isAdmin ? `
      <div class="cd-admin-bar" style="margin-top:16px">
        <button class="btn btn-primary btn-sm" id="btn-run-mapping">
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 1 0 1.2-3.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M2 3v4h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Sync Pax8
        </button>
        <button class="btn btn-ghost btn-sm" id="btn-export-mapping-csv">↓ Unmapped CSV</button>
        <button class="btn btn-ghost btn-sm" id="btn-export-full-mapping-csv">↓ Full Export</button>
        <button class="btn btn-ghost btn-sm" id="btn-import-co-csv">↑ Import Companies</button>
        <button class="btn btn-ghost btn-sm" id="btn-import-svc-csv">↑ Import Services</button>
      </div>
      <div class="log-container" style="max-width:1000px;margin-top:12px;display:none" id="cd-log-wrap">
        <div class="log-output" id="mapping-log-output"></div>
      </div>` : ''}
      <div class="report-stats" style="max-width:1000px;margin-top:16px" id="cd-co-stats"></div>
      <div id="cd-co-review"></div>
      <div class="settings-section" style="max-width:1000px;padding:0" id="cd-co-table-wrap">
        <div class="cd-table-header">
          <span class="section-title" style="font-size:11px">Confirmed Company Mappings</span>
          <input type="text" class="cd-search" id="cd-co-search" placeholder="Search companies…">
        </div>
        <div class="cd-table-scroll">
          <table class="cd-table">
            <thead><tr>
              <th>Pax8 Company</th>
              <th>Autotask Company</th>
              <th>Match Type</th>
              ${isAdmin ? '<th></th>' : ''}
            </tr></thead>
            <tbody id="cd-co-tbody"></tbody>
          </table>
        </div>
      </div>
      <div class="report-stats" style="max-width:1000px;margin-top:20px" id="cd-svc-stats"></div>
      <div id="cd-svc-review"></div>
      <div class="settings-section" style="max-width:1000px;padding:0" id="cd-svc-table-wrap">
        <div class="cd-table-header">
          <span class="section-title" style="font-size:11px">Confirmed Service Mappings</span>
          <input type="text" class="cd-search" id="cd-svc-search" placeholder="Search services…">
        </div>
        <div class="cd-table-scroll">
          <table class="cd-table">
            <thead><tr>
              <th>Pax8 Product</th>
              <th>Term</th>
              <th>Autotask Service</th>
              <th>Match Type</th>
            </tr></thead>
            <tbody id="cd-svc-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ── Tab 4: Meraki Org Mapping ─────────────────────────────────── -->
    <div class="cd-panel ${_cdActiveTab==='meraki'?'':'hidden'}" id="cd-panel-meraki">
      <div style="max-width:900px;margin-top:16px" id="mk-org-map-wrap">
        <div id="mk-org-map-content"><div style="color:var(--text-muted);font-size:12px;padding:16px">Click the tab to load Meraki orgs…</div></div>
      </div>
    </div>
  `;

  // Tab switching
  content.querySelectorAll('[data-cdtab]').forEach(btn => {
    btn.addEventListener('click', () => {
      _cdActiveTab = btn.dataset.cdtab;
      _cdSvcEditId = null;
      content.querySelectorAll('[data-cdtab]').forEach(b => b.classList.toggle('active', b === btn));
      content.querySelectorAll('.cd-panel').forEach(p => p.classList.toggle('hidden', p.id !== `cd-panel-${_cdActiveTab}`));
      if (_cdActiveTab === 'meraki') renderMerakiOrgMapping();
    });
  });

  if (_cdActiveTab === 'meraki') renderMerakiOrgMapping();

  // Admin buttons (now inside Pax8 Sync tab — wired after tab switch renders them)
  // We use event delegation on content for clicks, but these buttons exist on initial render:
  if (isAdmin) {
    const wireAdminBtns = () => {
      document.getElementById('btn-run-mapping')?.addEventListener('click', cdRunSync);
      document.getElementById('btn-export-mapping-csv')?.addEventListener('click', exportMappingCsv);
      document.getElementById('btn-export-full-mapping-csv')?.addEventListener('click', exportFullMappingCsv);
      document.getElementById('btn-import-co-csv')?.addEventListener('click', () => importMappingCsv('companies'));
      document.getElementById('btn-import-svc-csv')?.addEventListener('click', () => importMappingCsv('services'));
    };
    wireAdminBtns();
    // Re-wire after tab switches (tab switching via classList toggle keeps DOM in place, so only needed once)
  }

  // Update AT Classifications button
  document.getElementById('btn-update-classifications')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-update-classifications');
    btn.disabled = true; btn.textContent = '↻ Updating…';
    try {
      const r = await window.api.cmUpdateAtClassifications();
      if (r.ok) {
        const hub = await window.api.cmGetHubData();
        _cdHubData = hub; cdRenderCompaniesHub();
        btn.textContent = `↻ Updated ${r.updated} entries`;
        setTimeout(() => { if (btn) { btn.disabled = false; btn.textContent = '↻ Update Classifications'; } }, 3000);
      } else {
        btn.textContent = `Error: ${r.error?.slice(0,40)}`;
        setTimeout(() => { if (btn) { btn.disabled = false; btn.textContent = '↻ Update Classifications'; } }, 4000);
      }
    } catch(e) { btn.disabled = false; btn.textContent = '↻ Update Classifications'; }
  });

  // Show/hide excluded toggle
  const showExclCb = document.getElementById('cd-show-excluded');
  if (showExclCb) showExclCb.addEventListener('change', () => {
    _cdShowExcluded = showExclCb.checked;
    cdRenderCompaniesHub();
  });

  // Live search — companies hub tab
  const hubSearch = document.getElementById('cd-hub-search');
  if (hubSearch) hubSearch.addEventListener('input', () => {
    clearTimeout(_cdSearchTimer);
    _cdSearchTimer = setTimeout(cdRenderCompaniesHub, 180);
  });

  // Live search — Pax8 sync tab tables
  ['co', 'svc'].forEach(tab => {
    const input = document.getElementById(`cd-${tab}-search`);
    if (input) input.addEventListener('input', () => {
      clearTimeout(_cdSearchTimer);
      _cdSearchTimer = setTimeout(() => cdRenderTable(tab), 180);
    });
  });

  cdLoadData();
}

async function cdLoadData() {
  try {
    const [data, hubData] = await Promise.all([
      window.api.getMappings(),
      window.api.cmGetHubData(),
    ]);
    _cdCurrentData = data;
    _cdHubData     = hubData;
    cdRenderAll();
  } catch (e) {
    const el = document.getElementById('cd-sync-info');
    if (el) el.textContent = `Error loading mappings: ${e.message}`;
  }
}

function cdRenderAll() {
  // Status bar
  const infoEl = document.getElementById('cd-sync-info');
  if (infoEl) {
    const src = _cdHubData
      ? (_cdHubData._storageSource === 'sharepoint'
          ? '<span class="cd-sp-badge">SharePoint ✓</span>'
          : '<span class="cd-sp-badge cd-sp-local">Local cache</span>')
      : '<span class="cd-sp-badge cd-sp-local">Unavailable</span>';
    const synced = _cdCurrentData?.lastSync
      ? `Pax8 sync: ${new Date(_cdCurrentData.lastSync).toLocaleString()}`
      : 'Not yet synced';
    infoEl.innerHTML = `${synced} ${src}`;
  }

  // Pax8 Sync tab badge (combined pending review)
  if (_cdCurrentData) {
    const companies = _cdCurrentData.companies || [];
    const services  = _cdCurrentData.services  || [];
    const pending   = companies.filter(c => !c.accepted && !c.excluded).length
                    + services.filter(s => !s.accepted && !s.excluded).length;
    const svcBadge = document.getElementById('cd-svc-badge');
    if (svcBadge) svcBadge.textContent = pending > 0 ? pending : '';
  }

  cdRenderCompaniesHub();
  cdRenderSvcMap();
  cdRenderPax8Sync();
}

// ── AT-centric Companies tab ──────────────────────────────────────────────────

function cdChipsHtml(platform, items, atId, color) {
  // items: array of { name, excluded?, ... }
  const visible = items.filter(k => k?.name && !k.excluded);
  if (!visible.length) {
    const canAdd = platform !== 'pax8'; // Pax8 adds come from sync, not manually
    const editKey = `${atId}::${platform}::__add__`;
    const isAdding = _cdEditCell?.key === editKey;
    if (isAdding) {
      return `<span class="cd-platform-edit-wrap" data-editkey="${editKey}">
        <input class="cd-platform-add-input" type="text" placeholder="Enter ${platform} name…" value="${escHtml(_cdEditCell.value || '')}" style="width:160px;font-size:12px;padding:2px 6px;background:var(--bg-input,var(--bg2));border:1px solid var(--accent);border-radius:4px;color:var(--text)">
        <button class="cd-platform-add-save" data-atid="${atId}" data-platform="${platform}" style="margin-left:4px;font-size:11px">Save</button>
        <button class="cd-platform-add-cancel" style="margin-left:2px;font-size:11px">✕</button>
      </span>`;
    }
    return `<span style="color:var(--text-muted);font-size:11px">—${canAdd ? `<button class="cd-platform-add-btn" data-atid="${atId}" data-platform="${platform}" title="Add ${platform} mapping" style="margin-left:4px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:11px;padding:0 2px;opacity:0.6">+</button>` : ''}</span>`;
  }
  return visible.map(k => {
    const editKey = `${atId}::${platform}::${k.name}`;
    const isReassigning = _cdEditCell?.key === editKey;
    if (isReassigning) {
      return `<span class="cd-platform-edit-wrap" data-editkey="${editKey}">
        <input class="cd-platform-reassign-input" type="text" placeholder="Search AT company…" value="${escHtml(_cdEditCell.value || '')}" data-atid="${atId}" data-platform="${platform}" data-pname="${escHtml(k.name)}" style="width:180px;font-size:12px;padding:2px 6px;background:var(--bg-input,var(--bg2));border:1px solid var(--accent);border-radius:4px;color:var(--text)">
        <div class="cd-platform-reassign-results" id="reassign-results-${editKey.replace(/[^a-z0-9]/gi,'_')}"></div>
        <button class="cd-platform-add-cancel" style="margin-left:2px;font-size:11px">✕</button>
      </span>`;
    }
    return `<span class="cd-hub-chip cd-hub-chip-${platform === 'kaseya' ? 'ks' : platform === 'blackpoint' ? 'bp' : 'p8'} cd-chip-clickable" title="${escHtml(k.name)} — click to reassign" data-atid="${atId}" data-platform="${platform}" data-pname="${escHtml(k.name)}">${escHtml(k.name)}<button class="cd-chip-remove" data-atid="${atId}" data-platform="${platform}" data-pname="${escHtml(k.name)}" title="Remove mapping">×</button></span>`;
  }).join('');
}

function cdRenderCompaniesHub() {
  const tbody = document.getElementById('cd-hub-tbody');
  if (!tbody) return;

  if (!_cdHubData) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text-muted);font-size:12px">Hub directory unavailable — check SharePoint connection.</td></tr>`;
    return;
  }

  const query = (document.getElementById('cd-hub-search')?.value || '').toLowerCase();
  // Filter out entries with no AT identity (unmatched Pax8-only, atId === null)
  const all = (_cdHubData.companies || []).filter(c => c.atId != null);
  // Hide excluded unless toggled
  const withExcl = _cdShowExcluded ? all : all.filter(c => !c.excluded);
  const companies = query ? withExcl.filter(c => {
    if ((c.atName || '').toLowerCase().includes(query)) return true;
    const ks = c.platforms?.kaseya;
    const ksNames = Array.isArray(ks) ? ks.map(k => k.name || '') : (ks?.name ? [ks.name] : []);
    if (ksNames.some(n => n.toLowerCase().includes(query))) return true;
    if ((c.platforms?.blackpoint?.name || '').toLowerCase().includes(query)) return true;
    const p8 = c.platforms?.pax8;
    const p8Names = Array.isArray(p8) ? p8.map(p => p.name || '') : (p8?.name ? [p8.name] : []);
    if (p8Names.some(n => n.toLowerCase().includes(query))) return true;
    const mk = c.platforms?.meraki;
    const mkNames = Array.isArray(mk) ? mk.map(m => m.name || '') : (mk?.name ? [mk.name] : []);
    if (mkNames.some(n => n.toLowerCase().includes(query))) return true;
    return false;
  }) : withExcl;

  if (!companies.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);font-size:12px">${query ? `No results for "${escHtml(query)}"` : 'No companies in hub directory.'}</td></tr>`;
    return;
  }

  tbody.innerHTML = companies.map(c => {
    const ks = c.platforms?.kaseya;
    const ksItems = Array.isArray(ks) ? ks : (ks ? [ks] : []);
    const ksHtml = cdChipsHtml('kaseya', ksItems, c.atId, '#10b981');

    const bp = c.platforms?.blackpoint;
    const bpItems = bp ? [bp] : [];
    const bpHtml = cdChipsHtml('blackpoint', bpItems, c.atId, '#ef4444');

    const p8 = c.platforms?.pax8;
    const p8Items = Array.isArray(p8) ? p8 : (p8 ? [p8] : []);
    const p8Html = cdChipsHtml('pax8', p8Items, c.atId, '#3b82f6');

    const mk = c.platforms?.meraki;
    const mkItems = Array.isArray(mk) ? mk : (mk ? [mk] : []);
    const mkHtml = cdChipsHtml('meraki', mkItems, c.atId, '#10b981');

    const classLabel = c.atClassification
      ? `<span class="cd-classification-chip">${escHtml(c.atClassification)}</span>`
      : '';

    return `<tr style="${c.excluded ? 'opacity:0.45' : ''}">
      <td><span style="font-weight:500">${escHtml(c.atName || String(c.atId))}</span>${classLabel}</td>
      <td>${ksHtml}</td>
      <td>${bpHtml}</td>
      <td>${p8Html}</td>
      <td>${mkHtml}</td>
      <td style="text-align:center">
        <button class="cd-excl-toggle ${c.excluded ? 'cd-excl-on' : ''}" data-atid="${c.atId}" data-excl="${c.excluded ? '1' : '0'}" title="${c.excluded ? 'Excluded — click to re-include' : 'Active — click to exclude'}">
          ${c.excluded ? 'Excluded' : 'Active'}
        </button>
      </td>
    </tr>`;
  }).join('');

  // Wire up reassign search inputs that are currently in edit mode
  tbody.querySelectorAll('.cd-platform-reassign-input').forEach(input => cdPlatformStartReassign(input));
}

// ── Service Mappings tab ──────────────────────────────────────────────────────

function cdRenderSvcMap() {
  if (!_cdHubData?.serviceMappings) return;
  const { serviceMappings } = _cdHubData;

  ['pax8', 'kaseya', 'blackpoint'].forEach(tool => {
    const el = document.getElementById(`cd-svcmap-${tool}`);
    if (!el) return;
    cdRenderSvcMapGroup(el, tool, serviceMappings[tool] || []);
  });
}

function cdRenderSvcMapGroup(el, tool, entries) {
  const isPax8 = tool === 'pax8';
  el.innerHTML = `
    <table class="cd-table" style="margin:0">
      <thead><tr>
        <th>${isPax8 ? 'Vendor Key / Label' : 'Vendor Product'}</th>
        <th>AT Service</th>
        <th>Contracts</th>
        <th style="width:80px"></th>
      </tr></thead>
      <tbody>
        ${entries.map(m => cdSvcMapRowHtml(tool, m)).join('')}
        ${!entries.length ? `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px;font-size:12px">No mappings configured.</td></tr>` : ''}
      </tbody>
    </table>`;

  // Wire up search input if a row is in edit mode
  const editInput = el.querySelector('.cd-svc-search-input');
  if (editInput) cdSvcStartSearch(editInput);
}

function cdSvcAtServices(m) {
  if (Array.isArray(m.atServices) && m.atServices.length) return m.atServices;
  if (m.atServiceId) return [{ id: m.atServiceId, name: m.atServiceName || '' }];
  return [];
}

function cdSvcMapRowHtml(tool, m) {
  const isEditing = _cdSvcEditId === `${tool}::${m.id}`;
  const isPax8 = tool === 'pax8';
  const services = isEditing ? (_cdSvcEditDraft?.atServices ?? cdSvcAtServices(m)) : cdSvcAtServices(m);

  if (isEditing) {
    const draft = _cdSvcEditDraft;
    const vendorVal = escHtml(draft?.vendorName ?? (isPax8 ? (m.vendorLabel || m.vendorKey || '') : (m.vendorName || '')));
    const contractsVal = escHtml(draft?.contracts ?? (m.contracts || []).join(', '));
    const svcRows = services.map((s, idx) =>
      `<div class="cd-svc-service-row">
        <span class="cd-svc-service-chip">${escHtml(s.name || `ID: ${s.id}`)}<span style="color:var(--text-muted);font-size:10px;margin-left:4px">${s.name ? `(${s.id})` : ''}</span></span>
        <button class="cd-svc-remove-svc btn btn-ghost btn-sm" data-tool="${tool}" data-mid="${escHtml(m.id)}" data-svcidx="${idx}" style="font-size:10px;padding:1px 5px">×</button>
      </div>`
    ).join('');

    return `<tr class="cd-svc-edit-row">
      <td style="vertical-align:top;padding-top:10px">
        ${isPax8
          ? `<span style="font-size:11px;color:var(--text-muted)">Key: ${escHtml(m.vendorKey || '')}</span><br>`
          : ''}
        <input type="text" class="cd-svc-vendor-input" data-tool="${tool}" data-mid="${escHtml(m.id)}" value="${vendorVal}" placeholder="${isPax8 ? 'Vendor label' : 'Vendor product name'}" style="width:160px;font-size:12px;padding:3px 6px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text)">
      </td>
      <td style="vertical-align:top;padding-top:10px">
        ${svcRows}
        <div class="cd-svc-edit-wrap" style="margin-top:4px">
          <input type="text" class="cd-find-input cd-svc-search-input" placeholder="+ Search to add service…" data-tool="${escHtml(tool)}" data-mid="${escHtml(m.id)}" style="width:200px;font-size:12px">
          <div class="cd-find-results" id="cd-svc-results-${escHtml(tool)}-${escHtml(m.id)}"></div>
        </div>
      </td>
      <td style="vertical-align:top;padding-top:10px">
        <input type="text" class="cd-svc-contracts-input" data-tool="${tool}" data-mid="${escHtml(m.id)}" value="${contractsVal}" placeholder="Contract names (comma-separated)" style="width:160px;font-size:11px;padding:3px 6px;background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text)">
      </td>
      <td style="vertical-align:top;padding-top:10px;white-space:nowrap">
        <button class="btn btn-primary btn-sm cd-svc-save-btn" data-tool="${tool}" data-mid="${escHtml(m.id)}" style="font-size:10px">Save</button>
        <button class="btn btn-ghost btn-sm cd-svc-cancel-btn" data-tool="${escHtml(tool)}" data-mid="${escHtml(m.id)}" style="font-size:10px;margin-left:4px">Cancel</button>
      </td>
    </tr>`;
  }

  const atDisplay = services.length
    ? services.map(s => escHtml(s.name || `ID: ${s.id}`)).join('<br>')
    : '<span style="color:var(--warn);font-size:11px">Not set</span>';
  const vendorDisplay = isPax8
    ? `<span style="font-weight:500">${escHtml(m.vendorLabel || m.vendorKey || '')}</span><span style="color:var(--text-muted);font-size:11px;margin-left:6px">${escHtml(m.vendorKey || '')}</span>`
    : escHtml(m.vendorName || '');

  return `<tr>
    <td>${vendorDisplay}</td>
    <td style="font-size:12px">${atDisplay}</td>
    <td style="color:var(--text-muted);font-size:11px">${escHtml((m.contracts || []).join(', '))}</td>
    <td><button class="btn btn-ghost btn-sm cd-svc-edit-btn" data-tool="${escHtml(tool)}" data-mid="${escHtml(m.id)}" style="font-size:10px">Edit</button></td>
  </tr>`;
}

function cdSvcStartSearch(input) {
  const tool = input.dataset.tool;
  const mid  = input.dataset.mid;
  const resultsEl = document.getElementById(`cd-svc-results-${tool}-${mid}`);
  if (!resultsEl) return;

  let timer;
  async function doSearch() {
    const q = input.value.trim();
    if (!q) { resultsEl.innerHTML = ''; return; }
    resultsEl.innerHTML = `<div class="cd-match-item" style="pointer-events:none;color:var(--text-muted)">Searching…</div>`;
    const results = await window.api.cmSearchAtServices(q).catch(() => []);
    if (!results.length) {
      resultsEl.innerHTML = `<div class="cd-match-item" style="pointer-events:none;color:var(--text-muted)">No matches</div>`;
      return;
    }
    resultsEl.innerHTML = results.map(r =>
      `<div class="cd-match-item cd-svc-result-item" data-tool="${escHtml(tool)}" data-mid="${escHtml(mid)}" data-svcid="${r.id}" data-svcname="${escHtml(r.name)}">
        ${escHtml(r.name)} <span style="color:var(--text-muted);font-size:10px">ID: ${r.id}</span>
      </div>`
    ).join('');
  }

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(doSearch, 300); });
  input.focus();
  doSearch();
}

// ── Pax8 Sync tab (existing review + confirmed tables) ────────────────────────

function cdRenderPax8Sync() {
  if (!_cdCurrentData) return;
  const isAdmin = _currentUser?.isAdmin || _currentUser?.roles?.includes('hub.admin');
  const companies = _cdCurrentData.companies || [];
  const services  = _cdCurrentData.services  || [];

  const coMapped   = companies.filter(c => c.accepted && c.atId).length;
  const coReview   = companies.filter(c => !c.accepted && !c.excluded).length;
  const coExcluded = companies.filter(c => c.excluded).length;
  const svcMapped  = services.filter(s => s.accepted && s.atServiceId).length;
  const svcReview  = services.filter(s => !s.accepted && !s.excluded).length;

  const coStatsEl = document.getElementById('cd-co-stats');
  if (coStatsEl) coStatsEl.innerHTML = `
    <div class="report-stat clean"><span class="report-stat-num">${coMapped}</span><span class="report-stat-label">Mapped</span></div>
    <div class="report-stat ${coReview > 0 ? 'warn' : 'clean'}"><span class="report-stat-num">${coReview}</span><span class="report-stat-label">Needs Review</span></div>
    <div class="report-stat"><span class="report-stat-num">${coExcluded}</span><span class="report-stat-label">Excluded</span></div>`;

  const svcStatsEl = document.getElementById('cd-svc-stats');
  if (svcStatsEl) svcStatsEl.innerHTML = `
    <div class="report-stat clean"><span class="report-stat-num">${svcMapped}</span><span class="report-stat-label">Mapped</span></div>
    <div class="report-stat ${svcReview > 0 ? 'warn' : 'clean'}"><span class="report-stat-num">${svcReview}</span><span class="report-stat-label">Needs Review</span></div>`;

  cdRenderReview(companies, isAdmin);
  cdRenderServiceReview(services);
  cdRenderTable('co');
  cdRenderTable('svc');
}

function cdConfidenceHtml(c) {
  const src = c.source || c.confidence || '';
  if (src === 'pax8_api' || c.confidence === 'high')
    return `<span class="cd-badge cd-badge-api">API</span>`;
  if (src === 'manual')
    return `<span class="cd-badge cd-badge-manual">Manual</span>`;
  if (src === 'name_match' || c.confidence === 'low')
    return `<span class="cd-badge cd-badge-name">Name Match</span>`;
  if (src === 'psa_export' || src === 'csv')
    return `<span class="cd-badge cd-badge-csv">CSV</span>`;
  return `<span class="cd-badge cd-badge-none">—</span>`;
}

function cdRenderReview(companies, isAdmin) {
  const needsReview = companies.filter(c => !c.accepted && !c.excluded);
  const el = document.getElementById('cd-co-review');
  if (!el) return;
  if (!needsReview.length) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <div class="settings-section" style="max-width:860px;margin-bottom:16px;padding:16px 20px">
      <div class="cd-review-hdr">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1L1 13h12L7 1z" stroke="var(--warn)" stroke-width="1.3" stroke-linejoin="round"/><path d="M7 6v3M7 10.5v.5" stroke="var(--warn)" stroke-width="1.4" stroke-linecap="round"/></svg>
        ${needsReview.length} ${needsReview.length === 1 ? 'company needs' : 'companies need'} review
        <span class="cd-review-sub">${isAdmin ? 'Accept, find a match, or exclude each one.' : 'Contact an admin to resolve these.'}</span>
      </div>
      <div class="cd-review-list" id="cd-co-review-list">
        ${needsReview.map(c => cdReviewRowHtml(c, isAdmin)).join('')}
      </div>
    </div>`;
}

function cdReviewRowHtml(c, isAdmin) {
  const hasMatch = !!c.atId;
  return `
  <div class="cd-review-row" data-pax8id="${escHtml(c.pax8Id)}">
    <span class="cd-review-name" title="${escHtml(c.pax8Name || c.pax8Id)}">${escHtml(c.pax8Name || c.pax8Id)}</span>
    <span class="cd-review-match ${hasMatch ? '' : 'cd-review-none'}">
      ${hasMatch ? `→ ${escHtml(c.atName)}` : 'No match found'}
    </span>
    ${hasMatch ? `<span class="cd-badge cd-badge-name" style="flex-shrink:0">Name Match</span>` : `<span class="cd-badge cd-badge-none" style="flex-shrink:0">Unmatched</span>`}
    ${isAdmin ? `
      ${hasMatch ? `<button class="btn btn-ghost btn-sm cd-accept-btn" data-pax8id="${escHtml(c.pax8Id)}" style="color:var(--success);border-color:var(--success)40">Accept</button>` : ''}
      <button class="btn btn-ghost btn-sm cd-find-btn" data-pax8id="${escHtml(c.pax8Id)}" data-pax8name="${escHtml(c.pax8Name || '')}">Find Match</button>
      <button class="btn btn-ghost btn-sm cd-exclude-btn" data-pax8id="${escHtml(c.pax8Id)}" style="color:var(--warn);border-color:var(--warn)30">Exclude</button>
    ` : ''}
  </div>
  <div class="cd-find-wrap hidden" id="cd-find-${escHtml(c.pax8Id).replace(/[^a-z0-9]/gi,'_')}">
    <input type="text" class="cd-find-input" placeholder="Search Autotask companies…" value="${escHtml(c.pax8Name || '')}">
    <div class="cd-find-results"></div>
  </div>`;
}

function cdRenderServiceReview(services) {
  const needsReview = services.filter(s => !s.accepted && !s.excluded);
  const el = document.getElementById('cd-svc-review');
  if (!el) return;
  if (!needsReview.length) { el.innerHTML = ''; return; }

  const isAdmin = _currentUser?.isAdmin || _currentUser?.roles?.includes('hub.admin');
  el.innerHTML = `
    <div class="settings-section" style="max-width:860px;margin-bottom:16px;padding:16px 20px">
      <div class="cd-review-hdr">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1L1 13h12L7 1z" stroke="var(--warn)" stroke-width="1.3" stroke-linejoin="round"/><path d="M7 6v3M7 10.5v.5" stroke="var(--warn)" stroke-width="1.4" stroke-linecap="round"/></svg>
        ${needsReview.length} ${needsReview.length === 1 ? 'service needs' : 'services need'} review
        ${isAdmin ? '<span class="cd-review-sub">Export the full CSV, fill in missing AT service IDs, then re-import.</span>' : ''}
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;margin-top:10px">
        ${needsReview.map(s => `
        <div style="display:flex;align-items:center;gap:10px;padding:6px 10px;background:var(--bg);border-radius:6px;border:1px solid var(--border)">
          <span style="font-size:12px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(s.pax8ProductName || s.pax8ProductId)}</span>
          ${s.termLabel ? `<span style="font-size:11px;color:var(--text-muted);flex-shrink:0">${escHtml(s.termLabel)}</span>` : ''}
          <span class="cd-badge cd-badge-none" style="flex-shrink:0">Unmatched</span>
        </div>`).join('')}
      </div>
    </div>`;
}

function cdRenderTable(tab) {
  if (!_cdCurrentData) return;
  const isAdmin = _currentUser?.isAdmin || _currentUser?.roles?.includes('hub.admin');

  if (tab === 'co') {
    const query   = (document.getElementById('cd-co-search')?.value || '').toLowerCase();
    const rows    = (_cdCurrentData.companies || []).filter(c => c.accepted && c.atId && !c.excluded);
    const filtered = query ? rows.filter(c =>
      (c.pax8Name || '').toLowerCase().includes(query) ||
      (c.atName   || '').toLowerCase().includes(query)
    ) : rows;
    const tbody = document.getElementById('cd-co-tbody');
    if (!tbody) return;
    tbody.innerHTML = filtered.length ? filtered.map(c => `
      <tr>
        <td>${escHtml(c.pax8Name || c.pax8Id)}</td>
        <td>${escHtml(c.atName || `ID: ${c.atId}`)}</td>
        <td>${cdConfidenceHtml(c)}</td>
        ${isAdmin ? `<td><button class="btn btn-ghost btn-sm cd-exclude-btn" data-pax8id="${escHtml(c.pax8Id)}" style="font-size:10px;padding:2px 8px;color:var(--text-muted)">Exclude</button></td>` : ''}
      </tr>`).join('')
      : `<tr><td colspan="${isAdmin ? 4 : 3}" style="text-align:center;color:var(--text-muted);padding:24px;font-size:12px">${query ? 'No results for "' + escHtml(query) + '"' : 'No confirmed mappings yet — run a sync or import a CSV.'}</td></tr>`;
  } else {
    const query   = (document.getElementById('cd-svc-search')?.value || '').toLowerCase();
    const rows    = (_cdCurrentData.services || []).filter(s => s.accepted && s.atServiceId);
    const filtered = query ? rows.filter(s =>
      (s.pax8ProductName || '').toLowerCase().includes(query) ||
      (s.atServiceName   || '').toLowerCase().includes(query)
    ) : rows;
    const tbody = document.getElementById('cd-svc-tbody');
    if (!tbody) return;
    tbody.innerHTML = filtered.length ? filtered.map(s => `
      <tr>
        <td>${escHtml(s.pax8ProductName || s.pax8ProductId)}</td>
        <td style="color:var(--text-muted)">${escHtml(s.termLabel || '—')}</td>
        <td>${escHtml(s.atServiceName || `ID: ${s.atServiceId}`)}</td>
        <td>${cdConfidenceHtml(s)}</td>
      </tr>`).join('')
      : `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:24px;font-size:12px">${query ? 'No results.' : 'No confirmed service mappings yet.'}</td></tr>`;
  }
}

// ── Sync ─────────────────────────────────────────────────────────────────────
async function cdRunSync() {
  // Ensure we're on the Pax8 Sync tab so the log is visible
  if (_cdActiveTab !== 'services') {
    _cdActiveTab = 'services';
    content.querySelectorAll('[data-cdtab]').forEach(b => b.classList.toggle('active', b.dataset.cdtab === 'services'));
    content.querySelectorAll('.cd-panel').forEach(p => p.classList.toggle('hidden', p.id !== 'cd-panel-services'));
  }

  const btn     = document.getElementById('btn-run-mapping');
  const logWrap = document.getElementById('cd-log-wrap');
  const logOut  = document.getElementById('mapping-log-output');

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Syncing…`;
  logWrap.style.display = '';
  logOut.innerHTML = '';

  if (mappingLogUnsubscribe) mappingLogUnsubscribe();
  mappingLogUnsubscribe = window.api.onMappingLog(({ msg, type }) => {
    if (type === 'divider') logOut.innerHTML += `<div class="log-divider"></div>`;
    else logOut.innerHTML += `<div class="log-line log-${type || 'info'}">${escHtml(msg)}</div>`;
    logOut.scrollTop = logOut.scrollHeight;
  });

  try {
    const r = await window.api.runMappingSync();
    if (r.success) {
      const coMapped  = r.stats.coHigh + r.stats.coLow;
      const svcMapped = r.stats.svcHigh + r.stats.svcLow;
      saveToolStat('company-mapping', `${coMapped} companies · ${svcMapped} services mapped`, 'ok');
      _cdCurrentData = r;
      // Also refresh hub data so Companies tab reflects any new platform mappings
      window.api.cmGetHubData().then(hub => { _cdHubData = hub; cdRenderAll(); }).catch(() => cdRenderAll());
    }
  } catch {}

  btn.disabled = false;
  btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 1 0 1.2-3.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M2 3v4h4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg> Sync Pax8`;
}

// ── Event delegation ─────────────────────────────────────────────────────────
content.addEventListener('click', async (e) => {
  // ── Hub companies tab: remove a platform mapping ──
  const chipRemove = e.target.closest('.cd-chip-remove');
  if (chipRemove) {
    e.stopPropagation();
    const { atid, platform, pname } = chipRemove.dataset;
    chipRemove.textContent = '…';
    try {
      await window.api.cmRemovePlatformMapping({ atId: parseInt(atid, 10), platform, platformName: pname });
      const hub = await window.api.cmGetHubData();
      _cdHubData = hub; _cdEditCell = null; cdRenderCompaniesHub();
    } catch { chipRemove.textContent = '×'; }
    return;
  }

  // ── Hub companies tab: click chip to enter reassign mode ──
  const chipClickable = e.target.closest('.cd-chip-clickable');
  if (chipClickable && !e.target.closest('.cd-chip-remove')) {
    const { atid, platform, pname } = chipClickable.dataset;
    const key = `${atid}::${platform}::${pname}`;
    _cdEditCell = _cdEditCell?.key === key ? null : { key, value: '' };
    cdRenderCompaniesHub();
    // Focus the input after render
    setTimeout(() => {
      const inp = document.querySelector(`.cd-platform-reassign-input[data-atid="${atid}"][data-platform="${platform}"][data-pname="${pname}"]`);
      if (inp) { inp.focus(); cdPlatformStartReassign(inp); }
    }, 0);
    return;
  }

  // ── Hub companies tab: reassign select ──
  const reassignItem = e.target.closest('.cd-reassign-item');
  if (reassignItem) {
    const { fromatid, toatid, toatname, platform, pname } = reassignItem.dataset;
    reassignItem.textContent = 'Saving…';
    try {
      await window.api.cmReassignPlatform({ fromAtId: parseInt(fromatid, 10), toAtId: parseInt(toatid, 10), toAtName: toatname, platform, platformName: pname });
      const hub = await window.api.cmGetHubData();
      _cdHubData = hub; _cdEditCell = null; cdRenderCompaniesHub();
    } catch { _cdEditCell = null; cdRenderCompaniesHub(); }
    return;
  }

  // ── Hub companies tab: click + to add a new platform name ──
  const addBtn = e.target.closest('.cd-platform-add-btn');
  if (addBtn) {
    const { atid, platform } = addBtn.dataset;
    const key = `${atid}::${platform}::__add__`;
    _cdEditCell = { key, value: '' };
    cdRenderCompaniesHub();
    setTimeout(() => {
      const inp = document.querySelector(`.cd-platform-add-input`);
      if (inp) inp.focus();
    }, 0);
    return;
  }

  // ── Hub companies tab: save new platform name ──
  const addSaveBtn = e.target.closest('.cd-platform-add-save');
  if (addSaveBtn) {
    const atid = parseInt(addSaveBtn.dataset.atid, 10);
    const platform = addSaveBtn.dataset.platform;
    const wrap = addSaveBtn.closest('.cd-platform-edit-wrap');
    const inp  = wrap?.querySelector('.cd-platform-add-input');
    const name = inp?.value?.trim();
    if (!name) return;
    addSaveBtn.textContent = 'Saving…'; addSaveBtn.disabled = true;
    try {
      await window.api.cmAddPlatformMapping({ atId: atid, platform, platformName: name });
      const hub = await window.api.cmGetHubData();
      _cdHubData = hub; _cdEditCell = null; cdRenderCompaniesHub();
    } catch { addSaveBtn.textContent = 'Save'; addSaveBtn.disabled = false; }
    return;
  }

  // ── Hub companies tab: cancel add/reassign ──
  const addCancelBtn = e.target.closest('.cd-platform-add-cancel');
  if (addCancelBtn) {
    _cdEditCell = null; cdRenderCompaniesHub();
    return;
  }

  // ── Hub companies tab: toggle excluded ──
  const exclToggle = e.target.closest('.cd-excl-toggle');
  if (exclToggle) {
    const atId    = parseInt(exclToggle.dataset.atid, 10);
    const exclude = exclToggle.dataset.excl !== '1';
    exclToggle.disabled = true; exclToggle.textContent = '…';
    try {
      await window.api.cmSetAtExcluded({ atId, excluded: exclude });
      const hub = await window.api.cmGetHubData();
      _cdHubData = hub;
      cdRenderCompaniesHub();
    } catch { exclToggle.disabled = false; }
    return;
  }

  // ── Service mapping: enter edit mode ──
  const svcEditBtn = e.target.closest('.cd-svc-edit-btn');
  if (svcEditBtn) {
    const { tool, mid } = svcEditBtn.dataset;
    _cdSvcEditId = `${tool}::${mid}`;
    const mappings = _cdHubData?.serviceMappings?.[tool] || [];
    const m = mappings.find(x => x.id === mid);
    if (m) {
      _cdSvcEditDraft = {
        vendorName: m.vendorName || m.vendorLabel || '',
        atServices: [...cdSvcAtServices(m)],
        contracts: (m.contracts || []).join(', '),
      };
    }
    const groupEl = document.getElementById(`cd-svcmap-${tool}`);
    if (groupEl && _cdHubData?.serviceMappings) {
      cdRenderSvcMapGroup(groupEl, tool, _cdHubData.serviceMappings[tool] || []);
    }
    return;
  }

  // ── Service mapping: cancel edit ──
  const svcCancelBtn = e.target.closest('.cd-svc-cancel-btn');
  if (svcCancelBtn) {
    const { tool } = svcCancelBtn.dataset;
    _cdSvcEditId   = null;
    _cdSvcEditDraft = null;
    const groupEl = document.getElementById(`cd-svcmap-${tool}`);
    if (groupEl && _cdHubData?.serviceMappings) {
      cdRenderSvcMapGroup(groupEl, tool, _cdHubData.serviceMappings[tool] || []);
    }
    return;
  }

  // ── Service mapping: remove one AT service from draft ──
  const svcRemoveSvc = e.target.closest('.cd-svc-remove-svc');
  if (svcRemoveSvc) {
    const { tool, mid, svcidx } = svcRemoveSvc.dataset;
    if (_cdSvcEditDraft?.atServices) {
      _cdSvcEditDraft.atServices.splice(parseInt(svcidx, 10), 1);
    }
    const groupEl = document.getElementById(`cd-svcmap-${tool}`);
    if (groupEl && _cdHubData?.serviceMappings) {
      cdRenderSvcMapGroup(groupEl, tool, _cdHubData.serviceMappings[tool] || []);
    }
    return;
  }

  // ── Service mapping: add AT service from search results (into draft) ──
  const svcResultItem = e.target.closest('.cd-svc-result-item');
  if (svcResultItem) {
    const { tool, mid, svcid, svcname } = svcResultItem.dataset;
    if (_cdSvcEditDraft) {
      const id = parseInt(svcid, 10);
      if (!_cdSvcEditDraft.atServices.some(s => s.id === id)) {
        _cdSvcEditDraft.atServices.push({ id, name: svcname });
      }
    }
    const groupEl = document.getElementById(`cd-svcmap-${tool}`);
    if (groupEl && _cdHubData?.serviceMappings) {
      cdRenderSvcMapGroup(groupEl, tool, _cdHubData.serviceMappings[tool] || []);
    }
    return;
  }

  // ── Service mapping: save draft ──
  const svcSaveBtn = e.target.closest('.cd-svc-save-btn');
  if (svcSaveBtn) {
    const { tool, mid } = svcSaveBtn.dataset;
    const isPax8 = tool === 'pax8';
    const row = svcSaveBtn.closest('tr');
    const vendorInput = row?.querySelector('.cd-svc-vendor-input');
    const contractsInput = row?.querySelector('.cd-svc-contracts-input');
    const vendorVal = vendorInput?.value.trim() || '';
    const contractsVal = contractsInput?.value.trim() || '';
    const atServices = _cdSvcEditDraft?.atServices || [];
    const contracts = contractsVal ? contractsVal.split(',').map(s => s.trim()).filter(Boolean) : [];
    const mapping = {
      id: mid,
      atServices,
      contracts,
      ...(isPax8 ? { vendorLabel: vendorVal } : { vendorName: vendorVal }),
    };
    svcSaveBtn.disabled = true; svcSaveBtn.textContent = 'Saving…';
    try {
      await window.api.cmSaveServiceMapping({ tool, mapping });
      const hub = await window.api.cmGetHubData();
      _cdHubData      = hub;
      _cdSvcEditId    = null;
      _cdSvcEditDraft = null;
      const groupEl = document.getElementById(`cd-svcmap-${tool}`);
      if (groupEl && hub?.serviceMappings) {
        cdRenderSvcMapGroup(groupEl, tool, hub.serviceMappings[tool] || []);
      }
    } catch (err) { svcSaveBtn.disabled = false; svcSaveBtn.textContent = 'Save'; }
    return;
  }

  // ── Pax8 Sync tab: accept match ──
  const acceptBtn = e.target.closest('.cd-accept-btn');
  if (acceptBtn) {
    const pax8Id = acceptBtn.dataset.pax8id;
    acceptBtn.disabled = true; acceptBtn.textContent = 'Saving…';
    try {
      await window.api.acceptCompanyMatch({ pax8Id });
      await cdLoadData();
    } catch { acceptBtn.disabled = false; acceptBtn.textContent = 'Accept'; }
    return;
  }

  // ── Pax8 Sync tab: exclude company ──
  const excludeBtn = e.target.closest('.cd-exclude-btn');
  if (excludeBtn) {
    const pax8Id = excludeBtn.dataset.pax8id;
    excludeBtn.disabled = true; excludeBtn.textContent = '…';
    try {
      await window.api.setCompanyExcluded({ pax8Id, excluded: true });
      await cdLoadData();
    } catch { excludeBtn.disabled = false; excludeBtn.textContent = 'Exclude'; }
    return;
  }

  // ── Pax8 Sync tab: toggle find match box ──
  const findBtn = e.target.closest('.cd-find-btn');
  if (findBtn) {
    const pax8Id  = findBtn.dataset.pax8id;
    const safeId  = pax8Id.replace(/[^a-z0-9]/gi, '_');
    const findWrap = document.getElementById(`cd-find-${safeId}`);
    if (!findWrap) return;
    const isOpen = !findWrap.classList.contains('hidden');
    findWrap.classList.toggle('hidden', isOpen);
    if (!isOpen) {
      const input = findWrap.querySelector('.cd-find-input');
      if (input) { input.focus(); input.select(); cdSearchAt(input, findWrap, pax8Id); }
    }
    return;
  }

  // ── Pax8 Sync tab: select found AT company ──
  const matchItem = e.target.closest('.cd-match-item:not(.cd-svc-result-item)');
  if (matchItem) {
    const pax8Id = matchItem.dataset.pax8id;
    const atId   = parseInt(matchItem.dataset.atid, 10);
    const atName = matchItem.dataset.atname;
    matchItem.textContent = 'Saving…';
    try {
      await window.api.acceptCompanyMatch({ pax8Id, atId, atName });
      await cdLoadData();
    } catch { matchItem.textContent = atName; }
    return;
  }
});

// ── Platform mapping edit helpers ────────────────────────────────────────────

function cdPlatformStartReassign(input) {
  let timer;
  const atId    = parseInt(input.dataset.atid, 10);
  const platform = input.dataset.platform;
  const pname   = input.dataset.pname;
  const safeKey = `${atId}_${platform}_${pname}`.replace(/[^a-z0-9]/gi, '_');
  const resultsEl = document.getElementById(`reassign-results-${safeKey}`);
  if (!resultsEl) return;

  // Search hub companies (already loaded) rather than making a network call
  function doSearch() {
    const q = input.value.trim().toLowerCase();
    if (!q) { resultsEl.innerHTML = ''; return; }
    const matches = (_cdHubData?.companies || [])
      .filter(c => c.atId != null && (c.atName || '').toLowerCase().includes(q))
      .slice(0, 10);
    if (!matches.length) {
      resultsEl.innerHTML = `<div style="padding:6px 10px;font-size:11px;color:var(--text-muted)">No matches</div>`;
      return;
    }
    resultsEl.innerHTML = matches.map(r =>
      `<div class="cd-match-item cd-reassign-item" data-fromatid="${atId}" data-toatid="${r.atId}" data-toatname="${escHtml(r.atName)}" data-platform="${platform}" data-pname="${escHtml(pname)}">${escHtml(r.atName)}</div>`
    ).join('');
  }

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(doSearch, 200); });
  input.addEventListener('keydown', e => { if (e.key === 'Escape') { _cdEditCell = null; cdRenderCompaniesHub(); } });
  doSearch();
}

// ── Inline AT search ─────────────────────────────────────────────────────────
function cdSearchAt(input, wrap, pax8Id) {
  let timer;
  const resultsEl = wrap.querySelector('.cd-find-results');

  async function doSearch() {
    const q = input.value.trim();
    if (!q) { resultsEl.innerHTML = ''; return; }
    resultsEl.innerHTML = `<div style="padding:6px 10px;font-size:11px;color:var(--text-muted)">Searching…</div>`;
    const results = await window.api.cmSearchAtCompanies(q).catch(() => []);
    if (!results.length) {
      resultsEl.innerHTML = `<div style="padding:6px 10px;font-size:11px;color:var(--text-muted)">No matches found</div>`;
      return;
    }
    resultsEl.innerHTML = results.map(r => `
      <div class="cd-match-item" data-pax8id="${escHtml(pax8Id)}" data-atid="${r.id}" data-atname="${escHtml(r.name)}">
        ${escHtml(r.name)} <span style="color:var(--text-muted);font-size:10px">ID: ${r.id}</span>
      </div>`).join('');
  }

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(doSearch, 300); });
  doSearch();
}

// ── CSV actions (admin) ───────────────────────────────────────────────────────
async function exportMappingCsv() {
  const btn    = document.getElementById('btn-export-mapping-csv');
  const status = document.getElementById('cd-action-status');
  btn.disabled = true;
  try {
    const r = await window.api.exportMappingCsv();
    if (r.error) { status.textContent = `Error: ${r.error}`; status.className = 'save-status error'; }
    else { status.textContent = `✓ Exported ${r.coCount} unmapped companies & ${r.svcCount} services`; status.className = 'save-status success'; }
  } catch (e) { status.textContent = `Error: ${e.message}`; status.className = 'save-status error'; }
  btn.disabled = false;
  setTimeout(() => { if (status) { status.textContent = ''; status.className = 'save-status'; } }, 5000);
}

async function exportFullMappingCsv() {
  const btn    = document.getElementById('btn-export-full-mapping-csv');
  const status = document.getElementById('cd-action-status');
  btn.disabled = true;
  try {
    const r = await window.api.exportFullMappingCsv();
    if (r.error) { status.textContent = `Error: ${r.error}`; status.className = 'save-status error'; }
    else { status.textContent = `✓ Full export: ${r.coCount} companies, ${r.svcCount} services${r.hasRef ? ' + AT ref' : ''}`; status.className = 'save-status success'; }
  } catch (e) { status.textContent = `Error: ${e.message}`; status.className = 'save-status error'; }
  btn.disabled = false;
  setTimeout(() => { if (status) { status.textContent = ''; status.className = 'save-status'; } }, 5000);
}

async function importMappingCsv(type) {
  const status = document.getElementById('cd-action-status');
  try {
    const r = await window.api.importMappingCsv(type);
    if (r.cancelled) return;
    if (r.error) { status.textContent = `Error: ${r.error}`; status.className = 'save-status error'; }
    else {
      const label = r.isPsaExport ? `${r.count} products from Pax8 PSA export` : `${r.count} ${type}`;
      status.textContent = `✓ ${label} imported`;
      status.className = 'save-status success';
      cdLoadData();
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
        </div>
        <div style="margin-top:16px;border-top:1px solid rgba(255,255,255,.08);padding-top:16px">
          <div class="field-label" style="margin-bottom:4px">Workplace Bundle Overrides</div>
          <p class="field-hint" style="margin-bottom:10px">Clients with contracted bundled seats — deducted from billable count when pushing to AT.</p>
          <div id="ks-workplace-bundles-list" style="margin-bottom:8px"></div>
          <button class="btn btn-ghost btn-sm" id="ks-add-workplace-bundle" type="button">+ Add Client</button>
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
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2C5.79 2 4 3.79 4 6v1H3a1 1 0 00-1 1v5a1 1 0 001 1h10a1 1 0 001-1V8a1 1 0 00-1-1h-1V6c0-2.21-1.79-4-4-4z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
          Autotask PSA — Personal Write Key
        </h2>
        <p class="field-hint" style="margin-bottom:12px">Optional. If set, your personal credentials are used for all Autotask operations. If left blank, the shared read-only key from Key Vault is used automatically.</p>
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
    // Render workplace bundle overrides table
    const listEl = document.getElementById('ks-workplace-bundles-list');
    if (listEl) {
      const WP_PRODUCTS = [
        ['DWP Metered Plan - User License',          'DWP Metered — User'],
        ['DWP Unlimited Plan - User License',         'DWP Unlimited — User'],
        ['DWP Metered Plan - Server License',         'DWP Metered — Server'],
        ['DWP Unlimited Plan - Server License',       'DWP Unlimited — Server'],
        ['DFP Unlimited Plan - Laptop/Desktop License','DFP — Laptop/Desktop'],
        ['DFP Unlimited Plan - Server License',       'DFP — Server'],
      ];
      const productOpts = WP_PRODUCTS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
      const addBundleRow = (client = '', product = '', seats = 0) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px';
        row.dataset.bundleRow = '1';
        row.innerHTML = `<input class="field-input" placeholder="Client name" style="flex:1;min-width:150px" data-bundle-client value="${escHtml(client)}">
          <select class="field-input" data-bundle-product style="width:175px;color-scheme:dark">${productOpts}</select>
          <input class="field-input" type="number" min="0" placeholder="Seats" style="width:80px" data-bundle-seats value="${seats}">
          <button class="btn btn-ghost btn-sm" type="button" style="white-space:nowrap;flex-shrink:0">Remove</button>`;
        if (product) row.querySelector('[data-bundle-product]').value = product;
        row.querySelector('button').addEventListener('click', () => row.remove());
        listEl.appendChild(row);
      };
      listEl.innerHTML = '';
      for (const b of (s.workplaceBundles || [])) addBundleRow(b.client, b.product || '', b.bundledSeats || 0);
      const addBtn = document.getElementById('ks-add-workplace-bundle');
      if (addBtn) {
        const fresh = addBtn.cloneNode(true);
        addBtn.replaceWith(fresh);
        fresh.addEventListener('click', () => addBundleRow());
      }
    }
  } catch {}
}

async function saveKaseyaSettingsUI() {
  const status = document.getElementById('ks-save-status');
  try {
    const g = (id) => parseFloat(document.getElementById(id)?.value) || 0;
    const gs = (id) => (document.getElementById(id)?.value?.trim() || '');
    const workplaceBundles = [];
    document.querySelectorAll('#ks-workplace-bundles-list [data-bundle-row]').forEach(row => {
      const client  = (row.querySelector('[data-bundle-client]')?.value || '').trim();
      const product = row.querySelector('[data-bundle-product]')?.value || '';
      const seats   = parseInt(row.querySelector('[data-bundle-seats]')?.value || '0', 10);
      if (client && product) workplaceBundles.push({ client, product, bundledSeats: isNaN(seats) ? 0 : seats });
    });
    const settings = {
      psa:    { strategic: g('ks-psa-strategic'), serviceDelivery: g('ks-psa-serviceDelivery'), admin: g('ks-psa-admin'), coManaged: g('ks-psa-coManaged') },
      rmm:    { strategic: g('ks-rmm-strategic'), serviceDelivery: g('ks-rmm-serviceDelivery') },
      itGlue: { strategic: g('ks-itGlue-strategic'), serviceDelivery: g('ks-itGlue-serviceDelivery'), admin: g('ks-itGlue-admin') },
      workplaceBundles,
    };
    await window.api.saveKaseyaSettings(settings);
    status.textContent = '✓ Saved'; status.className = 'save-status success';
    setTimeout(() => { if (status) { status.textContent = ''; status.className = 'save-status'; } }, 2500);
  } catch (e) { status.textContent = `Error: ${e.message}`; status.className = 'save-status error'; }
}

const CRED_MAP = {
  'at-username':         'autotask_username',
  'at-api-key':          'autotask_api_key',
  'at-integration-code': 'autotask_integration_code',
  'at-url':              'autotask_url',
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
        <p class="view-desc">Load directly from Pax8 or import a CSV — processes Azure per-client pricing and service quantities, then pushes changes directly to Autotask contracts. Also generates QBO breakdowns and an Excel export.</p>
      </div>
      <img class="view-header-deco" src="Anchor_Logo_Vertical_High.png" alt="" draggable="false" />
    </div>

    <div class="settings-section">
      <div class="section-title">Step 1 — Select Invoice</div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">
        <button class="btn btn-primary" id="ip-load-recent-btn">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style="margin-right:4px"><path d="M6.5 1v3.5l2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" stroke-width="1.3"/></svg>
          Load Most Recent Invoice
        </button>
        <span style="color:var(--text-muted);font-size:12px">·</span>
        <button class="btn btn-ghost" id="ip-load-pax8-btn" style="font-size:12px">Browse Past Invoices…</button>
        <span style="color:var(--text-muted);font-size:12px">·</span>
        <button class="btn btn-ghost" id="ip-browse-btn" style="font-size:12px">Browse CSV…</button>
        <span id="ip-filename" style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono)"></span>
      </div>
      <div id="ip-invoice-picker" style="display:none;margin-bottom:10px">
        <select id="ip-invoice-select" style="background:var(--surface-2);color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 10px;font-size:13px;min-width:320px;color-scheme:dark">
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
          <button class="btn btn-ghost" id="ip-at-push-btn" style="font-size:12px;color:#4ade80;border-color:#4ade8066">
            ↑ Push to Autotask
          </button>
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
            <span id="ip-svc-push-btns" style="display:flex;gap:6px"></span>
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

  // Load Most Recent Invoice — auto-fetches and auto-processes the newest invoice
  const RECENT_BTN_HTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none" style="margin-right:4px"><path d="M6.5 1v3.5l2 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" stroke-width="1.3"/></svg>Load Most Recent Invoice';
  document.getElementById('ip-load-recent-btn').addEventListener('click', async () => {
    const btn = document.getElementById('ip-load-recent-btn');
    const status = document.getElementById('ip-status');
    const processBtn = document.getElementById('ip-process-btn');
    btn.disabled = true; btn.textContent = 'Fetching…';
    processBtn.disabled = true;
    status.textContent = 'Fetching latest invoice from Pax8…'; status.className = 'save-status';
    try {
      const res = await window.api.fetchPax8InvoiceList();
      if (!res.success) { status.textContent = `Error: ${res.error}`; status.className = 'save-status error'; return; }
      if (!res.invoices.length) { status.textContent = 'No invoices found.'; status.className = 'save-status error'; return; }
      _pax8InvoiceList = res.invoices;
      _invoiceFilePath = null;
      document.getElementById('ip-filename').textContent = '';
      document.getElementById('ip-invoice-picker').style.display = 'none';
      const latest = res.invoices[0];
      btn.textContent = 'Processing…';
      status.textContent = `Processing ${latest.label}…`; status.className = 'save-status';
      const result = await window.api.processPax8Invoice({ invoiceId: latest.id, invoiceDate: latest.invoiceDate, defaultMarginPct: 20 });
      if (!result.success) { status.textContent = `Error: ${result.error}`; status.className = 'save-status error'; return; }
      _invoiceData = result;
      saveToolStat('invoice-processor', `${result.totalLines} lines — ${latest.label}`, 'ok');
      status.textContent = `✓ ${latest.label} · ${result.totalLines} lines`; status.className = 'save-status success';
      renderInvoiceProcessorResults(result);
    } catch(e) { status.textContent = `Error: ${e.message}`; status.className = 'save-status error'; }
    finally { btn.disabled = false; btn.innerHTML = RECENT_BTN_HTML; }
  });

  // Browse Past Invoices — shows the full picker dropdown
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
      status.textContent = `${res.invoices.length} invoices available`; status.className = 'save-status';
    } catch(e) { status.textContent = `Error: ${e.message}`; status.className = 'save-status error'; }
    finally { btn.disabled = false; btn.textContent = 'Browse Past Invoices…'; }
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
      const pickerLabel = (() => { const m = (result.invoiceDate||'').match(/^(\d{4})-(\d{2})/); const MO = ['January','February','March','April','May','June','July','August','September','October','November','December']; return m ? `${MO[parseInt(m[2],10)-1]} ${m[1]}` : (result.invoiceDate||''); })();
      status.textContent = `✓ ${pickerLabel} · ${result.totalLines} lines`; status.className = 'save-status success';
      saveToolStat('invoice-processor', `${result.totalLines} lines — ${pickerLabel}`, 'ok');
      renderInvoiceProcessorResults(result);
    } catch(e) { status.textContent = `Error: ${e.message}`; status.className = 'save-status error'; }
    finally { btn.disabled = false; }
  });

  // Restore previous results if any
  if (_invoiceData) {
    renderInvoiceProcessorResults(_invoiceData);
    const status = document.getElementById('ip-status');
    const _rm = (_invoiceData.invoiceDate||'').match(/^(\d{4})-(\d{2})/); const _MO = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const _rl = _rm ? `${_MO[parseInt(_rm[2],10)-1]} ${_rm[1]}` : (_invoiceData.invoiceDate||'');
    status.textContent = `✓ ${_rl} · ${_invoiceData.totalLines} lines`; status.className = 'save-status success';
    document.getElementById('ip-process-btn').disabled = false;
  }
}

function showAtPushModal(serviceType, rows, invoiceDate) {
  const AT_SVC_LABELS = { azure: 'Azure', nerdio: 'Nerdio', exclaimer: 'Exclaimer', ironscales: 'Ironscales', printix: 'Printix' };
  const AT_HANDLERS   = {
    azure:      (d) => window.api.atPushAzure(d),
    nerdio:     (d) => window.api.atPushNerdio(d),
    exclaimer:  (d) => window.api.atPushExclaimer(d),
    ironscales: (d) => window.api.atPushIronscales(d),
    printix:    (d) => window.api.atPushPrintix(d),
  };
  const label = AT_SVC_LABELS[serviceType] || serviceType;

  // Azure = 1st of NEXT month (pricing change for next billing period)
  // Qty services (nerdio/exclaimer/ironscales/printix) = 1st of CURRENT month
  const base = invoiceDate ? new Date(invoiceDate + 'T12:00:00') : new Date();
  const isAzure = serviceType === 'azure';
  const effDate = isAzure
    ? new Date(base.getFullYear(), base.getMonth() + 1, 1).toISOString().slice(0, 10)
    : new Date(base.getFullYear(), base.getMonth(), 1).toISOString().slice(0, 10);
  const dateHint = isAzure ? '1st of next billing period' : '1st of current billing period';

  const mapped   = rows.filter(r => r.atCompanyId);
  const unmapped = rows.filter(r => !r.atCompanyId);

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border-2);border-radius:10px;
      padding:24px;width:540px;max-width:90vw;max-height:80vh;display:flex;flex-direction:column;gap:14px">
      <div style="font-size:15px;font-weight:600">Push ${escHtml(label)} to Autotask</div>
      <div style="display:flex;align-items:center;gap:10px">
        <label style="white-space:nowrap;font-size:13px;color:var(--text-dim)">Effective Date:</label>
        <input type="date" id="atpm-date" value="${effDate}"
          style="padding:5px 9px;background:#e8eaf0;border:1px solid #9ca3af;color-scheme:light;
                 border-radius:6px;color:#111827;font-size:13px;flex:1;font-family:inherit">
        <span style="font-size:12px;color:var(--text-dim);white-space:nowrap">${dateHint}</span>
      </div>
      <div style="font-size:13px;color:var(--text-dim)">
        ${mapped.length} compan${mapped.length===1?'y':'ies'} to push${unmapped.length>0?` &nbsp;·&nbsp; <span style="color:var(--warn)">${unmapped.length} skipped (no AT mapping)</span>`:''}
      </div>
      <div id="atpm-progress" style="display:none;overflow-y:auto;max-height:260px;
        background:var(--bg);border-radius:6px;padding:12px;border:1px solid var(--border);
        font-family:var(--font-mono);font-size:12px;line-height:1.8"></div>
      <div id="atpm-summary" style="display:none;font-size:13px;font-weight:500"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:2px">
        <button id="atpm-cancel" class="btn btn-ghost" style="font-size:12px">Cancel</button>
        <button id="atpm-confirm" class="btn" style="font-size:12px;background:var(--accent);color:#fff;border:none">
          Push ${mapped.length} Compan${mapped.length===1?'y':'ies'}
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById('atpm-cancel').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  document.getElementById('atpm-confirm').addEventListener('click', async () => {
    const effectiveDate = document.getElementById('atpm-date').value;
    if (!effectiveDate) { alert('Please set an effective date.'); return; }

    const confirmBtn = document.getElementById('atpm-confirm');
    const cancelBtn  = document.getElementById('atpm-cancel');
    confirmBtn.disabled = true;
    cancelBtn.disabled  = true;
    confirmBtn.textContent = 'Pushing…';

    const progressEl = document.getElementById('atpm-progress');
    progressEl.style.display = 'block';
    progressEl.innerHTML = '<span style="color:var(--text-muted)">Connecting to Autotask…</span>';

    try {
      const res     = await AT_HANDLERS[serviceType]({ rows, effectiveDate });
      const results = res.results || [];
      let success = 0, skipped = 0, errors = 0;
      const lines = [];
      for (const r of results) {
        if (r.status === 'success') {
          success++;
          const extra = r.verified === false ? ' <span style="color:#f59e0b">(verify mismatch)</span>' : '';
          lines.push(`<span style="color:#4ade80">✓</span> ${escHtml(r.company)}${extra}`);
        } else if (r.status === 'no_change') {
          skipped++;
          lines.push(`<span style="color:var(--text-muted)">–</span> ${escHtml(r.company)} <span style="color:var(--text-muted)">(no change, qty=${r.qty})</span>`);
        } else if (r.status === 'no_mapping') {
          skipped++;
          lines.push(`<span style="color:var(--text-muted)">–</span> ${escHtml(r.company)} <span style="color:var(--text-muted)">(no AT mapping)</span>`);
        } else if (r.status === 'no_contract') {
          skipped++;
          lines.push(`<span style="color:#f59e0b">⚠</span> ${escHtml(r.company)} <span style="color:var(--text-muted)">(no contract found)</span>`);
        } else {
          errors++;
          lines.push(`<span style="color:var(--error)">✗</span> ${escHtml(r.company)} — <span style="color:var(--error)">${escHtml(r.message||r.status)}</span>`);
        }
      }
      progressEl.innerHTML = lines.join('<br>');

      const summaryEl = document.getElementById('atpm-summary');
      summaryEl.style.display = 'block';
      summaryEl.style.color   = errors > 0 ? 'var(--error)' : success > 0 ? '#4ade80' : 'var(--text-muted)';
      summaryEl.textContent   = `${success} updated · ${skipped} skipped · ${errors} error${errors!==1?'s':''}`;

      cancelBtn.disabled    = false;
      cancelBtn.textContent = 'Close';
      confirmBtn.style.display = 'none';
      const resultsEl = document.getElementById('ip-results');
      if (resultsEl) renderPushHistory(resultsEl);
    } catch (e) {
      progressEl.innerHTML = `<span style="color:var(--error)">Error: ${escHtml(e.message)}</span>`;
      cancelBtn.disabled    = false;
      cancelBtn.textContent = 'Close';
      confirmBtn.style.display = 'none';
    }
  });
}

function renderMappingPanel(container, autoMapped, suggestions) {
  const existing = document.getElementById('ip-mapping-panel');
  if (existing) existing.remove();
  if (!autoMapped.length && !suggestions.length) return;

  const panel = document.createElement('div');
  panel.id = 'ip-mapping-panel';
  panel.style.cssText = 'margin-top:16px;border:1px solid var(--border-2);border-radius:8px;overflow:hidden';

  let html = '';
  if (autoMapped.length > 0) {
    html += `<div style="padding:10px 14px;background:rgba(74,222,128,.07);border-bottom:1px solid var(--border)">
      <div style="font-size:12px;font-weight:600;color:#4ade80;margin-bottom:5px">
        ✓ Auto-Matched ${autoMapped.length} Compan${autoMapped.length===1?'y':'ies'} to Autotask
      </div>
      ${autoMapped.map(m => `
        <div style="font-size:12px;padding:2px 0;display:flex;gap:6px">
          <span style="color:var(--text)">${escHtml(m.pax8Name)}</span>
          <span style="color:var(--text-dim)">→</span>
          <span style="color:var(--text-muted)">${escHtml(m.atCompanyName)}</span>
          <span style="color:var(--text-dim);font-size:11px">${Math.round(m.confidence*100)}%</span>
        </div>`).join('')}
    </div>`;
  }
  if (suggestions.length > 0) {
    html += `<div style="padding:10px 14px">
      <div style="font-size:12px;font-weight:600;color:#f59e0b;margin-bottom:8px">
        ⚠ ${suggestions.length} Compan${suggestions.length===1?'y':'ies'} Need Confirmation
      </div>
      <div id="ip-suggestions-list" style="display:flex;flex-direction:column;gap:4px">
        ${suggestions.map((s, i) => `
          <div data-sug-idx="${i}" style="display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid var(--border)">
            <div style="flex:1;font-size:12px;display:flex;gap:6px;flex-wrap:wrap">
              <span style="color:var(--text)">${escHtml(s.pax8Name)}</span>
              <span style="color:var(--text-dim)">→</span>
              <span style="color:var(--text-muted)">${escHtml(s.atCompanyName)}</span>
              <span style="color:var(--text-dim);font-size:11px">${Math.round(s.confidence*100)}% match</span>
            </div>
            <button class="btn btn-ghost" style="font-size:11px;color:#4ade80;border-color:#4ade8066;padding:2px 8px;white-space:nowrap"
              data-confirm='${JSON.stringify(s)}'>Confirm</button>
          </div>`).join('')}
      </div>
    </div>`;
  }
  panel.innerHTML = html;
  container.appendChild(panel);

  panel.querySelectorAll('[data-confirm]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const s = JSON.parse(btn.dataset.confirm);
      btn.disabled = true;
      btn.textContent = 'Saving…';
      try {
        const res = await window.api.confirmCompanyMapping({
          pax8Id: s.pax8Id, pax8Name: s.pax8Name,
          atCompanyId: s.atCompanyId, atCompanyName: s.atCompanyName,
        });
        if (res.success) {
          // Update in-memory invoice rows so push buttons work immediately
          for (const arr of [_invoiceData?.azure, _invoiceData?.nerdio, _invoiceData?.exclaimer,
                              _invoiceData?.ironscales, _invoiceData?.printix]) {
            if (!arr) continue;
            for (const row of arr) {
              if (row.company === s.pax8Name) {
                row.atCompanyId   = s.atCompanyId;
                row.atCompanyName = s.atCompanyName;
              }
            }
          }
          const row = btn.closest('[data-sug-idx]');
          if (row) { row.style.opacity = '0.4'; btn.textContent = '✓ Saved'; }
        } else {
          btn.disabled = false; btn.textContent = 'Retry';
        }
      } catch { btn.disabled = false; btn.textContent = 'Retry'; }
    });
  });
}

async function renderPushHistory(container) {
  let panel = document.getElementById('ip-push-history');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'ip-push-history';
    panel.style.cssText = 'margin-top:16px';
    container.appendChild(panel);
  }

  const fmtTs = ts => { try { return new Date(ts).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }); } catch { return ts; } };
  const statusColor = s => s.errors > 0 ? 'var(--error)' : s.success > 0 ? '#4ade80' : 'var(--text-muted)';
  const SVC_LABELS = { azure:'Azure', nerdio:'Nerdio', exclaimer:'Exclaimer', ironscales:'Ironscales', printix:'Printix' };

  try {
    const res = await window.api.getPushLog();
    const log = res.log || [];

    if (!log.length) {
      panel.innerHTML = '';
      return;
    }

    const rows = log.slice(0, 20).map((entry, i) => {
      const detailId = `ip-ph-detail-${i}`;
      const resLines = (entry.results || []).map(r => {
        if (r.status === 'success') return `<span style="color:#4ade80">✓</span> ${escHtml(r.company)}`;
        if (r.status === 'no_change') return `<span style="color:var(--text-dim)">–</span> ${escHtml(r.company)} <span style="color:var(--text-dim)">(no change)</span>`;
        if (r.status === 'no_mapping') return `<span style="color:var(--text-dim)">–</span> ${escHtml(r.company)} <span style="color:var(--text-dim)">(no AT mapping)</span>`;
        if (r.status === 'no_contract') return `<span style="color:#f59e0b">⚠</span> ${escHtml(r.company)} <span style="color:var(--text-dim)">(no contract)</span>`;
        return `<span style="color:var(--error)">✗</span> ${escHtml(r.company)} — <span style="color:var(--error)">${escHtml(r.message||r.status)}</span>`;
      }).join('<br>');

      return `<tr style="border-bottom:1px solid var(--border);cursor:pointer" onclick="
        const d=document.getElementById('${detailId}');
        d.style.display=d.style.display==='none'?'table-row':'none'">
        <td style="padding:6px 10px;font-size:12px;color:var(--text-muted)">${fmtTs(entry.ts)}</td>
        <td style="padding:6px 10px;font-size:12px;font-weight:600;color:var(--text)">${escHtml(SVC_LABELS[entry.serviceType]||entry.serviceType)}</td>
        <td style="padding:6px 10px;font-size:12px;font-family:var(--font-mono);color:var(--text-muted)">${escHtml(entry.effectiveDate||'')}</td>
        <td style="padding:6px 10px;font-size:12px;color:${statusColor(entry.summary||{})}">${entry.summary?.success||0} updated · ${entry.summary?.skipped||0} skipped · ${entry.summary?.errors||0} err</td>
      </tr>
      <tr id="${detailId}" style="display:none;background:var(--bg)">
        <td colspan="4" style="padding:8px 14px;font-family:var(--font-mono);font-size:11px;line-height:1.7">${resLines}</td>
      </tr>`;
    }).join('');

    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <div style="font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em">Push History</div>
      </div>
      <div style="border:1px solid var(--border-2);border-radius:8px;overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:rgba(45,77,107,.5)">
              <th style="text-align:left;padding:5px 10px;font-size:11px;color:var(--text-muted);font-weight:600">When</th>
              <th style="text-align:left;padding:5px 10px;font-size:11px;color:var(--text-muted);font-weight:600">Service</th>
              <th style="text-align:left;padding:5px 10px;font-size:11px;color:var(--text-muted);font-weight:600">Eff. Date</th>
              <th style="text-align:left;padding:5px 10px;font-size:11px;color:var(--text-muted);font-weight:600">Result</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch { panel.innerHTML = ''; }
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

  // Wire Azure push to Autotask
  document.getElementById('ip-at-push-btn').addEventListener('click', () => {
    const rows = getInvoiceDataWithCurrentMargins();
    showAtPushModal('azure', rows, _invoiceData.invoiceDate);
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
    // Wire per-service AT push buttons
    const pushBtnsEl = document.getElementById('ip-svc-push-btns');
    if (pushBtnsEl) {
      const AT_PUSH_SVCS = ['nerdio', 'exclaimer', 'ironscales', 'printix'];
      const AT_PUSH_LABELS = { nerdio: 'Nerdio', exclaimer: 'Exclaimer', ironscales: 'Ironscales', printix: 'Printix' };
      for (const key of AT_PUSH_SVCS) {
        const svcRows = _invoiceData[key] || [];
        if (!svcRows.length) continue;
        const btn = document.createElement('button');
        btn.className = 'btn btn-ghost';
        btn.style.cssText = 'font-size:11px;color:#4ade80;border-color:#4ade8066;padding:3px 8px';
        btn.textContent = `↑ ${AT_PUSH_LABELS[key]}`;
        btn.addEventListener('click', () => showAtPushModal(key, svcRows, _invoiceData.invoiceDate));
        pushBtnsEl.appendChild(btn);
      }
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

  // Auto-mapping results and push history
  renderMappingPanel(resultsEl, data.autoMapped || [], data.suggestions || []);
  renderPushHistory(resultsEl);
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
        <p class="view-desc">Load a Kaseya invoice from SharePoint to review all cost and usage sections and generate QBO journal entries.</p>
      </div>
      <img class="view-header-deco" src="Anchor_Logo_Vertical_High.png" alt="" draggable="false" />
    </div>

    <div class="settings-section">
      <div class="section-title">Step 1 — Select Invoice</div>
      <p class="field-hint" style="margin-bottom:12px">Load a Kaseya invoice from SharePoint. Select the year folder, then choose the invoice file.</p>
      <div style="display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <div style="display:flex;flex-direction:column;gap:4px">
          <label style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.06em">Year</label>
          <select id="kp-sp-year" class="field-input" style="min-width:110px;color-scheme:dark;background:var(--surface-2);color:var(--text)">
            <option value="">Loading…</option>
          </select>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex:1;min-width:240px">
          <label style="font-size:11px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.06em">Invoice File</label>
          <select id="kp-sp-file" class="field-input" style="min-width:240px;max-width:500px;color-scheme:dark;background:var(--surface-2);color:var(--text)" disabled>
            <option value="">— select year first —</option>
          </select>
        </div>
        <button class="btn btn-primary" id="kp-process-btn" disabled>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style="margin-right:4px"><path d="M2 2.5l9 4-9 4V2.5z" fill="currentColor"/></svg>
          Process Invoice
        </button>
        <span id="kp-status" class="save-status"></span>
      </div>
    </div>

    <div id="kp-results" style="display:none">
      <!-- Metric strip -->
      <div class="metric-strip" id="kp-metrics" style="margin-bottom:16px"></div>

      <!-- Org mapping panel (admin only, injected by renderKaseyaOrgMapping) -->
      <div id="kp-org-mapping"></div>

      <!-- Action bar -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap">
        <button class="btn btn-primary" id="kp-export-btn">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style="margin-right:4px"><path d="M1 10v1.5a.5.5 0 00.5.5h10a.5.5 0 00.5-.5V10M6.5 1v8M4 6.5L6.5 9 9 6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Export Excel
        </button>
        <button class="btn btn-ghost" id="kp-clear-btn">Clear Invoice</button>
        <span id="kp-export-status" class="save-status"></span>
      </div>

      <!-- Data cards grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(460px,1fr));gap:16px;margin-bottom:16px">

        <!-- QBO Journal Entries — full width -->
        <div class="settings-section wide" style="grid-column:1/-1">
          <div class="section-title">QBO Journal Entries</div>
          <p class="field-hint" style="margin-bottom:10px">Enter these as a journal entry in QuickBooks.</p>
          <div id="kp-qbo-table" style="overflow-x:auto"></div>
        </div>

        <!-- Totals by Module -->
        <div class="settings-section">
          <div class="section-title">Totals by Module</div>
          <div id="kp-module-table"></div>
        </div>

        <!-- Totals by Category -->
        <div class="settings-section">
          <div class="section-title">Totals by Category</div>
          <div id="kp-category-table"></div>
        </div>

        <!-- Anchor Tools -->
        <div class="settings-section">
          <div class="section-title">Anchor Tools</div>
          <div id="kp-anchor-tools-table"></div>
        </div>

        <!-- Datto Backup & Networking -->
        <div class="settings-section">
          <div class="section-title">Datto Backup &amp; Networking</div>
          <div id="kp-backup-table"></div>
        </div>

        <!-- Datto Workplace Costs -->
        <div class="settings-section">
          <div class="section-title">Datto Workplace Costs</div>
          <div id="kp-workplace-costs-table"></div>
        </div>

        <!-- Datto Workplace Usage -->
        <div class="settings-section wide" style="grid-column:1/-1">
          <div class="section-title" style="display:flex;align-items:center;justify-content:space-between">
            <span>Datto Workplace Usage</span>
            <button class="btn btn-ghost btn-sm" id="kp-dwp-push-btn" style="display:none">Push to AT</button>
          </div>
          <div id="kp-workplace-usage-table"></div>
        </div>

        <!-- Datto SaaS Usage -->
        <div class="settings-section">
          <div class="section-title" style="display:flex;align-items:center;justify-content:space-between">
            <span>Datto SaaS Usage</span>
            <button class="btn btn-ghost btn-sm" id="kp-saas-push-btn" style="display:none">Push to AT</button>
          </div>
          <div id="kp-saas-table"></div>
        </div>

        <!-- Datto Networking -->
        <div class="settings-section">
          <div class="section-title">Datto Networking</div>
          <div id="kp-networking-table"></div>
        </div>

        <!-- Datto BCDR -->
        <div class="settings-section">
          <div class="section-title">Datto BCDR</div>
          <div id="kp-bcdr-table"></div>
        </div>

        <!-- Totals by Client — full width, bottom -->
        <div class="settings-section wide" style="grid-column:1/-1">
          <div class="section-title">Totals by Client</div>
          <div id="kp-client-table" style="overflow-x:auto"></div>
        </div>

      </div>
    </div>

    <!-- Delta Comparison — loads available SP invoice files -->
    <div class="settings-section wide" id="kp-delta-section" style="display:none">
      <div class="section-title">Invoice Delta Comparison</div>
      <p class="field-hint" style="margin-bottom:12px">Compare any two SharePoint invoices to see what changed — new clients, dropped clients, cost increases, quantity shifts.</p>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        <div style="display:flex;flex-direction:column;gap:4px">
          <label style="font-size:11px;color:var(--text-muted)">Baseline (Month A)</label>
          <select id="kp-delta-a" class="field-input" style="min-width:200px;color-scheme:dark;background:var(--surface-2);color:var(--text)"><option value="">— select month —</option></select>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <label style="font-size:11px;color:var(--text-muted)">Compare (Month B)</label>
          <select id="kp-delta-b" class="field-input" style="min-width:200px;color-scheme:dark;background:var(--surface-2);color:var(--text)"><option value="">— select month —</option></select>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px">
          <label style="font-size:11px;color:transparent">run</label>
          <button class="btn btn-primary" id="kp-delta-run-btn">Compare</button>
        </div>
        <span id="kp-delta-status" class="save-status"></span>
      </div>
      <div id="kp-delta-results"></div>
    </div>
  `;

  let _spSelectedFileId = null;
  let _spSelectedFileName = null;

  // Load SP year list on open
  (async () => {
    const yearSel = document.getElementById('kp-sp-year');
    try {
      const res = await window.api.kaseyaSpListYears();
      yearSel.innerHTML = '';
      if (!res?.ok) {
        const msg = res?.error || 'Unknown error';
        yearSel.innerHTML = `<option value="">(SP error: ${escHtml(msg)})</option>`;
        return;
      }
      const years = res.years || [];
      if (!years.length) {
        yearSel.innerHTML = '<option value="">(no year folders found)</option>';
        return;
      }
      const blank = document.createElement('option'); blank.value = ''; blank.textContent = '— select year —'; yearSel.appendChild(blank);
      years.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; yearSel.appendChild(o); });
    } catch (e) {
      yearSel.innerHTML = `<option value="">(error: ${escHtml(e.message)})</option>`;
    }
  })();

  document.getElementById('kp-sp-year').addEventListener('change', async function () {
    const year = this.value;
    const fileSel = document.getElementById('kp-sp-file');
    const processBtn = document.getElementById('kp-process-btn');
    _spSelectedFileId = null;
    _spSelectedFileName = null;
    processBtn.disabled = true;
    fileSel.disabled = true;
    fileSel.innerHTML = '<option value="">Loading…</option>';
    if (!year) { fileSel.innerHTML = '<option value="">— select year first —</option>'; return; }
    try {
      const res = await window.api.kaseyaSpListFiles({ year });
      const files = res?.files || [];
      fileSel.innerHTML = '<option value="">— select invoice —</option>';
      // Load cached snapshots to show grand total alongside the date label
      const snapList = await window.api.getKaseyaSnapshots().catch(() => []);
      const snapTotals = new Map((snapList || []).map(s => [s.invoiceDate?.slice(0, 7), s.grandTotal]));
      const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
      files.forEach(f => {
        const o = document.createElement('option');
        o.value = f.driveItemId;
        o.dataset.name = f.name;
        const dm = f.name.match(/_(\d{4})(\d{2})(\d{2})/);
        if (dm) {
          const [, yr, mo] = dm;
          const label = `${MONTHS[parseInt(mo, 10) - 1]} ${yr}`;
          const gt = snapTotals.get(`${yr}-${mo}`);
          o.textContent = gt != null ? `${label} — $${gt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : label;
        } else {
          o.textContent = f.name;
        }
        fileSel.appendChild(o);
      });
      fileSel.disabled = false;
    } catch (e) {
      fileSel.innerHTML = `<option value="">(error: ${escHtml(e.message)})</option>`;
    }
  });

  document.getElementById('kp-sp-file').addEventListener('change', function () {
    const opt = this.options[this.selectedIndex];
    _spSelectedFileId = this.value || null;
    _spSelectedFileName = opt?.dataset?.name || null;
    document.getElementById('kp-process-btn').disabled = !_spSelectedFileId;
  });

  document.getElementById('kp-process-btn').addEventListener('click', async () => {
    const status = document.getElementById('kp-status');
    status.textContent = 'Downloading & processing…'; status.className = 'save-status';
    document.getElementById('kp-process-btn').disabled = true;
    try {
      const data = await window.api.kaseyaSpProcessFile({ driveItemId: _spSelectedFileId, fileName: _spSelectedFileName });
      if (!data.success) throw new Error(data.error || 'Processing failed');
      _kaseyaData = data;
      renderKaseyaResults(data);
      saveToolStat('kaseya-processor', `${data.clients ? data.clients.length : 0} clients · ${data.totalLines || 0} rows`, 'ok');
      status.textContent = '✓ Done'; status.className = 'save-status success';
    } catch (e) {
      status.textContent = `Error: ${e.message}`; status.className = 'save-status error';
    } finally {
      document.getElementById('kp-process-btn').disabled = !_spSelectedFileId;
    }
  });

  // Restore previous invoice if still in session
  if (_kaseyaData) {
    renderKaseyaResults(_kaseyaData);
    const st = document.getElementById('kp-status');
    if (st) { st.textContent = `✓ ${_kaseyaData.fileName || 'Invoice loaded'}`; st.className = 'save-status success'; }
  }

  // Load delta section on tool open (show available snapshots even before processing)
  kpLoadDeltaSection(null);
}

function renderKaseyaResults(data) {
  const resultsEl = document.getElementById('kp-results');
  if (!resultsEl) return;
  resultsEl.style.display = '';

  // Wire Clear button every time results are shown (safe to re-wire — replaces prior listener)
  const clearBtn = document.getElementById('kp-clear-btn');
  if (clearBtn) {
    const newClear = clearBtn.cloneNode(true);
    clearBtn.replaceWith(newClear);
    newClear.addEventListener('click', () => { _kaseyaData = null; renderKaseyaProcessor(); });
  }
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

  // Blank module / blank category warnings
  const existingWarn = document.getElementById('kp-parse-warnings');
  if (existingWarn) existingWarn.remove();
  const blankMods  = data.blankModuleRows  || [];
  const blankCats  = data.blankCategoryCount || 0;
  if (blankMods.length || blankCats) {
    const warnEl = document.createElement('div');
    warnEl.id = 'kp-parse-warnings';
    warnEl.style.cssText = 'margin-bottom:14px;display:flex;flex-direction:column;gap:6px';
    if (blankMods.length) {
      const rows = blankMods.map(r =>
        `<li style="margin:0;padding:2px 0">${escHtml(r.company)} — <em>${escHtml(r.desc)}</em> (${fmtAmt(r.total)})</li>`
      ).join('');
      warnEl.innerHTML += `<div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.35);border-radius:6px;padding:10px 14px;font-size:12px">
        <span style="font-weight:600;color:var(--error)">⚠ ${blankMods.length} row${blankMods.length > 1 ? 's' : ''} skipped — blank module (not matched by fallback rules)</span>
        <ul style="margin:6px 0 0;padding-left:18px;color:var(--text-muted)">${rows}</ul>
      </div>`;
    }
    if (blankCats) {
      warnEl.innerHTML += `<div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:6px;padding:8px 14px;font-size:12px;color:rgba(245,158,11,.9)">
        ⚠ ${blankCats} row${blankCats > 1 ? 's' : ''} have a blank Category — they are included in totals but won't appear in the category breakdown.
      </div>`;
    }
    metricsEl.after(warnEl);
  }

  // QBO table
  const qboEl = document.getElementById('kp-qbo-table');
  kpRenderQboTable(qboEl, data.qboEntries || []);

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

  // Product list table builder (name, qty, avgRate, total)
  const buildProductTable = (rows) => {
    if (!rows || !rows.length) return '<p class="field-hint">No data.</p>';
    const thS = 'padding:8px 10px;text-align:left;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.65);white-space:nowrap';
    const gt = rows.reduce((s, r) => s + (r.total || 0), 0);
    return `<table style="width:100%;border-collapse:collapse;font-size:12.5px">
      <thead><tr style="background:rgba(45,77,107,.75)">
        <th style="${thS}">Product</th>
        <th style="${thS};text-align:right">Qty</th>
        <th style="${thS};text-align:right">Avg Rate</th>
        <th style="${thS};text-align:right">Total</th>
      </tr></thead>
      <tbody>
        ${rows.map((r, i) => `<tr style="border-top:1px solid rgba(255,255,255,.06);${i%2===1?'background:rgba(255,255,255,.025)':''}">
          <td style="padding:7px 10px">${escHtml(r.name)}</td>
          <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono)">${r.qty}</td>
          <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono)">${r.avgRate ? fmtAmt(r.avgRate) : '—'}</td>
          <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono);font-weight:600">${fmtAmt(r.total)}</td>
        </tr>`).join('')}
      </tbody>
      <tfoot><tr style="border-top:2px solid rgba(45,77,107,.6);background:rgba(45,77,107,.2)">
        <td colspan="3" style="padding:8px 10px;font-weight:700">Total</td>
        <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-weight:700">${fmtAmt(gt)}</td>
      </tr></tfoot>
    </table>`;
  };

  // Totals by Client
  const clientTableEl = document.getElementById('kp-client-table');
  if (clientTableEl) {
    const clients = data.clients || [];
    if (!clients.length) {
      clientTableEl.innerHTML = '<p class="field-hint">No client data.</p>';
    } else {
      const EXCLUDED_MODS  = new Set(['IT Glue', 'ITGlue', 'PSA', 'RMM']);
      const USAGE_QTY_MODS = new Set(['SaaS Protection', 'DWP', 'DFP']);
      const rawMods = [...new Set(clients.flatMap(c => Object.keys(c.modules || {})))].sort();
      // Merge Azure Cloud Siris → BCDR; exclude IT Glue / PSA / RMM
      const allMods = rawMods.filter(m => !EXCLUDED_MODS.has(m) && m !== 'Azure Cloud Siris');
      // Ensure BCDR column exists if Azure Cloud Siris contributed
      if (!allMods.includes('BCDR') && rawMods.includes('Azure Cloud Siris')) {
        const idx = allMods.findIndex(m => m > 'BCDR');
        allMods.splice(idx === -1 ? allMods.length : idx, 0, 'BCDR');
      }
      const getModValue = (c, m) => {
        if (m === 'BCDR') {
          const t = (c.modules?.['BCDR']?.total || 0) + (c.modules?.['Azure Cloud Siris']?.total || 0);
          return t ? fmtAmt(t) : '—';
        }
        if (USAGE_QTY_MODS.has(m)) {
          const lq = c.modules?.[m]?.licenseQty || 0;
          return lq ? lq : '—';
        }
        return c.modules?.[m] ? fmtAmt(c.modules[m].total) : '—';
      };
      const thS = 'padding:8px 10px;text-align:left;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.65);white-space:nowrap';
      const gt = clients.reduce((s, c) => s + (c.total || 0), 0);
      clientTableEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:rgba(45,77,107,.75)">
          <th style="${thS}">Client</th>
          ${allMods.map(m => `<th style="${thS};text-align:right">${escHtml(m)}</th>`).join('')}
          <th style="${thS};text-align:right">Total</th>
        </tr></thead>
        <tbody>
          ${clients.map((c, i) => `<tr style="border-top:1px solid rgba(255,255,255,.06);${i%2===1?'background:rgba(255,255,255,.025)':''}">
            <td style="padding:7px 10px;white-space:nowrap">${escHtml(c.name)}</td>
            ${allMods.map(m => `<td style="padding:7px 10px;text-align:right;font-family:var(--font-mono);font-size:11px;color:var(--text-muted)">${getModValue(c, m)}</td>`).join('')}
            <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono);font-weight:600">${fmtAmt(c.total)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr style="border-top:2px solid rgba(45,77,107,.6);background:rgba(45,77,107,.2)">
          <td colspan="${allMods.length + 1}" style="padding:8px 10px;font-weight:700">Total</td>
          <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-weight:700">${fmtAmt(gt)}</td>
        </tr></tfoot>
      </table>`;
    }
  }

  // Anchor Tools
  const anchorToolsEl = document.getElementById('kp-anchor-tools-table');
  if (anchorToolsEl) anchorToolsEl.innerHTML = buildProductTable(data.anchorTools);

  // Datto Backup & Networking
  const backupEl = document.getElementById('kp-backup-table');
  if (backupEl) backupEl.innerHTML = buildProductTable(data.backupProducts);

  // Datto Workplace Costs
  const wpCostsEl = document.getElementById('kp-workplace-costs-table');
  if (wpCostsEl) wpCostsEl.innerHTML = buildProductTable(data.workplaceProducts);

  // Datto Workplace Usage — per-client cross-tab, fixed column order, bundle-aware
  const wpUsageEl = document.getElementById('kp-workplace-usage-table');
  if (wpUsageEl) {
    (async () => {
      let workplaceBundles = [];
      try { const s = await window.api.getKaseyaSettings(); workplaceBundles = s.workplaceBundles || []; } catch {}

      const usage     = (data.workplaceUsage || []).filter(u => Object.values(u.products || {}).some(v => v > 0));
      const allProds  = new Set((data.workplaceProductNames || []).concat(usage.flatMap(u => Object.keys(u.products || {}))));
      const COL_ORDER = [
        'DWP Metered Plan - User License', 'DWP Unlimited Plan - User License',
        'DWP Metered Plan - Server License', 'DWP Unlimited Plan - Server License',
        'DFP Unlimited Plan - Laptop/Desktop License', 'DFP Unlimited Plan - Server License',
      ];
      const prodNames = COL_ORDER.filter(c => allProds.has(c));
      for (const p of allProds) { if (!prodNames.includes(p)) prodNames.push(p); }

      if (!usage.length) { wpUsageEl.innerHTML = '<p class="field-hint">No workplace usage data.</p>'; return; }

      // Group bundles by client (keyed lowercase) — each client can have multiple per-product bundles
      const bundlesByClient = new Map();
      for (const b of workplaceBundles) {
        const key = b.client.toLowerCase().trim();
        if (!bundlesByClient.has(key)) bundlesByClient.set(key, []);
        bundlesByClient.get(key).push(b);
      }
      const hasBundles = workplaceBundles.length > 0;

      // Per-client billable helper: deduct each bundle from its specific product
      const clientBillable = (u) => {
        const cbs = bundlesByClient.get(u.client.toLowerCase().trim()) || [];
        return prodNames.reduce((s, p) => {
          const pb = cbs.find(b => b.product === p);
          return s + Math.max(0, (u.products?.[p] || 0) - (pb?.bundledSeats || 0));
        }, 0);
      };
      const clientBundledTotal = (u) => {
        const cbs = bundlesByClient.get(u.client.toLowerCase().trim()) || [];
        return cbs.reduce((s, b) => s + (b.bundledSeats || 0), 0);
      };

      const thBase = 'padding:8px 12px;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.65)';
      const thL    = `${thBase};text-align:left;white-space:nowrap`;
      const thR    = `${thBase};text-align:right;white-space:normal;min-width:90px;max-width:120px;line-height:1.3;vertical-align:bottom`;

      wpUsageEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed">
        <thead><tr style="background:rgba(45,77,107,.75)">
          <th style="${thL};width:200px">Client</th>
          ${prodNames.map(p => `<th style="${thR}">${escHtml(p)}</th>`).join('')}
          <th style="${thBase};text-align:right;white-space:nowrap;width:80px;vertical-align:bottom">Total</th>
          ${hasBundles ? `<th style="${thBase};text-align:right;white-space:nowrap;width:70px;vertical-align:bottom;color:rgba(130,200,130,.8)">Bundle</th>
          <th style="${thBase};text-align:right;white-space:nowrap;width:75px;vertical-align:bottom;color:rgba(100,180,255,.8)">Billable</th>` : ''}
        </tr></thead>
        <tbody>
          ${usage.map((u, i) => {
            const rowTotal = prodNames.reduce((s, p) => s + (u.products?.[p] || 0), 0);
            const bundled  = clientBundledTotal(u);
            const billable = clientBillable(u);
            return `<tr style="border-top:1px solid rgba(255,255,255,.06);${i%2===1?'background:rgba(255,255,255,.025)':''}">
              <td style="padding:7px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(u.client)}</td>
              ${prodNames.map(p => `<td style="padding:7px 12px;text-align:right;font-family:var(--font-mono)">${u.products?.[p] || '—'}</td>`).join('')}
              <td style="padding:7px 12px;text-align:right;font-family:var(--font-mono);font-weight:600">${rowTotal}</td>
              ${hasBundles ? `<td style="padding:7px 12px;text-align:right;font-family:var(--font-mono);color:rgba(130,200,130,.8)">${bundled || '—'}</td>
              <td style="padding:7px 12px;text-align:right;font-family:var(--font-mono);font-weight:600;${bundled ? 'color:rgba(100,180,255,.9)' : ''}">${billable}</td>` : ''}
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot><tr style="border-top:2px solid rgba(45,77,107,.6);background:rgba(45,77,107,.2)">
          <td style="padding:8px 12px;font-weight:700">Total</td>
          ${prodNames.map(p => `<td style="padding:8px 12px;text-align:right;font-family:var(--font-mono);font-weight:700">${usage.reduce((s, u) => s + (u.products?.[p] || 0), 0)}</td>`).join('')}
          <td style="padding:8px 12px;text-align:right;font-family:var(--font-mono);font-weight:700">${usage.reduce((s, u) => s + prodNames.reduce((ss, p) => ss + (u.products?.[p] || 0), 0), 0)}</td>
          ${hasBundles ? `<td style="padding:8px 12px;text-align:right;font-family:var(--font-mono);font-weight:700;color:rgba(130,200,130,.8)">${usage.reduce((s, u) => s + clientBundledTotal(u), 0)}</td>
          <td style="padding:8px 12px;text-align:right;font-family:var(--font-mono);font-weight:700;color:rgba(100,180,255,.9)">${usage.reduce((s, u) => s + clientBillable(u), 0)}</td>` : ''}
        </tr></tfoot>
      </table>`;

      const dwpPushBtn = document.getElementById('kp-dwp-push-btn');
      if (dwpPushBtn) {
        dwpPushBtn.style.display = '';
        dwpPushBtn.onclick = () => kpPushAtWorkplace(data, workplaceBundles);
      }
    })();
  }

  // Datto SaaS Usage — with bundled toggle backed by hub directory + Revenue SP file
  const saasEl = document.getElementById('kp-saas-table');
  if (saasEl) {
    const saas = (data.saasCosts || []).filter(r => r.qty > 0);
    if (!saas.length) {
      saasEl.innerHTML = '<p class="field-hint">No SaaS Protection data.</p>';
    } else {
      const clientMap = new Map((data.clients || []).map(c => [c.name.toLowerCase().trim(), c]));
      let _revBundles       = null;
      let _saasBundled      = {};
      let _saasQtyOverride  = {};
      let _hubLoaded        = false;

      const renderSaasTable = () => {
        const loaded = _revBundles !== null;
        const thS    = 'padding:8px 10px;text-align:left;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.65);white-space:nowrap';
        const totalQty = saas.reduce((s, r) => s + (r.qty || 0), 0);
        let totalBillable = 0;

        const bodyRows = saas.map((r, i) => {
          const match       = clientMap.get(r.name.toLowerCase().trim());
          const atId        = match?.atId;
          const isBundled   = !!(atId && _saasBundled[atId]);
          const autoQty     = isBundled && loaded ? kpMatchRevenueBundles(r.name, match?.atName, _revBundles) : null;
          const overrideQty = atId != null ? _saasQtyOverride[atId] : undefined;
          const hasOverride = overrideQty != null;
          const bundledQty  = hasOverride ? overrideQty : autoQty;
          const billable    = bundledQty != null ? Math.max(0, r.qty - bundledQty) : r.qty;
          totalBillable    += billable;
          const cbDisabled  = !atId ? 'disabled title="No AT mapping"' : (!_hubLoaded ? 'disabled title="Loading…"' : '');
          const qtyColor    = hasOverride ? 'rgba(255,200,60,.95)' : 'rgba(255,255,255,.45)';
          const editBtn     = hasOverride
            ? `<button class="kp-saas-qty-clear" data-atid="${atId}" title="Clear override" style="margin-left:5px;background:none;border:none;color:rgba(255,200,60,.7);cursor:pointer;font-size:11px;padding:0;vertical-align:middle">✕</button>`
            : `<button class="kp-saas-qty-edit" data-atid="${atId}" data-current="${bundledQty ?? ''}" title="Override bundled qty" style="margin-left:5px;background:none;border:none;color:rgba(255,255,255,.25);cursor:pointer;font-size:10px;padding:0;vertical-align:middle">✎</button>`;
          return `<tr style="border-top:1px solid rgba(255,255,255,.06);${i%2===1?'background:rgba(255,255,255,.025)':''}">
            <td style="padding:7px 10px">${escHtml(r.name)}</td>
            <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono);font-weight:600">${r.qty}</td>
            <td style="padding:7px 10px;text-align:center">
              <input type="checkbox" class="kp-saas-bundle-toggle" data-atid="${atId || ''}" ${isBundled ? 'checked' : ''} ${cbDisabled} style="cursor:${!atId || !_hubLoaded ? 'default' : 'pointer'};width:14px;height:14px">
            </td>
            ${loaded ? `
            <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono)">
              ${isBundled ? `<span style="color:${qtyColor}">${bundledQty != null ? bundledQty : '—'}</span>${editBtn}` : '<span style="color:rgba(255,255,255,.3)">—</span>'}
            </td>
            <td style="padding:7px 10px;text-align:right;font-family:var(--font-mono);font-weight:600;${isBundled && bundledQty != null && billable < r.qty ? 'color:rgba(100,180,255,.9)' : ''}">${isBundled && bundledQty != null ? billable : r.qty}</td>` : ''}
          </tr>`;
        }).join('');

        saasEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12.5px">
          <thead><tr style="background:rgba(45,77,107,.75)">
            <th style="${thS}">Client</th>
            <th style="${thS};text-align:right">Invoice Qty</th>
            <th style="${thS};text-align:center">Bundled?</th>
            ${loaded ? `<th style="${thS};text-align:right">Bundled Qty</th>
            <th style="${thS};text-align:right;color:rgba(100,180,255,.8)">Billable</th>` : ''}
          </tr></thead>
          <tbody>${bodyRows}</tbody>
          <tfoot><tr style="border-top:2px solid rgba(45,77,107,.6);background:rgba(45,77,107,.2)">
            <td style="padding:8px 10px;font-weight:700">Total</td>
            <td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-weight:700">${totalQty}</td>
            <td></td>
            ${loaded ? `<td></td><td style="padding:8px 10px;text-align:right;font-family:var(--font-mono);font-weight:700;color:rgba(100,180,255,.9)">${totalBillable}</td>` : ''}
          </tr></tfoot>
        </table>`;

        saasEl.querySelectorAll('.kp-saas-bundle-toggle').forEach(cb => {
          cb.addEventListener('change', async () => {
            const atId = parseInt(cb.dataset.atid, 10);
            if (!atId) return;
            cb.disabled = true;
            const res = await window.api.kaseyaSetSaasBundled({ atId, bundled: cb.checked }).catch(() => ({ ok: false, error: 'Network error' }));
            if (res.ok) {
              if (cb.checked) _saasBundled[atId] = true; else delete _saasBundled[atId];
              renderSaasTable();
              // Brief save confirmation
              const msg = Object.assign(document.createElement('span'), {
                textContent: cb.checked ? '✓ Marked bundled' : '✓ Unmarked',
                style: 'position:fixed;bottom:24px;right:24px;background:rgba(30,60,90,.95);color:rgba(100,220,130,1);border:1px solid rgba(100,220,130,.3);border-radius:6px;padding:8px 14px;font-size:12px;z-index:9999;pointer-events:none',
              });
              document.body.appendChild(msg);
              setTimeout(() => msg.remove(), 2500);
            } else {
              cb.checked = !cb.checked;
              cb.disabled = false;
              alert(`Save failed: ${res.error || 'Unknown error'}`);
            }
          });
        });

        // Qty override — pencil edit
        saasEl.querySelectorAll('.kp-saas-qty-edit').forEach(btn => {
          btn.addEventListener('click', () => {
            const atIdVal = parseInt(btn.dataset.atid, 10);
            const td = btn.closest('td');
            td.innerHTML = `<input type="number" min="0" value="${btn.dataset.current}" data-atid="${atIdVal}"
              style="width:54px;background:rgba(0,0,0,.5);border:1px solid rgba(255,200,60,.5);border-radius:4px;
              color:#fff;padding:2px 5px;font-family:var(--font-mono);font-size:12px;text-align:right">`;
            const inp = td.querySelector('input');
            inp.focus(); inp.select();
            let done = false;
            const save = async () => {
              if (done) return; done = true;
              const qty = parseInt(inp.value, 10);
              if (!isNaN(qty) && qty >= 0) {
                const res = await window.api.kaseyaSetSaasQtyOverride({ atId: atIdVal, qty }).catch(() => ({ ok: false }));
                if (res.ok) _saasQtyOverride[atIdVal] = qty;
              }
              renderSaasTable();
            };
            inp.addEventListener('keydown', e => {
              if (e.key === 'Enter') inp.blur();
              if (e.key === 'Escape') { done = true; renderSaasTable(); }
            });
            inp.addEventListener('blur', save);
          });
        });

        // Qty override — clear
        saasEl.querySelectorAll('.kp-saas-qty-clear').forEach(btn => {
          btn.addEventListener('click', async () => {
            const atIdVal = parseInt(btn.dataset.atid, 10);
            const res = await window.api.kaseyaSetSaasQtyOverride({ atId: atIdVal, qty: null }).catch(() => ({ ok: false }));
            if (res.ok) delete _saasQtyOverride[atIdVal];
            renderSaasTable();
          });
        });

        const saasPushBtn = document.getElementById('kp-saas-push-btn');
        if (saasPushBtn) {
          saasPushBtn.style.display = '';
          saasPushBtn.onclick = () => kpPushAtSaas(data, loaded ? _revBundles : null, loaded ? _saasBundled : null, _saasQtyOverride);
        }
      };

      renderSaasTable();

      window.api.kaseyaLoadRevenueBundles().then(res => {
        // Hub flags always come back — enables checkboxes even if revenue file failed
        _saasBundled     = res.saasBundled || {};
        _saasQtyOverride = res.saasBundledQtyOverride || {};
        _hubLoaded       = true;
        if (res.ok) _revBundles = res.revenueBundles;
        renderSaasTable();
        if (!res.ok) {
          console.warn('[Kaseya] Revenue file load failed:', res.error);
          const warn = document.createElement('p');
          warn.style.cssText = 'margin:6px 0 0;font-size:11px;color:rgba(255,180,60,.8)';
          warn.textContent = `Revenue file unavailable — Bundled Qty/Billable columns hidden. (${res.error || 'Unknown error'})`;
          saasEl.appendChild(warn);
        }

        // Update SaaS QBO entries with actual bundled amounts (rate × bundled seats)
        if (!res.ok) return;
        const r2 = v => Math.round(v * 100) / 100;
        const totalSaasQty = saas.reduce((s, r) => s + r.qty, 0);
        const totalSaasAmt = data.modules?.['SaaS Protection']?.total || 0;
        if (totalSaasQty > 0 && totalSaasAmt !== 0) {
          const rate = totalSaasAmt / totalSaasQty;
          let saasBundledAmt = 0;
          for (const r of saas) {
            const match = clientMap.get(r.name.toLowerCase().trim());
            const atId  = match?.atId;
            if (!atId || !_saasBundled[atId]) continue;
            const bQty = (_saasQtyOverride[atId] != null)
              ? _saasQtyOverride[atId]
              : (kpMatchRevenueBundles(r.name, match?.atName, _revBundles) || 0);
            saasBundledAmt += Math.min(bQty, r.qty) * rate;
          }
          saasBundledAmt = r2(saasBundledAmt);
          if (saasBundledAmt > 0) {
            data.qboEntries = (data.qboEntries || []).filter(e => !e.description.startsWith('Datto SaaS'));
            data.qboEntries.push(
              { description: 'Datto SaaS – Standalone', amount: r2(totalSaasAmt - saasBundledAmt), account: 'Cost of Services-Recurring Svcs:Managed Cloud Services:Cloud Email Management', class: '' },
              { description: 'Datto SaaS – Bundled',    amount: saasBundledAmt,                    account: 'Cost of Services-Recurring Svcs:Managed IT Services:Cloud Email Management-Bundled', class: '' },
            );
            const qboEl = document.getElementById('kp-qbo-table');
            if (qboEl) kpRenderQboTable(qboEl, data.qboEntries);
          }
        }
      }).catch(() => {});
    }
  }

  // Datto Networking
  const netEl = document.getElementById('kp-networking-table');
  if (netEl) netEl.innerHTML = buildProductTable(data.networkingProducts);

  // Datto BCDR — per-client costs
  const bcdrEl = document.getElementById('kp-bcdr-table');
  if (bcdrEl) {
    const bcdr = data.bcdrCosts || [];
    if (!bcdr.length) {
      bcdrEl.innerHTML = '<p class="field-hint">No BCDR data.</p>';
    } else {
      const gt = bcdr.reduce((s, r) => s + (r.total || 0), 0);
      bcdrEl.innerHTML = buildBarTable(bcdr.map(r => ({ name: r.name, val: r.total })), gt);
    }
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

  // Org mapping event delegation — wired once per results view lifetime
  const resultsContainer = document.getElementById('kp-results');
  if (resultsContainer && !resultsContainer._kpOrgDelegated) {
    resultsContainer._kpOrgDelegated = true;
    resultsContainer.addEventListener('click', async e => {
      const findBtn = e.target.closest('.kp-org-find-btn');
      if (findBtn) {
        const key  = findBtn.dataset.key;
        const wrap = document.getElementById(`kp-find-${key}`);
        if (!wrap) return;
        const isOpen = !wrap.classList.contains('hidden');
        wrap.classList.toggle('hidden', isOpen);
        if (!isOpen) {
          const input = wrap.querySelector('.kp-find-input');
          if (input) { input.focus(); input.select(); kpSearchAt(input, wrap, findBtn.dataset.name); }
        }
        return;
      }

      // Accept a single auto-suggested match
      const acceptBtn = e.target.closest('.kp-org-accept-btn');
      if (acceptBtn) {
        const name   = acceptBtn.dataset.name;
        const atId   = parseInt(acceptBtn.dataset.atid, 10);
        const atName = acceptBtn.dataset.atname;
        acceptBtn.disabled = true; acceptBtn.textContent = 'Saving…';
        try {
          const r = await window.api.kaseyaConfirmMatch({ kaseyaName: name, atId, atName });
          if (!r?.ok) throw new Error(r?.error || 'Save failed');
          if (_kaseyaData?.clients) {
            const c = _kaseyaData.clients.find(x => x.name === name);
            if (c) { c.atId = atId; c.atName = atName; }
          }
          renderKaseyaOrgMapping(_kaseyaData?.clients);
        } catch (e) { acceptBtn.disabled = false; acceptBtn.textContent = `Retry (${e.message.slice(0,40)})`; }
        return;
      }

      const matchItem = e.target.closest('.kp-match-item');
      if (matchItem) {
        const kaseyaName = matchItem.dataset.kaseyaname;
        const atId   = parseInt(matchItem.dataset.atid, 10);
        const atName = matchItem.dataset.atname;
        matchItem.textContent = 'Saving…';
        try {
          const r = await window.api.kaseyaConfirmMatch({ kaseyaName, atId, atName });
          if (!r?.ok) throw new Error(r?.error || 'Save failed');
          if (_kaseyaData?.clients) {
            const c = _kaseyaData.clients.find(x => x.name === kaseyaName);
            if (c) { c.atId = atId; c.atName = atName; }
          }
          renderKaseyaOrgMapping(_kaseyaData?.clients);
        } catch (e) { matchItem.textContent = `⚠ ${e.message.slice(0,40)} — click to retry`; matchItem.style.color = 'var(--warning)'; }
        return;
      }

      const excBtn = e.target.closest('.kp-org-exclude-btn');
      if (excBtn) {
        const name = excBtn.dataset.name;
        excBtn.disabled = true; excBtn.textContent = '…';
        try {
          await window.api.kaseyaSetExcluded({ kaseyaName: name, excluded: true });
          if (_kaseyaData?.clients) {
            const c = _kaseyaData.clients.find(x => x.name === name);
            if (c) c._excluded = true;
          }
          renderKaseyaOrgMapping(_kaseyaData?.clients);
        } catch { excBtn.disabled = false; excBtn.textContent = 'Exclude'; }
        return;
      }

      const restoreBtn = e.target.closest('.kp-org-restore-btn');
      if (restoreBtn) {
        const name = restoreBtn.dataset.name;
        restoreBtn.disabled = true; restoreBtn.textContent = '…';
        try {
          await window.api.kaseyaSetExcluded({ kaseyaName: name, excluded: false });
          if (_kaseyaData?.clients) {
            const c = _kaseyaData.clients.find(x => x.name === name);
            if (c) delete c._excluded;
          }
          renderKaseyaOrgMapping(_kaseyaData?.clients);
        } catch { restoreBtn.disabled = false; restoreBtn.textContent = 'Restore'; }
        return;
      }
    });
  }
  renderKaseyaOrgMapping(data.clients);

  // Load delta section after snapshot auto-save has completed
  kpLoadDeltaSection(data.snapKey);
}

// ── Kaseya org mapping panel ──────────────────────────────────────────────────
async function renderKaseyaOrgMapping(clients) {
  const el = document.getElementById('kp-org-mapping');
  if (!el) return;

  const isAdmin = _currentUser?.isAdmin || _currentUser?.roles?.includes('hub.admin');
  if (!isAdmin) { el.innerHTML = ''; return; }

  const allClients = (clients || []).filter(c => c.name && c.name !== '(blank)');
  const withoutAtId = allClients.filter(c => !c.atId);
  if (!withoutAtId.length) { el.innerHTML = ''; return; }

  // Load excluded state from hub (non-fatal)
  const hubExcluded = new Set();
  try {
    const mappings = await window.api.kaseyaLoadMappings();
    if (mappings?.excluded) {
      for (const [name, val] of Object.entries(mappings.excluded)) {
        if (val) hubExcluded.add((name || '').toLowerCase().trim());
      }
    }
  } catch (_) {}

  const needsMapping = withoutAtId.filter(c => !hubExcluded.has((c.name || '').toLowerCase().trim()) && !c._excluded);
  const excludedOrgs = withoutAtId.filter(c =>  hubExcluded.has((c.name || '').toLowerCase().trim()) ||  c._excluded);

  if (!needsMapping.length && !excludedOrgs.length) { el.innerHTML = ''; return; }

  // Show a loading state while suggestions are fetched
  const warnIcon = `<svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1L1 13h12L7 1z" stroke="var(--warn)" stroke-width="1.3" stroke-linejoin="round"/><path d="M7 6v3M7 10.5v.5" stroke="var(--warn)" stroke-width="1.4" stroke-linecap="round"/></svg>`;
  el.innerHTML = `
    <div class="settings-section wide" style="padding:16px 20px;margin-bottom:16px">
      <div class="cd-review-hdr">
        ${warnIcon}
        ${needsMapping.length} ${needsMapping.length === 1 ? 'org needs' : 'orgs need'} Autotask mapping
        <span class="cd-review-sub"><span class="spinner" style="display:inline-block;width:10px;height:10px;border-width:1.5px;vertical-align:middle;margin-right:4px"></span>Auto-matching against Autotask…</span>
      </div>
    </div>`;

  // Fetch bulk suggestions (single AT API call, 30 min cached)
  let suggestions = {};
  try {
    const names = needsMapping.map(c => c.name).filter(Boolean);
    const result = await window.api.kaseyaBulkSuggest({ names });
    suggestions = result?.suggestions || {};
  } catch (_) {}

  const highConf = needsMapping.filter(c => (suggestions[c.name]?.score ?? 0) >= 0.85);
  const matched  = Object.keys(suggestions).length;

  el.innerHTML = `
    <div class="settings-section wide" style="padding:16px 20px;margin-bottom:16px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <div class="cd-review-hdr" style="margin:0">
          ${warnIcon}
          ${needsMapping.length} ${needsMapping.length === 1 ? 'org needs' : 'orgs need'} Autotask mapping
          <span class="cd-review-sub">${matched > 0 ? `${matched} auto-match${matched === 1 ? '' : 'es'} found — review and accept` : 'No auto-matches — search manually'}</span>
        </div>
        ${highConf.length > 0 ? `
          <button class="btn btn-primary btn-sm" id="kp-accept-all-btn">
            Accept all high-confidence (${highConf.length})
          </button>` : ''}
      </div>
      ${needsMapping.length ? `<div class="cd-review-list" id="kp-org-review-list">${needsMapping.map(c => kpOrgRowHtml(c, false, suggestions[c.name] || null)).join('')}</div>` : ''}
      ${excludedOrgs.length ? `
        <details style="margin-top:${needsMapping.length ? '10px' : '0'};font-size:12px;color:var(--text-muted)">
          <summary style="cursor:pointer;user-select:none;padding:4px 0">${excludedOrgs.length} excluded ${excludedOrgs.length === 1 ? 'org' : 'orgs'}</summary>
          <div class="cd-review-list" style="margin-top:8px">${excludedOrgs.map(c => kpOrgRowHtml(c, true, null)).join('')}</div>
        </details>` : ''}
    </div>`;

  // Accept All high-confidence — single batch write to avoid SP race conditions
  document.getElementById('kp-accept-all-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('kp-accept-all-btn');
    btn.disabled = true; btn.textContent = 'Saving to SharePoint…';
    try {
      const matches = highConf
        .map(c => ({ kaseyaName: c.name, atId: suggestions[c.name]?.atId, atName: suggestions[c.name]?.atName }))
        .filter(m => m.atId);
      const result = await window.api.kaseyaBulkConfirmMatches({ matches });
      if (!result?.ok) throw new Error(result?.error || 'Save failed');
      for (const m of matches) {
        const local = _kaseyaData?.clients?.find(x => x.name === m.kaseyaName);
        if (local) { local.atId = m.atId; local.atName = m.atName; }
      }
      renderKaseyaOrgMapping(_kaseyaData?.clients);
    } catch (e) {
      btn.disabled = false;
      btn.textContent = `Retry (${e.message})`;
    }
  });
}

function kpOrgRowHtml(client, isExcluded, suggestion) {
  const name    = client.name || '(unknown)';
  const safeKey = btoa(unescape(encodeURIComponent(name))).replace(/[+=\/]/g, '');

  const scoreBadge = s => {
    const pct = Math.round(s * 100);
    const col = s >= 0.85 ? 'var(--success)' : s >= 0.7 ? 'var(--accent)' : 'var(--text-muted)';
    return `<span style="font-size:10px;font-weight:600;color:${col};flex-shrink:0">${pct}%</span>`;
  };

  let actionHtml;
  if (isExcluded) {
    actionHtml = `
      <span class="cd-review-match cd-review-none">Excluded</span>
      <span class="cd-badge cd-badge-none" style="flex-shrink:0">Excluded</span>
      <button class="btn btn-ghost btn-sm kp-org-restore-btn" data-name="${escHtml(name)}">Restore</button>`;
  } else if (suggestion) {
    actionHtml = `
      <span class="cd-review-match" style="color:var(--text-muted)">→ ${escHtml(suggestion.atName)}</span>
      ${scoreBadge(suggestion.score)}
      <button class="btn btn-ghost btn-sm kp-org-accept-btn"
        data-name="${escHtml(name)}" data-atid="${suggestion.atId}" data-atname="${escHtml(suggestion.atName)}"
        style="color:var(--success);border-color:color-mix(in srgb,var(--success) 40%,transparent)">Accept</button>
      <button class="btn btn-ghost btn-sm kp-org-find-btn" data-name="${escHtml(name)}" data-key="${safeKey}">Different match</button>
      <button class="btn btn-ghost btn-sm kp-org-exclude-btn" data-name="${escHtml(name)}" style="color:var(--warn);border-color:color-mix(in srgb,var(--warn) 30%,transparent);font-size:10px;padding:2px 7px">Exclude</button>`;
  } else {
    actionHtml = `
      <span class="cd-review-match cd-review-none">No match found</span>
      <span class="cd-badge cd-badge-none" style="flex-shrink:0">Unmatched</span>
      <button class="btn btn-ghost btn-sm kp-org-find-btn" data-name="${escHtml(name)}" data-key="${safeKey}">Find Match</button>
      <button class="btn btn-ghost btn-sm kp-org-exclude-btn" data-name="${escHtml(name)}" style="color:var(--warn);border-color:color-mix(in srgb,var(--warn) 30%,transparent)">Exclude</button>`;
  }

  return `
  <div class="cd-review-row" data-kaseya-name="${escHtml(name)}">
    <span class="cd-review-name" title="${escHtml(name)}">${escHtml(name)}</span>
    ${actionHtml}
  </div>
  ${!isExcluded ? `
  <div class="cd-find-wrap hidden" id="kp-find-${safeKey}">
    <input type="text" class="kp-find-input cd-find-input" placeholder="Search Autotask companies…" value="${escHtml(name)}">
    <div class="cd-find-results"></div>
  </div>` : ''}`;
}

function kpSearchAt(input, wrap, kaseyaName) {
  let timer;
  const resultsEl = wrap.querySelector('.cd-find-results');

  async function doSearch() {
    const q = input.value.trim();
    if (!q) { resultsEl.innerHTML = ''; return; }
    resultsEl.innerHTML = `<div style="padding:6px 10px;font-size:11px;color:var(--text-muted)">Searching…</div>`;
    const results = await window.api.kaseyaSearchAtCompanies({ query: q }).catch(() => []);
    if (!results || !results.length) {
      resultsEl.innerHTML = `<div style="padding:6px 10px;font-size:11px;color:var(--text-muted)">No matches found</div>`;
      return;
    }
    resultsEl.innerHTML = results.map(r => `
      <div class="cd-match-item kp-match-item" data-kaseyaname="${escHtml(kaseyaName)}" data-atid="${r.atId}" data-atname="${escHtml(r.atName)}">
        ${escHtml(r.atName)} <span style="color:var(--text-muted);font-size:10px">ID: ${r.atId}</span>
      </div>`).join('');
  }

  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(doSearch, 300); });
  doSearch();
}

// AT service ID → display name for confirmation modal
const KP_AT_SERVICE_NAMES = {
  58: 'Cloud File Sync & Share',
  111: 'Cloud File Sync & Share for Servers',
  125: 'Cloud File Sync & Share (Unlimited Storage)',
  126: 'Cloud File Sync & Share for Servers (Unlimited Storage)',
  253: 'Cloud File Backup and Protection for Servers (Unlimited Storage)',
  88:  'Cloud Backup for Office 365',
  98:  'Cloud Backup for GSuite',
};

const KP_AT_PRODUCT_MAP = {
  'DWP Metered Plan - User License':     [{ serviceId: 58 }],
  'DWP Metered Plan - Server License':   [{ serviceId: 111 }],
  'DWP Unlimited Plan - Server License': [{ serviceId: 126 }],
  'DWP Unlimited Plan - User License':   [{ serviceId: 125 }],
  'DFP Unlimited Plan - Server License': [{ serviceId: 253 }],
  'SaaS Protection Infinite Cloud Retention Monthly': [{ serviceId: 98 }, { serviceId: 88 }],
};

function kpShowAtConfirmModal(title, previewRows, onConfirm) {
  document.getElementById('kp-at-confirm-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'kp-at-confirm-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--surface-1);border:1px solid var(--border);border-radius:var(--radius);width:680px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden">
      <div style="padding:18px 20px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <div style="font-weight:700;font-size:14px">${escHtml(title)}</div>
        <button id="kp-atc-cancel-x" style="background:none;border:none;color:var(--text-muted);font-size:18px;cursor:pointer;line-height:1">✕</button>
      </div>
      <div style="overflow-y:auto;flex:1;padding:14px 20px">
        <p class="field-hint" style="margin-bottom:12px">${previewRows.length} line${previewRows.length !== 1 ? 's' : ''} will be pushed across ${new Set(previewRows.map(r => r.company)).size} client${new Set(previewRows.map(r => r.company)).size !== 1 ? 's' : ''}. Review and confirm.</p>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="border-bottom:1px solid rgba(255,255,255,.1)">
            <th style="text-align:left;padding:5px 10px;color:var(--text-muted);font-weight:600;font-size:10.5px;text-transform:uppercase">Client</th>
            <th style="text-align:left;padding:5px 10px;color:var(--text-muted);font-weight:600;font-size:10.5px;text-transform:uppercase">Product</th>
            <th style="text-align:left;padding:5px 10px;color:var(--text-muted);font-weight:600;font-size:10.5px;text-transform:uppercase">AT Service</th>
            <th style="text-align:right;padding:5px 10px;color:var(--text-muted);font-weight:600;font-size:10.5px;text-transform:uppercase">Qty</th>
          </tr></thead>
          <tbody>
            ${previewRows.map(r => {
              const isDrop = r.qty === 0;
              return `<tr style="border-top:1px solid rgba(255,255,255,.04)${isDrop ? ';opacity:.6' : ''}">
                <td style="padding:6px 10px">${escHtml(r.company)}</td>
                <td style="padding:6px 10px;color:var(--text-muted)">${escHtml(r.product)}</td>
                <td style="padding:6px 10px">${escHtml(r.atService)}</td>
                <td style="padding:6px 10px;text-align:right;font-family:var(--font-mono);font-weight:600;color:${isDrop ? 'var(--warning)' : 'inherit'}">${isDrop ? '0 — drop' : r.qty}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px">
        <button id="kp-atc-cancel" class="btn btn-ghost">Cancel</button>
        <button id="kp-atc-confirm" class="btn btn-primary">Push to Autotask</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  modal.querySelector('#kp-atc-cancel-x').addEventListener('click', close);
  modal.querySelector('#kp-atc-cancel').addEventListener('click', close);
  modal.querySelector('#kp-atc-confirm').addEventListener('click', () => { close(); onConfirm(); });
}

function kpRenderQboTable(el, entries) {
  if (!el) return;
  if (!entries || !entries.length) { el.innerHTML = '<p class="field-hint">No entries generated.</p>'; return; }

  const fmtAmt = v => '$' + (v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const classPill = cls => {
    const map = {
      'Strategic Services': 'background:rgba(139,92,246,.18);color:#c4b5fd',
      'Service Delivery':   'background:rgba(59,130,246,.18);color:#93c5fd',
      'Admin':              'background:rgba(148,163,184,.15);color:#94a3b8',
    };
    const sty = map[cls];
    return sty
      ? `<span style="display:inline-block;padding:1px 7px;border-radius:4px;font-size:10px;font-weight:700;${sty}">${escHtml(cls)}</span>`
      : `<span style="color:var(--text-muted);font-size:11px">—</span>`;
  };

  // Persist sort state on element between re-renders
  if (!el._qboSort) el._qboSort = { col: null, dir: 1 };
  const { col: sortCol, dir: sortDir } = el._qboSort;

  const COLS = ['description', 'account', 'class', 'amount'];
  const sorted = [...entries].sort((a, b) => {
    if (!sortCol) return 0;
    let va = a[sortCol] ?? '', vb = b[sortCol] ?? '';
    if (sortCol === 'amount') return sortDir * (va - vb);
    return sortDir * String(va).localeCompare(String(vb));
  });

  const qboTotal = entries.reduce((s, e) => s + e.amount, 0);
  const thBase = 'padding:9px 12px;text-align:left;font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.75);white-space:nowrap;cursor:pointer;user-select:none';
  const arrow = col => col === sortCol ? (sortDir === 1 ? ' ▲' : ' ▼') : ' ⇅';

  el.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12.5px">
    <thead><tr style="background:rgba(45,77,107,.75)">
      <th data-qbo-col="description" style="${thBase}">Description${arrow('description')}</th>
      <th data-qbo-col="account"     style="${thBase}">QBO Account${arrow('account')}</th>
      <th data-qbo-col="class"       style="${thBase}">Class${arrow('class')}</th>
      <th data-qbo-col="amount"      style="${thBase};text-align:right">Amount${arrow('amount')}</th>
    </tr></thead>
    <tbody>
      ${sorted.map((e, i) => `<tr style="border-top:1px solid rgba(255,255,255,.06);${i%2===1 ? 'background:rgba(255,255,255,.025)' : ''}">
        <td style="padding:8px 12px">${escHtml(e.description)}</td>
        <td style="padding:8px 12px;font-size:11px;font-family:var(--font-mono);color:var(--text-muted)">${escHtml(e.account)}</td>
        <td style="padding:8px 12px">${classPill(e.class || '')}</td>
        <td style="padding:8px 12px;text-align:right;font-family:var(--font-mono);font-weight:600">${fmtAmt(e.amount)}</td>
      </tr>`).join('')}
    </tbody>
    <tfoot><tr style="border-top:2px solid rgba(45,77,107,.6);background:rgba(45,77,107,.2)">
      <td colspan="3" style="padding:9px 12px;font-weight:700">Total</td>
      <td style="padding:9px 12px;text-align:right;font-family:var(--font-mono);font-weight:700">${fmtAmt(qboTotal)}</td>
    </tr></tfoot>
  </table>`;

  el.querySelectorAll('th[data-qbo-col]').forEach(th => {
    th.addEventListener('click', () => {
      const c = th.dataset.qboCol;
      el._qboSort = { col: c, dir: el._qboSort.col === c ? el._qboSort.dir * -1 : 1 };
      kpRenderQboTable(el, entries);
    });
  });
}

// Match a client name against Revenue SP file entries (exact → no-space exact → partial)
function kpMatchRevenueBundles(kaseyaName, atName, revenueBundles) {
  if (!revenueBundles || !revenueBundles.length) return null;
  const norm   = s => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  const normNs = s => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const t1 = norm(kaseyaName), t2 = norm(atName);
  const t1ns = normNs(kaseyaName), t2ns = normNs(atName);
  // Pass 1: exact with spaces
  for (const rb of revenueBundles) {
    const rn = norm(rb.client);
    if (rn === t1 || (t2 && rn === t2)) return rb.includedSeats;
  }
  // Pass 2: exact ignoring spaces/punctuation (catches "39North" vs "39 North")
  for (const rb of revenueBundles) {
    const rnns = normNs(rb.client);
    if (rnns === t1ns || (t2ns && rnns === t2ns)) return rb.includedSeats;
  }
  // Pass 3: partial
  for (const rb of revenueBundles) {
    const rn = norm(rb.client), rnns = normNs(rb.client);
    if (rn.includes(t1) || t1.includes(rn) || (t2 && (rn.includes(t2) || t2.includes(rn)))) return rb.includedSeats;
    if (rnns.includes(t1ns) || t1ns.includes(rnns) || (t2ns && (rnns.includes(t2ns) || t2ns.includes(rnns)))) return rb.includedSeats;
  }
  return null;
}

// Deduct each bundle override from its specific product
function applyWorkplaceBundles(products, clientBundles) {
  if (!clientBundles || !clientBundles.length) return products;
  const result = { ...products };
  for (const b of clientBundles) {
    if (result[b.product] !== undefined) {
      result[b.product] = Math.max(0, result[b.product] - (b.bundledSeats || 0));
    }
  }
  return result;
}

async function kpPushAtWorkplace(data, workplaceBundles) {
  const btn = document.getElementById('kp-dwp-push-btn');
  const usage = data.workplaceUsage || [];
  const clients = data.clients || [];
  const clientMap = new Map(clients.map(c => [c.name.toLowerCase().trim(), c]));
  const bundlesByClient = new Map();
  for (const b of (workplaceBundles || [])) {
    const key = b.client.toLowerCase().trim();
    if (!bundlesByClient.has(key)) bundlesByClient.set(key, []);
    bundlesByClient.get(key).push(b);
  }

  const rows = usage.map(u => {
    const match      = clientMap.get(u.client.toLowerCase().trim());
    const cbs        = bundlesByClient.get(u.client.toLowerCase().trim()) || [];
    const products   = cbs.length ? applyWorkplaceBundles(u.products, cbs) : u.products;
    return { name: u.client, atId: match?.atId || null, products };
  }).filter(r => r.atId);

  if (!rows.length) {
    alert('No clients have a confirmed Autotask mapping. Map clients in the org mapping panel first.');
    return;
  }

  // Build preview for confirmation modal
  const previewRows = [];
  for (const row of rows) {
    for (const [product, qty] of Object.entries(row.products || {})) {
      const mapping = KP_AT_PRODUCT_MAP[product];
      if (!mapping) continue;
      for (const { serviceId } of mapping) {
        previewRows.push({ company: row.name, product, atService: KP_AT_SERVICE_NAMES[serviceId] || `Service ID ${serviceId}`, qty });
      }
    }
  }

  kpShowAtConfirmModal('Push Datto Workplace to Autotask', previewRows, async () => {
    btn.disabled = true;
    const progressEl = kpShowPushProgress('kp-dwp-progress', 'Datto Workplace — Pushing to AT');
    const unsubscribe = window.api.onKaseyaPushProgress(({ company, product, status, detail }) => {
      kpAppendPushProgress(progressEl, company, product, status, detail);
    });
    try {
      const result = await window.api.kaseyaAtPushWorkplace({ rows });
      kpRenderPushSummary(progressEl, result.summary);
    } catch (e) {
      progressEl.innerHTML += `<p style="color:var(--error);font-size:12px">Error: ${escHtml(e.message)}</p>`;
    } finally {
      btn.disabled = false;
      if (unsubscribe) unsubscribe();
    }
  });
}

async function kpPushAtSaas(data, revenueBundles, saasBundled, saasQtyOverride = {}) {
  const btn = document.getElementById('kp-saas-push-btn');
  const saas = data.saasCosts || [];
  const clients = data.clients || [];
  const clientMap = new Map(clients.map(c => [c.name.toLowerCase().trim(), c]));

  const rows = saas.map(s => {
    const match = clientMap.get(s.name.toLowerCase().trim());
    const atId  = match?.atId || null;
    let   qty   = s.qty;
    if (atId && saasBundled?.[atId]) {
      const bundledQty = (saasQtyOverride[atId] != null)
        ? saasQtyOverride[atId]
        : (revenueBundles ? (kpMatchRevenueBundles(s.name, match?.atName, revenueBundles) || 0) : 0);
      qty = Math.max(0, qty - bundledQty);
    }
    return { name: s.name, atId, qty };
  }).filter(r => r.atId);

  if (!rows.length) {
    alert('No clients have a confirmed Autotask mapping. Map clients in the org mapping panel first.');
    return;
  }

  const previewRows = rows.flatMap(row => [
    { company: row.name, product: 'SaaS Protection', atService: KP_AT_SERVICE_NAMES[98], qty: row.qty },
    { company: row.name, product: 'SaaS Protection', atService: KP_AT_SERVICE_NAMES[88], qty: row.qty },
  ]);

  kpShowAtConfirmModal('Push Datto SaaS Protection to Autotask', previewRows, async () => {
    btn.disabled = true;
    const progressEl = kpShowPushProgress('kp-saas-progress', 'Datto SaaS — Pushing to AT');
    const unsubscribe = window.api.onKaseyaPushProgress(({ company, product, status, detail }) => {
      kpAppendPushProgress(progressEl, company, product, status, detail);
    });
    try {
      const result = await window.api.kaseyaAtPushSaas({ rows });
      kpRenderPushSummary(progressEl, result.summary);
    } catch (e) {
      progressEl.innerHTML += `<p style="color:var(--error);font-size:12px">Error: ${escHtml(e.message)}</p>`;
    } finally {
      btn.disabled = false;
      if (unsubscribe) unsubscribe();
    }
  });
}

function kpShowPushProgress(id, title) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.className = 'settings-section wide';
    el.style.marginTop = '8px';
    const parent = document.getElementById('kp-results');
    if (parent) {
      const atSection = document.getElementById('kp-at-section');
      if (atSection) atSection.before(el);
      else parent.appendChild(el);
    }
  }
  el.innerHTML = `<div class="section-title">${escHtml(title)}</div><div id="${id}-rows" style="font-size:12px;margin-top:8px"></div>`;
  el.style.display = '';
  return el;
}

function kpAppendPushProgress(el, company, product, status, detail) {
  const rowsEl = el.querySelector('[id$="-rows"]') || el;
  const color = { success: 'var(--success)', no_change: 'var(--text-muted)', error: 'var(--error)', no_contract: 'var(--warning)', no_service: 'var(--warning)', negative_qty: 'var(--warning)', working: 'var(--text-muted)' }[status] || 'var(--text-muted)';
  const icon  = { success: '✓', no_change: '–', error: '✗', no_contract: '✗', no_service: '✗', negative_qty: '!', working: '…' }[status] || '?';
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;padding:4px 0;border-top:1px solid rgba(255,255,255,.04)';
  row.innerHTML = `
    <span style="color:${color};font-weight:700;min-width:14px">${icon}</span>
    <span style="flex:1">${escHtml(company)}${product ? ` <span style="color:var(--text-muted);font-size:11px">· ${escHtml(product)}</span>` : ''}</span>
    <span style="color:var(--text-muted);font-size:11px">${escHtml(detail || '')}</span>`;
  rowsEl.appendChild(row);
  el.scrollTop = el.scrollHeight;
}

function kpRenderPushSummary(el, summary = {}) {
  const rowsEl = el.querySelector('[id$="-rows"]') || el;
  const div = document.createElement('div');
  div.style.cssText = 'margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.1);font-size:12px;color:var(--text-muted)';
  div.textContent = `Done — Updated: ${summary.updated || 0}  ·  No change: ${summary.skipped || 0}  ·  Errors: ${summary.errors || 0}`;
  rowsEl.appendChild(div);
}

async function kpLoadDeltaSection(_unused) {
  const section = document.getElementById('kp-delta-section');
  const selA    = document.getElementById('kp-delta-a');
  const selB    = document.getElementById('kp-delta-b');
  if (!section || !selA || !selB) return;

  // Load all SP files across all available years
  let allFiles = [];
  try {
    const { years } = await window.api.kaseyaSpListYears();
    const byYear = await Promise.all((years || []).map(yr =>
      window.api.kaseyaSpListFiles({ year: yr }).catch(() => ({ files: [] }))
    ));
    allFiles = byYear.flatMap(r => r.files || []).sort((a, b) => {
      const da = (a.name.match(/_(\d{8})/) || [])[1] || '';
      const db = (b.name.match(/_(\d{8})/) || [])[1] || '';
      return db.localeCompare(da) || (b.lastModified || '').localeCompare(a.lastModified || '');
    });
  } catch (_) {}

  if (allFiles.length < 1) return;
  section.style.display = '';

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const fileLabel = f => {
    const m = f.name.match(/_(\d{4})(\d{2})\d{2}/);
    return m ? `${MONTHS[parseInt(m[2], 10) - 1]} ${m[1]}` : f.name;
  };

  const opts = allFiles.map(f =>
    `<option value="${escHtml(f.driveItemId)}" data-name="${escHtml(f.name)}">${escHtml(fileLabel(f))}</option>`
  ).join('');
  selA.innerHTML = '<option value="">— Baseline month —</option>' + opts;
  selB.innerHTML = '<option value="">— Compare month —</option>' + opts;

  if (allFiles.length >= 2) { selA.value = allFiles[1].driveItemId; selB.value = allFiles[0].driveItemId; }
  else if (allFiles.length === 1) { selB.value = allFiles[0].driveItemId; }

  // Replace button to clear any previously stacked listeners
  const oldBtn = document.getElementById('kp-delta-run-btn');
  const newBtn = oldBtn.cloneNode(true);
  oldBtn.parentNode.replaceChild(newBtn, oldBtn);
  newBtn.addEventListener('click', async () => {
    const idA   = selA.value, idB = selB.value;
    const nameA = selA.options[selA.selectedIndex]?.dataset?.name || '';
    const nameB = selB.options[selB.selectedIndex]?.dataset?.name || '';
    const st    = document.getElementById('kp-delta-status');
    if (!idA || !idB) { if (st) { st.textContent = 'Select both months.'; st.className = 'save-status error'; } return; }
    if (idA === idB)  { if (st) { st.textContent = 'Select two different months.'; st.className = 'save-status error'; } return; }
    if (st) { st.textContent = 'Downloading…'; st.className = 'save-status'; }
    newBtn.disabled = true;
    try {
      const result = await window.api.compareKaseyaSpFiles({ idA, nameA, idB, nameB });
      if (result.error) throw new Error(result.error);
      kpRenderDelta(result, []);   // labels come from result.keyA / result.keyB directly
      if (st) { st.textContent = ''; }
    } catch (e) {
      if (st) { st.textContent = `Error: ${e.message}`; st.className = 'save-status error'; }
    } finally { newBtn.disabled = false; }
  });
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

  // Shared table styles
  const thS  = 'padding:9px 14px;font-weight:600;font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:rgba(255,255,255,.65);white-space:nowrap';
  const thR  = thS + ';text-align:right';
  const tdM  = 'padding:8px 14px;font-family:var(--font-mono);font-size:12px';
  const tdMR = tdM + ';text-align:right';
  const secHdr = (title, sub = '') => `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--text-muted);margin:18px 0 8px">${title}${sub ? `<span style="font-weight:400;text-transform:none;letter-spacing:0;margin-left:6px">${sub}</span>` : ''}</div>`;

  // Grand total banner
  const gt = d.grandTotal;
  const gtColor = deltaColor(gt.delta);
  const cardBase = 'background:var(--surface-2);border-radius:var(--radius);padding:20px 24px;display:flex;flex-direction:column;align-items:center;gap:6px;border:1px solid var(--border)';
  let html = `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:4px">
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

  // Module deltas — full width
  if (d.modules && d.modules.length > 0) {
    const lA = escHtml(snapLabel(d.keyA)), lB = escHtml(snapLabel(d.keyB));
    html += secHdr('Module Changes');
    html += `<table class="data-table" style="width:100%">
      <thead><tr>
        <th style="${thS};width:32px"></th>
        <th style="${thS}">Module</th>
        <th style="${thR}">${lA}</th>
        <th style="${thR}">${lB}</th>
        <th style="${thR}">Change</th>
        <th style="${thR}">%</th>
      </tr></thead>
      <tbody>
        ${d.modules.map(m => `<tr>
          <td style="padding:8px 14px;width:32px">${statusBadge(m.status)}</td>
          <td style="padding:8px 14px">${escHtml(m.name)}</td>
          <td style="${tdMR}">${m.a ? fmtAmt(m.a) : '—'}</td>
          <td style="${tdMR}">${m.b ? fmtAmt(m.b) : '—'}</td>
          <td style="${tdMR};color:${deltaColor(m.delta)}">${fmtSgn(m.delta)}</td>
          <td style="${tdMR};color:${deltaColor(m.delta)}">${pctStr(m.pct)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  }

  // Category deltas — full width
  if (d.categories && d.categories.length > 0) {
    const lA = escHtml(snapLabel(d.keyA)), lB = escHtml(snapLabel(d.keyB));
    html += secHdr('Category Changes');
    html += `<table class="data-table" style="width:100%">
      <thead><tr>
        <th style="${thS};width:32px"></th>
        <th style="${thS}">Category</th>
        <th style="${thR}">${lA}</th>
        <th style="${thR}">${lB}</th>
        <th style="${thR}">Change</th>
        <th style="${thR}">%</th>
      </tr></thead>
      <tbody>
        ${d.categories.map(c => `<tr>
          <td style="padding:8px 14px;width:32px">${statusBadge(c.status)}</td>
          <td style="padding:8px 14px">${escHtml(c.name)}</td>
          <td style="${tdMR}">${c.a ? fmtAmt(c.a) : '—'}</td>
          <td style="${tdMR}">${c.b ? fmtAmt(c.b) : '—'}</td>
          <td style="${tdMR};color:${deltaColor(c.delta)}">${fmtSgn(c.delta)}</td>
          <td style="${tdMR};color:${deltaColor(c.delta)}">${pctStr(c.pct)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  }

  // Client deltas — full width
  const USAGE_QTY_MODS = new Set(['SaaS Protection', 'DWP', 'DFP']);
  if (d.clients && d.clients.length > 0) {
    const lA = escHtml(snapLabel(d.keyA)), lB = escHtml(snapLabel(d.keyB));
    html += secHdr('Client Changes', `(${d.clients.length} changed)`);

    const clientBg = 'background:rgba(255,255,255,.04)';
    const prodBg   = 'background:rgba(255,255,255,.015)';
    const tdL      = 'padding:8px 14px';
    const tdLi     = 'padding:6px 14px 6px 36px;font-size:12px';
    const tdRi     = 'padding:6px 14px;font-size:12px;text-align:right;font-family:var(--font-mono)';

    html += `<table class="data-table" style="width:100%">
      <thead><tr>
        <th style="${thS};width:32px"></th>
        <th style="${thS}">Client / Product</th>
        <th style="${thR}">Usage A→B</th>
        <th style="${thR}">${lA}</th>
        <th style="${thR}">${lB}</th>
        <th style="${thR}">Change</th>
      </tr></thead>
      <tbody>
        ${d.clients.map(c => {
          const clientRow = `<tr style="${clientBg};border-top:2px solid rgba(255,255,255,.1)">
            <td style="${tdL}">${statusBadge(c.status)}</td>
            <td style="${tdL};font-weight:600" colspan="5">${escHtml(c.name)}</td>
          </tr>`;

          const prodRows = (c.productDeltas || []).map(p => {
            const useUsage = USAGE_QTY_MODS.has(p.module);
            const qA = useUsage ? (p.aLicQty || 0) : (p.aQty || 0);
            const qB = useUsage ? (p.bLicQty || 0) : (p.bQty || 0);
            const qDelta = qB - qA;
            const qStr = qA === 0 && qB === 0 ? '—'
              : `${qA || '—'} → ${qB || '—'}${qDelta !== 0 ? ` <span style="color:${qDelta > 0 ? 'var(--warn)' : '#4caf97'};font-weight:600">(${qDelta > 0 ? '+' : ''}${qDelta})</span>` : ''}`;
            return `<tr style="${prodBg}">
              <td style="${tdLi};color:var(--text-muted)">↳</td>
              <td style="${tdLi}">${escHtml(p.name)}</td>
              <td style="${tdRi}">${qStr}</td>
              <td style="${tdRi}">${p.aAmt ? fmtAmt(p.aAmt) : '—'}</td>
              <td style="${tdRi}">${p.bAmt ? fmtAmt(p.bAmt) : '—'}</td>
              <td style="${tdRi};color:${deltaColor(p.deltaAmt)}">${p.deltaAmt !== 0 ? fmtSgn(p.deltaAmt) : '—'}</td>
            </tr>`;
          }).join('');

          return clientRow + prodRows;
        }).join('')}
      </tbody>
    </table>`;
  }

  if (!d.modules?.length && !d.clients?.length) {
    html += `<p class="field-hint" style="margin-top:8px">No differences found between the two selected months.</p>`;
  }

  el.innerHTML = html;
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

// ─── BlackPoint / CompassOne ──────────────────────────────────────────────────
let bpData        = null;
let bpCompareRows = null;
let bpAllFiles    = null;
let bpMatchState  = null;
let bpPushProgressHandler = null;
let bpActiveFilter = null;

function renderBlackpointProcessor() {
  content.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">BlackPoint Invoice Processor</h1>
        <p class="view-subtitle">Compare monthly Account Usage Report against Autotask billing and push unit changes</p>
      </div>
    </div>

    <div style="display:flex;gap:2px;border-bottom:1px solid var(--border);margin-bottom:20px">
      <button class="bp-tab" data-tab="compare" style="padding:8px 18px;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;font-size:13px;font-weight:500;margin-bottom:-1px;transition:color .15s">Invoice Compare &amp; Push</button>
      <button class="bp-tab" data-tab="usage" style="padding:8px 18px;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;font-size:13px;font-weight:500;margin-bottom:-1px;transition:color .15s">Endpoint Usage (API)</button>
    </div>

    <!-- Tab: Invoice Compare + Push -->
    <div id="bp-tab-compare">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:8px">
        <select id="bp-year-sel" class="field-input" style="width:110px;color-scheme:dark">
          <option value="">Year…</option>
        </select>
        <select id="bp-file-sel" class="field-input" style="width:360px;color-scheme:dark">
          <option value="">Select a CSV file…</option>
        </select>
        <button class="btn btn-primary btn-sm" id="bp-load-btn" disabled>Process Invoice</button>
        <button class="btn btn-ghost btn-sm" id="bp-refresh-files-btn" title="Refresh file list from SharePoint" style="padding:4px 8px;font-size:13px">↻</button>
      </div>
      <div id="bp-compare-status"></div>
      <div id="bp-compare-results" style="display:none">
        <div id="bp-compare-table-wrap"></div>
        <div style="display:flex;gap:10px;margin-top:16px;padding-top:16px;border-top:1px solid var(--border);flex-wrap:wrap;align-items:center">
          <button class="btn btn-primary" id="bp-push-sp-btn" disabled>Push Security+</button>
          <button class="btn btn-primary" id="bp-push-def-btn" disabled>Push 365 Defense</button>
          <button class="btn btn-ghost" id="bp-export-compare-btn" disabled style="margin-left:auto">Export to Excel</button>
        </div>
      </div>
    </div>

    <!-- Tab: Endpoint Usage (API) -->
    <div id="bp-tab-usage" style="display:none">
      <div style="display:flex;gap:8px;margin-bottom:16px">
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
      <div id="bp-status" style="display:none"></div>
      <div id="bp-results"></div>
    </div>

    <!-- Company match modal -->
    <div id="bp-match-modal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center">
      <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:24px;width:520px;max-height:80vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="margin:0;font-size:15px">Confirm Company Match</h3>
          <button id="bp-match-close" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:20px;line-height:1">&times;</button>
        </div>
        <p style="font-size:12px;color:var(--text-muted);margin:0 0 2px">Blackpoint company:</p>
        <p style="font-size:14px;font-weight:600;margin:0 0 14px" id="bp-match-customer-lbl"></p>
        <p style="font-size:12px;color:var(--text-muted);margin:0 0 6px">Suggested matches:</p>
        <div id="bp-match-candidates" style="margin-bottom:14px"></div>
        <div style="margin-bottom:14px">
          <input class="field-input" id="bp-match-search" placeholder="Search Autotask companies…" type="text" style="width:100%;box-sizing:border-box" />
          <div id="bp-match-search-results" style="margin-top:6px"></div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end">
          <button class="btn btn-ghost" id="bp-match-cancel">Cancel</button>
          <button class="btn btn-primary" id="bp-match-confirm" disabled>Confirm Match</button>
        </div>
      </div>
    </div>

    <!-- Push progress modal -->
    <div id="bp-push-modal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:1000;align-items:center;justify-content:center">
      <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:24px;width:560px;max-height:80vh;overflow-y:auto">
        <h3 style="margin:0 0 14px;font-size:15px" id="bp-push-modal-title">Confirm Push</h3>
        <!-- Confirmation step — shown before push fires -->
        <div id="bp-push-confirm-step" style="display:none">
          <div id="bp-push-confirm-body" style="font-size:13px;margin-bottom:14px;max-height:320px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;padding:10px"></div>
          <div style="display:flex;gap:10px;justify-content:flex-end">
            <button class="btn btn-ghost" id="bp-push-confirm-cancel">Cancel</button>
            <button class="btn btn-primary" id="bp-push-confirm-ok">Confirm &amp; Push</button>
          </div>
        </div>
        <!-- Progress step — shown while push is running -->
        <div id="bp-push-progress-step">
          <div id="bp-push-progress-list" style="font-size:12px;max-height:300px;overflow-y:auto;margin-bottom:14px;border:1px solid var(--border);border-radius:6px;padding:8px"></div>
          <div id="bp-push-summary" style="display:none;padding:12px;background:var(--surface);border-radius:6px;margin-bottom:14px;font-size:13px;line-height:1.6"></div>
          <div style="display:flex;justify-content:flex-end">
            <button class="btn btn-ghost" id="bp-push-close" disabled>Close</button>
          </div>
        </div>
      </div>
    </div>`;

  // Tab switching
  document.querySelectorAll('.bp-tab').forEach(btn => {
    btn.addEventListener('click', () => bpShowTab(btn.dataset.tab));
  });
  bpShowTab('compare');

  // Init: load SP file list
  bpLoadFiles();

  // Refresh file list button
  document.getElementById('bp-refresh-files-btn').addEventListener('click', bpRefreshFiles);

  // Export comparison button
  document.getElementById('bp-export-compare-btn').addEventListener('click', bpExportComparison);

  // Usage tab
  document.getElementById('bp-run-btn').addEventListener('click', bpRunQuery);
  document.getElementById('bp-export-btn').addEventListener('click', bpExportReport);

  // Match modal
  document.getElementById('bp-match-close').addEventListener('click', bpCloseMatchModal);
  document.getElementById('bp-match-cancel').addEventListener('click', bpCloseMatchModal);
  document.getElementById('bp-match-confirm').addEventListener('click', bpConfirmMatch);
  let bpSearchTimer = null;
  document.getElementById('bp-match-search').addEventListener('input', e => {
    clearTimeout(bpSearchTimer);
    bpSearchTimer = setTimeout(() => bpSearchMatchCompanies(e.target.value), 300);
  });

  // Push modal close (progress step)
  document.getElementById('bp-push-close').addEventListener('click', () => {
    document.getElementById('bp-push-modal').style.display = 'none';
  });

  // Register push progress listener (once per render; duplicates are harmless)
  window.api.onBpPushProgress(data => {
    if (typeof bpPushProgressHandler === 'function') bpPushProgressHandler(data);
  });

  // Restore usage tab data if available
  if (bpData) bpRenderResults();
}

function bpShowTab(tab) {
  document.querySelectorAll('.bp-tab').forEach(btn => {
    const active = btn.dataset.tab === tab;
    btn.style.color            = active ? 'var(--accent)' : 'var(--text-muted)';
    btn.style.borderBottomColor = active ? 'var(--accent)' : 'transparent';
  });
  document.getElementById('bp-tab-compare').style.display = tab === 'compare' ? '' : 'none';
  document.getElementById('bp-tab-usage').style.display   = tab === 'usage'   ? '' : 'none';
}

// ── Compare Tab ────────────────────────────────────────────────────────────────

async function bpLoadFiles() {
  const yearSel = document.getElementById('bp-year-sel');
  const fileSel = document.getElementById('bp-file-sel');
  const loadBtn = document.getElementById('bp-load-btn');
  if (!yearSel) return;

  yearSel.addEventListener('change', () => {
    bpPopulateFiles(yearSel.value);
  });
  fileSel.addEventListener('change', () => {
    if (loadBtn) loadBtn.disabled = !fileSel.value;
  });
  if (loadBtn) loadBtn.addEventListener('click', bpLoadAndCompare);

  try {
    bpAllFiles = await window.api.bpListSpFiles();
    yearSel.innerHTML = '<option value="">Year…</option>' +
      (bpAllFiles.years || []).map(y => `<option value="${y}">${escHtml(y)}</option>`).join('');
  } catch (e) {
    const st = document.getElementById('bp-compare-status');
    if (st) st.innerHTML = `<div class="error-banner" style="margin-bottom:12px">Could not load SharePoint file list: ${escHtml(e.message)}</div>`;
  }
}

function bpPopulateFiles(year) {
  const fileSel = document.getElementById('bp-file-sel');
  const loadBtn = document.getElementById('bp-load-btn');
  if (!fileSel || !bpAllFiles) return;
  const files = (bpAllFiles.files || []).filter(f => f.year === year);
  fileSel.innerHTML = '<option value="">Select a CSV file…</option>' +
    files.map(f => `<option value="${escHtml(f.name)}">${escHtml(f.name)}</option>`).join('');
  if (loadBtn) loadBtn.disabled = true;
}

async function bpLoadAndCompare() {
  const yearSel   = document.getElementById('bp-year-sel');
  const fileSel   = document.getElementById('bp-file-sel');
  const loadBtn   = document.getElementById('bp-load-btn');
  const statusEl  = document.getElementById('bp-compare-status');
  const resultsEl = document.getElementById('bp-compare-results');
  if (!yearSel || !yearSel.value || !fileSel || !fileSel.value) return;

  if (loadBtn) loadBtn.disabled = true;
  if (resultsEl) resultsEl.style.display = 'none';
  statusEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;padding:14px;background:var(--surface);border-radius:6px;margin-bottom:12px;font-size:13px;color:var(--text-muted)">
      <span class="spinner" style="width:14px;height:14px;border-width:2px;flex-shrink:0"></span>
      <span id="bp-loading-txt">Loading CSV from SharePoint…</span>
    </div>`;

  try {
    const { rows: csvRows } = await window.api.bpLoadSpCsv({ year: yearSel.value, fileName: fileSel.value });
    const loadTxt = document.getElementById('bp-loading-txt');
    if (loadTxt) loadTxt.textContent = `Comparing ${csvRows.length} companies against Autotask… (30-60 seconds)`;

    const { rows } = await window.api.bpGetAtComparison({ rows: csvRows, force: true });
    bpCompareRows = rows;
    statusEl.innerHTML = '';
    bpRenderCompareTable(rows);
    if (resultsEl) resultsEl.style.display = '';
    const exportBtn = document.getElementById('bp-export-compare-btn');
    if (exportBtn) exportBtn.disabled = false;
    saveToolStat('blackpoint-processor', `Compare: ${rows.length} companies loaded`, 'ok');
  } catch (e) {
    statusEl.innerHTML = `<div class="error-banner" style="margin-bottom:12px">Error: ${escHtml(e.message)}</div>`;
    saveToolStat('blackpoint-processor', `Compare error: ${e.message}`, 'error');
  } finally {
    if (loadBtn) loadBtn.disabled = false;
  }
}

async function bpRefreshFiles() {
  const yearSel    = document.getElementById('bp-year-sel');
  const statusEl   = document.getElementById('bp-compare-status');
  const refreshBtn = document.getElementById('bp-refresh-files-btn');
  if (refreshBtn) { refreshBtn.disabled = true; refreshBtn.textContent = '…'; }
  try {
    bpAllFiles = await window.api.bpListSpFiles();
    const currYear = yearSel ? yearSel.value : '';
    if (yearSel) {
      yearSel.innerHTML = '<option value="">Year…</option>' +
        (bpAllFiles.years || []).map(y => `<option value="${y}">${escHtml(y)}</option>`).join('');
      if (currYear) { yearSel.value = currYear; bpPopulateFiles(currYear); }
    }
  } catch (e) {
    if (statusEl) statusEl.innerHTML = `<div class="error-banner" style="margin-bottom:12px">Could not refresh file list: ${escHtml(e.message)}</div>`;
  } finally {
    if (refreshBtn) { refreshBtn.disabled = false; refreshBtn.textContent = '↻'; }
  }
}

async function bpExportComparison() {
  if (!bpCompareRows) return;
  const btn = document.getElementById('bp-export-compare-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Exporting…'; }
  try {
    const res = await window.api.bpExportComparison({ rows: bpCompareRows });
    if (res.error) alert(`Export failed: ${res.error}`);
  } catch (e) {
    alert(`Export failed: ${e.message}`);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Export to Excel'; }
  }
}

async function bpRetryErrors() {
  if (!bpCompareRows) return;
  const errorRows = bpCompareRows.filter(r => r.atError);
  if (!errorRows.length) return;
  const btn = document.getElementById('bp-retry-errors-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Retrying…'; }
  const statusEl = document.getElementById('bp-compare-status');
  try {
    const csvRows = errorRows.map(r => ({ customer: r.customer, securityPlus: r.securityPlus, cloudResponse: r.cloudResponse }));
    const { rows: retried } = await window.api.bpGetAtComparison({ rows: csvRows, force: false });
    const retryMap = {};
    retried.forEach(r => { retryMap[r.customer] = r; });
    bpCompareRows = bpCompareRows.map(r => retryMap[r.customer] || r);
    bpRenderCompareTable(bpCompareRows);
  } catch (e) {
    if (statusEl) statusEl.innerHTML = `<div class="error-banner" style="margin-bottom:12px">Retry failed: ${escHtml(e.message)}</div>`;
  }
}

function bpFilterBadge(label, filter, count, color, active) {
  if (!count && filter !== null) return '';
  const isActive = bpActiveFilter === filter;
  const base = `cursor:pointer;font-size:12px;padding:2px 8px;border-radius:12px;border:1px solid;transition:all 0.15s;user-select:none`;
  const style = isActive
    ? `${base};background:${color};border-color:${color};color:#000`
    : `${base};background:transparent;border-color:${color};color:${color}`;
  return `<button id="bp-filter-${filter || 'all'}" style="${style}">${count != null ? count + ' ' : ''}${label}</button>`;
}

function bpRenderCompareTable(rows) {
  const wrap   = document.getElementById('bp-compare-table-wrap');
  const spBtn  = document.getElementById('bp-push-sp-btn');
  const defBtn = document.getElementById('bp-push-def-btn');
  if (!wrap || !rows) return;

  const total      = rows.length;
  const spChanges  = rows.filter(r => r.atCompanyId && r.spDelta  != null && r.spDelta  !== 0).length;
  const defChanges = rows.filter(r => r.atCompanyId && r.defDelta != null && r.defDelta !== 0).length;
  const matched    = rows.filter(r => ['matched', 'auto_match'].includes(r.matchStatus)).length;
  const unmatched  = rows.filter(r => ['low_confidence', 'unmatched'].includes(r.matchStatus)).length;
  const errCount   = rows.filter(r => r.atError).length;
  const excluded   = rows.filter(r => r.matchStatus === 'excluded').length;

  if (spBtn)  { spBtn.disabled  = spChanges  === 0; spBtn.textContent  = `Push Security+ (${spChanges} changes)`;  spBtn.onclick  = () => bpPush('security_plus'); }
  if (defBtn) { defBtn.disabled = defChanges === 0; defBtn.textContent = `Push 365 Defense (${defChanges} changes)`; defBtn.onclick = () => bpPush('defense_365'); }

  const filtered = bpActiveFilter === null ? rows
    : bpActiveFilter === 'matched'    ? rows.filter(r => ['matched','auto_match'].includes(r.matchStatus))
    : bpActiveFilter === 'unmatched'  ? rows.filter(r => ['low_confidence','unmatched'].includes(r.matchStatus))
    : bpActiveFilter === 'atError'    ? rows.filter(r => r.atError)
    : bpActiveFilter === 'spChange'   ? rows.filter(r => r.atCompanyId && r.spDelta  != null && r.spDelta  !== 0)
    : bpActiveFilter === 'defChange'  ? rows.filter(r => r.atCompanyId && r.defDelta != null && r.defDelta !== 0)
    : bpActiveFilter === 'excluded'   ? rows.filter(r => r.matchStatus === 'excluded')
    : rows;

  wrap.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;align-items:center">
      ${bpFilterBadge('All', null,        total,      'var(--text-muted)', true)}
      ${bpFilterBadge('matched',    'matched',   matched,    '#4ade80', true)}
      ${unmatched  ? bpFilterBadge('need match', 'unmatched', unmatched,  '#fb923c', true) : ''}
      ${errCount   ? bpFilterBadge('AT errors',  'atError',   errCount,   '#f87171', true) : ''}
      ${spChanges  ? bpFilterBadge('SP changes', 'spChange',  spChanges,  '#fb923c', true) : ''}
      ${defChanges ? bpFilterBadge('365D changes','defChange', defChanges, '#fb923c', true) : ''}
      ${excluded   ? bpFilterBadge('excluded',   'excluded',  excluded,   '#6b7280', true) : ''}
      ${bpActiveFilter !== null ? `<button id="bp-filter-clear" style="font-size:11px;padding:2px 6px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer">✕ clear</button>` : ''}
      ${errCount   ? `<button id="bp-retry-errors-btn" style="margin-left:auto;font-size:11px;padding:2px 8px;border-radius:10px;border:1px solid #f87171;background:transparent;color:#f87171;cursor:pointer">↺ Retry ${errCount} error${errCount > 1 ? 's' : ''}</button>` : ''}
    </div>
    <div style="overflow-x:auto">
    <table class="audit-table" style="width:100%;font-size:12px">
      <thead>
        <tr>
          <th style="text-align:left;min-width:180px">Company</th>
          <th style="text-align:center">Match</th>
          <th style="text-align:center" title="MDR device count from Blackpoint invoice">MDR Devices</th>
          <th style="text-align:center" title="Security+ units currently billed in Autotask">Billed Security+</th>
          <th style="text-align:center" title="Change needed in Autotask (positive = increase, negative = decrease)">Security+ Change</th>
          <th style="text-align:center" title="Cloud Response seats included free with MDR (MDR × 1.3)">CR Included</th>
          <th style="text-align:center" title="Cloud Response seats in use (from Blackpoint invoice)">CR Used</th>
          <th style="text-align:center" title="Billable Cloud Response = max(0, Used − Included)">CR Billable</th>
          <th style="text-align:center" title="365 Defense units currently billed in Autotask">Billed 365 Defense</th>
          <th style="text-align:center" title="Change needed in Autotask for 365 Defense">365D Change</th>
          <th style="text-align:center;min-width:60px"></th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map((r, idx) => bpCompareRow(r, rows.indexOf(r))).join('')}
      </tbody>
    </table>
    </div>`;

  // Filter badge clicks
  wrap.querySelectorAll('[id^="bp-filter-"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.id.replace('bp-filter-', '');
      bpActiveFilter = (f === 'all' || f === 'clear') ? null : (bpActiveFilter === f ? null : f);
      bpRenderCompareTable(rows);
    });
  });

  // Match buttons
  rows.forEach((r, idx) => {
    const btn = document.getElementById(`bp-match-btn-${idx}`);
    if (btn) btn.addEventListener('click', () => bpOpenMatchModal(r, idx));
  });

  // Exclude / un-exclude buttons
  rows.forEach((r, idx) => {
    const btn = document.getElementById(`bp-excl-btn-${idx}`);
    if (btn) btn.addEventListener('click', () => bpToggleExclude(r, idx));
  });

  // Retry errors button
  const retryBtn = document.getElementById('bp-retry-errors-btn');
  if (retryBtn) retryBtn.addEventListener('click', bpRetryErrors);
}

function bpCompareRow(r, idx) {
  const isExcluded = r.matchStatus === 'excluded';

  const matchBadge = (() => {
    switch (r.matchStatus) {
      case 'matched':    return `<span style="color:#4ade80;font-size:11px">✓ Confirmed</span>`;
      case 'auto_match': return `<span style="color:#a3e635;font-size:11px" title="${escHtml(r.atCompanyName || '')}">~ Auto</span>`;
      case 'skipped':    return `<span style="color:var(--text-muted);font-size:11px">— ANS</span>`;
      case 'excluded':   return `<span style="color:#6b7280;font-size:11px">— Excluded</span>`;
      case 'low_confidence':
        return `<span style="font-size:11px;color:#fb923c" title="${escHtml(r.atCompanyName || '')} (${Math.round((r.confidence||0)*100)}%)">${escHtml((r.atCompanyName||'').substring(0,18))}… <button id="bp-match-btn-${idx}" class="btn btn-ghost btn-sm" style="font-size:10px;padding:1px 6px">Fix</button></span>`;
      default:
        return `<span style="color:#f87171;font-size:11px">No match <button id="bp-match-btn-${idx}" class="btn btn-ghost btn-sm" style="font-size:10px;padding:1px 6px">Set</button></span>`;
    }
  })();

  const fmtNum = n => n == null ? `<span style="color:var(--text-muted)">—</span>` : n;
  const deltaCell = d => {
    if (d == null) return `<td style="text-align:center"><span style="color:var(--text-muted)">—</span></td>`;
    if (d === 0)   return `<td style="text-align:center;color:var(--text-muted)">0</td>`;
    if (d > 0)     return `<td style="text-align:center;color:#fb923c;font-weight:600">+${d}</td>`;
    return           `<td style="text-align:center;color:#60a5fa;font-weight:600">${d}</td>`;
  };

  const rowOpacity = isExcluded ? 'opacity:0.45;' : '';
  const rowBg = r.atError ? 'background:rgba(248,113,113,0.05);' : '';
  const atNameHint = r.atCompanyName && !['unmatched','excluded'].includes(r.matchStatus)
    ? `<br><span style="font-size:10px;color:var(--text-muted)">${escHtml(r.atCompanyName)}</span>` : '';
  const errHint = r.atError
    ? `<br><span style="font-size:10px;color:#f87171" title="${escHtml(r.atError)}">⚠ AT error</span>` : '';
  const exclBtn = `<button id="bp-excl-btn-${idx}" title="${isExcluded ? 'Un-exclude' : 'Exclude from billing'}" class="btn btn-ghost btn-sm" style="font-size:10px;padding:1px 6px;color:${isExcluded ? '#4ade80' : 'var(--text-muted)'}">${isExcluded ? '↩' : '✕'}</button>`;

  return `
    <tr style="${rowBg}${rowOpacity}">
      <td style="padding:5px 8px">${escHtml(r.customer)}${atNameHint}${errHint}</td>
      <td style="text-align:center;padding:5px 8px;white-space:nowrap">${matchBadge}</td>
      <td style="text-align:center">${fmtNum(r.securityPlus)}</td>
      <td style="text-align:center">${fmtNum(r.atSP)}</td>
      ${deltaCell(r.spDelta)}
      <td style="text-align:center;color:var(--text-muted)">${fmtNum(r.included365D)}</td>
      <td style="text-align:center">${fmtNum(r.cloudResponse)}</td>
      <td style="text-align:center;font-weight:${r.billable365D > 0 ? '600' : 'normal'}">${fmtNum(r.billable365D)}</td>
      <td style="text-align:center">${fmtNum(r.atDef)}</td>
      ${deltaCell(r.defDelta)}
      <td style="text-align:center">${exclBtn}</td>
    </tr>`;
}

async function bpToggleExclude(row, rowIdx) {
  const isExcluded = row.matchStatus === 'excluded';
  try {
    await window.api.bpSetExcluded({ customer: row.customer, excluded: !isExcluded });
    if (bpCompareRows) {
      bpCompareRows[rowIdx] = { ...bpCompareRows[rowIdx], matchStatus: isExcluded ? 'unmatched' : 'excluded' };
      bpRenderCompareTable(bpCompareRows);
    }
  } catch (e) {
    alert('Failed to update exclusion: ' + e.message);
  }
}

// ── Company match modal ────────────────────────────────────────────────────────

function bpOpenMatchModal(row, rowIdx) {
  bpMatchState = { customer: row.customer, rowIdx, selected: null };
  document.getElementById('bp-match-customer-lbl').textContent = row.customer;
  document.getElementById('bp-match-confirm').disabled = true;
  document.getElementById('bp-match-search').value = '';
  document.getElementById('bp-match-search-results').innerHTML = '';

  const cands = row.candidates || [];
  const candWrap = document.getElementById('bp-match-candidates');
  candWrap.innerHTML = cands.length
    ? cands.map(c => `
        <div class="bp-cand-row" data-id="${c.atCompanyId}" data-name="${escHtml(c.atCompanyName)}"
             style="padding:7px 10px;border-radius:5px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;border:1px solid var(--border)">
          <span style="font-size:13px">${escHtml(c.atCompanyName)}</span>
          <span style="font-size:11px;color:var(--text-muted)">${Math.round((c.confidence||0)*100)}%</span>
        </div>`).join('')
    : '<p style="font-size:12px;color:var(--text-muted)">No suggestions — search manually below.</p>';

  candWrap.querySelectorAll('.bp-cand-row').forEach(el =>
    el.addEventListener('click', () => bpSelectMatchCandidate(el)));

  const modal = document.getElementById('bp-match-modal');
  modal.style.display = 'flex';
}

function bpSelectMatchCandidate(el) {
  document.querySelectorAll('#bp-match-candidates .bp-cand-row, #bp-match-search-results .bp-cand-row')
    .forEach(r => r.style.background = '');
  el.style.background = 'rgba(99,102,241,0.15)';
  bpMatchState.selected = { atCompanyId: parseInt(el.dataset.id, 10), atCompanyName: el.dataset.name };
  document.getElementById('bp-match-confirm').disabled = false;
}

function bpCloseMatchModal() {
  document.getElementById('bp-match-modal').style.display = 'none';
  bpMatchState = null;
}

async function bpSearchMatchCompanies(query) {
  const resultsEl = document.getElementById('bp-match-search-results');
  if (!resultsEl) return;
  if (!query || query.length < 3) { resultsEl.innerHTML = ''; return; }
  try {
    const companies = await window.api.bpSearchAtCompanies({ query });
    resultsEl.innerHTML = companies.length
      ? companies.map(c => `
          <div class="bp-cand-row" data-id="${c.atCompanyId}" data-name="${escHtml(c.atCompanyName)}"
               style="padding:7px 10px;border-radius:5px;cursor:pointer;display:flex;align-items:center;margin-bottom:4px;border:1px solid var(--border)">
            <span style="font-size:13px">${escHtml(c.atCompanyName)}</span>
          </div>`).join('')
      : '<p style="font-size:12px;color:var(--text-muted)">No results</p>';
    resultsEl.querySelectorAll('.bp-cand-row').forEach(el =>
      el.addEventListener('click', () => bpSelectMatchCandidate(el)));
  } catch {}
}

async function bpConfirmMatch() {
  if (!bpMatchState?.selected) return;
  const { customer, rowIdx, selected } = bpMatchState;
  const btn = document.getElementById('bp-match-confirm');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    await window.api.bpConfirmCompanyMatch({ customer, atCompanyId: selected.atCompanyId, atCompanyName: selected.atCompanyName });
    bpCloseMatchModal();
    // Re-run comparison for just this one row
    if (rowIdx != null && bpCompareRows) {
      const orig = bpCompareRows[rowIdx];
      const { rows: updated } = await window.api.bpGetAtComparison({
        rows: [{ customer: orig.customer, securityPlus: orig.securityPlus, cloudResponse: orig.cloudResponse }],
        force: false,
      });
      if (updated[0]) bpCompareRows[rowIdx] = updated[0];
      bpRenderCompareTable(bpCompareRows);
    }
  } catch (e) {
    alert(`Failed to save match: ${e.message}`);
    btn.disabled = false; btn.textContent = 'Confirm Match';
  }
}

// ── Push ──────────────────────────────────────────────────────────────────────

let _bpPushActive = false;

async function bpPush(serviceType) {
  if (!bpCompareRows || _bpPushActive) return;
  _bpPushActive = true;
  const modal        = document.getElementById('bp-push-modal');
  const title        = document.getElementById('bp-push-modal-title');
  const confirmStep  = document.getElementById('bp-push-confirm-step');
  const confirmBody  = document.getElementById('bp-push-confirm-body');
  const confirmOk    = document.getElementById('bp-push-confirm-ok');
  const progressStep = document.getElementById('bp-push-progress-step');
  const list         = document.getElementById('bp-push-progress-list');
  const summary      = document.getElementById('bp-push-summary');
  const closeBtn     = document.getElementById('bp-push-close');
  const label        = serviceType === 'security_plus' ? 'Security+' : '365 Defense';
  const effectiveDate = serviceType === 'security_plus'
    ? 'increases → 1st of this month, decreases → 1st of next month'
    : 'increases → 1st of this month, decreases → 1st of next month';

  const pushRows = bpCompareRows.filter(r => {
    if (!r.atCompanyId || !['matched', 'auto_match'].includes(r.matchStatus)) return false;
    return serviceType === 'security_plus'
      ? (r.spDelta  != null && r.spDelta  !== 0)
      : (r.defDelta != null && r.defDelta !== 0);
  });

  if (!pushRows.length) return;

  // ── Step 1: Show confirmation dialog ─────────────────────────────────────
  title.textContent = `Confirm ${label} Push`;
  confirmStep.style.display  = '';
  progressStep.style.display = 'none';
  modal.style.display = 'flex';

  const increases = pushRows.filter(r => (serviceType === 'security_plus' ? r.spDelta : r.defDelta) > 0);
  const decreases = pushRows.filter(r => (serviceType === 'security_plus' ? r.spDelta : r.defDelta) < 0);

  confirmBody.innerHTML = `
    <p style="margin:0 0 10px;color:var(--text-muted);font-size:12px">Effective date: ${escHtml(effectiveDate)}</p>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr>
        <th style="text-align:left;padding:3px 6px;border-bottom:1px solid var(--border)">Company</th>
        <th style="text-align:center;padding:3px 6px;border-bottom:1px solid var(--border)">Current</th>
        <th style="text-align:center;padding:3px 6px;border-bottom:1px solid var(--border)">New</th>
        <th style="text-align:center;padding:3px 6px;border-bottom:1px solid var(--border)">Change</th>
      </tr></thead>
      <tbody>
        ${pushRows.map(r => {
          const delta   = serviceType === 'security_plus' ? r.spDelta  : r.defDelta;
          const current = serviceType === 'security_plus' ? r.atSP     : r.atDef;
          const bpVal   = serviceType === 'security_plus' ? r.securityPlus : r.billable365D;
          const color   = delta > 0 ? '#fb923c' : '#60a5fa';
          return `<tr>
            <td style="padding:3px 6px;border-bottom:1px solid var(--border)">${escHtml(r.atCompanyName || r.customer)}</td>
            <td style="text-align:center;padding:3px 6px;border-bottom:1px solid var(--border)">${current ?? '—'}</td>
            <td style="text-align:center;padding:3px 6px;border-bottom:1px solid var(--border)">${bpVal}</td>
            <td style="text-align:center;padding:3px 6px;border-bottom:1px solid var(--border);color:${color};font-weight:600">${delta > 0 ? '+' : ''}${delta}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <p style="margin:10px 0 0;font-size:11px;color:var(--text-muted)">${pushRows.length} companies · ${increases.length} increase${increases.length !== 1 ? 's' : ''} · ${decreases.length} decrease${decreases.length !== 1 ? 's' : ''}</p>`;

  // ── Step 2: Wait for Confirm or Cancel ───────────────────────────────────
  const cancelBtn = document.getElementById('bp-push-confirm-cancel');
  const confirmed = await new Promise(resolve => {
    const onConfirm = () => { cancelBtn.removeEventListener('click', onCancel, { once: true }); resolve(true); };
    const onCancel  = () => { confirmOk.removeEventListener('click', onConfirm, { once: true }); modal.style.display = 'none'; resolve(false); };
    confirmOk.addEventListener('click', onConfirm, { once: true });
    cancelBtn.addEventListener('click', onCancel,  { once: true });
  });
  if (!confirmed) { _bpPushActive = false; return; }

  // ── Step 3: Run push ──────────────────────────────────────────────────────
  title.textContent = `Pushing ${label} changes…`;
  confirmStep.style.display  = 'none';
  progressStep.style.display = '';
  list.innerHTML = '';
  summary.style.display = 'none';
  closeBtn.disabled = true;

  const rowEls = {};
  bpPushProgressHandler = ({ company, status, detail }) => {
    if (!rowEls[company]) {
      const el = document.createElement('div');
      el.style.cssText = 'padding:4px 0;border-bottom:1px solid var(--border);display:flex;gap:8px;align-items:baseline';
      el.innerHTML = `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(company)}</span><span class="bp-ps"></span>`;
      list.appendChild(el);
      rowEls[company] = el;
    }
    const colors = { success: '#4ade80', error: '#f87171', no_change: 'var(--text-muted)', no_contract: '#fbbf24', no_service: '#fbbf24', negative_qty: '#fbbf24', working: 'var(--text-muted)' };
    const labels = { success: '✓', error: '✗', no_change: '—', no_contract: '⚠ no contract', no_service: '⚠ no service', negative_qty: '⚠ neg qty', working: '…' };
    const ps = rowEls[company].querySelector('.bp-ps');
    ps.style.color    = colors[status] || 'var(--text-muted)';
    ps.style.fontSize = '11px';
    ps.textContent    = `${labels[status] || status}${detail ? ' · ' + detail : ''}`;
    list.scrollTop    = list.scrollHeight;
  };

  try {
    const { results, summary: s } = await window.api.bpPush({ rows: pushRows, serviceType });
    bpPushProgressHandler = null;
    title.textContent     = `${label} push complete`;
    summary.style.display = '';
    summary.innerHTML     = `<strong>Done</strong><br>✓ Updated: ${s.updated} &nbsp;·&nbsp; — Skipped: ${s.skipped} &nbsp;·&nbsp; ✗ Errors: ${s.errors}`;
    closeBtn.disabled     = false;
    saveToolStat('blackpoint-processor', `Push ${label}: ${s.updated} updated, ${s.errors} errors`, s.errors ? 'error' : 'ok');
  } catch (e) {
    bpPushProgressHandler = null;
    title.textContent = `${label} push failed`;
    list.innerHTML   += `<div style="color:#f87171;padding:6px 0">${escHtml(e.message)}</div>`;
    closeBtn.disabled = false;
  } finally {
    _bpPushActive = false;
  }
}

// ── Endpoint Usage (API) ──────────────────────────────────────────────────────

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

// ─── Support request modal ────────────────────────────────────────────────────
function showSupportModal() {
  const existing = document.getElementById('support-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'support-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center';

  overlay.innerHTML = `
    <div style="background:#131B2A;border:1px solid rgba(148,163,184,0.28);border-radius:12px;
                padding:24px;width:460px;max-width:90vw;box-shadow:0 12px 40px rgba(0,0,0,.7)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-size:14px;font-weight:700;color:#E5E7EB">Request Support</div>
        <button id="sm-close" style="background:none;border:none;cursor:pointer;color:#9CA3AF;
                font-size:20px;line-height:1;padding:2px 6px;border-radius:4px"
                onmouseenter="this.style.background='rgba(255,255,255,0.08)'"
                onmouseleave="this.style.background='none'">×</button>
      </div>
      <p style="font-size:12px;color:#9CA3AF;margin:0 0 18px">Describe your issue and it will be sent directly to Mike.</p>
      <div style="margin-bottom:12px">
        <label style="font-size:11px;font-weight:600;color:#9CA3AF;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em">Subject</label>
        <input id="sm-subject" type="text" placeholder="Brief summary of the issue"
               style="width:100%;box-sizing:border-box;background:#0B111D;
                      border:1px solid rgba(148,163,184,0.16);border-radius:6px;
                      padding:8px 11px;font-size:12px;color:#E5E7EB;outline:none;
                      font-family:inherit;transition:border-color .15s"
               onfocus="this.style.borderColor='rgba(148,163,184,0.32)'"
               onblur="this.style.borderColor='rgba(148,163,184,0.16)'" />
      </div>
      <div style="margin-bottom:18px">
        <label style="font-size:11px;font-weight:600;color:#9CA3AF;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.05em">Description</label>
        <textarea id="sm-body" rows="5" placeholder="What happened? What were you trying to do? Any error messages?"
                  style="width:100%;box-sizing:border-box;background:#0B111D;
                         border:1px solid rgba(148,163,184,0.16);border-radius:6px;
                         padding:8px 11px;font-size:12px;color:#E5E7EB;outline:none;
                         font-family:inherit;resize:vertical;transition:border-color .15s"
                  onfocus="this.style.borderColor='rgba(148,163,184,0.32)'"
                  onblur="this.style.borderColor='rgba(148,163,184,0.16)'"></textarea>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <div id="sm-status" style="font-size:12px;flex:1"></div>
        <div style="display:flex;gap:8px;flex-shrink:0">
          <button id="sm-cancel" class="help-btn">Cancel</button>
          <button id="sm-send" style="display:inline-flex;align-items:center;gap:6px;
                  padding:7px 16px;font-size:12px;font-weight:600;background:#C27637;
                  border:none;border-radius:6px;color:#fff;cursor:pointer;font-family:inherit;
                  transition:background .15s"
                  onmouseenter="this.style.background='#D4834A'"
                  onmouseleave="this.style.background='#C27637'">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 4l6 4 6-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.3"/></svg>
            Send
          </button>
        </div>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  document.getElementById('sm-close').onclick  = close;
  document.getElementById('sm-cancel').onclick = close;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  document.getElementById('sm-send').onclick = async () => {
    const subject  = document.getElementById('sm-subject').value.trim();
    const bodyText = document.getElementById('sm-body').value.trim();
    const sendBtn  = document.getElementById('sm-send');
    const status   = document.getElementById('sm-status');

    if (!subject || !bodyText) {
      status.style.color = 'var(--error)';
      status.textContent = 'Please fill in both fields.';
      return;
    }

    sendBtn.disabled    = true;
    sendBtn.textContent = 'Sending…';
    status.textContent  = '';

    const fromName  = _currentUser?.name  || 'Unknown';
    const fromEmail = _currentUser?.email || '';
    const htmlBody  = `<p><strong>From:</strong> ${escHtml(fromName)}${fromEmail ? ` &lt;${escHtml(fromEmail)}&gt;` : ''}</p>
<hr style="border:none;border-top:1px solid #333;margin:10px 0">
<p><strong>Subject:</strong> ${escHtml(subject)}</p>
<p>${escHtml(bodyText).replace(/\n/g, '<br>')}</p>
<p style="color:#888;font-size:11px;margin-top:20px">Sent from Anchor Hub</p>`;

    const result = await window.api.homeSendSupportEmail({
      subject: `[Anchor Hub] ${subject}`,
      body:    htmlBody,
    });

    if (result?.ok) {
      status.style.color = 'var(--success)';
      status.textContent = 'Support request sent!';
      sendBtn.innerHTML  = '✓ Sent';
      setTimeout(close, 1800);
    } else {
      const msg = result?.error === 'no_token'
        ? 'Mail permission not granted — please sign out and sign back in.'
        : (result?.error || 'Failed to send. Please try again.');
      status.style.color = 'var(--error)';
      status.textContent = msg;
      sendBtn.disabled    = false;
      sendBtn.innerHTML   = `<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M2 4l6 4 6-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.3"/></svg> Send`;
    }
  };

  setTimeout(() => document.getElementById('sm-subject')?.focus(), 60);
}

// ─── Meraki License Management ─────────────────────────────────────────────────
function renderMerakiExpiration() {
  const content = document.getElementById('content');

  // ── Module state ──────────────────────────────────────────────────────────
  let _cache         = null;
  let _settings      = null;
  let _filters        = new Set();   // include filters — OR within row, AND between rows
  let _excludeFilters = new Set();   // exclude filters — globally AND NOT, always wins
  let _search        = '';
  let _sortCol       = 'severity';  // default sort
  let _sortDir       = 'asc';
  let _scanning      = false;
  let _scanLog       = [];
  let _scanDone      = 0;
  let _scanTotal     = 0;
  let _expandedOrgs  = new Set();
  let _orgDevicesMap = new Map();  // orgId → devices array; avoids JSON-in-attribute quoting bugs
  let _showSettings  = false;
  let _progressUnsub = null;
  let _batchMode     = false;
  let _batchSelected = new Set();  // orgIds checked for batch ticket creation

  // ── Severity helpers ──────────────────────────────────────────────────────
  const SEV_ORDER = { expired: 0, critical: 1, warning: 2, notice: 3, clean: 4 };
  const SEV_LABEL = { expired: 'Expired', critical: 'Critical', warning: 'Warning', notice: 'Notice', clean: 'Clean' };
  const SEV_CSS   = { expired: 'mexp-expired', critical: 'mexp-critical', warning: 'mexp-warning', notice: 'mexp-notice', clean: 'mexp-clean' };

  function sevBadge(sev) {
    return `<span class="mexp-badge ${SEV_CSS[sev] || 'mexp-clean'}">${SEV_LABEL[sev] || sev}</span>`;
  }

  function fmtDate(ds) {
    if (!ds) return '—';
    try {
      // ISO path (YYYY-MM-DD…): parse as local midnight to avoid UTC-to-local shift
      if (/^\d{4}-\d{2}-\d{2}/.test(ds)) {
        const [y, m, d] = ds.slice(0, 10).split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      // Non-ISO path (e.g. Meraki co-term "Sep 25, 2026"): let the browser parse it
      const date = new Date(ds);
      if (!isNaN(date)) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return ds;
    } catch { return ds; }
  }

  function fmtScanDate(iso) {
    if (!iso) return 'never';
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true,
      });
    } catch { return iso; }
  }

  function daysLabel(d) {
    if (d === null || d === undefined) return '';
    return d < 0 ? `${Math.abs(d)}d ago` : `in ${d}d`;
  }

  function statusDot(s) {
    const c = s === 'online' ? '#4ade80' : s === 'alerting' ? '#fbbf24' : s === 'dormant' ? '#6b7280' : '#ef4444';
    return `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c};margin-right:4px;vertical-align:middle;flex-shrink:0"></span>`;
  }

  function statusLabel(d) {
    if (d.isUnclaimed) return 'Shelf spare';
    const s = d.deviceStatus;
    if (s === 'online')   return 'Online';
    if (s === 'alerting') return 'Alerting';
    if (s === 'dormant')  return 'Dormant';
    return 'Offline';  // offline or unknown both display as Offline
  }

  function worstSev(devices) {
    let best = 4;
    for (const d of devices) best = Math.min(best, SEV_ORDER[d.severity] ?? 4);
    return Object.keys(SEV_ORDER)[best] || 'clean';
  }

  function computeSummary(orgs) {
    let expired = 0, critical = 0, warning = 0, notice = 0, orgsScanned = 0;
    let online = 0, offline = 0, dormant = 0, alerting = 0, shelfSpare = 0;
    let endOfSale = 0, endOfSupport = 0, noAtMatch = 0, dateMismatch = 0, hasUnused = 0;
    for (const org of (orgs || [])) {
      if (org.skipped || org.error) continue;
      orgsScanned++;
      if ((org.unusedLicenses?.length || 0) > 0) hasUnused++;
      for (const d of (org.devices || [])) {
        if      (d.severity === 'expired')  expired++;
        else if (d.severity === 'critical') critical++;
        else if (d.severity === 'warning')  warning++;
        else if (d.severity === 'notice')   notice++;
        if (d.isUnclaimed) shelfSpare++;
        else if (d.deviceStatus === 'online')   online++;
        else if (d.deviceStatus === 'offline' || d.deviceStatus === 'unknown') offline++;
        else if (d.deviceStatus === 'dormant')  dormant++;
        else if (d.deviceStatus === 'alerting') alerting++;
        if (d.eosaleDate) endOfSale++;
        if (d.eosDate) endOfSupport++;
        if (!d.atMatch || d.atMatch.error) noAtMatch++;
        else {
          const atDate = d.atMatch?.warrantyExpirationDate;
          const toYmd2 = s => { if (!s) return ''; const dt = new Date(s); return isNaN(dt) ? s.slice(0,10) : dt.toISOString().slice(0,10); };
          if (d.licenseExpiry && toYmd2(d.licenseExpiry) !== toYmd2(atDate)) dateMismatch++;
        }
      }
    }
    return { expired, critical, warning, notice, orgsScanned,
             online, offline, dormant, alerting, shelfSpare,
             endOfSale, endOfSupport, noAtMatch, dateMismatch, hasUnused };
  }

  function matchesSearch(device, orgName) {
    if (!_search) return true;
    const q = _search.toLowerCase();
    return (device.serial || '').toLowerCase().includes(q)
        || (device.name   || '').toLowerCase().includes(q)
        || (device.model  || '').toLowerCase().includes(q)
        || (orgName       || '').toLowerCase().includes(q);
  }

  // Maps each filter key to its group — within a group it's OR, between groups it's AND.
  // 'has-unused' is handled at the org level in buildOrgsHtml, not here.
  const FILTER_KEY_GROUP = {
    'expired': 'severity', 'critical': 'severity', 'warning': 'severity', 'notice': 'severity',
    'online': 'status', 'offline': 'status', 'dormant': 'status', 'alerting': 'status', 'shelf-spare': 'status',
    'end-of-sale': 'eol', 'end-of-support': 'eol',
    'no-at-match': 'at', 'date-mismatch': 'at',
  };

  function _deviceMatchesFilter(d, f) {
    const atDate = d.atMatch?.warrantyExpirationDate;
    const toYmd = s => { const dt = new Date(s); return isNaN(dt) ? s.slice(0,10) : dt.toISOString().slice(0,10); };
    if (f === 'expired')        return d.severity === 'expired';
    if (f === 'critical')       return d.severity === 'critical';
    if (f === 'warning')        return d.severity === 'warning';
    if (f === 'notice')         return d.severity === 'notice';
    if (f === 'online')         return d.deviceStatus === 'online'   && !d.isUnclaimed;
    if (f === 'offline')        return (d.deviceStatus === 'offline' || d.deviceStatus === 'unknown') && !d.isUnclaimed;
    if (f === 'dormant')        return d.deviceStatus === 'dormant'  && !d.isUnclaimed;
    if (f === 'alerting')       return d.deviceStatus === 'alerting' && !d.isUnclaimed;
    if (f === 'shelf-spare')    return !!d.isUnclaimed;
    if (f === 'end-of-sale')    return !!d.eosaleDate;
    if (f === 'end-of-support') return !!d.eosDate;
    if (f === 'no-at-match')    return !d.atMatch || !!d.atMatch.error;
    if (f === 'date-mismatch')  return !!(d.licenseExpiry && d.atMatch && !d.atMatch.error && toYmd(d.licenseExpiry) !== toYmd(atDate));
    return true;
  }

  function filterDevice(d) {
    // Excludes always win globally (AND NOT)
    for (const f of _excludeFilters) {
      if (f === 'has-unused') continue;  // org-level
      if (_deviceMatchesFilter(d, f)) return false;
    }

    // Includes: OR within group, AND between groups
    const includeDeviceFilters = [..._filters].filter(f => f !== 'has-unused');
    if (includeDeviceFilters.length === 0) return true;

    const byGroup = {};
    for (const f of includeDeviceFilters) {
      const g = FILTER_KEY_GROUP[f] || f;
      if (!byGroup[g]) byGroup[g] = [];
      byGroup[g].push(f);
    }
    for (const group of Object.values(byGroup)) {
      if (!group.some(f => _deviceMatchesFilter(d, f))) return false;
    }
    return true;
  }

  function computeVisibleCounts() {
    let devices = 0, orgs = 0;
    for (const org of (_cache?.orgs || [])) {
      if (org.skipped || org.error) continue;
      if (_filters.has('has-unused')        && !(org.unusedLicenses?.length > 0)) continue;
      if (_excludeFilters.has('has-unused') &&  (org.unusedLicenses?.length > 0)) continue;
      const visible = (org.devices || []).filter(d => filterDevice(d) && matchesSearch(d, org.orgName));
      if (!visible.length && !_filters.has('has-unused')) continue;
      orgs++;
      devices += visible.length;
    }
    return { devices, orgs };
  }

  // ── Render switch ─────────────────────────────────────────────────────────
  function render() {
    if (_scanning) { renderScanning(); return; }
    if (!_cache)   { renderEmpty();    return; }
    renderReport();
  }

  // ── Scanning progress view ────────────────────────────────────────────────
  function renderScanning() {
    const pct = _scanTotal > 0 ? Math.round((_scanDone / _scanTotal) * 100) : 0;
    content.innerHTML = `
      <div class="tool-header">
        <h2>Meraki License Management</h2>
        <p class="tool-subtitle">Scan in progress — do not close the app</p>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:24px;max-width:620px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <span style="font-size:14px;font-weight:600;color:var(--text-primary)">Scanning Meraki organizations…</span>
          <span style="font-size:12px;color:var(--text-muted)">${_scanDone} / ${_scanTotal || '?'}</span>
        </div>
        <div style="height:4px;background:var(--border);border-radius:2px;margin-bottom:20px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:var(--accent);border-radius:2px;transition:width .3s"></div>
        </div>
        <div id="mexp-scan-log" style="font-family:monospace;font-size:12px;max-height:300px;overflow-y:auto;
          background:var(--bg);border-radius:6px;padding:12px;color:var(--text-muted)">
          ${_scanLog.map(l => `<div style="margin-bottom:2px">${escHtml(l)}</div>`).join('')}
        </div>
      </div>`;
    const logEl = document.getElementById('mexp-scan-log');
    if (logEl) logEl.scrollTop = logEl.scrollHeight;
  }

  // ── Empty / first-run view ────────────────────────────────────────────────
  function renderEmpty() {
    content.innerHTML = `
      <div class="tool-header">
        <h2>Meraki License Management</h2>
        <p class="tool-subtitle">License &amp; End-of-Life tracking across all client Meraki orgs</p>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  height:280px;gap:16px;color:var(--text-muted)">
        <div style="font-size:40px">📡</div>
        <div style="font-size:15px;font-weight:600;color:var(--text-primary)">No scan data yet</div>
        <div style="font-size:13px;text-align:center;max-width:380px;line-height:1.6">
          Run a scan to pull license &amp; EoL data from all client Meraki orgs and cross-reference with Autotask CIs.
        </div>
        <button class="btn btn-primary" id="mexp-btn-first-scan" style="margin-top:8px">Run First Scan</button>
      </div>`;
    document.getElementById('mexp-btn-first-scan')?.addEventListener('click', startScan);
  }

  // ── Full report view ──────────────────────────────────────────────────────
  function renderReport() {
    const { expired, critical, warning, notice, orgsScanned,
            online, offline, dormant, alerting, shelfSpare,
            endOfSale, endOfSupport, noAtMatch, dateMismatch, hasUnused } = computeSummary(_cache.orgs);
    const totalFlagged = expired + critical + warning + notice;

    const FILTER_GROUPS = [
      { label: 'Severity', filters: [
        { key: 'expired',  label: `Expired`,  count: expired  },
        { key: 'critical', label: `Critical`, count: critical },
        { key: 'warning',  label: `Warning`,  count: warning  },
        { key: 'notice',   label: `Notice`,   count: notice   },
      ]},
      { label: 'Status', filters: [
        { key: 'online',      label: 'Online',      count: online     },
        { key: 'offline',     label: 'Offline',     count: offline    },
        { key: 'dormant',     label: 'Dormant',     count: dormant    },
        { key: 'alerting',    label: 'Alerting',    count: alerting   },
        { key: 'shelf-spare', label: 'Shelf spare', count: shelfSpare },
      ]},
      { label: 'End of Life', filters: [
        { key: 'end-of-sale',    label: 'End of Sale',    count: endOfSale    },
        { key: 'end-of-support', label: 'End of Support', count: endOfSupport },
      ]},
      { label: 'AT', filters: [
        { key: 'no-at-match',   label: 'No AT match',     count: noAtMatch   },
        { key: 'date-mismatch', label: 'Date mismatch',   count: dateMismatch },
      ]},
      { label: 'Licenses', filters: [
        { key: 'has-unused', label: 'Unused licenses', count: hasUnused },
      ]},
    ];

    function chipHtml(f) {
      const included = _filters.has(f.key);
      const excluded = _excludeFilters.has(f.key);
      const countStr = f.count !== undefined ? ` (${f.count})` : '';
      const extraStyle = included
        ? 'border-color:#4ade80;background:rgba(74,222,128,.15);color:#4ade80'
        : excluded
          ? 'border-color:#f87171;background:rgba(248,113,113,.12);color:#f87171;text-decoration:line-through'
          : '';
      const prefix = excluded ? '✕ ' : '';
      return `<button class="mexp-filter-chip${included || excluded ? ' active' : ''}"
        data-filter="${f.key}"
        title="${excluded ? 'Excluding' : included ? 'Including' : 'Click to include, click again to exclude'}"
        style="${extraStyle}">${prefix}${escHtml(f.label)}${countStr}</button>`;
    }

    function _nextRunLabel(settings) {
      if (!settings?.scheduleEnabled) return `Scheduler disabled · Threshold: ${settings?.thresholdDays || 90}d`;
      const time = settings.scheduleTime || '08:00';
      const [h, m] = time.split(':').map(Number);
      const now = new Date();
      let next;
      if (settings.scheduleType === 'weekly') {
        const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const target = DAYS.indexOf(settings.scheduleDay || 'Monday');
        next = new Date(now);
        next.setHours(h, m, 0, 0);
        let diff = (target - now.getDay() + 7) % 7;
        if (diff === 0 && next <= now) diff = 7;
        next.setDate(next.getDate() + diff);
      } else {
        next = new Date(now);
        next.setHours(h, m, 0, 0);
        if (next <= now) next.setDate(next.getDate() + 1);
      }
      const opts = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
      return `Next scan: ${next.toLocaleString('en-US', opts)} · Threshold: ${settings.thresholdDays || 90}d`;
    }
    const schedLabel = _nextRunLabel(_settings);

    const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const s = _settings || {};

    const settingsHtml = `
      <div id="mexp-settings-panel" style="display:${_showSettings ? '' : 'none'};
        background:var(--surface);border:1px solid var(--border);border-radius:12px;
        padding:20px;margin-bottom:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <span style="font-size:14px;font-weight:600">Scan Settings</span>
          <button id="mexp-settings-close" style="background:none;border:none;cursor:pointer;
            color:var(--text-muted);font-size:20px;padding:0 4px;line-height:1">×</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px">
          <div class="field-group">
            <label class="field-label">Expiration Threshold (days)</label>
            <input class="field-input" id="mexp-threshold" type="number" min="1" max="730"
              value="${s.thresholdDays || 90}" style="width:80px" />
            <p class="field-hint">Devices expiring within this window are flagged.</p>
          </div>
          <div class="field-group">
            <label class="field-label">Concurrent AT Lookups</label>
            <input class="field-input" id="mexp-concurrency" type="number" min="1" max="15"
              value="${s.concurrency || 5}" style="width:80px" />
            <p class="field-hint">Parallel CI queries per org (1–15).</p>
          </div>
          <div class="field-group">
            <label class="field-label">Schedule Type</label>
            <select class="field-input" id="mexp-sched-type" style="width:130px;color-scheme:dark">
              <option value="weekly"  ${s.scheduleType === 'weekly'  ? 'selected' : ''}>Weekly</option>
              <option value="monthly" ${s.scheduleType === 'monthly' ? 'selected' : ''}>Monthly</option>
            </select>
          </div>
          <div class="field-group" id="mexp-day-group">
            <label class="field-label" id="mexp-day-label">${s.scheduleType === 'monthly' ? 'Day of Month' : 'Day of Week'}</label>
            ${s.scheduleType === 'monthly'
              ? `<input class="field-input" id="mexp-sched-day" type="number" min="1" max="28" value="${s.scheduleDay || 1}" style="width:80px" />`
              : `<select class="field-input" id="mexp-sched-day" style="width:130px;color-scheme:dark">${DAYS.map(d => `<option value="${d}" ${s.scheduleDay === d ? 'selected' : ''}>${d}</option>`).join('')}</select>`
            }
          </div>
          <div class="field-group">
            <label class="field-label">Scan Time</label>
            <input class="field-input" id="mexp-sched-time" type="time"
              value="${s.scheduleTime || '08:00'}" style="width:100px" />
          </div>
          <div class="field-group" style="display:flex;align-items:flex-end;padding-bottom:6px">
            <label class="dry-run-toggle" style="cursor:pointer">
              <input type="checkbox" id="mexp-sched-enabled" ${s.scheduleEnabled ? 'checked' : ''} />
              Enable scheduled scan
            </label>
          </div>
        </div>
        <div style="margin-top:16px;display:flex;gap:10px;align-items:center">
          <button class="btn btn-primary btn-sm" id="mexp-save-settings">Save Settings</button>
          <span class="save-status" id="mexp-settings-status"></span>
        </div>
      </div>`;

    content.innerHTML = `
      <div class="tool-header" style="margin-bottom:8px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div>
            <h2>Meraki License Management</h2>
            <p class="tool-subtitle">Last scanned: ${fmtScanDate(_cache.scannedAt)} · ${orgsScanned} orgs</p>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-shrink:0;padding-top:4px">
            <button class="btn btn-secondary btn-sm" id="mexp-btn-rescan">Re-scan All</button>
            <button class="btn btn-secondary btn-sm" id="mexp-btn-export-html">Export Report</button>
            <button class="btn btn-secondary btn-sm" id="mexp-btn-export">Export CSV</button>
            <button class="btn btn-secondary btn-sm" id="mexp-btn-batch"
              style="${_batchMode ? 'background:rgba(99,102,241,.2);border-color:var(--accent);color:var(--accent)' : ''}">
              🎫 Batch Tickets${_batchMode ? ` (${_batchSelected.size})` : ''}
            </button>
            <button class="btn btn-secondary btn-sm" id="mexp-btn-settings"
              title="Scan settings" style="${_showSettings ? 'background:rgba(99,102,241,.2);border-color:var(--accent);color:var(--accent)' : ''}">⚙</button>
          </div>
        </div>
      </div>

      <div class="mexp-scheduler-strip">📅 ${escHtml(schedLabel)}</div>

      ${settingsHtml}

      <div class="metric-strip" style="margin-bottom:6px">
        <div class="metric-card m-error">    <span class="metric-num">${expired}</span>  <span class="metric-label">Expired</span></div>
        <div class="metric-card m-critical"> <span class="metric-num">${critical}</span> <span class="metric-label">Critical</span></div>
        <div class="metric-card m-warn">     <span class="metric-num">${warning}</span>  <span class="metric-label">Warning</span></div>
        <div class="metric-card">            <span class="metric-num">${notice}</span>   <span class="metric-label">Notice</span></div>
        <div class="metric-card m-clean">    <span class="metric-num">${orgsScanned}</span> <span class="metric-label">Orgs Scanned</span></div>
      </div>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;font-size:11px;color:var(--text-muted);padding:0 2px">
        ${[
          { css:'mexp-expired',  label:'Expired',  desc:'Past expiration date' },
          { css:'mexp-critical', label:'Critical', desc:`< ${Math.round((_settings?.thresholdDays||90)*0.33)}d remaining` },
          { css:'mexp-warning',  label:'Warning',  desc:`${Math.round((_settings?.thresholdDays||90)*0.33)}–${Math.round((_settings?.thresholdDays||90)*0.67)}d remaining` },
          { css:'mexp-notice',   label:'Notice',   desc:`${Math.round((_settings?.thresholdDays||90)*0.67)}–${_settings?.thresholdDays||90}d remaining` },
          { css:'mexp-clean',    label:'Clean',    desc:`Beyond ${_settings?.thresholdDays||90}d threshold` },
        ].map(s => `<span style="display:flex;align-items:center;gap:5px">
          <span class="mexp-badge ${s.css}" style="font-size:10px;padding:1px 6px">${s.label}</span>
          <span>${s.desc}</span>
        </span>`).join('')}
      </div>

      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;
                  padding:12px 16px;margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;gap:12px">
          <input id="mexp-search" class="field-input" placeholder="Search serial, name, model, org…"
            value="${escHtml(_search)}"
            style="flex:1;min-width:180px;max-width:380px;padding:6px 10px;font-size:13px" />
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
            ${(() => { const { devices, orgs } = computeVisibleCounts();
              return `<span id="mexp-visible-count" style="font-size:12px;color:var(--text-muted)">
                ${devices} device${devices !== 1 ? 's' : ''} · ${orgs} org${orgs !== 1 ? 's' : ''}
              </span>`; })()}
            ${(_filters.size + _excludeFilters.size) > 0 ? `<button id="mexp-clear-filters" style="font-size:11px;padding:2px 8px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer">Clear filters</button>` : ''}
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${FILTER_GROUPS.map(g => `
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span style="font-size:11px;color:var(--text-muted);min-width:80px;flex-shrink:0">${escHtml(g.label)}</span>
              <div style="display:flex;gap:4px;flex-wrap:wrap">
                ${g.filters.map(chipHtml).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>

      <div style="display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-bottom:8px">
        <button id="mexp-expand-all" style="font-size:11px;padding:2px 10px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer">Expand all</button>
        <button id="mexp-collapse-all" style="font-size:11px;padding:2px 10px;border-radius:5px;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer">Collapse all</button>
      </div>

      ${_batchMode ? `
      <div id="mexp-batch-bar" style="position:sticky;top:0;z-index:50;background:var(--surface);
            border:1px solid var(--accent);border-radius:8px;padding:10px 16px;margin-bottom:12px;
            display:flex;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,.3)">
        <span style="font-size:13px;font-weight:600;color:var(--accent)">🎫 Batch mode</span>
        <span id="mexp-batch-count" style="font-size:13px;color:var(--text-muted)">
          ${_batchSelected.size === 0 ? 'Select orgs below' : `${_batchSelected.size} org${_batchSelected.size !== 1 ? 's' : ''} selected`}
        </span>
        <div style="flex:1"></div>
        <button id="mexp-batch-create" ${_batchSelected.size === 0 ? 'disabled' : ''}
          style="padding:6px 16px;border-radius:6px;border:none;
                 background:${_batchSelected.size > 0 ? 'var(--accent)' : 'var(--border)'};
                 color:${_batchSelected.size > 0 ? '#fff' : 'var(--text-muted)'};
                 font-weight:600;cursor:${_batchSelected.size > 0 ? 'pointer' : 'default'};font-size:13px">
          Create ${_batchSelected.size > 0 ? _batchSelected.size : ''} Ticket${_batchSelected.size !== 1 ? 's' : ''}
        </button>
        <button id="mexp-batch-cancel"
          style="padding:6px 14px;border-radius:6px;border:1px solid var(--border);
                 background:none;color:var(--text-muted);cursor:pointer;font-size:13px">
          Cancel
        </button>
      </div>` : ''}

      <div id="mexp-orgs-container">
        ${buildOrgsHtml() || '<div style="color:var(--text-muted);padding:20px;text-align:center;font-size:14px">No devices match the current filter.</div>'}
      </div>

      <div id="mexp-audit-section" style="margin-top:24px"></div>`;

    wireEvents();
    renderAuditSection();
  }

  function sortedDevices(devices) {
    const col = _sortCol;
    const dir = _sortDir === 'asc' ? 1 : -1;
    const SEV = { expired: 0, critical: 1, warning: 2, notice: 3, clean: 4 };
    return [...devices].sort((a, b) => {
      let va, vb;
      if (col === 'severity')      { va = SEV[a.severity] ?? 5;       vb = SEV[b.severity] ?? 5; }
      else if (col === 'name')     { va = (a.name || a.serial).toLowerCase(); vb = (b.name || b.serial).toLowerCase(); }
      else if (col === 'model')    { va = (a.model || '').toLowerCase();      vb = (b.model || '').toLowerCase(); }
      else if (col === 'status')   { va = (a.deviceStatus || '').toLowerCase(); vb = (b.deviceStatus || '').toLowerCase(); }
      else if (col === 'license')  { va = a.licenseExpiry || 'zzz'; vb = b.licenseExpiry || 'zzz'; }
      else if (col === 'eol')      { va = a.eosDate || a.eosaleDate || 'zzz'; vb = b.eosDate || b.eosaleDate || 'zzz'; }
      else if (col === 'at')       { va = a.atMatch && !a.atMatch.error ? 0 : 1; vb = b.atMatch && !b.atMatch.error ? 0 : 1; }
      else return 0;
      if (va < vb) return -1 * dir;
      if (va > vb) return  1 * dir;
      return 0;
    });
  }

  // ── Build org cards HTML ──────────────────────────────────────────────────
  function buildOrgsHtml() {
    if (!_cache?.orgs?.length) return '';
    let html = '';
    _orgDevicesMap.clear();

    const orgs = [..._cache.orgs].sort((a, b) => (a.orgName || '').localeCompare(b.orgName || ''));

    for (const org of orgs) {
      if (org.skipped) continue;

      if (org.error) {
        html += `<div class="mexp-org-card" style="border-left:3px solid var(--error,#f87171)">
          <div class="mexp-org-header" style="cursor:default">
            <span style="font-weight:600">${escHtml(org.orgName)}</span>
            <span class="mexp-badge mexp-expired" style="margin-left:auto">Error</span>
          </div>
          <div style="padding:8px 16px 12px;font-size:12px;color:var(--text-muted)">${escHtml(org.error)}</div>
        </div>`;
        continue;
      }

      // Org-level filter: "Unused licenses" can include or exclude orgs with unassigned licenses
      if (_filters.has('has-unused')        && !(org.unusedLicenses?.length > 0)) continue;
      if (_excludeFilters.has('has-unused') &&  (org.unusedLicenses?.length > 0)) continue;

      const visible = sortedDevices((org.devices || []).filter(d => filterDevice(d) && matchesSearch(d, org.orgName)));
      if (!visible.length && !_filters.has('has-unused')) continue;
      // When "Unused licenses" filter is active, show org even if all devices pass (show org header + assign btn)
      if (!visible.length) {
        // Org matches filter but no devices visible — show a compact card with just the header
        const unusedCount = org.unusedLicenses?.length || 0;
        const orgLicBtnMin = `<button class="mexp-org-assign-btn"
          data-org-id="${escHtml(org.orgId)}"
          data-org-name="${escHtml(org.orgName)}"
          title="${unusedCount} unassigned license${unusedCount !== 1 ? 's' : ''}"
          style="font-size:11px;padding:3px 10px;border-radius:5px;
                 border:1px solid #f59e0b;background:rgba(245,158,11,.1);
                 color:#f59e0b;cursor:pointer;white-space:nowrap">
          ⚠ ${unusedCount} Unused
        </button>`;
        html += `<div class="mexp-org-card" data-org-id="${escHtml(org.orgId)}">
          <div class="mexp-org-header" style="cursor:default">
            <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0">
              <span style="font-weight:600;font-size:14px">${escHtml(org.orgName)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;margin-left:12px">
              <span style="font-size:12px;color:var(--text-muted)">${escHtml(org.atCompanyName || 'No AT match')}</span>
              ${orgLicBtnMin}
            </div>
          </div>
        </div>`;
        continue;
      }

      // Store device list in a Map — avoids putting JSON in an HTML attribute (double-quote quoting issue)
      _orgDevicesMap.set(org.orgId, visible.map(d => ({
        serial:        d.serial,
        name:          d.name || d.serial,
        model:         d.model || '',
        ciId:          String(d.atMatch?.id || ''),
        severity:      d.severity,
        licenseExpiry: d.licenseExpiry || '',
        eosDate:       d.eosDate || '',
      })));

      const worst    = worstSev(visible);
      const expanded = _expandedOrgs.has(org.orgId);
      const cotermBadge = org.isCoterm
        ? `<span class="mexp-badge mexp-coterm" style="margin-left:6px">CO-TERM</span>`
        : '';

      const ticketBtn = org.atCompanyId
        ? `<button class="mexp-ticket-btn"
              data-org-id="${escHtml(org.orgId)}"
              data-org-name="${escHtml(org.orgName)}"
              data-at-company-id="${escHtml(String(org.atCompanyId))}"
              data-at-company-name="${escHtml(org.atCompanyName || '')}"
              style="font-size:11px;padding:3px 10px;border-radius:5px;border:1px solid #10b981;
                     background:rgba(16,185,129,.1);color:#10b981;cursor:pointer;white-space:nowrap">
              🎫 Ticket
           </button>`
        : '';

      const unusedCount = !org.isCoterm ? (org.unusedLicenses?.length || 0) : 0;
      const orgLicBtn = !org.isCoterm
        ? `<button class="mexp-org-lic-btn"
              data-org-id="${escHtml(org.orgId)}"
              data-org-name="${escHtml(org.orgName)}"
              data-at-company-id="${escHtml(String(org.atCompanyId || ''))}"
              data-at-company-name="${escHtml(org.atCompanyName || '')}"
              style="font-size:11px;padding:3px 10px;border-radius:5px;border:1px solid var(--accent);
                     background:rgba(99,102,241,.1);color:var(--accent);cursor:pointer;white-space:nowrap">
              + License
           </button>
           ${unusedCount > 0
             ? `<button class="mexp-org-assign-btn"
                  data-org-id="${escHtml(org.orgId)}"
                  data-org-name="${escHtml(org.orgName)}"
                  title="${unusedCount} unassigned license${unusedCount !== 1 ? 's' : ''} — click to auto-assign"
                  style="font-size:11px;padding:3px 10px;border-radius:5px;
                         border:1px solid #f59e0b;background:rgba(245,158,11,.1);
                         color:#f59e0b;cursor:pointer;white-space:nowrap">
                  ⚠ ${unusedCount} Unused
               </button>`
             : ''}`
        : '';

      // In batch mode: auto-expand selected orgs; hide individual ticket/license buttons
      const isBatchSelected = _batchMode && _batchSelected.has(org.orgId);
      const showExpanded    = expanded || isBatchSelected;
      const batchCb         = _batchMode
        ? `<input type="checkbox" class="mexp-batch-cb" data-org-id="${escHtml(org.orgId)}"
              ${isBatchSelected ? 'checked' : ''}
              style="width:15px;height:15px;cursor:pointer;flex-shrink:0;accent-color:var(--accent)">`
        : '';

      html += `
        <div class="mexp-org-card" data-org-id="${escHtml(org.orgId)}"
          style="${isBatchSelected ? 'border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)' : ''}">
          <div class="mexp-org-header" data-toggle-org="${escHtml(org.orgId)}">
            <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;overflow:hidden">
              ${batchCb}
              <span class="mexp-expand-icon" style="transition:transform .15s;transform:rotate(${showExpanded ? 90 : 0}deg);flex-shrink:0">▸</span>
              <span style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(org.orgName)}</span>
              ${cotermBadge}
            </div>
            <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;margin-left:12px">
              <span style="font-size:12px;color:var(--text-muted);white-space:nowrap">
                ${escHtml(org.atCompanyName || 'No AT match')} · ${visible.length} device${visible.length !== 1 ? 's' : ''}
              </span>
              ${_batchMode ? '' : orgLicBtn}
              ${_batchMode ? '' : ticketBtn}
              ${worst !== 'clean' ? sevBadge(worst) : ''}
            </div>
          </div>
          <div class="mexp-org-devices" style="display:${showExpanded ? '' : 'none'}">
            ${buildDeviceTable(visible, org)}
          </div>
        </div>`;
    }
    return html;
  }

  // Compute days-left fresh from a date string at render time (not from cached scan value).
  // d.daysLeft in the cache is the worst-case figure and may come from EoS, not license expiry.
  function freshDays(dateStr) {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
  }

  function buildDeviceTable(devices, org) {
    const orgIsCoterm    = org?.isCoterm || false;
    const orgId          = org?.orgId          || '';
    const orgName        = org?.orgName        || '';
    const atCompanyId    = org?.atCompanyId    || '';
    const atCompanyName  = org?.atCompanyName  || '';

    const rows = devices.map(d => {
      const cotermOrDevice = orgIsCoterm || d.isCoterm;

      // Compute days fresh per-date so each column shows its own countdown
      const licDays    = freshDays(d.licenseExpiry);
      const eosDays    = freshDays(d.eosDate);
      const eosaleDays = freshDays(d.eosaleDate);

      const licCell = d.licenseExpiry
        ? `${escHtml(fmtDate(d.licenseExpiry))} <span style="color:var(--text-muted);font-size:11px">(${daysLabel(licDays)})</span>`
        : '<span style="color:var(--text-muted)">—</span>';

      const eosCell = `<div>${d.eosaleDate
        ? `<span style="color:var(--text-muted);font-size:10px">Sale: </span>${escHtml(fmtDate(d.eosaleDate))} <span style="color:var(--text-muted);font-size:11px">(${daysLabel(eosaleDays)})</span>`
        : `<span style="color:var(--text-muted)">Sale: —</span>`
      }</div><div style="margin-top:3px">${d.eosDate
        ? `<span style="color:var(--text-muted);font-size:10px">Support: </span>${escHtml(fmtDate(d.eosDate))} <span style="color:var(--text-muted);font-size:11px">(${daysLabel(eosDays)})</span>`
        : `<span style="color:var(--text-muted)">Support: —</span>`
      }</div>`;

      let atCell;
      if (d.atMatch && !d.atMatch.error) {
        const ciUrl    = `https://ww5.autotask.net/Autotask/AutotaskExtend/ExecuteCommand.aspx?Code=OpenInstalledProduct&InstalledProductID=${d.atMatch.id}`;
        const atDate   = d.atMatch.warrantyExpirationDate;
        const atDateFmt = atDate ? fmtDate(atDate) : '—';
        // Mismatch when dates differ OR when AT date is blank but Meraki has one
        const toYmd = s => { if (!s) return ''; const d2 = new Date(s); return isNaN(d2) ? s.slice(0,10) : d2.toISOString().slice(0,10); };
        const liveMismatch = !!(d.licenseExpiry && toYmd(d.licenseExpiry) !== toYmd(atDate));
        const syncBtn  = liveMismatch
          ? `<button class="mexp-sync-at-btn"
                data-serial="${escHtml(d.serial)}"
                data-device-name="${escHtml(d.name || d.serial)}"
                data-ci-id="${escHtml(String(d.atMatch.id))}"
                data-ci-is-active="${d.atMatch.isActive === false ? 'false' : 'true'}"
                data-new-date="${escHtml(d.licenseExpiry || '')}"
                data-old-date="${escHtml(atDate || '')}"
                data-org-name="${escHtml(orgName)}"
                data-at-company-name="${escHtml(atCompanyName)}"
                style="margin-left:5px;font-size:10px;padding:2px 6px;border-radius:4px;
                       border:1px solid #fbbf24;background:rgba(251,191,36,.12);
                       color:#fbbf24;cursor:pointer;white-space:nowrap"
                title="Update AT warranty date to match Meraki (${escHtml(fmtDate(d.licenseExpiry))})">
                Sync ↑
             </button>`
          : '';
        atCell = `<div>
          <a class="mexp-ci-link" href="#" data-url="${escHtml(ciUrl)}"
             style="color:var(--success,#4ade80);font-size:12px;text-decoration:none;cursor:pointer"
             title="Open CI ${d.atMatch.id} in Autotask">Matched</a>
          ${liveMismatch ? `<span style="color:#fbbf24;font-size:10px;margin-left:3px" title="AT date differs from Meraki">⚠</span>` : ''}
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:2px;display:flex;align-items:center">
          AT: ${escHtml(atDateFmt)}${syncBtn}
        </div>`;
      } else {
        const reason = d.atMatch?.error ? d.atMatch.error : d.isUnclaimed ? 'Device not in a network' : 'No CI found for this serial';
        atCell = `<span style="color:var(--text-muted);font-size:12px" title="${escHtml(reason)}">Not matched</span>`;
      }

      return `<tr class="mexp-device-row">
        <td style="padding:8px 12px">${sevBadge(d.severity)}</td>
        <td style="padding:8px 12px">
          <div style="font-weight:500;font-size:13px">${escHtml(d.name || d.serial)}</div>
          <div style="font-size:11px;color:var(--text-muted);font-family:monospace">${escHtml(d.serial)}</div>
        </td>
        <td style="padding:8px 12px;font-size:12px">${escHtml(d.model || '—')}</td>
        <td style="padding:8px 12px;font-size:12px">
          <div style="display:flex;align-items:center">${statusDot(d.isUnclaimed ? 'dormant' : d.deviceStatus)}${escHtml(statusLabel(d))}${d.isUnclaimed ? `<span style="margin-left:5px;font-size:10px;padding:1px 5px;border-radius:4px;background:rgba(107,114,128,.2);color:var(--text-muted)">shelf spare</span>` : ''}</div>
        </td>
        <td style="padding:8px 12px;font-size:12px">${licCell}</td>
        <td style="padding:8px 12px;font-size:12px">${eosCell}</td>
        <td style="padding:8px 12px">${atCell}</td>
      </tr>`;
    }).join('');

    const sortIcon = col => {
      if (_sortCol !== col) return `<span style="opacity:.35;margin-left:4px">⇅</span>`;
      return `<span style="margin-left:4px">${_sortDir === 'asc' ? '▲' : '▼'}</span>`;
    };
    const th = (col, label) =>
      `<th class="mexp-th mexp-th-sort" data-sort-col="${col}" style="cursor:pointer;user-select:none">${label}${sortIcon(col)}</th>`;

    return `<table style="width:100%;border-collapse:collapse">
      <thead>
        <tr>
          ${th('severity', 'Severity')}
          ${th('name',     'Device')}
          ${th('model',    'Model')}
          ${th('status',   'Status')}
          ${th('license',  'License Expiry')}
          ${th('eol',      'End of Life')}
          ${th('at',       'AT Match')}
          <th class="mexp-th">Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  // ── Event wiring ──────────────────────────────────────────────────────────
  function wireEvents() {
    document.getElementById('mexp-btn-rescan')?.addEventListener('click', startScan);
    document.getElementById('mexp-btn-export-html')?.addEventListener('click', exportHtmlReport);
    document.getElementById('mexp-btn-export')?.addEventListener('click', exportCsv);

    // Batch ticket mode toggle
    document.getElementById('mexp-btn-batch')?.addEventListener('click', () => {
      _batchMode = !_batchMode;
      if (!_batchMode) _batchSelected.clear();
      renderReport();
    });
    document.getElementById('mexp-batch-cancel')?.addEventListener('click', () => {
      _batchMode = false;
      _batchSelected.clear();
      renderReport();
    });
    document.getElementById('mexp-batch-create')?.addEventListener('click', () => {
      if (_batchSelected.size === 0) return;
      showBatchTicketModal();
    });

    document.getElementById('mexp-btn-settings')?.addEventListener('click', () => {
      _showSettings = !_showSettings;
      render();
    });
    document.getElementById('mexp-settings-close')?.addEventListener('click', () => {
      _showSettings = false;
      render();
    });

    document.getElementById('mexp-save-settings')?.addEventListener('click', saveSettings);

    // Schedule type dropdown changes day widget between select and number input
    document.getElementById('mexp-sched-type')?.addEventListener('change', e => {
      const dayGroup = document.getElementById('mexp-day-group');
      const dayLabel = document.getElementById('mexp-day-label');
      if (!dayGroup || !dayLabel) return;
      const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      if (e.target.value === 'monthly') {
        dayLabel.textContent = 'Day of Month';
        const inp = Object.assign(document.createElement('input'), {
          id: 'mexp-sched-day', type: 'number', min: '1', max: '28',
          value: '1', className: 'field-input',
        });
        inp.style.width = '80px';
        dayGroup.querySelector('input,select')?.replaceWith(inp);
      } else {
        dayLabel.textContent = 'Day of Week';
        const sel = document.createElement('select');
        sel.id = 'mexp-sched-day'; sel.className = 'field-input'; sel.style.width = '130px';
        sel.style.colorScheme = 'dark';
        DAYS.forEach(d => {
          const o = document.createElement('option');
          o.value = d; o.textContent = d;
          if ((_settings?.scheduleDay || 'Monday') === d) o.selected = true;
          sel.appendChild(o);
        });
        dayGroup.querySelector('input,select')?.replaceWith(sel);
      }
    });

    // Multi-select filter chips — 3-state: off → include (green) → exclude (red) → off
    content.querySelectorAll('.mexp-filter-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const f = btn.dataset.filter;
        if (_filters.has(f)) {
          // include → exclude
          _filters.delete(f);
          _excludeFilters.add(f);
        } else if (_excludeFilters.has(f)) {
          // exclude → off
          _excludeFilters.delete(f);
        } else {
          // off → include
          _filters.add(f);
        }
        // Changing filters invalidates batch selections — orgs may no longer be visible
        if (_batchMode) _batchSelected.clear();
        renderReport();
      });
    });

    // Clear all filters
    document.getElementById('mexp-clear-filters')?.addEventListener('click', () => {
      _filters.clear();
      _excludeFilters.clear();
      if (_batchMode) _batchSelected.clear();
      renderReport();
    });

    // Expand / collapse all org cards
    document.getElementById('mexp-expand-all')?.addEventListener('click', () => {
      (_cache?.orgs || []).forEach(o => { if (!o.skipped && !o.error) _expandedOrgs.add(o.orgId); });
      refreshOrgs();
    });
    document.getElementById('mexp-collapse-all')?.addEventListener('click', () => {
      _expandedOrgs.clear();
      refreshOrgs();
    });

    // Search (debounced)
    const searchEl = document.getElementById('mexp-search');
    if (searchEl) {
      let timer;
      searchEl.addEventListener('input', e => {
        clearTimeout(timer);
        timer = setTimeout(() => { _search = e.target.value; refreshOrgs(); }, 200);
      });
    }

    // Org expand/collapse + "Add License" button — event delegation on the container
    const container = document.getElementById('mexp-orgs-container');
    if (container) {
      container.addEventListener('click', async e => {
        // Column sort
        const sortTh = e.target.closest('.mexp-th-sort');
        if (sortTh) {
          const col = sortTh.dataset.sortCol;
          if (_sortCol === col) _sortDir = _sortDir === 'asc' ? 'desc' : 'asc';
          else { _sortCol = col; _sortDir = 'asc'; }
          refreshOrgs();
          return;
        }

        // AT CI link — open in browser
        const ciLink = e.target.closest('.mexp-ci-link');
        if (ciLink) {
          e.preventDefault();
          e.stopPropagation();
          const url = ciLink.dataset.url;
          if (url) window.api.homeOpenUrl(url);
          return;
        }

        // Sync AT date button
        const syncBtn = e.target.closest('.mexp-sync-at-btn');
        if (syncBtn) {
          e.stopPropagation();
          syncBtn.disabled = true;
          syncBtn.textContent = '…';
          const res = await window.api.merakiExpSyncAtDate({
            ciId:          syncBtn.dataset.ciId,
            ciIsActive:    syncBtn.dataset.ciIsActive !== 'false',
            newDate:       syncBtn.dataset.newDate,
            oldDate:       syncBtn.dataset.oldDate,
            deviceSerial:  syncBtn.dataset.serial,
            deviceName:    syncBtn.dataset.deviceName,
            orgName:       syncBtn.dataset.orgName,
            atCompanyName: syncBtn.dataset.atCompanyName,
          });
          if (res.ok) {
            // Visual feedback — replace the whole AT cell inline
            const td = syncBtn.closest('td');
            if (td) {
              const link = td.querySelector('.mexp-ci-link');
              if (link) link.nextElementSibling?.remove(); // remove ⚠
              syncBtn.closest('div')?.remove(); // remove the AT date row
              const dateRow = document.createElement('div');
              dateRow.style.cssText = 'font-size:11px;color:var(--text-muted);margin-top:2px';
              dateRow.textContent = `AT: ${syncBtn.dataset.newDate ? new Date(syncBtn.dataset.newDate).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}`;
              td.appendChild(dateRow);
            }
          } else {
            syncBtn.disabled = false;
            syncBtn.textContent = 'Sync ↑';
            syncBtn.title = `Failed: ${res.error || 'unknown error'}`;
            syncBtn.style.borderColor = 'var(--error)';
            syncBtn.style.color = 'var(--error)';
          }
          return;
        }

        // "Ticket" button
        const ticketBtn2 = e.target.closest('.mexp-ticket-btn');
        if (ticketBtn2) {
          e.stopPropagation();
          const devices = _orgDevicesMap.get(ticketBtn2.dataset.orgId) || [];
          showTicketModal({
            orgId:         ticketBtn2.dataset.orgId,
            orgName:       ticketBtn2.dataset.orgName,
            atCompanyId:   ticketBtn2.dataset.atCompanyId,
            atCompanyName: ticketBtn2.dataset.atCompanyName,
            devices,
          });
          return;
        }

        // "+ License" org-level button
        const licBtn = e.target.closest('.mexp-org-lic-btn');
        if (licBtn) {
          e.stopPropagation();
          showRenewModal({
            orgId:         licBtn.dataset.orgId,
            orgName:       licBtn.dataset.orgName,
            atCompanyId:   licBtn.dataset.atCompanyId,
            atCompanyName: licBtn.dataset.atCompanyName,
          });
          return;
        }

        // "Assign Unused" button — assign already-claimed unassigned licenses
        const assignBtn = e.target.closest('.mexp-org-assign-btn');
        if (assignBtn) {
          e.stopPropagation();
          await showAssignLicensesModal({
            orgId:   assignBtn.dataset.orgId,
            orgName: assignBtn.dataset.orgName,
            btn:     assignBtn,
          });
          return;
        }

        // Batch mode checkbox — toggle org selection, auto-expand, update bar
        const batchCb = e.target.closest('.mexp-batch-cb');
        if (batchCb) {
          const orgId = batchCb.dataset.orgId;
          if (batchCb.checked) {
            _batchSelected.add(orgId);
            _expandedOrgs.add(orgId);  // auto-expand so devices are visible
          } else {
            _batchSelected.delete(orgId);
          }
          refreshOrgs();
          // Update batch bar count + button without full re-render
          const countEl  = document.getElementById('mexp-batch-count');
          const createEl = document.getElementById('mexp-batch-create');
          if (countEl) countEl.textContent = _batchSelected.size === 0
            ? 'Select orgs below'
            : `${_batchSelected.size} org${_batchSelected.size !== 1 ? 's' : ''} selected`;
          if (createEl) {
            createEl.disabled  = _batchSelected.size === 0;
            createEl.textContent = `Create ${_batchSelected.size > 0 ? _batchSelected.size : ''} Ticket${_batchSelected.size !== 1 ? 's' : ''}`;
            createEl.style.background = _batchSelected.size > 0 ? 'var(--accent)' : 'var(--border)';
            createEl.style.color      = _batchSelected.size > 0 ? '#fff' : 'var(--text-muted)';
            createEl.style.cursor     = _batchSelected.size > 0 ? 'pointer' : 'default';
          }
          // Update header button label
          const batchBtn = document.getElementById('mexp-btn-batch');
          if (batchBtn) batchBtn.textContent = `🎫 Batch Tickets (${_batchSelected.size})`;
          return;
        }

        // Org expand/collapse
        const header = e.target.closest('[data-toggle-org]');
        if (!header) return;
        const orgId = header.dataset.toggleOrg;
        if (_expandedOrgs.has(orgId)) _expandedOrgs.delete(orgId);
        else _expandedOrgs.add(orgId);
        const card    = container.querySelector(`.mexp-org-card[data-org-id="${orgId}"]`);
        const devices = card?.querySelector('.mexp-org-devices');
        const icon    = card?.querySelector('.mexp-expand-icon');
        const open    = _expandedOrgs.has(orgId);
        if (devices) devices.style.display = open ? '' : 'none';
        if (icon)    icon.style.transform  = open ? 'rotate(90deg)' : 'rotate(0deg)';
      });
    }
  }

  // ── Refresh just the org cards (filter/search changed) ───────────────────
  function refreshOrgs() {
    const el = document.getElementById('mexp-orgs-container');
    if (!el) return;
    el.innerHTML = buildOrgsHtml()
      || '<div style="color:var(--text-muted);padding:20px;text-align:center;font-size:14px">No devices match the current filter.</div>';
    // Update the live device/org count label without full re-render
    const countEl = document.getElementById('mexp-visible-count');
    if (countEl) {
      const { devices, orgs } = computeVisibleCounts();
      countEl.textContent = `${devices} device${devices !== 1 ? 's' : ''} · ${orgs} org${orgs !== 1 ? 's' : ''}`;
    }
  }

  // ── Scan ──────────────────────────────────────────────────────────────────
  async function startScan() {
    if (_scanning) return;
    _scanning  = true;
    _scanLog   = ['Initializing scan…'];
    _scanDone  = 0;
    _scanTotal = 0;
    render();

    if (_progressUnsub) { _progressUnsub(); _progressUnsub = null; }
    _progressUnsub = window.api.onMerakiExpProgress(data => {
      if (data.msg) _scanLog.push(data.msg);
      if (_scanLog.length > 300) _scanLog = _scanLog.slice(-250);
      if (data.orgsDone !== undefined) _scanDone  = data.orgsDone;
      if (data.orgsTotal)              _scanTotal = data.orgsTotal;
      renderScanning();
    });

    try {
      const res = await window.api.merakiExpScan();
      if (res.ok) _cache = res.data;
      else _scanLog.push(`Scan failed: ${res.error || 'Unknown error'}`);
    } catch (e) {
      _scanLog.push(`Error: ${e.message}`);
    } finally {
      if (_progressUnsub) { _progressUnsub(); _progressUnsub = null; }
      _scanning = false;
      const sr = await window.api.merakiExpGetSettings().catch(() => null);
      if (sr?.ok) _settings = sr.data;
      render();
    }
  }

  // ── Save settings ─────────────────────────────────────────────────────────
  async function saveSettings() {
    const get   = id => document.getElementById(id);
    const threshold   = parseInt(get('mexp-threshold')?.value, 10);
    const concurrency = parseInt(get('mexp-concurrency')?.value, 10);
    const payload = {
      thresholdDays:   isNaN(threshold)   ? (_settings?.thresholdDays || 90) : threshold,
      concurrency:     isNaN(concurrency) ? (_settings?.concurrency   || 5)  : concurrency,
      scheduleType:    get('mexp-sched-type')?.value    || 'weekly',
      scheduleDay:     get('mexp-sched-day')?.value     || 'Monday',
      scheduleTime:    get('mexp-sched-time')?.value    || '08:00',
      scheduleEnabled: get('mexp-sched-enabled')?.checked ?? true,
    };
    const statusEl = get('mexp-settings-status');
    if (statusEl) statusEl.textContent = 'Saving…';
    const res = await window.api.merakiExpSaveSettings(payload);
    if (res.ok) {
      _settings = payload;
      if (statusEl) { statusEl.textContent = 'Saved ✓'; statusEl.style.color = 'var(--success,#4ade80)'; }
      setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 2000);
    } else {
      if (statusEl) { statusEl.textContent = `Error: ${res.error}`; statusEl.style.color = 'var(--error,#f87171)'; }
    }
  }

  // ── Export CSV ────────────────────────────────────────────────────────────
  function exportCsv() {
    if (!_cache?.orgs) return;
    const header = ['Org','AT Company','Serial','Device Name','Model','Product Type',
                    'Device Status','Severity','Days Left','Issue Type',
                    'License Expiry','EoS Date','EoSale Date',
                    'Co-Term','Unclaimed','AT CI ID','AT Warranty Date','AT Date Mismatch'];
    const rows = [header];
    for (const org of _cache.orgs) {
      if (org.skipped || org.error) continue;
      for (const d of (org.devices || [])) {
        rows.push([
          org.orgName, org.atCompanyName || '',
          d.serial, d.name || '', d.model || '', d.productType || '', d.deviceStatus || '',
          d.severity, d.daysLeft ?? '', d.issueType || '',
          d.licenseExpiry || '', d.eosDate || '', d.eosaleDate || '',
          d.isCoterm ? 'Yes' : 'No', d.isUnclaimed ? 'Yes' : 'No',
          d.atMatch?.id || '', d.atMatch?.warrantyExpirationDate || '',
          d.atDateMismatch ? 'Yes' : 'No',
        ]);
      }
    }
    const csv  = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url,
      download: `meraki-expiration-${new Date().toISOString().slice(0,10)}.csv`,
    });
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
  }

  // ── Export HTML Report ────────────────────────────────────────────────────
  function exportHtmlReport() {
    if (!_cache?.orgs) return;

    const orgs     = _cache.orgs.filter(o => !o.skipped && !o.error);
    const scanDate = _cache.scannedAt ? new Date(_cache.scannedAt).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }) : 'Unknown';
    const genDate  = new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' });

    // ── Aggregate stats ──
    let totalDevices = 0, expired = 0, critical = 0, warning = 0, notice = 0, clean = 0, mismatch = 0;
    const orgStats = [];
    for (const org of orgs) {
      const s = { name: org.atCompanyName || org.orgName, orgName: org.orgName, isCoterm: org.isCoterm,
                  expired: 0, critical: 0, warning: 0, notice: 0, clean: 0, devices: [], nextExpiry: null };
      for (const d of (org.devices || [])) {
        if (d.isUnclaimed) continue;
        totalDevices++;
        s[d.severity] = (s[d.severity] || 0) + 1;
        if (d.severity === 'expired')  expired++;
        else if (d.severity === 'critical') critical++;
        else if (d.severity === 'warning')  warning++;
        else if (d.severity === 'notice')   notice++;
        else clean++;
        if (d.atDateMismatch) mismatch++;
        if (d.severity !== 'clean') s.devices.push(d);
        if (d.licenseExpiry && d.severity !== 'clean') {
          if (!s.nextExpiry || d.licenseExpiry < s.nextExpiry) s.nextExpiry = d.licenseExpiry;
        }
      }
      s.total = s.expired + s.critical + s.warning + s.notice + s.clean;
      if (s.expired + s.critical + s.warning + s.notice > 0) orgStats.push(s);
    }
    orgStats.sort((a, b) => (b.expired * 10 + b.critical * 4 + b.warning) - (a.expired * 10 + a.critical * 4 + a.warning));

    const flagged   = expired + critical + warning + notice;
    const pctClean  = totalDevices > 0 ? Math.round((clean / totalDevices) * 100) : 100;

    // Health score: weighted deduction per flagged device
    const deductions = expired * 10 + critical * 5 + warning * 2 + notice * 0.5;
    const maxDeduct  = totalDevices * 10;
    const score      = maxDeduct > 0 ? Math.max(0, Math.round(100 - (deductions / maxDeduct) * 100)) : 100;
    const grade      = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';
    const gradeColor = score >= 90 ? '#16a34a' : score >= 75 ? '#2563eb' : score >= 60 ? '#d97706' : score >= 40 ? '#ea580c' : '#dc2626';
    const gradeLabel = score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : score >= 60 ? 'Needs Attention' : score >= 40 ? 'At Risk' : 'Critical';

    const fmtDate = s => { if (!s) return '—'; const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); };
    const severityBadge = (sev, count) => {
      if (!count) return '';
      const colors = { expired: '#dc2626', critical: '#ea580c', warning: '#d97706', notice: '#2563eb' };
      return `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:${colors[sev]}1a;color:${colors[sev]};border:1px solid ${colors[sev]}40;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">${count} ${sev}</span>`;
    };

    const barPct = k => totalDevices > 0 ? ((({ expired, critical, warning, notice, clean })[k] / totalDevices) * 100).toFixed(1) : 0;
    const barSegment = (color, pct, label) => pct > 0
      ? `<div title="${label}: ${pct}%" style="width:${pct}%;background:${color};height:100%;display:inline-block;vertical-align:top"></div>` : '';

    // ── Per-org sections ──
    const orgSections = orgStats.map(s => {
      const rows = s.devices.map(d => {
        const sevColors = { expired: '#dc2626', critical: '#ea580c', warning: '#d97706', notice: '#2563eb' };
        const c = sevColors[d.severity] || '#64748b';
        const daysLabel = d.daysLeft < 0 ? `${Math.abs(d.daysLeft)}d ago` : d.daysLeft != null ? `${d.daysLeft}d` : '—';
        return `<tr>
          <td>${escHtml(d.name || d.serial)}</td>
          <td style="color:#64748b;font-size:12px">${escHtml(d.model || '—')}</td>
          <td style="font-family:monospace;font-size:12px;color:#64748b">${escHtml(d.serial)}</td>
          <td><span style="padding:1px 7px;border-radius:3px;background:${c}1a;color:${c};border:1px solid ${c}40;font-size:11px;font-weight:700;text-transform:uppercase">${escHtml(d.severity)}</span></td>
          <td style="font-weight:600;color:${c}">${escHtml(daysLabel)}</td>
          <td>${escHtml(fmtDate(d.licenseExpiry))}</td>
          <td>${escHtml(d.issueType === 'eos' ? 'End of Support' : d.issueType === 'both' ? 'License + EoS' : 'License Renewal')}</td>
          <td style="color:${d.atMatch ? (d.atDateMismatch ? '#d97706' : '#16a34a') : '#94a3b8'}">${d.atMatch ? (d.atDateMismatch ? '⚠ Mismatch' : '✓ Synced') : 'Not in AT'}</td>
        </tr>`;
      }).join('');
      const coterm = s.isCoterm ? `<span style="margin-left:6px;padding:1px 8px;border-radius:3px;background:#6366f11a;color:#6366f1;border:1px solid #6366f140;font-size:11px;font-weight:600">CO-TERM</span>` : '';
      return `
      <div style="margin-bottom:28px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden">
        <div style="background:#f8fafc;padding:12px 18px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span style="font-weight:700;font-size:15px;color:#1e293b">${escHtml(s.name)}</span>
          ${coterm}
          <span style="color:#94a3b8;font-size:12px;margin-left:4px">${escHtml(s.orgName !== s.name ? '· ' + s.orgName : '')}</span>
          <span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
            ${severityBadge('expired', s.expired)}${severityBadge('critical', s.critical)}${severityBadge('warning', s.warning)}${severityBadge('notice', s.notice)}
          </span>
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead><tr style="background:#f1f5f9;color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:.5px">
              <th style="padding:8px 14px;text-align:left;font-weight:600">Device</th>
              <th style="padding:8px 14px;text-align:left;font-weight:600">Model</th>
              <th style="padding:8px 14px;text-align:left;font-weight:600">Serial</th>
              <th style="padding:8px 14px;text-align:left;font-weight:600">Severity</th>
              <th style="padding:8px 14px;text-align:left;font-weight:600">Days Left</th>
              <th style="padding:8px 14px;text-align:left;font-weight:600">License Expiry</th>
              <th style="padding:8px 14px;text-align:left;font-weight:600">Issue</th>
              <th style="padding:8px 14px;text-align:left;font-weight:600">AT Status</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
    }).join('');

    const noIssuesMsg = orgStats.length === 0
      ? `<div style="text-align:center;padding:48px;color:#64748b;font-size:15px">✓ No flagged devices across any monitored org.</div>` : '';

    // ── Full HTML ──
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Meraki License Health Report — ${genDate}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;color:#1e293b;font-size:14px;line-height:1.5}
  @media print{body{background:#fff}.no-print{display:none!important}@page{margin:1.5cm}}
  table td,table th{padding:9px 14px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
  table tbody tr:last-child td{border-bottom:none}
  table tbody tr:hover{background:#f8fafc}
  h2{font-size:18px;font-weight:700;margin-bottom:16px;color:#1e293b}
  h3{font-size:14px;font-weight:600;color:#475569;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
</style>
</head>
<body>

<!-- HEADER -->
<div style="background:#1e293b;color:#fff;padding:24px 40px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
  <div>
    <div style="font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#94a3b8;margin-bottom:4px">Anchor Network Solutions</div>
    <div style="font-size:22px;font-weight:700">Meraki License Health Report</div>
  </div>
  <div style="text-align:right;font-size:12px;color:#94a3b8;line-height:1.8">
    <div>Generated: <strong style="color:#e2e8f0">${escHtml(genDate)}</strong></div>
    <div>Scan data: <strong style="color:#e2e8f0">${escHtml(scanDate)}</strong></div>
    <div>${escHtml(String(orgs.length))} orgs · ${escHtml(String(totalDevices))} devices monitored</div>
  </div>
</div>

<div style="max-width:1100px;margin:0 auto;padding:32px 24px">

<!-- EXECUTIVE SUMMARY -->
<div style="margin-bottom:32px">
  <h2>Executive Summary</h2>
  <div style="display:grid;grid-template-columns:200px 1fr;gap:24px;align-items:start">

    <!-- Health score -->
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;text-align:center">
      <div style="font-size:64px;font-weight:800;color:${gradeColor};line-height:1">${escHtml(grade)}</div>
      <div style="font-size:28px;font-weight:700;color:${gradeColor};margin:4px 0">${escHtml(String(score))}</div>
      <div style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.5px">${escHtml(gradeLabel)}</div>
      <div style="font-size:11px;color:#94a3b8;margin-top:8px">Health Score</div>
    </div>

    <!-- Metric cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px">
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px">
        <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Expired</div>
        <div style="font-size:32px;font-weight:800;color:${expired > 0 ? '#dc2626' : '#16a34a'}">${escHtml(String(expired))}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:2px">Immediate action</div>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px">
        <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Critical</div>
        <div style="font-size:32px;font-weight:800;color:${critical > 0 ? '#ea580c' : '#16a34a'}">${escHtml(String(critical))}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:2px">Expiring &lt; ${escHtml(String(Math.round((_settings?.thresholdDays||90)*0.33)))}d</div>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px">
        <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Warning</div>
        <div style="font-size:32px;font-weight:800;color:${warning > 0 ? '#d97706' : '#16a34a'}">${escHtml(String(warning))}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:2px">Expiring &lt; ${escHtml(String(Math.round((_settings?.thresholdDays||90)*0.67)))}d</div>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px">
        <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Notice</div>
        <div style="font-size:32px;font-weight:800;color:${notice > 0 ? '#2563eb' : '#16a34a'}">${escHtml(String(notice))}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:2px">Expiring &lt; ${escHtml(String(_settings?.thresholdDays||90))}d</div>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px">
        <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">AT Mismatches</div>
        <div style="font-size:32px;font-weight:800;color:${mismatch > 0 ? '#d97706' : '#16a34a'}">${escHtml(String(mismatch))}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:2px">Dates out of sync</div>
      </div>
      <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px">
        <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Clients Affected</div>
        <div style="font-size:32px;font-weight:800;color:${orgStats.length > 0 ? '#6366f1' : '#16a34a'}">${escHtml(String(orgStats.length))}</div>
        <div style="font-size:11px;color:#94a3b8;margin-top:2px">of ${escHtml(String(orgs.length))} total</div>
      </div>
    </div>
  </div>
</div>

<!-- RISK DISTRIBUTION BAR -->
<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:20px;margin-bottom:32px">
  <h3>Fleet Risk Distribution</h3>
  <div style="height:20px;border-radius:6px;overflow:hidden;background:#f1f5f9;margin-bottom:12px">
    ${barSegment('#dc2626', barPct('expired'),  'Expired')}
    ${barSegment('#ea580c', barPct('critical'), 'Critical')}
    ${barSegment('#d97706', barPct('warning'),  'Warning')}
    ${barSegment('#2563eb', barPct('notice'),   'Notice')}
    ${barSegment('#16a34a', barPct('clean'),    'Clean')}
  </div>
  <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:12px;color:#64748b">
    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#dc2626;margin-right:5px;vertical-align:middle"></span>Expired ${barPct('expired')}% (${expired})</span>
    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#ea580c;margin-right:5px;vertical-align:middle"></span>Critical ${barPct('critical')}% (${critical})</span>
    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#d97706;margin-right:5px;vertical-align:middle"></span>Warning ${barPct('warning')}% (${warning})</span>
    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#2563eb;margin-right:5px;vertical-align:middle"></span>Notice ${barPct('notice')}% (${notice})</span>
    <span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:#16a34a;margin-right:5px;vertical-align:middle"></span>Clean ${barPct('clean')}% (${clean})</span>
  </div>
</div>

<!-- CLIENT RISK SUMMARY TABLE -->
${orgStats.length > 0 ? `
<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:32px">
  <div style="padding:16px 20px;border-bottom:1px solid #e2e8f0">
    <h2 style="margin:0">Client Risk Summary</h2>
  </div>
  <div style="overflow-x:auto">
  <table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead><tr style="background:#f8fafc;color:#475569;font-size:11px;text-transform:uppercase;letter-spacing:.5px">
      <th style="padding:10px 16px;text-align:left;font-weight:600">Client</th>
      <th style="padding:10px 16px;text-align:center;font-weight:600;color:#dc2626">Expired</th>
      <th style="padding:10px 16px;text-align:center;font-weight:600;color:#ea580c">Critical</th>
      <th style="padding:10px 16px;text-align:center;font-weight:600;color:#d97706">Warning</th>
      <th style="padding:10px 16px;text-align:center;font-weight:600;color:#2563eb">Notice</th>
      <th style="padding:10px 16px;text-align:left;font-weight:600">Next Expiry</th>
      <th style="padding:10px 16px;text-align:left;font-weight:600">Flagged Devices</th>
    </tr></thead>
    <tbody>
      ${orgStats.map(s => `<tr>
        <td style="font-weight:600">${escHtml(s.name)}${s.isCoterm ? ' <span style="font-size:10px;color:#6366f1;font-weight:600">CO-TERM</span>' : ''}</td>
        <td style="text-align:center;font-weight:700;color:${s.expired > 0 ? '#dc2626' : '#94a3b8'}">${s.expired || '—'}</td>
        <td style="text-align:center;font-weight:700;color:${s.critical > 0 ? '#ea580c' : '#94a3b8'}">${s.critical || '—'}</td>
        <td style="text-align:center;font-weight:700;color:${s.warning > 0 ? '#d97706' : '#94a3b8'}">${s.warning || '—'}</td>
        <td style="text-align:center;font-weight:700;color:${s.notice > 0 ? '#2563eb' : '#94a3b8'}">${s.notice || '—'}</td>
        <td style="font-size:12px;color:#475569">${escHtml(fmtDate(s.nextExpiry))}</td>
        <td style="font-size:12px;color:#64748b">${escHtml(String(s.devices.length))} device${s.devices.length !== 1 ? 's' : ''}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  </div>
</div>` : ''}

<!-- PER-CLIENT DEVICE DETAIL -->
${orgStats.length > 0 ? `<h2 style="margin-bottom:16px">Device Detail by Client</h2>${orgSections}` : noIssuesMsg}

</div>

<!-- FOOTER -->
<div style="background:#1e293b;color:#64748b;padding:16px 40px;font-size:11px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
  <span>Generated by <strong style="color:#94a3b8">Anchor Hub</strong> · Meraki Expiration Report</span>
  <span>CONFIDENTIAL — For internal use only</span>
  <span>${escHtml(genDate)}</span>
</div>

</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url,
      download: `meraki-license-health-${new Date().toISOString().slice(0,10)}.html`,
    });
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
  }

  // ── Batch ticket creation modal ───────────────────────────────────────────
  async function showBatchTicketModal() {
    // Build the list of orgs + their filtered devices
    const selectedOrgs = (_cache?.orgs || [])
      .filter(o => _batchSelected.has(o.orgId) && !o.skipped && !o.error)
      .map(o => ({
        orgId:         o.orgId,
        orgName:       o.orgName,
        atCompanyId:   o.atCompanyId,
        atCompanyName: o.atCompanyName,
        devices:       _orgDevicesMap.get(o.orgId) || [],
      }))
      .filter(o => o.devices.length > 0 && o.atCompanyId);

    if (!selectedOrgs.length) {
      alert('No qualifying orgs selected.\n\nOrgs need an AT company match and at least one visible device under the current filters.');
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'mexp-batch-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;display:flex;align-items:center;justify-content:center';

    const selStyle = `background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 8px;color:var(--text);font-size:13px;color-scheme:dark`;

    modal.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border-2);border-radius:10px;
                  width:640px;max-width:calc(100vw - 32px);max-height:90vh;display:flex;flex-direction:column;overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
          <div>
            <div style="font-weight:600;font-size:15px">🎫 Batch Ticket Creation</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${selectedOrgs.length} org${selectedOrgs.length !== 1 ? 's' : ''} · ${selectedOrgs.reduce((n,o) => n + o.devices.length, 0)} devices</div>
          </div>
          <button id="mexp-batch-modal-close" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;line-height:1;padding:4px">✕</button>
        </div>
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);flex-shrink:0">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px;font-weight:600">SHARED SETTINGS</div>
          <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Assign to</label>
              ${_currentAtResource
                ? `<div style="display:flex;align-items:center;height:34px;background:var(--bg);
                               border:1px solid var(--border);border-radius:6px;padding:0 10px;
                               color:var(--text);font-size:13px;gap:8px">
                     <span style="flex:1">${escHtml(_currentAtResource.firstName + ' ' + _currentAtResource.lastName)}</span>
                     <button id="mexp-batch-assignto-change"
                       style="background:none;border:none;color:var(--text-muted);font-size:11px;
                              cursor:pointer;padding:0;text-decoration:underline">change</button>
                   </div>
                   <input type="hidden" id="mexp-batch-assignto" value="${escHtml(_currentAtResource.firstName)}">`
                : `<select id="mexp-batch-assignto" style="${selStyle}">
                     <option value="">No assignment</option>
                     <option value="Gary">Gary</option>
                     <option value="Shawn">Shawn</option>
                   </select>`
              }
            </div>
          </div>
        </div>
        <div style="padding:16px 20px;overflow-y:auto;flex:1">
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;font-weight:600">SUMMARY — 1 ticket will be created per org</div>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <thead>
              <tr style="border-bottom:1px solid var(--border)">
                <th style="text-align:left;padding:6px 8px;font-weight:600;color:var(--text-muted)">Org / AT Company</th>
                <th style="text-align:left;padding:6px 8px;font-weight:600;color:var(--text-muted)">Devices in ticket</th>
                <th style="text-align:center;padding:6px 8px;font-weight:600;color:var(--text-muted);width:80px">Status</th>
              </tr>
            </thead>
            <tbody>
              ${selectedOrgs.map((o, i) => `
                <tr style="border-bottom:1px solid var(--border)">
                  <td style="padding:8px">
                    <div style="font-weight:600">${escHtml(o.orgName)}</div>
                    <div style="font-size:11px;color:var(--text-muted)">${escHtml(o.atCompanyName || '')}</div>
                  </td>
                  <td style="padding:8px">
                    <div style="font-size:12px;color:var(--text-muted)">${o.devices.map(d => `${escHtml(d.name)} (${escHtml(d.model)})`).join(', ')}</div>
                  </td>
                  <td style="padding:8px;text-align:center" id="mexp-batch-row-${i}">
                    <span style="font-size:11px;color:var(--text-muted)">—</span>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-shrink:0">
          <button id="mexp-batch-confirm" style="padding:7px 18px;border-radius:6px;border:none;background:var(--accent);color:#fff;font-weight:600;cursor:pointer;font-size:13px">
            Create ${selectedOrgs.length} Ticket${selectedOrgs.length !== 1 ? 's' : ''}
          </button>
          <button id="mexp-batch-close-btn" style="padding:7px 14px;border-radius:6px;border:1px solid var(--border);background:none;color:var(--text);cursor:pointer;font-size:13px">Cancel</button>
          <div id="mexp-batch-summary-status" style="flex:1;font-size:12px;color:var(--text-muted);text-align:right"></div>
        </div>
      </div>`;

    document.body.appendChild(modal);

    // "change" link — swap locked assignee display for the dropdown
    document.getElementById('mexp-batch-assignto-change')?.addEventListener('click', () => {
      const hidden = document.getElementById('mexp-batch-assignto');
      const wrap   = hidden?.closest('div');
      if (!wrap) return;
      wrap.innerHTML = `
        <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Assign to</label>
        <select id="mexp-batch-assignto" style="${selStyle}">
          <option value="">No assignment</option>
          <option value="Gary">Gary</option>
          <option value="Shawn">Shawn</option>
        </select>`;
    });

    const close = () => modal.remove();
    document.getElementById('mexp-batch-modal-close').addEventListener('click', close);
    document.getElementById('mexp-batch-close-btn').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    document.getElementById('mexp-batch-confirm').addEventListener('click', async () => {
      const confirmBtn  = document.getElementById('mexp-batch-confirm');
      const closeBtn    = document.getElementById('mexp-batch-close-btn');
      const statusEl    = document.getElementById('mexp-batch-summary-status');
      const assignTo    = document.getElementById('mexp-batch-assignto')?.value || null;

      confirmBtn.disabled = true;
      closeBtn.disabled   = true;
      confirmBtn.textContent = 'Creating…';

      let done = 0, failed = 0;

      for (let i = 0; i < selectedOrgs.length; i++) {
        const o    = selectedOrgs[i];
        const rowEl = document.getElementById(`mexp-batch-row-${i}`);
        if (rowEl) rowEl.innerHTML = `<span style="font-size:11px;color:var(--text-muted)">…</span>`;

        try {
          const res = await window.api.merakiExpCreateTicket({
            atCompanyId:   o.atCompanyId,
            atCompanyName: o.atCompanyName,
            orgName:       o.orgName,
            devices:       o.devices,
            assignTo,
          });
          if (res.ok) {
            done++;
            if (rowEl) rowEl.innerHTML = `
              <span style="font-size:11px;color:#4ade80" title="Ticket ${escHtml(res.ticketNumber || String(res.ticketId))}">
                ✓ #${escHtml(res.ticketNumber || String(res.ticketId))}
              </span>`;
          } else {
            failed++;
            if (rowEl) rowEl.innerHTML = `<span style="font-size:11px;color:#f87171" title="${escHtml(res.error || '')}">✗ Failed</span>`;
          }
        } catch (err) {
          failed++;
          if (rowEl) rowEl.innerHTML = `<span style="font-size:11px;color:#f87171" title="${escHtml(err.message)}">✗ Error</span>`;
        }

        if (statusEl) statusEl.textContent = `${done + failed} / ${selectedOrgs.length} done${failed > 0 ? ` · ${failed} failed` : ''}`;
      }

      confirmBtn.style.display = 'none';
      closeBtn.disabled = false;
      closeBtn.textContent = 'Close';
      if (statusEl) statusEl.textContent = done === selectedOrgs.length
        ? `✓ All ${done} tickets created`
        : `${done} created · ${failed} failed`;

      // Exit batch mode after successful run
      if (done > 0) {
        _batchMode = false;
        _batchSelected.clear();
      }
    });
  }

  // ── Assign unused licenses modal ──────────────────────────────────────────
  async function showAssignLicensesModal({ orgId, orgName, btn }) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center';

    overlay.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;
                  padding:24px;min-width:540px;max-width:700px;max-height:80vh;overflow-y:auto;position:relative">
        <h3 style="margin:0 0 4px;font-size:16px">Assign Unused Licenses</h3>
        <p style="margin:0 0 16px;font-size:13px;color:var(--text-muted)">${escHtml(orgName)}</p>
        <div id="assign-body" style="font-size:13px;color:var(--text-muted)">Loading…</div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px">
          <button id="assign-cancel-btn" class="btn btn-ghost">Cancel</button>
          <button id="assign-confirm-btn" class="btn btn-primary" disabled>Assign</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const bodyEl   = overlay.querySelector('#assign-body');
    const confirmBtn = overlay.querySelector('#assign-confirm-btn');
    overlay.querySelector('#assign-cancel-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', ev => { if (ev.target === overlay) overlay.remove(); });

    // Load candidates
    let licenses = [], devices = [];
    try {
      const res = await window.api.merakiExpGetAssignCandidates({ orgId });
      if (!res.ok) throw new Error(res.error || 'Failed to load licenses');
      licenses = res.licenses;
      devices  = res.devices;
    } catch (err) {
      bodyEl.innerHTML = `<span style="color:var(--error,#f87171)">${escHtml(err.message)}</span>`;
      return;
    }

    if (!licenses.length) {
      bodyEl.innerHTML = '<p style="color:var(--text-muted)">No unassigned licenses found for this org.</p>';
      return;
    }

    // Build the picker: one row per license, device dropdown
    const SEV_COLOR = { expired: '#ef4444', critical: '#f59e0b', warning: '#eab308', notice: '#3b82f6', clean: '#10b981' };
    const eligibleDevices = devices; // already filtered in backend

    bodyEl.innerHTML = `
      <p style="margin:0 0 12px;color:var(--text-primary)">
        Match each license to a device. Leave a row set to "— skip —" to skip that license.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:6px 8px;font-weight:600;color:var(--text-muted)">License</th>
            <th style="text-align:left;padding:6px 8px;font-weight:600;color:var(--text-muted)">Duration</th>
            <th style="text-align:left;padding:6px 8px;font-weight:600;color:var(--text-muted)">Assign to device</th>
          </tr>
        </thead>
        <tbody>
          ${licenses.map((lic, i) => {
            // Pre-select a compatible device
            const compatible = eligibleDevices.filter(d => {
              if (lic.licenseType === d.model) return true;
              if (lic.licenseType.startsWith(d.model + '-')) return true;
              if ((lic.licenseType === 'ENT' || lic.licenseType === 'ENT-PLUS') && d.model.startsWith('MR')) return true;
              return false;
            });
            const options = [
              `<option value="">— skip —</option>`,
              ...eligibleDevices.map(d => {
                const isCompat = compatible.some(c => c.serial === d.serial);
                const sevDot = SEV_COLOR[d.severity] ? `●` : '';
                return `<option value="${escHtml(d.serial)}" ${isCompat && compatible.length === 1 ? 'selected' : ''}
                  style="color:${SEV_COLOR[d.severity] || 'inherit'}"
                  ${!isCompat ? 'style="color:var(--text-muted)"' : ''}>
                  ${isCompat ? '✓ ' : ''}${escHtml(d.name)} (${escHtml(d.model)}) — ${d.severity}
                </option>`;
              }),
            ].join('');
            return `<tr style="border-bottom:1px solid var(--border)">
              <td style="padding:8px;font-weight:600;color:var(--text-primary)">${escHtml(lic.licenseType)}</td>
              <td style="padding:8px;color:var(--text-muted)">${lic.durationInDays ? Math.round(lic.durationInDays / 365) + ' yr' : '—'}</td>
              <td style="padding:8px">
                <select class="assign-device-select field-input" data-lic-id="${escHtml(lic.id)}"
                  style="width:100%;font-size:12px;padding:4px 6px;color-scheme:dark;background:var(--bg);color:var(--text-primary);border:1px solid var(--border);border-radius:4px">
                  ${options}
                </select>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;

    // Enable Assign when at least one device is selected
    function updateConfirmState() {
      const anySelected = [...overlay.querySelectorAll('.assign-device-select')].some(s => s.value);
      confirmBtn.disabled = !anySelected;
    }
    overlay.querySelectorAll('.assign-device-select').forEach(s => s.addEventListener('change', updateConfirmState));
    updateConfirmState();

    confirmBtn.addEventListener('click', async () => {
      const assignments = [...overlay.querySelectorAll('.assign-device-select')]
        .filter(s => s.value)
        .map(s => ({ licenseId: s.dataset.licId, deviceSerial: s.value }));

      confirmBtn.disabled  = true;
      confirmBtn.textContent = 'Assigning…';

      try {
        const res = await window.api.merakiExpAssignUnusedLicenses({ orgId, orgName, assignments });
        overlay.remove();

        if (res.ok) {
          const msg = res.assigned > 0
            ? `Assigned ${res.assigned} license${res.assigned !== 1 ? 's' : ''}${res.skipped > 0 ? ` (${res.skipped} failed)` : ''}.`
            : 'No licenses were assigned.';
          if (btn && document.contains(btn)) {
            btn.textContent = '✓ Done';
            btn.style.borderColor = '#10b981';
            btn.style.color       = '#10b981';
            btn.title = msg;
            if (_cache?.orgs) {
              const org = _cache.orgs.find(o => o.orgId === orgId);
              if (org) org.unusedLicenses = (org.unusedLicenses || []).slice(res.assigned);
            }
          }
        } else {
          if (btn && document.contains(btn)) {
            btn.disabled = false;
            btn.textContent = '⚠ Error';
            btn.style.borderColor = '#ef4444';
            btn.style.color       = '#ef4444';
            btn.title = res.error || 'Unknown error';
          }
        }
      } catch (err) {
        confirmBtn.disabled  = false;
        confirmBtn.textContent = 'Assign';
        bodyEl.insertAdjacentHTML('afterbegin',
          `<p style="color:var(--error,#f87171);margin-bottom:8px">${escHtml(err.message)}</p>`);
      }
    });
  }

  // ── License renewal modal ─────────────────────────────────────────────────
  function showRenewModal(opts) {
    // opts from data-* attributes on the button:
    // { serial, deviceName, model, orgId, orgName, atCompanyId, atCompanyName,
    //   ciId, currentMeraki, currentAt }
    document.getElementById('mexp-renew-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'mexp-renew-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;display:flex;align-items:center;justify-content:center';

    modal.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border-2);border-radius:10px;
                  width:520px;max-width:calc(100vw - 32px);max-height:90vh;display:flex;flex-direction:column;overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-weight:600;font-size:15px">Add License</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${escHtml(opts.orgName)}</div>
          </div>
          <button id="mexp-renew-close" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;line-height:1;padding:4px">✕</button>
        </div>

        <div id="mexp-renew-body" style="padding:20px;overflow-y:auto;flex:1">
          <div style="padding:8px 12px;background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);
            border-radius:6px;font-size:12px;color:var(--text-muted);margin-bottom:14px">
            License keys are claimed at the org level — one key covers all APs &amp; switches, one key covers all firewalls.
            Run a rescan after claiming to see updated expiry dates.
          </div>

          <div class="field-group" style="margin-bottom:14px">
            <label class="field-label">License Key(s)</label>
            <textarea id="mexp-renew-keys"
              style="width:100%;box-sizing:border-box;min-height:80px;resize:vertical;background:var(--bg);
                     border:1px solid var(--border);border-radius:6px;padding:8px 10px;color:var(--text);
                     font-family:monospace;font-size:12px;outline:none"
              placeholder="One key per line&#10;e.g. XXXX-XXXX-XXXX-XXXX"></textarea>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Paste one or more license keys, one per line.</div>
          </div>

          <div id="mexp-renew-steps" style="display:none;margin-top:16px">
            <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em">Progress</div>
          </div>
        </div>

        <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;align-items:center;gap:10px">
          <button id="mexp-renew-confirm"
            style="padding:7px 18px;border-radius:6px;border:none;background:var(--accent);color:#fff;
                   font-weight:600;cursor:pointer;font-size:13px">
            Confirm Renewal
          </button>
          <button id="mexp-renew-cancel"
            style="padding:7px 14px;border-radius:6px;border:1px solid var(--border);background:none;
                   color:var(--text);cursor:pointer;font-size:13px">
            Cancel
          </button>
          <div id="mexp-renew-status" style="flex:1;font-size:12px;color:var(--text-muted)"></div>
        </div>
      </div>`;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('mexp-renew-close').addEventListener('click', close);
    document.getElementById('mexp-renew-cancel').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    document.getElementById('mexp-renew-confirm').addEventListener('click', async () => {
      const rawKeys = document.getElementById('mexp-renew-keys').value.trim();
      const keys    = rawKeys.split('\n').map(k => k.trim()).filter(Boolean);
      if (!keys.length) {
        document.getElementById('mexp-renew-status').textContent = 'Enter at least one license key.';
        return;
      }

      // Disable form, show steps panel
      document.getElementById('mexp-renew-confirm').disabled = true;
      document.getElementById('mexp-renew-cancel').disabled  = true;
      document.getElementById('mexp-renew-keys').disabled    = true;
      document.getElementById('mexp-renew-status').textContent = '';
      const stepsEl = document.getElementById('mexp-renew-steps');
      stepsEl.style.display = '';
      stepsEl.innerHTML = '<div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em">Progress</div>';

      const addStepRow = (label) => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px';
        row.innerHTML = `<span style="width:16px;text-align:center">⏳</span><span>${escHtml(label)}</span>`;
        stepsEl.appendChild(row);
        return row;
      };
      const setStepRow = (row, ok, msg) => {
        row.querySelector('span').textContent = ok === true ? '✓' : ok === false ? '✕' : '—';
        row.querySelector('span').style.color = ok === true ? 'var(--success,#4ade80)' : ok === false ? 'var(--error,#f87171)' : 'var(--text-muted)';
        if (msg) {
          const msgEl = document.createElement('span');
          msgEl.style.cssText = `font-size:11px;color:${ok === false ? 'var(--error,#f87171)' : 'var(--text-muted)'}`;
          msgEl.textContent = ` — ${msg}`;
          row.appendChild(msgEl);
        }
      };

      const STEP_LABELS = {
        'claim':  'Claim license key(s) in Meraki',
        'assign': 'Assign licenses to devices',
      };
      const stepRows = {};
      for (const [k, label] of Object.entries(STEP_LABELS)) {
        stepRows[k] = addStepRow(label);
      }

      const res = await window.api.merakiExpRenewLicense({
        orgId:         opts.orgId,
        orgName:       opts.orgName,
        atCompanyId:   opts.atCompanyId,
        atCompanyName: opts.atCompanyName,
        keys,
      });

      // Update step rows from result
      for (const s of (res.steps || [])) {
        const row = stepRows[s.step];
        if (!row) continue;
        const msg = s.ok === false ? (s.error || 'Failed')
                  : s.ok === null  ? (s.skipped || 'Skipped')
                  : s.assigned != null ? `${s.assigned} assigned${s.skipped ? `, ${s.skipped} unmatched` : ''}`
                  : null;
        setStepRow(row, s.ok, msg);
      }

      if (res.ok) {
        const assignStep = (res.steps || []).find(s => s.step === 'assign');
        const assignMsg  = assignStep?.assigned > 0
          ? `${assignStep.assigned} license${assignStep.assigned !== 1 ? 's' : ''} assigned`
          : 'Run a rescan to see updated expiry dates';
        document.getElementById('mexp-renew-status').style.color = 'var(--success,#4ade80)';
        document.getElementById('mexp-renew-status').textContent = `Done — ${assignMsg}`;
        // Reload cache into view
        const cacheRes = await window.api.merakiExpGetCache().catch(() => null);
        if (cacheRes?.ok && cacheRes.data) { _cache = cacheRes.data; refreshOrgs(); }
        // Swap confirm button to "Close"
        document.getElementById('mexp-renew-confirm').style.display = 'none';
        document.getElementById('mexp-renew-cancel').disabled = false;
        document.getElementById('mexp-renew-cancel').textContent = 'Close';
      } else {
        document.getElementById('mexp-renew-status').style.color = 'var(--error,#f87171)';
        document.getElementById('mexp-renew-status').textContent = res.error || 'One or more steps failed — review details above.';
        document.getElementById('mexp-renew-confirm').disabled = false;
        document.getElementById('mexp-renew-cancel').disabled  = false;
        document.getElementById('mexp-renew-keys').disabled    = false;
        document.getElementById('mexp-renew-confirm').textContent = 'Retry';
      }
    });
  }

  // ── Ticket creation modal ─────────────────────────────────────────────────
  function showTicketModal(opts) {
    // opts: { orgId, orgName, atCompanyId, atCompanyName, devices }
    document.getElementById('mexp-ticket-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'mexp-ticket-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:9999;display:flex;align-items:center;justify-content:center';

    modal.innerHTML = `
      <div style="background:var(--surface);border:1px solid var(--border-2);border-radius:10px;
                  width:560px;max-width:calc(100vw - 32px);max-height:90vh;display:flex;flex-direction:column;overflow:hidden">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
          <div>
            <div style="font-weight:600;font-size:15px">🎫 Create Ticket</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${escHtml(opts.atCompanyName)}</div>
          </div>
          <button id="mexp-ticket-close" style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:18px;line-height:1;padding:4px">✕</button>
        </div>
        <div id="mexp-ticket-body" style="padding:20px;overflow-y:auto;flex:1">
          <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">Checking existing tickets…</div>
        </div>
        <div id="mexp-ticket-footer" style="padding:14px 20px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-shrink:0;display:none"></div>
      </div>`;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    document.getElementById('mexp-ticket-close').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    const btnStyle   = (accent) => `padding:7px 16px;border-radius:6px;border:none;background:${accent};color:#fff;font-weight:600;cursor:pointer;font-size:13px`;
    const ghostStyle = `padding:7px 14px;border-radius:6px;border:1px solid var(--border);background:none;color:var(--text);cursor:pointer;font-size:13px`;

    // ── Time entry sub-view ────────────────────────────────────────────────
    // presetStatusLabel: if set, status dropdown pre-selects that label (e.g. 'Complete')
    function showAddNoteView(ticket, presetStatusLabel) {
      const bodyEl   = document.getElementById('mexp-ticket-body');
      const footerEl = document.getElementById('mexp-ticket-footer');
      const selStyle = `background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 8px;color:var(--text);font-size:13px;color-scheme:dark`;
      const title    = presetStatusLabel === 'Complete'
        ? `Completing ticket <strong style="color:var(--text)">#${escHtml(String(ticket.ticketNumber || ticket.id))}</strong>`
        : `Logging time on <strong style="color:var(--text)">#${escHtml(String(ticket.ticketNumber || ticket.id))} — ${escHtml(ticket.title || '')}</strong>`;

      bodyEl.innerHTML = `
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px">${title}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Resource</label>
            ${_currentAtResource
              ? `<div style="display:flex;align-items:center;height:36px;background:var(--bg);
                             border:1px solid var(--border);border-radius:6px;padding:0 10px;
                             color:var(--text);font-size:13px;gap:8px">
                   <span style="flex:1">${escHtml(_currentAtResource.firstName + ' ' + _currentAtResource.lastName)}</span>
                   <button id="mexp-te-resource-change"
                     style="background:none;border:none;color:var(--text-muted);font-size:11px;
                            cursor:pointer;padding:0;text-decoration:underline">change</button>
                 </div>
                 <input type="hidden" id="mexp-te-resource" value="${escHtml(_currentAtResource.firstName)}">`
              : `<select id="mexp-te-resource" style="${selStyle};width:100%">
                   <option value="Gary">Gary</option>
                   <option value="Shawn">Shawn</option>
                 </select>`
            }
          </div>
          <div>
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Hours</label>
            <select id="mexp-te-hours" style="${selStyle};width:100%">
              <option value="0.25">0.25 (15 min)</option>
              <option value="0.5" selected>0.5 (30 min)</option>
              <option value="1">1.0 (1 hr)</option>
              <option value="1.5">1.5 (1.5 hr)</option>
              <option value="2">2.0 (2 hr)</option>
            </select>
          </div>
        </div>
        <div style="margin-bottom:12px">
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Update Status</label>
          <select id="mexp-te-status" style="${selStyle};width:100%">
            <option value="">— No change —</option>
          </select>
        </div>
        <div style="margin-bottom:12px">
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Notes</label>
          <textarea id="mexp-te-notes" placeholder="Meraki license renewal follow-up…"
            style="width:100%;box-sizing:border-box;min-height:70px;resize:vertical;
                   background:var(--bg);border:1px solid var(--border);border-radius:6px;
                   padding:8px 10px;color:var(--text);font-size:13px;font-family:inherit"></textarea>
        </div>
        <div id="mexp-te-result" style="display:none"></div>`;

      // "change" button — swap the locked display for a text input
      document.getElementById('mexp-te-resource-change')?.addEventListener('click', () => {
        const hiddenInput = document.getElementById('mexp-te-resource');
        const display     = hiddenInput?.previousElementSibling?.closest('div[style]');
        const parent      = hiddenInput?.parentElement;
        if (!parent) return;
        const sel = document.createElement('select');
        sel.id = 'mexp-te-resource';
        sel.style.cssText = `${selStyle};width:100%`;
        ['Gary', 'Shawn'].forEach(name => {
          const opt = document.createElement('option');
          opt.value = name; opt.textContent = name;
          sel.appendChild(opt);
        });
        parent.innerHTML = `<label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Resource</label>`;
        parent.appendChild(sel);
      });

      // Load status picklist async and populate dropdown
      window.api.merakiExpGetTicketStatuses().then(res => {
        const sel = document.getElementById('mexp-te-status');
        if (!sel) return;
        (res.statuses || []).forEach(s => {
          const opt = document.createElement('option');
          opt.value       = s.value;
          opt.textContent = s.label;
          if (presetStatusLabel && s.label.toLowerCase().includes(presetStatusLabel.toLowerCase())) {
            opt.selected = true;
          }
          sel.appendChild(opt);
        });
      });

      const submitLabel = presetStatusLabel === 'Complete' ? 'Complete & Log Time' : 'Log Time Entry';
      footerEl.style.display = 'flex';
      footerEl.innerHTML = `
        <button id="mexp-te-submit" style="${btnStyle('var(--accent)')}">${escHtml(submitLabel)}</button>
        <button id="mexp-te-back" style="${ghostStyle}">← Back</button>
        <div style="flex:1"></div>`;

      document.getElementById('mexp-te-back').addEventListener('click', () => renderMainView(openTickets));
      document.getElementById('mexp-te-submit').addEventListener('click', async () => {
        const resourceFirstName = document.getElementById('mexp-te-resource')?.value;
        const hours     = document.getElementById('mexp-te-hours')?.value;
        const notes     = document.getElementById('mexp-te-notes')?.value?.trim();
        const statusVal = document.getElementById('mexp-te-status')?.value;
        const btn = document.getElementById('mexp-te-submit');
        btn.disabled = true; btn.textContent = '…';
        const res = await window.api.merakiExpAddTimeEntry({
          ticketId:      ticket.id,
          resourceName:  resourceFirstName,
          hoursWorked:   hours,
          summaryNotes:  notes || 'Meraki license renewal follow-up',
          newStatus:     statusVal ? parseInt(statusVal) : undefined,
          atCompanyName: opts.atCompanyName,
        });
        const resultEl = document.getElementById('mexp-te-result');
        if (resultEl) {
          resultEl.style.display = '';
          const displayName = (_currentAtResource && _currentAtResource.firstName === resourceFirstName)
            ? `${_currentAtResource.firstName} ${_currentAtResource.lastName}`
            : resourceFirstName;
          const statusNote = statusVal ? ` · status updated` : '';
          resultEl.innerHTML = res.ok
            ? `<div style="padding:8px 12px;background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.25);border-radius:6px;font-size:13px;color:#4ade80">✓ Time entry logged (${escHtml(hours)}h for ${escHtml(displayName)})${escHtml(statusNote)}</div>`
            : `<div style="padding:8px 12px;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.25);border-radius:6px;font-size:13px;color:#f87171">Failed: ${escHtml(res.error || 'Unknown error')}</div>`;
        }
        if (res.ok) { btn.style.display = 'none'; document.getElementById('mexp-te-back').textContent = '← Back'; }
        else { btn.disabled = false; btn.textContent = 'Retry'; }
      });
    }

    // ── Main create view ───────────────────────────────────────────────────
    let openTickets = [];
    function renderMainView(tickets) {
      const bodyEl   = document.getElementById('mexp-ticket-body');
      const footerEl = document.getElementById('mexp-ticket-footer');
      if (!bodyEl) return;
      openTickets = tickets;

      // Existing tickets section
      const existingHtml = tickets.length > 0 ? `
        <div style="background:rgba(251,191,36,.06);border:1px solid rgba(251,191,36,.25);border-radius:8px;padding:12px 14px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:600;color:#fbbf24;margin-bottom:10px">
            ${tickets.length} open ticket${tickets.length !== 1 ? 's' : ''} already exist for this company
          </div>
          ${tickets.map(t => `
            <div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid rgba(251,191,36,.15);flex-wrap:wrap">
              <span style="font-size:13px;color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                #${escHtml(String(t.ticketNumber || t.id))} — ${escHtml(t.title || '')}
              </span>
              <button class="mexp-t-open" data-tid="${escHtml(String(t.id))}"
                style="padding:3px 10px;border-radius:4px;border:1px solid rgba(251,191,36,.4);background:none;color:#fbbf24;font-size:11px;cursor:pointer;white-space:nowrap">
                Open ↗
              </button>
              <button class="mexp-t-note" data-tidx="${escHtml(String(tickets.indexOf(t)))}"
                style="padding:3px 10px;border-radius:4px;border:1px solid rgba(99,102,241,.4);background:none;color:#818cf8;font-size:11px;cursor:pointer;white-space:nowrap">
                Log Time
              </button>
              <button class="mexp-t-complete" data-tidx="${escHtml(String(tickets.indexOf(t)))}"
                style="padding:3px 10px;border-radius:4px;border:1px solid rgba(74,222,128,.4);background:none;color:#4ade80;font-size:11px;cursor:pointer;white-space:nowrap">
                Mark Complete
              </button>
            </div>`).join('')}
          <div style="font-size:11px;color:var(--text-muted);margin-top:8px">You can still create a new ticket below.</div>
        </div>` : '';

      // Device checkboxes
      const deviceCheckboxes = (opts.devices || []).map((d, i) => {
        const sev = d.severity || 'clean';
        const c = sev === 'expired' ? '#f87171' : sev === 'critical' ? '#f97316' : sev === 'warning' ? '#fbbf24' : sev === 'notice' ? '#60a5fa' : 'var(--text-muted)';
        return `<label style="display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer;font-size:13px">
          <input type="checkbox" class="mexp-device-cb" data-idx="${i}" checked style="width:14px;height:14px;cursor:pointer;accent-color:var(--accent)">
          <span style="flex:1">${escHtml(d.name || d.serial)}${d.model ? ` <span style="color:var(--text-muted);font-size:11px">${escHtml(d.model)}</span>` : ''}</span>
          <span style="font-size:11px;font-weight:600;color:${c};text-transform:uppercase">${escHtml(sev)}</span>
        </label>`;
      }).join('');

      // Advanced options fields (collapsed by default)
      const advFields = [
        { id: 'adv-queue',      label: 'Queue',          val: 'CS - Subscription Procurement' },
        { id: 'adv-issuetype',  label: 'Issue Type',     val: 'Sales Ordering' },
        { id: 'adv-subissue',   label: 'Sub-Issue Type', val: 'Software Order' },
        { id: 'adv-sla',        label: 'SLA',            val: 'Sales & Procurement' },
        { id: 'adv-source',     label: 'Source',         val: 'Other' },
        { id: 'adv-priority',   label: 'Priority',       val: 'Standard - 3' },
        { id: 'adv-hours',      label: 'Est. Hours',     val: '0.5' },
      ];
      const advRows = advFields.map(f =>
        `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <label style="font-size:12px;color:var(--text-muted);width:120px;flex-shrink:0">${escHtml(f.label)}</label>
          <input id="${f.id}" type="text" value="${escHtml(f.val)}" disabled
            style="flex:1;background:var(--bg);border:1px solid var(--border);border-radius:4px;
                   padding:4px 8px;color:var(--text);font-size:12px;opacity:.6">
        </div>`
      ).join('');

      bodyEl.innerHTML = `
        ${existingHtml}

        <div style="margin-bottom:14px">
          <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em">Devices to include</div>
          <div style="border:1px solid var(--border);border-radius:6px;padding:8px 12px;max-height:160px;overflow-y:auto">
            ${deviceCheckboxes || '<div style="color:var(--text-muted);font-size:12px">No devices</div>'}
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:16px;margin-bottom:14px;flex-wrap:wrap">
          <div id="mexp-ticket-assignto-wrap">
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Assign to</label>
            ${_currentAtResource
              ? `<div style="display:flex;align-items:center;height:34px;background:var(--bg);
                             border:1px solid var(--border);border-radius:6px;padding:0 10px;
                             color:var(--text);font-size:13px;gap:8px">
                   <span style="flex:1">${escHtml(_currentAtResource.firstName + ' ' + _currentAtResource.lastName)}</span>
                   <button id="mexp-ticket-assignto-change"
                     style="background:none;border:none;color:var(--text-muted);font-size:11px;
                            cursor:pointer;padding:0;text-decoration:underline">change</button>
                 </div>
                 <input type="hidden" id="mexp-ticket-assignto" value="${escHtml(_currentAtResource.firstName)}">`
              : `<select id="mexp-ticket-assignto"
                   style="background:var(--bg);border:1px solid var(--border);border-radius:6px;
                          padding:6px 8px;color:var(--text);font-size:13px;color-scheme:dark">
                   <option value="">Unassigned</option>
                   <option value="Gary">Gary</option>
                   <option value="Shawn">Shawn</option>
                 </select>`
            }
          </div>
        </div>

        <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(99,102,241,.06)">
            <span style="font-size:12px;font-weight:600;color:var(--text)">Ticket defaults</span>
            <button id="mexp-adv-toggle"
              style="padding:3px 10px;border-radius:4px;border:1px solid rgba(99,102,241,.35);background:none;
                     color:#818cf8;font-size:11px;cursor:pointer">
              Customize ▼
            </button>
          </div>
          <div id="mexp-adv-panel" style="display:none;padding:12px 14px;border-top:1px solid var(--border)">
            ${advRows}
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Values are resolved by name at creation time.</div>
          </div>
        </div>

        <div id="mexp-ticket-result" style="display:none"></div>
      `;

      // Wire existing ticket buttons
      bodyEl.querySelectorAll('.mexp-t-open').forEach(btn => {
        btn.addEventListener('click', () => {
          window.api.homeOpenUrl(`https://ww5.autotask.net/Autotask/AutotaskExtend/ExecuteCommand.aspx?Code=OpenTicketDetail&TicketID=${encodeURIComponent(btn.dataset.tid)}`);
        });
      });
      bodyEl.querySelectorAll('.mexp-t-note').forEach(btn => {
        btn.addEventListener('click', () => showAddNoteView(tickets[parseInt(btn.dataset.tidx)]));
      });
      bodyEl.querySelectorAll('.mexp-t-complete').forEach(btn => {
        btn.addEventListener('click', () => showAddNoteView(tickets[parseInt(btn.dataset.tidx)], 'Complete'));
      });

      // "change" link — swap locked assignee display for the dropdown
      document.getElementById('mexp-ticket-assignto-change')?.addEventListener('click', () => {
        const wrap = document.getElementById('mexp-ticket-assignto-wrap');
        if (!wrap) return;
        wrap.innerHTML = `
          <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px">Assign to</label>
          <select id="mexp-ticket-assignto"
            style="background:var(--bg);border:1px solid var(--border);border-radius:6px;
                   padding:6px 8px;color:var(--text);font-size:13px;color-scheme:dark">
            <option value="">Unassigned</option>
            <option value="Gary">Gary</option>
            <option value="Shawn">Shawn</option>
          </select>`;
      });

      // Advanced options toggle
      document.getElementById('mexp-adv-toggle')?.addEventListener('click', () => {
        const panel = document.getElementById('mexp-adv-panel');
        const btn   = document.getElementById('mexp-adv-toggle');
        const open  = panel.style.display === 'none';
        panel.style.display = open ? '' : 'none';
        btn.textContent = open ? 'Collapse ▲' : 'Customize ▼';
        // Unlock fields when panel opens
        panel.querySelectorAll('input').forEach(inp => {
          inp.disabled = !open;
          inp.style.opacity = open ? '1' : '.6';
        });
      });

      // Footer
      footerEl.style.display = 'flex';
      footerEl.innerHTML = `
        <button id="mexp-ticket-confirm" style="${btnStyle('var(--accent)')}">Create Ticket</button>
        <button id="mexp-ticket-cancel" style="${ghostStyle}">Cancel</button>
        <div id="mexp-ticket-status" style="flex:1;font-size:12px;color:var(--text-muted)"></div>`;

      document.getElementById('mexp-ticket-cancel').addEventListener('click', close);

      document.getElementById('mexp-ticket-confirm').addEventListener('click', async () => {
        const checkedIdxs     = [...bodyEl.querySelectorAll('.mexp-device-cb:checked')].map(cb => parseInt(cb.dataset.idx));
        const selectedDevices = (opts.devices || []).filter((_, i) => checkedIdxs.includes(i));
        if (!selectedDevices.length) {
          document.getElementById('mexp-ticket-status').textContent = 'Select at least one device.';
          return;
        }

        const confirmBtn = document.getElementById('mexp-ticket-confirm');
        const cancelBtn  = document.getElementById('mexp-ticket-cancel');
        confirmBtn.disabled = true; cancelBtn.disabled = true; confirmBtn.textContent = '…';

        // Collect advanced overrides only if the panel is open (user customised)
        const advOpen = document.getElementById('mexp-adv-panel')?.style.display !== 'none';
        const advOpts = advOpen ? {
          queueName:       document.getElementById('adv-queue')?.value?.trim()     || undefined,
          issueTypeName:   document.getElementById('adv-issuetype')?.value?.trim() || undefined,
          subIssueType:    document.getElementById('adv-subissue')?.value?.trim()  || undefined,
          slaName:         document.getElementById('adv-sla')?.value?.trim()       || undefined,
          sourceName:      document.getElementById('adv-source')?.value?.trim()    || undefined,
          priorityName:    document.getElementById('adv-priority')?.value?.trim()  || undefined,
          estimatedHours:  parseFloat(document.getElementById('adv-hours')?.value) || undefined,
        } : {};

        const res = await window.api.merakiExpCreateTicket({
          atCompanyId:   opts.atCompanyId,
          atCompanyName: opts.atCompanyName,
          orgName:       opts.orgName,
          devices:       selectedDevices,
          assignTo:      document.getElementById('mexp-ticket-assignto')?.value || null,
          ...advOpts,
        });

        const resultEl = document.getElementById('mexp-ticket-result');
        if (resultEl) resultEl.style.display = '';

        if (res.ok) {
          const ticketUrl = `https://ww5.autotask.net/Autotask/AutotaskExtend/ExecuteCommand.aspx?Code=OpenTicketDetail&TicketID=${encodeURIComponent(String(res.ticketId))}`;
          if (resultEl) resultEl.innerHTML = `
            <div style="padding:10px 12px;background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.25);border-radius:6px;font-size:13px;color:#4ade80">
              <div style="margin-bottom:8px">
                ✓ Ticket ${escHtml(res.ticketNumber || String(res.ticketId))} created
                <a href="#" class="mexp-new-ticket-link" data-url="${escHtml(ticketUrl)}"
                  style="color:#4ade80;text-decoration:underline;margin-left:8px">Open in AT ↗</a>
                ${res.ciNotesAdded > 0 ? `<span style="font-size:11px;color:var(--text-muted);margin-left:8px">(${res.ciNotesAdded} CI note${res.ciNotesAdded !== 1 ? 's' : ''} added)</span>` : ''}
              </div>
              <button id="mexp-mark-complete" data-tid="${escHtml(String(res.ticketId))}" data-tnum="${escHtml(String(res.ticketNumber || res.ticketId))}"
                style="padding:4px 12px;border-radius:4px;border:1px solid rgba(74,222,128,.4);background:none;color:#4ade80;font-size:11px;cursor:pointer">
                Mark Complete when done
              </button>
            </div>`;
          resultEl?.querySelector('.mexp-new-ticket-link')?.addEventListener('click', e => {
            e.preventDefault(); window.api.homeOpenUrl(ticketUrl);
          });
          resultEl?.querySelector('#mexp-mark-complete')?.addEventListener('click', function() {
            showAddNoteView(
              { id: this.dataset.tid, ticketNumber: this.dataset.tnum },
              'Complete'
            );
          });
          confirmBtn.style.display = 'none';
          cancelBtn.disabled = false; cancelBtn.textContent = 'Close';
        } else {
          if (resultEl) resultEl.innerHTML = `
            <div style="padding:10px 12px;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.25);border-radius:6px;font-size:13px;color:#f87171">
              Failed: ${escHtml(res.error || 'Unknown error')}
            </div>`;
          confirmBtn.disabled = false; cancelBtn.disabled = false; confirmBtn.textContent = 'Retry';
        }
      });
    }

    // Initial load — check tickets then render
    window.api.merakiExpCheckTicket({ atCompanyId: opts.atCompanyId })
      .then(res => renderMainView(res.ok ? (res.tickets || []) : []))
      .catch(() => renderMainView([]));
  }

  // ── Audit trail viewer ────────────────────────────────────────────────────
  let _auditExpanded = false;

  async function renderAuditSection() {
    const el = document.getElementById('mexp-audit-section');
    if (!el) return;

    const ACTION_LABELS = {
      SCAN_STARTED:     { icon: '🔍', label: 'Scan started' },
      SCAN_COMPLETED:   { icon: '✅', label: 'Scan completed' },
      LICENSE_RENEWED:  { icon: '🔑', label: 'License renewed' },
      AT_DATE_SYNCED:   { icon: '🔄', label: 'AT date synced' },
      TICKET_CREATED:   { icon: '🎫', label: 'Ticket created' },
      EXCLUSION_ADDED:  { icon: '🚫', label: 'Exclusion added' },
      EXCLUSION_REMOVED:{ icon: '♻',  label: 'Exclusion removed' },
    };

    const headerHtml = `
      <button id="mexp-audit-toggle"
        style="width:100%;display:flex;align-items:center;justify-content:space-between;
               background:var(--surface);border:1px solid var(--border);border-radius:${_auditExpanded ? '10px 10px 0 0' : '10px'};
               padding:12px 16px;cursor:pointer;color:var(--text);font-size:13px;
               text-align:left">
        <span style="font-weight:600;display:flex;align-items:center;gap:8px">
          📋 Audit Log
          <span id="mexp-audit-count" style="font-size:11px;color:var(--text-muted);font-weight:400"></span>
        </span>
        <span style="color:var(--text-muted);font-size:16px;transition:transform .2s;
                     transform:rotate(${_auditExpanded ? '180' : '0'}deg)">▼</span>
      </button>
      <div id="mexp-audit-body" style="display:${_auditExpanded ? 'block' : 'none'};
           border:1px solid var(--border);border-top:none;border-radius:0 0 10px 10px;
           background:var(--surface);overflow:hidden">
        <div style="padding:16px;color:var(--text-muted);font-size:13px">Loading…</div>
      </div>`;

    el.innerHTML = headerHtml;

    document.getElementById('mexp-audit-toggle').addEventListener('click', () => {
      _auditExpanded = !_auditExpanded;
      renderAuditSection();
    });

    if (_auditExpanded) populateAudit();

    async function populateAudit() {
      const bodyEl = document.getElementById('mexp-audit-body');
      if (!bodyEl) return;

      const res = await window.api.merakiExpGetAudit().catch(() => ({ ok: false }));
      const entries = res.ok ? (res.data?.entries || []) : [];

      const countEl = document.getElementById('mexp-audit-count');
      if (countEl) countEl.textContent = `(${entries.length} entries)`;

      if (!entries.length) {
        bodyEl.innerHTML = '<div style="padding:20px;color:var(--text-muted);font-size:13px;text-align:center">No audit entries yet.</div>';
        return;
      }

      const rows = entries.slice(0, 200).map(e => {
        const meta  = ACTION_LABELS[e.actionType] || { icon: '•', label: e.actionType || '—' };
        const ts    = e.timestamp ? new Date(e.timestamp).toLocaleString('en-US', { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }) : '—';
        const who   = [e.atCompanyName, e.orgName].filter(Boolean).join(' / ') || '—';
        const device= [e.deviceName, e.deviceSerial].filter(Boolean).join(' · ') || '';
        const detail= e.newValue ? (e.newValue.length > 80 ? e.newValue.slice(0, 80) + '…' : e.newValue) : '';
        const resultColor = e.result === 'error' ? '#f87171' : e.result === 'success' ? '#4ade80' : 'var(--text-muted)';
        return `<tr style="border-top:1px solid var(--border)">
          <td style="padding:8px 12px;font-size:12px;color:var(--text-muted);white-space:nowrap">${escHtml(ts)}</td>
          <td style="padding:8px 12px;font-size:12px;white-space:nowrap">${escHtml(meta.icon)} ${escHtml(meta.label)}</td>
          <td style="padding:8px 12px;font-size:12px;color:var(--text-muted)">${escHtml(who)}</td>
          <td style="padding:8px 12px;font-size:12px;color:var(--text-muted)">${escHtml(device)}</td>
          <td style="padding:8px 12px;font-size:12px;color:var(--text-muted)">${escHtml(detail)}</td>
          <td style="padding:8px 12px;font-size:11px;font-weight:600;color:${resultColor};text-transform:uppercase;white-space:nowrap">${escHtml(e.result || '')}</td>
        </tr>`;
      }).join('');

      bodyEl.innerHTML = `
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:12px">
            <thead>
              <tr style="background:rgba(0,0,0,.15)">
                <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;white-space:nowrap">Time</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Action</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Company / Org</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Device</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Details</th>
                <th style="padding:8px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Result</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${entries.length > 200 ? `<div style="padding:10px 16px;font-size:11px;color:var(--text-muted);border-top:1px solid var(--border)">Showing 200 of ${entries.length} entries (newest first)</div>` : ''}
      `;
    }
  }

  // ── Initial load ──────────────────────────────────────────────────────────
  async function loadData() {
    content.innerHTML = `<div style="padding:40px;color:var(--text-muted);font-size:14px">Loading…</div>`;
    const [cacheRes, settingsRes] = await Promise.all([
      window.api.merakiExpGetCache(),
      window.api.merakiExpGetSettings(),
    ]);
    _cache    = cacheRes.ok && cacheRes.data ? cacheRes.data : null;
    _settings = settingsRes.ok ? settingsRes.data : null;
    render();
  }

  loadData();
}

// ─── Help ─────────────────────────────────────────────────────────────────────
function renderHelp() {
  const GITBOOK = 'https://anchor-network-solutions-1.gitbook.io/anchor-hub-help-center';

  const TOOLS = [
    { name: 'M365 Subscription Comparison',  desc: 'Compares Microsoft 365 subscriptions between Pax8 and Autotask to surface billing discrepancies — seats that exist in one system but not the other.',           path: '/tool-guides/subscription-audit' },
    { name: 'Pax8 Invoice Processor',         desc: 'Downloads and processes Pax8 invoices into a structured per-client breakdown and generates Autotask contract update prompts.',                               path: '/tool-guides/invoice-processor' },
    { name: 'Pax8 Invoice Comparison',        desc: 'Compares Pax8 invoices month over month — current vs. last month or across the last 2–3 invoices — to see what changed per client.',                        path: '/tool-guides/pax8-invoice-comparison' },
    { name: 'M365 Margin Analyzer',           desc: 'Shows your margin per client by comparing Autotask contract service pricing against current Pax8 costs. Identifies underpriced services.',                   path: '/tool-guides/margin-analyzer' },
    { name: 'Company Mapping',                desc: 'Syncs and manages the link between Pax8 company names and their matching Autotask accounts. Required for most other tools to work correctly.',               path: '/tool-guides/company-mapping' },
    { name: 'Kaseya Invoice Processor',       desc: 'Imports Kaseya/Datto invoices and splits costs across QuickBooks accounts and classes. Generates an Autotask update prompt.',                               path: '/tool-guides/kaseya-invoice-processor' },
    { name: 'Project Time Summary',           desc: 'Pulls time entries from Autotask for all active projects and summarizes hours per project. Supports notes, export, and emailing reports.',                   path: '/tool-guides/project-time-summary' },
    { name: 'Autotask Contract Changes',      desc: 'Audits recent changes made to Autotask contracts — showing who changed what field and when. Useful for tracking modifications and renewals.',                path: '/tool-guides/contract-changes' },
    { name: 'Autotask Contract Renewals',     desc: 'Finds active contracts expiring within your configured look-ahead window so you can proactively reach out to clients before agreements lapse.',              path: '/tool-guides/contract-renewals' },
    { name: 'BlackPoint Invoice Processor',    desc: 'Process BlackPoint Account Usage Report CSVs, compare against Autotask Security+ billing, and push unit changes directly.',                            path: '/tool-guides/blackpoint' },
    { name: 'MSC Agreements',                 desc: 'Revenue overview for managed service clients — MSA value, lifetime projected revenue, contract end dates, last signed year, and annual uplift percentage.',  path: '/tool-guides/msc-agreements' },
    { name: 'Duo Management',                 desc: 'Connects to the Duo Admin API to manage users, devices, and enrollment across all clients. Access level varies by your Hub role.',                          path: '/tool-guides/duo-management' },
    { name: 'Project Profitability',          desc: 'Compares budgeted vs. actual hours on Autotask projects to calculate labor cost, revenue, and margin. Helps catch over-budget projects early.',             path: '/tool-guides/project-profitability' },
  ];

  const FAQS = [
    { q: 'A tool won\'t load or shows an error',
      a: 'Restart Anchor Hub — most auth errors clear on the next sign-in. If the problem persists, go to Settings and confirm your API credentials are saved correctly.' },
    { q: 'I can\'t see a tool in the sidebar',
      a: 'Tool visibility is controlled by your role. If you believe you should have access, ask an admin to check the Hub Role Matrix in SharePoint or add a User Override for your account.' },
    { q: 'Contract Renewals is showing project contracts',
      a: 'The tool filters by Contract Category. If your Autotask instance uses a non-standard category name for projects, they may still appear — you can ignore them. This will be configurable in a future update.' },
    { q: 'An update is available but won\'t install',
      a: 'Click Check for Updates on the Home page to retry. If it still fails, download the latest installer from GitHub Releases and run it over your existing installation.' },
    { q: 'A Claude prompt ran but nothing changed in Autotask',
      a: 'Make sure you\'re running Claude with the Autotask MCP server connected before pasting the generated prompt. You can verify the connection with the test tool in the MCP server.' },
  ];

  content.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Help</h1>
        <p class="view-subtitle">Browse tools, get support, and troubleshoot issues.</p>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-shrink:0">
        <button class="help-btn" id="help-btn-support">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 4l6 4 6-4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.3"/></svg>
          Request Support
        </button>
        <button class="help-btn" id="help-btn-bug">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M8 5.5v3l1.5 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Report a Bug
        </button>
        <button class="help-btn" id="help-gitbook-link" style="white-space:nowrap">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M7 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M10 2h4v4M14 2L8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Open Docs
        </button>
      </div>
    </div>
    <div class="view-body help-body">

      <!-- Tools Overview — open by default -->
      <div class="help-section help-open" data-id="tools">
        <div class="help-section-header">
          <span class="help-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" stroke-width="1.3"/><path d="M5 8h6M5 5h3M5 11h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></span>
          <span class="help-section-title">Tools Overview</span>
          <span class="help-chevron">▼</span>
        </div>
        <div class="help-section-body">
          <input id="help-tool-search" type="text" placeholder="Search tools…" class="help-search-input" autocomplete="off" />
          <div class="help-tool-grid" id="help-tool-grid">
            ${TOOLS.map(t => `
              <div class="help-tool-card help-tool-clickable"
                   data-name="${escHtml(t.name.toLowerCase())}"
                   data-desc="${escHtml(t.desc.toLowerCase())}">
                <div class="help-tool-name">${escHtml(t.name)}</div>
                <p>${escHtml(t.desc)}</p>
                <span class="help-tool-docs-link">View in Docs →</span>
              </div>`).join('')}
          </div>
          <p id="help-tool-noresult" style="display:none;color:var(--text-muted);font-size:13px;padding:8px 0">No tools match your search.</p>
        </div>
      </div>

      <!-- Troubleshooting — collapsed -->
      <div class="help-section" data-id="troubleshooting">
        <div class="help-section-header">
          <span class="help-icon"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.3"/><path d="M8 4.5v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11" r="0.8" fill="currentColor"/></svg></span>
          <span class="help-section-title">Troubleshooting</span>
          <span class="help-chevron">▶</span>
        </div>
        <div class="help-section-body" style="display:none">
          <div class="help-faq">
            ${FAQS.map(f => `
              <div class="help-faq-item">
                <div class="help-faq-q">${escHtml(f.q)}</div>
                <p>${escHtml(f.a)}</p>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="help-footer">
        <span>Anchor Hub · v<span id="help-version">…</span></span>
        <a href="#" id="help-footer-releases" class="help-link">GitHub Releases</a>
        <a href="#" id="help-footer-gitbook" class="help-link">Full Documentation</a>
      </div>
    </div>`;

  // Accordion toggle
  content.querySelectorAll('.help-section-header').forEach(header => {
    header.addEventListener('click', () => {
      const sec  = header.closest('.help-section');
      const body = sec.querySelector('.help-section-body');
      const chev = header.querySelector('.help-chevron');
      const open = sec.classList.toggle('help-open');
      body.style.display = open ? '' : 'none';
      chev.textContent   = open ? '▼' : '▶';
    });
  });

  // Tool search filter
  document.getElementById('help-tool-search').addEventListener('input', function () {
    const q = this.value.trim().toLowerCase();
    const cards = content.querySelectorAll('#help-tool-grid .help-tool-card');
    let visible = 0;
    cards.forEach(card => {
      const hit = !q || card.dataset.name.includes(q) || card.dataset.desc.includes(q);
      card.style.display = hit ? '' : 'none';
      if (hit) visible++;
    });
    document.getElementById('help-tool-noresult').style.display = visible === 0 ? '' : 'none';
  });

  // Tool card clicks — open GitBook page
  const toolList = TOOLS;
  content.querySelectorAll('#help-tool-grid .help-tool-card').forEach((card, i) => {
    card.addEventListener('click', () => {
      const t = toolList[i];
      window.api.homeOpenUrl(GITBOOK + (t.path || ''));
    });
  });

  // Header / footer / support links
  document.getElementById('help-gitbook-link').addEventListener('click', () => window.api.homeOpenUrl(GITBOOK));
  document.getElementById('help-footer-releases').addEventListener('click', e => { e.preventDefault(); window.api.homeOpenUrl('https://github.com/MikeS-ANS/Anchor-Hub/releases'); });
  document.getElementById('help-footer-gitbook').addEventListener('click', e => { e.preventDefault(); window.api.homeOpenUrl(GITBOOK); });
  document.getElementById('help-btn-support').addEventListener('click', () => showSupportModal());
  document.getElementById('help-btn-bug').addEventListener('click', () => {
    window.api.homeOpenUrl('https://github.com/MikeS-ANS/Anchor-Hub/issues/new?labels=bug&template=bug_report.md');
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
    '<div style="display:flex;align-items:flex-end;gap:12px;margin-bottom:10px;flex-wrap:wrap">',
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
    '<div style="display:flex;align-items:flex-end;gap:8px;margin-bottom:16px">',
    '  <div style="display:flex;align-items:center;gap:6px;padding:6px 12px;border-radius:6px;border:1px solid var(--border);background:var(--bg-surface);font-size:11px;color:var(--text-muted);white-space:nowrap">OR</div>',
    '  <div><label class="field-label">Look Up by Project #</label>',
    '    <input class="field-input" id="prof-project-num" type="text" placeholder="e.g. P20250826.0001" style="width:220px" /></div>',
    '  <button class="btn btn-ghost" id="prof-lookup-btn">',
    '    <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.5"/><path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    '    Look Up',
    '  </button>',
    '</div>',
    '<div id="prof-status" style="display:none;padding:12px;border-radius:8px;background:var(--bg-surface);margin-bottom:12px;font-size:12px;color:var(--text-muted);align-items:center;gap:10px"></div>',
    '<div id="prof-results"></div>',
  ].join('\n');

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  document.getElementById('prof-start').value = firstOfMonth.toISOString().slice(0, 10);
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
  document.getElementById('prof-lookup-btn').onclick = function() {
    const num = (document.getElementById('prof-project-num').value || '').trim();
    if (num) profRunReport(num);
  };
  document.getElementById('prof-project-num').onkeydown = function(e) {
    if (e.key === 'Enter') {
      const num = this.value.trim();
      if (num) profRunReport(num);
    }
  };
}

async function profRunReport(projectNumber) {
  const runBtn     = document.getElementById('prof-run-btn');
  const lookupBtn  = document.getElementById('prof-lookup-btn');
  const statusDiv  = document.getElementById('prof-status');
  const resultsDiv = document.getElementById('prof-results');
  const exportBtn  = document.getElementById('prof-export-btn');
  const byNumber   = typeof projectNumber === 'string' && projectNumber.length > 0;
  const startDate     = byNumber ? null : (document.getElementById('prof-start').value || null);
  const endDate       = byNumber ? null : (document.getElementById('prof-end').value   || null);
  const includeActive = byNumber ? true  : document.getElementById('prof-include-active').checked;

  if (runBtn)    runBtn.disabled = true;
  if (lookupBtn) lookupBtn.disabled = true;
  exportBtn.disabled = true;
  statusDiv.style.display = 'flex';
  statusDiv.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px"></span>'
    + '<span>' + (byNumber ? 'Looking up project ' + escHtml(projectNumber) + '\u2026' : 'Fetching projects from Autotask\u2026 This may take a few minutes.') + '</span>';
  resultsDiv.innerHTML = '';

  try {
    const result = await window.api.runProjectProfitability({ startDate, endDate, includeActive, projectNumber: byNumber ? projectNumber : null });
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
    if (runBtn)    runBtn.disabled = false;
    if (lookupBtn) lookupBtn.disabled = false;
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

function profTypeBadge(billingType) {
  const label = billingType === 'Fixed Price'      ? 'FF'  :
                billingType === 'Time & Materials' ? 'T&M' :
                billingType === 'Block Hours'      ? 'BH'  :
                billingType === 'No Contract'      ? '—' : billingType;
  const style = billingType === 'Fixed Price'      ? 'background:rgba(74,222,128,0.15);color:#4ade80;border:1px solid rgba(74,222,128,0.35)' :
                billingType === 'Time & Materials' ? 'background:rgba(96,165,250,0.15);color:#60a5fa;border:1px solid rgba(96,165,250,0.35)' :
                billingType === 'Block Hours'      ? 'background:rgba(251,191,36,0.15);color:#fbbf24;border:1px solid rgba(251,191,36,0.35)' :
                billingType === 'No Contract'      ? 'background:rgba(248,113,113,0.15);color:#f87171;border:1px solid rgba(248,113,113,0.35)' :
                'background:var(--bg-surface);border:1px solid var(--border);color:var(--text-muted)';
  return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;' + style + '" title="' + escHtml(billingType) + '">' + label + '</span>';
}

function profDetailCard(r, settings) {
  const marginColor = r.grossMarginPct == null ? 'var(--text)' :
    r.grossMarginPct < settings.marginWarnThreshold      ? '#f87171' :
    r.grossMarginPct < settings.marginWarnThreshold + 10 ? '#fbbf24' : '#4ade80';
  const varColor = r.hoursVariancePct == null ? 'var(--text)' :
    r.hoursVariancePct > 50 ? '#f87171' : r.hoursVariancePct > 20 ? '#fbbf24' : '#4ade80';

  const metric = function(label, value, color) {
    return '<div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;padding:14px 16px">'
      + '<div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">' + label + '</div>'
      + '<div style="font-size:20px;font-weight:700;color:' + (color || 'var(--text)') + '">' + value + '</div>'
      + '</div>';
  };

  const flagsHtml = r.flags
    ? '<div style="margin-top:16px;background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:8px;padding:12px 16px">'
      + '<div style="font-size:11px;font-weight:600;color:#fbbf24;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Flags</div>'
      + r.flags.split(';').map(function(f) {
          return '<div style="font-size:13px;color:var(--text);padding:3px 0">⚠️ ' + escHtml(f.trim()) + '</div>';
        }).join('')
      + '</div>'
    : '';

  return '<div style="background:var(--bg-surface);border:1px solid var(--border);border-radius:10px;padding:20px 24px;margin-bottom:16px">'
    + '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:4px">'
    + '<div><div style="font-size:18px;font-weight:700">' + escHtml(r.projectName) + '</div>'
    + '<div style="font-family:monospace;font-size:11px;color:var(--text-muted);margin-top:2px">' + escHtml(r.projectNumber || '') + '</div></div>'
    + '<div>' + profTypeBadge(r.billingType) + '</div></div>'
    + '<div style="display:flex;gap:20px;margin:10px 0 18px;font-size:13px;color:var(--text-muted)">'
    + '<span>' + escHtml(r.company) + '</span><span>·</span><span>' + escHtml(r.lead) + '</span><span>·</span><span>' + escHtml(String(r.year || '')) + '</span>'
    + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px">'
    + metric('Invoiced',      profFmtDollar(r.invoicedAmt    || 0), '#4ade80')
    + metric('Cost of Del.',  profFmtDollar(r.costOfDelivery || 0))
    + metric('Gross Margin',  r.grossMarginPct != null ? r.grossMarginPct.toFixed(1) + '%' : '—', marginColor)
    + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px">'
    + metric('Est. Hours',    r.estHours    != null ? Number(r.estHours).toFixed(1)    : '—')
    + metric('Billed Hours',  r.billedHours != null ? Number(r.billedHours).toFixed(1) : '—')
    + metric('Total Hours',   r.totalHours  != null ? Number(r.totalHours).toFixed(1)  : '—')
    + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">'
    + metric('Hours Var %',   r.hoursVariancePct != null ? r.hoursVariancePct.toFixed(1) + '%' : '—', varColor)
    + metric('Eff. Rate',     r.effectiveRate != null ? profFmtDollar(r.effectiveRate) + '/hr' : '—')
    + metric('Gross Margin $', r.grossMarginDollar != null ? profFmtDollar(r.grossMarginDollar) : '—')
    + '</div>'
    + (r.pendingAmt > 0 ? '<div style="margin-top:10px">' + metric('Pending Unbilled', profFmtDollar(r.pendingAmt), '#fbbf24') + '</div>' : '')
    + flagsHtml
    + '</div>';
}

function profBuildTableHtml(rows, settings) {
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
  ];
  const headerHtml = colDefs.map(function(c) {
    return '<th data-col="' + c[1] + '" style="cursor:pointer;white-space:nowrap;position:sticky;top:0;z-index:1">'
      + c[0] + ' <span class="sort-arrow"></span></th>';
  }).join('') + '<th style="position:sticky;top:0;z-index:1">Flags</th>';

  const rowsHtml = rows.map(function(r) {
    const marginBg  = r.grossMarginPct == null ? '' :
      r.grossMarginPct < settings.marginWarnThreshold      ? 'background:#ffc7ce18' :
      r.grossMarginPct < settings.marginWarnThreshold + 10 ? 'background:#ffeb9c18' : 'background:#c6efce18';
    const varColor  = r.hoursVariancePct == null ? '' : r.hoursVariancePct > 50 ? 'color:#f87171' : r.hoursVariancePct > 20 ? 'color:#fbbf24' : '';
    const pendColor = r.pendingAmt > 0 ? 'color:#fbbf24' : '';
    const flagColor = r.flags ? 'color:#fbbf24' : 'color:var(--text-muted)';
    return '<tr>'
      + '<td style="font-family:monospace;font-size:11px;color:var(--text-muted);white-space:nowrap">' + escHtml(r.projectNumber || '') + '</td>'
      + '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escHtml(r.projectName) + '">' + escHtml(r.projectName) + '</td>'
      + '<td style="white-space:nowrap">' + escHtml(r.company) + '</td>'
      + '<td style="white-space:nowrap">' + escHtml(r.lead) + '</td>'
      + '<td class="msc-td-center">' + profTypeBadge(r.billingType) + '</td>'
      + '<td class="msc-td-center">' + escHtml(r.year || '') + '</td>'
      + '<td class="msc-td-num">' + (r.estHours    != null ? Number(r.estHours).toFixed(1)    : '—') + '</td>'
      + '<td class="msc-td-num">' + (r.billedHours != null ? Number(r.billedHours).toFixed(1) : '—') + '</td>'
      + '<td class="msc-td-num" style="color:var(--text-muted)">' + (r.totalHours != null ? Number(r.totalHours).toFixed(1) : '—') + '</td>'
      + '<td class="msc-td-num" style="' + varColor  + '">' + (r.hoursVariancePct != null ? r.hoursVariancePct.toFixed(1) + '%' : '—') + '</td>'
      + '<td class="msc-td-num">' + (r.invoicedAmt    != null ? profFmtDollar(r.invoicedAmt)    : '—') + '</td>'
      + '<td class="msc-td-num" style="' + pendColor + '">' + (r.pendingAmt > 0 ? profFmtDollar(r.pendingAmt) : '—') + '</td>'
      + '<td class="msc-td-num">' + (r.costOfDelivery != null ? profFmtDollar(r.costOfDelivery) : '—') + '</td>'
      + '<td class="msc-td-num" style="' + marginBg  + '">' + (r.grossMarginPct != null ? r.grossMarginPct.toFixed(1) + '%' : '—') + '</td>'
      + '<td class="msc-td-num">' + (r.effectiveRate  != null ? profFmtDollar(r.effectiveRate) + '/hr' : '—') + '</td>'
      + '<td style="font-size:11px;' + flagColor + ';max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + escHtml(r.flags || '') + '">' + escHtml(r.flags || '') + '</td>'
      + '</tr>';
  }).join('');

  return '<div class="msc-table-wrap"><table class="msc-table" id="prof-table">'
    + '<thead><tr>' + headerHtml + '</tr></thead>'
    + '<tbody>' + rowsHtml + '</tbody></table></div>';
}

function profRenderBody(rows, settings) {
  const container = document.getElementById('prof-body');
  if (!container) return;
  if (rows.length === 1) {
    container.innerHTML = profDetailCard(rows[0], settings);
  } else {
    container.innerHTML = profBuildTableHtml(rows, settings);
    const numCols = new Set(['estHours','billedHours','totalHours','hoursVariancePct','invoicedAmt','pendingAmt','costOfDelivery','grossMarginPct','effectiveRate','discountVsRack','year']);
    let sortCol = null, sortDir = 1;
    container.querySelectorAll('th[data-col]').forEach(function(th) {
      th.addEventListener('click', function() {
        const key = th.dataset.col;
        if (sortCol === key) { sortDir *= -1; } else { sortCol = key; sortDir = 1; }
        const filterInput = document.getElementById('prof-filter');
        const q = filterInput ? filterInput.value.trim().toLowerCase() : '';
        const base = q ? _profData.filter(function(r) {
          return (r.projectNumber || '').toLowerCase().includes(q) || (r.projectName || '').toLowerCase().includes(q);
        }) : _profData.slice();
        const sorted = base.sort(function(a, b) {
          const av = a[key] != null ? a[key] : '';
          const bv = b[key] != null ? b[key] : '';
          if (numCols.has(key)) { return ((Number(av) || 0) - (Number(bv) || 0)) * sortDir; }
          return String(av).localeCompare(String(bv)) * sortDir;
        });
        profRenderBody(sorted, settings);
        const newTh = document.querySelector('#prof-table th[data-col="' + key + '"]');
        if (newTh) newTh.querySelector('.sort-arrow').textContent = sortDir === 1 ? ' ▲' : ' ▼';
      });
    });
  }
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

  el.innerHTML = '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px">' + cardHtml + '</div>'
    + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">'
    + '<input class="field-input" id="prof-filter" type="text" placeholder="Filter by project # or name…" style="max-width:300px;font-size:13px">'
    + '<span id="prof-filter-count" style="font-size:12px;color:var(--text-muted)"></span>'
    + '</div>'
    + '<div id="prof-body"></div>';

  profRenderBody(rows, settings);

  document.getElementById('prof-filter').oninput = function() {
    const q = this.value.trim().toLowerCase();
    const filtered = q ? rows.filter(function(r) {
      return (r.projectNumber || '').toLowerCase().includes(q) || (r.projectName || '').toLowerCase().includes(q);
    }) : rows;
    const countEl = document.getElementById('prof-filter-count');
    if (countEl) countEl.textContent = q && filtered.length !== rows.length ? filtered.length + ' of ' + rows.length + ' projects' : '';
    profRenderBody(filtered, settings);
  };
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
// ─── Meraki Admin Management ──────────────────────────────────────────────────

let _mkAuditData      = null;
let _mkActiveTab      = 'audit';
let _mkExpandedOrgId  = null;
let _mkAuditSorted    = null;
let _mkLastRefreshed  = null;
let _mkAuditFilter    = '';

function renderMerakiAdmin() {
  const isAllowed = _currentUser?.isAdmin || _currentUser?.roles?.some(r => ['hub.admin','hub.it'].includes(r));
  if (!isAllowed) {
    content.innerHTML = `<div class="view-header"><div><h1 class="view-title">Meraki Admin Management</h1></div></div><div class="glass-card" style="padding:32px;text-align:center;color:var(--text-muted)">Access restricted to IT staff.</div>`;
    return;
  }

  content.innerHTML = `
    <div class="view-header">
      <div>
        <h1 class="view-title">Meraki Admin Management</h1>
        <p class="view-subtitle">Audit and manage Cisco Meraki dashboard administrators across all client organizations</p>
      </div>
    </div>

    <div style="display:flex;gap:2px;border-bottom:1px solid var(--border);margin-bottom:20px">
      <button class="mk-tab ${_mkActiveTab==='audit'?'mk-tab-active':''}" data-tab="audit" style="padding:8px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:500;margin-bottom:-1px;border-bottom:2px solid transparent">Audit</button>
      <button class="mk-tab ${_mkActiveTab==='add'?'mk-tab-active':''}" data-tab="add" style="padding:8px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:500;margin-bottom:-1px;border-bottom:2px solid transparent">Add Employee</button>
      <button class="mk-tab ${_mkActiveTab==='remove'?'mk-tab-active':''}" data-tab="remove" style="padding:8px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:500;margin-bottom:-1px;border-bottom:2px solid transparent">Remove Admin</button>
      <button class="mk-tab ${_mkActiveTab==='excluded'?'mk-tab-active':''}" data-tab="excluded" style="padding:8px 18px;border:none;background:none;cursor:pointer;font-size:13px;font-weight:500;margin-bottom:-1px;border-bottom:2px solid transparent">Excluded Orgs</button>
    </div>

    <!-- Audit Tab -->
    <div id="mk-panel-audit" ${_mkActiveTab!=='audit'?'style="display:none"':''}>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <button class="btn btn-primary btn-sm" id="mk-audit-btn">Refresh</button>
        <span id="mk-audit-summary" style="font-size:12px;color:var(--text-muted)"></span>
      </div>
      <div id="mk-audit-results"></div>
    </div>

    <!-- Add Employee Tab -->
    <div id="mk-panel-add" ${_mkActiveTab!=='add'?'style="display:none"':''}>
      <div class="glass-card" style="max-width:520px;padding:20px;margin-bottom:20px">
        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <label class="field-label">Email</label>
            <input type="email" id="mk-add-email" class="field-input" placeholder="employee@anchornetworksolutions.com" style="width:100%">
          </div>
          <div>
            <label class="field-label">Full Name</label>
            <input type="text" id="mk-add-name" class="field-input" placeholder="First Last" style="width:100%">
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--text-muted);padding:8px 10px;background:rgba(255,255,255,0.04);border-radius:6px">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.3"/><path d="M7 6v4M7 4.5v.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            Privilege: <strong style="color:var(--text)">Full Access</strong> — ANS employees always receive full org access
          </div>
          <div style="font-size:11px;color:var(--text-muted);padding:6px 10px;background:rgba(255,165,0,0.06);border-radius:6px;border-left:2px solid #f59e0b">
            ANS org is excluded from bulk operations — manage it directly in the Meraki portal
          </div>
          <button class="btn btn-primary" id="mk-add-btn">Add to All Client Orgs</button>
        </div>
      </div>
      <div id="mk-add-log" class="glass-card" style="display:none;padding:16px;max-width:520px">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Progress</div>
        <div id="mk-add-log-body" style="font-family:var(--font-mono,monospace);font-size:12px;line-height:1.7;max-height:320px;overflow-y:auto"></div>
        <div id="mk-add-summary" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:12px"></div>
      </div>
    </div>

    <!-- Remove Admin Tab -->
    <div id="mk-panel-remove" ${_mkActiveTab!=='remove'?'style="display:none"':''}>
      <div class="glass-card" style="max-width:520px;padding:20px;margin-bottom:20px">
        <div style="display:flex;flex-direction:column;gap:12px">
          <div>
            <label class="field-label">Admin Email to Remove</label>
            <input type="email" id="mk-remove-email" class="field-input" placeholder="admin@example.com" style="width:100%">
          </div>
          <div style="font-size:11px;color:var(--text-muted);padding:6px 10px;background:rgba(255,165,0,0.06);border-radius:6px;border-left:2px solid #f59e0b">
            ANS org and excluded orgs are skipped — manage those directly in the Meraki portal
          </div>
          <button class="btn btn-primary" id="mk-remove-btn">Remove from All Active Client Orgs</button>
        </div>
      </div>
      <div id="mk-remove-log" class="glass-card" style="display:none;padding:16px;max-width:520px">
        <div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Progress</div>
        <div id="mk-remove-log-body" style="font-family:var(--font-mono,monospace);font-size:12px;line-height:1.7;max-height:320px;overflow-y:auto"></div>
        <div id="mk-remove-summary" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:12px"></div>
      </div>
    </div>

    <!-- Excluded Orgs Tab -->
    <div id="mk-panel-excluded" ${_mkActiveTab!=='excluded'?'style="display:none"':''}>
      <div style="max-width:900px">
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:14px;padding:8px 12px;background:rgba(245,158,11,0.06);border-radius:6px;border-left:2px solid #f59e0b">
          Excluded orgs are hidden from the Audit view and skipped during bulk Add / Remove operations.
          These are typically orgs where ANS has been offboarded but the new IT company hasn't removed access yet.
        </div>
        <div id="mk-excluded-content"><div style="color:var(--text-muted);font-size:12px;padding:12px">Loading…</div></div>
      </div>
    </div>`;

  // Tab switching
  content.querySelectorAll('.mk-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _mkActiveTab = btn.dataset.tab;
      content.querySelectorAll('.mk-tab').forEach(b => b.classList.remove('mk-tab-active'));
      btn.classList.add('mk-tab-active');
      ['audit','add','remove','excluded'].forEach(t => {
        const el = document.getElementById(`mk-panel-${t}`);
        if (el) el.style.display = t === _mkActiveTab ? '' : 'none';
      });
      if (_mkActiveTab === 'excluded') mkRenderExcludedOrgs();
    });
  });

  if (_mkActiveTab === 'excluded') mkRenderExcludedOrgs();

  // ── Audit ──────────────────────────────────────────────────────────────────
  if (_mkAuditData) mkRenderAudit(_mkAuditData);

  // Single delegated click handler for audit results (expand/collapse + exclude)
  document.getElementById('mk-audit-results')?.addEventListener('click', async e => {
    // Exclude button
    const excludeBtn = e.target.closest('.mk-org-exclude-btn');
    if (excludeBtn) {
      e.stopPropagation();
      const { orgId, orgName } = excludeBtn.dataset;
      excludeBtn.disabled = true; excludeBtn.textContent = 'Excluding…';
      const res = await window.api.merakiSetOrgExcluded({ orgId, orgName, excluded: true });
      if (res.ok && _mkAuditData) {
        const org = _mkAuditData.find(o => o.id === orgId);
        if (org) org.isExcluded = true;
        _mkExpandedOrgId = null;
        mkRenderAudit(_mkAuditData);
      } else if (!res.ok) {
        excludeBtn.disabled = false; excludeBtn.textContent = 'Exclude';
      }
      return;
    }

    // Add a single missing ANS admin to this org
    const addMissingBtn = e.target.closest('.mk-add-missing-btn');
    if (addMissingBtn) {
      e.stopPropagation();
      const { orgId, email, name } = addMissingBtn.dataset;
      addMissingBtn.disabled = true; addMissingBtn.textContent = '…';
      const res = await window.api.merakiAddAdminToOrg({ orgId, email, name });
      if (res.ok && _mkAuditData) {
        const org = _mkAuditData.find(o => o.id === orgId);
        if (org && res.status === 'added' && res.admin) {
          org.admins.push({
            id: res.admin.id, email: res.admin.email, name: res.admin.name,
            orgAccess: res.admin.orgAccess, lastActive: null, isAns: true,
          });
        }
        mkRenderAudit(_mkAuditData);
      } else if (!res.ok) {
        addMissingBtn.disabled = false; addMissingBtn.textContent = '+ Add';
      }
      return;
    }

    // Add all missing ANS admins to this org at once
    const addAllMissingBtn = e.target.closest('.mk-add-all-missing-btn');
    if (addAllMissingBtn) {
      e.stopPropagation();
      const { orgId } = addAllMissingBtn.dataset;
      const orgData = _mkAuditSorted?.find(o => o.id === orgId);
      if (!orgData || !orgData.missing.length) return;
      addAllMissingBtn.disabled = true;
      addAllMissingBtn.textContent = `Adding ${orgData.missing.length}…`;
      const added = [];
      for (const missing of orgData.missing) {
        const res = await window.api.merakiAddAdminToOrg({ orgId, email: missing.email, name: missing.name || missing.email });
        if (res.ok && res.status === 'added' && res.admin && _mkAuditData) {
          const org = _mkAuditData.find(o => o.id === orgId);
          if (org) {
            org.admins.push({
              id: res.admin.id, email: res.admin.email, name: res.admin.name,
              orgAccess: res.admin.orgAccess, lastActive: null, isAns: true,
            });
          }
          added.push(missing.email);
        }
      }
      if (added.length && _mkAuditData) mkRenderAudit(_mkAuditData);
      else { addAllMissingBtn.disabled = false; addAllMissingBtn.textContent = `+ Add All Missing (${orgData.missing.length})`; }
      return;
    }

    // Remove admin from this specific org (two-step confirm)
    const removeAdminBtn = e.target.closest('.mk-admin-remove-btn');
    if (removeAdminBtn) {
      e.stopPropagation();
      if (!removeAdminBtn.dataset.confirming) {
        removeAdminBtn.dataset.confirming = '1';
        removeAdminBtn.textContent = 'Confirm?';
        removeAdminBtn.style.color = '#ef4444';
        removeAdminBtn.style.borderColor = '#ef444460';
        setTimeout(() => {
          if (removeAdminBtn.dataset.confirming) {
            delete removeAdminBtn.dataset.confirming;
            removeAdminBtn.textContent = 'Remove';
            removeAdminBtn.style.color = '#ef444480';
            removeAdminBtn.style.borderColor = '#ef444430';
          }
        }, 3000);
        return;
      }
      delete removeAdminBtn.dataset.confirming;
      const { orgId, adminId } = removeAdminBtn.dataset;
      removeAdminBtn.disabled = true; removeAdminBtn.textContent = 'Removing…';
      const res = await window.api.merakiRemoveAdminFromOrg({ orgId, adminId });
      if (res.ok && _mkAuditData) {
        const org = _mkAuditData.find(o => o.id === orgId);
        if (org) org.admins = org.admins.filter(a => a.id !== adminId);
        mkRenderAudit(_mkAuditData);
      } else if (!res.ok) {
        removeAdminBtn.disabled = false; removeAdminBtn.textContent = 'Remove';
      }
      return;
    }

    // Remove a single extra ANS admin from this org
    const removeExtraBtn = e.target.closest('.mk-remove-extra-btn');
    if (removeExtraBtn) {
      e.stopPropagation();
      if (!removeExtraBtn.dataset.confirming) {
        removeExtraBtn.dataset.confirming = '1';
        removeExtraBtn.textContent = 'Confirm?';
        removeExtraBtn.style.color = '#f59e0b';
        removeExtraBtn.style.borderColor = '#f59e0b60';
        setTimeout(() => {
          if (removeExtraBtn.dataset.confirming) {
            delete removeExtraBtn.dataset.confirming;
            removeExtraBtn.textContent = 'Remove';
            removeExtraBtn.style.color = '#f59e0b';
            removeExtraBtn.style.borderColor = '#f59e0b40';
          }
        }, 3000);
        return;
      }
      delete removeExtraBtn.dataset.confirming;
      const { orgId, adminId } = removeExtraBtn.dataset;
      removeExtraBtn.disabled = true; removeExtraBtn.textContent = '…';
      const res = await window.api.merakiRemoveAdminFromOrg({ orgId, adminId });
      if (res.ok && _mkAuditData) {
        const org = _mkAuditData.find(o => o.id === orgId);
        if (org) org.admins = org.admins.filter(a => a.id !== adminId);
        mkRenderAudit(_mkAuditData);
      } else if (!res.ok) {
        removeExtraBtn.disabled = false; removeExtraBtn.textContent = 'Remove';
      }
      return;
    }

    // Remove all extra ANS admins from this org
    const removeAllExtraBtn = e.target.closest('.mk-remove-all-extra-btn');
    if (removeAllExtraBtn) {
      e.stopPropagation();
      if (!removeAllExtraBtn.dataset.confirming) {
        removeAllExtraBtn.dataset.confirming = '1';
        removeAllExtraBtn.textContent = 'Confirm Remove All?';
        removeAllExtraBtn.style.color = '#f59e0b';
        setTimeout(() => {
          if (removeAllExtraBtn.dataset.confirming) {
            delete removeAllExtraBtn.dataset.confirming;
            removeAllExtraBtn.textContent = `Remove All Extra (${removeAllExtraBtn.dataset.count || ''})`;
            removeAllExtraBtn.style.color = '#f59e0b';
          }
        }, 3000);
        return;
      }
      delete removeAllExtraBtn.dataset.confirming;
      const { orgId } = removeAllExtraBtn.dataset;
      const orgData = _mkAuditSorted?.find(o => o.id === orgId);
      if (!orgData?.extra?.length) return;
      removeAllExtraBtn.disabled = true; removeAllExtraBtn.textContent = `Removing ${orgData.extra.length}…`;
      for (const extra of orgData.extra) {
        const res = await window.api.merakiRemoveAdminFromOrg({ orgId, adminId: extra.id });
        if (res.ok && _mkAuditData) {
          const org = _mkAuditData.find(o => o.id === orgId);
          if (org) org.admins = org.admins.filter(a => a.id !== extra.id);
        }
      }
      if (_mkAuditData) mkRenderAudit(_mkAuditData);
      return;
    }

    // Bulk Fix All Missing — add all missing ANS admins across all orgs
    const bulkFixBtn = e.target.closest('.mk-bulk-fix-all-btn');
    if (bulkFixBtn) {
      e.stopPropagation();
      if (!bulkFixBtn.dataset.confirming) {
        bulkFixBtn.dataset.confirming = '1';
        const orig = bulkFixBtn.textContent;
        bulkFixBtn.textContent = 'Confirm? This adds admins to all orgs with gaps.';
        bulkFixBtn.style.background = 'rgba(16,185,129,0.15)';
        setTimeout(() => {
          if (bulkFixBtn.dataset.confirming) {
            delete bulkFixBtn.dataset.confirming;
            bulkFixBtn.textContent = orig;
            bulkFixBtn.style.background = '';
          }
        }, 5000);
        return;
      }
      delete bulkFixBtn.dataset.confirming;
      const orgsWithMissing = (_mkAuditSorted || []).filter(o => o.missing?.length);
      if (!orgsWithMissing.length) return;
      let totalFixed = 0;
      bulkFixBtn.disabled = true; bulkFixBtn.textContent = `Fixing 0 / ${orgsWithMissing.reduce((s, o) => s + o.missing.length, 0)}…`;
      for (const org of orgsWithMissing) {
        for (const missing of org.missing) {
          const res = await window.api.merakiAddAdminToOrg({ orgId: org.id, email: missing.email, name: missing.name || missing.email });
          if (res.ok && res.status === 'added' && res.admin && _mkAuditData) {
            const cached = _mkAuditData.find(o => o.id === org.id);
            if (cached) cached.admins.push({ id: res.admin.id, email: res.admin.email, name: res.admin.name, orgAccess: res.admin.orgAccess, lastActive: null, isAns: true });
            totalFixed++;
            bulkFixBtn.textContent = `Fixing ${totalFixed}…`;
          }
        }
      }
      if (_mkAuditData) mkRenderAudit(_mkAuditData);
      return;
    }

    // Export CSV
    const exportBtn = e.target.closest('.mk-export-csv-btn');
    if (exportBtn) {
      e.stopPropagation();
      if (!_mkAuditSorted) return;
      const rows = [['Organization', 'ANS Admins', 'Client Admins', 'Missing', 'Extra', 'Status']];
      _mkAuditSorted.forEach(o => {
        const status = o.isTemplate ? 'Baseline' : (o.missing.length || o.extra.length) ? `${o.missing.length + o.extra.length} issues` : 'OK';
        rows.push([o.name, o.ansAdmins.length, o.clientAdmins.length, o.missing.length, o.extra.length, status]);
      });
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url  = URL.createObjectURL(blob);
      const a    = Object.assign(document.createElement('a'), { href: url, download: `meraki-audit-${new Date().toISOString().slice(0,10)}.csv` });
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
      return;
    }

    // Show Add Admin inline form
    const addAdminBtn = e.target.closest('.mk-org-add-admin-btn');
    if (addAdminBtn) {
      e.stopPropagation();
      const orgId = addAdminBtn.dataset.orgId;
      const formDiv = document.getElementById(`mk-add-form-${orgId}`);
      if (formDiv) {
        formDiv.innerHTML = `
          <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
            <div>
              <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px">Email</div>
              <input class="cd-find-input" id="mk-add-email-${escHtml(orgId)}" placeholder="admin@example.com" style="width:220px">
            </div>
            <div>
              <div style="font-size:10px;color:var(--text-muted);margin-bottom:3px">Name</div>
              <input class="cd-find-input" id="mk-add-name-${escHtml(orgId)}" placeholder="Full Name" style="width:160px">
            </div>
            <button class="btn btn-primary btn-sm mk-org-add-admin-submit" data-org-id="${escHtml(orgId)}" style="font-size:11px;padding:4px 12px">Add</button>
            <button class="btn btn-ghost btn-sm mk-org-add-admin-cancel" data-org-id="${escHtml(orgId)}" style="font-size:11px;padding:4px 10px">Cancel</button>
            <span id="mk-add-status-${escHtml(orgId)}" style="font-size:11px;color:var(--text-muted)"></span>
          </div>`;
        document.getElementById(`mk-add-email-${orgId}`)?.focus();
      }
      return;
    }

    // Cancel Add Admin form
    const cancelAddBtn = e.target.closest('.mk-org-add-admin-cancel');
    if (cancelAddBtn) {
      e.stopPropagation();
      const orgId = cancelAddBtn.dataset.orgId;
      const formDiv = document.getElementById(`mk-add-form-${orgId}`);
      if (formDiv) {
        formDiv.innerHTML = `<button class="btn btn-ghost btn-sm mk-org-add-admin-btn" data-org-id="${escHtml(orgId)}"
          style="font-size:11px;padding:3px 10px;color:#60a5fa;border-color:#60a5fa40">+ Add Admin to this org</button>`;
      }
      return;
    }

    // Submit Add Admin form
    const submitAddBtn = e.target.closest('.mk-org-add-admin-submit');
    if (submitAddBtn) {
      e.stopPropagation();
      const orgId = submitAddBtn.dataset.orgId;
      const email    = document.getElementById(`mk-add-email-${orgId}`)?.value.trim();
      const name     = document.getElementById(`mk-add-name-${orgId}`)?.value.trim();
      const statusEl = document.getElementById(`mk-add-status-${orgId}`);
      if (!email) {
        if (statusEl) { statusEl.style.color = '#ef4444'; statusEl.textContent = 'Email is required'; }
        return;
      }
      submitAddBtn.disabled = true; submitAddBtn.textContent = 'Adding…';
      const res = await window.api.merakiAddAdminToOrg({ orgId, email, name: name || email });
      if (res.ok && _mkAuditData) {
        const org = _mkAuditData.find(o => o.id === orgId);
        if (org && res.status === 'added' && res.admin) {
          org.admins.push({
            id:         res.admin.id,
            email:      res.admin.email,
            name:       res.admin.name,
            orgAccess:  res.admin.orgAccess,
            lastActive: null,
            isAns:      (res.admin.email || '').toLowerCase().endsWith('@anchornetworksolutions.com'),
          });
        } else if (org && res.status === 'exists' && statusEl) {
          submitAddBtn.disabled = false; submitAddBtn.textContent = 'Add';
          statusEl.style.color = '#f59e0b'; statusEl.textContent = 'Already exists in this org';
          return;
        }
        mkRenderAudit(_mkAuditData);
      } else if (!res.ok) {
        submitAddBtn.disabled = false; submitAddBtn.textContent = 'Add';
        if (statusEl) { statusEl.style.color = '#ef4444'; statusEl.textContent = res.error || 'Error'; }
      }
      return;
    }

    // Row click — toggle expand
    const row = e.target.closest('.mk-org-row');
    if (!row || !_mkAuditSorted) return;
    const orgId = row.dataset.orgId;
    _mkExpandedOrgId = _mkExpandedOrgId === orgId ? null : orgId;
    const tbody = document.getElementById('mk-org-tbody');
    if (tbody) tbody.innerHTML = _mkAuditSorted.map(o => mkOrgRowHtml(o)).join('');
  });

  document.getElementById('mk-audit-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('mk-audit-btn');
    const resultsEl = document.getElementById('mk-audit-results');
    btn.disabled = true; btn.textContent = 'Loading…';
    _mkExpandedOrgId = null;
    resultsEl.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:16px">Fetching organizations and admins…</div>`;
    try {
      const res = await window.api.merakiAudit();
      if (!res.ok) throw new Error(res.error);
      _mkAuditData     = res.orgs;
      _mkLastRefreshed = new Date();
      _mkAuditFilter   = '';
      mkRenderAudit(res.orgs);
    } catch (e) {
      resultsEl.innerHTML = `<div class="glass-card" style="padding:16px;color:var(--danger,#ef4444)">Error: ${escHtml(e.message)}</div>`;
    }
    btn.disabled = false; btn.textContent = 'Refresh';
  });

  // ── Add Employee ───────────────────────────────────────────────────────────
  document.getElementById('mk-add-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('mk-add-email')?.value.trim();
    const name  = document.getElementById('mk-add-name')?.value.trim();
    if (!email || !name) { alert('Email and Name are required.'); return; }

    const btn     = document.getElementById('mk-add-btn');
    const logEl   = document.getElementById('mk-add-log');
    const bodyEl  = document.getElementById('mk-add-log-body');
    const summEl  = document.getElementById('mk-add-summary');
    btn.disabled = true; btn.textContent = 'Running…';
    logEl.style.display = ''; bodyEl.innerHTML = ''; summEl.innerHTML = '';

    const onProgress = ({ orgName, status, error }) => {
      const icon = status === 'added' ? '✓' : status === 'exists' ? '⚠' : '✗';
      const color = status === 'added' ? '#10b981' : status === 'exists' ? '#f59e0b' : '#ef4444';
      const msg = status === 'added' ? 'Added' : status === 'exists' ? 'Already exists' : `Error: ${error}`;
      bodyEl.innerHTML += `<div><span style="color:${color}">${icon}</span> ${escHtml(orgName)} — ${msg}</div>`;
      bodyEl.scrollTop = bodyEl.scrollHeight;
    };
    window.api.merakiOnProgress('meraki-add-progress', onProgress);

    try {
      const res = await window.api.merakiAddAdmin({ email, name });
      window.api.merakiOffProgress('meraki-add-progress', onProgress);
      const added  = (res.results || []).filter(r => r.status === 'added').length;
      const exists = (res.results || []).filter(r => r.status === 'exists').length;
      const errors = (res.results || []).filter(r => r.status === 'error').length;
      summEl.innerHTML = `<span style="color:#10b981">✓ ${added} added</span> &nbsp; <span style="color:#f59e0b">⚠ ${exists} already existed</span>${errors ? ` &nbsp; <span style="color:#ef4444">✗ ${errors} errors</span>` : ''}`;
    } catch (e) {
      window.api.merakiOffProgress('meraki-add-progress', onProgress);
      summEl.innerHTML = `<span style="color:#ef4444">Error: ${escHtml(e.message)}</span>`;
    }
    btn.disabled = false; btn.textContent = 'Add to All Client Orgs';
  });

  // ── Remove Admin ───────────────────────────────────────────────────────────
  document.getElementById('mk-remove-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('mk-remove-email')?.value.trim();
    if (!email) { alert('Email is required.'); return; }

    const btn     = document.getElementById('mk-remove-btn');
    const logEl   = document.getElementById('mk-remove-log');
    const bodyEl  = document.getElementById('mk-remove-log-body');
    const summEl  = document.getElementById('mk-remove-summary');
    btn.disabled = true; btn.textContent = 'Running…';
    logEl.style.display = ''; bodyEl.innerHTML = ''; summEl.innerHTML = '';

    const onProgress = ({ orgName, status, error }) => {
      const icon  = status === 'removed' ? '✓' : status === 'not_found' ? '—' : '✗';
      const color = status === 'removed' ? '#10b981' : status === 'not_found' ? 'var(--text-muted)' : '#ef4444';
      const msg   = status === 'removed' ? 'Removed' : status === 'not_found' ? 'Not found (skipped)' : `Error: ${error}`;
      bodyEl.innerHTML += `<div><span style="color:${color}">${icon}</span> ${escHtml(orgName)} — ${msg}</div>`;
      bodyEl.scrollTop = bodyEl.scrollHeight;
    };
    window.api.merakiOnProgress('meraki-remove-progress', onProgress);

    try {
      const res = await window.api.merakiRemoveAdmin({ email });
      window.api.merakiOffProgress('meraki-remove-progress', onProgress);
      const removed   = (res.results || []).filter(r => r.status === 'removed').length;
      const notFound  = (res.results || []).filter(r => r.status === 'not_found').length;
      const errors    = (res.results || []).filter(r => r.status === 'error').length;
      summEl.innerHTML = `<span style="color:#10b981">✓ ${removed} removed</span> &nbsp; <span style="color:var(--text-muted)">— ${notFound} not found</span>${errors ? ` &nbsp; <span style="color:#ef4444">✗ ${errors} errors</span>` : ''}`;
    } catch (e) {
      window.api.merakiOffProgress('meraki-remove-progress', onProgress);
      summEl.innerHTML = `<span style="color:#ef4444">Error: ${escHtml(e.message)}</span>`;
    }
    btn.disabled = false; btn.textContent = 'Remove from All Client Orgs';
  });
}

function mkRenderAudit(orgs) {
  const resultsEl = document.getElementById('mk-audit-results');
  const summaryEl = document.getElementById('mk-audit-summary');
  if (!resultsEl) return;

  const isAdmin = _currentUser?.roles?.includes('hub.admin') || _currentUser?.roles?.includes('hub.it');

  const activeOrgs    = orgs.filter(o => !o.isExcluded);
  const excludedCount = orgs.length - activeOrgs.length;

  const templateOrg       = activeOrgs.find(o => (o.name || '').toLowerCase().includes('organization template'));
  const templateAnsAdmins = templateOrg ? (templateOrg.admins || []).filter(a => a.isAns) : [];

  const orgData = activeOrgs.map(org => {
    const admins       = (org.admins || []).filter(a => !a.error);
    const errCount     = (org.admins || []).filter(a => a.error).length;
    const ansAdmins    = admins.filter(a => a.isAns);
    const clientAdmins = admins.filter(a => !a.isAns);
    const isTemplate   = org === templateOrg;
    const missing      = isTemplate ? [] : templateAnsAdmins.filter(ta => !ansAdmins.find(a => a.email === ta.email));
    const extra        = isTemplate ? [] : ansAdmins.filter(a => !templateAnsAdmins.find(ta => ta.email === a.email));
    return { ...org, admins, errCount, ansAdmins, clientAdmins, isTemplate, missing, extra };
  });

  const totalAns         = orgData.reduce((s, o) => s + o.ansAdmins.length, 0);
  const totalClient      = orgData.reduce((s, o) => s + o.clientAdmins.length, 0);
  const issueCount       = orgData.filter(o => !o.isTemplate && (o.missing.length || o.extra.length)).length;
  const totalMissing     = orgData.reduce((s, o) => s + o.missing.length, 0);
  const orgsMissingCount = orgData.filter(o => o.missing.length > 0).length;

  // Update Audit tab badge
  const auditTabBtn = document.querySelector('.mk-tab[data-tab="audit"]');
  if (auditTabBtn) {
    auditTabBtn.textContent = issueCount > 0 ? `Audit  ⚠${issueCount}` : 'Audit';
  }

  // Summary bar
  const refreshedStr = _mkLastRefreshed
    ? `<span style="color:var(--text-muted);font-size:11px">· Refreshed ${_mkLastRefreshed.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</span>`
    : '';
  if (summaryEl) {
    summaryEl.innerHTML = `${activeOrgs.length} orgs &middot; ${totalAns} ANS admins &middot; ${totalClient} client admins`
      + (templateOrg ? ` &middot; Baseline: <strong>${escHtml(templateOrg.name)}</strong> (${templateAnsAdmins.length} ANS)` : '')
      + (issueCount ? ` &middot; <span style="color:#f59e0b">${issueCount} org${issueCount !== 1 ? 's' : ''} with issues</span>` : '')
      + (excludedCount ? ` &middot; <span style="color:var(--text-muted)">${excludedCount} excluded</span>` : '')
      + ` &nbsp; ${refreshedStr}`;
  }

  const sorted = [...orgData].sort((a, b) => {
    if (a.isTemplate) return -1;
    if (b.isTemplate) return 1;
    const ai = a.missing.length + a.extra.length;
    const bi = b.missing.length + b.extra.length;
    if (ai !== bi) return bi - ai;
    return (a.name || '').localeCompare(b.name || '');
  });

  _mkAuditSorted = sorted;

  // Apply active filter
  const filtered = _mkAuditFilter
    ? sorted.filter(o => (o.name || '').toLowerCase().includes(_mkAuditFilter))
    : sorted;

  const thStyle = 'padding:8px 12px;font-size:10px;font-weight:600;text-align:left;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em';

  const bulkFixBtn = (isAdmin && totalMissing > 0)
    ? `<button class="btn btn-ghost btn-sm mk-bulk-fix-all-btn"
         style="font-size:11px;padding:3px 10px;color:#10b981;border-color:#10b98140">
         Fix All Missing (${totalMissing} across ${orgsMissingCount} org${orgsMissingCount !== 1 ? 's' : ''})</button>`
    : '';

  resultsEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
      <input class="cd-find-input" id="mk-audit-filter" placeholder="Filter organizations…"
        value="${escHtml(_mkAuditFilter)}" style="width:220px">
      ${bulkFixBtn}
      <span style="flex:1"></span>
      <button class="btn btn-ghost btn-sm mk-export-csv-btn" style="font-size:11px;padding:3px 10px">Export CSV</button>
    </div>
    <div class="glass-card" style="padding:0;overflow:hidden;max-width:1000px">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:rgba(255,255,255,0.04)">
          <th style="${thStyle};min-width:200px">Organization</th>
          <th style="${thStyle};width:54px;text-align:center">ANS</th>
          <th style="${thStyle};width:60px;text-align:center">Client</th>
          <th style="${thStyle};width:70px;text-align:center">Missing</th>
          <th style="${thStyle};width:54px;text-align:center">Extra</th>
          <th style="${thStyle};width:160px">Status</th>
        </tr></thead>
        <tbody id="mk-org-tbody">
          ${filtered.map(o => mkOrgRowHtml(o)).join('')}
        </tbody>
      </table>
    </div>`;

  // Wire up filter input
  document.getElementById('mk-audit-filter')?.addEventListener('input', e => {
    _mkAuditFilter = e.target.value.toLowerCase();
    const f = _mkAuditFilter ? _mkAuditSorted.filter(o => (o.name || '').toLowerCase().includes(_mkAuditFilter)) : _mkAuditSorted;
    const tbody = document.getElementById('mk-org-tbody');
    if (tbody) tbody.innerHTML = f.map(o => mkOrgRowHtml(o)).join('');
  });
}

function mkOrgRowHtml(org) {
  const isExpanded = _mkExpandedOrgId === org.id;
  const hasIssues  = !org.isTemplate && (org.missing.length || org.extra.length);

  const statusHtml = org.isTemplate
    ? `<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:rgba(59,130,246,0.12);color:#60a5fa">Baseline</span>`
    : hasIssues
      ? `<span style="font-size:11px;color:#f59e0b">⚠ ${org.missing.length + org.extra.length} issue${org.missing.length + org.extra.length !== 1 ? 's' : ''}</span>`
      : `<span style="font-size:11px;color:#10b981">✓ OK</span>`;

  const missingHtml = (!org.isTemplate && org.missing.length)
    ? `<span style="color:#ef4444;font-weight:600">${org.missing.length}</span>`
    : `<span style="color:var(--text-muted)">—</span>`;

  const extraHtml = (!org.isTemplate && org.extra.length)
    ? `<span style="color:#f59e0b;font-weight:600">${org.extra.length}</span>`
    : `<span style="color:var(--text-muted)">—</span>`;

  const badge = org.isAns && !org.isTemplate
    ? `<span style="font-size:10px;padding:1px 6px;border-radius:8px;background:rgba(245,158,11,0.15);color:#f59e0b;margin-left:6px">ANS Org</span>`
    : '';

  const expandIcon = `<span style="margin-right:8px;color:var(--text-muted);font-size:9px;vertical-align:middle">${isExpanded ? '▼' : '▶'}</span>`;
  const rowBg = isExpanded ? 'background:rgba(255,255,255,0.03)' : (hasIssues ? 'background:rgba(245,158,11,0.02)' : '');

  const isAdmin = _currentUser?.isAdmin || _currentUser?.roles?.some(r => ['hub.admin','hub.it'].includes(r));
  const excludeBtn = (isAdmin && !org.isTemplate && !org.isAns)
    ? `<button class="btn btn-ghost btn-sm mk-org-exclude-btn"
         data-org-id="${escHtml(org.id)}" data-org-name="${escHtml(org.name)}"
         style="font-size:10px;padding:2px 7px;margin-left:8px;color:var(--text-muted);border-color:rgba(255,255,255,0.1)"
         title="Exclude this org from audit and bulk operations">Exclude</button>`
    : '';

  const expandedHtml = isExpanded ? `<tr class="mk-expanded-row">
    <td colspan="6" style="padding:0;border-top:1px solid var(--border)">
      ${mkOrgDetailHtml(org)}
    </td>
  </tr>` : '';

  return `<tr class="mk-org-row" data-org-id="${escHtml(org.id)}" style="cursor:pointer;border-top:1px solid var(--border);${rowBg}">
    <td style="padding:9px 12px;font-size:12px;font-weight:500">${expandIcon}${escHtml(org.name)}${badge}</td>
    <td style="padding:9px 12px;font-size:13px;text-align:center">${org.ansAdmins.length}</td>
    <td style="padding:9px 12px;font-size:13px;text-align:center">${org.clientAdmins.length}</td>
    <td style="padding:9px 12px;font-size:13px;text-align:center">${missingHtml}</td>
    <td style="padding:9px 12px;font-size:13px;text-align:center">${extraHtml}</td>
    <td style="padding:9px 12px;white-space:nowrap">${statusHtml}${excludeBtn}</td>
  </tr>${expandedHtml}`;
}

function mkOrgDetailHtml(org) {
  const isAdmin = _currentUser?.roles?.includes('hub.admin') || _currentUser?.roles?.includes('hub.it');
  let html = '';

  if (org.missing.length) {
    const addAllMissingBtn = isAdmin
      ? `<button class="btn btn-ghost btn-sm mk-add-all-missing-btn" data-org-id="${escHtml(org.id)}"
           style="font-size:10px;padding:2px 9px;color:#10b981;border-color:#10b98140;margin-left:auto">
           + Add All Missing (${org.missing.length})</button>`
      : '';
    html += `<div style="padding:10px 14px;background:rgba(239,68,68,0.05);border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="font-size:10px;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:.07em">Missing ANS Admins (${org.missing.length})</div>
        ${addAllMissingBtn}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${org.missing.map(a => {
          const addBtn = isAdmin
            ? `<button class="btn btn-ghost btn-sm mk-add-missing-btn"
                 data-org-id="${escHtml(org.id)}" data-email="${escHtml(a.email)}" data-name="${escHtml(a.name || a.email)}"
                 style="font-size:10px;padding:1px 6px;color:#10b981;border-color:#10b98140;line-height:1.4">+ Add</button>`
            : '';
          return `<span style="font-size:11px;padding:2px 4px 2px 8px;border-radius:10px;background:rgba(239,68,68,0.1);color:#fca5a5;display:inline-flex;align-items:center;gap:4px">${escHtml(a.name || a.email)}${addBtn}</span>`;
        }).join('')}
      </div>
    </div>`;
  }

  if (org.extra.length) {
    const removeAllExtraBtn = isAdmin
      ? `<button class="btn btn-ghost btn-sm mk-remove-all-extra-btn" data-org-id="${escHtml(org.id)}"
           style="font-size:10px;padding:2px 9px;color:#f59e0b;border-color:#f59e0b40;margin-left:auto">
           Remove All Extra (${org.extra.length})</button>`
      : '';
    html += `<div style="padding:10px 14px;background:rgba(245,158,11,0.05);border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="font-size:10px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:.07em">Extra ANS Admins not in baseline (${org.extra.length})</div>
        ${removeAllExtraBtn}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${org.extra.map(a => {
          const removeBtn = isAdmin
            ? `<button class="btn btn-ghost btn-sm mk-remove-extra-btn"
                 data-org-id="${escHtml(org.id)}" data-admin-id="${escHtml(a.id)}" data-admin-email="${escHtml(a.email)}"
                 style="font-size:10px;padding:1px 6px;color:#f59e0b;border-color:#f59e0b40;line-height:1.4">Remove</button>`
            : '';
          return `<span style="font-size:11px;padding:2px 4px 2px 8px;border-radius:10px;background:rgba(245,158,11,0.1);color:#fcd34d;display:inline-flex;align-items:center;gap:4px">${escHtml(a.name || a.email)}${removeBtn}</span>`;
        }).join('')}
      </div>
    </div>`;
  }

  const thS = 'padding:5px 12px;font-size:10px;font-weight:600;text-align:left;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em';
  const actionTh = isAdmin ? `<th style="${thS};width:80px"></th>` : '';

  const adminRows = org.admins.length
    ? org.admins.map(a => {
        const chip = a.isAns
          ? `<span style="display:inline-block;padding:1px 7px;border-radius:10px;font-size:10px;background:rgba(59,130,246,0.15);color:#60a5fa">ANS</span>`
          : `<span style="display:inline-block;padding:1px 7px;border-radius:10px;font-size:10px;background:rgba(148,163,184,0.1);color:var(--text-muted)">Client</span>`;
        const removeTd = isAdmin
          ? `<td style="padding:4px 12px;text-align:right">
              <button class="btn btn-ghost btn-sm mk-admin-remove-btn"
                data-org-id="${escHtml(org.id)}" data-admin-id="${escHtml(a.id)}" data-admin-email="${escHtml(a.email)}"
                style="font-size:10px;padding:2px 7px;color:#ef444480;border-color:#ef444430">Remove</button>
            </td>`
          : '';
        return `<tr style="border-top:1px solid rgba(255,255,255,0.04)">
          <td style="padding:5px 12px;font-size:12px">${escHtml(a.name || '')}</td>
          <td style="padding:5px 12px;font-size:12px;color:var(--text-muted)">${escHtml(a.email)}</td>
          <td style="padding:5px 12px;font-size:11px;color:var(--text-muted)">${escHtml(a.orgAccess || '')}</td>
          <td style="padding:5px 12px;font-size:11px;color:var(--text-muted)">${a.lastActive || '—'}</td>
          <td style="padding:5px 12px">${chip}</td>
          ${removeTd}
        </tr>`;
      }).join('')
    : `<tr><td colspan="${isAdmin ? 6 : 5}" style="padding:10px 12px;font-size:12px;color:var(--text-muted)">No admins found</td></tr>`;

  html += `<table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:rgba(255,255,255,0.02)">
      <th style="${thS}">Name</th>
      <th style="${thS}">Email</th>
      <th style="${thS}">Role</th>
      <th style="${thS}">Last Active</th>
      <th style="${thS}">Type</th>
      ${actionTh}
    </tr></thead>
    <tbody>${adminRows}</tbody>
  </table>`;

  if (isAdmin) {
    html += `<div id="mk-add-form-${escHtml(org.id)}" style="padding:8px 14px;border-top:1px solid var(--border)">
      <button class="btn btn-ghost btn-sm mk-org-add-admin-btn" data-org-id="${escHtml(org.id)}"
        style="font-size:11px;padding:3px 10px;color:#60a5fa;border-color:#60a5fa40">+ Add Admin to this org</button>
    </div>`;
  }

  return html;
}

async function mkRenderExcludedOrgs() {
  const el = document.getElementById('mk-excluded-content');
  if (!el) return;
  el.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:12px">Loading…</div>`;

  try {
    const res = await window.api.merakiGetExcludedOrgs();
    if (!res.ok) throw new Error(res.error);
    const orgs = res.orgs || [];

    if (!orgs.length) {
      el.innerHTML = `<div class="glass-card" style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">No excluded orgs.</div>`;
      return;
    }

    el.innerHTML = `
      <div class="glass-card" style="padding:0;overflow:hidden">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:rgba(255,255,255,0.04)">
            <th style="padding:8px 14px;font-size:10px;font-weight:600;text-align:left;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Organization</th>
            <th style="padding:8px 14px;font-size:10px;font-weight:600;text-align:left;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em;width:160px">Excluded On</th>
            <th style="padding:8px 14px;width:100px;text-align:center"></th>
          </tr></thead>
          <tbody>
            ${orgs.map(o => `<tr style="border-top:1px solid var(--border)">
              <td style="padding:9px 14px;font-size:13px">${escHtml(o.name)}</td>
              <td style="padding:9px 14px;font-size:11px;color:var(--text-muted)">${o.excludedAt ? new Date(o.excludedAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }) : '—'}</td>
              <td style="padding:9px 14px;text-align:center">
                <button class="btn btn-ghost btn-sm mk-unexclude-btn"
                  data-org-id="${escHtml(o.id)}" data-org-name="${escHtml(o.name)}"
                  style="font-size:11px;padding:2px 10px;color:#10b981;border-color:#10b98140">Un-exclude</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    el.addEventListener('click', async e => {
      const btn = e.target.closest('.mk-unexclude-btn');
      if (!btn) return;
      const { orgId, orgName } = btn.dataset;
      btn.disabled = true; btn.textContent = 'Saving…';
      const res2 = await window.api.merakiSetOrgExcluded({ orgId, orgName, excluded: false });
      if (res2.ok) {
        // Also update cached audit data if present
        if (_mkAuditData) {
          const org = _mkAuditData.find(o => o.id === orgId);
          if (org) org.isExcluded = false;
        }
        mkRenderExcludedOrgs();
      } else {
        btn.disabled = false; btn.textContent = 'Un-exclude';
      }
    });

  } catch (e) {
    el.innerHTML = `<div style="padding:12px;color:var(--danger,#ef4444);font-size:12px">Error: ${escHtml(e.message)}</div>`;
  }
}

// ─── Meraki Org Mapping (in Company Mapping tool) ────────────────────────────

let _mkOrgSuggestions    = null; // Map<orgNameLower, {atId, atName, score}> — persists across re-renders
let _mkOrgMapClickHandler = null; // removed before each re-render to avoid stacking

function mkNormalize(s) {
  return (s || '').toLowerCase()
    .replace(/\b(inc|llc|corp|co|ltd|limited|networks?|technology|technologies|tech|systems?|solutions?|group|services?|consulting|associates?|enterprises?|holdings?|international|management|communications?|partners?)\b/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function mkFuzzyScore(a, b) {
  const na = mkNormalize(a);
  const nb = mkNormalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;
  // Substring containment (proportional to shorter length)
  if (na.includes(nb) || nb.includes(na))
    return Math.min(na.length, nb.length) / Math.max(na.length, nb.length) * 0.95;
  // Jaccard word overlap
  const wa = new Set(na.split(' ').filter(w => w.length > 1));
  const wb = new Set(nb.split(' ').filter(w => w.length > 1));
  if (!wa.size || !wb.size) return 0;
  let overlap = 0;
  wa.forEach(w => { if (wb.has(w)) overlap++; });
  return overlap / (wa.size + wb.size - overlap);
}

async function renderMerakiOrgMapping() {
  const el = document.getElementById('mk-org-map-content');
  if (!el) return;

  // Remove stale handler before re-rendering to avoid stacking
  if (_mkOrgMapClickHandler) {
    el.removeEventListener('click', _mkOrgMapClickHandler);
    _mkOrgMapClickHandler = null;
  }

  el.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:16px">Loading Meraki orgs…</div>`;

  try {
    const [orgsRes, hubRes] = await Promise.all([
      window.api.merakiGetOrgs(),
      window.api.cmGetHubData(),
    ]);

    if (!orgsRes.ok) throw new Error(orgsRes.error || 'Failed to load Meraki orgs');

    const orgs = orgsRes.orgs || [];
    const hub  = hubRes?.companies || [];

    // Build reverse map: merakiOrgName.lower → { atId, atName }
    const merakiToAt = {};
    hub.forEach(company => {
      (company.platforms?.meraki || []).forEach(mk => {
        if (mk.name) merakiToAt[mk.name.toLowerCase()] = { atId: company.atId, atName: company.atName };
      });
    });

    // Annotate orgs with match + active suggestion (skip suggestion if already matched)
    const annotated = orgs.map(org => ({
      ...org,
      match:      merakiToAt[org.name.toLowerCase()] || null,
      suggestion: (_mkOrgSuggestions && !merakiToAt[org.name.toLowerCase()])
                    ? (_mkOrgSuggestions.get(org.name.toLowerCase()) || null)
                    : null,
    }));

    // Sort: suggestions (high conf first) → unmapped → mapped → ANS
    annotated.sort((a, b) => {
      const pri = x => x.isAns ? 0 : x.match ? 1 : x.suggestion ? (x.suggestion.score >= 0.75 ? 4 : 3) : 2;
      const diff = pri(b) - pri(a);
      if (diff !== 0) return diff;
      if (a.suggestion && b.suggestion) return b.suggestion.score - a.suggestion.score;
      return (a.name || '').localeCompare(b.name || '');
    });

    const unmapped   = annotated.filter(o => !o.match && !o.isAns).length;
    const hasSugg    = _mkOrgSuggestions && _mkOrgSuggestions.size > 0;
    const suggCount  = hasSugg ? annotated.filter(o => o.suggestion).length : 0;
    const highCount  = hasSugg ? annotated.filter(o => o.suggestion && o.suggestion.score >= 0.75).length : 0;

    const acceptHighBtn = highCount > 0
      ? `<button class="btn btn-primary btn-sm mk-org-accept-high-btn" style="font-size:11px;padding:3px 10px">Accept High Confidence (${highCount})</button>`
      : '';
    const clearSuggBtn = hasSugg
      ? `<button class="btn btn-ghost btn-sm mk-org-clearsugg-btn" style="font-size:11px;padding:3px 10px">Clear Suggestions</button>`
      : '';
    const suggNote = suggCount > 0
      ? `<span style="font-size:11px;color:var(--text-muted)">${suggCount} suggestion${suggCount !== 1 ? 's' : ''} · ${highCount} high confidence ≥75%</span>`
      : '';

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
        <span style="font-size:12px;color:var(--text-muted)">${orgs.length} Meraki orgs &middot; <span style="color:${unmapped > 0 ? '#f59e0b' : '#10b981'}">${unmapped} unmapped</span></span>
        <span style="flex:1;min-width:8px"></span>
        ${suggNote}
        ${acceptHighBtn}
        ${clearSuggBtn}
        <button class="btn btn-secondary btn-sm mk-org-automatch-btn" style="font-size:11px;padding:3px 10px">✨ Auto-Match</button>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-bottom:12px">Map Meraki org names to AT companies so the correct client name appears in the audit.</div>
      <div class="settings-section" style="padding:0">
        <table class="cd-table">
          <thead><tr>
            <th style="min-width:240px">Meraki Org</th>
            <th>Mapped AT Company</th>
            <th style="width:120px;text-align:center">Action</th>
          </tr></thead>
          <tbody id="mk-org-map-tbody">
            ${annotated.map(org => mkOrgMapRowHtml(org)).join('')}
          </tbody>
        </table>
      </div>`;

    const handler = async e => {
      // Auto-Match: fuzzy-score all unmapped non-ANS orgs against AT companies
      if (e.target.closest('.mk-org-automatch-btn')) {
        _mkOrgSuggestions = new Map();
        annotated.filter(o => !o.match && !o.isAns).forEach(org => {
          let best = null, bestScore = 0;
          hub.forEach(co => {
            const score = mkFuzzyScore(org.name, co.atName || '');
            if (score > bestScore) { bestScore = score; best = co; }
          });
          if (bestScore >= 0.4 && best) {
            _mkOrgSuggestions.set(org.name.toLowerCase(), { atId: best.atId, atName: best.atName, score: bestScore });
          }
        });
        renderMerakiOrgMapping();
        return;
      }

      // Clear all suggestions
      if (e.target.closest('.mk-org-clearsugg-btn')) {
        _mkOrgSuggestions = null;
        renderMerakiOrgMapping();
        return;
      }

      // Accept all high-confidence suggestions (≥75%)
      if (e.target.closest('.mk-org-accept-high-btn')) {
        const highEntries = [...(_mkOrgSuggestions || new Map()).entries()]
          .filter(([, v]) => v.score >= 0.75);
        for (const [orgNameLower, s] of highEntries) {
          const org = annotated.find(o => o.name.toLowerCase() === orgNameLower);
          if (org) {
            await window.api.cmAddPlatformMapping({ atId: s.atId, platform: 'meraki', platformName: org.name });
            _mkOrgSuggestions.delete(orgNameLower);
          }
        }
        if (_mkOrgSuggestions && _mkOrgSuggestions.size === 0) _mkOrgSuggestions = null;
        renderMerakiOrgMapping();
        return;
      }

      // Accept single suggestion
      const acceptBtn = e.target.closest('.mk-org-accept-btn');
      if (acceptBtn) {
        const { atid, orgname } = acceptBtn.dataset;
        await window.api.cmAddPlatformMapping({ atId: parseInt(atid, 10), platform: 'meraki', platformName: orgname });
        if (_mkOrgSuggestions) {
          _mkOrgSuggestions.delete(orgname.toLowerCase());
          if (_mkOrgSuggestions.size === 0) _mkOrgSuggestions = null;
        }
        renderMerakiOrgMapping();
        return;
      }

      // Skip single suggestion (dismiss without accepting)
      const skipBtn = e.target.closest('.mk-org-skip-btn');
      if (skipBtn) {
        const { orgname } = skipBtn.dataset;
        if (_mkOrgSuggestions) {
          _mkOrgSuggestions.delete(orgname.toLowerCase());
          if (_mkOrgSuggestions.size === 0) _mkOrgSuggestions = null;
        }
        // Update just that row in place
        const org = annotated.find(o => o.name === orgname);
        if (org) {
          org.suggestion = null;
          const row = skipBtn.closest('tr');
          if (row) row.outerHTML = mkOrgMapRowHtml(org);
        }
        // If no more suggestions, drop the Accept High button from header
        if (!_mkOrgSuggestions) renderMerakiOrgMapping();
        return;
      }

      // Manual assign: open search dropdown
      const assignBtn = e.target.closest('.mk-org-assign-btn');
      if (assignBtn) {
        const orgName = assignBtn.dataset.orgName;
        const td = assignBtn.closest('td');
        td.innerHTML = `
          <div style="position:relative">
            <input class="cd-find-input" placeholder="Search AT company…" style="width:100%;box-sizing:border-box" data-org-name="${escHtml(orgName)}">
            <div class="cd-find-results" id="mk-org-at-dropdown" style="position:absolute;z-index:200;width:100%;max-height:200px;overflow-y:auto;background:var(--surface);border:1px solid var(--border);border-radius:6px;top:100%;left:0;display:none"></div>
          </div>`;
        const input    = td.querySelector('input');
        const dropdown = td.querySelector('#mk-org-at-dropdown');
        input.focus();
        let timer;
        input.addEventListener('input', () => {
          clearTimeout(timer);
          const q = input.value.trim();
          if (!q) { dropdown.style.display = 'none'; return; }
          timer = setTimeout(async () => {
            const results = await window.api.cmSearchAtCompanies(q);
            if (!results?.length) { dropdown.style.display = 'none'; return; }
            dropdown.innerHTML = results.map(r =>
              `<div class="mk-org-at-result" style="padding:7px 10px;cursor:pointer;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.05)"
                data-atid="${r.id}" data-atname="${escHtml(r.name)}" data-orgname="${escHtml(orgName)}">${escHtml(r.name)}</div>`
            ).join('');
            dropdown.style.display = '';
          }, 280);
        });
        return;
      }

      // AT search result selected
      const atResult = e.target.closest('.mk-org-at-result');
      if (atResult) {
        const { atid, orgname } = atResult.dataset;
        await window.api.cmAddPlatformMapping({ atId: parseInt(atid, 10), platform: 'meraki', platformName: orgname });
        if (_mkOrgSuggestions) _mkOrgSuggestions.delete(orgname.toLowerCase());
        renderMerakiOrgMapping();
        return;
      }

      // Remove existing mapping
      const removeBtn = e.target.closest('.mk-org-remove-btn');
      if (removeBtn) {
        const { atid, orgname } = removeBtn.dataset;
        await window.api.cmRemovePlatformMapping({ atId: parseInt(atid, 10), platform: 'meraki', platformName: orgname });
        renderMerakiOrgMapping();
        return;
      }
    };

    _mkOrgMapClickHandler = handler;
    el.addEventListener('click', handler);

  } catch (e) {
    el.innerHTML = `<div class="glass-card" style="padding:16px;color:var(--danger,#ef4444)">Error loading Meraki orgs: ${escHtml(e.message)}</div>`;
  }
}

function mkOrgMapRowHtml(org) {
  const ansBadge = org.isAns
    ? `<span style="font-size:10px;padding:1px 6px;border-radius:8px;background:rgba(245,158,11,0.12);color:#f59e0b;margin-left:6px">ANS Org</span>`
    : '';
  const tplBadge = org.isTemplate
    ? `<span style="font-size:10px;padding:1px 6px;border-radius:8px;background:rgba(59,130,246,0.12);color:#60a5fa;margin-left:6px">Template</span>`
    : '';

  if (org.isAns) {
    return `<tr>
      <td style="padding:8px 12px;font-size:12px">${escHtml(org.name)}${ansBadge}${tplBadge}</td>
      <td style="padding:8px 12px;font-size:12px;color:var(--text-muted)" colspan="2">ANS internal — not mapped to a client company</td>
    </tr>`;
  }

  if (org.match) {
    return `<tr>
      <td style="padding:8px 12px;font-size:12px">${escHtml(org.name)}</td>
      <td style="padding:8px 12px;font-size:12px">
        <span>${escHtml(org.match.atName)}</span>
        <span style="font-size:10px;color:var(--text-muted);margin-left:6px">AT#${org.match.atId}</span>
      </td>
      <td style="padding:8px 12px;text-align:center">
        <button class="btn btn-ghost btn-sm mk-org-remove-btn" data-atid="${org.match.atId}" data-orgname="${escHtml(org.name)}" style="font-size:11px;padding:2px 8px">Remove</button>
      </td>
    </tr>`;
  }

  if (org.suggestion) {
    const s = org.suggestion;
    const pct = Math.round(s.score * 100);
    const confColor = s.score >= 0.75 ? '#10b981' : s.score >= 0.55 ? '#f59e0b' : '#6b7280';
    const confLabel = s.score >= 0.75 ? 'High' : s.score >= 0.55 ? 'Med' : 'Low';
    return `<tr style="background:rgba(16,185,129,0.04)">
      <td style="padding:8px 12px;font-size:12px">${escHtml(org.name)}</td>
      <td style="padding:8px 12px;font-size:12px">
        <span>${escHtml(s.atName)}</span>
        <span style="font-size:10px;color:var(--text-muted);margin-left:6px">AT#${s.atId}</span>
        <span style="font-size:10px;padding:1px 5px;border-radius:8px;background:${confColor}22;color:${confColor};margin-left:6px">${confLabel} ${pct}%</span>
      </td>
      <td style="padding:8px 12px;text-align:center;white-space:nowrap">
        <button class="btn btn-ghost btn-sm mk-org-accept-btn"
          data-atid="${s.atId}" data-orgname="${escHtml(org.name)}"
          style="font-size:11px;padding:2px 8px;color:#10b981;border-color:#10b98140" title="Accept">✓</button>
        <button class="btn btn-ghost btn-sm mk-org-skip-btn"
          data-orgname="${escHtml(org.name)}"
          style="font-size:11px;padding:2px 8px;color:var(--text-muted);margin-left:4px" title="Skip">✕</button>
      </td>
    </tr>`;
  }

  return `<tr>
    <td style="padding:8px 12px;font-size:12px">${escHtml(org.name)}</td>
    <td style="padding:8px 12px;font-size:12px;color:var(--text-muted)">—</td>
    <td style="padding:8px 12px;text-align:center">
      <button class="btn btn-ghost btn-sm mk-org-assign-btn" data-org-name="${escHtml(org.name)}" style="font-size:11px;padding:2px 8px;color:#60a5fa;border-color:#60a5fa40">+ Assign</button>
    </td>
  </tr>`;
}

