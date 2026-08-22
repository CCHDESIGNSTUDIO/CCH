/**
 * CCH Studio — proposal/invoice line placeholders (labor, expense, category icons).
 * Spec: cch-deploy/Docs/CCH_Icons_Cursor_Spec.md · Navy #0A1F3D · Gold #C8A97E
 * WO-026: WT icons only on real window-treatment lines; unique glyph per Labor/DS/Expense preset.
 */
(function (global) {
  'use strict';

  var SVG = {
    wtLabor: '<rect x="1" y="5" width="9" height="30" rx="1" fill="#0A1F3D" opacity=".12"/><rect x="30" y="5" width="9" height="30" rx="1" fill="#0A1F3D" opacity=".12"/><rect x="1" y="5" width="38" height="2" rx="1" fill="#0A1F3D" opacity=".1"/><line x1="20" y1="2" x2="20" y2="35" stroke="#0A1F3D" stroke-width="3" stroke-linecap="round"/><path d="M17.5 33 L20 39 L22.5 33" fill="#0A1F3D"/><ellipse cx="20" cy="5.5" rx="2.5" ry="3.5" stroke="#0A1F3D" stroke-width="1.8" fill="#F5F4F1"/><path d="M20 9 C13 14 27 20 18 30 L17 35" stroke="#C8A97E" stroke-width="2" fill="none" stroke-linecap="round"/>',
    wtExpense: '<rect x="3" y="3" width="34" height="6" rx="3" fill="#C8A97E"/><rect x="3" y="3" width="34" height="2.5" rx="2" fill="#fff" opacity=".2"/><circle cx="3" cy="6" r="3" fill="#C8A97E" opacity=".7"/><circle cx="37" cy="6" r="3" fill="#C8A97E" opacity=".7"/><rect x="5" y="9" width="30" height="26" rx="1" fill="#0A1F3D"/><rect x="5" y="14" width="30" height="1.2" fill="#C8A97E" opacity=".3"/><rect x="5" y="19" width="30" height="1.2" fill="#C8A97E" opacity=".3"/><rect x="5" y="24" width="30" height="1.2" fill="#C8A97E" opacity=".3"/><rect x="5" y="29" width="30" height="1.2" fill="#C8A97E" opacity=".3"/><rect x="5" y="33" width="30" height="3" rx="1" fill="#C8A97E" opacity=".7"/><line x1="13" y1="33" x2="13" y2="36" stroke="#0A1F3D" stroke-width="1.2" opacity=".5"/><line x1="20" y1="33" x2="20" y2="36" stroke="#0A1F3D" stroke-width="1.2" opacity=".5"/><line x1="27" y1="33" x2="27" y2="36" stroke="#0A1F3D" stroke-width="1.2" opacity=".5"/>',
    pillowLabor: '<rect x="3" y="10" width="34" height="20" rx="6" fill="#0A1F3D"/><rect x="3" y="10" width="34" height="20" rx="6" stroke="#C8A97E" stroke-width="1.2" fill="none" opacity=".45"/><rect x="7" y="14" width="26" height="12" rx="4" stroke="#C8A97E" stroke-width=".7" fill="none" opacity=".25"/><path d="M20 10 C18 14 18 16 20 20 C22 24 22 26 20 30" stroke="#C8A97E" stroke-width="1" fill="none" opacity=".55"/><circle cx="20" cy="20" r="1.5" fill="#C8A97E" opacity=".8"/><circle cx="20" cy="20" r=".6" fill="#0A1F3D"/><line x1="32" y1="5" x2="24" y2="17" stroke="#C8A97E" stroke-width="1.3"/><ellipse cx="31.5" cy="5.8" rx="1.2" ry="2" transform="rotate(-35 31.5 5.8)" fill="#C8A97E"/><path d="M24 17 C22 20 26 23 23 27" stroke="#C8A97E" stroke-width=".9" fill="none" opacity=".65"/>',
    furnitureLabor: '<rect x="7" y="5" width="26" height="16" rx="2" fill="#0A1F3D"/><line x1="7" y1="11" x2="33" y2="11" stroke="#C8A97E" stroke-width=".8" opacity=".35"/><line x1="7" y1="16" x2="33" y2="16" stroke="#C8A97E" stroke-width=".8" opacity=".35"/><circle cx="20" cy="13" r="1.4" fill="#C8A97E" opacity=".7"/><circle cx="13" cy="13" r="1.4" fill="#C8A97E" opacity=".5"/><circle cx="27" cy="13" r="1.4" fill="#C8A97E" opacity=".5"/><rect x="5" y="21" width="30" height="7" rx="1.5" fill="#0A1F3D"/><rect x="5" y="26" width="30" height="2" rx="1" fill="#C8A97E" opacity=".25"/><line x1="9" y1="28" x2="7" y2="38" stroke="#C8A97E" stroke-width="1.5" opacity=".7" stroke-linecap="round"/><line x1="31" y1="28" x2="33" y2="38" stroke="#C8A97E" stroke-width="1.5" opacity=".7" stroke-linecap="round"/><line x1="11" y1="28" x2="10" y2="38" stroke="#0A1F3D" stroke-width="2" stroke-linecap="round"/><line x1="29" y1="28" x2="30" y2="38" stroke="#0A1F3D" stroke-width="2" stroke-linecap="round"/><line x1="10" y1="33" x2="30" y2="33" stroke="#C8A97E" stroke-width=".9" opacity=".5"/><circle cx="10" cy="33" r="1.2" fill="#C8A97E" opacity=".7"/><circle cx="30" cy="33" r="1.2" fill="#C8A97E" opacity=".7"/><circle cx="20" cy="21" r="1.5" fill="#C8A97E" opacity=".8"/>',
    wallcoveringLabor: '<rect x="2" y="3" width="16" height="34" rx="1" fill="#0A1F3D"/><line x1="2" y1="11" x2="18" y2="11" stroke="#C8A97E" stroke-width=".6" opacity=".25"/><line x1="2" y1="19" x2="18" y2="19" stroke="#C8A97E" stroke-width=".6" opacity=".25"/><line x1="2" y1="27" x2="18" y2="27" stroke="#C8A97E" stroke-width=".6" opacity=".25"/><rect x="7" y="6" width="4" height="4" rx=".3" transform="rotate(45 9 8)" fill="none" stroke="#C8A97E" stroke-width=".6" opacity=".35"/><rect x="7" y="14" width="4" height="4" rx=".3" transform="rotate(45 9 16)" fill="none" stroke="#C8A97E" stroke-width=".6" opacity=".35"/><rect x="7" y="22" width="4" height="4" rx=".3" transform="rotate(45 9 24)" fill="none" stroke="#C8A97E" stroke-width=".6" opacity=".35"/><rect x="7" y="30" width="4" height="4" rx=".3" transform="rotate(45 9 32)" fill="none" stroke="#C8A97E" stroke-width=".6" opacity=".35"/><line x1="19" y1="3" x2="19" y2="37" stroke="#C8A97E" stroke-width="1.5" opacity=".85"/><rect x="20" y="3" width="16" height="34" rx="1" fill="#0A1F3D" opacity=".6"/><rect x="29" y="8" width="9" height="5" rx="1" fill="#C8A97E" opacity=".85"/><line x1="33.5" y1="13" x2="33.5" y2="20" stroke="#C8A97E" stroke-width="1.5" stroke-linecap="round" opacity=".75"/><line x1="30" y1="13" x2="30" y2="15" stroke="#0A1F3D" stroke-width=".8" opacity=".5"/><line x1="32" y1="13" x2="32" y2="15" stroke="#0A1F3D" stroke-width=".8" opacity=".5"/><line x1="34" y1="13" x2="34" y2="15" stroke="#0A1F3D" stroke-width=".8" opacity=".5"/><line x1="36" y1="13" x2="36" y2="15" stroke="#0A1F3D" stroke-width=".8" opacity=".5"/><rect x="29" y="21" width="9" height="3" rx="1.5" stroke="#C8A97E" stroke-width=".8" fill="none" opacity=".55"/><circle cx="33.5" cy="22.5" r=".9" fill="#C8A97E" opacity=".65"/>',
    installLabor: '<circle cx="20" cy="6" r="4" fill="none" stroke="#0A1F3D" stroke-width="2"/><line x1="20" y1="10" x2="20" y2="28" stroke="#0A1F3D" stroke-width="2.2" stroke-linecap="round"/><path d="M14 28 L20 36 L26 28" fill="none" stroke="#C8A97E" stroke-width="2" stroke-linejoin="round"/><circle cx="20" cy="18" r="2" fill="#C8A97E"/>',
    siteSupervision: '<ellipse cx="20" cy="20" rx="16" ry="9" fill="none" stroke="#0A1F3D" stroke-width="2"/><circle cx="20" cy="20" r="5.5" fill="none" stroke="#C8A97E" stroke-width="2"/><circle cx="20" cy="20" r="2.2" fill="#0A1F3D"/>',
    generalLabor: '<path d="M8 32 L18 12 L22 14 L12 34 Z" fill="#0A1F3D"/><rect x="20" y="8" width="14" height="5" rx="1" transform="rotate(35 27 10.5)" fill="#C8A97E"/><line x1="24" y1="18" x2="32" y2="10" stroke="#C8A97E" stroke-width="2.4" stroke-linecap="round"/>',
    dsSmartTime: '<circle cx="20" cy="20" r="14" fill="none" stroke="#0A1F3D" stroke-width="2"/><line x1="20" y1="20" x2="20" y2="11" stroke="#0A1F3D" stroke-width="2" stroke-linecap="round"/><line x1="20" y1="20" x2="27" y2="23" stroke="#C8A97E" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="20" r="1.8" fill="#C8A97E"/>',
    dsDesign: '<path d="M20 4 L34 20 L20 36 L6 20 Z" fill="none" stroke="#0A1F3D" stroke-width="2"/>',
    dsSupport: '<circle cx="14" cy="20" r="9" fill="none" stroke="#0A1F3D" stroke-width="2"/><circle cx="26" cy="20" r="9" fill="none" stroke="#C8A97E" stroke-width="2"/>',
    dsPm: '<line x1="8" y1="12" x2="32" y2="12" stroke="#0A1F3D" stroke-width="2.4" stroke-linecap="round"/><line x1="8" y1="20" x2="32" y2="20" stroke="#C8A97E" stroke-width="2.4" stroke-linecap="round"/><line x1="8" y1="28" x2="32" y2="28" stroke="#0A1F3D" stroke-width="2.4" stroke-linecap="round"/>',
    dsConcept: '<rect x="6" y="8" width="18" height="18" fill="none" stroke="#0A1F3D" stroke-width="2"/><circle cx="26" cy="26" r="10" fill="none" stroke="#C8A97E" stroke-width="2"/>',
    dsBlended: '<circle cx="20" cy="20" r="14" fill="none" stroke="#0A1F3D" stroke-width="2"/><path d="M20 6 A14 14 0 0 1 20 34 Z" fill="#C8A97E"/>',
    dsAdmin: '<rect x="8" y="5" width="24" height="30" rx="1" fill="none" stroke="#0A1F3D" stroke-width="2"/><line x1="13" y1="13" x2="27" y2="13" stroke="#C8A97E" stroke-width="1.6" stroke-linecap="round"/><line x1="13" y1="19" x2="27" y2="19" stroke="#C8A97E" stroke-width="1.6" stroke-linecap="round"/><line x1="13" y1="25" x2="22" y2="25" stroke="#C8A97E" stroke-width="1.6" stroke-linecap="round"/>',
    dsStudio: '<rect x="6" y="6" width="12" height="12" fill="#0A1F3D"/><rect x="22" y="6" width="12" height="12" fill="none" stroke="#C8A97E" stroke-width="1.8"/><rect x="6" y="22" width="12" height="12" fill="none" stroke="#C8A97E" stroke-width="1.8"/><rect x="22" y="22" width="12" height="12" fill="#0A1F3D"/>',
    dsTimeEntry: '<line x1="8" y1="12" x2="32" y2="12" stroke="#0A1F3D" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="28" x2="32" y2="28" stroke="#0A1F3D" stroke-width="2" stroke-linecap="round"/><line x1="20" y1="16" x2="20" y2="24" stroke="#C8A97E" stroke-width="2.2" stroke-linecap="round"/><line x1="16" y1="20" x2="24" y2="20" stroke="#C8A97E" stroke-width="2.2" stroke-linecap="round"/>',
    dsResearch: '<circle cx="17" cy="17" r="10" fill="none" stroke="#0A1F3D" stroke-width="2"/><line x1="24" y1="24" x2="34" y2="34" stroke="#C8A97E" stroke-width="3" stroke-linecap="round"/>',
    dsElu: '<path d="M20 5 L34 20 L20 35 L6 20 Z" fill="#0A1F3D"/><path d="M20 12 L27 20 L20 28 L13 20 Z" fill="#C8A97E"/>',
    retainerCredit: '<rect x="6" y="6" width="28" height="28" fill="none" stroke="#0A1F3D" stroke-width="2"/><line x1="12" y1="20" x2="28" y2="20" stroke="#C8A97E" stroke-width="2.6" stroke-linecap="round"/>',
    expFreight: '<rect x="4" y="16" width="22" height="12" fill="#0A1F3D"/><path d="M26 20 L34 20 L34 28 L26 28 Z" fill="#C8A97E"/><circle cx="12" cy="30" r="3.5" fill="none" stroke="#0A1F3D" stroke-width="1.8"/><circle cx="28" cy="30" r="3.5" fill="none" stroke="#0A1F3D" stroke-width="1.8"/><rect x="8" y="10" width="10" height="6" fill="#C8A97E"/>',
    expHandling: '<rect x="6" y="6" width="12" height="12" fill="none" stroke="#0A1F3D" stroke-width="1.8"/><rect x="22" y="6" width="12" height="12" fill="#C8A97E"/><rect x="6" y="22" width="12" height="12" fill="#C8A97E"/><rect x="22" y="22" width="12" height="12" fill="none" stroke="#0A1F3D" stroke-width="1.8"/>',
    expPrint: '<path d="M6 16 L20 8 L34 16 L34 30 L6 30 Z" fill="none" stroke="#0A1F3D" stroke-width="2" stroke-linejoin="round"/><path d="M6 16 L20 24 L34 16" fill="none" stroke="#C8A97E" stroke-width="1.8"/>',
    expTe: '<path d="M6 20 L34 8 L20 34 L18 22 Z" fill="#0A1F3D"/><path d="M18 22 L34 8" stroke="#C8A97E" stroke-width="1.8"/>',
    expCcFee: '<rect x="5" y="10" width="30" height="20" rx="2" fill="none" stroke="#0A1F3D" stroke-width="2"/><rect x="5" y="16" width="30" height="5" fill="#C8A97E"/><rect x="9" y="24" width="10" height="2.5" fill="#0A1F3D"/>',
    expSamples: '<rect x="8" y="8" width="6" height="24" fill="#0A1F3D"/><rect x="17" y="8" width="6" height="24" fill="#C8A97E"/><rect x="26" y="8" width="6" height="24" fill="#0A1F3D"/>',
    expReimburse: '<path d="M28 12 A12 12 0 1 0 30 22" fill="none" stroke="#0A1F3D" stroke-width="2.2" stroke-linecap="round"/><path d="M28 6 L28 14 L20 14" fill="none" stroke="#C8A97E" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>',
    expDiscount: '<path d="M8 20 L20 6 L32 20 L20 34 Z" fill="none" stroke="#0A1F3D" stroke-width="2"/><circle cx="16" cy="16" r="2" fill="#C8A97E"/><line x1="14" y1="26" x2="26" y2="14" stroke="#C8A97E" stroke-width="1.8"/>',
    expOther: '<circle cx="10" cy="20" r="2.6" fill="#0A1F3D"/><circle cx="20" cy="20" r="2.6" fill="#C8A97E"/><circle cx="30" cy="20" r="2.6" fill="#0A1F3D"/>',
    expSalesTax: '<rect x="6" y="6" width="28" height="28" fill="none" stroke="#0A1F3D" stroke-width="2"/><text x="20" y="26" text-anchor="middle" font-size="16" font-family="DM Sans,sans-serif" font-weight="700" fill="#C8A97E">%</text>'
  };

  function baseKind(kind) {
    var k = String(kind || '');
    if (k.indexOf('bartolo') === 0) {
      k = k.slice(7);
      k = k.charAt(0).toLowerCase() + k.slice(1);
    }
    return k;
  }

  function isBartoloItem(item) {
    item = item || {};
    var v = String(item.vendor || '').toLowerCase();
    if (/bartolo/.test(v)) return true;
    if (item.source === 'bartolo-po' || item.source === 'bartolo-po-import') return true;
    return false;
  }

  function isWindowTreatmentLine(blob, cat, title, wcc, bartolo) {
    var wt = /custom window|window treatment|drapery|roman shade|valance|cornice|\bdrapes?\b|\bcurtains?\b/;
    if (wt.test(blob) || wt.test(cat)) return true;
    if (bartolo && /window|drapery|valance|roman shade/.test(blob)) return true;
    if ((wcc === 'lining' || wcc === 'hardware' || wcc === 'trim') && wt.test(blob)) return true;
    if (/lining|blackout|interlining|iron rod/.test(title) && wt.test(blob)) return true;
    return false;
  }

  function designServiceKind(title, blob) {
    if (/t\s*&\s*e|travel & entertainment/.test(blob)) return 'expTe';
    if (/smart time/.test(blob)) return 'dsSmartTime';
    if (/client project support|project support/.test(blob)) return 'dsSupport';
    if (/project management|\bpm\b/.test(blob)) return 'dsPm';
    if (/design concept/.test(blob)) return 'dsConcept';
    if (/blended/.test(blob)) return 'dsBlended';
    if (/\badmin\b/.test(blob)) return 'dsAdmin';
    if (/studio/.test(blob)) return 'dsStudio';
    if (/time entry/.test(blob)) return 'dsTimeEntry';
    if (/research/.test(blob)) return 'dsResearch';
    if (/\belu\b/.test(blob)) return 'dsElu';
    if (/design service|design fee|consultation|other design|non-billable/.test(blob)) return 'dsDesign';
    return '';
  }

  function laborKindFromTitle(title, blob) {
    if (/custom window|window treatment/.test(blob)) return 'wtLabor';
    if (/wallpaper|wallcovering|wall covering/.test(blob)) return 'wallcoveringLabor';
    if (/upholster|custom furniture/.test(blob)) return 'furnitureLabor';
    if (/pillow|bedding/.test(blob)) return 'pillowLabor';
    if (/site supervision/.test(blob)) return 'siteSupervision';
    if (/installation labor|on-site install/.test(blob)) return 'installLabor';
    if (/general labor/.test(blob)) return 'generalLabor';
    if (/install/.test(title) && !/window|drapery|shade|valance/.test(blob)) return 'installLabor';
    return 'generalLabor';
  }

  function expenseKindFromItem(et, title, blob) {
    if (et === 'retainer_credit' || /retainer credit/.test(blob)) return 'retainerCredit';
    if (et === 'sales_tax' || /pre-paid sales tax|prepaid sales tax|sales tax/.test(blob)) return 'expSalesTax';
    if (et === 'shipping' || /freight|shipping/.test(blob)) return 'expFreight';
    if (et === 'handling' || /handling|packing/.test(blob)) return 'expHandling';
    if (et === 'discount' || /discount/.test(blob)) return 'expDiscount';
    if (/print|post|postage|courier/.test(blob)) return 'expPrint';
    if (/t\s*&\s*e|travel|entertainment/.test(blob)) return 'expTe';
    if (/cc fee|transaction fee|card fee/.test(blob)) return 'expCcFee';
    if (/sample/.test(blob)) return 'expSamples';
    if (/reimburs/.test(blob)) return 'expReimburse';
    if (et === 'other_expense' || /other expense/.test(blob)) return 'expOther';
    if (et === 'expense' || et === 'other_expense') return 'expOther';
    return '';
  }

  function cchLineIconKind(item) {
    item = item || {};
    if (item.__forceKind) return String(item.__forceKind);
    if (item.lineKind === 'group') return 'default';
    var cat = String(item.category || '').toLowerCase();
    var title = String(item.title || item.name || '').toLowerCase();
    var desc = String(item.description || '').toLowerCase();
    var blob = (cat + ' ' + title + ' ' + desc).replace(/\s+/g, ' ');
    var et = String(item.expenseType || '').toLowerCase();
    var lc = String(item.cchLineCategory || item.lineType || '').toLowerCase();
    var ity = String(item.itemType || '').toLowerCase();
    var wcc = String(item.workroomCostCategory || '').toLowerCase();
    var bartolo = isBartoloItem(item);
    var wt = isWindowTreatmentLine(blob, cat, title, wcc, bartolo);

    if (/pillow|bedding/.test(blob) || cat.indexOf('bedding') >= 0 || cat.indexOf('pillow') >= 0) {
      return bartolo ? 'bartoloPillowLabor' : 'pillowLabor';
    }
    if (/wall cover|wallcover/.test(blob) || cat.indexOf('wall covering') >= 0) {
      return 'wallcoveringLabor';
    }
    if ((/custom furniture|upholster/.test(blob) || cat.indexOf('custom upholstery') >= 0 || cat.indexOf('custom furniture') >= 0) &&
        (lc === 'labor' || ity === 'labor' || et === 'service')) {
      return 'furnitureLabor';
    }

    if (wt) {
      var isLaborWt = lc === 'labor' || ity === 'labor' || wcc === 'labor' || wcc === 'installation' ||
        (et === 'service' && ity !== 'product' && ity !== 'expense') ||
        /labor|fabricat|workroom|hand sew/.test(blob);
      if (isLaborWt && lc !== 'expense' && ity !== 'expense' && et !== 'expense' && et !== 'shipping' && et !== 'handling') {
        return bartolo ? 'bartoloWtLabor' : 'wtLabor';
      }
      return bartolo ? 'bartoloWtExpense' : 'wtExpense';
    }

    if (et === 'retainer_credit' || lc === 'retainer_credit' || /retainer credit/.test(blob)) {
      return 'retainerCredit';
    }

    if (lc === 'design_service' || ity === 'design_service' || (et === 'service' && ity === 'service')) {
      return designServiceKind(title, blob) || 'dsDesign';
    }
    var dskLoose = designServiceKind(title, blob);
    if (dskLoose && et === 'service' && ity !== 'labor') return dskLoose;

    var isExpense = et === 'expense' || et === 'shipping' || et === 'handling' || et === 'other_expense' ||
      et === 'discount' || et === 'sales_tax' || et === 'retainer_credit' ||
      lc === 'expense' || ity === 'expense';
    if (isExpense && lc !== 'labor' && ity !== 'labor') {
      return expenseKindFromItem(et, title, blob) || 'expOther';
    }

    var isLabor = lc === 'labor' || ity === 'labor' || wcc === 'labor' || wcc === 'installation' ||
      (et === 'service' && ity === 'labor') ||
      item.source === 'bartolo-po' || item.source === 'builder-workorders';
    if (isLabor) {
      var lk = laborKindFromTitle(title, blob);
      if (lk === 'wtLabor' && bartolo) return 'bartoloWtLabor';
      return lk;
    }

    if (et === 'product' && (item.imageUrl || item.libraryProductId)) return 'default';
    if (et === 'product') return 'default';
    return 'default';
  }

  function cchLineIconSvgHtml(kind, sizePx) {
    sizePx = sizePx || 64;
    var k = baseKind(kind);
    var inner = SVG[k];
    if (!inner) return '';
    return '<svg width="' + sizePx + '" height="' + sizePx + '" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + inner + '</svg>';
  }

  function cchLineIconPlaceholderByKind(kind, sizePx, extraStyle) {
    sizePx = sizePx || 64;
    kind = kind || 'default';
    if (kind === 'default' || !SVG[baseKind(kind)]) {
      return '<div style="width:' + sizePx + 'px;height:' + sizePx + 'px;background:var(--gray-50);display:flex;align-items:center;justify-content:center;font-size:' + Math.round(sizePx * 0.38) + 'px;border-radius:4px;border:1px solid var(--gray-100);' + (extraStyle || '') + '">📦</div>';
    }
    var bartolo = String(kind).indexOf('bartolo') === 0;
    var badge = '';
    if (bartolo) {
      var bs = Math.max(14, Math.round(sizePx * 0.34));
      var fs = Math.max(8, Math.round(sizePx * 0.2));
      badge = '<div style="position:absolute;right:0;bottom:0;width:' + bs + 'px;height:' + bs + 'px;border-radius:50%;background:#C8A97E;color:#0A1F3D;font-size:' + fs + 'px;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:1;border:1px solid #fff;box-shadow:0 0 0 1px rgba(10,31,61,.12);" title="Workroom quote line">W</div>';
    }
    return '<div style="width:' + sizePx + 'px;height:' + sizePx + 'px;background:var(--gray-50);border-radius:4px;border:1px solid var(--gray-100);display:flex;align-items:center;justify-content:center;position:relative;flex-shrink:0;overflow:visible;' + (extraStyle || '') + '">' +
      cchLineIconSvgHtml(kind, sizePx) + badge + '</div>';
  }

  function cchLineIconPlaceholderHtml(item, sizePx, extraStyle) {
    return cchLineIconPlaceholderByKind(cchLineIconKind(item), sizePx, extraStyle);
  }

  function cchLineIconImgDataAttr(item) {
    var kind = cchLineIconKind(item);
    if (!kind || kind === 'default') return '';
    return ' data-cch-icon-kind="' + kind.replace(/"/g, '') + '"';
  }

  global.cchLineIconKind = cchLineIconKind;
  global.cchLineIconSvgHtml = cchLineIconSvgHtml;
  global.cchLineIconPlaceholderByKind = cchLineIconPlaceholderByKind;
  global.cchLineIconPlaceholderHtml = cchLineIconPlaceholderHtml;
  global.cchLineIconImgDataAttr = cchLineIconImgDataAttr;
})(typeof window !== 'undefined' ? window : this);
