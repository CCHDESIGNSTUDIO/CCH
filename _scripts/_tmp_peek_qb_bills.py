#!/usr/bin/env python3
"""Peek QB Bills and Applied Payments workbook structure."""
import pandas as pd

fp = r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz & QB\Quickbooks\CCH Design Inc._Bills and Applied Payments.xlsx"
xl = pd.ExcelFile(fp)
print("SHEETS:", xl.sheet_names)
for sn in xl.sheet_names:
    df = pd.read_excel(fp, sheet_name=sn, header=None)
    print("\n===", sn, "shape", df.shape, "===")
    for i in range(min(18, len(df))):
        row = [str(x)[:40] if pd.notna(x) else "" for x in df.iloc[i].tolist()[:12]]
        print(f"R{i+1}: {' | '.join(row)}")
