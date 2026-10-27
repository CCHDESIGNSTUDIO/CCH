# Pepper — How to use it (for Vanessa & Claude)

**File:** `Docs/PEPPER_HOW_TO_FOR_VANESSA_CR_Aug17_v1.0.md`  
**Author:** Cursor (grounded in `platform/cch-pepper.js` + `Functions/cchPepper.js`)  
**Date:** August 17, 2026  
**Audience:** Vanessa Holliday · Claude (Cowork / agents writing Vanessa materials)  
**Studio build context:** **9.9.216+** (project **money + order chase**: proposals/invoices/POs, confirmation/bills/not-received; tasks + activity since 9.9.215)

---

## 1. Two Peppers — do not mix them up

| | **Staff Pepper** | **Client Pepper** |
|--|------------------|-------------------|
| Where | Floating button inside **Studio** (staff login) | Client portal header |
| Who | Cindy, Vanessa, studio team only | Clients |
| Code | `platform/cch-pepper.js` + Cloud Function `cchPepper` | Separate client module (different guardrails) |
| Sees money / cost / POs | Yes (staff) | No — client-safe only |
| Role | Draft helper + status from digests | Limited portal help |

This guide is **Staff Pepper** only.

---

## 2. What Pepper is (and is not)

**Is:** A staff draft + briefing assistant — **proactive money and order chase**. It reads **automatic digests** from the page/project you have open and drafts copy or answers “what’s open / what to chase next.”

**Is not:**
- A decision-maker
- Permission to push QuickBooks, send POs, deploy, or spend money
- A replacement for Cindy’s approvals on QB / PO send / production deploy
- Able to see your screen pixels — only the digests Studio injects
- Live **Airtable** receiving check-ins (Studio shipping only until an Airtable-read is built)

**Escalation (say this plainly in onboarding):**  
If Pepper drafts a vendor email, invoice note, or “do this next” list, **Vanessa still follows the same rules as without Pepper**: Cindy GO for production deploy, QB-sensitive actions, and any standing “ask Cindy first” items. Pepper drafting ≠ approval.

---

## 3. Critical limit — chat does not save

Staff Pepper chat lives **only in the open browser panel**. Reload, crash, or closing the tab **wipes the conversation**.

- Do not treat Pepper as a notes app.
- For lasting notes: use **Project Notes** in Studio (or email yourself the draft).
- Aug 2, 2026 incident: machine crash wiped Rolling Hills Pepper chat. Persistence to Firestore is a future feature (needs Cindy GO) — not live today.

---

## 4. How to open the right context

Pepper answers from **where you are**:

| You are on… | Pepper can use… |
|-------------|------------------|
| **A project** (any tab) | **Money + order chase** (open AR, draft invoices, open proposals, POs missing confirmation/bills/not-received) + decisions, tasks, Follow-Ups, activity, unbilled, Design/Inspiration boards |
| **An open PO** | That PO’s details (number, vendor, lines, confirm/bill/received flags) — do not ask “which PO?” |
| **Order Management** | Firm-wide open POs / confirmation / ETA / bills (after the OM table has loaded) |
| **Follow-Ups / Tasks firm pages** | Firm-wide stalls / tasks |
| **Smart Time** | Missing-time chips scraped from the page |
| **Studio home (no project)** | **My agenda** for the signed-in person (Vanessa’s plate), not everyone’s |

**Best practice:** Open the project (or PO / OM) first, wait a second for data to load, then ask Pepper.

**All Team:** Only when you explicitly ask for firm-wide / all-team. Default is **your** plate, not Cindy’s whole firm.

---

## 5. What Pepper can see on a project (9.9.216+)

When a project is open, digests typically include:

1. **PROJECT MONEY + ORDER CHASE** (lead with this)
   - Open AR — invoices with balance (doc #, status, balance, QB synced?)  
   - Draft / unsent invoices  
   - Open proposals (not yet invoiced/declined) — send vs waiting on client  
   - POs missing **vendor confirmation**  
   - POs missing **vendor bills**  
   - POs **not fully received** (Studio `shippingStatus` — not live Airtable)  
2. **Open client decisions**  
3. **Project tasks**  
4. **Follow-Ups** stalls (if module loaded)  
5. **Recent project activity** (staff + client)  
6. **Unbilled time** (this calendar year)  
7. **Design boards** + **Inspiration boards** inventories  

**Proactive order:** Pepper is instructed to prioritize money → order follow-up → decisions/tasks.

Firm-wide **OM** (when cache warm) and **Tasks** / **Follow-Ups** pages still feed Pepper on those pages.

### What it still may *not* fully see

- Every **line item** on every proposal/invoice/PO (roster is # / status / $ / flags — open the doc for full lines)  
- Live **Airtable** receiver check-ins  
- Room Boards tile-by-tile  
- Prior Pepper chat after a refresh  

If Pepper says it can’t see **invoices / POs / money chase** after a hard refresh on **9.9.216+**, that’s a bug — report it.

---

## 6. Preset buttons (use these first)

| Preset | When to use |
|--------|-------------|
| **What’s on my agenda** | Morning start; no project required — *your* open money/time/tasks |
| **Summarize status** | Project open — **money + order chase first**, then decisions / boards |
| **What needs attention today** | Project open — proactive priority list |
| **Unbilled time** | Your unbilled hours (firm or project context) |
| **Draft client email** | Project open — client-facing draft (you send it) |
| **Draft a follow-up** | Nudge from Follow-Ups / decisions |
| **Vendor status follow-up** | OM or open PO — drafts body; you still open mailto / Send |
| **Report a bug** | Studio bug report path |

Then refine in chat: “Pull INV-6055 out of the digest,” “List design boards only,” “Deduplicate Great Room Piano if it’s the same decision three times.”

---

## 7. Prompts that work well

**Do:**
- “What’s on my agenda today?”
- “What needs attention on Rolling Hills — money first.”
- “List open AR and draft invoices on this project.”
- “Which POs still need confirmation or a vendor bill?”
- “Summarize Rolling Hills — decisions, open tasks, design boards, and what’s waiting on the client.”
- “List every open task on this project by priority.”
- “List every Design Board on this project with room.”
- “Draft a short client nudge for the oldest open decision (no subject).”
- “Vendor follow-up for this PO — confirmation + ETA only.”
- “Is Master Bath mirror listed twice in open decisions? List unique titles.”

**Don’t:**
- Paste huge PDFs / “here is the digest” — Studio already injects digests.
- Ask Pepper to “send the email,” “push to QB,” or “mark the PO sent.”
- Expect it to remember yesterday’s chat after a refresh.

---

## 8. Day-to-day workflow (Vanessa)

1. Sign in to Studio → hard refresh if Pepper seems stale (Ctrl+Shift+R).  
2. Morning: **What’s on my agenda** (home or any page).  
3. For a client: open the **project** → **Summarize status** or **What needs attention today**.  
4. For vendors: open **Order Management** or the **PO** → **Vendor status follow-up** (or row Follow up).  
5. Copy drafts into Outlook / Studio Send yourself — review before sending.  
6. Anything lasting → Project Notes or email, not Pepper chat.  
7. QB / PO send / deploy / production → Cindy rules unchanged.

---

## 9. Staff Pepper vs Team Chat

- **Pepper** = AI digests + drafts (this doc).  
- **Team Chat** = human-to-human studio chat (separate module).  
Do not expect Pepper to replace team messages or Cindy’s approvals.

---

## 10. For Claude (agents writing Vanessa docs)

When updating Vanessa onboarding:

- State Staff vs Client Pepper as a table.  
- State **draft helper + per-action Cindy escalation** (QB / PO / deploy), not only “doesn’t replace approvals” in general.  
- State **chat not persisted**.  
- List digest sources including **PROJECT MONEY + ORDER CHASE**, project tasks, full activity, Design Boards / Inspiration as of **9.9.216**.  
- Point to this file as the how-to; do not invent Console/Managed Agents skills as Pepper setup (API key is Firebase secret — ops only).

**Code truth (re-grep if claiming new capabilities):**  
`platform/cch-pepper.js` → `buildFullDigest`, `buildProjectMoneyDigest`, presets; `Functions/cchPepper.js` → system prompt + standing platform facts.

---

## 11. Quick FAQ

**Q: Has Pepper been trained on CCH Studio?**  
A: Yes in the practical sense — not a separate “fine-tune course.” Every reply gets (1) standing **CCH Studio platform facts** in the Cloud Function system prompt (doc numbers, three board types, snapshots, QB, client visibility, etc.) and (2) **live digests** from the project/page you have open. She learns by context each ask, not by remembering past chats.

**Q: Can Pepper see proposals, invoices, and POs on a project?**  
A: On **9.9.216+**, yes as a **chase roster** (doc #, status, $, confirmation/bill/not-received flags) — not every line item. Open the doc for full lines. Firm OM still helps for cross-project PO chase when the OM cache is warm.

**Q: Pepper said it can’t see design boards / tasks / invoices.**  
A: Hard refresh; confirm sidebar build ≥ **9.9.216**. Ask again with the project open.

**Q: Why did my notes disappear?**  
A: Pepper chat isn’t saved. Use Project Notes.

**Q: Can Vanessa trust Pepper’s invoice balance?**  
A: Only if that number appears in the digest / page context. Confirm in Studio Finance before client-facing money talk.

**Q: Anthropic Console / Managed Agents?**  
A: Not how Staff Pepper works. Pepper uses Studio + Firebase. Ignore Console Skills for Vanessa training.
