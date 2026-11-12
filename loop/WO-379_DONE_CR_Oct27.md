# WO-379 DONE — Ship date sets the order status to Shipped

Cindy Oct 27. Vanessa entered an actual ship date and the order status stayed Confirmed. The order was already confirmed. Adding the bill should not ask to confirm it again.

## Files

- `platform/cch-po-bill-variance.js`
  - `cchPoOrderStatusForShipDate` sets Shipped when an actual ship date is present and the status is blank, Confirmed, Pending, Est. ship scheduled, or Ordered. Delivered and later statuses stay.
  - The vendor invoice table, the shipping lane, the edit dropdown, and Save use that rule.
  - Save does not open a confirm step.
- `platform/index.html` — Studio 9.9.459. Cache `cch-po-bill-variance.js?v=20261027wo379`.

## Self-test

`node --check platform/cch-po-bill-variance.js` passed. The page was not click-tested.
