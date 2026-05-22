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
    'Hardware',
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

  global.CCH_PRODUCT_CATEGORIES_MASTER = MASTER.slice();

  /** Section headers, billing types, and mistakes — not FFE product categories (use Room or billing flows instead). */
  var NOT_FFE_CATEGORY_LABEL = new Set([
    'rooms', 'room boards', 'room board', 'spaces', 'space',
    'by room', 'by category', 'all rooms',
    'labor', 'labour', 'expense', 'expenses', 'services', 'service',
    'cch design service', 'cch design services', 'cch project management',
    'custom labor', 'design services', 'blended design services', 'consultation',
    'installation charges', 'freight', 'postage & printing', 'transaction fees',
    'time billing', 'hourly', 'retainer', 'design fee', 'design fees',
    'cch admin', 'shipping', 'handling', 'sales tax', 'discount', 'other expense',
    'professional services', 'project management', 'design fee - rates are already set in smart time'
  ]);

  /**
   * Master order first; then board-only custom categories (sorted).
   * @param {string[]} boardCategories - extras from Firestore `categories` or clip-derived strings
   * @param {string[]} [boardRooms] - project `rooms`; same string must not appear as a category option
   */
  global.cchAllProductCategories = function (boardCategories, boardRooms) {
    var masterSet = new Set(MASTER);
    var roomSet = new Set();
    if (boardRooms && boardRooms.length) {
      boardRooms.forEach(function (r) {
        if (r == null || r === '') return;
        roomSet.add(String(r).trim().toLowerCase());
      });
    }
    var extras = [];
    if (boardCategories && boardCategories.length) {
      boardCategories.forEach(function (x) {
        if (!x) return;
        var s = String(x).trim();
        if (!s) return;
        var sl = s.toLowerCase();
        if (roomSet.has(sl)) return;
        if (NOT_FFE_CATEGORY_LABEL.has(sl)) return;
        if (!masterSet.has(s)) extras.push(s);
      });
    }
    extras = Array.from(new Set(extras)).sort(function (a, b) {
      return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
    return MASTER.concat(extras);
  };
})(typeof window !== 'undefined' ? window : this);
