# WO-019 · Follow-Ups: exclude Houzz from EVERY lane incl. "Waiting on Client" (completes WO-012) · CW Jul 11
**Change ID:** pending #1 assign (BF) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
Corrects/completes WO-012. cch-followups.js. No data change.

## What Cindy said (Jul 11, live Follow-Ups)
"Still showing old Houzz under follow up." The **Waiting on Client** lane lists Houzz legacy invoices
(IN-12902, IN-12929, IN-12936, IN-12948 — the IN-11xxx/IN-12xxx band) as "$X balance open." Header reads
"250 stalled handoffs across 7 projects · 233 waiting on you" — still flooded with Houzz noise.

## Root cause (two parts)
1. **My WO-012 was too narrow.** It gated only the Lane B "waiting on you" detectors and explicitly LEFT the
   client-court lane (unpaid-invoice aging) able to show Houzz "if the balance is still open." That's the lane
   showing these IN-12xxx rows. Cindy's rule is Studio-only **everywhere** → gate the client lane too.
2. **Verify WO-012 actually built.** The copy of `cch-followups.js` I can read this session is still
   **BUILD `20260711fu4`**, still calls `.select()` at lines 235-236, and has **no** `cchDocIsStudioNative`
   helper — i.e. the WO-012 Houzz-exclusion + `.select` crash fix may NOT have shipped (staging console shows
   fu5, so either fu5 didn't include WO-012's changes, or my device read is stale). **Cursor: confirm the
   deployed build — check the build tag, that `.select()` is gone, and that `cchDocIsStudioNative` exists.**

## Grounded anchors (re-grep — device read may be stale)
- Invoice-aging rows (the Waiting-on-Client lane): `cch-followups.js:405-406`
  `(inv.invoiceNum || inv.number) + ' · ' + fuMoney(bal) + ' balance open'` / "Partially paid|Sent …".
- Lane stat card: `:756` `fuStatCard(clientLane.length, 'Waiting on client', …)`.
- `.select()` (Admin-SDK, invalid in web SDK): `:235-236` — must be dropped (see WO-012 #3).

## Changes
1. **REUSE the platform's canonical Houzz detector — do not invent a parallel one.** Order Management already
   has the battle-tested detector that works correctly in production:
   `window.cchOmIsHouzzSourcePo(po)` (`cch-order-management.js:48`) — checks `houzzImport===true`,
   `source` contains 'houzz', `houzzBalance` present, `_qbIdSource==='houzz-import'`, member contains 'houzz',
   and the legacy 400xxx number scheme (`cchOmIsLegacyHouzzNumber`). For Follow-Ups, use that same field set
   (generalized to invoices/proposals/decisions: also `houzzId`, `houzzInvoice`, `source==='houzz-import'`,
   `isHouzz`, `importedFrom`, and the IN-11xxx/IN-12xxx invoice band as a fallback only when no marker field
   is present). If a shared helper is cleaner, factor `cchOmIsHouzzSourcePo`'s logic into a
   `window.cchIsHouzzSourceDoc(doc)` both modules call — but keep behavior identical to the OM detector.
2. **Gate EVERY detector/lane on it — including Waiting on Client (invoice aging).** No Houzz-sourced invoice,
   proposal, PO, decision, or board doc produces a Follow-Up row, in either lane. Default Studio-only across
   the board (this is Cindy's standing rule). If any single detector would hide a genuine live item by
   excluding Houzz, leave a code comment naming it — but default to exclude.
3. **Also ensure WO-012's other two fixes are in:** drop `.select()` at 235-236 (fetch full docs,
   `.limit(250)` on clips kept); and the "999 days" missing-date artifact is suppressed / labeled.
4. Bump the build tag (→ fu6) with note "Houzz excluded in ALL lanes incl. client-court; .select dropped;
   999-day fix".

## Acceptance (binary)
1. Follow-Ups shows NO Houzz legacy invoices (IN-11xxx/IN-12xxx) in ANY lane, including Waiting on Client.
2. The header count drops to genuine Studio-native stalls (the 250/233 collapses substantially).
3. A Studio-native open invoice / real stall still appears (detectors still work for real cases).
4. No "999 days"; `.select` TypeError gone from console; zero console errors.
5. `node --check` (if applicable) / lint clean; build tag shows fu6.

## Verify (Claude, staging)
Rolling Hills + cross-project Follow-Ups: confirm all IN-12xxx Houzz rows gone from Waiting on Client and
Waiting on You; confirm a real Studio stall still shows; confirm console has no `.select` error and no 999.
Screenshot before/after counts to loop/verify/WO-019/.

## DONE note
loop/WO-019_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
