/**
 * Safe fix applicator for CCH Studio index.html
 * Run: node apply-fixes.js
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'platform', 'index.html');
let html = fs.readFileSync(FILE, 'utf8');
const origLen = html.length;
let fixes = 0;

function apply(label, search, replacement) {
  if (html.includes(search)) {
    html = html.replace(search, replacement);
    fixes++;
    console.log('✅ ' + label);
    return true;
  }
  console.log('⚠️ SKIP: ' + label);
  return false;
}

function insertAfter(label, search, content) {
  const idx = html.indexOf(search);
  if (idx >= 0) {
    html = html.slice(0, idx + search.length) + content + html.slice(idx + search.length);
    fixes++;
    console.log('✅ ' + label);
    return true;
  }
  console.log('⚠️ SKIP: ' + label);
  return false;
}

function insertBefore(label, search, content) {
  const idx = html.indexOf(search);
  if (idx >= 0) {
    html = html.slice(0, idx) + content + html.slice(idx);
    fixes++;
    console.log('✅ ' + label);
    return true;
  }
  console.log('⚠️ SKIP: ' + label);
  return false;
}

// =============================================
// FIX 1: Table/Tile toggle buttons
// =============================================
insertBefore('Table/Tile toggle',
  '<button class="btn btn-secondary btn-sm" onclick="showImageManager',
  '<button class="btn ${window._boardDisplayMode===\'tile\'?\'btn-secondary\':\'btn-primary\'} btn-sm" onclick="window._boardDisplayMode=\'table\';renderBoardsTab(document.getElementById(\'tabContent\'),{id:\'${escAttr(proj.id)}\',name:\'${escAttr(proj.name)}\'})">📊 Table</button>\n            <button class="btn ${window._boardDisplayMode===\'tile\'?\'btn-primary\':\'btn-secondary\'} btn-sm" onclick="window._boardDisplayMode=\'tile\';renderBoardsTab(document.getElementById(\'tabContent\'),{id:\'${escAttr(proj.id)}\',name:\'${escAttr(proj.name)}\'})">🖼️ Tiles</button>\n            '
);

// =============================================
// FIX 2: Add tile rendering function
// =============================================
const tileFuncCode = `
    function renderBoardTileView(groupedData, projId) {
      return Object.keys(groupedData).map(function(rm) {
        var items = groupedData[rm] || [];
        return '<div style="margin-bottom:24px;">' +
          '<div style="font-size:15px;font-weight:600;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid var(--gold);">' + esc(rm) + ' <span style="font-size:12px;color:var(--gray-400);font-weight:400;">' + items.length + ' items</span></div>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;">' +
          items.map(function(clip) {
            var imgSrc = clip.imageUrl || (clip.images && clip.images[0]) || '';
            var sell = parseFloat(clip.clientPrice) || parseFloat(clip.totalSelling) || 0;
            var isValid = imgSrc && (imgSrc.startsWith('http') || imgSrc.startsWith('data:'));
            return '<div style="background:var(--card,white);border:1px solid var(--border,#eee);overflow:hidden;cursor:pointer;" onclick="showClipDetail(\\'' + escAttr(projId) + '\\',\\'' + escAttr(clip.id) + '\\')">' +
              (isValid ? '<img src="' + escAttr(imgSrc) + '" style="width:100%;aspect-ratio:1;object-fit:cover;" referrerpolicy="no-referrer" onerror="this.style.display=\\'none\\'">' : '<div style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;background:var(--gray-100);color:var(--gray-300);font-size:32px;">📷</div>') +
              '<div style="padding:10px;">' +
                '<div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(clip.title || 'Untitled') + '</div>' +
                '<div style="font-size:11px;color:var(--gray-400);">' + esc(clip.vendor || '') + '</div>' +
                '<div style="font-size:11px;color:var(--gray-500);">' + esc(clip.room || '') + ' · ' + esc(clip.category || '') + '</div>' +
                (sell > 0 ? '<div style="font-size:13px;font-weight:600;color:var(--gold);font-family:monospace;margin-top:4px;">' + formatMoney(sell) + '</div>' : '') +
              '</div></div>';
          }).join('') +
          '</div></div>';
      }).join('');
    }
`;

insertBefore('Tile render function',
  'async function renderBoardsTab(T, proj)',
  tileFuncCode + '\n'
);

// =============================================
// FIX 3: Use tile view when mode is 'tile'
// Replace the table rendering section with a conditional
// =============================================
// Find where the item tables start (after room cards)
// The tables start with: clips.length === 0 ?
// We need to add a tile branch
const tableStart = 'clips.length === 0 ? `';
const tableIdx = html.indexOf(tableStart, 6300);
if (tableIdx > 0) {
  // Insert tile check before the table
  const tileCheck = "window._boardDisplayMode === 'tile' ? renderBoardTileView(window._boardViewMode === 'category' ? catGrouped : grouped, proj.id) : " + tableStart;
  html = html.slice(0, tableIdx) + tileCheck + html.slice(tableIdx + tableStart.length);
  fixes++;
  console.log('✅ Tile view conditional');
}

// =============================================
// FIX 4: Vanessa time entries - increase limit
// =============================================
apply('Dashboard time limit 500→5000',
  "const teSnap = await db.collection('timeEntries').limit(500).get();",
  "const teSnap = await db.collection('timeEntries').limit(5000).get();"
);

// =============================================
// VALIDATE
// =============================================
const newLen = html.length;
const end = html.slice(-30).trim();
console.log('\n--- RESULTS ---');
console.log('Fixes:', fixes);
console.log('Orig:', origLen, '| New:', newLen, '| Diff:', newLen - origLen);
console.log('Ends with </html>:', end.endsWith('</html>'));

if (newLen < origLen - 100 || !end.endsWith('</html>')) {
  console.log('❌ ABORT — file corrupted');
  process.exit(1);
}

fs.writeFileSync(FILE, html);
console.log('✅ SAVED');
