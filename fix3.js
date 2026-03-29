const fs = require('fs');
let t = fs.readFileSync('platform/index.html', 'utf8');

// The issue: inside renderLibItems, the return statement has a backtick
// that closes the outer template literal prematurely.
// We need to find and fix this specific pattern.

const lines = t.split('\n');
let fixed = 0;

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  // Find the line with the broken pattern - ends with backtick-semicolon inside renderLibItems
  if (l.includes("toLocaleString('en-US'") && l.includes("minimumFractionDigits:2})") && l.includes("}):'-'</div></div>")) {
    console.log('Found broken line', i+1);
    // Fix: the '-' should be an em dash, and the backtick needs to be escaped
    lines[i] = l.replace(/\}:\'-\'\<\/div\>\<\/div\>\`\;?\s*\}\)\.join\(''\)\;?/, 
      `}:'—'</div></div>\`; }).join('');`);
    fixed++;
    console.log('Fixed to:', lines[i].substring(lines[i].length - 60));
  }
}

if (fixed === 0) {
  // Try broader search
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.includes("minimumFractionDigits:2}):'-'</div></div>")) {
      console.log('Found at line', i+1, '(broad match)');
      lines[i] = l.replace(/:'-'<\/div><\/div>`/, `:'—'</div></div>\``);
      fixed++;
    }
  }
}

if (fixed === 0) {
  // Show us exactly what's on the problem lines
  for (let i = 5690; i < 5700 && i < lines.length; i++) {
    console.log(i+1, ':', JSON.stringify(lines[i]).substring(0, 120));
  }
  console.log('No fix applied - showing context above');
} else {
  t = lines.join('\n');
  fs.writeFileSync('platform/index.html', t);
  console.log('✅ Fixed', fixed, 'lines. Total lines:', t.split('\n').length);
}
