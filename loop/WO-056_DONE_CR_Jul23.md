# WO-056 DONE CR — Selections Add-to-room duplicates (new clip id) · Jul 23, 2026

**Build:** v9.8.105 (`wo055-wo056-multi-room-clip-ids-2026-07-23`)  
**Where:** staging (queue) — prod on Cindy GO  
**File:** `platform/index.html`

## Grounding (this session)

| Symbol | file:line |
|--------|-----------|
| Selections persist path `t.mode === 'selections'` | ~39296 |
| Former MOVE when `curRoom !== targetRoom` | was ~39332–39347 |
| Dedup `_disResolveClipIdFromIndex(..., targetRoom)` | unchanged |
| Create new clip (product+room) | ~39357+ (fall-through after clear clipId) |
| Header copy (no longer “move…no duplicates”) | ~39818 |

## What changed

1. If clip is **already roomed** and target room differs → **create NEW clip** for (product, target room); original room unchanged.
2. If clip is **unroomed** → still fill blank room (not a relocate of a roomed board item).
3. If (product, target room) already exists → skip (no third duplicate).
4. UI copy: “tap to add a copy here (same product can live in multiple rooms).”

## Self-test

- Grep selections block: no `clipRefExist.update({ room: targetRoom` on the roomed-elsewhere branch.
- Roomed-elsewhere clears `clipId` and falls through to `.add()`.

## Verify (Claude, staging)

Product on Kitchen → Add to Exterior via Selections → two clip ids; Kitchen clip room still Kitchen. Add Exterior again → no third clip.

**State:** DONE-UNVERIFIED  
**Pairs:** WO-055; WO-045 writes still gated until dry-run on `cloud-rolling-hills`.
