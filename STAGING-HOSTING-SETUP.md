# Staging / testing site (Firebase Hosting)

Staging serves the **same** `platform/` files as production from a **separate Firebase project** and URL. Use it to validate UI and rules **before** users see changes on production.

| | **Staging** | **Production** |
|---|-------------|----------------|
| Firebase project | `cch-studio-staging` | `cch-design-boards` |
| Hosting site | `cch-platform-staging` | `cch-platform` |
| URL | https://cch-platform-staging.web.app | https://cch-platform.web.app |
| Firestore / Auth / Functions | **Separate** copy of the stack | Live firm data |

**Important:** Staging is **not** a second Hosting site on the production project. Data, Auth users, Cloud Functions secrets, and Firestore rules deploys are **per project**. Testing on staging does not touch production Firestore unless you run a script against prod explicitly.

See also: `STOP-READ-FIRST.md` (staging-first deploy policy, production gate).

---

## One-time setup (if a new machine or project)

### 1. Firebase CLI login and project aliases

From `cch-deploy`:

```bash
cd C:\Users\cindy\Dropbox\CCH-Platform-Deploy\cch-deploy
firebase login
```

`.firebaserc` maps:

- `staging` → `cch-studio-staging` (also the **default** project)
- `production` / `prod` → `cch-design-boards`

Hosting target `platform` on staging resolves to site **`cch-platform-staging`** under `cch-studio-staging`.

### 2. Authorized domains (staging sign-in)

In [Firebase Console](https://console.firebase.google.com/) → project **cch-studio-staging** → **Build → Authentication → Settings → Authorized domains**, ensure:

- `cch-platform-staging.web.app`
- `cch-platform-staging.firebaseapp.com`

Repeat for **cch-design-boards** if you test auth on `cch-platform.web.app` from a new domain.

### 3. Cloud Functions / secrets (staging)

QB-related functions (`pushBillToQB`, `pushPOToQB`, `qbWebhook`, etc.) need the same class of secrets on **cch-studio-staging** as production if you test bill push on staging. Copy or recreate secrets in the staging project console; a functions deploy to staging will fail without them.

---

## Day-to-day deploy

| Action | Command |
|--------|---------|
| **Staging hosting only** | Double-click `DEPLOY-STAGING.bat` or: `firebase deploy --only hosting:platform --project staging` |
| **Staging Firestore rules** | `firebase deploy --only firestore:rules --project staging` |
| **Production hosting** | `DEPLOY-PRODUCTION-DANGER.bat` only (see `STOP-READ-FIRST.md`) |
| **Production Firestore rules** | `firebase deploy --only firestore:rules --project cch-design-boards` |

After each hosting deploy: open the URL, then **Ctrl+Shift+R** (hard refresh). Confirm the orange **STAGING** banner on `cch-platform-staging.web.app`.

**Avoid** bare `firebase deploy --only hosting` without `--project` unless you intend the default project (`cch-studio-staging`). Never use production hosting deploy without the production danger script and sign-off.

`DEPLOY-STAGING.bat` deploys **hosting only**, not rules or functions.

---

## Firestore rules (Phase 1 — `/products` write guard)

As of May 28, 2026, `firestore.rules` requires `isAuth()` for create/update on `/products` (was `if true`). Deploy rules to **both** projects when the rules file changes:

```bash
firebase deploy --only firestore:rules --project staging
firebase deploy --only firestore:rules --project cch-design-boards
```

`productLibrary` write remains `isAuth()` (not admin-only). `vendors` `create: if true` is unchanged for Clipper.

---

## Legacy note (deprecated model)

Older docs described staging as a **second Hosting site on `cch-design-boards`** sharing production Firestore. That model is **obsolete**. Current truth is `.firebaserc` + `DEPLOY-STAGING.bat` → project **`cch-studio-staging`**.

---

## Troubleshooting

| Symptom | What to do |
|---------|------------|
| Staging shows old UI | Hard refresh; confirm deploy targeted `cch-studio-staging` and URL is `cch-platform-staging.web.app`. |
| Login works on prod but not staging | Add staging authorized domains (step 2) on **cch-studio-staging**. |
| Rules change not visible on staging | Rules are not deployed by `DEPLOY-STAGING.bat` — run `firestore:rules` deploy to staging. |
| Functions fail on staging | Check secrets and `firebase deploy --only functions:… --project staging`. |
| “Tested on staging” but data looks wrong | Staging Firestore is a separate dataset; import/migrate scripts must target the intended `--project`. |
