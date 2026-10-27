# Golden reference — DS invoice expenses (FROZEN)

**Decision:** `Docs/FABLE_DECISION_ds-invoice-expenses_CW_Jul30_v1.0.md`

| File | Role |
|------|------|
| `v1/FIXTURE.json` | Staging-native invoice data (hours + T&E + handling + reimbursable + prepaid) |
| `v1/client-view.html` | Frozen DS Client View HTML render |
| `_scripts/render-ds-expense-golden_BY_CURSOR.js` | Regenerate HTML from fixture + redesign.js |
| `_scripts/check-ds-expense-golden_BY_CURSOR.js` | Fail if render drifted |

```powershell
cd C:\dev\CCH-Platform-Deploy\cch-deploy
node _scripts\render-ds-expense-golden_BY_CURSOR.js
node _scripts\check-ds-expense-golden_BY_CURSOR.js
```

Staging seed (optional):

```powershell
$env:APPLY='1'; node _scripts\seed-stg-ds-expense-golden_BY_CURSOR.js
```

Open: staging project `cloud-rolling-hills` → invoice `INV-STG-DS-EXPENSE-GOLDEN` / `INV-STG-DS-GOLD`.
