"""Recover symbols: UTF-8 bytes were wrongly decoded as cp1252 into 3-char strings."""
from pathlib import Path

def build_reverse_map():
    m = {}
    for cp in range(0x110000):
        try:
            c = chr(cp)
            u = c.encode("utf-8")
        except (ValueError, UnicodeEncodeError):
            continue
        if len(u) != 3:
            continue
        try:
            wrong = u.decode("cp1252")
        except UnicodeDecodeError:
            continue
        # Keep first mapping only (collision unlikely)
        m.setdefault(wrong, c)
    return m


def main():
    path = Path("index.html")
    text = path.read_text(encoding="utf-8")
    rev = build_reverse_map()
    orig_len = len(text)
    i = 0
    out = []
    changed = 0
    while i < len(text):
        if i + 3 <= len(text):
            chunk = text[i : i + 3]
            if chunk in rev:
                out.append(rev[chunk])
                i += 3
                changed += 1
                continue
        out.append(text[i])
        i += 1
    new_text = "".join(out)
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
        print("Replacements:", changed, "length delta", len(new_text) - orig_len)
    else:
        print("No changes")


if __name__ == "__main__":
    main()
