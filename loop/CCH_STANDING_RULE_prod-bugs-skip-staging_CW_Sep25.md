# CCH STANDING RULE — Production bugs skip staging
**Superseded Oct 16, 2026.** Cindy's current rule is `loop/CCH_STUDIO_DEPLOY_RULE_CW_Oct16.md`. Builder chats deploy their own features to staging. Only Cursor #1 deploys production, and only after her typed GO. Production bugs still skip staging. This file is history.

## The principle
**Production bugs go to production. Features go to staging first.**

If something is already broken on the live Studio site, parking the fix on staging for another round of checking is waste. Cindy verifies on production after Cursor #1 ships with her GO.

## Lane A — Production bug (live site is wrong)
- Fix on the live PC repo (`C:\dev\CCH-Platform-Deploy`).
- Queue the handoff to `_DEPLOY_QUEUE.md` with target **production** (not staging).
- Cursor #1 deploys to **production** after Cindy's GO.
- Cindy verifies on the live site.
- **Do not** require a staging deploy or a staging verify lap for these.

Examples: wrong money on a live invoice/PO/proposal, broken button already in prod, portal showing the wrong balance, drag-and-drop dead in production Manage, etc.

## Lane B — New feature / risky redesign (not yet live, or large behavior change)
- Build and queue to **staging** first.
- Cindy (or Claude) verifies on staging.
- Production only after Cindy's explicit GO.

Examples: new Pepper flows, new boards, large UI redesigns, new money rules that are not fixing a live breakage.

## Mixed batches
If a queue batch mixes prod bugs and features, **split them**. Do not hold a production bug behind a feature's staging verify.

## Still never
- Nobody except Cursor #1 deploys.
- No production deploy without Cindy's typed GO.
- Paid / ordered / approved / signed / invoiced / void lines stay locked (separate standing money rule).
- Do not invent WO numbers or rebuild from a stale GitHub branch that is behind the live PC repo.

## Where this lives
- This file (standing rule).
- Top of `_DEPLOY_QUEUE.md` (so Cursor #1 sees it every pull).
- `loop/LOOP_PROTOCOL_CW_Jul10_v1.1.md` (cycle note).
