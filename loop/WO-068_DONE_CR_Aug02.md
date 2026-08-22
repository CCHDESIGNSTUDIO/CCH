# WO-068 DONE — Formatted Notes + Publish to portal · Cursor Aug 2

**State:** DONE-UNVERIFIED · Claude filed as WO-066 (number taken by DS expenses)

## Shipped (staging v9.9.82)
| File | Change |
|------|--------|
| `platform/cch-notes-format.js` | Shared escape-then-markdown (`#`/`##`/`###`, bullets, nested, numbered, `**bold**`, `*italic*`) |
| `platform/index.html` | Notes tab: render + Edit / Publish (confirm) / Unpublish / Delete; `published: false` on create; build 9.9.82 |
| `platform/client.html` | “Notes from your designer” card (published only); merge into Messages; tighten welcome-note leak (`published !== true`) |

## Guardrails
- Escape before format; source stays markdown
- Never auto-publish; confirm before publish
- Reuses `toggleCommsPublish(..., 'notes', ...)`

## Verify (Claude)
Staging Notes tab + Preview client portal. Screenshots → `loop/verify/WO-068/`. Prod on Cindy GO.
