# Session log — Cursor — 2026-08-22

**Agent:** Cursor (Grok)  
**Repo:** `C:\dev\CCH-Platform-Deploy\cch-deploy`

## Overview

Cindy: Week-to-Date Summaries looks good but needs dates and times on the entries. Then: proposal line Show filter (Approved / Pending / All) so declined lines can be hidden; see it on staging. Then: same filter on the client portal. Then: proposal **Import lines** from another proposal (Lutron vs Somfy).

## What changed

### Studio **9.9.256** — queued staging

`platform/index.html` `_stFillSummaryActivityList` / `_stWtdWhen`:

- Hours: Date / Time / Project / Hours table under the bars (`startTime`–`endTime` when present)
- When column on money, builder, POs, inspiration, design boards, decisions, tasks
- Client activity and portal visits: `Tue, Aug 18 · 2:15 PM` (date-only stays date-only)

Portal Updates not touched. Production not deployed.

### Production hosting (2026-08-22 ~07:55, Cindy GO)

`firebase deploy --only hosting:platform --project cch-design-boards`

Studio **9.9.256** Week-to-Date Summaries (digest + When/date-time columns). Live: https://cch-platform.web.app

### Studio **9.9.257** — proposal line Show filter (staging)

`platform/index.html` `getProposalLineShowFilter` / `proposalLinePassesShowFilter` / `setProposalLineShowFilterUI` / `buildProposalLineShowFilterHtml` (~5917–5966) + `renderProposalDetail` table queue (~34029–34094):

- Client View + Manage checkboxes: Show Approved, Pending, All
- Default: Approved + Pending on, All off → declined hidden
- All on → declined show
- Edit mode unchanged (every line)
- `client.html` not touched
- Totals still exclude declined (`proposalLineTotalsFromItems`)

Display-only. No Firestore writes.

**Staging hosting 2026-08-22 ~08:05:** `firebase deploy --only hosting:platform --project staging` → https://cch-platform-staging.web.app

**Production hosting 2026-08-22 ~08:32, Cindy GO:** `firebase deploy --only hosting:platform --project cch-design-boards` → https://cch-platform.web.app

### Studio **9.9.258** — portal proposal Show filter

`platform/client.html` + `platform/index.html` `cpBuildSingleProposalReviewHtml`:

- Same Show Approved / Pending / All checkboxes on the client portal proposal
- Default hides declined; All brings them back
- Decline paints then hides the row when All is off
- Counts, final-approve gate, footer money unchanged
- Display-only

**Staging hosting 2026-08-22 ~08:45:** `firebase deploy --only hosting:platform --project staging` → https://cch-platform-staging.web.app

**Production hosting 2026-08-22 ~09:10, Cindy GO:** `firebase deploy --only hosting:platform --project cch-design-boards` → https://cch-platform.web.app

### Studio **9.9.259** — Import lines from another proposal (staging)

`platform/index.html` `openProposalImportLinesModal` (~10719–10950) + `cchProposalMoreMenuWrap` in `cch-proposals-invoices-fix.js` (~854, ~870):

- Options → **Import lines** (next to Duplicate)
- Pick another proposal in the same project; check lines (groups as a block, all on by default)
- Appends clones: new ids, remapped `groupId`, approval reset to pending, invoiced markers stripped
- Source proposal not written; target `workOrderId` not copied
- Blocked when `proposalDesignerLineEditLocked`
- Total via `proposalStoredTotalFromItems`; `logDocActivity`

**Staging hosting 2026-08-22 ~13:40:** `firebase deploy --only hosting:platform --project staging`

### Clipper **3.9.58** — simplehuman / Shopify empty-div hide (not Firebase)

`cch-clipper/CCH-Studio-Clipper-v32` `createSidebarDOM` (~779–788) + host guard CSS:

- Symptom: toolbar icon on simplehuman.com product pages did nothing visible
- Cause: Theme Engine 2 `base.css` `div:empty { display: none }` — shadow-only host matches `:empty`, panel 0×0
- Fix: light-DOM guard `<span>` + `display:block!important`
- Reload via `chrome://extensions` → CCH Studio Clipper → Reload. Not a hosting deploy.

## Verify

Staging: https://cch-platform-staging.web.app — Ctrl+Shift+R — orange STAGING — sidebar **v9.9.259**. Open a draft proposal → Options → Import lines → pick another proposal → Import selected. Source line count unchanged. Production still **v9.9.258**.
