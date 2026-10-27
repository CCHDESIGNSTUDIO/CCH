# WO-195 — Bartolo proposal import: descriptions on wrong lines

**CR_Sep05** · Group C · **State:** OPEN · **Pri:** Med · Money

## Symptom (Vanessa, Aug 27, Time Tracker)

Bartolo proposal import put descriptions on the wrong line items. Trade cost on installation did not transfer. **Total was correct.**

## Lead

Ground the vendor-bid / proposal import path (WO-125 generic parser is nearby, not necessarily this). Houzz taxonomy guard does not apply unless this is a Houzz tracker import.

## Constraints

- Document isolation: import must not write back to Product Library.
- Do not "fix" totals that are already correct by rewriting prices.
