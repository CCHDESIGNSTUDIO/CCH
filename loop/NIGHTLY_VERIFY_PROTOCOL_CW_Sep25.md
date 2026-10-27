# NIGHTLY VERIFY — deployed bug fixes (Cindy Sep 25)

Every night: gather what Cursor #1 deployed that day (production preferred; staging only if tagged feature), Cloud Code grounds each fix, morning report lands here for Cindy / Cursor / Grok.

## Schedule
- **Run:** ~10:45 PM PT weeknights (after work, before sleep)
- **Report ready:** overnight; Cindy reads in the morning

## Sources
1. `_DEPLOY_QUEUE.md` — lines flipped to `STATUS: done` today with production (or staging if any)
2. `loop/LOOP_LEDGER.md` — rows moved to DONE-UNVERIFIED / notes with PRODUCTION hosting today
3. `loop/WO-###_DONE_CR_*.md` written today

## Cloud Code steps (read-only)
For each WO deployed today:
1. Ground in `C:\dev\CCH-Platform-Deploy\cch-deploy` — grep, read bodies, file:line
2. Check acceptance in the WO + standing rules (money locks, prod-bug no-staging, no paid/ordered rewrite)
3. Verdict PASS / FAIL / NEEDS CINDY

## Output
Write both:
- `loop/NIGHTLY_VERIFY_YYYY-MM-DD.md`
- This Dropbox folder: same filename

If nothing deployed: one-line “no deploys today” — still write the file so the morning check is quiet-clear.

## Grok Bot
Surface a short morning summary to Cindy from that file. Do not redeploy or edit code.
