from pathlib import Path
tag = "d" + "iv"
p = Path(__file__).with_name("index.html")
t = p.read_text(encoding="utf-8")
for needle in [
    'el("motion", { class:"field-row " + mod })',
    'el("motion", { class: "field field-yrd" })',
]:
    fixed = needle.replace("motion", tag)
    t = t.replace(needle, fixed)
p.write_text(t, encoding="utf-8")
print("ok")
