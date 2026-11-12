# WO-392 DONE — Variance invoice titles are the charge

Cindy Oct 28 on INV-6086. The draft listed every product name, and two freight lines were only a vendor invoice number.

## What changed

Unsent variance invoices only. Amounts are not changed.

- `platform/cch-po-bill-variance.js` — a draft variance line title is Freight, Price/qty change, or the other charge type. New lines use that title. The vendor invoice number stays in the notes. Cache `?v=20261028wo392`.
- `platform/index.html` — Studio 9.9.472.

Opening INV-6086 rewrites those titles and saves them. The two handling fees are left as they are.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. The invoice page was not click-tested.
