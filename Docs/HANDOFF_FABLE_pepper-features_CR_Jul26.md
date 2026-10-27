# Fable plan brief — Pepper feature pack (staff assistant)

**From:** Cursor (Machine 1) · **Date:** 2026-07-26  
**App:** CCH Studio · Staging: cch-platform-staging.web.app · Prod: cch-platform.web.app  

**Authority:** Sequence + Feature A launch point are **locked in**  
`Docs/FABLE_DECISION_pepper-features_CW_Jul26_v1.1.md` (v1.0 kept for history).  
This handoff is the original ask + Bugletrail grounding note; **do not re-open A’s single-vs-batch question.**

---

## Context (what Pepper is today)

| Piece | Location | Behavior |
|-------|----------|----------|
| UI | `platform/cch-pepper.js` | Floating staff panel; presets + free text |
| Cloud | `Functions/cchPepper.js` | `onCall` Claude Sonnet 4.6; staff email allowlist |
| Grounding | Client builds `activityDigest` from project **activity** only | Filtered activity rows — **not** `clientDecisions`, Follow-Ups stalls, time, POs |
| Writes | **None** | Pepper never updates Firestore / QB / mail |
| Chat | Session DOM only | Clears on project change / Clear (v9.9.2 / `20260726b` staging). Not shared Cindy↔Vanessa |

**Standing product rules Pepper must not break**

- Staff-only (never client portal / `#/clientview/`)
- No silent sends (email, QB, bill edits) — human review always
- Doc isolation / QB push guards stay intact
- Staging first; production only on Cindy typed GO

---

## Feature E — P0 GROUNDING: Decisions + Follow-Ups + real activity *(Cindy Jul 26 — Bugletrail)*

### Cindy ask (screenshots + chat)
Pepper on **7225 Bugletrail** could not see open portal decisions (“powder”) or the Follow-Ups list (13 stalls: open invoices, unanswered decisions, rooms with selections and no proposal). It only saw that “powder decisions were posted” in the activity log and asked her to paste the list.

**Product rule:** Pepper must see what staff already see in Studio for that project — especially **open client decisions**, **Follow-Ups stalls**, and richer **client activity** — so “Draft a follow-up” / “What needs attention” are grounded, not blind.

### Root cause (grounded)
`platform/cch-pepper.js` → `buildActivityDigest` / `pepperFetchProjectActivity`:
- Reads only top-level `activity` where `projectId == …`
- Keeps rows if `pepperIsClientDoc` **or** actions in `{ line_approved, line_declined, proposal_total_approved }`
- **Never reads** `boards/{projectId}/clientDecisions` (where open “powder” decisions live — same source as Client activity badge / Follow-Ups lane)
- **Never reads** Follow-Ups stall detectors (`cch-followups.js` → `fuDetectStalls` / project bundle)

So Pepper sees “decision posted” activity crumbs, not title/status/age of open decisions, and not INV-6028 / “selections complete · no proposal coverage” rows.

### Canonical data to wire (reuse — do not invent)

| Digest | Source (already in Studio) | Fields for Pepper text |
|--------|----------------------------|-------------------------|
| Open decisions | `boards/{pid}/clientDecisions` (status `open` / `changes_requested`) | title, status, createdAt, room/options if present |
| Needs-client tasks | `boards/{pid}/tasks` (`clientFlag === needs_input`, no response) | title, flag |
| Follow-Ups stalls | Same detectors as `cch-followups.js` `fuDetectStalls` (or export a light text builder from that module) | lane, title, sub, days — e.g. open invoices, unanswered decisions, rooms w/ selections no proposal |
| Client activity | Existing activity fetch **plus** decision docs (not approval-line-only filter) | recent portal opens, messages, stars, decision posts with titles |

### Desired outcome
1. Every Pepper send/preset includes digests: **Open decisions**, **Follow-Ups (waiting on client / waiting on studio)**, **Recent client activity** (capped, readable bullets).
2. Presets **Summarize status** / **What needs attention today** / **Draft a follow-up** use that text — e.g. Bugletrail should mention powder open + INV balances + “selections complete · no proposal” rooms without pasting.
3. Still **read-only** — no auto status changes, no auto-send email.
4. Prefer exporting a small helper from follow-ups / client-activity over duplicating stall math.

### Acceptance (Bugletrail staging)
- Pepper “What needs attention” lists at least: open powder decision(s), open invoice balances in Follow-Ups, and “waiting on you” proposal-coverage stalls — without Cindy pasting.
- “Draft a follow-up” can draft a client nudge naming the open decision title(s).
- `#/clientview/…` still never shows Pepper.

### Priority
**P0 — before** vendor mailto (A) and unbilled time (B). Without this, all drafting presets stay half-blind.

---

## Feature A — Vendor order-status follow-up (email) · LOCKED v1.1

### Cindy ask
Can Pepper open email to send a follow-up to vendors for order status?

### Locked entry points (Cindy + Fable v1.1 — not open questions)
1. **Primary — Order Management**  
   `#/ordermanagement/noeta` (**Missing ETA**) and `#/ordermanagement/noconfirm` (**Missing confirmations**) already list POs that need a vendor nudge firm-wide. Add a per-row **Follow up** → draft + `mailto` (one email per click). Batch = work down the existing list; **no** multi-send composer in Pepper.
2. **Primary — PO page**  
   Same action next to existing **Send to vendor** (`cch-po-vendor-comms.js`).
3. **Secondary — Pepper chat preset**  
   “Draft vendor status follow-up” for chat-first path when a project/PO is already open. Build **after** OM + PO buttons.

### Implementation constraints (v1.1)
- Reuse exact `cch-po-vendor-comms.js` mailto (To vendor, Cc orders@). Optional log to `vendorCommunications`. **Never auto-send.**
- Open-POs digest (Feature D) must call the **same helpers** OM Missing ETA / Missing confirmations already use — one query family, two consumers. No parallel PO query.

### Out of scope
- Auto-send SMTP/Gmail API/inbox reading; Pepper-panel-only batch composer; client portal entry

---

## Feature B — Time ledger: missing hours + what to invoice

### Cindy ask
Can Pepper look at time ledger and summarize missing hours and what needs to be invoiced?

### Today
- Pepper **does not** read `timeEntries` / Timely / invoice `timeEntryIds`.
- Studio already has related logic (billable flags, `timeEntryIds` on invoices, dashboard missing-hours style copy) in `platform/index.html` — Fable should grep and reuse, not reinvent.

### Desired outcome
1. Preset e.g. **“Unbilled time / what to invoice”**.
2. **v1 project-scoped** (safest): current `#/project/{id}` time entries → hours by person/week → exclude non-billable → exclude ids already on invoices → list “ready to invoice” + obvious gaps (e.g. thin days if that data exists).
3. Output: short staff summary + optional “suggested design-services invoice hours” (draft only).
4. **No auto-create invoice** in v1.

### Open decisions
- Project-only first vs firm-wide “who hasn’t logged”?
- Missing hours = calendar gaps vs Timely sync gaps vs “expected weekly hours”?
- Rates visible to Pepper? (Staff-only OK per system prompt — still confirm Cindy wants $ in the summary.)

### Out of scope (unless Cindy expands)
- Creating invoices, pushing to QB, changing time entries

---

## Feature C — Bill updates (explicit non-goal unless reopened)

### Cindy ask
Can Pepper update a Bill?

### Answer today
**No** — and recommend **keep as non-goal** for this pack. Bills = PO receive / variance / `pushBillToQB` paths. High financial risk.

### If ever revisited
- Draft-only checklist (“fields to confirm on bill”) or navigate-to-PO deep link — **not** silent Firestore/QB writes.

---

## Feature D — Digest foundation (shared; A uses OM helpers)

| Digest | Source | Used by |
|--------|--------|---------|
| Open / nudge POs | **Same helpers as OM Missing ETA + Missing confirmations** (`cch-order-management.js`) — not a new query | A (Pepper secondary) + any OM Follow up |
| Unbilled time | Existing `_isBillableEntry` / invoice `timeEntryIds` patterns | B |
| Decisions + Follow-Ups stalls + client activity | `clientDecisions` + `fuDetectStalls` (or export) + richer activity | Status / Draft follow-up (Bugletrail P0 grounding — Cursor section above) |

Cloud Function stays dumb: accept digests + action.

**Naming note:** Fable v1.1 **E** = bug report via Pepper; **F** = bill PDF pre-fill. Cursor’s Bugletrail “see decisions/follow-ups” grounding is part of **D digests**, not Fable’s E.

---

## Suggested plan order (**authoritative: Fable v1.1**)

1. **D + B** — unbilled time (project-only).  
2. **D + A** — OM/PO **Follow up** buttons first; Pepper vendor preset second.  
3. **E** (Fable) — Pepper → Bugs & Requests via `fbQuickSubmit` (can slot earlier).  
4. **F** (Fable) — vendor bill upload → pre-fill Receive Final Bill (human Save).  
5. Hold **C** (Pepper writes bills) unless Cindy reopens.  
6. Still required for chat quality: decisions/Follow-Ups digests (Bugletrail) inside D.

---

## Already shipped (do not re-plan as new work)

| Item | Staging |
|------|---------|
| Pepper staff panel + `cchPepper` function | Yes (~Jul 26) |
| Clear chat on project change + Clear button | **v9.9.2** / `20260726b` |
| Panel/Tabs race / instant toggle work | In flight / verify separately (`cch-project-subpanel` sp10–sp11) |

---

## Verify / acceptance sketch (after build)

**E:** Bugletrail staging → Pepper “What needs attention” names open powder decision(s) + Follow-Ups stalls (invoices / no-proposal rooms) without paste.  
**A:** Project with open PO → Pepper “vendor status” → draft → Open email → vendor To + orders@ Cc.  
**B:** Unbilled project hours listed; already-invoiced omitted; no invoice created.  
**Guards:** No Pepper on `#/clientview/…`; separate Cindy/Vanessa session chats.

---

## Still open (everything else locked in v1.1)

1. **GO to build D digests for Bugletrail** (decisions + Follow-Ups into Pepper chat) now on staging?  
2. **F entry:** bill upload on PO page, Pepper action, or both?  
3. **F confidence:** blank field if uncertain (Fable recommends yes)?  
4. Rates in unbilled-time summary — confirm once for B.
