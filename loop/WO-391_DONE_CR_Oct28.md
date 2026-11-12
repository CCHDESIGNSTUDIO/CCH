# WO-391 DONE — PO bill-to uses the vendor record address

Cindy Oct 28. PO-9050 still showed 2181 Laguna Canyon Rd after OC Custom Furniture was selected.

## Root cause

The saved purchase order address was left in place. Choosing the name that was already selected does not run the change handler. OC Custom Furniture’s vendor record is 712 Valley #F, Anaheim, CA 92801.

## What changed

Purchase order open only. Line costs are not written.

- `platform/index.html` — while vendor contacts load, each vendor’s address, phone, email, and contact are kept by name. Opening a purchase order replaces Bill to when that address differs, and saves those four fields. Studio 9.9.471.

## Self-test

The edit page was not click-tested. The vendor document was read earlier this session. The purchase order line items are not in this write.
