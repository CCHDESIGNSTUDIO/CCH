# WO-029 · Wire the CCH voice profile into BOTH AI writers: invoice-narrative AI + client-update (bi-weekly) composer · CW Jul 13
**Change ID:** pending #1 assign (AI) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)
**Client-facing output.** Voice source of truth: `loop/CCH_VOICE_PROFILE_CW_Jul13.md` (committed alongside this WO). **Staging first; production only on Cindy GO** (the invoice AI runs in production — do NOT flip prod without GO).

## What Cindy asked (Jul 13)
"Did you send Cursor our voice for the AI, for both the invoices and the client updates?" It hadn't been sent.
This WO hands over the voice profile and wires it into the two places the platform generates client copy:
(A) the **invoice-narrative AI** (the time-invoice cover note), and (B) the **client-update / bi-weekly**
generated copy (greeting + section notes). Both must default to Cindy's voice, not generic AI agency-speak.

## GROUNDING FIRST (hard reset — locate the real prompts before editing)
The invoice-narrative AI is **not** in `platform/index.html` (the only Anthropic calls there, index.html:48391
and :48510, are the *project classifier*, model `claude-sonnet-4-20250514`, `system: systemPrompt`). The
invoice narrative writer lives elsewhere (a Cloud Function, or the staging-only invoice-AI feature Cindy has
seen working on staging). Before writing:
1. Find where the invoice narrative/cover note is generated (search the functions dir / staging build for the
   LLM call that produces the invoice summary; grep `narrative`, `invoice` + `system:`/`messages`). Cite
   file:line.
2. Find where the bi-weekly/client-update copy is generated. Phase A shipped render+seed only
   (`cch-progress-updates.js`, no generator). The auto-draft generator is WO-021 §A / WO-028's deferred piece;
   if it exists in a staging build, cite it; if not, this WO wires the voice into it **when built** and, for
   now, sets the seed/composer defaults (greeting "Hi {First}", Gear-1 tone) to match the profile.
Report what you find for each before changing anything. Do not guess a location.

## Change — inject the voice as system/style guidance at BOTH call sites
Load the committed `CCH_VOICE_PROFILE` as the style layer of the system prompt (or a trimmed rules block if a
full-doc include is impractical). Both writers must obey, by default (Gear 1 — personal/day-to-day):
- Open with **"Hi {FirstName},"** never "Dear." Warm, human close ("Thanks as always," "Love where this is
  headed," "— Cindy").
- **Bullet points** for anything operational (where the time went, what happened per room). Short sentences.
- Plain-spoken: say what actually happened ("Went through every cabinet package before it goes to fabrication").
- **NO em dashes** anywhere (hard rule). Use commas, periods, colons, parentheses.
- **Kill agency-speak**: never "a period of meaningful refinement," "construction-ready documentation,"
  "architectural permanence," "brought into full resolution," or similar. If the draft contains any, it failed.
- Story-first, client-first ("your story," "a home you'll love to live in"). Confident, humble, unpretentious.
- **Per-client formality dial:** default Gear 1; a per-client setting can raise to Gear 2 (slightly more
  polished, still warm) for a formal client. Friends (e.g. Tracey) stay Gear 1. Reuse the per-client greeting/
  tone setting from WO-021 for the bi-weekly; add the equivalent dial to the invoice AI (default informal).
- Never expose internal financials/margins/PO detail in client-facing narrative (existing rule).

## Reference — the exact shift to enforce (from the profile, INV-6030)
KILL: "December and January were a period of meaningful refinement across Rolling Hills, advancing the project
from concept into coordinated, construction-ready documentation..."
DEFAULT TO: "Hi Tracey, busy couple of months on Rolling Hills. Here's where the time went: • Millwork &
Cabinetry, 28 hrs. Went through every cabinet package (bedrooms, game room, craft room), reviewing and refining
before anything goes to fabrication. • Fireplaces, 3 hrs... Thanks as always, Tracey. Love where this is headed.
— Cindy" (bullets, warm, plain, no em dashes.)

## Acceptance (binary)
1. Invoice-narrative AI: generating an invoice cover note produces "Hi {First}," bulleted, plain-spoken copy in
   Cindy's voice with zero em dashes and zero agency-speak phrases from the kill-list. Verified on a real
   Rolling Hills invoice on staging.
2. Client-update/bi-weekly generated copy (greeting + notes) defaults to the same Gear-1 voice; the per-client
   tone setting still overrides.
3. Both read the committed voice profile (single source of truth) rather than a hardcoded duplicate that can
   drift; if a trimmed inline rules block is used, it links back to `loop/CCH_VOICE_PROFILE_CW_Jul13.md`.
4. No em dashes in any generated output (add a post-generation guard that strips/rejects em dashes if cheap).
5. `node --check` on any touched JS; no console errors; invoice AI still functions (regression check).

## Verify (Claude, staging)
Generate an invoice narrative for a Rolling Hills invoice and a bi-weekly draft; confirm voice, bullets, "Hi",
no em dashes, no kill-list phrases; test the per-client dial (friend vs formal). Screenshot both to
loop/verify/WO-029/. Then hold for Cindy GO before the invoice AI voice change goes to production.

## DONE note
loop/WO-029_DONE_CR_[MonDD].md + _DEPLOY_QUEUE.md line (staging).
