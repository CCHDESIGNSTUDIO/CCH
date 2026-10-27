# WO-161 DONE — PO Print: no document tags; landscape thumbs; preview matches print

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-08-30  
**Build:** Studio **9.9.304** `?v=20260830poprint5`

## Symptom (Cindy)

PO-9045 Print: **Document Tags** (Slabs CT…) on the vendor PDF — that field is internal / list-only. On-screen Print window looks unlike Chrome print (toolbar sitting on the navy header). Slab photos look **vertical** (they are landscape).

## Surfaces

| Surface | This WO |
|---------|---------|
| PO Print / PDF popup | **Yes** |
| PO lists (Document tags column) | No — stays |
| Invoice / proposal print | No |

## Grounding

- Document Tags injected at `cch-proposals-invoices-fix.js:5587` (removed). Hint at `:3551` already says they show on **PO lists**, not the vendor PDF.
- Toolbar `position:fixed` + 44px spacer (`:5663`, `:5842`) — real toolbar is taller, so it covered the CCH header. Print hides toolbar → different layout.
- Thumbs forced **96×96** (`:5788` before this). Chrome print + EXIF stands landscape slabs on end.

## Change

1. No Document Tags block on PO Print.
2. Toolbar `position:relative` on PO preview so the navy header is fully visible (same as print).
3. PO thumbs **120×80**, `object-fit:contain`, `image-orientation:none`.

## Files

- `platform/cch-proposals-invoices-fix.js` info HTML; CSS `:5785–5789`, print `:5814–`
- `platform/index.html` `CCH_BUILD` 9.9.304; cache buster
- `platform/client.html` cache buster

## Verify (staging)

Close the old Print tab. Ctrl+Shift+R, sidebar **v9.9.304**. PO-9045 → Print / PDF: no DOCUMENT TAGS; Azure/Summer Gala/Basalt **landscape**; Close the print window and the preview should match the PDF (minus the navy toolbar).

**No production GO** until Cindy types it.
