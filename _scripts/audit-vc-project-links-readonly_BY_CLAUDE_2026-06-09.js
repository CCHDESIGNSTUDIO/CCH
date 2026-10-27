'use strict';
const path = require('path');
const admin = require('firebase-admin');

const STG_KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(STG_KEY)) }, 'audit').firestore();

const TARGETS = [
  { name: 'Dorchester Swing Arm', hz: '54119735', ids: ['3jYrSskhuEjIoRDgG2Og', 'MZQ9HYBC5CQHXgEGckR9'] },
  { name: 'Triple Swing Arm', hz: '54119798', ids: ['9HqT99oKs0RRgEopHZT3', 'sQw60hJ7rwHCp49vF5hA'] },
  { name: 'Gene Swing Arm', hz: '54119693', ids: ['2ncrO2RZkjbsNuGRnQuI', '8DrmZaAUMhWtgKYzf3Hx'] },
  { name: 'Primitive Swing Arm', hz: '54119633', ids: ['3AftwXJ8tYkxeGpOs51J', 'ESaTrtYGkTDZKtLEmI9R'] },
  { name: 'Dresser Long Glass Rod', hz: '54573708', ids: ['0Zz69j7dx6NmJYgTaRqt', 'KUrXiCQtawX9zskIEJyv'] },
  { name: 'Dorchester Double Backplate', hz: '33494541', ids: ['2guvBwvKdfdR8Y2tDhJN', '7TcGF81X9YpTB8Dy5c35', 'K1aKqebQPSsWVxb1Dykd'] },
];

function hasProj(p) {
  if (String(p.projectId || '').trim()) return true;
  if (String(p.project || '').trim()) return true;
  if (Array.isArray(p.projects) && p.projects.some((x) => String(x || '').trim())) return true;
  if (Array.isArray(p.projectNames) && p.projectNames.some((x) => String(x || '').trim())) return true;
  return false;
}

function projLabel(p) {
  const bits = [];
  if (p.projectId) bits.push(String(p.projectId));
  if (p.project) bits.push(String(p.project));
  (p.projects || []).forEach((x) => { if (x) bits.push(String(x)); });
  (p.projectNames || []).forEach((x) => { if (x) bits.push(String(x)); });
  return [...new Set(bits)].join(' | ') || '(none)';
}

(async () => {
  let total = 0;
  let withProj = 0;
  const projectSet = new Set();
  const byHz = {};

  for (const t of TARGETS) {
    console.log('\n' + t.name + ' (houzz ' + t.hz + ')');
    byHz[t.hz] = { rows: 0, withProj: 0, projects: new Set() };
    for (const id of t.ids) {
      total++;
      byHz[t.hz].rows++;
      let data = null;
      let col = 'missing';
      for (const c of ['products', 'products_archive']) {
        const snap = await db.collection(c).doc(id).get();
        if (snap.exists) { data = snap.data(); col = c; break; }
      }
      if (!data) {
        console.log('  ' + id + ' | MISSING');
        continue;
      }
      const hp = hasProj(data);
      if (hp) {
        withProj++;
        byHz[t.hz].withProj++;
        projLabel(data).split(' | ').forEach((x) => { projectSet.add(x); byHz[t.hz].projects.add(x); });
      }
      console.log('  ' + id + ' | ' + col + ' | project? ' + (hp ? 'YES' : 'NO') + ' | ' + projLabel(data));
    }
    console.log('  -> ' + byHz[t.hz].withProj + ' of ' + byHz[t.hz].rows + ' rows with project');
  }

  console.log('\n=== SUMMARY (staging) ===');
  console.log('Library rows checked:', total);
  console.log('Rows with project association:', withProj);
  console.log('Rows with NO project:', total - withProj);
  console.log('Distinct Houzz products (6):', TARGETS.length);
  const hzWithProj = TARGETS.filter((t) => byHz[t.hz].withProj > 0).length;
  console.log('Houzz product groups with at least one row tied to a project:', hzWithProj + ' of 6');
  console.log('Distinct projects:', [...projectSet].sort().join(', '));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
