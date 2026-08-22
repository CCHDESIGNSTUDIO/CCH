# Fable brief — WO-075-B product / upholstery print (Cindy · Aug 03, 2026)

**From:** #1 · **For:** Fable  
**Cindy:** stopped micro-loop; annotated screenshot; asked for prod + this write-up.

---

## Annotated notes (screenshot CLO-U-01) — must match

| Note on image | Intent |
|---------------|--------|
| **MAKE PROJECT BIGGER** | PROJECT line in header meta must read large / bold (not muted 10px). |
| **Part # under — stack color data; reduce right column** | Materials: Color / Width / Material stacked; **Part # below** that stack; narrower Materials column + smaller swatches so hero can breathe. |
| **RAISE THEM AND MAKE THESE IMAGES BIGGER** | Bottom Stitch / Nailheads / Feet / Reference row: **larger** thumbs; **no white gap** above Approval (Approval must sit tight under that row). |

Also already agreed this session:
- Letter landscape 11×8.5  
- Left order: Design Intent → Specs (+ dims) → Fabrication drawing  
- QTY under room/item; TAG under 1 OF 1 with project row  
- Approval: Designer · Client · Workroom one line with long signature blanks  

---

## Root cause (why Approval looked stuck / details looked tiny)

`.preview-page--product` was `display:flex; flex-direction:column` with **`.preview-body { flex: 1 1 auto }`** and a forced Letter **aspect-ratio / min-height**. The body **grew** to fill the page → tall **white void** between the detail strip and Approval. Detail thumbs were resized in isolation without killing flex-grow, so Cindy’s “raise Approval / enlarge bottom” requests looked ignored.

**Fix (ft044 → ft045):** `flex: 0 0 auto` on body / detail band / foot; drop forced min-height chrome; enlarge detail cells; larger PROJECT meta; COM Part # under color stack; narrower Materials column.

---

## Rev / files

- **File:** `platform/builder/index.html`  
- **Rev:** `2026-08-03ft045-annotated-notes`  
- **Loop:** WO-075-B  

---

## Verify

1. Hard refresh Builder (staging + prod).  
2. PROJECT line obviously larger.  
3. COM rows: Color… then Part # under; Materials column narrower.  
4. Bottom detail row large; Approval immediately under it (no tall white band).  
5. Fab drawing still under Specs.

---

## Open (data, not layout)

- Hero may show nailhead if Main image empty / wrong fallback.  
- Feet slot can duplicate nailhead if form has wrong upload.
