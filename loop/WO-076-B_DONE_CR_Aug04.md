# WO-076-B DONE — Cursor #1 · Aug 04, 2026

**State:** DONE-UNVERIFIED · **Staging:** pending deploy · **Verifier:** Fable  
**File:** `platform/builder/index.html` · rev `2026-08-04ft046-wo076b-finish-legs`

## Changes (surgical)

| Area | Lines (approx) | What |
|------|----------------|------|
| meta rev | 6 | `ft046-wo076b-finish-legs` |
| `nailHeadRowHasContent` | ~1302 | note-only (legacy vendor/sku ignored for gate) |
| `buildPreviewNailHeadRow` | ~1351 | print note only |
| `collectProductHeroDetailImageCols` | ~1389 | order Nailheads → Frame/Leg Finish → Feet; finish text on captions |
| `updatePreview` detailBits | ~9010 | finish text fallback only if no finish/feet image |
| `renderForm` upholstery Details | ~10931–10965 | Finish moved into Frame/Legs block; nailheads spacing-only UI |

## Self-test
- Grep: no Vendor/SKU fields in nailhead form block; `Frame / Leg Finish` field present under Frame/Legs.
- Legacy keys `vendor`/`sku` still in `emptyNailHeadRow` / `ensureNailHeadDetails` (no migration delete).
- File tail intact (`</html>`).

## Verify (Fable screenshots)
1. Form: Frame/Leg Finish inside Frame/Legs; nailheads = Spacing + optional image only.
2. Print: finish with feet; nailheads note only.
3. Old WO with vendor/sku still opens without error.

## Out of scope
- WO-077-B page 2 (next).
- Canary cost-on-line end-state assert (separate; see canary handoff Aug04).
