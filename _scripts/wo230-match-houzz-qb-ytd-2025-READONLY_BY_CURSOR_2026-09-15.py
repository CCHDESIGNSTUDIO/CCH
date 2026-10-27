#!/usr/bin/env python3
"""WO-230: line-parse YTD 2026 + 2025 QB Bills PDFs; match Studio Houzz pending. Read-only."""
import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import fitz

YTD = r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz & QB\Quickbooks\Qb Reports\BillsandAppliedPayments 9.15.26.pdf"
Y2025 = r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz & QB\Quickbooks\Qb Reports\BillsandAppliedPayments_2025.pdf"
STUDIO = r"C:\dev\CCH-Platform-Deploy\cch-deploy\_debug\HOUZZ_OPEN_POS_VS_STUDIO_QB_FIELDS_BY_CURSOR_2026-09-15.csv"
OUT = Path(r"C:\dev\CCH-Platform-Deploy\cch-deploy\_debug")

SKIP_LINES = {
    "cch design inc.", "bills and applied payments", "date", "transaction",
    "type", "number", "memo/description", "amount", "open", "balance",
    "(credit card)", "(check)", "(other)",
}
DATE_RE = re.compile(r"^\d{2}/\d{2}/\d{4}$")
MONEY_RE = re.compile(r"^-?[\d,]+\.\d{2}$")
MONEY_FIND = re.compile(r"-?[\d,]+\.\d{2}")
BL_RE = re.compile(r"^BL-[\w-]+$")
BL_START = re.compile(r"^(BL-[\w-]+)\b")


def money(s):
    s = str(s or "").replace(",", "").replace("$", "").strip()
    s = s.replace("\u2212", "-")
    if s in ("", "-", "—"):
        return None
    try:
        return round(float(s), 2)
    except ValueError:
        return None


def page_text(path):
    doc = fitz.open(path)
    parts = []
    for page in doc:
        parts.append(page.get_text())
    doc.close()
    text = "\n".join(parts)
    text = re.sub(r"BL-\s*\n\s*", "BL-", text)
    return text


def parse_pdf(path, year_label):
    lines = [ln.strip() for ln in page_text(path).splitlines()]
    lines = [ln for ln in lines if ln]
    bills = []
    vendor = ""
    i = 0
    n = len(lines)
    while i < n:
        ln = lines[i]
        low = ln.lower()
        if low in SKIP_LINES or low.startswith("january") or low.startswith("tuesday,"):
            i += 1
            continue
        if re.match(r"^\d+/\d+$", ln):  # 1/5 page footer
            i += 1
            continue
        if DATE_RE.match(ln):
            date_s = ln
            i += 1
            if i >= n:
                break
            typ = lines[i]
            i += 1
            if typ.startswith("Bill Payment"):
                # skip payment method + amount
                while i < n and not DATE_RE.match(lines[i]) and not MONEY_RE.match(lines[i]) and lines[i] not in ("Bill",):
                    if lines[i].startswith("("):
                        i += 1
                        continue
                    break
                if i < n and lines[i].startswith("("):
                    i += 1
                if i < n and MONEY_RE.match(lines[i]):
                    i += 1
                continue
            if typ == "Bill":
                txn = ""
                if i < n and BL_START.match(lines[i]):
                    mbl = BL_START.match(lines[i])
                    txn = mbl.group(1)
                    rest = lines[i][mbl.end():].strip()
                    i += 1
                    extra_memo = rest
                else:
                    extra_memo = ""
                memo_parts = [extra_memo] if extra_memo else []
                amts = []
                while i < n:
                    cur = lines[i]
                    if DATE_RE.match(cur):
                        break
                    if cur.lower() in SKIP_LINES or cur.lower().startswith("january") or cur.lower().startswith("tuesday,"):
                        i += 1
                        continue
                    if re.match(r"^\d+/\d+$", cur):
                        i += 1
                        continue
                    two_money = re.match(r"^(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})$", cur)
                    if two_money:
                        amts.extend([money(two_money.group(1)), money(two_money.group(2))])
                        i += 1
                        break
                    if MONEY_RE.match(cur):
                        amts.append(money(cur))
                        i += 1
                        if i < n:
                            two2 = re.match(r"^(-?[\d,]+\.\d{2})\s+(-?[\d,]+\.\d{2})$", lines[i])
                            if two2:
                                amts.extend([money(two2.group(1)), money(two2.group(2))])
                                i += 1
                            elif MONEY_RE.match(lines[i]):
                                amts.append(money(lines[i]))
                                i += 1
                        break
                    # vendor name appearing after a bill block without amounts is next vendor
                    if not DATE_RE.match(cur) and cur != "Bill" and not cur.startswith("Bill Payment") and not BL_RE.match(cur):
                        # could be memo or next vendor. If next line is a date, it's a vendor.
                        nxt = lines[i + 1] if i + 1 < n else ""
                        if DATE_RE.match(nxt) or (nxt == "Bill" or nxt.startswith("Bill Payment")):
                            break
                        memo_parts.append(cur)
                        i += 1
                        continue
                    i += 1
                amt = amts[0] if amts else 0.0
                bal = amts[1] if len(amts) > 1 else 0.0
                bills.append({
                    "source": year_label,
                    "vendor": vendor,
                    "date": date_s,
                    "txn": txn,
                    "memo": " ".join(memo_parts)[:200],
                    "amount": amt if amt is not None else 0.0,
                    "open_balance": bal if bal is not None else 0.0,
                })
                continue
            continue
        # vendor header
        if not DATE_RE.match(ln) and ln not in ("Bill",) and not ln.startswith("Bill Payment") and not BL_RE.match(ln) and not MONEY_RE.match(ln):
            # accumulate wrapped vendor (next line not a date)
            name = ln
            j = i + 1
            while j < n and not DATE_RE.match(lines[j]) and lines[j] not in ("Bill",) and not lines[j].startswith("Bill Payment") and not BL_RE.match(lines[j]) and not MONEY_RE.match(lines[j]) and lines[j].lower() not in SKIP_LINES and not re.match(r"^\d+/\d+$", lines[j]) and not lines[j].lower().startswith("tuesday"):
                if lines[j].lower().startswith("january"):
                    break
                name += " " + lines[j]
                j += 1
            vendor = name
            i = j
            continue
        i += 1
    return bills


def po_keys(po):
    d = re.sub(r"\D", "", str(po or ""))
    keys = set()
    if not d:
        return keys
    keys.add(d)
    if d.startswith("24") and len(d) > 2:
        keys.add(d[2:])
        keys.add("24" + d[2:])
    if d.startswith("400") and len(d) > 3:
        keys.add("888" + d[3:])
        keys.add("24" + d)
    if d.startswith("888") and len(d) > 3:
        keys.add("400" + d[3:])
    m = re.search(r"(400\d{3,})", d)
    if m:
        keys.add(m.group(1))
    return keys


def txn_keys(txn):
    d = re.sub(r"\D", "", str(txn or ""))
    keys = set()
    if not d:
        return keys
    keys.add(d)
    d2 = re.sub(r"HZ$", "", d, flags=re.I)
    keys.add(d2)
    if d2.startswith("24") and len(d2) > 2:
        keys.add(d2[2:])
    m = re.search(r"(400\d{3,})", d)
    if m:
        keys.add(m.group(1))
    return keys


bills_ytd = parse_pdf(YTD, "YTD2026")
bills_25 = parse_pdf(Y2025, "2025")
print("parsed YTD", len(bills_ytd), "2025", len(bills_25))
print("sample YTD", bills_ytd[:3])
print("sample 2025 HZ", [b for b in bills_25 if "HZ" in b["txn"]][:3])

by_key = defaultdict(list)
for b in bills_ytd + bills_25:
    for k in txn_keys(b["txn"]):
        by_key[k].append(b)

studio = list(csv.DictReader(open(STUDIO, encoding="utf-8")))
out_rows = []
for s in studio:
    remaining = float(s["remaining"] or 0)
    hits = []
    seen = set()
    for k in po_keys(s["poNum"]):
        for b in by_key.get(k, []):
            sid = (b["source"], b["txn"], b["date"], b["amount"])
            if sid in seen:
                continue
            seen.add(sid)
            hits.append(b)
    # prefer YTD over 2025 for same txn
    hits.sort(key=lambda h: (0 if h["source"] == "YTD2026" else 1, -abs(h["open_balance"])))
    if hits:
        open_h = [h for h in hits if (h["open_balance"] or 0) > 0.02]
        best = open_h[0] if open_h else hits[0]
        if (best["open_balance"] or 0) > 0.02:
            verdict = "QB_STILL_OPEN"
        else:
            verdict = "QB_PAID_CLOSED"
        out_rows.append({
            "verdict": verdict,
            "studio_po": s["poNum"],
            "studio_project": s["project"],
            "studio_vendor": s["vendor"],
            "studio_remaining": remaining,
            "studio_bucket": s["bucket"],
            "qb_txn": best["txn"],
            "qb_vendor": best["vendor"],
            "qb_date": best["date"],
            "qb_amount": best["amount"],
            "qb_open_balance": best["open_balance"],
            "qb_source": best["source"],
            "qb_hit_count": len(hits),
        })
    else:
        out_rows.append({
            "verdict": "NOT_IN_YTD_OR_2025_PDF",
            "studio_po": s["poNum"],
            "studio_project": s["project"],
            "studio_vendor": s["vendor"],
            "studio_remaining": remaining,
            "studio_bucket": s["bucket"],
            "qb_txn": "",
            "qb_vendor": "",
            "qb_date": "",
            "qb_amount": "",
            "qb_open_balance": "",
            "qb_source": "",
            "qb_hit_count": 0,
        })

due = [r for r in out_rows if r["studio_remaining"] > 0.02]
print("verdicts all", dict(Counter(r["verdict"] for r in out_rows)))
print("verdicts still-due", dict(Counter(r["verdict"] for r in due)))

open_ytd = [b for b in bills_ytd if (b["open_balance"] or 0) > 0.02]
ytd_txns = {b["txn"] for b in bills_ytd}
open_25_only = [b for b in bills_25 if (b["open_balance"] or 0) > 0.02 and b["txn"] not in ytd_txns]

print("open YTD", len(open_ytd), round(sum(b["open_balance"] for b in open_ytd), 2))
for b in sorted(open_ytd, key=lambda x: -x["open_balance"]):
    print(f"  {b['open_balance']:10.2f}  {b['txn']:18}  {b['vendor'][:36]:36}  {b['date']}")
print("open 2025 leftover", len(open_25_only), round(sum(b["open_balance"] for b in open_25_only), 2))
for b in sorted(open_25_only, key=lambda x: -x["open_balance"]):
    print(f"  {b['open_balance']:10.2f}  {b['txn']:18}  {b['vendor'][:36]:36}  {b['date']}")

print("still-due detail:")
for r in due:
    print(f"  {r['verdict']:24}  {r['studio_po']:16}  {r['studio_vendor'][:28]:28}  studio ${r['studio_remaining']:<10}  qb {r['qb_txn']} open={r['qb_open_balance']}")

match_csv = OUT / "HOUZZ_PENDING_VS_QB_YTD_AND_2025_BY_CURSOR_2026-09-15.csv"
with open(match_csv, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(out_rows[0].keys()))
    w.writeheader()
    w.writerows(out_rows)

open_csv = OUT / "QB_OPEN_BILLS_YTD2026_AND_2025_BY_CURSOR.csv"
fields = ["source", "vendor", "date", "txn", "memo", "amount", "open_balance"]
with open(open_csv, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=fields)
    w.writeheader()
    for b in sorted(open_ytd + open_25_only, key=lambda x: (-x["open_balance"], x["source"])):
        w.writerow(b)

summary = {
    "ytd_file": "BillsandAppliedPayments 9.15.26.pdf",
    "ytd_period": "Jan 1 – Sep 15 2026",
    "y2025_file": "BillsandAppliedPayments_2025.pdf",
    "parsed_ytd": len(bills_ytd),
    "parsed_2025": len(bills_25),
    "open_ytd_count": len(open_ytd),
    "open_ytd_sum": round(sum(b["open_balance"] for b in open_ytd), 2),
    "open_2025_not_in_ytd_count": len(open_25_only),
    "open_2025_not_in_ytd_sum": round(sum(b["open_balance"] for b in open_25_only), 2),
    "studio_pending": len(out_rows),
    "studio_verdicts": dict(Counter(r["verdict"] for r in out_rows)),
    "still_due_count": len(due),
    "still_due_verdicts": dict(Counter(r["verdict"] for r in due)),
    "still_due": due,
    "open_ytd": sorted(open_ytd, key=lambda x: -x["open_balance"]),
    "open_2025_leftover": sorted(open_25_only, key=lambda x: -x["open_balance"]),
    "no_close_without_cindy_go": True,
}
studio_po_keys = set()
for s in studio:
    studio_po_keys |= po_keys(s["poNum"])
qb_open_not_in_studio = []
for b in open_ytd + open_25_only:
    keys = txn_keys(b["txn"])
    if not (keys & studio_po_keys):
        qb_open_not_in_studio.append(b)
print("QB open not in Studio Houzz pending:")
for b in qb_open_not_in_studio:
    print(f"  {b['open_balance']:10.2f}  {b['txn']:18}  {b['vendor'][:36]:36}  {b['source']}")
summary["qb_open_not_in_studio_pending"] = qb_open_not_in_studio
(OUT / "HOUZZ_PENDING_VS_QB_YTD_AND_2025_BY_CURSOR_2026-09-15.json").write_text(
    json.dumps(summary, indent=2), encoding="utf-8")
print("wrote", match_csv.name)
