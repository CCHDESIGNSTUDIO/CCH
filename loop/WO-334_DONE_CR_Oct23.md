# WO-334 DONE — Vendor bill override is an amount and a note

Cindy Oct 23. The vendor bill total at the bottom stayed $38,887.11 no matter what she typed. A price-change row replaces the typed amount with its own formula.

## Files

- `platform/cch-po-bill-variance.js`
  - Charge type `override` ("Override"). Amount and description (the note). No slab checkboxes. The formula does not replace the amount.
  - `cchPoViAmountTyped` — a number typed into Amount is the number added to the bottom total.
  - Ghost-charge filter does not drop an override.
- `platform/index.html` — Studio 9.9.419, `cch-po-bill-variance.js?v=20261023wo334`.

## Self-test

`node --check platform/cch-po-bill-variance.js` exited 0.

## Not deployed

Production only, after Cindy's GO. The page she has open will keep showing $38,887.11 until then.
