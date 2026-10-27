# Session Log — Cursor: PO Print Ship To, TAG, thumbs, margins

**File:** SESSION_LOG_Cursor_2026-08-30.md
**Original Author:** Cursor (CR)
**Created:** August 30, 2026
**Last Modified:** August 30, 2026
**Last Modified By:** Cursor (CR)
**Version:** 1.3

**Workspace:** `CCH-Platform-Deploy`
**Primary paths:** `loop/LOOP_LEDGER.md`, `_DEPLOY_QUEUE.md`, `loop/WO-162_DONE_CR_Aug30.md`
**Firebase:** **PRODUCTION + staging hosted 2026-08-30 ~16:58** — WO-162 / 9.9.305. No git commit.

## Revision history

- v1.3 (Aug 30 ~15:20, CR): **WO-162** PO Print EXIF thumbs. Studio **9.9.305**. Undoes WO-161 `image-orientation:none` that made slabs vertical slivers. Needs prod GO — PO-9045 is not on staging.
- v1.2 (Aug 30 ~13:15, CR): **WO-159** PO Print tag-once / title / whitespace. Studio **9.9.302**.
- v1.1 (Aug 30 afternoon, CR): Ledger back-fill WO-122–158. No platform code.
- v1.0 (Aug 30 morning, CR): PO Print Ship To / TAG / thumbs / margins as **9.9.300** (now **WO-157**). Staging hosted ~12:18.

## Session overview (v1.3)

Cindy on **prod** PO-9045 Chrome Print: thumbs still skinny vertical. Root: WO-161 `image-orientation:none` + `height:80px` showed the camera's raw portrait JPEG buffer. **WO-162** restores `from-image` + `height:auto`. **PO-9045 cannot be tested on staging.** Queued staging; production needs typed GO.

## What changed (v1.3)

| File | Change |
|------|--------|
| `platform/cch-proposals-invoices-fix.js` | PO Print thumbs `from-image`, height auto, 110px grid (`:5787–5789`, `:5814–5816`) |
| `platform/index.html` | CCH_BUILD 9.9.305; `?v=20260830poprint6` |
| `platform/client.html` | cache buster |
| `loop/WO-162_DONE_CR_Aug30.md` | DONE note |
| `_DEPLOY_QUEUE.md` | WO-162 pending staging |

**Not deployed.** Print lock: no same-session production GO. Type GO to put this on PO-9045.

## Session overview (v1.2)

Cindy on staging PO-9013 Print: tags still under ITEM, title still big, page still stretched. Root: `omitTag` hid the Tag *label* but description still printed L68; TAG column only read stored `lineTag`. **WO-159** splits description for PO Print only.

## What changed (v1.2)

| File | Change |
|------|--------|
| `platform/index.html` | `cchPoSplitPrintDescription`; specs omitTag uses rest only; CCH_BUILD 9.9.302; `?v=20260830poprint3` |
| `platform/client.html` | Same helper + cache buster |
| `platform/cch-proposals-invoices-fix.js` | TAG from split; title 11px/500; PO no 100vh stretch; Ship To 13/600 |
| `loop/WO-159_DONE_CR_Aug30.md` | DONE note |
| `_DEPLOY_QUEUE.md` | WO-159 pending staging |

**Not deployed.** Print lock: no same-session production GO.

## Verify (after #1 staging deploy)

1. https://cch-platform-staging.web.app — Ctrl+Shift+R — sidebar **v9.9.302**
2. PO-9013 Print: TAG **L68**; no gold DESCRIPTION dump of L68; title not huge
3. Invoice / proposal / tear sheet Print unchanged

## Open

- Production hosting still 9.9.299 until Cindy GO (not this WO)
- Hall Option stays as leftover option text under the title (not a second TAG)

---

# v1.0 — PO Print Ship To, TAG, thumbs, margins

Cindy printed **PO-9045** (Neolith / Cloud Rolling Hills). Ship To name looked small vs vendor; address was a gray caption; TAG (CT-04) printed under ITEM **and** in SIDEMARK; thumbs were 48px in print; left/top PDF margin was huge.

## What changed (local only)

Studio **9.9.300** `cch-proposals-invoices-fix.js?v=20260830poprint1`

| Issue | Grounding | Change |
|-------|-----------|--------|
| Ship To | `cch-proposals-invoices-fix.js` 5504–5519, CSS 5685–5686 | First line 16px/700 navy (same as Neolith). Address 13px navy, stacked. Split `·` even when city is already on a second line. |
| TAG twice | print `omitTag: true` at 5288–5289; helper `index.html` 9580 / `client.html` 3841 | Tag stays in SIDEMARK only. |
| Thumbs | print override 5794–5796 | PO print thumbs **64px** (was 48px). Invoice print unchanged. |
| Margins | PO `@page` 0.5in + drop 48px content pad 5785–5793 | Invoice `@page` 0.7/0.8in from 9.9.278 **unchanged**. |

**Later hosted on staging ~12:18 as WO-157 / 9.9.300.** PO Room/Tag columns are WO-158 / 9.9.301, not this build. Production still needs Cindy GO.

## Verify (after staging)

1. Ctrl+Shift+R — sidebar **v9.9.300**
2. Cloud Rolling Hills → **PO-9045** → Print / PDF
3. Ship To: **CLOUD - ROLLING HILLS** matches **Neolith** size/weight; street/city navy, not gray
4. TAG **CT-04** only in SIDEMARK, not under ITEM
5. Line photos ~64px, not stamps
6. Less empty band at top/left vs this morning’s print
7. Open an **invoice** Print — margins still the Aug 27 invoice layout

## Open / not this change

- Square pay links: do not cancel
- Invoice tax-in-total lock 9.9.299 already live
