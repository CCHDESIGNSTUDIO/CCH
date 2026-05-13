"""Check collisions in cp1252 wrong-decoding map."""

def build_reverse_map():
    m = {}
    collisions = []
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
        if wrong in m and m[wrong] != c:
            collisions.append((wrong, m[wrong], c))
        else:
            m[wrong] = c
    return m, collisions


m, col = build_reverse_map()
print("collisions", len(col))
if col:
    print(col[:10])
