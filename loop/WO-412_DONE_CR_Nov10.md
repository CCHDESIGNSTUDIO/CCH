# WO-412 DONE — Design Hub menu publishes, no deletes

Cindy Nov 10. The Design Hub project menu listed Rename and Delete for every board and had no publish.

## Change

The ⋮ menu on a Design Hub project card now has Open Project Boards, then one line per board: Publish to client, or Unpublish if it is already live. The per-board delete and rename rows are gone from that menu. Delete board remains on the board’s own menu inside the project. Publish uses `ibToggleClientPublish`. From the Design Hub it stays on that page.

## Files

- `platform/index.html` — summary `clientPublished` ~51069, menu ~51193, refresh after publish ~27201. Studio 9.9.489.

## Self-test

Not clicked in the browser. Delete from this menu is no longer in the markup.
