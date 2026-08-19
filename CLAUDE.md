# CCH Studio — Claude Code Standing Instructions

> ## ⚠️ WORKSPACE MOVED OFF DROPBOX (Jun 19, 2026) — read this first
>
> **The code repo no longer lives in Dropbox.** Dropbox syncing the repo (git + `firebase deploy` + two machines all churning the 4.4 MB `index.html`) caused full mouse/whole-computer lockups.
>
> **For every agent — Claude Code, Cursor, Cowork (CW1–3), Grok, Hermes:**
> - **Work from the machine's internal drive, NOT Dropbox:**
>   - Machine 1 (Cindy's main): `C:\dev\CCH-Platform-Deploy\cch-deploy` (git repo root)
>   - Lenovo: its own clone at `C:\dev\CCH\`
> - **Do NOT open or edit the old Dropbox copy** at `…\Dropbox\CCH-Platform-Deploy\` — it is **deprecated/stale** (being archived to NAS). Edits there are lost and re-trigger the freeze.
> - **Sync between machines through GitHub only.** Never have two machines on the same branch at the same time. Unlike Dropbox, git merges safely (or asks) — it will not silently overwrite work.
>   - Repo: `github.com/CCHDESIGNSTUDIO/CCH` · active branch `wip/preserve-rh-inspiration-board-2026-04-19`
> - **On Machine 1 you share ONE working copy with ~8 Cursor sessions.** Do **NOT** `git add` / `commit` / `push` or `firebase deploy` yourself — a commit here sweeps up everyone's edits and a deploy ships them all. **Hand your changed‑file list to repo owner #1**, who commits & deploys in coordinated batches. (A *separate machine* like Lenovo `C:\dev\CCH` does `git pull` before / `git push` after its own work.) See `.cursor/rules/commit-deploy-policy.mdc`.
> - Dropbox is fine for **small handoff notes** (e.g. `Claude - CCH studio\Cursor1 to cursor2\`) — never for code.
> - The Toshiba `D:` drive is Machine 1's **backup only** (USB = one machine at a time), not a shared working drive.

Every session that opens this project must read this file first. No need for Cindy to paste context.

*Last revised by: Claude (Cowork) — Aug 01, 2026 — closed the loop/ commit gap below (three sources now write there: Cursor, Fable, Cowork; none should commit/push it themselves). Prior revision Jul 11, 2026 — added the IMPROVEMENT LOOP section (Cindy's request). Prior revision Jul 10 (handoff folder rule).*

---

## ⚠️ HANDOFF FOLDER — every agent, every session (added Jul 10, 2026 per Cindy)

**All deliverable files an agent produces must ALSO be saved to the shared handoff folder:**

```
C:\Users\cindy\Dropbox\Claude - CCH studio\Cursor1 to cursor2 Claude Handoffs
```

- This applies to every agent working on CCH Studio (Claude Code, Cursor 1–8, Cowork/Hermes, Grok): finished code files, generated pages, memos, reports, screenshots of verified fixes — a **copy** of anything Cindy or another agent would need to pick up your work.
- The **working copy stays canonical** in `C:\dev\CCH-Platform-Deploy\cch-deploy` (edit code there, per the banner above). The handoff folder holds *copies* for visibility and cross-agent pickup — Dropbox is still never the place to *edit* code.
- Name files so their origin and date are obvious, e.g. `client.html_COWORK_Jul10`, `MEMO_design-board-footprint_CURSOR3_Jul08.md`. Do not overwrite another session's handoff file; add your own.
- Drop a short companion note (`_MH_[MonDD]` .md or .txt) with each batch: what changed, which build/bundle version, deploy status (pending / staging / prod GO).

---

## ⚠️ IMPROVEMENT LOOP — work order queue (added Jul 11, 2026 per Cindy)

**Files:** `loop/LOOP_LEDGER.md` (status table, single source of truth) · `loop/LOOP_PROTOCOL_CW_Jul10_v1.1.md` (full protocol) · `loop/WO-###_*.md` (work orders). Cursor enforcement: `.cursor/rules/loop-work-orders.mdc` — **this section is the Claude Code equivalent.**

Roles: Claude (Cowork) discovers, writes work orders, and verifies on staging. Cursor sessions and Claude Code execute. Deploy Master #1 deploys via `_DEPLOY_QUEUE.md` exactly as today. **Cindy alone GOes production.**

When Cindy says **"work the queue"** in any coding session:

1. Read `loop/LOOP_LEDGER.md`. Take the OLDEST row in state OPEN whose Executor matches you or is unassigned. Set it IN PROGRESS with your session name.
2. Ground before editing per CODE_GROUNDING_PROTOCOL — the work order's diagnosis is a lead, not evidence. Respect every constraint in the order; on conflict, set BLOCKED-DISCUSSION and stop.
3. On completion: write `loop/WO-###_DONE_<you>_[MonDD].md` (files touched, file:line, self-test), append the standard one-line handoff to `_DEPLOY_QUEUE.md` (STATUS: pending, staging), set the row DONE-UNVERIFIED.
4. NEVER mark a row VERIFIED (verification belongs to the verifying agent). NEVER deploy production (STOP-READ-FIRST.md). Max 3 attempts per order; on a FAILED order read `loop/verify/` evidence first.

Claude Code running staging deploys: allowed when Cindy asks (e.g. "run DEPLOY-STAGING.bat"), coordinated through #1's queue like any batch.

**⚠️ loop/ commit ownership (added Aug 01, 2026 per Cindy).** Writing a file into `loop/` (a new `WO-###_*.md`, a `DONE_*` note, an edit to `LOOP_LEDGER.md`) is NOT a commit and does not bypass the shared-working-copy rule above. Three sources now write into `loop/` on Machine 1: Cursor sessions, Fable, and Cowork/Claude. None of them should `git add`/`commit`/`push` those files on their own judgment call, same reasoning as the code itself, one session's commit sweeps up whatever the other two left uncommitted. Instead: when a WO, DONE note, or ledger update is ready, the session tells Cindy directly (don't stay silent, don't assume repo owner #1 already saw it) — she decides when it's committed, same as she decides when code deploys. This applies even though `loop/` is process/ops content, not product code; the git history is still shared and still hers to gate.

---

## ⚠️ Platform rules & design intention (canon — Aug 12, 2026)

**Authoritative:** [Docs/CCH_PLATFORM_RULES_AND_DESIGN_INTENT_CR_Aug12_v1.0.md](Docs/CCH_PLATFORM_RULES_AND_DESIGN_INTENT_CR_Aug12_v1.0.md) · Cursor: `.cursor/rules/cch-platform-canonical-facts.mdc`

One doc for locked facts (doc numbering, copy-not-link, QB bidirectional, client boundary, Firestore names, staging/Timely policy) and design intention. **Claude Team skills and older memos defer to this** when they conflict. Aug 12 skill audit checklist lives in §5 of that doc.

---

## ⚠️ Financial documents are isolated (no back-sync)

**Guard module:** `platform/cch-doc-isolation.js` · Cursor rule: `.cursor/rules/document-isolation.mdc`

Proposal / invoice / PO lines are snapshots after they land on a doc. **Doc edit/save must not** push category, vendor, prices, or images to Product Library or project clips. Use variance logging (`cchRecordDocVariance`) instead of silent upstream writes. Explicit UI only: Apply from Library, Link to Room Boards.

---

## ⚠️ Houzz Project Tracker — categories & re-import (read before Houzz/PO/product import)

**Authoritative:** [Docs/CLEANUP_HISTORY.md](Docs/CLEANUP_HISTORY.md) · Cursor rule: `.cursor/rules/houzz-taxonomy-import-guard.mdc`

New-Houzz tracker exports have dirty categories/rooms; May 27 canonical taxonomy + re-import guards apply. Do not audit or import from Houzz reports without that doc. Agent spreadsheets: `*_BY_CLAUDE_*` filenames — never overwrite Cynthia's working files.

---

## ⚠️ CODE GROUNDING PROTOCOL (read first, every turn)

**Authoritative doc:** [CODE_GROUNDING_PROTOCOL_MH_May13_v1.0.md](CODE_GROUNDING_PROTOCOL_MH_May13_v1.0.md) (also in `Docs/`). **Cursor enforcement:** `.cursor/rules/code-grounding.mdc` + `bug-diagnosis-before-fix.mdc` (always apply). **All agents:** Dropbox handoff `For ALL agents — NO GUESSING — CODE GROUNDING Jun 30.txt`.

**Hard rule, no exceptions:** No architectural claim, "what the platform does" summary, phased fix table, effort estimate, bug root-cause, or code edit — without a `grep` or file read executed **THIS turn**. Memory is not evidence. User description is not evidence. Session logs and handoff notes are not evidence. Skill files are not evidence about current code state.

Required before any such claim or edit:
1. Grep under **at least three** plausible aliases (rename drift is real — see drift map in the protocol).
2. **Read the function body** — name in grep output isn't enough.
3. Trace the call site before claiming unreachability.
4. Cite **file:line** in diagnosis and handoffs.

On "RELOOK" or "GROUNDING CHECK" from Cindy: stop generating, state the search terms, run them, read the hits, state the corrected finding. No "you're right" apology paragraph — that phrase is a tell the original claim wasn't grounded.

---

## Project Identity
- **App:** CCH Design Studio — luxury interior design platform
- **Stack:** Single-file vanilla HTML/JS + Firebase Firestore + Firebase Hosting
- **Main file:** `platform/index.html` (~32K lines) — DO NOT split this file
- **GitHub:** https://github.com/CCHDESIGNSTUDIO/CCH
- **Live URL:** https://cch-platform.web.app
- **Firebase project:** cch-design-boards

## Key People
- **Cindy Holloway** — founder, admin user. Email: cindy@cchdesign.com. Display name: "Cindy" (never "Cynthia")
- **Vanessa Holliday** — contractor/assistant. Different last name from Cindy.
- **Member doc IDs** are email-prefix based: `cindy` and `vanessa` — never change these

## How to Deploy
> **The root `CLAUDE.md` DEPLOYMENT RULE governs; this file is subordinate to it.**

**Staging first — always.** When a fix is ready:
```
cd C:\dev\CCH-Platform-Deploy\cch-deploy        # Machine 1 (Lenovo: cd C:\dev\CCH)
# or Dropbox copy:
cd C:\Users\cindy\Dropbox\CCH-Platform-Deploy\cch-deploy
```
firebase deploy --only hosting:platform --project staging
```
Verify on `cch-platform-staging.web.app` (Ctrl+Shift+R). **Production deploys ONLY on Cynthia's typed GO/YES**, via `DEPLOY-PRODUCTION-DANGER.bat`. **AI agents never deploy to production.** Commit/push to GitHub **only when Cynthia asks** — not automatically.

## How to Edit
- Edit `platform/index.html` directly — it is the entire platform
- Use the Edit tool (find exact string, replace it) — do NOT write Node scripts to patch files
- After editing, **ask to deploy when ready and get Cynthia's approval**; on approval, deploy to **staging** to test (batching changes is fine). Never deploy to production without Cynthia's typed GO.
- Always do Ctrl+Shift+R to test in browser after a **staging** deploy

## Standing Rules
1. **Navy #0E1629** — never use pure black for dark UI elements
2. **One theme only** — dark navy sidebar, white content area, gold accents (#C9A96E)
3. **Never split index.html** — single-file architecture is intentional
4. **Never confuse last names** — Holloway (Cindy) vs Holliday (Vanessa)
5. **Never hardcode rates** — use getMemberRate() and TEAM_CONFIG
6. **Fireplace vendors** always assign to Vaughn/ELU account

## Current Open Bugs (as of April 2, 2026)
| ID | Description | Priority | Status |
|----|-------------|----------|--------|
| B26 | Smart Time: single-column Timely-style redesign | HIGH | ✅ FIXED — new single-column day view with memories section |
| B27 | Inspiration Hub: 16 Niice-style issues | HIGH | ✅ FIXED — 20 fixes: tab colors, gold underlines, card backgrounds, lightbox dark panel, loading spinner, empty states, URL paste bar, search/filter, vendor inline edit |
| B28 | Proposals: 11 bugs (tax, images, links, layout) | HIGH | 🔄 PARTIAL — table layout fixed, tax works, images depend on library |
| B29 | Invoices: bill-to, tax on preview, line items too small | HIGH | ✅ FIXED — tax uses amount field, 14px font, 64px images in print |
| B30 | Dark mode text not visible on many pages | MEDIUM | ✅ FIXED — CSS exception for navy backgrounds preserves white text |
| B31 | Pages not fitting screen / responsive | MEDIUM | ✅ FIXED — overflow-x:hidden, min-width:0 on layout containers |
| B32 | Product library images missing | MEDIUM | 🔄 PARTIAL — loads instantly now (first 500 fast), images missing from old Houzz imports |
| B33 | Vanessa time entries disappeared from ledger | HIGH | ✅ FIXED — 11,504 entries showing including Vanessa's |

## Open Features
| ID | Description | Priority |
|----|-------------|----------|
| F124 | KPI cards + progress rings (reusable components) | MEDIUM |
| F125 | Vanessa Dashboard dark premium cards | MEDIUM |
| F126 | Activity Feed → Delve-style flash page | LOW |
| F127 | QuickBooks automation | LOW |
| F128 | AI time categorization (code exists, needs API key) | LOW |
| F129 | Design Board: layers, snapping, grid | LOW |
| F130 | Client portal connected to Firestore | LOW |

## Timely Integration
- Account ID: 874495
- Token: stored in Firestore `settings/timely`
- OAuth App ID: X0t2mXABI8R81qN8PDzX1iSAfMybb6cdpzfUT1Z1Otc
- Collection: `timelyEntries`

## Work Style
- **Recommend first, get Cynthia's approval before any edit / deploy / script** (canonical rule — supersedes the old "work autonomously" guidance)
- Edit `index.html` directly with the Edit tool; Firestore data work goes through dry-run scripts (reviewed before apply)
- When a fix is ready, **ask to deploy and get Cynthia's approval**, then deploy to **staging** to test; production only on Cynthia's typed GO/YES
- **On the shared Machine‑1 working copy, don't commit/push/deploy** — hand your changed‑file list to repo owner #1 (see the top banner / `commit-deploy-policy.mdc`). A separate-machine clone commits/pushes its own work only when Cynthia asks.
- If another session is working on a different module, coordinate via git pull before starting
