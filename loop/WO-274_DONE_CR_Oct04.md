# WO-274 DONE — window work order keeps the Materials column

Cindy Oct 4, CLO-W-06 Game Room. The Materials column on the right was gone. Do not restyle the sheet.

## What changed

`platform/builder/index.html` — `updatePreview` around the right-hand column (about line 10064). Builder rev `2026-10-04wo-materials-col`.

Window sheets (style, drapery, roman, flat fold, roller) always keep the Materials column, so the three-column template stays. When a fabric row is saved, it still renders the same way. When none is saved, the column is the Materials heading only.

Product sheets (upholstery, bedding, pillows) still drop an empty Materials column. That collapse was left in place.

CLO-W-06 has no fabric row in Firestore. The LE1160 picture is the design image from the PowerPoint import. It was not moved.

## Not done

Staging hosting was not deployed. Other platform files are uncommitted, and a hosting deploy would send those too.

## Verify

After a staging deploy: hard refresh the builder, open CLO-W-06. Design Intent, Window Treatment Design, Materials on the right. Widths and type are unchanged.
