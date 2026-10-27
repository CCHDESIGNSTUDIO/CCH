/**
 * Square Payment Link — admin creates hosted checkout; client Pay uses squareCheckoutUrl only.
 * Never opens qbo.intuit.com. No card fields in Studio.
 */
(function () {
  'use strict';

  window.cchInvoiceOpenBalance = function (inv) {
    if (!inv) return 0;
    var st = String(inv.status || '').toLowerCase();
    if (st === 'paid' || st === 'void' || st === 'voided') return 0;
    var total = parseFloat(inv.total || inv.amount) || 0;
    var paid = 0;
    if (typeof window.cpPortalInvoicePaidAmount === 'function') paid = window.cpPortalInvoicePaidAmount(inv);
    else {
      paid = (inv.payments || []).reduce(function (s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
      if (paid < 0.001) paid = parseFloat(inv.paidAmount || inv.paid || inv.totalPaid || 0) || 0;
    }
    return Math.max(0, Math.round((total - paid) * 100) / 100);
  };

  function cchParseDueNowMoney(raw) {
    var s = String(raw || '').trim().toLowerCase().replace(/[$,\s]/g, '');
    if (!s) return 0;
    var mul = 1;
    if (s.charAt(s.length - 1) === 'k') {
      mul = 1000;
      s = s.slice(0, -1);
    }
    var n = parseFloat(s);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * mul * 100) / 100;
  }

  /** Net dollars Square should collect this round. Empty Due now = full remaining. */
  window.cchInvoiceDueNowNet = function (inv) {
    var remaining = window.cchInvoiceOpenBalance(inv);
    if (remaining < 0.01) return 0;
    var amt = parseFloat(inv && inv.dueNowAmount);
    var pct = parseFloat(inv && inv.dueNowPercent);
    var dueNow = 0;
    if (Number.isFinite(amt) && amt > 0.009) dueNow = amt;
    else if (Number.isFinite(pct) && pct > 0) dueNow = remaining * (Math.min(100, pct) / 100);
    if (dueNow < 0.01) dueNow = remaining;
    return Math.min(remaining, Math.round(dueNow * 100) / 100);
  };

  window.cchInvoiceDueNowRailHtml = function (projectId, invoiceId, inv) {
    inv = inv || {};
    var remaining = window.cchInvoiceOpenBalance(inv);
    if (remaining < 0.01) return '';
    var dueNow = window.cchInvoiceDueNowNet(inv);
    var money = typeof window.formatMoney === 'function' ? window.formatMoney : function (n) {
      return '$' + (Number(n) || 0).toFixed(2);
    };
    var amt = parseFloat(inv.dueNowAmount);
    var amtStr = (Number.isFinite(amt) && amt > 0.009) ? String(Math.round(amt * 100) / 100) : '';
    var pct = parseFloat(inv.dueNowPercent);
    var pctStr = (Number.isFinite(pct) && pct > 0) ? String(pct) : '';
    var slice = dueNow + 0.01 < remaining;
    var leftAfter = Math.max(0, Math.round((remaining - dueNow) * 100) / 100);
    var pid = String(projectId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var iid = String(invoiceId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return '<div class="cch-doc-view-rail-card">' +
      '<div class="cch-doc-view-rail-title">Due now (card)</div>' +
      '<div style="font-size:11px;color:#5C6B80;line-height:1.4;margin:0 0 8px;">Type the card amount (65000 or 65k). Square cannot let the client type an amount. Stay under Square\u2019s $50k cap per charge.</div>' +
      '<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">' +
        '<label style="font-size:11px;color:#5C6B80;white-space:nowrap;">This payment $</label>' +
        '<input id="cchDueNowAmt" type="text" inputmode="decimal" value="' + amtStr.replace(/"/g, '&quot;') + '" placeholder="65000 or 65k" style="width:130px;padding:6px 8px;border:1px solid #E2E2E2;font-size:13px;" onchange="cchInvoiceDueNowSave(\'' + pid + '\',\'' + iid + '\',\'amt\')" onkeydown="if(event.key===\'Enter\'){event.preventDefault();cchInvoiceDueNowSave(\'' + pid + '\',\'' + iid + '\',\'amt\');}">' +
        '<label style="font-size:11px;color:#5C6B80;margin-left:4px;">or %</label>' +
        '<input id="cchDueNowPct" type="number" min="0" max="100" step="1" value="' + pctStr.replace(/"/g, '&quot;') + '" placeholder="50" style="width:56px;padding:6px 8px;border:1px solid #E2E2E2;font-size:13px;" onchange="cchInvoiceDueNowSave(\'' + pid + '\',\'' + iid + '\',\'pct\')">' +
      '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' +
        '<button type="button" class="btn btn-secondary btn-sm" onclick="cchInvoiceDueNowFillPct(\'' + pid + '\',\'' + iid + '\',' + remaining + ',50)">50%</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" onclick="cchInvoiceDueNowFillPct(\'' + pid + '\',\'' + iid + '\',' + remaining + ',33)">33%</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" onclick="cchInvoiceDueNowFillPct(\'' + pid + '\',\'' + iid + '\',' + remaining + ',100)">Remainder</button>' +
      '</div>' +
      '<div style="font-size:12px;color:#0A1F3D;line-height:1.45;">This payment: <strong>' + money(dueNow) + '</strong></div>' +
      '<div style="font-size:12px;color:#5C6B80;margin-top:4px;line-height:1.45;">' +
        (slice
          ? ('Balance after this payment: <strong style="color:#0A1F3D;">' + money(leftAfter) + '</strong>')
          : 'This pays the remaining balance.') +
      '</div>' +
      '</div>';
  };

  window.cchInvoiceDueNowFillPct = function (projectId, invoiceId, remaining, pct) {
    remaining = parseFloat(remaining) || 0;
    pct = parseFloat(pct) || 0;
    var amtEl = document.getElementById('cchDueNowAmt');
    var pctEl = document.getElementById('cchDueNowPct');
    var amt = pct >= 99.9
      ? remaining
      : Math.round(remaining * (Math.min(100, pct) / 100) * 100) / 100;
    if (amtEl) amtEl.value = amt ? String(amt) : '';
    if (pctEl) pctEl.value = '';
    return window.cchInvoiceDueNowSave(projectId, invoiceId, 'amt');
  };

  window.cchInvoiceDueNowSave = async function (projectId, invoiceId, source) {
    if (!projectId || !invoiceId || typeof db === 'undefined') return;
    var amtEl = document.getElementById('cchDueNowAmt');
    var pctEl = document.getElementById('cchDueNowPct');
    var remaining = 0;
    try {
      var snap = await db.collection('boards').doc(projectId).collection('invoices').doc(invoiceId).get();
      remaining = window.cchInvoiceOpenBalance(snap.exists ? snap.data() : {});
    } catch (_eRem) {}
    var patch = { updatedAt: new Date().toISOString() };
    if (source === 'pct') {
      var pct = pctEl ? parseFloat(pctEl.value) : 0;
      if (Number.isFinite(pct) && pct > 0 && pct < 99.95) {
        patch.dueNowPercent = pct;
        patch.dueNowAmount = 0;
        if (amtEl) amtEl.value = '';
      } else {
        patch.dueNowPercent = 0;
        patch.dueNowAmount = 0;
      }
    } else {
      var amt = cchParseDueNowMoney(amtEl ? amtEl.value : '');
      if (remaining > 0.009 && amt > remaining) amt = remaining;
      if (amt > 0.009) {
        patch.dueNowAmount = amt;
        patch.dueNowPercent = 0;
        if (pctEl) pctEl.value = '';
        if (amtEl) amtEl.value = String(amt);
      } else {
        patch.dueNowAmount = 0;
        patch.dueNowPercent = 0;
      }
    }
    try {
      await db.collection('boards').doc(projectId).collection('invoices').doc(invoiceId).set(patch, { merge: true });
      if (typeof window._cacheTime !== 'undefined') window._cacheTime = 0;
      if (typeof window.showToast === 'function') window.showToast('Due now saved \u2014 Create / Refresh Square pay link');
      if (typeof window.renderInvoiceDetail === 'function') {
        await window.renderInvoiceDetail(projectId, invoiceId);
      }
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert((e && e.message) ? e.message : String(e), 'Due now');
    }
  };

  window.cchSquarePayLink = function (inv) {
    if (!inv) return '';
    return String(inv.squareCheckoutUrl || '').trim();
  };

  window.cchCheckSquarePayment = async function (projectId, invoiceId, opts) {
    opts = opts || {};
    if (!projectId || !invoiceId) return null;
    try {
      var fn = firebase.app().functions('us-central1').httpsCallable('checkSquarePayment');
      var res = await fn({ projectId: projectId, invoiceId: invoiceId });
      var d = res && res.data;
      if (d && (d.markedPaid || d.enriched)) {
        if (typeof window._cacheTime !== 'undefined') window._cacheTime = 0;
        if (typeof window.showToast === 'function') {
          var stPay = String((d && d.status) || '');
          window.showToast(
            d.markedPaid
              ? (stPay === 'Partially Paid' ? 'Square payment recorded — Partially Paid' : 'Square payment recorded — invoice Paid')
              : 'Square payment method updated',
            'success'
          );
        }
        if (!opts.skipRefresh && typeof window.renderInvoiceDetail === 'function') {
          await window.renderInvoiceDetail(projectId, invoiceId);
        }
      }
      return d;
    } catch (err) {
      if (!opts.quiet) {
        var msg = (err && err.details) ? String(err.details) : ((err && err.message) ? err.message : String(err));
        if (typeof window.cchAlert === 'function') await window.cchAlert(msg, 'Square');
      }
      return null;
    }
  };

  window.cchEnsureSquarePaymentLink = async function (projectId, invoiceId, opts) {
    opts = opts || {};
    if (!projectId || !invoiceId) return '';
    try {
      var fn = firebase.app().functions('us-central1').httpsCallable('createSquarePaymentLink');
      var res = await fn({ projectId: projectId, invoiceId: invoiceId });
      var url = res && res.data && res.data.url ? String(res.data.url).trim() : '';
      if (url && typeof window._cacheTime !== 'undefined') window._cacheTime = 0;
      return url;
    } catch (eEns) {
      if (opts.throwErr) throw eEns;
      return '';
    }
  };

  window.cchCreateSquarePaymentLink = async function (projectId, invoiceId) {
    if (!projectId || !invoiceId) return;
    try {
      var already = await window.cchCheckSquarePayment(projectId, invoiceId, { quiet: true });
      if (already && already.markedPaid) return;
      if (typeof window.preflightCloudFunctionsUsCentral1 === 'function') {
        var pre = await window.preflightCloudFunctionsUsCentral1();
        if (!pre.ok) {
          if (typeof window.cchAlert === 'function') await window.cchAlert(pre.text, 'Square');
          return;
        }
      }
      var url = await window.cchEnsureSquarePaymentLink(projectId, invoiceId, { throwErr: true });
      if (url && typeof window.sendInvoiceToClient === 'function') {
        await window.sendInvoiceToClient(projectId, invoiceId);
      } else if (url && typeof window.showToast === 'function') {
        window.showToast('Square pay link created', 'success');
      } else if (typeof window.cchAlert === 'function') {
        await window.cchAlert('Square did not return a pay link. You can still Send — clients can wire or bill-pay in QuickBooks.', 'Square');
      }
    } catch (err) {
      var msg = (err && err.details) ? String(err.details) : ((err && err.message) ? err.message : String(err));
      if (msg === 'INTERNAL' && err && err.message && err.message !== 'INTERNAL') msg = err.message;
      if (typeof window.cchAlert === 'function') await window.cchAlert(msg, 'Square');
    }
  };

  function cchInstallSquarePaidCheck() {
    if (window._cchSquarePaidHook) return;
    if (typeof window.renderInvoiceDetail !== 'function') return;
    window._cchSquarePaidHook = true;
    var orig = window.renderInvoiceDetail;
    window.renderInvoiceDetail = async function (projectId, invoiceId) {
      var result = await orig.apply(this, arguments);
      try {
        await window.cchCheckSquarePayment(projectId, invoiceId, { quiet: true });
      } catch (eChk) {}
      return result;
    };
  }
  if (document.readyState === 'complete') cchInstallSquarePaidCheck();
  else window.addEventListener('load', cchInstallSquarePaidCheck);
  setTimeout(cchInstallSquarePaidCheck, 0);

  window.cchZelleEmail = function () { return 'cindy@cchdesign.com'; };
  window.cchZelleName = function () { return 'CCH Design Inc.'; };
  window.cchZellePageHash = function (projectId, invoiceId) {
    return '#/clientview/' + String(projectId || '') + '/zelle/' + encodeURIComponent(String(invoiceId || ''));
  };
  /** Hash-free URL for Outlook/mailto (Outlook does not auto-link URLs that contain #). */
  window.cchPortalMailUrl = function (projectId, opts) {
    opts = opts || {};
    var origin = (window.location && window.location.origin) ? window.location.origin : '';
    var q = 'p=' + encodeURIComponent(String(projectId || ''));
    if (opts.zelleInvoiceId) q += '&zelle=' + encodeURIComponent(String(opts.zelleInvoiceId));
    if (opts.payInvoiceId) q += '&pay=' + encodeURIComponent(String(opts.payInvoiceId));
    if (opts.proposalId) q += '&proposal=' + encodeURIComponent(String(opts.proposalId));
    return origin + '/client.html?' + q;
  };
  window.cchZellePageUrl = function (projectId, invoiceId) {
    return window.cchPortalMailUrl(projectId, { zelleInvoiceId: invoiceId });
  };
  window.cchPayPageHash = function (projectId, invoiceId) {
    return '#/clientview/' + String(projectId || '') + '/pay/' + encodeURIComponent(String(invoiceId || ''));
  };
  window.cchPayPageUrl = function (projectId, invoiceId) {
    return window.cchPortalMailUrl(projectId, { payInvoiceId: invoiceId });
  };
  /** From invoice Open popup: stay in the same portal session (no client.html reload / welcome screen). */
  window.cchPayNavigateFromDoc = function (projectId, invoiceId) {
    var hash = typeof window.cchPayPageHash === 'function'
      ? window.cchPayPageHash(projectId, invoiceId)
      : ('#/clientview/' + projectId + '/pay/' + encodeURIComponent(invoiceId || ''));
    /* When THIS window is the about:blank print popup, drive the portal opener. */
    try {
      if (window.opener && !window.opener.closed) {
        var o = window.opener;
        if (typeof o.navigate === 'function') o.navigate(hash);
        else o.location.hash = hash;
        try { window.close(); } catch (eC) {}
        return;
      }
    } catch (eO) {}
    /* Called on the portal window itself (e.g. opener.cchPayNavigateFromDoc) — navigate this window only. */
    if (typeof window.navigate === 'function') {
      window.navigate(hash);
      return;
    }
    try { window.location.hash = hash; } catch (eL) {}
  };
  window.cchInvoiceClientPayBarHtml = function (projectId, inv, opts) {
    opts = opts || {};
    if (!inv || !projectId) return '';
    var bal = typeof window.cpPortalInvoiceBalance === 'function'
      ? window.cpPortalInvoiceBalance(inv)
      : (function () {
          var st = String(inv.status || '').toLowerCase();
          if (st === 'paid' || st === 'void' || st === 'voided') return 0;
          var total = parseFloat(inv.total || inv.amount) || 0;
          var paid = (inv.payments || []).reduce(function (s, p) { return s + (parseFloat(p.amount) || 0); }, 0);
          if (!paid) paid = parseFloat(inv.paid || inv.paidAmount || inv.totalPaid || 0) || 0;
          return Math.max(0, total - paid);
        })();
    if (!(bal > 0.01)) return '';
    var payNow = typeof window.cchInvoiceDueNowNet === 'function' ? window.cchInvoiceDueNowNet(inv) : bal;
    if (!(payNow > 0.01)) payNow = bal;
    var slice = payNow + 0.02 < bal;
    var money = typeof window.formatMoney === 'function' ? window.formatMoney : function (n) {
      return '$' + (Number(n) || 0).toFixed(2);
    };
    var payHash = typeof window.cchPayPageHash === 'function'
      ? window.cchPayPageHash(projectId, inv.id)
      : ('#/clientview/' + projectId + '/pay/' + encodeURIComponent(inv.id || ''));
    /*
     * Open popup is about:blank. Prefer opener.navigate(hash) then close.
     * Must HTML-escape " inside onclick="..." — JSON.stringify quotes would truncate the attribute.
     */
    var payClickJs =
      'void (function(){try{var h=' + JSON.stringify(payHash) + ';' +
      'var o=window.opener;if(o&&!o.closed){if(typeof o.navigate===\'function\')o.navigate(h);else o.location.hash=h;try{window.close();}catch(_c){}}' +
      'else if(typeof window.cchPayNavigateFromDoc===\'function\'){window.cchPayNavigateFromDoc(' +
      JSON.stringify(String(projectId || '')) + ',' + JSON.stringify(String(inv.id || '')) + ');}' +
      'else if(typeof window.navigate===\'function\'){window.navigate(h);}else{window.location.hash=h;}}catch(_e){}})()';
    var payClickAttr = '"' + payClickJs.replace(/&/g, '&amp;').replace(/"/g, '&quot;') + '"';
    /* One Pay control only — CC + Zelle live on the portal Pay page. */
    var payBtn = '<button type="button" class="' + (opts.toolbar ? 'tb-btn tb-btn-primary' : '') + '" style="' +
      (opts.toolbar
        ? ''
        : 'display:inline-block;padding:8px 16px;font-size:12px;font-weight:600;background:#0A1F3D;color:#FFFFFF;border:1px solid #0A1F3D;cursor:pointer;font-family:inherit;') +
      '" onclick=' + payClickAttr + '>Pay</button>';
    if (opts.toolbar) return payBtn;
    return '<div class="cch-inv-pay-bar" style="max-width:820px;margin:0 auto 20px;padding:18px 20px;border:1px solid #E2E2E2;background:#FAFAFA;">' +
      '<div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;margin-bottom:6px;">' + (slice ? 'Pay now' : 'Balance due') + '</div>' +
      '<div style="font-size:20px;font-weight:600;color:#0A1F3D;font-family:\'Playfair Display\',Georgia,serif;margin-bottom:4px;">' + money(payNow) + '</div>' +
      (slice ? '<div style="font-size:12px;color:#6B7280;margin-bottom:12px;line-height:1.45;">Invoice balance ' + money(bal) + '<br>Leaves ' + money(Math.max(0, Math.round((bal - payNow) * 100) / 100)) + ' after this payment.</div>' : '<div style="margin-bottom:12px;"></div>') +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px;">' + payBtn + '</div>' +
      '<div style="font-size:12px;color:#6B7280;line-height:1.5;">Opens card pay and Zelle instructions on one page.</div></div>';
  };
  window.cchPayChoiceHtml = function (projectId, inv) {
    var esc = typeof window.esc === 'function' ? window.esc : function (s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };
    var escAttr = typeof window.escAttr === 'function' ? window.escAttr : function (s) {
      return esc(s).replace(/"/g, '&quot;');
    };
    var money = typeof window.formatMoney === 'function' ? window.formatMoney : function (n) {
      return '$' + (Number(n) || 0).toFixed(2);
    };
    var backHash = '#/clientview/' + projectId + '/invoices';
    var backAttr = (typeof window.cpPortalNavigateOnclickAttr === 'function')
      ? window.cpPortalNavigateOnclickAttr(backHash)
      : ('"window.navigate(' + JSON.stringify(backHash) + ')"');
    function copyBtn(val, label) {
      return '<button type="button" class="cp-btn cp-btn-primary" style="padding:8px 14px;font-size:11px;flex-shrink:0;" data-copy="' +
        escAttr(val) + '" data-label="' + escAttr(label) + '" onclick="cchCopyZelleText(this)">' + esc(label) + '</button>';
    }
    if (!inv) {
      return '<div class="cp-sec-label-jx">Pay</div>' +
        '<div style="border:1px solid #E2E2E2;padding:28px;max-width:560px;">' +
        '<p style="font-size:14px;color:#5C6B80;line-height:1.55;margin:0 0 16px;">This invoice is not available.</p>' +
        '<button type="button" class="cp-btn cp-btn-outline" style="padding:8px 14px;font-size:12px;" onclick=' + backAttr + '>← Invoices</button>' +
        '</div>';
    }
    var st = String(inv.status || '').toLowerCase();
    if (st === 'void' || st === 'voided' || st === 'draft') {
      return '<div class="cp-sec-label-jx">Pay</div>' +
        '<div style="border:1px solid #E2E2E2;padding:28px;max-width:560px;">' +
        '<p style="font-size:14px;color:#5C6B80;line-height:1.55;margin:0 0 16px;">This invoice is not available.</p>' +
        '<button type="button" class="cp-btn cp-btn-outline" style="padding:8px 14px;font-size:12px;" onclick=' + backAttr + '>← Invoices</button>' +
        '</div>';
    }
    var docNum = String(inv.invoiceNum || inv.number || inv.name || 'Invoice').trim() || 'Invoice';
    var bal = typeof window.cpPortalInvoiceBalance === 'function'
      ? window.cpPortalInvoiceBalance(inv)
      : (parseFloat(inv.total || inv.amount) || 0);
    var remaining = typeof window.cchInvoiceOpenBalance === 'function'
      ? window.cchInvoiceOpenBalance(inv)
      : bal;
    var payNow = typeof window.cchInvoiceDueNowNet === 'function'
      ? window.cchInvoiceDueNowNet(inv)
      : remaining;
    if (!(payNow > 0.01)) payNow = remaining;
    var slice = payNow + 0.02 < remaining;
    var paid = remaining <= 0.01;
    var sq = typeof window.cchSquarePayLink === 'function'
      ? window.cchSquarePayLink(inv)
      : String(inv.squareCheckoutUrl || '').trim();
    var email = window.cchZelleEmail();
    var name = window.cchZelleName();
    var amtCopy = (Math.round(payNow * 100) / 100).toFixed(2);
    var html = '<div class="cp-sec-label-jx">Pay</div>' +
      '<p style="font-size:12px;color:#6B7280;margin:-4px 0 18px;line-height:1.55;font-family:\'DM Sans\',sans-serif;">Pay ' + esc(docNum) + ' by card or Zelle — both options are on this page.</p>' +
      '<div style="border:1px solid #E2E2E2;padding:28px;max-width:560px;">' +
      '<div style="font-size:13px;font-weight:600;color:#0A1F3D;margin-bottom:4px;">' + esc(docNum) + '</div>';
    if (paid) {
      html += '<div style="font-size:14px;color:#0A1F3D;margin:12px 0 20px;">This invoice is paid. No payment is needed.</div>';
    } else {
      var leftAfterPay = Math.max(0, Math.round((remaining - payNow) * 100) / 100);
      html += '<div style="font-size:22px;font-weight:600;color:#0A1F3D;font-family:\'Playfair Display\',Georgia,serif;margin:12px 0 8px;">' + money(payNow) + (slice ? ' now' : ' due') + '</div>' +
        (slice
          ? '<div style="font-size:12px;color:#6B7280;margin:0 0 24px;line-height:1.5;">Invoice balance ' + money(remaining) + '<br>Leaves ' + money(leftAfterPay) + ' after this payment.</div>'
          : '<div style="margin-bottom:24px;"></div>');

      /* —— Card (Square) —— */
      html += '<div style="margin:0 0 28px;padding-bottom:28px;border-bottom:1px solid #E2E2E2;">' +
        '<div style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;margin-bottom:10px;">Pay with card</div>';
      if (sq) {
        html += '<a href="' + escAttr(sq) + '" target="_blank" rel="noopener" class="cp-btn cp-btn-primary" style="display:inline-block;padding:12px 18px;font-size:13px;text-decoration:none;text-align:center;background:#C4A464;border-color:#C4A464;">Pay with CC</a>' +
          '<div style="font-size:12px;color:#6B7280;line-height:1.5;margin-top:10px;">A 3% fee will be applied on the card.</div>';
      } else {
        html += '<div style="padding:12px 14px;border:1px solid #E2E2E2;background:#FAFAFA;font-size:13px;color:#5C6B80;line-height:1.5;">Card pay is not set up for this invoice yet. Use Zelle below, or contact the studio.</div>';
      }
      html += '</div>';

      /* —— Zelle (inline — no second page) —— */
      html += '<div>' +
        '<div style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;margin-bottom:6px;">Pay with Zelle</div>' +
        '<p style="font-size:12px;color:#6B7280;line-height:1.55;margin:0 0 16px;font-family:\'DM Sans\',sans-serif;">No card fee. Open your bank app, then copy the details below.</p>' +
        '<div style="margin:0 0 16px;">' +
        '<div style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;margin-bottom:6px;">Amount to send</div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
        '<div style="flex:1;font-size:20px;font-weight:600;color:#0A1F3D;font-family:\'Playfair Display\',Georgia,serif;">' + money(payNow) + '</div>' +
        copyBtn(amtCopy, 'Copy amount') +
        '</div></div>' +
        '<div style="margin:0 0 16px;">' +
        '<div style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;margin-bottom:6px;">Zelle to</div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
        '<div style="flex:1;font-size:14px;color:#0A1F3D;line-height:1.4;">' + esc(name) + '<br><span style="font-family:ui-monospace,monospace;font-size:13px;">' + esc(email) + '</span></div>' +
        copyBtn(email, 'Copy email') +
        '</div></div>' +
        '<div style="margin:0 0 16px;">' +
        '<div style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;margin-bottom:6px;">Memo</div>' +
        '<div style="display:flex;gap:8px;align-items:center;">' +
        '<div style="flex:1;font-size:14px;color:#0A1F3D;">' + esc(docNum) + '</div>' +
        copyBtn(docNum, 'Copy memo') +
        '</div></div>' +
        '<ol style="margin:0;padding-left:18px;font-size:13px;color:#5C6B80;line-height:1.65;">' +
        '<li>Open your bank app and choose Zelle.</li>' +
        '<li>Send to <strong style="color:#0A1F3D;">' + esc(email) + '</strong>.</li>' +
        '<li>Enter <strong style="color:#0A1F3D;">' + money(payNow) + '</strong>.</li>' +
        '<li>Put <strong style="color:#0A1F3D;">' + esc(docNum) + '</strong> in the memo.</li>' +
        '</ol></div>';
    }
    html += '<div style="margin-top:22px;"><button type="button" class="cp-btn cp-btn-outline" style="padding:8px 14px;font-size:12px;" onclick=' + backAttr + '>← Invoices</button></div></div>';
    return html;
  };
  window.cchApplyPortalQueryRoute = function () {
    try {
      var params = new URLSearchParams(window.location.search || '');
      var p = String(params.get('p') || params.get('project') || '').trim();
      if (!p) return false;
      var zelle = String(params.get('zelle') || '').trim();
      var pay = String(params.get('pay') || '').trim();
      var proposal = String(params.get('proposal') || '').trim();
      var hash = '#/clientview/' + p;
      if (pay) hash += '/pay/' + encodeURIComponent(pay);
      else if (zelle) hash += '/zelle/' + encodeURIComponent(zelle);
      else if (proposal) hash += '/proposal/' + encodeURIComponent(proposal);
      var path = window.location.pathname || '/client.html';
      window.history.replaceState({}, '', path + hash);
      return true;
    } catch (eQ) {
      return false;
    }
  };
  window.cchCopyRichEmail = async function (html, plain) {
    html = String(html || '');
    plain = String(plain || '');
    if (!html && !plain) return false;
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        var item = { 'text/plain': new Blob([plain || html], { type: 'text/plain' }) };
        if (html) item['text/html'] = new Blob([html], { type: 'text/html' });
        await navigator.clipboard.write([new ClipboardItem(item)]);
        return true;
      }
    } catch (eClip) {}
    try {
      var div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      div.style.cssText = 'position:fixed;left:-9999px;top:0;';
      div.innerHTML = html || plain;
      document.body.appendChild(div);
      var range = document.createRange();
      range.selectNodeContents(div);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      var ok = document.execCommand('copy');
      sel.removeAllRanges();
      document.body.removeChild(div);
      return !!ok;
    } catch (eFb) {
      return false;
    }
  };
  window.cchOpenInvoiceClientEmail = function () {
    var m = window._cchPendingInvoiceMail || {};
    /* Same pattern as decision / share emails: plain mailto with bare https:// URLs on their own lines.
       Outlook auto-links those. Do NOT use labeled HTML ("Open pay page") — mailto cannot carry it. */
    var href = m.mailto || '';
    if (!href) {
      if (typeof window.showToast === 'function') {
        window.showToast('No email draft ready — send the invoice again.', 'error');
      }
      return;
    }
    try {
      var a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      var sentModal = document.getElementById('cchInvoiceSentModal');
      if (sentModal) sentModal.remove();
      if (typeof window.showToast === 'function') {
        window.showToast('Email draft opened — the https:// links are clickable', 'success');
      }
    } catch (eOpen) {
      if (typeof window.showToast === 'function') {
        window.showToast('Could not open mail app', 'error');
      }
    }
  };
  window.cchCopyInvoiceClientEmail = async function () {
    var m = window._cchPendingInvoiceMail || {};
    var text = String(m.plain || '').trim();
    if (!text) {
      if (typeof window.showToast === 'function') window.showToast('Nothing to copy — send the invoice again.', 'error');
      return;
    }
    var ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch (eClip) { ok = false; }
    if (!ok) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.body.appendChild(ta);
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (eFb) { ok = false; }
    }
    if (typeof window.showToast === 'function') {
      window.showToast(ok ? 'Email text copied — paste into Outlook' : 'Could not copy', ok ? 'success' : 'error');
    }
  };
  window.cchCopyZelleText = function (btn) {
    if (!btn) return;
    var t = String(btn.getAttribute('data-copy') || '');
    var label = btn.getAttribute('data-label') || btn.textContent || 'Copy';
    function done() {
      btn.textContent = 'Copied!';
      setTimeout(function () { btn.textContent = label; }, 1800);
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (eCopy) {}
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).then(done).catch(fallback);
    } else {
      fallback();
    }
  };
  window.cchZelleInstructionsHtml = function (projectId, inv) {
    /* Same single Pay page (CC + Zelle details) — old /zelle/ links stay valid. */
    return typeof window.cchPayChoiceHtml === 'function'
      ? window.cchPayChoiceHtml(projectId, inv)
      : '';
  };
})();
