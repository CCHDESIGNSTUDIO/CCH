# WO-299 — Approved decisions log on the portal

Cindy Oct 14. Feature. Staging first. Not started.

Source: `C:\Users\cindy\Dropbox\Claude - CCH studio\Cursor1 to cursor2 & Grok bot Claude Handoffs\FOR_CURSOR1_FEATURE_approved-decisions-log-portal_Oct14.md`

## Ask

One running checklist per project. This is not the portal Decisions page. Those posts stay the big decisions (options, photos, Approve). The checklist is a short line each time something is decided.

1. Shows on the client portal and in Studio. Newest first. Sort by room.
2. A client approval of a big portal decision adds one checklist line: date, client name, what was approved, room, and a photo if that post has one. The big decision post stays where it is.
3. Cindy or Vanessa can add a line quickly for a decision that never had a post: phone call, text, email, or site meeting. Fields: what was decided, room, date, and how it was approved.
4. A decision can link to a site-meeting summary when that feature exists. The link can be empty until then.
5. Clients cannot edit or delete an entry. Staff can mark one replaced, with a note. The old entry stays visible, crossed out.
6. Clients see only their project. Staff can print a CCH-style PDF (Georgia, CCH colors).
7. Pepper can answer "what did I approve for the kitchen?" from this list. She may suggest a draft from notes. Staff confirm before it is on the list.

## Look first

Leave the portal Decisions page as it is. Do not turn those posts into the checklist, and do not make a quick phone-call add open a full decision post.

- Collection: `boards/{projectId}/clientDecisions` (`platform/index.html` ~78611).
- Client approve / request changes: `cpClientRespondItem` (`platform/index.html` ~82614).
- Answered posts already collected: `cpPortalCollectAnsweredDecisionItems` (`platform/index.html` ~82425). Status `approved`, `changes_requested`, or `resolved`. Photo is `attachmentUrl` / `attachmentUrls`. Response is `clientResponse.respondedAt`.
- Portal Decisions page already lists open and answered posts (`platform/index.html` ~79972). That page is not this log.

## Constraints

- Read-only on money. Never change prices, proposals, POs, or invoices.
- Clients never see cost, markup, rates, or other projects.
- Print for this list is its own page. Do not edit the shared proposal / invoice / PO / tear-sheet print CSS.
- Staging only. Production needs Cindy's typed GO.
- Only #1 deploys.
