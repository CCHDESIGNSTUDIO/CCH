# WO-253 — Room Boards: removed / declined proposal items stay wrong
**Change ID:** pending #1 · **State:** OPEN · **Lane:** A production bug · **Executor:** Cursor #1 · **Verifier:** Cindy

## Cindy Sep 25 (Cloud — Rolling Hills Room Boards)
1. **Items removed from a proposal are not removed from Room Boards.**
2. **Items that were declined are also not showing Declined** (status on the board card does not match the proposal / client decision).

Screenshot: Room Boards grid still shows DECLINED cards for PRO-3020 / PRO-3037 etc., plus items that should be gone after proposal removal. Some decline state appears inconsistent with what she expects after portal/studio declines.

## Intent
Room Board cards must stay in sync with proposal line life:
- **Removed from proposal** → leave / hide from Room Boards (or remove the proposal link + card per existing product rules — ground first; do not invent a second orphan model).
- **Declined** (client or studio) → card shows **Declined** clearly and consistently; do not leave as Pending / bare.
- Paid / ordered / invoiced / void standing money locks unchanged.

## Ground first
Where proposal line remove / decline writes; how “Place on Room Boards” links clips; existing Hide / Remove / DECLINED badge paths; WO-045 / WO-113 trilogy sync if still relevant. Prefer fix on live PC repo, not stale GitHub.

## Acceptance
1. Remove a line from a proposal → corresponding Room Board card is gone (or correctly detached per grounded rule) after refresh.
2. Decline a line → Room Board card shows Declined (not Pending / missing status).
3. Rolling Hills examples Cindy showed (PRO-3020 / PRO-3037 declined clutter) can be cleaned or auto-correct on next sync.
4. No re-price of locked money lines.

## Deploy
Production bug → Cursor #1 to **production** after Cindy GO. No staging lap.
