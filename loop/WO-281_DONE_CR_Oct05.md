# WO-281 DONE — Portal star stays on the inspiration board

Cindy Oct 5: starring an inspiration image on the portal kicks her out.

## Grounding

- `platform/client.html` `cpPortalToggleInspirationStar` ~7657 calls `cpPortalEnsureClientIdentity` when there is no portal email.
- `cpPortalEnsureClientIdentity` ~6802 called `cpRenderClientIdentityModal`, which sets `contentArea` innerHTML to the full-page Welcome card (~6674). The inspiration board is gone.
- Signed-in staff who chose “Skip — studio preview only” have `_cpClientIdentity` null (`client.html` ~6757–6760). `cpPortalEffectiveClientIdentity` (~6782) does not load a stored email for staff.
- Ideabook update is allowed for a signed-in user: `firestore.rules` ~218–221 `allow update: if isAuth() || portalIdeabookClientFeedbackUpdate()`.
- The live portal is `client.html`. `platform/index.html` ~4–5 replaces `#/clientview` with `client.html`.

## Change

`platform/client.html` `cpPortalEnsureClientIdentity` (~6802–6822).

When the session is studio staff and Firebase Auth has an email, the star (and the comment / note callers of the same helper) use that signed-in name and email. The welcome screen is not drawn. A real client with no saved email still gets the welcome screen.

## Self-test

Read-back of the helper. No `node --check` (inline in `client.html`). Not deployed. Browser check waits on a staging deploy: hard refresh the client portal, open an inspiration board, star an image, board stays, star toggles.

## Surfaces

Client portal inspiration board only. Print, proposals, invoices, POs, and prices unchanged.
