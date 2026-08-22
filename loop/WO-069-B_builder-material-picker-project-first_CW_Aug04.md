# WO-069-B · Custom Order Builder — material picker: Project materials first + All Product Library tab · CW Aug 04
**Change ID:** FT-028 (`ft028`) · **Lane:** Builder (`WO-###-B`) · **State:** ON STAGING, awaiting Fable verify · **Executor:** Cursor/Ralu · **Verifier:** Fable (Cowork) · **Gate:** Cindy typed GO #1 for prod
**File:** `platform/builder/index.html` (single HTML + inline JS). Rev meta `cch-builder-rev` should read the `ft028` build. **Staging default; prod only on Cindy GO. Ask before large UI/layout changes.**

## What Cindy relayed (Ralu/Cursor, Aug 03)
The COM material picker was reworked and is on staging as `ft028`:
- Opens on **Project materials** first (project clips + library items linked to the project).
- **All Product Library** tab for the full Fabric & Trim catalog.
- Search filters the **active tab** (vendor / SKU / color / title, etc.).
- Loads project clips when the modal opens (they were often missing before).
Try: https://cch-platform-staging.web.app/builder/ → Ctrl+Shift+R → Material A → Product Library (use a staging project with fabrics; west-avalon is prod-only). Prod keeps the old picker until GO #1.

## Grounding (Builder COM pick, from HANDOFF_Custom_Order_Builder_CURSOR_Jul21)
- Picker + apply: `openFabricWorkOrderPickModal`, `applyFabricProductPick`, `resolveMaterialProductById`.
- Catalog load: `loadProductLibrary` / `ensureProductLibraryReady`. Product Library = merged `products` + `productLibrary`; COM = **Fabric & Trim only**.
- Material→proposal lines: `buildProposalMaterialLinesFromWorkOrder` (~3076-3137) — the known $0-price bug lives here; the picker change must not regress it.
- Document isolation: Builder→proposal copies a snapshot; later library edits don't rewrite existing docs.

## Acceptance criteria (binary — Fable verifies on staging)
1. **Project materials default.** Opening Material A COM pick lands on the Project materials tab, populated with the project's clips + project-linked library items. Not empty (the "often missing" bug is fixed).
2. **All Product Library tab.** Second tab shows the full **Fabric & Trim** catalog only (not all product types).
3. **Scoped search.** Search filters the ACTIVE tab and matches vendor / SKU / color / title. It does not silently search across the other tab or the whole catalog when you're on Project materials.
4. **No ghost/corrupt clips.** Now that project clips load on open, the corrupt duplicate "ghost" clips (sub-$1 junk sell with a healthy twin, per the picker ghost-filter FT/WO ghost work) must NOT appear in the picker. Loading project clips must reuse that filter.
5. **Price integrity on select.** Selecting a material writes the correct unit cost / client price / qty to the material row, no $0 regression against `buildProposalMaterialLinesFromWorkOrder`. Create Proposal / Add Fabrics from that WO still carries real prices.
6. **Vendor path unchanged.** Source = Vendor still uploads swatch + part # (not Product Library). Fabric|Trim chips still work.
7. **No console errors;** rev meta reflects `ft028`.

## STOP / guardrails
1. **No pricing writes.** Opening or using the picker must never change a clip's or product's price, and never change client-visible / room pricing or saved-proposal markup (standing rules). Read + select only.
2. **Document isolation holds.** Selecting copies a snapshot; do not wire the picker to live-rewrite existing proposal/PO lines.
3. **Ghost filter reused, not bypassed.** Do not surface corrupt/duplicate clips just because the modal now loads project clips.
4. **Fabric & Trim only for COM.** The All Product Library tab must not leak non-fabric product types into COM.
5. **Do not split `builder/index.html`** unless Cindy explicitly asks. Minimal diff.

## Verify (Fable) + note on reach
Reach caveat: Fable's Cowork sandbox cannot load `cch-platform-staging.web.app` (network-walled), so this verifies via the Phase 0 canary (run locally by Cursor/Claude Code) plus Cursor screenshots of the 7 criteria on a staging project that has fabrics. Add a Builder-picker check to `_scripts/canary/canary_smoke.js`: open a WO, open Material A COM pick, assert (a) Project materials tab is active + non-empty, (b) All Product Library tab lists Fabric & Trim, (c) no sub-$1 ghost clip rows present, (d) no console errors. Green canary + screenshots = Fable sign-off, then Cindy GO #1 for prod.

## Ledger
Add to `loop/LOOP_LEDGER.md`: WO-069-B · FT-028 · Builder material picker (Project materials first + All Product Library + scoped search + load project clips) · staging `ft028` · awaiting Fable verify.
