/**
 * Add Room column to proposals + tear sheet generation
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'platform', 'index.html');
let html = fs.readFileSync(FILE, 'utf8');
const origLen = html.length;
let fixes = 0;

// Find proposal item table headers
// Look for the proposal detail renderer
const propIdx = html.indexOf('function renderProposalDetail');
console.log('Proposal detail function at:', propIdx > 0 ? 'found' : 'NOT FOUND');

// Find proposal item table headers - look for Qty and Price headers near proposals
const headers = ['Description', 'Vendor', 'Qty', 'Unit Price', 'Total', 'Status'];
// Search for proposal table headers
let searchStart = 0;
let found = false;

// Find all table headers in proposal area
const propArea = html.substring(propIdx, propIdx + 8000);
const thMatches = propArea.match(/th[^>]*>[^<]*</g);
if (thMatches) {
  console.log('Proposal table headers found:', thMatches.slice(0, 10).map(m => m.replace(/th[^>]*>/, '').replace('<', '')));
}

// Find the exact line with proposal columns
const vendorHeader = propArea.indexOf("'Vendor'");
const qtyHeader = propArea.indexOf("'Qty'");
console.log('Vendor header offset:', vendorHeader, '| Qty header offset:', qtyHeader);

// Look for the proposal line item rendering
const lineItemIdx = html.indexOf("prop.items", propIdx);
console.log('Proposal items rendering at:', lineItemIdx > 0 ? lineItemIdx : 'NOT FOUND');

// Read around that area
if (lineItemIdx > 0) {
  const context = html.substring(lineItemIdx - 200, lineItemIdx + 500);
  // Find table headers
  const thStart = context.indexOf('<th');
  if (thStart >= 0) {
    console.log('\nProposal table context:');
    console.log(context.substring(thStart, thStart + 400));
  }
}

// Search more broadly for proposal table
const propTableIdx = html.indexOf('Proposal Items', propIdx);
if (propTableIdx > 0) {
  console.log('\n"Proposal Items" found at:', propTableIdx);
  console.log(html.substring(propTableIdx, propTableIdx + 500));
}

// Don't save yet - just diagnostic
console.log('\nOrig length:', origLen);
