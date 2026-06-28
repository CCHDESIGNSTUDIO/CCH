# SPEC — Contact Kind (Vendors / Showrooms / Contractors)

**File:** SPEC_Contact_Kind_CR_2026-06-27_v1.0.md  
**Author:** Cursor (Agent #9)  
**Created:** June 27, 2026  
**Status:** Spec for staging implementation — **read before Contact Kind or #9 comms changes**  
**Related:** `cch-po-vendor-comms.js` (Phase 1 deployed staging 2026-06-27), showroom/PO pay-to design thread

---

## Problem (code-grounded)

Two competing Vendors implementations:

| Location | Behavior |
|----------|----------|
| `index.html` ~57356 | `renderVendors()` loads `vendors/` **+ merges `products/` vendor names**; list via `renderVendorsList()`; Edit via `editVendorInline()` / `showNewVendorModal()` — **no** `category` filter; Description column = free-text `description` |
| `cch-functions.js` ~653 | `renderVendors()` loads `vendors/` only; **excludes** `category === 'Workroom'` and `'Delivery / Receiver'`; Type + Category filters; `showNewVendorModal(id, category)` with datalist type; **`moveVendorCategory()`** |

Because `cch-functions.js` loads **after** `index.html`, its `renderVendors` **wins** on `#/vendors`. Workrooms / Delivery use legacy `category` on the same `vendors/` collection (`renderWorkrooms` in `index.html` ~57305).

Firestore fields are inconsistent: `type`, `vendorType`, `category`, `description` — so Thomas Lavin can be typed Showroom in one field and still appear on the manufacturer grid.

**Fix:** one canonical field `contactKind` on `vendors/{id}` + filtered sidebar views. **One code path** for list/edit (merge best of both files; remove duplicate from `index.html`).

---

## Design principles

1. **Single collection:** `vendors/` — no migration to `showrooms/` or `contractors/` collections.
2. **Clipper / library / proposal lines:** always **manufacturer** (`contactKind === 'manufacturer'` or legacy empty — see below).
3. **PO Pay to Showroom:** picker = `contactKind === 'showroom'`.
4. **#9 Send to Vendor:** resolve email from PO payee kind (showroom email when Pay to Showroom; else manufacturer).
5. **Team & Contacts:** CCH people only — **not** contractors/subs.
6. **Staging first.** No blind Firestore batch. Suggest-only CSV for bulk inference.

---

## Canonical field: `contactKind`

**Type:** string enum (required on save for new/edited records; optional on legacy until classified)

| `contactKind` | Label (UI) | Sidebar view | Used for |
|---------------|------------|--------------|----------|
| `manufacturer` | Manufacturer / Brand | **Vendors** (default) | Clipper, library, proposal lines, vendor detail Products/POs |
| `showroom` | Showroom / Rep House | **Showrooms** | PO ☑ Pay to Showroom, bill payee, vendor comms To |
| `contractor` | Contractor / Sub | **Contractors** | Labor POs, subs (Campco), AP — **not** Team |
| `workroom` | Workroom | **Workrooms** (existing route) | Fabrication, ship-to |
| `freight_receiver` | Freight / Receiver | **Delivery / Receivers** (existing) | Logistics, receiving |
| `installer` | Installer | **Installers** (optional v1 — or filter under Contractors) | Install POs |
| `other` | Other | Contacts catch-all (optional v1) | One-offs |
| `unclassified` | Unclassified | **Unclassified filter only** | Explicit marker during cleanup (optional write) |

### Secondary field: `specialty` (optional, v1 can defer)

Trade tag: Lighting, Furniture, Fabric, Upholstery, etc. — **does not** control routing.  
Keep existing free-text `type` as **display legacy** until migrated; new UI writes `specialty` or continues `type` for specialty only (implementation choice: **rename UI label to Specialty**, store in `type` for v1 to avoid dual fields).

### Deprecated / legacy (do not delete on read)

| Legacy field | Meaning today | Maps to `contactKind` |
|--------------|---------------|------------------------|
| `category === 'Workroom'` | Workroom list | `workroom` |
| `category === 'Delivery / Receiver'` | Delivery/receivers | `freight_receiver` |
| `category === 'Vendor'` or missing | Main vendor grid | `manufacturer` (after inference) |
| `type === 'Showroom'` (case-insensitive) | Rep house | `showroom` |
| `type` containing Upholsterer, Installer, etc. | Trade specialty only | keep as `type`; kind stays `manufacturer` unless user reclassifies |
| `description === 'Showroom'` etc. | Polluted free text | suggest-only inference |

**On save:** write `contactKind`; optionally sync legacy `category` for Workroom/Delivery loaders until those routes read `contactKind` (dual-write transition).

---

## Runtime resolution: `cchResolveContactKind(doc)`

```javascript
function cchResolveContactKind(v) {
  if (!v) return 'manufacturer';
  var k = String(v.contactKind || '').trim().toLowerCase();
  if (k) return k;
  // Legacy fallback (read-only inference — do not write on read)
  var cat = String(v.category || '').trim();
  if (cat === 'Workroom') return 'workroom';
  if (cat === 'Delivery / Receiver') return 'freight_receiver';
  var t = String(v.type || v.vendorType || '').trim().toLowerCase();
  if (t === 'showroom') return 'showroom';
  if (/\b(contractor|sub\b|subcontractor)/i.test(t + ' ' + (v.description || '') + ' ' + (v.tags || ''))) return 'contractor';
  return 'unclassified'; // empty kind — show on Vendors + Unclassified filter
}
```

### Clipper / product vendor pick

```javascript
function cchContactKindClipperEligible(kind) {
  var k = kind || 'unclassified';
  return k === 'manufacturer' || k === 'unclassified'; // grandfather empty until reclassified
}
```

### Vendors default list filter (staging v1)

```javascript
function cchContactKindVendorsDefaultEligible(kind) {
  return kind === 'manufacturer' || kind === 'unclassified';
}
```

After Cynthia cleanup: tighten to `manufacturer` only (config flag or comment in code).

---

## UI / routing (steps 1–2 — staging)

### Step 1 — Data + Edit modal

- Add **Contact Kind** required `<select>` to unified vendor modal (`showNewVendorModal` / edit).
- On save: `contactKind`, `updatedAt`, `updatedBy`; dual-write `category` when kind is `workroom` or `freight_receiver` for backward compat.
- Remove duplicate `showNewVendorModal` / `editVendorInline` / `renderVendors` from `index.html` — **single implementation in `cch-functions.js`** (or extracted `cch-vendors.js` if size warrants; prefer extending `cch-functions.js` to minimize files).
- Merge **product-derived names** from index.html into unified loader as optional overlay rows (`source: 'products'`, read-only until promoted to Firestore doc).

### Step 2 — Filtered views + sidebar

| Route | Filter |
|-------|--------|
| `#/vendors` | `contactKind` in (`manufacturer`, `unclassified`) — default |
| `#/vendors?filter=unclassified` | `unclassified` only + count badge |
| `#/showrooms` | `showroom` |
| `#/contractors` | `contractor` |
| `#/workrooms` | `workroom` (existing; switch query to `contactKind` with `category` fallback) |
| `#/delivery` or existing receiver route | `freight_receiver` |

List columns: **Name | Contact Kind | Specialty | Email | Phone | Edit**

**Unclassified badge** on Vendors page: “N unclassified — review”

### Move / reclassify

Replace `moveVendorCategory()` buttons with **Contact Kind** dropdown on edit (one action). Changing kind moves record between views instantly — no collection move.

---

## Integration with Agent #9 vendor comms

| #9 function | After Contact Kind |
|-------------|-------------------|
| `cchPoLookupVendorContact(vendorName)` | Lookup by name **+** prefer doc where `contactKind` matches PO payee (showroom vs manufacturer) |
| `cchPoEmailVendor` | If PO has `payToShowroom` + `showroomId`, To = showroom email; else manufacturer |
| PO comms thread | Store `contactKind` on correspondence doc for audit |
| `orders@cchdesign.com` Cc | unchanged |

**Note:** #9 Phase 1 is on staging without `contactKind` — wire payee resolution in a small follow-up deploy after steps 1–2 verified.

---

## PO fields (preview — step 3+, not step 1–2)

```javascript
purchaseOrders/{poId} {
  payToShowroom: boolean,
  showroom: "Thomas Lavin",
  showroomId: "firestore-doc-id",
  vendor: "Thomas Lavin",  // payee when payToShowroom; else manufacturer
  items: [{ vendor: "John Pomp", ... }]  // brand unchanged
}
```

---

## Legacy cleanup (Cynthia-approved only)

**Suggest-only script** (dry-run default):

- Output: `CONTACT_KIND_SUGGESTIONS_BY_CLAUDE_2026-06-27.csv`
- Columns: `docId`, `name`, `currentType`, `currentCategory`, `suggestedContactKind`, `reason`
- **No `--apply`** without Cynthia naming script + reviewing CSV

Example rules:

- `type` or `description` ~ `/showroom/i` → `showroom`
- `category === 'Workroom'` → `workroom`
- Name in known subs list / tags ~ contractor → `contractor`
- Has product library hits, no showroom signal → `manufacturer`

---

## Code consolidation checklist

- [ ] Delete or stub `renderVendors`, `renderVendorsList`, `showNewVendorModal`, `saveNewVendor`, `editVendorInline`, `saveVendorEdit` in `index.html` (~57356–57607)
- [ ] Extend `cch-functions.js` `renderVendors` with product-name merge from index.html loader
- [ ] Route `#/showrooms`, `#/contractors` in hash router (`index.html` navigate)
- [ ] Sidebar links: Vendors | Showrooms | Contractors | Workrooms | Delivery (match existing labels)
- [ ] Update `cch-po-vendor-comms.js` lookup after Contact Kind lands
- [ ] Firestore rules: no change required if `vendors/` already auth read/write for team

---

## Test plan (staging)

1. Thomas Lavin → Edit → Contact Kind **Showroom** → disappears from Vendors default, appears on Showrooms.
2. John Pomp (or product-only name) → **Manufacturer** → Products/POs tab unchanged.
3. Campco → **Contractor** → appears on Contractors, not Vendors or Team.
4. Legacy doc with empty kind → still on Vendors default + Unclassified filter.
5. Clipper vendor pick → still lists manufacturer + unclassified names only.
6. #9 Email vendor → after payee wiring, To = showroom email when PO Pay to Showroom checked.

---

## Revision log

| Date | Change |
|------|--------|
| 2026-06-27 | v1.0 — Initial spec (duplicate renderVendors, contactKind enum, #9 integration, Cynthia confirms Contractors sidebar + Unclassified filter) |
