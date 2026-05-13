const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const PROD = {
  apiKey: 'AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og',
  authDomain: 'cch-design-boards.firebaseapp.com',
  projectId: 'cch-design-boards',
  storageBucket: 'cch-design-boards.firebasestorage.app',
  messagingSenderId: '210388013080',
  appId: '1:210388013080:web:cch-design-boards',
};
(async () => {
  const app = initializeApp(PROD);
  const db = getFirestore(app);
  const boardId = '7225-bugletrail';
  // Count clips
  const clipsSnap = await getDocs(collection(db, 'boards', boardId, 'clips'));
  console.log('Clips in 7225-bugletrail: ' + clipsSnap.size);
  const houzzPos = new Set();
  let withHouzzPO = 0;
  clipsSnap.forEach(d => {
    const x = d.data();
    const po = x.houzzPO || x.poNum || x.poNumber || x.po;
    if (po) {
      withHouzzPO++;
      const m = String(po).match(/PO[\s-]?(\d+)/);
      if (m) houzzPos.add('PO-' + m[1]);
    }
  });
  console.log('Clips with houzzPO ref: ' + withHouzzPO);
  console.log('Unique houzzPO refs: ' + houzzPos.size);
  console.log('Sample POs from clips: ' + [...houzzPos].slice(0, 10).join(', '));
  // Same for selections
  try {
    const selSnap = await getDocs(collection(db, 'boards', boardId, 'selections'));
    console.log('\nSelections in 7225-bugletrail: ' + selSnap.size);
    const selPos = new Set();
    selSnap.forEach(d => {
      const x = d.data();
      const po = x.houzzPO || x.poNum;
      if (po) { const m = String(po).match(/PO[\s-]?(\d+)/); if (m) selPos.add('PO-' + m[1]); }
    });
    console.log('Unique houzzPO refs in selections: ' + selPos.size);
  } catch (_e) {}
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
