# WO-121 · Client portal: ID leak, portrait layout break, decline latency · CW Aug 21

**Ledger number:** **WO-121** (handoff file was titled WO-112; that number is already used for Smart Time source-split). Scope unchanged.

**FILE TO:**
- **Cursor reads from:** `C:\dev\CCH-Platform-Deploy\cch-deploy\Docs\`
- **Companion copy:** `C:\Users\cindy\Dropbox\Claude - CCH studio\`
- **Ledger:** add the WO-112 row to `cch-deploy\loop\LOOP_LEDGER.md` before Cursor picks it up.
- Neither folder is connected to the authoring session, so this file was handed over as a download and must be copied manually. Do not let Cursor work it from a downloads path.

**Change ID:** pending · **Lane:** Studio platform (client portal) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Cindy screenshots on an actual phone, portrait · **Gate:** Cindy GO for prod. Staging first, minimal diff.

**Likely files:** `cch-client-board.js` (client portal surfaces per the Context Map), `platform/client.html` (external render), `platform/index.html` (`.cp-` styles and the decision handlers).
💩 Module attribution above is from `CCH_STUDIO_CONTEXT_MAP_C-Team_Aug11`, not from a fresh read. **Re-ground every path and line before editing.** Do not trust any line number in this doc, there are none on purpose.

**Evidence:** four phone screenshots taken by Cindy on `cch-platform.web.app`, Rolling Hills client portal, Aug 21. Two portrait room board card grids, one portrait proposal decision table, one landscape decision table.

---

## Part 1 · Internal IDs are rendering on the client surface (do this first)

**Observed.** Room board cards in the client portal display chips below the Approve / Decline buttons:

- `Lib 4xmDS17itFvN…`
- `PR PRO-3020`
- `PR nUaB1yanz2XEjXiboLdE`

These appear on Vela Sconce, Antasia Double Glass, and Echo Sconce cards. They are Firestore document IDs (`libraryProductId`, proposal doc ID) and a proposal number.

**Why this is priority one.** `CCH_STANDING_RULE_client-visibility-boundary`: no admin UI, debug text, template literals, or internal identifiers on any client surface. PRO-3020 is a $93K lighting proposal that has not been sent to this client. The chip is telling them it exists.

**Do.**
1. Find where those chips are emitted in the client portal card render. They look like a debug affordance carried over from the admin card, not a deliberate client feature.
2. Remove them from every client-facing render path. Do not hide with CSS, do not truncate, do not relabel. Remove the emit.
3. Then grep the whole client portal render for any other raw ID, doc ref, template literal, or internal status string reaching the DOM. Report what you find before changing anything beyond these three chips.

**Report back:** the exact render function, whether the chips were behind a debug flag that is on in prod, and whether the same render is shared with any other client surface (tear sheets, emailed proposals, client Pepper).

---

## Part 2 · Proposal decision table is unusable in portrait

**Observed, portrait.** The decision table collapses. Column content wraps to one character per line, running hundreds of pixels down the page. Item title, qty, price, and total overprint each other (`2Double $2,370.00 $4,740.00` stacked on `Double sconce`). The Approve control is pushed to the far right edge, Decline is off screen entirely.

**Observed, landscape.** Same table, less severe: readable rows, but the Decline button is still clipped at the right edge (`Dec…`).

**Cause (💩 inference, confirm in code).** A fixed `<table>` with seven columns (ITEM / QTY / PRICE / SHIPPING / TAX / TOTAL / DECISION) and no mobile breakpoint. At narrow widths the browser shrinks each cell to its minimum content width, which is one character. The DECISION column is outside the visible box because total column min-widths exceed the viewport.

**Do.**
1. Below a breakpoint (start at 700px, tune on a real device), render each line as a stacked card instead of a table row: image, title and spec block, then a small label/value list for QTY, PRICE, SHIPPING, TAX, TOTAL, then the Approve and Decline buttons full width at the bottom of the card.
2. Buttons must be inside the card box and reachable without horizontal scroll. This is the acceptance criterion, not an aesthetic preference.
3. Landscape and desktop keep the table, but the DECISION column must never clip. If the table cannot fit, it drops to the card layout rather than overflowing.
4. Hold the portal design system: pure white, navy `#0A1F3D`, gold `#C8A97E`, zero border radius, 1px `#E2E2E2` borders, no shadows, DM Sans / Playfair, `.cp-` prefix. No rounded corners appear anywhere in the mobile layout.

Platform rule already on the books: proposal tables readable without horizontal scrolling. This is that rule, on a phone.

---

## Part 3 · Decline is noticeably slower than Approve

**Observed.** Cindy: approve responds fast, decline lags.

**Cause (💩 inference, confirm before changing).** Candidates, in order of likelihood:
1. Approve flips local state optimistically and writes after, while Decline awaits the Firestore round trip before repainting.
2. Decline does more work in the same await: the decision write, an `activity` event, and possibly a designer notification, all sequential.
3. Decline routes through a Cloud Function that Approve does not.

**Do.**
1. Read both handlers and report which of the three it actually is. Do not optimize until that is answered.
2. Then make both paths behave identically: optimistic UI update, then write, with a visible rollback and an error state if the write fails. Same button feedback state on both.
3. Any secondary writes (activity, notification) fire after the UI has already updated, not before.

**Guardrail.** A decline must never be silently lost. Optimistic UI is a display change only. If the write fails, the card reverts and the client is told.

---

## Guardrails (all parts)

1. **No price writes anywhere in this WO.** Room board and proposal prices are client-visible and Cindy-controlled per `CCH_STANDING_RULE_saved-proposal-pricing`. The pricing defect is a separate read-only finding (see `FINDING_roomboard-card-price-wrong_CW_Aug21_v1_0`). If you touch a price field in this work order, you are outside scope.
2. **Minimal diff.** No refactor of the portal render while you are in there.
3. **No new client-facing surface.** Nothing is added to what the client sees, only removed and reflowed.
4. Staging first. Screenshots to Cindy, portrait phone, before any prod discussion.

---

## Acceptance

1. No Firestore ID, library ID, proposal number, or debug chip appears anywhere in the client portal. Verified by grep of the render path plus a portrait screenshot of the same three sconce cards.
2. Portrait phone: every proposal line is legible, no character-per-line wrap, no overprinted text, and both Approve and Decline are tappable without horizontal scrolling.
3. Landscape and desktop: Decline is fully visible, no clipping at the right edge.
4. Approve and Decline respond with the same perceived latency. A failed write visibly reverts the card.
5. No console errors from app origin. Ignore extension noise (`inpage.js`, `ERR_BLOCKED_BY_CLIENT`).
6. Portal aesthetic unchanged: no border radius introduced, `.cp-` isolation intact.

---

## Ledger

Add: WO-112 · Client portal, three defects found on phone Aug 21 · (1) internal Firestore/proposal IDs rendering as chips on room board cards, boundary breach, remove at emit · (2) proposal decision table has no mobile breakpoint, collapses to one character per line in portrait and clips Decline in landscape, add card-stack layout · (3) Decline path slower than Approve, unify on optimistic update with rollback · Cursor · staging first · pricing defect excluded, see separate finding.

*v1.1, Aug 21 2026. No line numbers by design. Re-ground before editing.*
*Changed from v1.0: added the FILE TO destination block. No change to scope, guardrails, or acceptance.*
