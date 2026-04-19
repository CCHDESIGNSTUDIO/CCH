# Staging / testing site (Firebase Hosting)

Staging serves the **same** files as production (`platform/` folder) from a **separate URL** so you can validate UI before users see it on `cch-platform.web.app`.

**Important:** Staging uses the **same Firebase project** (`cch-design-boards`) as production. That means **the same Firestore, Auth users, and Cloud Functions**. You are testing the **hosted UI**, not an isolated copy of your data. For true data isolation you would need a separate Firebase project (much more setup).

---

## One-time setup (Firebase Console + CLI)

### 1. Create a second Hosting site

1. Open [Firebase Console](https://console.firebase.google.com/) → project **cch-design-boards**.
2. Go to **Build → Hosting**.
3. Click **Add another site** (or **Add site**).
4. Site ID: **`cch-platform-staging`** (must match `.firebaserc`).
5. Finish the wizard. You should get URLs like:
   - `https://cch-platform-staging.web.app`
   - `https://cch-platform-staging.firebaseapp.com`

### 2. Allow sign-in from the staging domain

1. In Firebase Console: **Build → Authentication → Settings** tab.
2. Under **Authorized domains**, click **Add domain**.
3. Add:
   - `cch-platform-staging.web.app`
   - `cch-platform-staging.firebaseapp.com`  
   (If Google already listed them, you are done.)

Without this step, **Google/email login may fail** on the staging URL.

### 3. Confirm Hosting targets (usually already set)

From the `cch-deploy` folder, with the same account that owns the project:

```bash
cd C:\Users\cindy\Dropbox\CCH-Platform-Deploy\cch-deploy
firebase target:apply hosting platform-staging cch-platform-staging
```

If the repo’s `.firebaserc` already maps `platform-staging` → `cch-platform-staging`, this command may only confirm the mapping.

---

## Day-to-day use

| Action | How |
|--------|-----|
| Deploy **only staging** | Double-click **`DEPLOY-STAGING.bat`** or run: `firebase deploy --only hosting:platform-staging` |
| Deploy **only production** | Double-click **`DEPLOY.bat`** or run: `firebase deploy --only hosting:platform` |

After each deploy: open the URL, then **Ctrl+Shift+R** (hard refresh).

**Avoid** running `firebase deploy --only hosting` with no target name: that deploys **every** Hosting target in `firebase.json` at once (production and staging).

---

## Troubleshooting

| Error | What to do |
|--------|------------|
| Site not found / target error | Complete step 1; ensure site ID is exactly `cch-platform-staging`. |
| Login works on prod but not staging | Complete step 2 (authorized domains). |
| Staging shows old UI | Hard refresh; confirm deploy succeeded for `hosting:platform-staging`. |
