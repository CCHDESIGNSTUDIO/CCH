# WO-119 DONE — Pepper training: brief cadence

**CR_Aug21** · Executor: Cursor · State: DONE-UNVERIFIED (not VERIFIED)

## Files touched

| File | Lines | Change |
|------|-------|--------|
| `Functions/cchPepper.js` | `PRESET_FRAMES` 42–44; `buildSystemPrompt()` 107–113 | Added `daily_brief` / `weekly_brief` / `monthly_brief` frames. Added **BRIEF CADENCE** after facts. Facts block 91–105 **untouched** (Pay Now still Square/Zelle at :101). |
| `platform/cch-pepper.js` | `BUILD` 21; `PRESETS` 1248–1252; click handler 2147–2164 | Three buttons after “What’s on my agenda”. Wired like `my_agenda`: `buildMyAgendaBrief` + `buildFirmWideStaffDigest`, then `send({ action: p.key })`. Staff-only gates unchanged (`isClientRoute` 30, 2380+). |
| `platform/index.html` | `CCH_BUILD` 4295; script 87249 | Cache buster `cch-pepper.js?v=20260821wo119`. Studio **9.9.252**. |

## What changed

Training only. No new Firestore collections. No personality rewrite. No second agenda builder.

Weekly/monthly **content** (last-7 / month rollup) is still **WO-120**. Frames tell Pepper to say the digest has no week/month rollup instead of inventing numbers.

## Self-test

- `node --check Functions\cchPepper.js` — pass
- `node --check platform\cch-pepper.js` — pass
- `index.html` ends `</html>` (87270)
- `cch-pepper.js` ends `})();`
- Grep: one facts header; Pay Now line still Square/Zelle at `cchPepper.js:101`
- Did **not** deploy (queue staging hosting + `functions:cchPepper`)

## Queue

Appended `_DEPLOY_QUEUE.md` staging, STATUS: pending.
