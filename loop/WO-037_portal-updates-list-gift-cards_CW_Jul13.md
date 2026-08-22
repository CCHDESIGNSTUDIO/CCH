# WO-037 · Client Portal "Updates" list — enlarge the bi-weekly cards into gift-like magazine covers · CW Jul 13
**Change ID:** pending #1 assign (CP) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
**Client-facing.** Consult the `cch-client-portal` skill (Programa aesthetic). **Staging first; prod on Cindy GO.**
Polish (not a daily-pain blocker) — do with the Tier-2 batch.

## What Cindy said (Jul 13, portal Updates list, staging)
"I feel like this could be larger. Remember everything is a gift & beautiful." The published-update rows in the
Updates list are small (a little thumbnail + one line of text). For the client's "Designing Your Story" history
they should feel like the cover of an issue, generous and beautiful, not a file-list row.

## APPROVED (Jul 13) — build to the delivered mock
Cindy reviewed the mock (`cch_updates_list_gift_mock.html`) and approved: "beautiful!" Build to that layout —
~44% landscape cover with navy veil + "Your Bi-Weekly Update" kicker, Playfair period headline, gold uppercase
subtitle, one-line teaser, "Open the issue →" (gold arrow), 1px gold hairline between cards, gold border on
hover, no shadows. Covers = each update's real `heroImageUrl` (grey blocks in the mock are placeholders).

## Grounding (confirmed)
- `cpPuRenderList(updates, projectId, baseHash, isOwner)` @cch-progress-updates.js:270-289 renders each published
  update as `.cp-bwu-list-row` with a small `.cp-bwu-list-thumb`, the period label, the title, and "Open →".
- Styles live in `puInjectStyles()` (same file). The update data has `heroImageUrl` (cover), `period`/period label
  (`puPeriodLabel`), `title`, `greetingBody`, and `highlight.heading` available for a teaser line.

## Change — redesign the list card (keep Programa)
Make each update a **large, full-width landscape card**, stacked, magazine-cover feel:
- **Big landscape cover image** (the update's `heroImageUrl`) across the top or left ~40-50% of the card, tall
  enough to read as a hero (not a 64px thumb). Navy→warm gradient veil if text overlaps it (as the detail hero).
- **Period as a Playfair Display headline** (e.g., "February 1–14, 2026") large and elegant, with the title
  ("February Bi-Weekly Update") as a smaller gold/gray subtitle beneath.
- A **one-line teaser** from `highlight.heading` or the first line of `greetingBody` so each card previews its
  story ("The game room rendering sets the tone for the home.").
- Generous padding and whitespace; a **1px gold hairline** separating cards (no shadows — Programa uses borders,
  not shadows; border-radius 0). A restrained hover state (border/opacity shift or a slight gold underline on the
  period), not a drop shadow.
- Keep the "Open →" affordance (whole card clickable) and, for studio admin, the small "Edit" (fix its onclick per
  the WO-028 escaping rule, don't reintroduce the quote collision).
- Newest first (already sorted). One column, full width of the content area, so each issue gets room to breathe.

## Constraints
- Programa: white #FFFFFF, navy #0A1F3D, gold #C4A464, Playfair Display + DM Sans, radius 0, **no shadows**, no
  emojis in headers, generous whitespace. Everything reads like a gift.
- Client-portal isolation (`.cp-` scope); no financials/team names; images `referrerpolicy="no-referrer"` with the
  existing placeholder fallback for missing covers.
- Mobile: the landscape card stacks gracefully (image above text) on narrow widths.

## Acceptance (binary)
1. The Updates list shows large, full-width magazine-style cards with a real cover image, a Playfair period
   headline, subtitle, and a teaser line — visibly more generous than the current thin row.
2. Programa palette/type respected; no shadows; radius 0; no emojis; placeholder shows when a cover is missing.
3. Whole card opens the update; admin Edit still works (escaped onclick, no console error).
4. Looks right on desktop and stacks cleanly on mobile. No console errors.

## Verify (Claude, staging)
Open the portal Updates list → confirm the enlarged gift-like cards render, cover + period + teaser, no shadows,
opens correctly, mobile stacks. Screenshot to loop/verify/WO-037/.

## DONE note
loop/WO-037_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
