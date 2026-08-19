---
name: cch-invoice-redesign
description: >-
  CCH invoice Client View redesign — cch-invoice-redesign.js, renderDocViewPage, Client/Manage
  toggle, Print/PDF on main page, draftInvoiceSummary AI, doc isolation. Use when editing
  design-services invoices, invoice client view, or invoice print UX. Not Preview-only.
---

# CCH Invoice Redesign

## Principle

Client invoice UX lives on the **main invoice page** — Client View / Manage / Print — **not** only the Preview PDF popup.

## Key files

| File | Role |
|------|------|
| `platform/cch-invoice-redesign.js` | Client View renderer, view-mode toggle, print, summary/outcomes editor, AI draft |
| `platform/cch-proposals-invoices-fix.js` | `renderDocViewPage` — wraps design-services invoices |
| `platform/index.html` | Registers script; cache buster on `?v=` |
| `platform/cch-doc-isolation.js` | Guard — no back-sync to library/clips |
| `functions/aiInvoiceSummary.js` | Gen2 `draftInvoiceSummary` callable |
| `Docs/INVOICE_REDESIGN_V2_SPEC_CW_Jun28_v2.0.md` | Spec |
| `Docs/HANDOFF_TO_CURSOR1_invoice-redesign_CW_Jun28.md` | Latest handoff |

## User flow

1. Open design-services invoice → **Client View** (default)
2. **Manage** → working table + "Client summary & outcomes" editor
3. **Draft with AI** → calls `draftInvoiceSummary` → fills summary + outcome rows
4. Edit → **Save & refresh** → writes `clientSummary` / `clientOutcomes` to invoice doc only
5. **Client View** shows finished layout; **Print / PDF** prints client view
6. **Show date & hours** toggles detail in client view

## Isolation rules

- Invoice fields are **doc-local snapshots**
- Do not push category, prices, or images to Product Library or clips on save
- See `document-isolation.mdc` and `cch-doc-isolation.js`

## Edit checklist

1. Bump `?v=` on `cch-invoice-redesign.js` and any other changed script in `index.html`
2. Pre-deploy:

```powershell
cd C:\dev\CCH-Platform-Deploy\cch-deploy
```

```powershell
node --check platform\cch-invoice-redesign.js
```

```powershell
node --check platform\cch-proposals-invoices-fix.js
```

3. Verify file tails after edits

## Deploy

**Hosting** (redesign UI):

```powershell
firebase deploy --only hosting:platform --project staging
```

**AI function** (if changed):

```powershell
firebase deploy --only functions:draftInvoiceSummary --project staging
```

Requires `ANTHROPIC_API_KEY` on staging — see `cch-firebase-secrets` skill.

## Verify on staging

Use a **staging-native** design-services invoice (prod docs like INV-6040 may not exist on staging). Ctrl+Shift+R → Client View default → Manage → Print.

## Queue handoff

Append to `_DEPLOY_QUEUE.md`; do not deploy unless you are #1.
