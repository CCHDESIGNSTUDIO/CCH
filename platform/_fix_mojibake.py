"""One-off: fix mojibake in index.html using ftfy (install: pip install ftfy)."""
import sys
from pathlib import Path

def main():
    try:
        import ftfy
    except ImportError:
        print("Run: pip install ftfy", file=sys.stderr)
        sys.exit(1)
    p = Path(__file__).with_name("index.html")
    raw = p.read_text(encoding="utf-8")
    fixed = ftfy.fix_text(raw)
    if fixed == raw:
        print("No changes from ftfy.")
        return
    bak = p.with_suffix(".html.bak-mojibake")
    if not bak.exists():
        bak.write_text(raw, encoding="utf-8")
        print("Backup:", bak)
    p.write_text(fixed, encoding="utf-8")
    print("Wrote fixed index.html; chars changed:", len(raw) - len(fixed), "(length may differ)")


if __name__ == "__main__":
    main()
