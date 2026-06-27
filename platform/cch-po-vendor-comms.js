/**
 * PO vendor communications — Phase 1 (mailto + thread log on PO doc).
 * Cc: orders@cchdesign.com · subject [PO-#] CCH Design — project
 */
(function() {
  'use strict';

  var ORDERS_EMAIL = 'orders@cchdesign.com';
  var FIRM = 'CCH Design Inc.';

  function esc(t) {
    if (t == null) return '';
    var d = document.createElement('div');
    d.textContent = String(t);
    return d.innerHTML;
  }

  function escAttr(t) {
    return esc(t).replace(/"/g, '&quot;');
  }

  function poNumber(docData) {
    docData = docData || {};
    var raw = String(docData.number || docData.num || docData.poNum || '').trim();
    if (!raw) return '';
    if (/^po[-\s#]/i.test(raw)) return raw.replace(/^po[-\s#]+/i, 'PO-');
    return 'PO-' + raw.replace(/^#+/, '');
  }

  function commThread(docData) {
    var rows = (docData && docData.vendorCommunications) ? docData.vendorCommunications : [];
    return rows.slice().sort(function(a, b) {
      return String(a.at || '').localeCompare(String(b.at || ''));
    });
  }

  async function appendComm(projectId, poId, entry) {
    entry.id = entry.id || ('vc-' + Date.now());
    entry.at = entry.at || new Date().toISOString();
    await firebase.firestore().collection('boards').doc(projectId)
      .collection('purchaseOrders').doc(poId).update({
        vendorCommunications: firebase.firestore.FieldValue.arrayUnion(entry),
        updatedAt: new Date().toISOString()
      });
    if (typeof window.logDocActivity === 'function') {
      var detail = entry.direction === 'inbound' ? 'Vendor reply logged' : 'Sent to vendor (mailto)';
      if (entry.subject) detail += ': ' + entry.subject;
      await window.logDocActivity(projectId, 'purchaseOrders', poId, 'vendor_comms', detail);
    }
  }

  window.cchPoOrdersInboxEmail = function() { return ORDERS_EMAIL; };

  window.cchPoVendorCommsPanelHtml = function(projectId, poId, docData, projData) {
    docData = docData || {};
    projData = projData || {};
    var thread = commThread(docData);
    var rows = thread.length
      ? thread.map(function(m) {
          var inbound = m.direction === 'inbound';
          var when = m.at && typeof window.formatDate === 'function' ? window.formatDate(m.at) : (m.at || '');
          var head = inbound ? ('Vendor' + (m.from ? ' · ' + esc(m.from) : '')) : ('You' + (m.from ? ' · ' + esc(m.from) : ''));
          return '<div style="padding:10px 12px;border:1px solid rgba(27,51,82,0.08);border-radius:4px;margin-bottom:8px;background:' + (inbound ? 'rgba(95,165,107,0.06)' : 'rgba(196,164,100,0.06)') + ';">' +
            '<div style="display:flex;justify-content:space-between;gap:8px;font-size:10px;color:#5C6B80;margin-bottom:4px;">' +
              '<span style="font-weight:700;color:#1B3352;">' + head + '</span>' +
              '<span>' + esc(when) + '</span>' +
            '</div>' +
            (m.subject ? '<div style="font-size:11px;font-weight:600;color:#1B3352;margin-bottom:4px;">' + esc(m.subject) + '</div>' : '') +
            '<div style="font-size:12px;color:#0F1A2E;line-height:1.45;white-space:pre-wrap;">' + esc(m.body || m.snippet || '') + '</div>' +
          '</div>';
        }).join('')
      : '<div style="font-size:12px;color:#9CA3AF;padding:8px 0;">No vendor messages yet. Use <strong>Send to vendor</strong> to start the thread.</div>';

    return '<div class="cch-doc-view-panel" id="cchPoVendorCommsPanel">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">' +
        '<div class="cch-doc-view-panel-title" style="margin:0;">Vendor communications</div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap;">' +
          '<button type="button" class="btn btn-primary btn-sm" style="background:#1B3352;color:#EDE8E0;" onclick="cchPoSendToVendor(\'' + escAttr(projectId) + '\',\'' + escAttr(poId) + '\')">📧 Send to vendor</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" onclick="cchPoLogVendorReply(\'' + escAttr(projectId) + '\',\'' + escAttr(poId) + '\')">↩ Log reply</button>' +
        '</div>' +
      '</div>' +
      '<p style="font-size:11px;color:#5C6B80;margin:0 0 10px;line-height:1.45;">Opens your email app · To: vendor · Cc: <strong>' + esc(ORDERS_EMAIL) + '</strong>. Use <strong>Reply All</strong> on vendor replies so orders@ stays on the thread.</p>' +
      rows +
    '</div>';
  };

  window.cchPoSendToVendor = async function(projectId, poId) {
    try {
      var snap = await firebase.firestore().collection('boards').doc(projectId)
        .collection('purchaseOrders').doc(poId).get();
      if (!snap.exists) {
        if (typeof window.cchAlert === 'function') await window.cchAlert('Purchase order not found.', 'Send to vendor');
        return;
      }
      var docData = snap.data() || {};
      var projSnap = await firebase.firestore().collection('boards').doc(projectId).get();
      var projData = projSnap.exists ? (projSnap.data() || {}) : {};

      var contact = { email: String(docData.vendorEmail || '').trim(), name: String(docData.vendor || '').trim() };
      if (typeof window.cchPoVendorContactResolved === 'function') {
        try {
          var resolved = await window.cchPoVendorContactResolved(docData);
          if (resolved && resolved.email) contact.email = resolved.email;
          if (resolved && resolved.name) contact.name = resolved.name;
        } catch (_e) {}
      }
      if (!contact.email) {
        if (typeof window.cchAlert === 'function') {
          await window.cchAlert('No vendor email on this PO. Add it under Edit PO or in Vendors, then try again.', 'Send to vendor');
        }
        return;
      }

      var num = poNumber(docData);
      var projName = String(projData.name || projectId).trim();
      var subject = '[' + num + '] CCH Design — ' + projName;
      var sender = (window.currentUser && window.currentUser.displayName) || (window.currentUser && window.currentUser.email) || 'CCH Design';
      var body = 'Hello' + (contact.name ? ' ' + contact.name.split(/\s+/)[0] : '') + ',\n\n' +
        'Please find our purchase order ' + num + ' for ' + projName + '.\n\n' +
        'Attach the PO PDF from Studio (Preview → Print/PDF) if needed.\n\n' +
        'Please Reply All so ' + ORDERS_EMAIL + ' stays on the thread.\n\n' +
        'Thank you,\n' + sender + '\n' + FIRM;

      await appendComm(projectId, poId, {
        direction: 'outbound',
        channel: 'mailto',
        from: (window.currentUser && window.currentUser.email) || sender,
        to: contact.email,
        cc: ORDERS_EMAIL,
        subject: subject,
        body: body,
        snippet: body.split('\n').slice(0, 3).join(' ')
      });

      var href = 'mailto:' + encodeURIComponent(contact.email) +
        '?cc=' + encodeURIComponent(ORDERS_EMAIL) +
        '&subject=' + encodeURIComponent(subject) +
        '&body=' + encodeURIComponent(body);
      window.open(href, '_blank');

      if (typeof window.showToast === 'function') window.showToast('Outbound logged · opening email', 'success');
      if (window.location.hash.indexOf('/po/' + poId) >= 0 && typeof window.renderProjectDetail === 'function') {
        window.renderProjectDetail();
      }
    } catch (e) {
      console.error('cchPoSendToVendor', e);
      if (typeof window.cchAlert === 'function') await window.cchAlert('Could not send: ' + (e.message || e), 'Send to vendor');
    }
  };

  window.cchPoLogVendorReply = async function(projectId, poId) {
    try {
      var snap = await firebase.firestore().collection('boards').doc(projectId)
        .collection('purchaseOrders').doc(poId).get();
      if (!snap.exists) return;
      var docData = snap.data() || {};
      var num = poNumber(docData);

      var from = '';
      if (typeof window.cchPrompt === 'function') {
        from = await window.cchPrompt('Vendor / sender name (optional):', '', 'Log vendor reply');
        if (from === null) return;
      }
      var body = '';
      if (typeof window.cchPrompt === 'function') {
        body = await window.cchPrompt('Paste the vendor reply:', '', 'Log vendor reply');
        if (body === null || !String(body).trim()) return;
      } else return;

      await appendComm(projectId, poId, {
        direction: 'inbound',
        channel: 'manual',
        from: String(from || docData.vendor || '').trim(),
        subject: 'Re: [' + num + ']',
        body: String(body).trim(),
        snippet: String(body).trim().slice(0, 240)
      });

      if (typeof window.showToast === 'function') window.showToast('Vendor reply logged', 'success');
      if (typeof window.renderProjectDetail === 'function') window.renderProjectDetail();
    } catch (e) {
      console.error('cchPoLogVendorReply', e);
      if (typeof window.cchAlert === 'function') await window.cchAlert('Could not log reply: ' + (e.message || e), 'Log reply');
    }
  };

})();
