# FOR CLOUD CODE — Verifier role (Cindy Sep 25, 2026)

Cindy is giving you a **new job**: double-check Cursor #1’s production bug fixes so she does not have to audit every line. You do **not** edit Studio code, commit, or deploy. Cursor #1 builds and deploys. You **audit**.

## Your job
1. When Cursor #1 marks a WO DONE-UNVERIFIED (see `loop/WO-###_DONE_CR_*.md` + `_DEPLOY_QUEUE.md` + ledger), **ground** the change in the live PC repo: `C:\dev\CCH-Platform-Deploy\cch-deploy` (not Dropbox `CCH-Platform-Deploy`, not a stale GitHub-only tree).
2. Re-grep, read the function bodies this turn, cite `file:line`. Memory and handoff notes are leads, not evidence (same as CODE_GROUNDING).
3. Write a short verdict for Cindy: **PASS / FAIL / NEEDS CINDY** with why, and any standing-rule risks.
4. Drop the verdict in this folder as `FROM_CLOUDCODE_VERIFY_WO-###_SepDD.md` and copy into `loop/` if you can write the PC repo.

## Standing rules (locked)
- **Prod bugs → production** after Cindy’s typed GO. **No staging lap.** Features / risky redesigns still stage first. Mixed batches: split. File: `loop/CCH_STANDING_RULE_prod-bugs-skip-staging_CW_Sep25.md` and `.cursor/rules/commit-deploy-policy.mdc`.
- Only **Cursor #1** commits/deploys. You never deploy.
- **Money locks:** never change paid / ordered / approved / signed / invoiced / void lines. Client-approved proposal total locks money; notes/images/product link must stay open (WO-252).
- MyKnobs/trade = cost; client = cost × 20% or 35%; nearest **$0.05** on live Studio.
- Handoff folder Cursor watches: `C:\Users\cindy\Dropbox\Claude - CCH studio\Cursor1 to cursor2 & Grok bot Claude Handoffs` (name includes **& Grok bot**).

## First batch to watch (Cursor #1)
| WO | Title | Lane |
|----|-------|------|
| 252 | Approved proposal: open line notes/images/link; money locked | A prod |
| 253 | Room Boards: removed stay; declined not Declined | A prod |
| 254 | Clipper markup % not sticking | A prod |
| 032 | Payments edit/delete + retainer double-count | A prod |
| 033 | Live-recalc Subtotal/Tax/Total | A prod |
| 039 | Correspondence file upload | A prod |
| 237 | Selections hide void invoice lines | A prod |
| 095 | Star / ?? icons | A prod |

Specs: `loop/WO-252_*.md`, `WO-253_*.md`, `WO-254_*.md`. Batch brief: `FOR_CURSOR1_PROD_BUG_BATCH_Sep25.md`. Status from Cursor: `FROM_CURSOR1_STATUS_prod-bugs_Sep25.md`.

**Out of this batch:** WO-008 (notifications / feature → staging).

## Verdict template
```
WO-### — PASS | FAIL | NEEDS CINDY
What Cursor changed: (files + line ranges)
Grounding: (grep aliases + file:line)
Matches WO acceptance: yes/no
Standing rules: ok / risk (name which)
Recommend: Cindy GO to prod | send back to Cursor | Cindy must click live
```

## Do not
- Rewrite Cursor’s fix “while you’re in there.”
- Clear `clientApprovedTotalAt` or re-price locked lines.
- Queue staging for these prod bugs.
- Invent WO numbers.

Grok Bot coordinates Cindy + this folder; you own the technical verify pass.

## Also: Nightly verify
Weeknights — see `NIGHTLY_VERIFY_PROTOCOL_CW_Sep25.md` and `FOR_CLOUDCODE_nightly_verify_Sep25.md`. Audit that day's deploys; write `NIGHTLY_VERIFY_YYYY-MM-DD.md`. Grok Bot briefs Cindy at ~7:49 AM PT weekdays.
