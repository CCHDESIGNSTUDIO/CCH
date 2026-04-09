/**
 * Batch fixes for CCH Studio
 * Run: node apply-batch.js
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'platform', 'index.html');
let html = fs.readFileSync(FILE, 'utf8');
const origLen = html.length;
let fixes = 0;

function insert(label, after, content) {
  const i = html.indexOf(after);
  if (i < 0) { console.log('⚠️ ' + label + ' — anchor not found'); return; }
  html = html.slice(0, i + after.length) + content + html.slice(i + after.length);
  fixes++;
  console.log('✅ ' + label);
}

function replace(label, old, rep) {
  if (!html.includes(old)) { console.log('⚠️ ' + label + ' — not found'); return; }
  html = html.replace(old, rep);
  fixes++;
  console.log('✅ ' + label);
}

// ============================================================
// 1. PROPOSAL: Add Room column header
// Find the proposal detail table headers
// ============================================================
const propDetailIdx = html.indexOf('function renderProposalDetail');
if (propDetailIdx > 0) {
  // Find the table headers in the proposal detail area
  // Look for <th>Vendor in the proposal section
  const propSection = html.substring(propDetailIdx, propDetailIdx + 15000);

  // Find where Vendor header is followed by Qty
  const vendorTh = propSection.indexOf("<th>Vendor");
  const qtyTh = propSection.indexOf("<th>Qty");

  if (vendorTh > 0 && qtyTh > vendorTh) {
    // Insert Room header between Vendor and Qty
    const absVendorEnd = propDetailIdx + propSection.indexOf("</th>", vendorTh) + 5;
    const roomHeader = "\n                    <th>Room</th>";
    html = html.slice(0, absVendorEnd) + roomHeader + html.slice(absVendorEnd);
    fixes++;
    console.log('✅ Proposal: Room column header added');

    // Now find the corresponding data cells
    // Look for vendor data cell in the item rows
    const updatedSection = html.substring(propDetailIdx, propDetailIdx + 20000);
    const vendorCell = updatedSection.indexOf("esc(item.vendor");
    if (vendorCell > 0) {
      // Find the closing </td> after vendor
      const vendorCellEnd = updatedSection.indexOf("</td>", vendorCell);
      if (vendorCellEnd > 0) {
        const absEnd = propDetailIdx + vendorCellEnd + 5;
        const roomCell = " +\n                    '<td>' + esc(item.room || '-') + '</td>'";
        html = html.slice(0, absEnd) + roomCell + html.slice(absEnd);
        fixes++;
        console.log('✅ Proposal: Room column data cell added');
      }
    }
  } else {
    // Try alternate header format
    const altVendor = propSection.indexOf("Vendor</th>");
    const altQty = propSection.indexOf("Qty</th>");
    if (altVendor > 0 && altQty > altVendor) {
      const absPos = propDetailIdx + altVendor + "Vendor</th>".length;
      html = html.slice(0, absPos) + "\n                    <th>Room</th>" + html.slice(absPos);
      fixes++;
      console.log('✅ Proposal: Room header added (alt format)');
    }
  }
}

// ============================================================
// 2. TEAR SHEET: Add generateTearSheets function
// ============================================================
if (!html.includes('function generateTearSheets')) {
  // Already has a button that calls it — just need the function
  const tearSheetFunc = `
    async function generateTearSheets(projectId, projectName) {
      var pricing = confirm('Include pricing on tear sheets?\\n\\nOK = Show prices\\nCancel = No prices (client version)');
      showToast('Generating tear sheets...');
      try {
        var clips = [];
        var snap = await db.collection('boards').doc(projectId).collection('clips').get();
        snap.forEach(function(d) { clips.push({id: d.id, ...d.data()}); });
        if (clips.length === 0) { showToast('No items to generate tear sheets from', 'error'); return; }

        // Sort by room then title
        clips.sort(function(a, b) { return ((a.room || '') + (a.title || '')).localeCompare((b.room || '') + (b.title || '')); });

        // Generate print-ready HTML
        var pages = clips.map(function(clip) {
          var img = clip.imageUrl || (clip.images && clip.images[0]) || '';
          var cost = parseFloat(clip.cost) || 0;
          var sell = parseFloat(clip.clientPrice) || parseFloat(clip.totalSelling) || 0;
          var qty = parseInt(clip.qty) || 1;

          return '<div style="page-break-after:always;padding:40px;font-family:DM Sans,sans-serif;max-width:800px;margin:0 auto;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;border-bottom:2px solid #C8B99A;padding-bottom:12px;">' +
              '<div style="font-size:28px;font-weight:300;letter-spacing:4px;color:#0E1629;">CCH</div>' +
              '<div style="font-size:12px;color:#888;">' + esc(projectName || '') + '</div>' +
            '</div>' +
            (img ? '<div style="text-align:center;margin-bottom:24px;"><img src="' + escAttr(img) + '" style="max-width:100%;max-height:400px;object-fit:contain;" referrerpolicy="no-referrer"></div>' : '') +
            '<div style="font-size:22px;font-weight:600;color:#0E1629;margin-bottom:8px;">' + esc(clip.title || 'Untitled') + '</div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px;">' +
              (clip.vendor ? '<tr><td style="padding:8px 0;color:#888;width:140px;">Vendor</td><td style="padding:8px 0;font-weight:500;">' + esc(clip.vendor) + '</td></tr>' : '') +
              (clip.category ? '<tr><td style="padding:8px 0;color:#888;">Category</td><td style="padding:8px 0;">' + esc(clip.category) + '</td></tr>' : '') +
              (clip.room ? '<tr><td style="padding:8px 0;color:#888;">Room</td><td style="padding:8px 0;">' + esc(clip.room) + '</td></tr>' : '') +
              (clip.sku ? '<tr><td style="padding:8px 0;color:#888;">SKU</td><td style="padding:8px 0;font-family:monospace;">' + esc(clip.sku) + '</td></tr>' : '') +
              (clip.dimensions ? '<tr><td style="padding:8px 0;color:#888;">Dimensions</td><td style="padding:8px 0;">' + esc(clip.dimensions) + '</td></tr>' : '') +
              (clip.finish ? '<tr><td style="padding:8px 0;color:#888;">Finish / Color</td><td style="padding:8px 0;">' + esc(clip.finish) + '</td></tr>' : '') +
              '<tr><td style="padding:8px 0;color:#888;">Quantity</td><td style="padding:8px 0;">' + qty + '</td></tr>' +
              (pricing && cost > 0 ? '<tr><td style="padding:8px 0;color:#888;">Cost</td><td style="padding:8px 0;font-family:monospace;">' + formatMoney(cost) + '</td></tr>' : '') +
              (pricing && sell > 0 ? '<tr><td style="padding:8px 0;color:#888;">Client Price</td><td style="padding:8px 0;font-weight:600;font-family:monospace;color:#C8B99A;">' + formatMoney(sell) + '</td></tr>' : '') +
              (pricing && sell > 0 && qty > 1 ? '<tr style="border-top:1px solid #eee;"><td style="padding:8px 0;color:#888;">Total</td><td style="padding:8px 0;font-weight:700;font-family:monospace;color:#C8B99A;">' + formatMoney(sell * qty) + '</td></tr>' : '') +
              (!pricing && sell > 0 ? '<tr><td style="padding:8px 0;color:#888;">Price</td><td style="padding:8px 0;font-weight:600;font-family:monospace;color:#C8B99A;">' + formatMoney(sell) + '</td></tr>' : '') +
            '</table>' +
            (clip.description ? '<div style="margin-top:16px;font-size:13px;color:#666;line-height:1.5;">' + esc(clip.description) + '</div>' : '') +
            (clip.notes ? '<div style="margin-top:8px;font-size:12px;color:#888;font-style:italic;">' + esc(clip.notes) + '</div>' : '') +
            (clip.sourceUrl ? '<div style="margin-top:12px;"><a href="' + escAttr(clip.sourceUrl) + '" target="_blank" style="font-size:11px;color:#C8B99A;">View Product →</a></div>' : '') +
          '</div>';
        }).join('');

        // Open in print window
        var w = window.open('', '_blank');
        w.document.write('<!DOCTYPE html><html><head><title>Tear Sheets — ' + esc(projectName) + '</title><style>@media print { body { margin: 0; } }</style></head><body>' + pages + '</body></html>');
        w.document.close();
        showToast(clips.length + ' tear sheets generated — use Ctrl+P to print/save as PDF');
      } catch(e) { showToast('Error: ' + e.message, 'error'); console.error(e); }
    }
`;

  // Insert before closeModal function
  const closeIdx = html.indexOf('function closeModal()');
  if (closeIdx > 0) {
    html = html.slice(0, closeIdx) + tearSheetFunc + '\n    ' + html.slice(closeIdx);
    fixes++;
    console.log('✅ Tear Sheets: generateTearSheets function added');
  }
} else {
  console.log('⚠️ Tear Sheets: function already exists');
}

// ============================================================
// 3. PAGE LAYOUT: Content fills screen, left-aligned
// ============================================================
const layoutCSS = `
    /* PAGE LAYOUT FIX */
    .main { margin-left: var(--sidebar-w, 220px); min-height: 100vh; }
    .content { padding: 24px 32px; overflow-y: auto; box-sizing: border-box; }
    .topbar { position: sticky; top: 0; z-index: 100; }
    @media (max-width: 1200px) { .content { padding: 16px; } }
`;
const styleIdx = html.indexOf('</style>');
if (styleIdx > 0 && !html.includes('PAGE LAYOUT FIX')) {
  html = html.slice(0, styleIdx) + layoutCSS + '\n  ' + html.slice(styleIdx);
  fixes++;
  console.log('✅ Page layout CSS');
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
