# WO-118 · Clip save writes cost/shipping/clientPrice as STRINGS — v1.0 · CW Aug 19

**Change ID:** BF-013 · **Executor:** Cursor · **Verifier:** Claude · **Attempt:** 1 of 3
**Priority: DO THIS BEFORE WO-115.** WO-115 fixes the read path; this fixes the writer that keeps producing the bad data.

## The defect — three lines

`saveClipDetail()` · `platform/index.html:81232`

A numeric helper is defined at `81234` and used correctly for five fields — but three money fields use the **string** helper:

```js
const _val = function(id) { var el = document.getElementById(id); return el ? el.value.trim() || null : null; };  // STRING
const _num = function(id) { var el = document.getElementById(id); var v = el ? parseFloat(el.value) : NaN; return isNaN(v) ? null : v; };  // NUMBER

qty:               _num('cdQty'),                 // 81243  correct
cost:              _val('cdCost'),                // 81244  WRONG — string
markupPct:         _num('cdMarkup'),              // 81245  correct
shipping:          _val('cdShipping'),            // 81246  WRONG — string
clientPrice:       _val('cdClientPrice'),         // 81247  WRONG — string
purchaseQuantity:  _num('cdPurchaseQty'),         // 81250  correct
unitPurchaseCost:  _num('cdPurchaseCost'),        // 81251  correct
totalPurchaseCost: _num('cdTotalPurchaseCost'),   // 81252  correct
```

**Consequences:**
1. Typing `$1,985.00` stores the literal string `"$1985.00"`. `parseFloat` returns `NaN`, every consumer coerces to `0`.
2. Leaving the field empty stores `null` — Cindy's "cost is missing" on clipper-sourced clips.

**This is the producer behind MONEY-1.** Production counts (`_scripts/count-string-costs_BY_CLAUDE_2026-08-19.js`, 19,879 docs): `clientPrice` **5,039** `$`-strings, `cost` **1,586**, across 5,375 documents. `clientPrice` being worst is consistent — it uses `_val`.

Also note `81265`: `updates.sellPrice = _val('cdClientPrice')` — same string bug on the normalized sell field. Fix with the others.

## What to build

Change `_val` → `_num` for `cost`, `shipping`, `clientPrice`, and the `sellPrice` normalization.

`_num` uses bare `parseFloat`, which fails on `"$1,985.00"` typed directly into the field. Harden it in place so pasted currency is accepted:

```js
const _num = function(id) {
  var el = document.getElementById(id);
  if (!el) return null;
  var v = parseFloat(String(el.value).replace(/[$,\s]/g, ''));
  return isNaN(v) ? null : v;
};
```

That single change also lets Cindy paste `$1,985.00` from a vendor site and get `1985`.

## HARD RULES

1. **Only these four fields change helper.** Do not convert date, note, SKU, finish, vendor or description fields — they are legitimately strings.
2. **No data migration here.** Converting the 5,375 existing documents is a separate WO. This order stops the bleeding only.
3. `null` for an empty field is correct and must be preserved — do not coerce empty to `0`.
4. **No layout changes** (CLAUDE.md Rule 4). No change to the modal's markup or field ids.
5. Ground before editing per `CODE_GROUNDING_PROTOCOL_MH_May13_v1.0.md`.
6. **Coordinate on `platform/index.html`** — Cursor has uncommitted copy-to-room work (9.9.228). This edit is ~4 lines at `81244`–`81265`; pull/rebase rather than fight the file.
7. Staging first. Production needs Cindy's typed GO.

## Acceptance (binary)

1. Entering `1985` in clip cost stores the **number** `1985`, not `"1985"` (`typeof === 'number'` in Firestore).
2. Entering `$1,985.00` stores the number `1985`.
3. Clearing the field stores `null`, not `0` and not `""`.
4. `clientPrice`, `shipping` and `sellPrice` behave identically to `cost`.
5. `qty`, `markupPct`, `purchaseQuantity`, `unitPurchaseCost`, `totalPurchaseCost` are unchanged.
6. Date, note, SKU, finish and description fields still save as strings.
7. Saving an existing clip that currently holds `cost: "$1985.00"` and touching nothing else does **not** silently rewrite the stored value — this order changes new writes only.
8. Console clean on load.

## Verify (Claude, staging)

- Create a clip, type `1985` in cost → confirm numeric in Firestore.
- Paste `$1,985.00` → confirm `1985`.
- Clear cost → confirm `null`.
- Confirm the clip's line total now computes instead of showing 0.
- Evidence into `loop/verify/`.

## Rollback

Single-commit revert. No data written by this order.

## Sequencing

**118 → 115 → (new WO) data migration.** Fixing the reader (115) while this writer runs means new `$`-strings keep appearing behind the fix.

---

## Coordination with Cursor's in-flight work — read before starting

**The Clipper extension is NOT the fault and must not be changed.** Verified Aug 19 in
`C:\dev\CCH-Platform-Deploy\cch-clipper\CCH-Studio-Clipper-v32\sidebar.js` (build 3.9.49):
it already emits numbers — `cost: unitCost > 0 ? unitCost : null` (`2413`–`2415`) — and carries
its own currency-stripping helpers (21 sites). A blank cost from the Clipper means the vendor page
published no trade price. Correct behaviour. **Leave it alone.**

**File contention.** This order edits `platform/index.html` at **`81244`–`81265` only**
(`saveClipDetail`, the money helper assignments). Cursor holds uncommitted copy-to-room work in the
same file at **9.9.228**, in different functions.

- These two edits do not overlap. Both can proceed.
- Whoever lands second pulls/rebases; do not revert the other's hunks.
- If a merge conflict appears anywhere outside `81244`–`81265`, that is **not** this order — stop and
  flag it rather than resolving it.

**Sequencing reminder:** 118 before 115. 115 makes the existing bad data readable; 118 stops new bad
data being created. Doing 115 first means the fix quietly refills behind you.

