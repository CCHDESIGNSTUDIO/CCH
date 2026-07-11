# WO-004 · Project sub-panel navigation (replaces 18-tab bar) — feature-flagged · CW Jul 11

**Change ID:** pending #1 assign (FT) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork) · **Attempts:** 0

## What Cindy approved (Jul 11)

Replace the scrolling horizontal project tab bar with a Houzz-style **project sub-panel**: a second left column inside a project, between the CCH Studio rail and the content.

**Visual specs (read both before coding):**
- **`Docs/NAV_SPEC_FOR_CURSOR.png`** — annotated picture: **#1 red** = existing navy CCH rail (do NOT touch); **#2 orange** = WO-004 deliverable (build this); **#3 navy** = content area (same pages, no tab strip when flag on).
- **`Docs/NAV_SUBPANEL_SPEC_CW_Jul11_v1.2.html`** — interactive mockup with Holtz Hill data; Cindy-approved grouping.

**Approved grouping (do not rearrange):**
- Pinned top: Overview · Follow-Ups¹ · Tasks
- DESIGN: Inspiration · Selections · Room Boards · Design Boards
- CLIENT: Decisions² · Proposals · Communications · Client Portal ↗
- MONEY: Invoices · Purchase Orders · Bill Variances · Financials³
- OPERATIONS: Work Orders · FFE Tracker · Spec Book · Time · Files & Docs · Notes

¹ Follow-Ups page doesn't exist yet — render the entry disabled/ghosted with title "coming soon" until that build lands.
² Decisions has no admin page yet either — point it at the existing decisions view if one exists after grounding, else ghost it like Follow-Ups.
³ Financials entry is **admin-only** (ADMIN_EMAILS gate, same as today's nav rules — Vanessa sees Invoices/POs/Bill Variances but never Financials/profit).

## Constraints (binding)

1. **Feature-flagged, default OFF.** Gate behind `localStorage['cchNavPanel']==='1'` (plus a small toggle in Settings or a `?nav=panel` hash param). The tab bar remains the default until Cindy flips it after staging review. No behavior change for anyone until then.
2. Reuse the existing `switchProjectTab(tabKey)` routing — the panel is a new renderer over the same tab keys (overview, workorders, tasks, selections, boards, ideabooks, designboards, ffe, specbook, proposals, invoices, pos, discrepancies, financials, files, time, comms, notes). Do not fork per-tab logic.
3. Badges: reuse the live badge sources — `_ibProjActivityCounts` (Inspiration), cch-client-activity's decision + comms counts (`caState` / its badge elements), Work Orders count. Same `.project-tab-badge` styling family; hot orange only for Follow-Ups/unread.
4. Styling per mockup: navy `#0E1629` family rail untouched; sub-panel white, 216px, gold active edge, group labels 9px uppercase. Never pure black. Never split index.html.
5. The CCH Studio rail (main sidebar) is NOT touched by this order.
6. Responsive: below 900px the sub-panel may collapse to a horizontal scroll strip (tabs behave as today) — do NOT hide it with no fallback (see the mockup's earlier text-only-collapse bug).

## Acceptance criteria (binary)

1. With flag OFF: project pages identical to today (tab bar, no sub-panel).
2. With flag ON: sub-panel renders with the exact grouping above; every entry routes to the same content the equivalent tab shows today; active state tracks the route.
3. Overview/Follow-Ups/Tasks pinned above the first group label; Follow-Ups ghosted.
4. Badges render on Inspiration / Decisions / Communications / Work Orders / Files & Docs where counts > 0.
5. Financials entry absent for non-admin users (test with a non-ADMIN_EMAILS session).
6. Zero console errors on project load and on clicking through all entries, both flag states.

## Verify steps (Claude, staging)

Flag ON via console, walk all entries on `#/project/cloud-rolling-hills`, screenshot panel + two routed pages + non-admin state to `loop/verify/WO-004/`; repeat with flag OFF to confirm no regression.

## Rollback

Feature flag OFF is the rollback; code is additive rendering. No data writes.

## DONE note

`loop/WO-004_DONE_CR_[MonDD].md` + standard `_DEPLOY_QUEUE.md` line (staging).
