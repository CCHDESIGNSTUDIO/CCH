"""
Analyze the Apr 27 Houzz account export.
Prints accurate logical row counts and key cardinality stats per section.
"""
import csv
import sys
from collections import Counter, defaultdict

MAIN = r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\cchdesign_0427.csv"
CATALOG = r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\catalog-items-with-images_cchdesign_0427.csv"

# Section markers we found (start lines), in order
SECTIONS = [
    ("COMPANY", 1280),
    ("TEAM_MEMBERS", 1324),
    ("ADDRESSES", 1338),
    ("CLIENTS", 1355),
    ("PRODUCTS", 1543),
    ("PROJECTS", 57988),
    ("VENDORS", 71781),
    ("INVOICES", 73283),
    ("TASKS", 175870),
    ("PURCHASE_ORDERS", 216610),
    ("FILES", 293599),
]

def section_lines(start, next_start):
    return next_start - start - 1

def split_into_sections(path):
    """Read whole file as CSV-aware, slicing by raw line numbers using a re-parse."""
    # Read raw text
    with open(path, encoding="utf-8", errors="replace") as f:
        raw = f.read()
    # We need to count proper CSV rows per section. Use csv.reader on each slice.
    # But the section-marker line ("CLIENTS\n") is itself a single-cell line; the next
    # blank, then header, then data rows.
    # Simpler approach: scan once with csv.reader, track current section by uppercase
    # single-cell rows that match our known names.
    section_names = {s for s, _ in SECTIONS}
    rows_per_section = defaultdict(list)
    current = "PRELUDE"
    headers = {}
    f = open(path, encoding="utf-8", errors="replace", newline="")
    reader = csv.reader(f)
    expecting_header = False
    for row in reader:
        if len(row) == 1 and row[0].strip() in section_names:
            current = row[0].strip()
            expecting_header = True
            continue
        if expecting_header and any(c.strip() for c in row):
            # header row for this section
            headers[current] = row
            expecting_header = False
            continue
        # blank padding rows
        if not any(c.strip() for c in row):
            continue
        rows_per_section[current].append(row)
    f.close()
    return rows_per_section, headers

def main():
    print("=" * 70)
    print("Apr 27 Houzz export — logical row counts (CSV-aware)")
    print("=" * 70)
    rows, headers = split_into_sections(MAIN)
    for name, _ in SECTIONS:
        n = len(rows.get(name, []))
        cols = len(headers.get(name, []))
        print(f"  {name:<18} {n:>7,} rows  ({cols} cols)")

    print()
    print("-" * 70)
    print("Cardinality:")
    print("-" * 70)

    # CLIENTS — unique by name+email
    if "CLIENTS" in rows:
        h = headers["CLIENTS"]
        try:
            ni = h.index("NAME"); ei = h.index("EMAIL")
            archi = h.index("IS_ARCHIVED") if "IS_ARCHIVED" in h else None
            active = [r for r in rows["CLIENTS"] if archi is None or (len(r) > archi and r[archi].lower() != "yes")]
            archived = [r for r in rows["CLIENTS"] if archi is not None and len(r) > archi and r[archi].lower() == "yes"]
            print(f"  CLIENTS: {len(rows['CLIENTS'])} total · {len(active)} active · {len(archived)} archived")
            # First few non-Default clients
            samples = [r[ni] for r in active if len(r) > ni and r[ni] and r[ni] != "Default Client"][:8]
            print(f"    examples: {', '.join(samples)}")
        except Exception as e:
            print(f"  CLIENTS analysis error: {e}")

    # PROJECTS — unique by project_name
    if "PROJECTS" in rows:
        h = headers["PROJECTS"]
        try:
            pn_i = h.index("PROJECT_NAME")
            cn_i = h.index("CLIENT_NAME") if "CLIENT_NAME" in h else None
            arch_i = h.index("IS_ARCHIVED") if "IS_ARCHIVED" in h else None
            project_names = Counter()
            for r in rows["PROJECTS"]:
                if len(r) > pn_i and r[pn_i].strip():
                    project_names[r[pn_i].strip()] += 1
            unique_projects = len(project_names)
            total_rows = sum(project_names.values())
            print(f"  PROJECTS: {total_rows} rows · {unique_projects} unique project names")
            # If projects appear many times, the "rows" are likely room/board records under the project
            multi = [(n, c) for n, c in project_names.items() if c > 1]
            if multi:
                multi.sort(key=lambda x: -x[1])
                print(f"    {len(multi)} projects appear >1× (likely room/board sub-records)")
                for n, c in multi[:5]:
                    print(f"      {n}: {c} rows")
            samples = [n for n in list(project_names.keys())[:10] if n != "Sample Project from Houzz"]
            print(f"    examples: {', '.join(samples[:8])}")
        except Exception as e:
            print(f"  PROJECTS analysis error: {e}")

    # VENDORS
    if "VENDORS" in rows:
        h = headers["VENDORS"]
        try:
            cn_i = h.index("COMPANY_NAME")
            arch_i = h.index("IS_ARCHIVED") if "IS_ARCHIVED" in h else None
            active = [r for r in rows["VENDORS"] if arch_i is None or (len(r) > arch_i and r[arch_i].lower() != "yes")]
            print(f"  VENDORS: {len(rows['VENDORS'])} total · {len(active)} active")
        except Exception as e:
            print(f"  VENDORS analysis error: {e}")

    # INVOICES — count unique invoice numbers
    if "INVOICES" in rows:
        h = headers["INVOICES"]
        try:
            in_i = h.index("INVOICE_NUMBER")
            it_i = h.index("INVOICE_TYPE") if "INVOICE_TYPE" in h else None
            inv_nums = set()
            type_counts = Counter()
            for r in rows["INVOICES"]:
                if len(r) > in_i and r[in_i].strip():
                    inv_nums.add(r[in_i].strip())
                if it_i is not None and len(r) > it_i:
                    type_counts[r[it_i].strip()] += 1
            print(f"  INVOICES: {len(rows['INVOICES'])} rows · {len(inv_nums)} unique invoice numbers")
            print(f"    types: {dict(type_counts.most_common())}")
        except Exception as e:
            print(f"  INVOICES analysis error: {e}")

    # PURCHASE_ORDERS
    if "PURCHASE_ORDERS" in rows:
        h = headers["PURCHASE_ORDERS"]
        try:
            po_i = h.index("PURCHASE_ORDER_NUMBER")
            po_nums = set()
            for r in rows["PURCHASE_ORDERS"]:
                if len(r) > po_i and r[po_i].strip():
                    po_nums.add(r[po_i].strip())
            print(f"  PURCHASE_ORDERS: {len(rows['PURCHASE_ORDERS'])} rows · {len(po_nums)} unique PO numbers")
        except Exception as e:
            print(f"  PURCHASE_ORDERS analysis error: {e}")

    # PRODUCTS in main file
    if "PRODUCTS" in rows:
        h = headers["PRODUCTS"]
        try:
            mi = h.index("MANUFACTURER") if "MANUFACTURER" in h else None
            arch_i = h.index("IS_ARCHIVED") if "IS_ARCHIVED" in h else None
            mfrs = Counter()
            active = 0
            for r in rows["PRODUCTS"]:
                if arch_i is not None and len(r) > arch_i and r[arch_i].lower() == "yes":
                    continue
                active += 1
                if mi is not None and len(r) > mi and r[mi].strip():
                    mfrs[r[mi].strip()] += 1
            print(f"  PRODUCTS: {len(rows['PRODUCTS'])} total · {active} active")
            print(f"    top manufacturers: {[m for m, _ in mfrs.most_common(8)]}")
        except Exception as e:
            print(f"  PRODUCTS analysis error: {e}")

    # CATALOG file (separate file with images)
    print()
    print("-" * 70)
    print("Catalog file (separate, with images):")
    print("-" * 70)
    with open(CATALOG, encoding="utf-8", errors="replace", newline="") as f:
        cr = csv.reader(f)
        cat_header = next(cr)
        cat_rows = list(cr)
    print(f"  {len(cat_rows)} catalog items · {len(cat_header)} cols")
    # Count by item_type (Service vs Product)
    if "item_type" in cat_header:
        ti = cat_header.index("item_type")
        types = Counter(r[ti].strip() for r in cat_rows if len(r) > ti)
        print(f"  item_type distribution: {dict(types.most_common())}")
    # Items with at least one image
    img_cols = [i for i, c in enumerate(cat_header) if c.startswith("image")]
    with_img = sum(1 for r in cat_rows if any(len(r) > i and r[i].strip() for i in img_cols))
    print(f"  items with ≥1 image: {with_img}")

if __name__ == "__main__":
    main()
