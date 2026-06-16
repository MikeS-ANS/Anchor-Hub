# Anchor Hub — Roadmap

> Living document. Add tool ideas here so nothing gets lost. Update status as things move.

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

Do these in order. Don't skip ahead.

### P1 — Before next release
- [ ] **EV Code Signing Certificate** — Fixes Windows SmartScreen and AV flagging permanently. Get from DigiCert or Sectigo (~$200-400/yr). Plug into electron-builder config. Every release after this will be clean.
- [ ] **Sentry Error Monitoring** — Free tier. Electron SDK. Gives visibility into crashes and API failures across all employee machines without waiting for someone to report it.

### P2 — After Brian's tools land
- [ ] **Modular file restructure** — Split main.js and app.js into per-tool files. Each tool gets its own file under `main/ipc/` and `renderer/views/`. Prevents merge conflicts as the contributor count grows.
- [ ] **Intune / MDM deployment** — Package the installer for Intune push so IT can deploy to new employees without a manual install step.

### P3 — After restructure
- [ ] **Microsoft SSO / Entra ID** — MSAL + Azure app registration. Define roles (admin, finance, read-only). Gate tool visibility by role. Solves API key revocation and access control in one shot.
- [ ] **Audit trail / action log** — Log who did what and when for any action that writes data (contract updates, Excel write-backs, etc.).

---

## 💡 Ideas & Backlog

Drop ideas here. Nothing too small or too big — get it out of your head and into the list.

- [ ] Role-based tool access per user (depends on SSO)
- [ ] In-app bug / feedback reporter so employees don't have to message you
- [ ] Central API key revocation — when someone leaves, one place to cut access
- [ ] New employee onboarding checklist tool
- [ ] _(your idea here)_

---

## 🤝 Contributors

| Person | Area |
|--------|------|
| Mike | Core platform, Autotask/Pax8 tools |
| Brian | Flask tool ports (CIPP, UAR, etc.) |

**Branch rules:** All changes via PR into `main`. One approval required. Never push directly to main. Never bump `package.json` version without coordinating a release.
