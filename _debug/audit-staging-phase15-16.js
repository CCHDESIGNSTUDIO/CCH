const fs = require('fs');

const files = [
  '_debug/staging-phase1_5-execute.js',
  '_debug/staging-phase1_6-execute.js',
  '_debug/phase1_5-prod-execute-manifest.csv',
  '_debug/phase1_6-prod-execute-manifest.csv',
];

for (const file of files) {
  const s = fs.statSync(file);
  console.log(`${file}\n  mtime=${s.mtime.toISOString()}\n  size=${s.size}`);
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          q = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      q = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function summarizeManifest(file) {
  const txt = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const lines = txt.split(/\r?\n/).filter((x) => x.trim() !== '');
  const headers = parseCsvLine(lines[0]);
  const idxAction = headers.indexOf('action');
  const actionCounts = {};
  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const action = row[idxAction] || '';
    actionCounts[action] = (actionCounts[action] || 0) + 1;
  }
  console.log(
    `${file}\n  data_rows=${lines.length - 1}\n  action_counts=${JSON.stringify(actionCounts)}`
  );
}

summarizeManifest('_debug/phase1_5-prod-execute-manifest.csv');
summarizeManifest('_debug/phase1_6-prod-execute-manifest.csv');
