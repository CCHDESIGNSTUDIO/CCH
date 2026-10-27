# FOR CLOUD CODE — verify WO-255, WO-256, WO-257

Cindy GO 2026-09-30 ~12:32 PT. Cursor #1 deployed hosting only to production (`cch-design-boards`). Live build confirmed **9.9.368** `proposal-footer-tax` at https://cch-platform.web.app.

Audit only. Do not edit, commit, or deploy. Write `loop/FROM_CLOUDCODE_VERIFY_WO-255-256-257_Sep30.md` with PASS / FAIL / NEEDS CINDY per WO.

Compared to the previous live file (9.9.365), the deploy delta was only these three. Other dirty files in the working copy already matched production and were not a new change.

## WO-257 — proposal footer tax
- File: `platform/index.html` `renderProposalDetail` footer, ~35719.
- Uses `cchDocumentSalesTaxRate('proposal', prop, proj)`.
- Click: hard refresh https://cch-platform.web.app/#/project/cloud-rolling-hills/proposal/JdDenfQ5D8lidtacvdyS/edit
- Expect: Tax (9.75% on $4,992.60) **$486.78**. Total **$5,479.38**.
- Declined cabinets stay out of the subtotal. Mirror credits stay in.
- Do not change the stored proposal total. Invoices and POs were not in this footer change.

## WO-256 — library search order
- File: `platform/index.html` `renderLibraryView` sort, ~67922.
- Search no longer sorts by `librarySearchRelevanceScore`. Same sort as the list: date added, newest first.
- Click: hard refresh Product Library. Note the first rows with the search box empty. Search a vendor. First rows should be the newest date added, same order as the empty list filtered to that vendor.
- The catalog still loads in batches of 500. The first paint is the newest of what has arrived.

## WO-255 — client Pepper
- File: `platform/cch-client-pepper.js`. Cache `cch-client-pepper.js?v=20260928elise` in `platform/index.html` and `platform/client.html`.
- Spoken line clipped to 300 characters. Browser male fallback removed (`speakPepperBrowserFallback` is gone on live).
- Click: hard refresh a client portal. Button should say Hear Pepper. Greeting should be Elise, not the computer man. If autoplay is blocked, the next click should play Elise. If ElevenLabs is down she stays silent.

## Source check already done by Cursor (not a click test)
- Live `CCH_BUILD` is 9.9.368 `proposal-footer-tax`.
- Live index contains `cchDocumentSalesTaxRate('proposal', prop, proj)`.
- Live index does not contain the old relevance sort call.
- Live pepper script has `clipPepperSpeakLine` and does not contain `speakPepperBrowserFallback`.
