# Agent Team Kit + Fable Best Practices — import manifest
**Status:** PENDING — waiting for Dropbox writes from Fable session.

## Dropbox source (canonical)
`C:\Users\cindy\Dropbox\Claude - CCH studio\Fable Best Practices & Loops\`

## Repo publish targets (after files land)
| Dropbox file | Publish to |
|--------------|------------|
| *(Fable doc 1 — name TBD)* | `Docs/` or `loop/` per content |
| *(Fable doc 2 — name TBD)* | `Docs/` or `loop/` per content |
| Agent Team Kit file 1–7 | `Docs/AGENT_TEAM_KIT/` (new folder) |

## Already in repo (overlap — do not duplicate blindly)
| File | Role |
|------|------|
| `loop/LOOP_PROTOCOL_CW_Jul10_v1.1.md` | WO cycle, ledger, deploy handoff |
| `loop/ROUTING_RULES.md` | Model tiers, CCH guardrails, gate order |
| `loop/LOOP_LEDGER.md` | Single status table |
| `Docs/CODE_GROUNDING_PROTOCOL_MH_May13_v1.0.md` | Ground-before-write |

## Cursor session note
- Cursor **cannot** use **Add folder** — Cindy adds `Claude - CCH studio` in the desktop app.
- Cursor **can** read/write Dropbox via absolute path once the folder exists on disk.
- After Fable saves both docs + sweeps the seven Kit files, tell Cursor **"import manifest"** and it will copy into `cch-deploy` and cross-link from `LOOP_LEDGER.md`.
