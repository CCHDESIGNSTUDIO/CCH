/**
 * Fix Room Board table: column alignment + inline editing
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'platform', 'index.html');
let html = fs.readFileSync(FILE, 'utf8');
const origLen = html.length;
let fixes = 0;

// 1. Add CSS for aligned table columns and inline editing
const tableCSS = `
    /* ROOM BOARD TABLE ALIGNMENT */
    .data-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    .data-table th, .data-table td { padding: 10px 12px; text-align: left; vertical-align: middle; font-size: 13px; border-bottom: 1px solid var(--border, #eee); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .data-table th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--gray-400, #888); font-weight: 600; position: sticky; top: 0; background: var(--card, white); z-index: 2; }
    .data-table th:nth-child(1) { width: 48px; } /* img */
    .data-table th:nth-child(2) { width: 22%; } /* title */
    .data-table th:nth-child(3) { width: 12%; } /* vendor */
    .data-table th:nth-child(4) { width: 10%; } /* category */
    .data-table th:nth-child(5) { width: 10%; } /* room */
    .data-table th:nth-child(6) { width: 8%; } /* cost */
    .data-table th:nth-child(7) { width: 8%; } /* sell */
    .data-table th:nth-child(8) { width: 7%; } /* markup */
    .data-table th:nth-child(9) { width: 5%; } /* qty */
    .data-table th:nth-child(10) { width: 8%; } /* total */
    .data-table th:nth-child(11) { width: 7%; } /* status */
    /* Inline edit */
    .data-table td[contenteditable="true"] { background: rgba(200,185,154,0.08); outline: 1px solid var(--gold, #C8B99A); cursor: text; }
    .data-table tr:hover { background: rgba(200,185,154,0.04); }
    .inline-edit-cell { cursor: pointer; }
    .inline-edit-cell:hover { text-decoration: underline dotted; text-underline-offset: 3px; }
`;

const styleIdx = html.indexOf('</style>');
if (styleIdx > 0 && !html.includes('ROOM BOARD TABLE ALIGNMENT')) {
  html = html.slice(0, styleIdx) + tableCSS + '\n  ' + html.slice(styleIdx);
  fixes++;
  console.log('✅ Table alignment CSS');
}

// 2. Add inline edit function for clip fields
if (!html.includes('function inlineEditClip')) {
  const editFunc = `
    function inlineEditClip(projectId, clipId, field, element) {
      var oldVal = element.textContent.trim();
      if (oldVal === '-') oldVal = '';
      element.contentEditable = 'true';
      element.focus();

      // Select all text
      var range = document.createRange();
      range.selectNodeContents(element);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);

      function save() {
        element.contentEditable = 'false';
        var newVal = element.textContent.trim();
        if (newVal === oldVal) return;

        var update = {};
        if (field === 'cost' || field === 'clientPrice' || field === 'qty') {
          update[field] = parseFloat(newVal) || 0;
        } else {
          update[field] = newVal;
        }

        db.collection('boards').doc(projectId).collection('clips').doc(clipId).update(update)
          .then(function() { showToast('Updated ' + field); })
          .catch(function(e) { showToast('Error: ' + e.message, 'error'); element.textContent = oldVal; });
      }

      element.onblur = save;
      element.onkeydown = function(e) { if (e.key === 'Enter') { e.preventDefault(); element.blur(); } if (e.key === 'Escape') { element.textContent = oldVal; element.contentEditable = 'false'; } };
    }
`;
  const insertPoint = html.indexOf('function closeModal()');
  if (insertPoint > 0) {
    html = html.slice(0, insertPoint) + editFunc + '\n    ' + html.slice(insertPoint);
    fixes++;
    console.log('✅ inlineEditClip function added');
  }
}

// 3. Make table cells clickable for inline editing
// Find the room board item rows and add onclick for inline edit
// The cells currently look like: '<td><strong>' + esc(clip.title) + '</strong></td>'
// We need to add onclick="inlineEditClip(...)" to editable cells

// Title cell - make editable
const titleCell = "'<td onclick=\"showClipDetail(\\'' + escAttr(proj.id) + '\\',\\'' + escAttr(clip.id) + '\\')\"><strong>' + esc(clip.title || 'Untitled') + '</strong>'";
const newTitleCell = "'<td class=\"inline-edit-cell\" onclick=\"inlineEditClip(\\'' + escAttr(proj.id) + '\\',\\'' + escAttr(clip.id) + '\\',\\'title\\',this)\"><strong>' + esc(clip.title || 'Untitled') + '</strong>'";

if (html.includes(titleCell)) {
  html = html.replace(titleCell, newTitleCell);
  fixes++;
  console.log('✅ Title cell inline editable');
}

// Vendor cell - make editable
const vendorCell = "'<td onclick=\"showClipDetail(\\'' + escAttr(proj.id) + '\\',\\'' + escAttr(clip.id) + '\\')\" style=\"font-size:12px;\">' + esc(clip.vendor || '-')";
const newVendorCell = "'<td class=\"inline-edit-cell\" style=\"font-size:12px;\" onclick=\"inlineEditClip(\\'' + escAttr(proj.id) + '\\',\\'' + escAttr(clip.id) + '\\',\\'vendor\\',this)\">' + esc(clip.vendor || '-')";

if (html.includes(vendorCell)) {
  html = html.replace(vendorCell, newVendorCell);
  fixes++;
  console.log('✅ Vendor cell inline editable');
}

// Cost cell - make editable
const costCell = "'<td style=\"color:var(--gray-600);\">' + (cost > 0 ? formatMoney(cost) : '-') + '</td>'";
const newCostCell = "'<td class=\"inline-edit-cell\" style=\"color:var(--gray-600);cursor:pointer;\" onclick=\"inlineEditClip(\\'' + escAttr(proj.id) + '\\',\\'' + escAttr(clip.id) + '\\',\\'cost\\',this)\">' + (cost > 0 ? formatMoney(cost) : '-') + '</td>'";

if (html.includes(costCell)) {
  html = html.replace(costCell, newCostCell);
  fixes++;
  console.log('✅ Cost cell inline editable');
}

// Sell price cell - make editable
const sellCell = "'<td style=\"color:var(--green);font-weight:600;\">' + (sell > 0 ? formatMoney(sell) : '-') + '</td>'";
const newSellCell = "'<td class=\"inline-edit-cell\" style=\"color:var(--green);font-weight:600;cursor:pointer;\" onclick=\"inlineEditClip(\\'' + escAttr(proj.id) + '\\',\\'' + escAttr(clip.id) + '\\',\\'clientPrice\\',this)\">' + (sell > 0 ? formatMoney(sell) : '-') + '</td>'";

if (html.includes(sellCell)) {
  html = html.replace(sellCell, newSellCell);
  fixes++;
  console.log('✅ Sell price cell inline editable');
}

// VALIDATE
const newLen = html.length;
const end = html.slice(-30).trim();
console.log('\n=== RESULTS ===');
console.log('Fixes:', fixes, '| Orig:', origLen, '| New:', newLen, '| OK:', end.endsWith('</html>'));
if (newLen < origLen - 100 || !end.endsWith('</html>')) { console.log('❌ ABORT'); process.exit(1); }
fs.writeFileSync(FILE, html);
console.log('✅ SAVED');
