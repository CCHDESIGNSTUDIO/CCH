# WO-402 DONE — variance invoice links match the charge

Production Firestore, project `cloud-rolling-hills`. No hosting deploy. No PO line cost, qty, or amount was written. Variance amounts already matched the live bill minus the PO total at send, so those were not rewritten. Pass on and Absorbed on the vendor-invoice rows were not changed. Temp script deleted.

## Written

INV-6063 (`X71uDbfBQQtXUVxWoq4T`), eight lines, field `varianceComponentId` only. Dollar amounts stayed.

| PO | Invoice amount | Charge | New id |
|----|----------------|--------|--------|
| PO-9030 | 665 freight | 663.84 | vi_1782763070106_0 |
| PO-9031 | 150 freight | 150 | vi_1782418019294_0 |
| PO-9031 | 395 price | 394.50 | vi_1782418019294_2 |
| PO-9034 | 150 freight | 148.92 | vi_1787691925434_0 |
| PO-9035 | 250 freight | 249.39 | vi_1782506662746_0 |
| PO-9029 | 60 price | 59.67 | vi_1782434065613_2 |
| PO-9029 | 120 price | 119.34 | vi_1782434065613_3 |
| PO-9037 | 10 freight | 8.95 | vi_1782243443716_0 |

Cleared `bill.items[].invoicedOnId` only:

- PO-9027 Designer discount $1,476 was marked INV-6079. INV-6079 has no variance lines.
- PO-9060 $0.70 was marked INV-6086. The $49.75 line on INV-6086 already points at `vi_1792876249745_5`.
- PO-12915 Bracket $178.22 was marked INV-6079. The INV-6086 line already points at `vi_extra_1793284809101_4`.

Re-read after the write: 0 link fixes left, 0 stale marks left.

## Not written

- PO-9029 freight: INV-6063 shows $130, the bill charge is $127.10. That is $2.90 apart, outside the $2 match. Left on the old id `vc_0_freight`.
- PO totals that moved after send. Flag only: PO-9063, PO-9057, PO-9030, PO-9059, PO-9028, PO-9060, PO-9046, PO-9062, PO-9058, PO-9047.
- INV-6086 descriptions, shipping, and merchandise. QuickBooks. One bill per vendor invoice.

## Self-test

Second read of production returned no further link writes. Not click-tested in the browser.
