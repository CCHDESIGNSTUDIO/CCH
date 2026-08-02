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
    ideabooks: [], // { id, name } for Inspiration board picker
    ibBoardId: 'All',
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
    hideClips: false,
    hideProps: false,
    undoStack: [],
    nextId: 1,
    arrowStart: null,
    dirty: false
  };
  window.dbEditor = dbEditor;

  // ---- Utility ----
  function dbElIdNum(id) {
    var m = /^el_(\d+)$/.exec(String(id || ''));
    return m ? (parseInt(m[1], 10) || 0) : 0;
  }
  /** Seed nextId from highest existing el_N (never from elements.length — deletes cause collisions). */
  function dbSeedNextIdFromElements() {
    var max = 0;
    (dbEditor.elements || []).forEach(function(el) {
      var n = dbElIdNum(el && el.id);
      if (n > max) max = n;
    });
    dbEditor.nextId = max + 1;
  }
  function genId() {
    var used = {};
    (dbEditor.elements || []).forEach(function(el) {
      if (el && el.id) used[String(el.id)] = true;
    });
    var id;
    var guard = 0;
    do {
      id = 'el_' + (dbEditor.nextId++);
      guard++;
    } while (used[id] && guard < 10000);
    return id;
  }
  /** Reassign duplicate / missing el ids on load. Content/positions untouched. Returns count healed. */
  function dbHealDuplicateElementIds() {
    var seen = {};
    var healed = 0;
    (dbEditor.elements || []).forEach(function(el) {
      if (!el) return;
      var id = el.id != null ? String(el.id) : '';
      if (!id || seen[id]) {
        var old = id || '(missing)';
        el.id = genId();
        healed++;
        console.info('[design board] healed duplicate/missing id', old, '->', el.id);
      } else {
        seen[id] = true;
      }
    });
    return healed;
  }
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

  var DB_ZOOM_MIN = 0.15;
  var DB_ZOOM_MAX = 4;

  function dbClampZoom(z) {
    z = Number(z);
    if (!isFinite(z) || z <= 0) return 1;
    return Math.max(DB_ZOOM_MIN, Math.min(DB_ZOOM_MAX, z));
  }

  /** Zoom while keeping a screen point (clientX/Y) anchored — Canva-style. */
  function dbZoomAtClientPoint(nextScale, clientX, clientY) {
    var wrap = document.getElementById('dbCanvasWrap');
    var oldZ = dbEditor.canvasScale || 1;
    var z = dbClampZoom(nextScale);
    if (Math.abs(z - oldZ) < 0.0001) {
      dbEditor.viewZoomMode = 'manual';
      dbApplyViewZoom();
      return;
    }
    dbEditor.viewZoomMode = 'manual';
    if (wrap && clientX != null && clientY != null) {
      var rect = wrap.getBoundingClientRect();
      var ox = (wrap.scrollLeft + (clientX - rect.left)) / oldZ;
      var oy = (wrap.scrollTop + (clientY - rect.top)) / oldZ;
      dbEditor.canvasScale = z;
      dbApplyViewZoom();
      wrap.scrollLeft = Math.max(0, ox * z - (clientX - rect.left));
      wrap.scrollTop = Math.max(0, oy * z - (clientY - rect.top));
      return;
    }
    dbEditor.canvasScale = z;
    dbApplyViewZoom();
  }

  function dbApplyViewZoom() {
    var stage = document.getElementById('dbCanvasStage');
    var spacer = document.getElementById('dbCanvasSpacer');
    var label = document.getElementById('dbZoomLabel');
    var cw = dbEditor.boardData.canvasWidth || 1400;
    var ch = dbEditor.boardData.canvasHeight || 1000;
    var z = dbClampZoom(dbEditor.canvasScale || 1);
    dbEditor.canvasScale = z;
    if (stage) {
      stage.style.transform = 'scale(' + z + ')';
      stage.style.transformOrigin = 'top left';
      stage.style.width = cw + 'px';
      stage.style.height = ch + 'px';
      stage.style.setProperty('--db-zoom', String(z));
    }
    if (spacer) {
      spacer.style.width = Math.ceil(cw * z + 40) + 'px';
      spacer.style.minHeight = Math.ceil(ch * z + 40) + 'px';
    }
    if (label) label.textContent = Math.round(z * 100) + '%';
    dbSyncBrandingFooter();
  }

  /** Lowest pixel row used by board tiles (for print trim + footer pin). */
  function dbComputeElementsBottom() {
    var maxB = 0;
    (dbEditor.elements || []).forEach(function(el) {
      if (!el || el.type === 'arrow') return;
      var y = el.y || 0;
      var eh = el.h || 180;
      if (el.type === 'note') eh = el.h || 56;
      else if (el.type === 'text' || el.type === 'heading') eh = Math.max(24, (el.fontSize || 16) * 1.6);
      else if (el.type === 'pricetag') eh = 22;
      var bottom = y + eh;
      if (el.type === 'product' || el.type === 'image') {
        bottom = y + (el.h || 180) + dbTileExtrasH(el);
      }
      if (bottom > maxB) maxB = bottom;
    });
    return Math.ceil(maxB);
  }

  /** Pin CCH branding to the true bottom edge of the board canvas. */
  function dbSyncBrandingFooter() {
    var branding = document.getElementById('dbBranding');
    var canvas = document.getElementById('dbCanvas');
    if (!branding || !canvas) return;
    var ch = parseInt(dbEditor.boardData && dbEditor.boardData.canvasHeight, 10) || 1000;
    canvas.style.height = ch + 'px';
    canvas.style.minHeight = ch + 'px';
    canvas.style.maxHeight = ch + 'px';
    branding.style.position = 'absolute';
    branding.style.left = '0';
    branding.style.right = '0';
    branding.style.bottom = '0';
    branding.style.top = 'auto';
    branding.style.paddingBottom = '14px';
    branding.style.margin = '0';
  }

  /** Shorter canvas for print — trims empty white below content so footer sits under tiles. */
  function dbPrintCanvasHeight() {
    var ch = parseInt(dbEditor.boardData && dbEditor.boardData.canvasHeight, 10) || 1000;
    var contentBot = dbComputeElementsBottom();
    var trimmed = Math.ceil(contentBot + 58 + 16);
    if (trimmed < 400) trimmed = 400;
    return Math.min(ch, trimmed);
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
    dbEditor.canvasScale = dbClampZoom(Math.max(0.2, z));
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

  function dbLoadPanelPrefsIntoEditor() {
    try {
      dbEditor.hideClips = localStorage.getItem('cchDbHideClips') === '1';
      dbEditor.hideProps = localStorage.getItem('cchDbHideProps') === '1';
    } catch (e) {
      dbEditor.hideClips = false;
      dbEditor.hideProps = false;
    }
  }

  function dbPersistPanelPrefs() {
    try {
      localStorage.setItem('cchDbHideClips', dbEditor.hideClips ? '1' : '0');
      localStorage.setItem('cchDbHideProps', dbEditor.hideProps ? '1' : '0');
    } catch (e) {}
  }

  /** True when the side panel is actually taking layout space (not localStorage). */
  function dbPanelIsVisiblyOpen(el) {
    if (!el || el.hidden) return false;
    if (el.classList.contains('db-side-panel-collapsed')) return false;
    if (el.style.display === 'none') return false;
    try {
      return el.getBoundingClientRect().width > 8;
    } catch (e2) {
      return false;
    }
  }

  function dbSetPanelCollapsed(el, collapse, showDisplay) {
    if (!el) return;
    el.hidden = !!collapse;
    el.classList.toggle('db-side-panel-collapsed', !!collapse);
    el.setAttribute('aria-hidden', collapse ? 'true' : 'false');
    if (collapse) {
      el.style.cssText = 'display:none!important;width:0!important;min-width:0!important;max-width:0!important;padding:0!important;margin:0!important;border:none!important;overflow:hidden!important;flex:0 0 0!important;box-sizing:border-box;';
    } else {
      el.style.cssText = 'width:240px;min-width:240px;max-width:240px;flex:0 0 240px;box-sizing:border-box;overflow-y:auto;background:#fafaf8;' +
        (showDisplay === 'flex'
          ? 'display:flex;flex-direction:column;padding:0;border-right:1px solid var(--gray-200);'
          : 'display:block;padding:12px;border-left:1px solid var(--gray-200);');
    }
  }

  /** Apply Library / Properties visibility (client view always hides both). */
  function dbApplySidePanels() {
    var cv = !!dbEditor.clientView;
    var hideLeft = cv || !!dbEditor.hideClips;
    var hideRight = cv || !!dbEditor.hideProps;
    dbSetPanelCollapsed(document.getElementById('dbClipsPanel'), hideLeft, 'flex');
    dbSetPanelCollapsed(document.getElementById('dbPropsPanel'), hideRight, 'block');
    var clipsBtn = document.getElementById('dbToggleClipsBtn');
    var propsBtn = document.getElementById('dbTogglePropsBtn');
    if (clipsBtn) {
      clipsBtn.textContent = dbEditor.hideClips ? '📚 Show Library' : '📚 Hide Library';
      clipsBtn.setAttribute('aria-pressed', dbEditor.hideClips ? 'true' : 'false');
      clipsBtn.title = dbEditor.hideClips ? 'Show Room / Inspiration / Library panel' : 'Hide left panel for a larger board';
    }
    if (propsBtn) {
      propsBtn.textContent = dbEditor.hideProps ? '⚙ Show Properties' : '⚙ Hide Properties';
      propsBtn.setAttribute('aria-pressed', dbEditor.hideProps ? 'true' : 'false');
      propsBtn.title = dbEditor.hideProps ? 'Show Properties panel' : 'Hide Properties for a larger board';
    }
  }

  window.dbToggleClipsPanel = function(ev) {
    if (ev) { try { ev.preventDefault(); ev.stopPropagation(); } catch (e0) {} }
    if (dbEditor.clientView) return;
    // Drive from DOM (not localStorage) — storage desync caused "click twice to hide".
    var cp = document.getElementById('dbClipsPanel');
    dbEditor.hideClips = dbPanelIsVisiblyOpen(cp);
    dbPersistPanelPrefs();
    dbApplySidePanels();
    dbSyncEditorShellHeight();
  };

  window.dbTogglePropsPanel = function(ev) {
    if (ev) { try { ev.preventDefault(); ev.stopPropagation(); } catch (e0) {} }
    if (dbEditor.clientView) return;
    var pp = document.getElementById('dbPropsPanel');
    dbEditor.hideProps = dbPanelIsVisiblyOpen(pp);
    dbPersistPanelPrefs();
    dbApplySidePanels();
    dbSyncEditorShellHeight();
  };

  function dbApplyClientViewLayout() {
    var cv = !!dbEditor.clientView;
    var root = document.getElementById('dbEditorRoot');
    if (root) root.classList.toggle('db-editor-client-view', cv);
    dbApplySidePanels();
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

  window.dbSetViewZoom = function(z, clientX, clientY) {
    dbZoomAtClientPoint(z, clientX, clientY);
  };
  window.dbZoomFit = function() { dbFitCanvasToView(); };
  window.dbZoom100 = function() { window.dbSetViewZoom(1); };
  window.dbZoomIn = function(ev) {
    var cur = dbEditor.canvasScale || 1;
    var next = dbClampZoom(cur * 1.25);
    var cx = ev && ev.clientX != null ? ev.clientX : null;
    var cy = ev && ev.clientY != null ? ev.clientY : null;
    if (cx == null) {
      var wrap = document.getElementById('dbCanvasWrap');
      if (wrap) {
        var r = wrap.getBoundingClientRect();
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
      }
    }
    dbZoomAtClientPoint(next, cx, cy);
  };
  window.dbZoomOut = function(ev) {
    var cur = dbEditor.canvasScale || 1;
    var next = dbClampZoom(cur / 1.25);
    var cx = ev && ev.clientX != null ? ev.clientX : null;
    var cy = ev && ev.clientY != null ? ev.clientY : null;
    if (cx == null) {
      var wrap = document.getElementById('dbCanvasWrap');
      if (wrap) {
        var r = wrap.getBoundingClientRect();
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
      }
    }
    dbZoomAtClientPoint(next, cx, cy);
  };

  window.dbZoomToSelection = function() {
    if (!dbEditor.selectedId) {
      if (typeof showToast === 'function') showToast('Select a tile first', 'info');
      return;
    }
    var el = dbEditor.elements.find(function(e) { return e.id === dbEditor.selectedId; });
    if (!el || el.type === 'arrow') return;
    var wrap = document.getElementById('dbCanvasWrap');
    if (!wrap) return;
    var pad = 96;
    var tileW = (el.w || 200) + pad;
    var tileH = (el.h || 200) + pad + (el.type === 'product' || el.type === 'image' ? dbTileExtrasH(el) : 0);
    var z = Math.min((wrap.clientWidth - pad) / tileW, (wrap.clientHeight - pad) / tileH, DB_ZOOM_MAX);
    dbEditor.viewZoomMode = 'manual';
    dbEditor.canvasScale = dbClampZoom(Math.max(0.25, z));
    dbApplyViewZoom();
    dbScrollCanvasToElement(el);
  };

  function dbWireCanvasZoomWheel() {
    var wrap = document.getElementById('dbCanvasWrap');
    if (!wrap || wrap._dbZoomWheelWired) return;
    wrap._dbZoomWheelWired = true;
    wrap.addEventListener('wheel', function(e) {
      if (dbEditor.clientView) return;
      // Ctrl/Cmd+wheel = zoom (trackpads often send ctrlKey with pinch)
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      var cur = dbEditor.canvasScale || 1;
      var factor = e.deltaY < 0 ? 1.12 : (1 / 1.12);
      dbZoomAtClientPoint(cur * factor, e.clientX, e.clientY);
    }, { passive: false });
  }

  var _dbViewResizeTimer = null;
  var _dbLastWrapSize = { w: 0, h: 0 };
  if (!window._dbViewResizeBound) {
    window._dbViewResizeBound = true;
    window.addEventListener('resize', function() {
      if (!document.getElementById('dbCanvas')) return;
      clearTimeout(_dbViewResizeTimer);
      _dbViewResizeTimer = setTimeout(function() {
        var wrap = document.getElementById('dbCanvasWrap');
        var w = wrap ? wrap.clientWidth : 0;
        var h = wrap ? wrap.clientHeight : 0;
        // Ignore scrollbar-toggle jitter (1–2px) that can loop Fit → flash the board.
        if (Math.abs(w - _dbLastWrapSize.w) < 3 && Math.abs(h - _dbLastWrapSize.h) < 3) return;
        _dbLastWrapSize = { w: w, h: h };
        dbSyncEditorShellHeight();
        if (dbEditor.clientView || dbEditor.viewZoomMode === 'fit') dbFitCanvasToView(!dbEditor.clientView);
        else dbApplyViewZoom();
      }, 160);
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
  function autoSave(ms) {
    if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(function() {
      _autoSaveTimer = null;
      saveBoardToFirestore();
    }, ms == null ? 2000 : ms);
  }
  function flushBoardAutoSave() {
    if (_autoSaveTimer) {
      clearTimeout(_autoSaveTimer);
      _autoSaveTimer = null;
      return saveBoardToFirestore();
    }
    if (dbEditor.dirty) return saveBoardToFirestore();
    return Promise.resolve();
  }
  if (!window._cchDbBeforeUnloadHook) {
    window._cchDbBeforeUnloadHook = true;
    window.addEventListener('beforeunload', function() {
      if (dbEditor && dbEditor.dirty && _autoSaveTimer) {
        clearTimeout(_autoSaveTimer);
        _autoSaveTimer = null;
      }
    });
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
        '<div style="display:flex;gap:8px;">' +
          '<button class="btn btn-secondary" onclick="showImageManager(\'' + proj.id + '\',\'' + escAttr(proj.name || '') + '\')">🖼️ Image Manager</button>' +
          '<button class="btn btn-primary" onclick="void createDesignBoard(\'' + proj.id + '\')">+ New Design Board</button>' +
        '</div>' +
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
              '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">' +
                (typeof cpOpenPostDesignBoardDecisionModal === 'function'
                  ? '<button class="btn btn-sm" style="font-size:11px;padding:4px 10px;border-radius:0;background:#C4A464;color:#0F1A2E;border:none;font-weight:600;" onclick="event.stopPropagation();cpOpenPostDesignBoardDecisionModal(\'' + proj.id + '\',\'' + b.id + '\')">📤 Post Decision</button>'
                  : '') +
                '<button class="btn btn-secondary btn-sm" style="font-size:11px;padding:4px 10px;border-radius:0;" onclick="event.stopPropagation();openDesignBoard(\'' + proj.id + '\',\'' + b.id + '\')">✏️ Edit</button>' +
                (typeof generateTearSheetsFromDesignBoard === 'function'
                  ? '<button class="btn btn-secondary btn-sm" style="font-size:11px;padding:4px 10px;border-radius:0;" onclick="event.stopPropagation();generateTearSheetsFromDesignBoard(\'' + proj.id + '\',\'' + b.id + '\')">📄 Tear Sheets</button>'
                  : '') +
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
      var html = '<div id="dbCoverPickerModal" style="position:fixed;inset:0;background:rgba(15,26,46,0.45);z-index:100050;display:flex;align-items:center;justify-content:center;padding:20px;" onclick="if(event.target===this)this.remove()">' +
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
      dbForceEndInteraction({ resync: true });
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
    dbLoadPanelPrefsIntoEditor();
    dbEditor.canvasScale = 1;
    dbEditor.viewZoomMode = 'fit';
    // WO-064: seed from max id (not count), then heal any duplicate el_* already on the board
    dbSeedNextIdFromElements();
    var healedIds = dbHealDuplicateElementIds();
    if (healedIds > 0) {
      dbEditor.dirty = true;
      dbSeedNextIdFromElements();
      dbEditor._healedDupIds = healedIds;
    } else {
      dbEditor._healedDupIds = 0;
    }
    dbEditor.clipCategory = 'All';
    dbEditor.clipListFilter = '';
    dbEditor.projectRooms = [];
    dbEditor.sourceTab = 'room';
    dbEditor.ibImages = [];
    dbEditor.ideabooks = [];
    dbEditor.ibBoardId = 'All';
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
      dbEditor.ideabooks = ideabooks.map(function(ib) {
        var d = ib.data || {};
        return {
          id: ib.id,
          name: String(d.name || d.title || 'Untitled').trim() || 'Untitled'
        };
      }).sort(function(a, b) {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
      dbEditor.ibImages = dbBuildIbImageList(ideabooks);
      if (dbEditor.ideabooks.length === 1) dbEditor.ibBoardId = dbEditor.ideabooks[0].id;
      else dbEditor.ibBoardId = 'All';
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
    var boardRoomPref = String((dbEditor.boardData && dbEditor.boardData.room) || '').trim();
    if (boardRoomPref) {
      var brLow = boardRoomPref.toLowerCase();
      var brMatch = dbEditor.projectRooms.find(function(r) { return String(r).toLowerCase() === brLow; });
      if (!brMatch) {
        dbEditor.projectRooms.push(boardRoomPref);
        dbEditor.projectRooms.sort(function(a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); });
        brMatch = boardRoomPref;
      }
      dbEditor.clipRoom = brMatch;
    } else {
      // Default All rooms so boards named "Showroom" do not hide every clip (clip.room often unset).
      dbEditor.clipRoom = 'All';
    }

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
      dbEditor.libItems = (dbEditor.libItems || []).filter(function(row) {
        return dbClipIsFurnishingProduct(row.data || row);
      });
      dbEditor.libItemsLoaded = true;
    } catch (eLib) {
      console.warn('[design board] library load:', eLib);
    } finally {
      dbEditor.libItemsLoading = false;
      if (dbEditor.sourceTab === 'library') {
        populateClipCategorySelect();
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
      if (!el._boardCostEdited && (el.cost == null || +el.cost === 0)) {
        var c = parseFloat(d.cost) || 0;
        if (c > 0) { el.cost = c; changed = true; }
      }
      if (!el._boardCostEdited && (el.sellPrice == null || +el.sellPrice === 0)) {
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
      '#dbClipsPanel,#dbPropsPanel{flex:0 0 240px;box-sizing:border-box;}' +
      '#dbClipsPanel.db-side-panel-collapsed,#dbPropsPanel.db-side-panel-collapsed{display:none!important;width:0!important;min-width:0!important;max-width:0!important;padding:0!important;margin:0!important;border:none!important;overflow:hidden!important;flex:0 0 0!important;}' +
      '#dbCanvas,#dbCanvasStage{touch-action:none;}' +
      '#dbBranding{position:absolute;left:0;right:0;bottom:0;top:auto;padding:0 0 14px;margin:0;z-index:10;pointer-events:none;text-align:center;}' +
      '.db-el-product{box-sizing:border-box;pointer-events:auto;cursor:move;overflow:visible;}' +
      '.db-el-frame{position:relative;flex-shrink:0;overflow:visible;}' +
      '.db-el-selected .db-el-frame{box-shadow:0 0 0 2px var(--gold);}' +
      '.db-el-handles-layer{position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;overflow:visible;z-index:30;}' +
      '.db-el-media{position:relative;box-sizing:border-box;background:#fff;border:1px solid rgba(15,26,46,0.06);border-radius:2px;overflow:hidden;padding:0;pointer-events:none;}' +
      '.db-el-media img{width:100%;height:100%;object-fit:cover;object-position:center;display:block;pointer-events:none;}' +
      '.db-el-caption{margin-top:5px;font-size:14px;font-weight:600;color:#1B3352;text-align:center;pointer-events:none;line-height:1.3;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;}' +
      '.db-el-desc{margin-top:3px;font-size:12px;color:#4B5563;text-align:center;pointer-events:none;line-height:1.4;white-space:pre-wrap;}' +
      '.db-el-price{margin-top:3px;font-size:14px;font-weight:700;color:#0A1F3D;text-align:center;pointer-events:none;line-height:1.25;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}' +
      '.db-el-annotation{margin-top:4px;font-size:12px;color:#6B7280;text-align:center;font-style:italic;pointer-events:none;white-space:pre-line;line-height:1.35;}' +
      '.db-resize{position:absolute;width:calc(18px / var(--db-zoom,1));height:calc(18px / var(--db-zoom,1));background:var(--gold);border:calc(2px / var(--db-zoom,1)) solid #fff;border-radius:50%;z-index:31;box-shadow:0 2px 6px rgba(0,0,0,0.28);pointer-events:auto;touch-action:none;}' +
      '.db-resize::before{content:"";position:absolute;left:50%;top:50%;width:calc(40px / var(--db-zoom,1));height:calc(40px / var(--db-zoom,1));transform:translate(-50%,-50%);}' +
      '.db-resize-edge{width:calc(32px / var(--db-zoom,1));height:calc(10px / var(--db-zoom,1));border-radius:calc(5px / var(--db-zoom,1));}' +
      '.db-resize-nw{left:calc(-9px / var(--db-zoom,1));top:calc(-9px / var(--db-zoom,1));cursor:nwse-resize;}' +
      '.db-resize-ne{right:calc(-9px / var(--db-zoom,1));top:calc(-9px / var(--db-zoom,1));cursor:nesw-resize;}' +
      '.db-resize-sw{left:calc(-9px / var(--db-zoom,1));bottom:calc(-9px / var(--db-zoom,1));cursor:nesw-resize;}' +
      '.db-resize-se{right:calc(-9px / var(--db-zoom,1));bottom:calc(-9px / var(--db-zoom,1));cursor:nwse-resize;}' +
      '.db-resize-n{left:50%;top:calc(-5px / var(--db-zoom,1));transform:translateX(-50%);cursor:ns-resize;}' +
      '.db-resize-s{left:50%;bottom:calc(-5px / var(--db-zoom,1));transform:translateX(-50%);cursor:ns-resize;}' +
      '.db-resize-e{right:calc(-5px / var(--db-zoom,1));top:50%;transform:translateY(-50%);cursor:ew-resize;}' +
      '.db-resize-w{left:calc(-5px / var(--db-zoom,1));top:50%;transform:translateY(-50%);cursor:ew-resize;}' +
      '.db-el-note-wrap{position:relative;overflow:visible;}' +
      '.db-el-selected.db-el-note-wrap{box-shadow:0 0 0 2px var(--gold);}' +
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
        '<div style="display:flex;align-items:center;gap:2px;padding:2px 6px;background:#eef2f7;border-radius:6px;border:1px solid rgba(27,51,82,0.1);" title="Zoom: + / − buttons, Ctrl+scroll, or Zoom to selection">' +
          '<button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:14px;line-height:1;" onclick="dbZoomOut(event)" title="Zoom out (−)">−</button>' +
          '<span id="dbZoomLabel" style="font-size:11px;font-weight:600;min-width:42px;text-align:center;color:#1B3352;">100%</span>' +
          '<button type="button" class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:14px;line-height:1;" onclick="dbZoomIn(event)" title="Zoom in (+)">+</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:10px;margin-left:2px;" onclick="dbZoom100()" title="Zoom to 100%">100%</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" style="padding:4px 8px;font-size:10px;" onclick="dbZoomFit()" title="Fit board to window">Fit</button>' +
        '</div>' +
        '<div style="flex:1;"></div>' +
        '<label class="db-toolbar-edit-only" style="font-size:12px;display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" ' + (dbEditor.showPricing ? 'checked' : '') + ' onchange="toggleBoardPricing(this.checked)"> Show Pricing</label>' +
        '<button class="btn btn-secondary btn-sm" onclick="toggleClientView()" style="' + (dbEditor.clientView ? 'background:#0A1F3D;color:#fff;border-color:#0A1F3D;' : '') + '">' + (dbEditor.clientView ? '👁 Client view: ON' : '👁 Client view') + '</button>' +
        '<button class="btn btn-secondary btn-sm" onclick="openLuxuryClientView()">🖤 Share with Client</button>' +
        '<button class="btn btn-secondary btn-sm db-toolbar-edit-only" onclick="void dbPostBoardAsDecision()">📤 Post Decision</button>' +
        '<button class="btn btn-secondary btn-sm db-toolbar-edit-only" onclick="dbUndo()">↩ Undo</button>' +
        '<button type="button" class="btn btn-secondary btn-sm db-toolbar-edit-only" title="Auto-arrange tiles (does not auto-save — use Undo if needed, then Save)" onclick="void dbTidyBoard()">✨ Tidy board</button>' +
        '<button type="button" id="dbUnstickToolbarBtn" class="btn btn-secondary btn-sm db-toolbar-edit-only" title="End stuck drag AND clear selection (gold grips) — does NOT delete tiles">🔓 Unstick</button>' +
        '<button type="button" class="btn btn-secondary btn-sm db-toolbar-edit-only" title="Nudge overlapping tiles apart (grows board if needed — never deletes)" onclick="void dbRepairBoard()">🔧 Spread stacks</button>' +
        '<span id="dbUnstickStatus" class="db-toolbar-edit-only" style="font-size:10px;color:var(--gray-500);min-width:72px;"></span>' +
        '<button class="btn btn-secondary btn-sm db-toolbar-edit-only" onclick="dbOpenPrintMenu()">🖨 Print / Export</button>' +
        '<button type="button" id="dbToggleClipsBtn" class="btn btn-secondary btn-sm db-toolbar-edit-only" onclick="dbToggleClipsPanel(event)">📚 Hide Library</button>' +
        '<button type="button" id="dbTogglePropsBtn" class="btn btn-secondary btn-sm db-toolbar-edit-only" onclick="dbTogglePropsPanel(event)">⚙ Hide Properties</button>' +
        '<button class="btn btn-secondary btn-sm db-toolbar-edit-only" onclick="showBoardCostSummary()">💲 Summary</button>' +
        '<button class="btn btn-secondary btn-sm db-toolbar-edit-only" onclick="createProposalFromBoard()">📋 → Proposal</button>' +
        '<button class="btn btn-primary btn-sm db-toolbar-edit-only" onclick="saveBoardToFirestore()">💾 Save</button>' +
      '</div>' +

      // Main layout: clips panel + canvas + props panel
      '<div style="display:flex;gap:0;flex:1;min-height:0;">' +
        // Left: Clips panel
        '<div id="dbClipsPanel" style="width:240px;min-width:240px;flex:0 0 240px;border-right:1px solid var(--gray-200);overflow-y:auto;padding:0;background:#fafaf8;display:flex;flex-direction:column;box-sizing:border-box;">' +
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
            '<div id="dbClipIbBoardWrap" style="display:none;">' +
              '<label style="font-size:10px;color:var(--gray-500);display:block;margin-bottom:4px;">Inspiration board</label>' +
              '<select id="dbClipIbBoardSel" style="width:100%;padding:6px 8px;border:1px solid var(--gray-200);border-radius:4px;font-size:12px;margin-bottom:8px;background:#fff;box-sizing:border-box;" onchange="setBoardIbBoard(this.value)"></select>' +
            '</div>' +
            '<div id="dbClipCatWrap">' +
              '<label id="dbClipCatLabel" style="font-size:10px;color:var(--gray-500);display:block;margin-bottom:4px;">Category</label>' +
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
            (bd.branding !== false ? '<div id="dbBranding">' +
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
        '<div id="dbPropsPanel" style="width:240px;min-width:240px;flex:0 0 240px;border-left:1px solid var(--gray-200);overflow-y:auto;padding:12px;background:#fafaf8;box-sizing:border-box;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;">' +
            '<div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:var(--gray-400);font-weight:600;">Properties</div>' +
            '<button type="button" id="dbUnstickPropsBtn" class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:10px;line-height:1.2;" title="End stuck drag — does not delete tiles">Unstick</button>' +
          '</div>' +
          '<div id="dbPropsContent"><div style="color:var(--gray-400);font-size:12px;padding:20px 0;text-align:center;">Select an element<br>or drag a clip onto the canvas</div></div>' +
        '</div>' +
      '</div>' +
      '</div>';

    populateClipCategorySelect();
    populateClipRoomSelect();
    populateIbBoardSelect();
    dbUpdateSourceTabFilters();
    var _fi = document.getElementById('dbClipFilterInput');
    if (_fi) _fi.value = dbEditor.clipListFilter || '';
    renderClipsList(dbEditor.clipListFilter || '');
    renderCanvas();
    renderProps();
    dbUpdateCanvasDropHint();
    dbApplyViewZoom();
    dbSyncBrandingFooter();
    dbSyncEditorShellHeight();
    dbApplyClientViewLayout();
    dbWireCanvasZoomWheel();
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        dbSyncBrandingFooter();
        dbSyncEditorShellHeight();
        if (!dbEditor.clientView && dbEditor.viewZoomMode === 'fit') dbFitCanvasToView(false);
      });
    });
    dbWireUnstickButtons();

    // Never auto-move tiles on open — prior auto-spread shoved items past canvas
    // edges (overflow:hidden) so they looked deleted, then Back/Save persisted it.
    var rescued = dbRescueOffCanvasTiles();
    if (rescued > 0) {
      dbEditor.dirty = true;
      renderCanvas();
      dbSyncBrandingFooter();
      if (typeof showToast === 'function') {
        showToast('Recovered ' + rescued + ' item' + (rescued !== 1 ? 's' : '') + ' that were outside the board — review, then Save.', 7000);
      }
    }
    if (dbEditor._healedDupIds > 0) {
      renderCanvas();
      var _healN = dbEditor._healedDupIds;
      dbEditor._healedDupIds = 0;
      // WO-065: persist healed ids once so the next open does not re-heal the same Firestore doc
      void Promise.resolve(saveBoardToFirestore({ quiet: true })).then(function() {
        if (typeof showToast === 'function') {
          showToast('Repaired ' + _healN + ' duplicate tile ID' + (_healN !== 1 ? 's' : '') + ' and saved. Nothing was deleted.', 7000);
        }
      });
    }
    var overlapPairs = dbCountOverlappingTiles();
    if (overlapPairs > 0) dbShowOverlapBanner(overlapPairs);

    // Keyboard handler
    document.onkeydown = function(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') return;
      if (e.key === 'Delete') { deleteSelected(); e.preventDefault(); }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { dbUndo(); e.preventDefault(); }
      if (e.key === 'Escape') { dbUnstickBoard(); e.preventDefault(); }
      if (!dbEditor.clientView && (e.key === '+' || e.key === '=')) { dbZoomIn(); e.preventDefault(); }
      if (!dbEditor.clientView && (e.key === '-' || e.key === '_')) { dbZoomOut(); e.preventDefault(); }
      if (!dbEditor.clientView && e.key === '0' && (e.ctrlKey || e.metaKey)) { dbZoomFit(); e.preventDefault(); }
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

  /** Furnishing products only — same rules as Room Boards / Selections (no design fees, labor, expenses). */
  function dbClipIsFurnishingProduct(d) {
    if (!d) return false;
    if (typeof window._disSidebarItemIsProjectSelectionProduct === 'function') {
      return window._disSidebarItemIsProjectSelectionProduct(Object.assign({}, d, { _source: 'selection' }));
    }
    if (typeof window.boardClipIsTimeBillingRow === 'function' && window.boardClipIsTimeBillingRow(d)) return false;
    if (typeof window.isRealProduct === 'function') {
      return window.isRealProduct({
        title: d.title, category: d.category, room: d.room,
        vendor: d.vendor, manufacturer: d.manufacturer || '', sku: d.sku || '',
        cost: d.cost, clientPrice: d.clientPrice || d.sellingPrice,
        imageUrl: d.imageUrl, image: d.image,
        libraryItemKind: d.libraryItemKind, itemKind: d.itemKind
      });
    }
    return true;
  }

  function clipCategoryOptions() {
    var tab = dbEditor.sourceTab || 'room';
    if (tab === 'library') {
      var master = (window.CCH_PRODUCT_CATEGORIES_MASTER || []).slice();
      if (master.length) return ['All'].concat(master);
      var libSet = new Set();
      (dbEditor.libItems || []).forEach(function(p) {
        var d = p.data || p;
        if (!dbClipIsFurnishingProduct(d)) return;
        var cat = String(d.category || '').trim();
        if (cat) libSet.add(cat);
      });
      return ['All'].concat(Array.from(libSet).sort(function(a, b) {
        return a.localeCompare(b, undefined, { sensitivity: 'base' });
      }));
    }
    var s = new Set();
    dbEditor.clips.forEach(function(c) {
      var d = c.data || {};
      if (!dbClipIsFurnishingProduct(d)) return;
      var cat = String(d.category || '').trim();
      if (cat) s.add(cat);
    });
    return ['All'].concat(Array.from(s).sort(function(a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); }));
  }

  function populateClipCategorySelect() {
    var sel = document.getElementById('dbClipCatSel');
    if (!sel) return;
    var cats = clipCategoryOptions();
    var cur = dbEditor.clipCategory || 'All';
    if (cur !== 'All' && cats.indexOf(cur) < 0) cur = 'All';
    dbEditor.clipCategory = cur;
    sel.innerHTML = cats.map(function(c) {
      return '<option value="' + escAttr(c) + '"' + (cur === c ? ' selected' : '') + '>' + esc(c === 'All' ? 'All categories' : c) + '</option>';
    }).join('');
  }

  function populateIbBoardSelect() {
    var sel = document.getElementById('dbClipIbBoardSel');
    if (!sel) return;
    var boards = dbEditor.ideabooks || [];
    var cur = dbEditor.ibBoardId || 'All';
    if (cur !== 'All' && !boards.some(function(b) { return b.id === cur; })) cur = 'All';
    dbEditor.ibBoardId = cur;
    var opts = [{ id: 'All', name: 'All boards' }].concat(boards);
    sel.innerHTML = opts.map(function(b) {
      return '<option value="' + escAttr(b.id) + '"' + (b.id === cur ? ' selected' : '') + '>' + esc(b.name) + '</option>';
    }).join('');
  }

  window.setBoardClipCategory = function(val) {
    dbEditor.clipCategory = val || 'All';
    var inp = document.getElementById('dbClipFilterInput');
    renderClipsList(inp ? inp.value : '');
  };

  window.setBoardIbBoard = function(val) {
    dbEditor.ibBoardId = val || 'All';
    var inp = document.getElementById('dbClipFilterInput');
    renderClipsList(inp ? inp.value : '');
  };

  function clipRoomOptions() {
    var rooms = (dbEditor.projectRooms || []).slice();
    var boardRm = String((dbEditor.boardData && dbEditor.boardData.room) || '').trim();
    if (boardRm && !rooms.some(function(r) { return String(r).toLowerCase() === boardRm.toLowerCase(); })) {
      rooms.push(boardRm);
      rooms.sort(function(a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); });
    }
    return ['All'].concat(rooms);
  }

  function populateClipRoomSelect() {
    var sel = document.getElementById('dbClipRoomSel');
    if (!sel) return;
    var rooms = clipRoomOptions();
    var cur = dbEditor.clipRoom || 'All';
    var curLow = String(cur).toLowerCase();
    sel.innerHTML = rooms.map(function(r) {
      var selOn = (r === 'All' && cur === 'All') || (r !== 'All' && String(r).toLowerCase() === curLow);
      return '<option value="' + escAttr(r) + '"' + (selOn ? ' selected' : '') + '>' + esc(r === 'All' ? 'All rooms' : r) + '</option>';
    }).join('');
  }

  window.setBoardClipRoom = function(val) {
    dbEditor.clipRoom = val || 'All';
    if (val && val !== 'All') {
      dbEditor.boardData.room = val;
      dbEditor.dirty = true;
    }
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
    // Existing tiles occupy their TRUE height (image + caption/price); the incoming tile
    // gets ~44px reserved for the caption+price it will render once placed.
    var boxes = els.map(function(e) { return dbElementVisualBox(e); });
    var hIn = h + 44;
    var x = Math.max(20, preferX - w / 2);
    var y = Math.max(20, preferY - h / 2);
    function hits(ex, ey) {
      return boxes.some(function(o) {
        return !(ex + w < o.x - 8 || ex > o.right + 8 || ey + hIn < o.y - 8 || ey > o.bottom + 8);
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
        if (!dbClipIsFurnishingProduct(d)) return;
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
      var boardF = dbEditor.ibBoardId || 'All';
      return (dbEditor.ibImages || []).filter(function(img) {
        if (!img || !img.imageUrl) return false;
        if (boardF !== 'All' && String(img.ideabookId || '') !== String(boardF)) return false;
        return true;
      }).map(function(img) {
        var boardName = img.section || '';
        var cap = String(img.caption || img.title || '').trim();
        return {
          kind: 'inspiration',
          title: cap || boardName || 'Inspiration',
          vendor: img.vendor || '',
          sellPrice: parseFloat(img.price || img.clientPrice) || 0,
          cost: 0,
          img: img.imageUrl,
          data: img,
          section: (cap && boardName && cap !== boardName) ? boardName : (cap ? '' : boardName)
        };
      });
    }
    var libCatF = dbEditor.clipCategory || 'All';
    return (dbEditor.libItems || []).filter(function(p) {
      var d = p.data || p;
      if (!dbClipIsFurnishingProduct(d)) return false;
      if (libCatF !== 'All') {
        var lc = String(d.category || '').trim();
        if (lc.toLowerCase() !== String(libCatF).toLowerCase()) return false;
      }
      return true;
    }).map(function(p) {
      var d = p.data || p;
      return {
        kind: 'library',
        title: d.title || d.name || 'Untitled',
        vendor: d.vendor || d.manufacturer || '',
        sellPrice: parseFloat(d.clientPrice) || parseFloat(d.retailPrice) || 0,
        cost: parseFloat(d.cost) || 0,
        img: dbClipSidebarImg(d),
        data: d,
        section: String(d.category || '').trim()
      };
    });
  }

  function dbUpdateSourceTabFilters() {
    var tab = dbEditor.sourceTab || 'room';
    var rw = document.getElementById('dbClipRoomWrap');
    var iw = document.getElementById('dbClipIbBoardWrap');
    var cw = document.getElementById('dbClipCatWrap');
    if (rw) rw.style.display = (tab === 'room') ? 'block' : 'none';
    if (iw) iw.style.display = (tab === 'ideabook') ? 'block' : 'none';
    // Category: Room clips + Library (same control Add-item users expect)
    if (cw) cw.style.display = (tab === 'room' || tab === 'library') ? 'block' : 'none';
    document.querySelectorAll('.db-source-tab').forEach(function(btn) {
      var t = btn.getAttribute('data-tab');
      btn.classList.toggle('db-source-tab--active', t === tab);
    });
    if (tab === 'ideabook') populateIbBoardSelect();
    if (tab === 'room' || tab === 'library') populateClipCategorySelect();
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
        var ibF = dbEditor.ibBoardId || 'All';
        emptyMsg = ibF !== 'All'
          ? 'No images on this Inspiration board. Pick another board or add images on the <strong>Inspiration</strong> tab.'
          : 'No inspiration images in this project. Add images on the <strong>Inspiration</strong> tab first.';
      } else if (tab === 'library') {
        var libCat = dbEditor.clipCategory || 'All';
        emptyMsg = libCat !== 'All'
          ? 'No library products in <strong>' + esc(libCat) + '</strong>. Try <strong>All categories</strong>.'
          : 'No products in library.';
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

  function resizeHandlesHtml() {
    return '<div class="db-resize db-resize-nw" onpointerdown="resizeMouseDown(event,\'nw\')"></div>' +
      '<div class="db-resize db-resize-ne" onpointerdown="resizeMouseDown(event,\'ne\')"></div>' +
      '<div class="db-resize db-resize-sw" onpointerdown="resizeMouseDown(event,\'sw\')"></div>' +
      '<div class="db-resize db-resize-se" onpointerdown="resizeMouseDown(event,\'se\')"></div>' +
      '<div class="db-resize db-resize-edge db-resize-n" onpointerdown="resizeMouseDown(event,\'n\')"></div>' +
      '<div class="db-resize db-resize-edge db-resize-s" onpointerdown="resizeMouseDown(event,\'s\')"></div>' +
      '<div class="db-resize db-resize-edge db-resize-e" onpointerdown="resizeMouseDown(event,\'e\')"></div>' +
      '<div class="db-resize db-resize-edge db-resize-w" onpointerdown="resizeMouseDown(event,\'w\')"></div>';
  }

  function dbAttachResizeHandles(container, show) {
    if (!container) return;
    var layer = container.querySelector('.db-el-handles-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'db-el-handles-layer';
      container.appendChild(layer);
    }
    layer.innerHTML = show ? resizeHandlesHtml() : '';
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
        '<div class="db-el-frame" style="width:' + ew + 'px;height:' + eh + 'px;">' +
          '<div class="db-el-media" style="width:100%;height:100%;">' + mediaInner + '</div>' +
          (sel ? '<div class="db-el-handles-layer">' + resizeHandlesHtml() + '</div>' : '') +
        '</div>' +
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
      return '<div class="db-el db-el-note-wrap' + selClass + '" data-id="' + el.id + '" style="position:absolute;left:' + el.x + 'px;top:' + el.y + 'px;width:' + (el.w || 200) + 'px;padding:10px 12px;background:#FFFDE7;border:1px solid #FFF9C4;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.08);cursor:move;z-index:' + (sel ? 100 : 15) + ';overflow:visible;" onpointerdown="elMouseDown(event,\'' + el.id + '\')" ondblclick="void editTextEl(\'' + el.id + '\')">' +
        '<div style="font-size:12px;color:#666;white-space:pre-wrap;pointer-events:none;font-style:italic;min-height:' + (el.h || 56) + 'px;">' + esc(el.text || 'Designer notes...') + '</div>' +
        (sel ? '<div class="db-el-handles-layer">' + resizeHandlesHtml() + '</div>' : '') +
      '</div>';
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
    var anchor = node.querySelector('.db-el-frame') || node.querySelector('.db-el-media');
    if (!anchor) return false;
    var sib = anchor.nextSibling;
    var toRemove = [];
    while (sib) {
      toRemove.push(sib);
      sib = sib.nextSibling;
    }
    for (var ri = 0; ri < toRemove.length; ri++) {
      var rm = toRemove[ri];
      if (rm.parentNode === node) node.removeChild(rm);
    }
    var tail = dbProductCaptionHtml(el) + dbProductPriceHtml(el);
    if (el.annotation) {
      tail += '<div class="db-el-annotation">' + esc(el.annotation) + '</div>';
    }
    if (tail) anchor.insertAdjacentHTML('afterend', tail);
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
      var frame = node.querySelector('.db-el-frame');
      if (frame) {
        dbAttachResizeHandles(frame, sel && dbElSupportsResize(el.type));
      } else if (el.type === 'note') {
        dbAttachResizeHandles(node, sel);
      } else {
        node.querySelectorAll('.db-resize, .db-el-handles-layer').forEach(function(h) { h.remove(); });
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
    if (el.w !== undefined && el.h !== undefined && dbElSupportsResize(el.type)) {
      html += '<div style="margin:6px 0 10px;"><button type="button" class="btn btn-secondary btn-sm" style="width:100%;font-size:11px;" onclick="dbZoomToSelection()">🔍 Zoom to selection</button>' +
        '<div style="font-size:10px;color:var(--gray-500);margin-top:4px;line-height:1.35;">Toolbar <strong>+</strong>/<strong>−</strong>, keyboard <strong>+</strong>/<strong>−</strong>, or <strong>Ctrl+scroll</strong> to zoom the board (up to 400%). Drag gold grips to resize a tile. Hold <strong>Shift</strong> for locked proportions.</div></div>';
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
      if (prop === 'cost' || prop === 'sellPrice') {
        el._boardCostEdited = true;
        autoSave(600);
      }
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
    if (prop === 'room') {
      var rv = String(value || '').trim();
      if (rv) {
        dbEditor.clipRoom = rv;
        var low = rv.toLowerCase();
        if (!(dbEditor.projectRooms || []).some(function(r) { return String(r).toLowerCase() === low; })) {
          dbEditor.projectRooms = (dbEditor.projectRooms || []).concat([rv]).sort(function(a, b) {
            return a.localeCompare(b, undefined, { sensitivity: 'base' });
          });
        }
        populateClipRoomSelect();
        var inp = document.getElementById('dbClipFilterInput');
        renderClipsList(inp ? inp.value : '');
      }
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
    dbSyncBrandingFooter();
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

  /** End any in-flight drag/resize and resync DOM — fixes sticky selection and ghost handles. */
  function dbForceEndInteraction(opts) {
    opts = opts || {};
    if (_dbPointerGesture) {
      dbFinishPointerGesture(_dbPointerGesture.lastEv);
    } else if (dbEditor.isDragging || dbEditor.isResizing) {
      dbForceRemoveAllDragListeners();
    }
    dbEditor.isDragging = false;
    dbEditor.isResizing = false;
    dbClearAllDragTransforms();
    if (opts.resync !== false) {
      dbResyncAllElementsFromModel();
      dbUpdateSelectionDom();
      if (opts.renderProps !== false) renderProps();
    }
  }

  if (!window._dbGlobalPointerEndBound) {
    window._dbGlobalPointerEndBound = true;
    window.addEventListener('pointerup', function(ev) {
      if (!window._cchDesignBoardEditorActive || !dbEditor || !dbEditor.boardId) return;
      if (!_dbPointerGesture && !dbEditor.isDragging && !dbEditor.isResizing) return;
      dbForceEndInteraction({ resync: true });
    }, true);
    window.addEventListener('pointercancel', function(ev) {
      if (!window._cchDesignBoardEditorActive || !dbEditor || !dbEditor.boardId) return;
      if (!_dbPointerGesture && !dbEditor.isDragging && !dbEditor.isResizing) return;
      dbForceEndInteraction({ resync: true });
    }, true);
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
        window.dbUnstickBoard();
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
    var frame = node.querySelector('.db-el-frame');
    if (frame) {
      if (el.w != null && el.w !== undefined) frame.style.width = el.w + 'px';
      if (el.h != null && el.h !== undefined) frame.style.height = el.h + 'px';
      var media = frame.querySelector('.db-el-media');
      if (media) {
        if (el.w != null && el.w !== undefined) media.style.width = '100%';
        if (el.h != null && el.h !== undefined) media.style.height = '100%';
      }
    } else {
      var media = node.querySelector('.db-el-media');
      if (media) {
        if (el.w != null && el.w !== undefined) media.style.width = el.w + 'px';
        if (el.h != null && el.h !== undefined) media.style.height = el.h + 'px';
      } else if (el.h != null && el.h !== undefined) {
        node.style.height = el.h + 'px';
        node.style.minHeight = el.h + 'px';
      }
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

  function dbApplyResize(el, dir, rs, dx, dy, lockAspect) {
    var ratio = (rs.w > 0 && rs.h > 0) ? (rs.w / rs.h) : 1;
    if (dir === 'se') {
      el.w = Math.max(DB_MIN_EL_SIZE, rs.w + dx);
      el.h = Math.max(DB_MIN_EL_SIZE, rs.h + dy);
      if (lockAspect) {
        if (Math.abs(dx) >= Math.abs(dy)) el.h = Math.max(DB_MIN_EL_SIZE, el.w / ratio);
        else el.w = Math.max(DB_MIN_EL_SIZE, el.h * ratio);
      }
    } else if (dir === 'sw') {
      var nw = Math.max(DB_MIN_EL_SIZE, rs.w - dx);
      el.x = rs.x + (rs.w - nw);
      el.w = nw;
      el.h = Math.max(DB_MIN_EL_SIZE, rs.h + dy);
      if (lockAspect) {
        if (Math.abs(dx) >= Math.abs(dy)) el.h = Math.max(DB_MIN_EL_SIZE, el.w / ratio);
        else { el.w = Math.max(DB_MIN_EL_SIZE, el.h * ratio); el.x = rs.x + (rs.w - el.w); }
      }
    } else if (dir === 'ne') {
      el.w = Math.max(DB_MIN_EL_SIZE, rs.w + dx);
      var nh = Math.max(DB_MIN_EL_SIZE, rs.h - dy);
      el.y = rs.y + (rs.h - nh);
      el.h = nh;
      if (lockAspect) {
        if (Math.abs(dx) >= Math.abs(dy)) { el.h = Math.max(DB_MIN_EL_SIZE, el.w / ratio); el.y = rs.y + (rs.h - el.h); }
        else el.w = Math.max(DB_MIN_EL_SIZE, el.h * ratio);
      }
    } else if (dir === 'nw') {
      var nw2 = Math.max(DB_MIN_EL_SIZE, rs.w - dx);
      var nh2 = Math.max(DB_MIN_EL_SIZE, rs.h - dy);
      el.x = rs.x + (rs.w - nw2);
      el.y = rs.y + (rs.h - nh2);
      el.w = nw2;
      el.h = nh2;
      if (lockAspect) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          el.h = Math.max(DB_MIN_EL_SIZE, el.w / ratio);
          el.y = rs.y + (rs.h - el.h);
        } else {
          el.w = Math.max(DB_MIN_EL_SIZE, el.h * ratio);
          el.x = rs.x + (rs.w - el.w);
        }
      }
    } else if (dir === 'e') {
      el.w = Math.max(DB_MIN_EL_SIZE, rs.w + dx);
    } else if (dir === 'w') {
      var nw3 = Math.max(DB_MIN_EL_SIZE, rs.w - dx);
      el.x = rs.x + (rs.w - nw3);
      el.w = nw3;
    } else if (dir === 's') {
      el.h = Math.max(DB_MIN_EL_SIZE, rs.h + dy);
    } else if (dir === 'n') {
      var nh3 = Math.max(DB_MIN_EL_SIZE, rs.h - dy);
      el.y = rs.y + (rs.h - nh3);
      el.h = nh3;
    }
  }

  var DB_RESIZE_CURSORS = {
    nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
    n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize'
  };

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
    if (e.target.closest && e.target.closest('.db-resize')) return;
    if (e.target.classList && e.target.classList.contains('db-resize')) return;

    if (_dbPointerGesture || dbEditor.isDragging || dbEditor.isResizing) {
      dbForceEndInteraction({ resync: true, renderProps: false });
    }

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
          el.x = origX + pt2.mx - startPt.mx;
          el.y = origY + pt2.my - startPt.my;
          dbClampElPositionOnCanvas(el);
          dbPatchElementDom(el);
        }
      },
      onUp: function() {
        if (moved) {
          dbClampElPositionOnCanvas(el);
          dbEditor.dirty = true;
        }
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
          document.body.style.cursor = DB_RESIZE_CURSORS[dir] || 'nwse-resize';
          document.body.style.userSelect = 'none';
          pushUndo();
        }
        if (canvas) {
          var pt = dbCanvasPointFromEvent(ev, canvas);
          dbApplyResize(el, dir, rs, pt.mx - startPt.mx, pt.my - startPt.my, !!ev.shiftKey);
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
    if (_dbPointerGesture || dbEditor.isDragging || dbEditor.isResizing) {
      dbForceEndInteraction({ resync: true, renderProps: false });
    }
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
    var pos = dbFindFreeDropPosition(w, h, mx, my);
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

  /** Read a local file's natural pixel size so uploads keep their aspect ratio (Canva-style). */
  function dbReadImageNaturalSize(file) {
    return new Promise(function(resolve) {
      var url;
      try {
        url = URL.createObjectURL(file);
      } catch (e) { resolve(null); return; }
      var im = new Image();
      var done = false;
      var finish = function(out) {
        if (done) return;
        done = true;
        try { URL.revokeObjectURL(url); } catch (e2) {}
        resolve(out);
      };
      im.onload = function() { finish({ w: im.naturalWidth || 0, h: im.naturalHeight || 0 }); };
      im.onerror = function() { finish(null); };
      setTimeout(function() { finish(null); }, 4000);
      im.src = url;
    });
  }

  /** Resolve + validate a pasted image URL for design-board tiles. */
  function dbNormalizeBoardImageUrl(raw) {
    var url = String(raw == null ? '' : raw).trim();
    if (!url) return '';
    if (typeof window._resolveImgSrc === 'function') {
      url = window._resolveImgSrc(url) || url;
    }
    if (!/^https?:\/\//i.test(url) && url.indexOf('//') !== 0 && !/^data:image/i.test(url)) {
      return '';
    }
    return url;
  }

  /** Probe remote image dimensions (best-effort; may fail on hotlink-protected hosts). */
  function dbReadImageNaturalSizeFromUrl(url) {
    return new Promise(function(resolve) {
      url = String(url || '').trim();
      if (!url) { resolve(null); return; }
      var im = new Image();
      im.referrerPolicy = 'no-referrer';
      var done = false;
      var finish = function(out) {
        if (done) return;
        done = true;
        resolve(out);
      };
      im.onload = function() { finish({ w: im.naturalWidth || 0, h: im.naturalHeight || 0 }); };
      im.onerror = function() { finish(null); };
      setTimeout(function() { finish(null); }, 8000);
      im.src = url;
    });
  }

  function dbBoardTileSizeFromNatural(nat, fallbackW, fallbackH) {
    var w = fallbackW || 220;
    var h = fallbackH || 220;
    if (nat && nat.w > 0 && nat.h > 0) {
      var sc = 320 / Math.max(nat.w, nat.h);
      w = Math.max(120, Math.round(nat.w * sc));
      h = Math.max(120, Math.round(nat.h * sc));
    }
    return { w: w, h: h };
  }

  /** Import vendor image via Cloud Function (no browser CORS). */
  async function dbImportImageUrlViaCloud(url) {
    if (!url || !dbEditor.projectId || !dbEditor.boardId) return '';
    if (typeof firebase === 'undefined' || !firebase.app || !firebase.auth || !firebase.auth().currentUser) return '';
    try {
      var fn = firebase.app().functions('us-central1').httpsCallable('importDesignBoardImageFromUrl');
      var res = await fn({
        projectId: dbEditor.projectId,
        boardId: dbEditor.boardId,
        imageUrl: url
      });
      return (res && res.data && res.data.downloadUrl) ? String(res.data.downloadUrl) : '';
    } catch (e) {
      var msg = (e && e.message) ? String(e.message) : String(e || 'Import failed');
      console.warn('[design board] cloud image import', msg);
      window._dbLastImageImportError = msg;
      return '';
    }
  }

  /** Fetch remote image bytes and store on Firebase (same durability as From computer). */
  async function dbUploadRemoteImageUrlToStorage(url, extHint) {
    if (!url || !dbEditor.projectId || !dbEditor.boardId) return '';
    if (/firebasestorage\.googleapis\.com|\.firebasestorage\.app/i.test(url)) return url;
    // Vendor CDNs block browser XHR — server import first (skip client fetch to avoid CORS console noise).
    var cloudUrl = await dbImportImageUrlViaCloud(url);
    if (cloudUrl) return cloudUrl;
    return '';
  }

  async function dbUploadImageFilesToCanvas(files, mx, my) {
    var imageFiles = Array.from(files || []).filter(dbIsImageUploadFile);
    if (!imageFiles.length) return;
    if (typeof showToast === 'function') showToast('Uploading ' + imageFiles.length + ' image(s)…', 3500);
    var useDefaultPoint = (mx == null || my == null);
    for (var fi = 0; fi < imageFiles.length; fi++) {
      var f = imageFiles[fi];
      try {
        var rawExt = (f.name.split('.').pop() || 'jpeg').toLowerCase().replace(/[^a-z0-9]/g, '');
        var ext = rawExt && rawExt.length <= 8 ? rawExt : 'jpeg';
        var ts = Date.now() + '-' + fi + '-' + Math.random().toString(36).slice(2, 9);
        var path = 'projects/' + dbEditor.projectId + '/designboards/' + dbEditor.boardId + '/' + ts + '.' + ext;
        var ref = firebase.storage().ref(path);
        var contentType = dbGuessImageContentType(f, ext);
        // Size the tile to the photo's real aspect ratio instead of cropping to a 220px square
        var w = 220, h = 220;
        var nat = await dbReadImageNaturalSize(f);
        if (nat && nat.w > 0 && nat.h > 0) {
          var sc = 320 / Math.max(nat.w, nat.h);
          w = Math.max(120, Math.round(nat.w * sc));
          h = Math.max(120, Math.round(nat.h * sc));
        }
        await ref.put(f, { contentType: contentType });
        var url = await ref.getDownloadURL();
        var tx, ty;
        if (useDefaultPoint) {
          var p = dbDefaultAddPoint(w, h);   // free spot near the visible center
          tx = p.x + w / 2;
          ty = p.y + h / 2;
        } else {
          tx = mx + fi * 20;
          ty = my + fi * 20;
        }
        dbPlaceProductOnCanvas(url, {
          title: f.name.replace(/\.[^.]+$/, ''),
          w: w,
          h: h,
          showPrice: false
        }, tx, ty);
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
    // Zoom-corrected drop point — raw clientX-rect.left is in SCREEN px; at 84% zoom every
    // dropped file landed up-left of the cursor, stacking onto existing tiles.
    var pt = dbCanvasPointFromEvent(e, canvas);
    var mx = pt.mx;
    var my = pt.my;
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
      // null point → each image finds a free spot near the visible center
      // (the old fixed 120,120 piled every "From computer" upload into the same corner)
      await dbUploadImageFilesToCanvas(inp.files, null, null);
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

  /** Push board tile cost/sell back to linked room-board clips (design board is not a financial doc). */
  async function syncBoardTileCostsToClips() {
    if (!dbEditor.projectId || !dbEditor.elements || !dbEditor.elements.length) return;
    var byClip = {};
    (dbEditor.clips || []).forEach(function(c) {
      if (c && c.id) byClip[c.id] = c.data || {};
    });
    var tasks = [];
    dbEditor.elements.forEach(function(el) {
      if (!el || el.type !== 'product' || !el.clipId) return;
      var cost = parseFloat(el.cost) || 0;
      var sell = parseFloat(el.sellPrice) || 0;
      if (cost <= 0 && sell <= 0) return;
      var d = byClip[el.clipId] || {};
      var patch = {};
      if (cost > 0 && (parseFloat(d.cost) || 0) !== cost) patch.cost = cost;
      if (sell > 0) {
        if ((parseFloat(d.clientPrice) || parseFloat(d.sellingPrice) || 0) !== sell) {
          patch.clientPrice = sell;
          patch.sellingPrice = sell;
        }
      }
      if (!Object.keys(patch).length) return;
      patch._boardCostSyncedAt = new Date().toISOString();
      tasks.push(
        db.collection('boards').doc(dbEditor.projectId).collection('clips').doc(el.clipId).set(patch, { merge: true })
          .then(function() {
            if (byClip[el.clipId]) Object.assign(byClip[el.clipId], patch);
          })
          .catch(function(e) { console.warn('[design board] clip cost sync', el.clipId, e); })
      );
    });
    if (tasks.length) await Promise.all(tasks);
  }

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
  window.saveBoardToFirestore = async function(opts) {
    opts = opts || {};
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
      try { await syncBoardTileCostsToClips(); } catch (_syncErr) { console.warn('[design board] syncBoardTileCostsToClips', _syncErr); }
      dbEditor.dirty = false;
      // Flash save confirmation
      var btn = document.querySelector('[onclick="saveBoardToFirestore()"]');
      if (btn && !opts.quiet) {
        var orig = btn.textContent;
        btn.textContent = '✓ Saved';
        btn.style.background = 'var(--green)';
        setTimeout(function() { btn.textContent = orig; btn.style.background = ''; }, 1200);
      }
      if (!opts.quiet && typeof showToast === 'function') showToast('Design board saved.', 'success', 2200);
    } catch(e) {
      console.error('Save error:', e);
      if (typeof showToast === 'function') showToast('Could not save design board — check connection and try Save again.', 'error', 6000);
    }
  };
  window.flushBoardAutoSave = flushBoardAutoSave;

  /** Raw image URL for capture/fetch (not HTML-escaped). */
  function dbElementImageUrl(el) {
    var raw = String((el && (el.imageUrl || el.img)) || '').trim();
    if (!raw) return '';
    return (typeof window._resolveImgSrc === 'function' ? (window._resolveImgSrc(raw) || raw) : raw);
  }

  function dbGuessImageMime(url) {
    var u = String(url || '').toLowerCase().split('?')[0];
    if (u.endsWith('.png')) return 'image/png';
    if (u.endsWith('.webp')) return 'image/webp';
    if (u.endsWith('.gif')) return 'image/gif';
    return 'image/jpeg';
  }

  function dbBytesToDataUrl(bytes, mime) {
    mime = mime || 'image/jpeg';
    var arr = new Uint8Array(bytes);
    var chunks = [];
    var step = 0x8000;
    for (var i = 0; i < arr.length; i += step) {
      chunks.push(String.fromCharCode.apply(null, arr.subarray(i, i + step)));
    }
    return 'data:' + mime + ';base64,' + btoa(chunks.join(''));
  }

  function dbBlobToDataUrl(blob) {
    return new Promise(function(resolve, reject) {
      var r = new FileReader();
      r.onload = function() { resolve(r.result); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  /** Load image bytes without html2canvas CORS re-fetch (Firebase SDK + XHR/fetch fallbacks). */
  async function dbFetchUrlAsDataUrl(url) {
    url = String(url || '').trim();
    if (!url) return '';
    if (/^data:image/i.test(url)) return url;
    if (/^blob:/i.test(url)) {
      try {
        var blobRes = await fetch(url);
        return await dbBlobToDataUrl(await blobRes.blob());
      } catch (_blob) { return ''; }
    }
    if (url.indexOf('//') === 0) url = window.location.protocol + url;
    if (url.indexOf('/') === 0 && url.indexOf('//') !== 0) url = window.location.origin + url;

    if (typeof firebase !== 'undefined' && firebase.storage && /firebasestorage\.googleapis\.com/i.test(url)) {
      try {
        var ref = firebase.storage().refFromURL(url);
        var bytes = await ref.getBytes(12 * 1024 * 1024);
        if (bytes && bytes.byteLength) return dbBytesToDataUrl(bytes, dbGuessImageMime(url));
      } catch (_fb) {}
    }

    try {
      var xhrBuf = await new Promise(function(res, rej) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function() {
          if (xhr.status >= 200 && xhr.status < 300 && xhr.response && xhr.response.byteLength) res(xhr.response);
          else rej(new Error('xhr ' + xhr.status));
        };
        xhr.onerror = function() { rej(new Error('xhr network')); };
        xhr.send();
      });
      if (xhrBuf && xhrBuf.byteLength) return dbBytesToDataUrl(xhrBuf, dbGuessImageMime(url));
    } catch (_xhr) {}

    try {
      var resp = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'omit', cache: 'force-cache' });
      if (resp.ok) return await dbBlobToDataUrl(await resp.blob());
    } catch (_fetch) {}

    return '';
  }

  function dbLoadDrawableImage(dataUrl) {
    return new Promise(function(resolve) {
      if (!dataUrl) { resolve(null); return; }
      var img = new Image();
      img.onload = function() { resolve(img); };
      img.onerror = function() { resolve(null); };
      img.src = dataUrl;
    });
  }

  function dbDrawImagePlaceholder(ctx, x, y, w, h, label) {
    ctx.fillStyle = '#f4f4f5';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(15,26,46,0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    label = String(label || '').trim();
    if (!label) return;
    ctx.fillStyle = '#6B7280';
    ctx.font = '12px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var words = label.split(/\s+/);
    var line = '';
    var lines = [];
    var maxW = Math.max(40, w - 16);
    for (var i = 0; i < words.length; i++) {
      var test = line ? (line + ' ' + words[i]) : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    if (lines.length > 3) lines = lines.slice(0, 3);
    var lh = 14;
    var startY = y + h / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach(function(ln, idx) {
      ctx.fillText(ln, x + w / 2, startY + idx * lh, maxW);
    });
  }

  /** Compose board PNG from model (avoids html2canvas CORS blank tiles on vendor CDNs). */
  async function dbCaptureBoardDataUrl() {
    var cw = parseFloat(dbEditor.boardData && dbEditor.boardData.canvasWidth) || 1400;
    var ch = parseFloat(dbEditor.boardData && dbEditor.boardData.canvasHeight) || 1000;
    var out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(cw));
    out.height = Math.max(1, Math.round(ch));
    var ctx = out.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);

    var els = (dbEditor.elements || []).slice();
    var imageTotal = 0;
    var imageFailed = 0;

    async function drawProductOrImage(el) {
      var ew = el.w || 180;
      var eh = el.h || 180;
      var x = el.x || 0;
      var y = el.y || 0;
      var imgUrl = dbElementImageUrl(el);
      var drew = false;
      if (imgUrl) {
        imageTotal++;
        var dataUrl = await dbFetchUrlAsDataUrl(imgUrl);
        var img = await dbLoadDrawableImage(dataUrl);
        if (img) {
          ctx.drawImage(img, x, y, ew, eh);
          drew = true;
        } else {
          imageFailed++;
        }
      }
      if (!drew) {
        dbDrawImagePlaceholder(ctx, x, y, ew, eh, dbBoardDisplayTitle(el.title) || 'Image');
      }
      var cursorY = y + eh;
      if (!el.hideCaption) {
        var title = dbBoardDisplayTitle(el.title);
        if (title) {
          cursorY += 18;
          ctx.fillStyle = '#1B3352';
          ctx.font = '600 14px "Cormorant Garamond", Georgia, serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.fillText(title, x + ew / 2, cursorY, ew);
        }
      }
      if (el.showDescription) {
        var desc = dbElementDescription(el);
        if (desc) {
          cursorY += 16;
          ctx.fillStyle = '#4B5563';
          ctx.font = '12px "Cormorant Garamond", Georgia, serif';
          ctx.fillText(desc.slice(0, 120), x + ew / 2, cursorY, ew);
        }
      }
      var showPrice = dbEditor.showPricing && !dbEditor.clientView && el.showPrice !== false;
      if (showPrice && el.sellPrice) {
        cursorY += 16;
        ctx.fillStyle = '#0A1F3D';
        ctx.font = '700 14px ui-monospace, monospace';
        ctx.fillText(fmt$(el.sellPrice), x + ew / 2, cursorY, ew);
      }
      if (el.annotation) {
        cursorY += 16;
        ctx.fillStyle = '#6B7280';
        ctx.font = 'italic 12px Georgia, serif';
        ctx.fillText(String(el.annotation).slice(0, 160), x + ew / 2, cursorY, ew);
      }
    }

    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (!el || el.type === 'arrow') continue;
      if (el.type === 'product' || el.type === 'image') {
        await drawProductOrImage(el);
      } else if (el.type === 'text') {
        ctx.fillStyle = el.color || '#333333';
        ctx.font = (el.fontWeight || 'normal') + ' ' + (el.fontSize || 13) + 'px ' + (el.fontFamily || 'inherit');
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        String(el.text || 'Text').split('\n').forEach(function(line, li) {
          ctx.fillText(line, el.x || 0, (el.y || 0) + li * ((el.fontSize || 13) * 1.25));
        });
      } else if (el.type === 'heading') {
        ctx.fillStyle = el.color || '#333333';
        ctx.font = '700 ' + (el.fontSize || 24) + 'px "Cormorant Garamond", Georgia, serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(String(el.text || 'HEADING').toUpperCase(), el.x || 0, el.y || 0);
      } else if (el.type === 'note') {
        var nw = el.w || 200;
        var nh = 56;
        ctx.fillStyle = '#FFFDE7';
        ctx.fillRect(el.x || 0, el.y || 0, nw, nh);
        ctx.strokeStyle = '#FFF9C4';
        ctx.strokeRect((el.x || 0) + 0.5, (el.y || 0) + 0.5, nw - 1, nh - 1);
        ctx.fillStyle = '#666666';
        ctx.font = 'italic 12px Georgia, serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(String(el.text || 'Designer notes...').slice(0, 200), (el.x || 0) + 10, (el.y || 0) + 10, nw - 20);
      } else if (el.type === 'pricetag') {
        var showP = dbEditor.showPricing && !dbEditor.clientView;
        if (!showP) continue;
        var pt = String(el.text || '');
        if (!pt) continue;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(el.x || 0, el.y || 0, Math.max(60, ctx.measureText(pt).width + 16), 22);
        ctx.strokeStyle = '#dddddd';
        ctx.strokeRect((el.x || 0) + 0.5, (el.y || 0) + 0.5, Math.max(60, ctx.measureText(pt).width + 16) - 1, 21);
        ctx.fillStyle = '#333333';
        ctx.font = '11px Georgia, serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(pt, (el.x || 0) + 8, (el.y || 0) + 11);
      }
    }

    els.forEach(function(el) {
      if (!el || el.type !== 'arrow') return;
      ctx.strokeStyle = el.color || '#333333';
      ctx.lineWidth = el.strokeWidth || 1.5;
      ctx.beginPath();
      ctx.moveTo(el.x1 || 0, el.y1 || 0);
      ctx.lineTo(el.x2 || 0, el.y2 || 0);
      ctx.stroke();
      var x1 = el.x1 || 0, y1 = el.y1 || 0, x2 = el.x2 || 0, y2 = el.y2 || 0;
      var ang = Math.atan2(y2 - y1, x2 - x1);
      var hl = 10;
      ctx.fillStyle = el.color || '#333333';
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - hl * Math.cos(ang - 0.4), y2 - hl * Math.sin(ang - 0.4));
      ctx.lineTo(x2 - hl * Math.cos(ang + 0.4), y2 - hl * Math.sin(ang + 0.4));
      ctx.closePath();
      ctx.fill();
      if (el.label) {
        ctx.fillStyle = '#666666';
        ctx.font = '11px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(el.label), (x1 + x2) / 2, (y1 + y2) / 2 - 6);
      }
    });

    return {
      dataUrl: out.toDataURL('image/png'),
      imageTotal: imageTotal,
      imageFailed: imageFailed
    };
  }

  window.exportBoardPNG = async function() {
    if (window._dbExporting) return;
    var canvas = document.getElementById('dbCanvas');
    if (!canvas) return;
    if (typeof cchConfirm === 'function') {
      var go = await cchConfirm('Create a PNG image of this board?\n\nVendor-site images may show as labeled placeholders if their server blocks copying. For a pixel-perfect copy, use "Print board".', 'Download PNG', { confirmText: 'Create PNG', cancelText: 'Cancel' });
      if (!go) return;
    }
    window._dbExporting = true;
    dbEditor.selectedId = null;
    if (typeof dbUpdateSelectionDom === 'function') dbUpdateSelectionDom();
    try {
      if (typeof showToast === 'function') showToast('Creating board image…', 2500);
      var cap = await dbCaptureBoardDataUrl();
      var link = document.createElement('a');
      link.download = (dbEditor.boardData.title || 'design-board') + '.png';
      link.href = cap.dataUrl;
      link.click();
      if (cap.imageFailed > 0 && typeof showToast === 'function') {
        showToast(cap.imageFailed + ' vendor image(s) could not be embedded — use Print board for full fidelity.', 'warning', 7000);
      }
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

  /** Capture full board canvas PNG and open Post Decision modal (presentation → client Decisions). */
  window.dbPostBoardAsDecision = async function() {
    if (!dbEditor.projectId || !dbEditor.boardId) return;
    if (typeof cpOpenPostDesignBoardDecisionModal !== 'function') {
      if (typeof cchAlert === 'function') await cchAlert('Client portal decision posting is not available on this page.', 'Post Decision');
      return;
    }
    if (window._dbExporting) return;
    var canvas = document.getElementById('dbCanvas');
    if (!canvas) {
      cpOpenPostDesignBoardDecisionModal(dbEditor.projectId, dbEditor.boardId, {
        fromEditor: true,
        boardName: _dbBoardLabel(dbEditor.boardData)
      });
      return;
    }
    window._dbExporting = true;
    dbEditor.selectedId = null;
    if (typeof dbUpdateSelectionDom === 'function') dbUpdateSelectionDom();
    try {
      await saveBoardToFirestore();
      if (typeof showToast === 'function') showToast('Capturing board layout…', 2500);
      var cap = await dbCaptureBoardDataUrl();
      var dataUrl = cap.dataUrl;
      if (cap.imageFailed > 0 && typeof showToast === 'function') {
        showToast(cap.imageFailed + ' vendor image(s) could not be embedded (site blocks copying). Titles shown instead.', 'warning', 6000);
      }
      var path = 'boards/' + dbEditor.projectId + '/clientDecisions/db-' + dbEditor.boardId + '-' + Date.now() + '.png';
      var url = '';
      if (typeof uploadBase64ToStorage === 'function') {
        url = await uploadBase64ToStorage(dataUrl, path);
      } else if (typeof uploadImageToStorage === 'function') {
        var blob = await (await fetch(dataUrl)).blob();
        url = await uploadImageToStorage(new File([blob], 'design-board.png', { type: 'image/png' }), path);
      }
      cpOpenPostDesignBoardDecisionModal(dbEditor.projectId, dbEditor.boardId, {
        fromEditor: true,
        boardName: _dbBoardLabel(dbEditor.boardData),
        attachmentUrls: url ? [url] : []
      });
    } catch (e) {
      if (typeof cchAlert === 'function') {
        await cchAlert('Could not capture board image. Try Print board, or post from the Design Boards list using the cover image.\n\n' + ((e && e.message) || e), 'Post Decision');
      }
      cpOpenPostDesignBoardDecisionModal(dbEditor.projectId, dbEditor.boardId, {
        fromEditor: false,
        boardName: _dbBoardLabel(dbEditor.boardData)
      });
    } finally {
      window._dbExporting = false;
    }
  };

  window.addImageToBoard = async function() {
    if (typeof cchPrompt !== 'function') return;
    if (!dbEditor.projectId || !dbEditor.boardId) {
      if (typeof showToast === 'function') showToast('Open a saved design board first', 'warning');
      return;
    }
    var url = await cchPrompt('Image URL (paste from browser or right-click > copy image address):', '', 'Add image');
    if (url === null) return;
    url = dbNormalizeBoardImageUrl(url);
    if (!url) {
      if (typeof showToast === 'function') {
        showToast('That does not look like a direct image link. Right-click the image and choose Copy image address — not the page URL.', 'error', 6500);
      } else if (typeof cchAlert === 'function') {
        await cchAlert('That does not look like a direct image link.\n\nRight-click the image on the website and choose Copy image address — not the page URL from the address bar.', 'Add image');
      }
      return;
    }
    var titleOpt = await cchPrompt('Title (optional):', '', 'Image title');
    if (titleOpt === null) return;
    if (typeof showToast === 'function') showToast('Importing image…', 3000);
    var storedUrl = url;
    var uploaded = false;
    try {
      var hosted = await dbUploadRemoteImageUrlToStorage(url);
      if (hosted) {
        storedUrl = hosted;
        uploaded = true;
      }
    } catch (eUp) {
      console.warn('[design board] url upload', eUp);
    }
    var nat = await dbReadImageNaturalSizeFromUrl(storedUrl);
    if (!nat || !(nat.w > 0 && nat.h > 0)) {
      nat = await dbReadImageNaturalSizeFromUrl(url);
    }
    var size = dbBoardTileSizeFromNatural(nat, 250, 250);
    var p = dbDefaultAddPoint(size.w, size.h);
    dbPlaceProductOnCanvas(storedUrl, {
      title: String(titleOpt || '').trim(),
      w: size.w,
      h: size.h,
      showPrice: false
    }, p.x + size.w / 2, p.y + size.h / 2);
    if (typeof showToast === 'function') {
      if (uploaded) {
        showToast('Image added — saved to project storage. Click Save to persist.', 'success', 4000);
      } else {
        var errHint = String(window._dbLastImageImportError || '').trim();
        showToast(errHint || 'Could not import that URL. Right-click the image → Copy image address, or use From computer.', 'error', 7000);
        // Remove empty tile if hotlink also failed
        if (!nat || !(nat.w > 0)) {
          dbEditor.elements = (dbEditor.elements || []).filter(function(el) { return el.id !== dbEditor.selectedId; });
          dbEditor.selectedId = null;
          renderCanvas();
          renderProps();
        }
      }
    }
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
          '<div style="font-size:11px;color:#999;line-height:1.4;">PNG download may show labeled placeholders for vendor-site images that block copying. Use <strong>Print board</strong> for a pixel-perfect copy.</div>' +
        '</div>' +
        '<div style="padding:10px 18px;border-top:1px solid #eee;text-align:right;"><button class="btn btn-secondary btn-sm" onclick="' + rm + '">Close</button></div>' +
      '</div>';
    document.body.appendChild(ov);
  };

  /** Scale inline px lengths (Chrome print breaks CSS transform:scale on absolute tiles). */
  function dbScaleInlineStylePx(node, s) {
    if (!node || !node.style || !(s > 0) || s === 1) return;
    var props = ['left', 'top', 'right', 'bottom', 'width', 'height', 'maxWidth', 'minWidth', 'minHeight', 'maxHeight', 'fontSize', 'letterSpacing', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft'];
    for (var i = 0; i < props.length; i++) {
      var prop = props[i];
      var val = node.style[prop];
      if (!val || val.indexOf('px') < 0) continue;
      var n = parseFloat(val);
      if (isFinite(n)) node.style[prop] = (n * s) + 'px';
    }
    var pad = node.style.padding;
    if (pad && pad.indexOf('px') >= 0) {
      node.style.padding = pad.replace(/([\d.]+)px/g, function(_, num) {
        return (parseFloat(num) * s) + 'px';
      });
    }
  }

  function dbScaleSvgNumberAttr(el, attr, s) {
    if (!el || !el.hasAttribute(attr)) return;
    var n = parseFloat(el.getAttribute(attr));
    if (isFinite(n)) el.setAttribute(attr, String(n * s));
  }

  /**
   * Fit board into landscape printable area by rewriting left/top/width/height (and SVG coords).
   * Do NOT use transform:scale — Chrome print collapses absolute children into a pile.
   */
  function dbScalePrintCloneGeometry(clone, s) {
    if (!clone || !(s > 0)) return;
    if (s !== 1) {
      var all = clone.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) dbScaleInlineStylePx(all[i], s);
      dbScaleInlineStylePx(clone, s);
      clone.querySelectorAll('line, text, circle, polygon').forEach(function(el) {
        ['x1', 'y1', 'x2', 'y2', 'x', 'y', 'cx', 'cy', 'r', 'font-size', 'stroke-width'].forEach(function(a) {
          dbScaleSvgNumberAttr(el, a, s);
        });
      });
      clone.querySelectorAll('marker').forEach(function(m) {
        ['markerWidth', 'markerHeight', 'refX', 'refY'].forEach(function(a) {
          dbScaleSvgNumberAttr(m, a, s);
        });
      });
    }
  }

  function dbPrintFitScale(cw, ch) {
    // Letter landscape @ ~96dpi with 8mm margins (matches @page below)
    var marginPx = (8 / 25.4) * 96;
    var availW = Math.max(320, 11 * 96 - 2 * marginPx);
    var availH = Math.max(320, 8.5 * 96 - 2 * marginPx);
    return Math.min(1, availW / cw, availH / ch);
  }

  function dbWaitForPrintImages(doc, maxMs) {
    return new Promise(function(resolve) {
      var imgs = Array.prototype.slice.call(doc.querySelectorAll('img'));
      if (!imgs.length) { resolve(); return; }
      var left = imgs.length;
      var settled = false;
      var finish = function() {
        if (settled) return;
        settled = true;
        resolve();
      };
      var tick = function() {
        left -= 1;
        if (left <= 0) finish();
      };
      setTimeout(finish, maxMs || 4500);
      imgs.forEach(function(img) {
        if (img.complete) tick();
        else {
          img.addEventListener('load', tick, { once: true });
          img.addEventListener('error', tick, { once: true });
        }
      });
    });
  }

  window.dbPrintBoard = async function() {
    var canvas = document.getElementById('dbCanvas');
    if (!canvas) return;
    dbEditor.selectedId = null;
    if (typeof dbUpdateSelectionDom === 'function') dbUpdateSelectionDom();
    var cw = parseFloat(dbEditor.boardData && dbEditor.boardData.canvasWidth) || parseFloat(canvas.style.width) || canvas.offsetWidth || 1400;
    var ch = dbPrintCanvasHeight();
    dbSyncBrandingFooter();
    var w = window.open('', '_blank');
    if (!w) { if (typeof cchAlert === 'function') cchAlert('Allow pop-ups to print the board.', 'Print'); return; }
    var boardLabel = esc(_dbBoardLabel(dbEditor.boardData));
    var includeName = !!window._dbPrintIncludeBoardName;
    var clone = canvas.cloneNode(true);
    clone.querySelectorAll('.db-resize, .db-el-handles-layer').forEach(function(n) { n.remove(); });
    clone.querySelectorAll('.db-el-selected').forEach(function(n) { n.classList.remove('db-el-selected'); });
    var hint = clone.querySelector('#dbCanvasDropHint');
    if (hint) hint.remove();
    var s = dbPrintFitScale(cw, ch);
    var pcw = Math.max(1, Math.round(cw * s));
    var pch = Math.max(1, Math.round(ch * s));
    dbScalePrintCloneGeometry(clone, s);
    clone.style.boxShadow = 'none';
    clone.style.transform = 'none';
    clone.style.width = pcw + 'px';
    clone.style.height = pch + 'px';
    clone.style.minHeight = pch + 'px';
    clone.style.maxHeight = pch + 'px';
    var brandClone = clone.querySelector('#dbBranding');
    if (brandClone) {
      brandClone.style.position = 'absolute';
      brandClone.style.left = '0';
      brandClone.style.right = '0';
      brandClone.style.bottom = '0';
      brandClone.style.top = 'auto';
      brandClone.style.paddingBottom = Math.max(6, Math.round(14 * s)) + 'px';
    }
    var footnote = includeName
      ? '<div class="db-print-footnote">' + boardLabel + '</div>'
      : '';
    var capFs = Math.max(9, Math.round(14 * s));
    var descFs = Math.max(8, Math.round(12 * s));
    var priceFs = Math.max(9, Math.round(14 * s));
    var printCss =
      '@page{size:landscape;margin:8mm;}' +
      'html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}' +
      '.db-print-sheet{padding:0;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;}' +
      '#dbPrintWrap{margin:0 auto;overflow:visible;page-break-inside:avoid;break-inside:avoid;width:' + pcw + 'px;}' +
      '#dbPrintInner{width:' + pcw + 'px;height:' + pch + 'px;margin:0 auto;transform:none!important;}' +
      '#dbCanvas{position:relative;overflow:hidden;background:#fff;font-family:"Cormorant Garamond",Georgia,serif;transform:none!important;}' +
      '.db-el{transform:none!important;}' +
      '.db-el-product{box-sizing:border-box;}' +
      '.db-el-media{position:relative;box-sizing:border-box;background:#fff;border:1px solid rgba(15,26,46,0.06);border-radius:2px;overflow:hidden;}' +
      '.db-el-media img{width:100%;height:100%;object-fit:cover;object-position:center;display:block;}' +
      '.db-el-caption{margin-top:' + Math.max(2, Math.round(5 * s)) + 'px;font-size:' + capFs + 'px;font-weight:600;color:#1B3352;text-align:center;line-height:1.3;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word;}' +
      '.db-el-desc{margin-top:' + Math.max(1, Math.round(3 * s)) + 'px;font-size:' + descFs + 'px;color:#4B5563;text-align:center;line-height:1.4;white-space:pre-wrap;}' +
      '.db-el-price{margin-top:' + Math.max(1, Math.round(3 * s)) + 'px;font-size:' + priceFs + 'px;font-weight:700;color:#0A1F3D;text-align:center;font-family:ui-monospace,monospace;}' +
      '.db-el-annotation{margin-top:' + Math.max(2, Math.round(4 * s)) + 'px;font-size:' + descFs + 'px;color:#6B7280;text-align:center;font-style:italic;white-space:pre-line;line-height:1.35;}' +
      '.db-print-footnote{margin:8px auto 0;text-align:center;font-family:Georgia,serif;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#9CA3AF;page-break-before:avoid;}' +
      '@media print{' +
        'html,body{width:100%;height:auto;overflow:visible;}' +
        '.db-print-sheet{page-break-inside:avoid;break-inside:avoid;}' +
        '#dbPrintWrap{page-break-inside:avoid;break-inside:avoid;overflow:visible!important;}' +
        '#dbPrintInner{page-break-inside:avoid;break-inside:avoid;transform:none!important;}' +
        '#dbCanvas{page-break-inside:avoid;break-inside:avoid;transform:none!important;}' +
        'img{-webkit-print-color-adjust:exact;print-color-adjust:exact;}' +
      '}';
    var html = '<html><head><meta charset="utf-8"><title>' + boardLabel + ' — Design Board</title>' +
      '<style>' + printCss + '</style></head><body>' +
      '<div class="db-print-sheet"><div id="dbPrintWrap"><div id="dbPrintInner">' + clone.outerHTML + '</div></div>' + footnote + '</div>' +
      '</body></html>';
    w.document.write(html);
    w.document.close();
    w.focus();
    w.onafterprint = function() { try { w.close(); } catch (e) {} };
    try {
      await dbWaitForPrintImages(w.document, 4500);
    } catch (eWait) {}
    setTimeout(function() {
      try {
        if (typeof w.document.execCommand === 'function') {
          w.document.execCommand('print', false, null);
        } else {
          w.print();
        }
      } catch (e) {
        try { w.print(); } catch (e2) {}
      }
    }, 200);
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
  window.__cchDbListRender = window.renderDesignBoardsTab;

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

  /**
   * Height of the text block rendered BELOW a tile's image box (caption/desc/price/annotation).
   * The image box is el.w × el.h, but the visible tile is taller — every overlap/placement
   * calculation must use this or labels collide with the tile below (the classic "stuck board").
   */
  function dbTileExtrasH(el) {
    if (!el || (el.type !== 'product' && el.type !== 'image')) return 0;
    var w = Math.max(80, el.w || 180);
    var extras = 0;
    if (!el.hideCaption) {
      var title = dbBoardDisplayTitle(el.title);
      if (title) {
        // caption: 14px/1.3 ≈ 18.2px per line; ~7.7px avg glyph width at 600 weight
        var lines = Math.max(1, Math.min(3, Math.ceil((title.length * 7.7) / w)));
        extras += 5 + Math.ceil(lines * 18.2);
      }
    }
    if (el.showDescription && dbElementDescription(el)) {
      var desc = dbElementDescription(el);
      var dLines = Math.max(1, Math.min(3, Math.ceil((desc.length * 6.2) / w)));
      extras += 3 + Math.ceil(dLines * 16.8);
    }
    if (dbEditor.showPricing && !dbEditor.clientView && el.showPrice !== false && el.sellPrice) extras += 3 + 18;
    if (el.annotation) extras += 4 + 17;
    return extras;
  }

  /** True on-screen tile height. Prefers live DOM measurement, falls back to estimate. */
  function dbElementFootprintH(el) {
    if (!el) return 180;
    if (el.type === 'product' || el.type === 'image') {
      var node = dbFindElementDomNode(el.id);
      if (node && node.offsetHeight > 0) {
        return Math.ceil(node.offsetHeight);
      }
      return (el.h || 180) + dbTileExtrasH(el);
    }
    return el.h || 180;
  }

  /** Element box using the tile's TRUE visual height (image + labels underneath). */
  function dbElementVisualBox(el) {
    var b = dbElementBox(el);
    var fh = dbElementFootprintH(el);
    if (fh > b.h) {
      b.h = fh;
      b.bottom = b.y + fh;
    }
    return b;
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
        if (dbBoxesOverlap(dbElementVisualBox(tiles[i]), dbElementVisualBox(tiles[j]))) n++;
      }
    }
    return n;
  }

  function dbSyncCanvasDomSize() {
    var cvs = document.getElementById('dbCanvas');
    if (!cvs || !dbEditor.boardData) return;
    var cw = dbEditor.boardData.canvasWidth || 1400;
    var ch = dbEditor.boardData.canvasHeight || 1000;
    cvs.style.width = cw + 'px';
    cvs.style.height = ch + 'px';
    cvs.style.minHeight = ch + 'px';
    var spacer = document.getElementById('dbCanvasSpacer');
    if (spacer) {
      spacer.style.width = cw + 'px';
      spacer.style.height = ch + 'px';
    }
  }

  /** Keep at least ~48px of a tile on the board; grow canvas height instead of clipping off the bottom. */
  function dbClampElPositionOnCanvas(el) {
    if (!el || el.type === 'arrow' || !dbEditor.boardData) return false;
    var maxW = dbEditor.boardData.canvasWidth || 1400;
    var maxH = dbEditor.boardData.canvasHeight || 1000;
    var w = el.w || 180;
    var h = el.h || 180;
    var x = el.x || 0;
    var y = el.y || 0;
    var minVisible = 48;
    var nx = Math.max(0, Math.min(x, Math.max(0, maxW - Math.min(minVisible, w))));
    var ny = Math.max(0, y);
    var grew = false;
    if (ny + h > maxH - 8) {
      maxH = Math.ceil(ny + h + 64);
      dbEditor.boardData.canvasHeight = Math.max(dbEditor.boardData.canvasHeight || 1000, maxH);
      grew = true;
    }
    if (grew) dbSyncCanvasDomSize();
    if (nx !== x || ny !== y) {
      el.x = nx;
      el.y = ny;
      return true;
    }
    return grew;
  }

  /** Pull tiles that sit fully/mostly outside the canvas back into view (and grow height if needed). */
  function dbRescueOffCanvasTiles() {
    if (!dbEditor.boardData) return 0;
    var maxW = dbEditor.boardData.canvasWidth || 1400;
    var maxH = dbEditor.boardData.canvasHeight || 1000;
    var rescued = 0;
    var grewH = maxH;
    (dbEditor.elements || []).forEach(function(el) {
      if (!el || el.type === 'arrow') return;
      var box = dbElementVisualBox(el);
      var w = Math.max(24, box.w || el.w || 180);
      var h = Math.max(24, box.h || el.h || 40);
      var x = el.x || 0;
      var y = el.y || 0;
      var nx = x;
      var ny = y;
      if (x < 0) nx = 0;
      if (y < 0) ny = 0;
      if (nx >= maxW - 8) nx = Math.max(0, maxW - Math.min(w, maxW));
      if (nx + w > maxW) nx = Math.max(0, maxW - Math.min(w, maxW));
      if (ny >= maxH - 8) {
        grewH = Math.max(grewH, Math.ceil(ny + h + 64));
      } else if (ny + h > maxH) {
        grewH = Math.max(grewH, Math.ceil(ny + h + 48));
      }
      if (nx !== x || ny !== y) {
        el.x = nx;
        el.y = ny;
        rescued++;
      } else if (y >= maxH - 8 || y + h > maxH + 1) {
        rescued++;
      }
    });
    if (grewH > maxH) {
      dbEditor.boardData.canvasHeight = grewH;
      dbSyncCanvasDomSize();
    }
    return rescued;
  }

  /** Nudge overlapping product tiles apart — keeps every item; grows canvas instead of shoving off-edge. */
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
          // Visual boxes include caption/price height — a 12px gap below the IMAGE box
          // is instantly eaten by the label, which is why old repairs never looked repaired.
          var boxA = dbElementVisualBox(a);
          var boxB = dbElementVisualBox(b);
          if (!dbBoxesOverlap(boxA, boxB)) continue;
          any = true;
          moved++;
          a.y = boxB.bottom + 16;
          a.x = a.x || 0;
          if (a.x + boxA.w > maxW - 8) {
            a.x = Math.max(0, maxW - Math.min(boxA.w, maxW));
          }
          if (a.y + boxA.h > maxH - 24) {
            maxH = Math.ceil(a.y + boxA.h + 64);
            if (dbEditor.boardData) dbEditor.boardData.canvasHeight = Math.max(dbEditor.boardData.canvasHeight || 1000, maxH);
          }
          a.x = Math.max(0, a.x || 0);
          a.y = Math.max(0, a.y || 0);
        }
      }
      if (!any) break;
    }
    if (dbEditor.boardData && (dbEditor.boardData.canvasHeight || 1000) > ((document.getElementById('dbCanvas') && parseFloat(document.getElementById('dbCanvas').style.height)) || 0)) {
      var cvs = document.getElementById('dbCanvas');
      var ch = dbEditor.boardData.canvasHeight || 1000;
      if (cvs) {
        cvs.style.height = ch + 'px';
        cvs.style.minHeight = ch + 'px';
      }
    }
    return moved;
  }

  // ==================== TIDY BOARD (auto-arrange) ====================
  /**
   * Magazine layout for product/image tiles. Undoable. Does NOT auto-save
   * (autosave previously persisted clipped tiles that looked deleted).
   */
  window.dbTidyBoard = function() {
    try {
      var bd = dbEditor.boardData;
      if (!bd) {
        if (typeof showToast === 'function') showToast('Board not ready — wait a second and try Tidy again.', 3000);
        return;
      }
      var cw = bd.canvasWidth || 1400;
      var margin = 48;
      var gutter = 28;
      var tiles = (dbEditor.elements || []).filter(function(e) {
        return e && (e.type === 'product' || e.type === 'image');
      });
      if (!tiles.length) {
        if (typeof showToast === 'function') showToast('Nothing to arrange — add items to the board first.', 3000);
        return;
      }
      pushUndo();

      var y = margin;

      // Headings stack centered at the top
      var headings = (dbEditor.elements || []).filter(function(e) { return e && e.type === 'heading'; });
      headings.forEach(function(hEl) {
        var fs = hEl.fontSize || 24;
        var estW = Math.min(cw - margin * 2, Math.max(120, String(hEl.text || 'HEADING').length * fs * 0.72));
        hEl.x = Math.max(margin, Math.round((cw - estW) / 2));
        hEl.y = y;
        y += Math.ceil(fs * 1.6) + 14;
      });
      if (headings.length) y += 10;

      // Keep the designer's rough top-to-bottom order
      tiles.sort(function(a, b) { return ((a.y || 0) - (b.y || 0)) || ((a.x || 0) - (b.x || 0)); });

      var avail = cw - margin * 2;
      var targetH = tiles.length <= 4 ? 340 : (tiles.length <= 8 ? 300 : 260);
      function aspectOf(t) {
        var ar = (t.w || 180) / Math.max(1, t.h || 180);
        return Math.max(0.45, Math.min(2.6, ar));
      }

      var row = [];
      var aspectSum = 0;
      function flushRow(isLast) {
        if (!row.length) return;
        var gaps = gutter * (row.length - 1);
        var h = (avail - gaps) / Math.max(0.01, aspectSum);
        if (isLast) h = Math.min(h, targetH);
        h = Math.max(140, Math.min(h, 460));
        var x = margin;
        var maxExtras = 0;
        var i;
        for (i = 0; i < row.length; i++) {
          var t = row[i];
          var ar = aspectOf(t);
          t.h = Math.round(h);
          t.w = Math.max(80, Math.round(h * ar));
          t.x = Math.round(x);
          t.y = Math.round(y);
          // Keep every tile inside the white board — overflow:hidden clips look like deletes
          if (t.x + t.w > cw - margin) {
            t.w = Math.max(80, cw - margin - t.x);
          }
          if (t.x < margin) t.x = margin;
          if (t.y < 0) t.y = 0;
          x = t.x + t.w + gutter;
          var ex = dbTileExtrasH(t);
          if (ex > maxExtras) maxExtras = ex;
        }
        y += Math.round(h) + maxExtras + gutter;
        row = [];
        aspectSum = 0;
      }
      tiles.forEach(function(t) {
        row.push(t);
        aspectSum += aspectOf(t);
        var gaps = gutter * (row.length - 1);
        if ((avail - gaps) / aspectSum <= targetH || row.length >= 5) flushRow(false);
      });
      flushRow(true);

      // Authoritative height from true footprints (image + captions)
      var contentBottom = dbComputeElementsBottom();
      bd.canvasHeight = Math.max(800, Math.ceil(contentBottom + 100));
      dbRescueOffCanvasTiles();

      dbEditor.selectedId = null;
      dbEditor.dirty = true;
      renderCanvas();
      dbSyncCanvasDomSize();
      dbSyncBrandingFooter();
      dbApplyViewZoom();
      dbFitCanvasToView(true);
      var wrap = document.getElementById('dbCanvasWrap');
      if (wrap) {
        wrap.scrollTop = 0;
        wrap.scrollLeft = 0;
      }
      renderProps();
      var banner = document.getElementById('dbOverlapBanner');
      if (banner) banner.remove();
      // No autoSave — autosave was locking in clipped layouts that looked deleted
      if (typeof showToast === 'function') {
        showToast('Board tidied — ' + tiles.length + ' items. Ctrl+Z undoes. Save when it looks right.', 5500);
      }
    } catch (err) {
      console.error('[design board] tidy failed:', err);
      if (typeof showToast === 'function') showToast('Tidy error — nothing was lost. Try Undo (Ctrl+Z).', 4000);
    }
  };

  function dbShowOverlapBanner(overlapPairs) {
    if (!overlapPairs || overlapPairs < 1) return;
    var root = document.getElementById('dbEditorRoot');
    if (!root || document.getElementById('dbOverlapBanner')) return;
    var bar = document.createElement('div');
    bar.id = 'dbOverlapBanner';
    bar.style.cssText = 'padding:10px 14px;background:rgba(180,83,9,0.1);border-bottom:1px solid rgba(180,83,9,0.25);font-size:12px;color:#92400E;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;';
    bar.innerHTML = '<span><strong>Stacked tiles detected</strong> — ' + overlapPairs + ' overlap' + (overlapPairs !== 1 ? 's' : '') + '. Your work is safe. Nothing was moved. Use <strong>✨ Tidy</strong> or <strong>Spread stacks</strong> only if you want them rearranged.</span>' +
      '<span style="display:flex;gap:8px;flex-shrink:0;">' +
        '<button type="button" class="btn btn-primary btn-sm" onclick="void dbTidyBoard()">✨ Tidy board</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" onclick="void dbRepairBoard(true)">Spread stacks</button>' +
        '<button type="button" class="btn btn-secondary btn-sm" onclick="document.getElementById(\'dbOverlapBanner\').remove()">Dismiss</button>' +
      '</span>';
    var tb = document.getElementById('dbToolbar');
    if (tb && tb.parentNode) tb.parentNode.insertBefore(bar, tb.nextSibling);
  }

  function dbClearBoardPointerChrome() {
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
  }

  /**
   * End stuck drag AND clear selection chrome. CRITICAL: abort (revert) in-progress drag —
   * do NOT finish/commit the stuck pointer position (that flung tiles off-canvas and looked like erase).
   * Never purge DOM without a full model rebuild. Never deletes elements.
   */
  window.dbUnstickBoard = function() {
    try {
      // Abort restores pre-drag x/y via onAbort. Finish/onUp would keep bad stuck coords.
      if (_dbPointerGesture) {
        dbAbortPointerGesture();
      } else {
        dbForceRemoveAllDragListeners();
        dbClearAllDragTransforms();
      }
      dbEditor.isDragging = false;
      dbEditor.isResizing = false;
      dbEditor.arrowStart = null;
      dbEditor.tool = 'select';
      dbEditor._propsPanelForId = null;
      _dbSuppressSidebarDblClickUntil = 0;

      // Gold grips / selected outline — Unstick used to leave these on (looked "still sticky")
      dbEditor.selectedId = null;

      var coverModal = document.getElementById('dbCoverPickerModal');
      if (coverModal) coverModal.remove();

      // Pull anything that still sits outside the white board back into view
      (dbEditor.elements || []).forEach(function(el) {
        if (el && el.type !== 'arrow') dbClampElPositionOnCanvas(el);
      });

      // Full rebuild from model — guarantees tiles reappear even if DOM was messy
      renderCanvas();
      dbSyncCanvasDomSize();
      dbUpdateSelectionDom();
      refreshDbToolbarTools();
      renderProps();
      dbClearBoardPointerChrome();

      var tb = document.getElementById('dbUnstickToolbarBtn');
      if (tb) {
        tb.style.background = '#d4edda';
        setTimeout(function() { tb.style.background = ''; }, 400);
      }
      var st = document.getElementById('dbUnstickStatus');
      if (st) {
        st.textContent = 'Unstuck ✓';
        st.style.color = 'var(--green)';
        setTimeout(function() { st.textContent = ''; st.style.color = 'var(--gray-500)'; }, 2500);
      }
      if (typeof showToast === 'function') {
        showToast('Unstuck — selection cleared. Your tiles are still on the board.', 3500);
      }
    } catch (err) {
      console.error('[design board] unstick failed:', err);
      try {
        dbEditor.selectedId = null;
        renderCanvas();
        dbUpdateSelectionDom();
        renderProps();
      } catch (_r) {}
      if (typeof showToast === 'function') showToast('Unstick error — hard refresh (Ctrl+Shift+R).', 5000);
    }
  };

  /** Explicit overlap nudge only (toolbar / banner). Never runs on Escape or open. */
  window.dbRepairBoard = function(fromBanner) {
    try {
      dbForceEndInteraction({ resync: false });
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

      var snapshot = JSON.stringify(dbEditor.elements);
      var spreadCount = dbSpreadStackedTiles();
      var rescued = dbRescueOffCanvasTiles();
      if (spreadCount > 0 || rescued > 0) {
        dbEditor.undoStack.push(snapshot);
        if (dbEditor.undoStack.length > 40) dbEditor.undoStack.shift();
        dbEditor.dirty = true;
      }

      dbPurgeGhostDomNodes();
      renderCanvas();
      dbSyncCanvasDomSize();
      dbUpdateSelectionDom();
      refreshDbToolbarTools();
      renderProps();
      dbClearBoardPointerChrome();

      var banner = document.getElementById('dbOverlapBanner');
      if (banner) banner.remove();

      var st = document.getElementById('dbUnstickStatus');
      var msg = spreadCount > 0
        ? ('Spread ' + spreadCount + ' stack' + (spreadCount !== 1 ? 's' : ''))
        : (rescued > 0 ? ('Pulled ' + rescued + ' back on board') : 'No stacks to spread');
      if (st) {
        st.textContent = msg;
        st.style.color = 'var(--green)';
        setTimeout(function() { st.textContent = ''; st.style.color = 'var(--gray-500)'; }, 3500);
      }
      if (typeof showToast === 'function') {
        showToast(spreadCount > 0
          ? ('Spread ' + spreadCount + ' overlapping tiles apart. Nothing deleted.')
          : 'No overlapping stacks to spread — drag is free.', 4000);
      }
    } catch (err) {
      console.error('[design board] spread failed:', err);
      if (typeof showToast === 'function') showToast('Spread error — hard refresh (Ctrl+Shift+R).', 5000);
    }
  };

  window.dbResetBoardInteraction = function() {
    window.dbUnstickBoard();
  };

  if (!window._dbUnstickOnBlurBound) {
    window._dbUnstickOnBlurBound = true;
    window.addEventListener('blur', function() {
      if (!window._cchDesignBoardEditorActive || !dbEditor || !dbEditor.boardId) return;
      if (_dbPointerGesture || dbEditor.isDragging || dbEditor.isResizing) {
        dbForceEndInteraction({ resync: true });
      }
    });
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState !== 'hidden') return;
      if (!window._cchDesignBoardEditorActive || !dbEditor || !dbEditor.boardId) return;
      if (_dbPointerGesture || dbEditor.isDragging || dbEditor.isResizing) {
        dbForceEndInteraction({ resync: true });
      }
    });
  }

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

  console.info('[CCH Design Board] build 20260725db61 — panel hide: DOM-driven toggle (fix click-twice) + no auto-fit');

})();
