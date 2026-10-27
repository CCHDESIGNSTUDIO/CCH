# WO-234 DONE — Restore #1-only staging deploy

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-09-18  

## Symptom (Cindy)

“My bad, I thought you were number one. We still need to send the number one to go to staging.”

## Change

Reverted WO-233. `commit-deploy-policy.mdc` and related rules/skills/`CLAUDE.md` again: only **#1** runs `firebase deploy` (staging or production). Other sessions queue `_DEPLOY_QUEUE.md`.

## Note for #1

This session already ran `firebase deploy --only hosting:platform --project staging` at ~11:24 (WO-233, before the correction). Staging `cch-platform-staging.web.app` received the then-current working copy (sidebar **9.9.350**). No git commit.

## Verify

No Studio screen. Confirm rules still say only #1 deploys.
