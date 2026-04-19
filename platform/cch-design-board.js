// ==================== CCH DESIGN BOARD EDITOR ====================
// Free-form canvas editor for creating client presentation boards
// Integrates with project clips - drag items onto canvas, annotate, share

(function() {
  'use strict';

  // ---- State ----
  var dbEditor = {
    projectId: null,
    boardId: null,
    boardData: null,
    elements: [],
    clips: [],
    clipCategory: 'All',
    clipListFilter: '',
    selectedId: null,
    tool: 'select', // select, text, arrow, note, heading
    isDragging: false,
    isResizing: false,
    dragOffset: { x: 0, y: 0 },
    resizeDir: '',
    canvasScale: 1,
    showPricing: true,
    clientView: false,
    undoStack: [],
    nextId: 1,
    arrowStart: null,
    dirty: false
  };
  window.dbEditor = dbEditor;

  // ---- Utility ----
  function genId() { return 'el_' + (dbEditor.nextId++); }
  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function escAttr(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/'/g, '&#39;');
  }
  function escJsStr(s) {
    return String(s || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r?\n/g, ' ');
  }
  function fmt$(n) { return '$' + (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

  /** Studio stores some boards as `name` (index.html) and canvas editor as `title` — keep both in sync. */
  function _dbBoardDisplayName(d) {
    d = d || {};
    var t = String(d.title || d.name || '').trim();
    return t || 'Untitled Board';
  }

  // ---- Save state for undo ----
  var _autoSaveTimer = null;
  function autoSave() {
    if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(function() {
      saveBoardToFirestore();
    }, 2000); // Save 2 seconds after last change
  }

  function pushUndo() {
    dbEditor.undoStack.push(JSON.stringify(dbEditor.elements));
    if (dbEditor.undoStack.length > 40) dbEditor.undoStack.shift();
    dbEditor.dirty = true;
    autoSave();
  }
  window.dbUndo = function() {
    if (dbEditor.undoStack.length === 0) return;
    dbEditor.elements = JSON.parse(dbEditor.undoStack.pop());
    dbEditor.selectedId = null;
    renderCanvas();
    renderProps();
  };

  // ==================== DESIGN BOARDS LIST ====================
  window.renderDesignBoardsTab = async function(T, proj) {
    var boards = [];
    try {
      var s = await db.collection('boards').doc(proj.id).collection('designBoards').get();
      s.forEach(function(d) { boards.push({ id: d.id, data: d.data() }); });
      boards.sort(function(a, b) {
        var ta = String((a.data && (a.data.updatedAt || a.data.createdAt)) || '');
        var tb = String((b.data && (b.data.updatedAt || b.data.createdAt)) || '');
        return tb.localeCompare(ta);
      });
    } catch(e) {}

    T.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
        '<div class="section-title" style="margin:0;">' + boards.length + ' Design Board' + (boards.length !== 1 ? 's' : '') + '</div>' +
        '<button class="btn btn-primary" onclick="void createDesignBoard(\'' + proj.id + '\')">+ New Design Board</button>' +
      '</div>' +
      (boards.length === 0 ?
        '<div style="text-align:center;padding:72px 24px;border:1px solid #E2E2E2;background:#FAFBFC;border-radius:0;">' +
          '<div style="font-family:\'Playfair Display\',Georgia,serif;font-size:26px;color:#0A1F3D;font-weight:600;margin-bottom:12px;line-height:1.35;">Compose your first client board</div>' +
          '<div style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:14px;color:#6B7280;max-width:460px;margin:0 auto 8px;line-height:1.55;">A freeform canvas for presentations — drag room-board products, add headings and notes, export or send to proposals.</div>' +
          '<div style="font-family:\'DM Sans\',system-ui,sans-serif;font-size:12px;color:#9CA3AF;">Use <strong>New Design Board</strong> above to begin.</div>' +
        '</div>'
      :
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px;">' +
        boards.map(function(b) {
          var d = b.data;
          var elCount = (d.elements || []).length;
          var thumb = String(d.coverImageUrl || '').trim();
          if (!thumb && d.coverElementId) {
            (d.elements || []).forEach(function(el) {
              if (!thumb && el && el.id === d.coverElementId) thumb = el.imageUrl || el.img || thumb;
            });
          }
          if (!thumb) {
            (d.elements || []).forEach(function(el) {
              if (!thumb && el && el.type === 'product' && el.imageUrl) thumb = el.imageUrl;
              if (!thumb && el && el.type === 'image' && el.img) thumb = el.img;
            });
          }
          var nm = _dbBoardDisplayName(d);
          return '<div class="card db-board-card" style="overflow:hidden;border:1px solid #E2E2E2;border-radius:0;transition:transform 0.2s,box-shadow 0.2s;box-shadow:none;">' +
            '<div style="cursor:pointer;aspect-ratio:4/3;width:100%;background:' + (thumb ? 'url(' + esc(thumb) + ') center/cover' : 'linear-gradient(135deg,#f5f0e8,#e8e0d0)') + ';display:flex;align-items:center;justify-content:center;" onclick="openDesignBoard(\'' + proj.id + '\',\'' + b.id + '\')">' +
            (thumb ? '' : '<span style="font-size:48px;opacity:0.3;">🎨</span>') +
            '</div>' +
            '<div class="card-body" style="padding:14px 16px;">' +
              '<div style="display:flex;justify-content:space-between;align-items:flex-start;">' +
                '<div style="cursor:pointer;flex:1;" onclick="openDesignBoard(\'' + proj.id + '\',\'' + b.id + '\')">' +
                  '<div style="font-weight:600;font-size:14px;color:#0A1F3D;font-family:\'DM Sans\',system-ui,sans-serif;">' + esc(nm) + '</div>' +
                  '<div style="font-size:11px;color:#9CA3AF;margin-top:6px;line-height:1.4;font-family:\'DM Sans\',system-ui,sans-serif;">' +
                    (d.room ? esc(d.room) + ' · ' : '') + elCount + ' element' + (elCount !== 1 ? 's' : '') +
                    (d.updatedAt ? ' · ' + new Date(d.updatedAt).toLocaleDateString() : '') +
                  '</div>' +
                '</div>' +
                '<div style="display:flex;gap:4px;flex-shrink:0;">' +
                  '<button class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:11px;border-radius:0;" onclick="event.stopPropagation();void editBoardMeta(\'' + proj.id + '\',\'' + b.id + '\',\'' + escJsStr(nm) + '\',\'' + escJsStr(d.room || '') + '\')">✏️</button>' +
                  '<button class="btn btn-sm" style="padding:4px 8px;font-size:11px;background:#fee;color:var(--red);border-radius:0;" onclick="event.stopPropagation();void deleteDesignBoard(\'' + proj.id + '\',\'' + b.id + '\',\'' + escJsStr(nm) + '\')">🗑️</button>' +
                '</div>' +
              '</div>' +
              '<div style="display:flex;gap:6px;margin-top:8px;">' +
                '<button class="btn btn-secondary btn-sm" style="font-size:11px;padding:4px 10px;border-radius:0;" onclick="event.stopPropagation();openDesignBoard(\'' + proj.id + '\',\'' + b.id + '\')">✏️ Edit</button>' +
                '<button class="btn btn-secondary btn-sm" style="font-size:11px;padding:4px 10px;border-radius:0;" onclick="event.stopPropagation();window.location.hash=\'#/clientboard/' + proj.id + '/' + b.id + '\'">🖤 Client View</button>' +
              '</div>' +
            '</div>' +
          '</div>';
        }).join('') +
        '</div>'
      );
  };

  window.editBoardMeta = async function(projectId, boardId, currentTitle, currentRoom) {
    if (typeof cchPrompt !== 'function') return;
    var newTitle = await cchPrompt('Board name:', currentTitle || '', 'Design board');
    if (newTitle === null) return;
    newTitle = String(newTitle).trim();
    if (!newTitle) return;
    var newRoom = await cchPrompt('Room (optional):', currentRoom || '', 'Room');
    if (newRoom === null) return;
    newRoom = String(newRoom || '').trim();
    try {
      await db.collection('boards').doc(projectId).collection('designBoards').doc(boardId).update({
        title: newTitle,
        name: newTitle,
        room: newRoom,
        updatedAt: new Date().toISOString()
      });
      renderProjectDetail();
    } catch(e) {
      if (typeof cchAlert === 'function') await cchAlert('Error: ' + e.message, 'Design board');
      else alert('Error: ' + e.message);
    }
  };

  window.deleteDesignBoard = async function(projectId, boardId, title) {
    if (typeof cchConfirm !== 'function') return;
    if (!(await cchConfirm('Delete "' + title + '"? This cannot be undone.', 'Delete design board', { confirmText: 'Delete', danger: true }))) return;
    try {
      await db.collection('boards').doc(projectId).collection('designBoards').doc(boardId).delete();
      renderProjectDetail();
    } catch(e) {
      if (typeof cchAlert === 'function') await cchAlert('Error: ' + e.message, 'Design board');
      else alert('Error: ' + e.message);
    }
  };

  // createDesignBoard lives in index.html (loads before this file) — do not assign window.createDesignBoard here or the project tab "+ New Design Board" breaks.

  // ==================== OPEN BOARD EDITOR ====================
  window.openDesignBoard = async function(projectId, boardId) {
    dbUnbindDocPointerListeners();
    dbEditor.isDragging = false;
    dbEditor.isResizing = false;
    _arrowDragEl = null;
    _arrowDragEnd = null;
    dbEditor.projectId = projectId;
    dbEditor.boardId = boardId;
    dbEditor.selectedId = null;
    dbEditor.tool = 'select';
    dbEditor.dirty = false;
    dbEditor.undoStack = [];

    // Set hash for deep linking
    window.location.hash = '#/project/' + projectId + '/designboard/' + boardId;

    // Load board data
    var doc = await db.collection('boards').doc(projectId).collection('designBoards').doc(boardId).get();
    if (!doc.exists) {
      document.getElementById('contentArea').innerHTML = '<div style="padding:60px;text-align:center;color:#999;">Design board not found.</div>';
      return;
    }
    dbEditor.boardData = doc.data() || {};
    if (!dbEditor.boardData.title && dbEditor.boardData.name) dbEditor.boardData.title = dbEditor.boardData.name;
    if (!dbEditor.boardData.name && dbEditor.boardData.title) dbEditor.boardData.name = dbEditor.boardData.title;
    dbEditor.elements = (dbEditor.boardData.elements || []).map(function(el) { return Object.assign({}, el); });
    dbEditor.showPricing = dbEditor.boardData.showPricing !== false;
    dbEditor.clientView = false;
    dbEditor.nextId = dbEditor.elements.length + 1;
    dbEditor.clipCategory = 'All';
    dbEditor.clipListFilter = '';

    // Load clips
    dbEditor.clips = [];
    try {
      var cs = await db.collection('boards').doc(projectId).collection('clips').get();
      cs.forEach(function(d) { dbEditor.clips.push({ id: d.id, data: d.data() }); });
    } catch(e) {}

    // Fix in-memory tiles that still point at app-root junk (e.g. …/68.jpeg 404s) using clip + gallery pickers
    try {
      if (hydrateProductTileUrlsFromClips()) {
        dbEditor.dirty = true;
        if (typeof showToast === 'function') {
          showToast('Product image links were corrected from clips — click Save to update the client portal.', 6000);
        }
      }
    } catch (_hydrErr) { console.warn('[design board] hydrate tiles:', _hydrErr); }

    // Render full editor
    renderBoardEditor();
  };

  /** Replace weak imageUrl on product tiles (same-origin single-segment 404s) using cchPickPreferredProductImageUrl + clip merge. */
  function hydrateProductTileUrlsFromClips() {
    if (!dbEditor.elements || !dbEditor.elements.length || typeof window.cchPickPreferredProductImageUrl !== 'function') return false;
    var byId = {};
    (dbEditor.clips || []).forEach(function(c) { if (c && c.id) byId[c.id] = c.data || {}; });
    var changed = false;
    dbEditor.elements.forEach(function(el) {
      if (!el || el.type !== 'product') return;
      var merged = (el.clipId && byId[el.clipId]) ? Object.assign({}, byId[el.clipId], el) : el;
      var best = String(window.cchPickPreferredProductImageUrl(merged) || '').trim();
      if (!best) return;
      var cur = (typeof _resolveImgSrc === 'function')
        ? _resolveImgSrc(String(el.imageUrl || '').trim())
        : String(el.imageUrl || '').trim();
      if (String(cur).toLowerCase() === String(best).toLowerCase()) return;
      var needs = true;
      if (typeof window.cchProductBoardImageIsLikelyValid === 'function' && window.cchProductBoardImageIsLikelyValid(cur)) needs = false;
      if (!needs) return;
      el.imageUrl = best;
      changed = true;
    });
    return changed;
  }

  // ==================== RENDER BOARD EDITOR ====================
  function renderBoardEditor() {
    var C = document.getElementById('contentArea');
    if (!C) return;
    dbUnbindDocPointerListeners();
    dbEditor.isDragging = false;
    dbEditor.isResizing = false;
    _arrowDragEl = null;
    _arrowDragEnd = null;
    var bd = dbEditor.boardData;
    var cw = bd.canvasWidth || 1400;
    var ch = bd.canvasHeight || 1000;

    C.innerHTML =
      '<style>' +
      '#dbToolbar .db-tool-btn{font-family:DM Sans,system-ui,sans-serif!important;font-size:12px!important;font-weight:600!important;padding:8px 12px!important;border-radius:6px!important;cursor:pointer!important;letter-spacing:0.02em!important;border:1px solid rgba(27,51,82,0.32)!important;background:#fff!important;color:#0a1628!important;box-shadow:0 1px 2px rgba(27,51,82,0.08)!important;line-height:1.2!important;}' +
      '#dbToolbar .db-tool-btn:hover{border-color:#C4A464!important;color:#1B3352!important;background:#fffdf6!important;}' +
      '#dbToolbar .db-tool-btn--active{background:linear-gradient(180deg,#d4b76e,#c4a464)!important;color:#1a1204!important;border-color:#8a7030!important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.35),0 1px 2px rgba(0,0,0,0.08)!important;}' +
      '#dbToolbar .db-toolbar-hint{font-size:11px!important;color:#2c3d5e!important;font-weight:500!important;max-width:240px!important;line-height:1.4!important;}' +
      '#dbToolbar .db-toolbar-hint strong{color:#0a1628!important;font-weight:700!important;}' +
      '</style>' +
      // Top toolbar
      '<div id="dbToolbar" style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--gray-200);margin-bottom:0;flex-wrap:wrap;">' +
        '<button class="btn btn-secondary btn-sm" onclick="closeBoardEditor()" style="margin-right:8px;">← Back</button>' +
        '<span style="font-weight:700;font-size:15px;margin-right:16px;color:#1B3352;" id="dbTitle">' + esc(_dbBoardDisplayName(bd)) + '</span>' +
        '<div style="display:flex;gap:6px;padding:6px;background:#eef2f7;border-radius:8px;flex-wrap:wrap;align-items:center;border:1px solid rgba(27,51,82,0.1);">' +
          toolBtn('select', '↖', 'Select') +
          toolBtn('text', 'T', 'Text') +
          toolBtn('heading', 'H', 'Heading') +
          toolBtn('arrow', '→', 'Arrow') +
          toolBtn('note', '📝', 'Note') +
        '</div>' +
        '<span class="db-toolbar-hint">Choose <strong>Text</strong> or <strong>Heading</strong>, then click on the board to place.</span>' +
        '<button class="btn btn-secondary btn-sm" onclick="void addImageToBoard()">🖼️ Add Image</button>' +
        '<div style="flex:1;"></div>' +
        '<label style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" ' + (dbEditor.showPricing ? 'checked' : '') + ' onchange="toggleBoardPricing(this.checked)"> Show Pricing</label>' +
        '<button class="btn btn-secondary btn-sm" onclick="toggleClientView()">' + (dbEditor.clientView ? '🔧 Designer' : '👁 Client View') + '</button>' +
        '<button class="btn btn-secondary btn-sm" onclick="openLuxuryClientView()">🖤 Share with Client</button>' +
        '<button class="btn btn-secondary btn-sm" onclick="dbUndo()">↩ Undo</button>' +
        '<button class="btn btn-secondary btn-sm" onclick="exportBoardPNG()">📸 Export</button>' +
        '<button class="btn btn-secondary btn-sm" onclick="createProposalFromBoard()">📋 → Proposal</button>' +
        '<button class="btn btn-primary btn-sm" onclick="saveBoardToFirestore()">💾 Save</button>' +
      '</div>' +

      // Main layout: clips panel + canvas + props panel
      '<div style="display:flex;gap:0;margin-top:0;height:calc(100vh - 180px);">' +
        // Left: Clips panel
        '<div id="dbClipsPanel" style="width:220px;min-width:220px;border-right:1px solid var(--gray-200);overflow-y:auto;padding:12px;background:#fafaf8;">' +
          '<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:var(--gray-400);font-weight:600;margin-bottom:8px;">Project Items</div>' +
          '<label style="font-size:10px;color:var(--gray-500);display:block;margin-bottom:4px;">Category</label>' +
          '<select id="dbClipCatSel" style="width:100%;padding:6px 8px;border:1px solid var(--gray-200);border-radius:4px;font-size:12px;margin-bottom:8px;background:#fff;box-sizing:border-box;" onchange="setBoardClipCategory(this.value)"></select>' +
          '<input id="dbClipFilterInput" type="text" placeholder="Filter clips..." style="width:100%;padding:6px 8px;border:1px solid var(--gray-200);border-radius:4px;font-size:12px;margin-bottom:8px;box-sizing:border-box;" oninput="filterBoardClips(this.value)">' +
          '<div id="dbClipsList"></div>' +
        '</div>' +

        // Center: Canvas
        '<div id="dbCanvasWrap" style="flex:1;overflow:auto;background:#e8e4dc;position:relative;cursor:default;" onmousedown="canvasMouseDown(event)">' +
          '<div id="dbCanvas" style="position:relative;width:' + cw + 'px;height:' + ch + 'px;background:#ffffff;margin:30px auto;box-shadow:0 4px 24px rgba(0,0,0,0.12);overflow:hidden;">' +
            '<svg id="dbArrowSvg" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:500;"></svg>' +
            '<div id="dbElements"></div>' +
            // Branding footer
            (bd.branding !== false ? '<div id="dbBranding" style="position:absolute;bottom:20px;left:0;right:0;text-align:center;pointer-events:none;z-index:10;">' +
              '<div style="display:inline-flex;align-items:center;gap:2px;">' +
                '<span style="font-family:\'Playfair Display\',Georgia,serif;font-size:28px;font-weight:700;color:#C4A052;letter-spacing:2px;">CCH</span>' +
              '</div>' +
              '<div style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:12px;letter-spacing:4px;color:#999;text-transform:uppercase;margin-top:2px;">Design Inc.</div>' +
            '</div>' : '') +
          '</div>' +
        '</div>' +

        // Right: Properties panel
        '<div id="dbPropsPanel" style="width:240px;min-width:240px;border-left:1px solid var(--gray-200);overflow-y:auto;padding:12px;background:#fafaf8;">' +
          '<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:var(--gray-400);font-weight:600;margin-bottom:8px;">Properties</div>' +
          '<div id="dbPropsContent"><div style="color:var(--gray-400);font-size:12px;padding:20px 0;text-align:center;">Select an element<br>or drag a clip onto the canvas</div></div>' +
        '</div>' +
      '</div>';

    populateClipCategorySelect();
    var _fi = document.getElementById('dbClipFilterInput');
    if (_fi) _fi.value = dbEditor.clipListFilter || '';
    renderClipsList(dbEditor.clipListFilter || '');
    renderCanvas();
    renderProps();

    // Keyboard handler
    document.onkeydown = function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;
      if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); e.preventDefault(); }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { dbUndo(); e.preventDefault(); }
      if (e.key === 'Escape') { dbEditor.selectedId = null; dbEditor.tool = 'select'; renderCanvas(); renderProps(); updateToolbar(); }
    };
  }

  function toolBtn(tool, icon, label) {
    var active = dbEditor.tool === tool;
    return '<button type="button" class="db-tool-btn' + (active ? ' db-tool-btn--active' : '') + '" onclick="setDBTool(\'' + tool + '\')" title="' + escAttr(label) + '">' +
      '<span style="font-weight:800;font-size:13px;margin-right:5px;opacity:0.95;">' + esc(icon) + '</span><span>' + esc(label) + '</span></button>';
  }

  function updateToolbar() {
    var tb = document.getElementById('dbToolbar');
    if (!tb) return;
    var btns = tb.querySelectorAll('.btn');
    // Just re-render toolbar section - simpler to rebuild
  }

  window.setDBTool = function(tool) {
    dbEditor.tool = tool;
    dbEditor.arrowStart = null;
    var wrap = document.getElementById('dbCanvasWrap');
    if (wrap) {
      if (tool === 'text' || tool === 'heading' || tool === 'note') wrap.style.cursor = 'crosshair';
      else if (tool === 'arrow') wrap.style.cursor = 'crosshair';
      else wrap.style.cursor = 'default';
    }
    renderBoardEditor();
  };

  window.closeBoardEditor = function() {
    // Auto-save handles persistence, just save immediately if dirty
    if (dbEditor.dirty) saveBoardToFirestore();
    if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
    document.onkeydown = null;
    navigate('#/project/' + dbEditor.projectId + '/designboards');
  };

  function clipCategoryOptions() {
    var s = new Set();
    dbEditor.clips.forEach(function(c) {
      var cat = String((c.data && c.data.category) || '').trim();
      if (cat) s.add(cat);
    });
    return ['All'].concat(Array.from(s).sort(function(a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); }));
  }

  function populateClipCategorySelect() {
    var sel = document.getElementById('dbClipCatSel');
    if (!sel) return;
    var cats = clipCategoryOptions();
    var cur = dbEditor.clipCategory || 'All';
    sel.innerHTML = cats.map(function(c) {
      return '<option value="' + escAttr(c) + '"' + (cur === c ? ' selected' : '') + '>' + esc(c === 'All' ? 'All categories' : c) + '</option>';
    }).join('');
  }

  window.setBoardClipCategory = function(val) {
    dbEditor.clipCategory = val || 'All';
    var inp = document.getElementById('dbClipFilterInput');
    renderClipsList(inp ? inp.value : '');
  };

  /** Nudge x,y so a new w×h product box avoids overlapping other products (reduces stacked drops). */
  function findFreeCanvasDropPosition(w, h, preferX, preferY) {
    var rects = dbEditor.elements.filter(function(e) {
      return e && e.type === 'product' && e.w != null && e.h != null;
    });
    var x = Math.max(0, preferX - w / 2);
    var y = Math.max(0, preferY - h / 2);
    function hits(ex, ey) {
      return rects.some(function(o) {
        return !(ex + w < o.x - 2 || ex > o.x + o.w + 2 || ey + h < o.y - 2 || ey > o.y + o.h + 2);
      });
    }
    for (var step = 0; step < 80; step++) {
      if (!hits(x, y)) return { x: x, y: y };
      y += 28;
      if (y > 920) { y = 20; x += 36; }
    }
    return { x: Math.max(0, preferX - w / 2), y: Math.max(0, preferY - h / 2) };
  }

  // ==================== CLIPS SIDEBAR ====================
  function renderClipsList(filter) {
    var el = document.getElementById('dbClipsList');
    if (!el) return;
    if (filter !== undefined && filter !== null) dbEditor.clipListFilter = filter;
    var f = String(dbEditor.clipListFilter || '').toLowerCase();
    var catF = dbEditor.clipCategory || 'All';
    var html = '';
    dbEditor.clips.forEach(function(clip) {
      var d = clip.data;
      if (catF !== 'All') {
        var cc = String(d.category || '').trim();
        if (cc.toLowerCase() !== String(catF).toLowerCase()) return;
      }
      var title = d.title || 'Untitled';
      var vendor = d.vendor || '';
      if (f && title.toLowerCase().indexOf(f) < 0 && vendor.toLowerCase().indexOf(f) < 0) return;
      var img = _resolveImgSrc(String(d.imageUrl || '').trim()) || _firstCoercedGalleryUrl(d) || '';
      var cost = parseFloat(d.cost) || 0;
      var sell = parseFloat(d.clientPrice) || parseFloat(d.sellingPrice) || 0;
      html += '<div class="db-clip-item" draggable="true" data-clipid="' + clip.id + '" ' +
        'ondragstart="clipDragStart(event,\'' + clip.id + '\')" ' +
        'style="display:flex;gap:8px;padding:6px;margin-bottom:4px;border-radius:6px;cursor:grab;border:1px solid transparent;transition:all 0.15s;" ' +
        'onmouseover="this.style.background=\'#f0ede5\';this.style.borderColor=\'var(--gray-200)\'" ' +
        'onmouseout="this.style.background=\'transparent\';this.style.borderColor=\'transparent\'">' +
        (img ? '<img src="' + _escImgSrcAttr(img) + '" style="width:44px;height:44px;border-radius:4px;object-fit:cover;flex-shrink:0;" onerror="this.style.display=\'none\'">' : '<div style="width:44px;height:44px;background:var(--gray-100);border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--gray-300);">📷</div>') +
        '<div style="overflow:hidden;flex:1;min-width:0;">' +
          '<div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(title) + '</div>' +
          '<div style="font-size:10px;color:var(--gray-400);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(vendor) + '</div>' +
          (sell > 0 ? '<div style="font-size:10px;color:var(--green);font-weight:600;">' + fmt$(sell) + '</div>' : '') +
        '</div>' +
      '</div>';
    });
    if (!html) html = '<div style="color:var(--gray-400);font-size:12px;text-align:center;padding:12px;">No clips found</div>';
    el.innerHTML = html;
  }

  window.filterBoardClips = function(val) { renderClipsList(val); };

  window.bringSelectedToFront = function() {
    if (!dbEditor.selectedId) return;
    var idx = dbEditor.elements.findIndex(function(e) { return e.id === dbEditor.selectedId; });
    if (idx < 0) return;
    pushUndo();
    var lifted = dbEditor.elements.splice(idx, 1)[0];
    dbEditor.elements.push(lifted);
    renderCanvas();
    renderProps();
  };

  window.setBoardCoverFromProduct = async function() {
    var el = dbEditor.elements.find(function(e) { return e.id === dbEditor.selectedId; });
    if (!el || el.type !== 'product' || !el.imageUrl) {
      if (typeof cchAlert === 'function') await cchAlert('Select a product tile on the board (with an image), then set cover.', 'Board cover');
      return;
    }
    try {
      await db.collection('boards').doc(dbEditor.projectId).collection('designBoards').doc(dbEditor.boardId).update({
        coverImageUrl: el.imageUrl,
        coverElementId: el.id,
        updatedAt: new Date().toISOString()
      });
      dbEditor.boardData.coverImageUrl = el.imageUrl;
      dbEditor.boardData.coverElementId = el.id;
      if (typeof showToast === 'function') showToast('Cover saved — this image is used on the Design Boards grid.', 3500);
    } catch (err) {
      if (typeof cchAlert === 'function') await cchAlert((err && err.message) || 'Could not save cover', 'Board cover');
    }
  };

  // ---- Drag from clips panel ----
  window.clipDragStart = function(e, clipId) {
    e.dataTransfer.setData('text/plain', clipId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  // ==================== CANVAS RENDERING ====================
  function renderCanvas() {
    var container = document.getElementById('dbElements');
    var svgEl = document.getElementById('dbArrowSvg');
    if (!container || !svgEl) return;

    var html = '';
    var svgHtml = '<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#333"/></marker></defs>';

    dbEditor.elements.forEach(function(el) {
      var sel = el.id === dbEditor.selectedId;
      var outline = sel ? 'outline:2px solid var(--gold);outline-offset:2px;' : '';

      if (el.type === 'product') {
        var showPrice = dbEditor.showPricing && !dbEditor.clientView && el.showPrice !== false;
        html += '<div class="db-el" data-id="' + el.id + '" style="position:absolute;left:' + el.x + 'px;top:' + el.y + 'px;width:' + (el.w || 180) + 'px;' + outline + 'cursor:move;z-index:' + (sel ? 100 : 10) + ';" onmousedown="elMouseDown(event,\'' + el.id + '\')">' +
          (el.imageUrl ? '<img src="' + _escImgSrcAttr(el.imageUrl) + '" style="width:100%;height:' + (el.h || 180) + 'px;object-fit:cover;border-radius:4px;display:block;pointer-events:none;" draggable="false" onerror="this.onerror=null;this.style.display=\'none\';this.insertAdjacentHTML(\'afterend\',\'<div style=&quot;width:100%;height:' + (el.h || 180) + 'px;background:var(--gray-100);border-radius:4px;display:flex;align-items:center;justify-content:center;color:var(--gray-300);font-size:24px;&quot;>📷</div>\')">' : '<div style="width:100%;height:' + (el.h || 180) + 'px;background:var(--gray-100);border-radius:4px;display:flex;align-items:center;justify-content:center;">📷</div>') +
          '<div style="margin-top:4px;font-size:11px;font-weight:600;color:#333;text-align:center;pointer-events:none;">' + esc(el.title || '') + '</div>' +
          (showPrice && el.sellPrice ? '<div style="font-size:10px;color:var(--green);font-weight:600;text-align:center;pointer-events:none;">' + fmt$(el.sellPrice) + '</div>' : '') +
          (el.annotation ? '<div style="font-size:10px;color:#666;text-align:center;font-style:italic;margin-top:2px;pointer-events:none;white-space:pre-line;">' + esc(el.annotation) + '</div>' : '') +
          (sel ? resizeHandles() : '') +
        '</div>';
      }

      else if (el.type === 'text') {
        html += '<div class="db-el" data-id="' + el.id + '" style="position:absolute;left:' + el.x + 'px;top:' + el.y + 'px;' + outline + 'cursor:move;z-index:' + (sel ? 100 : 20) + ';max-width:300px;" onmousedown="elMouseDown(event,\'' + el.id + '\')" ondblclick="void editTextEl(\'' + el.id + '\')">' +
          '<div style="font-size:' + (el.fontSize || 13) + 'px;color:' + (el.color || '#333') + ';font-weight:' + (el.fontWeight || 'normal') + ';white-space:pre-wrap;pointer-events:none;font-family:' + (el.fontFamily || 'inherit') + ';">' + esc(el.text || 'Text') + '</div>' +
        '</div>';
      }

      else if (el.type === 'heading') {
        html += '<div class="db-el" data-id="' + el.id + '" style="position:absolute;left:' + el.x + 'px;top:' + el.y + 'px;' + outline + 'cursor:move;z-index:' + (sel ? 100 : 20) + ';" onmousedown="elMouseDown(event,\'' + el.id + '\')" ondblclick="void editTextEl(\'' + el.id + '\')">' +
          '<div style="font-size:' + (el.fontSize || 24) + 'px;color:' + (el.color || '#333') + ';font-weight:700;letter-spacing:2px;text-transform:uppercase;pointer-events:none;">' + esc(el.text || 'HEADING') + '</div>' +
        '</div>';
      }

      else if (el.type === 'note') {
        html += '<div class="db-el" data-id="' + el.id + '" style="position:absolute;left:' + el.x + 'px;top:' + el.y + 'px;width:' + (el.w || 200) + 'px;padding:10px 12px;background:#FFFDE7;border:1px solid #FFF9C4;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.08);' + outline + 'cursor:move;z-index:' + (sel ? 100 : 15) + ';" onmousedown="elMouseDown(event,\'' + el.id + '\')" ondblclick="void editTextEl(\'' + el.id + '\')">' +
          '<div style="font-size:12px;color:#666;white-space:pre-wrap;pointer-events:none;font-style:italic;">' + esc(el.text || 'Designer notes...') + '</div>' +
          (sel ? resizeHandles() : '') +
        '</div>';
      }

      else if (el.type === 'arrow') {
        svgHtml += '<line x1="' + el.x1 + '" y1="' + el.y1 + '" x2="' + el.x2 + '" y2="' + el.y2 + '" stroke="' + (el.color || '#333') + '" stroke-width="' + (el.strokeWidth || 1.5) + '" marker-end="url(#arrowhead)" style="pointer-events:stroke;cursor:pointer;" onmousedown="elMouseDown(event,\'' + el.id + '\')" />';
        if (el.label) {
          var mx = (el.x1 + el.x2) / 2;
          var my = (el.y1 + el.y2) / 2;
          svgHtml += '<text x="' + mx + '" y="' + (my - 6) + '" text-anchor="middle" font-size="11" fill="#666" style="pointer-events:none;">' + esc(el.label) + '</text>';
        }
        if (sel) {
          svgHtml += '<circle cx="' + el.x1 + '" cy="' + el.y1 + '" r="5" fill="var(--gold)" stroke="#fff" stroke-width="1.5" style="cursor:move;pointer-events:all;" onmousedown="arrowHandleDown(event,\'' + el.id + '\',\'start\')" />';
          svgHtml += '<circle cx="' + el.x2 + '" cy="' + el.y2 + '" r="5" fill="var(--gold)" stroke="#fff" stroke-width="1.5" style="cursor:move;pointer-events:all;" onmousedown="arrowHandleDown(event,\'' + el.id + '\',\'end\')" />';
        }
      }

      else if (el.type === 'pricetag') {
        var showP = dbEditor.showPricing && !dbEditor.clientView;
        if (showP) {
          html += '<div class="db-el" data-id="' + el.id + '" style="position:absolute;left:' + el.x + 'px;top:' + el.y + 'px;background:#fff;border:1px solid #ddd;border-radius:4px;padding:4px 8px;font-size:11px;' + outline + 'cursor:move;z-index:' + (sel ? 100 : 25) + ';" onmousedown="elMouseDown(event,\'' + el.id + '\')" ondblclick="void editTextEl(\'' + el.id + '\')">' +
            '<div style="pointer-events:none;">' + esc(el.text || '') + '</div>' +
          '</div>';
        }
      }
    });

    container.innerHTML = html;
    svgEl.innerHTML = svgHtml;
  }

  function resizeHandles() {
    return '<div class="db-resize" data-dir="se" style="position:absolute;right:-4px;bottom:-4px;width:10px;height:10px;background:var(--gold);border:1px solid #fff;border-radius:2px;cursor:nwse-resize;" onmousedown="resizeMouseDown(event,\'se\')"></div>' +
      '<div class="db-resize" data-dir="sw" style="position:absolute;left:-4px;bottom:-4px;width:10px;height:10px;background:var(--gold);border:1px solid #fff;border-radius:2px;cursor:nesw-resize;" onmousedown="resizeMouseDown(event,\'sw\')"></div>' +
      '<div class="db-resize" data-dir="ne" style="position:absolute;right:-4px;top:-4px;width:10px;height:10px;background:var(--gold);border:1px solid #fff;border-radius:2px;cursor:nesw-resize;" onmousedown="resizeMouseDown(event,\'ne\')"></div>';
  }

  // ==================== PROPERTIES PANEL ====================
  function renderProps() {
    var pc = document.getElementById('dbPropsContent');
    if (!pc) return;

    if (!dbEditor.selectedId) {
      pc.innerHTML = '<div style="color:var(--gray-400);font-size:12px;padding:20px 0;text-align:center;">Select an element<br>or drag a clip onto the canvas</div>' +
        '<div style="margin-top:20px;border-top:1px solid var(--gray-200);padding-top:12px;">' +
          '<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:var(--gray-400);font-weight:600;margin-bottom:8px;">Canvas</div>' +
          propRow('Title', '<input class="db-prop-input" value="' + esc(dbEditor.boardData.title || '') + '" onchange="updateBoardMeta(\'title\',this.value)">') +
          propRow('Room', '<input class="db-prop-input" value="' + esc(dbEditor.boardData.room || '') + '" onchange="updateBoardMeta(\'room\',this.value)">') +
          propRow('Width', '<input class="db-prop-input" type="number" value="' + (dbEditor.boardData.canvasWidth || 1400) + '" onchange="resizeBoard(\'w\',this.value)" style="width:70px;">') +
          propRow('Height', '<input class="db-prop-input" type="number" value="' + (dbEditor.boardData.canvasHeight || 1000) + '" onchange="resizeBoard(\'h\',this.value)" style="width:70px;">') +
        '</div>';
      return;
    }

    var el = dbEditor.elements.find(function(e) { return e.id === dbEditor.selectedId; });
    if (!el) { pc.innerHTML = ''; return; }

    var html = '<div style="font-size:13px;font-weight:600;margin-bottom:8px;">' + el.type.charAt(0).toUpperCase() + el.type.slice(1) + '</div>';

    html += propRow('X', '<input class="db-prop-input" type="number" value="' + Math.round(el.x || 0) + '" onchange="updateElProp(\'' + el.id + '\',\'x\',+this.value)" style="width:60px;">') +
      propRow('Y', '<input class="db-prop-input" type="number" value="' + Math.round(el.y || 0) + '" onchange="updateElProp(\'' + el.id + '\',\'y\',+this.value)" style="width:60px;">');

    if (el.w !== undefined) {
      html += propRow('Width', '<input class="db-prop-input" type="number" value="' + Math.round(el.w) + '" onchange="updateElProp(\'' + el.id + '\',\'w\',+this.value)" style="width:60px;">');
    }
    if (el.h !== undefined) {
      html += propRow('Height', '<input class="db-prop-input" type="number" value="' + Math.round(el.h) + '" onchange="updateElProp(\'' + el.id + '\',\'h\',+this.value)" style="width:60px;">');
    }

    if (el.type === 'product') {
      html += '<div style="border-top:1px solid var(--gray-200);margin:10px 0;padding-top:10px;">';
      html += propRow('Title', '<input class="db-prop-input" value="' + esc(el.title || '') + '" onchange="updateElProp(\'' + el.id + '\',\'title\',this.value)">');
      html += propRow('Cost', '<input class="db-prop-input" type="number" value="' + (el.cost || 0) + '" onchange="updateElProp(\'' + el.id + '\',\'cost\',+this.value)" style="width:80px;">');
      html += propRow('Sell $', '<input class="db-prop-input" type="number" value="' + (el.sellPrice || 0) + '" onchange="updateElProp(\'' + el.id + '\',\'sellPrice\',+this.value)" style="width:80px;">');
      html += propRow('Show $', '<input type="checkbox" ' + (el.showPrice !== false ? 'checked' : '') + ' onchange="updateElProp(\'' + el.id + '\',\'showPrice\',this.checked)">');
      html += propRow('Note', '<textarea class="db-prop-input" rows="3" onchange="updateElProp(\'' + el.id + '\',\'annotation\',this.value)" style="resize:vertical;">' + esc(el.annotation || '') + '</textarea>');
      html += '<div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;">' +
        '<button type="button" class="btn btn-sm" onclick="void setBoardCoverFromProduct()">Use as board cover (grid thumbnail)</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" onclick="bringSelectedToFront()">Bring to front (stacking)</button>' +
      '</div>';
      html += '</div>';
    }

    if (el.type === 'text' || el.type === 'heading' || el.type === 'note' || el.type === 'pricetag') {
      html += '<div style="border-top:1px solid var(--gray-200);margin:10px 0;padding-top:10px;">';
      html += propRow('Text', '<textarea class="db-prop-input" rows="3" onchange="updateElProp(\'' + el.id + '\',\'text\',this.value)" style="resize:vertical;">' + esc(el.text || '') + '</textarea>');
      html += propRow('Size', '<input class="db-prop-input" type="number" value="' + (el.fontSize || 13) + '" onchange="updateElProp(\'' + el.id + '\',\'fontSize\',+this.value)" style="width:60px;">');
      html += propRow('Color', '<input type="color" value="' + (el.color || '#333333') + '" onchange="updateElProp(\'' + el.id + '\',\'color\',this.value)" style="width:36px;height:24px;border:none;cursor:pointer;">');
      html += '</div>';
    }

    if (el.type === 'arrow') {
      html += propRow('Label', '<input class="db-prop-input" value="' + esc(el.label || '') + '" onchange="updateElProp(\'' + el.id + '\',\'label\',this.value)">');
      html += propRow('Color', '<input type="color" value="' + (el.color || '#333333') + '" onchange="updateElProp(\'' + el.id + '\',\'color\',this.value)" style="width:36px;height:24px;border:none;cursor:pointer;">');
    }

    // Actions
    html += '<div style="border-top:1px solid var(--gray-200);margin-top:12px;padding-top:12px;display:flex;gap:6px;">' +
      '<button class="btn btn-secondary btn-sm" onclick="duplicateEl(\'' + el.id + '\')">Duplicate</button>' +
      '<button class="btn btn-sm" style="background:#fee;color:var(--red);" onclick="deleteEl(\'' + el.id + '\')">Delete</button>' +
    '</div>';

    // Layer controls
    html += '<div style="display:flex;gap:4px;margin-top:8px;">' +
      '<button class="btn btn-secondary btn-sm" onclick="moveElLayer(\'' + el.id + '\',-1)" title="Send back">↓</button>' +
      '<button class="btn btn-secondary btn-sm" onclick="moveElLayer(\'' + el.id + '\',1)" title="Bring forward">↑</button>' +
    '</div>';

    pc.innerHTML = html;
  }

  function propRow(label, input) {
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
      '<div style="font-size:11px;color:var(--gray-400);width:50px;flex-shrink:0;">' + label + '</div>' +
      '<div style="flex:1;">' + input + '</div>' +
    '</div>';
  }

  // ==================== ELEMENT OPERATIONS ====================
  window.updateElProp = function(id, prop, value) {
    pushUndo();
    var el = dbEditor.elements.find(function(e) { return e.id === id; });
    if (el) { el[prop] = value; renderCanvas(); }
  };

  window.updateBoardMeta = function(prop, value) {
    dbEditor.boardData[prop] = value;
    if (prop === 'title') dbEditor.boardData.name = value;
    dbEditor.dirty = true;
    if (prop === 'title') {
      var tEl = document.getElementById('dbTitle');
      if (tEl) tEl.textContent = value;
    }
  };

  window.resizeBoard = function(dim, val) {
    var v = parseInt(val) || 1000;
    if (dim === 'w') dbEditor.boardData.canvasWidth = v;
    else dbEditor.boardData.canvasHeight = v;
    dbEditor.dirty = true;
    var canvas = document.getElementById('dbCanvas');
    if (canvas) {
      if (dim === 'w') canvas.style.width = v + 'px';
      else canvas.style.height = v + 'px';
    }
  };

  window.deleteEl = function(id) {
    pushUndo();
    dbEditor.elements = dbEditor.elements.filter(function(e) { return e.id !== id; });
    dbEditor.selectedId = null;
    renderCanvas();
    renderProps();
  };

  function deleteSelected() {
    if (dbEditor.selectedId) deleteEl(dbEditor.selectedId);
  }

  window.duplicateEl = function(id) {
    var el = dbEditor.elements.find(function(e) { return e.id === id; });
    if (!el) return;
    pushUndo();
    var clone = JSON.parse(JSON.stringify(el));
    clone.id = genId();
    clone.x = (clone.x || 0) + 20;
    clone.y = (clone.y || 0) + 20;
    if (clone.x1 !== undefined) { clone.x1 += 20; clone.y1 += 20; clone.x2 += 20; clone.y2 += 20; }
    dbEditor.elements.push(clone);
    dbEditor.selectedId = clone.id;
    renderCanvas();
    renderProps();
  };

  window.moveElLayer = function(id, dir) {
    var idx = dbEditor.elements.findIndex(function(e) { return e.id === id; });
    if (idx < 0) return;
    var newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= dbEditor.elements.length) return;
    pushUndo();
    var tmp = dbEditor.elements[idx];
    dbEditor.elements[idx] = dbEditor.elements[newIdx];
    dbEditor.elements[newIdx] = tmp;
    renderCanvas();
  };

  window.editTextEl = async function(id) {
    var el = dbEditor.elements.find(function(e) { return e.id === id; });
    if (!el || typeof cchPrompt !== 'function') return;
    var newText = await cchPrompt('Edit text:', el.text || '', 'Edit text');
    if (newText === null) return;
    pushUndo();
    el.text = newText;
    renderCanvas();
    renderProps();
  };

  // ==================== MOUSE HANDLING ====================
  var _arrowDragEl = null;
  var _arrowDragEnd = null;
  /** Full innerHTML refresh on mousedown destroyed the node under the cursor; overlapping tiles felt "sticky". Capture on document keeps move/up reliable. */
  var _dbDocPointerBound = false;
  function dbUnbindDocPointerListeners() {
    if (!_dbDocPointerBound) return;
    _dbDocPointerBound = false;
    document.removeEventListener('mousemove', dbDocPointerMove, true);
    document.removeEventListener('mouseup', dbDocPointerUp, true);
  }
  function dbDocPointerMove(e) {
    if (!dbEditor.isDragging && !dbEditor.isResizing && !_arrowDragEl) return;
    if (typeof window.canvasMouseMove === 'function') window.canvasMouseMove(e);
  }
  function dbDocPointerUp(e) {
    if (typeof window.canvasMouseUp === 'function') window.canvasMouseUp(e);
  }
  function dbBindDocPointerListeners() {
    if (_dbDocPointerBound) return;
    _dbDocPointerBound = true;
    document.addEventListener('mousemove', dbDocPointerMove, true);
    document.addEventListener('mouseup', dbDocPointerUp, true);
  }

  window.arrowHandleDown = function(e, id, end) {
    e.stopPropagation();
    _arrowDragEl = id;
    _arrowDragEnd = end;
    dbEditor.selectedId = id;
    dbEditor._arrowDragUndoPushed = false;
    dbEditor._dragStartScreen = { x: e.clientX, y: e.clientY };
    dbBindDocPointerListeners();
    renderProps();
  };

  window.elMouseDown = function(e, id) {
    e.stopPropagation();
    if (e.target.classList && e.target.classList.contains('db-resize')) return;

    dbEditor.selectedId = id;
    var el = dbEditor.elements.find(function(e2) { return e2.id === id; });
    if (!el) return;

    if (el.type !== 'arrow') {
      var bi = dbEditor.elements.findIndex(function(e2) { return e2.id === id; });
      if (bi >= 0) {
        var lifted = dbEditor.elements.splice(bi, 1)[0];
        dbEditor.elements.push(lifted);
      }
    }

    var canvas = document.getElementById('dbCanvas');
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;

    dbEditor.isDragging = true;
    dbEditor._dragUndoPushed = false;
    dbEditor._dragStartScreen = { x: e.clientX, y: e.clientY };
    if (el.type === 'arrow') {
      dbEditor.dragOffset = { x: mx, y: my, ox1: el.x1, oy1: el.y1, ox2: el.x2, oy2: el.y2 };
    } else {
      dbEditor.dragOffset = { x: mx - (el.x || 0), y: my - (el.y || 0) };
    }

    dbBindDocPointerListeners();
    requestAnimationFrame(function() {
      renderCanvas();
      renderProps();
    });
  };

  window.resizeMouseDown = function(e, dir) {
    e.stopPropagation();
    pushUndo();
    dbEditor.isResizing = true;
    dbEditor.resizeDir = dir;
    dbBindDocPointerListeners();

    var el = dbEditor.elements.find(function(e2) { return e2.id === dbEditor.selectedId; });
    if (!el) return;

    var canvas = document.getElementById('dbCanvas');
    var rect = canvas.getBoundingClientRect();
    dbEditor.resizeStart = {
      mx: e.clientX, my: e.clientY,
      x: el.x, y: el.y, w: el.w || 180, h: el.h || 180
    };
  };

  window.canvasMouseDown = function(e) {
    var canvas = document.getElementById('dbCanvas');
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;

    // Click on scroll padding / gray area around the white board: clear selection (was returning early → "sticky" selection)
    if (mx < 0 || my < 0 || mx > canvas.offsetWidth || my > canvas.offsetHeight) {
      if (dbEditor.tool === 'select') {
        dbEditor.selectedId = null;
        dbEditor.isDragging = false;
        dbEditor.isResizing = false;
        _arrowDragEl = null;
        _arrowDragEnd = null;
        dbUnbindDocPointerListeners();
        renderCanvas();
        renderProps();
      }
      return;
    }

    if (dbEditor.tool === 'text') {
      pushUndo();
      var tel = { id: genId(), type: 'text', x: mx, y: my, text: 'Text', fontSize: 13, color: '#333', fontWeight: 'normal' };
      dbEditor.elements.push(tel);
      dbEditor.selectedId = tel.id;
      dbEditor.tool = 'select';
      renderCanvas();
      renderProps();
      editTextEl(tel.id);
      return;
    }

    if (dbEditor.tool === 'heading') {
      pushUndo();
      var hel = { id: genId(), type: 'heading', x: mx, y: my, text: 'HEADING', fontSize: 24, color: '#333' };
      dbEditor.elements.push(hel);
      dbEditor.selectedId = hel.id;
      dbEditor.tool = 'select';
      renderCanvas();
      renderProps();
      editTextEl(hel.id);
      return;
    }

    if (dbEditor.tool === 'note') {
      pushUndo();
      var nel = { id: genId(), type: 'note', x: mx, y: my, w: 200, text: 'Designer notes...', fontSize: 12 };
      dbEditor.elements.push(nel);
      dbEditor.selectedId = nel.id;
      dbEditor.tool = 'select';
      renderCanvas();
      renderProps();
      editTextEl(nel.id);
      return;
    }

    if (dbEditor.tool === 'arrow') {
      if (!dbEditor.arrowStart) {
        dbEditor.arrowStart = { x: mx, y: my };
      } else {
        pushUndo();
        var ael = { id: genId(), type: 'arrow', x1: dbEditor.arrowStart.x, y1: dbEditor.arrowStart.y, x2: mx, y2: my, color: '#333', strokeWidth: 1.5, label: '' };
        dbEditor.elements.push(ael);
        dbEditor.selectedId = ael.id;
        dbEditor.arrowStart = null;
        dbEditor.tool = 'select';
        renderCanvas();
        renderProps();
      }
      return;
    }

    // Deselect
    if (e.target === canvas || e.target.id === 'dbElements' || e.target.id === 'dbArrowSvg') {
      dbEditor.selectedId = null;
      renderCanvas();
      renderProps();
    }
  };

  window.canvasMouseMove = function(e) {
    var canvas = document.getElementById('dbCanvas');
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;

    // Arrow endpoint drag
    if (_arrowDragEl) {
      var ael = dbEditor.elements.find(function(e2) { return e2.id === _arrowDragEl; });
      if (ael) {
        if (!dbEditor._arrowDragUndoPushed) {
          var dsA = dbEditor._dragStartScreen;
          if (dsA && (Math.abs(e.clientX - dsA.x) > 2 || Math.abs(e.clientY - dsA.y) > 2)) {
            dbEditor._arrowDragUndoPushed = true;
            pushUndo();
          }
        }
        if (_arrowDragEnd === 'start') { ael.x1 = mx; ael.y1 = my; }
        else { ael.x2 = mx; ael.y2 = my; }
        renderCanvas();
      }
      return;
    }

    // Resize
    if (dbEditor.isResizing && dbEditor.selectedId) {
      var el = dbEditor.elements.find(function(e2) { return e2.id === dbEditor.selectedId; });
      if (!el) return;
      var rs = dbEditor.resizeStart;
      var dx = e.clientX - rs.mx;
      var dy = e.clientY - rs.my;

      if (dbEditor.resizeDir === 'se') {
        el.w = Math.max(60, rs.w + dx);
        el.h = Math.max(60, rs.h + dy);
      } else if (dbEditor.resizeDir === 'sw') {
        el.w = Math.max(60, rs.w - dx);
        el.x = rs.x + dx;
        el.h = Math.max(60, rs.h + dy);
      } else if (dbEditor.resizeDir === 'ne') {
        el.w = Math.max(60, rs.w + dx);
        el.y = rs.y + dy;
        el.h = Math.max(60, rs.h - dy);
      }
      renderCanvas();
      return;
    }

    // Drag element
    if (dbEditor.isDragging && dbEditor.selectedId) {
      var el2 = dbEditor.elements.find(function(e2) { return e2.id === dbEditor.selectedId; });
      if (!el2) return;

      if (!dbEditor._dragUndoPushed) {
        var ds = dbEditor._dragStartScreen;
        if (ds && (Math.abs(e.clientX - ds.x) > 2 || Math.abs(e.clientY - ds.y) > 2)) {
          dbEditor._dragUndoPushed = true;
          pushUndo();
        }
      }

      if (el2.type === 'arrow') {
        var ddx = mx - dbEditor.dragOffset.x;
        var ddy = my - dbEditor.dragOffset.y;
        el2.x1 = dbEditor.dragOffset.ox1 + ddx;
        el2.y1 = dbEditor.dragOffset.oy1 + ddy;
        el2.x2 = dbEditor.dragOffset.ox2 + ddx;
        el2.y2 = dbEditor.dragOffset.oy2 + ddy;
      } else {
        el2.x = Math.max(0, mx - dbEditor.dragOffset.x);
        el2.y = Math.max(0, my - dbEditor.dragOffset.y);
      }
      renderCanvas();
    }
  };

  window.canvasMouseUp = function(e) {
    dbUnbindDocPointerListeners();
    dbEditor.isDragging = false;
    dbEditor.isResizing = false;
    _arrowDragEl = null;
    _arrowDragEnd = null;
  };

  if (!window._dbDesignBoardBlurBound) {
    window._dbDesignBoardBlurBound = true;
    window.addEventListener('blur', function() {
      if (!dbEditor || !dbEditor.boardId) return;
      dbUnbindDocPointerListeners();
      dbEditor.isDragging = false;
      dbEditor.isResizing = false;
      _arrowDragEl = null;
      _arrowDragEnd = null;
    });
  }

  // ==================== DROP FROM CLIPS ====================
  // Handle drop on canvas wrap
  (function setupDrop() {
    // We need to add event listeners after the editor renders
    // Use a MutationObserver or just add listeners in renderBoardEditor
    document.addEventListener('dragover', function(e) {
      var wrap = document.getElementById('dbCanvasWrap');
      if (wrap && wrap.contains(e.target)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });
    document.addEventListener('drop', function(e) {
      var canvas = document.getElementById('dbCanvas');
      if (!canvas || !canvas.contains(e.target) && e.target !== canvas) {
        // Check if drop is on canvas wrap area
        var wrap = document.getElementById('dbCanvasWrap');
        if (!wrap || !wrap.contains(e.target)) return;
      }
      e.preventDefault();
      var clipId = e.dataTransfer.getData('text/plain');
      if (!clipId) return;

      var clip = dbEditor.clips.find(function(c) { return c.id === clipId; });
      if (!clip) return;

      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;

      pushUndo();
      var d = clip.data;
      var imgPack = (typeof window.cchProposalLineImagesFromSource === 'function')
        ? window.cchProposalLineImagesFromSource(d)
        : { images: [], imageUrl: '', heroImageIndex: 0 };
      var primaryImg = (typeof window.cchPickPreferredProductImageUrl === 'function')
        ? String(window.cchPickPreferredProductImageUrl(d) || '').trim()
        : '';
      if (!primaryImg) primaryImg = imgPack.imageUrl || _resolveImgSrc(String(d.imageUrl || '').trim()) || _firstCoercedGalleryUrl(d) || '';
      var w = 180, h = 180;
      var pos = findFreeCanvasDropPosition(w, h, mx, my);
      var newEl = {
        id: genId(),
        type: 'product',
        clipId: clipId,
        x: pos.x,
        y: pos.y,
        w: w,
        h: h,
        imageUrl: primaryImg,
        images: (imgPack.images && imgPack.images.length) ? imgPack.images.slice() : (primaryImg ? [primaryImg] : []),
        heroImageIndex: imgPack.heroImageIndex || 0,
        title: d.title || 'Untitled',
        vendor: d.vendor || '',
        cost: parseFloat(d.cost) || 0,
        sellPrice: parseFloat(d.clientPrice) || parseFloat(d.sellingPrice) || 0,
        showPrice: true,
        annotation: ''
      };
      dbEditor.elements.push(newEl);
      dbEditor.selectedId = newEl.id;
      renderCanvas();
      renderProps();
    });
  })();

  // ==================== PRICING & VIEW TOGGLE ====================
  window.toggleBoardPricing = function(show) {
    dbEditor.showPricing = show;
    renderCanvas();
  };

  window.toggleClientView = function() {
    dbEditor.clientView = !dbEditor.clientView;
    // Hide clips panel and props panel in client view
    var cp = document.getElementById('dbClipsPanel');
    var pp = document.getElementById('dbPropsPanel');
    if (cp) cp.style.display = dbEditor.clientView ? 'none' : 'block';
    if (pp) pp.style.display = dbEditor.clientView ? 'none' : 'block';
    renderBoardEditor();
  };

  /** Persist imageUrl/images on product tiles from clips so client board does not depend on a second fetch. */
  function enrichProductElementsFromClipsForSave() {
    if (!dbEditor.clips || !dbEditor.elements) return;
    dbEditor.elements.forEach(function(el) {
      if (!el || el.type !== 'product' || !el.clipId) return;
      var u = String(el.imageUrl || '').trim();
      if (typeof window.cchProductBoardImageIsLikelyValid === 'function' && window.cchProductBoardImageIsLikelyValid(u)) return;
      var clip = dbEditor.clips.find(function(c) { return c.id === el.clipId; });
      if (!clip || !clip.data) return;
      var d = clip.data;
      var imgPack = (typeof window.cchProposalLineImagesFromSource === 'function')
        ? window.cchProposalLineImagesFromSource(d)
        : { images: [], imageUrl: '', heroImageIndex: 0 };
      var primary = (typeof window.cchPickPreferredProductImageUrl === 'function')
        ? String(window.cchPickPreferredProductImageUrl(d) || '').trim()
        : '';
      if (!primary) primary = imgPack.imageUrl || _resolveImgSrc(String(d.imageUrl || '').trim()) || _firstCoercedGalleryUrl(d) || '';
      if (primary) {
        el.imageUrl = primary;
        if (imgPack.images && imgPack.images.length) el.images = imgPack.images.slice();
        else if (!el.images || !el.images.length) el.images = [primary];
        if (el.heroImageIndex == null && imgPack.heroImageIndex != null) el.heroImageIndex = imgPack.heroImageIndex;
      }
    });
  }

  // ==================== SAVE & EXPORT ====================
  window.saveBoardToFirestore = async function() {
    try {
      enrichProductElementsFromClipsForSave();
      var patch = {
        title: dbEditor.boardData.title || 'Untitled',
        name: dbEditor.boardData.title || dbEditor.boardData.name || 'Untitled',
        room: dbEditor.boardData.room || '',
        elements: dbEditor.elements,
        canvasWidth: dbEditor.boardData.canvasWidth || 1400,
        canvasHeight: dbEditor.boardData.canvasHeight || 1000,
        showPricing: dbEditor.showPricing,
        branding: dbEditor.boardData.branding !== false,
        updatedAt: new Date().toISOString()
      };
      if (dbEditor.boardData.coverImageUrl) patch.coverImageUrl = dbEditor.boardData.coverImageUrl;
      if (dbEditor.boardData.coverElementId) patch.coverElementId = dbEditor.boardData.coverElementId;
      await db.collection('boards').doc(dbEditor.projectId).collection('designBoards').doc(dbEditor.boardId).update(patch);
      dbEditor.dirty = false;
      // Flash save confirmation
      var btn = document.querySelector('[onclick="saveBoardToFirestore()"]');
      if (btn) {
        var orig = btn.textContent;
        btn.textContent = '✓ Saved';
        btn.style.background = 'var(--green)';
        setTimeout(function() { btn.textContent = orig; btn.style.background = ''; }, 1200);
      }
    } catch(e) {
      console.error('Save error:', e);
    }
  };

  window.exportBoardPNG = async function() {
    // Use html2canvas
    var canvas = document.getElementById('dbCanvas');
    if (!canvas) return;

    // Deselect first
    dbEditor.selectedId = null;
    renderCanvas();

    // Load html2canvas dynamically
    if (!window.html2canvas) {
      var script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      document.head.appendChild(script);
      await new Promise(function(resolve) { script.onload = resolve; });
    }

    try {
      var c = await html2canvas(canvas, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });
      var link = document.createElement('a');
      link.download = (dbEditor.boardData.title || 'design-board') + '.png';
      link.href = c.toDataURL('image/png');
      link.click();
    } catch(e) {
      if (typeof cchAlert === 'function') await cchAlert('Export error: ' + e.message + '\nTry right-clicking the board and using "Save as Image" instead.', 'Export');
      else alert('Export error: ' + e.message);
    }
  };

  // ==================== CREATE PROPOSAL FROM BOARD ====================
  window.openLuxuryClientView = async function() {
    // Save first
    await saveBoardToFirestore();
    window.location.hash = '#/clientboard/' + dbEditor.projectId + '/' + dbEditor.boardId;
  };

  window.addImageToBoard = async function() {
    if (typeof cchPrompt !== 'function') return;
    var url = await cchPrompt('Image URL (paste from browser or right-click > copy image address):', '', 'Add image');
    if (url === null) return;
    url = String(url || '').trim();
    if (!url) return;
    var titleOpt = await cchPrompt('Title (optional):', '', 'Image title');
    if (titleOpt === null) return;
    pushUndo();
    var newEl = {
      id: genId(),
      type: 'product',
      x: 100,
      y: 100,
      w: 250,
      h: 250,
      imageUrl: url,
      title: String(titleOpt || '').trim(),
      vendor: '',
      cost: 0,
      sellPrice: 0,
      showPrice: false,
      annotation: ''
    };
    dbEditor.elements.push(newEl);
    dbEditor.selectedId = newEl.id;
    renderCanvas();
    renderProps();
  };

  window.createProposalFromBoard = async function() {
    var products = dbEditor.elements.filter(function(el) { return el.type === 'product'; });
    if (products.length === 0) {
      if (typeof cchAlert === 'function') await cchAlert('No product items on this board yet.', 'Proposal');
      else alert('No product items on this board yet.');
      return;
    }
    if (typeof cchPrompt !== 'function') return;
    var defName = (dbEditor.boardData.title || dbEditor.boardData.name || 'Board') + ' - Proposal';
    var name = await cchPrompt('Proposal name:', defName, 'New proposal');
    if (name === null) return;
    name = String(name || '').trim();
    if (!name) return;

    // Save board first
    await saveBoardToFirestore();

    // Build proposal items from board products (carry clip / element gallery into proposal lines)
    var items = products.map(function(el) {
      var src = { imageUrl: el.imageUrl, images: el.images };
      if (el.clipId) {
        var clip = dbEditor.clips.find(function(c) { return c.id === el.clipId; });
        if (clip && clip.data) src = Object.assign({}, clip.data, src);
      }
      var pack = (typeof window.cchProposalLineImagesFromSource === 'function')
        ? window.cchProposalLineImagesFromSource(src)
        : { images: el.imageUrl ? [el.imageUrl] : [], imageUrl: el.imageUrl || '', heroImageIndex: 0 };
      return {
        title: el.title || 'Untitled',
        vendor: el.vendor || '',
        cost: el.cost || 0,
        sellingPrice: el.sellPrice || 0,
        clientPrice: el.sellPrice || 0,
        qty: 1,
        markupPct: el.cost > 0 ? Math.round(((el.sellPrice || 0) - el.cost) / el.cost * 100) : 0,
        imageUrl: pack.imageUrl || el.imageUrl || '',
        images: pack.images || [],
        heroImageIndex: pack.heroImageIndex || 0,
        clipId: el.clipId || '',
        lineApprovalStatus: 'pending'
      };
    });

    var total = items.reduce(function(s, i) { return s + (i.clientPrice || 0); }, 0);

    try {
      var doc = await db.collection('boards').doc(dbEditor.projectId).collection('proposals').add({
        name: name,
        items: items,
        total: total,
        status: 'Draft',
        designBoardId: dbEditor.boardId,
        createdAt: new Date().toISOString()
      });
      if (typeof cchAlert === 'function') await cchAlert('Proposal created with ' + items.length + ' items ($' + total.toLocaleString() + ').', 'Proposal');
      else alert('Proposal created with ' + items.length + ' items ($' + total.toLocaleString() + ')');
      navigate('#/project/' + dbEditor.projectId + '/proposal/' + doc.id);
    } catch(e) {
      if (typeof cchAlert === 'function') await cchAlert('Error creating proposal: ' + e.message, 'Proposal');
      else alert('Error creating proposal: ' + e.message);
    }
  };

  // ==================== CSS for editor ============================
  var style = document.createElement('style');
  style.textContent =
    '.db-board-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(10,31,61,0.08);}' +
    '.db-prop-input{width:100%;padding:4px 6px;border:1px solid var(--gray-200);border-radius:4px;font-size:12px;font-family:inherit;}' +
    '.db-prop-input:focus{border-color:var(--gold);outline:none;}' +
    '.db-el{transition:box-shadow 0.1s;}' +
    '.db-el:hover{box-shadow:0 0 0 1px rgba(196,160,82,0.3);}' +
    '#dbCanvas{font-family:"Cormorant Garamond",Georgia,serif;}' +
    '.db-clip-item{-webkit-user-drag:element;}';
  document.head.appendChild(style);

})();
