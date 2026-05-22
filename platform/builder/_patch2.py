p = r"c:\Users\cindy\Dropbox\CCH-Platform-Deploy\cch-deploy\platform\builder\index.html"
with open(p, encoding="utf-8") as f:
    t = f.read()

start = t.find("  secDetails.append(finishField);\n  const detailPickers = el(")
end = t.find("  pane.append(secDetails);", start)
if start < 0 or end < 0:
    raise SystemExit("markers not found")

insert = """  secDetails.append(finishField);
  if ((d.trimOptions || []).includes("Banding") && isWindowTreatmentCategory(cat)) {
    const tb = ensureTrimBanding(d);
    const bandPanel = el("div", { class:"field", style:"margin-top:10px;padding:10px;background:var(--field);border:1px solid var(--hairline)" });
    bandPanel.append(el("label", {}, "Banding fabric / trim"));
    const bandLine = el("div", { style:"font-size:11px;color:var(--muted);margin:6px 0;line-height:1.4" });
    const bandParts = [];
    if (tb.vendor || tb.sku) bandParts.push([tb.vendor, tb.sku, tb.color].filter(Boolean).join(" · "));
    if (tb.note) bandParts.push(tb.note);
    bandLine.textContent = bandParts.length ? bandParts.join(" — ") : "None selected — click Edit to add fabric or description.";
    bandPanel.append(bandLine);
    bandPanel.append(el("button", {
      type:"button", class:"btn secondary", style:"padding:8px 12px;font-size:10px;margin-top:6px",
      onclick: () => openTrimBandingModal(cat)
    }, "Edit banding detail"));
    secDetails.append(bandPanel);
  }
  if (!isWindowTreatmentCategory(cat)) {
"""

old_block = t[start:end]
# drop leading finishField line from old_block (already in insert)
lines = old_block.split("\n")
if lines[0].strip() == "secDetails.append(finishField);":
    old_body = "\n".join(lines[1:])
else:
    old_body = old_block

new_block = insert + old_body + "\n  }\n"

t = t[:start] + new_block + t[end:]

t = t.replace(
    "  migrateLegacyRoomLocation(dm);\n  state.pickers[mergedCat]",
    "  migrateLegacyRoomLocation(dm);\n  stripWorkroomVendorFromFabricsWithoutProduct(dm);\n  state.pickers[mergedCat]",
)

with open(p, "w", encoding="utf-8", newline="\n") as f:
    f.write(t)
print("patched")
