// audit-image-hosting.js
// Read-only audit: classify every imageUrl in production Firestore by where it's hosted.
// Goal: confirm Houzz images are saved into our Firebase Storage before the May 25
// Houzz/AWS CDN link expires.
//
// Classifications:
//   SAFE_FIREBASE  - Hosted in our cch-design-boards Storage bucket
//   AT_RISK_HOUZZ  - Hosted on Houzz / AWS CDN (will die May 25)
//   OTHER_EXTERNAL - Vendor site, other CDN
//   EMPTY          - imageUrl missing/null/empty
//   UNPARSEABLE    - couldn't determine host
//
// Sources audited:
//   - boards/{id}/clips/*           (imageUrl, images[])
//   - products/*                    (imageUrl, images[])
//   - productLibrary/*              (imageUrl, images[])
//   - boards/{id}/invoices/* items[]
//   - boards/{id}/purchaseOrders/* items[]
//   - boards/{id}/proposals/* items[]
//   - boards/{id} hero fields

const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const sa = require(path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

function classify(url) {
  if (!url || typeof url !== 'string' || !url.trim()) return 'EMPTY';
  const u = url.trim();
  // Firebase Storage (multiple host formats)
  if (/firebasestorage\.googleapis\.com/i.test(u)) return 'SAFE_FIREBASE';
  if (/firebasestorage\.app/i.test(u)) return 'SAFE_FIREBASE';
  if (/storage\.googleapis\.com\/cch-design-boards/i.test(u)) return 'SAFE_FIREBASE';
  // Houzz / AWS CDN — anything that goes dark May 25
  if (/houzz\.com/i.test(u)) return 'AT_RISK_HOUZZ';
  if (/houzzcdn\.com/i.test(u)) return 'AT_RISK_HOUZZ';
  if (/mediacdn\.houzz/i.test(u)) return 'AT_RISK_HOUZZ';
  if (/st\.hzcdn\.com/i.test(u)) return 'AT_RISK_HOUZZ';
  if (/hzcdn\.com/i.test(u)) return 'AT_RISK_HOUZZ';
  if (/amazonaws\.com/i.test(u) && /houzz/i.test(u)) return 'AT_RISK_HOUZZ';
  if (/s3.*amazonaws\.com/i.test(u) && /houzz/i.test(u)) return 'AT_RISK_HOUZZ';
  // Generic AWS that might be Houzz - flag separately
  if (/amazonaws\.com/i.test(u)) return 'OTHER_AWS_S3';
  // Data URLs (embedded base64)
  if (/^data:/i.test(u)) return 'EMBEDDED_DATA_URL';
  // Other external (vendor sites, etc.)
  if (/^https?:\/\//i.test(u)) return 'OTHER_EXTERNAL';
  return 'UNPARSEABLE';
}

function host(url) {
  if (!url) return null;
  const m = String(url).match(/https?:\/\/([^/]+)/i);
  return m ? m[1] : null;
}

function collectImageUrls(obj) {
  // Pull every plausible image URL from any document shape
  const out = [];
  if (!obj) return out;
  if (obj.imageUrl) out.push(obj.imageUrl);
  if (obj.image) out.push(obj.image);
  if (obj.thumbnail) out.push(obj.thumbnail);
  if (obj.thumb) out.push(obj.thumb);
  if (obj.heroImageUrl) out.push(obj.heroImageUrl);
  if (obj.clientPortalHeroUrl) out.push(obj.clientPortalHeroUrl);
  if (Array.isArray(obj.images)) obj.images.forEach(i => {
    if (typeof i === 'string') out.push(i);
    else if (i && i.url) out.push(i.url);
  });
  if (Array.isArray(obj.heroImages)) obj.heroImages.forEach(h => {
    if (typeof h === 'string') out.push(h);
    else if (h && h.url) out.push(h.url);
  });
  return out.filter(Boolean);
}

(async () => {
  const stats = {
    clips:         { source: 'boards/*/clips/*', total: 0, urls: 0, byClass: {}, hostHistogram: {} },
    products:      { source: 'products/*',       total: 0, urls: 0, byClass: {}, hostHistogram: {} },
    productLibrary:{ source: 'productLibrary/*', total: 0, urls: 0, byClass: {}, hostHistogram: {} },
    boardHero:     { source: 'boards/*',         total: 0, urls: 0, byClass: {}, hostHistogram: {} },
    invoiceItems:  { source: 'boards/*/invoices/*.items[]', total: 0, urls: 0, byClass: {}, hostHistogram: {} },
    poItems:       { source: 'boards/*/purchaseOrders/*.items[]', total: 0, urls: 0, byClass: {}, hostHistogram: {} },
    proposalItems: { source: 'boards/*/proposals/*.items[]',     total: 0, urls: 0, byClass: {}, hostHistogram: {} },
  };
  const tally = (bucket, urls) => {
    bucket.total++;
    urls.forEach(u => {
      bucket.urls++;
      const c = classify(u);
      bucket.byClass[c] = (bucket.byClass[c] || 0) + 1;
      const h = host(u);
      if (h) bucket.hostHistogram[h] = (bucket.hostHistogram[h] || 0) + 1;
    });
  };

  console.log('Auditing production Firestore (READ-ONLY) — this takes ~1–2 minutes...');
  console.log('');

  // products + productLibrary (root collections)
  console.log('[1/4] Scanning products...');
  const products = await db.collection('products').get();
  products.forEach(d => tally(stats.products, collectImageUrls(d.data())));
  console.log('  ' + products.size + ' products scanned');

  console.log('[2/4] Scanning productLibrary...');
  const lib = await db.collection('productLibrary').get();
  lib.forEach(d => tally(stats.productLibrary, collectImageUrls(d.data())));
  console.log('  ' + lib.size + ' library products scanned');

  // boards + their subcollections
  console.log('[3/4] Scanning boards (clips + hero)...');
  const boards = await db.collection('boards').get();
  console.log('  ' + boards.size + ' boards');
  let clipTotal = 0;
  for (const b of boards.docs) {
    tally(stats.boardHero, collectImageUrls(b.data()));
    const clips = await b.ref.collection('clips').get();
    clipTotal += clips.size;
    clips.forEach(c => tally(stats.clips, collectImageUrls(c.data())));
  }
  console.log('  ' + clipTotal + ' clips scanned');

  console.log('[4/4] Scanning invoice / PO / proposal line items...');
  for (const b of boards.docs) {
    for (const sub of ['invoices', 'purchaseOrders', 'proposals']) {
      const target = sub === 'invoices' ? stats.invoiceItems
                  : sub === 'purchaseOrders' ? stats.poItems
                  : stats.proposalItems;
      const snap = await b.ref.collection(sub).get();
      snap.forEach(d => {
        const data = d.data();
        const items = data.items || data.lineItems || [];
        if (Array.isArray(items)) {
          items.forEach(it => tally(target, collectImageUrls(it)));
        }
      });
    }
  }
  console.log('  done.');

  // Report
  console.log('');
  console.log('=====================================================================');
  console.log('IMAGE HOSTING AUDIT — Production (cch-design-boards) — ' + new Date().toISOString());
  console.log('=====================================================================');
  Object.keys(stats).forEach(k => {
    const s = stats[k];
    console.log('');
    console.log('## ' + k + '  [' + s.source + ']');
    console.log('   Documents scanned: ' + s.total);
    console.log('   Image URLs found:  ' + s.urls);
    if (s.urls > 0) {
      console.log('   Classification:');
      Object.entries(s.byClass).sort((a,b) => b[1]-a[1]).forEach(([cls,n]) => {
        const pct = (100 * n / s.urls).toFixed(1);
        console.log('     ' + cls.padEnd(20) + ' ' + String(n).padStart(8) + '   ' + pct + '%');
      });
      console.log('   Top hosts:');
      Object.entries(s.hostHistogram).sort((a,b) => b[1]-a[1]).slice(0,8).forEach(([h,n]) => {
        console.log('     ' + h.padEnd(50) + ' ' + n);
      });
    }
  });

  // Grand total
  console.log('');
  console.log('=====================================================================');
  console.log('GRAND TOTAL (all sources)');
  console.log('=====================================================================');
  const total = { urls: 0, byClass: {} };
  Object.values(stats).forEach(s => {
    total.urls += s.urls;
    Object.entries(s.byClass).forEach(([cls,n]) => { total.byClass[cls] = (total.byClass[cls]||0) + n; });
  });
  console.log('Total image URLs across all sources: ' + total.urls);
  Object.entries(total.byClass).sort((a,b) => b[1]-a[1]).forEach(([cls,n]) => {
    const pct = (100 * n / total.urls).toFixed(1);
    console.log('  ' + cls.padEnd(20) + ' ' + String(n).padStart(8) + '   ' + pct + '%');
  });

  // Persist JSON for follow-up
  const outDir = path.join(__dirname, '..', '_debug');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'image-hosting-audit-' + new Date().toISOString().slice(0,10) + '.json');
  fs.writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), stats, total }, null, 2));
  console.log('');
  console.log('Full report saved: ' + outFile);

  process.exit(0);
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
