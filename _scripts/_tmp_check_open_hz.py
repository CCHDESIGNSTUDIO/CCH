#!/usr/bin/env python3
import fitz, re
path = r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz & QB\Quickbooks\Qb Reports\BillsandAppliedPayments_2025.pdf"
doc = fitz.open(path)
text = re.sub(r"BL-\s*\n\s*", "BL-", "\n".join(p.get_text() for p in doc))
for needle in ("400034HZ", "400074HZ", "400081HZ", "400038HZ", "400041HZ"):
    i = text.find(needle)
    print("====", needle, "====")
    print(text[i-250:i+350] if i>=0 else "MISSING")
    print()
