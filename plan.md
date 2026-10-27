# CCH Studio Code Audit Plan (Plan Mode)

**Project Overview**
- **Architecture**: Single-file vanilla JS app (`platform/index.html` ~32,000+ lines, ~20k+ lines of JS). Firebase Hosting + Firestore + Cloud Functions (Node 20). No framework, no build step, direct Firebase SDK in browser.
- **Core Features**: Project boards, room/ideabooks/clips, invoices/proposals/POs with client portal, Smart Time tracking, product library, QuickBooks sync, activity feed, design boards (canvas), tearsheets, reports.
- **Deployment**: Strict staging-first policy (`STOP-READ-FIRST.md`). Production gated by confirmation. Dropbox sync for edits.
- **Key Docs**: `CLAUDE.md`, `CURRENT_PRIORITIES.md`, `KNOWN_ISSUES.md`, `CLEANUP_HISTORY.md`, `firestore.rules`, `storage.rules`.

**Audit Findings**

**1. Security Issues (High Priority)**
- **API Keys Exposed**: Firebase config (including `apiKey`) is in client-side JS (lines ~3050-3065). Acceptable for Firebase but increases attack surface if rules weak.
- **Firestore Rules**: Mostly solid (admin-only for sensitive, client portal narrow helpers, clip validation functions to block expense/service in room boards). However:
  - `/products/{docId}` and `/productLibrary` allow `create/update` if `true` (anyone signed in or even unauth in some paths). Risk of spam/pollution.
  - `/vendors` allows open `create`.
  - Legacy top-level collections have broad rules.
  - No field-level validation in rules for financial docs (proposals, invoices) beyond basic.
- **XSS**: Strong `esc()` / `escAttr()` / `escJsStr()` helpers used extensively for dynamic HTML. No obvious `innerHTML = userInput` without sanitization. Good.
- **Storage Rules**: Reasonable size/content-type checks, public reads for media. Good.
- **Auth**: Custom email/password + Firebase Auth. Client portal uses unauth reads/writes with narrow rules. No OAuth/social noted.
- **Other**: No obvious hardcoded secrets beyond Firebase keys. Cloud Functions not deeply audited here (in `Functions/` dir).

**2. Bugs (Critical - Match Known Issues)**
- Design Board regressions (DB-1 to DB-3): drag-drop, room filter, inspiration tab (see `KNOWN_ISSUES.md` and `CURRENT_PRIORITIES.md`).
- Tearsheets blank.
- Product Library UI missing features (Houzz ID, LINKED column, RESOLVE vs APPLY pattern not implemented — risk of overwrite bugs).
- Ivy CDN URLs expiring May 25, 2026 (6k+ references) — urgent data migration needed (`scripts/rewrite-image-urls.js`).
- Houzz import re-pollution risk (guarded in `CLEANUP_HISTORY.md` but scripts must strictly follow "fill-empty-only").
- Potential race conditions in bulk updates, image fallbacks, activity rebuilds.
- QuickBooks sync lacks clear user feedback (new priority).

**3. Performance Problems (High Impact)**
- **Monolithic File**: 32k+ line HTML/JS loaded entirely. Browser must parse/execute huge script on every load. No code splitting, lazy loading, or modules.
- **Firestore Queries**: Many `.get()` on subcollections without `limit()`, `orderBy` with indexes, or pagination. Large projects with 1000s of clips/invoices can cause slow loads/timeouts.
- **DOM Heavy**: Massive string concatenation for HTML (`innerHTML += ...`), no virtual DOM or efficient re-rendering. Frequent full re-renders of tabs/tables.
- **No Caching/Indexes**: Search index rebuild is manual. No client-side caching beyond ad-hoc.
- **Image Handling**: Many orphaned images, fallback chains, no lazy loading or responsive images in all places.
- **Cloud Functions**: Heavy reports/rebuilds may be slow without optimization.

**4. Code Quality**
- **Strengths**: Extensive helper functions, good escaping, detailed comments in places, build versioning, release notes embedded.
- **Weaknesses**:
  - Extreme monolith — violates single-responsibility (one file does everything).
  - Heavy use of global variables/functions (`window.` pollution).
  - String-based "HTML as code" leads to maintenance hell (hard to read diffs, no syntax highlighting for templates).
  - No tests, TypeScript, linting, or CI visible.
  - Duplication in rendering logic (many similar `build*Html` and render functions).
  - Some outdated patterns (legacy collections, commented code).
  - Documentation scattered; grounding protocol in `CLAUDE.md` shows awareness of drift.

**5. Accessibility Issues**
- Partial: Some `aria-label`, semantic elements, labels on forms.
- Gaps: Limited keyboard navigation in complex modals/dropdowns, dynamic content may not announce changes, color contrast (navy/gold theme needs verification), no lang attributes on dynamic content, missing alt text on many generated images, no ARIA live regions for toasts/updates.
- Client portal may have issues for screen readers.

**Suggested Improvements (Prioritized Implementation Plan)**

**Phase 1: Immediate Security & Stability (1-2 days, deploy to staging first)**
- Tighten Firestore rules: Restrict `/products`, `/productLibrary`, `/vendors` create/update to `isAdmin()` or specific fields. Add field validation for financial data.
- Migrate Ivy CDN URLs (run rescue script, update references, verify with audit).
- Fix Design Board regressions (`openDesignBoard()` and related).
- Implement missing QB success notifications (modal/banner/toast).

**Phase 2: Performance & Quality (Refactor without breaking single-file deploy)**
- **Modularize JS**: Split JS into logical sections with clear comments (e.g. // === RENDERING HELPERS ===, // === FIRESTORE HELPERS ===). Use IIFE or simple namespaces. Consider future migration to ES modules + build step (Vite/Rollup) while keeping single HTML output.
- Add Firestore indexes where missing (via `firestore.indexes.json`).
- Implement pagination/lazy loading for large lists (clips, activity, library).
- Add client-side caching (IndexedDB or in-memory with TTL for projects).
- Image optimization: Add `loading="lazy"`, srcset where possible, consistent Firebase Storage URLs.

**Phase 3: Accessibility & Features**
- Comprehensive a11y audit/fixes: ARIA roles/states, focus management, keyboard traps, color contrast (use tools like axe or Lighthouse), semantic HTML.
- Implement RESOLVE/APPLY pattern to prevent library sync overwrites.
- Restore/enhance Product Library UI per priorities.
- Add unit/integration tests (Jest for helpers, Cypress for E2E on staging).
- Consider progressive enhancement or Web Components for complex UIs (e.g. design board canvas).

**Phase 4: Long-term Architecture**
- Migrate to a modern framework (React/Vue/Svelte) with Firebase SDK v9+ modular imports for tree-shaking.
- Separate client portal into its own app for better security scoping.
- Add CI/CD (GitHub Actions) with lint, test, staging deploy.
- Implement proper error boundaries, logging (Sentry), and monitoring.
- Move sensitive config to environment/secrets (Cloud Functions).

**Risks & Tradeoffs**
- Monolith refactor risks regression — use staging heavily, test client portal.
- Adding build step changes deploy flow (current Dropbox + direct edit is simple but brittle).
- Rules tightening could break existing client portal or Clipper if not tested.
- Performance gains from pagination require UI changes (infinite scroll).

**Next Steps After Plan Approval**
1. User approves plan or requests changes.
2. Exit plan mode.
3. Implement Phase 1 fixes using `search_replace` on `platform/index.html`, update rules, test on staging via `DEPLOY-STAGING.bat`.
4. Use `check-work` skill or subagent for verification.
5. Document changes in `CURRENT_PRIORITIES.md` and release notes.

This plan is grounded in direct exploration of the codebase (files read: package.json, index.html sections, rules, all Docs/*.md, firebase.json, etc.). No changes made during planning.