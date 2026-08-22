# WO-063 · Studio staff chat (one firm thread) · CR Jul 27
**Change ID:** FT-018 · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)  
Staging first; prod on Cindy GO. Pure Firestore — **no Anthropic / no Pepper cost.**

## Why / what Cindy asked
Option **B** (vs Teams-only ping): Cindy + Vanessa chat **inside Studio**, one running thread (not per-project channels). Decision: Fable `FABLE_DECISION_studio-staff-chat_CW_Jul27_v1.0.md` + Cindy confirm Jul 27. Grounding: `Docs/HANDOFF_studio-staff-chat_grounding_CR_Jul27.md`.

## Locked decisions (Cindy, Jul 27)
- **One firm thread** — not per-project rooms.
- **Optional project tag** on a message — mirrors into that project's **admin** activity only.
- **Unread badge** in sidebar next to Bugs & Requests — **not** a second floating widget stacked on Pepper.
- **No unsend / no delete** — append-only (standing no-delete).
- **Never client-facing** — tagged mirrors must not appear on client portal or Studio "Client activity" panel.
- **No LLM** — Firestore only.

## Grounding (do not re-guess)

| Topic | Finding | file:line |
|-------|---------|-----------|
| Bugs thread UI | **Tangled** — Status/Priority/Fix-It/`feedbackRequests/{id}/messages`. **Parallel component**, do not extract Bugs. | `cch-bugs-requests.js` `fbRenderThreadModal` ~677–728 |
| Reuse patterns | Bubble CSS, `fbMyRole` / `unreadBy` shape, nav badge inject | same file; `index.html` `#cchFbNavBadge` ~3422 |
| Activity writer | `logActivity(type, action, description, projectId, projectName, meta)` → also **Teams**-posts | `index.html` ~78646–78669 |
| Client portal activity | Loads project `activity` **unfiltered** | `client.html` ~8467 |
| Client activity panel | Treats `type === 'message'` as client | `cch-client-activity.js` `caIsClientDoc` ~54–60 |
| Rules | No `internal/` yet; reuse `isFeedbackTeam()` | `firestore.rules` ~17–25, ~397 |

## Safe activity mirror recipe (required)
When a message has `projectId`, write **one** `activity` doc (quiet — **do not** call raw `logActivity` unless Teams is skipped):

```
type: 'staff_chat'
action: 'note'
description: short staff-only text (e.g. "Staff chat · Cindy: …")
projectId / projectName: from tag
user: author email
timestamp / createdAt: ISO
meta: { source: 'staff_chat', staffOnly: true, clientSafe: false, staffChatMessageId: <id> }
```

**Never** use `type: 'message'`.

Also patch filters:
1. `client.html` portal activity list — exclude `meta.source === 'staff_chat'` / `meta.staffOnly === true` / `type === 'staff_chat'`.
2. `cch-client-activity.js` `caIsClientDoc` — return false for staff_chat / staffOnly.
3. Prefer a small helper `logStaffChatActivity(...)` that writes the doc **without** Teams webhook side-effect (or extend `logActivity` with `meta.skipTeams: true`).

## Schema
```
internal/staffChat/messages/{messageId}
  text: string
  authorRole: 'owner' | 'vanessa'
  authorName, authorEmail: string
  createdAt: ISO string
  projectId?: string   // optional tag
  projectName?: string
  // NO deletedAt / unsend fields
```

Optional parent doc `internal/staffChat` (or `internal/staffChat/meta/room`) for:
```
lastMessage: { text, authorRole, at }
unreadBy: { owner: bool, vanessa: bool }
updatedAt: ISO
```

## Change (minimal)

### 1. New `platform/cch-staff-chat.js`
- Panel or page opened from sidebar nav (label e.g. **Staff chat**).
- Single scrollable thread + composer; optional project picker (tag only — does not change room).
- Live or poll refresh (Bugs uses poll — match that pattern unless onSnapshot is cleaner).
- Mark read when panel open; badge via `#cchStaffChatNavBadge` (new) next to Bugs.
- Reuse visual language of Bugs bubbles (navy/gold, sharp corners) — new CSS prefix `.cch-sc-`.

### 2. `platform/index.html`
- Nav item + badge span next to Bugs & Requests.
- Script tag `cch-staff-chat.js?v=…` + bump `CCH_BUILD` when shipping.

### 3. `firestore.rules`
```
match /internal/{docId} {
  allow read, write: if false; // if using subcollections only under staffChat
}
match /internal/staffChat/{docId} {
  allow read, write: if isFeedbackTeam();
  match /messages/{messageId} {
    allow read, create: if isFeedbackTeam();
    allow update, delete: if false; // append-only
  }
}
```
(Adjust path to match chosen schema; **delete must stay denied**.)

### 4. Portal + Client-activity filters (above)

## Constraints
- Do **not** modify `cch-bugs-requests.js` behavior except if sharing a tiny exported role helper is cleaner — prefer copy role/email helpers into staff-chat to avoid coupling.
- Do **not** add a second FAB on top of Pepper.
- Do **not** call Anthropic.
- Do **not** invent unsend UI.
- Staging first; queue `_DEPLOY_QUEUE.md` with **FT-018**.

## Verify (staging)
1. Cindy + Vanessa (or two browsers) open Staff chat — messages append in one thread.
2. Unread badge increments for the other role; clears on open.
3. Tag a message with a project → appears on **admin** project Recent Activity / firm Activity Feed.
4. Same project client portal — **no** staff chat text in activity.
5. Studio Client activity panel — **no** staff chat item.
6. Attempt delete in console/rules — denied.
7. Pepper FAB and Bugs FAB/nav still work; no stacking widget conflict.

## Out of scope
- Per-project channels, file attachments v1, @mentions, Teams bridge, edit/unsend.
