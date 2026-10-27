# Session log — Cursor — 2026-08-21

**Agent:** Cursor (Grok)  
**Repo:** `C:\dev\CCH-Platform-Deploy\cch-deploy`  
**Branch:** wip/preserve-rh-inspiration-board-2026-04-19 (shared Machine-1 working copy)

## Overview

Cindy tested the iPad portal locally (“pretty good”), asked for staging, then typed **GO for production**. Production **9.9.240** then **9.9.241** (narrow iPad left rail) after a second GO.

## What shipped

### Production hosting (2026-08-21 ~08:23, Cindy GO)

`firebase deploy --only hosting:platform --project cch-design-boards`

- **9.9.240** Client portal iPad Home — room tiles only; products on room tap; lazy images; time entries on Progress only
- **9.9.239** Approve/Decline in-place paint
- **9.9.238** Add-item library first page
- Also rode along (already on staging, not previously on prod after 9.9.234): Spec Book **9.9.236/237**, category remap + Pepper fact **9.9.235** hosting files

**Not deployed this pass:** `functions:cchPepper` (staging only ~14:08 yesterday). Hosting JS/category files for 235 did go live.

### Staging hosting (2026-08-21 ~08:11)

Same 9.9.238–240 batch to `cch-studio-staging`.

### Production hosting (2026-08-21 ~08:43, Cindy GO) — **9.9.241**

`firebase deploy --only hosting:platform --project cch-design-boards`

- Left nav 220px → **148px** under 1180px (iPad). Nav no longer wraps into a full-width 2-column block until phone (640px).
- Home Action Required cards stack (inline 3-col lock removed).
- Desktop wider than 1180px unchanged.

### iPad Home layout (Studio **9.9.241**) — production live ~08:43

- Left nav 220px → **148px** under 1180px (iPad). Nav no longer wraps into a full-width 2-column block until phone (640px).
- Home Action Required: removed inline 3-column lock; cards stack on tablet.
- Files: `platform/index.html`, `platform/client.html` (`renderClientPortal` CSS).

### Production functions (2026-08-21 ~08:50, Cindy GO) — Square pay links

`createSquarePaymentLink`, `checkSquarePayment`, `squarePaymentWebhook` were missing on `cch-design-boards` (staging had them). Deployed all three.

- `Functions/squarePaymentLink.js`: production Square API when project is `cch-design-boards`; `moneyCents` so `$` totals still count as a balance.
- Webhook URL: `https://us-central1-cch-design-boards.cloudfunctions.net/squarePaymentWebhook` (register in Square Dashboard for auto-Paid; pay-link create works without it).

**Not committed.** If Create Square pay link still fails, the prod `SQUARE_ACCESS_TOKEN` may still be the sandbox token from the Aug 16 mirror.

### WO-026 rewrite (no code)

Rewrote `loop/WO-026_line-icons-window-leak_CW_Jul11.md` to **v1.1** from Cindy’s Labor / Design Services / Expenses screenshots. Still OPEN. Unique icon per preset; window-treatment glyph only on real WT. Grounded `presetRow` :43254 and `cchLineIconKind` :58–77.

### CLIP-3 SKU/finish (Studio **9.9.243** + Clipper **3.9.57**) — queued staging

Wipe path was Clipper `clipperFindExistingClipId` matching title+vendor+room and patching over the other finish (`sidebar.js` ~2395). Selections `selDupKeyForItem` (`index.html:18363`) also keyed lib/url before SKU.

- SKU first in `selDupKeyForItem`; different SKU = different row.
- Clipper: different SKU or finish creates a new clip; same SKU still updates.
- Confirm modal (“update vs new finish”) not in this pass — new clip is the default when SKU/finish differs.

Reload Clipper at `chrome://extensions` → **3.9.57**. Staging hosting pending in `_DEPLOY_QUEUE.md`.

### WO-026 line icons (Studio **9.9.244**) — queued staging

Window-treatment glyph was the default for every expense/fee/retainer and for image-less products; picker used 2-letter tags in tan boxes.

- `cchLineIconKind` (`platform/cch-line-icons.js`) returns `wtLabor`/`wtExpense` only for real WT lines.
- Unique SVG per Labor / Design Service / Expense / Tax / Retainer preset. Same map on **+ Add item** (`presetRow` `:43257`) and document IMG.
- Cache `cch-line-icons.js?v=20260821wo026`. `node --check` clean. 32 kind probes OK.
- Ledger DONE-UNVERIFIED. Claude verifies on staging.

### Pepper briefs + training WOs (no code, ~12:44)

Cindy’s two-item plan (daily/weekly/monthly briefs + training). Facts block is **already shipped** — do not re-insert. v1.0 facts WO remains a superseded stub (prod-deploy-by-Cursor was illegal).

- `loop/PLAN_pepper-briefs-training_CR_Aug21.md`
- `loop/WO-119_pepper-brief-training_CR_Aug21.md` — DONE-UNVERIFIED (code in tree; staging queued)
- `loop/WO-120_pepper-daily-weekly-monthly-briefs_CR_Aug21.md` — OPEN — weekly/monthly product; morning = WO-105; evening timeline = WO-111
- Ledger rows 119 / 120 added

**Not deployed. Not queued.** Cursor must staging-first; Cindy runs `DEPLOY-PRODUCTION-DANGER.bat` for prod.

### Room Board prices + missing tiles (Studio **9.9.245**, queued staging ~13:50)

Cindy: Hall L2 clips missing; Hall Echo **$42.37** ≠ proposal.

- Place/create stored `clientPrice = unit ÷ qty` (`cchEnsureClipsFromDocLines` was 13525). Echo $42.37 × 13 = one proposal unit.
- Room board only shows clips whose `clip.room` matches that room. Ghost proposal cards are off (`renderBoardsTab` ~23941). Hall vs Hall L2 are different rooms. Hall L2 leather tiles are Houzz (MY-PRO-2011) with no Studio sell.
- Fix: `cchDocLineUnitSell` (unit, not total÷qty) on create; cards read linked proposal unit in-memory (`cchClipBoardUnitSell`). No clip money writes. Isolation intact.

### PR pill + Design Board blanks (Studio **9.9.246**, queued staging)

Cindy: PR on the image should open the proposal; Suite 3 design board has white tiles (Walker / Solstice / Clove) and $780 on Hudson Valley.

- `clipLinkedDocPillsHtml` (`index.html` ~23547) painted `PR PRO-3020` as a dead span; the `<a>` used the Firestore id. Now one pill: label = PRO-#, href = proposalId.
- Design board tiles had no PR control (`cch-design-board.js` `dbBuildElementHtml`). Added `db-el-pr-chip` from linked clip; click navigates. Client view hidden.
- Blank tiles: dead `imageUrl`; onerror now retries clip preferred URL. Caption stays once (not drawn inside the empty frame).
- Show Pricing reads `_linkedDocUnitSell` when the clip is on a proposal.

### Clipper URL missing on Room Board edit (Studio **9.9.247**, queued staging ~15:05)

Cindy: Piatto 63" Linear Pendant (Signature Collection) — clipped, Product website empty.

- Modal input used only `vendorUrl || productUrl || clippedFromUrl || pageUrl` (`showNewProductModal` ~65382). Clipper often stores `sourceUrl` / `url`.
- `showClipDetail` mapped only `pageUrl`/`productUrl`/`vendorUrl` onto the prefill (~81355).
- Fix: `cchLineProductSourceUrl` (already existed at ~15366) now feeds the modal, clip open, Selections edit, add-to-room copy, and save writes the shown URL onto pageUrl/productUrl/sourceUrl.
- **Not on production.** If a clip has no URL in any alias, the field stays empty (Clipper never captured that page).

### Room Board gold = line subtotal (Studio **9.9.248**, queued staging ~15:20)

Cindy: gold on cards is unit client sell, not qty×unit; clipped prices were right then went wrong.

- Card used `cchClipBoardUnitSell` (`_renderRbBoardClipCard` ~23799). Room totals already did unit×qty.
- `cchPushDocLinePricesToLinkedClips` (`index.html` ~13230) is allowed through isolation (Aug 20) and overwrites clip `clientPrice` with the proposal **unit**. Two create paths still did `amount/qty`.
- Display now `cchClipBoardLineSell` (linked proposal `amount`, else unit×qty). Create/push use `cchDocLineUnitSell`. **No Firestore rewrite** of Kitchen clips.

### Production hosting (2026-08-21 ~16:48, Cindy GO) — **9.9.250**

Room Board gold = unit; Accounting cents rounding; PR pills; line icons; CLIP-3 Studio. Client portal phone work was **not** in this batch.

### WO-121 client portal phone (Studio **9.9.251**) — staging ~17:10

Handoff was titled WO-112; ledger **121** because 112 is Smart Time.

1. **ID leak:** `clipLinkedDocPillsHtml` no-op on `client.html`; portal cards no longer emit Lib/PR/INV chips. Studio Room Boards keep pills. `cvShowProduct` no longer shows “Linked: PR …”.
2. **Portrait table:** `.cp-prem-items-table` stacks as cards under 900px (130px thumb in a 42% column was wrapping one character per line).
3. **Decline:** Approve and Decline were the same await-then-paint path. Both now paint first, write, rollback on failure. Room-board status no longer awaits full portal re-render.
4. **Prices:** read-only FINDING — Hall Echo/Vela/Antasia `clientPrice` is unit÷13 on the clip. Portal reads `clientPrice` correctly. **No writes.** Report: `Docs/FINDING_REPORT_roomboard-card-price_CR_Aug21.md`.

**Not on production.** Phone verify on staging, then Cindy GO.

## Not done

- No git commit / push (shared working copy)
- WO-117 `--apply` still on hold
- Pepper Cloud Function still staging-only
- Square webhook not confirmed in Square production Dashboard
- WO-119 executed (DONE-UNVERIFIED). WO-120 not started.
- Dropbox handoff copy of the new WOs was blocked this session (files live in `loop/` only)

### Staging hosting (2026-08-21 ~15:45)

`firebase deploy --only hosting:platform --project staging` → https://cch-platform-staging.web.app

Shipped **9.9.248** (bundles 243–247): Room Board gold = linked line total; PR pill opens the proposal; Design Board 404 fallback + PR chip; WO-026 icons; CLIP-3 SKU key; product URL aliases.

### Room Board gold = unit (Studio **9.9.249**) — queued staging

Cards show each, not qty×unit. Accounting tab overlays linked proposal/invoice unit cost/sell. Isolation: no clip money rewrite.

### WO-119 Pepper brief cadence (Studio **9.9.252**) — staging live ~19:04

Training only: BRIEF CADENCE in `Functions/cchPepper.js` after facts; Daily/Weekly/Monthly presets in `platform/cch-pepper.js`. Facts block untouched (Square/Zelle pay). Staging hosting + `functions:cchPepper`. No production deploy.

### Smart Time Summaries tab (Studio **9.9.253**) — queued staging

New **Summaries** tab on Smart Time: Daily / Weekly / Monthly hours from Time Ledger, person-scoped. Not Pepper, not portal Updates. `renderSmartTimeSummaryView` in `index.html`.

### Week-to-Date digest spec (no code)

Cindy confirmed the live Summaries tab is **not** `CCH_Week_to_Date_EXAMPLE.html`. Spec written: `Docs/SPEC_WEEK_TO_DATE_DIGEST_CR_Aug21_v1.0.md`. v1 sections include design boards, client decisions, portal visits.

### Smart Time Summaries = Week to Date (Studio **9.9.255**) — queued staging

Step 1 only: `renderSmartTimeSummaryView` / `_stFillSummaryActivityList` now match the example layout (hours by project, Timely recon without invented stories, money, builder, open POs, inspiration, design boards, client activity/decisions/portal, tasks, highlights). Weekly range = Monday through today (`getWeekStart`). Portal Updates not touched. Facts stored on `window._stWtdLastDigest` for a later bi-weekly pass.

**Staging hosting 2026-08-21 ~20:55** (`firebase deploy --only hosting:platform --project staging`). Production not deployed.

## Verify

Staging after #1 deploy: https://cch-platform-staging.web.app — Ctrl+Shift+R — sidebar **v9.9.255** — Smart Time → Summaries → Weekly. Expect navy **Week to Date** (not a giant activity count). Empty sections say empty. Production unchanged until GO.

WO-026 (after #1 staging deploy): https://cch-platform-staging.web.app — Ctrl+Shift+R — sidebar **v9.9.244** — Proposal Edit → + Add item → Labor / Design / Expenses.

1. iPad Safari: close the tab, reopen https://cch-platform.web.app (or Tracey’s portal link)
2. Home left rail should be narrower; Decisions / Documents / Invoices stacked, not three skinny columns
3. Studio sidebar after Ctrl+Shift+R: **v9.9.241**, no orange STAGING banner
4. Invoice 800-10022 → **Create Square pay link** — expect a link, not the empty Square modal
