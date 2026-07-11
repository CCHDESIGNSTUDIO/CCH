# Model Routing Rules — CCH Studio

Put the routing rule in writing once, and the orchestrator applies it on every run. The
expensive brain plans and judges; the cheap hands produce. This keeps the token bill from
eating the gains.

Paste this block into any CCH session after the brief:

```
MODEL ROUTING RULES for this team:

- planning, task-splitting, final verification: orchestrator (premium, high effort)
- drafts, variants, formatting, boilerplate, boring edits: cheap/fast tier worker
- anything needing real reasoning inside a task (tricky state logic, data-model
  decisions): mid tier worker
- never use the premium tier for work a cheap model passes the checker with

Log which tier did each task. If a cheap tier keeps failing the checker on a task type,
promote that task type one tier and note it.
```

---

## CCH-specific guardrails every worker inherits

These come from how CCH Studio actually works. Bake them into every card's `DO NOT` and
`DONE MEANS`:

- **Code lives at `C:\dev`.** Never edit the stale Dropbox `CCH-Platform-Deploy` copy — it
  is out of date and edits there are wasted.
- **Ground before you write.** Read the actual file first; never guess. If a task says
  "GROUNDING CHECK," treat it as a hard reset — re-verify every claim against the code.
- **Large CRLF files can truncate on edit.** After any edit to a big CRLF file (e.g.
  `index.html`), run `node --check` and inspect the tail to confirm nothing was cut.
- **Never deploy without an explicit GO.** Always name staging vs prod. Deploying is a hard
  checkpoint — the orchestrator pauses for you, always.
- **The sandbox can't reach Firestore.** `googleapis.com` egress is blocked; any Firestore
  script is run locally by Cynthia from `_debug/`, not by a worker.
- **Respect the vendor data model.** `type` (dropdown), `category` (page routing), and
  `tags` (product categories) are three separate fields — never conflate them.

---

## The gate: machines first, checker second, you last

Wherever something objective exists, put it in front of the checker: a build, a linter, a
`node --check`, a smoke test. Machines gate first, the checker judges taste second, and you
see only what survived both.

```
GATE ORDER for CCH code work:
1. node --check passes + file tail intact (machine)
2. fresh-context checker grades the diff against DONE MEANS (strict pass/fail)
3. you review only what passed both, then give the GO to deploy
```

The metric to watch is **cost per accepted result.** If the team hands you 10 diffs and you
keep 4, you're doing the review work the team was meant to remove. Below ~50% accept, tighten
the brief or promote the task a tier before you scale.
