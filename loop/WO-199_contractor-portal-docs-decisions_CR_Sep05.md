# WO-199 — Contractor access to portal docs and decisions

**CR_Sep05** · Group C · **State:** OPEN · **Pri:** High

## Symptom (Cindy, Aug 11, Client Portal)

Contractor access to portal docs and decisions. Spec written (not in this repo pass).

## Lead

`platform/cch-contractor-access.js` exists. Ground that module + portal whitelist before adding surface. Client boundary: contractors must not see POs, cost, markup, rates, staff names on time.

## Constraints

- Client-visibility standing rule. Do not widen the whitelist without Cindy.
- Staging first.
