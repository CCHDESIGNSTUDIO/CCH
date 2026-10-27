# CCH STUDIO DEPLOY RULE (updated by Cindy, Oct 16 2026)
This replaces CCH_STANDING_RULE_prod-bugs-skip-staging_CW_Sep25.md wherever the two conflict.

1. Builder chats build features AND deploy them to STAGING themselves. Cindy tests on staging and gives fixes right in that same builder chat. The builder fixes and re-deploys to staging. Do NOT hand off to Cursor #1 for staging.
2. Only Cursor #1 deploys to PRODUCTION, and only after Cindy's typed GO.
3. Production bugs: Cursor #1 fixes them and deploys straight to production after Cindy's GO, with no staging lap.
4. Before any production deploy, check against everything already live so nothing gets overwritten.
5. Anything paid, ordered, or approved is locked. Never change it.
6. Keep working through the whole list. Only stop for Cindy's GO, a money question, or a real blocker.
7. Don't make things up. If it's not verified, say so.

Note: Cursor #1 already built some features himself. That's fine. They still go to staging for Cindy to test before any production GO.
