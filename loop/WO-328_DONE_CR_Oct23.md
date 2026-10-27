# WO-328 DONE — An item already on a PO stays off a new PO

Cindy Oct 23. Hubbardton Forge PO-9052 and PO-9064, Cloud Rolling Hills, same three items from the same invoice.

## What changed

`platform/index.html`

- `_poItemCoverageKeys`, `_poCoveredBy`, `_poStatusSkipsCoverage` (~46873). A line matches an existing PO by clip id, title plus vendor, or sku plus vendor.
- `generatePOsFromDoc` (~46964). Coverage reads every purchase order on the project. Merged, cancelled, and void are skipped. It is no longer limited to POs linked to the current invoice.
- `poGenCreateSelected` (~47190). A checked line that is already on a PO is left off the new PO. If every checked line is already on a PO, no new number is created. The alert names the existing PO.

## Not changed

PO-9052 and PO-9064 were not deleted or edited. Their money was not changed.

## Self-test

Read the two functions after the edit. File still ends with `</html>`. Not deployed.

## Verify

After production: Cloud Rolling Hills, the Hubbardton invoice, Generate POs. Staccato, Otto, and Echo should show as already on PO-9052 and should not create another PO.
