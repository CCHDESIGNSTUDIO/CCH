# Session log — Cursor — 2026-10-23

## Overview

Client chat was opening on top of Pepper. WO-323.

## What changed

- `platform/cch-portal-records.js` — when Pepper is open, Client chat moves to the left of that panel.
- `platform/index.html`, `platform/client.html` — Studio 9.9.408, tag `chat-beside-pepper`. Cache `cch-portal-records.js?v=20261023wo323`.

## Deployed

Staging hosting 2026-10-23 ~09:30. https://cch-platform-staging.web.app Studio 9.9.408.

Attempt 2, ~10:50. Studio 9.9.409, tag `chat-beside-portal-pepper`, cache `cch-portal-records.js?v=20261023wo323b`. The first shift watched the staff Pepper panel. The overlap was the portal Pepper (Hear Pepper / Talk / Send), which shares Client chat’s corner. Chat now moves to the left of that panel.

WO-324 staging hosting ~11:20. Studio 9.9.410, tag `chat-speak`, cache `cch-portal-records.js?v=20261023wo324`. Speak on a chat message uses the browser voice. A photo with no text has no button. Production not deployed.

WO-325 staging hosting ~11:25. Studio 9.9.411, tag `chat-mic-elise`, cache `cch-portal-records.js?v=20261023wo325`. Mic fills the message. Speak uses Elise. Production not deployed.

Pepper Weekly brief on staging at 11:20 returned Anthropic 401 invalid x-api-key. Function `cchPepper` is running. The stored staging key was rejected. Not a code change.

WO-326 and WO-327 staging hosting ~12:25. Studio 9.9.412, tag `chat-project-notice`, cache `cch-portal-records.js?v=20261023wo327`. Speaker mark on the message box. Client chat on the project turns gold when the client wrote and staff has not replied.

Cindy Oct 23: skip staging, go to production. PRODUCTION hosting, Firestore rules, and Storage rules ~12:40. https://cch-platform.web.app Studio 9.9.412. Chat photos, speaker mark, Elise, and the project notice. Pepper.js was unchanged from live 9.9.406. Functions not deployed. No commit. Staging Anthropic key was not changed.

WO-328 and WO-329. Cindy Oct 23 GO production. PRODUCTION hosting ~13:06. https://cch-platform.web.app Studio 9.9.414, tag `po-on-room-board`. Only index.html differed from live 9.9.412. Generate POs skips a line already on a project PO. Room board cards show the earliest PO. Cloud Rolling Hills: keep PO-9052, delete PO-9064. Neither was deleted. Functions not deployed. No commit.

WO-330. Create PO lists every invoice line. The PO number sits beside the name. A line already on a PO cannot be checked. PRODUCTION hosting ~13:20. https://cch-platform.web.app Studio 9.9.415, tag `po-gen-show-numbers`. Functions not deployed. No commit.

WO-331. Vanessa posted the Holtz Hill inspiration decision. The banner called it a client action because the log type was client_portal. PRODUCTION hosting ~15:00. Studio 9.9.416, tag `staff-not-client`. Cache cch-pepper.js?v=20261023wo331 and cch-client-activity.js?v=20261023wo331. Functions not deployed. No commit.

WO-332. That banner is for a staff post the client still has to decide. It now says who posted it. PRODUCTION hosting ~15:15. Studio 9.9.417, tag `decision-needs-client`. Cache cch-pepper.js?v=20261023wo332. Functions not deployed. No commit.

## Not deployed

Functions not deployed. No commit. PO-9052 and PO-9064 were not deleted.

## Verify

Hard refresh staging. Open Pepper, then Client chat. The chat panel should sit to the left of Pepper, with Pepper’s Talk and Send still visible.
