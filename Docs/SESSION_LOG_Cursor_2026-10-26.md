# Session log — Cursor — 2026-10-26

## Overview

Cindy could not read the dollar amounts in the top-right Totals card on an invoice. WO-347 makes those amounts larger. Staging only until she types GO.

## What changed

- `platform/cch-proposals-invoices-fix.js` — totals amounts 11px to 14px. Total and Balance 16px. Applied payment lines 13px. Color and font unchanged.
- `platform/index.html` — Studio 9.9.430, tag `rail-totals-size`. Cache `cch-proposals-invoices-fix.js?v=20261026wo347`.

## Not deployed to production

WO-347 is staging. Production stays 9.9.429 until her typed GO. Functions not deployed. No commit.

WO-348. Bill variances. Ready to bill was empty and the Pass on buttons were off the right edge, so nothing could be checked. Open charges can be checked. Pass on and Bury sit on the line. The table wraps. Studio 9.9.431. Cindy GO. PRODUCTION hosting ~12:55. Live was 9.9.429. Live confirmed 9.9.431 and cch-po-bill-variance.js?v=20261026wo348. Also includes WO-347 totals size. Functions not deployed. No commit.

WO-349. Bury redraws Bill variances and cleared every checkbox she had already set. The other checks are restored. The buried line stays off. Studio 9.9.432. Staging. Included again in 9.9.433.

WO-350. PO row Status printed the stored code refund_due_client. That code is no longer shown. Studio 9.9.433. Staging. Included again in 9.9.434.

WO-351. Pass on and Bury redrew Bill variances and the list jumped to the top. Scroll is put back. Studio 9.9.434. Staging. Folded into 9.9.435.

WO-352. Variance lines on a client invoice. Vendor is the title. The reason is named once. She edits the description. Tax this line is her checkbox. Opening a draft that is not in QuickBooks rewrites the old “PO …” titles. Amounts stay. Studio 9.9.435. Staging.

WO-353. The red Bill Variances count is only lines still waiting for Pass on or Bury. Buried, passed on, and pre-paid tax are not in it. Studio 9.9.435. Cindy GO. PRODUCTION hosting ~14:16. Live was 9.9.431. Live confirmed 9.9.435. Also includes WO-349, WO-350, WO-351, and WO-352. Functions not deployed. No commit.

Airtable was not part of the 9.9.435 deploy. WO-354: save, email vendor, and Received now push that one PO. Studio 9.9.436. Staging. Functions not deployed. Production waiting on GO.

WO-355. Variance list. Pass on and Bury no longer reload the page. A note on the line becomes the invoice description, and updates a draft invoice that already has the line. The amber amounts on that list are navy. Studio 9.9.437. Staging. Folded into 9.9.438.

WO-356. Price increase is Price/quantity increase on the bill and on Bill variances. The reason typed on the bill fills the variance note and the invoice description. Studio 9.9.438. Staging. Folded into 9.9.439.

WO-357. The same label now says Price/quantity change. Studio 9.9.439. Staging. Folded into 9.9.440.

WO-358. Billable and Pending were the same step. The Billable filter is gone. Pass on moves the line to Pending. Studio 9.9.440. Cindy GO. PRODUCTION hosting ~17:40. Live was 9.9.435. Live confirmed 9.9.440. Also includes WO-354 through WO-357. Functions not deployed. No commit.

Print and PDF were not changed. The same card style is on invoices, proposals, and purchase orders.

## Verify

Hard refresh. Open an invoice. Merchandise, tax, shipping, discount, and paid are larger. Total and Balance are the largest. Applied payment amounts are a step larger than before.
