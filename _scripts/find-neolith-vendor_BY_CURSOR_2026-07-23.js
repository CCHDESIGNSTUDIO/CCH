'use strict';
/** READ-ONLY: find Neolith in vendors/, products/, productLibrary/, settings/vendors.list (prod). */
const path = require('path');
const admin = require('firebase-admin');
const KEY = path.join(
  __dirname,
  '..',
  '_debug',
  'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'
);
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'neoFind').firestore();
const str = (v) => String(v == null ? '' : v).trim();

(async () => {
  const out = { vendors: [], productVendorNames: {}, productLibraryVendorNames: {}, settingsList: [] };

  const vs = await db.collection('vendors').get();
  vs.forEach((d) => {
    const data = d.data() || {};
    const blob = JSON.stringify(data).toLowerCase();
    const name = str(data.name || data.company || data.vendor);
    if (/neolith/i.test(name) || /neolith/i.test(blob)) {
      out.vendors.push({
        id: d.id,
        name,
        category: data.category || null,
        type: data.type || null,
        email: data.email || null,
      });
    }
  });

  const ps = await db.collection('products').get();
  ps.forEach((d) => {
    const v = str((d.data() || {}).vendor || (d.data() || {}).manufacturer);
    if (/neolith/i.test(v)) out.productVendorNames[v] = (out.productVendorNames[v] || 0) + 1;
  });

  try {
    const pl = await db.collection('productLibrary').get();
    pl.forEach((d) => {
      const v = str((d.data() || {}).vendor || (d.data() || {}).manufacturer);
      if (/neolith/i.test(v)) out.productLibraryVendorNames[v] = (out.productLibraryVendorNames[v] || 0) + 1;
    });
  } catch (e) {
    out.productLibraryError = String(e.message || e);
  }

  const sv = await db.doc('settings/vendors').get();
  const list = sv.exists && Array.isArray(sv.data().list) ? sv.data().list : [];
  out.settingsList = list.filter((x) => /neolith/i.test(String(x)));
  out.settingsListTotal = list.length;

  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
