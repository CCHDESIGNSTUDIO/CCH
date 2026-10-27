# Session Log — Cursor: WO-204 / WO-205 / WO-206 / WO-207 / WO-208

**File:** SESSION_LOG_Cursor_2026-09-08.md  
**Original Author:** Cursor (CR)  
**Created:** September 8, 2026  
**Last Modified:** September 8, 2026  
**Last Modified By:** Cursor (CR)  
**Version:** 1.5  

**Workspace:** `C:\dev\CCH-Platform-Deploy\cch-deploy`  
**Firebase production:** `cch-design-boards` → https://cch-platform.web.app  

## Session overview

Cindy requests: (1) Neolith Basalt finish/dims; (2) PO-9054 Edit image; (3) Vanessa Timely Dec–Mar pending; (4) PO-9049 shipping in the line + Confirm must copy PO shipping; (5) Rolling Hills Order Management variances still Ready after invoicing; (6) PO image still not saving after 9.9.330 production (WO-210).

## What changed

### WO-204 (production Firestore — no hosting)

Script: `_scripts/wo204-rh-neolith-basalt-po-finish-dims_BY_CURSOR_2026-09-08.js --apply`  
Copied library finish + dims onto 6 Basalt Black lines on PO-9053 and PO-9045.

### WO-205 (code — staging queue)

`platform/index.html` **9.9.325** — Edit image is a real file-picker button.

### WO-206 (code — staging queue)

`platform/index.html` **9.9.326** — Vanessa Timely rows dated before 2026-04-01 are Closed.

### WO-207 (code — staging queue)

`platform/cch-po-bill-variance.js` + `index.html` **9.9.329** — Confirm copies PO shipping (Est. freight prefills). Line total is merchandise; shipping below. Do not re-enter freight on confirmation.

### WO-208 (code — staging queue)

Same JS file as WO-207 (`?v=20260908ship1`). Ready to bill hides freight/price-increase already on a client invoice. Prod evidence: INV-6063 Paid for PO-9030/31/34/35/9029/9037.

No commit. No production hosting.

### WO-210 (code — staging queue)

`platform/index.html` **9.9.331** — PO Edit image persists immediately. Firestore clip gallery no longer overwrites the new photo when the line editor opens.

## Open items

- WO-210 needs staging hosting. Sidebar should read **9.9.331**. Production needs Cindy typed **GO** (live is still 9.9.330).
- Invoice snapshot is separate — replace the photo on the invoice Edit if that document still shows the old image.

## Verify (after staging deploy)

```
https://cch-platform-staging.web.app
```

Ctrl+Shift+R, sidebar **9.9.331**. PO Edit → Edit image → Preview/Print shows the new photo after refresh. Production after GO for WO-210.
