from pathlib import Path
tag = "d" + "iv"
p = Path(__file__).with_name("index.html")
t = p.read_text(encoding="utf-8")
t = t.replace('el("motion", { class: "pp-meas-bar" })', f'el("{tag}", {{ class: "pp-meas-bar" }})')
t = t.replace('el("motion", { class: "pp-meas-bar-inner" })', f'el("{tag}", {{ class: "pp-meas-bar-inner" }})')
p.write_text(t, encoding="utf-8")
print("ok")
