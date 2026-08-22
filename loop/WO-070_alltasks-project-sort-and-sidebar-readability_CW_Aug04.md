# WO-070 · All Tasks Project sort + sidebar readability · CW Aug 04
**Change ID:** pending #1 assign · **Lane:** Studio platform (plain) · **State:** PLANNED (Cursor sketch, no code yet) · **Executor:** Cursor · **Verifier:** Fable (Cowork) · **Gate:** Cindy GO after staging verify
**File:** `platform/index.html` (+ optional `cch-client-activity.js` CSS dedupe). Two INDEPENDENT UX fixes; either can ship without the other. Single staging deploy batch. **Staging first; prod on Cindy GO.**

**Numbering note:** Cursor's sketch proposed `WO-063` — that number is already used in `loop/LOOP_LEDGER.md`. Correct number is **WO-070** (max was 068; 069 is now WO-069-B / FT-028 Builder picker). Do not file this as 063.

Source: Cursor Features-session plan (plan-only, grounded file:line). This WO formalizes it and adds guardrails + verify.

---

## Part A — All Tasks needs a Project sort
**Grounded (Cursor):** `renderAllTasks()` loads project tasks, filters by `_allTaskFilter`, then hard-sorts status → priority → `createdAt` only (`platform/index.html` ~67881-67887). The Project column header is plain text, no click handler.
**Pattern to copy:** Proposals/Invoices/POs already do project sort via `sortFilterToolbar` + `sortByField` (~6125-6144, ~68010-68011). Reuse it, do not invent a new sort mechanism.

**Requirements (Cursor's steps 1-5, confirmed):**
1. Add `allTasksSortBy` (default `'status'`) + `allTasksSortDir` (`'asc'`); persist on `window._allTaskSort` so it survives re-render.
2. Add `allTasksSortArrow(field)` mirroring `sortArrow`/`projSortArrow`.
3. Replace the fixed sort block with a switch: `project` → `localeCompare` on `projectName`; also support task / assignee / priority / due / status for parity.
4. Make the **Project** `<th>` clickable (`cursor:pointer` + `onclick="allTasksSortByField('project')"` + arrow). Other headers sortable is optional.
5. **Default unchanged:** keep today's status-first order until the user clicks Project; then A→Z, click again Z→A.
6. Project filter dropdown = OPTIONAL, only if Cindy asks. Do not bundle by default.

**Acceptance (binary):**
- On `#/alltasks`, click Project → rows group by project name alphabetically; second click reverses; arrow shows ▲/▼.
- Active / My Tasks / Completed filters still work.
- **Sort is display-only:** no task is mutated, reassigned, or written. Pepper `_cchPepperAllTasksCache` unchanged (still snapshot after load).

---

## Part B — Navy sidebar is unreadable
**Grounded (Cursor):** `.nav-item` uses `color: rgba(255,255,255,0.62)` @ 11px (~1006-1011); Pinterest row is `#E60023` text on navy (~3385-3386), poor contrast; `cch-client-activity.js` (~537-565) injects a competing nav-polish block that inline styles override.

**Requirements:**
1. Base nav readability in `index.html` static CSS: nav items ~12.5px, color `rgba(255,255,255,0.88)`, icons ~0.78 opacity, hover `#fff`, active stays gold.
2. Section labels (FINANCE / STUDIO / TIME & REPORTS): ~10px, gold at ~95% opacity.
3. Pinterest row: keep red as **left-border + icon tint only**; label text white/cream like other items (not `#E60023` on navy). Same for Style Library if faint.
4. Keep the staging-banner offset (`.sidebar { top: var(--cch-staging-banner-h) }`) so the logo isn't covered.

**Fable review notes / guardrails on Part B:**
- **Use the established brand gold, not a new one.** Cursor's sketch introduces `#C9A96E`. The CCH brand gold is `#C4A464` (CCH_VOICE_PROFILE / brand palette). Use the existing brand token; do not spawn a third gold value. If a lighter gold is truly needed for contrast, get Cindy's OK first.
- **The two-places CSS is a regression magnet.** Nav styling living in both `index.html` and `cch-client-activity.js` is exactly the "code paths that fight" pattern that causes back-slide. Consolidating into the static CSS and removing the duplicate inject is the right fix, but it is the riskier half: if time-boxed, ship the base-CSS readability bump alone and do the dedupe as a separate, verified step rather than both at once.
- **Contrast target is testable:** every nav label vs the navy background must be ≥ 4.5:1 (WCAG AA). This is scriptable in the canary (compute contrast ratio), so it becomes a permanent check, not a one-time eyeball.

**Acceptance (binary):**
- Sidebar labels readable at normal distance without squinting; measured contrast ≥ 4.5:1.
- Pinterest readable (white/cream text, red accent only). Active Tasks item still gold.
- No white-on-white or navy-on-navy regressions on Smart Time tabs / Reconciliation sub-nav / Style Library.

---

## STOP / guardrails (both parts)
1. **Do NOT** touch the project sub-panel (`cch-project-subpanel.js`) — this is the firm-wide left nav, not the light project panel.
2. **Do NOT** introduce a new gold; match `#C4A464`.
3. **No data writes** anywhere — Part A is display-sort only; Part B is CSS only. No pricing, tasks, or Firestore mutations.
4. Minimal diff; bump the cache-buster on any changed `<script>`/style tag; `node --check` only if `cch-client-activity.js` is touched.

## Verify (Fable) + canary hooks
Reach caveat: Fable's sandbox can't load staging, so verify via the Phase 0 canary (run locally) + Cursor screenshots.
- **A:** canary on `#/alltasks`: click the Project header, assert rows are grouped/ordered by `projectName`; assert Active/My Tasks/Completed still filter; assert no task doc changed.
- **B:** canary computes contrast ratio of nav labels (including Pinterest) vs sidebar bg, assert ≥ 4.5:1; assert active item still gold; no console errors.
Green canary + screenshots = Fable sign-off, then Cindy GO for prod.

## Deploy queue line (for #1)
`[date] #Cursor WO-070 All Tasks Project sort + sidebar readability — platform/index.html (+ optional cch-client-activity.js CSS dedupe) — staging — STATUS: pending`

## Effort (Cursor est.): ~2 hr total (sort ~1h, sidebar CSS ~30m, verify ~15m), single staging batch.

## Ledger
Add to `loop/LOOP_LEDGER.md`: WO-070 · Studio · All Tasks Project sort + sidebar readability · planned → staging → awaiting Fable verify.
