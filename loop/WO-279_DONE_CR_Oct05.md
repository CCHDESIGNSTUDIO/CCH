# WO-279 DONE — portal Pepper speaks to staff as staff

Cindy Oct 5, staging. Portal Pepper said she had proposals to review.

## Change

`platform/cch-client-pepper.js`, mount in `platform/client.html` and `platform/index.html`.

When Cindy or Vanessa is signed in, the greeting names the project client. Example: “Hi Cindy, it's Pepper. Tracy has 3 proposals to review.” A client note is quoted if one is saved. The box no longer says it will pass a note to Cindy. A real client still hears the client greeting.

## Verify

Hard refresh the Rolling Hills client portal on staging while signed in as Cindy. Pepper should say Tracy has the open items.
