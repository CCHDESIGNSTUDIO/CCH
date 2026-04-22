// ==================== CCH CLIENT BOARD VIEWER ====================
// Client-facing design board: full canvas (designer layout), presentation-first — no starring workflow from the main board UI.

(function() {
  'use strict';

  var cbState = {
    projectId: null,
    boardId: null,
    boardData: null,
    items: [],
    /** Elements with imageUrl resolved for read-only canvas (library + clip). */
    resolvedCanvasElements: null,
    stars: {},
    comments: {},
    newComment: '',
    filter: 'all',
    view: 'welcome', // welcome, board, detail, dashboard
    selectedItem: null,
    hovered: null,
    clientName: 'Client'
  };
  window.cbState = cbState;

  var GOLD = '#C8A96E';
  var DARK = '#1A1714';
  var CREAM = '#F5F0E8';
  var MUTED = '#A09882';
  var DIM = '#6B6456';
  /** Light client shell (board / dashboard / detail) — ivory, gold, ink */
  var PARCHMENT = '#FAF8F5';
  var IVORY = '#FFFCF8';
  var INK = '#1A1714';
  var INK_MUTED = '#5C534A';

  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function fmt$(n) { return '$' + (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

  /** Shown when hotlink/CDN blocks the image (Amazon, expired URL, etc.) */
  function cbPhotoPhBlock(title, vendor, compact) {
    var fs = compact ? '10px' : '15px';
    var gap = compact ? '4px' : '8px';
    var pad = compact ? '6px' : '16px';
    return '<div class="cb-photo-ph" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;text-align:center;padding:' + pad + ';background:linear-gradient(160deg,#3a332e,#1c1916);flex-direction:column;gap:' + gap + ';">' +
      '<div style="font-size:' + (compact ? '8px' : '10px') + ';color:#A09882;letter-spacing:0.08em;text-transform:uppercase;">Photo unavailable</div>' +
      '<div style="font-size:' + fs + ';font-weight:600;color:#EDE4D6;line-height:1.25;font-family:\'Playfair Display\',Georgia,serif;max-width:100%;">' + esc(title || 'Product') + '</div>' +
      (vendor ? '<div style="font-size:' + (compact ? '9px' : '11px') + ';color:#C8A96E;">' + esc(vendor) + '</div>' : '') +
    '</div>';
  }

  window.cbBoardImgErr = function(img) {
    try {
      img.onerror = null;
      img.style.display = 'none';
      var ph = img.parentElement && img.parentElement.querySelector('.cb-photo-ph');
      if (ph) {
        ph.style.display = 'flex';
        ph.style.flexDirection = 'column';
        ph.style.alignItems = 'center';
        ph.style.justifyContent = 'center';
      }
    } catch (e) {}
  };

  /** Safe img[src] from platform (falls back if helpers not loaded yet). */
  function imgSrcAttr(url) {
    var u = String(url == null ? '' : url).trim();
    if (typeof window._escImgSrcAttr === 'function') return window._escImgSrcAttr(u);
    return esc(u);
  }

  function firstGalleryUrl(el) {
    if (!el || !el.images) return '';
    var arr = el.images;
    for (var i = 0; i < arr.length; i++) {
      var g = arr[i];
      var s = typeof g === 'string' ? g : (g && (g.url || g.imageUrl || g.src || g.href));
      if (s && String(s).trim()) return String(s).trim();
    }
    return '';
  }

  /** Gallery hero picker + weak URL detection live on `window` (see index.html). */
  function pickClientBoardImageUrl(obj) {
    if (typeof window.cchPickPreferredProductImageUrl === 'function') {
      return String(window.cchPickPreferredProductImageUrl(obj) || '').trim();
    }
    return '';
  }

  // SVG Icons
  var starSvg = function(filled, size) {
    size = size || 18;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="' + (filled ? GOLD : 'none') + '" stroke="' + (filled ? GOLD : 'currentColor') + '" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
  };
  var commentSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';
  var chevronLeft = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 18l-6-6 6-6"/></svg>';
  var chevronRight = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18l6-6-6-6"/></svg>';

  /** Effective libraryProductId: design-board element, or linked project clip. */
  function cbItemLibraryProductId(it, clipById) {
    if (!it) return '';
    var lid = String(it.libraryProductId || '').trim();
    if (lid) return lid;
    if (it.clipId && clipById && clipById[it.clipId]) {
      var c = clipById[it.clipId];
      return String(c.libraryProductId || c.libraryId || '').trim();
    }
    return '';
  }

  /** libraryProductId on a design-board element or its linked clip. */
  function cbElementLibraryId(el, clipById) {
    if (!el) return '';
    var lid = String(el.libraryProductId || el.libraryId || '').trim();
    if (lid) return lid;
    var cid = el.clipId || el.clipID || el.clip_id;
    if (cid && clipById && clipById[cid]) {
      var c = clipById[cid];
      return String(c.libraryProductId || c.libraryId || '').trim();
    }
    return '';
  }

  async function cbFetchLibraryProductsMap(ids) {
    var libById = {};
    if (!ids || !ids.length || typeof db === 'undefined') return libById;
    await Promise.all(ids.map(function(id) {
      return db.collection('products').doc(id).get().then(function(snap) {
        if (snap.exists) libById[id] = Object.assign({ id: snap.id }, snap.data() || {});
      }).catch(function(err) {
        console.warn('[CCH ClientBoard] products get failed', { id: id, err: (err && err.message) || err });
      });
    }));
    return libById;
  }

  /** Clone elements and set imageUrl for canvas rendering (same library resolution as shoppable items). */
  function cbHydrateElementsForClientCanvas(elements, clipById, libById) {
    libById = libById || {};
    return (elements || []).map(function(raw) {
      var el = Object.assign({}, raw);
      var visual = el.type === 'product' || el.type === 'image' || el.img || el.imageUrl;
      if (!visual) return el;
      var merged = Object.assign({}, el);
      var cid = el.clipId || el.clipID || el.clip_id;
      if (cid && clipById && clipById[cid]) merged = Object.assign({}, clipById[cid], el);
      var lid = cbElementLibraryId(el, clipById);
      var imgOut = '';
      if (lid && libById[lid] && typeof window.getProductImg === 'function') {
        imgOut = String(window.getProductImg(libById[lid]) || '').trim();
      }
      if (!imgOut && typeof window.getProductImg === 'function') {
        imgOut = String(window.getProductImg(merged) || '').trim();
      }
      if (!imgOut) imgOut = String(merged.imageUrl || merged.img || '').trim();
      if (typeof window._resolveImgSrc === 'function') imgOut = window._resolveImgSrc(String(imgOut).trim());
      if (typeof window.cchBoardImageIsWeak === 'function' && imgOut && window.cchBoardImageIsWeak(imgOut)) imgOut = '';
      el.imageUrl = imgOut;
      return el;
    });
  }

  /** Full design board as laid out in the editor (read-only). */
  function cbRenderClientBoardCanvasSection(bd, resolvedElements) {
    bd = bd || {};
    var cw = bd.canvasWidth || 1400;
    var ch = bd.canvasHeight || 1000;
    var showPricing = bd.showPricing !== false;
    var html = '';
    var svgHtml = '<defs><marker id="cbClientArrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#333"/></marker></defs>';
    (resolvedElements || []).forEach(function(el) {
      if (!el) return;
      if (el.type === 'product') {
        var showPrice = showPricing && el.showPrice !== false;
        var imgU = String(el.imageUrl || '').trim();
        html += '<div style="position:absolute;left:' + (el.x || 0) + 'px;top:' + (el.y || 0) + 'px;width:' + (el.w || 180) + 'px;z-index:10;pointer-events:none;">' +
          (imgU ? '<img src="' + imgSrcAttr(imgU) + '" alt="" referrerpolicy="no-referrer" style="width:100%;height:' + (el.h || 180) + 'px;object-fit:cover;border-radius:4px;display:block;">'
            : '<div style="width:100%;height:' + (el.h || 180) + 'px;background:#E8E4DC;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#666;font-size:11px;">No image</div>') +
          '<div style="margin-top:4px;font-size:11px;font-weight:600;color:#1A1714;text-align:center;">' + esc(el.title || '') + '</div>' +
          (showPrice && el.sellPrice ? '<div style="font-size:10px;color:#2d5a3d;font-weight:600;text-align:center;">' + fmt$(el.sellPrice) + '</div>' : '') +
          (el.annotation ? '<div style="font-size:10px;color:#444;text-align:center;font-style:italic;margin-top:2px;white-space:pre-line;">' + esc(el.annotation) + '</div>' : '') +
          '</div>';
      } else if (el.type === 'image' || (!el.type && (el.img || el.imageUrl))) {
        var src = String(el.imageUrl || el.img || '').trim();
        html += '<div style="position:absolute;left:' + (el.x || 0) + 'px;top:' + (el.y || 0) + 'px;width:' + (el.w || 200) + 'px;height:' + (el.h || 200) + 'px;z-index:9;pointer-events:none;">' +
          (src ? '<img src="' + imgSrcAttr(src) + '" alt="" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;border-radius:4px;display:block;">' : '') +
          '</div>';
      } else if (el.type === 'text') {
        html += '<div style="position:absolute;left:' + (el.x || 0) + 'px;top:' + (el.y || 0) + 'px;max-width:300px;z-index:20;pointer-events:none;">' +
          '<div style="font-size:' + (el.fontSize || 13) + 'px;color:' + (el.color || '#333') + ';font-weight:' + (el.fontWeight || 'normal') + ';white-space:pre-wrap;">' + esc(el.text || 'Text') + '</div></div>';
      } else if (el.type === 'heading') {
        html += '<div style="position:absolute;left:' + (el.x || 0) + 'px;top:' + (el.y || 0) + 'px;z-index:20;pointer-events:none;">' +
          '<div style="font-size:' + (el.fontSize || 24) + 'px;color:' + (el.color || '#333') + ';font-weight:700;letter-spacing:2px;text-transform:uppercase;">' + esc(el.text || 'HEADING') + '</div></div>';
      } else if (el.type === 'note') {
        html += '<div style="position:absolute;left:' + (el.x || 0) + 'px;top:' + (el.y || 0) + 'px;width:' + (el.w || 200) + 'px;padding:10px 12px;background:#FFFDE7;border:1px solid #FFF9C4;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.08);z-index:15;pointer-events:none;">' +
          '<div style="font-size:12px;color:#666;white-space:pre-wrap;font-style:italic;">' + esc(el.text || '') + '</div></div>';
      } else if (el.type === 'arrow') {
        svgHtml += '<line x1="' + el.x1 + '" y1="' + el.y1 + '" x2="' + el.x2 + '" y2="' + el.y2 + '" stroke="' + (el.color || '#333') + '" stroke-width="' + (el.strokeWidth || 1.5) + '" marker-end="url(#cbClientArrowhead)" />';
        if (el.label) {
          var mx = (el.x1 + el.x2) / 2;
          var my = (el.y1 + el.y2) / 2;
          svgHtml += '<text x="' + mx + '" y="' + (my - 6) + '" text-anchor="middle" font-size="11" fill="#666">' + esc(el.label) + '</text>';
        }
      }
    });
    var brand = (bd.branding !== false) ? '<div style="position:absolute;bottom:20px;left:0;right:0;text-align:center;pointer-events:none;z-index:10;"><span style="font-family:Playfair Display,Georgia,serif;font-size:24px;font-weight:700;color:#C4A052;">CCH</span><div style="font-family:Cormorant Garamond,Georgia,serif;font-size:11px;letter-spacing:3px;color:#999;text-transform:uppercase;">Design Inc.</div></div>' : '';
    return '<div style="width:100%;overflow-x:auto;padding:0 8px 40px;background:#e8e4dc;">' +
      '<div style="position:relative;width:' + cw + 'px;height:' + ch + 'px;background:#fff;margin:16px auto;box-shadow:0 4px 24px rgba(0,0,0,0.15);overflow:hidden;">' +
      '<svg style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:500;">' + svgHtml + '</svg>' +
      '<div style="position:absolute;inset:0;">' + html + '</div>' + brand + '</div></div>';
  }

  /**
   * Hydrate shoppable item list from products. Pass libById from openClientBoard when library
   * IDs were collected from both items and canvas elements (single fetch).
   */
  async function cbHydrateItemsFromProductLibrary(items, clipById, libByIdPreloaded) {
    var itemCount = (items && items.length) || 0;
    if (!items || !items.length || typeof db === 'undefined') {
      console.info('[CCH ClientBoard] cbHydrateItemsFromProductLibrary skip', { reason: !items || !items.length ? 'no items' : 'no db', itemCount: itemCount });
      return;
    }
    var libById;
    var ids = [];
    var seen = {};
    if (arguments.length >= 3 && libByIdPreloaded !== undefined && libByIdPreloaded !== null) {
      libById = libByIdPreloaded;
      console.info('[CCH ClientBoard] cbHydrateItemsFromProductLibrary using pre-fetched map', { itemCount: itemCount, productDocsLoaded: Object.keys(libById).length });
    } else {
      libById = {};
      items.forEach(function(it) {
        var lid = cbItemLibraryProductId(it, clipById);
        if (lid && !seen[lid]) {
          seen[lid] = true;
          ids.push(lid);
        }
      });
      console.info('[CCH ClientBoard] cbHydrateItemsFromProductLibrary start', {
        itemCount: itemCount,
        distinctLibraryIds: ids.length,
        libraryIds: ids.slice()
      });
      if (!ids.length) {
        console.info('[CCH ClientBoard] cbHydrateItemsFromProductLibrary no library IDs — (a) no clipId+library on item/clip, or (b) clip not in clipById');
        return;
      }
      await Promise.all(ids.map(function(id) {
        return db.collection('products').doc(id).get().then(function(snap) {
          if (snap.exists) {
            libById[id] = Object.assign({ id: snap.id }, snap.data() || {});
          } else {
            console.warn('[CCH ClientBoard] products doc missing', { id: id });
          }
        }).catch(function(err) {
          console.warn('[CCH ClientBoard] products get failed', { id: id, err: (err && err.message) || err });
        });
      }));
      console.info('[CCH ClientBoard] cbHydrateItemsFromProductLibrary fetches', {
        attempted: ids.length,
        productDocsLoaded: Object.keys(libById).length
      });
    }
    var perItem = [];
    items.forEach(function(it) {
      var lid = cbItemLibraryProductId(it, clipById);
      var before = String(it.imageUrl || '').trim();
      if (!lid) {
        perItem.push({ itemId: it.id, title: it.title, clipId: it.clipId, libraryProductId: it.libraryProductId || '', lid: '', productExists: false, imageUrlBefore: before, imageUrlAfter: before, note: 'no libraryProductId on item or clip' });
        return;
      }
      var lp = libById[lid];
      if (!lp) {
        perItem.push({ itemId: it.id, title: it.title, clipId: it.clipId, libraryProductId: lid, lid: lid, productExists: false, imageUrlBefore: before, imageUrlAfter: before, note: 'product doc not found or fetch error' });
        return;
      }
      var libUrl = '';
      if (typeof window.getProductImg === 'function') {
        libUrl = String(window.getProductImg(lp) || '').trim();
      }
      if (!libUrl && typeof window.cchPickPreferredProductImageUrl === 'function') {
        libUrl = String(window.cchPickPreferredProductImageUrl(lp) || '').trim();
      }
      if (!libUrl) {
        perItem.push({ itemId: it.id, title: it.title, clipId: it.clipId, libraryProductId: lid, lid: lid, productExists: true, imageUrlBefore: before, imageUrlAfter: before, note: 'product has no resolvable image (getProductImg empty)' });
        return;
      }
      it.libraryProductId = lid;
      it.imageUrl = libUrl;
      if (typeof window.cchProposalLineImagesFromSource === 'function') {
        var packL = window.cchProposalLineImagesFromSource(lp);
        if (packL && packL.images && packL.images.length) it.images = packL.images;
        if (packL && packL.heroImageIndex != null) it.heroImageIndex = packL.heroImageIndex;
      }
      perItem.push({ itemId: it.id, title: it.title, clipId: it.clipId, libraryProductId: lid, lid: lid, productExists: true, imageUrlBefore: before, imageUrlAfter: libUrl, note: 'hydrated from library' });
    });
    console.info('[CCH ClientBoard] cbHydrateItemsFromProductLibrary per-item', perItem);
  }

  /** Merge clip photos into client items (uses preloaded clipById map). */
  function applyClipHydrationToItems(items, clipById) {
    if (!items || !items.length || !clipById) return;
    items.forEach(function(it) {
      if (!it || !it.clipId) return;
      var c = clipById[it.clipId];
      if (!c) return;
      var fromEl = String(it.imageUrl || '').trim();
      var fromClip = String(c.imageUrl || c.image || '').trim();
      var mergedImageUrl = fromEl || fromClip;
      if (typeof window.cchBoardImageIsWeak === 'function') {
        if (fromClip && !window.cchBoardImageIsWeak(fromClip)) mergedImageUrl = fromClip;
        else if (fromEl && !window.cchBoardImageIsWeak(fromEl)) mergedImageUrl = fromEl;
        else mergedImageUrl = fromClip || fromEl;
      }
      var merged = Object.assign({}, c, {
        imageUrl: mergedImageUrl,
        images: (it.images && it.images.length) ? it.images : c.images,
        img: it.img || c.img,
        heroImageIndex: it.heroImageIndex != null ? it.heroImageIndex : c.heroImageIndex
      });
      var best = pickClientBoardImageUrl(merged);
      if (!best && typeof window.getProductImg === 'function') {
        best = String(window.getProductImg(merged) || '').trim();
      }
      if (!best) return;
      var cur = typeof window._resolveImgSrc === 'function'
        ? window._resolveImgSrc(String(it.imageUrl || '').trim())
        : String(it.imageUrl || '').trim();
      if (String(cur).toLowerCase() === String(best).toLowerCase()) return;
      it.imageUrl = best;
      var pack2 = (typeof window.cchProposalLineImagesFromSource === 'function')
        ? window.cchProposalLineImagesFromSource(merged)
        : null;
      if (pack2 && pack2.images && pack2.images.length) it.images = pack2.images;
    });
  }

  // ==================== LOAD CLIENT BOARD ====================
  window.openClientBoard = async function(projectId, boardId) {
    cbState.projectId = projectId;
    cbState.boardId = boardId;
    cbState.view = 'welcome';
    cbState.stars = {};
    cbState.comments = {};
    cbState.selectedItem = null;
    cbState.filter = 'all';
    cbState.resolvedCanvasElements = null;

    var clipById = {};
    try {
      var loaded = await Promise.all([
        db.collection('boards').doc(projectId).collection('designBoards').doc(boardId).get(),
        db.collection('boards').doc(projectId).collection('clips').get().catch(function() { return null; })
      ]);
      var doc = loaded[0];
      var clipSnap = loaded[1];
      if (!doc.exists) throw new Error('Board not found');
      cbState.boardData = doc.data() || {};
      if (clipSnap && typeof clipSnap.forEach === 'function') {
        clipSnap.forEach(function(d) { clipById[d.id] = d.data() || {}; });
      }
    } catch(e) {
      document.getElementById('contentArea').innerHTML = '<div style="padding:60px;text-align:center;color:#999;">Board not found.</div>';
      return;
    }

    try {
      var _elsAll = cbState.boardData.elements || [];
      var _tileEls = _elsAll.filter(function(el) {
        if (!el) return false;
        if (el.type === 'product') return true;
        if (el.type === 'image' && (el.img || el.imageUrl)) return true;
        if (!el.type && (el.img || el.imageUrl)) return true;
        return false;
      });
      console.info('[CCH ClientBoard] Firestore designBoard tile elements', {
        projectId: projectId,
        boardId: boardId,
        boardTitle: (cbState.boardData.title || cbState.boardData.name || '').trim(),
        totalElements: _elsAll.length,
        tileCandidateCount: _tileEls.length,
        perElement: _tileEls.map(function(el, i) {
          var _cid = el.clipId || el.clipID || el.clip_id;
          var _cdata = _cid && clipById[_cid] ? clipById[_cid] : null;
          return {
            index: i,
            elId: el.id,
            type: el.type,
            clipId: _cid || '',
            elLibraryProductId: String(el.libraryProductId || '').trim(),
            elLibraryId: String(el.libraryId || '').trim(),
            clipLibraryProductId: _cdata ? String(_cdata.libraryProductId || _cdata.libraryId || '').trim() : '',
            elImageUrl: el.imageUrl,
            elImg: el.img,
            elImagesLen: el.images && el.images.length
          };
        })
      });
    } catch (_logE) {
      console.warn('[CCH ClientBoard] element log failed', _logE);
    }

    // Extract shoppable tiles: freeform editor uses type 'product'; grid editor uses type 'image' + img
    cbState.items = (cbState.boardData.elements || []).filter(function(el) {
      if (!el) return false;
      if (el.type === 'product') return true;
      if (el.type === 'image' && (el.img || el.imageUrl)) return true;
      if (!el.type && (el.img || el.imageUrl)) return true;
      return false;
    }).map(function(el, idx) {
      var pack = (typeof window.cchProposalLineImagesFromSource === 'function')
        ? window.cchProposalLineImagesFromSource(el)
        : { images: [], imageUrl: '', heroImageIndex: 0 };
      var resolved = pickClientBoardImageUrl(el);
      if (!resolved && typeof window.getProductImg === 'function') {
        resolved = String(window.getProductImg(el) || '').trim();
      }
      if (!resolved) {
        var raw = (pack.imageUrl || el.imageUrl || el.img || firstGalleryUrl(el) || '').trim();
        if (!raw && el.images && el.images.length && typeof el.images[0] === 'string') raw = el.images[0];
        resolved = typeof window._resolveImgSrc === 'function' ? window._resolveImgSrc(raw) : raw;
      }
      if (resolved && typeof window._resolveImgSrc === 'function') {
        resolved = window._resolveImgSrc(String(resolved).trim());
      }
      if (resolved && typeof window.cchBoardImageIsWeak === 'function' && window.cchBoardImageIsWeak(resolved)) {
        resolved = '';
        if (typeof window.getProductImg === 'function') {
          resolved = String(window.getProductImg(el) || '').trim();
        }
      }
      var sellNum = parseFloat(el.sellPrice);
      if (!isFinite(sellNum) || sellNum <= 0) sellNum = parseFloat(String(el.price || '').replace(/[^0-9.]/g, '')) || 0;
      var priceStr = sellNum ? fmt$(sellNum) : (el.price ? String(el.price).trim() : '');
      var cid = el.clipId || el.clipID || el.clip_id;
      var libPidEl = String(el.libraryProductId || el.libraryId || '').trim();
      var imgList = (pack.images && pack.images.length) ? pack.images : (resolved ? [resolved] : []);
      return {
        id: String(cid || el.id || ('item_' + idx)),
        clipId: cid ? String(cid) : '',
        libraryProductId: libPidEl,
        title: el.title || el.text || 'Untitled',
        vendor: el.vendor || '',
        price: priceStr,
        cost: el.cost || 0,
        sellPrice: sellNum,
        imageUrl: resolved,
        images: imgList,
        heroImageIndex: pack.heroImageIndex || 0,
        annotation: el.annotation || ''
      };
    });

    cbState.items.forEach(function(it) {
      if (it.clipId && clipById[it.clipId]) {
        var cx = clipById[it.clipId];
        if (!it.libraryProductId) {
          it.libraryProductId = String(cx.libraryProductId || cx.libraryId || '').trim();
        }
      }
    });

    var allLibIds = [];
    var seenLib = {};
    function addLibId(x) {
      x = String(x || '').trim();
      if (!x || seenLib[x]) return;
      seenLib[x] = true;
      allLibIds.push(x);
    }
    (cbState.items || []).forEach(function(it) { addLibId(cbItemLibraryProductId(it, clipById)); });
    (cbState.boardData.elements || []).forEach(function(el) { addLibId(cbElementLibraryId(el, clipById)); });
    var libById = await cbFetchLibraryProductsMap(allLibIds);

    applyClipHydrationToItems(cbState.items, clipById);
    await cbHydrateItemsFromProductLibrary(cbState.items, clipById, libById);
    cbState.resolvedCanvasElements = cbHydrateElementsForClientCanvas(cbState.boardData.elements || [], clipById, libById);

    // Load project info for client name
    try {
      var projDoc = await db.collection('projects').doc(projectId).get();
      var proj = projDoc.data();
      cbState.clientName = proj.clientName || proj.name || 'Client';
    } catch(e) {}

    // Load saved stars/comments from Firestore
    try {
      var interDoc = await db.collection('boards').doc(projectId).collection('designBoards').doc(boardId).collection('interactions').doc('data').get();
      if (interDoc.exists) {
        var d = interDoc.data();
        cbState.stars = d.stars || {};
        cbState.comments = d.comments || {};
      }
    } catch(e) {}

    renderClientBoard();

    // Auto-dismiss welcome after 3s
    setTimeout(function() {
      if (cbState.view === 'welcome') {
        cbState.view = 'board';
        renderClientBoard();
      }
    }, 3000);
  };

  window.cbEnterBoardFromWelcome = function() {
    cbState.view = 'board';
    renderClientBoard();
  };

  // ==================== SAVE INTERACTIONS ====================
  async function saveInteractions() {
    try {
      await db.collection('boards').doc(cbState.projectId).collection('designBoards').doc(cbState.boardId).collection('interactions').doc('data').set({
        stars: cbState.stars,
        comments: cbState.comments,
        updatedAt: new Date().toISOString()
      });
    } catch(e) { console.log('Save error:', e); }
  }

  function toggleStar(id, e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    cbState.stars[id] = !cbState.stars[id];
    saveInteractions();
    renderClientBoard();
  }

  function addComment(itemId) {
    var input = document.getElementById('cb-comment-input');
    var text = input ? input.value.trim() : '';
    if (!text) return;
    if (!cbState.comments[itemId]) cbState.comments[itemId] = [];
    cbState.comments[itemId].push({
      text: text,
      author: cbState.clientName,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    if (input) input.value = '';
    saveInteractions();
    renderClientBoard();
  }
  window._cbAddComment = addComment;

  // ==================== RENDER ====================
  function renderClientBoard() {
    var C = document.getElementById('contentArea');
    var bd = cbState.boardData;
    var boardTitle = (bd.title || bd.name || 'Design Board').trim() || 'Design Board';
    var boardRoom = bd.room || '';

    if (cbState.view === 'welcome') {
      C.innerHTML = renderWelcome(boardTitle);
      return;
    }
    // Dashboard (starring / selection workflow) is not offered on design boards — visuals only.
    if (cbState.view === 'dashboard') {
      cbState.view = 'board';
      cbState.selectedItem = null;
    }
    if (cbState.view === 'detail' && cbState.selectedItem) {
      C.innerHTML = renderDetail();
      return;
    }
    if (cbState.view === 'dashboard') {
      C.innerHTML = renderDashboard(boardTitle);
      return;
    }

    // Board view — full canvas (same layout as designer "Client View"), not a product tile grid
    var canvasEls = cbState.resolvedCanvasElements != null ? cbState.resolvedCanvasElements : (bd.elements || []);
    var canvasHtml = cbRenderClientBoardCanvasSection(bd, canvasEls);

    var btnLite = 'background:rgba(255,252,248,0.95);border:1px solid rgba(196,164,82,0.45);border-radius:2px;padding:10px 18px;color:' + INK_MUTED + ';cursor:pointer;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;font-family:\'Cormorant Garamond\',Georgia,serif;transition:background 0.2s,border-color 0.2s;';
    C.innerHTML =
      '<div id="cbClientBoardRoot" style="width:100%;min-height:100vh;background:' + PARCHMENT + ';font-family:\'Cormorant Garamond\',Garamond,Georgia,serif;color:' + INK_MUTED + ';">' +

        // Top bar — ivory + gold (aligned with welcome typography)
        '<div class="cb-client-board-topbar" style="padding:16px 28px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(196,164,82,0.28);position:sticky;top:0;background:' + IVORY + ';z-index:10;box-shadow:0 6px 32px rgba(26,23,20,0.06);">' +
          '<div style="display:flex;align-items:baseline;gap:10px;">' +
            '<span class="cb-client-brand-mark" style="font-family:Playfair Display,Georgia,serif;font-size:22px;font-weight:700;color:#C4A052;letter-spacing:0.12em;">CCH</span>' +
            '<span style="font-family:Cormorant Garamond,Georgia,serif;font-size:11px;letter-spacing:0.28em;color:' + INK_MUTED + ';text-transform:uppercase;font-weight:600;">Design Inc.</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end;">' +
            '<button type="button" onclick="closeCB()" style="' + btnLite + '">← Back to Project</button>' +
          '</div>' +
        '</div>' +

        // Hero — centered, gold caps + Playfair title (entry-page rhythm)
        '<div class="cb-client-board-hero" style="padding:44px 28px 32px;max-width:900px;margin:0 auto;text-align:center;">' +
          '<div class="cb-hero-kicker" style="font-size:10px;letter-spacing:0.38em;color:#C4A052;text-transform:uppercase;margin-bottom:18px;font-weight:600;">Prepared for ' + esc(cbState.clientName) + '</div>' +
          '<h1 style="font-size:clamp(34px,5vw,52px);font-weight:400;margin:0 0 8px;font-family:\'Playfair Display\',Georgia,serif;letter-spacing:0.02em;color:' + INK + ';line-height:1.15;">' + esc(boardTitle) + '</h1>' +
          (boardRoom ? '<div class="cb-hero-room" style="font-size:13px;color:#B8975C;letter-spacing:0.2em;text-transform:uppercase;margin-top:4px;font-weight:600;">' + esc(boardRoom) + '</div>' : '') +
          '<div style="width:56px;height:1px;background:linear-gradient(90deg,transparent,rgba(196,164,82,0.85),transparent);margin:22px auto 22px;"></div>' +
          '<p style="font-size:15px;color:' + INK_MUTED + ';max-width:520px;margin:0 auto;line-height:1.65;">This board is a visual presentation of the designer layout. Scroll horizontally on smaller screens to view the full canvas.</p>' +
        '</div>' +

        canvasHtml +

        // Footer
        '<div style="padding:36px 24px 48px;text-align:center;border-top:1px solid rgba(196,164,82,0.22);background:' + IVORY + ';">' +
          '<div style="font-size:18px;font-family:Playfair Display,Georgia,serif;font-weight:700;color:#C4A052;letter-spacing:0.1em;">CCH</div>' +
          '<div style="font-family:Cormorant Garamond,Georgia,serif;font-size:11px;letter-spacing:0.32em;color:' + INK_MUTED + ';text-transform:uppercase;margin-top:6px;font-weight:600;">Design Inc. · Est. 2004</div>' +
        '</div>' +
      '</div>';
  }

  // ==================== WELCOME SCREEN ====================
  function renderWelcome(boardTitle) {
    return '<div id="cbClientBoardRoot" class="cb-client-welcome" style="width:100%;height:100vh;display:flex;align-items:center;justify-content:center;background:' + DARK + ';font-family:\'Playfair Display\',Georgia,serif;cursor:pointer;" onclick="cbEnterBoardFromWelcome()">' +
      '<div style="text-align:center;animation:cbFadeIn 1s ease;">' +
        '<div style="font-size:11px;letter-spacing:6px;color:' + GOLD + ';margin-bottom:24px;text-transform:uppercase;font-family:\'Cormorant Garamond\',Garamond,Georgia,serif;">Curated for you by</div>' +
        '<div style="display:inline-flex;align-items:center;gap:2px;margin-bottom:4px;">' +
          '<span style="font-size:52px;font-weight:700;color:#C4A052;letter-spacing:3px;">CCH</span>' +
        '</div>' +
        '<div style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:14px;letter-spacing:5px;color:' + CREAM + ';text-transform:uppercase;">Design Inc.</div>' +
        '<div style="width:60px;height:1px;background:' + GOLD + ';margin:20px auto;opacity:0.6;"></div>' +
        '<div style="font-size:14px;color:' + MUTED + ';letter-spacing:3px;text-transform:uppercase;font-family:\'Cormorant Garamond\',Garamond,Georgia,serif;">' + esc(boardTitle) + '</div>' +
      '</div>' +
      '<style>@keyframes cbFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}</style>' +
    '</div>';
  }

  // ==================== DETAIL VIEW ====================
  function renderDetail() {
    var item = cbState.selectedItem;
    if (!item) return '';
    var itemComments = cbState.comments[item.id] || [];

    var btnGhost = 'background:transparent;border:1px solid rgba(196,164,82,0.45);border-radius:2px;padding:10px 16px;color:' + INK_MUTED + ';cursor:pointer;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-family:\'Cormorant Garamond\',Georgia,serif;';
    return '<div id="cbClientBoardRoot" style="width:100%;min-height:100vh;background:' + PARCHMENT + ';font-family:\'Cormorant Garamond\',Garamond,Georgia,serif;color:' + INK_MUTED + ';">' +
      '<div class="cb-client-board-topbar" style="display:flex;justify-content:space-between;align-items:center;padding:16px 28px;border-bottom:1px solid rgba(196,164,82,0.28);background:' + IVORY + ';box-shadow:0 6px 32px rgba(26,23,20,0.05);">' +
        '<button type="button" onclick="cbSetView(\'board\')" style="' + btnGhost + 'display:inline-flex;align-items:center;gap:8px;">' + chevronLeft + ' Back to Board</button>' +
        '<div style="display:flex;align-items:baseline;gap:8px;">' +
          '<span class="cb-client-brand-mark" style="font-family:Playfair Display,Georgia,serif;font-size:20px;font-weight:700;color:#C4A052;letter-spacing:0.1em;">CCH</span>' +
          '<span style="font-size:10px;letter-spacing:0.28em;color:' + INK_MUTED + ';text-transform:uppercase;font-weight:600;">Design Inc.</span>' +
        '</div>' +
      '</div>' +

      '<div style="display:flex;max-width:1200px;margin:0 auto;padding:40px 32px;gap:48px;flex-wrap:wrap;">' +
        // Image
        '<div style="flex:1 1 55%;min-width:300px;position:relative;">' +
          '<button onclick="cbNav(\'prev\')" style="position:absolute;left:-20px;top:50%;transform:translateY(-50%);background:rgba(26,23,20,0.8);border:1px solid rgba(200,169,110,0.2);border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:' + GOLD + ';z-index:3;">' + chevronLeft + '</button>' +
          '<div class="cb-photo-slot" style="position:relative;width:100%;min-height:240px;border-radius:4px;overflow:hidden;background:#2a2520;">' +
            '<img class="cb-board-photo" src="' + imgSrcAttr(item.imageUrl) + '" decoding="async" alt="" style="width:100%;border-radius:4px;display:block;min-height:240px;object-fit:contain;background:#2a2520;" onload="if(this.naturalWidth===0)cbBoardImgErr(this)" onerror="cbBoardImgErr(this)">' +
            cbPhotoPhBlock(item.title, item.vendor, false) +
          '</div>' +
          '<button onclick="cbNav(\'next\')" style="position:absolute;right:-20px;top:50%;transform:translateY(-50%);background:rgba(26,23,20,0.8);border:1px solid rgba(200,169,110,0.2);border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:' + GOLD + ';z-index:3;">' + chevronRight + '</button>' +
        '</div>' +

        // Info panel
        '<div style="flex:1 1 35%;min-width:280px;">' +
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;">' +
            '<div>' +
              '<h2 style="font-size:28px;font-weight:400;margin:0;line-height:1.3;font-family:\'Playfair Display\',Georgia,serif;color:' + INK + ';">' + esc(item.title) + '</h2>' +
              '<div style="font-size:12px;color:#B8975C;letter-spacing:0.2em;text-transform:uppercase;margin-top:10px;font-weight:600;">' + esc(item.vendor) + '</div>' +
              (item.price ? '<div style="font-size:18px;color:#8A7346;margin-top:8px;font-weight:600;">' + esc(item.price) + '</div>' : '') +
            '</div>' +
            '<div onclick="cbToggleStar(\'' + item.id + '\')" style="background:' + (cbState.stars[item.id] ? 'rgba(200,169,110,0.15)' : 'none') + ';border:1px solid rgba(200,169,110,0.3);border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:' + GOLD + ';flex-shrink:0;">' + starSvg(cbState.stars[item.id], 22) + '</div>' +
          '</div>' +

          (item.annotation ? '<div style="font-size:14px;color:' + MUTED + ';font-style:italic;margin-bottom:16px;line-height:1.6;">' + esc(item.annotation) + '</div>' : '') +

          '<div style="width:100%;height:1px;background:rgba(200,169,110,0.12);margin:24px 0;"></div>' +

          // Comments
          '<div>' +
            '<div style="font-size:11px;letter-spacing:3px;color:' + MUTED + ';text-transform:uppercase;margin-bottom:16px;">Comments ' + (itemComments.length > 0 ? '(' + itemComments.length + ')' : '') + '</div>' +

            (itemComments.length === 0 ? '<div style="font-size:14px;color:' + DIM + ';font-style:italic;margin-bottom:16px;">Share your thoughts on this piece...</div>' : '') +

            '<div style="max-height:200px;overflow-y:auto;margin-bottom:16px;">' +
            itemComments.map(function(c) {
              return '<div style="margin-bottom:16px;padding-left:16px;border-left:2px solid rgba(200,169,110,0.2);">' +
                '<div style="font-size:14px;color:' + CREAM + ';line-height:1.6;">' + esc(c.text) + '</div>' +
                '<div style="font-size:11px;color:' + DIM + ';margin-top:4px;">' + esc(c.author) + ' · ' + esc(c.time) + '</div>' +
              '</div>';
            }).join('') +
            '</div>' +

            '<div style="display:flex;gap:8px;">' +
              '<input id="cb-comment-input" placeholder="Add a comment..." onkeydown="if(event.key===\'Enter\')_cbAddComment(\'' + item.id + '\')" style="flex:1;padding:12px 16px;background:rgba(245,240,232,0.05);border:1px solid rgba(200,169,110,0.15);border-radius:4px;color:' + CREAM + ';font-size:14px;font-family:inherit;outline:none;">' +
              '<button onclick="_cbAddComment(\'' + item.id + '\')" style="padding:12px 20px;background:' + GOLD + ';border:none;border-radius:4px;color:' + DARK + ';font-size:12px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;font-family:inherit;font-weight:600;">Send</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ==================== DASHBOARD ====================
  function renderDashboard(boardTitle) {
    var starCount = Object.values(cbState.stars).filter(Boolean).length;
    var commentCount = Object.values(cbState.comments).reduce(function(a, c) { return a + c.length; }, 0);
    var starredItems = cbState.items.filter(function(i) { return cbState.stars[i.id]; });
    var engagement = cbState.items.length > 0 ? Math.round(((starCount + commentCount) / cbState.items.length) * 100) : 0;

    var btnDash = 'background:transparent;border:1px solid rgba(196,164,82,0.45);border-radius:2px;padding:10px 16px;color:' + INK_MUTED + ';cursor:pointer;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;font-family:\'Cormorant Garamond\',Georgia,serif;display:inline-flex;align-items:center;gap:8px;';
    return '<div id="cbClientBoardRoot" style="width:100%;min-height:100vh;background:' + PARCHMENT + ';font-family:\'Cormorant Garamond\',Garamond,Georgia,serif;color:' + INK_MUTED + ';">' +
      '<div class="cb-client-board-topbar" style="display:flex;justify-content:space-between;align-items:center;padding:16px 28px;border-bottom:1px solid rgba(196,164,82,0.28);background:' + IVORY + ';box-shadow:0 6px 32px rgba(26,23,20,0.05);">' +
        '<button type="button" onclick="cbSetView(\'board\')" style="' + btnDash + '">' + chevronLeft + ' Back to Board</button>' +
        '<div class="cb-client-brand-mark" style="font-size:10px;letter-spacing:0.32em;color:#C4A052;text-transform:uppercase;font-weight:700;">Designer Dashboard</div>' +
      '</div>' +

      '<div style="max-width:900px;margin:0 auto;padding:48px 32px;">' +
        '<h1 style="font-size:36px;font-weight:400;margin:0 0 10px;font-family:\'Playfair Display\',Georgia,serif;color:' + INK + ';letter-spacing:0.02em;">Client Activity</h1>' +
        '<div style="font-size:14px;color:' + DIM + ';margin-bottom:40px;letter-spacing:0.04em;">' + esc(cbState.clientName) + ' · ' + esc(boardTitle) + '</div>' +

        // Stats
        '<div style="display:flex;gap:24px;margin-bottom:48px;flex-wrap:wrap;">' +
          statCard(cbState.items.length, 'Items Presented') +
          statCard(starCount, 'Starred') +
          statCard(commentCount, 'Comments') +
          statCard(engagement + '%', 'Engagement') +
        '</div>' +

        // Starred items
        '<div style="margin-bottom:48px;">' +
          '<div style="font-size:10px;letter-spacing:0.28em;color:#C4A052;text-transform:uppercase;margin-bottom:20px;font-weight:700;">Starred Selections (' + starCount + ')</div>' +
          (starCount === 0 ?
            '<div style="padding:32px;text-align:center;color:' + DIM + ';font-style:italic;border:1px dashed rgba(196,164,82,0.35);border-radius:2px;background:' + IVORY + ';">No selections yet — client hasn\'t starred any items</div>'
          :
            '<div style="display:flex;flex-direction:column;gap:12px;">' +
            starredItems.map(function(item) {
              return '<div style="display:flex;align-items:center;gap:16px;padding:16px;background:' + IVORY + ';border-radius:2px;border:1px solid rgba(196,164,82,0.2);box-shadow:0 2px 12px rgba(26,23,20,0.04);">' +
                '<div class="cb-photo-slot" style="position:relative;width:56px;height:56px;flex-shrink:0;border-radius:3px;overflow:hidden;background:#2a2520;">' +
                '<img class="cb-board-photo" src="' + imgSrcAttr(item.imageUrl) + '" alt="" style="width:56px;height:56px;object-fit:cover;display:block;background:#2a2520;" onload="if(this.naturalWidth===0)cbBoardImgErr(this)" onerror="cbBoardImgErr(this)">' +
                cbPhotoPhBlock(item.title, item.vendor, true) +
                '</div>' +
                '<div style="flex:1;"><div style="font-size:16px;color:' + INK + ';font-family:\'Playfair Display\',Georgia,serif;">' + esc(item.title) + '</div><div style="font-size:12px;color:' + DIM + ';margin-top:4px;">' + esc(item.vendor) + (item.price ? ' · ' + esc(item.price) : '') + '</div></div>' +
                starSvg(true, 16) +
              '</div>';
            }).join('') +
            '</div>'
          ) +
        '</div>' +

        // Comment feed
        '<div>' +
          '<div style="font-size:10px;letter-spacing:0.28em;color:#C4A052;text-transform:uppercase;margin-bottom:20px;font-weight:700;">Comment Feed (' + commentCount + ')</div>' +
          (commentCount === 0 ?
            '<div style="padding:32px;text-align:center;color:' + DIM + ';font-style:italic;border:1px dashed rgba(196,164,82,0.35);border-radius:2px;background:' + IVORY + ';">No comments yet</div>'
          :
            '<div style="display:flex;flex-direction:column;gap:12px;">' +
            cbState.items.filter(function(item) { return (cbState.comments[item.id] || []).length > 0; }).map(function(item) {
              return (cbState.comments[item.id] || []).map(function(c) {
                return '<div style="display:flex;gap:16px;padding:16px;background:' + IVORY + ';border-radius:2px;border:1px solid rgba(196,164,82,0.18);">' +
                  '<div class="cb-photo-slot" style="position:relative;width:48px;height:48px;flex-shrink:0;border-radius:3px;overflow:hidden;background:#2a2520;">' +
                  '<img class="cb-board-photo" src="' + imgSrcAttr(item.imageUrl) + '" alt="" style="width:48px;height:48px;object-fit:cover;display:block;background:#2a2520;" onload="if(this.naturalWidth===0)cbBoardImgErr(this)" onerror="cbBoardImgErr(this)">' +
                  cbPhotoPhBlock(item.title, '', true) +
                  '</div>' +
                  '<div><div style="font-size:14px;line-height:1.6;margin-bottom:4px;">"' + esc(c.text) + '"</div><div style="font-size:11px;color:' + DIM + ';">on <span style="color:' + MUTED + ';">' + esc(item.title) + '</span> · ' + esc(c.author) + ' · ' + esc(c.time) + '</div></div>' +
                '</div>';
              }).join('');
            }).join('') +
            '</div>'
          ) +
        '</div>' +

        // Quick action: create proposal from starred
        (starCount > 0 ?
          '<div style="margin-top:48px;padding:28px;background:linear-gradient(180deg,' + IVORY + ',rgba(250,248,245,0.95));border-radius:2px;border:1px solid rgba(196,164,82,0.28);text-align:center;box-shadow:0 8px 32px rgba(26,23,20,0.06);">' +
            '<div style="font-size:14px;color:' + INK_MUTED + ';margin-bottom:14px;line-height:1.5;">' + starCount + ' starred items totaling <strong style="color:#8A7346;">' + fmt$(starredItems.reduce(function(s, i) { return s + (i.sellPrice || 0); }, 0)) + '</strong></div>' +
            '<button type="button" onclick="cbCreateProposal()" style="background:#C4A052;border:none;border-radius:2px;padding:14px 32px;color:' + INK + ';font-size:12px;letter-spacing:0.18em;text-transform:uppercase;cursor:pointer;font-family:\'Cormorant Garamond\',Georgia,serif;font-weight:700;">Create Proposal from Selections</button>' +
          '</div>'
        : '') +
      '</div>' +
    '</div>';
  }

  function statCard(value, label) {
    return '<div style="flex:1 1 180px;padding:24px;background:' + IVORY + ';border:1px solid rgba(196,164,82,0.22);border-radius:2px;box-shadow:0 4px 20px rgba(26,23,20,0.04);">' +
      '<div style="font-size:36px;color:#C4A052;font-family:\'Playfair Display\',Georgia,serif;font-weight:400;">' + value + '</div>' +
      '<div style="font-size:10px;letter-spacing:0.22em;color:' + INK_MUTED + ';text-transform:uppercase;margin-top:8px;font-weight:600;">' + label + '</div>' +
    '</div>';
  }

  // ==================== GLOBAL HANDLERS ====================
  window.cbSetView = function(v) { cbState.view = v; cbState.selectedItem = null; renderClientBoard(); };

  window.cbToggleStar = function(id) { toggleStar(id); };

  window.cbOpenDetail = function(id) {
    cbState.selectedItem = cbState.items.find(function(i) { return i.id === id; });
    cbState.view = 'detail';
    renderClientBoard();
  };

  window.cbNav = function(dir) {
    if (!cbState.selectedItem) return;
    var idx = cbState.items.findIndex(function(i) { return i.id === cbState.selectedItem.id; });
    var next = dir === 'next' ? (idx + 1) % cbState.items.length : (idx - 1 + cbState.items.length) % cbState.items.length;
    cbState.selectedItem = cbState.items[next];
    renderClientBoard();
  };

  window.closeCB = function() {
    // Go back to the project's design boards tab
    navigate('#/project/' + cbState.projectId + '/designboards');
  };

  window.cbCreateProposal = async function() {
    var starredItems = cbState.items.filter(function(i) { return cbState.stars[i.id]; });
    if (starredItems.length === 0) return;

    var name = prompt('Proposal name:', (cbState.boardData.title || 'Board') + ' — Client Selections');
    if (!name) return;

    var items = starredItems.map(function(item) {
      var pack = (typeof window.cchProposalLineImagesFromSource === 'function')
        ? window.cchProposalLineImagesFromSource(item)
        : { images: item.imageUrl ? [item.imageUrl] : [], imageUrl: item.imageUrl || '', heroImageIndex: 0 };
      var hero = (typeof window.cchPickPreferredProductImageUrl === 'function')
        ? String(window.cchPickPreferredProductImageUrl(item) || '').trim()
        : '';
      if (!hero) hero = pack.imageUrl || item.imageUrl || '';
      return {
        title: item.title,
        vendor: item.vendor,
        cost: item.cost || 0,
        sellingPrice: item.sellPrice || 0,
        clientPrice: item.sellPrice || 0,
        qty: 1,
        imageUrl: hero,
        images: pack.images || [],
        heroImageIndex: pack.heroImageIndex || 0,
        clipId: item.id || '',
        lineApprovalStatus: 'pending'
      };
    });

    var total = items.reduce(function(s, i) { return s + (i.clientPrice || 0); }, 0);

    try {
      var doc = await db.collection('boards').doc(cbState.projectId).collection('proposals').add({
        name: name,
        items: items,
        total: total,
        status: 'Draft',
        designBoardId: cbState.boardId,
        source: 'client-selections',
        createdAt: new Date().toISOString()
      });
      alert('Proposal created with ' + items.length + ' starred items (' + fmt$(total) + ')');
      navigate('#/project/' + cbState.projectId + '/proposal/' + doc.id);
    } catch(e) {
      alert('Error: ' + e.message);
    }
  };

})();
