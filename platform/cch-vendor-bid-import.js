// CCH Studio — proposal page: Import vendor bid (PDF)
// Generic priced-row extractor. Vendor letterhead does not matter.
// Bartolo *** sections still group when present. NO TEMPLATE LITERALS
(function(root) {
  'use strict';

  var DEFAULT_MARKUP_PCT = 25;

  function _vbEsc(t) {
    if (typeof root.esc === 'function') return root.esc(t);
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _vbNormLine(raw) {
    return String(raw || '')
      .replace(/\uE5AF/g, '')
      .replace(/[\u2018\u2019\u0060\u00B4]/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  function _vbIsDocChrome(ln) {
    if (!ln || ln === '.') return true;
    if (/^Page \d+(\s+of\s+\d+)?$/i.test(ln)) return true;
    if (/^(INVOICE|ESTIMATE|QUOTE|QUOTATION|PROPOSAL|PURCHASE ORDER|BILL TO|SHIP TO|SOLD TO|ADDRESS|DESCRIPTION\s+QTY|ITEM\s+QTY|QTY\s+(AMT|AMOUNT|PRICE)|SUBTOTAL|TAX|TOTAL|BALANCE DUE|BALANCE|AMOUNT DUE|PLEASE MAKE|CUSTOMER DEPOSIT|TERMS|DUE DATE|ACCEPTED BY|ACCEPTED DATE|THANK YOU)\b/i.test(ln)) return true;
    if (/^(ESTIMATE|INVOICE|QUOTE|QUOTATION|PO)[\s#:.\-]*\d/i.test(ln)) return true;
    if (/^DATE\s+\d/i.test(ln)) return true;
    if (/^www\./i.test(ln) || /@/.test(ln) && ln.length < 80) return true;
    if (/^\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4}/.test(ln)) return true;
    if (/applicable sales tax|make checks payable/i.test(ln)) return true;
    if (/^(suite|ste\.?)\s+\d/i.test(ln)) return true;
    if (/^\d+\s+.+\s+(street|st\.?|avenue|ave\.?|drive|dr\.?|blvd|boulevard|road|rd\.?|lane|ln\.?|way|court|ct\.?)\b/i.test(ln)) return true;
    if (/^[A-Z][a-z]+,\s*[A-Z]{2}\s+\d{5}(-\d{4})?$/.test(ln)) return true;
    if (/^SUBTOTAL\b/i.test(ln) || /^TAX\b/i.test(ln) || /^TOTAL\b/i.test(ln)) return true;
    return false;
  }

  function _vbIsTableHeader(ln) {
    return /^(DESCRIPTION|ITEM|PRODUCT|QTY|QUANTITY|AMOUNT|PRICE|UNIT|TOTAL)(\s+|$)/i.test(ln) &&
      /qty|amount|price|total|description|item/i.test(ln);
  }

  function _vbIsSectionHeader(title) {
    var t = String(title || '').trim();
    if (!t || t.length > 90) return false;
    if (/^note\b/i.test(t)) return false;
    if (/^allows\s+for\b/i.test(t)) return false;
    if (/^power\s+only\b/i.test(t)) return false;
    if (/\boption\b/i.test(t)) return true;
    if (/power\s*suppl/i.test(t) || /\bcontrols?\b/i.test(t)) return true;
    if (/^room:\s*/i.test(t)) return true;
    if (t.length <= 90 && /\s-\s*/.test(t) && !/\$/.test(t)) return true;
    return false;
  }

  function _vbRoomFromSection(title) {
    var t = String(title || '').replace(/^Room:\s*/i, '').trim();
    t = t.replace(/\s*-\s*(Lutron|Somfy).*$/i, '');
    t = t.replace(/\s*(systems?\s*)?option\s*$/i, '');
    t = t.replace(/\s*systems?\s*$/i, '');
    if (/power\s*suppl|\bcontrols?\b/i.test(title) && !/office|hallway|room|kitchen|bath|bedroom/i.test(title)) return '';
    return t.trim();
  }

  function _vbClassify(title, desc) {
    var blob = (String(title || '') + ' ' + String(desc || '')).toLowerCase();
    if (/\bfreight\b|\bshipping\b|\bdelivery\b/.test(blob)) {
      return { category: 'Freight', expenseType: 'freight', taxable: false };
    }
    if (/\binstall(?:ation|er|ing)?\b|\blabor\b|\blabour\b|programing|programming|commissioning/.test(blob)) {
      return { category: 'Labor', expenseType: 'service', taxable: false };
    }
    if (/\blining\b|\binterlining\b|\bbuckram\b|\bbumper\b/.test(blob)) {
      return { category: 'Fabric & Trim', expenseType: 'product', taxable: true };
    }
    if (/\b(sheer|blackout|drapery|curtain|valance|lambrequin|roman\s+shade|roller\s+shade|sunscreen|window\s+treatment)/.test(blob)) {
      return { category: 'Custom Window Coverings', expenseType: 'product', taxable: true };
    }
    if (/\b(remote|controller|handheld|power\s*suppl|motor|track|bracket|finial|hardware)\b/.test(blob)) {
      return { category: 'Window Hardware', expenseType: 'product', taxable: true };
    }
    return { category: 'Custom Window Coverings', expenseType: 'product', taxable: true };
  }

  function _vbCategoryList() {
    var extra = ['Labor', 'Freight'];
    var master = [];
    if (typeof root.cchStrictFfeCategoryPickerList === 'function') {
      master = root.cchStrictFfeCategoryPickerList() || [];
    } else if (root.CCH_PRODUCT_CATEGORIES_MASTER) {
      master = root.CCH_PRODUCT_CATEGORIES_MASTER.slice();
    }
    var seen = {};
    var out = [];
    extra.concat(master).forEach(function(c) {
      var s = String(c || '').trim();
      if (!s) return;
      var k = s.toLowerCase();
      if (seen[k]) return;
      seen[k] = true;
      out.push(s);
    });
    return out;
  }

  function _vbApplyCategoryMeta(row) {
    if (!row || row.kind === 'group') return;
    var cat = String(row.category || '').trim();
    if (!cat) {
      var guessed = _vbClassify(row.title, row.description);
      cat = guessed.category || 'Custom Window Coverings';
    }
    var lo = cat.toLowerCase();
    if (lo === 'labor' || lo === 'installation' || lo === 'install') {
      row.category = 'Labor';
      row.expenseType = 'service';
      row.taxable = false;
      return;
    }
    if (lo === 'freight' || lo === 'shipping') {
      row.category = 'Freight';
      row.expenseType = 'freight';
      row.taxable = false;
      return;
    }
    row.category = cat;
    row.expenseType = 'product';
    row.taxable = true;
  }

  function _vbCategoryOptionsHtml(selected) {
    var sel = String(selected || '').trim();
    var list = _vbCategoryList();
    var html = '';
    var found = false;
    list.forEach(function(c) {
      var on = c === sel;
      if (on) found = true;
      html += '<option value="' + _vbEsc(c) + '"' + (on ? ' selected' : '') + '>' + _vbEsc(c) + '</option>';
    });
    if (sel && !found) {
      html = '<option value="' + _vbEsc(sel) + '" selected>' + _vbEsc(sel) + '</option>' + html;
    }
    return html;
  }

  function _vbIsTotalWord(s) {
    return /^(subtotal|tax|total|balance|deposit|amount due|grand total)$/i.test(String(s || '').trim());
  }

  /** Pull qty + line total off a text line. Vendor-agnostic (optional $). */
  function _vbParsePricedLine(ln) {
    var three = ln.match(/^(.*?)\s+(\d+)\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})$/);
    if (three && !_vbIsTotalWord(three[1])) {
      return { title: String(three[1] || '').trim(), qty: three[2], amount: three[5] };
    }
    var qtyUnitTot = ln.match(/^(.*?)\s+(\d+)\s+\$?([\d,]+\.\d{2})\s+\$?([\d,]+\.\d{2})$/);
    if (qtyUnitTot && !_vbIsTotalWord(qtyUnitTot[1])) {
      return { title: String(qtyUnitTot[1] || '').trim(), qty: qtyUnitTot[2], amount: qtyUnitTot[4] };
    }
    var qtyAmt = ln.match(/^(\d+)\s+\$?([\d,]+\.\d{2})$/);
    if (qtyAmt) return { title: '', qty: qtyAmt[1], amount: qtyAmt[2] };
    var descQtyAmt = ln.match(/^(.+?)\s+(\d+)\s+\$?([\d,]+\.\d{2})$/);
    if (descQtyAmt && !_vbIsTotalWord(descQtyAmt[1])) {
      return { title: descQtyAmt[1].trim(), qty: descQtyAmt[2], amount: descQtyAmt[3] };
    }
    var descDollar = ln.match(/^(.+?)\s+\$([\d,]+\.\d{2})$/);
    if (descDollar && !_vbIsTotalWord(descDollar[1])) {
      return { title: descDollar[1].trim(), qty: '1', amount: descDollar[2] };
    }
    var lone = ln.match(/^\$([\d,]+\.\d{2})$/);
    if (lone) return { title: '', qty: '1', amount: lone[1] };
    return null;
  }

  function _vbGuessVendor(rawLines) {
    var lines = (rawLines || []).map(_vbNormLine).filter(Boolean);
    var joined = lines.join('\n');
    var labeled = joined.match(/(?:Vendor|From|Supplier|Bill From|Remit To|Sold By|Prepared For)\s*:\s*(.+)/i);
    if (labeled) {
      var v = labeled[1].trim().split(/\s{2,}/)[0].replace(/\s+DATE\b.*/i, '').trim();
      if (v.length >= 3 && v.length <= 80) return v;
    }
    var i, ln;
    for (i = 0; i < Math.min(lines.length, 30); i++) {
      ln = lines[i];
      if (_vbIsDocChrome(ln) || _vbIsTableHeader(ln)) continue;
      if (/^(estimate|invoice|quote|quotation|proposal|purchase order)\b/i.test(ln)) break;
      if (ln.length < 4 || ln.length > 80) continue;
      if (/\$/.test(ln) || /^\d/.test(ln)) continue;
      if (/street|suite|avenue|drive|phone|fax|email|ship to|bill to/i.test(ln)) continue;
      if (/^[A-Za-z0-9]/.test(ln) && /[A-Za-z]/.test(ln)) return ln;
    }
    return '';
  }

  function parseVendorBidLines(rawLines) {
    var lines = (rawLines || []).map(_vbNormLine).filter(Boolean);
    var groups = [];
    var group = null;
    var pending = [];

    function finishGroup() {
      if (group && group.lines && group.lines.length) groups.push(group);
      group = null;
      pending = [];
    }

    function ensureGroup() {
      if (!group) {
        group = { title: 'Vendor bid', room: '', lines: [], total: 0 };
      }
    }

    var openLine = null;

    function addPricedLine(title, qtyRaw, amountRaw, desc) {
      ensureGroup();
      var qty = parseInt(qtyRaw, 10) || 1;
      var amount = parseFloat(String(amountRaw).replace(/,/g, '')) || 0;
      if (amount <= 0) return null;
      var unit = qty > 0 ? amount / qty : amount;
      var classified = _vbClassify(title, desc);
      var line = {
        title: String(title || 'Item').trim(),
        description: String(desc || '').replace(/\s+/g, ' ').trim(),
        qty: qty,
        unitCost: Math.round(unit * 100) / 100,
        amount: amount,
        room: group.room || '',
        category: classified.category,
        expenseType: classified.expenseType,
        taxable: classified.taxable !== false
      };
      group.lines.push(line);
      group.total += amount;
      return line;
    }

    function appendPendingToOpen() {
      if (!openLine || !pending.length) return;
      var extra = pending.join(' ').replace(/\s+/g, ' ').trim();
      pending = [];
      if (!extra) return;
      openLine.description = openLine.description ? (openLine.description + ' ' + extra) : extra;
    }

    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (_vbIsDocChrome(ln) || _vbIsTableHeader(ln)) {
        if (/^(SUBTOTAL|TAX|TOTAL|BALANCE|AMOUNT DUE|GRAND TOTAL)\b/i.test(ln)) {
          appendPendingToOpen();
        } else if (_vbIsTableHeader(ln) || /description\s+qty/i.test(ln)) {
          pending = [];
        }
        continue;
      }

      var stars = ln.match(/^\*{2,}\s*(.+)$/);
      if (stars) {
        var rest = stars[1].trim();
        if (_vbIsSectionHeader(rest)) {
          appendPendingToOpen();
          openLine = null;
          finishGroup();
          group = {
            title: rest,
            room: _vbRoomFromSection(rest),
            lines: [],
            total: 0
          };
          pending = [];
          continue;
        }
        pending.push(rest);
        continue;
      }

      var roomHead = ln.match(/^Room:\s*(.+)$/i);
      if (roomHead) {
        appendPendingToOpen();
        openLine = null;
        finishGroup();
        group = {
          title: roomHead[1].trim(),
          room: roomHead[1].trim(),
          lines: [],
          total: 0
        };
        pending = [];
        continue;
      }

      var priced = _vbParsePricedLine(ln);
      if (priced) {
        if (priced.title) {
          appendPendingToOpen();
          pending = [];
          openLine = addPricedLine(priced.title, priced.qty, priced.amount, '');
        } else {
          var title = pending.length ? pending[0] : 'Item';
          var desc = pending.slice(1).join(' ');
          pending = [];
          openLine = addPricedLine(title, priced.qty, priced.amount, desc);
        }
        continue;
      }

      pending.push(ln);
    }
    appendPendingToOpen();
    finishGroup();
    return groups;
  }

  function parseBartoloEstimateLines(rawLines) {
    return parseVendorBidLines(rawLines);
  }

  function detectVendorBidFormat(rawLines) {
    var text = (rawLines || []).map(_vbNormLine).filter(Boolean).join('\n');
    if (/\bESTIMATE\b/i.test(text) && /DESCRIPTION\s+QTY\s+AMOUNT/i.test(text) && /\*{2,}\S/.test(text)) {
      return 'bartolo-estimate';
    }
    if (/\bINVOICE\b/i.test(text) && /DESCRIPTION\s+QTY\s+AMOUNT/i.test(text)) {
      return 'invoice-table';
    }
    if (/\$[\d,]+\.\d{2}/.test(text) || /\d+\s+[\d,]+\.\d{2}/.test(text)) return 'priced-rows';
    return 'unknown';
  }

  function parseVendorBidPdfLines(rawLines) {
    var fmt = detectVendorBidFormat(rawLines);
    var groups = parseVendorBidLines(rawLines);
    var vendor = _vbGuessVendor(rawLines);
    if (groups.length) {
      return { format: fmt === 'unknown' ? 'priced-rows' : fmt, groups: groups, vendor: vendor };
    }
    return {
      format: 'unknown',
      groups: [],
      vendor: vendor,
      sample: (rawLines || []).map(_vbNormLine).filter(Boolean).slice(0, 35).join('\n')
    };
  }

  async function proposalPdfExtractLinesFromArrayBuffer(arrayBuffer) {
    var pdfjs = root.pdfjsLib;
    if (!pdfjs && typeof root.cpPortalEnsurePdfJs === 'function') {
      pdfjs = await root.cpPortalEnsurePdfJs();
    }
    if (!pdfjs) {
      await new Promise(function(res, rej) {
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        s.onload = res;
        s.onerror = rej;
        document.head.appendChild(s);
      });
      root.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      pdfjs = root.pdfjsLib;
    }
    var pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
    var allLines = [];
    for (var p = 1; p <= pdf.numPages; p++) {
      var page = await pdf.getPage(p);
      var tc = await page.getTextContent();
      var vp = page.getViewport({ scale: 1 });
      var items = tc.items.filter(function(it) { return it.str && String(it.str).trim(); }).map(function(it) {
        return {
          text: String(it.str).trim(),
          x: it.transform[4],
          y: vp.height - it.transform[5]
        };
      });
      items.sort(function(a, b) { return Math.abs(a.y - b.y) > 4 ? a.y - b.y : a.x - b.x; });
      var lineY = null;
      var buf = [];
      items.forEach(function(it) {
        if (lineY === null || Math.abs(it.y - lineY) > 4) {
          if (buf.length) allLines.push(buf.join(' ').replace(/\s+/g, ' ').trim());
          buf = [it.text];
          lineY = it.y;
        } else {
          buf.push(it.text);
        }
      });
      if (buf.length) allLines.push(buf.join(' ').replace(/\s+/g, ' ').trim());
    }
    return allLines;
  }

  async function proposalPdfExtractLinesFromFile(file) {
    var arrayBuffer = await file.arrayBuffer();
    return proposalPdfExtractLinesFromArrayBuffer(arrayBuffer);
  }

  function _vbFreshId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return 'li_' + crypto.randomUUID();
    return 'li_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }

  function _vbPriceLine(it) {
    it = it || {};
    it.shipping = parseFloat(it.shipping) || 0;
    if (typeof root.recalcProposalLineAmount === 'function') {
      root.recalcProposalLineAmount(it);
      return it;
    }
    var qty = (typeof root.cchParseLineQty === 'function') ? root.cchParseLineQty(it.qty, 1) : (parseFloat(it.qty) || 1);
    var cost = parseFloat(it.cost) || 0;
    var m = parseFloat(it.markupPct) || 0;
    var unit = cost * (1 + m / 100);
    if (typeof root.cchClientUnitFromCostMarkup === 'function') {
      unit = root.cchClientUnitFromCostMarkup(cost, m, it);
    } else {
      unit = Math.round(unit * 100) / 100;
    }
    it.clientPrice = unit;
    it.amount = unit * qty + it.shipping;
    return it;
  }

  function _vbMoney(n) {
    if (typeof root.formatMoney === 'function') return root.formatMoney(n);
    var x = parseFloat(n) || 0;
    return '$' + x.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function _vendorBidClose() {
    var el = document.getElementById('cchVendorBidOverlay');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    root._vendorBidState = null;
  }

  function _vendorBidBuildRows(groups, defaultMk, vendor) {
    var mk = parseFloat(defaultMk);
    if (isNaN(mk)) mk = DEFAULT_MARKUP_PCT;
    vendor = String(vendor || '').trim();
    var rows = [];
    (groups || []).forEach(function(g, gi) {
      var gid = 'vbid_' + gi + '_' + _vbFreshId();
      rows.push({
        kind: 'group',
        key: 'g' + gi,
        gi: gi,
        title: g.title || 'Group',
        groupId: gid,
        room: g.room || '',
        checked: true
      });
      (g.lines || []).forEach(function(ln, li) {
        var it = {
          kind: 'line',
          key: 'g' + gi + 'l' + li,
          gi: gi,
          li: li,
          groupId: gid,
          title: ln.title,
          description: ln.description || '',
          room: ln.room || g.room || '',
          category: ln.category || '',
          expenseType: ln.expenseType,
          taxable: ln.taxable !== false,
          qty: ln.qty,
          cost: ln.unitCost,
          markupPct: mk,
          vendor: vendor,
          checked: true
        };
        _vbApplyCategoryMeta(it);
        _vbPriceLine(it);
        rows.push(it);
      });
    });
    return rows;
  }

  function _vendorBidPaint() {
    var st = root._vendorBidState;
    var overlay = document.getElementById('cchVendorBidOverlay');
    if (!st || !overlay) return;
    var body = overlay.querySelector('[data-vbid-body]');
    if (!body) return;
    if (!st.rows) {
      var qpiFiles = Array.isArray(st.qpiFiles) ? st.qpiFiles : [];
      var qpiHtml = '';
      if (st.qpiLoading) {
        qpiHtml = '<div style="font-size:12px;color:#6B7280;padding:8px 0;">Loading QPI files\u2026</div>';
      } else if (qpiFiles.length) {
        qpiHtml = '<div style="font-size:11px;font-weight:600;color:#0A1F3D;margin:10px 0 6px;">Pick from QPI</div>';
        qpiFiles.forEach(function(f) {
          qpiHtml += '<button type="button" data-vbid-qpi="' + _vbEsc(f.id) + '" style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;margin-bottom:6px;padding:10px 12px;font-size:12px;border:1px solid #E2E2E2;background:#fff;cursor:pointer;">' +
            '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + _vbEsc(f.name || 'File') + '</span>' +
            '<span style="font-size:10px;color:#6B7280;flex-shrink:0;">QPI</span></button>';
        });
      } else {
        qpiHtml = '<div style="font-size:12px;color:#6B7280;padding:6px 0;">No PDFs in QPI yet for this project.</div>';
      }
      body.innerHTML = '<div style="font-size:13px;color:#6B7280;padding:8px 0;">Upload a vendor estimate into <strong style="color:#0A1F3D;">QPI</strong>, or pick one already there. Lines go on this proposal. The PDF stays in QPI (studio only \u2014 never on the client).</div>' +
        qpiHtml +
        '<div style="margin-top:12px;"><button type="button" data-vbid-pick class="btn btn-secondary" style="padding:8px 14px;border:1px solid #0A1F3D;background:#fff;color:#0A1F3D;cursor:pointer;">Upload to QPI</button></div>' +
        '<input type="file" data-vbid-file accept="application/pdf,.pdf" style="display:none;">';
      var pick = body.querySelector('[data-vbid-pick]');
      var fileEl = body.querySelector('[data-vbid-file]');
      if (pick && fileEl) {
        pick.onclick = function() { fileEl.click(); };
        fileEl.onchange = function() { void _vendorBidOnFile(fileEl.files && fileEl.files[0]); };
      }
      body.querySelectorAll('[data-vbid-qpi]').forEach(function(btn) {
        btn.onclick = function() { void _vendorBidOnQpiId(btn.getAttribute('data-vbid-qpi')); };
      });
      return;
    }
    if (!st.rows.length) {
      body.innerHTML = '<div style="font-size:13px;color:#B91C1C;margin-bottom:10px;">Could not read priced line items from this PDF. Nothing was added to the proposal.</div>' +
        '<pre style="white-space:pre-wrap;font-size:11px;background:#F4F6FA;padding:10px;border:1px solid #E2E2E2;max-height:240px;overflow:auto;color:#0A1F3D;">' + _vbEsc(st.sample || '') + '</pre>' +
        '<div style="margin-top:12px;"><button type="button" data-vbid-pick class="btn btn-secondary" style="padding:8px 14px;border:1px solid #0A1F3D;background:#fff;color:#0A1F3D;cursor:pointer;">Try another PDF</button></div>' +
        '<input type="file" data-vbid-file accept="application/pdf,.pdf" style="display:none;">';
      var pick2 = body.querySelector('[data-vbid-pick]');
      var fileEl2 = body.querySelector('[data-vbid-file]');
      if (pick2 && fileEl2) {
        pick2.onclick = function() { fileEl2.click(); };
        fileEl2.onchange = function() { void _vendorBidOnFile(fileEl2.files && fileEl2.files[0]); };
      }
      return;
    }
    var mkVal = parseFloat(st.defaultMk);
    if (isNaN(mkVal)) mkVal = DEFAULT_MARKUP_PCT;
    var html = '';
    html += '<div style="font-size:12px;color:#6B7280;margin-bottom:10px;">Any vendor quote. Amounts are treated as <strong style="color:#0A1F3D;">cost</strong>. Default markup is ' + DEFAULT_MARKUP_PCT + '%. Every line needs a category (Labor = installation; products = motors, lining, shades). Uncheck junk rows before import.</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;">';
    html += '<label style="font-size:12px;color:#0A1F3D;">Markup % <input type="number" data-vbid-mkall step="0.5" value="' + mkVal + '" style="width:72px;padding:4px 6px;border:1px solid #E2E2E2;"></label>';
    html += '<button type="button" data-vbid-applyall style="padding:6px 10px;border:1px solid #0A1F3D;background:#fff;color:#0A1F3D;cursor:pointer;font-size:12px;">Apply markup to all</button>';
    html += '<label style="font-size:12px;color:#0A1F3D;">Category <select data-vbid-catall style="min-width:160px;padding:4px 6px;border:1px solid #E2E2E2;">' + _vbCategoryOptionsHtml('Custom Window Coverings') + '</select></label>';
    html += '<button type="button" data-vbid-catapply style="padding:6px 10px;border:1px solid #0A1F3D;background:#fff;color:#0A1F3D;cursor:pointer;font-size:12px;">Apply category to all</button>';
    html += '<button type="button" data-vbid-allon style="padding:6px 10px;border:1px solid #E2E2E2;background:#fff;cursor:pointer;font-size:12px;">Select all</button>';
    html += '<button type="button" data-vbid-alloff style="padding:6px 10px;border:1px solid #E2E2E2;background:#fff;cursor:pointer;font-size:12px;">Select none</button>';
    html += '</div>';
    html += '<div style="max-height:min(52vh,440px);overflow:auto;border:1px solid #E2E2E2;">';
    st.rows.forEach(function(row, idx) {
      if (row.kind === 'group') {
        html += '<div style="display:flex;gap:8px;align-items:center;padding:8px 10px;background:#F4F6FA;border-bottom:1px solid #E2E2E2;font-size:13px;color:#0A1F3D;">';
        html += '<input type="checkbox" data-vbid-g="' + idx + '"' + (row.checked ? ' checked' : '') + ' title="Include this section">';
        html += '<input type="text" data-vbid-gtitle="' + idx + '" value="' + _vbEsc(row.title) + '" title="Bundle name" style="flex:1;min-width:0;padding:4px 6px;border:1px solid #E2E2E2;font-size:13px;font-weight:700;color:#0A1F3D;background:#fff;">';
        html += '<label style="display:flex;align-items:center;gap:4px;flex-shrink:0;font-size:11px;font-weight:600;color:#5C6B80;">Room <input type="text" data-vbid-groom="' + idx + '" value="' + _vbEsc(row.room || '') + '" placeholder="Room" style="width:140px;padding:4px 6px;border:1px solid #E2E2E2;font-size:12px;font-weight:600;color:#0A1F3D;"></label>';
        html += '</div>';
        return;
      }
      html += '<div style="display:grid;grid-template-columns:24px minmax(0,1.2fr) minmax(148px,168px) 44px 80px 56px 80px;gap:6px;align-items:center;padding:6px 10px;border-bottom:1px solid #F0F0F0;font-size:12px;color:#0A1F3D;">';
      html += '<input type="checkbox" data-vbid-l="' + idx + '"' + (row.checked ? ' checked' : '') + '>';
      html += '<div style="min-width:0;"><div style="font-weight:600;">' + _vbEsc(row.title) + '</div>' +
        (row.description ? '<div style="font-size:11px;color:#6B7280;margin-top:2px;">' + _vbEsc(row.description.slice(0, 180)) + (row.description.length > 180 ? '\u2026' : '') + '</div>' : '') +
        '</div>';
      html += '<select data-vbid-cat="' + idx + '" style="width:100%;padding:3px 4px;border:1px solid #E2E2E2;font-size:11px;">' + _vbCategoryOptionsHtml(row.category) + '</select>';
      html += '<div style="text-align:right;font-family:ui-monospace,monospace;">' + row.qty + '</div>';
      html += '<div style="text-align:right;font-family:ui-monospace,monospace;">' + _vbMoney(row.cost) + '</div>';
      html += '<input type="number" data-vbid-mk="' + idx + '" step="0.5" value="' + (parseFloat(row.markupPct) || 0) + '" style="width:100%;padding:3px 4px;border:1px solid #E2E2E2;text-align:right;">';
      html += '<div style="text-align:right;font-family:ui-monospace,monospace;">' + _vbMoney(row.amount) + '</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '<div style="font-size:11px;color:#6B7280;margin-top:8px;">Columns: include \u00B7 description \u00B7 category \u00B7 qty \u00B7 cost \u00B7 markup % \u00B7 client</div>';
    body.innerHTML = html;

    var mkAll = body.querySelector('[data-vbid-mkall]');
    var applyAll = body.querySelector('[data-vbid-applyall]');
    if (applyAll && mkAll) {
      applyAll.onclick = function() {
        var v = parseFloat(mkAll.value);
        if (isNaN(v)) v = DEFAULT_MARKUP_PCT;
        st.defaultMk = v;
        st.rows.forEach(function(row) {
          if (row.kind !== 'line') return;
          row.markupPct = v;
          _vbPriceLine(row);
        });
        _vendorBidPaint();
      };
    }
    var catAll = body.querySelector('[data-vbid-catall]');
    var catApply = body.querySelector('[data-vbid-catapply]');
    if (catApply && catAll) {
      catApply.onclick = function() {
        var v = String(catAll.value || '').trim();
        if (!v) return;
        st.rows.forEach(function(row) {
          if (row.kind !== 'line' || !row.checked) return;
          row.category = v;
          _vbApplyCategoryMeta(row);
        });
        _vendorBidPaint();
      };
    }
    var allOn = body.querySelector('[data-vbid-allon]');
    var allOff = body.querySelector('[data-vbid-alloff]');
    if (allOn) allOn.onclick = function() { st.rows.forEach(function(r) { r.checked = true; }); _vendorBidPaint(); };
    if (allOff) allOff.onclick = function() { st.rows.forEach(function(r) { r.checked = false; }); _vendorBidPaint(); };
    Array.prototype.forEach.call(body.querySelectorAll('[data-vbid-g]'), function(cb) {
      cb.onchange = function() {
        var idx = parseInt(cb.getAttribute('data-vbid-g'), 10);
        var row = st.rows[idx];
        if (!row || row.kind !== 'group') return;
        row.checked = !!cb.checked;
        var gid = row.groupId;
        st.rows.forEach(function(r) {
          if (r.kind === 'line' && r.groupId === gid) r.checked = row.checked;
        });
        _vendorBidPaint();
      };
    });
    function _vbStampGroupRoom(row) {
      if (!row || row.kind !== 'group') return;
      var gid = row.groupId;
      var room = String(row.room || '').trim();
      st.rows.forEach(function(r) {
        if (r.kind === 'line' && r.groupId === gid) r.room = room;
      });
    }
    Array.prototype.forEach.call(body.querySelectorAll('[data-vbid-gtitle]'), function(inp) {
      inp.onchange = function() {
        var idx = parseInt(inp.getAttribute('data-vbid-gtitle'), 10);
        var row = st.rows[idx];
        if (!row || row.kind !== 'group') return;
        row.title = String(inp.value || '').trim() || row.title;
        inp.value = row.title;
        if (!String(row.room || '').trim()) {
          row.room = _vbRoomFromSection(row.title);
          var roomEl = body.querySelector('[data-vbid-groom="' + idx + '"]');
          if (roomEl) roomEl.value = row.room || '';
          _vbStampGroupRoom(row);
        }
      };
    });
    Array.prototype.forEach.call(body.querySelectorAll('[data-vbid-groom]'), function(inp) {
      inp.onchange = function() {
        var idx = parseInt(inp.getAttribute('data-vbid-groom'), 10);
        var row = st.rows[idx];
        if (!row || row.kind !== 'group') return;
        row.room = String(inp.value || '').trim();
        _vbStampGroupRoom(row);
      };
    });
    Array.prototype.forEach.call(body.querySelectorAll('[data-vbid-l]'), function(cb) {
      cb.onchange = function() {
        var idx = parseInt(cb.getAttribute('data-vbid-l'), 10);
        if (st.rows[idx]) st.rows[idx].checked = !!cb.checked;
      };
    });
    Array.prototype.forEach.call(body.querySelectorAll('[data-vbid-cat]'), function(sel) {
      sel.onchange = function() {
        var idx = parseInt(sel.getAttribute('data-vbid-cat'), 10);
        var row = st.rows[idx];
        if (!row || row.kind !== 'line') return;
        row.category = String(sel.value || '').trim();
        _vbApplyCategoryMeta(row);
      };
    });
    Array.prototype.forEach.call(body.querySelectorAll('[data-vbid-mk]'), function(inp) {
      inp.onchange = function() {
        var idx = parseInt(inp.getAttribute('data-vbid-mk'), 10);
        var row = st.rows[idx];
        if (!row || row.kind !== 'line') return;
        var v = parseFloat(inp.value);
        row.markupPct = isNaN(v) ? 0 : v;
        _vbPriceLine(row);
        _vendorBidPaint();
      };
    });
  }

  async function _vendorBidLoadQpi() {
    var st = root._vendorBidState;
    if (!st) return;
    st.qpiLoading = true;
    try {
      if (typeof root.cchLoadQpiFiles === 'function') {
        st.qpiFiles = await root.cchLoadQpiFiles(st.projectId);
      } else {
        st.qpiFiles = [];
      }
    } catch (_e) {
      st.qpiFiles = [];
    }
    st.qpiLoading = false;
    if (!st.rows) _vendorBidPaint();
  }

  async function _vendorBidOnFile(file, opts) {
    var st = root._vendorBidState;
    opts = opts || {};
    if (!st || !file) return;
    if (!/\.pdf$/i.test(file.name || '') && file.type !== 'application/pdf') {
      if (typeof root.cchAlert === 'function') await root.cchAlert('Choose a PDF file.', 'Import vendor bid');
      return;
    }
    st.file = file;
    st.rows = null;
    st.sample = '';
    if (!opts.skipQpiUpload) {
      st.qpiFileId = null;
      try {
        if (typeof root.cchUploadFileToQpi === 'function') {
          var rec = await root.cchUploadFileToQpi(st.projectId, file);
          if (rec && rec.id) {
            st.qpiFileId = rec.id;
            st.qpiFiles = Array.isArray(st.qpiFiles) ? [rec].concat(st.qpiFiles.filter(function(x) { return x.id !== rec.id; })) : [rec];
          }
        }
      } catch (_qUp) {}
    }
    var body = document.querySelector('#cchVendorBidOverlay [data-vbid-body]');
    if (body) body.innerHTML = '<div style="font-size:13px;color:#6B7280;padding:12px 0;">Reading PDF\u2026</div>';
    try {
      var lines = await proposalPdfExtractLinesFromFile(file);
      var parsed = parseVendorBidPdfLines(lines);
      st.format = parsed.format;
      st.sample = parsed.sample || '';
      if (!parsed.groups || !parsed.groups.length) {
        st.rows = [];
        _vendorBidPaint();
        return;
      }
      st.defaultMk = DEFAULT_MARKUP_PCT;
      st.vendor = parsed.vendor || '';
      st.rows = _vendorBidBuildRows(parsed.groups, st.defaultMk, st.vendor);
      _vendorBidPaint();
    } catch (e) {
      if (typeof root.cchAlert === 'function') {
        await root.cchAlert('Could not read that PDF: ' + ((e && e.message) || e), 'Import vendor bid');
      }
      st.rows = null;
      _vendorBidPaint();
    }
  }

  async function _vendorBidOnQpiId(fileId) {
    var st = root._vendorBidState;
    if (!st || !fileId) return;
    var f = null;
    (st.qpiFiles || []).forEach(function(row) { if (String(row.id) === String(fileId)) f = row; });
    if (!f) return;
    st.qpiFileId = f.id;
    var url = String(f.downloadUrl || f.url || '').trim();
    if (!url) {
      if (typeof root.cchAlert === 'function') await root.cchAlert('That QPI file has no URL.', 'Import vendor bid');
      return;
    }
    var body = document.querySelector('#cchVendorBidOverlay [data-vbid-body]');
    if (body) body.innerHTML = '<div style="font-size:13px;color:#6B7280;padding:12px 0;">Reading PDF\u2026</div>';
    try {
      var res = await fetch(url);
      var buf = await res.arrayBuffer();
      var blob = new Blob([buf], { type: 'application/pdf' });
      var file = new File([blob], f.name || 'bid.pdf', { type: 'application/pdf' });
      await _vendorBidOnFile(file, { skipQpiUpload: true });
    } catch (e) {
      if (typeof root.cchAlert === 'function') {
        await root.cchAlert('Could not read that QPI PDF: ' + ((e && e.message) || e), 'Import vendor bid');
      }
      st.rows = null;
      _vendorBidPaint();
    }
  }

  async function _vendorBidSavePdfToQpi(projectId, file) {
    if (!file || !projectId) return null;
    if (typeof root.cchUploadFileToQpi === 'function') {
      return root.cchUploadFileToQpi(projectId, file);
    }
    return null;
  }

  async function _vendorBidCommit() {
    var st = root._vendorBidState;
    if (!st) return;
    if (!st.rows || !st.rows.length) {
      if (typeof root.cchAlert === 'function') await root.cchAlert('Choose a PDF with priced lines first.', 'Import vendor bid');
      return;
    }
    var targetSnap = await db.collection('boards').doc(st.projectId).collection('proposals').doc(st.targetId).get();
    if (!targetSnap.exists) {
      if (typeof root.cchAlert === 'function') await root.cchAlert('This proposal is no longer available.', 'Import vendor bid');
      return;
    }
    var targetData = targetSnap.data() || {};
    var lock = (typeof root.proposalDesignerLineEditLocked === 'function')
      ? root.proposalDesignerLineEditLocked(targetData)
      : { locked: false };
    if (lock && lock.locked) {
      if (typeof root.cchAlert === 'function') await root.cchAlert(lock.why || 'This proposal cannot be edited.', 'Import vendor bid');
      return;
    }
    var coerce = root.coerceProposalDocItemsArray || function(x) { return Array.isArray(x) ? x : []; };
    var destItems = coerce(targetData.items).slice();
    var nProd = 0;
    var i;
    for (i = 0; i < st.rows.length; i++) {
      var row = st.rows[i];
      if (row.kind === 'group') {
        var any = false;
        var gi;
        for (gi = i + 1; gi < st.rows.length; gi++) {
          if (st.rows[gi].kind === 'group') break;
          if (st.rows[gi].checked) { any = true; break; }
        }
        if (!any) continue;
        destItems.push({
          id: _vbFreshId(),
          lineKind: 'group',
          title: row.title,
          groupId: row.groupId,
          room: row.room || ''
        });
        continue;
      }
      if (!row.checked) continue;
      _vbApplyCategoryMeta(row);
      if (!String(row.category || '').trim()) {
        if (typeof root.cchAlert === 'function') await root.cchAlert('Every line needs a category before import.', 'Import vendor bid');
        return;
      }
      _vbPriceLine(row);
      destItems.push({
        id: _vbFreshId(),
        title: row.title,
        description: row.description || '',
        room: row.room || '',
        category: row.category || '',
        vendor: row.vendor || '',
        qty: row.qty,
        cost: row.cost,
        markupPct: row.markupPct,
        shipping: 0,
        clientPrice: row.clientPrice,
        amount: row.amount,
        groupId: row.groupId,
        lineApprovalStatus: 'pending',
        approved: false,
        declined: false,
        expenseType: row.expenseType || 'product',
        taxable: row.taxable !== false,
        source: 'vendor-bid-pdf'
      });
      nProd++;
    }
    if (!nProd) {
      if (typeof root.cchAlert === 'function') await root.cchAlert('Select at least one line to import.', 'Import vendor bid');
      return;
    }
    var total = (typeof root.proposalStoredTotalFromItems === 'function')
      ? root.proposalStoredTotalFromItems(destItems)
      : 0;
    try {
      await db.collection('boards').doc(st.projectId).collection('proposals').doc(st.targetId).update({
        items: destItems,
        total: total,
        updatedAt: new Date().toISOString()
      });
      try {
        if (!st.qpiFileId && st.file) await _vendorBidSavePdfToQpi(st.projectId, st.file);
      } catch (_att) {}
      if (typeof root.logDocActivity === 'function') {
        root.logDocActivity(st.projectId, 'proposals', st.targetId, 'item_added', 'Imported ' + nProd + ' line(s) from vendor bid PDF' + (st.file && st.file.name ? ' (' + st.file.name + ')' : ''));
      }
      if (typeof root.invalidateSearchCache === 'function') root.invalidateSearchCache();
      var pid = st.projectId, tid = st.targetId;
      _vendorBidClose();
      if (typeof root.showToast === 'function') {
        root.showToast('Imported ' + nProd + ' line' + (nProd === 1 ? '' : 's') + ' from vendor bid');
      }
      if (typeof root.renderProposalDetail === 'function') root.renderProposalDetail(pid, tid);
    } catch (e) {
      if (typeof root.cchAlert === 'function') {
        await root.cchAlert('Import failed: ' + ((e && e.message) || e), 'Import vendor bid');
      }
    }
  }

  async function openProposalImportVendorBidModal(projectId, proposalId) {
    projectId = String(projectId || '').trim();
    proposalId = String(proposalId || '').trim();
    if (!projectId || !proposalId) return;
    try {
      var targetSnap = await db.collection('boards').doc(projectId).collection('proposals').doc(proposalId).get();
      if (!targetSnap.exists) {
        if (typeof root.cchAlert === 'function') await root.cchAlert('This proposal is no longer available.', 'Import vendor bid');
        return;
      }
      var targetData = targetSnap.data() || {};
      var lock = (typeof root.proposalDesignerLineEditLocked === 'function')
        ? root.proposalDesignerLineEditLocked(targetData)
        : { locked: false };
      if (lock && lock.locked) {
        if (typeof root.cchAlert === 'function') await root.cchAlert(lock.why || 'This proposal cannot be edited.', 'Import vendor bid');
        return;
      }
      _vendorBidClose();
      root._vendorBidState = { projectId: projectId, targetId: proposalId, file: null, qpiFileId: null, qpiFiles: [], qpiLoading: true, rows: null, defaultMk: DEFAULT_MARKUP_PCT, sample: '' };
      var mc = document.getElementById('modalContainer');
      if (!mc) {
        if (typeof root.cchAlert === 'function') await root.cchAlert('Could not open the import dialog.', 'Import vendor bid');
        return;
      }
      var wrap = document.createElement('div');
      wrap.id = 'cchVendorBidOverlay';
      wrap.className = 'modal-overlay';
      wrap.style.zIndex = '1300';
      wrap.style.background = 'rgba(0,0,0,0.45)';
      wrap.innerHTML =
        '<div style="width:min(980px,96vw);max-height:90vh;overflow:hidden;display:flex;flex-direction:column;background:#fff;border:1px solid #E2E2E2;box-shadow:0 20px 60px rgba(0,0,0,0.25);">' +
          '<div style="padding:14px 16px;border-bottom:1px solid #E2E2E2;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">' +
            '<div style="font-size:14px;font-weight:600;color:#0A1F3D;">Import vendor bid (PDF)</div>' +
            '<button type="button" data-close style="border:none;background:none;font-size:20px;line-height:1;color:#6B7280;cursor:pointer;">&times;</button>' +
          '</div>' +
          '<div data-vbid-body style="padding:16px;overflow:auto;flex:1;"></div>' +
          '<div style="padding:12px 16px;border-top:1px solid #E2E2E2;display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;">' +
            '<button type="button" data-cancel style="padding:8px 14px;border:1px solid #0A1F3D;background:#FFFFFF;color:#0A1F3D;cursor:pointer;">Cancel</button>' +
            '<button type="button" data-ok style="padding:8px 14px;border:1px solid #0A1F3D;background:#0A1F3D;color:#FFFFFF;cursor:pointer;">Import selected</button>' +
          '</div>' +
        '</div>';
      wrap.addEventListener('click', function(e) { if (e.target === wrap) _vendorBidClose(); });
      wrap.querySelector('[data-close]').addEventListener('click', _vendorBidClose);
      wrap.querySelector('[data-cancel]').addEventListener('click', _vendorBidClose);
      wrap.querySelector('[data-ok]').addEventListener('click', function() { void _vendorBidCommit(); });
      mc.appendChild(wrap);
      _vendorBidPaint();
      void _vendorBidLoadQpi();
    } catch (e) {
      if (typeof root.cchAlert === 'function') {
        await root.cchAlert('Could not open Import vendor bid: ' + ((e && e.message) || e), 'Import vendor bid');
      }
    }
  }

  root.parseBartoloEstimateLines = parseBartoloEstimateLines;
  root.parseVendorBidPdfLines = parseVendorBidPdfLines;
  root.detectVendorBidFormat = detectVendorBidFormat;
  root.openProposalImportVendorBidModal = openProposalImportVendorBidModal;
  root._vendorBidClose = _vendorBidClose;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      parseBartoloEstimateLines: parseBartoloEstimateLines,
      parseVendorBidLines: parseVendorBidLines,
      parseVendorBidPdfLines: parseVendorBidPdfLines,
      detectVendorBidFormat: detectVendorBidFormat,
      DEFAULT_MARKUP_PCT: DEFAULT_MARKUP_PCT
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
