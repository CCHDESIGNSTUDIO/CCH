/** Pull a clean sample of MED + LOW confidence matches for review. */
const fs = require('fs');
const path = require('path');

const CSV = path.join(__dirname, 'phase-A-v2-detail.csv');
const text = fs.readFileSync(CSV, 'utf-8');

function parseCSV(t) {
  const rows=[]; let row=[]; let cur=''; let q=false;
  for (let i=0;i<t.length;i++){const c=t[i];
    if(q){if(c==='"'){if(t[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else{if(c==='"')q=true;else if(c===',') {row.push(cur);cur=''}else if(c==='\r'){}else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur=''}else cur+=c}
  }
  if(cur||row.length){row.push(cur);rows.push(row)}
  return rows;
}

const rows = parseCSV(text);
const h = rows[0];
const idx = (n) => h.indexOf(n);
const records = rows.slice(1).filter(r => r.length > 1).map(r => {
  const o = {};
  for (let i = 0; i < h.length; i++) o[h[i]] = r[i];
  return o;
});

const med = records.filter(r => r.matchConfidence === 'MED' && r.wouldWrite === 'YES');
const low = records.filter(r => r.matchConfidence === 'LOW' && r.wouldWrite === 'YES');

function pickDiverse(arr, n) {
  // First n from a sorted-by-title sample
  return arr.slice().sort((a,b) => (a.studioTitle||'').localeCompare(b.studioTitle||'')).filter((_,i,a) => i % Math.max(1, Math.floor(a.length/n)) === 0).slice(0, n);
}

const medSamples = pickDiverse(med, 15);
const lowSamples = pickDiverse(low, 15);

const out = [];
out.push('MED-CONFIDENCE SAMPLES (title exact, vendor differs/missing)');
out.push('='.repeat(70));
out.push(`(showing ${medSamples.length} of ${med.length} would-write MED matches)\n`);
medSamples.forEach((r, i) => {
  out.push(`${i+1}. Studio: "${r.studioTitle}"`);
  out.push(`   Studio vendor: "${r.studioVendor||'(none)'}"   Studio sku: "${r.studioSku||'(none)'}"`);
  out.push(`   Houzz match: "${r.catalogTitle}"  vendor: "${r.catalogVendor||'(none)'}"  sku: "${r.catalogSku||'(none)'}"`);
  out.push(`   Would set houzzId=${r.catalogHouzzId}, refresh imageUrl`);
  out.push('');
});
out.push('');
out.push('LOW-CONFIDENCE SAMPLES (title contains / substring match)');
out.push('='.repeat(70));
out.push(`(showing ${lowSamples.length} of ${low.length} would-write LOW matches)\n`);
lowSamples.forEach((r, i) => {
  out.push(`${i+1}. Studio: "${r.studioTitle}"`);
  out.push(`   Studio vendor: "${r.studioVendor||'(none)'}"   Studio sku: "${r.studioSku||'(none)'}"`);
  out.push(`   Houzz match: "${r.catalogTitle}"  vendor: "${r.catalogVendor||'(none)'}"  sku: "${r.catalogSku||'(none)'}"`);
  out.push(`   Would set houzzId=${r.catalogHouzzId}, refresh imageUrl`);
  out.push('');
});

const outPath = 'med-low-samples.txt';
fs.writeFileSync(outPath, out.join('\n'));
console.log(out.join('\n'));
console.log(`\nWrote ${outPath} (${medSamples.length} MED + ${lowSamples.length} LOW samples)`);
