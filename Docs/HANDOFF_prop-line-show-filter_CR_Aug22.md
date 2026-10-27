# Handoff — Proposal line Show filter — 2026-08-22

**Studio:** 9.9.257 `prop-line-show-filter-2026-08-22`  
**Target:** production (Cindy: “Looks good go to production”)  
**Not committed.** Staging ~08:05; production ~08:32.

## Changed

`platform/index.html`

- Helpers `getProposalLineShowFilter` / `proposalLinePassesShowFilter` / `setProposalLineShowFilterUI` / `buildProposalLineShowFilterHtml` (~5917–5966)
- UI in Client View + Manage bulk bar (`renderProposalDetail` ~33870)
- Line render skips filtered rows (~34029–34094)
- `CCH_BUILD` 9.9.257

## Behavior

- Checkboxes: Show **Approved**, **Pending**, **All**
- Default: Approved + Pending on, All off → **declined hidden**
- All on → declined show
- **Edit** still lists every line
- Studio proposal landing only — `client.html` not touched
- Display-only — no Firestore writes
- Document totals still exclude declined (`proposalLineTotalsFromItems` ~9144)

## Pre-deploy

- Inline scripts `node --check` OK
- File tail `</html>` intact
- No `cch-*.js` change (no cache-buster bump)

## Verify

1. https://cch-platform-staging.web.app
2. Ctrl+Shift+R
3. Orange STAGING banner
4. Sidebar **v9.9.257**
5. Open a proposal (Client View, not Edit)
6. All off → declined lines gone
7. All on → declined return
8. Edit still shows declined
