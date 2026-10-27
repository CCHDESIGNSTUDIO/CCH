# Session Log — Cursor: Invoice open pay bar (#4 QB)

**File:** SESSION_LOG_Cursor_2026-08-15.md  
**Original Author:** Cursor (CR) #4 QuickBooks  
**Created:** August 15, 2026  
**Last Modified:** August 15, 2026  
**Last Modified By:** Cursor  
**Version:** 1.1  

**Workspace:** `C:\dev\CCH-Platform-Deploy\cch-deploy`  
**Primary paths:** `platform/cch-square-pay.js`, `platform/cch-invoice-redesign.js`, `platform/cch-proposals-invoices-fix.js`, `platform/index.html`, `platform/client.html`  
**Firebase staging:** `cch-studio-staging` → https://cch-platform-staging.web.app  
**Firebase production:** `cch-design-boards` → https://cch-platform.web.app  

## Session overview

Cindy confirmed: if a client has several invoices open, pay buttons should be on the **opened invoice** (not only the list) so they can see the document and pay from there.

**Later same day:** Open still showed legacy preview; Pay relaunched portal sign-in; CC and Zelle both went to Zelle. Fixed and shipped staging **9.9.201**.

## What changed

| File | Change |
|------|--------|
| `platform/cch-square-pay.js` | Pay bar calls `opener.cchPayNavigateFromDoc` (no `client.html?pay=` reload). Chooser: CC=Square only. |
| `platform/cch-invoice-redesign.js` | Portal Open hides Show date/hours/rate toggles. |
| `platform/cch-proposals-invoices-fix.js` | Portal Open hides print-hint + admin display toggles; filters Vendor bill variances from Terms. |
| `platform/client.html` | Loads premium print modules (`cch-invoice-redesign` + `cch-proposals-invoices-fix`). |
| `platform/index.html` | `CCH_BUILD` **9.9.201**; cache `sq15` / `pay2`. |

**Grounding:** Staging portal is `client.html` (index redirects `#/clientview`). Open used `_previewDocumentOriginal` until premium scripts loaded. Pay onclick ran in about:blank popup — must use `window.opener`.

## Not deployed / needs GO

- **Staging hosting:** done **9.9.201** (~12:01).
- **Production:** needs Cindy typed **GO**.
- Visiting Zelle page still does **not** mark Paid (no Zelle webhook).
- Square webhook in Developer Console still not configured by Cindy.

## Open items

- Production Square token + hosting after GO.
- If Dashboard card rate is 2.9%+30¢ not 3.3%, change `SQUARE_CARD_FEE_RATE` in `Functions/squarePaymentLink.js`.

## Verify (staging **9.9.201**)

1. Hard refresh: Ctrl+Shift+R on https://cch-platform-staging.web.app
2. Sidebar build tag **9.9.201**
3. Portal → Invoices → **Open**: navy/gold print (not legacy RETAIL table)
4. From Open → **Pay**: stays signed in → CC/Zelle chooser (no welcome screen)
5. **Pay with CC**: Square only if `squareCheckoutUrl` exists; else message (not Zelle)
6. Print / PDF: pay bar hidden
