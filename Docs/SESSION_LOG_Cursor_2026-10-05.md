# Session log — Cursor — 2026-10-05

## Overview

Pepper order push for staging. Not deployed.

## WO-278

Staff see “Orders that need you” without opening Pepper. A project card appears when a project is opened. Purchase orders already flagged as draft, unconfirmed, or missing a bill. She does not send mail or change prices. Script `20261005wo278`.

Staging hosting deployed 2026-10-05. The upload is the whole platform folder, including other uncommitted studio files. Production unchanged. No commit.

## Open

Staging deploy of WO-278 needs a clean hosting pass. Portal Pepper still greets Cindy as the client. That bug is not in this change.

## WO-281

Starring an inspiration image on the portal replaced the board with the welcome screen. Signed-in studio preview had no client email, so the star handler drew that full-page gate. `cpPortalEnsureClientIdentity` in `platform/client.html` now uses the signed-in staff email and leaves the board up. Real clients with no saved email still see the welcome screen. Staging hosting deployed 2026-10-05 ~09:40. Portal build `20261005wo281` is on cch-platform-staging.web.app.

Cindy GO 2026-10-05 ~11:12. Production hosting `cch-platform.web.app` is Studio 9.9.373. Live check: build 9.9.373, Pepper `20261005wo280`, portal `20261005wo281`. Invoice, Square, PO bill, tax, vendor-bid, and RFQ files were byte-identical to the previous production release. No commit. Functions not deployed.
