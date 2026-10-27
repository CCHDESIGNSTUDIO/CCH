# WO-171 DONE — Restore roller detail slots on the form

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-02  
**Build:** Order Builder meta `cch-builder-rev` **2026-09-02wo171-roller-details**

## Symptom (Cindy)

GRE-W-06 (and GRE-W-05): preview still shows **Shade Style / Face Detail** and **Dual Shade Style** under the main rendering. After the section was renamed to Rendering & reference images, those detail photos were not on the form — no way to change or Clear. Old images stayed in Firestore.

## Surfaces

| Surface | This WO |
|---------|---------|
| Builder roller form (`platform/builder/index.html`) | **Yes** |
| Other WT (roman/flatfold/drapery): Lift / Mount picker visible again | Yes |
| Studio financial docs | **No** |

## Grounding

- Preview: `appendPreviewRollerDetailsBelowRendering` (`:7801`) prints pickers (except it skipped hardware in the *preview* loop), `wtDetail0`, then `rollerSlot0–2`.
- Form: `pickerDetailSlotsForForm` (`:3305`) dropped `hardware` (Lift / Mount). Roller form never drew `rollerSlot0–2`. Dual Shade Style is `imageSlotTitles.rollerSlot*` + `swatchUrls.rollerSlot*`.
- Section was `Rendering & reference images` collapsed by default (`:11656`).

## Change

- Include Lift / Mount (hardware picker) on the form again.
- Draw Dual shade style / detail 2 / Detail 3 (`rollerSlot0–2`) with Clear.
- Section title **Main rendering and details**, open by default for window treatments (new collapse key so a previously collapsed “Rendering & reference images” does not hide them).

## Verify (after staging)

1. Ctrl+Shift+R `https://cch-platform-staging.web.app/builder/`
2. Header **2026-09-02wo171-roller-details**
3. Open GRE-W-06 — expand **Main rendering and details**
4. Dual Shade Style photo visible; **Clear** removes it from preview
