#!/usr/bin/env python3
import fitz, json
fp = r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz & QB\Quickbooks\Qb Reports\BillsandAppliedPayments 9.15.26.pdf"
doc = fitz.open(fp)
page = doc[0]
words = page.get_text("words")  # x0,y0,x1,y1,word,block,line,wordn
# sample unique x0 buckets
xs = sorted(set(round(w[0], 0) for w in words))
print("x0s", xs[:40])
# print words in reading order first 80
for w in words[:80]:
    print(f"{w[1]:6.1f} {w[0]:6.1f} {w[4]!r}")
