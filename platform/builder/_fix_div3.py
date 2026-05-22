from pathlib import Path
tag = "d" + "iv"
p = Path(__file__).with_name("index.html")
t = p.read_text(encoding="utf-8")
t = t.replace('el("motion", { class:"field", style:"margin-top:8px" }', f'el("{tag}", {{ class:"field", style:"margin-top:8px" }}')
t = t.replace('el("motion", { class:"field" },\n      el("label", {}, "Fabric (Product Library)")', f'el("{tag}", {{ class:"field" }},\n      el("label", {{}}, "Fabric (Product Library)")')
t = t.replace('if (!d.fabrics[nextId]) d.fabrics[nextId] = { vendor:"", sku:"", color:"", width:"", content:"", repeat:"" };', 'if (!d.fabrics[nextId]) d.fabrics[nextId] = emptyFabricRow();')
p.write_text(t, encoding="utf-8")
print("ok")
