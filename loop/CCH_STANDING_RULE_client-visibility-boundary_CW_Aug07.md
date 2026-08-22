# CCH STANDING RULE — Client-visibility boundary (DEFAULT INTERNAL)
**Locked by Cindy, Aug 07.** Standing constraint on every current and future WO and on all AI (Pepper, Pepper365, any client-facing copy). Supersedes the narrower PO-only note by containing it.

## The principle
**Default internal.** A thing is client-facing ONLY if it is on the explicit whitelist below. If it is not on the list, it is internal — no exceptions, no "it seemed fine."

## Client-facing (the whitelist)
- **Proposals**
- **Invoices**
- **Decisions**
- **Inspiration boards**
- Plus the client's own actions on those: approvals / declines, decision responses, inspiration they add (WO-091), and the messages they send Pepper (relay).

## Internal — never client-facing
Purchase Orders (entirely — PO #, status, vendor, vendor cost, PO-sourced ETA); internal tasks and the Order Builder / work orders; receiving and bill/variance; the time ledger, hours, rates, cost, margin, Smart Time; internal follow-ups; QuickBooks; staff notes and Staff Chat; activity internals. Pepper may use all of these in **staff / vendor** context (e.g. Vanessa's PO follow-up to a vendor) — never in anything a client sees.

## Applies to
The client portal (`#/clientview/*`), client Pepper (greeting, relay, all client-facing text), client emails / invoice summaries / proposals / tear sheets / bi-weekly updates, Pepper365 email drafts to clients, and any AI-generated client-facing copy. Pepper's client greeting (WO-104) surfaces **only** whitelist items.

## To confirm with Cindy (currently shown to clients, not in the four — resolve explicitly, do not silently drop)
The portal today also exposes to clients: **Room Boards** (clients approve selections), **shared Documents / Files**, and **Updates / What's New** (the bi-weekly progress you built for clients). These look intentionally client-facing. Confirm they **stay** on the whitelist (my read: yes) or move internal — this one line shouldn't quietly remove features you built for clients.

## Enforcement
Every client-facing feature is built whitelist-first: start from "clients see nothing," then add only the four (plus their own actions). Consistent with `cch-studio-platform` v1.1 and `cch-cfo`. Any WO touching a client surface honors this without being reminded.
