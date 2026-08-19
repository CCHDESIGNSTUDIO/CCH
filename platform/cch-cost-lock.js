/**
 * Trade cost lock + explicit bulk "update all unlocked linked items".
 * No automatic doc↔library sync — preview modal + user confirm only.
 */
(function(global) {
  'use strict';

  function esc(s) {
    return typeof global.esc === 'function' ? global.esc(s) : String(s == null ? '' : s);
  }
  function escAttr(s) {
    return typeof global.escAttr === 'function' ? global.escAttr(s) : esc(s);
  }

  function cchParseTradeCost(v) {
    if (v === '' || v == null) return null;
    var n = parseFloat(v);
    if (isNaN(n) || n < 0) return null;
    return Math.round(n * 100) / 100;
  }

  function cchCostCents(v) {
    var n = cchParseTradeCost(v);
    return n == null ? null : Math.round(n * 100);
  }

  function cchCostsMatch(a, b) {
    return cchCostCents(a) === cchCostCents(b);
  }

  function cchLineTradeCost(line) {
    line = line || {};
    return cchParseTradeCost(line.cost != null ? line.cost : (line.unitCost != null ? line.unitCost : line.costPrice));
  }

  function cchClipTradeCost(clip) {
    clip = clip || {};
    return cchParseTradeCost(clip.cost != null ? clip.cost : (clip.unitCost != null ? clip.unitCost : clip.costPrice));
  }

  /** Why a doc line trade cost cannot be bulk-updated (null = eligible). */
  function cchDocLineCostLockReason(line, collection, docData, projectId) {
    line = line || {};
    docData = docData || {};
    if (line._costLocked === true) return 'Cost locked on this line';
    if (line._costManual === true) return 'Cost manually set on this line';
    if (global.cchProjectFinancialsAreFrozen && projectId && global.cchProjectFinancialsAreFrozen(projectId)) {
      return 'Project financials frozen (completed/archived)';
    }
    collection = String(collection || '').trim();
    if (collection === 'proposals' && typeof global.proposalDesignerLineEditLocked === 'function') {
      var pl = global.proposalDesignerLineEditLocked(docData);
      if (pl && pl.locked) return pl.why || 'Proposal locked';
    }
    if (collection === 'invoices') {
      var st = String(docData.status || '').trim().toLowerCase();
      if (st === 'sent' || st === 'paid' || st === 'overdue') return 'Invoice ' + st;
      if (docData.qbDocId || docData.qbSynced) return 'Synced to QuickBooks';
    }
    if (collection === 'purchaseOrders') {
      if (typeof global.cchPoIsLocked === 'function' && global.cchPoIsLocked(docData)) return 'PO sent or locked';
      var poSt = String(docData.status || docData.poStatus || '').trim().toLowerCase();
      if (poSt === 'sent' || poSt === 'paid' || poSt === 'closed') return 'PO ' + poSt;
    }
    return null;
  }

  function cchClipCostLockReason(clip, projectId) {
    clip = clip || {};
    if (clip._costLocked === true) return 'Cost locked on clip';
    if (clip._costManual === true) return 'Cost manually set on clip';
    if (global.cchProjectFinancialsAreFrozen && projectId && global.cchProjectFinancialsAreFrozen(projectId)) {
      return 'Project financials frozen';
    }
    return null;
  }

  function cchLibraryCostLockReason(product) {
    product = product || {};
    if (product._costLocked === true) return 'Cost locked on library row';
    if (typeof global.cchIsClipperMasterProduct === 'function' && global.cchIsClipperMasterProduct(product)) {
      return 'Clipper master row — confirm before changing catalog cost';
    }
    return null;
  }

  function collectionFromKind(kind) {
    if (kind === 'proposal') return 'proposals';
    if (kind === 'invoice') return 'invoices';
    if (kind === 'po') return 'purchaseOrders';
    return '';
  }

  function targetLabel(t) {
    t = t || {};
    if (t.type === 'library') return 'Library — ' + esc(t.title || t.id);
    if (t.type === 'clip') return 'Clip — ' + esc(t.title || t.id) + (t.projectName ? ' (' + esc(t.projectName) + ')' : '');
    if (t.type === 'line') {
      var num = t.docNum || t.docId || '';
      var kind = t.collection === 'proposals' ? 'PRO' : (t.collection === 'invoices' ? 'INV' : 'PO');
      return kind + ' ' + esc(num) + ' line ' + ((t.lineIndex || 0) + 1) + ' — ' + esc(t.title || '');
    }
    return esc(t.id || 'item');
  }

  async function cchLoadLibraryProduct(libId) {
    libId = String(libId || '').trim();
    if (!libId) return null;
    var db = global.db || (global.firebase && global.firebase.firestore());
    if (!db) return null;
    var snap = await db.collection('products').doc(libId).get();
    if (!snap.exists) snap = await db.collection('productLibrary').doc(libId).get();
    if (!snap.exists) return null;
    return { id: snap.id, data: snap.data() || {} };
  }

  function cchNormTitleVendor(title, vendor) {
    return String(title || '').trim().toLowerCase() + '|' + String(vendor || '').trim().toLowerCase();
  }

  function cchLibraryVendor(row) {
    row = row || {};
    return String(row.vendor || row.manufacturer || '').trim();
  }

  async function cchFindSiblingLibraryRows(prod, libId) {
    var out = [];
    var data = (prod && prod.data) || {};
    var title = String(data.title || '').trim();
    var vendor = cchLibraryVendor(data);
    var tv = cchNormTitleVendor(title, vendor);
    var titleOnly = String(title || '').trim().toLowerCase();
    var houzzId = String(data.houzzId || data.houzzProductId || '').trim();
    if (!title) return out;

    function titlesMatch(a, b) {
      var ta = String(a || '').trim().toLowerCase();
      var tb = String(b || '').trim().toLowerCase();
      return !!ta && ta === tb;
    }
    function vendorsCompatible(a, b) {
      var va = String(a || '').trim().toLowerCase();
      var vb = String(b || '').trim().toLowerCase();
      if (!va || !vb) return true; // empty vendor on either side still matches same title
      return va === vb;
    }

    function consider(id, row) {
      if (!id || id === libId) return;
      row = row || {};
      var rowVend = cchLibraryVendor(row);
      if (houzzId && String(row.houzzId || row.houzzProductId || '').trim() === houzzId) {
        if (!out.some(function(x) { return x.id === id; })) out.push({ id: id, data: row });
        return;
      }
      // Same title + compatible vendor (vendor OR manufacturer — Houzz rows often only have manufacturer)
      if (titlesMatch(row.title, title) && vendorsCompatible(rowVend, vendor)) {
        if (!out.some(function(x) { return x.id === id; })) out.push({ id: id, data: row });
        return;
      }
      if (tv !== '|' && cchNormTitleVendor(row.title, rowVend) === tv) {
        if (!out.some(function(x) { return x.id === id; })) out.push({ id: id, data: row });
      }
    }

    if (global.libraryProducts && Array.isArray(global.libraryProducts) && global.libraryProducts.length) {
      global.libraryProducts.forEach(function(p) { if (p) consider(p.id, p); });
    }

    // If we already found siblings, or the in-memory catalog looks complete, stop.
    // If catalog is tiny / empty, fall through to Firestore title query.
    if (out.length || (global.libraryProducts && global.libraryProducts.length > 50)) return out;

    var db = global.db;
    if (!db || !titleOnly) return out;
    try {
      var snap = await db.collection('products').where('title', '==', title).limit(40).get();
      snap.forEach(function(d) { consider(d.id, d.data()); });
    } catch (_e1) {
      try {
        var snapAll = await db.collection('products').limit(800).get();
        snapAll.forEach(function(d) { consider(d.id, d.data()); });
      } catch (_e1b) {}
    }
    try {
      var snap2 = await db.collection('productLibrary').where('title', '==', title).limit(40).get();
      snap2.forEach(function(d) { consider(d.id, d.data()); });
    } catch (_e2) {
      try {
        var snap2b = await db.collection('productLibrary').limit(800).get();
        snap2b.forEach(function(d) { consider(d.id, d.data()); });
      } catch (_e2b) {}
    }
    return out;
  }

  /** Title match; vendor required only when both sides have one (WO-057). */
  function cchTitleVendorLooseMatch(rowTitle, rowVendor, title, vendor) {
    var lt = String(rowTitle || '').trim().toLowerCase();
    var pt = String(title || '').trim().toLowerCase();
    if (!lt || !pt || lt !== pt) return false;
    var lv = String(rowVendor || '').trim().toLowerCase();
    var pv = String(vendor || '').trim().toLowerCase();
    if (!lv || !pv) return true;
    return lv === pv;
  }

  async function cchScanClipsByTitleVendor(projectId, title, vendor, libId, addTarget) {
    var db = global.db;
    if (!db || !projectId || !title) return;
    var pname = projectId;
    try {
      var bs = await db.collection('boards').doc(projectId).get();
      if (bs.exists) pname = (bs.data() || {}).name || projectId;
    } catch (_eBn) {}
    try {
      var cs = await db.collection('boards').doc(projectId).collection('clips').limit(500).get();
      cs.forEach(function(cd) {
        var c = cd.data() || {};
        if (!cchTitleVendorLooseMatch(c.title, c.vendor, title, vendor)) return;
        var clipLib = String(c.libraryProductId || c.libraryId || '').trim();
        // Already linked to this library id — covered by libraryProductId query; skip dupe work
        if (clipLib && clipLib === libId) return;
        // Linked to a different library product — do not hijack
        if (clipLib && clipLib !== libId) return;
        addTarget({
          key: 'clip|' + projectId + '|' + cd.id,
          type: 'clip',
          projectId: projectId,
          projectName: pname,
          id: cd.id,
          title: c.title || '',
          currentCost: cchClipTradeCost(c),
          lockReason: cchClipCostLockReason(c, projectId),
          _titleVendorMatch: true,
          _healLibraryId: libId
        });
      });
    } catch (_eClip) {}
  }

  /**
   * WO-057 — match unlocked proposal/invoice/PO lines by title(+vendor) when libraryProductId is missing.
   * Respects cchDocLineCostLockReason (draft proposals stay unlocked).
   */
  async function cchScanLinesByTitleVendor(projectId, title, vendor, libId, addTarget) {
    var db = global.db;
    if (!db || !projectId || !title) return;
    var pname = projectId;
    try {
      var bs = await db.collection('boards').doc(projectId).get();
      if (bs.exists) pname = (bs.data() || {}).name || projectId;
    } catch (_eBn) {}
    var collections = ['proposals', 'invoices', 'purchaseOrders'];
    for (var ci = 0; ci < collections.length; ci++) {
      var coll = collections[ci];
      try {
        var snap = await db.collection('boards').doc(projectId).collection(coll).get();
        for (var di = 0; di < snap.docs.length; di++) {
          var d = snap.docs[di];
          var docData = d.data() || {};
          var items = docData.items || [];
          var num = '';
          if (coll === 'proposals') num = docData.proposalNum || docData.number || d.id;
          else if (coll === 'invoices') num = docData.invoiceNum || docData.number || d.id;
          else num = docData.poNumber || docData.number || d.id;
          for (var li = 0; li < items.length; li++) {
            var line = items[li];
            if (!line) continue;
            if (typeof global.isProposalGroupHeaderItem === 'function' && global.isProposalGroupHeaderItem(line)) continue;
            if (!cchTitleVendorLooseMatch(line.title || line.name, line.vendor, title, vendor)) continue;
            var lineLib = String(line.libraryProductId || line.linkedLibraryProductId || '').trim();
            if (lineLib && lineLib === libId) continue;
            if (lineLib && lineLib !== libId) continue;
            addTarget({
              key: 'line|' + projectId + '|' + coll + '|' + d.id + '|' + li,
              type: 'line',
              projectId: projectId,
              projectName: pname,
              collection: coll,
              docId: d.id,
              docNum: num,
              lineIndex: li,
              title: line.title || line.name || '',
              currentCost: cchLineTradeCost(line),
              lockReason: cchDocLineCostLockReason(line, coll, docData, projectId),
              _titleVendorMatch: true,
              _healLibraryId: libId
            });
          }
        }
      } catch (_eColl) {}
    }
  }

  async function cchPruneStaleLibraryUsageRefs(libId, staleKeys) {
    libId = String(libId || '').trim();
    if (!libId || !staleKeys || !staleKeys.length) return 0;
    var db = global.db;
    if (!db) return 0;
    var prod = await cchLoadLibraryProduct(libId);
    if (!prod) return 0;
    var refs = Object.assign({}, prod.data.libraryUsageRefs || {});
    var removed = 0;
    for (var i = 0; i < staleKeys.length; i++) {
      var k = staleKeys[i];
      if (k && refs[k] != null) {
        delete refs[k];
        removed++;
      }
    }
    if (!removed) return 0;
    var patch = { libraryUsageRefs: refs, updatedAt: new Date().toISOString() };
    try {
      if (typeof global._updateLibraryProductDual === 'function') {
        await global._updateLibraryProductDual(libId, patch, {
          explicitLibraryEdit: true,
          explicitUserAction: true,
          source: 'cchPruneStaleLibraryUsageRefs'
        });
      } else {
        await db.collection('products').doc(libId).set(patch, { merge: true });
      }
    } catch (_ePrune) {
      console.warn('[cchPruneStaleLibraryUsageRefs]', libId, _ePrune);
      return 0;
    }
    return removed;
  }

  /**
   * @param {object} opts
   * @param {string} opts.libraryProductId
   * @param {number} opts.newCost
   * @param {string} [opts.source] library|line|clip
   * @param {boolean} [opts.fillEmptyOnly] when true, skip rows that already have trade cost (default false — all unlocked)
   * @param {string} [opts.skipTargetKey] exclude source target from plan
   */
  async function cchBuildTradeCostBulkPlan(opts) {
    opts = opts || {};
    var libId = String(opts.libraryProductId || '').trim();
    var newCost = cchParseTradeCost(opts.newCost);
    var fillEmptyOnly = opts.fillEmptyOnly === true;
    if (!libId || newCost == null) return { eligible: [], skipped: [], unchanged: [], newCost: newCost, libraryProductId: libId };

    var prod = await cchLoadLibraryProduct(libId);
    if (!prod) return { eligible: [], skipped: [{ key: 'library|' + libId, reason: 'Library row not found' }], unchanged: [], newCost: newCost, libraryProductId: libId };

    var db = global.db;
    var eligible = [];
    var skipped = [];
    var unchanged = [];
    var seen = {};
    var projectIds = {};

    function addTarget(t) {
      var key = t.key;
      if (!key || seen[key]) return;
      seen[key] = true;
      if (opts.skipTargetKey && key === opts.skipTargetKey) return;
      if (t.lockReason) {
        skipped.push(t);
        return;
      }
      if (cchCostsMatch(t.currentCost, newCost)) {
        unchanged.push(t);
        return;
      }
      if (fillEmptyOnly && t.currentCost != null && t.currentCost > 0) {
        skipped.push(Object.assign({}, t, { lockReason: 'Already has trade cost (fill-empty-only)' }));
        return;
      }
      eligible.push(t);
    }

    var libCost = cchParseTradeCost(prod.data.costPrice != null ? prod.data.costPrice : prod.data.unitCost);
    if (opts.source !== 'library') {
      addTarget({
        key: 'library|' + libId,
        type: 'library',
        id: libId,
        title: prod.data.title || '',
        currentCost: libCost,
        lockReason: cchLibraryCostLockReason(prod.data)
      });
    }

    var siblings = await cchFindSiblingLibraryRows(prod, libId);
    var siblingIds = [];
    for (var si = 0; si < siblings.length; si++) {
      var sib = siblings[si];
      siblingIds.push(sib.id);
      addTarget({
        key: 'library|' + sib.id,
        type: 'library',
        id: sib.id,
        title: sib.data.title || '',
        currentCost: cchParseTradeCost(sib.data.costPrice != null ? sib.data.costPrice : sib.data.unitCost),
        lockReason: cchLibraryCostLockReason(sib.data),
        _siblingLibrary: true
      });
    }

    var refs = prod.data.libraryUsageRefs || {};
    Object.keys(refs).forEach(function(refKey) {
      var r = refs[refKey];
      if (!r || !r.projectId || !r.docId) return;
      projectIds[r.projectId] = true;
    });

    // Library pushes always deep-scan: stale libraryUsageRefs used to disable fallback and hide siblings' clips.
    var doDeep = opts.deepScan === true || opts.source === 'library';
    projectIds = await cchResolveScanProjectIds(prod.data, Object.assign({}, opts, { deepScan: doDeep }));
    Object.keys(refs).forEach(function(refKey) {
      var r = refs[refKey];
      if (r && r.projectId) projectIds[r.projectId] = true;
    });

    var staleRefKeys = [];
    function markStaleRef(refKey) {
      if (!refKey || staleRefKeys.indexOf(refKey) >= 0) return;
      staleRefKeys.push(refKey);
    }
    var refKeys = Object.keys(refs);
    for (var ri = 0; ri < refKeys.length; ri++) {
      var refKey = refKeys[ri];
      var ref = refs[refKey];
      if (!ref || ref.lineIndex == null) continue;
      var coll = collectionFromKind(ref.kind);
      if (!coll) continue;
      var lineIdx = parseInt(ref.lineIndex, 10);
      if (isNaN(lineIdx) || lineIdx < 0) continue;
      try {
        var ds = await db.collection('boards').doc(ref.projectId).collection(coll).doc(ref.docId).get();
        if (!ds.exists) {
          markStaleRef(refKey);
          skipped.push({ key: 'line|' + refKey, lockReason: 'Could not load linked doc' });
          continue;
        }
        var docData = ds.data() || {};
        var items = docData.items || [];
        var line = items[lineIdx];
        if (!line) {
          markStaleRef(refKey);
          skipped.push({ key: 'line|' + refKey, lockReason: 'Could not load linked doc' });
          continue;
        }
        addTarget({
          key: 'line|' + ref.projectId + '|' + coll + '|' + ref.docId + '|' + lineIdx,
          type: 'line',
          projectId: ref.projectId,
          projectName: ref.projectName || ref.projectId,
          collection: coll,
          docId: ref.docId,
          docNum: ref.num || '',
          lineIndex: lineIdx,
          title: line.title || ref.title || '',
          currentCost: cchLineTradeCost(line),
          lockReason: cchDocLineCostLockReason(line, coll, docData, ref.projectId)
        });
      } catch (_eRef) {
        markStaleRef(refKey);
        skipped.push({ key: 'line|' + refKey, lockReason: 'Could not load linked doc' });
      }
    }

    var libIdsToScan = [libId].concat(siblingIds);
    var pids = Object.keys(projectIds);
    for (var pi = 0; pi < pids.length; pi++) {
      var pid = pids[pi];
      for (var li = 0; li < libIdsToScan.length; li++) {
        var scanLib = libIdsToScan[li];
        try {
          var cs = await db.collection('boards').doc(pid).collection('clips').where('libraryProductId', '==', scanLib).get();
          cs.forEach(function(cd) {
            var c = cd.data() || {};
            var pname = refProjectName(refs, pid) || pid;
            addTarget({
              key: 'clip|' + pid + '|' + cd.id,
              type: 'clip',
              projectId: pid,
              projectName: pname,
              id: cd.id,
              title: c.title || '',
              currentCost: cchClipTradeCost(c),
              lockReason: cchClipCostLockReason(c, pid)
            });
          });
        } catch (_eClip) {}
      }
    }

    var usedFallback = false;
    if (!Object.keys(refs).length || doDeep) {
      usedFallback = true;
      for (var fi = 0; fi < libIdsToScan.length; fi++) {
        await cchFallbackScanProjectsForLibraryId(libIdsToScan[fi], projectIds, addTarget, opts);
      }
    }

    if (doDeep && prod.data.title) {
      var scanPids = Object.keys(projectIds);
      var scanTitle = prod.data.title;
      var scanVendor = cchLibraryVendor(prod.data);
      for (var tvi = 0; tvi < scanPids.length; tvi++) {
        await cchScanClipsByTitleVendor(scanPids[tvi], scanTitle, scanVendor, libId, addTarget);
        // WO-057: unlinked draft proposal / invoice / PO lines (libId missing)
        await cchScanLinesByTitleVendor(scanPids[tvi], scanTitle, scanVendor, libId, addTarget);
      }
    }

    return {
      eligible: eligible,
      skipped: skipped,
      unchanged: unchanged,
      newCost: newCost,
      libraryProductId: libId,
      productTitle: prod.data.title || '',
      usedFallback: usedFallback,
      refsCount: Object.keys(refs).length,
      siblingCount: siblings.length,
      projectsScanned: Object.keys(projectIds).length,
      deepScan: doDeep,
      staleRefKeys: staleRefKeys
    };
  }

  function refProjectName(refs, projectId) {
    var keys = Object.keys(refs || {});
    for (var i = 0; i < keys.length; i++) {
      if (refs[keys[i]] && refs[keys[i]].projectId === projectId) return refs[keys[i]].projectName;
    }
    return '';
  }

  function lineHasLibraryId(line, libId) {
    line = line || {};
    libId = String(libId || '').trim();
    if (!libId) return false;
    return String(line.libraryProductId || line.linkedLibraryProductId || '').trim() === libId;
  }

  /** Fallback when libraryUsageRefs is empty (legacy links before push-model sync). */
  async function cchFallbackScanProjectsForLibraryId(libId, projectIds, addTarget, opts) {
    opts = opts || {};
    var db = global.db;
    if (!db || !libId) return;
    var pids = Object.keys(projectIds || {});
    if (!pids.length) return;
    var collections = ['proposals', 'invoices', 'purchaseOrders'];
    for (var pi = 0; pi < pids.length; pi++) {
      var pid = pids[pi];
      var pname = pid;
      try {
        var bs = await db.collection('boards').doc(pid).get();
        if (bs.exists) pname = (bs.data() || {}).name || pid;
      } catch (_eBn) {}
      for (var ci = 0; ci < collections.length; ci++) {
        var coll = collections[ci];
        try {
          var snap = await db.collection('boards').doc(pid).collection(coll).get();
          for (var di = 0; di < snap.docs.length; di++) {
            var d = snap.docs[di];
            var docData = d.data() || {};
            var items = docData.items || [];
            for (var li = 0; li < items.length; li++) {
              if (!lineHasLibraryId(items[li], libId)) continue;
              if (typeof global.isProposalGroupHeaderItem === 'function' && global.isProposalGroupHeaderItem(items[li])) continue;
              var num = '';
              if (coll === 'proposals') num = docData.proposalNum || docData.number || d.id;
              else if (coll === 'invoices') num = docData.invoiceNum || docData.number || d.id;
              else num = docData.poNumber || docData.number || d.id;
              addTarget({
                key: 'line|' + pid + '|' + coll + '|' + d.id + '|' + li,
                type: 'line',
                projectId: pid,
                projectName: pname,
                collection: coll,
                docId: d.id,
                docNum: num,
                lineIndex: li,
                title: items[li].title || '',
                currentCost: cchLineTradeCost(items[li]),
                lockReason: cchDocLineCostLockReason(items[li], coll, docData, pid),
                _fallbackScan: true
              });
            }
          }
        } catch (_eColl) {}
      }
      try {
        var cs = await db.collection('boards').doc(pid).collection('clips').where('libraryProductId', '==', libId).get();
        cs.forEach(function(cd) {
          var c = cd.data() || {};
          addTarget({
            key: 'clip|' + pid + '|' + cd.id,
            type: 'clip',
            projectId: pid,
            projectName: pname,
            id: cd.id,
            title: c.title || '',
            currentCost: cchClipTradeCost(c),
            lockReason: cchClipCostLockReason(c, pid),
            _fallbackScan: true
          });
        });
      } catch (_eClip2) {}
    }
  }

  async function cchResolveScanProjectIds(prodData, opts) {
    var ids = {};
    prodData = prodData || {};
    opts = opts || {};
    if (opts.projectId) ids[opts.projectId] = true;
    if (prodData.projectId) ids[String(prodData.projectId).trim()] = true;
    if (opts.deepScan) {
      if (typeof global.getCachedBoards === 'function') {
        try {
          var snap = await global.getCachedBoards();
          snap.forEach(function(d) { ids[d.id] = true; });
        } catch (_eAll) {}
      }
      if (!Object.keys(ids).length && global.db) {
        try {
          var bs = await global.db.collection('boards').limit(400).get();
          bs.forEach(function(d) { ids[d.id] = true; });
        } catch (_eB) {}
      }
    }
    return ids;
  }

  function cchTradeCostBulkModalHtml(plan, fillEmptyOnly) {
    plan = plan || {};
    var eligible = plan.eligible || [];
    var skipped = plan.skipped || [];
    var unchanged = plan.unchanged || [];
    var newCost = plan.newCost;
    var title = esc(plan.productTitle || 'Product');

    var elList = eligible.length
      ? eligible.map(function(t) {
          var from = t.currentCost != null ? ('$' + t.currentCost.toFixed(2)) : 'empty';
          return '<li style="margin-bottom:4px;font-size:12px;">' + targetLabel(t) + ' <span style="color:var(--gray-500);">' + from + ' → $' + newCost.toFixed(2) + '</span></li>';
        }).join('')
      : '<li style="font-size:12px;color:var(--gray-500);">No unlocked targets need this cost.</li>';

    var skipList = skipped.length
      ? skipped.slice(0, 12).map(function(t) {
          return '<li style="margin-bottom:4px;font-size:11px;color:#92400E;">' + targetLabel(t) + ' — ' + esc(t.lockReason || 'skipped') + '</li>';
        }).join('') + (skipped.length > 12 ? '<li style="font-size:11px;color:var(--gray-400);">…and ' + (skipped.length - 12) + ' more</li>' : '')
      : '';

    var unchgN = unchanged.length;
    var zeroNote = !eligible.length
      ? '<p style="margin:0 0 14px;padding:10px 12px;background:rgba(196,164,100,0.08);border-radius:6px;font-size:12px;color:var(--gray-600);line-height:1.45;">' +
          (plan._noLibraryId
            ? '<strong>Selection saved.</strong> No Product Library row matched this title + vendor, so trade cost cannot sync elsewhere yet.'
            : '<strong>Product Library saved.</strong> No unlocked clips / proposals / invoices / POs / duplicate library rows need $' + newCost.toFixed(2) + ' right now.' +
              (plan.siblingCount ? ' Found ' + plan.siblingCount + ' same-title library duplicate(s) — they already match or are locked.' : ' No same-title library duplicates found in the loaded catalog.') +
              (plan.projectsScanned != null ? ' Scanned ' + plan.projectsScanned + ' project(s).' : '') +
              (unchgN ? ' ' + unchgN + ' linked item(s) already match this cost.' : '')) +
          '</p>'
      : '';

    return '<div class="modal-overlay cch-cost-bulk-overlay" onclick="if(event.target===this)cchCloseTradeCostBulkModal()">' +
      '<div class="modal" style="max-width:560px;max-height:88vh;display:flex;flex-direction:column;">' +
        '<div class="modal-header"><h3 style="font-family:var(--font-display);font-size:20px;font-weight:400;">Update trade cost — unlocked items</h3>' +
          '<button type="button" class="modal-close" onclick="cchCloseTradeCostBulkModal()">&times;</button></div>' +
        '<div class="modal-body" style="overflow:auto;flex:1;font-size:13px;line-height:1.45;">' +
          '<p style="margin:0 0 12px;"><strong>' + title + '</strong><br>Trade cost (DNET): <strong>$' + newCost.toFixed(2) + '</strong></p>' +
          zeroNote +
          '<p style="font-size:11px;color:var(--gray-500);margin:0 0 10px;line-height:1.45;">All <strong>unlocked</strong> linked rows with a different trade cost are listed below — including duplicate library rows with the same title + vendor. Locked invoices, sent POs, and cost-locked lines are skipped.</p>' +
          '<label style="display:flex;align-items:center;gap:8px;margin-bottom:14px;font-size:12px;cursor:pointer;">' +
            '<input type="checkbox" id="cchCostBulkFillEmpty"' + (fillEmptyOnly === true ? ' checked' : '') + '> Only fill empty or $0 rows (skip rows that already have trade cost)</label>' +
          '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--gray-500);margin-bottom:6px;">Will update (' + eligible.length + ')</div>' +
          '<ul style="margin:0 0 14px 18px;padding:0;">' + elList + '</ul>' +
          (skipList ? '<div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#92400E;margin-bottom:6px;">Skipped — locked or blocked (' + skipped.length + ')</div><ul style="margin:0 0 14px 18px;padding:0;">' + skipList + '</ul>' : '') +
          (unchgN ? '<p style="font-size:11px;color:var(--gray-400);margin:0;">' + unchgN + ' linked item(s) already match this cost.</p>' : '') +
        '</div>' +
        '<div class="modal-footer" style="display:flex;gap:8px;justify-content:flex-end;">' +
          '<button type="button" class="btn btn-secondary" onclick="cchCloseTradeCostBulkModal()">Cancel</button>' +
          '<button type="button" class="btn btn-primary" id="cchCostBulkApplyBtn"' + (eligible.length ? '' : ' disabled') + '>Apply to ' + eligible.length + ' item(s)</button>' +
        '</div>' +
      '</div></div>';
  }

  global._cchTradeCostBulkPlan = null;

  global.cchCloseTradeCostBulkModal = function() {
    var o = document.querySelector('.cch-cost-bulk-overlay');
    if (o) o.remove();
    global._cchTradeCostBulkPlan = null;
  };

  async function cchApplyTradeCostTarget(t, newCost) {
    var db = global.db;
    var ts = new Date().toISOString();
    newCost = cchParseTradeCost(newCost);
    if (newCost == null) return false;

    if (t.type === 'library') {
      if (typeof global._updateLibraryProductDual === 'function') {
        await global._updateLibraryProductDual(t.id, { costPrice: newCost, unitCost: newCost, updatedAt: ts }, {
          explicitLibraryEdit: true,
          explicitUserAction: true,
          source: 'cchApplyTradeCostBulk'
        });
      } else {
        await db.collection('products').doc(t.id).set({ costPrice: newCost, unitCost: newCost, updatedAt: ts }, { merge: true });
      }
      return true;
    }

    if (t.type === 'clip') {
      var clipPatch = {
        cost: newCost,
        unitCost: newCost,
        costPrice: newCost,
        updatedAt: ts
      };
      // WO-057 heal: stamp library link when matched by title+vendor only
      var healClip = String(t._healLibraryId || '').trim();
      if (healClip && t._titleVendorMatch) {
        clipPatch.libraryProductId = healClip;
      }
      await db.collection('boards').doc(t.projectId).collection('clips').doc(t.id).update(clipPatch);
      return true;
    }

    if (t.type === 'line') {
      var ds = await db.collection('boards').doc(t.projectId).collection(t.collection).doc(t.docId).get();
      if (!ds.exists) return false;
      var docData = ds.data() || {};
      var items = (docData.items || []).slice();
      var line = items[t.lineIndex];
      if (!line) return false;
      line.cost = newCost;
      var healLine = String(t._healLibraryId || '').trim();
      if (healLine && t._titleVendorMatch) {
        var existingLib = String(line.libraryProductId || line.linkedLibraryProductId || '').trim();
        if (!existingLib) line.libraryProductId = healLine;
      }
      var patch = { items: items, updatedAt: ts };
      if (t.collection === 'proposals') {
        patch.total = items.reduce(function(s, i) { return s + (parseFloat(i && i.amount) || 0); }, 0);
      }
      if (t.collection === 'invoices' && typeof global.invoiceComputedGrandTotal === 'function') {
        patch.total = global.invoiceComputedGrandTotal(Object.assign({}, docData, { items: items }));
      }
      await db.collection('boards').doc(t.projectId).collection(t.collection).doc(t.docId).update(patch);
      return true;
    }
    return false;
  }

  global.cchApplyTradeCostBulk = async function(plan) {
    plan = plan || global._cchTradeCostBulkPlan;
    if (!plan || !plan.eligible || !plan.eligible.length) {
      // Still prune stale refs even when nothing to update (user opened modal / force path)
      if (plan && plan.staleRefKeys && plan.staleRefKeys.length && plan.libraryProductId) {
        try { await cchPruneStaleLibraryUsageRefs(plan.libraryProductId, plan.staleRefKeys); } catch (_eP0) {}
      }
      return { applied: 0 };
    }
    var btn = document.getElementById('cchCostBulkApplyBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Applying…'; }
    var applied = 0;
    var errors = 0;
    for (var i = 0; i < plan.eligible.length; i++) {
      try {
        if (await cchApplyTradeCostTarget(plan.eligible[i], plan.newCost)) applied++;
      } catch (e) {
        errors++;
        console.warn('[cchApplyTradeCostBulk]', plan.eligible[i], e);
      }
    }
    var pruned = 0;
    if (plan.staleRefKeys && plan.staleRefKeys.length && plan.libraryProductId) {
      try { pruned = await cchPruneStaleLibraryUsageRefs(plan.libraryProductId, plan.staleRefKeys); } catch (_eP) {}
    }
    global.cchCloseTradeCostBulkModal();
    if (typeof global.showToast === 'function') {
      var msg = 'Trade cost updated on ' + applied + ' item(s)' + (errors ? ' (' + errors + ' failed)' : '');
      if (pruned) msg += ' · cleared ' + pruned + ' stale link(s)';
      global.showToast(msg, errors ? 'warning' : 'success', 5000);
    }
    if (typeof global.invalidateProjectSelectionsCache === 'function' && plan.projectId) {
      try { global.invalidateProjectSelectionsCache(plan.projectId); } catch (_e) {}
    }
    if (location.hash.indexOf('library') >= 0 && typeof global.renderLibraryView === 'function') {
      try { global.renderLibraryView(); } catch (_e2) {}
    }
    return { applied: applied, errors: errors };
  };

  function cchTradeCostBulkEmptyMessage(plan) {
    plan = plan || {};
    if (plan.refsCount === 0 && !plan.usedFallback) {
      return 'No linked proposals, invoices, POs, or clips found for this library id. Open the invoice line and save once to register the link, or use Add to Project.';
    }
    if (!(plan.skipped || []).length && !(plan.unchanged || []).length) {
      return 'No linked items found for this library product.';
    }
    if (!(plan.eligible || []).length && (plan.skipped || []).length) {
      return 'Linked items exist but all are locked or blocked. Sent invoices, sent POs, and cost-locked lines cannot be bulk-updated.';
    }
    if (!(plan.eligible || []).length && (plan.unchanged || []).length) {
      return 'All linked items already have trade cost $' + (plan.newCost != null ? plan.newCost.toFixed(2) : '—') + '.';
    }
    return 'No unlocked items need this trade cost update.';
  }

  global.cchShowTradeCostBulkModal = async function(opts) {
    opts = opts || {};
    var fillEmptyOnly = opts.fillEmptyOnly === true;
    var plan;
    if (opts._noLibraryId) {
      plan = {
        eligible: [],
        skipped: [{ key: 'nolib', type: 'clip', title: opts.productTitle || 'Selection', lockReason: 'No matching Product Library row (title + vendor)' }],
        unchanged: [],
        newCost: cchParseTradeCost(opts.newCost),
        productTitle: opts.productTitle || 'Selection',
        refsCount: 0,
        usedFallback: false,
        _noLibraryId: true
      };
    } else {
      plan = await cchBuildTradeCostBulkPlan(opts);
    }
    // WO-057: drop dead libraryUsageRefs even when Apply is disabled (only skips)
    if (plan.staleRefKeys && plan.staleRefKeys.length && plan.libraryProductId) {
      try { await cchPruneStaleLibraryUsageRefs(plan.libraryProductId, plan.staleRefKeys); plan.staleRefKeys = []; } catch (_ePruneModal) {}
    }
    if (!opts.forceModal) {
      if (!plan.eligible.length && !plan.skipped.length && !plan.unchanged.length) {
        if (typeof global.showToast === 'function') {
          global.showToast(cchTradeCostBulkEmptyMessage(plan), 'info', 6000);
        }
        return;
      }
      if (!plan.eligible.length) {
        if (typeof global.showToast === 'function') {
          global.showToast(cchTradeCostBulkEmptyMessage(plan), 'info', 6500);
        }
        return;
      }
    }
    global._cchTradeCostBulkPlan = plan;
    var wrap = document.createElement('div');
    wrap.innerHTML = cchTradeCostBulkModalHtml(plan, fillEmptyOnly);
    document.body.appendChild(wrap.firstElementChild);
    var applyBtn = document.getElementById('cchCostBulkApplyBtn');
    if (applyBtn) {
      applyBtn.onclick = async function() {
        var cb = document.getElementById('cchCostBulkFillEmpty');
        var fillOnly = !!(cb && cb.checked);
        global._cchTradeCostBulkPlan = await cchBuildTradeCostBulkPlan(Object.assign({}, opts, { fillEmptyOnly: fillOnly }));
        await global.cchApplyTradeCostBulk(global._cchTradeCostBulkPlan);
      };
    }
    var fillCb = document.getElementById('cchCostBulkFillEmpty');
    if (fillCb) {
      fillCb.onchange = async function() {
        var p2 = await cchBuildTradeCostBulkPlan(Object.assign({}, opts, { fillEmptyOnly: fillCb.checked }));
        global._cchTradeCostBulkPlan = p2;
        global.cchCloseTradeCostBulkModal();
        global.cchShowTradeCostBulkModal(Object.assign({}, opts, { fillEmptyOnly: fillCb.checked }));
      };
    }
  };

  /** After a cost save — offer bulk update if other unlocked targets exist. */
  global.cchOfferTradeCostBulkUpdate = async function(opts) {
    opts = opts || {};
    var newCost = cchParseTradeCost(opts.newCost);
    var oldCost = cchParseTradeCost(opts.oldCost);
    if (newCost == null) return;
    if (cchCostsMatch(newCost, oldCost)) return;
    var libId = String(opts.libraryProductId || '').trim();
    if (!libId && opts.source === 'line' && opts.line) {
      libId = String(opts.line.libraryProductId || opts.line.linkedLibraryProductId || '').trim();
    }
    if (!libId && opts.source === 'clip' && opts.clip) {
      libId = String(opts.clip.libraryProductId || opts.clip.linkedLibraryProductId || opts.clip.libraryId || '').trim();
    }
    if (!libId && opts.clip && typeof global._resolveProductMatchForLineItem === 'function') {
      try {
        var _cm = await global._resolveProductMatchForLineItem({
          title: opts.clip.title || '',
          vendor: opts.clip.vendor || '',
          sku: opts.clip.sku || '',
          houzzId: opts.clip.houzzId || opts.clip.houzzProductId || '',
          projectId: opts.projectId || ''
        }, { projectId: opts.projectId || '', projectName: opts.projectName || '' });
        if (_cm && _cm.product && _cm.product.id && _cm.matchHow !== 'libraryProductId-mismatch') {
          libId = String(_cm.product.id).trim();
        }
      } catch (_eCm) {}
    }
    if (!libId) {
      if (typeof global.showToast === 'function') {
        global.showToast('No Product Library link — save a trade cost on a linked item first.', 'info', 5000);
      }
      return;
    }

    var scanOpts = Object.assign({}, opts, { libraryProductId: libId, newCost: newCost });
    // Always deep-scan from library — stale libraryUsageRefs were short-circuiting sibling/clip discovery.
    scanOpts.deepScan = true;
    var plan = await cchBuildTradeCostBulkPlan(scanOpts);
    if (plan.staleRefKeys && plan.staleRefKeys.length && plan.libraryProductId) {
      try { await cchPruneStaleLibraryUsageRefs(plan.libraryProductId, plan.staleRefKeys); plan.staleRefKeys = []; } catch (_ePruneOffer) {}
    }
    if (!plan.eligible.length) {
      if (typeof global.showToast === 'function') {
        global.showToast(cchTradeCostBulkEmptyMessage(plan), 'info', 5500);
      }
      return;
    }
    await global.cchShowTradeCostBulkModal(Object.assign({}, scanOpts, {
      libraryProductId: libId,
      newCost: newCost,
      forceModal: true
    }));
  };

  /** Manual trigger from line editor or library detail. */
  global.cchPromptTradeCostBulkFromUi = async function(opts) {
    opts = opts || {};
    var newCost = cchParseTradeCost(opts.newCost);
    var libId = String(opts.libraryProductId || '').trim();
    if (!libId) {
      if (newCost == null) {
        if (typeof global.showToast === 'function') global.showToast('Enter a trade cost first', 'warning');
        return;
      }
      await global.cchShowTradeCostBulkModal({
        forceModal: true,
        newCost: newCost,
        _noLibraryId: true,
        productTitle: opts.productTitle || 'Selection'
      });
      return;
    }
    if (newCost == null) {
      if (typeof global.showToast === 'function') global.showToast('Enter a trade cost first', 'warning');
      return;
    }
    await global.cchShowTradeCostBulkModal(Object.assign({}, opts, {
      libraryProductId: libId,
      newCost: newCost,
      deepScan: true,
      forceModal: true
    }));
  };

  global.cchDocLineCostLockReason = cchDocLineCostLockReason;
  global.cchClipCostLockReason = cchClipCostLockReason;
  global.cchLibraryCostLockReason = cchLibraryCostLockReason;
  global.cchBuildTradeCostBulkPlan = cchBuildTradeCostBulkPlan;
  global.cchParseTradeCost = cchParseTradeCost;
  global.cchCostsMatch = cchCostsMatch;
  global.cchLineTradeCost = cchLineTradeCost;

  try { console.info('[cch-cost-lock] loaded'); } catch (_e) {}
})(typeof window !== 'undefined' ? window : global);
