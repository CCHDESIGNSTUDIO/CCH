# WO-013 DONE · Room Board pipeline status strip · Cursor · Jul 11, 2026

**Change ID:** pending #1 assign · **State:** DONE-UNVERIFIED · **Executor:** Cursor · **Verifier:** Claude (Cowork)

## Delivered

| File | What |
|------|------|
| `platform/index.html` | `renderBoardsTab` — replaced Cost/Sell/Margin budget bar with Pending/Approved/Invoiced/Declined counts (+ Rooms/Categories); gated on `clips.length > 0` |

## Behavior

1. Board header shows pipeline counts consistent with `getClipApprovalStatus` + invoiced clip fields.
2. No cost/sell/margin leakage on room boards (Vanessa-safe).

## Verify (Claude, staging)

- Project → Room Boards: status strip shows counts; no dollar hero.
- Counts match spot-checked clips.

## Deploy

Staging hosting only.
