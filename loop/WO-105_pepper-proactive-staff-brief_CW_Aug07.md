# WO-105 — Pepper proactive staff brief (Cindy + Vanessa), money-first

**CW_Aug07** · Lane: **Cursor** (staff Pepper) · The internal twin of WO-104. Delivers Pillar 1 + 3 of `PEPPER_MASTER_PLAN_CW_Aug07_v1.4`. (WO-102/103 held for Pepper Desktop.)

## Goal
On the **first activity of the day / on open**, Pepper greets Cindy or Vanessa **by name** and surfaces what needs them, **money first**: hours not yet invoiced, proposals to send, invoices unsent or unpaid. She opens the conversation; they don't go find her. Once per day, then quiet unless a threshold trips.

Cindy's example (Vanessa): *"Hi Vanessa, you have hours that haven't been invoiced, open proposals, and invoices that haven't been sent or paid."*

## On-demand: "what's on my agenda" — the core interaction (Cindy, Aug 07)
The proactive morning surface is only half of it. Vanessa must be able to **ask** Pepper *"what's on my agenda"* and get **her** agenda; Cindy asks and gets **hers**. Same person-scoped, fingerprint-based content as the morning brief, available **anytime**, on demand, as a preset ("What's on my agenda / What's on my plate") and as free text ("what should I tackle first," "what did I leave open"). *"That's the only way she really works."*
- **"My" = the signed-in user.** Pepper reads the **auth email** to know who's asking (Cindy or Vanessa) and scopes to that person **automatically** — no toggle, no "which member" prompt. Vanessa signed in → her fingerprints + her open items; Cindy → hers.
- Answer ranked money-first, with the drafts ready, exactly like the morning brief.
- The **"All Team"** firm-wide view appears only when they explicitly ask for it. (Same default in the WO-107 dashboard: it opens on the signed-in person, not a manual pick.)

## Per-user, two lanes (uses the existing Cindy / Vanessa / All-Team member selector)
- **Vanessa:** unbilled hours to invoice, proposals to send, invoices to send + AR to collect, POs to confirm/chase, her overdue tasks.
- **Cindy:** her unbilled design-fee hours aging, proposals to send, client decisions waiting, her overdue tasks.

## Specific to the person, grounded in their activity (Cindy, Aug 07)
The morning update is a **conversation about THEIR day**, not a firm-wide report. Pepper *sees* everything (WO-106) but *speaks* to each person about their own slice, picking up where they left off:
- **Scoped to the signed-in person** (Cindy or Vanessa): their projects, their responsibilities, their money. The firm-wide "All Team" view only when they ask for it.
- **Grounded in their real recent activity** — what they actually did / touched — from the `activity` feed filtered by member (`renderActivityFeed` / `pepperFetchProjectActivity` pattern) plus Smart Time / Timely captures. The update continues their real work, it doesn't restate a database.
- **Client activity as a signal.** The brief also surfaces what clients are doing on the person's projects, because a client's behavior is often a money cue: *"Marisa viewed the Powder Bath board again Aug 4, she's watching it, good time to send the proposal,"* or *"Tracey hasn't opened the Rolling Hills proposal in 9 days."* Grounds in the client-activity feed (WO-106). A client watching a board is the moment to send.
- **How Pepper tells whose it is (the "fingerprints"):** every record carries who touched it. Scope each person's brief by the attribution fields — `member` (time entries, desktop-time / Timely logs), `author` / `authorName` / `authorEmail` (activity, messages, notes, decisions), `senderEmail`, and `createdBy` / `loggedBy` / `assignedTo` (tasks, POs, proposals, Builder work orders). Confirm the exact field per collection on grounding. Two flavors, both person-scoped: **fingerprints** (they created / edited / logged it → their recent activity) and **assigned / owned** (it's theirs to act on → their open work). The morning update blends both: *"what you did"* + *"what still needs you."*
- **Conversational and specific**, never a generic dump: names their projects and their items, in their voice, as if resuming a thread.

**Example (Vanessa):** *"Morning, Vanessa. Yesterday you logged time on Rolling Hills and sent two POs. Today: there's Timely time not logged for Aug 6, INV-6055 is still open at $3,885, and 2 proposals are waiting to go out. Want to start with the unbilled hours?"*

**Example (Cindy):** *"Morning, Cindy. You were deep in the Powder Bath board yesterday. Still on your plate: the Powder Bath proposal (25 items, not sent), 3 client decisions waiting, and design-fee hours aging on Rolling Hills."*

(Real activity + real numbers only — the Accuracy rule below applies to the "what you did" line too, never invent activity.)

## The money loop, top to bottom (firm-wide per member — the new aggregation)
The leak starts before billing: **if it's never logged, it can never be billed.** So the brief walks the loop in order — logged → billed → invoiced → paid.

0. **Time not yet logged (the earliest leak) — Cindy, Aug 07.** Two parts: (a) **Timely activity captured but not yet logged/reconciled** into the ledger, and (b) **days with missing or low hours** (Missing Time Alerts). **Name the specific days.** Example: *"Hi Vanessa, there's time in Timely that hasn't been logged yet. You're missing hours for Aug 4, Aug 5, and Aug 7."* Ground in `buildSmartTimeDigest` (the "no time logged / only Xh logged" chips Pepper already scrapes) + the Timely **Reconciliation** queue (untagged / unlogged `timelyEntries`, `source == 'timely'`). *Dependency: relies on the Timely sync working (WO-097) so there's fresh Timely data to compare against.*
1. **Unbilled billable hours** — logged but not invoiced: $ and age of oldest entry. (Extend `buildUnbilledTimeDigest` @`cch-pepper.js:188` from per-project to firm-wide-per-member.)
2. **Proposals not sent** — drafted / awaiting send (ground the "sent" flag on build).
3. **Invoices** — **not sent** (drafted) and **sent-but-unpaid** (open AR, with age; **>30 days flagged, split by track** per `cch-cfo`).
Each item carries a one-tap action **and the draft** — draft the invoice, send the proposal, the collection nudge. Draft-only; she clicks.

## Accuracy — non-negotiable (same rule as WO-104)
Every dollar and count is pulled **live and exact**, never approximated, never invented. Numbers must match the Financials / Time Ledger / Proposals pages to the digit. If a figure can't load, Pepper says so and never guesses. Zero → drop that bucket.

## Internal — full money detail is correct here
This is **staff-only** (Cindy / Vanessa). Hours, dollars, rates, margin, and AR are all visible — the **opposite** of the client whitelist (`CCH_STANDING_RULE_client-visibility-boundary`). Must never render on any `#/clientview/*` route.

## Guardrails
Draft-only; never sends, creates, or QB-pushes; never claims completion she didn't do. Staff-only, server-side. CCH voice, no em dashes, no agency-speak.

## Build phases (Cindy / Claude lock, Aug 09 night)

### Phase A — staging first (person plate, no project required) — **IN TREE**
- Stop “working blind” / project-only free-text when no project is selected.
- **“My” = signed-in person** via `currentEmail()` + `currentMemberName()` + `timeEntries.member` fingerprints. Spoken brief = **their** unbilled (and Vanessa-lane PO confirms). Never claim firm Financials cache totals as “yours.”
- Honest lines kept: e.g. “proposals cache not loaded yet” — never invent.
- All Team / firm FU+OM dump only when they ask All Team.
- **Not** the full WO-106 rollup. Prod only on Cindy typed GO.

### Phase B — WO-106 (already filed) — build when fresh, with Cindy GO
- Extend `_cache/financialSummary` into state-of-everything (proposals/invoices/POs/tasks/decisions/client activity/time), person + firm buckets.
- Accuracy-critical — careful pass, not a tired-night build.

## Grounding — what's real today vs the wiring to do (live code check, Aug 07)
**Honest state: the "fingerprint agenda" is NOT one system yet.** Identity exists and attribution exists; they are not connected. This WO is that connection.

**Who's asking ("my") — already exists, just not used to scope:**
- `cch-pepper.js` `currentEmail()` (~21-24) reads the Firebase Auth email.
- Studio maps email → person via `currentMemberName()` (`index.html` ~47974-47980, `TEAM_CONFIG` name tokens) → Cindy Holloway / Vanessa Holliday.
- **Use this to scope the agenda to the signed-in member by default.** Today it establishes identity but filters nothing.

**Whose plate (the "fingerprints") — scattered attribution fields, confirm per collection on build:**
- Time / Timely: `member` (sometimes `userName` / `user` / `email`).
- Activity / stars / comments: `authorEmail`, `authorName`, `authorType`.
- Tasks / POs / proposals / Builder: `createdBy` / `loggedBy` / `assignedTo` (confirm each).

**The specific change:** `buildUnbilledTimeDigest` (`cch-pepper.js` ~234-235) already **groups** by `member` but **dumps the whole project's unbilled pile** — it does not scope to "only Vanessa" when she's signed in. Add a **scope-to-signed-in-member filter** (default), with "All Team" as the opt-in. Apply the same member-scope pattern across the other buckets.

**Client activity is a separate signal, not a fingerprint:** client-sourced `activity` + stars carry `authorType: 'client'` (`cch-client-activity.js`) — that's "what the client did" (a cue, WO-106), never a staff person's plate. Keep the two streams distinct.

**Net:** login email = who Pepper answers; Firestore attribution = whose plate. Both are present in code today; this WO connects them so "what's on my agenda" assembles from the signed-in person's fingerprints. Also feeds `buildFollowUpsDigest`, decisions, OM (`buildOmDigest`); Financials / Time Ledger for AR + unbilled; proposals for not-sent.

## Acceptance
1. On Vanessa's first activity of the day: Pepper greets "Hi Vanessa" and names the **real** unbilled $ (+ oldest age), # proposals to send, # invoices unsent, and $ AR unpaid, each tappable to act with a draft ready.
2. On Cindy's: her lane's version.
3. Every number matches Financials / Ledger exactly; zero buckets dropped; nothing invented.
4. Never appears on a client route. Verified on staging, then prod on Cindy's GO.
