# Handoff — QB PO then Bill + variances — 2026-08-25

Studio **9.9.266** `qb-po-then-bill-variance-2026-08-25`. Not committed. Not deployed.

## What Cindy asked
Houzz matching: push the PO, then the Bill connected to that PO. Variances (freight/tax/extras) on the Bill, not by editing the QB PO.

## What changed
- `Functions/index.js` — `ensureQbPurchaseOrderForStudioPo`; bill `LinkedTxn` to Purchase Order; extra Bill lines from Studio freight/tax/labor/price change/other. Merchandise line only is PO-linked.
- `cch-po-bill-variance.js` — allow PO push; Send PO auto-pushes PO on production; payments still never push.
- Menus / PO header / OM — Push PO to QuickBooks visible again.
- Cache `?v=20260825pobill1`. Build 9.9.266.

## Deploy
Staging hosting first (UI). Live QB needs production functions `pushPOToQB` + `pushBillToQB` + hosting — Cindy typed GO.

PowerShell (one command per step), from `C:\dev\CCH-Platform-Deploy\cch-deploy`:

```
firebase deploy --only hosting:platform --project staging
```

Production functions (GO only):

```
firebase deploy --only functions:pushPOToQB,functions:pushBillToQB --project cch-design-boards
```

Production hosting (GO only):

```
firebase deploy --only hosting:platform --project cch-design-boards
```

## Guardrails
- Do not edit the PO in QuickBooks when freight arrives.
- Do not push Studio payments.
- Do not bulk-create POs under already-matched BL- bills.
- Visual Comfort two CC amounts still need per-invoice Bills to Match (not this batch).
