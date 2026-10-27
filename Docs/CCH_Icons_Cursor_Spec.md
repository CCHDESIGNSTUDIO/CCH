# CCH Studio — Product Type Icons
## Cursor Implementation Spec

---

## Overview

Replace the generic brown package placeholder in the `IMG` column of proposal/invoice tables with category-specific SVG icons. Icons render when a line item has no product photo.

**Color system:** Navy `#0A1F3D` · Gold `#C8A97E` · Cream `#F4EBDD`  
**Sizes:** 40px standard table row · 20px compact view  
**Format:** Inline SVG, no external files needed

---

## Trigger Logic

Match on the line item's `type` field (or category tag). Suggested mapping:

```javascript
function getProductIcon(item) {
  const type = (item.type || item.category || '').toLowerCase();

  if (type.includes('wt-labor') || type.includes('window treatment labor'))
    return icons.wtLabor;

  if (type.includes('wt-expense') || type.includes('window treatment expense') || type.includes('window treatment material'))
    return icons.wtExpense;

  if (type.includes('pillow') || type.includes('bedding'))
    return icons.pillowLabor;

  if (type.includes('furniture') || type.includes('upholster'))
    return icons.furnitureLabor;

  if (type.includes('wallcovering') || type.includes('wall covering'))
    return icons.wallcoveringLabor;

  return icons.default; // existing brown box fallback
}
```

Adjust field names to match actual Firestore document structure.

---

## SVG Icons — 40px

### 1. Window Treatment — Labor
*Large needle + gold thread. Curtain panels ghosted in background.*

```html
<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Ghost curtain panels -->
  <rect x="1"  y="5" width="9"  height="30" rx="1" fill="#0A1F3D" opacity=".12"/>
  <rect x="30" y="5" width="9"  height="30" rx="1" fill="#0A1F3D" opacity=".12"/>
  <rect x="1" y="5" width="38" height="2" rx="1" fill="#0A1F3D" opacity=".1"/>
  <!-- Needle -->
  <line x1="20" y1="2" x2="20" y2="35" stroke="#0A1F3D" stroke-width="3" stroke-linecap="round"/>
  <path d="M17.5 33 L20 39 L22.5 33" fill="#0A1F3D"/>
  <ellipse cx="20" cy="5.5" rx="2.5" ry="3.5" stroke="#0A1F3D" stroke-width="1.8" fill="#F5F4F1"/>
  <!-- Gold thread -->
  <path d="M20 9 C13 14 27 20 18 30 L17 35" stroke="#C8A97E" stroke-width="2" fill="none" stroke-linecap="round"/>
</svg>
```

---

### 2. Window Treatment — Expense / Material
*Fabric bolt with gold rod, weave lines, yardage ticks. No tools.*

```html
<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Bolt rod -->
  <rect x="3" y="3" width="34" height="6" rx="3" fill="#C8A97E"/>
  <rect x="3" y="3" width="34" height="2.5" rx="2" fill="#fff" opacity=".2"/>
  <circle cx="3"  cy="6" r="3" fill="#C8A97E" opacity=".7"/>
  <circle cx="37" cy="6" r="3" fill="#C8A97E" opacity=".7"/>
  <!-- Fabric panel -->
  <rect x="5" y="9" width="30" height="26" rx="1" fill="#0A1F3D"/>
  <!-- Weave lines -->
  <rect x="5" y="14" width="30" height="1.2" fill="#C8A97E" opacity=".3"/>
  <rect x="5" y="19" width="30" height="1.2" fill="#C8A97E" opacity=".3"/>
  <rect x="5" y="24" width="30" height="1.2" fill="#C8A97E" opacity=".3"/>
  <rect x="5" y="29" width="30" height="1.2" fill="#C8A97E" opacity=".3"/>
  <!-- Selvage edge -->
  <rect x="5" y="33" width="30" height="3" rx="1" fill="#C8A97E" opacity=".7"/>
  <!-- Yardage ticks -->
  <line x1="13" y1="33" x2="13" y2="36" stroke="#0A1F3D" stroke-width="1.2" opacity=".5"/>
  <line x1="20" y1="33" x2="20" y2="36" stroke="#0A1F3D" stroke-width="1.2" opacity=".5"/>
  <line x1="27" y1="33" x2="27" y2="36" stroke="#0A1F3D" stroke-width="1.2" opacity=".5"/>
</svg>
```

---

### 3. Custom Pillows & Bedding — Labor
*Pillow with flange border, tuft button, needle + gold thread.*

```html
<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Pillow body -->
  <rect x="3" y="10" width="34" height="20" rx="6" fill="#0A1F3D"/>
  <!-- Flange border -->
  <rect x="3" y="10" width="34" height="20" rx="6" stroke="#C8A97E" stroke-width="1.2" fill="none" opacity=".45"/>
  <!-- Inner flange offset -->
  <rect x="7" y="14" width="26" height="12" rx="4" stroke="#C8A97E" stroke-width=".7" fill="none" opacity=".25"/>
  <!-- Center gather seam -->
  <path d="M20 10 C18 14 18 16 20 20 C22 24 22 26 20 30" stroke="#C8A97E" stroke-width="1" fill="none" opacity=".55"/>
  <!-- Tuft button -->
  <circle cx="20" cy="20" r="1.5" fill="#C8A97E" opacity=".8"/>
  <circle cx="20" cy="20" r=".6" fill="#0A1F3D"/>
  <!-- Needle -->
  <line x1="32" y1="5" x2="24" y2="17" stroke="#C8A97E" stroke-width="1.3"/>
  <ellipse cx="31.5" cy="5.8" rx="1.2" ry="2" transform="rotate(-35 31.5 5.8)" fill="#C8A97E"/>
  <!-- Thread -->
  <path d="M24 17 C22 20 26 23 23 27" stroke="#C8A97E" stroke-width=".9" fill="none" opacity=".65"/>
</svg>
```

---

### 4. Custom Furniture — Labor
*Upholstered chair with button tufts, stretcher rail, joinery dots.*

```html
<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Chair back -->
  <rect x="7" y="5" width="26" height="16" rx="2" fill="#0A1F3D"/>
  <!-- Back rail lines -->
  <line x1="7" y1="11" x2="33" y2="11" stroke="#C8A97E" stroke-width=".8" opacity=".35"/>
  <line x1="7" y1="16" x2="33" y2="16" stroke="#C8A97E" stroke-width=".8" opacity=".35"/>
  <!-- Button tufts -->
  <circle cx="20" cy="13" r="1.4" fill="#C8A97E" opacity=".7"/>
  <circle cx="13" cy="13" r="1.4" fill="#C8A97E" opacity=".5"/>
  <circle cx="27" cy="13" r="1.4" fill="#C8A97E" opacity=".5"/>
  <!-- Seat -->
  <rect x="5" y="21" width="30" height="7" rx="1.5" fill="#0A1F3D"/>
  <rect x="5" y="26" width="30" height="2" rx="1" fill="#C8A97E" opacity=".25"/>
  <!-- Back legs -->
  <line x1="9"  y1="28" x2="7"  y2="38" stroke="#C8A97E" stroke-width="1.5" opacity=".7" stroke-linecap="round"/>
  <line x1="31" y1="28" x2="33" y2="38" stroke="#C8A97E" stroke-width="1.5" opacity=".7" stroke-linecap="round"/>
  <!-- Front legs -->
  <line x1="11" y1="28" x2="10" y2="38" stroke="#0A1F3D" stroke-width="2" stroke-linecap="round"/>
  <line x1="29" y1="28" x2="30" y2="38" stroke="#0A1F3D" stroke-width="2" stroke-linecap="round"/>
  <!-- Stretcher rail -->
  <line x1="10" y1="33" x2="30" y2="33" stroke="#C8A97E" stroke-width=".9" opacity=".5"/>
  <circle cx="10" cy="33" r="1.2" fill="#C8A97E" opacity=".7"/>
  <circle cx="30" cy="33" r="1.2" fill="#C8A97E" opacity=".7"/>
  <!-- Joinery dot -->
  <circle cx="20" cy="21" r="1.5" fill="#C8A97E" opacity=".8"/>
</svg>
```

---

### 5. Wallcovering — Labor
*Two panels with matched repeat, gold seam line, smoother tool, bubble level.*

```html
<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- Installed panel (left) -->
  <rect x="2" y="3" width="16" height="34" rx="1" fill="#0A1F3D"/>
  <!-- Pattern repeat -->
  <line x1="2" y1="11" x2="18" y2="11" stroke="#C8A97E" stroke-width=".6" opacity=".25"/>
  <line x1="2" y1="19" x2="18" y2="19" stroke="#C8A97E" stroke-width=".6" opacity=".25"/>
  <line x1="2" y1="27" x2="18" y2="27" stroke="#C8A97E" stroke-width=".6" opacity=".25"/>
  <rect x="7" y="6"  width="4" height="4" rx=".3" transform="rotate(45 9 8)"  fill="none" stroke="#C8A97E" stroke-width=".6" opacity=".35"/>
  <rect x="7" y="14" width="4" height="4" rx=".3" transform="rotate(45 9 16)" fill="none" stroke="#C8A97E" stroke-width=".6" opacity=".35"/>
  <rect x="7" y="22" width="4" height="4" rx=".3" transform="rotate(45 9 24)" fill="none" stroke="#C8A97E" stroke-width=".6" opacity=".35"/>
  <rect x="7" y="30" width="4" height="4" rx=".3" transform="rotate(45 9 32)" fill="none" stroke="#C8A97E" stroke-width=".6" opacity=".35"/>
  <!-- Seam line -->
  <line x1="19" y1="3" x2="19" y2="37" stroke="#C8A97E" stroke-width="1.5" opacity=".85"/>
  <!-- Panel being hung (right) -->
  <rect x="20" y="3" width="16" height="34" rx="1" fill="#0A1F3D" opacity=".6"/>
  <!-- Smoother tool -->
  <rect x="29" y="8" width="9" height="5" rx="1" fill="#C8A97E" opacity=".85"/>
  <line x1="33.5" y1="13" x2="33.5" y2="20" stroke="#C8A97E" stroke-width="1.5" stroke-linecap="round" opacity=".75"/>
  <line x1="30" y1="13" x2="30" y2="15" stroke="#0A1F3D" stroke-width=".8" opacity=".5"/>
  <line x1="32" y1="13" x2="32" y2="15" stroke="#0A1F3D" stroke-width=".8" opacity=".5"/>
  <line x1="34" y1="13" x2="34" y2="15" stroke="#0A1F3D" stroke-width=".8" opacity=".5"/>
  <line x1="36" y1="13" x2="36" y2="15" stroke="#0A1F3D" stroke-width=".8" opacity=".5"/>
  <!-- Bubble level -->
  <rect x="29" y="21" width="9" height="3" rx="1.5" stroke="#C8A97E" stroke-width=".8" fill="none" opacity=".55"/>
  <circle cx="33.5" cy="22.5" r=".9" fill="#C8A97E" opacity=".65"/>
</svg>
```

---

## Implementation Notes

- All icons are **pure inline SVG** — no image files, no imports
- Drop into the `IMG` cell wherever `item.imageUrl` is null/empty
- Works on white and cream backgrounds without modification
- For navy backgrounds, swap `fill="#0A1F3D"` panels to `fill="#F4EBDD"` opacity `.88`
- 20px variants available on request

## Icon Summary Table

| Icon | Trigger keywords | Visual read |
|---|---|---|
| WT Labor | `wt-labor`, `window treatment labor` | Needle + thread |
| WT Expense | `wt-expense`, `window treatment material` | Fabric bolt + yardage ticks |
| Pillows & Bedding Labor | `pillow`, `bedding` | Pillow + needle |
| Furniture Labor | `furniture`, `upholster` | Chair + joinery dots |
| Wallcovering Labor | `wallcovering`, `wall covering` | Panels + seam + smoother |
