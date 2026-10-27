# WO-250 DONE — decision email also drafts the contractor

Cindy Sep 24. Emailing a decision that was shared with the client and the contractor opened one Outlook draft, To the client only. The contractor checkbox only marked the decision for the contractor page.

## Surfaces

- Affects: Post Decision email (`cpSendClientDecisionEmail`) and the inspiration-board Post Decision form.
- Does not affect: proposal / invoice / PO print, client portal pricing, or the suggestion-note email.

## Files

- `platform/index.html` `cpOpenPostIdeabookDecisionModal` ~82878. Added **Share with project contractors**. Unchecked until she checks it.
- `platform/index.html` `cpPostIdeabookAsDecision` ~82803. Writes `sharedWithContractors` on the decision.
- `platform/index.html` `cpSendClientDecisionEmail` ~83143–83199. Client draft is unchanged (client To, client portal link, Cindy Bcc). If the decision is shared with contractors, a second draft opens per active contractor who has an email on the project Contractors tab. That draft uses `client.html#/contractorview/{project}/{token}`. Revoked links and blank emails are skipped.
- `platform/index.html` `CCH_BUILD` ~4378. `9.9.363` / `contractor-decision-mail`.

The regular Post Decision form already had the checkbox and already saved `sharedWithContractors` before calling the same email function, so that path gets the second draft too.

## Self-test

Read-back of the function. No live Outlook check (not deployed). Client body still has only the client portal URL. Contractor body has only that contractor’s token link.

## Not in this order

Design-board Post Decision does not have the contractor checkbox, so it still emails the client only. A contractor with no email saved on the Contractors tab is skipped, with a toast.
