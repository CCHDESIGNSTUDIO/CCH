# WO-093 · Round CLIENT price UP to the nearest $5 · CW Aug 06
**Change ID:** pending #1 · **Lane:** Studio platform (pricing / markup) · **State:** OPEN · **Executor:** Claude Code (money logic — grep ≥3 aliases + read before editing) · **Verifier:** Fable · **Gate:** Cindy GO for prod. Consult **cch-cfo / cch-finance-procurement** before build.
**File:** `platform/index.html`. Grounding (canonical, HEAD 3d92702): the client amount is computed at **~8356 `it.amount = cost * qty * (1 + m/100) + ship`** — raw markup, **NO rounding today**, which is exactly why $763.26 shows. Client-price sites: `clientPrice =` ~8367, 8376, 8543, 8571; markup `* (1 +` at ~9404, ~12283, ~18884. **Apply the ceiling-to-$5 ONCE at this client-price/amount derivation so it flows everywhere; do not sprinkle at display sites.** A round-UP helper already exists for TIME (`roundUp15` = `Math.ceil(h/0.25)*0.25` @58344, `roundUpTo15` @15712) — mirror that same ceiling pattern for $5 on price. **Staging first; minimal diff; re-ground exact lines.**

**Note (Cindy: "I thought we had built that in"):** the round-UP rule that exists is for **time** (15-minute ceiling on hours), not price. Client price is still raw cost×markup, unrounded. So $5 client-price rounding is **net-new**, not a regression.

## What Cindy asked
"We need to round up to 5 on client costs." Client prices show ugly cents ($3,289.53, $4,061.69, $763.26, $680.40, $1,877.18). She wants the **client-facing price rounded UP to the next multiple of $5** so it reads clean ($3,290, $4,065, $765, $685, $1,880).

## The rule
1. **Ceiling to nearest $5:** `clientPrice = Math.ceil(rawClientPrice / 5) * 5`. Always UP, never down (so CCH never undercharges). $763.26 → $765.00; $680.40 → $685.00; a value already on a $5 multiple stays put.
2. **Default target = the client UNIT price.** Line total = rounded unit × qty (e.g. $765 × 2 = $1,530). *(See decision below — confirm unit vs line-total.)*
3. **Apply at the source** (where markup produces the client price), so the rounded number is what saves and what every downstream surface reads: proposal, invoice, tear sheet, client portal, QuickBooks push, PDFs. One number, consistent everywhere.

## Decision for Cindy (LOCKED Aug 7)
- **Unit vs line-total:** **UNIT price** rounded up to nearest $5 (Cindy: "unit price gets rounded up"). Line total = rounded unit × qty (+ shipping unrounded).
- **Scope in time:** **going forward / on next save** (do not silently rewrite prices on already-approved or sent proposals/invoices).

## Guardrails (hard — money)
1. **Client-facing price ONLY.** Never change vendor cost, your cost basis, or the margin/markup inputs. Margin is computed from the true cost, not the rounded client price. (Rounding up slightly increases realized margin — that's intended, don't "correct" it back.)
2. **Consistency:** the rounded client price is identical on the proposal line, the room-board, the invoice, the tear sheet, the client portal, and the QB push. No surface shows an unrounded client price.
3. **No double-rounding** and no rounding of already-rounded/overridden manual prices (if a user typed an exact client price, respect it — or confirm you want manual entries rounded too).
4. **Tax/shipping:** apply the $5 rounding to the product client price; do not force-round tax or shipping lines unless Cindy says so.

## Acceptance (Fable, staging screenshots)
1. On a proposal, every client price/line reads as a clean multiple of $5, always rounded up (spot-check the screenshot values: $763.26→$765, $680.40→$685, $1,877.18→$1,880).
2. The same rounded price shows on the matching invoice, tear sheet, and client portal; QB push carries the rounded price.
3. Vendor cost and margin math unchanged (margin still off true cost). No console errors. Already-sent docs not silently altered (per scope decision).
Screenshots to Fable = sign-off, then Cindy GO for prod. **Also add to the standing pricing rules doc.**

## Ledger
Add: WO-093 · Round client price UP to nearest $5 (`Math.ceil(p/5)*5`) at the single client-price source so it flows to proposal/invoice/tear sheet/portal/QB; client price only, margin off true cost, ceiling never down, going-forward · Code · staging first.
