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
| Modular IPC restructure (main/ipc/) | v1.5 |
| Home Screen daily start page | v1.5.7 |
| Help page overhaul + in-app support | v1.5.7 |

---

## 🔄 In Progress

- [ ] Brian's tools — port from Flask (~5 tools)
- [ ] Company Mapping redesign — Autotask auto-match + centralized storage (see below)

## ✅ Invoice Processor — Near-Term Queue

Work these in order — each one unblocks the next.

- [x] **Pax8 API key → Key Vault** — `pax8-client-id` / `pax8-client-secret` in `anchor-hub-vault`. Code reads from KV, keytar removed for these.
- [x] **Autotask two-tier key** — shared read-only key in Key Vault (`autotask-username` / `autotask-secret` / `autotask-integration-code`). Personal write key stored in keytar per machine via Settings. `atFetch` checks keytar first, falls back to KV automatically.
- [ ] **Company auto-match from Autotask** — at invoice processing time, query AT `/Companies/query` with a fuzzy name search for each unmapped company. Auto-assign high-confidence matches, surface low-confidence ones for one-click admin confirmation. Confirmed overrides stored in SharePoint JSON (via Graph) as the bridge until the SQL client directory is built.
- [ ] **Push error logging** — persist a structured log entry for every AT push run: timestamp, service type, effective date, per-company result (success / skipped / error). Show a "Push History" panel in the tool. Skipped companies and errors surface clearly so mappings can be fixed. Long-term: admin notification via Teams webhook when any company is skipped due to missing mapping.
- [ ] **QBO auto-push** — connect QuickBooks Online API to directly update the QBO account breakdown instead of copy-paste. Same pattern as Autotask push: per-account buttons, effective date picker, progress modal with per-line results. OAuth flow for QBO credentials stored in keytar (personal, not shared — QBO doesn't have a read-only API user concept the same way).

---

## 🏗 Platform Priorities

Do these in order. The Azure backend work unlocks everything below it.

---

### Sprint 1 — Foundation (do these together)

- [x] **Microsoft SSO / Entra ID** *(shipped v1.4.0)*
  MSAL PublicClientApplication with file-based token cache. Roles defined in Entra ID (`hub.admin`, `hub.standard`, `hub.readonly`). Admin consent granted tenant-wide. Profile photo pulled from Microsoft Graph.

- [x] **Modular file restructure** *(main process complete)*
  `main/ipc/` is fully split into 19 per-tool files. `main.js` is 165 lines. `app.js` (renderer) remains a single file — splitting it carries refactor risk with no user benefit. New tools added by contributors should each get their own renderer file going forward; the monolith shrinks naturally over time.

- [ ] **Intune / MDM deployment**
  Package as Win32 app and push via Intune. Solves Windows SmartScreen for all managed employee machines immediately — no cert required for internal distribution.

- [ ] **Datto RMM Quick Job — Install / Update Anchor Hub**
  PowerShell script that downloads the latest installer from the GitHub release and runs it silently. Can be targeted to specific sites or devices from the RMM console for on-demand installs without having to walk someone through it manually.
  - Download URL pulled from `latest.yml` on the GitHub release so it always gets the current version
  - Silent install: `Anchor-Hub-Setup-x.x.x.exe /S`
  - Works alongside auto-update — use this for first installs or forced re-installs; the app handles its own updates from there
  - Once repo is private, script will need a PAT with `Contents: read` to download the asset

- [ ] **Make GitHub repo private + extract sensitive config**
  The public repo currently contains ANS's Azure AD Tenant ID, Client ID, SharePoint hostname, and internal email addresses in plain text. Plan:
  1. Extract `MSAL_CLIENT_ID`, `MSAL_TENANT_ID`, `SP_HOST`, and `SUPPORT_TO` into a `config.js` file
  2. Add `config.js` to `.gitignore`
  3. Rewrite git history to remove the values from past commits (or accept the exposure is historical and just go private — past commits aren't searchable once private)
  4. Flip repo to private in GitHub settings
  5. Configure electron-updater with a read-only fine-grained PAT for update checks
  No end-user impact — config is baked into the installer at build time.

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

  **Autotask two-tier model (confirmed design):**
  - **Key Vault** → shared read-only AT API key. Every user gets it automatically with no setup. Scope: Companies, Contracts, ContractServices, ContractServiceUnits (read-only, nothing else).
  - **Local keytar** → personal write API key. User enters their own AT credentials once per machine. App checks keytar first; if present, uses it for all operations. If absent, uses the shared read-only key (writes fail cleanly — correct behavior for users without write access). Personal keys migrate to Azure SQL in Sprint 2 as an encrypted column tied to the user's Entra identity.
  - **Creating the shared AT user:** Mike creates a dedicated API-only user in Autotask with read-only access to the entities listed above. Credentials go into Key Vault as `AUTOTASK-USERNAME` and `AUTOTASK-SECRET`. Personal write users follow normal AT user provisioning — each employee's credentials stored locally.
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

- [ ] **Home screen card revamp**
  Cards currently treat every tool the same — last-run timestamp, color status, etc. That model doesn't fit management/utility tools like Duo Management where "last ran" is meaningless and there's no pass/fail result to color-code. The revamp introduces two card types:
  - **Report cards** (Subscription Audit, Invoice Monitor, Margin Analyzer, etc.): keep the run schedule + status badge model — green/yellow/red based on whether the report has been run on time.
  - **Management/utility cards** (Duo Management, Device Coverage, etc.): show contextual status instead — e.g., "X drift issues" from last audit, "N sub-accounts" managed — whatever is a meaningful at-a-glance health indicator for that tool. No run-schedule badge.
  Card metadata (type, status source) defined per-tool so new tools register correctly when built.

- [ ] **Tool run schedule & status badges** — Each report card gets a configurable run frequency (daily / weekly / monthly). Last-run timestamp stored in Azure DB. Badge turns green (on schedule), yellow (due soon), red (overdue).
- [ ] **Notifications center** — Bell icon with badge count. Pulls overdue tool alerts, admin announcements, and new release notes. Admins post announcements from a simple admin panel.
- [ ] **In-app idea submission** — Button that submits to the Azure backend → posts directly to a designated Teams channel via Graph (`ChannelMessage.Send`) so ideas are visible and trackable without leaving the hub.

---

### Sprint 4 — Access Control & Polish

- [ ] **Role-based tool access & permissions architecture**
  Gate tool visibility and write operations by Entra ID role. Manage access from the Azure portal without touching the app.

  **Access model (important for Key Vault design):** Key Vault is accessed by the Hub's own Entra service principal — not by individual users. This means every authenticated user gets the secrets the app needs (shared read-only API keys, hostnames, etc.) without requiring per-user KV permissions. Entra ID roles then control what the *app* allows each user to do with those secrets. The result: one place to manage user access (Entra app roles), one place to manage credentials (Key Vault), no overlap.

  **What roles gate:**
  - Tool visibility (already partially in place via sidebar config)
  - Write operations vs. read-only mode (e.g., a `hub.readonly` user can run reports but cannot trigger Quick Jobs or modify Duo)
  - Tab-level access within tools (already live for Duo Management: `hub.it`/`hub.admin` = all tabs; `hub.standard` = client-facing tabs only)
  - Personal write API key entry (e.g., only `hub.standard`+ can register a personal Autotask write key)

- [ ] **Job-title-based hub role assignment**
  Replace manual per-user role assignment with automatic mapping from Entra/Teams job titles. When someone signs in, their job title determines their hub role — no admin intervention required for normal hires.

  **Known job title → hub role mappings to define** (list is not exhaustive — finalize with Mike):
  | Job Title | Hub Role |
  |---|---|
  | Technical Account Manager | `hub.it` |
  | Account Manager | `hub.standard` |
  | Client Experience Manager | `hub.standard` |
  | Service Desk Engineer | `hub.standard` |
  | Workstation Deployment Engineer | `hub.standard` |
  | *(others TBD)* | |

  **Individual exceptions:** When one person on a team needs access their role doesn't normally grant, an admin assigns them an *additive* override role directly in Entra (e.g., `hub.it.exception`). The app merges their base role with the exception at sign-in. Exceptions are visible in the Entra app registration assignments so they're auditable and don't get lost.

  **Implementation path:** Entra supports both app roles and claims transformation rules. The cleanest approach is a short Azure Function that reads the user's job title from Graph and assigns the correct app role on first sign-in, with the exception mechanism handled by direct role assignment that the function does not overwrite.

- [ ] **Role × Tool access matrix** *(living document — update as new tools are built)*
  A canonical reference showing every tool and what each role can do with it. Rows = tools, columns = roles, cells = No Access / Read Only / Full Access. Reviewed when building new tools so access is designed in, not bolted on. Current draft to be filled in once job-title roles are finalized.

  | Tool | hub.admin | hub.it | hub.standard | hub.readonly |
  |---|---|---|---|---|
  | Subscription Audit | Full | Full | Read Only | Read Only |
  | Invoice Monitor | Full | Full | Read Only | Read Only |
  | Duo Management (admin tabs) | Full | Full | No Access | No Access |
  | Duo Management (client tabs) | Full | Full | Full | No Access |
  | Datto RMM Quick Jobs | Full | Full | Full | No Access |
  | *(expand as tools are built)* | | | | |
- [ ] **Audit trail** — Log every significant action (who ran what, what data was changed, when) to Azure DB.
- [ ] **Azure Trusted Signing** — ~$10/month via Azure. Gives the installer a Microsoft-backed signature and builds SmartScreen reputation over time. Covers distribution outside of Intune (shared links, new machines being set up, etc.).
- [ ] **Central API key revocation** — Admin UI to revoke or rotate any API key across all users from one place. (Depends on Key Vault)

---

---

## 🗺 Company Mapping — Redesign Plan

The current per-machine manual mapping has two problems: every user has to do it themselves, and names from Pax8/invoices often don't match Autotask names.

### The Right Architecture

Company mapping is not a config problem — it's a **data relationship**: every client exists in multiple portals with different IDs and names, and Autotask is the source of truth. The long-term home is a `clients` table in Azure SQL (Sprint 2) with one row per client and columns for each portal's ID/name.

### Near-Term: Auto-Match from Autotask

Since we already have Autotask API access, most mapping can be **auto-discovered at invoice processing time**:

1. For each company in the invoice, query Autotask `/Companies/query` with a fuzzy name search
2. If one match is found with high confidence → auto-assign silently
3. If multiple matches or low confidence → surface to the user for one-time confirmation
4. Cache confirmed pairs so subsequent runs don't re-query

This eliminates the manual mapping burden for 90%+ of clients. Edge cases are clients whose Pax8/invoice name is substantially different from their Autotask name (abbreviations, DBA names, etc.).

### Centralized Override Storage (Bridge Solution)

For the edge cases that don't auto-match, confirmed overrides need to live somewhere central so admins set them once and everyone gets them:

- **Bridge (now):** SharePoint file via Microsoft Graph — already authenticated from SSO. One JSON file in a known folder, readable by all users, writable by `hub.admin` role only. No new infrastructure required.
- **Long-term (Sprint 2):** Azure SQL `client_mappings` table, replaces the SharePoint file.

### What Happens to the Current Mapping Tool

The current UI becomes a **Company Directory** — a read-only view of all confirmed cross-platform mappings. Admins get an edit mode. Regular users see the mappings but can't change them. Suggested/unconfirmed matches appear with a confidence indicator and a one-click confirm button.

---

## 💡 Ideas & Backlog

Drop ideas here. Nothing too small or too big.

- [ ] New employee onboarding checklist tool
- [ ] In-app bug / feedback reporter

- [ ] **New Client Onboarding Wizard**
  A guided, multi-step form that walks an employee through provisioning a brand-new client across Autotask end-to-end — no portal-hopping, no copy-pasting, no risk of creating a duplicate. Everything happens inside the Hub.

  **The problem it solves:** Right now, onboarding a new client means opening Autotask, manually searching to make sure they don't already exist, creating the Company record from scratch, navigating to Contracts to build a T&M and a Managed Services contract, then creating the primary contact — all in separate screens. Easy to miss a field, easy to create a near-duplicate, and hard to train someone new on.

  **How it works:**

  1. **Duplicate check (before anything is created)**
     The employee types the company name. The wizard immediately queries Autotask `/Companies/query` with a fuzzy search and surfaces any similar-sounding matches with confidence scores. If a strong match exists, they're warned with a "Did you mean…?" prompt before proceeding. No duplicates get created by accident.

  2. **Company record creation**
     A clean form collects the fields Autotask needs: legal name, primary phone, billing address, website, SIC code / industry, assigned account manager, and any internal notes. Required vs. optional fields are clearly marked. On submit, the wizard calls Autotask to create the Company and captures the new company ID for the steps that follow.

  3. **Contract creation — T&M**
     Pre-fills sensible defaults (contract name derived from company name, start date = today) and lets the employee confirm or adjust billing rates and the contract effective period. Calls Autotask to create the Time & Materials contract linked to the new Company.

  4. **Contract creation — Managed Services (S&P)**
     Same flow for the recurring Managed Services contract. Contract type, service tier, recurring amount, and billing cycle are configurable. Creates the contract in Autotask, linked to the same Company.

  5. **Primary contact creation**
     Collects first name, last name, title, email, and phone for the client's main point of contact. Creates the Contact record in Autotask and associates it with the new Company. Optionally flags them as the billing contact.

  6. **Discovery Call ticket (optional)**
     A toggle on the summary step: "This client needs a discovery call." When enabled, the wizard creates a T&M ticket in Autotask under the new Company — pre-titled "Discovery Call — [Company Name]", assigned to the employee who ran the wizard, with a configurable charge line for the call fee. The ticket is created with a "New" status so it flows into the normal service board immediately. The charge amount and billing code default to a configurable preset (so it's consistent across reps) but can be adjusted before confirming.

  7. **Summary & confirmation**
     A final review screen shows everything that was created — Company record link, both contract links, the new contact, and the discovery call ticket if one was created — with direct "Open in Autotask →" deep links for each. One-click copy of the AT Company ID for pasting into other systems.

  **Nice-to-haves (future iterations):**
  - Cross-check against Pax8 to catch if the client already exists there before creating a second billing record
  - "Also create in Pax8" toggle — provisions the customer account in Pax8 in the same flow
  - Send a welcome email to the new primary contact via Microsoft Graph (`Mail.Send`) once provisioning is complete
  - Pre-populated contract templates (e.g., "Standard SMB", "Enterprise") so the employee picks a tier and all the contract fields fill in automatically

  **Dependencies:** Autotask write API key (personal keytar key — same model already in place). Optional Pax8 API for cross-check. `Mail.Send` Graph scope for welcome email (Sprint 2.5).

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

- [ ] **Employee Scorecard Tool**
  Replaces the manual monthly Excel scorecard (7 employee tabs) that was previously updated by hand and emailed individually. No longer being maintained — this tool automates the entire pipeline.

  **How it works:**
  - Pulls metrics automatically from **Autotask** (hours, tickets, project surveys, timesheets) and **Strety** (client touches, KPIs)
  - For metrics that can't be auto-pulled (continuing education, some client touches), prompts the employee or manager to enter them via the app
  - Updates each employee's **individual Strety scorecard** (not just team-level scorecards)
  - Sends each person their scorecard via **email or Teams message** on a configurable schedule
  - Role-based: employees see only their own data; managers see their direct reports

  **Employees & key metrics tracked:**
  | Role | Key Metrics |
  |---|---|
  | Director (Brian French) | TSMs (≥5), hours, revenue, cabling/hardware profit, cont. ed |
  | Client Experience (Susan Castle) | Unique touch points (75/mo), proactive visits (40/yr), trainings (4/yr) |
  | TAM (Cody Mead) | Project survey avg (≥4.5), site reviews (8-10/mo), tickets, onboard projects |
  | Pro Services Mgr (Andi Gingrich) | Team survey avg, project on-time %, revenue billed |
  | WSD (Michael Nolan) | CSAT (≥98%), tickets, hours |
  | Service Desk Mgr (Patrick Kiah) | CSAT, tickets, hours, certifications |
  | Cybersecurity (Andy Harper) | Project survey avg, site reviews, tickets, onboard projects |

  **Color thresholds:** Red = below goal, Orange = approaching, Green = on target (defined per metric)

  **Dependencies:** Strety API, Autotask API (both available), Graph `Mail.Send` (Sprint 2.5 for email delivery), SharePoint as client-touches fallback source.

---

## 🤝 Contributors

| Person | Area |
|--------|------|
| Mike | Core platform, Autotask/Pax8 tools |
| Brian | Flask tool ports (CIPP, UAR, etc.) |

**Branch rules:** All changes via PR into `main`. One approval required. Never push directly to main. Never bump `package.json` version without coordinating a release.
