# Session log — Cursor — 2026-11-11

## Overview

Cindy on production, Edit INV-6079. The invoice was six combined lines again. Three of the rates were not on the time log.

## What changed

WO-415. INV-6079 is 27 lines, one per time entry. Rates are 195, 95, 75, or 0, copied from the time entry. Total $7,570.00. Complimentary is not on the invoice. Status stayed Unsent. No QuickBooks push. Studio 9.9.492. Production hosting 2026-11-11 08:32.

## Verify

Close the open Edit INV-6079 tab without saving. Hard refresh. The edit grid should list each date. The rate column should show only 195, 95, 75, or 0.

WO-416. Files ⋮ menu is navy and scrolls inside the window. Studio 9.9.493. Production hosting 2026-11-11 12:26. Hard refresh Holtz Hill Files.

WO-417. Spec Book PDF upload was rejected (storage path allowed images only) and the book record had no Firestore rule. PDFs are allowed. Download spec and Download all specs added. Studio 9.9.494. Production hosting, storage rules, and Firestore rules 2026-11-11 ~13:05. Inspiration-board share with one contractor was planned and not built.

WO-418. Pre-paid tax on Bill variances was Undecided, with Pass on and Absorbed. Those lines now read Pre-paid tax and those two buttons are not shown. A tax line she already marked Pass on or Absorbed stays that way. Studio 9.9.495. Staging hosting 2026-11-11 15:06. Production needs a GO.

WO-419. Bill variances Pending tab is named Bill to client. A pre-paid tax line defaults to Absorbed and stays on the Pre-paid tax tab. Status reads Absorbed · Pre-paid tax. Freight, discounts, and price changes still use Bill to client and Absorbed. Amounts not changed. Studio 9.9.496. Staging hosting 2026-11-11 15:40. Production needs a GO.

WO-420. Cindy: pre-paid tax is not Absorbed. The client pays that tax on the invoice. Status reads Pre-paid tax. The line stays on the Pre-paid tax tab and off the Absorbed tab. Amounts not changed. Studio 9.9.497. Production hosting 2026-11-11 15:51 after her GO. Live was 9.9.494. index.html differed by the version line and the variance script cache buster only.

WO-426. Invoice push code now sends ShipAddr. Customer ship-to first, Studio job address if the customer has none. Amounts not changed. Already-pushed invoices are not rewritten. Staging functions deploy failed earlier: Node.js 20 was decommissioned on 2026-10-30.

WO-428. Runtime in firebase.json and functions/package.json moved from Node 20 to Node 24. Production functions 2026-11-11 20:23 Cindy GO. Updated pushInvoiceToQB, pushInvoiceToQBAutomated, and processInvoiceQBPushPending. Other functions were not redeployed. No invoice was pushed. Not committed.

PO-9065 (Cloud Rolling Hills, draft, Hudson Valley 211-AGB). The line title was the vendor. The product page lived only on the library product. Title and name set to Cortland. productUrl, pageUrl, and sourceUrl set to https://www.hvlgroup.com/Product/211-AGB/. Qty 2 and cost 578 were not changed. The open Edit Line Item window still had the old name; Save would put the vendor back.

WO-421. Order Management tab Invoices missing POs. Studio 9.9.498. Staging hosting 2026-11-11 18:03. Production not deployed. WO-422 Spec Book category grouping is in the same index.html and is not finished as a work order. It is on staging with this load.

WO-427. Cindy: the missing-PO tab was full of Houzz invoices. The tab keeps Studio invoices (INV- and IN-6xxx). Houzz IN-10xxx and the other Houzz series are left off. Studio 9.9.499. Staging hosting 2026-11-11 18:22. Production hosting 2026-11-11 18:49 after her GO. Live before this was 9.9.497. The Spec Book category grouping already in index.html went out in the same load. WO-422 is still open.

WO-423. Cindy: the shared-with-contractor list is a tab on the client portal, not only the studio Contractors page. Tab is Contractors. Files and decisions already marked shared. No prices. Studio 9.9.500. Staging hosting 2026-11-11 19:04. Production not deployed.

WO-424. Share with contractors on one inspiration board. Does not publish every board and does not post a decision. Contractor page shows images and captions only. Studio 9.9.501. Staging hosting 2026-11-11 19:24. Production hosting 2026-11-11 19:28 Cindy GO. Live check: build 9.9.501, share function present, contractor script 20261111wo424. WO-423 client portal Contractors tab went out in the same load. Variance script still 20261111wo420. Functions not deployed. Not committed.

WO-425. Checklist Edit and Delete for staff. Notes from the source decision show the person’s name and what they said. Delete removes the checklist row only. Studio 9.9.502. Staging hosting 2026-11-11 19:31. Production hosting 2026-11-11 20:11 Cindy GO. Live check: build 9.9.502, portal script 20261111wo425, variance script still 20261111wo420. Checklist page not clicked while logged in. Functions not deployed. Not committed.
