# Cursor handoff — make staging a real mirror of production

**Date:** May 13, 2026
**Author:** Claude (Cowork), at Cindy's direction
**Target agent:** Cursor (or whichever next agent picks this up)
**Priority:** High — staging is currently a half-built mirror, which is part of why staging-first hasn't been working.

---

## Why this exists

Production keeps getting deployed without staging tests. Today (May 13) alone, 12 production deploys vs 3 staging deploys, including a rollback that stripped 120 prod functions. The Apr 20 client portal outage shipped the same way. Cindy has now hard-locked the deploy scripts (see `STOP-READ-FIRST.md`), but the staging environment itself still needs to actually mirror production for "test on staging first" to be meaningful.

What "mirror" means here:

- The staging Firebase project (`cch-studio-staging`) has the same shape of Firestore data as production.
- Real client PII has been scrubbed out — staging is safe to share, screenshot, or leave open in front of a client iPad.
- Re-runnable, so staging can be re-aligned with production whenever it drifts.

---

## What's already in place

You don't need to set any of this up. It exists.

| Asset | Where | Purpose |
|---|---|---|
| Prod Firebase project | `cch-design-boards` | Live system. Don't touch. |
| Staging Firebase project | `cch-studio-staging` | Where we're putting the mirror. |
| Prod admin SDK key | `_debug/service-account.json/cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json` | Lets scripts read prod. |
| Staging admin SDK key | `_debug/service-account.json/cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json` | Lets scripts write staging. |
| `.gitignore` coverage | `cch-deploy/.gitignore` lines 17-21 | Both keys are ignored — verify before any commit. |
| `DEPLOY-STAGING.bat` | `cch-deploy/` | Fixed today. Uses `firebase deploy --only hosting:platform --project staging`. |
| `DEPLOY-PRODUCTION-DANGER.bat` | `cch-deploy/` | Gated. Requires typed confirmation + Cindy's initials. |
| Policy doc | `cch-deploy/STOP-READ-FIRST.md` | The rule everyone has to read. |

---

## What you're going to do

Execute these in order. Each step ends with something Cindy can verify visually.

### Step 1 — Verify the staging key

Run, from the `cch-deploy` folder:

```bash
node -e "console.log(require('./_debug/service-account.json/cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json').project_id)"
```

Expected output: `cch-studio-staging`

If it prints anything else, **stop**. Tell Cindy. Do not proceed.

### Step 2 — Dry-run the snapshot

```bash
cd C:\Users\cindy\Dropbox\CCH-Platform-Deploy\cch-deploy
node _scripts/snapshot-prod-to-staging.js
```

This reads prod and tells you what it WOULD write. No staging mutations yet. Read the summary at the bottom carefully:

- `collections scanned` should be > 5 (boards, clients, vendors, members, productLibrary at minimum)
- `docs read from prod` should be in the hundreds-to-thousands range
- `errors` should be 0

A manifest file gets written to `_debug/snapshot-prod-to-staging-<timestamp>.json`. Save its path for Cindy to review.

### Step 3 — Apply the snapshot

Once Cindy approves the dry-run summary:

```bash
node _scripts/snapshot-prod-to-staging.js --apply
```

This will take longer (writes are serialized to be safe). When it finishes:

- Confirm `docs written to staging` matches the dry-run's "docs that would be written" count.
- Confirm `errors` is still 0 (or close — a handful of permission edge cases are tolerable; report them).

### Step 4 — Dry-run the scrub

```bash
node _scripts/scrub-staging.js
```

Reads staging, reports which docs would have PII replaced. Verify:

- `clients` count matches the number of real clients on prod.
- `boards` count matches the number of boards with `clientName` set.

### Step 5 — Apply the scrub

```bash
node _scripts/scrub-staging.js --apply
```

After this completes, the staging Firestore should have:

- Every client name replaced with "Test Client A", "Test Client B", etc.
- Every client email replaced with `staging-client-<n>@cchdesign-test.com`.
- Every client phone replaced with `555-0100`.
- Every board's `clientName` field replaced with `[Scrubbed: <board-id>]`.

### Step 6 — Visual verification

Open `https://cch-platform-staging.web.app` in a fresh incognito window. Cindy will log in with her staff account.

Check, in this order:

1. Orange "STAGING ENVIRONMENT" banner is visible at the top of every page.
2. The board list shows the expected number of boards.
3. Pick three boards and confirm: client name reads `Test Client X` or `[Scrubbed: <id>]`. **Not a real name.**
4. Open the client portal route for a known board (`/#/clientview/7225-bugletrail` or similar). The client-side view should render without errors.
5. Open browser console. Zero SyntaxErrors, zero red errors.

### Step 7 — Report back

In a new file `Docs/STAGING_MIRROR_RESULTS_<date>.md`, log:

- Dry-run summary (counts)
- Apply summary (counts)
- Scrub summary (counts)
- Any errors encountered, with the failing doc path
- Confirmation that the visual verification in step 6 passed

---

## What NOT to do

These are non-negotiable. Violating any of them is the kind of mistake that turns into the next Apr 20.

1. **Do not deploy to production.** This entire handoff lives inside staging. Production is out of scope. If a change ends up needing to go to prod, that's a separate conversation Cindy approves directly.
2. **Do not run `firebase deploy` with no `--project` flag** unless you've verified `firebase use` shows `staging` (cch-studio-staging). The default in `.firebaserc` is now staging, so a bare deploy is technically safe — but it's a bad habit. Always be explicit.
3. **Do not commit the `_debug/service-account.json/` folder or any `*-firebase-adminsdk-*.json` file.** The `.gitignore` already covers this. Verify with `git status` before any commit.
4. **Do not modify the scrub script to skip clients** even if scrubbing seems annoying for testing. Unscrubbed staging = privacy risk = legal risk. If a test specifically needs a known real name, hardcode that one name in a separate seed script, don't relax the scrub.
5. **Do not edit `STOP-READ-FIRST.md` or `DEPLOY-PRODUCTION-DANGER.bat`** to weaken the gates. If they're genuinely getting in the way, raise it with Cindy. Don't unilaterally relax safety.
6. **Do not assume the data shape from skill files or memory.** Read prod with a small script first if you need to verify a field exists. (This is the Code Grounding Protocol — see `Docs/CODE_GROUNDING_PROTOCOL_MH_May13_v1.0.md`.)
7. **Do not push current → staging blindly** if staging has features git doesn't. Staging is the source of truth when that's the case. Pull FROM staging INTO git first. (See `feedback_staging_first_deploy.md` in the project memory.)

---

## Known gaps (not your job in this pass, but document them)

- **Firebase Auth users are not copied.** A `test-client@cchdesign-test.com` user with a known password should be seeded into staging Auth, but the existing scripts don't do that yet. Flag in your results doc.
- **Firebase Storage objects are not copied.** Image URLs stored in Firestore still point at production storage. Staging will render correctly but the underlying images are served from prod. Building a parallel Storage sync is a separate task.
- **The Web SDK config in `platform/index.html` has identical `appId` and `messagingSenderId` between staging and production** (`1:210388013080:web:fcd520b30c0d50b149736d`). These should be different per project. Get the correct staging values from Firebase Console > Project Settings > General > Your apps and fix the staging block.
- **`STAGING-HOSTING-SETUP.md` is stale.** It still claims "staging uses the same Firebase project as production." That hasn't been true since the architecture moved to separate projects. Rewrite it once you've confirmed the new flow works end-to-end.
- **No scheduled re-snapshot.** Staging will drift from prod every time prod writes new data. A weekly cron (or a "Snapshot now" button) would keep them aligned. Future work.

---

## Success criteria

You're done when ALL of these are true:

- [ ] `snapshot-prod-to-staging.js --apply` ran with 0 errors.
- [ ] `scrub-staging.js --apply` ran with 0 errors.
- [ ] `https://cch-platform-staging.web.app` shows real-shaped data with all PII scrubbed.
- [ ] Orange STAGING banner is visible.
- [ ] Client portal route renders without console errors.
- [ ] `Docs/STAGING_MIRROR_RESULTS_<date>.md` is written and committed (without keys).
- [ ] No production deploys happened during this work.

---

## If you get stuck

- Bring the question back to Cindy with the exact error message and the exact command you ran.
- Do not try to "fix it forward" by editing production. The whole point of this handoff is that the fix path goes through staging only.
- If a script crashes mid-run, re-running it is safe (writes are idempotent / merged), but tell Cindy first so she can decide whether to investigate the crash.

---

*Authored by Claude. Reviewed and authorized by Cynthia Holloway. Lockdown is non-negotiable.*
