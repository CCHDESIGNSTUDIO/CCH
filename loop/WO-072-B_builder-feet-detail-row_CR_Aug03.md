# WO-072-B · Feet upload + print detail row · Aug 03
**Change ID:** FT-033 (`ft033-feet-detail-row`) · **Lane:** Builder  
**State:** DONE-UNVERIFIED · **Executor:** Cursor Raul · **Deploy:** #1 · **Verifier:** Fable / Claude  
**Parent:** WO-071-B (ft032 live on staging ~13:25)

## Why (Cindy)
1. Can’t add Feet image — library/`legs_feet` empty; popup had no computer upload.
2. Print: Furniture alone on second row with blank space — fill the entire row.
3. Form: too much gray blank under Description on image slots.

## What
`platform/builder/index.html` meta `2026-08-03ft033-feet-detail-row`

- Feet / Legs: upload on form + **Use image from this computer** in Popup
- Feet image in print detail strip (`feetRef`)
- Detail strip `--n2`…`--n4` = equal columns, full mid-column width
- Compact Description row under uploads (less dead gray)

## Acceptance
1. Empty library → still can add Feet via computer / form upload.
2. Feet thumb appears with Stitch / Finish / Nailheads / Furniture on one filled row when 4 present.
3. Description fields are one compact row.
4. Meta after deploy = `ft033-feet-detail-row`.

## STOP
#1 deploys. No agent firebase deploy. Prod only on Cindy GO.
