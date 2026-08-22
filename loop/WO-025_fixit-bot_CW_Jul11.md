# WO-025 · Bugs & Requests — add the "Fix-It" AI first-responder bot (guide + triage) · CW Jul 11
**Change ID:** pending #1 assign · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
Extends WO-017 (built tracker). **Staging only. Pause for GO.**

## Full spec (hand Cursor THIS)
`Dropbox\Claude - CCH studio\BUGS AND FEATURES BY SECTION\05 - Client Portal\CURSOR_BugsRequests_FIXIT_BOT_CW_Jul11_v2.md`
(This loop file is the tracker entry.)

## One-paragraph summary
The built Bugs & Requests is a two-way tracker; Cindy wanted a **bot that fixes the problem on the spot** so
Vanessa isn't blocked waiting on Cindy. Add an **AI first-responder into the existing pop-up thread** (not a
rebuild): it answers how-to, gives workarounds, walks through fixes, and for real code defects auto-writes a
clean report + severity and **escalates** to Cindy/the loop. Scope = **guide + triage only, no data changes**
(safe in-app actions = Phase 2). Tech: a `cchFixItBot` Cloud Function calling an LLM primed with CCH platform
knowledge (KNOWN_ISSUES + how-tos), posting its reply as a message in the same thread; graceful degrade to the
v1 tracker if the call fails so a report is never lost. In-app only; never expose financials in answers.

## DONE note
loop/WO-025_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md (staging).
