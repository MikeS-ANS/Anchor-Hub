# Anchor Hub

Internal MSP tooling for Anchor Network Solutions. A Windows desktop app built with Electron that integrates with Pax8, Autotask, Kaseya, and Blackpoint Cyber to streamline billing, subscription auditing, and project management.

---

## Tools

| Tool | Description |
|---|---|
| **M365 Subscription Comparison** | Compares Pax8 active subscriptions against Autotask contracts. Flags quantity mismatches and can auto-create tickets. |
| **Invoice Monitor** | Monitors Pax8 invoices and surfaces billing anomalies. |
| **Margin Analyzer** | Analyzes product margins across Pax8 subscriptions. |
| **Company Mapping** | Maps Pax8 companies to their Autotask counterparts. |
| **Pax8 Invoice Processor** | Processes and formats Pax8 invoices for review. |
| **Kaseya Invoice Processor** | Parses Kaseya billing exports and reconciles against contract values. |
| **Project Time Summary** | Pulls active Professional Services projects from Autotask, shows hours vs. estimates, flags at-risk projects, and emails a formatted HTML report. |
| **Project Profitability** | Analyzes profitability for Professional Services contracts — hours, invoiced, pending, margin, and effective rate per project. |
| **MSC Agreements** | Manages Microsoft Cloud Agreement (MCA) tracking and status across clients. |
| **Contract Changes** | Tracks and surfaces contract modifications in Autotask. |
| **Contract Renewals** | Lists upcoming contract renewals with configurable look-ahead window. |
| **Blackpoint Processor** | Processes Blackpoint Cyber billing data. |

---

## Requirements

- **Windows 10/11**
- **Node.js v18+** (development only) — https://nodejs.org
- API credentials for the services you use (stored in Windows Credential Manager)

---

## Installation (end users)

Download the latest `Anchor-Hub-Setup-x.x.x.exe` from [Releases](https://github.com/MikeS-ANS/Anchor-Hub/releases) and run the installer. No Node.js required.

The app checks for updates automatically on launch and prompts you to install when a new version is available.

---

## Development setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run normally
npm start
```

---

## Building a release

```bash
# Build installer only (no upload)
npm run build

# Build and publish to GitHub Releases
npm run publish
```

`npm run publish` produces a Windows NSIS installer and `latest.yml`, uploads both to the GitHub Release for the current version in `package.json`, and enables the auto-updater for all installed instances.

> Note: close Anchor Hub before running `npm run publish` — the build cannot overwrite native binaries while the app is running.

---

## Credential storage

All API credentials are stored in **Windows Credential Manager** under the service name `AnchorHub`. Manage them from:

- **Settings → General** inside the app
- Windows → Control Panel → Credential Manager → Windows Credentials

---

## Sidebar customization

Tool visibility and layout are configured per-user in **Settings → Customize**. Tools default to hidden on a fresh install. Drag to reorder, create named groups (e.g. "Accounting", "Projects"), and toggle visibility per tool. Settings are saved locally and not synced.

---

Built for Anchor Network Solutions — internal use only.
