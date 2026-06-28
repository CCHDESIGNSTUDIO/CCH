# Houzz data for CCH Studio

This note is for anyone wiring **Houzz Pro** exports into **CCH Studio** (Firestore + the deploy bundle). It explains **Legacy vs current Houzz**, why interim files looked nothing alike, and **which tool reads which artifact**.

## Canonical local folder (Dropbox, not in git)

Use a single Dropbox stash so paths stay predictable:

`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\`

**April 2026:** Houzz eventually delivered a **full** export (team reference: file dated **2026-04-26** in that folder). Treat that workbook as the **book of record** for transaction-style imports once its exact filename is wired into the scripts below.

Other bundles in the same folder (for example catalog CSV + image pulls named like `cchdesign_0427`) are **different products** from Houzz: they are great for **catalog / board imagery**, but they are **not** a substitute for the **“All transactions”** style spreadsheet the PO payment merge expects.

## Legacy vs “new” Houzz (why formats diverged)

- **Legacy** exports and **current Houzz Pro** reports often use **different column names, sheet names, and row shapes**. Anything scraped or exported while Houzz was still filling in data was necessarily **piecemeal** (Project Tracker CSVs, partial JSON, older “All transactions” snapshots). Those **do not** share one universal layout.
- **Operational rule:** pick **one authoritative transaction workbook** after Houzz has finished the delivery you care about, then re-run imports. Mixing an old “All transactions” file with rows only present in a newer export produces **gaps** unless you merge carefully outside Studio.

## What each part of CCH expects

### 1. Node CLI — `cch-deploy/import-houzz-data.js`

- Reads a **transaction workbook** (`.xlsx`) from disk and pushes merged data toward Firestore (boards: clips, invoices, proposals, purchase orders; plus `products`).
- **Path:** set environment variable `HOUZZ_ALL_TXN_XLSX` to the full path of your latest Houzz export, **or** edit the default `XLS_PATH` in that file. Prefer the **2026-04-26** canonical file once you confirm its filename on disk.
- **Images:** `IMAGE_MAP_PATH` and `IMAGE_BASE_DIR` are separate; they do not replace the transaction workbook.

### 2. Browser — **Purchase Orders → “PO payments (Houzz)”**

- User selects **any** `.xlsx`. The parser in `platform/index.html` looks for a **header row** (including `Code` and `Transaction Type`) or falls back to an older **fixed-column** layout.
- This path updates **`payments[]`** on purchase orders when rows match PO codes and board projects — **not** the same as pushing QuickBooks IDs alone.

### 3. Browser — **Settings → patch from transactions** (`patchFromQBTransactions`)

- Uses the same family of Houzz transaction files to patch **QuickBooks document IDs** on invoices / POs. It does **not** by itself write PO **payment lines**; use **PO payments (Houzz)** or manual PO entry for paid amounts.

### 4. `platform/houzz_qb_ids.json`

- Static **Houzz → QuickBooks id** map used by `applyHouzzQBIds()`. Handy for IDs; **not** a source of paid balances.

## If a new export fails to parse

1. Open the workbook and note **sheet names** and the **exact header row** (first row of column titles).
2. Compare to the logic around `chParseHouzzTxnPurchaseOrderRows` / `chHouzzTxnMoneyCell` in `platform/index.html` (and any parallel assumptions in `import-houzz-data.js`).
3. Extend the parser for the new header names, or ask Houzz for an export that matches the **“All transactions”** layout you last validated.

## Legacy repair (clients, document tags, duplicate docs)

`import-houzz-data.js` only reads **transaction** workbooks. It does **not** map **Document Tags**, and it sets minimal board client fields (`clientName` from project title, `clientAddress` from first row). Re-imports created **case duplicates** (`in-12006` + `IN-12006`). The full **Clients.csv** dump was used for recon, not merged back.

Use **`merge-houzz-legacy.js`** instead of more spreadsheets:

1. **`HOUZZ_CLIENTS_CSV`** → `Houzz FILES/ARCHIVE/Clients.csv` (email, phone, address on `boards/{id}`).
2. **`HOUZZ_TXN_XLSX`** → per-project **transaction** export (same shape as `Cloud - HB reports-….xlsx` or “All transactions”), **not** `project_tracker_report` files.
3. Dedupes invoice/proposal docs (keeps lowercase id when present).

Dry run (no writes): `node merge-houzz-legacy.js --project cloud-susan`  
Apply with backup: `node merge-houzz-legacy.js --project cloud-susan --apply --backup ./_backup/cloud-susan`

## Quick checklist after a new Houzz drop

1. Save the **2026-04-26** (or newer) **transaction** `.xlsx` under `Houzz FILES` (or a dated subfolder) and record the **full path**.
2. Set `HOUZZ_ALL_TXN_XLSX` or update `XLS_PATH` in `import-houzz-data.js`, then run the CLI import if you use it.
3. Run **`merge-houzz-legacy.js`** (dry run first) to backfill **Clients.csv** + **Document Tags** and remove case duplicates.
4. In Studio (admin): run **PO payments (Houzz)** with the **same** workbook so PO `payments[]` stays aligned with the CLI/book of record.
