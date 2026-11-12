# WO-424 DONE — Share one inspiration board with a contractor

Cindy Nov 11. Same share control as files, on one inspiration board. Not every board. Not posted as a decision. No prices.

## Files

- `platform/index.html` — `ibToggleContractorShare` writes `sharedWithContractors` on that one ideabook. Share with contractors is on the open board, the board card, and the Board menu. Studio 9.9.501. Script cache `cch-contractor-access.js?v=20261111wo424`.
- `platform/cch-contractor-access.js` — the contractor page and the client portal Contractors tab list shared boards as images and captions. Price, cost, and vendor are not rendered.
- `platform/client.html` — same script cache so the portal tab loads the board list.

## What did not change

Publish this board still controls the client. Design Hub still publishes every board in the project and does not share them with a contractor. Post Decision is unchanged.

## Self-test

`node --check platform/cch-contractor-access.js` passed. The board button was not clicked before the staging deploy.
