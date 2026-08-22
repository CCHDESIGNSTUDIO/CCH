# WO-051-B DONE — Application field Material A–D
**File:** WO-051-B_DONE_CR_Jul22.md · **State:** DONE-UNVERIFIED · **Attempts:** 1  
**Change ID:** FT-013 · **Executor:** Cursor Builder Jul22

## Files touched
- `platform/builder/index.html`
  - `fabricApplicationText` / `setFabricApplication` — dual-write `application` + legacy `materialUse`
  - Application text input immediately under COM|Vendor / Fabric|Trim chips on every Material A–D
  - Preview / PDF: **Application:** line in `buildPreviewFabricRow`
  - Proposal material description uses application text
  - `normalizeFabricYards` backfills application ↔ materialUse for old docs
  - Removed duplicate “Use on this treatment” fields (replaced by Application)

## Self-test
- Empty application valid; old WOs with only materialUse still display
- Autosave path: Application input calls `scheduleBuilderDraftSave`

## Queue
Batched staging with WO-049-B / 050-B.
