# CCH Open Items Ledger

**C-Team_Aug13_v2.0** · Merged: all 146 Claude project docs + `loop/LOOP_LEDGER.md` + Cursor's `OPEN_ITEMS_AUDIT_CR_Aug13_v1.0` + live repo read of `Docs/`, `loop/`, `_scripts/`.

**Supersedes `CCH_OPEN_ITEMS_LEDGER_C-Team_Aug13_v1.0.md`, which was wrong in five material places.** Corrections are in §1, stated plainly rather than quietly folded in.

---

## What changed since v1.0

v1.0 read the Claude project only. It could not see the repo. Cursor's audit read the repo only; it could not see the project. Neither was complete, and the two disagreed. This version reads both.

The single most important number changed completely.

| | v1.0 said | v2.0, grounded |
|---|---|---|
| Unverified ships | "5 items shipped that nobody verified" | **61 rows carry DONE-UNVERIFIED. 4 rows are verified.** |
| Top priority | Build the staging fixture | **HOTFIX-032, a live production break open since Jul 13** |
| M1 variance double-charge | "live", audit not run | **Audit ran Aug 12. Zero linked variances on prod. No client was double-charged.** |
| WO-064 follow-up | "never cut" | **Cut as WO-065 on Aug 01. Shipped.** |
| Staging fixtures | "all three empty" | **Two of three now documented in `FIXTURES.md`. One still needs a paste.** |
| Open item count | ~215 | ~190 after dedupe, but the count was never the point. See below. |

---

## 0. The finding that reframes everything else

`loop/LOOP_LEDGER.md` is the canonical work-order ledger. Its own state machine is:

> `OPEN → IN PROGRESS → DONE-UNVERIFIED → VERIFIED / FAILED → PROD (Cindy only)`

Counting the table:

- **32 rows** are non-terminal (24 OPEN, 1 OPEN-URGENT, 2 BLOCKED-DISCUSSION, 1 BLOCKED-DECISION, 1 BLOCKED-SCOPING, 1 GAP, 1 SUPERSEDED, 1 split-state)
- **61 rows** sit at DONE-UNVERIFIED
- **4 rows** ever reached a verified state: WO-042 grips, WO-043 sync, WO-044 zoom, WO-064 dup-ids (and that one is `VERIFIED*`, asterisked, because the heal does not auto-persist). WO-059 is a fifth, recorded in the log only, with no table row.

**Sixty-one shipped. Four verified.** Many of the 61 are in production. The verification step is not a bottleneck in your process; it is a step that essentially does not happen. Your own Jul 30 rule named the failure mode already: *"Cursor DONE now means awaiting Fable. If Cindy is testing it, the loop is broken."* The loop has been broken for six weeks.

This is why the ledger is full of rows like WO-041, which reads DONE-UNVERIFIED in the table while the log records *"WO-041 tear sheet VERIFY = FAILED (partial)"*. Nothing moved the row. WO-048 was opened to fix it instead, and WO-048 is still open a month later.

---

## 1. Corrections to v1.0

I got five things wrong. In order of how much they mattered.

**1.1 The variance tax double-charge is not live, and no client was billed twice.** `WO-DRAFT-A_DONE_CR_Aug12.md` records the §6 audit as having run: *"§6 audit: 0 linked variances on prod (no client double-charge yet)."* The audit scripts exist on disk (`audit-variance-tax-on-invoices_BY_CURSOR_2026-08-12.js`, `audit-variance-presence_BY_CURSOR_2026-08-12.js`). WO-DRAFT-A itself shipped, PROD v9.9.151, Aug 12. I called this the second-highest priority in v1.0; it is closed on the money question.

*Residual, and worth resolving:* Cursor's own two documents disagree. The DONE_CR says the audit ran and found zero. The reconciliation handoff table still lists M1 as *"Backfill audit not run."* The DONE_CR is more specific and carries the finding, so I trust it, but one of the two should be corrected.

**1.2 WO-064-FOLLOWUP was cut and shipped.** I reported it as *"never cut, called a one-liner."* It was cut as **WO-065** on Aug 01 (`db65`, quiet auto-save after heal) and is DONE-UNVERIFIED. The Jul 30 verification ledger predates it, which is why the project-side doc still shows a gap.

**1.3 Two of three canary fixtures are now documented.** `_scripts/canary/FIXTURES.md` carries real values: `STAGING_INVOICE_HASH=#/project/cloud-rolling-hills/invoice/5ZICEMD4qHDF9nHmS8Pq` and `STAGING_BUILDER_PROJECT_ID=cloud-rolling-hills`. `STAGING_BOARD_HASH` still reads `PASTE_BOARD_ID`. The console whitelist I flagged as missing is also written (`inpage.js`, `ERR_BLOCKED_BY_CLIENT`, extension origins).

*Still true:* the values live in `FIXTURES.md`, an instruction file. The actual env file is `C:\Users\cindy\Dropbox\Claude - CCH studio\staging-canary.env`, which I cannot read. And `canary/results/canary_last.json` is dated **Aug 04**. The canary has not run in nine days. Last recorded score: 13 of 16.

**1.4 Several "open with undecided questions" items were decided and shipped.** WO-091 shipped Aug 07 as "Immediate" (Client Ideas, `clientPortalShareIdea`), so Decision 2 was made. WO-093 shipped Aug 07 with *"Cindy locked unit"*, so the unit-vs-line-total question is answered. WO-087's image half was resolved: *"Cindy Aug06: skip image/design, Fable handles."* WO-104, WO-105, WO-108, WO-092 Part 1 all shipped.

**1.5 The Bugle Trail gap is much larger than I reported.** I cited $13,599.46 as a derived, unconfirmed shortfall. The repo holds `_debug/bugletrail-po-reconcile-dryrun-report.json`, a dry run listing **44 Houzz POs missing entirely from Studio**, including PO-400024 **$34,972.76**, PO-400025 **$17,098.37**, PO-400026 $5,964.03, PO-400029 $7,426.30. Reason field: *"Missing in Studio purchaseOrders."* No apply report exists in the repo, so this is still a dry run, not a correction.

---

## 2. Live money and production risk, reordered

### P0 — HOTFIX-032, a production break open for one month

This did not appear anywhere in the Claude project, which is why v1.0 missed it. The ledger row, verbatim:

> `HOTFIX-032 | Payment ✎/× buttons dead on PROD (onclick quote collision @26979/26980/27007/27008) — "Unexpected end of input" | pending #1 assign | OPEN-URGENT | Cursor | LIVE PROD BREAK. Same JSON.stringify-in-double-quoted-onclick bug as WO-028. Single-quote the attr or &quot;-escape. Cindy "I can't edit"`

The Jul 13 log entry is worth reading in full because it names the process failure that caused it:

> *"Cursor shipped WO-032 to PRODUCTION and it works, BUT the new payment ✎/× buttons carry the onclick quote-collision bug → 'Unexpected end of input' live on prod, edit/delete dead. NOTE: this went to prod unverified and mid-day — reinforce staging-verify-first + the daytime prod freeze."*

You cannot edit or delete a payment on a production invoice or PO, and have not been able to since July 13. The fix is described as single-quoting an attribute. Cursor's Aug 13 audit confirms it is **still OPEN-URGENT**.

### P0 — Data loss that already happened

| Item | What was lost | Recoverable |
|---|---|---|
| **Copy-to-room field drop** (`WO-COPY-CLIP-FIELD-CARRY_CR_Aug12`) | Every clip copied into a room silently dropped `images[]`, product website URL, spec URL, manufacturer, client title/description, and spec fields. Price copied as **0** (reads `r.amount` on a row that carries `clientPrice`). Category rewritten to an invalid value by an inverted `CATEGORY_REMAP`. Confirmed against the live build on villa classica. | **No.** The WO says it plainly: *"can't recover what was never copied, but new copies will be correct."* Fix specified, not coded. |
| **WES-U-03 labor** (Order Builder, Aug 13) | You entered labor on all three West Avalon upholstery work orders; WES-U-03 came back **empty in prod Firestore**. U-01 and U-02 retained 820 from earlier saves. | Re-enter. Fix `ft066` (cost-field draft save + flush before WO switch) is **queued, not deployed**. |
| **Rolling Hills Pepper notes** (PEPPER-1, Aug 2) | Agents crashed your computer; session death wiped the notes. Pepper chat is DOM-only, never written to Firestore. | No. Persistence is a feature that *"needs Cindy GO"*, so the exposure is live and unmitigated. |

### P0 — Money defects, with their real WO numbers

| ID | Issue | WO | State |
|---|---|---|---|
| **M4** | QB sync marks fees and services Taxable. Extended Jul 13 to also cover the retainer→QB negative-line mapping and an edited-invoice re-push mismatch: *"platform $1,807.50 vs QB $4,428.21 on the toast — QB not yet reconciled."* | **WO-034** | OPEN since Jul 13, never started |
| **NEW** | PO summary tiles hide **~$169,634** of ordered-but-unbilled cost. Tile 3 only sums POs where `bill.received`, so Paid ($177,495.79) + Bill-due ($27,068.05) falls $169,634.20 short of Total ($374,198.04). | **WO-027** | OPEN since Jul 12 |
| **NEW** | INV-6051: a $2,500 retainer applied twice (credit line −2500 **and** payment ref INV6016). Balance clamps to $0; true owed **$1,807.50**. | **WO-032** | Guard shipped to prod per the log; **table row still says OPEN** |
| **M6/M7/M8** | Bugle Trail: 44 POs missing from Studio (dry run), $2,869.27 paid with no QB bill, no `PO-9###` ever reaching QB. | Ops + **WO-040** (bulk-link to QB by DocNumber, OPEN) + **WO-020** (BLOCKED-DISCUSSION, needs your GO) | Open |
| **M2/M3** | WO-067 phantom DS sales tax and AI redraft overwriting your manual edits. | **WO-067** | See §3 |
| **M5** | Builder cost blank on picked lines. | **WO-069-B** | See §3 |

---

## 3. Where the project and the repo genuinely disagree

Three items where Cursor's ledger says shipped and the Claude project holds later evidence that it is not. In each case the project doc is the newer artifact, and Cursor could not read it.

**3.1 WO-067.** Ledger: PROD v9.9.86, Aug 03. Cursor's audit says *"treating verify fail as resolved unless project doc says otherwise."* The project doc says otherwise. `WO-067_VERIFY_FAIL_CW_Aug04.md` is dated **Aug 04**, after the prod push, and records three failures. FAIL 1 (agency-speak voice) was fixed. **FAIL 2** (AI redraft destroys manual edits) and **FAIL 3** (phantom 9.5% sales tax on a pure Design Services invoice, INV-6055, $3,888.56 against a correct $3,885.00) have no closing evidence anywhere in either source. Treat as open.

**3.2 WO-069-B.** Ledger: PROD Aug 03, cost fixed in `ft028c`, *"Canary unitCost=114.33."* The project doc `WO-069-B_COST_STILL_BLANK_CW_Aug04.md` is dated **Aug 04** and reopens it: the canary asserted the resolver's return value, not the created line. Your screenshots showed Cost blank on both lines while client price populated. *"Status: cost item NOT closed. Reopen pending decisive test."* The decisive test (hard refresh onto ft028c, add one fabric line, read Cost in Manage) is still unrun.

**3.3 WO-041 / WO-048.** Ledger row: DONE-UNVERIFIED. Ledger log, Jul 17: *"WO-041 tear sheet VERIFY = FAILED (partial). Root cause found: the redesign only reached the Proposals batch generator; the per-product Tear Sheet button and ideabook still call the OLD Product Specification generator @79198/@80420."* That is what printed full-bleed for Peek Can. WO-048 exists to fix it and is still OPEN.

**Also worth a rule:** `WO-035` is marked `SUPERSEDED by 038`, but the log notes the old label *"still shows 'Shipping & adjustments' on prod — still pending."* Superseding a work order did not remove the user-visible defect.

---

## 4. Decisions waiting on you

Shorter than v1.0, because several were decided and shipped. These are the ones the ledger or a live spec is actually blocked on.

### Blocking a build right now

1. **SEL-1 — Selections edit persistence: (a), (b), or (c).** `BLOCKED-DECISION` since **Jul 10**. Editing Category inline or via the Edit modal shows a success toast and does not persist for library / products / Houzz rows. Options on file: (a) explicit library APPLY, edits the canonical product; (b) find-or-create clip, project-scoped; (c) read-only here, edit in `#/library`. **This is the oldest blocked item you have, and WO-113 Part 1 makes it worse by adding proposal-sourced rows to the same surface without saying whether they are editable.**
2. **WO-113 Part 2 — flip the clip-ensure write gate on.** `window._cchDocLineClipEnsureApply` has been default OFF since Jul 27, which is why the Rolling Hills backfill was one-time and new lines stopped syncing. Part 1 is coded at 9.9.168 and undeployed. Part 2 needs a staging GO.
3. **WO-113 Part 3 — one visibility rule.** The spec hands you the choice: add `cchClipShouldHideFromProductViews` to **both** loaders or **neither**. *"Pick one rule, document it."*
4. **WO-008 — room board approve/decline notifications.** `BLOCKED-DISCUSSION`: *"Schema changes = needs Cindy GO."*
5. **WO-020 — staging Houzz close-out.** `BLOCKED-DISCUSSION`: prod Houzz is all closed (2,248 hidden); staging has 30 open and 309 hidden. Data parity gap, not a code bug. *"Bulk staging Houzz close-out needs Cindy GO."*
6. **Room placement model — scoping.** `BLOCKED-SCOPING`. Model locked with you Jul 29, and the ledger is emphatic: *"no code until scoped, coordinated WO not yet cut, do NOT hand to Cursor until scoped."*
7. **Client-visibility boundary, three features.** Still `OPEN CONFIRM` in the ledger from Aug 07: do Room Boards, Documents, and Updates stay client-facing, or move internal. Flagged *"NOT silently dropped."*
8. **Does Vanessa log in as herself?** Open question in the ledger since **Jul 11**, never answered. It silently gates WO-105 and WO-108, both of which scope by signed-in identity, and both of which shipped.

### Still open from v1.0, unchanged

9. The staging gate: canary by hand before each prod push, or scheduled. **Now cheaper than it was**, since two fixtures are documented.
10. `orders@cchdesign.com` Phase 0, two minutes, gates the unfixable-in-retrospect PO subject-line fix.
11. WO-098 portal domain name, must stay additive or it breaks Timely OAuth.
12. E-Spec PDF engine: Cloud Function or throwaway client-side v1.
13. Contractor access prod GO.
14. Design Board lane for 079 / 080 / 081. **Note:** these three have **no rows in the ledger at all.** Along with 097, 098 and 107, they are unaccounted for in the canonical tracker.

---

## 5. The tracking problem, which is now the real problem

You have five artifacts that each hold part of the truth and disagree with each other.

| Artifact | Covers | Blind to | Freshness |
|---|---|---|---|
| `loop/LOOP_LEDGER.md` | 96 WO rows, canonical state | Everything in the Claude project | Table current to Aug 13; **log stops Aug 10** |
| Claude project (146 docs) | Specs, decisions, verify-fails, finance, marketing, RH | Everything in `loop/` | Current |
| `Docs/KNOWN_ISSUES.md` | DB/RB/SEL/DOC/PEPPER issues | Both August work orders | **Aug 02, 12 days stale** |
| `Docs/CURRENT_PRIORITIES.md` | Priority ordering | The entire WO stream, Pepper, Smart Time work | **Jun 09, 65 days stale. Says "URGENT: none."** |
| Aug 06 status board (project) | 11 open WOs, 3 decisions | The other ~21 open ledger rows | Aug 06 |

Concrete consequences already visible:

- **`CURRENT_PRIORITIES.md` says URGENT is empty** while HOTFIX-032 has been a live prod break for a month and WO-113 documents a production complaint you described as *"We've been through this 100 times."*
- **`KNOWN_ISSUES.md` has no row** for either August defect: not the Aug 12 copy-to-room field drop, not the Aug 13 PRO-3035 misalignment. Both are confirmed against the live build. The file's own rule says *"Add a row when a regression is confirmed."*
- **RB-1 and RB-2** have sat at *"deployed to staging, awaiting Cynthia test → prod"* since **Jun 07**. Over two months.
- **RB-3** shipped to production Jul 06 and still occupies a row.
- The ledger table and its own log contradict each other on **WO-032** (table OPEN, log says shipped to prod), **WO-105** (table PROD, log says staging, needs GO), and **WO-078** (table PROD v9.9.91, log says staging queue v9.9.90).
- The ledger flagged itself on Aug 07: *"ledger TABLE is behind (no rows for 094/095/096 though the WO files exist)."* 094 has since been added. **095 and 096 still have no rows**, and neither do 079, 080, 081, 097, 098, 107, 110, 111, 113.
- On Jul 12 the ledger file was found *"truncated/corrupted, table ended at WO-010, WO-012 through 026 missing."* It was restored, but *"if Cursor had made ledger edits between, they were already lost."*

**Numbering has collided at least six times**, and the ledger records each one: WO-042/043 vs CW's WO-042 (renumbered to 045), Dropbox WO-003 to 006 vs ledger 003 to 006 (renumbered to 050-B through 053-B), a chat titled WO-065 when 065 was taken, a Claude filing as WO-066 when 066 was taken, plus the two WO-101s and two WO-102s. WO-060 was never cut at all and sits as a permanent `GAP` row.

---

## 6. What is new since v1.0

- **WO-112** Smart Time source split (Timely green / Agent cyan / Logged gold). DONE-UNVERIFIED, staging **9.9.162**, Aug 13. Prod needs your GO.
- **WO-113** Proposal ↔ Selections ↔ Room Boards. Part 1 coded at **9.9.168**, **not deployed**. Parts 2 and 3 open. **No client data was lost**; root cause A is that board-scoped proposals call `_addProposalLinkForItem` with no `items.push`, so the line never enters the Selections list at all. Root cause D is an empty-state lie: the header prints the filtered count, so a search typo shows "0 selections" with data behind it.
- **WO-COPY-CLIP-FIELD-CARRY** (Aug 12), grounded, fix specified, not coded. See §2.
- **Builder `ft066`** workroom cost draft fix, queued pending.
- **Tear sheet 3A/3B** staging 9.9.163 to 167; proposal Options/Tear Sheets **9.9.160 prod**; room-board tear sheet options **9.9.161 prod**.
- **Spec Book wizard** steps 1 to 4 plus invoice source shipped to staging (9.9.153 to 158), and `#/especs` landing is done. **The E-Spec book is further along than the v2.1 briefing implies** — but the four v2.1 deltas (typed `productDocs`, N-up Reece modal, token-share route, Cloud Function PDF) are confirmed absent from the code as of Aug 13.
- **Smart Time glyph fix** 9.9.159, bundled staging 9.9.160.

### One interaction nobody has flagged

`CURRENT_PRIORITIES.md` carries **"Smart Time Chrome time overcounting"**, marked **Critical**, open since Mar 25: *"Campco showed 1.25hr for 14min of actual use."* WO-112 has just made captured Agent time prominent in the Reconciliation calendar and Week view. If the capture aggregation still overcounts, WO-112 does not create the error, but it will render it front and centre in the view Vanessa reviews hours in. Worth checking the agent aggregation before WO-112 goes to prod.

---

## 7. What each side still cannot see

**Cursor cannot read the Claude project.** No `project_read` in that environment. So Cursor's audit is missing: the Aug 06 status board, the Jul 30 verification ledger, the WO-067 and WO-058 verify-fail docs, the WO-069-B cost chain, the Bugle Trail and Houzz reconciliation markdown, the Pepper master plan, the skill audits, and the entire marketing, brand, ELU, and Rolling Hills jobsite lane. Cursor's audit says so honestly in its own NOTES.

**I could not read the repo until this session.** So v1.0 was missing: the ledger's ~32 open rows, the 61 DONE-UNVERIFIED rows, HOTFIX-032, WO-027's $169,634, WO-034, WO-032's INV-6051 double-count, the `_debug` Bugle Trail dry run, KNOWN_ISSUES, CURRENT_PRIORITIES, and every WO between 001 and 048 that was never written into the project.

**Neither of us can read** the Dropbox `staging-canary.env`, `_DEPLOY_QUEUE.md` (I did not stage it), or `Docs/golden/`.

---

## The short version

1. **Fix HOTFIX-032.** One month of not being able to edit a payment on production. It is described as a single-quote change.
2. **Paste `STAGING_BOARD_HASH` and run the canary.** Two of three fixtures are already documented. Exit 0 starts converting 61 DONE-UNVERIFIED rows into something real.
3. **Answer SEL-1 (a/b/c).** Blocked since Jul 10, and WO-113 is about to pile new row types onto the same broken edit surface.
4. **Ship the copy-to-room field fix**, then decide whether to re-copy anything important. Every copy made so far lost its images, URLs and price.
5. **Pick one tracker.** The ledger is the only artifact with a state machine. Make it canonical, retire `CURRENT_PRIORITIES.md` or date-stamp it as historical, and give `KNOWN_ISSUES.md` rows for the two August defects. Right now five artifacts disagree and the disagreement is itself hiding a production break.

---

*C-Team_Aug13_v2.0. Merged from 146 project docs, LOOP_LEDGER (96 rows, 79 log entries), Cursor's Aug 13 audit, and a live read of Docs/, loop/ and _scripts/. Where the two sources conflicted, the later-dated artifact wins and the conflict is named rather than resolved silently.*
