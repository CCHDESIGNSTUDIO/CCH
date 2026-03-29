const fs = require('fs');
let t = fs.readFileSync('platform/index.html', 'utf8');

// Fix the broken toLocaleString line - the issue is a quote mismatch
// Find and fix the specific broken pattern
const broken = "price?'$'+price.toLocaleString('en-US',{minimumFractionDigits:2}):'-'}</div></div>`;";
const fixed = "price?'$'+price.toLocaleString('en-US',{minimumFractionDigits:2}):'—'}</div></div>\`; }).join('');";

if (t.includes(broken)) {
  t = t.replace(broken, fixed);
  console.log('✓ Fixed toLocaleString line');
} else {
  // Try to find the broken pattern another way
  const lines = t.split('\n');
  let fixedCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("toLocaleString('en-US'") && lines[i].includes("minimumFractionDigits:2}):'-'") && !lines[i].includes("}).join")) {
      console.log('Found at line', i+1, ':', lines[i].substring(0, 80));
      // This line is cut off - append the missing part
      lines[i] = lines[i].replace(/:\'-\'\}.*$/, ":'—'}</div></div>\`; }).join('');");
      fixedCount++;
    }
  }
  if (fixedCount > 0) {
    t = lines.join('\n');
    console.log('✓ Fixed', fixedCount, 'lines');
  } else {
    // Find the error area and show context
    const idx = t.indexOf("toLocaleString('en-US'");
    if (idx > -1) {
      console.log('Found toLocaleString at char', idx);
      console.log('Context:', JSON.stringify(t.substring(idx-20, idx+100)));
    }
    console.log('Could not find the exact broken pattern');
  }
}

fs.writeFileSync('platform/index.html', t);
console.log('Done. Lines:', t.split('\n').length);
