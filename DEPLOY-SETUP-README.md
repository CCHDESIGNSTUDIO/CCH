# CCH Studio — Firebase Deploy Setup & Instructions

## Location
This folder: `C:\Users\cindy\Dropbox\CCH-Platform-Deploy\cch-deploy`

## What Gets Deployed
- `platform/index.html` → https://cch-platform.web.app
- Firebase Project: `cch-design-boards`
- Hosting Target: `cch-platform`

---

## ONE-TIME SETUP (per computer)

### Step 1: Install Node.js
- Download from https://nodejs.org (LTS version)
- Run installer, accept defaults
- Restart your terminal after install
- Verify: open Command Prompt and type `node --version`

### Step 2: Install Firebase CLI
Open Command Prompt or PowerShell and run:
```
npm install -g firebase-tools
```

### Step 3: Login to Firebase
```
firebase login
```
This opens a browser window. Sign in with the Google account that owns the `cch-design-boards` project.

### Step 4: Verify
From the `cch-deploy` folder, run:
```
firebase projects:list
```
You should see `cch-design-boards` in the list.

---

## HOW TO DEPLOY

### Production (`cch-platform.web.app`)

### Option A: Double-click DEPLOY.bat
Navigate to this folder in Windows Explorer and double-click `DEPLOY.bat`.

### Option B: Command line
```
cd C:\Users\cindy\Dropbox\CCH-Platform-Deploy\cch-deploy
firebase deploy --only hosting:platform
```

**Do not** run `firebase deploy --only hosting` with no site name unless you intend to deploy **every** Hosting target (production **and** staging) at the same time.

### After production deploy
1. Open https://cch-platform.web.app
2. Hard refresh: Ctrl+Shift+R
3. Click the version tag at the bottom of the sidebar to verify the build number

---

## Staging / testing URL (optional)

A second Hosting site deploys the same `platform/` folder to **`https://cch-platform-staging.web.app`** so you can smoke-test before production.

- **One-time setup:** see **`STAGING-HOSTING-SETUP.md`** (create the Hosting site in Firebase Console and add Auth authorized domains).
- **Deploy staging only:** double-click **`DEPLOY-STAGING.bat`** or run `firebase deploy --only hosting:platform-staging`.

---

## FOR CCW1 (Claude 1)

### File to edit
`platform/index.html` — this is the ENTIRE application (single-file architecture)

### Current version
Check for `const CCH_BUILD = { version: '...', ...}` near line ~1275

### Deploy flow
1. Edit `platform/index.html`
2. Dropbox syncs the file across computers
3. Run `firebase deploy --only hosting:platform` from cch-deploy folder (or use staging first: `hosting:platform-staging` — see `STAGING-HOSTING-SETUP.md`)
4. Verify at https://cch-platform.web.app

### Firebase config
- `firebase.json` — hosting config (public dir = `platform`)
- `.firebaserc` — project mapping (`cch-design-boards` → `cch-platform`)
- `firestore.rules` — Firestore security rules
- `Functions/` — Cloud Functions (Node.js 20)

### Key Firestore collections
- `boards/{projectId}` — projects
- `boards/{projectId}/invoices` — invoices
- `boards/{projectId}/proposals` — proposals
- `boards/{projectId}/purchaseOrders` — POs
- `boards/{projectId}/clips` — clipper items
- `desktopTimeLogs/{date-emailSlug}` — Smart Time agent data
- `timeBuckets/{id}` — Smart Time bucket assignments
- `settings/docCounters` — auto-numbering counters (PRO/INV/PO)

### Critical: Do NOT delete
- `settings/docCounters` — resets all document numbering
- Any `desktopTimeLogs` docs — loses time tracking history
