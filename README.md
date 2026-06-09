# Pax8 Hub

A Windows desktop app for MSPs to run Pax8 integrations with a clean GUI. Built with Electron.

## What it does (v1.0)

- **Subscription Audit** — Pulls active subscriptions from Pax8 and compares quantities against Autotask contracts. Flags mismatches and optionally creates Autotask tickets automatically.
- **Settings** — View and remove saved credentials from Windows Credential Manager.

## Future integrations (planned)

- Invoice Sync
- License Renewal Alerts
- Company Mapping Validator

---

## Prerequisites

- **Node.js** v18+ — https://nodejs.org
- **Windows 10/11** (keytar requires Windows Credential Manager)
- **Pax8 API credentials** (Client ID + Client Secret) from the Pax8 platform
- **Autotask API credentials** (Username + API Secret) from your Autotask account

---

## Setup & Run (development)

```bash
# 1. Install dependencies
npm install

# 2. Start the app
npm start
```

> Note: `keytar` requires native compilation. If you hit build errors, run:
> ```bash
> npm install --build-from-source keytar
> ```

---

## Build (Windows installer)

```bash
npm run build
```

This produces a Windows NSIS installer in the `dist/` folder. Share the `.exe` with your team — no Node.js required on their machines.

---

## Credential storage

All credentials are stored in **Windows Credential Manager** under the service name `Pax8Hub`. You can view or remove them via:

- **Settings view** inside the app
- Windows → Control Panel → Credential Manager → Windows Credentials → `Pax8Hub`

---

## Adding a new integration

1. Create a function `renderMyIntegration(container)` in `public/app.js`
2. Register it in the `views` object: `'my-integration': renderMyIntegration`
3. Add a nav item to `public/index.html` with `data-view="my-integration"`
4. Add any required IPC handlers to `src/main.js`

---

## Autotask zone

Your Autotask zone number corresponds to which data center your account is on. Check your Autotask login URL:
- `https://webservices1.autotask.net` → Zone 1
- `https://webservices2.autotask.net` → Zone 2
- etc.

---

## Built for

Anchor Network Solutions — internal tooling
