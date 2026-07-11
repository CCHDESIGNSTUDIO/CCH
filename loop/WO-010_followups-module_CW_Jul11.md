# WO-010 · Follow-Ups module — cross-project + per-project stall tracker · CW Jul 11
**Change ID:** pending #1 assign (FT) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork) · **Attempts:** 0

This is the build behind the ghosted "Follow-Ups" entry WO-004 left in the project sub-panel and the "Follow-Ups (12)" item planned for the main CCH rail. Approved design: mockups `holtz_hill_live_v1.html` + `followups_mockup.html` (delivered to Cindy Jul 11; ask her or see project memory `project_followups_command_center.md`). Cynthia signed off on the two-lane shape, the stall list, the pipeline-legal actions, and the client digest. Build as a **self-contained module** `platform/cch-followups.js` (pattern of `cch-client-activity.js`), script-tag in index.html, NO index.html surgery beyond the tag + one nav entry.

## What it is
A "what's stuck, whose court, how long, next action" board. Two surfaces, same engine:
- **Cross-project:** a `Follow-Ups` item on the main CCH Studio rail (near Dashboard) → scans ALL active projects.
- **Per-project:** the sub-panel `Follow-Ups` entry (un-ghost it) → same board scoped to one project.

## Data sources (all already in Firestore — verified from Holtz export Jul 11; GROUND each before use)
- `boards/{id}/clients`/clips (selections): `room`, `category`, no proposal link
- `boards/{id}/clientDecisions`: `status` (open | changes_requested | answered), `title`, `createdAt`, client response fields
- `boards/{id}/tasks`: `clientFlag`='needs_input', `clientResponse`, `dueDate`, `priority`, `status`
- `boards/{id}/proposals`: `status` (Draft|Sent|Approved|Invoiced), `items`, `total`, `createdAt`, `clientApprovedTotalAt`
- `boards/{id}/invoices`: `status`, `total`, `paid`, `balance`, `createdAt`, `sentAt`
- `boards/{id}/purchaseOrders`: `status`, `vendor`, `total`
- `boards/{id}/ideabooks`: `images[]`, `updatedAt` (💩 images lack per-image addedAt — use ideabook updatedAt vs last What's New)
- `boards/{id}/whatsNew`: last client-facing update timestamp
- `timeEntries` + `timelyEntries`: `date`, `member`, `hours`, `projectId`/`project` label
- `activity`: `action` (portal_open, line_approved, line_declined...), `meta.source`='client_portal', `timestamp`, `read`

## Stall detectors — TWO LANES

### Lane A — WAITING ON CLIENT (nudge, don't build)
1. Proposal `status`=Sent, no client response, aging from `sentAt`
2. Decision `status` in {open, changes_requested}, unanswered, aging from `createdAt`
3. Invoice `status` in {Sent, Partially Paid} with `balance`>0, aging
4. No `portal_open` activity for this project in >14 days while open items exist
5. Task `clientFlag`='needs_input' with no `clientResponse`, aging

### Lane B — WAITING ON YOU & VANESSA (turns into money/momentum)
6. Proposal `clientApprovedTotalAt` set but no invoice created from it → **not invoiced**
7. Invoice `status`=Paid but no PO placed for its items → **paid, no order**
8. Decision answered (client responded) but no downstream change (no updated selection / proposal line)
9. Design board edited (updatedAt) but never posted as a decision
10. Selections complete in a room with no proposal covering them
11. Inspiration images added (ideabook updatedAt) never shared (> last whatsNew)
12. Timely/ledger hours logged this week with no What's New posted since
13. No hours logged in >N days on an active project (meta-stall; N=7 default)

## Row rendering
- Icon · title · sub (why it costs, e.g. "Vanessa built it Jun 29 · decision went out Jul 8") · age chip (a1 ≤3d / a2 ≤7d / a3 >7d, gold→amber→red) · ONE gold **primary action = next PIPELINE-LEGAL step** + a `⋯` options menu (open, snooze, assign to Vanessa, hold-with-note; out-of-order actions listed but disabled).
- Pipeline-legal rule (feedback_workflow_order_rule): specs→workroom QUOTE ok pre-proposal; fabrication release locked until proposal→approval→invoice. Compute primary action from pipeline position, never hardcode.
- Sort oldest-first within each lane.

## HARD RULES
- **Vanessa financial gate** (feedback_vanessa_no_financials): non-ADMIN_EMAILS sees the same stalls WITH invoice/PO/proposal amounts, but NO profit/leakage/margin framing; the meta "float you're giving away" copy and any leakage-derived stat are admin-only.
- **No gray boxes** (feedback_no_gray_boxes): stat cards = white + thin colored accent line, compact labels, big numbers — the Financial Health strip is the reference.
- No new Firestore schema for v1. If a detector genuinely needs a stored field (e.g. per-image addedAt), STOP → BLOCKED-DISCUSSION, don't invent it. Stamp addedAt going forward is a separate WO.
- Reuse `cch-client-activity` unread/badge mechanism (`_cchCaGetBadgeCounts`) where counts overlap; don't build parallel tracking.
- Navy #0E1629 / gold #C9A96E; never split index.html; feature-flag `localStorage['cchFollowups']` default ON (it's net-new, safe) OR gate behind the sub-panel flag — Cursor's call, note which.

## Acceptance (binary)
1. Main-rail Follow-Ups lists stalls across all active projects; per-project Follow-Ups scopes to one; both render the two lanes.
2. Each detector 1–13 fires on at least the Holtz Hill / Rolling Hills real data where applicable (verify against the mockup's real rows).
3. Primary action per row is pipeline-legal; out-of-order actions disabled in the ⋯ menu.
4. Non-admin (Vanessa) session: amounts shown, profit/leakage framing absent.
5. White accent-line cards, no gray; oldest-first; age colors correct.
6. Zero console errors; no new Firestore writes except optional snooze/hold state (localStorage or an explicitly-approved field).

## Verify (Claude, staging)
Walk both surfaces on cloud-rolling-hills + holtz-hill, screenshot each lane, test a non-admin session, confirm pipeline-legal actions, evidence to loop/verify/WO-010/.

## Rollback
Feature flag off / remove script tag. Additive module, no data migration.

## DONE note
loop/WO-010_DONE_CR_[MonDD].md + standard _DEPLOY_QUEUE.md line (staging).
