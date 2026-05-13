// Seed staging Firestore with one test project + one test proposal.
// Mirrors PRO-3006 / 7225 Bugletrail / April Bulatao from the brief test scenario.
// Run: node seed-staging.js
//
// Writes to: cch-studio-staging Firebase project
// Project ID written:    7225-bugletrail-staging
// Proposal ID written:   PRO-3006-staging
//
// Safe to re-run — deterministic doc IDs, will overwrite same docs.

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, collection } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: 'AIzaSyBIwwo7uRij6Q0FZg-qmIS1LC8t2AjXrYo',
  authDomain: 'cch-studio-staging.firebaseapp.com',
  projectId: 'cch-studio-staging',
  storageBucket: 'cch-studio-staging.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:fcd520b30c0d50b149736d',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const PROJECT_ID = '7225-bugletrail-staging';
const PROPOSAL_ID = 'PRO-3006-staging';
const NOW = new Date().toISOString();

// Project doc
const projectData = {
  name: '7225 Bugletrail',
  clientName: 'April Bulatao',
  clientEmail: 'april@example-staging.com',
  address: '7225 Bugletrail',
  status: 'Active',
  createdAt: NOW,
  updatedAt: NOW,
  source: 'staging-seed',
  hourlyProject: false,
  fee: 6261.87,
  rooms: ['Kitchen', 'Living', 'Master Bath', 'Powder Room', 'Office'],
};

// Proposal doc with line items mirroring the screenshot
const proposalItems = [
  { title: 'Daso Textured Bowl', description: 'Diameter: 4.7" Height: 2.3" Our Daso Bowl - a textured bowl with uneven edges, crafted meticulously', vendor: 'Faire Fancy Concrete', room: 'Kitchen', qty: 4, cost: 15, sell: 90, total: 90, approval: 'pending' },
  { title: 'Daza Bowl | Catchall Bowl', description: 'Measurements: Bowl Diameter: 6 3/4" Tall: 2.3"  Each concrete item is handmade from scratch', vendor: '', room: 'Kitchen', qty: 2, cost: 22.78, sell: 68.34, total: 68.34, approval: 'pending' },
  { title: 'Maura Oval Bowl-Lg', description: 'Overall 17"L x 11.25"W x 10"H (7.3 lbs) Food Safe: Product is Food Safe Watertight: Product is Watertight', vendor: 'Global Views', room: 'Kitchen', qty: 1, cost: 252, sell: 340.20, total: 340.20, approval: 'approved' },
  { title: 'Maura Oval Bowl-Sm', description: 'Overall 16"L x 9.5"W x 6"H (4.1 lbs) Food Safe: Product is Food Safe Watertight: Product is Watertight', vendor: '', room: 'Kitchen', qty: 1, cost: 219, sell: 295.65, total: 295.65, approval: 'approved' },
  { title: 'Offset Round Vase-Moss Green', description: 'Overall 10"L x 5.5"W x 8"H (15.3 lbs) Watertight: Product is Watertight Hand wash', vendor: 'Global Views', room: 'Kitchen', qty: 1, cost: 384, sell: 518.40, total: 518.40, approval: 'pending' },
  { title: 'Offset Vase-Moss Green-Sm', description: 'Overall 6"L x 4.5"W x 10.5"H (11.6 lbs) Watertight: Product is Watertight Hand wash', vendor: 'Global Views', room: '', qty: 1, cost: 384, sell: 518.40, total: 518.40, approval: 'pending' },
  { title: 'Pleated Bowl-Bronze Stripe-Lg', description: 'Overall 19.5"L x 12"W x 8.5"H (8 lbs) Food Safe: Product is Food Safe Watertight', vendor: 'Global Views', room: '', qty: 1, cost: 274, sell: 369.90, total: 369.90, approval: 'pending' },
  { title: 'Pleated Bowl-Bronze Stripe-Med', description: 'Overall 16.5"L x 9.75"W x 7.5"H (4.9 lbs) Food Safe', vendor: 'Global Views', room: '', qty: 1, cost: 252, sell: 340.20, total: 340.20, approval: 'pending' },
  { title: 'Pleated Bowl-Bronze Stripe-Sm', description: 'Overall 11.5"L x 6.25"W x 5"H (2.2 lbs) Food Safe: Product is Food Safe Watertight', vendor: 'Global Views', room: '', qty: 1, cost: 164, sell: 221.40, total: 221.40, approval: 'pending' },
  { title: 'Square Tower Vase-Dark Amber', description: 'Overall 3.5"L x 3.5"W x 21.75"H (3.3 lbs) Watertight: Product is Watertight Handwash', vendor: 'Global Views', room: '', qty: 1, cost: 593, sell: 800.55, total: 800.55, approval: 'pending' },
  { title: 'Soft Rectangle Vase-Dark Amber', description: 'Overall 10"L x 3.5"W x 11"H (15.9 lbs) Watertight: Product is Watertight Hand Wash', vendor: 'Global Views', room: 'Kitchen', qty: 1, cost: 626, sell: 845.10, total: 845.10, approval: 'pending' },
  { title: '8" pepper mill', description: 'Priced individually. These stunning tried and true salt & pepper grinders have been in the market', vendor: 'roaniris.co', room: 'Kitchen', qty: 1, cost: 125, sell: 168.75, total: 168.75, approval: 'declined' },
  { title: '9" salt mill', description: 'Salt 3DCut grinding system - food-safe plastic mechanism (40% glass), stainless-steel shaft to prevent', vendor: 'Roan Iris', room: 'Kitchen', qty: 1, cost: 125, sell: 168.75, total: 168.75, approval: 'declined' },
  { title: 'Après All Day: 65 Cozy Recipes to Share with Family + Friends', description: '', vendor: 'Amazon', room: 'Kitchen', qty: 1, cost: 20, sell: 27, total: 27, approval: 'declined' },
  { title: "Baker's Dozen Black Siris Spoons – Large", description: 'vary in size from around 9-15" long sold as a set of 13 made with the skillful work of artisans', vendor: 'roaniris.co', room: 'Kitchen', qty: 1, cost: 210, sell: 283.50, total: 283.50, approval: 'declined' },
  { title: 'Chat history', description: "I'll bring the Apps: Bites, Bowls, Boards & Beverages [Mullen, Marissa] on Amazon.com. *FREE* shippi", vendor: 'Amazon', room: 'Kitchen', qty: 1, cost: 24.62, sell: 33.24, total: 33.24, approval: 'declined' },
];

const proposalData = {
  proposalNum: 'PRO-3006',
  name: 'PRO-3006',
  status: 'Published',
  total: 6261.87,
  clientName: 'April Bulatao',
  projectId: PROJECT_ID,
  createdAt: '2026-04-12T00:00:00.000Z',
  updatedAt: NOW,
  publishedAt: '2026-04-13T00:00:00.000Z',
  items: proposalItems,
  source: 'staging-seed',
};

(async () => {
  try {
    console.log('Writing project →', PROJECT_ID);
    await setDoc(doc(db, 'boards', PROJECT_ID), projectData);

    console.log('Writing proposal →', PROPOSAL_ID, `(${proposalItems.length} line items)`);
    await setDoc(doc(db, 'boards', PROJECT_ID, 'proposals', PROPOSAL_ID), proposalData);

    // Add a tiny clients doc for the welcome bar to pick up the client name
    await setDoc(doc(db, 'clients', 'april-bulatao-staging'), {
      name: 'April Bulatao',
      email: 'april@example-staging.com',
      projects: [PROJECT_ID],
      createdAt: NOW,
      source: 'staging-seed',
    });

    console.log('\n✓ Seed complete.');
    console.log('\nView at:');
    console.log('  https://cch-platform-staging.web.app/#/clientview/' + PROJECT_ID + '/proposal/' + PROPOSAL_ID);
    console.log('\nProposals list:');
    console.log('  https://cch-platform-staging.web.app/#/clientview/' + PROJECT_ID + '/proposals');
    process.exit(0);
  } catch (err) {
    console.error('✗ Seed failed:', err.message);
    process.exit(1);
  }
})();
