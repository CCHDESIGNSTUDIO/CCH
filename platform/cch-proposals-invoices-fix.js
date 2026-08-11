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
 * Related (main app): Inspiration tiles can store libraryProductId after saving to the Product Library
 * or adding to a proposal; proposal lines then carry the same id for catalog sync — see index.html
 * (ibPatchIdeabookImageLibraryLink, saveProduct, ibIdeabookConfirmAddToProposal).
 *
 * Integration: Add <script src="cch-proposals-invoices-fix.js"></script> to index.html
 * after the main app code (before </body>).
 */

(function() {
  'use strict';

  if (window.CCH_PO_QB_BILL_ONLY === undefined) window.CCH_PO_QB_BILL_ONLY = true;
  if (typeof window.cchPoQbBillOnlyMode !== 'function') {
    window.cchPoQbBillOnlyMode = function() { return window.CCH_PO_QB_BILL_ONLY !== false; };
  }

  // Fallback: allow staff to mark final proposal approval when index helper is unavailable.
  if (typeof window.approveProposalTotalForClient !== 'function') {
    window.approveProposalTotalForClient = async function(projectId, proposalId) {
      try {
        var docRef = db.collection('boards').doc(projectId).collection('proposals').doc(proposalId);
        var snap = await docRef.get();
        if (!snap.exists) { if (typeof cchAlert === 'function') await cchAlert('Proposal not found.', 'Approve for Client'); return; }
        var prop = snap.data() || {};
        var gate = (typeof proposalInvoiceGateSummary === 'function')
          ? proposalInvoiceGateSummary(prop, prop.items || [])
          : { pendingCount: 0, approvedCount: 1 };
        if ((gate.pendingCount || 0) > 0) { if (typeof cchAlert === 'function') await cchAlert('Please resolve pending line decisions first.', 'Approve for Client'); return; }
        if ((gate.approvedCount || 0) < 1) { if (typeof cchAlert === 'function') await cchAlert('At least one line must be approved.', 'Approve for Client'); return; }
        if (!(await cchConfirm('Mark this proposal as approved for the client?', 'Approve for Client', { confirmText: 'Approve Total' }))) return;
        var nowIso = new Date().toISOString();
        var userEmail = (window.currentUser && window.currentUser.email) || '';
        await docRef.update({
          status: 'Approved',
          clientApprovedTotalAt: nowIso,
          clientApprovedTotalBy: userEmail ? ('staff:' + userEmail) : 'staff',
          approvedAt: prop.approvedAt || nowIso,
          approvedBy: prop.approvedBy || userEmail || 'Designer',
          updatedAt: nowIso
        });
        if (typeof showToast === 'function') showToast('Proposal marked approved for client.');
        if (typeof renderProjectDetail === 'function') renderProjectDetail();
      } catch (e) {
        if (typeof cchAlert === 'function') await cchAlert('Could not approve proposal total: ' + (e.message || e), 'Approve for Client');
      }
    };
  }

  /** Safe inside HTML onclick="fn('…')" — never use JSON.stringify (breaks the attribute). */
  function cchEscJsStr(t) {
    if (t == null) return '';
    return String(t).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ');
  }

  /** Document tag for lists — never falls back to memo/notes. */
  window.documentTagDisplayText = window.documentTagDisplayText || function(doc) {
    if (!doc) return '';
    if (typeof window.proposalDocumentTagText === 'function') return window.proposalDocumentTagText(doc);
    var s = String(doc.shortDescription || '').trim();
    if (s) return s;
    var d = doc.documentTags;
    if (d != null) {
      if (Array.isArray(d)) {
        var j = d.map(function(x) { return String(x || '').trim(); }).filter(Boolean).join(', ');
        if (j) return j;
      } else if (String(d).trim()) return String(d).trim();
    }
    var t = doc.tags;
    if (t != null) {
      if (Array.isArray(t)) {
        var tj = t.map(function(x) { return String(x || '').trim(); }).filter(Boolean).join(', ');
        if (tj) return tj;
      } else if (String(t).trim()) return String(t).trim();
    }
    return '';
  };

  /** Dropdown trigger beside doc # — lists all project proposals, invoices, POs. */
  window.cchConnectedDocsTitleBtn = function(projectId, docType, docId, docNum) {
    var jsType = docType === 'po' ? 'po' : (docType === 'invoice' ? 'invoice' : 'proposal');
    return '<button type="button" class="btn btn-secondary btn-sm cch-conn-docs-btn" style="font-size:11px;padding:4px 10px;vertical-align:middle;flex-shrink:0;" ' +
      'onclick="event.stopPropagation();showConnectedDocs(\'' + cchEscJsStr(projectId) + '\',\'' + jsType + '\',\'' + cchEscJsStr(docId) + '\',\'' + cchEscJsStr(docNum || '') + '\',this)" ' +
      'title="Linked proposal, invoice, and POs for this document">\u25BE Connected docs</button>';
  };

  /** Finance list Linked Docs column — dropdown trigger (doc # + vendor in menu). */
  window.cchFinLinkedDocsListsForProject = function(projectId) {
    var pid = String(projectId || '');
    function byPid(arr) {
      return (arr || []).filter(function(d) { return String(d.projectId || '') === pid; });
    }
    return {
      proposals: byPid(window._cachedProposals),
      invoices: byPid(window._cachedInvoices),
      pos: byPid(window._cachedPOs)
    };
  };

  window.cchFinLinkedDocsCellHtml = function(projectId, docType, docId, collection, docData, lists) {
    if (!lists || (!lists.proposals && !lists.invoices && !lists.pos)) {
      lists = window.cchFinLinkedDocsListsForProject(projectId);
    }
    var links = (typeof window.cchCollectLinkedProjectDocsSync === 'function')
      ? window.cchCollectLinkedProjectDocsSync(docType, docId, docData || {}, lists || {}, { strictLinks: true }) : [];
    if (!links.length) {
      return '<span style="font-size:11px;color:var(--gray-300);">—</span>';
    }
    var jsType = docType === 'po' ? 'po' : (docType === 'invoice' ? 'invoice' : 'proposal');
    var btnLabel = links.length === 1 ? links[0].label : (links.length + ' linked');
    var tip = links.map(function(d) {
      return d.label + (d.vendor ? ' · ' + d.vendor : '');
    }).join('\n');
    return '<button type="button" class="btn btn-secondary btn-sm cch-fin-linked-docs-btn" style="font-size:11px;padding:3px 8px;white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis;" ' +
      'onclick="event.stopPropagation();showConnectedDocs(\'' + cchEscJsStr(projectId) + '\',\'' + jsType + '\',\'' + cchEscJsStr(docId) + '\',\'\',this)" ' +
      'title="' + esc(tip) + '">▾ ' + esc(btnLabel) + '</button>';
  };

  /** Session cache TTL for library / clips / linked-docs warm (ms). */
  window.CCH_DOC_SESSION_CACHE_MS = window.CCH_DOC_SESSION_CACHE_MS || (5 * 60 * 1000);

  /**
   * Warm invoice line library + image context once per doc open (view or edit).
   * Skips repeat work when switching view → edit in the same session.
   */
  window.cchWarmInvoiceDisplayContext = async function(projectId, docData, items, opts) {
    opts = opts || {};
    var docId = (docData && (docData.id || docData.docId)) || '';
    var warmKey = String(projectId || '') + '|' + String(docId || '');
    if (!opts.force && window._cchInvoiceWarmKey === warmKey &&
        (Date.now() - (window._cchInvoiceWarmAt || 0)) < window.CCH_DOC_SESSION_CACHE_MS) {
      return { skipped: true, warmKey: warmKey };
    }
    if (typeof ensureLibraryProductsForLineItems === 'function') {
      await ensureLibraryProductsForLineItems(items);
    }
    if (typeof ensureLibraryCacheForInvoiceImageFallback === 'function') {
      await ensureLibraryCacheForInvoiceImageFallback(items);
    }
    if (typeof buildInvoiceLineImageFallbackContext === 'function') {
      await buildInvoiceLineImageFallbackContext(projectId, docData, items);
    }
    if (opts.resolveCache !== false && typeof cchBuildDocLineResolveCache === 'function') {
      await cchBuildDocLineResolveCache(items);
    }
    window._cchInvoiceWarmKey = warmKey;
    window._cchInvoiceWarmAt = Date.now();
    return { skipped: false, warmKey: warmKey };
  };

  /** True for staging/test placeholders like "[Scrubbed: cloud-rolling-hills]" — hide in client-facing view. */
  window.cchIsScrubbedDisplayText = function(val) {
    var s = String(val || '').trim();
    if (!s) return false;
    return /^\[?\s*scrubbed\s*:/i.test(s) || /\[scrubbed\s*:[^\]]+\]/i.test(s);
  };

  window.cchSanitizeClientDisplayValue = function(val, fallback) {
    if (typeof window.cchIsScrubbedDisplayText === 'function' && window.cchIsScrubbedDisplayText(val)) {
      return String(fallback || '').trim();
    }
    var s = String(val || '').trim();
    if (s && /^[a-z0-9][a-z0-9-]*$/i.test(s) && !/\s/.test(s) && s.length < 48) {
      var fb = String(fallback || '').trim();
      if (fb && fb !== s && !window.cchIsScrubbedDisplayText(fb)) return fb;
    }
    return s;
  };

  /** PO-style Summary / Document Tags / Memo — read-only or editable (uses docEdit* save handlers). */
  window.cchDocTagsMemoBlockHTML = function(docData, opts) {
    opts = opts || {};
    var tagsRaw = docData.documentTags != null ? docData.documentTags : docData.tags;
    var tagsVal = Array.isArray(tagsRaw) ? tagsRaw.join(', ') : String(tagsRaw || '');
    var memoVal = String(docData.memo || docData.notes || '');
    if (opts.editable) {
      var _pid = opts.projectId ? String(opts.projectId).replace(/'/g, "\\'") : '';
      var _docId = opts.docId || opts.proposalId || opts.poId || '';
      _docId = _docId ? String(_docId).replace(/'/g, "\\'") : '';
      var _collection = opts.collection || (opts.proposalId ? 'proposals' : 'purchaseOrders');
      var _blurFlush = '';
      if (_pid && _docId) {
        if (_collection === 'proposals' || opts.proposalId) {
          _blurFlush = 'onblur="if(typeof flushProposalDocMetaSave===\'function\')flushProposalDocMetaSave(\'' + _pid + '\',\'' + _docId + '\').catch(function(){});"';
        } else if (typeof window.flushDocMetaSave === 'function') {
          _blurFlush = 'onblur="flushDocMetaSave(\'' + _pid + '\',\'' + _docId + '\',\'' + _collection + '\').catch(function(){});"';
        }
      }
      return '<div class="cch-doc-tags-memo-block" style="background:#FFFFFF;padding:18px 24px;margin-bottom:20px;border:1px solid rgba(196,164,100,0.08);">' +
        '<div style="margin-bottom:14px;">' +
          '<div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--gold);letter-spacing:0.3px;">Summary (lists &amp; email subject)</div>' +
          '<input class="form-input" id="docEditShortDescription" maxlength="200" value="' + escAttr(docData.shortDescription || '') + '" placeholder="Short line for project list &amp; client email subject" oninput="typeof docEditUpdateShortDescription===\'function\'&&docEditUpdateShortDescription()" ' + _blurFlush + ' style="font-size:12px;color:#1B3352;">' +
        '</div>' +
        '<div style="margin-bottom:12px;">' +
          '<div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--gold);letter-spacing:0.3px;">Document Tags</div>' +
          '<input class="form-input" id="docEditTags" value="' + escAttr(tagsVal) + '" placeholder="e.g. Accessories, Phase 1 — Smith bath" oninput="typeof docEditUpdateTags===\'function\'&&docEditUpdateTags()" ' + _blurFlush + ' style="font-size:12px;color:#1B3352;">' +
        '</div>' +
        '<div style="margin-bottom:8px;">' +
          '<div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--gold);letter-spacing:0.3px;">Memo</div>' +
          '<textarea class="form-textarea" id="docEditMemo" rows="3" placeholder="Internal notes (not shown in Document tags column)..." oninput="typeof docEditUpdateMemo===\'function\'&&docEditUpdateMemo()" ' + _blurFlush + ' style="font-size:12px;color:#1B3352;">' + esc(memoVal) + '</textarea>' +
        '</div>' +
        (opts.hint ? '<p style="font-size:11px;color:#5C6B80;margin:0;line-height:1.45;">' + opts.hint + '</p>' : '') +
        '</div>';
    }
    var summary = String(docData.shortDescription || '').trim();
    var tags = String(tagsVal || '').trim();
    var memo = String(memoVal || '').trim();
    var dash = '<span style="color:var(--gray-300);">—</span>';
    var row = function(label, val) {
      return '<div style="margin-bottom:12px;">' +
        '<div style="font-size:12px;font-weight:700;margin-bottom:4px;color:var(--gold);letter-spacing:0.3px;">' + label + '</div>' +
        '<div style="font-size:13px;color:#1B3352;line-height:1.5;white-space:pre-wrap;">' + (val ? esc(val) : dash) + '</div></div>';
    };
    if (opts.compact) {
      var cell = function(label, val) {
        return '<div><div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#9CA3AF;margin-bottom:3px;">' + label + '</div>' +
          '<div style="font-size:12px;color:#1B3352;line-height:1.4;white-space:pre-wrap;">' + (val ? esc(val) : dash) + '</div></div>';
      };
      return '<div class="cch-doc-view-panel cch-doc-foot-meta">' +
        '<div class="cch-doc-view-panel-title" style="margin-bottom:8px;">Summary &amp; notes</div>' +
        '<div class="cch-doc-foot-grid">' +
          cell('Summary (lists &amp; email)', summary) +
          cell('Document tags', tags) +
          cell('Memo', memo) +
        '</div>' +
        (opts.hint ? '<p style="font-size:10px;color:#5C6B80;margin:8px 0 0;line-height:1.4;">' + opts.hint + '</p>' : '') +
        '</div>';
    }
    return '<div class="cch-doc-tags-memo-block" style="background:#FFFFFF;padding:18px 24px;margin-bottom:20px;border:1px solid rgba(196,164,100,0.08);">' +
      row('Summary (lists &amp; email subject)', summary) +
      row('Document Tags', tags) +
      row('Memo', memo) +
      (opts.hint ? '<p style="font-size:11px;color:#5C6B80;margin:0;line-height:1.45;">' + opts.hint + '</p>' : '') +
      '</div>';
  };

  /** Save Summary / Document Tags / Memo from docEdit* fields (PO view, etc.). */
  window.flushDocMetaSave = async function(projectId, docId, collection) {
    if (!projectId || !docId || !collection) return { saved: false, reason: 'missing-args' };
    var summaryEl = document.getElementById('docEditShortDescription');
    var tagsEl = document.getElementById('docEditTags');
    var memoEl = document.getElementById('docEditMemo');
    if (!summaryEl && !tagsEl && !memoEl) return { saved: false, reason: 'no-fields' };
    var shortDescription = summaryEl ? String(summaryEl.value || '').trim() : '';
    var documentTags = tagsEl ? String(tagsEl.value || '').trim() : '';
    if (!shortDescription && documentTags) shortDescription = documentTags;
    if (!documentTags && shortDescription) documentTags = shortDescription;
    var memo = memoEl ? String(memoEl.value || '') : '';
    var patch = {
      shortDescription: shortDescription,
      documentTags: documentTags,
      tags: documentTags,
      memo: memo,
      notes: memo,
      updatedAt: new Date().toISOString()
    };
    await db.collection('boards').doc(projectId).collection(collection).doc(docId).update(patch);
    if (window._docEdit && window._docEdit.docId === docId && window._docEdit.projectId === projectId) {
      Object.assign(window._docEdit.docData, patch);
    }
    if (typeof window.invalidateSearchCache === 'function') window.invalidateSearchCache();
    if (typeof window._cacheTime !== 'undefined') window._cacheTime = 0;
    return { saved: true };
  };

  // Flush proposal Summary/Tags/Memo when leaving edit route without Done editing
  var _cchPropMetaLastHash = window.location.hash || '';
  window.addEventListener('hashchange', function() {
    var prev = _cchPropMetaLastHash;
    var next = window.location.hash || '';
    _cchPropMetaLastHash = next;
    if (prev.indexOf('/proposal/') < 0 || prev.indexOf('/edit') < 0) return;
    if (next.indexOf('/edit') >= 0) return;
    if (typeof window.flushProposalDocMetaSave !== 'function') return;
    if (!window._docEdit || window._docEdit.collection !== 'proposals') return;
    window.flushProposalDocMetaSave(window._docEdit.projectId, window._docEdit.docId).catch(function() {});
  });

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

    /* Doc edit top bar — Save / Cancel / Delete + More (single source: cchBuildDocEditTopbar) */
    .topbar-actions .cch-doc-edit-topbar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
      width: 100%;
      min-height: 0;
    }
    .topbar-actions .cch-doc-edit-topbar #docEditSaveInd {
      margin-right: auto;
      font-size: 11px;
      color: #5C6B80;
    }
    .topbar-actions .cch-doc-edit-topbar .btn-primary {
      font-weight: 600;
    }

    /* Doc edit page — tighter vertical rhythm */
    .cch-doc-edit-page .cch-doc-edit-header-card {
      padding: 16px 20px !important;
      margin-bottom: 12px !important;
    }
    .cch-doc-edit-page .doc-edit-line-items-card {
      padding: 16px 20px 12px !important;
      margin-bottom: 12px !important;
    }
    .cch-doc-edit-page .doc-edit-footer-card {
      padding: 14px 20px !important;
    }

    /* Invoice line-item edit — full width, no totals/payments rail (Houzz-style) */
    .cch-doc-edit-page.cch-doc-edit-lines-only {
      max-width: none !important;
    }
    .cch-doc-edit-page.cch-doc-edit-lines-only .cch-doc-edit-invoice-num {
      font-size: 18px !important;
      font-weight: 700 !important;
      font-family: var(--font-display) !important;
      margin: 0 !important;
      line-height: 1.2 !important;
      color: var(--text-primary) !important;
    }
    .cch-doc-edit-page.cch-doc-edit-lines-only .cch-doc-edit-lines-hint {
      font-size: 11px !important;
      line-height: 1.45 !important;
      color: #7A7060 !important;
      margin: 0 !important;
      padding-top: 10px !important;
      border-top: 1px solid rgba(27,51,82,0.08) !important;
    }
    .doc-edit-table thead th {
      font-size: 9px !important;
      font-weight: 700 !important;
      letter-spacing: 0.06em !important;
      text-transform: uppercase !important;
      color: #7A7060 !important;
      padding: 6px 8px !important;
      white-space: nowrap !important;
      border-bottom: 1px solid rgba(27,51,82,0.1) !important;
    }
    .doc-edit-table tbody tr.doc-edit-line-row td {
      vertical-align: middle !important;
      padding: 6px 8px !important;
    }
    .doc-edit-table .doc-edit-num-field,
    .doc-edit-table input.doc-edit-num-input {
      font-family: var(--font-mono), ui-monospace, Menlo, Consolas, monospace !important;
      font-size: 11px !important;
      font-weight: 500 !important;
      padding: 3px 5px !important;
      border: 1px solid rgba(27,51,82,0.14) !important;
      border-radius: 3px !important;
      background: #fff !important;
      color: #1B3352 !important;
      box-sizing: border-box !important;
    }
    .doc-edit-table input.doc-edit-num-field--qty { width: 52px !important; text-align: center !important; }
    .doc-edit-table input.doc-edit-num-field--money { width: 72px !important; text-align: right !important; }
    .doc-edit-table input.doc-edit-num-field--mkpct { width: 44px !important; text-align: right !important; }
    .doc-edit-table input.doc-edit-num-field--ship { width: 64px !important; text-align: right !important; }
    .doc-edit-table input.doc-edit-calc-field {
      font-family: var(--font-mono), ui-monospace, Menlo, Consolas, monospace !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      text-align: right !important;
      padding: 4px 6px !important;
      border: 1px solid rgba(196,164,100,0.2) !important;
      background: rgba(250,248,244,0.9) !important;
      color: #1B3352 !important;
      box-sizing: border-box !important;
    }
    .doc-edit-table input.doc-edit-calc-field--total {
      width: 72px !important;
      font-weight: 700 !important;
      font-size: 11px !important;
    }
    .doc-edit-table input.doc-edit-calc-field--mkdol {
      width: 72px !important;
      font-size: 10px !important;
      color: #5C6B80 !important;
    }
    .doc-edit-table select.doc-edit-room-select {
      font-size: 11px !important;
      padding: 4px 6px !important;
      max-width: 132px !important;
      border: 1px solid rgba(27,51,82,0.14) !important;
    }
    .doc-edit-row {
      min-height: 48px !important;
    }
    .doc-edit-img, .doc-edit-img img {
      width: 48px !important;
      height: 48px !important;
      min-width: 48px !important;
      min-height: 48px !important;
    }

    /* Line editor — Upload control readable on navy */
    .clip-detail-thumb-btns label.btn-primary,
    .clip-detail-thumb-btns label.btn-primary.btn-sm {
      color: #EDE8E0 !important;
      background: #1B3352 !important;
      border: none !important;
      font-weight: 600 !important;
    }
    .cch-doc-edit-page .doc-edit-name {
      font-size: 12px !important;
      font-weight: 600 !important;
      padding: 4px 6px !important;
    }
    .cch-doc-edit-page .doc-edit-desc {
      font-size: 11px !important;
      min-height: 28px !important;
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
    #proposalPrintArea .proposal-table-wrap .data-table td.amount,
    #proposalPrintArea .proposal-table-wrap .data-table th.amount {
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif !important;
      font-weight: 400 !important;
    }
    #proposalPrintArea .proposal-table-wrap .data-table td.prop-col-total {
      font-weight: 600 !important;
      color: #1B3352 !important;
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

    /* Invoice view — Houzz-style main + sticky payments rail */
    .cch-doc-view-page { width: 100%; max-width: none; margin: 0; padding: 0 2px 20px; box-sizing: border-box; }
    .cch-doc-view-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(248px, 268px); gap: 14px; align-items: start; }
    .cch-doc-view-main { min-width: 0; }
    .cch-doc-view-rail { position: sticky; top: 52px; display: flex; flex-direction: column; gap: 8px; }
    .cch-doc-view-rail-card { background: #FAFAF8; border: 1px solid rgba(27,51,82,0.1); padding: 10px 12px; }
    .cch-doc-view-rail-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #5C6B80; margin-bottom: 6px; }
    .cch-doc-view-rail-row { display: flex; justify-content: space-between; font-size: 11px; color: #5C6B80; margin-bottom: 2px; gap: 8px; line-height: 1.35; }
    .cch-doc-view-rail-row strong { font-family: var(--font-mono); color: #1B3352; font-weight: 600; font-size: 11px; }
    .cch-doc-view-rail-grand { font-size: 13px; font-weight: 700; padding-top: 6px; margin-top: 4px; border-top: 1px solid #1B3352; }
    .cch-doc-view-rail-balance { font-size: 14px !important; }
    .cch-doc-view-rail-actions { display: flex; flex-direction: column; gap: 4px; }
    .cch-doc-view-rail-actions .btn { width: 100%; justify-content: center; font-size: 11px; padding: 6px 10px; }
    .cch-doc-line-totals-footer { display: flex; justify-content: flex-end; margin-top: 16px; padding-top: 14px; border-top: 2px solid #1B3352; }
    .cch-doc-line-totals-inner { min-width: 260px; width: 100%; max-width: 320px; }
    .cch-doc-line-totals-row { display: flex; justify-content: space-between; font-size: 13px; color: #5C6B80; margin-bottom: 4px; gap: 12px; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
    .cch-doc-line-totals-row span:last-child { color: #1B3352; font-weight: 500; }
    .cch-doc-line-totals-grand { display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; color: #1B3352; padding-top: 8px; margin-top: 6px; border-top: 1px solid rgba(27,51,82,0.12); font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
    .cch-po-status-rail-card { padding: 0 !important; background: transparent !important; border: none !important; }
    .cch-po-status-rail .cch-po-procurement-lane,
    .cch-po-status-rail .cch-po-bill-lane,
    .cch-po-status-rail .cch-po-shipping-lane {
      margin-bottom: 8px !important;
      padding: 8px 10px !important;
      background: #FAFAF8 !important;
      border: 1px solid rgba(27,51,82,0.1) !important;
      border-radius: 0 !important;
    }
    .cch-po-status-rail .cch-po-procurement-lane:last-child,
    .cch-po-status-rail .cch-po-shipping-lane:last-child { margin-bottom: 0 !important; }
    .cch-po-status-rail .btn { font-size: 10px !important; padding: 4px 8px !important; }
    .cch-po-status-rail select.form-input { max-width: 100% !important; font-size: 11px !important; }
    .cch-doc-view-header h1 { font-size: 18px !important; }
    .cch-doc-view-header .cch-doc-hdr-actions { margin-left: auto; text-align: right; flex-shrink: 0; }
    .cch-doc-view-panel { background: #FFFFFF; padding: 10px 14px; margin-bottom: 10px; border: 1px solid rgba(200,185,154,0.08); }
    .cch-doc-view-panel-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 8px; }
    .cch-doc-view-panel-title { font-size: 9px; text-transform: uppercase; letter-spacing: 1.2px; color: var(--gray-400); font-weight: 600; }
    .cch-doc-view-meta { display: flex; flex-wrap: wrap; gap: 12px 20px; font-size: 12px; color: #5C6B80; margin-bottom: 8px; }
    .cch-doc-view-billto { font-size: 12px; line-height: 1.45; color: #1B3352; }
    .cch-doc-view-client-edit { display: none; margin-top: 8px; }
    .cch-doc-view-client-edit.is-open { display: block; }
    .cch-inv-pay-row { font-size: 11px; padding: 5px 0; border-bottom: 1px solid rgba(27,51,82,0.06); color: #5C6B80; line-height: 1.35; }
    .cch-inv-pay-row:last-child { border-bottom: none; }
    .cch-inv-dup-warn { margin-bottom: 10px; padding: 8px 12px; background: rgba(245,158,11,0.1); border: 1px solid rgba(217,119,6,0.35); font-size: 11px; line-height: 1.4; color: #92400E; }
    .cch-doc-foot-meta { margin-top: 10px; margin-bottom: 0; }
    .cch-doc-foot-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px 16px; }
    @media (max-width: 960px) { .cch-doc-foot-grid { grid-template-columns: 1fr; } }
    .cch-doc-view-page .cch-inv-line-group { margin-bottom: 14px !important; }
    @media (max-width: 1100px) {
      .cch-doc-view-grid { grid-template-columns: 1fr; }
      .cch-doc-view-rail { position: static; }
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

  // --- Proposal view vs edit: enforced after every render (works even if index.html is cached old) ---
  function cchProposalRouteIsEdit(projectId, proposalId) {
    var r = (window.location.hash || '#/').replace('#/', '').split('/');
    return r[0] === 'project' && r[1] === projectId && r[2] === 'proposal' && r[3] === proposalId && r[4] === 'edit';
  }

  function cchEscProposalCell(t) {
    if (typeof window.esc === 'function') return window.esc(t);
    var s = String(t == null ? '' : t);
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function cchApplyProposalViewOnlyDOM(wrap, projectId, proposalId) {
    if (!wrap) return;
    /* Phase 2: designer Manage landing keeps row controls; do not strip drag/checkbox/pills. */
    if (wrap.getAttribute('data-cch-proposal-manage') === '1') return;
    wrap.classList.add('cch-proposal-viewonly');
    wrap.setAttribute('data-cch-pid', projectId);
    wrap.setAttribute('data-cch-prid', proposalId);
    wrap.querySelectorAll('tbody tr[draggable="true"]').forEach(function(tr) { tr.removeAttribute('draggable'); });
    wrap.querySelectorAll('tbody tr.prop-group-row').forEach(function(tr) {
      tr.querySelectorAll('button').forEach(function(b) {
        var oc = b.getAttribute('onclick') || '';
        if (oc.indexOf('toggleProposalGroupCollapse') < 0) b.style.display = 'none';
      });
      tr.querySelectorAll('input.form-input').forEach(function(inp) {
        var sp = document.createElement('span');
        sp.style.cssText = 'font-weight:600;font-size:14px;display:inline-block;max-width:520px;vertical-align:middle;margin-right:10px;';
        sp.textContent = inp.value || '';
        inp.parentNode.insertBefore(sp, inp);
        inp.remove();
      });
      tr.querySelectorAll('label').forEach(function(l) { l.style.display = 'none'; });
    });
    wrap.querySelectorAll('tbody tr').forEach(function(tr) {
      if (tr.classList.contains('prop-group-row')) return;
      var tds = tr.querySelectorAll('td');
      if (tds.length > 2) {
        var dragOrGrab = (tds[0].textContent || '').indexOf('⋮⋮') >= 0 || (tds[0].getAttribute('title') || '').indexOf('Drag') >= 0;
        var bulkCb = tds[1].querySelector && tds[1].querySelector('input.propBulkSelectCb[type="checkbox"]');
        if (dragOrGrab || bulkCb) {
          tds[0].innerHTML = '';
          tds[1].innerHTML = '';
        }
      }
      tr.querySelectorAll('td').forEach(function(td) {
        if (td.classList.contains('prop-item-cell')) return;
        if (td.classList.contains('prop-sticky-inv')) return;
        if (td.classList.contains('prop-sticky-actions')) return;
        var inp = td.querySelector('input.form-input, select.form-input');
        if (!inp) return;
        var raw = inp.tagName === 'SELECT'
          ? ((inp.options[inp.selectedIndex] || {}).text || '')
          : String(inp.value || '');
        td.innerHTML = '<span style="font-size:12px;">' + cchEscProposalCell(raw || '—') + '</span>';
      });
    });
    var tableWrap = wrap.querySelector('.proposal-table-wrap');
    /* Phase 1 landing: index removed inline "View-only summary"; do not inject duplicate hint (brief: no redundant view-only line). */
    var skipHint = wrap.getAttribute('data-cch-proposal-landing') === '1' ||
      wrap.innerHTML.indexOf('View-only summary') >= 0 || wrap.innerHTML.indexOf('View-only —') >= 0;
    if (tableWrap && !document.getElementById('cchProposalViewHint') && !skipHint) {
      var hint = document.createElement('div');
      hint.id = 'cchProposalViewHint';
      hint.style.cssText = 'margin-bottom:12px;padding:10px 12px;background:rgba(27,51,82,0.06);border:1px solid rgba(27,51,82,0.1);border-radius:4px;font-size:12px;color:var(--gray-600);display:flex;flex-wrap:wrap;gap:10px;align-items:center;';
      hint.innerHTML = '<span>View-only — line items are not editable here. Use <strong>Edit line items</strong> in the top bar to make changes.</span>';
      tableWrap.parentNode.insertBefore(hint, tableWrap);
    }
  }

  window.cchClosePropMoreDd = function() {
    document.querySelectorAll('.cch-prop-more-dd').forEach(function(d) {
      d.style.display = 'none';
    });
  };
  if (!window._cchPropMoreDdOutside) {
    window._cchPropMoreDdOutside = true;
    document.addEventListener('click', function() {
      document.querySelectorAll('.cch-prop-more-dd').forEach(function(d) {
        if (d.style.display === 'block') d.style.display = 'none';
      });
    });
  }

  function cchPropMoreItem(label, jsAfterClose, danger) {
    var col = danger ? '#B91C1C' : '#1B3352';
    var st = 'display:block;width:100%;text-align:left;padding:9px 14px;border:none;border-radius:6px;background:#fff;cursor:pointer;font-size:13px;color:' + col + ';font-family:var(--font-body);font-weight:500;';
    return '<button type="button" style="' + st + '" onmouseover="this.style.background=\'#F4F6FA\'" onmouseout="this.style.background=\'#fff\'" onclick="cchClosePropMoreDd();' + jsAfterClose + '">' + label + '</button>';
  }

  function cchProposalMoreMenuWrap(projectId, proposalId, isEdit, invDis, tearJs, hasMyItems, isPublished) {
    var invBtn = '<button type="button" style="display:block;width:100%;text-align:left;padding:9px 14px;border:none;border-radius:6px;background:#fff;cursor:pointer;font-size:13px;color:#1B3352;font-family:var(--font-body);font-weight:500;" onmouseover="this.style.background=\'#F4F6FA\'" onmouseout="this.style.background=\'#fff\'" ' + invDis + ' onclick="cchClosePropMoreDd();convertProposalToInvoice(\'' + projectId + '\',\'' + proposalId + '\')">Start Invoice</button>';
    var publishLabel = isPublished ? 'Unpublish from Dashboard' : 'Publish to Client Dashboard';
    var publishJs = "togglePublished('" + projectId + "','" + proposalId + "'," + (isPublished ? 'false' : 'true') + ",'proposals')";
    var inner = '';
    if (isEdit) {
      inner = (hasMyItems ? cchPropMoreItem('My Items', 'toggleMyItemsPanel()') : '') +
        cchPropMoreItem('Done editing', "cchProposalDoneEditing('" + projectId + "','" + proposalId + "')") +
        cchPropMoreItem('Preview / PDF', "previewDocument('proposal','" + projectId + "','" + proposalId + "')") +
        cchPropMoreItem('Document tag / details', "editProposalMeta('" + projectId + "','" + proposalId + "')") +
        cchPropMoreItem('Send to client', "sendProposalToClient('" + projectId + "','" + proposalId + "')") +
        cchPropMoreItem(publishLabel, publishJs) +
        cchPropMoreItem('Document timeline', "toggleDocTimeline('" + projectId + "','proposals','" + proposalId + "')") +
        cchPropMoreItem('Tear Sheets', tearJs) +
        invBtn +
        cchPropMoreItem('Generate POs by Vendor', "generatePOsFromDoc('" + projectId + "','proposals','" + proposalId + "')") +
        cchPropMoreItem('Duplicate proposal', "duplicateProposalAsCopy('" + projectId + "','" + proposalId + "')") +
        cchPropMoreItem('Attach from Files', "linkDocModal('" + projectId + "','proposals','" + proposalId + "')") +
        cchPropMoreItem('Delete proposal', "deleteProposal('" + projectId + "','" + proposalId + "')", true);
    } else {
      inner = cchPropMoreItem('Edit proposal', "navigate('#/project/" + projectId + "/proposal/" + proposalId + "/edit')") +
        cchPropMoreItem('Document tag / details', "editProposalMeta('" + projectId + "','" + proposalId + "')") +
        cchPropMoreItem('Preview / PDF', "previewDocument('proposal','" + projectId + "','" + proposalId + "')") +
        cchPropMoreItem('Send to client', "sendProposalToClient('" + projectId + "','" + proposalId + "')") +
        cchPropMoreItem(publishLabel, publishJs) +
        cchPropMoreItem('Document timeline', "toggleDocTimeline('" + projectId + "','proposals','" + proposalId + "')") +
        cchPropMoreItem('Tear Sheets', tearJs) +
        invBtn +
        cchPropMoreItem('Generate POs by Vendor', "generatePOsFromDoc('" + projectId + "','proposals','" + proposalId + "')") +
        cchPropMoreItem('Duplicate proposal', "duplicateProposalAsCopy('" + projectId + "','" + proposalId + "')") +
        cchPropMoreItem('Attach from Files', "linkDocModal('" + projectId + "','proposals','" + proposalId + "')") +
        cchPropMoreItem('Close legacy (hide attention)', "closeProposalAsLegacy('" + projectId + "','" + proposalId + "')") +
        cchPropMoreItem('Delete proposal', "deleteProposal('" + projectId + "','" + proposalId + "')", true);
    }
    return '<div class="cch-prop-more-wrap" style="position:relative;display:inline-block;vertical-align:middle;z-index:500;">' +
      '<button type="button" class="btn btn-secondary btn-sm" style="font-weight:700;" onclick="event.stopPropagation();var w=this.closest(\'.cch-prop-more-wrap\');var m=w&&w.querySelector(\'.cch-prop-more-dd\');if(!m)return;m.style.display=m.style.display===\'block\'?\'none\':\'block\';">Options ▾</button>' +
      '<div class="cch-prop-more-dd" onclick="event.stopPropagation()" style="display:none;position:absolute;right:0;top:100%;margin-top:7px;min-width:260px;background:#fff;border:1px solid rgba(27,51,82,0.12);border-radius:8px;box-shadow:0 14px 36px rgba(27,51,82,0.16);z-index:600;padding:6px;">' + inner + '</div></div>';
  }
  window.cchProposalMoreMenuWrap = cchProposalMoreMenuWrap;

  async function cchFinalizeProposalDetailUI(projectId, proposalId) {
    if (typeof setTopbarActions !== 'function') return;
    var wrap = document.getElementById('proposalPrintArea');
    if (!wrap) return;

    var isEdit = cchProposalRouteIsEdit(projectId, proposalId);
    wrap.classList.toggle('cch-proposal-viewonly', !isEdit);

    var prop = {};
    var items = [];
    try {
      var snap = await db.collection('boards').doc(projectId).collection('proposals').doc(proposalId).get();
      if (snap.exists) {
        prop = snap.data() || {};
        items = prop.items || [];
      }
    } catch (e0) { /* keep defaults */ }

    var invGate = { ok: true };
    try {
      if (typeof proposalInvoiceGateSummary === 'function') invGate = proposalInvoiceGateSummary(prop, items);
    } catch (e1) { invGate = { ok: true }; }

    var projName = '';
    try {
      var pSnap = await db.collection('boards').doc(projectId).get();
      if (pSnap.exists) projName = (pSnap.data() || {}).name || '';
    } catch (e2) { /* */ }

    var escA = typeof escAttr === 'function' ? escAttr : function(s) { return String(s || '').replace(/"/g, '&quot;'); };
    var invOk = invGate && invGate.ok;
    var invDis = invOk ? '' : ' disabled title="Complete client approvals first" style="opacity:0.45;pointer-events:none;"';

    var addItemOnclick = typeof openDocItemsSidebar === 'function'
      ? "openDocItemsSidebar({mode:'proposal',projectId:'" + projectId + "',proposalId:'" + proposalId + "'})"
      : "addProposalLineItem('" + projectId + "','" + proposalId + "')";

    var myItemsBtn = '';
    if (isEdit && typeof toggleMyItemsPanel === 'function') {
      myItemsBtn = '<button class="btn btn-secondary btn-sm" onclick="toggleMyItemsPanel()">My Items</button>';
    }

    var tearJs = "generateTearSheetsFromDoc('" + escA(projectId) + "','proposals','" + escA(proposalId) + "','" + escA(projName) + "')";
    var moreView = cchProposalMoreMenuWrap(projectId, proposalId, false, invDis, tearJs, false, !!prop.published);
    var moreEdit = cchProposalMoreMenuWrap(projectId, proposalId, true, invDis, tearJs, !!myItemsBtn, !!prop.published);

    var invMsgs = (invGate && invGate.msgs && invGate.msgs.length) ? invGate.msgs.join(' ') : 'Complete client approvals before converting.';
    var invTitleAttr = invOk ? '' : (' title="' + escA(invMsgs) + '"');
    var convertGold = '<button type="button" class="btn btn-sm" style="font-size:13px;font-weight:700;padding:8px 18px;border-radius:0;background:linear-gradient(180deg,#E8C97A,#C9A227);color:#1a1508;border:1px solid #A88420;box-shadow:0 1px 4px rgba(0,0,0,0.08);margin-right:8px;' + (invOk ? '' : 'opacity:0.55;pointer-events:none;') + '"' + invTitleAttr + ' onclick="convertProposalToInvoice(\'' + projectId + '\',\'' + proposalId + '\')">Convert to Invoice</button>';
    var canStaffApproveClientTotal = !prop.clientApprovedTotalAt && String(prop.status || '') !== 'Invoiced';
    var approveForClientBtn = canStaffApproveClientTotal
      ? '<button class="btn btn-secondary btn-sm" onclick="approveProposalTotalForClient(\'' + projectId + '\',\'' + proposalId + '\')">✅ Approve for Client</button>'
      : '';

    if (!isEdit) {
      setTopbarActions(
        '<button class="btn btn-primary btn-sm" onclick="navigate(\'#/project/' + projectId + '/proposal/' + proposalId + '/edit\')">Edit Proposal</button>' +
        approveForClientBtn +
        '<button class="btn btn-primary btn-sm" onclick="sendProposalToClient(\'' + projectId + '\',\'' + proposalId + '\')">📧 Email client</button>' +
        convertGold +
        moreView
      );
      cchApplyProposalViewOnlyDOM(wrap, projectId, proposalId);
    } else {
      setTopbarActions(
        '<button class="btn btn-secondary btn-sm" onclick="cchProposalDoneEditing(\'' + projectId + '\',\'' + proposalId + '\')">✓ Done editing</button>' +
        '<button class="btn btn-secondary btn-sm" onclick="previewDocument(\'proposal\',\'' + projectId + '\',\'' + proposalId + '\')">\uD83D\uDC41\uFE0F Preview</button>' +
        '<button class="btn btn-primary btn-sm" onclick="' + addItemOnclick + '">+ Add item</button>' +
        approveForClientBtn +
        '<button class="btn btn-primary btn-sm" onclick="sendProposalToClient(\'' + projectId + '\',\'' + proposalId + '\')">📧 Email client</button>' +
        '<span class="btn btn-sm" style="border:1px dashed rgba(27,51,82,0.22);color:var(--gray-500);cursor:default;pointer-events:none;font-size:11px;white-space:nowrap;" title="Line changes save to the proposal as you edit">💾 Auto-save</span>' +
        moreEdit
      );
    }
  }

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
          '<button class="btn btn-secondary" onclick="navigate(\'#/project/' + projectId + '/proposals\')" style="margin-top:12px;">\u2190 Back to Proposals</button></div>';
        return;
      }
    } catch(e) {
      T.innerHTML = '<div class="empty-state"><div class="empty-text">Error loading proposal: ' + (e.message||'Unknown error') + '</div></div>';
      return;
    }
    await _origRenderProposalDetail.call(this, projectId, proposalId);
    function _runProposalFinalize() {
      cchFinalizeProposalDetailUI(projectId, proposalId).catch(function(e2) {
        console.warn('[CCH Fix] proposal UI finalize:', e2);
      });
    }
    _runProposalFinalize();
    setTimeout(_runProposalFinalize, 0);
    setTimeout(_runProposalFinalize, 150);
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
        invNumEl.value = 'INV-TEMP-' + String(Date.now());
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
    var prop = null;
    var rawItems = [];
    var sourceForInvoice = [];
    function _isGroupRow(it) {
      return it && it.lineKind === 'group';
    }
    function _lineApprovalState(it) {
      if (_isGroupRow(it)) return null;
      var s = it && it.lineApprovalStatus;
      if (s === 'approved' || s === 'declined' || s === 'pending') return s;
      return 'pending';
    }
    function _lineApprovedForInvoice(it) {
      if (_isGroupRow(it)) return false;
      if (typeof getProposalLineApprovalStatus === 'function') {
        return getProposalLineApprovalStatus(it) === 'approved';
      }
      return _lineApprovalState(it) === 'approved';
    }
    function _lineEligibleForInvoice(it) {
      if (!_lineApprovedForInvoice(it)) return false;
      if (typeof proposalLineIsInvoiced === 'function' && proposalLineIsInvoiced(it, prop)) return false;
      return true;
    }
    try {
      var propDoc = await db.collection('boards').doc(projectId).collection('proposals').doc(proposalId).get();
      if (!propDoc.exists || !propDoc.data()) {
        if (typeof cchAlert === 'function') await cchAlert('Proposal not found', 'Convert to Invoice');
        return;
      }
      prop = propDoc.data();
      rawItems = (typeof coerceProposalDocItemsArray === 'function')
        ? coerceProposalDocItemsArray(prop.items)
        : (Array.isArray(prop.items) ? prop.items : []);
      var productLines = rawItems.filter(function(it) { return !_isGroupRow(it); });
      var gateMsgs = [];
      var stLc = String(prop.status || '').trim().toLowerCase();
      var hasUninvoicedApproved = productLines.some(_lineEligibleForInvoice);
      if ((prop.linkedInvoiceId || stLc === 'invoiced') && !hasUninvoicedApproved) {
        gateMsgs.push('Every approved line on this proposal is already on an invoice. Open the linked invoice, or duplicate the proposal for another bill.');
      }
      if (gateMsgs.length === 0 && typeof proposalInvoiceGateSummary === 'function') {
        var _pg = proposalInvoiceGateSummary(prop, rawItems);
        if (!_pg.ok && _pg.msgs && _pg.msgs.length) gateMsgs = _pg.msgs.slice();
      }
      if (gateMsgs.length === 0 && typeof proposalInvoiceGateSummary !== 'function') {
        if (productLines.length === 0) gateMsgs.push('Add at least one line item.');
        var pendingN = 0, approvedN = 0;
        productLines.forEach(function(it) {
          var st = _lineApprovalState(it);
          if (st === 'pending') pendingN++;
          if (st === 'approved') approvedN++;
        });
        if (pendingN > 0) gateMsgs.push(pendingN + ' line(s) still Pending — set each to Approved or Declined.');
        if (approvedN < 1 && productLines.length > 0) gateMsgs.push('At least one line must be Approved to invoice.');
        if (!prop.clientApprovedTotalAt) gateMsgs.push('Click Approve for Client after all line decisions are set.');
      }
      if (gateMsgs.length > 0) {
        if (typeof cchAlert === 'function') await cchAlert('Cannot create invoice yet:\n\n• ' + gateMsgs.join('\n• '), 'Convert to Invoice');
        return;
      }

      sourceForInvoice = rawItems.filter(_lineEligibleForInvoice);
      if (sourceForInvoice.length === 0) {
        if (typeof cchAlert === 'function') await cchAlert('No approved, uninvoiced lines to copy. Approve lines that are not already on an invoice.', 'Convert to Invoice');
        return;
      }
      var skipped = productLines.length - sourceForInvoice.length;
      var _convMsg = 'Create a new Invoice from this proposal?\n\n• ' + sourceForInvoice.length + ' approved line(s) will be copied.\n' + (skipped > 0 ? '• ' + skipped + ' line(s) skipped (not approved or already invoiced).\n' : '') + '\nImages and pricing will transfer for each copied line.';
      if (typeof cchConfirm !== 'function') return;
      if (!(await cchConfirm(_convMsg, 'Convert to Invoice', { confirmText: 'Create Invoice' }))) return;
    } catch (eGate) {
      if (typeof cchAlert === 'function') await cchAlert('Could not validate proposal: ' + (eGate.message || eGate), 'Convert to Invoice');
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
        copied.images = (function() {
          var g = _coerceImageIterable(item.images || item.photos || item.photoUrls || item.productPhotos);
          if (g.length) return g.slice();
          return copied.imageUrl ? [_resolveImgSrc(String(copied.imageUrl).trim())] : [];
        })();
        copied.title = item.title || item.name || '';
        copied.vendor = item.vendor || '';
        copied.room = item.room || item.category || '';
        copied.category = item.category || item.room || '';
        copied.description = item.description || '';
        copied.shipTo = item.shipTo || '';
        copied.clipId = item.clipId || item.sourceClipId || copied.clipId || '';
        copied.libraryProductId = String(item.libraryProductId || item.linkedLibraryProductId || '').trim() || copied.libraryProductId || '';
        if (copied.libraryProductId) copied.libraryProductIdLocked = true;
        if (copied.clipId || copied._clipSourceTruth || copied._imageLocked) {
          copied._clipSourceTruth = copied._clipSourceTruth || !!copied.clipId;
          copied._imageLocked = true;
        }
        if (typeof window.cchProtectClipSourcedLine === 'function') window.cchProtectClipSourcedLine(copied);
        return copied;
      });

      var total = items.reduce(function(s, i) { return s + (parseFloat(i.amount) || 0); }, 0);
      var _nextInv = (typeof getNextDocNumber === 'function') ? getNextDocNumber : window.getNextDocNumber;
      if (typeof _nextInv !== 'function') {
        if (typeof cchAlert === 'function') await cchAlert('Invoice numbering is unavailable. Refresh the page and try again.', 'Convert to Invoice');
        return;
      }
      var invNum = await _nextInv('INV');

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
        shortDescription: (typeof proposalDocumentTagText === 'function' ? proposalDocumentTagText(prop) : (prop.shortDescription && String(prop.shortDescription).trim()) || ''),
        vendor: prop.vendor || '',
        documentTags: (prop.documentTags && String(prop.documentTags).trim()) || (typeof proposalDocumentTagText === 'function' ? proposalDocumentTagText(prop) : (prop.shortDescription && String(prop.shortDescription).trim()) || '') || prop.tags || prop.vendor || '',
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

      var invoicedAt = new Date().toISOString();
      var updatedProposalItems = rawItems.map(function(item) {
        if (_isGroupRow(item)) return item;
        if (!_lineEligibleForInvoice(item)) return item;
        return Object.assign({}, item, { invoicedOnInvoiceId: invRef.id, invoicedAt: invoicedAt });
      });
      var propAfterInv = { status: 'Invoiced', linkedInvoiceId: invRef.id, items: updatedProposalItems };
      var stillOpen = typeof proposalHasEditableUninvoicedLines === 'function' && proposalHasEditableUninvoicedLines(propAfterInv);
      await db.collection('boards').doc(projectId).collection('proposals').doc(proposalId).update({
        status: stillOpen ? 'Partially Invoiced' : 'Invoiced',
        linkedInvoiceId: invRef.id,
        linkedInvoiceNum: invNum,
        items: updatedProposalItems,
        updatedAt: invoicedAt
      });

      if (typeof logDocActivity === 'function') {
        logDocActivity(projectId, 'proposals', proposalId, 'converted', 'Converted to Invoice ' + invNum);
      }

      if (typeof cchAlert === 'function') await cchAlert('Invoice ' + invNum + ' created with ' + items.length + ' items!\nImages and pricing transferred.', 'Convert to Invoice');
      if (typeof _cacheTime !== 'undefined') _cacheTime = 0;
      navigate('#/project/' + projectId + '/invoice/' + invRef.id);
    } catch(e) {
      console.error('Convert failed:', e);
      if (typeof cchAlert === 'function') await cchAlert('Error: ' + e.message, 'Convert to Invoice');
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
        'onclick="linkDocModal(\'' + projectId + '\',\'' + collection + '\',\'' + docData.id + '\')" title="Attach a file from project Files &amp; Docs">' +
        '📂 Attach from Files</a>');
    }

    return badges.length > 0 ? '<div class="linked-doc-badges-area" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">' + badges.join('') + '</div>' : '';
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

    // Financial summary cards belong on the main dashboard, not the project detail tabs.
    if (window._cchShowProposalSummaryBand !== true) return;

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
    var lineAppr = 0, linePend = 0;

    proposals.forEach(function(p) {
      var amt = parseFloat(p.total) || 0;
      allTotal += amt;
      var created = p.createdAt ? new Date(p.createdAt) : null;
      if (created) {
        if (created >= startOfWeek) { weekTotal += amt; weekCount++; }
        if (created >= startOfMonth) { monthTotal += amt; monthCount++; }
        if (created >= startOfYear) { ytdTotal += amt; ytdCount++; }
      }
      var c = typeof getProposalLineApprovalCounts === 'function' ? getProposalLineApprovalCounts(p) : { appr: 0, pend: 0, dec: 0, n: 0 };
      lineAppr += c.appr;
      linePend += c.pend;
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
        '<div class="value" style="color:var(--gold);">' + lineAppr + ' <span style="font-size:12px;color:var(--gray-400);">/ ' + linePend + '</span></div>' +
        '<div class="label" title="Totals across this project: product lines marked approved vs still pending (Manage view; section headers excluded).">Lines approved / pending</div></div>' +
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
  window._proposalViewMode = 'room';

  window.toggleProposalView = function(mode, projectId, proposalId) {
    window._proposalViewMode = mode;
    // Re-render proposal detail
    if (typeof renderProposalDetail === 'function') {
      renderProposalDetail(projectId, proposalId);
    }
  };

  /** Per-document grouping mode used by proposal/invoice views + previews. */
  window.cchDocGroupModeForData = function(docData, type) {
    var raw = String((docData && (docData.groupByView || docData.groupMode)) || '').toLowerCase().trim();
    if (raw === 'room' || raw === 'category') return raw;
    // Default to room-first grouping for proposal/invoice output.
    return (type === 'invoice' || type === 'proposal') ? 'room' : 'category';
  };

  window.cchGroupDocumentItems = function(items, type, mode) {
    var grouped = {};
    var m = (mode === 'category') ? 'category' : 'room';
    function add(key, row) {
      var k = String(key || '').trim() || 'General';
      if (type === 'invoice') {
        var lk = k.toLowerCase();
        if (lk === 'time billing' || lk === 'time-billing' || lk === 'timebilling') k = 'CCH Design';
      }
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(row);
    }
    (items || []).forEach(function(it, idx) {
      if (typeof isProposalGroupHeaderItem === 'function' && isProposalGroupHeaderItem(it)) return;
      var row = Object.assign({}, it);
      if (row._idx == null) row._idx = idx;
      var et = String(row.expenseType || '').toLowerCase();
      if (type === 'invoice' && (et === 'discount' || et === 'retainer_credit')) return;
      if (type === 'invoice' && (et === 'shipping' || et === 'sales_tax' || et === 'handling')) {
        if (et === 'sales_tax' && typeof window.cchIsClientSalesTaxLine === 'function' && window.cchIsClientSalesTaxLine(row)) return;
        add('Shipping & adjustments', row);
        return;
      }
      var room = String(row.room || '').trim();
      var category = String(row.category || '').trim();
      var key = (m === 'category') ? (category || room || 'General') : (room || category || 'General');
      add(key, row);
    });
    return grouped;
  };

  /** Room/category group keys in document line order (not A–Z). Matches proposal/PDF sequence. */
  window.cchOrderedDocumentGroupKeys = function(grouped, items, type, mode) {
    if (!grouped) return [];
    var keys = Object.keys(grouped);
    if (!items || !items.length) return keys.sort();
    var m = (mode === 'category') ? 'category' : 'room';
    var seen = {};
    var order = [];
    function pushKey(key) {
      var k = String(key || '').trim() || 'General';
      if (type === 'invoice') {
        var lk = k.toLowerCase();
        if (lk === 'time billing' || lk === 'time-billing' || lk === 'timebilling') k = 'CCH Design';
      }
      if (!grouped[k] || seen[k]) return;
      seen[k] = true;
      order.push(k);
    }
    (items || []).forEach(function(it) {
      if (typeof isProposalGroupHeaderItem === 'function' && isProposalGroupHeaderItem(it)) return;
      var et = String(it.expenseType || '').toLowerCase();
      if (type === 'invoice' && (et === 'discount' || et === 'retainer_credit')) return;
      if (type === 'invoice' && (et === 'shipping' || et === 'sales_tax' || et === 'handling')) {
        if (et === 'sales_tax' && typeof window.cchIsClientSalesTaxLine === 'function' && window.cchIsClientSalesTaxLine(it)) return;
        pushKey('Shipping & adjustments');
        return;
      }
      var room = String(it.room || '').trim();
      var category = String(it.category || '').trim();
      var key = (m === 'category') ? (category || room || 'General') : (room || category || 'General');
      pushKey(key);
    });
    keys.forEach(function(k) { if (!seen[k]) order.push(k); });
    return order;
  };

  /**
   * T&E presentation badge — billingCategory / type only (FABLE_DECISION_ds-invoice-expenses).
   * Never title/description regex.
   */
  window.cchInvoiceLineIsTeTravelPresentation = function(it) {
    if (!it) return false;
    var bc = (typeof window.cchNormBillingCategory === 'function')
      ? window.cchNormBillingCategory(it.billingCategory)
      : String(it.billingCategory || '').toLowerCase().replace(/\s+/g, ' ').trim();
    return bc === 't&e' || bc === 'travel & entertainment' || bc === 'travel and entertainment';
  };

  /** Invoice read-only view: service-style when SHARED kind says service — never title guess. */
  window.cchInvoiceLineUseServiceStyleInView = function(it) {
    if (!it) return false;
    if (typeof window.cchInvoiceLineKind === 'function') {
      return window.cchInvoiceLineKind(it) === 'service';
    }
    var et = String(it.expenseType || '').toLowerCase();
    var itype = String(it.itemType || '').toLowerCase();
    return et === 'service' || itype === 'service';
  };

  window.setDocGroupView = async function(type, projectId, docId, mode) {
    var m = String(mode || '').toLowerCase();
    if (m !== 'room' && m !== 'category') return;
    var collection = type === 'invoice' ? 'invoices' : type === 'proposal' ? 'proposals' : 'purchaseOrders';
    try {
      if (type === 'invoice' && typeof window.cchInvoiceLineLayoutSet === 'function') {
        window.cchInvoiceLineLayoutSet(projectId, docId, 'grouped');
      }
      if (type === 'proposal' && typeof window.cchProposalLineLayoutSet === 'function') {
        window.cchProposalLineLayoutSet(projectId, docId, 'grouped');
      }
      await db.collection('boards').doc(projectId).collection(collection).doc(docId).update({
        groupByView: m,
        updatedAt: new Date().toISOString()
      });
      if (typeof showToast === 'function') showToast('Grouped by ' + (m === 'room' ? 'room' : 'category'));
      if (typeof navigate === 'function') navigate(window.location.hash);
    } catch (e) {
      if (typeof showToast === 'function') showToast('Could not update grouping: ' + (e.message || e), 'error');
    }
  };

  /** Session-only invoice line layout: grouped (default, PDF order) vs flat list. */
  window.cchInvoiceLineLayoutKey = function(projectId, docId) {
    return String(projectId || '') + '|' + String(docId || '');
  };
  window.cchInvoiceLineLayoutGet = function(projectId, docId) {
    window._cchInvoiceLineLayout = window._cchInvoiceLineLayout || {};
    return window._cchInvoiceLineLayout[window.cchInvoiceLineLayoutKey(projectId, docId)] === 'flat' ? 'flat' : 'grouped';
  };
  window.cchInvoiceLineLayoutSet = function(projectId, docId, mode) {
    window._cchInvoiceLineLayout = window._cchInvoiceLineLayout || {};
    window._cchInvoiceLineLayout[window.cchInvoiceLineLayoutKey(projectId, docId)] =
      String(mode || '').toLowerCase() === 'flat' ? 'flat' : 'grouped';
  };
  window.toggleInvoiceLineLayout = function(projectId, docId) {
    var next = window.cchInvoiceLineLayoutGet(projectId, docId) === 'flat' ? 'grouped' : 'flat';
    window.cchInvoiceLineLayoutSet(projectId, docId, next);
    if (typeof showToast === 'function') {
      showToast(next === 'flat' ? 'Flat list' : 'Grouped by room');
    }
    if (typeof navigate === 'function') navigate(window.location.hash);
    else if (typeof renderInvoiceDetail === 'function') renderInvoiceDetail(projectId, docId);
  };

  /** Session-only proposal line layout on landing view: grouped (print order) vs flat document order. */
  window.cchProposalLineLayoutKey = function(projectId, docId) {
    return String(projectId || '') + '|' + String(docId || '');
  };
  window.cchProposalLineLayoutGet = function(projectId, docId) {
    window._cchProposalLineLayout = window._cchProposalLineLayout || {};
    return window._cchProposalLineLayout[window.cchProposalLineLayoutKey(projectId, docId)] === 'flat' ? 'flat' : 'grouped';
  };
  window.cchProposalLineLayoutSet = function(projectId, docId, mode) {
    window._cchProposalLineLayout = window._cchProposalLineLayout || {};
    window._cchProposalLineLayout[window.cchProposalLineLayoutKey(projectId, docId)] =
      String(mode || '').toLowerCase() === 'flat' ? 'flat' : 'grouped';
  };
  window.toggleProposalLineLayout = function(projectId, docId) {
    var next = window.cchProposalLineLayoutGet(projectId, docId) === 'flat' ? 'grouped' : 'flat';
    window.cchProposalLineLayoutSet(projectId, docId, next);
    if (typeof showToast === 'function') {
      showToast(next === 'flat' ? 'Flat list' : 'Grouped view (matches print)');
    }
    if (typeof renderProposalDetail === 'function') renderProposalDetail(projectId, docId);
    else if (typeof navigate === 'function') navigate(window.location.hash);
  };

  /** Hand-curated invoice: skip duplicate-doc swap + clip re-sync on open. */
  window.cchLockInvoiceNoAutoGroup = async function(projectId, docId, unlock) {
    if (!projectId || !docId) return;
    try {
      var patch = {
        _noAutoGroup: unlock ? false : true,
        _lastManualEdit: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await db.collection('boards').doc(projectId).collection('invoices').doc(docId).update(patch);
      if (typeof showToast === 'function') {
        showToast(unlock ? 'Auto-sync on open re-enabled' : 'Invoice locked — line order and images won’t be auto-changed on open');
      }
      if (typeof navigate === 'function') navigate(window.location.hash);
    } catch (e) {
      if (typeof showToast === 'function') showToast('Could not update invoice: ' + (e.message || e), 'error');
    }
  };


  // ============================================================
  // 10. Fix: Vendor dropdown populated from project clips/team
  // Visible autocomplete on Edit Line Item (piVendor)
  // ============================================================
  window._cachedVendorsByProject = window._cachedVendorsByProject || {};

  window.loadProjectVendors = async function(projectId) {
    var pid = String(projectId || '').trim();
    if (!pid) return [];
    if (!window._cachedVendorsByProject) window._cachedVendorsByProject = Object.create(null);
    if (window._cachedVendorsByProject[pid]) return window._cachedVendorsByProject[pid];
    var vendors = new Set();
    function addVendor(v) {
      v = String(v || '').trim();
      if (v) vendors.add(v);
    }
    try {
      if (typeof window.cchEnsureVendorsCache === 'function') await window.cchEnsureVendorsCache(false);
    } catch (_eEns) {}
    (window.vendorsCache || []).forEach(function(v) { if (v && v.name) addVendor(v.name); });
    try {
      var clipSnap = await db.collection('boards').doc(pid).collection('clips').get();
      clipSnap.forEach(function(d) {
        var cd = d.data() || {};
        addVendor(cd.vendor);
      });
    } catch (e) { console.warn('[vendors] clips', e); }
    try {
      var vendSnap = await db.collection('vendors').limit(3000).get();
      vendSnap.forEach(function(d) {
        var vd = d.data() || {};
        addVendor(vd.name || vd.company || vd.vendor);
      });
    } catch (e) { console.warn('[vendors] vendors collection', e); }
    try {
      var pSnap = await db.collection('products').limit(3000).get();
      pSnap.forEach(function(d) {
        var pd = d.data() || {};
        addVendor(pd.vendor || pd.manufacturer);
      });
    } catch (e) { console.warn('[vendors] products', e); }
    try {
      var teamSnap = await db.collection('team').get();
      teamSnap.forEach(function(d) {
        var t = d.data() || {};
        if (t.role === 'vendor') addVendor(t.name || t.company);
      });
    } catch (e) { console.warn('[vendors] team', e); }
    try {
      var docCols = ['proposals', 'invoices', 'purchaseOrders'];
      for (var ci = 0; ci < docCols.length; ci++) {
        var snap = await db.collection('boards').doc(pid).collection(docCols[ci]).limit(120).get();
        snap.forEach(function(d) {
          var data = d.data() || {};
          addVendor(data.vendor);
          (data.items || []).forEach(function(it) { addVendor(it && it.vendor); });
        });
      }
    } catch (e) { console.warn('[vendors] project docs', e); }
    var list = Array.from(vendors).sort(function(a, b) {
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
    window._cachedVendorsByProject[pid] = list;
    return list;
  };

  window.buildVendorDatalist = function(vendors) {
    var dlId = 'vendorDatalist';
    var existing = document.getElementById(dlId);
    if (existing) existing.remove();
    var dl = document.createElement('datalist');
    dl.id = dlId;
    (vendors || []).forEach(function(v) {
      var opt = document.createElement('option');
      opt.value = v;
      dl.appendChild(opt);
    });
    document.body.appendChild(dl);
    return dlId;
  };

  window.docEditMergeVendorsFromItems = function(baseVendors, items) {
    var list = (baseVendors || []).slice();
    function has(v) {
      var k = String(v || '').trim().toLowerCase();
      if (!k) return true;
      return list.some(function(x) { return String(x).trim().toLowerCase() === k; });
    }
    (items || []).forEach(function(it) {
      var v = String(it && it.vendor || '').trim();
      if (v && !has(v)) list.push(v);
    });
    return list.sort(function(a, b) {
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
  };

  window.docEditBuildVendorOptions = function(vendors, selected) {
    var sel = String(selected || '').trim();
    var list = window.docEditMergeVendorsFromItems(vendors, sel ? [{ vendor: sel }] : []);
    var html = '<option value="">— Vendor —</option>';
    list.forEach(function(v) {
      html += '<option value="' + escAttr(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(v) + '</option>';
    });
    html += '<option value="__other__">Other / type custom…</option>';
    return html;
  };

  window.piReadVendorValue = function() {
    var sel = document.getElementById('piVendorSel');
    var custom = document.getElementById('piVendorCustom');
    if (sel) {
      if (sel.value === '__other__') return custom ? custom.value.trim() : '';
      return String(sel.value || '').trim();
    }
    var leg = document.getElementById('piVendor');
    return leg ? leg.value.trim() : '';
  };

  window.piVendorSelectChange = function() {
    var sel = document.getElementById('piVendorSel');
    var custom = document.getElementById('piVendorCustom');
    if (!sel) return;
    if (sel.value === '__other__') {
      if (custom) { custom.style.display = ''; custom.focus(); }
    } else if (custom) {
      custom.style.display = 'none';
    }
  };

  window.mountPiVendorSelect = async function(projectId, selectedVendor) {
    var selEl = document.getElementById('piVendorSel');
    if (!selEl) return;
    var vendors = [];
    try {
      vendors = await window.loadProjectVendors(projectId);
    } catch (e) {
      console.warn('[mountPiVendorSelect]', e);
    }
    selEl.innerHTML = window.docEditBuildVendorOptions(vendors, selectedVendor || '');
    window.piVendorSelectChange();
    var customEl = document.getElementById('piVendorCustom');
    var sv = String(selectedVendor || '').trim();
    if (selEl.value === '__other__' && customEl && sv) customEl.value = sv;
  };

  window.docEditVendorSelectChange = function(el) {
    var idx = parseInt(el.dataset.idx, 10);
    if (!window._docEdit || !window._docEdit.items[idx]) return;
    var customEl = document.getElementById('docEditVendorCustom' + idx);
    if (el.value === '__other__') {
      if (customEl) {
        customEl.style.display = 'block';
        customEl.focus();
      }
      return;
    }
    if (customEl) customEl.style.display = 'none';
    var vendorVal = String(el.value || '').trim();
    if (typeof window.docEditPersistLineField === 'function') {
      window.docEditPersistLineField(idx, 'vendor', vendorVal, 'Vendor saved for this line');
    } else {
      window._docEdit.items[idx].vendor = vendorVal;
      if (typeof window.docEditAutoSave === 'function') window.docEditAutoSave();
    }
  };

  window.docEditVendorCustomChange = function(el) {
    var idx = parseInt(el.dataset.idx, 10);
    if (!window._docEdit || !window._docEdit.items[idx]) return;
    var vendorVal = String(el.value || '').trim();
    if (typeof window.docEditPersistLineField === 'function') {
      window.docEditPersistLineField(idx, 'vendor', vendorVal, 'Vendor saved for this line');
    } else {
      window._docEdit.items[idx].vendor = vendorVal;
      if (typeof window.docEditAutoSave === 'function') window.docEditAutoSave();
    }
  };

  /** Visible vendor dropdown on Edit Line Item (#piVendorSel). */
  window.attachPiVendorAutocomplete = async function(projectId) {
    var legacy = document.getElementById('piVendor');
    var selected = legacy ? legacy.value : '';
    if (legacy && legacy.parentElement) {
      var wrap = legacy.parentElement;
      wrap.innerHTML = '<select class="form-input" id="piVendorSel" onchange="piVendorSelectChange()"><option value="">Loading vendors…</option></select>' +
        '<input class="form-input" id="piVendorCustom" placeholder="Type vendor name" style="display:none;margin-top:6px;" onchange="piVendorSelectChange()">';
    }
    await window.mountPiVendorSelect(projectId, selected);
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

    // Wait for page to render, then inject connected-docs dropdown + linked badges
    setTimeout(function() {
      try {
        var headerH1 = document.querySelector('#contentArea h1');
        if (!headerH1) return;
        var docData = window._docEdit && window._docEdit.docData;
        if (!docData) return;
        var projectId = poMatch ? poMatch[1] : invMatch2 ? invMatch2[1] : proMatch[1];
        var docId = poMatch ? poMatch[2] : invMatch2 ? invMatch2[2] : proMatch[2];
        var docType = poMatch ? 'po' : invMatch2 ? 'invoice' : 'proposal';
        var docNum = docData.invoiceNum || docData.number || docData.proposalNum || docData.name || docId.slice(0, 8);
        var titleRow = headerH1.parentElement;
        if (titleRow && !titleRow.querySelector('.cch-conn-docs-btn') && typeof window.cchConnectedDocsTitleBtn === 'function') {
          titleRow.insertAdjacentHTML('beforeend', window.cchConnectedDocsTitleBtn(projectId, docType, docId, docNum));
        }
        var badgeHost = titleRow && titleRow.parentElement ? titleRow.parentElement : headerH1.parentElement;
        if (badgeHost && !badgeHost.querySelector('.linked-doc-badges-area') && !badgeHost.querySelector('.linked-doc-badge')) {
          var badgesHTML = renderLinkedDocBadges(projectId, docData, docType);
          if (badgesHTML) {
            var badgesDiv = document.createElement('div');
            badgesDiv.className = 'linked-doc-badges-area';
            badgesDiv.innerHTML = badgesHTML;
            badgeHost.appendChild(badgesDiv);
          }
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
  // 16–17. editProposalItem / addProposalLineItem — vendor picker after modal
  // editDocLineItem is async; fixed timing via retry until #piVendor exists
  // ============================================================
  function _schedulePiVendorPicker(projectId) {
    var pid = String(projectId || '').trim();
    var tries = 0;
    function attempt() {
      tries++;
      var el = document.getElementById('piVendor');
      if (el && typeof window.attachPiVendorAutocomplete === 'function') {
        void window.attachPiVendorAutocomplete(pid);
        return;
      }
      if (tries < 40) setTimeout(attempt, 100);
    }
    setTimeout(attempt, 0);
  }

  var _origEditProposalItem = window.editProposalItem;
  if (_origEditProposalItem) {
    window.editProposalItem = function(projectId, proposalId, idx) {
      _origEditProposalItem.call(this, projectId, proposalId, idx);
      _schedulePiVendorPicker(projectId);
    };
  }

  var _origAddProposalLineItem = window.addProposalLineItem;
  if (_origAddProposalLineItem) {
    window.addProposalLineItem = function(projectId, proposalId) {
      _origAddProposalLineItem.call(this, projectId, proposalId);
      _schedulePiVendorPicker(projectId);
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
      var roomListQe = [];
      if (typeof _fetchProjectBoardRoomList === 'function') {
        try { roomListQe = await _fetchProjectBoardRoomList(projectId); } catch (eRq) { roomListQe = []; }
      }
      var roomsForCats = roomListQe.length ? roomListQe : (boardSnap.exists ? (boardSnap.data().rooms || []) : []);
      var catOpts = typeof _piCategoryOptions === 'function'
        ? _piCategoryOptions(item.category || '', boardCats, roomsForCats)
        : '<option value="">(category)</option>';
      var roomOptsHtml = typeof _piRoomOptions === 'function'
        ? _piRoomOptions(item.room || '', roomListQe)
        : '<option value="">(room)</option>';

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
              '<select class="form-input" id="qeRoom" style="font-size:13px;">' + roomOptsHtml + '</select></div>' +
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
      if (typeof cchAlert === 'function') await cchAlert('Error saving: ' + e.message, 'Quick Edit');
    }
  };


  // Tear sheets: full multi-image implementation lives in index.html (generateTearSheetsFromDoc → _generateTearSheetsFromDocRun).
  // Do not define a fallback here — a legacy stub used only item.imageUrl and hid gallery images.


  // ============================================================
  // 21. Send to Client — marks as Sent, records sentDate, shows toast
  // ============================================================
  window.sendInvoiceToClient = async function(projectId, invoiceId) {
    try {
      if (typeof _sendDocToClient === 'function') {
        await _sendDocToClient(projectId, 'invoices', invoiceId, 'Invoice');
        return;
      }
      var doc = await db.collection('boards').doc(projectId).collection('invoices').doc(invoiceId).get();
      if (!doc.exists) {
        if (typeof cchAlert === 'function') await cchAlert('Invoice not found', 'Send to Client');
        return;
      }
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

      if (typeof cchConfirm !== 'function') return;
      if (!(await cchConfirm(msg, 'Send to Client', { confirmText: 'Send' }))) return;

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

      if (await cchConfirm('Open invoice preview to print or email as PDF?', 'Send to Client', { confirmText: 'Open preview' })) {
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
      if (typeof cchAlert === 'function') await cchAlert('Error: ' + e.message, 'Send to Client');
    }
  };


  // ============================================================
  // 21b. Send Proposal to Client
  // ============================================================
  window.sendProposalToClient = async function(projectId, proposalId) {
    try {
      if (typeof _sendDocToClient === 'function') {
        await _sendDocToClient(projectId, 'proposals', proposalId, 'Proposal');
        return;
      }
      var doc = await db.collection('boards').doc(projectId).collection('proposals').doc(proposalId).get();
      if (!doc.exists) {
        if (typeof cchAlert === 'function') await cchAlert('Proposal not found', 'Send to Client');
        return;
      }
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
      msg += '\n\nThis will:\n• Mark status as Published\n• Publish to the client portal\n• Record the sent date';

      if (typeof cchConfirm !== 'function') return;
      if (!(await cchConfirm(msg, 'Send to Client', { confirmText: 'Continue' }))) return;

      var _now = new Date().toISOString();
      await db.collection('boards').doc(projectId).collection('proposals').doc(proposalId).update({
        status: 'Published',
        published: true,
        publishedAt: _now,
        sentDate: _now.split('T')[0],
        sentAt: _now,
        sentTo: clientEmail || clientName || 'client',
        updatedAt: _now
      });

      if (typeof logDocActivity === 'function') logDocActivity(projectId, 'proposals', proposalId, 'sent', 'Sent to ' + (clientEmail || clientName || 'client'));

      if (clientEmail) { try { await navigator.clipboard.writeText(clientEmail); } catch(e) {} }
      showToast('Proposal ' + propNum + ' published to client portal', 3000);

      if (await cchConfirm('Open proposal preview to print or email as PDF?', 'Send to Client', { confirmText: 'Open preview' })) { previewDocument('proposal', projectId, proposalId); }

      if (typeof _cacheTime !== 'undefined') _cacheTime = 0;
      if (typeof invalidateSearchCache === 'function') invalidateSearchCache();
      if (typeof renderProjectDetail === 'function') renderProjectDetail();
    } catch(e) {
      console.error('Send proposal error:', e);
      if (typeof cchAlert === 'function') await cchAlert('Error: ' + e.message, 'Send to Client');
    }
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
      if (typeof cchAlert === 'function') await cchAlert('Error: ' + e.message, 'Invoice');
    }
  };


  // ============================================================
  // 23. Duplicate Invoice
  // ============================================================
  window.duplicateInvoice = async function(projectId, invoiceId) {
    try {
      var doc = await db.collection('boards').doc(projectId).collection('invoices').doc(invoiceId).get();
      if (!doc.exists) {
        if (typeof cchAlert === 'function') await cchAlert('Invoice not found', 'Duplicate Invoice');
        return;
      }
      var inv = doc.data();

      if (typeof cchConfirm !== 'function') return;
      if (!(await cchConfirm('Duplicate this invoice? A new draft invoice will be created with the same items.', 'Duplicate Invoice', { confirmText: 'Duplicate' }))) return;

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
      if (typeof cchAlert === 'function') await cchAlert('Error: ' + e.message, 'Duplicate Invoice');
    }
  };


  // ============================================================
  // 24. Archive Invoice
  // ============================================================
  window.archiveInvoice = async function(projectId, invoiceId) {
    if (typeof cchConfirm !== 'function') return;
    if (!(await cchConfirm('Archive this invoice? It will be hidden from the active list.', 'Archive Invoice', { confirmText: 'Archive', danger: true }))) return;
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
      if (typeof cchAlert === 'function') await cchAlert('Error: ' + e.message, 'Archive Invoice');
    }
  };


  // ============================================================
  // 25. Publish = client dashboard visibility only (do NOT set Sent)
  // Sent is reserved for Email / Send to Client.
  // ============================================================
  var _origTogglePublished = window.togglePublished;
  /** Client-facing invoice/proposal PDF header — firm address only (no personal name). */
  function cchPremiumDocCompanyInfoHtml() {
    return '2481 N. Riverside Dr. · Santa Ana, CA 92706<br>(949) 497-7979 · cindy@cchdesign.com<br>www.cchdesign.com';
  }

  /** Preview badge: published invoices should not show Draft when visible on the client portal. */
  function cchInvoiceClientDisplayStatus(docData) {
    var st = String((docData && docData.status) || '').trim() || 'Draft';
    if (docData && docData.published) {
      var sl = st.toLowerCase();
      if (!sl || sl === 'draft' || sl === 'unsent') return 'Published';
    }
    return st;
  }

  window.togglePublished = async function(projectId, docId, newValue, collection) {
    var col = collection || 'proposals';
    if (col === 'invoices') {
      try {
        if (newValue === true) {
          var snap = await db.collection('boards').doc(projectId).collection(col).doc(docId).get();
          var cur = snap.exists ? (snap.data() || {}) : {};
          var patch = { published: true, publishedAt: new Date().toISOString() };
          var st = String(cur.status || '').trim();
          var stL = st.toLowerCase();
          /* Publish ≠ email. Only bump Draft/Unsent → Published. Never force Sent. */
          if (!st || stL === 'draft' || stL === 'unsent') patch.status = 'Published';
          await db.collection('boards').doc(projectId).collection(col).doc(docId).set(patch, { merge: true });
        }
      } catch(e) { console.warn('invoice publish patch failed:', e); }
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
  // 27. Invoice view topbar — use cchBuildDocViewTopbar (renderDocViewPage).
  // Removed legacy MutationObserver that injected Send/Publish/Duplicate via
  // insertBefore on docEditSave — caused NotFoundError spam on edit + list pages.
  // ============================================================


  // ============================================================
  // 28. MY ITEMS PANEL — Auto-open on doc edit, Houzz-style persistent sidebar
  // ============================================================

  // ============================================================
  // Doc view top bar — invoice / PO / proposal (full production menu)
  // ============================================================
  function cchCloseDocMoreDd() {
    document.querySelectorAll('.cch-doc-more-dd').forEach(function(d) {
      d.style.display = 'none';
      d.style.top = '';
      d.style.right = '';
      d.style.left = '';
      d.style.position = '';
      d.style.zIndex = '';
      if (d._cchDdPlaceholder && d._cchDdPlaceholder.parentNode && d.parentNode === document.body) {
        d._cchDdPlaceholder.parentNode.insertBefore(d, d._cchDdPlaceholder);
      }
    });
  }
  window.cchCloseDocMoreDd = cchCloseDocMoreDd;

  window.cchToggleDocMoreDd = function(btn) {
    try { if (typeof event !== 'undefined' && event && event.stopPropagation) event.stopPropagation(); } catch (_e) {}
    if (!btn) return;
    var wrap = btn.closest('.cch-doc-more-wrap');
    if (!wrap) return;
    var dropdown = wrap.querySelector('.cch-doc-more-dd') || wrap._cchCachedDd;
    if (!dropdown) return;
    wrap._cchCachedDd = dropdown;
    var wasOpen = dropdown.style.display === 'block';
    cchCloseDocMoreDd();
    if (wasOpen) return;
    if (!dropdown._cchDdPlaceholder) {
      dropdown._cchDdPlaceholder = document.createComment('cch-doc-more-dd');
      dropdown.parentNode.insertBefore(dropdown._cchDdPlaceholder, dropdown);
    }
    document.body.appendChild(dropdown);
    dropdown.style.display = 'block';
    dropdown.style.position = 'fixed';
    var rect = btn.getBoundingClientRect();
    var menuH = dropdown.offsetHeight || 320;
    var spaceBelow = window.innerHeight - rect.bottom;
    if (spaceBelow < menuH && rect.top > menuH) {
      dropdown.style.top = Math.max(8, rect.top - menuH) + 'px';
    } else {
      dropdown.style.top = (rect.bottom + 6) + 'px';
    }
    dropdown.style.right = Math.max(8, window.innerWidth - rect.right) + 'px';
    dropdown.style.left = 'auto';
    dropdown.style.zIndex = '100050';
  };

  if (!window._cchDocMoreDdOutside) {
    window._cchDocMoreDdOutside = true;
    document.addEventListener('click', function(e) {
      if (e.target && e.target.closest && (e.target.closest('.cch-doc-more-wrap') || e.target.closest('.cch-doc-more-dd'))) return;
      cchCloseDocMoreDd();
    });
  }

  function cchDocMoreItem(label, js, danger) {
    var col = danger ? '#B91C1C' : '#1B3352';
    var dis = !js ? ' disabled style="opacity:0.55;cursor:default;"' : (' onclick="cchCloseDocMoreDd();' + js + '"');
    return '<button type="button" style="display:block;width:100%;text-align:left;padding:8px 14px;border:none;background:none;cursor:pointer;font-size:12px;color:' + col + ';font-family:var(--font-body);"' + dis + '>' + label + '</button>';
  }

  function cchDocMoreDivider() {
    return '<div style="height:1px;background:rgba(27,51,82,0.08);margin:4px 8px;"></div>';
  }

  function cchDocMoreMenuWrap(innerHtml) {
    return '<div class="cch-doc-more-wrap" style="position:relative;display:inline-block;margin-left:2px;vertical-align:middle;">' +
      '<button type="button" class="btn btn-secondary btn-sm" style="font-weight:600;" onclick="event.stopPropagation();cchToggleDocMoreDd(this)">More ▾</button>' +
      '<div class="cch-doc-more-dd" onclick="event.stopPropagation()" style="display:none;min-width:248px;max-height:min(70vh,520px);overflow-y:auto;background:#fff;border:1px solid rgba(27,51,82,0.12);border-radius:8px;box-shadow:0 12px 32px rgba(27,51,82,0.14);padding:4px 0;">' +
      innerHtml + '</div></div>';
  }

  window.cchBuildDocViewTopbar = function(opts) {
    opts = opts || {};
    var type = opts.type || 'invoice';
    var projectId = opts.projectId;
    var docId = opts.docId;
    var collection = opts.collection || (type === 'invoice' ? 'invoices' : type === 'po' ? 'purchaseOrders' : 'proposals');
    var backTab = opts.backTab || (type === 'invoice' ? 'invoices' : type === 'po' ? 'pos' : 'proposals');
    var projName = opts.projName || '';
    var docData = opts.docData || {};
    var typeLabel = type === 'invoice' ? 'Invoice' : type === 'po' ? 'PO' : 'Proposal';
    var pj = cchEscJsStr(projectId);
    var dj = cchEscJsStr(docId);
    var tearJs = "typeof generateTearSheetsFromDoc==='function'&&generateTearSheetsFromDoc('" + pj + "','" + collection + "','" + dj + "','" + cchEscJsStr(projName) + "')";
    var previewJs = "previewDocument('" + type + "','" + pj + "','" + dj + "')";
    var _dsItemsTop = Array.isArray(docData.items) ? docData.items : [];
    var _isDsInvTop = (type === 'invoice' && typeof window.cchInvoiceUsesDesignServicesLayout === 'function' &&
      window.cchInvoiceUsesDesignServicesLayout(docData, _dsItemsTop));
    var printJs = _isDsInvTop
      ? "void cchPrintCurrentInvoice('" + pj + "','" + dj + "')"
      : previewJs;

    var html = '<button class="btn btn-secondary btn-sm" onclick="navigate(\'#/project/' + pj + '/' + backTab + '\')">\u2190 Back</button>';

    if (type === 'invoice') {
      var invVoidEarly = !!opts.invVoidEarly;
      var qbRealId = opts.qbRealId;
      var canPushQB = !!opts.canPushQB;
      html += '<button class="btn btn-secondary btn-sm" onclick="' + previewJs + '" title="' + (_isDsInvTop ? 'Print or save as PDF — same layout as Client View' : 'Preview — print or save as PDF') + '">' + (_isDsInvTop ? '🖨 Print / PDF' : '\uD83D\uDC41 Preview') + '</button>';
      html += '<button class="btn btn-secondary btn-sm" onclick="sendInvoiceToClient(\'' + pj + '\',\'' + dj + '\')" title="Email / mark Sent — not the same as Publish">\uD83D\uDCE7 Send</button>';
      var _pubTopLabel = docData.published ? '🔒 Unpublish' : '🌐 Publish';
      var _pubTopTitle = docData.published
        ? 'Hide from client dashboard (does not un-send email)'
        : 'Show on client dashboard (status → Published; does not email)';
      html += '<button type="button" class="btn btn-secondary btn-sm" style="font-weight:700;" title="' + _pubTopTitle + '" onclick="togglePublished(\'' + pj + '\',\'' + dj + '\',' + (!docData.published ? 'true' : 'false') + ',\'invoices\')">' + _pubTopLabel + '</button>';
      var _isTimeDraft = (docData.source === 'time-tracker' || (Array.isArray(docData.timeEntryIds) && docData.timeEntryIds.length > 0));
      var _stLow = String(docData.status || 'draft').toLowerCase();
      if (_isTimeDraft && (_stLow === 'draft' || _stLow === 'unsent' || !docData.status)) {
        html += '<button type="button" class="btn btn-secondary btn-sm" style="color:#B91C1C;border-color:rgba(185,28,28,0.4);font-weight:600;" onclick="discardTimeTrackerInvoiceDraft(\'' + pj + '\',\'' + dj + '\')" title="Delete this draft and release linked time entries back to Time Ledger">Discard draft</button>';
      }
      html += '<button class="btn btn-primary btn-sm" onclick="cchEnterDocEditMode(\'' + pj + '\',\'' + dj + '\',\'invoice\')" style="background:#1B3352;color:#EDE8E0;">\u270F\uFE0F Edit line items</button>';

      var more = '';
      var pubLabel = docData.published ? '🔒 Unpublish from dashboard' : '🌐 Publish to client dashboard';
      more += cchDocMoreItem(pubLabel, "togglePublished('" + pj + "','" + dj + "'," + (!docData.published ? 'true' : 'false') + ",'invoices')");
      more += cchDocMoreItem('\uD83D\uDCE7 Send / email client', "sendInvoiceToClient('" + pj + "','" + dj + "')");
      more += cchDocMoreDivider();
      more += cchDocMoreItem('📑 Tear sheets', tearJs);
      more += cchDocMoreItem('🖨 Print / PDF', printJs);
      more += cchDocMoreDivider();
      more += cchDocMoreItem('🕐 Timeline', "toggleDocTimeline('" + pj + "','" + collection + "','" + dj + "')");
      more += cchDocMoreItem('\uD83D\uDCB3 Record payment', "quickRecordPayment('" + pj + "','" + collection + "','" + dj + "')");
      more += cchDocMoreItem('📋 Duplicate invoice', "duplicateInvoice('" + pj + "','" + dj + "')");
      more += cchDocMoreDivider();
      more += cchDocMoreItem('Group by room', "setDocGroupView('invoice','" + pj + "','" + dj + "','room')");
      more += cchDocMoreItem('Group by category', "setDocGroupView('invoice','" + pj + "','" + dj + "','category')");
      more += docData._noAutoGroup
        ? cchDocMoreItem('Unlock auto-sync on open', "cchLockInvoiceNoAutoGroup('" + pj + "','" + dj + "',true)")
        : cchDocMoreItem('Lock line order (no auto-sync)', "cchLockInvoiceNoAutoGroup('" + pj + "','" + dj + "')");
      more += cchDocMoreItem('📦 Generate POs by vendor', "generatePOsFromDoc('" + pj + "','invoices','" + dj + "')");
      more += cchDocMoreDivider();
      if (!invVoidEarly) {
        if (qbRealId) {
          more += cchDocMoreItem('✅ QB synced (' + esc(String(qbRealId)) + ')', '');
        } else if (docData.qbPushPending) {
          more += cchDocMoreItem('⏳ QB queued', '');
        } else if (canPushQB) {
          more += cchDocMoreItem('📤 Push to QuickBooks', "pushDocToQB('invoice','" + pj + "','" + dj + "',this)");
        }
        if (canPushQB && typeof syncInvoiceBalanceFromQB === 'function' &&
            typeof window.invoiceCanRefreshFromQb === 'function' && window.invoiceCanRefreshFromQb(docData)) {
          more += cchDocMoreItem('↻ Refresh paid from QuickBooks', "syncInvoiceBalanceFromQB('" + pj + "','" + dj + "')");
        }
      }
      more += cchDocMoreDivider();
      if (typeof markInvoicePaid === 'function') {
        more += cchDocMoreItem('✅ Mark as paid', "markInvoicePaid('" + pj + "','" + dj + "')");
      }
      if (typeof markInvoicePastDue === 'function') {
        more += cchDocMoreItem('⚠️ Mark past due', "markInvoicePastDue('" + pj + "','" + dj + "')");
      }
      if (String(docData.status || '').toLowerCase() !== 'void' && typeof voidInvoice === 'function') {
        more += cchDocMoreItem('🚫 Void (keep costs)', "voidInvoice('" + pj + "','" + dj + "')");
      }
      if (typeof linkDocModal === 'function') {
        more += cchDocMoreItem('📂 Attach from Files', "linkDocModal('" + pj + "','invoices','" + dj + "')");
      }
      more += cchDocMoreDivider();
      if (typeof archiveInvoice === 'function') {
        more += cchDocMoreItem('📥 Archive', "archiveInvoice('" + pj + "','" + dj + "')");
      }
      more += cchDocMoreItem('🗑️ Delete', "deleteInvoice('" + pj + "','" + dj + "')", true);
      html += cchDocMoreMenuWrap(more);
    } else if (type === 'po') {
      html += '<button class="btn btn-secondary btn-sm" onclick="' + previewJs + '">🖨 Print / PDF</button>';
      html += '<button class="btn btn-primary btn-sm" onclick="cchEnterDocEditMode(\'' + pj + '\',\'' + dj + '\',\'po\')" style="background:#1B3352;color:#EDE8E0;">\u270F\uFE0F Edit PO</button>';
      var poMore = '';
      poMore += cchDocMoreItem('🖨 Print / PDF', previewJs);
      poMore += cchDocMoreDivider();
      poMore += cchDocMoreItem('🕐 Timeline', "toggleDocTimeline('" + pj + "','" + collection + "','" + dj + "')");
      if (docData.bill && docData.bill.received && typeof window.cchPoOpenPaymentModal === 'function') {
        poMore += cchDocMoreItem('💳 Pay bill', "cchPoOpenPaymentModal('" + pj + "','" + dj + "')");
      }
      if (opts.qbRealId) {
        poMore += cchDocMoreItem('✅ QB synced (' + esc(String(opts.qbRealId)) + ')', '');
      } else if (docData.qbPushPending) {
        poMore += cchDocMoreItem('⏳ QB queued', '');
      } else if (opts.canPushQB && !(typeof window.cchPoQbBillOnlyMode === 'function' && window.cchPoQbBillOnlyMode())) {
        poMore += cchDocMoreItem('📤 Push to QuickBooks', "pushDocToQB('po','" + pj + "','" + dj + "',this)");
      } else if (window.cchPoQbBillOnlyMode()) {
        poMore += cchDocMoreItem('📤 QuickBooks: push vendor bill', "navigate('#/project/" + pj + "/po/" + dj + "')");
      }
      poMore += cchDocMoreDivider();
      if (typeof window.cchPoOpenStatusModal === 'function') {
        poMore += cchDocMoreItem('📋 Change fulfillment status', "cchPoOpenStatusModal('" + pj + "','" + dj + "')");
      }
      var poPub = docData.published ? '🔒 Unpublish from dashboard' : '🌐 Publish to client dashboard';
      poMore += cchDocMoreItem(poPub, "togglePublished('" + pj + "','" + dj + "'," + (!docData.published ? 'true' : 'false') + ",'purchaseOrders')");
      if (typeof linkDocModal === 'function') {
        poMore += cchDocMoreItem('📂 Attach from Files', "linkDocModal('" + pj + "','purchaseOrders','" + dj + "')");
      }
      poMore += cchDocMoreItem('🗑️ Delete', "deletePurchaseOrder('" + pj + "','" + dj + "')", true);
      html += cchDocMoreMenuWrap(poMore);
    } else if (type === 'proposal') {
      html += '<button class="btn btn-secondary btn-sm" onclick="' + previewJs + '">\uD83D\uDC41 Preview</button>';
      html += '<button class="btn btn-secondary btn-sm" onclick="sendProposalToClient(\'' + pj + '\',\'' + dj + '\')">\uD83D\uDCE7 Send</button>';
      html += '<button class="btn btn-primary btn-sm" onclick="cchEnterDocEditMode(\'' + pj + '\',\'' + dj + '\',\'proposal\')" style="background:#1B3352;color:#EDE8E0;">\u270F\uFE0F Edit ' + typeLabel + '</button>';
      var prMore = '';
      prMore += cchDocMoreItem('📑 Tear sheets', tearJs);
      prMore += cchDocMoreItem('🖨 Print / PDF', previewJs);
      prMore += cchDocMoreDivider();
      prMore += cchDocMoreItem('🕐 Timeline', "toggleDocTimeline('" + pj + "','" + collection + "','" + dj + "')");
      prMore += cchDocMoreDivider();
      prMore += cchDocMoreItem('Group by room', "setDocGroupView('proposal','" + pj + "','" + dj + "','room')");
      prMore += cchDocMoreItem('Group by category', "setDocGroupView('proposal','" + pj + "','" + dj + "','category')");
      prMore += cchDocMoreItem('📦 Generate POs by vendor', "generatePOsFromDoc('" + pj + "','proposals','" + dj + "')");
      if (typeof convertProposalToInvoice === 'function') {
        prMore += cchDocMoreItem('🧾 Convert to invoice', "convertProposalToInvoice('" + pj + "','" + dj + "')");
      }
      if (typeof linkDocModal === 'function') {
        prMore += cchDocMoreItem('📂 Attach from Files', "linkDocModal('" + pj + "','proposals','" + dj + "')");
      }
      prMore += cchDocMoreDivider();
      var prPub = docData.published ? '🔒 Unpublish from dashboard' : '🌐 Publish to client dashboard';
      prMore += cchDocMoreItem(prPub, "togglePublished('" + pj + "','" + dj + "'," + (!docData.published ? 'true' : 'false') + ",'proposals')");
      prMore += cchDocMoreItem('🗑️ Delete', "deleteProposal('" + pj + "','" + dj + "')", true);
      html += cchDocMoreMenuWrap(prMore);
    }
    return html;
  };

  if (!window._cchDocMoreDdOutside) {
    window._cchDocMoreDdOutside = true;
    document.addEventListener('click', function() { cchCloseDocMoreDd(); });
  }

  /**
   * SINGLE SOURCE for invoice / proposal / PO **edit** top bar (renderDocEditPage).
   * Do not add scattered setTopbarActions buttons in index.html — extend this function only.
   */
  window.cchBuildDocEditTopbar = function(opts) {
    opts = opts || {};
    var type = opts.type || 'invoice';
    var projectId = opts.projectId;
    var docId = opts.docId;
    var collection = opts.collection || (type === 'invoice' ? 'invoices' : type === 'po' ? 'purchaseOrders' : 'proposals');
    var backTab = opts.backTab || (type === 'invoice' ? 'invoices' : type === 'po' ? 'pos' : 'proposals');
    var docData = opts.docData || {};
    var projName = opts.projName || '';
    var canPushQB = !!opts.canPushQB;
    var pj = cchEscJsStr(projectId);
    var dj = cchEscJsStr(docId);
    var previewJs = "previewDocument('" + type + "','" + pj + "','" + dj + "')";
    var tearJs = "typeof generateTearSheetsFromDoc==='function'&&generateTearSheetsFromDoc('" + pj + "','" + collection + "','" + dj + "','" + cchEscJsStr(projName) + "')";
    var cancelJs = 'cchClearDocEditSession();window._forceEditMode=false;navigate(window.location.hash)';
    var saveJs = 'docEditSyncLineItemsFromDom();docEditSave(true)';
    var deleteJs = type === 'invoice'
      ? "void deleteInvoice('" + pj + "','" + dj + "')"
      : type === 'po'
        ? "void deletePurchaseOrder('" + pj + "','" + dj + "')"
        : "void deleteProposal('" + pj + "','" + dj + "')";

    var more = '';
    more += cchDocMoreItem('🕐 Timeline', "toggleDocTimeline('" + pj + "','" + collection + "','" + dj + "')");
    more += cchDocMoreItem('\u2190 Back to list', "navigate('#/project/" + pj + '/' + backTab + "')");
    more += cchDocMoreDivider();
    more += cchDocMoreItem('\uD83D\uDC41 Preview', previewJs);
    more += cchDocMoreItem('➕ Add items', "openDocItemsSidebar({mode:'docEdit'})");
    if (type === 'invoice' || type === 'proposal') {
      more += cchDocMoreItem('📌 Link to Room Boards', "docEditExplicitLinkToRoomBoards()");
      more += cchDocMoreItem('Auto-link clips on save (legacy)', 'cchToggleDocSaveAutoLinkRoomBoard()');
      more += cchDocMoreItem('🖼 Refresh images', "refreshDocumentLineImagesFromClips('" + type + "','" + pj + "','" + dj + "')");
    }
    if (type === 'invoice') {
      more += cchDocMoreItem('📑 Tear sheets', tearJs);
      more += cchDocMoreItem('📦 Generate POs by vendor', "generatePOsFromDoc('" + pj + "','invoices','" + dj + "')");
      if (typeof duplicateInvoice === 'function') {
        more += cchDocMoreDivider();
        more += cchDocMoreItem('📋 Duplicate invoice', "duplicateInvoice('" + pj + "','" + dj + "')");
      }
    }
    if (type === 'proposal') {
      more += cchDocMoreItem('📑 Tear sheets', tearJs);
      more += cchDocMoreItem('📦 Generate POs by vendor', "generatePOsFromDoc('" + pj + "','proposals','" + dj + "')");
      if (typeof convertProposalToInvoice === 'function') {
        more += cchDocMoreItem('🧾 Convert to invoice', "convertProposalToInvoice('" + pj + "','" + dj + "')");
      }
    }
    if (type === 'po') {
      var qbRealIdPo = typeof getQbId === 'function' ? getQbId(docData) : '';
      if (typeof window.cchPoOpenStatusModal === 'function') {
        more += cchDocMoreItem('📋 Change fulfillment status', "cchPoOpenStatusModal('" + pj + "','" + dj + "')");
      }
      more += cchDocMoreDivider();
      if (qbRealIdPo) {
        more += cchDocMoreItem('✅ QB synced (' + esc(String(qbRealIdPo)) + ')', '');
      } else if (docData.qbPushPending) {
        more += cchDocMoreItem('⏳ QB queued', '');
      } else if (canPushQB && !(typeof window.cchPoQbBillOnlyMode === 'function' && window.cchPoQbBillOnlyMode())) {
        more += cchDocMoreItem('📤 Push to QuickBooks', "pushDocToQB('" + type + "','" + pj + "','" + dj + "')");
      }
    }
    if (typeof linkDocModal === 'function') {
      more += cchDocMoreDivider();
      more += cchDocMoreItem('📂 Attach from Files', "linkDocModal('" + pj + "','" + collection + "','" + dj + "')");
    }
    if (type === 'invoice' || type === 'po' || type === 'proposal') {
      var pubLabel = docData.published ? '🔒 Unpublish from dashboard' : '🌐 Publish to client dashboard';
      more += cchDocMoreItem(pubLabel, "togglePublished('" + pj + "','" + dj + "'," + (!docData.published ? 'true' : 'false') + ",'" + collection + "')");
    }
    if (type === 'invoice' && typeof archiveInvoice === 'function') {
      more += cchDocMoreItem('📥 Archive', "archiveInvoice('" + pj + "','" + dj + "')");
    }
    if (type !== 'invoice' && type !== 'po' && typeof toggleDocEditLayout === 'function') {
      more += cchDocMoreDivider();
      var layoutLbl = (localStorage.getItem('cch_docEditLayout') || 'studio') === 'studio' ? '⬜ Classic layout' : '⬛ Studio layout';
      more += cchDocMoreItem(layoutLbl, 'toggleDocEditLayout()');
    }

    return '<div class="cch-doc-edit-topbar">' +
      '<span id="docEditSaveInd"></span>' +
      '<button type="button" class="btn btn-primary btn-sm" onclick="openDocItemsSidebar({mode:\'docEdit\'})">+ Add item</button>' +
      '<button type="button" class="btn btn-primary btn-sm" onclick="' + saveJs + '">💾 Save</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="' + cancelJs + '">Cancel</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" style="color:#B91C1C;border-color:rgba(185,28,28,0.35);" onclick="' + deleteJs + '">🗑 Delete</button>' +
      cchDocMoreMenuWrap(more) +
      '</div>';
  };

  // ============================================================
  // Shared line-items footer — Subtotal / Shipping / Tax / Total (all docs)
  // ============================================================
  window.cchDocViewLineTotalsFooterHtml = function(opts) {
    opts = opts || {};
    var subLabel = String(opts.subLabel || 'Subtotal');
    var subtotal = parseFloat(opts.subtotal) || 0;
    var shipping = parseFloat(opts.shipping) || 0;
    var tax = parseFloat(opts.tax) || 0;
    var taxRate = parseFloat(opts.taxRate) || 0;
    var taxableSub = parseFloat(opts.taxableSubtotal) || 0;
    var prepaid = parseFloat(opts.prepaidSalesTax) || 0;
    var grand = parseFloat(opts.grandTotal);
    if (isNaN(grand)) grand = subtotal + shipping + tax + prepaid + (parseFloat(opts.creditTotal) || 0);
    var credits = opts.credits || [];
    var totalLabel = String(opts.totalLabel || 'Total');
    var taxLabel = 'Tax';
    if (taxRate > 0 && taxableSub > 0) taxLabel = 'Tax (' + taxRate + '% on ' + formatMoney(taxableSub) + ')';
    else if (taxRate > 0) taxLabel = 'Tax (' + taxRate + '%)';
    function row(label, amt, grandRow, color) {
      var cls = grandRow ? 'cch-doc-line-totals-grand' : 'cch-doc-line-totals-row';
      var st = color ? ' style="color:' + color + ';"' : '';
      return '<div class="' + cls + '"' + st + '><span>' + esc(label) + '</span><span>' + formatMoney(amt) + '</span></div>';
    }
    return '<div class="cch-doc-line-totals-footer"><div class="cch-doc-line-totals-inner">' +
      row(subLabel, subtotal) +
      row('Shipping', shipping) +
      row(taxLabel, tax) +
      (prepaid > 0.01 ? row('Pre-Paid Sales Tax', prepaid, false, '#E16A5B') : '') +
      credits.map(function(c) {
        if (!c || Math.abs(c.amount) < 0.01) return '';
        return row(c.label || 'Credit', c.amount);
      }).join('') +
      row(totalLabel, grand, true) +
      '</div></div>';
  };

  // ============================================================
  // 30. INVOICE/PO VIEW MODE — Read-only view, Edit button to switch
  // ============================================================
  window.renderDocViewPage = function(type, projectId, docId, docData, items, projData) {
    var T = document.getElementById('contentArea');
    var collection = type === 'invoice' ? 'invoices' : type === 'po' ? 'purchaseOrders' : 'proposals';
    if (items && items.length && typeof window.ensureLibraryProductsForLineItems === 'function') {
      void window.ensureLibraryProductsForLineItems(items);
    }
    window._docEdit = { type: type, projectId: projectId, docId: docId, collection: collection, docData: docData, items: items };
    var projName = projData.name || projectId;
    var typeLabel = type === 'invoice' ? 'Invoice' : type === 'po' ? 'Purchase Order' : 'Proposal';
    var backTab = type === 'invoice' ? 'invoices' : type === 'po' ? 'pos' : 'proposals';
    var docNum = docData.invoiceNum || docData.number || docData.proposalNum || docData.name || docId.slice(0,8);
    if (type === 'invoice') {
      window._docViewInvoiceCtx = { projectId: projectId, docId: docId, collection: collection };
    } else {
      window._docViewInvoiceCtx = null;
    }

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
    var projectAddress = typeof window.cchProjectAddressFromData === 'function'
      ? window.cchProjectAddressFromData(projData, docData)
      : String(projData.projectAddress || projData.address || docData.projectAddress || '').trim();

    if (type === 'invoice' && typeof window.cchSanitizeClientDisplayValue === 'function') {
      var _projClientName = projData.clientName || projData.billingContactName || '';
      clientName = window.cchSanitizeClientDisplayValue(clientName, _projClientName);
      clientEmail = window.cchSanitizeClientDisplayValue(clientEmail, projData.clientEmail || projData.contactEmail || '');
      clientPhone = window.cchSanitizeClientDisplayValue(clientPhone, projData.clientPhone || projData.contactPhone || '');
      clientCompany = window.cchSanitizeClientDisplayValue(clientCompany, projData.clientCompany || '');
      clientAddress = window.cchSanitizeClientDisplayValue(clientAddress, projData.clientAddress || projData.billingAddress || '');
      clientAddress2 = window.cchSanitizeClientDisplayValue(clientAddress2, projData.clientAddress2 || '');
    }

    // Totals — tax cascade: doc → project → company default (+ docShipping on invoices)
    var subtotal = 0, taxableSubtotal = 0, totalShipping = 0, taxRate = 0, tax = 0, grandTotal = 0;
    var _invCredits = [];
    var _invCreditTotal = 0;
    var invVoidEarly = type === 'invoice' && String(docData.status || '').toLowerCase() === 'void';
    if (type === 'invoice' && !invVoidEarly && typeof window.invoiceViewTotals === 'function') {
      var _invT = window.invoiceViewTotals(docData, items, projData);
      subtotal = _invT.subtotal;
      taxableSubtotal = _invT.taxableSubtotal;
      totalShipping = _invT.totalShipping;
      taxRate = _invT.taxRate;
      tax = _invT.tax;
      grandTotal = _invT.grandTotal;
      _invCredits = _invT.credits || [];
      _invCreditTotal = _invT.creditTotal || 0;
    } else if (!invVoidEarly) {
      if (type === 'po' && typeof window.cchPoMerchandiseTotal === 'function') {
        subtotal = window.cchPoMerchandiseTotal(docData);
        grandTotal = subtotal;
        taxRate = 0;
        tax = 0;
      } else {
      items.forEach(function(i) {
        if (typeof isProposalGroupHeaderItem === 'function' && isProposalGroupHeaderItem(i)) return;
        if (type === 'po' && typeof window.cchPoLineIsBillOnlyExpense === 'function' && window.cchPoLineIsBillOnlyExpense(i)) return;
        var ship = parseFloat(i.shipping) || 0;
        var lineAmt;
        if (type === 'po' && typeof window.cchPoLineMerchandiseAmount === 'function') {
          lineAmt = window.cchPoLineMerchandiseAmount(i);
          if (Math.abs(lineAmt) < 0.001) return;
          subtotal += lineAmt;
          return;
        }
        if (type === 'invoice' && typeof window.invoiceLineAmountForTotals === 'function') {
          lineAmt = window.invoiceLineAmountForTotals(i).lineAmt;
        } else {
          var qty = parseFloat(i.qty) || 1;
          var cost = parseFloat(i.cost) || 0;
          var mkup = parseFloat(i.markupPct) || 0;
          if (type === 'invoice' && typeof invoiceLineIsDesignServicesNoMarkup === 'function' && invoiceLineIsDesignServicesNoMarkup(i)) mkup = 0;
          var amt = parseFloat(i.amount) || 0;
          lineAmt = (cost > 0 ? cost * qty * (1 + mkup / 100) : amt);
        }
        subtotal += lineAmt;
        var isTaxable = (typeof window.cchInvoiceLineIsTaxable === 'function') ? window.cchInvoiceLineIsTaxable(i) : (i.taxable !== false && (i.taxable === true || i.expenseType === 'product' || (!i.expenseType && i.taxable !== false)));
        if (isTaxable) taxableSubtotal += lineAmt;
        totalShipping += ship;
      });
      taxRate = (typeof window.cchDocumentSalesTaxRate === 'function')
        ? window.cchDocumentSalesTaxRate(type, docData, projData)
        : (parseFloat(docData.taxRate) || parseFloat(projData.taxRate) || (window._companyTaxConfig ? window._companyTaxConfig.defaultTaxRate : 0) || 0);
      tax = type === 'po' ? 0 : taxableSubtotal * (taxRate / 100);
      if (type === 'invoice') totalShipping += parseFloat(docData.docShipping) || 0;
      grandTotal = subtotal + (type === 'po' ? 0 : totalShipping) + tax;
      }
    }
    var _invForPay = (type === 'invoice' && !invVoidEarly)
      ? Object.assign({}, docData, { items: items, taxRate: taxRate || docData.taxRate })
      : null;
    var paySummary;
    var totalPaid = 0;
    var balance = 0;
    if (type === 'invoice' && !invVoidEarly && _invForPay) {
      paySummary = (typeof window.invoiceDocPaymentSummary === 'function')
        ? window.invoiceDocPaymentSummary(_invForPay, grandTotal, type)
        : (function() {
            var tp = (_invForPay.payments || []).reduce(function(s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
            return { rows: _invForPay.payments || [], totalPaid: tp, balance: Math.max(0, grandTotal - tp), rawBalance: grandTotal - tp, grandTotal: grandTotal };
          })();
      totalPaid = paySummary.totalPaid || 0;
      balance = paySummary.balance != null ? paySummary.balance : Math.max(0, grandTotal - totalPaid);
    } else {
      var _poPayGrandTotal = grandTotal;
      if (type === 'po' && docData.bill && docData.bill.received && typeof window.cchPoVendorBillTotal === 'function') {
        _poPayGrandTotal = window.cchPoVendorBillTotal(docData);
      }
      paySummary = ((type === 'invoice' || type === 'po') && typeof window.invoiceDocPaymentSummary === 'function')
        ? window.invoiceDocPaymentSummary(_invForPay || docData, _poPayGrandTotal, type)
        : (function() {
            var payments = docData.payments || [];
            var tp = payments.reduce(function(s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
            return { rows: payments, totalPaid: tp, balance: grandTotal - tp, grandTotal: grandTotal };
          })();
      totalPaid = paySummary.totalPaid || 0;
      balance = invVoidEarly ? 0 : (paySummary.balance != null ? paySummary.balance : (grandTotal - totalPaid));
    }
    var _payAdminOpts = {
      admin: typeof window.cchDocPaymentAdmin === 'function' && window.cchDocPaymentAdmin(),
      projectId: projectId,
      collection: collection,
      docId: docId
    };
    var _retainerDoubleCount = (type === 'invoice' && !invVoidEarly && typeof window.invoiceRetainerDoubleCountInfo === 'function')
      ? window.invoiceRetainerDoubleCountInfo(_invForPay || docData, grandTotal, totalPaid)
      : null;
    var _adminTrueBalance = (_retainerDoubleCount && _retainerDoubleCount.doubleCount && _payAdminOpts.admin)
      ? _retainerDoubleCount.balanceOwed
      : null;
    var payments = paySummary.rows || docData.payments || [];
    // Invoice payments rail + PO Applied payments (Edit/×). PO was wrongly invoice-gated after Jul 2 layout.
    var showPaymentTotals = !invVoidEarly && (
      (type === 'invoice' &&
        (totalPaid > 0.01 || (paySummary.rows && paySummary.rows.length > 0) ||
          String(docData.status || '').toLowerCase() === 'paid' ||
          (typeof window.invoiceQbPaidDateRaw === 'function' && window.invoiceQbPaidDateRaw(docData)) ||
          balance < grandTotal - 0.01)) ||
      (type === 'po' && !!(docData.bill && docData.bill.received) &&
        (totalPaid > 0.01 || (paySummary.rows && paySummary.rows.length > 0)))
    );

    // Group items by user-selected view mode (room/category) for proposals + invoices.
    var docGroupMode = (typeof window.cchDocGroupModeForData === 'function')
      ? window.cchDocGroupModeForData(docData, type)
      : 'room';
    var grouped = (typeof window.cchGroupDocumentItems === 'function')
      ? window.cchGroupDocumentItems(items, type, docGroupMode)
      : {};
    var _groupKeys = (typeof window.cchOrderedDocumentGroupKeys === 'function')
      ? window.cchOrderedDocumentGroupKeys(grouped, items, type, docGroupMode)
      : Object.keys(grouped).sort();
    var _docGroupLabel = docGroupMode === 'category' ? 'Category' : 'Room';
    var _invoiceLineLayout = (type === 'invoice' && typeof window.cchInvoiceLineLayoutGet === 'function')
      ? window.cchInvoiceLineLayoutGet(projectId, docId)
      : 'grouped';

    var statusBadge = docData.status ? '<span class="badge badge-' + (docData.status || 'draft').toLowerCase().replace(/\s+/g, '-') + '" style="font-size:13px;padding:6px 14px;">' + esc(docData.status) + '</span>' : '';
    var statusHeaderHtml = (type === 'proposal' && typeof window.proposalStatusSelectHtml === 'function')
      ? '<div style="text-align:right;"><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--gray-400);font-weight:600;margin-bottom:4px;">Status</div>' +
        window.proposalStatusSelectHtml(projectId, docId, docData.status || 'Draft') +
        (docData.published ? '<div style="margin-top:6px;"><span class="badge badge-published" style="font-size:10px;"><span class="badge-icon">✓</span> On client portal</span></div>' : '') +
        '</div>'
      : '<div style="margin-bottom:8px;">' + statusBadge + '</div>';

    var _canPushQBView = (typeof userCanPushToQB === 'function' ? userCanPushToQB() : false);
    var qbRealId = (typeof getQbId === 'function' ? getQbId(docData) : (docData.qbDocId || null));
    var qbViewTopBtn = '';
    if (type === 'invoice') {
      if (invVoidEarly) {
        qbViewTopBtn = '<span style="font-size:11px;color:var(--gray-500);margin-left:8px;" title="Void invoices are not pushed to QuickBooks.">Void — not billable in QB</span>';
      } else if (qbRealId) {
        qbViewTopBtn = '<span class="badge badge-approved" style="font-size:11px;padding:5px 12px;margin-left:4px;">✅ QB Synced (' + esc(String(qbRealId)) + ')</span>';
        if (_canPushQBView) {
          var _qbUpdHint = docData.qbPushLastError ? escAttr('Last error: ' + String(docData.qbPushLastError)) : 'Replace line items and totals on the existing QuickBooks invoice';
          qbViewTopBtn += '<button class="btn btn-sm" style="background:#2CA01C;color:#1B3352;border:none;margin-left:4px;" title="' + _qbUpdHint + '" onclick="pushDocToQB(\'invoice\',\'' + projectId + '\',\'' + docId + '\',this,false,true)">🔄 Update in QuickBooks</button>';
        }
      } else if (docData.qbPushPending) {
        qbViewTopBtn = '<span class="badge" style="font-size:11px;padding:5px 12px;margin-left:4px;background:rgba(245,158,11,0.15);color:#92400E;border:1px solid rgba(245,158,11,0.35);" title="Cloud sync in progress — usually under 1 minute. Refresh to update.">⏳ QB queued</span>';
      } else if (_canPushQBView) {
        var _qbErrHint = docData.qbPushLastError ? escAttr('Last error: ' + String(docData.qbPushLastError)) : '';
        qbViewTopBtn = '<button class="btn btn-sm" style="background:#2CA01C;color:#1B3352;border:none;margin-left:4px;" title="' + _qbErrHint + '" onclick="pushDocToQB(\'invoice\',\'' + projectId + '\',\'' + docId + '\',this)">📤 Push to QuickBooks</button>';
      } else {
        qbViewTopBtn = '<span style="font-size:11px;color:var(--gray-400);margin-left:8px;">QuickBooks push not available for this account</span>';
      }
    } else if (type === 'po') {
      var _billQbId = docData.bill && docData.bill.qbBillId;
      var _poBillOnly = typeof window.cchPoQbBillOnlyMode === 'function' && window.cchPoQbBillOnlyMode();
      if (_billQbId) {
        qbViewTopBtn = '<span class="badge badge-approved" style="font-size:11px;padding:5px 12px;margin-left:4px;">✅ QB Bill (' + esc(String(_billQbId)) + ')</span>';
      } else if (_poBillOnly) {
        qbViewTopBtn = '<span style="font-size:11px;color:#5C6B80;margin-left:4px;">QuickBooks: push vendor bill below</span>';
      } else if (qbRealId) {
        qbViewTopBtn = '<span class="badge badge-approved" style="font-size:11px;padding:5px 12px;margin-left:4px;">✅ QB Synced (' + esc(String(qbRealId)) + ')</span>';
      } else if (docData.qbPushPending) {
        qbViewTopBtn = '<span class="badge" style="font-size:11px;padding:5px 12px;margin-left:4px;background:rgba(245,158,11,0.15);color:#92400E;border:1px solid rgba(245,158,11,0.35);">⏳ QB queued</span>';
      } else if (_canPushQBView) {
        var _qbErrHint = docData.qbPushLastError ? escAttr('Last error: ' + String(docData.qbPushLastError)) : '';
        qbViewTopBtn = '<button class="btn btn-sm" style="background:#2CA01C;color:#1B3352;border:none;margin-left:4px;" title="' + _qbErrHint + '" onclick="pushDocToQB(\'po\',\'' + projectId + '\',\'' + docId + '\',this)">📤 Push to QuickBooks</button>';
      }
    }
    var lineItemsQbBtn = '';
    if (type === 'invoice') {
      lineItemsQbBtn = '';
    } else if (type === 'po') {
      lineItemsQbBtn = '';
    }

    // Linked docs — single source via renderLinkedDocBadges (hashchange listener skips if already rendered)
    var linkedHTML = typeof window.renderLinkedDocBadges === 'function'
      ? window.renderLinkedDocBadges(projectId, docData, type)
      : '';

    if (type === 'invoice' && typeof window.cchInvoiceRouteIs === 'function' && !window.cchInvoiceRouteIs(projectId, docId)) return;

    setBreadcrumb([
      { label: 'Projects', hash: '#/projects' },
      { label: projName, hash: '#/project/' + projectId + '/' + backTab },
      { label: typeLabel + ' ' + docNum }
    ]);

    var _delViewOnclick = type === 'invoice'
      ? 'void deleteInvoice(\'' + cchEscJsStr(projectId) + '\',\'' + cchEscJsStr(docId) + '\')'
      : type === 'po'
        ? 'void deletePurchaseOrder(\'' + cchEscJsStr(projectId) + '\',\'' + cchEscJsStr(docId) + '\')'
        : 'void deleteProposal(\'' + cchEscJsStr(projectId) + '\',\'' + cchEscJsStr(docId) + '\')';
    var _delViewBtn = '<button type="button" class="btn btn-secondary btn-sm" style="color:var(--red);border-color:rgba(198,40,40,0.35);" onclick="' + _delViewOnclick + '">🗑️ Delete</button>';

    setTopbarActions(typeof window.cchBuildDocViewTopbar === 'function' ? window.cchBuildDocViewTopbar({
      type: type,
      projectId: projectId,
      docId: docId,
      collection: collection,
      backTab: backTab,
      projName: projName,
      docData: docData,
      invVoidEarly: invVoidEarly,
      qbRealId: qbRealId,
      canPushQB: _canPushQBView
    }) : '');

    function cchDocItemLineIndex(allItems, item) {
      for (var i = 0; i < allItems.length; i++) {
        if (allItems[i] === item) return i;
      }
      var t = String(item.title || '').trim();
      var v = String(item.vendor || '').trim();
      var a = String(parseFloat(item.amount) || 0);
      for (var j = 0; j < allItems.length; j++) {
        var x = allItems[j];
        if (typeof isProposalGroupHeaderItem === 'function' && isProposalGroupHeaderItem(x)) continue;
        if (String(x.title || '').trim() === t && String(x.vendor || '').trim() === v &&
            String(parseFloat(x.amount) || 0) === a) return j;
      }
      return -1;
    }

    var _showLineTagCol = type === 'invoice' || type === 'proposal' || type === 'po';
    var _showPoVendorCol = type !== 'po';
    var _showPoLineEtaCol = false;
    var _showPoShippingCol = type !== 'po';
    /** Invoices: tax is footer-only (Totals rail), not per-line — no Tax column on product rows. */
    var _showPoSalesTaxCol = (type === 'proposal');
    /** Client-facing invoice view: room per line, no markup column (Manage has markup). */
    var _showRoomCol = (type === 'invoice');
    var _showMarkupCol = (type !== 'po' && type !== 'invoice');
    var _poExtraCols = (_showPoLineEtaCol ? 1 : 0);
    var _invTableColspan = type === 'invoice' ? 10 : (type === 'proposal' ? 10 : (9 + _poExtraCols));

    var _docViewTableHeadHtml =
        '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="border-bottom:1px solid var(--gray-200);">' +
          '<th style="width:80px;padding:8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;"></th>' +
          '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;">Item</th>' +
          (_showPoVendorCol ? '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;">Vendor</th>' : '') +
          (_showRoomCol ? '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;">Room</th>' : '') +
          (_showLineTagCol ? '<th style="padding:8px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;width:52px;" title="Optional label: fixture, fabric/trim, builder code">Tag</th>' : '') +
          (type === 'invoice' ? '<th style="padding:8px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;width:64px;">Notes</th>' : '') +
          '<th style="padding:8px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;">Qty</th>' +
          '<th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;">Cost</th>' +
          (_showMarkupCol ? '<th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;">Markup</th>' : '') +
          (_showPoShippingCol ? '<th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;">Shipping</th>' : '') +
          (_showPoSalesTaxCol ? '<th style="padding:8px;text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;width:50px;">Tax</th>' : '') +
          '<th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);font-weight:600;"' + (type === 'invoice' ? ' title="Line merchandise (pre-tax; sales tax is in Totals only)"' : '') + '>Total</th>' +
        '</tr></thead><tbody>';

    function _docViewLineRowsHtml(catItems) {
      var rows = '';
      (catItems || []).forEach(function(item) {
        var qty = parseFloat(item.qty) || 1;
        var cost = parseFloat(item.cost) || 0;
        var mkup = parseFloat(item.markupPct) || 0;
        if (type === 'invoice' && typeof invoiceLineIsDesignServicesNoMarkup === 'function' && invoiceLineIsDesignServicesNoMarkup(item)) mkup = 0;
        var ship = parseFloat(item.shipping) || 0;
        var amt = parseFloat(item.amount) || 0;
        var lineAmtForRow = type === 'po'
          ? (typeof window.cchPoLineMerchandiseAmount === 'function'
            ? window.cchPoLineMerchandiseAmount(item)
            : ((cost * qty) + ship))
          : ((type === 'invoice' && typeof window.invoiceLineAmountForTotals === 'function')
            ? window.invoiceLineAmountForTotals(item).lineAmt
            : (cost > 0 ? cost * qty * (1 + mkup / 100) : amt));
        var isTaxable = (typeof window.cchInvoiceLineIsTaxable === 'function') ? window.cchInvoiceLineIsTaxable(item) : (item.taxable !== false && (item.taxable === true || item.expenseType === 'product' || (!item.expenseType && item.taxable !== false)));
        var isSvcRow = item.expenseType === 'service' || item.itemType === 'service';
        if (type === 'invoice' && typeof window.cchInvoiceLineUseServiceStyleInView === 'function' && window.cchInvoiceLineUseServiceStyleInView(item)) {
          isSvcRow = true;
        }
        var _lineIdxImg = (type === 'invoice') ? cchDocItemLineIndex(items, item) : -1;
        var imgTag;
        if (type === 'invoice' && typeof window.cchBuildInvoiceLineImgHtml === 'function') {
          imgTag = window.cchBuildInvoiceLineImgHtml(item, _lineIdxImg);
        } else if (type === 'invoice' && typeof window.cchInvoiceViewLineThumbHtml === 'function') {
          imgTag = window.cchInvoiceViewLineThumbHtml(item, _lineIdxImg);
        } else {
            var _thumbUrl = (typeof window.getBestImageUrl === 'function'
              ? window.getBestImageUrl(item, _lineIdxImg)
              : (typeof window.getInvoiceLineDisplayImageUrl === 'function'
                ? window.getInvoiceLineDisplayImageUrl(item, _lineIdxImg)
                : (typeof window.getProposalLineHeroImageUrl === 'function' ? window.getProposalLineHeroImageUrl(item) : '')))
              || (typeof window._resolveImgSrc === 'function'
                ? window._resolveImgSrc(String(item.imageUrl || item.image || '').trim())
                : (item.imageUrl || ''));
            if (_thumbUrl) {
              var _iconAttr = (typeof cchLineIconImgDataAttr === 'function') ? cchLineIconImgDataAttr(item) : '';
              imgTag = '<img src="' + _escImgSrcAttr(_thumbUrl) + '"' + _iconAttr + ' style="width:64px;height:64px;object-fit:cover;border-radius:4px;background:var(--gray-50);" referrerpolicy="no-referrer" onerror="typeof cchImgTryFallbacks===\'function\'&&cchImgTryFallbacks(this)">';
            } else {
              imgTag = (typeof cchLineIconPlaceholderHtml === 'function')
                ? cchLineIconPlaceholderHtml(item, 64)
                : '<div style="width:64px;height:64px;background:var(--gray-50);display:flex;align-items:center;justify-content:center;font-size:24px;border-radius:4px;border:1px solid var(--gray-100);">📦</div>';
            }
        }
        if (type === 'invoice' && isSvcRow && (!imgTag || imgTag.indexOf('<img ') < 0)) {
          imgTag = '<div style="width:64px;height:64px;background:transparent;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--gray-300);border:1px dashed var(--gray-200);">—</div>';
        }
        var lineTag = (typeof window.cchLineTagText === 'function') ? window.cchLineTagText(item) : '';
        var lineNotes = (typeof window.cchLineNotesBodyText === 'function')
          ? window.cchLineNotesBodyText(item)
          : ((typeof window.cchLineExplicitNotesText === 'function')
            ? window.cchLineExplicitNotesText(item)
            : String(item.lineNotes || '').trim());
        var descRaw = item.description || '';
        if (type === 'invoice' && typeof window.sanitizeInvoicePreviewLineText === 'function') {
          descRaw = window.sanitizeInvoicePreviewLineText(descRaw);
          lineNotes = window.sanitizeInvoicePreviewLineText(lineNotes);
          if (lineTag) lineTag = window.sanitizeInvoicePreviewLineText(lineTag);
        }
        var _nl = lineNotes ? String(lineNotes).split(/\r?\n/).map(function(l) { return l.trim(); }).filter(Boolean) : [];
        var noteLineCount = _nl.length;
        var descTrim = String(descRaw || '').trim();
        if (type === 'invoice' && typeof window.invoiceSuppressGenericServiceDescription === 'function') {
          descTrim = window.invoiceSuppressGenericServiceDescription(descTrim, item);
        }
        var expandDetail = type === 'invoice' ? (descTrim.length > 200) : false;
        var poSpecsHtml = (type === 'po' && typeof window.cchPoLineSpecsBlockHtml === 'function')
          ? window.cchPoLineSpecsBlockHtml(item, { includeDescription: true, omitRoom: true })
          : '';
        var descHtmlInner = (type === 'po')
          ? poSpecsHtml
          : (descTrim ? '<div style="margin-top:6px;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#C4A464;font-weight:700;">Description</div><div style="font-size:12px;color:var(--gray-400);margin-top:2px;white-space:pre-wrap;line-height:1.45;">' + esc(descRaw) + '</div></div>' : '');
        var notesHtmlInner = '';
        if (lineNotes && type !== 'invoice') {
          if (_nl.length <= 1) {
            notesHtmlInner = '<div style="margin-top:6px;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#C4A464;font-weight:700;">Notes</div><div style="font-size:11px;color:var(--gray-500);margin-top:2px;white-space:pre-wrap;line-height:1.45;">' + esc(lineNotes) + '</div></div>';
          } else {
            notesHtmlInner = '<div style="margin-top:6px;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#C4A464;font-weight:700;">Notes</div><ul style="font-size:11px;color:var(--gray-500);margin:4px 0 0 1.1em;padding:0;line-height:1.45;list-style:disc;">' +
              _nl.map(function(l) { return '<li style="margin:2px 0;">' + esc(l) + '</li>'; }).join('') + '</ul></div>';
          }
        }
        var lineIdx = (type === 'invoice') ? cchDocItemLineIndex(items, item) : cchDocItemLineIndex(items, item);
        if (type === 'po' && lineIdx >= 0 && typeof window.cchPoOpenLineImageEditor === 'function') {
          imgTag = '<div role="button" tabindex="0" onclick="event.stopPropagation();cchPoOpenLineImageEditor(\'' + cchEscJsStr(projectId) + '\',\'' + cchEscJsStr(docId) + '\',' + lineIdx + ')" title="Click to edit PO line image" style="display:inline-block;cursor:pointer;line-height:0;border-radius:4px;">' + imgTag + '</div>';
        }
        var _libSuggestHtml = '';
        if (lineIdx >= 0 && typeof window.cchLibrarySuggestHintHtml === 'function') {
          _libSuggestHtml = window.cchLibrarySuggestHintHtml(item, lineIdx);
        }
        var invNoteBtnHtml = '';
        var invNoteRowHtml = '';
        if (type === 'invoice' && lineIdx >= 0) {
          var _pe = cchEscJsStr(projectId);
          var _de = cchEscJsStr(docId);
          invNoteBtnHtml = '<button type="button" class="btn btn-sm" style="padding:4px 7px;font-size:10px;line-height:1.1;min-width:58px;color:#1B3352;border:1px solid rgba(196,164,100,0.45);background:#FFFDF8;" title="' + escAttr(lineNotes ? lineNotes : 'Add line-item notes shown under the description') + '" onclick="event.stopPropagation();toggleInvoiceLineNotes(' + lineIdx + ')">' + (lineNotes ? 'Notes ▾' : '+ Notes') + '</button>';
          invNoteRowHtml = '<tr id="invLineNotesRow' + lineIdx + '" class="inv-line-notes-row" style="display:none;background:#FFFDF8;">' +
            '<td colspan="' + _invTableColspan + '" style="padding:10px 12px;border-top:1px solid rgba(196,164,100,0.18);border-bottom:1px solid rgba(196,164,100,0.18);">' +
              '<div style="display:grid;grid-template-columns:120px minmax(0,1fr) auto;gap:10px;align-items:start;">' +
                '<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#C4A464;font-weight:700;padding-top:8px;">Line notes</div>' +
                '<textarea id="invLineNotesText' + lineIdx + '" class="form-textarea" rows="3" placeholder="Application / install notes (not the fixture tag)." style="min-height:64px;font-size:12px;line-height:1.45;background:#fff;">' + esc(lineNotes) + '</textarea>' +
                '<div style="display:flex;gap:6px;align-items:center;padding-top:2px;">' +
                  '<button type="button" class="btn btn-primary btn-sm" onclick="event.stopPropagation();saveInvoiceLineNotes(\'' + _pe + '\',\'' + _de + '\',' + lineIdx + ')">Save</button>' +
                  '<button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation();toggleInvoiceLineNotes(' + lineIdx + ')">Close</button>' +
                '</div>' +
              '</div>' +
            '</td></tr>';
        }
        var detailBlock = '';
        if (expandDetail) {
          var qtyStr = (Math.abs(qty - Math.round(qty)) < 0.001) ? String(Math.round(qty)) : String(qty);
          var unitLbl = (Math.abs(qty - 1) < 0.001) ? 'hr' : 'hrs';
          var hint = noteLineCount > 1
            ? (qtyStr + ' ' + unitLbl + ' · ' + noteLineCount + ' entr' + (noteLineCount === 1 ? 'y' : 'ies') + ' — click to expand')
            : 'Details — click to expand';
          detailBlock = '<details class="cch-inv-line-details" style="margin-top:6px;">' +
            '<summary style="cursor:pointer;font-size:12px;font-weight:600;color:#1B3352;list-style:none;">' + esc(hint) + '</summary>' +
            '<div style="margin-top:8px;padding-left:8px;border-left:2px solid rgba(200,169,110,0.4);">' + descHtmlInner + notesHtmlInner + '</div></details>';
        } else {
          detailBlock = descHtmlInner + notesHtmlInner;
        }
        var _lineTitle = typeof window.invoiceLineDisplayTitle === 'function' ? window.invoiceLineDisplayTitle(item) : (item.title || 'Untitled');
        var _poRoomTagHtml = '';
        if (type === 'po') {
          if (lineTag) {
            _poRoomTagHtml = '<div style="font-size:11px;color:#5C6B80;margin-top:4px;line-height:1.4;">' +
              '<span style="font-weight:700;color:#1B3352;">Tag ' + esc(lineTag) + '</span></div>';
          }
        }
        var typeBadgeHtml = '';
        if (type === 'invoice') {
          if (typeof invoiceLineIsDesignServicesNoMarkup === 'function' && invoiceLineIsDesignServicesNoMarkup(item)) {
            typeBadgeHtml = '<div style="font-size:10px;margin-top:4px;"><span style="padding:2px 8px;border-radius:8px;background:rgba(200,169,110,0.12);color:var(--gold);font-weight:600;">service</span></div>';
          } else if (typeof window.cchInvoiceLineIsTeTravelPresentation === 'function' && window.cchInvoiceLineIsTeTravelPresentation(item)) {
            typeBadgeHtml = '<div style="font-size:10px;margin-top:4px;"><span style="padding:2px 8px;border-radius:8px;background:rgba(2,136,209,0.12);color:#0277BD;font-weight:600;">T&amp;E</span></div>';
          } else if (item.expenseType && item.expenseType !== 'product') {
            typeBadgeHtml = '<div style="font-size:10px;margin-top:4px;"><span style="padding:2px 8px;border-radius:8px;background:rgba(200,169,110,0.12);color:var(--gold);font-weight:600;">' + esc(item.expenseType) + '</span></div>';
          }
        } else if (item.expenseType && item.expenseType !== 'product') {
          typeBadgeHtml = '<div style="font-size:10px;margin-top:4px;"><span style="padding:2px 8px;border-radius:8px;background:rgba(200,169,110,0.12);color:var(--gold);font-weight:600;">' + esc(item.expenseType) + '</span></div>';
        }
        var _poEtaHtml = (type === 'po' && _showPoLineEtaCol && lineIdx >= 0 && typeof window.cchPoLineEtaHtml === 'function')
          ? window.cchPoLineEtaHtml(docData, item, lineIdx, items)
          : '—';
        rows += '<tr style="border-bottom:1px solid var(--gray-100);">' +
          '<td style="padding:10px 8px;">' + imgTag + '</td>' +
          '<td style="padding:10px 8px;"><div style="font-size:14px;font-weight:600;">' + esc(_lineTitle) + '</div>' +
            _poRoomTagHtml +
            _libSuggestHtml +
            detailBlock +
            (item.shipTo && type !== 'invoice' ? '<div style="font-size:11px;color:var(--teal);margin-top:2px;">📍 ' + esc(item.shipTo) + '</div>' : '') +
            typeBadgeHtml +
          '</td>' +
          (_showPoVendorCol ? '<td style="padding:10px 8px;font-size:13px;color:var(--gray-500);">' + esc(item.vendor || '') + '</td>' : '') +
          (_showRoomCol ? '<td style="padding:10px 8px;font-size:13px;color:var(--gray-500);">' + esc(String(item.room || item.roomLocation || item.projectRoom || '').trim() || '—') + '</td>' : '') +
          (_showLineTagCol ? '<td style="padding:10px 8px;text-align:center;vertical-align:middle;font-size:12px;font-weight:700;color:#1B3352;">' + esc(lineTag || '—') + '</td>' : '') +
          (type === 'invoice' ? '<td style="padding:10px 8px;text-align:center;vertical-align:middle;">' + invNoteBtnHtml + '</td>' : '') +
          '<td style="padding:10px 8px;text-align:center;font-size:14px;">' + qty + '</td>' +
          '<td style="padding:10px 8px;text-align:right;font-size:13px;font-family:monospace;">' + (cost > 0 ? formatMoney(cost) : '—') + '</td>' +
          (_showMarkupCol ? '<td style="padding:10px 8px;text-align:right;font-size:13px;color:' + (mkup > 0 ? 'var(--green)' : 'var(--gray-400)') + ';">' + (mkup > 0 ? mkup + '%' : '—') + '</td>' : '') +
          (_showPoShippingCol ? '<td style="padding:10px 8px;text-align:right;font-size:13px;color:var(--gray-400);">' + (ship > 0 ? formatMoney(ship) : '—') + '</td>' : '') +
          (_showPoSalesTaxCol ? '<td style="padding:10px 8px;text-align:center;">' + (isTaxable ? '<span style="color:#5FA56B;font-weight:700;">✓</span>' : '<span style="color:#ccc;">—</span>') + '</td>' : '') +
          '<td style="padding:10px 8px;text-align:right;font-size:14px;font-weight:600;font-family:monospace;">' + formatMoney(lineAmtForRow) + '</td>' +
        '</tr>' + invNoteRowHtml;
      });
      return rows;
    }

    // Build items HTML — default grouped (PDF line order); optional flat list per session toggle
    var itemsHTML = '';
    if (type === 'invoice' && _invoiceLineLayout === 'flat') {
      var _flatItems = (items || []).filter(function(it) {
        return !(typeof isProposalGroupHeaderItem === 'function' && isProposalGroupHeaderItem(it));
      });
      itemsHTML += '<div class="cch-inv-line-group" style="margin-bottom:14px;">' +
        _docViewTableHeadHtml + _docViewLineRowsHtml(_flatItems) + '</tbody></table></div>';
    } else if (type === 'po') {
      var _flatPoItems = (items || []).filter(function(it) {
        return !(typeof isProposalGroupHeaderItem === 'function' && isProposalGroupHeaderItem(it));
      });
      itemsHTML += '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%;margin-bottom:14px;">' +
        _docViewTableHeadHtml + _docViewLineRowsHtml(_flatPoItems) + '</tbody></table></div>';
    } else {
      _groupKeys.forEach(function(cat) {
        var catItems = grouped[cat];
        var catTotal = catItems.reduce(function(s, i) {
          if (typeof isProposalGroupHeaderItem === 'function' && isProposalGroupHeaderItem(i)) return s;
          if (type === 'invoice' && typeof window.invoiceLineAmountForTotals === 'function') {
            return s + window.invoiceLineAmountForTotals(i).lineAmt;
          }
          return s + (parseFloat(i.amount) || 0);
        }, 0);
        itemsHTML += '<div class="' + (type === 'invoice' ? 'cch-inv-line-group' : '') + '" style="margin-bottom:' + (type === 'invoice' ? '14' : '28') + 'px;">' +
          '<div style="font-size:' + (type === 'invoice' ? '13' : '14') + 'px;font-weight:600;margin-bottom:8px;padding-bottom:4px;border-bottom:2px solid var(--gold);display:flex;justify-content:space-between;">' +
            '<span>' + esc(cat) + '</span>' +
            (type === 'po' ? '' : '<span style="font-size:13px;color:var(--gray-500);">' + formatMoney(catTotal) + '</span>') +
          '</div>' +
          (type === 'po' ? '<div style="overflow-x:auto;-webkit-overflow-scrolling:touch;max-width:100%;">' : '') +
          _docViewTableHeadHtml + _docViewLineRowsHtml(catItems) + '</tbody></table>' +
          (type === 'po' ? '</div>' : '') + '</div>';
      });
    }

    // Payments / applied payments (Houzz-style when invoice has paidAmount or payments[])
    var paymentsHTML = '';
    if ((type === 'invoice' || type === 'po') && typeof window.invoiceAppliedPaymentsPanelHtml === 'function' && showPaymentTotals) {
      paymentsHTML = window.invoiceAppliedPaymentsPanelHtml(paySummary, Object.assign({ docType: type }, _payAdminOpts));
    } else if (payments.length > 0) {
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

    var docAttachments = docData.attachments || [];
    var attachmentsViewHTML = '';
    if ((type === 'invoice' || type === 'po') && docAttachments.length > 0) {
      attachmentsViewHTML = '<div style="margin-top:16px;padding:16px;background:var(--gray-50);border-radius:0;">' +
        '<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--gray-400);margin-bottom:10px;">Attachments</div>' +
        docAttachments.map(function(att) {
          var nm = esc(att.name || 'File');
          var u = String(att.url || '').trim();
          if (u) {
            return '<div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:6px 0;border-bottom:1px solid rgba(0,0,0,0.06);">' +
              '<span style="color:var(--gray-700);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-right:12px;">' + nm + '</span>' +
              '<a href="' + escAttr(u) + '" target="_blank" rel="noopener" style="color:var(--teal);font-weight:600;flex-shrink:0;">Open</a></div>';
          }
          return '<div style="font-size:13px;padding:6px 0;color:var(--gray-500);">' + nm + '</div>';
        }).join('') +
        '</div>';
    }

    var _connBtn = typeof window.cchConnectedDocsTitleBtn === 'function'
      ? window.cchConnectedDocsTitleBtn(projectId, type, docId, docNum) : '';
    var _tagsMemoBlock = typeof window.cchDocTagsMemoBlockHTML === 'function'
      ? window.cchDocTagsMemoBlockHTML(docData, type === 'po'
        ? {
            editable: true,
            projectId: projectId,
            docId: docId,
            collection: 'purchaseOrders',
            hint: '<strong>Summary</strong> and <strong>Document Tags</strong> show on PO lists. <strong>Memo</strong> is internal only. Saves automatically as you type.'
          }
        : type === 'invoice'
          ? { compact: true, hint: 'Edit in <strong>Edit line items</strong>.' }
          : { hint: '' })
      : '';

    var invoiceDetailsHTML = '';
    if (type === 'invoice') {
      var invDateRaw = docData.date || docData.createdAt || '';
      var invDateStr = invDateRaw && typeof formatDate === 'function' ? formatDate(invDateRaw) : '';
      var dueValInv = String(docData.dueDate || '').trim();
      if (dueValInv && dueValInv.indexOf('T') >= 0) dueValInv = dueValInv.slice(0, 10);
      var billToReadHtml = (clientName || clientEmail || clientPhone || clientAddress || projectAddress)
        ? (typeof window.buildPremiumBillToHtml === 'function'
          ? window.buildPremiumBillToHtml(clientName, clientAddress, clientPhone, clientEmail, clientCompany, clientAddress2, projectAddress)
          : ((clientName ? '<strong>' + esc(clientName) + '</strong><br>' : '') +
            (clientCompany ? esc(clientCompany) + '<br>' : '') +
            (projectAddress ? esc(projectAddress) + '<br>' : (clientAddress ? esc(clientAddress) + '<br>' : '')) +
            (clientAddress2 ? esc(clientAddress2) + '<br>' : '') +
            (clientPhone ? esc(clientPhone) + '<br>' : '') +
            (clientEmail ? esc(clientEmail) : '')))
        : '<span style="color:var(--gray-400);">No client on file</span>';
      invoiceDetailsHTML = '<div class="cch-doc-view-panel">' +
        '<div class="cch-doc-view-panel-hdr">' +
          '<div class="cch-doc-view-panel-title">Bill to</div>' +
          '<a href="#" id="invViewClientEditLink" onclick="event.preventDefault();toggleInvoiceViewClientEdit()" style="font-size:11px;color:var(--gold);font-weight:600;text-decoration:none;">Edit details</a>' +
        '</div>' +
        '<div class="cch-doc-view-meta">' +
          (invDateStr ? '<div><span style="font-size:9px;text-transform:uppercase;color:#9CA3AF;">Invoice date</span> <strong style="color:#1B3352;">' + esc(invDateStr) + '</strong></div>' : '') +
          '<div><span style="font-size:9px;text-transform:uppercase;color:#9CA3AF;">Due</span> ' +
            '<input type="date" class="form-input" id="docViewDueDate" value="' + escAttr(dueValInv) + '" onchange="docViewSaveDueDate()" style="font-size:11px;padding:3px 6px;max-width:148px;display:inline-block;vertical-align:middle;"></div>' +
        '</div>' +
        '<div id="invViewClientReadonly" class="cch-doc-view-billto">' + billToReadHtml + '</div>' +
        '<div id="invViewClientEdit" class="cch-doc-view-client-edit">' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
            '<div><label style="font-size:10px;color:#1B3352;font-weight:600;display:block;margin-bottom:2px;">Client name</label><input class="form-input" id="docViewClientName" value="' + escAttr(clientName) + '" onchange="docViewSaveClient()" style="font-size:11px;padding:5px 7px;"></div>' +
            '<div><label style="font-size:10px;color:#1B3352;font-weight:600;display:block;margin-bottom:2px;">Company</label><input class="form-input" id="docViewClientCompany" value="' + escAttr(clientCompany) + '" onchange="docViewSaveClient()" style="font-size:11px;padding:5px 7px;"></div>' +
            '<div><label style="font-size:10px;color:#1B3352;font-weight:600;display:block;margin-bottom:2px;">Email</label><input class="form-input" id="docViewClientEmail" value="' + escAttr(clientEmail) + '" onchange="docViewSaveClient()" style="font-size:11px;padding:5px 7px;"></div>' +
            '<div><label style="font-size:10px;color:#1B3352;font-weight:600;display:block;margin-bottom:2px;">Phone</label><input class="form-input" id="docViewClientPhone" value="' + escAttr(clientPhone) + '" onchange="docViewSaveClient()" style="font-size:11px;padding:5px 7px;"></div>' +
            '<div style="grid-column:span 2;"><label style="font-size:10px;color:#1B3352;font-weight:600;display:block;margin-bottom:2px;">Address</label><input class="form-input" id="docViewClientAddress" value="' + escAttr(clientAddress) + '" onchange="docViewSaveClient()" style="font-size:11px;padding:5px 7px;"></div>' +
            '<div style="grid-column:span 2;"><label style="font-size:10px;color:#1B3352;font-weight:600;display:block;margin-bottom:2px;">Address line 2</label><input class="form-input" id="docViewClientAddress2" value="' + escAttr(clientAddress2) + '" onchange="docViewSaveClient()" style="font-size:11px;padding:5px 7px;"></div>' +
          '</div></div></div>';
    }

    var _lineItemsHdrExtra = '';
    if (type === 'invoice') {
      var _isFlatLayout = _invoiceLineLayout === 'flat';
      var _layoutLabel = _isFlatLayout ? 'Flat list (document order)' : ('Grouped by ' + esc(_docGroupLabel));
      var _togLabel = _isFlatLayout ? ('Group by ' + (_docGroupLabel === 'Category' ? 'category' : 'room')) : 'Flat list';
      var _grpRoomActive = !_isFlatLayout && docGroupMode === 'room';
      var _grpCatActive = !_isFlatLayout && docGroupMode === 'category';
      _lineItemsHdrExtra =
        '<span style="display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
          '<span style="font-size:11px;color:var(--gray-400);font-weight:500;">' + _layoutLabel + '</span>' +
          '<button type="button" class="btn btn-secondary btn-sm" onclick="toggleInvoiceLineLayout(\'' + projectId + '\',\'' + docId + '\')">' + esc(_togLabel) + '</button>' +
          '<button type="button" class="btn btn-sm' + (_grpRoomActive ? ' btn-primary' : ' btn-secondary') + '" style="font-size:10px;padding:3px 8px;" onclick="setDocGroupView(\'invoice\',\'' + projectId + '\',\'' + docId + '\',\'room\')" title="Group lines by room (saved on invoice)">Room</button>' +
          '<button type="button" class="btn btn-sm' + (_grpCatActive ? ' btn-primary' : ' btn-secondary') + '" style="font-size:10px;padding:3px 8px;" onclick="setDocGroupView(\'invoice\',\'' + projectId + '\',\'' + docId + '\',\'category\')" title="Group lines by product category (saved on invoice)">Category</button>' +
        '</span>';
    } else {
      _lineItemsHdrExtra = lineItemsQbBtn;
    }

    var invoiceRailHTML = '';
    if (type === 'invoice') {
      var _railBalanceAmt = _adminTrueBalance != null ? _adminTrueBalance : balance;
      var _railBalanceColor = (_adminTrueBalance != null || balance <= 0.01) ? (_adminTrueBalance != null ? 'var(--gold)' : '#2E7D32') : 'var(--gold)';
      var _railBalanceNote = '';
      if (_adminTrueBalance != null && paySummary.rawBalance != null && paySummary.rawBalance < -0.01) {
        _railBalanceNote = '<div style="font-size:10px;color:#C62828;line-height:1.35;margin-top:2px;">Shows $0 to client — true math ' + formatMoney(paySummary.rawBalance) + '</div>';
      }
      var _railPayCompact = (typeof window.invoiceAppliedPaymentsPanelHtml === 'function' && showPaymentTotals)
        ? window.invoiceAppliedPaymentsPanelHtml(paySummary, Object.assign({ compact: true, inv: docData }, _payAdminOpts)) : '';
      var _railAttach = '';
      var _attachListHtml = docAttachments.length
        ? docAttachments.map(function(att) {
            var nm = esc(att.name || 'File');
            var u = String(att.url || '').trim();
            if (u) {
              return '<div class="cch-doc-view-rail-row" style="align-items:center;"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + nm + '</span><a href="' + escAttr(u) + '" target="_blank" rel="noopener" style="color:var(--teal);font-weight:600;flex-shrink:0;font-size:10px;">Open</a></div>';
            }
            return '<div style="font-size:11px;color:var(--gray-500);padding:2px 0;">' + nm + '</div>';
          }).join('')
        : '<div style="font-size:11px;color:var(--gray-400);font-style:italic;padding:2px 0 6px;">No attachments yet</div>';
      var _attachControls = (typeof window.cchDocAttachmentsControlsHtml === 'function')
        ? window.cchDocAttachmentsControlsHtml(projectId, collection, docId) : '';
      _railAttach = '<div class="cch-doc-view-rail-card"><div class="cch-doc-view-rail-title">Attachments</div>' +
        _attachListHtml + _attachControls + '</div>';
      var _canQbRefresh = type === 'invoice' && _canPushQBView && typeof syncInvoiceBalanceFromQB === 'function' &&
        typeof window.invoiceCanRefreshFromQb === 'function' && window.invoiceCanRefreshFromQb(docData);
      var _railQbSyncBtn = _canQbRefresh
        ? '<button type="button" class="btn btn-secondary btn-sm" onclick="syncInvoiceBalanceFromQB(\'' + projectId + '\',\'' + docId + '\')">\u21BB Refresh from QB</button>' : '';
      var _railQbPaidDate = (type === 'invoice' && typeof window.invoiceQbPaidDateRailHtml === 'function')
        ? window.invoiceQbPaidDateRailHtml(docData) : '';
      var _statusLabel = (typeof cchInvoiceClientDisplayStatus === 'function')
        ? cchInvoiceClientDisplayStatus(docData)
        : (docData.status || 'Draft');
      var _statusInline = _statusLabel
        ? '<span class="badge badge-' + String(_statusLabel).toLowerCase().replace(/\s+/g, '-') + '" style="font-size:10px;padding:4px 10px;">' + esc(_statusLabel) + '</span>'
        : '';
      invoiceRailHTML =
        '<aside class="cch-doc-view-rail">' +
          '<div class="cch-doc-view-rail-card">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;gap:6px;">' +
              '<div class="cch-doc-view-rail-title" style="margin:0;">Totals</div>' + _statusInline +
            '</div>' +
            '<div class="cch-doc-view-rail-row"><span>Merchandise subtotal</span><strong>' + formatMoney(subtotal) + '</strong></div>' +
            '<div class="cch-doc-view-rail-row"><span>Sales tax' + (taxRate > 0 ? ' (' + taxRate + '%)' : '') + '</span><strong>' + formatMoney(tax) + '</strong></div>' +
            '<div class="cch-doc-view-rail-row"><span>Shipping</span><strong>' + formatMoney(totalShipping) + '</strong></div>' +
            (typeof window.invoiceTotalsCreditsRailHtml === 'function' ? window.invoiceTotalsCreditsRailHtml({ credits: _invCredits }) : '') +
            '<div class="cch-doc-view-rail-row cch-doc-view-rail-grand"><span>Total</span><strong>' + formatMoney(grandTotal) + '</strong></div>' +
            (showPaymentTotals
              ? '<div class="cch-doc-view-rail-row"><span>Paid</span><strong style="color:#2E7D32;">-' + formatMoney(totalPaid) + '</strong></div>' +
                '<div class="cch-doc-view-rail-row cch-doc-view-rail-balance"><span>Balance</span><strong style="color:' + _railBalanceColor + ';">' + formatMoney(_railBalanceAmt) + '</strong></div>' +
                _railBalanceNote
              : '<div class="cch-doc-view-rail-row cch-doc-view-rail-balance"><span>Balance due</span><strong>' + formatMoney(balance > 0 ? balance : grandTotal) + '</strong></div>') +
            '<div class="cch-doc-view-rail-row" style="margin-top:4px;"><span>Lines</span><strong>' + items.length + '</strong></div>' +
            _railQbPaidDate +
            (_railPayCompact
              ? '<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(27,51,82,0.08);"><div class="cch-doc-view-rail-title">Applied payments</div>' + _railPayCompact + '</div>'
              : (showPaymentTotals && !_railPayCompact && _railQbPaidDate
                ? '<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(27,51,82,0.08);font-size:11px;color:#5C6B80;">No payment lines in Studio yet — use <strong>Refresh from QB</strong>.</div>'
                : '')) +
          '</div>' +
          _railAttach +
          '<div class="cch-doc-view-rail-card cch-doc-view-rail-actions">' +
            '<button type="button" class="btn btn-primary btn-sm" style="background:#1B3352;color:#EDE8E0;" onclick="sendInvoiceToClient(\'' + projectId + '\',\'' + docId + '\')">\uD83D\uDCE7 Send</button>' +
            '<button type="button" class="btn btn-secondary btn-sm" onclick="quickRecordPayment(\'' + projectId + '\',\'' + collection + '\',\'' + docId + '\')">\uD83D\uDCB3 Record payment</button>' +
            _railQbSyncBtn +
          '</div>' +
        '</aside>';
    }

    if (type === 'invoice') {
      var _dupWarnHtml = String(window._invoiceViewDupWarn || '').trim()
        ? '<div class="cch-inv-dup-warn">' + esc(window._invoiceViewDupWarn) + '</div>'
        : '';
      if (_retainerDoubleCount && _retainerDoubleCount.doubleCount && typeof window.invoiceRetainerDoubleCountBannerHtml === 'function') {
        _dupWarnHtml += window.invoiceRetainerDoubleCountBannerHtml(_retainerDoubleCount);
      }
      if (docData._noAutoGroup) {
        _dupWarnHtml += '<div class="cch-inv-dup-warn" style="background:rgba(46,125,50,0.08);border-color:rgba(46,125,50,0.25);color:#1B5E20;">' +
          'Locked: Studio will not auto-switch duplicate invoice docs or re-sync lines from clips on open. Use <strong>Flat list</strong> to match a PDF export.</div>';
      }
      var _invLineTotalsFooter = (items.length && typeof window.cchDocViewLineTotalsFooterHtml === 'function')
        ? (function(){
            var _pp = (typeof cchVendorPrepaidSalesTaxTotal === 'function') ? cchVendorPrepaidSalesTaxTotal(items) : 0;
            var _subDisp = (_pp > 0.01) ? Math.max(0, (subtotal || 0) - _pp) : subtotal;
            return window.cchDocViewLineTotalsFooterHtml({
              subLabel: 'Subtotal',
              subtotal: _subDisp,
              shipping: totalShipping,
              tax: tax,
              taxRate: taxRate,
              taxableSubtotal: taxableSubtotal,
              prepaidSalesTax: _pp,
              credits: _invCredits,
              creditTotal: _invCreditTotal,
              grandTotal: grandTotal
            });
          })()
        : '';
      T.innerHTML =
        '<div class="cch-doc-view-page">' +
          '<div class="cch-doc-view-grid">' +
            '<div class="cch-doc-view-main">' +
              '<div class="cch-doc-view-header" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;gap:10px;">' +
                '<div style="min-width:0;flex:1;">' +
                  '<div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:6px;margin-bottom:2px;">' +
                    '<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9CA3AF;">Invoice</span>' +
                    '<h1 style="font-size:18px;font-weight:700;font-family:var(--font-display);color:var(--text-primary);margin:0;line-height:1.2;">' + esc(docNum) + '</h1>' +
                  '</div>' +
                  '<div style="color:var(--gray-400);font-size:11px;">' + esc(projName) + '</div>' +
                  (linkedHTML ? '<div style="margin-top:4px;">' + linkedHTML + '</div>' : '') +
                '</div>' +
                '<div class="cch-doc-hdr-actions">' + _connBtn + '</div>' +
              '</div>' +
              _dupWarnHtml +
              invoiceDetailsHTML +
              '<div class="cch-doc-view-panel" style="margin-bottom:10px;">' +
                '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">' +
                  '<div class="cch-doc-view-panel-title" style="margin:0;color:#1B3352;font-weight:700;letter-spacing:1.2px;">Line items</div>' +
                  _lineItemsHdrExtra +
                '</div>' +
                (items.length === 0 ? '<div style="padding:12px;text-align:center;color:var(--gray-400);font-size:12px;">No items</div>' : itemsHTML + _invLineTotalsFooter) +
              '</div>' +
              _tagsMemoBlock +
              (typeof window.cchDocAttachmentsSectionHtml === 'function'
                ? window.cchDocAttachmentsSectionHtml(projectId, collection, docId, docData)
                : '') +
            '</div>' +
            invoiceRailHTML +
          '</div>' +
        '</div>';
      window._invoiceViewDupWarn = '';
      return;
    }

    if (type === 'po') {
      var _poRailPayCompact = '';
      if (showPaymentTotals) {
        if (typeof window.cchPoAppliedPaymentsRailHtml === 'function' && docData.bill && docData.bill.received) {
          _poRailPayCompact = window.cchPoAppliedPaymentsRailHtml(paySummary, projectId, docId);
        } else if (typeof window.invoiceAppliedPaymentsPanelHtml === 'function') {
          _poRailPayCompact = window.invoiceAppliedPaymentsPanelHtml(paySummary, Object.assign({ compact: true, docType: 'po' }, _payAdminOpts));
        }
      }
      var _poRailAttach = '';
      if (docAttachments.length > 0) {
        var _billAttUrls = {};
        if (docData.bill && Array.isArray(docData.bill.attachments)) {
          docData.bill.attachments.forEach(function(a) {
            var u = String(a && a.url || '').trim();
            if (u) _billAttUrls[u] = true;
          });
        }
        var _railOnlyAtts = docAttachments.filter(function(att) {
          var u = String(att && att.url || '').trim();
          return !u || !_billAttUrls[u];
        });
        if (_railOnlyAtts.length > 0) {
          _poRailAttach = '<div class="cch-doc-view-rail-card"><div class="cch-doc-view-rail-title">Attachments</div>' +
            _railOnlyAtts.map(function(att) {
              var nm = esc(att.name || 'File');
              var u = String(att.url || '').trim();
              if (u) {
                return '<div class="cch-doc-view-rail-row" style="align-items:center;"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + nm + '</span><a href="' + escAttr(u) + '" target="_blank" rel="noopener" style="color:var(--teal);font-weight:600;flex-shrink:0;font-size:10px;">Open</a></div>';
              }
              return '<div style="font-size:11px;color:var(--gray-500);padding:2px 0;">' + nm + '</div>';
            }).join('') + '</div>';
        }
      }
      var _poHasVendorBill = !!(docData.bill && docData.bill.received);
      var _poBillTotal = _poHasVendorBill && typeof window.cchPoVendorBillTotal === 'function' ? window.cchPoVendorBillTotal(docData) : null;
      var _poBillFreight = _poHasVendorBill && typeof window.cchPoBillFreightTotal === 'function'
        ? window.cchPoBillFreightTotal(docData) : 0;
      var _poBillVariance = typeof window.cchPoListVarianceForRow === 'function'
        ? window.cchPoListVarianceForRow(docData) : null;
      var _poStatusRail = typeof window.cchPoStatusPanelsHtml === 'function'
        ? window.cchPoStatusPanelsHtml(projectId, docId, docData, items) : '';
      var _poLineTotalsFooter = typeof window.cchPoViewLineTotalsFooterHtml === 'function'
        ? window.cchPoViewLineTotalsFooterHtml(docData, subtotal) : '';
      var _poRailActions =
        '<div class="cch-doc-view-rail-card cch-doc-view-rail-actions">' +
          '<button type="button" class="btn btn-primary btn-sm" style="background:#1B3352;color:#EDE8E0;" onclick="cchEnterDocEditMode(\'' + cchEscJsStr(projectId) + '\',\'' + cchEscJsStr(docId) + '\',\'po\')">\u270F\uFE0F Edit PO</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" onclick="previewDocument(\'po\',\'' + projectId + '\',\'' + docId + '\')">🖨 Print / PDF</button>' +
          (_poHasVendorBill && typeof window.cchPoOpenPaymentModal === 'function'
            ? '<button type="button" class="btn btn-secondary btn-sm" style="background:#1B3352;color:#EDE8E0;border-color:#1B3352;" onclick="cchPoOpenPaymentModal(\'' + projectId + '\',\'' + docId + '\')">💳 Pay bill</button>'
            : '') +
          (lineItemsQbBtn ? '<div style="margin-top:6px;">' + lineItemsQbBtn + '</div>' : '') +
        '</div>';
      var poRailHTML =
        '<aside class="cch-doc-view-rail">' +
          '<div class="cch-doc-view-rail-card">' +
            '<div class="cch-doc-view-rail-title" style="margin:0 0 6px;">Totals</div>' +
            '<div class="cch-doc-view-rail-row"><span>Merchandise</span><strong>' + formatMoney(subtotal) + '</strong></div>' +
            (_poHasVendorBill && Math.abs(_poBillFreight) >= 0.01
              ? '<div class="cch-doc-view-rail-row"><span>Bill shipping</span><strong>' + formatMoney(_poBillFreight) + '</strong></div>'
              : '') +
            (_poBillVariance != null && Math.abs(_poBillVariance) >= 0.01
              ? '<div class="cch-doc-view-rail-row"><span>Variance</span><strong style="color:' + (_poBillVariance > 0 ? '#B45309' : '#15803D') + ';">' +
                (_poBillVariance > 0 ? '+' : '−') + formatMoney(Math.abs(_poBillVariance)) + '</strong></div>'
              : '') +
            '<div class="cch-doc-view-rail-row cch-doc-view-rail-grand"><span>' + (_poHasVendorBill ? 'Bill total' : 'PO total') + '</span><strong>' + formatMoney(_poHasVendorBill && _poBillTotal != null ? _poBillTotal : grandTotal) + '</strong></div>' +
            (showPaymentTotals
              ? '<div class="cch-doc-view-rail-row"><span>Paid</span><strong style="color:#2E7D32;">-' + formatMoney(totalPaid) + '</strong></div>' +
                '<div class="cch-doc-view-rail-row cch-doc-view-rail-balance"><span>' + (_poHasVendorBill ? 'Bill balance' : 'Balance') + '</span><strong style="color:' + (balance <= 0.01 ? '#2E7D32' : 'var(--gold)') + ';">' + formatMoney(balance) + '</strong></div>'
              : '<div class="cch-doc-view-rail-row cch-doc-view-rail-balance"><span>Balance due</span><strong>' + formatMoney(balance > 0 ? balance : grandTotal) + '</strong></div>') +
            '<p style="margin:8px 0 0;font-size:10px;color:#5C6B80;line-height:1.35;">Sales tax on vendor bill only</p>' +
            '<div class="cch-doc-view-rail-row" style="margin-top:4px;"><span>Lines</span><strong>' + items.length + '</strong></div>' +
            (_poRailPayCompact
              ? '<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(27,51,82,0.08);"><div class="cch-doc-view-rail-title">Applied payments</div>' + _poRailPayCompact + '</div>'
              : '') +
          '</div>' +
          _poRailActions +
          (_poStatusRail
            ? '<div class="cch-doc-view-rail-card cch-po-status-rail-card">' + _poStatusRail + '</div>'
            : '') +
          _poRailAttach +
        '</aside>';

      var _poDateRaw = (typeof chPoDocPrimaryDateRaw === 'function' ? chPoDocPrimaryDateRaw(docData) : (docData.date || docData.createdAt)) || '';
      var _poDateStr = _poDateRaw && typeof formatDate === 'function' ? formatDate(_poDateRaw) : '';
      var _poVendor = String(docData.vendor || '').trim();
      var _poBillFrom = (docData.bill && docData.bill.billFromVendor) ? String(docData.bill.billFromVendor).trim() : '';
      var _poVendorAddr = String(docData.vendorAddress || '').trim();
      var _poShipToRaw = String(docData.shipTo || docData.deliverTo || '').trim();
      var _poShipTo = _poShipToRaw;
      if (_poShipToRaw && typeof window.resolvePOShipToDisplayText === 'function') {
        try {
          var _poShipResolved = window.resolvePOShipToDisplayText(_poShipToRaw, projData, docData);
          if (_poShipResolved && String(_poShipResolved).trim()) _poShipTo = String(_poShipResolved).trim();
        } catch (_ePoViewShip) {}
      }
      var poDetailsHTML = '';
      if (_poVendor || _poVendorAddr || _poShipTo) {
        poDetailsHTML =
          '<div class="cch-doc-view-panel">' +
            '<div class="cch-doc-view-panel-title">Vendor &amp; ship to</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:14px;line-height:1.5;color:#0F1A2E;">' +
              '<div>' +
                '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5C6B80;margin-bottom:8px;">PO vendor (manufacturer)</div>' +
                ((_poVendor && typeof window.cchVendorContactBlockHtml === 'function')
                  ? window.cchVendorContactBlockHtml(
                      { name: _poVendor, address: _poVendorAddr, phone: String(docData.vendorPhone || '').trim(), email: String(docData.vendorEmail || '').trim() },
                      { labelColor: '#5C6B80', addrColor: '#5C6B80', fontSize: '13px', nameFontSize: '18px' }
                    )
                  : ((_poVendor ? '<div style="font-size:18px;font-weight:700;color:#0F1A2E;">' + esc(_poVendor) + '</div>' : '<span style="color:var(--gray-400);">—</span>') +
                     (_poVendorAddr ? '<div style="margin-top:6px;color:#5C6B80;white-space:pre-wrap;font-size:13px;">' + esc(_poVendorAddr) + '</div>' : ''))) +
                (_poBillFrom && _poVendor && _poBillFrom.toLowerCase() !== _poVendor.toLowerCase()
                  ? ('<div style="margin-top:12px;padding:10px 12px;background:rgba(146,64,14,0.06);border:1px solid rgba(146,64,14,0.18);border-radius:4px;">' +
                      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#92400E;margin-bottom:4px;">Bill from (AP payee)</div>' +
                      '<div style="font-size:16px;font-weight:700;color:#92400E;">' + esc(_poBillFrom) + '</div>' +
                      '<div style="font-size:11px;color:#5C6B80;margin-top:4px;">Showroom/retailer invoiced direct — PO and print stay on manufacturer above.</div></div>')
                  : '') +
              '</div>' +
              '<div>' +
                '<div style="font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:#9CA3AF;margin-bottom:6px;">Ship to</div>' +
                (_poShipTo ? '<div style="white-space:pre-wrap;">' + esc(_poShipTo).replace(/\n/g, '<br>') + '</div>' : '<span style="color:var(--gray-400);">—</span>') +
              '</div>' +
            '</div>' +
            (_poDateStr ? '<div style="margin-top:12px;font-size:12px;color:#5C6B80;"><span style="font-size:9px;text-transform:uppercase;letter-spacing:0.06em;color:#9CA3AF;">PO date</span> <strong style="color:#1B3352;">' + esc(_poDateStr) + '</strong></div>' : '') +
            '<p style="font-size:11px;color:#5C6B80;margin:12px 0 0;line-height:1.45;">Edit vendor, ship-to, line items, and images from <strong>Edit PO</strong>. Click a line photo to change it.</p>' +
          '</div>';
      }

      var _poLineItemsPanelHtml = (docData.bill && docData.bill.received)
        ? '<div class="cch-doc-view-panel" style="margin-bottom:10px;padding:12px 14px;background:rgba(27,51,82,0.03);">' +
            '<div class="cch-doc-view-panel-title" style="margin:0 0 6px;">Purchase order line items</div>' +
            (items.length === 0 ? '<div style="padding:12px;text-align:center;color:var(--gray-400);font-size:12px;">No items</div>' : itemsHTML + _poLineTotalsFooter) +
            '<p style="font-size:11px;color:#5C6B80;margin:10px 0 0;line-height:1.45;">Click a line photo to edit it, or use <strong>Edit PO</strong> → <strong>Edit image</strong> on any row.</p>' +
          '</div>'
        : '<div class="cch-doc-view-panel" style="margin-bottom:10px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px;">' +
              '<div class="cch-doc-view-panel-title" style="margin:0;color:#1B3352;font-weight:700;letter-spacing:1.2px;">Purchase order line items</div>' +
              (docGroupMode === 'category' ? '' : '<span style="font-size:11px;color:var(--gray-400);font-weight:500;">Grouped by ' + esc(_docGroupLabel) + '</span>') +
            '</div>' +
            (items.length === 0 ? '<div style="padding:12px;text-align:center;color:var(--gray-400);font-size:12px;">No items</div>' : itemsHTML + _poLineTotalsFooter) +
          '</div>';
      var _poOmBlocksInner = typeof window.cchPoBillVarianceMainBlocksHtml === 'function'
        ? window.cchPoBillVarianceMainBlocksHtml(projectId, docId, docData, items) : '';
      var _poOmSectionHtml = _poOmBlocksInner
        ? '<div class="cch-doc-view-panel" style="margin-bottom:10px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">' +
              '<div class="cch-doc-view-panel-title" style="margin:0;">Order management</div>' +
              (typeof window.cchOmPageEnabled === 'function' && window.cchOmPageEnabled()
                ? '<a href="#/ordermanagement/open" onclick="event.preventDefault();navigate(\'#/ordermanagement/open\')" style="font-size:11px;color:#00796B;font-weight:600;text-decoration:none;">Open Order Management →</a>'
                : '') +
            '</div>' +
            '<p style="font-size:11px;color:#5C6B80;margin:0 0 12px;line-height:1.45;">Vendor confirmations, ship invoices, combined bill, and variance — status controls are in the right sidebar.</p>' +
            _poOmBlocksInner +
          '</div>'
        : '';

      T.innerHTML =
        '<div class="cch-doc-view-page">' +
          '<div class="cch-doc-view-grid">' +
            '<div class="cch-doc-view-main">' +
              '<div class="cch-doc-view-header" style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;gap:10px;">' +
                '<div style="min-width:0;flex:1;">' +
                  '<div style="display:flex;align-items:baseline;flex-wrap:wrap;gap:6px;margin-bottom:2px;">' +
                    '<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9CA3AF;">Purchase order</span>' +
                    '<h1 style="font-size:18px;font-weight:700;font-family:var(--font-display);color:var(--text-primary);margin:0;line-height:1.2;">' + esc(docNum) + '</h1>' +
                  '</div>' +
                  '<div style="color:var(--gray-400);font-size:11px;">' + esc(projName) + (_poVendor ? ' · ' + esc(_poVendor) : '') + '</div>' +
                  (linkedHTML ? '<div style="margin-top:4px;">' + linkedHTML + '</div>' : '') +
                '</div>' +
                '<div class="cch-doc-hdr-actions">' + _connBtn + '</div>' +
              '</div>' +
              poDetailsHTML +
              _poLineItemsPanelHtml +
              _poOmSectionHtml +
              _tagsMemoBlock +
            '</div>' +
            poRailHTML +
          '</div>' +
        '</div>';
      if (typeof window.cchOmEnsureNavVisible === 'function') window.cchOmEnsureNavVisible();
      return;
    }

    T.innerHTML =
      '<div style="max-width:900px;margin:0 auto;">' +
        // Header
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;">' +
          '<div style="min-width:0;flex:1;">' +
            '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-bottom:6px;">' +
            '<h1 style="font-size:24px;font-weight:700;font-family:var(--font-display);color:var(--text-primary);margin:0;">' + typeLabel + ' ' + esc(docNum) + '</h1>' +
            _connBtn +
            '</div>' +
            '<div style="color:var(--gray-400);font-size:13px;">' +
              esc(projName) + (docData.vendor ? ' · ' + esc(docData.vendor) : '') +
              (type !== 'invoice' && (docData.date || docData.createdAt) ? ' · ' + formatDate(docData.date || docData.createdAt) : '') +
            '</div>' +
            (linkedHTML ? '<div style="margin-top:8px;">' + linkedHTML + '</div>' : '') +
          '</div>' +
          '<div style="text-align:right;">' +
            statusHeaderHtml +
            '<div style="font-size:30px;font-weight:700;color:' + (balance <= 0 && totalPaid > 0 ? 'var(--green)' : 'var(--text-primary)') + ';font-family:var(--font-mono);">' + formatMoney(balance > 0 ? balance : grandTotal) + '</div>' +
            (totalPaid > 0 ? '<div style="font-size:11px;color:var(--gray-400);">of ' + formatMoney(grandTotal) + ' total</div>' : '<div style="font-size:11px;color:var(--gray-400);">' + items.length + ' items</div>') +
          '</div>' +
        '</div>' +

        // Invoice details (view mode — client, dates; Houzz-style: not on line-item edit screen)
        (type === 'invoice' ? (function() {
          var invDateRaw = docData.date || docData.createdAt || '';
          var invDateStr = invDateRaw && typeof formatDate === 'function' ? formatDate(invDateRaw) : '';
          var dueVal = String(docData.dueDate || '').trim();
          if (dueVal && dueVal.indexOf('T') >= 0) dueVal = dueVal.slice(0, 10);
          return '<div style="background:#FFFFFF;padding:20px 24px;margin-bottom:20px;border:1px solid rgba(200,185,154,0.08);">' +
            '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--gray-400);font-weight:600;margin-bottom:14px;">Invoice details</div>' +
            '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px 20px;margin-bottom:16px;font-size:13px;color:#5C6B80;">' +
              (invDateStr ? '<div><span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#9CA3AF;display:block;margin-bottom:4px;">Invoice date</span><strong style="color:#1B3352;">' + esc(invDateStr) + '</strong></div>' : '') +
              '<div><span style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#9CA3AF;display:block;margin-bottom:4px;">Due date</span>' +
                '<input type="date" class="form-input" id="docViewDueDate" value="' + escAttr(dueVal) + '" onchange="docViewSaveDueDate()" style="font-size:13px;padding:6px 10px;max-width:200px;"></div>' +
            '</div>' +
            '<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:#9CA3AF;margin-bottom:8px;">Bill to</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">' +
              '<div><label style="font-size:11px;color:#1B3352;font-weight:600;display:block;margin-bottom:4px;">Client name</label><input class="form-input" id="docViewClientName" value="' + escAttr(clientName) + '" onchange="docViewSaveClient()" style="font-size:13px;padding:8px 10px;"></div>' +
              '<div><label style="font-size:11px;color:#1B3352;font-weight:600;display:block;margin-bottom:4px;">Company</label><input class="form-input" id="docViewClientCompany" value="' + escAttr(clientCompany) + '" onchange="docViewSaveClient()" style="font-size:13px;padding:8px 10px;"></div>' +
              '<div><label style="font-size:11px;color:#1B3352;font-weight:600;display:block;margin-bottom:4px;">Email</label><input class="form-input" id="docViewClientEmail" value="' + escAttr(clientEmail) + '" onchange="docViewSaveClient()" style="font-size:13px;padding:8px 10px;"></div>' +
              '<div><label style="font-size:11px;color:#1B3352;font-weight:600;display:block;margin-bottom:4px;">Phone</label><input class="form-input" id="docViewClientPhone" value="' + escAttr(clientPhone) + '" onchange="docViewSaveClient()" style="font-size:13px;padding:8px 10px;"></div>' +
              '<div style="grid-column:span 2;"><label style="font-size:11px;color:#1B3352;font-weight:600;display:block;margin-bottom:4px;">Address</label><input class="form-input" id="docViewClientAddress" value="' + escAttr(clientAddress) + '" onchange="docViewSaveClient()" style="font-size:13px;padding:8px 10px;"></div>' +
              '<div style="grid-column:span 2;"><label style="font-size:11px;color:#1B3352;font-weight:600;display:block;margin-bottom:4px;">Address line 2</label><input class="form-input" id="docViewClientAddress2" value="' + escAttr(clientAddress2) + '" onchange="docViewSaveClient()" style="font-size:13px;padding:8px 10px;"></div>' +
            '</div>' +
            '<p style="font-size:11px;color:#5C6B80;margin-top:12px;line-height:1.45;">Changes save to the project and this invoice. Use <strong>Edit line items &amp; notes</strong> for line items, Summary, Document Tags, and Memo.</p>' +
          '</div>';
        })() : (
          (clientName || clientEmail || clientPhone || clientAddress || projectAddress ? '<div style="background:#FFFFFF;padding:20px 24px;margin-bottom:20px;border:1px solid rgba(200,185,154,0.08);">' +
            '<div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--gray-400);font-weight:600;margin-bottom:10px;">Bill To</div>' +
            '<div style="font-size:14px;">' +
              (typeof window.buildPremiumBillToHtml === 'function' ? window.buildPremiumBillToHtml(clientName, clientAddress, clientPhone, clientEmail, clientCompany, clientAddress2, projectAddress) : (
                (clientName ? '<strong>' + esc(clientName) + '</strong><br>' : '') +
                (clientCompany ? esc(clientCompany) + '<br>' : '') +
                (clientAddress ? esc(clientAddress) + '<br>' : '') +
                (clientAddress2 ? esc(clientAddress2) + '<br>' : '') +
                (clientPhone ? esc(clientPhone) + '<br>' : '') +
                (clientEmail ? esc(clientEmail) : '')
              )) +
            '</div></div>' : '')
        )) +

        _tagsMemoBlock +

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
            '<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--gray-500);margin-bottom:4px;"><span>Merchandise subtotal</span><span>' + formatMoney(subtotal) + '</span></div>' +
            (tax > 0.01 ? '<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--gray-500);margin-bottom:4px;"><span>Sales tax' + (taxRate > 0 ? ' (' + taxRate + '% on taxable)' : '') + '</span><span>' + formatMoney(tax) + '</span></div>' : '') +
            (totalShipping > 0.01 ? '<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--gray-500);margin-bottom:4px;"><span>Shipping</span><span>' + formatMoney(totalShipping) + '</span></div>' : '') +
            '<div style="display:flex;justify-content:space-between;font-size:18px;font-weight:700;padding-top:8px;border-top:2px solid var(--navy);"><span>Total</span><span>' + formatMoney(grandTotal) + '</span></div>' +
            (showPaymentTotals
              ? '<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--green);margin-top:6px;padding-top:6px;border-top:1px solid rgba(27,51,82,0.08);"><span>Paid</span><span style="font-family:var(--font-mono);">-' + formatMoney(totalPaid) + '</span></div>' +
                '<div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;color:' + (balance <= 0.01 ? 'var(--green)' : 'var(--gold)') + ';margin-top:4px;"><span>Balance</span><span style="font-family:var(--font-mono);">' + formatMoney(balance) + '</span></div>'
              : '') +
          '</div>' +
        '</div>' +

        paymentsHTML +
        attachmentsViewHTML +

        // Action buttons at bottom
        '<div style="margin-top:24px;padding:16px;background:var(--gray-50);display:flex;gap:12px;flex-wrap:wrap;align-items:center;">' +
          '<button class="btn btn-primary" style="font-size:14px;padding:10px 24px;background:#1B3352;color:#EDE8E0;" onclick="cchEnterDocEditMode(\'' + cchEscJsStr(projectId) + '\',\'' + cchEscJsStr(docId) + '\',\'' + cchEscJsStr(type) + '\')">\u270F\uFE0F ' + (type === 'invoice' ? 'Edit line items & notes' : ('Edit ' + typeLabel)) + '</button>' +
          '<button class="btn btn-secondary" style="font-size:14px;padding:10px 20px;" onclick="sendInvoiceToClient(\'' + projectId + '\',\'' + docId + '\')">\uD83D\uDCE7 Send to Client</button>' +
          '<button class="btn btn-secondary" style="font-size:14px;padding:10px 20px;" onclick="previewDocument(\'' + type + '\',\'' + projectId + '\',\'' + docId + '\')">\uD83D\uDC41\uFE0F Preview / PDF</button>' +
          '<button class="btn btn-secondary" style="font-size:14px;padding:10px 20px;" onclick="quickRecordPayment(\'' + projectId + '\',\'' + collection + '\',\'' + docId + '\')">💳 Record Payment</button>' +
          '<button class="btn btn-secondary" style="font-size:14px;padding:10px 20px;" onclick="duplicateInvoice(\'' + projectId + '\',\'' + docId + '\')">📋 Duplicate</button>' +
        '</div>' +
      '</div>';
  };

  // ============================================================
  // Invoice Client View (design-services) — luxury gift sheet on main page
  // ============================================================
  window.renderInvoiceDesignServicesClientView = async function(projectId, docId, docData, items, projData) {
    var T = document.getElementById('contentArea');
    if (!T) return;
    if (typeof window.cchInvoiceRouteIs === 'function' && !window.cchInvoiceRouteIs(projectId, docId)) return;
    items = items || [];
    projData = projData || {};
    docData = docData || {};
    var projName = projData.name || projectId;
    var docNum = docData.invoiceNum || docData.number || docId.slice(0, 8);
    var collection = 'invoices';
    var pid = projectId;
    var iid = docId;
    var invDateRaw = docData.date || docData.createdAt || '';
    var invDateStr = invDateRaw && typeof formatDate === 'function' ? formatDate(invDateRaw) : String(invDateRaw || '').slice(0, 10);

    window._docEdit = null;
    window._docViewInvoiceCtx = { projectId: pid, docId: iid, collection: collection, items: items, docData: docData, proj: projData };
    window._cchInvViewCtx = { projectId: pid, docId: iid, items: items, docData: docData, proj: projData, docNum: docNum, dateStr: invDateStr };
    window._cchDsCtx = window._cchInvViewCtx;

    if (typeof setBreadcrumb === 'function') {
      if (typeof window.cchInvoiceRouteIs === 'function' && !window.cchInvoiceRouteIs(pid, iid)) return;
      setBreadcrumb([
        { label: 'Projects', hash: '#/projects' },
        { label: projName, hash: '#/project/' + pid + '/invoices' },
        { label: 'Invoice ' + docNum }
      ]);
    }

    var invVoidEarly = String(docData.status || '').toLowerCase() === 'void';
    var qbRealId = typeof getQbId === 'function' ? getQbId(docData) : (docData.qbDocId || null);
    var _canPushQBView = typeof userCanPushToQB === 'function' ? userCanPushToQB() : false;
    if (typeof setTopbarActions === 'function') {
      setTopbarActions(typeof window.cchBuildDocViewTopbar === 'function' ? window.cchBuildDocViewTopbar({
        type: 'invoice',
        projectId: pid,
        docId: iid,
        collection: collection,
        backTab: 'invoices',
        projName: projName,
        docData: docData,
        invVoidEarly: invVoidEarly,
        qbRealId: qbRealId,
        canPushQB: _canPushQBView
      }) : '');
    }

    var dispBar = (typeof window.cchBuildDsDisplayToggleHtml === 'function')
      ? ('<div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:14px;padding:10px 14px;background:#fff;border:1px solid rgba(27,51,82,0.1);">' +
          '<span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5C6B80;white-space:nowrap;">Client display</span>' +
          window.cchBuildDsDisplayToggleHtml(true) +
          '<button type="button" class="btn btn-secondary btn-sm" style="margin-left:auto;" onclick="cchPrintCurrentDesignInvoice()">🖨 Print / PDF</button>' +
        '</div>')
      : '';

    var sheetHtml = (typeof window.cchBuildDesignServicesInvoiceInner === 'function')
      ? window.cchBuildDesignServicesInvoiceInner(docData, items, projData, pid, docNum, invDateStr)
      : '<div style="padding:24px;color:#5C6B80;">Client view unavailable.</div>';

    if (typeof window.cchInvoiceRouteIs === 'function' && !window.cchInvoiceRouteIs(pid, iid)) return;
    T.innerHTML =
      '<div class="cch-doc-view-page">' +
        '<div style="margin-bottom:10px;">' +
          '<span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9CA3AF;">Invoice · Client View</span>' +
          '<h1 style="font-size:18px;font-weight:700;margin:4px 0 0;">' + esc(docNum) + '</h1>' +
          '<div style="font-size:11px;color:var(--gray-400);">' + esc(projName) + '</div>' +
        '</div>' +
        dispBar +
        '<div id="cchInvClientLanding">' + sheetHtml + '</div>' +
      '</div>';

    if (typeof window.cchInitDsDisplayToggles === 'function') {
      try { window.cchInitDsDisplayToggles(); } catch (_eDsTog) { /* */ }
    }
  };

  // ============================================================
  // Invoice Manage landing — group, drag, inline room/markup (Client/Manage toggle)
  // ============================================================
  window.renderInvoiceManageLanding = async function(projectId, docId, docData, items, projData) {
    var T = document.getElementById('contentArea');
    if (!T) return;
    if (typeof window.cchInvoiceRouteIs === 'function' && !window.cchInvoiceRouteIs(projectId, docId)) return;
    items = items || [];
    projData = projData || {};
    docData = docData || {};
    var projName = projData.name || projectId;
    var docNum = docData.invoiceNum || docData.number || docId.slice(0, 8);
    var collection = 'invoices';
    var pid = projectId;
    var iid = docId;
    var pe = typeof escAttr === 'function' ? escAttr(pid) : pid;
    var ie = typeof escAttr === 'function' ? escAttr(iid) : iid;

    window._docEdit = { type: 'invoice', projectId: pid, docId: iid, collection: collection, docData: docData, items: items };
    window._docViewInvoiceCtx = { projectId: pid, docId: iid, collection: collection, items: items, docData: docData, proj: projData };
    var _isDsManage = typeof window.cchInvoiceUsesDesignServicesLayout === 'function' &&
      window.cchInvoiceUsesDesignServicesLayout(docData, items);
    if (_isDsManage) {
      var _dsDateRaw = docData.date || docData.createdAt || '';
      var _dsDateStr = _dsDateRaw && typeof formatDate === 'function' ? formatDate(_dsDateRaw) : String(_dsDateRaw || '').slice(0, 10);
      window._cchInvViewCtx = { projectId: pid, docId: iid, items: items, docData: docData, proj: projData, docNum: docNum, dateStr: _dsDateStr };
      window._cchDsCtx = window._cchInvViewCtx;
    }

    if (typeof setBreadcrumb === 'function') {
      if (typeof window.cchInvoiceRouteIs === 'function' && !window.cchInvoiceRouteIs(pid, iid)) return;
      setBreadcrumb([
        { label: 'Projects', hash: '#/projects' },
        { label: projName, hash: '#/project/' + pid + '/invoices' },
        { label: 'Invoice ' + docNum }
      ]);
    }

    var invVoidEarly = String(docData.status || '').toLowerCase() === 'void';
    var qbRealId = typeof getQbId === 'function' ? getQbId(docData) : (docData.qbDocId || null);
    var _canPushQBView = typeof userCanPushToQB === 'function' ? userCanPushToQB() : false;
    if (typeof setTopbarActions === 'function') {
      setTopbarActions(typeof window.cchBuildDocViewTopbar === 'function' ? window.cchBuildDocViewTopbar({
        type: 'invoice',
        projectId: pid,
        docId: iid,
        collection: collection,
        backTab: 'invoices',
        projName: projName,
        docData: docData,
        invVoidEarly: invVoidEarly,
        qbRealId: qbRealId,
        canPushQB: _canPushQBView
      }) : '');
    }

    var rooms = [];
    try {
      if (typeof window._fetchProjectBoardRoomList === 'function') {
        rooms = await window._fetchProjectBoardRoomList(pid);
      }
    } catch (eRooms) { /* */ }
    if (!rooms.length && typeof window.docEditMergeRoomsFromItems === 'function') {
      rooms = window.docEditMergeRoomsFromItems(['Living Room', 'Kitchen', 'Master Bedroom', 'Exterior'], items, 'invoice');
    }

    function invLineAmt(it) {
      if (typeof window.invoiceLineAmountForTotals === 'function') {
        return window.invoiceLineAmountForTotals(it).lineAmt;
      }
      return parseFloat(it.amount) || 0;
    }

    var rows = [];
    var section = 0;
    var sub = 0;
    var openGroupGid = null;
    var tableColspan = 16;
    var idx;
    for (idx = 0; idx < items.length; idx++) {
      var item = items[idx];
      if (typeof isProposalGroupHeaderItem === 'function' && isProposalGroupHeaderItem(item)) {
        section++;
        sub = 0;
        openGroupGid = item.groupId || ('grp_' + idx);
        var gid = openGroupGid;
        var collKey = pid + '|' + iid + '|' + gid;
        var collapsed = !!(window._invoiceCollapsedGroups && window._invoiceCollapsedGroups[collKey]);
        var groupDisplayHtml = typeof proposalGroupHeaderDisplayHtml === 'function'
          ? proposalGroupHeaderDisplayHtml(item, { compact: true })
          : esc(item.title || 'Section');
        rows.push(
          '<tr class="prop-group-row" data-idx="' + idx + '"' +
          ' ondragover="event.preventDefault();this.classList.add(\'prop-drag-over\');" ondragleave="this.classList.remove(\'prop-drag-over\');"' +
          ' ondrop="invoiceRowDropOn(\'' + pe + '\',\'' + ie + '\',' + idx + ',event)">' +
          '<td colspan="' + tableColspan + '" style="padding:10px 12px;vertical-align:middle;">' +
          '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
          '<button type="button" title="' + (collapsed ? 'Expand group' : 'Collapse group') + '" onclick="event.stopPropagation();toggleInvoiceGroupCollapse(\'' + pe + '\',\'' + ie + '\',\'' + (typeof escAttr === 'function' ? escAttr(gid) : gid) + '\')" style="width:30px;height:30px;margin-right:4px;border:1px solid rgba(15,26,46,0.2);background:#fff;color:var(--navy);font-size:16px;font-weight:700;cursor:pointer;vertical-align:middle;border-radius:2px;line-height:1;">' + (collapsed ? '+' : '−') + '</button>' +
          '<span draggable="true" style="cursor:grab;color:var(--gray-500);padding:4px 8px 4px 2px;user-select:none;display:inline-block;" title="Drag here to move group" ondragstart="invoiceRowDragStart(\'' + pe + '\',\'' + ie + '\',' + idx + ')">⋮⋮</span>' +
          '<div style="flex:1;min-width:240px;">' + groupDisplayHtml + '</div>' +
          '<button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation();removeInvoiceCustomGroup(\'' + pe + '\',\'' + ie + '\',' + idx + ')">Ungroup</button>' +
          '</div></td></tr>'
        );
        continue;
      }
      var numLabel;
      if (openGroupGid && item.groupId === openGroupGid) {
        sub++;
        numLabel = section + '.' + sub;
      } else {
        openGroupGid = null;
        section++;
        numLabel = String(section);
      }
      var collKeyRow = pid + '|' + iid + '|' + (item.groupId || '');
      var trStyle = (item.groupId && window._invoiceCollapsedGroups && window._invoiceCollapsedGroups[collKeyRow]) ? 'display:none;' : '';
      var qty = parseFloat(item.qty) || 1;
      var cost = parseFloat(item.cost) || 0;
      var markupPct = parseFloat(item.markupPct) || 0;
      var shipping = parseFloat(item.shipping) || 0;
      var lineTotal = invLineAmt(item);
      var curRoom = String(item.room || '').trim();
      var roomOpts = '<option value="">— Room —</option>';
      if (curRoom && rooms.indexOf(curRoom) < 0) {
        roomOpts += '<option value="' + (typeof escAttr === 'function' ? escAttr(curRoom) : curRoom) + '" selected>' + esc(curRoom) + '</option>';
      }
      for (var ri = 0; ri < rooms.length; ri++) {
        var r = rooms[ri];
        roomOpts += '<option value="' + (typeof escAttr === 'function' ? escAttr(r) : r) + '"' + (r === curRoom ? ' selected' : '') + '>' + esc(r) + '</option>';
      }
      var lineTagTxt = typeof cchLineTagExplicit === 'function' ? cchLineTagExplicit(item) : String(item.lineTag || '').trim();
      var clientNoteTxt = typeof cchLineNotesBodyText === 'function'
        ? cchLineNotesBodyText(item)
        : (typeof cchStripDateOnlyNoteLines === 'function'
          ? cchStripDateOnlyNoteLines(String(item.lineNotes || '').trim())
          : String(item.lineNotes || '').trim());
      var thumbHtml = (function() {
        var _tu = typeof getProposalLineHeroImageUrl === 'function' ? getProposalLineHeroImageUrl(item) : String(item.imageUrl || '').trim();
        if (!_tu) {
          return typeof cchLineIconPlaceholderHtml === 'function'
            ? cchLineIconPlaceholderHtml(item, 48)
            : '<div style="width:48px;height:48px;background:var(--gray-50);display:flex;align-items:center;justify-content:center;font-size:20px;">📦</div>';
        }
        return '<img src="' + (typeof _escImgSrcAttr === 'function' ? _escImgSrcAttr(_tu) : escAttr(_tu)) + '" style="width:48px;height:48px;object-fit:cover;vertical-align:middle;" onerror="this.outerHTML=\'<span style=font-size:20px>📦</span>\';">';
      })();
      var noteBtnHtml = '<button type="button" class="btn btn-sm" style="padding:4px 7px;font-size:10px;line-height:1.1;min-width:58px;color:#0F1A2E;border:1px solid rgba(15,26,46,0.12);background:#fff;" onclick="event.stopPropagation();toggleInvoiceLineNotes(' + idx + ')">' + (clientNoteTxt ? 'Notes ▾' : '+ Notes') + '</button>';
      var noteRowHtml = '<tr id="invLineNotesRow' + idx + '" class="inv-line-notes-row" style="display:none;background:#F4F6FA;">' +
        '<td colspan="' + tableColspan + '" style="padding:10px 12px;">' +
        '<div style="display:grid;grid-template-columns:120px minmax(0,1fr) auto;gap:10px;align-items:start;">' +
        '<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#5C6B80;font-weight:700;padding-top:8px;">Line notes</div>' +
        '<textarea id="invLineNotesText' + idx + '" class="form-textarea" rows="3" placeholder="Notes under this line on client view / print." style="min-height:64px;font-size:12px;">' + esc(clientNoteTxt) + '</textarea>' +
        '<div style="display:flex;gap:6px;"><button type="button" class="btn btn-primary btn-sm" onclick="event.stopPropagation();saveInvoiceLineNotes(\'' + pe + '\',\'' + ie + '\',' + idx + ')">Save</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation();toggleInvoiceLineNotes(' + idx + ')">Close</button></div>' +
        '</div></td></tr>';
      var isTaxable = typeof window.cchInvoiceLineIsTaxable === 'function' ? window.cchInvoiceLineIsTaxable(item) : (item.taxable !== false);
      rows.push(
        '<tr style="' + trStyle + '" data-idx="' + idx + '"' +
        ' ondragover="event.preventDefault();this.classList.add(\'prop-drag-over\');" ondragleave="this.classList.remove(\'prop-drag-over\');"' +
        ' ondrop="invoiceRowDropOn(\'' + pe + '\',\'' + ie + '\',' + idx + ',event)">' +
        '<td draggable="true" style="text-align:center;color:var(--gray-400);cursor:grab;padding:6px;width:28px;" ondragstart="invoiceRowDragStart(\'' + pe + '\',\'' + ie + '\',' + idx + ')">⋮⋮</td>' +
        '<td style="text-align:center;padding:4px;"><input type="checkbox" class="invBulkSelectCb" data-idx="' + idx + '" onclick="event.stopPropagation()" onchange="invBulkUpdateGroupBtnState()"></td>' +
        '<td style="font-size:11px;font-weight:600;color:var(--gray-500);text-align:center;width:32px;">' + esc(numLabel) + '</td>' +
        '<td style="padding:4px;width:54px;">' + thumbHtml + '</td>' +
        '<td class="prop-item-cell"><strong style="font-size:12px;display:block;">' + esc(item.title || 'Untitled') + '</strong>' +
          '<span style="font-size:11px;color:var(--gray-400);">' + esc((item.description || '').substring(0, 80)) + '</span></td>' +
        '<td style="font-size:12px;padding:4px;"><input class="form-input" style="font-size:11px;padding:3px 4px;width:100%;box-sizing:border-box;" value="' + escAttr(item.vendor || '') + '" onchange="updateProposalItemField(\'' + pe + '\',\'' + ie + '\',' + idx + ',\'vendor\',this.value)"></td>' +
        '<td style="font-size:12px;padding:4px;"><select class="form-input" style="font-size:10px;padding:2px;width:100%;box-sizing:border-box;" onchange="updateProposalItemField(\'' + pe + '\',\'' + ie + '\',' + idx + ',\'room\',this.value)">' + roomOpts + '</select></td>' +
        '<td style="text-align:center;padding:4px;"><input class="form-input" style="font-size:11px;font-weight:700;padding:3px;width:48px;text-align:center;box-sizing:border-box;" value="' + escAttr(lineTagTxt) + '" maxlength="32" placeholder="—" onchange="updateProposalItemField(\'' + pe + '\',\'' + ie + '\',' + idx + ',\'lineTag\',this.value)"></td>' +
        '<td style="text-align:center;padding:4px;">' + noteBtnHtml + '</td>' +
        '<td class="amount" style="font-size:12px;padding:4px;text-align:right;"><input type="text" inputmode="decimal" class="form-input cch-no-spin" style="font-size:11px;padding:3px;width:44px;text-align:right;" value="' + qty + '" onchange="updateProposalItemField(\'' + pe + '\',\'' + ie + '\',' + idx + ',\'qty\',this.value)"></td>' +
        '<td class="amount" style="font-size:12px;padding:4px;text-align:right;"><input type="text" inputmode="decimal" class="form-input cch-no-spin" style="font-size:11px;padding:3px;width:58px;text-align:right;" value="' + (cost > 0 ? cost.toFixed(2) : '') + '" onchange="updateProposalItemField(\'' + pe + '\',\'' + ie + '\',' + idx + ',\'cost\',this.value||0)"></td>' +
        '<td class="amount" style="font-size:12px;padding:4px;text-align:right;"><input type="text" inputmode="decimal" class="form-input cch-no-spin" style="font-size:11px;padding:3px;width:44px;text-align:right;color:var(--green);" value="' + (markupPct || '') + '" onchange="updateProposalItemField(\'' + pe + '\',\'' + ie + '\',' + idx + ',\'markupPct\',this.value||0)"></td>' +
        '<td class="amount" style="font-size:12px;padding:4px;text-align:right;"><input type="text" inputmode="decimal" class="form-input cch-no-spin" style="font-size:11px;padding:3px;width:52px;text-align:right;" value="' + (shipping > 0 ? shipping.toFixed(2) : '') + '" onchange="updateProposalItemField(\'' + pe + '\',\'' + ie + '\',' + idx + ',\'shipping\',this.value||0)"></td>' +
        '<td style="text-align:center;padding:4px;">' + (isTaxable ? '<span style="color:#5FA56B;font-weight:700;">✓</span>' : '—') + '</td>' +
        '<td class="amount prop-col-total" style="padding:4px;text-align:right;font-weight:600;">' + formatMoney(lineTotal) + '</td>' +
        '<td class="prop-sticky-actions" style="text-align:center;white-space:nowrap;padding:6px 4px;">' +
          '<button type="button" class="btn btn-sm" style="padding:3px 6px;font-size:11px;" onclick="event.stopPropagation();editInvoiceItem(\'' + pe + '\',\'' + ie + '\',' + idx + ')" title="Edit images &amp; details">✏️</button>' +
        '</td></tr>' + noteRowHtml
      );
    }

    var _invT = typeof window.invoiceViewTotals === 'function'
      ? window.invoiceViewTotals(docData, items, projData)
      : { subtotal: 0, totalShipping: 0, tax: 0, grandTotal: 0, taxRate: 0 };

    var bulkBar = '<div style="margin-bottom:14px;display:flex;flex-wrap:wrap;gap:12px;align-items:center;" onclick="event.stopPropagation()">' +
      '<div class="inv-bulk-wrap" style="position:relative;display:inline-block;">' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="event.stopPropagation();toggleInvBulkDd(this)">Bulk Actions ▾</button>' +
      '<div class="inv-bulk-dd" style="display:none;position:absolute;left:0;top:100%;margin-top:4px;min-width:260px;background:#fff;border:1px solid rgba(15,26,46,0.12);box-shadow:0 8px 24px rgba(0,0,0,0.12);z-index:130;padding:4px 0;" onclick="event.stopPropagation()">' +
      '<button type="button" style="display:block;width:100%;text-align:left;padding:9px 14px;border:none;background:#fff;cursor:pointer;font-size:13px;color:#0F1A2E;" onmouseover="this.style.background=\'#F4F6FA\'" onmouseout="this.style.background=\'#fff\'" onclick="invBulkCloseAll();setAllInvoiceLinesRoom(\'' + pe + '\',\'' + ie + '\')">Set room for all lines…</button>' +
      '<div style="border-top:1px solid rgba(15,26,46,0.08);margin:4px 0;"></div>' +
      '<button type="button" id="invBulkGroupBtn" disabled style="opacity:0.45;pointer-events:none;display:block;width:100%;text-align:left;padding:9px 14px;border:none;background:#fff;cursor:not-allowed;font-size:13px;color:#0F1A2E;" onmouseover="if(!this.disabled)this.style.background=\'#F4F6FA\'" onmouseout="this.style.background=\'#fff\'" onclick="if(this.disabled)return;invBulkCloseAll();createInvoiceGroupFromSelection(\'' + pe + '\',\'' + ie + '\')">Create group from selected…</button>' +
      '</div></div>' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="createInvoiceGroupFromSelection(\'' + pe + '\',\'' + ie + '\')">Create group from selected rows</button>' +
      '<span style="font-size:12px;color:var(--gray-500);">Drag <strong>⋮⋮</strong> to reorder · \u270F\uFE0F opens full line editor (images, markup)</span>' +
      '</div>' +
      '<style>.prop-drag-over{outline:2px dashed #1B3352;outline-offset:-2px;background:rgba(27,51,82,0.04);}</style>';

    var thead = '<thead><tr>' +
      '<th style="width:24px;" title="Drag"></th><th style="width:28px;" title="Select"></th><th style="width:32px;">#</th>' +
      '<th style="width:54px;">IMG</th><th style="min-width:18%;">ITEM</th><th>VENDOR</th><th>ROOM</th>' +
      '<th style="width:52px;text-align:center;">Tag</th><th style="width:64px;">Notes</th>' +
      '<th class="amount">QTY</th><th class="amount">COST</th><th class="amount">Mkup %</th><th class="amount">SHIP</th>' +
      '<th style="width:42px;text-align:center;">TAX</th><th class="amount">TOTAL</th><th style="width:44px;"></th></tr></thead>';

    var tableHtml = items.length
      ? bulkBar + '<div id="invoiceManageArea" data-cch-invoice-manage="1" class="proposal-table-wrap proposal-landing-manage-border"><table class="data-table" style="margin-bottom:0;" ondragover="event.preventDefault()">' + thead + '<tbody>' + rows.join('') + '</tbody></table></div>'
      : '<div style="padding:32px;text-align:center;color:var(--gray-400);">No line items. Use <strong>Edit line items</strong> to add products.</div>';

    var dsEditorHtml = (_isDsManage && typeof window.cchBuildDsEditor === 'function')
      ? window.cchBuildDsEditor(docData, pid, iid)
      : '';

    /* Doc note block (Summary / Document Tags / Memo) — editable on Manage; was only on Edit / old view. */
    var tagsMemoHtml = (typeof window.cchDocTagsMemoBlockHTML === 'function')
      ? window.cchDocTagsMemoBlockHTML(docData, {
          editable: true,
          projectId: pid,
          docId: iid,
          collection: 'invoices',
          hint: '<strong>Summary</strong> and <strong>Document Tags</strong> show on the project Invoices list &amp; email subject. <strong>Memo</strong> is internal only (doc note). Saves when you leave the field.'
        })
      : '';

    if (typeof window.cchInvoiceRouteIs === 'function' && !window.cchInvoiceRouteIs(pid, iid)) return;
    T.innerHTML =
      '<div class="cch-doc-view-page">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;gap:10px;">' +
          '<div><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#9CA3AF;">Invoice · Manage</span>' +
          '<h1 style="font-size:18px;font-weight:700;margin:4px 0 0;">' + esc(docNum) + '</h1>' +
          '<div style="font-size:11px;color:var(--gray-400);">' + esc(projName) +
            (_isDsManage ? ' · <span style="color:#5C6B80;">Working table + client summary editor — use <strong>Client View</strong> for the gift layout</span>' : '') +
          '</div></div>' +
          '<button type="button" class="btn btn-primary btn-sm" style="background:#1B3352;color:#EDE8E0;" onclick="cchEnterDocEditMode(\'' + cchEscJsStr(pid) + '\',\'' + cchEscJsStr(iid) + '\',\'invoice\')">\u270F\uFE0F Edit line items</button>' +
        '</div>' +
        dsEditorHtml +
        tagsMemoHtml +
        tableHtml +
        (typeof window.cchDocAttachmentsSectionHtml === 'function'
          ? window.cchDocAttachmentsSectionHtml(pid, collection, iid, docData)
          : '') +
        '<div style="margin-top:20px;display:flex;justify-content:flex-end;">' +
          '<div style="min-width:260px;text-align:right;">' +
            '<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--gray-500);margin-bottom:4px;"><span>Subtotal</span><span>' + formatMoney(_invT.subtotal) + '</span></div>' +
            '<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--gray-500);margin-bottom:4px;"><span>Shipping</span><span>' + formatMoney(_invT.totalShipping) + '</span></div>' +
            '<div style="display:flex;justify-content:space-between;font-size:13px;color:var(--gray-500);margin-bottom:4px;"><span>Tax</span><span>' + formatMoney(_invT.tax) + '</span></div>' +
            (typeof window.invoiceTotalsCreditsFlexHtml === 'function' ? window.invoiceTotalsCreditsFlexHtml(_invT) : '') +
            '<div style="display:flex;justify-content:space-between;font-size:18px;font-weight:700;padding-top:8px;border-top:2px solid var(--navy);"><span>Total</span><span>' + formatMoney(_invT.grandTotal) + '</span></div>' +
            (function() {
              if (invVoidEarly || typeof window.invoiceDocPaymentSummary !== 'function') return '';
              var ps = window.invoiceDocPaymentSummary(docData, _invT.grandTotal, 'invoice');
              if (!ps || ps.totalPaid <= 0.01) return '';
              var bal = ps.balance != null ? ps.balance : Math.max(0, _invT.grandTotal - ps.totalPaid);
              return '<div style="display:flex;justify-content:space-between;font-size:13px;color:#2E7D32;margin-top:6px;padding-top:6px;border-top:1px solid rgba(27,51,82,0.08);"><span>Paid</span><span style="font-family:var(--font-mono);">-' + formatMoney(ps.totalPaid) + '</span></div>' +
                '<div style="display:flex;justify-content:space-between;font-size:16px;font-weight:700;color:' + (bal <= 0.01 ? '#2E7D32' : 'var(--gold)') + ';margin-top:4px;"><span>Balance</span><span style="font-family:var(--font-mono);">' + formatMoney(bal) + '</span></div>';
            })() +
          '</div></div>' +
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

      var rate = typeof cchPrompt === 'function' ? await cchPrompt(msg, String(current || ''), 'Project tax rate') : null;
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
      if (typeof cchAlert === 'function') await cchAlert('Error: ' + e.message, 'Tax rate');
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

      var rate = typeof cchPrompt === 'function' ? await cchPrompt(msg, String(docRate || projRate || ''), 'Document tax rate') : null;
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
        var _updProj = typeof cchConfirm === 'function' && (await cchConfirm('Also update the project default tax rate to ' + parsed + '%?\n\n(Current project rate: ' + projRate + '%. New invoices/proposals will inherit this.)', 'Tax rate', { confirmText: 'Update project default' }));
        if (_updProj) {
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
      return et === 'shipping' || et === 'sales_tax' || et === 'discount' || et === 'retainer_credit' || et === 'handling';
    }
    function _invIsLaborLikeLine(it) {
      if (!it) return false;
      var et = String(it.expenseType || '').toLowerCase();
      var itype = String(it.itemType || '').toLowerCase();
      if (et === 'labor' || et === 'installation') return true;
      if (itype === 'labor' || itype === 'installation') return true;
      var txt = (
        String(it.service || '') + ' ' +
        String(it.billingCategory || '') + ' ' +
        String(it.title || it.name || '') + ' ' +
        String(it.description || '') + ' ' +
        String(it.category || '')
      ).toLowerCase();
      return /\b(labor|labour|install|installation|wallpaper installation|tile installation|mounting|site install)\b/.test(txt);
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
      if (_invIsLaborLikeLine(it)) return false;
      var room = String((it && it.room) || '').trim().toLowerCase();
      // If a line is assigned to a real room, keep it in room grouping (unless it's explicit time-billing room).
      if (room && room !== 'time billing' && room !== 'time-billing' && room !== 'time track' && room !== 'time tracking') return false;
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
        var k = (_invIsExplicitProduct(it) || _invIsLaborLikeLine(it))
          ? _sanitizeProductGroupKey(it)
          : FEES_SECTION;
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
    /** Hide auto-generated "X hours — design services" on time-invoice lines when dated notes exist. */
    window.invoiceSuppressGenericServiceDescription = function(desc, it) {
      var d = String(desc || '').trim();
      if (!d) return '';
      var low = d.toLowerCase();
      if (/^design\s+services\s*$/.test(low)) return '';
      if (/^\d+(\.\d+)?\s*hours?\s*([\u2014—\-]\s*)?design\s+services\s*$/.test(low)) return '';
      if (/^\d+(\.\d+)?\s*hours?\s*$/.test(low)) {
        var notes = String((it && (it.lineNotes || it.notes)) || '').trim();
        if (notes) return '';
      }
      return d;
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

    /** Job site / project address (Edit Project → structured project fields). */
    window.cchProjectAddressFromData = function(proj, docData) {
      proj = proj || {};
      docData = docData || {};
      var merged = {
        projectAddressLine1: docData.projectAddressLine1 || proj.projectAddressLine1 || '',
        projectAddress2: docData.projectAddress2 || proj.projectAddress2 || '',
        projectCity: docData.projectCity || proj.projectCity || '',
        projectState: docData.projectState || proj.projectState || '',
        projectZip: docData.projectZip || proj.projectZip || '',
        projectAddress: docData.projectAddress || proj.projectAddress || '',
        address: docData.address || proj.address || proj.siteAddress || proj.jobSiteAddress || ''
      };
      if (typeof window.cchProjectAddressPartsFromBoard === 'function' && typeof window.cchComposeAddressMultiline === 'function') {
        var boardParts = window.cchProjectAddressPartsFromBoard(merged);
        var fromBoard = window.cchComposeAddressMultiline(boardParts);
        if (fromBoard) return fromBoard;
      }
      if (typeof window.cchComposeAddressMultiline === 'function' && typeof window.cchAddressPartsFromRecord === 'function') {
        var parts = window.cchAddressPartsFromRecord(merged, 'project');
        if (typeof window.cchCoerceStructuredAddressParts === 'function') parts = window.cchCoerceStructuredAddressParts(parts);
        var composed = window.cchComposeAddressMultiline(parts);
        if (composed) return composed;
      }
      return String(
        docData.projectAddress || docData.jobSiteAddress || docData.siteAddress ||
        proj.projectAddress || proj.address || proj.siteAddress || proj.jobSiteAddress || ''
      ).trim();
    };

    /** Bill To: client name + billing address (+ phone/email). Job site belongs in Project column only. */
    window.buildPremiumBillToHtml = function(clientName, clientAddress, clientPhone, clientEmail, clientCompany, clientAddress2, projectAddress) {
      var fullName = (clientName || '').trim();
      var billAddr = (clientAddress || '').trim();
      var addrRaw = billAddr;
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
      if (fullName) parts.push('<strong style="font-size:13px;display:block;margin-bottom:3px;">' + esc(fullName) + '</strong>');
      if (co) parts.push('<div style="font-size:12px;color:#5C6B80;margin-top:0;margin-bottom:3px;">' + esc(co) + '</div>');
      if (addrRaw) parts.push('<div style="color:#5C6B80;line-height:1.4;font-size:12px;">' + esc(addrRaw).replace(/\n/g, '<br>') + '</div>');
      else if (addr2) parts.push('<div style="color:#5C6B80;line-height:1.4;font-size:12px;margin-top:2px;">' + esc(addr2).replace(/\n/g, '<br>') + '</div>');
      var contactBits = [];
      if ((clientPhone || '').trim()) contactBits.push('<div class="bill-to-contact" style="margin-top:4px;font-size:10px;color:#5C6B80;line-height:1.35;font-weight:400;">\u260E ' + esc((clientPhone || '').trim()) + '</div>');
      if ((clientEmail || '').trim()) contactBits.push('<div class="bill-to-contact" style="margin-top:2px;margin-bottom:2px;font-size:10px;color:#5C6B80;line-height:1.35;font-weight:400;">\u2709 ' + esc((clientEmail || '').trim()) + '</div>');
      if (contactBits.length) parts.push(contactBits.join(''));
      return parts.length ? parts.join('') : '<span style="color:#bbb;font-size:12px;">Add <strong>client name &amp; billing address</strong> in Edit Project or link a Client record.</span>';
    };
  })();

  // ============================================================
  // 32. PREMIUM PREVIEW — Navy/gold luxury design + taxable column + tear sheets
  // ============================================================
  var _origPreviewDocument = window.previewDocument;
  window.previewDocument = async function(type, projectId, docId) {
    var collection = type === 'invoice' ? 'invoices' : type === 'po' ? 'purchaseOrders' : 'proposals';
    var typeLabel = type === 'invoice' ? 'Invoice' : type === 'po' ? 'Purchase Order' : 'Proposal';

    // Open synchronously on user click — async Firestore fetch before window.open is blocked on client portal (mobile Safari, etc.).
    var previewWin = window.open('', '_blank');
    if (!previewWin) {
      if (typeof showToast === 'function') showToast('Pop-up blocked — allow pop-ups for this site', 'error');
      else if (typeof cchAlert === 'function') await cchAlert('Pop-up blocked — allow pop-ups for this site', typeLabel);
      return;
    }
    try {
      previewWin.document.open();
      previewWin.document.write(
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Loading ' + typeLabel + '…</title>' +
        '<style>body{font-family:"DM Sans",sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;color:#1B3352;background:#FAFAFA;}' +
        '.ld{text-align:center;} .ld p{margin:12px 0 0;font-size:14px;color:#6B7280;}</style></head>' +
        '<body><div class="ld"><div style="font-size:28px;font-weight:600;color:#C4A464;">CCH</div>' +
        '<p>Loading ' + typeLabel + '…</p></div></body></html>'
      );
      previewWin.document.close();
    } catch (_pwLoad) {}

    // Save any unsaved edits first
    if (window._docEdit && window._docEdit.docId === docId && window._docEdit.projectId === projectId) {
      try {
        if (typeof window.docEditSyncLineItemsFromDom === 'function') window.docEditSyncLineItemsFromDom();
        await window.docEditSave();
      } catch(e) {}
    }

    var docData = null, items = [];

    try {
      var doc = await db.collection('boards').doc(projectId).collection(collection).doc(docId).get();
      if (doc.exists) { docData = { id: doc.id, ...doc.data() }; items = docData.items || []; }
    } catch(e) {}

    if (!docData) {
      try {
        previewWin.document.open();
        previewWin.document.write(
          '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + typeLabel + ' not found</title></head>' +
          '<body style="font-family:sans-serif;padding:48px;color:#1B3352;"><h1>' + typeLabel + ' not found</h1>' +
          '<p>This document may have been removed or you may not have access.</p></body></html>'
        );
        previewWin.document.close();
      } catch (_pwMiss) {}
      return;
    }

    var proj = {};
    try { var pd = await db.collection('boards').doc(projectId).get(); if (pd.exists) proj = pd.data(); } catch(e) {}

    if (type === 'invoice' && typeof window.cchWriteDesignServicesPreviewWindow === 'function' &&
        typeof window.cchInvoiceUsesDesignServicesLayout === 'function' &&
        window.cchInvoiceUsesDesignServicesLayout(docData, items)) {
      window.cchWriteDesignServicesPreviewWindow(previewWin, docData, items, proj, projectId, docId);
      return;
    }

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
      docData.streetAddress || docData.address || docData.clientAddressLine1 ||
      proj.clientAddress || proj.billingAddress || proj.mailingAddress ||
      proj.streetAddress || proj.address || proj.clientAddressLine1 ||
      (crm && (crm.address || crm.primaryAddress || crm.clientAddressLine1 || crm.billingAddress || crm.mailingAddress || crm.streetAddress)) || '';
    var clientCompany = docData.clientCompany || proj.clientCompany || (crm && crm.company) || '';
    var clientAddress2 = docData.clientAddress2 || docData.secondaryAddress ||
      proj.clientAddress2 || proj.secondaryAddress || (crm && (crm.address2 || crm.secondaryAddress || crm.clientAddress2)) || '';
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

    var shipToDisplay = String(docData.shipToAddress || '').trim() || shipToRaw;
    if (type === 'po' && typeof window.resolvePOShipToDisplayText === 'function') {
      try {
        var projForShip = Object.assign({}, proj);
        if (crm) {
          projForShip.clientName = projForShip.clientName || crm.name || crm.fullName || '';
          projForShip.clientAddress = projForShip.clientAddress || crm.address || crm.primaryAddress || crm.clientAddressLine1 || crm.billingAddress || crm.mailingAddress || crm.streetAddress || '';
          projForShip.clientAddress2 = projForShip.clientAddress2 || crm.address2 || crm.secondaryAddress || crm.clientAddress2 || '';
          projForShip.billingAddress = projForShip.billingAddress || crm.billingAddress || '';
          projForShip.mailingAddress = projForShip.mailingAddress || crm.mailingAddress || '';
        }
        var _shipResolved = window.resolvePOShipToDisplayText(shipToRaw, projForShip, docData);
        if (_shipResolved && String(_shipResolved).trim()) shipToDisplay = String(_shipResolved).trim();
      } catch (_eShipRes) {}
    }

    var vendorAddrPremium = String(docData.vendorAddress || '').trim();
    if (type === 'po' && !vendorAddrPremium && docData.vendor && typeof window.cchPoVendorAddressResolved === 'function') {
      try {
        vendorAddrPremium = await window.cchPoVendorAddressResolved(docData);
      } catch (_eVenPrem) {}
    }
    var vendorContactPremium = null;
    if (type === 'po' && docData.vendor && typeof window.cchPoVendorContactResolved === 'function') {
      try {
        vendorContactPremium = await window.cchPoVendorContactResolved(docData);
      } catch (_eVenContactPrem) { vendorContactPremium = null; }
    }

    var docNum = docData.invoiceNum || docData.number || docData.proposalNum || docData.name || docId.slice(0,8);
    var docDate = type === 'po'
      ? (docData.date || docData.issueDate || docData.orderDate || docData.poDate || docData.createdAt || '')
      : (docData.date || docData.createdAt || '');
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
    var taxRate = (typeof window.cchDocumentSalesTaxRate === 'function')
      ? window.cchDocumentSalesTaxRate(type, docData, proj)
      : (parseFloat(docData.taxRate) || parseFloat(proj.taxRate) || 0);

    // Group items by per-document mode (room/category) to match on-screen view + output generation.
    var docGroupMode = (typeof window.cchDocGroupModeForData === 'function')
      ? window.cchDocGroupModeForData(docData, type)
      : 'room';
    var grouped = (typeof window.cchGroupDocumentItems === 'function')
      ? window.cchGroupDocumentItems(items, type, docGroupMode)
      : {};
    var _premiumGroupKeys = (typeof window.cchOrderedDocumentGroupKeys === 'function')
      ? window.cchOrderedDocumentGroupKeys(grouped, items, type, docGroupMode)
      : Object.keys(grouped);

    // Build items table with taxable column
    var itemsHtml = '';
    var subtotal = 0, taxableSubtotal = 0, totalShipping = 0;
    // Show thumbnails on invoices/proposals — PO vendor print is compact text table (no tear-sheet layout).
    var _showPremiumImgCol = type !== 'po';
    var _premiumGroupColSpan = type === 'po' ? 6 : type === 'invoice' ? 5 : 6;
    var _hasProposalSectionGroups = type === 'proposal' && items.some(function(it) { return it && it.lineKind === 'group'; });
    /** One Item column (thumb + text in a grid) — avoids squeezing text when tag/notes add height. */
    var _premiumColgroup = '';
    if (type === 'invoice') {
      _premiumColgroup = '<colgroup><col class="pc-item"><col class="pc-qty"><col class="pc-money"><col class="pc-money"><col class="pc-tax"><col class="pc-money"></colgroup>';
    } else if (type === 'po') {
      _premiumColgroup = '<colgroup><col class="pc-item"><col class="pc-sidemark"><col class="pc-qty"><col class="pc-money"><col class="pc-money"><col class="pc-money"></colgroup>';
    } else {
      _premiumColgroup = '<colgroup><col class="pc-item"><col class="pc-qty"><col class="pc-money"><col class="pc-money"><col class="pc-tax"><col class="pc-money"></colgroup>';
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

    /** Invoice/proposal preview/PDF: lineTag + lineNotes body (no vendor under item). */
    function _invoicePreviewTagNotesHtml(it) {
      it = it || {};
      var isSvc = it.expenseType === 'service' || it.itemType === 'service';
      if (type === 'invoice' && typeof window.cchInvoiceLineUseServiceStyleInView === 'function' && window.cchInvoiceLineUseServiceStyleInView(it)) {
        isSvc = true;
      }
      /* Invoices: never promote a short note into "TAG" — only an explicit lineTag field. */
      var tagLine = (type === 'invoice' || isSvc)
        ? ((typeof window.cchLineTagExplicit === 'function') ? window.cchLineTagExplicit(it) : String(it.lineTag || '').trim())
        : ((typeof window.cchLineTagText === 'function') ? window.cchLineTagText(it) : '');
      var notesBody = '';
      if (type === 'invoice') {
        notesBody = (typeof window.cchLineExplicitNotesText === 'function')
          ? window.cchLineExplicitNotesText(it)
          : String(it.lineNotes || it.notes || '').trim();
        if (notesBody && typeof window.cchStripDateOnlyNoteLines === 'function') {
          notesBody = window.cchStripDateOnlyNoteLines(notesBody);
        }
      } else {
        notesBody = (typeof window.cchLineNotesBodyText === 'function') ? window.cchLineNotesBodyText(it) : '';
      }
      if (type === 'invoice' && typeof window.sanitizeInvoicePreviewLineText === 'function') {
        if (tagLine) tagLine = window.sanitizeInvoicePreviewLineText(tagLine);
        if (notesBody) notesBody = window.sanitizeInvoicePreviewLineText(notesBody);
      }
      if (type === 'invoice' || isSvc) {
        if (tagLine && /^\d{4}-\d{2}-\d{2}\b/.test(String(tagLine).trim())) tagLine = '';
        if (notesBody && typeof window.cchStripDateOnlyNoteLines === 'function') {
          notesBody = window.cchStripDateOnlyNoteLines(notesBody);
        }
        var htmlInv = '';
        if (tagLine) {
          htmlInv += '<div class="prop-line-detail-stack" style="margin-top:6px;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#C4A464;font-weight:700;">Tag</div>' +
            '<div class="item-desc item-desc-multiline line-notes" style="font-weight:600;">' + esc(tagLine) + '</div></div>';
        }
        if (!notesBody) return htmlInv;
        var noteLines = String(notesBody).split(/\r?\n/).map(function(l) { return l.trim(); }).filter(Boolean);
        if (noteLines.length === 1) {
          htmlInv += '<div class="item-desc item-desc-multiline line-notes" style="margin-top:6px;">' + esc(noteLines[0]) + '</div>';
        } else if (noteLines.length > 1) {
          htmlInv += '<ul class="line-notes-ul" style="margin-top:6px;">' + noteLines.map(function(l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>';
        }
        return htmlInv;
      }
      if (!tagLine && !notesBody) return '';
      var html = '';
      if (tagLine) {
        html += '<div class="prop-line-detail-stack" style="margin-top:6px;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#C4A464;font-weight:700;">Tag</div>' +
          '<div class="item-desc item-desc-multiline line-notes" style="font-weight:600;">' + esc(tagLine) + '</div></div>';
      }
      if (notesBody) {
        var nLines = String(notesBody).split(/\r?\n/).map(function(l) { return l.trim(); }).filter(Boolean);
        html += '<div class="prop-line-detail-stack" style="margin-top:4px;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#C4A464;font-weight:700;">Notes</div>';
        if (nLines.length === 1) {
          html += '<div class="item-desc item-desc-multiline line-notes">' + esc(nLines[0]) + '</div>';
        } else {
          html += '<ul class="line-notes-ul">' + nLines.map(function(l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>';
        }
        html += '</div>';
      }
      return html;
    }

    /** Gray column header — from shared cchInvoiceLineKind only (no title heuristics). */
    function _premiumInvoiceColLabel(catItems) {
      var kinds = {};
      (catItems || []).forEach(function(it) {
        if (!it) return;
        if (typeof isProposalGroupHeaderItem === 'function' && isProposalGroupHeaderItem(it)) return;
        var k = (typeof window.cchInvoiceLineKind === 'function') ? window.cchInvoiceLineKind(it) : 'other';
        var bucket = 'item';
        if (k === 'prepaid_tax') bucket = 'tax';
        else if (k === 'product') bucket = 'product';
        else if (k === 'service') bucket = 'service';
        else if (k === 'expense_product') bucket = 'expense';
        kinds[bucket] = (kinds[bucket] || 0) + 1;
      });
      var keys = Object.keys(kinds);
      if (keys.length === 1) {
        if (keys[0] === 'expense') return 'Expense';
        if (keys[0] === 'product') return 'Product';
        if (keys[0] === 'tax') return 'Tax';
        if (keys[0] === 'service') return 'Design Fee';
      }
      return 'Item';
    }

    /** Vendor PO PDF sidemark — line tag only (room is not shown on vendor PO print). */
    function _poVendorSidemarkText(it) {
      it = it || {};
      var tag = (typeof window.cchLineTagText === 'function') ? String(window.cchLineTagText(it) || '').trim() : '';
      if (!tag) tag = String(it.lineTag || it.lineTagCode || it.fixtureTag || '').trim();
      return tag;
    }

    function _premiumAppendLineRow(it, groupLabel) {
      /* Vendor Pre-Paid Sales Tax is totals-only (under Tax) — never a SERVICE body line. */
      if (type === 'invoice' && typeof window.cchIsVendorPrepaidSalesTaxLine === 'function' && window.cchIsVendorPrepaidSalesTaxLine(it)) {
        return;
      }
      var qty = parseFloat(it.qty) || 1;
      var amt = parseFloat(it.amount) || 0;
      var cost = parseFloat(it.cost) || 0;
      var mkup = parseFloat(it.markupPct) || 0;
      if (type === 'invoice' && typeof invoiceLineIsDesignServicesNoMarkup === 'function' && invoiceLineIsDesignServicesNoMarkup(it)) mkup = 0;
      var ship = parseFloat(it.shipping) || 0;
      var lineAmt = type === 'po'
        ? (typeof window.cchPoLineMerchandiseAmount === 'function'
          ? window.cchPoLineMerchandiseAmount(it)
          : ((cost > 0) ? (cost * qty) : 0))
        : ((type === 'invoice' && typeof window.invoiceLineAmountForTotals === 'function')
          ? window.invoiceLineAmountForTotals(it).lineAmt
          : (cost > 0 ? cost * qty * (1 + mkup / 100) : amt));
      var unitPrice = type === 'po' ? ((cost > 0) ? cost : (qty > 0 ? amt / qty : 0)) : (qty > 0 ? lineAmt / qty : lineAmt);
      var displayLineTotal = lineAmt;
      if (type === 'po') {
        displayLineTotal = (cost > 0 ? (cost * qty + ship) : ship);
        displayLineTotal = Math.round(displayLineTotal * 100) / 100;
      }
      var isTaxable = (typeof window.cchInvoiceLineIsTaxable === 'function') ? window.cchInvoiceLineIsTaxable(it) : (it.taxable !== false && (it.taxable === true || it.expenseType === 'product' || (!it.expenseType && it.taxable !== false)));

      var _skipFooterTaxLine = type === 'invoice' && typeof window.cchIsClientSalesTaxLine === 'function' && window.cchIsClientSalesTaxLine(it);
      var _isCreditLine = type === 'invoice' && typeof window.cchIsCreditLineType === 'function' && window.cchIsCreditLineType(it);
      if (!_skipFooterTaxLine && !_isCreditLine) {
        subtotal += lineAmt;
        if (isTaxable) taxableSubtotal += lineAmt;
      }
      if (!_isCreditLine) totalShipping += ship;

      var isSvc = it.expenseType === 'service' || it.itemType === 'service';
      if (type === 'invoice' && typeof window.cchInvoiceLineUseServiceStyleInView === 'function' && window.cchInvoiceLineUseServiceStyleInView(it)) isSvc = true;
      var imgTag = '';
      if (_showPremiumImgCol) {
        var imgSrc = '';
        if (type === 'invoice' && typeof window.getBestImageUrl === 'function') {
          imgSrc = String(window.getBestImageUrl(it) || '').trim();
        } else if (type === 'invoice' && typeof window.getInvoiceLineDisplayImageUrl === 'function') {
          imgSrc = String(window.getInvoiceLineDisplayImageUrl(it) || '').trim();
        }
        if (!imgSrc && it.imageUrl) imgSrc = String(it.imageUrl).trim();
        if (!imgSrc && typeof _firstCoercedGalleryUrl === 'function') {
          imgSrc = String(_firstCoercedGalleryUrl(it) || '').trim();
        }
        if (!imgSrc && Array.isArray(it.images) && it.images.length) {
          var g0 = it.images[0];
          if (typeof g0 === 'string') imgSrc = g0.trim();
          else if (g0 && (g0.imageUrl || g0.url)) imgSrc = String(g0.imageUrl || g0.url || '').trim();
        }
        if (imgSrc) {
          imgTag = '<img src="' + _escImgSrcAttr(imgSrc) + '" referrerpolicy="no-referrer" onerror="typeof cchImgTryFallbacks===\'function\'&&cchImgTryFallbacks(this)">';
        }
      }
      var imgBlock = '';
      if (_showPremiumImgCol && imgTag) {
        imgBlock = '<div class="cch-premium-item-thumb">' + imgTag + '</div>';
      }
      var _rawNotes = (typeof window.cchLineExplicitNotesText === 'function') ? window.cchLineExplicitNotesText(it) : ((it.lineNotes || '') || '');
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
          periodHtml = '<div class="item-svc-period cch-inv-disp-dates">Service period: ' + esc(p0) + ' – ' + esc(p1) + '</div>';
        } else if (p0) {
          periodHtml = '<div class="item-svc-period cch-inv-disp-dates">Service date: ' + esc(p0) + '</div>';
        }
      }
      var notesUnder = (type === 'invoice' || type === 'proposal') ? _invoicePreviewTagNotesHtml(it) : _lineNotesHtml(_rawNotes);
      if (type === 'invoice' && notesUnder) notesUnder = '<div class="cch-inv-disp-notes">' + notesUnder + '</div>';
      var _poLineNote = (typeof cchLineAdditionalNotesText === 'function')
        ? cchLineAdditionalNotesText(it)
        : (String(it.additionalNotes || it.workroomNote || '').trim());
      var workroomUnder = (type === 'po' && _poLineNote)
        ? '<div class="item-desc item-desc-multiline" style="font-size:11px;color:#5C6B80;font-style:italic;margin-top:4px;">Notes: ' + esc(_poLineNote.substring(0, 400)) + '</div>'
        : '';
      var lineLabel = typeof window.invoiceLineDisplayTitle === 'function' ? window.invoiceLineDisplayTitle(it) : (it.title || it.name || 'Item');
      var descBody = _rawDesc;
      if (descBody && lineLabel && descBody.toLowerCase().indexOf(String(lineLabel).toLowerCase()) === 0) {
        descBody = descBody.slice(lineLabel.length).replace(/^\s*\([^)]*\)\s*/, '').replace(/^\s*[\u2014—\-]\s*/, '').trim();
      }
      if (type === 'invoice' && typeof window.invoiceSuppressGenericServiceDescription === 'function') {
        descBody = window.invoiceSuppressGenericServiceDescription(descBody, it);
      }
      // PO vendor print: SKU / Finish / Dimensions block (reuse on-screen helper) + per-line ship-to.
      var poSpecsUnder = (type === 'po' && typeof window.cchPoLineSpecsBlockHtml === 'function')
        ? window.cchPoLineSpecsBlockHtml(it, { includeDescription: false, omitRoom: true })
        : '';
      var poShipToUnder = '';
      if (type === 'po') {
        var _lineShip = String(it.shipTo || it.deliverTo || '').trim();
        if (_lineShip && Object.keys(_poShipSetForPrint || {}).length > 1) {
          var _lineShipDisp = _lineShip;
          if (typeof window.resolvePOShipToDisplayText === 'function') {
            try {
              var _r = window.resolvePOShipToDisplayText(_lineShip, proj, docData);
              if (_r && String(_r).trim()) _lineShipDisp = String(_r).trim();
            } catch (_eLs) {}
          }
          poShipToUnder = '<div class="cch-po-line-shipto" style="margin-top:6px;font-size:11px;color:#1B7A6B;line-height:1.45;">' +
            '<span style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#C4A464;font-weight:700;">Ship to</span> ' +
            esc(String(_lineShipDisp).replace(/\n/g, ' · ')) + '</div>';
        }
      }
      var itemInner =
        '<div class="cch-premium-item-grid' + (imgBlock ? '' : ' cch-premium-item-grid--no-thumb') + '">' +
          imgBlock +
          '<div class="cch-premium-item-text">' +
            '<strong>' + esc(lineLabel) + '</strong>' +
            poSpecsUnder +
            (type === 'po' ? '' : ('<div class="prop-line-detail-stack">' +
            (descBody ? '<div style="margin-top:6px;"><div style="font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#C4A464;font-weight:700;">Description</div><div class="item-desc item-desc-multiline">' + esc(descBody) + '</div></div>' : '') +
            periodHtml +
            notesUnder +
            '</div>')) +
            workroomUnder +
            poShipToUnder +
            (it.vendor && type !== 'po' && type !== 'invoice' ? '<div class="item-vendor">' + esc(it.vendor) + '</div>' : '') +
          '</div>' +
        '</div>';
      var qtyCell = String(qty);
      var priceCell = formatMoney(unitPrice);
      if (type === 'invoice' && isSvc) {
        qtyCell = '<span class="cch-inv-disp-hours">' + qty + '</span>';
        priceCell = '<span class="cch-inv-disp-rate">' + formatMoney(unitPrice) + '</span>';
      }
      itemsHtml += '<tr><td class="line-item-main">' + itemInner + '</td>' +
        (type === 'po' ? '<td class="sidemark-cell">' + (function() {
          var sm = _poVendorSidemarkText(it);
          return sm ? esc(sm) : '<span style="color:#C4C4C4;">—</span>';
        })() + '</td>' : '') +
        '<td style="text-align:center;">' + qtyCell + '</td>' +
        '<td class="r">' + priceCell + '</td>' +
        '<td class="r ship">' + (ship > 0 ? formatMoney(ship) : '\u2014') + '</td>' +
        (type === 'po' || type === 'invoice' ? '' : '<td style="text-align:center;">' + (isTaxable ? '<span class="tax-yes">✓</span>' : '<span class="tax-no">—</span>') + '</td>') +
        '<td class="r total-cell">' + formatMoney(displayLineTotal) + '</td></tr>';
    }

    var _thItemLabel = type === 'invoice' ? 'Item' : 'Item';
    if (_hasProposalSectionGroups) {
      var _secLabelFlat = (type === 'invoice') ? _premiumInvoiceColLabel(items) : _thItemLabel;
      itemsHtml += '<div class="room-section"><div class="room-header"><span>Items</span><span></span></div>' +
        '<table class="cch-premium-items-table">' + _premiumColgroup + '<thead><tr><th>' + _secLabelFlat + '</th>' +
        (type === 'po' ? '<th>Sidemark</th>' : '') +
        '<th style="text-align:center;">Qty</th>' +
        '<th class="r">Price</th>' +
        '<th class="r">Shipping</th>' +
        (type === 'po' || type === 'invoice' ? '' : '<th style="text-align:center;width:60px;">Tax</th>') +
        '<th class="r">Total</th></tr></thead><tbody>';
      items.forEach(function(it) {
        if (typeof isProposalGroupHeaderItem === 'function' && isProposalGroupHeaderItem(it)) {
          var _grpHtml = typeof proposalGroupHeaderDisplayHtml === 'function'
            ? proposalGroupHeaderDisplayHtml(it, { compact: true })
            : esc(it.title || 'Section');
          itemsHtml += '<tr><td colspan="' + _premiumGroupColSpan + '" style="background:#F4F6FA;padding:10px 8px;border-bottom:1px solid #E8ECF3;">' + _grpHtml + '</td></tr>';
          return;
        }
        _premiumAppendLineRow(it);
      });
      itemsHtml += '</tbody></table></div>';
    } else if (type === 'po') {
      var _flatPoPrint = (items || []).filter(function(it) {
        return !(typeof isProposalGroupHeaderItem === 'function' && isProposalGroupHeaderItem(it));
      });
      itemsHtml += '<table class="cch-premium-items-table cch-po-vendor-pdf">' + _premiumColgroup + '<thead><tr><th>' + _thItemLabel + '</th>' +
        '<th>Sidemark</th>' +
        '<th style="text-align:center;">Qty</th>' +
        '<th class="r">Price</th>' +
        '<th class="r">Shipping</th>' +
        '<th class="r">Total</th></tr></thead><tbody>';
      _flatPoPrint.forEach(function(it) {
        _premiumAppendLineRow(it);
      });
      itemsHtml += '</tbody></table>';
    } else {
      _premiumGroupKeys.forEach(function(cat) {
        var catItems = (grouped[cat] || []).filter(function(it) {
          if (type === 'invoice' && typeof window.cchIsVendorPrepaidSalesTaxLine === 'function' && window.cchIsVendorPrepaidSalesTaxLine(it)) return false;
          return true;
        });
        if (!catItems.length) return;
        var catTotal = catItems.reduce(function(s, i) {
          var a = (type === 'invoice' && typeof window.invoiceLineAmountForTotals === 'function')
            ? window.invoiceLineAmountForTotals(i).lineAmt
            : (parseFloat(i.amount) || 0);
          return s + (parseFloat(a) || 0);
        }, 0);
        var _secLabel = (type === 'invoice') ? _premiumInvoiceColLabel(catItems) : _thItemLabel;
        itemsHtml += '<div class="room-section"><div class="room-header"><span>' + esc(cat) + '</span><span>' + (type === 'po' ? '' : formatMoney(catTotal)) + '</span></div>' +
          '<table class="cch-premium-items-table">' + _premiumColgroup + '<thead><tr><th>' + _secLabel + '</th>' +
          (type === 'po' ? '<th>Sidemark</th>' : '') +
          '<th style="text-align:center;">Qty</th>' +
          '<th class="r">Price</th>' +
          '<th class="r">Shipping</th>' +
          (type === 'po' || type === 'invoice' ? '' : '<th style="text-align:center;width:60px;">Tax</th>') +
          '<th class="r">Total</th></tr></thead><tbody>';

        catItems.forEach(function(it) {
          _premiumAppendLineRow(it, cat);
        });
        itemsHtml += '</tbody></table></div>';
      });
    }

    // Tax calculation
    totalShipping += parseFloat(docData.docShipping) || 0;
    var taxAmt = taxableSubtotal * (taxRate / 100);
    var grandTotal = subtotal + totalShipping + taxAmt;
    var _pdfCredits = [];
    if (type === 'invoice' && typeof window.invoiceViewTotals === 'function') {
      var _pdfT = window.invoiceViewTotals(docData, items, proj);
      subtotal = _pdfT.subtotal;
      taxableSubtotal = _pdfT.taxableSubtotal;
      totalShipping = _pdfT.totalShipping;
      taxRate = _pdfT.taxRate;
      taxAmt = _pdfT.tax;
      grandTotal = _pdfT.grandTotal;
      _pdfCredits = _pdfT.credits || [];
    }
    var paySummaryPdf = (type === 'invoice' && typeof window.invoiceDocPaymentSummary === 'function')
      ? window.invoiceDocPaymentSummary(docData, grandTotal)
      : { rows: (docData.payments || []), totalPaid: (docData.payments || []).reduce(function(s, p) { return s + (parseFloat(p.amount) || 0); }, 0), balance: grandTotal, grandTotal: grandTotal };
    var totalPaid = paySummaryPdf.totalPaid || 0;
    var balancePdf = paySummaryPdf.balance != null ? paySummaryPdf.balance : (grandTotal - totalPaid);
    if (type === 'invoice' && String(docData.status || '').toLowerCase() === 'void') {
      subtotal = 0;
      taxableSubtotal = 0;
      totalShipping = 0;
      taxAmt = 0;
      grandTotal = 0;
      totalPaid = 0;
      balancePdf = 0;
      paySummaryPdf = { rows: [], totalPaid: 0, balance: 0, grandTotal: 0 };
    }

    // Totals HTML — peel vendor Pre-Paid Sales Tax from subtotal for display
    var _pdfPrepaid = (type === 'invoice' && typeof window.cchVendorPrepaidSalesTaxTotal === 'function')
      ? window.cchVendorPrepaidSalesTaxTotal(items) : 0;
    var _subDisp = (_pdfPrepaid > 0.01) ? Math.max(0, (subtotal || 0) - _pdfPrepaid) : subtotal;
    var totalsHtml = '<div class="total-row"><span>Subtotal</span><span>' + formatMoney(_subDisp) + '</span></div>';
    if (totalShipping > 0) totalsHtml += '<div class="total-row"><span>Shipping</span><span>' + formatMoney(totalShipping) + '</span></div>';
    if (type !== 'po') {
      totalsHtml += '<div class="total-row"><span>Sales Tax' + (taxRate > 0 ? ' (' + taxRate + '% on taxable items)' : ' (none set)') + '</span><span>' + formatMoney(taxAmt) + '</span></div>';
      if (_pdfPrepaid > 0.01) totalsHtml += '<div class="total-row" style="color:#E16A5B;"><span>Pre-Paid Sales Tax</span><span>' + formatMoney(_pdfPrepaid) + '</span></div>';
    }
    (_pdfCredits || []).forEach(function(c) {
      if (!c || Math.abs(c.amount) < 0.01) return;
      totalsHtml += '<div class="total-row" style="color:#7B1FA2;"><span>' + esc(c.label || 'Credit') + '</span><span>' + formatMoney(c.amount) + '</span></div>';
    });
    totalsHtml += '<div class="total-row grand"><span>Total</span><span>' + formatMoney(grandTotal) + '</span></div>';
    if (type === 'invoice' && (totalPaid > 0.01 || String(docData.status || '').toLowerCase() === 'paid')) {
      totalsHtml += '<div class="total-row payment"><span>Paid</span><span>-' + formatMoney(totalPaid) + '</span></div>';
      totalsHtml += '<div class="total-row grand balance"><span>Balance</span><span>' + formatMoney(balancePdf) + '</span></div>';
      (paySummaryPdf.rows || []).forEach(function(p) {
        var payLbl = 'Payment' + (p.method ? ' — ' + esc(p.method) : '');
        if (p.date) payLbl += ' — ' + new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        totalsHtml += '<div class="total-row payment" style="font-size:11px;opacity:0.92;"><span>' + payLbl + '</span><span>-' + formatMoney(p.amount) + '</span></div>';
      });
    } else if (type !== 'po' && (docData.payments || []).length > 0) {
      (docData.payments || []).forEach(function(p) {
        totalsHtml += '<div class="total-row payment"><span>Payment' + (p.date ? ' — ' + new Date(p.date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '') + (p.method ? ' (' + esc(p.method) + ')' : '') + '</span><span>-' + formatMoney(p.amount) + '</span></div>';
      });
      totalsHtml += '<div class="total-row grand balance"><span>Balance Due</span><span>' + formatMoney(grandTotal - totalPaid) + '</span></div>';
    }

    // Memo — invoices: hide DEFAULT Terms boilerplate; keep a real custom memo (FABLE Q4)
    var _memoSrc = (docData.memo || docData.notes || '');
    if (type === 'invoice') {
      var _memoTrim = String(_memoSrc || '').trim();
      if (!_memoTrim || /^All fees are non-refundable\./i.test(_memoTrim)) _memoSrc = '';
      else _memoSrc = _memoTrim;
    }
    var memoHtml = _memoSrc ?
      '<div class="memo-block"><div class="memo-label">Terms & Notes</div><div class="memo-text">' + esc(_memoSrc) + '</div></div>' : '';

    var shipToHtml = shipToDisplay
      ? esc(shipToDisplay).replace(/\n/g, '<br>')
      : '<span style="color:#5C6B80;font-size:12px;">Set <strong>Project Address</strong> (job site) in Edit Project, or choose ship-to on lines.</span>';
    if (type === 'po') {
      var _poShipSet = {};
      items.forEach(function(it) {
        var s = String(it.shipTo || it.deliverTo || '').trim();
        if (s) _poShipSet[s] = true;
      });
      if (Object.keys(_poShipSet).length > 1) {
        shipToHtml += '<div style="margin-top:6px;font-size:11px;color:#B45309;font-weight:600;">Multiple ship-to locations — see each line item below.</div>';
      }
    }
    var projectAddressPdf = typeof window.cchProjectAddressFromData === 'function'
      ? window.cchProjectAddressFromData(proj, docData)
      : String(proj.projectAddress || proj.address || docData.projectAddress || '').trim();
    var billToHtml = typeof window.buildPremiumBillToHtml === 'function'
      ? window.buildPremiumBillToHtml(clientName, clientAddress, clientPhone, clientEmail, clientCompany, clientAddress2, projectAddressPdf)
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
    var projAddrLine = projectAddressPdf || String(proj.projectAddress || proj.address || '').trim();
    var projAddrHtml = projAddrLine ? esc(projAddrLine).replace(/\n/g, '<br>') : '';
    var projectHtml;
    if (type === 'invoice' && dateStr) {
      projectHtml = '<div class="project-title-row"><strong>' + esc(proj.name || projectId) + '</strong>' +
        '<span class="project-invoice-date">' + esc(dateStr) + '</span></div>' +
        (projAddrHtml ? '<div class="project-addr-sub">' + projAddrHtml + '</div>' : '');
    } else {
      projectHtml = '<strong>' + esc(proj.name || projectId) + '</strong>' +
        (projAddrHtml ? '<br><span style="color:#5C6B80;font-size:12px;">' + projAddrHtml + '</span>' : '');
    }

    var infoSectionHtml = '';
    if (type === 'po') {
      var vendorBlockHtml = '';
      if (docData.vendor) {
        if (vendorContactPremium && typeof window.cchVendorContactBlockHtml === 'function') {
          vendorBlockHtml = window.cchVendorContactBlockHtml(
            { name: docData.vendor, address: vendorContactPremium.address || vendorAddrPremium, phone: vendorContactPremium.phone, email: vendorContactPremium.email },
            { labelColor: '#5C6B80', addrColor: '#5C6B80', fontSize: '12px' }
          );
        } else {
          vendorBlockHtml = '<strong>' + esc(docData.vendor) + '</strong>';
          if (vendorAddrPremium) {
            vendorBlockHtml += '<div style="margin-top:6px;color:#5C6B80;font-size:12px;line-height:1.55;">' +
              esc(vendorAddrPremium).replace(/\n/g, '<br>') + '</div>';
          }
        }
      }
      infoSectionHtml = '<div class="info-section info-section-po">' +
        (vendorBlockHtml ? '<div class="info-block"><div class="info-label">Bill to (vendor)</div><div class="info-value">' + vendorBlockHtml + '</div></div>' : '') +
        '<div class="info-block info-block-ship-to"><div class="info-label">Ship To</div><div class="info-value">' + shipToHtml + '</div></div>' +
        (function() {
          var _poDocTag = (typeof window.documentTagDisplayText === 'function')
            ? String(window.documentTagDisplayText(docData) || '').trim()
            : String(docData.documentTags || docData.shortDescription || docData.tags || '').trim();
          if (!_poDocTag) return '';
          return '<div class="info-block"><div class="info-label">Document Tags</div><div class="info-value" style="font-size:12px;font-weight:600;">' + esc(_poDocTag) + '</div></div>';
        })() +
      '</div>';
    } else {
      infoSectionHtml = '<div class="info-section info-section-invoice">' +
        '<div class="info-block"><div class="info-label">Bill To</div><div class="info-value">' + billToHtml + '</div></div>' +
        '<div class="info-block"><div class="info-label">Project</div><div class="info-value">' + projectHtml + '</div></div>' +
      '</div>';
    }

    var voidBannerPremium = (type === 'invoice' && String(docData.status || '').toLowerCase() === 'void')
      ? '<div style="margin:12px 0 16px;padding:12px 16px;background:rgba(107,114,128,0.12);border:1px solid rgba(107,114,128,0.35);border-radius:8px;font-size:13px;color:#4B5563;"><strong>VOID</strong> &mdash; Non-billable reference; totals cleared. Trade costs remain on lines.</div>'
      : '';

    // Invoices: date is shown next to project name, not in the navy header.
    var premiumDocDateHtml = (type === 'invoice') ? '' : (dateStr ? '<div class="doc-date">' + esc(dateStr) + '</div>' : '');
    var premiumDocTypeHtml = (type === 'invoice') ? '' : ('<div class="doc-type">' + typeLabel + '</div>');
    var premiumToolbarTitle = (type === 'invoice') ? esc(docNum) : esc(typeLabel + ' ' + docNum);
    var premiumIsTimeInv = (type === 'invoice' && (
      String(docData.source || '') === 'time-tracker' ||
      (Array.isArray(docData.timeEntryIds) && docData.timeEntryIds.length > 0) ||
      (items.length && typeof window.cchIsPureDesignServicesInvoice === 'function' && window.cchIsPureDesignServicesInvoice(items))
    ));
    var premiumDispToolbarHtml = premiumIsTimeInv
      ? '<span class="toolbar-sep"></span>' +
        '<label class="toolbar-check"><input type="checkbox" id="cchPremDispDates" checked onchange="cchPremInvDispToggle(\'dates\',this.checked)"> Show dates</label>' +
        '<label class="toolbar-check"><input type="checkbox" id="cchPremDispHours" onchange="cchPremInvDispToggle(\'hours\',this.checked)"> Show hours</label>' +
        '<label class="toolbar-check"><input type="checkbox" id="cchPremDispRate" onchange="cchPremInvDispToggle(\'rate\',this.checked)"> Show rate</label>' +
        '<label class="toolbar-check"><input type="checkbox" id="cchPremDispNotes" checked onchange="cchPremInvDispToggle(\'notes\',this.checked)"> Show notes</label>'
      : '';
    var poPrintBodyClass = type === 'po' ? ' class="cch-po-vendor-print"' : '';
    var poPrintHint = type === 'po'
      ? 'Print dialog opens automatically. Turn off <strong>Headers and footers</strong> in print settings for a clean PDF.'
      : 'For a clean PDF: in Print → <strong>More settings</strong>, turn off <strong>Headers and footers</strong>. Otherwise Chrome adds the date and title at the top and <strong>about:blank</strong> (or the page URL) at the bottom — that is not part of your invoice.';

    // Build the premium preview (reuse tab opened synchronously on click)
    var win = previewWin;
    win.document.open();
    win.document.write('<!DOCTYPE html><html><head><title>' + esc(typeLabel + ' ' + docNum) + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600&display=swap" rel="stylesheet">' +
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
      '.toolbar-actions { display:flex;gap:8px;flex-shrink:0;padding-top:2px;flex-wrap:wrap;align-items:center; }' +
      '.toolbar-sep { width:1px;height:20px;background:rgba(196,164,100,0.35);margin:0 4px; }' +
      '.toolbar-check { display:inline-flex;align-items:center;gap:5px;color:#C8B99A;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap; }' +
      '.toolbar-check input { accent-color:#C4A464;cursor:pointer; }' +
      '.tb-btn { background:transparent;color:#C4A464;border:1px solid #C4A464;padding:7px 14px;font-size:11px;font-weight:600;cursor:pointer;font-family:"DM Sans";transition:all 0.15s; }' +
      '.tb-btn:hover { background:rgba(196,164,100,0.12);color:#1B3352; }' +
      '.tb-btn-primary { background:#C4A464;color:#FFFFFF;border-color:#C4A464; }' +
      '.tb-btn-primary:hover { background:#A08A50; }' +

      /* Header — compact so short invoices fit page 1 */
      '.doc-header { background:#1B3352; padding:10px 28px 8px; display:flex; justify-content:space-between; align-items:flex-start; }' +
      '.logo-block { }' +
      '.logo-cch { font-family:"Cormorant Garamond",Georgia,serif; font-size:24px; font-weight:700; color:#C4A464; letter-spacing:3px; line-height:1; }' +
      '.logo-sub { font-size:8px; letter-spacing:2.5px; color:rgba(255,255,255,0.4); text-transform:uppercase; margin-top:1px; }' +
      '.company-info { font-size:9px; color:rgba(255,255,255,0.62); line-height:1.35; margin-top:3px; }' +
      '.doc-meta { text-align:right; }' +
      '.doc-type { font-size:9px; text-transform:uppercase; letter-spacing:2.5px; color:#C4A464; font-weight:600; }' +
      '.doc-num { font-size:17px; font-weight:700; color:#fff; margin-top:2px; font-family:"Cormorant Garamond",serif; }' +
      '.doc-date { font-size:11px; color:rgba(255,255,255,0.5); margin-top:2px; }' +
      '.doc-status { display:inline-block; padding:2px 10px; margin-top:4px; font-size:9px; font-weight:600; letter-spacing:1px; text-transform:uppercase; border:1px solid rgba(196,164,100,0.45); color:#C4A464; }' +

      /* Gold divider */
      '.gold-line { height:2px; background:linear-gradient(90deg,#C4A464,#E0C48A,#C4A464); }' +

      /* Info section */
      '.info-section { display:flex; flex-wrap:wrap; gap:10px 20px; padding:8px 22px 22px; border-bottom:1px solid #E8ECF3; align-items:flex-start; }' +
      '.info-section-invoice .info-block { flex:1 1 220px; min-width:0; max-width:48%; }' +
      '.info-section-po { justify-content:space-between; }' +
      '.info-section-po .info-block:first-child { flex:0 1 42%; min-width:0; }' +
      '.info-section-po .info-block-ship-to { margin-left:auto; flex:1 1 52%; min-width:200px; max-width:100%; text-align:right; }' +
      '.info-section-po .info-block-ship-to .info-value { text-align:right; white-space:normal; word-wrap:break-word; overflow-wrap:anywhere; }' +
      '.info-block { flex:1 1 160px; min-width:0; }' +
      '.info-label { font-size:8px; text-transform:uppercase; letter-spacing:1.5px; color:#C4A464; font-weight:700; margin-bottom:3px; }' +
      '.info-value { font-size:12px; color:#1B3352; line-height:1.45; }' +
      '.info-value strong { font-weight:600; }' +
      '.bill-to-contact { font-size:10px !important; font-weight:400 !important; color:#5C6B80 !important; }' +
      '.project-title-row { display:flex; justify-content:space-between; align-items:baseline; gap:12px; flex-wrap:wrap; width:100%; }' +
      '.project-invoice-date { font-size:11px; color:#5C6B80; font-weight:600; white-space:nowrap; margin-left:auto; }' +
      '.project-addr-sub { color:#5C6B80; font-size:11px; margin-top:3px; line-height:1.35; }' +

      /* Items */
      '.items-section { padding:20px 22px 6px; }' +
      '.room-section { margin-bottom:10px; }' +
      '.room-header { display:flex; justify-content:space-between; align-items:center; padding:4px 0 2px; border-bottom:2px solid #1B3352; margin-bottom:2px; }' +
      '.room-header span:first-child { font-size:10px; text-transform:uppercase; letter-spacing:1.5px; color:#C4A464; font-weight:700; }' +
      '.room-header span:last-child { font-size:11px; color:#5C6B80; font-weight:600; font-family:"DM Sans"; }' +
      '.cch-po-vendor-pdf { width:100%; border-collapse:collapse; }' +
      '.cch-po-vendor-pdf thead tr { border-bottom:2px solid #1B3352; }' +
      'table.cch-premium-items-table { width:100%; border-collapse:collapse; table-layout:fixed; }' +
      'col.pc-item { width:44%; }' +
      'col.pc-qty { width:8%; }' +
      'col.pc-vendor { width:11%; }' +
      'col.pc-sidemark { width:12%; }' +
      'col.pc-money { width:9%; }' +
      'col.pc-tax { width:6%; }' +
      'th, td { min-width:0; }' +
      'td.line-item-main { word-wrap:break-word; overflow-wrap:break-word; vertical-align:top; }' +
      '.cch-premium-item-grid { display:grid; grid-template-columns:72px minmax(0,1fr); gap:10px; align-items:start; width:100%; box-sizing:border-box; }' +
      '.cch-premium-item-grid--no-thumb { grid-template-columns:minmax(0,1fr); }' +
      '.cch-premium-item-thumb { width:72px; flex-shrink:0; background:#fff; border:1px solid #E8ECF3; box-sizing:border-box; padding:3px; }' +
      '.cch-premium-item-thumb img { width:64px; height:64px; object-fit:contain; border-radius:0; display:block; }' +
      '.cch-premium-item-text { min-width:0; width:100%; max-width:100%; }' +
      '.prop-line-detail-stack { width:100%; min-width:0; max-width:100%; box-sizing:border-box; }' +
      'th { text-align:left; padding:5px 5px; font-size:8px; text-transform:uppercase; letter-spacing:1px; color:#5C6B80; font-weight:600; border-bottom:1px solid #E8ECF3; background:#F4F6FA; }' +
      'th.r { text-align:right; }' +
      'td { padding:6px 5px; border-bottom:1px solid #E8ECF3; font-size:12px; vertical-align:middle; }' +
      'td.r { text-align:right; font-family:"DM Sans"; }' +
      'td.total-cell { font-weight:600; }' +
      'td.ship { color:#5C6B80; }' +
      'td.vendor-cell { color:#5C6B80; font-size:12px; }' +
      'td.sidemark-cell { color:#1B3352; font-size:11px; font-weight:600; line-height:1.4; vertical-align:top; word-wrap:break-word; overflow-wrap:break-word; }' +
      'td.img-cell img { width:64px; height:64px; object-fit:contain; border-radius:0; background:#fff; }' +
      'td strong { font-size:13px; display:block; }' +
      '.item-desc { font-size:11px; color:#5C6B80; margin-top:2px; }' +
      '.item-desc-multiline { white-space:pre-wrap; word-break:break-word; overflow-wrap:break-word; line-height:1.5; width:100%; max-width:100%; margin-top:6px; font-size:11px; }' +
      '.item-svc-period { font-size:10px;color:#8B7355;margin-top:6px;font-weight:600;letter-spacing:0.2px; }' +
      '.line-notes-ul { margin:6px 0 0 1.1em;padding:0;list-style:disc;color:#5C6B80;font-size:11px;line-height:1.45; }' +
      '.line-notes-ul li { margin:3px 0; }' +
      '.line-item-main { vertical-align:top; }' +
      '.line-item-main strong { margin-bottom:2px; }' +
      '.item-vendor { font-size:10px; color:#5C6B80; margin-top:1px; }' +
      '.tax-yes { color:#5FA56B; font-weight:700; }' +
      '.tax-no { color:#ccc; }' +

      /* Totals */
      '.totals-section { padding:0 28px 16px; display:flex; justify-content:flex-end; }' +
      '.totals-block { min-width:260px; }' +
      '.total-row { display:flex; justify-content:space-between; padding:3px 0; font-size:12px; color:#5C6B80; }' +
      '.total-row.grand { font-size:16px; font-weight:700; color:#1B3352; padding-top:8px; margin-top:2px; border-top:2px solid #1B3352; font-family:"Cormorant Garamond",serif; }' +
      '.total-row.payment { color:#5FA56B; }' +
      '.total-row.balance { color:#C8B99A; }' +

      /* Memo */
      '.memo-block { margin:0 28px 16px; padding:10px 14px; background:#FAFAF8; border-left:3px solid #C8B99A; }' +
      '.memo-label { font-size:8px; text-transform:uppercase; letter-spacing:1.5px; color:#C8B99A; font-weight:700; margin-bottom:4px; }' +
      '.memo-text { font-size:11px; color:#6B6760; line-height:1.5; }' +

      /* Footer — sticks to bottom when content is short; avoids floating mid-page */
      '.doc-footer { margin-top:auto; padding:10px 28px; border-top:1px solid #e8e6e0; text-align:center; background:#FAFAF8; flex-shrink:0; }' +
      '.footer-brand { font-family:"Cormorant Garamond",serif; font-size:13px; color:#C8B99A; letter-spacing:2px; font-weight:600; }' +
      '.footer-tagline { font-size:9px; color:#9E9A8F; font-style:italic; margin-top:1px; }' +
      '.footer-contact { font-size:9px; color:#bbb; margin-top:3px; }' +

      /* PO vendor print — screen matches print (no preview/print mismatch) */
      'body.cch-po-vendor-print { display:block; min-height:auto; background:#fff; }' +
      'body.cch-po-vendor-print .page { min-height:auto; box-shadow:none; flex:none; max-width:100%; margin:0; }' +
      'body.cch-po-vendor-print .page-body { flex:none; }' +
      'body.cch-po-vendor-print .items-section { padding:16px 32px 12px; }' +
      'body.cch-po-vendor-print .totals-section { padding:0 32px 20px; }' +
      'body.cch-po-vendor-print .info-section { padding:16px 32px; }' +
      'body.cch-po-vendor-print .doc-footer { margin-top:16px; }' +
      'body.cch-po-vendor-print .cch-premium-item-grid { grid-template-columns:minmax(0,1fr); }' +
      'body.cch-po-vendor-print .cch-premium-item-thumb { display:none; }' +
      'body.cch-po-vendor-print .cch-po-line-specs { margin-top:4px; }' +
      'body.cch-po-vendor-print .cch-po-line-specs div { display:inline; margin-right:10px; }' +
      'body.cch-po-vendor-print .cch-po-line-specs div span:first-child { margin-right:4px; }' +

      /* Print — hide screen toolbar AND its spacer (was leaving ~44px blank at top of every PDF) */
      '@media print { .toolbar{display:none!important;} .toolbar-spacer{display:none!important;height:0!important;} .print-hint-screen{display:none!important;} body{background:white;display:block;min-height:auto;} .page{min-height:auto;box-shadow:none;flex:none;} .page-body{flex:none;} .doc-footer{position:relative;margin-top:8px;} .cch-po-vendor-pdf tr{page-break-inside:avoid;} .room-section{page-break-inside:auto;} .room-header{page-break-after:avoid;} table.cch-premium-items-table tr{page-break-inside:avoid;} .info-section{padding:8px 20px 20px!important;gap:10px 20px!important;} .items-section{padding:18px 20px 6px!important;} .totals-section{padding:0 20px 10px!important;} .doc-header{padding:8px 20px 6px!important;} .cch-premium-item-grid{grid-template-columns:56px minmax(0,1fr)!important;gap:8px!important;} .cch-premium-item-thumb{width:56px!important;padding:2px!important;} .cch-premium-item-thumb img,.img-cell img{width:48px!important;height:48px!important;} td{padding:4px 4px!important;} th{padding:4px!important;} .room-header{padding:4px 0 2px!important;margin-bottom:2px!important;} .room-section{margin-bottom:10px!important;} }' +
      '@page { margin:0.3in; }' +

      /* Tear sheet pages (preview only — scoped; do not inject _getTearSheetCSSRedesign; it overrides body/toolbar) */
      '.ts-page { page-break-before:always; padding:48px; }' +
      '.ts-header { display:flex; justify-content:space-between; align-items:center; padding-bottom:16px; border-bottom:2px solid #1B3352; margin-bottom:24px; }' +
      '.ts-logo { font-family:"Cormorant Garamond",serif; font-size:28px; font-weight:700; color:#1B3352; letter-spacing:3px; }' +
      '.ts-body { display:grid; grid-template-columns:1fr 1fr; gap:32px; }' +
      '.ts-img { width:100%; aspect-ratio:1; object-fit:contain; background:#FAFAF8; }' +
      '.ts-title { font-family:"Cormorant Garamond",serif; font-size:26px; font-weight:600; color:#1B3352; margin-bottom:4px; }' +
      '.ts-room { font-size:10px; letter-spacing:2px; text-transform:uppercase; color:#C8B99A; font-weight:600; margin-bottom:20px; }' +
      '.ts-spec { display:flex; padding:6px 0; border-bottom:1px solid #f0efeb; }' +
      '.ts-spec-label { font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.8px; color:#5C6B80; width:120px; }' +
      '.ts-spec-val { font-size:13px; color:#1B3352; }' +
      '.ts-price { margin-top:auto; padding-top:16px; border-top:2px solid #1B3352; font-family:"Cormorant Garamond",serif; font-size:32px; font-weight:700; color:#1B3352; }' +
      '</style></head><body' + poPrintBodyClass + '>' +

      /* Toolbar */
      '<div class="toolbar">' +
        '<div class="toolbar-left">' +
        '<div class="toolbar-title">' + premiumToolbarTitle + '</div>' +
        '<div class="print-hint-screen">' + poPrintHint + '</div>' +
        '</div>' +
        '<div class="toolbar-actions">' +
          (type === 'po'
            ? '<button class="tb-btn" onclick="window.close()">Close</button>' +
              '<button class="tb-btn tb-btn-primary" onclick="window.print()">🖨️ Print / PDF</button>'
            : '<button class="tb-btn" onclick="window.print()">🖨️ Print / PDF</button>' +
              premiumDispToolbarHtml +
              '<button class="tb-btn" id="tsToggle" onclick="toggleTearSheets()">📑 Include Tear Sheets</button>') +
        '</div>' +
      '</div>' +

      '<div class="toolbar-spacer" style="height:44px;"></div>' +

      '<div class="page">' +
        '<div class="page-body">' +
        /* Header */
        '<div class="doc-header">' +
          '<div class="logo-block">' +
            '<div class="logo-cch">CCH</div>' +
            '<div class="logo-sub">Design Inc</div>' +
            '<div class="company-info">' + cchPremiumDocCompanyInfoHtml() + '</div>' +
          '</div>' +
          '<div class="doc-meta">' +
            premiumDocTypeHtml +
            '<div class="doc-num">' + esc(docNum) + '</div>' +
            premiumDocDateHtml +
            '<div class="doc-status">' + esc(type === 'invoice'
              ? cchInvoiceClientDisplayStatus(docData)
              : (typeof window.cchPoShippingStatus === 'function'
                ? (window.cchPoShippingStatus(docData, items) || docData.status || 'Draft')
                : (docData.status || 'Draft'))) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="gold-line"></div>' +

        voidBannerPremium +

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
          '<div class="footer-tagline">' + (type === 'po' ? 'residential &amp; yacht design · purchase order' : (type === 'proposal' ? 'residential &amp; yacht design · Valid 30 days' : 'residential &amp; yacht design')) + '</div>' +
          '<div class="footer-contact">www.cchdesign.com · @cchdesigninc · Thank you for your business</div>' +
        '</div>' +
      '</div>');

    if (type === 'po') {
      win.document.write('<script>window.addEventListener("load",function(){setTimeout(function(){try{window.focus();window.print();}catch(_e){}},400);});<\/script>');
    }

    // Tear sheet pages (hidden by default, toggled by button)
    if (type !== 'po') {
    win.document.write('<div id="tearSheetPages" style="display:none;">');
    items.forEach(function(item, idx) {
      var _heroImg = '';
      try {
        if (typeof _normalizeProposalItemImages === 'function') {
          var _im = _normalizeProposalItemImages(item);
          _heroImg = (_im.list && _im.list.length) ? (_im.list[_im.heroIdx] || _im.list[0] || '') : '';
        }
      } catch (eIm) {}
      if (!_heroImg) _heroImg = String(item.imageUrl || item.image || '').trim();
      if (typeof isProposalGroupHeaderItem === 'function' && isProposalGroupHeaderItem(item)) return;
      if (!item.title && !_heroImg) return;
      var qty = parseFloat(item.qty) || 1;
      var amt = parseFloat(item.amount) || 0;
      win.document.write(
        '<div class="page ts-page">' +
          '<div class="ts-header">' +
            '<div class="ts-logo">CCH</div>' +
            '<div style="font-size:11px;color:#9E9A8F;">' + esc(proj.name||'') + ' · Item ' + (idx+1) + ' of ' + items.length + '</div>' +
          '</div>' +
          '<div class="ts-body">' +
            '<div>' + (_heroImg ? '<img class="ts-img" src="' + _escImgSrcAttr(_heroImg) + '" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' : '<div class="ts-img" style="background:#f5f3ee;display:flex;align-items:center;justify-content:center;font-size:48px;">📦</div>') + '</div>' +
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
    win.document.write('<script>var _tsVisible=false; function toggleTearSheets(){ _tsVisible=!_tsVisible; document.getElementById("tearSheetPages").style.display=_tsVisible?"block":"none"; document.getElementById("tsToggle").style.background=_tsVisible?"#C8B99A":"transparent"; document.getElementById("tsToggle").style.color=_tsVisible?"#1B3352":"#C8B99A"; document.getElementById("tsToggle").textContent=_tsVisible?"📑 Tear Sheets Included":"📑 Include Tear Sheets"; }' +
      (premiumIsTimeInv ? ' var _cchPremDisp={dates:true,hours:false,rate:false,notes:true}; function cchPremInvDispToggle(k,on){_cchPremDisp[k]=!!on;var sel={dates:".cch-inv-disp-dates",hours:".cch-inv-disp-hours",rate:".cch-inv-disp-rate",notes:".cch-inv-disp-notes"}[k];if(sel)document.querySelectorAll(sel).forEach(function(el){el.style.display=on?"":"none";});try{localStorage.setItem("cchPremInvDisplay",JSON.stringify(_cchPremDisp));}catch(_e){}} (function(){try{var s=localStorage.getItem("cchPremInvDisplay");if(s)_cchPremDisp=JSON.parse(s);}catch(_e2){} ["dates","hours","rate","notes"].forEach(function(k){cchPremInvDispToggle(k,!!_cchPremDisp[k]);var el=document.getElementById("cchPremDisp"+k.charAt(0).toUpperCase()+k.slice(1));if(el)el.checked=!!_cchPremDisp[k];});})();' : '') +
      '<\/script>');
    }

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
          (imgUrl ? '<img src="' + _escImgSrcAttr(imgUrl) + '" style="width:56px;height:56px;object-fit:cover;flex-shrink:0;" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' : '<div style="width:56px;height:56px;background:#F5F3EE;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">📦</div>') +
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
    if (!poDoc.exists) {
      if (typeof cchAlert === 'function') await cchAlert('PO not found', 'Vendor invoice');
      return;
    }
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
      if (typeof cchAlert === 'function') await cchAlert('Error: ' + e.message, 'Vendor invoice');
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
      if (typeof cchAlert === 'function') await cchAlert('Error: ' + e.message, 'Vendor invoice');
    }
  };

  // Create client invoice for shipping/tax fees from a PO
  window.invoiceClientForShipping = async function(projectId, poId) {
    try {
      var shipping = parseFloat(document.getElementById('viShipping').value) || 0;
      var tax = parseFloat(document.getElementById('viTax').value) || 0;

      if (shipping === 0 && tax === 0) {
        var _shipStr = typeof cchPrompt === 'function' ? await cchPrompt('Enter shipping amount to invoice client:', '', 'Shipping invoice') : null;
        shipping = parseFloat(_shipStr) || 0;
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
          markupPct: 0, shipping: 0, expenseType: 'sales_tax', room: '', category: '',
          _cchVendorPrepaidTax: true
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
      if (typeof cchAlert === 'function') await cchAlert('Error: ' + e.message, 'Shipping invoice');
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
