# WO-217 DONE — QPI folder: vendor estimates internal; import from QPI

**Change ID:** 9.9.338  
**Date:** 2026-09-09  
**Executor:** Cursor  
**State:** DONE-UNVERIFIED (staging)

Cindy Sep 9: Vanessa +Upload on PRO-3044 mirrored Lutron/Somfy option PDFs to Files/Contracts and the client portal. Intended workflow: **upload to QPI, then select from QPI** to create vendor lines. Uploading a PDF to import lines must not save it on the proposal.

## Surfaces

| Intended | Must not |
|----------|----------|
| Files & Docs **QPI** tab (studio) | Client portal Shared Documents |
| Import vendor bid pick/upload | Proposal / invoice `attachments` |
| Filename detect: estimate / quote / bid / option PDF | Client drawings named only “proposal” |

Print/PDF of proposals, invoices, POs, tear sheets: **untouched**.

## Diagnosis (file:line)

- `docAttachmentShelfCategory('proposals')` → `'Contracts'` (`index.html` ~23745). `cchRegisterProjectFileFromDocAttachment` (~23785) then `cpBuildMergedPortalDocuments` (~76315) included every `boards/{id}/files` row unless `internal` / `hideFromClient`.
- `_vendorBidAttachPdf` (`cch-vendor-bid-import.js` — removed) wrote the PDF onto `prop.attachments` after import.

## Change

- Files shelf tab **QPI**. Uploads on that tab (or vendor-looking names) set `category:'QPI'`, `internal:true`, `hideFromClient:true`.
- Portal merge skips QPI even if flags are missing (`cchPortalShouldSkipStudioFile`; `client.html` category check).
- No Publish / Share with client / Share with contractors on QPI rows. Publish and Share-Document picker refuse QPI.
- Proposal/invoice +Upload and From Files: vendor-looking PDFs go to QPI only (toast). QPI files cannot be attached to proposals/invoices.
- Import vendor bid: list QPI PDFs, or **Upload to QPI**, then parse. Commit does **not** attach the PDF to the proposal.
- Parser: `desc qty unit total` uses the **last** money as line total (2 @ 120.00 110.00 → qty 2, amount $110, unit $55).

## Files touched

- `platform/index.html` — `CCH_BUILD` 9.9.338; QPI helpers ~23623–23810; Files tab; upload; attach; portal merge; share picker; `cch-vendor-bid-import.js?v=20260909qpi217`
- `platform/cch-vendor-bid-import.js` — QPI picker; no proposal attach
- `platform/client.html` — portal merge skip QPI

## Self-test

- `node --check platform/cch-vendor-bid-import.js`
- Parser: `Motor 2 120.00 110.00` → qty 2, amount 110, unitCost 55
- index.html ends `</html>`

## Verify (after staging deploy)

Hard refresh https://cch-platform-staging.web.app — sidebar **9.9.338**.

1. Project Files: QPI tab → upload a vendor PDF → `internal` / not on portal.
2. Proposal → Import vendor bid → pick that QPI file → lines preview → Import selected → PDF **not** on proposal Attachments.
3. Proposal +Upload of `Lutron Option.pdf` → toast QPI, not on Attachments.
4. Client portal Shared Documents does not list QPI files.

**Do not** recategorize Greene-Hixson prod files in this WO. Optional later: move those five PDFs into QPI and drop them from `attachments` (backup first).

## Production

Staging only. No same-session production GO.
