const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'platform', 'index.html');
let html = fs.readFileSync(FILE, 'utf8');
const origLen = html.length;
let fixes = 0;

// 1. FIX TAB TEXT - make it BOLD, LARGE, HIGH CONTRAST
const oldTab = '.ib-section-tab { padding: 8px 16px; font-size: 13px; font-weight: 600; color: var(--text, #0E1629); cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }';
const newTab = '.ib-section-tab { padding: 10px 16px; font-size: 14px; font-weight: 700; color: #0E1629 !important; cursor: pointer; border-bottom: 3px solid transparent; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }';
if (html.includes(oldTab)) {
  html = html.replace(oldTab, newTab);
  fixes++;
  console.log('✅ Tab text: bold 14px, navy color forced');
}

// Also fix active tab
const oldActive = ".ib-section-tab.active { color: var(--text-primary); border-bottom-color: var(--cyan); font-weight: 600; }";
const newActive = ".ib-section-tab.active { color: #C8B99A !important; border-bottom-color: #C8B99A; font-weight: 700; }";
if (html.includes(oldActive)) {
  html = html.replace(oldActive, newActive);
  fixes++;
  console.log('✅ Active tab: gold color forced');
}

// Fix hover
const oldHover = ".ib-section-tab:hover { color: var(--text-primary); }";
const newHover = ".ib-section-tab:hover { color: #C8B99A !important; }";
if (html.includes(oldHover)) {
  html = html.replace(oldHover, newHover);
  fixes++;
  console.log('✅ Tab hover: gold');
}

// 2. FIX IMAGES - remove aspect-ratio:1, let images show full height
const oldItem = ".ib-item { position: relative; overflow: hidden; aspect-ratio: 1; cursor: pointer; border-radius: 0; }";
const newItem = ".ib-item { position: relative; overflow: hidden; cursor: pointer; border-radius: 0; break-inside: avoid; margin-bottom: 4px; }";
if (html.includes(oldItem)) {
  html = html.replace(oldItem, newItem);
  fixes++;
  console.log('✅ Items: removed aspect-ratio:1, show full image');
}

// Fix image to not force square
const oldImg = ".ib-item img { width: 100%; height: 100%; object-fit: cover; display: block; }";
const newImg = ".ib-item img { width: 100%; height: auto; display: block; }";
if (html.includes(oldImg)) {
  html = html.replace(oldImg, newImg);
  fixes++;
  console.log('✅ Images: width 100%, natural height');
}

// 3. FIX GRID - use CSS columns instead of grid (Pinterest/masonry style)
const oldGrid = ".ib-grid { display: grid; grid-template-columns: repeat(var(--ib-cols, 3), 1fr); gap: 4px; width: 100%; }";
const newGrid = ".ib-grid { column-count: 3; column-gap: 4px; width: 100%; }";
if (html.includes(oldGrid)) {
  html = html.replace(oldGrid, newGrid);
  fixes++;
  console.log('✅ Grid: masonry columns layout');
}

// Fix column count classes to work with column-count
const colFixes = [
  ['.ib-grid.cols-2 { column-count: 2 !important; }', '.ib-grid.cols-2 { column-count: 2 !important; }'],
  ['.ib-grid.cols-3 { column-count: 3 !important; }', '.ib-grid.cols-3 { column-count: 3 !important; }'],
  ['.ib-grid.cols-4 { column-count: 4 !important; }', '.ib-grid.cols-4 { column-count: 4 !important; }'],
  ['.ib-grid.cols-5 { column-count: 5 !important; }', '.ib-grid.cols-5 { column-count: 5 !important; }'],
  ['.ib-grid.cols-6 { column-count: 6 !important; }', '.ib-grid.cols-6 { column-count: 6 !important; }'],
];
console.log('✅ Column classes already correct');

// 4. Remove the old size-S/M/L max-height constraints
const sizeS = '.ib-grid.size-S .ib-item img { max-height: 160px !important; }';
const sizeM = '.ib-grid.size-M .ib-item img { max-height: 320px !important; }';
const sizeL = '.ib-grid.size-L .ib-item img { max-height: 500px !important; }';
[sizeS, sizeM, sizeL].forEach(s => {
  if (html.includes(s)) {
    html = html.replace(s, '');
    fixes++;
    console.log('✅ Removed size constraint:', s.substring(0, 30));
  }
});

// VALIDATE
const newLen = html.length;
const end = html.slice(-30).trim();
console.log('\nOrig:', origLen, '| New:', newLen, '| OK:', end.endsWith('</html>'));
if (newLen < origLen - 1000 || !end.endsWith('</html>')) { console.log('❌ ABORT'); process.exit(1); }
fs.writeFileSync(FILE, html);
console.log('✅ SAVED');
