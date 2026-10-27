# SPEC — Order Management Phase 2

**File:** SPEC_Order_Management_Phase_2_v2.0_BY-CLAUDE.md
**Original Author:** Claude (planner)
**Created:** June 21, 2026
**Last Modified:** June 21, 2026
**Last Modified By:** Claude
**Version:** 2.0
**Implementer:** Cursor

## Revision history

| Date | Change | Revised By |
|---|---|---|
| Jun 21, 2026 | Initial. Phase 2 = 6 focused additions to existing `cch-order-management.js` (`om6` build). NO page split. NO rebuild of existing reports. Pure additive features closing "paper marginalia got lost" gaps Cynthia identified Jun 21. | Claude |

---

## TL;DR

The current Order Management page (`cch-order-management.js` build `20260602om6`, 1,360 lines) is **good**. Phase 2 adds 6 focused features to close the remaining "things got lost on paper" gaps Cynthia identified. **Each feature ships independently** as `om7`, `om8`, etc. — no big-bang release. **Page structure does not change** — same one-page, 5-tab model.

---

## GUARDRAILS — what NOT to do

1. **Do NOT split Order Management into multiple pages.** Earlier planning suggested separating Bills/Variance — that was wrong. The one-page-per-PO model mirrors the paper PO that carried the full lifecycle. Keep it.
2. **Do NOT rebuild existing reports.** Open POs, Missing ETA, Missing confirmations, Receiving status, QuickBooks — all working. Touch them only to ADD columns/hints, never to restructure.
3. **Do NOT modify the renderPODetail page or project PO tabs.** Phase 2 lives entirely inside `cch-order-management.js` plus minor Firestore field additions.
4. **Do NOT touch `cch-po-bill-variance.js`** — variance arithmetic already lives there.
5. **Do NOT touch the Airtable push.** Bills + receivers spec (`AIRTABLE_BILLS_RECEIVERS_SPEC_CR_Jun20_v1.0.md`) is a separate track.
6. **Staging-first.** Every feature ships to staging, tested, then production with typed Cynthia GO. The existing `cchOmPageEnabled()` gate is sufficient — don't add new gates.
7. **Single-committer rule.** Cursor edits, hands off file list to repo-owner #1 for commit + deploy. No `git add/commit/push/firebase deploy` from Cursor sessions unless Cursor IS #1.
8. **Bump `OM_BUILD`** on every feature ship — `'20260602om6'` → `'YYYYMMDDomN'`.

---

## Architecture context (so Cursor doesn't have to re-derive)

### Existing data sources (`om6` already reads these)

| Source | Path | Used for |
|---|---|---|
| PO doc | `boards/{projectId}/purchaseOrders/{poId}` | All status / total / vendor data |
| PO line items | `po.items[]` | Per-line title, qty, cost, etaDate, estimatedShipDate, confirmedDate |
| Vendor docs | `po.vendorInvoiceGroups[]` | Bill / ship invoice / SO# / confirmedDate / etaDate / actualShipDate / trackingNumber |
| Bill metadata | `po.bill` | billTotal, attachments, vendorInvoices |
| QB sync state | `po.qbSynced`, `po.qbDocId`, `po.qbStatus` | QuickBooks tab |
| Linked clips | `boards/{projectId}/clips/{clipId}` via `findLinkedClipsForPo` | Receiving status — line→clip linkage |

### Existing helpers Cursor should reuse (don't re-implement)

| Helper | Purpose | Line in om6 |
|---|---|---|
| `cchOmIsOpenPo(po)` | Open status filter | ~80 |
| `cchOmIsStudioPo(po)` / `cchOmIsHouzzPo(po)` | Houzz legacy filter | ~43-59 |
| `cchOmPoConfirmDate(po)` | Latest confirm date | ~485 |
| `cchOmBillsInfo(po)` | Bill count + status | ~443 |
| `cchOmPoEtaDateIso(po)` | Primary ETA | ~533 |
| `cchOmPatchPrimaryVendorDates(projectId, poId, fields)` | Write-back to `vendorInvoiceGroups[0]` | ~548 |
| `cchOmSaveStatus / cchOmSaveConfirmDate / cchOmSaveEtaDate` | Inline cell save patterns — mirror these | ~604-622 |
| `cchOmReceivingSummary(po, clipRows)` | Line-level receiving rollup | ~762 |

**Pattern to mirror for ALL Phase 2 writes:** `cchOmSaveStatus` is the canonical "user clicks in cell → debounce → patch Firestore field → re-render row" example. Follow it for every new editable field below.

---

## Phase 2 — the 6 features (in suggested ship order)

### Feature 1 — Stuck-state visual flags (ship as `om7`)

**Goal:** Make stuck POs impossible to ignore on the Open POs table.

**Why:** Vanessa's biggest "lost" failure was forgetting to follow up on a PO that had been sitting without acknowledgment. Visual heat map = zero cognitive load.

**Data model:** No new fields. Pure render logic.

**Rules:**

| Condition | Visual treatment |
|---|---|
| Confirm date blank AND age > 7 days | Red left border on row (`border-left: 3px solid #E16A5B`) + red dot in Confirm cell |
| ETA in the past AND status ≠ Received/Installed | Orange row background tint (`rgba(196,164,100,0.08)`) |
| Age > 30 days AND status ∈ {Draft, Sent to vendor, Waiting for Confirmation} | Pulsing border (CSS animation) — "this needs your attention NOW" |
| Variance > 0 (computed from `po.bill.billTotal` vs `poTotal(po)`) AND status ≠ Closed | Yellow dot in Bills cell |

**Where to add:** In `openPosTable()` row rendering (~line 349). Add a `stuckClass(po)` helper that returns the right border/background style based on the conditions above.

**No save path** — pure render.

**Definition of done:**
- Stuck POs visible without clicking in
- Cynthia can scan the Open POs table in 2 seconds and identify the 3 worst offenders
- No false positives on POs that ARE current
- Build bumped to `om7`

**Files touched:** `cch-order-management.js` only.

---

### Feature 2 — Notes / journal drawer per PO (ship as `om8`)

**Goal:** Replace the paper marginalia. Every PO has an append-only timeline of human notes + system events. Searchable, timestamped, never lost.

**Why:** "Things got lost on paper" — vendor said X on a phone call, ad-hoc reminder, "called Susan, said use brass not chrome." With paper, these died when the PO was filed. Digital makes them permanent.

**Data model:**

```
boards/{projectId}/purchaseOrders/{poId}
  notes: [
    {
      id: <auto>,              // for keying in UI
      type: 'user' | 'system', // user note vs auto-logged status change
      text: string,
      author: string,          // currentUser.email
      createdAt: ISO string,
      // optional contextual fields:
      relatedField?: string,   // 'status' | 'confirmedDate' | 'etaDate' | 'bills' | etc.
      oldValue?: any,          // for system entries
      newValue?: any
    }
  ]
```

**UI:**
- Add a small "📝 Notes" column at far right of Open POs table — shows count + most recent note preview (truncated to 40 chars) or "—" if empty
- Clicking the cell opens a side drawer (right edge, 380px wide) showing:
  - PO header (number, vendor, project, status)
  - Notes list, newest first
  - Compose box at top: textarea + "Add note" button
  - Each note: timestamp + author + text + (for system entries) "Status changed from X to Y" autoformat
- Drawer closes via Esc or click outside

**Save path:**
- New helper: `cchOmAddNote(projectId, poId, text)` — appends to `notes[]` with `arrayUnion`, sets `_updatedAt`
- **Auto-log integration:** `cchOmSaveStatus`, `cchOmSaveConfirmDate`, `cchOmSaveEtaDate` already exist (lines 604-622). Modify each to ALSO append a `{type: 'system', ...}` entry to `notes[]` describing the change. Reuses the same patch call — single round-trip.

**Where to add:** New section in `cch-order-management.js` after existing inline-save helpers (~line 700). Drawer HTML rendered into a new `<div id="omNotesDrawer">` injected once at first open.

**Definition of done:**
- Every status/date change auto-logs to notes
- User can add free-text notes from the drawer
- Notes survive page reload (Firestore persistence)
- Drawer doesn't block the main grid
- Build bumped to `om8`

**Files touched:** `cch-order-management.js` only.

---

### Feature 3 — Per-line backorder indicator + row count rollup (ship as `om9`)

**Goal:** When a vendor says "items 3 and 5 are backordered until September," that gets captured per-line and rolled up to the PO row.

**Why:** Currently BO status is invisible until you drill into the PO. Surfacing on the main grid prevents Cindy from promising delivery dates that won't happen.

**Data model:**

```
po.items[].backordered: boolean    // NEW — set true when vendor confirms BO on this line
po.items[].backorderedAt: ISO       // when marked
po.items[].backorderEtaDate: ISO    // optional — separate from line's main etaDate; the BO-recovery date
```

**UI:**
- Add new column "BO" between "Lines W/O ETA" and "Total" — shows count of `items.filter(i => i.backordered).length`. If 0, show "—". If > 0, show count in orange.
- Optionally a small ⓘ tooltip listing the BO line items + their `backorderEtaDate`s.
- Inside the notes drawer (Feature 2): show a "Backorders" section listing the BO lines.

**Marking a line as BO:**
- For Phase 2, mark BO via the EXISTING PO detail page (don't add inline editing on the OM grid for this — too much UI for a per-line action).
- Cursor's task: ensure `po.items[i].backordered` field is written from PO detail's existing line-edit modal (likely needs a small checkbox addition there). If PO detail edit modal is out of scope per guardrail #3, defer the WRITE side to Phase 3; just READ for display in Phase 2.

**Definition of done:**
- BO column visible on Open POs
- Counts roll up accurately
- Notes drawer surfaces BO lines
- If no PO detail page changes (per guardrail #3), Phase 2 is read-only display; flag for Phase 3 to add the write path
- Build bumped to `om9`

**Files touched:** `cch-order-management.js`. Possibly `platform/index.html` ONLY if Cynthia explicitly approves adding a BO checkbox to the PO detail line-edit modal.

---

### Feature 4 — Confirmed unit price + variance dot per line (ship as `om10`)

**Goal:** When the vendor's confirmation comes back with a different unit price than the PO, capture it the moment it arrives. Surface the variance immediately.

**Why:** Vendor changed the deal at confirmation time — under the paper process, this was caught by Vanessa eyeballing the SO PDF; often missed. Digital captures it structurally.

**Data model:**

```
po.items[].confirmedUnitPrice: number  // NEW — set when confirmation document is received & matched to line
po.items[].confirmedAt: ISO            // when this confirmation came in
```

**Source:** When a vendor sends a confirmation document (already modeled via `vendorInvoiceGroups[].documentType === 'confirmation'`), the receiving flow extracts per-line confirmed prices into `items[i].confirmedUnitPrice`.

**Computed:** `priceVarianceAtConfirmation = item.confirmedUnitPrice - item.unitCost` (or `item.cost`). If non-zero, flag.

**UI:**
- No new column on the main grid (would make it too wide). Surface via:
  - Orange ⚠ dot in the existing **Confirm** cell if ANY line has non-zero price variance
  - On hover/click of the dot, show a small popover listing the affected lines with old/new prices
  - Notes drawer (Feature 2): auto-logged entry on the FIRST detection: "Confirmation received — 2 lines have price changes: Lamp $850→$895 (+$45), Sconce $320→$340 (+$20)"

**Where to capture the price:**
- Phase 2 v2.0 scope is **display only**. The WRITE path (where `confirmedUnitPrice` gets populated) lives in the bill-receive flow that already exists in `cch-po-bill-variance.js`. Cursor's task: in the existing "Receive bill" / "Add confirmation" flow, capture per-line confirmed prices into the new fields. If that's already a deep change, defer to Phase 3 and just READ from anywhere `confirmedUnitPrice` happens to be populated.

**Definition of done:**
- Orange dot appears on Confirm cells where any line has price variance
- Hover/click popover lists affected lines
- Auto-logged note in journal at first detection
- Build bumped to `om10`

**Files touched:** `cch-order-management.js`. Possibly `cch-po-bill-variance.js` for the write path (decide per guardrail #4 — defer if too invasive).

---

### Feature 5 — ETA history per line (ship as `om11`)

**Goal:** When an ETA slips, the old ETA is preserved alongside the new one. "ETA was July, then Aug, then Oct" becomes a visible audit trail instead of just the latest date.

**Why:** Slip patterns are diagnostic — "this vendor slips 3 times every order" — and impossible to see without history.

**Data model:**

```
po.items[].etaDate: ISO             // EXISTING — the current ETA
po.items[].etaHistory: [            // NEW — append-only
  { etaDate: ISO, recordedAt: ISO, source: 'manual' | 'confirmation' | 'shipinvoice', notes?: string }
]
```

**Write path:**
- When `cchOmSaveEtaDate` patches `vendorInvoiceGroups[0].etaDate`, ALSO append the previous ETA to `etaHistory[]` if it existed and is different from the new value
- Similarly for line-level ETAs set via PO detail edit modal (if Cursor touches that — same guardrail #3 caveat)

**UI:**
- In the Open POs row, ETA cell: if `etaHistory.length > 1`, show small ⓘ icon next to the date
- Hover/click: popover with the chronological history: "Originally Aug 15 (Jun 5) → revised to Sep 30 (Jul 10) → current Oct 15 (Aug 1)"
- Notes drawer: auto-logged entry on each ETA change

**Definition of done:**
- Saving a new ETA preserves the old one in etaHistory
- ⓘ icon visible when slip history exists
- Popover shows chronological progression
- Build bumped to `om11`

**Files touched:** `cch-order-management.js`. Existing `cchOmSaveEtaDate` is the integration point — just extend it.

---

### Feature 6 — Substitute / discontinued workflow (ship as `om12`)

**Goal:** When vendor says "we don't make that anymore," the line gets marked Discontinued, a substitute is found in the Product Library, the swap is recorded with a lineage to the original, and (if line is on a sent proposal) the client is notified for approval.

**Why:** The single biggest "lost" failure mode. Substitutes used to involve a phone call, an email to client, a verbal "yes," and a forgotten paper note. Now it's a tracked, irreversible audit trail.

**Data model:**

```
po.items[].lineStatus: string          // NEW — extends existing item status. Values:
                                       // 'active' (default) | 'discontinued' | 'substituted'

po.items[].discontinuedAt: ISO          // when vendor reported discontinued
po.items[].discontinuedNote: string     // why (free-text from vendor email/call)

po.items[].substitutionHistory: [       // NEW — every swap, append-only
  {
    originalSku: string,
    originalTitle: string,
    originalUnitPrice: number,
    substituteSku: string,
    substituteTitle: string,
    substituteUnitPrice: number,
    substituteProductId: string,        // link to /products/{id} if from Library
    reason: string,                     // "Vendor discontinued OUT-209980"
    proposedBy: string,                 // designer email
    proposedAt: ISO,
    clientApprovalStatus: 'pending' | 'approved' | 'rejected',
    clientApprovedAt?: ISO,
    clientApprovedBy?: string           // client email
  }
]
```

**UI on Open POs row:**
- Small 🔄 badge next to PO# if ANY line has substitution history (active OR pending)
- Click badge → opens drawer (same as notes drawer, scrolled to a new "Substitutions" section)

**UI for the swap flow (NEW modal):**
- Triggered from PO detail page line action: "Mark Discontinued"
- Modal: "Vendor [X] reported [Item Y] discontinued. Reason: [textarea]"
- After confirm: status → `discontinued`, prompts: "Find substitute?"
- "Find substitute" → opens Product Library modal filtered to: same vendor, same category, similar price band
- User picks substitute → modal shows side-by-side comparison (original vs substitute, price delta)
- Confirm → writes substitutionHistory entry, lineStatus → `substituted`
- If line is on a Sent proposal: auto-generates a client approval request (proposal client portal banner: "Item X substituted with Y — review")

**Client-side approval:**
- Client portal sees the substitution on the proposal/invoice as a callout with side-by-side
- Approve/Reject buttons write `clientApprovalStatus` + `clientApprovedAt`

**Audit trail in notes drawer:**
- Every state transition auto-logged: "Item marked discontinued", "Substitute proposed: SKU Y at $X", "Client approved substitute"

**Definition of done:**
- Designer can mark a line Discontinued from PO detail
- "Find substitute" flow successfully writes substitutionHistory
- Client portal renders substitute approval banner
- Approval state syncs back to PO
- Original line preserved in history (never deleted, just superseded)
- Build bumped to `om12`

**Files touched:**
- `cch-order-management.js` (drawer + badge)
- `platform/index.html` (substitute modal — Cursor decides best location, ideally NOT inside renderPODetail per guardrail #3 — maybe a standalone modal callable from PO detail's line-edit row action)
- Client portal proposal/invoice render path (small banner addition)

**Phase 2 scope decision:**
- Feature 6 is the biggest. If scope creep risk, ship Features 1-5 as full Phase 2, defer Feature 6 to Phase 2.1 with its own typed GO.

---

## Cross-cutting integration: notes drawer (Feature 2) is the universal audit trail

Features 3-6 all auto-log to the notes drawer from Feature 2. So Feature 2 should ship before 3-6 to maximize value. Suggested final ship order:

| Build | Feature | Risk | Time est |
|---|---|---|---|
| `om7` | Stuck-state visual flags | Low (CSS-only) | 1 session |
| `om8` | Notes / journal drawer | Low (new schema, new UI but isolated) | 1-2 sessions |
| `om9` | BO indicator (read-only) | Low (read-only Phase 2; write deferred) | 1 session |
| `om10` | Confirmed unit price variance (display) | Medium (schema decision) | 1-2 sessions |
| `om11` | ETA history per line | Low (extends existing save) | 1 session |
| `om12` | Substitute workflow | High (cross-page, client-portal) | 3-4 sessions |

Total: 8-11 Cursor sessions across 1-3 weeks.

---

## Testing checklist per feature (Cursor runs each)

For every feature:
1. ✅ Staging deploy successful — `OM_BUILD` shows new version in topbar
2. ✅ All EXISTING tabs still work (Open POs, Missing ETA, Missing confirmations, Receiving, QuickBooks)
3. ✅ Existing inline edits (Status, Confirm, ETA) still save
4. ✅ Houzz legacy filter still hides legacy POs
5. ✅ Filters still work (project / vendor / status / aging / keyword)
6. ✅ Sort still works
7. ✅ New feature works on staging
8. ✅ Cynthia reviews staging, types GO
9. ✅ Production hosting deploy
10. ✅ Production smoke test by Cynthia
11. ✅ KNOWN_ISSUES.md updated if a regression is found

---

## Phase 3 hooks (NOT in Phase 2 scope — for reference only)

After Phase 2, the COS Agent (CURRENT_PRIORITIES item 3c) and CFO Agent (item 3d) hook into:

| Watcher | Data source it reads |
|---|---|
| Stuck-PO watcher (COS) | The conditions from Feature 1 + notes journal entries |
| Variance-exposure watcher (CFO) | `priceVarianceAtConfirmation` (Feature 4) + bill variance (existing) |
| Substitute-stuck watcher (COS) | `substitutionHistory[].clientApprovalStatus === 'pending'` (Feature 6) > N days |
| Slip-pattern watcher (CFO) | `etaHistory[]` (Feature 5) — vendors with chronic slip |

Phase 2 BUILDS the structured data. Phase 3 reads it and acts.

---

## Handoff to #1 (repo/deploy owner)

**Files I edited (planner work — no code):**
- This spec doc only: `Docs/SPEC_Order_Management_Phase_2_v2.0_BY-CLAUDE.md`

**No code changes. No commits. No deploys.**

**Suggested next steps for #1:**
1. Read this spec
2. Coordinate with Cursor: assign Feature 1 (smallest, safest) first
3. Update `CURRENT_PRIORITIES.md` item 3b — reframe from "Discrepancy Report as separate page" to "Phase 2 features added to existing Order Management page per SPEC v2.0"
4. After Feature 1 ships clean, proceed to Feature 2

**Cursor's task per feature** (use this prompt template):

> Implement Feature [N] from `Docs/SPEC_Order_Management_Phase_2_v2.0_BY-CLAUDE.md`. Read the spec section in full FIRST. Stay within the guardrails. Touch only the files listed in "Files touched" for that feature. Bump `OM_BUILD` per the spec. Staging deploy + verify checklist. Hand off to #1 for typed-GO production deploy.

---

*End of spec.*
