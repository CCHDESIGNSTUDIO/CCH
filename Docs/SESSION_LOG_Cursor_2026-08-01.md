# Session Log — Cursor: Glyph encoding heal

**File:** SESSION_LOG_Cursor_2026-08-01.md  
**Original Author:** Cursor  
**Created:** August 1, 2026  
**Workspace:** `C:\dev\CCH-Platform-Deploy\cch-deploy`

## Overview

Cindy: fix every UI question mark; explain root cause for Fable. Bill work already verified on prod (v9.9.68).

## What changed

| Build | Change | Deploy |
|-------|--------|--------|
| v9.9.69 | Bulk heal: UI `?` icons → `\u` escapes; `window.CCH_UI` map; high-confidence U+FFFD chrome → ellipsis/dashes/× | **queued staging** |

**Scripts:** `_debug/heal_glyph_corruption_BY_CURSOR.py`, `heal_glyph_pass2_BY_CURSOR.py`, `heal_glyph_pass3_fffd_BY_CURSOR.py`, `heal_glyph_pass4_visible_BY_CURSOR.py`, `scan_qmark_glyphs_BY_CURSOR.py`

**Fable memo:** `Docs/MEMO_glyph_encoding_root_cause_FOR_FABLE_BY_CURSOR_2026-08-01.md` (+ Dropbox handoff copy)

## Counts after heal

- UI tag sole `>?` : **0**
- Remaining U+FFFD: mostly comments / regex mojibake detectors (not chrome icons)

## Not deployed

- Staging pending #1; production needs Cindy GO after staging smoke.

## Verify

1. Staging Ctrl+Shift+R → **v9.9.69**
2. Projects List/Grid, Files kebab, Tasks statuses, Inspiration ⋮, Smart Time warn/check — no `?`
