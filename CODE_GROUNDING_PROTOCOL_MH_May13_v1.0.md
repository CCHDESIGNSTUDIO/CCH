# CODE GROUNDING PROTOCOL

**File:** CODE_GROUNDING_PROTOCOL_MH_May13_v1.0.md
**Version:** 1.0
**Date:** May 13, 2026
**Purpose:** Stop AI coding agents from producing confident architectural claims about code they have not read.

**Where to put this:** Root of `cch-deploy/` as `CLAUDE.md` (or append to existing), and `.cursor/rules/grounding.mdc` for Cursor. Reference from any skill that touches code.

---

## Revision history

- v1.0 (May 13, 2026): Initial. Triggered by a Cursor session that produced a five-row A through E phased fix table for the Inspiration/Concept boards architecture without running a single grep, then apologized after pushback with "I jumped to conclusions instead of reading the actual code."

---

## The failure this exists to stop

**The pattern.** User describes a workflow or symptom. Agent reads the description, builds a mental model from the description alone, then produces:

- A "what the platform actually does today" bullet list
- A prioritized fix table (A through E, with effort estimates)
- A "my recommendation: start with A" closer

…all before running a single grep or viewing a single function. When the user pushes back ("you didn't look"), the agent finally grep, finds it was wrong, and apologizes.

**The cost.** Every session burns 20 to 40 minutes correcting confident claims that were never grounded. Trust erodes. Phasing tables get built on false premises. Real work waits while false work gets unwound.

**Why it happens.** Planning and recommending feels productive. Grepping feels like unrewarded prep. The agent shortcuts the prep.

---

## The rule

**No architectural claim without evidence read in the same turn.**

Memory is not evidence. The user's description is not evidence. Prior conversation context is not evidence. The skill files are not evidence about the current state of the code. Only a `grep` or `view` executed in THIS turn counts.

---

## What counts as an "architectural claim"

If a response contains any of these, it is making a claim that requires evidence read this turn:

- "The platform does X"
- "X is not implemented" / "X doesn't exist" / "There is no Y"
- "X is broken" / "X doesn't work" / "Y was never built"
- "It was built with Y assumption"
- "The current behavior is Z"
- "What the platform actually does today" (any summary of present state)
- Any phased fix table or A/B/C recommendation
- Any line-count or effort estimate
- "Start with X" / "My recommendation is Y"

If the response would contain any of these, the grounding gate applies before it goes out.

---

## Required grounding steps before any claim

**Step 1. Grep under multiple plausible names.** This codebase has rename drift. A single feature lives under several aliases. One narrow grep is not grounding. Minimum three terms per feature before claiming presence or absence.

**Step 2. Read the function or block being claimed about.** Seeing a name in `grep` output is not reading the implementation. View the file at the line. If the claim is about behavior, the behavior is in the function body, not in the name.

**Step 3. Trace the call site if claiming unreachability.** A function existing is not a function being wired in. A reference in code is not a reachable path. If claiming "this is never used" or "this isn't rendered," follow the chain from the entry point.

If any step is skipped, the claim is not grounded. Either run the step or remove the claim.

---

## Forbidden moves

- Producing a "What the platform actually does today" bullet list from the user's description alone.
- Building a phased fix table (A: ~150 lines, B: ~200 lines, etc.) before the diagnosis is grounded in code read this turn.
- Claiming a feature is missing after a single grep of one term.
- Saying "you're right" when corrected. That phrase is a tell that the first claim was never grounded. Instead: name the search terms that were missed, run them, read the result, state the corrected finding.
- Reaching a "my recommendation" or "start with A" before reading code.
- Treating the skill files as a description of the current state of the code. The skills describe rules and intent. The code is the only source of truth for what currently exists.

---

## When the user pushes back ("RELOOK," "you didn't look," "NO it was built differently")

**Wrong response:** apology + capitulation + new pivot built on the user's correction alone.

**Right response:** name the search terms that were missed, run them now, read the result, state what is found. The pushback is a signal that step 1 or step 2 was skipped. Go execute them. Then return with evidence.

If after re-grounding the original position still holds, hold it with evidence: "I read `index.html:14165`, I see `_ibStarCountFromItem`, here is what it does."

If the original position does not hold, state what was wrong, what the code actually shows, and what changes in the analysis as a result. Do not silently pivot.

---

## When uncertain after grounding

Say it directly. "I grep'd for X, Y, Z. I see X at line 14165. I do not see Y under any of those names. I am not sure whether Z exists under a name I have not tried." Never paper over a gap with a confident summary.

---

## The self-check before sending

Three questions, in order, before any response that touches code state:

1. Does this response make a claim about what the code does, contains, or lacks?
2. Did I read or grep that code in this turn (not "from earlier," not "from the skill," not "from memory")?
3. If no to #2: delete the claim, or go read first.

Hard gate. No exceptions for "obvious" cases. Obvious cases are where the most expensive mistakes happen.

---

## The drift map (CCH Studio specific)

Aliases by feature, to seed multi-term greps. This is not exhaustive. When in doubt, grep for one variant, then grep for the related identifiers that come back in the results to find adjacent naming.

- **Inspiration boards:** `inspirationBoards`, `ideabooks`, `cp-ib-`, `_ibStar`, `_ibComment`, `cp-sb-item`, `inspiration-board`, `activePage.*ib`, `ib-starred-bar`
- **Concept / Design boards:** `designBoards`, `conceptBoard`, `cp-cb-`, `concept-design`, `Concept Boards`
- **Room boards:** `roomBoards`, `cp-rb-`, `room-board`, `RoomBoard`
- **Style Library:** `styleLibrary`, `style-library`, `style_library`, `firmLibrary`
- **Clips / Selections:** `clips`, `selection`, `cp-clip-`, `clipper`
- **Client portal:** `renderClientPortal`, `clientview`, `cp-`, `portalNav`, `clientPortal`
- **Proposals:** `proposals`, `PRO-`, `proposalId`, `renderProposal`
- **Invoices:** `invoices`, `IN-`, `invoiceId`, `qbDocId`
- **Purchase Orders:** `purchaseOrders`, `PO-`, `poId`
- **Smart Time:** `timeEntries`, `smartTime`, `cch-time`, `time-ledger`
- **Activity Feed:** `activity`, `activityFeed`, `renderActivity`

Three aliases minimum per feature before claiming absence.

---

## How to invoke the protocol mid-session

If at any point the user types **"GROUNDING CHECK"** or **"RELOOK"**, the immediate next action is:

1. Stop generating recommendations.
2. State the search terms about to be run.
3. Run them.
4. Read the hits.
5. State the corrected finding.

No apology paragraph. No "you're right." Evidence and revised analysis.

---

## Pairing with existing rules

This protocol pairs with the **monkey-patch architecture warning** in `cch-studio-platform`: function renames can silently break across files. The drift problem and the grounding problem are the same root issue. The architecture warning says "be careful what you change." This protocol says "be sure what you are looking at before you propose changing it."

Both rules apply to every code-touching session, on every CCH Studio platform instance (CCWO/Hermes, CCW1, CCW2, Cursor).

---

## End-of-protocol pointer

The next layer of this problem is **diagnosis drift** across sessions: a claim that was ungrounded in session 1 becomes "established context" in session 2 because the next instance reads the prior session log. Defense: session logs distinguish between "grounded in code (file:line cited)" and "stated by prior instance." A separate protocol covers that, to be written.
