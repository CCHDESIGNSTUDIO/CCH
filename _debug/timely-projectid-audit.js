/**
 * Audit Timely project ID coverage after Cursor's fix.
 * Read-only. Checks both timelyEntries (Timely sync) and timeEntries (ledger).
 */
const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT = path.join(__dirname, 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
admin.initializeApp({ credential: admin.credential.cert(require(SERVICE_ACCOUNT)) });
const db = admin.firestore();

(async () => {
  // 1. Load boards lookup
  const boardsSnap = await db.collection('boards').get();
  const validBoardIds = new Set();
  const boardNameToId = new Map();
  boardsSnap.forEach(d => {
    validBoardIds.add(d.id);
    const x = d.data();
    if (x.name) boardNameToId.set(String(x.name).toLowerCase().trim(), d.id);
  });
  console.log(`Boards in Studio: ${validBoardIds.size}`);

  async function auditCollection(coll) {
    console.log(`\n=== ${coll} ===`);
    const snap = await db.collection(coll).get();
    console.log(`  total docs: ${snap.size}`);

    let withProjectId = 0, withValidProjectId = 0, withInvalidProjectId = 0, withoutProjectId = 0;
    let withTimelyProjectId = 0;
    const invalidProjectIdSamples = [];
    const noProjectIdSamples = [];
    const projectIdCounts = {};
    const projectNameCounts = {};

    snap.forEach(d => {
      const x = d.data();
      const pid = x.projectId;
      const tpid = x.timelyProjectId;
      const pName = x.project || x.projectName || '';

      if (tpid) withTimelyProjectId++;

      if (pid) {
        withProjectId++;
        projectIdCounts[pid] = (projectIdCounts[pid] || 0) + 1;
        if (validBoardIds.has(pid)) withValidProjectId++;
        else {
          withInvalidProjectId++;
          if (invalidProjectIdSamples.length < 6) invalidProjectIdSamples.push({ id: d.id, projectId: pid, projectName: pName, timelyProjectId: tpid });
        }
      } else {
        withoutProjectId++;
        if (noProjectIdSamples.length < 8) noProjectIdSamples.push({ id: d.id, projectName: pName, timelyProjectId: tpid, member: x.member || x.memberName || '', hours: x.hours || x.duration || '', date: x.date || x.startTime || '' });
      }

      if (pName) projectNameCounts[pName] = (projectNameCounts[pName] || 0) + 1;
    });

    console.log(`  with projectId set:        ${withProjectId}  (${Math.round(100 * withProjectId / snap.size)}%)`);
    console.log(`     ↳ valid (matches boards/): ${withValidProjectId}`);
    console.log(`     ↳ invalid (no board match): ${withInvalidProjectId}`);
    console.log(`  WITHOUT projectId:         ${withoutProjectId}  (${Math.round(100 * withoutProjectId / snap.size)}%)`);
    console.log(`  with timelyProjectId set:  ${withTimelyProjectId}`);

    if (invalidProjectIdSamples.length) {
      console.log(`\n  Invalid projectId samples (projectId set but no matching board doc):`);
      for (const s of invalidProjectIdSamples) console.log(`    ${s.id} projectId="${s.projectId}" name="${s.projectName}" tpid="${s.timelyProjectId || ''}"`);
    }

    if (noProjectIdSamples.length) {
      console.log(`\n  Missing-projectId samples (top of list):`);
      for (const s of noProjectIdSamples) console.log(`    ${s.id} name="${(s.projectName||'').slice(0,40)}" tpid="${s.timelyProjectId || ''}" member="${s.member}" date="${String(s.date).slice(0,19)}"`);
    }

    // Top 10 project names of un-resolved entries
    if (withoutProjectId > 0) {
      console.log(`\n  Top project names of un-resolved entries (where name is set but projectId isn't):`);
      const noPidByName = {};
      snap.forEach(d => {
        const x = d.data();
        if (x.projectId) return;
        const n = (x.project || x.projectName || '(empty)').trim();
        noPidByName[n] = (noPidByName[n] || 0) + 1;
      });
      const sorted = Object.entries(noPidByName).sort((a, b) => b[1] - a[1]).slice(0, 10);
      for (const [n, c] of sorted) console.log(`    ${String(c).padStart(4)}  "${n}"`);
    }

    // Top 10 board distributions for entries WITH projectId
    if (withProjectId > 0) {
      console.log(`\n  Top board distribution (entries with projectId, top 10):`);
      const sorted = Object.entries(projectIdCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
      for (const [id, c] of sorted) {
        const valid = validBoardIds.has(id) ? '✓' : '✗';
        console.log(`    ${valid} ${String(c).padStart(4)}  ${id}`);
      }
    }
  }

  await auditCollection('timelyEntries');
  await auditCollection('timeEntries');

  // 2. Specifically check the INV-6022 timeEntries that we discussed yesterday
  console.log(`\n=== Yesterday's INV-6022 timeEntries — check if projectId got fixed ===`);
  try {
    const inv6022 = await db.collection('timeEntries').where('invoiceNumber', '==', 'INV-6022').get();
    console.log(`  Entries with invoiceNumber=INV-6022: ${inv6022.size}`);
    inv6022.forEach(d => {
      const x = d.data();
      console.log(`    ${d.id}  projectId=${x.projectId || '(none)'}  project="${x.project || ''}"  member="${x.member || ''}"  hours=${x.hours}`);
    });
  } catch (e) {
    console.log(`  query error: ${e.code || e.message}`);
  }

  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
