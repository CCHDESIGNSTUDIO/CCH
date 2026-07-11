# WO-007 · Project Purchase Orders tab — match Order Management layout · CW Jul 11
**Change ID:** pending #1 assign (FT) · **State:** OPEN · **Executor:** Cursor · **Verifier:** Claude (Cowork)

## Cindy's words
"The order mgmt page is better for the project PO's — seems like they should match anyhow so everything is consistent."

## Change
The project-level Purchase Orders tab should reuse the global Order Management page's presentation (its table layout, status chips, filters, row actions), scoped to the project. Ground first: find how Order Management renders (cch-order-management.js) and whether its renderer can take a projectId filter rather than forking markup. Goal is ONE PO presentation everywhere; the project tab becomes a filtered view of it. Header stat cards follow the WO-005 white/accent pattern.

## Acceptance
1. Project PO tab and Order Management visually identical for the same PO rows (screenshot comparison).
2. All existing project-PO actions still work (open, link, status).
3. No regression on the global Order Management page; no console errors.
