# WO-028 · Client Portal Bi-Weekly Update — Studio editor: upload/swap images + edit all text (Phase B core) · CW Jul 12
**Change ID:** pending #1 assign (PU) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
**Client-facing data, Studio-only UI.** Programa aesthetic on the client render (unchanged). **Staging only. Pause for Cindy's GO. Do not deploy to production.**
Consult the `cch-client-portal` skill. Builds on WO-021 Phase A (`cch-progress-updates.js` build 20260712pu3).

## What Cindy said (Jul 12, viewing the seeded February update on staging)
"I need to be able to upload images and edit comments — otherwise it looks great."
The landscape page renders correctly, but every image slot is an empty sage placeholder (seed ships all
`imageUrl` blank) and all the copy is seed text. She needs a Studio-side editor to drop in the real renderings
and reword the captions, then re-publish.

## Grounding (confirmed — `cch-progress-updates.js`)
- Data model = subcollection `boards/{projectId}/progressUpdates/{updateId}`. Field shape is exactly
  `cpPuBuildSeedDoc()` @cch-progress-updates.js:202-253:
  `title, period, periodStart, periodEnd, greetingName, greetingStyle('hi'|'dear'), greetingBody, heroImageUrl,
  inProgress[]{room,imageUrl,percent,item,note}, highlight{imageUrl,heading,body},
  awaitingApproval[]{name,sub,imageUrl,needsDecision,decisionId?}, palette[]{name,imageUrl},
  completed[]{label,thumbUrl}, comingUp[]{week,detail,soft}, signName, signRole, status, publishedAt,
  createdAt, createdBy, updatedAt`.
- Phase A shipped **render + seed only** (`cpPuRenderList` :270, `cpPuRenderDetail` :292, `cpPuRenderHomeTeaser`
  :383, `cpPuEnsureSeed` :255). **There is no editor** — that's this WO.
- Every image slot in the renderer reads a plain URL string through `puImgBlock(url,...)` :170-173 (falls back to
  the sage gradient when empty). So the editor just needs to write durable URLs into those fields.
- Client render is isolated (`.cp-` / client.html generated). The editor must live in **index.html's Studio
  project render**, NOT in the client bundle. `client.html` is regenerated via `_scripts/generate-client-html.js`
  only if the client-side changes; the editor is Studio-side so client.html likely needs no change (confirm).

## Scope THIS WO (the practical core Cindy asked for)
Manual editor for a progressUpdate doc — create-new and edit-existing (incl. the February seed). **Auto-draft
prefill from room boards / decisions / tasks stays deferred** (that's WO-021 §A Phase B-full; note it, don't
block on it). Cindy fills the update herself for now.

### A. Entry point (Studio, admin only)
On the Studio project page, near "Post What's New" / the Updates area, add **"New Bi-Weekly Update"** and, on
each existing update row (Studio view), an **"Edit"** affordance. Admin-gated (`ADMIN_EMAILS`); never rendered
in the client portal view.

### B. Editor — every field editable
Text inputs for: title/period (or start+end date pickers that compose the period label), greeting name +
greeting style toggle (Hi / Dear) + greeting body, highlight heading + body, sign name + role. Repeatable-row
editors (add / remove / reorder) for: **In Progress** (room, item, note, percent 0-100 slider/number),
**Awaiting Approval** (name, sub, "needs decision" checkbox), **Material Palette** (name), **Recently
Completed** (label), **Coming Up** (week, detail, "soft/tentative" checkbox). Empty rows removable so she can
trim the seed's placeholder lists.

### C. Image upload / swap on EVERY image slot
Each image field gets an upload control **and** a swap-from-existing picker:
- Slots: `heroImageUrl` (cover), each `inProgress[].imageUrl`, `highlight.imageUrl`, each
  `awaitingApproval[].imageUrl`, each `palette[].imageUrl`, each `completed[].thumbUrl`.
- **Upload:** reuse the platform's existing Firebase **Storage** upload used for room-board / hero images so the
  URL is durable and CORS-clean (cite the helper you reuse — e.g. the room-board photo upload or
  `uploadProjectFiles` storage path). Store the resulting download URL in the field. Do NOT invent a new bucket
  path convention; follow the existing one (e.g. `boards/{projectId}/progressUpdates/...`).
- **Swap-from-existing:** let Cindy pick an image already in the project — room-board photos / renderings /
  `heroImages` — and drop its URL in (per WO-021: "swap any image from room boards / renderings / uploads").
  Upload is the MUST; the picker is strongly preferred since most renderings already live on the boards.
- Show a thumbnail preview of the current image in each slot; allow clear/remove (back to placeholder).

### D. Save / Publish
- **Save draft:** write the doc with `status:'draft'`, set `updatedAt`; drafts stay hidden from the client
  (renderer already filters to published, :192/:273).
- **Publish:** set `status:'published'` + `publishedAt`; drop a portal What's New / Communications timeline entry
  the same way WO-021 specifies (reuse `cpAdminOpenWhatsNewModal` pattern @index.html:69229). Re-publishing an
  edited update updates in place (same doc id), not a duplicate.
- Writes go to `boards/{projectId}/progressUpdates/{id}`. For the February seed, edit the existing
  `sample-february-2026` doc in place.

## HARD constraints (unchanged from WO-021)
- Never show POs, rates, margins, dollar amounts, time dollars, or team names in the client update. The editor
  is Studio-only; the client render stays exactly as Phase A shipped it.
- Programa on the client side; `.cp-` isolation; no admin/edit controls ever visible in the client portal view.
- Never split index.html; `node --check` on cch-progress-updates.js (and any touched JS); verify tail after each
  edit; regenerate client.html via the script ONLY if a client-side file changed.

## Acceptance (binary)
1. As admin on Rolling Hills: open the February update in an editor, **upload a rendering** into a Game Room /
   Living Room / Master Bath card and into the Highlight and cover — the placeholders are replaced by the images
   on the published client page.
2. Edit the greeting body and a room note, Publish, and the client view shows the new text.
3. Add and remove a Coming Up row and an Awaiting Approval row; changes persist and render.
4. "Needs decision" checkbox on an approval card renders the gold-edged treatment on the client page.
5. Draft save keeps it hidden from the client; Publish makes it visible and drops a timeline entry; re-publish
   edits in place (no duplicate).
6. Editor is invisible in the client portal view; no financials/team names leak.
7. `node --check` passes; index.html tail intact; zero console errors.

## Verify (Claude, staging)
As admin: edit the Feb seed — upload images to every slot type, reword greeting/notes/highlight, add+remove
repeatable rows, Save draft (confirm hidden), Publish (confirm visible + timeline entry). As client preview:
confirm images render, no placeholders, no financials. Screenshot editor + client page to loop/verify/WO-028/.

## Deferred (call out, don't build here)
Auto-draft prefill from room boards / open decisions / confirmed selections / tasks (WO-021 §A) — the composer
opening pre-filled. This WO is the manual editor that makes the page real now; auto-draft is the next pass.

## DONE note
loop/WO-028_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
