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
- [ ] **Azure Key Vault** — migrate API keys out of keytar. When someone leaves, revoke from one place.
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

- [ ] **Role-based tool access** — Gate tool visibility by Entra ID role. Manage access from Azure portal without touching the app. (Depends on SSO)
- [ ] **Audit trail** — Log every significant action (who ran what, what data was changed, when) to Azure DB.
- [ ] **Azure Trusted Signing** — ~$10/month via Azure. Gives the installer a Microsoft-backed signature and builds SmartScreen reputation over time. Covers distribution outside of Intune (shared links, new machines being set up, etc.).
- [ ] **Central API key revocation** — Admin UI to revoke or rotate any API key across all users from one place. (Depends on Key Vault)

---

## 💡 Ideas & Backlog

Drop ideas here. Nothing too small or too big.

- [ ] New employee onboarding checklist tool
- [ ] In-app bug / feedback reporter

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
