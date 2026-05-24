# Session Log — Cursor: Invoice Edit View (Houzz-Style) & Line Items UX

**File:** SESSION_LOG_Cursor_2026-05-22.md  
**Original Author:** Cursor (CR)  
**Created:** May 22, 2026  
**Last Modified:** May 22, 2026  
**Last Modified By:** Cursor (CR)  
**Version:** 1.0  

**Workspace:** `CCH-Platform-Deploy`  
**Primary paths:** `cch-deploy/platform/index.html`, `cch-deploy/platform/cch-proposals-invoices-fix.js`, `cch-deploy/platform/cch-functions.js`  
**Firebase production:** `cch-design-boards` → https://cch-platform.web.app  
**Firebase staging:** `cch-studio-staging` → https://cch-platform-staging.web.app  
**Cursor transcript:** [Invoice edit view](3744c84a-ce88-42ff-984b-6779961eb09f)

**Canonical copy (docs library):** `Claude - CCH studio/CCH_Platform_Docs/_architecture/sessions/INTERNAL_INVOICE_EDIT_VIEW_HOUZZ_ALIGN_CR_May22_v1.0.md`

## Revision history

- v1.0 (May 22, 2026, CR): Full session handoff. Invoice edit layout aligned with Houzz (line-items-only edit; payments/totals on view). Performance caches for edit open. Line table column/fonts. Production deploy verified on IN-12946.

---

## Session overview

User refined the **Invoice Edit** experience (Edit line items / full edit mode) for CCH Studio, using **IN-12946** (Cloud - Rolling Hills) as the test invoice on **staging**, then **production**.

**Design goal:** Match Houzz Pro — edit screen is for **lines only**; payments, balance, status, and QuickBooks stay on the **main invoice view** (right sidebar).

**No git commits** were made in this session (per user practice).

---

## What shipped (production — verified)

User confirmed **IN-12946** looks good on **https://cch-platform.web.app** after production deploy.

```bash
cd CCH-Platform-Deploy/cch-deploy
firebase deploy --only hosting:platform --project cch-studio-staging   # during session
firebase deploy --only hosting:platform --project cch-design-boards    # final — approved after staging test
```

---

## 1. Invoice view vs. edit — responsibility split

| Screen | Purpose | Where in code |
|--------|---------|----------------|
| **View invoice** | Paid badge, totals rail, payments, balance, QB, client/dates, Send, Record payment | `renderDocViewPage` in `cch-proposals-invoices-fix.js` (`invoiceRailHTML`, `cch-doc-view-grid`) |
| **Edit line items** | Table: items, qty, cost, markup, room, shipping fee, notes, images; footer: summary, document tags, memo | `renderDocEditPage` when `type === 'invoice'` in `index.html` |

### Removed from invoice edit (this session)

- Right sidebar **Totals** card, **Paid** badge, subtotal/tax/balance rows
- Header **status badge** and large **$ total**
- Footer duplicate **#docEditTotals** table
- `docEditRenderPayments()` / `docEditRenderAttachments()` on invoice open
- **QuickBooks** block on invoice edit (`qbHTML` now **PO only**)
- Edit top bar **More** menu items: Record payment, Send, Mark paid/past due/void, Push/Refresh QB, Group by room/category

### Kept on invoice edit

- **Save / Cancel / Delete / More** (line-focused More: Preview, Add items, Tear sheets, Generate POs, Duplicate, Link docs, Timeline)
- **Connected docs** (top right of header)
- **View Source Proposal** link
- **Read-only** title: `Edit Invoice IN-12946` (`h1.cch-doc-edit-invoice-num`, 18px)
- Line table: Add item, Edit images, Notes, row menu, **Tax rate** link in line-items header (needed for line tax math)
- Summary, document tags, memo (Houzz-style under table)
- One-line hint: payments/QB on main invoice page — use **Cancel** when done

### Layout structure (invoice edit)

```text
cch-doc-edit-page.cch-doc-edit-lines-only
  ├── Header card: Edit Invoice #, project/date, Connected docs, proposal link
  ├── Line items card + table
  └── Footer: Summary / Tags / Memo + hint
```

---

## 2. Line items table refinements (earlier in session)

| Change | Detail |
|--------|--------|
| **Unit column** | Hidden on **invoice** edit only (`_hideUnitCol`); proposals keep **Sell/ea** |
| **Ship → Shipping** | Header/tooltip: freight **fee**, not ship-to address |
| **Fonts** | `doc-edit-num-field`, `doc-edit-calc-field`, `doc-edit-room-select` — 11–12px mono stack in `cch-proposals-invoices-fix.js` |
| **Invoice #** | Read-only on edit (not editable input); save uses `docData.invoiceNum` only |

---

## 3. Performance — faster edit open

**Problem:** Opening edit re-ran heavy work (library bulk load, full clips scan, linked-docs queries, room list).

**Fixes:**

| Mechanism | File | Behavior |
|-----------|------|----------|
| `cchWarmInvoiceDisplayContext` | `cch-proposals-invoices-fix.js` | Single warm path on view load |
| `_cchSkipInvoiceWarmKey` | `index.html` | View → Edit skips second warm |
| `_cchLibBulkCacheLoaded` | `index.html` | `ensureLibraryCacheForInvoiceImageFallback` runs once per session |
| `cchGetProjectClipsCached` | `index.html` | Clips per project, reused for image context + clip re-sync |
| `_cchRoomsCache` | `index.html` | `_fetchProjectBoardRoomList` cached 5 min |
| `_cchLinkedDocsProjectLists` / `_cchLinkedDocsResultCache` | `cch-functions.js` | Connected docs dropdown |

**TTL:** `window.CCH_DOC_SESSION_CACHE_MS` = 5 minutes (default).

`docEditRecalcTotals()` **returns early** for invoice when `#docEditTotals` is absent (no totals UI in edit).

---

## 4. Related work in same thread (context for new session)

These were completed earlier in transcript **3744c84a** before the Houzz layout pass; still live on production:

- **View top bar:** `cchBuildDocViewTopbar` — Back, Preview, Send, Edit line items, More
- **Edit top bar:** `cchBuildDocEditTopbar` only in fix JS (do not add buttons in `renderDocEditPage`)
- **Tear sheets:** blank page fixes (`_tearMetaFromInvoiceItem`, image fallbacks)
- **Clip markup:** `cchParseClipMarkupPct`, `cchClipMarkupFlagHtml`, project default vs clip markup

---

## Key functions / entry points

| Action | Entry |
|--------|--------|
| Open invoice view | `#/project/{id}/invoice/{invoiceId}` → `renderInvoiceDetail` |
| Edit line items | Top bar or `_forceEditMode` → `renderDocEditPage('invoice', ...)` |
| Line table render | `docEditRenderItems()` in `index.html` (~28100+) |
| Totals on **view** only | `docEditRecalcTotals` skipped for invoice edit; view uses `invoiceRailHTML` |

**Monkey-patch rule:** Extend `cchBuildDocEditTopbar` / `cchBuildDocViewTopbar` in `cch-proposals-invoices-fix.js` — avoid scattering top-bar buttons in `index.html`.

---

## Files touched (this session)

| File | Changes |
|------|---------|
| `cch-deploy/platform/index.html` | `renderDocEditPage` invoice layout; caches; `docEditRecalcTotals` / `docEditSave`; clip/library warm paths |
| `cch-deploy/platform/cch-proposals-invoices-fix.js` | Edit/view CSS; `cchWarmInvoiceDisplayContext`; trimmed `cchBuildDocEditTopbar` More menu; view header Connected docs position |
| `cch-deploy/platform/cch-functions.js` | Linked-docs session cache for `showConnectedDocs` |

---

## Deploy checklist (for next agent)

**Staging (default):**

```bash
cd CCH-Platform-Deploy/cch-deploy
firebase deploy --only hosting:platform --project staging
```

**Production (after staging + user approval):**

```bash
firebase deploy --only hosting:platform --project cch-design-boards
# Or: DEPLOY-PRODUCTION-DANGER.bat (typed gates)
```

Always hard refresh (Ctrl+Shift+R). Confirm **orange STAGING banner** before treating staging as tested.

---

## Verify on next session

1. **IN-12946** (or any invoice) → **View** — totals + Paid on **right rail**; no edit clutter  
2. **Edit line items** — full-width table only; **no** Paid/totals sidebar; **no** payment/QB sections  
3. **Connected docs** — top right in view and edit headers  
4. View → Edit should feel faster (second warm skipped)  

---

## Not done / optional follow-ups

- **Git commit** — user has not requested; working tree may have uncommitted changes in the three files above  
- **Proposal edit table** — same font/density pass not explicitly applied (invoice-only layout branch)  
- **Tax rate in edit** — still in line-items header; could move to view-only if user wants zero financial UI in edit  
- **Invoice # editing** — intentionally read-only on edit; change only from view or admin flow if needed later  
- **Firestore / storage rules** — not changed this session (hosting only)  

---

## Prior session logs (do not confuse)

| Log | Topic |
|-----|--------|
| `SESSION_LOG_Cursor_2026-05-19.md` | Proposals status, line images storage, tax audit |
| `SESSION_LOG_Cursor_2026-05-21.md` | Markup −100%, convert to invoice, rooms list, Inspiration filter |

This session (**May 22**) is specifically **invoice edit view / Houzz alignment / performance**.

---

## Suggested first message for new Cursor session

```text
Continue from SESSION_LOG_Cursor_2026-05-22.md (and canonical INTERNAL_INVOICE_EDIT_VIEW_HOUZZ_ALIGN_CR_May22_v1.0.md).
Invoice edit is line-items-only; view page has totals/payments. Production verified IN-12946.
Default deploy = staging only unless I ask for production.
```
