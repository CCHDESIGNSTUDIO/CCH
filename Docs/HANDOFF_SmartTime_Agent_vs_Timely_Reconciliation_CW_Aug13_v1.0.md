# HANDOFF → Claude · Smart Time: Timely vs Studio Agent + Reconciliation calendar · CW Aug 13, 2026

**For:** Claude (Cowork / C-Team) · **From:** Cursor session with Cindy · **Action:** Review spec, then implement on **staging only** (queue to #1 Deploy Master — do not commit/deploy solo unless you are #1).

**Share this doc as-is** into the CCH Studio project or a dedicated Smart Time chat.

---

## One-line goal

Make **Timely** vs **Studio desktop agent** vs **logged ledger** time **visually obvious** everywhere Vanessa and Cindy review hours — especially **Time Reconciliation → Month calendar** (Vanessa’s preferred view) and **Smart Time → Week** — without changing Timely sync or dropping the parallel-run backup strategy.

---

## Strategy Cindy locked (do not violate)

| Rule | Meaning |
|------|---------|
| **Parallel-run** | Timely (mobile/GPS) + desktop agent run together until agent is trusted |
| **Leave Timely alone** | Do **not** change `timelySyncEntries`, Timely API pull, or `timelyEntries` write path |
| **Reconciliation = audit UI** | Read-only comparison + assign/log flows already built (WO-022); this WO is **display only** + optional filters |
| **Agent is desk path** | Vanessa may have little/no agent time; Timely rows must stay visible and distinct |
| **AI summaries out of scope** | No “Day in Review” prose / narrative generation here (WO-111 / Pepper — blocked on freshness + §4.3) |

### Three sources (explicit)

| Source | Meaning |
|--------|---------|
| **Timely** | Mobile/GPS Timely captures + ledger rows with Timely `source` |
| **Agent** | Studio desktop agent captures + `desktop-agent*` ledger rows |
| **Logged** | Hours already on the Time Ledger (gold) — may themselves be Timely/Agent/Manual underneath |

### Coordination — do not queue blind

| Work | Order |
|------|--------|
| **WO-112** (this handoff) | Ship first — source-color Reconciliation + Week |
| **CURSOR_TimeAgentPage_MH_Aug12** | Not sent yet. When queued, **point at WO-112 first** — source badges may change what member/project sort must show |
| Narrative-summary brief | Still blocked; separate track |

---

## Current state (grounded Aug 13, 2026)

### Tabs (sidebar: Smart Time)

| Tab | Function | Source split today? |
|-----|----------|---------------------|
| **Smart Time** | Day / Grid / List / Week; captures + approve-to-ledger | Filter pills (Timely / Agent / Logged) on **activity** tab only |
| **Time Reconciliation** | “Where did the missing time go?” Week / 14-day table + **Month calendar** | **No** — shows **logged hours only** |
| **Time Ledger** | Billing list / weekly / monthly | `source` on rows exists but not surfaced in all views |
| **⏱ Timely Logged** | `timelyEntries` not yet in ledger | Timely-only by definition |

### Code touchpoints (`platform/index.html`)

| Area | Location (approx) | Notes |
|------|-------------------|--------|
| Source filter pills | `renderTimeTimelineView` ~57084–57088 | `window._tlSourceFilter`: `''` \| `timely` \| `agent` \| `logged` |
| Captures tagged at scan | `autoScanCaptures()` ~50836+ | `source: 'timely'` \| `'agent'` on `_pendingCaptures` |
| Reconciliation view | `renderReconciliationView()` ~52659+ | Builds `capturedMinutes` + `unloggedBuckets` per day from `_dayBuckets` but **does not render them** |
| Month calendar | `_buildReconCalendar()` ~52979+ | Cell = gold logged hours + status dot; **no captured split** |
| Week view (activity) | `_tlViewMode === 'week'` ~57101+ | Lumps all captures into one “Xh captured”; groups apps, not source |
| Ledger `source` values | saves ~60286, ~60344, Timely ~16787 | `timely`, `desktop-agent`, `desktop-agent-v3`, `ai-reconstruction`, etc. |

### Related prior work

- **WO-022** (Jul 12): Reconciliation assign queue; untagged Timely no longer dropped — `loop/WO-022_DONE_CR_Jul12.md`
- **WO-111** (Aug 9): Day-in-review timeline artifact — separate; prose summaries not in scope here
- **UI glyph fix** (Aug 13): Corrupted `?` placeholders → `CCH_UI` `\u` escapes — build **9.9.159**, queued staging (`_DEPLOY_QUEUE.md`)

---

## Locked visual language (use everywhere)

| Source | Color | Icon | Label |
|--------|-------|------|-------|
| **Timely** | Green `#4CAF50` | ⏱ (or `\u23F1`) | Timely |
| **Studio Agent** | Cyan `#00BCD4` | 🖥 (or desk glyph) | Agent |
| **Logged (ledger)** | Gold `#C4A464` | ✓ `\u2713` | Logged |

**Legend** must appear fixed under Reconciliation Month calendar and Smart Time Week grid (not hidden in a tooltip).

Use `window.CCH_UI` (top of `index.html` ~4252) for arrows/checks/diamonds — **never raw emoji in new code** (Windows re-encode → `?`).

---

## Phase A — Reconciliation Month calendar (Vanessa priority)

**Where:** Smart Time → **Time Reconciliation** → period **Month** → `_buildReconCalendar()`.

**Per day cell (weekday, not future):**

```
       12
  6.2h logged ✓
  ⏱ 1.1h captured
  🖥 0.8h captured
  [■■ green | ■ cyan | ■ gold]   ← optional stacked mini-bar
```

**Data rules:**

1. **Logged** — sum `timeEntries` for date (respect `_reconMemberFilter`); split subtotals by normalized `source`:
   - Timely: `source` contains `timely`
   - Agent: `source` contains `agent` or `desktop-agent`
   - Other/manual: everything else (muted label “Manual”)
2. **Captured (not logged)** — from `_dayBuckets` / `_pendingCaptures` for date; split by item `source` (`timely` vs `agent`); **already computed** in `dayData.capturedMinutes` — wire it up + split by source
3. **Click cell** — keep opening Smart Time activity for that date; optionally preserve source filter if user had one set

**Alerts upgrade (same tab):**

Replace generic “no time logged” with source-aware copy when captures exist, e.g.:

> Tue Aug 5 — **2.1h Timely captured**, **0h logged**

---

## Phase B — Reconciliation Week / 14-day table

Add columns (or sub-rows on expand):

| Day | Logged | ⏱ Captured | 🖥 Captured | Status | Action |

Expand row line items: add **Source** badge column (read `te.source`).

---

## Phase C — Smart Time Week view

**Where:** Smart Time tab → **Week** toggle (~57101).

Mirror Phase A split per Mon–Fri column:

- Logged by project **with source badge** on each project row (if mixed sources that day, show both)
- **Two capture subtotals** (Timely / Agent), not one “captured” blob
- Top Apps: either split into two lists or prefix each app with source color dot

Reuse same legend as Reconciliation.

---

## Phase D — Day view project table (follow-on)

Cindy’s preferred daily review layout (not built yet):

```
Grouped by PROJECT
  Time | Activity | Notes
  (day total per project)
```

Each row carries Source badge. Memories drag target unchanged. **Do after A–C** unless Cindy re-prioritizes.

---

## Out of scope (explicit)

- Timely Cloud Function / sync window changes (WO-024 territory)
- AI note summaries / “Day in Review” prose (WO-111 / Pepper)
- Turning off capture by default (idea only)
- Production deploy without Cindy typed **GO**
- Splitting `index.html`

---

## Implementation notes

1. **Helper:** add `cchTimeSourceBucket(entryOrCapture)` → `{ kind: 'timely'|'agent'|'logged'|'manual', label, color }` near Smart Time block; use in recon + week + day.
2. **Member filter:** Reconciliation already has `_reconMemberFilter` — captured minutes may need member scoping if agent logs are per-user (check `desktopTimeLogs` doc shape).
3. **Cache bust:** bump `CCH_BUILD.version` + tag when shipping.
4. **Pre-deploy:** `node --check` not applicable to HTML; smoke Smart Time + Reconciliation on **staging** with Ctrl+Shift+R.

---

## Acceptance checklist (staging)

- [ ] Reconciliation **Month**: each weekday cell shows logged total + Timely captured + Agent captured (when > 0)
- [ ] Legend visible; colors match table above
- [ ] Week/14-day table shows capture columns or expand detail with Source
- [ ] Smart Time **Week**: no single lump “captured”; Timely vs Agent split visible
- [ ] Source filter pills still work on activity tab; no regression on approve-to-ledger
- [ ] Vanessa path: mostly Timely green; empty agent subtotals OK
- [ ] Cindy path: both colors on same day when parallel-running
- [ ] Timely sync untouched (no edits under `Functions/` for Timely)
- [ ] Build tag incremented; line in `_DEPLOY_QUEUE.md`

---

## Suggested WO id

**WO-112** · Smart Time source split — Reconciliation calendar + Week view · staging · Aug 13, 2026

When starting build, add row to `loop/LOOP_LEDGER.md` and file `loop/WO-112_smart-time-source-split-reconciliation_CW_Aug13.md` (copy of this spec).

---

## Deploy queue line (template for implementer)

```text
[YYYY-MM-DD HH:MM] #<n> WO-112 Smart Time source split — platform/index.html — staging — Timely vs Agent visible in Reconciliation Month + Week; legend + source badges — STATUS: pending
```

---

## Open questions for Cindy (optional before Phase D)

1. Should **Manual Entry** rows show as a fourth color or fold into “Logged”?
2. Month cell click: land on **Day** view instead of Timeline?
3. Default period for Vanessa: **Month** on Reconciliation when opening Smart Time?

---

*End of handoff · v1.0 · Cursor · Aug 13, 2026*
