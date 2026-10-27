# WO-122 through WO-158 — ledger back-fill (CR Aug 30)

**This is not new product work.** It assigns work-order numbers to conversational fixes that shipped Aug 22–30 with a build number and no WO.

**Asked by:** Cindy (via Cowork diagnosis). Symptom: 39 deploy-queue rows since Aug 22, zero WO numbers; ledger ended at WO-121 (Aug 22). Next new work is **WO-159**.

**Rule that made this necessary:** `loop-work-orders.mdc` only fires in queue mode. Conversational fixes appended `_DEPLOY_QUEUE.md` and skipped the ledger. Closed by `.cursor/rules/wo-number-every-change.mdc`.

## Count

| What | N |
|------|--:|
| Dated queue lines Aug 22–30 | 40 |
| Exact duplicate (`rename-room-apostrophe` twice) | −1 |
| Staging + production pair collapsed to one WO | −2 (`prop-line-show-filter`, `portal-prop-line-show-filter`) |
| **Unique changes → WO-122…158** | **37** |
| Included after the original “39 rows / 9.9.261–300” note | Aug 22 builds 9.9.256–258; functions-only `qb-bill-link` + `pepper-she-her`; **9.9.301** (queued 12:26, staging ~12:28) |

No per-change `WO-###_DONE_*.md` was written at ship. This file is the mapping. Do not invent DONE files for work this session did not perform.

**State:** all **DONE-UNVERIFIED**. Never VERIFIED. Queue STATUS left as it was (two 9.9.272/273 lines still `pending`; Pepper she/her prod still needs Cindy GO).

## Mapping (oldest = WO-122)

| WO | Build | Queue slug | Title |
|----|-------|------------|-------|
| 122 | 9.9.256 | st-wtd-when | Smart Time Week-to-Date Summaries dates + digest |
| 123 | 9.9.257 | prop-line-show-filter | Proposal Client/Manage Show Approved / Pending / All |
| 124 | 9.9.258 | portal-prop-line-show-filter | Portal proposal Show Approved / Pending / All |
| 125 | 9.9.261 | prop-vendor-bid-generic | Import vendor bid PDF (generic parser) |
| 126 | 9.9.263 | smart-time-ytd-null-date | Smart Time null-date crash + YTD default |
| 127 | 9.9.264 | po-room-ship-eta | PO main page Room + Ship/ETA columns restored |
| 128 | 9.9.265 | po-receiver-from-shipto | PO Receiver = Ship To name |
| 129 | 9.9.266 | qb-po-then-bill | QB Send PO then vendor Bill LinkedTxn |
| 130 | functions | qb-bill-link-txnlineid | QB Bill→PO link TxnLineId + AccountBased |
| 131 | 9.9.267 | po-nav-open-count | Sidebar PO badge = open count |
| 132 | 9.9.268 | po-proj-nav-open-count | Project panel PO badge = this job’s open count |
| 133 | 9.9.270 | po-received-date | Vendor bill Received date next to ETA |
| 134 | 9.9.271 | po-list-recv-eta | Project PO list Received checkbox + ETA |
| 135 | 9.9.272 | prop-add-to-bundle | Add to bundle: room default + crash fix |
| 136 | 9.9.273 | rename-room-apostrophe | Room Board Rename apostrophe + empty rooms |
| 137 | 9.9.275 | pdf-room-tag-cols | Proposal/invoice Preview Room + Tag columns |
| 138 | 9.9.276 | pdf-show-room-tag-desc | Show room / Show tags toggles (prop/inv) |
| 139 | 9.9.278 | print-page-margins | Print: drop 850px lock; page 2 inset (hit POs) |
| 140 | 9.9.279 | bundle-line-drag | Drag a line inside a bundle |
| 141 | 9.9.280 | bundle-move-after-dest | Drag bundle header after dest bundle |
| 142 | 9.9.281 | bundle-restack-orphans | Restack orphan lines under existing bundle |
| 143 | 9.9.282 | invoice-due-now-square | Invoice Due now $/% Square slice |
| 144 | 9.9.284 | freight-not-taxed-… | Freight never taxed; hide vendor in ITEM |
| 145 | 9.9.285 | sent-invoice-one-billed-total | Sent invoice list Total = billed Firestore total |
| 146 | 9.9.286 | due-now-balance-after | Due now “Balance after this payment” copy |
| 147 | 9.9.287 | partial-invoice-approved-lines | Convert to Invoice copies approved lines only |
| 148 | 9.9.289 | invoice-room-table-align | Invoice room groups: fixed colgroup align |
| 149 | 9.9.293 | prop-keep-open-pending | Invoice does not close proposal with Pending lines |
| 150 | 9.9.294 | decision-post-zindex | Post Decision duplicate-confirm z-index |
| 151 | functions | pepper-she-her | Pepper identity lock she/her (prod GO open) |
| 152 | 9.9.295 | invoices-open-badge | Invoices nav badge portal + Studio Money |
| 153 | 9.9.296 | files-share-post-decision | Files & Docs + Share Document + Post Decision |
| 154 | 9.9.297 | share-pick-existing-file | Share Document pick existing Files file |
| 155 | 9.9.298 | invoice-total-includes-tax | Sent invoice Total includes tax line |
| 156 | 9.9.299 | invoice-tax-in-total-lock | Send persists merch+tax Total before Square/email |
| 157 | 9.9.300 | po-print-ship-tag-thumbs | PO Print Ship To / TAG once / thumbs / margins |
| 158 | 9.9.301 | po-print-cols-room-tag-sidemark | PO Print Room + Tag + Sidemark columns |

## Print-surface note (why Cindy saw “Room still under ITEM”)

**9.9.300 = WO-157** did not add PO Room/Tag columns. It fixed Ship To, doubled TAG, thumbs, margins.

**9.9.275 / 9.9.276 = WO-137 / WO-138** added Room/Tag columns and Show room / Show tags, gated to proposals and invoices. POs were excluded on purpose at ship — not a revert.

**9.9.301 = WO-158** is the PO-column pass. Local `CCH_BUILD` is `9.9.301`. Print path `cch-proposals-invoices-fix.js:3367` and `:5287` call `cchPoLineSpecsBlockHtml(..., { omitRoom: true })`. Gate `_showRoomTagCols` at `:5030` includes `type === 'po'`. Queue: staging hosting ~12:28. Hard refresh; sidebar must read **v9.9.301**, not 9.9.300.

## Files this pass

- `loop/LOOP_LEDGER.md` — rows 122–158 prepended
- `_DEPLOY_QUEUE.md` — `WO-###` stamped after the date on the matching Aug 22–30 lines
- this file

No platform JS/HTML edited. No commit. No deploy queue append (nothing new to ship).

## Next free number

**WO-159.**
