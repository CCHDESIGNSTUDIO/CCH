# Session Log — Cursor: Add Item search, PO Vendor col lock, Houzz PO open

**File:** SESSION_LOG_Cursor_2026-07-25.md  
**Created:** July 25, 2026  
**Author:** Cursor  

## Overview

Cindy blocked on Add Item search (Stone West), PO Edit showing redundant Vendor column, and Houzz clip POs not opening. Staging shipped; production needs GO.

## What changed (code)

| Build | Change |
|-------|--------|
| v9.8.112 | Add Item full catalog (6000 newest-first) + soft-OR search fallback |
| v9.8.113 | PO Edit + original preview: **no per-line Vendor column** |
| v9.8.114 | Houzz `clip-po-*` # click **navigates/opens** (was expand-only); encode PO ids in hash |
| v9.8.115 | **WO-061** Design Board: gate/prune stale `clipId` sync — stop "No document to update" flood |
| v9.8.116 | Design Board **Hide Library / Properties** hard-collapse (panels vanished, not shrink) |
| v9.8.117 | Panel hide: **DOM-driven** toggle (fixes click-twice / localStorage desync); no auto-fit |

**Lock:** `.cursor/rules/cch-po-edit-layout-lock.mdc` + pointer in `cch-studio.mdc` + LOCKED comment in `docEditRenderItems`.

## Deploy

- Staging: 9.8.112–9.8.114 hosted  
- **Production:** done 2026-07-25 ~14:25 (Cindy GO) — https://cch-platform.web.app v9.8.114

## Not deployed / needs GO

- Production hosting for v9.8.114 bundle (PO Vendor hide + Houzz open; includes prior search fix if not already on prod)
- Builder ft020–ft022 prod GO (earlier queue)

## Verify (staging)

1. Ctrl+Shift+R → sidebar **v9.8.114**
2. PO Edit (e.g. Bugletrail PO-9003): no Vendor column; Bill To still shows vendor
3. Project with Houzz-only PO: click PO # → opens (materializes if needed)
