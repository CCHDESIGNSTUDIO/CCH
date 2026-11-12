# WO-399 DONE — INV-6086 freight is in Shipping

Cindy Oct 30. She should not move the freight by hand.

## Data

Production `boards/cloud-rolling-hills/invoices/pftDOyPOdztvpeqn6KBP`, Unsent, no QuickBooks id. 14 lines whose title is Freight: cost and amount set to 0, shipping set to the former amount, markup 0, qbCategory Freight. Descriptions, line notes, titles, taxable flags, and expense lines were not changed. Merchandise total stayed $10,574.90. Tax base stayed 0 because those lines are not boolean-taxable.

## Display

Edit row Total and the client line show that shipping amount so the line does not look like $0. The invoice total still adds shipping once.

Studio 9.9.479. Production and staging hosting 2026-10-30. Not click-tested. No commit.
