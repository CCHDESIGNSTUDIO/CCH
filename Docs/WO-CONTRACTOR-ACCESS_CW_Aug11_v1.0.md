# WO — Contractor project access (money-free collaborator view)

**CW_Aug11_v1.0** · Lane: **Cursor** · Files: `platform/index.html`, `platform/client.html`, `platform/cch-client-*.js`, `firestore.rules` · **Staging first; prod on Cindy GO.**
**Ties to:** the project Files folder (single source of truth), the E-Spec Book (the shared surface), and `CCH_STANDING_RULE_client-visibility-boundary` (this is its money-free sibling).

> **Grounding note.** Code refs are `platform/index.html` unless noted, read Aug 11. Items marked 💩 are inference to confirm before build.

---

## 1. Goal

Invite a **contractor** to a single project and give them a **money-free** view of only the documents and decisions staff explicitly share, reachable by a link. The shared surface is the project's existing **Files** folder plus selected **decisions**, so there is one source of truth and nobody maintains documents in two places.

---

## 2. The role (read this first, it prevents a wiring mistake)

A contractor is a **third external role**, distinct from both existing ones:
- **Client** sees the sell side (proposals, invoices, decisions). Never cost.
- **Contractor** sees the working layer (documents, decisions status, design boards) and **never any dollar figure at all** — no proposals, invoices, POs, cost, markup, margin, time, or pricing.
- **Staff** sees everything.

**Do not wire this into `TEAM_CONFIG.contractors`.** That is an internal labor-cost concept (it includes Vanessa). The invited external contractor is a separate record. Name the new thing distinctly (`contractorAccess`) so the two never touch.

---

## 3. Access model (grounded)

Today the client portal is a **capability URL**: `client.html#/clientview/{projectId}` (redirect @index.html line 5; `portalUrl` built @31966/@44271; "Share with Client" = `copyClientLink(projectId)` @16988). No login, no token — whoever holds the link sees it.

Contractor access reuses that external entry but **adds a per-invite token**, because you must be able to revoke one contractor without breaking everyone's link:

- Route: `client.html#/contractorview/{projectId}/{token}`.
- New record: `boards/{projectId}/contractorAccess/{token}` = `{ name, email (optional), grants, createdAt, createdBy, revoked:false, lastSeenAt }`.
- The token is the key; revoke = set `revoked:true` (link dies, others unaffected).
- **Honest posture:** this is capability-URL security (link-holder access), same as the client portal today. Acceptable here because the contractor view is money-free. State this to Cindy; do not imply authenticated identity.

---

## 4. What a contractor sees — whitelist-first, default nothing

Start from "contractor sees nothing," then surface only:

- **Files** flagged `sharedWithContractors: true` (§5). The single most valuable surface: shop drawings, specs, finish schedules.
- **Decisions** flagged shared: show *what* was approved or is pending and its **status**, never the price. (Protects both money and the client's process, per our design.)
- **Design boards**, if flagged shared (visual, strip any price annotation).
- **The E-Spec Book**, money-free (this is the shared surface that feature feeds; per-item comments are the contractor collaboration layer).

**Never:** proposals, invoices, POs, cost, markup, margin, time ledger, other projects, other contractors' grants.

---

## 5. The sharing mechanism (per item, default off) — mirror an existing pattern

The platform already does per-item external visibility: tasks carry a **`clientVisible`** flag with a checkbox "Show this task in the client portal" (@19971), written @20061, default true. **Mirror that exact pattern** for contractors, with the default flipped to **off**:

- New field **`sharedWithContractors: bool`** (default **false**) on **files** (`boards/{projectId}/files`, added @21881) and on **decisions**.
- On **file upload** (`uploadProjectFiles`, input @17644): add a checkbox **"Share with project contractors"**, default **unchecked**. Editable later from the file row in `renderFilesTab` (@17603).
- On a **decision**: same checkbox, default off.
- **Folder-level convenience:** add a **"Shared with contractors"** shelf category (reuse `projectFileShelfCategory` @17540) so staff can drop files in bulk instead of ticking each one. Anything in that shelf is shared; everything else stays internal.

The access picker's default is the whole ballgame: **default off, opt-in per item.** One permissive default is the only way this leaks, so there isn't one.

---

## 6. Invite + manage

- **Invite contractor** action on the project (near "Share with Client" @16988): enter name + optional email → create the `contractorAccess` record + token → produce the link (`copyContractorLink`, mirror `copyClientLink`/`portalUrl`).
- **Per-contractor panel:** lists exactly what that contractor can see (shared files + shared decisions), their `lastSeenAt`, and a **Revoke** button (sets `revoked:true`). This panel is the audit trail and the off-switch; it is what keeps per-item sharing from becoming a pile you can't see the shape of.

---

## 7. Money / visibility rules (non-negotiable)

- **Money-free.** No dollar figure of any kind on any contractor surface. No proposals, invoices, POs, cost, markup, margin, time.
- **Whitelist-first.** Default nothing shared; contractor sees only items explicitly flagged.
- **Enforced server-side, not just UI.** The `contractorview` render AND `firestore.rules` must both gate a contractor token to: this project only, files where `sharedWithContractors==true`, shared decisions, nothing financial. A hidden tab is not access control (same lesson as the variance write-guard). Put the wall in the rules.
- Must **never render on a staff or `#/clientview/*` route**, and the client portal must never render contractor-only items.

---

## 8. Reuse (grounded) vs new work

**Reuse:**
- External entry: `client.html` split (@index.html line 5), `copyClientLink` / `portalUrl` (@16988, @31966, @44271).
- Per-item visibility toggle: the tasks `clientVisible` pattern (@19971 / @20061).
- Files: `boards/{projectId}/files`, `renderFilesTab` (@17603), `uploadProjectFiles` (@17644), shelf categories (`projectFileShelfCategory` @17540).

**New:**
1. `contractorAccess` record + token; `contractorview` route.
2. `sharedWithContractors` field + the upload checkbox + the "Shared with contractors" shelf.
3. The money-free `contractorview` render (whitelist).
4. Invite UI + `copyContractorLink`.
5. Per-contractor audit/revoke panel.
6. `firestore.rules` clauses scoping a contractor token to shared, money-free reads on its one project.

---

## 9. Acceptance (binary)

1. Invite a contractor to a project → get a link `contractorview/{projectId}/{token}`; opening it shows **only** files flagged `sharedWithContractors` and shared decisions, money-free, no login.
2. A file uploaded with the box unchecked is **not** visible to the contractor; checking it (or dropping it in the shared shelf) makes it visible; unchecking hides it again.
3. A shared decision shows its status (approved/pending) and *what*, with **no price**.
4. No proposal, invoice, PO, cost, markup, or other project ever appears, confirmed by attempting a direct Firestore read with the contractor token (rules reject it), not just by a hidden tab.
5. The per-contractor panel lists everything shared to them; **Revoke** kills that link and no other.
6. Nothing renders on a staff or client route that shouldn't. Verified on staging, then prod on Cindy GO.

---

## 10. Out of scope (flag as follow-ons)

- **Vendors** (PO recipients). Deferred per Cindy; the money boundary inverts for them (they see their own cost), which is a separate WO.
- **Authenticated login** for contractors. v1 is capability-URL + token, matching the client portal's current posture.
- **Per-person item grants** beyond folder + flag (giving one specific contractor one specific file that others in the project can't see). v1 shares to "contractors on this project"; per-person hand-pick is v2.
- **The E-Spec comment layer** as a full collaboration thread. The book is the shared surface now; threaded comments can follow.

---

## 11. Sources / grounding

`platform/index.html`: client.html split @line5, `copyClientLink` @16988, `portalUrl` @31966/@44271, tasks `clientVisible` @19971/@20061, `boards/{id}/files` @21881, `renderFilesTab` @17603, `uploadProjectFiles` @17644, `projectFileShelfCategory` @17540. `platform/client.html` (external render). `firestore.rules` (deploy root). 💩 Confirm the decisions collection name and shape, and confirm `client.html`'s current whitelist render before extending it to `contractorview`.

*v1.0, Aug 11 2026. Draft for Cursor ingest. Money-free, whitelist-first, server-enforced. Sibling to the client-visibility standing rule.*
