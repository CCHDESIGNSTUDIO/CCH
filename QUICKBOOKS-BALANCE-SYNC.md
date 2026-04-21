# QuickBooks paid status → CCH Studio (balance sync)

Use this when invoices are **paid in QuickBooks** but CCH Studio still shows **Draft**, full balance, or **QB Sent** instead of **Paid** / **$0**.

Studio learns paid state from either the **QB webhook** (automatic) or these **manual sync** actions (callable Cloud Functions).

## Plain English: why it can feel “broken”

There are **two different steps**. People often mix them up:

| Step | What it is | Where it runs |
|------|----------------|----------------|
| **A. Deploy** | Uploads your **Cloud Functions** code from your PC to **Firebase (Google)** | Your terminal: `firebase deploy …` |
| **B. Sync button** | The **Studio website** in the browser asks Google to run that code, which then talks to **QuickBooks** | Browser only |

- If **Step A never finishes successfully**, **Step B will always fail** (Studio cannot “magically” run code that is not deployed).
- After **A** works once, **B** runs each time you click the button (if you are signed in and allowed).

Studio now runs a tiny **`healthCheck`** before QB sync. If that fails, the problem is almost always **Step A** (deploy / project / region), not QuickBooks.

---

## 1. One-time: deploy the Cloud Functions

The buttons call Firebase **callable** functions in region **us-central1**. If they are not deployed, the browser error is usually `NOT_FOUND` / `not-found`.

1. Open a terminal.
2. `cd` to the **`cch-deploy`** folder (the one that contains `firebase.json` and the **`Functions`** folder — note the capital **F** on Windows).

   **Important:** Firebase deploy reads **`Functions/index.js`** only (`package.json` has `"main": "index.js"`). Other files in that folder such as **`functions-index.js`** or **`functions-package.json`** are **not** used by `firebase deploy` — do not confuse them with the real entry file.
3. Install deps if needed: `cd Functions` then `npm install`, then `cd ..`.
4. Deploy **both** callables. **On Windows PowerShell**, the comma must stay inside quotes or PowerShell splits the command and the deploy fails:

```powershell
firebase deploy --only "functions:syncInvoiceBalanceFromQB,functions:batchSyncInvoiceBalancesFromQB"
```

macOS / Linux / **cmd.exe** (same quoted form works everywhere):

```bash
firebase deploy --only "functions:syncInvoiceBalanceFromQB,functions:batchSyncInvoiceBalancesFromQB"
```

If you prefer two separate runs (no comma):

```bash
firebase deploy --only functions:syncInvoiceBalanceFromQB
firebase deploy --only functions:batchSyncInvoiceBalancesFromQB
```

5. In [Firebase Console](https://console.firebase.google.com/) → your project → **Functions**, confirm:
   - `syncInvoiceBalanceFromQB`
   - `batchSyncInvoiceBalancesFromQB`  
   both exist and show region **us-central1**.

### Deploy error: `functions.runWith is not a function`

That comes from **`firebase-functions` v7** when the code does `require("firebase-functions")` (wrong default for this codebase).  
**Fix:** the first line of `Functions/index.js` must be:

`const functions = require("firebase-functions/v1");`

Save that file, then run `firebase deploy` again (at least `functions:…` or all `functions`).

---

## 2. Deploy hosting (Studio UI)

After changing `platform/index.html`, deploy **hosting** for the site you use (often `platform`):

```bash
firebase deploy --only hosting:platform
```

Use **Ctrl+Shift+R** on Studio so the browser does not use an old cached `index.html`.

---

## 3. Who can run sync

Only accounts on the **QuickBooks push** allow-list can run these (same as “Push to QuickBooks”). If you get **permission-denied**, your Studio email must be added to that list in code / admin process your team uses.

You must be **signed in** to Studio with Firebase (same as the rest of the app). If you get **unauthenticated**, sign out, sign in again, hard refresh, retry.

---

## 4. How QuickBooks rows are found

The server loads the invoice from QuickBooks in this order:

1. **Numeric `qbDocId` (preferred)** — the QuickBooks internal **Id**, not the customer-facing DocNumber.  
   In QuickBooks: open the invoice → the **URL** contains the numeric id (…/invoice?txnId=**12345** or similar depending on UI). That number is what should live in Firestore as `qbDocId` after a healthy “Push to QuickBooks” from Studio.
2. **If `qbDocId` is missing or looks like `INV-6012`** — the function tries QuickBooks **SQL** `DocNumber` using Studio fields such as `invoiceNum` / `number` (and common variants like `INV-6012` vs `6012`).  
   If exactly one QB invoice matches, Studio **updates `qbDocId` to the numeric Id** for next time.

If nothing matches, fix **DocNumber** in QB or set **`qbDocId`** to the numeric Id on the Studio invoice.

---

## 5. Where to click in Studio

### All Invoices (global list)

1. Go to **All Invoices** (or the global invoices view that shows the top toolbar).
2. Click **↻ Sync QB paid** (only visible if your user can push to QB).  
   - Processes up to **200** invoices per run (oldest board order as implemented).  
   - **Run again** to pull another batch if you have more than 200 linked rows.

### Single invoice

1. Open the row **⋮** menu on an invoice that is linked to QB (or has an invoice # that matches QB).
2. Choose **↻ Refresh paid from QuickBooks**.

---

## 6. Interpreting results

| Symptom | Likely cause |
|--------|----------------|
| Error mentions **not found** / **NOT_FOUND** | Functions not deployed, wrong Firebase project, or wrong region. Redeploy (section 1). |
| **permission-denied** | Email not on QB push allow-list. |
| **unauthenticated** | Not signed in to Firebase in Studio; refresh session. |
| Batch toast: **updated 0 / scanned 0** | No invoices had a numeric id **or** any invoice # candidates. Add numeric `qbDocId` or align invoice # with QB DocNumber. |
| Batch: **scanned N, updated 0** | QB still shows an open balance for those rows, or per-row errors — open DevTools → **Console** and look for `[batchSyncInvoiceBalancesFromQB]` sample errors. |
| Single row: **Multiple QuickBooks invoices match DocNumber** | Duplicate DocNumbers in QB; resolve in QB or set numeric `qbDocId` manually. |

---

## 7. Optional: confirm Firestore before/after

For one invoice document: `boards/{projectId}/invoices/{invoiceId}`

- **`qbDocId`**: should become **digits only** after a successful push or after a successful DocNumber match sync.
- **`qbBalanceSyncedAt`**, **`qbApiBalance`**: set after a successful sync.

---

## 8. Large backfills (~2k invoices)

The batch job caps at **200** invoices per invocation (configurable server-side up to 500). Run **↻ Sync QB paid** repeatedly until `scanned` drops or stays at 0, or increase `maxInvoices` in a future change if your team needs larger batches.

---

## Support checklist (copy/paste)

- [ ] `firebase deploy --only "functions:syncInvoiceBalanceFromQB,functions:batchSyncInvoiceBalancesFromQB"` from **`cch-deploy`** (quote the `--only` value in PowerShell)
- [ ] Console shows both functions in **us-central1**
- [ ] `firebase deploy --only hosting:platform` after UI changes
- [ ] Hard refresh Studio
- [ ] Signed in with allow-listed email
- [ ] Failing row has numeric **Id** in QB or **DocNumber** matches Studio invoice #
