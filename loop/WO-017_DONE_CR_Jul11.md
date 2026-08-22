# WO-017 DONE · Bugs & Requests functional · Cursor · Jul 11, 2026

**Change ID:** pending #1 assign · **State:** DONE-UNVERIFIED · **Executor:** Cursor · **Verifier:** Claude (Cowork)

## Delivered

| File | What |
|------|------|
| `platform/cch-bugs-requests.js` | Build `20260711fb1` — FAB + inbox panel, threaded chat modal, unread badges (nav + FAB), legacy `response` → messages migration, role-keyed `unreadBy` |
| `platform/index.html` | Nav badge `#cchFbNavBadge`; removed disabled auto-responder + `autoRespondToFeedback`; list rows open thread; `saveFeedbackRequest` seeds thread fields + first message; script tag `cch-bugs-requests.js?v=20260711fb1` |
| `firestore.rules` | `isFeedbackTeam()` + `feedbackRequests/{id}/messages/**` read/write for Cindy/Vanessa emails |

## Behavior

1. Floating 🐛 button (studio routes only) → inbox or quick Bug/Feature composer with auto-captured `context`.
2. Full page `#/feedbackrequests` — click row → same thread modal; Last message column + unread left border.
3. Threaded replies in `feedbackRequests/{id}/messages`; `unreadBy.owner` / `unreadBy.vanessa` on send.
4. Legacy `response` fields migrate to first thread message (idempotent).
5. Priority editable owner-only in thread; Vanessa view-only.
6. No `prompt`/`alert` in feedback flow (`cchAlert` / thread UI).

## Verify (Claude, staging)

- Submit bug from dashboard FAB; doc has `context`, `createdByRole`, `lastMessage`, first message in subcollection.
- Reply from full page thread; other role sees unread badge on nav + FAB.
- Existing 25 requests still list; legacy responses appear as first message.
- FAB absent on `#/clientview/…` routes.
- `node --check platform/cch-bugs-requests.js` passes.

## Deploy

**Staging deployed Jul 11, 2026** — `hosting:platform` + `firestore:rules` on `cch-studio-staging`.
Build: `cch-bugs-requests.js?v=20260711fb2` (post-submit opens thread modal).

**Production (this feature):** awaiting Cindy GO — WO-017 is a **feature**, not a simple bug fix.

## Deploy policy (Cindy Jul 11)
- **Simple bugs** reported here (e.g. invoice print footer) → fix the underlying code → **ship fix to prod**; do not gate on WO-017/022 feature deploy.
- **Features** (chat widget, AI assistant per WO-022) → staging first → Cindy GO for prod.

## Open items
- Role-split badges require Vanessa to sign in under her own email (or future in-app role selector).
- WO-022: AI chat bot pop-up (see `loop/WO-022_bugs-requests-ai-chat_CW_Jul11.md`).
