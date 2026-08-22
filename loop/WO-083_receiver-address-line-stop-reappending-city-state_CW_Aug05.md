# WO-083 · Address book — stop the main ADDRESS line from re-appending city/state/zip · CW Aug 05
**Change ID:** pending #1 · **Lane:** Studio platform (Address book — Delivery/Receivers, and the shared Vendor/Workroom edit modal) · **State:** OPEN · **Executor:** Claude Code (index.html ~5MB, OOMs Cursor) · **Verifier:** Fable · **Gate:** Cindy GO for prod
**File:** `platform/index.html` — the **Edit Delivery / Receiver** modal (route `#/deliveryreceivers`) and the shared contact/address edit modal (same modal serves Vendors / Workrooms per the "MOVE TO DIFFERENT CATEGORY" buttons). Look at the record **save handler** and the **load/prefill** that builds the ADDRESS field. **Build + queue in `_DEPLOY_QUEUE.md` for #1 to deploy staging. Staging first; minimal diff; targeted edits only, no wholesale load.**

## What Cindy hit (Designers Moving Service record)
The **ADDRESS** (main line) shows the full address concatenated: `610 S. Grand Ave # 103Santa Ana, California 92705` (note the missing space before "Santa Ana" — a string-join with no separator). Meanwhile the broken-out **CITY** (Santa Ana), **STATE** (California), **ZIP** (92705) fields are also filled. When Cindy deletes the city/state/zip from the main ADDRESS line and saves, **they come back.** Her words: "That was how it was originally set up until we broke it all out." The address was migrated into separate fields, but the legacy "one line" composition was never turned off, so it keeps rebuilding the composite over her edit.

## Desired behavior
1. **The main ADDRESS line holds the street only** (e.g. `610 S. Grand Ave # 103`). The broken-out **CITY / STATE / ZIP fields are the source of truth** for those parts.
2. **Her manual edit persists.** If she removes city/state/zip from the ADDRESS line and saves, it stays removed after save AND after reload. Nothing re-appends them.
3. **Fix the join bug:** wherever the app still composes a full address for display/print, insert proper separators (space before city, comma before state, so it reads `610 S. Grand Ave # 103, Santa Ana, California 92705`), never `103Santa Ana`.

## The critical guardrail (do not lose city/state on documents)
Legacy records stored the FULL address in the ADDRESS line, so some views/prints may read only that one field. **Before making the ADDRESS line street-only, make sure every place that shows or prints a receiver/vendor address composes the full address from street + city + state + zip** (PO ship-to / receiver block, tear sheets, any document or label that prints this contact). The goal is: the main line becomes street-only in the editor, but nothing downstream suddenly prints an address missing its city/state/zip. If a print path today reads the single ADDRESS field, switch it to compose from the parts.

## Guardrails
1. **No destructive data migration.** Do not bulk-rewrite everyone's stored addresses. Turn OFF the auto-append so edits persist; that alone fixes it going forward. For a legacy record whose ADDRESS line still duplicates the city/state/zip, an OPTIONAL safe cleanup on save is allowed: only if the trailing text of the ADDRESS line exactly matches the CITY/STATE/ZIP fields, trim that duplicate. Never strip anything that isn't an exact duplicate of the parts (could be a real suite/line-2 detail).
2. **Shared modal:** confirm whether Vendors and Workrooms use the same edit modal/save path. If they do, the fix applies to all three; verify a Vendor and a Workroom address also behave (street-only line, parts authoritative, edit persists).
3. **No pricing, no other data touched.** Address fields only.
4. Minimal diff on the 5MB file; if it balloons, stop and flag rather than rewrite the modal.

## Acceptance (Fable, staging screenshots)
1. Open the Designers Moving Service receiver: delete the city/state/zip from the ADDRESS line, leaving `610 S. Grand Ave # 103`, save, reopen. The ADDRESS line still reads street-only. City/State/Zip still correct in their own fields.
2. Do the same on a Vendor and a Workroom record (if shared modal): edit persists, no re-append.
3. A document/print that shows this receiver's address (PO ship-to or equivalent) still shows the COMPLETE address (street + city + state + zip), composed from the parts, with proper spacing/commas, no `103Santa Ana` run-together.
4. No console errors.
Screenshots to Fable = sign-off, then Cindy GO for prod.

## Ledger
Add: WO-083 · Address book — main ADDRESS line street-only, stop re-appending city/state/zip over the broken-out fields; compose full address from parts for print (no lost city/state); fix missing-separator join · Code exec (index.html OOMs Cursor) · build + queue for #1 · staging first.
