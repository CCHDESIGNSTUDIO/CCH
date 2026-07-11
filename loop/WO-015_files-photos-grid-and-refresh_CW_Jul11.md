# WO-015 · Files & Docs: Photos thumbnail grid + fix post-upload refresh (final renderings home) · CW Jul 11
**Change ID:** pending #1 assign (BF) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)

## What Cindy asked (Jul 11, on Rolling Hills → Files & Docs → Photos)
Two things: (1) "Can Photos be a grid/list with thumbnails?" (2) "I had to refresh to be able to see it — we
want to upload final renderings here." So the Photos shelf is the intended home for final renderings; it
should show image thumbnails, and newly uploaded files must appear immediately (no manual refresh).

## Grounded (verified in index.html this session)
- **`renderFilesTab(T, proj)` :15123** loads `boards/{id}/files` (`orderBy createdAt desc`), category chips
  `['All','Contracts','Drawings','Specifications','Invoices','Photos','Other']` (:15136), current filter
  `window._fileFilter`. Rows render as a flat vertical list (`.proj-file-list-shell`, :15168) with an emoji
  icon (📷 for Photos, :15176) — **no thumbnails**.
- Each file has a real image URL: `studioProjectFilePublicUrl(f)` / `f.downloadUrl || f.url` (:15183),
  `mimeType` (:19377), `category` (:15171 `projectFileShelfCategory`).
- **Refresh bug:** `uploadProjectFiles(projectId, fileList, shelfHint)` :19361 uploads to Storage, writes the
  `files` doc, `showToast(...)`, then calls **`loadProjectFiles(projectId)` :19397 — which does NOT re-render
  the Files tab** the user is viewing. That's why Cindy had to refresh. The `<input>` onchange is at :15159.

## Changes
### A. Fix the post-upload refresh (the "had to refresh" bug)
After `uploadProjectFiles` finishes its loop + toast, **re-render the Files tab** so new files show at once.
Simplest correct fix: after the toast, if the user is on the files tab, call `renderProjectDetail()` (or
`renderFilesTab(document.getElementById('projectTabContent'), {id:projectId})`) in addition to / instead of
`loadProjectFiles`. Also refresh the Files & Docs count badge (the "4" on the tab). Make the same re-render
happen for the other Upload File entry points that call `uploadProjectFiles` (:19636, :40847, :40948) if
they're on a view that lists files.

### B. Photos as a thumbnail grid (with a grid/list toggle)
When the active shelf is **Photos** (and for any image file — `mimeType` starts `image/`, or extension
png/jpg/jpeg/webp/gif), render a **responsive thumbnail grid** instead of the text row:
- Card = the image (object-fit: cover, ~200px cells, lazy-load), filename caption, date, and the same
  kebab menu (View / Publish / Print / Delete) + LINK/FILE and "On client Home" badges that the list row has
  (reuse the existing handlers — `openProjectStudioFile`, `cpAdminToggleDocDashboardPublish`, etc.).
- Provide a **Grid / List toggle** (persist in `window._filesViewMode` / localStorage). List = today's
  behavior (keep it for documents); Grid = thumbnails. Photos shelf defaults to Grid; document shelves
  default to List.
- Non-image files in a grid fall back to the category icon tile (don't try to `<img>` a PDF).

### C. Final renderings
No schema change needed — final renderings are image files on the Photos shelf. Just make sure large images
upload (they already go to Firebase Storage) and thumbnail well. Optional nicety (only if cheap): a subtle
"Final rendering" tag if `f.category==='Photos'` — but do NOT block on it; the grid + refresh is the ask.

## Constraints
- Reuse existing file handlers and `studioProjectFilePublicUrl`; do not fork the file data model.
- Navy/gold, no gray boxes; thumbnails on white cards; never split index.html; `node --check` + tail.
- Keep the client-portal Publish behavior intact (kebab → Publish still works from a grid card).

## Acceptance (binary)
1. Upload a photo on Files & Docs → it appears immediately, no manual page refresh; the tab count updates.
2. The Photos shelf shows image thumbnails in a grid; a Grid/List toggle switches views and persists.
3. Grid cards keep View / Publish / Print / Delete and the FILE/On-client-Home badges.
4. Document shelves (Contracts, Specs, Invoices, Other) still render as the list (or via the same toggle).
5. A large final-rendering PNG uploads and thumbnails correctly.
6. `node --check` passes, tail intact, zero console errors.

## Verify (Claude, staging)
Rolling Hills → Files & Docs: upload an image, confirm instant appearance + thumbnail grid + toggle; confirm
kebab actions and Publish still work from a card. Screenshot grid + list to loop/verify/WO-015/.

## DONE note
loop/WO-015_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
