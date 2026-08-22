# WO-076-B · Builder form: finish belongs to Frame/Legs + simplify nailheads · CW Aug 04
**Change ID:** pending #1 · **Lane:** Builder · **State:** OPEN · **Executor:** Cursor · **Verifier:** Fable · **Gate:** Cindy GO for prod
**File:** `platform/builder/index.html` (the upholstery **form/data model** + the print via `buildWorkOrderPrint`). This is a form + data-model change (not just layout — separate from WO-075-B). **Staging first; minimal diff; the file is ~5MB, so targeted edits only, no big rewrite.**

## What Cindy said (Aug 04, on the Builder form)
1. "I need to add a finish for the feet/legs." "The finish should go with the frame/legs." → the FINISH field should live with the FEET/LEGS (frame/legs), not floating in the generic DETAILS & TRIM section.
2. "We typically don't provide the nailheads, the upholsterer does. Spacing is ok." → CCH doesn't spec the nailhead vendor/part#; only the spacing note matters. Drop the nailhead Vendor + SKU/PART# capture; keep the spacing note.

## Grounding (data/keys already in the file)
- A `finish` field already exists in the data model (~2021 / ~2989 / used ~5236, 5476). It's the frame/leg finish conceptually; today it renders under DETAILS & TRIM.
- Nailheads: `nailHeadDetails` array (Vendor + SKU/PART# + Spacing per Nail head A/B) ~1291-1302; `nailheadRef` image ~1396 / 3098 / 8244; `nailHeadRowHasContent` gate ~1302 / 9006. Print of nailheads ~9138 / 9810.
- FEET / LEGS section = image + NOTE block in the form (Cursor confirms exact anchor).

## Change 1 — FINISH moves to the FRAME / LEGS section
- In the **form**, present the finish input **inside / directly under the FEET / LEGS (frame/legs) section**, not in the generic DETAILS & TRIM block. Relabel to make ownership clear, e.g. **"FRAME / LEG FINISH"** (placeholder examples already good: "Dark stained oak, matte espresso, antique brass").
- **Reuse the existing `finish` data key** — do NOT create a parallel field or the value/history breaks. Just relocate + relabel its UI, and its optional finish reference image with it.
- In the **print tear sheet**, render the finish **grouped with FEET/LEGS**. Reference WES-U-03 (barstool): the current bottom row is STITCH DETAIL | FINISH | NAILHEADS | FEET/LEGS as four separate tiles. FINISH and FEET/LEGS should sit together (adjacent, or under one FRAME/LEGS heading) since they're both the base, not split apart by the NAILHEADS tile.

## Change 2 — Nailheads: spacing only (drop vendor + SKU/part#)
- In the **form** `nailHeadDetails` rows (Nail head A/B, ~1291): **remove the Vendor and SKU/PART# inputs.** Keep **Spacing / Note** (e.g. "sides only, 3 clover nails 12\" from top") and keep the optional **nailhead reference image** (`nailheadRef`).
- In the **print**, nailheads show **spacing/note (+ reference image) only** — no vendor, no SKU/part#.
- Update `nailHeadRowHasContent` so a row with only spacing (or only a reference image) still counts as content and prints.
- Nuance from "typically": if Cindy ever needs to record a specific nailhead, the Spacing/Note field can hold it. Do not build a vendor/sku toggle now unless she asks.

## Guardrails
1. **Backward-compatible.** Existing saved WOs may hold `finish` and nailhead vendor/sku values. Do not crash or blank them: keep reading `finish`; for removed nailhead fields, tolerate legacy data (ignore/hide it, don't error). No destructive migration.
2. **No pricing / no other data touched.** Form + print fields only.
3. Form and print must stay in sync (both read the same keys).
4. Minimal diff, single pass. If it balloons, stop and flag rather than rewrite the form (crash risk on the 5MB file).

## Acceptance (Fable, staging screenshots)
1. Form: FINISH now sits in the FRAME/LEGS section, labeled as frame/leg finish; entering a finish saves and reprints there.
2. Form: Nail head A/B rows show Spacing/Note (+ optional image) only — no Vendor, no SKU/PART#.
3. Print (WES-U-01 or any upholstery WO): finish prints with the frame/legs; nailheads print spacing/reference only, no vendor/sku.
4. An older WO that had nailhead vendor/sku still opens and prints without error (legacy data tolerated).
Screenshots to Fable = sign-off, then Cindy GO for prod.

## Ledger
Add: WO-076-B · Builder form — finish moved to frame/legs + nailheads simplified to spacing-only · awaiting Cursor · staging first.
