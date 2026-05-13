"""Build wrong_triple -> correct char by simulating bad decoding of UTF-8."""
from pathlib import Path

def wrong_decode_utf8_as_chars(utf8_bytes):
    """UTF-8 bytes mis-read as individual Unicode codepoints (each byte -> chr(byte))."""
    return "".join(chr(b) for b in utf8_bytes)


def wrong_decode_utf8_as_latin1(utf8_bytes):
    return utf8_bytes.decode("latin-1")


def try_maps():
    maps = {}
    for cp in range(0x110000):
        try:
            c = chr(cp)
            utf8 = c.encode("utf-8")
        except (ValueError, UnicodeEncodeError):
            continue
        if len(utf8) != 3:
            continue
        w1 = wrong_decode_utf8_as_chars(utf8)
        w2 = wrong_decode_utf8_as_latin1(utf8)
        maps.setdefault(w1, []).append(c)
        maps.setdefault(w2, []).append(c)
    return maps


def main():
    m = try_maps()
    text = Path("index.html").read_text(encoding="utf-8")
    from collections import Counter

    trips = Counter()
    for i in range(len(text) - 2):
        if text[i] == "\u00e2":
            trips[text[i : i + 3]] += 1
    for t3, n in trips.most_common(25):
        cands = m.get(t3, [])
        print(n, repr(t3), "cands", cands[:3], "count", len(cands))


if __name__ == "__main__":
    main()
