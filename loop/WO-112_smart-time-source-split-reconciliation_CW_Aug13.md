# WO-112 · Smart Time: Timely vs Agent source split (Reconciliation + Week) · CW Aug 13, 2026

**Status:** IN PROGRESS · **Executor:** Cursor #1 · **Target:** staging · **File:** `platform/index.html` only  
**Handoff:** `Docs/HANDOFF_SmartTime_Agent_vs_Timely_Reconciliation_CW_Aug13_v1.0.md`

## Summary

Surface **Timely** (green), **Studio Agent** (cyan), and **Logged** (gold) separately in Time Reconciliation **Month calendar** and Smart Time **Week** view. Wire existing per-day capture stats that are computed but not rendered. UI-only — do not change Timely sync. AI narrative summaries are **out of scope** (WO-111 / Pepper — still blocked).

## Cross-references (coordination)

| Work | Status | Note |
|------|--------|------|
| **WO-112** (this) | Building first | Source-color-coded Reconciliation Month + Smart Time Week |
| **CURSOR_TimeAgentPage_MH_Aug12** | Not queued yet | New Time Agent page (sort by project/member, manual notes). **Before building:** read WO-112 outcome — source badges / Timely·Agent·Logged may change what “member” sort must show. Do not queue blind behind WO-112 without this cross-ref. |
| Narrative-summary brief | Blocked | Freshness check + §4.3 routing unresolved — do not collide |

## Phases

1. **A** — `_buildReconCalendar()` source split + legend  
2. **B** — Reconciliation week/14-day table capture columns + expand Source column  
3. **C** — Smart Time Week view capture/logged split  
4. **D** — Project-grouped Day table (defer unless Cindy pulls forward)

## Depends

- WO-022 Reconciliation queue (done, staging)
- CCH_UI glyph fix 9.9.159 (shipped in later builds)

## Verify

Staging → Smart Time → Reconciliation → Month; Smart Time → Week; hard refresh; orange STAGING banner.
