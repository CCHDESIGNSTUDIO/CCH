# WO-301 done — vendor bill closes on Save

Cindy Oct 15. Edit bill stayed open after Save. No X.

## Grounding

`cchPoSaveReceiveBill` in `platform/cch-po-bill-variance.js` wrote the bill, then awaited `cchPoPushBillToQB` before `cchPoCloseModal`. That QuickBooks question uses `cchConfirm`, default z-index 1200 (`platform/index.html` ~18569). The bill overlay is z-index 9000 (`cch-po-bill-variance.js` ~6507). The question opened under the bill, so Save looked like it did nothing. The header was a title only. Cancel sat at the bottom of the scroll.

## Change

- X on the bill header calls `cchPoCloseModal`.
- Save closes the bill as soon as the write succeeds, then asks about QuickBooks.
- The QuickBooks question uses z-index 10050.
- Opening the bill removes a leftover copy. Close removes every bill and pay overlay.

## Files

- `platform/cch-po-bill-variance.js` — modal header, close, save order, confirm z-index
- `platform/index.html` — Studio 9.9.387, cache `cch-po-bill-variance.js?v=20261015wo301`

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. Not checked in the browser. Not deployed.

Print CSS was not changed.
