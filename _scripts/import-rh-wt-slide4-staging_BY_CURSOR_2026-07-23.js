/**
 * ONE-SHOT staging: create RH PPT slide-4 Roller WO (W1 Living Room) for Cloud - Rolling Hills.
 * Staging only. Dry by default unless --apply.
 *
 * Usage:
 *   node _scripts/import-rh-wt-slide4-staging_BY_CURSOR_2026-07-23.js
 *   node _scripts/import-rh-wt-slide4-staging_BY_CURSOR_2026-07-23.js --apply
 */
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'
);

admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'rhWtSlide4');
const db = admin.app('rhWtSlide4').firestore();

function nextWoNumber(projectName, category, existingRows) {
  const code = { style: 'W', drapery: 'W', roman: 'W', flatfold: 'W', roller: 'W' }[category] || 'W';
  const prefix = String(projectName || 'CLO')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 3) || 'CLO';
  // Cloud Rolling Hills → often CLO from first letters; Builder uses project name initials
  const base = prefix.length >= 2 ? prefix : 'CLO';
  let max = 0;
  (existingRows || []).forEach((r) => {
    const n = String(r.workOrderNumber || r.workOrder || '');
    const m = n.match(new RegExp('^' + base + '-' + code + '-(\\d+)$', 'i'));
    if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
  });
  const next = String(max + 1).padStart(2, '0');
  return base + '-' + code + '-' + next;
}

async function findRollingHillsBoard() {
  const boards = await db.collection('boards').get();
  const hits = [];
  boards.forEach((d) => {
    const x = d.data() || {};
    const blob = [d.id, x.name, x.projectName, x.title, x.clientName].join(' ').toLowerCase();
    if (/rolling\s*hills|cloud.*rolling|rolling.*hills/.test(blob)) {
      hits.push({ id: d.id, name: x.name || x.projectName || d.id });
    }
  });
  return hits;
}

(async () => {
  const hits = await findRollingHillsBoard();
  console.log('Board hits:', hits);
  if (!hits.length) {
    console.error('No Cloud / Rolling Hills board on staging.');
    process.exit(1);
  }
  // Prefer id/name that mentions both cloud and rolling if possible
  let board = hits.find((h) => /cloud/i.test(h.id + h.name) && /rolling/i.test(h.id + h.name));
  if (!board) board = hits.find((h) => /rolling/i.test(h.id + h.name));
  if (!board) board = hits[0];
  console.log('Using board:', board);

  const woSnap = await db.collection('boards').doc(board.id).collection('workOrders').get();
  const existing = [];
  woSnap.forEach((d) => {
    const x = d.data() || {};
    existing.push({ id: d.id, workOrderNumber: x.workOrderNumber || x.workOrder || '', room: x.room, location: x.location, category: x.category });
  });
  console.log('Existing WO count:', existing.length);

  const already = existing.find((x) => String(x.location || '').toUpperCase() === 'W1' && /living/i.test(String(x.room || '')));
  if (already) {
    console.log('W1 Living Room already exists:', already.id, already.workOrderNumber);
    console.log('Open: https://cch-platform-staging.web.app/builder/?projectId=' + encodeURIComponent(board.id) + '&wo=' + encodeURIComponent(already.id));
    process.exit(0);
  }

  const projectName = board.name || 'Cloud - Rolling Hills';
  let boardMarkup = '100';
  try {
    const bdoc = await db.collection('boards').doc(board.id).get();
    if (bdoc.exists) {
      const x = parseFloat((bdoc.data() || {}).defaultProductMarkupPct);
      if (!isNaN(x) && x >= 0) boardMarkup = String(x);
    }
  } catch (_e) {}
  console.log('Project default markup %:', boardMarkup);

  const woNum = nextWoNumber(projectName, 'roller', existing);
  // Force CLO-W-## style if nextWoNumber made something odd from long name
  let workOrderNumber = woNum;
  if (!/^CLO-W-/i.test(workOrderNumber)) {
    let max = 0;
    existing.forEach((r) => {
      const m = String(r.workOrderNumber || '').match(/^CLO-W-(\d+)$/i);
      if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
    });
    workOrderNumber = 'CLO-W-' + String(max + 1).padStart(2, '0');
  }

  const payload = {
    category: 'roller',
    projectId: board.id,
    projectName,
    address: '',
    workroomId: '',
    workroomName: '',
    workOrderNumber,
    room: 'Living Room — Sliding door',
    location: 'W1',
    designIntent:
      'ROLLER SOLAR SHADE / BLACK HOUSING & VALANCE TO MATCH WINDOW FRAME. HARDWIRED OPERATED REMOTE. BLACK SHADE 7–10% OPENNESS. Blackout privacy shade recessed in 4″ metal fascia. Shade color black; fascia color TBD. Box to hide roller shade (drywall).',
    treatmentOptions: [],
    sameWindowTagMultipleTreatments: false,
    pairedTreatmentNote: '',
    trimOptions: [],
    detailSelections: {},
    pieceQty: '1',
    date: '8/4/2025',
    extraFabricRoles: [],
    fabricSlotKinds: {},
    fabricRoleOverrides: {},
    specs: {
      rollerMaterial: 'Solar',
      rollerPairing: 'Single tube',
      function: 'Operable',
      operation: 'Motorized',
      lining: 'Fabric only',
      mount: 'Ceiling recess · Roll off front',
      valanceStyle: 'Custom',
      stack: 'Custom'
    },
    specCustomText: {
      valanceStyle: '4″ metal fascia / black housing; fascia color TBD; drywall box to hide roller',
      stack: 'Recessed fascia / housing per elevation'
    },
    fabrics: {},
    measurements: {},
    pickerSelections: {},
    notes: [
      'Blackout privacy shade recessed in 4″ metal fascia.',
      'Shade color — black. Fascia color — TBD.',
      'Hardwired — motorized (remote).',
      'Imported from RH Window Treatments Rev 2 8.4.2025.pptx — Slide 4 (W1). Staging test import.'
    ],
    fabNotes: [
      'Black shade 7–10% openness.',
      'Confirm solar fabric / openness with workroom before order.'
    ],
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
    shadeMaterialMode: 'vendor',
    shadeVendorMaterial: {
      partNo: '',
      colorName: 'Black',
      manufacturer: '',
      collection: '',
      openness: '7-10%',
      notes: 'Solar / blackout privacy per PPT — confirm vendor part #'
    },
    workroomCosts: { lines: [], note: '' },
    proposalMarkupPct: boardMarkup,
    revision: 2,
    sourceImport: {
      file: 'RH - Window Treatments Rev 2 8.4.2025.pptx',
      slide: 4,
      importedAt: new Date().toISOString(),
      by: 'Cursor Raul Builder'
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  console.log('Would create:', {
    boardId: board.id,
    workOrderNumber,
    room: payload.room,
    location: payload.location,
    category: payload.category
  });

  if (!APPLY) {
    console.log('DRY-RUN only. Re-run with --apply to write staging.');
    process.exit(0);
  }

  const ref = db.collection('boards').doc(board.id).collection('workOrders').doc();
  await ref.set(payload);
  console.log('CREATED', ref.id);
  console.log(
    'Open: https://cch-platform-staging.web.app/builder/?projectId=' +
      encodeURIComponent(board.id) +
      '&wo=' +
      encodeURIComponent(ref.id)
  );
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
