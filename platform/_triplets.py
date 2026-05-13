from pathlib import Path
from collections import Counter

text = Path("index.html").read_text(encoding="utf-8")
triplets = []
for i in range(len(text) - 2):
    if text[i] == "\u00e2":
        triplets.append(text[i : i + 3])
c = Counter(triplets)
print("unique triplets starting with â:", len(c))
for t3, n in c.most_common(30):
    print(n, [hex(ord(x)) for x in t3])
