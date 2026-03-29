const fs = require('fs');
let t = fs.readFileSync('platform/index.html', 'utf8');
const orig = t.length;

// ── PATCH 2: Clients + Vendors in sidebar ──────────────────────────────────
if (!t.includes('data-page="clients"')) {
  t = t.replace(
    '<button class="nav-item" data-page="library">',
    `<button class="nav-item" data-page="clients">
          <span class="nav-icon">👥</span><span class="nav-label">Clients</span>
        </button>
        <button class="nav-item" data-page="vendors">
          <span class="nav-icon">🏭</span><span class="nav-label">Vendors</span>
        </button>
        <button class="nav-item" data-page="library">`
  );
  console.log('✓ Sidebar: Clients + Vendors added');
} else { console.log('- Sidebar already patched'); }

// ── Router entries ─────────────────────────────────────────────────────────
if (!t.includes("case 'clients':")) {
  t = t.replace(
    "case 'library': renderProductLibrary(); break;",
    `case 'clients': renderClients(); break;
        case 'vendors': renderVendors(); break;
        case 'library': renderProductLibrary(); break;`
  );
  console.log('✓ Router: clients + vendors routes added');
}

// ── PATCH 2: createNewBoard ────────────────────────────────────────────────
if (!t.includes('async function createNewBoard')) {
  t = t.replace(
    'async function renderBoardsTab(projectId) {',
    `async function createNewBoard(projectId) {
      const name = prompt('Board name (e.g. "Master Bedroom", "Living Room"):');
      if (!name || !name.trim()) return;
      try {
        const boardId = projectId + '-' + name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') + '-' + Date.now().toString().slice(-4);
        await db.collection('boards').doc(boardId).set({
          name: name.trim(), projectId, clipCount: 0,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          owner: currentUser.email, status: 'In Progress'
        });
        navigate('#/project/' + projectId + '/boards');
      } catch(e) { alert('Error creating board: ' + e.message); }
    }

    async function renderBoardsTab(projectId) {`
  );
  console.log('✓ createNewBoard function added');
}

// ── Boards topbar with New Board button ────────────────────────────────────
t = t.replace(
  `setTopbarActions('<button class="btn btn-primary" onclick="showImportModal()">Import Houzz</button>');`,
  `setTopbarActions('<button class="btn btn-secondary" onclick="showNewProposalBuilder(\'' + projectId + '\')" style="margin-right:8px;">📋 New Proposal</button><button class="btn btn-secondary" onclick="showImportModal()" style="margin-right:8px;">Import Houzz</button><button class="btn btn-primary" onclick="createNewBoard(\'' + projectId + '\')">+ New Room Board</button>');`
);

// ── FINANCE HELPERS ────────────────────────────────────────────────────────
const financeHelpers = `
    // ==================== FINANCE HELPERS ====================
    async function updateDocStatus(projectId, collection, docId, newStatus) {
      try {
        await db.collection('boards').doc(projectId).collection(collection).doc(docId).update({ status: newStatus, updatedAt: new Date().toISOString() });
      } catch(e) { alert('Error updating status: ' + e.message); }
    }

    async function deleteFinanceDoc(projectId, collection, docId) {
      const labels = { proposals:'proposal', invoices:'invoice', purchaseOrders:'PO' };
      if (!confirm('Delete this ' + (labels[collection]||'document') + '? This cannot be undone.')) return;
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
            <div class="modal-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div class="form-group"><label class="form-label">Invoice #</label><input class="form-input" id="niNumber" placeholder="INV-\${Date.now().toString().slice(-6)}"></div>
                <div class="form-group"><label class="form-label">Total ($)</label><input class="form-input" type="number" id="niTotal" placeholder="0.00"></div>
                <div class="form-group"><label class="form-label">Status</label><select class="form-input" id="niStatus"><option value="Draft">Draft</option><option value="Sent" selected>Sent</option><option value="Paid">Paid</option><option value="Overdue">Overdue</option></select></div>
                <div class="form-group"><label class="form-label">Due Date</label><input class="form-input" type="date" id="niDue"></div>
                <div class="form-group" style="grid-column:span 2;"><label class="form-label">Notes</label><textarea class="form-textarea" id="niNotes" rows="2"></textarea></div>
              </div>
            </div>
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
      const doc = await db.collection('boards').doc(projectId).collection('invoices').doc(invId).get();
      if (!doc.exists) return;
      const inv = doc.data();
      document.getElementById('modalContainer').innerHTML = \`
        <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
          <div class="modal" style="width:560px;">
            <div class="modal-header"><div class="modal-title">Edit Invoice</div><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div class="form-group"><label class="form-label">Invoice #</label><input class="form-input" id="eiNumber" value="\${escAttr(inv.number||'')}"></div>
                <div class="form-group"><label class="form-label">Total ($)</label><input class="form-input" type="number" id="eiTotal" value="\${inv.total||0}"></div>
                <div class="form-group"><label class="form-label">Status</label><select class="form-input" id="eiStatus">\${['Draft','Sent','Paid','Overdue','Partial'].map(s=>\`<option \${inv.status===s?'selected':''} value="\${s}">\${s}</option>\`).join('')}</select></div>
                <div class="form-group"><label class="form-label">Due Date</label><input class="form-input" type="date" id="eiDue" value="\${escAttr(inv.dueDate||'')}"></div>
                <div class="form-group" style="grid-column:span 2;"><label class="form-label">Notes</label><textarea class="form-textarea" id="eiNotes" rows="2">\${esc(inv.notes||'')}</textarea></div>
              </div>
            </div>
            <div class="modal-footer" style="justify-content:space-between;">
              <button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:var(--red);" onclick="deleteFinanceDoc('\${projectId}','invoices','\${invId}');closeModal();">🗑 Delete</button>
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
      const doc = await db.collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
      if (!doc.exists) { alert('PO not found'); return; }
      const po = doc.data();
      document.getElementById('modalContainer').innerHTML = \`
        <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
          <div class="modal" style="width:620px;">
            <div class="modal-header"><div class="modal-title">Edit Purchase Order</div><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <div class="form-group"><label class="form-label">PO Number</label><input class="form-input" id="epNumber" value="\${escAttr(po.number||'')}"></div>
                <div class="form-group"><label class="form-label">Vendor</label><input class="form-input" id="epVendor" value="\${escAttr(po.vendor||'')}"></div>
                <div class="form-group"><label class="form-label">Total ($)</label><input class="form-input" type="number" id="epTotal" value="\${po.total||0}"></div>
                <div class="form-group"><label class="form-label">Status</label><select class="form-input" id="epStatus">\${['Draft','Sent','Ordered','Received','On Hold','Cancelled'].map(s=>\`<option \${po.status===s?'selected':''} value="\${s}">\${s}</option>\`).join('')}</select></div>
                <div class="form-group"><label class="form-label">ETA</label><input class="form-input" id="epEta" value="\${escAttr(po.eta||'')}"></div>
                <div class="form-group"><label class="form-label">Ship To</label><input class="form-input" id="epShipTo" value="\${escAttr(po.shipTo||'')}"></div>
                <div class="form-group" style="grid-column:span 2;"><label class="form-label">Description</label><textarea class="form-textarea" id="epDesc" rows="3">\${esc(po.description||'')}</textarea></div>
                <div class="form-group" style="grid-column:span 2;"><label class="form-label">Notes</label><input class="form-input" id="epNotes" value="\${escAttr(po.notes||'')}"></div>
              </div>
            </div>
            <div class="modal-footer" style="justify-content:space-between;">
              <button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:var(--red);" onclick="deleteFinanceDoc('\${projectId}','purchaseOrders','\${poId}');closeModal();">🗑 Delete</button>
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
      const doc = await db.collection('boards').doc(projectId).collection('proposals').doc(proposalId).get();
      const proj = await db.collection('boards').doc(projectId).get();
      if (!doc.exists) return;
      const p = doc.data();
      const projName = proj.exists ? (proj.data().name || projectId) : projectId;
      const items = p.items || [];
      const total = parseFloat(p.total)||0;
      const win = window.open('', '_blank');
      win.document.write(\`<!DOCTYPE html><html><head><title>\${projName} - \${p.name||'Proposal'}</title>
      <style>
        body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a1a;margin:0;padding:40px;font-size:13px;}
        .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #00B8D4;padding-bottom:20px;margin-bottom:28px;}
        .logo-cch{font-size:32px;font-weight:800;letter-spacing:6px;color:#1a1a1a;}
        .logo-sub{font-size:9px;letter-spacing:5px;color:#999;text-transform:uppercase;margin-top:2px;}
        .logo-addr{font-size:10px;color:#999;margin-top:6px;}
        .prop-meta{text-align:right;}
        .prop-meta h2{font-size:18px;font-weight:300;letter-spacing:3px;text-transform:uppercase;color:#1a1a1a;margin:0 0 4px;}
        .prop-meta div{font-size:11px;color:#666;margin-bottom:2px;}
        table{width:100%;border-collapse:collapse;margin-top:8px;}
        th{background:#f5f5f5;padding:9px 10px;text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:#666;font-weight:600;border-bottom:2px solid #e0e0e0;}
        td{padding:10px;border-bottom:1px solid #f0f0f0;vertical-align:middle;}
        .item-img{width:72px;height:72px;object-fit:cover;border-radius:4px;}
        .img-placeholder{width:72px;height:72px;background:#f5f5f5;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:22px;}
        .total-section{margin-top:24px;display:flex;justify-content:flex-end;}
        .total-box{width:280px;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;}
        .total-row{display:flex;justify-content:space-between;padding:8px 14px;font-size:12px;}
        .total-row.grand{background:#1a1a1a;color:white;font-weight:700;font-size:14px;}
        .footer{margin-top:40px;padding-top:16px;border-top:1px solid #eee;font-size:10px;color:#aaa;text-align:center;}
        @media print{body{padding:20px;}}
      </style></head><body>
      <div class="header">
        <div>
          <div class="logo-cch">CCH</div>
          <div class="logo-sub">Design Inc.</div>
          <div class="logo-addr">2481 N. Riverside Dr. · Santa Ana, CA · www.cchdesign.com · 949.497.7979</div>
        </div>
        <div class="prop-meta">
          <h2>\${esc(p.name||'Proposal')}</h2>
          <div>Project: <strong>\${esc(projName)}</strong></div>
          <div>Date: \${p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : new Date().toLocaleDateString()}</div>
          <div style="margin-top:6px;padding:3px 10px;border-radius:10px;background:#f0f0f0;display:inline-block;font-size:10px;font-weight:600;">\${esc(p.status||'Draft')}</div>
        </div>
      </div>
      <table>
        <thead><tr><th style="width:80px;">Image</th><th>Item / Description</th><th>Room</th><th>Vendor</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Unit Price</th><th style="text-align:right;">Total</th></tr></thead>
        <tbody>
          \${items.map(item => \`<tr>
            <td>\${item.imageUrl ? \`<img class="item-img" src="\${item.imageUrl}">\` : '<div class="img-placeholder">📦</div>'}</td>
            <td><strong>\${esc(item.description||item.title||'')}</strong>\${item.notes?'<br><span style="font-size:11px;color:#888;">'+esc(item.notes)+'</span>':''}</td>
            <td style="color:#666;">\${esc(item.room||'')}</td>
            <td style="color:#666;">\${esc(item.vendor||'')}</td>
            <td style="text-align:center;">\${item.qty||1} \${esc(item.unit||'ea')}</td>
            <td style="text-align:right;">$\${(parseFloat(item.unitPrice)||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
            <td style="text-align:right;font-weight:600;">$\${(parseFloat(item.lineTotal)||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
          </tr>\`).join('')}
        </tbody>
      </table>
      <div class="total-section">
        <div class="total-box">
          <div class="total-row"><span>Subtotal</span><span>$\${total.toLocaleString('en-US',{minimumFractionDigits:2})}</span></div>
          <div class="total-row grand"><span>TOTAL</span><span>$\${total.toLocaleString('en-US',{minimumFractionDigits:2})}</span></div>
        </div>
      </div>
      <div class="footer">CCH Design Inc. · This proposal is valid for 30 days from the date above · Thank you for your business</div>
      </body></html>\`);
      win.document.close();
      setTimeout(() => win.print(), 600);
    }

`;

// ── CONNECTED DOCS ─────────────────────────────────────────────────────────
const connectedDocs = `
    // ==================== CONNECTED DOCS ====================
    async function showConnectedDocs(projectId, docType, docId, docNumber, anchorEl) {
      const existing = document.getElementById('connectedDocsDropdown');
      if (existing) { existing.remove(); if (existing.dataset.for === docId) return; }
      const dropdown = document.createElement('div');
      dropdown.id = 'connectedDocsDropdown';
      dropdown.dataset.for = docId;
      dropdown.style.cssText = 'position:fixed;background:white;border:1px solid var(--gray-200);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:9999;min-width:220px;padding:8px 0;';
      dropdown.innerHTML = '<div style="padding:6px 14px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--gray-400);letter-spacing:0.08em;">Connected Docs</div><div id="connDocsInner"><div style="padding:6px 14px;font-size:12px;color:var(--gray-400);">Loading...</div></div>';
      document.body.appendChild(dropdown);
      const rect = anchorEl.getBoundingClientRect();
      dropdown.style.top = (rect.bottom + 4) + 'px';
      dropdown.style.left = rect.left + 'px';
      setTimeout(() => document.addEventListener('click', function h(e) { if (!dropdown.contains(e.target)) { dropdown.remove(); document.removeEventListener('click', h); } }), 50);
      try {
        const [proposals, invoices, pos] = await Promise.all([
          db.collection('boards').doc(projectId).collection('proposals').get().catch(()=>({docs:[]})),
          db.collection('boards').doc(projectId).collection('invoices').get().catch(()=>({docs:[]})),
          db.collection('boards').doc(projectId).collection('purchaseOrders').get().catch(()=>({docs:[]}))
        ]);
        const allDocs = [];
        proposals.docs.forEach(d => { if (d.id !== docId || docType !== 'proposal') allDocs.push({ id:d.id, type:'proposal', label:'📋 '+(d.data().name||d.data().number||'Proposal'), status:d.data().status||'Draft' }); });
        invoices.docs.forEach(d => { if (d.id !== docId || docType !== 'invoice') allDocs.push({ id:d.id, type:'invoice', label:'💰 '+(d.data().number||'Invoice'), status:d.data().status||'Draft' }); });
        pos.docs.forEach(d => { if (d.id !== docId || docType !== 'po') allDocs.push({ id:d.id, type:'po', label:'📦 '+(d.data().number||'PO'), status:d.data().status||'Draft' }); });
        const sc = { 'Draft':'var(--gray-400)','Sent':'var(--gold)','Approved':'var(--green)','Paid':'var(--green)','Ordered':'#0097A7','Received':'var(--green)','Overdue':'var(--red)' };
        const inner = document.getElementById('connDocsInner');
        if (!inner) return;
        if (allDocs.length === 0) { inner.innerHTML = '<div style="padding:6px 14px;font-size:12px;color:var(--gray-400);">No other docs in this project</div>'; return; }
        const groups = { proposal:[], invoice:[], po:[] };
        allDocs.forEach(d => groups[d.type].push(d));
        let html = '';
        const section = (label, items) => items.length ? \`<div style="padding:4px 14px 2px;font-size:10px;font-weight:600;color:var(--gray-400);text-transform:uppercase;border-top:1px solid var(--gray-100);">\${label}</div>\${items.map(d=>\`<div onclick="closeDropdownAndNavigate('\${projectId}','\${d.type}','\${d.id}')" style="padding:6px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;font-size:13px;" onmouseover="this.style.background='var(--gray-50)'" onmouseout="this.style.background=''">\${esc(d.label)}<span style="font-size:10px;padding:2px 6px;border-radius:8px;background:var(--gray-100);color:\${sc[d.status]||'var(--gray-400)'};font-weight:600;">\${esc(d.status)}</span></div>\`).join('')}\` : '';
        html = section('Proposals', groups.proposal) + section('Invoices', groups.invoice) + section('Purchase Orders', groups.po);
        inner.innerHTML = html;
      } catch(e) { const inner = document.getElementById('connDocsInner'); if (inner) inner.innerHTML = '<div style="padding:6px 14px;font-size:12px;color:var(--red);">Error</div>'; }
    }

    function closeDropdownAndNavigate(projectId, type, id) {
      const d = document.getElementById('connectedDocsDropdown'); if (d) d.remove();
      const tabMap = { proposal:'proposals', invoice:'invoices', po:'pos' };
      navigate('#/project/' + projectId + '/' + (tabMap[type]||'proposals'));
    }

`;

// ── CLIENTS ────────────────────────────────────────────────────────────────
const clientsVendors = `
    // ==================== CLIENTS ====================
    async function renderClients() {
      setBreadcrumb([{ label: 'Clients' }]);
      setTopbarActions('<button class="btn btn-primary" onclick="showNewClientModal()">+ New Client</button>');
      const T = document.getElementById('contentArea');
      T.innerHTML = '<div style="text-align:center;padding:60px;color:var(--gray-400);">Loading...</div>';
      try {
        const snap = await db.collection('clients').get();
        const clients = [];
        snap.forEach(d => clients.push({ id: d.id, ...d.data() }));
        clients.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
        T.innerHTML = \`<h1 class="page-title">Clients</h1>
          \${clients.length === 0 ? \`<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-text">No clients yet.</div><button class="btn btn-primary" onclick="showNewClientModal()">+ New Client</button></div>\`
          : \`<div class="card" style="overflow:hidden;"><table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="border-bottom:2px solid var(--gray-200);">
              <th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Name</th>
              <th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Email</th>
              <th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Phone</th>
              <th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Address</th>
              <th style="padding:12px 8px;"></th>
            </tr></thead>
            <tbody>\${clients.map(c=>\`<tr style="border-bottom:1px solid var(--gray-100);cursor:pointer;" onclick="showNewClientModal('\${c.id}')">
              <td style="padding:12px 16px;font-weight:600;">\${esc(c.name||'—')}<br><span style="font-size:11px;color:var(--gray-400);">\${esc(c.company||'')}</span></td>
              <td style="padding:12px 16px;color:var(--gray-500);">\${esc(c.email||'—')}</td>
              <td style="padding:12px 16px;color:var(--gray-500);">\${esc(c.phone||'—')}</td>
              <td style="padding:12px 16px;color:var(--gray-400);font-size:12px;">\${esc((c.address||'—').substring(0,40))}</td>
              <td style="padding:12px 8px;"><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();showNewClientModal('\${c.id}')">Edit</button></td>
            </tr>\`).join('')}</tbody></table></div>\`}\`;
      } catch(e) { T.innerHTML = \`<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Error: \${esc(e.message)}</div></div>\`; }
    }

    async function showNewClientModal(existingId) {
      let c = {};
      if (existingId) { const doc = await db.collection('clients').doc(existingId).get(); if (doc.exists) c = doc.data(); }
      document.getElementById('modalContainer').innerHTML = \`
        <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
          <div class="modal" style="width:580px;">
            <div class="modal-header"><div class="modal-title">\${existingId?'Edit Client':'New Client'}</div><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div class="form-group"><label class="form-label">Full Name *</label><input class="form-input" id="clName" value="\${escAttr(c.name||'')}"></div>
              <div class="form-group"><label class="form-label">Company</label><input class="form-input" id="clCompany" value="\${escAttr(c.company||'')}"></div>
              <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="clEmail" type="email" value="\${escAttr(c.email||'')}"></div>
              <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="clPhone" value="\${escAttr(c.phone||'')}"></div>
              <div class="form-group" style="grid-column:span 2;"><label class="form-label">Primary Address</label><input class="form-input" id="clAddress" value="\${escAttr(c.address||'')}" placeholder="Street, City, State, ZIP"></div>
              <div class="form-group" style="grid-column:span 2;"><label class="form-label">Secondary Address</label><input class="form-input" id="clAddress2" value="\${escAttr(c.address2||'')}" placeholder="Vacation home, ranch, etc."></div>
              <div class="form-group" style="grid-column:span 2;"><label class="form-label">Notes</label><textarea class="form-textarea" id="clNotes" rows="2">\${esc(c.notes||'')}</textarea></div>
            </div></div>
            <div class="modal-footer" style="justify-content:space-between;">
              \${existingId?\`<button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:var(--red);" onclick="deleteClient('\${existingId}')">🗑 Delete</button>\`:'<div></div>'}
              <div style="display:flex;gap:8px;"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveClient('\${existingId||''}')">Save Client</button></div>
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

    // ==================== VENDORS ====================
    async function renderVendors() {
      setBreadcrumb([{ label: 'Vendors' }]);
      setTopbarActions('<button class="btn btn-primary" onclick="showNewVendorModal()">+ New Vendor</button>');
      const T = document.getElementById('contentArea');
      T.innerHTML = '<div style="text-align:center;padding:60px;color:var(--gray-400);">Loading...</div>';
      try {
        const snap = await db.collection('vendors').get();
        const vendors = [];
        snap.forEach(d => vendors.push({ id: d.id, ...d.data() }));
        vendors.sort((a,b)=>(a.name||'').localeCompare(b.name||''));
        T.innerHTML = \`<h1 class="page-title">Vendors</h1>
          \${vendors.length === 0 ? \`<div class="empty-state"><div class="empty-icon">🏭</div><div class="empty-text">No vendors yet.</div><button class="btn btn-primary" onclick="showNewVendorModal()">+ New Vendor</button></div>\`
          : \`<div class="card" style="overflow:hidden;"><table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="border-bottom:2px solid var(--gray-200);">
              <th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Vendor</th>
              <th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Type</th>
              <th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Contact</th>
              <th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Ship-To Address</th>
              <th style="padding:12px 8px;"></th>
            </tr></thead>
            <tbody>\${vendors.map(v=>\`<tr style="border-bottom:1px solid var(--gray-100);cursor:pointer;" onclick="showNewVendorModal('\${v.id}')">
              <td style="padding:12px 16px;font-weight:600;">\${esc(v.name||'—')}</td>
              <td style="padding:12px 16px;color:var(--gray-400);font-size:12px;">\${esc(v.type||'—')}</td>
              <td style="padding:12px 16px;color:var(--gray-500);">\${esc(v.contact||'')} \${v.email?\`<br><span style="font-size:11px;">\${esc(v.email)}</span>\`:''}</td>
              <td style="padding:12px 16px;color:var(--gray-400);font-size:12px;">\${esc((v.address||'—').substring(0,50))}</td>
              <td style="padding:12px 8px;"><button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();showNewVendorModal('\${v.id}')">Edit</button></td>
            </tr>\`).join('')}</tbody></table></div>\`}\`;
      } catch(e) { T.innerHTML = \`<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Error: \${esc(e.message)}</div></div>\`; }
    }

    async function showNewVendorModal(existingId) {
      let v = {};
      if (existingId) { const doc = await db.collection('vendors').doc(existingId).get(); if (doc.exists) v = doc.data(); }
      document.getElementById('modalContainer').innerHTML = \`
        <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
          <div class="modal" style="width:620px;">
            <div class="modal-header"><div class="modal-title">\${existingId?'Edit Vendor':'New Vendor'}</div><button class="modal-close" onclick="closeModal()">&times;</button></div>
            <div class="modal-body"><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div class="form-group"><label class="form-label">Vendor Name *</label><input class="form-input" id="vnName" value="\${escAttr(v.name||'')}"></div>
              <div class="form-group"><label class="form-label">Type</label><input class="form-input" id="vnType" value="\${escAttr(v.type||'')}" list="vnTypeList" placeholder="e.g. Upholsterer, Showroom..."><datalist id="vnTypeList"><option value="Showroom"><option value="Upholsterer"><option value="Window Fabricator"><option value="Freight / Receiver"><option value="Stone Supplier"><option value="Lighting"><option value="Furniture"><option value="Fabric"><option value="Wallcovering"><option value="Hardware"><option value="Tile / Stone"></datalist></div>
              <div class="form-group"><label class="form-label">Contact Name</label><input class="form-input" id="vnContact" value="\${escAttr(v.contact||'')}"></div>
              <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="vnPhone" value="\${escAttr(v.phone||'')}"></div>
              <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="vnEmail" value="\${escAttr(v.email||'')}"></div>
              <div class="form-group"><label class="form-label">Account # / Trade ID</label><input class="form-input" id="vnAccount" value="\${escAttr(v.account||'')}"></div>
              <div class="form-group" style="grid-column:span 2;"><label class="form-label">Ship-To / Receiving Address</label><input class="form-input" id="vnAddress" value="\${escAttr(v.address||'')}" placeholder="Street, City, State, ZIP — used on POs"></div>
              <div class="form-group"><label class="form-label">Lead Time</label><input class="form-input" id="vnLeadTime" value="\${escAttr(v.leadTime||'')}" placeholder="e.g. 8-10 weeks"></div>
              <div class="form-group"><label class="form-label">Website</label><input class="form-input" id="vnWebsite" value="\${escAttr(v.website||'')}"></div>
              <div class="form-group" style="grid-column:span 2;"><label class="form-label">Notes</label><textarea class="form-textarea" id="vnNotes" rows="2">\${esc(v.notes||'')}</textarea></div>
            </div></div>
            <div class="modal-footer" style="justify-content:space-between;">
              \${existingId?\`<button class="btn btn-secondary btn-sm" style="color:var(--red);border-color:var(--red);" onclick="deleteVendor('\${existingId}')">🗑 Delete</button>\`:'<div></div>'}
              <div style="display:flex;gap:8px;"><button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="saveVendor('\${existingId||''}')">Save Vendor</button></div>
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

`;

// ── PROPOSAL BUILDER ───────────────────────────────────────────────────────
const proposalBuilder = `
    // ==================== PROPOSAL BUILDER ====================
    async function showNewProposalBuilder(projectId) {
      const T = document.getElementById('modalContainer');
      T.innerHTML = '<div style="text-align:center;padding:60px;">Loading...</div>';
      let projectClips = [], libraryProducts = [], libraryServices = [];
      try { const s = await db.collection('boards').doc(projectId).collection('clips').get(); s.forEach(d => projectClips.push({ id:d.id, ...d.data() })); } catch(e) {}
      try { const s = await db.collection('products').get(); s.forEach(d => libraryProducts.push({ id:d.id, ...d.data() })); } catch(e) {}
      libraryServices = [
        { id:'svc-design', name:'Design Fee', unit:'hr', price:175, category:'Design' },
        { id:'svc-consult', name:'Consultation', unit:'hr', price:175, category:'Design' },
        { id:'svc-install', name:'Installation Supervision', unit:'hr', price:125, category:'Installation' },
        { id:'svc-project', name:'Project Management', unit:'flat', price:0, category:'Management' },
        { id:'svc-spec', name:'Space Planning / Specifications', unit:'flat', price:0, category:'Design' },
        { id:'svc-procurement', name:'Procurement Fee', unit:'pct', price:20, category:'Procurement' },
      ];
      let lineItems = [];
      let activeLibTab = 'project';
      let proposalName = 'Proposal ' + new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});

      function renderBuilder() {
        const subtotal = lineItems.reduce((s,i)=>s+(parseFloat(i.lineTotal)||0),0);
        T.innerHTML = \`
          <div class="modal-overlay">
            <div class="modal" style="width:95vw;max-width:1200px;height:90vh;display:flex;flex-direction:column;">
              <div class="modal-header" style="flex-shrink:0;">
                <div style="display:flex;align-items:center;gap:16px;flex:1;">
                  <div class="modal-title">📋 New Proposal</div>
                  <input class="form-input" style="width:280px;" value="\${escAttr(proposalName)}" id="propName" oninput="proposalName=this.value">
                </div>
                <button class="modal-close" onclick="closeModal()">&times;</button>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;flex:1;overflow:hidden;border-top:1px solid var(--gray-200);">
                <div style="display:flex;flex-direction:column;border-right:2px solid var(--gray-200);overflow:hidden;">
                  <div style="padding:10px 16px;background:var(--gray-50);border-bottom:1px solid var(--gray-200);font-weight:600;font-size:11px;text-transform:uppercase;color:var(--gray-500);display:flex;justify-content:space-between;align-items:center;">
                    <span>Proposal Items (\${lineItems.length})</span>
                    <button class="btn btn-secondary btn-sm" onclick="addExpenseLine()">+ Expense</button>
                  </div>
                  <div style="flex:1;overflow-y:auto;padding:8px;">
                    \${lineItems.length===0?\`<div style="text-align:center;padding:40px;color:var(--gray-400);"><div style="font-size:32px;margin-bottom:8px;">👈</div><div>Click items on the right to add them</div></div>\`
                    :lineItems.map((item,i)=>\`<div style="display:flex;gap:8px;padding:8px;border:1px solid var(--gray-200);border-radius:8px;margin-bottom:6px;background:white;align-items:flex-start;">
                      \${item.imageUrl?\`<img src="\${escAttr(item.imageUrl)}" style="width:48px;height:48px;object-fit:cover;border-radius:4px;flex-shrink:0;">\`:\`<div style="width:48px;height:48px;background:var(--gray-100);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;">\${item.type==='expense'?'💸':item.type==='service'?'⚙️':'📦'}</div>\`}
                      <div style="flex:1;min-width:0;">
                        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\${esc(item.title)}</div>
                        <div style="font-size:11px;color:var(--gray-400);">\${esc(item.vendor||item.category||'')}</div>
                        <div style="display:flex;gap:6px;margin-top:4px;align-items:center;">
                          <input type="number" value="\${item.qty}" min="0.01" step="0.01" style="width:52px;padding:3px 6px;border:1px solid var(--gray-200);border-radius:4px;font-size:12px;" onchange="updateLineItem(\${i},'qty',parseFloat(this.value)||1)">
                          <span style="font-size:11px;color:var(--gray-400);">\${item.unit||'ea'} ×</span>
                          <input type="number" value="\${item.unitPrice}" min="0" step="0.01" style="width:80px;padding:3px 6px;border:1px solid var(--gray-200);border-radius:4px;font-size:12px;" onchange="updateLineItem(\${i},'unitPrice',parseFloat(this.value)||0)">
                        </div>
                      </div>
                      <div style="text-align:right;flex-shrink:0;">
                        <div style="font-size:13px;font-weight:700;color:var(--gold);">$\${((item.qty||1)*(item.unitPrice||0)).toLocaleString('en-US',{minimumFractionDigits:2})}</div>
                        <button onclick="removeLineItem(\${i})" style="background:none;border:none;color:var(--gray-300);cursor:pointer;font-size:16px;">✕</button>
                      </div>
                    </div>\`).join('')}
                  </div>
                  <div style="padding:12px 16px;border-top:2px solid var(--gray-200);background:var(--gray-50);">
                    <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;"><span style="color:var(--gray-500);">Subtotal</span><span style="font-weight:600;">$\${subtotal.toLocaleString('en-US',{minimumFractionDigits:2})}</span></div>
                    <div style="display:flex;justify-content:space-between;font-size:18px;font-weight:700;margin-top:8px;padding-top:8px;border-top:1px solid var(--gray-200);"><span>Total</span><span style="color:var(--gold);">$\${subtotal.toLocaleString('en-US',{minimumFractionDigits:2})}</span></div>
                    <button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="saveProposalFromBuilder('\${escAttr(projectId)}')">Save Proposal</button>
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;overflow:hidden;">
                  <div style="display:flex;border-bottom:1px solid var(--gray-200);">
                    \${[['project','🏠 Project Items'],['library','📦 Products'],['services','⚙️ Services']].map(([tab,label])=>\`<button onclick="switchLibTab('\${tab}')" style="flex:1;padding:10px 4px;border:none;border-bottom:3px solid \${activeLibTab===tab?'var(--gold)':'transparent'};background:\${activeLibTab===tab?'white':'var(--gray-50)'};font-size:12px;font-weight:\${activeLibTab===tab?'700':'400'};color:\${activeLibTab===tab?'var(--gold)':'var(--gray-500)'};cursor:pointer;">\${label}</button>\`).join('')}
                  </div>
                  <div style="padding:8px 12px;border-bottom:1px solid var(--gray-200);"><input class="form-input" style="font-size:12px;" placeholder="Search..." id="libSearch" oninput="filterLibrary(this.value)"></div>
                  <div style="flex:1;overflow-y:auto;padding:8px;" id="libItems">\${renderLibItems(activeLibTab,'')}</div>
                </div>
              </div>
            </div>
          </div>\`;

        window.updateLineItem = (i,field,val)=>{ lineItems[i][field]=val; lineItems[i].lineTotal=(lineItems[i].qty||1)*(lineItems[i].unitPrice||0); renderBuilder(); };
        window.removeLineItem = (i)=>{ lineItems.splice(i,1); renderBuilder(); };
        window.switchLibTab = (tab)=>{ activeLibTab=tab; renderBuilder(); };
        window.filterLibrary = (q)=>{ document.getElementById('libItems').innerHTML=renderLibItems(activeLibTab,q); };
        window.addFromLib = (type,id)=>{
          let item;
          if (type==='clip') { const c=projectClips.find(x=>x.id===id); if(!c)return; const price=parseFloat((c.clientPrice||'').replace(/[^0-9.]/g,''))||0; item={type:'product',id,title:c.title,vendor:c.vendor||'',room:c.room||c.category||'',imageUrl:c.imageUrl||null,qty:1,unit:'ea',unitPrice:price,lineTotal:price}; }
          else if (type==='product') { const p=libraryProducts.find(x=>x.id===id); if(!p)return; item={type:'product',id,title:p.title,vendor:p.vendor||'',imageUrl:p.imageUrl||null,qty:1,unit:'ea',unitPrice:p.sellPrice||0,lineTotal:p.sellPrice||0}; }
          else if (type==='service') { const s=libraryServices.find(x=>x.id===id); if(!s)return; item={type:'service',id,title:s.name,category:s.category||'',unit:s.unit||'hr',qty:1,unitPrice:s.price||0,lineTotal:s.price||0}; }
          if (item) { lineItems.push(item); renderBuilder(); }
        };
        window.addExpenseLine = ()=>{
          const types=['Freight','Shipping','Sales Tax Pre-paid','Postage','Storage','Custom Duty','Misc Expense'];
          const pick=prompt('Expense type:\\n'+types.map((t,i)=>(i+1)+'. '+t).join('\\n')+'\\n\\nOr type your own:');
          if (!pick) return;
          const name=types[parseInt(pick)-1]||pick;
          lineItems.push({type:'expense',title:name,qty:1,unit:'flat',unitPrice:0,lineTotal:0});
          renderBuilder();
        };
        window.saveProposalFromBuilder = saveProposalFromBuilder;
      }

      function renderLibItems(tab, query) {
        const q=(query||'').toLowerCase();
        if (tab==='project') {
          const filtered=projectClips.filter(c=>!q||(c.title||'').toLowerCase().includes(q)||(c.vendor||'').toLowerCase().includes(q));
          if (!filtered.length) return '<div style="text-align:center;padding:24px;color:var(--gray-400);font-size:13px;">No items found</div>';
          return filtered.map(c=>{ const price=parseFloat((c.clientPrice||'').replace(/[^0-9.]/g,''))||0; return \`<div onclick="addFromLib('clip','\${c.id}')" style="display:flex;gap:8px;padding:8px;border:1px solid var(--gray-200);border-radius:6px;margin-bottom:4px;cursor:pointer;background:white;" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--gray-200)'">\${c.imageUrl?\`<img src="\${escAttr(c.imageUrl)}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;flex-shrink:0;">\`:'<div style="width:40px;height:40px;background:var(--gray-100);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">📦</div>'}<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\${esc(c.title||'Untitled')}</div><div style="font-size:11px;color:var(--gray-400);">\${esc(c.vendor||c.category||'')}</div></div><div style="font-size:12px;font-weight:700;color:var(--gold);flex-shrink:0;">\${price?'$'+price.toLocaleString('en-US',{minimumFractionDigits:2}):'—'}</div></div>\`; }).join('');
        } else if (tab==='library') {
          const filtered=libraryProducts.filter(p=>!q||(p.title||'').toLowerCase().includes(q));
          if (!filtered.length) return '<div style="text-align:center;padding:24px;color:var(--gray-400);font-size:13px;">No products found</div>';
          return filtered.map(p=>\`<div onclick="addFromLib('product','\${p.id}')" style="display:flex;gap:8px;padding:8px;border:1px solid var(--gray-200);border-radius:6px;margin-bottom:4px;cursor:pointer;background:white;" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--gray-200)'">\${p.imageUrl?\`<img src="\${escAttr(p.imageUrl)}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;flex-shrink:0;">\`:'<div style="width:40px;height:40px;background:var(--gray-100);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;">📦</div>'}<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\${esc(p.title||'Untitled')}</div><div style="font-size:11px;color:var(--gray-400);">\${esc(p.vendor||'')}</div></div><div style="font-size:12px;font-weight:700;color:var(--gold);flex-shrink:0;">\${p.sellPrice?'$'+parseFloat(p.sellPrice).toFixed(2):'—'}</div></div>\`).join('');
        } else {
          const filtered=libraryServices.filter(s=>!q||(s.name||'').toLowerCase().includes(q));
          if (!filtered.length) return '<div style="text-align:center;padding:24px;color:var(--gray-400);font-size:13px;">No services</div>';
          const grouped={};
          filtered.forEach(s=>{ const cat=s.category||'Services'; if(!grouped[cat])grouped[cat]=[]; grouped[cat].push(s); });
          return Object.entries(grouped).map(([cat,items])=>\`<div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--gray-400);letter-spacing:0.08em;padding:8px 4px 4px;">\${esc(cat)}</div>\${items.map(s=>\`<div onclick="addFromLib('service','\${s.id}')" style="display:flex;gap:8px;padding:8px;border:1px solid var(--gray-200);border-radius:6px;margin-bottom:4px;cursor:pointer;background:white;" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--gray-200)'"><div style="width:40px;height:40px;background:var(--gray-100);border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;">⚙️</div><div style="flex:1;"><div style="font-size:12px;font-weight:600;">\${esc(s.name)}</div><div style="font-size:11px;color:var(--gray-400);">\${s.unit==='pct'?s.price+'% of products':s.unit==='hr'?'per hour':'flat rate'}</div></div><div style="font-size:12px;font-weight:700;color:var(--gold);flex-shrink:0;">\${s.unit==='pct'?s.price+'%':s.price?'$'+parseFloat(s.price).toFixed(2):'—'}</div></div>\`).join('')}\`).join('');
        }
      }

      async function saveProposalFromBuilder(projectId) {
        const name = document.getElementById('propName')?.value || proposalName;
        if (lineItems.length===0) { alert('Add at least one item.'); return; }
        const total = lineItems.reduce((s,i)=>s+(parseFloat(i.lineTotal)||0),0);
        try {
          await db.collection('boards').doc(projectId).collection('proposals').add({
            name, number:'PROP-'+Date.now().toString().slice(-6),
            items: lineItems.map(i=>({ description:i.title, qty:i.qty||1, unitPrice:i.unitPrice||0, lineTotal:i.lineTotal||0, vendor:i.vendor||'', room:i.room||'', type:i.type||'product', unit:i.unit||'ea', imageUrl:i.imageUrl||null })),
            total, status:'Draft', createdAt:new Date().toISOString(), owner:currentUser.email
          });
          closeModal();
          navigate('#/project/'+projectId+'/proposals');
        } catch(e) { alert('Error saving: ' + e.message); }
      }

      renderBuilder();
    }

`;

// ── PROPOSALS TAB ──────────────────────────────────────────────────────────
const proposalsTabFn = `async function renderProposalsTab(projectId) {
      try {
        const snap = await db.collection('boards').doc(projectId).collection('proposals').get();
        const proposals = [];
        snap.forEach(d => proposals.push({ id:d.id, ...d.data() }));
        proposals.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
        const sc = { 'Draft':'var(--gray-400)','Sent':'var(--gold)','Approved':'var(--green)','Declined':'var(--red)' };
        return \`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h2 style="font-size:20px;font-weight:700;">Proposals</h2>
            <button class="btn btn-primary" onclick="showNewProposalBuilder('\${projectId}')">+ New Proposal</button>
          </div>
          \${proposals.length===0?\`<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">No proposals yet.</div><button class="btn btn-primary" onclick="showNewProposalBuilder('\${projectId}')">+ New Proposal</button></div>\`
          :\`<div class="card" style="overflow:hidden;"><table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="border-bottom:2px solid var(--gray-200);">
              <th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Proposal</th>
              <th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Items</th>
              <th style="text-align:right;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Total</th>
              <th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Status</th>
              <th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Date</th>
              <th style="padding:12px 8px;"></th>
            </tr></thead>
            <tbody>\${proposals.map(p=>\`<tr style="border-bottom:1px solid var(--gray-100);">
              <td style="padding:12px 16px;font-weight:600;">\${esc(p.name||p.number||'Proposal')}</td>
              <td style="padding:12px 16px;color:var(--gray-400);">\${(p.items||[]).length} items</td>
              <td style="padding:12px 16px;text-align:right;font-weight:600;font-family:monospace;">$\${(parseFloat(p.total)||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
              <td style="padding:12px 16px;"><select style="font-size:11px;padding:3px 8px;border-radius:10px;border:1px solid var(--gray-200);color:\${sc[p.status]||'var(--gray-400)'};font-weight:600;cursor:pointer;" onchange="updateDocStatus('\${projectId}','proposals','\${p.id}',this.value)">\${['Draft','Sent','Approved','Declined'].map(s=>\`<option \${p.status===s?'selected':''} value="\${s}">\${s}</option>\`).join('')}</select></td>
              <td style="padding:12px 16px;color:var(--gray-400);font-size:12px;">\${p.createdAt?new Date(p.createdAt).toLocaleDateString():'—'}</td>
              <td style="padding:12px 8px;"><div style="display:flex;gap:4px;">
                <button class="btn btn-secondary btn-sm" onclick="showConnectedDocs('\${projectId}','proposal','\${p.id}','',this)">🔗</button>
                <button class="btn btn-secondary btn-sm" onclick="printProposal('\${projectId}','\${p.id}')">Print</button>
                <button class="btn btn-secondary btn-sm" style="color:var(--red);" onclick="deleteFinanceDoc('\${projectId}','proposals','\${p.id}')">🗑</button>
              </div></td>
            </tr>\`).join('')}</tbody></table></div>\`}\`;
      } catch(e) { return \`<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Error: \${esc(e.message)}</div></div>\`; }
    }

`;

// ── INVOICES TAB ───────────────────────────────────────────────────────────
const invoicesTabFn = `async function renderInvoicesTab(projectId) {
      try {
        const snap = await db.collection('boards').doc(projectId).collection('invoices').get();
        const invoices = [];
        snap.forEach(d => invoices.push({ id:d.id, ...d.data() }));
        invoices.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
        const sc = { 'Draft':'var(--gray-400)','Sent':'var(--gold)','Paid':'var(--green)','Overdue':'var(--red)','Partial':'#E65100' };
        return \`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h2 style="font-size:20px;font-weight:700;">Invoices</h2>
            <button class="btn btn-primary" onclick="showNewInvoiceModal('\${projectId}')">+ New Invoice</button>
          </div>
          \${invoices.length===0?\`<div class="empty-state"><div class="empty-icon">💰</div><div class="empty-text">No invoices yet.</div><button class="btn btn-primary" onclick="showNewInvoiceModal('\${projectId}')">+ New Invoice</button></div>\`
          :\`<div class="card" style="overflow:hidden;"><table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="border-bottom:2px solid var(--gray-200);">
              <th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Invoice #</th>
              <th style="text-align:right;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Amount</th>
              <th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Status</th>
              <th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Due Date</th>
              <th style="padding:12px 8px;"></th>
            </tr></thead>
            <tbody>\${invoices.map(inv=>\`<tr style="border-bottom:1px solid var(--gray-100);\${inv.status==='Overdue'?'background:#fff8f8;':''}">
              <td style="padding:12px 16px;font-weight:600;font-family:monospace;">\${esc(inv.number||inv.id.substring(0,8))}</td>
              <td style="padding:12px 16px;text-align:right;font-weight:600;font-family:monospace;">$\${(parseFloat(inv.total)||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
              <td style="padding:12px 16px;"><select style="font-size:11px;padding:3px 8px;border-radius:10px;border:1px solid var(--gray-200);color:\${sc[inv.status]||'var(--gray-400)'};font-weight:600;cursor:pointer;" onchange="updateDocStatus('\${projectId}','invoices','\${inv.id}',this.value)">\${['Draft','Sent','Paid','Overdue','Partial'].map(s=>\`<option \${inv.status===s?'selected':''} value="\${s}">\${s}</option>\`).join('')}</select></td>
              <td style="padding:12px 16px;color:var(--gray-400);font-size:12px;">\${inv.dueDate?new Date(inv.dueDate).toLocaleDateString():'—'}</td>
              <td style="padding:12px 8px;"><div style="display:flex;gap:4px;">
                <button class="btn btn-secondary btn-sm" onclick="showConnectedDocs('\${projectId}','invoice','\${inv.id}','',this)">🔗</button>
                <button class="btn btn-secondary btn-sm" onclick="showEditInvoiceModal('\${projectId}','\${inv.id}')">Edit</button>
                <button class="btn btn-secondary btn-sm" style="color:var(--red);" onclick="deleteFinanceDoc('\${projectId}','invoices','\${inv.id}')">🗑</button>
              </div></td>
            </tr>\`).join('')}</tbody></table></div>\`}\`;
      } catch(e) { return \`<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Error: \${esc(e.message)}</div></div>\`; }
    }

`;

// ── POs TAB ────────────────────────────────────────────────────────────────
const posTabFn = `async function renderPOsTab(projectId) {
      try {
        const snap = await db.collection('boards').doc(projectId).collection('purchaseOrders').get();
        const pos = [];
        snap.forEach(d => pos.push({ id:d.id, ...d.data() }));
        pos.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
        const sc = { 'Draft':'var(--gray-400)','Sent':'var(--gold)','Ordered':'#0097A7','Received':'var(--green)','On Hold':'#6A1B9A','Cancelled':'var(--gray-300)' };
        return \`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
            <h2 style="font-size:20px;font-weight:700;">Purchase Orders</h2>
            <button class="btn btn-primary" onclick="showQuickPOModal('\${projectId}')">+ New PO</button>
          </div>
          \${pos.length===0?\`<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-text">No purchase orders yet.</div><button class="btn btn-primary" onclick="showQuickPOModal('\${projectId}')">+ New PO</button></div>\`
          :\`<div class="card" style="overflow:hidden;"><table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="border-bottom:2px solid var(--gray-200);">
              <th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">PO #</th>
              <th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Vendor</th>
              <th style="text-align:right;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Total</th>
              <th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Status</th>
              <th style="text-align:left;padding:12px 16px;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">ETA</th>
              <th style="padding:12px 8px;"></th>
            </tr></thead>
            <tbody>\${pos.map(po=>\`<tr style="border-bottom:1px solid var(--gray-100);">
              <td style="padding:12px 16px;font-weight:600;font-family:monospace;">\${esc(po.number||po.id.substring(0,8))}</td>
              <td style="padding:12px 16px;font-weight:500;">\${esc(po.vendor||'—')}</td>
              <td style="padding:12px 16px;text-align:right;font-weight:600;font-family:monospace;">$\${(parseFloat(po.total)||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
              <td style="padding:12px 16px;"><select style="font-size:11px;padding:3px 8px;border-radius:10px;border:1px solid var(--gray-200);color:\${sc[po.status]||'var(--gray-400)'};font-weight:600;cursor:pointer;" onchange="updateDocStatus('\${projectId}','purchaseOrders','\${po.id}',this.value)">\${['Draft','Sent','Ordered','Received','On Hold','Cancelled'].map(s=>\`<option \${po.status===s?'selected':''} value="\${s}">\${s}</option>\`).join('')}</select></td>
              <td style="padding:12px 16px;color:var(--gray-400);font-size:12px;">\${esc(po.eta||'—')}</td>
              <td style="padding:12px 8px;"><div style="display:flex;gap:4px;">
                <button class="btn btn-secondary btn-sm" onclick="showConnectedDocs('\${projectId}','po','\${po.id}','',this)">🔗</button>
                <button class="btn btn-secondary btn-sm" onclick="showEditPOModal('\${projectId}','\${po.id}')">Edit</button>
                <button class="btn btn-secondary btn-sm" style="color:var(--red);" onclick="deleteFinanceDoc('\${projectId}','purchaseOrders','\${po.id}')">🗑</button>
              </div></td>
            </tr>\`).join('')}</tbody></table></div>\`}\`;
      } catch(e) { return \`<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Error: \${esc(e.message)}</div></div>\`; }
    }

`;

// ── INJECT ALL NEW FUNCTIONS just before closing </script> ────────────────
const marker = '\n  </script>\n</body>\n</html>';
if (t.includes(marker)) {
  const allFunctions = financeHelpers + connectedDocs + clientsVendors + proposalBuilder + proposalsTabFn + invoicesTabFn + posTabFn;
  t = t.replace(marker, '\n' + allFunctions + marker);
  console.log('✓ All new functions injected');
} else {
  // Try alternate ending
  const marker2 = '\n  </script>\n</body>';
  if (t.includes(marker2)) {
    const allFunctions = financeHelpers + connectedDocs + clientsVendors + proposalBuilder + proposalsTabFn + invoicesTabFn + posTabFn;
    t = t.replace(marker2, '\n' + allFunctions + marker2);
    console.log('✓ All new functions injected (alternate marker)');
  } else {
    console.error('✗ Could not find closing script tag');
    process.exit(1);
  }
}

fs.writeFileSync('platform/index.html', t);
console.log('✅ ALL PATCHES COMPLETE! Lines:', t.split('\n').length);
console.log('   Now run: firebase deploy --only hosting');
