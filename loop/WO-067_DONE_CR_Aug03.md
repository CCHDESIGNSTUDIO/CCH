# WO-067 DONE — Invoice Client Summary: summarize + CCH voice · Cursor Aug 03

**State:** DONE-UNVERIFIED (Claude staging verify) · **Prod:** Cindy GO only  
**Note:** Drafted as “WO-065” in chat; ledger number is **067** (065 = Design Board heal).

## Grounding (file:line)

| Finding | Evidence |
|---------|----------|
| Dump cause = render preferred Manage `+ Notes` over AI prose | `cch-invoice-redesign.js` `_outcomeFromLine` previously `notesBody \|\| o.description` (~226–228 old) |
| AI path = `draftInvoiceSummary` | `Functions/aiInvoiceSummary.js` + `Functions/index.js:3850` |
| Voice sanitizer thin (unchanged) | `Functions/cchVoiceProfile.js` — not edited |
| Period “January 2026” = `periodShort` took first word of full range | `_ctx` + old `period.match(/^[A-Za-z]+/)` fallback; min date Jan 13 |

## Changes

### 1. `Functions/aiInvoiceSummary.js`
- Added `buildCchInvoiceVoicePrompt()` (WO voice block: summarize, Gear 1 Hi, ban agency-speak, no raw lists).
- User message: “Summarize. Do NOT return a bullet list…”
- `max_tokens: 1400`; still ends with `voice.sanitizeInvoiceDraft` (unchanged sanitizer).

### 2. `platform/cch-invoice-redesign.js`
- `_outcomeFromLine`: **AI / `clientOutcomes[].description` wins**; never dump `_lineNotesBody` on Client View. Short `it.description` only if ≤3 lines / &lt;280 chars.
- `cchServicePeriodShortLabel` + `_periodShortFromYmd`: multi-month span; if span ≥3 months and start day ≥10, drop leftover first month (Jan 13–Mar 31 → **February – March 2026**). Optional override: `docData.servicePeriodLabel`.
- Draft with AI passes **short** period hint to the model.
- Hours / rates / totals / DS expense layout: untouched.

### 3. `platform/index.html`
- `CCH_BUILD` **9.9.80** / `wo067-invoice-summary-voice-2026-08-03`
- Cache bust: `cch-invoice-redesign.js?v=20260803wo067`

## Self-test
- `node --check` on `cch-invoice-redesign.js` and `Functions/aiInvoiceSummary.js` — OK.

## Staging verify (Claude)
1. Deploy **functions:draftInvoiceSummary** + hosting (staging).
2. DS invoice with fat month → Draft with AI → Save → Client View.
3. Outcomes = short prose, not raw notes; Cindy voice; no em dashes; period short ≠ earliest-month-only.
4. Screenshots → `loop/verify/WO-067/`.

## Deploy
Queued in `_DEPLOY_QUEUE.md` — staging. Prod only on Cindy typed GO.
