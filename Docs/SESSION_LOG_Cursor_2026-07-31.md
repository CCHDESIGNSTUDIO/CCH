# Session Log — Cursor: Add-item picker ghost filter

**File:** SESSION_LOG_Cursor_2026-07-31.md  
**Original Author:** Cursor  
**Created:** July 31, 2026  
**Last Modified:** July 31, 2026  
**Last Modified By:** Cursor  
**Version:** 1.0  

**Workspace:** `C:\dev\CCH-Platform-Deploy\cch-deploy`  
**Primary paths:** `platform/index.html`  
**Staging:** https://cch-platform-staging.web.app  
**Production:** not deployed (no GO)

## Session overview

Shipped temporary Add-item **Project selections** ghost filter (v9.9.61) after sell-only price display (v9.9.60). Claude heals board prices separately; filter is picker-only tidy.

## What changed

| Build | Change | Deploy |
|-------|--------|--------|
| v9.9.60 | Picker cards: sell/clientPrice only (no cost fallback) | staging ~08:35 |
| v9.9.61 | `_disFilterGhostPickerClips` after selection load: hide junk sell (&lt;$1) twins when healthy twin is **same room**, or junk has **no room**; identity via library id / title+vendor (thickness variants stay distinct) | staging ~09:40 |
| v9.9.62 | `_disCollapsePickerClipsByProduct`: one Project Selections card per product; multi-room → blank room on card; matches “click again for another room” | staging ~10:10 · **prod ~11:47** |
| v9.9.63 | Room Boards By Room: never seed/show FFE category shells (Fabrics/Furnishings); expand `_cchKnownFfeCategoryLower` | staging ~14:20 |
| v9.9.64 | Room Boards: restore collapse ▸/▾, sort ▲/▼, ⋮ menus (literal `?` was encoding corruption) | staging ~14:35 · **prod ~14:33** |
| v9.9.65 | PO view: restore Applied payments **Edit** (showPaymentTotals was invoice-only since Jul 2) | staging ~15:20 |
| v9.9.66 | PO list: restore page scroll (`.content` min-height:0); remove corrupt `?` merge header | staging ~15:25 |
| v9.9.67 | Edit vendor bill: do not rehydrate `source:po` lines as extra charges (double merchandise) | staging ~15:30 · **prod ~15:29** |
| v9.9.68 | Edit vendor bill: strip **saved** Extra/fee ghosts that duplicate PO merch (PO-9029 Telal); also when `bill.poLines` empty / billed id drift | **prod ~15:52** (bill4) |

**Not touched (v9.9.63):** Firestore roomMeta delete (UI hide only); clip data; Master Library.

## PO-9029 Edit bill panic (afternoon)

- **Saved bill is correct:** Bill total **$1,355.03** on the PO page (behind the modal). Paid / closed — nothing “went back” on the real bill.
- **What happened:** An earlier Edit-bill bug treated PO merchandise as Extra/fee and **saved those ghost rows** on the bill. Prod v9.9.67 stopped *new* rehydration from `source:po`, but ghosts already in `vendorInvoices` still load into Edit bill → preview **$2,315.63** (merch counted twice).
- **Do not Save** from that bad modal — Cancel. Sidebar **$1,355.03** is the truth.
- Fix (local, queued): always resolve merch via `cchPoBillMerchandiseLines`, strip matching Extra/fee on open + preview + save.

## Open / human

- Cindy verified v9.9.62 picker on staging (~11:22); typed **go to production** → prod hosting ~11:47.
- Claude heal: 22 tiles with clean twin (Cindy “go”); then 45 with Master Library prices for sign-off.
- After heal, filter should hide almost nothing.

## Verify

1. https://cch-platform-staging.web.app — Ctrl+Shift+R  
2. Sidebar build tag **v9.9.61**  
3. Proposal/invoice → Add item → Project selections: junk same-room twins hidden; other-room corrupt placements still listed; 1¼″ thickness still its own row  
4. Room boards unchanged  
