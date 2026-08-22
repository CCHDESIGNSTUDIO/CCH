# WO-021 · Client Portal — Bi-Weekly Progress Update (auto-draft → curate → publish; lives on the portal) · CW Jul 11
**Change ID:** pending #1 assign · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
**Client-facing.** Programa aesthetic. **Staging only. Pause for Cindy's GO. Do not deploy to production.**
Consult the `cch-client-portal` skill before building.

## Goal (Cindy, Jul 11)
Proactive, beautiful client updates that LIVE ON THE CLIENT PORTAL (not just email) so every bi-weekly stays
there as a permanent, browsable history. **Auto-drafted from platform data, then Cindy curates and publishes.**
**Full-width, landscape, full-page** layout — not a narrow email card.

## Visual spec (approved mockup — build to this)
`Dropbox\Claude - CCH studio\BUGS AND FEATURES BY SECTION\05 - Client Portal\Client Communications FEATURES & LAYOUT\CCH_BiWeekly_Portal_Update_MOCKUP_CW_Jul11.html`
Palette: white #FFFFFF ground, deep navy #0A1F3D, gold #C4A464 accent only, Playfair Display display type +
DM Sans body, 1px borders, **border-radius 0 everywhere, no shadows**. Sections in order: full-bleed hero →
greeting → In Progress (room photos, progress ring as a small navy/gold corner badge) → This Period's
Highlight (large landscape image + caption) → Awaiting Your Approval (image cards, the decision one gold-edged)
→ Material Palette strip → Recently Completed + Coming Up (two columns) → warm sign-off. Superseded mockups
(narrow card v2/v3, and the old charcoal/cyan Grok one) are NOT the target — landscape portal page is.

## Grounding to confirm first (cite file:line; client portal render lives in index.html)
- Client portal render + nav (`renderClientPortal`/clientview, index.html ~66244; nav items list per skill:
  Home, Proposals, Messages, Communications, Room Boards, Concept Boards, Documents, Invoices & Billing,
  Time & Progress). Add an **"Updates"** nav item + route.
- Publish/notify pattern to REUSE: `whatsNew` (cpAdminOpenWhatsNewModal :69229/:69252), `clientPortalDesignStory`
  publish gating (:64988-65052), `heroImages`. Post-publish should drop a Communications/What's New timeline
  entry the same way.
- **Room progress source for the % rings** — confirm whether a per-room completion metric exists. If none,
  the percent is an editable field Cindy sets per room (seed from a simple heuristic if one is available, e.g.
  approved-vs-total selections in the room; otherwise default 0 and she sets it). Report what you find.
- **client.html is generated, not hand-edited** (per memory: regenerate via `_scripts/generate-client-html.js`).
  So build the portal Updates page in index.html's client-portal render, then regenerate client.html — do NOT
  hand-edit client.html.

## Data model — new subcollection `boards/{projectId}/progressUpdates/{updateId}`
```
title, periodStart, periodEnd,
greetingName, greetingBody,
heroImageUrl,
inProgress:      [{ room, imageUrl, percent, item, note }],
highlight:       { imageUrl, heading, body },
awaitingApproval:[{ name, sub, imageUrl, needsDecision:bool, decisionId? }],
palette:         [{ name, imageUrl }],           // material swatch/photo
completed:       [{ label, thumbUrl }],
comingUp:        [{ week, detail, soft:bool }],
signName, signRole,
status:'draft'|'published', createdAt, createdBy, publishedAt, updatedAt
```
Root-per-project, like other portal subcollections. Client portal renders **published** updates only.
Firestore rules: team read/write; client-portal read of published only (no admin fields exposed).

## A. Studio admin — the composer (Cindy-facing), with AUTO-DRAFT
New action on the Studio project page (near "Post What's New"): **"New Bi-Weekly Update."** On open it
**auto-drafts** from existing data for the last ~14 days, then Cindy edits every field and Publishes:
- **In Progress** ← active room boards for the project (room name, a hero image from the room board, editable %,
  the lead item + a short note). Reuse the Follow-Ups/board assembler pattern for gathering.
- **Awaiting Approval** ← open `clientDecisions` (status open/changes_requested) + client-pending selections;
  each with its product image; flag the ones that truly need a decision.
- **Material Palette** ← confirmed/approved selections' materials/finishes (curated set, ~4-6).
- **Recently Completed** ← tasks completed + decisions approved in the period (with a thumbnail).
- **Coming Up** ← tasks with due dates in the next two weeks.
- **Cover image (hero)** ← selectable PER UPDATE (`heroImageUrl`): a full-bleed cover photo behind the
  "Designing Your Story at {Project}" title, exactly like the portal Home hero. Seed from the project's
  `heroImages`; Cindy can swap to any room-board photo or upload. **Always render a navy→warm gradient veil
  over it** (per mockup) so the white title + gold subtitle stay legible over any image.
- **Highlight** ← Cindy picks a design-board rendering / room photo; caption editable.
- **Greeting** ← template with the client's first name, and a **per-client tone/formality setting** (e.g.
  "Hi {First}" vs "Dear {First}", casual vs formal close like "Talk soon" vs "With warmth"). Store the
  preferred greeting style on the client/project record so the auto-draft opens in the right voice for each
  client (some are close friends, some formal). Cindy can always override per update.
Everything is editable: swap any image (from room boards / renderings / uploads), adjust %, reorder, remove
items, reword. Save as **draft**; **Publish** writes status=published + publishedAt and drops a portal
timeline/What's New entry. (Email send is a later phase — portal is the source of truth now.)

## B. Client portal — the Updates page (client-facing)
- New **"Updates"** nav item. Landing = list of published updates, newest first (each row: period + hero
  thumbnail + title). Clicking one opens the **full-width landscape update page** per the mockup.
- The **latest** published update also surfaces on **Home** (a hero teaser / "Your latest update" card linking in).
- Full history stays browsable — this is the "bi-weeklies live here" requirement.

## HARD constraints
- **Never show POs, rates, margins, dollar amounts, time-entry dollars, or team names** in any client update
  (BUGS #93 + Vanessa-financials rule). Curated, gift-like, story-first.
- Client-portal isolation: `.cp-` scope, no admin controls/edit buttons visible to clients, no Studio nav.
- Programa: white/navy/gold, Playfair + DM Sans, 1px borders, **no border-radius, no shadows, no emojis in
  headers**, generous whitespace.
- Never split index.html; `node --check` + verify tail after each edit; regenerate client.html via the script.

## Acceptance (binary)
1. Studio: "New Bi-Weekly Update" opens a composer PRE-FILLED (auto-drafted) from room boards, open decisions,
   confirmed selections, and tasks; every field editable; Save draft + Publish both work.
2. Publishing writes a `progressUpdates` doc (status=published) and adds a portal timeline entry.
3. Client portal shows an "Updates" tab listing published updates; opening one renders the full-width landscape
   page matching the mockup (hero, room photos + ring badge, highlight, approvals, palette, completed, coming up).
4. Latest update surfaces on the portal Home.
5. No POs / rates / margins / dollar amounts / team names anywhere in the client view.
6. Drafts are NOT visible to the client.
7. `node --check` passes, index.html tail intact, client.html regenerated; zero console errors.

## Verify (Claude, staging)
As admin: auto-draft an update on Rolling Hills, confirm it pre-fills, edit + publish. As client (preview):
open Updates, confirm the landscape page renders and matches the mockup, confirm no financials, confirm a draft
is hidden. Screenshot admin composer + client page to loop/verify/WO-021/.

## Phase 2 (not now)
Email render of a published update (reuse the layout, {{PORTAL_URL}} → the portal update); scheduled reminder
to publish every two weeks; auto-select the highlight.

## DONE note
loop/WO-021_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
