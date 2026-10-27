# Session Log — Cursor: Builder restore-draft prompt (WO-167)

**File:** SESSION_LOG_Cursor_2026-09-02.md  
**Original Author:** Cursor (CR)  
**Created:** September 2, 2026  
**Last Modified:** September 2, 2026  
**Last Modified By:** Cursor (CR)  
**Version:** 1.3

**Workspace:** `CCH-Platform-Deploy`  
**Primary paths:** `platform/builder/index.html`  
**Firebase:** **PRODUCTION hosting 2026-09-02 ~15:35** Cindy GO (`hosting:platform` / `cch-design-boards`). Builder rev `2026-09-02wo167-draft-prompt` confirmed live. Studio **9.9.310** also live (working-copy deploy). No git commit. Functions and firestore.rules not deployed.

## Session overview

Cindy sent Vanessa’s screenshot: Chrome `cch-platform.web.app says` restore-unsaved-draft after Save on GRE-W-10. That is Builder localStorage crash recovery, not a failed save. Cindy GOed production (not staging — cannot reproduce off prod data).

## What changed

### WO-167 — PRODUCTION

`platform/builder/index.html`: do not keep/rewrite a browser draft after a clean project Save; do not flush a draft when switching WOs unless there are edits since Save; drop drafts that are not newer than last Save / Firestore `updatedAt`; replace native `confirm()` with `cchConfirm`. Meta rev `2026-09-02wo167-draft-prompt`.

### WO-169 — queued staging (not deployed)

`platform/builder/index.html`: Source = Vendor keeps Manufacturer / vendor name; preview prints it; do not strip vendor on Vendor-supplied rows; restore Materials scroll; Role Label no longer rebuilds the form. Rev **2026-09-02wo169-vendor-keep**. `#1` via `_DEPLOY_QUEUE.md`.

### WO-168 + WO-173 — queued staging (this pass)

Same file. Spec notes always under Specs; spec photos in Details only; Clear keeps the note. Material Role dropdown at top of each row. Rev **2026-09-02wo173-builder-full**.

### WO-175 — queued staging (this pass)

Same file. New Revision kept creating a new Firestore doc and bumping Rev only in memory after write; Date never changed. Now same WO, Rev +1, Date = today, persist, form + preview. Rev **2026-09-02wo175-new-rev-date**. Includes WO-174 (one Role / Face) in the same file.

## Open items

- **WO-177 + WO-178 PRODUCTION** 2026-09-02 ~17:06 Cindy GO. Header **2026-09-02wo178-wo-list-rev**. Existing WO picker shows Date + Rev; Clear detail image persists.
- **Not in this file:** Share/client links still use `cch-platform.web.app` until CCHSTUDIO origin rewrite + Connected domain.
- Vanessa: hard refresh Builder (Ctrl+Shift+R), Save, switch WO — no Chrome confirm. Click **Cancel** if an old dialog is still on screen from before refresh.
- Studio sidebar will show **v9.9.310** (shipped in the same hosting pass).
- WO-046 firestore.rules still not deployed.
