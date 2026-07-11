# WO-012 · Follow-Ups: Studio docs only (exclude Houzz) + fix .select() crash · CW Jul 11 (v1.1)
**Change ID:** pending #1 assign (BF) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
Refines the live Follow-Ups module (cch-followups.js, build 20260711fu2/fu4). No new data.
**v1.1 adds change #3** — the live `.select() is not a function` crash Cindy's console shows on every board.

## Problem (Cindy, Jul 11, viewing live Follow-Ups on Rolling Hills)
The "paid · no PO placed" lane is flooded with HOUZZ LEGACY invoices (IN-11xxx / IN-12xxx). Those POs
were placed in Houzz historically, not Studio — they are NOT real stalls. Follow-Ups showed 65+ mostly-
noise rows because of this. **The stall detectors must apply to STUDIO-native docs only, never Houzz docs.**

## Grounded markers (a doc is Houzz-sourced if ANY of these)
- `houzzId` present/non-empty (68 uses in index.html — strongest signal)
- `source === 'houzz-import'` (also `Source:'houzz-import'`)
- `isHouzz` truthy
- (`houzzInvoice`, `importedFrom` also present on legacy docs — secondary)
Studio-native docs lack all of these (and use INV-6xxx numbering; markers are the reliable test, not the number).

## Changes
1. **Exclude Houzz-sourced docs from the Lane B "waiting on you" detectors that assume the Studio
   workflow** — at minimum #7 "paid · no PO placed", and review #6 "approved not invoiced", #8 "decision
   answered no follow-through", #10 "selections no proposal": skip any invoice/proposal/PO/board doc with
   a Houzz marker. Add one helper `cchDocIsStudioNative(d)` = `!(d.houzzId || d.source==='houzz-import' ||
   d.isHouzz)` and gate those detectors on it.
   - Client-court detectors (unpaid invoice aging, unanswered decision) MAY still apply to Houzz docs if
     the money/decision is genuinely still open today — but if that also proves noisy, gate them too.
     Cindy's rule of thumb: "only apply to Studio docs, not Houzz docs." Default to Studio-only everywhere;
     flag any detector where excluding Houzz would hide a genuine live item.
2. **Fix "No hours logged in 999 days" bug.** When there is no last time entry / no valid date, do NOT
   compute a 999-day age. Either suppress the row, or label it "No time logged yet" with no day count.
   999 is a missing-date artifact.

3. **Fix the `.select()` crash (cch-followups.js:235-236).** `fuLoadProjectBundle` calls
   `board.collection('clips').select('room').limit(250).get()` and
   `board.collection('designBoards').select('name','updatedAt','createdAt').get()`. `.select()` is a
   **Firestore Admin-SDK** field-mask method that does NOT exist in the browser SDK — it throws
   synchronously (`board.collection(...).select is not a function`), BEFORE `.get()`, so the attached
   `.catch()` never runs and the whole `extra` `Promise.all` rejects (outer catch logs "[follow-ups] bundle
   load … TypeError"). Result: `bundle.clips`, `bundle.ideabooks`, `bundle.designBoards` are empty for every
   project, so the clip/board-based detectors silently see nothing. **Fix: drop `.select(...)`** (web SDK has
   no field projection — fetch full docs):
   - `board.collection('clips').limit(250).get().catch(function() { return fuEmptySnap(); })`
   - `board.collection('designBoards').get().catch(function() { return fuEmptySnap(); })`
   Keep the `.limit(250)` on clips. Bump the build tag (…fu4 → fu5) with note "drop Admin-SDK .select();
   Studio-only detectors; 999-day fix".

## Acceptance (binary)
1. On Rolling Hills, "paid · no PO placed" no longer lists Houzz legacy invoices (IN-11xxx/IN-12xxx);
   the Follow-Ups count drops to genuine Studio-native stalls.
2. A Studio-native paid invoice with no PO still DOES appear (detector still works for real cases).
3. No row shows "999 days"; missing-date case reads sensibly or is suppressed.
4. **Zero console errors — the `board.collection(...).select is not a function` TypeError is gone**; clips
   and designBoards now load (verify a clip/board-based detector can fire).

## Verify (Claude, staging)
Rolling Hills Follow-Ups before/after count; confirm Houzz invoices gone, a real Studio stall still shows;
confirm no 999. Screenshot to loop/verify/WO-012/.

## Note for production
Cindy: in production the connected PO↔invoice docs may already suppress some of these — but the Houzz
exclusion is the correct guard regardless, so it holds in both environments.

## DONE note
loop/WO-012_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
