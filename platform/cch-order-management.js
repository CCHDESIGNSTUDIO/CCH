/**
 * Order Management — firm-wide PO hub: track orders, pay vendors, bill variances, QuickBooks.
 * Vendor Bills / Bill variances nav fold into Order Management (staging + production).
 */
(function() {
  'use strict';

  var OM_BUILD = '20260623om18';
  var OM_NAVY = '#0F1A2E';
  var OM_NAVY_MID = '#1B3352';
  var OM_BORDER = 'rgba(15,26,46,0.12)';

  function esc(t) {
    if (typeof window.esc === 'function') return window.esc(t);
    if (t == null) return '';
    var d = document.createElement('div');
    d.textContent = String(t);
    return d.innerHTML;
  }

  function escAttr(t) {
    if (typeof window.escAttr === 'function') return window.escAttr(t);
    return esc(t).replace(/"/g, '&quot;');
  }

  function fmtDate(d) {
    if (typeof window.formatDate === 'function') return window.formatDate(d);
    if (!d) return '—';
    try {
      var dt = new Date(d);
      if (isNaN(dt.getTime())) return String(d);
      return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (_e) {
      return String(d);
    }
  }

  /** Order Management — enabled on production and staging (Studio staff; not client guests). */
  window.cchOmPageEnabled = function() {
    var env = String(window._cchEnv || '').toLowerCase();
    if (env === 'production' || env === 'staging') return true;
    var h = location.hostname || '';
    return h === 'localhost' || h === '127.0.0.1' || h.indexOf('staging') >= 0 ||
      h.indexOf('cch-platform') >= 0;
  };

  /** Houzz legacy import POs — excluded from Order Management (Studio workflow only). */
  window.cchOmIsHouzzPo = function(po) {
    if (!po) return false;
    if (po.houzzImport === true) return true;
    var src = String(po.source || po.dataSource || po.origin || '').trim().toLowerCase();
    if (src === 'houzz-import' || src === 'houzz_import' || src.indexOf('houzz') >= 0) return true;
    if (po.houzzBalance != null && po.houzzBalance !== '') return true;
    if (String(po._qbIdSource || '').toLowerCase() === 'houzz-import') return true;
    var pays = po.payments || [];
    for (var i = 0; i < pays.length; i++) {
      var m = String((pays[i] || {}).method || '').toLowerCase();
      if (m.indexOf('houzz') >= 0) return true;
    }
    return false;
  };

  window.cchOmIsStudioPo = function(po) {
    return !window.cchOmIsHouzzPo(po);
  };

  function poTotal(po) {
    if (typeof window.cchPoListPoTotal === 'function') return window.cchPoListPoTotal(po);
    if (typeof window.cchPoMerchandiseTotal === 'function') return window.cchPoMerchandiseTotal(po);
    return parseFloat(po.total) || 0;
  }

  function omPaidAmount(po) {
    if (!po) return 0;
    // Match the PO page exactly (poResolvedPaidAmount): recorded payments on the PO
    // doc, then paidAmount, then the Houzz clip-paid fallback. Do NOT use
    // cchPoListPaidForRow here — that returns the vendor-BILL paid amount, which is a
    // different number and reads 0 for most POs (why this column showed only "—").
    if (typeof window.poResolvedPaidAmount === 'function') return window.poResolvedPaidAmount(po);
    var paySum = 0;
    if (Array.isArray(po.payments) && po.payments.length) {
      for (var i = 0; i < po.payments.length; i++) {
        var e = po.payments[i];
        paySum += parseFloat(e && (e.amount != null ? e.amount : e)) || 0;
      }
      paySum = Math.round(paySum * 100) / 100;
      if (paySum > 0.001) return paySum;
    }
    var direct = parseFloat(po.paidAmount);
    if (!Number.isNaN(direct) && direct > 0.001) return direct;
    var clipFb = parseFloat(po._clipPaidFallback);
    if (!Number.isNaN(clipFb) && clipFb > 0.001) return clipFb;
    return 0;
  }

  function poIssueDate(po) {
    return po.issueDate || po.orderDate || po.poDate || po.date || po.createdAt || '';
  }

  function poAgeDays(po) {
    var raw = poIssueDate(po);
    if (!raw) return null;
    var dt = new Date(raw);
    if (isNaN(dt.getTime())) return null;
    return Math.floor((Date.now() - dt.getTime()) / 86400000);
  }

  window.cchOmIsOpenPo = function(po) {
    if (!po) return false;
    var st = (po.status || '').toLowerCase();
    var paySt = (po.paymentStatus || '').toLowerCase();
    if (st === 'received' || st === 'cancelled' || st === 'installed' ||
        st === 'paid' || st === 'closed' || st === 'delivered') return false;
    if (paySt === 'paid') return false;
    return true;
  };

  function poSentToVendor(po) {
    if (!po) return false;
    if (po.poSentAt || po.sentAt) return true;
    var st = (po.status || '').toLowerCase();
    return st.indexOf('sent') >= 0 || st === 'waiting for confirmation' ||
      st === 'ordered' || st === 'shipped' || st === 'at receiver' ||
      st === 'at workroom' || st === 'partial' || st === 'partially received';
  }

  function hasVendorAck(po) {
    if (!po) return false;
    if (String(po.procurementStatus || '').trim() === 'Confirmed') return true;
    if (typeof window.cchPoProcurementLaneId === 'function' && window.cchPoProcurementLaneId(po) === 'confirmed') return true;
    var st = (po.status || '').toLowerCase();
    if (st === 'ordered' || st === 'shipped' || st === 'partially received' ||
        st === 'at receiver' || st === 'at workroom' || st === 'delivered') return true;
    var bill = po.bill || {};
    var rows = bill.vendorInvoices || po.vendorInvoices || [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      if (r.confirmedDate || r.confirmedAt || r.orderConfirmation || r.orderConfirmed) return true;
    }
    var groups = po.vendorInvoiceGroups || [];
    for (var j = 0; j < groups.length; j++) {
      var g = groups[j] || {};
      if (String(g.documentType || '').trim() === 'confirmation') {
        if (String(g.salesOrderNumber || g.orderConfNumber || g.vendorInvoiceNumber || '').trim()) return true;
        if (g.confirmedDate || g.attachmentName) return true;
      }
      if (String(g.salesOrderNumber || g.orderConfNumber || g.orderConfirmation || '').trim()) return true;
    }
    if (typeof window.cchPoOrderConfNumber === 'function') {
      var n = String(window.cchPoOrderConfNumber(po) || '').trim();
      if (n) return true;
    }
    return false;
  }

  window.cchOmNeedsConfirmation = function(po) {
    if (!window.cchOmIsOpenPo(po)) return false;
    if (typeof window.cchPoProcurementLaneId === 'function' && window.cchPoProcurementLaneId(po) === 'confirmed') return false;
    if (hasVendorAck(po)) return false;
    if (typeof window.cchPoProcurementLaneId === 'function') {
      return window.cchPoProcurementLaneId(po) === 'waiting';
    }
    var st = (po.status || '').toLowerCase();
    if (st === 'waiting for confirmation') return true;
    if (!poSentToVendor(po)) return false;
    return !hasVendorAck(po);
  };

  window.cchOmNeedsBill = function(po) {
    if (!po || !window.cchOmIsStudioPo(po) || !window.cchOmIsOpenPo(po)) return false;
    var info = window.cchOmBillsInfo(po);
    return !!info.awaitingBill;
  };

  function lineMissingEta(po, item, idx, items) {
    if (!item) return false;
    if (typeof window.isProposalGroupHeaderItem === 'function' &&
        window.isProposalGroupHeaderItem(item)) return false;
    if (typeof window.cchPoLineIsBillOnlyExpense === 'function' &&
        window.cchPoLineIsBillOnlyExpense(item)) return false;
    var et = String(item.expenseType || item.itemType || 'product').trim().toLowerCase();
    if (et === 'freight' || et === 'service' || et === 'expense' || et === 'sales_tax') return false;
    if (po.eta) return false;
    var meta = null;
    if (typeof window.cchPoLineEtaMetaForItem === 'function') {
      meta = window.cchPoLineEtaMetaForItem(po, item, idx, items);
    }
    if (meta && (meta.etaDate || meta.estimatedShipDate || meta.confirmedDate || meta.actualShipDate)) {
      return false;
    }
    if (item.etaDate || item.estimatedShipDate || item.confirmedDate || item.eta) return false;
    return true;
  }

  window.cchOmMissingEtaLineCount = function(po) {
    if (!po || !window.cchOmIsOpenPo(po)) return 0;
    var items = po.items || [];
    var n = 0;
    for (var i = 0; i < items.length; i++) {
      if (lineMissingEta(po, items[i], i, items)) n++;
    }
    return n;
  };

  function poEtaDisplay(po) {
    if (po.eta) return po.eta;
    var bill = po.bill || {};
    if (bill.etaDate) return fmtDate(bill.etaDate);
    return '—';
  }

  function agingBucket(days) {
    if (days == null) return 'unknown';
    if (days <= 7) return '0-7';
    if (days <= 14) return '8-14';
    if (days <= 30) return '15-30';
    return '31+';
  }

  function agingLabel(bucket) {
    if (bucket === '0-7') return '0–7 days';
    if (bucket === '8-14') return '8–14 days';
    if (bucket === '15-30') return '15–30 days';
    if (bucket === '31+') return '31+ days';
    return 'No date';
  }

  function kpiCard(label, value, sub, color, tabId) {
    var baseStyle = 'flex:1;padding:18px 22px;background:#fff;border-right:1px solid ' + OM_BORDER + ';min-width:160px;';
    var attrs = tabId
      ? ' role="button" tabindex="0" style="' + baseStyle + 'cursor:pointer;" onclick="navigate(\'#/ordermanagement/' + tabId + '\')"'
      : ' style="' + baseStyle + '"';
    return '<div' + attrs + '>' +
      '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#5C6B80;margin-bottom:6px;">' + esc(label) + '</div>' +
      '<div style="font-size:24px;font-weight:700;color:' + (color || OM_NAVY) + ';font-family:var(--font-mono);">' + esc(value) + '</div>' +
      (sub ? '<div style="font-size:11px;color:#5C6B80;margin-top:4px;">' + esc(sub) + '</div>' : '') +
      '</div>';
  }

  function omTabFromHash(hash) {
    var parts = String(hash || '').replace(/^#\/?/, '').split('/').map(function(seg) {
      return String(seg || '').trim().toLowerCase();
    }).filter(function(seg) { return seg !== ''; });
    if (parts[0] !== 'ordermanagement' && parts[0] !== 'ordermgmt') return 'open';
    var seg = parts[1] || 'open';
    if (seg === 'open' || seg === 'noeta' || seg === 'noconfirm' || seg === 'nobill' || seg === 'receiving' ||
        seg === 'bills' || seg === 'variances' || seg === 'qb') return seg;
    return 'open';
  }

  function cchOmPaintTabBar(active) {
    var bar = document.getElementById('cchOmTabBar');
    if (!bar) return false;
    var tabs = bar.querySelectorAll('[data-om-tab]');
    if (!tabs.length) return false;
    tabs.forEach(function(btn) {
      var on = btn.getAttribute('data-om-tab') === active;
      btn.style.borderBottomColor = on ? OM_NAVY : 'transparent';
      btn.style.background = on ? 'rgba(15,26,46,0.06)' : '#fff';
      btn.style.color = on ? OM_NAVY : '#5C6B80';
      btn.style.fontWeight = on ? '700' : '500';
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    return true;
  }

  function cchOmPatchCachedPo(projectId, poId, patch) {
    if (!window._omPosCache || !Array.isArray(window._omPosCache.pos)) return;
    patch = patch || {};
    for (var i = 0; i < window._omPosCache.pos.length; i++) {
      var p = window._omPosCache.pos[i];
      if (p.projectId === projectId && p.id === poId) {
        window._omPosCache.pos[i] = Object.assign({}, p, patch);
        return;
      }
    }
  }

  window.cchOmSoftRefresh = function() {
    window._omSoftRender = true;
    return window.renderOrderManagementPage();
  };

  window.cchOmInvalidateCache = function() {
    window._omPosCache = null;
    window._omClipsCache = null;
    window._omDedupeHidden = 0;
  };

  function cchOmPoShipToRaw(po) {
    po = po || {};
    var raw = String(po.shipTo || po.deliverTo || po.receiver || po.workroom || po.location || '').trim();
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
      else if (fromLines.length > 1) raw = fromLines.join(' · ');
    }
    return raw;
  }

  function cchOmPoShipToDisplay(po) {
    if (typeof window.cchPoListShipToLabel === 'function') {
      var lbl = window.cchPoListShipToLabel(po);
      return lbl ? lbl : '—';
    }
    var raw = cchOmPoShipToRaw(po);
    if (!raw) return '—';
    if (typeof window.resolvePOShipToDisplayText === 'function') {
      try {
        var resolved = window.resolvePOShipToDisplayText(raw, {}, po);
        if (resolved && String(resolved).trim()) {
          return String(resolved).trim().replace(/\s*\n+\s*/g, ', ');
        }
      } catch (_e) { /* ignore */ }
    }
    return raw.replace(/\s*\n+\s*/g, ', ');
  }

  window.cchOmIsActive = function() {
    var h = window.location.hash || '';
    return h.indexOf('/ordermanagement') >= 0 || h.indexOf('/ordermgmt') >= 0;
  };

  function omDeferVarianceBadge() {
    if (window._omVarBadgeLoading) return;
    if (typeof window.cchPoCollectVarianceRows !== 'function') return;
    window._omVarBadgeLoading = true;
    window.cchPoCollectVarianceRows().then(function(rows) {
      window._omVarBadgeLoading = false;
      var n = rows.filter(function(r) { return r.readyToBill; }).length;
      window._omVarianceReady = n;
      var el = document.getElementById('cchOmVarBadge');
      if (!el) return;
      if (n > 0) {
        el.textContent = '(' + n + ')';
        el.style.display = '';
      } else {
        el.textContent = '';
        el.style.display = 'none';
      }
    }).catch(function() {
      window._omVarBadgeLoading = false;
    });
  }

  function tabBar(active) {
    var varBadge = window._omVarianceReady > 0
      ? ' <span id="cchOmVarBadge" style="font-size:10px;color:' + OM_NAVY_MID + ';font-weight:700;">(' + window._omVarianceReady + ')</span>'
      : ' <span id="cchOmVarBadge" style="font-size:10px;color:' + OM_NAVY_MID + ';font-weight:700;display:none;"></span>';
    var tabs = [
      { id: 'open', label: 'Open POs', hash: '#/ordermanagement/open' },
      { id: 'noeta', label: 'Missing ETA', hash: '#/ordermanagement/noeta' },
      { id: 'noconfirm', label: 'Missing confirmations', hash: '#/ordermanagement/noconfirm' },
      { id: 'nobill', label: 'Missing bills', hash: '#/ordermanagement/nobill' },
      { id: 'receiving', label: 'Receiving status', hash: '#/ordermanagement/receiving' },
      { id: 'bills', label: 'Vendor bills', hash: '#/ordermanagement/bills' },
      { id: 'variances', label: 'Bill variances', hash: '#/ordermanagement/variances', badge: true },
      { id: 'qb', label: 'QuickBooks', hash: '#/ordermanagement/qb' }
    ];
    return '<div id="cchOmTabBar" style="display:flex;gap:0;margin:20px 0 16px;border-bottom:2px solid ' + OM_BORDER + ';flex-wrap:wrap;background:#fff;">' +
      tabs.map(function(t) {
        var on = active === t.id;
        var labelHtml = esc(t.label) + (t.badge ? varBadge : '');
        return '<button type="button" class="btn btn-sm" data-om-tab="' + t.id + '" aria-selected="' + (on ? 'true' : 'false') + '" style="border:none;border-bottom:3px solid ' +
          (on ? OM_NAVY : 'transparent') + ';background:' + (on ? 'rgba(15,26,46,0.06)' : '#fff') +
          ';color:' + (on ? OM_NAVY : '#5C6B80') + ' !important;font-weight:' + (on ? '700' : '500') +
          ';padding:10px 14px;margin-bottom:-2px;white-space:nowrap;" onclick="navigate(\'' + t.hash + '\')">' +
          labelHtml + '</button>';
      }).join('') +
      '</div>';
  }

  function omPageSubtitle(tab) {
    if (tab === 'bills') {
      return 'Pay vendors — open balances, awaiting bill, and per-invoice totals. Click a row to open the PO.';
    }
    if (tab === 'variances') {
      return 'Bill the client for freight, tax, and fees above the locked PO total. Batch ready variances to a client invoice.';
    }
    if (tab === 'qb') {
      return 'QuickBooks sync — push vendor bills and track QB status.';
    }
    if (tab === 'receiving') {
      return 'Selection receiving vs PO fulfillment — linked clip order status.';
    }
    if (tab === 'nobill') {
      return 'Studio POs sent to the vendor with no vendor bill received yet.';
    }
    return 'Studio PO operations — status, aging, and ETA gaps. Click a row to open the PO. Houzz legacy imports excluded.';
  }

  window.cchOmSortBy = function(field) {
    if (window._omSortField === field) {
      window._omSortDir = window._omSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      window._omSortField = field;
      window._omSortTouched = true;
      window._omSortDir = (field === 'age' || field === 'amount' || field === 'missingEta' ||
        field === 'outstanding' || field === 'bills' || field === 'paidAmount') ? 'desc' : 'asc';
      if (field === 'date') window._omSortDir = 'desc';
    }
    window.renderOrderManagementPage();
  };

  function sortArrow(field) {
    if (window._omSortField !== field) return '';
    return window._omSortDir === 'asc' ? ' ▲' : ' ▼';
  }

  function omCompareDates(a, b, dir) {
    var ta = new Date(a || 0).getTime();
    var tb = new Date(b || 0).getTime();
    if (isNaN(ta)) ta = 0;
    if (isNaN(tb)) tb = 0;
    return (ta - tb) * dir;
  }

  function sortOmRows(rows) {
    var field = window._omSortField || 'date';
    var dir = window._omSortDir === 'asc' ? 1 : -1;
    if (field === 'date') {
      return rows.slice().sort(function(a, b) {
        return omCompareDates(poIssueDate(a), poIssueDate(b), dir);
      });
    }
    return rows.slice().sort(function(a, b) {
      var va;
      var vb;
      if (field === 'number') {
        va = String(a.number || a.id || '');
        vb = String(b.number || b.id || '');
      } else if (field === 'vendor') {
        va = String(a._displayVendor || a.vendor || '').toLowerCase();
        vb = String(b._displayVendor || b.vendor || '').toLowerCase();
      } else if (field === 'project') {
        va = String(a.projectName || a.projectId || '').toLowerCase();
        vb = String(b.projectName || b.projectId || '').toLowerCase();
      } else if (field === 'shipTo') {
        va = (typeof window.cchPoListShipToLabel === 'function' ? window.cchPoListShipToLabel(a) : cchOmPoShipToDisplay(a)).toLowerCase();
        vb = (typeof window.cchPoListShipToLabel === 'function' ? window.cchPoListShipToLabel(b) : cchOmPoShipToDisplay(b)).toLowerCase();
      } else if (field === 'status') {
        va = typeof window.cchPoProcurementStatusLabel === 'function'
          ? String(window.cchPoProcurementStatusLabel(a) || '').toLowerCase()
          : String(a.status || 'Draft').toLowerCase();
        vb = typeof window.cchPoProcurementStatusLabel === 'function'
          ? String(window.cchPoProcurementStatusLabel(b) || '').toLowerCase()
          : String(b.status || 'Draft').toLowerCase();
      } else if (field === 'age') {
        va = poAgeDays(a);
        vb = poAgeDays(b);
        if (va == null) va = -1;
        if (vb == null) vb = -1;
      } else if (field === 'eta') {
        va = String(poEtaDisplay(a)).toLowerCase();
        vb = String(poEtaDisplay(b)).toLowerCase();
      } else if (field === 'missingEta') {
        va = window.cchOmMissingEtaLineCount(a);
        vb = window.cchOmMissingEtaLineCount(b);
      } else if (field === 'confirm') {
        va = window.cchOmPoConfirmDate(a) || '';
        vb = window.cchOmPoConfirmDate(b) || '';
      } else if (field === 'orderConf') {
        va = typeof window.cchPoOrderConfNumber === 'function' ? String(window.cchPoOrderConfNumber(a) || '').toLowerCase() : '';
        vb = typeof window.cchPoOrderConfNumber === 'function' ? String(window.cchPoOrderConfNumber(b) || '').toLowerCase() : '';
      } else if (field === 'bills') {
        va = window.cchOmBillsInfo(a).count;
        vb = window.cchOmBillsInfo(b).count;
      } else if (field === 'amount') {
        va = poTotal(a);
        vb = poTotal(b);
      } else if (field === 'paidAmount') {
        va = omPaidAmount(a);
        vb = omPaidAmount(b);
      } else {
        va = poIssueDate(a);
        vb = poIssueDate(b);
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

  function omFilterSummary(totalCount, filteredCount) {
    var dedupeNote = (window._omDedupeHidden > 0)
      ? ' · ' + window._omDedupeHidden + ' duplicate PO doc' + (window._omDedupeHidden !== 1 ? 's' : '') +
        ' hidden (same # per project)'
      : '';
    return '<p id="cchOmFilterSummary" style="color:var(--gray-400);margin:0 0 8px;font-size:12px;">' +
      (filteredCount === totalCount
        ? esc(String(totalCount) + ' open Studio PO' + (totalCount !== 1 ? 's' : ''))
        : 'Showing ' + filteredCount + ' of ' + totalCount + ' open Studio POs') +
      dedupeNote + ' · Houzz legacy imports excluded</p>';
  }

  function filterToolbar(projList, vendors, statuses, totalCount, filteredCount) {
    var fp = window._omFilterProject || '';
    var fv = window._omFilterVendor || '';
    var fs = window._omFilterStatus || '';
    var fa = window._omFilterAging || '';
    var kw = window._omFilterKeyword || '';
    return omFilterSummary(totalCount, filteredCount) +
      '<div id="cchOmFilterBar" style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:center;">' +
      '<input type="text" id="cchOmSearchInput" autocomplete="off" placeholder="Search PO #, vendor, project, ship to…" class="form-input" ' +
      'value="' + escAttr(kw) + '" onkeydown="event.stopPropagation();" oninput="window._omFilterKeyword=this.value;window.cchOmDebounceRender()" ' +
      'style="flex:1;min-width:220px;">' +
      '<select class="form-input" style="width:180px;" onchange="window._omFilterProject=this.value;window.renderOrderManagementPage()">' +
      '<option value="">All projects</option>' +
      projList.map(function(p) {
        return '<option value="' + escAttr(p.id) + '"' + (fp === p.id ? ' selected' : '') + '>' + esc(p.name || p.id) + '</option>';
      }).join('') +
      '</select>' +
      '<select class="form-input" style="width:160px;" onchange="window._omFilterVendor=this.value;window.renderOrderManagementPage()">' +
      '<option value="">All vendors</option>' +
      vendors.map(function(v) {
        return '<option value="' + escAttr(v) + '"' + (fv === v ? ' selected' : '') + '>' + esc(v) + '</option>';
      }).join('') +
      '</select>' +
      '<select class="form-input" style="width:150px;" onchange="window._omFilterStatus=this.value;window.renderOrderManagementPage()">' +
      '<option value="">All statuses</option>' +
      statuses.map(function(s) {
        return '<option value="' + escAttr(s) + '"' + (fs === s ? ' selected' : '') + '>' + esc(s) + '</option>';
      }).join('') +
      '</select>' +
      '<select class="form-input" style="width:130px;" onchange="window._omFilterAging=this.value;window.renderOrderManagementPage()">' +
      '<option value="">All ages</option>' +
      ['0-7', '8-14', '15-30', '31+', 'unknown'].map(function(b) {
        return '<option value="' + b + '"' + (fa === b ? ' selected' : '') + '>' + esc(agingLabel(b)) + '</option>';
      }).join('') +
      '</select>' +
      '<button type="button" class="btn btn-secondary btn-sm" onclick="window.cchOmExportFilteredCsv()" title="Download CSV of rows matching current filters">Export CSV</button>' +
      '</div>';
  }

  function applyFilters(openPos) {
    var fp = window._omFilterProject || '';
    var fv = window._omFilterVendor || '';
    var fs = window._omFilterStatus || '';
    var fa = window._omFilterAging || '';
    var kw = (window._omFilterKeyword || '').trim().toLowerCase();
    return openPos.filter(function(po) {
      if (fp && po.projectId !== fp) return false;
      var vend = String(po._displayVendor || po.vendor || '').trim();
      if (fv && vend !== fv) return false;
      var st = po.status || 'Draft';
      if (fs && st !== fs) return false;
      var bucket = agingBucket(poAgeDays(po));
      if (fa && bucket !== fa) return false;
      if (kw) {
        var blob = [po.number, po.id, vend, po.projectName, st, po.eta, cchOmPoShipToRaw(po)].join(' ').toLowerCase();
        if (blob.indexOf(kw) < 0) return false;
      }
      return true;
    });
  }

  function thSort(label, field, extraStyle) {
    var st = 'padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;cursor:pointer;user-select:none;white-space:nowrap;' + (extraStyle || '');
    return '<th style="' + st + '" onclick="window.cchOmSortBy(\'' + field + '\')">' + esc(label) + sortArrow(field) + '</th>';
  }

  function openPosTable(rows) {
    if (!rows.length) {
      return '<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-text">No open Studio POs match your filters.</div></div>';
    }
    var sorted = sortOmRows(rows);
    var td = 'padding:10px 12px;font-size:13px;';
    var body = sorted.map(function(po) {
      var age = poAgeDays(po);
      var ageTxt = age != null ? age + 'd' : '—';
      var ageColor = age == null ? '#9CA3AF' : (age > 30 ? OM_NAVY : (age > 14 ? OM_NAVY_MID : '#5C6B80'));
      var missEta = window.cchOmMissingEtaLineCount(po);
      var paidAmt = omPaidAmount(po);
      var statusHtml = omStatusCellHtml(po);
      var shipToTxt = cchOmPoShipToDisplay(po);
      var poNum = esc(po.number || po.id.substring(0, 8));
      if (po._omDedupeSiblings > 0) {
        poNum += ' <span style="font-size:9px;color:#9CA3AF;font-weight:500;" title="' +
          po._omDedupeSiblings + ' duplicate doc(s) hidden — open PO for merge/delete">dup</span>';
      }
      return '<tr style="border-bottom:1px solid var(--gray-100);cursor:pointer;" onclick="navigate(\'#/project/' +
        escAttr(po.projectId) + '/po/' + escAttr(po.id) + '\')">' +
        '<td style="' + td + 'font-weight:600;font-family:monospace;color:var(--gold);">' + poNum + '</td>' +
        '<td style="' + td + '">' + esc(po._displayVendor || po.vendor || '—') + '</td>' +
        '<td style="' + td + 'color:var(--gray-500);">' + esc(po.projectName || po.projectId) + '</td>' +
        '<td style="' + td + 'font-size:12px;color:#0F1A2E;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' +
        escAttr(shipToTxt) + '">' + esc(shipToTxt) + '</td>' +
        '<td style="' + td + '" onclick="event.stopPropagation()">' + statusHtml + '</td>' +
        '<td style="' + td + '" onclick="event.stopPropagation()">' + omOrderConfCellHtml(po) + '</td>' +
        '<td style="' + td + '" onclick="event.stopPropagation()">' + omConfirmCellHtml(po) + '</td>' +
        '<td style="' + td + 'text-align:center;" onclick="event.stopPropagation()">' + omBillsCellHtml(po) + '</td>' +
        '<td style="' + td + 'text-align:center;" onclick="event.stopPropagation()">' + omQbDotCellHtml(po) + '</td>' +
        '<td style="' + td + 'font-size:12px;color:var(--gray-500);white-space:nowrap;">' + esc(fmtDate(poIssueDate(po))) + '</td>' +
        '<td style="' + td + 'font-size:12px;color:' + ageColor + ';font-weight:600;">' + esc(ageTxt) + '</td>' +
        '<td style="' + td + '" onclick="event.stopPropagation()">' + omEtaCellHtml(po) + '</td>' +
        '<td style="' + td + 'text-align:center;font-size:12px;">' +
        (missEta > 0 ? '<span style="color:' + OM_NAVY_MID + ';font-weight:600;">' + missEta + '</span>' : '—') + '</td>' +
        '<td style="' + td + 'text-align:right;font-weight:600;font-family:monospace;">$' +
        poTotal(po).toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
        '<td style="' + td + 'text-align:right;font-family:monospace;font-size:12px;color:' +
        (paidAmt > 0.01 ? '#2E7D32' : 'var(--gray-400)') + ';" title="Vendor payments recorded on this PO">' +
        (paidAmt > 0.01 ? '$' + paidAmt.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—') + '</td>' +
        '</tr>';
    }).join('');
    return '<div id="cchOmTableWrap" class="card" style="overflow:hidden;overflow-x:auto;">' +
      '<table style="width:100%;min-width:1340px;border-collapse:collapse;font-size:13px;">' +
      '<thead><tr style="border-bottom:2px solid var(--gray-200);">' +
      thSort('PO #', 'number') +
      thSort('Vendor', 'vendor') +
      thSort('Project', 'project') +
      thSort('Shipped To', 'shipTo') +
      thSort('PO status', 'status') +
      thSort('Order conf #', 'orderConf') +
      thSort('Conf date', 'confirm') +
      thSort('Bills', 'bills', 'text-align:center;') +
      '<th style="padding:10px 12px;text-align:center;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;white-space:nowrap;" title="QuickBooks — green synced, red needs push">QB</th>' +
      thSort('Date', 'date') +
      thSort('Age', 'age') +
      thSort('ETA', 'eta') +
      thSort('Lines w/o ETA', 'missingEta', 'text-align:center;') +
      thSort('Total', 'amount', 'text-align:right;') +
      thSort('Amount paid', 'paidAmount', 'text-align:right;') +
      '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function missingEtaReport(allOpen) {
    var lines = [];
    allOpen.forEach(function(po) {
      var items = po.items || [];
      for (var i = 0; i < items.length; i++) {
        if (!lineMissingEta(po, items[i], i, items)) continue;
        var it = items[i] || {};
        lines.push({
          po: po,
          item: it,
          idx: i,
          title: it.title || it.name || 'Line ' + (i + 1)
        });
      }
    });
    if (!lines.length) {
      return '<div class="empty-state"><div class="empty-icon">✓</div><div class="empty-text">No open line items missing ETA.</div></div>';
    }
    var th = 'padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;';
    var td = 'padding:10px 12px;font-size:13px;';
    var body = lines.slice(0, 500).map(function(row) {
      var po = row.po;
      return '<tr style="border-bottom:1px solid var(--gray-100);cursor:pointer;" onclick="navigate(\'#/project/' +
        escAttr(po.projectId) + '/po/' + escAttr(po.id) + '\')">' +
        '<td style="' + td + 'font-family:monospace;color:var(--gold);font-weight:600;">' + esc(po.number || po.id) + '</td>' +
        '<td style="' + td + '">' + esc(po._displayVendor || po.vendor || '—') + '</td>' +
        '<td style="' + td + '">' + esc(po.projectName || '') + '</td>' +
        '<td style="' + td + '">' + esc(row.title) + '</td>' +
        '<td style="' + td + 'font-size:12px;">' + esc(po.status || '') + '</td>' +
        '<td style="' + td + '" onclick="event.stopPropagation()">' + omLineEtaCellHtml(po, row.item, row.idx) + '</td>' +
        '</tr>';
    }).join('');
    var more = lines.length > 500 ? '<p style="font-size:12px;color:var(--gray-500);margin:12px 0;">Showing first 500 of ' + lines.length + ' lines. Set ETA inline or click a row to open the PO.</p>' : '';
    return more + '<div class="card" style="overflow-x:auto;margin-top:8px;"><table style="width:100%;border-collapse:collapse;">' +
      '<thead><tr style="border-bottom:2px solid var(--gray-200);">' +
      '<th style="' + th + '">PO #</th><th style="' + th + '">Vendor</th><th style="' + th + '">Project</th>' +
      '<th style="' + th + '">Line item</th><th style="' + th + '">PO status</th><th style="' + th + '">ETA</th></tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function missingBillsReport(rows) {
    var note = '<p style="font-size:12px;color:#5C6B80;margin:0 0 12px;max-width:820px;line-height:1.5;">' +
      'POs sent to the vendor with no vendor invoice received. Use the <strong>Receive bill</strong> button in the Bills column, ' +
      'or open the full list on <button type="button" class="btn btn-link btn-sm" style="font-size:12px;padding:0;color:var(--gold);font-weight:700;" ' +
      'onclick="navigate(\'#/ordermanagement/bills\')">Vendor bills</button>.</p>';
    if (!rows.length) {
      return note + '<div class="empty-state"><div class="empty-icon">✓</div><div class="empty-text">No Studio POs awaiting a vendor bill.</div></div>';
    }
    return note + openPosTable(rows);
  }

  function missingConfirmReport(rows, missingEtaLines) {
    var note = '<p style="font-size:12px;color:#5C6B80;margin:0 0 12px;max-width:820px;line-height:1.5;">' +
      'POs already sent to the vendor without an order confirmation. Draft POs are not included — ' +
      'use <button type="button" class="btn btn-link btn-sm" style="font-size:12px;padding:0;color:var(--gold);font-weight:700;" ' +
      'onclick="navigate(\'#/ordermanagement/noeta\')">Missing ETA</button> for line-level delivery dates' +
      (missingEtaLines > 0 ? ' (' + missingEtaLines + ' lines on open POs).' : '.') +
      '</p>';
    if (!rows.length) {
      return note + '<div class="empty-state"><div class="empty-icon">✓</div><div class="empty-text">No Studio POs waiting on vendor confirmation.</div></div>';
    }
    return note + openPosTable(rows);
  }

  function poNumber(po) {
    return String(po.number || po.num || po.poNum || po.name || '').trim();
  }

  /** Vendor invoice rows on this PO (same sources as Vendor Bills list). */
  window.cchOmBillsInfo = function(po) {
    po = po || {};
    var bill = po.bill || {};
    var items = po.items || [];
    var hasBill = !!(bill.received || bill.qbBillId);
    var sent = typeof window.cchPoWasSentToVendor === 'function'
      ? window.cchPoWasSentToVendor(po).sent
      : !!(po.poSentAt || po.sentAt);
    var groups = typeof window.cchPoVendorInvoiceGroupsDisplay === 'function'
      ? window.cchPoVendorInvoiceGroupsDisplay(po, items)
      : (Array.isArray(po.vendorInvoiceGroups) ? po.vendorInvoiceGroups : []);
    var bills = groups.map(function(g) {
      return {
        invNum: String(g.vendorInvoiceNumber || g.label || '').trim() || 'Vendor invoice',
        groupId: String(g.id || '').trim()
      };
    }).filter(function(b) { return b.groupId || b.invNum; });
    var seen = {};
    bills = bills.filter(function(b) {
      var key = (b.groupId || '') + '|' + b.invNum;
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
    if (!bills.length && hasBill) {
      var inv = String(bill.vendorInvoiceNumber || '').trim();
      var blRef = typeof window.cchPoQbBillDocNumberFromPo === 'function'
        ? window.cchPoQbBillDocNumberFromPo(po) : '';
      bills.push({
        invNum: inv || blRef || 'Vendor bill',
        groupId: 'vig_from_bill_primary'
      });
    }
    return {
      count: bills.length,
      hasBill: hasBill,
      awaitingBill: sent && !hasBill,
      bills: bills
    };
  };

  /** Earliest vendor confirmation date on the PO (vendor invoice groups / line meta). */
  window.cchOmPoConfirmDate = function(po) {
    po = po || {};
    var items = po.items || [];
    var dates = [];
    var groups = typeof window.cchPoVendorInvoiceGroupsDisplay === 'function'
      ? window.cchPoVendorInvoiceGroupsDisplay(po, items)
      : (po.vendorInvoiceGroups || []);
    groups.forEach(function(g) {
      var d = String(g.confirmedDate || '').trim();
      if (d) dates.push(d);
    });
    if (!dates.length) {
      for (var i = 0; i < items.length; i++) {
        var d2 = '';
        if (typeof window.cchPoLineEtaMetaForItem === 'function') {
          d2 = String(window.cchPoLineEtaMetaForItem(po, items[i], i, items).confirmedDate || '').trim();
        }
        if (!d2) d2 = String(items[i].confirmedDate || '').trim();
        if (d2) dates.push(d2);
      }
    }
    if (!dates.length) return '';
    dates.sort();
    return dates[0];
  };

  window.cchOmOpenPoBill = function(projectId, poId, groupId) {
    groupId = String(groupId || '').trim();
    if (groupId && typeof window.cchPoOpenVendorInvoiceGroupModal === 'function') {
      return window.cchPoOpenVendorInvoiceGroupModal(projectId, poId, groupId);
    }
    if (typeof window.cchPoOpenReceiveBillModal === 'function') {
      return window.cchPoOpenReceiveBillModal(projectId, poId, groupId ? 'edit' : '');
    }
    navigate('#/project/' + projectId + '/po/' + poId);
  };

  function omDateInputValue(raw) {
    if (!raw) return '';
    var s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    try {
      var dt = new Date(s);
      if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    } catch (_e) { /* ignore */ }
    return '';
  }

  window.cchOmPoEtaDateIso = function(po) {
    po = po || {};
    if (po.eta) return omDateInputValue(po.eta);
    var bill = po.bill || {};
    if (bill.etaDate) return omDateInputValue(bill.etaDate);
    var items = po.items || [];
    var groups = typeof window.cchPoVendorInvoiceGroupsDisplay === 'function'
      ? window.cchPoVendorInvoiceGroupsDisplay(po, items) : [];
    for (var i = 0; i < groups.length; i++) {
      var d = omDateInputValue(groups[i].etaDate || groups[i].estimatedShipDate);
      if (d) return d;
    }
    return '';
  };

  window.cchOmPatchPrimaryVendorDates = async function(projectId, poId, fields) {
    fields = fields || {};
    var ref = firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId);
    var snap = await ref.get();
    if (!snap.exists) return;
    var doc = snap.data() || {};
    var items = doc.items || [];
    var groups = [];
    if (typeof window.cchPoVendorInvoiceGroupsUser === 'function') {
      groups = window.cchPoVendorInvoiceGroupsUser(doc).map(function(g) { return Object.assign({}, g); });
    } else if (Array.isArray(doc.vendorInvoiceGroups)) {
      groups = doc.vendorInvoiceGroups.map(function(g) { return Object.assign({}, g); });
    }
    if (!groups.length) {
      var lineIds = [];
      for (var i = 0; i < items.length; i++) {
        if (typeof window.isProposalGroupHeaderItem === 'function' &&
            window.isProposalGroupHeaderItem(items[i])) continue;
        if (typeof window.cchPoLineIsBillOnlyExpense === 'function' &&
            window.cchPoLineIsBillOnlyExpense(items[i])) continue;
        var lid = typeof window.cchPoResolveLineId === 'function'
          ? window.cchPoResolveLineId(items[i], i) : ('line_' + i);
        if (lid) lineIds.push(lid);
      }
      groups.push({
        id: 'vig_om_' + Date.now(),
        vendorInvoiceNumber: String((doc.bill || {}).vendorInvoiceNumber || '').trim(),
        vendorInvoiceDate: '',
        poLineIds: lineIds,
        confirmedDate: fields.confirmedDate != null ? fields.confirmedDate : '',
        etaDate: fields.etaDate != null ? fields.etaDate : '',
        status: '',
        label: 'Order Management'
      });
    } else {
      if (fields.confirmedDate !== undefined) groups[0].confirmedDate = fields.confirmedDate;
      if (fields.etaDate !== undefined) groups[0].etaDate = fields.etaDate;
    }
    var patch = {
      vendorInvoiceGroups: groups,
      updatedAt: new Date().toISOString()
    };
    if (fields.etaDate !== undefined) {
      patch.eta = fields.etaDate || firebase.firestore.FieldValue.delete();
      var bill = Object.assign({}, doc.bill || {});
      if (fields.etaDate) bill.etaDate = fields.etaDate;
      else delete bill.etaDate;
      patch.bill = bill;
    }
    await ref.update(patch);
    cchOmPatchCachedPo(projectId, poId, patch);
    if (typeof window.invalidateSearchCache === 'function') window.invalidateSearchCache();
    if (typeof window.showToast === 'function') window.showToast('Saved', 'success');
  };

  window.cchOmPatchLineEtaDate = async function(projectId, poId, lineIdx, etaDate) {
    lineIdx = parseInt(lineIdx, 10);
    if (isNaN(lineIdx) || lineIdx < 0) return;
    var ref = firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId);
    var snap = await ref.get();
    if (!snap.exists) return;
    var doc = snap.data() || {};
    var items = (doc.items || []).map(function(it) { return Object.assign({}, it); });
    if (lineIdx >= items.length) return;
    var item = items[lineIdx];
    var lineId = typeof window.cchPoResolveLineId === 'function'
      ? window.cchPoResolveLineId(item, lineIdx) : ('line_' + lineIdx);
    var groups = [];
    if (typeof window.cchPoVendorInvoiceGroupsUser === 'function') {
      groups = window.cchPoVendorInvoiceGroupsUser(doc).map(function(g) { return Object.assign({}, g); });
    } else if (Array.isArray(doc.vendorInvoiceGroups)) {
      groups = doc.vendorInvoiceGroups.map(function(g) { return Object.assign({}, g); });
    }
    var grpIdx = -1;
    for (var gi = 0; gi < groups.length; gi++) {
      if ((groups[gi].poLineIds || []).indexOf(lineId) >= 0) {
        grpIdx = gi;
        break;
      }
    }
    if (grpIdx >= 0) {
      groups[grpIdx].etaDate = etaDate;
    } else if (groups.length === 1 && !(groups[0].poLineIds || []).length) {
      groups[0].etaDate = etaDate;
      if (!groups[0].poLineIds) groups[0].poLineIds = [lineId];
      else if (groups[0].poLineIds.indexOf(lineId) < 0) groups[0].poLineIds.push(lineId);
    } else if (etaDate) {
      groups.push({
        id: 'vig_om_line_' + Date.now(),
        vendorInvoiceNumber: String((doc.bill || {}).vendorInvoiceNumber || '').trim(),
        vendorInvoiceDate: '',
        poLineIds: [lineId],
        confirmedDate: '',
        etaDate: etaDate,
        status: '',
        label: 'Order Management'
      });
    }
    items[lineIdx] = Object.assign({}, items[lineIdx], { etaDate: etaDate || '' });
    var patch = {
      items: items,
      vendorInvoiceGroups: groups,
      updatedAt: new Date().toISOString()
    };
    await ref.update(patch);
    cchOmPatchCachedPo(projectId, poId, patch);
    if (typeof window.invalidateSearchCache === 'function') window.invalidateSearchCache();
    if (typeof window.showToast === 'function') window.showToast('ETA saved', 'success');
  };

  window.cchOmSaveLineEtaDate = async function(projectId, poId, lineIdx, el) {
    var val = String(el && el.value || '').trim();
    if (el) el.disabled = true;
    window._omInlineSaveActive = true;
    try {
      await window.cchOmPatchLineEtaDate(projectId, poId, lineIdx, val);
      if (val && window._omTab === 'noeta') window.renderOrderManagementPage();
    } catch (e) {
      if (typeof window.showToast === 'function') window.showToast(e.message || 'Could not save ETA', 'error');
    } finally {
      window._omInlineSaveActive = false;
      if (el) el.disabled = false;
    }
  };

  window.cchOmSaveConfirmDate = async function(projectId, poId, el) {
    var val = String(el && el.value || '').trim();
    if (el) el.disabled = true;
    try {
      await window.cchOmPatchPrimaryVendorDates(projectId, poId, { confirmedDate: val });
    } catch (e) {
      if (typeof window.showToast === 'function') window.showToast(e.message || 'Could not save confirm date', 'error');
    } finally {
      if (el) el.disabled = false;
    }
  };

  window.cchOmSaveOrderConfNumber = async function(projectId, poId, el) {
    if (!el) return;
    var val = String(el.value || '').trim();
    window._omInlineSaveActive = true;
    el.disabled = true;
    try {
      if (typeof window.cchPoSaveOrderConfNumber === 'function') {
        await window.cchPoSaveOrderConfNumber(projectId, poId, val);
      }
      cchOmPatchCachedPo(projectId, poId, {
        orderConfNumber: val || null,
        orderConfirmation: val || null
      });
    } catch (e) {
      if (typeof window.showToast === 'function') window.showToast(e.message || 'Could not save order conf #', 'error');
    } finally {
      window._omInlineSaveActive = false;
      el.disabled = false;
    }
  };

  window.cchOmSaveEtaDate = async function(projectId, poId, el) {
    var val = String(el && el.value || '').trim();
    if (el) el.disabled = true;
    try {
      await window.cchOmPatchPrimaryVendorDates(projectId, poId, { etaDate: val });
    } catch (e) {
      if (typeof window.showToast === 'function') window.showToast(e.message || 'Could not save ETA', 'error');
    } finally {
      if (el) el.disabled = false;
    }
  };

  function omStatusCellHtml(po) {
    var pid = escAttr(po.projectId);
    var poid = escAttr(po.id);
    var lane = typeof window.cchPoProcurementLaneId === 'function' ? window.cchPoProcurementLaneId(po) : 'draft';
    if (lane === 'draft') {
      return '<span style="font-size:11px;font-weight:600;color:#5C6B80;">Draft</span>';
    }
    if (lane === 'confirmed') {
      var confNum = typeof window.cchPoOrderConfNumber === 'function' ? window.cchPoOrderConfNumber(po) : '';
      return '<span style="font-size:11px;font-weight:700;color:#0277BD;">Confirmed</span>' +
        (confNum ? '<div style="font-size:10px;color:#5C6B80;margin-top:2px;font-family:monospace;">' + esc(confNum) + '</div>' : '');
    }
    var cur = typeof window.cchPoProcurementStatus === 'function' ? window.cchPoProcurementStatus(po) : 'Waiting for Confirmation';
    var opts = typeof window.cchPoProcurementStatusOptionsHtml === 'function'
      ? window.cchPoProcurementStatusOptionsHtml(cur, { waitingOnly: true, excludeConfirmed: true })
      : '<option value="Waiting for Confirmation">Waiting for confirmation</option>';
    return '<select class="form-input" style="font-size:11px;padding:4px 28px 4px 8px;min-width:130px;max-width:190px;" ' +
      'data-prev-status="' + escAttr(cur) + '" onclick="event.stopPropagation()" onfocus="this.setAttribute(\'data-prev-status\',this.value)" ' +
      'onchange="window.cchOmSaveProcurementStatus(\'' + pid + '\',\'' + poid + '\',this)">' + opts + '</select>' +
      '<button type="button" class="btn btn-link btn-sm" style="font-size:10px;padding:0 0 0 4px;color:#0277BD;font-weight:700;white-space:nowrap;" ' +
      'onclick="event.stopPropagation();window.cchPoOpenMarkConfirmedModal&&window.cchPoOpenMarkConfirmedModal(\'' + pid + '\',\'' + poid + '\')">Confirm</button>';
  }

  window.cchOmSaveProcurementStatus = async function(projectId, poId, el) {
    if (!el) return;
    var status = String(el.value || '').trim();
    var prev = el.getAttribute('data-prev-status') || '';
    if (status === 'Confirmed') {
      el.value = prev;
      if (typeof window.cchPoOpenMarkConfirmedModal === 'function') {
        await window.cchPoOpenMarkConfirmedModal(projectId, poId);
      }
      return;
    }
    if (!status || status === 'Draft') {
      el.value = prev;
      return;
    }
    window._omInlineSaveActive = true;
    el.disabled = true;
    try {
      await firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).update({
        procurementStatus: status,
        updatedAt: new Date().toISOString()
      });
      cchOmPatchCachedPo(projectId, poId, { procurementStatus: status });
      el.setAttribute('data-prev-status', status);
      if (typeof window.showToast === 'function') window.showToast('PO status: ' + status, 'success');
    } catch (e) {
      el.value = prev;
      if (typeof window.showToast === 'function') window.showToast(e.message || 'Could not save PO status', 'error');
    } finally {
      window._omInlineSaveActive = false;
      el.disabled = false;
    }
  };

  window.cchOmSaveStatus = async function(projectId, poId, el) {
    if (!el) return;
    var status = String(el.value || '').trim();
    var prev = el.getAttribute('data-prev-status') || '';
    if (!status) {
      el.value = prev;
      return;
    }
    window._omInlineSaveActive = true;
    el.disabled = true;
    try {
      if (status === 'At Receiver' || status === 'At Workroom') {
        var label = status === 'At Receiver' ? 'receiver' : 'workroom';
        var loc = typeof window.cchPrompt === 'function'
          ? await window.cchPrompt('Enter ' + label + ' name:', '', 'PO location') : '';
        if (!loc) {
          el.value = prev;
          return;
        }
        if (typeof window.cchPoSetFulfillmentStatus === 'function') {
          await window.cchPoSetFulfillmentStatus(projectId, poId, status, { location: String(loc).trim() });
        }
      } else if (typeof window.cchPoSetFulfillmentStatus === 'function') {
        await window.cchPoSetFulfillmentStatus(projectId, poId, status, {});
      } else if (typeof window.updatePOStatus === 'function') {
        await window.updatePOStatus(projectId, poId, status);
      }
      cchOmPatchCachedPo(projectId, poId, { status: status });
      el.setAttribute('data-prev-status', status);
    } catch (e) {
      el.value = prev;
      if (typeof window.showToast === 'function') window.showToast(e.message || 'Could not save status', 'error');
    } finally {
      window._omInlineSaveActive = false;
      el.disabled = false;
    }
  };

  function omConfirmCellHtml(po) {
    var pid = escAttr(po.projectId);
    var poid = escAttr(po.id);
    var val = omDateInputValue(window.cchOmPoConfirmDate(po));
    return '<input type="date" class="form-input" style="font-size:11px;padding:4px 6px;width:128px;" ' +
      'value="' + escAttr(val) + '" onclick="event.stopPropagation()" ' +
      'onchange="window.cchOmSaveConfirmDate(\'' + pid + '\',\'' + poid + '\',this)" ' +
      'title="Vendor confirmation date">';
  }

  function omOrderConfCellHtml(po) {
    var pid = escAttr(po.projectId);
    var poid = escAttr(po.id);
    var val = typeof window.cchPoOrderConfNumber === 'function' ? String(window.cchPoOrderConfNumber(po) || '') : '';
    return '<input type="text" class="form-input" style="font-size:11px;padding:4px 8px;width:120px;max-width:140px;" ' +
      'value="' + escAttr(val) + '" placeholder="Order conf #" onclick="event.stopPropagation()" ' +
      'onchange="window.cchOmSaveOrderConfNumber(\'' + pid + '\',\'' + poid + '\',this)" ' +
      'title="Vendor order confirmation / sales order #">';
  }

  function omLineEtaCellHtml(po, item, idx) {
    var pid = escAttr(po.projectId);
    var poid = escAttr(po.id);
    var items = po.items || [];
    var val = '';
    if (typeof window.cchPoLineEtaMetaForItem === 'function') {
      val = omDateInputValue(window.cchPoLineEtaMetaForItem(po, item, idx, items).etaDate);
    }
    if (!val) val = omDateInputValue(item.etaDate || item.eta || '');
    return '<input type="date" class="form-input" style="font-size:11px;padding:4px 6px;width:128px;" ' +
      'value="' + escAttr(val) + '" onclick="event.stopPropagation()" ' +
      'onchange="window.cchOmSaveLineEtaDate(\'' + pid + '\',\'' + poid + '\',' + idx + ',this)" ' +
      'title="Line delivery ETA — saves to vendor invoice group">';
  }

  function omEtaCellHtml(po) {
    var pid = escAttr(po.projectId);
    var poid = escAttr(po.id);
    var val = window.cchOmPoEtaDateIso(po);
    return '<input type="date" class="form-input" style="font-size:11px;padding:4px 6px;width:128px;" ' +
      'value="' + escAttr(val) + '" onclick="event.stopPropagation()" ' +
      'onchange="window.cchOmSaveEtaDate(\'' + pid + '\',\'' + poid + '\',this)" ' +
      'title="Delivery ETA — syncs to vendor invoice group and PO">';
  }

  function omBillsCellHtml(po) {
    var info = window.cchOmBillsInfo(po);
    var pid = escAttr(po.projectId);
    var poid = escAttr(po.id);
    var billBadge = typeof window.cchPoBillStatusBadgeHtml === 'function'
      ? window.cchPoBillStatusBadgeHtml(po, { projectId: po.projectId, poId: po.id, clickable: true })
      : '';
    var actions = '';
    if (!info.count) {
      if (info.awaitingBill) {
        actions = '<button type="button" class="btn btn-secondary btn-sm" style="font-size:10px;padding:3px 8px;" ' +
          'onclick="event.stopPropagation();window.cchOmOpenPoBill(\'' + pid + '\',\'' + poid + '\',\'\')">Receive bill</button>';
      } else {
        actions = '<span style="color:var(--gray-400);font-size:12px;">—</span>';
      }
    } else if (info.count === 1) {
      var b0 = info.bills[0];
      var gid0 = escAttr(b0.groupId || '');
      actions = '<button type="button" class="btn btn-link btn-sm" style="font-size:12px;font-weight:700;color:var(--gold);padding:0;" ' +
        'onclick="event.stopPropagation();window.cchOmOpenPoBill(\'' + pid + '\',\'' + poid + '\',\'' + gid0 + '\')" ' +
        'title="Open ' + escAttr(b0.invNum) + '">1 bill</button>';
    } else {
      var menuItems = info.bills.map(function(b) {
        return '<a onclick="event.stopPropagation();window.cchOmOpenPoBill(\'' + pid + '\',\'' + poid + '\',\'' +
          escAttr(b.groupId || '') + '\');if(typeof closeAllMenus===\'function\')closeAllMenus()">' +
          esc(b.invNum) + '</a>';
      }).join('');
      actions = '<div class="action-menu-wrap" style="display:inline-block;" onclick="event.stopPropagation()">' +
        '<button type="button" class="btn btn-secondary btn-sm" style="font-size:11px;padding:3px 10px;font-weight:700;white-space:nowrap;" ' +
        'onclick="event.stopPropagation();if(typeof toggleActionMenu===\'function\')toggleActionMenu(this)" ' +
        'title="View vendor invoices">' + info.count + ' bills ▾</button>' +
        '<div class="action-dropdown" style="display:none;min-width:200px;max-width:280px;text-align:left;">' +
        menuItems + '</div></div>';
    }
    if (!billBadge) return actions;
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;">' + billBadge +
      '<div>' + actions + '</div></div>';
  }
  window.cchOmBillsCellHtml = omBillsCellHtml;

  function omQbDotCellHtml(po) {
    if (typeof window.cchPoQbDotCellHtml === 'function') {
      return window.cchPoQbDotCellHtml(po);
    }
    return '<span style="color:var(--gray-400);font-size:12px;">—</span>';
  }

  function poNumbersMatch(a, b) {
    a = String(a || '').trim().replace(/\s+/g, '');
    b = String(b || '').trim().replace(/\s+/g, '');
    if (!a || !b) return false;
    return a === b || a.replace(/^PO-?/i, '') === b.replace(/^PO-?/i, '');
  }

  function countPoMerchLines(po) {
    var items = po.items || [];
    var n = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (typeof window.isProposalGroupHeaderItem === 'function' &&
          window.isProposalGroupHeaderItem(it)) continue;
      if (typeof window.cchPoLineIsBillOnlyExpense === 'function' &&
          window.cchPoLineIsBillOnlyExpense(it)) continue;
      n++;
    }
    return n;
  }

  function orderStatusBucket(st) {
    st = String(st || '').trim().toLowerCase();
    if (st === 'received' || st === 'installed') return 'received';
    if (st === 'shipped' || st === 'in transit' || st === 'at receiver' || st === 'at workroom' ||
        st === 'partially received' || st === 'delivered') return 'intransit';
    return 'outstanding';
  }

  function poShippingStatusForOm(po) {
    if (typeof window.cchPoShippingStatus === 'function') {
      return window.cchPoShippingStatus(po, po.items || []);
    }
    return String(po.status || '').trim();
  }

  function findLinkedClipsForPo(po, clipRows) {
    if (!clipRows || !clipRows.length) return [];
    var poId = po.id;
    var num = poNumber(po);
    return clipRows.filter(function(row) {
      var c = row.data || {};
      var linked = (c.poId === poId || c.purchaseOrderId === poId);
      if (!linked && num) {
        var cn = String(c.poNum || c.houzzPO || c.purchaseOrderNum || c.po || '').trim();
        linked = poNumbersMatch(cn, num);
      }
      return linked;
    });
  }

  window.cchOmReceivingSummary = function(po, clipRows) {
    var linked = findLinkedClipsForPo(po, clipRows || []);
    var received = 0;
    var intransit = 0;
    var outstanding = 0;
    linked.forEach(function(row) {
      var b = orderStatusBucket((row.data || {}).orderStatus || (row.data || {}).status);
      if (b === 'received') received++;
      else if (b === 'intransit') intransit++;
      else outstanding++;
    });
    var poLines = countPoMerchLines(po);
    var unlinkedLines = Math.max(0, poLines - linked.length);
    var poBucket = orderStatusBucket(poShippingStatusForOm(po));
    var needsAttention = outstanding > 0 || intransit > 0 || unlinkedLines > 0 ||
      (linked.length === 0 && poLines > 0 && poBucket !== 'received');
    return {
      received: received,
      intransit: intransit,
      outstanding: outstanding,
      linked: linked.length,
      poLines: poLines,
      unlinkedLines: unlinkedLines,
      poBucket: poBucket,
      needsAttention: needsAttention,
      location: po.receiver || po.workroom || po.location || po.shipTo || ''
    };
  };

  async function cchOmLoadClipsByProject(projectIds) {
    var map = {};
    if (!projectIds.length || typeof firebase === 'undefined') return map;
    await Promise.all(projectIds.map(async function(pid) {
      try {
        var snap = await firebase.firestore().collection('boards').doc(pid).collection('clips').get();
        var rows = [];
        snap.forEach(function(d) {
          rows.push({ id: d.id, data: d.data() || {} });
        });
        map[pid] = rows;
      } catch (_e) {
        map[pid] = [];
      }
    }));
    return map;
  }

  function recvCountPill(label, count, color) {
    if (!count) return '';
    return '<span style="font-size:11px;font-weight:600;color:' + color + ';margin-right:8px;white-space:nowrap;">' +
      esc(String(count)) + ' ' + esc(label) + '</span>';
  }

  function receivingFilterToolbar(projList, vendors, totalCount, filteredCount) {
    var fp = window._omFilterProject || '';
    var fv = window._omFilterVendor || '';
    var fr = window._omRecvFilter || 'attention';
    var kw = window._omFilterKeyword || '';
    return '<p style="color:var(--gray-400);margin:0 0 8px;font-size:12px;">' +
      (filteredCount === totalCount
        ? esc(String(totalCount) + ' PO' + (totalCount !== 1 ? 's' : '') + ' in receiving view')
        : 'Showing ' + filteredCount + ' of ' + totalCount + ' POs') +
      ' · Linked room-board selections + PO status · click a row to open PO</p>' +
      '<div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:center;">' +
      '<input type="search" placeholder="Search PO #, vendor, project…" class="form-input" ' +
      'value="' + escAttr(kw) + '" oninput="window._omFilterKeyword=this.value;window.cchOmDebounceRender()" ' +
      'style="flex:1;min-width:220px;">' +
      '<select class="form-input" style="width:180px;" onchange="window._omFilterProject=this.value;window.renderOrderManagementPage()">' +
      '<option value="">All projects</option>' +
      projList.map(function(p) {
        return '<option value="' + escAttr(p.id) + '"' + (fp === p.id ? ' selected' : '') + '>' + esc(p.name || p.id) + '</option>';
      }).join('') +
      '</select>' +
      '<select class="form-input" style="width:160px;" onchange="window._omFilterVendor=this.value;window.renderOrderManagementPage()">' +
      '<option value="">All vendors</option>' +
      vendors.map(function(v) {
        return '<option value="' + escAttr(v) + '"' + (fv === v ? ' selected' : '') + '>' + esc(v) + '</option>';
      }).join('') +
      '</select>' +
      '<select class="form-input" style="width:200px;" onchange="window._omRecvFilter=this.value;window.renderOrderManagementPage()">' +
      '<option value="attention"' + (fr === 'attention' ? ' selected' : '') + '>Needs attention</option>' +
      '<option value="all"' + (fr === 'all' ? ' selected' : '') + '>All open POs</option>' +
      '<option value="intransit"' + (fr === 'intransit' ? ' selected' : '') + '>In transit</option>' +
      '<option value="noclips"' + (fr === 'noclips' ? ' selected' : '') + '>No linked selections</option>' +
      '</select>' +
      '</div>';
  }

  function applyReceivingFilters(rows) {
    var fp = window._omFilterProject || '';
    var fv = window._omFilterVendor || '';
    var fr = window._omRecvFilter || 'attention';
    var kw = (window._omFilterKeyword || '').trim().toLowerCase();
    return rows.filter(function(row) {
      var po = row.po;
      var r = row.recv;
      if (fp && po.projectId !== fp) return false;
      var vend = String(po._displayVendor || po.vendor || '').trim();
      if (fv && vend !== fv) return false;
      if (fr === 'attention' && !r.needsAttention) return false;
      if (fr === 'intransit' && !(r.intransit > 0 || r.poBucket === 'intransit')) return false;
      if (fr === 'noclips' && !(r.linked === 0 && r.poLines > 0)) return false;
      if (kw) {
        var blob = [po.number, po.id, vend, po.projectName, po.status, r.location].join(' ').toLowerCase();
        if (blob.indexOf(kw) < 0) return false;
      }
      return true;
    });
  }

  function sortReceivingRows(rows) {
    var field = window._omSortField || 'outstanding';
    var dir = window._omSortDir === 'asc' ? 1 : -1;
    return rows.slice().sort(function(a, b) {
      var poA = a.po;
      var poB = b.po;
      var rA = a.recv;
      var rB = b.recv;
      var va;
      var vb;
      if (field === 'number') {
        va = poNumber(poA);
        vb = poNumber(poB);
      } else if (field === 'vendor') {
        va = String(poA._displayVendor || poA.vendor || '').toLowerCase();
        vb = String(poB._displayVendor || poB.vendor || '').toLowerCase();
      } else if (field === 'project') {
        va = String(poA.projectName || poA.projectId || '').toLowerCase();
        vb = String(poB.projectName || poB.projectId || '').toLowerCase();
      } else if (field === 'status') {
        va = String(poA.status || '').toLowerCase();
        vb = String(poB.status || '').toLowerCase();
      } else if (field === 'received') {
        va = rA.received;
        vb = rB.received;
      } else if (field === 'intransit') {
        va = rA.intransit;
        vb = rB.intransit;
      } else if (field === 'outstanding') {
        va = rA.outstanding + rA.unlinkedLines;
        vb = rB.outstanding + rB.unlinkedLines;
      } else if (field === 'confirm') {
        va = window.cchOmPoConfirmDate(poA) || '';
        vb = window.cchOmPoConfirmDate(poB) || '';
      } else if (field === 'orderConf') {
        va = typeof window.cchPoOrderConfNumber === 'function' ? String(window.cchPoOrderConfNumber(poA) || '').toLowerCase() : '';
        vb = typeof window.cchPoOrderConfNumber === 'function' ? String(window.cchPoOrderConfNumber(poB) || '').toLowerCase() : '';
      } else if (field === 'bills') {
        va = window.cchOmBillsInfo(poA).count;
        vb = window.cchOmBillsInfo(poB).count;
      } else if (field === 'poLines') {
        va = rA.poLines;
        vb = rB.poLines;
      } else if (field === 'amount') {
        va = poTotal(poA);
        vb = poTotal(poB);
      } else {
        va = poAgeDays(poA);
        vb = poAgeDays(poB);
        if (va == null) va = -1;
        if (vb == null) vb = -1;
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

  function receivingStatusReport(allOpen, clipsByProject, projList, vendors) {
    var enriched = allOpen.map(function(po) {
      var clips = clipsByProject[po.projectId] || [];
      return { po: po, recv: window.cchOmReceivingSummary(po, clips) };
    });
    var totalPool = enriched.length;
    var filtered = applyReceivingFilters(enriched);
    if (!filtered.length) {
      return receivingFilterToolbar(projList, vendors, totalPool, 0) +
        '<div class="empty-state"><div class="empty-icon">✓</div><div class="empty-text">No POs match this receiving filter.</div></div>';
    }
    var sorted = sortReceivingRows(filtered);
    var td = 'padding:10px 12px;font-size:13px;';
    var body = sorted.map(function(row) {
      var po = row.po;
      var r = row.recv;
      var statusHtml = omStatusCellHtml(po);
      var clipSummary = r.linked
        ? recvCountPill('received', r.received, '#5FA56B') +
          recvCountPill('in transit', r.intransit, '#C4A464') +
          recvCountPill('outstanding', r.outstanding, OM_NAVY_MID)
        : '<span style="font-size:11px;color:var(--gray-400);">No linked selections</span>';
      var unlinked = r.unlinkedLines > 0
        ? '<span style="font-size:11px;color:' + OM_NAVY_MID + ';font-weight:600;">+' + r.unlinkedLines + ' unlinked line' + (r.unlinkedLines !== 1 ? 's' : '') + '</span>'
        : '—';
      return '<tr style="border-bottom:1px solid var(--gray-100);cursor:pointer;" onclick="navigate(\'#/project/' +
        escAttr(po.projectId) + '/po/' + escAttr(po.id) + '\')">' +
        '<td style="' + td + 'font-weight:600;font-family:monospace;color:var(--gold);">' + esc(po.number || po.id.substring(0, 8)) + '</td>' +
        '<td style="' + td + '">' + esc(po._displayVendor || po.vendor || '—') + '</td>' +
        '<td style="' + td + 'color:var(--gray-500);">' + esc(po.projectName || po.projectId) + '</td>' +
        '<td style="' + td + '" onclick="event.stopPropagation()">' + statusHtml + '</td>' +
        '<td style="' + td + '" onclick="event.stopPropagation()">' + omOrderConfCellHtml(po) + '</td>' +
        '<td style="' + td + '" onclick="event.stopPropagation()">' + omConfirmCellHtml(po) + '</td>' +
        '<td style="' + td + 'text-align:center;" onclick="event.stopPropagation()">' + omBillsCellHtml(po) + '</td>' +
        '<td style="' + td + 'text-align:center;" onclick="event.stopPropagation()">' + omQbDotCellHtml(po) + '</td>' +
        '<td style="' + td + 'font-size:12px;line-height:1.5;">' + clipSummary + '</td>' +
        '<td style="' + td + 'text-align:center;font-size:12px;">' + esc(String(r.poLines || '—')) + '</td>' +
        '<td style="' + td + 'text-align:center;font-size:12px;">' + unlinked + '</td>' +
        '<td style="' + td + 'font-size:12px;color:var(--gray-500);">' + esc(r.location || '—') + '</td>' +
        '<td style="' + td + 'text-align:right;font-weight:600;font-family:monospace;">$' +
        poTotal(po).toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
        '</tr>';
    }).join('');
    return receivingFilterToolbar(projList, vendors, totalPool, filtered.length) +
      '<div class="card" style="overflow:hidden;overflow-x:auto;">' +
      '<table style="width:100%;min-width:1160px;border-collapse:collapse;font-size:13px;">' +
      '<thead><tr style="border-bottom:2px solid var(--gray-200);">' +
      thSort('PO #', 'number') +
      thSort('Vendor', 'vendor') +
      thSort('Project', 'project') +
      thSort('PO status', 'status') +
      thSort('Order conf #', 'orderConf') +
      thSort('Conf date', 'confirm') +
      thSort('Bills', 'bills', 'text-align:center;') +
      '<th style="padding:10px 12px;text-align:center;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;white-space:nowrap;" title="QuickBooks — green synced, red needs push">QB</th>' +
      '<th style="padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Linked selections</th>' +
      thSort('PO lines', 'poLines', 'text-align:center;') +
      thSort('Unlinked', 'outstanding', 'text-align:center;') +
      '<th style="padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Location</th>' +
      thSort('Total', 'amount', 'text-align:right;') +
      '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  window.cchOmQbInfo = function(po) {
    po = po || {};
    var bill = po.bill || {};
    var billOnly = typeof window.cchPoQbBillOnlyMode === 'function' && window.cchPoQbBillOnlyMode();
    var pushAllowed = typeof window.cchPoQbBillPushAllowed === 'function' ? window.cchPoQbBillPushAllowed() : true;
    var qbBillId = String(bill.qbBillId || '').trim();
    var legQb = typeof window.getQbId === 'function' ? window.getQbId(po) : String(po.qbDocId || '').trim();
    var hasBill = !!(bill.received || bill.qbBillId);
    var sent = typeof window.cchPoWasSentToVendor === 'function'
      ? window.cchPoWasSentToVendor(po).sent
      : !!(po.poSentAt || po.sentAt);
    var blRef = typeof window.cchPoQbBillDocNumberFromPo === 'function'
      ? window.cchPoQbBillDocNumberFromPo(po) : '';
    var bucket = 'draft';
    if (billOnly) {
      if (qbBillId) bucket = 'synced';
      else if (hasBill && pushAllowed) bucket = 'ready';
      else if (hasBill) bucket = 'ready_staging';
      else if (sent) bucket = 'awaiting_bill';
    } else if (legQb) {
      bucket = 'synced';
    } else if (hasBill || sent) {
      bucket = 'ready';
    }
    return {
      bucket: bucket,
      needsAttention: bucket === 'ready' || bucket === 'ready_staging',
      blRef: blRef,
      qbBillId: qbBillId,
      legQb: legQb,
      hasBill: hasBill,
      sent: sent,
      billOnly: billOnly,
      pushAllowed: pushAllowed
    };
  };

  function cchOmPoQbRelevant(po) {
    if (!window.cchOmIsStudioPo(po)) return false;
    var q = window.cchOmQbInfo(po);
    return !!(q.sent || q.hasBill || q.qbBillId || q.legQb);
  }

  function qbFilterToolbar(projList, vendors, totalCount, filteredCount, stats) {
    var fp = window._omFilterProject || '';
    var fv = window._omFilterVendor || '';
    var fq = window._omQbFilter || 'attention';
    var kw = window._omFilterKeyword || '';
    stats = stats || {};
    var stagingNote = stats.pushBlocked
      ? ' · Bill push to QuickBooks is disabled on staging — use production to sync'
      : '';
    return '<p style="color:var(--gray-400);margin:0 0 8px;font-size:12px;">' +
      (filteredCount === totalCount
        ? esc(String(totalCount) + ' Studio PO' + (totalCount !== 1 ? 's' : '') + ' in QB view')
        : 'Showing ' + filteredCount + ' of ' + totalCount + ' POs') +
      ' · ' + (stats.ready || 0) + ' ready to push · ' + (stats.synced || 0) + ' synced' + stagingNote + '</p>' +
      '<div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:center;">' +
      '<input type="search" placeholder="Search PO #, vendor, bill #…" class="form-input" ' +
      'value="' + escAttr(kw) + '" oninput="window._omFilterKeyword=this.value;window.cchOmDebounceRender()" ' +
      'style="flex:1;min-width:220px;">' +
      '<select class="form-input" style="width:180px;" onchange="window._omFilterProject=this.value;window.renderOrderManagementPage()">' +
      '<option value="">All projects</option>' +
      projList.map(function(p) {
        return '<option value="' + escAttr(p.id) + '"' + (fp === p.id ? ' selected' : '') + '>' + esc(p.name || p.id) + '</option>';
      }).join('') +
      '</select>' +
      '<select class="form-input" style="width:160px;" onchange="window._omFilterVendor=this.value;window.renderOrderManagementPage()">' +
      '<option value="">All vendors</option>' +
      vendors.map(function(v) {
        return '<option value="' + escAttr(v) + '"' + (fv === v ? ' selected' : '') + '>' + esc(v) + '</option>';
      }).join('') +
      '</select>' +
      '<select class="form-input" style="width:190px;" onchange="window._omQbFilter=this.value;window.renderOrderManagementPage()">' +
      '<option value="attention"' + (fq === 'attention' ? ' selected' : '') + '>Needs QB action</option>' +
      '<option value="ready"' + (fq === 'ready' ? ' selected' : '') + '>Ready to push</option>' +
      '<option value="synced"' + (fq === 'synced' ? ' selected' : '') + '>Synced to QB</option>' +
      '<option value="all"' + (fq === 'all' ? ' selected' : '') + '>All sent / billed POs</option>' +
      '</select>' +
      '<a class="btn btn-secondary btn-sm" href="#/quickbooks" onclick="event.preventDefault();navigate(\'#/quickbooks\')">Full QB hub</a>' +
      '</div>';
  }

  function applyQbFilters(rows) {
    var fp = window._omFilterProject || '';
    var fv = window._omFilterVendor || '';
    var fq = window._omQbFilter || 'attention';
    var kw = (window._omFilterKeyword || '').trim().toLowerCase();
    return rows.filter(function(row) {
      var po = row.po;
      var q = row.qb;
      if (fp && po.projectId !== fp) return false;
      var vend = String(po._displayVendor || po.vendor || '').trim();
      if (fv && vend !== fv) return false;
      if (fq === 'attention' && !q.needsAttention) return false;
      if (fq === 'ready' && q.bucket !== 'ready' && q.bucket !== 'ready_staging') return false;
      if (fq === 'synced' && q.bucket !== 'synced') return false;
      if (kw) {
        var blob = [po.number, po.id, vend, po.projectName, q.blRef, q.qbBillId, q.legQb].join(' ').toLowerCase();
        if (blob.indexOf(kw) < 0) return false;
      }
      return true;
    });
  }

  function sortQbRows(rows) {
    var field = window._omSortField || 'date';
    var dir = window._omSortDir === 'asc' ? 1 : -1;
    if (field === 'date') {
      return rows.slice().sort(function(a, b) {
        return omCompareDates(poIssueDate(a.po), poIssueDate(b.po), dir);
      });
    }
    return rows.slice().sort(function(a, b) {
      var poA = a.po;
      var poB = b.po;
      var qA = a.qb;
      var qB = b.qb;
      var va;
      var vb;
      if (field === 'number') {
        va = poNumber(poA);
        vb = poNumber(poB);
      } else if (field === 'vendor') {
        va = String(poA._displayVendor || poA.vendor || '').toLowerCase();
        vb = String(poB._displayVendor || poB.vendor || '').toLowerCase();
      } else if (field === 'project') {
        va = String(poA.projectName || poA.projectId || '').toLowerCase();
        vb = String(poB.projectName || poB.projectId || '').toLowerCase();
      } else if (field === 'amount') {
        va = poTotal(poA);
        vb = poTotal(poB);
      } else {
        va = String(qA.blRef || qA.qbBillId || qA.legQb || '').toLowerCase();
        vb = String(qB.blRef || qB.qbBillId || qB.legQb || '').toLowerCase();
      }
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }

  function qbStatusReport(studioPos, projList) {
    var pool = studioPos.filter(cchOmPoQbRelevant);
    var enriched = pool.map(function(po) {
      return { po: po, qb: window.cchOmQbInfo(po) };
    });
    var stats = { ready: 0, synced: 0, pushBlocked: false };
    enriched.forEach(function(row) {
      if (row.qb.bucket === 'synced') stats.synced++;
      if (row.qb.bucket === 'ready' || row.qb.bucket === 'ready_staging') stats.ready++;
      if (row.qb.bucket === 'ready_staging') stats.pushBlocked = true;
    });
    var vendors = [];
    pool.forEach(function(po) {
      var v = String(po._displayVendor || po.vendor || '').trim();
      if (v && vendors.indexOf(v) < 0) vendors.push(v);
    });
    vendors.sort();
    var filtered = applyQbFilters(enriched);
    if (!filtered.length) {
      return qbFilterToolbar(projList, vendors, pool.length, 0, stats) +
        '<div class="empty-state"><div class="empty-icon">✓</div><div class="empty-text">No POs match this QuickBooks filter.</div></div>';
    }
    var sorted = sortQbRows(filtered);
    var td = 'padding:10px 12px;font-size:13px;';
    var canPush = typeof window.userCanPushToQB === 'function' && window.userCanPushToQB();
    var body = sorted.map(function(row) {
      var po = row.po;
      var q = row.qb;
      var pid = escAttr(po.projectId);
      var poid = escAttr(po.id);
      var qbHtml = typeof window.cchPoQbDotCellHtml === 'function'
        ? window.cchPoQbDotCellHtml(po)
        : (typeof window.cchPoQbListCellHtml === 'function'
          ? window.cchPoQbListCellHtml(po)
          : esc(q.bucket));
      var action = '';
      if (q.bucket === 'ready' && canPush && q.pushAllowed && typeof window.cchPoPushBillToQB === 'function') {
        action = '<button type="button" class="btn btn-primary btn-sm" style="font-size:10px;padding:4px 10px;" ' +
          'onclick="event.stopPropagation();window.cchPoPushBillToQB(\'' + pid + '\',\'' + poid + '\',null)">Push bill</button>';
      } else if (q.bucket === 'ready_staging') {
        action = '<span style="font-size:10px;color:var(--gray-400);">Prod only</span>';
      } else if (q.bucket === 'awaiting_bill') {
        action = '<button type="button" class="btn btn-secondary btn-sm" style="font-size:10px;padding:4px 10px;" ' +
          'onclick="event.stopPropagation();window.cchOmOpenPoBill(\'' + pid + '\',\'' + poid + '\',\'\')">Receive bill</button>';
      }
      return '<tr style="border-bottom:1px solid var(--gray-100);cursor:pointer;" onclick="navigate(\'#/project/' +
        pid + '/po/' + poid + '\')">' +
        '<td style="' + td + 'font-weight:600;font-family:monospace;color:var(--gold);">' + esc(po.number || po.id.substring(0, 8)) + '</td>' +
        '<td style="' + td + '">' + esc(po._displayVendor || po.vendor || '—') + '</td>' +
        '<td style="' + td + 'color:var(--gray-500);">' + esc(po.projectName || po.projectId) + '</td>' +
        '<td style="' + td + 'font-size:12px;color:var(--gray-500);white-space:nowrap;">' + esc(fmtDate(poIssueDate(po))) + '</td>' +
        '<td style="' + td + 'font-family:monospace;font-size:12px;font-weight:600;color:#1B3352;">' +
        (q.blRef ? esc(q.blRef) : '<span style="color:var(--gray-400);font-weight:400;">—</span>') + '</td>' +
        '<td style="' + td + 'text-align:center;">' + qbHtml + '</td>' +
        '<td style="' + td + 'text-align:right;font-weight:600;font-family:monospace;">$' +
        poTotal(po).toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</td>' +
        '<td style="' + td + 'text-align:center;" onclick="event.stopPropagation()">' + action + '</td>' +
        '</tr>';
    }).join('');
    return qbFilterToolbar(projList, vendors, pool.length, filtered.length, stats) +
      '<div class="card" style="overflow:hidden;overflow-x:auto;">' +
      '<table style="width:100%;min-width:980px;border-collapse:collapse;font-size:13px;">' +
      '<thead><tr style="border-bottom:2px solid var(--gray-200);">' +
      thSort('PO #', 'number') +
      thSort('Vendor', 'vendor') +
      thSort('Project', 'project') +
      thSort('Date', 'date') +
      '<th style="padding:10px 12px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Bill #</th>' +
      '<th style="padding:10px 12px;text-align:center;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;" title="QuickBooks — green synced, red failed, dash not pushed">QB</th>' +
      thSort('Total', 'amount', 'text-align:right;') +
      '<th style="padding:10px 12px;text-align:center;font-size:10px;text-transform:uppercase;color:var(--gray-400);font-weight:600;">Action</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  window.cchOmDebounceRender = function() {
    if (window._omDebounceTimer) clearTimeout(window._omDebounceTimer);
    window._omDebounceTimer = setTimeout(function() {
      window._omFilterOnlyRefresh = true;
      window.renderOrderManagementPage();
    }, 280);
  };

  window.cchOmExportFilteredCsv = function() {
    var rows = window._omLastFilteredOpen || [];
    if (!rows.length) {
      if (typeof showToast === 'function') showToast('No rows match current filters.', 'warning');
      return;
    }
    var header = ['PO #', 'Vendor', 'Project', 'Shipped To', 'Status', 'Order conf #', 'Conf date', 'Date', 'Age (days)', 'ETA', 'Lines w/o ETA', 'Total', 'Amount paid'];
    var body = rows.map(function(po) {
      var ship = typeof window.cchPoListShipToLabel === 'function' ? window.cchPoListShipToLabel(po) : cchOmPoShipToDisplay(po);
      var age = poAgeDays(po);
      var missEta = window.cchOmMissingEtaLineCount(po);
      var orderConf = typeof window.cchPoOrderConfNumber === 'function' ? window.cchPoOrderConfNumber(po) : '';
      return [
        po.number || po.id,
        po._displayVendor || po.vendor || '',
        po.projectName || po.projectId || '',
        ship === '—' ? '' : ship,
        po.status || '',
        orderConf,
        typeof window.cchOmPoConfirmDate === 'function' ? window.cchOmPoConfirmDate(po) : (po.vendorConfirmDate || po.confirmDate || ''),
        fmtDate(poIssueDate(po)),
        age != null ? String(age) : '',
        poEtaDisplay(po),
        missEta > 0 ? String(missEta) : '',
        poTotal(po).toFixed(2),
        omPaidAmount(po).toFixed(2)
      ];
    });
    if (typeof cchDownloadCsv === 'function') {
      cchDownloadCsv('order-management-open-pos-' + new Date().toISOString().slice(0, 10) + '.csv', [header].concat(body));
    } else {
      var csv = [header].concat(body).map(function(r) {
        return r.map(function(c) {
          var s = String(c == null ? '' : c);
          return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        }).join(',');
      }).join('\r\n');
      var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'order-management-open-pos-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(a);
      a.click();
      setTimeout(function() { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }
  };

  window.renderOrderManagementPage = async function() {
    var T = document.getElementById('contentArea');
    if (!T) return;

    if (!window.cchOmPageEnabled()) {
      T.innerHTML = '<h1 class="page-title">Order Management</h1>' +
        '<div class="card" style="padding:24px;margin-top:16px;"><p style="margin:0;color:var(--gray-500);">Order Management is not available in this environment.</p></div>';
      if (typeof window.setBreadcrumb === 'function') window.setBreadcrumb([{ label: 'Order Management' }]);
      if (typeof window.setTopbarActions === 'function') window.setTopbarActions('');
      return;
    }

    if (typeof isClientProjectGuestSession === 'function' && isClientProjectGuestSession()) {
      if (typeof showToast === 'function') showToast('Order Management is not available for your account.', 'warning');
      navigate('#/projects');
      return;
    }

    if (!window._omSortField) {
      window._omSortField = 'date';
      window._omSortDir = 'desc';
    }

    var hash = window.location.hash || '';
    var tab = omTabFromHash(hash);

    var forceLoad = !!window._omForceLoad;
    window._omForceLoad = false;
    var hasShell = !!document.getElementById('cchOmPanel');
    var useCache = hasShell && window._omPosCache && window._omPosCache.pos && !forceLoad;

    if (tab === 'receiving' && window._omLastTab !== 'receiving') {
      window._omSortField = 'outstanding';
      window._omSortDir = 'desc';
      if (!window._omRecvFilter) window._omRecvFilter = 'attention';
    } else if ((tab === 'open' || tab === 'qb') && window._omLastTab !== tab && !window._omSortTouched) {
      window._omSortField = 'date';
      window._omSortDir = 'desc';
    }
    if (tab === 'qb' && !window._omQbFilter) window._omQbFilter = 'attention';
    if (tab === 'bills') window._vendorBillsTab = 'bills';
    if (tab === 'variances') window._vendorBillsTab = 'variances';
    var prevTab = window._omLastTab;
    window._omLastTab = tab;
    window._omTab = tab;

    var loadingMsg = tab === 'receiving'
      ? 'Loading receiving status across projects…'
      : tab === 'qb'
        ? 'Loading QuickBooks status…'
        : tab === 'bills'
          ? 'Loading vendor bills…'
          : tab === 'variances'
            ? 'Loading bill variances…'
            : 'Loading order management…';

    if (!useCache) {
      T.innerHTML = '<div style="padding:40px;color:var(--gray-500);">' + loadingMsg + '</div>';
    }
    if (typeof window.setBreadcrumb === 'function') window.setBreadcrumb([{ label: 'Order Management' }]);
    if (typeof window.setTopbarActions === 'function') {
      window.setTopbarActions(
        '<a class="btn btn-secondary btn-sm" style="margin-right:8px;" href="#/allpos" onclick="event.preventDefault();navigate(\'#/allpos\')">All POs list</a>' +
        '<a class="btn btn-secondary btn-sm" style="margin-right:8px;" href="#/quickbooks" onclick="event.preventDefault();navigate(\'#/quickbooks\')">QB settings</a>' +
        '<span style="font-size:11px;color:var(--gray-400);">build ' + OM_BUILD + '</span>'
      );
    }

    var pos = [];
    var projList = [];
    var projNames = {};
    try {
      if (useCache) {
        pos = window._omPosCache.pos;
        projNames = window._omPosCache.projNames || {};
        projList = Object.keys(projNames).map(function(id) {
          return { id: id, name: projNames[id] };
        }).sort(function(a, b) {
          return String(a.name).localeCompare(String(b.name));
        });
      } else if (typeof window.cchPoLoadAllPosForVendorBills === 'function') {
        var loaded = await window.cchPoLoadAllPosForVendorBills();
        pos = loaded.pos || [];
        projNames = loaded.projNames || {};
        window._omDedupeHidden = loaded.dedupeHidden || 0;
        projList = Object.keys(projNames).map(function(id) {
          return { id: id, name: projNames[id] };
        }).sort(function(a, b) {
          return String(a.name).localeCompare(String(b.name));
        });
      } else if (window._cachedPOs) {
        pos = window._cachedPOs;
        var seen = {};
        pos.forEach(function(p) {
          if (!seen[p.projectId]) {
            seen[p.projectId] = true;
            projList.push({ id: p.projectId, name: p.projectName || p.projectId });
          }
        });
      }
      if (!useCache && pos.length) {
        window._omPosCache = { pos: pos, projNames: projNames, dedupeHidden: window._omDedupeHidden || 0 };
      } else if (useCache && window._omPosCache) {
        window._omDedupeHidden = window._omPosCache.dedupeHidden || 0;
      }
    } catch (err) {
      T.innerHTML = '<h1 class="page-title">Order Management</h1>' +
        '<div class="card" style="padding:24px;color:' + OM_NAVY_MID + ';">Could not load purchase orders: ' + esc(err.message || err) + '</div>';
      return;
    }

    var studioPos = pos.filter(window.cchOmIsStudioPo);
    var allOpen = studioPos.filter(window.cchOmIsOpenPo);
    var noConfirm = allOpen.filter(window.cchOmNeedsConfirmation);
    var noBill = allOpen.filter(window.cchOmNeedsBill);
    var missingEtaLines = 0;
    allOpen.forEach(function(po) { missingEtaLines += window.cchOmMissingEtaLineCount(po); });
    var openValue = allOpen.reduce(function(s, p) { return s + poTotal(p); }, 0);
    var houzzExcluded = pos.length - studioPos.length;

    var vendors = [];
    var statusSet = {};
    allOpen.forEach(function(po) {
      var v = String(po._displayVendor || po.vendor || '').trim();
      if (v && vendors.indexOf(v) < 0) vendors.push(v);
      statusSet[po.status || 'Draft'] = true;
    });
    vendors.sort();
    var statuses = Object.keys(statusSet).sort();

    var filteredOpen = applyFilters(allOpen);
    window._omLastFilteredOpen = filteredOpen.slice();

    var panel = '';
    if (tab === 'open') {
      panel = filterToolbar(projList, vendors, statuses, allOpen.length, filteredOpen.length) + openPosTable(filteredOpen);
    } else if (tab === 'noeta') {
      panel = '<p style="font-size:12px;color:#5C6B80;margin:0 0 12px;max-width:820px;line-height:1.5;">' +
        'Open PO line items with no delivery ETA. POs still in Draft are included here — ' +
        '<button type="button" class="btn btn-link btn-sm" style="font-size:12px;padding:0;color:var(--gold);font-weight:700;" ' +
        'onclick="navigate(\'#/ordermanagement/noconfirm\')">Missing confirmations</button> only lists POs already sent to the vendor.</p>' +
        missingEtaReport(allOpen);
    } else if (tab === 'noconfirm') {
      panel = missingConfirmReport(noConfirm, missingEtaLines);
    } else if (tab === 'nobill') {
      panel = missingBillsReport(noBill);
    } else if (tab === 'receiving') {
      var recvVendors = [];
      allOpen.forEach(function(po) {
        var v = String(po._displayVendor || po.vendor || '').trim();
        if (v && recvVendors.indexOf(v) < 0) recvVendors.push(v);
      });
      recvVendors.sort();
      var recvProjectIds = [];
      allOpen.forEach(function(po) {
        if (po.projectId && recvProjectIds.indexOf(po.projectId) < 0) recvProjectIds.push(po.projectId);
      });
      var clipsByProject = window._omClipsCache;
      if (!clipsByProject || forceLoad || prevTab !== 'receiving') {
        clipsByProject = await cchOmLoadClipsByProject(recvProjectIds);
        window._omClipsCache = clipsByProject;
      }
      panel = receivingStatusReport(allOpen, clipsByProject, projList, recvVendors);
    } else if (tab === 'qb') {
      panel = qbStatusReport(studioPos, projList);
    } else if (tab === 'bills') {
      var vbPreset = window._vendorBillsPreset || '';
      if (vbPreset === 'variances') vbPreset = '';
      if (typeof window.cchPoBuildVendorBillsPanelHtml === 'function') {
        panel = window.cchPoBuildVendorBillsPanelHtml(pos, projNames, vbPreset);
        window._vendorBillsPreset = '';
      } else {
        panel = '<div class="card" style="padding:24px;color:' + OM_NAVY_MID + ';">Vendor bills module not loaded.</div>';
      }
    } else if (tab === 'variances') {
      if (typeof window.cchPoBuildFirmVariancePanelHtml === 'function') {
        panel = await window.cchPoBuildFirmVariancePanelHtml();
        window._omVarianceReady = (window.__cchVarBatchRows || []).filter(function(r) { return r.readyToBill; }).length;
      } else {
        panel = '<div class="card" style="padding:24px;color:' + OM_NAVY_MID + ';">Bill variances module not loaded.</div>';
      }
    }

    var showFulfillmentKpis = tab === 'open' || tab === 'noeta' || tab === 'noconfirm' || tab === 'nobill' || tab === 'receiving';
    var kpiInner = showFulfillmentKpis
      ? kpiCard('Open POs', String(allOpen.length), 'Studio docs only', OM_NAVY, 'open') +
        kpiCard('Missing confirmation', String(noConfirm.length), 'Sent — no vendor ack', OM_NAVY_MID, 'noconfirm') +
        kpiCard('Lines without ETA', String(missingEtaLines), 'On open POs', OM_NAVY, 'noeta') +
        kpiCard('Missing bills', String(noBill.length), 'Sent — no vendor invoice', OM_NAVY_MID, 'nobill') +
        kpiCard('Open PO value', '$' + openValue.toLocaleString('en-US', { minimumFractionDigits: 2 }), 'Merchandise total', OM_NAVY)
      : '';
    var kpiBlock = showFulfillmentKpis
      ? '<div id="cchOmKpis" style="display:flex;gap:0;margin-bottom:20px;border-radius:0;overflow:hidden;border:1px solid ' + OM_BORDER + ';flex-wrap:wrap;background:#fff;">' +
        kpiInner + '</div>'
      : '<div id="cchOmKpis" style="display:none;"></div>';

    if (useCache) {
      var focusSaved = typeof window.cchCaptureListSearchFocus === 'function'
        ? window.cchCaptureListSearchFocus('cchOmSearchInput')
        : null;
      if (window._omFilterOnlyRefresh && tab === 'open') {
        window._omFilterOnlyRefresh = false;
        var sumEl = document.getElementById('cchOmFilterSummary');
        if (sumEl) sumEl.outerHTML = omFilterSummary(allOpen.length, filteredOpen.length);
        var tableWrap = document.getElementById('cchOmTableWrap');
        if (tableWrap) tableWrap.outerHTML = openPosTable(filteredOpen);
        if (typeof window.cchRestoreListSearchFocus === 'function') window.cchRestoreListSearchFocus(focusSaved);
        if (tab !== 'variances') omDeferVarianceBadge();
        return;
      }
      window._omFilterOnlyRefresh = false;
      var kpiEl = document.getElementById('cchOmKpis');
      var tabEl = document.getElementById('cchOmTabBar');
      var panelEl = document.getElementById('cchOmPanel');
      if (kpiEl) {
        if (showFulfillmentKpis) {
          kpiEl.style.display = 'flex';
          kpiEl.innerHTML = kpiInner;
        } else {
          kpiEl.style.display = 'none';
          kpiEl.innerHTML = '';
        }
      }
      if (!cchOmPaintTabBar(tab) && tabEl) tabEl.outerHTML = tabBar(tab);
      var subEl = document.getElementById('cchOmSubtitle');
      if (subEl) {
        subEl.textContent = omPageSubtitle(tab) +
          (showFulfillmentKpis && houzzExcluded > 0 ? ' (' + houzzExcluded + ' Houzz POs hidden on track tabs.)' : '');
      }
      if (panelEl) panelEl.innerHTML = panel;
      if (typeof window.cchRestoreListSearchFocus === 'function') window.cchRestoreListSearchFocus(focusSaved);
      if (tab !== 'variances') omDeferVarianceBadge();
      return;
    }

    T.innerHTML =
      '<div class="cch-om-page" style="background:#fff;color:' + OM_NAVY + ';">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:4px;">' +
      '<div><h1 class="page-title" style="margin:0;color:' + OM_NAVY + ';">Order Management</h1>' +
      '<p id="cchOmSubtitle" style="font-size:13px;color:#5C6B80;margin:8px 0 0;max-width:720px;">' + esc(omPageSubtitle(tab)) +
      (showFulfillmentKpis && houzzExcluded > 0 ? ' (' + houzzExcluded + ' Houzz POs hidden on track tabs.)' : '') +
      '</p></div></div>' +
      kpiBlock +
      tabBar(tab) +
      '<div id="cchOmPanel">' + panel + '</div>' +
      '</div>';

    if (tab !== 'variances') omDeferVarianceBadge();
  };

  document.addEventListener('DOMContentLoaded', function() {
    if (window.cchOmPageEnabled()) {
      var nav = document.getElementById('navOrderManagement');
      if (nav) nav.style.display = '';
      var vbNav = document.getElementById('navVendorBills');
      var varNav = document.getElementById('navBillVariances');
      if (vbNav) vbNav.style.display = 'none';
      if (varNav) varNav.style.display = 'none';
    }
  });

  console.log('[CCH Order Management] loaded', OM_BUILD);
})();
