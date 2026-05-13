import ftfy
from pathlib import Path
from collections import Counter

text = Path("index.html").read_text(encoding="utf-8")
triplets = []
for i in range(len(text) - 2):
    if text[i] == "\u00e2":
        triplets.append(text[i : i + 3])
c = Counter(triplets)
for t3, n in c.most_common(25):
    fixed = ftfy.fix_text(t3)
    print(n, "->", repr(t3), "ftfy->", repr(fixed))
