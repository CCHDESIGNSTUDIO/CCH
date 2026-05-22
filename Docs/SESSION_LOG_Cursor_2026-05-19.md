# Session Log — Cursor: Proposals Status, Line Images, Tax Audit

**File:** SESSION_LOG_Cursor_2026-05-19.md  
**Original Author:** Cursor (CR)  
**Created:** May 19, 2026  
**Last Modified:** May 19, 2026  
**Last Modified By:** Cursor (CR)  
**Version:** 1.0  

**Workspace:** `CCH-Platform-Deploy`  
**Primary repo path:** `cch-deploy/platform/index.html`, `cch-deploy/platform/cch-proposals-invoices-fix.js`, `cch-deploy/firestore.rules`, `cch-deploy/storage.rules`  
**Firebase production:** `cch-design-boards` → https://cch-platform.web.app  
**Firebase staging:** `cch-studio-staging` → https://cch-platform-staging.web.app  
**Cursor transcript:** [Proposals, images, tax](3744c84a-ce88-42ff-984b-6779961eb09f)

## Revision history

- v1.0 (May 19, 2026, CR): Initial. Proposal list/status UX, proposal/invoice line image upload fix (production), Houzz design-service tax audit tools, client portal hero/messages (prior in same thread), invoice load error handling.

---

## Session overview

User worked on **Cloud - Rolling Hills** (`cloud-rolling-hills`) across proposals, invoices, and client portal. Main threads:

1. **Proposals tab UI** — PRO-3019 stayed **Draft** after “Publish to dashboard”; wanted visible/editable **Status**; list layout confusing (Lines A/P, scrollbar).
2. **Proposal & invoice line images** — Uploads worked on staging but failed on production (`storage/unauthorized` or images not persisting).
3. **Earlier same thread (deployed before this log’s end):** line Tag column, client portal hero save, portal message delete, proposals nav badge, Houzz import design-service tax audit.

**No git commits** were made (per user practice — commit when Cynthia requests).

---

## 1. Proposal status vs. publish (PRO-3019)

### Problem

- **Publish to dashboard** only set `published: true`, not `status`.
- List **Status** column reads `p.status`, so PRO-3019 could show **Draft** while published.
- No clear status control on proposal detail view.

### Fix (`index.html`)

- **`togglePublished`** — When publishing, if status is Draft/empty, also set `status: 'Published'` and `publishedAt`.
- **`setProposalStatus`** / **`proposalStatusSelectHtml`** — Dropdown on proposal detail (Draft, Published, In Review, Approved, Declined, Invoiced); client-visible statuses sync `published: true`.
- **`_refreshAfterProposalDocChange`** — Refreshes proposals list tab or detail after publish/status change.
- **Proposals list** — Separate **Status** and **Client** (✓ Live) columns; `statusBadge()` in list.
- **`saveProposalMetaFromModal`** — Edit-details modal syncs `published` when status is client-visible.
- **`formatProposalLineABHtml`** — Compact display `0 / 90 · 1 dec` instead of `0 / 90 -1`.
- Thinner **project-tabs** scrollbar CSS.

### Deploy

- Production hosting deployed (proposal UX) — hard refresh required.

### User action for PRO-3019

After refresh: open PRO-3019 → set **Status** to **Published** or re-click **On client portal** once.

---

## 2. Proposal / invoice line images (production)

### Problem (clarified by user)

Not client-portal **hero** images — **line-item images** on proposals and invoices failed on production while staging worked.

### Root causes (grounded in code)

| Issue | Detail |
|--------|--------|
| Storage path drift | Code used `images/doc-lines/...`, legacy prod used `docs/...`; `uploadProposalImage` used `proposals/...` with **no** Storage rule |
| Content-type | Windows uploads often `application/octet-stream`; rules required strict `image/*` |
| Save | Auto-save did not always sanitize image URLs before Firestore write |

### Fix

**`index.html`**

- **`docLineImageStoragePath()`** — Canonical path: `projects/{projectId}/doc-lines/{collection}/{docId}/...`
- **`uploadDocEditImage`**, **`piUploadImages`**, **`uploadProposalImage`** — Use canonical path + `uploadImageToStorage`
- **`_guessImageContentType()`** — Better jpeg/png/heic detection in `uploadImageToStorage`
- **`docEditSave`** — Sanitize `imageUrl` / `images[]` via `_sanitizeLineImagesForSave` before write
- **`renderInvoiceDetail`** — try/catch so “Loading invoice…” does not hang forever on error

**`storage.rules`**

- `allowedImageWrite()` — Allow `application/octet-stream` as well as `image/*`
- Added **`proposals/{allPaths=**}`** for legacy uploads
- Comment for legacy **`docs/`** path

### Deploy (end of session)

```text
firebase deploy --only hosting:platform --project cch-design-boards
firebase deploy --only storage --project cch-design-boards
firebase deploy --only hosting:platform --project cch-studio-staging
firebase deploy --only storage --project cch-studio-staging
```

### Verify

1. Hard refresh https://cch-platform.web.app  
2. Project → proposal or invoice → **Edit line items** → upload image on a line  
3. Expect toast “Image uploaded”; persists after reload  

If failure: note exact error (`storage/unauthorized`, etc.).

---

## 3. Client portal hero images (earlier in thread)

Separate from line images. Fixes included:

- Save **`heroImageUrl`** + **`clientPortalHeroUrl`** on board doc (merge), not only `heroImages` subcollection
- Upload path `projects/{projectId}/hero/...`
- Refresh **`renderClientPortal`** when on `#/clientview/...`
- **`firestore.rules`** — `match /heroImages/{docId}` under boards
- Load prefers board fields; subcollection only if board empty

Deployed production hosting + Firestore rules in that earlier pass.

---

## 4. Houzz design-service tax audit (earlier in thread)

**Trigger:** IN-12929 open balance; design services incorrectly taxed on Houzz imports.

**Root cause:** Houzz import Pass 3 created lines without `expenseType`/`taxable`; missing `expenseType` treated as taxable when invoice had `taxRate`.

**Fixes:** `cchInvoiceLineIsTaxable()`, `normalizeInvoiceLineItemsForEdit`, Houzz `_houzzImportMapInvoiceLine()`, console tools `auditDesignServiceInvoiceTax()` / `fixDesignServiceInvoiceTax()`.

**User:** Run audit in browser console before bulk fix.

---

## 5. Other items (same thread, deployed earlier)

| Item | Summary |
|------|---------|
| Line **Tag** column | Proposal edit/view/preview; `updateProposalItemField` for `lineTag`; fix.js doc view |
| Portal **messages** | Staff delete in preview; `cpDeletePortalMessage` |
| Proposals **sidebar badge** | `_propBadgeCt` from `proposalNeedsClientReview` |
| Cache bust | `cch-proposals-invoices-fix.js?v=1776700000016` (check current query string in index.html) |

---

## Key code locations

| Area | Location |
|------|----------|
| Proposals list tab | `renderProposalsTab` ~19180 |
| Proposal detail / status | `renderProposalDetail` ~22258; `setProposalStatus` ~23020 |
| `togglePublished` | ~23070 |
| Line image upload | `uploadDocEditImage` ~24644; `docLineImageStoragePath` ~3355 |
| Doc auto-save | `docEditSave` ~27059 |
| Invoice detail | `renderInvoiceDetail` ~31036 |
| Hero save | `cpAdminSaveHeroImage` ~54746 |
| Tax audit tools | ~44769 `auditDesignServiceInvoiceTax` |

---

## Outstanding / follow-up

1. Confirm PRO-3019 status + client portal visibility after hard refresh.
2. Confirm line image upload on production proposal + invoice (Cloud - Rolling Hills).
3. Run `auditDesignServiceInvoiceTax()` before `fixDesignServiceInvoiceTax(false)` if tax cleanup still needed.
4. If invoice still fails to load for doc `woO4Doh3lHzRuUEXqlhW`, check browser console after deploy (error UI should appear instead of infinite loading).
5. Git commit when Cynthia requests.

---

## Deploy checklist (copy for next session)

```bash
cd cch-deploy
firebase deploy --only hosting:platform --project cch-design-boards
firebase deploy --only storage --project cch-design-boards
# If hero/subcollection rules not on prod:
firebase deploy --only firestore:rules --project cch-design-boards
```

Staging: replace project with `cch-studio-staging`.
