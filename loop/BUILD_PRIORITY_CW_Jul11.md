# BUILD PRIORITY — Fable's call (Jul 11), Cindy delegated
For Cursor. Sequence across the open handoffs. All **staging only; production only on Cindy's GO.**

## 1st — Smart Time recovery cluster  (WO-024 → WO-022 → WO-023)
Highest ROI and time-sensitive: it recovers money already earned but never billed, and every day unbuilt more
untagged time piles up. Mostly small/medium. Order within: **WO-024** (resync reaches February — unblocks the
whole recovery), then **WO-022** (capture untagged, assign at log time, service optional), then **WO-023**
(Pending view filter + confirm-before-log guard — also stops the accidental-logging Cindy hit). Cindy runs the
actual Feb resync herself with GO; Cursor ships the code.

## 2nd — Client Portal bi-weekly, Phase A  (WO-021)
Cindy wants to review the look on staging. Bigger build (new portal page) but high delight value and client-
facing. Phase A = Updates tab + landscape page + one seeded Rolling Hills sample; auto-draft composer is
Phase B after she signs off.

## 3rd — Fix-It bot  (WO-025)
Most complex (LLM cloud function + knowledge base). Safe to be last because the v1 Bugs & Requests tracker
already lets Vanessa report and get answers in the meantime — nobody's fully blocked while this is built
carefully. Guide + triage only; safe in-app actions are Phase 2.

## Quick wins — interleave anytime (tiny, already staged)
These are small and fix things Cindy's actively seeing; knock them out first or between the batches, don't
queue them behind the big three: **WO-016** (remove the broken PO "profit" tile), **WO-013** (board status
strip), **WO-018** (FFE picker click-to-toggle), **WO-012 / WO-019 / WO-020** (Follow-Ups Houzz noise + the
.select crash + Order Management staging parity). WO-020's staging data reconciliation stays BLOCKED-DISCUSSION
(needs Cindy GO before any bulk staging write).

## Note
Deploy each batch to staging and tell Cindy; Claude (Cowork) verifies before anything is proposed for prod.
