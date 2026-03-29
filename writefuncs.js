const fs = require('fs');

const content = `// CCH Platform Extended Functions

async function updateDocStatus(projectId, collection, docId, newStatus) {
  try {
    await db.collection('boards').doc(projectId).collection(collection).doc(docId)
      .update({ status: newStatus, updatedAt: new Date().toISOString() });
  } catch(e) { alert('Error: ' + e.message); }
}

async function deleteFinanceDoc(projectId, collection, docId) {
  const labels = { proposals:'proposal', invoices:'invoice', purchaseOrders:'PO' };
  if (!confirm('Delete this ' + (labels[collection]||'document') + '?')) return;
  try {
    await db.collection('boards').doc(projectId).collection(collection).doc(docId).delete();
    navigate(window.location.hash);
  } catch(e) { alert('Error: ' + e.message); }
}

async function showNewInvoiceModal(projectId) {
  document.getElementById('modalContainer').innerHTML = \`
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal" style="width:560px;">
        <div class="modal-header"><div class="modal-title">New Invoice</div><button class="modal-close" onclick="closeModal()">&times;</button></div>
        <div class="modal-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="form-group"><label class="form-label">Invoice #</label><input class="form-input" id="niNumber"></div>
          <div class="form-group"><label class="form-label">Total ($)</label><input class="form-input" type="number" id="niTotal"></div>
          <div class="form-group"><label class="form-label">Status</label><select class="form-input" id="niStatus"><option value="Draft">Draft</option><option value="Sent" selected>Sent</option><option value="Paid">Paid</option><option value="Overdue">Overdue</option></select></div>
          <div class="form-group"><label class="form-label">Due Date</label><input class="form-input" type="date" id="niDue"></div>
          <div class="form-group" style="grid-column:span 2;"><label class="form-label">Notes</label><textarea class="form-textarea" id="niNotes" rows="2"></textarea></div>
        </div></div>
        <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveNewInvoice('\${projectId}')">Create Invoice</button></div>
      </div>
    </div>\`;
}

async function saveNewInvoice(projectId) {
  try {
    await db.collection('boards').doc(projectId).collection('invoices').add({
      number: document.getElementById('niNumber').value.trim() || 'INV-' + Date.now().toString().slice(-6),
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
  const snap = await db.collection('boards').doc(projectId).collection('invoices').doc(invId).get();
  if (!snap.exists) return;
  const inv = snap.data();
  const opts = ['Draft','Sent','Paid','Overdue','Partial'].map(s => '<option ' + (inv.status===s?'selected':'') + ' value="' + s + '">' + s + '</option>').join('');
  document.getElementById('modalContainer').innerHTML = \`
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal" style="width:560px;">
        <div class="modal-header"><div class="modal-title">Edit Invoice</div><button class="modal-close" onclick="closeModal()">&times;</button></div>
        <div class="modal-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="form-group"><label class="form-label">Invoice #</label><input class="form-input" id="eiNumber" value="\${escAttr(inv.number||'')}"></div>
          <div class="form-group"><label class="form-label">Total ($)</label><input class="form-input" type="number" id="eiTotal" value="\${inv.total||0}"></div>
          <div class="form-group"><label class="form-label">Status</label><select class="form-input" id="eiStatus">\${opts}</select></div>
          <div class="form-group"><label class="form-label">Due Date</label><input class="form-input" type="date" id="eiDue" value="\${escAttr(inv.dueDate||'')}"></div>
          <div class="form-group" style="grid-column:span 2;"><label class="form-label">Notes</label><textarea class="form-textarea" id="eiNotes" rows="2">\${esc(inv.notes||'')}</textarea></div>
        </div></div>
        <div class="modal-footer" style="justify-content:space-between;">
          <button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:var(--red);" onclick="deleteFinanceDoc('\${projectId}','invoices','\${invId}');closeModal();">Delete</button>
          <div style="display:flex;gap:8px;"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveEditInvoice('\${projectId}','\${invId}')">Save</button></div>
        </div>
      </div>
    </div>\`;
}

async function saveEditInvoice(projectId, invId) {
  try {
    await db.collection('boards').doc(projectId).collection('invoices').doc(invId).update({
      number: document.getElementById('eiNumber').value.trim(),
      total: parseFloat(document.getElementById('eiTotal').value)||0,
      status: document.getElementById('eiStatus').value,
      dueDate: document.getElementById('eiDue').value,
      notes: document.getElementById('eiNotes').value.trim(),
      updatedAt: new Date().toISOString()
    });
    closeModal(); navigate(window.location.hash);
  } catch(e) { alert('Error: ' + e.message); }
}

async function showEditPOModal(projectId, poId) {
  const snap = await db.collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
  if (!snap.exists) { alert('PO not found'); return; }
  const po = snap.data();
  const opts = ['Draft','Sent','Ordered','Received','On Hold','Cancelled'].map(s => '<option ' + (po.status===s?'selected':'') + ' value="' + s + '">' + s + '</option>').join('');
  document.getElementById('modalContainer').innerHTML = \`
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal" style="width:620px;">
        <div class="modal-header"><div class="modal-title">Edit PO</div><button class="modal-close" onclick="closeModal()">&times;</button></div>
        <div class="modal-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="form-group"><label class="form-label">PO Number</label><input class="form-input" id="epNumber" value="\${escAttr(po.number||'')}"></div>
          <div class="form-group"><label class="form-label">Vendor</label><input class="form-input" id="epVendor" value="\${escAttr(po.vendor||'')}"></div>
          <div class="form-group"><label class="form-label">Total ($)</label><input class="form-input" type="number" id="epTotal" value="\${po.total||0}"></div>
          <div class="form-group"><label class="form-label">Status</label><select class="form-input" id="epStatus">\${opts}</select></div>
          <div class="form-group"><label class="form-label">ETA</label><input class="form-input" id="epEta" value="\${escAttr(po.eta||'')}"></div>
          <div class="form-group"><label class="form-label">Ship To</label><input class="form-input" id="epShipTo" value="\${escAttr(po.shipTo||'')}"></div>
          <div class="form-group" style="grid-column:span 2;"><label class="form-label">Description</label><textarea class="form-textarea" id="epDesc" rows="3">\${esc(po.description||'')}</textarea></div>
          <div class="form-group" style="grid-column:span 2;"><label class="form-label">Notes</label><input class="form-input" id="epNotes" value="\${escAttr(po.notes||'')}"></div>
        </div></div>
        <div class="modal-footer" style="justify-content:space-between;">
          <button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:var(--red);" onclick="deleteFinanceDoc('\${projectId}','purchaseOrders','\${poId}');closeModal();">Delete</button>
          <div style="display:flex;gap:8px;"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveEditPO('\${projectId}','\${poId}')">Save</button></div>
        </div>
      </div>
    </div>\`;
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
      description: document.getElementById('epDesc').value.trim(),
      notes: document.getElementById('epNotes').value.trim(),
      updatedAt: new Date().toISOString()
    });
    closeModal(); navigate(window.location.hash);
  } catch(e) { alert('Error: ' + e.message); }
}

async function printProposal(projectId, proposalId) {
  const snap = await db.collection('boards').doc(projectId).collection('proposals').doc(proposalId).get();
  const proj = await db.collection('boards').doc(projectId).get();
  if (!snap.exists) return;
  const p = snap.data();
  const projName = proj.exists ? (proj.data().name || projectId) : projectId;
  const items = p.items || [];
  const total = parseFloat(p.total)||0;
  const dateStr = p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : new Date().toLocaleDateString();
  const rows = items.map(function(item) {
    const img = item.imageUrl ? '<img style="width:72px;height:72px;object-fit:cover;border-radius:4px;" src="' + item.imageUrl + '">' : '<div style="width:72px;height:72px;background:#f5f5f5;border-radius:4px;text-align:center;line-height:72px;font-size:22px;">📦</div>';
    const lt = ((item.qty||1)*(item.unitPrice||0)).toLocaleString('en-US',{minimumFractionDigits:2});
    const up = (parseFloat(item.unitPrice)||0).toLocaleString('en-US',{minimumFractionDigits:2});
    return '<tr><td style="padding:10px;">' + img + '</td><td style="padding:10px;"><strong>' + esc(item.description||item.title||'') + '</strong></td><td style="padding:10px;color:#666;">' + esc(item.room||'') + '</td><td style="padding:10px;color:#666;">' + esc(item.vendor||'') + '</td><td style="padding:10px;text-align:center;">' + (item.qty||1) + '</td><td style="padding:10px;text-align:right;">$' + up + '</td><td style="padding:10px;text-align:right;font-weight:600;">$' + lt + '</td></tr>';
  }).join('');
  const totalFmt = total.toLocaleString('en-US',{minimumFractionDigits:2});
  const win = window.open('','_blank');
  win.document.write('<!DOCTYPE html><html><head><title>' + projName + '</title><style>body{font-family:Helvetica,Arial,sans-serif;margin:0;padding:40px;font-size:13px;color:#1a1a1a}.hdr{display:flex;justify-content:space-between;border-bottom:3px solid #00B8D4;padding-bottom:20px;margin-bottom:28px}.logo{font-size:32px;font-weight:800;letter-spacing:6px}.sub{font-size:9px;letter-spacing:5px;color:#999;text-transform:uppercase}.addr{font-size:10px;color:#999;margin-top:6px}.meta{text-align:right}.meta h2{font-size:18px;font-weight:300;letter-spacing:3px;text-transform:uppercase;margin:0}table{width:100%;border-collapse:collapse}th{background:#f5f5f5;padding:9px;text-align:left;font-size:9px;text-transform:uppercase;color:#666;font-weight:600;border-bottom:2px solid #e0e0e0}td{border-bottom:1px solid #f0f0f0;vertical-align:middle}.tot{margin-top:24px;display:flex;justify-content:flex-end}.tot-box{width:280px;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden}.tr{display:flex;justify-content:space-between;padding:8px 14px;font-size:12px}.grand{background:#1a1a1a;color:white;font-weight:700;font-size:14px}.ftr{margin-top:40px;padding-top:16px;border-top:1px solid #eee;font-size:10px;color:#aaa;text-align:center}@media print{body{padding:20px}}</style></head><body>');
  win.document.write('<div class="hdr"><div><div class="logo">CCH</div><div class="sub">Design Inc.</div><div class="addr">2481 N. Riverside Dr. · Santa Ana, CA · www.cchdesign.com · 949.497.7979</div></div><div class="meta"><h2>' + esc(p.name||'Proposal') + '</h2><div>Project: <strong>' + esc(projName) + '</strong></div><div>Date: ' + dateStr + '</div></div></div>');
  win.document.write('<table><thead><tr><th style="width:80px;">Image</th><th>Description</th><th>Room</th><th>Vendor</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Unit Price</th><th style="text-align:right;">Total</th></tr></thead><tbody>' + rows + '</tbody></table>');
  win.document.write('<div class="tot"><div class="tot-box"><div class="tr"><span>Subtotal</span><span>$' + totalFmt + '</span></div><div class="tr grand"><span>TOTAL</span><span>$' + totalFmt + '</span></div></div></div>');
  win.document.write('<div class="ftr">CCH Design Inc. · Valid 30 days · Thank you for your business</div></body></html>');
  win.document.close();
  setTimeout(function(){ win.print(); }, 600);
}

async function showConnectedDocs(projectId, docType, docId, docNumber, anchorEl) {
  const existing = document.getElementById('connectedDocsDropdown');
  if (existing) { existing.remove(); if (existing.dataset.for === docId) return; }
  const dropdown = document.createElement('div');
  dropdown.id = 'connectedDocsDropdown';
  dropdown.dataset.for = docId;
  dropdown.style.cssText = 'position:fixed;background:white;border:1px solid var(--gray-200);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:9999;min-width:220px;padding:8px 0;';
  dropdown.innerHTML = '<div style="padding:6px 14px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--gray-400);">Connected Docs</div><div id="connDocsInner"><div style="padding:6px 14px;font-size:12px;color:var(--gray-400);">Loading...</div></div>';
  document.body.appendChild(dropdown);
  const rect = anchorEl.getBoundingClientRect();
  dropdown.style.top = (rect.bottom + 4) + 'px';
  dropdown.style.left = rect.left + 'px';
  setTimeout(function() { document.addEventListener('click', function h(e) { if (!dropdown.contains(e.target)) { dropdown.remove(); document.removeEventListener('click', h); } }); }, 50);
  try {
    const [proposals, invoices, pos] = await Promise.all([
      db.collection('boards').doc(projectId).collection('proposals').get().catch(function(){return {docs:[]};}),
      db.collection('boards').doc(projectId).collection('invoices').get().catch(function(){return {docs:[]};}),
      db.collection('boards').doc(projectId).collection('purchaseOrders').get().catch(function(){return {docs:[]};})
    ]);
    const allDocs = [];
    proposals.docs.forEach(function(d) { if (d.id !== docId || docType !== 'proposal') allDocs.push({ id:d.id, type:'proposal', label:'📋 '+(d.data().name||d.data().number||'Proposal'), status:d.data().status||'Draft' }); });
    invoices.docs.forEach(function(d) { if (d.id !== docId || docType !== 'invoice') allDocs.push({ id:d.id, type:'invoice', label:'💰 '+(d.data().number||'Invoice'), status:d.data().status||'Draft' }); });
    pos.docs.forEach(function(d) { if (d.id !== docId || docType !== 'po') allDocs.push({ id:d.id, type:'po', label:'📦 '+(d.data().number||'PO'), status:d.data().status||'Draft' }); });
    const sc = {'Draft':'var(--gray-400)','Sent':'var(--gold)','Approved':'var(--green)','Paid':'var(--green)','Ordered':'#0097A7','Received':'var(--green)','Overdue':'var(--red)'};
    const inner = document.getElementById('connDocsInner');
    if (!inner) return;
    if (allDocs.length === 0) { inner.innerHTML = '<div style="padding:6px 14px;font-size:12px;color:var(--gray-400);">No other docs</div>'; return; }
    const groups = { proposal:[], invoice:[], po:[] };
    allDocs.forEach(function(d) { groups[d.type].push(d); });
    function section(label, items) {
      if (!items.length) return '';
      return '<div style="padding:4px 14px 2px;font-size:10px;font-weight:600;color:var(--gray-400);text-transform:uppercase;border-top:1px solid var(--gray-100);">' + label + '</div>' +
        items.map(function(d) { return '<div onclick="closeDropdownAndNavigate(\'' + projectId + '\',\'' + d.type + '\',\'' + d.id + '\')" style="padding:6px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-size:13px;" onmouseover="this.style.background=\'var(--gray-50)\'" onmouseout="this.style.background=\'\'">' + esc(d.label) + '<span style="font-size:10px;padding:2px 6px;border-radius:8px;background:var(--gray-100);color:' + (sc[d.status]||'var(--gray-400)') + ';font-weight:600;">' + esc(d.status) + '</span></div>'; }).join('');
    }
    inner.innerHTML = section('Proposals', groups.proposal) + section('Invoices', groups.invoice) + section('Purchase Orders', groups.po);
  } catch(e) { const inner = document.getElementById('connDocsInner'); if (inner) inner.innerHTML = '<div style="padding:6px 14px;font-size:12px;color:var(--red);">Error</div>'; }
}

function closeDropdownAndNavigate(projectId, type, id) {
  const d = document.getElementById('connectedDocsDropdown'); if (d) d.remove();
  const tabMap = { proposal:'proposals', invoice:'invoices', po:'pos' };
  navigate('#/project/' + projectId + '/' + (tabMap[type]||'proposals'));
}

async function renderClients() {
  setBreadcrumb([{ label: 'Clients' }]);
  setTopbarActions('<button class="btn btn-primary" onclick="showNewClientModal()">+ New Client</button>');
  const T = document.getElementById('contentArea');
  T.innerHTML = '<div style="text-align:center;padding:60px;color:var(--gray-400);">Loading...</div>';
  try {
    const snap = await db.collection('clients').get();
    const clients = [];
    snap.forEach(function(d) { clients.push(Object.assign({ id: d.id }, d.data())); });
    clients.sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
    if (clients.length === 0) {
      T.innerHTML = '<h1 class="page-title">Clients</h1><div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">No clients yet.</div><button class="btn btn-primary" onclick="showNewClientModal()">+ New Client</button></div>';
      return;
    }
    const rows = clients.map(function(c) {
      return '<tr style="border-bottom:1px solid var(--gray-100);cursor:pointer;" onclick="showNewClientModal(\'' + c.id + '\')">' +
        '<td style="padding:12px 16px;font-weight:600;">' + esc(c.name||'—') + '<br><span style="font-size:11px;color:var(--gray-400);">' + esc(c.company||'') + '</span></td>' +
        '<td style="padding:12px 16px;color:var(--gray-500);">' + esc(c.email||'—') + '</td>' +
        '<td style="padding:12px 16px;color:var(--gray-500);">' + esc(c.phone||'—') + '</td>' +
        '<td style="padding:12px 16px;color:var(--gray-400);font-size:12px;">' + esc((c.address||'—').substring(0,40)) + '</td>' +
        '<td style="padding:12px 8px;"><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();showNewClientModal(\'' + c.id + '\')">Edit</button></td></tr>';
    }).join('');
    T.innerHTML = '<h1 class="page-title">Clients</h1><div class="card" style="overflow:hidden;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="border-bottom:2px solid var(--gray-200);"><th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Name</th><th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Email</th><th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Phone</th><th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Address</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  } catch(e) { T.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Error: ' + esc(e.message) + '</div></div>'; }
}

async function showNewClientModal(existingId) {
  let c = {};
  if (existingId) { const d = await db.collection('clients').doc(existingId).get(); if (d.exists) c = d.data(); }
  document.getElementById('modalContainer').innerHTML = \`
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal" style="width:580px;">
        <div class="modal-header"><div class="modal-title">\${existingId?'Edit Client':'New Client'}</div><button class="modal-close" onclick="closeModal()">&times;</button></div>
        <div class="modal-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="form-group"><label class="form-label">Full Name *</label><input class="form-input" id="clName" value="\${escAttr(c.name||'')}"></div>
          <div class="form-group"><label class="form-label">Company</label><input class="form-input" id="clCompany" value="\${escAttr(c.company||'')}"></div>
          <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="clEmail" type="email" value="\${escAttr(c.email||'')}"></div>
          <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="clPhone" value="\${escAttr(c.phone||'')}"></div>
          <div class="form-group" style="grid-column:span 2;"><label class="form-label">Primary Address</label><input class="form-input" id="clAddress" value="\${escAttr(c.address||'')}"></div>
          <div class="form-group" style="grid-column:span 2;"><label class="form-label">Secondary Address</label><input class="form-input" id="clAddress2" value="\${escAttr(c.address2||'')}"></div>
          <div class="form-group" style="grid-column:span 2;"><label class="form-label">Notes</label><textarea class="form-textarea" id="clNotes" rows="2">\${esc(c.notes||'')}</textarea></div>
        </div></div>
        <div class="modal-footer" style="justify-content:space-between;">
          \${existingId ? '<button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:var(--red);" onclick="deleteClient(\\'' + existingId + '\\')">Delete</button>' : '<div></div>'}
          <div style="display:flex;gap:8px;"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveClient(\\'\${existingId||''}\\')">Save Client</button></div>
        </div>
      </div>
    </div>\`;
}

async function saveClient(existingId) {
  const name = document.getElementById('clName').value.trim();
  if (!name) { alert('Name is required.'); return; }
  const data = { name, company:document.getElementById('clCompany').value.trim(), email:document.getElementById('clEmail').value.trim(), phone:document.getElementById('clPhone').value.trim(), address:document.getElementById('clAddress').value.trim(), address2:document.getElementById('clAddress2').value.trim(), notes:document.getElementById('clNotes').value.trim(), updatedAt:new Date().toISOString(), owner:currentUser.email };
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
  setTopbarActions('<button class="btn btn-primary" onclick="showNewVendorModal()">+ New Vendor</button>');
  const T = document.getElementById('contentArea');
  T.innerHTML = '<div style="text-align:center;padding:60px;color:var(--gray-400);">Loading...</div>';
  try {
    const snap = await db.collection('vendors').get();
    const vendors = [];
    snap.forEach(function(d) { vendors.push(Object.assign({ id: d.id }, d.data())); });
    vendors.sort(function(a,b){ return (a.name||'').localeCompare(b.name||''); });
    if (vendors.length === 0) {
      T.innerHTML = '<h1 class="page-title">Vendors</h1><div class="empty-state"><div class="empty-icon">🏭</div><div class="empty-text">No vendors yet.</div><button class="btn btn-primary" onclick="showNewVendorModal()">+ New Vendor</button></div>';
      return;
    }
    const rows = vendors.map(function(v) {
      return '<tr style="border-bottom:1px solid var(--gray-100);cursor:pointer;" onclick="showNewVendorModal(\'' + v.id + '\')">' +
        '<td style="padding:12px 16px;font-weight:600;">' + esc(v.name||'—') + '</td>' +
        '<td style="padding:12px 16px;color:var(--gray-400);font-size:12px;">' + esc(v.type||'—') + '</td>' +
        '<td style="padding:12px 16px;color:var(--gray-500);">' + esc(v.contact||'') + (v.email ? '<br><span style="font-size:11px;">' + esc(v.email) + '</span>' : '') + '</td>' +
        '<td style="padding:12px 16px;color:var(--gray-400);font-size:12px;">' + esc((v.address||'—').substring(0,50)) + '</td>' +
        '<td style="padding:12px 8px;"><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();showNewVendorModal(\'' + v.id + '\')">Edit</button></td></tr>';
    }).join('');
    T.innerHTML = '<h1 class="page-title">Vendors</h1><div class="card" style="overflow:hidden;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="border-bottom:2px solid var(--gray-200);"><th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Vendor</th><th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Type</th><th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Contact</th><th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Address</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  } catch(e) { T.innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Error: ' + esc(e.message) + '</div></div>'; }
}

async function showNewVendorModal(existingId) {
  let v = {};
  if (existingId) { const d = await db.collection('vendors').doc(existingId).get(); if (d.exists) v = d.data(); }
  const typeOpts = ['Showroom','Upholsterer','Window Fabricator','Freight / Receiver','Stone Supplier','Lighting','Furniture','Fabric','Wallcovering','Hardware','Tile / Stone'].map(function(t){ return '<option value="' + t + '">'; }).join('');
  document.getElementById('modalContainer').innerHTML = \`
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal" style="width:620px;">
        <div class="modal-header"><div class="modal-title">\${existingId?'Edit Vendor':'New Vendor'}</div><button class="modal-close" onclick="closeModal()">&times;</button></div>
        <div class="modal-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="form-group"><label class="form-label">Vendor Name *</label><input class="form-input" id="vnName" value="\${escAttr(v.name||'')}"></div>
          <div class="form-group"><label class="form-label">Type</label><input class="form-input" id="vnType" value="\${escAttr(v.type||'')}" list="vnTypeList"><datalist id="vnTypeList">\${typeOpts}</datalist></div>
          <div class="form-group"><label class="form-label">Contact</label><input class="form-input" id="vnContact" value="\${escAttr(v.contact||'')}"></div>
          <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="vnPhone" value="\${escAttr(v.phone||'')}"></div>
          <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="vnEmail" value="\${escAttr(v.email||'')}"></div>
          <div class="form-group"><label class="form-label">Account #</label><input class="form-input" id="vnAccount" value="\${escAttr(v.account||'')}"></div>
          <div class="form-group" style="grid-column:span 2;"><label class="form-label">Ship-To Address</label><input class="form-input" id="vnAddress" value="\${escAttr(v.address||'')}"></div>
          <div class="form-group"><label class="form-label">Lead Time</label><input class="form-input" id="vnLeadTime" value="\${escAttr(v.leadTime||'')}"></div>
          <div class="form-group"><label class="form-label">Website</label><input class="form-input" id="vnWebsite" value="\${escAttr(v.website||'')}"></div>
          <div class="form-group" style="grid-column:span 2;"><label class="form-label">Notes</label><textarea class="form-textarea" id="vnNotes" rows="2">\${esc(v.notes||'')}</textarea></div>
        </div></div>
        <div class="modal-footer" style="justify-content:space-between;">
          \${existingId ? '<button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:var(--red);" onclick="deleteVendor(\\'' + existingId + '\\')">Delete</button>' : '<div></div>'}
          <div style="display:flex;gap:8px;"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveVendor(\\'\${existingId||''}\\')">Save Vendor</button></div>
        </div>
      </div>
    </div>\`;
}

async function saveVendor(existingId) {
  const name = document.getElementById('vnName').value.trim();
  if (!name) { alert('Vendor name is required.'); return; }
  const data = { name, type:document.getElementById('vnType').value.trim(), contact:document.getElementById('vnContact').value.trim(), phone:document.getElementById('vnPhone').value.trim(), email:document.getElementById('vnEmail').value.trim(), website:document.getElementById('vnWebsite').value.trim(), address:document.getElementById('vnAddress').value.trim(), account:document.getElementById('vnAccount').value.trim(), leadTime:document.getElementById('vnLeadTime').value.trim(), notes:document.getElementById('vnNotes').value.trim(), updatedAt:new Date().toISOString(), owner:currentUser.email };
  try {
    if (existingId) { await db.collection('vendors').doc(existingId).update(data); }
    else { data.createdAt = new Date().toISOString(); await db.collection('vendors').add(data); }
    closeModal(); renderVendors();
  } catch(e) { alert('Error: ' + e.message); }
}

async function deleteVendor(id) {
  if (!confirm('Delete this vendor?')) return;
  try { await db.collection('vendors').doc(id).delete(); closeModal(); renderVendors(); } catch(e) { alert('Error: ' + e.message); }
}

async function renderProposalsTab(projectId) {
  try {
    const snap = await db.collection('boards').doc(projectId).collection('proposals').get();
    const proposals = [];
    snap.forEach(function(d) { proposals.push(Object.assign({ id:d.id }, d.data())); });
    proposals.sort(function(a,b){ return (b.createdAt||'').localeCompare(a.createdAt||''); });
    const sc = {'Draft':'var(--gray-400)','Sent':'var(--gold)','Approved':'var(--green)','Declined':'var(--red)'};
    if (proposals.length === 0) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><h2 style="font-size:20px;font-weight:700;">Proposals</h2><button class="btn btn-primary" onclick="showNewProposalBuilder(\\'' + projectId + '\\')">+ New Proposal</button></div><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No proposals yet.</div></div>';
    }
    const rows = proposals.map(function(p) {
      const opts = ['Draft','Sent','Approved','Declined'].map(function(s){ return '<option ' + (p.status===s?'selected':'') + ' value="' + s + '">' + s + '</option>'; }).join('');
      return '<tr style="border-bottom:1px solid var(--gray-100);">' +
        '<td style="padding:12px 16px;font-weight:600;">' + esc(p.name||p.number||'Proposal') + '</td>' +
        '<td style="padding:12px 16px;color:var(--gray-400);">' + (p.items||[]).length + ' items</td>' +
        '<td style="padding:12px 16px;text-align:right;font-weight:600;font-family:monospace;">$' + (parseFloat(p.total)||0).toLocaleString('en-US',{minimumFractionDigits:2}) + '</td>' +
        '<td style="padding:12px 16px;"><select style="font-size:11px;padding:3px 8px;border-radius:10px;border:1px solid var(--gray-200);color:' + (sc[p.status]||'var(--gray-400)') + ';font-weight:600;cursor:pointer;" onchange="updateDocStatus(\\'' + projectId + '\\',\\'proposals\\',\\'' + p.id + '\\',this.value)">' + opts + '</select></td>' +
        '<td style="padding:12px 16px;color:var(--gray-400);font-size:12px;">' + (p.createdAt?new Date(p.createdAt).toLocaleDateString():'—') + '</td>' +
        '<td style="padding:12px 8px;"><div style="display:flex;gap:4px;">' +
          '<button class="btn btn-secondary btn-sm" onclick="showConnectedDocs(\\'' + projectId + '\\',\\'proposal\\',\\'' + p.id + '\\',\\'\\',this)">🔗</button>' +
          '<button class="btn btn-secondary btn-sm" onclick="printProposal(\\'' + projectId + '\\',\\'' + p.id + '\\')">Print</button>' +
          '<button class="btn btn-secondary btn-sm" style="color:var(--red);" onclick="deleteFinanceDoc(\\'' + projectId + '\\',\\'proposals\\',\\'' + p.id + '\\')">🗑</button>' +
        '</div></td></tr>';
    }).join('');
    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><h2 style="font-size:20px;font-weight:700;">Proposals</h2><button class="btn btn-primary" onclick="showNewProposalBuilder(\\'' + projectId + '\\')">+ New Proposal</button></div><div class="card" style="overflow:hidden;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="border-bottom:2px solid var(--gray-200);"><th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Proposal</th><th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Items</th><th style="text-align:right;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Total</th><th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Status</th><th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Date</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  } catch(e) { return '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Error: ' + esc(e.message) + '</div></div>'; }
}

async function renderInvoicesTab(projectId) {
  try {
    const snap = await db.collection('boards').doc(projectId).collection('invoices').get();
    const invoices = [];
    snap.forEach(function(d) { invoices.push(Object.assign({ id:d.id }, d.data())); });
    invoices.sort(function(a,b){ return (b.createdAt||'').localeCompare(a.createdAt||''); });
    const sc = {'Draft':'var(--gray-400)','Sent':'var(--gold)','Paid':'var(--green)','Overdue':'var(--red)','Partial':'#E65100'};
    if (invoices.length === 0) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><h2 style="font-size:20px;font-weight:700;">Invoices</h2><button class="btn btn-primary" onclick="showNewInvoiceModal(\\'' + projectId + '\\')">+ New Invoice</button></div><div class="empty-state"><div class="empty-icon">💰</div><div class="empty-text">No invoices yet.</div></div>';
    }
    const rows = invoices.map(function(inv) {
      const opts = ['Draft','Sent','Paid','Overdue','Partial'].map(function(s){ return '<option ' + (inv.status===s?'selected':'') + ' value="' + s + '">' + s + '</option>'; }).join('');
      return '<tr style="border-bottom:1px solid var(--gray-100);">' +
        '<td style="padding:12px 16px;font-weight:600;font-family:monospace;">' + esc(inv.number||inv.id.substring(0,8)) + '</td>' +
        '<td style="padding:12px 16px;text-align:right;font-weight:600;font-family:monospace;">$' + (parseFloat(inv.total)||0).toLocaleString('en-US',{minimumFractionDigits:2}) + '</td>' +
        '<td style="padding:12px 16px;"><select style="font-size:11px;padding:3px 8px;border-radius:10px;border:1px solid var(--gray-200);color:' + (sc[inv.status]||'var(--gray-400)') + ';font-weight:600;cursor:pointer;" onchange="updateDocStatus(\\'' + projectId + '\\',\\'invoices\\',\\'' + inv.id + '\\',this.value)">' + opts + '</select></td>' +
        '<td style="padding:12px 16px;color:var(--gray-400);font-size:12px;">' + (inv.dueDate?new Date(inv.dueDate).toLocaleDateString():'—') + '</td>' +
        '<td style="padding:12px 8px;"><div style="display:flex;gap:4px;">' +
          '<button class="btn btn-secondary btn-sm" onclick="showConnectedDocs(\\'' + projectId + '\\',\\'invoice\\',\\'' + inv.id + '\\',\\'\\',this)">🔗</button>' +
          '<button class="btn btn-secondary btn-sm" onclick="showEditInvoiceModal(\\'' + projectId + '\\',\\'' + inv.id + '\\')">Edit</button>' +
          '<button class="btn btn-secondary btn-sm" style="color:var(--red);" onclick="deleteFinanceDoc(\\'' + projectId + '\\',\\'invoices\\',\\'' + inv.id + '\\')">🗑</button>' +
        '</div></td></tr>';
    }).join('');
    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><h2 style="font-size:20px;font-weight:700;">Invoices</h2><button class="btn btn-primary" onclick="showNewInvoiceModal(\\'' + projectId + '\\')">+ New Invoice</button></div><div class="card" style="overflow:hidden;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="border-bottom:2px solid var(--gray-200);"><th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Invoice #</th><th style="text-align:right;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Amount</th><th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Status</th><th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Due Date</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  } catch(e) { return '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Error: ' + esc(e.message) + '</div></div>'; }
}

async function renderPOsTab(projectId) {
  try {
    const snap = await db.collection('boards').doc(projectId).collection('purchaseOrders').get();
    const pos = [];
    snap.forEach(function(d) { pos.push(Object.assign({ id:d.id }, d.data())); });
    pos.sort(function(a,b){ return (b.createdAt||'').localeCompare(a.createdAt||''); });
    const sc = {'Draft':'var(--gray-400)','Sent':'var(--gold)','Ordered':'#0097A7','Received':'var(--green)','On Hold':'#6A1B9A','Cancelled':'var(--gray-300)'};
    if (pos.length === 0) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><h2 style="font-size:20px;font-weight:700;">Purchase Orders</h2><button class="btn btn-primary" onclick="showQuickPOModal(\\'' + projectId + '\\')">+ New PO</button></div><div class="empty-state"><div class="empty-icon">📦</div><div class="empty-text">No purchase orders yet.</div></div>';
    }
    const rows = pos.map(function(po) {
      const opts = ['Draft','Sent','Ordered','Received','On Hold','Cancelled'].map(function(s){ return '<option ' + (po.status===s?'selected':'') + ' value="' + s + '">' + s + '</option>'; }).join('');
      return '<tr style="border-bottom:1px solid var(--gray-100);">' +
        '<td style="padding:12px 16px;font-weight:600;font-family:monospace;">' + esc(po.number||po.id.substring(0,8)) + '</td>' +
        '<td style="padding:12px 16px;font-weight:500;">' + esc(po.vendor||'—') + '</td>' +
        '<td style="padding:12px 16px;text-align:right;font-weight:600;font-family:monospace;">$' + (parseFloat(po.total)||0).toLocaleString('en-US',{minimumFractionDigits:2}) + '</td>' +
        '<td style="padding:12px 16px;"><select style="font-size:11px;padding:3px 8px;border-radius:10px;border:1px solid var(--gray-200);color:' + (sc[po.status]||'var(--gray-400)') + ';font-weight:600;cursor:pointer;" onchange="updateDocStatus(\\'' + projectId + '\\',\\'purchaseOrders\\',\\'' + po.id + '\\',this.value)">' + opts + '</select></td>' +
        '<td style="padding:12px 16px;color:var(--gray-400);font-size:12px;">' + esc(po.eta||'—') + '</td>' +
        '<td style="padding:12px 8px;"><div style="display:flex;gap:4px;">' +
          '<button class="btn btn-secondary btn-sm" onclick="showConnectedDocs(\\'' + projectId + '\\',\\'po\\',\\'' + po.id + '\\',\\'\\',this)">🔗</button>' +
          '<button class="btn btn-secondary btn-sm" onclick="showEditPOModal(\\'' + projectId + '\\',\\'' + po.id + '\\')">Edit</button>' +
          '<button class="btn btn-secondary btn-sm" style="color:var(--red);" onclick="deleteFinanceDoc(\\'' + projectId + '\\',\\'purchaseOrders\\',\\'' + po.id + '\\')">🗑</button>' +
        '</div></td></tr>';
    }).join('');
    return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;"><h2 style="font-size:20px;font-weight:700;">Purchase Orders</h2><button class="btn btn-primary" onclick="showQuickPOModal(\\'' + projectId + '\\')">+ New PO</button></div><div class="card" style="overflow:hidden;"><table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="border-bottom:2px solid var(--gray-200);"><th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">PO #</th><th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Vendor</th><th style="text-align:right;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Total</th><th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Status</th><th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">ETA</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
  } catch(e) { return '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Error: ' + esc(e.message) + '</div></div>'; }
}

async function showNewProposalBuilder(projectId) {
  const T = document.getElementById('modalContainer');
  T.innerHTML = '<div style="text-align:center;padding:60px;">Loading...</div>';
  let clips = [];
  const services = [
    { id:'svc1', name:'Design Fee', unit:'hr', price:175 },
    { id:'svc2', name:'Consultation', unit:'hr', price:175 },
    { id:'svc3', name:'Installation Supervision', unit:'hr', price:125 },
    { id:'svc4', name:'Project Management', unit:'flat', price:0 },
    { id:'svc5', name:'Procurement Fee (20%)', unit:'pct', price:20 }
  ];
  try { const s = await db.collection('boards').doc(projectId).collection('clips').get(); s.forEach(function(d){ clips.push(Object.assign({id:d.id},d.data())); }); } catch(e){}
  let items = [];
  let tab = 'project';
  let propName = 'Proposal ' + new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});

  function libHTML(t, q) {
    q = (q||'').toLowerCase();
    if (t === 'project') {
      const f = clips.filter(function(c){ return !q||(c.title||'').toLowerCase().includes(q)||(c.vendor||'').toLowerCase().includes(q); });
      if (!f.length) return '<div style="text-align:center;padding:24px;color:var(--gray-400);">No items found</div>';
      return f.map(function(c) {
        const p = parseFloat((c.clientPrice||'').replace(/[^0-9.]/g,''))||0;
        const img = c.imageUrl ? '<img src="' + escAttr(c.imageUrl) + '" style="width:40px;height:40px;object-fit:cover;border-radius:4px;flex-shrink:0;">' : '<div style="width:40px;height:40px;background:var(--gray-100);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">📦</div>';
        return '<div onclick="window._addClip(\\'' + c.id + '\\')" style="display:flex;gap:8px;padding:8px;border:1px solid var(--gray-200);border-radius:6px;margin-bottom:4px;cursor:pointer;" onmouseover="this.style.borderColor=\'var(--gold)\'" onmouseout="this.style.borderColor=\'var(--gray-200)\'">' + img + '<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(c.title||'Untitled') + '</div><div style="font-size:11px;color:var(--gray-400);">' + esc(c.vendor||'') + '</div></div><div style="font-size:12px;font-weight:700;color:var(--gold);flex-shrink:0;">' + (p ? '$'+p.toFixed(2) : '—') + '</div></div>';
      }).join('');
    } else {
      const f = services.filter(function(s){ return !q||s.name.toLowerCase().includes(q); });
      return f.map(function(s) {
        return '<div onclick="window._addSvc(\\'' + s.id + '\\')" style="display:flex;gap:8px;padding:8px;border:1px solid var(--gray-200);border-radius:6px;margin-bottom:4px;cursor:pointer;" onmouseover="this.style.borderColor=\'var(--gold)\'" onmouseout="this.style.borderColor=\'var(--gray-200)\'"><div style="width:40px;height:40px;background:var(--gray-100);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;">⚙️</div><div style="flex:1;"><div style="font-size:12px;font-weight:600;">' + esc(s.name) + '</div><div style="font-size:11px;color:var(--gray-400);">' + (s.unit==='hr'?'per hour':s.unit==='pct'?s.price+'%':'flat') + '</div></div><div style="font-size:12px;font-weight:700;color:var(--gold);flex-shrink:0;">' + (s.unit==='pct'?s.price+'%':s.price?'$'+s.price.toFixed(2):'—') + '</div></div>';
      }).join('');
    }
  }

  function render() {
    const sub = items.reduce(function(s,i){ return s+(parseFloat(i.lineTotal)||0); }, 0);
    const leftItems = items.length === 0
      ? '<div style="text-align:center;padding:40px;color:var(--gray-400);"><div style="font-size:32px;margin-bottom:8px;">👈</div><div>Click items on the right to add them</div></div>'
      : items.map(function(item, i) {
          const imgEl = item.imageUrl ? '<img src="' + escAttr(item.imageUrl) + '" style="width:48px;height:48px;object-fit:cover;border-radius:4px;flex-shrink:0;">' : '<div style="width:48px;height:48px;background:var(--gray-100);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;">' + (item.type==='expense'?'💸':'⚙️') + '</div>';
          return '<div style="display:flex;gap:8px;padding:8px;border:1px solid var(--gray-200);border-radius:8px;margin-bottom:6px;background:white;align-items:flex-start;">' + imgEl +
            '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(item.title) + '</div>' +
            '<div style="display:flex;gap:6px;margin-top:4px;align-items:center;">' +
            '<input type="number" value="' + item.qty + '" min="0.01" step="0.01" style="width:52px;padding:3px 6px;border:1px solid var(--gray-200);border-radius:4px;font-size:12px;" onchange="window._items[' + i + '].qty=parseFloat(this.value)||1;window._items[' + i + '].lineTotal=window._items[' + i + '].qty*window._items[' + i + '].unitPrice;window._render()">' +
            '<span style="font-size:11px;color:var(--gray-400);">' + (item.unit||'ea') + ' ×</span>' +
            '<input type="number" value="' + item.unitPrice + '" min="0" step="0.01" style="width:80px;padding:3px 6px;border:1px solid var(--gray-200);border-radius:4px;font-size:12px;" onchange="window._items[' + i + '].unitPrice=parseFloat(this.value)||0;window._items[' + i + '].lineTotal=window._items[' + i + '].qty*window._items[' + i + '].unitPrice;window._render()">' +
            '</div></div>' +
            '<div style="text-align:right;flex-shrink:0;"><div style="font-size:13px;font-weight:700;color:var(--gold);">$' + ((item.qty||1)*(item.unitPrice||0)).toFixed(2) + '</div>' +
            '<button onclick="window._items.splice(' + i + ',1);window._render()" style="background:none;border:none;color:var(--gray-300);cursor:pointer;font-size:16px;">✕</button></div></div>';
        }).join('');

    T.innerHTML = '<div class="modal-overlay"><div class="modal" style="width:95vw;max-width:1200px;height:90vh;display:flex;flex-direction:column;">' +
      '<div class="modal-header" style="flex-shrink:0;"><div style="display:flex;align-items:center;gap:16px;flex:1;"><div class="modal-title">📋 New Proposal</div><input class="form-input" style="width:280px;" id="pnInput" value="' + escAttr(propName) + '" oninput="window._pname=this.value"></div><button class="modal-close" onclick="closeModal()">&times;</button></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;flex:1;overflow:hidden;border-top:1px solid var(--gray-200);">' +
        '<div style="display:flex;flex-direction:column;border-right:2px solid var(--gray-200);overflow:hidden;">' +
          '<div style="padding:10px 16px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);font-weight:600;font-size:11px;text-transform:uppercase;color:var(--gray-500);display:flex;justify-content:space-between;align-items:center;"><span>Proposal Items (' + items.length + ')</span><button class="btn btn-secondary btn-sm" onclick="window._addExp()">+ Expense</button></div>' +
          '<div style="flex:1;overflow-y:auto;padding:8px;">' + leftItems + '</div>' +
          '<div style="padding:12px 16px;border-top:2px solid var(--gray-200);background:var(--gray-50);"><div style="display:flex;justify-content:space-between;font-size:18px;font-weight:700;"><span>Total</span><span style="color:var(--gold);">$' + sub.toFixed(2) + '</span></div><button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="window._save(\\'' + projectId + '\\')">Save Proposal</button></div>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;overflow:hidden;">' +
          '<div style="display:flex;border-bottom:1px solid var(--gray-200);">' +
            '<button onclick="window._tab(\'project\')" style="flex:1;padding:10px 4px;border:none;border-bottom:3px solid ' + (tab==='project'?'var(--gold)':'transparent') + ';background:' + (tab==='project'?'white':'var(--gray-50)') + ';font-size:12px;font-weight:' + (tab==='project'?'700':'400') + ';color:' + (tab==='project'?'var(--gold)':'var(--gray-500)') + ';cursor:pointer;">🏠 Project Items</button>' +
            '<button onclick="window._tab(\'services\')" style="flex:1;padding:10px 4px;border:none;border-bottom:3px solid ' + (tab==='services'?'var(--gold)':'transparent') + ';background:' + (tab==='services'?'white':'var(--gray-50)') + ';font-size:12px;font-weight:' + (tab==='services'?'700':'400') + ';color:' + (tab==='services'?'var(--gold)':'var(--gray-500)') + ';cursor:pointer;">⚙️ Services</button>' +
          '</div>' +
          '<div style="padding:8px 12px;border-bottom:1px solid var(--gray-200);"><input class="form-input" style="font-size:12px;" placeholder="Search..." oninput="document.getElementById(\'libDiv\').innerHTML=window._lib(window._tab_,this.value)"></div>' +
          '<div style="flex:1;overflow-y:auto;padding:8px;" id="libDiv">' + libHTML(tab,'') + '</div>' +
        '</div>' +
      '</div></div></div>';

    window._items = items;
    window._pname = propName;
    window._tab_ = tab;
    window._render = render;
    window._lib = libHTML;
    window._tab = function(t) { tab = t; window._tab_ = t; render(); };
    window._addClip = function(id) {
      const c = clips.find(function(x){ return x.id===id; });
      if (!c) return;
      const p = parseFloat((c.clientPrice||'').replace(/[^0-9.]/g,''))||0;
      items.push({ type:'product', id:id, title:c.title, vendor:c.vendor||'', room:c.room||'', imageUrl:c.imageUrl||null, qty:1, unit:'ea', unitPrice:p, lineTotal:p });
      render();
    };
    window._addSvc = function(id) {
      const s = services.find(function(x){ return x.id===id; });
      if (!s) return;
      items.push({ type:'service', id:id, title:s.name, unit:s.unit||'hr', qty:1, unitPrice:s.price||0, lineTotal:s.price||0 });
      render();
    };
    window._addExp = function() {
      const types = ['Freight','Shipping','Sales Tax Pre-paid','Storage','Misc Expense'];
      const pick = prompt('Expense type:\\n' + types.map(function(t,i){ return (i+1)+'. '+t; }).join('\\n') + '\\n\\nOr type your own:');
      if (!pick) return;
      const name = types[parseInt(pick)-1] || pick;
      items.push({ type:'expense', title:name, qty:1, unit:'flat', unitPrice:0, lineTotal:0 });
      render();
    };
    window._save = async function(pid) {
      const name = window._pname || propName;
      if (items.length === 0) { alert('Add at least one item.'); return; }
      const total = items.reduce(function(s,i){ return s+(parseFloat(i.lineTotal)||0); }, 0);
      try {
        await db.collection('boards').doc(pid).collection('proposals').add({
          name: name, number: 'PROP-'+Date.now().toString().slice(-6),
          items: items.map(function(i){ return { description:i.title, qty:i.qty||1, unitPrice:i.unitPrice||0, lineTotal:i.lineTotal||0, vendor:i.vendor||'', room:i.room||'', type:i.type||'product', unit:i.unit||'ea', imageUrl:i.imageUrl||null }; }),
          total: total, status: 'Draft', createdAt: new Date().toISOString(), owner: currentUser.email
        });
        closeModal();
        navigate('#/project/'+pid+'/proposals');
      } catch(e) { alert('Error: ' + e.message); }
    };
  }
  render();
}

console.log('✅ CCH Functions loaded');
`;

fs.writeFileSync('platform/cch-functions.js', content);
console.log('✅ cch-functions.js written correctly. Size:', content.length, 'bytes');
