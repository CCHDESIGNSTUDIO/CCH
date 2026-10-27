# WO-299 DONE — Approved decisions checklist

**Date:** 2026-10-16
**State:** DONE-UNVERIFIED
**Deploy:** staging hosting + firestore rules ~12:11. Studio 9.9.388. Production not deployed.

## What Cindy asked, later than the original spec

A button on the posted decision says **Add to the checklist**. Approving a decision does not add a line by itself. The original work-order line that said a client approval adds a line automatically is not what shipped.

## What changed

- `platform/cch-portal-records.js` — Checklist page. Newest, or by room. Staff quick-add (phone, text, email, site, portal). Mark replaced keeps the old line, crossed out, with a note. Print opens its own page. Clients cannot edit or delete.
- `platform/index.html` ~82573 and `platform/client.html` ~11608 — staff block on the decision card, button before Delete. Edit stays.
- `platform/cch-pepper.js` — staff Pepper digest includes the checklist. Cache `cch-pepper.js?v=20261016wo299`.
- `firestore.rules` — `decisionChecklist` read for the portal, write for staff.

## Not changed

Shared print CSS. Decisions page (the big posts) still exists. No money writes.

## Verify

Hard refresh staging. Open a project portal. Checklist in the sidebar. On a decision card, while signed in as staff, Add to the checklist. The line shows on Checklist. Client view has no quick-add and no Mark replaced.
