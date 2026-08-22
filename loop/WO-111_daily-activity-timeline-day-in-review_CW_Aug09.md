# WO-111 — Daily activity timeline ("Day in Review"), per person

**CW_Aug09** · Lane: **Cursor** (Pepper + Smart Time + all-seeing) · The evening bookend to WO-105 (morning brief). Reuses WO-106 (all-seeing), WO-105 (fingerprints), WO-109 (billable classification), WO-110 (Studio-only).

## What Cindy wants
A **daily, per-person, chronological reconstruction of what she and Vanessa actually did** — the thing produced by hand for 7/21 ("12:58 built the Katke Bedding proposal → 1:00 filed the Builder bug → 1:58 the Living Room work order → 3:07 saved PRO-3034"). She wants it **every day.**

## Why it's valuable (three at once)
1. **Billing:** reconstructs billable time from real actions, so hours stop leaking (the 20-year problem).
2. **Memory:** each person gets an honest record of what they got done.
3. **Catches the invisible:** shows bug-work and blocked work that no single screen reveals (the 51-minute lesson).

## What it is
For a chosen **day + person**, a clean chronological timeline: **time · project · action · artifact.** Built exactly the way the 7/21 reconstruction was:
- **Source = real record timestamps** across all modules — proposals, decisions, work orders, POs, invoices, clips, boards, ideabooks, and bug reports (`feedbackRequests`) — each record's `createdAt` / `updatedAt`.
- **Scoped by fingerprint** (WO-105 attribution: `member` / `authorEmail` / `createdBy`) so it's *this person's* day.
- **Studio-only** (exclude Houzz per WO-110). **Accurate** (real timestamps, never invented). **Honest about gaps** — if a time block has no artifact (e.g. bug-wrestling), it says so instead of guessing.
- **Billable vs non-billable** flagged per WO-109 (client work vs internal/bug time).

## Delivery
- **In-platform view:** a "My Day / Day in Review" screen — pick a date (defaults to today / yesterday), defaults to the signed-in person, "All Team" optional. Chronological timeline.
- **Pushed daily:** an end-of-day (or next-morning) per-person timeline — Pepper's *"here's your day."* The evening counterpart to the morning brief.

## Honest constraint
The 7/21 version was produced by querying Firestore live. The **automatic daily** version must live **in-platform** (Pepper reads the data server-side), because a headless scheduled task can't reliably reach the authenticated data. Until it's built, Fable/Claude can produce it manually on request (as done for 7/21).

## Grounding
Record timestamps across `proposals` / `clientDecisions` / `workOrders` / `purchaseOrders` / `invoices` / `clips` / `ideabooks` / `feedbackRequests`; author/member attribution (WO-105); firm-wide rollup (WO-106); billable flag (WO-109); Houzz exclusion (WO-110).

## Acceptance
1. Pick a person + day → a **chronological, accurate, Studio-only** timeline of their real actions, with billable/non-billable flags and honest gaps.
2. Reconstructing 7/21 for Vanessa reproduces the timeline we found by hand (Katke Bedding → bug filed → Living Room WO → PRO-3034), bug-time flagged non-billable.
3. Delivered daily (in-platform view + per-person push). Defaults to the signed-in person.
4. Verified on staging, then prod on Cindy's GO.
