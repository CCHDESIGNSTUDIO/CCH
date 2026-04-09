/**
 * CCH Studio — Proposals, Invoices & POs Fix Module
 * ===================================================
 * Fixes all open bugs from the 02 - Proposals and Invoices tracker:
 *   Bug #49: Invoice image/pricing didn't transfer from proposal
 *   Bug #50: Proposal image didn't transfer, pricing off, client info auto-transfer
 *   Bug #51: No ship-to dropdown, can't add images, no room dropdown
 *   Bug #52: Missing null check on doc.data() in proposal detail (crash fix)
 *   Bug #53: Invoice not generating # and status should start with "Draft"
 *
 * Plus screenshot-reported issues:
 *   - Black buttons: can't read text
 *   - Line items too small, columns don't align
 *   - Invoice preview missing bill-to, tax info, saves non-items
 *   - Linked doc links missing at top next to doc number
 *   - Need room view option on proposals (category + room toggle)
 *   - Inline edit from main proposal/invoice list
 *   - Vendor dropdown should come from project data
 *   - No tearsheets generated (button wiring)
 *   - Columns don't line up in proposal detail
 *   - 2 different fonts — consistent font fix
 *
 * Features added:
 *   #56: Proposals week/month/YTD summary at top
 *   #57: Invoices weekly/monthly/YTD/All filter band
 *   #66: Markup Revenue stat on invoices page
 *   #67: Connected Docs visual cross-linking
 *
 * Integration: Add <script src="cch-proposals-invoices-fix.js"></script> to index.html
 * after the main app code (before </body>).
 */

(function() {
  'use strict';

  // ============================================================
  // 1. CSS FIXES — inject styles for visual bugs
  // ============================================================
  var style = document.createElement('style');
  style.textContent = `
    /* Bug fix: Black buttons — ensure text is readable on dark buttons */
    .btn-dark, .btn[style*="background:#1B3352"], .btn[style*="background:var(--navy)"] {
      color: #EDE8E0 !important;
    }
    .btn-primary {
      color: #EDE8E0 !important;
    }

    /* Fix: Ensure all nav buttons in topbar are readable */
    .topbar-actions .btn {
      font-size: 12px !important;
      padding: 6px 12px !important;
      white-space: nowrap !important;
    }
    .topbar-actions .btn-dark {
      background: #1B3352 !important;
      color: #EDE8E0 !important;
      border: none !important;
    }

    /* Fix: Line items too small — increase minimum sizes */
    .doc-edit-row {
      min-height: 80px !important;
    }
    .doc-edit-img, .doc-edit-img img {
      width: 64px !important;
      height: 64px !important;
      min-width: 64px !important;
      min-height: 64px !important;
    }
    .doc-edit-name {
      font-size: 14px !important;
      font-weight: 600 !important;
      padding: 8px 10px !important;
    }
    .doc-edit-desc {
      font-size: 13px !important;
      min-height: 36px !important;
    }
    .doc-edit-nums input, .doc-edit-nums select {
      font-size: 13px !important;
      padding: 6px 8px !important;
    }
    .doc-edit-nums label {
      font-size: 10px !important;
      text-transform: uppercase !important;
      letter-spacing: 0.5px !important;
      color: #7A7060 !important;
      font-weight: 600 !important;
    }

    /* Fix: Proposal detail table — consistent column widths & font */
    .data-table th, .data-table td {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif !important;
      vertical-align: middle !important;
    }
    .data-table th {
      font-size: 10px !important;
      text-transform: uppercase !important;
      letter-spacing: 0.65px !important;
      color: #7A7060 !important;
      font-weight: 600 !important;
      padding: 8px 10px !important;
      white-space: nowrap !important;
    }
    .data-table td {
      font-size: 13px !important;
      padding: 8px 10px !important;
    }
    .data-table td.amount, .data-table th.amount {
      text-align: right !important;
      font-family: 'JetBrains Mono', 'DM Mono', monospace !important;
    }

    /* Fix: Consistent font throughout proposals/invoices — no mixing */
    #contentArea h1, #contentArea .page-title {
      font-family: 'DM Serif Display', 'DM Sans', serif !important;
    }
    #contentArea .section-title {
      font-family: 'DM Sans', sans-serif !important;
    }

    /* Connected docs badge styling */
    .linked-doc-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s, transform 0.1s;
      border: 1px solid transparent;
    }
    .linked-doc-badge:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    }
    .linked-doc-badge.badge-proposal {
      background: rgba(200,169,110,0.12);
      color: #C9A96E;
      border-color: rgba(200,169,110,0.2);
    }
    .linked-doc-badge.badge-invoice {
      background: rgba(94,198,198,0.12);
      color: #3BA8A8;
      border-color: rgba(94,198,198,0.2);
    }
    .linked-doc-badge.badge-po {
      background: rgba(0,150,136,0.12);
      color: #00796B;
      border-color: rgba(0,150,136,0.2);
    }

    /* Summary band styling for proposals/invoices tabs */
    .doc-summary-band {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 0;
      margin-bottom: 16px;
      border: 1px solid rgba(200,185,154,0.15);
      border-radius: 0;
      overflow: hidden;
    }
    .doc-summary-card {
      padding: 16px 20px;
      text-align: center;
      border-right: 1px solid rgba(200,185,154,0.1);
    }
    .doc-summary-card:last-child { border-right: none; }
    .doc-summary-card .value {
      font-size: 20px;
      font-weight: 700;
      font-family: var(--font-mono);
      margin-bottom: 4px;
    }
    .doc-summary-card .label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--gray-400);
      font-weight: 600;
    }

    /* Filter band for invoices */
    .doc-filter-band {
      display: flex;
      gap: 4px;
      margin-bottom: 12px;
      padding: 6px 8px;
      background: var(--gray-50);
      border-radius: 0;
    }
    .doc-filter-btn {
      padding: 6px 14px;
      font-size: 11px;
      font-weight: 600;
      border: none;
      background: transparent;
      color: var(--gray-400);
      cursor: pointer;
      border-radius: 0;
      transition: all 0.15s;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .doc-filter-btn:hover { color: var(--text-primary); }
    .doc-filter-btn.active {
      background: #1B3352;
      color: #EDE8E0;
    }

    /* Fix: Print preview images — ensure visible at 64px */
    @media print {
      .doc-edit-img img { width: 64px !important; height: 64px !important; }
    }

    /* Fix: Proposal view toggle buttons */
    .proposal-view-toggle {
      display: inline-flex;
      border: 1px solid rgba(200,185,154,0.3);
      border-radius: 0;
      overflow: hidden;
    }
    .proposal-view-toggle button {
      padding: 6px 14px;
      font-size: 11px;
      font-weight: 600;
      border: none;
      background: transparent;
      color: var(--gray-400);
      cursor: pointer;
      transition: all 0.15s;
    }
    .proposal-view-toggle button.active {
      background: #1B3352;
      color: #EDE8E0;
    }
    .proposal-view-toggle button:hover:not(.active) {
      color: var(--text-primary);
      background: rgba(27,51,82,0.04);
    }

    /* Inline edit row styling */
    .inline-edit-row td {
      padding: 6px 8px !important;
    }
    .inline-edit-row input, .inline-edit-row select {
      font-size: 12px !important;
      padding: 4px 6px !important;
      border: 1px solid rgba(27,51,82,0.12) !important;
      background: #FFFFFF !important;
      width: 100% !important;
    }
    .inline-edit-row input:focus, .inline-edit-row select:focus {
      border-color: var(--gold) !important;
      outline: none !important;
    }
  `;
  document.head.appendChild(style);


  // ============================================================
  // 2. BUG #52 FIX — Null check on doc.data() in proposal detail
  // ============================================================
  var _origRenderProposalDetail = window.renderProposalDetail;
  window.renderProposalDetail = async function(projectId, proposalId) {
    var T = document.getElementById('contentArea');
    try {
      var doc = await db.collection('boards').doc(projectId).collection('proposals').doc(proposalId).get();
      if (!doc.exists || !doc.data()) {
        T.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">Proposal not found or has been deleted.</div>' +
          '<button class="btn btn-secondary" onclick="navigate(\'#/project/' + projectId + '/proposals\')" style="margin-top:12px;">← Back to Proposals</button></div>';
        return;
      }
    } catch(e) {
      T.innerHTML = '<div class="empty-state"><div class="empty-text">Error loading proposal: ' + (e.message||'Unknown error') + '</div></div>';
      return;
    }
    // Safe to call original now — doc exists and data() is not null
    return _origRenderProposalDetail.call(this, projectId, proposalId);
  };


  // ============================================================
  // 3. BUG #53 FIX — Invoice number auto-generation & Draft status
  // Override createInvoice to always auto-generate number if blank
  // ============================================================
  var _origCreateInvoice = window.createInvoice;
  window.createInvoice = async function(projectId) {
    // Ensure invoice number is generated before saving
    var invNumEl = document.getElementById('invNum');
    if (invNumEl && !invNumEl.value.trim()) {
      try {
        var autoNum = await window.getNextDocNumber('INV');
        invNumEl.value = autoNum;
      } catch(e) {
        console.warn('Auto-generate inv# failed:', e);
        invNumEl.value = 'INV-' + Date.now();
      }
    }
    // Ensure status defaults to Draft (not blank)
    var statusEl = document.getElementById('invStatus');
    if (statusEl && !statusEl.value) {
      statusEl.value = 'Draft';
    }
    return _origCreateInvoice.call(this, projectId);
  };


  // ============================================================
  // 4. BUG #49/#50 FIX — Image & pricing transfer on conversion
  // Override convertProposalToInvoice to properly copy all item data
  // ============================================================
  var _origConvertProposalToInvoice = window.convertProposalToInvoice;
  window.convertProposalToInvoice = async function(projectId, proposalId) {
    function _isGroupRow(it) {
      return it && it.lineKind === 'group';
    }
    function _lineApprovalState(it) {
      if (_isGroupRow(it)) return null;
      var s = it && it.lineApprovalStatus;
      if (s === 'approved' || s === 'declined' || s === 'pending') return s;
      return 'pending';
    }
    try {
      var propDoc = await db.collection('boards').doc(projectId).collection('proposals').doc(proposalId).get();
      if (!propDoc.exists || !propDoc.data()) { alert('Proposal not found'); return; }
      var prop = propDoc.data();
      var rawItems = prop.items || [];
      var productLines = rawItems.filter(function(it) { return !_isGroupRow(it); });
      var gateMsgs = [];
      if (productLines.length === 0) gateMsgs.push('Add at least one line item.');
      if ((prop.status || 'Draft') !== 'Approved') gateMsgs.push('Proposal status must be Approved (use the status badge or Edit Details).');
      var pendingN = 0, approvedN = 0;
      productLines.forEach(function(it) {
        var st = _lineApprovalState(it);
        if (st === 'pending') pendingN++;
        if (st === 'approved') approvedN++;
      });
      if (pendingN > 0) gateMsgs.push(pendingN + ' line(s) still Pending — set each to Approved or Declined.');
      if (approvedN < 1 && productLines.length > 0) gateMsgs.push('At least one line must be Approved to invoice.');
      if (gateMsgs.length > 0) {
        alert('Cannot create invoice yet:\n\n• ' + gateMsgs.join('\n• '));
        return;
      }

      var sourceForInvoice = rawItems.filter(function(item) { return !_isGroupRow(item) && _lineApprovalState(item) === 'approved'; });
      var skipped = productLines.length - sourceForInvoice.length;
      if (!confirm('Create a new Invoice from this proposal?\n\n• ' + sourceForInvoice.length + ' approved line(s) will be copied.\n' + (skipped > 0 ? '• ' + skipped + ' line(s) skipped (not Approved).\n' : '') + '\nImages and pricing will transfer for each copied line.')) return;
    } catch (eGate) {
      alert('Could not validate proposal: ' + (eGate.message || eGate));
      return;
    }
    try {
      // Deep copy only APPROVED lines; strip internal workflow field from invoice payload
      var items = sourceForInvoice.map(function(item) {
        var copied = {};
        Object.keys(item).forEach(function(key) { copied[key] = item[key]; });
        delete copied.lineApprovalStatus;
        delete copied.lineKind;
        delete copied.groupId;
        copied.amount = parseFloat(item.amount) || parseFloat(item.totalSelling) || parseFloat(item.lineTotal) || parseFloat(item.clientPrice) || 0;
        copied.cost = parseFloat(item.cost) || parseFloat(item.totalCost) || parseFloat(item.unitCost) || 0;
        copied.qty = parseFloat(item.qty) || 1;
        copied.markupPct = parseFloat(item.markupPct) || 0;
        copied.shipping = parseFloat(item.shipping) || 0;
        copied.imageUrl = item.imageUrl || item.image || item.thumbnail || '';
        copied.images = item.images || (copied.imageUrl ? [copied.imageUrl] : []);
        copied.title = item.title || item.name || '';
        copied.vendor = item.vendor || '';
        copied.room = item.room || item.category || '';
        copied.category = item.category || item.room || '';
        copied.description = item.description || '';
        copied.shipTo = item.shipTo || '';
        return copied;
      });

      var total = items.reduce(function(s, i) { return s + (parseFloat(i.amount) || 0); }, 0);
      var invNum = await window.getNextDocNumber('INV');

      // Get client info from proposal, then project
      var projDoc = await db.collection('boards').doc(projectId).get();
      var projInfo = projDoc.exists ? projDoc.data() : {};

      // Also try clients collection if project has clientId
      var cName = prop.clientName || projInfo.clientName || '';
      var cEmail = prop.clientEmail || projInfo.clientEmail || '';
      var cPhone = prop.clientPhone || projInfo.clientPhone || '';
      var cAddr = prop.clientAddress || projInfo.clientAddress || '';

      if (!cName && projInfo.clientId) {
        try {
          var clientDoc = await db.collection('clients').doc(projInfo.clientId).get();
          if (clientDoc.exists) {
            var cd = clientDoc.data();
            cName = cName || cd.name || cd.clientName || '';
            cEmail = cEmail || cd.email || cd.clientEmail || '';
            cPhone = cPhone || cd.phone || cd.clientPhone || '';
            cAddr = cAddr || cd.address || cd.clientAddress || '';
          }
        } catch(e) {}
      }
      // Fallback: extract client name from project name
      if (!cName && projInfo.name && projInfo.name.includes(' - ')) {
        cName = projInfo.name.split(' - ')[0].trim();
      }

      var _cUser = (currentUser && currentUser.displayName) || (currentUser && currentUser.email) || 'Unknown';

      var invRef = await db.collection('boards').doc(projectId).collection('invoices').add({
        invoiceNum: invNum,
        number: invNum,
        status: 'Draft',
        total: total,
        items: items,
        vendor: prop.vendor || '',
        documentTags: prop.documentTags || prop.tags || prop.vendor || '',
        clientName: cName,
        clientEmail: cEmail,
        clientPhone: cPhone,
        clientAddress: cAddr,
        taxRate: prop.taxRate || 0,
        linkedProposalId: proposalId,
        linkedProposalNum: prop.proposalNum || prop.number || prop.name || '',
        _fromProposal: true,
        createdAt: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        payments: [],
        published: false,
        createdBy: _cUser,
        createdByEmail: (currentUser && currentUser.email) || '',
        notes: prop.notes || 'All fees are non-refundable. Freight and delivery charges will be invoiced separately upon shipment. Payment due within 30 days of invoice date.',
        activityLog: [{
          action: 'created_from_proposal',
          details: 'From: ' + (prop.name || prop.proposalNum || 'Proposal') + ' — ' + items.length + ' items, ' + window.formatMoney(total),
          userName: _cUser,
          userEmail: (currentUser && currentUser.email) || '',
          timestamp: new Date().toISOString()
        }]
      });

      // Update proposal with link back
      await db.collection('boards').doc(projectId).collection('proposals').doc(proposalId).update({
        status: 'Invoiced',
        linkedInvoiceId: invRef.id,
        linkedInvoiceNum: invNum
      });

      if (typeof logDocActivity === 'function') {
        logDocActivity(projectId, 'proposals', proposalId, 'converted', 'Converted to Invoice ' + invNum);
      }

      alert('Invoice ' + invNum + ' created with ' + items.length + ' items!\nImages and pricing transferred.');
      if (typeof _cacheTime !== 'undefined') _cacheTime = 0;
      navigate('#/project/' + projectId + '/invoice/' + invRef.id);
    } catch(e) {
      console.error('Convert failed:', e);
      alert('Error: ' + e.message);
    }
  };


  // ============================================================
  // 5. FEATURE #67 — Connected Docs cross-linking helper
  // Renders linked doc badges for any document header
  // ============================================================
  window.renderLinkedDocBadges = function(projectId, docData, docType) {
    var badges = [];

    // Proposal links
    if (docData.linkedProposalId) {
      badges.push('<a class="linked-doc-badge badge-proposal" onclick="navigate(\'#/project/' + projectId + '/proposal/' + docData.linkedProposalId + '\')" title="View linked proposal">' +
        '📋 ' + esc(docData.linkedProposalNum || 'Proposal') + '</a>');
    }

    // Invoice links
    if (docData.linkedInvoiceId) {
      badges.push('<a class="linked-doc-badge badge-invoice" onclick="navigate(\'#/project/' + projectId + '/invoice/' + docData.linkedInvoiceId + '\')" title="View linked invoice">' +
        '🧾 ' + esc(docData.linkedInvoiceNum || 'Invoice') + '</a>');
    }

    // PO links
    if (docData.linkedPOId) {
      badges.push('<a class="linked-doc-badge badge-po" onclick="navigate(\'#/project/' + projectId + '/po/' + docData.linkedPOId + '\')" title="View linked PO">' +
        '📦 ' + esc(docData.linkedPONum || 'PO') + '</a>');
    }

    // Link button if no links yet
    if (badges.length === 0 && docType) {
      var collection = docType === 'proposal' ? 'proposals' : docType === 'invoice' ? 'invoices' : 'purchaseOrders';
      badges.push('<a class="linked-doc-badge" style="background:var(--gray-50);color:var(--gray-400);border-color:var(--gray-200);cursor:pointer;" ' +
        'onclick="linkDocModal(\'' + projectId + '\',\'' + collection + '\',\'' + docData.id + '\')" title="Link to other documents">' +
        '🔗 Link Documents</a>');
    }

    return badges.length > 0 ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">' + badges.join('') + '</div>' : '';
  };


  // ============================================================
  // 6. Patch renderDocEditPage header to include linked doc badges
  // ============================================================
  // renderDocEditPage badges now handled by hashchange listener in section 13 — no wrapper needed


  // ============================================================
  // 7. FEATURE #56 — Proposals summary band (week/month/YTD)
  // Override renderProposalsTab to add summary stats
  // ============================================================
  var _origRenderProposalsTab = window.renderProposalsTab;
  window.renderProposalsTab = async function(T, proj) {
    // Call original to render the base
    await _origRenderProposalsTab.call(this, T, proj);

    // Now inject summary band at top
    var proposals = [];
    try {
      var s = await db.collection('boards').doc(proj.id).collection('proposals').get();
      s.forEach(function(d) { proposals.push({ id: d.id, ...d.data() }); });
    } catch(e) { return; }

    if (typeof window.dedupeProposalsByNumber === 'function') {
      proposals = window.dedupeProposalsByNumber(proposals).list;
    }

    if (proposals.length === 0) return;

    var now = new Date();
    var startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    var startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    var startOfYear = new Date(now.getFullYear(), 0, 1);

    var weekTotal = 0, monthTotal = 0, ytdTotal = 0, allTotal = 0;
    var weekCount = 0, monthCount = 0, ytdCount = 0;
    var approvedCount = 0, pendingCount = 0;

    proposals.forEach(function(p) {
      var amt = parseFloat(p.total) || 0;
      allTotal += amt;
      var created = p.createdAt ? new Date(p.createdAt) : null;
      if (created) {
        if (created >= startOfWeek) { weekTotal += amt; weekCount++; }
        if (created >= startOfMonth) { monthTotal += amt; monthCount++; }
        if (created >= startOfYear) { ytdTotal += amt; ytdCount++; }
      }
      var status = (p.status || '').toLowerCase();
      if (status === 'approved' || status === 'invoiced') approvedCount++;
      else if (status === 'sent' || status === 'draft') pendingCount++;
    });

    var summaryHTML = '<div class="doc-summary-band">' +
      '<div class="doc-summary-card" style="background:linear-gradient(135deg,rgba(200,169,110,0.08),rgba(200,169,110,0.02));">' +
        '<div class="value" style="color:var(--gold);">' + formatMoney(weekTotal) + '</div>' +
        '<div class="label">This Week (' + weekCount + ')</div></div>' +
      '<div class="doc-summary-card" style="background:linear-gradient(135deg,rgba(94,198,198,0.08),rgba(94,198,198,0.02));">' +
        '<div class="value" style="color:var(--cyan);">' + formatMoney(monthTotal) + '</div>' +
        '<div class="label">This Month (' + monthCount + ')</div></div>' +
      '<div class="doc-summary-card" style="background:linear-gradient(135deg,rgba(95,165,107,0.08),rgba(95,165,107,0.02));">' +
        '<div class="value" style="color:#5FA56B;">' + formatMoney(ytdTotal) + '</div>' +
        '<div class="label">YTD (' + ytdCount + ')</div></div>' +
      '<div class="doc-summary-card" style="background:linear-gradient(135deg,rgba(27,51,82,0.06),rgba(27,51,82,0.02));">' +
        '<div class="value" style="color:var(--text-primary);">' + formatMoney(allTotal) + '</div>' +
        '<div class="label">All Time (' + proposals.length + ')</div></div>' +
      '<div class="doc-summary-card" style="background:linear-gradient(135deg,rgba(200,169,110,0.06),rgba(200,169,110,0.02));">' +
        '<div class="value" style="color:var(--gold);">' + approvedCount + ' <span style="font-size:12px;color:var(--gray-400);">/ ' + pendingCount + '</span></div>' +
        '<div class="label">Approved / Pending</div></div>' +
    '</div>';

    // Insert after the header (first child with flex layout)
    var headerEl = T.querySelector('div[style*="justify-content:space-between"]');
    if (headerEl && headerEl.nextSibling) {
      var bandDiv = document.createElement('div');
      bandDiv.innerHTML = summaryHTML;
      headerEl.parentNode.insertBefore(bandDiv, headerEl.nextSibling);
    }
  };


  // ============================================================
  // 8. FEATURE #57 + #66 — Invoices filter band + markup revenue
  // Override renderInvoicesTab to add filter + markup stat
  // ============================================================
  var _origRenderInvoicesTab = window.renderInvoicesTab;
  window._invoiceFilterPeriod = 'all';

  window.renderInvoicesTab = async function(T, proj) {
    // Call original
    await _origRenderInvoicesTab.call(this, T, proj);

    // Load invoices for markup calculation
    var invoices = [];
    try {
      var s = await db.collection('boards').doc(proj.id).collection('invoices').get();
      s.forEach(function(d) { invoices.push({ id: d.id, ...d.data() }); });
    } catch(e) { return; }

    if (invoices.length === 0) return;

    // Calculate markup revenue
    var totalMarkup = 0;
    invoices.forEach(function(inv) {
      (inv.items || []).forEach(function(item) {
        var cost = parseFloat(item.cost) || 0;
        var qty = parseFloat(item.qty) || 1;
        var sell = parseFloat(item.amount) || 0;
        if (cost > 0 && sell > cost * qty) {
          totalMarkup += (sell - cost * qty);
        }
      });
    });

    // Find the existing summary grid and add markup stat
    var summaryGrid = T.querySelector('div[style*="grid-template-columns:repeat(3"]');
    if (summaryGrid) {
      summaryGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
      var markupCard = document.createElement('div');
      markupCard.style.cssText = 'text-align:center;padding:14px;background:var(--gray-50);border-radius:0;';
      markupCard.innerHTML = '<div style="font-size:20px;font-weight:700;color:var(--gold);">' + formatMoney(totalMarkup) + '</div>' +
        '<div style="font-size:10px;color:var(--gray-400);text-transform:uppercase;margin-top:2px;">Markup Revenue</div>';
      summaryGrid.appendChild(markupCard);
    }

    // Add filter band
    var filterHTML = '<div class="doc-filter-band" id="invoiceFilterBand">' +
      '<button class="doc-filter-btn' + (window._invoiceFilterPeriod === 'week' ? ' active' : '') + '" onclick="filterInvoicesByPeriod(\'' + proj.id + '\',\'week\')">This Week</button>' +
      '<button class="doc-filter-btn' + (window._invoiceFilterPeriod === 'month' ? ' active' : '') + '" onclick="filterInvoicesByPeriod(\'' + proj.id + '\',\'month\')">This Month</button>' +
      '<button class="doc-filter-btn' + (window._invoiceFilterPeriod === 'ytd' ? ' active' : '') + '" onclick="filterInvoicesByPeriod(\'' + proj.id + '\',\'ytd\')">YTD</button>' +
      '<button class="doc-filter-btn' + (window._invoiceFilterPeriod === 'all' ? ' active' : '') + '" onclick="filterInvoicesByPeriod(\'' + proj.id + '\',\'all\')">All</button>' +
    '</div>';

    var sectionTitle = T.querySelector('.section-title');
    if (sectionTitle && sectionTitle.parentElement && sectionTitle.parentElement.nextSibling) {
      var existing = document.getElementById('invoiceFilterBand');
      if (!existing) {
        var bandDiv = document.createElement('div');
        bandDiv.innerHTML = filterHTML;
        sectionTitle.parentElement.parentNode.insertBefore(bandDiv, sectionTitle.parentElement.nextSibling);
      }
    }
  };

  window.filterInvoicesByPeriod = function(projectId, period) {
    window._invoiceFilterPeriod = period;
    var now = new Date();
    var cutoff = null;

    if (period === 'week') {
      cutoff = new Date(now);
      cutoff.setDate(now.getDate() - now.getDay());
      cutoff.setHours(0, 0, 0, 0);
    } else if (period === 'month') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'ytd') {
      cutoff = new Date(now.getFullYear(), 0, 1);
    }

    // Update button states
    var buttons = document.querySelectorAll('#invoiceFilterBand .doc-filter-btn');
    buttons.forEach(function(btn) {
      btn.classList.remove('active');
      if (btn.textContent.trim().toLowerCase().replace('this ', '') === period || btn.textContent.trim().toLowerCase() === period) {
        btn.classList.add('active');
      }
    });

    // Filter visible rows
    var table = document.getElementById('invoicesTable');
    if (table) {
      var rows = table.querySelectorAll('tbody tr');
      rows.forEach(function(row) {
        if (row.classList.contains('inv-items-row')) return; // skip expandable sub-rows
        if (!cutoff) {
          row.style.display = '';
          return;
        }
        var dateCell = row.querySelector('td.col-date');
        if (dateCell) {
          var dateText = dateCell.textContent.trim();
          var rowDate = dateText ? new Date(dateText) : null;
          row.style.display = (rowDate && rowDate >= cutoff) ? '' : 'none';
        }
      });
    }
  };


  // ============================================================
  // 9. Proposal view toggle (Category vs Room)
  // ============================================================
  window._proposalViewMode = 'category';

  window.toggleProposalView = function(mode, projectId, proposalId) {
    window._proposalViewMode = mode;
    // Re-render proposal detail
    if (typeof renderProposalDetail === 'function') {
      renderProposalDetail(projectId, proposalId);
    }
  };


  // ============================================================
  // 10. Fix: Vendor dropdown populated from project clips/team
  // Enhanced _piVendorOptions builder
  // ============================================================
  window._cachedVendors = null;

  window.loadProjectVendors = async function(projectId) {
    if (window._cachedVendors) return window._cachedVendors;
    var vendors = new Set();
    try {
      // From project clips
      var clipSnap = await db.collection('boards').doc(projectId).collection('clips').get();
      clipSnap.forEach(function(d) {
        var v = d.data().vendor;
        if (v) vendors.add(v.trim());
      });
    } catch(e) {}
    try {
      // From vendors collection
      var vendSnap = await db.collection('vendors').limit(500).get();
      vendSnap.forEach(function(d) {
        var v = d.data().name || d.data().company;
        if (v) vendors.add(v.trim());
      });
    } catch(e) {}
    try {
      // From team contacts
      var teamSnap = await db.collection('team').get();
      teamSnap.forEach(function(d) {
        var t = d.data();
        if (t.role === 'vendor' && (t.name || t.company)) {
          vendors.add((t.name || t.company).trim());
        }
      });
    } catch(e) {}
    window._cachedVendors = Array.from(vendors).sort();
    return window._cachedVendors;
  };

  window.buildVendorDatalist = function(vendors) {
    var dlId = 'vendorDatalist';
    var existing = document.getElementById(dlId);
    if (existing) existing.remove();
    var dl = document.createElement('datalist');
    dl.id = dlId;
    vendors.forEach(function(v) {
      var opt = document.createElement('option');
      opt.value = v;
      dl.appendChild(opt);
    });
    document.body.appendChild(dl);
    return dlId;
  };


  // ============================================================
  // 11. Fix: Prevent saving empty/non-items on invoices
  // Patch docEditSave to filter out blank items
  // ============================================================
  var _origDocEditSave = window.docEditSave;
  window.docEditSave = async function(goToViewAfter) {
    if (window._docEdit && window._docEdit.items) {
      // Remove completely blank items (no title, no cost, no amount)
      window._docEdit.items = window._docEdit.items.filter(function(item) {
        var hasTitle = (_itemTitleStub(item)) !== '';
        var hasCost = parseFloat(item.cost) > 0;
        var hasAmount = parseFloat(item.amount) > 0;
        var hasDesc = (item.description || '').trim() !== '';
        return hasTitle || hasCost || hasAmount || hasDesc;
      });
    }
    return _origDocEditSave.call(this, goToViewAfter);
  };

  function _itemTitleStub(item) {
    var t = (item.title || '').trim();
    if (t) return t;
    var d = (item.description || '').trim();
    if (d && typeof window.invoiceLineDisplayTitle === 'function') return window.invoiceLineDisplayTitle(item);
    return '';
  }


  // ============================================================
  // 12. Load company tax defaults from settings/serviceRates
  // ============================================================
  window._companyTaxConfig = null;

  async function loadCompanyTaxConfig() {
    if (window._companyTaxConfig) return window._companyTaxConfig;
    try {
      var doc = await db.collection('settings').doc('serviceRates').get();
      if (doc.exists) {
        var d = doc.data();
        window._companyTaxConfig = {
          defaultTaxRate: parseFloat(d.defaultTaxRate) || 0,
          taxable_product: d.taxable_product !== false,
          taxable_service: d.taxable_service === true,
          taxable_shipping: d.taxable_shipping === true,
          taxable_expense: d.taxable_expense === true,
          taxable_handling: d.taxable_handling === true,
          taxable_other_expense: d.taxable_other_expense === true
        };
      } else {
        window._companyTaxConfig = { defaultTaxRate: 0, taxable_product: true, taxable_service: false, taxable_shipping: true, taxable_expense: false, taxable_handling: false, taxable_other_expense: false };
      }
    } catch(e) {
      window._companyTaxConfig = { defaultTaxRate: 0, taxable_product: true, taxable_service: false, taxable_shipping: true, taxable_expense: false, taxable_handling: false, taxable_other_expense: false };
    }
    return window._companyTaxConfig;
  }

  // Load on init
  loadCompanyTaxConfig();

  // Helper: get taxable default for an expense type
  window.getDefaultTaxable = function(expenseType) {
    var cfg = window._companyTaxConfig || {};
    var key = 'taxable_' + (expenseType || 'product');
    return cfg[key] !== undefined ? cfg[key] : (expenseType === 'product');
  };

  // Patch showNewInvoiceModal to use company default tax rate
  var _origShowNewInvoiceModal2 = window.showNewInvoiceModal;
  window.showNewInvoiceModal = async function(projectId) {
    // Load tax config before creating
    await loadCompanyTaxConfig();
    await _origShowNewInvoiceModal2.call(this, projectId);

    // After the invoice is created and we navigate to it, set the tax rate
    setTimeout(async function() {
      if (window._docEdit && window._docEdit.docData) {
        var taxRate = window._docEdit.docData.taxRate;
        if (!taxRate || taxRate === 0) {
          // Try project first
          try {
            var projDoc = await db.collection('boards').doc(window._docEdit.projectId).get();
            if (projDoc.exists && projDoc.data().taxRate) {
              taxRate = projDoc.data().taxRate;
            }
          } catch(e) {}
          // Then company default
          if (!taxRate && window._companyTaxConfig && window._companyTaxConfig.defaultTaxRate > 0) {
            taxRate = window._companyTaxConfig.defaultTaxRate;
          }
          if (taxRate > 0) {
            window._docEdit.docData.taxRate = taxRate;
            try {
              await db.collection('boards').doc(window._docEdit.projectId)
                .collection(window._docEdit.collection).doc(window._docEdit.docId)
                .update({ taxRate: taxRate });
            } catch(e) {}
            if (typeof docEditRecalcTotals === 'function') docEditRecalcTotals();
            // Update the tax rate display
            var taxEl = document.querySelector('[onclick*="docEditUpdateTaxRate"]');
            if (taxEl) taxEl.textContent = taxRate + '%';
          }
        }
      }
    }, 1500);
  };


  // ============================================================
  // 13. Fix: PO + Invoice detail — linked doc badges via hashchange observer (no wrapper)
  // ============================================================
  window.addEventListener('hashchange', function() {
    var hash = window.location.hash || '';
    var poMatch = hash.match(/#\/project\/([^/]+)\/po\/([^/]+)/);
    var invMatch2 = hash.match(/#\/project\/([^/]+)\/invoice\/([^/]+)/);
    var proMatch = hash.match(/#\/project\/([^/]+)\/proposal\/([^/]+)/);
    if (!poMatch && !invMatch2 && !proMatch) return;

    // Wait for page to render, then inject badges
    setTimeout(function() {
      try {
        var headerH1 = document.querySelector('#contentArea h1');
        if (!headerH1 || !headerH1.parentElement) return;
        if (headerH1.parentElement.querySelector('.linked-doc-badges-area')) return;
        var docData = window._docEdit && window._docEdit.docData;
        if (!docData) return;
        var projectId = poMatch ? poMatch[1] : invMatch2 ? invMatch2[1] : proMatch[1];
        var docType = poMatch ? 'po' : invMatch2 ? 'invoice' : 'proposal';
        var badgesHTML = renderLinkedDocBadges(projectId, docData, docType);
        if (badgesHTML) {
          var badgesDiv = document.createElement('div');
          badgesDiv.className = 'linked-doc-badges-area';
          badgesDiv.innerHTML = badgesHTML;
          headerH1.parentElement.appendChild(badgesDiv);
        }
      } catch(e) { console.warn('Badge injection:', e); }
    }, 800);
  });


  // ============================================================
  // 14. Proposal detail enhancements via hashchange (no wrapper)
  // Linked doc badges + vendor datalist loaded on proposal pages
  // ============================================================
  // (Badges now handled by unified hashchange listener in section 13)


  // ============================================================
  // 15. Fix: showNewInvoiceModal — ensure status is "Draft"
  // (Already creates Draft, but patch to add dueDate if missing)
  // ============================================================
  var _origShowNewInvoiceModal = window.showNewInvoiceModal;
  window.showNewInvoiceModal = async function(projectId) {
    await _origShowNewInvoiceModal.call(this, projectId);
    // After navigation to new invoice, the status should be Draft — verify
    setTimeout(function() {
      if (window._docEdit && window._docEdit.docData) {
        if (!window._docEdit.docData.status || window._docEdit.docData.status === '') {
          window._docEdit.docData.status = 'Draft';
          try {
            db.collection('boards').doc(window._docEdit.projectId)
              .collection(window._docEdit.collection).doc(window._docEdit.docId)
              .update({ status: 'Draft' });
          } catch(e) {}
        }
      }
    }, 1000);
  };


  // ============================================================
  // 16. Fix: editProposalItem modal — add vendor datalist + better ship-to
  // Patch the original to attach vendor autocomplete after modal opens
  // ============================================================
  var _origEditProposalItem = window.editProposalItem;
  if (_origEditProposalItem) {
    window.editProposalItem = function(projectId, proposalId, idx) {
      _origEditProposalItem.call(this, projectId, proposalId, idx);
      // After modal renders, attach vendor datalist
      setTimeout(function() {
        var vendorInput = document.getElementById('piVendor');
        if (vendorInput && !vendorInput.getAttribute('list')) {
          loadProjectVendors(projectId).then(function(vendors) {
            if (vendors.length > 0) {
              var dlId = buildVendorDatalist(vendors);
              vendorInput.setAttribute('list', dlId);
            }
          });
        }
      }, 300);
    };
  }


  // ============================================================
  // 17. Fix: addProposalLineItem — also attach vendor datalist
  // ============================================================
  var _origAddProposalLineItem = window.addProposalLineItem;
  if (_origAddProposalLineItem) {
    window.addProposalLineItem = function(projectId, proposalId) {
      _origAddProposalLineItem.call(this, projectId, proposalId);
      setTimeout(function() {
        var vendorInput = document.getElementById('piVendor');
        if (vendorInput && !vendorInput.getAttribute('list')) {
          loadProjectVendors(projectId).then(function(vendors) {
            if (vendors.length > 0) {
              var dlId = buildVendorDatalist(vendors);
              vendorInput.setAttribute('list', dlId);
            }
          });
        }
      }, 300);
    };
  }


  // ============================================================
  // 18. Fix: docEditAddItem — attach vendor datalist after blank item added
  // ============================================================
  var _origDocEditAddBlankItem = window.docEditAddBlankItem;
  if (_origDocEditAddBlankItem) {
    window.docEditAddBlankItem = function() {
      _origDocEditAddBlankItem.call(this);
      setTimeout(function() {
        if (window._cachedVendors && window._cachedVendors.length > 0) {
          buildVendorDatalist(window._cachedVendors);
        }
      }, 200);
    };
  }


  // ============================================================
  // 19. Fix: Inline quick-edit for proposal items from list view
  // ============================================================
  window.quickEditProposalItem = async function(projectId, proposalId, itemIdx) {
    try {
      var doc = await db.collection('boards').doc(projectId).collection('proposals').doc(proposalId).get();
      if (!doc.exists) return;
      var items = doc.data().items || [];
      var item = items[itemIdx];
      if (!item) return;

      var boardSnap = await db.collection('boards').doc(projectId).get();
      var boardCats = boardSnap.exists ? (boardSnap.data().categories || []) : [];
      var catOpts = typeof _piCategoryOptions === 'function'
        ? _piCategoryOptions(item.category || '', boardCats)
        : '<option value="">(category)</option>';

      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:2000;display:flex;align-items:center;justify-content:center;';
      overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

      overlay.innerHTML = '<div style="background:#FFFFFF;width:560px;box-shadow:0 20px 60px rgba(27,51,82,0.25);padding:0;">' +
        '<div style="padding:16px 20px;border-bottom:1px solid rgba(27,51,82,0.08);font-size:16px;font-weight:700;color:#1B3352;display:flex;justify-content:space-between;align-items:center;">' +
          'Quick Edit: ' + esc(item.title || 'Item') +
          '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#7A7060;">&times;</button></div>' +
        '<div style="padding:20px;">' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
            '<div><label style="font-size:11px;font-weight:600;color:#7A7060;display:block;margin-bottom:4px;">Item Name</label>' +
              '<input class="form-input" id="qeTitle" value="' + escAttr(item.title || '') + '" style="font-size:13px;"></div>' +
            '<div><label style="font-size:11px;font-weight:600;color:#7A7060;display:block;margin-bottom:4px;">Vendor</label>' +
              '<input class="form-input" id="qeVendor" value="' + escAttr(item.vendor || '') + '" list="vendorDatalist" style="font-size:13px;"></div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:12px;">' +
            '<div><label style="font-size:11px;font-weight:600;color:#7A7060;display:block;margin-bottom:4px;">Qty</label>' +
              '<input class="form-input" id="qeQty" type="number" step="0.5" value="' + (parseFloat(item.qty) || 1) + '" style="font-size:13px;"></div>' +
            '<div><label style="font-size:11px;font-weight:600;color:#7A7060;display:block;margin-bottom:4px;">Cost</label>' +
              '<input class="form-input" id="qeCost" type="number" step="0.01" value="' + (parseFloat(item.cost) || 0).toFixed(2) + '" style="font-size:13px;"></div>' +
            '<div><label style="font-size:11px;font-weight:600;color:#7A7060;display:block;margin-bottom:4px;">Markup %</label>' +
              '<input class="form-input" id="qeMarkup" type="number" step="0.5" value="' + (parseFloat(item.markupPct) || 0) + '" style="font-size:13px;"></div>' +
            '<div><label style="font-size:11px;font-weight:600;color:#7A7060;display:block;margin-bottom:4px;">Shipping</label>' +
              '<input class="form-input" id="qeShipping" type="number" step="0.01" value="' + (parseFloat(item.shipping) || 0).toFixed(2) + '" style="font-size:13px;"></div>' +
          '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">' +
            '<div><label style="font-size:11px;font-weight:600;color:#7A7060;display:block;margin-bottom:4px;">Category</label>' +
              '<select class="form-input" id="qeCategory" style="font-size:13px;">' + catOpts + '</select></div>' +
            '<div><label style="font-size:11px;font-weight:600;color:#7A7060;display:block;margin-bottom:4px;">Room</label>' +
              '<select class="form-input" id="qeRoom" style="font-size:13px;">' + _piRoomOptions(item.room || '') + '</select></div>' +
            '<div><label style="font-size:11px;font-weight:600;color:#7A7060;display:block;margin-bottom:4px;">Ship To</label>' +
              '<select class="form-input" id="qeShipTo" style="font-size:13px;">' + _piShipToOptions(item.shipTo || '') + '</select></div>' +
          '</div>' +
          '<div style="display:flex;justify-content:flex-end;gap:8px;">' +
            '<button class="btn btn-secondary" onclick="this.closest(\'div[style*=fixed]\').remove()">Cancel</button>' +
            '<button class="btn btn-primary" onclick="saveQuickEdit(\'' + projectId + '\',\'' + proposalId + '\',' + itemIdx + ')">Save</button>' +
          '</div>' +
        '</div></div>';
      document.body.appendChild(overlay);

      // Load vendors for datalist
      loadProjectVendors(projectId);
    } catch(e) {
      console.error('Quick edit error:', e);
    }
  };

  window.saveQuickEdit = async function(projectId, proposalId, itemIdx) {
    try {
      var doc = await db.collection('boards').doc(projectId).collection('proposals').doc(proposalId).get();
      if (!doc.exists) return;
      var items = doc.data().items || [];
      var item = items[itemIdx];
      if (!item) return;

      item.title = document.getElementById('qeTitle').value.trim();
      item.vendor = document.getElementById('qeVendor').value.trim();
      item.qty = parseFloat(document.getElementById('qeQty').value) || 1;
      item.cost = parseFloat(document.getElementById('qeCost').value) || 0;
      item.markupPct = parseFloat(document.getElementById('qeMarkup').value) || 0;
      item.shipping = parseFloat(document.getElementById('qeShipping').value) || 0;
      item.category = (document.getElementById('qeCategory') && document.getElementById('qeCategory').value || '').trim();
      item.room = (document.getElementById('qeRoom') && document.getElementById('qeRoom').value || '').trim();
      item.shipTo = document.getElementById('qeShipTo').value;

      // Recalculate amount
      item.amount = (item.cost * item.qty * (1 + item.markupPct / 100)) + item.shipping;

      // Recalculate total
      var total = items.reduce(function(s, i) { return s + (parseFloat(i.amount) || 0); }, 0);

      await db.collection('boards').doc(projectId).collection('proposals').doc(proposalId).update({
        items: items,
        total: total,
        updatedAt: new Date().toISOString()
      });

      // Close modal
      var overlay = document.querySelector('div[style*="fixed"][style*="z-index:2000"]');
      if (overlay) overlay.remove();

      // Refresh view
      if (typeof renderProposalDetail === 'function') {
        renderProposalDetail(projectId, proposalId);
      }
      showToast('Item updated', 2000);
    } catch(e) {
      console.error('Save quick edit error:', e);
      alert('Error saving: ' + e.message);
    }
  };


  // ============================================================
  // 20. Fix: Tearsheet generation — ensure button is wired correctly
  // ============================================================
  window.generateTearSheetsFromDoc = window.generateTearSheetsFromDoc || async function(projectId, collection, docId, projName) {
    var items = [];
    try {
      var doc = await db.collection('boards').doc(projectId).collection(collection).doc(docId).get();
      if (doc.exists) items = doc.data().items || [];
    } catch(e) { alert('Could not load document'); return; }

    if (items.length === 0) { alert('No items to generate tear sheets from'); return; }

    // Ask about pricing
    var showPricing = confirm('Include pricing on tear sheets?\n\nOK = Show prices\nCancel = No prices (client version)');

    var win = window.open('', '_blank');
    win.document.write('<html><head><title>Tear Sheets — ' + esc(projName || 'Project') + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=DM+Serif+Display&display=swap" rel="stylesheet">' +
      '<style>' +
      'body { font-family: "DM Sans", sans-serif; padding: 0; margin: 0; color: #1B3352; background: #FAFAF7; }' +
      '.page { page-break-after: always; padding: 48px 56px; max-width: 850px; margin: 0 auto; }' +
      '.page:last-child { page-break-after: auto; }' +
      '.header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 3px solid #5EC6C6; padding-bottom: 16px; }' +
      '.logo { font-family: "DM Serif Display", serif; font-size: 36px; letter-spacing: 4px; }' +
      '.logo-sub { font-size: 10px; letter-spacing: 3px; color: #5EC6C6; text-transform: uppercase; }' +
      '.item-img { width: 320px; height: 320px; object-fit: cover; border-radius: 4px; }' +
      '.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 20px; }' +
      '.detail-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #999; font-weight: 600; margin-bottom: 2px; }' +
      '.detail-value { font-size: 14px; color: #333; }' +
      '.price-value { font-size: 20px; font-weight: 700; color: #C9A96E; }' +
      '.print-btn { position: fixed; top: 16px; right: 16px; background: #1B3352; color: #EDE8E0; border: 1px solid #1B3352; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-size: 13px; z-index: 100; font-family: "DM Sans", sans-serif; }' +
      '@media print { .print-btn { display: none !important; } }' +
      '</style></head><body>');

    win.document.write('<button class="print-btn" onclick="window.print()">Print Tear Sheets</button>');

    items.forEach(function(item, idx) {
      var qty = parseFloat(item.qty) || 1;
      var cost = parseFloat(item.cost) || 0;
      var amount = parseFloat(item.amount) || 0;
      var shipping = parseFloat(item.shipping) || 0;

      win.document.write('<div class="page">' +
        '<div class="header"><div><div class="logo">CCH</div><div class="logo-sub">Design Inc</div></div>' +
        '<div style="text-align:right;font-size:12px;color:#999;">' + esc(projName || '') + '<br>Item ' + (idx + 1) + ' of ' + items.length + '</div></div>' +
        '<div style="display:flex;gap:32px;">' +
          '<div>' + (item.imageUrl ? '<img class="item-img" src="' + escAttr(item.imageUrl) + '" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' : '<div class="item-img" style="background:#f5f3ee;display:flex;align-items:center;justify-content:center;font-size:64px;">📦</div>') + '</div>' +
          '<div style="flex:1;">' +
            '<h2 style="font-size:22px;font-weight:700;margin:0 0 8px;">' + esc(item.title || 'Untitled') + '</h2>' +
            (item.vendor ? '<div style="font-size:14px;color:#999;margin-bottom:12px;">' + esc(item.vendor) + '</div>' : '') +
            (item.description ? '<div style="font-size:13px;color:#555;line-height:1.7;margin-bottom:16px;">' + esc(item.description) + '</div>' : '') +
            '<div class="detail-grid">' +
              '<div><div class="detail-label">Room</div><div class="detail-value">' + esc(item.room || item.category || '—') + '</div></div>' +
              '<div><div class="detail-label">Quantity</div><div class="detail-value">' + qty + '</div></div>' +
              (showPricing ? '<div><div class="detail-label">Unit Price</div><div class="price-value">' + formatMoney(amount / qty) + '</div></div>' : '') +
              (showPricing ? '<div><div class="detail-label">Total</div><div class="price-value">' + formatMoney(amount) + '</div></div>' : '') +
              (showPricing && shipping > 0 ? '<div><div class="detail-label">Shipping</div><div class="detail-value">' + formatMoney(shipping) + '</div></div>' : '') +
              (item.shipTo ? '<div><div class="detail-label">Ship To</div><div class="detail-value">' + esc(item.shipTo) + '</div></div>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="margin-top:32px;padding-top:12px;border-top:1px solid #eee;font-size:10px;color:#bbb;text-align:center;">CCH Design Inc. · www.cchdesign.com · (949) 497-7979</div>' +
      '</div>');
    });

    win.document.write('</body></html>');
    win.document.close();
  };


  // ============================================================
  // 21. Send to Client — marks as Sent, records sentDate, shows toast
  // ============================================================
  window.sendInvoiceToClient = async function(projectId, invoiceId) {
    try {
      var doc = await db.collection('boards').doc(projectId).collection('invoices').doc(invoiceId).get();
      if (!doc.exists) { alert('Invoice not found'); return; }
      var inv = doc.data();
      var invNum = inv.invoiceNum || inv.number || invoiceId.slice(0, 8);
      var clientEmail = inv.clientEmail || '';
      var clientName = inv.clientName || '';

      // If no client email, try project
      if (!clientEmail) {
        try {
          var projDoc = await db.collection('boards').doc(projectId).get();
          if (projDoc.exists) {
            var pd = projDoc.data();
            clientEmail = pd.clientEmail || '';
            clientName = clientName || pd.clientName || '';
          }
        } catch(e) {}
      }

      // Show send confirmation with email
      var msg = 'Send Invoice ' + invNum + ' to client?';
      if (clientName) msg += '\n\nClient: ' + clientName;
      if (clientEmail) msg += '\nEmail: ' + clientEmail;
      msg += '\n\nThis will:\n• Mark status as "Sent"\n• Record today as the sent date';
      if (clientEmail) msg += '\n• Copy email to clipboard for sending';

      if (!confirm(msg)) return;

      var now = new Date().toISOString();
      var today = now.split('T')[0];

      // Update invoice
      await db.collection('boards').doc(projectId).collection('invoices').doc(invoiceId).update({
        status: 'Sent',
        sentDate: today,
        sentAt: now,
        sentTo: clientEmail || clientName || 'client'
      });

      // Log activity
      if (typeof logDocActivity === 'function') {
        logDocActivity(projectId, 'invoices', invoiceId, 'sent', 'Sent to ' + (clientEmail || clientName || 'client'));
      }

      // Copy email to clipboard if available
      if (clientEmail) {
        try {
          await navigator.clipboard.writeText(clientEmail);
          showToast('Invoice marked as Sent. Client email copied to clipboard: ' + clientEmail, 4000);
        } catch(e) {
          showToast('Invoice ' + invNum + ' marked as Sent', 3000);
        }
      } else {
        showToast('Invoice ' + invNum + ' marked as Sent', 3000);
      }

      // Also open preview for printing/emailing
      if (confirm('Open invoice preview to print or email as PDF?')) {
        previewDocument('invoice', projectId, invoiceId);
      }

      // Refresh
      if (typeof _cacheTime !== 'undefined') _cacheTime = 0;
      if (typeof invalidateSearchCache === 'function') invalidateSearchCache();
      if (window.location.hash.includes('/project/')) {
        if (typeof renderProjectDetail === 'function') renderProjectDetail();
      } else {
        if (typeof renderAllInvoices === 'function') renderAllInvoices();
      }
    } catch(e) {
      console.error('Send invoice error:', e);
      alert('Error: ' + e.message);
    }
  };


  // ============================================================
  // 21b. Send Proposal to Client
  // ============================================================
  window.sendProposalToClient = async function(projectId, proposalId) {
    try {
      var doc = await db.collection('boards').doc(projectId).collection('proposals').doc(proposalId).get();
      if (!doc.exists) { alert('Proposal not found'); return; }
      var prop = doc.data();
      var propNum = prop.proposalNum || prop.name || proposalId.slice(0, 8);
      var clientEmail = prop.clientEmail || '';
      var clientName = prop.clientName || '';

      if (!clientEmail) {
        try {
          var projDoc = await db.collection('boards').doc(projectId).get();
          if (projDoc.exists) { var pd = projDoc.data(); clientEmail = pd.clientEmail || ''; clientName = clientName || pd.clientName || ''; }
        } catch(e) {}
      }

      var msg = 'Send Proposal ' + propNum + ' to client?';
      if (clientName) msg += '\n\nClient: ' + clientName;
      if (clientEmail) msg += '\nEmail: ' + clientEmail;
      msg += '\n\nThis will:\n• Mark status as "Sent"\n• Record today as the sent date';

      if (!confirm(msg)) return;

      await db.collection('boards').doc(projectId).collection('proposals').doc(proposalId).update({
        status: 'Sent', sentDate: new Date().toISOString().split('T')[0], sentAt: new Date().toISOString(), sentTo: clientEmail || clientName || 'client'
      });

      if (typeof logDocActivity === 'function') logDocActivity(projectId, 'proposals', proposalId, 'sent', 'Sent to ' + (clientEmail || clientName || 'client'));

      if (clientEmail) { try { await navigator.clipboard.writeText(clientEmail); } catch(e) {} }
      showToast('Proposal ' + propNum + ' marked as Sent', 3000);

      if (confirm('Open proposal preview to print or email as PDF?')) { previewDocument('proposal', projectId, proposalId); }

      if (typeof _cacheTime !== 'undefined') _cacheTime = 0;
      if (typeof invalidateSearchCache === 'function') invalidateSearchCache();
      if (typeof renderProjectDetail === 'function') renderProjectDetail();
    } catch(e) { console.error('Send proposal error:', e); alert('Error: ' + e.message); }
  };


  // ============================================================
  // 22. Mark Invoice Past Due
  // ============================================================
  window.markInvoicePastDue = async function(projectId, invoiceId) {
    try {
      await db.collection('boards').doc(projectId).collection('invoices').doc(invoiceId).update({
        status: 'Past Due',
        pastDueAt: new Date().toISOString()
      });
      if (typeof logDocActivity === 'function') {
        logDocActivity(projectId, 'invoices', invoiceId, 'past_due', 'Marked as Past Due');
      }
      showToast('Invoice marked as Past Due', 2000);

      if (typeof _cacheTime !== 'undefined') _cacheTime = 0;
      if (typeof invalidateSearchCache === 'function') invalidateSearchCache();
      if (window.location.hash.includes('/project/')) {
        if (typeof renderProjectDetail === 'function') renderProjectDetail();
      } else {
        if (typeof renderAllInvoices === 'function') renderAllInvoices();
      }
    } catch(e) {
      console.error('Past due error:', e);
      alert('Error: ' + e.message);
    }
  };


  // ============================================================
  // 23. Duplicate Invoice
  // ============================================================
  window.duplicateInvoice = async function(projectId, invoiceId) {
    try {
      var doc = await db.collection('boards').doc(projectId).collection('invoices').doc(invoiceId).get();
      if (!doc.exists) { alert('Invoice not found'); return; }
      var inv = doc.data();

      if (!confirm('Duplicate this invoice? A new draft invoice will be created with the same items.')) return;

      var newNum = await window.getNextDocNumber('INV');
      var _cUser = (currentUser && currentUser.displayName) || (currentUser && currentUser.email) || 'Unknown';

      // Deep copy items
      var items = JSON.parse(JSON.stringify(inv.items || []));

      var newInv = {
        invoiceNum: newNum,
        number: newNum,
        status: 'Draft',
        total: inv.total || 0,
        items: items,
        vendor: inv.vendor || '',
        clientName: inv.clientName || '',
        clientEmail: inv.clientEmail || '',
        clientPhone: inv.clientPhone || '',
        clientAddress: inv.clientAddress || '',
        taxRate: inv.taxRate || 0,
        documentTags: inv.documentTags || '',
        notes: inv.notes || '',
        memo: inv.memo || '',
        createdAt: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        payments: [],
        published: false,
        _duplicatedFrom: invoiceId,
        _duplicatedFromNum: inv.invoiceNum || inv.number || '',
        createdBy: _cUser,
        createdByEmail: (currentUser && currentUser.email) || '',
        activityLog: [{
          action: 'duplicated',
          details: 'Duplicated from ' + (inv.invoiceNum || inv.number || 'invoice'),
          userName: _cUser,
          userEmail: (currentUser && currentUser.email) || '',
          timestamp: new Date().toISOString()
        }]
      };

      var newRef = await db.collection('boards').doc(projectId).collection('invoices').add(newInv);
      showToast('Invoice ' + newNum + ' created (copy of ' + (inv.invoiceNum || inv.number) + ')', 3000);

      if (typeof _cacheTime !== 'undefined') _cacheTime = 0;
      navigate('#/project/' + projectId + '/invoice/' + newRef.id);
    } catch(e) {
      console.error('Duplicate invoice error:', e);
      alert('Error: ' + e.message);
    }
  };


  // ============================================================
  // 24. Archive Invoice
  // ============================================================
  window.archiveInvoice = async function(projectId, invoiceId) {
    if (!confirm('Archive this invoice? It will be hidden from the active list.')) return;
    try {
      await db.collection('boards').doc(projectId).collection('invoices').doc(invoiceId).update({
        status: 'Archived',
        archivedAt: new Date().toISOString()
      });
      if (typeof logDocActivity === 'function') {
        logDocActivity(projectId, 'invoices', invoiceId, 'archived', 'Invoice archived');
      }
      showToast('Invoice archived', 2000);
      if (typeof _cacheTime !== 'undefined') _cacheTime = 0;
      if (typeof invalidateSearchCache === 'function') invalidateSearchCache();
      if (window.location.hash.includes('/project/')) {
        if (typeof renderProjectDetail === 'function') renderProjectDetail();
      } else {
        if (typeof renderAllInvoices === 'function') renderAllInvoices();
      }
    } catch(e) {
      console.error('Archive error:', e);
      alert('Error: ' + e.message);
    }
  };


  // ============================================================
  // 25. Publish = client dashboard visibility only (do NOT set Sent)
  // ============================================================
  var _origTogglePublished = window.togglePublished;
  window.togglePublished = async function(projectId, docId, newValue, collection) {
    var col = collection || 'proposals';
    if (newValue === true && col === 'invoices') {
      try {
        await db.collection('boards').doc(projectId).collection(col).doc(docId).set({
          publishedAt: new Date().toISOString()
        }, { merge: true });
      } catch(e) { console.warn('publishedAt stamp failed:', e); }
    }
    return _origTogglePublished.call(this, projectId, docId, newValue, collection);
  };


  // ============================================================
  // 26. Add "Past Due" badge color
  // ============================================================
  var pastDueStyle = document.createElement('style');
  pastDueStyle.textContent = `
    .badge-past-due, .badge-past\\ due {
      background: rgba(198,40,40,0.12) !important;
      color: #C62828 !important;
      border: 1px solid rgba(198,40,40,0.2) !important;
    }
    .badge-sent {
      background: rgba(94,198,198,0.12) !important;
      color: #00838F !important;
      border: 1px solid rgba(94,198,198,0.2) !important;
    }
    .badge-unsent {
      background: rgba(196,164,100,0.12) !important;
      color: #7A6418 !important;
      border: 1px solid rgba(196,164,100,0.25) !important;
    }
    .badge-archived {
      background: rgba(120,120,120,0.12) !important;
      color: #757575 !important;
      border: 1px solid rgba(120,120,120,0.2) !important;
    }
  `;
  document.head.appendChild(pastDueStyle);


  // ============================================================
  // 27. Enhance invoice detail topbar with Send + Publish buttons
  // ============================================================
  // Instead of wrapping renderInvoiceDetail (which breaks the chain),
  // use a MutationObserver to inject buttons AFTER the page renders
  var _invDetailObserver = null;
  window.addEventListener('hashchange', function() {
    if (_invDetailObserver) { _invDetailObserver.disconnect(); _invDetailObserver = null; }
    var hash = window.location.hash || '';
    var invMatch = hash.match(/#\/project\/([^/]+)\/invoice\/([^/]+)/);
    if (!invMatch) return;
    var projectId = invMatch[1];
    var invoiceId = invMatch[2];

    // Watch for topbar to appear, then inject buttons once
    _invDetailObserver = new MutationObserver(function() {
      var topbar = document.querySelector('.topbar-actions');
      if (!topbar) return;
      if (topbar.innerHTML.indexOf('sendInvoiceToClient') >= 0) return;
      var saveBtn = topbar.querySelector('button[onclick*="docEditSave"]');
      if (!saveBtn) return;

      var sendBtn = document.createElement('button');
      sendBtn.className = 'btn btn-sm';
      sendBtn.style.cssText = 'background:#00838F;color:#EDE8E0;border:none;margin-right:4px;';
      sendBtn.innerHTML = '📧 Send to Client';
      sendBtn.onclick = function() { sendInvoiceToClient(projectId, invoiceId); };

      var publishBtn = document.createElement('button');
      publishBtn.className = 'btn btn-secondary btn-sm';
      publishBtn.innerHTML = '🌐 Publish to Dashboard';
      publishBtn.onclick = function() { togglePublished(projectId, invoiceId, true, 'invoices'); };

      var dupBtn = document.createElement('button');
      dupBtn.className = 'btn btn-secondary btn-sm';
      dupBtn.innerHTML = '📋 Duplicate';
      dupBtn.onclick = function() { duplicateInvoice(projectId, invoiceId); };

      topbar.insertBefore(dupBtn, saveBtn);
      topbar.insertBefore(publishBtn, saveBtn);
      topbar.insertBefore(sendBtn, saveBtn);

      // Done — stop observing
      _invDetailObserver.disconnect();
      _invDetailObserver = null;
    });
    _invDetailObserver.observe(document.body, { childList: true, subtree: true });
  });


  // ============================================================
  // 28. MY ITEMS PANEL — Auto-open on doc edit, Houzz-style persistent sidebar
  // ============================================================

  // ============================================================
  // 30. INVOICE/PO VIEW MODE — Read-only view, Edit button to switch
  // ============================================================
  window.renderDocViewPage = function(type, projectId, docId, docData, items, projData) {
    var T = document.getElementById('contentArea');
    var projName = projData.name || projectId;
    var collection = type === 'invoice' ? 'invoices' : type === 'po' ? 'purchaseOrders' : 'proposals';
    var typeLabel = type === 'invoice' ? 'Invoice' : type === 'po' ? 'Purchase Order' : 'Proposal';
    var backTab = type === 'invoice' ? 'invoices' : type === 'po' ? 'pos' : 'proposals';
    var docNum = docData.invoiceNum || docData.number || docData.proposalNum || docData.name || docId.slice(0,8);

    // Client info — match common project / CRM field names
    var clientName = docData.clientName || docData.client || docData.billingContactName ||
      projData.clientName || projData.billingContactName || '';
    var clientEmail = docData.clientEmail || docData.contactEmail || docData.email ||
      projData.clientEmail || projData.contactEmail || projData.email || '';
    var clientPhone = docData.clientPhone || docData.phone || docData.contactPhone ||
      projData.clientPhone || projData.phone || projData.contactPhone || '';
    var clientAddress = docData.clientAddress || docData.billingAddress || docData.mailingAddress ||
      docData.streetAddress || docData.address ||
      projData.clientAddress || projData.billingAddress || projData.mailingAddress ||
      projData.streetAddress || projData.address || '';
    var clientCompany = docData.clientCompany || projData.clientCompany || '';
    var clientAddress2 = docData.clientAddress2 || docData.secondaryAddress || projData.clientAddress2 || projData.secondaryAddress || '';

    // Totals — tax cascade: doc → project → company default
    var subtotal = 0, taxableSubtotal = 0, totalShipping = 0;
    items.forEach(function(i) {
      if (typeof isProposalGroupHeaderItem === 'function' && isProposalGroupHeaderItem(i)) return;
      var qty = parseFloat(i.qty) || 1;
      var cost = parseFloat(i.cost) || 0;
      var mkup = parseFloat(i.markupPct) || 0;
      var ship = parseFloat(i.shipping) || 0;
      var amt = parseFloat(i.amount) || 0;
      var lineAmt = (cost > 0 ? cost * qty * (1 + mkup / 100) : amt);
      subtotal += lineAmt;
      var isTaxable = i.taxable !== false && (i.taxable === true || i.expenseType === 'product' || (!i.expenseType && i.taxable !== false));
      if (isTaxable) taxableSubtotal += lineAmt;
      totalShipping += ship;
    });
    var taxRate = parseFloat(docData.taxRate) || parseFloat(projData.taxRate) || (window._companyTaxConfig ? window._companyTaxConfig.defaultTaxRate : 0) || 0;
    var tax = taxableSubtotal * (taxRate / 100);
    var grandTotal = subtotal + totalShipping + tax;
    var payments = docData.payments || [];
    var totalPaid = payments.reduce(function(s,p) { return s + (parseFloat(p.amount) || 0); }, 0);
    var balance = grandTotal - totalPaid;

    // Group items — invoices: Design Services + rooms (matches PDF preview)
    var grouped = {};
    if (type === 'invoice' && typeof window.buildInvoicePreviewGroupedByDesignServices === 'function') {
      var forInv = [];
      items.forEach(function(item, idx) {
        if (typeof isProposalGroupHeaderItem === 'function' && isProposalGroupHeaderItem(item)) return;
        forInv.push(Object.assign({}, item, { _idx: idx }));
      });
      grouped = window.buildInvoicePreviewGroupedByDesignServices(forInv);
    } else {
      items.forEach(function(item, idx) {
        if (typeof isProposalGroupHeaderItem === 'function' && isProposalGroupHeaderItem(item)) return;
        var cat = item.room || item.category || 'General';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(Object.assign({}, item, { _idx: idx }));
      });
    }

    var statusBadge = docData.status ? '<span class="badge badge-' + (docData.status || 'draft').toLowerCase().replace(/\s+/g, '-') + '" style="font-size:13px;padding:6px 14px;">' + esc(docData.status) + '</span>' : '';

    var _canPushQBView = (typeof userCanPushToQB === 'function' ? userCanPushToQB() : false);
    var qbRealId = (typeof getQbId === 'function' ? getQbId(docData) : (docData.qbDocId || null));
    var qbViewTopBtn = '';
    if (type === 'invoice' || type === 'po') {
      if (qbRealId) {
        qbViewTopBtn = '<span class="badge badge-approved" style="font-size:11px;padding:5px 12px;margin-left:4px;">✅ QB Synced (' + esc(String(qbRealId)) + ')</span>';
      } else if (docData.qbPushPending) {
        qbViewTopBtn = '<span class="badge" style="font-size:11px;padding:5px 12px;margin-left:4px;background:rgba(245,158,11,0.15);color:#92400E;border:1px solid rgba(245,158,11,0.35);" title="Cloud sync in progress — usually under 1 minute. Refresh to update.">⏳ QB queued</span>';
      } else if (_canPushQBView) {
        var _qbErrHint = docData.qbPushLastError ? escAttr('Last error: ' + String(docData.qbPushLastError)) : '';
        qbViewTopBtn = '<button class="btn btn-sm" style="background:#2CA01C;color:#1B3352;border:none;margin-left:4px;" title="' + _qbErrHint + '" onclick="pushDocToQB(\'' + type + '\',\'' + projectId + '\',\'' + docId + '\',this)">📤 Push to QuickBooks</button>';
      } else {
        qbViewTopBtn = '<span style="font-size:11px;color:var(--gray-400);margin-left:8px;">QuickBooks push not available for this account</span>';
      }
    }
    var lineItemsQbBtn = '';
    if (type === 'invoice' && !qbRealId && _canPushQBView) {
      if (docData.qbPushPending) {
        lineItemsQbBtn = '<span style="font-size:11px;color:#92400E;font-weight:600;padding:6px 12px;white-space:nowrap;">⏳ Queued for QuickBooks…</span>';
      } else {
        var _qbLineTitle = docData.qbPushLastError ? escAttr(String(docData.qbPushLastError)) : '';
        lineItemsQbBtn = '<button type="button" class="btn btn-sm" style="background:#2CA01C;color:#1B3352;border:none;font-size:11px;padding:6px 12px;white-space:nowrap;" title="' + _qbLineTitle + '" onclick="event.stopPropagation();pushDocToQB(\'invoice\',\'' + projectId + '\',\'' + docId + '\',this)">📤 Push to QuickBooks</button>';
      }
    }

    // Linked docs
    var linkedHTML = '';
    if (docData.linkedProposalId) linkedHTML += '<a class="linked-doc-badge badge-proposal" onclick="navigate(\'#/project/' + projectId + '/proposal/' + docData.linkedProposalId + '\')" style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;cursor:pointer;background:rgba(200,169,110,0.12);color:#C9A96E;text-decoration:none;margin-right:6px;">📋 ' + esc(docData.linkedProposalNum || 'Proposal') + '</a>';
    if (docData.linkedInvoiceId) linkedHTML += '<a class="linked-doc-badge badge-invoice" onclick="navigate(\'#/project/' + projectId + '/invoice/' + docData.linkedInvoiceId + '\')" style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;cursor:pointer;background:rgba(94,198,198,0.12);color:#3BA8A8;text-decoration:none;margin-right:6px;">🧾 ' + esc(docData.linkedInvoiceNum || 'Invoice') + '</a>';
    if (docData.linkedPOId) linkedHTML += '<a class="linked-doc-badge badge-po" onclick="navigate(\'#/project/' + projectId + '/po/' + docData.linkedPOId + '\')" style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;cursor:pointer;background:rgba(0,150,136,0.12);color:#00796B;text-decoration:none;">📦 ' + esc(docData.linkedPONum || 'PO') + '</a>';

    setBreadcrumb([
      { label: 'Projects', hash: '#/projects' },
      { label: projName, hash: '#/project/' + projectId + '/' + backTab },
      { label: typeLabel + ' ' + docNum }
    ]);

    setTopbarActions(
      '<button class="btn btn-secondary btn-sm" onclick="toggleDocTimeline(\'' + projectId + '\',\'' + collection + '\',\'' + docId + '\')">🕐 Timeline</button>' +
      '<button class="btn btn-secondary btn-sm" onclick="navigate(\'#/project/' + projectId + '/' + backTab + '\')">← Back</button>' +
      '<button class="btn btn-secondary btn-sm" onclick="previewDocument(\'' + type + '\',\'' + projectId + '\',\'' + docId + '\')">👁️ Preview</button>' +
      (type === 'invoice' ? '<button class="btn btn-secondary btn-sm" onclick="sendInvoiceToClient(\'' + projectId + '\',\'' + docId + '\')">📧 Send</button>' : '') +
      '<button class="btn btn-secondary btn-sm" onclick="togglePublished(\'' + projectId + '\',\'' + docId + '\',true,\'' + collection + '\')">🌐 Publish</button>' +
      qbViewTopBtn +
      '<button class="btn btn-primary btn-sm" onclick="window._forceEditMode=true;navigate(window.location.hash)" style="background:#1B3352;color:#EDE8E0;">✏️ Edit ' + typeLabel + '</button>'
    );

    // Build items HTML
    var itemsHTML = '';
    Object.keys(grouped).sort().forEach(function(cat) {
      var catItems = grouped[cat];
      var catTotal = catItems.reduce(function(s, i) { return s + (parseFloat(i.amount) || 0); }, 0);
      itemsHTML += '<div style="margin-bottom:28px;">' +
        '<div style="font-size:14px;font-weight:600;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid var(--gold);display:flex;justify-content:space-between;">' +
          '<span>' + esc(cat) + '</span>' +
          '<span style="font-size:13px;color:var(--gray-500);">' + formatMoney(catTotal) + '</span>' +
        '</div>' +
        '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="border-bottom:1px solid var(--gray-200);">' +
          '<th style="width:80px;padding:8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;"></th>' +
          '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;">Item</th>' +
          '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;">Vendor</th>' +
          '<th style="padding:8px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;">Qty</th>' +
          '<th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;">Cost</th>' +
          '<th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;">Markup</th>' +
          '<th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;">Shipping</th>' +
          '<th style="padding:8px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;width:50px;">Tax</th>' +
          '<th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;">Total</th>' +
        '</tr></thead><tbody>';
      catItems.forEach(function(item) {
        var qty = parseFloat(item.qty) || 1;
        var cost = parseFloat(item.cost) || 0;
        var mkup = parseFloat(item.markupPct) || 0;
        var ship = parseFloat(item.shipping) || 0;
        var amt = parseFloat(item.amount) || 0;
        var isTaxable = item.taxable !== false && (item.taxable === true || item.expenseType === 'product' || (!item.expenseType && item.taxable !== false));
        var isSvcRow = item.expenseType === 'service' || item.itemType === 'service';
        var imgTag;
        if (type === 'invoice' && isSvcRow) {
          imgTag = '<div style="width:64px;height:64px;background:transparent;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--gray-300);border:1px dashed var(--gray-200);">—</div>';
        } else if (item.imageUrl) {
          imgTag = '<img src="' + escAttr(item.imageUrl) + '" style="width:64px;height:64px;object-fit:cover;border-radius:4px;" onerror="this.style.display=\'none\'" referrerpolicy="no-referrer">';
        } else {
          imgTag = '<div style="width:64px;height:64px;background:var(--gray-50);display:flex;align-items:center;justify-content:center;font-size:24px;border-radius:4px;">📦</div>';
        }
        var lineNotes = (item.lineNotes || item.notes || '').trim();
        var descRaw = item.description || '';
        if (type === 'invoice' && typeof window.sanitizeInvoicePreviewLineText === 'function') {
          descRaw = window.sanitizeInvoicePreviewLineText(descRaw);
          lineNotes = window.sanitizeInvoicePreviewLineText(lineNotes);
        }
        var descHtml = descRaw ? '<div style="font-size:12px;color:var(--gray-400);margin-top:2px;white-space:pre-wrap;">' + esc(descRaw) + '</div>' : '';
        var notesHtml = '';
        if (lineNotes) {
          var _nl = String(lineNotes).split(/\r?\n/).map(function(l) { return l.trim(); }).filter(Boolean);
          if (_nl.length <= 1) {
            notesHtml = '<div style="font-size:11px;color:var(--gray-500);margin-top:4px;white-space:pre-wrap;line-height:1.45;">' + esc(lineNotes) + '</div>';
          } else {
            notesHtml = '<ul style="font-size:11px;color:var(--gray-500);margin:6px 0 0 1.1em;padding:0;line-height:1.45;list-style:disc;">' +
              _nl.map(function(l) { return '<li style="margin:2px 0;">' + esc(l) + '</li>'; }).join('') + '</ul>';
          }
        }
        var _lineTitle = typeof window.invoiceLineDisplayTitle === 'function' ? window.invoiceLineDisplayTitle(item) : (item.title || 'Untitled');
        itemsHTML += '<tr style="border-bottom:1px solid var(--gray-100);">' +
          '<td style="padding:10px 8px;">' + imgTag + '</td>' +
          '<td style="padding:10px 8px;"><div style="font-size:14px;font-weight:600;">' + esc(_lineTitle) + '</div>' +
            descHtml + notesHtml +
            (item.shipTo && type !== 'invoice' ? '<div style="font-size:11px;color:var(--teal);margin-top:2px;">📍 ' + esc(item.shipTo) + '</div>' : '') +
            (item.expenseType && item.expenseType !== 'product' ? '<div style="font-size:10px;margin-top:2px;"><span style="padding:1px 6px;border-radius:8px;background:rgba(200,169,110,0.12);color:var(--gold);font-weight:600;">' + esc(item.expenseType) + '</span></div>' : '') +
          '</td>' +
          '<td style="padding:10px 8px;font-size:13px;color:var(--gray-500);">' + esc(item.vendor || '') + '</td>' +
          '<td style="padding:10px 8px;text-align:center;font-size:14px;">' + qty + '</td>' +
          '<td style="padding:10px 8px;text-align:right;font-size:13px;font-family:monospace;">' + (cost > 0 ? formatMoney(cost) : '—') + '</td>' +
          '<td style="padding:10px 8px;text-align:right;font-size:13px;color:' + (mkup > 0 ? 'var(--green)' : 'var(--gray-400)') + ';">' + (mkup > 0 ? mkup + '%' : '—') + '</td>' +
          '<td style="padding:10px 8px;text-align:right;font-size:13px;color:var(--gray-400);">' + (ship > 0 ? formatMoney(ship) : '—') + '</td>' +
          '<td style="padding:10px 8px;text-align:center;">' + (isTaxable ? '<span style="color:#5FA56B;font-weight:700;">✓</span>' : '<span style="color:#ccc;">—</span>') + '</td>' +
          '<td style="padding:10px 8px;text-align:right;font-size:14px;font-weight:600;font-family:monospace;">' + formatMoney(amt) + '</td>' +
        '</tr>';
      });
      itemsHTML += '</tbody></table></div>';
    });

    // Payments HTML
    var paymentsHTML = '';
    if (payments.length > 0) {
      paymentsHTML = '<div style="margin-top:16px;padding:16px;background:var(--gray-50);border-radius:0;">' +
        '<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);margin-bottom:8px;">Payments</div>';
      payments.forEach(function(p) {
        paymentsHTML += '<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;">' +
          '<span style="color:var(--gray-500);">' + formatDate(p.date) + (p.method ? ' · ' + esc(p.method) : '') + (p.note ? ' · ' + esc(p.note) : '') + '</span>' +
          '<span style="color:var(--green);font-weight:600;">' + formatMoney(p.amount) + '</span></div>';
      });
      paymentsHTML += '</div>';
    }

    // Notes/memo
    var memoHTML = (docData.memo || docData.notes) ?
      '<div style="margin-top:16px;padding:16px;background:var(--gray-50);border-radius:0;">' +
        '<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);margin-bottom:6px;">Notes</div>' +
        '<div style="font-size:13px;color:var(--gray-600);line-height:1.6;">' + esc(docData.memo || docData.notes || '') + '</div></div>' : '';

    T.innerHTML =
      '<div style="max-width:900px;margin:0 auto;">' +
        // Header
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">' +
          '<div>' +
            '<h1 style="font-size:24px;font-weight:700;font-family:var(--font-display);color:var(--text-primary);margin-bottom:6px;">' + typeLabel + ' ' + esc(docNum) + '</h1>' +
            '<div style="color:var(--gray-400);font-size:13px;">' +
              esc(projName) + (docData.vendor ? ' · ' + esc(docData.vendor) : '') +
              (type !== 'invoice' && (docData.date || docData.createdAt) ? ' · ' + formatDate(docData.date || docData.createdAt) : '') +
            '</div>' +
            (linkedHTML ? '<div style="margin-top:8px;">' + linkedHTML + '</div>' : '') +
          '</div>' +
          '<div style="text-align:right;">' +
            '<div style="margin-bottom:8px;">' + statusBadge + '</div>' +
            '<div style="font-size:30px;font-weight:700;color:' + (balance <= 0 && totalPaid > 0 ? 'var(--green)' : 'var(--text-primary)') + ';font-family:var(--font-mono);">' + formatMoney(balance > 0 ? balance : grandTotal) + '</div>' +
            (totalPaid > 0 ? '<div style="font-size:11px;color:var(--gray-400);">of ' + formatMoney(grandTotal) + ' total</div>' : '<div style="font-size:11px;color:var(--gray-400);">' + items.length + ' items</div>') +
          '</div>' +
        '</div>' +

        // Client info card
        (clientName || clientEmail || clientPhone || clientAddress ? '<div style="background:#FFFFFF;padding:20px 24px;margin-bottom:20px;border:1px solid rgba(200,185,154,0.08);">' +
          '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--gray-400);font-weight:600;margin-bottom:10px;">Bill To</div>' +
          '<div style="font-size:14px;">' +
            (typeof window.buildPremiumBillToHtml === 'function' ? window.buildPremiumBillToHtml(clientName, clientAddress, clientPhone, clientEmail, clientCompany, clientAddress2) : (
              (clientName ? '<strong>' + esc(clientName) + '</strong><br>' : '') +
              (clientCompany ? esc(clientCompany) + '<br>' : '') +
              (clientAddress ? esc(clientAddress) + '<br>' : '') +
              (clientAddress2 ? esc(clientAddress2) + '<br>' : '') +
              (clientPhone ? esc(clientPhone) + '<br>' : '') +
              (clientEmail ? esc(clientEmail) : '')
            )) +
          '</div></div>' : '') +

        // Items
        '<div style="background:#FFFFFF;padding:20px 24px;margin-bottom:20px;border:1px solid rgba(200,185,154,0.08);">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">' +
            '<div style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#1B3352;font-weight:700;">Line Items</div>' +
            lineItemsQbBtn +
          '</div>' +
          (items.length === 0 ? '<div style="padding:20px;text-align:center;color:var(--gray-400);">No items</div>' : itemsHTML) +
        '</div>' +

        // Totals
        '<div style="display:flex;justify-content:flex-end;margin-bottom:20px;">' +
          '<div style="min-width:280px;">' +
            '<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--gray-500);margin-bottom:4px;"><span>Subtotal</span><span>' + formatMoney(subtotal) + '</span></div>' +
            (totalShipping > 0 ? '<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--gray-500);margin-bottom:4px;"><span>Shipping</span><span>' + formatMoney(totalShipping) + '</span></div>' : '') +
            '<div style="display:flex;justify-content:space-between;font-size:13px;color:' + (taxRate > 0 ? 'var(--gray-500)' : '#E16A5B') + ';margin-bottom:4px;"><span>Tax' + (taxRate > 0 ? ' (' + taxRate + '% on taxable)' : ' <a onclick="window._forceEditMode=true;navigate(window.location.hash)" style="color:#E16A5B;cursor:pointer;text-decoration:underline;font-size:11px;">set rate →</a>') + '</span><span>' + formatMoney(tax) + '</span></div>' +
            '<div style="display:flex;justify-content:space-between;font-size:18px;font-weight:700;padding-top:8px;border-top:2px solid var(--navy);"><span>Total</span><span>' + formatMoney(grandTotal) + '</span></div>' +
            (totalPaid > 0 ? '<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--green);margin-top:4px;"><span>Paid</span><span>-' + formatMoney(totalPaid) + '</span></div>' +
              '<div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;color:' + (balance <= 0 ? 'var(--green)' : 'var(--gold)') + ';margin-top:4px;"><span>Balance Due</span><span>' + formatMoney(balance) + '</span></div>' : '') +
          '</div>' +
        '</div>' +

        paymentsHTML +
        memoHTML +

        // Action buttons at bottom
        '<div style="margin-top:24px;padding:16px;background:var(--gray-50);display:flex;gap:12px;flex-wrap:wrap;align-items:center;">' +
          '<button class="btn btn-primary" style="font-size:14px;padding:10px 24px;background:#1B3352;color:#EDE8E0;" onclick="window._forceEditMode=true;navigate(window.location.hash)">✏️ Edit ' + typeLabel + '</button>' +
          '<button class="btn btn-secondary" style="font-size:14px;padding:10px 20px;" onclick="sendInvoiceToClient(\'' + projectId + '\',\'' + docId + '\')">📧 Send to Client</button>' +
          '<button class="btn btn-secondary" style="font-size:14px;padding:10px 20px;" onclick="previewDocument(\'' + type + '\',\'' + projectId + '\',\'' + docId + '\')">👁️ Preview / PDF</button>' +
          '<button class="btn btn-secondary" style="font-size:14px;padding:10px 20px;" onclick="quickRecordPayment(\'' + projectId + '\',\'' + collection + '\',\'' + docId + '\')">💳 Record Payment</button>' +
          '<button class="btn btn-secondary" style="font-size:14px;padding:10px 20px;" onclick="duplicateInvoice(\'' + projectId + '\',\'' + docId + '\')">📋 Duplicate</button>' +
        '</div>' +
      '</div>';
  };

  // ============================================================
  // 31. Project-level Tax Rate — stored on the project, inherited by all docs
  // ============================================================
  window.setProjectTaxRate = async function(projectId) {
    try {
      var projDoc = await db.collection('boards').doc(projectId).get();
      var proj = projDoc.exists ? projDoc.data() : {};
      var current = proj.taxRate || 0;
      var clientAddr = proj.clientAddress || proj.address || '';

      var msg = 'Set sales tax rate for this project.\n';
      if (clientAddr) msg += 'Client address: ' + clientAddr + '\n';
      msg += '\nCurrent rate: ' + current + '%\n\nCommon CA rates:\n  7.75% — Orange County\n  9.50% — Los Angeles\n  8.75% — San Diego\n  7.25% — CA minimum\n\nEnter tax rate (%):';

      var rate = prompt(msg, current || '');
      if (rate === null) return;
      var parsed = parseFloat(rate) || 0;

      await db.collection('boards').doc(projectId).update({
        taxRate: parsed,
        taxRateUpdatedAt: new Date().toISOString()
      });

      showToast('Project tax rate set to ' + parsed + '%', 2000);

      // Also update any open doc edit
      if (window._docEdit && window._docEdit.projectId === projectId) {
        if (!window._docEdit.docData.taxRate) {
          window._docEdit.docData.taxRate = parsed;
          if (typeof docEditRecalcTotals === 'function') docEditRecalcTotals();
        }
      }
    } catch(e) {
      console.error('Set project tax rate error:', e);
      alert('Error: ' + e.message);
    }
  };

  // Patch docEditUpdateTaxRate: prompt shows project rate as default,
  // saves to doc. Offers to also update project default.
  var _origDocEditUpdateTaxRate = window.docEditUpdateTaxRate;
  if (_origDocEditUpdateTaxRate) {
    window.docEditUpdateTaxRate = async function() {
      if (!window._docEdit) return;
      var projId = window._docEdit.projectId;
      var projDoc = await db.collection('boards').doc(projId).get();
      var projData = projDoc.exists ? projDoc.data() : {};
      var projRate = parseFloat(projData.taxRate) || 0;
      var docRate = parseFloat(window._docEdit.docData.taxRate) || 0;

      var msg = 'Set tax rate for this document.\n';
      if (projRate > 0) msg += 'Project default: ' + projRate + '%\n';
      msg += '\nCommon CA rates:\n  7.75% — Orange County\n  9.50% — Los Angeles\n  8.75% — San Diego\n  7.25% — CA minimum\n\nEnter tax rate (%):';

      var rate = prompt(msg, docRate || projRate || '');
      if (rate === null) return;
      var parsed = parseFloat(rate) || 0;

      // Save to doc
      window._docEdit.docData.taxRate = parsed;
      await db.collection('boards').doc(projId)
        .collection(window._docEdit.collection).doc(window._docEdit.docId)
        .update({ taxRate: parsed });
      if (typeof docEditRecalcTotals === 'function') docEditRecalcTotals();

      // If different from project rate, ask to update project
      if (parsed !== projRate) {
        if (confirm('Also update the project default tax rate to ' + parsed + '%?\n\n(Current project rate: ' + projRate + '%. New invoices/proposals will inherit this.)')) {
          await db.collection('boards').doc(projId).update({ taxRate: parsed });
          showToast('Project default tax rate updated to ' + parsed + '%', 2000);
        } else {
          showToast('Tax rate set to ' + parsed + '% for this document only', 2000);
        }
      } else {
        showToast('Tax rate: ' + parsed + '%', 1500);
      }

      // Update the tax rate display
      var taxEl = document.querySelector('[onclick*="docEditUpdateTaxRate"]');
      if (taxEl) taxEl.textContent = parsed + '%';
    };
  }

  // Inject tax rate into the project overview KPI bar
  window.addEventListener('hashchange', function() {
    var hash = window.location.hash || '';
    var overviewMatch = hash.match(/#\/project\/([^/]+)\/overview/) || hash.match(/#\/project\/([^/]+)$/);
    if (!overviewMatch) return;
    var projectId = overviewMatch[1];

    setTimeout(async function() {
      try {
        var projDoc = await db.collection('boards').doc(projectId).get();
        if (!projDoc.exists) return;
        var taxRate = parseFloat(projDoc.data().taxRate) || 0;

        // Find the KPI bar and add tax rate
        var kpiBar = document.querySelector('.ov-kpi');
        if (!kpiBar || !kpiBar.parentElement) return;
        var parent = kpiBar.parentElement;
        if (parent.innerHTML.indexOf('Tax Rate') >= 0) return; // already injected

        var taxKPI = document.createElement('span');
        taxKPI.className = 'ov-kpi';
        taxKPI.style.cursor = 'pointer';
        taxKPI.title = 'Click to set project tax rate';
        taxKPI.onclick = function() { setProjectTaxRate(projectId); };
        taxKPI.innerHTML = '<span class="ov-kpi-val" style="color:' + (taxRate > 0 ? '#E16A5B' : 'var(--gray-400)') + ';">' + (taxRate > 0 ? taxRate + '%' : 'none') + '</span><span class="ov-kpi-label">Tax Rate</span>';
        parent.appendChild(taxKPI);
      } catch(e) {}
    }, 1000);
  });

  // ============================================================
  // Invoice preview: merge Time Billing / General service lines → "Design Services"
  // (client-facing; avoids "time billing" section headers). Exported for legacy preview.
  // ============================================================
  (function() {
    var DS_SECTION = 'Design Services';
    var FEES_SECTION = 'Shipping & adjustments';
    function _invIsExplicitProduct(it) {
      if (!it) return false;
      if (it.expenseType === 'product') return true;
      if (it.itemType === 'product' || it.itemType === 'ffe') return true;
      return false;
    }
    function _invIsFeeOrAdjustmentLine(it) {
      var et = (it.expenseType || '').toLowerCase();
      return et === 'shipping' || et === 'sales_tax' || et === 'discount' || et === 'handling';
    }
    function _sanitizeProductGroupKey(it) {
      var r = String(it.room || '').trim();
      var c = String(it.category || '').trim();
      var low = r.toLowerCase();
      if (low === 'time billing' || low === 'time-billing' || low === 'timebilling') return 'Products';
      return r || (c && !/^cch\s/i.test(c) ? c : '') || 'Products';
    }
    /** All non-product lines except tax/shipping/discount lines → Design Services. */
    function _invLineIsDesignServicesBucket(it) {
      if (_invIsExplicitProduct(it)) return false;
      if (_invIsFeeOrAdjustmentLine(it)) return false;
      return true;
    }
    window.buildInvoicePreviewGroupedByDesignServices = function(items) {
      var design = [];
      var other = {};
      items.forEach(function(it) {
        if (typeof isProposalGroupHeaderItem === 'function' && isProposalGroupHeaderItem(it)) return;
        if (_invLineIsDesignServicesBucket(it)) {
          design.push(it);
          return;
        }
        var k = _invIsExplicitProduct(it) ? _sanitizeProductGroupKey(it) : FEES_SECTION;
        if (!other[k]) other[k] = [];
        other[k].push(it);
      });
      var out = {};
      if (design.length) {
        design.sort(function(a, b) {
          return (a.title || a.name || '').localeCompare(b.title || b.name || '', undefined, { sensitivity: 'base' });
        });
        out[DS_SECTION] = design;
      }
      Object.keys(other).sort().forEach(function(k) { out[k] = other[k]; });
      return out;
    };
    window.sanitizeInvoicePreviewLineText = function(s) {
      if (!s || typeof s !== 'string') return s;
      return s
        .replace(/\bprofessional services\b/gi, 'design services')
        .replace(/\btime billing\b/gi, 'design services')
        .replace(/\btime-billing\b/gi, 'design services');
    };
    window.sanitizeInvoiceDocMemoHtml = function(s) {
      if (!s || typeof s !== 'string') return s;
      return s.replace(/\btime entries from\b/gi, 'Service period');
    };

    /** Client-facing / PDF line label: real service name, not blank or generic "Item". */
    window.invoiceLineDisplayTitle = function(it) {
      if (!it) return 'Item';
      var t = String(it.title || it.name || '').trim();
      var low = t.toLowerCase();
      if (t && low !== 'item' && low !== 'general item' && low !== 'general' && low !== 'untitled') return t;
      var svc = String(it.service || it.billingCategory || '').trim();
      if (svc) return svc;
      var d = String(it.description || '').trim();
      if (d) {
        var beforeDash = d.split(/\s[\u2014—]\s/)[0] || d.split(' - ')[0] || d;
        beforeDash = beforeDash.replace(/\s*\([^)]*\)\s*$/, '').trim();
        if (beforeDash) return beforeDash;
        var p = d.match(/^(.+?)\s*\(/);
        if (p && p[1]) return p[1].trim();
      }
      var cat = String(it.category || it.type || '').trim();
      if (cat) return cat;
      return t || 'Service';
    };

    /** Bill To: name, optional company, address(es), phone + email. Optional clientCompany, clientAddress2 (CRM). */
    window.buildPremiumBillToHtml = function(clientName, clientAddress, clientPhone, clientEmail, clientCompany, clientAddress2) {
      var fullName = (clientName || '').trim();
      var addrRaw = (clientAddress || '').trim();
      var co = (clientCompany || '').trim();
      var addr2 = (clientAddress2 || '').trim();
      if (addrRaw) {
        var m = addrRaw.match(/^([^,]{2,120}),\s*(.+)$/);
        if (m) {
          var a = m[1].trim();
          var b = m[2].trim();
          var nameL = fullName.toLowerCase();
          if (!fullName || nameL.length < 3 || a.toLowerCase().indexOf(nameL) >= 0 || nameL.indexOf(a.split(/\s+/).pop().toLowerCase()) >= 0) {
            fullName = a;
            addrRaw = b;
          }
        }
      }
      var parts = [];
      if (fullName) parts.push('<strong style="font-size:15px;display:block;margin-bottom:8px;">' + esc(fullName) + '</strong>');
      if (co) parts.push('<div style="font-size:13px;color:#5C6B80;margin-top:-2px;margin-bottom:8px;">' + esc(co) + '</div>');
      if (addrRaw) parts.push('<div style="color:#5C6B80;line-height:1.55;font-size:13px;">' + esc(addrRaw).replace(/\n/g, '<br>') + '</div>');
      if (addr2) parts.push('<div style="color:#5C6B80;line-height:1.55;font-size:13px;margin-top:4px;">' + esc(addr2).replace(/\n/g, '<br>') + '</div>');
      var contactLine = [];
      if ((clientPhone || '').trim()) contactLine.push('<span style="white-space:nowrap;">📞 ' + esc((clientPhone || '').trim()) + '</span>');
      if ((clientEmail || '').trim()) contactLine.push('<span style="white-space:nowrap;">✉ ' + esc((clientEmail || '').trim()) + '</span>');
      if (contactLine.length) {
        parts.push('<div style="margin-top:12px;font-size:13px;color:#1B3352;line-height:1.6;">' + contactLine.join('<span style="margin:0 10px;color:#ccc;">|</span>') + '</div>');
      }
      return parts.length ? parts.join('') : '<span style="color:#bbb;font-size:12px;">Add <strong>client name &amp; billing address</strong> in Edit Project or link a Client record.</span>';
    };
  })();

  // ============================================================
  // 32. PREMIUM PREVIEW — Navy/gold luxury design + taxable column + tear sheets
  // ============================================================
  var _origPreviewDocument = window.previewDocument;
  window.previewDocument = async function(type, projectId, docId) {
    // Save any unsaved edits first
    if (window._docEdit && window._docEdit.docId === docId) {
      try { await window.docEditSave(); } catch(e) {}
    }

    var collection = type === 'invoice' ? 'invoices' : type === 'po' ? 'purchaseOrders' : 'proposals';
    var typeLabel = type === 'invoice' ? 'Invoice' : type === 'po' ? 'Purchase Order' : 'Proposal';
    var docData = null, items = [];

    try {
      var doc = await db.collection('boards').doc(projectId).collection(collection).doc(docId).get();
      if (doc.exists) { docData = { id: doc.id, ...doc.data() }; items = docData.items || []; }
    } catch(e) {}

    if (!docData) { if (window._previewDocumentOriginal) window._previewDocumentOriginal(type, projectId, docId); return; }

    var proj = {};
    try { var pd = await db.collection('boards').doc(projectId).get(); if (pd.exists) proj = pd.data(); } catch(e) {}

    var crm = null;
    if (proj.clientId) {
      try {
        var _cSnap = await db.collection('clients').doc(proj.clientId).get();
        if (_cSnap.exists) crm = _cSnap.data();
      } catch (_e) {}
    }

    var clientName = docData.clientName || docData.client || docData.billingContactName ||
      proj.clientName || proj.billingContactName || (crm && (crm.name || crm.fullName)) || '';
    var clientEmail = docData.clientEmail || docData.contactEmail || docData.email ||
      proj.clientEmail || proj.contactEmail || proj.email || (crm && crm.email) || '';
    var clientPhone = docData.clientPhone || docData.phone || docData.contactPhone ||
      proj.clientPhone || proj.phone || proj.contactPhone || (crm && crm.phone) || '';
    var clientAddress = docData.clientAddress || docData.billingAddress || docData.mailingAddress ||
      docData.streetAddress || docData.address ||
      proj.clientAddress || proj.billingAddress || proj.mailingAddress ||
      proj.streetAddress || proj.address || (crm && (crm.address || crm.primaryAddress)) || '';
    var clientCompany = docData.clientCompany || proj.clientCompany || (crm && crm.company) || '';
    var clientAddress2 = docData.clientAddress2 || docData.secondaryAddress ||
      proj.clientAddress2 || proj.secondaryAddress || (crm && (crm.address2 || crm.secondaryAddress)) || '';
    if (!clientName && proj.name && proj.name.includes(' - ')) clientName = proj.name.split(' - ')[0].trim();

    var shipToRaw = (docData.shipTo || docData.deliverTo || '').trim() ||
      (proj.projectAddress || proj.address || proj.siteAddress || proj.jobSiteAddress || '').trim();
    if (!shipToRaw) {
      var _stSet = {};
      items.forEach(function(it) {
        var s = (it.shipTo || it.deliverTo || '').trim();
        if (s) _stSet[s] = true;
      });
      var _stk = Object.keys(_stSet);
      if (_stk.length === 1) shipToRaw = _stk[0];
      else if (_stk.length > 1) shipToRaw = _stk.join(' · ');
    }

    var docNum = docData.invoiceNum || docData.number || docData.proposalNum || docData.name || docId.slice(0,8);
    var docDate = docData.date || docData.createdAt || '';
    function premiumFormatDocDate(raw) {
      if (raw == null || raw === '') return '';
      if (typeof raw.toDate === 'function') {
        var td = raw.toDate();
        if (!isNaN(td.getTime())) {
          return td.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }
      }
      var s = String(raw);
      if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        var y = parseInt(s.slice(0, 4), 10), mo = parseInt(s.slice(5, 7), 10) - 1, da = parseInt(s.slice(8, 10), 10);
        var cal = new Date(y, mo, da);
        if (!isNaN(cal.getTime())) {
          return cal.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        }
      }
      var d = new Date(s);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    var dateStr = premiumFormatDocDate(docDate);
    var taxRate = parseFloat(docData.taxRate) || parseFloat(proj.taxRate) || 0;
    var payments = docData.payments || [];
    var totalPaid = payments.reduce(function(s,p) { return s + (parseFloat(p.amount)||0); }, 0);

    // Group items: invoices → Design Services + product rooms; proposals/POs by room/category
    var grouped = {};
    if (type === 'invoice' && typeof window.buildInvoicePreviewGroupedByDesignServices === 'function') {
      grouped = window.buildInvoicePreviewGroupedByDesignServices(items);
    } else {
      items.forEach(function(it) {
        if (typeof isProposalGroupHeaderItem === 'function' && isProposalGroupHeaderItem(it)) return;
        var cat = it.room || it.category || 'General'; if (!grouped[cat]) grouped[cat]=[]; grouped[cat].push(it);
      });
    }

    // Build items table with taxable column
    var itemsHtml = '';
    var subtotal = 0, taxableSubtotal = 0, totalShipping = 0;
    var _showPremiumImgCol = type !== 'invoice';
    var _premiumGroupColSpan = type === 'po' ? 8 : type === 'invoice' ? 6 : 7;
    var _hasProposalSectionGroups = type === 'proposal' && items.some(function(it) { return it && it.lineKind === 'group'; });
    /** Colgroup keeps thead/body columns aligned (fixed layout + width only on tbody broke alignment). */
    var _premiumColgroup = '';
    if (type === 'invoice') {
      _premiumColgroup = '<colgroup><col class="pc-item"><col class="pc-qty"><col class="pc-money"><col class="pc-money"><col class="pc-tax"><col class="pc-money"></colgroup>';
    } else if (type === 'po') {
      _premiumColgroup = '<colgroup><col class="pc-thumb"><col class="pc-item"><col class="pc-vendor"><col class="pc-qty"><col class="pc-money"><col class="pc-money"><col class="pc-tax"><col class="pc-money"></colgroup>';
    } else {
      _premiumColgroup = '<colgroup><col class="pc-thumb"><col class="pc-item"><col class="pc-qty"><col class="pc-money"><col class="pc-money"><col class="pc-tax"><col class="pc-money"></colgroup>';
    }

    function _fmtIsoLong(iso) {
      if (!iso || typeof iso !== 'string') return '';
      var t = iso.trim();
      if (!t) return '';
      var p = t.split(/\D/);
      if (p.length < 3) return t;
      var y = parseInt(p[0], 10), mo = parseInt(p[1], 10) - 1, da = parseInt(p[2], 10);
      if (!y || mo < 0 || da < 1) return t;
      var d = new Date(Date.UTC(y, mo, da));
      if (isNaN(d.getTime())) return t;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    }

    function _lineNotesHtml(raw) {
      if (raw == null || raw === '') return '';
      var lines = String(raw).split(/\r?\n/).map(function(l) { return l.trim(); }).filter(Boolean);
      if (!lines.length) return '';
      if (lines.length === 1) {
        return '<div class="item-desc item-desc-multiline line-notes">' + esc(lines[0]) + '</div>';
      }
      return '<ul class="line-notes-ul">' + lines.map(function(l) {
        return '<li>' + esc(l) + '</li>';
      }).join('') + '</ul>';
    }

    function _premiumAppendLineRow(it) {
      var qty = parseFloat(it.qty) || 1;
      var amt = parseFloat(it.amount) || 0;
      var cost = parseFloat(it.cost) || 0;
      var mkup = parseFloat(it.markupPct) || 0;
      var ship = parseFloat(it.shipping) || 0;
      var lineAmt = cost > 0 ? cost * qty * (1 + mkup / 100) : amt;
      var unitPrice = type === 'po' ? (cost || amt/qty) : amt/qty;
      var isTaxable = it.taxable !== false && (it.taxable === true || it.expenseType === 'product' || (!it.expenseType && it.taxable !== false));

      subtotal += lineAmt;
      if (isTaxable) taxableSubtotal += lineAmt;
      totalShipping += ship;

      var isSvc = it.expenseType === 'service' || it.itemType === 'service';
      var imgTag = '';
      if (_showPremiumImgCol && !isSvc && it.imageUrl) {
        imgTag = '<img src="' + escAttr(it.imageUrl) + '" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">';
      }
      var imgCell = _showPremiumImgCol ? '<td class="img-cell">' + imgTag + '</td>' : '';
      var _rawNotes = (it.lineNotes || it.notes) || '';
      var _rawDesc = (it.description || '');
      if (type === 'invoice' && typeof window.sanitizeInvoicePreviewLineText === 'function') {
        _rawNotes = window.sanitizeInvoicePreviewLineText(_rawNotes);
        _rawDesc = window.sanitizeInvoicePreviewLineText(_rawDesc);
      }
      var ds0 = (it.serviceDateStart || '').trim();
      var ds1 = (it.serviceDateEnd || '').trim();
      var periodHtml = '';
      if (type === 'invoice' && (ds0 || ds1)) {
        var p0 = _fmtIsoLong(ds0);
        var p1 = _fmtIsoLong(ds1);
        if (p0 && p1 && p0 !== p1) {
          periodHtml = '<div class="item-svc-period">Service period: ' + esc(p0) + ' – ' + esc(p1) + '</div>';
        } else if (p0) {
          periodHtml = '<div class="item-svc-period">Service date: ' + esc(p0) + '</div>';
        }
      }
      var notesUnder = _lineNotesHtml(_rawNotes);
      var lineLabel = typeof window.invoiceLineDisplayTitle === 'function' ? window.invoiceLineDisplayTitle(it) : (it.title || it.name || 'Item');
      var descBody = _rawDesc;
      if (descBody && lineLabel && descBody.toLowerCase().indexOf(String(lineLabel).toLowerCase()) === 0) {
        descBody = descBody.slice(lineLabel.length).replace(/^\s*\([^)]*\)\s*/, '').replace(/^\s*[\u2014—\-]\s*/, '').trim();
      }
      itemsHtml += '<tr>' + imgCell +
        '<td class="line-item-main"><strong>' + esc(lineLabel) + '</strong>' +
        (descBody ? '<div class="item-desc item-desc-multiline">' + esc(descBody) + '</div>' : '') +
        periodHtml +
        notesUnder +
        (it.vendor && type !== 'po' ? '<div class="item-vendor">' + esc(it.vendor) + '</div>' : '') +
        '</td>' +
        (type === 'po' ? '<td class="vendor-cell">' + esc(it.vendor||'') + '</td>' : '') +
        '<td style="text-align:center;">' + qty + '</td>' +
        '<td class="r">' + formatMoney(unitPrice) + '</td>' +
        '<td class="r ship">' + (ship > 0 ? formatMoney(ship) : '') + '</td>' +
        '<td style="text-align:center;">' + (isTaxable ? '<span class="tax-yes">✓</span>' : '<span class="tax-no">—</span>') + '</td>' +
        '<td class="r total-cell">' + formatMoney(amt) + '</td></tr>';
    }

    var _thImg = _showPremiumImgCol ? '<th style="width:80px;"></th>' : '';
    var _thItemLabel = type === 'invoice' ? 'Service' : 'Item';
    if (_hasProposalSectionGroups) {
      itemsHtml += '<div class="room-section"><div class="room-header"><span>Items</span><span></span></div>' +
        '<table>' + _premiumColgroup + '<thead><tr>' + _thImg + '<th>' + _thItemLabel + '</th>' +
        (type === 'po' ? '<th>Vendor</th>' : '') +
        '<th style="text-align:center;">Qty</th>' +
        '<th class="r">Price</th>' +
        '<th class="r">Shipping</th>' +
        '<th style="text-align:center;width:60px;">Tax</th>' +
        '<th class="r">Total</th></tr></thead><tbody>';
      items.forEach(function(it) {
        if (typeof isProposalGroupHeaderItem === 'function' && isProposalGroupHeaderItem(it)) {
          itemsHtml += '<tr><td colspan="' + _premiumGroupColSpan + '" style="background:#F4F6FA;font-weight:700;padding:10px 8px;border-bottom:1px solid #E8ECF3;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#C4A464;">' + esc(it.title || 'Section') + '</td></tr>';
          return;
        }
        _premiumAppendLineRow(it);
      });
      itemsHtml += '</tbody></table></div>';
    } else {
      Object.keys(grouped).forEach(function(cat) {
        var catItems = grouped[cat];
        var catTotal = catItems.reduce(function(s,i) { return s + (parseFloat(i.amount)||0); }, 0);
        itemsHtml += '<div class="room-section"><div class="room-header"><span>' + esc(cat) + '</span><span>' + formatMoney(catTotal) + '</span></div>' +
          '<table>' + _premiumColgroup + '<thead><tr>' + _thImg + '<th>' + _thItemLabel + '</th>' +
          (type === 'po' ? '<th>Vendor</th>' : '') +
          '<th style="text-align:center;">Qty</th>' +
          '<th class="r">Price</th>' +
          '<th class="r">Shipping</th>' +
          '<th style="text-align:center;width:60px;">Tax</th>' +
          '<th class="r">Total</th></tr></thead><tbody>';

        catItems.forEach(function(it) {
          _premiumAppendLineRow(it);
        });
        itemsHtml += '</tbody></table></div>';
      });
    }

    // Tax calculation
    totalShipping += parseFloat(docData.docShipping) || 0;
    var taxAmt = taxableSubtotal * (taxRate / 100);
    var grandTotal = subtotal + totalShipping + taxAmt;

    // Totals HTML
    var totalsHtml = '<div class="total-row"><span>Subtotal</span><span>' + formatMoney(subtotal) + '</span></div>';
    if (totalShipping > 0) totalsHtml += '<div class="total-row"><span>Shipping</span><span>' + formatMoney(totalShipping) + '</span></div>';
    totalsHtml += '<div class="total-row"><span>Sales Tax' + (taxRate > 0 ? ' (' + taxRate + '% on taxable items)' : ' (none set)') + '</span><span>' + formatMoney(taxAmt) + '</span></div>';
    totalsHtml += '<div class="total-row grand"><span>Total</span><span>' + formatMoney(grandTotal) + '</span></div>';
    if (payments.length > 0) {
      payments.forEach(function(p) {
        totalsHtml += '<div class="total-row payment"><span>Payment' + (p.date ? ' — ' + new Date(p.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '') + (p.method ? ' (' + esc(p.method) + ')' : '') + '</span><span>-' + formatMoney(p.amount) + '</span></div>';
      });
      totalsHtml += '<div class="total-row grand balance"><span>Balance Due</span><span>' + formatMoney(grandTotal - totalPaid) + '</span></div>';
    }

    // Memo (invoice: avoid “time entries” phrasing on client-facing preview)
    var _memoSrc = (docData.memo || docData.notes || '');
    if (type === 'invoice' && typeof window.sanitizeInvoiceDocMemoHtml === 'function') {
      _memoSrc = window.sanitizeInvoiceDocMemoHtml(_memoSrc);
    }
    var memoHtml = _memoSrc ?
      '<div class="memo-block"><div class="memo-label">Terms & Notes</div><div class="memo-text">' + esc(_memoSrc) + '</div></div>' : '';

    var shipToHtml = shipToRaw
      ? esc(shipToRaw).replace(/\n/g, '<br>')
      : '<span style="color:#5C6B80;font-size:12px;">Set <strong>Project Address</strong> (job site) in Edit Project, or choose ship-to on lines.</span>';
    var billToHtml = typeof window.buildPremiumBillToHtml === 'function'
      ? window.buildPremiumBillToHtml(clientName, clientAddress, clientPhone, clientEmail, clientCompany, clientAddress2)
      : (function() {
          var billParts = [];
          if (clientName) billParts.push('<strong>' + esc(clientName) + '</strong>');
          if (clientCompany) billParts.push(esc(clientCompany));
          if (clientAddress) billParts.push(esc(clientAddress));
          if (clientAddress2) billParts.push(esc(clientAddress2));
          if (clientEmail) billParts.push(esc(clientEmail));
          if (clientPhone) billParts.push(esc(clientPhone));
          return billParts.length ? billParts.join('<br>') : '<span style="color:#bbb;font-size:12px;">Add <strong>client name &amp; billing address</strong> in Edit Project.</span>';
        })();
    var projAddrLine = (proj.projectAddress || proj.address || '').trim();
    var _shipNorm = (shipToRaw || '').replace(/\s+/g, ' ').trim();
    var _projNorm = projAddrLine.replace(/\s+/g, ' ').trim();
    if (_projNorm && _shipNorm && _projNorm === _shipNorm) projAddrLine = '';
    var projectHtml;
    if (type === 'invoice' && dateStr) {
      projectHtml = '<div class="project-title-row"><strong>' + esc(proj.name || projectId) + '</strong>' +
        '<span class="project-invoice-date">' + esc(dateStr) + '</span></div>' +
        (projAddrLine ? '<div class="project-addr-sub">' + esc(projAddrLine) + '</div>' : '');
    } else {
      projectHtml = '<strong>' + esc(proj.name || projectId) + '</strong>' +
        (projAddrLine ? '<br><span style="color:#5C6B80;font-size:12px;">' + esc(projAddrLine) + '</span>' : '');
    }

    var infoSectionHtml = '';
    if (type === 'po') {
      infoSectionHtml = '<div class="info-section info-section-po">' +
        (docData.vendor ? '<div class="info-block"><div class="info-label">Vendor</div><div class="info-value"><strong>' + esc(docData.vendor) + '</strong></div></div>' : '') +
        '<div class="info-block"><div class="info-label">Project</div><div class="info-value">' + projectHtml + '</div></div>' +
        '<div class="info-block info-block-ship-to"><div class="info-label">Ship To</div><div class="info-value">' + shipToHtml + '</div></div>' +
      '</div>';
    } else {
      infoSectionHtml = '<div class="info-section info-section-invoice">' +
        '<div class="info-block"><div class="info-label">Bill To</div><div class="info-value">' + billToHtml + '</div></div>' +
        '<div class="info-block"><div class="info-label">Project</div><div class="info-value">' + projectHtml + '</div></div>' +
      '</div>';
    }

    // Invoices: date is shown next to project name, not in the navy header.
    var premiumDocDateHtml = (type === 'invoice') ? '' : (dateStr ? '<div class="doc-date">' + esc(dateStr) + '</div>' : '');
    var premiumDocTypeHtml = (type === 'invoice') ? '' : ('<div class="doc-type">' + typeLabel + '</div>');
    var premiumToolbarTitle = (type === 'invoice') ? esc(docNum) : esc(typeLabel + ' ' + docNum);

    // Build the premium preview
    var win = window.open('', '_blank');
    win.document.write('<!DOCTYPE html><html><head><title>' + esc(typeLabel + ' ' + docNum) + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">' +
      '<style>' +
      '*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }' +
      'html, body { height:100%; }' +
      'body { font-family:"DM Sans",sans-serif; color:#1B3352; background:#FFFFFF; margin:0; display:flex; flex-direction:column; min-height:100%; }' +
      '.page { max-width:850px; margin:0 auto; background:#FFFFFF; width:100%; flex:1; display:flex; flex-direction:column; min-height:calc(100vh - 44px); box-shadow:0 0 0 1px rgba(27,51,82,0.06); }' +
      '.page-body { flex:1; display:flex; flex-direction:column; }' +

      /* Toolbar */
      '.toolbar { position:fixed;top:0;left:0;right:0;z-index:999;background:#1B3352;display:flex;align-items:flex-start;justify-content:space-between;padding:10px 24px;gap:16px; }' +
      '.toolbar-left { flex:1;min-width:0; }' +
      '.toolbar-title { color:#C4A464;font-size:13px;font-weight:600;letter-spacing:0.5px; }' +
      '.print-hint-screen { font-size:10px;color:rgba(196,164,100,0.88);margin-top:6px;line-height:1.4;font-weight:400;max-width:520px; }' +
      '.toolbar-actions { display:flex;gap:8px;flex-shrink:0;padding-top:2px; }' +
      '.tb-btn { background:transparent;color:#C4A464;border:1px solid #C4A464;padding:7px 14px;font-size:11px;font-weight:600;cursor:pointer;font-family:"DM Sans";transition:all 0.15s; }' +
      '.tb-btn:hover { background:rgba(196,164,100,0.12);color:#1B3352; }' +
      '.tb-btn-primary { background:#C4A464;color:#FFFFFF;border-color:#C4A464; }' +
      '.tb-btn-primary:hover { background:#A08A50; }' +

      /* Header */
      '.doc-header { background:#1B3352; padding:16px 36px 14px; display:flex; justify-content:space-between; align-items:flex-start; }' +
      '.logo-block { }' +
      '.logo-cch { font-family:"Cormorant Garamond",Georgia,serif; font-size:32px; font-weight:700; color:#C4A464; letter-spacing:4px; line-height:1; }' +
      '.logo-sub { font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.4); text-transform:uppercase; margin-top:2px; }' +
      '.company-info { font-size:10px; color:rgba(255,255,255,0.62); line-height:1.55; margin-top:6px; }' +
      '.doc-meta { text-align:right; }' +
      '.doc-type { font-size:10px; text-transform:uppercase; letter-spacing:3px; color:#C4A464; font-weight:600; }' +
      '.doc-num { font-size:20px; font-weight:700; color:#fff; margin-top:4px; font-family:"Cormorant Garamond",serif; }' +
      '.doc-date { font-size:12px; color:rgba(255,255,255,0.5); margin-top:4px; }' +
      '.doc-status { display:inline-block; padding:3px 12px; margin-top:8px; font-size:10px; font-weight:600; letter-spacing:1px; text-transform:uppercase; border:1px solid rgba(196,164,100,0.45); color:#C4A464; }' +

      /* Gold divider */
      '.gold-line { height:3px; background:linear-gradient(90deg,#C4A464,#E0C48A,#C4A464); }' +

      /* Info section */
      '.info-section { display:flex; flex-wrap:wrap; gap:28px 32px; padding:22px 40px; border-bottom:1px solid #E8ECF3; align-items:flex-start; }' +
      '.info-section-invoice .info-block { flex:1 1 220px; min-width:0; max-width:48%; }' +
      '.info-section-po .info-block-ship-to { margin-left:auto; flex:0 1 280px; min-width:200px; text-align:right; }' +
      '.info-section-po .info-block-ship-to .info-value { text-align:right; }' +
      '.info-block { flex:1 1 160px; min-width:0; }' +
      '.info-label { font-size:9px; text-transform:uppercase; letter-spacing:2px; color:#C4A464; font-weight:700; margin-bottom:6px; }' +
      '.info-value { font-size:13px; color:#1B3352; line-height:1.7; }' +
      '.info-value strong { font-weight:600; }' +
      '.project-title-row { display:flex; justify-content:space-between; align-items:baseline; gap:12px; flex-wrap:wrap; width:100%; }' +
      '.project-invoice-date { font-size:12px; color:#5C6B80; font-weight:600; white-space:nowrap; margin-left:auto; }' +
      '.project-addr-sub { color:#5C6B80; font-size:12px; margin-top:6px; line-height:1.45; }' +

      /* Items */
      '.items-section { padding:28px 48px; }' +
      '.room-section { margin-bottom:24px; }' +
      '.room-header { display:flex; justify-content:space-between; align-items:center; padding:8px 0 6px; border-bottom:2px solid #1B3352; margin-bottom:4px; }' +
      '.room-header span:first-child { font-size:11px; text-transform:uppercase; letter-spacing:2px; color:#C4A464; font-weight:700; }' +
      '.room-header span:last-child { font-size:12px; color:#5C6B80; font-weight:600; font-family:"DM Sans"; }' +
      'table { width:100%; border-collapse:collapse; table-layout:fixed; }' +
      'col.pc-thumb { width:72px; }' +
      'col.pc-item { width:44%; }' +
      'col.pc-qty { width:9%; }' +
      'col.pc-vendor { width:13%; }' +
      'col.pc-money { width:10%; }' +
      'col.pc-tax { width:7%; }' +
      'th, td { min-width:0; }' +
      'td.line-item-main { word-wrap:break-word; overflow-wrap:anywhere; }' +
      'th { text-align:left; padding:8px 6px; font-size:9px; text-transform:uppercase; letter-spacing:1px; color:#5C6B80; font-weight:600; border-bottom:1px solid #E8ECF3; background:#F4F6FA; }' +
      'th.r { text-align:right; }' +
      'td { padding:10px 6px; border-bottom:1px solid #E8ECF3; font-size:13px; vertical-align:middle; }' +
      'td.r { text-align:right; font-family:"DM Sans"; }' +
      'td.total-cell { font-weight:600; }' +
      'td.ship { color:#5C6B80; }' +
      'td.vendor-cell { color:#5C6B80; font-size:12px; }' +
      'td.img-cell img { width:64px; height:64px; object-fit:cover; border-radius:2px; }' +
      'td strong { font-size:13px; display:block; }' +
      '.item-desc { font-size:11px; color:#5C6B80; margin-top:2px; }' +
      '.item-desc-multiline { white-space:pre-wrap; word-break:break-word; overflow-wrap:anywhere; line-height:1.5; max-width:100%; margin-top:6px; font-size:11px; }' +
      '.item-svc-period { font-size:10px;color:#8B7355;margin-top:6px;font-weight:600;letter-spacing:0.2px; }' +
      '.line-notes-ul { margin:6px 0 0 1.1em;padding:0;list-style:disc;color:#5C6B80;font-size:11px;line-height:1.45; }' +
      '.line-notes-ul li { margin:3px 0; }' +
      '.line-item-main { vertical-align:top; }' +
      '.line-item-main strong { margin-bottom:2px; }' +
      '.item-vendor { font-size:10px; color:#5C6B80; margin-top:1px; }' +
      '.tax-yes { color:#5FA56B; font-weight:700; }' +
      '.tax-no { color:#ccc; }' +

      /* Totals */
      '.totals-section { padding:0 48px 28px; display:flex; justify-content:flex-end; }' +
      '.totals-block { min-width:300px; }' +
      '.total-row { display:flex; justify-content:space-between; padding:5px 0; font-size:13px; color:#5C6B80; }' +
      '.total-row.grand { font-size:18px; font-weight:700; color:#1B3352; padding-top:10px; margin-top:4px; border-top:2px solid #1B3352; font-family:"Cormorant Garamond",serif; }' +
      '.total-row.payment { color:#5FA56B; }' +
      '.total-row.balance { color:#C8B99A; }' +

      /* Memo */
      '.memo-block { margin:0 48px 28px; padding:16px 20px; background:#FAFAF8; border-left:3px solid #C8B99A; }' +
      '.memo-label { font-size:9px; text-transform:uppercase; letter-spacing:1.5px; color:#C8B99A; font-weight:700; margin-bottom:6px; }' +
      '.memo-text { font-size:12px; color:#6B6760; line-height:1.7; }' +

      /* Footer — sticks to bottom when content is short; avoids floating mid-page */
      '.doc-footer { margin-top:auto; padding:18px 40px; border-top:1px solid #e8e6e0; text-align:center; background:#FAFAF8; flex-shrink:0; }' +
      '.footer-brand { font-family:"Cormorant Garamond",serif; font-size:16px; color:#C8B99A; letter-spacing:3px; font-weight:600; }' +
      '.footer-tagline { font-size:10px; color:#9E9A8F; font-style:italic; margin-top:2px; }' +
      '.footer-contact { font-size:10px; color:#bbb; margin-top:6px; }' +

      /* Print */
      '@media print { .toolbar{display:none!important;} .print-hint-screen{display:none!important;} body{background:white;display:block;min-height:auto;} .page{min-height:auto;box-shadow:none;flex:none;} .page-body{flex:none;} .doc-footer{position:relative;margin-top:16px;} }' +
      '@page { margin:0.5in; }' +

      /* Tear sheet pages */
      '.ts-page { page-break-before:always; padding:48px; }' +
      '.ts-header { display:flex; justify-content:space-between; align-items:center; padding-bottom:16px; border-bottom:2px solid #1B3352; margin-bottom:24px; }' +
      '.ts-logo { font-family:"Cormorant Garamond",serif; font-size:28px; font-weight:700; color:#1B3352; letter-spacing:3px; }' +
      '.ts-body { display:grid; grid-template-columns:1fr 1fr; gap:32px; }' +
      '.ts-img { width:100%; aspect-ratio:1; object-fit:cover; }' +
      '.ts-title { font-family:"Cormorant Garamond",serif; font-size:26px; font-weight:600; color:#1B3352; margin-bottom:4px; }' +
      '.ts-room { font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#C8B99A; font-weight:600; margin-bottom:20px; }' +
      '.ts-spec { display:flex; padding:6px 0; border-bottom:1px solid #f0efeb; }' +
      '.ts-spec-label { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.8px; color:#5C6B80; width:120px; }' +
      '.ts-spec-val { font-size:13px; color:#1B3352; }' +
      '.ts-price { margin-top:auto; padding-top:16px; border-top:2px solid #1B3352; font-family:"Cormorant Garamond",serif; font-size:32px; font-weight:700; color:#1B3352; }' +
      '</style></head><body>' +

      /* Toolbar */
      '<div class="toolbar">' +
        '<div class="toolbar-left">' +
        '<div class="toolbar-title">' + premiumToolbarTitle + '</div>' +
        '<div class="print-hint-screen">For a clean PDF: in Print → <strong>More settings</strong>, turn off <strong>Headers and footers</strong>. Otherwise Chrome adds the date and title at the top and <strong>about:blank</strong> (or the page URL) at the bottom — that is not part of your invoice.</div>' +
        '</div>' +
        '<div class="toolbar-actions">' +
          '<button class="tb-btn" onclick="window.print()">🖨️ Print / PDF</button>' +
          '<button class="tb-btn" id="tsToggle" onclick="toggleTearSheets()">📑 Include Tear Sheets</button>' +
        '</div>' +
      '</div>' +

      '<div style="height:44px;"></div>' +

      '<div class="page">' +
        '<div class="page-body">' +
        /* Header */
        '<div class="doc-header">' +
          '<div class="logo-block">' +
            '<div class="logo-cch">CCH</div>' +
            '<div class="logo-sub">Design Inc</div>' +
            '<div class="company-info">Cindy Holloway<br>2481 N. Riverside Dr. · Santa Ana, CA 92706<br>(949) 497-7979 · cindy@cchdesign.com<br>www.cchdesign.com</div>' +
          '</div>' +
          '<div class="doc-meta">' +
            premiumDocTypeHtml +
            '<div class="doc-num">' + esc(docNum) + '</div>' +
            premiumDocDateHtml +
            '<div class="doc-status">' + esc(docData.status||'Draft') + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="gold-line"></div>' +

        infoSectionHtml +

        /* Items */
        '<div class="items-section">' + itemsHtml + '</div>' +

        /* Totals */
        '<div class="totals-section"><div class="totals-block">' + totalsHtml + '</div></div>' +

        memoHtml +
        '</div>' +

        /* Footer */
        '<div class="doc-footer">' +
          '<div class="footer-brand">CCH</div>' +
          '<div class="footer-tagline">residential & yacht design · Valid 30 days</div>' +
          '<div class="footer-contact">www.cchdesign.com · @cchdesigninc · Thank you for your business</div>' +
        '</div>' +
      '</div>');

    // Tear sheet pages (hidden by default, toggled by button)
    win.document.write('<div id="tearSheetPages" style="display:none;">');
    items.forEach(function(item, idx) {
      if (!item.title && !item.imageUrl) return;
      var qty = parseFloat(item.qty) || 1;
      var amt = parseFloat(item.amount) || 0;
      var cost = parseFloat(item.cost) || 0;
      win.document.write(
        '<div class="page ts-page">' +
          '<div class="ts-header">' +
            '<div class="ts-logo">CCH</div>' +
            '<div style="font-size:11px;color:#9E9A8F;">' + esc(proj.name||'') + ' · Item ' + (idx+1) + ' of ' + items.length + '</div>' +
          '</div>' +
          '<div class="ts-body">' +
            '<div>' + (item.imageUrl ? '<img class="ts-img" src="' + escAttr(item.imageUrl) + '" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' : '<div class="ts-img" style="background:#f5f3ee;display:flex;align-items:center;justify-content:center;font-size:48px;">📦</div>') + '</div>' +
            '<div style="display:flex;flex-direction:column;">' +
              '<div class="ts-title">' + esc(item.title || 'Untitled') + '</div>' +
              '<div class="ts-room">' + esc(item.room || item.category || '') + '</div>' +
              (item.vendor ? '<div class="ts-spec"><div class="ts-spec-label">Vendor</div><div class="ts-spec-val">' + esc(item.vendor) + '</div></div>' : '') +
              '<div class="ts-spec"><div class="ts-spec-label">Quantity</div><div class="ts-spec-val">' + qty + '</div></div>' +
              (item.description ? '<div style="margin-top:12px;font-size:12px;color:#6B6760;line-height:1.6;">' + esc((item.description||'').substring(0,200)) + '</div>' : '') +
              '<div class="ts-price">' + formatMoney(amt) + '</div>' +
            '</div>' +
          '</div>' +
        '</div>');
    });
    win.document.write('</div>');

    // Tear sheets toggle script
    win.document.write('<script>var _tsVisible=false; function toggleTearSheets(){ _tsVisible=!_tsVisible; document.getElementById("tearSheetPages").style.display=_tsVisible?"block":"none"; document.getElementById("tsToggle").style.background=_tsVisible?"#C8B99A":"transparent"; document.getElementById("tsToggle").style.color=_tsVisible?"#1B3352":"#C8B99A"; document.getElementById("tsToggle").textContent=_tsVisible?"📑 Tear Sheets Included":"📑 Include Tear Sheets"; }<\/script>');

    win.document.write('</body></html>');
    win.document.close();
  };


  // ============================================================
  // 33. Auto-set taxable defaults when adding items from selections/library
  // ============================================================
  var _origAddMyItemToDoc = window.addMyItemToDoc;
  if (_origAddMyItemToDoc) {
    window.addMyItemToDoc = function(idx) {
      _origAddMyItemToDoc.call(this, idx);
      // After adding, set taxable default on the last item
      if (window._docEdit && window._docEdit.items.length > 0) {
        var lastItem = window._docEdit.items[window._docEdit.items.length - 1];
        var p = (window._myItemsProducts || [])[idx];
        if (p) {
          // Use clip's taxable field if available
          if (p.taxable === 'taxable' || p.taxableItem === 'taxable' || p.taxable === true) {
            lastItem.taxable = true;
          } else if (p.taxable === 'non-taxable' || p.taxableItem === 'non-taxable' || p.taxable === false) {
            lastItem.taxable = false;
          } else {
            // Default by expense type
            lastItem.taxable = (lastItem.expenseType || 'product') === 'product';
          }
        }
      }
    };
  }

  var _origDocEditAddBlankItem2 = window.docEditAddBlankItem;
  if (_origDocEditAddBlankItem2) {
    window.docEditAddBlankItem = function() {
      _origDocEditAddBlankItem2.call(this);
      // Default new blank items to taxable (product)
      if (window._docEdit && window._docEdit.items.length > 0) {
        window._docEdit.items[window._docEdit.items.length - 1].taxable = true;
      }
    };
  }


  // My Items panel only opens when user clicks the button — no auto-open

  // Make content area responsive to panel open/close
  window.applyMyItemsPanelLayout = function(panelOpen) {
    var content = document.getElementById('contentArea');
    if (!content) return;
    if (panelOpen) {
      content.style.marginRight = '350px';
      content.style.transition = 'margin-right 0.2s ease';
    } else {
      content.style.marginRight = '0';
    }
  };

  // Patch toggleMyItemsPanel to also adjust layout
  var _origToggleMyItemsPanel = window.toggleMyItemsPanel;
  window.toggleMyItemsPanel = async function() {
    var wasOpen = !!document.getElementById('myItemsPanel');
    await _origToggleMyItemsPanel.call(this);
    // After toggle, adjust layout
    var isNowOpen = !!document.getElementById('myItemsPanel');
    applyMyItemsPanelLayout(isNowOpen);

    // Add Material tab if not present
    if (isNowOpen) {
      setTimeout(function() {
        var tabArea = document.querySelector('#myItemsPanel .mip-tab[data-filter="service"]');
        if (tabArea && !document.querySelector('#myItemsPanel .mip-tab[data-filter="material"]')) {
          var materialBtn = document.createElement('button');
          materialBtn.className = 'mip-tab';
          materialBtn.dataset.filter = 'material';
          materialBtn.onclick = function() { filterMyItemsPanel('material'); };
          materialBtn.style.cssText = 'padding:4px 10px;font-size:11px;border:1px solid #E5E2DA;background:#fff;color:#1B3352;cursor:pointer;';
          materialBtn.textContent = 'Material';
          tabArea.parentNode.appendChild(materialBtn);
        }
      }, 100);
    }
  };

  // Extend filter to support "material" type
  var _origFilterMyItemsPanel = window.filterMyItemsPanel;
  window.filterMyItemsPanel = function(filter) {
    // Handle material filter
    if (filter === 'material') {
      window._myItemsFilter = 'material';
      // Update tab styles manually
      document.querySelectorAll('.mip-tab').forEach(function(t) {
        var isActive = t.dataset.filter === 'material';
        t.style.background = isActive ? '#1B3352' : '#fff';
        t.style.color = isActive ? '#EDE8E0' : '#1B3352';
        t.style.borderColor = isActive ? '#1B3352' : '#E5E2DA';
      });
      // Filter and render
      var search = (document.getElementById('myItemsSearch') || {}).value || '';
      var q = search.toLowerCase();
      var products = window._myItemsProducts || [];
      var filtered = products.filter(function(p) {
        if (q && !(p.title || '').toLowerCase().includes(q) && !(p.vendor || '').toLowerCase().includes(q)) return false;
        if (window._myItemsSourceFilter === 'project' && p._source !== 'project') return false;
        if (window._myItemsSourceFilter === 'library' && p._source === 'project') return false;
        var cat = (p.category || '').toLowerCase();
        return cat === 'material' || cat === 'fabric' || cat === 'textile' || cat === 'stone' || cat === 'tile' || cat === 'hardware' || cat === 'finish';
      });
      var list = document.getElementById('myItemsList');
      if (!list) return;
      if (filtered.length === 0) {
        list.innerHTML = '<div style="padding:40px 20px;text-align:center;color:#7A7060;">No materials found</div>';
        return;
      }
      list.innerHTML = filtered.map(function(p, i) {
        var sell = parseFloat(p.sellPrice) || parseFloat(p.clientPrice) || parseFloat(p.totalSell) || parseFloat(p.amount) || 0;
        var imgUrl = p.imageUrl || p.image || p.thumbnail || '';
        var realIdx = (window._myItemsProducts || []).indexOf(p);
        return '<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #F0EDE6;cursor:pointer;transition:background 0.1s;" onmouseover="this.style.background=\'#F9F8F5\'" onmouseout="this.style.background=\'#fff\'">' +
          '<button onclick="event.stopPropagation();addMyItemToDoc(' + realIdx + ')" style="width:28px;height:28px;border-radius:50%;border:2px solid var(--gold);background:none;color:var(--gold);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;" title="Add to document">+</button>' +
          (imgUrl ? '<img src="' + escAttr(imgUrl) + '" style="width:56px;height:56px;object-fit:cover;flex-shrink:0;" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' : '<div style="width:56px;height:56px;background:#F5F3EE;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">📦</div>') +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:13px;font-weight:600;color:#1B3352;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(p.title || '') + '</div>' +
            '<div style="font-size:11px;color:#7A7060;">Material</div>' +
            '<div style="font-size:13px;font-weight:700;color:#1B3352;font-family:monospace;">$' + sell.toFixed(2) + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
      return;
    }
    // For all other filters, call original
    return _origFilterMyItemsPanel.call(this, filter);
  };

  // Ensure My Items panel closes and layout resets when leaving doc edit
  window.addEventListener('hashchange', function() {
    var panel = document.getElementById('myItemsPanel');
    if (panel && !window.location.hash.match(/\/(invoice|proposal|po)\//)) {
      panel.remove();
      applyMyItemsPanelLayout(false);
    }
  });


  // ============================================================
  // 29. VENDOR INVOICE SCANNER — Upload PDF, extract line items,
  //     compare to PO, note changes, offer to invoice client for shipping
  // ============================================================

  /**
   * scanVendorInvoice(projectId, poId)
   * Opens a file picker for a vendor invoice PDF/image.
   * Uses the browser FileReader to extract text, then parses
   * line items, totals, shipping, and tax. Compares to the PO
   * and shows a diff modal with options to update, add notes,
   * and invoice client for shipping.
   */
  window.scanVendorInvoice = async function(projectId, poId) {
    // Load PO data first
    var poDoc = await db.collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
    if (!poDoc.exists) { alert('PO not found'); return; }
    var po = poDoc.data();

    // Create file picker overlay
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:center;justify-content:center;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = '<div style="background:#FFFFFF;width:600px;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(27,51,82,0.25);">' +
      '<div style="padding:20px 24px;border-bottom:1px solid rgba(27,51,82,0.08);display:flex;justify-content:space-between;align-items:center;">' +
        '<div><div style="font-size:18px;font-weight:700;color:#1B3352;">Scan Vendor Invoice</div>' +
        '<div style="font-size:12px;color:#7A7060;margin-top:2px;">Upload vendor invoice to compare against PO ' + esc(po.number || po.poNum || '') + '</div></div>' +
        '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#7A7060;">&times;</button></div>' +
      '<div style="padding:24px;" id="vendorScanBody">' +
        '<div style="border:2px dashed rgba(200,185,154,0.4);padding:40px;text-align:center;margin-bottom:16px;cursor:pointer;" onclick="document.getElementById(\'vendorInvoiceFile\').click()" id="vendorDropZone">' +
          '<div style="font-size:36px;margin-bottom:8px;">📄</div>' +
          '<div style="font-size:14px;font-weight:600;color:#1B3352;">Drop vendor invoice here or click to upload</div>' +
          '<div style="font-size:12px;color:#7A7060;margin-top:4px;">Supports PDF and images (JPG, PNG)</div>' +
          '<input type="file" id="vendorInvoiceFile" accept=".pdf,image/*" style="display:none;" onchange="processVendorInvoice(\'' + projectId + '\',\'' + poId + '\',this)">' +
        '</div>' +
        '<div style="font-size:12px;color:#7A7060;padding:12px;background:#F5F3EE;margin-bottom:16px;">' +
          '<strong>Current PO Summary:</strong><br>' +
          'Vendor: ' + esc(po.vendor || '—') + '<br>' +
          'Items: ' + (po.items || []).length + '<br>' +
          'Total: ' + formatMoney(po.total || 0) +
        '</div>' +
        '<div style="font-size:11px;color:#7A7060;">' +
          '<strong>What this does:</strong><br>' +
          '• Reads the vendor invoice for line items, quantities, prices, tax, and shipping<br>' +
          '• Compares to your PO and highlights any differences<br>' +
          '• Lets you update the PO with actual amounts<br>' +
          '• Offers to create a client invoice for shipping/tax fees<br>' +
          '• Attaches the vendor invoice PDF to the PO' +
        '</div>' +
      '</div></div>';
    document.body.appendChild(overlay);
  };

  window.processVendorInvoice = async function(projectId, poId, fileInput) {
    var file = fileInput.files[0];
    if (!file) return;

    var body = document.getElementById('vendorScanBody');
    body.innerHTML = '<div style="text-align:center;padding:40px;"><div style="font-size:36px;margin-bottom:12px;">⏳</div>' +
      '<div style="font-size:14px;font-weight:600;">Reading vendor invoice...</div>' +
      '<div style="font-size:12px;color:#7A7060;margin-top:4px;">' + esc(file.name) + '</div></div>';

    // Read file as text (for PDFs we extract what we can)
    var text = '';
    try {
      if (file.type === 'application/pdf') {
        // Try to extract text from PDF using FileReader + basic parsing
        var arrayBuffer = await file.arrayBuffer();
        text = extractTextFromPDFBuffer(arrayBuffer);
      } else {
        // For images, we'll just prompt manual entry
        text = '';
      }
    } catch(e) {
      console.warn('File read error:', e);
    }

    // Load PO
    var poDoc = await db.collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
    var po = poDoc.exists ? poDoc.data() : {};
    var poItems = po.items || [];

    // Parse extracted text for key fields
    var parsed = parseVendorInvoiceText(text);

    // Upload the file as attachment
    var fileUrl = '';
    try {
      var reader = new FileReader();
      var dataUrl = await new Promise(function(resolve) {
        reader.onload = function(e) { resolve(e.target.result); };
        reader.readAsDataURL(file);
      });
      fileUrl = dataUrl; // Store as data URL for now
    } catch(e) {}

    // Show comparison UI
    showVendorInvoiceComparison(projectId, poId, po, parsed, file.name, fileUrl);
  };

  // Basic PDF text extraction (works for text-based PDFs)
  window.extractTextFromPDFBuffer = function(buffer) {
    try {
      var bytes = new Uint8Array(buffer);
      var text = '';
      // Simple extraction: find text between BT/ET markers or parentheses
      var str = '';
      for (var i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
      }
      // Extract text from PDF stream objects
      var matches = str.match(/\(([^)]+)\)/g);
      if (matches) {
        text = matches.map(function(m) { return m.slice(1, -1); }).join(' ');
      }
      // Also try to find readable text blocks
      var blocks = str.match(/BT[\s\S]*?ET/g);
      if (blocks) {
        blocks.forEach(function(block) {
          var tj = block.match(/\(([^)]+)\)/g);
          if (tj) text += ' ' + tj.map(function(m) { return m.slice(1, -1); }).join(' ');
        });
      }
      return text.replace(/\\n/g, '\n').replace(/\s+/g, ' ').trim();
    } catch(e) {
      return '';
    }
  };

  // Parse vendor invoice text for structured data
  window.parseVendorInvoiceText = function(text) {
    var result = {
      invoiceNum: '',
      vendor: '',
      date: '',
      subtotal: 0,
      tax: 0,
      shipping: 0,
      total: 0,
      items: [],
      raw: text
    };

    if (!text) return result;

    var upper = text.toUpperCase();

    // Try to find invoice number
    var invMatch = text.match(/(?:invoice|inv|order|confirmation)\s*(?:#|no\.?|number)?\s*[:.]?\s*([A-Z0-9-]+)/i);
    if (invMatch) result.invoiceNum = invMatch[1];

    // Try to find total
    var totalMatch = text.match(/(?:total|grand total|amount due|total usd)[:\s]*\$?([\d,]+\.?\d*)/i);
    if (totalMatch) result.total = parseFloat(totalMatch[1].replace(/,/g, '')) || 0;

    // Try to find subtotal
    var subMatch = text.match(/(?:subtotal|sub total|sub-total)[:\s]*\$?([\d,]+\.?\d*)/i);
    if (subMatch) result.subtotal = parseFloat(subMatch[1].replace(/,/g, '')) || 0;

    // Try to find tax
    var taxMatch = text.match(/(?:tax|sales tax|total tax)[:\s]*\$?([\d,]+\.?\d*)/i);
    if (taxMatch) result.tax = parseFloat(taxMatch[1].replace(/,/g, '')) || 0;

    // Try to find shipping/freight
    var shipMatch = text.match(/(?:shipping|freight|delivery|handling)[:\s]*\$?([\d,]+\.?\d*)/i);
    if (shipMatch) result.shipping = parseFloat(shipMatch[1].replace(/,/g, '')) || 0;

    // Try to find individual line items (price patterns)
    var priceLines = text.match(/[\w\s]+\$[\d,]+\.?\d*/g);
    if (priceLines) {
      priceLines.forEach(function(line) {
        var pm = line.match(/([\w\s]+)\$?([\d,]+\.?\d*)/);
        if (pm) {
          var desc = pm[1].trim();
          var amt = parseFloat(pm[2].replace(/,/g, '')) || 0;
          if (desc.length > 2 && amt > 0 && amt < 100000) {
            result.items.push({ description: desc, amount: amt });
          }
        }
      });
    }

    return result;
  };

  // Show comparison between vendor invoice and PO
  window.showVendorInvoiceComparison = function(projectId, poId, po, parsed, fileName, fileUrl) {
    var body = document.getElementById('vendorScanBody');
    if (!body) return;

    var poTotal = parseFloat(po.total) || 0;
    var poItems = po.items || [];
    var vendorTotal = parsed.total || 0;
    var diff = vendorTotal - poTotal;
    var diffColor = diff > 0 ? '#E16A5B' : diff < 0 ? '#5FA56B' : 'var(--gray-400)';
    var diffSign = diff > 0 ? '+' : '';

    body.innerHTML =
      '<div style="margin-bottom:16px;padding:12px;background:#F5F3EE;border-left:3px solid var(--gold);">' +
        '<div style="font-size:12px;font-weight:600;color:#1B3352;">📄 ' + esc(fileName) + '</div>' +
        (parsed.invoiceNum ? '<div style="font-size:11px;color:#7A7060;margin-top:2px;">Vendor Invoice #: ' + esc(parsed.invoiceNum) + '</div>' : '') +
      '</div>' +

      // Side-by-side comparison
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">' +
        '<div style="padding:16px;border:1px solid rgba(27,51,82,0.08);">' +
          '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--gold);font-weight:600;margin-bottom:8px;">Your PO</div>' +
          '<div style="font-size:20px;font-weight:700;">' + formatMoney(poTotal) + '</div>' +
          '<div style="font-size:12px;color:#7A7060;margin-top:4px;">' + poItems.length + ' items</div>' +
        '</div>' +
        '<div style="padding:16px;border:1px solid rgba(27,51,82,0.08);">' +
          '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--cyan);font-weight:600;margin-bottom:8px;">Vendor Invoice</div>' +
          '<div style="font-size:20px;font-weight:700;">' + formatMoney(vendorTotal) + '</div>' +
          '<div style="font-size:12px;color:#7A7060;margin-top:4px;">' +
            (parsed.subtotal > 0 ? 'Subtotal: ' + formatMoney(parsed.subtotal) + '<br>' : '') +
            (parsed.tax > 0 ? 'Tax: ' + formatMoney(parsed.tax) + '<br>' : '') +
            (parsed.shipping > 0 ? 'Shipping: ' + formatMoney(parsed.shipping) : '') +
          '</div>' +
        '</div>' +
      '</div>' +

      // Difference callout
      (diff !== 0 ? '<div style="padding:12px;margin-bottom:16px;background:' + (diff > 0 ? 'rgba(225,106,91,0.08)' : 'rgba(95,165,107,0.08)') + ';border-left:3px solid ' + diffColor + ';">' +
        '<div style="font-size:13px;font-weight:600;color:' + diffColor + ';">Difference: ' + diffSign + formatMoney(Math.abs(diff)) + '</div>' +
        '<div style="font-size:11px;color:#7A7060;margin-top:2px;">' + (diff > 0 ? 'Vendor invoice is higher than your PO' : 'Vendor invoice is lower than your PO') + '</div>' +
      '</div>' : '') +

      // Manual entry fields if PDF couldn't be parsed
      '<div style="margin-bottom:16px;">' +
        '<div style="font-size:12px;font-weight:600;color:#1B3352;margin-bottom:8px;">Verify / Enter Invoice Amounts:</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;">' +
          '<div><label style="font-size:10px;color:#7A7060;font-weight:600;">Subtotal</label><input class="form-input" id="viSubtotal" type="number" step="0.01" value="' + (parsed.subtotal || '').toString() + '" style="font-size:13px;"></div>' +
          '<div><label style="font-size:10px;color:#7A7060;font-weight:600;">Tax</label><input class="form-input" id="viTax" type="number" step="0.01" value="' + (parsed.tax || '').toString() + '" style="font-size:13px;"></div>' +
          '<div><label style="font-size:10px;color:#7A7060;font-weight:600;">Shipping</label><input class="form-input" id="viShipping" type="number" step="0.01" value="' + (parsed.shipping || '').toString() + '" style="font-size:13px;"></div>' +
          '<div><label style="font-size:10px;color:#7A7060;font-weight:600;">Total</label><input class="form-input" id="viTotal" type="number" step="0.01" value="' + (parsed.total || '').toString() + '" style="font-size:13px;font-weight:700;"></div>' +
        '</div>' +
      '</div>' +

      // Notes
      '<div style="margin-bottom:16px;">' +
        '<label style="font-size:10px;color:#7A7060;font-weight:600;">Notes on changes:</label>' +
        '<textarea class="form-textarea" id="viNotes" rows="2" style="font-size:12px;" placeholder="e.g. Price increased on item #42039, freight added...">' +
          (diff !== 0 ? 'Vendor invoice total (' + formatMoney(vendorTotal) + ') differs from PO (' + formatMoney(poTotal) + ') by ' + diffSign + formatMoney(Math.abs(diff)) : '') +
        '</textarea>' +
      '</div>' +

      // Actions
      '<div style="display:flex;flex-direction:column;gap:8px;">' +
        '<button class="btn btn-primary" style="width:100%;padding:12px;" onclick="applyVendorInvoiceToPO(\'' + projectId + '\',\'' + poId + '\',\'' + escAttr(fileUrl) + '\',\'' + escAttr(fileName) + '\')">✅ Update PO with Vendor Invoice Amounts</button>' +
        (parsed.shipping > 0 || true ? '<button class="btn btn-secondary" style="width:100%;padding:10px;" onclick="invoiceClientForShipping(\'' + projectId + '\',\'' + poId + '\')">🧾 Create Client Invoice for Shipping & Tax Fees</button>' : '') +
        '<button class="btn btn-secondary" style="width:100%;padding:10px;" onclick="attachVendorInvoiceToPO(\'' + projectId + '\',\'' + poId + '\',\'' + escAttr(fileUrl) + '\',\'' + escAttr(fileName) + '\')">📎 Just Attach Invoice to PO (no changes)</button>' +
      '</div>';
  };

  // Apply vendor invoice amounts to PO
  window.applyVendorInvoiceToPO = async function(projectId, poId, fileUrl, fileName) {
    try {
      var subtotal = parseFloat(document.getElementById('viSubtotal').value) || 0;
      var tax = parseFloat(document.getElementById('viTax').value) || 0;
      var shipping = parseFloat(document.getElementById('viShipping').value) || 0;
      var total = parseFloat(document.getElementById('viTotal').value) || 0;
      var notes = (document.getElementById('viNotes').value || '').trim();

      var poDoc = await db.collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
      var po = poDoc.exists ? poDoc.data() : {};
      var items = po.items || [];
      var oldTotal = parseFloat(po.total) || 0;

      // Add tax as a line item if present
      if (tax > 0) {
        var existingTax = items.find(function(i) { return i.expenseType === 'sales_tax'; });
        if (existingTax) {
          existingTax.cost = tax;
          existingTax.amount = tax;
        } else {
          items.push({
            title: 'Pre-Paid Sales Tax (from vendor invoice)',
            vendor: po.vendor || '',
            qty: 1, cost: tax, amount: tax, markupPct: 0, shipping: 0,
            expenseType: 'sales_tax', room: '', category: ''
          });
        }
      }

      // Add shipping as a line item if present
      if (shipping > 0) {
        var existingShip = items.find(function(i) { return i.expenseType === 'shipping'; });
        if (existingShip) {
          existingShip.cost = shipping;
          existingShip.amount = shipping;
        } else {
          items.push({
            title: 'Shipping/Freight (from vendor invoice)',
            vendor: po.vendor || '',
            qty: 1, cost: shipping, amount: shipping, markupPct: 0, shipping: 0,
            expenseType: 'shipping', room: '', category: ''
          });
        }
      }

      // Update total
      var newTotal = total > 0 ? total : subtotal + tax + shipping;

      // Build attachments
      var attachments = po.attachments || [];
      if (fileUrl && fileName) {
        attachments.push({
          name: fileName,
          url: fileUrl,
          type: 'vendor_invoice',
          addedAt: new Date().toISOString()
        });
      }

      // Build change log note
      var changeNote = 'Vendor invoice applied: ' +
        (total > 0 ? 'Total ' + formatMoney(total) : '') +
        (tax > 0 ? ', Tax ' + formatMoney(tax) : '') +
        (shipping > 0 ? ', Shipping ' + formatMoney(shipping) : '') +
        (oldTotal !== newTotal ? ' (was ' + formatMoney(oldTotal) + ')' : '');
      if (notes) changeNote += '\nNotes: ' + notes;

      var _cUser = (currentUser && currentUser.displayName) || (currentUser && currentUser.email) || 'Unknown';

      await db.collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).update({
        items: items,
        total: newTotal,
        attachments: attachments,
        vendorInvoiceTotal: total,
        vendorInvoiceTax: tax,
        vendorInvoiceShipping: shipping,
        vendorInvoiceNum: document.getElementById('viNotes') ? '' : '',
        updatedAt: new Date().toISOString(),
        lastEditedBy: _cUser,
        activityLog: firebase.firestore.FieldValue.arrayUnion({
          action: 'vendor_invoice_applied',
          details: changeNote,
          userName: _cUser,
          userEmail: (currentUser && currentUser.email) || '',
          timestamp: new Date().toISOString()
        })
      });

      showToast('PO updated with vendor invoice amounts. ' + (notes ? 'Notes saved.' : ''), 3000);

      // Close overlay and refresh
      var overlay = document.querySelector('div[style*="fixed"][style*="z-index:2000"]');
      if (overlay) overlay.remove();
      if (typeof _cacheTime !== 'undefined') _cacheTime = 0;
      navigate('#/project/' + projectId + '/po/' + poId);
    } catch(e) {
      console.error('Apply vendor invoice error:', e);
      alert('Error: ' + e.message);
    }
  };

  // Attach vendor invoice PDF to PO without updating amounts
  window.attachVendorInvoiceToPO = async function(projectId, poId, fileUrl, fileName) {
    try {
      var poDoc = await db.collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
      var po = poDoc.exists ? poDoc.data() : {};
      var attachments = po.attachments || [];
      if (fileUrl && fileName) {
        attachments.push({
          name: fileName,
          url: fileUrl,
          type: 'vendor_invoice',
          addedAt: new Date().toISOString()
        });
      }
      await db.collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).update({
        attachments: attachments,
        updatedAt: new Date().toISOString()
      });
      showToast('Vendor invoice attached to PO', 2000);
      var overlay = document.querySelector('div[style*="fixed"][style*="z-index:2000"]');
      if (overlay) overlay.remove();
    } catch(e) {
      console.error('Attach error:', e);
      alert('Error: ' + e.message);
    }
  };

  // Create client invoice for shipping/tax fees from a PO
  window.invoiceClientForShipping = async function(projectId, poId) {
    try {
      var shipping = parseFloat(document.getElementById('viShipping').value) || 0;
      var tax = parseFloat(document.getElementById('viTax').value) || 0;

      if (shipping === 0 && tax === 0) {
        shipping = parseFloat(prompt('Enter shipping amount to invoice client:')) || 0;
        if (shipping === 0) return;
      }

      var poDoc = await db.collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
      var po = poDoc.exists ? poDoc.data() : {};

      // Get project/client info
      var projDoc = await db.collection('boards').doc(projectId).get();
      var projData = projDoc.exists ? projDoc.data() : {};

      var invNum = await window.getNextDocNumber('INV');
      var _cUser = (currentUser && currentUser.displayName) || (currentUser && currentUser.email) || 'Unknown';

      var invItems = [];
      if (shipping > 0) {
        invItems.push({
          title: 'Shipping/Freight — ' + esc(po.vendor || 'Vendor') + ' PO ' + (po.number || po.poNum || ''),
          description: 'Freight and delivery charges per vendor invoice',
          vendor: po.vendor || '', qty: 1, cost: shipping, amount: shipping,
          markupPct: 0, shipping: 0, expenseType: 'shipping', room: '', category: ''
        });
      }
      if (tax > 0) {
        invItems.push({
          title: 'Pre-Paid Sales Tax — ' + esc(po.vendor || 'Vendor') + ' PO ' + (po.number || po.poNum || ''),
          description: 'Sales tax prepaid to vendor',
          vendor: po.vendor || '', qty: 1, cost: tax, amount: tax,
          markupPct: 0, shipping: 0, expenseType: 'sales_tax', room: '', category: ''
        });
      }

      var invTotal = invItems.reduce(function(s, i) { return s + (parseFloat(i.amount) || 0); }, 0);

      var invRef = await db.collection('boards').doc(projectId).collection('invoices').add({
        invoiceNum: invNum, number: invNum,
        status: 'Draft', total: invTotal, items: invItems,
        clientName: po.clientName || projData.clientName || '',
        clientEmail: po.clientEmail || projData.clientEmail || '',
        clientPhone: po.clientPhone || projData.clientPhone || '',
        clientAddress: po.clientAddress || projData.clientAddress || '',
        linkedPOId: poId, linkedPONum: po.number || po.poNum || '',
        vendor: po.vendor || '',
        createdAt: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        payments: [], published: false,
        notes: 'Shipping and/or tax fees from ' + (po.vendor || 'vendor') + ' PO ' + (po.number || po.poNum || '') + '.',
        createdBy: _cUser,
        activityLog: [{
          action: 'created_from_po_shipping',
          details: 'Shipping/tax invoice from PO ' + (po.number || po.poNum || ''),
          userName: _cUser, userEmail: (currentUser && currentUser.email) || '',
          timestamp: new Date().toISOString()
        }]
      });

      // Link back to PO
      await db.collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).update({
        linkedInvoiceId: invRef.id, linkedInvoiceNum: invNum
      });

      showToast('Client invoice ' + invNum + ' created for ' + formatMoney(invTotal), 3000);

      var overlay = document.querySelector('div[style*="fixed"][style*="z-index:2000"]');
      if (overlay) overlay.remove();

      if (typeof _cacheTime !== 'undefined') _cacheTime = 0;
      navigate('#/project/' + projectId + '/invoice/' + invRef.id);
    } catch(e) {
      console.error('Create shipping invoice error:', e);
      alert('Error: ' + e.message);
    }
  };


  // ============================================================
  // 29. Add "Scan Vendor Invoice" button to PO detail topbar (via hashchange, no wrapper)
  // ============================================================
  window.addEventListener('hashchange', function() {
    var hash = window.location.hash || '';
    var poMatch = hash.match(/#\/project\/([^/]+)\/po\/([^/]+)/);
    if (!poMatch) return;
    var projectId = poMatch[1];
    var poId = poMatch[2];

    setTimeout(function() {
      var topbar = document.querySelector('.topbar-actions');
      if (!topbar) return;
      if (topbar.innerHTML.indexOf('scanVendorInvoice') >= 0) return;
      var saveBtn = topbar.querySelector('button[onclick*="docEditSave"]');
      if (saveBtn) {
        var scanBtn = document.createElement('button');
        scanBtn.className = 'btn btn-sm';
        scanBtn.style.cssText = 'background:#FF8F00;color:#FFFFFF;border:none;margin-right:4px;';
        scanBtn.innerHTML = '📄 Scan Vendor Invoice';
        scanBtn.onclick = function() { scanVendorInvoice(projectId, poId); };
        topbar.insertBefore(scanBtn, saveBtn);
      }
    }, 800);
  });


  // ============================================================
  // INITIALIZATION — Log module load
  // ============================================================
  console.log('[CCH Fix] Proposals/Invoices/POs fix module loaded — ' + new Date().toLocaleString());
  console.log('[CCH Fix] Bugs fixed: #49, #50, #51, #52, #53 + 10 screenshot issues');
  console.log('[CCH Fix] Features added: #56 (summary), #57 (filter), #66 (markup), #67 (linked docs)');
  console.log('[CCH Fix] Invoice actions: Send to Client, Publish to Dashboard, Past Due, Duplicate, Archive, Tear Sheets');
  console.log('[CCH Fix] PO features: Vendor Invoice Scanner, Shipping Invoice to Client, Item Types on all docs');

})();
