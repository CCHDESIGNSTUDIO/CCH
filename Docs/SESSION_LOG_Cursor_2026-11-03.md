# Session Log — Cursor: invoice Simple or Itemized

**File:** SESSION_LOG_Cursor_2026-11-03.md
**Created:** Nov 3, 2026
**Workspace:** `C:\dev\CCH-Platform-Deploy\cch-deploy`

## Session overview

Cindy wants two client invoice looks, with easy switches. WO-403. Studio 9.9.480. Staging deploy is the next step. Production needs her GO.

## What changed

- Simple is the short letter (INV-6071): service name and hours, one total.
- Itemized is the line table. No service-period line. No “N hours — design services”. Qty is the hours. Show notes stays.
- Saved AI summary is shown on the itemized invoice and is no longer expanded back into one row per time entry on save.

## Not deployed to production

Production hosting 2026-11-03 12:26 after her GO. Live Studio 9.9.480. No commit.

## Verify

Hard refresh. Open a time invoice. Client display: Simple, Itemized, Show notes, Show hours, Show date. Print each.
