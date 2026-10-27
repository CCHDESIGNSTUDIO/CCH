# WO-287 DONE — Clipper retail, Repeat email, login mix, Vanessa folder

**State:** DONE-UNVERIFIED  
**Executor:** Cursor  
**Date:** 2026-10-07  
**Target:** Clipper sideload **3.9.59** (not Firebase hosting). Synced to Vanessa’s CCH Studio Documents folder.

## Symptom (Cindy)

Pottery Barn Lit Rattan Stag: Retail **$750** while trade is **$49.50**. `cindy@cchdesign.com` in Vertical Repeat. Login sometimes says Cindy, sometimes Vanessa. Clipper updates not reaching Vanessa’s shared folder (she was on **3.9.56**; DEV was **3.9.58**).

## Grounding

- `exPageTradeRetailPrices` (`sidebar.js` ~3598) used the **largest $ on the page** as retail when no MSRP label. PB pages have many prices.
- Repeat inputs had no `autocomplete=off`; emails were sanitized only for Finish/Retail, not `fPatternV`.
- `CCH_GET_FIREBASE_ID_TOKEN` (`background.js` ~78) took the **first** open Studio tab. Cindy and Vanessa tabs in one Chrome flipped the saved login.
- `SYNC-TO-SHARED.ps1` failed to parse (smart quotes / here-string), so 3.9.57–3.9.58 never copied.

## Change

`cch-clipper/CCH-Studio-Clipper-v32` — **3.9.59**

- Retail only from a labeled MSRP/retail/list price. Drop the largest-$ fallback. Reject retail > 8× cost.
- Strip emails from Repeat / SKU / Finish / Dims. Autocomplete off on those fields.
- Token pull prefers the stored email. Auto-refresh will not switch Cindy ↔ Vanessa. Header shows **Cindy** or **Vanessa**. Pull login still switches on purpose.
- Rewrote `SYNC-TO-SHARED.ps1`. Ran it: shared folder is **3.9.59**.

## Verify

1. Cindy: `chrome://extensions` → Reload CCH Studio Clipper → card **3.9.59**. Header `v3.9.59 · … · Cindy`.
2. Reopen the PB stag: Cost ~$49.50, Retail **blank** (not $750). V Repeat **empty** (not an email).
3. Vanessa: wait for OneDrive, Reload from `CCH Studio - Documents\Clipper\CCH-Studio-Clipper-v32`, confirm **3.9.59** and header **Vanessa**.
