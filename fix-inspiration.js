/**
 * Fix Inspiration Board layout issues:
 * 1. Images fill tiles completely (object-fit: cover, no gaps)
 * 2. Grid fills full page width
 * 3. Page fits on screen (no overflow)
 * 4. Readable text on tabs and captions
 * 5. Remove S/M/L buttons, replace with column count only (3/4/5/6)
 * 6. Star/comment summary in header
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'platform', 'index.html');
let html = fs.readFileSync(FILE, 'utf8');
const origLen = html.length;
let fixes = 0;

// 1. Fix image CSS - images must fill tiles completely
// Find .ib-item img and force cover
const oldImgCSS = '.ib-item img {';
const imgIdx = html.indexOf(oldImgCSS);
if (imgIdx > 0) {
  const imgEnd = html.indexOf('}', imgIdx) + 1;
  const oldRule = html.substring(imgIdx, imgEnd);
  html = html.replace(oldRule, '.ib-item img { width: 100%; height: 100%; object-fit: cover; display: block; }');
  fixes++;
  console.log('✅ Images fill tiles (object-fit: cover)');
}

// 2. Fix .ib-item to be square with no padding/gaps
const oldItemCSS = '.ib-item {';
const itemIdx = html.indexOf(oldItemCSS);
if (itemIdx > 0) {
  const itemEnd = html.indexOf('}', itemIdx) + 1;
  const oldRule = html.substring(itemIdx, itemEnd);
  html = html.replace(oldRule, '.ib-item { position: relative; overflow: hidden; aspect-ratio: 1; cursor: pointer; border-radius: 0; }');
  fixes++;
  console.log('✅ Items are square with no rounded corners');
}

// 3. Fix grid to fill full width with no side padding
const oldGridCSS = '.ib-grid {';
const gridIdx = html.indexOf(oldGridCSS);
if (gridIdx > 0) {
  const gridEnd = html.indexOf('}', gridIdx) + 1;
  const oldRule = html.substring(gridIdx, gridEnd);
  html = html.replace(oldRule, '.ib-grid { display: grid; grid-template-columns: repeat(var(--ib-cols, 3), 1fr); gap: 4px; width: 100%; }');
  fixes++;
  console.log('✅ Grid fills full width');
}

// 4. Replace S/M/L buttons with column count buttons (3/4/5/6)
// Find the size buttons area
const smlPattern = /Small<\/button>\s*<button[^>]*>Medium<\/button>\s*<button[^>]*>Large<\/button>/;
if (smlPattern.test(html)) {
  html = html.replace(smlPattern,
    "3</button> <button class=\"btn btn-secondary btn-sm\" style=\"padding:4px 10px;font-size:12px;\" onclick=\"document.querySelector('.ib-grid').style.setProperty('--ib-cols','4')\">4</button> <button class=\"btn btn-secondary btn-sm\" style=\"padding:4px 10px;font-size:12px;\" onclick=\"document.querySelector('.ib-grid').style.setProperty('--ib-cols','5')\">5</button> <button class=\"btn btn-secondary btn-sm\" style=\"padding:4px 10px;font-size:12px;\" onclick=\"document.querySelector('.ib-grid').style.setProperty('--ib-cols','6')\">6</button>"
  );
  fixes++;
  console.log('✅ Replaced S/M/L with column count 3/4/5/6');
} else {
  // Try alternate pattern
  const altSml = html.match(/onclick="[^"]*ibSize[^"]*'small'[^"]*"[^>]*>[^<]*<\/button>/);
  if (altSml) {
    console.log('Found alt SML pattern:', altSml[0].substring(0, 60));
  } else {
    // Find any S M L buttons near ib-grid
    const sIdx = html.indexOf("ibSize='small'");
    const mIdx = html.indexOf("ibSize='medium'");
    const lIdx = html.indexOf("ibSize='large'");
    if (sIdx > 0) console.log('Found ibSize small at:', sIdx);
    if (mIdx > 0) console.log('Found ibSize medium at:', mIdx);
    if (lIdx > 0) console.log('Found ibSize large at:', lIdx);

    // Try finding the actual buttons
    const smlArea = html.indexOf("'>S</button>");
    if (smlArea > 0) {
      console.log('Found S button at:', smlArea);
      console.log('Context:', html.substring(smlArea - 100, smlArea + 100));
    }
  }
}

// 5. Fix tab text readability
const tabCSS = '.ib-section-tab {';
const tabIdx = html.indexOf(tabCSS);
if (tabIdx > 0) {
  const tabEnd = html.indexOf('}', tabIdx) + 1;
  const oldTab = html.substring(tabIdx, tabEnd);
  // Make tab text darker and bigger
  html = html.replace(oldTab, '.ib-section-tab { padding: 8px 16px; font-size: 13px; font-weight: 600; color: var(--text, #0E1629); cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }');
  fixes++;
  console.log('✅ Tab text readable');
}

// 6. Fix caption area under images
const captionCSS = '.ib-item-caption {';
const capIdx = html.indexOf(captionCSS);
if (capIdx > 0) {
  const capEnd = html.indexOf('}', capIdx) + 1;
  const oldCap = html.substring(capIdx, capEnd);
  html = html.replace(oldCap, '.ib-item-caption { position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 10px; background: rgba(0,0,0,0.6); color: white; font-size: 12px; font-weight: 500; }');
  fixes++;
  console.log('✅ Caption overlay on image');
}

// 7. Fix page not fitting screen - content area needs proper overflow
const contentFix = '\n    /* FIX PAGE FIT */\n    .ib-section-content { padding: 0 !important; margin: 0; width: 100%; box-sizing: border-box; }\n    .ib-section-tabs { overflow-x: auto; white-space: nowrap; gap: 0; }\n';
const styleEnd = html.indexOf('</style>');
if (styleEnd > 0 && !html.includes('FIX PAGE FIT')) {
  html = html.slice(0, styleEnd) + contentFix + html.slice(styleEnd);
  fixes++;
  console.log('✅ Page fit CSS');
}

// VALIDATE
const newLen = html.length;
const end = html.slice(-30).trim();
console.log('\n=== RESULTS ===');
console.log('Fixes:', fixes, '| Orig:', origLen, '| New:', newLen, '| OK:', end.endsWith('</html>'));
if (newLen < origLen - 500 || !end.endsWith('</html>')) { console.log('❌ ABORT'); process.exit(1); }
fs.writeFileSync(FILE, html);
console.log('✅ SAVED');
