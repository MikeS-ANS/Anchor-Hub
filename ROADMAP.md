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

---

## 🔄 In Progress

- [ ] Brian's tools — port from Flask (~5 tools)
- [ ] Contract Name column in Project Time Summary

---

## 🏗 Platform Priorities

Do these in order. The Azure backend work unlocks everything below it.

---

### Sprint 1 — Foundation (do these together)

- [ ] **Microsoft SSO / Entra ID**
  Everything else depends on identity. Register the app in Azure, implement MSAL in Electron, define roles (`hub.admin`, `hub.finance`, `hub.readonly`, etc.). Token cached in keychain between sessions — users see a Microsoft login once.

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

### Sprint 3 — Home Screen & Notifications

These depend on the Azure backend being in place (run history lives in the DB, announcements come from the backend).

- [ ] **Tool run schedule & status badges** — Each tool gets a configurable run frequency (daily / weekly / monthly). Last-run timestamp stored in Azure DB. Home card badge turns green (on schedule), yellow (due soon), red (overdue).
- [ ] **Notifications center** — Bell icon with badge count. Pulls overdue tool alerts, admin announcements, and new release notes. Admins post announcements from a simple admin panel.
- [ ] **In-app idea submission** — Button that submits to the Azure backend → routed to a Teams channel or Planner board so ideas are tracked properly.

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
- [ ] _(your idea here)_

---

## 🤝 Contributors

| Person | Area |
|--------|------|
| Mike | Core platform, Autotask/Pax8 tools |
| Brian | Flask tool ports (CIPP, UAR, etc.) |

**Branch rules:** All changes via PR into `main`. One approval required. Never push directly to main. Never bump `package.json` version without coordinating a release.
