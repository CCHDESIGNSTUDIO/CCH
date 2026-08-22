# WO-025 DONE · Fix-It AI first-responder in Bugs & Requests · CR Jul 13

**State:** DONE-UNVERIFIED (production)  
**Staging:** https://cch-platform-staging.web.app  
**Production:** https://cch-platform.web.app (deployed Jul 14, 2026)  
**Cache bust:** `cch-bugs-requests.js?v=20260713fb5`

## Grounding

- WO-017 built threaded `feedbackRequests` + static template ack (`fbAssistantAckText`)
- WO-025 replaces first-response with LLM guide + triage via `cchFixItBot` Cloud Function

## Shipped

### Cloud Function `cchFixItBot` (`Functions/cchFixItBot.js`)
- Callable, team-only (Cindy + Vanessa emails)
- Reads thread + request context from Firestore (admin SDK)
- Anthropic `claude-sonnet-4-6` with `Functions/cchFixItKnowledge.js` (trimmed from `Docs/KNOWN_ISSUES.md`)
- CCH voice sanitize (no em dashes, no agency-speak)
- Posts `authorRole: 'assistant'` message as **CCH Fix-It**
- Updates request: `lastMessage`, `unreadBy`, `fixItClassification`, `fixItSuggestedPriority`, `fixItEscalate`
- Triggers: `new` (first response), `reply` (after Vanessa follow-up)

### UI (`platform/cch-bugs-requests.js` fb5)
- New reports → call `cchFixItBot` first; static ack fallback if LLM fails (report never lost)
- Vanessa thread replies → bot follow-up (`trigger: reply`)
- Backfill `fbEnsureAssistantAcks` stays **static only** (no LLM batch on page load)
- FAB/panel rebranded **CCH Fix-It**

## Verify (Cowork / Cindy on production)
1. Hard refresh https://cch-platform.web.app → 💬 FAB → submit a bug (e.g. "Room board decline won't stick")
2. Thread opens with **CCH Fix-It** reply: workaround steps or escalation note (not generic template only)
3. Vanessa reply in thread → second Fix-It response with follow-up help
4. If LLM down: static fallback ack still posts

## Scope (v1)
- Guide + triage only — no data changes, no QB/Firestore writes from bot
- Safe in-app actions = Phase 2 (per WO-025 spec)

## Production deploy (Jul 14, 2026)
- `firebase deploy --only hosting:platform --project cch-design-boards`
- `firebase deploy --only functions:cchFixItBot --project cch-design-boards`
