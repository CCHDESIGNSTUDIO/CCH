# WO-260 DONE — Vendor bid: one line per cost

Cindy Oct 1: every cost on a vendor quote is one line. The paragraph under it is the description. PRO-3048 would not open at 121 lines.

## Grounding

- `parseVendorBidLines` in `platform/cch-vendor-bid-import.js`. A priced row used to take the text sitting in `pending` as its own description, so the paragraph under a price attached to the next item.
- `TOTAL $…` also matched `_vbIsTableHeader`, which cleared `pending` and dropped the last line’s wording.
- `_PROP_OPEN_LINE_CAP` in `renderProposalDetail` (`platform/index.html` ~35078) was 120 and blocked the proposal page.

## Change

- A priced row that already has a title keeps the following unpriced text as that line’s description.
- A price with no title still uses the words above it as the title.
- Subtotal, tax, and total flush the open description and are not imported as lines.
- Proposal open cap 120 → 600. Invoices, POs, and print are unchanged.
- `CCH_BUILD` 9.9.371 `vendor-bid-one-cost-line`.
- Cache buster `cch-vendor-bid-import.js?v=20261001costline`.

## Self-test

- `node --check platform/cch-vendor-bid-import.js` passed.
- Bartolo-shaped page: 6 priced lines. Each paragraph, including yardage with no price, is that line’s description. Subtotal, tax, and total are not lines. The six prices sum to $10,005 (the page total $16,285 includes lines above that crop).
- Amount-only row still uses the words above the price as the title.

## Deploy

Production hosting `cch-design-boards` 2026-10-01. Live https://cch-platform.web.app is 9.9.371. WO-259 shipped in the same hosting.

## Not done

- PRO-3048 was not rewritten. Import adds lines. The old 121 lines are still on that proposal until she removes them and imports again.
