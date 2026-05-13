"""
Build a project-picker spreadsheet from the Apr 27 Houzz export.
Output: Houzz_Projects_Picker_Apr27.csv with columns Cynthia can sort/filter/mark.
"""
import csv
from collections import defaultdict
from datetime import datetime

MAIN = r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\cchdesign_0427.csv"
OUT = r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\Houzz_Projects_Picker_Apr27.csv"

SECTIONS = {"COMPANY","TEAM_MEMBERS","ADDRESSES","CLIENTS","PRODUCTS","PROJECTS","VENDORS","INVOICES","TASKS","PURCHASE_ORDERS","FILES"}

rows = {s: [] for s in SECTIONS}
headers = {}
current = None
expect = False
with open(MAIN, encoding="utf-8", errors="replace", newline="") as f:
    for r in csv.reader(f):
        if len(r)==1 and r[0].strip() in SECTIONS:
            current = r[0].strip(); expect = True; continue
        if not any(c.strip() for c in r): continue
        if expect:
            headers[current] = r; expect = False; continue
        if current in rows: rows[current].append(r)

def col(section, name):
    h = headers.get(section, [])
    return h.index(name) if name in h else None

# Build per-project aggregates
proj_pn = col("PROJECTS","PROJECT_NAME")
proj_cn = col("PROJECTS","CLIENT_NAME")
proj_fn = col("PROJECTS","FIRST_NAME")
proj_ln = col("PROJECTS","LAST_NAME")
proj_city = col("PROJECTS","CITY")
proj_state = col("PROJECTS","STATE")
proj_budget = col("PROJECTS","BUDGET")
proj_created = col("PROJECTS","CREATED_AT")
proj_updated = col("PROJECTS","LAST_UPDATED")
proj_archived = col("PROJECTS","IS_ARCHIVED")
proj_archat = col("PROJECTS","ARCHIVED_AT")
proj_notes = col("PROJECTS","NOTES")

# Collect unique projects (skip rows with timestamp-style names — those are sub-records)
projects = {}  # name -> first-seen row
multi_count = defaultdict(int)
for r in rows["PROJECTS"]:
    if proj_pn is None or len(r) <= proj_pn: continue
    name = r[proj_pn].strip()
    if not name: continue
    # Skip sub-rows whose "name" is actually a timestamp (Houzz's room/section sub-records)
    if name[:4].isdigit() and "-" in name and ":" in name: continue
    multi_count[name] += 1
    if name not in projects:
        projects[name] = r

# Aggregate invoices per project (using PROJECT_NAME column)
inv_pn = col("INVOICES","PROJECT_NAME")
inv_num = col("INVOICES","INVOICE_NUMBER")
inv_type = col("INVOICES","INVOICE_TYPE")
inv_total = col("INVOICES","TOTAL_PAYMENT")
inv_paid = col("INVOICES","TOTAL_PAID")
inv_date = col("INVOICES","INVOICE_DATE")
inv_created = col("INVOICES","CREATED_AT")

# unique invoice -> (project, total, paid, date, type)
seen_invoices = {}
for r in rows["INVOICES"]:
    if inv_num is None or len(r) <= inv_num: continue
    n = r[inv_num].strip()
    if not n: continue
    if n in seen_invoices: continue
    proj = r[inv_pn].strip() if inv_pn is not None and len(r) > inv_pn else ""
    try: tot = float(r[inv_total].replace(",","")) if inv_total is not None and len(r) > inv_total and r[inv_total].strip() else 0.0
    except: tot = 0.0
    try: paid = float(r[inv_paid].replace(",","")) if inv_paid is not None and len(r) > inv_paid and r[inv_paid].strip() else 0.0
    except: paid = 0.0
    d = r[inv_date].strip() if inv_date is not None and len(r) > inv_date else ""
    if not d: d = r[inv_created].strip() if inv_created is not None and len(r) > inv_created else ""
    t = r[inv_type].strip() if inv_type is not None and len(r) > inv_type else ""
    seen_invoices[n] = (proj, tot, paid, d, t)

# Aggregate POs per project
po_num = col("PURCHASE_ORDERS","PURCHASE_ORDER_NUMBER")
po_total = col("PURCHASE_ORDERS","TOTAL_PAYMENT")
po_paid = col("PURCHASE_ORDERS","TOTAL_PAID")
po_date = col("PURCHASE_ORDERS","PURCHASE_ORDER_DATE")
po_created = col("PURCHASE_ORDERS","CREATED_AT")
# POs don't have project_name directly; they have CLIENT_NAME. Match indirectly.
po_client = col("PURCHASE_ORDERS","CLIENT_NAME")

seen_pos = {}
for r in rows["PURCHASE_ORDERS"]:
    if po_num is None or len(r) <= po_num: continue
    n = r[po_num].strip()
    if not n: continue
    if n in seen_pos: continue
    cli = r[po_client].strip() if po_client is not None and len(r) > po_client else ""
    try: tot = float(r[po_total].replace(",","")) if po_total is not None and len(r) > po_total and r[po_total].strip() else 0.0
    except: tot = 0.0
    try: paid = float(r[po_paid].replace(",","")) if po_paid is not None and len(r) > po_paid and r[po_paid].strip() else 0.0
    except: paid = 0.0
    d = r[po_date].strip() if po_date is not None and len(r) > po_date else ""
    if not d: d = r[po_created].strip() if po_created is not None and len(r) > po_created else ""
    seen_pos[n] = (cli, tot, paid, d)

# Roll up per project
proj_inv_count = defaultdict(int)
proj_inv_total = defaultdict(float)
proj_inv_paid = defaultdict(float)
proj_latest_inv_date = {}
proj_inv_types = defaultdict(lambda: defaultdict(int))
for n, (proj, tot, paid, d, t) in seen_invoices.items():
    if not proj: continue
    proj_inv_count[proj] += 1
    proj_inv_total[proj] += tot
    proj_inv_paid[proj] += paid
    if d and (proj not in proj_latest_inv_date or d > proj_latest_inv_date[proj]):
        proj_latest_inv_date[proj] = d
    if t: proj_inv_types[proj][t[:20]] += 1

# Build project -> client_name lookup, then aggregate POs by client_name
proj_client_lookup = {}
for name, r in projects.items():
    cli = r[proj_cn].strip() if proj_cn is not None and len(r) > proj_cn else ""
    if not cli:
        # Fall back to first/last name
        fn = r[proj_fn].strip() if proj_fn is not None and len(r) > proj_fn else ""
        ln = r[proj_ln].strip() if proj_ln is not None and len(r) > proj_ln else ""
        cli = (fn + " " + ln).strip()
    proj_client_lookup[name] = cli

client_to_projects = defaultdict(list)
for name, cli in proj_client_lookup.items():
    if cli: client_to_projects[cli].append(name)

# POs match by client. If a client has only 1 project, attribute all their POs to it.
# If a client has multiple projects, leave PO unattributed (counted in client total).
proj_po_count = defaultdict(int)
proj_po_total = defaultdict(float)
proj_po_paid = defaultdict(float)
proj_po_unattributed = defaultdict(int)  # for clients with multiple projects
client_po_count = defaultdict(int)
client_po_total = defaultdict(float)
for n, (cli, tot, paid, d) in seen_pos.items():
    if not cli: continue
    client_po_count[cli] += 1
    client_po_total[cli] += tot
    plist = client_to_projects.get(cli, [])
    if len(plist) == 1:
        only = plist[0]
        proj_po_count[only] += 1
        proj_po_total[only] += tot
        proj_po_paid[only] += paid

def parse_date(s):
    if not s: return None
    s = s.strip()
    for fmt in ("%Y-%m-%d %H:%M:%S.%f","%Y-%m-%d %H:%M:%S","%Y-%m-%d"):
        try: return datetime.strptime(s[:26], fmt)
        except: pass
    return None

# Build final rows
out_rows = []
for name, r in projects.items():
    created = r[proj_created].strip() if proj_created is not None and len(r) > proj_created else ""
    updated = r[proj_updated].strip() if proj_updated is not None and len(r) > proj_updated else ""
    cli = proj_client_lookup.get(name, "")
    city = r[proj_city].strip() if proj_city is not None and len(r) > proj_city else ""
    state = r[proj_state].strip() if proj_state is not None and len(r) > proj_state else ""
    budget = r[proj_budget].strip() if proj_budget is not None and len(r) > proj_budget else ""
    archived = r[proj_archived].strip() if proj_archived is not None and len(r) > proj_archived else ""
    archat = r[proj_archat].strip() if proj_archat is not None and len(r) > proj_archat else ""
    notes = r[proj_notes].strip() if proj_notes is not None and len(r) > proj_notes else ""
    notes_short = notes.replace("\n"," ").replace("\r"," ")[:120]

    inv_n = proj_inv_count.get(name, 0)
    inv_t = proj_inv_total.get(name, 0.0)
    inv_p = proj_inv_paid.get(name, 0.0)
    last_inv = proj_latest_inv_date.get(name, "")
    types = proj_inv_types.get(name, {})
    type_summary = " · ".join(f"{t}:{c}" for t, c in sorted(types.items(), key=lambda x: -x[1])[:3])

    po_n = proj_po_count.get(name, 0)
    po_t = proj_po_total.get(name, 0.0)
    po_p = proj_po_paid.get(name, 0.0)
    cli_pos = client_po_count.get(cli, 0)
    cli_pos_t = client_po_total.get(cli, 0.0)
    multi_proj_note = ""
    if cli and len(client_to_projects.get(cli, [])) > 1 and cli_pos > 0:
        multi_proj_note = f"Client has {len(client_to_projects[cli])} projects, {cli_pos} POs total ${cli_pos_t:,.0f} not split"

    last_activity_candidates = [d for d in [updated, last_inv] if d]
    last_activity = max(last_activity_candidates) if last_activity_candidates else ""
    sub_records = multi_count.get(name, 1) - 1  # how many extra room/board sub-rows

    out_rows.append({
        "MIGRATE (Y/N/?)": "",
        "PROJECT_NAME": name,
        "CLIENT_NAME": cli,
        "CITY": city,
        "STATE": state,
        "CREATED": (created[:10] if created else ""),
        "LAST_ACTIVITY": (last_activity[:10] if last_activity else ""),
        "INVOICES_#": inv_n,
        "INVOICES_$": round(inv_t, 2),
        "INVOICES_PAID_$": round(inv_p, 2),
        "TOP_INVOICE_TYPES": type_summary,
        "POs_#": po_n,
        "POs_$": round(po_t, 2),
        "ROOM_SUBRECORDS": sub_records,
        "BUDGET_AT_OPEN": budget,
        "IS_ARCHIVED": archived,
        "ARCHIVED_AT": (archat[:10] if archat else ""),
        "MULTI_PROJECT_CLIENT_NOTE": multi_proj_note,
        "NOTES_SHORT": notes_short,
    })

# Sort: most recent activity first
out_rows.sort(key=lambda r: r["LAST_ACTIVITY"] or "0", reverse=True)

cols = list(out_rows[0].keys()) if out_rows else []
with open(OUT, "w", encoding="utf-8-sig", newline="") as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    for r in out_rows: w.writerow(r)

# Quick stats
total_inv_t = sum(r["INVOICES_$"] for r in out_rows)
total_po_t = sum(r["POs_$"] for r in out_rows)
print(f"Wrote {len(out_rows)} projects -> {OUT}")
print(f"  Sum invoices across all listed projects: ${total_inv_t:,.0f}")
print(f"  Sum POs (single-project-clients only):   ${total_po_t:,.0f}")
print(f"  Sorted by LAST_ACTIVITY desc")
print()
print("Top 15 by invoice volume:")
top = sorted(out_rows, key=lambda r: -r["INVOICES_$"])[:15]
for r in top:
    print(f"  ${r['INVOICES_$']:>12,.0f}  {r['PROJECT_NAME'][:40]:<40}  {r['CLIENT_NAME'][:25]}")
