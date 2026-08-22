# WO-086 · Pepper / Team Chat & Bugs widget — fix panel overlap + make Pepper cuter · CW Aug 05
**Change ID:** pending #1 · **Lane:** Studio platform (Pepper / Team Chat & Bugs widget) · **State:** Part 1 (overlap) DONE — Cursor fixed it on staging and it shipped to PROD (Aug 05). Part 2 (avatar swap) OPEN. · **Executor:** Cursor (it edited index.html fine for the overlap; the avatar swap is an even smaller change, Cursor keeps it) · **Verifier:** Fable · **Gate:** Cindy GO for prod
**File:** `platform/index.html` — the floating "TEAM · CHAT & BUGS" / Pepper widget (CHAT + BUGS tabs, Send, project tag, "Ask Pepper") and the related Pepper Manage/Summary panel. **Staging first; minimal diff; targeted edits, no wholesale load.** Check existing Pepper design in the project's `FABLE_DECISION_pepper-features` docs before restyling, keep continuity.

## Part 1 — Overlap bug ✅ DONE (Cursor, staging → prod, Aug 05)
Two floating panels open at overlapping positions and cover each other: the "TEAM · CHAT & BUGS" chat panel and the Pepper Manage/Summary panel (SUMMARY / UNBILLED / VENDOR buttons, "Chat clear / Manage") sit stacked so the back one's controls are obscured and unusable.
- **Panels must not overlap/obscure each other.** Pick one clean behavior: open only one at a time (opening one closes or collapses the other), OR offset them so neither covers the other's header/controls, with correct z-index and a clear close (X) on each.
- The active panel comes to front; the chat input, Send, project-tag dropdown, and tabs must never be hidden behind the other panel.
- Works at common window sizes; the widget stays on-screen (not clipped off the right edge).

## Part 2 — Pepper avatar (FINAL, chosen Aug 05)
Cindy picked the final Pepper: composed, sleek long strawberry-blonde hair, navy blazer, glasses in hand, gold-framed navy background, clean illustrated style.
- **Final asset delivered: `PEPPER_AVATAR_FINAL_CW_Aug05.png`** (in the handoff folder, 316x321 PNG). Code's job is just to **swap the widget avatar to this image** — no drawing, no restyle.
- **Crop-to-face for the small header chip** so she stays crisp when tiny; show the full framed portrait anywhere Pepper appears larger. Keep the gold frame.
- **Persona: "drill sergeant with a smirk"** (Cindy, Aug 05) — commanding, dry-witted, already-handled-it, not bubbly. If any Pepper copy/tone is touched (empty state, "Ask Pepper" prompt), give it that crisp edge. Behavior otherwise unchanged.

## Guardrails
1. Display/positioning/visual only. No change to chat data, bug capture, staff log, or Pepper's behavior.
2. Don't break the BUGS tab capture or the "Send" / project-tag flow.
3. Minimal diff on the 5MB file; if the restyle balloons, ship Part 1 (overlap) first and flag Part 2.

## Acceptance (Fable, staging screenshots)
1. Open the Team Chat panel and the Pepper Manage panel: they no longer overlap; both are fully usable; active one is on top; each closes cleanly.
2. Pepper's refreshed look renders on brand (navy/gold), warmer, and Cindy has picked the direction.
3. Chat send, bug capture, and project tagging all still work; no console errors.
Screenshots to Fable = sign-off, then Cindy GO for prod.

## Ledger
Add: WO-086 · Pepper / Team Chat widget — fix panel overlap (stacking/z-index/close) + cuter on-brand visual refresh (avatar + polish), behavior unchanged · index.html · build + queue for #1 · staging first.
