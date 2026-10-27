/**
 * Import RH Window Treatments PPT extract → boards/cloud-rolling-hills/workOrders
 *
 * Usage:
 *   node _scripts/import-rh-wt-all-BY_CURSOR_2026-07-23.js --project staging
 *   node _scripts/import-rh-wt-all-BY_CURSOR_2026-07-23.js --project production --apply
 *
 * Requires extract JSON from extract_rh_wt_pptx_BY_CURSOR_2026-07-23.py
 * Cindy GO Jul 23: production import of all RH WT slides.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const PROJECT_ARG = (function () {
  const i = process.argv.indexOf('--project');
  const v = i >= 0 ? process.argv[i + 1] : 'staging';
  if (v === 'production' || v === 'prod' || v === 'cch-design-boards') return 'cch-design-boards';
  return 'cch-studio-staging';
})();

const KEY_BY_PROJECT = {
  'cch-studio-staging': 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json',
  'cch-design-boards': 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
};
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', KEY_BY_PROJECT[PROJECT_ARG]);
const JSON_PATH = path.join(__dirname, '_tmp_rh_wt_slides_BY_CURSOR.json');
const BOARD_ID = 'cloud-rolling-hills';

if (!fs.existsSync(KEY)) {
  console.error('Missing service account key:', KEY);
  process.exit(1);
}
if (!fs.existsSync(JSON_PATH)) {
  console.error('Missing extract JSON. Run: python _scripts/extract_rh_wt_pptx_BY_CURSOR_2026-07-23.py');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'rhWtAll');
const db = admin.app('rhWtAll').firestore();

function nextWoNumber(existingRows, catCode) {
  let max = 0;
  (existingRows || []).forEach((r) => {
    const m = String(r.workOrderNumber || '').match(new RegExp('^CLO-' + catCode + '-(\\d+)$', 'i'));
    if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
  });
  return 'CLO-' + catCode + '-' + String(max + 1).padStart(2, '0');
}

function catCode(cat) {
  return { drapery: 'W', roman: 'W', flatfold: 'W', roller: 'W', style: 'W' }[cat] || 'W';
}

(async () => {
  const extract = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const board = await db.collection('boards').doc(BOARD_ID).get();
  if (!board.exists) {
    console.error('Board not found on', PROJECT_ARG, BOARD_ID);
    process.exit(1);
  }
  const bdata = board.data() || {};
  const projectName = bdata.name || 'Cloud - Rolling Hills';
  let markup = '100';
  const mx = parseFloat(bdata.defaultProductMarkupPct);
  if (!isNaN(mx) && mx >= 0) markup = String(mx);
  console.log('Target:', PROJECT_ARG, BOARD_ID, '| markup', markup + '%', '| APPLY', APPLY);

  const woSnap = await db.collection('boards').doc(BOARD_ID).collection('workOrders').get();
  const existing = [];
  const byTag = new Map();
  woSnap.forEach((d) => {
    const x = d.data() || {};
    const row = {
      id: d.id,
      workOrderNumber: x.workOrderNumber || '',
      location: String(x.location || '').trim(),
      room: String(x.room || '').trim(),
      category: x.category || '',
      sourceImport: x.sourceImport || null
    };
    existing.push(row);
    const key = (row.location + '|' + row.room).toUpperCase();
    byTag.set(key, row);
  });
  console.log('Existing WOs:', existing.length);
  console.log('Skipped in PPT:', (extract.skipped || []).length);
  (extract.skipped || []).forEach((s) => console.log('  skip S' + s.slide, s.reason, s.tag || ''));

  const created = [];
  const skippedExist = [];
  let seq = existing.slice();

  for (const row of extract.workOrders || []) {
    const key = (row.location + '|' + row.room).toUpperCase();
    const prior = byTag.get(key);
    if (prior && prior.sourceImport && prior.sourceImport.file && /Window Treatments Rev 2/i.test(prior.sourceImport.file)) {
      skippedExist.push({ slide: row.slide, id: prior.id, workOrderNumber: prior.workOrderNumber, reason: 'already imported' });
      continue;
    }
    // Also skip if exact tag already exists from any source (avoid dupes on re-run)
    if (prior && String(prior.location).toUpperCase() === String(row.location).toUpperCase()) {
      skippedExist.push({ slide: row.slide, id: prior.id, workOrderNumber: prior.workOrderNumber, reason: 'tag+room exists' });
      continue;
    }

    const code = catCode(row.category);
    const workOrderNumber = nextWoNumber(seq, code);
    const payload = {
      category: row.category,
      projectId: BOARD_ID,
      projectName,
      address: bdata.address || '',
      workroomId: '',
      workroomName: '',
      workOrderNumber,
      room: row.room,
      location: row.location,
      designIntent: row.designIntent || '',
      treatmentOptions: [],
      sameWindowTagMultipleTreatments: !!row.sameWindowTagMultipleTreatments,
      pairedTreatmentNote: row.pairedTreatmentNote || '',
      trimOptions: [],
      detailSelections: {},
      pieceQty: String(row.pieceQty || '1'),
      date: row.date || '8/4/2025',
      extraFabricRoles: [],
      fabricSlotKinds: {},
      fabricRoleOverrides: {},
      specs: row.specs || {},
      specCustomText: row.specCustomText || {},
      fabrics: {},
      measurements: {},
      pickerSelections: {},
      notes: row.notes || [],
      fabNotes: row.fabNotes || [],
      renderingUrl: '',
      detailSketchUrl: '',
      elevationUrl: '',
      sectionViewUrl: '',
      imageCaptions: {},
      imageSlotTitles: {},
      treatmentLayerDetails: {},
      trimBanding: {},
      trimOptionDetails: {},
      windowHardware: {},
      specAttachments: {},
      specAttachmentNotes: {},
      materialPlacementNote: '',
      swatchUrls: {},
      shadeMaterialMode: row.category === 'roller' ? 'vendor' : 'com',
      shadeVendorMaterial: {
        partNo: '',
        colorName: '',
        manufacturer: '',
        collection: '',
        openness: /7\s*[-–]\s*10/.test(row.designIntent || '') ? '7-10%' : '',
        notes: ''
      },
      workroomCosts: { lines: [], note: '' },
      proposalMarkupPct: markup,
      revision: Number(row.revision || 2),
      sourceImport: {
        file: 'RH - Window Treatments Rev 2 8.4.2025.pptx',
        slide: row.slide,
        importedAt: new Date().toISOString(),
        by: 'Cursor Raul Builder',
        env: PROJECT_ARG
      },
      status: 'open',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    console.log(
      (APPLY ? 'CREATE' : 'WOULD') + ' S' + String(row.slide).padStart(2, '0'),
      workOrderNumber,
      row.category,
      '|',
      row.location.slice(0, 36),
      '|',
      row.room.slice(0, 28)
    );

    if (APPLY) {
      const ref = db.collection('boards').doc(BOARD_ID).collection('workOrders').doc();
      await ref.set(payload);
      created.push({ id: ref.id, workOrderNumber, slide: row.slide, category: row.category, location: row.location, room: row.room });
      seq.push({ workOrderNumber });
      byTag.set(key, { id: ref.id, workOrderNumber, location: row.location, room: row.room });
    } else {
      seq.push({ workOrderNumber });
      created.push({ workOrderNumber, slide: row.slide, category: row.category, location: row.location, room: row.room });
    }
  }

  console.log('\nDone. Would/created:', created.length, '| already present:', skippedExist.length);
  if (!APPLY) console.log('DRY-RUN. Re-run with --apply to write', PROJECT_ARG);
  else {
    console.log('Builder:', 'https://' + (PROJECT_ARG === 'cch-design-boards' ? 'cch-platform.web.app' : 'cch-platform-staging.web.app') + '/builder/?projectId=' + BOARD_ID);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
