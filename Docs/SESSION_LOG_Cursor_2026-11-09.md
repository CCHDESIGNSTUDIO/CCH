# Session log — Cursor — 2026-11-09

## Overview

Cindy, on production. INV-6071 went to the wrong QuickBooks customer. INV-6064’s credit landed on a design-fee item. Bill variances needs a Pre-paid tax tab.

## What changed

WO-407. Bill variance tabs gain Pre-paid tax. It lists tax lines only. It does not mark them Absorbed. Studio 9.9.484.

WO-408. PO-12920 page was totaling a partial ship invoice ($16,540) instead of the saved bill ($32,630). Header, sidebar Bills, and the invoice row now use the saved bill. Variance is bill minus PO. PO line prices were not rewritten. No QuickBooks push. Studio 9.9.485.

No Firestore rewrite. No QuickBooks push. INV-6064 stays paid. INV-6071 stays on QuickBooks customer 2254.

## Verify

Hard refresh Cloud Rolling Hills, Bill variances. Tab Pre-paid tax. The $88.35 line should be there, still Undecided.
