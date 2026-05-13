const fs = require('fs');

let raw = fs.readFileSync('_debug/bugletrail-houzz-dryrun-report.json', 'utf16le');
raw = raw.replace(/^\uFEFF/, '');
const report = JSON.parse(raw);

function groupByDoc(arr) {
  const out = {};
  for (const x of arr) {
    const key = x.docId;
    if (!out[key]) out[key] = { docLabel: x.docLabel, items: [] };
    out[key].items.push({
      itemIndex: x.itemIndex,
      itemName: x.itemName,
      itemVendor: x.itemVendor,
      matchMethod: x.matchMethod,
      fields: (x.fieldsToUpdate || []).map((f) => `${f.field}(${f.reason})`),
    });
  }
  return out;
}

const focusedExamples = report.affectedDocs.invoices
  .filter((x) => /Daso|Maura|Vase/i.test(String(x.itemName || '')))
  .concat(
    report.affectedDocs.clips.filter((x) => /Daso|Maura|Vase/i.test(String(x.itemName || '')))
  )
  .slice(0, 30);

const output = {
  invoices: groupByDoc(report.affectedDocs.invoices),
  purchaseOrders: groupByDoc(report.affectedDocs.purchaseOrders),
  focusedExamples,
};

fs.writeFileSync(
  '_debug/bugletrail-houzz-dryrun-lineitems.json',
  JSON.stringify(output, null, 2),
  'utf8'
);
console.log('Wrote _debug/bugletrail-houzz-dryrun-lineitems.json');
