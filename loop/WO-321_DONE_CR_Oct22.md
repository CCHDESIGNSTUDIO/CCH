# WO-321 DONE — Furnishing note does not block add

Cindy Oct 22. Florentine Clock 30" would not add to Cloud Mustang. The internal note mentioned shipping.

## Files

- `platform/index.html` — `_disSidebarItemIsProjectSelectionProduct`, the Selections product filter, and `ffeFilterProductClipsOnly`. Studio 9.9.406, tag `furnishing-note`.

## What changed

Those checks now look at the title only. An internal note or vendor description can mention shipping and the furnishing still adds. A line whose title is freight, labor, or tax is still blocked. So is a line whose type is shipping, labor, or expense.

## Self-test

Read the three call sites after the edit. Not clicked on the clock in the browser.

## Deploy

PRODUCTION hosting 2026-10-22. Studio 9.9.406. Functions not deployed. No commit.
