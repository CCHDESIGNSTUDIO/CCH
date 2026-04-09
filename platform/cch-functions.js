// CCH Platform Extended Functions - NO TEMPLATE LITERALS

async function updateDocStatus(projectId, collection, docId, newStatus) {
  try {
    await db.collection('boards').doc(projectId).collection(collection).doc(docId)
      .update({ status: newStatus, updatedAt: new Date().toISOString() });
  } catch(e) { alert('Error: ' + e.message); }
}

async function deleteFinanceDoc(projectId, collection, docId) {
  var labels = { proposals:'proposal', invoices:'invoice', purchaseOrders:'PO' };
  if (!confirm('Delete this ' + (labels[collection]||'document') + '?')) return;
  try {
    await db.collection('boards').doc(projectId).collection(collection).doc(docId).delete();
    navigate(window.location.hash);
  } catch(e) { alert('Error: ' + e.message); }
}

async function showNewInvoiceModal(projectId) {
  document.getElementById('modalContainer').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">' +
    '<div class="modal" style="width:560px;">' +
    '<div class="modal-header"><div class="modal-title">New Invoice</div><button class="modal-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="modal-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
    '<div class="form-group"><label class="form-label">Invoice #</label><input class="form-input" id="niNumber"></div>' +
    '<div class="form-group"><label class="form-label">Total ($)</label><input class="form-input" type="number" id="niTotal"></div>' +
    '<div class="form-group"><label class="form-label">Status</label><select class="form-input" id="niStatus">' +
    '<option value="Draft">Draft</option><option value="Sent" selected>Sent</option><option value="Paid">Paid</option><option value="Overdue">Overdue</option>' +
    '</select></div>' +
    '<div class="form-group"><label class="form-label">Due Date</label><input class="form-input" type="date" id="niDue"></div>' +
    '<div class="form-group" style="grid-column:span 2;"><label class="form-label">Notes</label><textarea class="form-textarea" id="niNotes" rows="2"></textarea></div>' +
    '</div></div>' +
    '<div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-primary" onclick="saveNewInvoice(\'' + projectId + '\')">Create Invoice</button></div>' +
    '</div></div>';
}

async function saveNewInvoice(projectId) {
  try {
    await db.collection('boards').doc(projectId).collection('invoices').add({
      number: document.getElementById('niNumber').value.trim() || ('INV-' + Date.now().toString().slice(-6)),
      total: parseFloat(document.getElementById('niTotal').value)||0,
      status: document.getElementById('niStatus').value,
      dueDate: document.getElementById('niDue').value,
      notes: document.getElementById('niNotes').value.trim(),
      items: [], createdAt: new Date().toISOString(), owner: currentUser.email
    });
    closeModal(); navigate(window.location.hash);
  } catch(e) { alert('Error: ' + e.message); }
}

async function showEditInvoiceModal(projectId, invId) {
  var snap = await db.collection('boards').doc(projectId).collection('invoices').doc(invId).get();
  if (!snap.exists) return;
  var inv = snap.data();
  var opts = ['Draft','Sent','Paid','Overdue','Partial'].map(function(s){
    return '<option ' + (inv.status===s?'selected':'') + ' value="' + s + '">' + s + '</option>';
  }).join('');
  document.getElementById('modalContainer').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">' +
    '<div class="modal" style="width:560px;">' +
    '<div class="modal-header"><div class="modal-title">Edit Invoice</div><button class="modal-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="modal-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
    '<div class="form-group"><label class="form-label">Invoice #</label><input class="form-input" id="eiNumber" value="' + escAttr(inv.number||'') + '"></div>' +
    '<div class="form-group"><label class="form-label">Total ($)</label><input class="form-input" type="number" id="eiTotal" value="' + (inv.total||0) + '"></div>' +
    '<div class="form-group"><label class="form-label">Status</label><select class="form-input" id="eiStatus">' + opts + '</select></div>' +
    '<div class="form-group"><label class="form-label">Due Date</label><input class="form-input" type="date" id="eiDue" value="' + escAttr(inv.dueDate||'') + '"></div>' +
    '<div class="form-group"><label class="form-label">QB ID</label><input class="form-input" id="eiQBId" value="' + escAttr(inv.qbDocId||'') + '" placeholder="QuickBooks Doc ID"></div>' +
    '<div class="form-group" style="grid-column:span 2;"><label class="form-label">Notes</label><textarea class="form-textarea" id="eiNotes" rows="2">' + esc(inv.notes||'') + '</textarea></div>' +
    '</div></div>' +
    '<div class="modal-footer" style="justify-content:space-between;">' +
    '<button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:var(--red);" onclick="deleteFinanceDoc(\'' + projectId + '\',\'invoices\',\'' + invId + '\');closeModal();">Delete</button>' +
    '<div style="display:flex;gap:8px;"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-primary" onclick="saveEditInvoice(\'' + projectId + '\',\'' + invId + '\')">Save</button></div>' +
    '</div></div></div>';
}

async function saveEditInvoice(projectId, invId) {
  try {
    await db.collection('boards').doc(projectId).collection('invoices').doc(invId).update({
      number: document.getElementById('eiNumber').value.trim(),
      total: parseFloat(document.getElementById('eiTotal').value)||0,
      status: document.getElementById('eiStatus').value,
      dueDate: document.getElementById('eiDue').value,
      qbDocId: document.getElementById('eiQBId').value.trim() || null,
      notes: document.getElementById('eiNotes').value.trim(),
      updatedAt: new Date().toISOString()
    });
    closeModal(); navigate(window.location.hash);
  } catch(e) { alert('Error: ' + e.message); }
}

async function showEditPOModal(projectId, poId) {
  var snap = await db.collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
  if (!snap.exists) { alert('PO not found'); return; }
  var po = snap.data();
  var opts = ['Draft','Sent','Ordered','Received','On Hold','Cancelled'].map(function(s){
    return '<option ' + (po.status===s?'selected':'') + ' value="' + s + '">' + s + '</option>';
  }).join('');
  document.getElementById('modalContainer').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">' +
    '<div class="modal" style="width:620px;">' +
    '<div class="modal-header"><div class="modal-title">Edit PO</div><button class="modal-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="modal-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
    '<div class="form-group"><label class="form-label">PO Number</label><input class="form-input" id="epNumber" value="' + escAttr(po.number||'') + '"></div>' +
    '<div class="form-group"><label class="form-label">Vendor</label><input class="form-input" id="epVendor" value="' + escAttr(po.vendor||'') + '"></div>' +
    '<div class="form-group"><label class="form-label">Total ($)</label><input class="form-input" type="number" id="epTotal" value="' + (po.total||0) + '"></div>' +
    '<div class="form-group"><label class="form-label">Status</label><select class="form-input" id="epStatus">' + opts + '</select></div>' +
    '<div class="form-group"><label class="form-label">ETA</label><input class="form-input" id="epEta" value="' + escAttr(po.eta||'') + '"></div>' +
    '<div class="form-group"><label class="form-label">Ship To</label><input class="form-input" id="epShipTo" value="' + escAttr(po.shipTo||'') + '"></div>' +
    '<div class="form-group"><label class="form-label">QB ID</label><input class="form-input" id="epQBId" value="' + escAttr(po.qbDocId||'') + '" placeholder="QuickBooks Doc ID"></div>' +
    '<div class="form-group"><label class="form-label">Shipping ($)</label><input class="form-input" type="number" step="0.01" id="epShipping" value="' + (po.shipping||0) + '"></div>' +
    '<div class="form-group"><label class="form-label">Taxable</label><select class="form-input" id="epTaxable"><option value="false"' + (!po.taxable?' selected':'') + '>No</option><option value="true"' + (po.taxable?' selected':'') + '>Yes</option></select></div>' +
    '<div class="form-group" style="grid-column:span 2;"><label class="form-label">Description</label><textarea class="form-textarea" id="epDesc" rows="3">' + esc(po.description||'') + '</textarea></div>' +
    '<div class="form-group" style="grid-column:span 2;"><label class="form-label">Notes</label><input class="form-input" id="epNotes" value="' + escAttr(po.notes||'') + '"></div>' +
    '</div></div>' +
    '<div class="modal-footer" style="justify-content:space-between;">' +
    '<button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:var(--red);" onclick="deleteFinanceDoc(\'' + projectId + '\',\'purchaseOrders\',\'' + poId + '\');closeModal();">Delete</button>' +
    '<div style="display:flex;gap:8px;"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-primary" onclick="saveEditPO(\'' + projectId + '\',\'' + poId + '\')">Save</button></div>' +
    '</div></div></div>';
}

async function saveEditPO(projectId, poId) {
  try {
    await db.collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).update({
      number: document.getElementById('epNumber').value.trim(),
      vendor: document.getElementById('epVendor').value.trim(),
      total: parseFloat(document.getElementById('epTotal').value)||0,
      status: document.getElementById('epStatus').value,
      eta: document.getElementById('epEta').value.trim(),
      shipTo: document.getElementById('epShipTo').value.trim(),
      qbDocId: document.getElementById('epQBId').value.trim() || null,
      shipping: parseFloat(document.getElementById('epShipping').value)||0,
      taxable: document.getElementById('epTaxable').value === 'true',
      description: document.getElementById('epDesc').value.trim(),
      notes: document.getElementById('epNotes').value.trim(),
      updatedAt: new Date().toISOString()
    });
    closeModal(); navigate(window.location.hash);
  } catch(e) { alert('Error: ' + e.message); }
}

async function printProposal(projectId, proposalId) {
  var snap = await db.collection('boards').doc(projectId).collection('proposals').doc(proposalId).get();
  var proj = await db.collection('boards').doc(projectId).get();
  if (!snap.exists) return;
  var p = snap.data();
  var projName = proj.exists ? (proj.data().name || projectId) : projectId;
  var items = p.items || [];
  var total = parseFloat(p.total)||0;
  var dateStr = p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : new Date().toLocaleDateString();
  var hideList = (typeof getClientHiddenColumnList === 'function') ? getClientHiddenColumnList(p) : ['cost','markupPct','vendor'];
  function H(k) { return hideList.indexOf(k) >= 0; }
  function _pf(n) {
    var x = parseFloat(n)||0;
    return x.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  var thead = '<th style="width:80px;">Image</th><th>Description</th>';
  if (!H('vendor')) thead += '<th>Vendor</th>';
  if (!H('room')) thead += '<th>Room</th>';
  thead += '<th style="text-align:center;">Qty</th>';
  if (!H('unitPrice')) thead += '<th style="text-align:right;">Unit Price</th>';
  if (!H('retailPrice')) thead += '<th style="text-align:right;">Retail</th>';
  if (!H('cost')) thead += '<th style="text-align:right;">Cost</th>';
  if (!H('markupPct')) thead += '<th style="text-align:right;">Mkup %</th>';
  if (!H('shipping')) thead += '<th style="text-align:right;">Ship</th>';
  thead += '<th style="text-align:right;">Line Total</th>';
  var colCount = 2;
  if (!H('vendor')) colCount++;
  if (!H('room')) colCount++;
  colCount++;
  if (!H('unitPrice')) colCount++;
  if (!H('retailPrice')) colCount++;
  if (!H('cost')) colCount++;
  if (!H('markupPct')) colCount++;
  if (!H('shipping')) colCount++;
  colCount++;
  var rowParts = [];
  for (var ri = 0; ri < items.length; ri++) {
    var item = items[ri];
    if (item && item.lineKind === 'group') {
      rowParts.push('<tr><td colspan="' + colCount + '" style="background:#F5F3EE;font-weight:600;padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#7A7060;border-bottom:1px solid rgba(27,51,82,0.12);">' + esc(item.title || 'Section') + '</td></tr>');
      continue;
    }
    var img = item.imageUrl
      ? '<img style="width:72px;height:72px;object-fit:cover;border-radius:4px;" src="' + item.imageUrl + '">'
      : '<div style="width:72px;height:72px;background:#f5f5f5;border-radius:4px;text-align:center;line-height:72px;">Item</div>';
    var qty = parseFloat(item.qty)||1;
    var amt = parseFloat(item.amount)||0;
    var up = qty > 0 ? amt/qty : 0;
    var ship = parseFloat(item.shipping)||0;
    var cst = parseFloat(item.cost)||0;
    var mk = parseFloat(item.markupPct)||0;
    var rtl = parseFloat(item.retailPrice)||0;
    var row = '<tr>' +
      '<td style="padding:10px;">' + img + '</td>' +
      '<td style="padding:10px;"><strong>' + esc(item.title||item.description||'') + '</strong>' +
      (item.description && item.title ? '<div style="font-size:11px;color:#888;margin-top:4px;">' + esc(item.description) + '</div>' : '') + '</td>';
    if (!H('vendor')) row += '<td style="padding:10px;color:#666;">' + esc(item.vendor||'') + '</td>';
    if (!H('room')) row += '<td style="padding:10px;color:#666;">' + esc(item.room||item.category||'') + '</td>';
    row += '<td style="padding:10px;text-align:center;">' + qty + '</td>';
    if (!H('unitPrice')) row += '<td style="padding:10px;text-align:right;">$' + _pf(up) + '</td>';
    if (!H('retailPrice')) row += '<td style="padding:10px;text-align:right;color:#666;">' + (rtl > 0 ? '$' + _pf(rtl) : '—') + '</td>';
    if (!H('cost')) row += '<td style="padding:10px;text-align:right;color:#666;">' + (cst > 0 ? '$' + _pf(cst) : '—') + '</td>';
    if (!H('markupPct')) row += '<td style="padding:10px;text-align:right;color:#666;">' + (mk > 0 ? (String(mk) + '%') : '—') + '</td>';
    if (!H('shipping')) row += '<td style="padding:10px;text-align:right;color:#666;">' + (ship > 0 ? '$' + _pf(ship) : '—') + '</td>';
    row += '<td style="padding:10px;text-align:right;font-weight:600;">$' + _pf(amt) + '</td></tr>';
    rowParts.push(row);
  }
  var rows = rowParts.join('');
  var totalFmt = total.toLocaleString('en-US',{minimumFractionDigits:2});
  var win = window.open('','_blank');
  win.document.write('<!DOCTYPE html><html><head><title>' + projName + '</title>');
  win.document.write('<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet">');
  win.document.write('<style>body{font-family:"DM Sans",Helvetica,Arial,sans-serif;margin:0;padding:40px;font-size:13px;color:#1B3352;background:#FAFAF7}');
  win.document.write('.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px}');
  win.document.write('.logo{font-family:"DM Serif Display",Georgia,serif;font-size:36px;font-weight:600;letter-spacing:4px;color:#1B3352}.sub{font-size:10px;letter-spacing:4px;color:#5EC6C6;text-transform:uppercase;margin-top:2px}');
  win.document.write('.addr{font-size:10px;color:#7A7060;margin-top:6px;line-height:1.5}.meta{text-align:right}');
  win.document.write('.rule{height:3px;background:#5EC6C6;margin-bottom:28px}');
  win.document.write('table{width:100%;border-collapse:collapse}th{background:#F5F3EE;padding:9px 10px;text-align:left;font-size:9px;text-transform:uppercase;color:#7A7060;font-weight:600;border-bottom:2px solid rgba(27,51,82,0.12)}');
  win.document.write('td{border-bottom:1px solid rgba(27,51,82,0.08);vertical-align:middle;color:#1B3352}');
  win.document.write('.tot{margin-top:24px;display:flex;justify-content:flex-end}.tot-box{width:280px;border:1px solid rgba(27,51,82,0.12);border-radius:8px;overflow:hidden;background:#fff}');
  win.document.write('.tr{display:flex;justify-content:space-between;padding:8px 14px;font-size:12px}.grand{background:#1B3352;color:#EDE8E0;font-weight:700;font-size:14px}');
  win.document.write('.ftr{margin-top:40px;padding-top:16px;border-top:1px solid rgba(27,51,82,0.1);font-size:10px;color:#7A7060;text-align:center}');
  win.document.write('@media print{body{padding:20px;background:#fff}}</style></head><body>');
  win.document.write('<div class="hdr">');
  win.document.write('<div><div class="logo">CCH</div><div class="sub">Design Inc.</div><div class="addr">2481 N. Riverside Dr. · Santa Ana, CA · www.cchdesign.com</div></div>');
  win.document.write('<div class="meta"><h2 style="font-size:18px;font-weight:600;letter-spacing:2px;text-transform:uppercase;margin:0;color:#1B3352;">' + esc(p.name||'Proposal') + '</h2><div style="margin-top:6px;color:#7A7060;">Project: <strong style="color:#1B3352">' + esc(projName) + '</strong></div><div style="color:#7A7060;">' + dateStr + '</div></div>');
  win.document.write('</div><div class="rule"></div>');
  win.document.write('<table><thead><tr>' + thead + '</tr></thead><tbody>' + rows + '</tbody></table>');
  win.document.write('<div class="tot"><div class="tot-box"><div class="tr"><span>Subtotal</span><span>$' + totalFmt + '</span></div><div class="tr grand"><span>TOTAL</span><span>$' + totalFmt + '</span></div></div></div>');
  win.document.write('<div class="ftr">CCH Design Inc. - Valid 30 days - Thank you for your business</div>');
  win.document.write('</body></html>');
  win.document.close();
  setTimeout(function(){ win.print(); }, 600);
}

async function showConnectedDocs(projectId, docType, docId, docNumber, anchorEl) {
  var existing = document.getElementById('connectedDocsDropdown');
  if (existing) { existing.remove(); if (existing.dataset.for === docId) return; }
  var dropdown = document.createElement('div');
  dropdown.id = 'connectedDocsDropdown';
  dropdown.dataset.for = docId;
  dropdown.style.cssText = 'position:fixed;background:white;border:1px solid var(--gray-200);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:9999;min-width:220px;padding:8px 0;';
  dropdown.innerHTML = '<div style="padding:6px 14px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--gray-400);">Connected Docs</div><div id="connDocsInner"><div style="padding:6px 14px;font-size:12px;color:var(--gray-400);">Loading...</div></div>';
  document.body.appendChild(dropdown);
  var rect = anchorEl.getBoundingClientRect();
  dropdown.style.top = (rect.bottom + 4) + 'px';
  dropdown.style.left = rect.left + 'px';
  setTimeout(function() {
    document.addEventListener('click', function h(e) {
      if (!dropdown.contains(e.target)) { dropdown.remove(); document.removeEventListener('click', h); }
    });
  }, 50);
  try {
    var results = await Promise.all([
      db.collection('boards').doc(projectId).collection('proposals').get().catch(function(){ return {docs:[]}; }),
      db.collection('boards').doc(projectId).collection('invoices').get().catch(function(){ return {docs:[]}; }),
      db.collection('boards').doc(projectId).collection('purchaseOrders').get().catch(function(){ return {docs:[]}; })
    ]);
    var allDocs = [];
    results[0].docs.forEach(function(d) { if (d.id !== docId || docType !== 'proposal') allDocs.push({ id:d.id, type:'proposal', label:'P: '+(d.data().name||d.data().number||'Proposal'), status:d.data().status||'Draft' }); });
    results[1].docs.forEach(function(d) { if (d.id !== docId || docType !== 'invoice') allDocs.push({ id:d.id, type:'invoice', label:'I: '+(d.data().number||'Invoice'), status:d.data().status||'Draft' }); });
    results[2].docs.forEach(function(d) { if (d.id !== docId || docType !== 'po') allDocs.push({ id:d.id, type:'po', label:'PO: '+(d.data().number||'PO'), status:d.data().status||'Draft' }); });
    var sc = {'Draft':'var(--gray-400)','Sent':'var(--gold)','Approved':'var(--green)','Paid':'var(--green)','Ordered':'#0097A7','Received':'var(--green)','Overdue':'var(--red)'};
    var inner = document.getElementById('connDocsInner');
    if (!inner) return;
    if (allDocs.length === 0) { inner.innerHTML = '<div style="padding:6px 14px;font-size:12px;color:var(--gray-400);">No other docs</div>'; return; }
    inner.innerHTML = allDocs.map(function(d) {
      return '<div onclick="closeDropdownAndNavigate(\'' + projectId + '\',\'' + d.type + '\',\'' + d.id + '\')" style="padding:6px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-size:13px;" onmouseover="this.style.background=\'var(--gray-50)\'" onmouseout="this.style.background=\'\'">' +
        esc(d.label) + '<span style="font-size:10px;padding:2px 6px;border-radius:8px;background:var(--gray-100);color:' + (sc[d.status]||'var(--gray-400)') + ';font-weight:600;">' + esc(d.status) + '</span></div>';
    }).join('');
  } catch(e) {
    var inner2 = document.getElementById('connDocsInner');
    if (inner2) inner2.innerHTML = '<div style="padding:6px 14px;font-size:12px;color:var(--red);">Error</div>';
  }
}

function closeDropdownAndNavigate(projectId, type, id) {
  var d = document.getElementById('connectedDocsDropdown'); if (d) d.remove();
  var tabMap = { proposal:'proposals', invoice:'invoices', po:'pos' };
  navigate('#/project/' + projectId + '/' + (tabMap[type]||'proposals'));
}

async function renderClients() {
  setBreadcrumb([{ label: 'Clients' }]);
  setTopbarActions('<button class="btn btn-primary" onclick="showNewClientModal()">+ New Client</button>');
  var T = document.getElementById('contentArea');
  T.innerHTML = '<div style="text-align:center;padding:60px;color:var(--gray-400);">Loading...</div>';
  try {
    var snap = await db.collection('clients').get();
    var clients = [];
    snap.forEach(function(d) { clients.push(Object.assign({ id: d.id }, d.data())); });
    clients.sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
    window._allClients = clients;
    renderClientsView('');
  } catch(e) { T.innerHTML = '<div class="empty-state"><div class="empty-icon">!</div><div class="empty-text">Error: ' + esc(e.message) + '</div></div>'; }
}

function renderClientsView(query) {
    var T = document.getElementById('contentArea');
    var clients = window._allClients || [];
    var filtered = clients;
    if (query) {
      var q = query.toLowerCase();
      filtered = clients.filter(function(c) {
        return (c.name||'').toLowerCase().indexOf(q) >= 0 ||
               (c.company||'').toLowerCase().indexOf(q) >= 0 ||
               (c.email||'').toLowerCase().indexOf(q) >= 0 ||
               (c.phone||'').toLowerCase().indexOf(q) >= 0 ||
               (c.address||'').toLowerCase().indexOf(q) >= 0;
      });
    }
    if (clients.length === 0) {
      T.innerHTML = '<h1 class="page-title">Clients</h1><div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">No clients yet.</div><button class="btn btn-primary" onclick="showNewClientModal()">+ New Client</button></div>';
      return;
    }
    var rows = filtered.map(function(c) {
      return '<tr style="border-bottom:1px solid var(--gray-100);cursor:pointer;" onclick="showNewClientModal(\'' + c.id + '\')">' +
        '<td style="padding:12px 16px;font-weight:600;">' + esc(c.name||'') + '<br><span style="font-size:11px;color:var(--gray-400);">' + esc(c.company||'') + '</span></td>' +
        '<td style="padding:12px 16px;">' + esc(c.email||'') + '</td>' +
        '<td style="padding:12px 16px;">' + esc(c.phone||'') + '</td>' +
        '<td style="padding:12px 16px;font-size:12px;">' + esc((c.address||'').substring(0,40)) + '</td>' +
        '<td style="padding:12px 8px;"><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();showNewClientModal(\'' + c.id + '\')">Edit</button></td></tr>';
    }).join('');
    T.innerHTML = '<h1 class="page-title">Clients</h1>' +
      '<div style="display:flex;gap:12px;margin-bottom:16px;"><input type="text" class="form-input" placeholder="Search clients..." value="' + esc(query||'') + '" oninput="renderClientsView(this.value)" style="max-width:400px;"></div>' +
      '<p style="color:var(--gray-400);margin-bottom:12px;font-size:13px;">Showing ' + filtered.length + ' of ' + clients.length + ' clients</p>' +
      '<div class="card" style="overflow:hidden;">' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
      '<thead><tr style="border-bottom:2px solid var(--gray-200);">' +
      '<th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Name</th>' +
      '<th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Email</th>' +
      '<th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Phone</th>' +
      '<th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Address</th>' +
      '<th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

async function showNewClientModal(existingId) {
  var c = {};
  if (existingId) { var cd = await db.collection('clients').doc(existingId).get(); if (cd.exists) c = cd.data(); }
  var title = existingId ? 'Edit Client' : 'New Client';
  var deleteBtn = existingId ? '<button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:var(--red);" onclick="deleteClient(\'' + existingId + '\')">Delete</button>' : '';
  var footerActions = '<div style="display:flex;gap:8px;"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-primary" onclick="saveClient(\'' + (existingId||'') + '\')">Save Client</button></div>';
  var modalFooter = existingId
    ? '<div class="modal-footer" style="justify-content:space-between;align-items:center;">' + deleteBtn + footerActions + '</div>'
    : '<div class="modal-footer" style="justify-content:flex-end;align-items:center;">' + footerActions + '</div>';
  document.getElementById('modalContainer').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">' +
    '<div class="modal" style="width:580px;">' +
    '<div class="modal-header"><div class="modal-title">' + title + '</div><button class="modal-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="modal-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
    '<div class="form-group"><label class="form-label">Full Name *</label><input class="form-input" id="clName" value="' + escAttr(c.name||'') + '"></div>' +
    '<div class="form-group"><label class="form-label">Company</label><input class="form-input" id="clCompany" value="' + escAttr(c.company||'') + '"></div>' +
    '<div class="form-group"><label class="form-label">Email</label><input class="form-input" id="clEmail" type="email" value="' + escAttr(c.email||'') + '"></div>' +
    '<div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="clPhone" value="' + escAttr(c.phone||'') + '"></div>' +
    '<div class="form-group" style="grid-column:span 2;"><label class="form-label">Primary Address</label><input class="form-input" id="clAddress" value="' + escAttr(c.address||'') + '"></div>' +
    '<div class="form-group" style="grid-column:span 2;"><label class="form-label">Secondary Address</label><input class="form-input" id="clAddress2" value="' + escAttr(c.address2||'') + '"></div>' +
    '<div class="form-group" style="grid-column:span 2;"><label class="form-label">Notes</label><textarea class="form-textarea" id="clNotes" rows="2">' + esc(c.notes||'') + '</textarea></div>' +
    '</div></div>' +
    modalFooter +
    '</div></div>';
}

async function saveClient(existingId) {
  var name = document.getElementById('clName').value.trim();
  if (!name) { alert('Name is required.'); return; }
  var data = {
    name: name,
    company: document.getElementById('clCompany').value.trim(),
    email: document.getElementById('clEmail').value.trim(),
    phone: document.getElementById('clPhone').value.trim(),
    address: document.getElementById('clAddress').value.trim(),
    address2: document.getElementById('clAddress2').value.trim(),
    notes: document.getElementById('clNotes').value.trim(),
    updatedAt: new Date().toISOString(),
    owner: currentUser.email
  };
  try {
    if (existingId) { await db.collection('clients').doc(existingId).update(data); }
    else { data.createdAt = new Date().toISOString(); await db.collection('clients').add(data); }
    closeModal(); renderClients();
  } catch(e) { alert('Error: ' + e.message); }
}

async function deleteClient(id) {
  if (!confirm('Delete this client?')) return;
  try { await db.collection('clients').doc(id).delete(); closeModal(); renderClients(); } catch(e) { alert('Error: ' + e.message); }
}

async function renderVendors() {
  setBreadcrumb([{ label: 'Vendors' }]);
  setTopbarActions('<button class="btn btn-primary" onclick="showNewVendorModal(null,\'Vendor\')">+ New Vendor</button>');
  var T = document.getElementById('contentArea');
  T.innerHTML = '<div style="text-align:center;padding:60px;color:var(--gray-400);">Loading...</div>';
  try {
    var snap = await db.collection('vendors').get();
    var vendors = [];
    snap.forEach(function(d) {
      var data = d.data();
      if (data.category === 'Workroom' || data.category === 'Delivery / Receiver') return;
      vendors.push(Object.assign({ id: d.id }, data));
    });
    vendors.sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
    window._allVendors = vendors;
    renderVendorsView('');
  } catch(e) { T.innerHTML = '<div class="empty-state"><div class="empty-text">Error: ' + esc(e.message) + '</div></div>'; }
}

function renderVendorsView(query) {
    var T = document.getElementById('contentArea');
    var vendors = window._allVendors || [];
    var filtered = vendors;
    if (query) {
      var q = query.toLowerCase();
      filtered = vendors.filter(function(v) {
        return (v.name||'').toLowerCase().indexOf(q) >= 0 ||
               (v.type||'').toLowerCase().indexOf(q) >= 0 ||
               (v.contact||'').toLowerCase().indexOf(q) >= 0 ||
               (v.email||'').toLowerCase().indexOf(q) >= 0 ||
               (v.address||'').toLowerCase().indexOf(q) >= 0 ||
               (v.description||'').toLowerCase().indexOf(q) >= 0 ||
               (v.tags||'').toLowerCase().indexOf(q) >= 0;
      });
    }
    if (vendors.length === 0) {
      T.innerHTML = '<h1 class="page-title">Vendors</h1><div class="empty-state"><div class="empty-icon">🏭</div><div class="empty-text">No vendors yet.</div><button class="btn btn-primary" onclick="showNewVendorModal(null,\'Vendor\')">+ New Vendor</button></div>';
      return;
    }
    var rows = filtered.map(function(v) {
      return '<tr style="border-bottom:1px solid var(--gray-100);cursor:pointer;" onclick="showVendorDetail(\'' + v.id + '\')">' +
        '<td style="padding:10px 12px;font-weight:600;">' + esc(v.name||'') + '</td>' +
        '<td style="padding:10px 12px;font-size:12px;color:var(--gray-500);">' + esc(v.description||v.type||'') + '</td>' +
        '<td style="padding:10px 12px;">' + esc(v.contact||'') + '</td>' +
        '<td style="padding:10px 12px;">' + esc(v.email||'') + '</td>' +
        '<td style="padding:10px 12px;">' + esc(v.phone||'') + '</td>' +
        '<td style="padding:10px 12px;font-size:11px;color:var(--gray-400);max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(v.tags||'') + '</td>' +
        '<td style="padding:10px 8px;"><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();showNewVendorModal(\'' + v.id + '\',\'Vendor\')">Edit</button></td></tr>';
    }).join('');
    T.innerHTML = '<h1 class="page-title">Vendors</h1>' +
      '<div style="display:flex;gap:12px;margin-bottom:16px;"><input type="text" class="form-input" placeholder="Search vendors..." value="' + esc(query||'') + '" oninput="renderVendorsView(this.value)" style="max-width:400px;"></div>' +
      '<p style="color:var(--gray-400);margin-bottom:12px;font-size:13px;">Showing ' + filtered.length + ' of ' + vendors.length + ' vendors</p>' +
      '<div class="card" style="overflow:hidden;">' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
      '<thead><tr style="border-bottom:2px solid var(--gray-200);">' +
      '<th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Vendor</th>' +
      '<th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Description</th>' +
      '<th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Contact</th>' +
      '<th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Email</th>' +
      '<th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Phone</th>' +
      '<th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Tags</th>' +
      '<th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

async function showNewVendorModal(existingId, categoryHint) {
  var cat = categoryHint || 'Vendor';
  var v = {};
  if (existingId) { var vd = await db.collection('vendors').doc(existingId).get(); if (vd.exists) { v = vd.data(); cat = v.category || cat; } }
  var typeList = ['Showroom','Upholsterer','Window Fabricator','Freight / Receiver','Stone Supplier','Lighting','Furniture','Fabric','Wallcovering','Hardware','Tile / Stone','Custom Upholstery','Workroom','Delivery','Installer'];
  var typeOpts = typeList.map(function(x){ return '<option value="' + x + '">'; }).join('');
  var title = (existingId ? 'Edit ' : 'New ') + cat;
  var deleteBtn = existingId ? '<button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:var(--red);" onclick="deleteVendor(\'' + existingId + '\',\'' + cat + '\')">Delete</button>' : '<div></div>';
  var moveOpts = '';
  if (existingId) {
    var otherCats = ['Vendor','Workroom','Delivery / Receiver'].filter(function(c){ return c !== cat; });
    moveOpts = '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--gray-200);">' +
      '<label class="form-label" style="font-size:11px;color:var(--gray-400);">Move to different category:</label><div style="display:flex;gap:8px;margin-top:4px;">' +
      otherCats.map(function(c){ return '<button class="btn btn-secondary btn-sm" onclick="moveVendorCategory(\'' + existingId + '\',\'' + c + '\')">' + c + '</button>'; }).join('') +
      '</div></div>';
  }
  document.getElementById('modalContainer').innerHTML =
    '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">' +
    '<div class="modal" style="width:680px;max-height:90vh;overflow-y:auto;">' +
    '<div class="modal-header"><div class="modal-title">' + title + '</div><button class="modal-close" onclick="closeModal()">&times;</button></div>' +
    '<div class="modal-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
    '<div class="form-group"><label class="form-label">Name *</label><input class="form-input" id="vnName" value="' + escAttr(v.name||'') + '"></div>' +
    '<div class="form-group"><label class="form-label">Type</label><input class="form-input" id="vnType" value="' + escAttr(v.type||'') + '" list="vnTypeList"><datalist id="vnTypeList">' + typeOpts + '</datalist></div>' +
    '<div class="form-group"><label class="form-label">Contact</label><input class="form-input" id="vnContact" value="' + escAttr(v.contact||'') + '"></div>' +
    '<div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="vnPhone" value="' + escAttr(v.phone||'') + '"></div>' +
    '<div class="form-group"><label class="form-label">Email</label><input class="form-input" id="vnEmail" value="' + escAttr(v.email||'') + '"></div>' +
    '<div class="form-group"><label class="form-label">Account #</label><input class="form-input" id="vnAccount" value="' + escAttr(v.account||'') + '"></div>' +
    '<div class="form-group" style="grid-column:span 2;"><label class="form-label">Ship-To Address</label><input class="form-input" id="vnAddress" value="' + escAttr(v.address||'') + '"></div>' +
    '<div class="form-group"><label class="form-label">Lead Time</label><input class="form-input" id="vnLeadTime" value="' + escAttr(v.leadTime||'') + '"></div>' +
    '<div class="form-group"><label class="form-label">Website</label><input class="form-input" id="vnWebsite" value="' + escAttr(v.website||'') + '"></div>' +
    '<div class="form-group"><label class="form-label">Description</label><input class="form-input" id="vnDescription" value="' + escAttr(v.description||'') + '" placeholder="e.g. Showroom, Custom Upholstery..."></div>' +
    '<div class="form-group"><label class="form-label">Tags</label><input class="form-input" id="vnTags" value="' + escAttr(v.tags||'') + '" placeholder="e.g. Furniture, Lighting, Fabric"></div>' +
    '</div>' +
    '<div style="height:1px;background:var(--gray-200);margin:16px 0;"></div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
    '<div class="form-group"><label class="form-label">🔑 Login / Username</label><input class="form-input" id="vnLogin" value="' + escAttr(v.login||'') + '" placeholder="Vendor portal login" autocomplete="off"></div>' +
    '<div class="form-group"><label class="form-label">🔒 Password</label><div style="position:relative;"><input class="form-input" id="vnPassword" type="password" value="' + escAttr(v.password||'') + '" placeholder="Vendor portal password" autocomplete="off" style="padding-right:36px;"><button type="button" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:16px;" onclick="var p=document.getElementById(\'vnPassword\');p.type=p.type===\'password\'?\'text\':\'password\';this.textContent=p.type===\'password\'?\'👁\':\'🙈\';">👁</button></div></div>' +
    '</div>' +
    '<div class="form-group"><label class="form-label">Notes</label><textarea class="form-textarea" id="vnNotes" rows="2">' + esc(v.notes||'') + '</textarea></div>' +
    moveOpts +
    '</div>' +
    '<div class="modal-footer" style="justify-content:space-between;">' + deleteBtn +
    '<div style="display:flex;gap:8px;"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-primary" onclick="saveVendor(\'' + (existingId||'') + '\',\'' + cat + '\')">' + (existingId ? 'Save Changes' : 'Add ' + cat) + '</button></div>' +
    '</div></div></div>';
}

async function saveVendor(existingId, category) {
  var cat = category || 'Vendor';
  var name = document.getElementById('vnName').value.trim();
  if (!name) { alert('Name is required.'); return; }
  var data = {
    name: name,
    category: cat,
    type: document.getElementById('vnType').value.trim(),
    contact: document.getElementById('vnContact').value.trim(),
    phone: document.getElementById('vnPhone').value.trim(),
    email: document.getElementById('vnEmail').value.trim(),
    website: document.getElementById('vnWebsite').value.trim(),
    address: document.getElementById('vnAddress').value.trim(),
    account: document.getElementById('vnAccount').value.trim(),
    leadTime: document.getElementById('vnLeadTime').value.trim(),
    description: document.getElementById('vnDescription').value.trim(),
    tags: document.getElementById('vnTags').value.trim(),
    login: document.getElementById('vnLogin').value.trim(),
    password: document.getElementById('vnPassword').value.trim(),
    notes: document.getElementById('vnNotes').value.trim(),
    updatedAt: new Date().toISOString(),
    owner: currentUser.email
  };
  try {
    if (existingId) { await db.collection('vendors').doc(existingId).update(data); }
    else { data.createdAt = new Date().toISOString(); await db.collection('vendors').add(data); }
    closeModal();
    if (cat === 'Workroom') renderWorkrooms();
    else if (cat === 'Delivery / Receiver') renderDeliveryReceivers();
    else renderVendors();
  } catch(e) { alert('Error: ' + e.message); }
}

async function deleteVendor(id, category) {
  if (!confirm('Delete this record?')) return;
  try {
    await db.collection('vendors').doc(id).delete();
    closeModal();
    if (category === 'Workroom') renderWorkrooms();
    else if (category === 'Delivery / Receiver') renderDeliveryReceivers();
    else renderVendors();
  } catch(e) { alert('Error: ' + e.message); }
}

async function moveVendorCategory(docId, newCategory) {
  if (!confirm('Move this record to ' + newCategory + '?')) return;
  try {
    await db.collection('vendors').doc(docId).update({ category: newCategory, movedAt: new Date().toISOString() });
    closeModal();
    renderVendors();
  } catch(e) { alert('Error: ' + e.message); }
}

// ==================== VENDOR DETAIL PAGE ====================
async function showVendorDetail(vendorId) {
  var T = document.getElementById('contentArea');
  T.innerHTML = '<div style="text-align:center;padding:60px;color:var(--gray-400);">Loading vendor...</div>';

  var vDoc = await db.collection('vendors').doc(vendorId).get();
  if (!vDoc.exists) { alert('Vendor not found'); renderVendors(); return; }
  var v = vDoc.data();
  var vName = v.name || '';

  setBreadcrumb([{ label: 'Vendors', onclick: 'renderVendors()' }, { label: vName }]);
  setTopbarActions('<button class="btn btn-secondary" onclick="showNewVendorModal(\'' + vendorId + '\',\'Vendor\')">✏️ Edit Info</button>');

  // Build the page shell with tabs
  T.innerHTML =
    '<div style="margin-bottom:24px;">' +
      '<h1 class="page-title" style="margin-bottom:2px;">' + esc(vName) + '</h1>' +
      '<div style="font-size:13px;color:var(--gray-400);">' +
        (v.type ? esc(v.type) + ' · ' : '') +
        (v.tags ? esc(v.tags) + ' · ' : '') +
        (v.email ? '<a href="mailto:' + esc(v.email) + '" style="color:var(--gold);">' + esc(v.email) + '</a> · ' : '') +
        (v.phone ? esc(v.phone) : '') +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:0;border-bottom:2px solid var(--gray-200);margin-bottom:16px;">' +
      '<button id="vTab-products" class="project-tab active" onclick="switchVendorTab(\'products\')">📦 Products</button>' +
      '<button id="vTab-pos" class="project-tab" onclick="switchVendorTab(\'pos\')">🛒 Purchase Orders</button>' +
      '<button id="vTab-info" class="project-tab" onclick="switchVendorTab(\'info\')">ℹ️ Info</button>' +
    '</div>' +
    '<div id="vendorTabContent"><div style="text-align:center;padding:40px;color:var(--gray-400);">Loading products...</div></div>';

  // Store vendor data globally for tab switching
  window._vendorDetail = { id: vendorId, data: v, name: vName, products: null, pos: null };

  // Load products tab by default
  await loadVendorProducts(vName);
}

function switchVendorTab(tab) {
  document.querySelectorAll('.project-tab').forEach(function(t) { t.classList.remove('active'); });
  var tabBtn = document.getElementById('vTab-' + tab);
  if (tabBtn) tabBtn.classList.add('active');

  if (tab === 'products') renderVendorProductsTab();
  else if (tab === 'pos') loadVendorPOs(window._vendorDetail.name);
  else if (tab === 'info') renderVendorInfoTab();
}

async function loadVendorProducts(vendorName) {
  var vn = vendorName.toLowerCase().trim();
  if (!vn) {
    window._vendorDetail.products = [];
    renderVendorProductsTab();
    return;
  }
  var products = [];

  // Scan all projects for clips with this vendor
  var boardsSnap = await db.collection('boards').get();
  var boards = [];
  boardsSnap.forEach(function(d) { boards.push({ id: d.id, name: d.data().name || d.id }); });

  for (var i = 0; i < boards.length; i++) {
    try {
      var clipsSnap = await db.collection('boards').doc(boards[i].id).collection('clips').get();
      clipsSnap.forEach(function(d) {
        var data = d.data();
        var cv = (data.vendor || '').toLowerCase().trim();
        var cm = (data.manufacturer || '').toLowerCase().trim();
        var cvMatch = cv && (cv === vn || cv.indexOf(vn) >= 0 || vn.indexOf(cv) >= 0);
        var cmMatch = cm && (cm === vn || cm.indexOf(vn) >= 0 || vn.indexOf(cm) >= 0);
        if (cvMatch || cmMatch) {
          products.push(Object.assign({ _clipId: d.id, _projectId: boards[i].id, _projectName: boards[i].name }, data));
        }
      });
    } catch(e) {}
  }

  // Also check products collection
  try {
    var prodSnap = await db.collection('products').get();
    prodSnap.forEach(function(d) {
      var data = d.data();
      var pv = (data.vendor || '').toLowerCase().trim();
      var pm = (data.manufacturer || '').toLowerCase().trim();
      if (pv === vn || pm === vn) {
        // Only add if not already found by title
        var exists = products.some(function(p) { return (p.title || '').toLowerCase() === (data.title || '').toLowerCase(); });
        if (!exists) products.push(Object.assign({ _clipId: d.id, _projectId: 'library', _projectName: 'Product Library' }, data));
      }
    });
  } catch(e) {}

  window._vendorDetail.products = products;
  renderVendorProductsTab();
}

function renderVendorProductsTab() {
  var C = document.getElementById('vendorTabContent');
  var products = window._vendorDetail.products;
  if (!products) { C.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400);">Loading...</div>'; return; }

  if (products.length === 0) {
    C.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-text">No products found for this vendor.</div></div>';
    return;
  }

  // Update tab label with count
  var tabBtn = document.getElementById('vTab-products');
  if (tabBtn) tabBtn.textContent = '📦 Products (' + products.length + ')';

  var totalCost = 0, totalSell = 0;
  products.forEach(function(p) { totalCost += parseFloat(p.cost || p.totalCost || 0); totalSell += parseFloat(p.clientPrice || p.totalSelling || 0); });

  var rows = products.map(function(p) {
    var imgHtml = p.imageUrl ? '<img src="' + p.imageUrl + '" style="width:36px;height:36px;object-fit:cover;border-radius:4px;background:#f5f5f5;" onerror="this.style.display=\'none\'">' : '<div style="width:36px;height:36px;background:var(--gray-100);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--gray-300);">—</div>';
    return '<tr style="border-bottom:1px solid var(--gray-100);">' +
      '<td style="padding:8px;">' + imgHtml + '</td>' +
      '<td style="padding:8px;"><div style="font-weight:600;font-size:13px;">' + esc(p.title || '') + '</div>' +
        (p.description ? '<div style="font-size:11px;color:var(--gray-400);max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(p.description) + '</div>' : '') + '</td>' +
      '<td style="padding:8px;font-size:12px;">' + esc(p._projectName || '') + '</td>' +
      '<td style="padding:8px;font-size:12px;">' + esc(p.category || '') + '</td>' +
      '<td style="padding:8px;font-size:12px;">' + esc(p.room || '') + '</td>' +
      '<td style="padding:8px;font-family:var(--font-mono);font-size:13px;">$' + (parseFloat(p.cost || 0)).toLocaleString() + '</td>' +
      '<td style="padding:8px;font-family:var(--font-mono);font-size:13px;color:var(--green);">$' + (parseFloat(p.clientPrice || 0)).toLocaleString() + '</td>' +
      '<td style="padding:8px;font-size:12px;text-align:center;">' + (p.qty || 1) + '</td>' +
      '<td style="padding:8px;font-size:11px;">' + esc(p.sku || '') + '</td>' +
      '</tr>';
  }).join('');

  C.innerHTML =
    '<div style="display:flex;gap:24px;margin-bottom:16px;">' +
      '<div style="font-size:13px;color:var(--gray-400);">' + products.length + ' products</div>' +
      '<div style="font-size:13px;">Total Cost: <strong style="color:var(--gold);">$' + totalCost.toLocaleString() + '</strong></div>' +
      '<div style="font-size:13px;">Total Selling: <strong style="color:var(--green);">$' + totalSell.toLocaleString() + '</strong></div>' +
    '</div>' +
    '<div class="card" style="overflow:hidden;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
    '<thead><tr style="border-bottom:2px solid var(--gray-200);">' +
      '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Img</th>' +
      '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Product</th>' +
      '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Project</th>' +
      '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Category</th>' +
      '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Room</th>' +
      '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Cost</th>' +
      '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Sell Price</th>' +
      '<th style="padding:8px;text-align:center;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Qty</th>' +
      '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">SKU</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

async function loadVendorPOs(vendorName) {
  var C = document.getElementById('vendorTabContent');
  C.innerHTML = '<div style="text-align:center;padding:40px;color:var(--gray-400);">Loading purchase orders...</div>';

  var vn = vendorName.toLowerCase().trim();
  if (!vn) {
    window._vendorDetail.pos = [];
    C.innerHTML = '<div class="empty-state"><div class="empty-icon">🛒</div><div class="empty-text">No purchase orders found for this vendor.</div></div>';
    return;
  }
  var pos = [];

  // Scan all projects for POs with this vendor
  var boardsSnap = await db.collection('boards').get();
  var boards = [];
  boardsSnap.forEach(function(d) { boards.push({ id: d.id, name: d.data().name || d.id }); });

  for (var i = 0; i < boards.length; i++) {
    try {
      var posSnap = await db.collection('boards').doc(boards[i].id).collection('purchaseOrders').get();
      posSnap.forEach(function(d) {
        var data = d.data();
        var pv = (data.vendor || '').toLowerCase().trim();
        if (pv && (pv === vn || pv.indexOf(vn) >= 0 || vn.indexOf(pv) >= 0)) {
          pos.push(Object.assign({ _poId: d.id, _projectId: boards[i].id, _projectName: boards[i].name }, data));
        }
      });
    } catch(e) {}
  }

  // Also check clips for PO references
  var poNums = new Set(pos.map(function(p) { return p.number || p.poNum || ''; }).filter(Boolean));
  if (window._vendorDetail.products) {
    window._vendorDetail.products.forEach(function(p) {
      if (p.poNum && !poNums.has(p.poNum)) {
        pos.push({
          number: p.poNum,
          poNum: p.poNum,
          vendor: vendorName,
          status: p.poStatus || 'From Import',
          total: parseFloat(p.totalCost || p.cost || 0),
          _projectId: p._projectId,
          _projectName: p._projectName,
          _source: 'clip-ref'
        });
        poNums.add(p.poNum);
      }
    });
  }

  window._vendorDetail.pos = pos;

  // Update tab label
  var tabBtn = document.getElementById('vTab-pos');
  if (tabBtn) tabBtn.textContent = '🛒 Purchase Orders (' + pos.length + ')';

  if (pos.length === 0) {
    C.innerHTML = '<div class="empty-state"><div class="empty-icon">🛒</div><div class="empty-text">No purchase orders found for this vendor.</div></div>';
    return;
  }

  var totalPO = 0;
  pos.forEach(function(p) { totalPO += parseFloat(p.total || 0); });

  var rows = pos.map(function(p) {
    var num = p.number || p.poNum || '—';
    var status = p.status || 'Draft';
    var statusClass = status === 'Sent' ? 'color:var(--gold)' : status === 'Received' ? 'color:var(--green)' : '';
    return '<tr style="border-bottom:1px solid var(--gray-100);">' +
      '<td style="padding:10px 12px;font-weight:600;">' + esc(num) + '</td>' +
      '<td style="padding:10px 12px;font-size:12px;">' + esc(p._projectName || '') + '</td>' +
      '<td style="padding:10px 12px;"><span style="' + statusClass + '">' + esc(status) + '</span></td>' +
      '<td style="padding:10px 12px;font-family:var(--font-mono);">$' + (parseFloat(p.total || 0)).toLocaleString() + '</td>' +
      '<td style="padding:10px 12px;font-size:12px;color:var(--gray-400);">' + esc(p.date || p.createdAt || '') + '</td>' +
      '</tr>';
  }).join('');

  C.innerHTML =
    '<div style="display:flex;gap:24px;margin-bottom:16px;">' +
      '<div style="font-size:13px;color:var(--gray-400);">' + pos.length + ' purchase orders</div>' +
      '<div style="font-size:13px;">Total: <strong style="color:var(--gold);">$' + totalPO.toLocaleString() + '</strong></div>' +
    '</div>' +
    '<div class="card" style="overflow:hidden;"><table style="width:100%;border-collapse:collapse;font-size:13px;">' +
    '<thead><tr style="border-bottom:2px solid var(--gray-200);">' +
      '<th style="padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">PO #</th>' +
      '<th style="padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Project</th>' +
      '<th style="padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Status</th>' +
      '<th style="padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Total</th>' +
      '<th style="padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Date</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function renderVendorInfoTab() {
  var C = document.getElementById('vendorTabContent');
  var v = window._vendorDetail.data;
  var vid = window._vendorDetail.id;

  var fields = [
    ['Name', v.name], ['Type', v.type], ['Contact', v.contact], ['Phone', v.phone],
    ['Email', v.email], ['Account #', v.account], ['Ship-To Address', v.address],
    ['Lead Time', v.leadTime], ['Website', v.website], ['Description', v.description],
    ['Tags', v.tags], ['Notes', v.notes]
  ].filter(function(f) { return f[1]; });

  var html = '<div class="card" style="padding:24px;"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">';
  fields.forEach(function(f) {
    var val = f[1];
    if (f[0] === 'Email') val = '<a href="mailto:' + esc(f[1]) + '" style="color:var(--gold);">' + esc(f[1]) + '</a>';
    else if (f[0] === 'Website') val = '<a href="' + esc(f[1]) + '" target="_blank" style="color:var(--gold);">' + esc(f[1]) + '</a>';
    else val = esc(val);
    html += '<div><div style="font-size:11px;text-transform:uppercase;color:var(--gray-400);font-weight:600;margin-bottom:4px;">' + f[0] + '</div><div style="font-size:14px;">' + val + '</div></div>';
  });
  html += '</div>';

  // Login/password if present
  if (v.login || v.password) {
    html += '<div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--gray-200);display:grid;grid-template-columns:1fr 1fr;gap:16px;">';
    if (v.login) html += '<div><div style="font-size:11px;text-transform:uppercase;color:var(--gray-400);font-weight:600;margin-bottom:4px;">🔑 Login</div><div style="font-size:14px;">' + esc(v.login) + '</div></div>';
    if (v.password) html += '<div><div style="font-size:11px;text-transform:uppercase;color:var(--gray-400);font-weight:600;margin-bottom:4px;">🔒 Password</div><div style="font-size:14px;"><span id="vPwdDisplay">••••••••</span> <button onclick="var s=document.getElementById(\'vPwdDisplay\');s.textContent=s.textContent===\'••••••••\'?\'' + esc(v.password).replace(/'/g, "\\'") + '\':\'••••••••\';" style="border:none;background:none;cursor:pointer;font-size:14px;">👁</button></div></div>';
    html += '</div>';
  }

  html += '<div style="margin-top:20px;"><button class="btn btn-primary" onclick="showNewVendorModal(\'' + vid + '\',\'Vendor\')">✏️ Edit Vendor</button></div></div>';
  C.innerHTML = html;
}

// ==================== WORKROOMS ====================
async function renderWorkrooms() {
  setBreadcrumb([{ label: 'Workrooms' }]);
  setTopbarActions('<button class="btn btn-primary" onclick="showNewVendorModal(null,\'Workroom\')">+ New Workroom</button>');
  var T = document.getElementById('contentArea');
  T.innerHTML = '<div style="text-align:center;padding:60px;color:var(--gray-400);">Loading...</div>';
  try {
    var snap = await db.collection('vendors').where('category','==','Workroom').get();
    var items = [];
    snap.forEach(function(d) { items.push(Object.assign({ id: d.id }, d.data())); });
    items.sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
    window._allWorkrooms = items;
    renderWorkroomsView('');
  } catch(e) { T.innerHTML = '<div class="empty-state"><div class="empty-text">Error: ' + esc(e.message) + '</div></div>'; }
}

function renderWorkroomsView(query) {
  var T = document.getElementById('contentArea');
  var items = window._allWorkrooms || [];
  var filtered = items;
  if (query) {
    var q = query.toLowerCase();
    filtered = items.filter(function(v) {
      return (v.name||'').toLowerCase().indexOf(q)>=0 || (v.type||'').toLowerCase().indexOf(q)>=0 ||
             (v.contact||'').toLowerCase().indexOf(q)>=0 || (v.tags||'').toLowerCase().indexOf(q)>=0 ||
             (v.description||'').toLowerCase().indexOf(q)>=0;
    });
  }
  if (items.length === 0) {
    T.innerHTML = '<h1 class="page-title">Workrooms</h1><p style="color:var(--gray-400);margin-bottom:20px;">Upholsterers, drapery workrooms, installers, and fabricators</p><div class="empty-state"><div class="empty-icon">🔨</div><div class="empty-text">No workrooms yet. Run the Vendor Import tool or add manually.</div><button class="btn btn-primary" onclick="showNewVendorModal(null,\'Workroom\')">+ New Workroom</button></div>';
    return;
  }
  var rows = filtered.map(function(v) {
    return '<tr style="border-bottom:1px solid var(--gray-100);cursor:pointer;" onclick="showNewVendorModal(\'' + v.id + '\',\'Workroom\')">' +
      '<td style="padding:10px 12px;font-weight:600;">' + esc(v.name||'') + '</td>' +
      '<td style="padding:10px 12px;font-size:12px;color:var(--gray-500);">' + esc(v.description||v.type||'') + '</td>' +
      '<td style="padding:10px 12px;">' + esc(v.contact||'') + '</td>' +
      '<td style="padding:10px 12px;">' + esc(v.phone||'') + (v.email ? '<br><span style="font-size:11px;color:var(--gray-400);">' + esc(v.email) + '</span>' : '') + '</td>' +
      '<td style="padding:10px 12px;font-size:11px;color:var(--gray-400);">' + esc(v.tags||'') + '</td>' +
      '<td style="padding:10px 8px;"><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();showNewVendorModal(\'' + v.id + '\',\'Workroom\')">Edit</button></td></tr>';
  }).join('');
  T.innerHTML = '<h1 class="page-title">Workrooms</h1>' +
    '<p style="color:var(--gray-400);margin-bottom:16px;">Upholsterers, drapery workrooms, installers, and fabricators</p>' +
    '<div style="display:flex;gap:12px;margin-bottom:16px;"><input type="text" class="form-input" placeholder="Search workrooms..." value="' + esc(query||'') + '" oninput="renderWorkroomsView(this.value)" style="max-width:400px;"></div>' +
    '<p style="color:var(--gray-400);margin-bottom:12px;font-size:13px;">Showing ' + filtered.length + ' of ' + items.length + ' workrooms</p>' +
    '<div class="card" style="overflow:hidden;">' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
    '<thead><tr style="border-bottom:2px solid var(--gray-200);">' +
    '<th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Name</th>' +
    '<th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Description</th>' +
    '<th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Contact</th>' +
    '<th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Phone / Email</th>' +
    '<th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Tags</th>' +
    '<th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

// ==================== DELIVERY / RECEIVERS ====================
async function renderDeliveryReceivers() {
  setBreadcrumb([{ label: 'Delivery / Receivers' }]);
  setTopbarActions('<button class="btn btn-primary" onclick="showNewVendorModal(null,\'Delivery / Receiver\')">+ New Delivery / Receiver</button>');
  var T = document.getElementById('contentArea');
  T.innerHTML = '<div style="text-align:center;padding:60px;color:var(--gray-400);">Loading...</div>';
  try {
    var snap = await db.collection('vendors').where('category','==','Delivery / Receiver').get();
    var items = [];
    snap.forEach(function(d) { items.push(Object.assign({ id: d.id }, d.data())); });
    items.sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
    window._allReceivers = items;
    renderReceiversView('');
  } catch(e) { T.innerHTML = '<div class="empty-state"><div class="empty-text">Error: ' + esc(e.message) + '</div></div>'; }
}

function renderReceiversView(query) {
  var T = document.getElementById('contentArea');
  var items = window._allReceivers || [];
  var filtered = items;
  if (query) {
    var q = query.toLowerCase();
    filtered = items.filter(function(v) {
      return (v.name||'').toLowerCase().indexOf(q)>=0 || (v.description||'').toLowerCase().indexOf(q)>=0 ||
             (v.contact||'').toLowerCase().indexOf(q)>=0 || (v.tags||'').toLowerCase().indexOf(q)>=0;
    });
  }
  if (items.length === 0) {
    T.innerHTML = '<h1 class="page-title">Delivery / Receivers</h1><p style="color:var(--gray-400);margin-bottom:20px;">Freight companies, delivery services, and receiving warehouses</p><div class="empty-state"><div class="empty-icon">🚚</div><div class="empty-text">No delivery/receivers yet. Run the Vendor Import tool or add manually.</div><button class="btn btn-primary" onclick="showNewVendorModal(null,\'Delivery / Receiver\')">+ New Delivery / Receiver</button></div>';
    return;
  }
  var rows = filtered.map(function(v) {
    return '<tr style="border-bottom:1px solid var(--gray-100);cursor:pointer;" onclick="showNewVendorModal(\'' + v.id + '\',\'Delivery / Receiver\')">' +
      '<td style="padding:10px 12px;font-weight:600;">' + esc(v.name||'') + '</td>' +
      '<td style="padding:10px 12px;font-size:12px;color:var(--gray-500);">' + esc(v.description||v.type||'') + '</td>' +
      '<td style="padding:10px 12px;">' + esc(v.contact||'') + '</td>' +
      '<td style="padding:10px 12px;">' + esc(v.phone||'') + (v.email ? '<br><span style="font-size:11px;color:var(--gray-400);">' + esc(v.email) + '</span>' : '') + '</td>' +
      '<td style="padding:10px 12px;font-size:12px;">' + esc(v.address||'').substring(0,40) + '</td>' +
      '<td style="padding:10px 8px;"><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();showNewVendorModal(\'' + v.id + '\',\'Delivery / Receiver\')">Edit</button></td></tr>';
  }).join('');
  T.innerHTML = '<h1 class="page-title">Delivery / Receivers</h1>' +
    '<p style="color:var(--gray-400);margin-bottom:16px;">Freight companies, delivery services, and receiving warehouses</p>' +
    '<div style="display:flex;gap:12px;margin-bottom:16px;"><input type="text" class="form-input" placeholder="Search delivery/receivers..." value="' + esc(query||'') + '" oninput="renderReceiversView(this.value)" style="max-width:400px;"></div>' +
    '<p style="color:var(--gray-400);margin-bottom:12px;font-size:13px;">Showing ' + filtered.length + ' of ' + items.length + '</p>' +
    '<div class="card" style="overflow:hidden;">' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
    '<thead><tr style="border-bottom:2px solid var(--gray-200);">' +
    '<th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Name</th>' +
    '<th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Description</th>' +
    '<th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Contact</th>' +
    '<th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Phone / Email</th>' +
    '<th style="text-align:left;padding:10px 12px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Address</th>' +
    '<th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}




async function showNewProposalBuilder(projectId) {
  var T = document.getElementById('modalContainer');
  T.innerHTML = '<div style="text-align:center;padding:60px;">Loading...</div>';
  var clips = [];
  var services = [
    { id:'svc1', name:'Design Fee', unit:'hr', price:175 },
    { id:'svc2', name:'Consultation', unit:'hr', price:175 },
    { id:'svc3', name:'Installation Supervision', unit:'hr', price:125 },
    { id:'svc4', name:'Project Management', unit:'flat', price:0 },
    { id:'svc5', name:'Procurement Fee (20%)', unit:'pct', price:20 }
  ];
  try {
    var s = await db.collection('boards').doc(projectId).collection('clips').get();
    s.forEach(function(d){ clips.push(Object.assign({id:d.id},d.data())); });
  } catch(e){}
  var items = [];
  var tab = 'project';
  var propName = 'Proposal ' + new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});

  function libHTML(t, q) {
    q = (q||'').toLowerCase();
    if (t === 'project') {
      var f = clips.filter(function(c){ return !q||(c.title||'').toLowerCase().includes(q)||(c.vendor||'').toLowerCase().includes(q); });
      if (!f.length) return '<div style="text-align:center;padding:24px;color:var(--gray-400);">No items found</div>';
      return f.map(function(c) {
        var p = parseFloat((c.clientPrice||'').replace(/[^0-9.]/g,''))||0;
        var img = c.imageUrl
          ? '<img src="' + escAttr(c.imageUrl) + '" style="width:40px;height:40px;object-fit:cover;border-radius:4px;flex-shrink:0;">'
          : '<div style="width:40px;height:40px;background:var(--gray-100);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">Item</div>';
        return '<div onclick="window._addClip(\'' + c.id + '\')" style="display:flex;gap:8px;padding:8px;border:1px solid var(--gray-200);border-radius:6px;margin-bottom:4px;cursor:pointer;" onmouseover="this.style.borderColor=\'var(--gold)\'" onmouseout="this.style.borderColor=\'var(--gray-200)\'">' +
          img + '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(c.title||'Untitled') + '</div>' +
          '<div style="font-size:11px;color:var(--gray-400);">' + esc(c.vendor||'') + '</div></div>' +
          '<div style="font-size:12px;font-weight:700;color:var(--gold);flex-shrink:0;">' + (p ? '$'+p.toFixed(2) : '') + '</div></div>';
      }).join('');
    } else {
      return services.map(function(sv) {
        return '<div onclick="window._addSvc(\'' + sv.id + '\')" style="display:flex;gap:8px;padding:8px;border:1px solid var(--gray-200);border-radius:6px;margin-bottom:4px;cursor:pointer;" onmouseover="this.style.borderColor=\'var(--gold)\'" onmouseout="this.style.borderColor=\'var(--gray-200)\'">' +
          '<div style="width:40px;height:40px;background:var(--gray-100);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;">S</div>' +
          '<div style="flex:1;"><div style="font-size:12px;font-weight:600;">' + esc(sv.name) + '</div>' +
          '<div style="font-size:11px;color:var(--gray-400);">' + (sv.unit==='hr'?'per hour':sv.unit==='pct'?sv.price+'%':'flat') + '</div></div>' +
          '<div style="font-size:12px;font-weight:700;color:var(--gold);flex-shrink:0;">' + (sv.unit==='pct'?sv.price+'%':sv.price?'$'+sv.price.toFixed(2):'') + '</div></div>';
      }).join('');
    }
  }

  function render() {
    var sub = items.reduce(function(s,i){ return s+(parseFloat(i.lineTotal)||0); }, 0);
    var leftHTML = items.length === 0
      ? '<div style="text-align:center;padding:40px;color:var(--gray-400);"><div style="font-size:32px;margin-bottom:8px;">&#x1F448;</div><div>Click items on the right to add them</div></div>'
      : items.map(function(item, i) {
          var imgEl = item.imageUrl
            ? '<img src="' + escAttr(item.imageUrl) + '" style="width:48px;height:48px;object-fit:cover;border-radius:4px;flex-shrink:0;">'
            : '<div style="width:48px;height:48px;background:var(--gray-100);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:12px;">' + (item.type==='expense'?'EXP':'SVC') + '</div>';
          return '<div style="display:flex;gap:8px;padding:8px;border:1px solid var(--gray-200);border-radius:8px;margin-bottom:6px;background:white;align-items:flex-start;">' + imgEl +
            '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(item.title) + '</div>' +
            '<div style="display:flex;gap:6px;margin-top:4px;align-items:center;">' +
            '<input type="number" value="' + item.qty + '" min="0.01" step="0.01" style="width:52px;padding:3px 6px;border:1px solid var(--gray-200);border-radius:4px;font-size:12px;" onchange="window._items[' + i + '].qty=parseFloat(this.value)||1;window._items[' + i + '].lineTotal=window._items[' + i + '].qty*window._items[' + i + '].unitPrice;window._render()">' +
            '<span style="font-size:11px;color:var(--gray-400);">' + (item.unit||'ea') + ' x</span>' +
            '<input type="number" value="' + item.unitPrice + '" min="0" step="0.01" style="width:80px;padding:3px 6px;border:1px solid var(--gray-200);border-radius:4px;font-size:12px;" onchange="window._items[' + i + '].unitPrice=parseFloat(this.value)||0;window._items[' + i + '].lineTotal=window._items[' + i + '].qty*window._items[' + i + '].unitPrice;window._render()">' +
            '</div></div>' +
            '<div style="text-align:right;flex-shrink:0;">' +
            '<div style="font-size:13px;font-weight:700;color:var(--gold);">$' + ((item.qty||1)*(item.unitPrice||0)).toFixed(2) + '</div>' +
            '<button onclick="window._items.splice(' + i + ',1);window._render()" style="background:none;border:none;color:var(--gray-300);cursor:pointer;font-size:16px;">x</button>' +
            '</div></div>';
        }).join('');

    T.innerHTML =
      '<div class="modal-overlay">' +
      '<div class="modal" style="width:95vw;max-width:1200px;height:90vh;display:flex;flex-direction:column;">' +
      '<div class="modal-header" style="flex-shrink:0;">' +
      '<div style="display:flex;align-items:center;gap:16px;flex:1;"><div class="modal-title">New Proposal</div>' +
      '<input class="form-input" style="width:280px;" id="pnInput" value="' + escAttr(propName) + '" oninput="window._pname=this.value"></div>' +
      '<button class="modal-close" onclick="closeModal()">&times;</button></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;flex:1;overflow:hidden;border-top:1px solid var(--gray-200);">' +
      '<div style="display:flex;flex-direction:column;border-right:2px solid var(--gray-200);overflow:hidden;">' +
      '<div style="padding:10px 16px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);font-weight:600;font-size:11px;text-transform:uppercase;color:var(--gray-500);display:flex;justify-content:space-between;align-items:center;">' +
      '<span>Proposal Items (' + items.length + ')</span>' +
      '<button class="btn btn-secondary btn-sm" onclick="window._addExp()">+ Expense</button></div>' +
      '<div style="flex:1;overflow-y:auto;padding:8px;">' + leftHTML + '</div>' +
      '<div style="padding:12px 16px;border-top:2px solid var(--gray-200);background:var(--gray-50);">' +
      '<div style="display:flex;justify-content:space-between;font-size:18px;font-weight:700;"><span>Total</span><span style="color:var(--gold);">$' + sub.toFixed(2) + '</span></div>' +
      '<button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="window._save(\'' + projectId + '\')">Save Proposal</button>' +
      '</div></div>' +
      '<div style="display:flex;flex-direction:column;overflow:hidden;">' +
      '<div style="display:flex;border-bottom:1px solid var(--gray-200);">' +
      '<button onclick="window._tab(\'project\')" style="flex:1;padding:10px 4px;border:none;border-bottom:3px solid ' + (tab==='project'?'var(--gold)':'transparent') + ';background:' + (tab==='project'?'white':'var(--gray-50)') + ';font-size:12px;font-weight:' + (tab==='project'?'700':'400') + ';color:' + (tab==='project'?'var(--gold)':'var(--gray-500)') + ';cursor:pointer;">Project Items</button>' +
      '<button onclick="window._tab(\'services\')" style="flex:1;padding:10px 4px;border:none;border-bottom:3px solid ' + (tab==='services'?'var(--gold)':'transparent') + ';background:' + (tab==='services'?'white':'var(--gray-50)') + ';font-size:12px;font-weight:' + (tab==='services'?'700':'400') + ';color:' + (tab==='services'?'var(--gold)':'var(--gray-500)') + ';cursor:pointer;">Services</button>' +
      '</div>' +
      '<div style="padding:8px 12px;border-bottom:1px solid var(--gray-200);">' +
      '<input class="form-input" style="font-size:12px;" placeholder="Search..." oninput="document.getElementById(\'libDiv\').innerHTML=window._lib(window._tab_,this.value)"></div>' +
      '<div style="flex:1;overflow-y:auto;padding:8px;" id="libDiv">' + libHTML(tab,'') + '</div>' +
      '</div></div></div></div>';

    window._items = items;
    window._pname = propName;
    window._tab_ = tab;
    window._render = render;
    window._lib = libHTML;
    window._tab = function(t) { tab = t; window._tab_ = t; render(); };
    window._addClip = function(id) {
      var c = clips.find(function(x){ return x.id===id; });
      if (!c) return;
      var p = parseFloat((c.clientPrice||'').replace(/[^0-9.]/g,''))||0;
      items.push({ type:'product', id:id, title:c.title||'Item', vendor:c.vendor||'', room:c.room||'', imageUrl:c.imageUrl||null, qty:1, unit:'ea', unitPrice:p, lineTotal:p });
      render();
    };
    window._addSvc = function(id) {
      var sv = services.find(function(x){ return x.id===id; });
      if (!sv) return;
      items.push({ type:'service', id:id, title:sv.name, unit:sv.unit||'hr', qty:1, unitPrice:sv.price||0, lineTotal:sv.price||0 });
      render();
    };
    window._addExp = function() {
      var pick = prompt('Expense type:\n1. Freight\n2. Shipping\n3. Sales Tax Pre-paid\n4. Storage\n5. Misc Expense\n\nOr type your own:');
      if (!pick) return;
      var types = ['','Freight','Shipping','Sales Tax Pre-paid','Storage','Misc Expense'];
      var name = types[parseInt(pick)] || pick;
      items.push({ type:'expense', title:name, qty:1, unit:'flat', unitPrice:0, lineTotal:0 });
      render();
    };
    window._save = async function(pid) {
      var nm = window._pname || propName;
      if (items.length === 0) { alert('Add at least one item.'); return; }
      var total = items.reduce(function(s,i){ return s+(parseFloat(i.lineTotal)||0); }, 0);
      try {
        await db.collection('boards').doc(pid).collection('proposals').add({
          name: nm,
          number: 'PROP-'+Date.now().toString().slice(-6),
          items: items.map(function(i){ return { description:i.title, qty:i.qty||1, unitPrice:i.unitPrice||0, lineTotal:i.lineTotal||0, vendor:i.vendor||'', room:i.room||'', type:i.type||'product', unit:i.unit||'ea', imageUrl:i.imageUrl||null }; }),
          total: total,
          status: 'Draft',
          createdAt: new Date().toISOString(),
          owner: currentUser.email
        });
        closeModal();
        navigate('#/project/'+pid+'/proposals');
      } catch(e) { alert('Error saving: ' + e.message); }
    };
  }
  render();
}

console.log('CCH Functions loaded OK');
