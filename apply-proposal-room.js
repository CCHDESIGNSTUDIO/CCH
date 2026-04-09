/**
 * Add Room dropdown column to proposal item rows
 * Room transfers to invoices and POs when converted
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'platform', 'index.html');
let html = fs.readFileSync(FILE, 'utf8');
const origLen = html.length;
let fixes = 0;

// Strategy: Find where proposal items are rendered as table rows
// and insert a Room dropdown cell after the Vendor cell

// The proposal detail renders items in a template literal
// Find: item.vendor in the proposal section
const propFunc = html.indexOf('function renderProposalDetail');
if (propFunc < 0) { console.log('❌ renderProposalDetail not found'); process.exit(1); }

// Get the full function area
const nextFunc = html.indexOf('\n    async function ', propFunc + 100);
const propArea = html.substring(propFunc, nextFunc > propFunc ? nextFunc : propFunc + 20000);

// Find the vendor cell pattern in proposal items
// It should look like: esc(item.vendor || '') ... </td>
const vendorPatterns = [
  "esc(item.vendor || '')",
  "esc(item.vendor||'')",
  "esc(item.vendor || '-')"
];

let vendorFound = false;
for (const pat of vendorPatterns) {
  const vendorIdx = propArea.indexOf(pat);
  if (vendorIdx > 0) {
    // Find the </td> after this vendor cell
    const tdClose = propArea.indexOf("</td>'", vendorIdx);
    if (tdClose > vendorIdx && tdClose - vendorIdx < 200) {
      const absPos = propFunc + tdClose + "</td>'".length;

      // Check if room cell already exists right after
      const nextChunk = html.substring(absPos, absPos + 100);
      if (nextChunk.includes('item.room')) {
        console.log('⚠️ Room cell already exists after vendor');
        vendorFound = true;
        break;
      }

      // Insert room dropdown cell
      const roomCell = " +\n                    '<td><select class=\"form-input\" style=\"font-size:11px;padding:2px 4px;min-width:90px;\" onchange=\"updateProposalItemField(\\'' + projectId + '\\',\\'' + (prop.id || docId) + '\\',' + (item._idx !== undefined ? item._idx : 'idx') + ',\\'room\\',this.value)\"><option value=\"\">' + esc(item.room || '—') + '</option>' + " +
        "(['Living Room','Kitchen','Primary Bedroom','Primary Bath','Guest Bedroom','Guest Bath','Dining Room','Family Room','Office','Outdoor','Hallway','Staircase','Powder Room','Laundry','Media Room'].map(function(r){return '<option value=\"'+r+'\"'+(r===(item.room||'')?'selected':'')+'>'+r+'</option>';}).join('')) + " +
        "'<option value=\"__new__\">+ New</option></select></td>'";

      html = html.slice(0, absPos) + roomCell + html.slice(absPos);
      fixes++;
      console.log('✅ Room dropdown cell inserted after vendor');
      vendorFound = true;
      break;
    }
  }
}

if (!vendorFound) {
  console.log('⚠️ Could not find vendor cell pattern in proposal');
  // Log what's around the item rendering for debugging
  const itemsIdx = propArea.indexOf('items.map');
  if (itemsIdx > 0) {
    console.log('Items.map found at offset:', itemsIdx);
    console.log('Context:', propArea.substring(itemsIdx, itemsIdx + 300));
  }
}

// Also ensure room is included when proposal converts to invoice
const convFunc = html.indexOf('createInvoiceFromProposal');
if (convFunc > 0) {
  const convArea = html.substring(convFunc, convFunc + 3000);
  // Check if room is being copied
  if (!convArea.includes("room:") && !convArea.includes("item.room")) {
    // Find where items are mapped
    const mapIdx = convArea.indexOf('.map(');
    if (mapIdx > 0) {
      // Find the object being created in the map
      const objStart = convArea.indexOf('{', mapIdx + 10);
      const objEnd = convArea.indexOf('}', objStart + 50);
      if (objStart > 0 && objEnd > objStart) {
        // Insert room field
        const absObjEnd = convFunc + objEnd;
        const roomField = ", room: item.room || ''";
        html = html.slice(0, absObjEnd) + roomField + html.slice(absObjEnd);
        fixes++;
        console.log('✅ Room field added to proposal→invoice conversion');
      }
    }
  } else {
    console.log('✅ Room already in conversion');
  }
}

// VALIDATE
const newLen = html.length;
const end = html.slice(-30).trim();
console.log('\n=== RESULTS ===');
console.log('Fixes:', fixes, '| Orig:', origLen, '| New:', newLen, '| OK:', end.endsWith('</html>'));
if (newLen < origLen - 100 || !end.endsWith('</html>')) { console.log('❌ ABORT'); process.exit(1); }
fs.writeFileSync(FILE, html);
console.log('✅ SAVED');
