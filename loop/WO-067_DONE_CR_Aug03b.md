# WO-067 DONE (re-attempt after verify fail) — Cursor Aug 03b

**State:** DONE-UNVERIFIED · **Target:** staging · **Build:** v9.9.86

## Verify-fail symptoms (Fable / Cindy)

1. Voice still agency-speak after Draft with AI  
2. AI redraft overwrote hand-shortened outcomes  
3. Pure DS / hours invoice showed Sales tax (~$3.56)

## Grounding → fix

| Fail | Evidence | Change |
|------|----------|--------|
| Voice | `Functions/aiInvoiceSummary.js` prompt; sanitize in `cchVoiceProfile.js` | Stronger BAD/GOOD + bans (sharper focus, lit with intention, pivotal phase…); `temperature: 0.35` |
| Overwrite | `cch-invoice-redesign.js` `cchDsDraftWithAI` ~970 replaced all rows | `_dsMergeAiDraft` — non-empty human fields win; AI fills empties only |
| Tax | `invoiceTotalsBreakdown` + Client View `_grand` / `_totalsBlock` | Pure DS (`cchIsPureDesignServicesInvoice`): tax=0, skip storedTotal drift that re-adds phantom tax; Client View `_forceDsNoTax` |

## Files touched

- `Functions/aiInvoiceSummary.js` — prompt + temperature  
- `Functions/cchVoiceProfile.js` — AGENCY_SPEAK_PATTERNS  
- `platform/cch-invoice-redesign.js` — `_dsMergeAiDraft`, `_forceDsNoTax`, draft merge  
- `platform/index.html` — `invoiceTotalsBreakdown` pureDs; CCH_BUILD 9.9.86; `?v=20260803wo067b`

## Self-test

- `node --check` on all three JS files — OK  
- Fee amount untouched in code (no hardcode of $3,885)

## Staging verify

1. Hard refresh staging → build tag **v9.9.86**  
2. Pure DS invoice Client View: **no Sales tax** line; total = fee (not fee+tax)  
3. Shorten an outcome by hand → Draft with AI → toast “Kept your edits…”; your text still there  
4. Empty summary/outcomes → Draft with AI → fills; voice should be casual Cindy, not brochure  
5. Product invoice still taxes product lines (regression check)
