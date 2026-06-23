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
    clipRoom: 'All',
    clipListFilter: '',
    projectRooms: [],
    sourceTab: 'room', // room | ideabook | library
    ibImages: [],
    libItems: [],
    libItemsLoaded: false,
    libItemsLoading: false,
    selectedId: null,
    tool: 'select', // select, text, arrow, note, heading
    isDragging: false,
    isResizing: false,
    dragOffset: { x: 0, y: 0 },
    resizeDir: '',
    canvasScale: 1,
    viewZoomMode: 'fit', // fit | manual
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

  /** Flatten ideabook documents into draggable inspiration rows (matches index.html openDesignBoard). */
  function dbBuildIbImageList(ideabooks) {
    var out = [];
    var coerce = typeof window._coerceImageIterable === 'function' ? window._coerceImageIterable : function(v) {
      return Array.isArray(v) ? v : (v ? [v] : []);
    };
    var urlFrom = typeof window._ibImageUrlFromEntry === 'function'
      ? window._ibImageUrlFromEntry
      : function(img) {
        if (img == null) return '';
        if (typeof img === 'string') return String(img).trim();
        if (typeof img !== 'object') return '';
        return String(img.imageUrl || img.url || img.src || img.thumbnail || '').trim();
      };
    ideabooks.forEach(function(ib) {
      var d = ib.data || ib;
      var secName = String(d.name || d.title || 'Inspiration').trim();
      coerce(d.images).forEach(function(img) {
        var rawUrl = urlFrom(img);
        var normUrl = typeof window._resolveImgSrc === 'function'
          ? window._resolveImgSrc(String(rawUrl || '').trim())
          : String(rawUrl || '').trim();
        if (!normUrl) return;
        if (typeof img === 'string') {
          out.push({ imageUrl: normUrl, section: secName, ideabookId: ib.id, caption: '', vendor: '' });
        } else {
          out.push(Object.assign({}, img, {
            imageUrl: normUrl,
            section: secName,
            ideabookId: ib.id,
            caption: img.caption || img.title || '',
            vendor: img.vendor || ''
          }));
        }
      });
    });
    return out;
  }

  /** Legacy boards used type:image + img; canvas editor only painted type:product + imageUrl. */
  function dbNormalizeBoardElements(elements) {
    var changed = false;
    var out = (elements || []).map(function(el) {
      if (!el || typeof el !== 'object') return el;
      var e = Object.assign({}, el);
      if (!e.type && (e.img || e.imageUrl)) e.type = 'image';
      if (e.type === 'image' || (!e.type && (e.img || e.imageUrl))) {
        e.type = 'product';
        if (!e.imageUrl && e.img) e.imageUrl = e.img;
        if (e.w == null || e.w === undefined) e.w = 280;
        if (e.h == null || e.h === undefined) e.h = 280;
        changed = true;
      }
      if (e.type === 'product' && !e.imageUrl && e.img) {
        e.imageUrl = e.img;
        changed = true;
      }
      if ((e.type === 'text' || e.type === 'heading') && !e.text && e.title) {
        e.text = e.title;
      }
      return e;
    });
    return { elements: out, changed: changed };
  }

  function dbResolveProductImgSrc(el) {
    var raw = String((el && (el.imageUrl || el.img)) || '').trim();
    if (!raw) return '';
    if (typeof window._escImgSrcAttr === 'function') {
      var safe = window._escImgSrcAttr(raw);
      if (safe) return safe;
    }
    var resolved = typeof window._resolveImgSrc === 'function' ? window._resolveImgSrc(raw) : raw;
    return escAttr(resolved || raw);
  }

  function dbScrollCanvasToElement(el) {
    if (!el) return;
    var wrap = document.getElementById('dbCanvasWrap');
    if (!wrap) return;
    var z = dbEditor.canvasScale || 1;
    var x = (el.x || 0) * z;
    var y = (el.y || 0) * z;
    var w = (el.w || 200) * z;
    var h = (el.h || 200) * z;
    wrap.scrollLeft = Math.max(0, x - wrap.clientWidth / 2 + w / 2);
    wrap.scrollTop = Math.max(0, y - wrap.clientHeight / 2 + h / 2);
  }

  function dbApplyViewZoom() {
    var stage = document.getElementById('dbCanvasStage');
    var spacer = document.getElementById('dbCanvasSpacer');
    var label = document.getElementById('dbZoomLabel');
    var cw = dbEditor.boardData.canvasWidth || 1400;
    var ch = dbEditor.boardData.canvasHeight || 1000;
    var z = dbEditor.canvasScale || 1;
    if (stage) {
      stage.style.transform = 'scale(' + z + ')';
      stage.style.transformOrigin = 'top left';
      stage.style.width = cw + 'px';
      stage.style.height = ch + 'px';
    }
    if (spacer) {
      spacer.style.width = Math.ceil(cw * z + 40) + 'px';
      spacer.style.minHeight = Math.ceil(ch * z + 40) + 'px';
    }
    if (label) label.textContent = Math.round(z * 100) + '%';
  }

  function dbFitCanvasToView(forceFitMode) {
    var wrap = document.getElementById('dbCanvasWrap');
    if (!wrap) return;
    var cw = dbEditor.boardData.canvasWidth || 1400;
    var ch = dbEditor.boardData.canvasHeight || 1000;
    var pad = 48;
    var zW = (wrap.clientWidth - pad) / cw;
    var zH = (wrap.clientHeight - pad) / ch;
    var z = Math.min(zW, zH, 1);
    if (forceFitMode !== false) dbEditor.viewZoomMode = 'fit';
    dbEditor.canvasScale = Math.max(0.2, z);
    dbApplyViewZoom();
  }

  /** Size editor to visible viewport (staging banner + breadcrumbs + tabs eat space above content). */
  function dbSyncEditorShellHeight() {
    var root = document.getElementById('dbEditorRoot');
    if (!root) return;
    var top = root.getBoundingClientRect().top;
    var h = Math.max(320, Math.floor(window.innerHeight - top - 6));
    root.style.height = h + 'px';
    root.style.maxHeight = h + 'px';
  }

  function dbApplyClientViewLayout() {
    var cv = !!dbEditor.clientView;
    var cp = document.getElementById('dbClipsPanel');
    var pp = document.getElementById('dbPropsPanel');
    var root = document.getElementById('dbEditorRoot');
    if (cp) cp.style.display = cv ? 'none' : 'flex';
    if (pp) pp.style.display = cv ? 'none' : 'block';
    if (root) root.classList.toggle('db-editor-client-view', cv);
    var cvBtn = document.querySelector('#dbToolbar button[onclick="toggleClientView()"]');
    if (cvBtn) {
      cvBtn.textContent = cv ? '👁 Client view: ON' : '👁 Client view';
      cvBtn.style.background = cv ? '#0A1F3D' : '';
      cvBtn.style.color = cv ? '#fff' : '';
      cvBtn.style.borderColor = cv ? '#0A1F3D' : '';
    }
    dbRefreshAllPricingVisibility();
    dbSyncEditorShellHeight();
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        if (cv) {
          dbFitCanvasToView(true);
        } else {
          dbApplyViewZoom();
          if (dbEditor.viewZoomMode === 'fit') dbFitCanvasToView(false);
        }
      });
    });
  }

  window.dbSetViewZoom = function(z) {
    dbEditor.viewZoomMode = 'manual';
    dbEditor.canvasScale = Math.max(0.2, Math.min(2, z));
    dbApplyViewZoom();
  };
  window.dbZoomFit = function() { dbFitCanvasToView(); };
  window.dbZoom100 = function() { window.dbSetViewZoom(1); };
  window.dbZoomIn = function() { window.dbSetViewZoom((dbEditor.canvasScale || 1) + 0.1); };
  window.dbZoomOut = function() { window.dbSetViewZoom((dbEditor.canvasScale || 1) - 0.1); };

  var _dbViewResizeTimer = null;
  if (!window._dbViewResizeBound) {
    window._dbViewResizeBound = true;
    window.addEventListener('resize', function() {
      if (!document.getElementById('dbCanvas')) return;
      clearTimeout(_dbViewResizeTimer);
      _dbViewResizeTimer = setTimeout(function() {
        dbSyncEditorShellHeight();
        if (dbEditor.clientView || dbEditor.viewZoomMode === 'fit') dbFitCanvasToView(!dbEditor.clientView);
        else dbApplyViewZoom();
      }, 120);
    });
  }

  function dbClipSidebarImg(d) {
    if (!d) return '';
    if (typeof window.libraryListThumbUrl === 'function') {
      var libU = window.libraryListThumbUrl(d);
      if (libU) return libU;
    }
    if (typeof window.getProductImg === 'function') {
      var g = window.getProductImg(d);
      if (g) return g;
    }
    var raw = String(d.imageUrl || d.image || d.img || d.thumbnail || '').trim();
    return (typeof window._resolveImgSrc === 'function'
      ? (window._resolveImgSrc(raw) || raw)
      : raw) || (typeof window._firstCoercedGalleryUrl === 'function' ? window._firstCoercedGalleryUrl(d) : '') || '';
  }

  function dbSidebarImgSrcAttr(url) {
    var raw = String(url || '').trim();
    if (!raw) return '';
    if (typeof window._escImgSrcAttr === 'function') {
      var strict = window._escImgSrcAttr(raw);
      if (strict) return strict;
    }
    var resolved = typeof window._resolveImgSrc === 'function' ? (window._resolveImgSrc(raw) || raw) : raw;
    if (/^https?:\/\//i.test(resolved) || resolved.indexOf('//') === 0 || /^data:image/i.test(resolved)) {
      return typeof escAttr === 'function' ? escAttr(resolved) : resolved;
    }
    return '';
  }

  /** Studio stores some boards as `name` (index.html) and canvas editor as `title` — keep both in sync. */
  function _dbBoardDisplayName(d) {
    d = d || {};
    var t = String(d.title || d.name || '').trim();
    return t || 'Untitled Board';
  }

  /** Room or board title for print footnotes / cost summary. */
  function _dbBoardLabel(d) {
    d = d || {};
    var room = String(d.room || '').trim();
    if (room) return room;
    return _dbBoardDisplayName(d);
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
            '<div style="position:relative;cursor:pointer;aspect-ratio:4/3;width:100%;background:' + (thumb ? 'url(' + esc(thumb) + ') center/cover' : 'linear-gradient(135deg,#f5f0e8,#e8e0d0)') + ';display:flex;align-items:center;justify-content:center;" onclick="openDesignBoard(\'' + proj.id + '\',\'' + b.id + '\')">' +
            (thumb ? '' : '<span style="font-size:48px;opacity:0.3;">🎨</span>') +
            '<button type="button" class="btn btn-secondary btn-sm" title="Change grid thumbnail" style="position:absolute;bottom:8px;right:8px;font-size:10px;padding:4px 10px;background:rgba(255,255,255,0.92);border:1px solid rgba(15,26,46,0.15);box-shadow:0 2px 8px rgba(0,0,0,0.12);" onclick="event.stopPropagation();void dbPickBoardCover(\'' + proj.id + '\',\'' + b.id + '\',\'' + escJsStr(nm) + '\')">📷 Cover</button>' +
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

  function dbElementCoverThumb(el) {
    if (!el) return '';
    return String(el.imageUrl || el.img || '').trim();
  }

  window.dbApplyBoardCover = async function(projectId, boardId, elementId, imageUrl) {
    imageUrl = String(imageUrl || '').trim();
    if (!imageUrl) return;
    try {
      await db.collection('boards').doc(projectId).collection('designBoards').doc(boardId).update({
        coverImageUrl: imageUrl,
        coverElementId: elementId || null,
        updatedAt: new Date().toISOString()
      });
      var modal = document.getElementById('dbCoverPickerModal');
      if (modal) modal.remove();
      if (typeof showToast === 'function') showToast('Cover photo updated', 'success');
      if (typeof renderProjectDetail === 'function') renderProjectDetail();
    } catch (err) {
      if (typeof cchAlert === 'function') await cchAlert((err && err.message) || 'Could not save cover', 'Board cover');
    }
  };

  window.dbPickBoardCover = async function(projectId, boardId, boardTitle) {
    boardTitle = String(boardTitle || 'Design board').trim();
    try {
      var snap = await db.collection('boards').doc(projectId).collection('designBoards').doc(boardId).get();
      if (!snap.exists) {
        if (typeof cchAlert === 'function') await cchAlert('Board not found.', 'Board cover');
        return;
      }
      var data = snap.data() || {};
      var picks = [];
      (data.elements || []).forEach(function(el) {
        if (!el || (el.type !== 'product' && el.type !== 'image')) return;
        var url = dbElementCoverThumb(el);
        if (!url) return;
        picks.push({ id: el.id, url: url, title: dbBoardDisplayTitle(el.title) || 'Item' });
      });
      if (!picks.length) {
        if (typeof cchAlert === 'function') {
          await cchAlert('This board has no product images yet. Open the board, add a fixture image, then set the cover.', 'Board cover');
        }
        return;
      }
      var currentCover = String(data.coverImageUrl || '').trim();
      var tiles = picks.map(function(p) {
        var isCurrent = currentCover && currentCover === p.url;
        return '<button type="button" style="border:2px solid ' + (isCurrent ? 'var(--gold)' : 'transparent') + ';border-radius:4px;padding:0;background:#fff;cursor:pointer;overflow:hidden;text-align:left;" onclick="void dbApplyBoardCover(\'' + escJsStr(projectId) + '\',\'' + escJsStr(boardId) + '\',\'' + escJsStr(p.id) + '\',\'' + escJsStr(p.url) + '\')">' +
          '<div style="aspect-ratio:1;width:100%;background:url(' + escAttr(p.url) + ') center/cover;"></div>' +
          '<div style="font-size:10px;padding:6px 8px;color:#5C6B80;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(p.title) + (isCurrent ? ' · current' : '') + '</div>' +
        '</button>';
      }).join('');
      var html = '<div id="dbCoverPickerModal" style="position:fixed;inset:0;background:rgba(15,26,46,0.45);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target===this)this.remove()">' +
        '<div style="background:#fff;max-width:720px;width:100%;padding:24px;border-radius:4px;box-shadow:0 16px 48px rgba(0,0,0,0.2);max-height:90vh;overflow:auto;" onclick="event.stopPropagation()">' +
        '<h3 style="margin:0 0 6px;font-size:18px;">Grid cover photo</h3>' +
        '<p style="font-size:12px;color:#5C6B80;margin:0 0 16px;line-height:1.5;">Choose which image shows on the <strong>Design Boards</strong> tab for <strong>' + esc(boardTitle) + '</strong>. This does not change the board layout.</p>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;">' + tiles + '</div>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:16px;">' +
          '<button type="button" class="btn btn-secondary" onclick="document.getElementById(\'dbCoverPickerModal\').remove()">Cancel</button>' +
        '</div></div></div>';
      var old = document.getElementById('dbCoverPickerModal');
      if (old) old.remove();
      document.body.insertAdjacentHTML('beforeend', html);
    } catch (err) {
      if (typeof cchAlert === 'function') await cchAlert((err && err.message) || 'Could not load board', 'Board cover');
    }
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

  // dbResetBoardInteraction — defined at end of file (after drag helpers).

  window.openDesignBoard = async function(projectId, boardId, forceReload) {
    if (!forceReload && dbEditor.boardId === boardId && dbEditor.projectId === projectId && document.getElementById('dbCanvas')) {
      dbCancelActiveDrag();
      dbClearAllDragTransforms();
      dbEditor.isDragging = false;
      dbEditor.isResizing = false;
      return;
    }
    window._cchDesignBoardEditorActive = true;
    var contentEl = document.getElementById('contentArea');
    if (contentEl) {
      contentEl.innerHTML = '<div style="text-align:center;padding:80px;color:var(--gray-400)">Loading design board...</div>';
    }
    try {
    dbCancelActiveDrag();
    dbEditor.isDragging = false;
    dbEditor.isResizing = false;
    dbEditor.arrowStart = null;
    if (typeof window.closeModal === 'function') window.closeModal();
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
    var norm = dbNormalizeBoardElements(dbEditor.boardData.elements || []);
    dbEditor.elements = norm.elements.map(function(el) { return Object.assign({}, el); });
    if (norm.changed) dbEditor.dirty = true;
    dbEditor.showPricing = dbEditor.boardData.showPricing !== false;
    dbEditor.clientView = false;
    dbEditor.canvasScale = 1;
    dbEditor.viewZoomMode = 'fit';
    dbEditor.nextId = dbEditor.elements.length + 1;
    dbEditor.clipCategory = 'All';
    dbEditor.clipRoom = 'All';
    dbEditor.clipListFilter = '';
    dbEditor.projectRooms = [];
    dbEditor.sourceTab = 'room';
    dbEditor.ibImages = [];
    dbEditor.libItems = [];
    dbEditor.libItemsLoaded = false;
    dbEditor.libItemsLoading = false;

    // Load clips + inspiration first (fast path); library deferred until Library tab
    dbEditor.clips = [];
    var rmSnap = { docs: [] };
    try {
      var loads = await Promise.all([
        db.collection('boards').doc(projectId).collection('clips').get(),
        db.collection('boards').doc(projectId).collection('ideabooks').get(),
        db.collection('boards').doc(projectId).collection('roomMeta').get().catch(function() { return { docs: [] }; })
      ]);
      loads[0].forEach(function(d) { dbEditor.clips.push({ id: d.id, data: d.data() }); });
      var ideabooks = [];
      loads[1].forEach(function(d) { ideabooks.push({ id: d.id, data: d.data() }); });
      dbEditor.ibImages = dbBuildIbImageList(ideabooks);
      rmSnap = loads[2];
    } catch(e) {
      console.warn('[design board] load sources:', e);
      try {
        var cs2 = await db.collection('boards').doc(projectId).collection('clips').get();
        cs2.forEach(function(d) { dbEditor.clips.push({ id: d.id, data: d.data() }); });
      } catch(e2) {}
    }
    var roomSet = {};
    dbEditor.clips.forEach(function(c) {
      var rm = String((c.data && c.data.room) || '').trim();
      if (rm) roomSet[rm.toLowerCase()] = rm;
    });
    try {
      (rmSnap.docs || []).forEach(function(d) {
        var nm = String((d.data() && d.data().name) || '').trim();
        if (nm) roomSet[nm.toLowerCase()] = nm;
      });
    } catch(e) {}
    dbEditor.projectRooms = Object.keys(roomSet).map(function(k) { return roomSet[k]; }).sort(function(a, b) {
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
    // Default All rooms so boards named "Showroom" do not hide every clip (clip.room often unset).
    dbEditor.clipRoom = 'All';

    // Fix in-memory tiles that still point at app-root junk (e.g. …/68.jpeg 404s) using clip + gallery pickers
    try {
      if (hydrateProductTileUrlsFromClips()) {
        dbEditor.dirty = true;
        if (typeof showToast === 'function') {
          showToast('Product image links were corrected from clips — click Save to update the client portal.', 6000);
        }
      }
    } catch (_hydrErr) { console.warn('[design board] hydrate tiles:', _hydrErr); }
    try {
      if (hydrateProductTilePricesFromClips()) {
        dbEditor.dirty = true;
        if (typeof showToast === 'function') {
          showToast('Cost / price filled in from clips on this board — click Save to keep them.', 5000);
        }
      }
    } catch (_priceErr) { console.warn('[design board] hydrate prices:', _priceErr); }

    // Render full editor (product library loads only when Library tab is opened)
    renderBoardEditor();
    if (norm.changed) autoSave();
    } catch (err) {
      console.error('[design board] open failed:', err);
      if (contentEl) {
        contentEl.innerHTML = '<div style="padding:60px;text-align:center;max-width:480px;margin:0 auto;">' +
          '<div style="font-size:16px;font-weight:600;color:#b91c1c;margin-bottom:8px;">Could not open design board</div>' +
          '<div style="font-size:13px;color:#666;line-height:1.5;">' + esc(String(err && err.message || err || 'Unknown error')) + '</div>' +
          '<button class="btn btn-secondary btn-sm" style="margin-top:16px;" onclick="navigate(\'#/project/' + escAttr(projectId) + '/designboards\')">← Back to Design Boards</button></div>';
      }
    }
  };

  /** Deferred product-library fetch — was blocking every board open with 12k Firestore reads. */
  async function dbLoadLibraryItems() {
    if (dbEditor.libItemsLoaded || dbEditor.libItemsLoading) return;
    dbEditor.libItemsLoading = true;
    try {
      if (typeof libraryProducts !== 'undefined' && libraryProducts && libraryProducts.length > 100) {
        dbEditor.libItems = libraryProducts.map(function(p) { return { id: p.id, data: p }; });
      } else {
        var mergeMap = {};
        var snaps = await Promise.all([
          db.collection('productLibrary').limit(2000).get().catch(function() { return { docs: [] }; }),
          db.collection('products').limit(2000).get().catch(function() { return { docs: [] }; })
        ]);
        if (typeof _libIngestSnapIntoMap === 'function') {
          _libIngestSnapIntoMap(mergeMap, snaps[0]);
          _libIngestSnapIntoMap(mergeMap, snaps[1]);
          dbEditor.libItems = Object.keys(mergeMap).map(function(k) {
            var row = mergeMap[k];
            return { id: row.id || k, data: row };
          });
        } else {
          var out = [];
          (snaps[0].docs || []).forEach(function(d) { out.push({ id: d.id, data: d.data() }); });
          (snaps[1].docs || []).forEach(function(d) {
            if (!out.some(function(x) { return x.id === d.id; })) out.push({ id: d.id, data: d.data() });
          });
          dbEditor.libItems = out;
        }
      }
      dbEditor.libItemsLoaded = true;
    } catch (eLib) {
      console.warn('[design board] library load:', eLib);
    } finally {
      dbEditor.libItemsLoading = false;
      if (dbEditor.sourceTab === 'library') {
        var inp = document.getElementById('dbClipFilterInput');
        renderClipsList(inp ? inp.value : '');
      }
    }
  }

  /** Replace weak imageUrl on product tiles (same-origin single-segment 404s) using cchPickPreferredProductImageUrl + clip merge. */
  function hydrateProductTileUrlsFromClips() {
    if (!dbEditor.elements || !dbEditor.elements.length || typeof window.cchPickPreferredProductImageUrl !== 'function') return false;
    var byId = {};
    (dbEditor.clips || []).forEach(function(c) { if (c && c.id) byId[c.id] = c.data || {}; });
    var changed = false;
    dbEditor.elements.forEach(function(el) {
      if (!el || el.type !== 'product') return;
      if (el._boardImageOverride) return;
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

  /** Fill-empty-only: backfill cost / sellPrice on product tiles from their linked clip.
   *  Never overwrites a non-zero hand-set value (respects re-import guard). */
  function hydrateProductTilePricesFromClips() {
    if (!dbEditor.elements || !dbEditor.elements.length) return false;
    var byId = {};
    (dbEditor.clips || []).forEach(function(c) { if (c && c.id) byId[c.id] = c.data || {}; });
    var changed = false;
    dbEditor.elements.forEach(function(el) {
      if (!el || (el.type !== 'product' && el.type !== 'image')) return;
      if (!el.clipId || !byId[el.clipId]) return;
      var d = byId[el.clipId];
      if ((el.cost == null || +el.cost === 0)) {
        var c = parseFloat(d.cost) || 0;
        if (c > 0) { el.cost = c; changed = true; }
      }
      if ((el.sellPrice == null || +el.sellPrice === 0)) {
        var s = parseFloat(d.clientPrice) || parseFloat(d.sellingPrice) || 0;
        if (s > 0) { el.sellPrice = s; changed = true; }
      }
    });
    return changed;
  }

  // ==================== RENDER BOARD EDITOR ====================
  function renderBoardEditor() {
    var C = document.getElementById('contentArea');
    if (!C) return;
    dbCancelActiveDrag();
    dbEditor.isDragging = false;
    dbEditor.isResizing = false;
    var bd = dbEditor.boardData;
    var cw = bd.canvasWidth || 1400;
    var ch = bd.canvasHeight || 1000;

    C.innerHTML =
      '<div id="dbEditorRoot"' + (dbEditor.clientView ? ' class="db-editor-client-view"' : '') + ' style="display:flex;flex-direction:column;min-height:420px;overflow:hidden;">' +
      '<style>' +
      '#dbToolbar .db-tool-btn{font-family:DM Sans,system-ui,sans-serif!important;font-size:12px!important;font-weight:600!important;padding:8px 12px!important;border-radius:6px!important;cursor:pointer!important;letter-spacing:0.02em!important;border:1px solid rgba(27,51,82,0.32)!important;background:#fff!important;color:#0a1628!important;box-shadow:0 1px 2px rgba(27,51,82,0.08)!important;line-height:1.2!important;}' +
      '#dbToolbar .db-tool-btn:hover{border-color:#C4A464!important;color:#1B3352!important;background:#fffdf6!important;}' +
      '#dbToolbar .db-tool-btn--active{background:linear-gradient(180deg,#d4b76e,#c4a464)!important;color:#1a1204!important;border-color:#8a7030!important;box-shadow:inset 0 1px 0 rgba(255,255,255,0.35),0 1px 2px rgba(0,0,0,0.08)!important;}' +
      '#dbToolbar .db-toolbar-hint{font-size:11px!important;color:#2c3d5e!important;font-weight:500!important;max-width:240px!important;line-height:1.4!important;}' +
      '#dbToolbar .db-toolbar-hint strong{color:#0a1628!important;font-weight:700!important;}' +
      '#dbEditorRoot.db-editor-client-view .db-toolbar-edit-only{display:none!important;}' +
      '#dbEditorRoot.db-editor-client-view .db-el-product{pointer-events:none!important;cursor:default!important;}' +
      '#dbEditorRoot.db-editor-client-view .db-resize{display:none!important;}' +
      '#dbEditorRoot.db-editor-client-view #dbCanvasWrap,#dbEditorRoot.db-editor-client-view #dbCanvas,#dbEditorRoot.db-editor-client-view #dbCanvasStage{touch-action:pan-x pan-y!important;}' +
      '#dbCanvas,#dbCanvasStage{touch-action:none;}' +
      '.db-el-product{box-sizing:border-box;pointer-events:auto;cursor:move;}' +
      '.db-el-media{position:relative;box-sizing:border-box;background:#fff;border:1px solid rgba(15,26,46,0.06);border-radius:2px;overflow:hidden;padding:0;pointer-events:none;}' +
      '.db-el-media img{width:100%;height:100%;object-fit:cover;object-position:center;display:block;pointer-events:none;}' +
      '.db-el-caption{margin-top:5px;font-size:14px;font-weight:600;color:#1B3352;text-align:center;pointer-events:none;line-height:1.3;}' +
      '.db-el-desc{margin-top:3px;font-size:12px;color:#4B5563;text-align:center;pointer-events:none;line-height:1.4;white-space:pre-wrap;}' +
      '.db-el-price{margin-top:3px;font-size:14px;font-weight:700;color:#0A1F3D;text-align:center;pointer-events:none;line-height:1.25;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}' +
      '.db-el-annotation{margin-top:4px;font-size:12px;color:#6B7280;text-align:center;font-style:italic;pointer-events:none;white-space:pre-line;line-height:1.35;}' +
      '.db-resize{position:absolute;width:12px;height:12px;background:var(--gold);border:2px solid #fff;border-radius:2px;z-index:20;box-shadow:0 1px 3px rgba(0,0,0,0.2);pointer-events:auto;}' +
      '.db-source-tab{flex:1;padding:8px 4px;font-size:10px;font-weight:600;border:none;background:transparent;color:#6b7280;cursor:pointer;border-bottom:2px solid transparent;}' +
      '.db-source-tab:hover{color:#1B3352;}' +
      '.db-source-tab--active{color:#1B3352;border-bottom-color:#C4A464;}' +
      '</style>' +
      // Top toolbar
      '<div id="dbToolbar" style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--gray-200);margin-bottom:0;flex-wrap:wrap;">' +
        '<button class="btn btn-secondary btn-sm" onclick="closeBoardEditor()" style="margin-right:8px;">← Back</button>' +
        '<span style="font-weight:700;font-size:15px;margin-right:16px;color:#1B3352;" id="dbTitle">' + esc(_dbBoardDisplayName(bd)) + '</span>' +
        '<div class="db-toolbar-edit-only" style="display:flex;gap:6px;padding:6px;background:#eef2f7;border-radius:8px;flex-wrap:wrap;align-items:center;border:1px solid rgba(27,51,82,0.1);">' +
          toolBtn('select', '↖', 'Select') +
          toolBtn('text', 'T', 'Text') +
          toolBtn('heading', 'H', 'Heading') +
          toolBtn('arrow', '→', 'Arrow') +
          toolBtn('note', '📝', 'Note') +
        '</div>' +
        '<span class="db-toolbar-hint db-toolbar-edit-only">Choose <strong>Text</strong> or <strong>Heading</strong>, then click on the board to place.</span>' +
        '<button class="btn btn-secondary btn-sm db-toolbar-edit-only" onclick="void addImageFromComputer()">📁 From computer</button>' +
        '<button class="btn btn-secondary btn-sm db-toolbar-edit-only" onclick="void addImageToBoard()" title="Paste image URL">🔗 Image URL</button>' +
        '<div style="display:flex;align-items:center;gap:2px;padding:2px 6px;background:#eef2f7;border-radius:6px;border:1px solid rgba(27,51,82,0.1);">' +
          '<button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:14px;line-height:1;" onclick="dbZoomOut()" title="Zoom out">−</button>' +
          '<span id="dbZoomLabel" style="font-size:11px;font-weight:600;min-width:38px;text-align:center;color:#1B3352;">100%</span>' +
          '<button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:14px;line-height:1;" onclick="dbZoomIn()" title="Zoom in">+</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:10px;margin-left:2px;" onclick="dbZoomFit()" title="Fit board to window (like Canva)">Fit</button>' +
        '</div>' +
        '<div style="flex:1;"></div>' +
        '<label class="db-toolbar-edit-only" style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" ' + (dbEditor.showPricing ? 'checked' : '') + ' onchange="toggleBoardPricing(this.checked)"> Show Pricing</label>' +
        '<button class="btn btn-secondary btn-sm" onclick="toggleClientView()" style="' + (dbEditor.clientView ? 'background:#0A1F3D;color:#fff;border-color:#0A1F3D;' : '') + '">' + (dbEditor.clientView ? '👁 Client view: ON' : '👁 Client view') + '</button>' +
        '<button class="btn btn-secondary btn-sm" onclick="openLuxuryClientView()">🖤 Share with Client</button>' +
        '<button class="btn btn-secondary btn-sm db-toolbar-edit-only" onclick="dbUndo()">↩ Undo</button>' +
        '<button type="button" id="dbUnstickToolbarBtn" class="btn btn-secondary btn-sm db-toolbar-edit-only" title="Unstick drag, remove ghost tiles, spread stacked items — does not delete your work" onclick="void dbRepairBoard()">🔧 Repair board</button>' +
        '<span id="dbUnstickStatus" class="db-toolbar-edit-only" style="font-size:10px;color:var(--gray-500);min-width:72px;"></span>' +
        '<button class="btn btn-secondary btn-sm db-toolbar-edit-only" onclick="dbOpenPrintMenu()">🖨 Print / Export</button>' +
        '<button class="btn btn-secondary btn-sm db-toolbar-edit-only" onclick="showBoardCostSummary()">💲 Summary</button>' +
        '<button class="btn btn-secondary btn-sm db-toolbar-edit-only" onclick="createProposalFromBoard()">📋 → Proposal</button>' +
        '<button class="btn btn-primary btn-sm db-toolbar-edit-only" onclick="saveBoardToFirestore()">💾 Save</button>' +
      '</div>' +

      // Main layout: clips panel + canvas + props panel
      '<div style="display:flex;gap:0;flex:1;min-height:0;">' +
        // Left: Clips panel
        '<div id="dbClipsPanel" style="width:240px;min-width:240px;border-right:1px solid var(--gray-200);overflow-y:auto;padding:0;background:#fafaf8;display:flex;flex-direction:column;">' +
          '<div style="display:flex;border-bottom:1px solid var(--gray-200);flex-shrink:0;">' +
            '<button type="button" class="db-source-tab' + (dbEditor.sourceTab === 'room' ? ' db-source-tab--active' : '') + '" data-tab="room" onclick="dbSwitchSourceTab(\'room\')">Room</button>' +
            '<button type="button" class="db-source-tab' + (dbEditor.sourceTab === 'ideabook' ? ' db-source-tab--active' : '') + '" data-tab="ideabook" onclick="dbSwitchSourceTab(\'ideabook\')">Inspiration</button>' +
            '<button type="button" class="db-source-tab' + (dbEditor.sourceTab === 'library' ? ' db-source-tab--active' : '') + '" data-tab="library" onclick="dbSwitchSourceTab(\'library\')">Library</button>' +
          '</div>' +
          '<div style="padding:10px 12px;flex:1;overflow-y:auto;">' +
            '<div id="dbClipRoomWrap">' +
              '<label style="font-size:10px;color:var(--gray-500);display:block;margin-bottom:4px;">Room</label>' +
              '<select id="dbClipRoomSel" style="width:100%;padding:6px 8px;border:1px solid var(--gray-200);border-radius:4px;font-size:12px;margin-bottom:8px;background:#fff;box-sizing:border-box;" onchange="setBoardClipRoom(this.value)"></select>' +
            '</div>' +
            '<div id="dbClipCatWrap">' +
              '<label style="font-size:10px;color:var(--gray-500);display:block;margin-bottom:4px;">Category</label>' +
              '<select id="dbClipCatSel" style="width:100%;padding:6px 8px;border:1px solid var(--gray-200);border-radius:4px;font-size:12px;margin-bottom:8px;background:#fff;box-sizing:border-box;" onchange="setBoardClipCategory(this.value)"></select>' +
            '</div>' +
            '<input id="dbClipFilterInput" type="text" placeholder="Filter items..." style="width:100%;padding:6px 8px;border:1px solid var(--gray-200);border-radius:4px;font-size:12px;margin-bottom:8px;box-sizing:border-box;" oninput="filterBoardClips(this.value)">' +
            '<div style="font-size:10px;color:var(--gray-400);margin-bottom:6px;line-height:1.35;">Drag onto canvas or double-click to add.</div>' +
            '<div id="dbClipsList"></div>' +
          '</div>' +
        '</div>' +

        // Center: Canvas
        '<div id="dbCanvasWrap" style="flex:1;min-width:0;overflow:auto;background:#f4f4f5;position:relative;cursor:default;touch-action:none;" onpointerdown="canvasMouseDown(event)" ondragenter="dbCanvasDragOver(event)" ondragover="dbCanvasDragOver(event)" ondragleave="dbCanvasDragLeave(event)" ondrop="dbCanvasFileDrop(event)">' +
          '<div id="dbCanvasSpacer" style="margin:20px auto;position:relative;">' +
            '<div id="dbCanvasStage">' +
              '<div id="dbCanvasDropHint" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;color:#888;font-size:13px;text-align:center;z-index:2;max-width:320px;line-height:1.5;display:none;">Drop images here from your computer<br><span style="font-size:11px;">or drag clips from Project Items</span></div>' +
              '<div id="dbCanvas" style="position:relative;width:' + cw + 'px;height:' + ch + 'px;background:#ffffff;box-shadow:0 4px 24px rgba(0,0,0,0.12);overflow:hidden;" ondragenter="dbCanvasDragOver(event)" ondragover="dbCanvasDragOver(event)" ondrop="dbCanvasFileDrop(event)">' +
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
          '</div>' +
        '</div>' +

        // Right: Properties panel
        '<div id="dbPropsPanel" style="width:240px;min-width:240px;border-left:1px solid var(--gray-200);overflow-y:auto;padding:12px;background:#fafaf8;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;">' +
            '<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:var(--gray-400);font-weight:600;">Properties</div>' +
            '<button type="button" id="dbUnstickPropsBtn" class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:10px;line-height:1.2;" title="Unstick drag and spread stacked tiles" onclick="void dbRepairBoard()">Repair</button>' +
          '</div>' +
          '<div id="dbPropsContent"><div style="color:var(--gray-400);font-size:12px;padding:20px 0;text-align:center;">Select an element<br>or drag a clip onto the canvas</div></div>' +
        '</div>' +
      '</div>' +
      '</div>';

    populateClipCategorySelect();
    populateClipRoomSelect();
    dbUpdateSourceTabFilters();
    var _fi = document.getElementById('dbClipFilterInput');
    if (_fi) _fi.value = dbEditor.clipListFilter || '';
    renderClipsList(dbEditor.clipListFilter || '');
    renderCanvas();
    renderProps();
    dbUpdateCanvasDropHint();
    dbApplyViewZoom();
    dbSyncEditorShellHeight();
    dbApplyClientViewLayout();
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        dbSyncEditorShellHeight();
        if (!dbEditor.clientView && dbEditor.viewZoomMode === 'fit') dbFitCanvasToView(false);
      });
    });
    dbWireUnstickButtons();

    var overlapPairs = dbCountOverlappingTiles();
    if (overlapPairs > 0) dbShowOverlapBanner(overlapPairs);

    // Keyboard handler
    document.onkeydown = function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;
      if (e.key === 'Delete') { deleteSelected(); e.preventDefault(); }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { dbUndo(); e.preventDefault(); }
      if (e.key === 'Escape') { dbResetBoardInteraction(); e.preventDefault(); }
    };
  }

  function toolBtn(tool, icon, label) {
    var active = dbEditor.tool === tool;
    return '<button type="button" class="db-tool-btn' + (active ? ' db-tool-btn--active' : '') + '" data-tool="' + tool + '" onclick="setDBTool(\'' + tool + '\')" title="' + escAttr(label) + '">' +
      '<span style="font-weight:800;font-size:13px;margin-right:5px;opacity:0.95;">' + esc(icon) + '</span><span>' + esc(label) + '</span></button>';
  }

  function refreshDbToolbarTools() {
    var tb = document.getElementById('dbToolbar');
    if (!tb) return;
    tb.querySelectorAll('.db-tool-btn[data-tool]').forEach(function(btn) {
      var t = btn.getAttribute('data-tool');
      btn.classList.toggle('db-tool-btn--active', dbEditor.tool === t);
    });
    var wrap = document.getElementById('dbCanvasWrap');
    if (wrap) {
      if (dbEditor.tool === 'text' || dbEditor.tool === 'heading' || dbEditor.tool === 'note' || dbEditor.tool === 'arrow') wrap.style.cursor = 'crosshair';
      else wrap.style.cursor = 'default';
    }
  }

  window.setDBTool = function(tool) {
    dbEditor.tool = tool;
    dbEditor.arrowStart = null;
    refreshDbToolbarTools();
  };

  window.closeBoardEditor = function() {
    var pid = dbEditor.projectId;
    window._cchDesignBoardEditorActive = false;
    if (dbEditor.dirty) saveBoardToFirestore();
    if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
    dbCancelActiveDrag();
    dbEditor.boardId = null;
    dbEditor.projectId = null;
    dbEditor.isDragging = false;
    dbEditor.isResizing = false;
    document.onkeydown = null;
    if (pid) navigate('#/project/' + pid + '/designboards');
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

  function clipRoomOptions() {
    return ['All'].concat(dbEditor.projectRooms || []);
  }

  function populateClipRoomSelect() {
    var sel = document.getElementById('dbClipRoomSel');
    if (!sel) return;
    var rooms = clipRoomOptions();
    var cur = dbEditor.clipRoom || 'All';
    sel.innerHTML = rooms.map(function(r) {
      return '<option value="' + escAttr(r) + '"' + (cur === r ? ' selected' : '') + '>' + esc(r === 'All' ? 'All rooms' : r) + '</option>';
    }).join('');
  }

  window.setBoardClipRoom = function(val) {
    dbEditor.clipRoom = val || 'All';
    var inp = document.getElementById('dbClipFilterInput');
    renderClipsList(inp ? inp.value : '');
  };

  function clipMatchesRoom(d, roomF) {
    if (!roomF || roomF === 'All') return true;
    var cr = String((d && d.room) || '').trim();
    return cr.toLowerCase() === String(roomF).trim().toLowerCase();
  }

  /** Place at cursor — freeform like Canva; overlap allowed. */
  function dbDropPointFromCursor(w, h, preferX, preferY) {
    return {
      x: Math.max(0, preferX - w / 2),
      y: Math.max(0, preferY - h / 2)
    };
  }

  /** Nudge x,y so a new w×h box avoids overlapping existing product tiles (reduces stuck stacks). */
  function dbFindFreeDropPosition(w, h, preferX, preferY) {
    var maxH = (dbEditor.boardData && dbEditor.boardData.canvasHeight) || 1000;
    var maxW = (dbEditor.boardData && dbEditor.boardData.canvasWidth) || 1400;
    var els = (dbEditor.elements || []).filter(function(e) {
      return e && (e.type === 'product' || e.type === 'image') && e.w != null && e.h != null;
    });
    var x = Math.max(20, preferX - w / 2);
    var y = Math.max(20, preferY - h / 2);
    function hits(ex, ey) {
      return els.some(function(o) {
        return !(ex + w < o.x - 8 || ex > o.x + o.w + 8 || ey + h < o.y - 8 || ey > o.y + o.h + 8);
      });
    }
    for (var step = 0; step < 120; step++) {
      if (!hits(x, y)) return { x: x, y: y };
      y += 32;
      if (y > maxH - h - 20) {
        y = 40;
        x += 36;
        if (x > maxW - w - 20) x = 20;
      }
    }
    return { x: Math.max(0, preferX - w / 2), y: Math.max(0, preferY - h / 2) };
  }

  /** Double-click / add-from-sidebar: center with stagger so tiles are not pixel-stacked. */
  function dbDefaultAddPoint(w, h) {
    var canvas = document.getElementById('dbCanvas');
    var cx = canvas ? (canvas.offsetWidth || 1400) / 2 : 400;
    var cy = canvas ? (canvas.offsetHeight || 1000) / 2 : 400;
    return dbFindFreeDropPosition(w, h, cx, cy);
  }

  function dbGetFilteredSourceItems() {
    var items = dbGetSourceItems();
    var f = String(dbEditor.clipListFilter || '').toLowerCase();
    if (!f) return items;
    return items.filter(function(it) {
      return (it.title + ' ' + it.vendor + ' ' + (it.section || '')).toLowerCase().indexOf(f) >= 0;
    });
  }

  function dbGetSourceItems() {
    var tab = dbEditor.sourceTab || 'room';
    if (tab === 'room') {
      var catF = dbEditor.clipCategory || 'All';
      var roomF = dbEditor.clipRoom || 'All';
      var items = [];
      dbEditor.clips.forEach(function(clip) {
        var d = clip.data;
        if (!clipMatchesRoom(d, roomF)) return;
        if (catF !== 'All') {
          var cc = String(d.category || '').trim();
          if (cc.toLowerCase() !== String(catF).toLowerCase()) return;
        }
        items.push({
          kind: 'clip',
          clipId: clip.id,
          title: d.title || 'Untitled',
          vendor: d.vendor || '',
          sellPrice: parseFloat(d.clientPrice) || parseFloat(d.sellingPrice) || 0,
          cost: parseFloat(d.cost) || 0,
          img: dbClipSidebarImg(d),
          data: d
        });
      });
      return items;
    }
    if (tab === 'ideabook') {
      return (dbEditor.ibImages || []).filter(function(img) { return img && img.imageUrl; }).map(function(img) {
        return {
          kind: 'inspiration',
          title: img.caption || img.title || 'Untitled',
          vendor: img.vendor || '',
          sellPrice: parseFloat(img.price || img.clientPrice) || 0,
          cost: 0,
          img: img.imageUrl,
          data: img,
          section: img.section || ''
        };
      });
    }
    return (dbEditor.libItems || []).map(function(p) {
      var d = p.data || p;
      return {
        kind: 'library',
        title: d.title || d.name || 'Untitled',
        vendor: d.vendor || d.manufacturer || '',
        sellPrice: parseFloat(d.clientPrice) || parseFloat(d.retailPrice) || 0,
        cost: parseFloat(d.cost) || 0,
        img: dbClipSidebarImg(d),
        data: d
      };
    });
  }

  function dbUpdateSourceTabFilters() {
    var tab = dbEditor.sourceTab || 'room';
    var rw = document.getElementById('dbClipRoomWrap');
    var cw = document.getElementById('dbClipCatWrap');
    if (rw) rw.style.display = (tab === 'room') ? 'block' : 'none';
    if (cw) cw.style.display = (tab === 'room') ? 'block' : 'none';
    document.querySelectorAll('.db-source-tab').forEach(function(btn) {
      var t = btn.getAttribute('data-tab');
      btn.classList.toggle('db-source-tab--active', t === tab);
    });
  }

  window.dbSwitchSourceTab = function(tab) {
    dbEditor.sourceTab = tab || 'room';
    dbUpdateSourceTabFilters();
    var inp = document.getElementById('dbClipFilterInput');
    if (tab === 'library' && !dbEditor.libItemsLoaded) {
      var listEl = document.getElementById('dbClipsList');
      if (listEl) listEl.innerHTML = '<div style="color:var(--gray-400);font-size:12px;text-align:center;padding:16px;line-height:1.45;">Loading product library…</div>';
      void dbLoadLibraryItems();
    } else {
      renderClipsList(inp ? inp.value : '');
    }
  };

  function dbReadDragSourceIdx(dt) {
    if (window._dbDragSourceIdx != null && window._dbDragSourceIdx !== '') return window._dbDragSourceIdx;
    if (!dt) return null;
    var s = dt.getData('application/x-cch-db-idx') || dt.getData('text/cch-db-idx') || '';
    if (!s) return null;
    var n = parseInt(s, 10);
    return isFinite(n) ? n : null;
  }

  window.sourceItemDragStart = function(e, idx) {
    window._dbDragSourceItems = dbGetFilteredSourceItems();
    window._dbDragSourceIdx = idx;
    if (e.dataTransfer) {
      e.dataTransfer.setData('text/plain', 'item');
      e.dataTransfer.setData('application/x-cch-db-idx', String(idx));
      e.dataTransfer.effectAllowed = 'copy';
    }
  };

  window.sourceItemDragEnd = function() {
    _dbSuppressSidebarDblClickUntil = Date.now() + 700;
    window.setTimeout(function() {
      window._dbDragSourceIdx = null;
      window._dbDragSourceItems = null;
    }, 350);
  };

  window.dbAddSourceToCanvas = function(idx) {
    if (Date.now() < _dbSuppressSidebarDblClickUntil) return;
    var items = dbGetFilteredSourceItems();
    var it = items[idx];
    if (!it || !it.img) {
      if (typeof showToast === 'function') showToast('This item has no image to place on the board', 'warning');
      return;
    }
    var pos = dbDefaultAddPoint(180, 180);
    dbPlaceFromSourceItem(it, pos.x + 90, pos.y + 90);
  };

  function dbPlaceFromSourceItem(it, mx, my) {
    if (!it || !it.img) return;
    if (it.kind === 'clip') {
      var d = it.data;
      var imgPack = (typeof window.cchProposalLineImagesFromSource === 'function')
        ? window.cchProposalLineImagesFromSource(d)
        : { images: [], imageUrl: it.img, heroImageIndex: 0 };
      dbPlaceProductOnCanvas(it.img, {
        clipId: it.clipId,
        images: (imgPack.images && imgPack.images.length) ? imgPack.images.slice() : [it.img],
        heroImageIndex: imgPack.heroImageIndex || 0,
        title: it.title,
        vendor: it.vendor,
        section: it.section || '',
        description: String(d.description || d.shortDescription || d.desc || '').trim(),
        cost: it.cost,
        sellPrice: it.sellPrice,
        showPrice: true
      }, mx, my);
      return;
    }
    var srcData = it.data || {};
    dbPlaceProductOnCanvas(it.img, {
      title: it.title,
      vendor: it.vendor,
      section: it.section || '',
      description: String(srcData.description || srcData.shortDescription || srcData.desc || '').trim(),
      cost: it.cost,
      sellPrice: it.sellPrice,
      showPrice: it.kind === 'library',
      w: 260,
      h: 260
    }, mx, my);
  }

  // ==================== CLIPS / INSPIRATION / LIBRARY SIDEBAR ====================
  function renderClipsList(filter) {
    var el = document.getElementById('dbClipsList');
    if (!el) return;
    if (filter !== undefined && filter !== null) dbEditor.clipListFilter = filter;
    var items = dbGetFilteredSourceItems();
    var html = '';
    items.forEach(function(it, idx) {
      var img = it.img || '';
      html += '<div class="db-clip-item" draggable="true" ' +
        'ondragstart="sourceItemDragStart(event,' + idx + ')" ondragend="sourceItemDragEnd(event)" ' +
        'ondblclick="dbAddSourceToCanvas(' + idx + ')" ' +
        'style="display:flex;gap:8px;padding:6px;margin-bottom:4px;border-radius:6px;cursor:grab;border:1px solid transparent;transition:all 0.15s;" ' +
        'onmouseover="this.style.background=\'#f0ede5\';this.style.borderColor=\'var(--gray-200)\'" ' +
        'onmouseout="this.style.background=\'transparent\';this.style.borderColor=\'transparent\'">' +
        (img ? '<img src="' + dbSidebarImgSrcAttr(img) + '" referrerpolicy="no-referrer" loading="lazy" decoding="async" style="width:44px;height:44px;border-radius:4px;object-fit:cover;flex-shrink:0;background:var(--gray-100);" onerror="typeof cchImgTryFallbacks===\'function\'?cchImgTryFallbacks(this):(this.style.display=\'none\')">' : '<div style="width:44px;height:44px;background:var(--gray-100);border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--gray-300);">📷</div>') +
        '<div style="overflow:hidden;flex:1;min-width:0;">' +
          '<div style="font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(it.title) + '</div>' +
          '<div style="font-size:10px;color:var(--gray-400);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(it.vendor || it.section || '') + '</div>' +
          (it.sellPrice > 0 ? '<div style="font-size:10px;color:var(--green);font-weight:600;">' + fmt$(it.sellPrice) + '</div>' : '') +
        '</div>' +
      '</div>';
    });
    if (!html) {
      var tab = dbEditor.sourceTab || 'room';
      var roomF = dbEditor.clipRoom || 'All';
      var emptyMsg = 'No items found';
      if (tab === 'room' && roomF !== 'All') {
        emptyMsg = 'No clips in <strong>' + esc(roomF) + '</strong>. Try <strong>All rooms</strong>.';
      } else if (tab === 'ideabook') {
        emptyMsg = 'No inspiration images in this project. Add images on the <strong>Inspiration</strong> tab first.';
      } else if (tab === 'library') {
        emptyMsg = 'No products in library.';
      }
      html = '<div style="color:var(--gray-400);font-size:12px;text-align:center;padding:12px;line-height:1.45;">' + emptyMsg + '</div>';
    }
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
    dbRestackDomFromModel();
    renderProps();
  };

  window.setBoardCoverFromProduct = async function() {
    var el = dbEditor.elements.find(function(e) { return e.id === dbEditor.selectedId; });
    if (!el || (el.type !== 'product' && el.type !== 'image') || !dbElementCoverThumb(el)) {
      if (typeof cchAlert === 'function') await cchAlert('Select a product or image tile on the board, then set cover.', 'Board cover');
      return;
    }
    var imgUrl = dbElementCoverThumb(el);
    try {
      await db.collection('boards').doc(dbEditor.projectId).collection('designBoards').doc(dbEditor.boardId).update({
        coverImageUrl: imgUrl,
        coverElementId: el.id,
        updatedAt: new Date().toISOString()
      });
      dbEditor.boardData.coverImageUrl = imgUrl;
      dbEditor.boardData.coverElementId = el.id;
      if (typeof showToast === 'function') showToast('Cover saved — this image shows on the Design Boards grid.', 3500);
    } catch (err) {
      if (typeof cchAlert === 'function') await cchAlert((err && err.message) || 'Could not save cover', 'Board cover');
    }
  };

  // ==================== CANVAS RENDERING ====================
  function dbElSupportsResize(type) {
    return type === 'product' || type === 'image' || type === 'note';
  }

  function resizeHandles() {
    return '<div class="db-resize" data-dir="nw" style="left:-6px;top:-6px;cursor:nwse-resize;" onpointerdown="resizeMouseDown(event,\'nw\')"></div>' +
      '<div class="db-resize" data-dir="ne" style="right:-6px;top:-6px;cursor:nesw-resize;" onpointerdown="resizeMouseDown(event,\'ne\')"></div>' +
      '<div class="db-resize" data-dir="sw" style="left:-6px;bottom:-6px;cursor:nesw-resize;" onpointerdown="resizeMouseDown(event,\'sw\')"></div>' +
      '<div class="db-resize" data-dir="se" style="right:-6px;bottom:-6px;cursor:nwse-resize;" onpointerdown="resizeMouseDown(event,\'se\')"></div>';
  }

  function dbBuildElementHtml(el, sel) {
    if (!el) return '';
    if (sel == null) sel = el.id === dbEditor.selectedId;
    var selClass = sel ? ' db-el-selected' : '';

    if (el.type === 'product' || el.type === 'image') {
      var imgSrc = dbResolveProductImgSrc(el);
      var hasImg = !!(el.imageUrl || el.img);
      var ew = el.w || 180;
      var eh = el.h || 180;
      var mediaInner = imgSrc
        ? '<img src="' + imgSrc + '" referrerpolicy="no-referrer" draggable="false" decoding="async" loading="lazy" onerror="this.onerror=null;this.style.display=\'none\';this.insertAdjacentHTML(\'afterend\',\'<div class=&quot;db-el-media-fallback&quot; style=&quot;width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--gray-300);font-size:24px;&quot;>📷</div>\')">'
        : (hasImg
          ? '<div class="db-el-media-fallback" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--gray-500);font-size:11px;">Image link blocked</div>'
          : '<div class="db-el-media-fallback" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--gray-300);">📷</div>');
      return '<div class="db-el db-el-product' + selClass + '" data-id="' + el.id + '" style="position:absolute;left:' + el.x + 'px;top:' + el.y + 'px;width:' + ew + 'px;z-index:' + (sel ? 100 : 10) + ';" onpointerdown="elMouseDown(event,\'' + el.id + '\')" ondblclick="event.stopPropagation();void dbOpenProductDetail(\'' + el.id + '\')" oncontextmenu="return dbProductContextMenu(event,\'' + el.id + '\')">' +
        '<div class="db-el-media" style="width:' + ew + 'px;height:' + eh + 'px;">' + mediaInner + (sel ? resizeHandles() : '') + '</div>' +
        dbProductCaptionHtml(el) +
        dbProductPriceHtml(el) +
        (el.annotation ? '<div class="db-el-annotation">' + esc(el.annotation) + '</div>' : '') +
      '</div>';
    }
    if (el.type === 'text') {
      return '<div class="db-el' + selClass + '" data-id="' + el.id + '" style="position:absolute;left:' + el.x + 'px;top:' + el.y + 'px;cursor:move;z-index:' + (sel ? 100 : 20) + ';max-width:300px;" onpointerdown="elMouseDown(event,\'' + el.id + '\')" ondblclick="void editTextEl(\'' + el.id + '\')">' +
        '<div style="font-size:' + (el.fontSize || 13) + 'px;color:' + (el.color || '#333') + ';font-weight:' + (el.fontWeight || 'normal') + ';white-space:pre-wrap;pointer-events:none;font-family:' + (el.fontFamily || 'inherit') + ';">' + esc(el.text || 'Text') + '</div></div>';
    }
    if (el.type === 'heading') {
      return '<div class="db-el' + selClass + '" data-id="' + el.id + '" style="position:absolute;left:' + el.x + 'px;top:' + el.y + 'px;cursor:move;z-index:' + (sel ? 100 : 20) + ';" onpointerdown="elMouseDown(event,\'' + el.id + '\')" ondblclick="void editTextEl(\'' + el.id + '\')">' +
        '<div style="font-size:' + (el.fontSize || 24) + 'px;color:' + (el.color || '#333') + ';font-weight:700;letter-spacing:2px;text-transform:uppercase;pointer-events:none;">' + esc(el.text || 'HEADING') + '</div></div>';
    }
    if (el.type === 'note') {
      return '<div class="db-el' + selClass + '" data-id="' + el.id + '" style="position:absolute;left:' + el.x + 'px;top:' + el.y + 'px;width:' + (el.w || 200) + 'px;padding:10px 12px;background:#FFFDE7;border:1px solid #FFF9C4;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.08);cursor:move;z-index:' + (sel ? 100 : 15) + ';" onpointerdown="elMouseDown(event,\'' + el.id + '\')" ondblclick="void editTextEl(\'' + el.id + '\')">' +
        '<div style="font-size:12px;color:#666;white-space:pre-wrap;pointer-events:none;font-style:italic;">' + esc(el.text || 'Designer notes...') + '</div>' +
        (sel ? resizeHandles() : '') + '</div>';
    }
    if (el.type === 'pricetag') {
      var showP = dbEditor.showPricing && !dbEditor.clientView;
      if (!showP) return '';
      return '<div class="db-el' + selClass + '" data-id="' + el.id + '" style="position:absolute;left:' + el.x + 'px;top:' + el.y + 'px;background:#fff;border:1px solid #ddd;border-radius:4px;padding:4px 8px;font-size:11px;cursor:move;z-index:' + (sel ? 100 : 25) + ';" onpointerdown="elMouseDown(event,\'' + el.id + '\')" ondblclick="void editTextEl(\'' + el.id + '\')">' +
        '<div style="pointer-events:none;">' + esc(el.text || '') + '</div></div>';
    }
    return '';
  }

  function dbBuildArrowSvgHtml() {
    var svgHtml = '<defs><marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#333"/></marker></defs>';
    (dbEditor.elements || []).forEach(function(el) {
      if (!el || el.type !== 'arrow') return;
      var sel = el.id === dbEditor.selectedId;
      svgHtml += '<line x1="' + el.x1 + '" y1="' + el.y1 + '" x2="' + el.x2 + '" y2="' + el.y2 + '" stroke="' + (el.color || '#333') + '" stroke-width="' + (el.strokeWidth || 1.5) + '" marker-end="url(#arrowhead)" style="pointer-events:stroke;cursor:pointer;" onpointerdown="elMouseDown(event,\'' + el.id + '\')" />';
      if (el.label) {
        var mx = (el.x1 + el.x2) / 2;
        var my = (el.y1 + el.y2) / 2;
        svgHtml += '<text x="' + mx + '" y="' + (my - 6) + '" text-anchor="middle" font-size="11" fill="#666" style="pointer-events:none;">' + esc(el.label) + '</text>';
      }
      if (sel) {
        svgHtml += '<circle cx="' + el.x1 + '" cy="' + el.y1 + '" r="5" fill="var(--gold)" stroke="#fff" stroke-width="1.5" style="cursor:move;pointer-events:all;" onpointerdown="arrowHandleDown(event,\'' + el.id + '\',\'start\')" />';
        svgHtml += '<circle cx="' + el.x2 + '" cy="' + el.y2 + '" r="5" fill="var(--gold)" stroke="#fff" stroke-width="1.5" style="cursor:move;pointer-events:all;" onpointerdown="arrowHandleDown(event,\'' + el.id + '\',\'end\')" />';
      }
    });
    return svgHtml;
  }

  function dbRenderArrowsOnly() {
    var svgEl = document.getElementById('dbArrowSvg');
    if (svgEl) svgEl.innerHTML = dbBuildArrowSvgHtml();
  }

  /** Full rebuild — open board, undo, export, pricing toggle only. */
  function renderCanvas() {
    if (_dbPointerGesture || dbEditor.isDragging || dbEditor.isResizing) return;
    var container = document.getElementById('dbElements');
    var svgEl = document.getElementById('dbArrowSvg');
    if (!container || !svgEl) return;
    var html = '';
    (dbEditor.elements || []).forEach(function(el) {
      if (el && el.type !== 'arrow') html += dbBuildElementHtml(el);
    });
    container.innerHTML = html;
    svgEl.innerHTML = dbBuildArrowSvgHtml();
  }

  function dbAppendElementDom(el) {
    if (!el) return;
    if (el.type === 'arrow') {
      dbRenderArrowsOnly();
      return;
    }
    var container = document.getElementById('dbElements');
    if (!container) return;
    var html = dbBuildElementHtml(el);
    if (html) container.insertAdjacentHTML('beforeend', html);
  }

  function dbRemoveElementDom(id) {
    var node = dbFindElementDomNode(id);
    if (node && node.parentNode) node.parentNode.removeChild(node);
    var el = (dbEditor.elements || []).find(function(e) { return e && e.id === id; });
    if (el && el.type === 'arrow') dbRenderArrowsOnly();
  }

  function dbRestackDomFromModel() {
    var container = document.getElementById('dbElements');
    if (!container) return;
    (dbEditor.elements || []).forEach(function(el) {
      if (!el || el.type === 'arrow') return;
      var node = dbFindElementDomNode(el.id);
      if (node) container.appendChild(node);
    });
    dbUpdateSelectionDom();
  }

  function dbPatchProductTail(el, node) {
    node = node || dbFindElementDomNode(el.id);
    if (!node) return false;
    var media = node.querySelector('.db-el-media');
    if (!media) return false;
    while (media.nextSibling) node.removeChild(media.nextSibling);
    var tail = dbProductCaptionHtml(el) + dbProductPriceHtml(el);
    if (el.annotation) {
      tail += '<div class="db-el-annotation">' + esc(el.annotation) + '</div>';
    }
    if (tail) media.insertAdjacentHTML('afterend', tail);
    return true;
  }

  function dbPatchElementVisual(el) {
    if (!el) return false;
    var node = dbFindElementDomNode(el.id);
    if (!node) return false;
    if (el.type === 'product' || el.type === 'image') return dbPatchProductTail(el, node);
    if (el.type === 'text' || el.type === 'heading' || el.type === 'note' || el.type === 'pricetag') {
      var inner = node.querySelector('div');
      if (!inner) return false;
      inner.textContent = el.text || (el.type === 'note' ? 'Designer notes...' : el.type === 'heading' ? 'HEADING' : el.type === 'text' ? 'Text' : '');
      if (el.type === 'text') {
        inner.style.fontSize = (el.fontSize || 13) + 'px';
        inner.style.color = el.color || '#333333';
        inner.style.fontWeight = el.fontWeight || 'normal';
      } else if (el.type === 'heading') {
        inner.style.fontSize = (el.fontSize || 24) + 'px';
        inner.style.color = el.color || '#333333';
      }
      return true;
    }
    return false;
  }

  function dbPatchElementImage(el) {
    if (!el) return false;
    var node = dbFindElementDomNode(el.id);
    if (!node) return false;
    var imgSrc = dbResolveProductImgSrc(el);
    var media = node.querySelector('.db-el-media');
    if (!media) return false;
    var img = media.querySelector('img');
    if (img && imgSrc) {
      img.src = imgSrc;
      img.style.display = '';
      var fb = media.querySelector('.db-el-media-fallback');
      if (fb) fb.remove();
      return true;
    }
    return false;
  }

  /** Strip vendor suffixes from titles — vendors never appear on design board tiles. */
  function dbBoardDisplayTitle(title) {
    var t = String(title || '').trim();
    if (!t) return '';
    t = t.replace(/\s*\|\s*by\s+.+$/i, '').trim();
    t = t.replace(/\s+by\s+[^|]+$/i, '').trim();
    return t;
  }

  function dbElementDescription(el) {
    if (!el) return '';
    var d = String(el.description || '').trim();
    if (d) return d;
    if (!el.clipId) return '';
    var clip = (dbEditor.clips || []).find(function(c) { return c && c.id === el.clipId; });
    if (!clip || !clip.data) return '';
    var cd = clip.data;
    return String(cd.description || cd.shortDescription || cd.desc || '').trim();
  }

  function dbProductPriceHtml(el) {
    if (!el) return '';
    var showPrice = dbEditor.showPricing && !dbEditor.clientView && el.showPrice !== false;
    if (!showPrice || !el.sellPrice) return '';
    return '<div class="db-el-price">' + fmt$(el.sellPrice) + '</div>';
  }

  function dbProductCaptionHtml(el) {
    if (!el) return '';
    var html = '';
    if (!el.hideCaption) {
      var title = dbBoardDisplayTitle(el.title);
      if (title) html += '<div class="db-el-caption">' + esc(title) + '</div>';
    }
    if (el.showDescription) {
      var desc = dbElementDescription(el);
      if (desc) html += '<div class="db-el-desc">' + esc(desc) + '</div>';
    }
    return html;
  }

  window.dbProductContextMenu = function(e, id) {
    e.preventDefault();
    e.stopPropagation();
    var el = dbEditor.elements.find(function(e2) { return e2.id === id; });
    if (!el || (el.type !== 'product' && el.type !== 'image')) return false;
    pushUndo();
    el.hideCaption = !el.hideCaption;
    dbPatchProductTail(el);
    renderProps();
    dbEditor.dirty = true;
    if (typeof showToast === 'function') {
      showToast(el.hideCaption ? 'Title hidden' : 'Title shown', 1800);
    }
    return false;
  };

  /** Toggle selection chrome without rebuilding canvas HTML (smooth drag/resize). */
  function dbUpdateSelectionDom() {
    var root = document.getElementById('dbElements');
    if (!root) return;
    root.querySelectorAll('.db-el-selected').forEach(function(n) { n.classList.remove('db-el-selected'); });
    var nodes = root.querySelectorAll('.db-el[data-id]');
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var id = node.getAttribute('data-id');
      var sel = id === dbEditor.selectedId;
      var el = dbEditor.elements.find(function(e2) { return e2.id === id; });
      if (!el) continue;
      node.classList.toggle('db-el-selected', sel);
      node.style.zIndex = sel ? '100' : (el.type === 'product' || el.type === 'image' ? '10' : (el.type === 'note' ? '15' : '20'));
      var media = node.querySelector('.db-el-media');
      if (media) {
        media.querySelectorAll('.db-resize').forEach(function(h) { h.remove(); });
        if (sel && dbElSupportsResize(el.type)) {
          media.insertAdjacentHTML('beforeend', resizeHandles());
        }
      } else if (sel && dbElSupportsResize(el.type)) {
        node.querySelectorAll('.db-resize').forEach(function(h) { h.remove(); });
        node.insertAdjacentHTML('beforeend', resizeHandles());
      } else {
        node.querySelectorAll('.db-resize').forEach(function(h) { h.remove(); });
      }
    }
    var svgEl = document.getElementById('dbArrowSvg');
    if (svgEl && dbEditor.selectedId) {
      var selArrow = dbEditor.elements.find(function(e2) { return e2.id === dbEditor.selectedId && e2.type === 'arrow'; });
      if (selArrow) dbRenderArrowsOnly();
    }
  }

  // ==================== PROPERTIES PANEL ====================
  function renderProps() {
    var pc = document.getElementById('dbPropsContent');
    if (!pc) return;

    if (!dbEditor.selectedId) {
      pc.innerHTML = '<div style="color:var(--gray-400);font-size:12px;padding:12px 0 16px;text-align:center;line-height:1.45;">Select an element<br>or drag a clip onto the canvas<br><span style="font-size:10px;">Press <strong>Esc</strong> to clear selection</span></div>' +
        '<div style="margin-top:12px;border-top:1px solid var(--gray-200);padding-top:12px;">' +
          '<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:var(--gray-400);font-weight:600;margin-bottom:8px;">Canvas</div>' +
          propRow('Title', '<input class="db-prop-input" value="' + esc(dbEditor.boardData.title || '') + '" onchange="updateBoardMeta(\'title\',this.value)">') +
          propRow('Room', '<input class="db-prop-input" value="' + esc(dbEditor.boardData.room || '') + '" onchange="updateBoardMeta(\'room\',this.value)">') +
          propRow('Width', '<input class="db-prop-input" type="number" value="' + (dbEditor.boardData.canvasWidth || 1400) + '" onchange="resizeBoard(\'w\',this.value)" style="width:70px;">') +
          propRow('Height', '<input class="db-prop-input" type="number" value="' + (dbEditor.boardData.canvasHeight || 1000) + '" onchange="resizeBoard(\'h\',this.value)" style="width:70px;">') +
        '</div>';
      return;
    }

    var el = dbEditor.elements.find(function(e) { return e.id === dbEditor.selectedId; });
    if (!el) { dbEditor.selectedId = null; dbEditor._propsPanelForId = null; renderProps(); return; }
    dbEditor._propsPanelForId = el.id;

    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;">' +
      '<div style="font-size:13px;font-weight:600;">' + el.type.charAt(0).toUpperCase() + el.type.slice(1) + '</div>' +
      '<button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:10px;" onclick="dbClearSelection()" title="Deselect (Esc)">✕</button>' +
    '</div>';

    html += propRow('X', '<input id="dbPropX" class="db-prop-input" type="number" value="' + Math.round(el.x || 0) + '" onchange="updateElProp(\'' + el.id + '\',\'x\',+this.value)" style="width:60px;">') +
      propRow('Y', '<input id="dbPropY" class="db-prop-input" type="number" value="' + Math.round(el.y || 0) + '" onchange="updateElProp(\'' + el.id + '\',\'y\',+this.value)" style="width:60px;">');

    if (el.w !== undefined) {
      html += propRow('Width', '<input id="dbPropW" class="db-prop-input" type="number" value="' + Math.round(el.w) + '" onchange="updateElProp(\'' + el.id + '\',\'w\',+this.value)" style="width:60px;">');
    }
    if (el.h !== undefined) {
      html += propRow('Height', '<input id="dbPropH" class="db-prop-input" type="number" value="' + Math.round(el.h) + '" onchange="updateElProp(\'' + el.id + '\',\'h\',+this.value)" style="width:60px;">');
    }

    if (el.type === 'product' || el.type === 'image') {
      html += '<div style="border-top:1px solid var(--gray-200);margin:10px 0;padding-top:10px;">';
      html += propRow('Title', '<input class="db-prop-input" value="' + esc(el.title || '') + '" onchange="updateElProp(\'' + el.id + '\',\'title\',this.value)">');
      html += propRow('Cost', '<input class="db-prop-input" type="number" value="' + (el.cost || 0) + '" onchange="updateElProp(\'' + el.id + '\',\'cost\',+this.value)" style="width:80px;">');
      html += propRow('Sell $', '<input class="db-prop-input" type="number" value="' + (el.sellPrice || 0) + '" onchange="updateElProp(\'' + el.id + '\',\'sellPrice\',+this.value)" style="width:80px;">');
      html += propRow('Show $', '<input type="checkbox" ' + (el.showPrice !== false ? 'checked' : '') + ' onchange="updateElProp(\'' + el.id + '\',\'showPrice\',this.checked)">');
      html += propRow('Hide title', '<input type="checkbox" ' + (el.hideCaption ? 'checked' : '') + ' onchange="updateElProp(\'' + el.id + '\',\'hideCaption\',this.checked)" title="Hide the product title under this tile">');
      html += propRow('Show description', '<input type="checkbox" ' + (el.showDescription ? 'checked' : '') + ' onchange="updateElProp(\'' + el.id + '\',\'showDescription\',this.checked)" title="Show product description under the title">');
      html += propRow('Note', '<textarea class="db-prop-input" rows="3" onchange="updateElProp(\'' + el.id + '\',\'annotation\',this.value)" style="resize:vertical;">' + esc(el.annotation || '') + '</textarea>');
      var thumbSrc = dbResolveProductImgSrc(el);
      if (thumbSrc) {
        html += '<div style="margin:8px 0;border-radius:4px;overflow:hidden;border:1px solid var(--gray-200);background:#fff;">' +
          '<img src="' + thumbSrc + '" referrerpolicy="no-referrer" style="width:100%;max-height:min(280px,32vh);min-height:160px;object-fit:contain;display:block;background:#f8f8f8;" onerror="this.style.display=\'none\'">' +
        '</div>';
      }
      html += '<div style="font-size:10px;color:var(--gray-500);line-height:1.4;margin-bottom:8px;">Replace updates <strong>this board tile only</strong> — same element ID; Room Board clip / library product unchanged. Double-click the tile for full item edit.</div>';
      html += '<div style="margin-top:6px;display:flex;flex-direction:column;gap:6px;">' +
        '<button type="button" class="btn btn-primary btn-sm" onclick="void dbOpenProductDetail(\'' + el.id + '\')">✏️ Edit item (large view)</button>' +
        (el.type === 'product' ? '<button type="button" class="btn btn-primary btn-sm" onclick="void replaceSelectedProductImage()">🖼 Replace image…</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" onclick="void replaceSelectedProductImageUrl()">🔗 Replace from URL</button>' +
        '<button type="button" class="btn btn-sm" style="background:rgba(196,164,100,0.15);border-color:var(--gold);color:#5C4A2A;font-weight:600;" onclick="void setBoardCoverFromProduct()">📷 Use as grid cover photo</button>' : '') +
        '<button type="button" class="btn btn-secondary btn-sm" onclick="bringSelectedToFront()">Bring to front (stacking)</button>' +
      '</div>';
      html += '</div>';
    }

    if (el.type === 'text' || el.type === 'heading' || el.type === 'note' || el.type === 'pricetag') {
      html += '<div style="border-top:1px solid var(--gray-200);margin:10px 0;padding-top:10px;">';
      html += propRow('Text', '<textarea class="db-prop-input" rows="3" onchange="updateElProp(\'' + el.id + '\',\'text\',this.value)" style="resize:vertical;">' + esc(el.text || '') + '</textarea>');
      html += propRow('Size', '<input class="db-prop-input" type="number" value="' + (el.fontSize || 13) + '" onchange="updateElProp(\'' + el.id + '\',\'fontSize\',+this.value)" style="width:60px;">');
      html += propRow('Color', '<input type="color" value="' + dbNormHexColor(el.color) + '" onchange="updateElProp(\'' + el.id + '\',\'color\',this.value)" style="width:36px;height:24px;border:none;cursor:pointer;">');
      html += '</div>';
    }

    if (el.type === 'arrow') {
      html += propRow('Label', '<input class="db-prop-input" value="' + esc(el.label || '') + '" onchange="updateElProp(\'' + el.id + '\',\'label\',this.value)">');
      html += propRow('Color', '<input type="color" value="' + dbNormHexColor(el.color) + '" onchange="updateElProp(\'' + el.id + '\',\'color\',this.value)" style="width:36px;height:24px;border:none;cursor:pointer;">');
    }

    // Actions
    html += '<div style="border-top:1px solid var(--gray-200);margin-top:12px;padding-top:12px;display:flex;gap:6px;">' +
      '<button class="btn btn-secondary btn-sm" onclick="duplicateEl(\'' + el.id + '\')">Duplicate</button>' +
      '<button type="button" class="btn btn-sm" style="background:#fee;color:var(--red);" onmousedown="event.stopPropagation()" onclick="deleteEl(\'' + el.id + '\')">Delete</button>' +
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

  window.dbClearSelection = function() {
    dbEditor.selectedId = null;
    dbEditor.arrowStart = null;
    dbCancelActiveDrag();
    dbClearAllDragTransforms();
    dbUpdateSelectionDom();
    renderProps();
  };

  // ==================== ELEMENT OPERATIONS ====================
  window.updateElProp = function(id, prop, value) {
    pushUndo();
    var el = dbEditor.elements.find(function(e) { return e.id === id; });
    if (el) {
      el[prop] = value;
      if (prop === 'x' || prop === 'y' || prop === 'w' || prop === 'h') {
        dbPatchElementDom(el);
        dbSyncPropsFromSelected();
      } else if (el.type === 'arrow') {
        dbRenderArrowsOnly();
      } else if (el.type === 'product' || el.type === 'image') {
        dbPatchProductTail(el);
        if (prop === 'hideCaption' || prop === 'showDescription') renderProps();
      } else {
        dbPatchElementVisual(el);
      }
      dbEditor.dirty = true;
    }
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
    dbApplyViewZoom();
    if (dbEditor.viewZoomMode === 'fit') dbFitCanvasToView();
  };

  window.deleteEl = function(id) {
    pushUndo();
    dbEditor.elements = dbEditor.elements.filter(function(e) { return e.id !== id; });
    dbEditor.selectedId = null;
    dbRemoveElementDom(id);
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
    dbAppendElementDom(clone);
    dbUpdateSelectionDom();
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
    dbRestackDomFromModel();
  };

  window.editTextEl = async function(id) {
    var el = dbEditor.elements.find(function(e) { return e.id === id; });
    if (!el || typeof cchPrompt !== 'function') return;
    var newText = await cchPrompt('Edit text:', el.text || '', 'Edit text');
    if (newText === null) return;
    pushUndo();
    el.text = newText;
    dbPatchElementVisual(el);
    renderProps();
  };

  // ==================== POINTER DRAG (model-driven — Canva / Figma pattern) ====================
  // Position lives in elements[].x/y; DOM is patched every move. setPointerCapture on #dbCanvas
  // guarantees pointerup even when the cursor leaves the tile or window.
  var _dbPointerGesture = null;
  var _dbCancelActiveDrag = null;

  function dbCleanupGestureUi() {
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.body.style.pointerEvents = '';
    _dbCancelActiveDrag = null;
    dbEditor.isDragging = false;
    dbEditor.isResizing = false;
    dbClearAllDragTransforms();
    var wrap = document.getElementById('dbCanvasWrap');
    if (wrap) { wrap.style.pointerEvents = ''; wrap.style.cursor = 'default'; }
    var stage = document.getElementById('dbCanvasStage');
    if (stage) stage.style.pointerEvents = '';
    var canvas = document.getElementById('dbCanvas');
    if (canvas) canvas.style.pointerEvents = '';
  }

  function dbDetachPointerGesture(g) {
    if (!g || !g.captureEl || !g.bound) return;
    var cap = g.captureEl;
    cap.removeEventListener('pointermove', g.bound.onMove);
    cap.removeEventListener('pointerup', g.bound.onEnd);
    cap.removeEventListener('pointercancel', g.bound.onEnd);
    cap.removeEventListener('lostpointercapture', g.bound.onLost);
    if (g.pointerId != null && cap.releasePointerCapture) {
      try { cap.releasePointerCapture(g.pointerId); } catch (_e) {}
    }
  }

  function dbAbortPointerGesture() {
    var g = _dbPointerGesture;
    if (!g) return;
    _dbPointerGesture = null;
    dbDetachPointerGesture(g);
    if (g.onAbort) try { g.onAbort(g.lastEv); } catch (_e2) {}
    dbCleanupGestureUi();
  }

  function dbFinishPointerGesture(ev) {
    var g = _dbPointerGesture;
    if (!g) return;
    _dbPointerGesture = null;
    dbDetachPointerGesture(g);
    if (g.onUp) try { g.onUp(ev || g.lastEv); } catch (_e2) {}
    dbCleanupGestureUi();
  }

  function dbForceRemoveAllDragListeners() {
    dbAbortPointerGesture();
    window._dbDragSourceIdx = null;
    window._dbDragSourceItems = null;
    document.onmousemove = null;
    document.onmouseup = null;
  }

  function dbCancelActiveDrag() {
    dbForceRemoveAllDragListeners();
  }

  /**
   * @param {PointerEvent} e
   * @param {{ onMove?: function, onUp?: function, onAbort?: function }} handlers
   */
  function dbBeginPointerGesture(e, handlers) {
    handlers = handlers || {};
    dbAbortPointerGesture();
    var canvas = document.getElementById('dbCanvas');
    if (!canvas || e.pointerId == null) return false;
    try { e.preventDefault(); } catch (_pe) {}
    var pointerId = e.pointerId;
    try { canvas.setPointerCapture(pointerId); } catch (_cap) { return false; }

    var g = {
      pointerId: pointerId,
      captureEl: canvas,
      lastEv: e,
      onMove: handlers.onMove,
      onUp: handlers.onUp,
      onAbort: handlers.onAbort,
      bound: null
    };

    function onMove(ev) {
      if (ev.pointerId !== pointerId) return;
      g.lastEv = ev;
      if (handlers.onMove) handlers.onMove(ev);
    }
    function onEnd(ev) {
      if (ev.pointerId !== pointerId) return;
      dbFinishPointerGesture(ev);
    }
    function onLost(ev) {
      if (ev.pointerId !== pointerId) return;
      dbFinishPointerGesture(g.lastEv || ev);
    }
    g.bound = { onMove: onMove, onEnd: onEnd, onLost: onLost };

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onEnd);
    canvas.addEventListener('pointercancel', onEnd);
    canvas.addEventListener('lostpointercapture', onLost);

    _dbPointerGesture = g;
    _dbCancelActiveDrag = dbAbortPointerGesture;
    return true;
  }

  function dbElementZIndex(el, selected) {
    if (selected) return '100';
    if (!el) return '10';
    if (el.type === 'product' || el.type === 'image') return '10';
    if (el.type === 'note') return '15';
    return '20';
  }

  /** Reposition every live tile from saved model coords — no full canvas rebuild. */
  function dbResyncAllElementsFromModel() {
    var root = document.getElementById('dbElements');
    if (!root) return;
    root.querySelectorAll('.db-el').forEach(function(node) {
      node.classList.remove('db-el-selected');
      node.style.transform = '';
      node.style.willChange = '';
      node.querySelectorAll('.db-resize').forEach(function(h) { h.remove(); });
      var id = node.getAttribute('data-id');
      var el = id ? dbEditor.elements.find(function(e2) { return e2.id === id; }) : null;
      node.style.zIndex = dbElementZIndex(el, false);
    });
    (dbEditor.elements || []).forEach(function(el) {
      if (el && el.type !== 'arrow') dbPatchElementDom(el);
    });
    var hasArrows = (dbEditor.elements || []).some(function(el) { return el && el.type === 'arrow'; });
    if (hasArrows) dbRenderArrowsOnly();
  }

  function dbPurgeGhostDomNodes() {
    var root = document.getElementById('dbElements');
    if (!root) return;
    var modelIds = {};
    (dbEditor.elements || []).forEach(function(el) {
      if (el && el.id && el.type !== 'arrow') modelIds[el.id] = true;
    });
    var seen = {};
    var nodes = root.querySelectorAll('.db-el[data-id]');
    for (var i = nodes.length - 1; i >= 0; i--) {
      var node = nodes[i];
      var id = node.getAttribute('data-id');
      if (!modelIds[id] || seen[id]) {
        if (node.parentNode) node.parentNode.removeChild(node);
      } else {
        seen[id] = true;
        node.style.transform = '';
        node.style.willChange = '';
      }
    }
  }

  function dbWireUnstickButtons() {
    ['dbUnstickToolbarBtn', 'dbUnstickPropsBtn'].forEach(function(btnId) {
      var btn = document.getElementById(btnId);
      if (!btn || btn._dbUnstickWired) return;
      btn._dbUnstickWired = true;
      btn.addEventListener('click', function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        window.dbRepairBoard();
      }, true);
    });
  }

  var _dbDropGuardMs = 0;
  var _dbSuppressSidebarDblClickUntil = 0;
  var DB_MIN_EL_SIZE = 40;

  function dbNormHexColor(c) {
    var s = String(c || '#333333').trim();
    var m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
    if (m3) return '#' + m3[1] + m3[1] + m3[2] + m3[2] + m3[3] + m3[3];
    if (/^#[0-9a-f]{6}$/i.test(s)) return s;
    return '#333333';
  }

  function dbFindElementDomNode(elId) {
    var root = document.getElementById('dbElements');
    if (!root || !elId) return null;
    var nodes = root.querySelectorAll('.db-el[data-id]');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].getAttribute('data-id') === elId) return nodes[i];
    }
    return null;
  }

  function dbLiftElementToFront(id) {
    var bi = dbEditor.elements.findIndex(function(e2) { return e2.id === id; });
    if (bi >= 0) {
      var lifted = dbEditor.elements.splice(bi, 1)[0];
      dbEditor.elements.push(lifted);
    }
    var root = document.getElementById('dbElements');
    var node = dbFindElementDomNode(id);
    if (root && node) root.appendChild(node);
  }

  /** Patch position/size on the live node — never rebuild innerHTML mid-gesture. */
  function dbPatchElementDom(el) {
    if (!el || el.type === 'arrow') return false;
    var node = dbFindElementDomNode(el.id);
    if (!node) return false;
    node.style.transform = '';
    node.style.willChange = '';
    node.style.zIndex = dbElementZIndex(el, el.id === dbEditor.selectedId);
    node.style.left = (el.x || 0) + 'px';
    node.style.top = (el.y || 0) + 'px';
    if (el.w != null && el.w !== undefined) node.style.width = el.w + 'px';
    var media = node.querySelector('.db-el-media');
    if (media) {
      if (el.w != null && el.w !== undefined) media.style.width = el.w + 'px';
      if (el.h != null && el.h !== undefined) media.style.height = el.h + 'px';
    } else if (el.h != null && el.h !== undefined) {
      node.style.height = el.h + 'px';
      node.style.minHeight = el.h + 'px';
    }
    return true;
  }

  function dbClearAllDragTransforms() {
    var root = document.getElementById('dbElements');
    if (!root) return;
    root.querySelectorAll('.db-el').forEach(function(node) {
      node.style.transform = '';
      node.style.willChange = '';
    });
  }

  /** Update X/Y/W/H fields without rebuilding the whole properties panel. */
  function dbSyncPropsFromSelected() {
    if (!dbEditor.selectedId) { renderProps(); return; }
    var el = dbEditor.elements.find(function(e) { return e.id === dbEditor.selectedId; });
    if (!el) { renderProps(); return; }
    var xIn = document.getElementById('dbPropX');
    var yIn = document.getElementById('dbPropY');
    if (!xIn || !yIn) { renderProps(); return; }
    xIn.value = Math.round(el.x || 0);
    yIn.value = Math.round(el.y || 0);
    var wIn = document.getElementById('dbPropW');
    var hIn = document.getElementById('dbPropH');
    if (wIn && el.w != null) wIn.value = Math.round(el.w);
    if (hIn && el.h != null) hIn.value = Math.round(el.h);
  }

  function dbFinishGestureDom(el, moved) {
    if (!el) return;
    if (el.type === 'arrow' && moved) {
      dbRenderArrowsOnly();
    } else {
      dbUpdateSelectionDom();
    }
    if (moved) {
      dbSyncPropsFromSelected();
    } else if (dbEditor._propsPanelForId !== el.id) {
      renderProps();
    }
  }

  function dbCanvasPointFromEvent(e, canvas) {
    canvas = canvas || document.getElementById('dbCanvas');
    if (!canvas) return { mx: 0, my: 0 };
    var rect = canvas.getBoundingClientRect();
    var z = dbEditor.canvasScale || 1;
    return { mx: (e.clientX - rect.left) / z, my: (e.clientY - rect.top) / z };
  }

  function dbGestureMoved(ev, startX, startY, threshold) {
    threshold = threshold == null ? 3 : threshold;
    return Math.abs(ev.clientX - startX) > threshold || Math.abs(ev.clientY - startY) > threshold;
  }

  function dbApplyResize(el, dir, rs, dx, dy) {
    if (dir === 'se') {
      el.w = Math.max(DB_MIN_EL_SIZE, rs.w + dx);
      el.h = Math.max(DB_MIN_EL_SIZE, rs.h + dy);
    } else if (dir === 'sw') {
      var nw = Math.max(DB_MIN_EL_SIZE, rs.w - dx);
      el.x = rs.x + (rs.w - nw);
      el.w = nw;
      el.h = Math.max(DB_MIN_EL_SIZE, rs.h + dy);
    } else if (dir === 'ne') {
      el.w = Math.max(DB_MIN_EL_SIZE, rs.w + dx);
      var nh = Math.max(DB_MIN_EL_SIZE, rs.h - dy);
      el.y = rs.y + (rs.h - nh);
      el.h = nh;
    } else if (dir === 'nw') {
      var nw2 = Math.max(DB_MIN_EL_SIZE, rs.w - dx);
      var nh2 = Math.max(DB_MIN_EL_SIZE, rs.h - dy);
      el.x = rs.x + (rs.w - nw2);
      el.y = rs.y + (rs.h - nh2);
      el.w = nw2;
      el.h = nh2;
    }
  }

  window.arrowHandleDown = function(e, id, end) {
    if (dbEditor.clientView) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    var el = dbEditor.elements.find(function(e2) { return e2.id === id; });
    if (!el) return;
    dbEditor.selectedId = id;
    var canvas = document.getElementById('dbCanvas');
    var startX = e.clientX;
    var startY = e.clientY;
    var undoPushed = false;
    var moved = false;
    dbBeginPointerGesture(e, {
      onMove: function(ev) {
        if (!moved) {
          if (!dbGestureMoved(ev, startX, startY)) return;
          moved = true;
          dbEditor.isDragging = true;
          if (!undoPushed) { undoPushed = true; pushUndo(); }
        }
        var pt = dbCanvasPointFromEvent(ev, canvas);
        if (end === 'start') { el.x1 = pt.mx; el.y1 = pt.my; }
        else { el.x2 = pt.mx; el.y2 = pt.my; }
        dbRenderArrowsOnly();
      },
      onUp: function() {
        if (moved) {
          dbRenderArrowsOnly();
          dbSyncPropsFromSelected();
          dbEditor.dirty = true;
        } else {
          dbUpdateSelectionDom();
          renderProps();
        }
      }
    });
  };

  window.elMouseDown = function(e, id) {
    if (dbEditor.clientView) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    if (e.target.classList && e.target.classList.contains('db-resize')) return;

    var el = dbEditor.elements.find(function(e2) { return e2.id === id; });
    if (!el) return;

    dbEditor.selectedId = id;
    dbLiftElementToFront(id);
    dbUpdateSelectionDom();

    var startX = e.clientX;
    var startY = e.clientY;
    var origX = el.x || 0;
    var origY = el.y || 0;
    var undoPushed = false;
    var moved = false;
    var canvas = document.getElementById('dbCanvas');
    var startPt = canvas ? dbCanvasPointFromEvent(e, canvas) : { mx: 0, my: 0 };
    var arrowOff = null;
    if (el.type === 'arrow' && canvas) {
      var pt0 = dbCanvasPointFromEvent(e, canvas);
      arrowOff = { mx: pt0.mx, my: pt0.my, x1: el.x1, y1: el.y1, x2: el.x2, y2: el.y2 };
    }

    dbBeginPointerGesture(e, {
      onMove: function(ev) {
        if (!moved) {
          if (!dbGestureMoved(ev, startX, startY)) return;
          moved = true;
          dbEditor.isDragging = true;
          document.body.style.cursor = 'grabbing';
          document.body.style.userSelect = 'none';
          if (!undoPushed) { undoPushed = true; pushUndo(); }
        }
        if (el.type === 'arrow' && arrowOff && canvas) {
          var pt = dbCanvasPointFromEvent(ev, canvas);
          el.x1 = arrowOff.x1 + (pt.mx - arrowOff.mx);
          el.y1 = arrowOff.y1 + (pt.my - arrowOff.my);
          el.x2 = arrowOff.x2 + (pt.mx - arrowOff.mx);
          el.y2 = arrowOff.y2 + (pt.my - arrowOff.my);
          dbRenderArrowsOnly();
        } else if (canvas && el.type !== 'arrow') {
          var pt2 = dbCanvasPointFromEvent(ev, canvas);
          el.x = Math.max(0, origX + pt2.mx - startPt.mx);
          el.y = Math.max(0, origY + pt2.my - startPt.my);
          dbPatchElementDom(el);
        }
      },
      onUp: function() {
        if (moved) dbEditor.dirty = true;
        dbFinishGestureDom(el, moved);
      },
      onAbort: function() {
        el.x = origX;
        el.y = origY;
        if (el.type === 'arrow' && arrowOff) {
          el.x1 = arrowOff.x1;
          el.y1 = arrowOff.y1;
          el.x2 = arrowOff.x2;
          el.y2 = arrowOff.y2;
          dbRenderArrowsOnly();
        } else {
          dbPatchElementDom(el);
        }
      }
    });
  };

  window.dbOpenProductDetail = function(elId) {
    var el = dbEditor.elements.find(function(e2) { return e2.id === elId; });
    if (!el || (el.type !== 'product' && el.type !== 'image')) return;
    if (el.clipId && typeof window.showClipDetail === 'function') {
      window.showClipDetail(dbEditor.projectId, el.clipId);
      return;
    }
    if (typeof window.showNewProductModal === 'function') {
      var imgs = Array.isArray(el.images) ? el.images.slice() : [];
      var hero = String(el.imageUrl || el.img || '').trim();
      if (hero && imgs.indexOf(hero) < 0) imgs.unshift(hero);
      window.showNewProductModal({
        title: el.title || '',
        vendor: el.vendor || '',
        imageUrl: hero,
        images: imgs,
        heroImageIndex: el.heroImageIndex || 0,
        costPrice: el.cost || 0,
        sellPrice: el.sellPrice || el.price || 0,
        __modalTitle: 'Edit board item',
        _clipProjectId: null,
        _clipDocId: null
      });
    }
  };

  window.resizeMouseDown = function(e, dir) {
    if (dbEditor.clientView) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    var el = dbEditor.elements.find(function(e2) { return e2.id === dbEditor.selectedId; });
    if (!el) return;
    var canvas = document.getElementById('dbCanvas');
    var startX = e.clientX;
    var startY = e.clientY;
    var startPt = canvas ? dbCanvasPointFromEvent(e, canvas) : { mx: 0, my: 0 };
    var rs = { x: el.x, y: el.y, w: el.w || 180, h: el.h || 180 };
    var moved = false;
    dbBeginPointerGesture(e, {
      onMove: function(ev) {
        if (!moved) {
          if (!dbGestureMoved(ev, startX, startY)) return;
          moved = true;
          dbEditor.isResizing = true;
          document.body.style.cursor = 'nwse-resize';
          document.body.style.userSelect = 'none';
          pushUndo();
        }
        if (canvas) {
          var pt = dbCanvasPointFromEvent(ev, canvas);
          dbApplyResize(el, dir, rs, pt.mx - startPt.mx, pt.my - startPt.my);
        }
        dbPatchElementDom(el);
      },
      onUp: function() {
        dbFinishGestureDom(el, moved);
        if (moved) dbEditor.dirty = true;
      }
    });
  };

  window.canvasMouseDown = function(e) {
    if (dbEditor.clientView) return;
    if (e.button != null && e.button !== 0) return;
    if (e.target && e.target.closest && e.target.closest('.db-el')) return;
    var canvas = document.getElementById('dbCanvas');
    if (!canvas) return;
    var pt = dbCanvasPointFromEvent(e, canvas);
    var mx = pt.mx;
    var my = pt.my;

    var placeTool = dbEditor.tool === 'text' || dbEditor.tool === 'heading' || dbEditor.tool === 'note' || dbEditor.tool === 'arrow';
    if (mx < 0 || my < 0 || mx > canvas.offsetWidth || my > canvas.offsetHeight) {
      if (placeTool) {
        mx = Math.max(0, Math.min(mx, canvas.offsetWidth));
        my = Math.max(0, Math.min(my, canvas.offsetHeight));
      } else if (dbEditor.tool === 'select') {
        dbEditor.selectedId = null;
        dbCancelActiveDrag();
        dbUpdateSelectionDom();
        renderProps();
        return;
      } else {
        return;
      }
    }

    if (dbEditor.tool === 'text') {
      pushUndo();
      var tel = { id: genId(), type: 'text', x: mx, y: my, text: 'Text', fontSize: 13, color: '#333333', fontWeight: 'normal' };
      dbEditor.elements.push(tel);
      dbEditor.selectedId = tel.id;
      dbEditor.tool = 'select';
      refreshDbToolbarTools();
      dbAppendElementDom(tel);
      dbUpdateSelectionDom();
      renderProps();
      return;
    }

    if (dbEditor.tool === 'heading') {
      pushUndo();
      var hel = { id: genId(), type: 'heading', x: mx, y: my, text: 'HEADING', fontSize: 24, color: '#333333' };
      dbEditor.elements.push(hel);
      dbEditor.selectedId = hel.id;
      dbEditor.tool = 'select';
      refreshDbToolbarTools();
      dbAppendElementDom(hel);
      dbUpdateSelectionDom();
      renderProps();
      return;
    }

    if (dbEditor.tool === 'note') {
      pushUndo();
      var nel = { id: genId(), type: 'note', x: mx, y: my, w: 200, text: 'Designer notes...', fontSize: 12 };
      dbEditor.elements.push(nel);
      dbEditor.selectedId = nel.id;
      dbEditor.tool = 'select';
      refreshDbToolbarTools();
      dbAppendElementDom(nel);
      dbUpdateSelectionDom();
      renderProps();
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
        dbRenderArrowsOnly();
        dbUpdateSelectionDom();
        renderProps();
      }
      return;
    }

    // Deselect when clicking empty canvas (select tool only)
    if (dbEditor.tool === 'select') {
      var t = e.target;
      if (t && t.closest && (t.closest('.db-el-media') || t.closest('.db-resize'))) return;
      if (t === canvas || t.id === 'dbElements' || t.id === 'dbArrowSvg' || (canvas && canvas.contains(t))) {
        dbEditor.selectedId = null;
        dbCancelActiveDrag();
        dbUpdateSelectionDom();
        renderProps();
      }
    }
  };

  if (!window._dbDesignBoardBlurBound) {
    window._dbDesignBoardBlurBound = true;
    window.addEventListener('blur', function() {
      if (!dbEditor || !dbEditor.boardId) return;
      if (!_dbPointerGesture && !dbEditor.isDragging && !dbEditor.isResizing) return;
      dbCancelActiveDrag();
    });
    document.addEventListener('visibilitychange', function() {
      if (!document.hidden || !dbEditor || !dbEditor.boardId) return;
      if (!_dbPointerGesture && !dbEditor.isDragging && !dbEditor.isResizing) return;
      dbCancelActiveDrag();
    });
  }

  function dbUpdateCanvasDropHint() {
    var hint = document.getElementById('dbCanvasDropHint');
    if (!hint) return;
    var hasProduct = (dbEditor.elements || []).some(function(el) { return el && el.type === 'product' && el.imageUrl; });
    hint.style.display = hasProduct ? 'none' : 'block';
  }

  function dbPlaceProductOnCanvas(primaryImg, meta, mx, my) {
    meta = meta || {};
    var w = meta.w || 180;
    var h = meta.h || 180;
    var pos = dbDropPointFromCursor(w, h, mx, my);
    pushUndo();
    var newEl = {
      id: genId(),
      type: 'product',
      clipId: meta.clipId || '',
      x: pos.x,
      y: pos.y,
      w: w,
      h: h,
      imageUrl: primaryImg,
      images: meta.images || (primaryImg ? [primaryImg] : []),
      heroImageIndex: meta.heroImageIndex || 0,
      title: meta.title || 'Untitled',
      vendor: meta.vendor || '',
      section: meta.section || '',
      description: String(meta.description || '').trim(),
      hideCaption: !!meta.hideCaption,
      showDescription: !!meta.showDescription,
      cost: meta.cost || 0,
      sellPrice: meta.sellPrice || 0,
      showPrice: meta.showPrice !== false,
      annotation: ''
    };
    dbEditor.elements.push(newEl);
    dbEditor.selectedId = newEl.id;
    dbAppendElementDom(newEl);
    dbUpdateSelectionDom();
    renderProps();
    dbUpdateCanvasDropHint();
    dbScrollCanvasToElement(newEl);
  }

  function dbGuessImageContentType(file, ext) {
    var t = String(file && file.type || '').trim();
    if (t && t.indexOf('image/') === 0) return t;
    var e = String(ext || '').toLowerCase();
    if (e === 'png') return 'image/png';
    if (e === 'gif') return 'image/gif';
    if (e === 'webp') return 'image/webp';
    if (e === 'heic' || e === 'heif') return 'image/heic';
    if (e === 'svg') return 'image/svg+xml';
    return 'image/jpeg';
  }

  function dbIsImageUploadFile(f) {
    if (!f) return false;
    if (f.type && f.type.startsWith('image/')) return true;
    return /\.(jpe?g|png|gif|webp|heic|heif|bmp|svg)$/i.test(String(f.name || ''));
  }

  async function dbUploadImageFilesToCanvas(files, mx, my) {
    var imageFiles = Array.from(files || []).filter(dbIsImageUploadFile);
    if (!imageFiles.length) return;
    if (typeof showToast === 'function') showToast('Uploading ' + imageFiles.length + ' image(s)…', 3500);
    for (var fi = 0; fi < imageFiles.length; fi++) {
      var f = imageFiles[fi];
      try {
        var rawExt = (f.name.split('.').pop() || 'jpeg').toLowerCase().replace(/[^a-z0-9]/g, '');
        var ext = rawExt && rawExt.length <= 8 ? rawExt : 'jpeg';
        var ts = Date.now() + '-' + fi + '-' + Math.random().toString(36).slice(2, 9);
        var path = 'projects/' + dbEditor.projectId + '/designboards/' + dbEditor.boardId + '/' + ts + '.' + ext;
        var ref = firebase.storage().ref(path);
        var contentType = dbGuessImageContentType(f, ext);
        await ref.put(f, { contentType: contentType });
        var url = await ref.getDownloadURL();
        dbPlaceProductOnCanvas(url, {
          title: f.name.replace(/\.[^.]+$/, ''),
          w: 220,
          h: 220,
          showPrice: false
        }, mx + fi * 20, my + fi * 20);
      } catch (err) {
        console.warn('[design board] upload', err);
        if (typeof cchAlert === 'function') await cchAlert('Upload failed: ' + ((err && err.message) || err), 'Design board');
      }
    }
  }

  window.dbCanvasDragOver = function(e) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    var wrap = document.getElementById('dbCanvasWrap');
    if (wrap) wrap.style.outline = '3px dashed var(--gold)';
  };

  window.dbCanvasDragLeave = function(e) {
    var wrap = document.getElementById('dbCanvasWrap');
    if (!wrap) return;
    var rel = e.relatedTarget;
    if (!rel || !wrap.contains(rel)) wrap.style.outline = '';
  };

  window.dbCanvasFileDrop = async function(e) {
    e.preventDefault();
    e.stopPropagation();
    var dropNow = Date.now();
    if (dropNow - _dbDropGuardMs < 500) return;
    _dbDropGuardMs = dropNow;
    _dbSuppressSidebarDblClickUntil = dropNow + 700;
    var wrap = document.getElementById('dbCanvasWrap');
    if (wrap) wrap.style.outline = '';
    var canvas = document.getElementById('dbCanvas');
    if (!canvas || !dbEditor.projectId) return;
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    var dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length) {
      await dbUploadImageFilesToCanvas(dt.files, mx, my);
      return;
    }
    var payload = dt ? dt.getData('text/plain') : '';
    if (payload === 'item') {
      var dragIdx = dbReadDragSourceIdx(dt);
      var items = window._dbDragSourceItems || dbGetFilteredSourceItems();
      var it = dragIdx != null ? items[dragIdx] : null;
      window._dbDragSourceItems = null;
      window._dbDragSourceIdx = null;
      if (it) dbPlaceFromSourceItem(it, mx, my);
      return;
    }
    if (!payload) return;
    var clip = dbEditor.clips.find(function(c) { return c.id === payload; });
    if (!clip) return;
    var d = clip.data;
    var imgPack = (typeof window.cchProposalLineImagesFromSource === 'function')
      ? window.cchProposalLineImagesFromSource(d)
      : { images: [], imageUrl: '', heroImageIndex: 0 };
    var primaryImg = (typeof window.cchPickPreferredProductImageUrl === 'function')
      ? String(window.cchPickPreferredProductImageUrl(d) || '').trim()
      : '';
    if (!primaryImg) primaryImg = imgPack.imageUrl || _resolveImgSrc(String(d.imageUrl || '').trim()) || _firstCoercedGalleryUrl(d) || '';
    dbPlaceProductOnCanvas(primaryImg, {
      clipId: payload,
      images: (imgPack.images && imgPack.images.length) ? imgPack.images.slice() : (primaryImg ? [primaryImg] : []),
      heroImageIndex: imgPack.heroImageIndex || 0,
      title: d.title || 'Untitled',
      vendor: d.vendor || '',
      cost: parseFloat(d.cost) || 0,
      sellPrice: parseFloat(d.clientPrice) || parseFloat(d.sellingPrice) || 0,
      showPrice: true
    }, mx, my);
  };

  window.addImageFromComputer = function() {
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.multiple = true;
    inp.onchange = async function() {
      if (!inp.files || !inp.files.length) return;
      await dbUploadImageFilesToCanvas(inp.files, 120, 120);
      inp.value = '';
    };
    inp.click();
  };

  function dbRefreshAllPricingVisibility() {
    (dbEditor.elements || []).forEach(function(el) {
      if (!el) return;
      if (el.type === 'product' || el.type === 'image') {
        dbPatchProductTail(el);
      } else if (el.type === 'pricetag') {
        var showP = dbEditor.showPricing && !dbEditor.clientView;
        var node = dbFindElementDomNode(el.id);
        if (showP && !node) dbAppendElementDom(el);
        else if (!showP && node) dbRemoveElementDom(el.id);
        else if (showP && node) dbPatchElementVisual(el);
      }
    });
  }

  // ==================== PRICING & VIEW TOGGLE ====================
  window.toggleBoardPricing = function(show) {
    dbEditor.showPricing = show;
    dbRefreshAllPricingVisibility();
  };

  window.toggleClientView = function() {
    var entering = !dbEditor.clientView;
    if (entering) {
      dbEditor._preClientViewScale = dbEditor.canvasScale;
      dbEditor._preClientViewZoomMode = dbEditor.viewZoomMode;
    } else {
      if (dbEditor._preClientViewZoomMode) dbEditor.viewZoomMode = dbEditor._preClientViewZoomMode;
      if (dbEditor._preClientViewScale != null) dbEditor.canvasScale = dbEditor._preClientViewScale;
    }
    dbEditor.clientView = entering;
    dbCancelActiveDrag();
    dbEditor.selectedId = null;
    dbUpdateSelectionDom();
    dbApplyClientViewLayout();
  };

  /** Persist imageUrl/images on product tiles from clips so client board does not depend on a second fetch. */
  function enrichProductElementsFromClipsForSave() {
    if (!dbEditor.clips || !dbEditor.elements) return;
    dbEditor.elements.forEach(function(el) {
      if (!el || el.type !== 'product' || !el.clipId) return;
      if (el._boardImageOverride) return;
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
      var normSave = dbNormalizeBoardElements(dbEditor.elements);
      dbEditor.elements = normSave.elements;
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
    // Guard: html2canvas is memory-heavy with many large/cross-origin images. Prevent re-entry
    // and confirm first so this can never run away and lock the browser/computer.
    if (window._dbExporting) return;
    var canvas = document.getElementById('dbCanvas');
    if (!canvas) return;
    if (typeof cchConfirm === 'function') {
      var go = await cchConfirm('Create a PNG image of this board?\n\nThis can be slow and memory-heavy on boards with many large images. For a reliable copy, use "Print board" instead.', 'Download PNG', { confirmText: 'Create PNG', cancelText: 'Cancel' });
      if (!go) return;
    }
    window._dbExporting = true;

    dbEditor.selectedId = null;
    if (typeof dbUpdateSelectionDom === 'function') dbUpdateSelectionDom();

    if (!window.html2canvas) {
      try {
        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        document.head.appendChild(script);
        await new Promise(function(resolve, reject) { script.onload = resolve; script.onerror = reject; });
      } catch (eLoad) {
        window._dbExporting = false;
        if (typeof cchAlert === 'function') await cchAlert('Could not load the image library. Use "Print board" instead.', 'Export');
        return;
      }
    }

    try {
      var c = await html2canvas(canvas, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      var link = document.createElement('a');
      link.download = (dbEditor.boardData.title || 'design-board') + '.png';
      link.href = c.toDataURL('image/png');
      link.click();
    } catch(e) {
      if (typeof cchAlert === 'function') await cchAlert('Export error: ' + (e && e.message) + '\nTry "Print board" instead.', 'Export');
      else alert('Export error: ' + (e && e.message));
    } finally {
      window._dbExporting = false;
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
    dbPlaceProductOnCanvas(url, {
      title: String(titleOpt || '').trim(),
      w: 250,
      h: 250,
      showPrice: false
    }, 100, 100);
  };

  /** Update existing tile image in place (keeps el.id + clipId; does not create library/clip rows). */
  function dbApplyImageReplaceToElement(el, imageUrl) {
    if (!el || !imageUrl) return false;
    var url = String(imageUrl).trim();
    if (!url) return false;
    if (typeof window._resolveImgSrc === 'function') {
      url = window._resolveImgSrc(url) || url;
    }
    pushUndo();
    el.imageUrl = url;
    el.images = [url];
    el.heroImageIndex = 0;
    el._boardImageOverride = true;
    el._boardImageReplacedAt = new Date().toISOString();
    delete el.img;
    dbEditor.dirty = true;
    if (!dbPatchElementImage(el)) renderCanvas();
    renderProps();
    return true;
  }

  async function dbUploadReplaceImageForElement(el, file) {
    if (!el || !file || !dbEditor.projectId || !dbEditor.boardId) return;
    if (!dbIsImageUploadFile(file)) {
      if (typeof showToast === 'function') showToast('Choose an image file (JPEG, PNG, WebP, etc.)', 'warning');
      return;
    }
    if (typeof showToast === 'function') showToast('Uploading replacement image…', 2500);
    try {
      var rawExt = (file.name.split('.').pop() || 'jpeg').toLowerCase().replace(/[^a-z0-9]/g, '');
      var ext = rawExt && rawExt.length <= 8 ? rawExt : 'jpeg';
      var ts = Date.now() + '-' + Math.random().toString(36).slice(2, 9);
      var safeElId = String(el.id || 'tile').replace(/[^a-zA-Z0-9_-]/g, '_');
      var path = 'projects/' + dbEditor.projectId + '/designboards/' + dbEditor.boardId + '/tiles/' + safeElId + '/' + ts + '.' + ext;
      var ref = firebase.storage().ref(path);
      await ref.put(file, { contentType: dbGuessImageContentType(file, ext) });
      var url = await ref.getDownloadURL();
      dbApplyImageReplaceToElement(el, url);
      if (typeof showToast === 'function') showToast('Image replaced on this tile — click Save to persist.', 4000);
    } catch (err) {
      console.warn('[design board] replace image', err);
      if (typeof cchAlert === 'function') await cchAlert('Upload failed: ' + ((err && err.message) || err), 'Replace image');
    }
  }

  window.replaceSelectedProductImage = function() {
    var el = dbEditor.elements.find(function(e) { return e.id === dbEditor.selectedId; });
    if (!el || (el.type !== 'product' && el.type !== 'image')) {
      if (typeof showToast === 'function') showToast('Select a product image on the board first', 'warning');
      return;
    }
    var inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = async function() {
      if (!inp.files || !inp.files[0]) return;
      await dbUploadReplaceImageForElement(el, inp.files[0]);
      inp.value = '';
    };
    inp.click();
  };

  window.replaceSelectedProductImageUrl = async function() {
    var el = dbEditor.elements.find(function(e) { return e.id === dbEditor.selectedId; });
    if (!el || (el.type !== 'product' && el.type !== 'image')) {
      if (typeof showToast === 'function') showToast('Select a product image on the board first', 'warning');
      return;
    }
    if (typeof cchPrompt !== 'function') return;
    var url = await cchPrompt('Paste replacement image URL (https://…):', String(el.imageUrl || ''), 'Replace image');
    if (url === null) return;
    url = String(url || '').trim();
    if (!url) return;
    if (dbApplyImageReplaceToElement(el, url)) {
      if (typeof showToast === 'function') showToast('Image URL updated on this tile — click Save to persist.', 3500);
    }
  };

  /** Promise-based room picker: dropdown of project rooms + optional custom entry. Resolves '' if skipped. */
  function dbPickRoom(defaultRoom, roomsOverride, opts) {
    opts = opts || {};
    var pickTitle = opts.title || 'Room for this proposal';
    var pickNote = opts.note || 'Fills the room on the new proposal&rsquo;s line items (where a line has no room yet).';
    return new Promise(function(resolve) {
      var rooms = (roomsOverride && roomsOverride.length) ? roomsOverride : ((dbEditor && dbEditor.projectRooms) || []);
      var existing = document.getElementById('dbRoomPickOverlay');
      if (existing) existing.remove();
      var ov = document.createElement('div');
      ov.id = 'dbRoomPickOverlay';
      ov.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(15,26,46,0.45);display:flex;align-items:center;justify-content:center;';
      var opts = '<option value="">— No room —</option>' + rooms.map(function(r) {
        return '<option value="' + escAttr(r) + '"' + (defaultRoom && r === defaultRoom ? ' selected' : '') + '>' + esc(r) + '</option>';
      }).join('');
      ov.innerHTML =
        '<div style="background:#fff;border-radius:10px;width:360px;box-shadow:0 20px 60px rgba(0,0,0,0.3);overflow:hidden;" onclick="event.stopPropagation()">' +
          '<div style="padding:14px 18px;border-bottom:1px solid #eee;font-weight:700;color:#1B3352;">' + esc(pickTitle) + '</div>' +
          '<div style="padding:16px 18px;">' +
            '<label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">Pick from project rooms</label>' +
            '<select id="dbRoomPickSel" style="width:100%;padding:8px;border:1px solid #d0d5dd;border-radius:6px;font-size:13px;box-sizing:border-box;background:#fff;">' + opts + '</select>' +
            '<label style="font-size:11px;color:#888;display:block;margin:12px 0 4px;">or type a new room (optional)</label>' +
            '<input id="dbRoomPickCustom" type="text" placeholder="e.g. Primary Bedroom" style="width:100%;padding:8px;border:1px solid #d0d5dd;border-radius:6px;font-size:13px;box-sizing:border-box;">' +
            '<div style="font-size:11px;color:#999;margin-top:8px;line-height:1.4;">' + pickNote + '</div>' +
          '</div>' +
          '<div style="padding:12px 18px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:8px;">' +
            '<button class="btn btn-secondary btn-sm" id="dbRoomPickCancel">Skip</button>' +
            '<button class="btn btn-primary btn-sm" id="dbRoomPickOk">Use room</button>' +
          '</div>' +
        '</div>';
      var onKey;
      var done = function(val) {
        try { document.removeEventListener('keydown', onKey, true); } catch (e) {}
        if (ov && ov.parentNode) ov.remove();
        resolve(val);
      };
      onKey = function(ev) { if (ev.key === 'Escape' || ev.keyCode === 27) { ev.preventDefault(); done(''); } };
      ov.onclick = function(e) { if (e.target === ov) done(''); };
      document.body.appendChild(ov);
      document.addEventListener('keydown', onKey, true);
      var cancelBtn = ov.querySelector('#dbRoomPickCancel');
      var okBtn = ov.querySelector('#dbRoomPickOk');
      if (cancelBtn) cancelBtn.onclick = function() { done(''); };
      if (okBtn) okBtn.onclick = function() {
        var custom = String((ov.querySelector('#dbRoomPickCustom') || {}).value || '').trim();
        var selv = (ov.querySelector('#dbRoomPickSel') || {}).value || '';
        done(custom || selv);
      };
    });
  }
  window.dbPickRoom = dbPickRoom;

  window.createProposalFromBoard = async function() {
    var products = dbEditor.elements.filter(function(el) { return el.type === 'product'; });
    if (products.length === 0) {
      if (typeof cchAlert === 'function') await cchAlert('No product items on this board yet.', 'Proposal');
      else alert('No product items on this board yet.');
      return;
    }
    if (typeof cchPrompt !== 'function') return;
    var proNum = '';
    if (typeof window.getNextDocNumber === 'function') {
      try { proNum = await window.getNextDocNumber('PRO'); } catch (e) {}
    }
    var defName = proNum || ((dbEditor.boardData.title || dbEditor.boardData.name || 'Board') + ' - Proposal');
    var name = await cchPrompt('New proposal — name (defaults to next number):', defName, 'New proposal');
    if (name === null) return;
    name = String(name || '').trim();
    if (!name) return;

    // Inherit the board's room if it already has one — don't ask again. Only prompt when the board has no room.
    var boardRoom = String((dbEditor.boardData && dbEditor.boardData.room) || '').trim();
    var chosenRoom = boardRoom || (await dbPickRoom(''));

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
      var lineRoom = String(el.room || el.roomName || '').trim() || chosenRoom || '';
      return {
        title: el.title || 'Untitled',
        vendor: el.vendor || '',
        room: lineRoom,
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
      var _cUser = (typeof currentUser !== 'undefined' && currentUser) ? (currentUser.displayName || currentUser.email || 'Unknown') : 'Unknown';
      var doc = await db.collection('boards').doc(dbEditor.projectId).collection('proposals').add({
        name: name,
        proposalNum: proNum || name,
        items: items,
        total: total,
        status: 'Draft',
        designBoardId: dbEditor.boardId,
        createdAt: new Date().toISOString(),
        createdBy: _cUser
      });
      try { await db.collection('boards').doc(dbEditor.projectId).update({ proposalCount: firebase.firestore.FieldValue.increment(1) }); } catch (e) {}
      if (typeof cchAlert === 'function') await cchAlert('Proposal created with ' + items.length + ' items ($' + total.toLocaleString() + ').', 'Proposal');
      else alert('Proposal created with ' + items.length + ' items ($' + total.toLocaleString() + ')');
      navigate('#/project/' + dbEditor.projectId + '/proposal/' + doc.id);
    } catch(e) {
      if (typeof cchAlert === 'function') await cchAlert('Error creating proposal: ' + e.message, 'Proposal');
      else alert('Error creating proposal: ' + e.message);
    }
  };

  // ==================== Board Cost Summary (lightweight estimate) ============================
  // A quick priced summary of the products on the board. NOT a proposal/saved doc — just the
  // costs on the page, with a client/internal toggle. Non-product items (raw images, notes,
  // arrows) are excluded from totals; images get a nudge to the existing New Product modal.
  window.showBoardCostSummary = function() {
    var els = (dbEditor && dbEditor.elements) || [];
    var products = els.filter(function(el) { return el && el.type === 'product'; });
    var images = els.filter(function(el) { return el && el.type === 'image'; });
    if (window._dbCostSummaryClient == null) window._dbCostSummaryClient = !!(dbEditor && dbEditor.clientView);
    var clientMode = !!window._dbCostSummaryClient;

    var existing = document.getElementById('dbCostSummaryOverlay');
    if (existing) existing.remove();

    var MONO = 'ui-monospace,SFMono-Regular,Menlo,monospace';
    var totalCost = 0, totalSell = 0;
    products.forEach(function(el) { totalCost += parseFloat(el.cost) || 0; totalSell += parseFloat(el.sellPrice) || 0; });

    var rows = products.map(function(el) {
      var cost = parseFloat(el.cost) || 0;
      var sell = parseFloat(el.sellPrice) || 0;
      var mk = (cost > 0 && sell > 0) ? Math.round((sell - cost) / cost * 100) : null;
      var thumb = el.imageUrl
        ? '<img src="' + escAttr(el.imageUrl) + '" referrerpolicy="no-referrer" style="width:40px;height:40px;object-fit:cover;border-radius:3px;background:#f0f0f0;flex-shrink:0;">'
        : '<div style="width:40px;height:40px;border-radius:3px;background:#f0f0f0;flex-shrink:0;"></div>';
      var nameCell = '<td style="padding:8px 10px;"><div style="display:flex;align-items:center;gap:10px;">' + thumb +
        '<div><div style="font-weight:600;font-size:13px;color:#1B3352;">' + esc(el.title || 'Untitled') + '</div>' +
        (el.vendor ? '<div style="font-size:11px;color:#888;">' + esc(el.vendor) + '</div>' : '') + '</div></div></td>';
      var dash = '<span style="color:#bbb;">—</span>';
      if (clientMode) {
        return '<tr style="border-bottom:1px solid #eee;">' + nameCell +
          '<td style="padding:8px 10px;text-align:right;font-weight:600;font-family:' + MONO + ';color:#1B3352;">' + (sell > 0 ? fmt$(sell) : dash) + '</td></tr>';
      }
      return '<tr style="border-bottom:1px solid #eee;">' + nameCell +
        '<td style="padding:8px 10px;text-align:right;font-family:' + MONO + ';color:#666;">' + (cost > 0 ? fmt$(cost) : dash) + '</td>' +
        '<td style="padding:8px 10px;text-align:right;font-size:12px;color:#888;">' + (mk != null ? mk + '%' : '—') + '</td>' +
        '<td style="padding:8px 10px;text-align:right;font-weight:600;font-family:' + MONO + ';color:#1B3352;">' + (sell > 0 ? fmt$(sell) : dash) + '</td></tr>';
    }).join('');

    var thS = 'text-align:right;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#999;';
    var headCols = clientMode
      ? '<th style="text-align:left;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#999;">Item</th><th style="' + thS + '">Price</th>'
      : '<th style="text-align:left;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#999;">Item</th><th style="' + thS + '">Cost</th><th style="' + thS + '">Markup</th><th style="' + thS + '">Sell</th>';

    var totalsRow = clientMode
      ? '<tr style="border-top:2px solid #1B3352;"><td style="padding:12px 10px;font-weight:700;color:#1B3352;">Total</td><td style="padding:12px 10px;text-align:right;font-weight:700;font-size:15px;color:#1B3352;font-family:' + MONO + ';">' + fmt$(totalSell) + '</td></tr>'
      : '<tr style="border-top:2px solid #1B3352;"><td style="padding:12px 10px;font-weight:700;color:#1B3352;">Total</td><td style="padding:12px 10px;text-align:right;font-weight:700;font-family:' + MONO + ';color:#666;">' + fmt$(totalCost) + '</td><td></td><td style="padding:12px 10px;text-align:right;font-weight:700;font-size:15px;color:#1B3352;font-family:' + MONO + ';">' + fmt$(totalSell) + '</td></tr>';

    var emptyMsg = products.length === 0
      ? '<tr><td colspan="' + (clientMode ? 2 : 4) + '" style="padding:24px;text-align:center;color:#999;">No products on this board yet.</td></tr>'
      : '';

    var nudge = '';
    if (images.length) {
      var plural = images.length > 1;
      nudge = '<div style="margin-top:14px;padding:12px 14px;background:#fdf6e8;border:1px solid #e8d9b0;border-radius:6px;font-size:12px;color:#7a5b1e;line-height:1.5;">' +
        '<strong>' + images.length + '</strong> image' + (plural ? 's' : '') + ' on this board ' + (plural ? "aren't" : "isn't") +
        ' a product yet, so ' + (plural ? "they're" : "it's") + ' not in the totals. ' +
        '<button class="btn btn-secondary btn-sm" style="margin-left:6px;" onclick="dbCostSummaryMakeProductFromImages()">+ Make a product</button></div>';
    }

    var boardName = _dbBoardLabel(dbEditor.boardData);
    var overlay = document.createElement('div');
    overlay.id = 'dbCostSummaryOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,26,46,0.45);display:flex;align-items:center;justify-content:center;padding:24px;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:10px;max-width:640px;width:100%;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.3);" onclick="event.stopPropagation()">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #eee;">' +
          '<div><div style="font-weight:700;font-size:18px;color:#1B3352;line-height:1.25;">' + esc(boardName) + '</div>' +
            '<div style="font-size:11px;color:#888;margin-top:4px;letter-spacing:0.04em;text-transform:uppercase;">Cost Summary · ' + products.length + ' product' + (products.length === 1 ? '' : 's') + ' · ' + (clientMode ? 'Client view — sell price only' : 'Internal view — cost + markup') + '</div></div>' +
          '<div style="display:flex;gap:10px;align-items:center;">' +
            '<div style="display:inline-flex;border:1px solid #d0d5dd;border-radius:6px;overflow:hidden;font-size:12px;font-weight:700;line-height:1;">' +
              '<button title="Internal: shows trade cost, markup and sell" onclick="if(window._dbCostSummaryClient){dbToggleCostSummaryView();}" style="padding:7px 14px;border:none;cursor:pointer;' + (!clientMode ? 'background:#0A1F3D;color:#fff;' : 'background:#fff;color:#0A1F3D;') + '">Internal</button>' +
              '<button title="Client: shows sell price only (no cost or markup)" onclick="if(!window._dbCostSummaryClient){dbToggleCostSummaryView();}" style="padding:7px 14px;border:none;border-left:1px solid #d0d5dd;cursor:pointer;' + (clientMode ? 'background:#0A1F3D;color:#fff;' : 'background:#fff;color:#0A1F3D;') + '">Client</button>' +
            '</div>' +
            '<button class="btn btn-secondary btn-sm" onclick="var o=document.getElementById(\'dbCostSummaryOverlay\');if(o)o.remove();">✕</button>' +
          '</div>' +
        '</div>' +
        '<div style="padding:16px 20px;overflow-y:auto;">' +
          '<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="border-bottom:2px solid #ddd;">' + headCols + '</tr></thead>' +
          '<tbody>' + rows + emptyMsg + '</tbody><tfoot>' + (products.length ? totalsRow : '') + '</tfoot></table>' +
          nudge +
        '</div>' +
        '<div style="padding:12px 20px;border-top:1px solid #eee;display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
          '<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#666;cursor:pointer;">' +
            '<input type="checkbox" ' + (window._dbCostSummaryNoImages !== true ? 'checked' : '') + ' onchange="window._dbCostSummaryNoImages=!this.checked;"> Images on print</label>' +
          '<div style="display:flex;gap:8px;">' +
            '<button class="btn btn-secondary btn-sm" onclick="dbPrintCostSummary()">🖨 Print</button>' +
            '<button class="btn btn-primary btn-sm" onclick="var o=document.getElementById(\'dbCostSummaryOverlay\');if(o)o.remove();">Done</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
  };

  window.dbToggleCostSummaryView = function() {
    window._dbCostSummaryClient = !window._dbCostSummaryClient;
    window.showBoardCostSummary();
  };

  window.dbCostSummaryMakeProductFromImages = function() {
    var img = ((dbEditor && dbEditor.elements) || []).find(function(el) { return el && el.type === 'image'; });
    var ov = document.getElementById('dbCostSummaryOverlay');
    if (ov) ov.remove();
    if (typeof window.showNewProductModal === 'function') {
      var pf = img
        ? { title: img.caption || img.title || '', imageUrl: img.img || '', images: img.img ? [img.img] : [] }
        : {};
      window.showNewProductModal(pf);
    } else if (typeof cchAlert === 'function') {
      cchAlert('The New Product form is not available from here. Add the product from the Library tab.', 'Cost Summary');
    }
  };

  window.dbPrintCostSummary = function() {
    var clientMode = !!window._dbCostSummaryClient;
    var withImages = window._dbCostSummaryNoImages !== true;
    var products = ((dbEditor && dbEditor.elements) || []).filter(function(el) { return el && el.type === 'product'; });
    var totalCost = 0, totalSell = 0;
    var imgCell = function(el) {
      if (!withImages) return '';
      return el.imageUrl
        ? '<td class="ts-img"><img src="' + escAttr(el.imageUrl) + '" referrerpolicy="no-referrer"></td>'
        : '<td class="ts-img"><div class="ts-img-ph"></div></td>';
    };
    var body = products.map(function(el) {
      var cost = parseFloat(el.cost) || 0, sell = parseFloat(el.sellPrice) || 0;
      totalCost += cost; totalSell += sell;
      var nm = esc(el.title || 'Untitled') + (el.vendor ? ' <span style="color:#888;">— ' + esc(el.vendor) + '</span>' : '');
      if (clientMode) return '<tr>' + imgCell(el) + '<td>' + nm + '</td><td style="text-align:right;">' + (sell > 0 ? fmt$(sell) : '—') + '</td></tr>';
      var mk = (cost > 0 && sell > 0) ? Math.round((sell - cost) / cost * 100) + '%' : '—';
      return '<tr>' + imgCell(el) + '<td>' + nm + '</td><td style="text-align:right;">' + (cost > 0 ? fmt$(cost) : '—') + '</td><td style="text-align:right;">' + mk + '</td><td style="text-align:right;">' + (sell > 0 ? fmt$(sell) : '—') + '</td></tr>';
    }).join('');
    var imgTh = withImages ? '<th></th>' : '';
    var imgTotalTd = withImages ? '<td></td>' : '';
    var head = clientMode
      ? '<tr>' + imgTh + '<th style="text-align:left;">Item</th><th style="text-align:right;">Price</th></tr>'
      : '<tr>' + imgTh + '<th style="text-align:left;">Item</th><th style="text-align:right;">Cost</th><th style="text-align:right;">Markup</th><th style="text-align:right;">Sell</th></tr>';
    var totals = clientMode
      ? '<tr style="font-weight:700;border-top:2px solid #000;">' + imgTotalTd + '<td>Total</td><td style="text-align:right;">' + fmt$(totalSell) + '</td></tr>'
      : '<tr style="font-weight:700;border-top:2px solid #000;">' + imgTotalTd + '<td>Total</td><td style="text-align:right;">' + fmt$(totalCost) + '</td><td></td><td style="text-align:right;">' + fmt$(totalSell) + '</td></tr>';
    var roomLabel = esc(_dbBoardLabel(dbEditor.boardData));
    var w = window.open('', '_blank');
    if (!w) { if (typeof cchAlert === 'function') cchAlert('Allow pop-ups to print the summary.', 'Cost Summary'); return; }
    w.document.write('<html><head><title>' + roomLabel + ' — Cost Summary</title><style>@page{margin:0.75in;}body{font-family:Georgia,serif;padding:40px;color:#1B3352;}h1{font-size:22px;font-weight:700;margin:0;line-height:1.25;} .db-cs-sub{color:#888;font-size:11px;margin-top:6px;letter-spacing:0.05em;text-transform:uppercase;}table{width:100%;border-collapse:collapse;font-size:13px;margin-top:18px;}th,td{padding:8px 10px;border-bottom:1px solid #eee;vertical-align:middle;}th{font-size:10px;text-transform:uppercase;letter-spacing:0.05em;color:#999;}td.ts-img{width:56px;padding:6px 10px;}td.ts-img img{width:48px;height:48px;object-fit:cover;border-radius:3px;display:block;}td.ts-img .ts-img-ph{width:48px;height:48px;border-radius:3px;background:#f0f0f0;}@media print{img{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}</style></head><body><h1>' + roomLabel + '</h1><div class="db-cs-sub">Cost Summary</div><table><thead>' + head + '</thead><tbody>' + body + totals + '</tbody></table></body></html>');
    w.document.close();
    w.focus();
    w.onafterprint = function() { try { w.close(); } catch (e) {} };
    setTimeout(function() { try { w.print(); } catch (e) {} }, 600);
  };

  // Global safety net: Escape always tears down any board overlay so input can never get trapped.
  if (!window._dbOverlayEscBound) {
    window._dbOverlayEscBound = true;
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        ['dbPrintMenuOverlay', 'dbCostSummaryOverlay'].forEach(function(id) {
          var n = document.getElementById(id);
          if (n) n.remove();
        });
      }
    }, true);
  }

  // ==================== Print / Export menu ============================
  window.dbOpenPrintMenu = function() {
    var existing = document.getElementById('dbPrintMenuOverlay');
    if (existing) existing.remove();
    var rm = "var o=document.getElementById('dbPrintMenuOverlay');if(o)o.remove();";
    var ov = document.createElement('div');
    ov.id = 'dbPrintMenuOverlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(15,26,46,0.45);display:flex;align-items:center;justify-content:center;';
    ov.onclick = function(e) { if (e.target === ov) ov.remove(); };
    ov.innerHTML =
      '<div style="background:#fff;border-radius:10px;width:340px;box-shadow:0 20px 60px rgba(0,0,0,0.3);overflow:hidden;" onclick="event.stopPropagation()">' +
        '<div style="padding:14px 18px;border-bottom:1px solid #eee;font-weight:700;color:#1B3352;">Print / Export</div>' +
        '<div style="padding:14px 18px;display:flex;flex-direction:column;gap:10px;">' +
          '<button class="btn btn-secondary" style="justify-content:flex-start;" onclick="' + rm + 'dbPrintBoard();">🖼 Print board</button>' +
          '<button class="btn btn-secondary" style="justify-content:flex-start;" onclick="' + rm + 'showBoardCostSummary();">💲 Cost summary (print from there)</button>' +
          '<button class="btn btn-secondary" style="justify-content:flex-start;" onclick="' + rm + 'exportBoardPNG();">⬇ Download board image (PNG)</button>' +
          '<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#4B5563;cursor:pointer;margin-top:4px;">' +
            '<input type="checkbox" id="dbPrintIncludeName"' + (window._dbPrintIncludeBoardName ? ' checked' : '') + ' onchange="window._dbPrintIncludeBoardName=!!this.checked">' +
            ' Include board / room name as footnote on print</label>' +
          '<div style="font-size:11px;color:#999;line-height:1.4;">Use <strong>Heading</strong> or <strong>Text</strong> on the board for titles. The footnote is optional — off by default.</div>' +
          '<div style="font-size:11px;color:#999;line-height:1.4;">PNG download can fail when the board has images from sites that block copying. Use <strong>Print board</strong> for a reliable copy.</div>' +
        '</div>' +
        '<div style="padding:10px 18px;border-top:1px solid #eee;text-align:right;"><button class="btn btn-secondary btn-sm" onclick="' + rm + '">Close</button></div>' +
      '</div>';
    document.body.appendChild(ov);
  };

  window.dbPrintBoard = function() {
    var canvas = document.getElementById('dbCanvas');
    if (!canvas) return;
    dbEditor.selectedId = null;
    if (typeof dbUpdateSelectionDom === 'function') dbUpdateSelectionDom();
    var cw = parseFloat(canvas.style.width) || canvas.offsetWidth || 1920;
    var ch = parseFloat(canvas.style.height) || canvas.offsetHeight || 1080;
    var w = window.open('', '_blank');
    if (!w) { if (typeof cchAlert === 'function') cchAlert('Allow pop-ups to print the board.', 'Print'); return; }
    var styles = '';
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(function(n) { styles += n.outerHTML; });
    var boardLabel = esc(_dbBoardLabel(dbEditor.boardData));
    var includeName = !!window._dbPrintIncludeBoardName;
    var clone = canvas.cloneNode(true);
    clone.querySelectorAll('.db-resize').forEach(function(n) { n.remove(); });
    var hint = clone.querySelector('#dbCanvasDropHint');
    if (hint) hint.remove();
    clone.style.boxShadow = 'none';
    var footnote = includeName
      ? '<div class="db-print-footnote">' + boardLabel + '</div>'
      : '';
    var html = '<html><head><title>' + boardLabel + ' — Design Board</title>' + styles +
      '<style>@page{margin:10mm;}html,body{margin:0;padding:0;background:#fff;}' +
      '.db-print-sheet{padding:4mm 6mm 6mm;box-sizing:border-box;}' +
      '#dbPrintWrap{width:100%;max-width:' + cw + 'px;margin:0 auto;overflow:hidden;}' +
      '#dbPrintInner{transform-origin:top center;width:' + cw + 'px;margin:0 auto;}' +
      '.db-print-footnote{margin:10px auto 0;max-width:' + cw + 'px;text-align:center;font-family:Georgia,serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;}' +
      '.db-el-caption{font-size:14px !important;}.db-el-desc{font-size:12px !important;}.db-el-price{font-size:14px !important;}' +
      '@media print{img{-webkit-print-color-adjust:exact;print-color-adjust:exact;} .db-print-sheet{padding:0;}}' +
      '</style></head><body><div class="db-print-sheet"><div id="dbPrintWrap"><div id="dbPrintInner">' + clone.outerHTML + '</div></div>' + footnote + '</div>' +
      '<script>(function(){var cw=' + cw + ',ch=' + ch + ';function fit(){var iw=Math.max(320,(window.innerWidth||960)-24);var ih=Math.max(320,(window.innerHeight||720)-40);var s=Math.min(1,iw/cw,ih/ch);var inner=document.getElementById("dbPrintInner");var wrap=document.getElementById("dbPrintWrap");if(inner){inner.style.transform="scale("+s+")";inner.style.height=(ch*s)+"px";}if(wrap){wrap.style.height=(ch*s)+"px";}}fit();window.onresize=fit;})();<\/script></body></html>';
    w.document.write(html);
    w.document.close();
    w.focus();
    w.onafterprint = function() { try { w.close(); } catch (e) {} };
    setTimeout(function() { try { w.print(); } catch (e) {} }, 800);
  };

  // ==================== CSS for editor ============================
  var style = document.createElement('style');
  style.textContent =
    '.db-board-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(10,31,61,0.08);}' +
    '.db-prop-input{width:100%;padding:4px 6px;border:1px solid var(--gray-200);border-radius:4px;font-size:12px;font-family:inherit;}' +
      '.db-prop-input:focus{border-color:var(--gold);outline:none;}' +
      '.db-el-selected.db-el-product .db-el-media{outline:2px solid var(--gold);outline-offset:2px;}' +
      '.db-el-selected:not(.db-el-product){outline:2px solid var(--gold);outline-offset:2px;}' +
      '#dbCanvas{font-family:"Cormorant Garamond",Georgia,serif;}' +
    '.db-clip-item{-webkit-user-drag:element;}';
  document.head.appendChild(style);

  window._cchDesignBoardOpen = window.openDesignBoard;
  window._cchDesignBoardUseExternal = true;

  function dbElementBox(el) {
    var w = el.w || 180;
    var h = el.h || 180;
    return {
      x: el.x || 0,
      y: el.y || 0,
      w: w,
      h: h,
      right: (el.x || 0) + w,
      bottom: (el.y || 0) + h
    };
  }

  function dbBoxesOverlap(a, b, pad) {
    pad = pad == null ? 8 : pad;
    return !(a.right + pad <= b.x || b.right + pad <= a.x || a.bottom + pad <= b.y || b.bottom + pad <= a.y);
  }

  function dbCountOverlappingTiles() {
    var tiles = (dbEditor.elements || []).filter(function(e) {
      return e && (e.type === 'product' || e.type === 'image');
    });
    var n = 0;
    for (var i = 0; i < tiles.length; i++) {
      for (var j = i + 1; j < tiles.length; j++) {
        if (dbBoxesOverlap(dbElementBox(tiles[i]), dbElementBox(tiles[j]))) n++;
      }
    }
    return n;
  }

  /** Nudge overlapping product tiles apart — keeps every item, only moves x/y. */
  function dbSpreadStackedTiles() {
    var maxW = (dbEditor.boardData && dbEditor.boardData.canvasWidth) || 1400;
    var maxH = (dbEditor.boardData && dbEditor.boardData.canvasHeight) || 1000;
    var tiles = (dbEditor.elements || []).filter(function(e) {
      return e && (e.type === 'product' || e.type === 'image');
    });
    var moved = 0;
    for (var pass = 0; pass < 12; pass++) {
      var any = false;
      for (var i = 0; i < tiles.length; i++) {
        for (var j = 0; j < i; j++) {
          var a = tiles[i];
          var b = tiles[j];
          var boxA = dbElementBox(a);
          var boxB = dbElementBox(b);
          if (!dbBoxesOverlap(boxA, boxB)) continue;
          any = true;
          moved++;
          a.y = boxB.bottom + 12;
          if (a.y + boxA.h > maxH - 24) {
            a.y = boxB.y;
            a.x = boxB.right + 12;
          }
          if (a.x + boxA.w > maxW - 24) {
            a.x = Math.max(0, (a.x || 0) + 28);
          }
          a.x = Math.max(0, a.x || 0);
          a.y = Math.max(0, a.y || 0);
        }
      }
      if (!any) break;
    }
    return moved;
  }

  function dbShowOverlapBanner(overlapPairs) {
    if (!overlapPairs || overlapPairs < 1) return;
    var root = document.getElementById('dbEditorRoot');
    if (!root || document.getElementById('dbOverlapBanner')) return;
    var bar = document.createElement('div');
    bar.id = 'dbOverlapBanner';
    bar.style.cssText = 'padding:10px 14px;background:rgba(180,83,9,0.1);border-bottom:1px solid rgba(180,83,9,0.25);font-size:12px;color:#92400E;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;';
    bar.innerHTML = '<span><strong>Stacked tiles detected</strong> — ' + overlapPairs + ' overlap' + (overlapPairs !== 1 ? 's' : '') + '. Your work is safe. <strong>Repair board</strong> spreads them apart without deleting anything.</span>' +
      '<span style="display:flex;gap:8px;flex-shrink:0;">' +
        '<button type="button" class="btn btn-primary btn-sm" onclick="void dbRepairBoard(true)">Repair board</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById(\'dbOverlapBanner\').remove()">Dismiss</button>' +
      '</span>';
    var tb = document.getElementById('dbToolbar');
    if (tb && tb.parentNode) tb.parentNode.insertBefore(bar, tb.nextSibling);
  }

  /** Unstick gestures + purge ghosts + spread stacked tiles. Never deletes elements. */
  window.dbRepairBoard = function(fromBanner) {
    try {
      dbForceRemoveAllDragListeners();
      dbClearAllDragTransforms();
      dbEditor.isDragging = false;
      dbEditor.isResizing = false;
      dbEditor.selectedId = null;
      dbEditor.arrowStart = null;
      dbEditor.tool = 'select';
      dbEditor._propsPanelForId = null;
      _dbSuppressSidebarDblClickUntil = 0;

      if (typeof window.closeModal === 'function') window.closeModal();
      var mc = document.getElementById('modalContainer');
      if (mc) mc.innerHTML = '';
      var coverModal = document.getElementById('dbCoverPickerModal');
      if (coverModal) coverModal.remove();

      var spreadCount = dbSpreadStackedTiles();
      if (spreadCount > 0) pushUndo();

      dbPurgeGhostDomNodes();
      renderCanvas();
      dbUpdateSelectionDom();
      refreshDbToolbarTools();
      renderProps();

      var wrap = document.getElementById('dbCanvasWrap');
      if (wrap) {
        wrap.style.outline = '';
        wrap.style.pointerEvents = '';
        wrap.style.cursor = 'default';
      }
      var stage = document.getElementById('dbCanvasStage');
      if (stage) stage.style.pointerEvents = '';
      var cvs = document.getElementById('dbCanvas');
      if (cvs) cvs.style.pointerEvents = '';
      document.body.style.pointerEvents = '';
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      var banner = document.getElementById('dbOverlapBanner');
      if (banner) banner.remove();

      if (spreadCount > 0) dbEditor.dirty = true;

      var tb = document.getElementById('dbUnstickToolbarBtn');
      if (tb) {
        tb.style.background = '#d4edda';
        setTimeout(function() { tb.style.background = ''; }, 400);
      }
      var st = document.getElementById('dbUnstickStatus');
      var msg = spreadCount > 0
        ? ('Repaired — ' + spreadCount + ' stack' + (spreadCount !== 1 ? 's' : '') + ' spread')
        : 'Repaired ✓';
      if (st) {
        st.textContent = msg;
        st.style.color = 'var(--green)';
        setTimeout(function() { st.textContent = ''; st.style.color = 'var(--gray-500)'; }, 3500);
      }
      if (typeof showToast === 'function') {
        showToast(spreadCount > 0
          ? ('Board repaired — ' + spreadCount + ' overlapping tiles spread apart. Nothing deleted.')
          : 'Board repaired — drag and selection reset.', 4000);
      }
    } catch (err) {
      console.error('[design board] repair failed:', err);
      if (typeof showToast === 'function') showToast('Repair error — hard refresh (Ctrl+Shift+R).', 5000);
    }
  };

  window.dbResetBoardInteraction = function() {
    window.dbRepairBoard();
  };

  /** Stop background renderProjectDetail() from reloading the board mid-edit (Firestore refresh storms). */
  if (typeof renderProjectDetail === 'function' && !window._cchDbRenderProjectDetailPatched) {
    window._cchDbRenderProjectDetailPatched = true;
    var _cchOrigRenderProjectDetail = renderProjectDetail;
    window.renderProjectDetail = async function() {
      var parts = (window.location.hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
      if (parts[0] === 'project' && parts[2] === 'designboard' && parts[3] &&
          window._cchDesignBoardEditorActive && window.dbEditor &&
          window.dbEditor.boardId === parts[3] && window.dbEditor.projectId === parts[1] &&
          document.getElementById('dbCanvas') && !window._cchForceDesignBoardReload) {
        return;
      }
      return _cchOrigRenderProjectDetail.apply(this, arguments);
    };
  }

  console.info('[CCH Design Board] build 20260608db29 — client-view fit + print/cost-summary polish');

})();
