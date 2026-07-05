/**
 * FFE Procurement tracker — column picker, print/export, PO vendor-invoice enrichment.
 */
(function() {
  'use strict';

  var PREFS_KEY = 'cchFfeProcColumnPrefs_v1';

  var FFE_PROC_COLUMNS = [
    { id: 'image', label: 'Image', group: 'Item', defaultScreen: true, defaultPrint: true, sortField: null },
    { id: 'title', label: 'Item', group: 'Item', defaultScreen: true, defaultPrint: true, sortField: 'title' },
    { id: 'description', label: 'Description', group: 'Item', defaultScreen: false, defaultPrint: false, sortField: null },
    { id: 'sku', label: 'SKU', group: 'Item', defaultScreen: false, defaultPrint: true, sortField: null },
    { id: 'vendor', label: 'Vendor', group: 'Details', defaultScreen: true, defaultPrint: true, sortField: 'vendor' },
    { id: 'room', label: 'Room', group: 'Details', defaultScreen: true, defaultPrint: true, sortField: 'room' },
    { id: 'category', label: 'Category', group: 'Details', defaultScreen: true, defaultPrint: true, sortField: 'category' },
    { id: 'cost', label: 'Cost', group: 'Financials', defaultScreen: true, defaultPrint: false, sortField: 'cost' },
    { id: 'markup', label: 'Markup', group: 'Financials', defaultScreen: true, defaultPrint: false, sortField: null },
    { id: 'clientPrice', label: 'Client Price', group: 'Financials', defaultScreen: true, defaultPrint: false, sortField: 'clientPrice' },
    { id: 'qty', label: 'Qty', group: 'Financials', defaultScreen: false, defaultPrint: false, sortField: 'qty' },
    { id: 'poNum', label: 'PO #', group: 'Documents', defaultScreen: true, defaultPrint: true, sortField: null },
    { id: 'vendorInvNum', label: 'Vendor inv #', group: 'Documents', defaultScreen: true, defaultPrint: true, sortField: null },
    { id: 'selectionStatus', label: 'Selection', group: 'Order Tracking', defaultScreen: true, defaultPrint: true, sortField: null, interactive: true },
    { id: 'orderStatus', label: 'Order Status', group: 'Order Tracking', defaultScreen: true, defaultPrint: true, sortField: null, interactive: true },
    { id: 'installStatus', label: 'Install', group: 'Order Tracking', defaultScreen: true, defaultPrint: true, sortField: null, interactive: true },
    { id: 'orderDate', label: 'Order Date', group: 'Order Tracking', defaultScreen: false, defaultPrint: true, sortField: null },
    { id: 'etaDate', label: 'ETA', group: 'Order Tracking', defaultScreen: true, defaultPrint: true, sortField: null },
    { id: 'leadTime', label: 'Lead Time', group: 'Order Tracking', defaultScreen: true, defaultPrint: true, sortField: null },
    { id: 'trackingNumber', label: 'Tracking #', group: 'Order Tracking', defaultScreen: true, defaultPrint: true, sortField: null },
    { id: 'trackingCarrier', label: 'Carrier', group: 'Order Tracking', defaultScreen: false, defaultPrint: true, sortField: null },
    { id: 'shipmentNotes', label: 'Shipment Notes', group: 'Order Tracking', defaultScreen: true, defaultPrint: true, sortField: null },
    { id: 'actions', label: '', group: 'Actions', defaultScreen: true, defaultPrint: false, sortField: null, screenOnly: true }
  ];

  function esc(s) {
    return typeof window.esc === 'function' ? window.esc(s) : String(s == null ? '' : s);
  }
  function escAttr(s) {
    return typeof window.escAttr === 'function' ? window.escAttr(s) : esc(s);
  }
  function escJs(s) {
    return typeof window.escJs === 'function' ? window.escJs(s) : escAttr(s);
  }
  function formatMoney(n) {
    return typeof window.formatMoney === 'function' ? window.formatMoney(n) : String(n);
  }
  function formatDate(d) {
    return typeof window.formatDate === 'function' ? window.formatDate(d) : String(d || '');
  }
  function parseMoney(v) {
    return typeof window.parseMoney === 'function' ? window.parseMoney(v) : (parseFloat(v) || 0);
  }

  function defaultPrefs() {
    var screen = {};
    var print = {};
    FFE_PROC_COLUMNS.forEach(function(col) {
      screen[col.id] = col.defaultScreen !== false;
      print[col.id] = col.defaultPrint !== false;
    });
    return { screen: screen, print: print };
  }

  function loadPrefs() {
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      if (!raw) return defaultPrefs();
      var parsed = JSON.parse(raw);
      var base = defaultPrefs();
      FFE_PROC_COLUMNS.forEach(function(col) {
        if (parsed.screen && typeof parsed.screen[col.id] === 'boolean') base.screen[col.id] = parsed.screen[col.id];
        if (parsed.print && typeof parsed.print[col.id] === 'boolean') base.print[col.id] = parsed.print[col.id];
      });
      return base;
    } catch (_e) {
      return defaultPrefs();
    }
  }

  function savePrefs(prefs) {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (_e) {}
  }

  function visibleColumns(mode) {
    var prefs = loadPrefs();
    var bucket = mode === 'print' ? prefs.print : prefs.screen;
    return FFE_PROC_COLUMNS.filter(function(col) {
      if (mode === 'print' && col.screenOnly) return false;
      return bucket[col.id] !== false;
    });
  }

  function groupedColumnDefs() {
    var groups = [];
    var seen = {};
    FFE_PROC_COLUMNS.forEach(function(col) {
      if (col.screenOnly && col.id === 'actions') return;
      if (!seen[col.group]) {
        seen[col.group] = true;
        groups.push({ name: col.group, cols: FFE_PROC_COLUMNS.filter(function(c) { return c.group === col.group && c.id !== 'actions'; }) });
      }
    });
    return groups;
  }

  function columnModalHtml(mode) {
    var prefs = loadPrefs();
    var bucketKey = mode === 'print' ? 'print' : 'screen';
    var title = mode === 'print' ? 'Print / Export columns' : 'Item properties — show columns';
    var hint = mode === 'print'
      ? 'Choose columns for print and CSV export. Financial columns are off by default.'
      : 'Toggle columns on the procurement tracker (like Houzz Item Properties).';

    var body = groupedColumnDefs().map(function(grp) {
      var checks = grp.cols.map(function(col) {
        var checked = prefs[bucketKey][col.id] !== false;
        return '<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;cursor:pointer;">' +
          '<input type="checkbox" class="cch-ffe-col-cb" data-col="' + escAttr(col.id) + '"' + (checked ? ' checked' : '') + '>' +
          esc(col.label || col.id) +
          '</label>';
      }).join('');
      return '<div style="margin-bottom:14px;"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9CA3AF;margin-bottom:6px;">' + esc(grp.name) + '</div>' + checks + '</div>';
    }).join('');

    var footer = mode === 'print'
      ? '<button type="button" class="btn btn-secondary" onclick="this.closest(\'.modal-overlay\').remove()">Cancel</button>' +
        '<button type="button" class="btn btn-secondary" onclick="cchFfeApplyColumnPrefs(\'print\');cchFfeExportProcurementCsv()">Export CSV</button>' +
        '<button type="button" class="btn btn-primary" onclick="cchFfeApplyColumnPrefs(\'print\');cchFfePrintProcurement()">Print / PDF</button>'
      : '<button type="button" class="btn btn-secondary" onclick="this.closest(\'.modal-overlay\').remove()">Cancel</button>' +
        '<button type="button" class="btn btn-primary" onclick="cchFfeApplyColumnPrefs(\'screen\')">Apply</button>';

    return '<div class="modal-overlay" onclick="if(event.target===this)this.remove()">' +
      '<div class="modal" style="max-width:520px;max-height:85vh;display:flex;flex-direction:column;">' +
        '<div class="modal-header"><h3 style="font-family:var(--font-display);font-size:20px;font-weight:400;">' + esc(title) + '</h3>' +
          '<button class="modal-close" onclick="this.closest(\'.modal-overlay\').remove()">&times;</button></div>' +
        '<div class="modal-body" style="overflow:auto;flex:1;"><p style="font-size:12px;color:var(--gray-500);margin:0 0 14px;">' + esc(hint) + '</p>' + body + '</div>' +
        '<div class="modal-footer" style="display:flex;gap:8px;justify-content:flex-end;">' + footer + '</div>' +
      '</div></div>';
  }

  window.cchFfeShowItemPropertiesModal = function() {
    var el = document.createElement('div');
    el.innerHTML = columnModalHtml('screen');
    document.body.appendChild(el.firstElementChild);
  };

  window.cchFfeShowPrintExportModal = function() {
    var el = document.createElement('div');
    el.innerHTML = columnModalHtml('print');
    document.body.appendChild(el.firstElementChild);
  };

  window.cchFfeApplyColumnPrefs = function(mode) {
    var overlay = document.querySelector('.modal-overlay');
    var prefs = loadPrefs();
    var bucketKey = mode === 'print' ? 'print' : 'screen';
    if (overlay) {
      overlay.querySelectorAll('.cch-ffe-col-cb').forEach(function(cb) {
        var id = cb.getAttribute('data-col');
        if (id) prefs[bucketKey][id] = cb.checked;
      });
    }
    savePrefs(prefs);
    if (overlay) overlay.remove();
    if (mode === 'screen' && typeof window.renderFFETab === 'function') {
      window.renderFFETab(document.getElementById('projectTabContent'), { id: window.currentProjectId });
    }
  };

  function clipRowValues(clip, proj) {
    var cost = parseMoney(clip.cost || clip.costPrice || clip.tradeCost || clip.unitCost || clip.unitSellingPrice);
    var sell = parseMoney(clip.clientPrice || clip.sellPrice || clip.totalSellingPrice || clip.totalSelling || clip.price);
    var qty = parseFloat(clip.qty || clip.sellingQty || clip.sellingQuantity) || 1;
    var markup = parseFloat(clip.markupPct || clip.markupPercent || clip.markup) || 0;
    var meta = clip._poVendorMeta || {};
    var imgSrc = clip.imageUrl || (typeof window._firstCoercedGalleryUrl === 'function' ? window._firstCoercedGalleryUrl(clip) : '') || '';
    var trackDisplay = meta.trackingNumber
      ? ((meta.trackingCarrier ? meta.trackingCarrier + ' ' : '') + meta.trackingNumber)
      : (clip.trackingNumber || '');
    return {
      image: imgSrc,
      title: clip.title || 'Untitled',
      description: clip.description || '',
      sku: clip.sku || '',
      vendor: clip.vendor || '',
      room: clip.room || '',
      category: clip.category || '',
      cost: cost,
      markup: markup,
      clientPrice: sell,
      qty: qty,
      poNum: clip.poNum || clip.houzzPO || '',
      vendorInvNum: meta.vendorInvoiceNumber || clip.vendorInvNum || clip.invNum || '',
      selectionStatus: clip.selectionStatus || clip.approvalStatus || clip.status || 'Proposed',
      orderStatus: meta.deliveryStatus || clip.orderStatus || '',
      installStatus: clip.installStatus || '',
      orderDate: clip.orderDate || '',
      etaDate: meta.etaDate || clip.etaDate || '',
      leadTime: clip.leadTime || '',
      trackingNumber: trackDisplay,
      trackingCarrier: meta.trackingCarrier || clip.trackingCarrier || '',
      shipmentNotes: meta.shipmentNotes || clip.shipmentNotes || clip.notes || ''
    };
  }

  function renderCell(col, clip, vals, proj, mode) {
    var _pid = escAttr(proj.id);
    var _cid = escAttr(clip.id);
    var isPrint = mode === 'print';

    if (col.id === 'image') {
      if (isPrint) {
        return vals.image
          ? '<img src="' + (typeof window._escImgSrcAttr === 'function' ? window._escImgSrcAttr(vals.image) : escAttr(vals.image)) + '" style="width:28px;height:28px;object-fit:cover;">'
          : '—';
      }
      return vals.image
        ? '<img src="' + (typeof window._escImgSrcAttr === 'function' ? window._escImgSrcAttr(vals.image) : escAttr(vals.image)) + '" style="width:32px;height:32px;border-radius:4px;object-fit:cover;" referrerpolicy="no-referrer">'
        : '<div style="width:32px;height:32px;background:var(--gray-100);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:14px;">📦</div>';
    }

    if (col.id === 'title') {
      if (isPrint) return '<strong>' + esc(vals.title) + '</strong>';
      return '<strong>' + esc(vals.title) + '</strong>' + (vals.sku ? '<br><span style="font-size:10px;color:var(--gray-500);">SKU: ' + esc(vals.sku) + '</span>' : '');
    }

    if (col.id === 'description') {
      var d = String(vals.description || '').substring(0, isPrint ? 200 : 120);
      return d ? esc(d) : '—';
    }

    if (col.id === 'sku') return vals.sku ? esc(vals.sku) : '—';

    if (col.id === 'vendor' || col.id === 'room' || col.id === 'category') {
      var v = vals[col.id];
      if (isPrint) return v ? esc(v) : '—';
      return '<span class="inline-edit-cell" onclick="ffeInlineEdit(this,\'' + _pid + '\',\'' + _cid + '\',\'' + col.id + '\',\'' + escAttr(v) + '\',\'text\')">' + (v ? esc(v) : '—') + '</span>';
    }

    if (col.id === 'cost') {
      if (isPrint) return vals.cost > 0 ? formatMoney(vals.cost) : '—';
      return '<span class="inline-edit-cell" onclick="ffeInlineEdit(this,\'' + _pid + '\',\'' + _cid + '\',\'cost\',\'' + (vals.cost || '') + '\',\'number\')">' +
        (vals.cost > 0 ? formatMoney(vals.cost) : '—') + (vals.qty > 1 ? '<br><span style="font-size:10px;color:var(--gray-500);">x' + vals.qty + '</span>' : '') + '</span>';
    }

    if (col.id === 'markup') return vals.markup > 0 ? vals.markup + '%' : '—';

    if (col.id === 'clientPrice') {
      if (isPrint) return vals.clientPrice > 0 ? formatMoney(vals.clientPrice) : '—';
      return '<span class="inline-edit-cell" onclick="ffeInlineEdit(this,\'' + _pid + '\',\'' + _cid + '\',\'clientPrice\',\'' + (vals.clientPrice || '') + '\',\'number\')">' +
        '<span style="color:var(--green);font-weight:600;">' + (vals.clientPrice > 0 ? formatMoney(vals.clientPrice) : '—') + '</span></span>';
    }

    if (col.id === 'qty') return String(vals.qty);

    if (col.id === 'poNum') {
      return vals.poNum
        ? (isPrint ? esc(vals.poNum) : '<span style="color:var(--cyan);font-weight:600;">' + esc(vals.poNum) + '</span>')
        : '—';
    }

    if (col.id === 'vendorInvNum') return vals.vendorInvNum ? esc(vals.vendorInvNum) : '—';

    if (col.id === 'selectionStatus') {
      if (isPrint) return esc(vals.selectionStatus);
      var selectionStatuses = ['Proposed', 'Approved', 'Ordered', 'Received', 'Installed', 'Returned'];
      var statusColors = { Proposed: '#6B7280', Approved: '#C4A464', Ordered: '#5EC6C6', Received: '#60A5FA', Installed: '#5FA56B', Returned: '#E16A5B' };
      var stColor = statusColors[vals.selectionStatus] || '#6B7280';
      return '<select style="font-size:10px;padding:3px 6px;border:1px solid ' + stColor + '44;background:' + stColor + '15;color:' + stColor + ';font-weight:600;cursor:pointer;width:90px;" onchange="ffeUpdateSelectionStatus(\'' + _pid + '\',\'' + _cid + '\',this.value)">' +
        selectionStatuses.map(function(s) {
          return '<option value="' + s + '"' + (vals.selectionStatus === s ? ' selected' : '') + '>' + s + '</option>';
        }).join('') + '</select>';
    }

    if (col.id === 'orderStatus') {
      if (isPrint) return vals.orderStatus ? esc(vals.orderStatus) : '—';
      var orderStatuses = ['Ordered', 'Shipped', 'At Receiver', 'At Workroom', 'Received', 'Installed', 'Cancelled'];
      var extraOpt = vals.orderStatus && orderStatuses.indexOf(vals.orderStatus) < 0
        ? '<option value="' + escAttr(vals.orderStatus) + '" selected>' + esc(vals.orderStatus) + '</option>'
        : '';
      return '<select class="form-input" style="font-size:10px;padding:3px 6px;width:100px;" onchange="ffeUpdateOrderStatus(\'' + _pid + '\',\'' + _cid + '\',this.value)">' +
        '<option value="">—</option>' + extraOpt +
        orderStatuses.map(function(s) {
          return '<option value="' + s + '"' + (vals.orderStatus === s ? ' selected' : '') + '>' + s + '</option>';
        }).join('') + '</select>';
    }

    if (col.id === 'installStatus') {
      if (isPrint) return vals.installStatus ? esc(vals.installStatus) : '—';
      var installStatuses = ['Pending', 'Scheduled', 'In Progress', 'Installed', 'Punch List'];
      return '<select class="form-input" style="font-size:10px;padding:3px 6px;width:100px;" onchange="ffeUpdateInstallStatus(\'' + _pid + '\',\'' + _cid + '\',this.value)">' +
        '<option value="">—</option>' +
        installStatuses.map(function(s) {
          return '<option value="' + s + '"' + (vals.installStatus === s ? ' selected' : '') + '>' + s + '</option>';
        }).join('') + '</select>';
    }

    if (col.id === 'orderDate' || col.id === 'etaDate') {
      var dt = vals[col.id];
      return dt ? esc(formatDate(dt)) : '—';
    }

    if (col.id === 'leadTime') {
      if (isPrint) return vals.leadTime ? esc(vals.leadTime) : '—';
      return '<span class="inline-edit-cell" style="font-size:11px;color:var(--gray-400);" onclick="ffeInlineEdit(this,\'' + _pid + '\',\'' + _cid + '\',\'leadTime\',\'' + escAttr(vals.leadTime) + '\',\'text\')">' + (vals.leadTime ? esc(vals.leadTime) : '—') + '</span>';
    }

    if (col.id === 'trackingNumber' || col.id === 'trackingCarrier' || col.id === 'shipmentNotes') {
      var tv = vals[col.id];
      return tv ? esc(tv) : '—';
    }

    if (col.id === 'actions') {
      return '<button onclick="showClipDetail(\'' + _pid + '\',\'' + _cid + '\')" style="border:none;background:none;cursor:pointer;font-size:14px;color:var(--gold);padding:2px 4px;" title="Edit all details">✏️</button>';
    }

    return '—';
  }

  window.cchFfeEnrichClipsFromPos = function(clips, pos) {
    var poByNum = {};
    var poById = {};
    (pos || []).forEach(function(po) {
      poById[po.id] = po;
      var n = po.number || po.num;
      if (n) poByNum[String(n).trim()] = po;
    });
    (clips || []).forEach(function(c) {
      var po = null;
      if (c.poId || c.purchaseOrderId) po = poById[c.poId || c.purchaseOrderId];
      if (!po) {
        var cn = String(c.poNum || c.houzzPO || '').trim();
        if (cn) po = poByNum[cn];
      }
      if (po && typeof window.cchPoVendorInvoiceMetaForClip === 'function') {
        c._poVendorMeta = window.cchPoVendorInvoiceMetaForClip(po, c) || null;
      }
    });
  };

  window.cchFfeRenderProcurementView = function(filtered, allClips, proj, pos) {
    window._ffeProcExportCtx = { proj: proj, rows: filtered, pos: pos, savedAt: new Date().toISOString() };

    if (!filtered.length) {
      return '<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-text">No items match current filters.</div></div>';
    }

    var cols = visibleColumns('screen');
    var sortHdr = function(field, label) {
      if (typeof window.ffeSortArrow !== 'function') return '<th style="font-size:11px;padding:8px 6px;">' + esc(label) + '</th>';
      return '<th style="cursor:pointer;user-select:none;white-space:nowrap;font-size:11px;padding:8px 6px;" onclick="ffeSort(\'' + escJs(field) + '\')">' + label + window.ffeSortArrow(field) + '</th>';
    };

    var head = cols.map(function(col) {
      if (col.id === 'image') return '<th style="width:36px;padding:8px 4px;"></th>';
      if (col.sortField) return sortHdr(col.sortField, col.label);
      return '<th style="font-size:11px;padding:8px 6px;white-space:nowrap;">' + esc(col.label) + '</th>';
    }).join('');

    var body = filtered.map(function(clip) {
      var vals = clipRowValues(clip, proj);
      var cells = cols.map(function(col) {
        return '<td style="padding:6px;font-size:12px;' + (col.id === 'title' ? 'max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' : '') + '">' +
          renderCell(col, clip, vals, proj, 'screen') + '</td>';
      }).join('');
      return '<tr style="border-bottom:1px solid rgba(15,26,46,0.06);">' + cells + '</tr>';
    }).join('');

    return '<div class="card" style="padding:0;overflow:hidden;">' +
      '<div class="table-wrap" style="overflow-x:auto;">' +
      '<table class="data-table ffe-table cch-ffe-proc-table" style="width:100%;font-size:14px;min-width:1100px;">' +
      '<thead><tr style="background:var(--gray-50);">' + head + '</tr></thead><tbody>' + body + '</tbody></table></div></div>';
  };

  function csvEscape(v) {
    var s = String(v == null ? '' : v);
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  window.cchFfeExportProcurementCsv = function() {
    var ctx = window._ffeProcExportCtx;
    if (!ctx || !ctx.rows || !ctx.rows.length) {
      if (typeof window.showToast === 'function') window.showToast('No procurement rows to export', 'error');
      return;
    }
    var cols = visibleColumns('print').filter(function(c) { return c.id !== 'image' && c.id !== 'actions'; });
    var lines = [cols.map(function(c) { return csvEscape(c.label || c.id); }).join(',')];
    ctx.rows.forEach(function(clip) {
      var vals = clipRowValues(clip, ctx.proj);
      lines.push(cols.map(function(col) {
        if (col.id === 'cost' || col.id === 'clientPrice') return csvEscape(vals[col.id] > 0 ? vals[col.id] : '');
        if (col.id === 'orderDate' || col.id === 'etaDate') return csvEscape(vals[col.id] ? formatDate(vals[col.id]) : '');
        return csvEscape(vals[col.id] != null ? vals[col.id] : '');
      }).join(','));
    });
    var blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'FFE_Procurement_' + (ctx.proj.name || ctx.proj.id || 'project') + '_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    if (typeof window.showToast === 'function') window.showToast('CSV exported', 'success');
  };

  window.cchFfePrintProcurement = function() {
    var ctx = window._ffeProcExportCtx;
    if (!ctx || !ctx.rows || !ctx.rows.length) {
      if (typeof window.showToast === 'function') window.showToast('No procurement rows to print', 'error');
      return;
    }
    var cols = visibleColumns('print').filter(function(c) { return c.id !== 'actions'; });
    var projLabel = esc(ctx.proj.name || ctx.proj.id || 'Project');
    var head = cols.map(function(col) {
      return '<th style="padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;border-bottom:1px solid #ccc;">' + esc(col.label || (col.id === 'image' ? 'Img' : col.id)) + '</th>';
    }).join('');
    var body = ctx.rows.map(function(clip) {
      var vals = clipRowValues(clip, ctx.proj);
      return '<tr>' + cols.map(function(col) {
        return '<td style="padding:6px 8px;font-size:11px;border-bottom:1px solid #eee;vertical-align:top;">' + renderCell(col, clip, vals, ctx.proj, 'print') + '</td>';
      }).join('') + '</tr>';
    }).join('');

    var win = window.open('', '_blank');
    if (!win) {
      if (typeof window.showToast === 'function') window.showToast('Allow pop-ups to print', 'error');
      return;
    }
    win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>FFE Procurement — ' + projLabel + '</title>' +
      '<style>body{font-family:DM Sans,Arial,sans-serif;padding:24px;color:#0F1A2E;}h1{font-size:18px;margin:0 0 4px;} .meta{font-size:11px;color:#666;margin-bottom:16px;} table{border-collapse:collapse;width:100%;} @media print{.toolbar{display:none!important}}</style></head><body>' +
      '<div class="toolbar" style="margin-bottom:16px;"><button onclick="window.print()" style="padding:8px 16px;cursor:pointer;">Print / Save PDF</button></div>' +
      '<h1>FFE Procurement Tracker</h1><div class="meta">' + projLabel + ' · ' + ctx.rows.length + ' item(s) · ' + new Date().toLocaleString() + '</div>' +
      '<table><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></body></html>');
    win.document.close();
  };

  /** FFE furnishing products only — excludes design services, expenses, tax (mirrors Selections). */
  window.cchFfeFilterProductClipsOnly = function(clips) {
    var NON_PRODUCT_TYPES = ['service', 'shipping', 'sales_tax', 'handling', 'expense', 'discount', 'labor', 'other_expense'];
    var BAD_CATS = ['time billing', 'time track', 'time tracking', 'service', 'services', 'expense', 'expenses',
      'design services', 'design service', 'blended design services', 'blended design fees', 'consultation',
      'professional services', 'uncategorized', 'taxes', 'freight', 'shipping', 'design fees', 'design fee'];
    function badCat(s) {
      var c = String(s || '').toLowerCase().trim();
      return c && BAD_CATS.indexOf(c) >= 0;
    }
    return (clips || []).filter(function(c) {
      if (!c) return false;
      if (typeof window.boardClipIsTimeBillingRow === 'function' && window.boardClipIsTimeBillingRow(c)) return false;
      var et = String(c.expenseType || '').toLowerCase();
      if (et && NON_PRODUCT_TYPES.indexOf(et) >= 0) return false;
      if (badCat(c.category) || badCat(c.room)) return false;
      var titleAndDesc = (String(c.title || c.name || '') + ' ' + String(c.description || '') + ' ' + String(c.notes || '')).toLowerCase();
      if (/\b(time billing|time track|time tracking|freight|shipping|delivery|handling|sales tax|pre\s*paid tax|prepaid tax|service fee|design fee|consultation|retainer|blended service|mood board|design concept|project meeting|client project service|reimbursable|pass\s*through)\b/.test(titleAndDesc)) return false;
      var t = String(c.title || c.name || '').trim().toLowerCase();
      if (t === 'expense' || t === 'expenses' || t === 'labor' || t === 'labour' || t === 'service' || t === 'services') return false;
      if (/^cch\s+/.test(t) && /\b(service|meeting|concept|billing|mood|client project)\b/.test(titleAndDesc)) return false;
      if (typeof window.isRealProduct === 'function') {
        return window.isRealProduct({
          title: c.title, category: c.category, room: c.room,
          vendor: c.vendor, manufacturer: c.manufacturer || '', sku: c.sku || '',
          cost: c.cost, clientPrice: c.clientPrice || c.totalSelling,
          imageUrl: c.imageUrl, image: c.image || c.img,
          libraryItemKind: c.libraryItemKind, itemKind: c.itemKind
        });
      }
      return true;
    });
  };

})();
