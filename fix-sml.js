const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'platform', 'index.html');
let html = fs.readFileSync(FILE, 'utf8');
const origLen = html.length;

// Remove S, M, L buttons and the separator
const smlBlock = `<button class="ib-view-btn \${(window._ibImgSize||'M')==='S'?'active':''}" onclick="window._ibImgSize='S';renderProjectDetail()">S</button>
            <button class="ib-view-btn \${(window._ibImgSize||'M')==='M'?'active':''}" onclick="window._ibImgSize='M';renderProjectDetail()">M</button>
            <button class="ib-view-btn \${(window._ibImgSize||'M')==='L'?'active':''}" onclick="window._ibImgSize='L';renderProjectDetail()">L</button>
            <span style="color:var(--gray-200);margin:0 2px;">|</span>`;

if (html.includes(smlBlock)) {
  html = html.replace(smlBlock, '');
  console.log('✅ Removed S/M/L buttons + separator');
} else {
  console.log('⚠️ SML block not found exactly - trying line by line');
  // Try removing each individually
  const s = `<button class="ib-view-btn \${(window._ibImgSize||'M')==='S'?'active':''}" onclick="window._ibImgSize='S';renderProjectDetail()">S</button>`;
  const m = `<button class="ib-view-btn \${(window._ibImgSize||'M')==='M'?'active':''}" onclick="window._ibImgSize='M';renderProjectDetail()">M</button>`;
  const l = `<button class="ib-view-btn \${(window._ibImgSize||'M')==='L'?'active':''}" onclick="window._ibImgSize='L';renderProjectDetail()">L</button>`;
  const sep = `<span style="color:var(--gray-200);margin:0 2px;">|</span>`;
  [s, m, l, sep].forEach(pat => {
    if (html.includes(pat)) { html = html.replace(pat, ''); console.log('  Removed:', pat.substring(0, 40)); }
  });
}

// Also fix ib-view-btn text readability
const viewBtnCSS = '.ib-view-btn {';
const btnIdx = html.indexOf(viewBtnCSS);
if (btnIdx > 0) {
  const btnEnd = html.indexOf('}', btnIdx) + 1;
  const oldRule = html.substring(btnIdx, btnEnd);
  html = html.replace(oldRule, '.ib-view-btn { padding: 4px 12px; font-size: 13px; font-weight: 600; border: 1px solid var(--border, #ddd); background: var(--card, white); color: var(--text, #0E1629); cursor: pointer; border-radius: 0; }');
  console.log('✅ Fixed button text readability');
}

// Fix active state
const viewBtnActive = '.ib-view-btn.active {';
const activeIdx = html.indexOf(viewBtnActive);
if (activeIdx > 0) {
  const activeEnd = html.indexOf('}', activeIdx) + 1;
  const oldActive = html.substring(activeIdx, activeEnd);
  html = html.replace(oldActive, '.ib-view-btn.active { background: var(--gold, #C8B99A); color: white; border-color: var(--gold, #C8B99A); }');
  console.log('✅ Fixed active button style');
}

// VALIDATE
const newLen = html.length;
const end = html.slice(-30).trim();
console.log('\nOrig:', origLen, '| New:', newLen, '| OK:', end.endsWith('</html>'));
if (newLen < origLen - 1000 || !end.endsWith('</html>')) { console.log('❌ ABORT'); process.exit(1); }
fs.writeFileSync(FILE, html);
console.log('✅ SAVED');
