# WO-100 — Pepper: include the project's Tasks in the per-project digest

**CW_Aug07** · Lane: **Cursor** · Grounded in `platform/cch-pepper.js` + `Functions/cchPepper.js` this session. Phase 0 of `PEPPER_MASTER_PLAN_CW_Aug07_v1.0`.

## Symptom (Cindy, Aug 07)
On a project (31 Whitesail), Pepper says: *"The digest I have for 31 Whitesail doesn't include any tasks at all… Studio's task feed didn't come through in this pull."* The project has a live Tasks & Punchlist (3 to do, 2 in progress, 1 done, several overdue), but Pepper is blind to it. This is correct behavior on her part (she refuses to guess), caused by a missing digest input.

## Root cause (confirmed in code)
`platform/cch-pepper.js` → `buildFullDigest(projectId)` (line 367) assembles the per-project digest from decisions (`buildDecisionsDigest`), Follow-Ups (`buildFollowUpsDigest`), activity (`buildActivityDigest`), and unbilled time (`buildUnbilledTimeDigest`). It does **not** include tasks. A `buildFirmTasksDigest()` (line 452) already reads `boards/{projectId}/tasks` and formats a task list, but it only runs on the firm-wide `#/alltasks` route (scope === 'tasks'), never for a single project.

## Change
1. **Add `buildTasksDigest(projectId)`** in `cch-pepper.js`, mirroring `buildFirmTasksDigest` (line 452) but scoped to one project: read `boards/{projectId}/tasks`, list open/overdue/in-progress items with title, status, owner, due date, and the to-do / in-progress / done counts. Reuse the same formatting and the same field fallbacks already used at lines ~255 and ~509-523.
2. **Include it in `buildFullDigest`** (line 367): after the decisions push, add
   `var t = await buildTasksDigest(projectId); if (t) parts.push(t);`
   so every project answer carries the punchlist.
3. **Update the brain's system prompt** in `Functions/cchPepper.js` (line ~74): add tasks to the listed project-digest contents ("a project (decisions, Follow-Ups, activity, unbilled time" → "…, tasks/punchlist").

## Guardrails
- Read-only digest assembly; no writes, no task edits. Pepper still drafts only and never claims she completed or closed a task (her prompt already forbids this at line ~523 — keep it).
- Minimal diff in the 80KB `cch-pepper.js`; reuse `buildFirmTasksDigest` logic, do not fork a second task reader if it can be shared.

## Acceptance
1. On 31 Whitesail, ask Pepper "summarize status" or "what needs attention today": she names the actual tasks (e.g. Shower Curtain, Carpet runner, Upload job site photos as overdue) and the counts, and no longer says the task feed didn't come through.
2. A project with zero tasks: she says tasks are clear, does not error.
3. Firm-wide Tasks page behavior (existing `buildFirmTasksDigest`) unchanged.
4. Verified on staging, then prod on Cindy's GO.
