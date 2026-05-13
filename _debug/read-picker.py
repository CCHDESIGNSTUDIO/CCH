"""Read the picker file and show projects marked Y."""
import csv

PICKER = r"C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427\Houzz_Projects_Picker_Apr27.csv"

with open(PICKER, encoding="utf-8-sig", errors="replace", newline="") as f:
    reader = csv.DictReader(f)
    rows = list(reader)

print(f"Total rows in picker: {len(rows)}")
print(f"Columns: {list(rows[0].keys()) if rows else 'EMPTY'}")
print()

# Find the migrate column
migrate_col = None
for c in (rows[0].keys() if rows else []):
    if "MIGRATE" in c.upper():
        migrate_col = c; break

if not migrate_col:
    print("Could not find MIGRATE column")
    exit(1)

print(f"Migrate column: '{migrate_col}'")
print()

# Show distribution of values
from collections import Counter
vals = Counter((r[migrate_col] or "").strip().upper() for r in rows)
print(f"Value distribution: {dict(vals)}")
print()

# Show selected projects
yes_rows = [r for r in rows if (r[migrate_col] or "").strip().upper().startswith("Y")]
print(f"Projects marked Y: {len(yes_rows)}")
print("=" * 70)
for r in yes_rows:
    print(f"  {r['PROJECT_NAME']:<40} {r['CLIENT_NAME']:<30} last={r.get('LAST_ACTIVITY','')}")
