# Session Log — Cursor: stars to prod + PO In production + doc-edit drag

**File:** SESSION_LOG_Cursor_2026-09-01.md  
**Original Author:** Cursor (CR)  
**Created:** September 1, 2026  
**Last Modified:** September 1, 2026  
**Last Modified By:** Cursor (CR)  
**Version:** 1.3

**Workspace:** `CCH-Platform-Deploy`  
**Primary paths:** `platform/index.html`, `platform/client.html`, `platform/cch-po-bill-variance.js`  
**Firebase:** Inspiration stars **PRODUCTION 2026-09-01 ~11:06** (9.9.307, Cindy GO). WO-165 / WO-046 / **WO-166 not hosted** — queued staging. No git commit.

## Session overview

Stars on Studio Inspiration tiles (WO-164) after portal stars (WO-163). Cindy GOed staging then production. Then asked for **In production** on Mark as confirmed per-line STATUS. Then: restore **drag reorder on document Edit** (WO-166) — arrows were the only method.

## What changed

### WO-163 / WO-164 — 9.9.307 on production

Portal + Studio Inspiration stars. Live HTML on cch-platform.web.app is 9.9.307. Staging banner is gated (`CCH_ENV === 'staging'`); the string exists in the file but does not show on prod.

### WO-165 — 9.9.308 queued staging

`CCH_PO_LINE_SHIP_STATUSES` in `cch-po-bill-variance.js:795` now includes **In production**. Not treated as shipped.

### WO-046 Phase 1 — 9.9.309 queued staging

Request Pricing (RFQ). Not hosted.

### WO-166 — 9.9.310 queued staging

Doc Edit line table: ⋮⋮ drag handle + drop (`docEditRowDropOn` in `index.html`). ▲▼ removed from the cell; ⋯ still has Move up/down. Print untouched.

## Open items

- **Staging deploy** WO-165 / 046 / **166** — STATUS pending. One hosting pass will ship current `CCH_BUILD` **9.9.310**.
- Request for Pricing remainder (Selections/Library, quote-back) still **WO-046** after Phase 1.
