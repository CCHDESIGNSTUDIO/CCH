/**
 * WO-122 — Pre-save markup check. Read-only on prices.
 * Does not re-price, re-round, or re-save paid/locked documents.
 * No migration and no backfill.
 */
(function (root) {
  'use strict';

  var DEFAULT_RATES = [20, 35];
  var MATCH_CENTS = 0.02;
  var _rates = DEFAULT_RATES.slice();
  var _ratesLoaded = false;
  var _lockNoteShown = {};

  function num(v) {
    if (typeof root.parseMoney === 'function') {
      var p = root.parseMoney(v);
      if (p != null && isFinite(p)) return p;
    }
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }

  function roundPenny(n) { return Math.round(n * 100) / 100; }
  function roundNickel(n) { return Math.round(n * 20) / 20; }
  function roundDollar(n) { return Math.round(n); }

  function roundUp5(n) {
    if (typeof root.cchRoundClientUnitPriceUp5 === 'function') return root.cchRoundClientUnitPriceUp5(n);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.ceil(n / 5) * 5;
  }

  function normStatus(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function money(n) {
    if (typeof root.formatMoney === 'function') return root.formatMoney(n);
    var v = roundPenny(num(n));
    return '$' + v.toFixed(2);
  }

  function fmtPct(p) {
    if (p == null || !isFinite(p)) return '—';
    var r = Math.round(p * 10) / 10;
    if (Math.abs(r - Math.round(r)) < 0.05) return String(Math.round(r)) + '%';
    return r.toFixed(1) + '%';
  }

  function uniqueRates(list) {
    var out = [];
    var seen = {};
    (list || []).forEach(function (r) {
      var n = parseFloat(r);
      if (!isFinite(n) || n < 0 || n >= 1000) return;
      var k = String(Math.round(n * 100) / 100);
      if (seen[k]) return;
      seen[k] = true;
      out.push(parseFloat(k));
    });
    return out;
  }

  function studioRates() {
    return _rates.length ? _rates.slice() : DEFAULT_RATES.slice();
  }

  function loadStudioRates() {
    var db = root.db;
    if (!db || _ratesLoaded) return Promise.resolve(studioRates());
    return db.collection('settings').doc('markupPolicy').get().then(function (snap) {
      _ratesLoaded = true;
      if (snap && snap.exists) {
        var arr = (snap.data() || {}).allowedMarkupPcts;
        var parsed = uniqueRates(arr);
        if (parsed.length) _rates = parsed;
      }
      return studioRates();
    }).catch(function () { return studioRates(); });
  }

  function isLaborLine(line) {
    line = line || {};
    var et = String(line.expenseType || '').toLowerCase();
    var it = String(line.itemType || '').toLowerCase();
    return et === 'service' || it === 'service' || line._isService === true;
  }

  function skipMarkupLine(line) {
    if (!line) return true;
    if (typeof root.isProposalGroupHeaderItem === 'function' && root.isProposalGroupHeaderItem(line)) return true;
    if (line.lineKind === 'group') return true;
    if (typeof root.cchIsCreditLineType === 'function' && root.cchIsCreditLineType(line)) return true;
    var et = String(line.expenseType || '').toLowerCase().trim();
    if (['freight', 'shipping', 'handling', 'sales_tax', 'tax', 'discount', 'expense', 'other_expense', 'prepaid_tax', 'retainer_credit'].indexOf(et) >= 0) return true;
    return false;
  }

  function recordedPaid(doc) {
    doc = doc || {};
    var rows = Array.isArray(doc.payments) ? doc.payments : [];
    var fromRows = 0;
    for (var i = 0; i < rows.length; i++) fromRows += num(rows[i] && rows[i].amount);
    fromRows = roundPenny(fromRows);
    if (fromRows > 0.009) return fromRows;
    var explicit = num(doc.paidAmount || doc.amountPaid || doc.totalPaid || 0);
    if (explicit > 0.009) return explicit;
    return 0;
  }

  /**
   * Locked means: do not prompt, and do not let WO-122 change or re-save prices.
   * Paid (any recorded payment, Paid / Partially Paid, QuickBooks paid/partial).
   * Approved proposal total (clientApprovedTotalAt) or status Approved / Signed.
   * Invoiced proposal lines, or a proposal whose lines are all invoiced.
   * Void / cancelled documents.
   * A line that is only "approved" by the client on a still-open proposal is not locked
   * until the proposal total is approved or that line is on an invoice.
   */
  function priceLock(doc, collection, line) {
    doc = doc || {};
    collection = String(collection || doc.collection || '').trim();
    var st = normStatus(doc.status);
    var qb = normStatus(doc.qbStatus);
    var reasons = [];
    var paid = recordedPaid(doc);
    if (paid > 0.009) reasons.push('a payment of ' + money(paid) + ' is already recorded');
    if (st === 'paid' || st === 'partially paid' || st === 'partial') reasons.push('status is ' + (doc.status || 'Paid'));
    if (qb === 'paid' || qb === 'partial') reasons.push('QuickBooks status is ' + (doc.qbStatus || qb));
    if (st === 'void' || st === 'voided' || st === 'cancelled' || st === 'canceled') reasons.push('status is ' + (doc.status || 'void'));
    if (doc.clientApprovedTotalAt) reasons.push('the client already approved this proposal total');
    if (st === 'approved' || st === 'signed') reasons.push('status is ' + (doc.status || st));

    var fullyInvoiced = false;
    if (collection === 'proposals' && (st === 'invoiced' || st === 'partially invoiced')) {
      var editableLeft = false;
      var editableFn = root.proposalHasEditableUninvoicedLines;
      if (typeof editableFn !== 'function' && typeof globalThis !== 'undefined') editableFn = globalThis.proposalHasEditableUninvoicedLines;
      if (typeof editableFn === 'function') editableLeft = !!editableFn(doc);
      if (!editableLeft) {
        fullyInvoiced = true;
        reasons.push('every line on this proposal has been invoiced');
      }
    }

    var docLocked = reasons.length > 0;
    var lineReason = '';
    var lineLocked = false;
    var lineInvoicedFn = root.proposalLineIsInvoiced;
    if (typeof lineInvoicedFn !== 'function' && typeof globalThis !== 'undefined') lineInvoicedFn = globalThis.proposalLineIsInvoiced;
    if (!docLocked && line && collection === 'proposals' && typeof lineInvoicedFn === 'function' && lineInvoicedFn(line, doc)) {
      lineLocked = true;
      lineReason = 'this line was already copied onto an invoice';
    }
    if (docLocked) lineLocked = true;
    return {
      locked: !!(docLocked || lineLocked),
      docLocked: !!docLocked,
      lineLocked: !!lineLocked,
      fullyInvoiced: fullyInvoiced,
      reason: reasons[0] || lineReason || ''
    };
  }

  function clientUnit(line) {
    if (typeof root.cchDocLineUnitSell === 'function') return roundPenny(root.cchDocLineUnitSell(line));
    line = line || {};
    var qty = num(line.qty) || 1;
    if (!(qty > 0)) qty = 1;
    var amt = num(line.amount) || num(line.totalSelling);
    var cp = num(line.clientPrice) || num(line.sellPrice) || num(line.unitSellingPrice) || num(line.unitPrice);
    if (amt > 0) return roundPenny(amt / qty);
    if (cp > 0) return roundPenny(cp);
    return 0;
  }

  function unitCost(line) {
    if (typeof root.cchDocLineUnitCost === 'function') return roundPenny(root.cchDocLineUnitCost(line));
    line = line || {};
    return roundPenny(num(line.cost) || num(line.unitCost) || num(line.costPrice) || num(line.tradeCost));
  }

  function shouldUseFiveDollarRound(line) {
    if (typeof root.cchLineShouldRoundClientUnit === 'function') return !!root.cchLineShouldRoundClientUnit(line || { expenseType: 'product' });
    return true;
  }

  function expectedUnitsForRate(cost, rate, line) {
    var exact = cost * (1 + rate / 100);
    var list = [roundPenny(exact), roundNickel(exact), roundDollar(exact)];
    if (shouldUseFiveDollarRound(line)) list.push(roundUp5(exact));
    return list;
  }

  function priceMatchesRate(cost, unit, rate, line) {
    if (!(cost > 0) || !(unit > 0) || !(rate >= 0)) return false;
    var cands = expectedUnitsForRate(cost, rate, line);
    for (var i = 0; i < cands.length; i++) {
      if (Math.abs(unit - cands[i]) <= MATCH_CENTS) return true;
    }
    return false;
  }

  function allowedRatesFor(proj, line) {
    var rates = studioRates();
    proj = proj || {};
    var raw = isLaborLine(line) ? proj.defaultLaborMarkupPct : proj.defaultProductMarkupPct;
    if (raw != null && String(raw).trim() !== '') {
      var n = parseFloat(raw);
      if (isFinite(n) && n >= 0) rates.push(n);
    }
    return uniqueRates(rates);
  }

  function calcPct(cost, unit) {
    if (!(cost > 0)) return null;
    return ((unit - cost) / cost) * 100;
  }

  function productKey(line) {
    var sku = String(line.sku || line.itemCode || '').trim().toLowerCase();
    if (sku) return 'sku:' + sku;
    var name = String(line.title || line.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    var vendor = String(line.vendor || line.manufacturer || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!name) return '';
    return 'nv:' + name + '|' + vendor;
  }

  function lineTitle(line) {
    return String((line && (line.title || line.name)) || 'Untitled').trim();
  }

  function lineRoom(line) {
    return String((line && (line.room || line.category)) || '').trim();
  }

  function analyzeItems(items, proj, doc, collection) {
    items = Array.isArray(items) ? items : [];
    doc = doc || {};
    collection = collection || '';
    var issues = [];
    var byKey = {};
    items.forEach(function (line, idx) {
      if (skipMarkupLine(line)) return;
      var key = productKey(line);
      if (!key) return;
      if (!byKey[key]) byKey[key] = [];
      byKey[key].push({
        idx: idx,
        unit: clientUnit(line),
        room: lineRoom(line),
        title: lineTitle(line),
        lock: priceLock(doc, collection, line)
      });
    });

    items.forEach(function (line, idx) {
      if (skipMarkupLine(line)) return;
      var lock = priceLock(doc, collection, line);
      if (lock.locked) return;
      var cost = unitCost(line);
      var unit = clientUnit(line);
      var reasons = [];
      if (!(unit > 0.009)) reasons.push('No client price');
      else if (cost > 0.009 && unit + MATCH_CENTS < cost) reasons.push('Client price is below cost');
      else if (cost > 0.009 && Math.abs(unit - cost) <= MATCH_CENTS) reasons.push('Client price equals cost (no markup)');
      else if (cost > 0.009) {
        var rates = allowedRatesFor(proj, line);
        var ok = false;
        for (var r = 0; r < rates.length; r++) {
          if (priceMatchesRate(cost, unit, rates[r], line)) { ok = true; break; }
        }
        if (!ok) {
          var pct = calcPct(cost, unit);
          var list = rates.map(function (n) { return fmtPct(n); }).join(' or ');
          reasons.push('Markup is ' + fmtPct(pct) + ', not an allowed rate (' + list + ')');
        }
      } else if (!(unit > 0.009)) {
        reasons.push('No client price');
      }

      var key = productKey(line);
      var group = key && byKey[key];
      if (group && group.length > 1) {
        var prices = [];
        var distinct = false;
        var first = group[0].unit;
        group.forEach(function (g) {
          if (Math.abs(g.unit - first) > MATCH_CENTS) distinct = true;
          var label = (g.room ? g.room + ' ' : '') + money(g.unit);
          if (g.lock.locked) label += ' (locked)';
          if (prices.indexOf(label) < 0) prices.push(label);
        });
        if (distinct) reasons.push('Same product is priced differently on this proposal: ' + prices.join(', '));
      }

      if (!reasons.length) return;
      issues.push({
        index: idx,
        room: lineRoom(line),
        title: lineTitle(line),
        cost: cost,
        unit: unit,
        calcPct: calcPct(cost, unit),
        reasons: reasons,
        short: reasons[0]
      });
    });
    return issues;
  }

  function issueLines(issues) {
    var cap = 12;
    var lines = (issues || []).slice(0, cap).map(function (iss) {
      var where = iss.room ? (iss.room + ' — ') : '';
      return where + iss.title +
        '\nCost ' + money(iss.cost) + ' · Client price ' + money(iss.unit) +
        ' · Markup ' + fmtPct(iss.calcPct) +
        '\n' + iss.reasons.join(' ');
    });
    if ((issues || []).length > cap) lines.push('And ' + (issues.length - cap) + ' more.');
    return lines.join('\n\n');
  }

  function lockNote(id, reason) {
    var key = String(id || reason || 'locked');
    if (_lockNoteShown[key]) return;
    _lockNoteShown[key] = true;
    if (typeof root.showToast === 'function') {
      root.showToast('Prices left unchanged — ' + (reason || 'this document is locked'), 'info', 4500);
    }
  }

  function docFromEdit() {
    var d = root._docEdit;
    if (!d) return null;
    return {
      doc: d.docData || {},
      items: d.items || [],
      collection: d.collection || (d.type === 'invoice' ? 'invoices' : (d.type === 'po' ? 'purchaseOrders' : 'proposals')),
      projectId: d.projectId,
      docId: d.docId,
      proj: root._docEditProjData || {}
    };
  }

  function editIsPriceLocked() {
    var ctx = docFromEdit();
    if (!ctx) return null;
    if (ctx.collection === 'purchaseOrders') {
      return { locked: true, docLocked: true, reason: 'purchase orders are not client-markup documents' };
    }
    var lock = priceLock(ctx.doc, ctx.collection, null);
    return lock.docLocked ? lock : null;
  }

  function priceSnap(line) {
    line = line || {};
    var snap = {};
    ['cost', 'qty', 'markupPct', 'shipping', 'amount', 'clientPrice', 'retailPrice', 'rate', 'unitPrice', 'totalSelling', 'sellPrice'].forEach(function (k) {
      if (line[k] !== undefined) snap[k] = line[k];
      else snap[k] = undefined;
    });
    return snap;
  }

  function restorePrice(line, snap) {
    if (!line || !snap) return;
    Object.keys(snap).forEach(function (k) {
      if (snap[k] === undefined) delete line[k];
      else line[k] = snap[k];
    });
  }

  function projFor(ctx) {
    return (ctx && ctx.proj) || root._docEditProjData || {};
  }

  async function confirmIssues(issues, title) {
    if (!issues || !issues.length) return true;
    var msg = 'These lines do not match the allowed markup. Nothing has been changed.\n\n' +
      issueLines(issues) +
      '\n\nGo back and fix leaves everything unsaved. Save anyway keeps every price exactly as it is.';
    if (typeof root.cchConfirm === 'function') {
      return !!(await root.cchConfirm(msg, title || 'Check markup', {
        confirmText: 'Save anyway',
        cancelText: 'Go back and fix'
      }));
    }
    return root.confirm(msg);
  }

  function paintBadges() {
    if (!root.document) return;
    var old = root.document.querySelectorAll('.cch-markup-flag');
    for (var i = 0; i < old.length; i++) {
      if (old[i].parentNode) old[i].parentNode.removeChild(old[i]);
    }
    var ctx = docFromEdit();
    if (!ctx || editIsPriceLocked()) return;
    var issues = analyzeItems(ctx.items, projFor(ctx), ctx.doc, ctx.collection);
    issues.forEach(function (iss) {
      var row = root.document.getElementById('docEditRow' + iss.index);
      if (!row || !row.parentNode) return;
      var tr = root.document.createElement('tr');
      tr.className = 'cch-markup-flag';
      var td = root.document.createElement('td');
      td.colSpan = 12;
      td.style.cssText = 'background:rgba(201,169,110,0.18);color:#0E1629;font-size:12px;padding:6px 10px;border-bottom:1px solid #C9A96E;';
      td.textContent = (iss.room ? iss.room + ' — ' : '') + iss.title + ': ' + iss.reasons.join(' ');
      tr.appendChild(td);
      row.parentNode.insertBefore(tr, row.nextSibling);
    });
  }

  function wrap(name, factory) {
    var orig = root[name];
    if (typeof orig !== 'function' || orig._cchMarkupWrapped) return;
    var wrapped = factory(orig);
    if (!wrapped) return;
    wrapped._cchMarkupWrapped = true;
    root[name] = wrapped;
  }

  function install() {
    if (!root.document || root._cchMarkupCheckInstalled) return;
    root._cchMarkupCheckInstalled = true;
    loadStudioRates();

    wrap('docEditSyncLineItemsFromDom', function (orig) {
      return function () {
        var ctx = docFromEdit();
        var snaps = null;
        if (ctx && ctx.items) {
          var docLock = priceLock(ctx.doc, ctx.collection, null);
          snaps = ctx.items.map(function (line) {
            if (docLock.docLocked) return priceSnap(line);
            if (priceLock(ctx.doc, ctx.collection, line).locked) return priceSnap(line);
            return null;
          });
        }
        var result = orig.apply(this, arguments);
        if (snaps && ctx && ctx.items) {
          ctx.items.forEach(function (line, i) {
            if (snaps[i]) restorePrice(line, snaps[i]);
          });
        }
        return result;
      };
    });

    wrap('docEditNumChange', function (orig) {
      return function (el) {
        var ctx = docFromEdit();
        if (ctx && el && el.dataset) {
          var idx = parseInt(el.dataset.idx, 10);
          var field = el.dataset.field;
          var priceFields = { qty: 1, cost: 1, markupPct: 1, shipping: 1, amount: 1, retailPrice: 1, rate: 1 };
          var line = ctx.items[idx];
          if (priceFields[field] && line && priceLock(ctx.doc, ctx.collection, line).locked) {
            if (line[field] != null) el.value = line[field];
            lockNote(ctx.docId || ctx.collection, priceLock(ctx.doc, ctx.collection, line).reason);
            return;
          }
        }
        return orig.apply(this, arguments);
      };
    });

    wrap('docEditSave', function (orig) {
      return async function (goToViewAfter) {
        var ctx = docFromEdit();
        var locked = ctx && priceLock(ctx.doc, ctx.collection, null).docLocked;
        if (locked) {
          root._cchMarkupSkipClipPricePush = true;
          try { return await orig.apply(this, arguments); }
          finally { root._cchMarkupSkipClipPricePush = false; }
        }
        if (ctx && ctx.collection !== 'purchaseOrders') {
          await loadStudioRates();
          var issues = analyzeItems(ctx.items, projFor(ctx), ctx.doc, ctx.collection);
          if (goToViewAfter) {
            var ok = await confirmIssues(issues, 'Check markup before saving');
            if (!ok) return;
          } else {
            paintBadges();
          }
        }
        return orig.apply(this, arguments);
      };
    });

    wrap('docEditAutoSave', function (orig) {
      return function () {
        var ctx = docFromEdit();
        if (ctx && !priceLock(ctx.doc, ctx.collection, null).docLocked) paintBadges();
        return orig.apply(this, arguments);
      };
    });

    wrap('cchPushDocLinePricesToLinkedClips', function (orig) {
      return async function (projectId, items) {
        if (root._cchMarkupSkipClipPricePush) return { updatedClips: 0, skippedLocked: true };
        var ctx = docFromEdit();
        if (ctx && String(ctx.projectId || '') === String(projectId || '') && Array.isArray(items)) {
          if (priceLock(ctx.doc, ctx.collection, null).docLocked) return { updatedClips: 0, skippedLocked: true };
          items = items.filter(function (line) {
            return !priceLock(ctx.doc, ctx.collection, line).locked;
          });
          if (!items.length) return { updatedClips: 0, skippedLocked: true };
        }
        return orig.apply(this, arguments);
      };
    });

    wrap('_updateProposalItemFieldBody', function (orig) {
      return async function (projectId, docId, itemIdx, field) {
        var pricing = { qty: 1, cost: 1, markupPct: 1, shipping: 1, amount: 1, retailPrice: 1, rate: 1, clientPrice: 1 };
        if (pricing[field] && root.db) {
          var found = await readDoc(projectId, docId);
          if (found) {
            var line = (found.data.items || [])[itemIdx];
            var lock = priceLock(found.data, found.collection, line);
            if (lock.locked) {
              lockNote(docId, lock.reason);
              return null;
            }
          }
        }
        return orig.apply(this, arguments);
      };
    });

    wrap('saveDocLineItem', function (orig) {
      return async function (projectId, collection, docId, idx) {
        await loadStudioRates();
        var found = root.db ? await readDoc(projectId, docId) : null;
        var data = found ? found.data : ((root._docEdit && root._docEdit.docData) || {});
        var col = found ? found.collection : collection;
        var items = (data && data.items) || (root._docEdit && root._docEdit.items) || [];
        var prev = items[idx] || {};
        var lock = priceLock(data, col, prev);
        if (lock.locked || col === 'purchaseOrders') {
          if (lock.locked) lockNote(docId, lock.reason);
          if (lock.locked) return;
          return orig.apply(this, arguments);
        }
        var draft = Object.assign({}, prev);
        var costEl = root.document && root.document.getElementById('piCost');
        var mkEl = root.document && root.document.getElementById('piMarkup');
        var qtyEl = root.document && root.document.getElementById('piQty');
        var shipEl = root.document && root.document.getElementById('piShipping');
        if (costEl) draft.cost = num(costEl.value);
        if (mkEl) draft.markupPct = num(mkEl.value);
        if (qtyEl) draft.qty = num(qtyEl.value) || 1;
        if (shipEl) draft.shipping = num(shipEl.value);
        if (col !== 'purchaseOrders' && num(draft.cost) > 0) {
          var unit = num(draft.cost) * (1 + (num(draft.markupPct) || 0) / 100);
          draft.clientPrice = unit;
          draft.amount = unit * (num(draft.qty) || 1) + (num(draft.shipping) || 0);
        }
        var merged = items.slice();
        merged[idx] = draft;
        var issues = analyzeItems(merged, root._docEditProjData || {}, data, col);
        var mine = issues.filter(function (iss) { return iss.index === idx; });
        var ok = await confirmIssues(mine.length ? mine : [], 'Check markup before saving');
        if (!ok) return;
        return orig.apply(this, arguments);
      };
    });

    wrap('saveProduct', function (orig) {
      return async function (existingId) {
        await loadStudioRates();
        var costEl = root.document && root.document.getElementById('prodCost');
        var sellEl = root.document && root.document.getElementById('prodSell');
        var titleEl = root.document && root.document.getElementById('prodTitle');
        var vendorEl = root.document && root.document.getElementById('prodVendor');
        var skuEl = root.document && root.document.getElementById('prodSku');
        if (costEl || sellEl) {
          var row = {
            title: titleEl ? titleEl.value : 'Product',
            vendor: vendorEl ? vendorEl.value : '',
            sku: skuEl ? skuEl.value : '',
            cost: costEl ? num(costEl.value) : 0,
            clientPrice: sellEl ? num(sellEl.value) : 0,
            amount: sellEl ? num(sellEl.value) : 0,
            qty: 1,
            expenseType: 'product'
          };
          var issues = analyzeItems([row], {}, {}, 'products');
          var ok = await confirmIssues(issues, 'Check markup before saving');
          if (!ok) return;
        }
        return orig.apply(this, arguments);
      };
    });

    wrap('_pdUpdateField', function (orig) {
      return async function (productId, field, value) {
        if (field === 'sellPrice' || field === 'clientPrice' || field === 'costPrice' || field === 'cost' || field === 'unitCost') {
          await loadStudioRates();
          var row = (root.libraryProducts || []).filter(function (p) { return p && p.id === productId; })[0] || root.currentViewProduct || {};
          var draft = {
            title: row.title || 'Product',
            vendor: row.vendor || '',
            sku: row.sku || '',
            cost: num(row.costPrice != null ? row.costPrice : row.cost),
            clientPrice: num(row.sellPrice != null ? row.sellPrice : row.clientPrice),
            qty: 1,
            expenseType: 'product'
          };
          if (field === 'sellPrice' || field === 'clientPrice') draft.clientPrice = num(value);
          if (field === 'costPrice' || field === 'cost' || field === 'unitCost') draft.cost = num(value);
          draft.amount = draft.clientPrice;
          var issues = analyzeItems([draft], {}, {}, 'products');
          var ok = await confirmIssues(issues, 'Check markup before saving');
          if (!ok) {
            var err = new Error('Go back and fix the markup. The price was not saved.');
            err.cchMarkupCancelled = true;
            throw err;
          }
        }
        return orig.apply(this, arguments);
      };
    });

    wrap('_disPersistAppendedRows', function (orig) {
      return function (rows, toastMsg, opt) {
        opt = opt || {};
        if (opt._markupChecked) return orig.apply(this, arguments);
        return Promise.resolve().then(function () { return gateAppend(rows); }).then(function (proceed) {
          if (!proceed) return;
          var next = {};
          Object.keys(opt).forEach(function (k) { next[k] = opt[k]; });
          next._markupChecked = true;
          return orig.call(root, rows, toastMsg, next);
        });
      };
    });

    wrap('createProposalFromSelectedLibrary', function (orig) {
      return async function () {
        await loadStudioRates();
        var sel = root._libProposalSelected || new Set();
        var products = root._libProposalProducts || [];
        var selected = products.filter(function (p) { return sel.has(p.id); });
        var rows = selected.map(function (p) {
          var c = num(p.costPrice || p.unitCost || p.cost || 0);
          var s = num(p.sellPrice || p.clientPrice || 0);
          return {
            title: p.title || 'Untitled',
            vendor: p.vendor || '',
            sku: p.sku || '',
            room: p.room || '',
            qty: 1,
            cost: c,
            clientPrice: s,
            amount: s,
            expenseType: 'product'
          };
        });
        var issues = analyzeItems(rows, {}, { status: 'Draft' }, 'proposals');
        var ok = await confirmIssues(issues, 'Check markup before creating the proposal');
        if (!ok) return;
        return orig.apply(this, arguments);
      };
    });

    root.cchMarkupGatePreview = function (type, projectId, docId) {
      return gateOutput(type, projectId, docId);
    };

    wrap('_sendDocToClient', function (orig) {
      return async function (projectId, collection, docId, docType) {
        var type = collection === 'invoices' ? 'invoice' : 'proposal';
        var ok = await gateOutput(type, projectId, docId);
        if (!ok) return;
        return orig.apply(this, arguments);
      };
    });

    root.cchSaveAllowedMarkupRatesFromSettings = async function () {
      var el = root.document && root.document.getElementById('cchAllowedMarkupRates');
      if (!el || !root.db) return;
      var parts = String(el.value || '').split(/[^0-9.]+/);
      var nums = uniqueRates(parts);
      if (!nums.length) nums = DEFAULT_RATES.slice();
      _rates = nums;
      _ratesLoaded = true;
      el.value = nums.join(', ');
      await root.db.collection('settings').doc('markupPolicy').set({
        allowedMarkupPcts: nums,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    };
  }

  function readDoc(projectId, docId) {
    var db = root.db;
    if (!db || !projectId || !docId) return Promise.resolve(null);
    var cols = ['proposals', 'invoices', 'purchaseOrders'];
    var i = 0;
    function next() {
      if (i >= cols.length) return Promise.resolve(null);
      var col = cols[i++];
      return db.collection('boards').doc(projectId).collection(col).doc(docId).get().then(function (snap) {
        if (snap && snap.exists) return { collection: col, data: snap.data() || {} };
        return next();
      }).catch(function () { return next(); });
    }
    return next();
  }

  async function gateAppend(rows) {
    rows = rows || [];
    await loadStudioRates();
    var ctx = docFromEdit();
    var doc = ctx ? ctx.doc : { status: 'Draft' };
    var collection = ctx ? ctx.collection : 'proposals';
    var lock = priceLock(doc, collection, null);
    if (lock.docLocked) {
      lockNote((ctx && ctx.docId) || collection, lock.reason);
      return false;
    }
    var existing = (ctx && ctx.items) ? ctx.items.slice() : [];
    var merged = existing.concat(rows);
    var issues = analyzeItems(merged, projFor(ctx), doc, collection);
    var fresh = issues.filter(function (iss) { return iss.index >= existing.length; });
    if (!fresh.length) return true;
    return confirmIssues(fresh, 'Check markup before adding');
  }

  async function gateOutput(type, projectId, docId) {
    var kind = String(type || '').toLowerCase();
    if (kind !== 'proposal' && kind !== 'invoice') return true;
    if (!root.db) return true;
    await loadStudioRates();
    var col = kind === 'invoice' ? 'invoices' : 'proposals';
    var snap = await root.db.collection('boards').doc(projectId).collection(col).doc(docId).get();
    if (!snap.exists) return true;
    var data = snap.data() || {};
    var lock = priceLock(data, col, null);
    if (lock.docLocked) return true;
    var proj = {};
    try {
      var ps = await root.db.collection('boards').doc(projectId).get();
      if (ps.exists) proj = ps.data() || {};
    } catch (e) {}
    var issues = analyzeItems(data.items || [], proj, data, col);
    if (!issues.length) return true;
    return confirmIssues(issues, 'Check markup before ' + (kind === 'invoice' ? 'printing or sending' : 'printing or sending'));
  }

  var api = {
    priceLock: priceLock,
    analyzeItems: analyzeItems,
    priceMatchesRate: priceMatchesRate,
    expectedUnitsForRate: expectedUnitsForRate,
    clientUnit: clientUnit,
    roundUp5: roundUp5,
    roundNickel: roundNickel,
    studioRates: studioRates,
    setStudioRatesForTest: function (rates) { _rates = uniqueRates(rates); _ratesLoaded = true; }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.cchMarkupPriceLock = priceLock;
  root.cchMarkupAnalyzeItems = analyzeItems;
  root.cchMarkupPriceMatchesRate = priceMatchesRate;

  if (root.document) {
    if (root.document.readyState === 'loading') {
      root.document.addEventListener('DOMContentLoaded', install);
    } else {
      install();
    }
  }
})(typeof window !== 'undefined' ? window : this);
