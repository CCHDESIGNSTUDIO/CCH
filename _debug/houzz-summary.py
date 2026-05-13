"""Compact Houzz export summary -> writes to summary.txt"""
import csv
from collections import Counter

MAIN = r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\cchdesign_0427.csv"
CATALOG = r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\catalog-items-with-images_cchdesign_0427.csv"
OUT = "summary.txt"

SECTIONS = {"COMPANY","TEAM_MEMBERS","ADDRESSES","CLIENTS","PRODUCTS","PROJECTS","VENDORS","INVOICES","TASKS","PURCHASE_ORDERS","FILES"}

rows = {s: [] for s in SECTIONS}
headers = {}
current = None
expecting_header = False

with open(MAIN, encoding="utf-8", errors="replace", newline="") as f:
    for row in csv.reader(f):
        if len(row) == 1 and row[0].strip() in SECTIONS:
            current = row[0].strip()
            expecting_header = True
            continue
        if not any(c.strip() for c in row):
            continue
        if expecting_header:
            headers[current] = row
            expecting_header = False
            continue
        if current in rows:
            rows[current].append(row)

def col(section, name):
    h = headers.get(section, [])
    return h.index(name) if name in h else None

lines = []
def w(s=""): lines.append(s)

w("HOUZZ APR 27 EXPORT - SUMMARY")
w("="*60)
for s in ["COMPANY","TEAM_MEMBERS","ADDRESSES","CLIENTS","PRODUCTS","PROJECTS","VENDORS","INVOICES","TASKS","PURCHASE_ORDERS","FILES"]:
    w(f"  {s:<18} {len(rows[s]):>7,}")

# CLIENTS
w()
w("CLIENTS — sample list:")
ni = col("CLIENTS","NAME"); ei = col("CLIENTS","EMAIL"); arch_i = col("CLIENTS","IS_ARCHIVED")
client_names = []
for r in rows["CLIENTS"]:
    if ni is not None and len(r) > ni:
        nm = r[ni].strip()
        if nm and nm != "Default Client":
            client_names.append(nm)
w(f"  total non-default: {len(client_names)}")
w("  first 30: " + ", ".join(client_names[:30]))

# PROJECTS - find unique
w()
w("PROJECTS — unique project names:")
pn_i = col("PROJECTS","PROJECT_NAME")
cn_i = col("PROJECTS","CLIENT_NAME")
proj_clients = {}
for r in rows["PROJECTS"]:
    if pn_i is not None and len(r) > pn_i:
        n = r[pn_i].strip()
        if n and not n.startswith("20"):  # skip the timestamp-named ones
            cli = r[cn_i].strip() if cn_i is not None and len(r) > cn_i else ""
            proj_clients.setdefault(n, cli)
w(f"  total unique (excl timestamp-named): {len(proj_clients)}")
named_projects = sorted(proj_clients.items())
for n, c in named_projects[:60]:
    w(f"    {n}  ({c})" if c else f"    {n}")
if len(named_projects) > 60:
    w(f"  ... and {len(named_projects)-60} more")

# VENDORS - top by frequency
w()
w("VENDORS — sample list:")
cn_i = col("VENDORS","COMPANY_NAME")
vendor_names = []
for r in rows["VENDORS"]:
    if cn_i is not None and len(r) > cn_i:
        nm = r[cn_i].strip()
        if nm:
            vendor_names.append(nm)
w(f"  total: {len(vendor_names)}")
w("  first 30: " + ", ".join(vendor_names[:30]))

# INVOICES - just unique counts and types (no full dict)
w()
w("INVOICES:")
in_i = col("INVOICES","INVOICE_NUMBER")
it_i = col("INVOICES","INVOICE_TYPE")
total_paid_i = col("INVOICES","TOTAL_PAID")
total_pay_i = col("INVOICES","TOTAL_PAYMENT")
inv_nums = set(); type_counts = Counter()
total_total = 0.0; total_paid_sum = 0.0
for r in rows["INVOICES"]:
    if in_i is not None and len(r) > in_i:
        n = r[in_i].strip()
        if n: inv_nums.add(n)
    if it_i is not None and len(r) > it_i:
        t = r[it_i].strip()[:30]  # truncate huge values
        if t: type_counts[t] += 1
    if total_pay_i is not None and len(r) > total_pay_i:
        try: total_total += float(r[total_pay_i].replace(",","") or 0)
        except: pass
    if total_paid_i is not None and len(r) > total_paid_i:
        try: total_paid_sum += float(r[total_paid_i].replace(",","") or 0)
        except: pass
w(f"  unique invoice numbers: {len(inv_nums)}")
w(f"  total rows (line items + headers): {len(rows['INVOICES'])}")
w(f"  TYPE distribution (top 20):")
for t, c in type_counts.most_common(20):
    w(f"    {t}: {c}")
w(f"  sum TOTAL_PAYMENT (all rows incl line items): ${total_total:,.2f}")
w(f"  sum TOTAL_PAID (all rows incl line items): ${total_paid_sum:,.2f}")

# PURCHASE ORDERS
w()
w("PURCHASE_ORDERS:")
po_i = col("PURCHASE_ORDERS","PURCHASE_ORDER_NUMBER")
po_nums = set()
for r in rows["PURCHASE_ORDERS"]:
    if po_i is not None and len(r) > po_i:
        n = r[po_i].strip()
        if n: po_nums.add(n)
w(f"  unique PO numbers: {len(po_nums)}")
w(f"  total rows: {len(rows['PURCHASE_ORDERS'])}")

# PRODUCTS
w()
w("PRODUCTS (in main file):")
mfi = col("PRODUCTS","MANUFACTURER")
arch_i = col("PRODUCTS","IS_ARCHIVED")
mfrs = Counter()
active = 0
for r in rows["PRODUCTS"]:
    if arch_i is not None and len(r) > arch_i and r[arch_i].lower() == "yes":
        continue
    active += 1
    if mfi is not None and len(r) > mfi:
        m = r[mfi].strip()
        if m: mfrs[m] += 1
w(f"  active products: {active} of {len(rows['PRODUCTS'])}")
w(f"  top manufacturers:")
for m, c in mfrs.most_common(15):
    w(f"    {m}: {c}")

# CATALOG
w()
w("CATALOG file (catalog-items-with-images):")
with open(CATALOG, encoding="utf-8", errors="replace", newline="") as f:
    cr = csv.reader(f)
    cat_h = next(cr)
    cat = list(cr)
w(f"  total: {len(cat)} rows, {len(cat_h)} cols")
ti = cat_h.index("item_type") if "item_type" in cat_h else None
if ti is not None:
    types = Counter(r[ti].strip() for r in cat if len(r) > ti)
    w(f"  item_type: {dict(types.most_common())}")
img_cols = [i for i, c in enumerate(cat_h) if c.startswith("image")]
with_img = sum(1 for r in cat if any(len(r) > i and r[i].strip() for i in img_cols))
w(f"  with >=1 image: {with_img}")
sup_i = cat_h.index("supplier") if "supplier" in cat_h else None
if sup_i is not None:
    sups = Counter(r[sup_i].strip() for r in cat if len(r) > sup_i and r[sup_i].strip())
    w(f"  top suppliers:")
    for s, c in sups.most_common(15):
        w(f"    {s}: {c}")

with open(OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print(f"Wrote {OUT} ({len(lines)} lines)")
