'use strict';
/** READ-ONLY: from the Time Ledger (timeEntries), find BILLABLE client-project hours that were never
 *  linked to an invoice = unbilled / leakage. Grouped by project × month. No writes.
 *  Billed = has invoiceId | invoiceNumber | invoiceNum | invoiceRef | houzzInvoice (matches the app). */
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const db = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'PROD').firestore();
const str = (v) => String(v == null ? '' : v).trim();
const NB = /\b(personal|pto|vacation|sick|holiday)\b/i;
const CCH = /^(cch|cbh)|^(internal|admin|overhead|marketing|business development)$/i;
const OWN = /\b(elu|west\s*avalon)\b/i;             // ELU's own ventures + West Avalon — not billable clients
function isClientBillable(t) {
  if (t.billable === false) return false;
  const proj = str(t.project || t.projectName).toLowerCase();
  if (!proj) return false;
  if (NB.test(proj)) return false;                 // PTO
  if (CCH.test(proj)) return false;                // CCH internal
  if (OWN.test(proj)) return false;                // Elu / West Avalon (internal/own)
  return true;
}
function isInvoiced(t) {
  return !!(str(t.invoiceId) || str(t.invoiceNumber) || str(t.invoiceNum) || str(t.invoiceRef) || str(t.houzzInvoice));
}
(async () => {
  const snap = await db.collection('timeEntries').get();
  const proj = {};   // project -> { logged, invoiced, unbilled, byMonth:{ 'YYYY-MM': unbilledHrs } }
  let totalLogged = 0, totalInv = 0, totalUnbilled = 0, n = 0;
  snap.forEach((d) => {
    const t = d.data() || {}; if (!isClientBillable(t)) return;
    const hrs = parseFloat(t.hours) || 0; if (hrs <= 0) return;
    n++; totalLogged += hrs;
    const pname = str(t.project || t.projectName) || '(no project)';
    const p = proj[pname] = proj[pname] || { logged: 0, invoiced: 0, unbilled: 0, byMonth: {} };
    p.logged += hrs;
    if (isInvoiced(t)) { p.invoiced += hrs; totalInv += hrs; }
    else {
      p.unbilled += hrs; totalUnbilled += hrs;
      const mo = str(t.date).slice(0, 7) || 'no-date';
      p.byMonth[mo] = (p.byMonth[mo] || 0) + hrs;
    }
  });
  const RECENT = process.argv.find(a=>a.startsWith('--since='))?.split('=')[1] || '2025-09';
  console.log('=== UNBILLED BILLABLE HOURS (logged on ledger, no invoice link) ===');
  console.log('ALL-TIME: logged ' + totalLogged.toFixed(0) + 'h | invoiced ' + totalInv.toFixed(0) + 'h | unbilled ' + totalUnbilled.toFixed(0) + 'h  (raw — includes legacy unlinked, NOT real leakage)\n');
  // per-year split (to expose legacy-unlinked vs Studio-era)
  const yr = {};
  snap.forEach((d)=>{ const t=d.data()||{}; if(!isClientBillable(t))return; const h=parseFloat(t.hours)||0; if(h<=0)return; const y=str(t.date).slice(0,4)||'?'; const o=yr[y]=yr[y]||{log:0,inv:0,unb:0}; o.log+=h; if(isInvoiced(t))o.inv+=h; else o.unb+=h; });
  console.log('By YEAR (logged / invoiced / unbilled):');
  Object.keys(yr).sort().forEach(y=>console.log('   '+y+' : '+yr[y].log.toFixed(0).padStart(6)+' / '+yr[y].inv.toFixed(0).padStart(6)+' / '+yr[y].unb.toFixed(0).padStart(6)+'  unbilled'));
  // recent-era detail (the actionable part)
  console.log('\n=== ACTIONABLE: unbilled by project × month, since ' + RECENT + ' ===');
  const rows = Object.entries(proj).map(([name,p])=>{ const recent={}; let rs=0; Object.entries(p.byMonth).forEach(([mo,h])=>{ if(mo>=RECENT){recent[mo]=h; rs+=h;} }); return [name,recent,rs]; }).filter(r=>r[2]>0.01).sort((a,b)=>b[2]-a[2]);
  let recentTotal=0;
  rows.forEach(([name,recent,rs])=>{ recentTotal+=rs; console.log(name+'  — '+rs.toFixed(2)+'h unbilled since '+RECENT); Object.entries(recent).sort().forEach(([mo,h])=>console.log('       '+mo+' : '+h.toFixed(2)+'h')); });
  console.log('\nRECENT unbilled total (since '+RECENT+'): '+recentTotal.toFixed(2)+'h across '+rows.length+' projects.');
  process.exit(0);
})().catch((e) => { console.error('ERROR', e.message || e); process.exit(1); });
