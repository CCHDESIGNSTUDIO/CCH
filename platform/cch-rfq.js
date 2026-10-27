/**
 * WO-046 Phase 1 — Request for Pricing (RFQ) from a proposal.
 * Vendor sheet: SKU, finish, dimensions, qty, needed-by. Never sell / markup / PO.
 */
(function () {
  function esc(s) {
    if (typeof window.esc === 'function') return window.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escAttr(s) {
    if (typeof window.escAttr === 'function') return window.escAttr(s);
    return esc(s).replace(/'/g, '&#39;');
  }
  function money(v) {
    if (typeof window.parseMoney === 'function') return window.parseMoney(v) || 0;
    var n = parseFloat(String(v == null ? '' : v).replace(/[$,]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function rfqSku(it) {
    it = it || {};
    return String(it.sku || it.model || it.itemCode || it.productCode || it.productSku || it.vendorSku || it.itemNumber || it.itemNo || it.partNumber || it.partNo || '').trim();
  }
  function rfqFinish(it) {
    it = it || {};
    return [it.finish, it.color, it.finishColor, it.materials, it.finishMaterial]
      .filter(function (x) { return x && String(x).trim(); })
      .map(function (x) { return String(x).trim(); })
      .join(' · ');
  }
  function rfqDimensions(it) {
    it = it || {};
    return String(it.dimensions || it.size || it.dimension || it.dims || it.measurements || '').trim();
  }
  function rfqImage(it) {
    it = it || {};
    var u = '';
    try {
      if (typeof window.getProposalLineListThumbnailUrl === 'function') {
        u = String(window.getProposalLineListThumbnailUrl(it) || '').trim();
        if (u) return u;
      }
    } catch (_e0) {}
    try {
      if (typeof window.getDocSidebarItemThumbnailUrl === 'function') {
        u = String(window.getDocSidebarItemThumbnailUrl(it) || '').trim();
        if (u) return u;
      }
    } catch (_e1) {}
    if (Array.isArray(it.images) && it.images.length) {
      var first = it.images[0];
      u = String((typeof first === 'string' ? first : (first && (first.url || first.imageUrl || first.src))) || '').trim();
      if (u) return u;
    }
    return String(it.imageUrl || it.image || it.thumbnail || it.img || '').trim();
  }
  function rfqFillLabeledSpecsFromText(it) {
    var blob = [it.description, it.vendorDescription, it.additionalDetails, it.details]
      .filter(function (x) { return x && String(x).trim(); })
      .join('\n');
    if (!blob) return;
    function grab(re) {
      var m = blob.match(re);
      return m ? String(m[1] || '').replace(/\s+/g, ' ').trim() : '';
    }
    if (!rfqSku(it)) {
      var sk = grab(/(?:^|\n)\s*(?:sku|model|item\s*(?:#|no\.?|number)|part\s*(?:#|no\.?))\s*[:#]\s*(.+)/i);
      if (sk) it.sku = sk;
    }
    if (!rfqFinish(it)) {
      var fn = grab(/(?:^|\n)\s*(?:finish|color|colour)\s*:\s*(.+)/i);
      if (fn) it.finish = fn;
    }
    if (!rfqDimensions(it)) {
      var dm = grab(/(?:^|\n)\s*(?:dimensions?|size|measurements?)\s*:\s*(.+)/i);
      if (dm) it.dimensions = dm;
    }
  }
  async function rfqLoadClipMap(projectId, items) {
    var map = {};
    var ids = [];
    (items || []).forEach(function (it) {
      var id = String((it && (it.clipId || it.sourceClipId || it.roomClipId)) || '').trim();
      if (id && ids.indexOf(id) < 0) ids.push(id);
    });
    if (!ids.length || !firebase || !firebase.firestore) return map;
    await Promise.all(ids.map(function (id) {
      return firebase.firestore().collection('boards').doc(projectId).collection('clips').doc(id).get()
        .then(function (snap) {
          if (snap.exists) map[id] = Object.assign({ id: snap.id }, snap.data() || {});
        })
        .catch(function () {});
    }));
    return map;
  }
  async function rfqHydrateLine(projectId, it, clipMap) {
    var line = Object.assign({}, it || {});
    var cid = String(line.clipId || line.sourceClipId || line.roomClipId || '').trim();
    var clip = (cid && clipMap && clipMap[cid]) || {};
    if (clip.id && typeof window.cchMergeLineItemWithClipImages === 'function') {
      try { line = window.cchMergeLineItemWithClipImages(line, clip); } catch (_eM) {}
    }
    var lib = null;
    var needLib = !rfqSku(line) || !rfqFinish(line) || !rfqDimensions(line) || !rfqImage(line);
    if (needLib && typeof window.resolveLineItemFromLibrary === 'function') {
      try {
        var res = await window.resolveLineItemFromLibrary(line, 0, { ensureBulkCache: true, buildClipCtx: false, projectId: projectId });
        lib = res && (res.lib || res.product) || null;
      } catch (_eR) {}
    }
    if (typeof window.cchFillLineItemFromClipMetadata === 'function') {
      try { line = window.cchFillLineItemFromClipMetadata(line, clip, lib || {}); } catch (_eF) {}
    }
    if (lib) {
      if (!rfqSku(line)) {
        var sk = String(lib.sku || lib.model || lib.itemCode || lib.productCode || lib.itemNumber || '').trim();
        if (sk) line.sku = sk;
      }
      if (!rfqFinish(line)) {
        var fn = String(lib.finish || lib.color || lib.finishColor || lib.materials || '').trim();
        if (fn) line.finish = fn;
      }
      if (!rfqDimensions(line)) {
        var dm = String(lib.dimensions || lib.size || lib.dimension || '').trim();
        if (dm) line.dimensions = dm;
      }
      if (!rfqImage(line)) {
        var iu = String(lib.imageUrl || lib.image || '').trim();
        if (iu) line.imageUrl = iu;
      }
    }
    if (!rfqDimensions(line) && typeof window.cchPoSplitPrintDescription === 'function') {
      try {
        var sp = window.cchPoSplitPrintDescription(line);
        if (sp && sp.dimensions) line.dimensions = sp.dimensions;
      } catch (_eS) {}
    }
    rfqFillLabeledSpecsFromText(line);
    return line;
  }
  function rfqVendor(it) {
    return String((it && (it.vendor || it.manufacturer)) || '').trim();
  }
  function rfqTitle(it) {
    return String((it && (it.title || it.name || it.description)) || 'Item').trim();
  }
  function rfqCost(it) {
    return money(it && (it.cost != null ? it.cost : (it.costPrice != null ? it.costPrice : it.unitCost)));
  }
  function rfqIsProduct(it) {
    if (!it) return false;
    if (typeof window.isProposalGroupHeaderItem === 'function' && window.isProposalGroupHeaderItem(it)) return false;
    if (typeof window._tearSheetLineIsProduct === 'function') return window._tearSheetLineIsProduct(it, 'proposals');
    return true;
  }

  function lineKey(it, idx) {
    return String((it && (it.lineId || it.id)) || ('idx_' + idx));
  }

  window.cchRfqOpenFromProposal = async function (projectId, proposalId) {
    try {
      var snap = await firebase.firestore().collection('boards').doc(projectId).collection('proposals').doc(proposalId).get();
      if (!snap.exists) {
        if (typeof window.cchAlert === 'function') await window.cchAlert('Proposal not found.', 'Request Pricing');
        return;
      }
      var prop = snap.data() || {};
      var items = Array.isArray(prop.items) ? prop.items : [];
      if (typeof window.ensureLibraryProductsForLineItems === 'function') {
        try { await window.ensureLibraryProductsForLineItems(items); } catch (_eLib) {}
      }
      var clipMap = await rfqLoadClipMap(projectId, items);
      var eligible = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (!rfqIsProduct(it)) continue;
        var hydrated = await rfqHydrateLine(projectId, it, clipMap);
        eligible.push({ idx: i, item: hydrated, include: rfqCost(hydrated) <= 0, qty: parseFloat(hydrated.qty) || 1 });
      }
      if (!eligible.length) {
        if (typeof window.cchAlert === 'function') {
          await window.cchAlert('No product lines on this proposal (labor, expenses, and bundle headers are skipped).', 'Request Pricing');
        }
        return;
      }
      var missingCost = eligible.filter(function (r) { return r.include; }).length;
      if (missingCost === 0) {
        eligible.forEach(function (r) { r.include = true; });
      }
      var byVendor = {};
      eligible.forEach(function (row) {
        var v = rfqVendor(row.item) || '(No vendor)';
        if (!byVendor[v]) byVendor[v] = [];
        byVendor[v].push(row);
      });
      var vendorNames = Object.keys(byVendor);
      window._cchRfqDraft = { projectId: projectId, proposalId: proposalId, byVendor: byVendor, eligible: eligible, vendorNames: vendorNames };

      var html = '';
      vendorNames.forEach(function (vName, vi) {
        var rows = byVendor[vName];
        html += '<div class="cch-rfq-vendor" data-vi="' + vi + '" style="margin-bottom:18px;border:1px solid rgba(15,26,46,0.12);padding:12px;">';
        html += '<div style="font-size:13px;font-weight:700;color:#0F1A2E;margin-bottom:8px;">' + esc(vName) + ' · ' + rows.length + ' item' + (rows.length === 1 ? '' : 's') + '</div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">';
        html += '<div><label class="form-label">Vendor email</label><input type="email" class="form-input cch-rfq-email" data-vi="' + vi + '" placeholder="vendor@…"></div>';
        html += '<div><label class="form-label">Needed by</label><input type="date" class="form-input cch-rfq-needed" data-vi="' + vi + '"></div>';
        html += '</div>';
        html += '<div><label class="form-label">Note to vendor</label><textarea class="form-input cch-rfq-note" data-vi="' + vi + '" rows="2" placeholder="Optional — finish, COM, site constraints…" style="width:100%;min-height:52px;"></textarea></div>';
        html += '<div style="margin-top:10px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#9CA3AF;display:grid;grid-template-columns:28px 52px 1fr 90px 90px 70px;gap:6px;padding:0 2px 4px;"><span></span><span></span><span>Item</span><span>SKU</span><span>Finish</span><span>Qty</span></div>';
        rows.forEach(function (row) {
          var it = row.item;
          var sku = rfqSku(it) || '—';
          var fin = rfqFinish(it) || '—';
          var dim = rfqDimensions(it) || '—';
          var img = rfqImage(it);
          html += '<label style="display:grid;grid-template-columns:28px 52px 1fr 90px 90px 70px;gap:6px;align-items:start;padding:6px 2px;border-top:1px solid rgba(15,26,46,0.06);font-size:12px;cursor:pointer;">';
          html += '<input type="checkbox" class="cch-rfq-inc" data-idx="' + row.idx + '" ' + (row.include ? 'checked' : '') + ' style="margin-top:3px;">';
          if (img) {
            html += '<img src="' + escAttr(img) + '" alt="" referrerpolicy="no-referrer" style="width:48px;height:48px;object-fit:cover;border:1px solid rgba(15,26,46,0.12);background:#F7F5F0;">';
          } else {
            html += '<span style="width:48px;height:48px;border:1px solid rgba(15,26,46,0.08);background:#F7F5F0;display:block;"></span>';
          }
          html += '<span><strong style="color:#0F1A2E;">' + esc(rfqTitle(it)) + '</strong>';
          html += '<div style="font-size:11px;color:#5C6B80;margin-top:2px;">Dim: ' + esc(dim) + '</div></span>';
          html += '<span style="font-size:11px;color:#1B3352;word-break:break-word;">' + esc(sku) + '</span>';
          html += '<span style="font-size:11px;color:#1B3352;word-break:break-word;">' + esc(fin) + '</span>';
          html += '<input type="number" min="1" step="1" class="form-input cch-rfq-qty" data-idx="' + row.idx + '" value="' + escAttr(String(row.qty)) + '" style="font-size:12px;padding:4px;" onclick="event.preventDefault();event.stopPropagation();">';
          html += '</label>';
        });
        html += '</div>';
      });

      var mc = document.getElementById('modalContainer');
      if (!mc) {
        if (typeof window.cchAlert === 'function') await window.cchAlert('Modal container missing — refresh and try again.', 'Request Pricing');
        return;
      }
      mc.innerHTML =
        '<div class="modal-overlay" onclick="if(event.target===this)closeModal()">' +
        '<div class="modal" style="width:min(880px,96vw);max-height:92vh;overflow:hidden;display:flex;flex-direction:column;border-radius:0;">' +
        '<div class="modal-header"><div class="modal-title">Request Pricing</div><button type="button" class="modal-close" onclick="closeModal()">&times;</button></div>' +
        '<div class="modal-body" style="overflow-y:auto;flex:1;">' +
        '<p style="font-size:13px;color:#5C6B80;margin:0 0 14px;line-height:1.45;">One request per vendor. The sheet includes <strong>SKU, finish, and dimensions</strong> — never client sell, markup, or margin. This does not create a PO.</p>' +
        html +
        '</div>' +
        '<div class="modal-footer" style="display:flex;gap:8px;justify-content:flex-end;">' +
        '<button type="button" class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
        '<button type="button" class="btn btn-primary" onclick="void window.cchRfqSubmitFromModal()">Create drafts &amp; preview</button>' +
        '</div></div></div>';

      vendorNames.forEach(function (vName, vi) {
        if (vName === '(No vendor)') return;
        if (typeof window.cchPoVendorContactResolved !== 'function') return;
        window.cchPoVendorContactResolved({ vendor: vName }).then(function (c) {
          var inp = document.querySelector('.cch-rfq-email[data-vi="' + vi + '"]');
          if (inp && c && c.email && !inp.value) inp.value = c.email;
        }).catch(function () {});
      });
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert((e && e.message) || e, 'Request Pricing');
    }
  };

  window.cchRfqSubmitFromModal = async function () {
    var draft = window._cchRfqDraft;
    if (!draft) return;
    var projectId = draft.projectId;
    var proposalId = draft.proposalId;
    var included = [];
    document.querySelectorAll('.cch-rfq-inc').forEach(function (cb) {
      if (!cb.checked) return;
      var idx = parseInt(cb.getAttribute('data-idx'), 10);
      var qtyEl = document.querySelector('.cch-rfq-qty[data-idx="' + idx + '"]');
      var qty = parseFloat(qtyEl && qtyEl.value) || 1;
      if (qty < 1) qty = 1;
      included.push({ idx: idx, qty: qty });
    });
    if (!included.length) {
      if (typeof window.cchAlert === 'function') await window.cchAlert('Select at least one product.', 'Request Pricing');
      return;
    }
    var byVendor = {};
    included.forEach(function (sel) {
      var it = draft.eligible.filter(function (r) { return r.idx === sel.idx; })[0];
      if (!it) return;
      var v = rfqVendor(it.item) || '(No vendor)';
      if (!byVendor[v]) byVendor[v] = [];
      byVendor[v].push({ idx: sel.idx, item: it.item, qty: sel.qty });
    });
    var created = [];
    try {
      var vendorKeys = Object.keys(byVendor);
      for (var vxi = 0; vxi < vendorKeys.length; vxi++) {
        var vName = vendorKeys[vxi];
        var vSlot = draft.vendorNames ? draft.vendorNames.indexOf(vName) : vxi;
        var emailEl = vSlot >= 0 ? document.querySelector('.cch-rfq-email[data-vi="' + vSlot + '"]') : null;
        var neededEl = vSlot >= 0 ? document.querySelector('.cch-rfq-needed[data-vi="' + vSlot + '"]') : null;
        var noteEl = vSlot >= 0 ? document.querySelector('.cch-rfq-note[data-vi="' + vSlot + '"]') : null;
        var vendorEmail = String(emailEl && emailEl.value || '').trim();
        var neededBy = String(neededEl && neededEl.value || '').trim();
        var note = String(noteEl && noteEl.value || '').trim();
        var rfqNumber = typeof window.getNextDocNumber === 'function'
          ? await window.getNextDocNumber('RFQ')
          : ('RFQ-TEMP-' + Date.now());
        var rfqItems = byVendor[vName].map(function (row) {
          var it = row.item || {};
          return {
            sourceIndex: row.idx,
            lineId: lineKey(it, row.idx),
            clipId: String(it.clipId || it.roomClipId || '').trim(),
            libraryProductId: String(it.libraryProductId || it.linkedLibraryProductId || '').trim(),
            title: rfqTitle(it),
            vendor: rfqVendor(it),
            sku: rfqSku(it),
            finish: rfqFinish(it),
            dimensions: rfqDimensions(it),
            qty: row.qty,
            imageUrl: rfqImage(it),
            images: Array.isArray(it.images) ? it.images : (rfqImage(it) ? [rfqImage(it)] : []),
            unitPriceQuoted: null,
            leadTimeQuoted: null
          };
        });
        var payload = {
          rfqNumber: rfqNumber,
          vendor: vName === '(No vendor)' ? '' : vName,
          vendorEmail: vendorEmail,
          status: 'Draft',
          neededBy: neededBy,
          note: note,
          items: rfqItems,
          source: 'proposal',
          sourceProposalId: proposalId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        var ref = await firebase.firestore().collection('boards').doc(projectId).collection('rfqs').add(payload);
        created.push({ id: ref.id, rfqNumber: rfqNumber, vendor: payload.vendor, vendorEmail: vendorEmail, neededBy: neededBy, items: rfqItems });
      }
      if (typeof window.closeModal === 'function') window.closeModal();
      var nums = created.map(function (c) { return c.rfqNumber; }).join(', ');
      if (typeof window.showToast === 'function') window.showToast('RFQ draft' + (created.length > 1 ? 's' : '') + ': ' + nums);
      window.cchRfqPreviewSheets(projectId, created);
    } catch (e) {
      if (typeof window.cchAlert === 'function') await window.cchAlert((e && e.message) || e, 'Request Pricing');
    }
  };

  window.cchRfqPreviewSheets = function (projectId, created) {
    created = created || [];
    if (!created.length) return;
    var opts = typeof window.defaultTearSheetOpts === 'function' ? window.defaultTearSheetOpts() : {};
    opts = Object.assign({}, opts, {
      rfqMode: true,
      sku: true,
      dimensions: true,
      finishMaterial: true,
      pricing: false,
      internalNotes: false,
      additionalNotes: false,
      additionalDetails: false,
      description: false,
      header: true,
      confidentialFooter: false
    });
    var today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    var projName = '';
    try {
      var T = document.getElementById('pageTitle');
      if (T) projName = String(T.textContent || '').trim();
    } catch (_e) {}
    var pages = '';
    var itemCount = 0;
    created.forEach(function (rfq) {
      (rfq.items || []).forEach(function (it, i) {
        var fakeLine = {
          title: it.title,
          vendor: it.vendor,
          sku: it.sku,
          finish: it.finish,
          dimensions: it.dimensions,
          qty: it.qty,
          imageUrl: it.imageUrl,
          images: it.images
        };
        var pack = typeof window._tearSheetResolveLine === 'function'
          ? window._tearSheetResolveLine(fakeLine, i, 'proposals')
          : { heroUrl: it.imageUrl || '', extras: [], meta: { productName: it.title, vendor: it.vendor, sku: it.sku, dimensions: it.dimensions, finishMaterial: it.finish } };
        if (!pack.heroUrl && it.imageUrl) pack.heroUrl = it.imageUrl;
        pack.meta = pack.meta || {};
        pack.meta.sku = it.sku || pack.meta.sku;
        pack.meta.dimensions = it.dimensions || pack.meta.dimensions;
        pack.meta.finishMaterial = it.finish || pack.meta.finishMaterial;
        pack.meta.rfqQty = it.qty;
        pack.meta.pricingQty = it.qty;
        pack.meta.rfqNeededBy = rfq.neededBy || '';
        pack.meta.pricingUnit = 0;
        pack.meta.pricingTotal = 0;
        var label = (rfq.rfqNumber || 'RFQ') + (rfq.vendor ? (' · ' + rfq.vendor) : '') + ' · Request for pricing';
        var ctxName = (projName ? (projName + ' · ') : '') + label;
        pages += window._tearSheetPageHtml(pack.heroUrl, pack.extras, pack.meta, opts, { projectName: ctxName, today: today });
        itemCount++;
      });
    });
    var css = typeof window._getTearSheetCSSRedesign === 'function' ? window._getTearSheetCSSRedesign() : '';
    var fonts = typeof window._tearSheetFontLinkHtml === 'function' ? window._tearSheetFontLinkHtml() : '';
    var first = created[0] || {};
    var mailtoEmail = String(first.vendorEmail || '').trim();
    var subj = encodeURIComponent('[CCH Design] Request for pricing' + (first.rfqNumber ? (' — ' + first.rfqNumber) : ''));
    var body = encodeURIComponent('Hello,\n\nPlease quote trade cost and lead time for the attached items.\nSKU, finish, and dimensions are listed on each sheet.\n\nThank you,\nCCH Design Inc.');
    var mailHref = 'mailto:' + encodeURIComponent(mailtoEmail) + '?subject=' + subj + '&body=' + body;
    var w = window.open('', '_blank');
    if (!w) {
      if (typeof window.showToast === 'function') window.showToast('Pop-up blocked — allow pop-ups', 'error');
      return;
    }
    w.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Request for pricing</title>' + fonts +
      '<style>' + css + '</style></head><body>' +
      '<div class="toolbar" id="tsToolbar">' +
        '<div class="toolbar-title">Request for pricing · ' + itemCount + ' item' + (itemCount === 1 ? '' : 's') + '</div>' +
        '<div class="toolbar-actions">' +
          '<button class="tb-btn" onclick="window.print()">Print / PDF</button>' +
          (mailtoEmail ? ('<a class="tb-btn" href="' + mailHref + '" style="text-decoration:none;display:inline-block;">Email vendor</a>') : '') +
        '</div></div>' +
      pages + '</body></html>');
    w.document.close();
  };
})();
