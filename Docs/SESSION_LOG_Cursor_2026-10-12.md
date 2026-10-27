# Session log — Cursor — 2026-10-12

## WO-295

PO-12915 (Concretti) has three lines and empty imageUrl. It was never saved in Studio after the Houzz import. The screen was filling blanks from the product library by title. Manhattan showed that library photo. New York matched a different library row whose file does not display, so the cube, even though IN-12902 has the photo she uploaded. San Francisco has no library row, so it used a clip. PO view, edit, and print now use the stored line photo, then the linked invoice line with the same title and room, then the project clip. The first Save copies that photo onto the PO. Queued production. Studio 9.9.383. Needs a typed GO. Firestore was not written. Proposal and invoice image lookup was not changed. No print CSS change.

## WO-294

Save PO, email vendor, and save bill now ask to push to QuickBooks when the document is not there yet. After a PO push, if a vendor bill is on the PO and not in QuickBooks, a second prompt offers to push the bill, and says the bill is paid when the balance is zero. Send already asked to push the PO; that path does not ask twice. Studio payments are not pushed. Queued production. Studio 9.9.382. Needs a typed GO. Not deployed. Print/PDF not changed. `node --check` passed. Not verified in the browser.

## WO-289

Save on a proposal, invoice, or purchase order was leaving the editor for the project list (`#/project/{id}/proposals`, `/invoices`, or `/pos`). That Save button is the same on all three. Cancel already stayed on the document.

`docEditSave` in `platform/index.html` now opens that document. Invoices and proposals land on Manage. A purchase order lands on its detail page. The More menu “Back to list” is unchanged.

PRODUCTION hosting 2026-10-12 ~13:20 Cindy GO. Studio 9.9.377 on cch-platform.web.app. Compared with the previous live `index.html`: the only removed lines were the three list navigations. Other platform scripts matched production byte for byte. No commit. Functions not deployed.

## WO-293

Checking a PO item on a price or quantity line was writing the PO quantity over the quantity already typed. That overwrite is gone. Charge type Quantity change shows qty, the PO unit, and invoice line total. Walker Zanger hold 1160772 extensions sum to $6,867.91 plus tax $672.64 = $7,540.55. Rue Pierre prints $2,085.12, one cent under 87.50 × $23.83. Queued production. Studio 9.9.381. Needs a typed GO.

## WO-292

Price-change lines on the vendor bill, the PO invoice total, Bill variances, and the client invoice description now show the PO line, the invoice unit × qty, the invoice line, and the difference. The amount added to a client invoice stays the difference. Queued production. Studio 9.9.380. Needs a typed GO.

## WO-291

Ann Sacks quote 22262191 (PO-9055) Total Value is not net × qty. The price-change amount was only the unit difference, so Salluto stayed near the PO’s 30 SF. Each adjustment now has Invoice line total. Amount = that total − the PO line. Preview shows Line total. Queued production. Studio 9.9.379. Needs a typed GO. Not deployed.

## WO-290

PO-9054 totals rail showed Paid and Bill balance, and the line “Sales tax on vendor bill only,” with no pre-paid tax amount. The rail now shows Pre-paid tax under Paid, taken from the vendor bill tax charge. Print/PDF was not changed. Queued for production. Studio 9.9.378. Not deployed. Needs a typed GO.
