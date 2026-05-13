const fs = require('fs');
const CATALOG = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427_original\catalog-items-with-images_cchdesign_0427.csv`;
function parseCSV(t) {
  const rows=[]; let row=[]; let cur=''; let q=false;
  for (let i=0;i<t.length;i++){const c=t[i];
    if(q){if(c==='"'){if(t[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else{if(c==='"')q=true; else if(c===','){row.push(cur);cur=''} else if(c==='\r'){} else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur=''} else cur+=c}
  }
  if(cur||row.length){row.push(cur);rows.push(row)}
  return rows;
}
const text = fs.readFileSync(CATALOG, 'utf-8');
const rows = parseCSV(text);
const h = rows[0];
const idIdx = h.indexOf('id');
console.log('Headers (' + h.length + '):');
h.forEach((c, i) => console.log('  [' + i + '] ' + c));
const data = rows.slice(1).filter(r => r.length > 1 && r[idIdx]);
console.log('\nTotal catalog records: ' + data.length);
let withImage = 0, withImage1 = 0;
const imgCols = h.map((c, i) => /^image\d+$/i.test(c) ? i : -1).filter(i => i >= 0);
console.log('Image-URL columns: ' + imgCols.map(i => '[' + i + '] ' + h[i]).join(' | '));
data.forEach(r => {
  let any = false;
  for (const i of imgCols) { if (r[i] && r[i].trim()) { any = true; break; } }
  if (any) withImage++;
  if (r[imgCols[0]] && r[imgCols[0]].trim()) withImage1++;
});
console.log('Records with at least one image URL: ' + withImage);
console.log('Records with primary (image1url): ' + withImage1);
const uniqueIds = new Set(data.map(r => r[idIdx]).filter(Boolean));
console.log('Unique houzzIds: ' + uniqueIds.size);
