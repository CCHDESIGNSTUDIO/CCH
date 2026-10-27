# WO-331 DONE — Staff post is not a client portal action

Cindy Oct 23, Holtz Hill. The banner said “The client just did this on the portal” for “Posted inspiration board decision for client: Living Room Fireplace Options.” Vanessa posted that decision. The client did not.

## Grounding

- `cpPostIdeabookAsDecision` in `platform/index.html` ~83354 logged the staff post with type `client_portal`.
- `logActivity` ~87120 sets `authorType: 'designer'` when a signed-in studio user writes it.
- `pepperActivityIsClient` in `platform/cch-pepper.js` treated any `type === 'client_portal'` as the client, then the card title used “The client” (`pepperClientWho` ~2954, `pepperRenderClientCard` ~3001).
- `caIsClientDoc` in `platform/cch-client-activity.js` ~54 did the same for the Client activity list.

## What changed

- Those three staff “posted for client” logs now use type `decision`.
- Pepper and Client activity skip `authorType` designer/staff, and skip `decision_posted` / `decision_updated`.
- Studio 9.9.416, tag `staff-not-client`. Cache `cch-pepper.js?v=20261023wo331`, `cch-client-activity.js?v=20261023wo331`.

## Verify

Hard refresh https://cch-platform.web.app/#/project/holtz-hill. The Living Room Fireplace Options post should not come back as “The client just did this.” A real client action still does.
