# SPEC — CMO / Client Experience Agent (CCH Studio v1.0)

**Version:** 1.0
**Status:** Spec for staging implementation
**Author:** Claude (drafted from Cynthia's requirements, May 27, 2026)
**Last revised by:** Claude — May 27, 2026 (initial draft)
**Implementer:** Cursor (next session)
**Target environment:** Staging first (`cch-studio-staging`). Production after Cynthia signs off.
**Parent spec:** `SPEC_Chief_Of_Staff_Agent_v1.0.md` — CMO Agent is a specialization of the COS pattern.

## Revision Log
| Date | Change | Revised By |
|---|---|---|
| May 27, 2026 | Initial spec — client engagement watchers, communications cadence, inspirations engagement, design-review suggestions, brand voice. | Claude |

---

## 1. Vision — the CMO who treats every client interaction as a gift

> *"Our Client Experience and market CMO."* — Cynthia, May 27, 2026

The CMO Agent (or Client Experience Agent — same role) is the **client-relationship intelligence layer** for CCH Studio. Where the CFO Agent watches money and the COS Agent watches operational flow, the CMO Agent watches **the client relationship**.

CCH Design's value is the gift-like, hand-crafted client experience. That experience falls apart in small ways — a client visits the portal 5 times in a week and gets nothing new to engage with, a project goes 18 days without communication, a beautiful design review milestone passes without invitation. The CMO Agent catches those gaps.

**North star: the CMO never lets a client feel forgotten.**

### What "never lets a client feel forgotten" looks like

| Trigger | CMO surfaces / acts |
|---|---|
| Client hasn't visited portal in 14+ days | "Bradbury hasn't logged in since May 13. Want to send a 'we just updated your inspirations' nudge?" |
| Client has logged in 5+ times in 7 days but no new content posted | "Cloud is checking in often — maybe they're hungry for an update. Draft a progress note?" |
| Client starred something on Inspirations | "Toyo Shimano starred 3 lighting clips this week — all from Visual Comfort. Worth flagging in your next design review." |
| Project approaching design milestone | "Holtz Hill design review is scheduled — Cindy, you usually send a teaser 5 days out. Want me to draft it?" |
| Proposal sent but not opened in 5 days | "PRO-3019 sent to Cloud 5 days ago, never opened. Standard escalation email ready?" |
| Project complete but no follow-up touch in 60 days | "Westridge Lane closed Mar 2026. Last touch was Apr. CCH usually does a 6-month check-in around now." |
| Holiday / season approaching | "Mother's Day in 2 weeks. CCH typically sends a curated lookbook to active clients. Draft list ready?" |

### The CMO's voice (uses `cch-ceo-coach` + `cch-marketing` + `cch-client-portal` + `elu-brand` skills)

- Warm, never transactional.
- Respects the Programa aesthetic (pure white, navy, sharp — no clutter).
- Brand voice: confident, understated luxury. Never salesy, never performative.
- Every client touch is "personal" — never feels like a mass-marketing automation.
- If something can't be said with warmth + specificity, it shouldn't be said.

---

## 2. Authority model (inherits from COS spec §2)

| Authority | CMO-specific examples |
|---|---|
| **Unilateral** | Read all communications, portal activity, inspirations engagement. Compose engagement scorecards. Write attention items. Compose drafts to Gmail Drafts folder. Suggest design-review timing. Audit brand consistency on outgoing docs. |
| **Auto-Approved** | Update `clientEngagementScore` in `agentMemory`. Suggest portal hero image rotation (saved as suggestion, not applied). Draft check-in emails saved to Gmail Drafts. Generate monthly client engagement report. |
| **Typed-GO** | Send any client-facing email. Publish any change to client portal (hero, content, inspirations). Add a client to a marketing list. Schedule a meeting on Cindy's behalf. |

Per CLAUDE.md AI Session Rule #7 — no client-facing send without typed GO.

**Critical: drafts only.** A CMO Agent that sends without approval will burn client trust. Every email lands in Drafts. Every portal change is staged for review.

---

## 3. Firestore schema (extends COS spec §3)

### 3.1 `attentionItems` — adds CMO-specific types

```js
{
  type:
    'client_silence' |              // active client, no message in N days
    'portal_overdue_content' |      // client visiting frequently, nothing new
    'portal_engagement_high' |      // client engaged — what did they love?
    'inspiration_starred' |         // client starred items recently — pattern detected
    'proposal_not_opened' |         // sent but not viewed
    'design_review_upcoming' |      // milestone approaching
    'client_completed_followup' |   // project done N+ days, no follow-up touch
    'season_outreach_pending' |     // holiday/season window approaching
    'brand_inconsistency' |         // outgoing doc doesn't match brand voice/aesthetic
    'milestone_passed_silent' |     // project hit a milestone, no client comm
    'birthday_anniversary' |        // client personal milestone
    ...
  cmoData: {
    clientName: string,
    projectId: string | null,
    lastTouchDate: ISOString | null,
    daysSinceLastTouch: number,
    engagementScore: number,        // 0-100, see §3.2
    relatedInspirations: [string],  // ideabook/clip IDs
    relatedDocs: [{ kind, ref }],
    suggestedTouchType: 'email' | 'message' | 'portal_post' | 'meeting' | 'gift',
  }
}
```

### 3.2 `clientEngagementScores` — rolling per-client metrics

`agentMemory/cmo/engagementScores/{clientNameSlug}`

```js
{
  clientName: string,
  projects: [string],          // project IDs
  scoreCurrent: number,        // 0-100, see formula below
  scoreTrend: 'rising' | 'flat' | 'falling',
  lastComputedAt: ISOString,
  signals: {
    portalLogins30d: number,
    portalLastLoginAt: ISOString | null,
    messagesFromClient30d: number,
    starredItems30d: number,
    proposalsViewed30d: number,
    invoicesPaidOnTime30d: number,
    lastStaffOutreachAt: ISOString | null,
    daysSinceLastStaffOutreach: number,
  },
  notes: string,                // CMO Agent observations
}
```

**Engagement score formula (v1):**
```
score = clamp(0, 100,
  20 * (portalLogins30d > 0 ? 1 : 0) +
  20 * (messagesFromClient30d > 0 ? 1 : 0) +
  15 * (starredItems30d > 0 ? 1 : 0) +
  15 * (proposalsViewed30d > 0 ? 1 : 0) +
  10 * (invoicesPaidOnTime30d > 0 ? 1 : 0) +
  20 * (daysSinceLastStaffOutreach < 14 ? 1 : daysSinceLastStaffOutreach < 30 ? 0.5 : 0)
)
```

### 3.3 `clientTouchHistory` — append-only log of every client interaction

`agentMemory/cmo/touchHistory/{clientNameSlug}/{auto}`

```js
{
  clientName: string,
  type: 'email_sent' | 'message_sent' | 'portal_post' | 'meeting' | 'proposal_sent' | 'invoice_sent' | 'tear_sheet_sent' | 'inspirations_added' | 'gift' | 'phone' | 'other',
  by: 'cindy' | 'vanessa' | 'auto' | 'unknown',
  date: ISOString,
  reference: { kind, id, ref },
  content_preview: string,            // first 80 chars of email / message body
  recordedBy: 'cmo-agent' | 'manual',
}
```

This is the source-of-truth for "last touch" — populated both by triggered watchers and by manual log entries when Cindy or Vanessa interacts outside the platform.

### 3.4 `brandVoiceAudits` — per-doc brand consistency check

`agentMemory/cmo/brandAudits/{docKindAndId}`

```js
{
  docRef: 'boards/{}/proposals/{}' | ...,
  docKind: 'proposal' | 'invoice' | 'tear_sheet' | 'client_email' | 'portal_post',
  auditedAt: ISOString,
  brandComplianceScore: 0-100,
  flags: [
    { rule: 'no_emoji_in_invoice', severity: 'medium', detail: '...' },
    { rule: 'tear_sheet_must_use_playfair_for_headings', severity: 'low', detail: '...' },
  ],
  suggestedChanges: [string],         // LLM suggestions
}
```

---

## 4. Watchers (extends COS spec §4)

### CMO scheduled watchers (mostly weekly — client experience is not daily-pace work)

| Watcher | Frequency | What it does |
|---|---|---|
| `clientSilenceWatcher` | Daily | Active project with no message in 14+ days → flag |
| `portalEngagementWatcher` | Daily | Client logging in often + no new content → flag |
| `portalQuietWatcher` | Weekly | Client hasn't logged in 21+ days → flag with re-engagement draft |
| `inspirationsStarWatcher` | Daily | New stars detected → cluster by client/vendor, flag patterns |
| `proposalEngagementWatcher` | Daily | Proposal sent but not opened after 3 days → flag |
| `designReviewWatcher` | Daily | Project milestone in <7 days AND no client invite → flag |
| `projectCompletionFollowup` | Weekly | Projects closed 30/60/180 days ago without follow-up touch → flag |
| `seasonOutreachWatcher` | Weekly | Approaching holidays / seasonal moments → flag for content drafting |
| `engagementScoreRecalc` | Daily | Recomputes all `clientEngagementScores` |
| `brandConsistencyWatcher` | Triggered (see below) | Audits outgoing docs against brand rules |

### Triggered watchers (Firestore onWrite)

| Trigger | Watcher |
|---|---|
| `clientSessions` written | `portalActivityIngest` — updates engagement signals |
| `boards/*/inspirations/*` starred | `inspirationsStarIngest` — counts + classifies |
| `proposals/*` viewed | `proposalEngagementIngest` |
| Outgoing email logged | `brandConsistencyWatcher` — audits content |
| Project milestone state changes | `milestoneTransitionWatcher` |

---

## 5. Surfaces

### 5.1 CMO Dashboard widget (top-right of main dashboard)

```
CLIENT EXPERIENCE                     5/27 7:14 AM
─────────────────────────────────────
Engaged clients (90+):      8 ✓
At-risk clients (<50):       3 ⚠
Silent active projects:     2

Recent: Toyo Shimano starred 3 lighting clips
        Cloud (Bradbury) — 5 logins this week, nothing new

⚠ 4 client touchpoints worth your attention
                              [ See all → ]
```

### 5.2 CMO Section in Daily Briefing Modal

Inside the COS Agent's morning briefing:

```
🎨 CLIENT EXPERIENCE TODAY

Bradbury hasn't visited their portal in 17 days. They've also been
quiet on email since May 8. Want me to draft something? You usually
share an inspiration update with them around this point in a project.

Toyo Shimano starred 3 Visual Comfort sconces overnight. Pattern from
the past 30 days: she's drawn toward warm-finish lighting. Worth a
note in your next design review prep.

Holtz Hill design review is May 30 — 3 days out. You typically send
a teaser tear sheet 5 days before. We're past your usual window.
Draft ready in Gmail Drafts.

Cloud closed proposal IN-25-10127 ($3,407.50) — yes, opened twice
yesterday, paid via ACH this morning. No action needed; flagged here
because that's a 36-hour close, faster than her usual.
```

### 5.3 Per-client Engagement card (on client detail page)

```
ENGAGEMENT — TOYO SHIMANO                  Score: 87/100 ↗

Last touch:        May 25 (3 days ago) — Vanessa, email
Portal logins:     8 in last 30 days
Messages:          4 from client (last May 24)
Stars:             12 inspirations (mostly Visual Comfort lighting)
Invoices:          7 paid on time in last 30 days

Trend: Rising. Toyo is highly engaged this month.

Suggested next touch (per CCH pattern):
  • A curated "warm finish lighting" inspiration board
  • Or schedule the design review meeting we postponed
```

### 5.4 Per-project CX tab (new tab on project detail)

A "Client Experience" tab on each project showing:
- Engagement score trend (chart)
- Communication frequency vs CCH benchmark
- Inspirations engagement
- Portal activity heatmap
- Suggested next-touch actions

### 5.5 Weekly client report (email)

Sent Monday 8am to Cindy + Vanessa. Per-client summary across all active projects. 1 page max.

---

## 6. LLM integration (extends COS spec §7)

### CMO-specific LLM tasks

1. **Engagement scorecards narrative** — turning raw signals into "Toyo is highly engaged this month" prose
2. **Email draft generation** — check-ins, follow-ups, inspiration shares, design review invitations. Each tuned to client + project history.
3. **Inspirations pattern analysis** — "Here's what your client has loved this month, and what pattern that suggests."
4. **Brand consistency audit** — reading outgoing docs and flagging deviations from CCH brand voice.
5. **Season/holiday content suggestions** — drafting curated lookbooks, gift recommendations, etc.

System prompt sketch:
> *You are Cindy's CMO and Client Experience lead. She runs CCH Design Inc., a 20-year luxury interior design firm. CCH's brand is gift-like, hand-crafted, understated luxury. Programa aesthetic: pure white, navy, sharp. Voice: warm, confident, never transactional, never salesy. You watch every client interaction. You never let a client feel forgotten. Every email you draft is personal, specific, and respectful of the client's time. Use the `cch-ceo-coach`, `cch-marketing`, `cch-client-portal`, and `elu-brand` skills as your knowledge base. Never recommend a generic action — always tied to specific client behavior or project state.*

---

## 7. Skill integration

The CMO Agent USES (does not replace) the following pre-existing Anthropic skills:

| Skill | Used for |
|---|---|
| `cch-ceo-coach` | Primary — business strategy, growth, leadership, content strategy, Design Inspiration publication |
| `cch-marketing` | Primary — brand presentation, templates, tear sheets, welcome packages, social/newsletter content |
| `cch-client-portal` | Primary — Programa aesthetic, layout rules, allowed/forbidden content, email templates |
| `elu-brand` | Secondary — when project involves ELU products, brand voice tuning |
| `cch-studio-platform` | Always-loaded — base platform rules |

Same invocation pattern as CFO: agent receives trigger → loads relevant skill → applies conventions → writes attention items / drafts.

---

## 8. Implementation order (for Cursor)

### Phase 1 — Schema + first watcher (1 session)

1. Extend COS Agent schema with CMO attention-item types
2. Build `clientSilenceWatcher` — the highest-value single watcher
3. Build `clientTouchHistory` ingest from existing `communications` collection
4. Add CMO Dashboard widget showing silent-clients count
5. Run end-to-end on staging: active project with no message in 14+ days → widget surfaces it

### Phase 2 — Engagement scoring (1 session)

6. `engagementScoreRecalc` watcher
7. Per-client engagement card on client detail page
8. CMO section in daily briefing modal

### Phase 3 — Portal + inspirations engagement (1 session)

9. `portalEngagementWatcher` + `portalQuietWatcher`
10. `inspirationsStarWatcher` (with clustering by client/vendor)
11. Per-project CX tab

### Phase 4 — Proposal + design review watchers (1 session)

12. `proposalEngagementWatcher`
13. `designReviewWatcher`
14. `projectCompletionFollowup`

### Phase 5 — LLM email drafts (1 session)

15. Gmail MCP integration for client email drafts
16. Brand voice tuning via `cch-marketing` skill
17. Per-touch-type email templates

### Phase 6 — Brand consistency + polish (1 session)

18. `brandConsistencyWatcher` for outgoing docs
19. Weekly client report email
20. `seasonOutreachWatcher`
21. Production deploy after staging acceptance

**Total estimate:** 6-8 Cursor sessions to v1.0 production. Phases 1+2 alone (~2 sessions) deliver the silence-detection + engagement scorecard — the highest immediate client-retention value.

---

## 9. Acceptance criteria (staging v1.0)

- [ ] `clientSilenceWatcher` correctly flags an active project with 14+ days of silence
- [ ] Engagement scores compute within ±5 points of manual hand-calculation on 5 test clients
- [ ] Weekly client report email arrives Monday 8 AM PT with at least 3 sections
- [ ] Brand consistency audit flags at least one issue on a deliberately off-brand test doc
- [ ] All client emails generated land in Gmail Drafts, never sent
- [ ] Per-client engagement card renders on staging
- [ ] CMO section appears in daily briefing modal
- [ ] No regression in existing communications feed
- [ ] All operations logged in `agentRuns` with `agentRole: 'cmo'`

---

## 10. Edge cases (CMO-specific)

| Case | Handling |
|---|---|
| Client paused project (on-hold status) | Silence watcher honors the on-hold flag — no nag during pause |
| Inactive / former client | Marked inactive in client doc → CMO Agent ignores |
| Multi-project client (Cloud with RH, HB, Mustang, Parker, Susan) | Engagement score computed per-client, not per-project. Touch-history merges across all client projects. |
| Cindy explicitly snoozes a client | Honors snooze duration. No "want me to draft..." nags until snooze expires. |
| Client communication outside Studio (text, in-person) | Cindy/Vanessa manually log via "+ Log Touch" button on engagement card → updates `touchHistory` |
| LLM produces off-brand draft | Brand consistency check runs on agent's own drafts too. Self-audit before showing to user. |
| Email sender is Vanessa, not Cindy | Use Vanessa's voice context. Engagement signals all attributed correctly. |
| Client portal hero image stale (>30 days) | Suggested-changes attention item; never auto-applied. |

---

## 11. Out of scope (v1.0)

- Auto-sending any client email (always draft, always typed-GO to send)
- Social media posting (Phase 2 — separate Marketing Agent extension)
- Newsletter list management beyond suggestions
- Gift purchasing automation
- Calendar / meeting scheduling beyond suggestion
- Predictive churn ML (Phase 2)
- Sentiment analysis of client messages (Phase 2)
- Multi-language drafts
- Voice / phone integration

---

## 12. Related docs

- `SPEC_Chief_Of_Staff_Agent_v1.0.md` — parent architecture
- `SPEC_CFO_Agent_v1.0.md` — sibling agent (financial focus)
- `CLAUDE.md` AI Session Rules #4 (No Random Layout Changes — applies to portal hero suggestions), #7 (typed-GO for sends), #11 (doc hygiene)
- Existing `communications` collection — source of touch history
- Existing `clientSessions` collection — source of portal activity
- Skills (already exist): `cch-ceo-coach`, `cch-marketing`, `cch-client-portal`, `elu-brand`

---

*End of CMO / Client Experience Agent v1.0 spec.*
