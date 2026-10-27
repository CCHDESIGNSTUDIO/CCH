# SHIPPED — DO NOT RE-INSERT THE FACTS BLOCK

**v1.1 facts block is already in** `Functions/cchPepper.js` `buildSystemPrompt()` and was deployed staging+prod on **2026-08-12 ~16:54**, then carried by later `cchPepper` deploys (through **9.9.217**).

Do **not** paste the Aug 12 facts array again. That would duplicate the block and re-teach the stale “no Pay Now” line.

**v1.0** (prod-deploy-by-Cursor) remains a do-not-use stub: `Docs/WO-PEPPER-FACTS_CR_Aug12_v1.0.md`.

---

## Follow-up (this rewrite) — Pay Now fact

**CR_Aug20_v1.2** · Lane: **Cursor** · File: `Functions/cchPepper.js` only · **Staging functions first; prod functions on Cindy GO.**

Square hosted checkout + Zelle have been live since **9.9.189 / 9.9.204**. The v1.1 line *“there is no Pay Now in Studio”* is false.

### Change (already in tree)

Replace that one facts bullet only. Persona, standing incident, digest rules, and the rest of the facts block stay.

Was: QuickBooks is SoT; there is no Pay Now in Studio.

Now (`cchPepper.js:98`): QuickBooks is SoT for **paid/balance**. Clients pay via a **Square hosted checkout link or Zelle**. Studio has **no card fields** and **no in-app card form**.

### Deploy — STAGING only until Cindy GO

```powershell
cd C:\dev\CCH-Platform-Deploy\cch-deploy
```

```powershell
firebase deploy --only functions:cchPepper --project staging
```

Do **not** deploy production. Cindy runs the gated prod functions deploy after staging verify.

### Verify (staging Pepper)

1. “How does a client pay an invoice?” → Square link and/or Zelle; no card form in Studio; QB is source of truth for paid.
2. “Why didn’t the library price update on the proposal?” → snapshots (unchanged).
3. Tone still Pepper; still drafts only.

Hosting **9.9.235** does not activate this line. Pepper reads the **deployed function**.
