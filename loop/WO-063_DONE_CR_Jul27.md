# WO-063 DONE — Cursor · Jul 27, 2026

**State:** DONE-UNVERIFIED (staging pending deploy)  
**Change ID:** FT-018 · **Build:** `cch-staff-chat.js?v=20260727sc1` · CCH_BUILD **v9.9.20**

## Grounding cited

| Item | file:line |
|------|-----------|
| Bugs thread tangled | `cch-bugs-requests.js` `fbRenderThreadModal` ~677 |
| Activity shape | `index.html` `logActivity` ~78646 |
| Client activity filter | `cch-client-activity.js` `caIsClientDoc` |
| Portal safe filter | `client.html` / `index.html` `_cpClientSafeActivity` |
| Team rules helper | `firestore.rules` `isFeedbackTeam` ~17 |

## What changed

| File | Change |
|------|--------|
| `platform/cch-staff-chat.js` | **NEW** — one firm thread, project tag, quiet activity mirror, nav badge |
| `platform/index.html` | Nav + route `staffchat`, script tag, CCH_BUILD 9.9.20, portal filter |
| `platform/client.html` | `_cpClientSafeActivity` excludes staff_chat |
| `platform/cch-client-activity.js` | `caIsClientDoc` excludes staffOnly / staff_chat (cache ca2) |
| `firestore.rules` | `internal/staffChat` + append-only `messages` |

## Self-test
- `node --check` on `cch-staff-chat.js` + `cch-client-activity.js` — OK
- Did **not** call Anthropic; no Pepper FAB conflict
- Messages: create allowed, update/delete denied in rules

## Verify (after staging deploy)
1. Ctrl+Shift+R → sidebar **v9.9.20** + **Staff chat** under Bugs
2. Send message → other role sees orange badge
3. Tag a project → admin activity shows `Staff chat · …`
4. Client portal activity — no staff text
5. Rules: delete message denied

## Deploy
Queue: staging hosting + `firestore:rules` (both staging and note prod rules separately on GO).
