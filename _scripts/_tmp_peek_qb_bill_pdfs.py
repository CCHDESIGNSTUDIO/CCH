#!/usr/bin/env python3
"""Dump first pages of YTD + 2025 Bills PDFs so we can parse them."""
import fitz

files = [
    r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz & QB\Quickbooks\Qb Reports\BillsandAppliedPayments 9.15.26.pdf",
    r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz & QB\Quickbooks\Qb Reports\BillsandAppliedPayments_2025.pdf",
]
for fp in files:
    doc = fitz.open(fp)
    print("=" * 80)
    print(fp.split("\\")[-1], "pages", doc.page_count)
    for i, page in enumerate(doc):
        if i >= 2:
            print(f"... {doc.page_count - 2} more pages")
            break
        t = page.get_text("text")
        print(f"--- page {i+1} ({len(t)} chars) ---")
        print(t[:2500])
    doc.close()
