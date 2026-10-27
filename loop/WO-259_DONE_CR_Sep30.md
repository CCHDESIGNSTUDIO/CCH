# WO-259 DONE — Send-to-client dialog closes on Open Email

Cindy Sep 30 INV-6068: Invoice Sent to Client stayed open after Open Email to Tracey.

## Grounding

- Dialog is built in `_sendDocToClient` (`platform/index.html` ~47251).
- Open Email calls `cchOpenInvoiceClientEmail` in `platform/cch-square-pay.js` ~493. It opened the mailto draft and left the dialog up.

## Change

- Dialog element id `cchInvoiceSentModal`.
- After the mail draft opens, that dialog is removed.
- Copy email text still leaves the dialog open.
- Cache buster `cch-square-pay.js?v=20260930mailclose` in `platform/index.html` and `platform/client.html`.
- `CCH_BUILD` 9.9.370 `send-email-closes`.

## Self-test

- `node --check platform/cch-square-pay.js` passed.
- Not deployed.
