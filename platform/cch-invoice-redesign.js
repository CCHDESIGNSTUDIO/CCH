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

  function _isProductLine(it) {
    if (!it) return false;
    var et = String(it.expenseType || '').toLowerCase(), itype = String(it.itemType || '').toLowerCase();
    return et === 'product' || itype === 'product' || itype === 'ffe';
  }
  function _isFeeLine(it) {
    var et = String((it && it.expenseType) || '').toLowerCase();
    return et === 'shipping' || et === 'sales_tax' || et === 'discount' || et === 'handling';
  }
  function _isServiceLine(it) {
    if (!it) return false;
    if (typeof global.isProposalGroupHeaderItem === 'function' && global.isProposalGroupHeaderItem(it)) return false;
    if (_isProductLine(it) || _isFeeLine(it)) return false;
    var et = String(it.expenseType || '').toLowerCase(), itype = String(it.itemType || '').toLowerCase();
    if (et === 'service' || itype === 'service') return true;
    if (typeof global.cchInvoiceLineUseServiceStyleInView === 'function' && global.cchInvoiceLineUseServiceStyleInView(it)) return true;
    var txt = (String(it.service || '') + ' ' + String(it.billingCategory || '') + ' ' + String(it.title || '') + ' ' + String(it.description || '')).toLowerCase();
    return /design service|design fee|professional service|time billing|consultation|retainer/.test(txt);
  }

  global.cchIsPureDesignServicesInvoice = function (items) {
    items = items || []; var hasService = false;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (typeof global.isProposalGroupHeaderItem === 'function' && global.isProposalGroupHeaderItem(it)) continue;
      if (_isFeeLine(it)) continue;
      if (typeof global.cchInvoiceLineUseServiceStyleInView === 'function' && global.cchInvoiceLineUseServiceStyleInView(it)) {
        hasService = true;
        continue;
      }
      if (_isProductLine(it)) return false;
      if (_isServiceLine(it)) hasService = true;
    }
    return hasService;
  };

  /** Time / design-services invoices use the luxury client sheet (not navy product table). */
  global.cchInvoiceUsesDesignServicesLayout = function (docData, items) {
    docData = docData || {};
    items = items || [];
    if (!items.length) return false;
    if (global.cchIsPureDesignServicesInvoice(items)) return true;
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
    var desc = String(o.description || o.desc || it.description || '').trim();
    if (desc && typeof global.sanitizeInvoicePreviewLineText === 'function') desc = global.sanitizeInvoicePreviewLineText(desc);
    if (desc) desc = desc.replace(/^\s*[\d.]+\s*(?:hours?|hrs?)\b\s*[—–\-·:]*\s*/i, '').trim();
    return {
      title: title || 'Design Services',
      desc: desc,
      dateRange: dr,
      hours: hrs,
      rate: rate > 0 ? rate : ''
    };
  }

  function _outcomes(docData, items) {
    var svcItems = [];
    (items || []).forEach(function (it) { if (_isServiceLine(it)) svcItems.push(it); });
    var co = docData && docData.clientOutcomes;
    if (Array.isArray(co) && co.length) {
      return co.map(function (o, i) {
        return _outcomeFromLine(o, _findSvcItem(svcItems, o, i));
      });
    }
    var out = [];
    svcItems.forEach(function (it) {
      out.push(_outcomeFromLine({}, it));
    });
    return out;
  }

  function _grand(docData, items, proj) {
    if (typeof global.invoiceViewTotals === 'function') { try { return global.invoiceViewTotals(docData, items, proj).grandTotal; } catch (e) {} }
    var t = parseFloat(docData && docData.total); if (!isNaN(t) && t > 0) return t;
    var s = 0; (items || []).forEach(function (it) { s += num(it.amount); }); return s;
  }

  function _ctx(docData, items, proj, projectId, docNum, dateStr) {
    docData = docData || {}; items = items || []; proj = proj || {};
    var name = _clientVal(docData.clientName || docData.client || docData.billingContactName || proj.clientName || proj.billingContactName || '', proj.clientName || '');
    if (!name && proj.name && String(proj.name).indexOf(' - ') >= 0) name = String(proj.name).split(' - ')[0].trim();
    if (!name) name = proj.name || 'Valued Client';
    var addr = _clientVal(docData.clientAddress || docData.billingAddress || docData.address || proj.clientAddress || proj.billingAddress || proj.address || '', proj.clientAddress || '');
    var phone = _clientVal(docData.clientPhone || docData.phone || proj.clientPhone || proj.phone || '', proj.clientPhone || '');
    var period = global.cchServicePeriodLabel(items, docData);
    var pShort = ''; if (period) { var m = period.match(/^[A-Za-z]+/); var y = period.match(/\d{4}/); pShort = (m ? m[0] : '') + (y ? ' ' + y[0] : ''); }
    var outs = _outcomes(docData, items); var th = 0; outs.forEach(function (o) { th += num(o.hours); });
    return {
      docNum: docNum, name: name, addrLine: addr ? esc(addr).replace(/\n/g, '<br>') : '', phone: phone,
      projName: proj.name || projectId || '', period: period, periodShort: pShort,
      summary: String(docData.clientSummary || '').trim(), outcomes: outs, grand: _grand(docData, items, proj),
      totalHours: th, status: (typeof global.cchInvoiceClientDisplayStatus === 'function') ? global.cchInvoiceClientDisplayStatus(docData) : (docData.status || 'Due on receipt'),
      note: String(docData.clientNote || '').trim() || 'Thank you, as always, for the trust you place in us. It’s a privilege to keep shaping the way your home lives.'
    };
  }

  var RULES = [
    ['.sheet', 'background:#FFFFFF;padding:48px 56px 8px;'],
    ['.head', 'display:flex;justify-content:space-between;align-items:flex-start;'],
    ['.brand-mark', 'font-family:"Cormorant Garamond",serif;font-size:38px;font-weight:600;letter-spacing:8px;color:#A8792F;line-height:0.95;'],
    ['.brand-sub', 'font-size:9.5px;letter-spacing:5px;color:#A8792F;text-transform:uppercase;margin-top:6px;opacity:0.85;'],
    ['.brand-contact', 'font-size:11.5px;line-height:1.85;color:#414C59;margin-top:16px;'],
    ['.doc-meta', 'text-align:right;padding-top:4px;'],
    ['.doc-kicker', 'font-family:"Cormorant Garamond",serif;font-size:30px;font-weight:500;letter-spacing:3px;color:#1B3352;'],
    ['.doc-num', 'font-size:12px;letter-spacing:2px;color:#A8792F;margin-top:2px;'],
    ['.doc-status', 'display:inline-block;margin-top:14px;border:1px solid rgba(168,121,47,0.4);color:#A8792F;font-size:9.5px;letter-spacing:2.5px;text-transform:uppercase;padding:5px 13px;'],
    ['.gold-rule', 'height:2px;background:rgba(168,121,47,0.4);margin:26px 0 0;'],
    ['.body', 'padding:34px 0 0;'],
    ['.meta-row', 'display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:28px;padding-bottom:28px;border-bottom:1px solid rgba(27,51,82,0.14);'],
    ['.lbl', 'font-size:9.5px;letter-spacing:2.5px;text-transform:uppercase;color:#A8792F;font-weight:600;margin-bottom:9px;'],
    ['.billto-name', 'font-family:"Cormorant Garamond",serif;font-size:21px;font-weight:600;color:#1B3352;line-height:1.2;'],
    ['.billto-line', 'font-size:12.5px;color:#414C59;line-height:1.7;margin-top:4px;'],
    ['.meta-val', 'font-size:13px;color:#1B3352;font-weight:500;line-height:1.5;'],
    ['.meta-sub', 'font-size:12px;color:#414C59;line-height:1.6;margin-top:2px;'],
    ['.intro', 'font-size:13.5px;color:#414C59;line-height:1.65;margin:24px 0 4px;max-width:96%;'],
    ['.section-eyebrow', 'display:flex;align-items:baseline;justify-content:space-between;margin:30px 0 4px;'],
    ['.section-title', 'font-family:"Cormorant Garamond",serif;font-size:24px;font-weight:600;color:#1B3352;'],
    ['.section-period', 'font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;color:#56616E;'],
    ['.section-underline', 'height:1px;background:rgba(168,121,47,0.4);margin-bottom:8px;'],
    ['.outcome', 'display:grid;grid-template-columns:34px 1fr;gap:18px;padding:20px 0;border-bottom:1px solid rgba(27,51,82,0.14);align-items:start;'],
    ['.o-num', 'font-family:"Cormorant Garamond",serif;font-size:22px;color:#A8792F;font-weight:500;line-height:1.1;padding-top:2px;'],
    ['.o-head', 'display:flex;justify-content:space-between;align-items:baseline;gap:14px;'],
    ['.o-title', 'font-size:15px;font-weight:600;color:#1B3352;'],
    ['.o-meta', 'font-size:11px;color:#56616E;white-space:nowrap;letter-spacing:0.4px;'],
    ['.o-meta b', 'color:#1B3352;font-weight:600;'],
    ['.o-desc', 'font-size:13px;color:#414C59;line-height:1.7;margin-top:5px;max-width:95%;'],
    ['.total-wrap', 'display:flex;justify-content:flex-end;margin-top:28px;'],
    ['.total-card', 'min-width:320px;'],
    ['.total-row', 'display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;font-size:13px;color:#414C59;'],
    ['.total-grand', 'display:flex;justify-content:space-between;align-items:baseline;margin-top:10px;padding-top:16px;border-top:2px solid #1B3352;'],
    ['.total-grand .g-label', 'font-family:"Cormorant Garamond",serif;font-size:19px;color:#1B3352;font-weight:600;'],
    ['.total-grand .g-amt', 'font-family:"Cormorant Garamond",serif;font-size:30px;color:#1B3352;font-weight:700;'],
    ['.terms', 'text-align:right;font-size:11px;color:#56616E;margin-top:10px;'],
    ['.note', 'margin-top:38px;padding:22px 26px;background:#FFFFFF;border-left:2px solid #A8792F;border-top:1px solid rgba(27,51,82,0.14);border-right:1px solid rgba(27,51,82,0.14);border-bottom:1px solid rgba(27,51,82,0.14);'],
    ['.note-q', 'font-family:"Cormorant Garamond",serif;font-size:17px;font-style:italic;color:#293441;line-height:1.6;'],
    ['.note-sign', 'font-size:12px;color:#414C59;margin-top:12px;'],
    ['.foot', 'text-align:center;padding:34px 0 40px;margin-top:36px;border-top:1px solid rgba(27,51,82,0.14);'],
    ['.foot-mark', 'font-family:"Cormorant Garamond",serif;font-size:20px;letter-spacing:7px;color:#A8792F;'],
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

  function _sheet(c) {
    var outcomesHtml = '';
    c.outcomes.forEach(function (o, i) {
      var n = (i + 1) < 10 ? '0' + (i + 1) : '' + (i + 1);
      var metaHtml = _metaHtml(o);
      outcomesHtml += '<div class="outcome"><div class="o-num">' + n + '</div><div>' +
        '<div class="o-head"><div class="o-title">' + esc(o.title) + '</div>' + metaHtml + '</div>' +
        (o.desc ? '<div class="o-desc">' + esc(o.desc) + '</div>' : '') + '</div></div>';
    });
    var hrsTot = c.totalHours ? '<span class="ds-hours"> · ' + (Math.round(c.totalHours * 10) / 10) + ' hours</span>' : '';
    return '<div class="sheet">' +
      '<div class="head"><div>' +
        '<div class="brand-mark">CCH</div><div class="brand-sub">Design Inc</div>' +
        '<div class="brand-contact">2481 N. Riverside Dr. · Santa Ana, CA 92706<br>(949) 497‑7979 · cindy@cchdesign.com<br>www.cchdesign.com</div>' +
      '</div><div class="doc-meta">' +
        '<div class="doc-kicker">Invoice</div><div class="doc-num">' + esc(c.docNum) + '</div>' +
        '<div class="doc-status">' + esc(c.status) + '</div>' +
      '</div></div><div class="gold-rule"></div>' +
      '<div class="body"><div class="meta-row">' +
        '<div><div class="lbl">Prepared for</div><div class="billto-name">' + esc(c.name) + '</div>' +
          '<div class="billto-line">' + (c.addrLine ? c.addrLine + '<br>' : '') + (c.phone ? esc(c.phone) : '') + '</div></div>' +
        '<div><div class="lbl">Project</div><div class="meta-val">' + esc(c.projName) + '</div></div>' +
        '<div><div class="lbl">Service period</div><div class="meta-val">' + esc(c.periodShort || '') + '</div>' +
          (c.period ? '<div class="meta-sub">' + esc(c.period) + '</div>' : '') + '</div>' +
      '</div>' +
      (c.summary ? '<p class="intro">' + esc(c.summary) + '</p>' : '') +
      '<div class="section-eyebrow"><div class="section-title">Design Services</div><div class="section-period">The month’s work</div></div>' +
      '<div class="section-underline"></div>' + outcomesHtml +
      '<div class="total-wrap"><div class="total-card">' +
        '<div class="total-row"><span>Design Services' + hrsTot + (c.periodShort ? ' — ' + esc(c.periodShort) : '') + '</span><span>' + money(c.grand) + '</span></div>' +
        '<div class="total-grand"><span class="g-label">Total Due</span><span class="g-amt">' + money(c.grand) + '</span></div>' +
        '<div class="terms">Payable on receipt · Thank you</div>' +
      '</div></div>' +
      '<div class="note"><div class="note-q">“' + esc(c.note) + '”</div><div class="note-sign">— Cindy Holloway · CCH Design Inc.</div></div>' +
      '<div class="foot"><div class="foot-mark">CCH</div><div class="foot-tag">Residential &amp; Yacht Design</div><div class="foot-line">www.cchdesign.com · @cchdesigninc · Valid 30 days</div></div>' +
      '</div></div>';
  }

  global.cchBuildDesignServicesInvoiceInner = function (docData, items, proj, projectId, docNum, dateStr) {
    var c = _ctx(docData, items, proj, projectId, docNum, dateStr);
    return '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">' +
      '<style>' + _css('#cchInvClientLanding ') + '#cchInvClientLanding .sheet{max-width:820px;margin:0 auto;box-shadow:0 14px 44px rgba(15,31,56,0.14);background:#FFFFFF;}</style>' +
      '<div id="cchDocClientView">' + _sheet(c) + '</div>';
  };

  global.cchBuildDesignServicesInvoiceHTML = function (docData, items, proj, projectId, docNum, dateStr, displayOpts) {
    var c = _ctx(docData, items, proj, projectId, docNum, dateStr);
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ' + esc(c.docNum) + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">' +
      '<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:"DM Sans",sans-serif;background:#E9E6DF;-webkit-font-smoothing:antialiased;}' +
      '.sheet{max-width:820px;margin:28px auto;box-shadow:0 14px 44px rgba(15,31,56,0.14);}' + _css('') +
      '@media print{body{background:#fff;}.sheet{box-shadow:none;margin:0;max-width:100%;}}</style></head><body>' +
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
    var toggles = chk('dates', 'Show date', disp.dates) + chk('hours', 'Show hours', disp.hours) + chk('rate', 'Show rate', disp.rate);
    win.document.open();
    win.document.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice ' + esc(c.docNum) + '</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">' +
      '<style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:"DM Sans",sans-serif;background:#E9E6DF;-webkit-font-smoothing:antialiased;}' +
      '.toolbar{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;justify-content:space-between;align-items:center;padding:10px 20px;background:#1B3352;color:#EDE8E0;box-shadow:0 2px 12px rgba(0,0,0,0.2);}' +
      '.toolbar-title{font-size:14px;font-weight:600;color:#C4A464;} .toolbar-actions{display:flex;align-items:center;flex-wrap:wrap;gap:4px;}' +
      '.tb-btn{background:transparent;border:1px solid rgba(200,185,154,0.5);color:#C8B99A;padding:7px 14px;font-size:12px;cursor:pointer;border-radius:3px;font-family:inherit;}' +
      '.tb-btn:hover{background:rgba(200,185,154,0.15);} .tb-btn-primary{background:#C4A464;color:#1B3352;border-color:#C4A464;font-weight:600;}' +
      '.preview-body{padding:56px 16px 28px;} .sheet{max-width:820px;margin:0 auto;box-shadow:0 14px 44px rgba(15,31,56,0.14);background:#FFFFFF;}' +
      _css('#cchInvClientLanding ') +
      '@media print{.toolbar{display:none!important;}body{background:#fff;}.preview-body{padding:0;}.sheet{box-shadow:none;margin:0;max-width:100%;}}</style></head><body>' +
      '<div class="toolbar"><div class="toolbar-title">Invoice ' + esc(c.docNum) + '</div>' +
      '<div class="toolbar-actions">' + toggles +
      '<button class="tb-btn tb-btn-primary" onclick="window.print()">🖨️ Print / PDF</button></div></div>' +
      '<div class="preview-body"><div id="cchInvClientLanding">' + _sheet(c) + '</div></div>' +
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
      fn({ notes: notes, projectName: (x.proj && x.proj.name) || '', period: global.cchServicePeriodLabel(x.items || [], x.docData || {}) }).then(function (res) {
        var d = (res && res.data) || {};
        var s = document.getElementById('cchDsSummary'); if (s) s.value = String(d.summary || '');
        var c = document.getElementById('cchDsOutcomes');
        if (c && Array.isArray(d.outcomes)) { c.innerHTML = ''; d.outcomes.forEach(function (o) { var w = document.createElement('div'); w.innerHTML = _dsOutcomeRow(o); c.appendChild(w.firstChild); }); }
        if (typeof showToast === 'function') showToast('AI draft ready - review, then Save', 3500);
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
