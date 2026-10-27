# Fable decision — Pepper feature pack · CW Jul 26 v1.3
**In response to:** Docs/HANDOFF_FABLE_pepper-features_CR_Jul26.md (Cursor). No code shipped; sequence + scope + two new asks only.
**v1.3 change log:** Refined Feature G's "voice out" section with an actual voice-selection plan (Cindy asked for Pepper to have a real chosen voice, not whatever the OS defaults to). Everything else unchanged from v1.2.
**v1.2 change log:** Added Feature G (voice in/out for Pepper) per Cindy's ask. Everything else unchanged from v1.1.
**v1.1 change log:** Added Cindy's steer on Feature A's launch point (Order Management + PO page, not a new Pepper-panel-only composer, not client portal — see updated section A). Everything else unchanged from v1.0.

## Decision: D+B first, D+A second. C stays a non-goal. Two new items added: E (bug report via Pepper) and F (vendor bill upload, auto-fill only).

B is pure read: it reuses math the dashboard already runs (`_isBillableEntry`, invoice `timeEntryIds`, `invoicedEntryIds` dedupe map at index.html:3946/4192/34424+). No new write surface, no open design fights, direct "what's the money situation" value. A has three real open branches (single vs batch, filter definition, mailto vs new helper) and touches vendor-facing output, so it costs more to get right. Ship the lower-friction, zero-write win first. D (digest builders) is a shared prerequisite either way, so it rides with whichever ships first.

## Answers to Cursor's four questions

1. **Priority: B first, then A.** Matches Cursor's own suggested order; grounded above.
2. **Vendor email: single PO picker for v1, not batch.** `mailto:` is inherently one composed email at a time. A real "batch" either means opening N mail-client windows in a row (poor UX, easy to fumble) or merging multiple POs from one vendor into a single email body (a bigger scope decision Cindy hasn't asked for). Single-PO-in-progress or single-PO-picker only. Batch is a v2 conversation if the single-PO version proves the pain is frequent enough to justify it.
3. **Time: project-only for v1. Yes.** Firm-wide "who hasn't logged" needs a baseline that doesn't exist yet (no "expected weekly hours" per person is defined anywhere in the platform today). Don't invent that baseline as a side effect of a Pepper feature; that's its own spec if Cindy wants it later.
4. **Confirm: Pepper never auto-sends email or auto-creates invoices. Yes, non-negotiable.** Consistent with the standing rule already in `cchPepper.js`/`cch-pepper.js` and every AI feature shipped on this platform to date (Fix-It bot, invoice narratives, progress updates: all draft-then-human-sends).

## D — digest foundation (build first, shared by A/B)
Client-side, same shape as the existing `activityDigest` pattern (`cch-client-activity.js`'s `caFetchProjectActivity`). Two digests:
- **Open POs digest** (vendor, PO #, status, ETA if present, bill flag) → feeds A. Ground in `cch-po-vendor-comms.js` and `cch-po-bill-variance.js`'s `cchPoWasSentToVendor` / `cchPoLifecycleStatus` helpers, don't reinvent PO status logic.
- **Unbilled time digest** (hours by person/week, billable only, entry ids not already on an invoice) → feeds B. Ground in the `_isBillableEntry` / `invoicedEntryIds` pattern above.

Cloud Function (`cchPepper.js`) stays dumb: accept digests + action, don't re-query Firestore server-side unless a size/auth limit forces it.

## B — Unbilled time (build after D)
v1 project-scoped only, per answer 3. Preset "Unbilled time / what to invoice." Output: staff summary of ready-to-invoice hours + obvious gaps, draft text only. No invoice creation, no time-entry edits, in v1 or ever without a separate ask. Rates visible to Pepper (staff-only, same trust boundary as the rest of the panel) — confirm with Cindy once, not per-use.

## A — Vendor status follow-up email (build after B)
Preset "Draft vendor status follow-up." Grounds in the open-POs digest for the current project (or current PO if opened from PO detail). Output: short mailto-ready body in Pepper voice. Action button reuses the exact `cch-po-vendor-comms.js` mailto pattern already used by "Send to vendor" (To vendor, Cc orders@) — do not build a second mailto helper. Optional: log to that PO's `vendorCommunications` when the mail client opens, matching the existing PO log path. Never auto-send; that's not a v2 ask either, that's permanently off the table per answer 4.

**Launch point, per Cindy (Jul 26): Order Management or the PO page. Not client portal, not a Pepper-only composer.** This resolves the single-vs-batch question above better than a new batch UI would:
- **PO page** — single-PO follow-up, sits next to the existing "Send to vendor" action in `cch-po-vendor-comms.js`. Same place staff already go for that PO.
- **Order Management tabs** — `#/ordermanagement/noeta` ("Missing ETA") and `#/ordermanagement/noconfirm` ("Missing confirmations") already aggregate exactly the POs that need a vendor nudge, firm-wide (index.html/cch-order-management.js:465-471, list logic ~line 2043). Add a per-row "Follow up" action to those existing rows. Each click still drafts and opens one email — batch is solved by working down an existing list, not by building a multi-send composer in Pepper's panel.

This also simplifies D: the open-POs digest doesn't need new query logic. Order Management's tabs already run the underlying "missing ETA / missing confirmation" queries; D should call the same helpers those tabs use rather than write a parallel query. Pepper's own "Draft vendor status follow-up" preset (for the chat-first path, grounded to whatever project/PO is currently open) still ships, but Order Management and the PO page are the primary, most-used entry points — build the buttons there first, Pepper's preset second.

## C — Bill updates: stays a non-goal
Unchanged from Cursor's own read. `pushBillToQB` and bill/variance paths are the highest financial-risk surface on the platform (SPEC_PO_Bill_Variance_Workflow_v1.0.md section 2: "no automatic line-item edit... no automated variance-resolution decisions"). Pepper does not touch this. See F below for the one bill-adjacent feature that IS worth building, and why it's a different risk class than "Pepper updates a Bill."

## E — NEW: Pepper files a bug report (Cindy's ask: "tell Claude there's a bug")
**Build candidate, low risk, ships easily alongside D.**

The platform already has exactly this pipe, built and live: `cch-bugs-requests.js`'s `fbQuickSubmit(type, text, ctx)` writes to the existing `feedbackRequests` collection and immediately calls `fbPostAssistantAck`, which triggers `cchFixItBot` (the same Claude-backed triage bot already live, per `Functions/cchFixItBot.js`). A human (Cindy or Vanessa) still sees every one of these in the Bugs & Requests panel; nothing here is a new privileged write, it's the same button staff already have, just reachable by saying "there's a bug with X" to Pepper instead of opening a second panel.

**What this is not:** there is no live pipe from `feedbackRequests` into an actual Claude Code / Cursor session. Filing a bug report here does not page anyone outside the platform. Cindy still decides what becomes a work order, exactly as today — Pepper just removes the friction of switching panels to log it.

**Scope for v1:** Pepper preset or free-text trigger → capture current project/page context (same `fbCaptureContext()` shape already used) → call `fbQuickSubmit('bug', text, ctx)` → confirm in-panel ("Logged — Vanessa/Cindy will see it in Bugs & Requests"). No new Firestore collection, no new Cloud Function, reuse the existing write path exactly.

## F — NEW: Vendor bill upload → pre-fill "Receive Final Bill" (Cindy's ask: "upload a vendor bill and have it fill it in")
**Build candidate. Different risk class than C — explain why, don't conflate them.**

This does not exist today in any form, for anyone. `INTERNAL_VENDOR_BILLS_FINANCE_HUB` and `SPEC_PO_Bill_Variance_Workflow_v1.0.md` both explicitly list "Vendor-side bill upload (PDF/image attach to bill)" as **out of scope for v1.0** of the Receive Final Bill modal that already exists (vendor invoice #, date, freight/tax/extra lines, auto variance calc, at `cch-po-bill-variance.js`'s `cchPoOpenReceiveBillModal`).

The reason this is buildable where "Pepper updates a Bill" (C) is not: **nothing gets written to Firestore until the human clicks Save Bill in the existing modal**, same as every manual bill entry today. The new piece is only the fill step:
1. Staff uploads a vendor invoice PDF/image on a PO already in `sent` status.
2. A vision-capable extraction call (same Anthropic infra Pepper already uses) reads the document and returns a structured draft: vendor invoice #, invoice date, freight/tax/extra line amounts.
3. That draft opens the **existing** Receive Final Bill modal, fields pre-populated instead of blank.
4. Staff reviews, corrects anything the extraction got wrong, clicks Save Bill exactly as they do today. Nothing new is trusted; the human is still the one who commits the number.

**Open decisions for Cindy before this gets scoped in detail:**
- Where does the upload control live: on the PO detail page directly, or as a Pepper action ("upload a bill for this PO")? These are two different UI entry points to the same backend step; either is fine, both is more surface to test.
- Confidence handling: if extraction can't read a field cleanly, does the modal open with that field blank (safest) or with a low-confidence flag on it? Recommend blank-if-uncertain for v1; a wrong number user doesn't notice is a worse failure than an empty field they have to fill in anyway.
- File types: scanned PDF and photo-of-invoice both need to work, not just clean digital PDFs, since that is how vendor bills actually arrive.

**Out of scope for v1 of F:** auto-saving the bill without human review (never, this is the same C boundary), matching against POs automatically for the wrong vendor/PO (staff picks the PO first, extraction fills the bill for that PO, no auto-matching), multi-page invoice splitting logic beyond simple concatenated read.

## G — NEW: Voice in/out for Pepper (Cindy's ask: talk to Pepper, mic instead of typing)
**Build candidate. Cheapest feature in this whole pack — no new vendor, no new cost, no new Cloud Function, if scoped to v1 as below.**

Nothing here exists today (confirmed: no `speechRecognition`/`speechSynthesis`/`getUserMedia` anywhere in `platform/`). Grounded directly in `cch-pepper.js`'s real current structure (800 lines, not the doc's earlier draft): the input box, `submitFree()`, and the Enter-key handler at lines ~574–593 are exactly where mic input hooks in; the assistant-reply render block is exactly where read-aloud hooks in.

### In — microphone dictation
Use the browser's native **Web Speech API** (`SpeechRecognition`, ships in Chrome, zero install, zero backend). Mic button next to the existing input box:
- Tap to start, tap to stop (push-to-talk pattern) — never always-listening. Staff sees the browser's own one-time "allow microphone" permission prompt the first time; normal browser behavior, nothing CCH-specific to build for that part.
- Transcript fills the existing input box exactly like typing would. Staff still hits Send (or Enter) — **no auto-send on transcript**, same "human confirms before it goes anywhere" posture as every other Pepper feature, even though the risk here is low (it's text going to Pepper, not to a vendor or a client).
- No new Firestore field, no new Cloud Function. Purely a browser-side input method feeding the box that already exists.

### Out — Pepper reads replies aloud, in an actual chosen voice ("can we make her sound like Pepper")
One thing to be direct about first: **we can't literally clone a specific real person's voice** (Gwyneth Paltrow, or anyone else) — that's a real person's likeness without consent, not a technical limitation, a line worth not crossing regardless of budget. What we can absolutely do is give Pepper a distinctive, warm, well-produced voice that's consistently *hers* every time she talks, picked on purpose instead of whatever the browser defaults to. Two tiers:

**v1 (free, ships with G):** Native `speechSynthesis`, but not left on autopilot. Browsers actually ship a mix of voice quality under that one API — Chrome/Windows/macOS all bundle a few enhanced/neural options alongside the robotic default (e.g. macOS offers "Samantha" and newer enhanced voices, Chrome on most platforms offers a Google-branded neural voice). Build the picker to call `speechSynthesis.getVoices()`, filter to the best-quality female voice available on that machine, and lock Pepper to it by name (with a graceful fallback if that exact voice isn't installed) — plus a slightly tuned rate/pitch for a warm, unhurried delivery rather than a flat read. Zero cost, zero new vendor, still just reading the existing on-screen reply text, default-off toggle as already decided above.

**v2 (real upgrade, Cindy's call, new cost):** A premium neural voice — ElevenLabs or a comparable provider — gets you an actual consistent, polished "Pepper voice" the native APIs can't match, and most of these providers let you pick a stock voice (not a clone of anyone real) and tune it. This is the same v2 as before: new vendor account, a real recurring cost (usage-based, scales with how much she talks), a new secret in `Functions/`, and audio streaming through a Cloud Function instead of staying client-side. Worth doing if the free version still feels too flat once staff are actually using it daily — not worth guessing at up front. Recommend shipping v1 free first, then deciding on v2 with real usage in hand rather than committing to a recurring cost before anyone's heard her talk.

**Guards, unchanged from the rest of Pepper:** staff-only (same panel, same allowlist), never on `#/clientview/…` (voice in/out inherits whatever gate the panel itself already has, nothing new to build there), no data written, no external call added for v1 in either direction.

**Open decision for Cindy:** push-to-talk via tap, or hold-to-talk (mic active only while a button is held down, like a walkie-talkie)? Tap is easier to build and use one-handed; hold is a slightly clearer "recording now" signal. Recommend tap-to-start/tap-to-stop for v1, it's the simpler build and easy to change later since it's all client-side.

## Sequencing (unchanged intent from Cursor, with E/F slotted in)
1. **D + B** — unbilled time, read-only, daily money impact.
2. **D + A** — vendor status mailto, reuses existing PO comms path.
3. **E** — Pepper bug-report filing. Small, reuses a live path, can slot in anywhere in this sequence including first if Cindy wants a quick win.
4. **F** — vendor bill upload/pre-fill. Bigger than E (needs a vision extraction call + new upload UI), but same-modal-same-gate as today's manual entry. Scope in detail once D/B/A are through staging.
5. **G** — voice in/out. Smallest lift in the pack (no backend at all for v1), can ship any time, doesn't block or get blocked by A/B/D. Reasonable to bundle with E as a "quick wins" pass.
6. Hold **C** unless Cindy explicitly reopens it.

## Out of scope for this whole pack
Auto-send SMTP/Gmail API/inbox reading (A); firm-wide "who hasn't logged," invoice creation, time-entry edits (B); any bill/variance write Pepper initiates without the existing human-gated modal (C, F); persisted cross-device chat history (later, if asked); premium TTS voice / always-listening mic / auto-send-on-transcript (G v1).

## Verify anchors
A: from PO page OR from Order Management "Missing ETA"/"Missing confirmations" row → "Follow up" → draft → Open email → correct To/Cc/body → optional `vendorCommunications` log entry appears on that PO. No button anywhere on `#/clientview/…`.
B: project with billable, not-yet-invoiced time → Pepper summary lists it; already-invoiced entries excluded; nothing written.
E: type "there's a bug with X" to Pepper → entry appears in Bugs & Requests with correct project/page context → existing Fix-It bot ack fires exactly as it does for a manually-filed request.
G: tap mic → speak → transcript lands in input box, unsent → Send/Enter still required. Toggle "read aloud" on → Pepper's next reply is spoken; toggle off (default) → silent as today. Neither works on `#/clientview/…` (panel doesn't render there at all, per existing guard).
F: upload a real vendor PDF on a sent PO → Receive Final Bill modal opens pre-filled → numbers match the PDF (or are blank where unclear) → Save Bill still requires the human click, still writes through the existing path.
