# Session Log — Cursor: Production bill close, then staging portal records

**File:** SESSION_LOG_Cursor_2026-10-16.md
**Created:** Oct 16, 2026
**Workspace:** `C:\dev\CCH-Platform-Deploy\cch-deploy`

## Overview

Production Studio **9.9.390** (`copy-all-images`) is live from the later GO (~14:40). Hosting and Firestore rules. Functions not deployed. No commit. The earlier 9.9.387 bill close is still in this build.

Staging then got the three portal features as Studio **9.9.388** (`portal-records`) at ~12:11. Staging hosting and staging Firestore rules. Production was not deployed again.

## Production (already live, needs a hard refresh)

- WO-301 — Edit bill closes on Save. X on the bill. QuickBooks question after the bill closes.
- WO-300 — PO corner Bill total and Balance due include pre-paid tax when that amount is on the bill.

## Staging (9.9.388) — not on production

- WO-302 Meeting notes. Draft until publish. Staff notes are a separate collection.
- WO-299 Checklist. Button on a posted decision. Not automatic.
- WO-303 Chat button on the portal. Project thread, not staff chat.

## Not deployed

- Functions.
- Production hosting of 9.9.388.
- WO-304 and WO-305 shipped to production 2026-10-16 ~14:40 on Cindy's GO. Studio 9.9.390 `copy-all-images`. Hosting plus Firestore rules. Functions not deployed. Portal Checklist, Meeting notes, and Chat went live in the same file. No commit.
- No git commit.

## Verify

- Production: https://cch-platform.web.app hard refresh. No staging banner. 9.9.387. Edit bill has an X.
- Staging: https://cch-platform-staging.web.app hard refresh. Orange STAGING banner. 9.9.388. Portal sidebar: Checklist, Meeting notes, and Chat.
