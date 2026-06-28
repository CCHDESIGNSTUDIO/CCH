/**
 * CCH PO Vendor Email & Communications — Phase 1 (staging)
 * mailto send + Cc orders@cchdesign.com + log to correspondence thread per PO.
 */
(function() {
  'use strict';

  var CCH_PO_ORDERS_CC = 'orders@cchdesign.com';
  var CCH_PO_COMMS_V = '20260627c';

  function esc(s) {
    return (typeof window.esc === 'function') ? window.esc(s) : String(s == null ? '' : s);
  }
  function escAttr(s) {
    return (typeof window.escAttr === 'function') ? window.escAttr(s) : esc(s).replace(/"/g, '&quot;');
  }
  function escJs(s) {
    return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }
  function fmtDate(d) {
    if (typeof window.formatDate === 'function') return window.formatDate(d);
    if (!d) return '';
    try { return new Date(d).toLocaleDateString(); } catch (_e) { return String(d).slice(0, 10); }
  }

  function cchPoCommsPoNum(docData) {
    return String((docData && (docData.number || docData.num || docData.poNum)) || '').trim();
  }

  function cchPoCommsSenderName() {
    var u = (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) || window.currentUser;
    if (u && u.displayName) return String(u.displayName).trim();
    if (u && u.email) {
      var p = String(u.email).split('@')[0];
      return p.charAt(0).toUpperCase() + p.slice(1);
    }
    return 'CCH Design';
  }

  function cchPoCommsSenderEmail() {
    var u = (typeof firebase !== 'undefined' && firebase.auth && firebase.auth().currentUser) || window.currentUser;
    return (u && u.email) ? String(u.email).trim() : '';
  }

  function cchPoNormEmail(s) {
    return String(s || '').trim().toLowerCase();
  }

  function cchPoEmailValid(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
  }

  async function cchPoResolveVendorRecord(vendorName) {
    var name = String(vendorName || '').trim();
    if (!name) return null;
    var lower = name.toLowerCase();
    if (window.vendorsCache && Array.isArray(window.vendorsCache)) {
      var cached = window.vendorsCache.find(function(v) {
        return v && String(v.name || '').trim().toLowerCase() === lower;
      });
      if (cached) return Object.assign({ id: cached.id || '' }, cached);
    }
    try {
      var snap = await firebase.firestore().collection('vendors').where('name', '==', name).limit(1).get();
      if (!snap.empty) {
        var d0 = snap.docs[0];
        return Object.assign({ id: d0.id }, d0.data());
      }
      var all = await firebase.firestore().collection('vendors').limit(3000).get();
      var best = null;
      all.forEach(function(d) {
        if (best) return;
        var v = d.data() || {};
        var vn = String(v.name || v.company || v.vendor || '').trim();
        if (!vn) return;
        var vl = vn.toLowerCase();
        if (vl === lower || (vl.length > 3 && lower.length > 3 && (vl.indexOf(lower) >= 0 || lower.indexOf(vl) >= 0))) {
          best = Object.assign({ id: d.id }, v);
        }
      });
      return best;
    } catch (e) {
      console.warn('[cch-po-vendor-comms] vendor lookup', e);
      return null;
    }
  }

  function cchPoCollectEmailCandidates(docData, vendorRec) {
    var out = [];
    var seen = {};
    function add(name, email, source) {
      email = String(email || '').trim();
      if (!email || !cchPoEmailValid(email)) return;
      var key = cchPoNormEmail(email);
      if (seen[key]) return;
      seen[key] = true;
      out.push({
        name: String(name || '').trim(),
        email: email,
        source: source || ''
      });
    }
    docData = docData || {};
    add(docData.vendorContact || docData.vendor, docData.vendorEmail, 'po');
    if (vendorRec) {
      add(vendorRec.contact || vendorRec.contactName || vendorRec.rep, vendorRec.email, 'vendor');
      add(vendorRec.contact || vendorRec.contactName, vendorRec.contactEmail, 'vendor');
      (vendorRec.vendorContacts || []).forEach(function(c) {
        add(c.name || c.contact, c.email, 'vendorContacts');
      });
    }
    return out;
  }

  async function cchPoLookupVendorContact(vendorName, docData) {
    var name = String(vendorName || '').trim();
    var rec = name ? await cchPoResolveVendorRecord(name) : null;
    var candidates = cchPoCollectEmailCandidates(docData, rec);
    var first = candidates[0] || {};
    return {
      id: rec && rec.id,
      name: (rec && rec.name) || name,
      email: first.email || '',
      contact: first.name || String((rec && rec.contact) || '').trim(),
      candidates: candidates
    };
  }

  async function cchPoSaveVendorEmailRecords(projectId, poId, docData, opts) {
    opts = opts || {};
    var email = String(opts.email || '').trim();
    var contactName = String(opts.contactName || '').trim();
    var saveToCatalog = !!opts.saveToCatalog;
    var vendorName = String((docData && docData.vendor) || '').trim();
    if (!email) return;

    var poPatch = { vendorEmail: email, updatedAt: new Date().toISOString() };
    if (contactName) poPatch.vendorContact = contactName;
    await firebase.firestore().collection('boards').doc(projectId)
      .collection('purchaseOrders').doc(poId).update(poPatch);

    if (!saveToCatalog || !vendorName) return;

    var rec = await cchPoResolveVendorRecord(vendorName);
    var normNew = cchPoNormEmail(email);
    if (rec && rec.id) {
      var primary = cchPoNormEmail(rec.email || rec.contactEmail);
      var patch = { updatedAt: new Date().toISOString() };
      if (!primary) {
        patch.email = email;
        if (contactName) patch.contact = contactName;
      } else if (primary === normNew) {
        if (contactName && !String(rec.contact || '').trim()) patch.contact = contactName;
      } else {
        var extras = Array.isArray(rec.vendorContacts) ? rec.vendorContacts.slice() : [];
        var exists = extras.some(function(c) { return cchPoNormEmail(c.email) === normNew; });
        if (!exists) {
          extras.push({
            name: contactName,
            email: email,
            addedAt: new Date().toISOString(),
            source: 'po_send'
          });
          patch.vendorContacts = extras;
        }
      }
      if (Object.keys(patch).length > 1) {
        await firebase.firestore().collection('vendors').doc(rec.id).update(patch);
        if (window.vendorsCache && Array.isArray(window.vendorsCache)) {
          var hit = window.vendorsCache.find(function(v) { return v && v.id === rec.id; });
          if (hit) Object.assign(hit, patch);
        }
      }
    } else {
      await firebase.firestore().collection('vendors').add({
        name: vendorName,
        email: email,
        contact: contactName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        owner: (window.currentUser && window.currentUser.email) || ''
      });
      if (typeof window._invalidateShipToContactsCache === 'function') window._invalidateShipToContactsCache();
    }
  }

  window.cchPoOnVendorEmailPick = function(sel) {
    if (!sel) return;
    var opt = sel.options[sel.selectedIndex];
    if (!opt || !opt.value) return;
    var toEl = document.getElementById('cchPoEmailTo');
    var nameEl = document.getElementById('cchPoEmailContactName');
    if (toEl) toEl.value = opt.value;
    if (nameEl && opt.getAttribute('data-name')) nameEl.value = opt.getAttribute('data-name') || '';
  };

  function cchPoCommsLineSummary(items) {
    var lines = [];
    (items || []).slice(0, 24).forEach(function(it) {
      if (typeof window.isProposalGroupHeaderItem === 'function' && window.isProposalGroupHeaderItem(it)) return;
      var qty = parseFloat(it.qty) || 1;
      var title = String(it.title || it.description || 'Item').trim();
      var brand = String(it.vendor || '').trim();
      var sku = String(it.sku || '').trim();
      var parts = [];
      if (qty > 1) parts.push(qty + '×');
      parts.push(title);
      if (brand) parts.push('(' + brand + ')');
      if (sku) parts.push('SKU ' + sku);
      lines.push('• ' + parts.join(' '));
    });
    if ((items || []).length > 24) lines.push('• … +' + ((items || []).length - 24) + ' more line(s)');
    return lines.join('\n');
  }

  function cchPoCommsEmailSubject(poNum, projName, vendorName) {
    var tag = poNum ? '[' + poNum + ']' : '[PO]';
    var bits = [tag, 'CCH Design'];
    if (projName) bits.push(String(projName).trim());
    if (vendorName) bits.push(String(vendorName).trim());
    return bits.join(' — ');
  }

  function cchPoCommsEmailBody(poNum, projName, items, userMessage) {
    var msg = String(userMessage || '').trim();
    var body = 'Hi,\n\n';
    body += 'Please find purchase order ' + (poNum || '') + (projName ? ' for ' + projName : '') + '.\n';
    body += 'Attach the PO PDF from Studio (PO view → Preview → Print / Save as PDF).\n\n';
    if (msg) body += msg + '\n\n';
    var summary = cchPoCommsLineSummary(items);
    if (summary) body += 'Line summary:\n' + summary + '\n\n';
    body += 'Please confirm receipt and advise lead time.\n\n';
    body += 'Thank you,\n';
    body += cchPoCommsSenderName() + '\n';
    body += 'CCH Design Inc.\n';
    body += '2481 N. Riverside Dr, Santa Ana, CA 92706\n';
    body += '(949) 497-7979\n';
    body += 'www.cchdesign.com';
    return body;
  }

  async function cchPoLogVendorCorrespondence(projectId, poId, docData, opts) {
    opts = opts || {};
    var poNum = cchPoCommsPoNum(docData);
    var vendorName = String((docData && docData.vendor) || opts.vendor || '').trim();
    var _cUser = cchPoCommsSenderName();
    var data = {
      commType: 'vendor_email',
      direction: opts.direction || 'outbound',
      subject: opts.subject || '',
      body: opts.body || '',
      from: opts.from || cchPoCommsSenderEmail(),
      to: opts.to || '',
      cc: opts.cc || CCH_PO_ORDERS_CC,
      vendor: vendorName,
      contact: opts.contact || '',
      date: new Date().toISOString().split('T')[0],
      linkedDocType: 'purchaseOrders',
      linkedDocId: poId,
      linkedDocNum: poNum ? ('📦 PO ' + poNum) : ('📦 PO ' + poId.slice(0, 8)),
      poId: poId,
      poNumber: poNum,
      attachmentUrls: opts.attachmentUrls || [],
      loggedBy: _cUser,
      loggedByEmail: cchPoCommsSenderEmail(),
      createdAt: new Date().toISOString(),
      _poCommsV: CCH_PO_COMMS_V
    };
    if (opts.inbound) data._inboundManual = true;
    await firebase.firestore().collection('boards').doc(projectId).collection('correspondence').add(data);
  }

  async function cchPoLoadVendorCommsThread(projectId, poId) {
    var rows = [];
    try {
      var snap = await firebase.firestore().collection('boards').doc(projectId).collection('correspondence').get();
      snap.forEach(function(d) {
        var c = d.data() || {};
        var linked = String(c.linkedDocId || '') === String(poId) || String(c.poId || '') === String(poId);
        var isVendor = (c.commType === 'vendor_email') || (c.type === 'vendor_po');
        if (!linked && !(isVendor && c.poId === poId)) return;
        if (c.commType && c.commType !== 'vendor_email') return;
        rows.push({ id: d.id, data: c });
      });
    } catch (e) {
      console.warn('[cch-po-vendor-comms] thread load', e);
    }
    rows.sort(function(a, b) {
      var da = a.data.createdAt || a.data.date || '';
      var db = b.data.createdAt || b.data.date || '';
      return String(da).localeCompare(String(db));
    });
    return rows;
  }

  function cchPoCommsThreadHtml(rows) {
    if (!rows.length) {
      return '<div style="padding:16px;text-align:center;color:var(--gray-400);font-size:13px;">No vendor emails logged for this PO yet.</div>';
    }
    return rows.map(function(row) {
      var c = row.data;
      var outbound = (c.direction || 'outbound') !== 'inbound';
      var bubbleBg = outbound ? 'rgba(196,164,100,0.12)' : 'rgba(27,51,82,0.06)';
      var align = outbound ? 'flex-end' : 'flex-start';
      var label = outbound ? 'Sent' : 'Received';
      var icon = outbound ? '📤' : '📥';
      var when = fmtDate(c.date || c.createdAt);
      var subj = c.subject ? '<div style="font-weight:600;font-size:13px;margin-bottom:4px;">' + esc(c.subject) + '</div>' : '';
      var meta = [label, when, c.from ? ('from ' + esc(c.from)) : '', c.to ? ('to ' + esc(c.to)) : ''].filter(Boolean).join(' · ');
      var preview = String(c.body || '').trim();
      if (preview.length > 280) preview = preview.slice(0, 280) + '…';
      return '<div style="display:flex;justify-content:' + align + ';margin-bottom:10px;">' +
        '<div style="max-width:92%;padding:12px 14px;border-radius:4px;background:' + bubbleBg + ';border:1px solid rgba(27,51,82,0.08);">' +
          '<div style="font-size:10px;color:#5C6B80;margin-bottom:6px;">' + icon + ' ' + esc(meta) + '</div>' +
          subj +
          '<div style="font-size:12px;color:#0F1A2E;line-height:1.5;white-space:pre-wrap;">' + esc(preview || '(no body)') + '</div>' +
        '</div></div>';
    }).join('');
  }

  function cchPoCommsPanelShell(projectId, poId, docData) {
    var poNum = cchPoCommsPoNum(docData);
    var vendor = String(docData.vendor || '').trim();
    return '<div class="cch-doc-view-panel" id="cchPoVendorCommsPanel" style="margin-top:10px;" data-project-id="' + escAttr(projectId) + '" data-po-id="' + escAttr(poId) + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px;">' +
        '<div class="cch-doc-view-panel-title" style="margin:0;">Vendor communications</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
          '<button type="button" class="btn btn-primary btn-sm" onclick="cchPoEmailVendor(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\')">📧 Email vendor</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" onclick="cchPoLogVendorReplyModal(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\')">📥 Log reply</button>' +
        '</div>' +
      '</div>' +
      '<p style="font-size:11px;color:#5C6B80;margin:0 0 12px;line-height:1.45;">' +
        'Opens your email client to <strong>' + esc(vendor || 'vendor') + '</strong> with <strong>Cc: ' + esc(CCH_PO_ORDERS_CC) + '</strong>. ' +
        'Subject is tagged <code style="font-size:10px;">[' + esc(poNum || 'PO') + ']</code> for threading. Team-only — not on client portal.' +
      '</p>' +
      '<div id="cchPoVendorCommsThread">Loading…</div>' +
    '</div>';
  }

  async function cchPoRefreshVendorCommsThread(projectId, poId) {
    var el = document.getElementById('cchPoVendorCommsThread');
    if (!el) return;
    var rows = await cchPoLoadVendorCommsThread(projectId, poId);
    el.innerHTML = cchPoCommsThreadHtml(rows);
  }

  window.cchPoMountVendorCommsPanel = async function(projectId, poId, docData) {
    var main = document.querySelector('.cch-doc-view-main');
    if (!main) return;
    var existing = document.getElementById('cchPoVendorCommsPanel');
    if (!existing) {
      main.insertAdjacentHTML('beforeend', cchPoCommsPanelShell(projectId, poId, docData || {}));
    } else {
      existing.setAttribute('data-project-id', projectId);
      existing.setAttribute('data-po-id', poId);
    }
    await cchPoRefreshVendorCommsThread(projectId, poId);
    var rail = document.querySelector('.cch-doc-view-rail-actions');
    if (rail && !document.getElementById('cchPoRailEmailVendorBtn')) {
      rail.insertAdjacentHTML('afterbegin',
        '<button type="button" id="cchPoRailEmailVendorBtn" class="btn btn-primary btn-sm" style="background:#1B3352;color:#EDE8E0;" onclick="cchPoEmailVendor(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\')">📧 Email vendor</button>');
    }
  };

  window.cchPoOpenSendVendorEmailModal = async function(projectId, poId, docData, items, projData) {
    docData = docData || {};
    items = items || docData.items || [];
    projData = projData || {};
    var poNum = cchPoCommsPoNum(docData);
    var vendorName = String(docData.vendor || '').trim();
    var contact = await cchPoLookupVendorContact(vendorName, docData);
    var candidates = contact.candidates || [];
    var projName = projData.name || projectId;
    var defaultSubject = cchPoCommsEmailSubject(poNum, projName, vendorName);
    var defaultBody = cchPoCommsEmailBody(poNum, projName, items, '');
    var pickHtml = '';
    if (candidates.length > 1) {
      var opts = candidates.map(function(c) {
        var label = (c.name ? c.name + ' · ' : '') + c.email;
        return '<option value="' + escAttr(c.email) + '" data-name="' + escAttr(c.name) + '">' + esc(label) + '</option>';
      }).join('');
      pickHtml = '<div class="form-group"><label class="form-label">Saved contacts</label>' +
        '<select class="form-input" id="cchPoEmailPick" onchange="cchPoOnVendorEmailPick(this)">' +
        '<option value="">Choose a contact…</option>' + opts + '</select></div>';
    }
    var noEmailHint = candidates.length
      ? ''
      : '<p style="font-size:12px;color:#B45309;margin:0 0 12px;line-height:1.45;">No vendor email on file yet — enter one below. It can be saved to <strong>' + esc(vendorName || 'this vendor') + '</strong> for future POs.</p>';

    document.getElementById('modalContainer').innerHTML =
      '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">' +
        '<div class="modal" style="width:640px;max-height:90vh;overflow-y:auto;">' +
          '<div class="modal-header"><div class="modal-title">Email PO to vendor</div><button class="modal-close" onclick="closeModal()">&times;</button></div>' +
          '<div class="modal-body">' +
            '<p style="font-size:12px;color:#5C6B80;margin:0 0 14px;line-height:1.5;">Sends from <strong>your</strong> email account. Cc copies <strong>' + esc(CCH_PO_ORDERS_CC) + '</strong>. Branding: <strong>CCH Design Inc.</strong></p>' +
            noEmailHint +
            pickHtml +
            '<div class="form-group"><label class="form-label">To (vendor email) *</label>' +
              '<input class="form-input" id="cchPoEmailTo" type="email" value="' + escAttr(contact.email) + '" placeholder="vendor@example.com"></div>' +
            '<div class="form-group"><label class="form-label">Contact name (optional)</label>' +
              '<input class="form-input" id="cchPoEmailContactName" value="' + escAttr(contact.contact) + '" placeholder="Rep name"></div>' +
            '<label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:#0F1A2E;margin:0 0 14px;cursor:pointer;line-height:1.45;">' +
              '<input type="checkbox" id="cchPoEmailSaveVendor" checked style="margin-top:2px;">' +
              '<span>Save email to <strong>' + esc(vendorName || 'vendor') + '</strong> for future POs' +
              (candidates.length > 1 ? ' (adds extra contacts when different from the primary email)' : '') + '</span></label>' +
            '<div class="form-group"><label class="form-label">Cc</label>' +
              '<input class="form-input" id="cchPoEmailCc" value="' + escAttr(CCH_PO_ORDERS_CC) + '" readonly style="background:var(--gray-50);"></div>' +
            '<div class="form-group"><label class="form-label">Vendor / payee</label>' +
              '<input class="form-input" value="' + escAttr(vendorName || contact.name) + '" readonly style="background:var(--gray-50);"></div>' +
            '<div class="form-group"><label class="form-label">Subject</label>' +
              '<input class="form-input" id="cchPoEmailSubject" value="' + escAttr(defaultSubject) + '"></div>' +
            '<div class="form-group"><label class="form-label">Message</label>' +
              '<textarea class="form-textarea" id="cchPoEmailBody" rows="8">' + esc(defaultBody) + '</textarea></div>' +
            '<p style="font-size:11px;color:#B45309;margin:0;line-height:1.45;">Tip: After your email client opens, attach the PO PDF from <strong>Preview → Print → Save as PDF</strong>.</p>' +
          '</div>' +
          '<div class="modal-footer">' +
            '<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
            '<button class="btn btn-primary" onclick="cchPoSendVendorEmailConfirm(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\')">Open email &amp; log</button>' +
          '</div>' +
        '</div></div>';
  };

  window.cchPoSendVendorEmailConfirm = async function(projectId, poId) {
    var to = (document.getElementById('cchPoEmailTo') && document.getElementById('cchPoEmailTo').value || '').trim();
    var contactName = (document.getElementById('cchPoEmailContactName') && document.getElementById('cchPoEmailContactName').value || '').trim();
    var saveVendor = !!(document.getElementById('cchPoEmailSaveVendor') && document.getElementById('cchPoEmailSaveVendor').checked);
    var cc = (document.getElementById('cchPoEmailCc') && document.getElementById('cchPoEmailCc').value || CCH_PO_ORDERS_CC).trim();
    var subject = (document.getElementById('cchPoEmailSubject') && document.getElementById('cchPoEmailSubject').value || '').trim();
    var body = (document.getElementById('cchPoEmailBody') && document.getElementById('cchPoEmailBody').value || '').trim();
    if (!to) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('Enter the vendor email address, then try again.', 'Email vendor');
      else alert('Vendor email is required.');
      return;
    }
    if (!cchPoEmailValid(to)) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('Enter a valid email address (example: orders@vendor.com).', 'Email vendor');
      else alert('Enter a valid email address.');
      return;
    }
    try {
      var snap = await firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
      var docData = snap.exists ? Object.assign({ id: poId }, snap.data()) : { id: poId };
      var prior = cchPoCollectEmailCandidates(docData, await cchPoResolveVendorRecord(docData.vendor));
      var isNewEmail = !prior.some(function(c) { return cchPoNormEmail(c.email) === cchPoNormEmail(to); });
      if (isNewEmail || saveVendor) {
        await cchPoSaveVendorEmailRecords(projectId, poId, docData, {
          email: to,
          contactName: contactName,
          saveToCatalog: saveVendor
        });
      } else {
        await firebase.firestore().collection('boards').doc(projectId)
          .collection('purchaseOrders').doc(poId).update({
            vendorEmail: to,
            updatedAt: new Date().toISOString()
          });
      }
      var mailto = 'mailto:' + encodeURIComponent(to);
      var qs = [];
      if (cc) qs.push('cc=' + encodeURIComponent(cc));
      if (subject) qs.push('subject=' + encodeURIComponent(subject));
      if (body) qs.push('body=' + encodeURIComponent(body));
      if (qs.length) mailto += '?' + qs.join('&');
      window.location.href = mailto;
      if (typeof window.closeModal === 'function') window.closeModal();
      var logOk = true;
      try {
        await cchPoLogVendorCorrespondence(projectId, poId, docData, {
          subject: subject,
          body: body,
          to: to,
          cc: cc,
          contact: contactName,
          direction: 'outbound'
        });
        await cchPoRefreshVendorCommsThread(projectId, poId);
      } catch (logErr) {
        logOk = false;
        console.warn('[cch-po-vendor-comms] correspondence log', logErr);
      }
      var toastMsg = !logOk
        ? 'Email opened — thread log failed (permissions). Refresh after rules deploy.'
        : (isNewEmail && saveVendor
          ? 'Email saved to vendor · mail opened (Cc: orders@)'
          : 'Email opened — correspondence logged (Cc: orders@)');
      if (typeof window.showToast === 'function') window.showToast(toastMsg, logOk ? 'success' : 'warning');
      if (typeof window.renderProjectDetail === 'function') window.renderProjectDetail();
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('Failed: ' + (e.message || e), 'Email vendor');
      else alert('Failed: ' + (e.message || e));
    }
  };

  window.cchPoEmailVendor = async function(projectId, poId) {
    try {
      var snap = await firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
      if (!snap.exists) {
        if (typeof window.cchAlert === 'function') await window.cchAlert('PO not found.', 'Email vendor');
        return;
      }
      var docData = Object.assign({ id: poId }, snap.data());
      var projName = projectId;
      try {
        var ps = await firebase.firestore().collection('boards').doc(projectId).get();
        if (ps.exists) projName = ps.data().name || projectId;
      } catch (_e) {}
      await window.cchPoOpenSendVendorEmailModal(projectId, poId, docData, docData.items || [], { name: projName });
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('Could not load PO: ' + (e.message || e), 'Email vendor');
    }
  };

  window.cchPoLogVendorReplyModal = async function(projectId, poId) {
    try {
      var snap = await firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
      var docData = snap.exists ? snap.data() : {};
      var poNum = cchPoCommsPoNum(docData);
      var vendorName = String(docData.vendor || '').trim();
      document.getElementById('modalContainer').innerHTML =
        '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">' +
          '<div class="modal" style="width:600px;max-height:90vh;overflow-y:auto;">' +
            '<div class="modal-header"><div class="modal-title">Log vendor reply</div><button class="modal-close" onclick="closeModal()">&times;</button></div>' +
            '<div class="modal-body">' +
              '<p style="font-size:12px;color:#5C6B80;margin:0 0 12px;">Paste the vendor reply until auto-capture from orders@ is enabled (Phase 2).</p>' +
              '<div class="form-group"><label class="form-label">From</label><input class="form-input" id="cchPoReplyFrom" placeholder="vendor contact email"></div>' +
              '<div class="form-group"><label class="form-label">Subject</label><input class="form-input" id="cchPoReplySubject" value="' + escAttr('Re: ' + cchPoCommsEmailSubject(poNum, '', vendorName)) + '"></div>' +
              '<div class="form-group"><label class="form-label">Reply text</label><textarea class="form-textarea" id="cchPoReplyBody" rows="8" placeholder="Paste vendor reply…"></textarea></div>' +
            '</div>' +
            '<div class="modal-footer">' +
              '<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
              '<button class="btn btn-primary" onclick="cchPoSaveVendorReply(\'' + escJs(projectId) + '\',\'' + escJs(poId) + '\')">Save to thread</button>' +
            '</div></div></div>';
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('Error: ' + (e.message || e), 'Log reply');
    }
  };

  window.cchPoSaveVendorReply = async function(projectId, poId) {
    var from = (document.getElementById('cchPoReplyFrom') && document.getElementById('cchPoReplyFrom').value || '').trim();
    var subject = (document.getElementById('cchPoReplySubject') && document.getElementById('cchPoReplySubject').value || '').trim();
    var body = (document.getElementById('cchPoReplyBody') && document.getElementById('cchPoReplyBody').value || '').trim();
    if (!body && !subject) {
      alert('Add a subject or reply text.');
      return;
    }
    try {
      var snap = await firebase.firestore().collection('boards').doc(projectId).collection('purchaseOrders').doc(poId).get();
      var docData = snap.exists ? snap.data() : {};
      await cchPoLogVendorCorrespondence(projectId, poId, docData, {
        direction: 'inbound',
        inbound: true,
        from: from,
        to: cchPoCommsSenderEmail() || CCH_PO_ORDERS_CC,
        subject: subject,
        body: body
      });
      if (typeof window.closeModal === 'function') window.closeModal();
      if (typeof window.showToast === 'function') window.showToast('Vendor reply logged', 'success');
      await cchPoRefreshVendorCommsThread(projectId, poId);
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('Save failed: ' + (e.message || e), 'Log reply');
    }
  };

  window.emailVendorPO = window.cchPoEmailVendor;

  var _origDocView = window.renderDocViewPage;
  if (typeof _origDocView === 'function') {
    window.renderDocViewPage = function(type, projectId, docId, docData, items, projData) {
      _origDocView.apply(this, arguments);
      if (type === 'po') {
        setTimeout(function() {
          window.cchPoMountVendorCommsPanel(projectId, docId, docData);
        }, 0);
      }
    };
  }

  console.log('[cch-po-vendor-comms] loaded v' + CCH_PO_COMMS_V);
})();
