# WO-318 DONE — Closing a task stays on the page

Cindy Oct 22. She set a task to Done and the screen jumped to Purchase Orders.

## Files

- `platform/index.html` `updateTaskField` — after a task field save, re-render the page in the address bar. A project page stays on that project. All Tasks stays on All Tasks. The dashboard stays on the dashboard.

## What changed

`updateTaskField` always called `renderProjectDetail()`, which paints the last project tab. If that tab was Purchase Orders, closing a task from the status menu opened Purchase Orders. It now follows the same hash check as `toggleTaskStatus`.

## Self-test

Read `updateTaskField` after the edit. No `node --check` on `index.html` (it is HTML). Not verified in the browser yet.

## Deploy

Ships in the same staging hosting as WO-319, Studio 9.9.403. Production not deployed.
