/**
 * CCH Studio → Airtable push (callable wrapper + UI helpers).
 */
(function() {
  'use strict';

  window.cchCanPushToAirtable = function() {
    if (typeof window.isClientProjectGuestSession === 'function' && window.isClientProjectGuestSession()) return false;
    if (typeof window.userCanPushToQB === 'function') return window.userCanPushToQB();
    return false;
  };

  window.cchPushToAirtable = async function(opts, btnEl) {
    opts = opts || {};
    if (!window.cchCanPushToAirtable()) {
      if (typeof window.showToast === 'function') window.showToast('Not authorized to push to Airtable.', 'warning');
      return null;
    }
    var scope = opts.scope || 'po';
    if (scope === 'firm') {
      var ok = typeof window.cchConfirm === 'function'
        ? await window.cchConfirm(
          'Push all active Studio POs to Airtable?\n\nReceiver-entered check-ins (qty received, photos, etc.) will not be overwritten.',
          'Push to Airtable',
          { confirmText: 'Push all', cancelText: 'Cancel' }
        )
        : confirm('Push all active Studio POs to Airtable? Receiver check-ins will not be overwritten.');
      if (!ok) return null;
    }
    var prevHtml = '';
    if (btnEl) {
      prevHtml = btnEl.innerHTML;
      btnEl.disabled = true;
      btnEl.innerHTML = 'Pushing…';
    }
    try {
      var fn = firebase.functions().httpsCallable('pushPOsToAirtable');
      var res = await fn({
        scope: scope,
        projectId: opts.projectId,
        poId: opts.poId
      });
      var data = res && res.data ? res.data : {};
      var msg = data.message || 'Pushed to Airtable';
      if (typeof window.showToast === 'function') window.showToast(msg, 'success');
      return data;
    } catch (e) {
      var errMsg = (e && e.message) ? e.message : String(e);
      if (typeof window.cchAlert === 'function') await window.cchAlert(errMsg, 'Airtable push failed');
      else if (typeof window.showToast === 'function') window.showToast(errMsg, 'error');
      throw e;
    } finally {
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.innerHTML = prevHtml || 'Push to Airtable';
      }
    }
  };

  window.cchAirtablePushBtnHtml = function(opts) {
    opts = opts || {};
    if (!window.cchCanPushToAirtable()) return '';
    var scope = opts.scope || 'po';
    var label = opts.label || (scope === 'firm' ? 'Push all to Airtable' : '↗ Airtable');
    var pj = String(opts.projectId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var po = String(opts.poId || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var payload = "{scope:'" + scope + "'" +
      (opts.projectId ? ",projectId:'" + pj + "'" : '') +
      (opts.poId ? ",poId:'" + po + "'" : '') + "}";
    return '<button type="button" class="btn btn-secondary btn-sm" style="margin-left:6px;" ' +
      'title="Upsert PO + lines to CCH Delivery Receiving (Airtable)" ' +
      'onclick="cchPushToAirtable(' + payload + ',this)">' + label + '</button>';
  };

  console.log('[CCH Airtable push] loaded');
})();
