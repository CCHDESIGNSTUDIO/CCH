#!/usr/bin/env node
'use strict';
/**
 * Sync INV-6017 canonical lines → linked room-board clips (room + image + doc tags).
 * Remove orphan duplicate clips in the invoice room that are NOT the linked clipId.
 *
 *   node sync-inv6017-clips-to-roomboards_BY_CLAUDE_2026-06-03.js
 *   node sync-inv6017-clips-to-roomboards_BY_CLAUDE_2026-06-03.js --apply
 */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const PID = 'cloud-rolling-hills';
const INV_NUM = 'INV-6017';
const APPLY = process.argv.includes('--apply');
const BACKUP = path.join(__dirname, '..', '_backup', 'inv6017-roomboard-sync-2026-06-03');

function hero(x) {
  if (!x) return '';
  if (Array.isArray(x.images) && x.images.length) {
    const im = x.images[0];
    return String(typeof im === 'string' ? im : (im && (im.url || im.imageUrl)) || '').trim();
  }
  return String(x.imageUrl || x.image || '').trim();
}

function normTitle(t) {
  return String(t || '').toLowerCase().replace(/\s+/g, ' ').replace(/\|.*$/, '').trim();
}

function titleMatches(a, b) {
  const na = normTitle(a);
  const nb = normTitle(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const short = na.length <= nb.length ? na : nb;
  const long = na.length > nb.length ? na : nb;
  return long.indexOf(short) >= 0 && short.length >= 8;
}

function vendorMatch(a, b) {
  const va = String(a || '').toLowerCase().trim();
  const vb = String(b || '').toLowerCase().trim();
  if (!va || !vb) return true;
  return va === vb || va.indexOf(vb) >= 0 || vb.indexOf(va) >= 0;
}

(async () => {
  fs.mkdirSync(BACKUP, { recursive: true });
  const ts = new Date().toISOString();

  let invRef = null;
  let invId = '';
  let invData = null;
  const invSnap = await db.collection('boards').doc(PID).collection('invoices').get();
  for (const d of invSnap.docs) {
    const x = d.data() || {};
    const num = String(x.invoiceNum || x.number || x.name || '').trim();
    if (num === INV_NUM || d.id === INV_NUM) {
      invRef = d.ref;
      invId = d.id;
      invData = x;
      break;
    }
  }
  if (!invData) {
    console.error('Invoice not found:', INV_NUM);
    process.exit(1);
  }

  const clipSnap = await db.collection('boards').doc(PID).collection('clips').get();
  const allClips = [];
  clipSnap.forEach((d) => allClips.push({ id: d.id, ref: d.ref, data: d.data() || {} }));

  const linkedClipIds = new Set();
  const report = { mode: APPLY ? 'apply' : 'dry-run', invId, synced: [], orphansRemoved: [], errors: [] };

  for (let idx = 0; idx < (invData.items || []).length; idx++) {
    const line = invData.items[idx] || {};
    const title = String(line.title || line.description || '').trim();
    if (!title) continue;
    const clipId = String(line.clipId || line.sourceClipId || '').trim();
    if (!clipId) {
      report.errors.push({ line: idx, title, reason: 'no clipId on invoice line' });
      continue;
    }
    linkedClipIds.add(clipId);

    const room = String(line.room || '').trim();
    const img = hero(line);
    const clipEntry = allClips.find((c) => c.id === clipId);
    if (!clipEntry) {
      report.errors.push({ line: idx, title, clipId, reason: 'clip doc missing' });
      continue;
    }

    const patch = {
      room,
      title: title.split('|')[0].trim(),
      vendor: String(line.vendor || clipEntry.data.vendor || '').trim(),
      category: String(line.category || clipEntry.data.category || '').trim() || undefined,
      invoiceId: invId,
      invoiceNum: INV_NUM,
      houzzInvoice: INV_NUM,
      updatedAt: ts,
      _syncedFromInv6017At: ts,
    };
    if (line.houzzId || line.houzzProductId) {
      patch.houzzId = String(line.houzzId || line.houzzProductId).trim();
    }
    const lid = String(line.libraryProductId || line.linkedLibraryProductId || clipEntry.data.libraryProductId || '').trim();
    if (lid) {
      patch.libraryProductId = lid;
      patch.linkedLibraryProductId = lid;
    }
    if (img) {
      patch.imageUrl = img;
      patch.image = img;
      patch.images = Array.isArray(line.images) && line.images.length ? line.images.slice() : [img];
      patch.heroImageIndex = 0;
    }
    if (line.cost != null) patch.cost = line.cost;
    if (line.amount != null || line.clientPrice != null) {
      patch.clientPrice = line.amount || line.clientPrice;
    }

    report.synced.push({
      line: idx,
      title,
      room,
      clipId,
      beforeRoom: clipEntry.data.room,
      imageFromInv: !!img,
    });

    if (APPLY) {
      await clipEntry.ref.set(patch, { merge: true });
      if (lid && img) {
        const catPatch = { room, imageUrl: img, image: img, images: patch.images, updatedAt: ts, _syncedFromInv6017At: ts };
        try { await db.collection('products').doc(lid).set(catPatch, { merge: true }); } catch (_e) {}
        try { await db.collection('productLibrary').doc(lid).set(catPatch, { merge: true }); } catch (_e2) {}
      }
    }

    // Orphan duplicates in invoice room (not the linked clip, same product name)
    if (!room) continue;
    for (const c of allClips) {
      if (c.id === clipId) continue;
      if (String(c.data.room || '').trim() !== room) continue;
      if (!titleMatches(c.data.title, title)) continue;
      if (!vendorMatch(c.data.vendor, line.vendor)) continue;
      if (linkedClipIds.has(c.id)) continue;
      const src = String(c.data.source || '').toLowerCase();
      const onInv = String(c.data.invoiceNum || c.data.invoiceId || '').indexOf('6017') >= 0;
      if (onInv && c.id === clipId) continue;
      // Remove library spawns and unlinked duplicates; keep clipper only if not linked anywhere
      const isOrphan = !onInv || src === 'library';
      if (!isOrphan && src === 'clipper' && !onInv) {
        // unlinked clipper duplicate in same room
      } else if (!isOrphan && src !== 'library') continue;

      report.orphansRemoved.push({
        clipId: c.id,
        title: c.data.title,
        room,
        source: c.data.source,
        forInvLine: title,
      });
      if (APPLY) {
        const backup = { id: c.id, data: c.data };
        fs.appendFileSync(path.join(BACKUP, 'deleted-clips.jsonl'), JSON.stringify(backup) + '\n');
        await c.ref.delete();
        const lib = String(c.data.libraryProductId || '').trim();
        if (lib) {
          try {
            await db.collection('products').doc(lib).update({
              room: admin.firestore.FieldValue.delete(),
              updatedAt: ts,
              _orphanClearedFromInv6017Sync: ts,
            });
          } catch (_e3) {}
        }
      }
    }
  }

  fs.writeFileSync(path.join(BACKUP, `${APPLY ? 'apply' : 'dry-run'}-report.json`), JSON.stringify(report, null, 2));

  console.log('=== INV-6017 → room board sync ===');
  console.log('Mode:', report.mode);
  console.log('Lines synced to clips:', report.synced.length);
  console.log('Orphan clips to remove:', report.orphansRemoved.length);
  if (report.errors.length) console.log('Errors:', report.errors.length);
  console.log('Report:', path.join(BACKUP, `${APPLY ? 'apply' : 'dry-run'}-report.json`));

  console.log('\nTheater:');
  report.synced.filter((s) => s.room === 'Theater').forEach((s) => {
    console.log('  SYNC', s.clipId, s.title, '(was room', s.beforeRoom + ')');
  });
  report.orphansRemoved.filter((o) => o.room === 'Theater').forEach((o) => {
    console.log('  DELETE orphan', o.clipId, o.title);
  });

  if (!APPLY) console.log('\nRun with --apply to write.');
})();
