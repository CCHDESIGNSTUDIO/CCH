/**
 * Contractor project access (Phase 1) — money-free collaborator view.
 * Distinct from TEAM_CONFIG.contractors (internal labor). Docs: WO-CONTRACTOR-ACCESS_CW_Aug11_v1.0.md
 *
 * Route: client.html#/contractorview/{projectId}/{token}
 * Record: boards/{projectId}/contractorAccess/{token}
 * Files + decisions: sharedWithContractors === true (default off). Money-free view only.
 */
(function (global) {
  'use strict';

  var COL = 'contractorAccess';

  function _db() {
    return global.db || (global.firebase && global.firebase.firestore && global.firebase.firestore());
  }

  function _esc(s) {
    if (typeof global.esc === 'function') return global.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _escAttr(s) {
    if (typeof global.escAttr === 'function') return global.escAttr(s);
    return _esc(s).replace(/'/g, '&#39;');
  }

  function _toast(msg) {
    if (typeof global.showToast === 'function') global.showToast(msg);
  }

  function _actor() {
    var u = global.currentUser;
    if (u && u.email) return String(u.email);
    return 'staff';
  }

  function generateContractorToken() {
    try {
      if (global.crypto && typeof global.crypto.randomUUID === 'function') {
        return global.crypto.randomUUID().replace(/-/g, '');
      }
    } catch (_e) {}
    var s = '';
    for (var i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  }

  function contractorPortalUrl(projectId, token) {
    var origin = (global.location && global.location.origin) ? global.location.origin : '';
    return origin + '/client.html#/contractorview/' + encodeURIComponent(String(projectId || '')) + '/' + encodeURIComponent(String(token || ''));
  }

  async function listContractorAccess(projectId) {
    var db = _db();
    var out = [];
    if (!db || !projectId) return out;
    var snap = await db.collection('boards').doc(projectId).collection(COL).get();
    snap.forEach(function (d) {
      out.push(Object.assign({ id: d.id, token: d.id }, d.data() || {}));
    });
    out.sort(function (a, b) {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    return out;
  }

  async function inviteContractor(projectId, name, email) {
    var db = _db();
    name = String(name || '').trim();
    email = String(email || '').trim();
    if (!db || !projectId) throw new Error('Missing project');
    if (!name) throw new Error('Name is required');
    var token = generateContractorToken();
    var rec = {
      name: name,
      email: email,
      grants: ['files', 'decisions'],
      createdAt: new Date().toISOString(),
      createdBy: _actor(),
      revoked: false,
      lastSeenAt: null
    };
    await db.collection('boards').doc(projectId).collection(COL).doc(token).set(rec);
    return { token: token, url: contractorPortalUrl(projectId, token), record: rec };
  }

  async function revokeContractor(projectId, token) {
    var db = _db();
    if (!db || !projectId || !token) return;
    await db.collection('boards').doc(projectId).collection(COL).doc(token).set({
      revoked: true,
      revokedAt: new Date().toISOString(),
      revokedBy: _actor()
    }, { merge: true });
  }

  async function setFileSharedWithContractors(projectId, fileId, shared) {
    var db = _db();
    if (!db || !projectId || !fileId) return;
    await db.collection('boards').doc(projectId).collection('files').doc(fileId).set({
      sharedWithContractors: !!shared,
      sharedWithContractorsAt: new Date().toISOString(),
      sharedWithContractorsBy: _actor()
    }, { merge: true });
  }

  async function setDecisionSharedWithContractors(projectId, decisionId, shared) {
    var db = _db();
    if (!db || !projectId || !decisionId) return;
    await db.collection('boards').doc(projectId).collection('clientDecisions').doc(decisionId).set({
      sharedWithContractors: !!shared,
      sharedWithContractorsAt: new Date().toISOString(),
      sharedWithContractorsBy: _actor()
    }, { merge: true });
  }

  function fileIsSharedWithContractors(f) {
    if (!f) return false;
    if (f.sharedWithContractors === true) return true;
    var c = String(f.category == null ? '' : f.category).trim().toLowerCase();
    return c === 'shared with contractors' || c === 'shared with contractor';
  }

  function decisionIsSharedWithContractors(d) {
    return !!(d && d.sharedWithContractors === true);
  }

  function decisionStatusLabel(d) {
    var st = String((d && d.status) || 'open').toLowerCase();
    if (st === 'approved') return 'Approved';
    if (st === 'changes_requested') return 'Changes requested';
    if (st === 'resolved') return 'Closed';
    if (st === 'open') return 'Pending';
    return st ? st.charAt(0).toUpperCase() + st.slice(1).replace(/_/g, ' ') : 'Pending';
  }

  async function touchContractorLastSeen(projectId, token) {
    var db = _db();
    if (!db || !projectId || !token) return;
    try {
      await db.collection('boards').doc(projectId).collection(COL).doc(token).set({
        lastSeenAt: new Date().toISOString()
      }, { merge: true });
    } catch (_e) { /* rules may block; non-fatal */ }
  }

  function _closeContractorModal() {
    var el = document.getElementById('cchContractorAccessModal');
    if (el) el.remove();
    if (typeof global.closeModal === 'function') {
      try { global.closeModal(); } catch (_e) {}
    }
  }

  function _modalShell(title, bodyHtml, footerHtml) {
    return (
      '<div id="cchContractorAccessModal" class="modal-overlay" style="position:fixed;inset:0;background:rgba(10,31,61,0.45);z-index:100000;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)window.cchCloseContractorAccessModal&&window.cchCloseContractorAccessModal()">' +
      '<div class="modal" style="width:min(560px,94vw);max-height:90vh;overflow:auto;background:#fff;border-radius:0;border:1px solid #E2E2E2;" onclick="event.stopPropagation()">' +
      '<div class="modal-header" style="display:flex;justify-content:space-between;align-items:flex-start;padding:18px 20px 12px;border-bottom:1px solid #E2E2E2;">' +
        '<div>' +
          '<div style="font-family:\'Playfair Display\',Georgia,serif;font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#C9A96E;margin-bottom:4px;">CCH Studio</div>' +
          '<div class="modal-title" style="margin:0;font-size:18px;color:#0A1F3D;">' + _esc(title) + '</div>' +
        '</div>' +
        '<button type="button" class="modal-close" style="border:none;background:transparent;font-size:22px;cursor:pointer;color:#0A1F3D;line-height:1;" onclick="window.cchCloseContractorAccessModal&&window.cchCloseContractorAccessModal()">&times;</button>' +
      '</div>' +
      '<div class="modal-body" style="padding:16px 20px;">' + bodyHtml + '</div>' +
      (footerHtml ? '<div class="modal-footer" style="padding:12px 20px 18px;display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;border-top:1px solid #E2E2E2;">' + footerHtml + '</div>' : '') +
      '</div></div>'
    );
  }

  function _refreshContractorUi(projectId) {
    projectId = String(projectId || '').trim();
    var hash = String((global.location && global.location.hash) || '');
    if (hash.indexOf('/project/' + projectId + '/contractors') >= 0 && typeof global.renderProjectDetail === 'function') {
      global.renderProjectDetail();
      return;
    }
    if (typeof global.currentProjectTab !== 'undefined' && global.currentProjectTab === 'contractors' &&
        typeof global.renderProjectDetail === 'function') {
      global.renderProjectDetail();
    }
  }

  /**
   * Staff project tab — who has access, last seen, what's shared, invite/revoke.
   */
  async function renderContractorAccessTab(container, proj) {
    if (!container || !proj || !proj.id) return;
    var projectId = String(proj.id);
    container.innerHTML = '<div style="padding:40px;text-align:center;color:#6B7280;font-size:13px;">Loading contractors…</div>';

    var list = [];
    var sharedFiles = 0;
    var sharedDecisions = 0;
    try {
      list = await listContractorAccess(projectId);
    } catch (_e) {}
    try {
      var fs = await _db().collection('boards').doc(projectId).collection('files')
        .where('sharedWithContractors', '==', true).get();
      sharedFiles = fs.size;
    } catch (_eF) {
      try {
        var fall = await _db().collection('boards').doc(projectId).collection('files').get();
        fall.forEach(function (d) {
          if (fileIsSharedWithContractors(Object.assign({ id: d.id }, d.data() || {}))) sharedFiles++;
        });
      } catch (_eF2) {}
    }
    try {
      var ds = await _db().collection('boards').doc(projectId).collection('clientDecisions')
        .where('sharedWithContractors', '==', true).get();
      sharedDecisions = ds.size;
    } catch (_eD) {
      try {
        var dall = await _db().collection('boards').doc(projectId).collection('clientDecisions').get();
        dall.forEach(function (d) {
          if (decisionIsSharedWithContractors(Object.assign({ id: d.id }, d.data() || {}))) sharedDecisions++;
        });
      } catch (_eD2) {}
    }

    var active = list.filter(function (r) { return !r.revoked; });
    var revoked = list.filter(function (r) { return !!r.revoked; });

    var rowsHtml;
    if (!active.length) {
      rowsHtml = '<div style="padding:28px 20px;text-align:center;border:1px solid rgba(15,26,46,0.08);background:#FFFFFF;color:var(--gray-400);font-size:13px;line-height:1.5;">No active contractor links yet.<br>Invite below — they only see files and decisions you explicitly share.</div>';
    } else {
      rowsHtml = '<div style="display:grid;gap:1px;background:rgba(15,26,46,0.06);border:1px solid rgba(15,26,46,0.08);">' +
        active.map(function (r) {
          var seen = r.lastSeenAt ? new Date(r.lastSeenAt).toLocaleString() : 'Never opened';
          var created = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
          var url = contractorPortalUrl(projectId, r.token || r.id);
          var tok = r.token || r.id;
          return (
            '<div style="background:#FFFFFF;padding:16px 18px;display:grid;grid-template-columns:1fr auto;gap:14px;align-items:start;">' +
              '<div style="min-width:0;">' +
                '<div style="font-size:15px;font-weight:600;color:#0F1A2E;">' + _esc(r.name || 'Contractor') + '</div>' +
                (r.email ? '<div style="font-size:12px;color:var(--gray-400);margin-top:3px;">' + _esc(r.email) + '</div>' : '') +
                '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;font-size:11px;color:var(--gray-400);">' +
                  '<span>Invited ' + _esc(created) + (r.createdBy ? ' · ' + _esc(r.createdBy) : '') + '</span>' +
                  '<span style="color:' + (r.lastSeenAt ? '#0F1A2E' : '#9CA3AF') + ';font-weight:600;">Last seen: ' + _esc(seen) + '</span>' +
                '</div>' +
                '<input type="text" readonly value="' + _escAttr(url) + '" style="width:100%;max-width:520px;margin-top:10px;font-size:10px;font-family:ui-monospace,Consolas,monospace;padding:6px 8px;border:1px solid rgba(15,26,46,0.1);border-radius:0;background:#F8FAFC;box-sizing:border-box;" onclick="this.select()">' +
              '</div>' +
              '<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">' +
                '<button type="button" class="btn btn-secondary btn-sm" onclick="window.cchCopyContractorLink(\'' + _escAttr(projectId) + '\',\'' + _escAttr(tok) + '\')">Copy link</button>' +
                '<button type="button" class="btn btn-secondary btn-sm" style="color:#B45309;" onclick="window.cchRevokeContractor(\'' + _escAttr(projectId) + '\',\'' + _escAttr(tok) + '\')">Revoke</button>' +
              '</div>' +
            '</div>'
          );
        }).join('') +
      '</div>';
    }

    var revokedHtml = '';
    if (revoked.length) {
      revokedHtml =
        '<div style="margin-top:28px;">' +
          '<div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-400);margin-bottom:10px;">Revoked (' + revoked.length + ')</div>' +
          '<div style="display:grid;gap:8px;">' +
          revoked.map(function (r) {
            var when = r.revokedAt ? new Date(r.revokedAt).toLocaleString() : '';
            return '<div style="padding:10px 14px;border:1px solid rgba(15,26,46,0.06);background:#FAFAFA;font-size:12px;color:var(--gray-400);">' +
              '<strong style="color:#0F1A2E;">' + _esc(r.name || 'Contractor') + '</strong>' +
              (r.email ? ' · ' + _esc(r.email) : '') +
              (when ? ' · revoked ' + _esc(when) : '') +
              '</div>';
          }).join('') +
          '</div></div>';
    }

    container.innerHTML =
      '<div style="max-width:820px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px;flex-wrap:wrap;">' +
          '<div>' +
            '<div style="font-family:var(--font-display);font-size:22px;color:#0F1A2E;">Contractors</div>' +
            '<div style="font-size:12px;color:var(--gray-400);margin-top:4px;line-height:1.45;max-width:520px;">External collaborators with a money-free link. Separate from Studio Subcontractors (labor). They only see items you mark Share with contractors.</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:22px;">' +
          '<div style="padding:14px 16px;border:1px solid rgba(15,26,46,0.08);background:#FFFFFF;">' +
            '<div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-400);">Active links</div>' +
            '<div style="font-size:22px;font-weight:700;color:#0F1A2E;margin-top:4px;">' + active.length + '</div>' +
          '</div>' +
          '<div style="padding:14px 16px;border:1px solid rgba(15,26,46,0.08);background:#FFFFFF;">' +
            '<div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-400);">Shared files</div>' +
            '<div style="font-size:22px;font-weight:700;color:#0F1A2E;margin-top:4px;">' + sharedFiles + '</div>' +
          '</div>' +
          '<div style="padding:14px 16px;border:1px solid rgba(15,26,46,0.08);background:#FFFFFF;">' +
            '<div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:var(--gray-400);">Shared decisions</div>' +
            '<div style="font-size:22px;font-weight:700;color:#0F1A2E;margin-top:4px;">' + sharedDecisions + '</div>' +
          '</div>' +
        '</div>' +
        '<div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#0F1A2E;margin-bottom:10px;">Who has access</div>' +
        rowsHtml +
        '<div style="margin-top:28px;padding:18px 20px;border:1px solid rgba(15,26,46,0.08);background:#FFFFFF;">' +
          '<div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#0F1A2E;margin-bottom:10px;">Invite contractor</div>' +
          '<p style="font-size:12px;color:var(--gray-400);margin:0 0 14px;line-height:1.45;">Creates a capability URL (no login). Track opens via Last seen.</p>' +
          '<label style="display:block;font-size:11px;font-weight:600;color:#0F1A2E;margin-bottom:4px;">Name</label>' +
          '<input id="cchContractorInviteName" class="form-input" style="width:100%;max-width:360px;border-radius:0;margin-bottom:10px;" placeholder="e.g. Acme Millwork">' +
          '<label style="display:block;font-size:11px;font-weight:600;color:#0F1A2E;margin-bottom:4px;">Email (optional)</label>' +
          '<input id="cchContractorInviteEmail" class="form-input" type="email" style="width:100%;max-width:360px;border-radius:0;margin-bottom:14px;" placeholder="optional">' +
          '<button type="button" class="btn btn-primary btn-sm" onclick="window.cchSubmitContractorInvite(\'' + _escAttr(projectId) + '\')">Create link</button>' +
        '</div>' +
        revokedHtml +
      '</div>';
  }

  async function openContractorAccessPanel(projectId) {
    projectId = String(projectId || '').trim();
    if (!projectId) return;
    // Prefer the project Contractors tab when we're already in this project shell
    try {
      if (typeof global.switchProjectTab === 'function' &&
          typeof global.currentProjectId !== 'undefined' &&
          String(global.currentProjectId) === projectId) {
        global.switchProjectTab('contractors');
        return;
      }
      if (typeof global.navigate === 'function') {
        global.navigate('#/project/' + projectId + '/contractors');
        return;
      }
    } catch (_eNav) {}
    // Fallback modal (e.g. unexpected context)
    var host = document.getElementById('modalContainer') || document.body;
    host.insertAdjacentHTML('beforeend', _modalShell('Contractors', '<div style="font-size:13px;color:#6B7280;">Loading…</div>', ''));

    var list = [];
    try {
      list = await listContractorAccess(projectId);
    } catch (e) {
      _toast('Could not load contractors');
    }

    var active = list.filter(function (r) { return !r.revoked; });
    var revoked = list.filter(function (r) { return !!r.revoked; });

    var rows = '';
    if (!active.length) {
      rows = '<div style="font-size:13px;color:#6B7280;padding:8px 0;">No active contractor links. Invite someone below — they only see files you mark Share with contractors.</div>';
    } else {
      rows = active.map(function (r) {
        var seen = r.lastSeenAt ? new Date(r.lastSeenAt).toLocaleString() : 'Never';
        var url = contractorPortalUrl(projectId, r.token || r.id);
        return (
          '<div style="border:1px solid #E2E2E2;padding:12px 14px;margin-bottom:8px;background:#FAFAFA;">' +
            '<div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">' +
              '<div style="min-width:0;">' +
                '<div style="font-size:14px;font-weight:600;color:#0A1F3D;">' + _esc(r.name || 'Contractor') + '</div>' +
                (r.email ? '<div style="font-size:11px;color:#6B7280;margin-top:2px;">' + _esc(r.email) + '</div>' : '') +
                '<div style="font-size:10px;color:#9CA3AF;margin-top:6px;">Last seen: ' + _esc(seen) + '</div>' +
              '</div>' +
              '<div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0;">' +
                '<button type="button" class="btn btn-secondary btn-sm" style="border-radius:0;" onclick="window.cchCopyContractorLink(\'' + _escAttr(projectId) + '\',\'' + _escAttr(r.token || r.id) + '\')">Copy link</button>' +
                '<button type="button" class="btn btn-secondary btn-sm" style="border-radius:0;color:#B45309;" onclick="window.cchRevokeContractor(\'' + _escAttr(projectId) + '\',\'' + _escAttr(r.token || r.id) + '\')">Revoke</button>' +
              '</div>' +
            '</div>' +
            '<input type="text" readonly value="' + _escAttr(url) + '" style="width:100%;margin-top:10px;font-size:10px;font-family:ui-monospace,Consolas,monospace;padding:6px 8px;border:1px solid #E2E2E2;border-radius:0;background:#fff;" onclick="this.select()">' +
          '</div>'
        );
      }).join('');
    }

    var inviteForm =
      '<div style="margin-top:16px;padding-top:14px;border-top:1px solid #E2E2E2;">' +
        '<div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#0A1F3D;margin-bottom:10px;">Invite contractor</div>' +
        '<p style="font-size:12px;color:#6B7280;margin:0 0 12px;line-height:1.45;">Capability link (no login). Money-free: shared files and decisions only — no proposals, invoices, or costs.</p>' +
        '<label style="display:block;font-size:11px;font-weight:600;color:#0A1F3D;margin-bottom:4px;">Name</label>' +
        '<input id="cchContractorInviteName" class="form-input" style="width:100%;border-radius:0;margin-bottom:10px;" placeholder="e.g. Acme Millwork">' +
        '<label style="display:block;font-size:11px;font-weight:600;color:#0A1F3D;margin-bottom:4px;">Email (optional)</label>' +
        '<input id="cchContractorInviteEmail" class="form-input" type="email" style="width:100%;border-radius:0;margin-bottom:12px;" placeholder="optional">' +
        '<button type="button" class="btn btn-primary btn-sm" style="border-radius:0;" onclick="window.cchSubmitContractorInvite(\'' + _escAttr(projectId) + '\')">Create link</button>' +
      '</div>';

    var revokedNote = revoked.length
      ? '<div style="margin-top:12px;font-size:11px;color:#9CA3AF;">' + revoked.length + ' revoked link(s) kept for audit.</div>'
      : '';

    var modal = document.getElementById('cchContractorAccessModal');
    if (modal) modal.remove();
    host.insertAdjacentHTML('beforeend', _modalShell(
      'Contractors',
      rows + inviteForm + revokedNote,
      '<button type="button" class="btn btn-secondary" style="border-radius:0;" onclick="window.cchCloseContractorAccessModal&&window.cchCloseContractorAccessModal()">Close</button>'
    ));
  }

  async function submitContractorInvite(projectId) {
    var nameEl = document.getElementById('cchContractorInviteName');
    var emailEl = document.getElementById('cchContractorInviteEmail');
    var name = nameEl ? nameEl.value : '';
    var email = emailEl ? emailEl.value : '';
    try {
      var res = await inviteContractor(projectId, name, email);
      _toast('Contractor link created');
      try {
        await navigator.clipboard.writeText(res.url);
        _toast('Link copied');
      } catch (_e) {}
      _closeContractorModal();
      _refreshContractorUi(projectId);
      if (typeof global.cchShowShareLinkModal === 'function') {
        global.cchShowShareLinkModal({
          shareWhat: 'Contractor view · ' + String(name || '').trim(),
          projectLabel: projectId,
          url: res.url,
          note: 'Money-free collaborator link. They only see files and decisions marked Share with contractors. Revoke anytime from Contractors.',
          clientEmail: String(email || '').trim(),
          mailSubject: 'CCH Design · project documents',
          mailBody: 'Hi,\n\nHere is your link to project documents from CCH Design (drawings, specs, and files shared with you):\n\n' + res.url + '\n\nThank you,\nCCH Design'
        });
      }
    } catch (e) {
      _toast((e && e.message) ? e.message : 'Invite failed');
    }
  }

  async function copyContractorLink(projectId, token) {
    var url = contractorPortalUrl(projectId, token);
    try {
      await navigator.clipboard.writeText(url);
      _toast('Contractor link copied');
    } catch (_e) {
      if (typeof global.cchShowShareLinkModal === 'function') {
        global.cchShowShareLinkModal({
          shareWhat: 'Contractor view',
          projectLabel: projectId,
          url: url,
          note: 'Money-free. Revoke from Contractors when finished.'
        });
      } else {
        _toast('Copy failed — select the link in the panel');
      }
    }
  }

  async function revokeContractorUi(projectId, token) {
    var ok = true;
    if (typeof global.cchConfirm === 'function') {
      ok = await global.cchConfirm(
        'Revoke this contractor link? They will lose access immediately. Other contractor links stay active.',
        'Revoke contractor',
        { confirmText: 'Revoke', danger: true }
      );
    }
    if (!ok) return;
    try {
      await revokeContractor(projectId, token);
      _toast('Contractor link revoked');
      _closeContractorModal();
      _refreshContractorUi(projectId);
    } catch (e) {
      _toast('Revoke failed');
    }
  }

  async function toggleFileSharedWithContractors(projectId, fileId, shared) {
    try {
      await setFileSharedWithContractors(projectId, fileId, shared);
      _toast(shared ? 'Shared with contractors' : 'Hidden from contractors');
      if (typeof global.renderProjectDetail === 'function' && global.currentProjectTab === 'files') {
        global.renderProjectDetail();
      }
    } catch (e) {
      _toast('Could not update share flag');
    }
  }

  async function toggleDecisionSharedWithContractors(projectId, decisionId, shared) {
    try {
      await setDecisionSharedWithContractors(projectId, decisionId, shared);
      _toast(shared ? 'Decision shared with contractors' : 'Decision hidden from contractors');
      if (String(global.location && global.location.hash || '').indexOf('/clientview/' + projectId) >= 0 &&
          typeof global.renderClientPortal === 'function') {
        global.renderClientPortal(projectId, null, 'decisions');
      } else if (typeof global.renderProjectDetail === 'function') {
        global.renderProjectDetail();
      }
    } catch (e) {
      _toast('Could not update decision share flag');
    }
  }

  function studioFilePublicUrl(f) {
    if (typeof global.studioProjectFilePublicUrl === 'function') return global.studioProjectFilePublicUrl(f);
    return String((f && (f.downloadUrl || f.url)) || '').trim();
  }

  function decisionAttachmentUrls(d) {
    d = d || {};
    var urls = Array.isArray(d.attachmentUrls) ? d.attachmentUrls.slice() : [];
    if (!urls.length && d.attachmentUrl) urls = [d.attachmentUrl];
    return urls.map(function (u) { return String(u || '').trim(); }).filter(Boolean);
  }

  function fileShelfLabel(f) {
    var c = String((f && f.category) || '').trim();
    if (c === 'Work Orders' || c === 'Work Order') return 'WO Docs';
    if (c === 'Shared with Contractors') return 'Document';
    return c || 'Document';
  }

  function isImageUrl(url, name) {
    var s = String(url || '') + ' ' + String(name || '');
    var low = s.toLowerCase();
    // Firebase Storage / Google image hosts often omit a visible extension in the browser URL.
    if (low.indexOf('firebasestorage') >= 0 || low.indexOf('googleapis.com') >= 0 ||
        low.indexOf('googleusercontent') >= 0 || low.indexOf('lh3.google') >= 0) {
      if (!/\.(pdf|docx?|xlsx?|pptx?|zip|csv|txt)(\?|$)/i.test(low)) return true;
    }
    return /\.(png|jpe?g|webp|gif|bmp|svg)(\?|$)/i.test(s) || /image\//i.test(String((name && name.mimeType) || ''));
  }

  /** Best-effort display name from a storage/download URL (Firebase path or last path segment). */
  function displayNameFromUrl(url, fallback) {
    var u = String(url || '').trim();
    var fb = String(fallback || '').trim() || 'Attachment';
    if (!u) return fb;
    try {
      var path = u;
      var oIdx = path.indexOf('/o/');
      if (oIdx >= 0) {
        path = path.slice(oIdx + 3);
        var q = path.indexOf('?');
        if (q >= 0) path = path.slice(0, q);
        path = decodeURIComponent(path);
      } else {
        try {
          var parsed = new URL(u);
          path = decodeURIComponent(parsed.pathname || '');
        } catch (_eU) {
          var q2 = path.indexOf('?');
          if (q2 >= 0) path = path.slice(0, q2);
        }
      }
      var parts = path.split('/').filter(Boolean);
      var last = parts.length ? parts[parts.length - 1] : '';
      last = String(last || '').replace(/\+/g, ' ').trim();
      if (last && last.length < 120 && last.indexOf('alt=media') < 0) return last;
    } catch (_e) {}
    return fb;
  }

  function fileTypePlaceholderLabel(url, name) {
    var s = (String(url || '') + ' ' + String(name || '')).toLowerCase();
    if (/\.pdf(\?|$)/i.test(s)) return 'PDF';
    if (/\.(docx?|rtf)(\?|$)/i.test(s)) return 'DOC';
    if (/\.(xlsx?|csv)(\?|$)/i.test(s)) return 'SHEET';
    if (/\.(pptx?)(\?|$)/i.test(s)) return 'SLIDES';
    return 'FILE';
  }

  function contractorActionBtn(label, onclick, primary) {
    return '<button type="button" onclick="event.stopPropagation();' + onclick + '" style="padding:8px 14px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border:1px solid ' +
      (primary ? '#0A1F3D' : '#E2E2E2') + ';background:' + (primary ? '#0A1F3D' : '#FFFFFF') + ';color:' +
      (primary ? '#FFFFFF' : '#0A1F3D') + ';cursor:pointer;border-radius:0;font-family:inherit;">' + _esc(label) + '</button>';
  }

  function contractorOpenFile(url) {
    url = String(url || '').trim();
    if (!url) {
      _toast('No file URL available');
      return;
    }
    try { global.open(url, '_blank', 'noopener,noreferrer'); } catch (_e) {}
  }

  function contractorPrintFile(url) {
    url = String(url || '').trim();
    if (!url) {
      _toast('No file URL available');
      return;
    }
    if (typeof global.projFilePrintStudio === 'function') {
      global.projFilePrintStudio(url);
      return;
    }
    var w = global.open(url, '_blank', 'noopener,noreferrer');
    if (!w) {
      _toast('Pop-up blocked — allow pop-ups to print');
      return;
    }
    setTimeout(function () {
      try { w.focus(); w.print(); } catch (_e) {
        _toast('Use Ctrl+P in the new tab to print');
      }
    }, 600);
  }

  function contractorDownloadFile(url, filename) {
    url = String(url || '').trim();
    if (!url) {
      _toast('No file URL available');
      return;
    }
    try {
      var a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      var name = String(filename || '').trim() || 'download';
      try { a.setAttribute('download', name); } catch (_eD) {}
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (_e) {
      contractorOpenFile(url);
    }
  }

  function contractorFileCardHtml(f) {
    var url = studioFilePublicUrl(f);
    var title = String(f.name || 'Document').trim() || 'Document';
    var dateStr = f.createdAt ? new Date(f.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    var shelf = fileShelfLabel(f);
    var urlEsc = _escAttr(url).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var nameEsc = _escAttr(title).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    var thumb;
    if (url && isImageUrl(url, f)) {
      thumb = '<img src="' + _escAttr(url) + '" alt="" loading="lazy" style="width:100%;height:160px;object-fit:cover;display:block;background:#F8FAFC;">';
    } else {
      thumb = '<div style="width:100%;height:160px;display:flex;align-items:center;justify-content:center;background:#F8FAFC;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;">' +
        _esc(shelf === 'Document' ? 'FILE' : shelf) + '</div>';
    }
    var actions = '';
    if (url) {
      actions =
        '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;">' +
          contractorActionBtn('Open', "window.cchContractorOpenFile('" + urlEsc + "')", true) +
          contractorActionBtn('Download', "window.cchContractorDownloadFile('" + urlEsc + "','" + nameEsc + "')", false) +
          contractorActionBtn('Print', "window.cchContractorPrintFile('" + urlEsc + "')", false) +
        '</div>';
    } else {
      actions = '<div style="margin-top:12px;font-size:12px;color:#B45309;">No download link on this file. Ask CCH Design to re-share it.</div>';
    }
    return (
      '<div class="cp-contractor-doc-card" style="background:#FFFFFF;border:1px solid #E2E2E2;display:flex;flex-direction:column;overflow:hidden;">' +
        thumb +
        '<div style="padding:14px 16px;flex:1;display:flex;flex-direction:column;">' +
          '<div style="font-size:14px;font-weight:600;color:#0A1F3D;line-height:1.35;">' + _esc(title) + '</div>' +
          '<div style="font-size:11px;color:#6B7280;margin-top:6px;">' + _esc(shelf) + (dateStr ? ' · ' + _esc(dateStr) : '') + '</div>' +
          actions +
        '</div>' +
      '</div>'
    );
  }

  function contractorDecisionCardHtml(d) {
    var title = String(d.title || 'Decision').trim() || 'Decision';
    var status = decisionStatusLabel(d);
    var prompt = String(d.prompt || '').trim();
    var detail = String(d.detail || '').trim();
    var cat = String(d.category || '').trim();
    var opts = Array.isArray(d.options) ? d.options.filter(Boolean) : [];
    var choice = d.clientResponse && d.clientResponse.choice ? String(d.clientResponse.choice).trim() : '';
    var urls = decisionAttachmentUrls(d);
    var statusColor = status === 'Approved' ? '#2E7D32' : (status === 'Pending' ? '#0A1F3D' : '#6B7280');
    var attachActions = '';
    if (urls.length) {
      var attachType = String(d.attachmentType || '').toLowerCase();
      attachActions = '<div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:14px;align-items:flex-start;">' +
        urls.map(function (u, i) {
          var urlEsc = _escAttr(u).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          var fallback = urls.length > 1 ? (title + ' · ' + (i + 1)) : title;
          var label = displayNameFromUrl(u, fallback);
          var nameEsc = _escAttr(label).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
          var treatAsImage = attachType === 'image' || isImageUrl(u, label);
          var thumb;
          if (treatAsImage) {
            thumb = '<img src="' + _escAttr(u) + '" alt="" loading="lazy" referrerpolicy="no-referrer" ' +
              'style="width:100%;height:140px;object-fit:cover;display:block;background:#F8FAFC;" ' +
              'onerror="this.onerror=null;this.style.display=\'none\';var p=this.nextElementSibling;if(p)p.style.display=\'flex\';">' +
              '<div style="display:none;width:100%;height:140px;align-items:center;justify-content:center;background:#F8FAFC;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;">' +
              _esc(fileTypePlaceholderLabel(u, label)) + '</div>';
          } else {
            thumb = '<div style="width:100%;height:140px;display:flex;align-items:center;justify-content:center;background:#F8FAFC;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#9CA3AF;">' +
              _esc(fileTypePlaceholderLabel(u, label)) + '</div>';
          }
          return (
            '<div style="flex:1 1 180px;max-width:240px;border:1px solid #E2E2E2;background:#FFFFFF;overflow:hidden;">' +
              thumb +
              '<div style="padding:10px 12px;">' +
                '<div style="font-size:12px;font-weight:600;color:#0A1F3D;line-height:1.35;word-break:break-word;">' + _esc(label) + '</div>' +
                '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;">' +
                  contractorActionBtn('Open', "window.cchContractorOpenFile('" + urlEsc + "')", true) +
                  contractorActionBtn('Download', "window.cchContractorDownloadFile('" + urlEsc + "','" + nameEsc + "')", false) +
                  contractorActionBtn('Print', "window.cchContractorPrintFile('" + urlEsc + "')", false) +
                '</div>' +
              '</div>' +
            '</div>'
          );
        }).join('') +
      '</div>';
    }
    var html =
      '<div style="border:1px solid #E2E2E2;background:#FFFFFF;padding:16px 18px;margin-bottom:10px;">' +
        '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">' +
          '<div style="font-size:15px;font-weight:600;color:#0A1F3D;line-height:1.35;">' + _esc(title) + '</div>' +
          '<div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:' + statusColor + ';flex-shrink:0;padding:4px 8px;border:1px solid #E2E2E2;">' + _esc(status) + '</div>' +
        '</div>' +
        (cat ? '<div style="font-size:11px;color:#9CA3AF;margin-top:6px;">' + _esc(cat) + '</div>' : '') +
        (prompt ? '<div style="font-size:13px;color:#0A1F3D;margin-top:10px;line-height:1.5;">' + _esc(prompt) + '</div>' : '') +
        (detail ? '<div style="font-size:12px;color:#6B7280;margin-top:8px;line-height:1.5;">' + _esc(detail) + '</div>' : '') +
        (opts.length
          ? '<ul style="margin:10px 0 0;padding-left:18px;font-size:12px;color:#0A1F3D;line-height:1.5;">' +
            opts.map(function (o) { return '<li>' + _esc(o) + '</li>'; }).join('') + '</ul>'
          : '') +
        (choice ? '<div style="font-size:12px;color:#0A1F3D;margin-top:10px;"><strong>Client choice:</strong> ' + _esc(choice) + '</div>' : '') +
        attachActions +
      '</div>';
    return html;
  }

  /**
   * Money-free contractor portal — shared files + decisions. Never proposals/invoices/POs/cost/time.
   */
  async function renderContractorView(projectId, token) {
    var T = document.getElementById('contentArea');
    if (!T) return;
    projectId = String(projectId || '').trim();
    token = String(token || '').trim();
    T.innerHTML = '<div style="max-width:720px;margin:80px auto;text-align:center;font-family:\'DM Sans\',sans-serif;color:#6B7280;font-size:13px;">Loading…</div>';

    var db = _db();
    if (!db || !projectId || !token) {
      T.innerHTML = _contractorEmpty('This contractor link looks incomplete. Please use the link from CCH Design.');
      return;
    }

    var access = null;
    try {
      var aSnap = await db.collection('boards').doc(projectId).collection(COL).doc(token).get();
      if (aSnap.exists) access = Object.assign({ id: aSnap.id }, aSnap.data() || {});
    } catch (e) {
      T.innerHTML = _contractorEmpty('Unable to verify this link. Please contact CCH Design.');
      return;
    }

    if (!access || access.revoked === true) {
      T.innerHTML = _contractorEmpty('This contractor link is no longer active. Please contact CCH Design for a new link.');
      return;
    }

    touchContractorLastSeen(projectId, token);

    var projName = 'Project';
    try {
      var pSnap = await db.collection('boards').doc(projectId).get();
      if (pSnap.exists) {
        var pd = pSnap.data() || {};
        projName = String(pd.name || pd.projectName || 'Project').trim() || 'Project';
      }
    } catch (_e) {}

    var files = [];
    try {
      var q = await db.collection('boards').doc(projectId).collection('files')
        .where('sharedWithContractors', '==', true).get();
      q.forEach(function (d) { files.push(Object.assign({ id: d.id }, d.data() || {})); });
    } catch (_eQ) {
      try {
        var all = await db.collection('boards').doc(projectId).collection('files').get();
        all.forEach(function (d) {
          var row = Object.assign({ id: d.id }, d.data() || {});
          if (fileIsSharedWithContractors(row)) files.push(row);
        });
      } catch (_e2) {}
    }

    files.sort(function (a, b) {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });

    var decisions = [];
    try {
      var dq = await db.collection('boards').doc(projectId).collection('clientDecisions')
        .where('sharedWithContractors', '==', true).get();
      dq.forEach(function (d) { decisions.push(Object.assign({ id: d.id }, d.data() || {})); });
    } catch (_eD) {
      try {
        var dall = await db.collection('boards').doc(projectId).collection('clientDecisions').get();
        dall.forEach(function (d) {
          var row = Object.assign({ id: d.id }, d.data() || {});
          if (decisionIsSharedWithContractors(row)) decisions.push(row);
        });
      } catch (_eD2) {}
    }
    decisions.sort(function (a, b) {
      return String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
    });

    var nameLabel = String(access.name || 'Collaborator').trim();
    var listHtml;
    if (!files.length) {
      listHtml = '<div style="padding:28px 20px;text-align:center;border:1px solid #E2E2E2;background:#FFFFFF;color:#6B7280;font-size:13px;line-height:1.5;">No documents have been shared yet.</div>';
    } else {
      listHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;">' +
        files.map(contractorFileCardHtml).join('') +
      '</div>';
    }

    var decisionsHtml;
    if (!decisions.length) {
      decisionsHtml = '<div style="padding:20px;text-align:center;border:1px solid #E2E2E2;background:#FFFFFF;color:#6B7280;font-size:13px;line-height:1.5;">No decisions shared yet.</div>';
    } else {
      decisionsHtml = decisions.map(contractorDecisionCardHtml).join('');
    }

    T.innerHTML =
      '<div class="cp-contractor-view" style="max-width:920px;margin:0 auto;padding:32px 20px 64px;font-family:\'DM Sans\',sans-serif;background:#FFFFFF;min-height:100vh;box-sizing:border-box;">' +
        '<div style="font-family:\'Playfair Display\',Georgia,serif;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#0A1F3D;margin-bottom:8px;">CCH Design</div>' +
        '<h1 style="font-family:\'Playfair Display\',Georgia,serif;font-size:28px;font-weight:500;color:#0A1F3D;margin:0 0 6px;line-height:1.2;">' + _esc(projName) + '</h1>' +
        '<p style="font-size:13px;color:#6B7280;margin:0 0 28px;line-height:1.5;">Shared documents and decisions for ' + _esc(nameLabel) + '. Open, download, or print — no pricing or invoices on this page.</p>' +
        '<div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#0A1F3D;margin-bottom:12px;">Documents</div>' +
        listHtml +
        '<div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#0A1F3D;margin:28px 0 12px;">Decisions</div>' +
        decisionsHtml +
      '</div>';
  }

  function _contractorEmpty(msg) {
    return (
      '<div style="max-width:420px;margin:120px auto;text-align:center;font-family:\'DM Sans\',sans-serif;color:#0A1F3D;padding:0 16px;">' +
        '<div style="font-family:\'Playfair Display\',Georgia,serif;font-size:26px;letter-spacing:2px;">CCH DESIGN</div>' +
        '<div style="margin-top:14px;font-size:13px;color:#6B7280;line-height:1.6;">' + _esc(msg) + '</div>' +
      '</div>'
    );
  }

  global.cchCloseContractorAccessModal = _closeContractorModal;
  global.cchOpenContractorAccessPanel = openContractorAccessPanel;
  global.cchSubmitContractorInvite = submitContractorInvite;
  global.cchCopyContractorLink = copyContractorLink;
  global.cchRevokeContractor = revokeContractorUi;
  global.cchToggleFileSharedWithContractors = toggleFileSharedWithContractors;
  global.cchToggleDecisionSharedWithContractors = toggleDecisionSharedWithContractors;
  global.cchFileIsSharedWithContractors = fileIsSharedWithContractors;
  global.cchDecisionIsSharedWithContractors = decisionIsSharedWithContractors;
  global.cchRenderContractorView = renderContractorView;
  global.cchRenderContractorAccessTab = renderContractorAccessTab;
  global.cchContractorPortalUrl = contractorPortalUrl;
  global.cchContractorOpenFile = contractorOpenFile;
  global.cchContractorPrintFile = contractorPrintFile;
  global.cchContractorDownloadFile = contractorDownloadFile;
  global.inviteContractor = inviteContractor;
  global.revokeContractor = revokeContractor;
  global.setFileSharedWithContractors = setFileSharedWithContractors;
  global.setDecisionSharedWithContractors = setDecisionSharedWithContractors;
})(typeof window !== 'undefined' ? window : this);
