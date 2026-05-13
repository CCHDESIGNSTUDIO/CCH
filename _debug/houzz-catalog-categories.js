/** List all unique Houzz catalog categories with counts. */
const fs = require('fs');
const CATALOG = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427_original\catalog-items-with-images_cchdesign_0427.csv`;
function parseCSV(text) {
  const rows=[]; let row=[]; let cur=''; let q=false;
  for (let i=0;i<text.length;i++){const c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else{if(c==='"')q=true;else if(c===',') {row.push(cur);cur=''}else if(c==='\r'){}else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur=''}else cur+=c}
  }
  if(cur||row.length){row.push(cur);rows.push(row)}
  return rows;
}
const txt = fs.readFileSync(CATALOG, 'utf-8');
const rows = parseCSV(txt);
const h = rows[0];
const idxCat = h.indexOf('category');
const idxType = h.indexOf('item_type');
const cats = {};
let withEmpty = 0;
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  if (r.length < 2) continue;
  const cat = (r[idxCat] || '').trim();
  const type = (r[idxType] || '').trim();
  if (!cat) { withEmpty++; continue; }
  const key = `${cat}|${type}`;
  cats[key] = (cats[key] || 0) + 1;
}
console.log(`Empty category: ${withEmpty}`);
console.log(`\nAll unique Houzz catalog categories (with item_type, sorted by count):`);
const sorted = Object.entries(cats).sort((a,b) => b[1]-a[1]);
for (const [k, v] of sorted) {
  const [cat, type] = k.split('|');
  console.log(`  ${v.toString().padStart(5)} | ${type.padEnd(10)} | ${cat}`);
}
