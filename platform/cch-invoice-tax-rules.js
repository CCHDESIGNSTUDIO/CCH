/**
 * California invoice line sales-tax rules (Studio + cleaning scripts).
 * Aligned with Houzz/tracker cleaning: design & professional services = non-taxable;
 * physical product categories = taxable.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (root) {
    for (var k in api) {
      if (Object.prototype.hasOwnProperty.call(api, k)) root[k] = api[k];
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** NON-TAXABLE services / design fees (California) */
  var CCH_CA_NON_TAXABLE_KEYWORDS = [
    'design', 'concept', 'mood board', 'rendering', '3d', 'space plan',
    'project management', 'client meeting', 'time billing', 't&e',
    'travel', 'expense', 'service', 'consult', 'admin', 'retainer',
    'phase', 'hour', 'meeting', 'zoom', 'call',
    'professional service', 'design fee', 'blended design', 'smart time',
  ];

  /** TAXABLE product categories */
  var CCH_CA_TAXABLE_CATEGORY_KEYWORDS = [
    'furniture', 'lighting', 'fabric', 'pillow', 'bedding', 'mirror',
    'rug', 'art', 'hardware', 'stone', 'tile', 'sink', 'faucet',
    'appliance', 'cabinet', 'flooring', 'wallpaper', 'window treatment',
  ];

  function norm(s) {
    return String(s || '').trim().toLowerCase();
  }

  function blobHasKeyword(blob, keywords) {
    blob = norm(blob);
    if (!blob) return false;
    for (var i = 0; i < keywords.length; i++) {
      if (blob.indexOf(keywords[i]) >= 0) return true;
    }
    return false;
  }

  function lineFields(it) {
    it = it || {};
    return {
      category: norm(it.category),
      title: norm(it.title || it.name),
      description: norm(it.description),
      itemType: norm(it.expenseType || it.itemType),
      cost: parseFloat(it.cost) || parseFloat(it.unitPurchaseCost) || 0,
    };
  }

  /**
   * Grok / tracker cleaning rules — default taxable? (before explicit line checkbox).
   */
  function cchInvoiceLineCaliforniaTaxableDefault(it) {
    var f = lineFields(it);
    if (blobHasKeyword(f.category, CCH_CA_TAXABLE_CATEGORY_KEYWORDS)) {
      return true;
    }
    if (blobHasKeyword(f.category, CCH_CA_NON_TAXABLE_KEYWORDS)) {
      return false;
    }
    if (f.itemType.indexOf('product') >= 0 || f.cost > 0) {
      return true;
    }
    return false;
  }

  /** Non-taxable professional / design row (for markup=0 and audits). */
  function cchInvoiceLineIsNonTaxableService(it) {
    if (!it) return false;
    var f = lineFields(it);
    if (blobHasKeyword(f.category, CCH_CA_TAXABLE_CATEGORY_KEYWORDS)) return false;
    if (cchInvoiceLineCaliforniaTaxableDefault(it) === false) {
      if (blobHasKeyword(f.category, CCH_CA_NON_TAXABLE_KEYWORDS)) {
        return true;
      }
      if (f.itemType === 'service' || f.itemType.indexOf('service') >= 0) return true;
    }
    return false;
  }

  /**
   * California keyword rules + explicit taxable flag (used by platform wrapper).
   */
  function cchCaliforniaInvoiceLineIsTaxable(it) {
    if (!it) return false;
    var et = norm(it.expenseType || it.itemType);
    if (et === 'sales_tax' || et === 'discount') return false;

    var caDefault = cchInvoiceLineCaliforniaTaxableDefault(it);

    if (it.taxable === false) return false;
    if (it.taxable === true) return caDefault;
    return caDefault;
  }

  /** Line stored or inferred as taxable but CA rules say no — for bulk fix scripts. */
  function cchInvoiceLineWasWronglyTaxed(it) {
    if (!it) return false;
    if (!cchInvoiceLineCaliforniaTaxableDefault(it)) {
      if (it.taxable === false) return false;
      return true;
    }
    return false;
  }

  /** Furnishings / accessories — not design-fee service (QB Studio Product). */
  function cchInvoiceLineLooksLikePhysicalProduct(it) {
    if (!it) return false;
    var f = lineFields(it);
    var title = f.title;
    if (/\b(bowl|vase|tray|riser|cutting\s+board|display\s+stand|sconce|lantern|chandelier|pendant|mirror|rug|pillow|flush\s*mount|homeware|organizer)\b/.test(title)) {
      return true;
    }
    if (blobHasKeyword(f.category, CCH_CA_TAXABLE_CATEGORY_KEYWORDS)) {
      if (f.cost > 0) return true;
    }
    if (/accessor|homeware|kitchen|furnish|decor\b|lighting|furniture|mirror/.test(f.category)) {
      if (f.cost > 0) return true;
    }
    var mk = parseFloat(it.markupPct);
    if (f.cost > 0 && !isNaN(mk) && mk > 0.25) return true;
    return false;
  }

  /** Apply CA rules to a line object (mutates). Returns true if changed. */
  function cchApplyCaliforniaTaxRulesToLine(it) {
    if (!it) return false;
    var shouldTax = cchInvoiceLineCaliforniaTaxableDefault(it);
    var changed = false;
    if (shouldTax === false) {
      if (it.taxable !== false) { it.taxable = false; changed = true; }
      if (!it.expenseType || it.expenseType === 'product') {
        it.expenseType = 'service';
        it.itemType = 'service';
        changed = true;
      }
      if (parseFloat(it.markupPct)) { it.markupPct = 0; changed = true; }
    }
    return changed;
  }

  return {
    CCH_CA_NON_TAXABLE_KEYWORDS: CCH_CA_NON_TAXABLE_KEYWORDS,
    CCH_CA_TAXABLE_CATEGORY_KEYWORDS: CCH_CA_TAXABLE_CATEGORY_KEYWORDS,
    cchInvoiceLineCaliforniaTaxableDefault: cchInvoiceLineCaliforniaTaxableDefault,
    cchInvoiceLineIsNonTaxableService: cchInvoiceLineIsNonTaxableService,
    cchCaliforniaInvoiceLineIsTaxable: cchCaliforniaInvoiceLineIsTaxable,
    cchInvoiceLineIsTaxable: cchCaliforniaInvoiceLineIsTaxable,
    cchInvoiceLineWasWronglyTaxed: cchInvoiceLineWasWronglyTaxed,
    cchInvoiceLineLooksLikePhysicalProduct: cchInvoiceLineLooksLikePhysicalProduct,
    cchApplyCaliforniaTaxRulesToLine: cchApplyCaliforniaTaxRulesToLine,
  };
});
