# LOOP LEDGER
**Single source of truth for loop work orders.** Protocol: `loop/LOOP_PROTOCOL_CW_Jul10_v1.1.md`
States: OPEN → IN PROGRESS → DONE-UNVERIFIED → VERIFIED / FAILED → **PROD** (Cindy GO). BLOCKED-DECISION / BLOCKED-DISCUSSION as needed.
Deploy handoffs still go through `_DEPLOY_QUEUE.md` (Deploy Master #1). Do not duplicate queue items here; this table tracks order state only.

| WO | Title | Change ID | State | Attempts | Executor | Verifier | Notes |
|----|-------|-----------|-------|----------|----------|----------|-------|
| 001 | Staging verification sweep: RB-1 + DOC-1 | — | OPEN | 0 | Claude (verify-only) | Claude | No code change |
| 002 | Design Board regressions DB-1/DB-2/DB-3 | pending #1 assign | DONE-UNVERIFIED | 1 | Cursor 1 | Claude | Verify-only: fixes in cch-design-board.js db49 |
| 003 | Remove duplicate Client-activity tab-bar chip | pending #1 assign | DONE-UNVERIFIED | 1 | Cursor 1 | Claude | ca4 — header button sole entry |
| 004 | Project sub-panel nav (feature-flagged) | pending #1 assign | DONE-UNVERIFIED | 1 | Cursor 1 | Claude | cch-project-subpanel.js sp2 — staging default ON admin |
| 005 | Financials tab restyle: white boxes + accent lines | pending #1 assign | DONE-UNVERIFIED | 1 | Cursor 1 | Claude | Matches Financial Health strip pattern |
| 006 | Invoices tab: compact Total/Paid/Open stat row | pending #1 assign | PROD | 1 | Cursor | Claude | WO-006_DONE_CR_Jul11; on prod |
| 007 | Project PO tab reuses Order Management layout | pending #1 assign | OPEN | 0 | Cursor | Claude | Ground cch-order-management.js first |
| 008 | Room board approve/decline notifications + badge | pending #1 assign | OPEN | 0 | Cursor | Claude | Schema changes = BLOCKED-DISCUSSION |
| 009 | Overview declutter: collapse boards, drop selections grid | pending #1 assign | PROD | 1 | Cursor | Claude | WO-009_DONE_CR_Jul11; on prod |
| 010 | Follow-Ups module (cross-project + per-project stall tracker) | pending #1 assign | DONE-UNVERIFIED | 1 | Cursor 1 | Claude | cch-followups.js fu1 + sub-panel sp3 un-ghost |
| 011 | Retainer Credit + discount negative entry (v1.2) | pending #1 assign | PROD | 1 | Cursor | Claude | WO-011_DONE_CR_Jul11; hosting+functions prod |
| 012 | Follow-Ups: Studio-only + .select fix + 999-day | pending #1 assign | PROD | 1 | Cursor | Claude | fu5 on prod; WO-019 completes Houzz-in-all-lanes |
| 013 | Room Board pipeline status strip | pending #1 assign | PROD | 1 | Cursor | Claude | WO-013_DONE_CR_Jul11 |
| 014 | Universal FFE Schedule (filter-first) | pending #1 assign | PROD | 1 | Cursor | Claude | WO-014_DONE_CR_Jul11; `#/allffe` |
| 015 | Files Photos grid + upload refresh | pending #1 assign | PROD | 1 | Cursor | Claude | WO-015_DONE_CR_Jul11 |
| 016 | Remove PO profit tile (all PO strips) | pending #1 assign | PROD | 1 | Cursor | Claude | WO-016_DONE_CR_Jul11 |
| 017 | Bugs & Requests functional (report-anywhere + thread + unread) | pending #1 assign | OPEN | 0 | Cursor | Claude | `loop/WO-017_bugs-requests-functional_CW_Jul11.md`; EXTEND feedbackRequests |
| 018 | FFE Schedule: multi-select → click-to-toggle | pending #1 assign | OPEN | 0 | Cursor | Claude | `loop/WO-018_ffe-schedule-multiselect-toggle_CW_Jul11.md`; polish on WO-014 |
| 019 | Follow-Ups: exclude Houzz from ALL lanes (completes WO-012) | pending #1 assign | OPEN | 0 | Cursor | Claude | `loop/WO-019_followups-houzz-all-lanes_CW_Jul11.md`; fu6; reuse cchOmIsHouzzSourcePo |
| 020 | Order Management: staging Houzz data parity (diagnose-first) | pending #1 assign | OPEN | 0 | Cursor | Claude | `loop/WO-020_ordermgmt-houzz-staging-parity_CW_Jul11.md`; DATA likely; BLOCKED-DISCUSSION on bulk write |
| — | SEL-1 Selections edit persistence | — | BLOCKED-DECISION | — | — | — | Needs Cindy a/b/c — KNOWN_ISSUES SEL-1 |

## Log
- Jul 10 (CW): Ledger created. WO-001, WO-002 opened. SEL-1 parked.
- Jul 11 (CW): WO-003–009 opened from Cindy staging feedback.
- Jul 11 (Cursor 1): WO-002 verify-only DONE; WO-003 ca4; WO-005 financials restyle; queue batch pending staging deploy.
- Jul 11 (Cursor 1): WO-010 Follow-Ups module DONE (fu1/sp3); pending staging deploy + verify.
- Jul 11 (CW): WO-011 → v1.2 (discount + retainer negative entry). WO-012 opened (Studio-only, 999-day, .select).
- Jul 11 (CW): WO-013–016 opened (board status strip, FFE Schedule, Photos grid, PO profit tile).
- Jul 11 (CW): WO-017 opened — Bugs & Requests functional; grounded spec v1.1; extend feedbackRequests. WO-018 opened — FFE multi-select polish.
- Jul 11 (CW): WO-019 opened — Houzz in Follow-Ups client-court lane; completes WO-012. WO-020 opened — staging OM Houzz data gap vs prod.
- Jul 11 (Cursor): WO-011–016 implemented + staged; WO-016 PO profit tile; production roll (Cindy GO) — hosting + functions → `cch-design-boards`.
- Jul 11 (Cursor): Ledger sync — WO-006/009/011–016 → PROD; WO-017 spec filed in `loop/`; WO-018/019/020 specs linked; commit batch.
