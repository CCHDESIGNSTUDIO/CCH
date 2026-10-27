#!/usr/bin/env node
'use strict';
/**
 * Restore RH clips wrongly deleted by cleanup (clipper source or real product titles).
 *   node _scripts/restore-rh-false-positive-clips_BY_CLAUDE_2026-06-02.js --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();
const PID = 'cloud-rolling-hills';
const APPLY = process.argv.includes('--apply');
const REPORT = path.join(__dirname, '..', '_backup', 'rh-junk-cleanup-2026-06-02', 'apply-report.json');

const PRODUCT_WORD = /\b(sink|pull|knob|pendant|sconce|chandelier|mirror|flush|mount|fixture|lamp|rug|sofa|chair|table|hardware|appliance|soapstone|welsbach|shade)\b/i;

function shouldRestore(entry) {
  const src = String(entry.source || '').toLowerCase();
  if (src === 'clipper' || src === 'cch-studio-clipper') return true;
  const t = String(entry.title || '');
  if (PRODUCT_WORD.test(t) && !/provide satisfying|become a go-to|vaudeville|cm\)depth|weight\s*:/i.test(t)) return true;
  return false;
}

async function findCatalog(title, vendor) {
  const t = String(title || '').trim();
  const v = String(vendor || '').trim().toLowerCase();
  for (const coll of ['products', 'productLibrary']) {
    let snap = await db.collection(coll).where('projectId', '==', PID).limit(500).get();
    for (const d of snap.docs) {
      const p = d.data() || {};
      if (String(p.title || '').trim() !== t) continue;
      if (v && String(p.vendor || '').trim().toLowerCase() !== v) continue;
      return { coll, id: d.id, data: p };
    }
    snap = await db.collection(coll).where('project', '==', 'Cloud - Rolling Hills').limit(500).get();
    for (const d of snap.docs) {
      const p = d.data() || {};
      if (String(p.title || '').trim() !== t) continue;
      return { coll, id: d.id, data: p };
    }
  }
  return null;
}

(async () => {
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'));
  const targets = (report.clipsToDelete || []).filter(shouldRestore);
  console.log('Candidates to restore:', targets.length);
  const plan = [];
  for (const e of targets) {
    const exists = await db.collection('boards').doc(PID).collection('clips').doc(e.id).get();
    if (exists.exists) {
      console.log('  skip (exists)', e.id, e.title);
      continue;
    }
    const cat = await findCatalog(e.title, '');
    plan.push({ entry: e, catalog: cat });
    console.log(' ', e.id, '|', e.source, '|', e.title, cat ? '→ catalog ' + cat.id : '→ no catalog');
  }
  if (!APPLY) {
    console.log('\nDry run. Use --apply to recreate', plan.length, 'clips at original IDs where possible.');
    return;
  }
  const ts = new Date().toISOString();
  let n = 0;
  for (const { entry, catalog } of plan) {
    const p = (catalog && catalog.data) || {};
    const payload = {
      title: entry.title,
      vendor: p.vendor || '',
      room: entry.room || p.room || '',
      category: (p.category || '').trim() || 'General',
      cost: parseFloat(p.cost || p.unitCost || p.costPrice) || 0,
      clientPrice: parseFloat(p.clientPrice || p.sellPrice || p.price) || 0,
      qty: parseFloat(p.qty) || 1,
      imageUrl: p.imageUrl || p.image || '',
      sku: p.sku || '',
      source: entry.source || 'clipper',
      libraryProductId: catalog ? catalog.id : (p.libraryProductId || null),
      addedAt: ts,
      updatedAt: ts,
      _restoredFromCleanupAt: ts,
    };
    if (Array.isArray(p.images) && p.images.length) payload.images = p.images.slice();
    await db.collection('boards').doc(PID).collection('clips').doc(entry.id).set(payload);
    if (catalog && entry.room) {
      try {
        await db.collection(catalog.coll).doc(catalog.id).update({ room: entry.room, updatedAt: ts });
      } catch (_e) {}
      if (catalog.coll === 'products') {
        try { await db.collection('productLibrary').doc(catalog.id).update({ room: entry.room, updatedAt: ts }); } catch (_e2) {}
      }
    }
    n++;
  }
  console.log('Restored', n, 'clips');
})().catch((e) => { console.error(e); process.exit(1); });
