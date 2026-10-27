# WO-254 — Clipper: markup % does not stick with the product
**Lane:** A production bug · **Executor:** Cursor #1 · **Verifier:** Cindy

## Cindy Sep 25
On **CCH Studio Clipper v3.9.58** (RH medicine cabinet): she changes **MARKUP %** (e.g. 20 → Apply shows 20.0% / $307, client $1,842). After save to board & Product Library, the **markup does not stick with the product**.

## Intent
Markup % set in Clipper must persist on the Product Library item and on the board/clip so reopen / Place on proposal / later edits show the same markup (20% or 35% etc.). Cost = trade; client = cost × markup (nearest $0.05 standing rule). Do not rewrite paid/ordered/invoiced lines.

## Ground
Clipper save payload → library fields (`markupPct` / equivalent) → board clip. Find where Apply updates UI only vs write on Save.

## Acceptance
1. Set markup in Clipper, Save → reopen product / clip → same markup %.
2. Client price matches cost × markup (nickel round).
3. Locked money lines untouched.

## Deploy
Production after Cindy GO. No staging lap.
