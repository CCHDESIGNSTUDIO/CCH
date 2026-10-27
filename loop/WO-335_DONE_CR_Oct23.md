# WO-335 DONE — Vendor bill total adds the invoice line totals

Cindy Oct 23. The bottom stayed $38,887.11 no matter which number she changed.

## The addition

Vendor invoice:

- Two Calacatta Extreme $12,660.63
- 1 1/4 Matisse $3,742.22
- 3/4 Matisse $3,259.67
- Two Vintage $9,284.21
- Freight $7,717.00
- Pre-paid tax $2,243.37
- Total $38,907.10

The stuck total is the same sum with the Vintage pair at $9,264.22 instead of $9,284.21. Difference $19.99.

## What was wrong

A price-change row kept the old invoice line total when the unit price, qty, or amount changed, and the Amount box was locked. The bottom kept adding $9,264.22 for Vintage.

## Files

- `platform/cch-po-bill-variance.js` — `cchPoVendorBillMath`. Merchandise is the invoice line total. Freight, tax, extra, and override are added once. Changing unit, qty, the line total, or the amount changes that total by the same amount.
- `platform/index.html` — Studio 9.9.420, `cch-po-bill-variance.js?v=20261023wo335`.

## Self-test

`node --check platform/cch-po-bill-variance.js` exited 0.

## Not deployed

The page she has open is still Studio 9.9.417. It will keep showing $38,887.11 until this is published.
