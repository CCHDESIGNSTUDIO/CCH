const path = require('path');
const admin = require('firebase-admin');
const SA = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SA)) });
const db = admin.firestore();

// Mirror cpPortalInspirationIdeabook's logic to see what gets accepted/rejected
function wouldRenderAsInspiration(ib) {
  if (!ib || ib.hiddenInNav) return { ok: false, why: 'hiddenInNav' };
  const t = String(ib.type || ib.boardType || '').toLowerCase().replace(/-/g, '_');
  if (t === 'design_board' || t === 'designboard') return { ok: false, why: 'type=design_board' };
  if (t === 'concept_board' || t === 'conceptboard' || t === 'concept') return { ok: false, why: 'type=concept_board' };
  const imgs = Array.isArray(ib.images) ? ib.images.length : 0;
  const items = Array.isArray(ib.items) ? ib.items.length : 0;
  if (imgs > 0 || items > 0) return { ok: true, why: `imgs=${imgs} items=${items}` };
  return { ok: false, why: 'no images and no items' };
}

(async () => {
  const snap = await db.collection('boards').doc('7225-bugletrail').collection('ideabooks').get();
  console.log(`Bugletrail ideabooks: ${snap.size}\n`);
  let ok = 0, blocked = 0;
  for (const d of snap.docs) {
    const x = d.data();
    const verdict = wouldRenderAsInspiration(x);
    const imgs = Array.isArray(x.images) ? x.images.length : 0;
    const tag = verdict.ok ? '✓' : '✗';
    if (verdict.ok) ok++; else blocked++;
    console.log(`  ${tag} ${d.id.padEnd(22)} type="${(x.type||x.boardType||'')}" hiddenInNav=${!!x.hiddenInNav} imgs=${imgs}  name="${(x.name||x.title||'').slice(0,40)}" — ${verdict.why}`);
  }
  console.log(`\nResult: ${ok} would render, ${blocked} blocked.`);
  process.exit(0);
})();
