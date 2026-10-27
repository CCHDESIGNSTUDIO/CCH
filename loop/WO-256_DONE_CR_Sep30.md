# WO-256 DONE — Product Library search uses the same newest-first order as the list

Cindy Sep 30: product library search takes too long. Have it start with the most recent, the same order the library loads in.

## Grounding

- Default list sort is already date added, newest first: `librarySortField = 'createdAt'`, `librarySortDir = 'desc'` (`platform/index.html` ~65183). Date is `createdAt || importedAt || addedAt` (`libraryProductDateAddedIso`, ~65163).
- Search was a separate sort: `librarySearchRelevanceScore` then `updatedAt` (`renderLibraryView`, was ~67926). That scored every match (title, vendor, manufacturer, sku) and put the best word-match first, not the newest.
- Each keystroke waits 300ms (`librarySearchType`, ~66209) then rebuilds the whole library page.
- The catalog still loads in unordered batches of 500 (`renderProductLibrary`, ~65984). Do not `orderBy('createdAt')`: `productLibrary` has createdAt on 25 of 4,698 docs. An ordered query would drop the rest. `products` has createdAt on 5,005 of 5,091.

## Change

- `renderLibraryView` search results use the same sort as the list. Default is date added, newest first.
- Removed the unused search-token variable that only fed the relevance sort.
- `CCH_BUILD` 9.9.367 `library-search-recent`.

## Not changed

- Firestore load queries. Still batches of 500, then the page sorts what has arrived.
- `librarySearchRelevanceScore` left in place, unused.
- Filters, page size (100), junk library, document isolation.

## Self-test

- `platform/index.html` still ends with `</body></html>`.
- Not deployed. Production after Cindy GO. Hard refresh Product Library. Search a vendor. First rows should be the newest date added, same as the list with no search.
