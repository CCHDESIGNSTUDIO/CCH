# HANDOFF → Cursor · BUILD WO-021 (Client Portal Bi-Weekly Update) + DEPLOY TO STAGING for Cindy's review · CW Jul 11
**From:** Fable (Cowork) · **Action:** build + deploy to **staging** so Cindy can click through it. **Do NOT touch production.** **Priority: high** (Cindy asked to review it now.)

## What to build
Full spec: `loop/WO-021_portal-biweekly-update_CW_Jul11.md`.
Visual spec (build to this exactly): the approved landscape mockup
`Dropbox\Claude - CCH studio\BUGS AND FEATURES BY SECTION\05 - Client Portal\Client Communications FEATURES & LAYOUT\CCH_BiWeekly_Portal_Update_MOCKUP_CW_Jul11.html`.
Reference content + real renders already placed: the February sample (Rolling Hills) I built this session
(cover = the full game-room Enscape render; room cards = GR 6.2 / LR 6.1 / MB SIMPLE; "Hi Tracey," warm copy).

## Phase it so Cindy can review FAST
**Phase A — ship to staging first (this handoff):**
- Client-facing **"Updates"** nav item + page on the client portal, rendering a published update in the
  **full-width landscape** layout from the mockup (hero cover image behind "Designing Your Story", room
  photos with the ring badge, highlight, awaiting approval, palette, completed, coming up, warm sign-off).
- **Seed ONE sample published update** — Rolling Hills, February — so Cindy can open it and review the look
  and flow end to end. (Use the February sample's content; images can be placeholders or the sample renders.)
- Data model `boards/{projectId}/progressUpdates/{id}` per WO-021; the seeded one is `status:'published'`.
- Latest update also teased on the portal **Home**.

**Phase B — next handoff (not required for this review):** the Studio admin composer with **auto-draft** from
room boards / decisions / selections / tasks, save-draft, publish, per-client greeting/tone. Build after
Cindy signs off on the Phase-A look.

## Constraints (binding)
- Client-facing: Programa palette (white / navy #0A1F3D / gold #C4A464), Playfair + DM Sans, 1px borders,
  **no border-radius, no shadows**, `.cp-` scope. **No POs, rates, margins, or dollar amounts anywhere.**
- Per-client greeting/tone (Hi vs Dear) — Tracey = "Hi". Cover image behind the hero title with the
  navy→warm veil for legibility.
- Never split index.html; regenerate client.html via `_scripts/generate-client-html.js` (do not hand-edit
  client.html); `node --check` + verify tail.

## After deploy
Post the standard `_DEPLOY_QUEUE.md` staging line, then **tell Cindy it's ready to review on staging**
(the Updates tab on a Rolling Hills client-portal preview). Claude (Cowork) will run the verification sweep.

## DONE note
`loop/WO-021_PHASEA_DONE_CR_[MonDD].md` + `_DEPLOY_QUEUE.md` (staging).
