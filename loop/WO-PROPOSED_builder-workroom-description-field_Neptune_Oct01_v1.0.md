<!-- CODE-MS5 — Neptune (Claude Code), Computer 5 — Oct 1, 2026 -->
# WO (PROPOSED — #1 assign number) — Order Builder: add a "Workroom Description" field to the work order + tear sheet

**Neptune_Oct01_v1.0** · Lane: **Cursor #1** (code) · File: `platform/builder/index.html` · **FEATURE → staging-first.** · Verify: Neptune (Cloud Code).
**Origin:** Cynthia, Oct 1 2026 (Rolling Hills window treatments + Bartolo estimate). Two different descriptions exist and must not be the same text: the **client** description (pretty, on the proposal) and the **workroom** description (technical fabrication spec, e.g. *"Lutron QS motorized sunscreen roller shades, Sivoia QS Wireless Roller 100 drive, 4¾\" × 5\" metal box pocket (black), Fabric SW 90-3%…"*). The WO needs its own place for the workroom version.
**Grounded (read this turn, `C:\dev\CCH-Platform-Deploy\cch-deploy`):** anchors in §Sources.

---

## 1. What exists today (so we don't duplicate)
- WO object `d` has **`d.notes`** (array; rendered on the tear sheet via `notesArr`, `builder/index.html:1316`) and **`d.specs`** (piece/style/size/qty/productType…).
- Per-material rows have a **"Material / Description"** input (`d.…materialDescription`, `builder/index.html:1998-2000`).
- Templates carry `notesDefault` / `fabNotesDefault` (default bulleted workroom notes).
- **Gap:** there is **no single, dedicated free-form "Workroom Description"** narrative field — the cohesive fabrication paragraph the workroom reads. `d.notes` is bulleted QC reminders; `materialDescription` is per-material. Neither is the item-level workroom spec.

## 2. Scope — add ONE field
1. Add **`d.workroomDescription`** (string, multiline free text) to the work-order model.
2. **Form:** a labeled multiline input **"Workroom Description"** (fabrication spec) in the WO edit pane, visually distinct from the client title and from the bulleted notes. Placeholder example from the Bartolo style: *"1 Lutron QS motorized sunscreen roller shade, Sivoia QS Wireless Roller 100 drive; 4¾\" × 5\" metal box pocket (black); Fabric SW 90-3% — Color [TBD]."* Saves through the existing draft-save path (`scheduleBuilderDraftSave`, `builder/index.html:1999`) and persists onto the `boards/{projectId}/workOrders/{id}` doc.
3. **Tear sheet / print:** render `workroomDescription` in its **own labeled block** on the work-order tear sheet (the workroom's copy), separate from the client-facing title/description and from the notes list. Keep it in the Letter-fit print flow already in place (do not break the 2-page Letter sizing).
4. Available on **all workroom templates** (upholstery, window/shade, drapery, bedding, pillows) — it's item-level, template-agnostic.

## 3. Safety / constraints
- Purely **additive** — one new optional field. Do not rename, repurpose, or drop `d.notes`, `materialDescription`, or any `specs` field.
- Must not alter work-order numbering, the proposal/PO material round-trip (`buildProposalMaterialLinesFromWorkOrder` @3923, `mergeWorkOrderMaterialsIntoProposalItems` @3995), or any money/line data.
- Empty `workroomDescription` prints nothing (no empty block/label on the tear sheet).
- Preserve the current **Letter 2-page** print fit (staging banner hidden in print, detail-band sizing) — verify the added block doesn't push to a 3rd page.

## 4. Acceptance (binary)
1. WO edit pane shows a **"Workroom Description"** multiline field; typed text saves and reloads.
2. Text renders in its own labeled block on the tear sheet / print, distinct from client title and from notes.
3. Empty field = nothing printed (no orphan label).
4. Field appears on every workroom template.
5. No regression to WO numbering, the proposal/PO material round-trip, or the Letter 2-page print fit.
6. Verified on **staging**; production only on Cynthia's typed GO.

## 5. Ties into the companion WO
This field is where the **"Create Work Orders from Proposal"** WO (separate, pending Cynthia's 2 choices) will put the fabrication spec — proposal **title** inherited for consistency, client description carried for reference, and this **Workroom Description** field filled (blank by default, or seeded — Cynthia to choose).

## 6. Sources / grounding
`platform/builder/index.html`: WO notes render `notesArr`/`d.notes` @1316, templates `notesDefault`/`fabNotesDefault` @1620/1644/1666/1710, specs usage @1369-1386/1808-1855, per-material `materialDescription` @1998-2000 + draft save `scheduleBuilderDraftSave` @1999, proposal round-trip `buildProposalMaterialLinesFromWorkOrder` @3923 / `mergeWorkOrderMaterialsIntoProposalItems` @3995, WO numbering `nextWorkOrderNumber` @3343/4300. WO storage `boards/{projectId}/workOrders` (`platform/index.html:17853`).

*Neptune_Oct01_v1.0 — Cloud Code spec, read-only grounding; no code changed. FEATURE, staging-first. #1 to assign WO number. Cloud Code verifies on staging after build.*
