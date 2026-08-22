# WO-120 — Pepper daily / weekly / monthly briefs (product)

**CR_Aug21** · Lane: **Cursor**  
**Depends on:** WO-119 (brief *shape* in the system prompt). Do not start this until 119 is in tree or you ship both in one session with 119 first.  
**Does not replace:** WO-105 (morning + “my agenda”, already **PROD 9.9.125**). **Does not duplicate** the facts block.

## Goal

Cindy and Vanessa each get **their** brief at three cadences — not a firm-wide dump unless they ask All Team.

| Cadence | What it is | Already exists | This WO |
|---------|------------|----------------|---------|
| **Daily (morning)** | Plate for today, money first | WO-105 `my_agenda` | Reuse. Do not rebuild. |
| **Daily (evening)** | Chronological “Day in Review” | Filed as **WO-111** (`loop/WO-111_daily-activity-timeline-day-in-review_CW_Aug09.md`) — **not in the ledger table yet** | **Do not implement WO-111 here.** Point Pepper’s daily evening ask at WO-111 when that ships. Until then: evening = “what’s still on my plate” (WO-105), honestly labeled, not a fake timeline. |
| **Weekly** | Monday: last 7 days + here’s your week | Firm Weekly Reports page `renderReportsPage` / `generateReportNow` @ `platform/index.html` ~83517–83677 (`reports` collection; tries callable `generateWeeklyReport`, **no `Functions/` export found this write** — local fallback is the live path) | Person-scope the *Pepper* weekly brief. Do not replace the existing Weekly Reports page. |
| **Monthly** | Calendar month, same buckets | **Does not exist** as a Pepper product | New period on the same digest + report builder, not a new architecture. |

The C-Team markdown “weekly report spec” (Aug 12 screenshot) is **not in this repo** (`Docs/` glob 0). Use the shape in WO-119 + the buckets below. If Cindy drops that spec into `Docs/`, follow it over this list.

## Money loop (same as WO-105 — do not invent a second loop)

0. Time not logged (Timely / missing days)  
1. Unbilled billable hours  
2. Proposals not sent  
3. Invoices unsent + open AR  
Then: POs to chase (Vanessa lane), decisions waiting (Cindy lane), overdue tasks.

Accuracy: live digits from existing digests / Financials. Zero bucket → omit. Missing cache → say so. Never guess.

## Change (phased — stop after each phase if it grows)

### Phase A — Weekly Pepper brief (required)

- Preset already added in WO-119 (`weekly_brief`).
- Ground `generateReportNow` (`index.html:83609`) and `buildMyAgendaBrief` (`cch-pepper.js`). Re-grep before edit.
- Build a **person-scoped** last-7-days digest for the signed-in member (fingerprints: `timeEntries.member`, same as WO-105). Feed it into `cchPepper` with `action: weekly_brief`.
- Do **not** rewrite `renderReportsPage` layout. Optional: one “Ask Pepper about this week” button on that page is allowed if it only opens the existing panel + preset. If that requires a new `index.html` section crossing Weekly Reports → Pepper, stop and ask Cindy.
- Honest: if `generateWeeklyReport` Cloud Function is still missing, keep the local fallback; do not “fix” by deploying a new function unless Cindy asks.

### Phase B — Monthly Pepper brief (required)

- Same as weekly with `start`/`end` = this calendar month (or last complete month if today is the 1st — pick one, document it in the DONE note).
- Reuse Phase A builder with a date range. No new collection unless `reports` already stores monthly docs (it does not today — weekly `reports` add at `:83677`). Prefer Pepper digest-only for v1; do not auto-write monthly docs to `reports` without Cindy GO.

### Phase C — Daily evening (out of scope unless Cindy types GO on this phase)

Ship via **WO-111**, not a second timeline engine here.

## Constraints

- **“My” = signed-in user** (`currentEmail` / `currentMemberName`). All Team only when they ask.
- Staff-only. Never `#/clientview`. Draft-only. No send / no QB push.
- Do not implement WO-106 (all-seeing cache) as a side quest. If firm cache is missing, say so.
- Do not re-insert platform facts.
- **Staging first.** Queue via `_DEPLOY_QUEUE.md`. **No AI production deploy.** Cindy runs `DEPLOY-PRODUCTION-DANGER.bat` after she has tested staging. Never a bare `firebase deploy`.

## Grounding lead (re-verify on execute)

- `Functions/cchPepper.js` `buildSystemPrompt` ~44, `PRESET_FRAMES` ~35
- `platform/cch-pepper.js` `PRESETS` ~1248, `buildMyAgendaBrief` / `MY AGENDA`
- `platform/index.html` `renderReportsPage` ~83517, `generateReportNow` ~83609
- WO-105, WO-111, WO-106 (foundation, not this build)

## Verify (staging)

Cindy login, then Vanessa:

1. Daily preset = today’s plate, their name, money first.  
2. Weekly = last 7 days + coming week; numbers match Time Ledger / Financials or she says the bucket didn’t load.  
3. Monthly = calendar month; same honesty rule.  
4. Client portal: Pepper panel still absent.  
5. Existing Weekly Reports page still generates and lists `reports` docs.

## Acceptance

1. Three cadences from Pepper, person-scoped.  
2. Weekly Reports page unchanged in layout unless Cindy approved a single Pepper button.  
3. No fake Day-in-Review timeline (that’s WO-111).  
4. Staging verified. Prod only on Cindy’s gated script.

## Rollback

Revert the Pepper + digest files; staging redeploy those functions/hosting only.
