from pathlib import Path

text = Path("index.html").read_text(encoding="utf-8")
indices = [i for i, c in enumerate(text) if c == "\u00e2"]
print("â count", len(indices))
# Extract 4-char windows starting at each â
samples = {}
for i in indices[:500]:
    w = text[i : i + 6]
    samples[w] = samples.get(w, 0) + 1
for w, n in sorted(samples.items(), key=lambda x: -x[1])[:40]:
    fix = None
    try:
        fix = w.encode("latin-1").decode("utf-8")
    except Exception:
        pass
    print(n, repr(w), "->", repr(fix))
