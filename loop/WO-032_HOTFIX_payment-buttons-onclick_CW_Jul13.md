# WO-032 HOTFIX · Payment edit/delete buttons dead on PROD ("Unexpected end of input") — same onclick quote collision · CW Jul 13
**URGENT — LIVE ON PRODUCTION.** `platform/index.html`. 4-line fix. Breaks the ✎/× on Applied Payments (Cindy: "I can't edit").

## Symptom
On the invoice detail (prod, INV-6051), console shows `Uncaught SyntaxError: Unexpected end of input` and the
Applied-Payments **✎ (edit)** and **× (delete)** buttons do nothing.

## Root cause (confirmed — index.html)
The WO-032 buttons use a **double-quoted `onclick="..."` with `JSON.stringify()` args inside**. JSON.stringify
emits double-quoted strings, so the first inner `"` closes the attribute → the handler is truncated →
"Unexpected end of input." Exact lines:
- **:26979** ✎ edit — `onclick="detailDocEditPayment(' + JSON.stringify(opts.projectId) + ',' + JSON.stringify(opts.collection) + ',' + JSON.stringify(opts.docId) + ',' + p.paymentIndex + ')"`
- **:26980** × delete — `onclick="detailDocDeletePayment(' + JSON.stringify(...) + ...')"`
- **:27007** Edit (panel variant) — same
- **:27008** × (panel variant) — same
Renders to broken HTML: `onclick="detailDocEditPayment("manno-imperatrice",...)"` (the `"` after `(` ends the attr).

## Fix (pick one, apply to all 4 lines)
**Simplest:** change the attribute to **single quotes** so JSON's double quotes don't collide. In the source
literal, change `onclick="` → `onclick='` and the closing `)">` → `)'>`. Result:
`onclick='detailDocEditPayment("id","invoices","docId",0)'` — valid.
**Or** keep double quotes and HTML-escape the JSON: `JSON.stringify(x).replace(/"/g,'&quot;')` for each arg.

## Audit while you're here
`grep -n 'onclick="[^"]*JSON.stringify' platform/index.html` and fix EVERY hit the same way — this pattern is the
recurring "Unexpected end of input" bug (also WO-028 in cch-progress-updates.js :283/:411/:413/:501/:502/:696).
Prefer routing new inline handlers through the existing safe attribute helper going forward.

## Deploy note
Production is already broken here, so this tiny hotfix is justified even mid-day — but verify on staging first
(open an invoice, click ✎ and ×, confirm the modal opens / payment deletes, console clean), then promote. Nothing
else in the same push.

## Still pending (separate, NOT this hotfix)
The group header still reads **"Shipping & adjustments"** — that's **WO-035** (relabel to "Retainer &
Discounts / Credits"), not yet shipped. Do that with the Tier-1 batch, not in this hotfix.
