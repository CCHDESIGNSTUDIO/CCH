# Session log — Cursor — 2026-10-02

## Overview

Staging Order Builder import showed "Detected QuickBooks PO layout but found no groups" on the Bartolo Cloud Rolling Hills budget. WO-265.

## What changed

- `platform/builder/index.html` — `$0.00` is no longer a QuickBooks sub-line. An estimate with Description/Qty is read before those checks. A Budget Proposal with Treatment Scope is one line per room. A title that is only `(Big window)` takes the first sentence of the verbiage. Builder rev `2026-10-02wo-import-layout`.

## Deployed

Staging hosting only. Production builder is unchanged.

## Not deployed

- Production hosting. Needs a GO.
- `Functions/index.js`.

## Verify

Hard refresh https://cch-platform-staging.web.app/builder/. Banner should read `2026-10-02wo-import-layout`. Import the Bartolo budget. The markup prompt should appear. Room lines should sum to $116,638 before markup. The batched estimate PDF is 114 cost lines with the same total.

## WO-266

The unknown-layout dialog was pdf.js splitting `2026-00617`. Staging builder rev `2026-10-02wo-from-budget` writes one work order per room with the scope as the description and the pre-tax amount as the cost. Production unchanged.

## WO-267

CLO-W-20 preview put the whole scope in the left Design Intent column, so it would not fit the landscape sheet. Staging rev `2026-10-02wo-scope-print` draws that text full width. Production unchanged.

## WO-268

The full-width description left no room for the shade image and detail photos. Staging rev `2026-10-02wo-scope-page2` keeps page 1 as the image sheet. The workroom description prints on page 2. No re-upload. Production unchanged.

## Open

- Cloud Code has not written PASS/FAIL for WO-255–258.
- Sort-by-room was not built.
