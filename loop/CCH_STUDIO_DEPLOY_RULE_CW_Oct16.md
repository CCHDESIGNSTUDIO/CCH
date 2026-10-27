# CCH STUDIO DEPLOY RULE
**Updated by Cindy, Oct 16 2026.** This replaces `loop/CCH_STANDING_RULE_prod-bugs-skip-staging_CW_Sep25.md` where they conflict. The Sep 25 file stays as history.

1. Builder chats build features AND deploy them to STAGING themselves. I test on staging and give fixes right in that same builder chat. The builder fixes and re-deploys to staging. No handing off to Cursor #1 for staging.
2. Only Cursor #1 deploys to PRODUCTION, and only after my typed GO.
3. Production bugs: Cursor #1 fixes and deploys straight to production after my GO (no staging lap).
4. Before any production deploy, check against everything already live so nothing gets overwritten.
5. Anything paid, ordered, or approved is locked. Never change it.
6. Keep working through the whole list. Only stop for my GO, a money question, or a real blocker.
7. Don't make things up. If it's not verified, say so.

Commits on the shared Machine-1 working copy stay with Cursor #1 unless Cindy asks. A commit still sweeps every session's uncommitted edits. A staging deploy does not require a commit first.
