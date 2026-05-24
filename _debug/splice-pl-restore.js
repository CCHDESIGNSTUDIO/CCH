const fs = require('fs');
const path = require('path');

function readLines(filePath) {
  const buf = fs.readFileSync(filePath);
  const enc = buf[0] === 0xff && buf[1] === 0xfe ? 'utf16le' : 'utf8';
  return buf.toString(enc).split(/\r?\n/);
}

const ref = readLines(path.join(__dirname, 'index_84c1b0b_ref.html'));
const curPath = path.join(__dirname, 'index.preview-pl-restore.html');
const cur = readLines(curPath);

const startPe = cur.findIndex((l) => l.includes('async function _peLoadLinkedDocs'));
const endPe = cur.findIndex((l, i) => i > startPe && /^    function showProductDetail/.test(l));
if (startPe < 0 || endPe < 0) {
  console.error('markers not found', startPe, endPe);
  process.exit(1);
}

const refStart = ref.findIndex((l) => l.includes('async function _peLoadLinkedDocs'));
if (refStart < 0) {
  console.error('ref block start not found');
  process.exit(1);
}
const refEnd = ref.findIndex((l, i) => i > refStart && /^    function showProductDetail/.test(l));
let block = ref.slice(Math.max(0, refStart - 4), refEnd).join('\n');
block = block.replace("var srcCols = ['clips', 'selections'];", "var srcCols = ['clips'];");
block = block.replace(
  /Pass A: scan all clips \+ selections \(if present\)/,
  'Pass A: scan clips for houzz/doc refs'
);

const out = [...cur.slice(0, startPe), block, ...cur.slice(endPe)].join('\n');
fs.writeFileSync(curPath, out, 'utf8');
console.log('OK: injected', block.split('\n').length, 'lines at', startPe + 1);
