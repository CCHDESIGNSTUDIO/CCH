# WO-099 — Client Pepper: label by her face ("Design assistant in training ;-)") + ship the already-updated copy

**CW_Aug07** · Lane: **Cursor** (client-facing copy, `cch-client-portal`) · Grounded in `platform/cch-client-pepper.js` this session.

## What Cindy wants
Clients open the Pepper widget in the portal and see a face with no clear "who is this." Add a label right next to her face identifying her, in Cindy's words (Aug 07):

> **Pepper**
> Design assistant in training ;-)

## The change (one line)
`platform/cch-client-pepper.js`, panel header (**line 144**):
- **From:** `'<div><div class="t">Pepper</div><span class="s">CCH Design Studio</span></div>' +`
- **To:** `'<div><div class="t">Pepper</div><span class="s">Design assistant in training ;-)</span></div>' +`

Optional, for consistency on the docked-face hover (**line ~132**):
- `fab.title = 'Message CCH Design — Pepper';` → `fab.title = 'Pepper · Design assistant in training';` (also drops the em dash).

## Important: the rest of the copy is ALREADY in the code — this is really a DEPLOY
Confirmed in `cch-client-pepper.js` this session:
- **Intro (line ~149)** already reads: *"I'm Pepper, CCH Design's studio assistant. Send Cindy or Vanessa a chat message here and I'll pass it straight to them. I'm still a work in progress, so I can't answer questions myself... yet ;-)"*
- **Empty state (line ~209)** already reads: *"No notes yet. Send one below and your design team sees it in Communications."*

But the LIVE portal Cindy is viewing still shows the OLD copy (*"Share a note for the CCH team. I'll pass it along — I can't answer questions here."* and *"No notes yet — send one below…"*). That means the repo file is **ahead of what's deployed**. So this WO = make the one label edit, then **deploy `cch-client-pepper.js`** so the new label AND the already-updated intro/empty-state all go live together.

## Acceptance
1. Open Pepper on a client portal (e.g. `#/clientview/31-whitesail`): header shows **Pepper** with **Design assistant in training ;-)** beneath.
2. Intro shows the "Send Cindy or Vanessa… yet ;-)" version; empty state shows the clean no-em-dash version.
3. FAB hover tooltip updated (if the optional edit is taken).
4. Verified on the staging client portal, then prod on Cindy's GO.

## Note for the loop
Filed as WO-099 into `loop/` AND `LOOP_LEDGER.md`. Flag: the ledger is currently behind (no rows for 094/095/096 though the WO files exist) — worth a short reconciliation pass so the ledger is a true source of truth again.
