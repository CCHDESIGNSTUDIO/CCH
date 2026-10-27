# FINDING REPORT · Room board card prices (read-only) · Cursor Aug 21

**Cindy GO 2026-08-21 ~17:13:** heal applied on production. See **Applied** at the bottom.

**Clips:** `boards/cloud-rolling-hills/clips` (production project `cch-design-boards`). Script: `_scripts/finding-rb-card-price-READONLY_BY_CURSOR_2026-08-21.js`.

## Portal field that paints the gold number

`platform/client.html` room-board card (~10011):

`formatMoney(parseFloat(c.clientPrice || c.totalSelling) || 0)`

Same fallback on `platform/index.html` portal clone. Not tax. Not shipping. Not library.

## What the three Hall clips actually store

| Card | Clip id | Room | qty | cost (unit) | **clientPrice stored** | What that number is |
|---|---|---|---|---|---|---|
| Vela Sconce | `QwH8AHJ00TKlyVH8iNJ8` | Hall | 13 | 393.8 | **40.8946…** | `(393.8 × 1.35) / 13` |
| Antasia Double Glass | `SilbiTXSHWyfJEzKuoCs` | Hall | 13 | 723.8 | **75.1638…** | `(723.8 × 1.35) / 13` |
| Echo Sconce | `lq1nKDRh99XSoJDCLB6i` | Hall | 13 | 408 | **42.3692…** | `550.8 / 13` |

PRO-3020 / proposalId `nUaBlyanz2XEjXiboLdE` is stamped on Vela and Echo Hall. That is leftover **unit ÷ qty**, sitting **on the clip document**.

Counter-example (same Echo product, different clip): Consessions `VK8ROmMxrS3FnVGXoVqy` has `clientPrice` **550.8** (unit). Portal would show $550.80 there.

## Display bug or data bug

**Data bug.** The portal is reading the right alias (`clientPrice`). The clip’s `clientPrice` is already the fragment.

Cindy applies per-item numbers. Do not heal in this pass. **Superseded:** Cindy typed “Fix the prices” 2026-08-21 ~17:13.

## Library

`productLibrary/4xmDSl7itFvNgwMEMwvj` and `3lLsGfPQ8ZeMKMn18ov0` exist but have no `clientPrice` / `sellPrice` / `cost` on those keys. `hWosxOTPbb7A8h5hF0LG` does not exist. Card is not reading library money.

## Count (same read: lighting-ish title/vendor, `clientPrice` or `totalSelling` in (0, 120))

**7** clips on `cloud-rolling-hills` only (this query did not scan other projects). No writes.

## Applied (Cindy GO 2026-08-21 ~17:13)

Production Firestore only. No proposal/invoice/library writes.

- Script: `_scripts/heal-rh-divqty-clientprice_BY_CURSOR_2026-08-21.js --apply`
- Reversal: `_debug/REVERSAL-rh-divqty-clientprice-2026-08-21.json`
- Stamp: `_priceHealedFrom: div-qty-unit-2026-08-21`
- **28 clips** where `clientPrice × qty` matched the linked proposal/invoice **unit** (or `cost × 1.35`)

Hall Tracey cards:

| Card | Was | Now (unit) |
|---|---|---|
| Echo Sconce | $42.37 | **$550.80** |
| Vela Sconce | $40.89 | **$531.63** |
| Antasia Double Glass | $75.16 | **$977.13** |

Refresh the portal. No hosting deploy required for this data heal.

*Cursor, 2026-08-21. Production Firestore read-only, then heal on Cindy GO.*
