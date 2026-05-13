/** Debug: find all rows whose first cell starts with DOCUMENT_ or PURCHASE_ORDER_ to confirm headers exist after CSV parsing. */
const fs = require('fs');
const MASTER = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Houzz FILES\cchdesign_0427_original\cchdesign_0427.csv`;
function parseCSV(t) { const rows=[]; let row=[]; let cur=''; let q=false; for (let i=0;i<t.length;i++){const c=t[i]; if(q){if(c==='"'){if(t[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c} else{if(c==='"')q=true; else if(c===','){row.push(cur);cur=''} else if(c==='\r'){} else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur=''} else cur+=c}} if(cur.length||row.length){row.push(cur);rows.push(row)} return rows; }
const rows = parseCSV(fs.readFileSync(MASTER, 'utf-8'));
console.log('Total rows:', rows.length);
for (let i = 0; i < rows.length; i++) {
  const first = String(rows[i][0] || '').trim().toUpperCase();
  if (first === 'DOCUMENT_NUMBER' || first === 'PURCHASE_ORDER_NUMBER' || first === 'INVOICE_NUMBER') {
    console.log('Row ' + i + ' [' + rows[i].length + ' cols]: ' + rows[i].slice(0, 8).join(' | '));
  }
}
