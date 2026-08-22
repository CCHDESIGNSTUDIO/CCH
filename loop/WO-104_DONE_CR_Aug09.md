# WO-104 DONE — Client Pepper open-items greeting · CR Aug 09

**Cindy lock:** Accuracy non-negotiable — live badge counts only; Option B (badge + once-per-session greet).

## Grounding (this session)
- Badge decisions: `client.html` / `index.html` `_decisionsNeededCount` = open decisions + `needs_input` tasks (~8625–8631 / ~73059–73065)
- Badge proposals: `proposalNeedsClientReview` → `_propReviewCt` (~9089 / ~73496)
- Badge invoices: `_openInvoices` Sent/Unpaid/Due/Overdue/Partial (~8625 / ~73059)
- Line nudge: `getProposalLineApprovalStatus` + visible-line tally (same as proposal render)
- Pepper mount: `cchClientPepperMount` in `cch-client-pepper.js` (~784); portal call sites `client.html:10185`, `index.html:74545`

## Change
1. **`platform/cch-client-pepper.js`** (`20260809cp104`) — `openCounts` snapshot; `buildGreetingText()` omits zero buckets / never invents; wait badge; greeting block + nav chips; proposal nudges; what’s-new once; session greet + Elise speak; loadError honest line
2. **`platform/client.html`** + **`platform/index.html`** — `window.cpPortalBuildPepperOpenSnapshot` (same formulas as badges); mount passes `openCounts` / `proposalNudges` / `whatsNew` / `baseHash`
3. Cache bust `cch-client-pepper.js?v=20260809cp104`; Studio **`9.9.121`**

## Out of scope / deferred
- New inspiration boards/images-since-last-visit naming (WO text flavors) — not wired; what’s-new uses existing `whatsNewItems` only
- Production — staging first; Cindy GO required for prod

## Self-test
- `node --check platform/cch-client-pepper.js` → exit 0
- Grep confirmed mount + snapshot + script `?v=20260809cp104` + `CCH_BUILD` 9.9.121

## Verify (staging after #1 deploy)
1. Hard refresh portal: `https://cch-platform-staging.web.app/#/clientview/{project}`
2. Pepper badge total = Decisions badge + Proposals badge + Open Invoices count (zeros omitted from spoken line)
3. Console: `[CCH ClientPepper] build 20260809cp104`
4. Sidebar 3 proposals awaiting → Pepper says 3 (not total proposals)
5. Nothing open → “You’re all caught up…”
6. Tap chips → Decisions / Proposals / Invoices routes
