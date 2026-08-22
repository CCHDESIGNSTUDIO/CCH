# WO-029 DONE · Wire CCH voice profile into invoice + bi-weekly AI writers · CR Jul 13

**State:** DONE-UNVERIFIED (staging)  
**Staging:** https://cch-platform-staging.web.app  
**Voice source:** `loop/CCH_VOICE_PROFILE_CW_Jul13.md`

## Grounding (located before edit)

| Writer | Location |
|--------|----------|
| Invoice narrative AI | `Functions/aiInvoiceSummary.js` → `draftInvoiceSummary` (exported `Functions/index.js:3819`) |
| Invoice UI trigger | `platform/cch-invoice-redesign.js` → `cchDsDraftWithAI` |
| Bi-weekly composer | `platform/cch-progress-updates.js` (manual editor; no AI before this WO) |

## Shipped

### Shared voice module
- `Functions/cchVoiceProfile.js` — system prompts, agency-speak kill-list, em-dash sanitizer
- `platform/cch-voice-profile.js` — browser mirror (`window.cchVoiceProfile`)

### Invoice narrative AI (WO-029 A)
- `draftInvoiceSummary` system prompt rewritten for Gear 1 Cindy voice: "Hi {First},", plain-spoken, bullets welcome, kill agency-speak
- Accepts `clientFirstName`, `clientName`, `greetingStyle`, `formalityGear` (Dear = Gear 2)
- Post-generation `sanitizeInvoiceDraft` strips em dashes + kill-list phrases
- `cchDsDraftWithAI` passes client name + greeting style from project; client-side sanitize

### Bi-weekly update AI (WO-029 B)
- New `Functions/aiProgressUpdate.js` → `draftProgressUpdate` callable
- Editor **✨ Draft with AI** button (`cpPuDraftWithAI`) fills greeting body, highlight, in-progress rows
- New-update defaults from `progressUpdateVoiceDefaults()` (Hi Tracey pattern, per-project `progressUpdateGreetingStyle` / `clientGreetingStyle`)
- Seed copy updated to Gear 1 voice (no em dashes)

## Cache busters
- `cch-voice-profile.js?v=20260713voice1`
- `cch-progress-updates.js?v=20260713pu17`
- `cch-invoice-redesign.js?v=20260713ds13`

## Deploy (staging)
- Hosting: `firebase deploy --only hosting:platform --project cch-studio-staging`
- Functions: full functions deploy (includes `draftInvoiceSummary` update + new `draftProgressUpdate`)

## Verify (Cowork / Cindy)
1. **Invoice:** Rolling Hills design-services invoice → Manage → ✨ Draft with AI → "Hi {First}," summary, plain bullets, no em dashes, no agency-speak
2. **Bi-weekly:** + New Bi-Weekly Update → ✨ Draft with AI → Gear 1 greeting + highlight
3. **Per-client dial:** set `progressUpdateGreetingStyle: 'dear'` on board → invoice/bi-weekly default to Dear / Gear 2

## Not on production
Invoice AI runs in production today — **Cindy GO required** for functions + hosting deploy to `cch-design-boards`
