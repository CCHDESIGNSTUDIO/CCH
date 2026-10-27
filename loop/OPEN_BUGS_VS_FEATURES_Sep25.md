# OPEN BUGS vs FEATURES — Sep 25, 2026 (PT)
**For:** Cindy Holloway / CCH Design  
**Source of truth:** `C:\dev\CCH-Platform-Deploy\cch-deploy\loop\LOOP_LEDGER.md` (SHA256 `8E67548EDA…90BCF`, mtime 2026-09-24 ~5:24 PM PT)  
**Also skimmed:** `cch-deploy\_DEPLOY_QUEUE.md` (top standing rule + recent Sep 24–15 targets)  
**Classifier:** Grok Bot (read-only; does not deploy)

## Locked context (Cindy Sep 25)
- **A — Production bugs** → production after Cindy GO; verify on live; **no staging lap**
- **B — Features / risky redesigns** → staging first
- Only **Cursor #1** deploys; this bot never deploys
- Paid / ordered / approved / signed / invoiced / void lines stay locked
- **"Update price everywhere"** was a **plan only, no WO yet** — no OPEN WO titled that way; related shipped work is DONE-UNVERIFIED (WO-249 nickel round, WO-213/214 markup/unit, WO-093 $5 ceil era). Call out only if Cindy still wants a new WO.

## Lanes
| Lane | Meaning |
|------|---------|
| **A** | REAL PRODUCTION BUG — already wrong/broken on live Studio |
| **B** | FEATURE / RISKY REDESIGN — new capability or big behavior change |
| **C** | DATA / ONE-OFF / RULES / NOT A CODE BUG — Firestore, audit, standing rule, paused discussion, gap, superseded |
| **D** | ALREADY SHIPPED / DONE-UNVERIFIED — **not** listed as open unless still broken on live |

---

## SUMMARY (act on this)

### 1) Counts (open-ish only; excludes DONE-UNVERIFIED / PROD / VERIFIED)
| Lane | Count |
|------|------:|
| **A** Real production bug | **7** |
| **B** Feature / risky redesign | **27** |
| **C** Data / one-off / rules / not a code bug | **10** |
| **Ambiguous (need Cindy)** | **4** (also counted in A/B/C with flags) |
| **Total open-ish rows parsed** | **44** (+ WO-035 SUPERSEDED counted in C) = **45** |

Ledger open-ish states found: `OPEN` (28), `HOLD-SPEC` (9), `IN PROGRESS` (2), `BLOCKED-DISCUSSION` (2), `GAP` (2), `OPEN (A/B) · §C DONE-UNVERIFIED` (1), `SUPERSEDED by 038` (1).  
**DONE-UNVERIFIED:** 198 rows — **lane D**; not in open list below.

### 2) Recommended first **production-bug** batch (clearest **A** → prod after GO)
1. **WO-032** — Edit/delete payments on invoice+PO detail + retainer double-count guard (INV-6051 wrong balance) — **A / high**
2. **WO-033** — Invoice/PO editor live-recalc Subtotal/Tax/Total (stale until Save) — **A / high**
3. **WO-039** — Log Correspondence real file upload (attachments don’t work; URL-paste only) — **A / high**
4. **WO-237** — Selections: hide void IN-12980; clip-ID identity (**Paused** / pivoted to WO-238) — **A / med** — Cindy: resume or leave paused?
5. **WO-036** — Financial lists too slow; default YTD + scope load — **A / med** (perf on live; approach is a product change)
6. **WO-095** — Starred star icon as “?” — **A / med** but **HOLD-SPEC** (no repo file) — need spec or close
7. **WO-115** — `"$1985.00"` money strings read as 0 (legacy docs) — **A / med** — Cindy backlog “not a priority”; schedule when Park City / Shimano return

**Do not mix** these with Pepper / Design Board / RFQ feature work in one deploy batch.

### 3) Recommended **staging / feature** batch
**Near-term product (staging first):**
- **WO-046** RFQ (IN PROGRESS; Phase 1 in tree; staging hosting+rules; remainder Selections/Library/quote-back)
- **WO-028** Bi-weekly Studio editor (upload/swap images + edit text)
- **WO-038** Invoice retainer/credit as deduction under subtotal (format redesign; folds WO-035)
- **WO-031** Inspiration “Find similar” (+ small Client-price placeholder width fix)
- **WO-094** Clipper “Add images” + Studio ID stamp / Ⓢ badge
- **WO-110** / **WO-111** / **WO-085** (open A/B remainder) — Activity feed / Day in Review / recency
- **WO-120** / **WO-198** / **WO-101** / **WO-106** — Pepper briefs / draft-before-save / PWA shell / all-seeing (staging; no AI prod without GO)
- **WO-007** Project PO tab = Order Management layout
- **WO-025** Fix-It AI triage bot
- **WO-029** Voice profile into invoice AI + bi-weekly composer
- **WO-047** Client Updates auto-draft
- **WO-054-B** Builder → update proposal from WO(s)
- **WO-037** Portal Updates magazine cards (polish)
- **WO-109** Bug-work visible + never bill + hours-lost
- **WO-030** / **WO-087** Release notes catch-up (087 = Fable/images; Cindy skip for Cursor)

**HOLD-SPEC (do not build until Cindy/spec):** WO-079, 080, 081, 088, 097, 098, 102, 103 (+ WO-095 if treated as feature-spec rather than live bug).

### 4) Needs Cindy to decide (ambiguous)
| WO | Question |
|----|----------|
| **WO-032 vs WO-038** | Fix live retainer **double-count / edit payments** (032 = A) first; 038 is **presentation** redesign (B). Confirm 032 before 038 so money truth isn’t blocked by layout. |
| **WO-036** | Treat as **prod perf bug** (YTD default → production after GO) or **feature** (staging first)? Classifier: **A / med**. |
| **WO-237** | Still broken on live RH Selections (void IN-12980)? Resume, or leave **Paused**? |
| **WO-115** | Keep backlog, or schedule read-path harden now? (WO-118 already shipped going-forward.) |
| **WO-095** | Live star “?” bug — write a repo WO/spec, or drop HOLD? |
| **WO-200** | E-Spec “mostly done” — close to DONE-UNVERIFIED / VERIFIED, or leave OPEN for polish? |
| **WO-001** | Staging verification sweep still wanted, or close as stale? |
| **WO-008 / WO-020** | BLOCKED-DISCUSSION — Cindy GO on schema (008) and staging Houzz close-out (020)? |
| **Price plan** | No OPEN WO for “update price everywhere.” File a WO only if still desired after WO-249/213/214. |

### Deploy queue skim (Sep 25 standing rule already at top)
- Recent **production** targets done: WO-248 portal due, WO-247/246, WO-244–240, WO-239/238/236, WO-232/231, WO-228/226, WO-224/221, WO-217–219, tear sheets, etc.
- Recent **staging** only (not yet called out as Cindy-verified on live): **WO-251, WO-250, WO-249** (hosted staging 2026-09-24 ~17:25 inside 9.9.364), WO-227 payout layout staging, older staging queues.
- Queue still shows some older `STATUS: pending` lines (e.g. WO-233 rule noise, WO-230 audit) — treat ledger State as SoT for open work.

---

## FULL CLASSIFIED LIST (every open-ish WO)

Format: **WO | Title | State | Lane (confidence) | Why | Hosted note**

### Lane A — Real production bugs
| WO | Title | State | Lane | Why | Hosted? |
|----|-------|-------|------|-----|---------|
| **032** | Edit/delete payments + retainer double-count guard | OPEN | **A / high** | Live money wrong: Cindy needs edit/delete payments; INV-6051 retainer applied twice → balance clamps to $0 | No (open) |
| **033** | Invoice/PO editor live-recalc footer totals | OPEN | **A / high** | Live editor: totals stay stale until Save; Cindy “total didn’t adjust” | No (open) |
| **039** | Log Correspondence real file upload | OPEN | **A / high** | Live broken: attachments don’t work (URL-paste only) | No (open) |
| **036** | Financials load slow → default YTD + scope | OPEN | **A / med** | Live Studio slow on Invoices/POs/Proposals; YTD default is the fix shape | No (open) |
| **237** | Selections hide void IN-12980; clip IDs | IN PROGRESS | **A / med** | Live RH Selections issue; **Paused** after pivot to WO-238 | No ship for 237 |
| **095** | Starred star icon as question mark | HOLD-SPEC | **A / med** | Sounds like live UI bug; blocked on missing repo spec (Group B) | No |
| **115** | `"$1985.00"` reads as 0 (5,375 docs) | OPEN | **A / med** | Live read-path bug on legacy money strings; Cindy backlog / not priority; WO-118 fixed going-forward | No (open); WO-118 is DONE-UNVERIFIED / PROD era |

### Lane B — Features / risky redesigns
| WO | Title | State | Lane | Why | Hosted? |
|----|-------|-------|------|-----|---------|
| **007** | Project PO tab reuses Order Management layout | OPEN | **B / high** | New layout reuse; not a live breakage report | No |
| **008** | Room board approve/decline notifications + badge | BLOCKED-DISCUSSION | **B / high** | New notifications/schema; needs Cindy GO | No |
| **025** | Bugs & Requests “Fix-It” AI first-responder | OPEN | **B / high** | New AI bot capability | No |
| **028** | Bi-weekly Studio editor upload/swap + edit text | OPEN | **B / high** | Feature completion (“looks great” but needs editor) | No |
| **029** | Wire CCH voice into invoice AI + bi-weekly | OPEN | **B / high** | New AI voice wiring; prod AI needs GO | No |
| **030** | Release Notes / What’s New catch-up | OPEN | **B / med** | Content/changelog update (product page freshness) | No |
| **031** | Inspiration “Find similar” + Client-price placeholder | OPEN | **B / high** | New reverse-image capability (+ small UI clip) | No |
| **038** | Retainer/credit as deduction under subtotal | OPEN | **B / high** | Invoice **format redesign**; folds WO-035 | No |
| **037** | Portal Updates list → magazine gift cards | OPEN | **B / high** | Tier-2 polish / redesign | No |
| **046** | RFQ to vendors from Selections/Library/Proposal | IN PROGRESS | **B / high** | New RFQ product; Phase 1 in tree; **staging queue** | Staging queue noted; not marked PRODUCTION |
| **047** | Client Updates Build-from-project auto-draft | OPEN | **B / high** | New auto-draft feature | No |
| **054-B** | Builder: Update proposal from WO + multi-select | OPEN | **B / high** | New Builder→Proposal capability | No |
| **079** | Design Board: decision PDF autofill images | HOLD-SPEC | **B / high** | New DB capability; spec only in Claude project | No |
| **080** | Design Board: rotate element | HOLD-SPEC | **B / high** | New DB capability | No |
| **081** | Design Board: text styling / accents / layering | HOLD-SPEC | **B / high** | New DB capability | No |
| **085** | Project recent activity + recency filter | OPEN (A/B) · §C DONE-UNVERIFIED | **B / med** | §C shipped staging 9.9.103; **A/B remainder still OPEN** (recency + missing Studio events) | §C staging 9.9.103 |
| **087** | Release notes current + image-based | OPEN | **B / med** | Cindy Aug06: skip images for Cursor — Fable | No |
| **094** | Clipper Add images + Studio ID stamp + Ⓢ | OPEN | **B / high** | New Clipper UI capability | No |
| **097** | Timely / Smart Time naming | HOLD-SPEC | **B / med** | Naming product decision; bundled 096–098 | No |
| **098** | Portal domain name | HOLD-SPEC | **B / med** | Naming; **must stay additive or breaks Timely OAuth** | No |
| **101** | Pepper Desktop installable shell (PWA) | OPEN | **B / high** | New Pepper shell | No |
| **102** | Vendor reply ingest + PO reconciliation | HOLD-SPEC | **B / high** | New ingest product; HOLD + number collision note | No |
| **103** | Pepper persona (desktop) | HOLD-SPEC | **B / high** | Held behind 101/102 | No |
| **106** | Pepper all-seeing firm-wide | OPEN | **B / high** | New firm-wide Pepper rollup | No |
| **109** | Bug-work visible + never bill + hours-lost | OPEN | **B / high** | New time/bug accounting feature | No |
| **110** | Activity Feed rebuild | OPEN | **B / high** | Rebuild / new feed behavior | No |
| **111** | Daily activity timeline (Day in Review) | OPEN | **B / high** | New timeline product | No |
| **120** | Pepper daily/weekly/monthly briefs | OPEN | **B / high** | New briefs product; notes say **staging first** | No |
| **198** | Pepper draft bug/feature/task before save | OPEN | **B / high** | Pepper learning feature still in flight | No |
| **200** | E-Spec book | OPEN | **B / low** | Group C leftover polish; Cindy “mostly done” | No code this pass historically |

### Lane C — Data / one-off / rules / not a code bug
| WO | Title | State | Lane | Why | Hosted? |
|----|-------|-------|------|-----|---------|
| **001** | Staging verification sweep RB-1 + DOC-1 | OPEN | **C / high** | Verify-only; no code change | N/A |
| **020** | OM staging→prod Houzz parity (DATA) | BLOCKED-DISCUSSION | **C / high** | **DATA not code**; diagnose done; bulk close-out needs Cindy GO | N/A |
| **034** | QB fees/services Taxable — AUDIT + fix | OPEN | **C / med** | Filed as **audit first** (report table); fix may become A after audit | No |
| **035** | Relabel retainer/discount bucket | SUPERSEDED by 038 | **C / high** | Superseded; do not build | N/A |
| **040** | Bulk-link unlinked INV/PO to QB by DocNumber | OPEN | **C / med** | Red-dot **data** backlog + new link tool; dry-run first | No |
| **060** | Tile-name hide fix (Arcillas) | GAP | **C / high** | **Permanent GAP** — never cut; do not invent spec | N/A |
| **088** | (base number; only 088-B known) | HOLD-SPEC | **C / high** | Placeholder / do not invent | N/A |
| **107** | (unaccounted) | GAP | **C / high** | GAP — no spec; do not invent | N/A |

### Lane D — Already shipped / DONE-UNVERIFIED (do **not** put in open bug list)
- Ledger has **~198 DONE-UNVERIFIED** (+ a few PROD / VERIFIED*). Per Cindy: keep these **out** of the open A/B list unless she still sees them broken on **live**.
- **Recent staging-hosted (verify on staging / then Cindy GO for prod):** WO-**251**, **250**, **249** (staging ~2026-09-24 17:25 PT inside 9.9.364); also older staging-only items still DONE-UNVERIFIED (e.g. WO-227 payout layout staging, many Aug/Sep “Staging queue” notes).
- **Recent PRODUCTION-hosted (Cindy GO):** WO-248, 247, 246, 244–240, 239, 238, 236, 232, 231, 228, 226, 224, 221, 217–219, 215/216, 214/213/212, 211–205, etc. — lane **D**.
- **Data one-offs already applied (DONE-UNVERIFIED):** WO-245, 243, 235, 222, 204, 183, etc. — lane **D** / historical C work that shipped.
- If Cindy reports any DONE-UNVERIFIED item still broken on live, re-open that WO into lane **A** (prod after GO) rather than re-staging by default.

---

## Price / markup callout
- **No OPEN WO** for “Update price everywhere” / markup-check / price-sync plan.
- Related **DONE-UNVERIFIED** (not open): WO-249 ($0.05 up), WO-214/213 (nearest $1 / markup+sell), WO-093 (older $5 ceil), WO-118 (clip cost string→number going-forward).
- If Cindy still wants a platform-wide price pass, **file a new WO** — do not overload 115/249.

---

## Method notes
- Parsed markdown table columns: WO | Title | Change ID | State | Attempts | Executor | Verifier | Notes.
- Included states: OPEN, IN PROGRESS, BLOCKED-DISCUSSION, HOLD-SPEC, GAP, SUPERSEDED, hybrid OPEN(A/B)·§C DONE-UNVERIFIED.
- Excluded from open list: DONE-UNVERIFIED, PROD, VERIFIED* (summarized under D).
- Did **not** invent WO numbers. Confidence reflects Notes clarity vs age/HOLD/GAP.
- Bot does not deploy; Cursor #1 only.

---

## Cindy decisions Sep 25 (~11:32 PT)
- **WO-237 (#4):** CONFIRMED prod bug. Void/ghost invoice lines (e.g. IN-12980) must not appear on Selections — those items are on another invoice. Resume (was paused).
- **WO-095 (#6):** CONFIRMED prod bug. All `??` / broken star icons must be fixed. Promoted HOLD-SPEC → OPEN.
- **WO-115:** Cindy does not remember; leave BACKLOG (not priority) unless a live project hits it.

### Cindy Sep 25 ~3:33 PT — NEW prod bug WO-252
PRO-3047 approved → "Cannot edit line" blocks opening line detail. She still needs notes, images, product link. Money stays locked. Lane A → production after GO.
### Cindy Sep 25 — NEW prod bug WO-253
Room Boards: removed proposal items stay; declined not showing Declined. Lane A → production after GO.

