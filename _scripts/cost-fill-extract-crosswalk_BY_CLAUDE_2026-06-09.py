# READ-ONLY: extract fillable cost rows from HOUZZ_STUDIO_CROSSWALK.xlsx (Matched sheet).
# Fillable = studio_cost missing/0 AND houzz_cost > 0. Dedup by studio_doc_id; flag cost conflicts.
# Writes a JSON the Node dry-run consumes. No Firestore access here.
import json, re, os
import pandas as pd

XL = r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz & QB\Audits and Clean up data\HOUZZ_STUDIO_CROSSWALK.xlsx"
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "_backup", "cost-fill-2026-06-09")
os.makedirs(OUT_DIR, exist_ok=True)

def num(v):
    s = re.sub(r"[^0-9.]", "", str(v))
    try: return float(s) if s else 0.0
    except: return 0.0

df = pd.read_excel(XL, sheet_name="Matched", dtype=str).fillna("")
df["hc"] = df["houzz_cost"].map(num)
df["sc"] = df["studio_cost"].map(num)
fill = df[(df.sc <= 0) & (df.hc > 0) & (df["studio_doc_id"].str.strip() != "")]

by_doc = {}
for _, r in fill.iterrows():
    did = r["studio_doc_id"].strip()
    rec = by_doc.setdefault(did, {
        "studio_doc_id": did,
        "studio_collection": (r["studio_collection"].strip() or "products"),
        "studio_title": r["studio_title"].strip(),
        "houzz_cost": r["hc"],
        "houzz_ids": [],
        "match_methods": set(),
        "costs_seen": set(),
    })
    rec["houzz_ids"].append(r["houzz_id"].strip())
    rec["match_methods"].add(r["match_method"].strip())
    rec["costs_seen"].add(round(r["hc"], 2))

rows = []
conflicts = 0
for did, rec in by_doc.items():
    costs = sorted(rec["costs_seen"])
    conflict = len(costs) > 1
    if conflict: conflicts += 1
    rows.append({
        "studio_doc_id": did,
        "studio_collection": rec["studio_collection"],
        "studio_title": rec["studio_title"],
        "houzz_cost": costs[-1] if conflict else rec["houzz_cost"],  # if conflict, take highest; flagged for review
        "houzz_ids": rec["houzz_ids"],
        "match_method": "sku" if "sku" in rec["match_methods"] else "title",
        "cost_conflict": conflict,
        "costs_seen": costs,
    })

out = os.path.join(OUT_DIR, "fillable_from_crosswalk.json")
json.dump(rows, open(out, "w", encoding="utf-8"), indent=2)
print("Fillable raw rows:", len(fill))
print("Unique studio_doc_id targets:", len(rows))
print("  by SKU match:", sum(1 for r in rows if r["match_method"] == "sku"))
print("  by TITLE match:", sum(1 for r in rows if r["match_method"] == "title"))
print("  cost conflicts (same doc, differing houzz_cost):", conflicts)
print("Wrote:", out)
