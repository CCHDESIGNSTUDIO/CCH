# WO-178 DONE — Existing Work Orders list shows Date + Rev

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-02  
**Build:** `cch-builder-rev` **2026-09-02wo178-wo-list-rev**

## Symptom

Cindy: the Existing Work Orders dropdown needs revision and date so you know which one to select. It only showed WO # — room · tag.

## Surfaces

| Surface | This WO |
|---------|---------|
| Builder Existing Work Orders `<select>` | **Yes** |
| All work orders browser table | **No** (already has Updated) |
| Studio | **No** |

## Change

`workOrderSelectLabel` at `platform/builder/index.html` (~4871):  
`GRE-W-02 — Hallway · W1  ·  9/2/2026  ·  Rev 1`

Uses saved `date` and `revision` on each work-order doc (`listWorkOrders` already returns full docs).

## Verify (after deploy)

1. Header **2026-09-02wo178-wo-list-rev**
2. Existing Work Orders options include date and Rev
3. After New revision, that row shows today’s date and Rev 2
