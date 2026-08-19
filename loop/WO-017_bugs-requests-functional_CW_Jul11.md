# WO-017 · Bugs & Requests — make it functional (report-from-anywhere + threaded chat + unread badge) · CW Jul 11
**Change ID:** pending #1 assign · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
**In-app only** (Cindy's Jul 11 ruling — no email/SMS). **Staging only. Pause for GO before deploy.**

## The full spec lives in Dropbox (hand Cursor THAT file)
`C:\Users\cindy\Dropbox\Claude - CCH studio\BUGS AND FEATURES BY SECTION\CURSOR_BugsRequests_GROUNDED_CW_Jul11_v1.1.md`
It supersedes the earlier `CURSOR_BugsRequests_MH_Jul11.md` in the same folder. This loop file is just the
tracker entry so WO-017 sits in sequence with the rest.

## One-paragraph summary (see the Dropbox spec for the full grounded build)
"Bugs & Requests" is NOT a dead nav item — it's live with 25 real requests (`renderFeedbackRequests()`
index.html:61510, `feedbackRequests` collection, submit modal :61754, nav :3173, route :4790). So EXTEND it,
don't rebuild (a new `platformFeedback` collection would orphan the 25). Add: (1) a floating "Report a bug"
button on every studio page (not the client portal) that opens the existing submit modal pre-filled with the
current page/URL — so Vanessa can report from anywhere; (2) a threaded chat per request (subcollection
`feedbackRequests/{id}/messages`, migrate any legacy `response` to the first message); (3) an unread badge on
the nav + pop-up, keyed by ROLE ('owner'/'vanessa') derived from email (ADMIN_EMAILS :3530 / VANESSA_EMAILS
:3531 — role is email-based, NOT uid; the "Vanessa dashboard" is a UI view toggle under Cindy's login).
Remove the disabled auto-responder (:61528-61560). No client-portal exposure. `node --check` + tail.

## Grounding to re-confirm before building
- No other module has started a `platformFeedback` collection.
- The email-based role helper to reuse for owner vs vanessa.
- `#/feedbackrequests` is still the live route (don't invent a new one).

## Open question for Cindy (in the spec)
All 25 existing requests are "BY cynthiacbh@gmail.com." The two-way, role-split badge only distinguishes
Cindy from Vanessa if **Vanessa signs in under her own email**. Confirm she has/uses her own login, or we add
an in-app "I am Vanessa" selector.

## Acceptance / DO-NOT / Phase 2
See the Dropbox spec. Key DO-NOTs: don't create a parallel collection (orphans the 25); don't expose to any
client surface; don't build screenshot upload or Cloud-Function notifications (Phase 2); don't deploy — pause
for Cindy's GO.

## DONE note
loop/WO-017_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
