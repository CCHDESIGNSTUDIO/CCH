const fs = require('fs');
const p = process.argv[2] || 'studio-qb-invoice-compare-1779567853852.csv';
const lines = fs.readFileSync(p, 'utf8').trim().split('\n').slice(1);
const rows = lines.map((l) => {
  const p = l.split(',');
  return {
    result: p[0],
    method: p[1],
    num: p[2],
    board: p[4],
    sComp: parseFloat(p[6]) || 0,
    qbAmt: parseFloat(p[12]) || 0,
    delta: parseFloat(p[15]) || 0,
  };
});
const exact = rows.filter((r) => r.method === 'exact');
console.log('EXACT matches:', exact.filter((r) => r.result === 'MATCH').length);
console.log('EXACT amount mismatch:', exact.filter((r) => r.result.includes('AMOUNT')).length);
console.log('EXACT balance only:', exact.filter((r) => r.result === 'BALANCE_MISMATCH').length);
console.log('\nRolling Hills:');
rows
  .filter((r) => r.board.includes('Rolling Hills'))
  .forEach((r) => console.log(r.num, r.result, r.method, 'S', r.sComp, 'QB', r.qbAmt, 'Δ', r.delta));
