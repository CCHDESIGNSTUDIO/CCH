# INCIDENT — Rolling Hills notes + Pepper memory loss · 2026-08-02

**Severity:** High (Cindy's working memory) · **Owner:** all agents · **Project:** `cloud-rolling-hills`

## What Cindy said
Agents crashed her computer. She did **not** switch projects. Crash killed the session → Rolling Hills notes / Pepper conversation gone. She is pissed. Pepper must remember this.

## What actually happened (Cindy correction Aug 2 evening)
- **Cause class:** machine/browser death from agent work — not navigation.
- Pepper chat is **only in the open page**. A crash = total loss of that chat. Blaming “project switch” was wrong for this incident.
- Agents must own: heavy work (encoding thrash, big deploys, Dropbox+repo history, runaway scripts) has frozen/crashed this machine before. Do not put that on Cindy.

## What code shows (grounded)
1. **Pepper chat is not persisted.** `platform/cch-pepper.js` `clearChat` (~1292) empties the DOM log. Nothing writes Pepper conversation to Firestore. Crash / kill / reload = gone. (There is also an auto-clear on route change ~1675 — **not** what happened here.)
2. **Project Notes** live in `boards/{projectId}/projectNotes` (`projectNoteSave` / `projectNoteDelete` in `index.html` ~74902+). WO-067 (invoice AI summary) does **not** write or delete that collection. Anything only typed into Pepper was never in that collection.
3. **Invoice Client View (WO-067):** Client sheet no longer dumps Manage “+ Notes” time-log under outcomes (by design). Those notes should still exist under Manage / line notes — not deleted from Firestore by that change.

## Standing rule for agents
- Treat Cindy’s notes as sacred. No destructive scripts on `projectNotes` / `notes` / comms without typed GO naming the collection.
- Pepper system prompt (`Functions/cchPepper.js`) now includes this incident as hard memory (deploy `cchPepper`).
- Next product work (needs Cindy GO): persist Pepper chat per project so switching tabs does not erase her dictation.

## Recovery checklist
1. Confirm which surface: Project Notes tab · Pepper chat · invoice Manage line notes · something else.
2. Firestore: count `boards/cloud-rolling-hills/projectNotes` on **production**.
3. If docs missing: Firebase console point-in-time / prior backup; re-entry assistance only after we know the gap.
