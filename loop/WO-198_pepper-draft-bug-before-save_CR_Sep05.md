# WO-198 — Pepper: draft a bug / feature / task for review before save

**CR_Sep05** · Group C · **State:** OPEN · **Pri:** High

## Symptom (Cindy, Aug 11)

Pepper upgrade: let Pepper draft a bug / feature / task for review **before save**.

## Lead

Pepper is draft-only today (never sends/saves/pushes). This is a review-then-confirm UI, not autonomous writes. Ground `cch-pepper.js` + bugs-board submit after WO-191.

## Constraints

- Staff-only. Never on `#/clientview/*`.
- No native `prompt` / `alert` / `confirm`.
- Do not auto-file to `feedbackRequests` without Cindy/Vanessa confirming the draft.
