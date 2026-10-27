/**
 * Split layered RH WT work orders on PRODUCTION (shade + drapery → two WOs).
 * Cindy GO Jul 23 — adjust Master Bedroom style dual treatments.
 *
 *   node _scripts/split-rh-dual-treatments-prod_BY_CURSOR_2026-07-23.js
 *   node _scripts/split-rh-dual-treatments-prod_BY_CURSOR_2026-07-23.js --apply
 */
'use strict';
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const BOARD = 'cloud-rolling-hills';

admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'splitDual');
const db = admin.app('splitDual').firestore();
const col = () => db.collection('boards').doc(BOARD).collection('workOrders');

function nextNum(existing) {
  let max = 0;
  existing.forEach((n) => {
    const m = String(n).match(/^CLO-W-(\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
  });
  return 'CLO-W-' + String(max + 1).padStart(2, '0');
}

function rollerSpecs(extra) {
  return Object.assign(
    {
      rollerMaterial: 'Solar',
      rollerPairing: 'Single tube',
      function: 'Operable',
      operation: 'Motorized',
      lining: 'Fabric only',
      mount: 'Ceiling recess · Roll off front',
      valanceStyle: 'Custom',
      stack: 'Custom'
    },
    extra || {}
  );
}

function draperySpecs(extra) {
  return Object.assign(
    {
      function: 'Operable',
      pleat: 'Pinch pleat - French',
      fullness: '2x',
      lining: 'Sheer lining',
      mount: 'Wall rod',
      hem: 'Touching',
      valanceStyle: 'None'
    },
    extra || {}
  );
}

const SPLITS = [
  {
    docId: 'gshl7IXedQlV9ufFUnPU', // CLO-W-06
    keep: {
      workOrderNumber: 'CLO-W-06',
      category: 'roller',
      location: 'W5.1',
      room: 'Master Bedroom — Slider',
      pieceQty: '1',
      designIntent:
        'W5.1 — ROLLER SOLAR / BLACKOUT PRIVACY SHADE recessed in 4″ metal fascia. Black housing & valance to match window frame. Shade color black; fascia TBD. Hardwired motorized remote. Drywall box to hide roller.',
      specs: rollerSpecs({ rollerMaterial: 'Blackout', opennessNote: '7-10% if solar face' }),
      specCustomText: {
        valanceStyle: '4″ metal fascia / black housing; fascia color TBD',
        stack: 'Recessed fascia / drywall box'
      },
      notes: [
        'Split from PPT slide 11 (was W5.1 & W5.2 combined).',
        'Paired sheer drapery is separate WO W5.2.'
      ],
      sameWindowTagMultipleTreatments: false,
      pairedTreatmentNote: 'See W5.2 sheer drapery panel on same slider.',
      shadeMaterialMode: 'vendor'
    },
    add: {
      category: 'drapery',
      location: 'W5.2',
      room: 'Master Bedroom — Slider',
      pieceQty: '1',
      designIntent:
        'W5.2 — Sheer drapery panel. Rod & ring or pull-track hardware. Not much room on left side because of cabinets — sheer will use less material.',
      specs: draperySpecs({ fullness: '1.5x' }),
      specCustomText: {},
      notes: [
        'Split from PPT slide 11 (was W5.1 & W5.2 combined).',
        'Paired motorized roller shade is separate WO W5.1.'
      ],
      sameWindowTagMultipleTreatments: false,
      pairedTreatmentNote: 'See W5.1 roller shade on same slider.',
      shadeMaterialMode: 'com'
    }
  },
  {
    docId: '6rZ9y1oAJWQzO2qjOsGu', // CLO-W-12
    keep: {
      workOrderNumber: 'CLO-W-12',
      category: 'roller',
      location: 'W13.1',
      room: 'Suite 2 — Windows',
      pieceQty: '1',
      designIntent:
        'W13.1 — Blackout privacy shade. Fascia color TBD. Manual continuous loop pull chain — left side.',
      specs: rollerSpecs({
        rollerMaterial: 'Blackout',
        operation: 'Continuous loop chain - LH',
        rollerPairing: 'Single tube'
      }),
      specCustomText: {
        valanceStyle: 'Fascia TBD',
        stack: 'Per elevation'
      },
      notes: ['Split from PPT slide 18 (was W13.1 & W13.2 combined).', 'Paired sheer drapery is W13.2.'],
      sameWindowTagMultipleTreatments: false,
      pairedTreatmentNote: 'See W13.2 operable sheer drapery.',
      shadeMaterialMode: 'vendor'
    },
    add: {
      category: 'drapery',
      location: 'W13.2',
      room: 'Suite 2 — Windows',
      pieceQty: '1',
      designIntent:
        'W13.2 — Operable drapery panels — sheer. Rod & ring or rod pull track.',
      specs: draperySpecs(),
      specCustomText: {},
      notes: ['Split from PPT slide 18 (was W13.1 & W13.2 combined).', 'Paired blackout shade is W13.1.'],
      sameWindowTagMultipleTreatments: false,
      pairedTreatmentNote: 'See W13.1 blackout shade.',
      shadeMaterialMode: 'com'
    }
  },
  {
    docId: '60xz6tEDsxR3XlXxKvJs', // CLO-W-14
    keep: {
      workOrderNumber: 'CLO-W-14',
      category: 'roller',
      location: 'W16.1',
      room: 'Suite 3 Bedroom — Windows',
      pieceQty: '1',
      designIntent:
        'W16.1 — Blackout privacy shade. Fascia color TBD. Manual continuous loop pull chain — left.',
      specs: rollerSpecs({
        rollerMaterial: 'Blackout',
        operation: 'Continuous loop chain - LH'
      }),
      specCustomText: { valanceStyle: 'Fascia TBD', stack: 'Per elevation' },
      notes: ['Split from PPT slide 20 (was W16.1 & W16.2 combined).', 'Paired sheer drapery is W16.2.'],
      sameWindowTagMultipleTreatments: false,
      pairedTreatmentNote: 'See W16.2 operable sheer drapery.',
      shadeMaterialMode: 'vendor'
    },
    add: {
      category: 'drapery',
      location: 'W16.2',
      room: 'Suite 3 Bedroom — Windows',
      pieceQty: '1',
      designIntent:
        'W16.2 — Operable drapery panels — sheer. Rod & ring or pull-track hardware.',
      specs: draperySpecs(),
      specCustomText: {},
      notes: ['Split from PPT slide 20 (was W16.1 & W16.2 combined).', 'Paired blackout shade is W16.1.'],
      sameWindowTagMultipleTreatments: false,
      pairedTreatmentNote: 'See W16.1 blackout shade.',
      shadeMaterialMode: 'com'
    }
  },
  {
    docId: 'ixZAo1Ie3nPNSp0BjWIx', // CLO-W-18 Theater — 3 ways
    keep: {
      workOrderNumber: 'CLO-W-18',
      category: 'roller',
      location: 'W21',
      room: 'Theater — Windows',
      pieceQty: '1',
      designIntent:
        'Theater windows — roller shade recessed in 4″ metal fascia. Shade color black; fascia TBD. Hardwired motorized. Black shade 7–10% openness. Black housing & valance to match frame.',
      specs: rollerSpecs({ rollerMaterial: 'Solar' }),
      specCustomText: {
        valanceStyle: '4″ metal fascia / black housing',
        stack: 'Recessed fascia'
      },
      notes: [
        'Split from PPT slide 24 (was W21 & 22 & 23 combined).',
        'Related: motorized drapery at windows + entry drapery as separate WOs.',
        'Note from PPT: operable wood shutters on 3 small windows — design TBD with paneling (not a WO yet).'
      ],
      sameWindowTagMultipleTreatments: false,
      pairedTreatmentNote: 'See drapery WOs for Theater windows & entry.',
      shadeMaterialMode: 'vendor'
    },
    addMany: [
      {
        category: 'drapery',
        location: 'W22',
        room: 'Theater — Windows',
        pieceQty: '1',
        designIntent: 'Theater windows — motorized drapery panels. Hardwired.',
        specs: draperySpecs({
          lining: 'Privacy liner',
          mount: 'Motorized track',
          function: 'Operable'
        }),
        specCustomText: {},
        notes: ['Split from PPT slide 24.', 'Paired roller shade is W21.'],
        sameWindowTagMultipleTreatments: false,
        pairedTreatmentNote: 'See W21 roller shade.',
        shadeMaterialMode: 'com'
      },
      {
        category: 'drapery',
        location: 'W23',
        room: 'Theater — Entry',
        pieceQty: '1',
        designIntent: 'Theater entry — operable drapery panels.',
        specs: draperySpecs({ lining: 'Privacy liner' }),
        specCustomText: {},
        notes: ['Split from PPT slide 24.', 'Entry drapery separate from window shade/drapery.'],
        sameWindowTagMultipleTreatments: false,
        pairedTreatmentNote: '',
        shadeMaterialMode: 'com'
      }
    ]
  }
];

(async () => {
  const snap = await col().get();
  const board = await db.collection('boards').doc(BOARD).get();
  const bdata = board.data() || {};
  const projectName = bdata.name || 'Cloud - Rolling Hills';
  let markup = '35';
  const mx = parseFloat(bdata.defaultProductMarkupPct);
  if (!isNaN(mx)) markup = String(mx);

  const numbers = [];
  snap.forEach((d) => numbers.push((d.data() || {}).workOrderNumber));

  const created = [];
  for (const job of SPLITS) {
    const ref = col().doc(job.docId);
    const cur = await ref.get();
    if (!cur.exists) {
      console.log('MISSING', job.docId);
      continue;
    }
    const before = cur.data() || {};
    console.log('\nUPDATE', before.workOrderNumber, before.location, '→', job.keep.location, job.keep.category);
    if (APPLY) {
      await ref.set(
        {
          ...job.keep,
          projectId: BOARD,
          projectName,
          proposalMarkupPct: markup,
          revision: Number(before.revision || 2),
          date: before.date || '8/4/2025',
          fabrics: before.fabrics || {},
          measurements: before.measurements || {},
          pickerSelections: {},
          fabNotes: ['Confirm COM / shade fabric before cutting.'],
          sourceImport: Object.assign({}, before.sourceImport || {}, {
            splitAt: new Date().toISOString(),
            splitFrom: before.location
          }),
          status: 'open',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }

    const extras = job.addMany ? job.addMany : job.add ? [job.add] : [];
    for (const add of extras) {
      const woNum = nextNum(numbers);
      numbers.push(woNum);
      console.log(APPLY ? 'CREATE' : 'WOULD CREATE', woNum, add.category, add.location, add.room);
      if (APPLY) {
        const nref = col().doc();
        await nref.set({
          ...add,
          workOrderNumber: woNum,
          projectId: BOARD,
          projectName,
          address: bdata.address || '',
          workroomId: '',
          workroomName: '',
          treatmentOptions: [],
          trimOptions: [],
          detailSelections: {},
          extraFabricRoles: [],
          fabricSlotKinds: {},
          fabricRoleOverrides: {},
          fabrics: {},
          measurements: {},
          pickerSelections: {},
          fabNotes: ['Confirm COM / shade fabric before cutting.'],
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
          shadeVendorMaterial: { partNo: '', colorName: '', manufacturer: '', collection: '', openness: '', notes: '' },
          workroomCosts: { lines: [], note: '' },
          proposalMarkupPct: markup,
          revision: 2,
          date: '8/4/2025',
          sourceImport: {
            file: 'RH - Window Treatments Rev 2 8.4.2025.pptx',
            splitFromDoc: job.docId,
            splitAt: new Date().toISOString(),
            by: 'Cursor Raul Builder',
            env: 'cch-design-boards'
          },
          status: 'open',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        created.push({ id: nref.id, workOrderNumber: woNum, location: add.location });
      } else {
        created.push({ workOrderNumber: woNum, location: add.location });
      }
    }
  }

  console.log('\nNew WOs:', created.length, '| APPLY', APPLY);
  if (!APPLY) console.log('DRY-RUN — re-run with --apply');
  else console.log('https://cch-platform.web.app/builder/?projectId=' + BOARD);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
