# WO-338 DONE — Open credits dropdown under Finance and on the project panel

Cindy Oct 24. She wants open credits and retainers on the left, per project, and under Finance, with a dropdown to select the recorded credit.

## Files

- `platform/cch-project-subpanel.js` — Under Money, a dropdown of this project's open vendor credits and retainer-credit invoice lines. Choosing a vendor credit while a different PO is open opens Pay bill on that PO with Vendor credit selected.
- `platform/cch-po-bill-variance.js` — `renderOpenCreditsPage`. Pay bill honors `__cchPoPreselectCredit`.
- `platform/index.html` — Finance nav item Open credits, route `#/opencredits`. Studio 9.9.423, tag `open-credits-nav`. Cache `cch-project-subpanel.js?v=20261024wo338` and `cch-po-bill-variance.js?v=20261024wo338`.

## Self-test

`node --check` on both JS files exited 0. Live index is 9.9.423 and the Open credits nav is in the file. The $280.11 credit was not recorded from this session.

PRODUCTION hosting 2026-10-24. Functions not deployed. No commit.
