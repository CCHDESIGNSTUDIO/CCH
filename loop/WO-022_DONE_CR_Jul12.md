# WO-022 DONE (Phase A) · Untagged time capture · CR Jul 12 · STAGING

**Verifier:** Claude (Cowork) · **Production:** NOT deployed · **Depends:** WO-024 resync (Cindy GO)

## Grounding
| Path | Behavior |
|------|----------|
| `timelySyncEntries` Cloud Function | Saves **all** events in date range — no tag/service gate |
| `timelyEntries` → Timely Logged view | All docs shown; Pending = not yet in `timeEntries` ledger |
| `confirmTimelyLog` | **Was** forcing default service — **now** allows blank service → $0 until assigned |
| Desktop log import | `importDesktopLog()` — separate path; groups by project, does not drop untagged |

## Gap (documented, not auto-fixed)
**Timely AutoSheet suggestions never logged in Timely** (e.g. Feb 2 7h58m suggestion, 0h logged) may not appear in Timely `/events` API — only **logged** hours sync. Recovery for those days may need manual log in Timely first, or desktop-agent import. WO-024 unblocks **logged-but-untagged** era (Feb 9 style).

## Shipped (Phase A)
- Service optional on ledger save from Timely modal (blank → no rate, not forced to CCH Design Services).
- Existing **Not Yet Logged** stat + Pending filter (WO-023) surfaces the pile.

## Phase B (future)
Reconciliation assign queue for desktop/unlogged suggestions; auto-suggest project from note; nav badge.
