from pathlib import Path
import re

t = Path("index.html").read_text(encoding="utf-8")
for label in ["Dashboard", "Projects", "Proposals", "Inspiration"]:
    m = re.search(
        r'<span class="nav-icon">([^<]+)</span><span class="nav-label">' + re.escape(label),
        t,
    )
    if m:
        s = m.group(1)
        print(label, repr(s), [hex(ord(c)) for c in s])
