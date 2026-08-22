# WO-104 — Client Pepper: remind clients of their open items on sign-in

**CW_Aug07** · Lane: **Cursor** (`cch-client-portal`) · Grounded in `platform/cch-client-pepper.js` + `platform/client.html` this session. (WO-102/103 are held for the Pepper Desktop voice/persona steps.)

## Goal
When a client opens their portal, Pepper greets them by name and surfaces what's waiting on **them**: proposals to approve, invoices to review, decisions needed. Read-only, client-safe, warm. This evolves the client Pepper from pure relay into a gentle concierge, without turning her into a Q&A bot.

## Accuracy — non-negotiable (Cindy, Aug 07)
Every number Pepper says is pulled **live from the real data at the moment of greeting** — never approximated, never stale, never invented. (The sample intros in this WO used made-up placeholder numbers to show the voice; the build reads the actual counts each sign-in.)
- **Decisions** = live from `cpPortalCollectOpenDecisionItems` (same source as the Decisions Needed badge).
- **Proposals** = proposals **awaiting THIS client's action** (pending line/final approval via the `getProposalLineApprovalStatus` tally), NOT the total proposal count. (Cindy's example: the sidebar showed 5, but only 3 actually needed her — Pepper says the number that needs the client.)
- **Open invoices** = live from the Open Invoices computation (count + outstanding $).
- **New inspiration** = boards/items added since the client's last visit.
- **Numbers must exactly match the portal's own Action Required / badge counts.** If Pepper and the portal disagree, that's a bug.
- If a count can't load, Pepper says she couldn't pull it — **she never guesses** (same honesty that made her flag the missing tasks). Zero → drop that bucket, don't say "0 decisions."

This is the mission in miniature: *follows up on everything, and only on what's real.*

## Grounding (reuse what already exists — do NOT recompute)
- **Client Pepper** (`cch-client-pepper.js`) already holds `ctx = { projectId, projectName, clientName, clientEmail }` (lines 632-635) and already fires a first-open hello (`voicedHelloForProject`, line 452). Hook the reminder there.
- **The portal already computes the open items** in `platform/client.html`:
  - Open **decisions:** `cpPortalCollectOpenDecisionItems(clientDecisions, tasks)` (~line 11083); `_openClientDecisions` / `_decisionsNeededCount` (~8627-8631).
  - Open **invoices:** the "Open Invoices" / "Total Outstanding (open invoices)" render (~9644-9988).
  - **Proposals awaiting the client's approval:** the portal's Proposals section (confirm the pending-approval flag on grounding).
  These are already client-safe. Reuse the computed values, don't re-derive.

## Change
1. On portal load / first Pepper surface, build a short **"here's what's waiting for you"** greeting: *"Hi {clientName}, a couple of things are waiting on you:"* then up to ~5 items across three buckets — **Proposals to approve · Invoices to review · Decisions needed** — each item tappable to jump to the right portal section.
2. **Nothing open →** a warm *"You're all caught up. Nothing needs you right now."* Never manufacture an item to seem busy.
3. Read-only and client-safe: only the proposals / invoices / decisions the client is meant to act on.

## Greeting copy (Cindy's voice, Aug 07)
First-person, warm, count-based. Pepper introduces herself, then names only the buckets that are non-zero, with live counts:
> "Hi, it's Pepper. You have **3 decisions** to make, **2 proposals** to review, and a **couple of invoices** open. Tap any and I'll take you right to it."
- Name only non-zero buckets (if 0 proposals, drop that clause; singular/plural agree — "1 decision" / "3 decisions").
- Keep the invoice line **gracious, not nagging** — "invoices open" / "to review," never "not paid / overdue" (these are long-term luxury clients).
- All caught up: *"Hi, it's Pepper. You're all caught up — nothing needs you right now."* (no em dash in final copy; use a period or comma.)

## Proposal approval nudge (Cindy's examples, Aug 07)
For a proposal awaiting the client, Pepper quotes the **real per-line progress**, not just a count, and prompts final approval once every line is decided. Cindy's examples:
> "Proposal {#} has **20 lines** still pending your decision. You've **approved 4**, **declined 3**."
> "Proposal {#} is **ready for final approval**. Want to give it the final yes?"
- **Reuse `getProposalLineApprovalStatus(item)`** (`client.html:3623`, returns approved / declined / pending) and the existing per-line tally loop (~line 8032, already counts approved / declined / pending). Do NOT recompute status.
- **Logic:** `pending > 0` → "N lines still waiting on you (X approved, Y declined)," tap opens the proposal. `pending == 0` and not yet finally approved → "ready for final approval," tap goes to the final-approval action.
- Approve / decline / final-approval controls already exist (`clientApproveLine`, `client.html:11788`) — Pepper **links to them, never auto-approves**.
- Client-safe: line counts and outcomes only, no rates or margins (the existing proposal render already respects this).

## New-feature announcements (Cindy's 2nd example, Aug 07)
Pepper's sign-in greeting also carries **delight, not just to-dos**: it surfaces what's new for the client so the portal feels alive and they discover what they can now do. Cindy's example:
> "Hi, it's Pepper. We have a new feature. You can now add your own inspirations to your client board."
- **Reuse the existing `whatsNewItems`** already loaded in `platform/client.html` (~line 8388) — do NOT build a new feed. Surface the newest **unseen** item in Pepper's voice, with a tap to the relevant section (here: Inspiration Boards).
- This pairs with **WO-091** (client can add an image to their inspiration board / "Client Ideas"): 091 ships the feature, 104's Pepper announces it.
- Two flavors of "what's new," both in the same warm beat:
  - **New feature** (from `whatsNewItems`): *"you can now add your own inspiration images"* / *"you can now create your own inspiration boards."*
  - **New boards Cindy added** (recently-created inspiration boards for this project): *"Cindy's started two new boards for you, Master Bath and Kids Bath."* Detect newly-created boards since the client's last visit and name them.
  - **New images added to existing boards** (images added to boards that already exist, since the client's last visit): *"Cindy's added new images to your Great Room and Master Bath boards."* Detect which boards gained images and name them; a live count is fine ("6 new images across 2 boards") but must be **real and exact** per the Accuracy section — never "some new images" when you can say how many and where.
  - Combined example: *"A couple of lovely things this week: you can now create your own inspiration boards, and Cindy's added two new ones for you, Master Bath and Kids Bath."*
- Show a what's-new note **once**, then mark it seen so it doesn't repeat every visit. One item at a time; never dump a changelog on a client.
- **Greeting order:** lead with what needs them (decisions / invoices / proposals), then the lighter "and, new this week…" note. Drop either half when it's empty.

## Design decision for Cindy (content is identical either way — just how assertive)
- **(A)** Pepper auto-opens the panel with the greeting on every sign-in.
- **(B) [recommended]** Pepper's dock shows a gentle badge ("2 waiting") + a one-line greeting, auto-surfaced **once per session**, tap to expand. Less naggy on repeat visits, more gift-like.

## Guardrails
- **Whitelist-only, default internal** (locked: see `CCH_STANDING_RULE_client-visibility-boundary`). Pepper's greeting surfaces ONLY the four client-facing things — **proposals, invoices, decisions, inspiration boards** (+ what's-new) — and nothing else. No POs, no internal tasks, no time/rates/margins, no vendor data, no staff notes.
- **Relay unchanged:** Pepper still doesn't answer questions. This ADDS a proactive open-items nudge; it does not make her a chatbot.
- Warm CCH voice, no em dashes, gift feel ("Designing Your Story").
- Renders only on `#/clientview/*`; never on staff surfaces.

## Acceptance
1. Open a client portal that has open items (e.g. 31 Whitesail — a decision + tasks): Pepper greets by name and lists the open proposals / invoices / decisions, each tappable to the right section.
2. Counts match the portal's own Action Required / Decisions Needed / Open Invoices.
3. Nothing open → warm all-caught-up message, no false items.
4. No internal or rate/hours data shown. Verified on staging, then prod on Cindy's GO.
