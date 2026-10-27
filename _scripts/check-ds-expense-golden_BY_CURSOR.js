/**
 * Diff current redesign render of golden fixture vs committed client-view.html.
 * Exit 1 if the frozen render changed.
 * Usage: node _scripts/check-ds-expense-golden_BY_CURSOR.js
 */
'use strict';
var fs = require('fs');
var path = require('path');
var { spawnSync } = require('child_process');

var root = path.join(__dirname, '..');
var goldenPath = path.join(root, 'Docs', 'golden', 'ds-invoice-expenses', 'v1', 'client-view.html');
var tmpPath = path.join(root, 'Docs', 'golden', 'ds-invoice-expenses', 'v1', '_tmp-render.html');

if (!fs.existsSync(goldenPath)) {
  console.error('Missing golden reference:', goldenPath);
  console.error('Generate with: node _scripts/render-ds-expense-golden_BY_CURSOR.js');
  process.exit(1);
}

var r = spawnSync(process.execPath, [path.join(__dirname, 'render-ds-expense-golden_BY_CURSOR.js')], {
  cwd: root,
  encoding: 'utf8',
  env: Object.assign({}, process.env, { CCH_GOLDEN_OUT: tmpPath })
});
if (r.status !== 0) {
  console.error(r.stderr || r.stdout || 'render failed');
  process.exit(r.status || 1);
}

var a = fs.readFileSync(goldenPath, 'utf8').replace(/\r\n/g, '\n');
var b = fs.readFileSync(tmpPath, 'utf8').replace(/\r\n/g, '\n');
try { fs.unlinkSync(tmpPath); } catch (_e) {}

if (a === b) {
  console.log('GOLDEN OK — DS expense Client View render unchanged');
  process.exit(0);
}
console.error('GOLDEN FAIL — cch-invoice-redesign.js changed the frozen DS expense render.');
console.error('Per FABLE_DECISION_ds-invoice-expenses_CW_Jul30: reject, or get a NEW Fable decision + regenerate golden.');
console.error('Expected:', goldenPath);
process.exit(1);
