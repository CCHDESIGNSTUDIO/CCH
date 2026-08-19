---
name: cch-deploy-master
description: >-
  CCH Deploy Master (#1) playbook — read _DEPLOY_QUEUE.md, batch commit, staging vs
  production deploy, cache-bust checklist, pre-deploy node --check. Use when deploying
  CCH Studio hosting or functions, processing the deploy queue, or acting as repo owner #1.
---

# CCH Deploy Master (#1)

Repo root: `C:\dev\CCH-Platform-Deploy\cch-deploy`

Only **#1** runs `git add`, `commit`, `push`, and `firebase deploy`. Other sessions append to `_DEPLOY_QUEUE.md`.

## Read queue first

```powershell
cd C:\dev\CCH-Platform-Deploy\cch-deploy
```

Open `_DEPLOY_QUEUE.md` — process `STATUS: pending` lines. Batch related staging work; serialize staging deploys (one session's work at a time when possible).

## Pre-deploy checklist

For each pending batch:

1. `git status` — know what else is in the working tree (shared copy; commits sweep all staged files)
2. `node --check` every touched `platform/cch-*.js`
3. Confirm cache busters bumped on changed scripts in `platform/index.html`
4. Verify file tails on large edited files (no truncation)

## Staging hosting deploy

```powershell
cd C:\dev\CCH-Platform-Deploy\cch-deploy
```

```powershell
firebase deploy --only hosting:platform --project staging
```

Verify: https://cch-platform-staging.web.app — Ctrl+Shift+R, orange STAGING banner, sidebar build tag, feature-specific smoke test from queue line.

## Production hosting deploy

**Only on Cindy's explicit typed GO/YES.** Agents never deploy production solo.

```powershell
firebase deploy --only hosting:platform --project cch-design-boards
```

Or double-click `DEPLOY-PRODUCTION-DANGER.bat`.

Verify: https://cch-platform.web.app — no staging banner, hard refresh, queue verify steps.

## Functions deploy

Secrets are per-project. Set secret first (see `cch-firebase-secrets` skill), then:

```powershell
firebase deploy --only functions:draftInvoiceSummary --project staging
```

Replace function name and project as needed.

## After deploy

1. Flip queue line: `STATUS: done (staging deploy YYYY-MM-DD HH:MM)` or production equivalent
2. Note prod baseline commit if production
3. Commit + push **only when Cindy asks**

## Environment reference

| Target | `--project` flag | URL |
|--------|------------------|-----|
| Staging | `staging` (alias → `cch-studio-staging`) | cch-platform-staging.web.app |
| Production | `cch-design-boards` | cch-platform.web.app |

**No shared Firestore data** between projects.

## Related rules

- `commit-deploy-policy.mdc`
- `cch-staging-production.mdc`
- `cch-platform-js-edits.mdc`
- `cch-agent-handoff.mdc`
