# WO-417 DONE — Spec Book PDFs save and download

Cindy Nov 11. Holtz Hill Spec Book. A PDF spec sheet would not save. She also wants each spec downloaded on its own, and all of them together.

## Grounding

- Upload: `platform/index.html` `_specBookUploadDocs` stores under Storage `specbook/{project}/{item}/{file}`.
- `storage.rules` `match /specbook/` used `allowedImageWrite()`, which allows images only. A PDF was rejected.
- Book record: `_specBookExport` writes `boards/{project}/specBooks`. `firestore.rules` had no match for `specBooks`, so the write was denied and only logged in the console.

## Change

- `storage.rules` specbook path now uses `allowedProjectWrite()` (PDF, images, office files, 32MB).
- `firestore.rules` adds `boards/{projectId}/specBooks/{docId}` read/write for a signed-in studio user.
- Spec Book Items and Review: **Download spec** on an item that has a sheet. **Download all specs** downloads every sheet on the selected items.
- The attached-document row has its own **Download**.
- If the book record still fails to store, a warning toast says so.
- Studio **9.9.494** / `spec-pdf-download`.

## Surfaces

Spec Book only. Proposals, invoices, POs, and tear-sheet print CSS were not changed.

## Self-test

Read-back of the rules and the download buttons. Not clicked in the browser. Needs a rules deploy plus hosting before Holtz Hill can keep a PDF.
