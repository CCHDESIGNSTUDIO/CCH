# WO-085 §C DONE — Builder → Activity Feed + Builder tab · CR Aug 06

**Scope shipped:** Part C only (Order Builder activity + filter chip). Parts A/B (recency window, missing Studio event capture) still OPEN / held.

## Grounding
- Builder save: `platform/builder/index.html` `saveWorkOrder` (~6178+) — create / save / New Revision all go through this one write.
- Feed filters: `platform/index.html` `renderActivityView` typeButtons (~80346).
- Activity shape: `logActivity` (~80249) — type, action, description, projectId, projectName, user, timestamp, meta.

## Changes
1. **`builder/index.html`** — `logBuilderWorkOrderActivity` after successful `docRef.set`; actions `created` | `updated` | `revised`; type `builder`; label e.g. `WES-U-01 · Craft Room work order saved`. Failures warn only (never block save). Meta: workOrderId, number, room, revision, category, source `order_builder`. Rev meta `2026-08-06ft063-activity`.
2. **`index.html`** — filter chip **Builder**; CSS badge/dot for `builder`; icon in `renderActivityItem`; action color for `revised`.

## Self-test
- `node --check` N/A (builder is HTML-inline). Manual: staging → Order Builder → Save WO on a project → Activity Feed → **Builder** tab shows the event; project Overview Recent Activity picks up same `activity` collection.

## Deploy
Staging hosting (includes `platform/builder/`). Build **9.9.103**.
