# WO-330 DONE — Create PO lists every line and locks ones already on a PO

Cindy Oct 23. Create PO should show every invoice line, show the PO number on lines already ordered, and only let her select lines that do not have a PO.

## Grounding

`_renderGeneratePOModal` in `platform/index.html` (~47092). Every line was already listed. The PO number was inside the item title, which clips long names, so the number disappeared. The checkbox stayed enabled. The vendor checkbox checked those lines too.

## What changed

`platform/index.html` ~47100–47230. Studio 9.9.415, tag `po-gen-show-numbers`.

- The PO number sits beside the name, not inside it. If a line is on more than one PO, both numbers show.
- That line’s checkbox is disabled. The vendor checkbox skips it.
- Create still ignores a covered line.

## Verify

Hard refresh https://cch-platform.web.app. Cloud Rolling Hills invoice, Generate POs. Staccato, Otto, and Echo stay on the list, show PO-9052 (and PO-9064 if it is still there), and cannot be checked.
