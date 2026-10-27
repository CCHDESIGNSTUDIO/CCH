# HANDOFF — Open Items Board reconciliation (for Claude Team)

**For:** Claude (Cowork / CCH Studio project) · **From:** Cursor (CR) · **Date:** Aug 13, 2026  
**HTML board:** `Docs/CCH_STUDIO_OPEN_ITEMS_BOARD_CR_Aug13_v1.0.html`  
**Dropbox upload copy:** `Studio Claude skills/CCH_STUDIO_OPEN_ITEMS_BOARD_C-Team_Aug13_v1.0.html`

---

## What Cindy asked for

Update the **Open Items Board** HTML (the dark dashboard showing M1–M8 money risks and the staging-fixture bottleneck) — **not** `platform/index.html`.

The original board lived in Claude project context only; it was never saved to the git repo. This handoff + HTML recreate it from the Aug 13 screenshot, reconciled against `loop/LOOP_LEDGER.md` and `_DEPLOY_QUEUE.md`.

---

## What changed vs the screenshot

| Area | Aug 13 board said | Aug 13 EOD (grounded) |
|------|-------------------|------------------------|
| Counts | ~215 distinct open | **~48 OPEN WOs** + **~55 DONE-UNVERIFIED** in ledger (146-doc sweep not run in Cursor) |
| Bottleneck | Empty staging fixture IDs | Still true — but **`FIXTURES.md` now documents example hashes** (invoice + builder project) |
| WO-112 | Not on board | **Shipped staging** `9.9.162` — Smart Time Timely/Agent/Logged split |
| WO-113 | Not on board | **Part 1 coded** `9.9.168` pending staging — PRO-3035 Selections gap |
| M2 INV-6055 | Shipped under fail | WO-067 prod Aug 3; **re-verify after canary env filled** |
| M3 AI overwrite | Blocked on fixture | Same — needs canary + manual save/refresh test |
| HOTFIX-032 | Not highlighted | **Still OPEN-URGENT** — payment ✎/× dead on prod |

---

## Primary bottleneck (unchanged priority)

**Staging canary fixtures** — `_scripts/canary/canary_smoke.js` skips deep checks when env vars empty.

**Operator action (Cindy or #1):**

1. Edit `C:\Users\cindy\Dropbox\Claude - CCH studio\staging-canary.env`
2. Add lines from `_scripts/canary/FIXTURES.md`:
   - `STAGING_INVOICE_HASH=#/project/cloud-rolling-hills/invoice/5ZICEMD4qHDF9nHmS8Pq`
   - `STAGING_BUILDER_PROJECT_ID=cloud-rolling-hills`
   - `STAGING_BOARD_HASH=` (copy from a Design Board URL on that project)
3. Run:
   ```powershell
   cd C:\dev\CCH-Platform-Deploy\cch-deploy\_scripts\canary
   $env:CANARY_ENV = "C:\Users\cindy\Dropbox\Claude - CCH studio\staging-canary.env"
   node canary_smoke.js
   ```
4. Exit 0 → flip WO-067 / WO-069-B / WO-070 / WO-064 from DONE-UNVERIFIED toward VERIFIED

---

## M1–M8 status (money risks)

| ID | Issue | State | WO / track |
|----|-------|-------|------------|
| M1 | Variance tax double-charge | Backfill audit not run | WO-DRAFT-A shipped; audit existing invoices |
| M2 | Phantom tax on DS-only (INV-6055) | Fail verdict until canary | WO-067 prod; re-verify |
| M3 | AI redraft overwrites manual edits | Blocked on fixture + test | WO-067 / `draftInvoiceSummary` |
| M4 | QB marks services taxable | Open since Jul 10 | **WO-034** (not started) |
| M5 | Builder cost blank | Decisive test unrun | WO-069-B prod; canary deep assert |
| M6 | Bugle Trail $2,869 no QB bill | Unreconciled | Ops + WO-040 |
| M7 | PO-9### never in QB | Going-forward defect | QB export path audit |
| M8 | $13,599 Houzz gap Bugle Trail | Needs 44-row export | WO-020 blocked |

---

## New sync crisis (Aug 13 — separate from M-series)

**WO-113** — PRO-3035 Cloud Rolling Hills: proposal lines visible on proposal but not Selections / Room Boards after adding pictures.

- **Part 1 (coded):** board-scoped proposals now `items.push` in `renderSelectionsTab`
- **Part 2 (open):** default-on clip ensure (WO-045 durability)
- **Part 3 (open):** unify Selections tab vs Add-item picker loaders

Handoff: `Docs/HANDOFF_WO-113_Proposal_Selections_RoomBoards_CW_Aug13_v1.0.md`

---

## Claude Team upload instructions

1. Upload **`CCH_STUDIO_OPEN_ITEMS_BOARD_C-Team_Aug13_v1.0.html`** to project knowledge (alongside Aug 12 platform overview + Vanessa guide).
2. Optional: paste this markdown as a short “how to read the board” context doc.
3. When answering “what’s still open,” **defer to `loop/LOOP_LEDGER.md` for WO state** — this board is a human dashboard, not the ledger itself.

---

## What was NOT done

- Full **146 Claude project doc** OPEN/CLOSED sweep (no `project_read` tool in Cursor)
- Ledger row for WO-113 (file exists; table not yet updated)
- Commit / deploy (non-#1 policy)

---

## Verify

Open the HTML locally or after hosting:

`file:///C:/dev/CCH-Platform-Deploy/cch-deploy/Docs/CCH_STUDIO_OPEN_ITEMS_BOARD_CR_Aug13_v1.0.html`

Or double-click the Dropbox copy after sync.
