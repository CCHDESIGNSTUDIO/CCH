/**
 * Add Room dropdown to proposals, invoices, and POs
 * Room data flows: Proposal → Invoice → PO
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'platform', 'index.html');
let html = fs.readFileSync(FILE, 'utf8');
const origLen = html.length;
let fixes = 0;

// First, find where proposal line items are rendered
// Look for the item row rendering in proposal detail
// The pattern is: esc(item.vendor) ... </td> ... then we need room after vendor

// Find ALL places where proposal/invoice/PO items are rendered as table rows
// and add a room dropdown cell

// Strategy: Find each item row that has vendor but no room dropdown,
// and add a room select after the vendor cell

// 1. PROPOSAL DETAIL - item rows
// Find: esc(item.room || '-')  in the proposal section
// If it exists as plain text, replace with dropdown
const propIdx = html.indexOf('function renderProposalDetail');
if (propIdx > 0) {
  const propEnd = html.indexOf('function ', propIdx + 100);
  const propSection = html.substring(propIdx, propEnd > propIdx ? propEnd : propIdx + 20000);

  // Check if room is already rendered as plain text
  const roomPlain = propSection.indexOf("esc(item.room || '-')");
  if (roomPlain > 0) {
    // Replace plain text with dropdown
    const absPos = propIdx + roomPlain;
    const oldText = "esc(item.room || '-')";
    const newDropdown = "'<select class=\"form-input\" style=\"font-size:11px;padding:2px 4px;min-width:100px;\" " +
      "onchange=\"updateProposalItemField(\\'' + projectId + '\\',\\'' + docId + '\\',' + item._idx + ',\\'room\\',this.value)\">' + " +
      "(function(){ var rooms = window._projRoomList || ['Living Room','Kitchen','Primary Bedroom','Primary Bath','Guest Bedroom','Dining Room','Family Room','Office','Outdoor','Hallway','Staircase','Powder Room','Laundry']; " +
      "var opts = '<option value=\"\">' + (item.room || '— Select —') + '</option>'; " +
      "rooms.forEach(function(r){ opts += '<option value=\"' + r + '\"' + (r === item.room ? ' selected' : '') + '>' + r + '</option>'; }); " +
      "opts += '<option value=\"__new__\">+ New Room</option>'; " +
      "return opts; })() + '</select>'";

    html = html.slice(0, absPos) + newDropdown + html.slice(absPos + oldText.length);
    fixes++;
    console.log('✅ Proposal: Room dropdown replaces plain text');
  } else {
    console.log('⚠️ Proposal: room plain text not found — checking if Room header exists');
    // The Room header was added but maybe no data cell yet
    // Look for where item cells are built
    const itemRow = propSection.indexOf("esc(item.vendor");
    if (itemRow > 0) {
      console.log('  Found vendor cell in proposal at offset:', itemRow);
    }
  }
}

// 2. Add updateProposalItemField function (if not exists)
if (!html.includes('function updateProposalItemField')) {
  const func = `
    async function updateProposalItemField(projectId, docId, itemIdx, field, value) {
      if (value === '__new__') {
        value = prompt('Enter new room name:');
        if (!value) return;
        // Add to room list for this session
        if (!window._projRoomList) window._projRoomList = [];
        if (window._projRoomList.indexOf(value) < 0) window._projRoomList.push(value);
      }
      try {
        var docRef = db.collection('boards').doc(projectId).collection('proposals').doc(docId);
        var doc = await docRef.get();
        if (!doc.exists) {
          docRef = db.collection('boards').doc(projectId).collection('invoices').doc(docId);
          doc = await docRef.get();
        }
        if (!doc.exists) {
          docRef = db.collection('boards').doc(projectId).collection('purchaseOrders').doc(docId);
          doc = await docRef.get();
        }
        if (!doc.exists) return;
        var data = doc.data();
        var items = data.items || [];
        if (items[itemIdx]) {
          items[itemIdx][field] = value;
          await docRef.update({ items: items });
          showToast('Updated ' + field + ' to "' + value + '"');
        }
      } catch(e) { showToast('Error: ' + e.message, 'error'); }
    }
`;
  const insertPoint = html.indexOf('function closeModal()');
  if (insertPoint > 0) {
    html = html.slice(0, insertPoint) + func + '\n    ' + html.slice(insertPoint);
    fixes++;
    console.log('✅ updateProposalItemField function added');
  }
}

// 3. INVOICE DETAIL - add room to item rendering
// Find invoice item rows and ensure room is included
const invIdx = html.indexOf('function renderInvoiceDetail');
if (invIdx > 0) {
  const invSection = html.substring(invIdx, invIdx + 15000);
  // Check if room already rendered in invoice
  const invRoom = invSection.indexOf('item.room');
  if (invRoom < 0) {
    console.log('⚠️ Invoice: room not in item rows — needs manual check');
  } else {
    console.log('✅ Invoice: room already referenced in item rendering');
  }
}

// 4. Ensure room transfers from proposal → invoice during conversion
// Find the proposal-to-invoice conversion function
const convIdx = html.indexOf('createInvoiceFromProposal');
if (convIdx > 0) {
  const convSection = html.substring(convIdx, convIdx + 3000);
  if (convSection.indexOf('item.room') < 0 && convSection.indexOf('room:') < 0) {
    console.log('⚠️ Proposal→Invoice conversion does NOT copy room field — needs fix');
    // Find where items are mapped in the conversion
    const mapIdx = convSection.indexOf('.map(');
    if (mapIdx > 0) {
      console.log('  Items mapped at offset:', mapIdx);
    }
  } else {
    console.log('✅ Proposal→Invoice conversion includes room');
  }
}

// 5. Load room list from project clips when rendering proposals
// Add a helper that populates window._projRoomList
if (!html.includes('window._projRoomList')) {
  const roomListHelper = `
    // Load room list from project clips for dropdowns
    async function loadProjectRoomList(projectId) {
      if (window._projRoomList && window._projRoomListProjId === projectId) return;
      window._projRoomList = ['Living Room','Kitchen','Primary Bedroom','Primary Bath','Guest Bedroom','Guest Bath','Dining Room','Family Room','Office','Outdoor','Hallway','Staircase','Powder Room','Laundry','Media Room','Garage'];
      try {
        var snap = await db.collection('boards').doc(projectId).collection('clips').get();
        var rooms = new Set(window._projRoomList);
        snap.forEach(function(d) { var r = (d.data().room || '').trim(); if (r && r.length < 40) rooms.add(r); });
        window._projRoomList = Array.from(rooms).sort();
        window._projRoomListProjId = projectId;
      } catch(e) {}
    }
`;
  const insertPoint2 = html.indexOf('function closeModal()');
  if (insertPoint2 > 0) {
    html = html.slice(0, insertPoint2) + roomListHelper + '\n    ' + html.slice(insertPoint2);
    fixes++;
    console.log('✅ loadProjectRoomList helper added');
  }
}

// ============================================================
// VALIDATE
// ============================================================
const newLen = html.length;
const end = html.slice(-30).trim();
console.log('\n=== RESULTS ===');
console.log('Fixes:', fixes);
console.log('Orig:', origLen, '| New:', newLen, '| Diff:', newLen - origLen);
console.log('Ends with </html>:', end.endsWith('</html>'));

if (newLen < origLen - 100 || !end.endsWith('</html>')) {
  console.log('❌ ABORT');
  process.exit(1);
}
fs.writeFileSync(FILE, html);
console.log('✅ SAVED');
