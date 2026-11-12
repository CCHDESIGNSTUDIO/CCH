# WO-397 dry run — variance lines

Nothing was written. Staging was read first.

## Staging
Purchase orders with a vendor-invoice charge: 363
- 400127 West Elm (31-whitesail) charges 0
- 400125 Regina Andrews (31-whitesail) charges 0
- 400130 Pottery Barn (31-whitesail) charges 0
- 400126 Rejuvination (31-whitesail) charges 0
- 400128 Visual Comfort (31-whitesail) charges 0
- 400129 Etsy (31-whitesail) charges 0
- PO-400081 Designers Guild (USA) Inc. (7225-bugletrail) charges 0
- PO-400070 Samuel & Son (7225-bugletrail) charges 0
- PO-400070 Samuel & Son (7225-bugletrail) charges 0
- PO-400120 Phillip Jeffries (7225-bugletrail) charges 0
- PO-400029 DEKKO (7225-bugletrail) charges 0
- PO-400081 Designers Guild (USA) Inc. (7225-bugletrail) charges 0
- PO-9004 KRAVET (7225-bugletrail) charges 0
- PO-9003 Halverson Fine Finishes (7225-bugletrail) charges 0
- PO-400120 Phillip Jeffries (7225-bugletrail) charges 0
- PO-9002 Willow and Wild Designs (7225-bugletrail) charges 0
- PO-9004 KRAVET (7225-bugletrail-staging) charges 0
- PO-9001 Romo (7225-bugletrail-staging) charges 2
- PO-9000 Global Views (7225-bugletrail-staging) charges 0
- PO-9003 Global Views (7225-bugletrail-staging) charges 0
- PO-9002 KRAVET (7225-bugletrail-staging) charges 0
- PO-9005 Romo (7225-bugletrail-staging) charges 4
- PO-9014 Flambeaux (cloud-rolling-hills) charges 4
- PO-9013 Etsy (cloud-rolling-hills) charges 2
- PO-12906 Ron & Tracey Cloud (cloud-rolling-hills) charges 0
- PO-12907 Ron & Tracey Cloud (cloud-rolling-hills) charges 0
- PO-12908 Ron & Tracey Cloud (cloud-rolling-hills) charges 0
- PO-12915 Ron & Tracey Cloud (cloud-rolling-hills) charges 0
- PO-12920 Ron & Tracey Cloud (cloud-rolling-hills) charges 3
- PO-12934 Ron & Tracey Cloud (cloud-rolling-hills) charges 0
- PO-9010 Restoration Hardware (holtz-hill) charges 0
- PO-9006 Buster + Punch US (holtz-hill) charges 0
- PO-9012 Visual Comfort (holtz-hill) charges 0
- PO-9015 Amazon (holtz-hill) charges 2
- PO-9011 Signature Collection (holtz-hill) charges 2
- PO-9008 Modern Collection (holtz-hill) charges 1
- PO-9009 Modern Forms (holtz-hill) charges 0
- PO-9007 John Pomp (holtz-hill) charges 0
- PO-9005 Schumacher (katke-graceland-dr) charges 0
- PO-9006 Zentique (katke-graceland-dr) charges 0

## Production read only — not written
Proposed line per stored charge. A blank disposition stays Undecided. Pass on and Absorbed already stored are kept.

### PO-9027 — Barn Electric
Stored variance object: 1832.59 / billable_to_client. That lump is not a line.
- 171.59 | tax | Pre-paid tax | inv 1077566 | stored (blank) | proposed undecided | line ids 3
- 1476 | price_change | Designer discount | inv 1077566 | stored (blank) | proposed undecided | line ids 1
- 202 | price_change | Designer discount | inv 1077566 | stored (blank) | proposed undecided | line ids 1
- -17 | price_change | Designer discount | inv 1077566 | stored absorbed | proposed absorbed | line ids 1

### PO-9054 — Walker Zanger
Stored variance object: 2360.24 / billable_to_client. That lump is not a line.
- 632.91 | price_change | Larger Slabs 120x80" | inv 80242665 | stored billable | proposed billable | line ids 1
- 1727.33 | tax | Pre-paid tax | inv 80242665 | stored (blank) | proposed undecided | line ids 1

### PO-9030 — Hubbardton Forge
Stored variance object: -3697.56 / billable_to_client. That lump is not a line.
- 663.84 | freight | (no description) | inv 394817 | stored (blank) | proposed undecided | line ids 3

### PO-9028 — Elu
Stored variance object: -1100 / refund_due_client. That lump is not a line.
- 2750 | price_change | (no description) | inv 1589 | stored (blank) | proposed undecided | line ids 1
- -1250 | price_change | Changed to all one size | inv 1589 | stored (blank) | proposed undecided | line ids 0

### PO-9060 — Walker Zanger
Stored variance object: 1002.67 / billable_to_client. That lump is not a line.
- 280.68 | freight | (no description) | inv 80242665 | stored billable | proposed billable | line ids 6
- 672.64 | tax | Pre-paid tax | inv 80242665 | stored (blank) | proposed undecided | line ids 6
- 25.02 | freight | (no description) | inv 80242665 | stored billable | proposed billable | line ids 6
- -40.08 | price_change | (no description) | inv 80242665 | stored absorbed | proposed absorbed | line ids 6
- 0.7 | price_change | (no description) | inv 80242665 | stored absorbed | proposed absorbed | line ids 6
- 49.75 | price_change | (no description) | inv 80242665 | stored billable | proposed billable | line ids 6
- 13.96 | price_change | (no description) | inv 80242665 | stored absorbed | proposed absorbed | line ids 6

### PO-9046 — Stone West
Stored variance object: -1509.69 / billable_to_client. That lump is not a line.
- 1325.25 | tax | (no description) | inv 218575 | stored (blank) | proposed undecided | line ids 3
- 498.06 | extra | ESS 3% Environmental Silica Safety Fee | inv 218575 | stored billable | proposed billable | line ids 0

### PO-9047 — Walker Zanger
Stored variance object: -2687.9 / billable_to_client. That lump is not a line.
- 316.68 | price_change | (no description) | inv 10381974 | stored billable | proposed billable | line ids 1
- -1183.33 | price_change | (no description) | inv 10381974 | stored absorbed | proposed absorbed | line ids 1
- -700.78 | price_change | (no description) | inv 10381974 | stored absorbed | proposed absorbed | line ids 1
- 316.67 | price_change | over charged tax on Inv PO 9054 | inv 10381974 | stored billable | proposed billable | line ids 1
- 7717 | freight | (no description) | inv 10381974 | stored (blank) | proposed undecided | line ids 1
- 2243.37 | tax | (no description) | inv 10381974 | stored (blank) | proposed undecided | line ids 6
- -0.01 | price_change | (no description) | inv 10381974 | stored absorbed | proposed absorbed | line ids 1

### PO-12915 — Concretti
Stored variance object: 599.1 / billable_to_client. That lump is not a line.
- -164.99 | price_change | (no description) | inv U259GX735X | stored absorbed | proposed absorbed | line ids 1
- 800 | freight | (no description) | inv U259GX735X | stored (blank) | proposed undecided | line ids 0
- 235.86 | tax | Pre-paid tax | inv U259GX735X | stored (blank) | proposed undecided | line ids 0
- -449.99 | price_change | (no description) | inv U259GX735X | stored absorbed | proposed absorbed | line ids 0
- 178.22 | other | Bracket for wall mount | inv U259GX735X | stored (blank) | proposed undecided | line ids 0