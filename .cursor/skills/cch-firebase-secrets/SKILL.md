---
name: cch-firebase-secrets
description: >-
  Set Firebase function secrets for CCH Studio without exposing keys in chat — local
  *-pat.env files and firebase functions:secrets:set via PowerShell. Use for ANTHROPIC_API_KEY,
  AIRTABLE_PAT, or other Cloud Functions secrets on staging or production.
---

# CCH Firebase Secrets

**Never paste keys in chat, commits, or handoff docs.**

## Workflow

**Agent must make this easy for Cindy — never dump her in Secret Manager alone.**

1. Agent creates/opens the **local gitignored** paste file in the editor (empty, ready for one key line):
   - `C:\dev\CCH-Platform-Deploy\cch-deploy\anthropic-pat.env`
   - or `airtable-pat.env`
2. Cindy pastes **only** the `sk-ant-…` line (no quotes, no “Anthropic CCH Studio” label). Saves.
3. Agent sets secret with PowerShell (**one command per step**), filtering to the key line:

```powershell
cd C:\dev\CCH-Platform-Deploy\cch-deploy
```

```powershell
(Get-Content .\anthropic-pat.env | Where-Object { $_ -match '^sk-ant-' } | Select-Object -First 1) | firebase functions:secrets:set ANTHROPIC_API_KEY --project cch-design-boards
```

```powershell
(Get-Content .\anthropic-pat.env | Where-Object { $_ -match '^sk-ant-' } | Select-Object -First 1) | firebase functions:secrets:set ANTHROPIC_API_KEY --project staging
```

```powershell
(Get-Content .\airtable-pat.env | Where-Object { $_.Trim() -ne '' } | Select-Object -First 1) | firebase functions:secrets:set AIRTABLE_PAT --project staging
```

4. Delete or clear the local paste file after success
5. Deploy functions that declare the secret:

```powershell
firebase deploy --only functions:cchPepper --project cch-design-boards
```

**Do not** ask Cindy to hunt Secret Manager versions unless the local paste path failed.

## Per-project — not shared

| Environment | `--project` |
|-------------|-------------|
| Staging | `staging` |
| Production | `cch-design-boards` |

Setting a secret on staging does **not** set production. Repeat for each project Cindy authorizes.

## Known secrets

| Secret name | Used by | Local file pattern |
|-------------|---------|-------------------|
| `ANTHROPIC_API_KEY` | `functions/aiInvoiceSummary.js` (`draftInvoiceSummary`) | `anthropic-pat.env` |
| `AIRTABLE_PAT` | Airtable push functions / scripts | `airtable-pat.env` |

Functions reference secrets via `defineSecret()` in Gen2 code — see `Functions/aiInvoiceSummary.js`.

## Local scripts (not Firebase)

`_scripts/push-pos-to-airtable*.js` reads `airtable-pat.env` from repo root. Same rules: file on disk only.

## If a key was exposed in chat

Tell Cindy to **rotate/revoke** immediately and re-run `secrets:set`. Do not repeat the value.

## Do NOT use

- `curl` to pipe secrets
- Pasting keys in queue lines or session logs
- Committing `*.env` or `*-pat.env` files

## Related

- Rule: `cch-secrets-handoff.mdc`
- Docs: `Docs/AIRTABLE_PUSH_BUTTON_SPEC_CR_Jun27_v1.0.md`
