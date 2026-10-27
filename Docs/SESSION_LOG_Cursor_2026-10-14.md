# Session log — Cursor — 2026-10-14

## Staging catch-up

Cindy asked to put the current Studio on staging. `firebase deploy --only hosting:platform --project staging` finished about 18:50. Live https://cch-platform-staging.web.app is Studio 9.9.386, tag `po-bill-cancelled`. Confirmed `const CCH_BUILD` on the staging index. Orange STAGING banner is in the page. Functions were not deployed. No commit. Production was not deployed.

That upload is the working copy: production fixes through 9.9.385, plus WO-298 (Cancelled on a vendor bill). WO-298 production queue line stays pending.

## Not on staging

WO-299 approved-decisions checklist is still OPEN and not built. A portal approval does not add a checklist line yet. The Add to the checklist button is not on decision posts.

Staging Firestore is a different project. Rolling Hills invoices and purchase orders from production are not on staging.

## Also this session

INV-6079 notes typed after the Oct 13 restore are not in Firestore. The Edit Notes Save button toasts before the 1.5 second write, and a refresh drops it. No code change for that yet.

Vanessa’s Windows login `VanessaHolliday` was added to `CLAUDE.md` Key People.
