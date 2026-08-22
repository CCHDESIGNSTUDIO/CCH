# WO-062 DONE — Cursor · Jul 26, 2026

**State:** DONE-UNVERIFIED (staging)  
**Build:** `cch-pepper.js?v=20260726a` + `functions:cchPepper`

## Grounding (this turn)

| Symbol | file:line |
|--------|-----------|
| Fix-It onCall pattern | `Functions/cchFixItBot.js` — allowlist, Anthropic fetch, `sanitizeCchVoice` |
| Activity fetch engine | `platform/cch-client-activity.js` ~96–122 `caFetchProjectActivity` |
| AI export block | `Functions/index.js` ~3845–3849 |
| Script load anchor | `platform/index.html` ~82235 `cch-client-activity.js` |
| Fix-It callable region | `platform/cch-bugs-requests.js` — `firebase.app().functions('us-central1')` |

## Grounding fixes (within new files only)

1. **`caFetchProjectActivity` not on `window`** — WO assumed export; `cch-pepper.js` uses `window.caFetchProjectActivity` when present, else `pepperFetchProjectActivity` (same query/filter as client-activity). Did **not** modify `cch-client-activity.js` per WO constraint.
2. **No `[data-project-name]` in DOM** — project label falls back to `.page-title` on project pages.
3. **Activity digest detail** — append `d.description` (what portal writes) after summary/title/docType.
4. **Callable region** — `us-central1` to match Fix-It / invoice AI.

## What changed

| File | Change |
|------|--------|
| `Functions/cchPepper.js` | **NEW** — staff-only onCall, Claude Sonnet 4.6, preset frames, voice sanitize |
| `platform/cch-pepper.js` | **NEW** — floating Pepper button + panel, dual guards (route + email) |
| `Functions/index.js` | +1 line: `exports.cchPepper` |
| `platform/index.html` | +1 script tag after client-activity |

**Untouched:** `cchFixItBot.js`, `cchVoiceProfile.js`, `aiInvoiceSummary.js`, `aiProgressUpdate.js`, `cch-client-activity.js`

## Self-test

- `node --check Functions/cchPepper.js` — OK
- `node --check platform/cch-pepper.js` — OK

## Deploy (#1)

**Staging — two steps:**

```powershell
cd C:\dev\CCH-Platform-Deploy\cch-deploy
firebase deploy --only functions:cchPepper --project staging
firebase deploy --only hosting:platform --project staging
```

**Production:** hosting + `functions:cchPepper` only on Cindy typed **GO**.

## Verify (Claude / Cindy on staging)

1. Orange **STAGING** banner, Ctrl+Shift+R
2. Sign in as Cindy or Vanessa → open any `#/project/{id}` → **Pepper** button bottom-right
3. `#/clientview/{slug}` → **no** Pepper button
4. **Summarize status** → reply references real project activity (not generic)
5. Free-form question → no em dashes / agency-speak (voice sanitize)
6. Console clean; Fix-It, invoice AI, client portal unchanged
