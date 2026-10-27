# WO-332 DONE — Decision banner names who posted it

Cindy Oct 23. Vanessa posting a decision the client still has to make is what the banner is for. It must not say the client did it.

## What changed

`platform/cch-pepper.js`

- A studio `decision_posted` or `decision_updated` still opens the banner.
- The title is “Vanessa posted a decision that needs the client,” using the staff name on the activity.
- A real client action still says “The client just did this on the portal.”
- Client activity list still does not treat that staff post as the client acting.

Studio 9.9.417, tag `decision-needs-client`. Cache `cch-pepper.js?v=20261023wo332`.

## Verify

Hard refresh https://cch-platform.web.app. The next time Vanessa posts a decision, the banner names her. It does not say the client did it.
