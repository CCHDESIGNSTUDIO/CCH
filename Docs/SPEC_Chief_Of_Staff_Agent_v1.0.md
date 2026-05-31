# SPEC — Chief of Staff Agent (CCH Studio v1.0)

**Version:** 1.0
**Status:** Spec for staging implementation
**Author:** Claude (drafted from Cynthia's requirements, May 27, 2026)
**Last revised by:** Claude — May 27, 2026 (initial draft)
**Implementer:** Cursor (next session)
**Target environment:** Staging first (`cch-studio-staging`). Production after Cynthia signs off.

## Revision Log
| Date | Change | Revised By |
|---|---|---|
| May 27, 2026 | Initial spec — vision, authority model, schema, watchers, surfaces, actions, LLM integration, implementation order. | Claude |

---

## 1. Vision — the dream Chief of Staff

> *"A project expediter / design assistant AI: who's on top of everything."* — Cynthia, May 27, 2026

The Chief of Staff Agent (COS) is the layer that turns CCH Studio from a record-keeping system into a **system that takes care of you**. It watches the data continuously, knows the state of every project and every vendor and every invoice, and surfaces what needs attention before Cynthia or Vanessa has to ask.

**North star: when Cynthia asks, the COS always says "yes — done" or "yes — here, click to apply."** It never leaves her hanging on "I'll check," never says "I don't know," never makes her chase down information that already exists in the system.

### What "always yes — done" actually means

| Cynthia asks... | COS responds with... |
|---|---|
| *"What's the status of PO-12345?"* | Real status + relevant context ("Ordered Mar 4, ETA passed 5 days ago, want me to draft a vendor nudge?") |
| *"Did Vanessa log her time yesterday?"* | "Yes — 6.5 hours across 3 projects" OR "No — 4.5 hr of captures, want me to draft from Smart Time?" |
| *"Has Cloud paid IN-12980?"* | "Yes — cleared via QB ACH on Mar 18, $195,041.99" |
| *"What did we work on this week?"* | Summary across session logs + Smart Time + git commits |
| *"Send Holtz Hill a reminder on IN-X"* | "Done — email drafted with project context, sending in 30s unless you cancel" |
| *"Run the Maverick production cleanup"* | "Dry-run already prepared — typed GO?" |

The COS never fails the "yes" by being unprepared. If it can't do something unilaterally, it has the option fully ready for one-click approval.

---

## 2. Authority Model

Three levels of action, governed by CLAUDE.md AI Session Rule #7 (typed GO for production writes):

### A. Unilateral — COS does without asking
Low-risk, read-only or clearly safe-write operations:
- Read any Firestore data
- Generate the daily briefing
- Compose attention items
- Draft (but not send) emails
- Generate xlsx reports
- Mark internal Firestore flags (`_seenByCindy`, `_briefingFor`, etc.) under `agentMemory/`
- Write to `boards/{}/attentionItems/{}` and `agentMemory/{}` collections
- Read session logs, priorities, history files

### B. Auto-Approved — COS does with logged note, low-risk staff actions
Things Cindy has pre-approved by configuration:
- Send the daily briefing email
- Send a vendor expediter draft IF saved as a draft in Gmail (not actually sent without explicit user "send" click)
- Update `attentionItems` status to `dismissed` when user clicks dismiss
- Snooze attention items up to 7 days

### C. Typed-GO Required — COS prepares, never executes
High-risk or finance-affecting actions:
- Any write to production invoices, POs, payments, products
- Any deletion
- Any push to QuickBooks
- Any email send to a client (vs draft-only)
- Any code deploy
- Any change to docs marked canon-tier (CLAUDE.md, CLEANUP_HISTORY.md)

For typed-GO actions, COS prepares the action fully (script, manifest, dry-run output) and surfaces it as "Ready — type GO to apply." The action waits until typed approval. **Never bypasses Rule #7.**

---

## 3. Firestore schema

### 3.1 `attentionItems` — the queue

`boards/{boardId}/attentionItems/{auto}` for project-scoped items
`agentMemory/global/attentionItems/{auto}` for firm-wide items

```js
{
  type: 'stale_po' | 'unpaid_invoice' | 'untimed_day' | 'variance_pending' |
        'po_eta_passed' | 'qb_clearance' | 'project_burn_warning' |
        'client_silence' | 'doc_stale' | 'maverick_payment_needed' | ...,
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info',
  scope: 'project' | 'firm' | 'personal',
  projectId: string | null,                      // null for firm-wide
  doc: { kind: 'po'|'invoice'|'proposal'|'task'|'doc', id: string, ref: string } | null,
  title: string,                                 // short headline shown in UI
  description: string,                            // 1-2 sentence why this matters
  suggestedActions: [                             // 0-3 one-click actions
    {
      label: string,                              // "Send reminder"
      kind: 'draft_email' | 'run_script' | 'mark_resolved' | 'snooze' | 'open_doc',
      payload: object,                            // action-specific data
      authority: 'unilateral' | 'auto_approved' | 'typed_go',
    }
  ],
  status: 'open' | 'snoozed' | 'dismissed' | 'resolved' | 'expired',
  snoozedUntil: ISOString | null,
  createdAt: ISOString,
  updatedAt: ISOString,
  resolvedAt: ISOString | null,
  resolvedBy: 'cindy' | 'vanessa' | 'agent' | null,
  resolvedNote: string | null,
  generatedBy: 'cos-agent',
  agentRunId: string,                             // links to the briefing run
  _data: { ... type-specific payload for re-rendering ... },
}
```

### 3.2 `dailyBriefings` — the morning summary

`agentMemory/global/dailyBriefings/{YYYY-MM-DD}/{userKey}`

```js
{
  date: '2026-05-27',
  userKey: 'cindy' | 'vanessa',
  generatedAt: ISOString,
  generatedBy: 'cos-agent',
  llmModel: 'claude-opus-4.6' | 'claude-sonnet-4.6' | ...,
  // Human-readable narrative — drafted by LLM from raw signals
  narrative: 'string (3-5 paragraphs, conversational)',
  // Structured surface — used by UI cards
  sections: [
    {
      kind: 'urgent_typed_go' | 'stale_work' | 'progress' | 'tomorrow' | ...,
      title: string,
      items: [ /* attentionItem refs */ ],
    }
  ],
  readBy: [ 'cindy' ],
  readAt: ISOString | null,
}
```

### 3.3 `agentMemory` — what the agent remembers across runs

`agentMemory/global/...` for firm-wide
`agentMemory/{userKey}/...` for per-user (Cindy / Vanessa)

```js
{
  // What attention items it has surfaced and when
  history: {
    [attentionItemKey]: { surfacedAt, dismissedAt?, lastNagged? }
  },
  // Patterns it has learned
  patterns: {
    vendorAvgETA: { vendorName: days },
    invoiceTypicalPaymentLag: { clientName: days },
    untimedDayThreshold: hours,
  },
  // User preferences (configurable)
  preferences: {
    morningBriefingTime: '07:00 PT',
    emailBriefing: true,
    nagFrequency: 'daily' | 'weekly',
    snoozeDefaultHours: 24,
    autoApprovedActions: [ 'send_briefing_email' ],
  },
}
```

### 3.4 `agentRuns` — audit trail of each agent run

`agentMemory/global/agentRuns/{auto}`

```js
{
  runId: string,
  startedAt: ISOString,
  endedAt: ISOString,
  trigger: 'scheduled' | 'on_write' | 'on_demand' | 'user_query',
  watchersRun: ['stalePOWatcher', 'unpaidInvoiceWatcher', ...],
  itemsCreated: number,
  itemsResolved: number,
  briefingsGenerated: number,
  llmCallsMade: number,
  llmTokensUsed: number,
  errors: [ ... ],
}
```

---

## 4. Watchers — what generates attention items

Each watcher is a small function that runs on schedule OR on Firestore write triggers. Each produces 0–N attention items.

### Scheduled watchers (Cloud Scheduler, daily 7am PT or hourly)

| Watcher | What it does | Frequency |
|---|---|---|
| `staleP​OWatcher` | POs in 'sent' or 'ordered' state for > N days with no bill received → flag | Daily |
| `unpaidInvoiceWatcher` | Invoices >30 days unpaid → flag with "send reminder" action | Daily |
| `poETAPassedWatcher` | POs where `estimatedShipDate` < today AND `bill.received = false` → flag with "nudge vendor" draft email | Daily |
| `untimedDayWatcher` | Days with Smart Time captures but no logged time → flag with "draft timesheet" action | Daily morning |
| `variancePendingWatcher` | PO variance unresolved > N days → flag | Daily |
| `projectBurnWatcher` | Projects where fee burn >75% but milestones <50% complete → flag (red) | Weekly |
| `clientSilenceWatcher` | Active projects with no client correspondence > 14 days → flag with "draft check-in" | Weekly |
| `qbStaleSyncWatcher` | Docs marked "pushed to QB" but no QB confirmation in 48 hrs → flag | Daily |
| `priorityStaleWatcher` | Items on CURRENT_PRIORITIES.md HIGH list with no session-log mention > 7 days → flag | Weekly |
| `backupWatcher` | Firebase Storage last backup > 7 days → flag for re-run | Weekly |

### Triggered watchers (Firestore onWrite)

| Trigger | Watcher | What it does |
|---|---|---|
| `boards/*/invoices/*` write | `invoicePaymentWatcher` | If status flipped to Paid, generate `qb_clearance_pending` if not auto-cleared |
| `boards/*/purchaseOrders/*` write | `poVarianceWatcher` | If `bill.received = true` and `variance.amount` set, generate `variance_pending` |
| `qbWebhook` Cloud Function | `qbMatchWatcher` | On bill-to-transaction match, generate `qb_clearance` with BIG notification trigger |
| `boards/*/notifications/{}` write | (just routes to UI) | (no new attention item) |

---

## 5. Surfaces — where Cynthia sees the COS

### 5.1 Daily Briefing Modal (morning login)

When Cindy or Vanessa logs in on a new day, a modal appears with the daily briefing. Dismissable. Re-openable from dashboard.

Layout:
```
GOOD MORNING, CINDY
Tuesday, May 27, 2026 · 7:14 AM

⚡ Need typed GO from you (1)
  • Maverick production cleanup — 38 ops queued, dry-run clean
    [ Type GO ] [ Review dry-run ] [ Snooze ]

🚨 Stale priorities (3)
  • Replace Image button (14 days open, May 13 revert)
    [ Open Cursor ] [ Snooze 7d ]
  • Houzz ID display in modal (14 days open)
    [ Open Cursor ] [ Snooze 7d ]
  • Design Board drag-and-drop (7 days open)
    [ Open Cursor ] [ Snooze 7d ]

📊 Yesterday's wins (6)
  ... brief list ...

🎯 Today's focus (3 suggestions)
  ... 3 highest-value tasks based on age × severity ...

✉️ Drafts ready to send (2)
  • Reminder to Holtz Hill on IN-24-10119 (overdue 31 days)
    [ Review & send ] [ Skip ]

[ Got it ]
```

The narrative paragraph at top is LLM-drafted; the structured cards are deterministic.

### 5.2 Dashboard widget — "What needs my attention"

Persistent on main dashboard. Shows count + 3 most-severe items.

```
WHAT NEEDS YOUR ATTENTION              7 open
─────────────────────────────────────
⚡ 1 needs GO
🚨 3 stale priorities
💰 2 unpaid invoices > 30d
✉️ 1 vendor nudge draft ready

                              [ See all → ]
```

### 5.3 Inline nudges on doc detail pages

When opening a PO/invoice with an attention item, a yellow callout appears at top:

```
⚠️ COS notes: This PO was sent 14 days ago but no bill received yet.
   ETA was 5 days ago.
   [ Draft vendor nudge ] [ Mark on-track ] [ Snooze ]
```

### 5.4 End-of-day digest (email, optional)

If `preferences.emailBriefing = true`, a 5pm PT email summarizing:
- What got done today (from session logs + Smart Time)
- What's still open for tomorrow
- Anything urgent for first-thing-tomorrow

### 5.5 Chat interface (Phase 2 — out of scope for v1.0)

A `/cos` slash command or chat widget where Cindy can ask anything ("What's Parker status?"). Out of scope for v1.0 — gets implemented if the briefing-and-nudge layer proves useful.

---

## 6. Actions — what one-click does

Every attention item carries 0-3 `suggestedActions`. The UI renders them as buttons.

| Action kind | What happens on click |
|---|---|
| `draft_email` | LLM drafts the email body using attention item context + project history. Opens Gmail compose with subject + body pre-filled (via MCP Gmail connector). User reviews + sends. |
| `run_script` | Executes a prepared Cloud Function or `_debug` script with the parameters in the attention item. For typed-GO scripts, opens the script with `--dry-run` first; on GO, runs with `--apply`. |
| `mark_resolved` | Updates the attention item to status='resolved'. Optionally captures a note. |
| `snooze` | Sets `snoozedUntil = now + 24h` (or configurable). Item disappears from active queue. |
| `open_doc` | Opens the linked Firestore doc in Studio (deep-link to the PO/invoice/proposal). |
| `acknowledge` | Marks as seen but not resolved. Useful for BIG notifications. |

---

## 7. LLM integration — Anthropic API

The agent uses Claude (Anthropic API) for two purposes:

### 7.1 Briefing narrative composition

Daily briefing modal opens with a 3-5 paragraph "Good morning Cindy" prose. The LLM takes:
- Raw attention items (deterministic data)
- Yesterday's session logs
- Smart Time captures
- Project burn data

And produces a friendly, prioritized narrative. **Always says "yes" or "here's what we did" — never says "I think" or "maybe."**

System prompt sketch:
> *You are Cindy's Chief of Staff. She runs CCH Design Inc., a luxury interior design firm. You watch CCH Studio (her platform) all day. Every morning you give her a short, conversational briefing. Be specific. Use names and amounts. If something is stale, say so. If something is ready for her approval, say so explicitly. Never speculate — only report. Tone: confident, warm, never hedging.*

### 7.2 Email draft generation

When `draft_email` action fires, LLM drafts an email body using:
- Recipient context (vendor or client name, history)
- Doc context (PO/invoice number, amount, dates)
- Reason for email (overdue, status check, etc.)
- Cindy's voice (samples from existing communications collection)

Drafts are saved as Gmail drafts via MCP — never sent without explicit user click.

### 7.3 LLM call budget

- 1 briefing/day/user × 2 users = 2 briefings/day
- ~20 email drafts/week
- Misc: 5 ad-hoc summarizations/day

Estimated cost: ~$5-15/month on Anthropic API. Logged in `agentRuns.llmTokensUsed`.

---

## 8. Implementation order (for Cursor)

### Phase 1 — Foundation (1-2 sessions)

1. **Firestore schema** — create `agentMemory` root collection structure. Permissions: admin SDK only.
2. **Attention item type definitions** — TypeScript types or JSDoc in `cch-deploy/Functions/cos-agent/types.js`.
3. **Manual attention item creation UI** (test only) — a debug page where you can manually create an attention item to test the UI surfaces.

### Phase 2 — First watcher + first surface (1 session)

4. **`unpaidInvoiceWatcher`** as the first concrete watcher. Cloud Scheduler daily.
5. **Dashboard widget** showing open attention item count + top 3.
6. **`mark_resolved`** + **`snooze`** action handlers.
7. Run end-to-end on staging: watcher creates items → widget shows them → click resolve → item disappears.

### Phase 3 — Daily Briefing (1 session)

8. **`generateDailyBriefing()` Cloud Function** — runs at 7am PT, reads all attention items, calls Anthropic API for narrative, writes to `dailyBriefings/`.
9. **Briefing modal** — appears on first login each day. Reads from `dailyBriefings/`.
10. **`acknowledge` action** for briefing items.

### Phase 4 — More watchers (1-2 sessions)

11. `stalePOWatcher`
12. `untimedDayWatcher`
13. `priorityStaleWatcher` (the one we just ran manually)
14. `qbStaleSyncWatcher`

### Phase 5 — Email drafts (1 session)

15. **Gmail MCP integration** for `draft_email` action.
16. LLM email-draft template per attention type.
17. Test: vendor nudge for PO with passed ETA → draft appears in Gmail.

### Phase 6 — Polish + production (1 session)

18. **Inline nudges** on PO/invoice detail pages.
19. **End-of-day digest** email (optional).
20. **Staging acceptance test** with Cindy.
21. Production deploy after sign-off.

**Total estimate:** 6-8 Cursor sessions to v1.0 production. Phase 1 + 2 + 3 alone (~3-4 sessions) gets you the morning briefing — the highest-value piece.

---

## 9. Acceptance criteria (staging v1.0)

Done when, on staging:

- [ ] Cloud Scheduler runs `cosAgentDaily()` at 7am PT every day
- [ ] All 10 scheduled watchers from §4 run and produce attention items
- [ ] Cindy's daily briefing email arrives by 7:15 AM PT
- [ ] Dashboard widget shows live attention count
- [ ] Briefing modal appears on first login of the day, dismissable
- [ ] Clicking `mark_resolved` removes the item from active queue
- [ ] Clicking `snooze` re-surfaces it after 24 hrs
- [ ] Drafted vendor nudge email lands in Gmail Drafts folder (not sent)
- [ ] One typed-GO item (e.g., "run Maverick production cleanup") flows correctly through the prepare-then-approve gate
- [ ] All actions logged in `agentRuns/`
- [ ] No infinite loops, no runaway LLM token usage
- [ ] Anthropic API key stored in Firebase Functions config, not committed

---

## 10. Edge cases

| Case | Handling |
|---|---|
| Agent run fails halfway | Mark `agentRuns.errors[]`, retry next scheduled run. Items partially written remain valid. |
| Cindy snoozes the same item 5 times | After 3 snoozes, escalate — item gets priority `critical` + flagged in briefing as "you've snoozed this 3 times" |
| Same attention item recreated by watcher each day | Watcher uses upsert keyed by `(type, doc.id)` — never duplicates. Updates `updatedAt` instead. |
| Cindy resolves item but watcher re-creates next day (e.g., invoice still unpaid) | Watcher honors `agentMemory.history[key].resolvedAt` cooldown — won't recreate for 7 days post-resolution. |
| LLM API down for daily briefing | Fall back to structured-only briefing (no narrative). Briefing card shows "Narrative unavailable — see structured items below." |
| User deletes a PO that has an attention item | onDelete trigger marks item as `expired`. |
| Cindy queries while agent run is mid-execution | Read returns latest committed state. Don't block. |
| Two users (Cindy + Vanessa) seeing the same firm-wide item | `readBy` array tracks who's seen. Either can resolve. |

---

## 11. Out of scope (v1.0)

These are NOT in this spec. Track separately if/when requested:

- Chat/conversational interface ("`/cos what's parker status?`")
- Voice input
- Predictive ML (e.g., predict vendor delays from history)
- Auto-sent client emails (always drafts, never sends without click in v1.0)
- Mobile push notifications
- Slack integration (we have Gmail MCP; Slack is later)
- Agent learning from user feedback (Phase 2)
- Multi-agent coordination (one COS in v1.0)
- Cross-project pattern detection beyond what watchers explicitly check

---

## 12. Related docs

- `CLAUDE.md` AI Session Rules 1-11 — especially Rule #7 (typed GO) and Rule #11 (doc hygiene)
- `CURRENT_PRIORITIES.md` — the source of "what's on the list" for `priorityStaleWatcher`
- `CLEANUP_HISTORY.md` — the source of "what's been done" patterns
- `SPEC_PO_Bill_Variance_Workflow_v1.0.md` — the discrepancy queue feeds attention items
- `Studio MEMORY/Session Logs/` — read by `priorityStaleWatcher` to cross-check
- `Functions/index.js` — existing `qbWebhook` is a model for new triggered watchers

---

## 13. Why this will actually work

CCH Studio already has everything the COS needs:
- Project data → boards, invoices, POs, proposals
- Time data → Smart Time captures + timesheet
- Comms history → communications collection
- QB events → `qbWebhook` Cloud Function
- Activity feed → `activity` collection
- Vendor data → vendors collection
- Session logs → `cch-deploy/Docs/SESSION_LOG_*.md`

What's missing is **the layer that ties them together and proactively surfaces patterns**. That's all the COS is. It doesn't need new data; it needs new attention to existing data.

The first watcher (`unpaidInvoiceWatcher`) and the first surface (dashboard widget) together would already show their value within a week. From there it's accretion.

---

*End of spec v1.0.*
