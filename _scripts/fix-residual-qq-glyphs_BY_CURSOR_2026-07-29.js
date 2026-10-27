'use strict';
/**
 * Replace residual UI literal ?? / ??? icon placeholders with \u25C7 escapes.
 * Does NOT touch JS nullish coalescing (a ?? b).
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'platform', 'index.html');
let s = fs.readFileSync(file, 'utf8');
const before = s;
let n = 0;

function countAndReplace(re, replacer) {
  s = s.replace(re, function () {
    n++;
    return typeof replacer === 'function' ? replacer.apply(null, arguments) : replacer;
  });
}

// Quoted '???' / "???"
countAndReplace(/(['"])\?\?\?\1/g, function (m, q) { return q + '\\u25C7' + q; });
// Quoted '??' / "??"
countAndReplace(/(['"])\?\?\1/g, function (m, q) { return q + '\\u25C7' + q; });
// HTML text >???< / >??<
countAndReplace(/>\?\?\?</g, '>\\u25C7<');
countAndReplace(/>\?\?</g, '>\\u25C7<');
// ">?? " title prefixes inside HTML strings
countAndReplace(/>\?\? /g, '>\\u25C7 ');
// "'?? " or '"?? '
countAndReplace(/(['"])\?\? /g, function (m, q) { return q + '\\u25C7 '; });

// Remaining ??? only when clearly a placeholder (not \u already)
countAndReplace(/\?\?\?/g, function (m, offset) {
  const ctx = s.slice(Math.max(0, offset - 4), offset + 6);
  if (ctx.indexOf('\\u') >= 0) return m;
  return '\\u25C7';
});

// Safety: nullish coalescing must remain
const nullish = (s.match(/\?\?/g) || []).length;
const sampleNullish = [];
const reN = /(\w|\))\s*\?\?\s*(\w|\d|\{)/g;
let mm;
while ((mm = reN.exec(s)) && sampleNullish.length < 5) sampleNullish.push(mm[0]);

const corrupted = (s.match(/\)\s*\\u25C7\s*\d|\]\s*\\u25C7\s*\d/g) || []).length;
console.log(JSON.stringify({
  replacements: n,
  remainingDoubleQuestion: nullish,
  sampleNullish,
  corruptedNullish: corrupted,
  deltaBytes: s.length - before.length
}, null, 2));

if (corrupted > 0) {
  console.error('ABORT: nullish coalescing corrupted');
  process.exit(2);
}
if (s === before) {
  console.log('No changes');
  process.exit(0);
}
fs.writeFileSync(file, s);
console.log('Wrote', file);
