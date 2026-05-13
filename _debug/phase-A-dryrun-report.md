# Phase A — Production Enrichment Dry-Run Report

**Mode:** READ-ONLY. No writes performed anywhere.
**Generated:** 2026-04-29T03:15:39.668Z
**Run time:** 66.3s

## Summary

| Category | Count |
|---|--:|
| Total production products | 6165 |
| Matched by SKU (exact) | 2494 |
| Matched by title (exact) | 3039 |
| Matched by title (contains) | 120 |
| **Total matched to Houzz catalog** | **5653** |
| No match in Houzz catalog | 512 |
| Matched but **LOCKED** (on a proposal/invoice/PO line item) — skip | 430 |
| Matched + unlocked, would add **houzzId + imageUrl** (broken before) | **4971** |
| Matched + unlocked, would add **houzzId only** (image already working) | 252 |
| Matched + unlocked, would refresh **imageUrl only** (had houzzId) | 0 |
| Matched + unlocked, no-op (already had both) | 0 |

**5223 production products would receive a write** if Phase B is approved. 430 would be skipped (locked). 512 have no Houzz catalog match.

**Line-item corpus scanned for "locked" check:** 6433 line items across 122 boards + top-level /invoices.

## Sample: would update both houzzId + imageUrl (image broken before)

- `020jpCGTY3wfvcDkbP8v` "Seychelles Navy" (sku: ∅, match: title-exact) → houzzId=33498799, image=https://ivy-uploads.s3.us-west-2.amazonaws.com/2426/productImage/11390187/Seyche…
- `02SCRFYzsAzLjz5StyF1` "Modern Shower Curtain Rod" (sku: ∅, match: title-exact) → houzzId=56218911, image=https://ivy-uploads.s3.us-west-2.amazonaws.com/2426/productImage/32914816/0pmrq_…
- `03Acb9dvkcX0YRMhi9j5` "Modern Fluted Brushed Nickel Wall-Mounted Toilet Paper Holder" (sku: ∅, match: title-exact) → houzzId=52277781, image=https://ivy-uploads.s3.us-west-2.amazonaws.com/2426/productImage/28381418/6f8sr_…
- `03rHGBZWERfCYNm6xAx4` "Fishbone Buffet Lamp" (sku: ∅, match: title-exact) → houzzId=33494508, image=https://ivy-uploads.s3.us-west-2.amazonaws.com/2426/productImage/6820698/k7fsj_1…
- `03t1GSwmkEKMGsB3Y3rb` "BAJA CHANDELIER" (sku: 45094, match: sku-exact) → houzzId=33494121, image=https://ivy-uploads.s3.us-west-2.amazonaws.com/2426/productImage/14390014/knjao_…
- `04FtrBxUKq3NoO7QlyjP` "Acorn Black Iron Butt Hinge" (sku: 2095426, match: title-exact) → houzzId=33498133, image=https://ivy-uploads.s3.us-west-2.amazonaws.com/2426/productImage/1415443/0209542…
- `05djc0KakoQG4ArOYuch` "Vintage Mini Pivot Mirror" (sku: ∅, match: title-exact) → houzzId=33492530, image=https://ivy-uploads.s3.us-west-2.amazonaws.com/2426/productImage/20034664/hdcdz_…
- `05eshRk8VCssemetXLWC` "GAMBETTA WEAVE - RED" (sku: 8019120-19, match: sku-exact) → houzzId=33495872, image=https://ivy-uploads.s3.us-west-2.amazonaws.com/2426/productImage/9849751/aef8o_8…
- `05oCZskMr8wxKwXohVSR` "Bedouin Bowl Platform" (sku: 20-1204, match: sku-exact) → houzzId=33493031, image=https://ivy-uploads.s3.us-west-2.amazonaws.com/2426/productImage/18090908/aodrx_…
- `06T3ohucpZKk2DwKPpmm` "Rock Crystal Blown Glass LED Pendant" (sku: ∅, match: title-exact) → houzzId=33492749, image=https://ivy-uploads.s3.us-west-2.amazonaws.com/2426/productImage/19092206/16nfq_…

## Sample: would add houzzId only (image already working)

- `026kXpYrCmaxi9i9W49m` "MAGNUS STEEL DUVET COVER AND COMFORTER" (sku: DVQ-392, match: sku-exact) → houzzId=33490317
- `0EQxBt1nY56YyegBBw64` "Tweed" (sku: ∅, match: title-exact) → houzzId=33491670
- `0ElWzijoZ8NFxeosexZM` "COVE WOVEN DUVET COVER" (sku: TF-DVQ-49, match: sku-exact) → houzzId=33490315
- `0Zz69j7dx6NmJYgTaRqt` "Dresser Long Glass Rod Light" (sku: TOB 2141BZ-FG, match: title-exact) → houzzId=54573708
- `14HGgWUpSkq2Ct8aZPbl` "GILLES RIBBED HORN/RESIN TRAY" (sku: ∅, match: title-exact) → houzzId=33491718
- `1930s_martini_square_side_table__restoration_hardware` "1930S MARTINI SQUARE SIDE TABLE" (sku: ∅, match: title-exact) → houzzId=33490862
- `1yILAdvpopTUx3zSbwZ0` "New Town Sconce" (sku: Base Item #204250, match: sku-exact) → houzzId=54704094
- `2mtWk8iaOUzEyme50Ma9` "Vale Cascade Glass Chandelier" (sku: ∅, match: title-contains) → houzzId=33492394
- `32urXUVrgHB4eFELtNE3` "BELVEDERE TEAK SQUARE SIDE TABLE" (sku: ∅, match: title-exact) → houzzId=51027276
- `3498_euc_orchid_succulent_in_sosa_bowl__ivy_guild` "3498 EUC/ORCHID/SUCCULENT IN SOSA BOWL" (sku: 3498, match: sku-exact) → houzzId=50979861

## Sample: would refresh imageUrl only


## Sample: locked products (skipped because referenced on a doc)

- `06RjE07AXQkGUesrsUrY` "38" SInk & SPlash" (sku: ∅) — matched to Houzz by title-exact, but skipped
- `0QYrEnDR2HFCEzCCBs92` "Retrofit Exposed Pipe Shower Set - Matte Black" (sku: ∅) — matched to Houzz by title-exact, but skipped
- `0ejD0viBPQOY481Jyw9y` "12 INCH LAMBETH HEXAGONAL PULL" (sku: 10038756 SNCK) — matched to Houzz by sku-exact, but skipped
- `0kRkEPpF7U2RheYVlSh3` "SHOCK WAVE" (sku:  54863 ) — matched to Houzz by sku-exact, but skipped
- `0tdMX8Nr0C140qAybyNr` "Ibiza Mirror" (sku: Item: 21-1115) — matched to Houzz by sku-exact, but skipped
- `10Z9J2vFiKSk7LBRjYbo` "Hughes Toilet Paper Holder" (sku: ∅) — matched to Houzz by title-exact, but skipped
- `1TMoFFyqrdVg56yk8naI` "COLLIERS KNOB" (sku: 24170069 BRNZ) — matched to Houzz by sku-exact, but skipped
- `1Ta1mtyOZzcHXGjwiNtm` "Veranda Ticking Ocean" (sku: M610/04) — matched to Houzz by sku-exact, but skipped
- `1UFeMTjPEDoseVASdHcb` "Wintry Woodlands Foliage" (sku: ∅) — matched to Houzz by title-exact, but skipped
- `1ZvEtfCcFK28TDDDqFa6` "Selfoss Sconce" (sku: ARN 2036BZ) — matched to Houzz by sku-exact, but skipped

## Sample: no Houzz catalog match

- `01LW1YZ13g4L5OVIsRgo` "Polyester, 2% Polyamide" (sku: ∅)
- `09l7bV2sLzxVchJd0oMj` "Porticcio Tea-towel 27x27" Turquoise" (sku: ∅)
- `0eN2bYRR8fjvFNeAeAEb` "Window treatment W8 Auto. Roller Opt." (sku: ∅)
- `0iNFofEzRUhoFVQ3AsO7` "W"  Stem, heavy Duty Canopy" (sku: ∅)
- `0nwPD2jkIu9wDW5AKvhH` "HEMINGWAY BED LUXE" (sku: ∅)
- `0q0zzNkSMuTnvump5ZLq` "Fabric for sofa" (sku: ∅)
- `10933337_rooftop_fr__zimmer___rohde__zimmer___rhodes__fabric___trim__90_polyester_trevira_cs_10_polyester` "10933337 Rooftop FR: Zimmer + Rohde" (sku: 10933337)
- `163Bf2pBcwWwjM2vXSqI` "TWEED FRINGE TURQUOISE" (sku: 102-42)
- `17nsEOYYj0a45LuBf6hZ` "Muslin Covers" (sku: ∅)
- `1TNDvdro9jw8jta9SuJo` "OCALA SINGLE-HOLE KITCHEN FAUCET WITH PULL DOWN SPRING SPOUT" (sku: ∅)

---

## What this report does NOT do

- No writes happened. Nothing in production or staging changed.
- The exact list of every planned update has been written alongside this report as `phase-A-dryrun-updates.json` for inspection.
- If counts look right, Phase B = mirror to staging /products/ + apply enrichment + verify visually. Then Phase C = same against production.