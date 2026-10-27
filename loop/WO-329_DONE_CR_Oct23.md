# WO-329 DONE — Room board shows the purchase order

Cindy Oct 23. Room boards were not showing purchase orders, so an item did not say which PO it was already on.

## Grounding

- `clipLinkedDocPillsHtml` (`platform/index.html` ~24828) skipped the PO pill whenever the card was a room board (`forRoomBoard`).
- `enrichClipsWithProjectDocLinks` (~43233) stamped proposal and invoice onto the clip and never read `purchaseOrders`.
- Client portal `platform/client.html` `clipLinkedDocPillsHtml` still returns nothing. Clients do not see PO numbers.

## What changed

`platform/index.html`

- Room board pills include the PO and link to it.
- While the room board loads, each clip is matched to project POs by clip id, then by title plus vendor. The earliest PO is the one shown. A later copy is not offered as a second choice.
- Card hint mentions PO. Studio 9.9.414, tag `po-on-room-board`.

## Not changed

No Firestore write. PO-9052 and PO-9064 were not deleted. Client portal pills stay empty.

## Verify

Hard refresh production after GO. Cloud Rolling Hills room board. Staccato, Otto Sphere Pendant, and Echo Sconce should show PO-9052.
