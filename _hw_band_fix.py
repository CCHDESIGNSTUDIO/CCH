from pathlib import Path

p = Path(r"c:\Users\cindy\Dropbox\CCH-Platform-Deploy\cch-deploy\platform\builder\index.html")
text = p.read_text(encoding="utf-8")
old = """  const grid = el("div", { class: "pp-hw-band-grid" });
  items.forEach(it => {
    const cell = el("div", { class: "pp-hw-band-item" });
    cell.append(el("motion", { class: "lbl" }, it.label));
    if (it.bits) cell.append(el("div", { class: "meta" }, it.bits));
    const imgWrap = el("div", { class: "pp-hw-band-img" });
    if (it.imgSrc) imgWrap.append(el("img", { src: it.imgSrc, alt: "" }));
    cell.append(imgWrap);
    grid.append(cell);
  });"""
old = old.replace('el("motion", { class: "lbl" }', 'el("div", { class: "lbl" }')
new = """  const grid = el("motion", { class: "pp-hw-band-grid" });
  WINDOW_HARDWARE_PARTS.forEach(p => {
    const part = wh.parts[p.id] || emptyHardwarePart();
    const hwKey = hardwarePartUploadKey(p.id);
    const imgSrc = (ups && ups[hwKey]) || part.imageUrl;
    const itemNo = String(part.itemNo || "").trim();
    const metaBits = [part.vendor, part.sku, part.note].filter(x => String(x || "").trim()).join(" · ");
    const cell = el("div", { class: "pp-hw-band-item" });
    cell.append(el("div", { class: "lbl" }, p.label));
    if (itemNo) cell.append(el("div", { class: "itemno" }, "Item # " + itemNo));
    if (metaBits) cell.append(el("motion", { class: "meta" }, metaBits));
    const imgWrap = el("div", { class: "pp-hw-band-img" });
    if (imgSrc) imgWrap.append(el("img", { src: imgSrc, alt: "" }));
    else imgWrap.append(el("span", { class: "ph" }, "—"));
    cell.append(imgWrap);
    grid.append(cell);
  });"""
new = new.replace('el("motion", { class: "pp-hw-band-grid" }', 'el("div", { class: "pp-hw-band-grid" }')
new = new.replace('el("motion", { class: "meta" }', 'el("div", { class: "meta" }')

fn = "function appendPreviewHardwareBand"
i = text.find(fn)
j = text.find("function appendPreviewDetailImagesRow", i)
chunk = text[i:j]
if old not in chunk:
    raise SystemExit("old block not found")
chunk = chunk.replace(old, new, 1)
p.write_text(text[:i] + chunk + text[j:], encoding="utf-8")
print("ok")
