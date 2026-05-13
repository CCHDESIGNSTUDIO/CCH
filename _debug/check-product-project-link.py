"""Verify whether Houzz export links products-with-images to specific projects."""
import csv
from collections import Counter, defaultdict

MAIN = r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\cchdesign_0427.csv"
OUT = "product-project-link-check.txt"

SECTIONS = {"COMPANY","TEAM_MEMBERS","ADDRESSES","CLIENTS","PRODUCTS","PROJECTS","VENDORS","INVOICES","TASKS","PURCHASE_ORDERS","FILES"}

rows = {s: [] for s in SECTIONS}
headers = {}
current = None; expect = False
with open(MAIN, encoding="utf-8", errors="replace", newline="") as f:
    for r in csv.reader(f):
        if len(r)==1 and r[0].strip() in SECTIONS:
            current = r[0].strip(); expect = True; continue
        if not any(c.strip() for c in r): continue
        if expect:
            headers[current] = r; expect = False; continue
        if current in rows: rows[current].append(r)

lines = []
def w(s=""): lines.append(s)

w("=" * 60); w("PRODUCT <-> PROJECT LINK INVESTIGATION"); w("=" * 60)

# 1. PROJECTS sub-records — are timestamp-named rows actually room boards?
w(); w("[1] PROJECTS section — what are the timestamp-named sub-rows?")
proj_h = headers["PROJECTS"]
pn_i = proj_h.index("PROJECT_NAME")
img_i = proj_h.index("IMAGE_NAME") if "IMAGE_NAME" in proj_h else None
notes_i = proj_h.index("GENERAL_NOTES") if "GENERAL_NOTES" in proj_h else None
ts_named = 0; named = 0
ts_with_image = 0; named_with_image = 0
ts_samples = []
for r in rows["PROJECTS"]:
    if len(r) <= pn_i: continue
    name = r[pn_i].strip()
    if not name: continue
    is_ts = name[:4].isdigit() and "-" in name and ":" in name
    has_img = img_i is not None and len(r) > img_i and r[img_i].strip()
    if is_ts:
        ts_named += 1
        if has_img: ts_with_image += 1
        if len(ts_samples) < 5:
            populated = {proj_h[i]: r[i][:60] for i in range(min(len(r), len(proj_h))) if r[i].strip()}
            ts_samples.append(populated)
    else:
        named += 1
        if has_img: named_with_image += 1
w(f"  named projects rows: {named} ({named_with_image} with image)")
w(f"  timestamp-named rows: {ts_named} ({ts_with_image} with image)")
w(f"  --> if ts rows have project_id/image data, they are likely room-board records")
w(); w("  Sample timestamp-named rows (which fields are populated):")
for s in ts_samples:
    w(f"    {dict(s)}")

# 2. INVOICES — do sub-rows have product titles?
w(); w("[2] INVOICES section — are the 41K extra rows line items with product names?")
inv_h = headers["INVOICES"]
w(f"  INVOICES columns: {inv_h}")
# Look for TITLE/DESCRIPTION columns
title_cols = [c for c in inv_h if "TITLE" in c.upper() or "DESC" in c.upper() or "ITEM" in c.upper() or "NAME" in c.upper()]
w(f"  columns matching TITLE/DESC/ITEM/NAME: {title_cols}")
# Sample a row that's likely a line item (TYPE = Pieces / Hours / Each)
inv_type_i = inv_h.index("INVOICE_TYPE")
inv_num_i = inv_h.index("INVOICE_NUMBER")
sample_li = []
for r in rows["INVOICES"]:
    if len(r) <= inv_type_i: continue
    t = r[inv_type_i].strip()
    if t in ("Pieces", "Each", "Hours") and len(sample_li) < 5:
        populated = {inv_h[i]: r[i][:60] for i in range(min(len(r), len(inv_h))) if r[i].strip()}
        sample_li.append((r[inv_num_i].strip() if len(r) > inv_num_i else "", populated))
w("  Sample 'line item type' rows:")
for n, s in sample_li:
    w(f"    invoice={n}: {s}")

# 3. FILES — what's in there?
w(); w("[3] FILES section — what kind of file references?")
files_h = headers["FILES"]
w(f"  FILES columns: {files_h}")
w("  First 8 file references:")
for r in rows["FILES"][:8]:
    w(f"    {r}")

# 4. Catalog products: do they have a project_id, project_name, or any project linkage column?
w(); w("[4] CATALOG file column check (re-read header)")
CATALOG = r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\catalog-items-with-images_cchdesign_0427.csv"
with open(CATALOG, encoding="utf-8", errors="replace", newline="") as f:
    cr = csv.reader(f); cat_h = next(cr)
w(f"  Catalog columns: {cat_h}")
project_like = [c for c in cat_h if "project" in c.lower() or "client" in c.lower() or "room" in c.lower()]
w(f"  Project/client/room-like columns in catalog: {project_like}")

# 5. Main PRODUCTS section: same check
w(); w("[5] Main PRODUCTS section column check")
prod_h = headers["PRODUCTS"]
w(f"  PRODUCTS columns: {prod_h}")
project_like2 = [c for c in prod_h if "PROJECT" in c.upper() or "CLIENT" in c.upper() or "ROOM" in c.upper()]
w(f"  Project/client/room-like columns: {project_like2}")

with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print(f"Wrote {OUT}")
