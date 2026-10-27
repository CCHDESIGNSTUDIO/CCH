# WO — Square Pay integration audit (findings + fixes)

**CC_Aug17_v1.0** · Author: **Claude Code** · Lane: **Cursor** (code) · **Read-only audit — no code changed.** · **Staging first; prod on Cindy GO.**
**Purpose:** independent audit of the Square hosted-checkout payment integration. Written so Cursor can produce his own audit and compare. Each finding below is a self-contained sub-WO (SQ-0…SQ-6), severity-ranked.
**Grounded:** read Aug 17, 2026 against the live repo — `Functions/squarePaymentLink.js` (386 ln), `platform/cch-square-pay.js` (406 ln), `Functions/index.js` exports @4103-4105, script include `cch-square-pay.js?v=20260817mail2` in both `platform/index.html:86410` and `platform/client.html:12180`.

---

## Verdict

Core design is **sound and PCI-safe** — clients pay on Square's hosted page, no card data ever enters Studio. Happy path is well-built (fee grossed to client, replay-safe recording, secret handled correctly). Risk is concentrated in **operational config** (SQ-0), **webhook trust** (SQ-1), and **lifecycle gaps** (refunds SQ-3, payouts SQ-5, reliability SQ-6). None are on fire; SQ-0 and SQ-1 gate production trust.

**What's already right (do not "fix"):**
- No card fields in Studio; hosted `squareCheckoutUrl` only (`cch-square-pay.js:1-11`).
- Fee grossed onto client so CCH nets the invoice — `(due + 30¢)/(1 − 3.3%)` (`squarePaymentLink.js:16-20`).
- Replay-safe: dedupes on `squarePaymentId` before appending (`squarePaymentLink.js:220-232`).
- Overpayment capped to remaining balance (`squarePaymentLink.js:216-219`).
- Secret via `defineSecret`, whitespace/linebreak-trimmed (`squarePaymentLink.js:10, 29-33`).
- Dual capture: webhook + on-open poll hooked into `renderInvoiceDetail` (`cch-square-pay.js:79-94`).

---

## SQ-0 — [HIGH · OPS, not code] Confirm production is not pointed at Square Sandbox
**Finding:** `squareApiBase()` returns sandbox unless the env var is set — `String(process.env.SQUARE_ENVIRONMENT || "sandbox")` (`squarePaymentLink.js:22-27`). No repo config sets it (grep: only the code reference exists). If the **prod** Functions runtime lacks `SQUARE_ENVIRONMENT=production` **and** a production `SQUARE_ACCESS_TOKEN`, production silently calls Square **Sandbox** — pay links won't charge real cards and `checkSquarePayment` never confirms.
**Action (ops, today):**
1. On prod project `cch-design-boards`: verify `SQUARE_ENVIRONMENT=production` is set for the three functions, and that `SQUARE_ACCESS_TOKEN` is a **production** token (not sandbox).
2. Confirm the webhook endpoint is registered in the Square **production** dashboard (see SQ-1).
**Acceptance:** a real card charge on a live invoice completes and flips the invoice to Paid in Studio. *(Cannot be verified from code — requires prod config inspection.)*

## SQ-1 — [HIGH] Webhook has no Square signature verification
**File:** `Functions/squarePaymentLink.js:323-385` (`squarePaymentWebhook`).
**Finding:** the handler acts on any POST body — there is **no** `x-square-hmacsha256-signature` verification (grep: zero signature/hmac references in file). Partial self-protection exists: it re-fetches the payment from Square by ID (`:350`) so a fabricated ID fails, and it requires a matching `squareCheckouts/{orderId}` (`:361-368`); replay is deduped by SQ's `squarePaymentId` (SQ finding #uses `applySquarePaymentPatch`). But signature verification is the standard control and its absence is a real gap.
**Fix:** add a `SQUARE_WEBHOOK_SIGNATURE_KEY` secret; verify the HMAC-SHA256 of `(notificationUrl + rawBody)` against the header before processing; return 401 on mismatch. Requires capturing the **raw** request body (not the parsed `req.body`) for the HMAC.
**Acceptance:** a POST with a missing/invalid signature is rejected 401 and records nothing; a genuine Square webhook still records the payment.

## SQ-2 — [MED] `checkSquarePayment` has no staff/ownership gate
**File:** `Functions/squarePaymentLink.js:298-301`.
**Finding:** the callable requires `request.auth` but performs **no** email allowlist or project-membership check — unlike `createSquarePaymentLink`, which is staff-gated at `:76-79`. Any authenticated principal can call it with any `projectId/invoiceId`, learning whether an arbitrary invoice has a completed Square payment (and triggering its paid-marking). Cross-project info disclosure.
**Fix:** gate to CCH staff (mirror the allowlist at `:77`, but see SQ-4) **or** verify the caller is a member/owner of `projectId`. Return `permission-denied` otherwise.
**Acceptance:** a non-staff / non-member auth token calling `checkSquarePayment` for a project it doesn't own is denied.

## SQ-3 — [MED] No refund / dispute / chargeback handling
**File:** `Functions/squarePaymentLink.js:323-385` (webhook only handles payment→COMPLETED).
**Finding:** a refunded or charged-back Square payment leaves the Studio invoice **Paid** and overstates AR/income. No `refund.created` / `dispute.created` path.
**Fix:** subscribe to (and handle) refund/dispute webhook event types; on refund, reverse or reduce the recorded `payments[]` entry (match by `squarePaymentId`), recompute `status`/`paidAmount`/`balance`, and surface a flag. Keep it reversible and log the event.
**Acceptance:** refunding a Square payment in the Square dashboard flips the Studio invoice off Paid and restores the balance.

## SQ-4 — [LOW] Staff allowlist uses substring match
**File:** `Functions/squarePaymentLink.js:77` — `email.indexOf("@cchdesign.com") < 0 && email !== "cynthiacbh@gmail.com"`.
**Finding:** `indexOf` is a substring test; an address like `x@cchdesign.com.evil.tld` contains the substring and would pass. Real risk is low (tokens are Google-issued, self-signup needs a real Workspace account) but the check is sloppy.
**Fix:** use `email.endsWith("@cchdesign.com") || email === "cynthiacbh@gmail.com"`. Apply the same helper in SQ-2.
**Acceptance:** a spoofed-suffix email is rejected; real `@cchdesign.com` and the owner email pass.

## SQ-5 — [MED · strategic] Payouts/settlement are never captured (reconciliation)
**Finding:** Studio records the individual payment with `squarePaymentId` (`squarePaymentLink.js:239`) but never the Square **payout** (the batched bank settlement). Result: the same batched, nameless "SQUARE INC" bank-deposit reconciliation problem that plagued QuickBooks Payments (see `Studio MEMORY` QB-Payments deposit note) **will recur for Square**. Because Studio already holds `squarePaymentId`, Studio is uniquely positioned to close the loop.
**Fix (new feature):** a scheduled function that pulls Square `/v2/payouts` + `/v2/payout-entries`, maps each entry's `payment_id` back to the `squarePaymentId` stored on invoices, and writes a `squarePayouts/{payoutId}` doc listing `{bankAmount, fee, invoices[]}`. Surface "this SQUARE INC deposit = invoices A+B+C" in the financials view.
**Acceptance:** given a Square payout to the bank, Studio shows the exact invoice list and fee that compose it — no QuickBooks report needed.

## SQ-6 — [MED] No backstop sweep if the webhook misses
**File:** capture depends on webhook (`:323`) OR the on-open poll (`cch-square-pay.js:84-90`, fires only when staff opens that invoice).
**Finding:** if the webhook fails or isn't registered, a paid invoice records in Studio only when someone opens it — it can sit "Sent" indefinitely (same shape as the QB "Sent-but-paid" invoices seen in reconciliation).
**Fix:** a scheduled reconcile (cron) that, for open invoices carrying `squarePaymentLinkId`/`squareOrderId`, calls the existing `findCompletedSquarePayment` path and marks paid. Reuses `markInvoicePaidFromSquare` — low new surface.
**Acceptance:** an invoice paid via Square with the webhook disabled is marked Paid by the next scheduled run without anyone opening it.

## SQ-7 — [LOW] Fee disclosure understated / inconsistent
**Finding:** code charges **3.3% + 30¢** (`squarePaymentLink.js:13-14`) ≈ 3.5% effective on small invoices, but the client Pay page says **"A 3% fee will be applied on the card."** (`cch-square-pay.js:244`) and the "Pay with card" note (`:243-244`). The QB surface elsewhere shows **3.6%**. Three different figures; the client-facing one under-discloses and omits the +30¢.
**Fix:** state the true rate on the Pay page (match `SQUARE_CARD_FEE_RATE`/`SQUARE_CARD_FEE_FIXED_CENTS`), including the fixed fee; reconcile with the QB-side 3.6% wording so one number is used everywhere.
**Acceptance:** the client Pay page discloses the exact percentage + fixed fee actually charged.

---

## Minor notes (no WO — awareness only)
- **Stale pay links:** when the balance changes, a new link is created but the old one still works (`squarePaymentLink.js:110-113`) — a client could pay a stale amount. Edge case; consider expiring superseded links.
- **Fee not stored:** the recorded payment equals the invoice **due** (net), so the fee the client actually paid isn't tracked in Studio (`applySquarePaymentPatch` caps at `remaining`, `:216-219`). By design; note it if per-payment fee reporting is ever wanted.

## Sources / grounding
`Functions/squarePaymentLink.js`: fee consts @12-14, `squareGrossChargeCents` @16-20, `squareApiBase` (sandbox default) @22-27, secret trim @29-33, staff gate @76-79, link reuse @110-113, `applySquarePaymentPatch` (dedupe @220-232, cap @216-219, record @233-241), `checkSquarePayment` (auth only) @298-301, webhook @323-385 (payment refetch @350, order lookup @361-368). `Functions/index.js`: exports @4103-4105. `platform/cch-square-pay.js`: hosted-link only @1-11, callables @13-50, paid-check hook @79-94, client Pay page + "3% fee" text @186-281 (fee note @243-244). Includes: `platform/index.html:86410`, `platform/client.html:12180`.

*CC_Aug17_v1.0 — Claude Code audit. Read-only; no code changed. Staging first; prod on Cindy GO. Cursor to produce independent audit for comparison.*
