# WO-091 DONE — Client Ideas (Immediate) · CR Aug 07

**Cindy lock:** Immediate — ideas show on Client Ideas right away.

## Grounding
- Portal inspirations: `client.html` ~9457+
- Storage/create blocked for unauth → Cloud Function Admin SDK
- Notify: reuse WO-089 fields (`source: 'client_pepper'`) on messages + staffChat + activity

## Change
1. **`functions/index.js`** — `clientPortalShareIdea` (CORS prod+staging, 120s, 512MiB): upload/URL → Storage `images/ideabooks/{pid}/client-ideas/…` → ideabook doc `client-ideas` (`boardKind: clientIdeas`, `clientPublished: true`) → notify Cindy+Vanessa
2. **`platform/cch-client-ideas.js`** — Share modal (file + URL + caption); remove own idea (soft `hiddenFromClient`)
3. **`platform/client.html`** — Share an idea on Inspirations; Client Ideas badge; hide hidden rows; caption/from-you UI
4. **`platform/index.html`** — Studio Client Ideas card badge + per-image Client chip; portal preview Share button; build **9.9.111**

## Build
Studio **9.9.111** / `wo091-client-ideas-2026-08-07`  
Portal script `cch-client-ideas.js?v=20260807ci091`

## Verify (staging)
1. Deploy hosting + `functions:clientPortalShareIdea` to staging
2. Portal → Inspirations → Share an idea (identity first)
3. Image appears on **Client Ideas**; Studio Inspiration shows Client badge
4. Staff chat unread for owner + vanessa
5. Client Remove my idea hides it from portal; curated boards untouched
