# WO-320 DONE — Add item library finishes loading

Cindy Oct 22. PRO-3050 on Cloud Mustang. Add item stayed on Loading library and the tab highlight jumped. She had not opened Mustang in a long time, so the master library was not already in memory.

## Files

- `platform/index.html` — `openDocItemsSidebar`, `_disLoadGlobalCatalog`, `filterDocSidebar`. Studio 9.9.405, tag `library-loads`.

## What changed

Opening Add item no longer throws away a library that already loaded for this project. The tab she clicks stays highlighted while the list loads. A bad product title can no longer abort the load. If the load is abandoned or throws, the panel stops spinning. If nothing arrives in 20 seconds, it says to close Add item and open it again.

## Self-test

The catalog loader parsed. Not verified in the browser on PRO-3050.

## Deploy

PRODUCTION hosting 2026-10-22. Functions not deployed. No commit.
