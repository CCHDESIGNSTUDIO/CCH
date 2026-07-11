# WO-009 · Project Overview declutter — REFINED v1.1 · CW Jul 11
**Change ID:** pending #1 assign (BF) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
**v1.1 supersedes v1.0** — refined from Cindy's Jul 11 staging screenshots. Key change: Inspiration is
NOT collapsed — it's the HERO. Only Room Boards collapse. Selections grid is removed outright.

## Cindy's exact words (Jul 11, viewing staging Overview)
"Move the activities up to the same row as the Tasks. I don't want to see all those selection boxes.
Show a collapsible room-board thumbnails, and make the inspiration boards larger — fill the page.
I don't care a whole lot about selections — they're just there to apply to rooms or design boards."

## Target Overview layout (top to bottom)
1. Financial Health strip — unchanged.
2. Action Required (4 cards) — unchanged.
3. **Tasks + Recent Activity on ONE ROW, side by side.** Move the Recent Activity feed OUT of the
   right sidebar and up next to Tasks (e.g. Tasks left ~60%, Recent Activity right ~40%, or two even
   columns). This is the specific "activities up to the same row as Tasks" ask.
4. Project Notes — unchanged, below that row.
5. **Room Boards = collapsed by default**, a single header row "Room Boards · N · View all →" that
   expands to a thumbnail strip on click (persist collapse state per-user in localStorage).
6. **Inspiration boards = LARGE, fill the page.** This is the hero of the Overview now — big board
   thumbnails/tiles, full page width, NOT collapsed, NOT a one-line summary. Make them prominent.
7. **REMOVE the Selections category grid entirely** (the "Appliances 1 / Bar 4 / Butler Pantry 12…"
   boxes). Selections are a means to an end (applied to rooms/design boards), not an Overview headline.
   Keep the existing one-line "Selections · N items · $X · View All →" link only; the full grid lives
   on the Selections tab.

## What changed from v1.0
- v1.0 collapsed BOTH Room Boards and Inspiration. WRONG — Inspiration must be LARGE/full-page; only
  Room Boards collapse.
- v1.0 kept a collapsed Inspiration preview. Now: Inspiration is the prominent hero section.
- Selections grid: still removed (confirmed).

## HARD RULES (unchanged)
- White boxes + accent lines, no gray (feedback_no_gray_boxes).
- Navy #0E1629 / gold; never split index.html.
- No new data; layout/CSS + collapse-state only.

## Acceptance (binary)
1. Recent Activity renders on the same row as Tasks (not in the right sidebar).
2. No Selections category grid on Overview; the one-line Selections summary + View All remains.
3. Room Boards collapsed by default; expands to thumbnails; state persists per user.
4. Inspiration boards render large and fill the page width, prominent, not collapsed.
5. Zero console errors; Overview reads cleaner/shorter than before except the enlarged Inspiration.

## Verify (Claude, staging)
cloud-rolling-hills Overview: confirm the Tasks+Activity row, no selections grid, collapsed room boards,
large inspiration. Screenshot before/after to loop/verify/WO-009/.

## DONE note
loop/WO-009_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
