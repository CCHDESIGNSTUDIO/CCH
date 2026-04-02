# CCH Studio — Claude Code Standing Instructions

Every session that opens this project must read this file first. No need for Cindy to paste context.

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
```
cd C:\Users\cindy\Dropbox\CCH-Platform-Deploy\cch-deploy
firebase deploy --only hosting
```
Always deploy after every fix. Commit and push to GitHub after deploying.

## How to Edit
- Edit `platform/index.html` directly — it is the entire platform
- Use the Edit tool (find exact string, replace it) — do NOT write Node scripts to patch files
- After editing, deploy immediately, don't batch up changes
- Always do Ctrl+Shift+R to test in browser after deploy

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
| B27 | Inspiration Hub: 16 Niice-style issues | HIGH | 🔄 IN PROGRESS (agent working) |
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
- Work autonomously — don't ask permission to proceed
- Edit files directly, don't write patch scripts
- Deploy after every fix
- Commit with clear message after each task
- If another session is working on a different module, coordinate via git pull before starting
