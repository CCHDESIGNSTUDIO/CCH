const fs = require('fs');
let t = fs.readFileSync('platform/index.html', 'utf8');

// Find and remove the old broken showNewProposalBuilder function
const startMarker = 'async function showNewProposalBuilder(projectId) {';
const startIdx = t.indexOf(startMarker);

if (startIdx === -1) {
  console.log('showNewProposalBuilder not found in index.html - already clean!');
} else {
  console.log('Found old showNewProposalBuilder at char', startIdx);
  
  // Find the matching closing brace by counting braces
  let depth = 0;
  let i = startIdx;
  let foundEnd = -1;
  
  while (i < t.length) {
    if (t[i] === '{') depth++;
    else if (t[i] === '}') {
      depth--;
      if (depth === 0) {
        foundEnd = i + 1;
        break;
      }
    }
    i++;
  }
  
  if (foundEnd > -1) {
    console.log('Found function end at char', foundEnd);
    // Remove the function
    t = t.substring(0, startIdx) + t.substring(foundEnd);
    fs.writeFileSync('platform/index.html', t);
    console.log('✅ Removed old showNewProposalBuilder. Lines:', t.split('\n').length);
  } else {
    console.log('Could not find end of function - trying line-based approach');
    // Find the line
    const lines = t.split('\n');
    const startLine = lines.findIndex(l => l.includes('async function showNewProposalBuilder'));
    console.log('Found at line', startLine + 1);
    
    // Find the next top-level function after it
    let endLine = -1;
    for (let j = startLine + 1; j < lines.length; j++) {
      if ((lines[j].match(/^    async function |^    function /) && !lines[j].includes('=>')) ||
          lines[j].includes('// ====================')) {
        endLine = j;
        break;
      }
    }
    
    if (endLine > -1) {
      console.log('Removing lines', startLine+1, 'to', endLine);
      lines.splice(startLine, endLine - startLine);
      t = lines.join('\n');
      fs.writeFileSync('platform/index.html', t);
      console.log('✅ Removed old function. Lines:', t.split('\n').length);
    } else {
      console.log('Could not find end line');
    }
  }
}
