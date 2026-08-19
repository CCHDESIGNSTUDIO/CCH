/* CCH Client Portal — Share an idea → Client Ideas (WO-091 Immediate)
 * Upload/URL → Cloud Function clientPortalShareIdea → Storage + ideabooks/client-ideas
 * Notify path mirrors WO-089 (messages + staffChat + activity) inside the function.
 */
(function () {
  'use strict';

  var MAX_BYTES = 8 * 1024 * 1024;
  var SECTION_ID = 'client-ideas';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fnBase() {
    if (typeof window.cchCloudFunctionsBase === 'function') return window.cchCloudFunctionsBase();
    var env = window._cchEnv || '';
    if (env === 'staging' || (typeof location !== 'undefined' && /staging|localhost|127\.0\.0\.1/i.test(location.hostname || ''))) {
      return 'https://us-central1-cch-studio-staging.cloudfunctions.net';
    }
    return 'https://us-central1-cch-design-boards.cloudfunctions.net';
  }

  function closeModal() {
    var el = document.getElementById('cchCiShareModal');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function showAck(msg) {
    if (typeof showToast === 'function') {
      showToast(msg, 'success');
      return;
    }
    var n = document.createElement('div');
    n.setAttribute('role', 'status');
    n.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:120060;background:#0A1F3D;color:#fff;padding:12px 18px;font-size:13px;font-family:DM Sans,sans-serif;max-width:90%;';
    n.textContent = String(msg || '');
    document.body.appendChild(n);
    setTimeout(function () { if (n.parentNode) n.parentNode.removeChild(n); }, 3200);
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type || file.type.indexOf('image/') !== 0) {
        reject(new Error('Please choose an image file.'));
        return;
      }
      if (file.size > MAX_BYTES) {
        reject(new Error('Image must be under 8MB.'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var r = String(reader.result || '');
        var i = r.indexOf('base64,');
        resolve({ base64: i >= 0 ? r.slice(i + 7) : r, mime: file.type || 'image/jpeg' });
      };
      reader.onerror = function () { reject(new Error('Could not read that file.')); };
      reader.readAsDataURL(file);
    });
  }

  async function submitIdea(projectId, payload) {
    var url = fnBase() + '/clientPortalShareIdea';
    var resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    var data = {};
    try { data = await resp.json(); } catch (_e) { data = {}; }
    if (!resp.ok) throw new Error(data.error || ('Upload failed (' + resp.status + ')'));
    return data;
  }

  window.cchClientIdeasOpenShare = async function (projectId) {
    projectId = String(projectId || '').trim();
    if (!projectId) return;

    var ident = null;
    if (typeof cpPortalEnsureClientIdentity === 'function') {
      ident = await cpPortalEnsureClientIdentity(projectId);
    } else if (typeof cpPortalEffectiveClientIdentity === 'function') {
      ident = cpPortalEffectiveClientIdentity();
    }
    if (!ident || !String(ident.email || '').trim()) {
      showAck('Please enter your name and email first so we know who shared this.');
      return;
    }

    closeModal();
    var wrap = document.createElement('div');
    wrap.id = 'cchCiShareModal';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:120050;background:rgba(10,31,61,0.45);display:flex;align-items:center;justify-content:center;padding:20px;';
    wrap.innerHTML =
      '<div style="background:#fff;border:1px solid #E2E2E2;max-width:440px;width:100%;padding:28px 24px;font-family:\'DM Sans\',sans-serif;color:#0A1F3D;">' +
      '<div style="font-family:\'Playfair Display\',Georgia,serif;font-size:22px;font-weight:500;margin-bottom:8px;">Share an idea</div>' +
      '<p style="font-size:13px;color:#6B7280;line-height:1.5;margin:0 0 18px;">Upload a photo from your device, or paste an image URL. It appears on your <strong>Client Ideas</strong> board for your designer (not mixed into their curated boards).</p>' +
      '<label style="display:block;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;margin-bottom:6px;">Photo from your device</label>' +
      '<input type="file" id="cchCiFile" accept="image/*" style="display:block;width:100%;margin-bottom:14px;font-size:13px;">' +
      '<label style="display:block;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;margin-bottom:6px;">Or paste an image URL</label>' +
      '<input type="url" id="cchCiUrl" placeholder="https://…" style="width:100%;box-sizing:border-box;border:1px solid #E2E2E2;padding:10px 12px;font-size:13px;margin-bottom:14px;font-family:inherit;">' +
      '<label style="display:block;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;margin-bottom:6px;">Optional note</label>' +
      '<textarea id="cchCiCaption" rows="3" maxlength="500" placeholder="Why you love this…" style="width:100%;box-sizing:border-box;border:1px solid #E2E2E2;padding:10px 12px;font-size:13px;margin-bottom:18px;resize:vertical;font-family:inherit;"></textarea>' +
      '<div id="cchCiErr" style="display:none;font-size:12px;color:#B45309;margin:-8px 0 12px;"></div>' +
      '<div style="display:flex;gap:10px;justify-content:flex-end;">' +
      '<button type="button" id="cchCiCancel" style="padding:10px 16px;border:1px solid #E2E2E2;background:#fff;color:#0A1F3D;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;font-family:inherit;">Cancel</button>' +
      '<button type="button" id="cchCiSend" style="padding:10px 18px;border:1px solid #0A1F3D;background:#0A1F3D;color:#fff;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;cursor:pointer;font-family:inherit;">Share</button>' +
      '</div></div>';
    document.body.appendChild(wrap);

    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeModal(); });
    document.getElementById('cchCiCancel').onclick = closeModal;

    document.getElementById('cchCiSend').onclick = async function () {
      var errEl = document.getElementById('cchCiErr');
      var btn = document.getElementById('cchCiSend');
      var fileInp = document.getElementById('cchCiFile');
      var urlInp = document.getElementById('cchCiUrl');
      var capInp = document.getElementById('cchCiCaption');
      errEl.style.display = 'none';
      var file = fileInp && fileInp.files && fileInp.files[0];
      var url = String((urlInp && urlInp.value) || '').trim();
      var caption = String((capInp && capInp.value) || '').trim();
      if (!file && !url) {
        errEl.textContent = 'Choose a photo or paste an image URL.';
        errEl.style.display = 'block';
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Sharing…';
      try {
        var payload = {
          projectId: projectId,
          caption: caption,
          clientName: String(ident.name || ident.clientName || 'Client').trim(),
          clientEmail: String(ident.email || '').trim().toLowerCase()
        };
        if (file) {
          var packed = await fileToBase64(file);
          payload.imageBase64 = packed.base64;
          payload.mimeType = packed.mime;
        } else {
          payload.imageUrl = url;
        }
        var result = await submitIdea(projectId, payload);
        closeModal();
        showAck('Thanks — Cindy will see this.');
        var dest = '#/clientview/' + projectId + '/inspirations/' + (result.sectionId || SECTION_ID);
        if (typeof navigate === 'function') navigate(dest);
        else if (typeof window.renderClientPortal === 'function') window.renderClientPortal(projectId, null, 'inspirationBoard');
        else location.hash = dest;
      } catch (e) {
        errEl.textContent = (e && e.message) || 'Something went wrong. Please try again.';
        errEl.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Share';
      }
    };
  };

  /** Soft-hide own client idea from portal (sets hiddenFromClient). */
  window.cchClientIdeasRemoveOwn = async function (projectId, imageIndex) {
    projectId = String(projectId || '').trim();
    var idx = parseInt(imageIndex, 10);
    if (!projectId || isNaN(idx) || idx < 0) return;
    var ident = typeof cpPortalEffectiveClientIdentity === 'function' ? cpPortalEffectiveClientIdentity() : null;
    var email = ident && String(ident.email || '').trim().toLowerCase();
    if (!email) return;
    var database = typeof db !== 'undefined' ? db : (window.db || null);
    if (!database) return;
    try {
      var ref = database.collection('boards').doc(projectId).collection('ideabooks').doc(SECTION_ID);
      var snap = await ref.get();
      if (!snap.exists) return;
      var images = Array.isArray(snap.data().images) ? snap.data().images.slice() : [];
      var row = images[idx];
      if (!row || typeof row !== 'object' || !row.fromClient) return;
      if (String(row.clientEmail || '').toLowerCase() !== email) return;
      images[idx] = Object.assign({}, row, { hiddenFromClient: true, hiddenAt: new Date().toISOString() });
      await ref.update({ images: images, updatedAt: new Date().toISOString() });
      showAck('Removed from your Client Ideas view.');
      if (typeof window.renderClientPortal === 'function') {
        window.renderClientPortal(projectId, null, 'inspirationBoard');
      }
    } catch (e) {
      console.warn('[CCH ClientIdeas] remove', e);
      showAck('Could not remove that image right now.');
    }
  };

  window.cchClientIdeasIsClientIdeasBoard = function (ib) {
    if (!ib) return false;
    if (String(ib.id || '') === SECTION_ID) return true;
    return String(ib.boardKind || '').toLowerCase() === 'clientideas';
  };

  window.cchClientIdeasImageHidden = function (row) {
    if (!row || typeof row === 'string') return false;
    return row.hiddenFromClient === true || row.hidden === true || row.removed === true;
  };
})();
