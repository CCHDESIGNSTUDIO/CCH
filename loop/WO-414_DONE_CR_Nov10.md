# WO-414 DONE — Design Hub menu is one publish

Cindy Nov 10: the Design Hub project menu still listed every board. She wants one line, Publish this board.

## Files

- `platform/index.html`
  - `CCH_BUILD` line 5026: 9.9.491, tag `ib-hub-one-publish`
  - `ibToggleProjectClientPublish` lines 27210–27233: one write sets `clientPublished` on every ideabook in the project. If any board is not live, the click publishes them all. If every board is already live, the click unpublishes them all.
  - Design Hub project menu lines 51220–51222: Open Project Boards, then one line. The board names are not listed.

Inside a project, each board card still has its own Publish this board button (`ibToggleClientPublish`). That button still changes one board.

## Self-test

Read back the menu markup and the new function. File ends at `</html>`. No other script files changed, so no cache-buster bump besides `CCH_BUILD`.

## Not done

Production hosting. Staging deploy is the next step in this chat.
