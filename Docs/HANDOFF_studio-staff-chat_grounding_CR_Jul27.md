# HANDOFF — Studio staff chat grounding (Fable option B) — Jul 27 2026

**Source decision:** `FABLE_DECISION_studio-staff-chat_CW_Jul27_v1.0.md` (Cindy/Fable — not found yet under `C:\dev\CCH-Platform-Deploy\cch-deploy` or Dropbox search; paste/copy into `Docs/` when available.)

**This file:** grounding only — ready for numbered WO after Cindy confirms the two open decisions.

---

## Grounding answers (the two gaps)

### 1) Bugs threaded UI — reusable or tangled?

**Tangled into bug-report logic — do not extract as-is.** Parallel component is the right call (faster and safer).

Evidence (`platform/cch-bugs-requests.js`):

| Piece | Why it's bug-specific |
|-------|------------------------|
| Data path | `feedbackRequests/{id}/messages` — per-request threads, not one firm thread |
| `fbRenderThreadModal` (~677–728) | Status / Priority selects, type icons, Fix-It assistant bubbles, `fbPostAssistantAck` |
| Unread | Per-request `unreadBy.owner` / `unreadBy.vanessa` on each feedback doc |
| FAB / panel | Bugs composer + recent *requests* list, not a continuous chat |

**Reusable patterns to copy (not share as a module yet):**
- Bubble CSS classes `.cch-fb-bubble` / mine|theirs|assistant
- Role helpers `fbMyRole` / `fbOtherRole` / `unreadBy` shape
- Nav badge inject next to Bugs (`cchFbNavBadge` at `index.html` ~3422)

**Build implication:** new `cch-staff-chat.js` (or similar) + `internal/staffChat/…` — mirror bubble UX, do not refactor Bugs.

### 2) Activity mirror shape

Canonical writer: `logActivity()` at `platform/index.html` ~78646–78669:

```
type, action, description, projectId, projectName,
user, timestamp (ISO), createdAt (ISO), meta: {}
```

Also: `logActivity` auto-posts to **Teams** when webhooks are set — staff-chat mirrors must either skip `logActivity` and write a quieter add, or use a type that Teams routing ignores / pass a meta flag and teach `logActivity` to skip Teams.

**Client bleed risk (confirm your open decision):**

- **Client portal** (`client.html` ~8467): loads `activity` where `projectId == …` with **no `clientSafe` filter** in that load path — a tagged mirror with that projectId **can show on the client portal timeline** unless filtered or never written for portal consumers.
- **Studio Client activity panel** (`cch-client-activity.js` `caIsClientDoc` ~54–60): treats `type === 'message'` as client activity. **Do not** use `type: 'message'` for staff mirrors.
- Safe mirror recipe (recommended):
  - `type: 'staff_chat'` (or `internal`)
  - `action: 'note'`
  - `meta: { source: 'staff_chat', staffOnly: true, clientSafe: false }`
  - Filter portal + Client-activity panel to exclude `meta.source === 'staff_chat'` / `staffOnly`
  - Prefer **admin Overview Recent Activity** only; do not rely on “client won’t notice”

---

## Cindy open decisions — CONFIRMED Jul 27

| Decision | Locked |
|----------|--------|
| Unsend / delete messages | **No** — append-only |
| Tagged msg never client-facing | **Yes** — `type: staff_chat` + `meta.staffOnly` + portal/Client-activity filters |

**Numbered WO:** `loop/WO-063_studio-staff-chat_CR_Jul27.md` · **FT-018** · ledger OPEN.

## Cindy open decisions (from Fable doc) — superseded

| Decision | Grounding note | Suggested default |
|----------|----------------|-------------------|
| Unsend / delete messages | Standing no-delete / financial-doc discipline | **No unsend** — append-only |
| Tagged msg never client-facing | Portal loads project activity unfiltered today | **Confirm staffOnly + type not `message` + portal filter** before ship |

---

## Firestore / rules (pre-WO)

- No `internal/` or `staffChat` rules today (`firestore.rules` has `feedbackRequests` ~397).
- New match required: auth + studio-team only (reuse `isFeedbackTeam()` / email allowlist pattern).

---

## Suggested WO shape (after confirm)

1. Schema: `internal/staffChat/messages/{id}` (or single room doc + `messages` subcollection) — one firm thread  
2. Optional `projectId` / `projectName` on message  
3. On send with tag: write activity mirror with `staffOnly` recipe above  
4. UI: sidebar nav + badge next to Bugs (not a second FAB)  
5. Pure Firestore — no Anthropic  
6. Staging first; prod on Cindy GO  

**Not started** — awaiting doc in repo + Cindy confirm on unsend + client bleed.
