/**
 * Incremental proposal/invoice fixes
 * Batch 1: Document links, ship-to dropdown, bigger line items
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'platform', 'index.html');
let html = fs.readFileSync(FILE, 'utf8');
const origLen = html.length;
let fixes = 0;

// ============================================================
// 1. PROPOSAL: Add linked document badges (Invoice #, PO #)
// Find the proposal header area where PRO # is displayed
// ============================================================
const propHeader = html.indexOf("prop.proposalNum || prop.number");
if (propHeader > 0) {
  // Find nearby area to add links
  const afterNum = html.indexOf("</span>", propHeader);
  if (afterNum > 0 && afterNum - propHeader < 300) {
    // Check if links already exist
    const nearbyArea = html.substring(afterNum, afterNum + 200);
    if (!nearbyArea.includes('linkedInvoice') && !nearbyArea.includes('Linked')) {
      const linkBadges = "' +\n              (prop.linkedInvoiceId ? ' <a onclick=\"navigate(\\'#/project/' + projectId + '/invoice/' + prop.linkedInvoiceId + '\\')\" style=\"font-size:11px;padding:3px 8px;background:rgba(200,185,154,0.15);color:var(--gold);border-radius:3px;cursor:pointer;text-decoration:none;margin-left:8px;\">🧾 Invoice</a>' : '') +\n              (prop.linkedPOId ? ' <a onclick=\"navigate(\\'#/project/' + projectId + '/po/' + prop.linkedPOId + '\\')\" style=\"font-size:11px;padding:3px 8px;background:rgba(0,184,212,0.15);color:var(--cyan,#00B8D4);border-radius:3px;cursor:pointer;text-decoration:none;margin-left:4px;\">📦 PO</a>' : '') + '";
      html = html.slice(0, afterNum + 7) + linkBadges + html.slice(afterNum + 7);
      fixes++;
      console.log('✅ Proposal: linked doc badges (Invoice/PO)');
    } else {
      console.log('⚠️ Proposal: links already exist');
    }
  }
}

// ============================================================
// 2. INVOICE: Add linked proposal badge
// Find invoice header where INV # is displayed
// ============================================================
const invHeader = html.indexOf("inv.invoiceNum || inv.number");
if (invHeader > 0) {
  const afterInvNum = html.indexOf("</span>", invHeader);
  if (afterInvNum > 0 && afterInvNum - invHeader < 300) {
    const invNearby = html.substring(afterInvNum, afterInvNum + 200);
    if (!invNearby.includes('linkedProposal') && !invNearby.includes('From Proposal')) {
      const invLinks = "' +\n              (inv.linkedProposalId || inv.fromProposal ? ' <a onclick=\"navigate(\\'#/project/' + projectId + '/proposal/' + (inv.linkedProposalId || inv.fromProposal) + '\\')\" style=\"font-size:11px;padding:3px 8px;background:rgba(200,185,154,0.15);color:var(--gold);border-radius:3px;cursor:pointer;text-decoration:none;margin-left:8px;\">📋 Proposal</a>' : '') + '";
      html = html.slice(0, afterInvNum + 7) + invLinks + html.slice(afterInvNum + 7);
      fixes++;
      console.log('✅ Invoice: linked proposal badge');
    }
  }
}

// ============================================================
// 3. PROPOSAL/INVOICE: Ship-to dropdown with workrooms/receivers
// Add a ship-to section in the document info area
// ============================================================
if (!html.includes('function showShipToDropdown')) {
  const shipFunc = `
    function showShipToDropdown(projectId, docId, collection, currentShipTo) {
      var locations = [
        '— Select Ship To —',
        'Client Home',
        'CCH Design Studio — 2481 N. Riverside Dr, Santa Ana, CA',
        'CBH Office',
      ];
      // Add known workrooms and receivers
      (window._workrooms || []).forEach(function(w) { locations.push('Workroom: ' + (w.name || w)); });
      (window._receivers || []).forEach(function(r) { locations.push('Receiver: ' + (r.name || r)); });
      locations.push('+ Add New Location');

      var opts = locations.map(function(loc) {
        return '<option value="' + escAttr(loc) + '"' + (loc === currentShipTo ? ' selected' : '') + '>' + esc(loc) + '</option>';
      }).join('');

      return '<select class="form-input" style="font-size:12px;padding:4px 8px;min-width:200px;" onchange="updateDocShipTo(\\'' + escAttr(projectId) + '\\',\\'' + escAttr(docId) + '\\',\\'' + collection + '\\',this.value)">' + opts + '</select>';
    }

    async function updateDocShipTo(projectId, docId, collection, value) {
      if (value === '+ Add New Location') {
        value = prompt('Enter new ship-to address:');
        if (!value) return;
      }
      try {
        await db.collection('boards').doc(projectId).collection(collection).doc(docId).update({ shipTo: value });
        showToast('Ship-to updated');
      } catch(e) { showToast('Error: ' + e.message, 'error'); }
    }
`;
  const insertPoint = html.indexOf('function closeModal()');
  if (insertPoint > 0) {
    html = html.slice(0, insertPoint) + shipFunc + '\n    ' + html.slice(insertPoint);
    fixes++;
    console.log('✅ Ship-to dropdown functions added');
  }
}

// ============================================================
// 4. PROPOSAL: Bigger line item font and padding
// ============================================================
const docItemCSS = `
    /* DOCUMENT LINE ITEMS - bigger, more readable */
    .doc-items-table th { font-size: 12px !important; padding: 12px 14px !important; }
    .doc-items-table td { font-size: 14px !important; padding: 14px 14px !important; }
    .doc-items-table img { width: 56px; height: 56px; object-fit: cover; border-radius: 0; }
    .doc-items-table .item-title { font-weight: 600; font-size: 15px; }
    .doc-items-table .item-desc { font-size: 12px; color: var(--gray-400); margin-top: 2px; }
`;
if (!html.includes('DOCUMENT LINE ITEMS')) {
  const si = html.indexOf('</style>');
  if (si > 0) {
    html = html.slice(0, si) + docItemCSS + '\n  ' + html.slice(si);
    fixes++;
    console.log('✅ Bigger line items CSS');
  }
}

// ============================================================
// 5. Load workrooms and receivers for ship-to dropdowns
// ============================================================
if (!html.includes('loadWorkroomsAndReceivers')) {
  const loadFunc = `
    async function loadWorkroomsAndReceivers() {
      if (window._workrooms && window._receivers) return;
      window._workrooms = []; window._receivers = [];
      try {
        var ws = await db.collection('workrooms').get();
        ws.forEach(function(d) { window._workrooms.push(d.data()); });
      } catch(e) {}
      try {
        var rs = await db.collection('vendors').get();
        rs.forEach(function(d) { var v = d.data(); if (v.type === 'receiver' || v.isReceiver) window._receivers.push(v); });
      } catch(e) {}
    }
`;
  const ip = html.indexOf('function closeModal()');
  if (ip > 0) {
    html = html.slice(0, ip) + loadFunc + '\n    ' + html.slice(ip);
    fixes++;
    console.log('✅ loadWorkroomsAndReceivers added');
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
