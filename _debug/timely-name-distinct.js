const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();
(async () => {
  // All Studio board names (for auto-suggest)
  const boards = [];
  const bSnap = await db.collection('boards').get();
  bSnap.forEach(d => boards.push({ id: d.id, name: d.data().name || '', client: d.data().clientName || d.data().client || '' }));

  // Distinct project names in timelyEntries (un-resolved)
  const counts = {};
  const teSnap = await db.collection('timelyEntries').get();
  teSnap.forEach(d => {
    const x = d.data();
    if (x.projectId) return;
    const n = (x.project || x.projectName || '(empty)').trim();
    counts[n] = (counts[n] || 0) + 1;
  });

  // Try auto-suggesting a board match for each
  function normalize(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function suggest(name) {
    const n = normalize(name);
    if (!n) return [];
    const exact = boards.filter(b => normalize(b.name) === n || normalize(b.id) === n);
    if (exact.length) return exact;
    const contains = boards.filter(b => normalize(b.name).includes(n) || n.includes(normalize(b.name)));
    return contains.slice(0, 3);
  }

  console.log(`Distinct un-resolved names: ${Object.keys(counts).length}`);
  console.log(`Total entries: ${Object.values(counts).reduce((s, n) => s + n, 0)}\n`);

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (const [name, c] of sorted) {
    const matches = suggest(name);
    let suggestion;
    if (matches.length === 0) suggestion = '(no Studio board match)';
    else if (matches.length === 1) suggestion = `→ ${matches[0].id}  (${matches[0].name})`;
    else suggestion = `AMBIGUOUS: ${matches.map(m => m.id).join(' OR ')}`;
    console.log(`  ${String(c).padStart(4)}  "${name.padEnd(35)}"  ${suggestion}`);
  }

  process.exit(0);
})();
