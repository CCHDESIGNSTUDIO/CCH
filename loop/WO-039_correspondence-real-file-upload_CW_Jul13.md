# WO-039 · Log Correspondence: add real file upload (not just paste-a-URL) · CW Jul 13
**Change ID:** pending #1 assign (COMM) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
`platform/index.html`. **Staging first; prod on Cindy GO.**

## What Cindy said (Jul 13, project cbh Communications → Log Correspondence)
"How is this supposed to actually work, and no attachments worked." The "Attachment URLs (OneDrive, SharePoint,
etc.)" field is **paste-a-link only** — it has no file uploader, so trying to attach an actual file does nothing.
Every other doc surface in Studio has a real Upload button; this modal doesn't. Add real upload here.

## Grounding (confirmed)
- Correspondence modal: `showNewCorrespondenceModal(projectId)` @index.html:76917; the attachment field is
  @76977 (label "Attachment URLs (OneDrive, SharePoint, etc.)", `+ Add another link`), URL-only.
- Save: `saveCorrespondence(projectId)` @77015 writes to `boards/{projectId}/correspondence` @77056; attachments
  are stored as an `attachmentUrls[]` array (see portal reads @67231, @71789).
- Existing Storage-upload patterns to reuse: `uploadProjectFiles(projId, files)` @15977/@19969,
  `attachUploadToDocAndProjectFiles(projectId, collection, docId, input)` @20572, and the generic
  `uploadImageToStorage(...)` used across the app. These already put files in Firebase Storage and return a URL.

## Change
1. In the Log Correspondence modal, add a real **Upload file** control (`<input type="file" multiple>`) next to
   the "Attachment URLs" paste field. Keep the paste field (external OneDrive/SharePoint links are still valid).
2. On file select, upload to Firebase Storage under `boards/{projectId}/correspondence/{ts}-{safeName}` (reuse the
   existing upload helper — do NOT invent a new Storage path convention), show a small uploading state + a
   thumbnail/filename chip per uploaded file, and push each resulting download URL into the same `attachmentUrls[]`
   array that `saveCorrespondence` already persists. So uploaded files and pasted links coexist in one list.
3. Non-image files (PDF, docx, eml) are allowed — accept any type; show a filename chip with a paperclip for
   non-images and a thumbnail for images.
4. Render the saved attachments on the Communications timeline row (filename/thumbnail, click to open the URL),
   consistent with how `attachmentUrls[]` is already read.
5. Guard: file-picker onclick/handlers must use the escaped attribute pattern (don't reintroduce the
   onclick quote-collision bug we're fixing elsewhere).

## Acceptance (binary)
1. In Log Correspondence, an admin can upload a file (image or PDF/doc); it uploads to Storage, shows a chip, and
   after Save appears as an attachment on the correspondence entry.
2. Pasted URLs still work and coexist with uploaded files in the same list.
3. Attachments render on the Communications timeline and open correctly. No console errors.

## Verify (Claude, staging)
Log a correspondence entry on a staging project, upload a PDF + an image + paste a URL, Save, confirm all three
attach and open from the timeline. Screenshot to loop/verify/WO-039/.

## Note (not this WO)
The bigger "make this automatic" ask is the roadmap **Outlook Email Integration** — auto-pull vendor/client
emails into this log instead of manual entry. This WO just makes manual attachments actually work.

## DONE note
loop/WO-039_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
