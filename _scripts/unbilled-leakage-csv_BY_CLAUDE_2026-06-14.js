'use strict';
/** READ-ONLY: emit a CSV of unbilled billable CLIENT hours by project × month (Studio era).
 *  Excludes PTO, CCH internal, Elu/West Avalon, and flat-fee projects. No writes to Firestore. */
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const KEY = require(path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json'));
const app = admin.initializeApp({ credential: admin.credential.cert(KEY) }, 'PROD');
const db = app.firestore();
const str = (v) => String(v == null ? '' : v).trim();
const SINCE = (process.argv.find(a=>a.startsWith('--since='))||'').split('=')[1] || '2026-01';
const NB = /\b(personal|pto|vacation|sick|holiday)\b/i;
const CCH = /^(cch|cbh)|^(internal|admin|overhead|marketing|business development)$/i;
const OWN = /\b(elu|west\s*avalon)\b/i;
const isInvoiced = (t) => !!(str(t.invoiceId)||str(t.invoiceNumber)||str(t.invoiceNum)||str(t.invoiceRef)||str(t.houzzInvoice));
(async () => {
  // flat-fee board ids (billingModel flat_fee OR contractFee/flatFee/budget set)
  const boards = await db.collection('boards').get();
  const flatFee = new Set();
  boards.forEach(b => { const d=b.data()||{}; const bm=str(d.billingModel).toLowerCase(); if(bm==='flat_fee'|| (parseFloat(d.contractFee)||parseFloat(d.flatFee)||parseFloat(d.budget))>0) flatFee.add(b.id); });
  const te = await db.collection('timeEntries').get();
  const rows = {}; // project|month -> hrs
  te.forEach(d => { const t=d.data()||{}; const proj=str(t.project||t.projectName); const pl=proj.toLowerCase();
    if(!proj||t.billable===false||NB.test(pl)||CCH.test(pl)||OWN.test(pl)) return;
    if(flatFee.has(str(t.projectId))) return;
    const hrs=parseFloat(t.hours)||0; if(hrs<=0) return; if(isInvoiced(t)) return;
    const mo=str(t.date).slice(0,7); if(mo<SINCE) return;
    const k=proj+'||'+mo; rows[k]=(rows[k]||0)+hrs;
  });
  const out=[['Project','Month','UnbilledHours']];
  Object.entries(rows).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([k,h])=>{ const [p,m]=k.split('||'); out.push([p,m,h.toFixed(2)]); });
  const csv=out.map(r=>r.map(c=>/[",]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c).join(',')).join('\r\n');
  const file=path.join('C:','Users','cindy','Dropbox','Claude - CCH studio','Unbilled-Hours-by-Project-Month_'+SINCE+'.csv');
  fs.writeFileSync(file, csv);
  const total=Object.values(rows).reduce((s,h)=>s+h,0);
  console.log('Rows:', out.length-1, '| total unbilled hrs since '+SINCE+':', total.toFixed(2));
  console.log('Flat-fee projects excluded:', flatFee.size);
  console.log('Wrote:', file);
  process.exit(0);
})().catch(e=>{console.error('ERROR',e.message||e);process.exit(1);});
