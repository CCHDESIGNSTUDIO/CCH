# WO-110 — Activity Feed rebuild: real dates, idempotent, Studio-only (no Houzz)

**CW_Aug09** · Lane: **Cursor** · Fixes the "Rebuild from Existing Data" backfill on the Activity Feed. Protects the data quality that WO-085 (capture), WO-108 (person filter), and WO-106 (all-seeing) all depend on.

## What Cindy saw
Old Houzz-era Shimano-Maverick POs (PO-400131..134, 400093) showed up under "TODAY," each **duplicated** (12:11 and 12:23). Three bugs in one:
1. Backfilled events stamped **"now"** instead of the record's real date → old records masquerade as today, "22 today" is inflated.
2. Rebuild is **not idempotent** → clicked twice, every event duplicated.
3. **Houzz-imported legacy records** were turned into "activity" at all. Cindy wants **only Studio activity, never the Houzz migration.**

## Change
1. **Real timestamps.** Backfilled events use each source record's `createdAt` (fallback `updatedAt`), never the rebuild time. Old records land on their real dates; the "today" count reflects genuine today.
2. **Idempotent rebuild.** Write a **deterministic event id per source record** (e.g. `evt_{collection}_{docId}`) and **upsert**, so re-running Rebuild updates in place instead of appending. Also de-dupe the existing duplicate events on the next run.
3. **Studio-only — exclude Houzz/legacy entirely.** Skip any record flagged Houzz/import when generating events: `source == 'houzz-import'` (or contains `houzz`), `houzzInvoice`, `_fromClips`, `IN-`-style legacy doc numbers, and the `importedAt` 2026-03-18 batch. Confirm the exact flag per collection on grounding (the Houzz research docs list them). Only Studio-native records produce activity.

## Guardrails
- **Read-only backfill:** writes `activity` events only; never modifies the source POs / invoices / records.
- Accuracy: real dates, no duplicates, Studio-only. Internal (staff) feed.
- Same Houzz/Studio distinction should be honored wherever Pepper reads data (the WO-106 firm-wide rollup and the money loop must not count Houzz-imported POs/invoices as real Studio work) — cross-ref, handle there too.

## Grounding
`renderActivityFeed` (`#/activity`) + the "Rebuild from Existing Data" handler (`rebuildFinancialSummary`-adjacent / the activity rebuild fn); the `activity` event shape; Houzz source flags per collection (`source:'houzz-import'`, `houzzInvoice`, `invoiceRef` `IN-…`, `importedAt` 2026-03-18) documented in the `HOUZZ_TIME_INVOICE_RESEARCH` docs. Completes WO-085 Part B (exclude legacy from the feed) for both the live feed and the rebuild.

## Acceptance
1. After rebuild, every event carries the source record's **real date**; old POs no longer appear under "today"; the "today" tile reflects genuine today's Studio activity.
2. Running Rebuild twice yields **no duplicate events**.
3. **No Houzz-imported record** appears anywhere in the Activity Feed (live or rebuilt).
4. Verified on staging, then prod on Cindy's GO.
