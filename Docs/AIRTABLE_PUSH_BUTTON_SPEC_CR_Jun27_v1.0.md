# Airtable Push Button — Spec (for #1)

**File:** AIRTABLE_PUSH_BUTTON_SPEC_CR_Jun27_v1.0.md  
**Author:** Cursor (CR)  
**Created:** June 27, 2026  
**Version:** 1.0  
**Status:** DRAFT — build after current receiving deploy lands on production

---

## Problem

PO → Airtable sync works via CLI only:

```bash
node _scripts/push-pos-to-airtable_BY_CR_2026-06-19.js --project=<boardId> --env=prod [--po=<poId>]
```

There is **no Studio button**. Staff must ask an agent or run a terminal command. The **📦 Receiving** nav link opens Airtable (view only).

---

## Goal

Add **Push to Airtable** buttons in Studio that call a **Cloud Function** (same pattern as `pushPOToQB`). Cynthia clicks → POs upsert to the CCH Delivery Receiving base → toast with counts.

**Out of scope for v1:** two-way receiving write-back (see `AIRTABLE_ORDER_MGMT_SYNC_PLAN_CR_Jun22_v1.0.md` Phase 2).

---

## Architecture

```
Studio UI (button)
  → firebase.functions().httpsCallable('pushPOsToAirtable')({ scope, projectId?, poId? })
  → Cloud Function (Functions/index.js)
  → shared push module (extracted from _scripts/push-pos-to-airtable_BY_CR_2026-06-19.js)
  → Airtable REST PATCH performUpsert
```

### Why a Cloud Function (not client-side)

- **Airtable PAT must never ship to the browser.** Store as Firebase secret `AIRTABLE_PAT` (same idea as QB tokens).
- Push reads all boards for firm-wide scope — Firestore rules may block client reads across projects; Admin SDK in Functions is correct.
- Rate limiting + throttling (230ms between Airtable calls) belongs server-side.

### Refactor (required)

Extract push logic into a shared module both the CLI script and the function can require:

| File | Role |
|---|---|
| `Functions/lib/airtable-po-push.js` | Core: load POs, build fields, upsert PO + lines, return stats |
| `_scripts/push-pos-to-airtable_BY_CR_2026-06-19.js` | Thin CLI wrapper (keeps `--env`, `--dry-run`, local PAT file for dev) |
| `Functions/index.js` | `exports.pushPOsToAirtable = onCall(...)` |

Do **not** duplicate field mapping — single source of truth in `Functions/lib/airtable-po-push.js`.

Current field mapping (as of Jun 27) — keep in sync:

- **PO #** — merge key
- **Vendor**, **Ship to**, **Receiver**, **Receiver Email**, **Ship-to type**, **Project**, **PO date**, **Notes**
- **Client** — intentionally NOT pushed (privacy)
- **Line items** — merge on `sourceKey`; images via Firebase Storage URLs
- **Receiver-entered fields** — never overwrite (qty received, condition, photos, etc.)

Airtable columns written **by name** (no schema API): `Receiver`, `Receiver Email` — must match Airtable exactly.

Base: `app8Je7Mpc81giBre` · PO table: `tblDclxZj88am7XMR` · Lines: `tblT1Bjq0Ur09bd8J`

---

## Callable API

### `pushPOsToAirtable`

**Auth:** Signed-in Studio user only. Reuse billing-admin / PO-ops allowlist pattern from `pushPOToQB` (`assertQbPushAllowed` or a dedicated `assertAirtablePushAllowed` — same role set Cynthia uses for finance ops).

**Request:**

```json
{
  "scope": "po" | "project" | "firm",
  "projectId": "cloud-rolling-hills",  // required for scope po | project
  "poId": "7lTOzx4fCVBCyKvLMFp7"       // required for scope po
}
```

| scope | Behavior |
|---|---|
| `po` | Upsert one PO + its lines |
| `project` | All Studio POs on one board (`cchOmIsStudioPo` filter — exclude Houzz legacy) |
| `firm` | All active boards' Studio POs (same loader as Order Management: `cchPoLoadAllPosForVendorBills` equivalent server-side) |

**Response:**

```json
{
  "success": true,
  "pos": 19,
  "lines": 49,
  "imagesAttached": 33,
  "imagesSkipped": 0,
  "message": "Pushed 19 POs (49 lines) to Airtable."
}
```

**Errors:** `HttpsError` with readable message (Airtable 422 unknown field → tell user which column name is wrong).

**Dry-run:** Not exposed in UI v1. Keep CLI `--dry-run` for agents.

---

## UI — three button placements

### 1. PO detail (highest priority)

**Where:** PO view page, **Vendor & ship to** panel or topbar actions (next to Preview / Edit PO).  
**Label:** `Push to Airtable` or `↗ Airtable`  
**Action:** `scope: 'po'`, current `projectId` + `poId`.  
**Feedback:** Toast on success; disable button + spinner while running.

### 2. Receivers page (`renderDeliveryReceivers`)

**Where:** Topbar actions (already has "Order Management → Receiving" link).  
**Label:** `Push all to Airtable`  
**Action:** `scope: 'firm'`.  
**Confirm dialog:** "Push all active Studio POs to Airtable? Receiver-entered check-ins will not be overwritten."

### 3. Order Management → Receiving tab

**Where:** Tab toolbar next to refresh.  
**Label:** `Refresh Airtable`  
**Action:** `scope: 'firm'` (same as Receivers — OM Receiving is firm-wide).  
Optional later: filter to POs visible in current OM filter only.

### Client portal

**Never show these buttons** to client/guest roles (same guardrail as PO visibility).

---

## Frontend helper (suggested)

Add to `cch-po-bill-variance.js` or small `cch-airtable-push.js`:

```javascript
window.cchPushToAirtable = async function(opts) {
  opts = opts || {};
  var fn = firebase.functions().httpsCallable('pushPOsToAirtable');
  var res = await fn({
    scope: opts.scope || 'po',
    projectId: opts.projectId,
    poId: opts.poId
  });
  if (typeof showToast === 'function') showToast(res.data.message || 'Pushed to Airtable', 'success');
  return res.data;
};
```

Wire buttons to `cchPushToAirtable({ scope: 'po', projectId, poId })` etc.

---

## Secrets & deploy

1. Create / confirm Airtable PAT with `data.records:read` + `data.records:write`, scoped to base `app8Je7Mpc81giBre` only.
2. Store in Firebase:
   ```bash
   firebase functions:secrets:set AIRTABLE_PAT --project cch-studio-staging
   firebase functions:secrets:set AIRTABLE_PAT --project cch-design-boards
   ```
3. Deploy Functions + hosting:
   ```bash
   firebase deploy --only functions:pushPOsToAirtable,hosting:platform --project staging
   ```
   Test on staging → then production.

**Staging note:** Function always reads/writes the **same Airtable base** (production receiving base). That is intentional — Airtable is the receiving hub, not a staging clone. Firestore **source** is whichever Firebase project the function runs in (staging function reads staging Firestore if you want a staging-only test; production function reads production Firestore).

Recommendation: **production function pushes production Firestore → Airtable**. Staging function can push staging Firestore for safe tests (separate Airtable base optional later).

---

## Phase 2 (same function module — not v1 UI)

Documented in prior conversation ("all 3"):

| Mode | Trigger | Notes |
|---|---|---|
| Manual | Button + CLI | v1 |
| Scheduled | `onSchedule` nightly → `pushPOsToAirtable` internal call, `scope: 'firm'` | Fresh each morning |
| Live | `onDocumentWritten` on `boards/{id}/purchaseOrders/{poId}` | Push single PO on change; debounce 30s to avoid Airtable rate limit during bulk edits |

Build scheduled + live **after** v1 button is stable on staging.

---

## Test plan

1. **Staging:** Deploy function + one button (PO detail only).
2. Open a known PO (e.g. Rolling Hills PO-9036 on staging Firestore or prod if staging has no POs).
3. Click **Push to Airtable** → toast shows counts → refresh Airtable → PO + lines updated, **Receiver Email** populated where ship-to contact has email.
4. Re-click → idempotent (no duplicates; receiver check-in fields untouched).
5. **Firm push** from Receivers page → confirm row count matches Studio Receivers report.
6. **Auth:** client/guest cannot call function.
7. **Production:** deploy after Cynthia sign-off.

---

## Files #1 will touch

| File | Change |
|---|---|
| `Functions/lib/airtable-po-push.js` | **NEW** — extracted push core |
| `Functions/index.js` | **ADD** `pushPOsToAirtable` onCall |
| `_scripts/push-pos-to-airtable_BY_CR_2026-06-19.js` | **REFACTOR** — require shared module |
| `platform/cch-po-bill-variance.js` or `platform/cch-airtable-push.js` | **NEW** — `cchPushToAirtable` helper |
| `platform/cch-proposals-invoices-fix.js` | PO detail button |
| `platform/index.html` | Receivers page button |
| `platform/cch-order-management.js` | OM Receiving tab button |
| `Docs/AIRTABLE_PO_PUSH_SPEC.md` | Update field list (Receiver, Receiver Email; Client not pushed) |

---

## Related docs

- `Docs/AIRTABLE_PO_PUSH_SPEC.md` — field IDs + guardrails
- `Docs/AIRTABLE_ORDER_MGMT_SYNC_PLAN_CR_Jun22_v1.0.md` — OM alignment + Phase 2 write-back
- `Docs/AIRTABLE_BILLS_RECEIVERS_SPEC_CR_Jun20_v1.0.md` — Bills table + receiver linking (future)

---

## Handoff note for Cynthia

**Today:** no button — use CLI or ask CR to run the script.  
**After this build:** PO detail + Receivers + OM Receiving get push buttons; PAT lives in Firebase secrets; CLI script remains for agents/dry-run.
