const fs = require('fs');
let t = fs.readFileSync('platform/index.html', 'utf8');

// Find the last real function before corruption
const cutMarkers = [
  'price?\' if (!t) return',
  'price?\'$\'+price.toLocaleString',
];

let cut = -1;
for (const marker of cutMarkers) {
  const idx = t.indexOf(marker);
  if (idx > -1) { cut = idx; break; }
}

if (cut > -1) {
  // Find the start of the line with the corruption
  const lineStart = t.lastIndexOf('\n', cut);
  t = t.substring(0, lineStart);
  t += `
    function esc(t) { if (!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
    function escAttr(t) { if (!t) return ''; return t.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  </script>
</body>
</html>`;
  fs.writeFileSync('platform/index.html', t);
  console.log('✅ Restored! Lines:', t.split('\n').length);
} else {
  // Check if it ends properly already
  if (t.trimEnd().endsWith('</html>')) {
    console.log('File looks OK already. Lines:', t.split('\n').length);
  } else {
    // Just append the closing
    t = t.trimEnd();
    // Remove any partial line at end
    const lastNewline = t.lastIndexOf('\n');
    const lastLine = t.substring(lastNewline);
    if (!lastLine.includes('}') && !lastLine.includes(';')) {
      t = t.substring(0, lastNewline);
    }
    t += `
    function esc(t) { if (!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
    function escAttr(t) { if (!t) return ''; return t.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  </script>
</body>
</html>`;
    fs.writeFileSync('platform/index.html', t);
    console.log('✅ Fixed ending. Lines:', t.split('\n').length);
  }
}
