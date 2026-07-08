# Staging deploy note — 2026-07-08

**Status:** Staged locally — deploy staging on Cindy GO. Production unchanged.

## Folded batch (ship together)

### Client Portal — Decisions & Documents
| Item | File | Notes |
|------|------|-------|
| Image `Image">` artifact fix | `platform/index.html` ~69811 | `onerror` hides broken thumb instead of injecting "Image" text |
| Admin Edit / Delete — decisions | `cpPortalDecisionCardHtml`, `cpAdminOpenPostDecisionModal`, `cpAdminSaveClientDecision`, `cpAdminDeleteClientDecision` | Staff-only; client never sees Admin row |
| Admin Edit / Delete — shared documents | `cpPortalDocCardHtml`, `cpAdminOpenShareDocumentModal`, `cpAdminSaveSharedDocument`, `cpAdminDeleteClientDocument` | Non–studio-file rows only |
| Duplicate title prompt | `cpAdminSaveClientDecision`, `cpAdminSaveSharedDocument`, `cpPostDesignBoardAsDecision` | "Post/Share anyway?" — does not block, warns |
| URL normalize on post | `cpPortalNormalizeAttachUrls` | Drops non-http junk; keeps Firebase storage URLs |

### Time invoices & Greene (same session)
| Item | Files |
|------|-------|
| Preview toggles restored (dates/hours/rate/notes) | `cch-proposals-invoices-fix.js`, `index.html` cache bust |
| AI Draft model fix | `functions/aiInvoiceSummary.js` → redeploy `draftInvoiceSummary` |
| Sidebar "Intelligence" → "Time & Reports" | `index.html` |
| Greene merge / orphan hide | `index.html` (data cleanup already applied on prod Firestore) |

### Notes / visibility / report batch (if present in same `index.html` diff)
Include any other client-portal notes/visibility changes from the parallel handoff in this deploy — one `firebase deploy --only hosting:platform --project staging` plus functions if AI batch included.

## Deploy commands (staging only)

```powershell
cd C:\dev\CCH-Platform-Deploy\cch-deploy
firebase deploy --only hosting:platform --project cch-studio-staging
firebase deploy --only functions:draftInvoiceSummary --project cch-studio-staging
```

## Verify after deploy

1. Client Portal → Decisions: no `Image">` under renders; broken images disappear cleanly
2. Staff preview: **Admin · Edit · Delete** on decision cards and shared doc cards
3. Edit decision → Save Changes updates same doc (no duplicate)
4. Delete removes duplicate board+manual posts
5. Time invoice Print/PDF: four display toggles visible
6. Invoice Manage → Draft with AI succeeds (not 500)

## Production

Do **not** deploy until explicit GO from Cindy.
