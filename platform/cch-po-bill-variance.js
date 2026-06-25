/**
 * PO → Bill → Variance workflow (CURRENT_PRIORITIES 3b, SPEC_PO_Bill_Variance_Workflow_v1.0).
 */
(function() {
  'use strict';

  /** Scenario A/D: QuickBooks gets vendor Bill lines only — PO and payments stay in Studio (Houzz bill-only). */
  window.CCH_PO_QB_BILL_ONLY = true;

  /** Studio Pay bill / payments[] never push to QB — QB confirms via BillPayment webhook only. */
  window.cchPoPaymentsNeverPushToQb = function() {
    return window.cchPoQbBillOnlyMode();
  };

  window.cchPoQbBillOnlyMode = function() {
    return window.CCH_PO_QB_BILL_ONLY !== false;
  };

  /** QB vendor bill push is production-only (staging uses separate Firebase, not live QB bills). */
  window.cchPoQbBillPushAllowed = function() {
    return window._cchEnv !== 'staging';
  };

  window.cchPoQbBillPushBlockedHtml = function() {
    if (window.cchPoQbBillPushAllowed()) return '';
    return '<p style="font-size:11px;color:#5C6B80;margin:8px 0 0;max-width:480px;padding:8px 10px;border:1px solid rgba(196,164,100,0.25);background:rgba(196,164,100,0.06);">' +
      'QuickBooks bill push is <strong>disabled on staging</strong>. Receive and edit vendor bills here; push to QB from production.</p>';
  };

  /** Houzz/QB Bill ref: PO-9016 → BL-9016 (Studio bill #; vendor paper inv # is a separate column). */
  window.cchPoQbBillDocNumberFromPo = function(poOrNum) {
    var raw = '';
    if (poOrNum && typeof poOrNum === 'object') {
      raw = poNum(poOrNum);
    } else {
      raw = String(poOrNum || '').trim();
    }
    if (!raw) {
      if (poOrNum && typeof poOrNum === 'object') {
        var storedOnly = String((poOrNum.bill || {}).qbDocNumber || '').trim();
        if (/^BL-/i.test(storedOnly)) return storedOnly;
      }
      return '';
    }
    var blFromPo = /^BL-/i.test(raw) ? raw : 'BL-' + raw.replace(/^PO-/i, '');
    if (poOrNum && typeof poOrNum === 'object') {
      var bill = poOrNum.bill || {};
      var stored = String(bill.qbDocNumber || '').trim();
      if (/^BL-/i.test(stored)) return stored;
      return blFromPo;
    }
    return blFromPo;
  };

  /** Compact badge for PO list rows (project tab, global POs, dashboard). */
  window.cchPoBillOnlyListBadgeHtml = function(po) {
    if (!window.cchPoQbBillOnlyMode()) return '';
    po = po || {};
    var bill = po.bill || {};
    var label = 'Bill-only';
    var tip = 'QuickBooks: push the vendor bill (PO + extras), not the PO.';
    var bg = 'rgba(27,51,82,0.1)';
    var color = '#1B3352';
    if (bill.qbBillId) {
      label = 'QB Bill';
      tip = 'Vendor bill synced to QuickBooks #' + String(bill.qbBillId);
      bg = 'rgba(46,125,50,0.14)';
      color = '#1B5E20';
    } else if (bill.received) {
      label = 'Bill ready';
      tip = 'Vendor bill recorded in Studio — QB Bill sync pending or complete';
      bg = 'rgba(196,164,100,0.22)';
      color = '#5C4A2A';
    }
    return '<span class="cch-po-bill-only-badge" style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:3px;margin-left:5px;white-space:nowrap;vertical-align:middle;background:' + bg + ';color:' + color + ';" title="' + escAttr(tip) + '">' + esc(label) + '</span>';
  };

  /** QB column cell when bill-only workflow is active. */
  window.cchPoQbListCellHtml = function(po) {
    if (!window.cchPoQbBillOnlyMode()) {
      if (typeof window.qbCellBadge !== 'function') return '';
      var qid = typeof window.getQbId === 'function' ? window.getQbId(po) : null;
      return window.qbCellBadge(qid, po && po.qbStatus, po);
    }
    po = po || {};
    var bill = po.bill || {};
    var blRef = typeof window.cchPoQbBillDocNumberFromPo === 'function' ? window.cchPoQbBillDocNumberFromPo(po) : '';
    var legQb = typeof window.getQbId === 'function' ? window.getQbId(po) : null;
    if (bill.qbBillId) {
      var linkedTip = bill.qbLinkedExisting ? ' · Linked from existing Houzz/QB bill' : '';
      return '<span style="font-size:10px;color:#1B5E20;display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px;" title="' + escAttr('Vendor bill in QuickBooks · ' + (blRef || bill.qbBillId) + linkedTip) + '">' +
        '<span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;background:#5FA56B;border-radius:50%;display:inline-block;"></span>QB Bill' +
        (bill.qbLinkedExisting ? ' <span style="font-size:8px;color:#5C6B80;font-weight:500;">linked</span>' : '') +
        '</span>' +
        (blRef ? '<span style="font-size:9px;color:#1B3352;font-weight:600;font-family:monospace;">' + esc(blRef) + '</span>' : '') +
        '</span>';
    }
    if (legQb && typeof window.qbCellBadge === 'function') {
      return window.qbCellBadge(legQb, po.qbStatus, po) +
        '<span style="font-size:9px;color:#5C6B80;display:block;margin-top:3px;" title="Older PO synced to QB as PO — new bills use Bill-only">Legacy PO</span>';
    }
    if (bill.received) {
      return '<span style="font-size:10px;color:#92400E;font-weight:600;display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px;" title="Vendor bill in Studio — push creates QB Bill ' + escAttr(blRef || '') + '">' +
        '<span>Bill ready</span>' +
        (blRef ? '<span style="font-size:9px;color:#1B3352;font-family:monospace;">→ ' + esc(blRef) + '</span>' : '') +
        '</span>';
    }
    if (typeof window.poQbUiPaidInFullNoBalance === 'function' && window.poQbUiPaidInFullNoBalance(po) && typeof window.qbCellBadge === 'function') {
      return window.qbCellBadge(null, po.qbStatus, po) +
        '<span style="font-size:9px;color:#5C6B80;display:block;margin-top:3px;" title="Houzz paid — import All Transactions XLSX for numeric QB id if needed">Houzz paid</span>';
    }
    return '<span style="font-size:10px;color:#5C6B80;font-weight:600;display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px;" title="Receive vendor bill in Studio' + (window.cchPoQbBillPushAllowed && !window.cchPoQbBillPushAllowed() ? ' — QB push on production only' : '') + '">' +
      '<span>Bill-only</span>' +
      (blRef ? '<span style="font-size:9px;color:#9CA3AF;font-family:monospace;">→ ' + esc(blRef) + (window.cchPoQbBillPushAllowed && !window.cchPoQbBillPushAllowed() ? ' (prod)' : '') + '</span>' : '') +
      '</span>';
  };

  function cchPoFmtShortDate(iso) {
    if (!iso) return '';
    if (typeof window.formatDate === 'function') return window.formatDate(iso);
    return String(iso).slice(0, 10);
  }

  /** Whether PO was sent/locked for vendor (Send PO, procurement, or fulfillment status). */
  window.cchPoWasSentToVendor = function(doc) {
    doc = doc || {};
    var sentAt = String(doc.poSentAt || '').trim();
    if (doc.poLocked === true || sentAt) {
      return { sent: true, at: sentAt, detail: doc.poSentBy ? ('by ' + doc.poSentBy) : '' };
    }
    var ps = String(doc.poStatus || '').trim().toLowerCase();
    if (ps && ps !== 'draft' && ps !== 'voided') {
      return { sent: true, at: sentAt, detail: ps === 'sent' ? 'Marked sent' : ('PO status: ' + doc.poStatus) };
    }
    var proc = String(doc.procurementStatus || '').trim();
    if (/sent/i.test(proc)) {
      return { sent: true, at: sentAt, detail: proc };
    }
    var st = String(doc.status || '').trim().toLowerCase();
    if (st === 'sent to vendor') {
      return { sent: true, at: sentAt, detail: 'Fulfillment: Sent to vendor' };
    }
    return { sent: false, at: '', detail: '' };
  };

  /**
   * Vendor Bills firm-wide list: bill-only workflow POs only.
   * Legacy Houzz POs already synced to QuickBooks as PO (qbDocId, no Studio bill) stay on All POs — not here.
   */
  window.cchPoEligibleForVendorBillsList = function(po) {
    po = po || {};
    var bill = po.bill || {};
    if (bill.received || bill.qbBillId) return true;
    if (bill.billTotal != null || (bill.items && bill.items.length)) return true;
    var v = po.variance;
    if (v && Math.abs(parseFloat(v.amount) || 0) >= 0.01) return true;
    var poSt = String(po.poStatus || '').trim().toLowerCase();
    if (poSt === 'bill_received') return true;
    if (typeof window.getQbId === 'function' && window.getQbId(po)) return false;
    if (typeof window.poQbUiPaidInFullNoBalance === 'function' && window.poQbUiPaidInFullNoBalance(po)) return false;
    return true;
  };

  /** Project PO list — bill lane badge + paid/balance when bill is received. */
  window.cchPoListBillWorkflowHtml = function(po) {
    po = po || {};
    var items = po.items || [];
    var lane = typeof window.cchPoBillLaneId === 'function' ? window.cchPoBillLaneId(po, items) : 'na';
    if (lane === 'na') {
      return '<span style="font-size:11px;color:var(--gray-400);">—</span>';
    }
    var badge = typeof window.cchPoBillStatusBadgeHtml === 'function'
      ? window.cchPoBillStatusBadgeHtml(po, { projectId: po.projectId, poId: po.id, poItems: items, clickable: true })
      : esc(String(lane));
    var money = '';
    if (lane === 'received' || lane === 'closed') {
      var paid = typeof window.cchPoVendorBillPaidAmount === 'function' ? window.cchPoVendorBillPaidAmount(po) : 0;
      var due = typeof window.cchPoAmountDue === 'function' ? window.cchPoAmountDue(po) : 0;
      if (lane === 'received' && due > 0.02) {
        money = '<div style="font-size:10px;color:#5C6B80;margin-top:3px;font-family:var(--font-mono);white-space:nowrap;">' +
          fmt(paid) + ' paid · ' + fmt(due) + ' bal</div>';
      }
    } else if (lane === 'partial') {
      var bill = po.bill || {};
      if (bill.billTotal != null && Math.abs(parseFloat(bill.billTotal) || 0) > 0.01) {
        money = '<div style="font-size:10px;color:#5C6B80;margin-top:3px;font-family:var(--font-mono);">' +
          fmt(parseFloat(bill.billTotal)) + ' entered</div>';
      }
    }
    return '<div class="cch-po-bill-workflow-cell" style="display:flex;flex-direction:column;gap:2px;font-size:11px;line-height:1.35;">' +
      badge + money + '</div>';
  };

  /**
   * Bill-status <option> list for the inline dropdown. Mirrors the bill-lane
   * steps (Pending / Partial / Bill received / Closed); current lane is selected.
   */
  window.cchPoBillStatusOptionsHtml = function(currentLane) {
    currentLane = String(currentLane || '').trim();
    var steps = [
      { id: 'pending', label: 'Pending' },
      { id: 'partial', label: 'Partial' },
      { id: 'received', label: 'Bill received' },
      { id: 'closed', label: 'Closed' }
    ];
    return steps.map(function(st) {
      return '<option value="' + st.id + '"' + (currentLane === st.id ? ' selected' : '') + '>' + esc(st.label) + '</option>';
    }).join('');
  };

  /**
   * Inline bill-status dropdown for the project PO tab (replaces the verbose
   * paid/balance badge). The bill lane is DERIVED from the vendor-bill record,
   * not a free-set field, so this select does not blind-write a lane. On change
   * it routes to the existing Receive-vendor-bill flow (the safe writer) and
   * reverts its visible value — the lane re-derives once the bill is saved.
   * Paid / Balance numbers stay in their own BILL / PAID / BALANCE columns.
   */
  window.cchPoBillStatusEditorCellHtml = function(po, projectId) {
    po = po || {};
    var items = po.items || [];
    var lane = typeof window.cchPoBillLaneId === 'function' ? window.cchPoBillLaneId(po, items) : 'na';
    if (lane === 'na') {
      return '<span style="font-size:11px;color:var(--gray-400);">—</span>';
    }
    var pid = escJs(projectId || po.projectId);
    var poid = escJs(po.id);
    var optsHtml = window.cchPoBillStatusOptionsHtml(lane);
    return '<select class="form-input" style="font-size:11px;padding:4px 28px 4px 8px;min-width:130px;max-width:190px;" ' +
      'data-prev-status="' + escAttr(lane) + '" onclick="event.stopPropagation()" ' +
      'onfocus="this.setAttribute(\'data-prev-status\',this.value)" ' +
      'onchange="window.cchPoBillStatusSelectChanged(\'' + pid + '\',\'' + poid + '\',this)" ' +
      'title="Vendor bill status — choose Partial / Bill received to open the receive-bill flow">' + optsHtml + '</select>';
  };

  /**
   * Dropdown change handler. Routes to the existing receive-bill modal rather
   * than directly writing a derived lane (avoids inventing risky Firestore
   * writes / accidental downgrades). The select reverts to its prior value;
   * the lane updates from the saved bill record after the flow completes.
   */
  window.cchPoBillStatusSelectChanged = function(projectId, poId, el) {
    if (!el) return;
    var sel = String(el.value || '').trim();
    var prev = el.getAttribute('data-prev-status') || '';
    el.value = prev;
    if (sel === prev) return;
    if (sel === 'partial' || sel === 'received') {
      if (typeof window.cchPoOpenReceiveBillModal === 'function') {
        window.cchPoOpenReceiveBillModal(projectId, poId);
        return;
      }
    }
    if (typeof window.navigate === 'function') {
      window.navigate('#/project/' + projectId + '/po/' + poId);
    }
  };

  /**
   * Compact QB status dot for list columns. Three states only:
   *   GREEN   = pushed through to QuickBooks (bill present in QB)
   *   RED     = last push to QuickBooks failed
   *   NOTHING = nothing pushed yet (never attempted, awaiting bill, or ready to push)
   */
  window.cchPoQbDotCellHtml = function(po) {
    po = po || {};
    var bill = po.bill || {};
    var qbBillId = String(bill.qbBillId || '').trim();
    var legQb = typeof window.getQbId === 'function' ? String(window.getQbId(po) || '').trim() : '';
    var blRef = typeof window.cchPoQbBillDocNumberFromPo === 'function' ? window.cchPoQbBillDocNumberFromPo(po) : '';
    var pushErr = String(bill.qbPushError || '').trim();
    function dot(color, tip, label) {
      return '<span style="display:inline-flex;align-items:center;justify-content:center;gap:6px;width:100%;" title="' + escAttr(tip) + '">' +
        '<span style="width:10px;height:10px;border-radius:50%;background:' + color + ';display:inline-block;flex-shrink:0;box-shadow:0 0 0 1px rgba(15,26,46,0.08);"></span>' +
        (label ? '<span style="font-size:10px;color:#5C6B80;font-weight:600;white-space:nowrap;">' + esc(label) + '</span>' : '') +
        '</span>';
    }
    var none = '<span style="color:var(--gray-400);font-size:12px;" title="Not pushed to QuickBooks">—</span>';
    // GREEN — successfully pushed / present in QuickBooks
    if (qbBillId) {
      var stale = (typeof cchPoBillNeedsQbSync === 'function') && cchPoBillNeedsQbSync(bill);
      var linkedTip = bill.qbLinkedExisting ? ' · linked existing QB bill' : '';
      return dot('#5FA56B',
        (stale ? 'In QuickBooks (edited in Studio — re-push to update) · ' : 'Pushed to QuickBooks · ') + (blRef || qbBillId) + linkedTip,
        'QB');
    }
    if (legQb && !window.cchPoQbBillOnlyMode()) {
      return dot('#5FA56B', 'In QuickBooks (legacy) · ' + legQb, 'QB');
    }
    // RED — a push was attempted and failed
    if (pushErr) {
      return dot('#DC2626', 'QuickBooks push failed: ' + pushErr + (blRef ? ' · ' + blRef : ''), 'Failed');
    }
    // NOTHING — not pushed yet (never attempted, awaiting bill, ready to push, or staging-blocked)
    return none;
  };

  var PO_LIFECYCLE_STEPS = ['draft', 'sent', 'bill_received', 'paid', 'cleared'];
  var VARIANCE_REASONS = [
    { id: 'shipping', label: 'Shipping', defaultRes: 'billable_to_client' },
    { id: 'tax', label: 'Pre-paid tax', defaultRes: 'billable_to_client' },
    { id: 'expedited', label: 'Expedited', defaultRes: 'billable_to_client' },
    { id: 'price_increase', label: 'Price increase', defaultRes: 'billable_to_client' },
    { id: 'restocking', label: 'Restocking', defaultRes: 'absorbed' },
    { id: 'cc_fee', label: 'CC fee', defaultRes: 'absorbed' },
    { id: 'vendor_discount', label: 'Vendor discount', defaultRes: 'refund_due_client' },
    { id: 'other', label: 'Other', defaultRes: 'pending' }
  ];

  function esc(s) { return typeof window.esc === 'function' ? window.esc(s) : String(s == null ? '' : s); }
  function escAttr(s) { return typeof window.escAttr === 'function' ? window.escAttr(s) : esc(s); }
  function escJs(s) {
    return typeof window.escJsStr === 'function' ? window.escJsStr(s) : String(s || '').replace(/'/g, "\\'");
  }
  function fmt(n) { return typeof window.formatMoney === 'function' ? window.formatMoney(n) : String(n); }
  function poNum(d) { return d.number || d.num || d.poNum || d.name || ''; }

  /** Firestore rejects undefined anywhere in update payloads — strip recursively. */
  function cchPoSanitizeForFirestore(val) {
    if (val === undefined) return undefined;
    if (val === null || typeof val !== 'object') return val;
    if (val instanceof Date) return val;
    if (typeof val.toDate === 'function') return val;
    if (Array.isArray(val)) {
      return val.map(function(item) { return cchPoSanitizeForFirestore(item); });
    }
    var out = {};
    Object.keys(val).forEach(function(k) {
      if (val[k] === undefined) return;
      out[k] = cchPoSanitizeForFirestore(val[k]);
    });
    return out;
  }

  async function cchPoUpdatePoDoc(ref, patch) {
    return ref.update(cchPoSanitizeForFirestore(patch));
  }

  /** getCachedBoards() returns a Firestore QuerySnapshot — normalize to {id,name}[] */
  async function cchPoBoardList(projectIdFilter) {
    if (projectIdFilter) return [{ id: projectIdFilter }];
    var raw = typeof window.getCachedBoards === 'function' ? await window.getCachedBoards() : null;
    if (raw && raw.docs && raw.docs.length) {
      return raw.docs.map(function(d) { return { id: d.id, name: (d.data() || {}).name }; });
    }
    if (Array.isArray(raw) && raw.length) return raw;
    var bs = await firebase.firestore().collection('boards').get();
    var out = [];
    bs.forEach(function(b) { out.push({ id: b.id, name: (b.data() || {}).name }); });
    return out;
  }

  /** Normalize PO # for per-project dedup (matches project PO tab). */
  function cchPoNormPoNumberKey(s) {
    return String(s || '').trim().replace(/^#/, '').toUpperCase();
  }

  function cchPoPoDedupeScore(po) {
    var s = 0;
    if (String(po.id || '').indexOf('clip-po-') !== 0) s += 1e6;
    if (typeof window.getQbId === 'function' && window.getQbId(po)) s += 1e5;
    if (po.bill && po.bill.received) s += 5e4;
    if (po.poLocked || po.poSentAt || po.sentAt) s += 2e4;
    s += (po.items || []).length * 100;
    var paid = typeof window.cchPoPaidTotal === 'function' ? window.cchPoPaidTotal(po) : 0;
    s += paid * 10;
    var ts = new Date(po.updatedAt || po.poSentAt || po.createdAt || 0).getTime();
    if (!isNaN(ts)) s += ts / 1e6;
    return s;
  }

  /** One row per PO # per project — hides duplicate Firestore docs (imports / clip-po stubs). */
  window.cchPoDedupePosByProjectNumber = function(allPos) {
    if (!allPos || !allPos.length) return { pos: allPos || [], hidden: 0 };
    var byPid = {};
    allPos.forEach(function(po) {
      var pid = po.projectId || '__none';
      if (!byPid[pid]) byPid[pid] = [];
      byPid[pid].push(po);
    });
    var out = [];
    var hidden = 0;
    Object.keys(byPid).forEach(function(pid) {
      var buckets = {};
      byPid[pid].forEach(function(po) {
        var k = cchPoNormPoNumberKey(po.number || po.num || po.poNum || '');
        if (!k) k = '__id:' + (po.id || '');
        if (!buckets[k]) buckets[k] = [];
        buckets[k].push(po);
      });
      Object.keys(buckets).forEach(function(k) {
        var arr = buckets[k];
        if (arr.length === 1) {
          out.push(arr[0]);
          return;
        }
        hidden += arr.length - 1;
        arr.sort(function(a, b) { return cchPoPoDedupeScore(b) - cchPoPoDedupeScore(a); });
        var keep = arr[0];
        keep._omDedupeSiblings = arr.length - 1;
        out.push(keep);
      });
    });
    return { pos: out, hidden: hidden };
  };

  /** Firm-wide PO load — same Firestore path as bill variances (not limited to loadFinancialData cache). */
  window.cchPoLoadAllPosForVendorBills = async function() {
    var boards = await cchPoBoardList();
    var projNames = {};
    boards.forEach(function(b) { projNames[b.id] = b.name || b.id; });
    var chunks = await Promise.all(boards.map(async function(board) {
      var bid = board.id;
      var bname = board.name || bid;
      var rows = [];
      try {
        var snap = await firebase.firestore().collection('boards').doc(bid).collection('purchaseOrders').get();
        snap.forEach(function(d) {
          var p = d.data() || {};
          rows.push(Object.assign({}, p, {
            id: d.id,
            projectId: bid,
            projectName: bname
          }));
        });
      } catch (_e) { /* skip board */ }
      return rows;
    }));
    var pos = [];
    chunks.forEach(function(part) { pos = pos.concat(part); });
    var deduped = window.cchPoDedupePosByProjectNumber(pos);
    return { pos: deduped.pos, projNames: projNames, dedupeHidden: deduped.hidden };
  };

  window.cchPoDocTotal = function(doc) {
    if (!doc) return 0;
    if (typeof window.cchPoMerchandiseTotal === 'function') {
      var merch = window.cchPoMerchandiseTotal(doc);
      if (merch > 0) return merch;
    }
    var t = parseFloat(doc.total);
    if (t > 0) return t;
    return (doc.items || []).reduce(function(s, it) {
      var q = parseFloat(it.qty) || 1;
      var c = parseFloat(it.cost) || 0;
      var sh = parseFloat(it.shipping) || 0;
      return s + (c > 0 ? c * q + sh : (parseFloat(it.amount) || 0) + sh);
    }, 0);
  };

  /** Freight, pre-paid tax, and vendor-bill-only charges — not PO line merchandise (labor/WT on PO stays). */
  window.cchPoLineIsBillOnlyExpense = function(it) {
    if (!it) return false;
    if (it._cchVendorPrepaidTax === true) return true;
    var et = String(it.expenseType || it.itemType || 'product').trim().toLowerCase();
    if (et === 'sales_tax' || et === 'shipping' || et === 'freight' || et === 'handling' || et === 'other_expense') return true;
    // Prepaid tax / pass-through fees on vendor bill — not PO merchandise
    if (et === 'expense') {
      var catE = String(it.category || '').trim().toLowerCase();
      if (/pre[- ]?paid tax|prepaid tax|freight|expense/.test(catE)) return true;
      var tE = String(it.title || it.name || '').trim().toLowerCase();
      if (/pre[- ]?paid|sales tax/.test(tE)) return true;
      return false;
    }
    var title = String(it.title || it.name || '').trim().toLowerCase();
    if (/^pre[- ]?paid sales tax|^sales tax pre/.test(title)) return true;
    return false;
  };

  window.cchPoLineMerchandiseAmount = function(it) {
    if (!it) return 0;
    if (typeof window.isProposalGroupHeaderItem === 'function' && window.isProposalGroupHeaderItem(it)) return 0;
    var et = String(it.expenseType || it.itemType || 'product').trim().toLowerCase();
    var qty = parseFloat(it.qty) || 1;
    var cost = parseFloat(it.cost) || 0;
    var ship = parseFloat(it.shipping) || 0;
    var amt = parseFloat(it.amount) || 0;
    if (!amt && typeof window.parseMoney === 'function') {
      var ts = window.parseMoney(it.totalSelling);
      if (ts > 0.005) amt = ts;
    }
    if (et === 'discount') {
      var disc = amt > 0.01 ? amt : (cost > 0 ? cost * qty : 0);
      return -Math.abs(Math.round((disc + ship) * 100) / 100);
    }
    if (window.cchPoLineIsBillOnlyExpense(it)) return 0;
    // Houzz PO lines: amount is the trade PO line total. cost can be duplicated; never apply markupPct on PO.
    if (amt > 0.01) return Math.round((amt + ship) * 100) / 100;
    if (cost > 0) return Math.round((cost * qty + ship) * 100) / 100;
    return Math.round(ship * 100) / 100;
  };

  /** Single PO display/save total — trade merchandise from lines, not client markup. */
  window.cchPoDisplayTotal = function(doc) {
    return window.cchPoMerchandiseTotal(doc);
  };

  /** PO line vendor — fall back to PO header when line field empty (legacy/sent POs). */
  window.cchPoLineDisplayVendor = function(item, doc) {
    var v = String(item && item.vendor || '').trim();
    if (v) return v;
    v = String(doc && doc.vendor || '').trim();
    if (v) return v;
    v = String(item && item.manufacturer || '').trim();
    return v;
  };

  /** Fill-empty-only: copy PO header vendor onto lines missing vendor. Returns true if any line changed. */
  window.cchPoHydrateLineVendorsFromDoc = function(items, doc) {
    if (!items || !items.length || !doc) return false;
    var poV = String(doc.vendor || '').trim();
    if (!poV) return false;
    var changed = false;
    items.forEach(function(it) {
      if (!it || String(it.vendor || '').trim()) return;
      it.vendor = poV;
      changed = true;
    });
    return changed;
  };

  /** PO list / variance baseline — merchandise only (no vendor tax or freight lines). */
  window.cchPoMerchandiseTotal = function(doc) {
    if (!doc) return 0;
    var items = doc.items || [];
    if (items.length) {
      var sum = items.reduce(function(s, it) {
        return s + window.cchPoLineMerchandiseAmount(it);
      }, 0);
      return Math.round(sum * 100) / 100;
    }
    var t = parseFloat(doc.total);
    return t > 0 ? t : 0;
  };

  window.cchPoLifecycleStatus = function(doc) {
    if (!doc) return 'draft';
    var s = String(doc.poStatus || '').trim().toLowerCase();
    if (doc.bill && doc.bill.received && s === 'bill_received') {
      var due = window.cchPoAmountDue(doc);
      if (due <= 0.02 && window.cchPoPaidTotal(doc) > 0.01) return 'paid';
    }
    if (s) return s;
    if (doc.paymentCleared && doc.paymentCleared.qbBillPaymentId) return 'cleared';
    if (doc.bill && doc.bill.received) return 'bill_received';
    if (String(doc.status || '').toLowerCase() === 'paid' || (parseFloat(doc.paidAmount) || 0) > 0.01) return 'paid';
    if (doc.poLocked || doc.qbDocId) return 'sent';
    return 'draft';
  };

  window.cchPoIsLocked = function(doc) {
    if (!doc) return false;
    if (doc.poLocked === true) return true;
    var st = window.cchPoLifecycleStatus(doc);
    return st !== 'draft' && st !== 'voided';
  };

  window.cchPoEmailPrefix = function() {
    var e = (window.currentUser && window.currentUser.email) || '';
    var p = e.split('@')[0] || 'user';
    return p.split('+')[0].toLowerCase();
  };

  /** Shipping / receiving lane only — not procurement (Sent/Waiting/Confirmed) or bill lifecycle. */
  var CCH_PO_PROCUREMENT_LEGACY_STATUS = {
    'Draft': true,
    'Sent': true,
    'Sent to Vendor': true,
    'Waiting for Confirmation': true,
    'Confirmed': true
  };

  var CCH_PO_SHIPPING_STATUSES = [
    { id: 'Pending', label: 'Pending' },
    { id: 'Back ordered', label: 'Back ordered' },
    { id: 'Est. ship scheduled', label: 'Est. ship scheduled' },
    { id: 'Ordered', label: 'Ordered' },
    { id: 'Shipped', label: 'Shipped' },
    { id: 'In transit', label: 'In transit' },
    { id: 'Delivered', label: 'Delivered' },
    { id: 'At Receiver', label: 'At receiver', needsLocation: 'receiver' },
    { id: 'At Workroom', label: 'At workroom', needsLocation: 'workroom' },
    { id: 'Received', label: 'Received (goods in)' },
    { id: 'Installed', label: 'Installed' },
    { id: 'On Hold', label: 'On hold' },
    { id: 'Cancelled', label: 'Cancelled' }
  ];

  /** @deprecated alias — use CCH_PO_SHIPPING_STATUSES */
  var CCH_PO_FULFILLMENT_STATUSES = CCH_PO_SHIPPING_STATUSES;

  function cchPoShippingStatusDef(statusId) {
    var s = String(statusId || '').trim();
    for (var i = 0; i < CCH_PO_SHIPPING_STATUSES.length; i++) {
      if (CCH_PO_SHIPPING_STATUSES[i].id === s) return CCH_PO_SHIPPING_STATUSES[i];
    }
    return null;
  }

  function cchPoFulfillmentStatusDef(statusId) {
    return cchPoShippingStatusDef(statusId);
  }

  function cchPoShippingStatusCanonicalId(current) {
    var cur = String(current || '').trim();
    if (!cur) return '';
    for (var i = 0; i < CCH_PO_SHIPPING_STATUSES.length; i++) {
      if (CCH_PO_SHIPPING_STATUSES[i].id.toLowerCase() === cur.toLowerCase()) {
        return CCH_PO_SHIPPING_STATUSES[i].id;
      }
    }
    return cur;
  }

  function cchPoFulfillmentStatusCanonicalId(current) {
    return cchPoShippingStatusCanonicalId(current);
  }

  /** Shipping lane active after vendor confirmation (or legacy shipping status on PO). */
  window.cchPoShippingLaneActive = function(doc) {
    doc = doc || {};
    if (window.cchPoProcurementLaneId(doc) === 'confirmed') return true;
    if (String(doc.shippingStatus || '').trim()) return true;
    var leg = String(doc.status || '').trim();
    return !!(leg && !CCH_PO_PROCUREMENT_LEGACY_STATUS[leg]);
  };

  function cchPoInferShippingStatusFromGroups(doc, poItems) {
    doc = doc || {};
    var groups = typeof window.cchPoVendorInvoiceGroupsDisplay === 'function'
      ? window.cchPoVendorInvoiceGroupsDisplay(doc, poItems || doc.items || [])
      : (Array.isArray(doc.vendorInvoiceGroups) ? doc.vendorInvoiceGroups : []);
    var rank = {
      'Cancelled': 0,
      'On Hold': 1,
      'Pending': 2,
      'Back ordered': 3,
      'Est. ship scheduled': 4,
      'Ordered': 5,
      'Shipped': 6,
      'In transit': 7,
      'Delivered': 8,
      'At Receiver': 9,
      'At Workroom': 9,
      'Received': 10,
      'Installed': 11
    };
    var best = '';
    var bestR = -1;
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i] || {};
      if (String(g.documentType || '').trim() === 'confirmation') continue;
      var st = cchPoShippingStatusCanonicalId(String(g.status || '').trim());
      if (!cchPoShippingStatusDef(st)) continue;
      var r = Object.prototype.hasOwnProperty.call(rank, st) ? rank[st] : 5;
      if (r > bestR) {
        bestR = r;
        best = st;
      }
    }
    return best;
  }

  /** Canonical shipping / receiving status (field: shippingStatus; legacy status only if valid ship value). */
  window.cchPoShippingStatus = function(doc, poItems) {
    doc = doc || {};
    var explicit = String(doc.shippingStatus || '').trim();
    if (explicit) {
      var explicitCanon = cchPoShippingStatusCanonicalId(explicit);
      if (cchPoShippingStatusDef(explicitCanon)) return explicitCanon;
    }
    var leg = String(doc.status || '').trim();
    if (leg) {
      var legCanon = cchPoShippingStatusCanonicalId(leg);
      if (cchPoShippingStatusDef(legCanon)) return legCanon;
    }
    var inferred = cchPoInferShippingStatusFromGroups(doc, poItems);
    if (inferred) return inferred;
    if (window.cchPoProcurementLaneId(doc) === 'confirmed') return 'Pending';
    return '';
  };

  window.cchPoShippingStatusLabel = function(doc, poItems) {
    doc = doc || {};
    var st = window.cchPoShippingStatus(doc, poItems);
    if (st) return st;
    if (window.cchPoShippingLaneActive(doc)) return 'Pending';
    return '—';
  };

  /** Milestone index for shipping lane chips: 0 Pending · 1 Shipped · 2 Received */
  window.cchPoShippingMilestoneIndex = function(doc, poItems) {
    var st = String(window.cchPoShippingStatus(doc, poItems) || '').trim().toLowerCase();
    if (!st || st === 'pending' || st === 'back ordered' || st === 'est. ship scheduled' ||
        st === 'ordered' || st === 'on hold') return 0;
    if (st === 'shipped' || st === 'in transit' || st === 'delivered' ||
        st === 'at receiver' || st === 'at workroom') return 1;
    if (st === 'received' || st === 'installed') return 2;
    if (st === 'cancelled') return 0;
    return 0;
  };

  /** Shipping / FFE order status — prefers shippingStatus over legacy status. */
  window.cchPoDisplayStatus = function(doc) {
    if (!doc) return '';
    return window.cchPoShippingStatus(doc);
  };

  window.cchPoSaveShippingStatusFromSelect = async function(projectId, poId, el) {
    if (!el) return;
    var status = String(el.value || '').trim();
    var prev = el.getAttribute('data-prev-status') || '';
    if (!status) {
      el.value = prev;
      return;
    }
    el.disabled = true;
    try {
      var extras = { location: '' };
      if (status === 'At Receiver' || status === 'At Workroom') {
        var label = status === 'At Receiver' ? 'receiver' : 'workroom';
        var snap = await firebase.firestore().collection('boards').doc(projectId)
          .collection('purchaseOrders').doc(poId).get();
        var doc = snap.exists ? (snap.data() || {}) : {};
        var existing = status === 'At Receiver'
          ? String(doc.receiver || doc.location || '').trim()
          : String(doc.workroom || doc.location || '').trim();
        var loc = existing;
        if (!loc && typeof window.cchPrompt === 'function') {
          loc = await window.cchPrompt('Enter ' + label + ' name:', '', 'Receiving location');
        }
        if (!loc) {
          el.value = prev;
          return;
        }
        extras.location = String(loc).trim();
      }
      await window.cchPoSetFulfillmentStatus(projectId, poId, status, extras);
      el.setAttribute('data-prev-status', status);
    } catch (e) {
      el.value = prev;
      if (typeof window.cchAlert === 'function') await window.cchAlert(e.message || e, 'Shipping status');
    } finally {
      el.disabled = false;
    }
  };

  /** One-tap receiver check-in (PO page + matches Airtable receiving statuses). */
  window.cchPoQuickSetShippingStatus = async function(projectId, poId, status) {
    status = String(status || '').trim();
    if (!status) return;
    var def = cchPoShippingStatusDef(status);
    var extras = { location: '' };
    try {
      var snap = await firebase.firestore().collection('boards').doc(projectId)
        .collection('purchaseOrders').doc(poId).get();
      var doc = snap.exists ? (snap.data() || {}) : {};
      if (def && def.needsLocation) {
        var existing = def.needsLocation === 'receiver'
          ? String(doc.receiver || doc.location || '').trim()
          : String(doc.workroom || doc.location || '').trim();
        if (existing) extras.location = existing;
        else {
          var label = def.needsLocation === 'receiver' ? 'receiver' : 'workroom';
          var loc = typeof window.cchPrompt === 'function'
            ? await window.cchPrompt('Enter ' + label + ' name:', '', 'Receiving location') : '';
          if (!loc) return;
          extras.location = String(loc).trim();
        }
      } else if (status === 'Delivered' || status === 'Received' || status === 'Installed') {
        extras.location = String(doc.receiver || doc.workroom || doc.location || '').trim();
      }
      await window.cchPoSetFulfillmentStatus(projectId, poId, status, extras);
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert(e.message || e, 'Shipping status');
    }
  };

  /** Inline ship-status dropdown for lists (All POs, Order Management). */
  window.cchPoShippingStatusEditorCellHtml = function(po) {
    po = po || {};
    if (typeof window.cchPoShippingLaneActive === 'function' && !window.cchPoShippingLaneActive(po)) {
      return '<span style="font-size:11px;color:var(--gray-400);">—</span>';
    }
    var pid = escAttr(po.projectId);
    var poid = escAttr(po.id);
    var cur = typeof window.cchPoShippingStatus === 'function'
      ? window.cchPoShippingStatus(po, po.items || []) : '';
    var optsHtml = typeof window.cchPoFulfillmentStatusOptionsHtml === 'function'
      ? window.cchPoFulfillmentStatusOptionsHtml(cur) : '';
    return '<select class="form-input" style="font-size:11px;padding:4px 28px 4px 8px;min-width:148px;max-width:210px;" ' +
      'data-prev-status="' + escAttr(cur) + '" onclick="event.stopPropagation()" ' +
      'onfocus="this.setAttribute(\'data-prev-status\',this.value)" ' +
      'onchange="window.cchPoSaveShippingStatusFromSelect(\'' + pid + '\',\'' + poid + '\',this)" ' +
      'title="Shipping / receiving — syncs to FFE tracker">' + optsHtml + '</select>';
  };

  window.cchPoFulfillmentStatusOptionsHtml = function(current) {
    current = String(current || '').trim();
    var canonical = cchPoShippingStatusCanonicalId(current);
    if (!cchPoShippingStatusDef(canonical)) canonical = '';
    var html = '<option value="">— Not set —</option>';
    html += CCH_PO_SHIPPING_STATUSES.map(function(st) {
      return '<option value="' + escAttr(st.id) + '"' + (canonical === st.id ? ' selected' : '') + '>' + esc(st.label) + '</option>';
    }).join('');
    return html;
  };

  window.cchPoShippingStatusBadgeHtml = function(doc, opts) {
    opts = opts || {};
    doc = doc || {};
    var label = window.cchPoShippingStatusLabel(doc);
    if (label === '—') {
      return '<span style="font-size:11px;color:var(--gray-400);">—</span>';
    }
    var inner = typeof window.statusBadge === 'function'
      ? window.statusBadge(label)
      : ('<span class="badge badge-draft">' + esc(label) + '</span>');
    if (!opts.clickable || !opts.projectId || !opts.poId) return inner;
    if (!window.cchPoShippingLaneActive(doc)) return inner;
    return '<span role="button" tabindex="0" title="Change shipping / receiving status" style="cursor:pointer;display:inline-block;" ' +
      'onclick="event.stopPropagation();cchPoOpenStatusModal(\'' + escJs(opts.projectId) + '\',\'' + escJs(opts.poId) + '\')">' +
      inner + '</span>';
  };

  window.cchPoFulfillmentStatusBadgeHtml = function(doc, opts) {
    return window.cchPoShippingStatusBadgeHtml(doc, opts);
  };

  window.cchPoFulfillmentStatusEditorHtml = function(projectId, poId, doc, opts) {
    opts = opts || {};
    doc = doc || {};
    var cur = window.cchPoShippingStatus(doc, doc.items || []);
    var loc = String(doc.receiver || doc.workroom || doc.location || '').trim();
    var def = cchPoShippingStatusDef(cur);
    var showLoc = def && def.needsLocation;
    var uid = opts.uid || ('cchPoFulfill_' + String(poId || '').replace(/[^\w]/g, '').slice(0, 12));
    return '<div class="cch-po-fulfill-status" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;' + (opts.compact ? 'font-size:11px;' : '') + '">' +
      '<label style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#5C6B80;white-space:nowrap;">' + esc(opts.label || 'Shipping / receiving') + '</label>' +
      '<select id="' + uid + '_sel" class="form-input" style="max-width:240px;font-size:12px;padding:6px 10px;color:#1B3352;background:#fff;" ' +
        'onchange="cchPoFulfillmentStatusSelectChanged(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',\'' + uid + '\')">' +
        window.cchPoFulfillmentStatusOptionsHtml(cur) +
      '</select>' +
      '<input type="text" id="' + uid + '_loc" class="form-input" placeholder="Receiver / workroom name" value="' + escAttr(loc) + '" ' +
        'style="max-width:200px;font-size:12px;padding:6px 10px;' + (showLoc ? '' : 'display:none;') + '" ' +
        'onkeydown="if(event.key===\'Enter\'){event.preventDefault();cchPoSaveFulfillmentStatus(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',\'' + uid + '\');}">' +
      (opts.showSaveButton !== false
        ? '<button type="button" class="btn btn-secondary btn-sm" style="font-size:11px;" onclick="cchPoSaveFulfillmentStatus(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',\'' + uid + '\')">Update</button>'
        : '') +
      '</div>';
  };

  window.cchPoFulfillmentStatusSelectChanged = function(projectId, poId, uid) {
    var sel = document.getElementById(uid + '_sel');
    var locEl = document.getElementById(uid + '_loc');
    if (!sel || !locEl) return;
    var def = cchPoFulfillmentStatusDef(sel.value);
    locEl.style.display = def && def.needsLocation ? '' : 'none';
  };

  window.cchPoAfterFulfillmentStatusSaved = async function(projectId, poId) {
    if (typeof window.invalidateSearchCache === 'function') window.invalidateSearchCache();
    if (typeof window._cacheTime !== 'undefined') window._cacheTime = 0;
    var h = window.location.hash || '';
    if ((h.indexOf('/vendorbills') >= 0 || h.indexOf('/ordermanagement') >= 0) &&
        typeof window.cchPoRefreshFinancePage === 'function') {
      if (h.indexOf('/ordermanagement') >= 0 && window._omInlineSaveActive) return;
      window.cchPoRefreshFinancePage();
      return;
    }
    if (h.indexOf('/po/' + poId) >= 0 && typeof window.renderDocViewPage === 'function') {
      try {
        var snap = await firebase.firestore().collection('boards').doc(projectId)
          .collection('purchaseOrders').doc(poId).get();
        if (snap.exists) {
          var data = snap.data() || {};
          var items = data.items || [];
          var proj = {};
          if (typeof window.getCachedBoards === 'function') {
            var boards = await window.getCachedBoards();
            if (boards && boards.docs) {
              boards.docs.forEach(function(b) { if (b.id === projectId) proj = b.data() || {}; });
            }
          }
          window.renderDocViewPage('po', projectId, poId, data, items, proj);
          return;
        }
      } catch (_e) {}
    }
    if (h.indexOf('/project/') >= 0 && typeof window.renderProjectDetail === 'function') {
      window.renderProjectDetail();
    } else if (typeof window.renderAllPOs === 'function') {
      window.renderAllPOs();
    }
  };

  function cchPoFulfillmentToClipOrderStatus(poStatus) {
    var map = {
      'Pending': 'Ordered',
      'Back ordered': 'Ordered',
      'Est. ship scheduled': 'Ordered',
      'Ordered': 'Ordered',
      'Shipped': 'Shipped',
      'In transit': 'Shipped',
      'At Receiver': 'At Receiver',
      'At Workroom': 'At Workroom',
      'Delivered': 'Received',
      'Received': 'Received',
      'Installed': 'Installed',
      'On Hold': '',
      'Cancelled': 'Cancelled'
    };
    var s = String(poStatus || '').trim();
    return Object.prototype.hasOwnProperty.call(map, s) ? map[s] : s;
  }
  window.cchPoFulfillmentToClipOrderStatus = cchPoFulfillmentToClipOrderStatus;

  function cchPoClipOrderStatusToFulfillment(clipStatus) {
    var s = String(clipStatus || '').trim();
    if (!s) return null;
    var map = {
      'Ordered': 'Ordered',
      'Shipped': 'Shipped',
      'At Receiver': 'At Receiver',
      'At Workroom': 'At Workroom',
      'Received': 'Received',
      'Installed': 'Installed',
      'Cancelled': 'Cancelled'
    };
    return map[s] || s;
  }

  function cchPoPoNumbersMatch(a, b) {
    a = String(a || '').trim().replace(/\s+/g, '');
    b = String(b || '').trim().replace(/\s+/g, '');
    if (!a || !b) return false;
    return a === b || a.replace(/^PO-?/i, '') === b.replace(/^PO-?/i, '');
  }

  async function cchPoFindLinkedClips(projectId, poId, poDoc) {
    var poNumber = poNum(poDoc);
    var snap = await firebase.firestore().collection('boards').doc(projectId).collection('clips').get();
    var out = [];
    snap.forEach(function(d) {
      var c = d.data() || {};
      var linked = (c.poId === poId || c.purchaseOrderId === poId);
      if (!linked && poNumber) {
        var cn = String(c.poNum || c.houzzPO || c.purchaseOrderNum || c.po || '').trim();
        linked = cchPoPoNumbersMatch(cn, poNumber);
      }
      if (linked) out.push({ id: d.id, data: c });
    });
    return out;
  }

  async function cchPoFindPoDocForClip(projectId, clip) {
    clip = clip || {};
    var poId = clip.poId || clip.purchaseOrderId;
    if (poId) {
      var snap = await firebase.firestore().collection('boards').doc(projectId)
        .collection('purchaseOrders').doc(poId).get();
      if (snap.exists) return { id: snap.id, data: snap.data() || {} };
    }
    var cn = String(clip.poNum || clip.houzzPO || clip.purchaseOrderNum || '').trim();
    if (!cn) return null;
    var pos = await firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').get();
    var hit = null;
    pos.forEach(function(d) {
      if (hit) return;
      var p = d.data() || {};
      if (cchPoPoNumbersMatch(poNum(p), cn)) hit = { id: d.id, data: p };
    });
    return hit;
  }

  window.cchPoSyncFulfillmentToLinkedClips = async function(projectId, poId, poDoc, status, extras) {
    extras = extras || {};
    poDoc = poDoc || {};
    var clipStatus = cchPoFulfillmentToClipOrderStatus(status);
    if (!clipStatus) return 0;
    var clips = await cchPoFindLinkedClips(projectId, poId, poDoc);
    if (!clips.length) return 0;
    var now = new Date().toISOString();
    var batch = firebase.firestore().batch();
    var n = 0;
    clips.forEach(function(row) {
      var patch = { orderStatus: clipStatus, updatedAt: now, orderStatusSyncedFromPo: poId };
      if (extras.location) {
        var def = cchPoFulfillmentStatusDef(status);
        if (def && def.needsLocation === 'receiver') patch.receiver = extras.location;
        if (def && def.needsLocation === 'workroom') patch.workroom = extras.location;
      }
      batch.update(firebase.firestore().collection('boards').doc(projectId).collection('clips').doc(row.id), patch);
      n++;
    });
    if (n) await batch.commit();
    return n;
  };

  window.cchPoSyncClipOrderStatusToPo = async function(projectId, clipId, clipOrderStatus) {
    var clipSnap = await firebase.firestore().collection('boards').doc(projectId).collection('clips').doc(clipId).get();
    if (!clipSnap.exists) return;
    var clip = clipSnap.data() || {};
    var poHit = await cchPoFindPoDocForClip(projectId, clip);
    if (!poHit) return;
    var fulfill = cchPoClipOrderStatusToFulfillment(clipOrderStatus);
    if (!fulfill) return;
    var cur = window.cchPoShippingStatus(poHit.data);
    if (cur === fulfill) return;
    await firebase.firestore().collection('boards').doc(projectId)
      .collection('purchaseOrders').doc(poHit.id).update({
        shippingStatus: fulfill,
        status: fulfill,
        updatedAt: new Date().toISOString()
      });
  };

  window.cchPoSetFulfillmentStatus = async function(projectId, poId, status, extras) {
    extras = extras || {};
    status = String(status || '').trim();
    var patch = { updatedAt: new Date().toISOString() };
    if (!status) {
      patch.shippingStatus = '';
      patch.status = '';
    } else {
      patch.shippingStatus = status;
      patch.status = status;
    }
    var def = cchPoFulfillmentStatusDef(status);
    var loc = String(extras.location || '').trim();
    if (def && def.needsLocation && loc) {
      patch.location = loc;
      if (def.needsLocation === 'receiver') {
        patch.receiver = loc;
        patch.workroom = firebase.firestore.FieldValue.delete();
      } else if (def.needsLocation === 'workroom') {
        patch.workroom = loc;
        patch.receiver = firebase.firestore.FieldValue.delete();
      }
    }
    if (status === 'Delivered' || status === 'Received' || status === 'Installed') {
      if (loc) patch.location = loc;
    }
    await firebase.firestore().collection('boards').doc(projectId)
      .collection('purchaseOrders').doc(poId).update(patch);
    var poSnap = await firebase.firestore().collection('boards').doc(projectId)
      .collection('purchaseOrders').doc(poId).get();
    var poDoc = poSnap.data() || {};
    var synced = 0;
    try {
      synced = await window.cchPoSyncFulfillmentToLinkedClips(projectId, poId, poDoc, status, extras);
    } catch (_sync) {}
    if (typeof window.logDocActivity === 'function') {
      await window.logDocActivity(projectId, 'purchaseOrders', poId, 'status_changed',
        (status ? 'Shipping status → ' + status : 'Shipping status cleared') + (loc ? ' (' + loc + ')' : '') + (synced ? ' · ' + synced + ' FFE item(s)' : ''));
    }
    var toastMsg = status ? ('Shipping status: ' + status) : 'Shipping status cleared';
    if (synced) toastMsg += ' · synced to ' + synced + ' tracker item' + (synced > 1 ? 's' : '');
    if (typeof window.showToast === 'function') window.showToast(toastMsg, 'success');
    await window.cchPoAfterFulfillmentStatusSaved(projectId, poId);
  };

  window.cchPoSaveFulfillmentStatus = async function(projectId, poId, uid) {
    var sel = document.getElementById(uid + '_sel');
    var locEl = document.getElementById(uid + '_loc');
    if (!sel) return;
    var status = sel.value;
    var def = cchPoFulfillmentStatusDef(status);
    var loc = locEl ? String(locEl.value || '').trim() : '';
    if (def && def.needsLocation && !loc) {
      var label = def.needsLocation === 'receiver' ? 'receiver' : 'workroom';
      if (typeof window.cchPrompt === 'function') {
        loc = await window.cchPrompt('Enter ' + label + ' name:', loc, 'PO location');
      }
      if (!loc) {
        if (typeof window.cchAlert === 'function') {
          await window.cchAlert('Enter a ' + label + ' name for this status.', 'PO status');
        }
        return;
      }
      if (locEl) locEl.value = loc;
    }
    try {
      await window.cchPoSetFulfillmentStatus(projectId, poId, status, { location: loc });
      var modal = document.getElementById('cchPoStatusModal');
      if (modal) modal.remove();
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert(e.message || e, 'PO status');
    }
  };

  window.cchPoOpenStatusModal = async function(projectId, poId) {
    try {
      var snap = await firebase.firestore().collection('boards').doc(projectId)
        .collection('purchaseOrders').doc(poId).get();
      if (!snap.exists) {
        if (typeof window.cchAlert === 'function') await window.cchAlert('PO not found.', 'PO status');
        return;
      }
      var doc = snap.data() || {};
      if (!window.cchPoShippingLaneActive(doc)) {
        if (typeof window.cchAlert === 'function') {
          await window.cchAlert('Shipping / receiving status applies after the PO is confirmed with the vendor (order conf #).', 'Shipping status');
        }
        return;
      }
      var uid = 'cchPoFulfillModal';
      var editor = window.cchPoFulfillmentStatusEditorHtml(projectId, poId, doc, { uid: uid, label: 'Status', showSaveButton: false });
      var html = '<div id="cchPoStatusModal" style="position:fixed;inset:0;background:rgba(15,26,46,0.45);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target===this)this.remove()">' +
        '<div style="background:#fff;max-width:480px;width:100%;padding:24px;border-radius:4px;box-shadow:0 16px 48px rgba(0,0,0,0.2);" onclick="event.stopPropagation()">' +
        '<h3 style="margin:0 0 8px;font-size:18px;">Shipping / receiving</h3>' +
        '<p style="font-size:12px;color:#5C6B80;margin:0 0 16px;line-height:1.45;">Track vendor ship, transit, receiver, and delivery. Updates linked items in the <strong>FFE tracker</strong>. Separate from PO confirmation and vendor bill / QuickBooks.</p>' +
        editor +
        '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:18px;">' +
        '<button type="button" class="btn btn-secondary" onclick="document.getElementById(\'cchPoStatusModal\').remove()">Cancel</button>' +
        '<button type="button" class="btn btn-primary" onclick="cchPoSaveFulfillmentStatus(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',\'' + uid + '\')">Save</button>' +
        '</div></div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
      window.cchPoFulfillmentStatusSelectChanged(projectId, poId, uid);
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert(e.message || e, 'PO status');
    }
  };

  async function cchPoWriteNotification(projectId, payload) {
    payload = Object.assign({
      createdAt: new Date().toISOString(),
      seenBy: []
    }, payload);
    await firebase.firestore().collection('boards').doc(projectId).collection('notifications').add(payload);
  }

  window.cchPoVendorBillTotal = function(doc) {
    if (!doc) return 0;
    var bill = doc.bill || {};
    if (bill.billTotal != null && (bill.received || bill.qbBillId || (bill.vendorInvoices && bill.vendorInvoices.length))) {
      return parseFloat(bill.billTotal) || 0;
    }
    if (doc.poTotalAtSend != null) return parseFloat(doc.poTotalAtSend) || 0;
    return window.cchPoDocTotal(doc);
  };

  window.cchPoPaidTotal = function(doc) {
    if (!doc) return 0;
    return (doc.payments || []).reduce(function(s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
  };

  /** True when a Studio vendor bill exists (receive bill / QB bill sync) — not legacy Houzz PO-only. */
  window.cchPoStudioBillActive = function(doc) {
    doc = doc || {};
    var bill = doc.bill || {};
    return !!(bill.received || bill.qbBillId || bill.billTotal != null);
  };

  /** Paid to vendor for balance — Studio bill uses payments[] only; legacy Houzz PO uses clip/paidAmount fallback. */
  window.cchPoVendorBillPaidAmount = function(doc) {
    if (!doc) return 0;
    var paid = window.cchPoPaidTotal(doc);
    if (window.cchPoStudioBillActive(doc)) return paid;
    if (typeof window.poResolvedPaidAmount === 'function') {
      paid = Math.max(paid, window.poResolvedPaidAmount(doc) || 0);
    }
    return paid;
  };

  window.cchPoAmountDue = function(doc) {
    return Math.max(0, Math.round((window.cchPoVendorBillTotal(doc) - window.cchPoVendorBillPaidAmount(doc)) * 100) / 100);
  };

  /** All POs list: PO document total (not vendor bill). */
  window.cchPoListPoTotal = function(po) {
    if (!po) return 0;
    if (typeof window.cchPoMerchandiseTotal === 'function') {
      var merch = window.cchPoMerchandiseTotal(po);
      if (merch > 0 || (po.items && po.items.length)) return merch;
    }
    var t = parseFloat(po.total);
    if (t > 0) return t;
    return window.cchPoDocTotal(po);
  };

  /** PO total locked at send — baseline for variance. */
  window.cchPoListPoAtSend = function(po) {
    if (!po) return 0;
    var bill = po.bill || {};
    if (bill.poTotalAtSend != null) return parseFloat(bill.poTotalAtSend) || 0;
    if (po.poTotalAtSend != null) return parseFloat(po.poTotalAtSend) || 0;
    return window.cchPoListPoTotal(po);
  };

  /** Vendor bill total when a bill exists; otherwise null. */
  window.cchPoListBillTotalForRow = function(po) {
    if (!po) return null;
    var bill = po.bill || {};
    if (bill.received || bill.billTotal != null) return window.cchPoVendorBillTotal(po);
    return null;
  };

  /** Vendor bill minus PO at send. Null when no bill and no stored variance. */
  window.cchPoListVarianceForRow = function(po) {
    if (!po) return null;
    var billTotal = window.cchPoListBillTotalForRow(po);
    if (billTotal != null) {
      var v = Math.round((billTotal - window.cchPoListPoAtSend(po)) * 100) / 100;
      return Math.abs(v) >= 0.01 ? v : 0;
    }
    if (po.variance && po.variance.amount != null) {
      var stored = parseFloat(po.variance.amount) || 0;
      return Math.abs(stored) >= 0.01 ? stored : null;
    }
    return null;
  };

  /** Paid to vendor — payments[] plus legacy paidAmount / Houzz clip fallback. */
  window.cchPoListPaidForRow = function(po) {
    if (!po) return 0;
    return window.cchPoVendorBillPaidAmount(po);
  };

  /** Balance due — vendor bill balance when billed; else open PO total minus recorded pay (never negative). */
  window.cchPoListBalanceForRow = function(po) {
    if (!po) return 0;
    if (po.bill && po.bill.received) {
      return window.cchPoAmountDue(po);
    }
    var poTotal = window.cchPoListPoTotal(po);
    var paid = window.cchPoListPaidForRow(po);
    if (paid > 0.01) {
      return Math.max(0, Math.round((poTotal - paid) * 100) / 100);
    }
    return poTotal;
  };

  /**
   * Displayed "Total" for PO list pages so each row reconciles: Total − Paid = Balance.
   * Balance and Paid are already authoritative — vendor bill (incl. vendor tax +
   * shipping/freight) when a bill exists, PO merchandise total otherwise — so the
   * shown total is simply their sum. This makes the Total column pick up tax +
   * shipping whenever a vendor bill is received, and equal the PO total otherwise,
   * WITHOUT changing cchPoListPoTotal (the variance baseline) or the Balance itself.
   */
  window.cchPoListDisplayTotal = function(po) {
    if (!po) return 0;
    var bal = window.cchPoListBalanceForRow(po) || 0;
    var paid = window.cchPoListPaidForRow(po) || 0;
    return Math.round((bal + paid) * 100) / 100;
  };

  /** Short single-line ship-to label for PO lists (client, workroom, receiver, job site, etc.). */
  window.cchPoListShipToLabel = function(po) {
    po = po || {};
    var raw = String(po.shipTo || po.deliverTo || '').trim();
    if (!raw) {
      var items = po.items || [];
      var seen = {};
      var fromLines = [];
      items.forEach(function(it) {
        var s = String((it && (it.shipTo || it.deliverTo)) || '').trim();
        if (s && !seen[s]) {
          seen[s] = true;
          fromLines.push(s);
        }
      });
      if (fromLines.length === 1) raw = fromLines[0];
      else if (fromLines.length > 1) return fromLines.map(function(s) { return window.cchPoListShipToLabel({ shipTo: s }); }).join(' · ');
    }
    if (!raw) raw = String(po.workroom || po.receiver || po.location || '').trim();
    if (!raw) {
      var st = String(po.status || '').toLowerCase();
      var loc = String(po.location || '').trim();
      if ((st === 'at workroom' || st === 'at receiver') && loc) raw = loc;
    }
    if (!raw) return '';

    function shortLabel(s) {
      s = String(s || '').trim();
      if (!s) return '';
      var line = s.split('\n')[0].trim();
      if (line.indexOf('·') >= 0 || line.indexOf('\u00b7') >= 0) line = line.split(/[·\u00b7]/)[0].trim();
      return line;
    }

    var label = shortLabel(raw);
    var low = label.toLowerCase().replace(/\s+/g, ' ').trim();
    if (low === 'client' || low === 'client home' || low === 'billing' || /^client\s*\(?use billing/.test(low)) {
      var cn = String(po.clientName || '').trim();
      if (cn) return cn;
      if (po.projectName && String(po.projectName).indexOf(' - ') >= 0) {
        return String(po.projectName).split(' - ')[0].trim();
      }
      return 'Client';
    }
    if (low.indexOf('job site') >= 0 || low === 'jobsite' || low === 'client job site') return 'Job site';
    if (low === 'cch' || low === 'cch office' || low === 'cch design studio' || low === 'cch design') return 'CCH Design Studio';
    if (low === 'vh' || low === 'vh warehouse' || low === 'vessel home') return 'VH Warehouse';
    if (/^workroom:/i.test(label)) return label.replace(/^workroom:\s*/i, '');
    if (/^receiver:/i.test(label)) return label.replace(/^receiver:\s*/i, '');
    return label;
  };

  /** Multiline remit-to / vendor address from a vendors catalog record. */
  window.cchVendorCatalogAddressText = function(v) {
    if (!v) return '';
    if (typeof window.cchComposeAddressMultiline === 'function' &&
        typeof window.cchAddressPartsFromRecord === 'function' &&
        typeof window.cchCoerceStructuredAddressParts === 'function') {
      var composed = window.cchComposeAddressMultiline(
        window.cchCoerceStructuredAddressParts(window.cchAddressPartsFromRecord(v))
      );
      if (composed) return composed;
    }
    return String(v.address || v.vendorAddress || '').trim();
  };

  /** Find vendor by display name (cache, then Firestore). */
  window.cchLookupVendorRecordByName = async function(name) {
    name = String(name || '').trim();
    if (!name) return null;
    var low = name.toLowerCase();
    try {
      if (typeof vendorsCache !== 'undefined' && vendorsCache && vendorsCache.length) {
        var hit = vendorsCache.find(function(v) {
          return v && String(v.name || '').trim().toLowerCase() === low;
        });
        if (hit) return hit;
      }
    } catch (_cacheErr) { /* ignore */ }
    try {
      var snap = await db.collection('vendors').where('name', '==', name).limit(1).get();
      if (!snap.empty) {
        var d0 = snap.docs[0];
        return Object.assign({ id: d0.id }, d0.data());
      }
      var all = await db.collection('vendors').get();
      var found = null;
      all.forEach(function(d) {
        if (found) return;
        var v = d.data() || {};
        if (String(v.name || '').trim().toLowerCase() === low) {
          found = Object.assign({ id: d.id }, v);
        }
      });
      return found;
    } catch (e) {
      console.warn('[cchLookupVendorRecordByName]', e);
      return null;
    }
  };

  /** PO vendor address: saved on doc, else vendors catalog. */
  window.cchPoVendorAddressResolved = async function(docData) {
    docData = docData || {};
    var stored = String(docData.vendorAddress || '').trim();
    if (stored) return stored;
    var vend = String(docData.vendor || '').trim();
    if (!vend) return '';
    var rec = await window.cchLookupVendorRecordByName(vend);
    return window.cchVendorCatalogAddressText(rec);
  };

  /**
   * PO vendor contact: { name, address, phone, email }.
   * Prefers values on the PO doc (vendor name, vendorAddress, vendor-specific
   * vendorPhone/vendorEmail), then fills any missing field from the vendors
   * catalog by vendor name. Vendor phone/email field names per grounding
   * (index.html ~57894): phone = v.phone || v.contactPhone || v.tel;
   * email = v.email || v.contactEmail. Never throws — returns a partial object.
   * NOTE: docData.phone / docData.email are CLIENT contact on PO docs, so they
   * are intentionally NOT read here.
   */
  window.cchPoVendorContactResolved = async function(docData) {
    docData = docData || {};
    var out = {
      name: String(docData.vendor || '').trim(),
      address: '',
      phone: String(docData.vendorPhone || '').trim(),
      email: String(docData.vendorEmail || '').trim()
    };
    try {
      if (typeof window.cchPoVendorAddressResolved === 'function') {
        out.address = String(await window.cchPoVendorAddressResolved(docData) || '').trim();
      } else {
        out.address = String(docData.vendorAddress || '').trim();
      }
    } catch (_eAddr) {
      out.address = String(docData.vendorAddress || '').trim();
    }
    try {
      if (out.name && (!out.phone || !out.email || !out.address) &&
          typeof window.cchLookupVendorRecordByName === 'function') {
        var rec = await window.cchLookupVendorRecordByName(out.name);
        if (rec) {
          if (!out.phone) out.phone = String(rec.phone || rec.contactPhone || rec.tel || '').trim();
          if (!out.email) out.email = String(rec.email || rec.contactEmail || '').trim();
          if (!out.address && typeof window.cchVendorCatalogAddressText === 'function') {
            out.address = String(window.cchVendorCatalogAddressText(rec) || '').trim();
          }
        }
      }
    } catch (_eRec) { /* graceful: keep whatever we have */ }
    return out;
  };

  /**
   * SYNC vendor bill-to block HTML: bold name, multiline address, then Phone /
   * Email lines ONLY when present (no empty labels). opts: { labelColor,
   * addrColor, fontSize }. Values are escaped via the file's esc() helper.
   */
  window.cchVendorContactBlockHtml = function(contact, opts) {
    contact = contact || {};
    opts = opts || {};
    var labelColor = opts.labelColor || '#5C6B80';
    var addrColor = opts.addrColor || labelColor;
    var fontSize = opts.fontSize || '12px';
    var nameStr = String(contact.name || '').trim();
    var addrStr = String(contact.address || '').trim();
    var phoneStr = String(contact.phone || '').trim();
    var emailStr = String(contact.email || '').trim();
    var html = '';
    if (nameStr) html += '<strong>' + esc(nameStr) + '</strong>';
    if (addrStr) {
      html += '<div style="margin-top:6px;color:' + addrColor + ';font-size:' + fontSize + ';line-height:1.55;white-space:pre-wrap;">' +
        esc(addrStr).replace(/\n/g, '<br>') + '</div>';
    }
    if (phoneStr || emailStr) {
      html += '<div style="margin-top:4px;color:' + labelColor + ';font-size:' + fontSize + ';line-height:1.55;">' +
        (phoneStr ? 'Phone: ' + esc(phoneStr) : '') +
        (phoneStr && emailStr ? '<br>' : '') +
        (emailStr ? 'Email: ' + esc(emailStr) : '') +
        '</div>';
    }
    return html;
  };

  /**
   * Ship-to / receiver contact: { name, phone, email } for the receiver a PO is
   * shipped to, so the vendor has someone to reach at the delivery location.
   * Source (all existing data — no new schema): the PO's assigned receiver
   * (docData.receiver / receiverName), resolved against the firm receivers
   * catalog (cchPoLoadReceivers — Vendors with receiver/freight role + Team role
   * receiver, each carrying { name, phone, email }). Falls back to matching the
   * ship-to value (docData.shipTo / deliverTo) against the same catalog. Prefers
   * any contact already saved on the PO (receiverPhone / receiverEmail). Never
   * throws; returns a partial object. Phone/email may be '' when unknown.
   */
  window.cchPoShipToContactResolved = async function(docData) {
    docData = docData || {};
    var out = {
      name: String(docData.receiver || docData.receiverName || '').trim(),
      phone: String(docData.receiverPhone || '').trim(),
      email: String(docData.receiverEmail || '').trim()
    };
    try {
      if ((!out.phone || !out.email) && typeof window.cchPoLoadReceivers === 'function') {
        var list = await window.cchPoLoadReceivers();
        if (list && list.length) {
          var candidates = [];
          if (out.name) candidates.push(out.name);
          var st = String(docData.shipTo || docData.deliverTo || '').trim();
          if (st) {
            candidates.push(st.split('\n')[0].trim());
            candidates.push(st);
          }
          for (var ci = 0; ci < candidates.length && (!out.phone || !out.email); ci++) {
            var cand = String(candidates[ci] || '').trim().toLowerCase();
            if (!cand) continue;
            for (var i = 0; i < list.length; i++) {
              var r = list[i] || {};
              var rn = String(r.name || '').trim().toLowerCase();
              if (rn && (rn === cand || cand.indexOf(rn) === 0)) {
                if (!out.name) out.name = String(r.name || '').trim();
                if (!out.phone) out.phone = String(r.phone || '').trim();
                if (!out.email) out.email = String(r.email || '').trim();
                break;
              }
            }
          }
        }
      }
    } catch (_eShipRec) { /* graceful: keep whatever we have */ }
    return out;
  };

  /** Bill, paid, balance, variance cells for All POs / project PO lists. */
  window.cchPoListAllPosFinancialCellsHtml = function(po, tdStyle) {
    tdStyle = tdStyle || 'padding:12px 14px;font-size:14px;';
    var billTotal = window.cchPoListBillTotalForRow(po);
    var variance = window.cchPoListVarianceForRow(po);
    var paid = window.cchPoListPaidForRow(po);
    var balance = window.cchPoListBalanceForRow(po);
    var billHtml = billTotal != null
      ? '$' + billTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })
      : '<span style="color:var(--gray-400);">—</span>';
    var paidHtml = paid > 0.01
      ? '$' + paid.toLocaleString('en-US', { minimumFractionDigits: 2 })
      : '<span style="color:var(--gray-400);">—</span>';
    var balColor = balance > 0.01 ? '#C4A464' : '#5FA56B';
    var balTitle = (po.bill && po.bill.received)
      ? 'Vendor bill balance due'
      : (paid > 0.01 ? 'PO total minus paid (bill not received yet)' : 'PO total — awaiting vendor bill');
    var balHtml = '<span style="font-weight:600;color:' + balColor + ';" title="' + escAttr(balTitle) + '">' +
      '$' + balance.toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</span>';
    var varHtml = '<span style="color:var(--gray-400);">—</span>';
    if (variance != null && Math.abs(variance) >= 0.01) {
      var color = variance > 0 ? '#B45309' : '#15803D';
      var prefix = variance > 0 ? '+' : '−';
      varHtml = '<span style="font-weight:600;color:' + color + ';" title="Vendor bill vs PO at send">' +
        prefix + '$' + Math.abs(variance).toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</span>';
    } else if (variance === 0 && billTotal != null) {
      varHtml = '<span style="color:#5FA56B;font-size:12px;">$0</span>';
    }
    return '<td style="' + tdStyle + 'text-align:right;font-family:monospace;font-weight:600;">' + billHtml + '</td>' +
      '<td style="' + tdStyle + 'text-align:right;font-family:monospace;color:' + (paid > 0.01 ? '#5FA56B' : 'var(--gray-400)') + ';">' + paidHtml + '</td>' +
      '<td style="' + tdStyle + 'text-align:right;font-family:monospace;">' + balHtml + '</td>' +
      '<td style="' + tdStyle + 'text-align:right;font-family:monospace;">' + varHtml + '</td>';
  };

  function cchPoBillItemBySource(bill, source) {
    if (!bill || !bill.items) return null;
    for (var i = 0; i < bill.items.length; i++) {
      if (bill.items[i].source === source) return bill.items[i];
    }
    return null;
  }

  var CCH_VENDOR_INVOICE_TYPES = [
    { id: 'merchandise', label: 'Merchandise' },
    { id: 'freight', label: 'Freight / shipping' },
    { id: 'tax', label: 'Pre-paid tax' },
    { id: 'price_change', label: 'Price change / credit' },
    { id: 'extra', label: 'Extra / fee' },
    { id: 'other', label: 'Other' }
  ];

  function cchPoVendorInvoiceSource(type) {
    var t = String(type || '').toLowerCase().replace(/\s+/g, '_');
    if (t === 'merchandise' || t === 'product') return 'merchandise';
    if (t === 'freight' || t === 'shipping') return 'freight';
    if (t === 'tax' || t === 'prepaid_tax' || t === 'pre_paid_tax') return 'tax';
    if (t === 'price_change' || t === 'price') return 'price_change';
    if (t === 'extra' || t === 'fee' || t === 'other') return 'extra';
    return 'extra';
  }

  function cchPoVendorInvoiceTypeLabel(type) {
    var src = cchPoVendorInvoiceSource(type);
    var hit = CCH_VENDOR_INVOICE_TYPES.find(function(x) { return x.id === src || x.id === type; });
    return hit ? hit.label : (type || 'Charge');
  }

  function cchPoPoLineUnitPrice(line) {
    if (!line) return 0;
    var cost = parseFloat(line.cost);
    if (Number.isFinite(cost) && cost > 0) return cost;
    var qty = parseFloat(line.qty) || 1;
    var amt = parseFloat(line.amount) || 0;
    return qty > 0 ? Math.round((amt / qty) * 10000) / 10000 : amt;
  }

  function cchPoCalcPriceChangeAmount(poLines, poLineIds, invoiceUnitPrice) {
    var inv = parseFloat(invoiceUnitPrice);
    if (!Number.isFinite(inv)) return null;
    poLineIds = (poLineIds || []).filter(Boolean);
    if (poLineIds.length !== 1) return null;
    var line = (poLines || []).find(function(l) { return l.lineId === poLineIds[0]; });
    if (!line) return null;
    var qty = parseFloat(line.qty) || 1;
    var poUnit = cchPoPoLineUnitPrice(line);
    var delta = (inv - poUnit) * qty;
    return {
      amount: Math.round(delta * 100) / 100,
      qty: qty,
      poUnitPrice: Math.round(poUnit * 100) / 100,
      invoiceUnitPrice: Math.round(inv * 100) / 100,
      lineTitle: line.title || 'Item'
    };
  }

  function cchPoPriceChangeBlockHtml(row, prefix) {
    prefix = prefix || 'cch-vi';
    var isPc = cchPoVendorInvoiceSource(row.type) === 'price_change';
    var invVal = row.invoiceUnitPrice != null && row.invoiceUnitPrice !== '' ? String(row.invoiceUnitPrice) : '';
    var poVal = row.poUnitPrice != null && row.poUnitPrice !== '' ? String(row.poUnitPrice) : '';
    var qtyVal = row.qty != null && row.qty !== '' ? String(row.qty) : '';
    var changedFn = prefix === 'cch-vig' ? 'cchPoVigPriceChangeChanged(this)' : 'cchPoViPriceChangeChanged(this)';
    return '<div class="' + prefix + '-price-change-block" style="grid-column:1/-1;display:' + (isPc ? 'block' : 'none') + ';margin-top:4px;padding:10px;background:rgba(180,83,9,0.04);border:1px solid rgba(180,83,9,0.12);border-radius:4px;">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">' +
        '<div><label class="form-label">Invoice unit price</label>' +
        '<input type="number" step="0.01" class="form-input ' + prefix + '-inv-unit" value="' + escAttr(invVal) + '" placeholder="0.00" oninput="' + changedFn + '"></div>' +
        '<div><label class="form-label">PO unit</label>' +
        '<input type="number" step="0.01" class="form-input ' + prefix + '-po-unit" value="' + escAttr(poVal) + '" readonly tabindex="-1" style="background:#F3F4F6;"></div>' +
        '<div><label class="form-label">Qty</label>' +
        '<input type="number" step="0.01" class="form-input ' + prefix + '-pc-qty" value="' + escAttr(qtyVal) + '" readonly tabindex="-1" style="background:#F3F4F6;"></div>' +
      '</div>' +
      '<p style="font-size:10px;color:#5C6B80;margin:8px 0 0;line-height:1.45;">Select <strong>one</strong> PO item under “Charge applies to” (receive bill) or check a single PO item on this invoice (edit). Amount = (invoice unit − PO unit) × qty.</p>' +
      '<p class="' + prefix + '-pc-calc" style="font-size:11px;color:#B45309;margin:4px 0 0;font-weight:600;"></p>' +
    '</div>';
  }

  function cchPoViPriceChangeCfg(rowEl) {
    return {
      typeSelector: '.cch-vi-type',
      amtSelector: '.cch-vi-amt',
      blockSelector: '.cch-vi-price-change-block',
      invUnitSelector: '.cch-vi-inv-unit',
      poUnitSelector: '.cch-vi-po-unit',
      qtySelector: '.cch-vi-pc-qty',
      calcHintSelector: '.cch-vi-pc-calc',
      poLines: window.__cchBillPoLines || [],
      getPoLineIds: function() {
        var ids = [];
        rowEl.querySelectorAll('.cch-vi-po-line-cb:checked').forEach(function(cb) {
          if (cb.value) ids.push(cb.value);
        });
        return ids;
      }
    };
  }

  function cchPoVigPriceChangeCfg(rowEl) {
    return {
      typeSelector: '.cch-vig-charge-type',
      amtSelector: '.cch-vig-charge-amt',
      blockSelector: '.cch-vig-price-change-block',
      invUnitSelector: '.cch-vig-inv-unit',
      poUnitSelector: '.cch-vig-po-unit',
      qtySelector: '.cch-vig-pc-qty',
      calcHintSelector: '.cch-vig-pc-calc',
      poLines: window.__cchVigPoLines || [],
      getPoLineIds: function() {
        return typeof cchPoReadVigPoLineIdsFromDom === 'function' ? cchPoReadVigPoLineIdsFromDom() : [];
      }
    };
  }

  function cchPoRefreshPriceChangeRow(rowEl, cfg) {
    if (!rowEl || !cfg) return;
    var typeEl = rowEl.querySelector(cfg.typeSelector);
    var type = typeEl ? typeEl.value : '';
    var isPc = cchPoVendorInvoiceSource(type) === 'price_change';
    var block = rowEl.querySelector(cfg.blockSelector);
    if (block) block.style.display = isPc ? 'block' : 'none';
    var amtEl = rowEl.querySelector(cfg.amtSelector);
    if (!isPc) {
      if (amtEl) {
        amtEl.removeAttribute('readonly');
        amtEl.title = '';
      }
      return;
    }
    var invEl = rowEl.querySelector(cfg.invUnitSelector);
    var poUnitEl = rowEl.querySelector(cfg.poUnitSelector);
    var qtyEl = rowEl.querySelector(cfg.qtySelector);
    var calcHint = rowEl.querySelector(cfg.calcHintSelector);
    var poLineIds = cfg.getPoLineIds ? cfg.getPoLineIds() : [];
    var poLines = cfg.poLines || [];
    var invRaw = invEl ? String(invEl.value || '').trim() : '';
    var calc = invRaw ? cchPoCalcPriceChangeAmount(poLines, poLineIds, invRaw) : null;
    if (calc) {
      if (poUnitEl) poUnitEl.value = calc.poUnitPrice;
      if (qtyEl) qtyEl.value = calc.qty;
      if (amtEl) {
        amtEl.value = calc.amount;
        amtEl.readOnly = true;
        amtEl.title = 'Calculated — clear invoice unit price to edit amount manually';
      }
      if (calcHint) {
        calcHint.textContent = '(' + fmt(calc.invoiceUnitPrice) + ' − ' + fmt(calc.poUnitPrice) + ') × ' + calc.qty + ' = ' + fmt(calc.amount);
      }
    } else {
      if (poLineIds.length === 1) {
        var line = poLines.find(function(l) { return l.lineId === poLineIds[0]; });
        if (line) {
          if (poUnitEl) poUnitEl.value = cchPoPoLineUnitPrice(line);
          if (qtyEl) qtyEl.value = parseFloat(line.qty) || 1;
        }
      } else {
        if (poUnitEl) poUnitEl.value = '';
        if (qtyEl) qtyEl.value = '';
      }
      if (amtEl) {
        amtEl.readOnly = false;
        amtEl.title = poLineIds.length !== 1 ? 'Select one PO item to auto-calculate' : (invRaw ? '' : 'Enter invoice unit price to auto-calculate');
      }
      if (calcHint) {
        calcHint.textContent = poLineIds.length !== 1
          ? 'Select one PO item to calculate.'
          : (invRaw ? '' : 'Enter invoice unit price to calculate amount.');
      }
    }
  }

  function cchPoRefreshAllVigPriceChangeRows() {
    document.querySelectorAll('.cch-vig-charge-row').forEach(function(row) {
      cchPoRefreshPriceChangeRow(row, cchPoVigPriceChangeCfg(row));
    });
  }

  window.cchPoViRowTypeChanged = function(sel) {
    var row = sel && sel.closest('.cch-vi-row');
    if (!row) return;
    cchPoRefreshPriceChangeRow(row, cchPoViPriceChangeCfg(row));
    cchPoUpdateBillPreview(window.__cchBillPoAtSend);
  };

  window.cchPoViPriceChangeChanged = function(inp) {
    var row = inp && inp.closest('.cch-vi-row');
    if (!row) return;
    cchPoRefreshPriceChangeRow(row, cchPoViPriceChangeCfg(row));
    cchPoUpdateBillPreview(window.__cchBillPoAtSend);
  };

  window.cchPoViPoLineChanged = function(cb) {
    var row = cb && cb.closest('.cch-vi-row');
    if (!row) return;
    var typeEl = row.querySelector('.cch-vi-type');
    if (typeEl && cchPoVendorInvoiceSource(typeEl.value) === 'price_change' && cb.checked) {
      row.querySelectorAll('.cch-vi-po-line-cb:checked').forEach(function(other) {
        if (other !== cb) other.checked = false;
      });
    }
    cchPoRefreshPriceChangeRow(row, cchPoViPriceChangeCfg(row));
    cchPoUpdateBillPreview(window.__cchBillPoAtSend);
  };

  window.cchPoVigChargeTypeChanged = function(sel) {
    var row = sel && sel.closest('.cch-vig-charge-row');
    if (!row) return;
    cchPoRefreshPriceChangeRow(row, cchPoVigPriceChangeCfg(row));
    window.cchPoUpdateVigBillPreview();
  };

  window.cchPoVigPriceChangeChanged = function(inp) {
    var row = inp && inp.closest('.cch-vig-charge-row');
    if (!row) return;
    cchPoRefreshPriceChangeRow(row, cchPoVigPriceChangeCfg(row));
    window.cchPoUpdateVigBillPreview();
  };

  /** Back-compat: legacy freight/tax fields → vendorInvoices[] rows. */
  function cchPoBillVendorInvoicesFromBill(bill) {
    bill = bill || {};
    if (Array.isArray(bill.vendorInvoices) && bill.vendorInvoices.length) {
      return cchPoSupplementBillChargeRows(bill, bill.vendorInvoices);
    }
    var rows = [];
    var invNum = String(bill.vendorInvoiceNumber || '').trim();
    var invDate = String(bill.vendorInvoiceDate || '').trim();
    var priceNote = (cchPoBillItemBySource(bill, 'price_change') || {}).note || '';
    var extraTitle = (cchPoBillItemBySource(bill, 'extra') || {}).title || '';
    if (extraTitle === 'Other / extra') extraTitle = '';
    function pushLegacy(type, amt, desc) {
      if (Math.abs(parseFloat(amt) || 0) < 0.01) return;
      rows.push({
        id: 'vi_legacy_' + type,
        vendorInvoiceNumber: invNum,
        vendorInvoiceDate: invDate,
        type: type,
        description: desc || cchPoVendorInvoiceTypeLabel(type),
        amount: amt
      });
    }
    pushLegacy('freight', bill.freight, 'Freight');
    pushLegacy('tax', bill.tax, 'Pre-paid tax');
    pushLegacy('price_change', bill.priceChange, priceNote || 'Price change');
    pushLegacy('extra', bill.extras, extraTitle || 'Other / extra');
    return rows;
  }

  function cchPoPoLineTitlesFromIds(poLines, ids) {
    ids = ids || [];
    if (!ids.length || !poLines || !poLines.length) return [];
    return ids.map(function(id) {
      for (var i = 0; i < poLines.length; i++) {
        if (poLines[i].lineId === id) return poLines[i].title || 'Item';
      }
      return null;
    }).filter(Boolean);
  }

  function cchPoBillBilledLineIds(bill, allPoLines) {
    bill = bill || {};
    if (Array.isArray(bill.billedPoLineIds) && bill.billedPoLineIds.length) return bill.billedPoLineIds.slice();
    if (bill.received && bill.poSubtotal != null && allPoLines && allPoLines.length) {
      var poAt = parseFloat(bill.poTotalAtSend != null ? bill.poTotalAtSend : bill.poSubtotal) || 0;
      var sub = parseFloat(bill.poSubtotal) || 0;
      if (Math.abs(sub - poAt) < 0.02) return allPoLines.map(function(l) { return l.lineId; });
    }
    if (bill.received) return (allPoLines || []).map(function(l) { return l.lineId; });
    return [];
  }

  function cchPoSumPoLineAmounts(poLines, ids) {
    ids = ids || [];
    var sum = 0;
    (poLines || []).forEach(function(l) {
      if (ids.indexOf(l.lineId) >= 0) sum += parseFloat(l.amount) || 0;
    });
    return Math.round(sum * 100) / 100;
  }

  function cchPoReadBillPoLineIdsFromDom() {
    var ids = [];
    document.querySelectorAll('.cch-bill-po-line-cb:checked').forEach(function(cb) {
      if (cb.value) ids.push(cb.value);
    });
    return ids;
  }

  /** Interactive PO item picker — checked items become merchandise on the vendor bill. */
  function cchPoBillPoLinePickerHtml(allPoLines, selectedIds, lockedIds, poAtSend) {
    if (!allPoLines || !allPoLines.length) return '';
    lockedIds = lockedIds || [];
    selectedIds = selectedIds || [];
    var rows = allPoLines.map(function(l) {
      var lid = l.lineId;
      var isLocked = lockedIds.indexOf(lid) >= 0;
      var isChecked = isLocked || selectedIds.indexOf(lid) >= 0;
      return '<tr style="border-bottom:1px solid rgba(15,26,46,0.06);">' +
        '<td style="padding:8px 10px;">' +
          '<label style="display:flex;align-items:center;gap:8px;cursor:' + (isLocked ? 'default' : 'pointer') + ';">' +
            '<input type="checkbox" class="cch-bill-po-line-cb" value="' + escAttr(lid) + '"' +
              (isChecked ? ' checked' : '') + (isLocked ? ' disabled' : '') +
              ' onchange="cchPoUpdateBillPreview(window.__cchBillPoAtSend)" style="accent-color:var(--gold);flex-shrink:0;">' +
            '<span style="font-size:12px;line-height:1.35;">' + esc(l.title || 'Item') +
              (isLocked ? ' <span style="font-size:10px;color:#9CA3AF;">(already on bill)</span>' : '') +
            '</span></label></td>' +
        '<td style="padding:8px 10px;text-align:right;font-size:12px;font-weight:600;white-space:nowrap;">' + fmt(parseFloat(l.amount) || 0) + '</td></tr>';
    }).join('');
    var selSub = cchPoSumPoLineAmounts(allPoLines, selectedIds.concat(lockedIds.filter(function(id) { return selectedIds.indexOf(id) < 0; })));
    return '<div style="margin-bottom:16px;padding:12px;background:#fff;border:1px solid rgba(27,51,82,0.12);border-radius:4px;">' +
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#1B3352;margin-bottom:4px;">1. PO items on this bill</div>' +
      '<p style="font-size:10px;color:#5C6B80;margin:0 0 10px;line-height:1.45;">Check which PO line items are on this vendor invoice. Their amounts become the merchandise portion of the bill.</p>' +
      '<table style="width:100%;border-collapse:collapse;"><tbody>' + rows +
      '<tr style="border-top:2px solid rgba(27,51,82,0.12);background:rgba(27,51,82,0.04);">' +
        '<td style="padding:10px;font-weight:700;font-size:12px;">Merchandise subtotal</td>' +
        '<td id="cchBillPoLineSubtotal" style="padding:10px;text-align:right;font-weight:700;font-size:13px;">' + fmt(selSub) + '</td></tr>' +
      '<tr><td colspan="2" style="padding:6px 10px 0;font-size:10px;color:#9CA3AF;">Full PO total (reference): ' + fmt(poAtSend) + '</td></tr>' +
      '</tbody></table></div>';
  }

  function cchPoVendorInvoicePoLinePickerHtml(selectedIds) {
    var poLines = window.__cchBillPoLines || [];
    if (!poLines.length) return '';
    selectedIds = selectedIds || [];
    var boxes = poLines.map(function(l) {
      var lid = l.lineId;
      var checked = selectedIds.indexOf(lid) >= 0;
      return '<label style="display:flex;align-items:flex-start;gap:6px;font-size:11px;margin:3px 0;cursor:pointer;line-height:1.35;">' +
        '<input type="checkbox" class="cch-vi-po-line-cb" value="' + escAttr(lid) + '"' + (checked ? ' checked' : '') + ' onchange="cchPoViPoLineChanged(this)" style="accent-color:var(--gold);margin-top:2px;flex-shrink:0;">' +
        '<span><strong>' + esc(l.title || 'Item') + '</strong> <span style="color:#9CA3AF;">' + fmt(parseFloat(l.amount) || 0) + '</span></span></label>';
    }).join('');
    return '<div style="grid-column:1/-1;margin-top:4px;">' +
      '<div class="form-label" style="margin-bottom:4px;">Charge applies to</div>' +
      '<div style="padding:8px 10px;background:rgba(27,51,82,0.04);border:1px solid rgba(15,26,46,0.08);border-radius:4px;max-height:140px;overflow:auto;">' +
      (poLines.length === 1
        ? '<label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;"><input type="checkbox" class="cch-vi-po-line-cb" value="' + escAttr(poLines[0].lineId) + '"' +
          ((selectedIds.length ? selectedIds.indexOf(poLines[0].lineId) >= 0 : true) ? ' checked' : '') + ' onchange="cchPoViPoLineChanged(this)" style="accent-color:var(--gold);"> Applies to <strong>' + esc(poLines[0].title || 'Item') + '</strong></label>'
        : boxes) +
      '</div></div>';
  }

  function cchPoChargeItemsFromVendorInvoices(rows, poLines) {
    var out = [];
    (rows || []).forEach(function(r) {
      var amt = parseFloat(r.amount) || 0;
      if (Math.abs(amt) < 0.01) return;
      var src = cchPoVendorInvoiceSource(r.type);
      if (src === 'merchandise') return;
      var title = String(r.description || '').trim() || cchPoVendorInvoiceTypeLabel(r.type);
      var poLineIds = Array.isArray(r.poLineIds) ? r.poLineIds.slice() : [];
      var linkedTitles = cchPoPoLineTitlesFromIds(poLines || [], poLineIds);
      if (src === 'price_change' && r.invoiceUnitPrice != null && r.invoiceUnitPrice !== '' && r.poUnitPrice != null && r.poUnitPrice !== '') {
        var pcQty = r.qty != null && r.qty !== '' ? r.qty : 1;
        var pcTitle = 'Price change';
        if (linkedTitles.length) pcTitle += ': ' + linkedTitles[0];
        pcTitle += ' — inv ' + fmt(parseFloat(r.invoiceUnitPrice)) + '/ea × ' + pcQty + ' (PO ' + fmt(parseFloat(r.poUnitPrice)) + '/ea)';
        title = String(r.description || '').trim() ? String(r.description).trim() + ' — ' + pcTitle : pcTitle;
      } else if (linkedTitles.length) {
        title = title + ' [' + linkedTitles.join(', ') + ']';
      }
      var item = {
        source: src,
        title: title,
        amount: Math.round(amt * 100) / 100,
        vendorInvoiceNumber: String(r.vendorInvoiceNumber || '').trim(),
        vendorInvoiceDate: String(r.vendorInvoiceDate || '').trim(),
        poLineIds: poLineIds
      };
      if (src === 'price_change') {
        if (r.invoiceUnitPrice != null && r.invoiceUnitPrice !== '') item.invoiceUnitPrice = parseFloat(r.invoiceUnitPrice);
        if (r.poUnitPrice != null && r.poUnitPrice !== '') item.poUnitPrice = parseFloat(r.poUnitPrice);
        if (r.qty != null && r.qty !== '') item.qty = parseFloat(r.qty);
        if (r.description) item.note = r.description;
      }
      out.push(item);
    });
    return out;
  }

  function cchPoLegacyAggregatesFromVendorInvoices(rows) {
    var out = { freight: 0, tax: 0, priceChange: 0, extras: 0, priceNote: '', extraTitle: '' };
    (rows || []).forEach(function(r) {
      var src = cchPoVendorInvoiceSource(r.type);
      var amt = parseFloat(r.amount) || 0;
      if (Math.abs(amt) < 0.01) return;
      if (src === 'freight') out.freight += amt;
      else if (src === 'tax') out.tax += amt;
      else if (src === 'price_change') {
        out.priceChange += amt;
        if (r.description) out.priceNote = r.description;
      } else {
        out.extras += amt;
        if (r.description) out.extraTitle = r.description;
      }
    });
    out.freight = Math.round(out.freight * 100) / 100;
    out.tax = Math.round(out.tax * 100) / 100;
    out.priceChange = Math.round(out.priceChange * 100) / 100;
    out.extras = Math.round(out.extras * 100) / 100;
    return out;
  }

  /** Bill-level vendor invoice # / date (one invoice, many charge lines). */
  function cchPoBillVendorInvoiceMeta(bill, viRows) {
    bill = bill || {};
    viRows = viRows || [];
    var invNum = String(bill.vendorInvoiceNumber || '').trim();
    var invDate = String(bill.vendorInvoiceDate || '').trim();
    if (!invNum) {
      viRows.some(function(r) {
        var n = String(r.vendorInvoiceNumber || '').trim();
        if (n) { invNum = n; return true; }
        return false;
      });
    }
    if (!invDate) {
      viRows.some(function(r) {
        var d = String(r.vendorInvoiceDate || '').trim();
        if (d) { invDate = d; return true; }
        return false;
      });
    }
    return {
      vendorInvoiceNumber: invNum,
      vendorInvoiceDate: invDate,
      trackingNumber: String(bill.trackingNumber || '').trim(),
      trackingCarrier: String(bill.trackingCarrier || '').trim(),
      etaDate: String(bill.etaDate || '').trim(),
      shipmentNotes: String(bill.shipmentNotes || '').trim()
    };
  }

  function cchPoFormatEtaDate(iso) {
    iso = String(iso || '').trim();
    if (!iso) return '';
    var d = iso.indexOf('T') >= 0 ? iso.slice(0, 10) : iso;
    if (typeof window.formatDate === 'function') return window.formatDate(d);
    var p = d.split('-');
    if (p.length !== 3) return d;
    return p[1] + '/' + p[2] + '/' + p[0];
  }
  window.cchPoFormatEtaDate = cchPoFormatEtaDate;

  /** Per PO line: order status + ship/delivery dates from vendor invoice group. */
  window.cchPoLineEtaMetaForItem = function(doc, item, lineIdx, poItems) {
    doc = doc || {};
    poItems = poItems || doc.items || [];
    item = item || {};
    var lineId = window.cchPoResolveLineId(item, lineIdx);
    var grp = lineId ? window.cchPoVendorInvoiceGroupForLineId(doc, lineId, poItems) : null;
    var bill = doc.bill || {};
    if (grp) {
      return {
        etaDate: String(grp.etaDate || '').trim(),
        confirmedDate: String(grp.confirmedDate || '').trim(),
        estimatedShipDate: String(grp.estimatedShipDate || '').trim(),
        actualShipDate: String(grp.actualShipDate || '').trim(),
        status: String(grp.status || '').trim(),
        trackingNumber: String(grp.trackingNumber || '').trim(),
        trackingCarrier: String(grp.trackingCarrier || '').trim(),
        vendorInvoiceNumber: String(grp.vendorInvoiceNumber || '').trim()
      };
    }
    return {
      etaDate: String(item.etaDate || bill.etaDate || '').trim(),
      confirmedDate: String(item.confirmedDate || '').trim(),
      estimatedShipDate: String(item.estimatedShipDate || '').trim(),
      actualShipDate: String(item.actualShipDate || '').trim(),
      status: '',
      trackingNumber: String(bill.trackingNumber || '').trim(),
      trackingCarrier: String(bill.trackingCarrier || '').trim(),
      vendorInvoiceNumber: String(bill.vendorInvoiceNumber || '').trim()
    };
  };

  window.cchPoLineEtaHtml = function(doc, item, lineIdx, poItems) {
    var meta = window.cchPoLineEtaMetaForItem(doc, item, lineIdx, poItems);
    var hasDates = !!(meta.confirmedDate || meta.estimatedShipDate || meta.actualShipDate || meta.etaDate);
    if (!hasDates && !meta.trackingNumber) {
      return '<span style="font-size:11px;color:#9CA3AF;" title="Set on Vendor invoices → Edit">—</span>';
    }
    var html = window.cchPoVendorInvOrderTimelineHtml(meta);
    if (meta.trackingNumber) {
      html += '<div style="font-size:10px;color:#5C6B80;margin-top:3px;line-height:1.3;">' +
        esc((meta.trackingCarrier ? meta.trackingCarrier + ' ' : '') + meta.trackingNumber) + '</div>';
    }
    return html;
  };

  function cchPoBillVendorInvoiceHeaderHtml(meta, isAdd, hideSingleShipmentFields) {
    meta = meta || {};
    var invNum = meta.vendorInvoiceNumber || '';
    var invDate = meta.vendorInvoiceDate || '';
    var label = isAdd ? 'Vendor invoice # (this invoice)' : 'Vendor invoice #';
    var shipmentBlock = (isAdd || hideSingleShipmentFields) ? '' :
      '<div><label class="form-label">Carrier <span style="font-weight:400;color:#9CA3AF;">(optional)</span></label>' +
      '<input type="text" id="cchBillTrackingCarrier" class="form-input" value="' + escAttr(meta.trackingCarrier || '') + '" placeholder="USPS, FedEx, UPS…"></div>' +
      '<div><label class="form-label">Tracking #</label>' +
      '<input type="text" id="cchBillTrackingNum" class="form-input" value="' + escAttr(meta.trackingNumber || '') + '" placeholder="9400…"></div>' +
      '<div><label class="form-label">ETA date <span style="font-weight:400;color:#9CA3AF;">(expected delivery)</span></label>' +
      '<input type="date" id="cchBillEtaDate" class="form-input" value="' + escAttr(meta.etaDate || '') + '"></div>' +
      '<div style="grid-column:1/-1;"><label class="form-label">Notes</label>' +
      '<textarea id="cchBillShipmentNotes" class="form-textarea" rows="2" placeholder="Ship window, receiver instructions, vendor message…" style="min-height:52px;font-size:12px;">' + esc(meta.shipmentNotes || '') + '</textarea></div>';
    return '<div id="cchBillVendorInvoiceHeader" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;padding:10px;background:rgba(27,51,82,0.04);border-radius:4px;border:1px solid rgba(27,51,82,0.1);">' +
      '<div><label class="form-label">' + esc(label) + '</label>' +
      '<input type="text" id="cchBillVendorInvNum" class="form-input" value="' + escAttr(invNum || '') + '" placeholder="Vendor inv #" oninput="cchPoUpdateBillPreview(window.__cchBillPoAtSend)"></div>' +
      '<div><label class="form-label">Invoice date <span style="font-weight:400;color:#9CA3AF;">(optional)</span></label>' +
      '<input type="date" id="cchBillVendorInvDate" class="form-input" value="' + escAttr(invDate || '') + '" onchange="cchPoUpdateBillPreview(window.__cchBillPoAtSend)"></div>' +
      shipmentBlock +
      '</div>';
  }

  /** Per vendor-invoice shipment fields when PO has multiple vendor invoices (e.g. PO-9018 Etsy). */
  function cchPoBillMultiTrackingGroupsHtml(doc, poItems) {
    var groups = window.cchPoVendorInvoiceGroupsUser(doc);
    if (groups.length <= 1) return '';
    var lineMeta = cchPoPoLineMetaList(poItems);
    var rows = groups.map(function(g) {
      var itemTitles = cchPoPoLineTitlesFromIds(lineMeta, g.poLineIds);
      var itemsLabel = itemTitles.length ? itemTitles.join('; ') : '—';
      return '<div class="cch-bill-vig-track-row" data-group-id="' + escAttr(g.id || '') + '" style="border:1px solid rgba(15,26,46,0.1);border-radius:4px;padding:10px;margin-bottom:8px;background:#fff;">' +
        '<div style="font-size:11px;font-weight:700;color:#1B3352;margin-bottom:6px;">' + esc(g.vendorInvoiceNumber || 'Vendor invoice') + '</div>' +
        '<div style="font-size:10px;color:#5C6B80;margin-bottom:8px;">' + esc(itemsLabel) + '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
          '<div><label class="form-label">Carrier</label><input type="text" class="form-input cch-bill-vig-carrier" value="' + escAttr(g.trackingCarrier || '') + '" placeholder="USPS…"></div>' +
          '<div><label class="form-label">Tracking #</label><input type="text" class="form-input cch-bill-vig-tracking" value="' + escAttr(g.trackingNumber || '') + '" placeholder="9400…"></div>' +
          '<div><label class="form-label">ETA date</label><input type="date" class="form-input cch-bill-vig-eta" value="' + escAttr(g.etaDate || '') + '"></div>' +
          '<div style="grid-column:1/-1;"><label class="form-label">Notes</label>' +
          '<textarea class="form-textarea cch-bill-vig-notes" rows="2" placeholder="Ship window, instructions…" style="min-height:48px;font-size:12px;">' + esc(g.notes || '') + '</textarea></div>' +
        '</div></div>';
    }).join('');
    return '<div style="margin-bottom:14px;">' +
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#00796B;margin:0 0 8px;">Shipment · per vendor invoice</div>' +
      '<p style="font-size:11px;color:#5C6B80;margin:0 0 10px;line-height:1.45;">Tracking, ETA, and notes for each vendor invoice when the PO has multiple shipments.</p>' +
      rows + '</div>';
  }

  function cchPoHasBillShipmentMeta(meta) {
    meta = meta || {};
    return !!(meta.trackingNumber || meta.trackingCarrier || meta.etaDate || meta.shipmentNotes);
  }
  var _hasBillShipmentMeta = cchPoHasBillShipmentMeta;

  /** One charge line on the vendor invoice (type, amount, description — no per-row invoice #). */
  function cchPoVendorChargeRowHtml(row) {
    row = row || {};
    var type = row.type || 'freight';
    var opts = CCH_VENDOR_INVOICE_TYPES.map(function(t) {
      return '<option value="' + escAttr(t.id) + '"' + (type === t.id ? ' selected' : '') + '>' + esc(t.label) + '</option>';
    }).join('');
    var amtVal = row.amount != null && row.amount !== '' ? String(row.amount) : '';
    return '<div class="cch-vi-row" style="border:1px solid rgba(15,26,46,0.1);border-radius:4px;padding:10px;margin-bottom:8px;background:#fff;">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
        '<div><label class="form-label">Type</label><select class="form-input cch-vi-type" onchange="cchPoViRowTypeChanged(this)">' + opts + '</select></div>' +
        '<div><label class="form-label">Amount</label><input type="number" step="0.01" class="form-input cch-vi-amt" value="' + escAttr(amtVal) + '" oninput="cchPoUpdateBillPreview(window.__cchBillPoAtSend)"></div>' +
        '<div style="grid-column:1/-1;"><label class="form-label">Description</label><input type="text" class="form-input cch-vi-desc" placeholder="e.g. FedEx freight, partial shipment" value="' + escAttr(row.description || '') + '"></div>' +
        cchPoPriceChangeBlockHtml(row, 'cch-vi') +
        cchPoVendorInvoicePoLinePickerHtml(row.poLineIds) +
      '</div>' +
      '<button type="button" class="btn btn-sm" style="margin-top:6px;color:#B91C1C;border-color:rgba(185,28,28,0.35);" onclick="cchPoRemoveVendorInvoiceRow(this)">Remove line</button>' +
    '</div>';
  }

  function cchPoVendorInvoiceEditorRowHtml(row) {
    return cchPoVendorChargeRowHtml(row);
  }

  /** Default charge rows when receiving a bill (matches legacy freight / tax / price / extra slots). */
  function cchPoDefaultVendorInvoiceRows() {
    return [
      { type: 'freight', amount: '', description: '' },
      { type: 'tax', amount: '', description: 'Pre-paid tax' },
      { type: 'price_change', amount: '', description: '' },
      { type: 'extra', amount: '', description: '' }
    ];
  }

  /** Map one vendorInvoices[] row for editor restore (incl. price-change fields). */
  function cchPoVendorInvoiceRowFromBill(r, i) {
    r = r || {};
    var row = {
      id: r.id || ('vi_' + (i != null ? i : 0)),
      vendorInvoiceNumber: String(r.vendorInvoiceNumber || '').trim(),
      vendorInvoiceDate: String(r.vendorInvoiceDate || '').trim(),
      type: r.type || cchPoVendorInvoiceSource(r.source || 'extra'),
      description: String(r.description || r.title || r.note || '').trim(),
      amount: r.amount != null ? r.amount : '',
      poLineIds: Array.isArray(r.poLineIds) ? r.poLineIds.slice() : [],
      invoiceUnitPrice: r.invoiceUnitPrice != null ? r.invoiceUnitPrice : '',
      poUnitPrice: r.poUnitPrice != null ? r.poUnitPrice : '',
      qty: r.qty != null ? r.qty : ''
    };
    if (cchPoVendorInvoiceSource(row.type) === 'price_change') {
      var poU = parseFloat(row.poUnitPrice);
      var q = parseFloat(row.qty) || 1;
      var amt = parseFloat(row.amount);
      if ((row.invoiceUnitPrice === '' || row.invoiceUnitPrice == null) && Number.isFinite(poU) && Number.isFinite(amt) && q > 0) {
        row.invoiceUnitPrice = Math.round((poU + amt / q) * 100) / 100;
      }
    }
    return row;
  }

  function cchPoChargeRowDedupeKey(r, loose) {
    var src = cchPoVendorInvoiceSource(r.type);
    var amt = Math.round((parseFloat(r.amount) || 0) * 100);
    var ids = (r.poLineIds || []).slice().sort().join(',');
    if (loose) return src + ':' + amt + ':' + ids;
    var inv = cchPoNormVendorInvNum(r.vendorInvoiceNumber);
    return src + ':' + inv + ':' + amt + ':' + ids;
  }

  /** Charge rows stored on bill.items (when not duplicated in vendorInvoices[]). */
  function cchPoBillItemChargeRows(bill) {
    var out = [];
    (bill.items || []).forEach(function(it, idx) {
      var src = cchPoVendorInvoiceSource(it && it.source);
      if (src === 'po' || src === 'merchandise') return;
      if (Math.abs(parseFloat(it.amount) || 0) < 0.01) return;
      out.push(cchPoVendorInvoiceRowFromBill({
        id: it.id || ('vi_item_' + idx),
        type: src,
        source: it.source,
        amount: it.amount,
        description: it.note || it.title || '',
        vendorInvoiceNumber: it.vendorInvoiceNumber || '',
        vendorInvoiceDate: it.vendorInvoiceDate || '',
        poLineIds: it.poLineIds || [],
        invoiceUnitPrice: it.invoiceUnitPrice,
        poUnitPrice: it.poUnitPrice,
        qty: it.qty
      }, idx));
    });
    return out;
  }

  /** Merge vendorInvoices[] with bill.items + legacy freight/tax/priceChange/extras so edit modals show all charges. */
  function cchPoSupplementBillChargeRows(bill, baseRows) {
    bill = bill || {};
    var out = (baseRows || []).map(function(r, i) { return cchPoVendorInvoiceRowFromBill(r, i); });
    var seen = {};
    var seenLoose = {};
    function markSeen(r) {
      seen[cchPoChargeRowDedupeKey(r)] = true;
      seenLoose[cchPoChargeRowDedupeKey(r, true)] = true;
    }
    out.forEach(markSeen);
    function tryAdd(r) {
      r = cchPoVendorInvoiceRowFromBill(r, out.length);
      if (cchPoVendorInvoiceSource(r.type) === 'merchandise') return;
      if (Math.abs(parseFloat(r.amount) || 0) < 0.01) return;
      var key = cchPoChargeRowDedupeKey(r);
      var looseKey = cchPoChargeRowDedupeKey(r, true);
      if (seen[key] || seenLoose[looseKey]) return;
      seen[key] = true;
      seenLoose[looseKey] = true;
      out.push(r);
    }
    cchPoBillItemChargeRows(bill).forEach(tryAdd);
    var invNum = String(bill.vendorInvoiceNumber || '').trim();
    var invDate = String(bill.vendorInvoiceDate || '').trim();
    function hasChargeType(src) {
      return out.some(function(r) {
        return cchPoVendorInvoiceSource(r.type) === src && Math.abs(parseFloat(r.amount) || 0) > 0.01;
      });
    }
    var pcItems = (bill.items || []).filter(function(it) { return it && it.source === 'price_change'; });
    if (!hasChargeType('price_change') && Math.abs(parseFloat(bill.priceChange) || 0) > 0.01) {
      var pcRef = pcItems.length ? pcItems[0] : cchPoBillItemBySource(bill, 'price_change');
      tryAdd({
        id: 'vi_legacy_price_change',
        type: 'price_change',
        amount: bill.priceChange,
        description: (pcRef && (pcRef.note || pcRef.title)) || 'Price change',
        vendorInvoiceNumber: (pcRef && pcRef.vendorInvoiceNumber) || invNum,
        vendorInvoiceDate: invDate,
        poLineIds: pcRef && pcRef.poLineIds ? pcRef.poLineIds.slice() : [],
        invoiceUnitPrice: pcRef && pcRef.invoiceUnitPrice,
        poUnitPrice: pcRef && pcRef.poUnitPrice,
        qty: pcRef && pcRef.qty
      });
    }
    if (!hasChargeType('freight') && Math.abs(parseFloat(bill.freight) || 0) > 0.01) {
      tryAdd({ id: 'vi_legacy_freight', type: 'freight', amount: bill.freight, description: 'Freight', vendorInvoiceNumber: invNum, vendorInvoiceDate: invDate });
    }
    if (!hasChargeType('tax') && Math.abs(parseFloat(bill.tax) || 0) > 0.01) {
      tryAdd({ id: 'vi_legacy_tax', type: 'tax', amount: bill.tax, description: 'Pre-paid tax', vendorInvoiceNumber: invNum, vendorInvoiceDate: invDate });
    }
    if (!hasChargeType('extra') && Math.abs(parseFloat(bill.extras) || 0) > 0.01) {
      var exRef = cchPoBillItemBySource(bill, 'extra');
      tryAdd({
        id: 'vi_legacy_extra',
        type: 'extra',
        amount: bill.extras,
        description: (exRef && exRef.title && exRef.title !== 'Other / extra' ? exRef.title : 'Other / extra'),
        vendorInvoiceNumber: invNum,
        vendorInvoiceDate: invDate
      });
    }
    return out;
  }

  /** Edit bill / edit invoice — saved charge lines plus empty freight/tax/price/extra slots. */
  function cchPoVendorInvoiceEditorRows(bill) {
    bill = bill || {};
    var rows = cchPoBillVendorInvoicesFromBill(bill).filter(function(r) {
      return Math.abs(parseFloat(r.amount) || 0) > 0.01;
    });
    var typesPresent = {};
    rows.forEach(function(r) { typesPresent[cchPoVendorInvoiceSource(r.type)] = true; });
    cchPoDefaultVendorInvoiceRows().forEach(function(d) {
      if (!typesPresent[d.type]) rows.push(Object.assign({}, d));
    });
    return rows;
  }

  /** Charge rows for edit-vendor-invoice modal — this invoice # plus freight/tax slots. */
  function cchPoVigChargeRowsForModal(bill, invNum, poLineIds) {
    var charges = cchPoChargesForVendorInvoice(bill, invNum, poLineIds).map(function(r, i) {
      return cchPoVendorInvoiceRowFromBill(r, i);
    });
    if (!charges.length) {
      return [{ type: 'freight', amount: '', description: '' }, { type: 'tax', amount: '', description: 'Pre-paid tax' }];
    }
    var hasFreight = charges.some(function(c) { return cchPoVendorInvoiceSource(c.type) === 'freight'; });
    var hasTax = charges.some(function(c) { return cchPoVendorInvoiceSource(c.type) === 'tax'; });
    var out = charges.slice();
    if (!hasFreight) out.unshift({ type: 'freight', amount: '', description: '' });
    if (!hasTax) {
      var insertAt = hasFreight ? 1 : 1;
      out.splice(insertAt, 0, { type: 'tax', amount: '', description: 'Pre-paid tax' });
    }
    if (!out.some(function(c) { return cchPoVendorInvoiceSource(c.type) === 'price_change'; })) {
      out.push({ type: 'price_change', amount: '', description: '' });
    }
    return out;
  }

  window.cchPoAddVendorInvoiceRow = function() {
    var list = document.getElementById('cchVendorInvoicesList');
    if (!list) return;
    list.insertAdjacentHTML('beforeend', cchPoVendorChargeRowHtml({ type: 'extra' }));
    cchPoUpdateBillPreview(window.__cchBillPoAtSend);
  };

  window.cchPoRemoveVendorInvoiceRow = function(btn) {
    var list = document.getElementById('cchVendorInvoicesList');
    var row = btn && btn.closest('.cch-vi-row');
    if (row) row.remove();
    if (list && !list.querySelector('.cch-vi-row')) {
      list.insertAdjacentHTML('beforeend', cchPoVendorChargeRowHtml({ type: 'freight' }));
    }
    cchPoUpdateBillPreview(window.__cchBillPoAtSend);
  };

  function cchPoBillNeedsQbSync(bill) {
    bill = bill || {};
    if (!bill.qbBillId) return false;
    var total = parseFloat(bill.billTotal) || 0;
    var syncedTotal = bill.qbSyncedTotal != null ? parseFloat(bill.qbSyncedTotal) : null;
    if (syncedTotal != null && Math.abs(total - syncedTotal) > 0.02) return true;
    if (bill.studioUpdatedAt && bill.qbSyncedAt && String(bill.studioUpdatedAt) > String(bill.qbSyncedAt)) return true;
    return false;
  }

  function cchPoMergeBillPreserve(prev, next) {
    prev = prev || {};
    if (prev.received) {
      next.receivedAt = prev.receivedAt || next.receivedAt;
      next.receivedBy = prev.receivedBy || next.receivedBy;
    }
    next.attachments = Array.isArray(prev.attachments) ? prev.attachments.slice() : (Array.isArray(next.attachments) ? next.attachments : []);
    if (prev.qbBillId) {
      next.qbBillId = prev.qbBillId;
      next.qbSyncedAt = prev.qbSyncedAt;
      next.qbSyncedTotal = prev.qbSyncedTotal;
      var qbDoc = prev.qbDocNumber || next.qbDocNumber;
      if (qbDoc) next.qbDocNumber = qbDoc;
    }
    return next;
  }

  window.cchPoBillAttachmentsHtml = function(projectId, poId, docData) {
    docData = docData || {};
    var bill = docData.bill || {};
    var atts = bill.attachments || [];
    var viNums = (bill.vendorInvoices || []).map(function(r) {
      return String(r.vendorInvoiceNumber || '').trim();
    }).filter(Boolean);
    (docData.vendorInvoiceGroups || []).forEach(function(g) {
      var n = String(g.vendorInvoiceNumber || '').trim();
      if (n) viNums.push(n);
    });
    var uniqNums = viNums.filter(function(n, i) { return viNums.indexOf(n) === i; });
    var tagOpts = '<option value="">— Link to invoice # (optional) —</option>' +
      uniqNums.map(function(n) { return '<option value="' + escAttr(n) + '">' + esc(n) + '</option>'; }).join('');
    var list = atts.length
      ? atts.map(function(a, i) {
          var icon = a.type && String(a.type).indexOf('pdf') >= 0 ? '📄' : '📎';
          var tag = a.vendorInvoiceNumber ? ' <span style="font-size:10px;color:#9CA3AF;">#' + esc(a.vendorInvoiceNumber) + '</span>' : '';
          return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(15,26,46,0.06);font-size:12px;">' +
            '<span>' + icon + '</span>' +
            '<a href="' + escAttr(a.url || '#') + '" target="_blank" rel="noopener" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#00796B;font-weight:600;">' + esc(a.name || 'File') + '</a>' +
            tag +
            '<button type="button" class="btn btn-sm" style="padding:2px 8px;font-size:10px;color:#B91C1C;" onclick="cchPoRemoveBillAttachment(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',' + i + ')">Remove</button>' +
          '</div>';
        }).join('')
      : '<div style="font-size:12px;color:var(--gray-400);font-style:italic;padding:4px 0;">No vendor invoice PDFs attached yet.</div>';
    return '<div id="cchBillAttachmentsPanel" style="margin:0 0 14px;padding:14px 16px;background:#fff;border:1px solid rgba(15,26,46,0.1);border-radius:4px;">' +
      '<div class="cch-doc-view-panel-title" style="margin:0 0 8px;">Vendor invoice attachments</div>' +
      '<p style="font-size:11px;color:#5C6B80;margin:0 0 10px;line-height:1.4;">Attach PDFs or images from the vendor (freight invoices, statements). Stored on this bill — not sent to QuickBooks as files.</p>' +
      '<div id="cchBillAttachmentsList">' + list + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px;">' +
        '<input type="file" id="cchBillAttachFile" accept=".pdf,image/*" style="max-width:220px;font-size:12px;" onchange="cchPoUploadBillAttachment(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',this)">' +
        (uniqNums.length ? '<select id="cchBillAttachTag" class="form-input" style="max-width:200px;font-size:12px;padding:6px 8px;">' + tagOpts + '</select>' : '') +
      '</div></div>';
  }

  window.cchPoUploadBillAttachment = async function(projectId, poId, inputEl) {
    var file = inputEl && inputEl.files && inputEl.files[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('File must be under 15MB', 'Attachment');
      inputEl.value = '';
      return;
    }
    var tagEl = document.getElementById('cchBillAttachTag');
    var invTag = tagEl ? String(tagEl.value || '').trim() : '';
    try {
      var path = 'attachments/' + projectId + '/purchaseOrders/' + poId + '/bill/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      var ref = firebase.storage().ref(path);
      var snap = await ref.put(file);
      var url = await snap.ref.getDownloadURL();
      var att = {
        name: file.name,
        url: url,
        type: file.type || '',
        size: file.size || 0,
        uploadedAt: new Date().toISOString(),
        vendorInvoiceNumber: invTag
      };
      var poRef = firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId);
      var poSnap = await poRef.get();
      var d = poSnap.data() || {};
      var bill = Object.assign({}, d.bill || {}, { received: true });
      var attachments = (bill.attachments || []).slice();
      attachments.push(att);
      bill.attachments = attachments;
      bill.studioUpdatedAt = new Date().toISOString();
      await poRef.update({ bill: bill, updatedAt: new Date().toISOString() });
      inputEl.value = '';
      if (typeof window.showToast === 'function') window.showToast('Attachment added', 'success');
      if (typeof window.navigate === 'function') window.navigate(window.location.hash);
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('Upload failed: ' + (e.message || e), 'Attachment');
    }
  };

  window.cchPoRemoveBillAttachment = async function(projectId, poId, idx) {
    if (!(typeof window.cchConfirm === 'function'
      ? await window.cchConfirm('Remove this attachment?', 'Remove', { confirmText: 'Remove', danger: true })
      : confirm('Remove attachment?'))) return;
    try {
      var poRef = firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId);
      var poSnap = await poRef.get();
      var d = poSnap.data() || {};
      var bill = Object.assign({}, d.bill || {});
      var attachments = (bill.attachments || []).slice();
      var removed = attachments.splice(idx, 1)[0];
      try {
        if (removed && removed.url) await firebase.storage().refFromURL(removed.url).delete();
      } catch (_e) {}
      bill.attachments = attachments;
      bill.studioUpdatedAt = new Date().toISOString();
      await poRef.update({ bill: bill, updatedAt: new Date().toISOString() });
      if (typeof window.showToast === 'function') window.showToast('Attachment removed', 'success');
      if (typeof window.navigate === 'function') window.navigate(window.location.hash);
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert(e.message || e, 'Attachment');
    }
  };

  function cchPoReadBillVendorInvoiceMetaFromDom() {
    var invEl = document.getElementById('cchBillVendorInvNum');
    var dateEl = document.getElementById('cchBillVendorInvDate');
    var trackEl = document.getElementById('cchBillTrackingNum');
    var carrierEl = document.getElementById('cchBillTrackingCarrier');
    var etaEl = document.getElementById('cchBillEtaDate');
    var notesEl = document.getElementById('cchBillShipmentNotes');
    return {
      vendorInvoiceNumber: invEl ? String(invEl.value || '').trim() : '',
      vendorInvoiceDate: dateEl ? String(dateEl.value || '').trim() : '',
      trackingNumber: trackEl ? String(trackEl.value || '').trim() : '',
      trackingCarrier: carrierEl ? String(carrierEl.value || '').trim() : '',
      etaDate: etaEl ? String(etaEl.value || '').trim() : '',
      shipmentNotes: notesEl ? String(notesEl.value || '').trim() : ''
    };
  }

  function cchPoReadBillTrackingGroupsFromDom() {
    var out = [];
    document.querySelectorAll('.cch-bill-vig-track-row').forEach(function(row) {
      var id = String(row.getAttribute('data-group-id') || '').trim();
      if (!id) return;
      var carrierEl = row.querySelector('.cch-bill-vig-carrier');
      var trackEl = row.querySelector('.cch-bill-vig-tracking');
      var etaEl = row.querySelector('.cch-bill-vig-eta');
      var notesEl = row.querySelector('.cch-bill-vig-notes');
      out.push({
        id: id,
        trackingCarrier: carrierEl ? String(carrierEl.value || '').trim() : '',
        trackingNumber: trackEl ? String(trackEl.value || '').trim() : '',
        etaDate: etaEl ? String(etaEl.value || '').trim() : '',
        notes: notesEl ? String(notesEl.value || '').trim() : ''
      });
    });
    return out;
  }

  function cchPoMergeTrackingIntoVendorInvoiceGroups(doc, poItems, trackPatches) {
    trackPatches = trackPatches || [];
    if (!trackPatches.length) return null;
    if (!window.cchPoVendorInvoiceGroupsPersisted(doc)) return null;
    var groups = window.cchPoVendorInvoiceGroupsUser(doc);
    if (!groups.length) return null;
    var byId = {};
    trackPatches.forEach(function(p) { byId[p.id] = p; });
    return groups.map(function(g) {
      var p = byId[g.id];
      if (!p) return g;
      return Object.assign({}, g, {
        trackingNumber: p.trackingNumber,
        trackingCarrier: p.trackingCarrier,
        etaDate: p.etaDate,
        notes: p.notes,
        updatedAt: new Date().toISOString()
      });
    });
  }

  function cchPoReadVendorInvoiceRowsFromDom() {
    var list = document.getElementById('cchVendorInvoicesList');
    if (!list) return [];
    var billInv = cchPoReadBillVendorInvoiceMetaFromDom();
    var out = [];
    list.querySelectorAll('.cch-vi-row').forEach(function(row, i) {
      var type = String(row.querySelector('.cch-vi-type') && row.querySelector('.cch-vi-type').value || 'extra').trim();
      var poLineIds = [];
      row.querySelectorAll('.cch-vi-po-line-cb:checked').forEach(function(cb) {
        if (cb.value) poLineIds.push(cb.value);
      });
      var invUnitRaw = row.querySelector('.cch-vi-inv-unit') ? String(row.querySelector('.cch-vi-inv-unit').value || '').trim() : '';
      var amt = parseFloat(row.querySelector('.cch-vi-amt') && row.querySelector('.cch-vi-amt').value) || 0;
      var poUnitPrice = null;
      var qty = null;
      if (cchPoVendorInvoiceSource(type) === 'price_change' && invUnitRaw) {
        var calc = cchPoCalcPriceChangeAmount(window.__cchBillPoLines || [], poLineIds, invUnitRaw);
        if (calc) {
          amt = calc.amount;
          poUnitPrice = calc.poUnitPrice;
          qty = calc.qty;
        }
      }
      if (Math.abs(amt) < 0.01) return;
      var rowOut = {
        id: 'vi_' + Date.now() + '_' + i,
        vendorInvoiceNumber: billInv.vendorInvoiceNumber,
        vendorInvoiceDate: billInv.vendorInvoiceDate,
        type: type,
        description: String(row.querySelector('.cch-vi-desc') && row.querySelector('.cch-vi-desc').value || '').trim(),
        amount: Math.round(amt * 100) / 100,
        poLineIds: poLineIds
      };
      if (cchPoVendorInvoiceSource(type) === 'price_change' && invUnitRaw) {
        rowOut.invoiceUnitPrice = parseFloat(invUnitRaw);
        if (poUnitPrice != null) rowOut.poUnitPrice = poUnitPrice;
        if (qty != null) rowOut.qty = qty;
      }
      out.push(rowOut);
    });
    return out;
  }

  function cchPoLineItemAmount(it) {
    if (!it) return 0;
    var qty = parseFloat(it.qty) || 1;
    var cost = parseFloat(it.cost) || 0;
    var amt = parseFloat(it.amount) || 0;
    var sh = parseFloat(it.shipping) || 0;
    if (cost > 0) return cost * qty + sh;
    return amt + sh;
  }

  function cchPoSnapshotPoLinesForBill(poItems, poAtSend) {
    var lines = [];
    (poItems || []).forEach(function(it, i) {
      if (typeof window.isProposalGroupHeaderItem === 'function' && window.isProposalGroupHeaderItem(it)) return;
      lines.push({
        source: 'po',
        lineId: it.id || it.lineId || ('po_line_' + i),
        title: it.title || it.name || it.description || 'Item',
        vendor: it.vendor || '',
        sku: it.sku || '',
        qty: parseFloat(it.qty) || 1,
        cost: parseFloat(it.cost) || 0,
        amount: Math.round(cchPoLineItemAmount(it) * 100) / 100
      });
    });
    if (!lines.length && poAtSend > 0.01) {
      lines.push({ source: 'po', lineId: 'po_total', title: 'Purchase order merchandise', vendor: '', qty: 1, amount: poAtSend });
    }
    return lines;
  }

  function cchPoBillPoLines(bill, poItems, poAtSend) {
    if (bill && bill.poLines && bill.poLines.length) return bill.poLines;
    if (bill && bill.items && bill.items.length) {
      var fromItems = bill.items.filter(function(it) { return it.source === 'po'; });
      if (fromItems.length) return fromItems;
    }
    return cchPoSnapshotPoLinesForBill(poItems, poAtSend);
  }

  function cchPoBillExtraRows(bill) {
    bill = bill || {};
    if (Array.isArray(bill.vendorInvoices) && bill.vendorInvoices.length) {
      return bill.vendorInvoices.filter(function(r) {
        return Math.abs(parseFloat(r.amount) || 0) > 0.01;
      }).map(function(r) {
        var src = cchPoVendorInvoiceSource(r.type);
        return {
          source: src,
          title: r.description || cchPoVendorInvoiceTypeLabel(r.type),
          amount: parseFloat(r.amount) || 0,
          vendorInvoiceNumber: r.vendorInvoiceNumber,
          vendorInvoiceDate: r.vendorInvoiceDate,
          note: r.description,
          poLineIds: Array.isArray(r.poLineIds) ? r.poLineIds.slice() : []
        };
      });
    }
    return cchPoBillAdditionalExpenseFields(bill).filter(function(it) {
      return Math.abs(parseFloat(it.amount) || 0) > 0.01;
    });
  }

  /** Canonical bill additional expense slots (legacy summary) or one row per vendorInvoices[] entry. */
  function cchPoBillAdditionalExpenseFields(bill) {
    bill = bill || {};
    if (Array.isArray(bill.vendorInvoices) && bill.vendorInvoices.length) {
      return bill.vendorInvoices.map(function(r) {
        var src = cchPoVendorInvoiceSource(r.type);
        var amt = parseFloat(r.amount) || 0;
        var label = String(r.description || '').trim() || cchPoVendorInvoiceTypeLabel(r.type);
        if (r.vendorInvoiceNumber) label += ' · #' + r.vendorInvoiceNumber;
        return { source: src, label: label, amount: amt, note: r.description || '' };
      });
    }
    var priceNote = '';
    var extraTitle = 'Other / extra';
    if (bill.items && bill.items.length) {
      bill.items.forEach(function(it) {
        if (it.source === 'price_change' && it.note) priceNote = it.note;
        if (it.source === 'extra' && it.title && it.title !== 'Other / extra') extraTitle = it.title;
      });
    }
    return [
      { source: 'freight', label: 'Freight', amount: parseFloat(bill.freight) || 0 },
      { source: 'tax', label: 'Pre-paid tax', amount: parseFloat(bill.tax) || 0 },
      { source: 'price_change', label: 'Price change', amount: parseFloat(bill.priceChange) || 0, note: priceNote },
      { source: 'extra', label: extraTitle, amount: parseFloat(bill.extras) || 0 }
    ];
  }

  function cchPoFormatBillLineAmount(amt) {
    var n = parseFloat(amt) || 0;
    if (Math.abs(n) < 0.01) return fmt(0);
    if (n < 0) return '-' + fmt(Math.abs(n));
    return '+' + fmt(n);
  }

  function cchPoPickVarianceReason(chargeRows, varianceAmt) {
    if (varianceAmt < -0.01) return 'vendor_discount';
    var ranked = (chargeRows || []).filter(function(c) { return Math.abs(parseFloat(c.amount) || 0) > 0.01; });
    ranked.sort(function(a, b) { return Math.abs(parseFloat(b.amount) || 0) - Math.abs(parseFloat(a.amount) || 0); });
    if (!ranked.length) return 'shipping';
    var top = ranked[0].source || ranked[0].id;
    if (top === 'price_change') return 'price_increase';
    if (top === 'extra' || top === 'merchandise') return 'other';
    return top;
  }

  function cchPoBillLineLabel(it) {
    var src = it.source || '';
    if (src === 'freight') return 'Freight';
    if (src === 'tax') return 'Pre-paid tax';
    if (src === 'merchandise') return it.title || 'Merchandise';
    if (src === 'price_change') return 'Price change';
    if (src === 'extra') return it.title || 'Other / extra';
    if (src === 'po') return 'PO merchandise';
    return it.title || src || 'Line';
  }

  function cchPoBillSourceBadge(src) {
    var s = String(src || '');
    var label = s === 'po' ? 'PO base' : s === 'merchandise' ? 'Merch' : s === 'tax' ? 'Pre-paid tax' : s === 'price_change' ? 'Price' : s === 'extra' ? 'Extra' : s === 'freight' ? 'Freight' : s || '—';
    var bg = s === 'po' ? 'rgba(27,51,82,0.08)' : 'rgba(202,138,4,0.12)';
    var col = s === 'po' ? '#1B3352' : '#92400E';
    return '<span style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;padding:3px 8px;border-radius:3px;background:' + bg + ';color:' + col + ';">' + esc(label) + '</span>';
  }

  /** Full vendor bill document (mirrors PO cch-doc-view-panel layout). */
  window.cchPoVendorBillDocumentHtml = function(projectId, poId, docData, poItems, poNumber) {
    var bill = docData.bill;
    var vendor = String(docData.vendor || '').trim();
    var poNumStr = poNumber || poNum(docData);
    var hasBill = bill && bill.received;

    if (!hasBill) {
      var billLane = typeof window.cchPoBillLaneId === 'function'
        ? window.cchPoBillLaneId(docData, poItems || docData.items || [])
        : 'pending';
      var billStatusLabel = billLane === 'partial' ? 'Partial' : (billLane === 'na' ? '—' : 'Pending');
      var canReceive = billLane !== 'na';
      var btnHtml = '';
      if (canReceive) {
        btnHtml += '<button type="button" class="btn btn-primary btn-sm" onclick="cchPoOpenReceiveBillModal(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\')">Receive vendor bill</button>';
        if (billLane === 'partial') {
          btnHtml += '<button type="button" class="btn btn-secondary btn-sm" onclick="cchPoOpenAddToBillModal(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\')">+ Add vendor invoice</button>';
        }
      }
      return '<div id="cchVendorBillDoc" style="margin-bottom:14px;padding:14px 16px;background:#fff;border:1px solid rgba(202,138,4,0.35);border-left:3px solid #CA8A04;border-radius:4px;">' +
        '<div style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px;">' +
          '<div style="min-width:0;flex:1;">' +
            '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#92400E;margin-bottom:6px;">Vendor bill <span style="font-weight:600;color:#B45309;">(from vendor)</span></div>' +
            '<p style="font-size:12px;color:#5C6B80;margin:0 0 8px;line-height:1.5;max-width:560px;">You send the <strong>PO</strong> to the vendor — they send <strong>their invoice</strong> back. When it arrives, check PO items, add freight/tax, and save. One combined bill per PO in Studio → one QuickBooks Bill.</p>' +
            '<div style="font-size:13px;color:#1B3352;">' + esc(billStatusLabel) + ' · PO ' + esc(poNumStr) + (vendor ? ' · ' + esc(vendor) : '') + '</div>' +
          '</div>' +
          (btnHtml ? '<div style="display:flex;flex-wrap:wrap;gap:8px;flex-shrink:0;align-items:center;">' + btnHtml + '</div>' : '') +
        '</div></div>';
    }

    var displayInvoices = typeof window.cchPoVendorInvoiceGroupsDisplay === 'function'
      ? window.cchPoVendorInvoiceGroupsDisplay(docData, poItems || docData.items || [])
      : [];
    var receivedStr = bill.receivedAt && typeof window.formatDate === 'function'
      ? window.formatDate(bill.receivedAt) : (bill.receivedAt ? String(bill.receivedAt).slice(0, 10) : '');
    var billTotal = window.cchPoVendorBillTotal(docData);
    var paid = window.cchPoPaidTotal(docData);
    var due = window.cchPoAmountDue(docData);
    var blRef = typeof window.cchPoQbBillDocNumberFromPo === 'function' ? window.cchPoQbBillDocNumberFromPo(docData) : '';
    var summaryLine = [];
    summaryLine.push('<strong style="color:#1B3352;">Combined vendor bill</strong>');
    if (displayInvoices.length) {
      summaryLine.push('<span style="font-size:12px;color:#5C6B80;">' + displayInvoices.length + ' invoice' + (displayInvoices.length !== 1 ? 's' : '') + ' in table below</span>');
    }
    summaryLine.push('<span style="font-family:var(--font-mono);">' + fmt(billTotal) + '</span>');
    if (paid > 0.01) summaryLine.push('<span style="color:#2E7D32;">' + fmt(paid) + ' paid</span>');
    summaryLine.push('<span style="font-weight:700;color:' + (due > 0.01 ? '#B45309' : '#15803D') + ';">' + fmt(due) + ' due</span>');
    if (due <= 0.01) summaryLine.push('<span style="color:#15803D;font-weight:600;">Paid</span>');

    var metaLine = 'PO ' + esc(poNumStr) + (vendor ? ' · ' + esc(vendor) : '');
    if (receivedStr) metaLine += ' · Received ' + esc(receivedStr);
    if (bill.qbBillId) {
      metaLine += ' · <span style="color:#1B5E20;">QB ' + esc(bill.qbDocNumber || blRef || 'synced') + '</span>';
    } else if (blRef) {
      metaLine += ' · QB ' + esc(blRef);
    }

    var scrollBtn = displayInvoices.length
      ? '<button type="button" class="btn btn-secondary btn-sm" style="font-size:11px;" onclick="var p=document.getElementById(\'cchVendorInvoiceGroupsPanel\');if(p)p.scrollIntoView({behavior:\'smooth\',block:\'start\'});">Invoices (' + displayInvoices.length + ')</button>'
      : '';
    var qbBtn = '';
    if (cchPoCanPushBillToQb()) {
      var qbLabel = bill.qbBillId ? 'Sync QB' : 'Push QB';
      qbBtn = '<button type="button" class="btn btn-secondary btn-sm" style="font-size:11px;background:#1B3352;color:#EDE8E0;border-color:#1B3352;" onclick="cchPoPushBillToQB(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',this)">' + qbLabel + '</button>';
    }

    return '<div id="cchVendorBillDoc" style="margin-bottom:12px;padding:10px 14px;background:#fff;border:1px solid rgba(15,26,46,0.1);border-radius:4px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;">' +
      '<div style="min-width:0;flex:1;font-size:13px;line-height:1.45;color:#1B3352;">' + summaryLine.join(' · ') +
        '<span style="font-size:11px;color:#5C6B80;margin-left:6px;">(' + metaLine + ')</span></div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;flex-shrink:0;align-items:center;">' +
        scrollBtn +
        qbBtn +
        '<button type="button" class="btn btn-secondary btn-sm" style="font-size:11px;" onclick="cchPoOpenAddToBillModal(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\')">+ Add vendor invoice</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" style="font-size:11px;" onclick="cchPoOpenReceiveBillModal(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',\'edit\')">Edit bill</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" style="font-size:11px;" onclick="var a=document.getElementById(\'cchBillAttachmentsPanel\');if(a)a.scrollIntoView({behavior:\'smooth\',block:\'start\'});else cchPoOpenReceiveBillModal(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',\'edit\')">Attach</button>' +
        cchPoPayBillBtnHtml(projectId, poId, { compact: true, style: 'font-size:11px;' + (due <= 0.01 ? ';background:#1B3352;color:#EDE8E0;border-color:#1B3352;' : '') }) +
      '</div></div>';
  };

  function cchPoBillBreakdownTableHtml(bill, poAtSend, docData, invFilter) {
    invFilter = invFilter || null;
    var invNum = invFilter ? invFilter.vendorInvoiceNumber : '';
    var invPoLineIds = invFilter ? (invFilter.poLineIds || []) : null;
    var poLines = cchPoBillPoLines(bill, (docData && docData.items) || [], poAtSend);
    var payments = (docData && docData.payments) || [];
    var excludeIdx = invFilter && invFilter.excludePaymentIdx != null ? invFilter.excludePaymentIdx : null;

    var billTotal;
    var paid;
    var due;
    if (invNum) {
      billTotal = cchPoVendorInvoiceGroupTotal(bill, invNum, invPoLineIds, poLines);
      paid = cchPoVendorInvoicePaidAmount(payments, invNum, excludeIdx);
      due = Math.max(0, Math.round((billTotal - paid) * 100) / 100);
    } else {
      billTotal = window.cchPoVendorBillTotal(docData);
      paid = window.cchPoVendorBillPaidAmount(docData);
      due = window.cchPoAmountDue(docData);
    }

    var allPoLines = poLines;
    var billedIds = invPoLineIds && invPoLineIds.length
      ? invPoLineIds.slice()
      : cchPoBillBilledLineIds(bill, allPoLines);
    var billedLines = billedIds.length
      ? allPoLines.filter(function(it) { return billedIds.indexOf(it.lineId) >= 0; })
      : allPoLines;
    var poSubtotal = invPoLineIds && invPoLineIds.length
      ? cchPoSumPoLineAmounts(allPoLines, invPoLineIds)
      : (bill.poSubtotal != null ? parseFloat(bill.poSubtotal) : cchPoSumPoLineAmounts(allPoLines, billedIds));
    var extras = cchPoBillExtraRows(bill);
    if (invNum) {
      extras = cchPoChargesForVendorInvoice(bill, invNum, invPoLineIds).map(function(r) {
        return {
          title: r.description || cchPoVendorInvoiceTypeLabel(r.type),
          amount: r.amount,
          source: cchPoVendorInvoiceSource(r.type),
          vendorInvoiceNumber: r.vendorInvoiceNumber,
          poLineIds: r.poLineIds
        };
      });
    }
    var html = '<table style="width:100%;font-size:12px;border-collapse:collapse;margin-top:8px;">';
    if (invNum) {
      html += '<tr><td colspan="2" style="padding:0 0 8px;font-size:11px;color:#5C6B80;">Vendor invoice <strong>#' + esc(invNum) + '</strong></td></tr>';
    }
    if (billedLines.length) {
      billedLines.forEach(function(it) {
        var amt = parseFloat(it.amount) || 0;
        html += '<tr><td style="padding:4px 0;color:#1B3352;font-weight:600;">' + esc(it.title || 'Item') + '</td>' +
          '<td style="padding:4px 0;text-align:right;font-weight:600;">' + fmt(amt) + '</td></tr>';
      });
      html += '<tr style="border-top:1px solid rgba(15,26,46,0.08);"><td style="padding:6px 0;color:#5C6B80;">Merchandise subtotal</td>' +
        '<td style="padding:6px 0;text-align:right;font-weight:600;">' + fmt(poSubtotal) + '</td></tr>';
    } else {
      html += '<tr><td style="padding:6px 0;color:#5C6B80;">Merchandise subtotal</td><td style="padding:6px 0;text-align:right;font-weight:600;">' + fmt(poSubtotal) + '</td></tr>';
    }
    if (Math.abs(poSubtotal - poAtSend) > 0.02 && !invNum) {
      html += '<tr><td style="padding:2px 0 6px;font-size:10px;color:#9CA3AF;">Full PO total (reference)</td>' +
        '<td style="padding:2px 0 6px;text-align:right;font-size:10px;color:#9CA3AF;">' + fmt(poAtSend) + '</td></tr>';
    }
    extras.forEach(function(it) {
      var amt = parseFloat(it.amount) || 0;
      if (Math.abs(amt) < 0.01) return;
      var label = it.title || it.source || 'Additional';
      if (it.source === 'price_change') label = 'Price change';
      if (it.vendorInvoiceNumber) label += ' #' + it.vendorInvoiceNumber;
      if (it.poLineIds && it.poLineIds.length) {
        var lt = cchPoPoLineTitlesFromIds(bill.poLines || [], it.poLineIds);
        if (lt.length) label += ' → ' + lt.join(', ');
      }
      html += '<tr><td style="padding:4px 0;color:#5C6B80;padding-left:12px;">' + (amt >= 0 ? '+ ' : '− ') + esc(label) + '</td>' +
        '<td style="padding:4px 0;text-align:right;font-weight:600;color:' + (amt < 0 ? '#15803D' : '#B45309') + ';">' + cchPoFormatBillLineAmount(amt) + '</td></tr>';
    });
    html += '<tr style="border-top:1px solid rgba(15,26,46,0.12);"><td style="padding:8px 0;font-weight:700;">' + (invNum ? 'Invoice total' : 'Vendor bill total') + '</td><td style="padding:8px 0;text-align:right;font-weight:700;">' + fmt(billTotal) + '</td></tr>';
    if (paid > 0.01) {
      html += '<tr><td style="padding:4px 0;color:#2E7D32;">Paid</td><td style="padding:4px 0;text-align:right;color:#2E7D32;font-weight:600;">-' + fmt(paid) + '</td></tr>';
    }
    html += '<tr><td style="padding:6px 0;font-weight:700;color:#1B3352;">Balance due</td><td style="padding:6px 0;text-align:right;font-weight:700;font-size:14px;color:' + (due > 0.01 ? '#B45309' : '#15803D') + ';">' + fmt(due) + '</td></tr>';
    html += '</table>';
    return html;
  }

  /** PO procurement lane (Step 1) — separate from bill status and shipping/receiving. */
  var CCH_PO_PROCUREMENT_STATUSES = [
    { id: 'Draft', label: 'Draft' },
    { id: 'Sent to Vendor', label: 'Sent to vendor' },
    { id: 'Waiting for Confirmation', label: 'Waiting for confirmation' },
    { id: 'Confirmed', label: 'Confirmed' }
  ];

  /** Canonical procurement lane: draft | waiting | confirmed */
  window.cchPoProcurementLaneId = function(doc) {
    doc = doc || {};
    var proc = String(doc.procurementStatus || '').trim();
    if (proc === 'Confirmed') return 'confirmed';
    if (proc === 'Waiting for Confirmation' || proc === 'Sent to Vendor') return 'waiting';
    if (doc.poSentAt || doc.poLocked || String(doc.poStatus || '').trim().toLowerCase() === 'sent') return 'waiting';
    return 'draft';
  };

  window.cchPoProcurementStatusLabel = function(doc) {
    doc = doc || {};
    var lane = window.cchPoProcurementLaneId(doc);
    if (lane === 'confirmed') return 'Confirmed';
    if (lane === 'waiting') {
      var proc = String(doc.procurementStatus || '').trim();
      if (proc === 'Sent to Vendor') return 'Sent to vendor';
      return 'Waiting for confirmation';
    }
    return 'Draft';
  };

  /** All POs / project PO list — PO / order lane badge (not shipping fulfillment). */
  window.cchPoProcurementStatusBadgeHtml = function(doc, opts) {
    opts = opts || {};
    doc = doc || {};
    var lane = window.cchPoProcurementLaneId(doc);
    var label = window.cchPoProcurementStatusLabel(doc);
    var inner = typeof window.statusBadge === 'function'
      ? window.statusBadge(label)
      : ('<span class="badge badge-draft">' + esc(label) + '</span>');
    if (!opts.clickable || !opts.projectId || !opts.poId) return inner;
    if (lane === 'waiting') {
      return '<span role="button" tabindex="0" title="Mark as confirmed — order conf # + vendor PDF" style="cursor:pointer;display:inline-block;" ' +
        'onclick="event.stopPropagation();cchPoOpenMarkConfirmedModal(\'' + escJs(opts.projectId) + '\',\'' + escJs(opts.poId) + '\')">' +
        inner + '</span>';
    }
    if (lane === 'confirmed') {
      return '<span role="button" tabindex="0" title="View PO — confirmed with vendor" style="cursor:pointer;display:inline-block;" ' +
        'onclick="event.stopPropagation();navigate(\'#/project/' + escJs(opts.projectId) + '/po/' + escJs(opts.poId) + '\')">' +
        inner + '</span>';
    }
    return inner;
  };

  /** Bill lane: na | pending | partial | received | closed (paid + shipped). */
  window.cchPoBillIsReceived = function(doc) {
    doc = doc || {};
    var bill = doc.bill || {};
    if (bill.received || bill.qbBillId) return true;
    var poSt = String(doc.poStatus || '').trim().toLowerCase();
    return poSt === 'bill_received' || poSt === 'paid' || poSt === 'cleared';
  };

  window.cchPoBillIsPaidInFull = function(doc) {
    doc = doc || {};
    if (!window.cchPoBillIsReceived(doc)) return false;
    var due = typeof window.cchPoAmountDue === 'function' ? window.cchPoAmountDue(doc) : 0;
    var paid = typeof window.cchPoVendorBillPaidAmount === 'function' ? window.cchPoVendorBillPaidAmount(doc) : 0;
    if (due <= 0.02 && paid > 0.01) return true;
    var poSt = String(doc.poStatus || '').trim().toLowerCase();
    return poSt === 'paid' || poSt === 'cleared';
  };

  /** Goods in hand / installed — not in-transit-only (Shipped alone does not close). */
  window.cchPoIsReceivedForClose = function(doc, poItems) {
    doc = doc || {};
    var st = String(window.cchPoShippingStatus(doc, poItems) || '').trim();
    var ok = ['Delivered', 'At Receiver', 'At Workroom', 'Received', 'Installed'];
    return ok.indexOf(st) >= 0;
  };
  window.cchPoIsShippedForClose = window.cchPoIsReceivedForClose;

  /** PO fully done: vendor bill received, paid in full, and goods received or installed. */
  window.cchPoOrderClosed = function(doc, poItems) {
    doc = doc || {};
    return window.cchPoBillIsReceived(doc) &&
      window.cchPoBillIsPaidInFull(doc) &&
      window.cchPoIsShippedForClose(doc, poItems);
  };

  window.cchPoBillLaneId = function(doc, poItems) {
    doc = doc || {};
    if (window.cchPoOrderClosed(doc, poItems)) return 'closed';
    if (window.cchPoBillIsReceived(doc)) return 'received';
    if (window.cchPoProcurementLaneId(doc) === 'draft') return 'na';
    if (window.cchPoBillHasPartialActivity(doc, poItems)) return 'partial';
    return 'pending';
  };

  window.cchPoBillStatusLabel = function(doc, poItems) {
    doc = doc || {};
    var lane = window.cchPoBillLaneId(doc, poItems);
    if (lane === 'na') return '—';
    if (lane === 'pending') return 'Pending';
    if (lane === 'partial') return 'Partial';
    if (lane === 'received') return 'Bill received';
    if (lane === 'closed') return 'Closed';
    return '—';
  };

  window.cchPoBillHasPartialActivity = function(doc, poItems) {
    doc = doc || {};
    poItems = poItems || doc.items || [];
    var bill = doc.bill || {};
    if (bill.received) return false;
    if (bill.items && bill.items.length) return true;
    if (bill.attachments && bill.attachments.length) return true;
    if (bill.vendorInvoices && bill.vendorInvoices.length) return true;
    if (Array.isArray(bill.billedPoLineIds) && bill.billedPoLineIds.length) return true;
    if (bill.billTotal != null && Math.abs(parseFloat(bill.billTotal) || 0) > 0.01) return true;
    var groups = typeof window.cchPoVendorInvoiceGroupsUser === 'function'
      ? window.cchPoVendorInvoiceGroupsUser(doc)
      : (Array.isArray(doc.vendorInvoiceGroups) ? doc.vendorInvoiceGroups : []);
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i] || {};
      var dt = String(g.documentType || '').trim();
      if (dt === 'confirmation') continue;
      if (dt === 'ship_invoice') return true;
      var inv = String(g.vendorInvoiceNumber || '').trim();
      var gid = String(g.id || '').trim();
      if (inv && gid.indexOf('vig_inferred') !== 0) return true;
    }
    return false;
  };

  window.cchPoBillStatusBadgeHtml = function(doc, opts) {
    opts = opts || {};
    doc = doc || {};
    var label = window.cchPoBillStatusLabel(doc, opts.poItems || doc.items || []);
    if (label === '—') {
      return '<span style="font-size:11px;color:var(--gray-400);">—</span>';
    }
    var inner = typeof window.statusBadge === 'function'
      ? window.statusBadge(label)
      : ('<span class="badge badge-draft">' + esc(label) + '</span>');
    if (!opts.clickable || !opts.projectId || !opts.poId) return inner;
    return '<span role="button" tabindex="0" title="Open PO — vendor bill" style="cursor:pointer;display:inline-block;" ' +
      'onclick="event.stopPropagation();navigate(\'#/project/' + escJs(opts.projectId) + '/po/' + escJs(opts.poId) + '\')">' +
      inner + '</span>';
  };

  window.cchPoBillLanePanelHtml = function(projectId, poId, docData, poItems) {
    docData = docData || {};
    poItems = poItems || docData.items || [];
    var lane = window.cchPoBillLaneId(docData, poItems);

    if (lane === 'na') {
      return '<div class="cch-po-bill-lane" style="margin-bottom:12px;padding:12px 14px;background:var(--gray-50);border:1px solid rgba(15,26,46,0.08);border-radius:4px;">' +
        '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5C6B80;margin-bottom:6px;">Bill status</div>' +
        '<div style="font-size:12px;color:#9CA3AF;">— Applies after PO is sent</div></div>';
    }

    var steps = [
      { id: 'pending', label: 'Pending' },
      { id: 'partial', label: 'Partial' },
      { id: 'received', label: 'Bill received' },
      { id: 'closed', label: 'Closed' }
    ];
    var idx = lane === 'closed' ? 3 : (lane === 'received' ? 2 : (lane === 'partial' ? 1 : 0));
    var chips = steps.map(function(st, i) {
      var done = i < idx || (lane === 'closed' && i <= 3);
      var active = i === idx && lane !== 'closed';
      if (lane === 'closed') {
        done = i <= 3;
        active = false;
      }
      return '<span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:3px;' +
        (done ? 'background:rgba(46,125,50,0.12);color:#1B5E20;border:1px solid rgba(46,125,50,0.2);' :
          active ? 'background:#92400E;color:#fff;border:1px solid #92400E;' :
          'background:#fff;color:#5C6B80;border:1px solid rgba(15,26,46,0.14);') + '">' +
        (done ? '✓ ' : '') + esc(st.label) + '</span>' +
        (i < steps.length - 1 ? '<span style="color:var(--gray-300);font-size:10px;">→</span>' : '');
    }).join('');

    var paid = 0;
    var due = 0;
    if (lane === 'received' || lane === 'closed') {
      paid = typeof window.cchPoVendorBillPaidAmount === 'function' ? window.cchPoVendorBillPaidAmount(docData) : 0;
      due = typeof window.cchPoAmountDue === 'function' ? window.cchPoAmountDue(docData) : 0;
    }

    var moneyHtml = '<div style="display:flex;flex-wrap:wrap;gap:20px;margin-top:10px;font-size:12px;align-items:baseline;">' +
      '<span><span style="color:#5C6B80;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:2px;">Paid</span>' +
      '<span style="font-family:var(--font-mono);font-weight:600;color:' + (paid > 0.01 ? '#1B5E20' : '#9CA3AF') + ';">' +
      ((lane === 'received' || lane === 'closed') ? fmt(paid) : '—') + '</span></span>' +
      '<span><span style="color:#5C6B80;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;display:block;margin-bottom:2px;">Balance</span>' +
      '<span style="font-family:var(--font-mono);font-weight:700;color:' + (due > 0.02 ? '#B45309' : ((lane === 'received' || lane === 'closed') ? '#1B5E20' : '#9CA3AF')) + ';">' +
      ((lane === 'received' || lane === 'closed') ? fmt(due) : '—') + '</span></span></div>';

    var actions = '';
    if (lane === 'pending') {
      actions = '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:12px;">' +
        '<button type="button" class="btn btn-primary btn-sm" style="background:#92400E;" onclick="cchPoOpenReceiveBillModal(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\')">Receive vendor bill</button>' +
        '<span style="font-size:11px;color:#5C6B80;line-height:1.45;max-width:520px;">PO sent — waiting for the vendor&apos;s combined invoice. Paid and balance appear here after the bill is received.</span>' +
        '</div>';
    } else if (lane === 'partial') {
      actions = '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:12px;">' +
        '<button type="button" class="btn btn-primary btn-sm" style="background:#92400E;" onclick="cchPoOpenReceiveBillModal(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\')">Receive vendor bill</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" onclick="cchPoOpenAddToBillModal(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\')">+ Add vendor invoice</button>' +
        '<span style="font-size:11px;color:#5C6B80;line-height:1.45;">Ship invoices or bill lines entered — finish with <strong>Receive vendor bill</strong> when the combined invoice is ready.</span>' +
        '</div>';
    } else if (lane === 'closed') {
      actions = '<div style="margin-top:10px;font-size:11px;color:#1B5E20;font-weight:600;">Closed — vendor bill paid in full and goods received or installed.</div>';
    } else {
      var recvStr = docData.bill && docData.bill.receivedAt && typeof window.formatDate === 'function'
        ? window.formatDate(docData.bill.receivedAt)
        : (docData.bill && docData.bill.receivedAt ? String(docData.bill.receivedAt).slice(0, 10) : '');
      var closeHints = [];
      if (due > 0.02) closeHints.push('pay balance');
      if (!window.cchPoIsReceivedForClose(docData, poItems)) closeHints.push('mark Received or Installed when goods are in');
      actions = '<div style="margin-top:10px;font-size:11px;color:#5C6B80;line-height:1.45;">' +
        (recvStr ? 'Bill received ' + esc(recvStr) + '. ' : 'Bill received. ') +
        (closeHints.length
          ? 'To <strong>Closed</strong>: ' + esc(closeHints.join(' and ')) + '.'
          : 'Use the vendor bill section below to edit, pay, or sync to QuickBooks.') +
        '</div>';
    }

    return '<div class="cch-po-bill-lane" style="margin-bottom:12px;padding:12px 14px;background:var(--gray-50);border:1px solid rgba(15,26,46,0.08);border-radius:4px;">' +
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5C6B80;margin-bottom:8px;">Bill status</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">' + chips + '</div>' +
      moneyHtml + actions +
      '</div>';
  };

  /* ---- Receiver assignment (a PO is uploaded/sent to a receiver; the link lives on po.receiver) ---- */
  window._cchReceiversCache = window._cchReceiversCache || null;

  /** Load receiver contacts once (Vendors type/category receiver/freight + Team role receiver), cached. */
  window.cchPoLoadReceivers = async function(force) {
    if (window._cchReceiversCache && !force) return window._cchReceiversCache;
    var out = [];
    var seen = {};
    function add(name, data) {
      name = String(name || '').trim();
      if (!name || seen[name.toLowerCase()]) return;
      seen[name.toLowerCase()] = true;
      out.push({
        name: name,
        email: String((data && (data.email || data.contactEmail)) || '').trim(),
        phone: String((data && (data.phone || data.contactPhone)) || '').trim()
      });
    }
    try {
      var vs = await firebase.firestore().collection('vendors').get();
      vs.forEach(function(d) {
        var v = d.data() || {};
        var cat = String(v.category || '').trim();
        var typ = String(v.type || v.vendorType || '').trim().toLowerCase();
        if (cat === 'Delivery / Receiver' || cat === 'Freight / Receiver' ||
            v.type === 'receiver' || v.isReceiver === true ||
            typ.indexOf('receiver') >= 0 || typ.indexOf('freight') >= 0) {
          add(v.name || v.company || v.vendor, v);
        }
      });
    } catch (_e) {}
    try {
      var ts = await firebase.firestore().collection('team').get();
      ts.forEach(function(d) {
        var t = d.data() || {};
        if (String(t.role || '').trim().toLowerCase() === 'receiver') add(t.name || t.company, t);
      });
    } catch (_e) {}
    out.sort(function(a, b) { return a.name.localeCompare(b.name); });
    window._cchReceiversCache = out;
    return out;
  };

  /** <option> list for a receiver picker; always includes the current value even if not in the list. */
  window.cchPoReceiverOptionsHtml = function(selected) {
    selected = String(selected || '').trim();
    if (window._cchReceiversCache == null) {
      window._cchReceiversCache = [];
      window.cchPoLoadReceivers(true).then(function() {
        if (typeof window.cchOmIsActive === 'function' && window.cchOmIsActive() &&
            typeof window.cchOmSoftRefresh === 'function') {
          window.cchOmSoftRefresh();
        }
      });
    }
    var list = window._cchReceiversCache || [];
    var html = '<option value="">— Receiver —</option>';
    var found = false;
    list.forEach(function(r) {
      var sel = r.name === selected;
      if (sel) found = true;
      html += '<option value="' + escAttr(r.name) + '"' + (sel ? ' selected' : '') + '>' + esc(r.name) + '</option>';
    });
    if (selected && !found) html += '<option value="' + escAttr(selected) + '" selected>' + esc(selected) + '</option>';
    return html;
  };

  /** Editable receiver <select> that saves to po.receiver. Safe in list rows (stops row click). */
  window.cchPoReceiverSelectHtml = function(projectId, poId, selected) {
    return '<select class="form-input cch-po-receiver-select" style="font-size:11px;padding:4px 8px;min-width:150px;" ' +
      'onclick="event.stopPropagation()" ' +
      'onchange="window.cchPoSaveReceiver(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',this.value)">' +
      window.cchPoReceiverOptionsHtml(selected) + '</select>';
  };

  window.cchPoSaveReceiver = async function(projectId, poId, value) {
    value = String(value || '').trim();
    try {
      await firebase.firestore().collection('boards').doc(projectId)
        .collection('purchaseOrders').doc(poId)
        .update({ receiver: value, updatedAt: new Date().toISOString() });
      if (window._omPosCache && Array.isArray(window._omPosCache.pos)) {
        for (var i = 0; i < window._omPosCache.pos.length; i++) {
          var p = window._omPosCache.pos[i];
          if (p && p.projectId === projectId && p.id === poId) { p.receiver = value; break; }
        }
      }
      if (typeof window.showToast === 'function') {
        window.showToast(value ? ('Receiver: ' + value) : 'Receiver cleared', 'success');
      }
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert(e.message || e, 'Receiver');
      else console.warn('cchPoSaveReceiver', e);
    }
  };

  if (typeof firebase !== 'undefined' && firebase.firestore) {
    try { window.cchPoLoadReceivers(); } catch (_e) {}
  }

  window.cchPoShippingLanePanelHtml = function(projectId, poId, docData, poItems) {
    docData = docData || {};
    poItems = poItems || docData.items || [];

    var receiverRowHtml = '<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;">' +
      '<label style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#5C6B80;white-space:nowrap;">Receiver</label>' +
      window.cchPoReceiverSelectHtml(projectId, poId, docData.receiver) +
      '<span style="font-size:10px;color:#9CA3AF;">Where this PO ships — used for Airtable + shipment notification</span>' +
      '</div>';

    if (!window.cchPoShippingLaneActive(docData)) {
      return '<div class="cch-po-shipping-lane" style="margin-bottom:12px;padding:12px 14px;background:var(--gray-50);border:1px solid rgba(15,26,46,0.08);border-radius:4px;">' +
        '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5C6B80;margin-bottom:6px;">Shipping / Receiving</div>' +
        receiverRowHtml +
        '<div style="font-size:12px;color:#9CA3AF;margin-top:8px;">— Status applies after PO is confirmed with vendor</div></div>';
    }

    var steps = [
      { id: 'pending', label: 'Pending' },
      { id: 'shipped', label: 'Shipped' },
      { id: 'received', label: 'Received' }
    ];
    var idx = window.cchPoShippingMilestoneIndex(docData, poItems);
    var chips = steps.map(function(st, i) {
      var done = i < idx || (idx === 2 && i <= 2);
      var active = i === idx && idx < 2;
      if (idx === 2) {
        done = i <= 2;
        active = false;
      }
      return '<span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:3px;' +
        (done ? 'background:rgba(46,125,50,0.12);color:#1B5E20;border:1px solid rgba(46,125,50,0.2);' :
          active ? 'background:#1B3352;color:#EDE8E0;border:1px solid #1B3352;' :
          'background:#fff;color:#5C6B80;border:1px solid rgba(15,26,46,0.14);') + '">' +
        (done ? '✓ ' : '') + esc(st.label) + '</span>' +
        (i < steps.length - 1 ? '<span style="color:var(--gray-300);font-size:10px;">→</span>' : '');
    }).join('');

    var cur = window.cchPoShippingStatus(docData, poItems) || 'Pending';
    var uid = 'cchPoShipLane_' + String(poId || '').replace(/[^\w]/g, '').slice(0, 10);
    var editor = window.cchPoFulfillmentStatusEditorHtml(projectId, poId, docData, {
      uid: uid,
      label: 'Status',
      compact: true,
      showSaveButton: true
    });

    var trackingHtml = '';
    var groups = typeof window.cchPoVendorInvoiceGroupsDisplay === 'function'
      ? window.cchPoVendorInvoiceGroupsDisplay(docData, poItems)
      : [];
    var shipGroups = groups.filter(function(g) {
      return String(g.documentType || '').trim() !== 'confirmation';
    });
    if (shipGroups.length) {
      var g0 = shipGroups[0];
      var parts = [];
      if (g0.trackingNumber) parts.push('Tracking ' + esc(g0.trackingNumber));
      if (g0.trackingCarrier) parts.push(esc(g0.trackingCarrier));
      if (g0.etaDate && typeof window.cchPoFormatEtaDate === 'function') {
        parts.push('ETA ' + esc(window.cchPoFormatEtaDate(g0.etaDate)));
      } else if (g0.etaDate) {
        parts.push('ETA ' + esc(String(g0.etaDate).slice(0, 10)));
      }
      if (parts.length) {
        trackingHtml = '<div style="margin-top:10px;font-size:11px;color:#5C6B80;">' + parts.join(' · ') + '</div>';
      }
    }
    var loc = String(docData.receiver || docData.workroom || docData.location || '').trim();
    if (loc) {
      trackingHtml += '<div style="margin-top:4px;font-size:11px;color:#1B3352;"><strong>Location</strong> ' + esc(loc) + '</div>';
    }

    var checkinStatuses = ['At Receiver', 'At Workroom', 'Delivered', 'Received', 'Installed'];
    var checkinHtml = '<div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(15,26,46,0.08);">' +
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#5C6B80;margin-bottom:8px;">Receiver check-in</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">' +
      checkinStatuses.map(function(st) {
        var active = cur === st;
        return '<button type="button" class="btn btn-secondary btn-sm" style="font-size:10px;padding:4px 10px;' +
          (active ? 'background:#1B3352;color:#EDE8E0;border-color:#1B3352;font-weight:700;' : '') + '" ' +
          'onclick="cchPoQuickSetShippingStatus(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',\'' + escJs(st) + '\')">' +
          esc(st) + '</button>';
      }).join('') +
      '<span style="font-size:10px;color:#5C6B80;line-height:1.4;max-width:280px;">Updates Studio + linked FFE items. Receivers can also check in via <strong>Airtable</strong> (write-back planned).</span>' +
      '</div></div>';

    return '<div class="cch-po-shipping-lane" style="margin-bottom:12px;padding:12px 14px;background:var(--gray-50);border:1px solid rgba(15,26,46,0.08);border-radius:4px;">' +
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5C6B80;margin-bottom:8px;">Shipping / Receiving</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:10px;">' + chips +
      '<span style="font-size:11px;color:#5C6B80;margin-left:6px;">Current: <strong>' + esc(cur) + '</strong></span></div>' +
      editor + receiverRowHtml + trackingHtml + checkinHtml +
      '</div>';
  };

  /** Project / All POs list — editable ship status when PO is confirmed. */
  window.cchPoListShippingStatusHtml = function(po) {
    if (typeof window.cchPoShippingStatusEditorCellHtml === 'function') {
      return window.cchPoShippingStatusEditorCellHtml(po);
    }
    po = po || {};
    if (typeof window.cchPoShippingStatusBadgeHtml !== 'function') return '—';
    return window.cchPoShippingStatusBadgeHtml(po, {
      projectId: po.projectId,
      poId: po.id,
      clickable: true
    });
  };

  function cchPoProcurementStatusOptionsHtml(current, opts) {
    opts = opts || {};
    current = String(current || '').trim();
    var lane = opts.lane || '';
    var html = '';
    CCH_PO_PROCUREMENT_STATUSES.forEach(function(st) {
      if (opts.excludeConfirmed && st.id === 'Confirmed') return;
      if (opts.sentOnly && st.id === 'Draft') return;
      if (opts.waitingOnly && st.id !== 'Waiting for Confirmation' && st.id !== 'Sent to Vendor') return;
      html += '<option value="' + escAttr(st.id) + '"' + (current === st.id ? ' selected' : '') + '>' + esc(st.label) + '</option>';
    });
    if (current && !CCH_PO_PROCUREMENT_STATUSES.some(function(s) { return s.id === current; })) {
      html += '<option value="' + escAttr(current) + '" selected>' + esc(current) + '</option>';
    }
    return html;
  }

  /**
   * Per vendor-invoice order status (not delivery-only).
   * CC-on-ship workflow: Confirmed → Est. ship → Shipped (charged) → In transit → Delivered.
   * Freight may arrive on a separate invoice — use bill charges for est vs actual freight.
   */
  var CCH_PO_VENDOR_INV_ORDER_STATUSES = [
    { id: 'Confirmed', label: 'Confirmed' },
    { id: 'Back ordered', label: 'Back ordered' },
    { id: 'Est. ship scheduled', label: 'Est. ship scheduled' },
    { id: 'Shipped', label: 'Shipped (CC charged)' },
    { id: 'In transit', label: 'In transit' },
    { id: 'Delivered', label: 'Delivered' },
    { id: 'At Receiver', label: 'At receiver' },
    { id: 'At Workroom', label: 'At workroom' },
    { id: 'On Hold', label: 'On hold' },
    { id: 'Cancelled', label: 'Cancelled' }
  ];

  /** @deprecated alias — use CCH_PO_VENDOR_INV_ORDER_STATUSES */
  var CCH_PO_VENDOR_INV_DELIVERY_STATUSES = CCH_PO_VENDOR_INV_ORDER_STATUSES;

  var CCH_PO_VIG_DOCUMENT_TYPES = [
    { id: 'confirmation', label: 'Order confirmation / sales order' },
    { id: 'ship_invoice', label: 'Ship invoice (CC charged)' }
  ];

  function cchPoVendorInvDocumentTypeLabel(t) {
    t = String(t || '').trim() || 'ship_invoice';
    var hit = CCH_PO_VIG_DOCUMENT_TYPES.find(function(d) { return d.id === t; });
    return hit ? hit.label : t;
  }

  window.cchPoVendorInvDocumentTypeBadgeHtml = function(documentType) {
    documentType = String(documentType || '').trim() || 'ship_invoice';
    if (documentType === 'confirmation') {
      return '<span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:3px;background:rgba(2,136,209,0.12);color:#0277BD;white-space:nowrap;margin-left:6px;">Confirmation</span>';
    }
    return '<span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:3px;background:rgba(180,83,9,0.12);color:#92400E;white-space:nowrap;margin-left:6px;">Ship invoice</span>';
  };

  /** Primary reference on list/panel — SO# for confirmation, vendor inv # for ship invoice. */
  window.cchPoVendorInvRefLabel = function(g) {
    g = g || {};
    var docType = String(g.documentType || '').trim() || 'ship_invoice';
    if (docType === 'confirmation') {
      var so = String(g.salesOrderNumber || '').trim();
      if (so) return so;
    }
    return String(g.vendorInvoiceNumber || '').trim() || '—';
  };

  function cchPoVendorInvDocumentTypeOptionsHtml(current) {
    current = String(current || '').trim() || 'ship_invoice';
    return CCH_PO_VIG_DOCUMENT_TYPES.map(function(d) {
      return '<option value="' + escAttr(d.id) + '"' + (current === d.id ? ' selected' : '') + '>' + esc(d.label) + '</option>';
    }).join('');
  }

  function cchPoVendorInvOrderStatusOptionsHtml(current) {
    current = String(current || '').trim();
    var html = '<option value="">— Not set —</option>';
    html += CCH_PO_VENDOR_INV_ORDER_STATUSES.map(function(st) {
      return '<option value="' + escAttr(st.id) + '"' + (current === st.id ? ' selected' : '') + '>' + esc(st.label) + '</option>';
    }).join('');
    if (current && !CCH_PO_VENDOR_INV_ORDER_STATUSES.some(function(st) { return st.id === current; })) {
      html += '<option value="' + escAttr(current) + '" selected>' + esc(current) + '</option>';
    }
    return html;
  }

  function cchPoMiniDateLine(label, iso) {
    iso = String(iso || '').trim();
    if (!iso) return '';
    return '<div style="font-size:10px;line-height:1.4;white-space:nowrap;"><span style="color:#9CA3AF;font-weight:700;text-transform:uppercase;font-size:9px;letter-spacing:0.04em;">' +
      esc(label) + '</span> <span style="color:#1B3352;font-weight:600;">' + esc(cchPoFormatEtaDate(iso)) + '</span></div>';
  }

  window.cchPoVendorInvOrderTimelineHtml = function(g) {
    g = g || {};
    var parts = [];
    if (g.confirmedDate) parts.push(cchPoMiniDateLine('Confirmed', g.confirmedDate));
    if (g.estimatedShipDate) parts.push(cchPoMiniDateLine('Est ship', g.estimatedShipDate));
    if (g.actualShipDate) parts.push(cchPoMiniDateLine('Shipped', g.actualShipDate));
    if (g.etaDate) parts.push(cchPoMiniDateLine('ETA', g.etaDate));
    var estF = parseFloat(g.estimatedFreight);
    var actF = parseFloat(g.actualFreight);
    if (!isNaN(estF) && estF > 0.005) {
      parts.push('<div style="font-size:10px;line-height:1.4;"><span style="color:#9CA3AF;font-weight:700;text-transform:uppercase;font-size:9px;">Est freight</span> <span style="font-family:var(--font-mono);color:#5C6B80;">' + fmt(estF) + '</span></div>');
    }
    if (!isNaN(actF) && actF > 0.005) {
      parts.push('<div style="font-size:10px;line-height:1.4;"><span style="color:#9CA3AF;font-weight:700;text-transform:uppercase;font-size:9px;">Actual freight</span> <span style="font-family:var(--font-mono);color:#1B3352;font-weight:600;">' + fmt(actF) + '</span></div>');
    }
    if (!parts.length) return '<span style="color:#9CA3AF;font-size:11px;">—</span>';
    return parts.join('');
  };

  window.cchPoResolveLineId = function(item, index) {
    if (item && (item.lineId || item.id)) return String(item.lineId || item.id);
    return 'po_line_' + (index != null ? index : 0);
  };

  function cchPoPoLineMetaList(poItems) {
    var out = [];
    (poItems || []).forEach(function(it, i) {
      if (typeof window.isProposalGroupHeaderItem === 'function' && window.isProposalGroupHeaderItem(it)) return;
      out.push({
        lineId: window.cchPoResolveLineId(it, i),
        title: String(it.title || it.name || 'Item').trim(),
        qty: parseFloat(it.qty) || 1,
        cost: parseFloat(it.cost) || 0,
        amount: Math.round(cchPoLineItemAmount(it) * 100) / 100
      });
    });
    return out;
  }

  function cchPoAttachmentMatchLine(attName, lineTitle) {
    attName = String(attName || '').toLowerCase();
    lineTitle = String(lineTitle || '').toLowerCase();
    if (!attName || !lineTitle) return 0;
    var words = lineTitle.split(/[\s\-\/,\(\)]+/).filter(function(w) { return w.length > 4; });
    var score = 0;
    words.forEach(function(w) {
      if (attName.indexOf(w) >= 0) score += w.length;
    });
    if (attName.indexOf('riser') >= 0 && lineTitle.indexOf('riser') >= 0) score += 20;
    if (attName.indexOf('bread') >= 0 && lineTitle.indexOf('cutting') >= 0) score += 20;
    if (attName.indexOf('bread') >= 0 && lineTitle.indexOf('board') >= 0) score += 15;
    return score;
  }

  function cchPoInferVendorInvoiceGroups(doc, poItems) {
    doc = doc || {};
    var bill = doc.bill || {};
    var lines = cchPoPoLineMetaList(poItems || doc.items || []);
    if (!lines.length) return [];
    var invNum = String(bill.vendorInvoiceNumber || '').trim();
    var invDate = String(bill.vendorInvoiceDate || '').trim();
    if (!invNum && Array.isArray(bill.vendorInvoices)) {
      bill.vendorInvoices.some(function(r) {
        var n = String(r.vendorInvoiceNumber || '').trim();
        if (n) { invNum = n; invDate = invDate || String(r.vendorInvoiceDate || '').trim(); return true; }
        return false;
      });
    }
    var billedIds = cchPoBillBilledLineIds(bill, lines);
    if (!billedIds.length) billedIds = lines.map(function(l) { return l.lineId; });
    var atts = bill.attachments || [];
    var poStatus = String(doc.status || '').trim();
    var groups = [];
    if (billedIds.length <= 1) {
      var ln0 = lines.find(function(l) { return l.lineId === billedIds[0]; }) || lines[0];
      groups.push({
        id: 'vig_inferred_0',
        vendorInvoiceNumber: invNum,
        vendorInvoiceDate: invDate,
        poLineIds: billedIds.slice(),
        status: poStatus,
        trackingNumber: '',
        trackingCarrier: '',
        etaDate: '',
        notes: '',
        attachmentName: atts[0] ? String(atts[0].name || '') : '',
        label: ln0 ? ln0.title.slice(0, 48) : ''
      });
      return groups;
    }
    billedIds.forEach(function(lid, idx) {
      var ln = lines.find(function(l) { return l.lineId === lid; });
      var bestAtt = '';
      var bestScore = 0;
      atts.forEach(function(a) {
        var sc = cchPoAttachmentMatchLine(a.name, ln && ln.title);
        if (sc > bestScore) { bestScore = sc; bestAtt = String(a.name || ''); }
      });
      if (!bestAtt && atts[idx]) bestAtt = String(atts[idx].name || '');
      var etsyMatch = bestAtt.match(/#\s*(\d{6,})/);
      var groupInv = invNum;
      if (etsyMatch && billedIds.length > 1) {
        groupInv = invNum ? (invNum + ' · Etsy #' + etsyMatch[1]) : ('Etsy #' + etsyMatch[1]);
      }
      groups.push({
        id: 'vig_inferred_' + idx,
        vendorInvoiceNumber: groupInv || ('Invoice ' + (idx + 1)),
        vendorInvoiceDate: invDate,
        poLineIds: [lid],
        status: poStatus,
        trackingNumber: '',
        trackingCarrier: '',
        etaDate: '',
        notes: '',
        attachmentName: bestAtt,
        label: ln ? ln.title.slice(0, 48) : ('Line ' + (idx + 1))
      });
    });
    return groups;
  }

  window.cchPoVendorInvoiceGroups = function(doc, poItems) {
    doc = doc || {};
    if (Array.isArray(doc.vendorInvoiceGroups) && doc.vendorInvoiceGroups.length) {
      return doc.vendorInvoiceGroups.map(function(g, i) {
        return {
          id: g.id || ('vig_' + i),
          vendorInvoiceNumber: String(g.vendorInvoiceNumber || '').trim(),
          vendorInvoiceDate: String(g.vendorInvoiceDate || '').trim(),
          poLineIds: Array.isArray(g.poLineIds) ? g.poLineIds.slice() : [],
          status: String(g.status || '').trim(),
          confirmedDate: String(g.confirmedDate || '').trim(),
          estimatedShipDate: String(g.estimatedShipDate || '').trim(),
          actualShipDate: String(g.actualShipDate || '').trim(),
          documentType: String(g.documentType || '').trim() || 'ship_invoice',
          salesOrderNumber: String(g.salesOrderNumber || '').trim(),
          estimatedFreight: g.estimatedFreight != null && g.estimatedFreight !== '' ? Math.round((parseFloat(g.estimatedFreight) || 0) * 100) / 100 : '',
          actualFreight: g.actualFreight != null && g.actualFreight !== '' ? Math.round((parseFloat(g.actualFreight) || 0) * 100) / 100 : '',
          trackingNumber: String(g.trackingNumber || '').trim(),
          trackingCarrier: String(g.trackingCarrier || '').trim(),
          etaDate: String(g.etaDate || '').trim(),
          notes: String(g.notes || '').trim(),
          attachmentName: String(g.attachmentName || '').trim(),
          label: String(g.label || '').trim()
        };
      });
    }
    return cchPoInferVendorInvoiceGroups(doc, poItems);
  };

  window.cchPoVendorInvoiceGroupsPersisted = function(doc) {
    return !!(doc && Array.isArray(doc.vendorInvoiceGroups) && doc.vendorInvoiceGroups.length);
  };

  /** Auto-inferred placeholder rows (Invoice 1, Invoice 2…) — not user-created. */
  function cchPoVendorInvoiceGroupIsPlaceholder(g) {
    if (!g) return true;
    var id = String(g.id || '');
    if (/^vig_inferred_/i.test(id)) return true;
    var num = String(g.vendorInvoiceNumber || '').trim();
    if (/^Invoice\s*\d+$/i.test(num)) return true;
    return false;
  }

  function cchPoNormalizeVendorInvoiceGroup(g, i) {
    return {
      id: g.id || ('vig_' + i),
      vendorInvoiceNumber: String(g.vendorInvoiceNumber || '').trim(),
      vendorInvoiceDate: String(g.vendorInvoiceDate || '').trim(),
      poLineIds: Array.isArray(g.poLineIds) ? g.poLineIds.slice() : [],
      status: String(g.status || '').trim(),
      confirmedDate: String(g.confirmedDate || '').trim(),
      estimatedShipDate: String(g.estimatedShipDate || '').trim(),
      actualShipDate: String(g.actualShipDate || '').trim(),
      documentType: String(g.documentType || '').trim() || 'ship_invoice',
      salesOrderNumber: String(g.salesOrderNumber || '').trim(),
      estimatedFreight: g.estimatedFreight != null && g.estimatedFreight !== '' ? Math.round((parseFloat(g.estimatedFreight) || 0) * 100) / 100 : '',
      actualFreight: g.actualFreight != null && g.actualFreight !== '' ? Math.round((parseFloat(g.actualFreight) || 0) * 100) / 100 : '',
      trackingNumber: String(g.trackingNumber || '').trim(),
      trackingCarrier: String(g.trackingCarrier || '').trim(),
      etaDate: String(g.etaDate || '').trim(),
      notes: String(g.notes || '').trim(),
      attachmentName: String(g.attachmentName || '').trim(),
      label: String(g.label || '').trim()
    };
  }

  /** User-saved vendor invoices only — never inferred Invoice 1/2/3 placeholders. */
  window.cchPoVendorInvoiceGroupsUser = function(doc) {
    if (!doc || !Array.isArray(doc.vendorInvoiceGroups)) return [];
    return doc.vendorInvoiceGroups.map(cchPoNormalizeVendorInvoiceGroup).filter(function(g) {
      return !cchPoVendorInvoiceGroupIsPlaceholder(g);
    });
  };

  var CCH_PO_VIG_FROM_BILL_ID = 'vig_from_bill_primary';

  function cchPoDistinctBillInvoiceNumbers(bill) {
    bill = bill || {};
    var nums = [];
    var primary = String(bill.vendorInvoiceNumber || '').trim();
    if (primary) nums.push(primary);
    (bill.vendorInvoices || []).forEach(function(r) {
      var n = String(r.vendorInvoiceNumber || '').trim();
      if (n) nums.push(n);
    });
    return nums.filter(function(n, i, a) { return n && a.indexOf(n) === i; });
  }

  function cchPoPoLineIdsForBillInvoice(doc, poItems, invNum, userGroups) {
    var bill = doc.bill || {};
    var allLines = cchPoPoLineMetaList(poItems || doc.items || []);
    var billedIds = cchPoBillBilledLineIds(bill, allLines);
    userGroups = userGroups || window.cchPoVendorInvoiceGroupsUser(doc);
    var assignedElsewhere = {};
    userGroups.forEach(function(g) {
      if (String(g.vendorInvoiceNumber || '').trim() === String(invNum || '').trim()) return;
      (g.poLineIds || []).forEach(function(id) { assignedElsewhere[id] = true; });
    });
    var open = billedIds.filter(function(id) { return !assignedElsewhere[id]; });
    return open.length ? open : billedIds.slice();
  }

  function cchPoBillPrimaryVendorGroup(doc, poItems, invNum) {
    var bill = doc.bill || {};
    invNum = String(invNum || bill.vendorInvoiceNumber || '').trim();
    if (!invNum) return null;
    return {
      id: CCH_PO_VIG_FROM_BILL_ID,
      vendorInvoiceNumber: invNum,
      vendorInvoiceDate: String(bill.vendorInvoiceDate || '').trim(),
      poLineIds: cchPoPoLineIdsForBillInvoice(doc, poItems, invNum, window.cchPoVendorInvoiceGroupsUser(doc)),
      status: '',
      trackingNumber: String(bill.trackingNumber || '').trim(),
      trackingCarrier: String(bill.trackingCarrier || '').trim(),
      etaDate: String(bill.etaDate || '').trim(),
      notes: String(bill.shipmentNotes || '').trim(),
      attachmentName: '',
      label: '',
      _fromBill: true
    };
  }

  /** All vendor invoices in one list — saved groups + bill-received invoice #s not yet in groups. */
  window.cchPoVendorInvoiceGroupsDisplay = function(doc, poItems) {
    doc = doc || {};
    poItems = poItems || doc.items || [];
    var groups = window.cchPoVendorInvoiceGroupsUser(doc).slice();
    var bill = doc.bill || {};
    if (!bill.received) return groups;
    var onGroups = {};
    groups.forEach(function(g) {
      var n = String(g.vendorInvoiceNumber || '').trim();
      if (n) onGroups[cchPoNormVendorInvNum(n)] = true;
    });
    cchPoDistinctBillInvoiceNumbers(bill).forEach(function(num) {
      if (onGroups[cchPoNormVendorInvNum(num)]) return;
      var row = cchPoBillPrimaryVendorGroup(doc, poItems, num);
      if (row) groups.unshift(row);
    });
    return cchPoDedupeVendorInvoiceGroups(groups);
  };

  /** After bill receive — persist bill invoice # into vendorInvoiceGroups when missing. */
  function cchPoEnsureBillInvoicesInGroups(doc, bill, poItems) {
    doc = doc || {};
    bill = bill || doc.bill || {};
    poItems = poItems || doc.items || [];
    var groups = (doc.vendorInvoiceGroups || []).map(cchPoNormalizeVendorInvoiceGroup).filter(function(g) {
      return !cchPoVendorInvoiceGroupIsPlaceholder(g);
    });
    var onGroups = {};
    groups.forEach(function(g) {
      var n = String(g.vendorInvoiceNumber || '').trim();
      if (n) onGroups[cchPoNormVendorInvNum(n)] = true;
    });
    cchPoDistinctBillInvoiceNumbers(bill).forEach(function(num) {
      if (onGroups[cchPoNormVendorInvNum(num)]) return;
      var row = cchPoBillPrimaryVendorGroup(Object.assign({}, doc, { bill: bill, vendorInvoiceGroups: groups }), poItems, num);
      if (!row) return;
      groups.push(cchPoNormalizeVendorInvoiceGroup(Object.assign({}, row, {
        id: 'vig_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
      })));
      onGroups[cchPoNormVendorInvNum(num)] = true;
    });
    return cchPoDedupeVendorInvoiceGroups(groups);
  }

  function cchPoChargesForVendorInvoice(bill, invNum, poLineIds) {
    bill = bill || {};
    invNum = String(invNum || '').trim();
    poLineIds = poLineIds || [];
    return cchPoBillVendorInvoicesFromBill(bill).filter(function(r) {
      if (cchPoVendorInvoiceSource(r.type) === 'merchandise') return false;
      if (Math.abs(parseFloat(r.amount) || 0) < 0.01) return false;
      var n = String(r.vendorInvoiceNumber || '').trim();
      if (invNum && n && cchPoNormVendorInvNum(n) === cchPoNormVendorInvNum(invNum)) return true;
      if (!invNum) return false;
      if (n) return false;
      if (!poLineIds.length || !r.poLineIds || !r.poLineIds.length) return false;
      return r.poLineIds.some(function(id) { return poLineIds.indexOf(id) >= 0; });
    });
  }

  function cchPoCanPushBillToQb() {
    return typeof window.userCanPushToQB === 'function' && window.userCanPushToQB()
      && typeof window.cchPoQbBillPushAllowed === 'function' && window.cchPoQbBillPushAllowed();
  }

  /** Pay bill — always available once vendor bill is received. */
  function cchPoPayBillBtnHtml(projectId, poId, opts) {
    opts = opts || {};
    var label = opts.label || 'Pay bill';
    var extraStyle = opts.style || '';
    var cls = opts.compact ? 'btn btn-secondary btn-sm' : 'btn btn-secondary btn-sm';
    if (opts.primary) cls = 'btn btn-primary btn-sm';
    return '<button type="button" class="' + cls + '" style="' + extraStyle + '" onclick="cchPoOpenPaymentModal(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\')">' + esc(label) + '</button>';
  }

  window.cchPoPayBillBtnHtml = cchPoPayBillBtnHtml;

  /** Readable PO / shipping status badge (avoids low-contrast light-blue sent badge on cream panels). */
  window.cchPoStatusBadgeHtml = function(status) {
    status = String(status || '').trim();
    if (!status) return '<span style="font-size:10px;color:#9CA3AF;">—</span>';
    var s = status.toLowerCase();
    var bg = 'rgba(27,51,82,0.1)';
    var color = '#1B3352';
    var border = '1px solid rgba(27,51,82,0.16)';
    if (s === 'paid') { bg = 'rgba(46,125,50,0.12)'; color = '#1B5E20'; border = '1px solid rgba(46,125,50,0.2)'; }
    else if (s === 'back ordered' || s === 'backordered') { bg = 'rgba(107,114,128,0.14)'; color = '#374151'; border = '1px solid rgba(107,114,128,0.22)'; }
    else if (s === 'confirmed' || s === 'est. ship scheduled') { bg = 'rgba(2,136,209,0.12)'; color = '#0277BD'; border = '1px solid rgba(2,136,209,0.2)'; }
    else if (s === 'shipped' || s === 'ordered' || s === 'in transit') { bg = 'rgba(180,83,9,0.12)'; color = '#92400E'; border = '1px solid rgba(180,83,9,0.2)'; }
    else if (s === 'received' || s === 'delivered' || s === 'installed') { bg = 'rgba(46,125,50,0.12)'; color = '#1B5E20'; border = '1px solid rgba(46,125,50,0.2)'; }
    else if (s === 'cancelled' || s === 'on hold') { bg = 'rgba(107,114,128,0.12)'; color = '#374151'; border = '1px solid rgba(107,114,128,0.2)'; }
    return '<span class="badge" style="font-size:10px;font-weight:700;padding:3px 8px;background:' + bg + ';color:' + color + ';border:' + border + ';">' + esc(status) + '</span>';
  };

  /** Receive / edit bill modal footer — Save (Studio only) + Push to QuickBooks (separate). */
  function cchPoReceiveBillModalActionButtons(projectId, poId, poAtSend, canQb) {
    var pj = escJs(projectId);
    var pid = escJs(poId);
    var saveBtn = '<button type="button" class="btn btn-primary" onclick="cchPoSaveReceiveBill(\'' + pj + '\',\'' + pid + '\',' + poAtSend + ',false)">Save</button>';
    var pushBtn = canQb
      ? '<button type="button" class="btn btn-secondary" style="background:#1B3352;color:#EDE8E0;border-color:#1B3352;" onclick="cchPoSaveReceiveBill(\'' + pj + '\',\'' + pid + '\',' + poAtSend + ',true)">Push to QuickBooks</button>'
      : '';
    return saveBtn + pushBtn;
  }

  /** Vendor invoice modal footer — Save + Push to QuickBooks (separate). */
  function cchPoVigModalActionButtons(projectId, poId, canQb) {
    var pj = escJs(projectId);
    var pid = escJs(poId);
    var saveBtn = '<button type="button" class="btn btn-primary" onclick="cchPoSaveVendorInvoiceGroup(\'' + pj + '\',\'' + pid + '\',false)">Save</button>';
    var pushBtn = canQb
      ? '<button type="button" class="btn btn-secondary" style="background:#1B3352;color:#EDE8E0;border-color:#1B3352;" onclick="cchPoSaveVendorInvoiceGroup(\'' + pj + '\',\'' + pid + '\',true)">Push to QuickBooks</button>'
      : '';
    return saveBtn + pushBtn;
  }

  function cchPoReadVigPoLineIdsFromDom() {
    var ids = [];
    document.querySelectorAll('.cch-vig-line-cb:checked').forEach(function(cb) {
      if (cb.value) ids.push(cb.value);
    });
    return ids;
  }

  /** Live totals + variance in Edit vendor invoice modal (matches Receive bill preview). */
  window.cchPoUpdateVigBillPreview = function() {
    var el = document.getElementById('cchVigBillPreview');
    if (!el) return;
    var poAtSend = window.__cchVigPoAtSend != null ? window.__cchVigPoAtSend : 0;
    var poLines = window.__cchVigPoLines || [];
    var doc = window.__cchVigDocSnapshot || {};
    var bill = doc.bill || {};
    var oldInvNum = String(window.__cchVigOldInvNum || '').trim();
    var invNum = String(document.getElementById('cchVigInvNum') && document.getElementById('cchVigInvNum').value || '').trim() || oldInvNum;
    var invDate = String(document.getElementById('cchVigInvDate') && document.getElementById('cchVigInvDate').value || '').trim();
    var selectedIds = cchPoReadVigPoLineIdsFromDom();
    var chargeRows = cchPoReadVigChargeRowsFromDom();
    var thisMerch = cchPoSumPoLineAmounts(poLines, selectedIds);
    var thisCharges = chargeRows.reduce(function(s, r) { return s + (parseFloat(r.amount) || 0); }, 0);
    var thisInvTotal = Math.round((thisMerch + thisCharges) * 100) / 100;
    var merged = bill.received
      ? cchPoMergeVigChargesIntoBill(bill, doc, oldInvNum, invNum, invDate, selectedIds, chargeRows)
      : { bill: bill, varianceAmt: thisInvTotal - poAtSend };
    var billTotal = merged.bill.billTotal != null ? merged.bill.billTotal : thisInvTotal;
    var variance = billTotal - poAtSend;
    function row(label, amt) {
      if (Math.abs(amt) < 0.01) return '';
      return '<tr><td style="padding:4px 0;color:#5C6B80;">' + (amt >= 0 ? '+ ' : '− ') + esc(label) + '</td>' +
        '<td style="text-align:right;color:' + (amt < 0 ? '#15803D' : '#B45309') + ';font-weight:600;">' + cchPoFormatBillLineAmount(amt) + '</td></tr>';
    }
    var merchRows = selectedIds.map(function(id) {
      for (var i = 0; i < poLines.length; i++) {
        if (poLines[i].lineId === id) {
          return row(poLines[i].title || 'Item', parseFloat(poLines[i].amount) || 0);
        }
      }
      return '';
    }).join('');
    var chargeDetail = chargeRows.map(function(r) {
      return row(r.description || cchPoVendorInvoiceTypeLabel(r.type), parseFloat(r.amount) || 0);
    }).join('');
    var invHdr = invNum
      ? '<tr><td colspan="2" style="padding:4px 0 8px;font-size:11px;color:#5C6B80;">This vendor invoice <strong>#' + esc(invNum) + '</strong></td></tr>'
      : '';
    el.innerHTML =
      '<table style="width:100%;font-size:12px;border-collapse:collapse;">' +
      (merchRows || '<tr><td style="padding:4px 0;color:#9CA3AF;font-style:italic;">No PO items selected</td><td></td></tr>') +
      '<tr style="border-top:1px solid rgba(15,26,46,0.08);"><td style="padding:6px 0;font-weight:600;">Merchandise on this invoice</td><td style="text-align:right;font-weight:600;">' + fmt(thisMerch) + '</td></tr>' +
      invHdr + chargeDetail +
      (Math.abs(thisCharges) > 0.01 ? '<tr><td style="padding:4px 0;color:#5C6B80;">Charges on this invoice</td><td style="text-align:right;font-weight:600;color:#B45309;">' + cchPoFormatBillLineAmount(thisCharges) + '</td></tr>' : '') +
      '<tr style="border-top:1px solid rgba(15,26,46,0.1);"><td style="padding:6px 0;font-weight:600;">This invoice subtotal</td><td style="text-align:right;font-weight:700;">' + fmt(thisInvTotal) + '</td></tr>' +
      (bill.received ? '<tr style="border-top:1px solid rgba(15,26,46,0.12);"><td style="padding:8px 0;font-weight:700;">= Combined vendor bill total</td><td style="text-align:right;font-weight:700;">' + fmt(billTotal) + '</td></tr>' : '') +
      '<tr><td style="padding:4px 0;font-size:11px;color:#5C6B80;">Variance vs PO at send (' + fmt(poAtSend) + ')</td><td style="text-align:right;font-size:11px;font-weight:600;color:' + (Math.abs(variance) > 0.01 ? '#B45309' : '#15803D') + ';">' + fmt(variance) + '</td></tr>' +
      '</table>';
  };

  function cchPoVigChargeRowHtml(row) {
    row = row || {};
    var type = row.type || 'freight';
    var opts = CCH_VENDOR_INVOICE_TYPES.filter(function(t) { return t.id !== 'merchandise'; }).map(function(t) {
      return '<option value="' + escAttr(t.id) + '"' + (type === t.id ? ' selected' : '') + '>' + esc(t.label) + '</option>';
    }).join('');
    var amtVal = row.amount != null && row.amount !== '' ? String(row.amount) : '';
    return '<div class="cch-vig-charge-row" style="border:1px solid rgba(15,26,46,0.1);border-radius:4px;padding:10px;margin-bottom:8px;background:#fff;">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
        '<div><label class="form-label">Type</label><select class="form-input cch-vig-charge-type" onchange="cchPoVigChargeTypeChanged(this)">' + opts + '</select></div>' +
        '<div><label class="form-label">Amount</label><input type="number" step="0.01" class="form-input cch-vig-charge-amt" value="' + escAttr(amtVal) + '" oninput="cchPoUpdateVigBillPreview()"></div>' +
        '<div style="grid-column:1/-1;"><label class="form-label">Description</label><input type="text" class="form-input cch-vig-charge-desc" placeholder="FedEx freight, prepaid tax…" value="' + escAttr(row.description || '') + '"></div>' +
        cchPoPriceChangeBlockHtml(row, 'cch-vig') +
      '</div>' +
      '<button type="button" class="btn btn-sm" style="margin-top:6px;color:#B91C1C;border-color:rgba(185,28,28,0.35);" onclick="cchPoRemoveVigChargeRow(this)">Remove</button>' +
    '</div>';
  }

  function cchPoReadVigChargeRowsFromDom() {
    var out = [];
    var vigPoLineIds = cchPoReadVigPoLineIdsFromDom();
    document.querySelectorAll('.cch-vig-charge-row').forEach(function(row, i) {
      var type = String(row.querySelector('.cch-vig-charge-type') && row.querySelector('.cch-vig-charge-type').value || 'extra').trim();
      var invUnitRaw = row.querySelector('.cch-vig-inv-unit') ? String(row.querySelector('.cch-vig-inv-unit').value || '').trim() : '';
      var amt = parseFloat(row.querySelector('.cch-vig-charge-amt') && row.querySelector('.cch-vig-charge-amt').value) || 0;
      var poUnitPrice = null;
      var qty = null;
      if (cchPoVendorInvoiceSource(type) === 'price_change' && invUnitRaw) {
        var calc = cchPoCalcPriceChangeAmount(window.__cchVigPoLines || [], vigPoLineIds, invUnitRaw);
        if (calc) {
          amt = calc.amount;
          poUnitPrice = calc.poUnitPrice;
          qty = calc.qty;
        }
      }
      if (Math.abs(amt) < 0.01) return;
      var rowOut = {
        id: 'vi_' + Date.now() + '_' + i,
        type: type,
        description: String(row.querySelector('.cch-vig-charge-desc') && row.querySelector('.cch-vig-charge-desc').value || '').trim(),
        amount: amt
      };
      if (cchPoVendorInvoiceSource(type) === 'price_change' && invUnitRaw) {
        rowOut.invoiceUnitPrice = parseFloat(invUnitRaw);
        if (poUnitPrice != null) rowOut.poUnitPrice = poUnitPrice;
        if (qty != null) rowOut.qty = qty;
      }
      out.push(rowOut);
    });
    return out;
  }

  window.cchPoAddVigChargeRow = function() {
    var list = document.getElementById('cchVigChargesList');
    if (!list) return;
    list.insertAdjacentHTML('beforeend', cchPoVigChargeRowHtml({ type: 'freight' }));
    window.cchPoUpdateVigBillPreview();
  };

  window.cchPoRemoveVigChargeRow = function(btn) {
    var row = btn && btn.closest('.cch-vig-charge-row');
    if (row) row.remove();
    window.cchPoUpdateVigBillPreview();
  };

  function cchPoMergeVigChargesIntoBill(bill, doc, oldInvNum, invNum, invDate, poLineIds, newChargeRows) {
    bill = Object.assign({}, bill || {});
    doc = doc || {};
    oldInvNum = String(oldInvNum || '').trim();
    invNum = String(invNum || '').trim();
    var allVi = cchPoBillVendorInvoicesFromBill(bill);
    var kept = allVi.filter(function(r) {
      if (cchPoVendorInvoiceSource(r.type) === 'merchandise') return true;
      var n = String(r.vendorInvoiceNumber || '').trim();
      if (oldInvNum && cchPoNormVendorInvNum(n) === cchPoNormVendorInvNum(oldInvNum)) return false;
      if (!oldInvNum && invNum && cchPoNormVendorInvNum(n) === cchPoNormVendorInvNum(invNum)) return false;
      return true;
    });
    newChargeRows.forEach(function(r, i) {
      var charge = {
        id: r.id || ('vi_' + Date.now() + '_' + i),
        vendorInvoiceNumber: invNum,
        vendorInvoiceDate: invDate,
        type: r.type,
        description: r.description || '',
        amount: parseFloat(r.amount) || 0,
        poLineIds: poLineIds.slice()
      };
      if (r.invoiceUnitPrice != null && r.invoiceUnitPrice !== '') charge.invoiceUnitPrice = parseFloat(r.invoiceUnitPrice);
      if (r.poUnitPrice != null && r.poUnitPrice !== '') charge.poUnitPrice = parseFloat(r.poUnitPrice);
      if (r.qty != null && r.qty !== '') charge.qty = parseFloat(r.qty);
      kept.push(charge);
    });
    bill.vendorInvoices = kept;
    var poAtSend = bill.poTotalAtSend != null ? bill.poTotalAtSend : window.cchPoDocTotal(doc);
    var allPoLines = bill.poLines || cchPoPoLineMetaList(doc.items || []);
    var billedIds = cchPoBillBilledLineIds(bill, allPoLines);
    var poSubtotal = cchPoSumPoLineAmounts(allPoLines, billedIds);
    var additionalSubtotal = kept.reduce(function(s, r) {
      if (cchPoVendorInvoiceSource(r.type) === 'merchandise') return s;
      return s + (parseFloat(r.amount) || 0);
    }, 0);
    additionalSubtotal = Math.round(additionalSubtotal * 100) / 100;
    var legacy = cchPoLegacyAggregatesFromVendorInvoices(kept);
    var chargeItems = cchPoChargeItemsFromVendorInvoices(kept, allPoLines);
    var billedPoLines = allPoLines.filter(function(l) { return billedIds.indexOf(l.lineId) >= 0; });
    bill.poSubtotal = poSubtotal;
    bill.additionalSubtotal = additionalSubtotal;
    bill.billTotal = Math.round((poSubtotal + additionalSubtotal) * 100) / 100;
    bill.freight = legacy.freight;
    bill.tax = legacy.tax;
    bill.priceChange = legacy.priceChange;
    bill.extras = legacy.extras;
    bill.items = billedPoLines.concat(chargeItems);
    bill.studioUpdatedAt = new Date().toISOString();
    if (invNum && !bill.vendorInvoiceNumber) bill.vendorInvoiceNumber = invNum;
    if (invDate && !bill.vendorInvoiceDate) bill.vendorInvoiceDate = invDate;
    var varianceAmt = bill.billTotal - poAtSend;
    return { bill: bill, varianceAmt: varianceAmt };
  }

  function cchPoNormVendorInvNum(n) {
    return String(n || '').trim().replace(/\s+/g, '').toUpperCase();
  }

  /** One row per vendor invoice # — prefer saved tracking rows over synthetic "On bill" rows. */
  function cchPoDedupeVendorInvoiceGroups(groups) {
    var byKey = {};
    (groups || []).forEach(function(g) {
      var num = String(g.vendorInvoiceNumber || '').trim();
      var key = num ? cchPoNormVendorInvNum(num) : ('id:' + String(g.id || ''));
      var prev = byKey[key];
      if (!prev) { byKey[key] = g; return; }
      if (prev._fromBill && !g._fromBill) { byKey[key] = g; return; }
      if (!prev._fromBill && g._fromBill) return;
      if ((g.poLineIds || []).length > (prev.poLineIds || []).length) byKey[key] = g;
    });
    return Object.keys(byKey).map(function(k) { return byKey[k]; });
  }

  function cchPoVendorInvoiceGroupTotal(bill, invNum, poLineIds, poLines) {
    bill = bill || {};
    poLineIds = poLineIds || [];
    var lines = (bill.poLines && bill.poLines.length) ? bill.poLines : (poLines || []);
    var merch = cchPoSumPoLineAmounts(lines, poLineIds);
    var charges = cchPoChargesForVendorInvoice(bill, invNum, poLineIds);
    var chargeSum = charges.reduce(function(s, r) { return s + (parseFloat(r.amount) || 0); }, 0);
    return Math.round((merch + chargeSum) * 100) / 100;
  }

  function cchPoPaymentMatchesInvoice(payment, invNum) {
    var pInv = cchPoNormVendorInvNum(payment && payment.vendorInvoiceNumber);
    var target = cchPoNormVendorInvNum(invNum);
    if (!target) return !pInv;
    return pInv === target;
  }

  function cchPoVendorInvoicePaidAmount(payments, invNum, excludeIdx) {
    var sum = 0;
    (payments || []).forEach(function(p, i) {
      if (excludeIdx != null && i === excludeIdx) return;
      if (!cchPoPaymentMatchesInvoice(p, invNum)) return;
      sum += parseFloat(p.amount) || 0;
    });
    return Math.round(sum * 100) / 100;
  }

  function cchPoVendorInvoiceBalanceDue(bill, invNum, poLineIds, poLines, payments, excludeIdx) {
    var total = cchPoVendorInvoiceGroupTotal(bill, invNum, poLineIds, poLines);
    var paid = cchPoVendorInvoicePaidAmount(payments, invNum, excludeIdx);
    return Math.max(0, Math.round((total - paid) * 100) / 100);
  }

  function cchPoUnallocatedPaymentTotal(payments) {
    return Math.round((payments || []).reduce(function(s, p) {
      if (cchPoNormVendorInvNum(p && p.vendorInvoiceNumber)) return s;
      return s + (parseFloat(p.amount) || 0);
    }, 0) * 100) / 100;
  }

  function cchPoVendorInvoicePayPickerHtml(groups, selectedInv, allowPaidSelect) {
    groups = groups || [];
    if (!groups.length) return '';
    selectedInv = String(selectedInv || '').trim();
    if (!allowPaidSelect) {
      var selG = groups.find(function(g) {
        return cchPoNormVendorInvNum(g.vendorInvoiceNumber) === cchPoNormVendorInvNum(selectedInv);
      });
      if (!selG || selG.balanceDue <= 0.02) {
        var firstOpen = groups.find(function(g) { return g.balanceDue > 0.02; });
        if (firstOpen) selectedInv = firstOpen.vendorInvoiceNumber;
      }
    }
    var html = '<div style="margin-bottom:14px;">' +
      '<div class="form-label" style="margin-bottom:8px;">Which vendor invoice are you paying?</div>' +
      '<div style="border:1px solid rgba(15,26,46,0.12);border-radius:4px;overflow:hidden;">';
    groups.forEach(function(g, i) {
      var inv = g.vendorInvoiceNumber;
      var sel = cchPoNormVendorInvNum(inv) === cchPoNormVendorInvNum(selectedInv);
      var canPay = g.balanceDue > 0.02 || allowPaidSelect;
      var paidAmt = Math.max(0, Math.round((g.total - g.balanceDue) * 100) / 100);
      var open = g.balanceDue > 0.02;
      var statusColor = open ? '#B45309' : '#1B5E20';
      var borderBot = i < groups.length - 1 ? 'border-bottom:1px solid rgba(15,26,46,0.06);' : '';
      html += '<label style="display:flex;align-items:flex-start;gap:10px;padding:12px 14px;cursor:' + (canPay ? 'pointer' : 'default') + ';' + borderBot +
        'background:' + (sel && canPay ? 'rgba(202,138,4,0.07)' : '#fff') + ';' + (!canPay ? 'opacity:0.7;' : '') + '">' +
        '<input type="radio" name="cchPoPayInvRadio" class="cch-po-pay-inv-radio" value="' + escAttr(inv) + '"' +
          (sel && canPay ? ' checked' : '') + (!canPay ? ' disabled' : '') +
          ' onchange="cchPoPaymentModalInvChanged()" style="accent-color:var(--gold);margin-top:4px;flex-shrink:0;">' +
        '<span style="flex:1;min-width:0;">' +
          '<span style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;">' +
            '<span style="font-size:13px;font-weight:700;color:#1B3352;">#' + esc(inv) + '</span>' +
            '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:3px;background:' + (open ? 'rgba(180,83,9,0.12)' : 'rgba(46,125,50,0.12)') + ';color:' + statusColor + ';">' +
              (open ? 'Open · due ' + fmt(g.balanceDue) : 'Paid') +
            '</span>' +
          '</span>' +
          '<span style="display:block;font-size:11px;color:#5C6B80;margin-top:5px;line-height:1.45;">' +
            'Invoice total <strong style="font-family:var(--font-mono);color:#1B3352;">' + fmt(g.total) + '</strong>' +
            (paidAmt > 0.01 ? ' · Paid <span style="font-family:var(--font-mono);color:#1B5E20;">' + fmt(paidAmt) + '</span>' : '') +
          '</span>' +
        '</span></label>';
    });
    html += '</div>' +
      '<input type="hidden" id="cchPoPayInv" value="' + escAttr(selectedInv) + '">' +
      '<p style="font-size:10px;color:#5C6B80;margin:8px 0 0;line-height:1.45;">Select an <strong>open</strong> invoice (balance due). Paid invoices are grayed out. Each payment applies to one vendor invoice #.</p></div>';
    return html;
  }

  function cchPoReadPayModalInvNum() {
    var checked = document.querySelector('.cch-po-pay-inv-radio:checked');
    if (checked && checked.value) return String(checked.value).trim();
    var sel = document.getElementById('cchPoPayInv');
    return sel ? String(sel.value || '').trim() : '';
  }

  function cchPoGroupChargesCellHtml(bill, invNum, poLineIds, poLines) {
    bill = bill || {};
    poLineIds = poLineIds || [];
    var total = cchPoVendorInvoiceGroupTotal(bill, invNum, poLineIds, poLines);
    if (Math.abs(total) < 0.01) return '<span style="color:#9CA3AF;">—</span>';
    var lines = (bill.poLines && bill.poLines.length) ? bill.poLines : (poLines || []);
    var merch = cchPoSumPoLineAmounts(lines, poLineIds);
    var charges = cchPoChargesForVendorInvoice(bill, invNum, poLineIds);
    var chargeSum = charges.reduce(function(s, r) { return s + (parseFloat(r.amount) || 0); }, 0);
    chargeSum = Math.round(chargeSum * 100) / 100;
    var subParts = [];
    if (Math.abs(merch) > 0.01) subParts.push('Merch ' + fmt(merch));
    if (Math.abs(chargeSum) > 0.01) {
      var labels = charges.map(function(r) {
        return cchPoVendorInvoiceTypeLabel(r.type);
      }).filter(function(v, i, a) { return a.indexOf(v) === i; }).slice(0, 3).join(', ');
      subParts.push(labels ? labels + ' ' + fmt(chargeSum) : fmt(chargeSum));
    }
    return '<span style="font-family:var(--font-mono);font-weight:700;">' + fmt(total) + '</span>' +
      (subParts.length ? '<div style="font-size:10px;color:#5C6B80;margin-top:2px;">' + esc(subParts.join(' · ')) + '</div>' : '');
  }

  window.cchPoVendorInvoiceGroupForLineId = function(doc, lineId, poItems) {
    lineId = String(lineId || '').trim();
    if (!lineId) return null;
    var groups = window.cchPoVendorInvoiceGroupsDisplay(doc, poItems);
    for (var i = 0; i < groups.length; i++) {
      if ((groups[i].poLineIds || []).indexOf(lineId) >= 0) return groups[i];
    }
    return null;
  };

  /** Resolve vendor-invoice tracking fields for an FFE clip linked to a PO line. */
  window.cchPoVendorInvoiceMetaForClip = function(poDoc, clip) {
    poDoc = poDoc || {};
    clip = clip || {};
    var items = poDoc.items || poDoc.poItems || poDoc.lines || [];
    var lineId = null;
    var clipId = String(clip.id || '').trim();
    var clipTitle = String(clip.title || '').trim().toLowerCase();
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (typeof window.isProposalGroupHeaderItem === 'function' && window.isProposalGroupHeaderItem(it)) continue;
      var itClip = String(it.clipId || it.sourceClipId || '').trim();
      if (clipId && itClip && itClip === clipId) {
        lineId = window.cchPoResolveLineId(it, i);
        break;
      }
      var itTitle = String(it.title || it.name || '').trim().toLowerCase();
      if (clipTitle && itTitle && clipTitle === itTitle) {
        lineId = window.cchPoResolveLineId(it, i);
        break;
      }
    }
    var grp = lineId ? window.cchPoVendorInvoiceGroupForLineId(poDoc, lineId, items) : null;
    if (grp) {
      return {
        vendorInvoiceNumber: grp.vendorInvoiceNumber || '',
        vendorInvoiceDate: grp.vendorInvoiceDate || '',
        deliveryStatus: grp.status || '',
        orderStatus: grp.status || '',
        confirmedDate: grp.confirmedDate || '',
        estimatedShipDate: grp.estimatedShipDate || '',
        actualShipDate: grp.actualShipDate || '',
        trackingNumber: grp.trackingNumber || '',
        trackingCarrier: grp.trackingCarrier || '',
        etaDate: grp.etaDate || '',
        shipmentNotes: grp.notes || ''
      };
    }
    var bill = poDoc.bill || {};
    if (bill.received || bill.billTotal != null) {
      return {
        vendorInvoiceNumber: String(bill.vendorInvoiceNumber || '').trim(),
        vendorInvoiceDate: String(bill.vendorInvoiceDate || '').trim(),
        deliveryStatus: '',
        trackingNumber: String(bill.trackingNumber || '').trim(),
        trackingCarrier: String(bill.trackingCarrier || '').trim(),
        etaDate: String(bill.etaDate || '').trim(),
        shipmentNotes: String(bill.shipmentNotes || '').trim()
      };
    }
    return null;
  };

  window.cchPoVendorInvoiceGroupStatusBadgeHtml = function(status) {
    status = String(status || '').trim();
    if (!status) return '<span style="font-size:11px;color:#9CA3AF;">—</span>';
    if (typeof window.cchPoStatusBadgeHtml === 'function') return window.cchPoStatusBadgeHtml(status);
    return typeof window.statusBadge === 'function'
      ? window.statusBadge(status)
      : ('<span class="badge badge-draft" style="font-size:10px;">' + esc(status) + '</span>');
  };

  /** Green Paid / amber Due badge for vendor invoice payment state. */
  window.cchPoVendorInvoicePayStatusBadgeHtml = function(paid, due) {
    paid = parseFloat(paid) || 0;
    due = parseFloat(due) || 0;
    var omUi = typeof window.cchOmIsActive === 'function' && window.cchOmIsActive();
    if (due <= 0.02 && paid > 0.01) {
      return '<span class="badge" style="font-size:10px;font-weight:700;padding:3px 10px;background:rgba(46,125,50,0.14);color:#1B5E20;border:1px solid rgba(46,125,50,0.25);white-space:nowrap;">Paid</span>';
    }
    if (due > 0.02) {
      var dueBg = omUi ? 'rgba(15,26,46,0.08)' : 'rgba(180,83,9,0.12)';
      var dueColor = omUi ? '#0F1A2E' : '#92400E';
      var dueBorder = omUi ? 'rgba(15,26,46,0.18)' : 'rgba(180,83,9,0.22)';
      return '<span class="badge" style="font-size:10px;font-weight:700;padding:3px 10px;background:' + dueBg + ';color:' + dueColor + ';border:1px solid ' + dueBorder + ';white-space:nowrap;">Due ' + fmt(due) + '</span>';
    }
    return '<span style="font-size:11px;color:#9CA3AF;">Unpaid</span>';
  };

  window.cchPoVendorInvoiceGroupLineCellsHtml = function(doc, item, lineIdx, poItems) {
    var lineId = window.cchPoResolveLineId(item, lineIdx);
    var grp = window.cchPoVendorInvoiceGroupForLineId(doc, lineId, poItems);
    var invNum = grp ? grp.vendorInvoiceNumber : '';
    var status = grp ? grp.status : '';
    var payHtml = '<span style="font-size:11px;color:#9CA3AF;">—</span>';
    var bill = doc.bill || {};
    if (grp && invNum && bill.received) {
      var lineMeta = cchPoPoLineMetaList(poItems);
      var poLineIds = grp.poLineIds || [];
      var invPaid = cchPoVendorInvoicePaidAmount(doc.payments || [], invNum, null);
      var invDue = cchPoVendorInvoiceBalanceDue(bill, invNum, poLineIds, lineMeta, doc.payments || [], null);
      payHtml = window.cchPoVendorInvoicePayStatusBadgeHtml(invPaid, invDue);
      if (invDue <= 0.02 && invPaid > 0.01) {
        payHtml += '<div style="font-size:10px;font-family:var(--font-mono);color:#1B5E20;margin-top:3px;font-weight:600;">' + fmt(invPaid) + '</div>';
      } else if (invDue > 0.02 && invPaid > 0.01) {
        payHtml += '<div style="font-size:10px;font-family:var(--font-mono);color:#5C6B80;margin-top:3px;">Paid ' + fmt(invPaid) + '</div>';
      }
    }
    return {
      invHtml: invNum
        ? '<span style="font-size:12px;font-weight:600;color:#1B3352;">' + esc(invNum) + '</span>'
        : '<span style="font-size:11px;color:#9CA3AF;">—</span>',
      statusHtml: window.cchPoVendorInvoiceGroupStatusBadgeHtml(status),
      etaHtml: typeof window.cchPoLineEtaHtml === 'function'
        ? window.cchPoLineEtaHtml(doc, item, lineIdx, poItems)
        : '<span style="color:#9CA3AF;">—</span>',
      payHtml: payHtml
    };
  };

  window.cchPoProcurementStatus = function(doc) {
    doc = doc || {};
    if (doc.procurementStatus) return String(doc.procurementStatus).trim();
    if (doc.poLocked || doc.poSentAt) return 'Waiting for Confirmation';
    return 'Draft';
  };

  /** Vendor order confirmation / sales order # — PO header or confirmation vendor-invoice row. */
  window.cchPoOrderConfNumber = function(doc, poItems) {
    doc = doc || {};
    var direct = String(doc.orderConfNumber || doc.orderConfirmation || doc.orderConfNo || '').trim();
    if (direct) return direct;
    var groups = typeof window.cchPoVendorInvoiceGroups === 'function'
      ? window.cchPoVendorInvoiceGroups(doc, poItems || doc.items || [])
      : (doc.vendorInvoiceGroups || []);
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i] || {};
      if (String(g.documentType || '').trim() === 'confirmation') {
        var n = String(g.salesOrderNumber || g.orderConfNumber || g.vendorInvoiceNumber || '').trim();
        if (n) return n;
      }
    }
    for (var j = 0; j < groups.length; j++) {
      var n2 = String(groups[j].salesOrderNumber || groups[j].orderConfNumber || '').trim();
      if (n2) return n2;
    }
    return '';
  };

  window.cchPoOrderConfEditorHtml = function(projectId, poId, doc, opts) {
    opts = opts || {};
    doc = doc || {};
    var val = window.cchPoOrderConfNumber(doc);
    var uid = opts.uid || ('cchPoOrdConf_' + String(poId || '').replace(/[^\w]/g, '').slice(0, 12));
    return '<div class="cch-po-order-conf" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px;">' +
      '<label style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#5C6B80;white-space:nowrap;">' +
      esc(opts.label || 'Order conf #') + '</label>' +
      '<input type="text" id="' + uid + '_inp" class="form-input" style="max-width:220px;font-size:12px;padding:6px 10px;" ' +
      'value="' + escAttr(val) + '" placeholder="SO415912 · sales order #">' +
      (opts.showSaveButton !== false
        ? '<button type="button" class="btn btn-secondary btn-sm" style="font-size:11px;" onclick="cchPoSaveOrderConfNumber(\'' +
          escJs(projectId) + '\',\'' + escJs(poId) + '\',\'' + uid + '\')">Save</button>'
        : '') +
      '</div>';
  };

  window.cchPoSaveOrderConfNumber = async function(projectId, poId, uidOrValue) {
    var val = '';
    if (typeof uidOrValue === 'string' && document.getElementById(uidOrValue + '_inp')) {
      val = String(document.getElementById(uidOrValue + '_inp').value || '').trim();
    } else {
      val = String(uidOrValue || '').trim();
    }
    var ref = firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId);
    var snap = await ref.get();
    if (!snap.exists) return;
    var doc = snap.data() || {};
    var items = doc.items || [];
    var groups = typeof window.cchPoVendorInvoiceGroupsUser === 'function'
      ? window.cchPoVendorInvoiceGroupsUser(doc).map(function(g) { return Object.assign({}, g); })
      : (Array.isArray(doc.vendorInvoiceGroups) ? doc.vendorInvoiceGroups.map(function(g) { return Object.assign({}, g); }) : []);
    var lineIds = [];
    for (var i = 0; i < items.length; i++) {
      if (typeof window.isProposalGroupHeaderItem === 'function' && window.isProposalGroupHeaderItem(items[i])) continue;
      if (typeof window.cchPoLineIsBillOnlyExpense === 'function' && window.cchPoLineIsBillOnlyExpense(items[i])) continue;
      var lid = typeof window.cchPoResolveLineId === 'function' ? window.cchPoResolveLineId(items[i], i) : ('line_' + i);
      if (lid) lineIds.push(lid);
    }
    if (val) {
      var confIdx = -1;
      for (var gi = 0; gi < groups.length; gi++) {
        if (String(groups[gi].documentType || '').trim() === 'confirmation') { confIdx = gi; break; }
      }
      var confGroup = confIdx >= 0 ? groups[confIdx] : {
        id: 'vig_conf_' + Date.now(),
        vendorInvoiceDate: '',
        poLineIds: lineIds.slice(),
        status: 'Confirmed',
        label: 'Order confirmation'
      };
      confGroup.documentType = 'confirmation';
      confGroup.salesOrderNumber = val;
      confGroup.orderConfNumber = val;
      confGroup.vendorInvoiceNumber = String(confGroup.vendorInvoiceNumber || val).trim() || val;
      if (!(confGroup.poLineIds || []).length) confGroup.poLineIds = lineIds.slice();
      if (confIdx >= 0) groups[confIdx] = confGroup;
      else groups.unshift(confGroup);
    }
    var patch = {
      orderConfNumber: val || null,
      orderConfirmation: val || null,
      vendorInvoiceGroups: groups.length ? groups : null,
      updatedAt: new Date().toISOString()
    };
    await cchPoUpdatePoDoc(ref, patch);
    if (typeof window.showToast === 'function') window.showToast(val ? ('Order conf #: ' + val) : 'Order conf # cleared', 'success');
    await window.cchPoAfterFulfillmentStatusSaved(projectId, poId);
  };

  window.cchPoProcurementStatusOptionsHtml = cchPoProcurementStatusOptionsHtml;

  window.cchPoProcurementLanePanelHtml = function(projectId, poId, docData) {
    docData = docData || {};
    var lane = window.cchPoProcurementLaneId(docData);
    var steps = [
      { id: 'draft', label: 'Draft' },
      { id: 'waiting', label: 'Waiting for confirmation' },
      { id: 'confirmed', label: 'Confirmed' }
    ];
    var idx = lane === 'confirmed' ? 2 : (lane === 'waiting' ? 1 : 0);
    var chips = steps.map(function(st, i) {
      var done = i < idx;
      var active = i === idx;
      return '<span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:3px;' +
        (done ? 'background:rgba(46,125,50,0.12);color:#1B5E20;border:1px solid rgba(46,125,50,0.2);' :
          active ? 'background:#1B3352;color:#EDE8E0;border:1px solid #1B3352;' :
          'background:#fff;color:#5C6B80;border:1px solid rgba(15,26,46,0.14);') + '">' +
        (done ? '✓ ' : '') + esc(st.label) + '</span>' +
        (i < steps.length - 1 ? '<span style="color:var(--gray-300);font-size:10px;">→</span>' : '');
    }).join('');

    var sentNote = '';
    if (lane !== 'draft' && docData.poSentAt) {
      var sentStr = typeof window.formatDate === 'function' ? window.formatDate(docData.poSentAt) : String(docData.poSentAt).slice(0, 10);
      sentNote = '<span style="font-size:11px;color:#5C6B80;margin-left:8px;">Sent ' + esc(sentStr) + '</span>';
    }

    var actions = '';
    if (lane === 'draft') {
      actions = '<div style="margin-top:12px;">' +
        '<div style="font-size:11px;font-weight:700;color:#1B3352;margin-bottom:8px;">How was this order placed?</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px;">' +
        '<button type="button" class="btn btn-primary btn-sm" style="background:#C4A464;color:#0F1A2E;font-weight:700;border:none;" onclick="cchPoSendToVendor(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\')">Send PO to vendor</button>' +
        '<button type="button" class="btn btn-primary btn-sm" style="background:#0277BD;color:#fff;font-weight:600;border:none;" onclick="cchPoOpenMarkConfirmedModal(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',false,\'online\')">Online order — confirm</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" style="font-weight:600;color:#1B3352;border-color:rgba(15,26,46,0.25);" onclick="cchPoOpenMarkConfirmedModal(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',false,\'skip_send\')">Mark confirmed (skip send)</button>' +
        '</div>' +
        '<p style="font-size:11px;color:#5C6B80;line-height:1.5;margin:0;max-width:680px;">' +
        '<strong>Send PO to vendor</strong> — email or PDF the PO (locks line items). ' +
        '<strong>Online order</strong> — you placed the order on the vendor website; enter their confirmation # here without sending a PO first. ' +
        '<strong>Mark confirmed (skip send)</strong> — vendor acknowledged another way (phone, rep, etc.).</p>' +
        '</div>';
    } else if (lane === 'waiting') {
      var cur = window.cchPoProcurementStatus(docData);
      var uid = 'cchPoProcLane_' + String(poId || '').replace(/[^\w]/g, '').slice(0, 10);
      actions = '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:12px;">' +
        '<button type="button" class="btn btn-primary btn-sm" style="background:#0277BD;" onclick="cchPoOpenMarkConfirmedModal(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\')">Mark as confirmed</button>' +
        '<select id="' + uid + '_sel" class="form-input" style="max-width:220px;font-size:12px;padding:6px 10px;" data-prev-status="' + escAttr(cur) + '" onfocus="this.setAttribute(\'data-prev-status\',this.value)" onchange="cchPoSaveProcurementStatus(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',\'' + uid + '\')">' +
          cchPoProcurementStatusOptionsHtml(cur, { waitingOnly: true, excludeConfirmed: true }) +
        '</select>' +
        '<span style="font-size:11px;color:#5C6B80;line-height:1.45;">Vendor ack not received yet — attach their sales order / confirmation when it arrives.</span>' +
        '</div>';
    } else {
      var confNum = window.cchPoOrderConfNumber(docData);
      var atts = Array.isArray(docData.confirmationAttachments) ? docData.confirmationAttachments : [];
      var attHtml = atts.length
        ? atts.map(function(a) {
            return '<a href="' + escAttr(a.url || '#') + '" target="_blank" rel="noopener" style="font-size:12px;color:#00796B;font-weight:600;margin-right:10px;">📎 ' + esc(a.name || 'Confirmation') + '</a>';
          }).join('')
        : '<span style="font-size:11px;color:#B45309;font-weight:600;">No confirmation file attached</span>';
      actions = '<div style="margin-top:12px;padding:10px 12px;background:rgba(2,119,189,0.06);border:1px solid rgba(2,119,189,0.18);border-radius:4px;">' +
        '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;">' +
          '<span style="font-size:12px;color:#1B3352;"><strong>Order conf #</strong> ' + (confNum ? esc(confNum) : '—') + '</span>' +
          '<button type="button" class="btn btn-secondary btn-sm" style="font-size:11px;" onclick="cchPoOpenMarkConfirmedModal(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',true)">Edit confirmation</button>' +
        '</div>' +
        '<div style="margin-top:8px;">' + attHtml + '</div>' +
        '</div>';
    }

    return '<div class="cch-po-procurement-lane" style="margin-bottom:12px;padding:12px 14px;background:var(--gray-50);border:1px solid rgba(15,26,46,0.08);border-radius:4px;">' +
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#5C6B80;margin-bottom:8px;">PO / Order status</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">' + chips + sentNote + '</div>' +
      actions +
      '</div>';
  };

  window.cchPoOpenMarkConfirmedModal = async function(projectId, poId, isEdit, orderMethod) {
    window.__cchPoMarkConfirmCtx = { orderMethod: String(orderMethod || '').trim() };
    var snap = await firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
    var doc = snap.data() || {};
    var existingNum = window.cchPoOrderConfNumber(doc);
    var existingDate = '';
    var groups = doc.vendorInvoiceGroups || [];
    for (var i = 0; i < groups.length; i++) {
      if (String(groups[i].documentType || '').trim() === 'confirmation' && groups[i].confirmedDate) {
        existingDate = String(groups[i].confirmedDate).slice(0, 10);
        break;
      }
    }
    var om = window.__cchPoMarkConfirmCtx.orderMethod;
    var title = isEdit ? 'Edit order confirmation' : (om === 'online' ? 'Online order — confirm' : 'Mark as confirmed');
    var blurb = isEdit
      ? 'Update the vendor order confirmation # or attachment.'
      : (om === 'online'
        ? 'You placed this order on the vendor website. Enter their <strong>order confirmation / sales order #</strong> and attach the confirmation PDF or screenshot — no PO send required.'
        : (om === 'skip_send'
          ? 'The vendor acknowledged this order without a formal PO send. Enter their <strong>order confirmation / sales order #</strong> and attach their confirmation PDF or screenshot.'
          : 'Vendor acknowledged the PO. Enter their <strong>order confirmation / sales order #</strong> and attach their confirmation PDF or screenshot.'));
    var html = '<div id="cchMarkConfirmedModal" style="position:fixed;inset:0;background:rgba(15,26,46,0.45);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target===this)this.remove()">' +
      '<div style="background:#fff;max-width:480px;width:100%;padding:24px;border-radius:4px;box-shadow:0 16px 48px rgba(0,0,0,0.2);" onclick="event.stopPropagation()">' +
      '<h3 style="margin:0 0 8px;font-size:18px;">' + esc(title) + '</h3>' +
      '<p style="font-size:12px;color:#5C6B80;margin:0 0 16px;line-height:1.5;">' + blurb + '</p>' +
      '<div style="margin-bottom:12px;"><label class="form-label">Order conf # <span style="color:#B45309;">*</span></label>' +
        '<input type="text" id="cchMarkConfNum" class="form-input" value="' + escAttr(existingNum) + '" placeholder="SO415912"></div>' +
      '<div style="margin-bottom:12px;"><label class="form-label">Confirmed date</label>' +
        '<input type="date" id="cchMarkConfDate" class="form-input" value="' + escAttr(existingDate) + '"></div>' +
      '<div style="margin-bottom:16px;"><label class="form-label">Attach confirmation (PDF or image)</label>' +
        '<input type="file" id="cchMarkConfFile" class="form-input" accept=".pdf,image/*" style="font-size:12px;padding:6px;"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
        '<button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById(\'cchMarkConfirmedModal\').remove()">Cancel</button>' +
        '<button type="button" class="btn btn-primary btn-sm" style="background:#0277BD;" onclick="cchPoSubmitMarkConfirmed(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\')">Save &amp; mark confirmed</button>' +
      '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  };

  window.cchPoSubmitMarkConfirmed = async function(projectId, poId) {
    var numEl = document.getElementById('cchMarkConfNum');
    var dateEl = document.getElementById('cchMarkConfDate');
    var fileEl = document.getElementById('cchMarkConfFile');
    var confNum = String(numEl && numEl.value || '').trim();
    if (!confNum) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('Order conf # is required.', 'Mark as confirmed');
      return;
    }
    var confirmedDate = String(dateEl && dateEl.value || '').trim();
    var file = fileEl && fileEl.files && fileEl.files[0];
    if (file && file.size > 15 * 1024 * 1024) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('File must be under 15MB.', 'Attachment');
      return;
    }
    try {
      var ref = firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId);
      var snap = await ref.get();
      if (!snap.exists) return;
      var doc = snap.data() || {};
      var items = doc.items || [];
      var confirmationAttachments = Array.isArray(doc.confirmationAttachments) ? doc.confirmationAttachments.slice() : [];
      if (file) {
        var path = 'attachments/' + projectId + '/purchaseOrders/' + poId + '/confirmation/' + Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        var storageRef = firebase.storage().ref(path);
        var up = await storageRef.put(file);
        var url = await up.ref.getDownloadURL();
        confirmationAttachments.push({
          name: file.name,
          url: url,
          type: file.type || '',
          size: file.size || 0,
          uploadedAt: new Date().toISOString()
        });
      }
      var groups = typeof window.cchPoVendorInvoiceGroupsUser === 'function'
        ? window.cchPoVendorInvoiceGroupsUser(doc).map(function(g) { return Object.assign({}, g); })
        : (Array.isArray(doc.vendorInvoiceGroups) ? doc.vendorInvoiceGroups.map(function(g) { return Object.assign({}, g); }) : []);
      var lineIds = [];
      for (var i = 0; i < items.length; i++) {
        if (typeof window.isProposalGroupHeaderItem === 'function' && window.isProposalGroupHeaderItem(items[i])) continue;
        if (typeof window.cchPoLineIsBillOnlyExpense === 'function' && window.cchPoLineIsBillOnlyExpense(items[i])) continue;
        var lid = typeof window.cchPoResolveLineId === 'function' ? window.cchPoResolveLineId(items[i], i) : ('line_' + i);
        if (lid) lineIds.push(lid);
      }
      var confIdx = -1;
      for (var gi = 0; gi < groups.length; gi++) {
        if (String(groups[gi].documentType || '').trim() === 'confirmation') { confIdx = gi; break; }
      }
      var lastAtt = confirmationAttachments.length ? confirmationAttachments[confirmationAttachments.length - 1] : null;
      var confGroup = confIdx >= 0 ? groups[confIdx] : {
        id: 'vig_conf_' + Date.now(),
        vendorInvoiceDate: '',
        poLineIds: lineIds.slice(),
        status: 'Confirmed',
        label: 'Order confirmation'
      };
      confGroup.documentType = 'confirmation';
      confGroup.salesOrderNumber = confNum;
      confGroup.orderConfNumber = confNum;
      confGroup.vendorInvoiceNumber = confNum;
      confGroup.confirmedDate = confirmedDate;
      if (lastAtt) {
        confGroup.attachmentName = lastAtt.name;
        confGroup.attachmentUrl = lastAtt.url;
      }
      if (!(confGroup.poLineIds || []).length) confGroup.poLineIds = lineIds.slice();
      if (confIdx >= 0) groups[confIdx] = confGroup;
      else groups.unshift(confGroup);
      var patch = {
        procurementStatus: 'Confirmed',
        procurementConfirmedAt: new Date().toISOString(),
        orderConfNumber: confNum,
        orderConfirmation: confNum,
        confirmationAttachments: confirmationAttachments.length ? confirmationAttachments : null,
        vendorInvoiceGroups: groups.length ? groups : null,
        updatedAt: new Date().toISOString()
      };
      var markCtx = window.__cchPoMarkConfirmCtx || {};
      if (markCtx.orderMethod === 'online') {
        patch.orderMethod = 'online';
        patch.orderedOnline = true;
      } else if (markCtx.orderMethod === 'skip_send') {
        patch.orderMethod = 'skip_send';
      }
      if (window.cchPoProcurementLaneId(doc) === 'draft' && !doc.poSentAt) {
        patch.orderPlacedAt = new Date().toISOString();
      }
      try { delete window.__cchPoMarkConfirmCtx; } catch (_eCtx) { window.__cchPoMarkConfirmCtx = null; }
      var existingShip = window.cchPoShippingStatus(doc);
      if (!String(doc.shippingStatus || '').trim() && (!existingShip || existingShip === 'Pending')) {
        patch.shippingStatus = 'Pending';
      } else if (!String(doc.shippingStatus || '').trim() && existingShip) {
        patch.shippingStatus = existingShip;
      }
      await cchPoUpdatePoDoc(ref, patch);
      var modal = document.getElementById('cchMarkConfirmedModal');
      if (modal) modal.remove();
      if (typeof window.showToast === 'function') window.showToast('PO marked confirmed · ' + confNum, 'success');
      if (typeof window.logDocActivity === 'function') {
        var _confNote = markCtx.orderMethod === 'online'
          ? 'Online order confirmed — ' + confNum
          : (markCtx.orderMethod === 'skip_send'
            ? 'Confirmed without PO send — ' + confNum
            : 'Vendor confirmation recorded — ' + confNum);
        await window.logDocActivity(projectId, 'purchaseOrders', poId, 'po_confirmed', _confNote);
      }
      if (typeof window.invalidateSearchCache === 'function') window.invalidateSearchCache();
      if (typeof window._cacheTime !== 'undefined') window._cacheTime = 0;
      await window.cchPoAfterFulfillmentStatusSaved(projectId, poId);
      if (typeof window.navigate === 'function') window.navigate(window.location.hash);
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert(e.message || e, 'Mark as confirmed');
    }
  };

  window.cchPoSaveProcurementStatus = async function(projectId, poId, uid) {
    var sel = document.getElementById(uid + '_sel');
    if (!sel) return;
    var status = String(sel.value || '').trim();
    var prev = sel.getAttribute('data-prev-status') || window.cchPoProcurementStatus({});
    if (status === 'Confirmed') {
      sel.value = prev;
      return window.cchPoOpenMarkConfirmedModal(projectId, poId);
    }
    if (!status || status === 'Draft') {
      sel.value = prev;
      if (typeof window.cchAlert === 'function') await window.cchAlert('Use the PO editor while still in Draft. After send, status is Waiting for confirmation.', 'PO status');
      return;
    }
    try {
      await firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).update({
        procurementStatus: status,
        updatedAt: new Date().toISOString()
      });
      sel.setAttribute('data-prev-status', status);
      if (typeof window.showToast === 'function') window.showToast('PO status: ' + status, 'success');
      await window.cchPoAfterFulfillmentStatusSaved(projectId, poId);
      if (typeof window.navigate === 'function') window.navigate(window.location.hash);
    } catch (e) {
      sel.value = prev;
      if (typeof window.cchAlert === 'function') await window.cchAlert(e.message || e, 'PO status');
    }
  };

  window.cchPoVendorInvoiceGroupsPanelHtml = function(projectId, poId, docData, poItems) {
    docData = docData || {};
    poItems = poItems || docData.items || [];
    var bill = docData.bill || {};
    var hasBill = !!(bill && bill.received);
    if (!hasBill) return '';

    var groups = window.cchPoVendorInvoiceGroupsDisplay(docData, poItems);
    var lineMeta = cchPoPoLineMetaList(poItems);
    var rows = '';
    groups.forEach(function(g, idx) {
      var itemTitles = cchPoPoLineTitlesFromIds(lineMeta, g.poLineIds);
      var itemsLabel = itemTitles.length ? itemTitles.join('; ') : '—';
      var track = g.trackingNumber
        ? esc(g.trackingCarrier ? g.trackingCarrier + ' ' : '') + esc(g.trackingNumber)
        : '<span style="color:#9CA3AF;">—</span>';
      var eta = window.cchPoVendorInvOrderTimelineHtml(g);
      var noteCell = g.notes
        ? '<span title="' + escAttr(g.notes) + '">' + esc(g.notes.length > 48 ? g.notes.slice(0, 46) + '…' : g.notes) + '</span>'
        : '<span style="color:#9CA3AF;">—</span>';
      var chargesCell = hasBill ? cchPoGroupChargesCellHtml(bill, g.vendorInvoiceNumber, g.poLineIds, lineMeta) : '<span style="color:#9CA3AF;">—</span>';
      var invPaid = hasBill
        ? cchPoVendorInvoicePaidAmount(docData.payments || [], g.vendorInvoiceNumber, null)
        : 0;
      var invBal = hasBill
        ? cchPoVendorInvoiceBalanceDue(bill, g.vendorInvoiceNumber, g.poLineIds, lineMeta, docData.payments || [], null)
        : 0;
      var isInvPaid = hasBill && invBal <= 0.02 && invPaid > 0.01;
      var payStatusCell = '<span style="color:#9CA3AF;">—</span>';
      if (hasBill) {
        payStatusCell = window.cchPoVendorInvoicePayStatusBadgeHtml(invPaid, invBal);
        if (isInvPaid) {
          payStatusCell += '<div style="font-size:11px;font-family:var(--font-mono);color:#1B5E20;margin-top:4px;font-weight:600;">' + fmt(invPaid) + '</div>';
        } else if (invPaid > 0.01) {
          payStatusCell += '<div style="font-size:10px;font-family:var(--font-mono);color:#5C6B80;margin-top:4px;">Paid ' + fmt(invPaid) + '</div>';
        }
      }
      var payCell = invBal > 0.02
        ? '<button type="button" class="btn btn-secondary btn-sm" style="font-size:10px;padding:4px 8px;margin-right:4px;" onclick="event.stopPropagation();cchPoOpenPaymentModal(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',null,\'' + escJs(g.vendorInvoiceNumber || '') + '\')" title="Record payment for this invoice">Pay · ' + fmt(invBal) + '</button>'
        : (isInvPaid
          ? window.cchPoVendorInvoicePayStatusBadgeHtml(invPaid, invBal)
          : '<span style="font-size:10px;color:#9CA3AF;">—</span>');
      var docType = String(g.documentType || '').trim() || 'ship_invoice';
      var refLabel = window.cchPoVendorInvRefLabel(g);
      var invNumCell = (isInvPaid ? '<span style="color:#1B5E20;margin-right:6px;" title="Paid">✓</span>' : '') +
        esc(refLabel) +
        window.cchPoVendorInvDocumentTypeBadgeHtml(docType) +
        (docType === 'confirmation' && g.salesOrderNumber && g.vendorInvoiceNumber && g.vendorInvoiceNumber !== g.salesOrderNumber
          ? '<div style="font-size:10px;color:#9CA3AF;margin-top:2px;">Inv ' + esc(g.vendorInvoiceNumber) + '</div>' : '') +
        (g._fromBill ? ' <span style="font-size:9px;font-weight:600;color:#5C6B80;background:rgba(27,51,82,0.08);padding:2px 6px;border-radius:3px;vertical-align:middle;" title="From combined vendor bill — Edit to save as a tracked row">On bill</span>' : '');
      var rowStyle = isInvPaid
        ? 'border-bottom:1px solid rgba(46,125,50,0.12);background:rgba(46,125,50,0.06);'
        : 'border-bottom:1px solid rgba(15,26,46,0.06);';
      rows += '<tr style="' + rowStyle + '">' +
        '<td style="padding:10px 8px;font-size:12px;font-weight:600;color:#1B3352;">' + invNumCell + '</td>' +
        '<td style="padding:10px 8px;font-size:11px;color:#5C6B80;max-width:180px;">' + esc(itemsLabel) + '</td>' +
        '<td style="padding:10px 8px;text-align:right;font-size:12px;">' + chargesCell + '</td>' +
        '<td style="padding:10px 8px;text-align:center;font-size:12px;white-space:nowrap;">' + payStatusCell + '</td>' +
        '<td style="padding:10px 8px;">' + window.cchPoVendorInvoiceGroupStatusBadgeHtml(g.status) + '</td>' +
        '<td style="padding:10px 8px;font-size:11px;">' + eta + '</td>' +
        '<td style="padding:10px 8px;font-size:11px;font-family:var(--font-mono);">' + track + '</td>' +
        '<td style="padding:10px 8px;font-size:11px;color:#5C6B80;max-width:140px;">' + noteCell + '</td>' +
        '<td style="padding:10px 8px;text-align:right;white-space:nowrap;">' +
          payCell +
          '<button type="button" class="btn btn-secondary btn-sm" style="font-size:10px;padding:4px 10px;" onclick="cchPoOpenVendorInvoiceGroupModal(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',\'' + escJs(g.id || ('vig_' + idx)) + '\')">Edit</button>' +
        '</td></tr>';
    });
    if (!rows) {
      rows = '<tr><td colspan="9" style="padding:14px;text-align:center;color:var(--gray-400);font-size:12px;">Invoice rows sync from the combined bill. Use <strong>+ Add vendor invoice</strong> on the bill bar for new freight or invoice #s.</td></tr>';
    }
    var hint = 'Vendor workflow: <strong>Order confirmation</strong> (sales order, est. freight — may lack ship date) → CC on file → <strong>Ship invoice</strong> per partial shipment (actual freight, tracking, CC charged). Amounts: <strong>+ Add vendor invoice</strong> or <strong>Edit</strong>.';
    return '<div id="cchVendorInvoiceGroupsPanel" style="margin-bottom:14px;padding:12px 14px;background:#fff;border:1px solid rgba(0,121,107,0.18);border-radius:4px;border-left:3px solid #00796B;">' +
      '<div style="margin-bottom:10px;">' +
          '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#00796B;margin-bottom:4px;">Vendor invoices &amp; confirmations</div>' +
          '<p style="font-size:11px;color:#5C6B80;margin:0;line-height:1.45;max-width:640px;">' + hint + '</p>' +
        '</div>' +
      '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="border-bottom:1px solid var(--gray-200);">' +
          '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);">Doc / ref #</th>' +
          '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);">PO items</th>' +
          '<th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;color:var(--gray-400);">Invoice total</th>' +
          '<th style="padding:8px;text-align:center;font-size:10px;text-transform:uppercase;color:var(--gray-400);">Payment</th>' +
          '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);">Order status</th>' +
          '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);">Ship &amp; delivery</th>' +
          '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);">Tracking</th>' +
          '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);">Notes</th>' +
          '<th style="padding:8px;text-align:right;font-size:10px;text-transform:uppercase;color:var(--gray-400);"></th>' +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  };

  window.cchPoOpenVendorInvoiceGroupModal = async function(projectId, poId, groupId) {
    groupId = String(groupId || '').trim();
    if (!groupId) {
      var snapEarly = await firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
      var docEarly = snapEarly.data() || {};
      if (!(docEarly.bill && docEarly.bill.received)) {
        return window.cchPoOpenReceiveBillModal(projectId, poId);
      }
      return window.cchPoOpenAddToBillModal(projectId, poId);
    }
    var snap = await firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
    var doc = snap.data() || {};
    if (!(doc.bill && doc.bill.received)) {
      if (typeof window.cchAlert === 'function') {
        await window.cchAlert('Receive the vendor bill first, then edit invoice rows here.', 'Vendor invoice');
      }
      return window.cchPoOpenReceiveBillModal(projectId, poId);
    }
    var poItems = doc.items || [];
    var groups = window.cchPoVendorInvoiceGroupsDisplay(doc, poItems);
    var existing = groupId ? groups.find(function(g) { return g.id === groupId; }) : null;
    var lineMeta = cchPoPoLineMetaList(poItems);
    var atts = (doc.bill && doc.bill.attachments) ? doc.bill.attachments : [];
    var existingCharges = existing && doc.bill && doc.bill.received
      ? cchPoVigChargeRowsForModal(doc.bill, existing.vendorInvoiceNumber, existing.poLineIds)
      : [];
    if (!existingCharges.length && doc.bill && doc.bill.received) {
      existingCharges = [{ type: 'freight', amount: '', description: '' }, { type: 'tax', amount: '', description: 'Pre-paid tax' }];
    }
    var chargeRowsHtml = existingCharges.map(function(r) { return cchPoVigChargeRowHtml(r); }).join('');
    if (!chargeRowsHtml && doc.bill && doc.bill.received) {
      chargeRowsHtml = cchPoVigChargeRowHtml({ type: 'freight', amount: '', description: '' });
    }
    var chargesBlock = (
      '<div style="margin-bottom:14px;padding:12px;background:rgba(180,83,9,0.05);border:1px solid rgba(180,83,9,0.15);border-radius:4px;">' +
        '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#B45309;margin:0 0 6px;">Freight, tax &amp; fees</div>' +
        '<p style="font-size:11px;color:#5C6B80;margin:0 0 10px;line-height:1.45;">Additional charges on this vendor invoice # (updates the combined bill total).</p>' +
        '<div id="cchVigChargesList">' + chargeRowsHtml + '</div>' +
        '<button type="button" class="btn btn-secondary btn-sm" style="margin-top:6px;" onclick="cchPoAddVigChargeRow()">+ Add charge line</button>' +
      '</div>'
    );
    var statusOpts = cchPoVendorInvOrderStatusOptionsHtml(existing ? existing.status : '');
    var docTypeOpts = cchPoVendorInvDocumentTypeOptionsHtml(existing ? existing.documentType : 'ship_invoice');
    var poAtSend = doc.poTotalAtSend != null ? doc.poTotalAtSend : (doc.bill && doc.bill.poTotalAtSend != null ? doc.bill.poTotalAtSend : window.cchPoDocTotal(doc));
    var canQbVig = !!(doc.bill && doc.bill.received) && cchPoCanPushBillToQb();
    var lineBoxes = lineMeta.map(function(l) {
      var checked = existing ? (existing.poLineIds || []).indexOf(l.lineId) >= 0 : false;
      return '<label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;margin:6px 0;cursor:pointer;">' +
        '<input type="checkbox" class="cch-vig-line-cb" value="' + escAttr(l.lineId) + '"' + (checked ? ' checked' : '') + ' style="accent-color:var(--gold);margin-top:3px;" onchange="cchPoVigPoLineChanged(this)">' +
        '<span><strong>' + esc(l.title) + '</strong> <span style="color:#9CA3AF;">' + fmt(l.amount) + '</span></span></label>';
    }).join('');
    var attOpts = '<option value="">— None —</option>' + atts.map(function(a) {
      var n = String(a.name || 'File');
      var sel = existing && existing.attachmentName === n ? ' selected' : '';
      return '<option value="' + escAttr(n) + '"' + sel + '>' + esc(n.length > 42 ? n.slice(0, 40) + '…' : n) + '</option>';
    }).join('');
    var title = 'Edit vendor invoice';
    var html = '<div id="cchVendorInvGroupModal" style="position:fixed;inset:0;background:rgba(15,26,46,0.45);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target===this)this.remove()">' +
      '<div style="background:#fff;max-width:680px;width:100%;padding:24px;border-radius:4px;box-shadow:0 16px 48px rgba(0,0,0,0.2);max-height:90vh;overflow:auto;" onclick="event.stopPropagation()">' +
      '<h3 style="margin:0 0 8px;font-size:18px;">' + esc(title) + '</h3>' +
      '<p style="font-size:12px;color:#5C6B80;margin:0 0 14px;line-height:1.5;">Match vendor paperwork: <strong>Order confirmation / sales order</strong> when they acknowledge the PO (est. freight, optional start-ship date, back-order lines). <strong>Ship invoice</strong> when they ship and charge your CC — one row per partial shipment with actual freight and tracking.</p>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">' +
        '<div style="grid-column:1/-1;"><label class="form-label">Document type</label><select id="cchVigDocumentType" class="form-input">' + docTypeOpts + '</select></div>' +
        '<div><label class="form-label">Order conf # <span style="font-weight:400;color:#9CA3AF;">(sales order)</span></label><input type="text" id="cchVigSalesOrderNum" class="form-input" value="' + escAttr(existing ? existing.salesOrderNumber : '') + '" placeholder="SO415912"></div>' +
        '<div><label class="form-label">Vendor invoice / ref #</label><input type="text" id="cchVigInvNum" class="form-input" value="' + escAttr(existing ? existing.vendorInvoiceNumber : '') + '" placeholder="CS337523 or SO415912" oninput="cchPoUpdateVigBillPreview()"></div>' +
        '<div><label class="form-label">Document date</label><input type="date" id="cchVigInvDate" class="form-input" value="' + escAttr(existing ? existing.vendorInvoiceDate : '') + '" onchange="cchPoUpdateVigBillPreview()"></div>' +
        '<div><label class="form-label">Est. freight $ <span style="font-weight:400;color:#9CA3AF;">(on confirmation)</span></label><input type="number" step="0.01" min="0" id="cchVigEstFreight" class="form-input" value="' + escAttr(existing && existing.estimatedFreight !== '' && existing.estimatedFreight != null ? existing.estimatedFreight : '') + '" placeholder="127.20"></div>' +
        '<div><label class="form-label">Actual freight $ <span style="font-weight:400;color:#9CA3AF;">(on ship invoice)</span></label><input type="number" step="0.01" min="0" id="cchVigActFreight" class="form-input" value="' + escAttr(existing && existing.actualFreight !== '' && existing.actualFreight != null ? existing.actualFreight : '') + '" placeholder="83.20"></div>' +
      '</div>' +
      '<div style="margin-bottom:12px;"><label class="form-label">PO items on this document</label><div style="padding:10px;background:rgba(27,51,82,0.03);border-radius:4px;border:1px solid rgba(15,26,46,0.08);max-height:160px;overflow:auto;">' +
        (lineBoxes || '<span style="font-size:12px;color:#9CA3AF;">No PO lines</span>') +
      '</div></div>' +
      chargesBlock +
      '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#00796B;margin:0 0 8px;">Order &amp; shipment</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">' +
        '<div style="grid-column:1/-1;"><label class="form-label">Order status</label><select id="cchVigStatus" class="form-input">' + statusOpts + '</select></div>' +
        '<div><label class="form-label">Confirmed date</label><input type="date" id="cchVigConfirmedDate" class="form-input" value="' + escAttr(existing ? existing.confirmedDate : '') + '"></div>' +
        '<div><label class="form-label">Est. ship date</label><input type="date" id="cchVigEstShipDate" class="form-input" value="' + escAttr(existing ? existing.estimatedShipDate : '') + '" title="Vendor promised ship — before CC charge"></div>' +
        '<div><label class="form-label">Actual ship date</label><input type="date" id="cchVigActualShipDate" class="form-input" value="' + escAttr(existing ? existing.actualShipDate : '') + '" title="Left vendor / CC charged"></div>' +
        '<div><label class="form-label">Delivery ETA</label><input type="date" id="cchVigEtaDate" class="form-input" value="' + escAttr(existing ? existing.etaDate : '') + '" title="Expected delivery to client/receiver"></div>' +
        '<div><label class="form-label">Carrier <span style="font-weight:400;color:#9CA3AF;">(optional)</span></label><input type="text" id="cchVigCarrier" class="form-input" value="' + escAttr(existing ? existing.trackingCarrier : '') + '" placeholder="USPS, FedEx…"></div>' +
        '<div style="grid-column:1/-1;"><label class="form-label">Tracking #</label><input type="text" id="cchVigTracking" class="form-input" value="' + escAttr(existing ? existing.trackingNumber : '') + '" placeholder="9400…"></div>' +
        '<div style="grid-column:1/-1;"><label class="form-label">Notes</label>' +
        '<textarea id="cchVigNotes" class="form-textarea" rows="2" placeholder="Back-order detail, freight invoice pending, receiver instructions…" style="min-height:52px;font-size:12px;">' + esc(existing ? existing.notes || '' : '') + '</textarea></div>' +
      '</div>' +
      (atts.length ? '<div style="margin-bottom:12px;"><label class="form-label">Linked PDF</label><select id="cchVigAttachment" class="form-input">' + attOpts + '</select></div>' : '') +
      '<div id="cchVigBillPreview" style="font-size:13px;padding:12px;background:rgba(27,51,82,0.04);border-radius:4px;border:1px solid rgba(27,51,82,0.1);margin-bottom:14px;"></div>' +
      '<input type="hidden" id="cchVigGroupId" value="' + escAttr(existing ? existing.id : '') + '">' +
      '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;flex-wrap:wrap;">' +
        '<button type="button" class="btn btn-secondary" onclick="document.getElementById(\'cchVendorInvGroupModal\').remove()">Cancel</button>' +
        (existing ? '<button type="button" class="btn btn-sm" style="color:#B91C1C;border-color:rgba(185,28,28,0.35);" onclick="cchPoDeleteVendorInvoiceGroup(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',\'' + escJs(existing.id) + '\')">Remove</button>' : '') +
        cchPoVigModalActionButtons(projectId, poId, canQbVig) +
      '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    window.__cchVigPoAtSend = poAtSend;
    window.__cchVigPoLines = lineMeta;
    window.__cchVigDocSnapshot = doc;
    window.__cchVigOldInvNum = existing ? existing.vendorInvoiceNumber : '';
    window.__cchVigProjectId = projectId;
    window.__cchVigPoId = poId;
    cchPoRefreshAllVigPriceChangeRows();
    window.cchPoUpdateVigBillPreview();
  };

  window.cchPoVigPoLineChanged = function(cb) {
    cchPoRefreshAllVigPriceChangeRows();
    window.cchPoUpdateVigBillPreview();
  };

  window.cchPoSaveVendorInvoiceGroup = async function(projectId, poId, pushQb) {
    var invNum = String(document.getElementById('cchVigInvNum') && document.getElementById('cchVigInvNum').value || '').trim();
    var invDate = String(document.getElementById('cchVigInvDate') && document.getElementById('cchVigInvDate').value || '').trim();
    var status = String(document.getElementById('cchVigStatus') && document.getElementById('cchVigStatus').value || '').trim();
    var carrier = String(document.getElementById('cchVigCarrier') && document.getElementById('cchVigCarrier').value || '').trim();
    var tracking = String(document.getElementById('cchVigTracking') && document.getElementById('cchVigTracking').value || '').trim();
    tracking = tracking.replace(/^tracking:\s*/i, '').trim();
    var etaDate = String(document.getElementById('cchVigEtaDate') && document.getElementById('cchVigEtaDate').value || '').trim();
    var confirmedDate = String(document.getElementById('cchVigConfirmedDate') && document.getElementById('cchVigConfirmedDate').value || '').trim();
    var estimatedShipDate = String(document.getElementById('cchVigEstShipDate') && document.getElementById('cchVigEstShipDate').value || '').trim();
    var actualShipDate = String(document.getElementById('cchVigActualShipDate') && document.getElementById('cchVigActualShipDate').value || '').trim();
    var notes = String(document.getElementById('cchVigNotes') && document.getElementById('cchVigNotes').value || '').trim();
    var documentType = String(document.getElementById('cchVigDocumentType') && document.getElementById('cchVigDocumentType').value || '').trim() || 'ship_invoice';
    var salesOrderNumber = String(document.getElementById('cchVigSalesOrderNum') && document.getElementById('cchVigSalesOrderNum').value || '').trim();
    var estFreightRaw = document.getElementById('cchVigEstFreight') && document.getElementById('cchVigEstFreight').value;
    var actFreightRaw = document.getElementById('cchVigActFreight') && document.getElementById('cchVigActFreight').value;
    var estimatedFreight = estFreightRaw !== '' && estFreightRaw != null ? Math.round((parseFloat(estFreightRaw) || 0) * 100) / 100 : '';
    var actualFreight = actFreightRaw !== '' && actFreightRaw != null ? Math.round((parseFloat(actFreightRaw) || 0) * 100) / 100 : '';
    var attName = String(document.getElementById('cchVigAttachment') && document.getElementById('cchVigAttachment').value || '').trim();
    var editId = String(document.getElementById('cchVigGroupId') && document.getElementById('cchVigGroupId').value || '').trim();
    if (!editId) {
      if (typeof window.cchAlert === 'function') {
        await window.cchAlert('Use Receive vendor bill to add a new invoice. This editor is for existing rows only.', 'Vendor invoice');
      }
      return;
    }
    var poLineIds = [];
    document.querySelectorAll('.cch-vig-line-cb:checked').forEach(function(cb) {
      if (cb.value) poLineIds.push(cb.value);
    });
    if (!invNum && !salesOrderNumber) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('Enter a vendor invoice # or order conf #.', 'Vendor invoice');
      return;
    }
    if (!invNum && salesOrderNumber) invNum = salesOrderNumber;
    if (!poLineIds.length) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('Select at least one PO line for this vendor invoice.', 'Vendor invoice');
      return;
    }
    var ref = firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId);
    var snap = await ref.get();
    var doc = snap.data() || {};
    var groups = (doc.vendorInvoiceGroups || []).map(cchPoNormalizeVendorInvoiceGroup).filter(function(g) {
      return !cchPoVendorInvoiceGroupIsPlaceholder(g);
    });
    var oldInvNum = '';
    if (editId === CCH_PO_VIG_FROM_BILL_ID) {
      oldInvNum = String(doc.bill && doc.bill.vendorInvoiceNumber || '').trim();
      editId = '';
    } else if (editId) {
      (doc.vendorInvoiceGroups || []).some(function(g) {
        if (g.id === editId) { oldInvNum = String(g.vendorInvoiceNumber || '').trim(); return true; }
        return false;
      });
    }
    var payload = {
      id: editId || ('vig_' + Date.now()),
      vendorInvoiceNumber: invNum,
      vendorInvoiceDate: invDate,
      poLineIds: poLineIds,
      status: status,
      documentType: documentType,
      salesOrderNumber: salesOrderNumber,
      confirmedDate: confirmedDate,
      estimatedShipDate: estimatedShipDate,
      actualShipDate: actualShipDate,
      estimatedFreight: estimatedFreight,
      actualFreight: actualFreight,
      trackingNumber: tracking,
      trackingCarrier: carrier,
      etaDate: etaDate,
      notes: notes,
      attachmentName: attName,
      label: '',
      updatedAt: new Date().toISOString()
    };
    var found = false;
    groups = groups.map(function(g) {
      if (g.id === payload.id) { found = true; return payload; }
      g.poLineIds = (g.poLineIds || []).filter(function(id) { return poLineIds.indexOf(id) < 0; });
      return g;
    });
    if (!found) groups.push(payload);
    groups = groups.filter(function(g) { return (g.poLineIds || []).length > 0 || g.id === payload.id; });
    groups = groups.filter(function(g) { return !cchPoVendorInvoiceGroupIsPlaceholder(g); });
    var patch = { vendorInvoiceGroups: groups.length ? groups : null, updatedAt: new Date().toISOString() };
    if (documentType === 'confirmation' && salesOrderNumber) {
      patch.orderConfNumber = salesOrderNumber;
      patch.orderConfirmation = salesOrderNumber;
    }
    if (doc.bill && doc.bill.received) {
      var chargeRows = cchPoReadVigChargeRowsFromDom();
      var merged = cchPoMergeVigChargesIntoBill(doc.bill, doc, oldInvNum, invNum, invDate, poLineIds, chargeRows);
      patch.bill = merged.bill;
      if (oldInvNum && String(doc.bill.vendorInvoiceNumber || '').trim() === oldInvNum && invNum !== oldInvNum) {
        patch.bill.vendorInvoiceNumber = invNum;
      }
      if (Math.abs(merged.varianceAmt) > 0.01) {
        var prevVar = doc.variance || {};
        patch.variance = Object.assign({}, prevVar, {
          amount: Math.round(merged.varianceAmt * 100) / 100,
          reason: prevVar.reason || cchPoPickVarianceReason(merged.bill.items || [], merged.varianceAmt)
        });
      }
    }
    try {
      await cchPoUpdatePoDoc(ref, patch);
      var modal = document.getElementById('cchVendorInvGroupModal');
      if (modal) modal.remove();
      if (typeof window.showToast === 'function') window.showToast('Vendor invoice saved', 'success');
      if (pushQb && cchPoCanPushBillToQb()) {
        if (typeof window.showToast === 'function') window.showToast('Syncing to QuickBooks…', 'success');
        var qbResult = await window.cchPoPushBillToQB(projectId, poId, null, { skipConfirm: true });
        if (qbResult && qbResult.ok && typeof window.showToast === 'function') {
          window.showToast(qbResult.message || 'QuickBooks Bill updated', 'success');
        }
      }
      await window.cchPoAfterFulfillmentStatusSaved(projectId, poId);
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert(e.message || e, 'Vendor invoice');
    }
  };

  window.cchPoDeleteVendorInvoiceGroup = async function(projectId, poId, groupId) {
    if (!(typeof window.cchConfirm === 'function'
      ? await window.cchConfirm('Remove this vendor invoice row?', 'Remove vendor invoice', { confirmText: 'Remove', cancelText: 'Cancel' })
      : confirm('Remove this vendor invoice row?'))) return;
    var ref = firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId);
    var snap = await ref.get();
    var doc = snap.data() || {};
    var groups = window.cchPoVendorInvoiceGroupsUser(doc).filter(function(g) { return g.id !== groupId; });
    await cchPoUpdatePoDoc(ref, { vendorInvoiceGroups: groups.length ? groups : null, updatedAt: new Date().toISOString() });
    var modal = document.getElementById('cchVendorInvGroupModal');
    if (modal) modal.remove();
    if (typeof window.showToast === 'function') window.showToast('Vendor invoice removed', 'success');
    await window.cchPoAfterFulfillmentStatusSaved(projectId, poId);
  };

  window.cchPoBillVarianceMainBlocksHtml = function(projectId, poId, docData, poItems) {
    var bill = docData.bill;
    var variance = docData.variance;
    var hasBill = bill && bill.received;
    var poLane = window.cchPoProcurementLanePanelHtml(projectId, poId, docData);
    var billLane = window.cchPoBillLanePanelHtml(projectId, poId, docData, poItems);
    var shipLane = window.cchPoShippingLanePanelHtml(projectId, poId, docData, poItems);
    var billLaneId = window.cchPoBillLaneId(docData, poItems);
    var showVendorInv = hasBill || billLaneId === 'partial';

    var vendorInvPanel = showVendorInv
      ? window.cchPoVendorInvoiceGroupsPanelHtml(projectId, poId, docData, poItems)
      : '';

    var billDoc = window.cchPoVendorBillDocumentHtml(projectId, poId, docData, poItems, poNum(docData));

    var billAttachments = hasBill && typeof window.cchPoBillAttachmentsHtml === 'function'
      ? window.cchPoBillAttachmentsHtml(projectId, poId, docData)
      : '';

    var varCard = '';
    if (variance && Math.abs(parseFloat(variance.amount) || 0) > 0.01) {
      var pending = String(variance.resolution || 'pending') === 'pending';
      varCard = '<div class="card" style="padding:14px 16px;margin-bottom:14px;border-left:3px solid ' + (pending ? '#CA8A04' : '#2E7D32') + ';background:' + (pending ? 'rgba(202,138,4,0.08)' : 'rgba(46,125,50,0.06)') + ';">' +
        '<div style="font-size:13px;font-weight:700;color:#92400E;margin-bottom:6px;">' +
        (pending ? '⚠ Variance needs classification' : 'Variance resolved') + '</div>' +
        '<div style="font-size:12px;margin-bottom:10px;">' + fmt(variance.amount) + ' vs PO at send (' + esc(variance.reason || '—') + ')</div>';
      if (pending) {
        varCard += window.cchPoVarianceResolveFormHtml(projectId, poId, docData);
        varCard += '<div style="margin-top:10px;font-size:11px;"><a href="#" onclick="event.preventDefault();navigate(\'#/project/' + escJs(projectId) + '/discrepancies\');return false;" style="color:var(--cyan);font-weight:600;">Open Bill variances for this project →</a> · ' +
          '<a href="#" onclick="event.preventDefault();navigate(\'' + escJs(typeof window.cchPoFinanceRoute === 'function' ? window.cchPoFinanceRoute('variances') : '#/vendorbills/variances') + '\');return false;" style="color:var(--cyan);font-weight:600;">Firm-wide Bill variances →</a></div>';
      } else {
        varCard += '<div style="font-size:12px;color:var(--gray-600);">Resolution: <strong>' + esc(variance.resolution) + '</strong></div>';
      }
      varCard += '</div>';
    }

    return hasBill
      ? (poLane + billLane + shipLane + billDoc + vendorInvPanel + billAttachments + varCard)
      : (poLane + billLane + shipLane + billDoc + vendorInvPanel + varCard);
  };

  window.cchPoVarianceResolveFormHtml = function(projectId, poId, docData) {
    var v = docData.variance || {};
    var reasonOpts = VARIANCE_REASONS.map(function(r) {
      return '<option value="' + r.id + '"' + (v.reason === r.id ? ' selected' : '') + '>' + esc(r.label) + '</option>';
    }).join('');
    return '<div style="display:grid;gap:8px;max-width:520px;">' +
      '<div><label class="form-label">Reason</label><select id="cchPoVarReason" class="form-input">' + reasonOpts + '</select></div>' +
      '<div><label class="form-label">Resolution</label>' +
      '<select id="cchPoVarResolution" class="form-input" onchange="cchPoVarResolutionChanged()">' +
      '<option value="billable_to_client">Bill to client</option>' +
      '<option value="absorbed">Absorbed (firm eats it)</option>' +
      '<option value="refund_due_client">Refund due to client</option>' +
      '</select></div>' +
      '<div id="cchPoVarInvoicePick" style="display:none;"><label class="form-label">Add to invoice</label><select id="cchPoVarInvoiceId" class="form-input"><option value="">Loading…</option></select></div>' +
      '<div><label class="form-label">Note</label><input id="cchPoVarNote" class="form-input" value="' + escAttr(v.resolutionNote || '') + '"></div>' +
      '<button type="button" class="btn btn-primary btn-sm" onclick="cchPoResolveVariance(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\')">Resolve variance</button>' +
      '</div>';
  };

  window.cchPoVarResolutionChanged = function() {
    var sel = document.getElementById('cchPoVarResolution');
    var box = document.getElementById('cchPoVarInvoicePick');
    if (!sel || !box) return;
    box.style.display = sel.value === 'billable_to_client' ? 'block' : 'none';
  };

  window.cchPoSendToVendor = async function(projectId, poId) {
    var ok = typeof window.cchConfirm === 'function'
      ? await window.cchConfirm('Send this PO to the vendor and lock line items?\n\nYou cannot edit PO lines after send. When the vendor\'s invoice arrives, use Receive vendor bill.', 'Send PO', { confirmText: 'Send PO', cancelText: 'Cancel' })
      : confirm('Send PO to vendor and lock line items?');
    if (!ok) return;
    try {
      var ref = firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId);
      var snap = await ref.get();
      var d = snap.data() || {};
      var total = window.cchPoDocTotal(d);
      var patch = {
        poStatus: 'sent',
        poLocked: true,
        procurementStatus: 'Waiting for Confirmation',
        poSentAt: new Date().toISOString(),
        poSentBy: window.cchPoEmailPrefix(),
        poTotalAtSend: total,
        updatedAt: new Date().toISOString()
      };
      await cchPoUpdatePoDoc(ref, patch);
      var poLabel = poNum(d);
      if (typeof window.logDocActivity === 'function') {
        await window.logDocActivity(projectId, 'purchaseOrders', poId, 'sent_to_vendor',
          'PO ' + poLabel + ' marked sent to vendor — lines locked (' + formatMoney(total) + ')');
      }
      try {
        await cchPoWriteNotification(projectId, {
          type: 'po_sent',
          poNumber: poLabel,
          poId: poId,
          projectId: projectId,
          amount: total
        });
      } catch (notifErr) {
        console.warn('[cchPoSendToVendor] notification write:', notifErr);
      }
      if (typeof window.showToast === 'function') window.showToast('PO sent to vendor — lines locked', 'success');
      if (typeof window.navigate === 'function') window.navigate(window.location.hash);
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('Send failed: ' + (e.message || e), 'PO');
    }
  };

  window.cchPoOpenAddToBillModal = function(projectId, poId) {
    window.cchPoOpenReceiveBillModal(projectId, poId, 'add');
  };

  window.cchPoOpenReceiveBillModal = async function(projectId, poId, mode) {
    var isEdit = mode === 'edit' || mode === true;
    var isAdd = mode === 'add';
    var snap = await firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
    var d = snap.data() || {};
    var poAtSend = d.poTotalAtSend != null ? d.poTotalAtSend : window.cchPoDocTotal(d);
    var b = d.bill || {};
    var num = poNum(d);
    window.__cchBillAddMode = isAdd;
    window.__cchBillExistingVendorInvoices = isAdd ? cchPoBillVendorInvoicesFromBill(b) : [];
    var viRows = isAdd ? [{ type: 'freight', amount: '', description: '' }]
      : (isEdit || b.received ? cchPoVendorInvoiceEditorRows(b) : cchPoBillVendorInvoicesFromBill({}));
    if (!viRows.length) {
      viRows = cchPoDefaultVendorInvoiceRows();
    } else if (!isAdd && !isEdit && !b.received && viRows.length === 1 &&
        cchPoVendorInvoiceSource(viRows[0].type) === 'freight' && !(parseFloat(viRows[0].amount) || 0)) {
      viRows = cchPoDefaultVendorInvoiceRows();
    }
    var billInvMeta = isAdd
      ? { vendorInvoiceNumber: '', vendorInvoiceDate: '', trackingNumber: '', trackingCarrier: '', etaDate: '', shipmentNotes: '' }
      : cchPoBillVendorInvoiceMeta(b, viRows);
    if (!isAdd && !_hasBillShipmentMeta(billInvMeta)) {
      var _singleGrp = window.cchPoVendorInvoiceGroups(d, d.items || []);
      if (_singleGrp.length === 1) {
        billInvMeta.trackingNumber = _singleGrp[0].trackingNumber || '';
        billInvMeta.trackingCarrier = _singleGrp[0].trackingCarrier || '';
        billInvMeta.etaDate = _singleGrp[0].etaDate || '';
        billInvMeta.shipmentNotes = _singleGrp[0].notes || '';
      }
    }
    var title = isAdd ? 'Add vendor invoice' : (isEdit ? 'Edit vendor bill' : 'Receive vendor bill');
    var canQb = typeof window.userCanPushToQB === 'function' && window.userCanPushToQB();
    var blurb = isAdd
      ? 'Check any <strong>new PO items</strong> to add to the bill, then add freight or fees. Use <strong>Save</strong> for Studio only, or <strong>Push to QuickBooks</strong> when ready to sync.'
      : (isEdit
        ? 'Change which PO items are on the bill, edit charges, and add tracking. <strong>Save</strong> updates Studio; <strong>Push to QuickBooks</strong> syncs the bill separately.'
        : (canQb
          ? 'Check the PO items on this vendor invoice, then add freight, tax, or other charges. <strong>Save</strong> records the bill in Studio; <strong>Push to QuickBooks</strong> when you are ready to sync.'
          : 'Check PO items on this invoice and add any additional charges.'));
    var snapshotPoLines = cchPoSnapshotPoLinesForBill(d.items || [], poAtSend);
    var poLines = snapshotPoLines.length ? snapshotPoLines : cchPoBillPoLines(b, d.items || [], poAtSend);
    window.__cchBillPoLines = poLines;
    var lockedIds = isAdd ? cchPoBillBilledLineIds(b, poLines) : [];
    window.__cchBillLockedPoLineIds = lockedIds;
    var selectedIds = isEdit
      ? cchPoBillBilledLineIds(b, poLines)
      : (isAdd ? lockedIds.slice() : poLines.map(function(l) { return l.lineId; }));
    if (!selectedIds.length && !isAdd) selectedIds = poLines.map(function(l) { return l.lineId; });
    var poItemsHtml = cchPoBillPoLinePickerHtml(poLines, selectedIds, lockedIds, poAtSend);
    var viListHtml = viRows.map(function(r) { return cchPoVendorChargeRowHtml(r); }).join('');
    var multiTrackHtml = (!isAdd && (isEdit || b.received)) ? cchPoBillMultiTrackingGroupsHtml(d, d.items || []) : '';
    var viHeaderHtml = cchPoBillVendorInvoiceHeaderHtml(billInvMeta, isAdd, !!multiTrackHtml);
    var html = '<div id="cchReceiveBillModal" style="position:fixed;inset:0;background:rgba(15,26,46,0.45);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target===this)cchPoCloseModal()">' +
      '<div style="background:#fff;max-width:720px;width:100%;padding:24px;border-radius:4px;box-shadow:0 16px 48px rgba(0,0,0,0.2);max-height:90vh;overflow:auto;" onclick="event.stopPropagation()">' +
      '<h3 style="margin:0 0 8px;font-size:18px;">' + esc(title) + ' — ' + esc(num) + '</h3>' +
      '<p style="font-size:12px;color:var(--gray-500);margin:0 0 14px;">' + blurb + '</p>' +
      poItemsHtml +
      multiTrackHtml +
      '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#B45309;margin:0 0 8px;">2. Vendor invoice &amp; additional charges</div>' +
      '<p style="font-size:11px;color:#5C6B80;margin:0 0 10px;line-height:1.45;">Enter the <strong>vendor invoice #</strong> once, then add freight, tax, price changes, or fees on separate lines (same invoice). Lines with $0 are ignored.</p>' +
      viHeaderHtml +
      '<div id="cchVendorInvoicesList">' + viListHtml + '</div>' +
      '<button type="button" class="btn btn-secondary btn-sm" style="margin:8px 0 14px;" onclick="cchPoAddVendorInvoiceRow()">+ Add charge line</button>' +
      '<div id="cchBillPreview" style="font-size:13px;padding:12px;background:rgba(27,51,82,0.04);border-radius:4px;border:1px solid rgba(27,51,82,0.1);"></div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end;margin-top:8px;flex-wrap:wrap;">' +
      '<button type="button" class="btn btn-secondary" onclick="cchPoCloseModal()">Cancel</button>' +
      cchPoReceiveBillModalActionButtons(projectId, poId, poAtSend, canQb && cchPoCanPushBillToQb()) +
      '</div></div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    window.__cchBillPoAtSend = poAtSend;
    document.querySelectorAll('#cchVendorInvoicesList .cch-vi-row').forEach(function(row) {
      cchPoRefreshPriceChangeRow(row, cchPoViPriceChangeCfg(row));
    });
    window.cchPoUpdateBillPreview(poAtSend);
  };

  window.cchPoUpdateBillPreview = function(poAtSend) {
    poAtSend = poAtSend != null ? poAtSend : (window.__cchBillPoAtSend || 0);
    var allPoLines = window.__cchBillPoLines || [];
    var selectedIds = cchPoReadBillPoLineIdsFromDom();
    if (window.__cchBillLockedPoLineIds && window.__cchBillLockedPoLineIds.length) {
      window.__cchBillLockedPoLineIds.forEach(function(id) {
        if (selectedIds.indexOf(id) < 0) selectedIds.push(id);
      });
    }
    var poSubtotal = cchPoSumPoLineAmounts(allPoLines, selectedIds);
    var subEl = document.getElementById('cchBillPoLineSubtotal');
    if (subEl) subEl.textContent = fmt(poSubtotal);
    var vendorInvoices = cchPoReadVendorInvoiceRowsFromDom();
    if (window.__cchBillAddMode && window.__cchBillExistingVendorInvoices && window.__cchBillExistingVendorInvoices.length) {
      vendorInvoices = window.__cchBillExistingVendorInvoices.concat(vendorInvoices);
    }
    var addl = vendorInvoices.reduce(function(s, r) {
      if (cchPoVendorInvoiceSource(r.type) === 'merchandise') return s;
      return s + (parseFloat(r.amount) || 0);
    }, 0);
    var billTotal = poSubtotal + addl;
    var variance = billTotal - poAtSend;
    var el = document.getElementById('cchBillPreview');
    function row(label, amt) {
      if (Math.abs(amt) < 0.01) return '';
      return '<tr><td style="padding:4px 0;color:#5C6B80;">' + (amt >= 0 ? '+ ' : '− ') + esc(label) + '</td>' +
        '<td style="text-align:right;color:' + (amt < 0 ? '#15803D' : '#B45309') + ';font-weight:600;">' + cchPoFormatBillLineAmount(amt) + '</td></tr>';
    }
    if (el) {
      var merchRows = selectedIds.map(function(id) {
        for (var i = 0; i < allPoLines.length; i++) {
          if (allPoLines[i].lineId === id) {
            return row(allPoLines[i].title || 'Item', parseFloat(allPoLines[i].amount) || 0);
          }
        }
        return '';
      }).join('');
      var billInv = cchPoReadBillVendorInvoiceMetaFromDom();
      var detailRows = vendorInvoices.map(function(r) {
        if (cchPoVendorInvoiceSource(r.type) === 'merchandise') return '';
        var lbl = r.description || cchPoVendorInvoiceTypeLabel(r.type);
        var linked = cchPoPoLineTitlesFromIds(allPoLines, r.poLineIds);
        if (linked.length) lbl += ' → ' + linked.join(', ');
        return row(lbl, parseFloat(r.amount) || 0);
      }).join('');
      var invHdr = '';
      if (billInv.vendorInvoiceNumber) {
        invHdr = '<tr><td colspan="2" style="padding:4px 0 8px;font-size:11px;color:#5C6B80;">Vendor invoice <strong>#' +
          esc(billInv.vendorInvoiceNumber) + '</strong>' +
          (billInv.vendorInvoiceDate ? ' · ' + esc(billInv.vendorInvoiceDate) : '') + '</td></tr>';
      }
      el.innerHTML =
        '<table style="width:100%;font-size:12px;border-collapse:collapse;">' +
        (merchRows || '<tr><td style="padding:4px 0;color:#9CA3AF;font-style:italic;">No PO items selected</td><td></td></tr>') +
        '<tr style="border-top:1px solid rgba(15,26,46,0.08);"><td style="padding:6px 0;font-weight:600;">Merchandise subtotal</td><td style="text-align:right;font-weight:600;">' + fmt(poSubtotal) + '</td></tr>' +
        invHdr +
        detailRows +
        (Math.abs(addl) > 0.01 ? '<tr><td style="padding:4px 0;color:#5C6B80;">Additional subtotal</td><td style="text-align:right;font-weight:600;color:#B45309;">' + cchPoFormatBillLineAmount(addl) + '</td></tr>' : '') +
        '<tr style="border-top:1px solid rgba(15,26,46,0.12);"><td style="padding:8px 0;font-weight:700;">= Vendor bill total</td><td style="text-align:right;font-weight:700;">' + fmt(billTotal) + '</td></tr>' +
        '<tr><td style="padding:4px 0;font-size:11px;color:#5C6B80;">Variance vs full PO</td><td style="text-align:right;font-size:11px;font-weight:600;color:' + (Math.abs(variance) > 0.01 ? '#B45309' : '#15803D') + ';">' + fmt(variance) + '</td></tr>' +
        '</table>';
    }
  };

  window.cchPoCloseModal = function() {
    var m = document.getElementById('cchReceiveBillModal') || document.getElementById('cchPoPayModal');
    if (m) m.remove();
  };

  window.cchPoSaveReceiveBill = async function(projectId, poId, poAtSend, pushQb) {
    var newRows = cchPoReadVendorInvoiceRowsFromDom();
    var vendorInvoices = newRows;
    if (window.__cchBillAddMode && window.__cchBillExistingVendorInvoices && window.__cchBillExistingVendorInvoices.length) {
      vendorInvoices = window.__cchBillExistingVendorInvoices.concat(newRows);
    }
    var selectedIds = cchPoReadBillPoLineIdsFromDom();
    if (window.__cchBillLockedPoLineIds && window.__cchBillLockedPoLineIds.length) {
      window.__cchBillLockedPoLineIds.forEach(function(id) {
        if (selectedIds.indexOf(id) < 0) selectedIds.push(id);
      });
    }
    var legacy = cchPoLegacyAggregatesFromVendorInvoices(vendorInvoices);
    var freight = legacy.freight;
    var tax = legacy.tax;
    var priceChange = legacy.priceChange;
    var extra = legacy.extras;
    var priceNote = legacy.priceNote;
    var extraDesc = legacy.extraTitle;
    var billInvMeta = cchPoReadBillVendorInvoiceMetaFromDom();
    var invNum = billInvMeta.vendorInvoiceNumber;
    var invDate = billInvMeta.vendorInvoiceDate;
    vendorInvoices.forEach(function(r) {
      r.vendorInvoiceNumber = invNum;
      r.vendorInvoiceDate = invDate;
    });
    var additionalSubtotal = vendorInvoices.reduce(function(s, r) {
      if (cchPoVendorInvoiceSource(r.type) === 'merchandise') return s;
      return s + (parseFloat(r.amount) || 0);
    }, 0);
    additionalSubtotal = Math.round(additionalSubtotal * 100) / 100;

    var hasPoItems = selectedIds.length > 0;
    var hasCharges = Math.abs(additionalSubtotal) > 0.01;
    if (!hasPoItems && !hasCharges) {
      if (typeof window.cchAlert === 'function') {
        await window.cchAlert('Select at least one PO item or enter at least one charge (freight, tax, etc.).', 'Vendor bill');
      }
      return;
    }

    var ref = firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId);
    var snap = await ref.get();
    var d = snap.data() || {};
    var prevBill = d.bill || {};
    var snapshotPoLines = cchPoSnapshotPoLinesForBill(d.items || [], poAtSend);
    var allPoLines = snapshotPoLines.length ? snapshotPoLines : cchPoBillPoLines(prevBill, d.items || [], poAtSend);
    var billedPoLines = allPoLines.filter(function(l) { return selectedIds.indexOf(l.lineId) >= 0; });
    var poSubtotal = cchPoSumPoLineAmounts(allPoLines, selectedIds);
    var billTotal = poSubtotal + additionalSubtotal;
    var varianceAmt = billTotal - poAtSend;
    var chargeItems = cchPoChargeItemsFromVendorInvoices(vendorInvoices, allPoLines);
    var bill = cchPoMergeBillPreserve(prevBill, {
      received: true,
      receivedAt: prevBill.receivedAt || new Date().toISOString(),
      receivedBy: prevBill.receivedBy || window.cchPoEmailPrefix(),
      vendorInvoiceNumber: invNum,
      vendorInvoiceDate: invDate,
      trackingNumber: billInvMeta.trackingNumber || '',
      trackingCarrier: billInvMeta.trackingCarrier || '',
      etaDate: billInvMeta.etaDate || '',
      shipmentNotes: billInvMeta.shipmentNotes || '',
      vendorInvoices: vendorInvoices,
      poTotalAtSend: poAtSend,
      poSubtotal: poSubtotal,
      billedPoLineIds: selectedIds,
      additionalSubtotal: additionalSubtotal,
      poLines: allPoLines,
      items: billedPoLines.concat(chargeItems),
      freight: freight,
      tax: tax,
      priceChange: priceChange,
      extras: extra,
      billTotal: billTotal,
      notes: prevBill.notes || '',
      studioUpdatedAt: new Date().toISOString()
    });

    var patch = { bill: bill, poStatus: 'bill_received', updatedAt: new Date().toISOString() };
    var trackGroupPatches = cchPoReadBillTrackingGroupsFromDom();
    var mergedGroups = cchPoMergeTrackingIntoVendorInvoiceGroups(d, d.items || [], trackGroupPatches);
    var ensuredGroups = cchPoEnsureBillInvoicesInGroups(
      Object.assign({}, d, { vendorInvoiceGroups: mergedGroups || d.vendorInvoiceGroups }),
      bill,
      d.items || []
    );
    if (ensuredGroups.length) patch.vendorInvoiceGroups = ensuredGroups;
    if (window.cchPoLifecycleStatus(d) === 'draft') {
      patch.poLocked = true;
      patch.poSentAt = d.poSentAt || new Date().toISOString();
      patch.poSentBy = d.poSentBy || window.cchPoEmailPrefix();
      patch.poTotalAtSend = poAtSend;
    }
    var reason = cchPoPickVarianceReason(chargeItems, varianceAmt);

    if (Math.abs(varianceAmt) > 0.01) {
      var def = VARIANCE_REASONS.find(function(r) { return r.id === reason; }) || VARIANCE_REASONS[0];
      patch.variance = {
        amount: Math.round(varianceAmt * 100) / 100,
        reason: reason,
        resolution: def.defaultRes === 'pending' ? 'pending' : def.defaultRes,
        resolutionNote: '',
        resolvedAt: null,
        resolvedBy: null,
        linkedClientInvoiceId: null,
        linkedClientInvoiceLineId: null
      };
      if (patch.variance.resolution === 'pending') {
        await cchPoWriteNotification(projectId, {
          type: 'variance_flagged',
          poNumber: poNum(d),
          poId: poId,
          projectId: projectId,
          amount: patch.variance.amount
        });
      }
    } else {
      patch.variance = null;
    }

    try {
      await cchPoUpdatePoDoc(ref, patch);
      window._vendorBillsFilter = 'open';
      window._vendorBillsTab = 'bills';
      window.cchPoCloseModal();
      window.__cchBillAddMode = false;
      window.__cchBillExistingVendorInvoices = [];
      window.__cchBillLockedPoLineIds = [];

      var canQbPush = cchPoCanPushBillToQb();
      var doPush = pushQb === true && canQbPush;
      if (doPush) {
        if (typeof window.showToast === 'function') {
          window.showToast(prevBill.qbBillId ? 'Bill saved — syncing to QuickBooks…' : 'Bill saved — pushing to QuickBooks…', 'success');
        }
        var qbResult = await window.cchPoPushBillToQB(projectId, poId, null, { skipConfirm: true });
        if (qbResult && qbResult.ok && typeof window.showToast === 'function') {
          window.showToast(
            qbResult.message || (prevBill.qbBillId ? 'QuickBooks Bill updated' : 'QuickBooks Bill created'),
            'success'
          );
        }
      } else if (typeof window.showToast === 'function') {
        var stagingNote = (typeof window.cchPoQbBillPushAllowed === 'function' && !window.cchPoQbBillPushAllowed())
          ? ' (Push to QuickBooks on production only)'
          : '';
        var varNote = (patch.variance && Math.abs(parseFloat(patch.variance.amount) || 0) > 0.01)
          ? ' · Freight/tax variance → Bill variances tab; pay vendor on Vendor bills tab'
          : ' · See Vendor bills in the sidebar';
        window.showToast('Vendor bill saved' + stagingNote + varNote, 'success');
      }
      await window.cchPoAfterFulfillmentStatusSaved(projectId, poId);
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('Save failed: ' + (e.message || e), 'Bill');
    }
  };

  function cchPoBuildPaymentPatch(doc, payments, lastPayment) {
    doc = doc || {};
    payments = payments || [];
    var billTotal = window.cchPoVendorBillTotal(doc);
    var totalPaid = payments.reduce(function(s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
    totalPaid = Math.round(totalPaid * 100) / 100;
    var balance = Math.round((billTotal - totalPaid) * 100) / 100;
    var fullyPaid = billTotal > 0.01 && totalPaid >= billTotal - 0.02;
    var patch = {
      payments: payments,
      paidAmount: totalPaid,
      paymentCount: payments.length,
      balance: balance,
      updatedAt: new Date().toISOString()
    };
    if (lastPayment) {
      patch.paymentRecorded = {
        amount: lastPayment.amount,
        method: lastPayment.method,
        recordedAt: lastPayment.recordedAt || new Date().toISOString(),
        recordedBy: window.cchPoEmailPrefix(),
        referenceNumber: lastPayment.reference || lastPayment.note || '',
        notes: lastPayment.note || ''
      };
    }
    if (fullyPaid) {
      patch.poStatus = 'paid';
      patch.paymentStatus = 'paid';
    } else if (totalPaid > 0.02) {
      patch.poStatus = 'bill_received';
      patch.paymentStatus = 'partial';
    } else if (doc.bill && doc.bill.received) {
      patch.poStatus = 'bill_received';
      patch.paymentStatus = 'unpaid';
    }
    return patch;
  }

  /** Applied payments on PO view rail — with edit/delete when bill received. */
  window.cchPoAppliedPaymentsRailHtml = function(paySummary, projectId, poId) {
    paySummary = paySummary || { rows: [], totalPaid: 0 };
    if (!paySummary.rows || !paySummary.rows.length) return '';
    var html = '';
    paySummary.rows.forEach(function(p, i) {
      if ((parseFloat(p.amount) || 0) <= 0) return;
      var ref = p.reference || p.qbPaymentId || '';
      var invTag = p.vendorInvoiceNumber ? String(p.vendorInvoiceNumber).trim() : '';
      var methodLabel = p.method || (p.source === 'QuickBooks' ? 'QuickBooks' : 'Payment');
      var bits = [];
      if (invTag) {
        bits.push('<span style="font-weight:700;color:#1B3352;">#' + esc(invTag) + '</span>');
        bits.push(window.cchPoVendorInvoicePayStatusBadgeHtml(parseFloat(p.amount) || 0, 0));
      } else {
        bits.push('<span style="font-size:10px;color:#B45309;font-weight:600;">No invoice #</span>');
      }
      if (p.date) bits.push(typeof window.formatDate === 'function' ? esc(window.formatDate(p.date)) : esc(String(p.date).slice(0, 10)));
      bits.push(esc(methodLabel));
      if (ref) bits.push('<span style="font-family:var(--font-mono);font-size:10px;">' + esc(ref) + '</span>');
      var editBtns = '';
      if (!p.synthetic && projectId && poId) {
        editBtns = '<span style="display:flex;gap:4px;flex-shrink:0;margin-left:6px;">' +
          '<button type="button" class="btn btn-secondary btn-sm" style="font-size:9px;padding:1px 5px;" onclick="event.stopPropagation();cchPoOpenPaymentModal(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',' + i + ')" title="Edit payment">Edit</button>' +
          '<button type="button" class="btn btn-sm" style="font-size:9px;padding:1px 5px;color:#B91C1C;border-color:rgba(185,28,28,0.35);" onclick="event.stopPropagation();cchPoDeletePayment(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\',' + i + ')" title="Remove payment">×</button>' +
          '</span>';
      }
      html += '<div class="cch-inv-pay-row" style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;margin-bottom:4px;">' +
        '<span style="min-width:0;flex:1;">' + bits.join(' · ') + '</span>' +
        '<span style="display:flex;align-items:center;gap:4px;flex-shrink:0;">' +
          '<strong style="color:#2E7D32;font-family:var(--font-mono);">' + fmt(p.amount) + '</strong>' + editBtns +
        '</span></div>';
    });
    return html;
  };

  window.cchPoDeletePayment = async function(projectId, poId, idx) {
    var ok = typeof window.cchConfirm === 'function'
      ? await window.cchConfirm('Remove this vendor payment from the PO?', 'Remove payment', { confirmText: 'Remove', cancelText: 'Cancel' })
      : confirm('Remove this vendor payment?');
    if (!ok) return;
    try {
      var ref = firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId);
      var snap = await ref.get();
      var d = snap.data() || {};
      var payments = (d.payments || []).slice();
      if (idx < 0 || idx >= payments.length) return;
      payments.splice(idx, 1);
      await cchPoUpdatePoDoc(ref, cchPoBuildPaymentPatch(d, payments));
      if (typeof window.showToast === 'function') window.showToast('Payment removed', 'success');
      await window.cchPoAfterFulfillmentStatusSaved(projectId, poId);
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert(e.message || e, 'Payment');
    }
  };

  window.cchPoOpenPaymentModal = async function(projectId, poId, editIdx, preselectInvNum) {
    var snap = await firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
    if (!snap.exists) return;
    var d = snap.data() || {};
    if (!d.bill || !d.bill.received) {
      if (typeof window.cchAlert === 'function') {
        await window.cchAlert('Receive the vendor bill first (PO + additional charges), then record payment.', 'Vendor payment');
      }
      return;
    }
    var poAtSend = d.bill.poTotalAtSend != null ? d.bill.poTotalAtSend : (d.poTotalAtSend != null ? d.poTotalAtSend : window.cchPoDocTotal(d));
    var num = poNum(d);
    var editing = typeof editIdx === 'number' && editIdx >= 0;
    var existing = editing ? ((d.payments || [])[editIdx] || null) : null;
    var poItems = d.items || [];
    var invGroups = window.cchPoVendorInvoiceGroupsDisplay(d, poItems);
    var lineMeta = cchPoPoLineMetaList(poItems);
    window.__cchPoPayDoc = d;
    window.__cchPoPayPoAtSend = poAtSend;
    window.__cchPoPayInvGroups = invGroups.map(function(g) {
      var inv = String(g.vendorInvoiceNumber || '').trim();
      var poLineIds = g.poLineIds || [];
      var total = cchPoVendorInvoiceGroupTotal(d.bill, inv, poLineIds, lineMeta);
      var bal = cchPoVendorInvoiceBalanceDue(d.bill, inv, poLineIds, lineMeta, d.payments || [], editing ? editIdx : null);
      return {
        vendorInvoiceNumber: inv,
        poLineIds: poLineIds,
        total: total,
        balanceDue: bal
      };
    }).filter(function(g) { return g.vendorInvoiceNumber; });

    var selectedInv = '';
    if (existing && existing.vendorInvoiceNumber) {
      selectedInv = String(existing.vendorInvoiceNumber).trim();
    } else if (preselectInvNum) {
      selectedInv = String(preselectInvNum).trim();
    } else if (window.__cchPoPayInvGroups.length === 1) {
      selectedInv = window.__cchPoPayInvGroups[0].vendorInvoiceNumber;
    } else {
      var withBal = window.__cchPoPayInvGroups.find(function(g) { return g.balanceDue > 0.02; });
      selectedInv = withBal ? withBal.vendorInvoiceNumber : (window.__cchPoPayInvGroups[0] ? window.__cchPoPayInvGroups[0].vendorInvoiceNumber : '');
    }

    var selectedGroup = window.__cchPoPayInvGroups.find(function(g) {
      return cchPoNormVendorInvNum(g.vendorInvoiceNumber) === cchPoNormVendorInvNum(selectedInv);
    });
    var invDue = selectedGroup ? selectedGroup.balanceDue : window.cchPoAmountDue(d);
    var payAmt = existing ? (parseFloat(existing.amount) || 0) : (invDue > 0.02 ? invDue : '');
    var payMethod = existing ? (existing.method || 'Check') : 'Check';
    var payRef = existing ? (existing.reference || existing.note || '') : '';
    var payDate = existing && existing.date ? String(existing.date).slice(0, 10) : new Date().toISOString().split('T')[0];
    window._cchPoPaymentEditIdx = editing ? editIdx : null;

    var invSelectHtml = '';
    if (window.__cchPoPayInvGroups.length >= 1) {
      invSelectHtml = cchPoVendorInvoicePayPickerHtml(window.__cchPoPayInvGroups, selectedInv, editing);
    }

    var unallocTotal = cchPoUnallocatedPaymentTotal(d.payments || []);
    var unallocBanner = '';
    if (unallocTotal > 0.01) {
      unallocBanner = '<div style="margin-bottom:12px;padding:10px 12px;background:rgba(180,83,9,0.08);border:1px solid rgba(180,83,9,0.22);border-radius:4px;font-size:11px;color:#92400E;line-height:1.45;">' +
        '<strong>Legacy payment:</strong> ' + fmt(unallocTotal) + ' recorded without a vendor invoice #. ' +
        'Per-invoice balances may look unpaid until you <strong>edit</strong> that payment and assign an invoice # (or split into separate payments).</div>';
    }

    var invFilter = selectedInv ? {
      vendorInvoiceNumber: selectedInv,
      poLineIds: selectedGroup ? selectedGroup.poLineIds : [],
      excludePaymentIdx: editing ? editIdx : null
    } : null;

    var title = editing ? 'Edit vendor payment' : 'Record vendor payment';
    var saveBtn = editing ? 'Save payment' : 'Record payment';
    var html = '<div id="cchPoPayModal" style="position:fixed;inset:0;background:rgba(15,26,46,0.45);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target===this)cchPoCloseModal()">' +
      '<div style="background:#fff;padding:24px;max-width:520px;width:100%;border-radius:4px;box-shadow:0 16px 48px rgba(0,0,0,0.2);max-height:90vh;overflow:auto;" onclick="event.stopPropagation()">' +
      '<h3 style="margin:0 0 8px;">' + title + ' — ' + esc(num) + '</h3>' +
      '<p style="font-size:11px;color:#5C6B80;margin:0 0 12px;line-height:1.45;"><strong>Studio tracking only</strong> — this payment is never sent to QuickBooks. Pay or match in QuickBooks separately; Studio updates when QB confirms.</p>' +
      unallocBanner +
      invSelectHtml +
      '<div id="cchPoPayBreakdown">' + cchPoBillBreakdownTableHtml(d.bill, poAtSend, d, invFilter) + '</div>' +
      '<div style="display:grid;gap:8px;margin-top:14px;">' +
      '<div><label class="form-label">Payment date</label><input type="date" id="cchPoPayDate" class="form-input" value="' + escAttr(payDate) + '"></div>' +
      '<div><label class="form-label">Payment amount</label><input type="number" step="0.01" id="cchPoPayAmt" class="form-input" value="' + (payAmt !== '' ? payAmt : '') + '"></div>' +
      '<div><label class="form-label">Method</label><select id="cchPoPayMethod" class="form-input">' +
        ['Check', 'Credit Card', 'ACH/Wire', 'Zelle', 'Deposit', 'Other'].map(function(m) {
          return '<option value="' + escAttr(m) + '"' + (payMethod === m ? ' selected' : '') + '>' + esc(m) + '</option>';
        }).join('') +
      '</select></div>' +
      '<div><label class="form-label">Reference / note</label><input id="cchPoPayRef" class="form-input" placeholder="Check #, confirmation, etc." value="' + escAttr(payRef) + '"></div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
      '<button type="button" class="btn btn-secondary" onclick="cchPoCloseModal()">Cancel</button>' +
      '<button type="button" class="btn btn-primary" onclick="cchPoSaveRecordedPayment(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\')">' + saveBtn + '</button>' +
      '</div></div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
  };

  window.cchPoPaymentModalInvChanged = function() {
    var breakdown = document.getElementById('cchPoPayBreakdown');
    var amtEl = document.getElementById('cchPoPayAmt');
    if (!breakdown) return;
    var invNum = cchPoReadPayModalInvNum();
    var hidden = document.getElementById('cchPoPayInv');
    if (hidden) hidden.value = invNum;
    var d = window.__cchPoPayDoc || {};
    var poAtSend = window.__cchPoPayPoAtSend || 0;
    var groups = window.__cchPoPayInvGroups || [];
    var g = groups.find(function(x) {
      return cchPoNormVendorInvNum(x.vendorInvoiceNumber) === cchPoNormVendorInvNum(invNum);
    });
    var editIdx = (typeof window._cchPoPaymentEditIdx === 'number' && window._cchPoPaymentEditIdx >= 0)
      ? window._cchPoPaymentEditIdx : null;
    var invFilter = invNum ? {
      vendorInvoiceNumber: invNum,
      poLineIds: g ? g.poLineIds : [],
      excludePaymentIdx: editIdx
    } : null;
    breakdown.innerHTML = cchPoBillBreakdownTableHtml(d.bill || {}, poAtSend, d, invFilter);
    if (amtEl && invNum) {
      var lineMeta = cchPoPoLineMetaList(d.items || []);
      var bal = cchPoVendorInvoiceBalanceDue(d.bill || {}, invNum, g ? g.poLineIds : [], lineMeta, d.payments || [], editIdx);
      if (bal > 0.02) amtEl.value = bal;
    }
  };

  window.cchPoRecordVendorPaymentModal = window.cchPoOpenPaymentModal;

  window.cchPoPushBillToQB = async function(projectId, poId, btnEl, opts) {
    if (typeof window.cchPoQbBillPushAllowed === 'function' && !window.cchPoQbBillPushAllowed()) {
      if (typeof window.cchAlert === 'function') {
        await window.cchAlert('QuickBooks bill push is disabled on staging.\n\nReceive and edit vendor bills here. Push to QuickBooks from production (cch-platform.web.app).', 'Staging');
      }
      return { ok: false, cancelled: true };
    }
    opts = opts || {};
    var snapPre = await firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
    var billPre = (snapPre.data() || {}).bill || {};
    var isUpdate = !!billPre.qbBillId;
    var blRef = typeof window.cchPoQbBillDocNumberFromPo === 'function'
      ? window.cchPoQbBillDocNumberFromPo(snapPre.data() || {})
      : '';
    if (!opts.skipConfirm) {
      var confirmMsg = isUpdate
        ? 'Update the existing QuickBooks Bill for this PO?\n\nUpdates bill lines and amount only — does not mark paid or send Studio payment notes. Pay or match in QuickBooks separately.'
        : 'Push this vendor bill to QuickBooks?\n\nCreates or links QB Bill ' + (blRef || 'BL-…') + ' (open balance for bank/card matching). Studio payments are never sent — pay in QuickBooks when ready.';
      if (!(typeof window.cchConfirm === 'function'
        ? await window.cchConfirm(confirmMsg, isUpdate ? 'Sync bill to QuickBooks' : 'Push bill to QuickBooks', { confirmText: isUpdate ? 'Sync bill' : 'Push bill' })
        : confirm(confirmMsg))) return { ok: false, cancelled: true };
    }

    var btn = btnEl;
    var orig = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = isUpdate ? '⏳ Syncing…' : '⏳ Pushing bill…'; }
    try {
      if (!firebase.auth().currentUser) {
        if (typeof window.cchAlert === 'function') await window.cchAlert('Sign in to CCH Studio first.', 'QuickBooks');
        return { ok: false };
      }
      var pushFn = firebase.app().functions('us-central1').httpsCallable('pushBillToQB');
      var result = await pushFn({ projectId: projectId, docId: poId });
      var rd = result && result.data;
      if (rd && rd.success) {
        var msg = rd.message || (rd.updated ? 'QuickBooks Bill updated' : 'Bill pushed to QuickBooks');
        await cchPoStampQbPushOutcome(projectId, poId, null);
        if (!opts.skipConfirm && typeof window.showToast === 'function') window.showToast(msg, 'success');
        if (btn) { btn.innerHTML = '✅ Bill in QB'; }
        if (!opts.skipConfirm && typeof window.navigate === 'function') window.navigate(window.location.hash);
        return { ok: true, message: msg, qbBillId: rd.qbBillId };
      }
      var failMsg = (rd && rd.message) || 'QuickBooks did not confirm the bill push.';
      await cchPoStampQbPushOutcome(projectId, poId, failMsg);
      if (typeof window.cchAlert === 'function') {
        await window.cchAlert(failMsg, 'QuickBooks');
      }
      if (btn) { btn.innerHTML = orig; btn.disabled = false; }
      if (!opts.skipConfirm && typeof window.navigate === 'function') window.navigate(window.location.hash);
      return { ok: false };
    } catch (e) {
      var errMsg = (e && e.message) || String(e);
      await cchPoStampQbPushOutcome(projectId, poId, errMsg);
      if (typeof window.cchAlert === 'function') await window.cchAlert(errMsg, 'Push bill to QuickBooks');
      if (btn) { btn.innerHTML = orig; btn.disabled = false; }
      if (!opts.skipConfirm && typeof window.navigate === 'function') window.navigate(window.location.hash);
      return { ok: false, error: e };
    }
  };

  /** Record the outcome of a QB bill push on the PO so list dots can show green (ok) / red (failed). */
  async function cchPoStampQbPushOutcome(projectId, poId, errorMsg) {
    try {
      var ref = firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId);
      if (errorMsg) {
        await ref.update({
          'bill.qbPushError': String(errorMsg).slice(0, 300),
          'bill.qbPushErrorAt': new Date().toISOString()
        });
      } else {
        await ref.update({
          'bill.qbPushError': firebase.firestore.FieldValue.delete(),
          'bill.qbPushErrorAt': firebase.firestore.FieldValue.delete()
        });
      }
    } catch (_eStamp) {
      console.warn('[cchPoStampQbPushOutcome] could not record QB push outcome', _eStamp);
    }
  }

  window.cchPoSaveRecordedPayment = async function(projectId, poId) {
    var amt = parseFloat(document.getElementById('cchPoPayAmt').value) || 0;
    if (amt <= 0) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('Enter a payment amount.', 'Vendor payment');
      return;
    }
    try {
      var ref = firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId);
      var snap = await ref.get();
      var d = snap.data() || {};
      var payDate = String(document.getElementById('cchPoPayDate') && document.getElementById('cchPoPayDate').value || '').trim()
        || new Date().toISOString().split('T')[0];
      var invEl = document.getElementById('cchPoPayInv');
      var invNum = cchPoReadPayModalInvNum();
      if (invEl && invNum) invEl.value = invNum;
      if ((window.__cchPoPayInvGroups || []).length && !invNum) {
        if (typeof window.cchAlert === 'function') {
          await window.cchAlert('Select a vendor invoice to pay.', 'Vendor payment');
        }
        return;
      }
      var editIdx = (typeof window._cchPoPaymentEditIdx === 'number' && window._cchPoPaymentEditIdx >= 0)
        ? window._cchPoPaymentEditIdx : null;
      var payment = {
        id: 'pay_' + Date.now(),
        amount: amt,
        date: payDate,
        method: document.getElementById('cchPoPayMethod').value,
        note: document.getElementById('cchPoPayRef').value || '',
        reference: document.getElementById('cchPoPayRef').value || '',
        recordedAt: new Date().toISOString(),
        source: 'po_bill_variance'
      };
      if (invNum) payment.vendorInvoiceNumber = invNum;
      var payments = (d.payments || []).slice();
      if (editIdx != null && payments[editIdx]) {
        payment.id = payments[editIdx].id || payment.id;
        payment.recordedAt = payments[editIdx].recordedAt || payment.recordedAt;
        payments[editIdx] = Object.assign({}, payments[editIdx], payment, { updatedAt: new Date().toISOString() });
      } else {
        payments = payments.concat([payment]);
      }
      window._cchPoPaymentEditIdx = null;
      var patch = cchPoBuildPaymentPatch(d, payments, payment);
      await cchPoUpdatePoDoc(ref, patch);
      window.cchPoCloseModal();
      if (typeof window.showToast === 'function') {
        window.showToast((editIdx != null ? 'Vendor payment updated' : 'Vendor payment recorded') + ' in Studio only — not sent to QuickBooks', 'success');
      }
      await window.cchPoAfterFulfillmentStatusSaved(projectId, poId);
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert(e.message || e, 'Payment');
    }
  };

  window.cchPoLoadInvoiceOptionsForVariance = async function(projectId, poId) {
    var sel = document.getElementById('cchPoVarInvoiceId');
    if (!sel) return;
    try {
      var snap = await firebase.firestore().collection('boards').doc(projectId).collection('invoices').get();
      var opts = '<option value="">— Select invoice —</option>';
      snap.forEach(function(d) {
        var inv = d.data() || {};
        var st = String(inv.status || '').toLowerCase();
        if (st === 'void' || st === 'voided') return;
        opts += '<option value="' + escAttr(d.id) + '">' + esc(inv.invoiceNum || inv.number || d.id.slice(0, 8)) + ' (' + esc(inv.status || 'Draft') + ')</option>';
      });
      sel.innerHTML = opts;
    } catch (_e) {
      sel.innerHTML = '<option value="">Could not load invoices</option>';
    }
  };

  window.cchPoResolveVariance = async function(projectId, poId) {
    var reason = document.getElementById('cchPoVarReason').value;
    var resolution = document.getElementById('cchPoVarResolution').value;
    var note = document.getElementById('cchPoVarNote').value || '';
    var invId = document.getElementById('cchPoVarInvoiceId') && document.getElementById('cchPoVarInvoiceId').value;

    try {
      var poRef = firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId);
      var poSnap = await poRef.get();
      var po = poSnap.data() || {};
      var variance = po.variance || {};
      var linkedLineId = null;

      if (resolution === 'billable_to_client' && invId) {
        var invRef = firebase.firestore().collection('boards').doc(projectId).collection('invoices').doc(invId);
        var invSnap = await invRef.get();
        var inv = invSnap.data() || {};
        var items = (inv.items || []).slice();
        linkedLineId = 'var_' + Date.now();
        var amt = parseFloat(variance.amount) || 0;
        items.push({
          id: linkedLineId,
          title: 'PO variance — ' + poNum(po) + ' (' + reason + ')',
          description: note || 'Vendor bill variance',
          qty: 1,
          amount: amt,
          cost: amt,
          category: 'Freight',
          expenseType: 'freight',
          taxable: false,
          room: 'General'
        });
        await invRef.update({ items: items, updatedAt: new Date().toISOString() });
      }

      await poRef.update({
        variance: Object.assign({}, variance, {
          reason: reason,
          resolution: resolution,
          resolutionNote: note,
          resolvedAt: new Date().toISOString(),
          resolvedBy: window.cchPoEmailPrefix(),
          linkedClientInvoiceId: invId || null,
          linkedClientInvoiceLineId: linkedLineId
        }),
        updatedAt: new Date().toISOString()
      });

      if (typeof window.showToast === 'function') window.showToast('Variance resolved', 'success');
      if (typeof window.navigate === 'function') window.navigate(window.location.hash);
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert(e.message || e, 'Variance');
    }
  };

  function cchPoVarianceReasonLabel(id) {
    var hit = VARIANCE_REASONS.find(function(r) { return r.id === id; });
    return hit ? hit.label : (id || '—');
  }

  function cchPoVarianceReadyToBill(v) {
    v = v || {};
    if (v.linkedClientInvoiceId) return false;
    var res = String(v.resolution || 'pending');
    return res === 'pending' || res === 'billable_to_client';
  }

  function cchPoVarianceChargeSummary(bill) {
    bill = bill || {};
    if (!Array.isArray(bill.vendorInvoices) || !bill.vendorInvoices.length) return '';
    return bill.vendorInvoices.filter(function(r) {
      return Math.abs(parseFloat(r.amount) || 0) > 0.01;
    }).map(function(r) {
      var lbl = r.description || cchPoVendorInvoiceTypeLabel(r.type);
      if (r.vendorInvoiceNumber) lbl += ' #' + r.vendorInvoiceNumber;
      return lbl;
    }).join('; ');
  }

  function cchPoVarianceRowKey(r) {
    return (r.projectId || '') + '_' + (r.poId || '');
  }

  function cchPoApplyVarianceRowFilter(rows, filter) {
    if (filter === 'ready_to_bill') return rows.filter(function(r) { return r.readyToBill; });
    if (filter === 'all') return rows;
    if (filter === 'on_invoice') return rows.filter(function(r) { return !!r.invoiceId; });
    return rows.filter(function(r) { return r.resolution === filter; });
  }

  function cchPoVarianceStatusLabel(r) {
    if (r.invoiceId) return 'On invoice';
    if (r.resolution === 'billable_to_client') return 'Billable';
    if (r.resolution === 'pending') return 'Pending';
    return r.resolution || '—';
  }

  async function cchPoInvoiceSelectOptionsHtml(projectId) {
    if (!projectId) return '<option value="">— Select variances from one project —</option>';
    var opts = '<option value="">— Select client invoice —</option>';
    try {
      var invSnap = await firebase.firestore().collection('boards').doc(projectId).collection('invoices').get();
      invSnap.forEach(function(d) {
        var inv = d.data() || {};
        var st = String(inv.status || '').toLowerCase();
        if (st === 'void' || st === 'voided') return;
        opts += '<option value="' + escAttr(d.id) + '">' + esc(inv.invoiceNum || inv.number || d.id.slice(0, 8)) +
          ' (' + esc(inv.status || 'Draft') + ')</option>';
      });
    } catch (_e) {
      opts = '<option value="">Could not load invoices</option>';
    }
    return opts;
  }

  function cchPoVarianceFilterChipsHtml(activeFilter, refreshHandler) {
    return ['ready_to_bill', 'all', 'pending', 'billable_to_client', 'on_invoice', 'absorbed'].map(function(f) {
      var labels = {
        ready_to_bill: 'Ready to bill',
        all: 'All',
        pending: 'Pending',
        billable_to_client: 'Billable',
        on_invoice: 'On invoice',
        absorbed: 'Absorbed'
      };
      return '<button type="button" class="btn btn-sm ' + (activeFilter === f ? 'btn-primary' : 'btn-secondary') + '" style="margin-right:6px;margin-bottom:6px;" onclick="' + refreshHandler + '(\'' + f + '\')">' + labels[f] + '</button>';
    }).join('');
  }

  function cchPoBuildVarianceTableRowsHtml(rows, showProject) {
    if (!rows.length) {
      return '<tr><td colspan="' + (showProject ? 10 : 9) + '" style="padding:24px;text-align:center;color:var(--gray-500);">No variances in this filter.</td></tr>';
    }
    return rows.map(function(r) {
      var canSelect = r.readyToBill;
      var invCell = r.invoiceId
        ? '<a href="#" onclick="event.preventDefault();event.stopPropagation();navigate(\'#/project/' + escJs(r.projectId) + '/invoice/' + escJs(r.invoiceId) + '\')" style="color:#00796B;font-weight:600;">View</a>'
        : '—';
      var detail = r.chargeSummary
        ? '<div style="font-size:10px;color:#9CA3AF;margin-top:2px;">' + esc(r.chargeSummary) + '</div>' : '';
      return '<tr>' +
        '<td style="padding:8px;width:36px;" onclick="event.stopPropagation()">' +
          (canSelect
            ? '<input type="checkbox" class="cch-var-batch-cb" value="' + escAttr(r.poId) + '" data-project-id="' + escAttr(r.projectId) + '" data-amt="' + escAttr(String(r.variance)) + '" onchange="cchPoVarianceTabUpdateSelection()" style="accent-color:var(--gold);">'
            : '') +
        '</td>' +
        (showProject
          ? '<td style="padding:8px;font-size:12px;"><a href="#" onclick="event.preventDefault();navigate(\'#/project/' + escJs(r.projectId) + '\')" style="color:#00796B;font-weight:600;">' + esc(r.projectName || r.projectId) + '</a></td>'
          : '') +
        '<td style="padding:8px;font-weight:600;cursor:pointer;" onclick="navigate(\'#/project/' + escJs(r.projectId) + '/po/' + escJs(r.poId) + '\')">' + esc(r.poNumber) + detail + '</td>' +
        '<td style="padding:8px;">' + esc(r.vendor) + '</td>' +
        '<td style="padding:8px;text-align:right;">' + fmt(r.ordered) + '</td>' +
        '<td style="padding:8px;text-align:right;">' + fmt(r.billed) + '</td>' +
        '<td style="padding:8px;text-align:right;font-weight:600;color:#B45309;">' + fmt(r.variance) + '</td>' +
        '<td style="padding:8px;">' + esc(cchPoVarianceReasonLabel(r.reason)) + '</td>' +
        '<td style="padding:8px;">' + esc(cchPoVarianceStatusLabel(r)) + '</td>' +
        '<td style="padding:8px;">' + invCell + '</td></tr>';
    }).join('');
  }

  window.cchPoLoadVarianceInvoiceSelect = async function(projectId) {
    var sel = document.getElementById('cchVarBatchInvoiceId');
    if (!sel) return;
    sel.innerHTML = '<option value="">Loading…</option>';
    sel.innerHTML = await cchPoInvoiceSelectOptionsHtml(projectId);
  };

  window.cchPoVarianceTabUpdateSelection = function() {
    var boxes = document.querySelectorAll('.cch-var-batch-cb');
    var sum = 0;
    var n = 0;
    var projectIds = {};
    boxes.forEach(function(cb) {
      if (!cb.checked) return;
      n++;
      sum += parseFloat(cb.getAttribute('data-amt')) || 0;
      var pid = cb.getAttribute('data-project-id');
      if (pid) projectIds[pid] = true;
    });
    var pids = Object.keys(projectIds);
    var el = document.getElementById('cchVarBatchSummary');
    if (el) {
      if (!n) el.textContent = 'None selected';
      else if (pids.length > 1) el.textContent = n + ' selected · ' + fmt(sum) + ' · pick one project at a time';
      else el.textContent = n + ' selected · ' + fmt(sum);
    }
    var btn = document.getElementById('cchVarBatchAddBtn');
    if (btn) btn.disabled = !n || pids.length > 1;
    if (pids.length === 1 && typeof window.cchPoLoadVarianceInvoiceSelect === 'function') {
      window.cchPoLoadVarianceInvoiceSelect(pids[0]);
    }
  };

  window.cchPoVarianceTabSelectAll = function(checked) {
    document.querySelectorAll('.cch-var-batch-cb').forEach(function(cb) {
      cb.checked = !!checked;
    });
    window.cchPoVarianceTabUpdateSelection();
  };

  window.cchPoBatchAddVariancesToInvoice = async function(projectIdArg) {
    var invSel = document.getElementById('cchVarBatchInvoiceId');
    var invId = invSel && invSel.value;
    if (!invId) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('Choose a client invoice first.', 'Bill variances');
      return;
    }
    var checked = Array.prototype.slice.call(document.querySelectorAll('.cch-var-batch-cb:checked'));
    if (!checked.length) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('Check at least one variance to bill.', 'Bill variances');
      return;
    }
    var projectIds = {};
    checked.forEach(function(cb) {
      var pid = cb.getAttribute('data-project-id') || projectIdArg;
      if (pid) projectIds[pid] = true;
    });
    var pids = Object.keys(projectIds);
    var projectId = projectIdArg || (pids.length === 1 ? pids[0] : '');
    if (!projectId || pids.length > 1) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('Select variances from a single project.', 'Bill variances');
      return;
    }
    var rowsByKey = {};
    (window.__cchVarBatchRows || []).forEach(function(r) { rowsByKey[cchPoVarianceRowKey(r)] = r; });

    var btn = document.getElementById('cchVarBatchAddBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }
    try {
      var invRef = firebase.firestore().collection('boards').doc(projectId).collection('invoices').doc(invId);
      var invSnap = await invRef.get();
      if (!invSnap.exists) throw new Error('Invoice not found');
      var inv = invSnap.data() || {};
      var items = (inv.items || []).slice();
      var now = new Date().toISOString();
      var prefix = window.cchPoEmailPrefix();

      for (var i = 0; i < checked.length; i++) {
        var poId = checked[i].value;
        var rowPid = checked[i].getAttribute('data-project-id') || projectId;
        var row = rowsByKey[rowPid + '_' + poId];
        if (!row) continue;
        var poRef = firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId);
        var poSnap = await poRef.get();
        var po = poSnap.data() || {};
        var variance = po.variance || {};
        if (variance.linkedClientInvoiceId) continue;

        var linkedLineId = 'var_' + Date.now() + '_' + i;
        var amt = parseFloat(variance.amount) || parseFloat(row.variance) || 0;
        var reasonLbl = cchPoVarianceReasonLabel(variance.reason || row.reason);
        var desc = variance.resolutionNote || row.chargeSummary || 'Vendor bill variance';
        items.push({
          id: linkedLineId,
          title: 'PO ' + (row.poNumber || poNum(po)) + ' — ' + reasonLbl + (row.vendor ? ' (' + row.vendor + ')' : ''),
          description: desc,
          qty: 1,
          amount: amt,
          cost: amt,
          category: 'Freight',
          expenseType: 'freight',
          taxable: false,
          room: 'General',
          source: 'po_bill_variance',
          poId: poId,
          poNumber: row.poNumber || poNum(po)
        });

        await poRef.update({
          variance: Object.assign({}, variance, {
            resolution: 'billable_to_client',
            resolvedAt: now,
            resolvedBy: prefix,
            linkedClientInvoiceId: invId,
            linkedClientInvoiceLineId: linkedLineId
          }),
          updatedAt: now
        });
      }

      await invRef.update({ items: items, updatedAt: now });
      if (typeof window.showToast === 'function') {
        window.showToast(checked.length + ' variance line(s) added to invoice', 'success');
      }
      if (typeof window.renderProjectDiscrepanciesTab === 'function' && window._currentProject) {
        await window.renderProjectDiscrepanciesTab(document.getElementById('projectTabContent'), window._currentProject);
      } else if (typeof window.renderDiscrepancyReportPage === 'function') {
        await window.renderDiscrepancyReportPage();
      }
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert(e.message || e, 'Bill variances');
      if (btn) { btn.disabled = false; btn.textContent = 'Add to client invoice'; }
    }
  };

  /** Firm-wide + project discrepancy rows */
  window.cchPoCollectVarianceRows = async function(projectIdFilter) {
    var boards = await cchPoBoardList(projectIdFilter);
    var chunks = await Promise.all(boards.map(async function(board) {
      var bid = board.id;
      var bname = board.name || bid;
      var rows = [];
      try {
        var pos = await firebase.firestore().collection('boards').doc(bid).collection('purchaseOrders').get();
        pos.forEach(function(d) {
          var p = d.data() || {};
          var v = p.variance;
          if (!v || Math.abs(parseFloat(v.amount) || 0) < 0.01) return;
          var poAt = (p.bill && p.bill.poTotalAtSend != null) ? p.bill.poTotalAtSend : window.cchPoDocTotal(p);
          var billed = (p.bill && p.bill.billTotal != null) ? p.bill.billTotal : poAt;
          rows.push({
            projectId: bid,
            projectName: bname,
            poId: d.id,
            poNumber: poNum(p),
            vendor: p.vendor || '',
            ordered: poAt,
            billed: billed,
            variance: parseFloat(v.amount) || 0,
            reason: v.reason || '',
            resolution: v.resolution || 'pending',
            invoiceId: v.linkedClientInvoiceId || '',
            chargeSummary: cchPoVarianceChargeSummary(p.bill),
            readyToBill: cchPoVarianceReadyToBill(v)
          });
        });
      } catch (_poErr) { /* skip board */ }
      return rows;
    }));
    return chunks.reduce(function(all, part) { return all.concat(part); }, []);
  };

  window.cchPoSetProjectVarianceFilter = function(f) {
    window._poDiscFilter = f;
    if (typeof window.renderProjectDiscrepanciesTab === 'function' && window._currentProject) {
      window.renderProjectDiscrepanciesTab(document.getElementById('projectTabContent'), window._currentProject);
    }
  };

  window.renderProjectDiscrepanciesTab = async function(T, proj) {
    T.innerHTML = '<div style="padding:24px;color:var(--gray-500);">Loading bill variances…</div>';
    var filter = window._poDiscFilter || 'ready_to_bill';
    var allRows = await window.cchPoCollectVarianceRows(proj.id);
    window.__cchVarBatchRows = allRows.filter(function(r) { return r.readyToBill; });
    var rows = cchPoApplyVarianceRowFilter(allRows, filter);
    var invOpts = await cchPoInvoiceSelectOptionsHtml(proj.id);
    var chips = cchPoVarianceFilterChipsHtml(filter, 'cchPoSetProjectVarianceFilter');
    var batchBar = window.__cchVarBatchRows.length
      ? '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:16px 0;padding:14px 16px;background:rgba(27,51,82,0.05);border:1px solid rgba(27,51,82,0.12);border-radius:4px;">' +
          '<label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;margin:0;">' +
            '<input type="checkbox" onchange="cchPoVarianceTabSelectAll(this.checked)" style="accent-color:var(--gold);"> Select all ready' +
          '</label>' +
          '<span id="cchVarBatchSummary" style="font-size:12px;font-weight:600;color:#1B3352;">None selected</span>' +
          '<select id="cchVarBatchInvoiceId" class="form-input" style="max-width:240px;font-size:12px;">' + invOpts + '</select>' +
          '<button type="button" id="cchVarBatchAddBtn" class="btn btn-primary btn-sm" disabled onclick="cchPoBatchAddVariancesToInvoice(\'' + escJs(proj.id) + '\')">Add to client invoice</button>' +
        '</div>'
      : '';
    T.innerHTML = '<div class="page-header" style="display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:12px;">' +
      '<div><div class="page-title">Bill variances</div>' +
      '<div class="page-subtitle">This project · select multiple PO variances and add to one client invoice</div></div>' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="navigate(\'' + escJs(typeof window.cchPoFinanceRoute === 'function' ? window.cchPoFinanceRoute('variances') : '#/vendorbills/variances') + '\')">Open firm-wide Bill variances</button></div>' +
      '<p style="font-size:12px;color:#5C6B80;max-width:720px;margin:0 0 14px;line-height:1.5;">Freight, tax, and other charges above the locked PO total. Firm-wide list: Finance → <strong>Order Management → Bill variances</strong>.</p>' +
      '<div style="margin-bottom:14px;">' + chips + '</div>' + batchBar +
      '<table class="data-table"><thead><tr><th style="width:36px;"></th><th>PO</th><th>Vendor</th>' +
      '<th style="text-align:right;">PO total</th><th style="text-align:right;">Bill total</th><th style="text-align:right;">Variance</th>' +
      '<th>Reason</th><th>Status</th><th>Client invoice</th></tr></thead><tbody>' +
      cchPoBuildVarianceTableRowsHtml(rows, false) + '</tbody></table>';
  };

  window.cchPoSetFirmVarianceFilter = function(f) {
    window._poDiscFilter = f;
    window._vendorBillsTab = 'variances';
    window.cchPoRefreshFinancePage();
  };

  window.cchPoFirmVarianceProjectChanged = function(projectId) {
    window._poVarFirmProject = projectId || 'all';
    window._vendorBillsTab = 'variances';
    window.cchPoRefreshFinancePage();
  };

  window.cchPoFinanceRoute = function(tab) {
    if (typeof window.cchOmPageEnabled === 'function' && window.cchOmPageEnabled()) {
      if (tab === 'variances') return '#/ordermanagement/variances';
      return '#/ordermanagement/bills';
    }
    if (tab === 'variances') return '#/vendorbills/variances';
    return '#/vendorbills';
  };

  window.cchPoRefreshFinancePage = function() {
    if (typeof window.cchOmIsActive === 'function' && window.cchOmIsActive() &&
        typeof window.cchOmSoftRefresh === 'function') {
      return window.cchOmSoftRefresh();
    }
    if (typeof window.renderAllVendorBillsPage === 'function') {
      return window.renderAllVendorBillsPage();
    }
  };

  function cchPoVendorBillsTabBarHtml(activeTab, varianceReady) {
    function tabBtn(id, label, badge) {
      var on = activeTab === id;
      var badgeHtml = (id === 'variances' && badge)
        ? ' <span id="cchVendorBillsVarBadge" style="font-size:11px;color:#B45309;">(' + badge + ')</span>'
        : (id === 'variances' ? ' <span id="cchVendorBillsVarBadge" style="font-size:11px;color:#B45309;display:none;"></span>' : '');
      return '<button type="button" onclick="cchPoSetVendorBillsTab(\'' + escJs(id) + '\')" style="flex:1;padding:12px 16px;border:none;cursor:pointer;text-align:center;background:' +
        (on ? 'linear-gradient(135deg,rgba(0,184,212,0.15),rgba(0,184,212,0.05))' : 'transparent') +
        ';border-right:1px solid rgba(196,164,100,0.1);transition:all 0.2s;">' +
        '<div style="font-size:13px;font-weight:600;color:' + (on ? 'var(--cyan)' : 'var(--gray-400)') + ';">' + esc(label) + badgeHtml + '</div>' +
        '<div style="font-size:10px;color:var(--gray-500);margin-top:2px;">' +
        (id === 'bills' ? 'Pay vendors · open balances' : 'Bill client · freight & tax') + '</div></button>';
    }
    return '<div style="display:flex;gap:0;margin:0 0 20px;border:1px solid rgba(196,164,100,0.15);overflow:hidden;">' +
      tabBtn('bills', 'Vendor bills') +
      tabBtn('variances', 'Bill variances', varianceReady) +
      '</div>';
  }

  function cchPoDeferVendorBillsVarianceBadge() {
    if (window._vendorBillsVarianceBadgeLoading) return;
    window._vendorBillsVarianceBadgeLoading = true;
    window.cchPoCollectVarianceRows().then(function(rows) {
      window._vendorBillsVarianceBadgeLoading = false;
      var n = rows.filter(function(r) { return r.readyToBill; }).length;
      window._vendorBillsVarianceReady = n;
      if (window._vendorBillsTab === 'variances') return;
      var el = document.getElementById('cchVendorBillsVarBadge');
      if (!el) return;
      if (n > 0) {
        el.textContent = '(' + n + ')';
        el.style.display = '';
      } else {
        el.textContent = '';
        el.style.display = 'none';
      }
    }).catch(function() {
      window._vendorBillsVarianceBadgeLoading = false;
    });
  }

  window.cchPoSetVendorBillsTab = function(tab) {
    window._vendorBillsTab = tab === 'variances' ? 'variances' : 'bills';
    if (typeof window.navigate === 'function') {
      window.navigate(window.cchPoFinanceRoute(window._vendorBillsTab === 'variances' ? 'variances' : 'bills'));
    } else {
      window.cchPoRefreshFinancePage();
    }
  };

  async function cchPoBuildFirmVariancePanelHtml() {
    var omUi = typeof window.cchOmIsActive === 'function' && window.cchOmIsActive();
    var readyAccent = omUi ? '#0F1A2E' : '#B45309';
    var cardStyle = 'padding:14px 18px;min-width:160px;background:#fff;border:1px solid rgba(15,26,46,0.12);';
    var allRows = await window.cchPoCollectVarianceRows();
    window.__cchVarBatchRows = allRows.filter(function(r) { return r.readyToBill; });
    var filter = window._poDiscFilter || 'ready_to_bill';
    var firmProject = window._poVarFirmProject || 'all';
    var rows = cchPoApplyVarianceRowFilter(allRows, filter);
    if (firmProject !== 'all') rows = rows.filter(function(r) { return r.projectId === firmProject; });

    var readyRows = allRows.filter(function(r) { return r.readyToBill; });
    var readySum = readyRows.reduce(function(s, r) { return s + r.variance; }, 0);
    var projectOpts = '<option value="all">All projects</option>';
    var seenProjects = {};
    allRows.forEach(function(r) {
      if (seenProjects[r.projectId]) return;
      seenProjects[r.projectId] = true;
      projectOpts += '<option value="' + escAttr(r.projectId) + '"' + (firmProject === r.projectId ? ' selected' : '') + '>' +
        esc(r.projectName || r.projectId) + '</option>';
    });

    var invProjectId = firmProject !== 'all' ? firmProject : '';
    var invOpts = await cchPoInvoiceSelectOptionsHtml(invProjectId);
    var chips = cchPoVarianceFilterChipsHtml(filter, 'cchPoSetFirmVarianceFilter');
    var batchBar = window.__cchVarBatchRows.length
      ? '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin:16px 0;padding:14px 16px;background:rgba(27,51,82,0.05);border:1px solid rgba(27,51,82,0.12);border-radius:4px;">' +
          '<label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;margin:0;">' +
            '<input type="checkbox" onchange="cchPoVarianceTabSelectAll(this.checked)" style="accent-color:var(--gold);"> Select all ready (visible)' +
          '</label>' +
          '<span id="cchVarBatchSummary" style="font-size:12px;font-weight:600;color:#1B3352;">None selected</span>' +
          '<select class="form-input" style="max-width:200px;font-size:12px;" onchange="cchPoFirmVarianceProjectChanged(this.value)">' + projectOpts + '</select>' +
          '<select id="cchVarBatchInvoiceId" class="form-input" style="max-width:240px;font-size:12px;">' + invOpts + '</select>' +
          '<button type="button" id="cchVarBatchAddBtn" class="btn btn-primary btn-sm" disabled onclick="cchPoBatchAddVariancesToInvoice()">Add to client invoice</button>' +
        '</div>'
      : '';

    return '<p style="font-size:13px;color:#5C6B80;max-width:760px;line-height:1.5;margin:0 0 10px;">PO vendor bill vs locked PO total — <strong>bill the client</strong> for freight, tax, and fees above the PO. To <strong>pay the vendor</strong>, use the <button type="button" class="btn btn-secondary btn-sm" style="font-size:11px;padding:2px 8px;vertical-align:baseline;" onclick="cchPoSetVendorBillsTab(\'bills\')">Vendor bills</button> tab in Order Management.</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:12px;margin:16px 0;">' +
        '<div class="card" style="' + cardStyle + '"><div style="font-size:10px;text-transform:uppercase;color:#9CA3AF;">Ready to bill</div>' +
          '<div style="font-size:22px;font-weight:700;color:' + readyAccent + ';">' + readyRows.length + '</div></div>' +
        '<div class="card" style="' + cardStyle + '"><div style="font-size:10px;text-transform:uppercase;color:#9CA3AF;">Ready total</div>' +
          '<div style="font-size:22px;font-weight:700;color:#0F1A2E;">' + fmt(readySum) + '</div></div>' +
      '</div>' +
      '<div style="margin-bottom:14px;">' + chips + '</div>' + batchBar +
      '<table class="data-table"><thead><tr><th style="width:36px;"></th><th>Project</th><th>PO</th><th>Vendor</th>' +
      '<th style="text-align:right;">PO total</th><th style="text-align:right;">Bill total</th><th style="text-align:right;">Variance</th>' +
      '<th>Reason</th><th>Status</th><th>Client invoice</th></tr></thead><tbody>' +
      cchPoBuildVarianceTableRowsHtml(rows, true) + '</tbody></table>';
  }
  window.cchPoBuildFirmVariancePanelHtml = cchPoBuildFirmVariancePanelHtml;

  window.renderDiscrepancyReportPage = async function() {
    window._vendorBillsTab = 'variances';
    if (typeof window.cchOmPageEnabled === 'function' && window.cchOmPageEnabled() &&
        typeof window.renderOrderManagementPage === 'function') {
      if (typeof history !== 'undefined' && history.replaceState) {
        history.replaceState(null, '', '#/ordermanagement/variances');
      }
      return window.renderOrderManagementPage();
    }
    return window.renderAllVendorBillsPage();
  };

  /** ⋮ menu cell for firm-wide Vendor Bills list rows. */
  window.cchPoVendorBillRowActionsHtml = function(r) {
    r = r || {};
    var pj = escJs(r.projectId);
    var poId = escJs(r.poId);
    var poHash = '#/project/' + escJs(r.projectId) + '/po/' + escJs(r.poId);
    var projHash = '#/project/' + escJs(r.projectId);
    var items = [];

    items.push('<a onclick="event.stopPropagation();navigate(\'' + poHash + '\');closeAllMenus()">📄 View PO</a>');
    items.push('<a onclick="event.stopPropagation();window._forceEditMode=true;navigate(\'' + poHash + '\');closeAllMenus()">✏️ Edit PO</a>');

    if (!r.hasBill) {
      items.push('<div class="divider"></div>');
      items.push('<a onclick="event.stopPropagation();cchPoOpenReceiveBillModal(\'' + pj + '\',\'' + poId + '\');closeAllMenus()">📥 Receive vendor bill</a>');
    } else {
      items.push('<div class="divider"></div>');
      items.push('<a onclick="event.stopPropagation();cchPoOpenReceiveBillModal(\'' + pj + '\',\'' + poId + '\',\'edit\');closeAllMenus()">✏️ Edit bill</a>');
      items.push('<a onclick="event.stopPropagation();cchPoOpenAddToBillModal(\'' + pj + '\',\'' + poId + '\');closeAllMenus()">➕ Add vendor invoice</a>');
      items.push('<a onclick="event.stopPropagation();cchPoOpenPaymentModal(\'' + pj + '\',\'' + poId + '\');closeAllMenus()">💳 Pay bill</a>');
      if (typeof window.userCanPushToQB === 'function' && window.userCanPushToQB()
          && typeof window.cchPoQbBillPushAllowed === 'function' && window.cchPoQbBillPushAllowed()) {
        items.push('<div class="divider"></div>');
        items.push('<a onclick="event.stopPropagation();cchPoPushBillToQB(\'' + pj + '\',\'' + poId + '\',null);closeAllMenus()">' +
          (r.qbBillId ? '🔄 Sync bill to QuickBooks' : '📤 Push bill to QuickBooks') + '</a>');
      }
    }

    if (typeof window.emailVendorPO === 'function') {
      items.push('<div class="divider"></div>');
      items.push('<a onclick="event.stopPropagation();emailVendorPO(\'' + pj + '\',\'' + poId + '\');closeAllMenus()">📧 Email PO to vendor</a>');
    }
    items.push('<a onclick="event.stopPropagation();navigate(\'' + projHash + '\');closeAllMenus()">📁 Open project</a>');

    return '<td style="padding:12px 14px;text-align:center;white-space:nowrap;" onclick="event.stopPropagation()">' +
      '<div class="action-menu-wrap" style="display:inline-flex;align-items:center;justify-content:center;">' +
        '<button type="button" class="action-dots" style="font-size:18px;padding:4px 8px;cursor:pointer;background:none;border:1px solid rgba(15,26,46,0.12);color:#0F1A2E;line-height:1;" ' +
          'onclick="event.stopPropagation();toggleActionMenu(this)" title="Bill actions">⋮</button>' +
        '<div class="action-dropdown" style="display:none;min-width:210px;">' + items.join('') + '</div>' +
      '</div></td>';
  };

  /** QB status cell for Vendor Bills list — sync state + Bill # (readable; not tiny navy). */
  window.cchPoVendorBillQbStatusHtml = function(r) {
    r = r || {};
    var po = r._po || {};
    var bill = po.bill || { received: r.hasBill, qbBillId: r.qbBillId };
    var blRef = r.billNumber || (typeof window.cchPoQbBillDocNumberFromPo === 'function'
      ? window.cchPoQbBillDocNumberFromPo(po) : '');
    if (bill.qbBillId || r.qbBillId) {
      return '<span style="display:inline-flex;flex-direction:column;align-items:flex-start;gap:3px;">' +
        '<span style="font-size:12px;font-weight:700;color:#1B5E20;">● Synced</span>' +
        (blRef ? '<span style="font-size:12px;font-family:var(--font-mono);font-weight:700;color:#2E7D32;">' + esc(blRef) + '</span>' : '') +
        '</span>';
    }
    if (bill.received || r.hasBill) {
      return '<span style="display:inline-flex;flex-direction:column;align-items:flex-start;gap:3px;">' +
        '<span style="font-size:12px;font-weight:700;color:#92400E;">● Push pending</span>' +
        (blRef ? '<span style="font-size:12px;font-family:var(--font-mono);font-weight:600;color:#92400E;">' + esc(blRef) + '</span>' : '') +
        '</span>';
    }
    return '<span style="font-size:11px;color:#9CA3AF;">—</span>';
  };

  /** Collect every vendor invoice # tied to a PO bill (groups, bill fields, payments, attachments). */
  function cchPoVendorBillListInvoiceEntries(po) {
    po = po || {};
    var bill = po.bill || {};
    var poItems = po.items || [];
    var seen = {};
    var entries = [];

    function push(invNum, poLineIds) {
      invNum = String(invNum || '').trim();
      if (!invNum) return;
      var key = cchPoNormVendorInvNum(invNum);
      if (seen[key]) {
        if ((poLineIds || []).length > (seen[key].poLineIds || []).length) seen[key].poLineIds = poLineIds.slice();
        return;
      }
      seen[key] = { vendorInvoiceNumber: invNum, poLineIds: (poLineIds || []).slice() };
      entries.push(seen[key]);
    }

    var groups = typeof window.cchPoVendorInvoiceGroupsDisplay === 'function'
      ? window.cchPoVendorInvoiceGroupsDisplay(po, poItems) : [];
    groups.forEach(function(g) { push(g.vendorInvoiceNumber, g.poLineIds || []); });
    cchPoDistinctBillInvoiceNumbers(bill).forEach(function(n) { push(n, []); });
    (bill.items || []).forEach(function(it) {
      if (it.vendorInvoiceNumber) push(it.vendorInvoiceNumber, it.poLineIds || []);
    });
    (po.payments || []).forEach(function(p) {
      if (p.vendorInvoiceNumber) push(p.vendorInvoiceNumber, []);
    });
    (bill.attachments || []).forEach(function(a) {
      if (a.vendorInvoiceNumber) push(a.vendorInvoiceNumber, []);
    });

    entries.forEach(function(e) {
      if (e.poLineIds && e.poLineIds.length) return;
      var g = groups.find(function(x) {
        return cchPoNormVendorInvNum(x.vendorInvoiceNumber) === cchPoNormVendorInvNum(e.vendorInvoiceNumber);
      });
      if (g && g.poLineIds && g.poLineIds.length) {
        e.poLineIds = g.poLineIds.slice();
        return;
      }
      if (bill.received) {
        e.poLineIds = cchPoPoLineIdsForBillInvoice(po, poItems, e.vendorInvoiceNumber, window.cchPoVendorInvoiceGroupsUser(po));
      }
    });
    return entries;
  }

  /** One list row per vendor invoice when a PO has multiple vendor invoice #s on the combined bill. */
  function cchPoExpandVendorBillListRows(rows) {
    var out = [];
    (rows || []).forEach(function(r) {
      var po = r._po || {};
      var bill = po.bill || {};
      var billNumber = typeof window.cchPoQbBillDocNumberFromPo === 'function'
        ? window.cchPoQbBillDocNumberFromPo(po) : '';
      if (!r.hasBill) {
        out.push(Object.assign({}, r, { billNumber: billNumber }));
        return;
      }
      var poItems = po.items || [];
      var lineMeta = cchPoPoLineMetaList(poItems);
      var entries = cchPoVendorBillListInvoiceEntries(po);

      function rowForInvoice(invNum, poLineIds) {
        invNum = String(invNum || '').trim();
        poLineIds = poLineIds || [];
        var groups = typeof window.cchPoVendorInvoiceGroupsDisplay === 'function'
          ? window.cchPoVendorInvoiceGroupsDisplay(po, poItems) : [];
        var g = groups.find(function(x) {
          return cchPoNormVendorInvNum(x.vendorInvoiceNumber) === cchPoNormVendorInvNum(invNum);
        });
        var invTotal = invNum
          ? cchPoVendorInvoiceGroupTotal(bill, invNum, poLineIds, lineMeta)
          : r.billTotal;
        if (invTotal <= 0.01) invTotal = r.billTotal;
        var invPaid = invNum
          ? cchPoVendorInvoicePaidAmount(po.payments || [], invNum, null)
          : r.paid;
        if (invTotal <= 0.01 && invPaid > 0.01) invTotal = invPaid;
        var invDue = Math.max(0, Math.round((invTotal - invPaid) * 100) / 100);
        var bucket = invDue > 0.02 ? 'open' : (invPaid > 0.01 ? 'paid' : 'open');
        return Object.assign({}, r, {
          vendorInvoiceNumber: invNum,
          billNumber: billNumber,
          billTotal: invTotal,
          paid: invPaid,
          due: invDue,
          bucket: bucket,
          etaDate: g ? (g.etaDate || g.estimatedShipDate || '') : (bill.etaDate || ''),
          deliveryStatus: g ? (g.status || '') : '',
          documentType: g ? (g.documentType || 'ship_invoice') : 'ship_invoice',
          salesOrderNumber: g ? (g.salesOrderNumber || '') : '',
          _vigGroup: g || null
        });
      }

      if (entries.length <= 1) {
        var e0 = entries[0] || {};
        out.push(rowForInvoice(e0.vendorInvoiceNumber || r.vendorInvoiceNumber || '', e0.poLineIds || []));
        return;
      }
      entries.forEach(function(e) {
        out.push(rowForInvoice(e.vendorInvoiceNumber, e.poLineIds));
      });
    });
    return out;
  }

  function cchPoBuildVendorBillsPanelHtml(pos, projNames, preset) {
    projNames = projNames || {};
    preset = preset || '';
    var omUi = typeof window.cchOmIsActive === 'function' && window.cchOmIsActive();
    var openAccent = omUi ? '#0F1A2E' : '#B45309';
    var cardStyle = 'padding:14px 18px;min-width:140px;background:#fff;border:1px solid rgba(15,26,46,0.12);';
    if (preset === 'open' || preset === 'pending' || preset === 'paid' || preset === 'all') {
      window._vendorBillsFilter = preset === 'pending' ? 'awaiting_bill' : preset;
    }
    var filter = window._vendorBillsFilter || 'received';
    var allRows = cchPoExpandVendorBillListRows(window.cchPoCollectVendorBillRows(pos, projNames));

    var awaiting = allRows.filter(function(r) { return r.bucket === 'awaiting_bill'; });
    var openRows = allRows.filter(function(r) { return r.bucket === 'open'; });
    var paidRows = allRows.filter(function(r) { return r.bucket === 'paid'; });
    var openDue = openRows.reduce(function(s, r) { return s + r.due; }, 0);

    if (!preset && filter === 'open' && !openRows.length && allRows.length) {
      filter = 'all';
      window._vendorBillsFilter = 'all';
    }

    var rows = allRows;
    if (filter === 'open') rows = openRows;
    else if (filter === 'awaiting_bill' || filter === 'pending') rows = awaiting;
    else if (filter === 'paid') rows = paidRows;
    else if (filter === 'received') rows = allRows.filter(function(r) { return r.hasBill; });

    var recvInView = rows.filter(function(r) { return r.hasBill; });
    var sumTotal = recvInView.reduce(function(s, r) { return s + (r.billTotal || 0); }, 0);
    var sumPaid = recvInView.reduce(function(s, r) { return s + (r.paid || 0); }, 0);
    var sumBalance = recvInView.reduce(function(s, r) { return s + (r.due || 0); }, 0);

    rows = rows.slice().sort(function(a, b) {
      var da = a.due || 0, db = b.due || 0;
      if (filter === 'open' && db !== da) return db - da;
      return String(a.projectName || '').localeCompare(String(b.projectName || '')) ||
        String(a.poNumber || '').localeCompare(String(b.poNumber || ''));
    });

    function chip(id, label, count) {
      var on = filter === id;
      var chipBorder = on ? (omUi ? '#0F1A2E' : '#C4A464') : 'rgba(15,26,46,0.18)';
      var chipBg = on ? (omUi ? 'rgba(15,26,46,0.08)' : 'rgba(196,164,100,0.22)') : '#fff';
      var chipColor = on ? (omUi ? '#0F1A2E' : '#5C4A2A') : '#0F1A2E';
      return '<button type="button" onclick="cchPoSetVendorBillsFilter(\'' + escJs(id) + '\')" style="padding:8px 16px;font-size:13px;font-weight:700;cursor:pointer;border:1px solid ' +
        chipBorder + ';background:' + chipBg + ';color:' + chipColor + ';">' +
        esc(label) + (count != null ? ' (' + count + ')' : '') + '</button>';
    }

    var presetBanner = '';
    if (window._vendorBillsFilter === 'open' && window.location.hash.indexOf('/open') >= 0) {
      presetBanner = omUi
        ? '<div style="font-size:12px;color:#0F1A2E;margin-bottom:12px;padding:10px 14px;border:1px solid rgba(15,26,46,0.15);background:#fff;">Showing open vendor bills (balance due). <a href="#" onclick="event.preventDefault();cchPoSetVendorBillsFilter(\'all\');return false;" style="color:#1B3352;font-weight:600;">Show all</a></div>'
        : '<div style="font-size:12px;color:var(--gold);margin-bottom:12px;padding:10px 14px;border:1px solid rgba(196,164,100,0.35);background:rgba(196,164,100,0.06);">Showing open vendor bills (balance due). <a href="#" onclick="event.preventDefault();cchPoSetVendorBillsFilter(\'all\');return false;" style="color:var(--cyan);font-weight:600;">Show all</a></div>';
    }

    var tbody = rows.length ? rows.map(function(r) {
      var poHash = '#/project/' + escAttr(r.projectId) + '/po/' + escAttr(r.poId);
      var isPaidRow = r.hasBill && r.due <= 0.02 && r.paid > 0.01;
      var statusBadge = typeof window.cchPoBillStatusBadgeHtml === 'function' && r._po
        ? window.cchPoBillStatusBadgeHtml(r._po)
        : (r.hasBill
          ? window.cchPoVendorInvoicePayStatusBadgeHtml(r.paid, r.due)
          : '<span style="font-size:11px;font-weight:600;color:#5C6B80;">Pending</span>');
      var qbCell = typeof window.cchPoVendorBillQbStatusHtml === 'function'
        ? window.cchPoVendorBillQbStatusHtml(r)
        : (r.qbBillId ? 'Synced' : (r.hasBill ? 'Push pending' : '—'));
      var recvStr = r.receivedAt && typeof window.formatDate === 'function' ? window.formatDate(r.receivedAt) : (r.receivedAt ? String(r.receivedAt).slice(0, 10) : '—');
      var etaStr = r.etaDate && typeof window.cchPoFormatEtaDate === 'function'
        ? window.cchPoFormatEtaDate(r.etaDate)
        : (r.etaDate ? String(r.etaDate).slice(0, 10) : '—');
      var invRefCell = r._vigGroup
        ? esc(window.cchPoVendorInvRefLabel(r._vigGroup)) + window.cchPoVendorInvDocumentTypeBadgeHtml(r.documentType)
        : (r.vendorInvoiceNumber ? esc(r.vendorInvoiceNumber) : '<span style="color:var(--gray-400);font-weight:400;">—</span>');
      var billNumCell = r.billNumber
        ? '<span style="font-family:var(--font-mono);font-weight:700;font-size:13px;color:#0F1A2E;">' + esc(r.billNumber) + '</span>'
        : '<span style="color:var(--gray-400);">—</span>';
      var rowBg = isPaidRow ? 'background:rgba(46,125,50,0.05);' : '';
      return '<tr style="border-bottom:1px solid var(--gray-100);cursor:pointer;' + rowBg + '" onclick="navigate(\'' + escJs(poHash) + '\')">' +
        '<td style="padding:12px 14px;font-size:13px;">' + esc(r.projectName) + '</td>' +
        '<td style="padding:12px 14px;">' + billNumCell + '</td>' +
        '<td style="padding:12px 14px;font-family:monospace;font-weight:600;color:' + (omUi ? '#0F1A2E' : 'var(--gold)') + ';">' + esc(r.poNumber || r.poId.slice(0, 8)) + '</td>' +
        '<td style="padding:12px 14px;font-size:13px;">' + esc(r.vendor || '—') + '</td>' +
        '<td style="padding:12px 14px;font-size:12px;font-weight:600;color:#0F1A2E;">' + invRefCell + '</td>' +
        '<td style="padding:12px 14px;font-size:12px;color:var(--gray-500);">' + esc(recvStr) + '</td>' +
        '<td style="padding:12px 14px;font-size:12px;font-weight:600;color:#1B3352;white-space:nowrap;">' + (etaStr !== '—' ? esc(etaStr) : '<span style="color:var(--gray-400);font-weight:400;">—</span>') + '</td>' +
        '<td style="padding:12px 14px;text-align:right;font-family:var(--font-mono);font-weight:600;">' + fmt(r.billTotal) + (r.hasBill ? '' : '<div style="font-size:10px;color:var(--gray-400);font-weight:400;">PO est.</div>') + '</td>' +
        '<td style="padding:12px 14px;text-align:right;font-family:var(--font-mono);color:' + (r.paid > 0.01 ? '#1B5E20' : 'var(--gray-400)') + ';">' + (r.hasBill ? fmt(r.paid) : '—') + '</td>' +
        '<td style="padding:12px 14px;text-align:right;font-family:var(--font-mono);font-weight:700;color:' + (r.due > 0.02 ? openAccent : (r.hasBill ? '#1B5E20' : 'var(--gray-400)') ) + ';">' + (r.hasBill ? fmt(r.due) : '—') + '</td>' +
        '<td style="padding:12px 14px;font-size:11px;white-space:nowrap;">' + qbCell + '</td>' +
        '<td style="padding:12px 14px;text-align:center;">' + statusBadge + '</td>' +
        window.cchPoVendorBillRowActionsHtml(r) + '</tr>';
    }).join('') : (allRows.length
      ? '<tr><td colspan="13" style="padding:40px;text-align:center;color:var(--gray-400);">No vendor bills match this filter. Try <button type="button" class="btn btn-secondary btn-sm" onclick="cchPoSetVendorBillsFilter(\'all\')">Show all</button> or <button type="button" class="btn btn-secondary btn-sm" onclick="cchPoSetVendorBillsFilter(\'awaiting_bill\')">Pending</button>.</td></tr>'
      : '<tr><td colspan="13" style="padding:40px;text-align:center;color:var(--gray-400);">No sent POs or received vendor bills yet. Send a PO to the vendor, then receive their invoice — those rows appear here.</td></tr>');

    var footerRow = recvInView.length
      ? '<tr style="border-top:2px solid ' + (omUi ? '#0F1A2E' : 'var(--gold)') + ';background:#fff;font-weight:700;">' +
          '<td colspan="7" style="padding:12px 14px;font-size:12px;text-align:right;color:#5C6B80;">Totals (' + recvInView.length + ' bill' + (recvInView.length !== 1 ? 's' : '') + ' in view)</td>' +
          '<td style="padding:12px 14px;text-align:right;font-family:var(--font-mono);color:#0F1A2E;">' + fmt(sumTotal) + '</td>' +
          '<td style="padding:12px 14px;text-align:right;font-family:var(--font-mono);color:#1B5E20;">' + fmt(sumPaid) + '</td>' +
          '<td style="padding:12px 14px;text-align:right;font-family:var(--font-mono);color:' + (sumBalance > 0.02 ? openAccent : '#1B5E20') + ';">' + fmt(sumBalance) + '</td>' +
          '<td colspan="3"></td></tr>'
      : '';

    return '<p style="font-size:13px;color:#5C6B80;max-width:820px;line-height:1.55;margin:0 0 16px;">Each row is one <strong>vendor invoice</strong> on a Studio bill (<strong>Bill #</strong> BL-9017 = one QuickBooks Bill per PO). <strong>Vendor inv #</strong> is the vendor&apos;s paper invoice. Line items and PO detail live on the <strong>PO page</strong> — not here. Legacy Houzz POs synced to QB as PO stay on <strong>All POs</strong>.</p>' +
      '<div style="display:flex;flex-wrap:wrap;gap:12px;margin:16px 0;">' +
        '<div class="card" style="' + cardStyle + '"><div style="font-size:10px;text-transform:uppercase;color:#9CA3AF;">Open bills</div>' +
          '<div style="font-size:22px;font-weight:700;color:' + openAccent + ';">' + openRows.length + '</div></div>' +
        '<div class="card" style="' + cardStyle + '"><div style="font-size:10px;text-transform:uppercase;color:#9CA3AF;">Total</div>' +
          '<div style="font-size:22px;font-weight:700;color:#0F1A2E;font-family:var(--font-mono);">' + fmt(sumTotal) + '</div>' +
          '<div style="font-size:10px;color:#5C6B80;margin-top:4px;">bills in this view</div></div>' +
        '<div class="card" style="' + cardStyle + '"><div style="font-size:10px;text-transform:uppercase;color:#9CA3AF;">Paid</div>' +
          '<div style="font-size:22px;font-weight:700;color:#1B5E20;font-family:var(--font-mono);">' + fmt(sumPaid) + '</div></div>' +
        '<div class="card" style="' + cardStyle + '"><div style="font-size:10px;text-transform:uppercase;color:#9CA3AF;">Balance</div>' +
          '<div style="font-size:22px;font-weight:700;color:' + (sumBalance > 0.02 ? openAccent : '#1B5E20') + ';font-family:var(--font-mono);">' + fmt(sumBalance) + '</div>' +
          '<div style="font-size:10px;color:#5C6B80;margin-top:4px;">' + awaiting.length + ' pending</div></div>' +
      '</div>' + presetBanner +
      '<div style="display:flex;flex-wrap:wrap;gap:0;margin-bottom:16px;border:1px solid rgba(10,31,61,0.14);width:fit-content;">' +
        chip('open', 'Open', openRows.length) +
        chip('awaiting_bill', 'Pending', awaiting.length) +
        chip('paid', 'Paid', paidRows.length) +
        chip('received', 'All received') +
        chip('all', 'All') +
      '</div>' +
      '<div class="card" style="overflow-x:auto;"><table class="data-table" style="width:100%;"><thead><tr>' +
        '<th style="text-align:left;padding:12px 14px;font-size:11px;text-transform:uppercase;color:var(--gray-400);">Project</th>' +
        '<th style="text-align:left;padding:12px 14px;font-size:11px;text-transform:uppercase;color:var(--gray-400);">Bill #</th>' +
        '<th style="text-align:left;padding:12px 14px;font-size:11px;text-transform:uppercase;color:var(--gray-400);">PO #</th>' +
        '<th style="text-align:left;padding:12px 14px;font-size:11px;text-transform:uppercase;color:var(--gray-400);">Vendor</th>' +
        '<th style="text-align:left;padding:12px 14px;font-size:11px;text-transform:uppercase;color:var(--gray-400);">Vendor inv #</th>' +
        '<th style="text-align:left;padding:12px 14px;font-size:11px;text-transform:uppercase;color:var(--gray-400);">Received</th>' +
        '<th style="text-align:left;padding:12px 14px;font-size:11px;text-transform:uppercase;color:var(--gray-400);">Ship ETA</th>' +
        '<th style="text-align:right;padding:12px 14px;font-size:11px;text-transform:uppercase;color:var(--gray-400);">Total</th>' +
        '<th style="text-align:right;padding:12px 14px;font-size:11px;text-transform:uppercase;color:var(--gray-400);">Paid</th>' +
        '<th style="text-align:right;padding:12px 14px;font-size:11px;text-transform:uppercase;color:var(--gray-400);">Balance</th>' +
        '<th style="text-align:left;padding:12px 14px;font-size:11px;text-transform:uppercase;color:var(--gray-400);">QB Status</th>' +
        '<th style="text-align:left;padding:12px 14px;font-size:11px;text-transform:uppercase;color:var(--gray-400);">Bill status</th>' +
        '<th style="text-align:center;padding:12px 14px;font-size:11px;text-transform:uppercase;color:var(--gray-400);">Actions</th>' +
      '</tr></thead><tbody>' + tbody + footerRow + '</tbody></table></div>';
  }
  window.cchPoBuildVendorBillsPanelHtml = cchPoBuildVendorBillsPanelHtml;

  window.cchPoDashboardVarianceWidgetHtml = function(pendingCount, pendingSum) {
    if (!pendingCount) return '';
    var varHash = typeof window.cchPoFinanceRoute === 'function'
      ? window.cchPoFinanceRoute('variances') : '#/vendorbills/variances';
    return '<div class="card" style="padding:14px 18px;margin-bottom:16px;border-left:4px solid #CA8A04;cursor:pointer;" onclick="navigate(\'' + escJs(varHash) + '\')">' +
      '<div style="font-size:13px;font-weight:700;color:#92400E;">⚠ ' + pendingCount + ' bill variance' + (pendingCount > 1 ? 's' : '') + ' ready</div>' +
      '<div style="font-size:12px;color:var(--gray-600);">' + fmt(pendingSum) + ' to bill · <span style="color:var(--gold);font-weight:600;">Open Bill variances →</span></div></div>';
  };

  /** Firm-wide vendor bills list (Finance sidebar). PO docs with bill received or sent-awaiting-bill. */
  window.cchPoCollectVendorBillRows = function(pos, projNames) {
    projNames = projNames || {};
    var rows = [];
    (pos || []).forEach(function(po) {
      po = po || {};
      var bill = po.bill || {};
      var hasVariance = !!(po.variance && Math.abs(parseFloat(po.variance.amount) || 0) >= 0.01);
      var hasBill = !!(bill && bill.received);
      if (!hasBill && bill && bill.qbBillId) hasBill = true;
      if (!hasBill && hasVariance) hasBill = true;
      var billLaneId = typeof window.cchPoBillLaneId === 'function' ? window.cchPoBillLaneId(po) : '';
      var poSt = String(po.poStatus || '').trim().toLowerCase();
      if (!hasBill && (poSt === 'bill_received' || poSt === 'paid' || poSt === 'cleared')) {
        hasBill = true;
      }
      var sentInfo = typeof window.cchPoWasSentToVendor === 'function'
        ? window.cchPoWasSentToVendor(po)
        : { sent: !!(po.poLocked || po.poSentAt) };
      if (!hasBill && !sentInfo.sent) return;
      if (typeof window.cchPoEligibleForVendorBillsList === 'function' && !window.cchPoEligibleForVendorBillsList(po)) return;

      var billTotal = hasBill ? window.cchPoVendorBillTotal(po) : (po.poTotalAtSend != null ? parseFloat(po.poTotalAtSend) : window.cchPoDocTotal(po));
      var paid = 0;
      var due = 0;
      if (hasBill) {
        paid = window.cchPoVendorBillPaidAmount(po);
        due = Math.max(0, Math.round((billTotal - paid) * 100) / 100);
      }

      var bucket = 'awaiting_bill';
      if (hasBill) {
        if (due > 0.02) bucket = 'open';
        else if (paid > 0.01) bucket = 'paid';
        else bucket = 'open';
      }

      rows.push({
        projectId: po.projectId,
        projectName: po.projectName || projNames[po.projectId] || po.projectId,
        poId: po.id,
        poNumber: poNum(po),
        vendor: po.vendor || '',
        hasBill: hasBill,
        bucket: bucket,
        lifecycle: typeof window.cchPoLifecycleStatus === 'function' ? window.cchPoLifecycleStatus(po) : '',
        vendorInvoiceNumber: String(bill.vendorInvoiceNumber || '').trim(),
        receivedAt: bill.receivedAt || '',
        billTotal: billTotal,
        paid: paid,
        due: due,
        qbBillId: bill.qbBillId || '',
        qbStatus: po.qbStatus || bill.qbStatus || '',
        billNumber: typeof window.cchPoQbBillDocNumberFromPo === 'function' ? window.cchPoQbBillDocNumberFromPo(po) : '',
        _po: po,
        billLaneId: billLaneId,
        procurementStatus: typeof window.cchPoProcurementStatus === 'function' ? window.cchPoProcurementStatus(po) : ''
      });
    });
    return rows;
  };

  window.cchPoSetVendorBillsFilter = function(filter) {
    window._vendorBillsFilter = filter || 'received';
    window._vendorBillsTab = 'bills';
    window.cchPoRefreshFinancePage();
  };

  window.renderAllVendorBillsPage = async function() {
    var T = document.getElementById('contentArea');
    if (!T) return;

    var routeHash = window.location.hash || '';
    if (routeHash.indexOf('/vendorbills/variances') >= 0) {
      window._vendorBillsTab = 'variances';
    } else if (routeHash.indexOf('/vendorbills') >= 0) {
      window._vendorBillsTab = 'bills';
    }

    var preset = window._vendorBillsPreset || '';
    if (preset === 'variances') {
      window._vendorBillsTab = 'variances';
      window._vendorBillsPreset = '';
    } else if (preset === 'open' || preset === 'pending' || preset === 'paid' || preset === 'all') {
      window._vendorBillsTab = 'bills';
    }

    var tab = window._vendorBillsTab === 'variances' ? 'variances' : 'bills';
    var loadingMsg = tab === 'variances'
      ? 'Loading bill variances across all projects…'
      : 'Loading vendor bills…';
    T.innerHTML = '<div style="padding:40px;color:var(--gray-500);">' + loadingMsg + '</div>';
    if (typeof window.setBreadcrumb === 'function') {
      window.setBreadcrumb(tab === 'variances'
        ? [{ label: 'Vendor Bills', hash: '#/vendorbills' }, { label: 'Bill variances' }]
        : [{ label: 'Vendor Bills' }]);
    }
    if (typeof window.setTopbarActions === 'function') window.setTopbarActions('');

    var varianceReady = window._vendorBillsVarianceReady;
    if (varianceReady == null || varianceReady === undefined) varianceReady = 0;

    var panelHtml = '';
    if (tab === 'variances') {
      panelHtml = await cchPoBuildFirmVariancePanelHtml();
      varianceReady = (window.__cchVarBatchRows || []).length;
      window._vendorBillsVarianceReady = varianceReady;
    } else {
      var pos = [];
      var projNames = {};
      try {
        var loaded = await window.cchPoLoadAllPosForVendorBills();
        pos = loaded.pos || [];
        projNames = loaded.projNames || {};
      } catch (loadErr) {
        console.warn('[Vendor Bills] PO load failed:', loadErr);
        T.innerHTML = '<h1 class="page-title">Vendor Bills</h1>' +
          '<div class="card" style="padding:24px;margin-top:16px;color:#B45309;">Could not load vendor bills. Refresh the page or open the PO directly.</div>';
        return;
      }
      if (preset === 'open' || preset === 'pending' || preset === 'paid' || preset === 'all') {
        window._vendorBillsFilter = preset === 'pending' ? 'awaiting_bill' : preset;
        window._vendorBillsPreset = '';
      }
      panelHtml = cchPoBuildVendorBillsPanelHtml(pos, projNames, preset);
    }

    T.innerHTML = '<h1 class="page-title">Vendor Bills</h1>' +
      cchPoVendorBillsTabBarHtml(tab, varianceReady) +
      panelHtml;

    if (tab === 'bills') {
      cchPoDeferVendorBillsVarianceBadge();
    }
  };

  // PO "Record payment" in rail → vendor bill payment flow when bill on file
  if (typeof window.quickRecordPayment === 'function') {
    var _origQuickPay = window.quickRecordPayment;
    window.quickRecordPayment = async function(projectId, collection, docId) {
      if (collection === 'purchaseOrders') {
        try {
          var snap = await firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(docId).get();
          var d = snap.exists ? snap.data() : null;
          if (d && d.bill && d.bill.received && typeof window.cchPoOpenPaymentModal === 'function') {
            return window.cchPoOpenPaymentModal(projectId, docId);
          }
          if (d && (!d.bill || !d.bill.received) && typeof window.cchAlert === 'function') {
            await window.cchAlert('Receive the vendor bill first (PO amount + freight/pre-paid tax/extras), then record payment.', 'Vendor payment');
            return;
          }
        } catch (_ePay) { /* fall through */ }
      }
      return _origQuickPay(projectId, collection, docId);
    };
  }

  // PO variance blocks are inlined in renderDocViewPage (cch-proposals-invoices-fix.js).
  var _origDocView = window.renderDocViewPage;
  if (_origDocView) {
    window.renderDocViewPage = function(type, projectId, docId, docData, items, projData) {
      _origDocView(type, projectId, docId, docData, items, projData);
      if (type === 'po') {
        setTimeout(function() {
          if (typeof window.cchPoLoadInvoiceOptionsForVariance === 'function') {
            window.cchPoLoadInvoiceOptionsForVariance(projectId, docId);
          }
        }, 0);
      }
    };
  }

  // Topbar PO actions
  var _origTopbar = window.cchBuildDocViewTopbar;
  if (_origTopbar) {
    window.cchBuildDocViewTopbar = function(opts) {
      var html = _origTopbar(opts);
      if (opts && opts.type === 'po' && opts.docData) {
        var st = window.cchPoLifecycleStatus(opts.docData);
        var pj = opts.projectId;
        var dj = opts.docId;
        var extra = '';
        if (st === 'draft') extra += '<button class="btn btn-primary btn-sm" style="background:#C4A464;color:#0F1A2E;font-weight:700;border:none;" onclick="cchPoSendToVendor(\'' + escJs(pj) + '\',\'' + escJs(dj) + '\')">Send PO to vendor</button>';
        if (st === 'sent') extra += '<button class="btn btn-primary btn-sm" onclick="cchPoOpenReceiveBillModal(\'' + escJs(pj) + '\',\'' + escJs(dj) + '\')">📥 Receive bill</button>';
        if (opts.docData.bill && opts.docData.bill.received) {
          extra += cchPoPayBillBtnHtml(pj, dj, { label: '💳 Pay bill' });
        }
        if (extra) html = extra + html;
      }
      return html;
    };
  }

  // PO edit is allowed after send (vendor, ship-to, images, per-line ship-to).

  /** Unseen qb_payment_matched → modal (SPEC §6, 3a overlap) */
  window.cchPoPollPaymentMatchedNotifications = async function() {
    if (!firebase.auth().currentUser) return;
    var prefix = window.cchPoEmailPrefix();
    var seenKey = 'cchPoNotifSeen_' + prefix;
    var seen = {};
    try { seen = JSON.parse(sessionStorage.getItem(seenKey) || '{}'); } catch (_e) { seen = {}; }

    var boards = await cchPoBoardList();
    for (var i = 0; i < boards.length; i++) {
      var bid = boards[i].id;
      var snap;
      try {
        snap = await firebase.firestore().collection('boards').doc(bid).collection('notifications')
          .orderBy('createdAt', 'desc').limit(12).get();
      } catch (_q) { continue; }
      for (var j = 0; j < snap.docs.length; j++) {
        var n = snap.docs[j];
        var nd = n.data() || {};
        if (nd.type !== 'qb_payment_matched') continue;
        if (seen[n.id] || (nd.seenBy || []).indexOf(prefix) >= 0) continue;
        seen[n.id] = true;
        try { sessionStorage.setItem(seenKey, JSON.stringify(seen)); } catch (_s) {}
        var msg = 'PO ' + (nd.poNumber || nd.poId || '') +
          (nd.data && nd.data.vendor ? '\nVendor: ' + nd.data.vendor : '') +
          '\nAmount: ' + fmt(nd.amount || 0) +
          (nd.data && nd.data.clearedAt ? '\nCleared: ' + String(nd.data.clearedAt).slice(0, 10) : '');
        if (typeof window.cchAlert === 'function') {
          await window.cchAlert(msg, 'QuickBooks payment matched');
        }
        await n.ref.update({ seenBy: firebase.firestore.FieldValue.arrayUnion(prefix) }).catch(function() {});
        return;
      }
    }
  };

  if (typeof firebase !== 'undefined' && firebase.auth) {
    firebase.auth().onAuthStateChanged(function(u) {
      if (!u) return;
      setTimeout(function() { window.cchPoPollPaymentMatchedNotifications(); }, 2500);
    });
  }

  /** Block legacy pushDocToQB('po') — bill-only workflow. */
  function cchPoInstallBillOnlyPushGuard() {
    if (window._cchPoBillOnlyPushGuardInstalled) return;
    var orig = window.pushDocToQB;
    if (typeof orig !== 'function') return;
    window._cchPoBillOnlyPushGuardInstalled = true;
    window.pushDocToQB = async function(docType, projectId, docId, btnEl, sendEmail) {
      if (docType === 'po' && window.cchPoQbBillOnlyMode()) {
        var hasBill = false;
        try {
          var snap = await firebase.firestore().collection('boards').doc(projectId)
            .collection('purchaseOrders').doc(docId).get();
          hasBill = snap.exists && snap.data().bill && snap.data().bill.received;
        } catch (_e) { /* ignore */ }
        var msg = hasBill
          ? 'QuickBooks uses the vendor bill only.\n\nUse **Edit bill** or **+ Add vendor invoice** to update amounts, then **Sync bill to QuickBooks**.'
          : 'Use **Receive vendor bill** to record the first vendor invoice (PO lines + freight/tax). Push to QuickBooks from the bill bar.\n\nPOs stay in Studio for ordering and variance.';
        if (typeof window.cchAlert === 'function') await window.cchAlert(msg, 'Bill-only QuickBooks workflow');
        return;
      }
      return orig.apply(this, arguments);
    };
  }
  cchPoInstallBillOnlyPushGuard();
  setTimeout(cchPoInstallBillOnlyPushGuard, 0);

  // Dashboard widget hook
  var _origDash = window.renderDashboard;
  if (_origDash) {
    window.renderDashboard = async function() {
      await _origDash();
      try {
        var rows = await window.cchPoCollectVarianceRows();
        var pending = rows.filter(function(r) { return r.resolution === 'pending'; });
        var sum = pending.reduce(function(s, r) { return s + r.variance; }, 0);
        var w = window.cchPoDashboardVarianceWidgetHtml(pending.length, sum);
        if (w) {
          var T = document.getElementById('contentArea');
          if (T && T.firstElementChild) {
            var div = document.createElement('div');
            div.innerHTML = w;
            T.insertBefore(div.firstChild, T.firstChild);
          }
        }
      } catch (_eDash) {}
    };
  }

})();
