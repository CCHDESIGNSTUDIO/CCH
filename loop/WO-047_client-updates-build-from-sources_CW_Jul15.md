# WO-047 · Client Updates: "Build from project" auto-draft from live sources · CW Jul 15
**Change ID:** pending #1 assign (UPD) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
`platform/cch-progress-updates.js` (+ `draftProgressUpdate` cloud fn for the AI pass). **Staging first; prod on Cindy GO.** This is the deferred WO-021 Phase A prefill.

## What Cindy said (Jul 15)
Back on the client Updates / bi-weekly: "get the update information from all the sources we talked about." (She initially asked for an uploader, then confirmed the existing per-slot upload is fine, so NO new uploader is in scope.) The live editor currently renders **seed demo data** (Game Room 62% / Living 55% / Master Bath 48%) with empty image slots, so nothing is coming from the project yet.

## Grounding (confirmed, cch-progress-updates.js)
- `cpPuDraftWithAI` @573 calls cloud fn `draftProgressUpdate`, but it only **rewords what is already in the form**: `puEditorContextNotes` @550 reads the current form fields, NOT the project. Percentages/images are preserved from existing state; nothing is pulled from room boards/decisions/selections/tasks. So the page shows seed data (`cpPuBuildSeedDoc` @263), just reworded.
- Field shape (from the seed + draft code): `inProgress[{room,item,note,percent,imageUrl}]`, `awaitingApproval[{name,sub}]`, `palette[...]`, `completed[{label}]`, `comingUp[{week,detail}]`, `greeting`, `highlight`.
- **Upload already exists per slot**: `puEditorImgSlotHtml` @685 renders **Upload** (`cpPuEditorUploadFile` @695/@996), **"From room / board"** (`cpPuEditorPickProjectImage` @696/@1243), and Clear. Reuse this upload path; do NOT invent a new Storage convention.
- Toolbar: `cpPuRenderStudioToolbar` @520 (where the new "Build from project" button goes). Editor body: `puEditorRenderBody` @707 (where the bulk uploader goes).
- Data sources: **Follow-Ups assembler in `cch-followups.js`** already gathers per-project boards/decisions/tasks/whatsNew/invoices read-only (per CLIENT_COMMS_BIWEEKLY_MAP) — reuse it as the source. Tasks = `collection('tasks')` (index.html:18837+). Decisions live on the portal (locate the real store; no `collection('decisions')` literal in index.html, so find where Decisions are read).

## Change — Phase 1: "Build from project" prefill (the #1 ask)
1. Add a **"Build from project"** button in the Updates editor toolbar (`cpPuRenderStudioToolbar` @520), beside the AI draft button.
2. On click, assemble a draft from LIVE project data (reuse the `cch-followups.js` per-project assembler + direct reads), mapping sources -> Update sections:
   - **In Progress**: each active room (Room Boards) -> `{room, item = the room's hero/current focus clip title, note, imageUrl = the room board's hero image, percent = SUGGESTED from that room's selection approval ratio (approved+ordered / total), editable}`.
   - **Awaiting Your Approval**: open **Decisions** -> `{name, sub}`.
   - **Material Palette**: **confirmed/approved Selections** finish/material/color -> swatches.
   - **Recently Completed**: **Tasks** completed in the period (and/or clips marked installed) -> `{label}`.
   - **Coming Up**: upcoming **Tasks** with due dates in the next ~2 weeks -> `{week, detail}`.
   - Prefill greeting name from `clientName`, period from the current two-week window.
3. Feed the assembled draft to the existing `draftProgressUpdate` AI pass so the PROSE reads in CCH voice (extend `puEditorContextNotes` to carry the real assembled data, not just the form). **Keep the assembled percentages + images + structure; the AI rewrites wording only, never overwrites data.**
4. Populate the editor for Cindy to review/edit, then Save draft / Publish (existing WO-028 flow). **Never auto-publish.**
5. **HARD client-safety rules** (CLIENT_COMMS_BIWEEKLY_MAP + Vanessa gate): NO POs, NO rates, NO margins, NO cost, NO team names, NO raw time entries. Curated, client-safe fields only. Programa navy/gold; `.cp-` isolation; no native dialogs.

## Images (no new uploader)
Image handling stays as-is: the prefill auto-populates each In Progress slot with the room board's hero image, and Cindy swaps any of them with the EXISTING per-slot controls (Upload / "From room / board" / Clear, `puEditorImgSlotHtml` @685). No bulk/drag-drop uploader in scope (Cindy: "we can upload images ourselves").

## Acceptance (binary)
1. "Build from project" on a staging project fills In Progress rooms (WITH room-board hero images), Awaiting Approval from open decisions, Palette from confirmed selections, Completed + Coming Up from tasks. NOT seed data.
2. A suggested % shows per room (from the selection approval ratio) and is editable (WO-028 % edit still works).
3. The AI pass rewrites greeting/notes in CCH voice without wiping the assembled rooms, %, images, decisions, palette, tasks.
4. Existing per-slot image controls (Upload / From room-board / Clear) still work on the prefilled slots.
5. No client-forbidden data anywhere (rates/POs/margins/cost/team/time). Save-draft/Publish gate intact; never auto-publishes. No console errors.

## Verify (Claude, staging)
Build-from-project on a staging project (Rolling Hills-like), confirm each section is real data + real room images (not seed), edit a %, run the AI polish and confirm data survives, swap an image via the existing control, Publish, then view as the client. Screenshots to loop/verify/WO-047/.

## Open sub-decisions (defaults chosen)
- Room % source: default = suggested from selection approval ratio, editable. If Cindy prefers %, stays purely manual, drop the derive step.
- "Recently completed" source: default = completed Tasks in-period; can also include clips marked installed if that status exists.

## DONE note
loop/WO-047_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
