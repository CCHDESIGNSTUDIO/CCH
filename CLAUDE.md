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
> - **Sync between machines through GitHub only:** `git pull` before you start, `git push` when you finish. Never have two machines on the same branch at the same time. Unlike Dropbox, git merges safely (or asks) — it will not silently overwrite work.
>   - Repo: `github.com/CCHDESIGNSTUDIO/CCH` · active branch `wip/preserve-rh-inspiration-board-2026-04-19`
> - Dropbox is fine for **small handoff notes** (e.g. `Claude - CCH studio\Cursor1 to cursor2\`) — never for code.
> - The Toshiba `D:` drive is Machine 1's **backup only** (USB = one machine at a time), not a shared working drive.

Every session that opens this project must read this file first. No need for Cindy to paste context.

*Last revised by: Claude — Jun 9, 2026 — reconciled the deploy/commit guidance below with the canonical staging-first DEPLOYMENT RULE in the project-root `CLAUDE.md` (removed stale "deploy after every fix / commit and push"). The root CLAUDE.md governs; this file is subordinate.*

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

**Authoritative doc:** [Docs/CODE_GROUNDING_PROTOCOL_MH_May13_v1.0.md](Docs/CODE_GROUNDING_PROTOCOL_MH_May13_v1.0.md)

**Hard rule, no exceptions:** No architectural claim, "what the platform does" summary, phased fix table, effort estimate, or "my recommendation" — without a `grep` or file `view` executed THIS turn. Memory is not evidence. User description is not evidence. Skill files are not evidence about current code state.

Required before any such claim:
1. Grep under **at least three** plausible aliases (rename drift is real — see drift map in the protocol).
2. **Read the function body** — name in grep output isn't enough.
3. Trace the call site before claiming unreachability.

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

**Staging first — always.** When a fix is ready (work from the **non-Dropbox** copy):
```
cd C:\dev\CCH-Platform-Deploy\cch-deploy        # Machine 1  (Lenovo: cd C:\dev\CCH)
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
- Commit/push to GitHub **only when Cynthia asks**
- If another session is working on a different module, coordinate via git pull before starting
