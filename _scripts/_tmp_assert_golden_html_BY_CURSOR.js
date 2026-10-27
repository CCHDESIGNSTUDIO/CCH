var fs = require('fs');
var h = fs.readFileSync('Docs/golden/ds-invoice-expenses/v1/client-view.html', 'utf8');
var checks = {
  'exp-table': h.indexOf('exp-table') >= 0,
  'no 1 hrs': h.indexOf('1 hrs') < 0,
  'Pre-Paid': h.indexOf('Pre-Paid') >= 0,
  'T&E': h.indexOf('T&amp;E') >= 0 || h.indexOf('T&E') >= 0,
  'Handling': h.indexOf('Handling') >= 0,
  'outcome count': (h.match(/class="outcome"/g) || []).length,
  'has Design Services hours block': h.indexOf('Design Services') >= 0
};
console.log(JSON.stringify(checks, null, 2));
var bad = !checks['exp-table'] || !checks['no 1 hrs'] || !checks['Pre-Paid'];
process.exit(bad ? 1 : 0);
