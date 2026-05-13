"""Second-pass: recover UTF-8 geometric symbols mis-encoded as multiple Unicode chars."""
from pathlib import Path

def try_cp1252_utf8_roundtrip(s: str) -> str | None:
    """If s is mojibake (UTF-8 read as Latin-1), recover original UTF-8 text."""
    try:
        return s.encode("latin-1").decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return None


def main():
    p = Path(__file__).with_name("index.html")
    raw = p.read_text(encoding="utf-8")
    out = []
    i = 0
    changed = 0
    while i < len(raw):
        # Try longest greedy match of latin-1 round-trip starting at i (window up to 12 chars)
        replaced = False
        for w in range(min(12, len(raw) - i), 0, -1):
            chunk = raw[i : i + w]
            fixed = try_cp1252_utf8_roundtrip(chunk)
            if fixed is not None and fixed != chunk and len(fixed) <= len(chunk):
                # Avoid fixing ASCII-only chunks or nonsensical expansions
                if any(ord(c) > 127 for c in fixed):
                    out.append(fixed)
                    i += w
                    changed += 1
                    replaced = True
                    break
        if not replaced:
            out.append(raw[i])
            i += 1
    text = "".join(out)
    if text != raw:
        p.write_text(text, encoding="utf-8")
        print("Greedy pass changed segments:", changed)
    else:
        print("Greedy pass: no change")


if __name__ == "__main__":
    main()
