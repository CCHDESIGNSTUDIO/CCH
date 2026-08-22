# WO-030 · Bring the in-app Release Notes / What's New current (changelog + roadmap) through the last 10 days · CW Jul 13
**Change ID:** pending #1 assign (RN) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
Pure DATA edit in `platform/index.html` (two arrays). No logic change. **Staging first; prod on Cindy GO.**

## Why
The Release Notes page (`#/releasenotes`, `renderReleaseNotes` @index.html:61420) is the real home for "what's
new" — it already has the roadmap + release log + Submit Bug/Request. But it's **stale**: the changelog
`getCchFeaturesChangelog()` @index.html:7040-7064 tops out at **v9.6.0 (Mar 26)** while `CCH_BUILD.version` is
**v9.8.51**. Everything we shipped in the loop over the last 10 days (WO-010 through WO-024 batch) is missing.
Update the two arrays so the page reflects reality. (Do NOT build a separate HTML — this page is the source of
truth.)

## Grounding (confirmed)
- Changelog array: `getCchFeaturesChangelog()` returns `[{version, date, type:'feature'|'fix', items:[...]}]`,
  newest first, @index.html:7040. Header stats derive from it (`features.length` = Releases, sum of items =
  Changes) @61448-61450; "Current" = `CCH_BUILD.version` @61461.
- Roadmap array: inline in `renderReleaseNotes` @index.html:61425-61436, `{title, desc, status:
  'done'|'in-progress'|'planned'|'backlog', eta}`.

## Change A — prepend these changelog entries (newest first, above v9.6.0)
Assign the correct version numbers from the real build/deploy history (there's a v9.7–v9.8 gap between Mar 26 and
v9.8.51; reconcile from `_DEPLOY_QUEUE.md` / git if other unlogged changes exist in that window, and add them
too). Dates below are accurate to the loop. Keep item wording in the existing plain style.

```
{ version: 'v9.8.x', date: 'Jul 12', type: 'feature', items: [
  'Client Portal Bi-Weekly Progress Update — the "Designing Your Story" landscape update now lives on the portal as a browsable history; latest surfaces on the client Home (Rolling Hills February seeded)',
  'Universal FFE Schedule under Finance — pick project + category, Apply; Houzz-style column picker (SKU, pricing, description, room, qty, pending, declined, invoiced) + export; Cost/Margin admin-only; multi-select is click-to-toggle',
  'Files & Docs — Photos thumbnail grid for final renderings; uploads now appear immediately (no refresh)'
] },
{ version: 'v9.8.x', date: 'Jul 12', type: 'fix', items: [
  'Purchase Orders — removed the misleading "Profit" tile from the summary strip (a PO has no client sell side)',
  'Follow-Ups — shows only Studio documents; legacy Houzz removed from every lane including Waiting on Client; fixed the "999 days" label and a crash that could blank a project\'s boards',
  'Order Management — Houzz parity between staging and production'
] },
{ version: 'v9.7.x', date: 'Jul 12', type: 'feature', items: [
  'Smart Time — untagged Timely entries are no longer dropped; assign service + project at log time; new Reconciliation queue catches what slipped through',
  'Timely resync now reaches February (was March-only)',
  'Time lists — "Pending only" view filter (view, not select) plus a confirm step before any bulk log'
] },
{ version: 'v9.7.x', date: 'Jul 11', type: 'feature', items: [
  'Follow-Ups — new cross-project and per-project stall tracker so nothing sits forgotten',
  'Room Board header now shows pipeline status (Pending / Approved / Invoiced / Declined) instead of cost/margin',
  'Invoices — new "Retainer Credit" line type; credits and negative amounts now allowed on discount/misc/credit lines',
  'Bugs & Requests — report from anywhere, threaded conversation, unread badge'
] },
```
Prepend order = newest first; the v9.8.x pair before the v9.7.x pair. Merge/split to match the real version
cut points if the deploy history differs — the item text is the fixed part.

## Change B — update the roadmap array (@61425-61436)
- **AI Auto-Draft Timesheets**: keep, but Smart Time capture/reconciliation now shipped is the foundation; leave
  status `in-progress` (full auto-draft still ahead).
- **Batch Time Editing**: `in-progress` stays (pending-view + guard shipped; batch assign still ahead).
- **Add** these upcoming cards (build them from the open loop WOs):
  - `{ title: 'Bi-Weekly Update Editor', desc: 'Upload/swap images and edit copy on each card of the client progress update, then publish', status: 'in-progress', eta: '' }`
  - `{ title: 'Fix-It Assistant', desc: 'AI first-responder in Bugs & Requests to unblock quick issues live', status: 'planned', eta: '' }`
  - `{ title: 'CCH Voice in AI Copy', desc: 'Invoice summaries and client updates written in Cindy\'s voice (warm, plain, bulleted)', status: 'in-progress', eta: '' }`
- Leave the four `done` items (Client Portal, Teams, QuickBooks, Activity Feed) as-is.

## Change C — housekeeping
- Update the stale line in the v9.6.0 entry ("Release Notes & What's New updated through v9.6") — the newest
  entry should reflect current. Optionally add "Release Notes brought current through v9.8" to the newest entry.
- Confirm the header "Current v${CCH_BUILD.version}" reads v9.8.51 after deploy (no code change needed, just verify).

## Acceptance (binary)
1. `#/releasenotes` shows the last-10-days features in the Release Log, newest first, versions and dates correct.
2. Header stat "Changes" increases by the number of new items; "Releases" by the number of new version entries.
3. Roadmap shows the three new upcoming cards; AI Auto-Draft / Batch Time statuses unchanged; four done items intact.
4. No console errors; `node --check`-style sanity (index.html tail intact after the array edits).

## Verify (Claude, staging)
Open #/releasenotes on staging → confirm the new entries render in order with correct badges, the roadmap shows
the new cards, and the stat counts moved. Screenshot to loop/verify/WO-030/.

## DONE note
loop/WO-030_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
