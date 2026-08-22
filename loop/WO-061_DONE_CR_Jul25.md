# WO-061 DONE — Cursor · Jul 25, 2026

**State:** DONE-UNVERIFIED (staging)  
**Build:** v9.8.115 · `wo061-stale-clip-sync-gate-2026-07-25`

## Grounding (this turn)

| Symbol | file:line |
|--------|-----------|
| `removeProposalItem` clip unlink | `platform/index.html` ~34346–34365 |
| `syncProposalLinkOntoClips` | `platform/index.html` ~39092–39195 |
| Existence scan | `boards/{pid}/clips` `.get()` once per sync |

## What changed

1. **`syncProposalLinkOntoClips`** — Load all project clip ids once; only `.update()` live ids. Missing ids: prune `clipId` / `sourceClipId` on proposal lines (one write). No per-id "No document to update" warn loop; residual not-found swallowed.
2. **`removeProposalItem`** — `.get()` before unlink update; missing clip = silent no-op. Warn only for other errors.

Doc-isolation: prune clears dead pointers only; no library fields written.

## Self-test

- `node` not required (HTML inline). Build tag bumped.
- Staging deploy after this note.

## Verify (Claude / Cindy)

1. Staging Ctrl+Shift+R → sidebar **v9.8.115**
2. RH Design Board "Powder Baths" + edit/approve a proposal line → console clean (no "No document to update" flood)
3. Dead `clipId` on a line clears after one sync; live clips still get approved/declined patches
