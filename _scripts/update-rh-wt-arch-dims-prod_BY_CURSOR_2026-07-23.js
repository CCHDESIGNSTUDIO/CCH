/**
 * Update production Cloud RH WT work orders with Arch plan # + dims
 * from Cloud_RH_WT_CCH_Rev2.pptx extract.
 *
 * Usage:
 *   node _scripts/update-rh-wt-arch-dims-prod_BY_CURSOR_2026-07-23.js
 *   node _scripts/update-rh-wt-arch-dims-prod_BY_CURSOR_2026-07-23.js --apply
 *
 * Matching:
 *   - Prefer sourceImport.slide (original import + split children via SPLIT_CHILD_SLIDE)
 *   - Else match by primary WO location tag (W1, W5.1, …)
 *
 * Writes (merge, non-destructive):
 *   measurements OPENING/WINDOW W/H + NOTES
 *   designIntent — replaces leading Arch: block; keeps body
 *   notes[0] — Rev2 update stamp
 *   sourceImport.rev2ArchUpdate — metadata
 */
'use strict';
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const JSON_PATH = path.join(__dirname, '_tmp_rh_wt_rev2_struct_BY_CURSOR.json');
const BOARD_ID = 'cloud-rolling-hills';

/** Split children created Jul 23 — inherit parent slide arch/dims. */
const SPLIT_CHILD_BY_LOCATION = {
  'W5.2': 11,
  'W13.2': 18,
  'W16.2': 20,
  'W22': 24,
  'W23': 24
};

if (!fs.existsSync(KEY)) {
  console.error('Missing key', KEY);
  process.exit(1);
}
if (!fs.existsSync(JSON_PATH)) {
  console.error('Missing extract. Run extract_rh_wt_rev2_pptx_BY_CURSOR_2026-07-23.py');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'rhWtArch');
const db = admin.app('rhWtArch').firestore();

function primaryTags(location) {
  const s = String(location || '');
  const tags = [];
  // W5.1, W13.2, W30, W3.1 …
  const re = /\bW\s*(\d+(?:\.\d+)?)\b/gi;
  let m;
  while ((m = re.exec(s))) {
    tags.push('W' + m[1]);
  }
  // bare "22" / "23" in "W21 & 22 & 23"
  const re2 = /(?:^|[&,]\s*|and\s+)(\d{1,2})(?!\.\d)/gi;
  while ((m = re2.exec(s))) {
    const n = m[1];
    if (!tags.includes('W' + n)) tags.push('W' + n);
  }
  return tags;
}

function stripArchPrefix(intent) {
  let s = String(intent || '');
  // Remove prior Arch: / Architectural plan # prefixes we may have injected
  s = s.replace(/^Architectural plan #:.*?(?:\nOpening dims.*?)?(?:\n\n|$)/i, '');
  s = s.replace(/^Arch:\s*.*?(?:\n\n|$)/i, '');
  return s.trim();
}

function mergeMeasurements(existing, patch, category) {
  const out = Object.assign({}, existing || {});
  const keys =
    category === 'drapery'
      ? ['WINDOW W', 'WINDOW H', 'NOTES']
      : ['OPENING W', 'OPENING H', 'NOTES'];
  keys.forEach((k) => {
    if (patch[k] != null && String(patch[k]).trim() !== '') out[k] = String(patch[k]);
  });
  // If drapery, clear conflicting opening keys we may have set wrongly earlier — leave alone unless patch has window keys
  return out;
}

(async () => {
  const extract = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const bySlide = new Map();
  (extract.workOrders || []).forEach((r) => bySlide.set(Number(r.slide), r));

  const snap = await db.collection('boards').doc(BOARD_ID).collection('workOrders').get();
  const updates = [];
  const unmatched = [];

  snap.forEach((doc) => {
    const x = doc.data() || {};
    const loc = String(x.location || '').trim();
    const src = x.sourceImport || {};
    let slide = Number(src.slide) || 0;

    // Split children: location-based slide override
    const locKey = loc.toUpperCase().replace(/\s+/g, '');
    Object.keys(SPLIT_CHILD_BY_LOCATION).forEach((k) => {
      if (locKey === k.toUpperCase() || loc.toUpperCase().startsWith(k.toUpperCase())) {
        slide = SPLIT_CHILD_BY_LOCATION[k];
      }
    });

    // Also match roller halves that were renamed W5.1 etc. but still have parent slide
    if (!slide || !bySlide.has(slide)) {
      const tags = primaryTags(loc);
      for (const tag of tags) {
        // find extract row whose location contains this tag
        for (const [sNum, row] of bySlide.entries()) {
          const rowTags = primaryTags(row.location);
          if (rowTags.includes(tag) || String(row.location).toUpperCase().includes(tag)) {
            slide = sNum;
            break;
          }
        }
        if (slide && bySlide.has(slide)) break;
      }
    }

    // Only touch WOs that came from RH WT import (or split children of those)
    const fromRh =
      (src.file && /Window Treatments|Cloud_RH_WT/i.test(src.file)) ||
      (src.splitFrom && true) ||
      Object.keys(SPLIT_CHILD_BY_LOCATION).some((k) => locKey === k.toUpperCase()) ||
      /^CLO-W-/i.test(String(x.workOrderNumber || ''));

    if (!fromRh) return;

    const row = bySlide.get(slide);
    if (!row) {
      unmatched.push({ id: doc.id, workOrderNumber: x.workOrderNumber, location: loc, slide });
      return;
    }

    const cat = x.category || row.category;
    const measPatch = row.measurements || {};
    // For drapery children of dual slides, use WINDOW keys even if extract row is roller
    let patch = Object.assign({}, measPatch);
    if (cat === 'drapery' && (patch['OPENING W'] || patch['OPENING H'])) {
      if (patch['OPENING W']) patch['WINDOW W'] = patch['OPENING W'];
      if (patch['OPENING H']) patch['WINDOW H'] = patch['OPENING H'];
      delete patch['OPENING W'];
      delete patch['OPENING H'];
    }
    if (cat !== 'drapery' && (patch['WINDOW W'] || patch['WINDOW H'])) {
      if (patch['WINDOW W']) patch['OPENING W'] = patch['WINDOW W'];
      if (patch['WINDOW H']) patch['OPENING H'] = patch['WINDOW H'];
      delete patch['WINDOW W'];
      delete patch['WINDOW H'];
    }

    const archLine = (row.arch && row.arch.archLine) || '';
    const body = stripArchPrefix(x.designIntent || '');
    const newIntent = (archLine ? archLine + '\n\n' : '') + body;

    const notes = Array.isArray(x.notes) ? x.notes.slice() : [];
    const stamp = (row.notes && row.notes[0]) || 'Updated from Cloud_RH_WT_CCH_Rev2.pptx (arch # + dims).';
    if (notes.length && /Imported from RH - Window Treatments|Updated from Cloud_RH_WT/i.test(notes[0])) {
      notes[0] = stamp;
    } else {
      notes.unshift(stamp);
    }

    const payload = {
      measurements: mergeMeasurements(x.measurements, patch, cat),
      designIntent: newIntent,
      notes,
      room: row.room || x.room,
      sourceImport: Object.assign({}, src, {
        rev2ArchUpdate: {
          file: 'Cloud_RH_WT_CCH_Rev2.pptx',
          slide: row.slide,
          archMark: (row.arch && row.arch.archMark) || '',
          archLine: archLine,
          updatedAt: new Date().toISOString(),
          by: 'Cursor Raul Builder'
        }
      }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    updates.push({
      id: doc.id,
      workOrderNumber: x.workOrderNumber,
      location: loc,
      slide: row.slide,
      archMark: (row.arch && row.arch.archMark) || '',
      w: patch['OPENING W'] || patch['WINDOW W'] || '',
      h: patch['OPENING H'] || patch['WINDOW H'] || '',
      notesMeas: patch.NOTES || '',
      payload
    });
  });

  updates.sort((a, b) => String(a.workOrderNumber).localeCompare(String(b.workOrderNumber)));
  console.log('Target: production', BOARD_ID, '| APPLY', APPLY);
  console.log('Would update:', updates.length, '| unmatched RH-like:', unmatched.length);
  updates.forEach((u) => {
    console.log(
      (APPLY ? 'UPDATE' : 'WOULD') ,
      u.workOrderNumber,
      u.location.slice(0, 28),
      '| S' + String(u.slide).padStart(2, '0'),
      '|',
      u.archMark.slice(0, 24),
      '|',
      (u.w || '-') + ' x ' + (u.h || '-')
    );
  });
  unmatched.forEach((u) => console.log(' UNMATCHED', u.workOrderNumber, u.location, 'slide', u.slide));

  if (APPLY) {
    for (const u of updates) {
      await db.collection('boards').doc(BOARD_ID).collection('workOrders').doc(u.id).update(u.payload);
    }
    console.log('Applied', updates.length, 'updates');
  } else {
    console.log('DRY-RUN — re-run with --apply');
  }
  console.log('https://cch-platform.web.app/builder/?projectId=cloud-rolling-hills');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
