# Session Log — Cursor: WO-112 Smart Time source split (+ earlier Aug 13 tracks)

**File:** SESSION_LOG_Cursor_2026-08-13.md  
**Original Author:** Cursor (CR)  
**Created:** August 13, 2026  
**Last Modified:** August 13, 2026  
**Last Modified By:** Cursor  
**Version:** 2.1  

**Workspace:** `C:\dev\CCH-Platform-Deploy\cch-deploy`  
**Primary paths:** `platform/index.html`, `platform/builder/index.html`, `loop/WO-112_*`, `Docs/HANDOFF_SmartTime_Agent_vs_Timely_Reconciliation_CW_Aug13_v1.0.md`  
**Firebase staging:** `cch-studio-staging` → https://cch-platform-staging.web.app  
**Firebase production:** `cch-design-boards` → https://cch-platform.web.app  

## Revision history

- v2.1 (Aug 13 evening): Order Builder workroom cost draft fix (`ft066`) — queued staging, not deployed.
- v2.0 (Aug 13 afternoon, #1): WO-112 Timely/Agent/Logged source split shipped to **staging** as **9.9.162**.
- v1.0 (Aug 13): Truth protocol rule (docs only).

---

## Session overview

Cowork cleared WO-112 outline (parallel-run, no Timely sync, AI summaries out of scope, Logged as third source). Implemented Phases A–C; cross-ref so `CURSOR_TimeAgentPage_MH_Aug12` is not queued blind.

Later: Order Builder — Cindy entered labor on all 3 West Avalon upholstery WOs; closed without reliable save; WES-U-03 empty in prod Firestore (U-01/U-02 still had 820 from earlier saves). Fix: cost-field browser draft + flush before WO switch + confirm draft restore.

Earlier same day (prior turns): Spec Book nav, proposal Options/Tear Sheets (**9.9.160** prod), room-board Tear Sheet options (**9.9.161** prod).

---

## What changed (WO-112)

| File | Change |
|------|--------|
| `platform/index.html` | `cchTimeSourceBucket` + legend; Recon Month cells; Week/14-day Cap cols + Source badge; Smart Time Week split; build **9.9.162** |
| `loop/WO-112_*.md` + `LOOP_LEDGER.md` | Spec cross-ref; DONE_CR; DONE-UNVERIFIED |
| `Docs/HANDOFF_SmartTime_…_v1.0.md` | Three sources + coordination table |
| `_DEPLOY_QUEUE.md` | Staging line → done |

**Deployed staging:** hosting ~14:25 Aug 13. **Not production** — needs Cindy GO.

**Not touched:** Timely Cloud Functions / sync; AI narrative / WO-111; Phase D Day project table; `CURSOR_TimeAgentPage` (not queued).

---

## What changed (Builder workroom costs — ft066)

| File | Change |
|------|--------|
| `platform/builder/index.html` | Cost qty/amount/note/markup → `scheduleBuilderDraftSave`; flush draft before WO switch (`builderUiReady`); always confirm draft restore over saved WO; meta `2026-08-13ft066-workroom-cost-draft` |
| `_DEPLOY_QUEUE.md` | Staging pending line |

**Not deployed** — STATUS: pending in queue. Prod data unchanged (re-enter WES-U-03 labor after staging verify).

---

## Verify (staging)

```text
https://cch-platform-staging.web.app
Ctrl+Shift+R → sidebar build 9.9.162
Smart Time → Time Reconciliation → Month (legend + green/cyan/gold)
Smart Time → Reconciliation → Week / 14 Days (⏱ Cap / Agent Cap; expand Source)
Smart Time → Week (split capture lines; Next Week › not ?)
```

**Builder (after #1 deploys ft066):**

```text
https://cch-platform-staging.web.app/builder/
Ctrl+Shift+R — meta ft066-workroom-cost-draft
Enter labor on WO A → switch to WO B without Save → return to A → accept Restore draft → Save Draft
```

---

## Open items / GO needed

| Item | Status |
|------|--------|
| Builder ft066 staging deploy | Queued pending |
| Re-enter WES-U-03 labor (prod) | After fix on prod, or re-enter now + Save Draft |
| WO-112 production | **LIVE** — verified build **9.9.162** / `wo112-smart-time-source-split` on cch-platform.web.app (Cindy GO Aug 13 evening; do not redeploy local 9.9.168 — has parked 3A/3B tear sheets) |
| Claude verify WO-112 on staging | DONE-UNVERIFIED |
| Desktop Time Agent (`\CCH-TimeAgent-v4`) | **v5 script live** — idle stop + merge flush; task TR → `CCH-TimeAgent-v5.ps1`; may need interactive Start-Process if task password empty |
| Time Agent Studio page | **Built** — Smart Time tab + sort/notes/badges; Studio **9.9.169** queued staging |
| `CURSOR_TimeAgentPage_MH_Aug12` | Delivered as Time Agent tab in 9.9.169 |
| Narrative-summary brief | Still blocked (freshness + §4.3) |
| Commit/push | Only if Cindy asks (#1) |
| Dropbox handoff copies | CLAUDE.md asks for copies; blocked by sandbox this turn — files live in repo `loop/` + `Docs/` |

---

## Grounding note (capture minutes)

Bucket `items` are indices into `_pendingCaptures`, not `{duration}` objects. Recon now sums unlogged `_pendingCaptures` by date for Timely/Agent splits.
