# Handoff → Claude Code · Bucket 1–3 · #1 Cursor · Aug 4, 2026

**STOP state.** Cursor crashed / OOM risk on large Builder edits. Do not continue in Cursor for Builder work — finish in Claude Code with surgical diffs only.

**Workspace:** `C:\dev\CCH-Platform-Deploy\cch-deploy` only  
**Handoff folder copies:** `C:\Users\cindy\Dropbox\Claude - CCH studio\Cursor1 to cursor2 Claude Handoffs`

---

## Bucket 1 — Prod GO (Fable cleared)

**Already shipped Aug 3 ~11:30** (no further deploy needed unless Cindy wants a re-push):

| WO | What | Prod |
|----|------|------|
| WO-070 | All Tasks Project sort + sidebar readability | **PROD** v9.9.87 |
| WO-069-B / ft028c | Builder material picker (client-safe) | **PROD** ft028c |

Fable clearout: `DEPLOY_CLEAROUT_morning_CW_Aug04.md` (Dropbox handoff).  
Known-open (not ship blockers): cost-on-line end-state proof; ghost deep assert.

---

## Bucket 2 — Canary (partial)

**Env:** `C:\Users\cindy\Dropbox\Claude - CCH studio\staging-canary.env`  
(has `STAGING_BUILDER_PROJECT_ID`, `STAGING_INVOICE_HASH`; still needs `STAGING_BOARD_HASH`)

**Ran once** (after `npx playwright install chromium` in `_scripts/canary`):

```
PASS  login
PASS  invoice_route_found
PASS  invoice_voice_not_agency_speak
FAIL  invoice_no_ds_sales_tax
FAIL  designboard_route_found  — need STAGING_BOARD_HASH
PASS  designboard_unique_element_ids (skipped)
PASS  sidebar_nav_contrast_4_5
PASS  sidebar_pinterest_not_red_text
PASS  alltasks_project_sort (skipped — 0 rows for canary user)
FAIL  builder_rev_ft028  — live rev was ft045 (then Cursor started ft046) — assert is stale
PASS  builder_cost_populated_with_sell  — resolver only (NOT line cost)
PASS  builder_ghost_filter_wired
PASS  builder_picker_* (project materials + no ghosts + fabric/trim)
PASS  no_console_errors
RED: 13/16
```

**Result file:** `_scripts/canary/results/canary_Aug04_bucket2.txt`

**Fable still wants:**
1. Fix canary to assert **created proposal line Cost**, not `builderLibraryUnitPrices` return — see `WO-069-B_COST_STILL_BLANK_CW_Aug04.md`
2. Fresh pick on staging after hard refresh → Cost cell non-blank
3. Set `STAGING_BOARD_HASH` for board check

---

## Bucket 3 — Upholstery WOs

| WO | Status | Notes |
|----|--------|-------|
| **075-B** | **DONE / PROD** Aug 3 `ft045-wo075b-four` | Do **not** redo |
| **076-B** | **IN TREE, NOT DEPLOYED** | Cursor started surgical edits; may be incomplete / verify before staging |
| **077-B** | OPEN, not started | After 076 ships + Fable OK |

### Specs (canonical in repo + Dropbox)

- `loop/WO-076-B_builder-finish-on-legs-nailhead-simplify_CW_Aug04.md`
- `loop/WO-077-B_workorder-fabrication-page-2_CW_Aug04.md`
- Ledger rows added for 076-B / 077-B in `loop/LOOP_LEDGER.md`

### WO-076-B — what Cursor already changed in `platform/builder/index.html`

Rev meta bumped to: `2026-08-04ft046-wo076b-finish-legs`

Intended edits (verify all present before deploy):

1. **Form:** Finish moved into **Frame / Legs** block as “Frame / Leg Finish”; nailheads = Spacing/note + optional image only (Vendor/SKU UI removed)
2. **`nailHeadRowHasContent`** — note-only (legacy vendor/sku keys kept in data)
3. **`buildPreviewNailHeadRow`** — print note only
4. **`collectProductHeroDetailImageCols`** — order Nailheads → Frame/Leg Finish → Feet; finish text on captions
5. **`updatePreview` detailBits** — finish text fallback only if no finish/feet image
6. Draft DONE note: `loop/WO-076-B_DONE_CR_Aug04.md` (says staging pending — **not deployed**)

**Code must:** ground those spots, finish anything missing, bump rev if needed, deploy **staging only**, one screenshot to Fable. **No rewrite of the ~5MB print path.** No prod without Cindy GO.

### WO-077-B — not started

Toggle default OFF → full-width fabrication page 2; keep page-1 look; “1 OF N”; no architectural title block. Spec in loop file above.

---

## Other open from earlier today (not this batch)

- Link-to-client fix **already PROD** v9.9.89 (URL + onclick quote bug)
- Dashboard loads all 125 projects / Pepper+Chat float bottom off project pages — diagnosed, **not fixed**
- WO-068 formatted notes — still waiting, not in this batch

---

## Deploy / commit policy

Only #1 commits/deploys from shared Machine-1 copy. Queue via `_DEPLOY_QUEUE.md`. Staging default; prod = Cindy typed GO.

---

## Suggested Code sequence

1. Verify WO-076-B edits in builder; complete gaps; staging deploy; hand screenshots to Fable  
2. Canary: patch cost assert + add `STAGING_BOARD_HASH`; re-run; send JSON/txt to Fable  
3. After Fable clears 076 → WO-077-B  
4. Do not touch WO-075-B page-1 again unless Fable reopens it  
