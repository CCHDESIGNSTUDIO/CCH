#!/usr/bin/env python3
"""Dump raw PDF text + all BL- / PO- tokens for parser debug."""
import re
import fitz

files = [
    r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz & QB\Quickbooks\Qb Reports\BillsandAppliedPayments 9.15.26.pdf",
    r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz & QB\Quickbooks\Qb Reports\BillsandAppliedPayments_2025.pdf",
]
for path in files:
    print("====", path.split("\\")[-1], "====")
    doc = fitz.open(path)
    text = "\n".join(page.get_text() for page in doc)
    print("pages", doc.page_count, "chars", len(text))
    # stitch wrapped BL-
    stitched = re.sub(r"BL-\s*\n\s*", "BL-", text)
    nums = sorted(set(re.findall(r"BL-[\w-]+", stitched)))
    print("unique BL- count", len(nums))
    hz = [n for n in nums if "HZ" in n.upper() or "400" in n]
    print("HZ/400-ish", len(hz))
    for n in hz:
        print(" ", n)
    print("OPEN-looking lines:")
    for line in stitched.splitlines():
        if re.search(r"\b0\.00\b", line) is None and re.search(r"\d+\.\d{2}\s+\d+\.\d{2}", line):
            if "Bill" in line or "BL-" in line:
                print(" ", line[:140])
    print("--- first 2500 chars ---")
    print(stitched[:2500])
    print()
    doc.close()
