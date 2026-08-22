# WO-108 — Activity Feed + search: filter by person (Cindy / Vanessa)

**CW_Aug09** · Lane: **Cursor** · Pairs with WO-085 (activity capture) and shares the fingerprint attribution of WO-105/106.

## Goal
Add a **"by person" filter** to the Activity Feed (and activity search) so Cindy and Vanessa can each pull up **their own** activities. Right now the feed filters by type, project, and date, but not by who did it, so neither of you can answer "what did *I* do."

## Why now (the real driver)
Vanessa's Timely shows "CCH Design Studio, 51 minutes" on 7/21 with no idea what she actually did. The Activity Feed is the reconstruction, but only if she can filter it to **herself**. Person filter + complete capture (WO-085) = "here's what I did," reconstructed. Without the person filter, the feed is everyone's noise.

## Change
1. Add a **person filter** to the Activity Feed (`renderActivityFeed`, `#/activity`) alongside the existing project + date filters and the type chip row (All / Client Portal / Inspiration / Board Updates / Builder / Invoices / Proposals / POs / Clips / Time / Email / Notes / Milestones / Projects). Options: **All Team · Cindy · Vanessa** (dropdown or chips, matching the existing filter styling).
2. **Default to the signed-in person** (via `currentMemberName()` / `currentEmail()`), so the feed opens on "my activity"; "All Team" is the opt-in for the firm view. (Same default as the Pepper agenda and the WO-107 dashboard.)
3. Filter events by the event's **author attribution** — the same fingerprint fields as WO-105 (`authorEmail` / `authorName` / `member` / `createdBy`); confirm the exact field on the `activity` event shape on build.
4. Make it compose with the existing type + project + date filters (person AND type AND project AND date), and reflect the filtered count in the "TOTAL EVENTS / TODAY" tiles.

## Guardrails
- **Client activity stays separate:** client-sourced events carry `authorType: 'client'` — they are not Cindy's or Vanessa's fingerprint and must not appear under a staff person's filter (they're the client-activity signal from WO-106).
- Staff-only page; no client exposure.
- Only as complete as the capture: this filter surfaces whatever WO-085 has captured. Where capture is thin (older dates), that's a capture gap, not a filter bug — pair with WO-085 so the person view is actually complete.

## Acceptance
1. On `#/activity`, a person filter defaults to the signed-in user and shows only that person's events; "All Team" shows everyone; it composes with type / project / date filters and the tile counts follow.
2. Vanessa filtered to herself on 7/21 sees her own actions (to the extent captured), not the whole firm's.
3. Client-sourced activity never appears under a staff person's filter.
4. Verified on staging, then prod on Cindy's GO.
