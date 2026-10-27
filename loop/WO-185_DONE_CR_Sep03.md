# WO-185 DONE — PO Edit: Ship To dropdown fills receiver address
**Executor:** Cursor · **Date:** 2026-09-03 · **State:** DONE-UNVERIFIED

## Symptom
Cindy Sep 3 PO-9051 (Cloud Rolling Hills / Hubbardton Forge): Ship To dropdown = Designers Moving Service, vendor-facing address stayed **Tracey Cloud Job Site · 87 Haslin Ranch**.

## Grounding
- Dropdown option value is the **contact name** (`_shipToContactEntry` `addr: name`, `index.html` ~35907).
- `resolvePOShipToDisplayText` (`index.html` ~36181) returns `docData.shipToAddress` first if set.
- `docEditUpdatePOShipToResolvedPreview` (`index.html` ~41527) passed that leftover job-site string, so picking a receiver never replaced the box.
- Initial textarea (`index.html` ~47850) did `if (manual) return manual`.

## Change
- `_poVendorFacingShipToText`: resolve from destination with empty `shipToAddress`; if saved address does not contain the destination name, use the receiver/workroom block.
- Dropdown `onchange` calls preview with `force` so the box updates immediately.
- Edit form initial value uses the same helper.

## Surfaces
- PO Edit only. Print uses saved `shipToAddress` after Save. Proposals/invoices not touched.

## Verify
1. Edit PO-9051. Confirm Designers Moving Service is selected.
2. Address box should show DMS name + their street (from Vendors → Delivery / Receivers), not Haslin Ranch.
3. Re-pick Client Job Site → address returns to job site. Re-pick DMS → DMS address again.
4. Save → Print/PDF Ship To matches the box.
