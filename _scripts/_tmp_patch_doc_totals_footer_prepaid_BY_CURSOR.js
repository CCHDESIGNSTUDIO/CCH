'use strict';
const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, '..', 'platform', 'cch-proposals-invoices-fix.js');
let s = fs.readFileSync(p, 'utf8');

const start = s.indexOf('window.cchDocViewLineTotalsFooterHtml = function(opts) {');
if (start < 0) {
  console.error('footer fn not found');
  process.exit(1);
}
const endMarker = '\n  };\n\n  // ============================================================\n  // 30. INVOICE/PO VIEW MODE';
const end = s.indexOf(endMarker, start);
if (end < 0) {
  console.error('end marker not found');
  process.exit(1);
}

const neu = `window.cchDocViewLineTotalsFooterHtml = function(opts) {
    opts = opts || {};
    var subLabel = String(opts.subLabel || 'Subtotal');
    var subtotal = parseFloat(opts.subtotal) || 0;
    var shipping = parseFloat(opts.shipping) || 0;
    var tax = parseFloat(opts.tax) || 0;
    var taxRate = parseFloat(opts.taxRate) || 0;
    var taxableSub = parseFloat(opts.taxableSubtotal) || 0;
    var prepaid = parseFloat(opts.prepaidSalesTax) || 0;
    var grand = parseFloat(opts.grandTotal);
    if (isNaN(grand)) grand = subtotal + shipping + tax + prepaid + (parseFloat(opts.creditTotal) || 0);
    var credits = opts.credits || [];
    var totalLabel = String(opts.totalLabel || 'Total');
    var taxLabel = 'Tax';
    if (taxRate > 0 && taxableSub > 0) taxLabel = 'Tax (' + taxRate + '% on ' + formatMoney(taxableSub) + ')';
    else if (taxRate > 0) taxLabel = 'Tax (' + taxRate + '%)';
    function row(label, amt, grandRow, color) {
      var cls = grandRow ? 'cch-doc-line-totals-grand' : 'cch-doc-line-totals-row';
      var st = color ? ' style="color:' + color + ';"' : '';
      return '<div class="' + cls + '"' + st + '><span>' + esc(label) + '</span><span>' + formatMoney(amt) + '</span></div>';
    }
    return '<div class="cch-doc-line-totals-footer"><div class="cch-doc-line-totals-inner">' +
      row(subLabel, subtotal) +
      row('Shipping', shipping) +
      row(taxLabel, tax) +
      (prepaid > 0.01 ? row('Pre-Paid Sales Tax', prepaid, false, '#E16A5B') : '') +
      credits.map(function(c) {
        if (!c || Math.abs(c.amount) < 0.01) return '';
        return row(c.label || 'Credit', c.amount);
      }).join('') +
      row(totalLabel, grand, true) +
      '</div></div>';
  };`;

s = s.slice(0, start) + neu + s.slice(end);

// Patch call site: peel prepaid from invoice subtotal when passing to footer
const callOld = `window.cchDocViewLineTotalsFooterHtml({
            subLabel: 'Subtotal',
            subtotal: subtotal,
            shipping: totalShipping,
            tax: tax,
            taxRate: taxRate,
            taxableSubtotal: taxableSubtotal,
            credits: _invCredits,
            creditTotal: _invCreditTotal,
            grandTotal: grandTotal
          })`;
const callNew = `(function(){
            var _pp = (typeof cchVendorPrepaidSalesTaxTotal === 'function') ? cchVendorPrepaidSalesTaxTotal(items) : 0;
            var _subDisp = (_pp > 0.01) ? Math.max(0, (subtotal || 0) - _pp) : subtotal;
            return window.cchDocViewLineTotalsFooterHtml({
              subLabel: 'Subtotal',
              subtotal: _subDisp,
              shipping: totalShipping,
              tax: tax,
              taxRate: taxRate,
              taxableSubtotal: taxableSubtotal,
              prepaidSalesTax: _pp,
              credits: _invCredits,
              creditTotal: _invCreditTotal,
              grandTotal: grandTotal
            });
          })()`;

if (!s.includes(callOld)) {
  console.warn('call site exact match missing — searching soft');
  if (!s.includes('creditTotal: _invCreditTotal')) {
    console.error('call site not found');
    process.exit(1);
  }
} else {
  s = s.replace(callOld, callNew);
}

fs.writeFileSync(p, s);
console.log('patched', p);
console.log('has prepaid in footer', s.includes("Pre-Paid Sales Tax', prepaid"));
console.log('has call peel', s.includes('cchVendorPrepaidSalesTaxTotal'));
