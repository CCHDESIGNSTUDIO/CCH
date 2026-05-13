import csv
import json

EXPORT_CSV = r"c:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\cchdesign_0427.csv"

# Current known Studio Bugletrail PO numbers observed in Firestore.
STUDIO_PO_NUMBERS = {"PO-400120", "PO-9002", "PO-9003", "PO-9004"}


def to_float(v):
    try:
        return float(v or 0)
    except Exception:
        return 0.0


def main():
    rows = []
    in_docs = False
    header = None

    with open(EXPORT_CSV, "r", encoding="utf-8", newline="") as f:
        reader = csv.reader(f)
        for r in reader:
            if r and r[0].strip() == "DOCUMENTS":
                in_docs = True
                continue
            if not in_docs:
                continue
            if r and r[0].strip() == "DOCUMENT_NUMBER":
                header = r
                continue
            if not header or not r:
                continue

            d = {header[i]: (r[i] if i < len(r) else "") for i in range(len(header))}
            if d.get("PROJECT_NAME", "").strip() != "7225 Bugletrail":
                continue
            if d.get("TYPE", "").strip() != "PurchaseDocument":
                continue

            code = str(d.get("CODE", "")).strip()
            po_num = f"PO-{code}" if code else ""
            total_payment = to_float(d.get("TOTAL_PAYMENT", ""))
            total_paid = to_float(d.get("TOTAL_PAID", ""))
            rows.append(
                {
                    "code": code,
                    "poNumber": po_num,
                    "status": d.get("STATUS", ""),
                    "totalPayment": total_payment,
                    "totalPaid": total_paid,
                    "matchedStudioByCode": po_num in STUDIO_PO_NUMBERS,
                    "name": d.get("NAME", ""),
                }
            )

    paid_rows = [x for x in rows if x["totalPaid"] > 0]
    missing_paid = [x for x in paid_rows if not x["matchedStudioByCode"]]

    report = {
        "project": "7225 Bugletrail",
        "exportPurchaseDocs": len(rows),
        "exportPaidPOs": len(paid_rows),
        "studioPoNumbersSeen": sorted(STUDIO_PO_NUMBERS),
        "matchedToStudioByPOCode": sum(1 for x in rows if x["matchedStudioByCode"]),
        "paidMissingInStudioByPOCode": len(missing_paid),
        "sampleMissingPaidPOs": missing_paid[:15],
    }
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
