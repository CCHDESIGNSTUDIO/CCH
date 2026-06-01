# SPEC — CFO Agent (CCH Studio v1.0)

**Version:** 1.0
**Status:** Spec for staging implementation
**Author:** Claude (drafted from Cynthia's requirements, May 27, 2026)
**Last revised by:** Claude — May 27, 2026 (initial draft)
**Implementer:** Cursor (next session)
**Target environment:** Staging first (`cch-studio-staging`). Production after Cynthia signs off.
**Parent spec:** `SPEC_Chief_Of_Staff_Agent_v1.0.md` — CFO Agent is a specialization of the COS pattern.

## Revision Log
| Date | Change | Revised By |
|---|---|---|
| May 27, 2026 | Initial spec — financial watchers, P&L briefing, cash-flow forecast, AR/AP surveillance, QB reconciliation. | Claude |

---

## 1. Vision — the CFO who tells you the number before you ask

> *"Then we need to get back to our CFO — and have him look at Studio and QB Data."* — Cynthia, May 27, 2026

The CFO Agent is the financial-intelligence layer for CCH Studio. Where the Chief of Staff Agent watches operational flow, the CFO Agent watches **money** — cash position, AR aging, AP balances, profit margins, QB reconciliation, project burn.

**North star: the CFO never makes Cindy wait for a financial answer.** Cash position at 7am. P&L draft at month-end. Vendor balance before she places the next PO. Project margin before she quotes the next change order.

### What "tells you the number before you ask" looks like

| Cynthia asks... | CFO responds with... |
|---|---|
| *"What's my cash position?"* | "Bank operating account $X, AR $Y aging (X% over 30 days), AP $Z, net working capital $N. 12-week forecast says $M floor in week 6." |
| *"How's Holtz Hill doing on margin?"* | "Fee $25K, captured 78%, $19.5K consumed, $5.5K runway. Hours pace says you'll hit fee 11 days before milestone B. Want me to flag the client?" |
| *"Who owes us money?"* | "$114K AR. Over-30: Bradbury $32K, Holtz Hill $24K, Cloud $11K. Drafts ready for all 3." |
| *"Did QB sync today?"* | "Yes — last successful sync 6:42 AM, 47 docs verified, 0 drift detected. 12-month reconciliation is clean within $14." |
| *"Run my month-end P&L."* | "Done — May 2026 P&L: Revenue $X, COGS $Y, OpEx $Z, Net $N. Drafted to your Drive folder. Reviewed vendor variances ($1,247 absorbed YTD). Ready to lock?" |

### The CFO's voice (uses `cch-finance-procurement` + `cch-intelligence-analytics` skills)

- Always leads with the number.
- Backs every number with the source doc.
- Flags risk (over-budget, AR slipping, vendor terms missed) without dramatization.
- Never recommends action without showing the data behind it.
- Tax-aware: design services not taxed (per May 19 audit), product retail taxed at site rate, freight not taxed.

---

## 2. Authority model (inherits from COS spec §2)

| Authority | CFO-specific examples |
|---|---|
| **Unilateral** | Read all financial data. Compute P&L, cash forecast, AR aging. Write attention items. Compose monthly P&L draft to Drive (draft only — not sent). |
| **Auto-Approved** | Flag QB sync drift > $50 in dashboard. Draft AR reminder emails (saved to Gmail drafts). Mark variance classifications based on default taxonomy. Generate weekly cash-flow forecast. |
| **Typed-GO** | Push anything to QB. Send any AR reminder to a client. Apply any financial Firestore write to production. Lock a P&L period. Modify variance classification rules. |

Per CLAUDE.md AI Session Rule #7 — no production writes without typed GO.

---

## 3. Firestore schema (extends COS spec §3)

### 3.1 `attentionItems` — adds CFO-specific types

```js
{
  type:
    'ar_aging_critical' |        // invoice > 60 days unpaid
    'ar_aging_warning' |         // invoice 30-60 days
    'ap_terms_breach' |          // vendor net-30 hit day 28
    'project_margin_low' |       // fee burn > N% with milestone % behind
    'cash_runway_warning' |      // forecast hits below threshold within 4 weeks
    'qb_sync_drift' |            // Studio vs QB total diverges
    'qb_sync_stale' |            // QB sync > 48 hrs old
    'variance_unresolved_critical' |
    'tax_anomaly' |              // suspicious tax line on invoice
    'expense_ratio_warning' |    // OpEx ratio > target
    'month_end_pending' |        // P&L draft ready for review
    'reconciliation_diff' |      // reconciliation difference between Studio + QB
    ...
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info',
  // ... base fields per COS spec ...
  cfoData: {
    amount: number,
    asOf: ISOString,
    relatedDoc: { kind, ref, id },
    relatedProject: string | null,
    relatedClient: string | null,
    relatedVendor: string | null,
  }
}
```

### 3.2 `financialSnapshots` — daily snapshots of state

`agentMemory/cfo/financialSnapshots/{YYYY-MM-DD}`

```js
{
  date: '2026-05-27',
  generatedAt: ISOString,
  cashPosition: {
    operating: number,         // pulled from QB or manual input
    reserves: number,
    estimated: boolean,        // true if QB sync stale
  },
  ar: {
    total: number,
    aging: { current: number, '30-60': number, '60-90': number, '90+': number },
    byClient: [{ clientName, total, oldest_days }],
  },
  ap: {
    total: number,
    aging: { current: number, '30-60': number, '60+': number },
    byVendor: [{ vendorName, total, oldest_days }],
  },
  ytd: {
    revenue: number,
    cogs: number,
    opex: number,
    net: number,
    margin: number,
  },
  projectMargins: [
    { projectId, projectName, fee, captured, milestonePercent, marginPercent, status }
  ],
  qbHealth: {
    lastSyncAt: ISOString,
    lastSuccessfulSyncAt: ISOString,
    pendingDocs: number,
    driftDollar: number,
    driftCount: number,
  },
  generatedBy: 'cfo-agent',
}
```

### 3.3 `monthlyPLDrafts` — locked monthly snapshots

`agentMemory/cfo/monthlyPL/{YYYY-MM}`

```js
{
  period: '2026-05',
  status: 'draft' | 'locked',
  generatedAt, lockedAt: ISOString | null,
  lockedBy: 'cindy' | null,
  pl: {
    revenue: { byClient, byProject, total },
    cogs: { byVendor, byCategory, total },
    opex: { byCategory, total },
    net: number,
    variance: { absorbed, billedToClient, refundedToClient },
  },
  notes: string,
  driveLink: string,           // link to the PDF generated to Cynthia's Drive
}
```

---

## 4. Watchers (extends COS spec §4)

### CFO scheduled watchers (daily 7am PT unless noted)

| Watcher | What it does |
|---|---|
| `arAgingWatcher` | Walks all invoices, computes aging buckets, generates `ar_aging_*` items for invoices > 30 days |
| `apAgingWatcher` | Walks all bills/POs, computes aging, generates `ap_terms_breach` for vendors near term |
| `cashRunwayWatcher` | Reads `financialSnapshots`, projects 12-week cash flow, flags if floor < threshold |
| `projectMarginWatcher` | For each active project: compares fee % consumed vs milestone %. Flags when consumed > milestone + 20% |
| `qbSyncDriftWatcher` | Compares Studio invoice totals vs QB invoice totals. Flags drift > $50 per doc OR > $500 firm-wide |
| `qbSyncStalenessWatcher` | Last QB sync timestamp > 48 hrs → flag |
| `varianceQueueWatcher` | Reads PO variance queue. Flags critical: variance > $500 unresolved > 14 days |
| `taxAnomalyWatcher` | Scans invoices for `expenseType` missing on tax-exempt lines, or service lines marked taxable |
| `monthEndWatcher` | First business day of new month → generates `month_end_pending` for prior month's P&L |
| `dailySnapshotWriter` | Writes the day's `financialSnapshot` for trend tracking |
| `reconciliationWatcher` | Weekly — runs a 12-month Studio/QB reconciliation pass |

### Triggered watchers (Firestore onWrite)

| Trigger | Watcher |
|---|---|
| Invoice status → 'Sent' | `arWatcherImmediate` — adds to AR aging queue |
| Invoice paid | `paymentRecognitionWatcher` — books revenue, updates AR |
| PO bill received | `apWatcherImmediate` — adds to AP queue |
| qbWebhook fires | `qbReconciliationWatcher` — diff against Studio, flag if drift |

---

## 5. Surfaces

### 5.1 CFO Dashboard widget (top-right of main dashboard)

```
FINANCIAL SNAPSHOT                    5/27 7:14 AM
─────────────────────────────────────
Cash position:    $X (op) + $Y (reserves)
AR:               $114K  ⚠ $56K > 30 days
AP:               $13.8K   ✓ all current
This month:       Rev $X  Net $Y  Margin %Z
YTD:              Rev $X  Net $Y  Margin %Z

⚠ 5 financial items need attention
                              [ See all → ]
```

### 5.2 CFO Section in Daily Briefing Modal

Inside the COS Agent's morning briefing, a CFO-authored section:

```
💰 FINANCIAL MORNING REPORT

Cash position holding at $X — 14-week floor of $Y in week 6 (still
above your $50K reserve target).

AR aging worth your attention:
  • Bradbury $32K (oldest invoice 47 days)
  • Holtz Hill $24K (oldest 41 days)
  • Cloud $11K (oldest 33 days)
  Drafts in your Gmail Drafts folder.

Holtz Hill is 78% through fee with 45% milestones complete — 33 point
gap. Worth a check-in on scope creep.

Month-end P&L for May is ready — drafted to your Drive. 1 variance
flagged as Restoration Hardware overcharge on freight.
```

### 5.3 Per-project Financial Health card

On each project's Financials tab, a CFO-authored card:

```
FINANCIAL HEALTH — HOLTZ HILL                   ⚠ Warning

Fee:               $25,000        Captured:    78%  $19,500
Milestones:        45%             Gap:         -33 pts ⚠
Last invoice:      IN-24-10119    Paid:        $0  (overdue 31 days)

Margin trajectory: At current burn, fee will be exhausted 11 days
before Milestone B. Options:
   • Change order proposal (Cynthia approve)
   • Reduce scope on remaining milestones
   • Absorb (current margin reduces to 8%)
```

### 5.4 Monthly P&L modal (first business day of month)

Auto-opens when Cindy logs in on the first business day of a new month:

```
MAY 2026 — P&L READY FOR REVIEW

Revenue: $XX,XXX (Y projects)
  • Cloud - Rolling Hills    $XX
  • 7225 Bugletrail          $XX
  • ...

COGS: $XX,XXX
OpEx: $XX,XXX
Net: $XX,XXX  (margin Y%)

Variances captured:
  Absorbed:           $1,247 (12 POs)
  Billed to client:   $3,891 (8 POs)
  Refunded:           $0

[ Review draft ] [ Lock period ] [ Snooze ]
```

### 5.5 End-of-month digest email

Sent at 9am PT first business day of new month. Includes the P&L summary + a 1-page PDF generated to Drive.

---

## 6. LLM integration (extends COS spec §7)

### CFO-specific LLM tasks

1. **Monthly P&L narrative** — "May was strong — Cloud Rolling Hills contributed $X in revenue. Variances ran 0.8% of COGS, below target. AR aging extended by 6 days vs Apr, driven by Bradbury…"
2. **AR reminder drafting** — invoice-specific reminder emails with appropriate tone (first, second, escalation).
3. **Cash flow narrative** — turning the 12-week forecast into prose Cindy can read while drinking coffee.
4. **Variance classification suggestions** — given a new variance, suggest the resolution (shipping → billable, restocking → absorbed) based on history.
5. **Tax anomaly explanation** — when `taxAnomalyWatcher` fires, draft a 1-paragraph "here's what looks wrong and why."

System prompt sketch:
> *You are Cindy's CFO. She runs CCH Design Inc., a 20-year luxury interior design firm with active projects, vendor POs, and client invoices. You watch the books continuously. Be specific — every number gets a source. Never recommend action without showing the data. Tone: confident, calm, no drama. Use the `cch-finance-procurement` skill conventions for terminology.*

---

## 7. Skill integration

The CFO Agent USES (does not replace) the following pre-existing Anthropic skills:

| Skill | Used for |
|---|---|
| `cch-finance-procurement` | Primary — all invoice/PO/bill/QB business logic, tax rules, payment flow conventions |
| `cch-intelligence-analytics` | Smart Time correlation with project margin, profit tracker logic |
| `cch-studio-platform` | Always-loaded — base platform rules |

Invocation pattern:
1. CFO Agent receives a trigger (scheduled or onWrite)
2. Agent loads the relevant skill via the Skill tool
3. Agent applies the skill's conventions/logic to the data
4. Agent writes attention items / snapshots / briefings

This means the skills FINALLY get used routinely instead of sitting dormant.

---

## 8. Implementation order (for Cursor)

### Phase 1 — Schema + first watcher (1 session)

1. Extend COS Agent's Firestore schema with CFO attention-item types
2. Build `arAgingWatcher` — the highest-value single watcher
3. Add CFO Dashboard widget showing AR aging
4. Run end-to-end on staging: invoices over 30 days → widget shows count → click → list

### Phase 2 — Daily snapshot + cash position (1 session)

5. `dailySnapshotWriter` (writes `financialSnapshots`)
6. Cash position card on dashboard
7. AP aging watcher

### Phase 3 — Project margin + QB drift (1 session)

8. `projectMarginWatcher`
9. `qbSyncDriftWatcher`
10. Per-project Financial Health card

### Phase 4 — Monthly P&L (1-2 sessions)

11. `monthEndWatcher`
12. Monthly P&L modal
13. PDF generation to Drive (via Drive MCP)
14. Lock-period flow with typed-GO

### Phase 5 — AR reminders + variance classification (1 session)

15. LLM AR reminder drafts (via Gmail MCP)
16. Variance classification suggestions
17. Tax anomaly watcher

### Phase 6 — Polish + production (1 session)

18. CFO section integration into COS daily briefing
19. End-of-month digest email
20. Production deploy after staging acceptance

**Total estimate:** 6-8 Cursor sessions to v1.0 production. Phases 1+2 alone (~2 sessions) deliver the AR aging + cash position visibility — likely the highest immediate value.

---

## 9. Acceptance criteria (staging v1.0)

- [ ] AR aging widget shows live counts within $5 of QB reality
- [ ] AP aging widget similarly accurate
- [ ] Daily `financialSnapshot` written by 7:15 AM PT
- [ ] Project margin warnings fire correctly on test project (fee 80% + milestone 50%)
- [ ] QB sync drift watcher detects $100 drift within 1 hour
- [ ] Monthly P&L modal renders correctly on June 1, 2026 (first real test)
- [ ] AR reminder email drafts land in Gmail Drafts folder, not sent
- [ ] Variance classification suggestions match human override at least 80% of the time
- [ ] No production writes without typed GO
- [ ] All operations logged in `agentRuns` with `agentRole: 'cfo'`

---

## 10. Edge cases (CFO-specific)

| Case | Handling |
|---|---|
| QB sync down for 24+ hrs | `cashPosition.estimated: true`. Briefing flags: "QB sync stale — numbers based on Studio only." |
| Manual cash injection (loan, transfer) | Cindy enters via a "Cash adjustment" form. CFO Agent reconciles to next QB sync. |
| Project completed but invoice not yet final | Margin calc uses captured-but-not-billed. Briefing notes the unbilled WIP. |
| Multi-month project with retainer applied at start | Revenue recognition per service delivery, not retainer receipt. Per May 19 tax audit rules. |
| Client requests payment plan | Stored on invoice. Aging watcher honors the plan dates instead of original due date. |
| Vendor credits / negative variances | Tracked as `refund_due_client` per variance taxonomy. CFO Agent flags for client refund processing. |

---

## 11. Out of scope (v1.0)

- Bank account integration (cash position is from QB or manual input)
- Multi-currency
- Forecasting beyond 12 weeks
- Tax preparation / 1099 generation
- Payroll
- Loan amortization tracking
- ELU Atelier separate books (covered in `elu-business` skill — future agent)
- Predictive ML on payment behavior (Phase 2)
- Automated invoice sending (always drafts in v1.0)

---

## 12. Related docs

- `SPEC_Chief_Of_Staff_Agent_v1.0.md` — parent architecture
- `SPEC_PO_Bill_Variance_Workflow_v1.0.md` — variance queue this agent monitors
- `CLAUDE.md` AI Session Rules — especially #3 (RESOLVE/APPLY for read-only intelligence), #7 (typed GO), #11 (doc hygiene)
- `CLEANUP_HISTORY.md` — tax taxonomy + variance classification reference
- `Functions/index.js` — existing `qbWebhook` and `syncInvoiceBalanceFromQB`

---

*End of CFO Agent v1.0 spec.*
