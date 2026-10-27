# Nightly Session Log Protocol

**File:** PROTOCOL_NIGHTLY_SESSION_LOG_CR_Jun04_v1.0.md  
**Original Author:** Cursor (CR)  
**Created:** June 4, 2026  
**Last Modified:** June 4, 2026  
**Last Modified By:** Cursor (CR)  
**Version:** 1.0

## Revision history

- v1.0 (Jun 4, 2026, CR): Nightly 11 PM session log standard for CCH Studio agents.

---

## Purpose

One **session log per calendar day** (Pacific) so the next agent — or Cynthia — knows what shipped, what broke, what's open, and what must not be re-run without approval.

**Location:** `cch-deploy/Docs/SESSION_LOG_<Agent>_YYYY-MM-DD.md`  
**Agents:** `Cursor` (CR), `Claude` (CC/MH), etc.

---

## Schedule

- **Target:** every night **11:00 PM Pacific** (America/Los_Angeles).
- **Mechanism:** Cursor Automation (preferred) or manual end-of-session write if automation missed.
- **Rule:** `.cursor/rules/nightly-session-log.mdc` — agents read at session start.

---

## Filename

```
SESSION_LOG_Cursor_2026-06-04.md
SESSION_LOG_Claude_2026-06-04.md
```

One file per agent per day. If both Cursor and Claude worked the same day, **two files** — do not merge.

---

## Required header

```markdown
# Session Log — Cursor: <short title>

**File:** SESSION_LOG_Cursor_YYYY-MM-DD.md
**Original Author:** Cursor (CR)
**Created:** Month Day, Year
**Last Modified:** Month Day, Year
**Last Modified By:** Cursor (CR)
**Version:** 1.0

**Workspace:** `CCH-Platform-Deploy`
**Primary paths:** (files touched)
**Firebase:** staging / production as applicable
**Cursor transcript:** [short title](<uuid without .jsonl>)

## Revision history

- v1.0 (date, CR): One-line summary.
```

---

## Required sections (every log)

| Section | Content |
|---------|---------|
| **Session overview** | 2–4 sentences: user goal, project (e.g. Cloud-Rolling-Hills, PRO-3025) |
| **What changed** | Files, deploys, scripts run — with paths |
| **What was NOT done** | Deploy skipped, batch blocked, awaiting GO/YES |
| **Firestore / production** | Any live writes: script name, `--apply` or dry-run, backup path |
| **Open / next session** | Numbered list, highest priority first |
| **Verify commands** | Copy-paste checks for Cynthia or next agent |
| **No git commit** | State unless user explicitly committed |

---

## Nightly automation instructions (for Cursor Automation agent)

When the **11 PM cron** fires:

1. Open workspace `CCH-Platform-Deploy` / `cch-deploy`.
2. Read `CLAUDE.md`, `Docs/CURRENT_PRIORITIES.md`, today's git log (`git log --since="midnight" --oneline`), and any agent transcripts from today if linked.
3. If **no meaningful work** today: write a **short** log (`SESSION_LOG_Cursor_YYYY-MM-DD.md`) with section **"No platform changes today"** — still create the file.
4. If work occurred: follow this protocol + match tone of `SESSION_LOG_Cursor_2026-05-27.md`.
5. **Do not** deploy, commit, or run Firestore `--apply` scripts as part of the log job.
6. **Do not** overwrite Cynthia's working XLSX/CSV.
7. Link to feature handoffs (e.g. `CODE_PRODUCT_LIBRARY_ISOLATION_CR_Jun02_v1.0.md`) when relevant.

---

## Cynthia quick check

Each morning: `cch-deploy/Docs/SESSION_LOG_*_<yesterday's date>.md` exists.
