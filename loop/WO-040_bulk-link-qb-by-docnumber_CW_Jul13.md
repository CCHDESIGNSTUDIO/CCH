# WO-040 · Bulk-link unlinked invoices/POs to QuickBooks by DocNumber (pull IDs from QB, not the Houzz dump) · CW Jul 13
**Change ID:** pending #1 assign (QB) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
QB cloud function + `platform/index.html` (a toolbar action). **Staging/test-realm first; prod on Cindy GO.**

## Why (evidence, Jul 13)
Cindy wants the red QB dots on a project's invoices (e.g., Shimano - Maverick Cir: IN-10074 … IN-10178) turned
green. Investigation:
- Those invoices are **NOT in the bundled map** `platform/houzz_qb_ids.json` (verified: all MISSING; the one
  green row IN-10089 IS in the map → 43556). So "Apply QB IDs" (`applyHouzzQBIds` @41044, map-based) can't green
  them.
- The **Houzz dump does NOT contain QB IDs** (verified: IN-10089's QB id 43556 appears 0× in the dump; invoice
  rows carry only date/amount/client/method; "Quickbooks" only appears as memo text). So they can't be pulled
  from the dump — the assumption that they're there is wrong.
- The QB numeric IDs (74442 for IN-10178, per the QB URL txnId; 43556 for IN-10089) live **in QuickBooks**. The
  original 4,528 map entries were pulled from QB, not Houzz. These newer invoices were just never added.

## Change — a "Link to QB by DocNumber" bulk tool (QB API)
Add a toolbar action on the Invoices/POs pages (near "Apply QB IDs"): **"🔗 Link to QB by #"**. It, for every
doc with **no `qbDocId`**:
1. Queries QuickBooks via the existing QB connection/cloud function for the invoice/PO whose **DocNumber matches
   the Studio code**. NOTE the Houzz suffix: Studio `IN-10178` ↔ QB DocNumber `IN-10178HZ` (confirm the exact
   suffix/format; try both `{code}` and `{code}HZ`). Reuse the auth/connection that `pushInvoiceToQB` @65969 /
   the QB cloud functions already use.
2. On a unique match, stores `qbDocId` = the QB Id (+ `qbSynced:true`, `qbSyncDate`, `_qbIdSource:'qb-docnumber-
   match'`) — same fields `applyHouzzQBIds` writes @41044.
3. **Dry-run first:** produce a manifest (code → matched QB Id / "no match" / "ambiguous") for Cindy's review
   before writing, per the CCH Safety-First rule (financial data). Then Apply on GO.
4. Batch-write; idempotent (skip docs already linked); handle QB API rate limits.

## Alternative if a QB API loop is too heavy now
A one-time **QB export that includes the internal Id** (QBO API `SELECT Id, DocNumber FROM Invoice` → CSV) can be
run once; Claude then merges the new `code → Id` pairs into `houzz_qb_ids.json` (keeping the existing 4,528), and
"Apply QB IDs" greens them. This needs someone to run the QB API query (the platform can, the Houzz dump cannot).

## Acceptance (binary)
1. Running the tool on Shimano - Maverick Cir produces a dry-run manifest matching the red invoices to their QB
   Ids (or flagging no-match), and on Apply the dots go green with correct `qbDocId`.
2. IN-10178 links to QB Id 74442; IN-10089 stays 43556; no duplicates; already-linked docs untouched.
3. No invoice mislinked to the wrong QB record (DocNumber match is exact/unique; ambiguous → skipped + reported).
4. No writes to prod without Cindy GO; dry-run manifest reviewed first.

## Interim (manual, for a few urgent ones)
Open the QB invoice, copy the `txnId` from the URL, then in Studio row menu → **Mark QB Synced / Update QB ID** →
paste the id. Fine for a handful; the bulk tool is for a whole project's backlog.

## DONE note
loop/WO-040_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line.
