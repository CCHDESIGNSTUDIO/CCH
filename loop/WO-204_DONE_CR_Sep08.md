# WO-204 DONE · RH Neolith Basalt finish + dimensions on locked POs · CR Sep 08

**Ledger:** WO-204. **State:** DONE-UNVERIFIED.

Cindy Sep 8: updated Product Library finish/dimensions for Neolith Basalt; PO Edit shows **LOCKED ON THIS PROPOSAL** so she cannot Apply from Library. Needs finish + dimensions on PO Print. Two POs, multiple lines. Production URL PO `WGLHOWcZgbgYG7oz2fmL` (Firestore id `WGLHOwcZgbgYG7oz2fmL`).

## Grounding (this turn)

- PO Print Finish / Dimensions come from the **line snapshot**, not live library: `cchPoLineSpecsBlockHtml` `platform/index.html:9654–9671` (`item.finish`, `item.dimensions`).
- Line Edit Save writes those same fields: `saveDocLineItem` `platform/index.html:37228–37236` (`#piFinish` → `finish`, `#piDimensions` → `dimensions`).
- Library save stores finish/dims on **`productLibrary/`**: `_libraryCatalogFirestorePayload` `platform/index.html:67994–67996`. The `products/` mirror at `:68296–68321` does **not** copy finish or dimensions (confirmed: `products/basalt_black__neolith__stone___tile` finish/dims empty).
- `libraryProductIdLocked` disables Apply from Library: `platform/index.html:36600–36618`. Label always says “proposal” unless collection is invoices (`:36603`) — so a PO shows “locked on this proposal.”
- Isolation: library edits do not push onto existing financial lines (`cchFillLineItemFromClipMetadata` is fill-empty-only at `:16013–16036`, and only in the modal).

## Production inventory

Library `productLibrary/basalt_black__neolith__stone___tile` (title **Basalt Black**): finish **Satin**, dimensions **126"x63" x 1/2"**.

Six PO lines titled Basalt Black / tag CT-08, all had empty `finish` and `dimensions`:

| PO | id | Lines | Rooms |
|----|----|-------|-------|
| PO-9053 | `WGLHOwcZgbgYG7oz2fmL` | 0–3 | Laundry, Mudroom, Guest 4, Consessions |
| PO-9045 | `ZWaY43tvlDfsqPmrtyy3` | 3–4 | Laundry, Mudroom |

PO-9045 `poLocked: true`. PO-9053 unlocked at send flag, but line 0 has `libraryProductIdLocked: true`.

Did **not** touch Reclaimed German Basalt Cobblestone. Did **not** change cost, qty, images, title, vendor, or tax.

## What ran

```
node _scripts/wo204-rh-neolith-basalt-po-finish-dims_BY_CURSOR_2026-09-08.js --apply
```

Backup: `_backup/wo204-neolith-basalt-2026-09-08-20-11-01/`

Re-read: all 6 lines `finish=Satin`, `dimensions=126"x63" x 1/2"`. WILL_WRITE 0.

## Verify

Hard refresh:

- https://cch-platform.web.app/#/project/cloud-rolling-hills/po/WGLHOwcZgbgYG7oz2fmL — Print: Finish Satin, Dimensions 126"x63" x 1/2" on all four Basalt Black lines.
- https://cch-platform.web.app/#/project/cloud-rolling-hills/po/ZWaY43tvlDfsqPmrtyy3 — same on Laundry + Mudroom.

## Follow-up (same WO)

Cindy: finish must read **Black - Satin**, not Satin.

```
node _scripts/wo204-rh-neolith-basalt-po-finish-dims_BY_CURSOR_2026-09-08.js --apply --finish "Black - Satin"
```

Backup: `_backup/wo204-neolith-basalt-2026-09-08-20-14-21/`  
All 6 PO lines + `productLibrary/basalt_black__neolith__stone___tile` now **Black - Satin**. Dims unchanged.

## Guardrails

Production Firestore write, Cindy-requested. Snapshot fields only. No hosting deploy. No commit.
