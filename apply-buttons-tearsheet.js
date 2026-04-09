/**
 * Fix black buttons + ensure tear sheet button is visible
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'platform', 'index.html');
let html = fs.readFileSync(FILE, 'utf8');
const origLen = html.length;
let fixes = 0;

// 1. FIX BLACK BUTTONS - add CSS override for all buttons
const btnCSS = `
    /* BUTTON CONTRAST FIX */
    .btn { font-size: 13px; font-weight: 600; padding: 8px 16px; border-radius: 0; cursor: pointer; transition: all 0.15s; }
    .btn-primary { background: #C8B99A !important; color: #0E1629 !important; border: 1px solid #C8B99A !important; }
    .btn-primary:hover { background: #b5a688 !important; }
    .btn-secondary { background: transparent !important; color: var(--text, #0E1629) !important; border: 1px solid var(--border, #C8B99A) !important; }
    .btn-secondary:hover { background: rgba(200,185,154,0.1) !important; }
    .btn-sm { padding: 5px 12px; font-size: 12px; }
    /* Topbar buttons */
    .topbar .btn, .topbar button { color: var(--text, #0E1629) !important; }
`;
const styleIdx = html.indexOf('</style>');
if (styleIdx > 0 && !html.includes('BUTTON CONTRAST FIX')) {
  html = html.slice(0, styleIdx) + btnCSS + '\n  ' + html.slice(styleIdx);
  fixes++;
  console.log('✅ Button contrast CSS');
}

// 2. Check if generateTearSheets exists and is callable
const tearIdx = html.indexOf('function generateTearSheets');
if (tearIdx > 0) {
  console.log('✅ Tear sheets function exists at char:', tearIdx);
  // Make sure the button on Room Boards page calls it correctly
  const btnIdx = html.indexOf("generateTearSheets('");
  if (btnIdx > 0) {
    console.log('✅ Tear sheet button exists at char:', btnIdx);
    // Check if it's visible
    const btnContext = html.substring(btnIdx - 200, btnIdx + 100);
    if (btnContext.includes('display:none') || btnContext.includes('visibility:hidden')) {
      console.log('⚠️ Tear sheet button might be hidden');
    }
  } else {
    console.log('⚠️ No tear sheet button found on Room Boards');
  }
} else {
  console.log('⚠️ generateTearSheets function NOT FOUND');
}

// 3. Also add tear sheet button to proposals and invoices
// Find proposal detail actions area
const propActions = html.indexOf("Generate PO", html.indexOf('renderProposalDetail'));
if (propActions > 0) {
  // Add tear sheet button near the PO generation button
  const lineEnd = html.indexOf('</button>', propActions) + 9;
  if (lineEnd > 9 && !html.substring(propActions - 500, propActions).includes('Tear Sheet')) {
    const tearBtn = '\n            <button class="btn btn-secondary btn-sm" onclick="generateTearSheetsFromDoc(\'${escAttr(proj.id)}\',\'proposals\',\'${escAttr(docId)}\',\'${escAttr(proj.name)}\')">📄 Tear Sheets</button>';
    html = html.slice(0, lineEnd) + tearBtn + html.slice(lineEnd);
    fixes++;
    console.log('✅ Tear sheet button added to proposals');
  }
}

// 4. Add generateTearSheetsFromDoc function (generates from proposal/invoice items)
if (!html.includes('function generateTearSheetsFromDoc')) {
  const func = `
    async function generateTearSheetsFromDoc(projectId, collection, docId, projectName) {
      var pricing = confirm('Include pricing on tear sheets?\\n\\nOK = Show prices\\nCancel = No prices (client version)');
      showToast('Generating tear sheets...');
      try {
        var doc = await db.collection('boards').doc(projectId).collection(collection).doc(docId).get();
        if (!doc.exists) { showToast('Document not found', 'error'); return; }
        var items = doc.data().items || [];
        if (items.length === 0) { showToast('No items in this document', 'error'); return; }

        var pages = items.filter(function(item) { return item.title || item.description; }).map(function(item) {
          var img = item.imageUrl || item.image || '';
          var cost = parseFloat(item.cost) || 0;
          var sell = parseFloat(item.amount) || parseFloat(item.clientPrice) || parseFloat(item.total) || 0;
          var qty = parseInt(item.qty) || 1;

          return '<div style="page-break-after:always;padding:40px;font-family:DM Sans,sans-serif;max-width:800px;margin:0 auto;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;border-bottom:2px solid #C8B99A;padding-bottom:12px;">' +
              '<div style="font-size:28px;font-weight:300;letter-spacing:4px;color:#0E1629;">CCH</div>' +
              '<div style="font-size:12px;color:#888;">' + esc(projectName || '') + '</div>' +
            '</div>' +
            (img ? '<div style="text-align:center;margin-bottom:24px;"><img src="' + escAttr(img) + '" style="max-width:100%;max-height:400px;object-fit:contain;" referrerpolicy="no-referrer"></div>' : '') +
            '<div style="font-size:22px;font-weight:600;color:#0E1629;margin-bottom:8px;">' + esc(item.title || item.description || '') + '</div>' +
            '<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px;">' +
              (item.vendor ? '<tr><td style="padding:8px 0;color:#888;width:140px;">Vendor</td><td style="padding:8px 0;">' + esc(item.vendor) + '</td></tr>' : '') +
              (item.room ? '<tr><td style="padding:8px 0;color:#888;">Room</td><td style="padding:8px 0;">' + esc(item.room) + '</td></tr>' : '') +
              (item.category ? '<tr><td style="padding:8px 0;color:#888;">Category</td><td style="padding:8px 0;">' + esc(item.category) + '</td></tr>' : '') +
              (item.sku ? '<tr><td style="padding:8px 0;color:#888;">SKU</td><td style="padding:8px 0;font-family:monospace;">' + esc(item.sku) + '</td></tr>' : '') +
              (item.dimensions ? '<tr><td style="padding:8px 0;color:#888;">Dimensions</td><td style="padding:8px 0;">' + esc(item.dimensions) + '</td></tr>' : '') +
              '<tr><td style="padding:8px 0;color:#888;">Quantity</td><td style="padding:8px 0;">' + qty + '</td></tr>' +
              (pricing && sell > 0 ? '<tr><td style="padding:8px 0;color:#888;">Price</td><td style="padding:8px 0;font-weight:600;font-family:monospace;color:#C8B99A;">' + formatMoney(sell) + '</td></tr>' : '') +
              (pricing && sell > 0 && qty > 1 ? '<tr style="border-top:1px solid #eee;"><td style="padding:8px 0;color:#888;">Total</td><td style="padding:8px 0;font-weight:700;font-family:monospace;color:#C8B99A;">' + formatMoney(sell * qty) + '</td></tr>' : '') +
            '</table>' +
          '</div>';
        }).join('');

        var w = window.open('', '_blank');
        w.document.write('<!DOCTYPE html><html><head><title>Tear Sheets</title><style>@media print{body{margin:0}}</style></head><body>' + pages + '</body></html>');
        w.document.close();
        showToast(items.length + ' tear sheets — Ctrl+P to print/save as PDF');
      } catch(e) { showToast('Error: ' + e.message, 'error'); }
    }
`;
  const insertPoint = html.indexOf('function closeModal()');
  if (insertPoint > 0) {
    html = html.slice(0, insertPoint) + func + '\n    ' + html.slice(insertPoint);
    fixes++;
    console.log('✅ generateTearSheetsFromDoc function added');
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
