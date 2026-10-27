# Session log — Cursor — 2026-10-21

## Overview

Ann Sacks quote 22262191. Invoice line total was being replaced by unit × qty. WO-315. Staging only.

## What changed

- `platform/cch-po-bill-variance.js` — a typed Invoice line total stays when unit or qty changes. Amount stays invoice line − PO line. Clearing the field lets unit × qty fill it again.
- `platform/index.html` — Studio 9.9.399, tag `inv-line-total-stays`. Cache `cch-po-bill-variance.js?v=20261021wo315`.

## Deployed

Staging hosting 2026-10-21 ~11:15. Production hosting 2026-10-21 ~11:20 after Cindy GO. Live was 9.9.395. Now https://cch-platform.web.app Studio 9.9.399. Functions not deployed. No commit. No money rewritten.

The same production deploy shipped WO-312, WO-313, and WO-314 (Client chat title, white label, button to the left of Pepper). Other platform files matched what was already live.

## Later the same day

WO-316. Orders that need you called confirmed and paid POs drafts because the old status field still said draft. Email is not required. Staging Studio 9.9.400 at ~16:15. Production still 9.9.399 until a GO.
