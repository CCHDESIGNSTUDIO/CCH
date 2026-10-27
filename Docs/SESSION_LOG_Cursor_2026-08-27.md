# Session log — Cursor — 2026-08-27

**Agent:** Cursor (Grok)  
**Repo:** `C:\dev\CCH-Platform-Deploy\cch-deploy`

## Overview

Cindy on Greene-Hixson **PRO-3044** (Lutron / Bartolo). Room change on the duplicated Hallway door worked, but **Add to bundle** did not put **1D Blackout** under **DOUG OFFICE**. Vanessa still owns description-shift / rounding — not touched.

## What changed

### Add to bundle — Studio **9.9.272** — queued staging (not deployed, not committed)

**Grounding:** `proposalLineAddToNewBundle` `index.html:10555`; `proposalChooseBundleTarget` `:10480`; `proposalInsertLineIntoExistingBundle` `:10452`; `editProposalGroup` `:10608`; grouped view `cchGroupDocumentItems` `cch-proposals-invoices-fix.js:1489` skips `lineKind: 'group'`.

**Why it looked broken**

- Manage default is **grouped by room**. Bartolo bundle headers are hidden. Sections are room strings.
- Import room = **Doug Office** (Bartolo `***` via `_vbRoomFromSection`). Project room she picked = **Doug's Office**. Those are two groups.
- Add to bundle defaulted to **+ New bundle** and focused the name field. Creating a new bundle then opened `editProposalGroup`, which referenced undeclared `collection` / `docId` / `boardName` → editor crash.

**Fix (index.html only)**

- Picker lists existing bundles first; prefers a header whose title matches the line room, treating `Doug's Office` like `Doug Office`.
- Moving into a bundle copies that header’s `room` onto the line so grouped view sits with the other Doug Office shades.
- Removed the dead `collection === 'proposals'` lines in `editProposalGroup`.

### Room Board Rename — Studio **9.9.273** — queued staging (not deployed)

**Grounding:** table ⋮ menu `index.html:24731` used `escAttr(rm)` inside a single-quoted `onclick`. `escAttr` (`:3769`) turns `'` into `&#39;`, HTML decodes it back to `'`, and the JS string for **Doug's Office** dies. Hide-chip already used `escJsStr` (`:3771`). `renameRoom` (`:26994`) only wrote clips; empty rooms (0 products) live on `rooms` / `projectRoomList` / `roomMeta`.

**Fix:** `escJsStr` on tile + table room menus. `renameRoom` now updates clips, board room lists, roomMeta, and matching proposal/invoice/PO line `room` fields.

Did not change Bartolo pending/description parser or rounding.

### Preview Show room/tags + descriptions — Studio **9.9.276** — production GO

**Grounding:** Preview toolbar `cch-proposals-invoices-fix.js:5461` only showed date/hours/rate/notes on time invoices (`cchPremInvDispToggle` `:5769`). Room/Tag PDF cols `pc-room` 12% / `pc-tag` 8% / `pc-item` 34% (`:5572`). Manage/Client descriptions truncated at 100 chars `index.html:34632`.

**Fix**

- Preview toolbar: **Show room** / **Show tags** (default on, remembered). Hides columns without colspan breakage on bundle header rows (`_premiumGroupRowHtml` `:4942`).
- PDF: Item 42%, Room 8%, Tag 5%. Print `@page` 0.5in.
- Client View + Manage: full description (12px `#5C6B80`, pre-wrap); ROOM 76px, TAG 40px; ITEM wider.

Cache `cch-proposals-invoices-fix.js?v=20260827pdfcols2`. Did not touch Bartolo parser/rounding.


### Bundle orphan restack — Studio **9.9.281** — production (same GO as PRO-3044 quote)

**Grounding:** `proposalInsertLineIntoExistingBundle` `index.html:10479` returned `'already'` when `line.groupId === targetGid`. Items **3** (Installation / 3 automated) and **4** (D3 Motorized) still had the Motorized `groupId` but sat after Manual in document order (`numLabel` 3/4 when `item.groupId !== openGroupGid` `:34701`). Drop on Motorized header / Add to bundle no-op’d. Line-drop onto W6/W7 did not restack orphans under the header.

**Fix:** restack even when the id already matches; drop on a Motorized *line* that is not consecutive under that header also restacks. In-bundle reorder unchanged.

Did not change Bartolo pending/description parser or rounding.

### Due now Square slices — Studio **9.9.282** — queued, not deployed

Ron does not want wire/Zelle; he wants to break up **card** payments. Square Payment Links are a fixed amount (API cannot let the buyer type $). Invoice **Due now** $ or % of remaining; Create/Refresh Square pay link charges that slice + 3% gross-up, capped at $50,000 gross.

**Grounding:** `cchInvoiceDueNowNet` `cch-square-pay.js:23`; rail `cchInvoiceDueNowRailHtml` `:35` wired in `cch-proposals-invoices-fix.js:3633` and `:4399`; function `invoiceDueNowNetCents` `Functions/squarePaymentLink.js:59`; $50k guard `:148`; apply patch credits **net** Due now not Square gross `:255`.

**INV-6065:** ~$74k remaining. 50% ≈ $37k (under cap). After he pays, open the invoice so Square posts Partially Paid, then Remainder or another % → Refresh Square pay link.

Needs **functions + hosting**. Staging Square is sandbox. Live Ron pay = production GO.

Did not change Bartolo parser/rounding. Did not hide Zelle on the Pay page.

## Open items

- **9.9.285** sent-invoice billed total — queued **staging** (not deployed). List TOTAL = billed document `total` for Sent invoices (INV-6064 / INV-6065). Do not resend.
- **9.9.284** freight/tax + hide vendor — queued **staging** (not deployed). Cindy is **not resending INV-6063**. After staging: INV-6063 Client View strips `(Hubbardton Forge)` from ITEM. New variance lines: vendor in Vendor field only; freight never taxed; price increase taxed.
- **9.9.282** Due now — queued staging; INV-6065 needs Cindy production GO (hosting + createSquarePaymentLink, checkSquarePayment, squarePaymentWebhook).
- Vanessa: shifted descriptions + roundup on Edit Line Item (do not touch).

### Walker Zanger slabs → RH Inspiration **Slabs** — production Firestore (no deploy)

Jeanette email 12 unique S3 photos (Calacatta Gold Extreme URL listed twice). Clipper cannot clip Comet/S3. Wrote to `boards/cloud-rolling-hills/ideabooks/5zLV53Y6IBMkPGDgKHaM` (name **Slabs**, was 55). Copied into Firebase Storage; captions Costa Mesa (5) / North Hills (4) / Calacatta Gold Extreme (1) / Calacatta Vintage (2). Vendor empty. Source link on. Board now **67**. Script `_scripts/add-wz-slabs-to-rh-inspiration_BY_CURSOR_2026-08-27.js`.

Did not touch Stone & Tile. Did not use Clipper.
### Sent invoice one billed total — Studio **9.9.285** — queued staging (not deployed, not committed)

Cindy: INV-6064 / INV-6065 already sent. Studio list TOTAL was recomputing from lines while the billed document `total` stayed put.

**Grounding:** `invoiceListRowTotal` `index.html:30765` used line math whenever items existed. `invoiceTotalsBreakdown` `:30721` kept stored `total` only if Paid. `docEditSave` `:41504` wrote a recomputed `total` even on Sent.

**Fix:** `invoiceIsClientBilled` (`:30662`). Sent/paid/published invoices use stored billed `total` on the list, document rail, and save. Drafts still compute from lines.

Did not resend. Did not change Firestore invoice data.

### INV-6063 vendor + tax — Studio **9.9.284** — queued staging (not deployed, not committed)

Cindy: not resending to Ron. Correct going forward. **Remove vendor from line text.**

**Grounding:** variance create `cch-po-bill-variance.js:7089` title is `PO {num} — {reason}` + `item.vendor` (no paren). Client display `cchStripInvoiceVendorParens` `cch-proposals-invoices-fix.js:4696` + `invoiceLineDisplayTitle` `:4733`. QB used to append `item.vendor` in Description `Functions/index.js` (removed this pass). Freight never taxed; price increase taxed (`cch-invoice-tax-rules.js`).

**INV-6063:** display-time strip only (Firestore titles unchanged; no re-push; no resend). After deploy, Client View / Manage / Preview show `PO PO-9030 — Freight / shipping` without `(Hubbardton Forge)`.

**Going forward:** new variance invoices do not put vendor in title/description. Vendor column hidden from client unless rail **Show vendor to client**. QB Description no longer adds `(vendor)`.

Cache `?v=20260827freight2`. Did not rewrite INV-6063 in Firestore. Did not touch Bartolo parser/rounding.

## Verify after production **9.9.276**

1. https://cch-platform.web.app — Ctrl+Shift+R — sidebar **v9.9.276** (no orange banner)
2. Greene-Hixson PRO-3044 → Preview — **Show room** and **Show tags** checkboxes next to Print / PDF
3. Uncheck Show tags → Tag column hides; descriptions get the space
4. Client View + Manage — full descriptions (not 100-char cut); Tag column tight (W1)

## Verify after staging

1. https://cch-platform-staging.web.app — Ctrl+Shift+R — sidebar **v9.9.272**
2. Greene-Hixson PRO-3044 **Manage**
3. 1D Blackout ⋮ → **Add to bundle...** → **DOUG OFFICE** should already be selected → **Add**
4. Line should appear under the same Doug Office block as the other shades (one header, not Doug vs Doug's)
