# WO-411 DONE — Publish on inspiration board cards

Cindy Nov 10. Villanueva inspiration grid. She wants Publish to client on the card, without opening the board.

## Change

`ibLandingCardHtml` in `platform/index.html` (~26596) adds a button under each project inspiration card. Draft cards say Publish to client. Published cards say Unpublish. The click calls the existing `ibToggleClientPublish` and does not open the board. Style Library cards and the client read-only view do not get the button. The inside-board publish button is unchanged.

## Files

- `platform/index.html` — card markup ~26596 and ~26612. Studio 9.9.488.

## Self-test

Not clicked in the browser. The button is outside the card’s navigate button. Publish still writes `clientPublished` on `boards/{project}/ideabooks/{id}`.
