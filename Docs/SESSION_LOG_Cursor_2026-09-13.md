# Session Log — Cursor: WO-225 tear sheet Hero only

**File:** SESSION_LOG_Cursor_2026-09-13.md  
**Original Author:** Cursor (CR)  
**Created:** September 13, 2026  
**Last Modified:** September 13, 2026  
**Last Modified By:** Cursor (CR)  
**Version:** 1.0  

**Workspace:** `C:\dev\CCH-Platform-Deploy\cch-deploy`  
**Firebase production:** `cch-design-boards` → https://cch-platform.web.app  

## Session overview

Cindy generated Cloud Rolling Hills invoice tear sheets, chose **Hero only**, and still got Filmstrip 3A with four empty gray boxes (Hex Lantern, Large Rec Glass Lantern sconce).

## What changed

### WO-225 — Studio 9.9.345 — staging pending

`platform/index.html` `_tearSheetPageHtml3A` / `_tearSheetPageHtml3B`: omit the side strip when `imageMode === 'hero'` or there is no second photo. Hero uses full width.

**Not deployed.** Queued in `_DEPLOY_QUEUE.md` STATUS: pending. Staging first. No production GO this session.

## Verify after staging

Hard refresh. Sidebar **9.9.345**. Invoice Generate Tear Sheets → Hero only → one large photo, no gray column. A 5-photo line on 3A still shows the filmstrip.

## Open items

- Staging deploy of 9.9.345 by #1
- Production only after Cindy typed GO
