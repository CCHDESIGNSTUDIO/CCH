# WO-175 DONE — Builder: New Revision shows Rev # and Date

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-02  
**Build:** `cch-builder-rev` **2026-09-02wo175-new-rev-date**

## Symptom

Cindy: when you hit New Revision it should show the revision # and date.

## Surfaces

| Surface | This WO |
|---------|---------|
| Order Builder New revision / Save New Revision | **Yes** |
| Window WO preview (date + REV next to work order #) | **Yes** |
| Product WO preview (existing PROJECT · DATE · REV meta) | Uses same persisted fields |
| Studio print (proposal / invoice / PO / tear sheet) | **No** |

## Grounding (this turn)

- `saveWorkOrder` `platform/builder/index.html:6408`
- Old `existingId` at `:6436` was `state.currentWorkOrderId && !isNewRevision` — New Revision created a **new Firestore doc**. Same WO # then hit `conflicting` and got a **new number**.
- Payload wrote old `date` (`:6477`) and old `revision` (`:6509`).
- After `set()`, code did `if (!existingId) data.revision = 1` then `if (isNewRevision) data.revision += 1` — bump was **in memory only**, after write. Date never set to today.
- Form Date / Rev fields: `:11411`–`:11412`. `renderForm()` after save (`:6532`) now paints the bumped values.
- Product meta already prints DATE/REV: `productTemplateMetaLine` `:1390`–`:1398`.
- Window preview had no DATE/REV; added on the work-order sub-row `:9635`–`:9638`.

## Change

1. New Revision **updates the same work order** (`existingId = state.currentWorkOrderId`).
2. **Before** payload: bump `data.revision` by 1; set `data.date` to `toLocaleDateString("en-US")`.
3. New WO (no id): revision 1; date today if empty.
4. Remove post-write revision mutation.
5. Window preview: `Work order # GRE-W-05  ·  9/2/2026  ·  REV 2`.

## Self-test (mechanical)

- File ends `</html>` (`:12277`).
- Meta rev `2026-09-02wo175-new-rev-date` (`:6`).
- Browser Save/New Revision not exercised this turn (needs hosted Builder + signed-in project).

## Verify (after deploy)

1. Header **2026-09-02wo175-new-rev-date** (Ctrl+Shift+R).
2. Open a saved WO (e.g. GRE-W-05). Note current Date and Rev.
3. **New revision** (or Save New Revision). Same WO #. Date = today. Rev = previous + 1.
4. Form Date/Rev fields and preview both show them. Product templates: DATE / REV on the meta line.
5. Existing Work Orders list still one row for that WO, not a second number.
