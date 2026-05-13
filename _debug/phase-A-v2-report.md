# Phase A v2 — Production Enrichment Dry-Run

**Mode:** READ-ONLY. No writes. Detail CSV alongside this file.
**Run:** 2026-04-29T03:23:55.159Z · 67.3s

## Match counts (priority order — first match wins per product)

| Tier | Method | Count |
|---|---|--:|
| HIGH | SKU exact match | 2494 |
| HIGH | Title-exact AND vendor matches | 2903 |
| MED  | Title-exact, vendor differs/missing | 136 |
| LOW  | Title-contains (substring) | 177 |
| —    | No match in Houzz catalog | 455 |

**Total products:** 6165
**Total matched:** 5710
**Locked (referenced on a doc line item — would skip):** 553 (note: undercounted — top-level /invoices not scanned)

## Would-write summary (matched + not locked)

| Confidence | Would write |
|---|--:|
| HIGH | 4999 |
| MED | 122 |
| LOW | 134 |
| **Total** | **5255** |

## Image URL situation (current state across all 6,165)

| Current imageUrl status | Count |
|---|--:|
| aws-expiring | 4427 |
| invalid | 793 |
| empty | 454 |
| firebase-permanent | 383 |
| retail-or-other | 108 |

**`aws-expiring`** = AWS pre-signed URL from old Houzz exports → already broken or breaks May 25. **`firebase-permanent`** + **`retail-or-other`** = working durable URLs (won't change unless you ask).

## What the production write would do (per matched + unlocked product)

1. Set field `houzzId` = catalog `id` (e.g. `33490311`).
2. Set field `imageUrl` = catalog `image1` URL (currently AWS, would be Firebase-permanent if we re-host first).
3. Touch nothing else: title, sku, vendor, cost, prices, document references all preserved.

## Stop here. Review the CSV. Then say go/no-go.

Detail CSV: `phase-A-v2-detail.csv` — 6165 rows, sortable by confidence column.