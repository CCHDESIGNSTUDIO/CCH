# WO-267 DONE — Imported scope prints across the work order, not in the left column

Cindy Oct 2. CLO-W-20 Bar preview was a wall of text under Design Intent. She said it will not print.

## Grounding

`platform/builder/index.html` `updatePreview` puts `designIntent` in the left column of the landscape sheet (`.pp-intent`). The import wrote the whole treatment scope into that field. The next room name was included because the scope loop ran until the next money line, which sits after the next room title.

## Change

- A long scope is drawn full width: first sentence stays Design Intent, the rest is Workroom Description with line breaks. The left column no longer holds the paragraph, so the sheet fits landscape.
- A trailing room name with no period (Great Room Dormer on the Bar sheet) is dropped from that block.
- New imports store the same split, and stop the scope before the next room's Estimate Number line.
- Builder rev `2026-10-02wo-scope-print`.

CLO-W-20 already saved does not need a re-import. Hard refresh and open it again.

## Not changed

Financial document print CSS. Cost stays in the form under Panel / shade product. Production builder unchanged.
