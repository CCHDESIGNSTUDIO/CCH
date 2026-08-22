# WO-022 · Bugs & Requests — pop-up AI chat assistant · CW Jul 11
**Change ID:** pending #1 assign · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
**Extends:** WO-017 (`feedbackRequests` + `messages` — do not rebuild)

## Cindy rulings (Jul 11, 2:25 PM)
1. **Both Cindy and Vanessa** use the chat — same access as WO-017 team submitters.
2. **Features → Cindy final call on prod.** New capability (AI assistant, UX overhaul) ships staging first; prod only on explicit GO.
3. **Simple bugs → fix in production without changing the platform.** A reported bug like “invoice footer wrong on print” is a **code fix to existing behavior**, not a feature rollout. Fix the bug, deploy the fix to prod — no feature flag, no waiting on WO-022.

## What WO-017 delivered vs this WO
| WO-017 (staging, fb2) | WO-022 (this) |
|----------------------|---------------|
| Human thread between owner/Vanessa | **AI assistant** in the pop-up |
| FAB + modal | **Persistent chat panel** (Intercom-style) |
| Manual triage | Bot **acks instantly**, asks follow-ups, classifies bug vs feature |

## Bot behavior (draft)
- **On submit:** immediate assistant message (“Got it — logged as Bug · Invoices · printing…”).
- **Follow-up:** 1–2 clarifying questions (which invoice, steps, screenshot Phase 2).
- **Classify:** `type` Bug vs Feature; suggest `priority` / `module` from `context`.
- **Messages:** `authorRole: 'assistant'` in existing `messages` subcollection.
- **Human override:** Cindy can reply in-thread; bot does not block human responses.
- **Deploy path suggestion in thread:** simple bug → “fix ships to prod”; feature → “staging for review”.

## Technical (reuse existing patterns)
- UI: extend `cch-bugs-requests.js` (not new collection).
- AI: prefer Cloud Function (like `draftInvoiceSummary`) — avoid browser API keys for assistant.
- Firestore: extend rules for `authorRole: 'assistant'` writes from function or trusted client path.

## DO NOT
- Block simple bug fixes behind this feature or staging-only gate.
- Create `platformFeedback` or parallel schema.
- Expose to client portal.
- Auto-deploy features to prod without Cindy GO.

## Acceptance (when built)
1. Vanessa or Cindy opens 🐛 chat → submits → **bot replies in-panel within 2s** (or graceful fallback).
2. Thread shows user + assistant bubbles; full page `#/feedbackrequests` stays in sync.
3. Simple bug report does not require WO-022 on prod to ship the **fix** for that bug.
4. Feature-classified items note “staging review” in thread; prod feature deploy waits on Cindy GO.

## Phase note
WO-017 human thread remains; WO-022 adds assistant layer. Can ship assistant ack (static template) before full model hook.
