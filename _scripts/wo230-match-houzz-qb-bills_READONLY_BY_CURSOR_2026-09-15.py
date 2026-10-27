#!/usr/bin/env python3
"""WO-230: match Studio Houzz pending POs to QB Bills and Applied Payments (to May 20 2026)."""
import csv
import json
import re
from collections import defaultdict
from pathlib import Path

import pandas as pd

QB = r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz & QB\Quickbooks\CCH Design Inc._Bills and Applied Payments.xlsx"
STUDIO = r"C:\dev\CCH-Platform-Deploy\cch-deploy\_debug\HOUZZ_OPEN_POS_VS_STUDIO_QB_FIELDS_BY_CURSOR_2026-09-15.csv"
OUT_DIR = Path(r"C:\dev\CCH-Platform-Deploy\cch-deploy\_debug")

df = pd.read_excel(QB, header=None)
# Row 5 (1-based) is headers
vendor = None
bills = []
for i in range(5, len(df)):
    a = df.iloc[i, 0]
    date = df.iloc[i, 1]
    typ = df.iloc[i, 2]
    num = df.iloc[i, 3]
    memo = df.iloc[i, 4]
    amt = df.iloc[i, 5]
    bal = df.iloc[i, 6]
    if pd.notna(a) and str(a).strip() and pd.isna(date):
        vendor = str(a).strip()
        continue
    t = str(typ).strip() if pd.notna(typ) else ""
    if t != "Bill":
        continue
    try:
        amount = float(amt) if pd.notna(amt) else 0.0
    except Exception:
        amount = 0.0
    try:
        open_bal = float(bal) if pd.notna(bal) else 0.0
    except Exception:
        open_bal = 0.0
    n = str(num).strip() if pd.notna(num) else ""
    bills.append({
        "vendor": vendor or "",
        "date": str(date)[:10] if pd.notna(date) else "",
        "txn": n,
        "memo": str(memo).strip() if pd.notna(memo) else "",
        "amount": round(amount, 2),
        "open_balance": round(open_bal, 2),
    })

print("QB bills:", len(bills))
open_bills = [b for b in bills if abs(b["open_balance"]) > 0.02]
print("QB open balance > 0:", len(open_bills), "sum", round(sum(b["open_balance"] for b in open_bills), 2))

# index by normalized txn
def digits(s):
    return re.sub(r"\D", "", str(s or ""))

by_digits = defaultdict(list)
by_txn = {}
for b in bills:
    by_txn[b["txn"].upper()] = b
    d = digits(b["txn"])
    if d:
        by_digits[d].append(b)
        if len(d) >= 5:
            by_digits[d[-5:]].append(b)
            by_digits[d[-6:]].append(b)

studio = list(csv.DictReader(open(STUDIO, encoding="utf-8")))


def po_keys(po):
    d = digits(po)
    keys = set()
    if d:
        keys.add(d)
        keys.add(d[-5:] if len(d) >= 5 else d)
        keys.add(d[-6:] if len(d) >= 6 else d)
        # 400123 <-> 888123 last-5 swap of prefix
        if d.startswith("400") and len(d) >= 6:
            keys.add("888" + d[3:])
        if d.startswith("888") and len(d) >= 6:
            keys.add("400" + d[3:])
    return keys


def match_po(po_num, vendor, remaining):
    hits = []
    seen = set()
    for k in po_keys(po_num):
        for b in by_digits.get(k, []):
            sid = id(b)
            if sid in seen:
                continue
            seen.add(sid)
            hits.append(b)
        txn = "BL-" + k
        if txn in by_txn:
            b = by_txn[txn]
            if id(b) not in seen:
                seen.add(id(b))
                hits.append(b)
    # vendor+amount fallback
    if not hits and remaining:
        v = (vendor or "").lower()[:12]
        for b in bills:
            if abs(b["amount"] - remaining) < 0.03 and v and v in b["vendor"].lower():
                hits.append(b)
                break
    return hits

rows_out = []
for s in studio:
    po = s["poNum"]
    hits = match_po(po, s["vendor"], float(s["remaining"] or 0))
    if hits:
        # prefer open bill, else latest
        hits_sorted = sorted(hits, key=lambda b: (0 if b["open_balance"] > 0.02 else 1, b["date"]), reverse=False)
        best = None
        open_h = [h for h in hits if h["open_balance"] > 0.02]
        best = open_h[0] if open_h else hits[0]
        if best["open_balance"] > 0.02:
            verdict = "QB_STILL_OPEN"
        else:
            verdict = "QB_PAID_CLOSED"
        qb_txn = best["txn"]
        qb_vendor = best["vendor"]
        qb_amt = best["amount"]
        qb_open = best["open_balance"]
        qb_date = best["date"]
        n_hits = len(hits)
    else:
        verdict = "NOT_IN_QB_EXPORT"
        qb_txn = qb_vendor = qb_date = ""
        qb_amt = qb_open = ""
        n_hits = 0
    rows_out.append({
        "verdict": verdict,
        "studio_po": po,
        "studio_project": s["project"],
        "studio_vendor": s["vendor"],
        "studio_remaining": s["remaining"],
        "studio_bucket": s["bucket"],
        "qb_txn": qb_txn,
        "qb_vendor": qb_vendor,
        "qb_date": qb_date,
        "qb_amount": qb_amt,
        "qb_open_balance": qb_open,
        "qb_hit_count": n_hits,
    })

from collections import Counter
c = Counter(r["verdict"] for r in rows_out)
print("Studio Houzz pending vs QB:", dict(c))

# still-due 20
due = [r for r in rows_out if float(r["studio_remaining"] or 0) > 0.02]
print("Among 20 still-due:")
print(Counter(r["verdict"] for r in due))

open_csv = OUT_DIR / "QB_OPEN_BILLS_AS_OF_2026-05-20_BY_CURSOR.csv"
with open(open_csv, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=["vendor", "date", "txn", "memo", "amount", "open_balance"])
    w.writeheader()
    for b in sorted(open_bills, key=lambda x: -x["open_balance"]):
        w.writerow(b)

match_csv = OUT_DIR / "HOUZZ_PENDING_VS_QB_BILLS_BY_CURSOR_2026-09-15.csv"
with open(match_csv, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(rows_out[0].keys()))
    w.writeheader()
    w.writerows(rows_out)

summary = {
    "qb_export": "CCH Design Inc._Bills and Applied Payments.xlsx",
    "qb_period": "2020-01-01 to 2026-05-20",
    "qb_bills": len(bills),
    "qb_open_count": len(open_bills),
    "qb_open_sum": round(sum(b["open_balance"] for b in open_bills), 2),
    "studio_houzz_pending": len(rows_out),
    "verdicts": dict(c),
    "still_due_verdicts": dict(Counter(r["verdict"] for r in due)),
    "still_due": due,
    "open_bills_top": sorted(open_bills, key=lambda x: -x["open_balance"])[:25],
}
json_path = OUT_DIR / "HOUZZ_PENDING_VS_QB_BILLS_BY_CURSOR_2026-09-15.json"
json_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
print("wrote", match_csv)
print("wrote", open_csv)
print("QB open sum", summary["qb_open_sum"])
