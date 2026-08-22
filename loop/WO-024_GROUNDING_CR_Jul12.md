# WO-024 Grounding · Timely sync floor · CR Jul 12

## Client entry points
| Function | File:line | Default window (before fix) |
|----------|-----------|----------------------------|
| `syncTimelyNow()` | `index.html:14846` | **120 days** → ~Mar 13 from Jul 11 |
| `syncTimelyEntries()` | `index.html:63405` | **30 days** (OAuth callback path) |

Both POST `{ startDate, endDate }` to `timelySyncEntries` on **cch-design-boards** (production data project).

## Cloud Function (`Functions/index.js:363`)
- **Honors `req.body.startDate`** when provided — no server-side clamp beyond a **7-day default** when the body omits `startDate` (client always sends dates after fix).
- `fetchAllTimelyEvents` calls Timely `/events?since={startDate}&upto={endDate}` — passes through client dates.
- **Dedup:** `timelyEntries` doc id = `timely-{entry.id}` with `.set(row, { merge: true })` — re-sync updates in place, no duplicate docs.
- **No tag filter** — all Timely events in range are saved regardless of project tag.

## Root cause of “only March”
**Client-only.** The 120-day lookback on `syncTimelyNow()` excluded February 2026. Server would have fetched February if asked.

## Fix shipped (staging)
- Start-date picker on **Timely Logged** tab (default `YYYY-01-01`, persisted in `sessionStorage`).
- Both sync paths aligned to year-start default.
- **Cursor does NOT run resync** — Cindy runs from production/staging UI with explicit GO.

## Staging CORS note
`timelySyncEntries` CORS allows `https://cch-platform.web.app` only. Testing sync **from staging** may hit CORS unless function CORS is extended (production function deploy — separate from this hosting-only batch).
