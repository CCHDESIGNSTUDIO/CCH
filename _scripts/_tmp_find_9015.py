#!/usr/bin/env python3
import fitz, re
path = r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz & QB\Quickbooks\Qb Reports\BillsandAppliedPayments 9.15.26.pdf"
doc = fitz.open(path)
text = "\n".join(p.get_text() for p in doc)
text = re.sub(r"BL-\s*\n\s*", "BL-", text)
idx = text.find("9015")
print(text[idx-400:idx+500] if idx>=0 else "NO 9015")
print("--- pomp ---")
idx = text.lower().find("pomp")
print(text[idx-200:idx+400] if idx>=0 else "NO pomp")
print("--- 400045 ---")
idx = text.find("400045")
print(text[idx-300:idx+400])
