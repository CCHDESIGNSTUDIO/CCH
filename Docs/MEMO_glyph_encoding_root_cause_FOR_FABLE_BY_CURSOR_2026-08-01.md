# Why CCH Studio shows `?` instead of icons — root cause for Fable

**Date:** 2026-08-01  
**Author:** Cursor (for Cindy → Fable)  
**Code:** `platform/index.html` (~5 MB, single-file app)

## What Cindy sees

Menus, sort arrows, warnings, list/grid toggles, and empty-state icons appear as a literal **question mark** (`?`) or a broken diamond `` (U+FFFD). Room Boards collapse/sort and some PO chrome were fixed earlier (v9.9.64–66). A full heal landed as **v9.9.69**.

## Root cause (one sentence)

**UTF-8 glyphs in `index.html` were re-saved through a Windows ANSI/cp1252 (or “strip non-ASCII”) write path, so multi-byte characters were replaced with ASCII `?` or U+FFFD. Once replaced, the original symbol cannot be recovered from the file.**

## Why this file is fragile

1. **One giant HTML/JS file** with thousands of UI strings.
2. Agents and tools on Windows often default to **cp1252** for stdout/file writes unless forced to UTF-8.
3. Icons were stored as **literal Unicode** in source (`⋮`, `▸`, `⚠`, emoji). Those are multi-byte in UTF-8. A bad encode turns them into `?`.
4. Partial passes fixed a few screens; the rest stayed corrupted until a bulk heal.

This is **not** a CSS bug and **not** Firestore. It is **source-file encoding damage**.

## The easy lasting fix (what we want going forward)

| Do | Don’t |
|----|--------|
| Put icons in JS as **`\\uXXXX` escapes** (ASCII-safe source) | Paste raw `⋮` / emoji into `index.html` strings |
| Use a small map (`window.CCH_UI`) for shared glyphs | Scatter one-off Unicode literals |
| Write the file as **UTF-8** every time | Let PowerShell/`print`/editors re-encode as ANSI |
| Run a scanner for `>?</` and U+FFFD before ship | Whack-a-mole after Cindy screenshots |

`window.CCH_UI` was added in v9.9.69 as the shared ASCII-safe map. Heal scripts live under `_debug/heal_glyph_*_BY_CURSOR.py` for re-runs.

## What agents must tell each other

> **Never write `platform/index.html` except as UTF-8. Prefer `\\u` escapes for every UI glyph. If you see `?` where an icon belongs, treat it as encoding corruption — do not invent new UX around the question mark.**

## Verify after deploy

1. Hard refresh prod/staging — build **v9.9.69**
2. Projects list: List/Grid toggles are icons, not `?`
3. Files & Docs: kebab is ⋮
4. Room Boards / Inspiration: collapse and ⋮ menus intact
5. Tasks: status icons not `?`
6. Smart Time: unlogged / mark-logged show ⚠ / ✓ not `?`
