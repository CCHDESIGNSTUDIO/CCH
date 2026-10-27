# Session Log — Cursor · 2026-08-12

## Overview
Claude Team / Pepper facts earlier; afternoon Spec Book UX (E-Specs landing + invoice/selections sources).

## What changed (code)
| File | Change |
|------|--------|
| `functions/cchPepper.js` | CCH Studio platform facts block in `buildSystemPrompt()` |
| `platform/CCH_Studio_Platform_Overview.html` | Branded platform overview (Cowork HTML) |
| `platform/index.html` | **9.9.153** E-Specs landing `#/especs`; **9.9.154** Spec Book Step 1: Invoice / Selections / Room / Category; invoice lines → clipId → specUrl; Selections = manual pick |
| `platform/cch-functions.js` | Workroom Edit sticky Save (**9.9.152**, earlier today) |

## Deployed
| Target | What |
|--------|------|
| **staging + prod functions** | `cchPepper` (Cindy GO) |
| **staging + prod hosting** | `CCH_Studio_Platform_Overview.html` (Cindy GO) |
| **staging hosting** | Spec Book **9.9.153–154** (E-Specs landing + invoice/selections) — **prod not yet** |

## Verify (Spec Book — staging)
1. Ctrl+Shift+R → build **9.9.154**
2. Sidebar **E-Specs** → pick project → Spec Book
3. Step 1 **Invoice** → select invoice(s) → Next → items (specs from clip `specUrl` when linked)
4. Step 1 **Selections** → Next → nothing pre-checked; pick manually

## Not deployed / needs GO
- Spec Book **9.9.154** → production (Cindy GO)
- Layer 2 Vanessa playbooks; Dropbox skill patches; repo canon docs (earlier)

## Claude Team (Cindy manual)
- **CCH STUDIO HOW TO Q&A** — Vanessa doc + CURRENT_STATE ✓
- **Ask Cchdesign** — CURRENT_STATE + Instructions ✓
- Org skills loaded (CEO/CFO/CMO/CIA + Vanessa helper)
