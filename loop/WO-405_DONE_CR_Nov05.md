# WO-405 DONE — time invoice hours group by service

Cindy Nov 5: INV-6092 Holtz Hill Client View listed every day as its own line (`CCH Client Project Support — Oct 2`, repeated).

## Change

`platform/cch-invoice-redesign.js` `_outcomes` (~354). The client letter groups service lines that share a name and a rate. The date suffix (`— Oct 2`) is display-only and is not part of the group name. Hours add up. A different rate stays its own line. Notes from the entries sit on that one line.

Edit line items are unchanged: still one row per time entry.

`platform/index.html` and `platform/client.html` cache buster `?v=20261105wo405`. Build 9.9.482.

## Self-test

`node --check platform/cch-invoice-redesign.js` passed. Not click-tested in the browser. Stored invoice lines were not rewritten.
