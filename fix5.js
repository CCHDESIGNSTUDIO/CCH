const fs = require('fs');
let t = fs.readFileSync('platform/index.html', 'utf8');

// Fix 'en\n...-US' split strings anywhere in the file
const before = t.length;

// Pattern: 'en followed by newline then -US'
t = t.replace(/'en\r?\n\s*-US'/g, "'en-US'");

// Also fix any other broken toLocaleString patterns
t = t.replace(/toLocaleString\(\r?\n\s*'en-US'/g, "toLocaleString('en-US'");
t = t.replace(/toLocaleString\('en\r?\n\s*-US'/g, "toLocaleString('en-US'");

if (t.length !== before) {
  fs.writeFileSync('platform/index.html', t);
  console.log('✅ Fixed broken en-US strings. Lines:', t.split('\n').length);
} else {
  // Try char by char search around line 5694
  const lines = t.split('\n');
  const line = lines[5693]; // 0-indexed
  console.log('Line 5694 length:', line ? line.length : 'NOT FOUND');
  if (line) {
    // Find column 1073
    const around = line.substring(1060, 1090);
    console.log('Around col 1073:', JSON.stringify(around));
    
    // Check if line ends with 'en or similar
    const end = line.substring(line.length - 20);
    console.log('Line end:', JSON.stringify(end));
    
    const start5695 = lines[5694] ? lines[5694].substring(0, 30) : 'NO LINE';
    console.log('Line 5695 start:', JSON.stringify(start5695));
  }
  console.log('No automatic fix applied - showing diagnostics above');
}
