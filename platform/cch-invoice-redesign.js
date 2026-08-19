/**
 * CCH — Value-forward design-services invoice (client-facing).
 * Renders INLINE on the invoice main page as the default "Client View"
 * (toggle to "Manage" for the working table), and prints the same view.
 * Isolated, display-only. No Firestore / clip / library writes.
 *
 * Exposes:
 *   window.cchIsPureDesignServicesInvoice(items) -> bool
 *   window.cchServicePeriodLabel(items, docData) -> string
 *   window.cchBuildDesignServicesInvoiceInner(docData, items, proj, projectId, docNum, dateStr) -> inline HTML (scoped)
 *   window.cchBuildDesignServicesInvoiceHTML(...)  -> full HTML doc (print window)
 *   window.cchDocSetViewMode('client'|'manage'), window.cchDsToggleDisplay(key,on), window.cchPrintCurrentDesignInvoice()
 */
(function (global) {
  'use strict';

  function esc(s) {
    if (typeof global.esc === 'function') return global.esc(s);
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function money(n) {
    var v = parseFloat(n) || 0;
    if (typeof global.formatMoney === 'function') return global.formatMoney(v);
    return '$' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function num(n) { return parseFloat(n) || 0; }

  /** FABLE_DECISION_ds-invoice-expenses — prefer shared cchInvoiceLineKind (type-only). */
  function _lineKind(it) {
    if (typeof global.cchInvoiceLineKind === 'function') return global.cchInvoiceLineKind(it);
    if (!it) return 'other';
    var et = String(it.expenseType || '').toLowerCase(), itype = String(it.itemType || '').toLowerCase();
    if (et === 'retainer_credit' || et === 'discount') return 'credit';
    if (et === 'sales_tax') return 'prepaid_tax';
    if (et === 'expense' || et === 'other_expense' || et === 'shipping' || et === 'handling' || et === 'freight') return 'expense_product';
    if (et === 'product' || itype === 'product' || itype === 'ffe') return 'product';
    if (et === 'service' || itype === 'service') return 'service';
    return 'service';
  }
  function _isProductLine(it) { return _lineKind(it) === 'product'; }
  function _isFeeLine(it) {
    var k = _lineKind(it);
    return k === 'credit' || k === 'prepaid_tax';
  }
  function _isServiceLine(it) {
    if (!it) return false;
    if (typeof global.isProposalGroupHeaderItem === 'function' && global.isProposalGroupHeaderItem(it)) return false;
    return _lineKind(it) === 'service';
  }

  global.cchIsPureDesignServicesInvoice = function (items) {
    items = items || []; var hasService = false;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (typeof global.isProposalGroupHeaderItem === 'function' && global.isProposalGroupHeaderItem(it)) continue;
      var k = _lineKind(it);
      if (k === 'expense_product' || k === 'prepaid_tax' || k === 'credit') continue;
      if (k === 'product') return false;
      if (k === 'service') hasService = true;
    }
    return hasService;
  };

  /** Time / design-services invoices use the luxury client sheet (not navy product table). */
  global.cchInvoiceUsesDesignServicesLayout = function (docData, items) {
    docData = docData || {};
    items = items || [];
    if (!items.length) return false;
    if (global.cchIsPureDesignServicesInvoice(items)) return true;
    /* Mixed invoices with product lines: product Client View — timeEntryIds alone must not hide them. */
    for (var _pi = 0; _pi < items.length; _pi++) {
      if (_isProductLine(items[_pi])) return false;
    }
    if (String(docData.source || '') === 'time-tracker') return true;
    if (Array.isArray(docData.timeEntryIds) && docData.timeEntryIds.length > 0) return true;
    return false;
  };

  function _fmtDate(s) {
    s = String(s || '').trim(); if (!s) return '';
    if (s.indexOf('T') >= 0) s = s.slice(0, 10);
    var d = new Date(s.length === 10 ? s + 'T00:00:00' : s);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  function _fmtDateFull(s) {
    s = String(s || '').trim(); if (!s) return '';
    if (s.indexOf('T') >= 0) s = s.slice(0, 10);
    var d = new Date(s.length === 10 ? s + 'T00:00:00' : s);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  /** Month–Year (or MonthA – MonthB Year) from YYYY-MM-DD; not earliest-month-only. WO-067 */
  function _periodShortFromYmd(s0, e0) {
    function parts(ymd) {
      ymd = String(ymd || '').trim().slice(0, 10);
      if (!ymd) return null;
      var d = new Date(ymd + 'T00:00:00');
      if (isNaN(d.getTime())) return null;
      return {
        month: d.toLocaleDateString('en-US', { month: 'long' }),
        year: d.getFullYear(),
        day: d.getDate(),
        y: d.getFullYear(),
        m: d.getMonth()
      };
    }
    var a = parts(s0), b = parts(e0 || s0);
    if (!a && !b) return '';
    if (!a) a = b;
    if (!b) b = a;
    // Late carryover (e.g. Jan 13) into a Feb/Mar invoice: don't stamp the leftover month on the short label.
    // Full date range (cchServicePeriodLabel) still shows the real span. Manual override: docData.servicePeriodLabel.
    var monthSpan = (b.y - a.y) * 12 + (b.m - a.m) + 1;
    if (monthSpan >= 3 && a.day >= 10) {
      var drop = new Date(a.y, a.m + 1, 1);
      a = {
        month: drop.toLocaleDateString('en-US', { month: 'long' }),
        year: drop.getFullYear(),
        day: 1,
        y: drop.getFullYear(),
        m: drop.getMonth()
      };
    }
    if (a.year === b.year && a.month === b.month) return a.month + ' ' + a.year;
    if (a.year === b.year) return a.month + ' – ' + b.month + ' ' + a.year;
    return a.month + ' ' + a.year + ' – ' + b.month + ' ' + b.year;
  }

  global.cchServicePeriodLabel = function (items, docData) {
    var starts = [], ends = [];
    (items || []).forEach(function (it) {
      var s = String((it && it.serviceDateStart) || '').trim(), e = String((it && it.serviceDateEnd) || '').trim();
      if (s) starts.push(s.slice(0, 10)); if (e) ends.push(e.slice(0, 10));
    });
    starts.sort(); ends.sort();
    var s0 = starts[0] || '', e0 = ends.length ? ends[ends.length - 1] : (starts.length ? starts[starts.length - 1] : '');
    if (s0 && e0 && s0 !== e0) return _fmtDateFull(s0) + ' – ' + _fmtDateFull(e0);
    if (s0) return _fmtDateFull(s0);
    var d = String((docData && (docData.date || docData.createdAt)) || '').trim();
    return d ? _fmtDateFull(d) : '';
  };

  /** Short billing-period label for header / rollup (WO-067: span months, don't stamp earliest only). */
  global.cchServicePeriodShortLabel = function (items, docData) {
    var override = String((docData && (docData.servicePeriodLabel || docData.billingPeriodLabel)) || '').trim();
    if (override) return override;
    var starts = [], ends = [];
    (items || []).forEach(function (it) {
      var s = String((it && it.serviceDateStart) || '').trim(), e = String((it && it.serviceDateEnd) || '').trim();
      if (s) starts.push(s.slice(0, 10)); if (e) ends.push(e.slice(0, 10));
    });
    starts.sort(); ends.sort();
    var s0 = starts[0] || '', e0 = ends.length ? ends[ends.length - 1] : (starts.length ? starts[starts.length - 1] : '');
    if (s0 || e0) return _periodShortFromYmd(s0, e0 || s0);
    var d = String((docData && (docData.date || docData.createdAt)) || '').trim().slice(0, 10);
    return d ? _periodShortFromYmd(d, d) : '';
  };

  function _clientVal(v, fb) {
    if (typeof global.cchSanitizeClientDisplayValue === 'function') return global.cchSanitizeClientDisplayValue(v, fb);
    return (v && String(v).trim()) ? v : (fb || '');
  }

  function _lineRate(it) {
    if (!it) return 0;
    var r = parseFloat(it.rate);
    if (r > 0) return r;
    var q = num(it.qty), a = num(it.amount);
    if (q > 0 && a > 0) return Math.round((a / q) * 100) / 100;
    return 0;
  }

  function _datesFromLineNotes(it) {
    var notes = String((it && (it.lineNotes || it.notes)) || '');
    var dates = [];
    notes.split(/\r?\n/).forEach(function (l) {
      var m = l.trim().match(/^(\d{4}-\d{2}-\d{2})\b/);
      if (m) dates.push(m[1]);
    });
    if (!dates.length) return '';
    dates.sort();
    var a = _fmtDate(dates[0]), b = _fmtDate(dates[dates.length - 1]);
    if (a && b && a !== b) return a + ' – ' + b;
    return a || b || '';
  }

  function _lineDateRange(it) {
    if (!it) return '';
    var a = _fmtDate(it.serviceDateStart), b = _fmtDate(it.serviceDateEnd);
    if (a && b && a !== b) return a + ' – ' + b;
    if (a) return a;
    if (b) return b;
    return _datesFromLineNotes(it);
  }

  function _lineHours(it) {
    if (!it) return '';
    var q = num(it.qty);
    if (q > 0) return q;
    var h = num(it.hours);
    if (h > 0) return h;
    h = num(it.trackedHrs);
    if (h > 0) return h;
    var dm = String(it.description || '').match(/^\s*([\d.]+)\s*(?:hours?|hrs?)\b/i);
    if (dm) return parseFloat(dm[1]) || '';
    return '';
  }

  function _findSvcItem(svcItems, o, i) {
    if (svcItems[i]) return svcItems[i];
    var t = String((o && o.title) || '').trim().toLowerCase();
    if (!t) return null;
    for (var j = 0; j < svcItems.length; j++) {
      var st = String(svcItems[j].title || svcItems[j].name || svcItems[j].service || '').trim().toLowerCase();
      if (st === t) return svcItems[j];
    }
    return null;
  }

  function _lineNotesBody(it) {
    if (!it) return '';
    var body = typeof global.cchLineNotesBodyText === 'function'
      ? global.cchLineNotesBodyText(it)
      : String(it.lineNotes || it.notes || '').trim();
    if (typeof global.cchStripDateOnlyNoteLines === 'function') {
      body = global.cchStripDateOnlyNoteLines(body);
    }
    return String(body || '').trim();
  }

  function _outcomeFromLine(o, it) {
    o = o || {};
    it = it || {};
    var dr = String(o.dateRange || '').trim();
    if (!dr) dr = _lineDateRange(it);
    var hrs = (o.hours != null && o.hours !== '') ? o.hours : '';
    if (hrs === '' || hrs == null) hrs = _lineHours(it);
    var rate = _lineRate(it);
    var title = String(o.title || '').trim();
    if (!title) {
      title = (typeof global.invoiceLineDisplayTitle === 'function')
        ? global.invoiceLineDisplayTitle(it) : (it.title || it.name || 'Design Services');
    }
    // Client View: AI / saved outcome prose wins. Never dump Manage "+ Notes" time-log (WO-067).
    var aiDesc = String(o.description || o.desc || '').trim();
    var desc = aiDesc;
    if (!desc) {
      var fallback = String(it.description || '').trim();
      if (fallback && fallback.split(/\r?\n/).filter(Boolean).length <= 3 && fallback.length < 280) {
        desc = fallback;
      }
    }
    if (desc && typeof global.sanitizeInvoicePreviewLineText === 'function') desc = global.sanitizeInvoicePreviewLineText(desc);
    if (desc) desc = desc.replace(/^\s*[\d.]+\s*(?:hours?|hrs?)\b\s*[\u2014\u2013\-·:]*\s*/i, '').trim();
    return {
      title: title || 'Design Services',
      desc: desc,
      dateRange: dr,
      hours: hrs,
      rate: rate > 0 ? rate : ''
    };
  }

  /** Expense product lines — type/billingCategory only (FABLE: no title regex). */
  function _isExpenseProductLine(it) {
    if (!it) return false;
    if (typeof global.isProposalGroupHeaderItem === 'function' && global.isProposalGroupHeaderItem(it)) return false;
    return _lineKind(it) === 'expense_product';
  }

  function _lineSubtotal(it) {
    if (typeof global.invoiceLineAmountForTotals === 'function') {
      return num(global.invoiceLineAmountForTotals(it).lineAmt);
    }
    return num(it && it.amount);
  }

  /** Product-style expense rows for Client View (never hrs/$/hr). */
  function _expenseProductRows(items) {
    var rows = [];
    (items || []).forEach(function (it) {
      if (!_isExpenseProductLine(it)) return;
      var qty = num(it.qty);
      if (qty <= 0) qty = 1;
      var subtotal = _lineSubtotal(it);
      if (Math.abs(subtotal) < 0.005) return;
      var cost = num(it.cost);
      if (cost <= 0) {
        var rate = num(it.rate) || num(it.unitPrice);
        cost = rate > 0 ? rate : (Math.round((subtotal / qty) * 100) / 100);
      }
      var title = (typeof global.invoiceLineDisplayTitle === 'function')
        ? global.invoiceLineDisplayTitle(it)
        : (it.title || it.name || 'Expense');
      var desc = _lineNotesBody(it);
      if (!desc) {
        desc = String(it.description || '').trim();
        if (desc && typeof global.sanitizeInvoicePreviewLineText === 'function') {
          desc = global.sanitizeInvoicePreviewLineText(desc);
        }
      }
      rows.push({ title: title || 'Expense', desc: desc, qty: qty, cost: cost, subtotal: subtotal });
    });
    return rows;
  }

  /** Prepaid sales tax only — stays under totals (not product table, not hour outcomes). */
  function _passThroughFeeRows(items) {
    var rows = [];
    (items || []).forEach(function (it) {
      if (!it) return;
      if (typeof global.isProposalGroupHeaderItem === 'function' && global.isProposalGroupHeaderItem(it)) return;
      var et = String(it.expenseType || '').toLowerCase();
      if (et !== 'sales_tax') return;
      if (typeof global.cchIsClientSalesTaxLine === 'function' && global.cchIsClientSalesTaxLine(it)) return;
      var amt = _lineSubtotal(it);
      if (Math.abs(amt) < 0.005) return;
      var label = (typeof global.invoiceLineDisplayTitle === 'function')
        ? global.invoiceLineDisplayTitle(it)
        : (it.title || it.name || 'Pre-Paid Sales Tax');
      rows.push({ label: label, amount: amt, expenseType: et });
    });
    return rows;
  }

  /** Match AI/clientOutcomes row to a live service line (title first, then index). */
  function _findOutcomeForItem(co, it, i) {
    if (!Array.isArray(co) || !co.length || !it) return null;
    var t = String(it.title || it.name || it.service || '').trim().toLowerCase();
    if (t) {
      for (var j = 0; j < co.length; j++) {
        var ot = String((co[j] && co[j].title) || '').trim().toLowerCase();
        if (ot && ot === t) return co[j];
      }
    }
    if (co[i]) return co[i];
    return null;
  }

  /** Live invoice service lines win. Stale clientOutcomes never invent phantom rows. */
  function _outcomes(docData, items) {
    var svcItems = [];
    (items || []).forEach(function (it) { if (_isServiceLine(it)) svcItems.push(it); });
    var co = docData && docData.clientOutcomes;
    if (svcItems.length) {
      return svcItems.map(function (it, i) {
        return _outcomeFromLine(_findOutcomeForItem(co, it, i) || {}, it);
      });
    }
    /* No service lines left — do not resurrect orphan AI outcomes. */
    return [];
  }

  /** Pure design-services / hours invoices never show client sales tax (WO-067 fail #3). */
  function _forceDsNoTax(totals, items) {
    totals = totals || {};
    if (typeof global.cchIsPureDesignServicesInvoice === 'function' && !global.cchIsPureDesignServicesInvoice(items || [])) {
      return totals;
    }
    var taxWas = num(totals.tax);
    totals.tax = 0;
    totals.taxableSubtotal = 0;
    if (taxWas > 0.01) {
      var g = num(totals.grandTotal);
      if (g >= taxWas) totals.grandTotal = Math.round((g - taxWas) * 100) / 100;
    }
    return totals;
  }

  function _grand(docData, items, proj) {
    var totals;
    if (typeof global.invoiceViewTotals === 'function') {
      try { totals = global.invoiceViewTotals(docData, items, proj); } catch (e) {}
    }
    if (totals) return _forceDsNoTax(totals, items);
    var t = parseFloat(docData && docData.total); if (!isNaN(t) && t > 0) return { grandTotal: t, subtotal: t, credits: [], creditTotal: 0, tax: 0, totalShipping: 0, taxRate: 0 };
    var s = 0; (items || []).forEach(function (it) { s += num(it.amount); });
    return { grandTotal: s, subtotal: s, credits: [], creditTotal: 0, tax: 0, totalShipping: 0, taxRate: 0 };
  }

  /** Paid total, balance, and payment rows — same helpers as Manage view / premium PDF. */
  function _paySummary(docData, grand) {
    docData = docData || {};
    var gt = num(grand);
    var summary = { rows: [], totalPaid: 0, balance: gt, grandTotal: gt };
    if (typeof global.invoiceDocPaymentSummary === 'function') {
      try { summary = global.invoiceDocPaymentSummary(docData, gt, 'invoice'); } catch (_ePay) {}
    } else {
      var pays = Array.isArray(docData.payments) ? docData.payments : [];
      var tp = pays.reduce(function (s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
      var explicit = parseFloat(docData.paidAmount || docData.amountPaid || docData.totalPaid || 0) || 0;
      if (tp <= 0.01 && explicit > 0.01) tp = explicit;
      summary = { rows: pays, totalPaid: tp, balance: Math.max(0, gt - tp), grandTotal: gt };
    }
    summary.totalPaid = num(summary.totalPaid);
    summary.balance = summary.balance != null ? num(summary.balance) : Math.max(0, gt - summary.totalPaid);
    summary.rows = summary.rows || [];
    return summary;
  }

  function _ctx(docData, items, proj, projectId, docNum, dateStr) {
    docData = docData || {}; items = items || []; proj = proj || {};
    var name = _clientVal(docData.clientName || docData.client || docData.billingContactName || proj.clientName || proj.billingContactName || '', proj.clientName || '');
    if (!name && proj.name && String(proj.name).indexOf(' - ') >= 0) name = String(proj.name).split(' - ')[0].trim();
    if (!name) name = proj.name || 'Valued Client';
    var addr = _clientVal(docData.clientAddress || docData.billingAddress || docData.address || proj.clientAddress || proj.billingAddress || proj.address || '', proj.clientAddress || '');
    var phone = _clientVal(docData.clientPhone || docData.phone || proj.clientPhone || proj.phone || '', proj.clientPhone || '');
    var period = global.cchServicePeriodLabel(items, docData);
    var pShort = (typeof global.cchServicePeriodShortLabel === 'function')
      ? global.cchServicePeriodShortLabel(items, docData)
      : '';
    if (!pShort && period) {
      var m = period.match(/^[A-Za-z]+/); var y = period.match(/\d{4}/);
      pShort = (m ? m[0] : '') + (y ? ' ' + y[0] : '');
    }
    var projAddr = (typeof global.cchProjectAddressFromData === 'function')
      ? String(global.cchProjectAddressFromData(proj, docData) || '').trim()
      : String(docData.projectAddress || proj.projectAddress || proj.address || proj.siteAddress || proj.jobSiteAddress || '').trim();
    var outs = _outcomes(docData, items); var th = 0; outs.forEach(function (o) { th += num(o.hours); });
    var expenseRows = _expenseProductRows(items);
    var totals = _grand(docData, items, proj);
    if (typeof totals === 'number') totals = { grandTotal: totals, subtotal: totals, credits: [], creditTotal: 0, tax: 0, totalShipping: 0, taxRate: 0 };
    var feeRows = _passThroughFeeRows(items);
    var workSub = 0;
    (items || []).forEach(function (it) {
      if (_isServiceLine(it)) workSub += _lineSubtotal(it);
    });
    var grand = num(totals.grandTotal);
    var pay = _paySummary(docData, grand);
    return {
      docNum: docNum, name: name, addrLine: addr ? esc(addr).replace(/\n/g, '<br>') : '', phone: phone,
      projName: proj.name || projectId || '', projAddrLine: projAddr ? esc(projAddr).replace(/\n/g, '<br>') : '',
      period: period, periodShort: pShort,
      summary: String(docData.clientSummary || '').trim(), outcomes: outs,
      expenseRows: expenseRows,
      workSubtotal: workSub,
      feeRows: feeRows,
      credits: totals.credits || [],
      creditTotal: num(totals.creditTotal),
      tax: num(totals.tax),
      totalShipping: num(totals.totalShipping),
      taxRate: num(totals.taxRate),
      grand: grand,
      totalPaid: pay.totalPaid, balance: pay.balance, payments: pay.rows,
      totalHours: th, status: (typeof global.cchInvoiceClientDisplayStatus === 'function') ? global.cchInvoiceClientDisplayStatus(docData) : (docData.status || 'Due on receipt'),
      note: String(docData.clientNote || '').trim() || 'Thank you, as always, for the trust you place in us. It’s a privilege to keep shaping the way your home lives.'
    };
  }

  var DEEP_NAVY = '#0E1629';
  var RULES = [
    ['.sheet', 'background:#FFFFFF;padding:32px 48px 8px;display:flex;flex-direction:column;'],
    ['.head', 'display:flex;justify-content:space-between;align-items:flex-start;flex-shrink:0;'],
    ['.brand-mark', 'font-family:"Cormorant Garamond",serif;font-size:32px;font-weight:600;letter-spacing:6px;color:' + DEEP_NAVY + ';line-height:0.95;'],
    ['.brand-sub', 'font-size:9px;letter-spacing:4px;color:' + DEEP_NAVY + ';text-transform:uppercase;margin-top:4px;opacity:0.9;'],
    ['.brand-contact', 'font-size:11px;line-height:1.6;color:#414C59;margin-top:10px;'],
    ['.doc-meta', 'text-align:right;padding-top:2px;'],
    ['.doc-kicker', 'font-family:"Cormorant Garamond",serif;font-size:26px;font-weight:500;letter-spacing:2px;color:' + DEEP_NAVY + ';'],
    ['.doc-num', 'font-size:12px;letter-spacing:2px;color:#A8792F;margin-top:2px;'],
    ['.doc-status', 'display:inline-block;margin-top:8px;border:1px solid rgba(168,121,47,0.4);color:#A8792F;font-size:9.5px;letter-spacing:2.5px;text-transform:uppercase;padding:4px 12px;'],
    ['.gold-rule', 'height:2px;background:rgba(168,121,47,0.4);margin:16px 0 0;flex-shrink:0;'],
    ['.body', 'padding:18px 0 0;flex:1;display:flex;flex-direction:column;min-height:0;'],
    ['.body-main', 'flex:1;'],
    ['.meta-row', 'display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:18px;padding-bottom:16px;border-bottom:1px solid rgba(27,51,82,0.14);'],
    ['.lbl', 'font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#A8792F;font-weight:600;margin-bottom:6px;'],
    ['.billto-name', 'font-family:"Cormorant Garamond",serif;font-size:18px;font-weight:600;color:' + DEEP_NAVY + ';line-height:1.2;'],
    ['.billto-line', 'font-size:12px;color:#414C59;line-height:1.55;margin-top:2px;'],
    ['.meta-val', 'font-size:12.5px;color:' + DEEP_NAVY + ';font-weight:500;line-height:1.45;'],
    ['.meta-sub', 'font-size:11.5px;color:#414C59;line-height:1.5;margin-top:2px;'],
    ['.intro', 'font-size:13px;color:#414C59;line-height:1.6;margin:14px 0 4px;max-width:96%;'],
    ['.section-eyebrow', 'display:flex;align-items:baseline;justify-content:space-between;margin:18px 0 4px;'],
    ['.section-title', 'font-family:"Cormorant Garamond",serif;font-size:22px;font-weight:600;color:' + DEEP_NAVY + ';'],
    ['.section-period', 'font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#56616E;'],
    ['.section-underline', 'height:1px;background:rgba(168,121,47,0.4);margin-bottom:6px;'],
    ['.outcome', 'display:grid;grid-template-columns:34px 1fr;gap:14px;padding:14px 0;border-bottom:1px solid rgba(27,51,82,0.14);align-items:start;'],
    ['.o-num', 'font-family:"Cormorant Garamond",serif;font-size:22px;color:#A8792F;font-weight:500;line-height:1.1;padding-top:2px;'],
    ['.o-head', 'display:flex;justify-content:space-between;align-items:baseline;gap:14px;'],
    ['.o-title', 'font-size:15px;font-weight:600;color:' + DEEP_NAVY + ';'],
    ['.o-meta', 'font-size:11px;color:#56616E;white-space:nowrap;letter-spacing:0.4px;'],
    ['.o-meta b', 'color:' + DEEP_NAVY + ';font-weight:600;'],
    ['.o-desc', 'font-size:13px;color:#414C59;line-height:1.7;margin-top:5px;max-width:95%;white-space:pre-wrap;'],
    ['.exp-table', 'width:100%;border-collapse:collapse;margin-top:18px;'],
    ['.exp-table th', 'padding:8px 6px;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#A8792F;font-weight:600;border-bottom:1px solid rgba(168,121,47,0.35);'],
    ['.exp-table th.num', 'text-align:center;'],
    ['.exp-table th.money', 'text-align:right;'],
    ['.exp-table td', 'padding:12px 6px;vertical-align:top;border-bottom:1px solid rgba(27,51,82,0.14);color:' + DEEP_NAVY + ';'],
    ['.exp-table td.item', 'font-size:14px;font-weight:600;'],
    ['.exp-table .exp-desc', 'font-size:12px;font-weight:400;color:#414C59;line-height:1.55;margin-top:4px;white-space:pre-wrap;'],
    ['.exp-table .exp-desc-empty', 'font-size:12px;font-weight:400;color:#9AA3AD;font-style:italic;margin-top:4px;'],
    ['.exp-table td.num', 'text-align:center;font-size:13px;white-space:nowrap;'],
    ['.exp-table td.money', 'text-align:right;font-size:13px;font-variant-numeric:tabular-nums;white-space:nowrap;'],
    ['.exp-table td.subtotal', 'text-align:right;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;'],
    ['.total-wrap', 'display:flex;justify-content:flex-end;margin-top:20px;'],
    ['.total-card', 'min-width:320px;'],
    ['.total-row', 'display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;font-size:13px;color:#414C59;'],
    ['.total-grand', 'display:flex;justify-content:space-between;align-items:baseline;margin-top:8px;padding-top:12px;border-top:2px solid ' + DEEP_NAVY + ';'],
    ['.total-grand .g-label', 'font-family:"Cormorant Garamond",serif;font-size:18px;color:' + DEEP_NAVY + ';font-weight:600;'],
    ['.total-grand .g-amt', 'font-family:"Cormorant Garamond",serif;font-size:22px;color:' + DEEP_NAVY + ';font-weight:700;'],
    ['.total-row.payment', 'color:#2E7D32;font-weight:600;'],
    ['.total-row.payment-detail', 'font-size:11px;color:#56616E;padding-left:10px;'],
    ['.total-row.balance-due', 'font-weight:600;color:' + DEEP_NAVY + ';margin-top:6px;padding-top:10px;border-top:1px solid rgba(27,51,82,0.35);'],
    ['.total-row.balance-due span:last-child', 'color:#A8792F;'],
    ['.terms', 'text-align:right;font-size:11px;color:#56616E;margin-top:8px;'],
    ['.note', 'margin-top:28px;padding:18px 22px;background:#FFFFFF;border-left:2px solid #A8792F;border-top:1px solid rgba(27,51,82,0.14);border-right:1px solid rgba(27,51,82,0.14);border-bottom:1px solid rgba(27,51,82,0.14);'],
    ['.note-q', 'font-family:"Cormorant Garamond",serif;font-size:17px;font-style:italic;color:#293441;line-height:1.6;'],
    ['.note-sign', 'font-size:12px;color:#414C59;margin-top:12px;'],
    ['.foot', 'text-align:center;padding:24px 0 28px;margin-top:auto;border-top:1px solid rgba(27,51,82,0.14);flex-shrink:0;'],
    ['.foot-mark', 'font-family:"Cormorant Garamond",serif;font-size:18px;letter-spacing:6px;color:' + DEEP_NAVY + ';'],
    ['.foot-tag', 'font-size:9.5px;letter-spacing:3px;text-transform:uppercase;color:#56616E;margin-top:7px;'],
    ['.foot-line', 'font-size:11px;color:#56616E;margin-top:7px;'],
    ['.ds-dates', 'display:none;'],
    ['.ds-hours', 'display:none;'],
    ['.ds-rate', 'display:none;']
  ];
  function _css(prefix) { return RULES.map(function (r) { return prefix + r[0] + '{' + r[1] + '}'; }).join(''); }

  function _metaHtml(o) {
    var chunks = [];
    if (o.dateRange) chunks.push('<span class="ds-dates">' + esc(o.dateRange) + '</span>');
    if (o.hours !== '' && o.hours != null && num(o.hours) > 0) {
      chunks.push('<span class="ds-hours"> · <b>' + (Math.round(num(o.hours) * 10) / 10) + ' hrs</b></span>');
    }
    if (o.rate) chunks.push('<span class="ds-rate"> · ' + money(o.rate) + '/hr</span>');
    return chunks.length ? '<div class="o-meta">' + chunks.join('') + '</div>' : '';
  }

  function _paymentLineLabel(p) {
    p = p || {};
    var lbl = 'Payment';
    if (p.method) lbl += ' — ' + p.method;
    else if (p.source === 'QuickBooks') lbl += ' — QuickBooks';
    if (p.date) lbl += ' — ' + (_fmtDateFull(p.date) || String(p.date).slice(0, 10));
    return lbl;
  }

  function _fmtQty(q) {
    q = num(q);
    if (Math.abs(q - Math.round(q)) < 0.001) return String(Math.round(q));
    return String(Math.round(q * 100) / 100);
  }

  function _expenseTableHtml(rows) {
    rows = rows || [];
    if (!rows.length) return '';
    var body = '';
    rows.forEach(function (r) {
      var descHtml = r.desc
        ? '<div class="exp-desc">' + esc(r.desc) + '</div>'
        : '<div class="exp-desc-empty">Description</div>';
      body += '<tr>' +
        '<td class="item">' + esc(r.title || 'Expense') + descHtml + '</td>' +
        '<td class="num">' + esc(_fmtQty(r.qty)) + '</td>' +
        '<td class="money">' + money(r.cost) + '</td>' +
        '<td class="subtotal">' + money(r.subtotal) + '</td>' +
        '</tr>';
    });
    return '<table class="exp-table" role="table">' +
      '<thead><tr>' +
      '<th style="text-align:left;">Item</th>' +
      '<th class="num">Qty</th>' +
      '<th class="money">Cost</th>' +
      '<th class="money">Subtotal</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table>';
  }

  function _totalsBlock(c) {
    var hrsTot = c.totalHours ? '<span class="ds-hours"> · ' + (Math.round(c.totalHours * 10) / 10) + ' hours</span>' : '';
    var workSub = c.workSubtotal != null ? num(c.workSubtotal) : 0;
    var html = '';
    if (workSub > 0.005 || (c.outcomes && c.outcomes.length)) {
      html += '<div class="total-row"><span>Design Services' + hrsTot + (c.periodShort ? ' — ' + esc(c.periodShort) : '') + '</span><span>' + money(workSub) + '</span></div>';
    }
    /* Prepaid tax only — expenses already listed in product-style table above. */
    (c.feeRows || []).forEach(function (fr) {
      if (!fr || Math.abs(num(fr.amount)) < 0.005) return;
      html += '<div class="total-row"><span>' + esc(fr.label || 'Pre-Paid Sales Tax') + '</span><span>' + money(fr.amount) + '</span></div>';
    });
    if (num(c.totalShipping) > 0.01) {
      html += '<div class="total-row"><span>Shipping</span><span>' + money(c.totalShipping) + '</span></div>';
    }
    if (num(c.tax) > 0.01) {
      html += '<div class="total-row"><span>Sales tax' + (c.taxRate > 0 ? ' (' + c.taxRate + '%)' : '') + '</span><span>' + money(c.tax) + '</span></div>';
    }
    (c.credits || []).forEach(function (cr) {
      if (!cr || Math.abs(num(cr.amount)) < 0.01) return;
      html += '<div class="total-row"><span>' + esc(cr.label || 'Credit') + '</span><span style="color:#7B1FA2;">' + money(cr.amount) + '</span></div>';
    });
    var totalPaid = num(c.totalPaid);
    var balance = c.balance != null ? num(c.balance) : Math.max(0, num(c.grand) - totalPaid);
    var hasPay = totalPaid > 0.01 || (c.payments && c.payments.length > 0);
    if (hasPay) {
      html += '<div class="total-row payment"><span>Paid</span><span>-' + money(totalPaid) + '</span></div>';
      (c.payments || []).forEach(function (p) {
        var amt = parseFloat(p.amount) || 0;
        if (amt <= 0) return;
        html += '<div class="total-row payment-detail"><span>' + esc(_paymentLineLabel(p)) + '</span><span>-' + money(amt) + '</span></div>';
      });
      if (balance > 0.01) {
        html += '<div class="total-row balance-due"><span>Balance Due</span><span>' + money(balance) + '</span></div>';
      } else {
        html += '<div class="total-grand"><span class="g-label">Paid in Full</span><span class="g-amt">' + money(0) + '</span></div>';
      }
    } else {
      html += '<div class="total-grand"><span class="g-label">Total Due</span><span class="g-amt">' + money(c.grand) + '</span></div>';
    }
    html += '<div class="terms">Payable on receipt · Thank you</div>';
    return html;
  }

  function _printSheetLayoutCss(extra) {
    return (extra || '') +
      '@media print{html,body{height:auto;margin:0;}' +
      '.sheet{min-height:0;box-shadow:none!important;}' +
      '.preview-body,#cchInvClientLanding{min-height:0;display:block;}' +
      '#cchInvClientLanding .sheet{width:100%;}}';
  }

  function _sheet(c) {
    var outcomesHtml = '';
    (c.outcomes || []).forEach(function (o, i) {
      var n = (i + 1) < 10 ? '0' + (i + 1) : '' + (i + 1);
      var metaHtml = _metaHtml(o);
      outcomesHtml += '<div class="outcome"><div class="o-num">' + n + '</div><div>' +
        '<div class="o-head"><div class="o-title">' + esc(o.title) + '</div>' + metaHtml + '</div>' +
        (o.desc ? '<div class="o-desc">' + esc(o.desc) + '</div>' : '') + '</div></div>';
    });
    var expenseHtml = _expenseTableHtml(c.expenseRows);
    var hoursBlock = '';
    if (outcomesHtml) {
      hoursBlock = '<div class="section-eyebrow"><div class="section-title">Design Services</div><div class="section-period">The month’s work</div></div>' +
        '<div class="section-underline"></div>' + outcomesHtml;
    } else if (!expenseHtml) {
      hoursBlock = '<div class="section-eyebrow"><div class="section-title">Design Services</div><div class="section-period">The month’s work</div></div>' +
        '<div class="section-underline"></div>';
    }
    return '<div class="sheet">' +
      '<div class="head"><div>' +
        '<div class="brand-mark">CCH</div><div class="brand-sub">Design Inc</div>' +
        '<div class="brand-contact">2481 N. Riverside Dr. · Santa Ana, CA 92706<br>(949) 497‑7979 · cindy@cchdesign.com<br>www.cchdesign.com</div>' +
      '</div><div class="doc-meta">' +
        '<div class="doc-kicker">Invoice</div><div class="doc-num">' + esc(c.docNum) + '</div>' +
        '<div class="doc-status">' + esc(c.status) + '</div>' +
      '</div></div><div class="gold-rule"></div>' +
      '<div class="body"><div class="body-main"><div class="meta-row">' +
        '<div><div class="lbl">Prepared for</div><div class="billto-name">' + esc(c.name) + '</div>' +
          '<div class="billto-line">' + (c.addrLine ? c.addrLine + '<br>' : '') + (c.phone ? esc(c.phone) : '') + '</div></div>' +
        '<div><div class="lbl">Project</div><div class="meta-val">' + esc(c.projName) + '</div>' +
          (c.projAddrLine ? '<div class="meta-sub">' + c.projAddrLine + '</div>' : '') + '</div>' +
        '<div><div class="lbl">Service period</div><div class="meta-val">' + esc(c.periodShort || '') + '</div>' +
          (c.period ? '<div class="meta-sub">' + esc(c.period) + '</div>' : '') + '</div>' +
      '</div>' +
      (c.summary ? '<p class="intro">' + esc(c.summary) + '</p>' : '') +
      hoursBlock + expenseHtml +
      '<div class="total-wrap"><div class="total-card">' + _totalsBlock(c) + '</div></div>' +
      '<div class="note"><div class="note-q">“' + esc(c.note) + '”</div><div class="note-sign">— Cindy Holloway · CCH Design Inc.</div></div>' +
      '</div>' +
      '<div class="foot"><div class="foot-mark">CCH</div><div class="foot-tag">Residential &amp; Yacht Design</div><div class="foot-line">www.cchdesign.com · @cchdesigninc</div></div>' +
      '</div></div>';
  }

  global.cchBuildDesignServicesInvoiceInner = function (docData, items, proj, projectId, docNum, dateStr) {
    var c = _ctx(docData, items, proj, projectId, docNum, dateStr);
    return '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">' +
      '<style>' + _css('#cchInvClientLanding ') + '#cchInvClientLanding{background:#FFFFFF;}#cchInvClientLanding .sheet{max-width:820px;margin:0 auto;box-shadow:0 14px 44px rgba(15,31,56,0.14);background:#FFFFFF;}' +
      _printSheetLayoutCss('#cchInvClientLanding ') + '</style>' +
      '<div id="cchDocClientView">' + _sheet(c) + '</div>';
  };

  global.cchBuildDesignServicesInvoiceHTML = function (docData, items, proj, projectId, docNum, dateStr, displayOpts) {
    var c = _ctx(docData, items, proj, projectId, docNum, dateStr);
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ' + esc(c.docNum) + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">' +
      '<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:"DM Sans",sans-serif;background:#FFFFFF;-webkit-font-smoothing:antialiased;}' +
      '.sheet{max-width:820px;margin:28px auto;box-shadow:0 14px 44px rgba(15,31,56,0.14);background:#FFFFFF;}' + _css('') +
      _printSheetLayoutCss() +
      '@media print{body{background:#fff;}.sheet{margin:0;max-width:100%;}}</style></head><body>' +
      _sheet(c) + _dsDisplayBootScript(displayOpts || global._cchDsDisplay) +
      '</body></html>';
  };

  function _dsDisplayBootScript(disp) {
    disp = disp || {};
    return '<script>(function(){var d=' + JSON.stringify({ dates: !!disp.dates, hours: !!disp.hours, rate: !!disp.rate }) + ';' +
      'function cchDsToggleDisplay(k,on){d[k]=!!on;var els=document.querySelectorAll(".ds-"+k);for(var i=0;i<els.length;i++){els[i].style.display=on?(els[i].tagName==="SPAN"?"inline":"block"):"none";}}' +
      '["dates","hours","rate"].forEach(function(k){if(d[k])cchDsToggleDisplay(k,true);});})();<\/script>';
  }

  function _defaultDsDisplay() {
    return { dates: false, hours: false, rate: false };
  }

  global.cchApplyDsDisplay = function () {
    var disp = global._cchDsDisplay || _defaultDsDisplay();
    ['dates', 'hours', 'rate'].forEach(function (k) {
      var on = !!disp[k];
      var e = document.querySelectorAll('#cchInvClientLanding .ds-' + k);
      for (var i = 0; i < e.length; i++) e[i].style.display = on ? (e[i].tagName === 'SPAN' ? 'inline' : 'block') : 'none';
    });
  };

  global.cchDsToggleDisplay = function (key, on) {
    if (!global._cchDsDisplay) global._cchDsDisplay = _defaultDsDisplay();
    if (key === 'dates' || key === 'hours' || key === 'rate') global._cchDsDisplay[key] = !!on;
    try { localStorage.setItem('cchDsClientDisplay', JSON.stringify(global._cchDsDisplay)); } catch (_eLs) {}
    document.querySelectorAll('[data-cch-ds="' + key + '"]').forEach(function (cb) { cb.checked = !!on; });
    global.cchApplyDsDisplay();
  };

  global.cchInitDsDisplayToggles = function () {
    var disp = _defaultDsDisplay();
    try {
      var saved = JSON.parse(localStorage.getItem('cchDsClientDisplay') || '{}');
      if (saved && typeof saved === 'object') {
        disp.dates = !!saved.dates;
        disp.hours = !!saved.hours;
        disp.rate = !!saved.rate;
      }
    } catch (_eParse) {}
    global._cchDsDisplay = disp;
    ['dates', 'hours', 'rate'].forEach(function (k) {
      document.querySelectorAll('[data-cch-ds="' + k + '"]').forEach(function (cb) { cb.checked = !!disp[k]; });
    });
    global.cchApplyDsDisplay();
  };

  global.cchBuildDsDisplayToggleHtml = function (compact) {
    var lbl = compact
      ? 'font-size:12px;color:#5C6B80;display:inline-flex;gap:5px;align-items:center;cursor:pointer;margin-left:4px;vertical-align:middle;white-space:nowrap;'
      : 'font-size:12px;color:#5C6B80;display:inline-flex;gap:5px;align-items:center;cursor:pointer;background:#fff;padding:6px 12px;border:1px solid rgba(27,51,82,0.12);border-radius:4px;';
    function chk(k, text) {
      return '<label style="' + lbl + '"><input type="checkbox" data-cch-ds="' + k + '" onchange="cchDsToggleDisplay(\'' + k + '\',this.checked)"> ' + text + '</label>';
    }
    return chk('dates', 'Show date') + chk('hours', 'Show hours') + chk('rate', 'Show rate');
  };

  global.cchDocSetViewMode = function (mode) {
    var x = global._cchInvViewCtx || global._cchDsCtx;
    if (x && x.projectId && x.docId && typeof global.setInvoiceLandingViewModeUI === 'function') {
      global.setInvoiceLandingViewModeUI(x.projectId, x.docId, mode === 'manage' ? 'manage' : 'client');
      return;
    }
    if (x && x.projectId && x.docId && typeof global.renderInvoiceDetail === 'function') {
      try { localStorage.setItem('cchDocViewMode', mode === 'manage' ? 'manage' : 'client'); } catch (e) {}
      void global.renderInvoiceDetail(x.projectId, x.docId);
      return;
    }
  };

  global.cchPrintCurrentInvoice = async function (projectId, docId) {
    var x = global._cchInvViewCtx || global._cchDsCtx || {};
    var sameDoc = String(x.projectId || '') === String(projectId || '') && String(x.docId || '') === String(docId || '');
    var items = sameDoc ? (x.items || []) : null;
    var docData = sameDoc ? (x.docData || {}) : {};
    if (!items && typeof global.db !== 'undefined' && global.db) {
      try {
        var snap = await global.db.collection('boards').doc(projectId).collection('invoices').doc(docId).get();
        if (snap.exists) {
          docData = snap.data() || {};
          items = docData.items || [];
        }
      } catch (_eLd) { items = []; }
    }
    if (items && typeof global.cchInvoiceUsesDesignServicesLayout === 'function' &&
        global.cchInvoiceUsesDesignServicesLayout(docData, items)) {
      if (!sameDoc) {
        global._cchInvViewCtx = { projectId: projectId, docId: docId, items: items, docData: docData, proj: {} };
      }
      global._cchDsCtx = global._cchInvViewCtx || x;
      global.cchPrintCurrentDesignInvoice();
      return;
    }
    if (typeof global.previewDocument === 'function') {
      await global.previewDocument('invoice', projectId, docId, { _premiumBuild: true, _printOnly: true });
    }
  };

  global.cchHydrateInvoicePremiumClientEmbed = async function (projectId, docId) {
    if (typeof global.previewDocument !== 'function') return;
    await global.previewDocument('invoice', projectId, docId, { _premiumBuild: true, _embedOnly: true });
  };

  global.cchPrintCurrentDesignInvoice = function () {
    var x = global._cchDsCtx; if (!x) { window.print(); return; }
    var w = window.open('', '_blank');
    if (!w) {
      if (typeof global.showToast === 'function') global.showToast('Pop-up blocked — allow pop-ups for this site', 'error');
      return;
    }
    w.document.open();
    w.document.write(global.cchBuildDesignServicesInvoiceHTML(x.docData, x.items, x.proj, x.projectId, x.docNum, x.dateStr, global._cchDsDisplay));
    w.document.close();
    try { w.focus(); w.print(); } catch (_eP) {}
  };

  /** Preview popup for design-services invoices — toolbar with date/hours/rate toggles + Print. */
  global.cchWriteDesignServicesPreviewWindow = function (win, docData, items, proj, projectId, docId) {
    if (!win) return;
    docData = docData || {};
    items = items || [];
    proj = proj || {};
    var docNum = docData.invoiceNum || docData.number || docId.slice(0, 8);
    var dateRaw = docData.date || docData.createdAt || '';
    var dateStr = dateRaw && typeof global.formatDate === 'function' ? global.formatDate(dateRaw) : String(dateRaw || '').slice(0, 10);
    global._cchInvViewCtx = { projectId: projectId, docId: docId, items: items, docData: docData, proj: proj, docNum: docNum, dateStr: dateStr };
    global._cchDsCtx = global._cchInvViewCtx;
    var disp = _defaultDsDisplay();
    try {
      var saved = JSON.parse(localStorage.getItem('cchDsClientDisplay') || '{}');
      if (saved && typeof saved === 'object') {
        disp.dates = !!saved.dates;
        disp.hours = !!saved.hours;
        disp.rate = !!saved.rate;
      }
    } catch (_eLs) {}
    global._cchDsDisplay = disp;
    var c = _ctx(docData, items, proj, projectId, docNum, dateStr);
    function chk(k, text, on) {
      return '<label style="font-size:12px;color:#EDE8E0;display:inline-flex;gap:5px;align-items:center;cursor:pointer;margin-left:8px;white-space:nowrap;">' +
        '<input type="checkbox" data-cch-ds="' + k + '"' + (on ? ' checked' : '') + ' onchange="cchDsPrevToggle(\'' + k + '\',this.checked)"> ' + text + '</label>';
    }
    var _portalOpen = !!global._cchPortalDocOpen;
    if (_portalOpen) global._cchPortalDocOpen = false;
    var toggles = _portalOpen
      ? ''
      : (chk('dates', 'Show date', disp.dates) + chk('hours', 'Show hours', disp.hours) + chk('rate', 'Show rate', disp.rate));
    var _invPay = Object.assign({ id: docId }, docData);
    /* One Pay in toolbar only — CC + Zelle are on the portal Pay page. */
    var payTb = (typeof global.cchInvoiceClientPayBarHtml === 'function')
      ? global.cchInvoiceClientPayBarHtml(projectId, _invPay, { toolbar: true }) : '';
    var payBar = '';
    win.document.open();
    win.document.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Invoice ' + esc(c.docNum) + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">' +
      '<style>*{box-sizing:border-box;margin:0;padding:0;}' +
      'html{font-size:17px;}' +
      'body{font-family:"DM Sans",sans-serif;background:#C5CDD8;-webkit-font-smoothing:antialiased;}' +
      '.toolbar{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;justify-content:space-between;align-items:center;padding:10px 20px;background:#1B3352;color:#EDE8E0;box-shadow:0 2px 12px rgba(0,0,0,0.2);}' +
      '.toolbar-title{font-size:14px;font-weight:600;color:#C4A464;} .toolbar-actions{display:flex;align-items:center;flex-wrap:wrap;gap:4px;}' +
      '.tb-btn{background:transparent;border:1px solid rgba(200,185,154,0.5);color:#C8B99A;padding:7px 14px;font-size:12px;cursor:pointer;border-radius:3px;font-family:inherit;}' +
      '.tb-btn:hover{background:rgba(200,185,154,0.15);} .tb-btn-primary{background:#C4A464;color:#1B3352;border-color:#C4A464;font-weight:600;}' +
      /* Screen: fill the window — was max-width:820px which looked postage-stamp on large monitors */
      '.preview-body{padding:64px 20px 40px;max-width:1180px;margin:0 auto;width:100%;}' +
      '.sheet{width:100%;max-width:1100px;margin:0 auto;box-shadow:0 18px 48px rgba(15,31,56,0.18);background:#FFFFFF;}' +
      _css('#cchInvClientLanding ') +
      _printSheetLayoutCss() +
      '@media print{html{font-size:12pt;} .toolbar{display:none!important;}.cch-inv-pay-bar{display:none!important;}' +
      'body{background:#fff;}.preview-body{padding:0;max-width:none;}.sheet{max-width:100%;box-shadow:none!important;}}</style></head><body>' +
      '<div class="toolbar"><div class="toolbar-title">Invoice ' + esc(c.docNum) + '</div>' +
      '<div class="toolbar-actions">' + payTb + toggles +
      '<button class="tb-btn tb-btn-primary" onclick="window.print()">🖨️ Print / PDF</button></div></div>' +
      '<div class="preview-body">' + payBar + '<div id="cchInvClientLanding">' + _sheet(c) + '</div></div>' +
      '<script>var _cchDsDisp=' + JSON.stringify(disp) + ';' +
      'function cchDsPrevToggle(k,on){_cchDsDisp[k]=!!on;try{localStorage.setItem("cchDsClientDisplay",JSON.stringify(_cchDsDisp));}catch(e){}' +
      '["dates","hours","rate"].forEach(function(key){var show=!!_cchDsDisp[key];document.querySelectorAll(".ds-"+key).forEach(function(el){el.style.display=show?(el.tagName==="SPAN"?"inline":"block"):"none";});});' +
      'document.querySelectorAll("[data-cch-ds]").forEach(function(cb){cb.checked=!!_cchDsDisp[cb.getAttribute("data-cch-ds")];});}' +
      '["dates","hours","rate"].forEach(function(k){if(_cchDsDisp[k])cchDsPrevToggle(k,true);});<\/script></body></html>'
    );
    win.document.close();
    try { win.focus(); } catch (_eF) {}
  };

  function _noteLinesFor(items) {
    var lines = [];
    (items || []).forEach(function (it) {
      if (!_isServiceLine(it)) return;
      var body = typeof global.cchLineNotesBodyText === 'function'
        ? global.cchLineNotesBodyText(it)
        : String(it.lineNotes || it.notes || '').trim();
      if (typeof global.cchStripDateOnlyNoteLines === 'function') {
        body = global.cchStripDateOnlyNoteLines(body);
      }
      if (body) {
        body.split(/\r?\n/).forEach(function (l) {
          l = l.trim();
          if (l) lines.push(l);
        });
      }
      var desc = String(it.description || '').trim();
      if (desc && !/^\d{4}-\d{2}-\d{2}\b/.test(desc) && lines.indexOf(desc) < 0) {
        lines.push(desc);
      }
    });
    return lines;
  }

  async function _noteLinesForInvoice(ctx) {
    ctx = ctx || {};
    var lines = _noteLinesFor(ctx.items || []);
    if (lines.length) return lines;
    var ids = ctx.docData && ctx.docData.timeEntryIds;
    if (Array.isArray(ids) && ids.length && typeof db !== 'undefined' && db) {
      try {
        var snaps = await Promise.all(ids.map(function (id) {
          return db.collection('timeEntries').doc(String(id)).get();
        }));
        snaps.forEach(function (s) {
          if (!s.exists) return;
          var t = s.data() || {};
          var n = String(t.notes || t.note || t.description || '').trim();
          if (n && lines.indexOf(n) < 0) lines.push(n);
        });
      } catch (e) { console.warn('[cchDsDraftWithAI] time entry notes', e); }
    }
    return lines;
  }

  function _dsOutcomeRow(o) {
    o = o || {};
    return '<div class="cch-ds-orow" style="display:grid;grid-template-columns:1fr 92px 64px 26px;gap:8px;margin-bottom:8px;align-items:start;">' +
      '<div style="display:flex;flex-direction:column;gap:6px;">' +
        '<input class="cch-ds-title" placeholder="Outcome title" value="' + esc(o.title || '') + '" style="font-size:13px;padding:7px 9px;border:1px solid rgba(27,51,82,0.2);border-radius:4px;">' +
        '<textarea class="cch-ds-desc" rows="2" placeholder="What was accomplished" style="font-size:12px;padding:7px 9px;border:1px solid rgba(27,51,82,0.2);border-radius:4px;resize:vertical;">' + esc(o.description || '') + '</textarea>' +
      '</div>' +
      '<input class="cch-ds-date" placeholder="May 1 - 8" value="' + esc(o.dateRange || '') + '" style="font-size:12px;padding:7px 9px;border:1px solid rgba(27,51,82,0.2);border-radius:4px;">' +
      '<input class="cch-ds-hours" placeholder="hrs" value="' + esc(o.hours != null ? o.hours : '') + '" style="font-size:12px;padding:7px 9px;border:1px solid rgba(27,51,82,0.2);border-radius:4px;">' +
      '<button type="button" title="Remove" onclick="cchDsRemoveOutcome(this)" style="border:none;background:transparent;color:#B45309;font-size:16px;cursor:pointer;padding-top:6px;">×</button>' +
    '</div>';
  }

  global.cchBuildDsEditor = function (docData, projectId, docId) {
    docData = docData || {};
    var sum = String(docData.clientSummary || '');
    var outs = Array.isArray(docData.clientOutcomes) ? docData.clientOutcomes : [];
    var rows = ''; outs.forEach(function (o) { rows += _dsOutcomeRow(o); }); if (!rows) rows = _dsOutcomeRow({});
    return '<div class="cch-ds-editor" style="background:#FBF9F5;border:1px solid rgba(168,121,47,0.3);border-radius:6px;padding:18px 20px;margin-bottom:18px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px;flex-wrap:wrap;">' +
        '<div style="font-size:12px;text-transform:uppercase;letter-spacing:1.5px;color:#A8792F;font-weight:700;">Client summary &amp; outcomes</div>' +
        '<button type="button" class="btn btn-secondary btn-sm" onclick="cchDsDraftWithAI(\'' + projectId + '\',\'' + docId + '\')">✨ Draft with AI</button>' +
      '</div>' +
      '<label style="font-size:11px;color:#5C6B80;font-weight:600;display:block;margin-bottom:4px;">Summary</label>' +
      '<textarea id="cchDsSummary" rows="2" style="width:100%;font-size:13px;padding:8px 10px;border:1px solid rgba(27,51,82,0.2);border-radius:4px;resize:vertical;margin-bottom:14px;">' + esc(sum) + '</textarea>' +
      '<div id="cchDsOutcomes">' + rows + '</div>' +
      '<div style="display:flex;gap:10px;margin-top:12px;">' +
        '<button type="button" class="btn btn-secondary btn-sm" onclick="cchDsAddOutcome()">+ Add outcome</button>' +
        '<button type="button" class="btn btn-primary btn-sm" style="background:#1B3352;color:#EDE8E0;" onclick="cchDsSaveSummary(\'' + projectId + '\',\'' + docId + '\')">Save &amp; refresh</button>' +
      '</div>' +
    '</div>';
  };

  global.cchDsAddOutcome = function () { var c = document.getElementById('cchDsOutcomes'); if (!c) return; var d = document.createElement('div'); d.innerHTML = _dsOutcomeRow({}); c.appendChild(d.firstChild); };
  global.cchDsRemoveOutcome = function (btn) { var r = btn && btn.closest('.cch-ds-orow'); if (r) r.parentNode.removeChild(r); };

  function _dsCollect() {
    var sum = (document.getElementById('cchDsSummary') || {}).value || '';
    var outs = [], rows = document.querySelectorAll('#cchDsOutcomes .cch-ds-orow');
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var t = (r.querySelector('.cch-ds-title') || {}).value || '', d = (r.querySelector('.cch-ds-desc') || {}).value || '';
      var dr = (r.querySelector('.cch-ds-date') || {}).value || '', h = (r.querySelector('.cch-ds-hours') || {}).value || '';
      if (String(t).trim() || String(d).trim()) outs.push({ title: String(t).trim(), description: String(d).trim(), dateRange: String(dr).trim(), hours: String(h).trim() });
    }
    return { summary: String(sum).trim(), outcomes: outs };
  }

  /** WO-067 fail #2 — human edits win. AI only fills empty fields; never clobber saved/typed text. */
  function _dsMergeAiDraft(existing, ai) {
    existing = existing || {};
    ai = ai || {};
    var prevOut = Array.isArray(existing.outcomes) ? existing.outcomes : [];
    var aiOut = Array.isArray(ai.outcomes) ? ai.outcomes : [];
    var hasHuman = !!(String(existing.summary || '').trim() ||
      prevOut.some(function (o) {
        return !!(String((o && o.title) || '').trim() || String((o && o.description) || '').trim());
      }));
    if (!hasHuman) {
      return {
        summary: String(ai.summary || '').trim(),
        outcomes: aiOut.map(function (o) {
          o = o || {};
          return {
            title: String(o.title || '').trim(),
            description: String(o.description || '').trim(),
            dateRange: String(o.dateRange || '').trim(),
            hours: o.hours != null ? o.hours : ''
          };
        })
      };
    }
    var summary = String(existing.summary || '').trim() || String(ai.summary || '').trim();
    var n = Math.max(prevOut.length, aiOut.length);
    var outs = [];
    for (var i = 0; i < n; i++) {
      var e = prevOut[i] || {};
      var a = aiOut[i] || {};
      var title = String(e.title || '').trim() || String(a.title || '').trim();
      var description = String(e.description || '').trim() || String(a.description || '').trim();
      var dateRange = String(e.dateRange || '').trim() || String(a.dateRange || '').trim();
      var hours = (e.hours != null && String(e.hours).trim() !== '') ? e.hours : (a.hours != null ? a.hours : '');
      if (title || description) outs.push({ title: title, description: description, dateRange: dateRange, hours: hours });
    }
    return { summary: summary, outcomes: outs, keptHuman: true };
  }

  global.cchDsSaveSummary = function (projectId, docId) {
    var data = _dsCollect();
    if (typeof db === 'undefined' || !db) { if (typeof showToast === 'function') showToast('Cannot save - db unavailable'); return; }
    db.collection('boards').doc(projectId).collection('invoices').doc(docId).update({ clientSummary: data.summary, clientOutcomes: data.outcomes }).then(function () {
      if (typeof showToast === 'function') showToast('Client summary saved', 2500);
      if (global._docEdit && global._docEdit.docData) { global._docEdit.docData.clientSummary = data.summary; global._docEdit.docData.clientOutcomes = data.outcomes; }
      if (global._cchDsCtx && global._cchDsCtx.docData) { global._cchDsCtx.docData.clientSummary = data.summary; global._cchDsCtx.docData.clientOutcomes = data.outcomes; }
      if (typeof renderInvoiceDetail === 'function') renderInvoiceDetail(projectId, docId);
    }).catch(function (e) { if (typeof showToast === 'function') showToast('Save failed: ' + ((e && e.message) || e)); });
  };

  global.cchDsDraftWithAI = function (projectId, docId) {
    var x = global._cchDsCtx || {};
    if (typeof showToast === 'function') showToast('Drafting summary with AI...', 2000);
    _noteLinesForInvoice(x).then(function (notes) {
      if (!notes.length) {
        if (typeof showToast === 'function') {
          showToast('Add line notes (not just dates) or time-entry descriptions, then try again.', 5000);
        }
        return;
      }
      var fn;
      try { fn = firebase.app().functions('us-central1').httpsCallable('draftInvoiceSummary'); } catch (e) {
        if (typeof showToast === 'function') showToast('AI not available');
        return;
      }
      var periodHint = (typeof global.cchServicePeriodShortLabel === 'function')
        ? global.cchServicePeriodShortLabel(x.items || [], x.docData || {})
        : '';
      if (!periodHint) periodHint = global.cchServicePeriodLabel(x.items || [], x.docData || {});
      fn({
        notes: notes,
        projectName: (x.proj && x.proj.name) || '',
        period: periodHint,
        clientFirstName: (typeof global.cchVoiceProfile !== 'undefined' && global.cchVoiceProfile.firstName)
          ? global.cchVoiceProfile.firstName((x.proj && x.proj.clientName) || (x.docData && x.docData.clientName) || '')
          : String((x.proj && x.proj.clientName) || '').trim().split(/\s+/)[0],
        clientName: (x.proj && x.proj.clientName) || (x.docData && x.docData.clientName) || '',
        greetingStyle: (typeof global.cchVoiceProfile !== 'undefined' && global.cchVoiceProfile.clientGreetingStyleFromProject)
          ? global.cchVoiceProfile.clientGreetingStyleFromProject(x.proj || {})
          : 'hi'
      }).then(function (res) {
        var d = (res && res.data) || {};
        if (typeof global.cchVoiceProfile !== 'undefined' && global.cchVoiceProfile.sanitizeInvoiceDraft) {
          d = global.cchVoiceProfile.sanitizeInvoiceDraft(d);
        }
        var merged = _dsMergeAiDraft(_dsCollect(), d);
        var s = document.getElementById('cchDsSummary'); if (s) s.value = String(merged.summary || '');
        var c = document.getElementById('cchDsOutcomes');
        if (c && Array.isArray(merged.outcomes)) {
          c.innerHTML = '';
          merged.outcomes.forEach(function (o) {
            var w = document.createElement('div');
            w.innerHTML = _dsOutcomeRow(o);
            c.appendChild(w.firstChild);
          });
        }
        if (typeof showToast === 'function') {
          showToast(merged.keptHuman
            ? 'Kept your edits — AI only filled empty fields. Review, then Save.'
            : 'AI draft ready - review, then Save', 4000);
        }
      }).catch(function (e) {
        var msg = (e && e.message) || String(e);
        if (e && e.details) msg = String(e.details);
        console.error('[cchDsDraftWithAI]', e);
        if (typeof showToast === 'function') showToast('AI draft failed: ' + msg, 5000);
      });
    });
  };

  try { console.info('[cch-invoice-redesign] loaded (inline client view)'); } catch (e) {}
})(typeof window !== 'undefined' ? window : this);
