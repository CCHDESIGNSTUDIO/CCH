/**
 * Batch 2: Wire ship-to into UI + linked doc badges + My Items button
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'platform', 'index.html');
let html = fs.readFileSync(FILE, 'utf8');
const origLen = html.length;
let fixes = 0;

// ============================================================
// 1. PROPOSAL: Wire ship-to dropdown into the info grid
// Find the proposal info area (after header, before items table)
// Look for the "Ship To" or "shipTo" field display
// ============================================================
const propFunc = html.indexOf('function renderProposalDetail');
if (propFunc > 0) {
  const propArea = html.substring(propFunc, propFunc + 15000);

  // Find where ship-to is displayed (if at all)
  const shipIdx = propArea.indexOf('shipTo');
  const shipIdx2 = propArea.indexOf('ship_to');
  const shipIdx3 = propArea.indexOf('Ship To');

  if (shipIdx > 0 || shipIdx2 > 0 || shipIdx3 > 0) {
    console.log('Ship-to reference found in proposal at offset:', Math.max(shipIdx, shipIdx2, shipIdx3));
  } else {
    console.log('No ship-to in proposal — need to add it');
    // Find the info grid area or the header section
    // Look for "Bill To" or client info area
    const billToIdx = propArea.indexOf('Bill To');
    const clientIdx = propArea.indexOf('clientName');

    if (clientIdx > 0) {
      // Find the closing div after client info section
      const sectionEnd = propArea.indexOf('</div>', clientIdx + 200);
      if (sectionEnd > 0) {
        const absPos = propFunc + sectionEnd + 6;
        const shipToSection = '\n              <div style="margin-top:12px;"><label style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;display:block;margin-bottom:4px;">Ship To</label>' +
          "' + showShipToDropdown(projectId, (prop.id || docId), 'proposals', prop.shipTo || '') + '" +
          '</div>';
        // This is tricky because we're inside a template literal
        // Instead, add it as a standalone section
        console.log('⚠️ Ship-to needs manual wiring into template — skipping for now');
      }
    }
  }
}

// ============================================================
// 2. Add "My Items" button to proposal actions bar
// Find the proposal action buttons area
// ============================================================
const propArea2 = html.substring(propFunc, propFunc + 15000);
const addItemBtn = propArea2.indexOf('Add Item');
const myItemsExists = propArea2.indexOf('My Items');

if (addItemBtn > 0 && myItemsExists < 0) {
  // Find the Add Item button and add My Items next to it
  const absAddItem = propFunc + addItemBtn;
  const btnEnd = html.indexOf('</button>', absAddItem) + 9;
  if (btnEnd > 9) {
    const myItemsBtn = '\n            <button class="btn btn-secondary btn-sm" onclick="showMyItemsPanel(projectId, \'proposals\', (prop.id || docId))">🛍️ My Items</button>';
    html = html.slice(0, btnEnd) + myItemsBtn + html.slice(btnEnd);
    fixes++;
    console.log('✅ My Items button added to proposals');
  }
} else if (myItemsExists > 0) {
  console.log('⚠️ My Items already exists in proposals');
}

// ============================================================
// 3. Add "My Items" button to invoice actions bar
// ============================================================
const invFunc = html.indexOf('function renderInvoiceDetail');
if (invFunc > 0) {
  const invArea = html.substring(invFunc, invFunc + 15000);
  const invAddItem = invArea.indexOf('Add Item');
  const invMyItems = invArea.indexOf('My Items');

  if (invAddItem > 0 && invMyItems < 0) {
    const absInvAdd = invFunc + invAddItem;
    const invBtnEnd = html.indexOf('</button>', absInvAdd) + 9;
    if (invBtnEnd > 9) {
      const invMyItemsBtn = '\n            <button class="btn btn-secondary btn-sm" onclick="showMyItemsPanel(projectId, \'invoices\', (inv.id || docId))">🛍️ My Items</button>';
      html = html.slice(0, invBtnEnd) + invMyItemsBtn + html.slice(invBtnEnd);
      fixes++;
      console.log('✅ My Items button added to invoices');
    }
  }
}

// ============================================================
// 4. Build the showMyItemsPanel function (Houzz-style right panel)
// ============================================================
if (!html.includes('function showMyItemsPanel')) {
  const panelFunc = `
    async function showMyItemsPanel(projectId, collection, docId) {
      // Remove existing panel
      var existing = document.getElementById('myItemsSidePanel');
      if (existing) { existing.remove(); return; }

      var panel = document.createElement('div');
      panel.id = 'myItemsSidePanel';
      panel.style.cssText = 'position:fixed;top:0;right:0;width:380px;height:100vh;background:var(--card,white);border-left:2px solid var(--gold,#C8B99A);box-shadow:-4px 0 24px rgba(0,0,0,0.15);z-index:9999;display:flex;flex-direction:column;overflow:hidden;';

      panel.innerHTML = '<div style="padding:16px;border-bottom:1px solid var(--border,#eee);display:flex;justify-content:space-between;align-items:center;">' +
        '<div style="font-size:16px;font-weight:700;color:var(--text);">My Items</div>' +
        '<button onclick="document.getElementById(\\'myItemsSidePanel\\').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--gray-400);">×</button>' +
      '</div>' +
      '<div style="padding:12px;border-bottom:1px solid var(--border,#eee);">' +
        '<input id="myItemsSearchInput" placeholder="Search products..." style="width:100%;padding:10px;border:1px solid var(--border,#eee);font-size:13px;" oninput="filterMyItemsPanel(this.value)">' +
      '</div>' +
      '<div id="myItemsPanelGrid" style="flex:1;overflow-y:auto;padding:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;"></div>';

      document.body.appendChild(panel);

      // Load products
      showToast('Loading products...');
      var items = [];
      try {
        var masterSnap = await db.collection('productLibrary').limit(500).get();
        masterSnap.forEach(function(d) { items.push({id: d.id, source: 'library', ...d.data()}); });
      } catch(e) {}
      try {
        var clipSnap = await db.collection('boards').doc(projectId).collection('clips').get();
        clipSnap.forEach(function(d) { var c = d.data(); if (c.title) items.push({id: d.id, source: 'clip', ...c}); });
      } catch(e) {}

      window._myItemsPanelData = items;
      window._myItemsPanelTarget = { projectId: projectId, collection: collection, docId: docId };
      renderMyItemsPanelGrid(items);
    }

    function renderMyItemsPanelGrid(items) {
      var grid = document.getElementById('myItemsPanelGrid');
      if (!grid) return;
      grid.innerHTML = items.slice(0, 100).map(function(item) {
        var img = item.imageUrl || item.image || '';
        var isValid = img && (img.startsWith('http') || img.startsWith('data:'));
        var price = parseFloat(item.sellPrice || item.clientPrice || item.totalSelling || 0);
        return '<div onclick="addMyItemToDoc(\\'' + escAttr(item.id) + '\\')" style="background:var(--bg,#f5f5f5);border:1px solid var(--border,#eee);cursor:pointer;overflow:hidden;transition:all 0.15s;" onmouseenter="this.style.borderColor=\\'var(--gold)\\'" onmouseleave="this.style.borderColor=\\'var(--border,#eee)\\'">' +
          (isValid ? '<img src="' + escAttr(img) + '" style="width:100%;aspect-ratio:1;object-fit:cover;" referrerpolicy="no-referrer" onerror="this.style.display=\\'none\\'">' : '<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;color:var(--gray-300);font-size:24px;">📦</div>') +
          '<div style="padding:8px;">' +
            '<div style="font-weight:600;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(item.title || 'Untitled') + '</div>' +
            '<div style="font-size:10px;color:var(--gray-400);">' + esc(item.vendor || '') + '</div>' +
            (price > 0 ? '<div style="font-size:12px;font-weight:600;color:var(--gold);font-family:monospace;margin-top:2px;">' + formatMoney(price) + '</div>' : '') +
          '</div></div>';
      }).join('') || '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-400);">No products found</div>';
    }

    function filterMyItemsPanel(query) {
      var q = (query || '').toLowerCase();
      var items = window._myItemsPanelData || [];
      var filtered = q ? items.filter(function(i) {
        return (i.title || '').toLowerCase().includes(q) || (i.vendor || '').toLowerCase().includes(q);
      }) : items;
      renderMyItemsPanelGrid(filtered);
    }

    async function addMyItemToDoc(itemId) {
      var target = window._myItemsPanelTarget;
      if (!target) return;
      var item = (window._myItemsPanelData || []).find(function(i) { return i.id === itemId; });
      if (!item) return;

      try {
        var docRef = db.collection('boards').doc(target.projectId).collection(target.collection).doc(target.docId);
        var doc = await docRef.get();
        if (!doc.exists) return;
        var data = doc.data();
        var items = data.items || [];
        items.push({
          title: item.title || '', description: item.description || '',
          vendor: item.vendor || '', room: item.room || '', category: item.category || '',
          qty: 1, cost: parseFloat(item.unitCost || item.cost || 0),
          amount: parseFloat(item.sellPrice || item.clientPrice || item.totalSelling || 0),
          imageUrl: item.imageUrl || item.image || '', sku: item.sku || ''
        });
        await docRef.update({ items: items });
        showToast('✅ Added: ' + (item.title || 'Item'));
        // Refresh the page
        navigate(window.location.hash);
      } catch(e) { showToast('Error: ' + e.message, 'error'); }
    }
`;
  const insertPoint = html.indexOf('function closeModal()');
  if (insertPoint > 0) {
    html = html.slice(0, insertPoint) + panelFunc + '\n    ' + html.slice(insertPoint);
    fixes++;
    console.log('✅ My Items side panel + add-to-doc functions');
  }
}

// ============================================================
// VALIDATE
// ============================================================
const newLen = html.length;
const end = html.slice(-30).trim();
console.log('\n=== RESULTS ===');
console.log('Fixes:', fixes, '| Orig:', origLen, '| New:', newLen, '| Diff:', newLen - origLen, '| OK:', end.endsWith('</html>'));
if (newLen < origLen - 100 || !end.endsWith('</html>')) { console.log('❌ ABORT'); process.exit(1); }
fs.writeFileSync(FILE, html);
console.log('✅ SAVED');
