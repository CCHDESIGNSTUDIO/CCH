# WO-089 · Client Pepper on the portal — friendly relay only, no AI answers · CW Aug 05
**Change ID:** pending #1 · **Lane:** Client portal (CLIENT-FACING) · **State:** OPEN · **Executor:** Cursor (Aug 05 — client portal file is small enough) · **Caveat:** the studio-side drop (step 4) writes into the Team Chat inbox that lives in the 5MB `index.html`; if Cursor OOMs on that one write, hand ONLY that piece to Code. · **Verifier:** Fable · **Gate:** Cindy GO for prod
**File:** the standalone client portal app (`platform/client.html` / `platform/cch-client-board.js`) — the client view at `#/clientview/{project}`. **Staging first; minimal diff.** CLIENT-FACING: apply cch-client-portal + cch-marketing "gift" standards (Programa, navy `#1f2a3d` / gold `#C4A464`).
**Number note:** assigned 089 while the device bridge was offline; verify against `loop/LOOP_LEDGER.md` before build.

## What Cindy asked
"Can we give our clients Pepper on the portal? She can't talk back other than to say 'I'll pass on the message.'" So: put Pepper on the client portal as a graceful way for a client to send a message to the studio. Pepper does **not** answer questions or act like an AI assistant to the client. She only acknowledges and relays.

## Change
1. **Add Pepper to the client portal** as a small, elegant message widget (her avatar + a short greeting). Use the final avatar **`PEPPER_AVATAR_FINAL_CW_Aug05.png`** (same Pepper as the studio widget).
2. **Client can type a message / question** to their designer and send it.
3. **Pepper only acknowledges + relays.** On send, she replies with a single warm, canned line, e.g. "Thank you, I'll pass this along to the CCH team." (final wording per cch-marketing voice) and nothing more. **Do NOT say "your designer."** **No AI answers, no back-and-forth, no generated responses.**
4. **Where the message goes (Cindy, Aug 05): to CINDY and VANESSA, both of them.** The message is delivered to the studio-side inbox both Cindy and Vanessa watch, i.e. the existing **Team Chat / Communications** channel for that project, tagged with the **client name + project**, marked **unread / from-client**. Reuse the existing client-to-studio / staff message plumbing (the same Team Chat the studio Pepper widget already writes to) so both see it; do not invent a parallel store.
5. **Notify both Cindy and Vanessa** of a new client message via the existing notification path (unread badge + whatever the studio already uses). Not "the designer," both of them.

## Persona note (important)
Client-facing Pepper is **gracious, warm, and polished**, NOT the internal "drill sergeant with a smirk" voice she uses with Cindy/staff. To clients she is the elegant concierge who takes the message. Keep her brief and brand-gift.

## Guardrails (hard, client-facing)
1. **No AI / no answering.** Pepper never answers a client question, never generates content, never gives status, pricing, cost, vendor, margin, timelines, or any internal data. Her only output is the fixed acknowledgment. This is a message box with a face, not a chatbot.
2. **No data leakage.** She has no access to internal chat/bugs, other projects, the staff log, or any cost/margin. She cannot surface anything the client portal doesn't already show.
3. **No auto-actions.** Sending a message delivers it to the studio and shows the acknowledgment. Nothing else fires. Nothing is sent back to the client except the canned line. No auto-email to anyone without Cindy.
4. **Studio-side control.** The client's message lands in the studio for Cindy to read and respond to herself, through the normal channel. Cindy replying is a separate, human, studio-side action (not Pepper).
5. Basic anti-spam (reasonable, e.g. a short cooldown between sends). Honor client-portal show/hide-cost and privacy rules.

## Acceptance (Fable, staging screenshots)
1. On the client portal, Pepper appears (final avatar, on brand). A client can type and send a message.
2. Pepper responds only with the single acknowledgment line, no answer, no generated content.
3. The message arrives in the studio Team Chat / Communications tagged to the right client + project, marked unread; BOTH Cindy and Vanessa see it and are notified. The client-facing line does not say "your designer."
4. No internal data (cost, vendor, margin, other projects, internal chat) is reachable from the client Pepper. Nothing auto-sends to the client beyond the acknowledgment.
Screenshots (client side + studio side receipt) to Fable = sign-off, then Cindy GO for prod.

## Ledger
Add: WO-089 · Client Pepper on the portal — graceful message relay to the studio (avatar + acknowledge-only, no AI answers, no data leak, tagged to client/project, studio notified) · Code exec (client portal) · staging first.
