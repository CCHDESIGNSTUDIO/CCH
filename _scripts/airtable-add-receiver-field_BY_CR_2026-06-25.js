// DEPRECATED — do not run. Ship to (receiver / workroom) is the canonical PO column (fldQJbWEKb0Thi0fs).
// A duplicate "Receiver" text field was added Jun 25 by mistake; delete that column in Airtable if still present.
// Probe only: node _scripts/airtable-add-receiver-field_BY_CR_2026-06-25.js
const fs = require('fs');
const path = require('path');

function resolvePat() {
  if (process.env.AIRTABLE_PAT) return process.env.AIRTABLE_PAT.trim();
  for (const f of [path.join(process.cwd(), 'airtable-pat.env'), path.join(__dirname, '..', 'airtable-pat.env')]) {
    try {
      if (!fs.existsSync(f)) continue;
      const raw = fs.readFileSync(f, 'utf8').trim();
      const m = raw.match(/AIRTABLE_PAT\s*=\s*(.+)/);
      return (m ? m[1] : raw).trim().replace(/^["']|["']$/g, '');
    } catch (_e) {}
  }
  return '';
}

const BASE = 'app8Je7Mpc81giBre';
const TBL_PO = 'tblDclxZj88am7XMR';
const CREATE = process.argv.includes('--create');
const FIELD_NAME = 'Receiver';

(async () => {
  const PAT = resolvePat();
  if (!PAT) { console.error('No PAT found.'); process.exit(1); }
  const H = { Authorization: 'Bearer ' + PAT, 'Content-Type': 'application/json' };

  const res = await fetch('https://api.airtable.com/v0/meta/bases/' + BASE + '/tables', { headers: H });
  if (!res.ok) { console.error('Schema GET failed:', res.status, await res.text()); process.exit(1); }
  const data = await res.json();
  const t = (data.tables || []).find((x) => x.id === TBL_PO);
  if (!t) { console.error('PO table not found.'); process.exit(1); }

  console.log('TABLE:', t.name, '(' + t.id + ')');
  t.fields.forEach((f) => console.log('  ' + f.id + '  ' + JSON.stringify(f.name) + '  [' + f.type + ']'));

  const existing = t.fields.find((f) => f.name.toLowerCase() === FIELD_NAME.toLowerCase());
  if (existing) {
    console.log('\nReceiver field already exists -> id:', existing.id, '(' + existing.type + ')');
    return;
  }
  if (!CREATE) {
    console.log('\nNo "' + FIELD_NAME + '" field. Re-run with --create to add it (singleLineText).');
    return;
  }
  const mk = await fetch('https://api.airtable.com/v0/meta/bases/' + BASE + '/tables/' + TBL_PO + '/fields', {
    method: 'POST', headers: H,
    body: JSON.stringify({ name: FIELD_NAME, type: 'singleLineText', description: 'Clean receiving-party name (group/filter by this). Pushed from Studio po.receiver / ship-to company.' }),
  });
  const body = await mk.json();
  if (!mk.ok) { console.error('Create failed:', mk.status, JSON.stringify(body)); process.exit(1); }
  console.log('\nCreated "' + FIELD_NAME + '" -> id:', body.id);
})().catch((e) => { console.error(e); process.exit(1); });
