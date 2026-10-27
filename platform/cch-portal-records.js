/**
 * WO-299 decision checklist, WO-302 meeting notes, WO-303 client chat.
 * Portal + staff. Does not touch proposal / invoice / PO / tear-sheet print CSS.
 */
(function () {
  'use strict';

  function db() {
    if (typeof window.db !== 'undefined' && window.db && window.db.collection) return window.db;
    if (typeof firebase !== 'undefined' && firebase.firestore) return firebase.firestore();
    return null;
  }
  function staff() {
    return typeof isCCHStudioStaffSession === 'function' && isCCHStudioStaffSession();
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function today() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }
  function who() {
    try {
      var u = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser : null;
      if (u && u.email) return u.email;
    } catch (_e) {}
    if (typeof cpPortalEffectiveClientIdentity === 'function') {
      var id = cpPortalEffectiveClientIdentity() || {};
      return String(id.name || id.email || 'Client');
    }
    return 'Client';
  }
  function toast(msg) {
    if (typeof showToast === 'function') showToast(msg);
  }
  function alertBox(msg, title) {
    if (typeof cchAlert === 'function') return cchAlert(msg, title || 'CCH');
    toast(String(msg || ''));
  }
  function col(projectId, name) {
    return db().collection('boards').doc(projectId).collection(name);
  }

  function mount(projectId, page) {
    return '<div id="cch-portal-records" data-project="' + esc(projectId) + '" data-page="' + esc(page) + '"></div>';
  }
  window.cchPortalRecordsMount = mount;

  window.cchPortalRecordsBoot = function (projectId) {
    var root = document.getElementById('cch-portal-records');
    if (root) {
      var page = root.getAttribute('data-page');
      var pid = root.getAttribute('data-project') || projectId;
      if (page === 'meetings') renderMeetings(root, pid);
      else if (page === 'checklist') renderChecklist(root, pid);
      else if (page === 'chat') renderChat(root, pid, false);
    }
    if (projectId) mountChatBubble(projectId);
  };

  /* ---------- checklist ---------- */
  function sortChecklist(rows, mode) {
    rows = rows.slice();
    rows.sort(function (a, b) {
      if (mode === 'room') {
        var ra = String(a.room || '—').toLowerCase();
        var rb = String(b.room || '—').toLowerCase();
        if (ra !== rb) return ra < rb ? -1 : 1;
      }
      return String(b.decidedOn || b.createdAt || '').localeCompare(String(a.decidedOn || a.createdAt || ''));
    });
    return rows;
  }

  async function clientRoomBoardNames(projectId) {
    var names = [];
    function push(raw) {
      var r = String(raw || '').trim();
      if (!r) return;
      var k = r.toLowerCase();
      for (var i = 0; i < names.length; i++) {
        if (names[i].toLowerCase() === k) return;
      }
      names.push(r);
    }
    try {
      var clipSnap = await col(projectId, 'clips').get();
      var metaSnap = await col(projectId, 'roomMeta').get();
      var roomMeta = {};
      metaSnap.forEach(function (d) {
        var rm = d.data() || {};
        if (rm.name) roomMeta[rm.name] = rm;
      });
      clipSnap.forEach(function (d) {
        var c = Object.assign({ id: d.id }, d.data() || {});
        if (typeof isRealProduct === 'function' && !isRealProduct(c)) return;
        if (typeof boardClipIsHidden === 'function' && boardClipIsHidden(c)) return;
        var rm = String(c.room || '').trim();
        if (!rm) return;
        if (typeof cpClientVisibleRoomName === 'function' && !cpClientVisibleRoomName(rm)) return;
        if (typeof roomBoardSectionIsHidden === 'function' && roomBoardSectionIsHidden(roomMeta, rm)) return;
        push(rm);
      });
    } catch (_eRooms) {}
    names.sort(function (a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); });
    return names;
  }

  function roomSelectHtml(rooms) {
    var opts = '<option value="">Room</option>';
    (rooms || []).forEach(function (rm) {
      opts += '<option value="' + esc(rm) + '">' + esc(rm) + '</option>';
    });
    if (!(rooms || []).length) opts += '<option value="" disabled>No rooms on the board yet</option>';
    return '<select name="room" style="flex:1;min-width:140px;padding:8px;border:1px solid #E2E2E2;background:#fff;">' + opts + '</select>';
  }

  async function renderChecklist(root, projectId) {
    root.innerHTML = '<div class="cp-section-label">Checklist</div><div style="font-size:13px;color:#6B7280;">Loading…</div>';
    var loaded = await Promise.all([
      col(projectId, 'decisionChecklist').get(),
      clientRoomBoardNames(projectId)
    ]);
    var snap = loaded[0];
    var roomNames = loaded[1];
    var rows = [];
    snap.forEach(function (doc) { rows.push(Object.assign({ id: doc.id }, doc.data() || {})); });
    var mode = 'new';
    try { mode = localStorage.getItem('cchChecklistSort:' + projectId) || 'new'; } catch (_e) {}
    rows = sortChecklist(rows, mode);
    var isStaff = staff();
    var html = '<div class="cp-section-label">Approved checklist</div>' +
      '<div style="font-size:12px;color:#6B7280;margin:0 0 14px;line-height:1.5;">A short running list. The big decision posts stay on Decisions.</div>' +
      '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
      '<button type="button" class="cp-btn cp-btn-outline" data-sort="new">Newest</button>' +
      '<button type="button" class="cp-btn cp-btn-outline" data-sort="room">By room</button>' +
      (isStaff ? '<button type="button" class="cp-btn cp-btn-outline" data-print="1">Print</button>' : '') +
      '</div>';
    if (isStaff) {
      html += '<form id="cch-cl-add" style="border:1px solid #E2E2E2;padding:12px;margin-bottom:16px;background:#fff;">' +
        '<div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#0A1F3D;margin-bottom:8px;">Quick add</div>' +
        '<input name="what" required placeholder="What was decided" style="width:100%;margin-bottom:8px;padding:8px;border:1px solid #E2E2E2;box-sizing:border-box;">' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
        roomSelectHtml(roomNames) +
        '<input name="decidedOn" type="date" value="' + today() + '" style="padding:8px;border:1px solid #E2E2E2;">' +
        '<select name="how" style="padding:8px;border:1px solid #E2E2E2;">' +
        '<option value="phone">Phone</option><option value="text">Text</option><option value="email">Email</option><option value="site">Site meeting</option><option value="portal">Portal</option>' +
        '</select></div>' +
        '<button type="submit" class="cp-btn cp-btn-primary" style="margin-top:8px;">Add to the checklist</button></form>';
    }
    if (!rows.length) html += '<div style="font-size:13px;color:#6B7280;">Nothing on the checklist yet.</div>';
    rows.forEach(function (r) {
      var replaced = String(r.status || '') === 'replaced';
      html += '<div style="display:flex;gap:12px;padding:10px 0;border-top:1px solid #EEF0F2;' + (replaced ? 'opacity:0.7;' : '') + '">' +
        (r.photoUrl ? '<img src="' + esc(r.photoUrl) + '" alt="" style="width:56px;height:56px;object-fit:cover;border:1px solid #E2E2E2;">' : '') +
        '<div style="flex:1;min-width:0;">' +
        '<div style="font-size:14px;color:#0A1F3D;' + (replaced ? 'text-decoration:line-through;' : '') + '">' + esc(r.what || '') + '</div>' +
        '<div style="font-size:11px;color:#6B7280;margin-top:3px;">' + esc(r.decidedOn || '') +
        (r.room ? ' · ' + esc(r.room) : '') +
        (r.how ? ' · ' + esc(r.how) : '') +
        (r.clientName ? ' · ' + esc(r.clientName) : '') + '</div>' +
        (replaced && r.replacedNote ? '<div style="font-size:12px;color:#6B7280;margin-top:4px;">Replaced: ' + esc(r.replacedNote) + '</div>' : '') +
        '</div>' +
        (isStaff && !replaced ? '<button type="button" class="cp-btn cp-btn-outline" data-replace="' + esc(r.id) + '" style="font-size:11px;">Mark replaced</button>' : '') +
        '</div>';
    });
    root.innerHTML = html;
    root.querySelectorAll('[data-sort]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        try { localStorage.setItem('cchChecklistSort:' + projectId, btn.getAttribute('data-sort')); } catch (_e2) {}
        renderChecklist(root, projectId);
      });
    });
    var form = root.querySelector('#cch-cl-add');
    if (form) form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var fd = new FormData(form);
      col(projectId, 'decisionChecklist').add({
        what: String(fd.get('what') || '').trim(),
        room: String(fd.get('room') || '').trim(),
        decidedOn: String(fd.get('decidedOn') || today()),
        how: String(fd.get('how') || 'phone'),
        clientName: '',
        photoUrl: '',
        sourceDecisionId: '',
        status: 'active',
        createdAt: new Date().toISOString(),
        createdBy: who()
      }).then(function () { toast('Added to the checklist'); renderChecklist(root, projectId); })
        .catch(function (e) { alertBox((e && e.message) || e, 'Checklist'); });
    });
    root.querySelectorAll('[data-replace]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var box = document.createElement('div');
        box.style.cssText = 'margin-top:6px;display:flex;gap:6px;';
        box.innerHTML = '<input placeholder="What replaced it?" style="flex:1;padding:6px;border:1px solid #E2E2E2;">' +
          '<button type="button" class="cp-btn cp-btn-outline">Save</button>';
        btn.replaceWith(box);
        var input = box.querySelector('input');
        box.querySelector('button').addEventListener('click', function () {
          col(projectId, 'decisionChecklist').doc(btn.getAttribute('data-replace')).update({
            status: 'replaced',
            replacedNote: String(input.value || '').trim(),
            replacedAt: new Date().toISOString()
          }).then(function () { renderChecklist(root, projectId); })
            .catch(function (e) { alertBox((e && e.message) || e, 'Checklist'); });
        });
      });
    });
    var printBtn = root.querySelector('[data-print]');
    if (printBtn) printBtn.addEventListener('click', function () { printChecklist(projectId, rows); });
  }

  function printChecklist(projectId, rows) {
    var body = rows.map(function (r) {
      var style = String(r.status || '') === 'replaced' ? 'text-decoration:line-through;color:#6B7280;' : '';
      return '<p style="' + style + 'margin:0 0 10px;"><strong>' + esc(r.decidedOn || '') + '</strong> ' +
        esc(r.room ? r.room + ' — ' : '') + esc(r.what || '') +
        (r.replacedNote ? ' <em>(' + esc(r.replacedNote) + ')</em>' : '') + '</p>';
    }).join('');
    var w = window.open('', '_blank');
    if (!w) return;
    w.document.write('<!DOCTYPE html><html><head><title>Approved checklist</title></head><body style="font-family:Georgia,serif;color:#0A1F3D;max-width:720px;margin:40px auto;padding:0 24px;">' +
      '<div style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#C8A97E;">CCH Design</div>' +
      '<h1 style="font-weight:normal;font-size:28px;margin:8px 0 24px;">Approved checklist</h1>' + body + '</body></html>');
    w.document.close();
    w.focus();
    w.print();
  }

  window.cchAddPostedDecisionToChecklist = async function (projectId, decisionId) {
    if (!staff()) return;
    var database = db();
    if (!database) return;
    var snap = await database.collection('boards').doc(projectId).collection('clientDecisions').doc(decisionId).get();
    if (!snap.exists) { alertBox('That decision post was not found.', 'Checklist'); return; }
    var d = snap.data() || {};
    var cr = d.clientResponse || {};
    var photo = '';
    if (Array.isArray(d.attachmentUrls) && d.attachmentUrls.length) photo = d.attachmentUrls[0];
    else photo = d.attachmentUrl || '';
    var when = String(cr.respondedAt || d.updatedAt || new Date().toISOString()).slice(0, 10);
    await col(projectId, 'decisionChecklist').add({
      what: String(d.title || 'Decision').trim(),
      room: String(d.room || d.area || '').trim(),
      decidedOn: when,
      how: 'portal',
      clientName: String(cr.clientName || cr.name || '').trim(),
      photoUrl: String(photo || ''),
      sourceDecisionId: decisionId,
      status: 'active',
      createdAt: new Date().toISOString(),
      createdBy: who()
    });
    toast('Added to the checklist');
  };

  async function refreshMeetingSideBadge(projectId) {
    var el = document.getElementById('cch-sb-meetings-badge');
    if (!el || !projectId) return;
    try {
      var snap = await col(projectId, 'meetingSummaries').where('status', '==', 'published').get();
      var n = 0;
      snap.forEach(function (d) {
        var m = d.data() || {};
        if (m.clientAck && (m.clientAck.name || m.clientAck.at)) return;
        n++;
      });
      if (n > 0) {
        el.textContent = String(Math.min(n, 9));
        el.style.display = '';
      } else {
        el.textContent = '';
        el.style.display = 'none';
      }
    } catch (_eBadge) {}
  }

  /* ---------- meeting notes ---------- */
  async function renderMeetings(root, projectId) {
    root.innerHTML = '<div class="cp-section-label">Meeting notes</div><div style="font-size:13px;color:#6B7280;">Loading…</div>';
    var isStaff = staff();
    var q = isStaff
      ? col(projectId, 'meetingSummaries')
      : col(projectId, 'meetingSummaries').where('status', '==', 'published');
    var snap = await q.get();
    var rows = [];
    snap.forEach(function (doc) {
      var data = doc.data() || {};
      if (!isStaff && data.status !== 'published') return;
      rows.push(Object.assign({ id: doc.id }, data));
    });
    rows.sort(function (a, b) { return String(b.date || b.createdAt || '').localeCompare(String(a.date || a.createdAt || '')); });
    var html = '<div class="cp-section-label">Meeting notes</div>' +
      '<div style="font-size:12px;color:#6B7280;margin:0 0 14px;line-height:1.5;">Site meetings, calls, and notes. Clients see a summary after it is published.</div>';
    if (isStaff) {
      html += '<div id="cch-mt-slot"><form id="cch-mt-add" style="border:1px solid #E2E2E2;padding:12px;margin-bottom:16px;background:#fff;">' +
        '<div id="cch-mt-form-title" style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#0A1F3D;margin-bottom:8px;">New summary</div>' +
        '<input name="subject" placeholder="Subject" style="width:100%;margin-bottom:8px;padding:8px;border:1px solid #E2E2E2;box-sizing:border-box;font-size:16px;color:#0A1F3D;">' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">' +
        '<input name="date" type="date" value="' + today() + '" style="padding:8px;border:1px solid #E2E2E2;">' +
        '<select name="type" style="padding:8px;border:1px solid #E2E2E2;"><option value="site">Site meeting</option><option value="call">Call</option><option value="note">Note</option></select>' +
        '<input name="attended" placeholder="Who was there" style="flex:1;min-width:160px;padding:8px;border:1px solid #E2E2E2;"></div>' +
        '<textarea name="rough" rows="3" placeholder="Paste rough notes. Draft with Pepper fills the boxes below. It does not publish." style="width:100%;margin-bottom:8px;padding:8px;border:1px solid #E2E2E2;box-sizing:border-box;"></textarea>' +
        '<button type="button" id="cch-mt-pepper" class="cp-btn cp-btn-outline" style="margin-bottom:8px;">Draft with Pepper</button>' +
        '<textarea name="discussed" rows="2" placeholder="Discussed" style="width:100%;margin-bottom:8px;padding:8px;border:1px solid #E2E2E2;box-sizing:border-box;"></textarea>' +
        '<textarea name="decisions" rows="2" placeholder="Decisions" style="width:100%;margin-bottom:8px;padding:8px;border:1px solid #E2E2E2;box-sizing:border-box;"></textarea>' +
        '<textarea name="nextSteps" rows="2" placeholder="Next steps, one per line. End a line with — CCH, — client, or — vendor" style="width:100%;margin-bottom:8px;padding:8px;border:1px solid #E2E2E2;box-sizing:border-box;"></textarea>' +
        '<textarea name="staffNotes" rows="2" placeholder="Staff only. Never shown on the portal." style="width:100%;margin-bottom:8px;padding:8px;border:1px solid #E2E2E2;box-sizing:border-box;"></textarea>' +
        '<label style="font-size:12px;color:#5C6B80;display:flex;gap:6px;align-items:center;margin-bottom:8px;"><input type="checkbox" name="email"> Email the client when this is published</label>' +
        '<button type="button" id="cch-mt-cancel" class="cp-btn cp-btn-outline" style="display:none;margin-right:8px;">Cancel</button>' +
        '<button type="submit" data-save class="cp-btn cp-btn-outline">Save draft</button> ' +
        '<button type="submit" name="publish" value="1" class="cp-btn cp-btn-primary">Publish to portal</button></form></div>';
    }
    if (!rows.length) html += '<div style="font-size:13px;color:#6B7280;">No meeting notes yet.</div>';
    root._cchMeetingRows = {};
    rows.forEach(function (r) { root._cchMeetingRows[r.id] = r; });
    rows.forEach(function (r) { html += meetingCard(r, isStaff); });
    root.innerHTML = html;
    wireMeetings(root, projectId);
  }

  function parseSteps(text) {
    return String(text || '').split('\n').map(function (line) {
      line = line.trim();
      if (!line) return null;
      var owner = 'cch';
      var m = line.match(/[—-]\s*(cch|client|vendor)\s*$/i);
      if (m) {
        owner = m[1].toLowerCase();
        line = line.slice(0, m.index).trim();
      }
      return { text: line, owner: owner, open: true };
    }).filter(Boolean);
  }

  function meetingCard(r, isStaff) {
    var steps = Array.isArray(r.nextSteps) ? r.nextSteps : [];
    var waiting = steps.filter(function (s) { return s && s.open && String(s.owner) === 'client'; });
    var stepHtml = steps.map(function (s) {
      return '<li>' + esc(s.text || '') + ' <span style="color:#6B7280;">(' + esc(s.owner || '') + ')</span></li>';
    }).join('');
    var subject = String(r.subject || '').trim();
    var head = subject || 'No subject';
    return '<article style="border-top:1px solid #EEF0F2;padding:14px 0;" data-id="' + esc(r.id) + '">' +
      (isStaff
        ? '<button type="button" data-edit="' + esc(r.id) + '" style="display:block;width:100%;text-align:left;background:none;border:none;padding:0;margin:0 0 4px;font-family:Georgia,serif;font-size:20px;line-height:1.3;color:#0A1F3D;cursor:pointer;">' + esc(head) + '</button>'
        : (subject ? '<div style="font-family:Georgia,serif;font-size:20px;line-height:1.3;color:#0A1F3D;margin:0 0 4px;">' + esc(subject) + '</div>' : '')) +
      '<div style="font-size:12px;color:#6B7280;">' + esc(r.date || '') + ' · ' + esc(r.type || 'note') +
      (r.status === 'draft' ? ' · Draft' : '') +
      (r.attended ? ' · ' + esc(r.attended) : '') + '</div>' +
      (r.discussed ? '<p style="margin:8px 0 0;font-size:14px;color:#0A1F3D;line-height:1.5;"><strong>Discussed.</strong> ' + esc(r.discussed) + '</p>' : '') +
      (r.decisions ? '<p style="margin:8px 0 0;font-size:14px;color:#0A1F3D;line-height:1.5;"><strong>Decided.</strong> ' + esc(r.decisions) + '</p>' : '') +
      (stepHtml ? '<ul style="margin:8px 0 0;padding-left:18px;font-size:14px;color:#0A1F3D;">' + stepHtml + '</ul>' : '') +
      (waiting.length && !isStaff ? '<div style="margin-top:8px;font-size:12px;color:#92400E;">Waiting on you: ' + esc(waiting.map(function (s) { return s.text; }).join('; ')) + '</div>' : '') +
      (r.clientAck && r.clientAck.name ? '<div style="margin-top:8px;font-size:12px;color:#1B5E20;">Acknowledged by ' + esc(r.clientAck.name) + '</div>' : '') +
      (!isStaff && r.status === 'published'
        ? '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;"><button type="button" class="cp-btn cp-btn-outline" data-ack="' + esc(r.id) + '">Acknowledge</button>' +
          '<input data-comment="' + esc(r.id) + '" placeholder="Comment" style="flex:1;min-width:160px;padding:6px;border:1px solid #E2E2E2;">' +
          '<button type="button" class="cp-btn cp-btn-outline" data-sendc="' + esc(r.id) + '">Send</button></div>'
        : '') +
      (isStaff
        ? '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">' +
          '<button type="button" class="cp-btn cp-btn-outline" data-edit="' + esc(r.id) + '">Edit</button>' +
          (r.status === 'draft' ? '<button type="button" class="cp-btn cp-btn-primary" data-publish="' + esc(r.id) + '">Publish</button>' : '') +
          '<button type="button" class="cp-btn cp-btn-outline" data-del="' + esc(r.id) + '">Delete</button></div>'
        : '') +
      '</article>';
  }

  function stepsToText(steps) {
    return (Array.isArray(steps) ? steps : []).map(function (s) {
      var t = String((s && s.text) || '').trim();
      if (!t) return '';
      var owner = String((s && s.owner) || 'cch').toLowerCase();
      var label = owner === 'client' ? 'client' : (owner === 'vendor' ? 'vendor' : 'CCH');
      return t + ' — ' + label;
    }).filter(Boolean).join('\n');
  }

  function resetMeetingForm(form) {
    if (!form) return;
    form.reset();
    if (form.elements.date) form.elements.date.value = today();
    delete form.dataset.editId;
    delete form.dataset.editStatus;
    form.style.border = '1px solid #E2E2E2';
    var slot = document.getElementById('cch-mt-slot');
    if (slot && form.parentNode !== slot) slot.appendChild(form);
    var title = form.querySelector('#cch-mt-form-title');
    if (title) title.textContent = 'New summary';
    var cancel = form.querySelector('#cch-mt-cancel');
    if (cancel) cancel.style.display = 'none';
    var saveBtn = form.querySelector('[data-save]');
    if (saveBtn) saveBtn.textContent = 'Save draft';
  }

  async function openMeetingForEdit(root, projectId, id) {
    var form = root.querySelector('#cch-mt-add');
    var row = (root._cchMeetingRows || {})[id];
    if (!form || !row) return;
    form.dataset.editId = id;
    form.dataset.editStatus = row.status || 'draft';
    if (form.elements.subject) form.elements.subject.value = row.subject || '';
    if (form.elements.date) form.elements.date.value = row.date || today();
    if (form.elements.type) form.elements.type.value = row.type || 'note';
    if (form.elements.attended) form.elements.attended.value = row.attended || '';
    if (form.elements.rough) form.elements.rough.value = '';
    if (form.elements.discussed) form.elements.discussed.value = row.discussed || '';
    if (form.elements.decisions) form.elements.decisions.value = row.decisions || '';
    if (form.elements.nextSteps) form.elements.nextSteps.value = stepsToText(row.nextSteps);
    if (form.elements.staffNotes) form.elements.staffNotes.value = '';
    var title = form.querySelector('#cch-mt-form-title');
    if (title) title.textContent = 'Edit this note';
    var cancel = form.querySelector('#cch-mt-cancel');
    if (cancel) cancel.style.display = '';
    var saveBtn = form.querySelector('[data-save]');
    if (saveBtn) saveBtn.textContent = row.status === 'published' ? 'Save' : 'Save draft';
    var article = null;
    root.querySelectorAll('article[data-id]').forEach(function (el) {
      if (!article && el.getAttribute('data-id') === id) article = el;
    });
    if (article) article.appendChild(form);
    form.style.border = '2px solid #0A1F3D';
    form.style.marginTop = '12px';
    try { form.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_eScroll) {}
    try { if (form.elements.subject) form.elements.subject.focus(); } catch (_eFocus) {}
    try {
      var priv = await col(projectId, 'meetingSummaryPrivate').doc(id).get();
      if (priv && priv.exists && form.elements.staffNotes && form.dataset.editId === id) {
        form.elements.staffNotes.value = String((priv.data() || {}).staffNotes || '');
      }
    } catch (_ePriv) {}
  }

  function meetingFieldsFromForm(form, publish, wasPublished) {
    var now = new Date().toISOString();
    var patch = {
      subject: String(form.elements.subject && form.elements.subject.value || '').trim(),
      date: String(form.elements.date && form.elements.date.value || today()),
      type: String(form.elements.type && form.elements.type.value || 'note'),
      attended: String(form.elements.attended && form.elements.attended.value || '').trim(),
      discussed: String(form.elements.discussed && form.elements.discussed.value || '').trim(),
      decisions: String(form.elements.decisions && form.elements.decisions.value || '').trim(),
      nextSteps: parseSteps(form.elements.nextSteps && form.elements.nextSteps.value),
      updatedAt: now
    };
    if (publish) {
      patch.status = 'published';
      patch.publishedAt = now;
    } else if (!wasPublished) {
      patch.status = 'draft';
      patch.publishedAt = '';
    }
    return patch;
  }

  function saveMeetingStaffNotes(projectId, id, form, updatedAt) {
    var staffNotes = String(form.elements.staffNotes && form.elements.staffNotes.value || '').trim();
    var ref = col(projectId, 'meetingSummaryPrivate').doc(id);
    if (!staffNotes) return ref.delete().catch(function () {});
    return ref.set({ staffNotes: staffNotes, updatedAt: updatedAt });
  }

  async function publishMeeting(projectId, id, root) {
    var now = new Date().toISOString();
    await col(projectId, 'meetingSummaries').doc(id).update({
      status: 'published',
      publishedAt: now,
      updatedAt: now
    });
    toast('Published to the portal');
    refreshMeetingSideBadge(projectId);
    renderMeetings(root, projectId);
  }

  async function deleteMeeting(projectId, id, root) {
    var ok = true;
    if (typeof cchConfirm === 'function') {
      ok = await cchConfirm('Delete this meeting note? The client will no longer see it.', 'Delete note', { confirmText: 'Delete', danger: true });
    }
    if (!ok) return;
    await col(projectId, 'meetingSummaries').doc(id).delete();
    try { await col(projectId, 'meetingSummaryPrivate').doc(id).delete(); } catch (_eDel) {}
    toast('Note deleted');
    refreshMeetingSideBadge(projectId);
    renderMeetings(root, projectId);
  }

  function wireMeetings(root, projectId) {
    var form = root.querySelector('#cch-mt-add');
    var pepperBtn = root.querySelector('#cch-mt-pepper');
    if (pepperBtn && form) pepperBtn.addEventListener('click', function () { draftWithPepper(form); });
    var cancelBtn = root.querySelector('#cch-mt-cancel');
    if (cancelBtn && form) cancelBtn.addEventListener('click', function () { resetMeetingForm(form); });
    if (form) form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var publish = ev.submitter && ev.submitter.name === 'publish';
      var fd = new FormData(form);
      var editId = form.dataset.editId || '';
      var wasPublished = form.dataset.editStatus === 'published';
      var patch = meetingFieldsFromForm(form, publish, wasPublished);
      var write = editId
        ? col(projectId, 'meetingSummaries').doc(editId).update(patch)
        : col(projectId, 'meetingSummaries').add(Object.assign({
          status: patch.status || 'draft',
          publishedAt: patch.publishedAt || '',
          versions: [],
          clientAck: null,
          clientComments: [],
          createdAt: patch.updatedAt,
          createdBy: who()
        }, patch)).then(function (ref) { editId = ref.id; });
      write.then(function () {
        return saveMeetingStaffNotes(projectId, editId, form, patch.updatedAt);
      }).then(function () {
        if (publish && fd.get('email')) openMeetingMail(projectId);
        toast(publish ? 'Published to the portal' : (wasPublished ? 'Note saved' : 'Draft saved'));
        if (publish) refreshMeetingSideBadge(projectId);
        renderMeetings(root, projectId);
      }).catch(function (e) { alertBox((e && e.message) || e, 'Meeting notes'); });
    });
    root.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () { openMeetingForEdit(root, projectId, btn.getAttribute('data-edit')); });
    });
    root.querySelectorAll('[data-publish]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        publishMeeting(projectId, btn.getAttribute('data-publish'), root).catch(function (e) {
          alertBox((e && e.message) || e, 'Meeting notes');
        });
      });
    });
    root.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteMeeting(projectId, btn.getAttribute('data-del'), root).catch(function (e) {
          alertBox((e && e.message) || e, 'Meeting notes');
        });
      });
    });
    root.querySelectorAll('[data-ack]').forEach(function (btn) {
      btn.addEventListener('click', function () { ackMeeting(projectId, btn.getAttribute('data-ack'), root); });
    });
    root.querySelectorAll('[data-sendc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-sendc');
        var input = root.querySelector('[data-comment="' + id + '"]');
        commentMeeting(projectId, id, input ? input.value : '', root);
      });
    });
  }

  function openMeetingMail(projectId) {
    var subject = encodeURIComponent('New meeting notes from CCH Design');
    var body = encodeURIComponent('New meeting notes are on your project portal.');
    window.location.href = 'mailto:?subject=' + subject + '&body=' + body;
  }

  async function ackMeeting(projectId, id, root) {
    var name = who();
    await col(projectId, 'meetingSummaries').doc(id).update({
      clientAck: { name: name, at: new Date().toISOString() },
      updatedAt: new Date().toISOString()
    });
    if (typeof cpPortalLogClientActivity === 'function') {
      await cpPortalLogClientActivity('client_portal', 'meeting_ack', 'acknowledged meeting notes', projectId, '', { itemId: id });
    }
    toast('Acknowledged');
    refreshMeetingSideBadge(projectId);
    renderMeetings(root, projectId);
  }

  async function commentMeeting(projectId, id, text, root) {
    text = String(text || '').trim();
    if (!text) return;
    var ref = col(projectId, 'meetingSummaries').doc(id);
    var snap = await ref.get();
    var prev = (snap.data() && snap.data().clientComments) || [];
    prev = prev.concat([{ name: who(), text: text, at: new Date().toISOString() }]);
    await ref.update({ clientComments: prev, updatedAt: new Date().toISOString() });
    if (typeof cpPortalLogClientActivity === 'function') {
      await cpPortalLogClientActivity('client_portal', 'meeting_comment', 'commented on meeting notes: ' + text.slice(0, 140), projectId, '', { itemId: id });
    }
    toast('Comment sent');
    renderMeetings(root, projectId);
  }

  async function draftWithPepper(form) {
    var rough = String((form.elements.rough && form.elements.rough.value) || '').trim();
    if (!rough) { alertBox('Paste the rough notes first.', 'Pepper'); return; }
    if (typeof firebase === 'undefined' || !firebase.app || !firebase.functions) {
      alertBox('Pepper is not loaded.', 'Pepper');
      return;
    }
    try {
      var fn = firebase.app().functions('us-central1').httpsCallable('cchPepper');
      var res = await fn({
        input: 'Turn these rough notes into a meeting summary. Reply with only this shape, one field per line:\nDISCUSSED: ...\nDECISIONS: ...\nNEXT: one step per line, ending with — CCH or — client or — vendor\n\nNotes:\n' + rough
      });
      var reply = String(((res || {}).data || {}).reply || '');
      var discussed = (reply.match(/DISCUSSED:\s*([\s\S]*?)(?=\nDECISIONS:|$)/i) || [])[1] || '';
      var decisions = (reply.match(/DECISIONS:\s*([\s\S]*?)(?=\nNEXT:|$)/i) || [])[1] || '';
      var next = (reply.match(/NEXT:\s*([\s\S]*)$/i) || [])[1] || '';
      if (form.elements.discussed) form.elements.discussed.value = discussed.trim();
      if (form.elements.decisions) form.elements.decisions.value = decisions.trim();
      if (form.elements.nextSteps) form.elements.nextSteps.value = next.trim();
      if (!discussed && !decisions) {
        if (form.elements.discussed) form.elements.discussed.value = reply.trim();
      }
      toast('Draft ready. It is not published.');
    } catch (e) {
      alertBox((e && e.message) || e, 'Pepper');
    }
  }

  function chatSeenKey(projectId) {
    return 'cchChatSeen:' + projectId + ':' + (staff() ? 'staff' : 'client');
  }
  function markChatSeen(projectId) {
    try { localStorage.setItem(chatSeenKey(projectId), new Date().toISOString()); } catch (_eSeen) {}
  }
  function projectIdFromStudioHash() {
    var h = String(window.location.hash || '');
    var m = h.match(/#\/(?:clientview|project)\/([^/?#]+)/);
    if (!m) return '';
    var id = '';
    try { id = decodeURIComponent(m[1]); } catch (_eId) { id = m[1]; }
    if (!id || id === '_lib_designer') return '';
    return id;
  }
  var chatWatchUnsub = null;
  var chatWatchId = '';
  function watchChatDocs(projectId) {
    if (!projectId) return;
    if (chatWatchId === String(projectId) && chatWatchUnsub) return;
    if (chatWatchUnsub) { try { chatWatchUnsub(); } catch (_eU) {} chatWatchUnsub = null; }
    chatWatchId = String(projectId);
    chatWatchUnsub = col(projectId, 'clientChat').onSnapshot(function () {
      if (document.getElementById('cch-client-chat-panel')) markChatSeen(projectId);
      refreshChatButtonBadge(projectId);
      var log = document.getElementById('cch-chat-log');
      if (log) renderChat(log, projectId, false);
    }, function () {});
  }
  function chatButtonLooks(waiting) {
    var base = 'position:relative;height:40px;min-width:0;padding:0 12px;margin:0;border:1px solid #C4A464;cursor:pointer;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;font-weight:700;font-family:"DM Sans",sans-serif;flex-shrink:0;white-space:nowrap;line-height:40px;';
    if (waiting) return base + 'background:#C4A464;color:#0A1F3D;';
    return base + 'background:#0A1F3D;color:#fff;';
  }
  function placeChatInHost(host, btn) {
    if (!host || !btn) return;
    if (btn.parentNode === host && host.firstChild === btn) return;
    if (host.firstChild && host.firstChild !== btn) host.insertBefore(btn, host.firstChild);
    else if (btn.parentNode !== host) host.appendChild(btn);
  }
  function dockChatButton(btn) {
    if (!btn) return;
    var waiting = btn.getAttribute('data-waiting') === '1';
    var h = String(window.location.hash || '');
    var pepperHost = document.getElementById('cchCpPepperHost');
    var assist = document.getElementById('cchStudioAssistHost');
    btn.style.cssText = chatButtonLooks(waiting);
    if (h.indexOf('clientview/') >= 0 && pepperHost) {
      placeChatInHost(pepperHost, btn);
      return;
    }
    if (assist && staff()) {
      placeChatInHost(assist, btn);
      return;
    }
    if (pepperHost) {
      placeChatInHost(pepperHost, btn);
      return;
    }
    btn.style.cssText = chatButtonLooks(waiting) + 'position:fixed;right:18px;top:72px;z-index:9000;height:40px;';
    if (btn.parentNode !== document.body) document.body.appendChild(btn);
  }
  function paintChatButton(btn, n) {
    if (!btn) return;
    var waiting = n > 0;
    btn.setAttribute('data-waiting', waiting ? '1' : '0');
    var label = btn.querySelector('.cch-chat-label');
    var badge = btn.querySelector('.cch-chat-wait');
    if (!label) {
      label = document.createElement('span');
      label.className = 'cch-chat-label';
      btn.appendChild(label);
    }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'cch-chat-wait';
      badge.style.cssText = 'position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 5px;background:#C4A464;color:#0A1F3D;font-size:11px;font-weight:700;line-height:20px;text-align:center;border:1px solid #0A1F3D;';
      btn.appendChild(badge);
    }
    label.textContent = waiting ? ('New chat ' + String(Math.min(n, 9))) : 'Client chat';
    label.style.setProperty('color', waiting ? '#0A1F3D' : '#ffffff', 'important');
    badge.textContent = waiting ? String(Math.min(n, 9)) : '';
    badge.style.cssText = 'display:' + (waiting ? 'inline-block' : 'none') + ';margin-left:8px;min-width:18px;height:18px;padding:0 4px;background:#0A1F3D;color:#C4A464;font-size:11px;font-weight:700;line-height:18px;text-align:center;border:1px solid #0A1F3D;vertical-align:middle;';
    btn.setAttribute('aria-label', waiting ? ('New chat, ' + n + ' waiting') : 'Client chat');
    dockChatButton(btn);
  }
  function unansweredClientCount(rows) {
    var sorted = (rows || []).slice().sort(function (a, b) {
      return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    });
    var n = 0;
    for (var i = sorted.length - 1; i >= 0; i--) {
      var from = String(sorted[i].from || '');
      if (from === 'staff') break;
      if (from === 'client') n++;
    }
    return n;
  }
  async function refreshChatButtonBadge(projectId) {
    var btn = document.getElementById('cch-client-chat-bubble');
    if (!btn || !projectId) return;
    var seen = '';
    try { seen = localStorage.getItem(chatSeenKey(projectId)) || ''; } catch (_eS) {}
    var n = 0;
    try {
      var snap = await col(projectId, 'clientChat').limit(80).get();
      var rows = [];
      snap.forEach(function (d) { rows.push(d.data() || {}); });
      if (staff()) n = unansweredClientCount(rows);
      else {
        rows.forEach(function (r) {
          if (r.from !== 'staff') return;
          if (seen && String(r.createdAt || '') <= seen) return;
          n++;
        });
      }
    } catch (_eB) {}
    paintChatButton(btn, n);
  }
  function syncChatBubbleToPage() {
    var h = String(window.location.hash || '');
    var onPortal = h.indexOf('clientview/') >= 0;
    var onProject = h.indexOf('#/project/') >= 0;
    var id = projectIdFromStudioHash();
    if (!id || (onProject && !onPortal && !staff())) {
      var b = document.getElementById('cch-client-chat-bubble');
      if (b) b.remove();
      var p = document.getElementById('cch-client-chat-panel');
      if (p) p.remove();
      return;
    }
    if (!onPortal && !onProject) return;
    mountChatBubble(id);
  }

  /* ---------- client chat ---------- */
  function mountChatBubble(projectId) {
    if (!projectId) return;
    var old = document.getElementById('cch-client-chat-bubble');
    if (old && old.getAttribute('data-project') === String(projectId)) {
      watchChatDocs(projectId);
      refreshChatButtonBadge(projectId);
      return;
    }
    if (old) old.remove();
    var oldPanel = document.getElementById('cch-client-chat-panel');
    if (oldPanel) oldPanel.remove();
    var btn = document.createElement('button');
    btn.id = 'cch-client-chat-bubble';
    btn.className = 'btn-dark';
    btn.type = 'button';
    btn.setAttribute('data-project', String(projectId));
    btn.addEventListener('click', function () { openChatPanel(projectId); });
    paintChatButton(btn, 0);
    watchChatDocs(projectId);
    refreshChatButtonBadge(projectId);
  }

  var CHAT_BLOCKERS = ['cchCpPepperPanel', 'cch-pepper-panel'];

  function blockerIsOpen(el) {
    if (!el || el.style.display === 'none') return false;
    return el.classList.contains('open') || el.style.display === 'flex';
  }

  function placeClientChatPanel(panel) {
    panel = panel || document.getElementById('cch-client-chat-panel');
    if (!panel) return;
    var leftEdge = null;
    for (var i = 0; i < CHAT_BLOCKERS.length; i++) {
      var el = document.getElementById(CHAT_BLOCKERS[i]);
      if (!blockerIsOpen(el)) continue;
      var rect = el.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 40) continue;
      if (leftEdge === null || rect.left < leftEdge) leftEdge = rect.left;
    }
    var rightPx = 20;
    if (leftEdge !== null) rightPx = Math.max(20, Math.round(window.innerWidth - leftEdge + 12));
    var room = Math.max(160, window.innerWidth - rightPx - 16);
    panel.style.left = 'auto';
    panel.style.right = rightPx + 'px';
    panel.style.width = Math.min(380, room) + 'px';
  }

  function bindChatBlocker(el) {
    if (!el || el._cchChatBeside) return;
    el._cchChatBeside = true;
    new MutationObserver(function () { placeClientChatPanel(); }).observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  function watchPepperBesideChat() {
    var i;
    for (i = 0; i < CHAT_BLOCKERS.length; i++) bindChatBlocker(document.getElementById(CHAT_BLOCKERS[i]));
    if (!window._cchChatPepperDom) {
      window._cchChatPepperDom = new MutationObserver(function () {
        for (var n = 0; n < CHAT_BLOCKERS.length; n++) {
          var el = document.getElementById(CHAT_BLOCKERS[n]);
          var fresh = !!(el && !el._cchChatBeside);
          bindChatBlocker(el);
          if (fresh) placeClientChatPanel();
        }
      });
      window._cchChatPepperDom.observe(document.body, { childList: true, subtree: true });
    }
    if (!window._cchChatResize) {
      window._cchChatResize = true;
      window.addEventListener('resize', function () { placeClientChatPanel(); });
    }
  }

  function openChatPanel(projectId) {
    var old = document.getElementById('cch-client-chat-panel');
    if (old) { stopChatListen(); stopChatAudio(); old.remove(); return; }
    markChatSeen(projectId);
    refreshChatButtonBadge(projectId);
    var panel = document.createElement('div');
    panel.id = 'cch-client-chat-panel';
    panel.style.cssText = 'position:fixed;right:20px;top:72px;width:min(380px,calc(100vw - 32px));height:min(480px,calc(100vh - 96px));background:#fff;border:1px solid #0A1F3D;border-top:3px solid #C4A464;z-index:100060;display:flex;flex-direction:column;box-shadow:0 10px 32px rgba(10,31,61,.18);';
    panel.innerHTML = '<div style="padding:10px 12px;border-bottom:1px solid #E2E2E2;display:flex;justify-content:space-between;align-items:center;"><strong style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#0A1F3D;">Client chat</strong><button type="button" id="cch-chat-x" style="border:none;background:none;font-size:18px;cursor:pointer;">&times;</button></div><div id="cch-chat-log" style="flex:1;overflow:auto;padding:10px;"></div><form id="cch-chat-form" style="display:flex;gap:6px;padding:8px;border-top:1px solid #E2E2E2;align-items:center;"><input type="file" id="cch-chat-file" accept="image/*" style="display:none;"><button type="button" id="cch-chat-photo" class="cp-btn cp-btn-outline">Photo</button><button type="button" id="cch-chat-mic" class="cp-btn cp-btn-outline" aria-label="Speak the message" title="Speak the message" style="width:36px;height:36px;padding:0;display:inline-flex;align-items:center;justify-content:center;"></button><input name="text" style="flex:1;padding:8px;border:1px solid #E2E2E2;" placeholder="Message"><button class="cp-btn cp-btn-primary" type="submit">Send</button></form><div id="cch-chat-photo-name" style="display:none;font-size:11px;color:#5C6B80;padding:0 8px 8px;"></div>';
    document.body.appendChild(panel);
    watchPepperBesideChat();
    placeClientChatPanel(panel);
    requestAnimationFrame(function () { placeClientChatPanel(panel); });
    panel.querySelector('#cch-chat-x').addEventListener('click', function () {
      stopChatListen();
      stopChatAudio();
      panel.remove();
    });
    var fileInput = panel.querySelector('#cch-chat-file');
    var photoName = panel.querySelector('#cch-chat-photo-name');
    var textInput = panel.querySelector('input[name="text"]');
    var micBtn = panel.querySelector('#cch-chat-mic');
    panel.querySelector('#cch-chat-photo').addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var f = fileInput.files && fileInput.files[0];
      photoName.textContent = f ? f.name : '';
      photoName.style.display = f ? '' : 'none';
    });
    if (micBtn) {
      paintChatMic(micBtn, false);
      micBtn.addEventListener('click', function () { toggleChatListen(textInput, micBtn); });
    }
    renderChat(panel.querySelector('#cch-chat-log'), projectId, false);
    panel.querySelector('#cch-chat-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var input = ev.target.elements.text;
      var file = fileInput.files && fileInput.files[0];
      var btn = ev.target.querySelector('button[type="submit"]');
      stopChatListen();
      if (btn) btn.disabled = true;
      sendChat(projectId, input.value, panel.querySelector('#cch-chat-log'), file).then(function (ok) {
        if (!ok) return;
        input.value = '';
        fileInput.value = '';
        photoName.textContent = '';
        photoName.style.display = 'none';
      }).finally(function () { if (btn) btn.disabled = false; });
    });
  }

  async function renderChat(root, projectId, live) {
    if (!root) return;
    var snap = await col(projectId, 'clientChat').orderBy('createdAt').limit(80).get().catch(function () {
      return col(projectId, 'clientChat').limit(80).get();
    });
    var rows = [];
    snap.forEach(function (doc) { rows.push(doc.data() || {}); });
    rows.sort(function (a, b) { return String(a.createdAt || '').localeCompare(String(b.createdAt || '')); });
    root.innerHTML = rows.map(function (r, i) {
      var mine = (staff() && r.from === 'staff') || (!staff() && r.from === 'client');
      var img = '';
      if (r.imageUrl) {
        var src = esc(r.imageUrl);
        img = '<a href="' + src + '" target="_blank" rel="noopener" style="display:inline-block;"><img src="' + src + '" alt="" style="max-width:220px;max-height:180px;display:block;margin-top:4px;object-fit:contain;border:1px solid #E2E2E2;"></a>';
      }
      var speak = '';
      if (String(r.text || '').trim()) {
        speak = '<button type="button" class="cch-chat-speak" data-i="' + i + '" style="margin-top:4px;border:1px solid #0A1F3D;background:#fff;color:#0A1F3D;font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;cursor:pointer;">Speak</button>';
      }
      return '<div style="margin:0 0 8px;font-size:13px;line-height:1.4;' + (mine ? 'text-align:right;' : '') + '"><span style="color:#6B7280;font-size:10px;">' + esc(r.authorName || r.from || '') + '</span><div>' + esc(r.text || '') + img + '</div>' + speak + '</div>';
    }).join('') || '<div style="font-size:13px;color:#6B7280;">No messages yet.</div>';
    var speakBtns = root.querySelectorAll('.cch-chat-speak');
    for (var s = 0; s < speakBtns.length; s++) {
      speakBtns[s].addEventListener('click', function () {
        var row = rows[Number(this.getAttribute('data-i'))];
        speakChatMessage(row && row.text, this);
      });
    }
    root.scrollTop = root.scrollHeight;
    if (live && !root._cchChatUnsub) {
      root._cchChatUnsub = col(projectId, 'clientChat').onSnapshot(function () { renderChat(root, projectId, false); });
    }
  }

  var chatSpeakBtn = null;
  var chatAudio = null;
  var chatAudioUrl = '';
  var chatListen = false;
  var chatRec = null;
  var chatListenBase = '';
  var CHAT_ELISE = 'EST9Ui6982FZPSi7gCHi';

  function stopChatAudio() {
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (eSyn) { /* */ }
    if (chatAudio) {
      try { chatAudio.pause(); } catch (ePause) { /* */ }
      chatAudio = null;
    }
    if (chatAudioUrl) {
      try { URL.revokeObjectURL(chatAudioUrl); } catch (eUrl) { /* */ }
      chatAudioUrl = '';
    }
  }

  function resetChatSpeakBtn(btn) {
    if (!btn) return;
    btn.textContent = 'Speak';
    btn.removeAttribute('data-speaking');
    if (chatSpeakBtn === btn) chatSpeakBtn = null;
  }

  function chatSpeakerMark() {
    return '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"></path><path d="M16.5 9.5a3.5 3.5 0 010 5"></path></svg>';
  }
  function paintChatMic(btn, listening) {
    if (!btn) return;
    btn.innerHTML = chatSpeakerMark();
    btn.setAttribute('aria-label', listening ? 'Stop speaking into the message' : 'Speak the message');
    btn.title = listening ? 'Listening. Tap to stop.' : 'Speak the message';
    if (listening) {
      btn.setAttribute('data-listening', '1');
      btn.style.background = '#0A1F3D';
      btn.style.color = '#C4A464';
    } else {
      btn.removeAttribute('data-listening');
      btn.style.background = '';
      btn.style.color = '';
    }
  }
  function stopChatListen(micBtn) {
    chatListen = false;
    if (chatRec) {
      var rec = chatRec;
      chatRec = null;
      try { rec.abort(); } catch (e1) { try { rec.stop(); } catch (e2) { /* */ } }
    }
    micBtn = micBtn || document.getElementById('cch-chat-mic');
    paintChatMic(micBtn, false);
  }

  function startChatListenSession(input, micBtn) {
    var Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor || !chatListen || !input) return;
    var rec = new Ctor();
    chatRec = rec;
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = function (ev) {
      if (!chatListen || !input) return;
      var interim = '';
      var finalBit = '';
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var piece = ev.results[i][0] ? (ev.results[i][0].transcript || '') : '';
        if (ev.results[i].isFinal) finalBit += piece;
        else interim += piece;
      }
      if (finalBit) {
        chatListenBase = (chatListenBase + finalBit).replace(/\s+/g, ' ');
        if (chatListenBase && chatListenBase.charAt(chatListenBase.length - 1) !== ' ') chatListenBase += ' ';
      }
      input.value = (chatListenBase + interim).replace(/\s+/g, ' ').replace(/^\s+/, '');
    };
    rec.onerror = function (ev) {
      var err = (ev && ev.error) || '';
      if (err === 'no-speech' || err === 'aborted' || err === 'audio-capture') return;
      if (err === 'not-allowed') {
        stopChatListen(micBtn);
        alertBox('Microphone is blocked. Allow the mic in the browser, then try again.', 'Client chat');
      }
    };
    rec.onend = function () {
      if (chatRec === rec) chatRec = null;
      if (!chatListen) return;
      setTimeout(function () { startChatListenSession(input, micBtn); }, 80);
    };
    try { rec.start(); } catch (eStart) {
      setTimeout(function () {
        if (!chatListen) return;
        try { rec.start(); } catch (e2) {
          stopChatListen(micBtn);
          alertBox('Could not start the microphone. Chrome works best.', 'Client chat');
        }
      }, 200);
    }
  }

  function toggleChatListen(input, micBtn) {
    if (!input || !micBtn) return;
    var Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) {
      alertBox('Voice works best in Chrome. You can still type the message.', 'Client chat');
      return;
    }
    if (chatListen) {
      stopChatListen(micBtn);
      return;
    }
    chatListenBase = String(input.value || '').replace(/\s+$/, '');
    if (chatListenBase) chatListenBase += ' ';
    chatListen = true;
    paintChatMic(micBtn, true);
    startChatListenSession(input, micBtn);
  }

  async function speakChatMessage(text, btn) {
    text = String(text || '').trim();
    if (!text) return;
    if (btn && btn.getAttribute('data-speaking') === '1') {
      stopChatAudio();
      resetChatSpeakBtn(btn);
      return;
    }
    stopChatAudio();
    if (chatSpeakBtn && chatSpeakBtn !== btn) resetChatSpeakBtn(chatSpeakBtn);
    var max = staff() ? 2500 : 320;
    if (text.length > max) {
      var cut = text.slice(0, max);
      var sp = cut.lastIndexOf(' ');
      text = sp > 200 ? cut.slice(0, sp) : cut;
    }
    if (typeof firebase === 'undefined' || !firebase.app || !firebase.functions) {
      alertBox('Pepper\'s voice is not available.', 'Client chat');
      return;
    }
    chatSpeakBtn = btn || null;
    if (btn) {
      btn.textContent = 'Stop';
      btn.setAttribute('data-speaking', '1');
    }
    try {
      var fn = firebase.app().functions('us-central1').httpsCallable('cchPepperSpeak');
      var res = await fn({ text: text, voiceId: CHAT_ELISE, clientPortal: true });
      if (btn && btn.getAttribute('data-speaking') !== '1') return;
      var data = (res && res.data) || {};
      var b64 = String(data.audioBase64 || '');
      if (!b64) throw new Error('No audio returned');
      var bin = atob(b64);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([bytes], { type: data.mimeType || 'audio/mpeg' }));
      chatAudioUrl = url;
      var audio = new Audio(url);
      chatAudio = audio;
      audio.onended = function () {
        if (chatAudio === audio) stopChatAudio();
        resetChatSpeakBtn(btn);
      };
      await audio.play();
    } catch (eSpeak) {
      stopChatAudio();
      resetChatSpeakBtn(btn);
      alertBox((eSpeak && eSpeak.message) || 'Pepper\'s voice did not play.', 'Client chat');
    }
  }

  async function uploadChatImage(projectId, file) {
    if (!file) return '';
    if (!/^image\//.test(String(file.type || ''))) {
      alertBox('Choose a photo.', 'Client chat');
      return null;
    }
    if (file.size > 8 * 1024 * 1024) {
      alertBox('That photo is over 8 MB.', 'Client chat');
      return null;
    }
    if (typeof firebase === 'undefined' || !firebase.storage) {
      alertBox('Photo upload is not available.', 'Client chat');
      return null;
    }
    var safe = String(file.name || 'photo.jpg').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
    var path = 'projects/' + projectId + '/client-chat/' + Date.now() + '-' + safe;
    var ref = firebase.storage().ref(path);
    await ref.put(file, { contentType: file.type || 'image/jpeg' });
    return ref.getDownloadURL();
  }

  async function sendChat(projectId, text, log, file) {
    text = String(text || '').trim();
    var imageUrl = '';
    if (file) {
      try {
        imageUrl = await uploadChatImage(projectId, file);
      } catch (eUp) {
        alertBox((eUp && eUp.message) || eUp, 'Client chat');
        return false;
      }
      if (!imageUrl) return false;
    }
    if (!text && !imageUrl) return false;
    var from = staff() ? 'staff' : 'client';
    var row = {
      text: text,
      from: from,
      authorName: who(),
      createdAt: new Date().toISOString()
    };
    if (imageUrl) row.imageUrl = imageUrl;
    await col(projectId, 'clientChat').add(row);
    if (from === 'client' && typeof cpPortalLogClientActivity === 'function') {
      await cpPortalLogClientActivity('client_portal', 'client_chat', (text || 'photo').slice(0, 180), projectId, '', {});
    }
    if (log) renderChat(log, projectId, false);
    return true;
  }

  window.cchPortalRecordsAnswer = async function (projectId, text) {
    var t = String(text || '').toLowerCase();
    var database = db();
    if (!database || !projectId) return '';
    if (/\b(approve|approved|checklist|decid)\b/.test(t)) {
      var snap = await col(projectId, 'decisionChecklist').get();
      var lines = [];
      snap.forEach(function (doc) {
        var d = doc.data() || {};
        if (String(d.status || '') === 'replaced') return;
        var room = String(d.room || '').toLowerCase();
        if (/\bkitchen\b/.test(t) && room && room.indexOf('kitchen') < 0) return;
        lines.push((d.decidedOn || '') + ' ' + (d.room ? d.room + ': ' : '') + (d.what || ''));
      });
      if (!lines.length) return '';
      return 'On your checklist: ' + lines.slice(0, 8).join('. ');
    }
    if (/\b(meeting|site visit|notes)\b/.test(t)) {
      var ms = await col(projectId, 'meetingSummaries').get();
      var bits = [];
      ms.forEach(function (doc) {
        var d = doc.data() || {};
        if (d.status !== 'published') return;
        bits.push((d.date || '') + ' ' + (d.decisions || d.discussed || ''));
      });
      if (!bits.length) return '';
      return 'Published meeting notes: ' + bits.slice(0, 4).join('. ');
    }
    return '';
  };

  window.addEventListener('hashchange', syncChatBubbleToPage);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncChatBubbleToPage);
  else syncChatBubbleToPage();
  setTimeout(syncChatBubbleToPage, 600);
  setTimeout(syncChatBubbleToPage, 1600);
})();
