'use strict';
/**
 * Refresh Timely → CCH: sync from Timely API, then bulk-log pending timelyEntries to timeEntries.
 *
 * Usage:
 *   node _scripts/refresh-timely-to-ledger_BY_CURSOR_2026-07-14.js
 *   node _scripts/refresh-timely-to-ledger_BY_CURSOR_2026-07-14.js --apply
 *   node _scripts/refresh-timely-to-ledger_BY_CURSOR_2026-07-14.js --apply --sync-only
 *   node _scripts/refresh-timely-to-ledger_BY_CURSOR_2026-07-14.js --apply --log-only --member cindy
 */
const path = require('path');
const admin = require('firebase-admin');

const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const db = admin.initializeApp({ credential: admin.credential.cert(require(KEY)) }, 'refreshTimely').firestore();

const TIMELY_SYNC_URL = 'https://us-central1-cch-design-boards.cloudfunctions.net/timelySyncEntries';
const TIMELY_CLIENT_ID = 'X0t2mXABI8R81qN8PDzX1iSAfMybb6cdpzfUT1Z1Otc';
const TIMELY_CLIENT_SECRET = 'f71829f106a93ce3e692b7f392d457a6d95bec579932095fa368430a16b884ca';
const TIMELY_ACCOUNT_ID = '874495';

const SERVICE_TYPES = [
  { name: 'CCH Design Services', rate: 125 },
  { name: 'CCH Client Project Support', rate: 75 },
  { name: 'CCH Project Management', rate: 95 },
  { name: 'CCH Design Concept', rate: 95 },
  { name: 'CCH Blended Design Services', rate: 195 },
  { name: 'CCH Admin', rate: 0 },
  { name: 'CCH Studio & Design', rate: 0 },
  { name: 'CCH Time Entry', rate: 0 },
  { name: 'CCH Research', rate: 0 },
  { name: 'ELU', rate: 0 },
  { name: 'T&E VH', rate: 75 },
  { name: 'Non-Billable', rate: 0 },
];

const TIMELY_DESIGN_SERVICE_ACTIVITIES = [
  'Installation',
  'ELU',
  'Blended Design Services',
  'Meetings & Onsite',
  'Mood Boards & Design Concepts',
  'Renderings',
  'Floor Plans, drawings & elevations',
  'Schedules & Specifications',
  'Travel, Pick up & Delivery services',
];

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const SYNC_ONLY = args.includes('--sync-only');
const LOG_ONLY = args.includes('--log-only');
const memberIdx = args.indexOf('--member');
const MEMBER_FILTER = memberIdx >= 0 ? String(args[memberIdx + 1] || 'cindy').toLowerCase() : 'cindy';
const startIdx = args.indexOf('--start');
const endIdx = args.indexOf('--end');
const START_DATE = startIdx >= 0 ? args[startIdx + 1] : '2026-02-01';
const END_DATE = endIdx >= 0 ? args[endIdx + 1] : new Date().toISOString().slice(0, 10);

function normTimelyProjectName(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[\u2013\u2014]/g, '-');
}
function slugTimelyProjectName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function resolveCchBoardIdFromBoardsArray(boardsArr, projectName) {
  const want = normTimelyProjectName(projectName);
  if (!want) return '';
  const wantSlug = slugTimelyProjectName(projectName);
  const nameExact = boardsArr.filter((b) => b.nameNorm === want);
  if (nameExact.length === 1) return nameExact[0].id;
  const slugHit = boardsArr.filter((b) => b.id.toLowerCase() === wantSlug);
  if (slugHit.length === 1) return slugHit[0].id;
  if (want.length >= 8) {
    const fuzzy = boardsArr.filter((b) => b.nameNorm && (b.nameNorm.includes(want) || want.includes(b.nameNorm)));
    if (fuzzy.length === 1) return fuzzy[0].id;
  }
  if (want.length >= 4 && want.length < 8) {
    const fuzzyShort = boardsArr.filter((b) => b.nameNorm && b.nameNorm.includes(want));
    if (fuzzyShort.length === 1) return fuzzyShort[0].id;
  }
  const projLow = String(projectName || '').trim().toLowerCase();
  for (let i = 0; i < boardsArr.length; i++) {
    if (boardsArr[i].id.toLowerCase() === projLow) return boardsArr[i].id;
  }
  return '';
}
function trimTimeEntryProjectName(p) {
  return String(p || '').trim().replace(/\s+/g, ' ').slice(0, 120);
}
function roundUpTo15(hrs) {
  if (!hrs || hrs <= 0) return 0;
  return Math.ceil(hrs * 4) / 4;
}
function getTimelyHours(e) {
  let raw = 0;
  if (e.raw && e.raw.duration && typeof e.raw.duration === 'object') {
    const th = parseFloat(e.raw.duration.total_hours);
    if (th > 0) raw = th;
    else {
      const ts = parseFloat(e.raw.duration.total_seconds);
      if (ts > 0) raw = ts / 3600;
      else {
        const tm = parseFloat(e.raw.duration.total_minutes);
        if (tm > 0) raw = tm / 60;
      }
    }
  }
  if (!raw) {
    const h = typeof e.hours === 'number' ? e.hours : parseFloat(e.hours);
    if (h > 0) raw = h;
  }
  if (!raw) {
    const dm = parseFloat(e.durationMinutes);
    if (dm > 0) raw = dm / 60;
  }
  if (!raw) {
    const m = parseFloat(e.minutes);
    if (m > 0) raw = m / 60;
  }
  return roundUpTo15(raw);
}
function isNonBillableProject(projectName) {
  const p = String(projectName || '').toLowerCase().trim();
  return p.startsWith('cch') || p.startsWith('cbh') ||
    ['internal', 'admin', 'overhead', 'marketing', 'business development'].includes(p);
}
function isEluProject(projectName) {
  return String(projectName || '').toLowerCase().indexOf('elu') >= 0;
}
function getSmartTimeDefaultServiceForProject(projectName) {
  if (isNonBillableProject(projectName)) return 'CCH Admin';
  if (isEluProject(projectName)) return 'ELU';
  return 'CCH Design Services';
}
function normalizeMemberName(raw) {
  const r = String(raw || '').toLowerCase();
  if (r.includes('vanessa') || r.includes('holliday') || r.includes('vholliday')) return 'Vanessa Holliday';
  if (r.includes('cindy') || r.includes('holloway') || r.includes('cynthia')) return 'Cindy Holloway';
  return String(raw || '').trim() || 'Unknown';
}
function memberMatchesFilter(memberRaw) {
  if (!MEMBER_FILTER || MEMBER_FILTER === 'all') return true;
  return String(memberRaw || '').toLowerCase().includes(MEMBER_FILTER);
}
function getLedgerRateByName(ledgerName, rateOverrides) {
  const list = SERVICE_TYPES.map((s) => {
    if (rateOverrides && rateOverrides[s.name] != null && rateOverrides[s.name] !== '') {
      const r = parseFloat(rateOverrides[s.name]);
      if (!isNaN(r)) return { name: s.name, rate: r };
    }
    return s;
  });
  const hit = list.find((x) => x.name === ledgerName);
  return hit ? (parseFloat(hit.rate) || 0) : 0;
}
function isTimelyLedgerServiceName(name) {
  const v = String(name || '').trim();
  return !!v && SERVICE_TYPES.some((x) => x.name === v);
}
function isKnownTimelyActivity(val) {
  return TIMELY_DESIGN_SERVICE_ACTIVITIES.includes(String(val || '').trim());
}
function mapTimelyActivityToLedgerService(activity) {
  switch (String(activity || '').trim()) {
    case 'Installation': return 'CCH Project Management';
    case 'ELU': return 'ELU';
    case 'Blended Design Services': return 'CCH Blended Design Services';
    case 'Meetings & Onsite': return 'CCH Design Services';
    case 'Mood Boards & Design Concepts': return 'CCH Design Concept';
    case 'Renderings': return 'CCH Design Services';
    case 'Floor Plans, drawings & elevations': return 'CCH Design Services';
    case 'Schedules & Specifications': return 'CCH Design Services';
    case 'Travel, Pick up & Delivery services': return 'T&E VH';
    default: return 'CCH Design Services';
  }
}
function guessTimelyLedgerService(e) {
  e = e || {};
  if (isKnownTimelyActivity(e.timelyActivity)) return mapTimelyActivityToLedgerService(e.timelyActivity);
  const text = (String(e.service || '') + ' ' + String(e.note || '')).toLowerCase();
  const has = (p) => text.indexOf(p) >= 0;
  if (has('non-bill') || has('non bill') || has('admin overhead')) return 'Non-Billable';
  if (has('blended')) return 'CCH Blended Design Services';
  if (has('t&e') || has('travel') || has('mileage')) return 'T&E VH';
  if (has('project manag') || has(' pm ') || text.trim().indexOf('pm ') === 0) return 'CCH Project Management';
  if (has('concept')) return 'CCH Design Concept';
  if (has('client support') || (has('support') && !has('project'))) return 'CCH Client Project Support';
  if (text.indexOf('elu') >= 0) return 'ELU';
  if (has('design') || has('consult') || has('discovery') || has('coordination') || has('meeting') || has('call') || has('sourcing') || has('procurement') || has('material')) return 'CCH Design Services';
  return 'CCH Design Services';
}
function getTimelyEntryResolvedService(e) {
  if (isNonBillableProject(e.project)) return 'Non-Billable';
  const svc = String(e.service || '').trim();
  if (isTimelyLedgerServiceName(svc)) return svc;
  if (isKnownTimelyActivity(e.timelyActivity)) return mapTimelyActivityToLedgerService(e.timelyActivity);
  return guessTimelyLedgerService(e);
}
function timelyResolvedProjectName(e, boardById) {
  const pid = String(e.projectId || '').trim();
  if (pid && boardById[pid]) return boardById[pid];
  return String(e.project || '').trim();
}
function resolveLedgerFields(e, projCanon, rateOverrides) {
  const nonBillable = isNonBillableProject(projCanon);
  const timelyAct = String(e.timelyActivity || '').trim();
  const storedSvc = String(e.service || '').trim();
  let ledgerSvc;
  let rate;
  let billable;
  if (nonBillable) {
    ledgerSvc = 'CCH Admin';
    rate = 0;
    billable = false;
  } else if (isEluProject(projCanon) && !storedSvc) {
    ledgerSvc = 'ELU';
    rate = 0;
    billable = false;
  } else if (isTimelyLedgerServiceName(storedSvc)) {
    ledgerSvc = storedSvc;
    rate = (e.rate != null && e.rate !== '' && !isNaN(parseFloat(e.rate))) ? parseFloat(e.rate) : getLedgerRateByName(ledgerSvc, rateOverrides);
    billable = typeof e.billable === 'boolean' ? e.billable : (ledgerSvc !== 'Non-Billable' && ledgerSvc !== 'CCH Admin');
  } else if (isKnownTimelyActivity(timelyAct)) {
    ledgerSvc = mapTimelyActivityToLedgerService(timelyAct);
    rate = getLedgerRateByName(ledgerSvc, rateOverrides);
    billable = ledgerSvc !== 'Non-Billable' && ledgerSvc !== 'CCH Admin';
    if (e.rate != null && e.rate !== '' && !isNaN(parseFloat(e.rate))) rate = parseFloat(e.rate);
    if (typeof e.billable === 'boolean') billable = e.billable;
  } else {
    const resolved = getTimelyEntryResolvedService({ project: projCanon, service: e.service, note: e.note, timelyActivity: e.timelyActivity });
    const defaultSvc = getSmartTimeDefaultServiceForProject(projCanon);
    ledgerSvc = isTimelyLedgerServiceName(resolved) ? resolved : (isTimelyLedgerServiceName(defaultSvc) ? defaultSvc : 'CCH Design Services');
    rate = (e.rate != null && e.rate !== '' && !isNaN(parseFloat(e.rate))) ? parseFloat(e.rate) : getLedgerRateByName(ledgerSvc, rateOverrides);
    billable = typeof e.billable === 'boolean' ? e.billable : (ledgerSvc !== 'Non-Billable' && ledgerSvc !== 'CCH Admin' && ledgerSvc !== 'ELU');
  }
  return { ledgerSvc, rate, billable };
}

async function loadBoards() {
  const snap = await db.collection('boards').get();
  const boardsArr = [];
  const boardById = {};
  snap.forEach((d) => {
    const id = String(d.id || '').trim();
    if (!id) return;
    const bd = d.data() || {};
    const nm = String(bd.name || bd.title || '').trim();
    boardsArr.push({ id, nameNorm: normTimelyProjectName(nm) });
    boardById[id] = nm;
  });
  return { boardsArr, boardById };
}

async function loadLoggedTimelyIds() {
  const logged = new Set();
  let lastDoc = null;
  for (let pass = 0; pass < 60; pass++) {
    let q = db.collection('timeEntries').where('source', '==', 'timely')
      .orderBy(admin.firestore.FieldPath.documentId()).limit(400);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    snap.forEach((d) => {
      const tid = d.data().timelyId;
      if (tid != null && tid !== '') logged.add(String(tid));
    });
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < 400) break;
  }
  return logged;
}

async function refreshTimelyToken(fetch, refreshToken) {
  const resp = await fetch('https://api.timelyapp.com/1.1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: TIMELY_CLIENT_ID,
      client_secret: TIMELY_CLIENT_SECRET,
    }),
  });
  if (!resp.ok) throw new Error('Timely token refresh failed: ' + (await resp.text()).slice(0, 200));
  const data = await resp.json();
  await db.collection('settings').doc('timely').set({
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
    refreshedAt: new Date().toISOString(),
  }, { merge: true });
  return data.access_token;
}

async function fetchAllTimelyEvents(fetch, accountId, accessToken, startDate, endDate) {
  const perPage = 1000;
  let page = 1;
  const all = [];
  for (;;) {
    const url = `https://api.timelyapp.com/1.1/${accountId}/events?since=${encodeURIComponent(startDate)}&upto=${encodeURIComponent(endDate)}&page=${page}&per_page=${perPage}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (resp.status === 401) {
      const err = new Error('Token expired');
      err.status = 401;
      throw err;
    }
    if (!resp.ok) throw new Error(`Timely API ${resp.status}: ${(await resp.text()).slice(0, 300)}`);
    const batch = await resp.json();
    const rows = Array.isArray(batch) ? batch : (batch && Array.isArray(batch.events) ? batch.events : []);
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < perPage) break;
    page++;
    if (page > 50) break;
  }
  return all;
}

async function fetchTimelyLabels(fetch, accountId, accessToken) {
  const resp = await fetch(`https://api.timelyapp.com/1.1/${accountId}/labels`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) return {};
  const rows = await resp.json();
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach((lb) => {
    if (lb && lb.id != null) map[String(lb.id)] = String(lb.name || lb.title || '').trim();
  });
  return map;
}

function labelIdsToActivity(labelIds, labelMap) {
  const ids = Array.isArray(labelIds) ? labelIds : [];
  for (let i = 0; i < ids.length; i++) {
    const name = labelMap[String(ids[i])] || '';
    if (isKnownTimelyActivity(name)) return name;
  }
  for (let i = 0; i < ids.length; i++) {
    const name = labelMap[String(ids[i])] || '';
    if (name) return name;
  }
  return '';
}

async function runSync() {
  console.log(`\n=== SYNC Timely ${START_DATE} → ${END_DATE} ===`);
  if (!APPLY) {
    console.log('[dry-run] Would POST to timelySyncEntries cloud function');
    return { fetched: 0, saved: 0, dryRun: true };
  }

  const fetch = (await import('node-fetch')).default;
  const resp = await fetch(TIMELY_SYNC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ startDate: START_DATE, endDate: END_DATE }),
  });
  const text = await resp.text();
  let result;
  try { result = JSON.parse(text); } catch (_e) { result = { error: text.slice(0, 300) }; }
  if (!resp.ok) throw new Error('Sync failed: ' + JSON.stringify(result));
  console.log('Sync result:', result);

  // Enrich timelyActivity from Timely labels (best-effort)
  const tokenDoc = await db.collection('settings').doc('timely').get();
  const tokenData = tokenDoc.data() || {};
  let accessToken = tokenData.accessToken;
  const accountId = tokenData.accountId || TIMELY_ACCOUNT_ID;
  const refreshToken = tokenData.refreshToken;
  let labelMap = {};
  try {
    labelMap = await fetchTimelyLabels(fetch, accountId, accessToken);
  } catch (e1) {
    if (refreshToken) {
      accessToken = await refreshTimelyToken(fetch, refreshToken);
      labelMap = await fetchTimelyLabels(fetch, accountId, accessToken);
    }
  }
  if (Object.keys(labelMap).length) {
    const snap = await db.collection('timelyEntries')
      .where('date', '>=', START_DATE)
      .where('date', '<=', END_DATE)
      .get();
    let enriched = 0;
    const batch = db.batch();
    snap.forEach((d) => {
      const x = d.data() || {};
      if (String(x.timelyActivity || '').trim()) return;
      const ids = x.label || (x.raw && x.raw.label_ids) || [];
      const act = labelIdsToActivity(ids, labelMap);
      if (!act) return;
      batch.update(d.ref, { timelyActivity: act, updatedAt: new Date().toISOString() });
      enriched++;
    });
    if (enriched) {
      await batch.commit();
      console.log('Enriched timelyActivity from Timely labels:', enriched, 'rows');
    }
  }
  return result;
}

async function runBulkLog() {
  console.log(`\n=== LOG pending timelyEntries → timeEntries (${START_DATE} → ${END_DATE}, member ~${MEMBER_FILTER}) ===`);
  const [{ boardsArr, boardById }, loggedIds, rateDoc] = await Promise.all([
    loadBoards(),
    loadLoggedTimelyIds(),
    db.collection('settings').doc('serviceRates').get(),
  ]);
  const rateOverrides = rateDoc.exists ? (rateDoc.data().teServiceRates || {}) : {};

  const snap = await db.collection('timelyEntries')
    .where('date', '>=', START_DATE)
    .where('date', '<=', END_DATE)
    .get();

  const pending = [];
  snap.forEach((d) => {
    const e = d.data() || {};
    if (!memberMatchesFilter(e.member)) return;
    const timelyId = String(e.timelyId || e.id || '').trim();
    if (!timelyId || loggedIds.has(timelyId)) return;
    pending.push({ docId: d.id, timelyId, e });
  });

  pending.sort((a, b) => String(a.e.date).localeCompare(String(b.e.date)) || String(a.timelyId).localeCompare(String(b.timelyId)));

  let totalHrs = 0;
  let totalBillable = 0;
  const byProject = {};
  pending.forEach(({ e, timelyId, docId }) => {
    const projCanon = timelyResolvedProjectName(e, boardById) || String(e.project || '').trim();
    const hrs = getTimelyHours(e);
    const { ledgerSvc, rate, billable } = resolveLedgerFields(e, projCanon, rateOverrides);
    totalHrs += hrs;
    if (billable) totalBillable += hrs * rate;
    byProject[projCanon || '(none)'] = (byProject[projCanon || '(none)'] || 0) + hrs;
    if (!APPLY) {
      console.log(`  ${e.date} | ${hrs.toFixed(2)}h | ${projCanon} | ${ledgerSvc} | $${billable ? (hrs * rate).toFixed(2) : '0'} | timely-${timelyId}`);
    }
  });

  console.log(`Pending rows: ${pending.length} (${totalHrs.toFixed(1)}h raw, ~$${totalBillable.toFixed(2)} billable)`);
  console.log('By project:', Object.entries(byProject).sort((a, b) => b[1] - a[1]).map(([p, h]) => `${p}: ${h.toFixed(1)}h`).join('; '));

  if (!pending.length) return { logged: 0, errors: 0 };
  if (!APPLY) {
    console.log('\n[dry-run] Re-run with --apply to write to production Firestore.');
    return { logged: 0, errors: 0, dryRun: true, pending: pending.length };
  }

  let logged = 0;
  let errors = 0;
  const projectIdCache = {};
  for (const { docId, timelyId, e } of pending) {
    try {
      const projCanon = timelyResolvedProjectName(e, boardById) || String(e.project || '').trim();
      const hrs = getTimelyHours(e);
      const memberName = normalizeMemberName(e.member || e.memberEmail || '');
      let { ledgerSvc, rate, billable } = resolveLedgerFields(e, projCanon, rateOverrides);
      if (isNonBillableProject(projCanon)) {
        ledgerSvc = 'CCH Admin';
        billable = false;
        rate = 0;
      }

      const cacheKey = normTimelyProjectName(projCanon);
      if (projectIdCache[cacheKey] === undefined) {
        projectIdCache[cacheKey] = resolveCchBoardIdFromBoardsArray(boardsArr, projCanon) || e.projectId || '';
      }
      const resolvedProjectId = projectIdCache[cacheKey] || null;
      const dateStr = String(e.date || '').trim().slice(0, 10);

      await db.collection('timeEntries').add({
        date: dateStr,
        project: trimTimeEntryProjectName(projCanon),
        projectId: resolvedProjectId,
        member: memberName,
        hours: hrs,
        rate,
        total: billable ? (hrs * rate) : 0,
        service: ledgerSvc,
        timelyActivity: String(e.timelyActivity || '').trim() || null,
        description: String(e.note || '').trim(),
        billable,
        source: 'timely',
        timelyId,
        timelyDocId: docId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await db.collection('timelyEntries').doc(docId).update({
        note: String(e.note || '').trim(),
        timelyActivity: String(e.timelyActivity || '').trim(),
        service: ledgerSvc,
        rate,
        billable,
        projectId: resolvedProjectId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      logged++;
      loggedIds.add(timelyId);
    } catch (err) {
      errors++;
      console.error('Log error timely-' + timelyId + ':', err.message || err);
    }
  }

  console.log(`Logged ${logged} entries (${errors} errors)`);
  return { logged, errors };
}

(async () => {
  console.log('refresh-timely-to-ledger', APPLY ? 'APPLY' : 'DRY-RUN', { START_DATE, END_DATE, MEMBER_FILTER, SYNC_ONLY, LOG_ONLY });
  try {
    if (!LOG_ONLY) await runSync();
    if (!SYNC_ONLY) await runBulkLog();
    console.log('\nDone.');
  } catch (err) {
    console.error('Fatal:', err);
    process.exit(1);
  }
})();
