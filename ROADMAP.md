# Anchor Hub — Roadmap

> Living document. Add tool ideas here so nothing gets lost. Update status as things move.
>
> **Vision:** Enterprise-grade internal platform. No "simplest option" shortcuts — build it the way a SaaS company would. Azure is available and should be used properly.

---

## ✅ Shipped

| Tool | Version |
|------|---------|
| Subscription Audit | v1.0 |
| Invoice Monitor | v1.0 |
| Margin Analyzer | v1.1 |
| Company Mapping | v1.1 |
| Kaseya Invoice Processor | v1.2 |
| Invoice Processor | v1.2 |
| Contract Changes | v1.2 |
| Contract Renewals | v1.2 |
| BlackPoint / CompassOne | v1.2 |
| Project Time Summary | v1.3 |
| MSC Agreements | v1.3 |
| Sidebar Customization | v1.3 |
| Microsoft SSO / Entra ID login | v1.4 |
| Contract Name column (Project Time Summary) | v1.4 |
| Microsoft profile photo in user chip | v1.4 |

---

## 🔄 In Progress

- [ ] Brian's tools — port from Flask (~5 tools)

---

## 🏗 Platform Priorities

Do these in order. The Azure backend work unlocks everything below it.

---

### Sprint 1 — Foundation (do these together)

- [x] **Microsoft SSO / Entra ID** *(shipped v1.4.0)*
  MSAL PublicClientApplication with file-based token cache. Roles defined in Entra ID (`hub.admin`, `hub.standard`, `hub.readonly`). Admin consent granted tenant-wide. Profile photo pulled from Microsoft Graph.

- [ ] **Modular file restructure**
  Split `main.js` and `app.js` into per-tool files (`main/ipc/toolName.js`, `renderer/views/toolName.js`). Do this alongside SSO so the new auth layer is built into a clean structure from day one. Prevents merge conflicts as contributor count grows.

- [ ] **Intune / MDM deployment**
  Package as Win32 app and push via Intune. Solves Windows SmartScreen for all managed employee machines immediately — no cert required for internal distribution.

---

### Sprint 2 — Azure Backend

Replace all local-only storage with a proper centralized backend. The Electron app becomes a thick client that authenticates via MSAL and talks to Azure for anything that needs to be shared or audited.

| Current (prototype) | Replace with |
|---|---|
| `keytar` per-machine secrets | **Azure Key Vault** — central, audited, revocable |
| Local JSON settings files | **Azure App Configuration** — push config to all users instantly |
| Local run history | **Azure SQL or Cosmos DB** — queryable, reportable |
| No monitoring | **Application Insights** — native to Azure tenant |
| No notifications | **Azure Function + DB** — admin posts, all users see it |
| Email idea submissions | **Microsoft Graph → Teams channel or Planner** |

Specific items:
- [ ] **Azure Key Vault — full API key migration**
  Move all API credentials out of per-machine keytar into a central, audited Key Vault. Scope covers: Pax8, Autotask, Claude API, Blackpoint, and Datto RMM. When someone leaves or a key rotates, one change propagates to every machine instantly.

  **Autotask two-tier model:** Key Vault holds a shared read-only Autotask API key — every user gets it automatically with no setup required. Users who need write access (ticket creation, time entries, etc.) enter their personal write API key once; the app stores it locally via keytar and uses it in place of the KV key for any write operations. This keeps the shared key clean and auditable while letting authorized users work at full capability without a separate credential request workflow.
- [ ] **Azure App Configuration** — centralize tool settings. Admin changes a value, all machines pick it up.
- [ ] **Azure SQL / Cosmos DB** — run history, notifications, announcements, idea submissions, audit trail.
- [ ] **Application Insights** — replaces Sentry. Already in the Azure ecosystem.
- [ ] **Azure Functions** — serverless API layer between the Electron app and the Azure data services.

---

### Sprint 2.5 — Microsoft Graph: Email & Teams

These build directly on the SSO foundation already in place. No Azure backend required — just additional Graph scopes added to the MSAL config.

- [ ] **Direct email sending (`Mail.Send` scope)** — Replace all `mailto:` links (currently opens Outlook) with Graph's `sendMail` endpoint. Email sends directly from the signed-in user's Exchange mailbox — Outlook doesn't need to be open. First candidate: Project Time Summary export. Longer term: any tool that produces a report can email it in one click. Optional: support sending from a shared mailbox (e.g. `hub@anchornetworksolutions.com`) with `Mail.Send.Shared`.

- [ ] **Teams channel posting (`ChannelMessage.Send` scope)** — Post messages into any Teams channel the signed-in user has access to. Sends as that user. Use cases: tool completion summaries, count mismatch alerts, admin announcements pushed directly to the team channel.

- [ ] **Teams incoming webhooks (no scope — just a URL)** — Simpler one-way option for automated alerts. Configure a webhook URL in Teams, paste it into Hub settings, and tools can post "Anchor Hub" bot messages to a channel. Good for scheduled tool results and notifications where posting as a named user isn't needed. Can be done before the full `ChannelMessage.Send` work.

---

### Sprint 3 — Home Screen & Notifications

These depend on the Azure backend being in place (run history lives in the DB, announcements come from the backend).

- [ ] **Tool run schedule & status badges** — Each tool gets a configurable run frequency (daily / weekly / monthly). Last-run timestamp stored in Azure DB. Home card badge turns green (on schedule), yellow (due soon), red (overdue).
- [ ] **Notifications center** — Bell icon with badge count. Pulls overdue tool alerts, admin announcements, and new release notes. Admins post announcements from a simple admin panel.
- [ ] **In-app idea submission** — Button that submits to the Azure backend → posts directly to a designated Teams channel via Graph (`ChannelMessage.Send`) so ideas are visible and trackable without leaving the hub.

---

### Sprint 4 — Access Control & Polish

- [ ] **Role-based tool access & permissions architecture**
  Gate tool visibility and write operations by Entra ID role (`hub.admin`, `hub.standard`, `hub.readonly`). Manage access from the Azure portal without touching the app.

  **Access model (important for Key Vault design):** Key Vault is accessed by the Hub's own Entra service principal — not by individual users. This means every authenticated user gets the secrets the app needs (shared read-only API keys, hostnames, etc.) without requiring per-user KV permissions. Entra ID roles then control what the *app* allows each user to do with those secrets. The result: one place to manage user access (Entra app roles), one place to manage credentials (Key Vault), no overlap.

  **What roles gate:**
  - Tool visibility (already partially in place via sidebar config)
  - Write operations vs. read-only mode (e.g., a `hub.readonly` user can run reports but cannot trigger Quick Jobs or modify Duo)
  - Sensitive tools entirely (e.g., Duo Management restricted to `hub.admin`)
  - Personal write API key entry (e.g., only `hub.standard`+ can register a personal Autotask write key)
- [ ] **Audit trail** — Log every significant action (who ran what, what data was changed, when) to Azure DB.
- [ ] **Azure Trusted Signing** — ~$10/month via Azure. Gives the installer a Microsoft-backed signature and builds SmartScreen reputation over time. Covers distribution outside of Intune (shared links, new machines being set up, etc.).
- [ ] **Central API key revocation** — Admin UI to revoke or rotate any API key across all users from one place. (Depends on Key Vault)

---

## 💡 Ideas & Backlog

Drop ideas here. Nothing too small or too big.

- [ ] New employee onboarding checklist tool
- [ ] In-app bug / feedback reporter

- [ ] **Hub Home / Quick-Access Intranet Page**
  Replace or supplement the current home screen with a proper internal portal — something that functions like a lightweight company intranet. Core ideas:
  - **Quick-launch tiles** for frequently used external websites and internal tools (Autotask, Pax8, Duo Admin, Datto, Microsoft 365 Admin, etc.) — one click, no hunting for bookmarks
  - **Admin-managed link collections** pushed to all users (e.g., "Vendor Portals", "Internal Resources") alongside **personal bookmarks** each user can add and arrange themselves
  - **Information widgets** — pinned announcements from admin, recent Hub activity, maybe a plain-text "message of the day" field
  - Fully customizable layout: drag to reorder tiles, show/hide sections, resize groups
  - Builds on Sprint 3's Notifications center (announcements feed) and the Azure backend (user preferences stored centrally so the layout follows the user across machines)
  Goal: when someone opens the Hub, this is the one tab they never close — the intranet home they actually use instead of a SharePoint page nobody keeps up to date.

- [ ] **Device Coverage Tool**
  A cross-platform coverage matrix that answers the question: *"For every device we manage, what's installed and what's missing?"* Covers all connected platforms — Datto RMM, Duo, Bitdefender/EDR, CyberQP, Splashtop, and others as integrations are added.

  **Two modes:**
  - **Per-client view** — select a client, see every device with a color-coded coverage grid (green = present, red = missing, grey = unknown). Click a gap to see details or kick off remediation.
  - **Full fleet sweep** — run across all clients and surface the worst coverage gaps first: devices with no EDR, no MFA, no RMM agent, etc. Exportable for QBR prep or internal review.

  **Remediation:** for gaps that can be fixed via Datto RMM (Duo install, agent deployment, etc.), a one-click "Push Quick Job" button triggers the install directly from the coverage view — same mechanism as the Duo Management wizard, just surfaced at the fleet level.

  Long-term goal: replace the manual quarterly tool inventory spreadsheet and turn reactive coverage reviews into a live, always-current dashboard.

- [ ] **Duo Billing Tool (separate app or role-gated section)**
  Admins who run billing should not need write access to Duo. Separate this from the Duo Management tool entirely — either a standalone tool or a role-gated read-only section. Would pull sub-account edition/telephony data from Duo and map it to Pax8 or billing records for monthly reconciliation. Requires `duo-accounts-ikey/skey` (Accounts API read) but zero write permissions on the Admin API key.

- [ ] **SharePoint Contract Lookup** — Given a client name, search their SharePoint folder for a contract document, pull key fields (term dates, rates, services), and surface them inside Anchor Hub. No one needs to open SharePoint or hunt through folders. Requires `Sites.Read.All` or `Files.Read.All` Graph scope. Access is scoped to what the signed-in user can already see in SharePoint — no new permissions beyond what they have today.

- [ ] **Tool Inventory & License Count Tracker**
  Replace the manual quarterly tool inventory spreadsheet with an automated pull from every connected platform. The tool would have two modes:
  - **Ad-hoc client lookup** — select any client and instantly see current license/seat counts across all integrated systems (Kaseya RMM, Pax8, BitDefender, CyberQP Elevate, Splashtop Pro, SaaS, LifeCycle Insights, Liongard, and the MSC sheet). Useful for spot-checks, renewals, or onboarding reviews without touching any source system directly.
  - **Full quarterly snapshot** — pulls counts for every client across every system and writes a new dated tab into the shared SharePoint Excel file, matching the existing column layout exactly. Can be triggered manually by whoever runs the quarterly review or scheduled to run automatically so the file is always up to date before anyone asks for it.
  The long-term goal is eliminating the manual "log into eight systems and type the numbers in" process entirely.

---

## 🤝 Contributors

| Person | Area |
|--------|------|
| Mike | Core platform, Autotask/Pax8 tools |
| Brian | Flask tool ports (CIPP, UAR, etc.) |

**Branch rules:** All changes via PR into `main`. One approval required. Never push directly to main. Never bump `package.json` version without coordinating a release.
