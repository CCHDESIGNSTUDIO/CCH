# FINDING · Room board card prices are wrong in the client portal · CW Aug 21

**READ ONLY. This is an investigation request, not a work order. No writes of any kind.**

**FILE TO:**
- **Cursor reads from:** `C:\dev\CCH-Platform-Deploy\cch-deploy\Docs\`
- **Companion copy:** `C:\Users\cindy\Dropbox\Claude - CCH studio\`
- **Do not add to `LOOP_LEDGER.md` as an open WO.** This is a finding, not a queue item. It gets a WO number only after Cursor reports back and Cindy decides the fix.
- Neither folder is connected to the authoring session, so this file was handed over as a download and must be copied manually.

**Lane:** Studio platform (client portal / room boards) · **Executor:** Cursor, read and report · **Gate:** Cindy decides the fix after the report. She applies price changes, not Cursor.

---

## Observed

Rolling Hills client portal, room board card grid, portrait phone, Aug 21:

| Card | Vendor | Price shown |
|---|---|---|
| Vela Sconce | Hubbardton Forge | $40.89 |
| Antasia Double Glass | Hubbardton Forge | $75.16 |
| Echo Sconce | Hubbardton Forge | $42.37 |

All three carry a PENDING badge and live Approve / Decline buttons, so the client is being asked to approve a selection at that number.

## Why these are wrong

1. **Magnitude.** Hubbardton Forge sconces are not $40 fixtures. For comparison, the same project's proposal surface prices a double sconce at $2,370.00 per unit.
2. **Cross-surface disagreement is already documented.** `RH_LIGHTING_BOARDS_VS_PROPOSALS_MH_Aug14_v1_0` recorded board-versus-proposal price drift on this exact project in both directions, including a 5.4x spread on the Selecta Long Sconce that was flagged as too wide to explain as unit-versus-extended.
3. **Not a rounding artifact.** WO-093 ($5 ceiling on client price) is still unbuilt, so unrounded cents are expected. Unrounded cents at 2% of the real price are not.

## Hypotheses (💩 all three, unverified, do not assume)

1. The card reads a **tax** or **shipping** field instead of the client price field.
2. The card reads a **cost or per-unit fragment** from the linked library product rather than the clip's client price. Related precedent: `WO-069-B_FINDING_cost-not-on-line` where cost and client price came from different resolves and disagreed.
3. The clip's own price field is corrupt for these docs. Precedent exists: the RH 22-tile clip price heal (Jul 31), which is stamped reversible via `_priceHealedFrom` and whose revert is still an open decision.

## What to do (read only)

1. Read the actual clip docs behind these three cards under `boards/{rollingHillsProjectId}/clips`. Report the full price-related field set for each: whatever aliases exist (`price`, `clientPrice`, `amount`, `unitPrice`, `cost`, `costPrice`, `tax`, `shipping`), plus `libraryProductId` and `_priceHealedFrom` if present.
2. Read the client portal card render and report **which field it reads** to produce the displayed number.
3. Resolve the linked library product for each and report its price fields too.
4. State plainly whether the displayed number is a **display bug** (right data, wrong field read) or a **data bug** (the clip itself holds a wrong number). Those have different fixes and only one of them touches data.
5. Report how many other clips across all projects would display a similarly implausible number under the same read. Count only, no changes.

## Hard constraint

`CCH_STANDING_RULE_saved-proposal-pricing`: the client sees the room board price, so room-product pricing is client-facing and Cindy-controlled. If a price is wrong anywhere the client can see it, **alert Cindy, do not change it.** No price write to `boards/{pid}/clips` as part of any heal, sync, audit, or cleanup. Audits are read-only. Cindy applies.

If the answer is "display bug, wrong field read," that fix is code and Cindy will approve it as a normal change. If the answer is "data bug," nothing gets written until she gives a per-item number and an explicit go.

## Adjacent, worth reporting in the same pass

These three cards also render internal ID chips (`Lib …`, `PR PRO-3020`). That is handled in WO-112 Part 1. Mention here only so the same render is not read twice.

*v1.1, Aug 21 2026. Read-only. No line numbers by design.*
*Changed from v1.0: added the FILE TO destination block and the do-not-ledger note. No change to scope or constraints.*
