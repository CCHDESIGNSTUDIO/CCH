const fs = require('fs');
let t = fs.readFileSync('platform/index.html', 'utf8');
const lines = t.split('\n');

console.log('Total lines:', lines.length);

// Show lines around 5694
for (let i = 5688; i < Math.min(5700, lines.length); i++) {
  console.log(i+1, ':', JSON.stringify(lines[i]).substring(0, 100));
}

// Find any line that ends mid-string with 'en or similar
let fixed = 0;
for (let i = 0; i < lines.length - 1; i++) {
  const l = lines[i];
  const next = lines[i+1];
  
  // Look for a line ending with a broken string before 'en-US'
  if (l.trimEnd().endsWith("'en") || l.includes("('en") && !l.includes("'en-US'") && !l.includes("'en'")) {
    console.log('\nFound broken line at', i+1, ':', JSON.stringify(l).substring(0, 100));
    console.log('Next line:', JSON.stringify(next).substring(0, 100));
  }
  
  // Also check for lines ending with toLocaleString( without closing
  if (l.includes('toLocaleString(') && !l.includes("'en-US'") && !l.includes('"en-US"')) {
    if (!l.trimEnd().endsWith(';') && !l.trimEnd().endsWith(',') && !l.trimEnd().endsWith('{')) {
      console.log('\nIncomplete toLocaleString at line', i+1, ':', JSON.stringify(l).substring(0,100));
      // Join with next line
      lines[i] = l + next.trim();
      lines.splice(i+1, 1);
      fixed++;
      console.log('Joined to:', JSON.stringify(lines[i]).substring(0,100));
    }
  }
}

if (fixed > 0) {
  t = lines.join('\n');
  fs.writeFileSync('platform/index.html', t);
  console.log('\n✅ Fixed', fixed, 'broken lines. New total:', t.split('\n').length);
} else {
  console.log('\nNo automatic fix applied.');
  // Show line 5693-5695 raw
  console.log('\nRaw line 5693:', JSON.stringify(lines[5692]));
  console.log('Raw line 5694:', JSON.stringify(lines[5693]));
  console.log('Raw line 5695:', JSON.stringify(lines[5694]));
}
