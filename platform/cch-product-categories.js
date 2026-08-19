/**
 * Master product categories — keep in sync with cch-product-categories.json (Clipper fetch).
 * Room = physical space; category = FFE type. Order is intentional (studio standard list).
 */
(function (global) {
  'use strict';
  var MASTER = [
    'Art',
    'Mirror',
    'Accessories',
    'Fabric & Trim',
    'Furniture',
    'Stone & Tile',
    'Appliances & Plumbing',
    'Cabinet Hardware',
    'Window Hardware',
    'Floor Covering',
    'Florals',
    'Wall',
    'Bedding & Pillows',
    'Wall Covering',
    'Custom Furniture',
    'Custom Upholstery',
    'Cabinets',
    'Custom Bedding and Pillows',
    'Custom Window Coverings',
    'Windows',
    'Lighting',
    'Architectural'
  ];

  /** Houzz tracker / legacy labels → canonical (trim applied first). */
  var CATEGORY_REMAP = {
    'Fabric  + Trim': 'Fabric & Trim',
    'Fabric + Trim': 'Fabric & Trim',
    'Fabric': 'Fabric & Trim',
    'Fabri': 'Fabric & Trim',
    'Furniture & Fixtures': 'Furniture',
    'Furnishings': 'Furniture',
    'Furniture & Upholstery': 'Furniture',
    'LIGHTING': 'Lighting',
    'lighting': 'Lighting',
    'Mirrors & Accessories': 'Accessories',
    'mirror': 'Mirror',
    'Floor Covering': 'Flooring',
    'floor': 'Flooring',
    'Stone & Tile': 'Tile & Stone',
    'Wall': 'Wall Covering',
    'Window': 'Windows',
    'Appliances  & Plumbing': 'Plumbing & Appliances',
    'Kitchen and Bath': 'Plumbing & Appliances',
    'Cushions': 'Bedding & Pillows',
    'Architecural': 'Architectural',
    'Florals': 'Accessories',
    'Hardware': 'Cabinet Hardware',
    'Cabinet Hardware': 'Cabinet Hardware',
    'Window Hardware': 'Window Hardware',
    'Cabinet hardware': 'Cabinet Hardware',
    'Window hardware': 'Window Hardware'
  };

  /** Legacy combined / billing labels — never offer in FFE category pickers. */
  var DEPRECATED_FFE_EXTRA = new Set([
    'materials / cogs', 'materials', 'cogs', 'cog',
    'furniture & fixtures', 'furnishings',
    'mirrors & accessories', 'mirrors and accessories'
  ]);

  global.CCH_PRODUCT_CATEGORIES_MASTER = MASTER.slice();

  /** Product Library / picker UIs — canonical FFE list only (no rooms, no Firestore pollution). */
  global.cchStrictFfeCategoryPickerList = function () {
    return MASTER.filter(function (c) {
      if (global.cchIsNonProductFfeCategory(c)) return false;
      if (global.cchStringLooksLikePhysicalRoom(c)) return false;
      return true;
    });
  };

  /** Comma-joined multi-category strings (e.g. "Lighting,Bedding & Pillows") are invalid — never store or offer. */
  global.cchCategoryIsCommaMulti = function (raw) {
    var s = String(raw || '').trim();
    if (!s || s.indexOf(',') < 0) return false;
    return s.split(',').map(function (p) { return p.trim(); }).filter(Boolean).length >= 2;
  };

  /** Comma-multi or two master labels jammed together (e.g. "LightingBedding & Pillows" on invoice lines). */
  global.cchCategoryIsInvalidStoredValue = function (raw) {
    var s = String(raw || '').trim();
    if (!s) return false;
    if (global.cchCategoryIsCommaMulti(s)) return true;
    var compact = s.replace(/\s+/g, '');
    for (var i = 0; i < MASTER.length; i++) {
      var a = MASTER[i];
      if (a.length < 5) continue;
      var ac = a.replace(/\s+/g, '');
      if (compact.indexOf(ac) !== 0) continue;
      var tail = compact.slice(ac.length);
      if (!tail) continue;
      for (var j = 0; j < MASTER.length; j++) {
        if (i === j) continue;
        var bc = MASTER[j].replace(/\s+/g, '');
        if (tail.indexOf(bc) === 0) return true;
      }
    }
    return false;
  };

  function _normalizeSingleCategorySegment(raw) {
    var s = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!s) return '';
    if (CATEGORY_REMAP[s]) return CATEGORY_REMAP[s];
    var sl = s.toLowerCase();
    var keys = Object.keys(CATEGORY_REMAP);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].toLowerCase() === sl) return CATEGORY_REMAP[keys[i]];
    }
    return s;
  }

  function _titleImpliesLighting(title) {
    var t = String(title || '').toLowerCase();
    if (!t) return false;
    return /\b(chandelier|sconce|sconces|\bscon\b|pendant|pendants|flush\s*mount|semi[\s-]*flush|island\s*light|table\s*lamp|floor\s*lamp|desk\s*lamp|wall\s*lamp|\blamp\b|monorail|linear\s*suspension|ceiling\s*light|ceiling\s*fixture|wall\s*light|vanity\s*light|track\s*light|cove\s*light|under\s*cabinet\s*light|torchiere|luminaire|light\s*fixture|lighting)\b/i.test(t);
  }

  /** Split banned comma-multi values to one canonical category (optional title hint for tie-break). */
  global.cchResolveSingleProductCategory = function (raw, titleHint) {
    var s = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!s) return '';
    if (!global.cchCategoryIsCommaMulti(s)) return _normalizeSingleCategorySegment(s);
    var parts = s.split(',').map(function (p) { return p.trim(); }).filter(Boolean);
    if (_titleImpliesLighting(titleHint)) {
      for (var i = 0; i < parts.length; i++) {
        if (_normalizeSingleCategorySegment(parts[i]) === 'Lighting') return 'Lighting';
      }
    }
    for (var j = 0; j < parts.length; j++) {
      var c = _normalizeSingleCategorySegment(parts[j]);
      if (c && !global.cchCategoryIsCommaMulti(c)) return c;
    }
    return _normalizeSingleCategorySegment(parts[0] || '');
  };

  global.cchNormalizeProductCategory = function (raw, titleHint) {
    var s = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!s) return '';
    if (global.cchCategoryIsCommaMulti(s)) {
      return global.cchResolveSingleProductCategory(s, titleHint);
    }
    return _normalizeSingleCategorySegment(s);
  };

  /** User picked from doc-edit dropdown — keep exact master label; only remap legacy free text. */
  global.cchSaveUserCategoryChoice = function (raw) {
    var s = String(raw || '').trim().replace(/\s+/g, ' ');
    if (!s) return '';
    if (global.cchCategoryIsCommaMulti(s)) return '';
    if (global.cchCategoryIsInvalidStoredValue(s)) return '';
    if (global.cchStringLooksLikePhysicalRoom(s)) return '';
    if (MASTER.indexOf(s) >= 0) return s;
    return _normalizeSingleCategorySegment(s);
  };

  /** Non-empty, non-comma-multi category — do not auto-overwrite on save/sync/clip/library paths. */
  global.cchCategoryIsProtected = function (raw) {
    var s = String(raw || '').trim();
    if (!s) return false;
    if (global.cchCategoryIsCommaMulti(s)) return false;
    if (global.cchCategoryIsInvalidStoredValue(s)) return false;
    return true;
  };

  /** Explicit user UI write (dropdown, product modal, selections inline edit). */
  global.cchMergeExplicitCategoryWrite = function (existingRaw, proposedRaw) {
    return global.cchSaveUserCategoryChoice(proposedRaw);
  };

  /**
   * Auto/sync paths only — returns undefined when category must not be written.
   * Never overwrites a protected existing value; never auto-fills empty.
   */
  global.cchCategoryForAutoWrite = function (existingRaw, proposedRaw) {
    if (global.cchCategoryIsProtected(existingRaw)) return undefined;
    var prop = String(proposedRaw || '').trim();
    if (!prop || global.cchCategoryIsCommaMulti(prop)) return undefined;
    return prop;
  };

  /** Strip category from Firestore patch unless caller set _cchExplicitCategoryWrite. Mutates patch. */
  global.cchStripAutoCategoryFromPatch = function (patch, existingRaw) {
    if (!patch || patch.category === undefined) return patch;
    if (patch._cchExplicitCategoryWrite) {
      delete patch._cchExplicitCategoryWrite;
      patch.category = global.cchMergeExplicitCategoryWrite(existingRaw, patch.category);
      if (!String(patch.category || '').trim()) patch.category = null;
      return patch;
    }
    if (global.cchCategoryIsProtected(existingRaw)) {
      delete patch.category;
      return patch;
    }
    var autoVal = global.cchCategoryForAutoWrite(existingRaw, patch.category);
    if (autoVal === undefined) delete patch.category;
    else patch.category = autoVal;
    return patch;
  };

  /** Strip category from Firestore update unless caller set _cchExplicitCategoryWrite. */
  global.cchStripAutoCategoryFromUpdate = function (update, existingCategory) {
    if (!update || typeof update !== 'object') return update;
    if (update._cchExplicitCategoryWrite) {
      delete update._cchExplicitCategoryWrite;
      if (update.category !== undefined) {
        update.category = global.cchMergeExplicitCategoryWrite(existingCategory, update.category) || null;
      }
      return update;
    }
    if (update.category !== undefined) {
      var guarded = global.cchCategoryForAutoWrite(existingCategory, update.category);
      if (guarded === undefined) delete update.category;
      else update.category = guarded;
    }
    return update;
  };

  /**
   * Existing products/ or productLibrary/ row — drop category from payload unless user
   * explicitly edited the Category field in the library modal (_prodCategoryUserEdited).
   */
  global.cchOmitLibraryCategoryUnlessExplicit = function (payload, existingCategory, explicitUserEdit) {
    if (!payload || typeof payload !== 'object') return payload;
    if (explicitUserEdit || payload._cchExplicitCategoryWrite) {
      delete payload._cchExplicitCategoryWrite;
      if (payload.category !== undefined) {
        payload.category = global.cchMergeExplicitCategoryWrite(existingCategory, payload.category) || null;
      }
      return payload;
    }
    if (payload.category !== undefined) delete payload.category;
    return payload;
  };

  /** Section headers, billing types, and mistakes — not FFE product categories (use Room or billing flows instead). */
  var NOT_FFE_CATEGORY_LABEL = new Set([
    'rooms', 'room boards', 'room board', 'spaces', 'space',
    'by room', 'by category', 'all rooms',
    'labor', 'labour', 'expense', 'expenses', 'services', 'service',
    'cch design service', 'cch design services', 'cch project management',
    'custom labor', 'design services', 'design service', 'blended design services', 'consultation',
    'designer fee', 'designer fees', 'design fee', 'design fees', 'blended design fees',
    'installation charges', 'installation', 'install', 'freight', 'freight charges', 'freight charge',
    'postage & printing', 'transaction fees', 'pass-through', 'pass through',
    'time billing', 'time track', 'time tracking', 'hourly', 'retainer',
    'cch admin', 'shipping', 'handling', 'sales tax', 'discount', 'other expense',
    'professional services', 'project management', 'design fee - rates are already set in smart time',
    'uncategorized', 'etails', 'details', 'etail', 'retail', 'fee', 'fees', 'taxes',
    'materials / cogs', 'materials', 'cogs', 'cog',
    'furniture & fixtures', 'furnishings',
    'mirrors & accessories', 'mirrors and accessories'
  ]);

  /** Billing / service labels — never show in Product Library or Selections category pickers. */
  global.cchIsNonProductFfeCategory = function (label) {
    var s = String(label || '').trim();
    if (!s) return true;
    return NOT_FFE_CATEGORY_LABEL.has(s.toLowerCase());
  };

  /** Houzz / legacy junk — never surface as a picker option even if stored on old clips. */
  global.cchIsDeprecatedFfeCategoryExtra = function (label) {
    var s = String(label || '').trim().toLowerCase();
    if (!s) return false;
    return DEPRECATED_FFE_EXTRA.has(s);
  };

  /** Filter junk / duplicates from a category list; master order first, then valid extras. */
  global.cchSanitizeFfeCategoryPickerList = function (list) {
    var seen = new Set();
    var out = [];
    (list || []).forEach(function (raw) {
      if (!raw) return;
      if (global.cchIsDeprecatedFfeCategoryExtra(raw)) return;
      if (global.cchIsNonProductFfeCategory(raw)) return;
      var norm = global.cchNormalizeProductCategory(raw);
      if (!norm || global.cchIsDeprecatedFfeCategoryExtra(norm) || global.cchIsNonProductFfeCategory(norm)) return;
      var key = norm.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(norm);
    });
    var masterPart = MASTER.filter(function (m) { return seen.has(m.toLowerCase()); });
    var extraPart = out.filter(function (c) {
      return MASTER.map(function (m) { return m.toLowerCase(); }).indexOf(c.toLowerCase()) < 0;
    }).sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
    return masterPart.length ? masterPart.concat(extraPart) : MASTER.slice();
  };

  /** Room / space labels must not appear in FFE category pickers (e.g. "Master Bedroom" in category field). */
  global.cchStringLooksLikePhysicalRoom = function (s) {
    var t = String(s || '').trim();
    if (!t) return false;
    var tl = t.toLowerCase();
    if (MASTER.some(function (m) { return tl === String(m).toLowerCase(); })) return false;
    var roomRe = /(\b(bedroom|bathroom|bath|kitchen|closet|pantry|laundry|mudroom|garage|office|den|nursery|suite|foyer|entry|lobby|walk-?in|powder|living|dining|game\s*room|butler|master|guest|upstairs|downstairs|hallway|hall\b|\bL\d\b|second\s+floor|first\s+floor|basement|attic|porch|patio|deck))/i;
    if (roomRe.test(t)) return true;
    if (/'s\s|\u2019s\s/.test(t) && /(closet|room|bedroom|bathroom|office|suite|nook)/i.test(t)) return true;
    if (/\s-\s/.test(t) && /(guest|bedroom|bath|master|office)/i.test(t)) return true;
    return false;
  };

  /**
   * Master order first; then board-only custom categories (sorted).
   * @param {string[]} boardCategories - extras from Firestore `categories` or clip-derived strings
   * @param {string[]} [boardRooms] - project `rooms`; same string must not appear as a category option
   */
  global.cchAllProductCategories = function (boardCategories, boardRooms) {
    var masterSet = new Set(MASTER);
    var masterLc = new Set(MASTER.map(function (m) { return String(m).toLowerCase(); }));
    var roomSet = new Set();
    if (boardRooms && boardRooms.length) {
      boardRooms.forEach(function (r) {
        if (r == null || r === '') return;
        roomSet.add(String(r).trim().toLowerCase());
      });
    }
    var extras = [];
    var extrasLc = new Set();
    if (boardCategories && boardCategories.length) {
      boardCategories.forEach(function (x) {
        if (!x) return;
        var s = String(x).trim();
        if (!s) return;
        if (global.cchCategoryIsCommaMulti(s)) return;
        if (global.cchStringLooksLikePhysicalRoom(s)) return;
        if (global.cchIsDeprecatedFfeCategoryExtra(s)) return;
        var sl = s.toLowerCase();
        if (roomSet.has(sl)) return;
        if (NOT_FFE_CATEGORY_LABEL.has(sl)) return;
        var normalized = global.cchNormalizeProductCategory(s);
        if (!normalized) return;
        if (global.cchIsDeprecatedFfeCategoryExtra(normalized)) return;
        if (global.cchIsNonProductFfeCategory(normalized)) return;
        var nl = normalized.toLowerCase();
        if (roomSet.has(nl)) return;
        if (NOT_FFE_CATEGORY_LABEL.has(nl)) return;
        if (masterSet.has(normalized) || masterLc.has(nl)) return;
        if (extrasLc.has(nl)) return;
        extrasLc.add(nl);
        extras.push(normalized);
      });
    }
    extras = Array.from(new Set(extras)).sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
    return MASTER.concat(extras);
  };

  /** Normalized FFE category from a clip, library row, or doc line source — never returns comma-multi or room names. */
  global.cchLineCategoryFromSource = function (source, titleHint) {
    source = source || {};
    var raw = String(source.category || source.qbCategory || '').trim();
    if (!raw) return '';
    if (typeof global.cchNormalizeProductCategory === 'function') {
      return global.cchNormalizeProductCategory(raw, titleHint || source.title || source.name || '');
    }
    return raw;
  };

  /** Fill-empty-only: copy normalized category from source onto a doc line when line category is blank. */
  global.cchFillLineCategoryFromSource = function (line, source) {
    line = line || {};
    source = source || {};
    var proposed = global.cchLineCategoryFromSource(source, line.title || source.title || source.name || '');
    if (!proposed) return line;
    if (typeof global.cchCategoryForAutoWrite === 'function') {
      var filled = global.cchCategoryForAutoWrite(line.category, proposed);
      if (filled !== undefined) line.category = filled;
    } else if (!String(line.category || '').trim()) {
      line.category = proposed;
    }
    return line;
  };
})(typeof window !== 'undefined' ? window : this);
