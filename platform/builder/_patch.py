p = r"c:\Users\cindy\Dropbox\CCH-Platform-Deploy\cch-deploy\platform\builder\index.html"
with open(p, encoding="utf-8") as f:
    lines = f.readlines()

out = []
i = 0
while i < len(lines):
    if lines[i].strip() == "if (elevSrc) {":
        depth = 0
        while i < len(lines):
            depth += lines[i].count("{") - lines[i].count("}")
            i += 1
            if depth <= 0:
                break
        continue
    out.append(lines[i])
    i += 1

text = "".join(out)
text = text.replace(
    'colSec.append(el("div", { class:"pp-section" }, "Section view"));',
    'const secLabel = String(caps.sectionView || "").trim() || "Section view";\n'
    '      colSec.append(el("div", { class:"pp-section" }, secLabel));',
)

with open(p, "w", encoding="utf-8", newline="\n") as f:
    f.write(text)
print("elevSrc left:", "if (elevSrc)" in text)
