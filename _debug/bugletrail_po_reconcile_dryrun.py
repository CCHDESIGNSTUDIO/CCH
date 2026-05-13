import csv
import json
from pathlib import Path

EXPORT_CSV = Path(r"c:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\cchdesign_0427.csv")
SNAPSHOT_JSON = Path(__file__).with_name("bugletrail-prod-po-snapshot.json")
REPORT_JSON = Path(__file__).with_name("bugletrail-po-reconcile-dryrun-report.json")


def f(v):
    try:
        return float(v or 0)
    except Exception:
        return 0.0


def po_number_from_code(code):
    code = str(code or "").strip()
    return f"PO-{code}" if code else ""


def read_export_po_rows():
    in_docs = False
    header = None
    out = []
    with EXPORT_CSV.open("r", encoding="utf-8", newline="") as fp:
        rd = csv.reader(fp)
        for row in rd:
            if row and row[0].strip() == "DOCUMENTS":
                in_docs = True
                continue
            if not in_docs:
                continue
            if row and row[0].strip() == "DOCUMENT_NUMBER":
                header = row
                continue
            if not header or not row:
                continue
            d = {header[i]: (row[i] if i < len(row) else "") for i in range(len(header))}
            if d.get("PROJECT_NAME", "").strip() != "7225 Bugletrail":
                continue
            if d.get("TYPE", "").strip() != "PurchaseDocument":
                continue
            code = str(d.get("CODE", "")).strip()
            po_num = po_number_from_code(code)
            out.append(
                {
                    "poNumber": po_num,
                    "code": code,
                    "name": d.get("NAME", ""),
                    "status": d.get("STATUS", ""),
                    "totalPayment": f(d.get("TOTAL_PAYMENT", "")),
                    "totalPaid": f(d.get("TOTAL_PAID", "")),
                    "issuedAt": d.get("ISSUED_AT", ""),
                    "sentDate": d.get("SENT_DATE", ""),
                }
            )
    return out


def normalize_status(s):
    s = str(s or "").strip().lower()
    if s == "paid":
        return "Paid"
    if s == "draft":
        return "Draft"
    if s == "ordered":
        return "Ordered"
    return str(s).title() if s else ""


def main():
    if not SNAPSHOT_JSON.exists():
        raise SystemExit(f"Missing snapshot file: {SNAPSHOT_JSON}")

    snap = json.loads(SNAPSHOT_JSON.read_text(encoding="utf-8"))
    studio_rows = snap.get("rows", [])
    studio_by_num = {}
    for r in studio_rows:
        n = str(r.get("number", "")).strip()
        if n and n not in studio_by_num:
            studio_by_num[n] = r

    export_rows = read_export_po_rows()
    export_by_num = {}
    for e in export_rows:
        n = e["poNumber"]
        if not n:
            continue
        prev = export_by_num.get(n)
        if prev is None or e["totalPaid"] > prev["totalPaid"] or e["totalPayment"] > prev["totalPayment"]:
            export_by_num[n] = e

    would_create = []
    would_update = []
    no_change = []

    for num, e in sorted(export_by_num.items()):
        existing = studio_by_num.get(num)
        desired_paid = e["totalPaid"]
        desired_total = e["totalPayment"]
        desired_status = normalize_status(e["status"])

        if not existing:
            would_create.append(
                {
                    "poNumber": num,
                    "status": desired_status or "Ordered",
                    "total": desired_total,
                    "paidAmount": desired_paid,
                    "sourceName": e["name"],
                    "reason": "Missing in Studio purchaseOrders",
                }
            )
            continue

        changes = {}
        cur_paid = f(existing.get("paidAmount", 0))
        cur_total = f(existing.get("total", 0))
        cur_status = str(existing.get("status", "")).strip()

        if desired_paid > cur_paid + 0.009:
            changes["paidAmount"] = {"from": cur_paid, "to": desired_paid}
        if desired_total > 0 and abs(cur_total - desired_total) > 0.009:
            changes["total"] = {"from": cur_total, "to": desired_total}
        if desired_status and desired_status != cur_status:
            changes["status"] = {"from": cur_status, "to": desired_status}

        if changes:
            would_update.append(
                {
                    "poNumber": num,
                    "docId": existing.get("id", ""),
                    "changes": changes,
                    "sourceName": e["name"],
                }
            )
        else:
            no_change.append(num)

    report = {
        "project": "7225 Bugletrail",
        "source": str(EXPORT_CSV),
        "snapshot": str(SNAPSHOT_JSON),
        "summary": {
            "studioRows": len(studio_rows),
            "studioUniquePoNumbers": len(studio_by_num),
            "exportPurchaseDocuments": len(export_rows),
            "exportUniquePoNumbers": len(export_by_num),
            "wouldCreate": len(would_create),
            "wouldUpdate": len(would_update),
            "noChange": len(no_change),
        },
        "wouldCreateSample": would_create[:25],
        "wouldUpdateSample": would_update[:25],
    }

    REPORT_JSON.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report["summary"], indent=2))
    print(f"Report written: {REPORT_JSON}")


if __name__ == "__main__":
    main()
