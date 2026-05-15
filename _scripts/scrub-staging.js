#!/usr/bin/env node
/**
 * scrub-staging.js
 *
 * Walks Firestore on the STAGING project (cch-studio-staging) and replaces
 * real client PII with test values so that the staging environment is safe
 * to share/screenshot/leave open in front of an iPad. ONLY ever runs against
 * staging — refuses to start if the SDK is initialized against any other
 * project.
 *
 * What gets scrubbed (and how):
 *
 *   clients/{id}
 *     name        -> "Test Client A", "Test Client B", ...  (sequential)
 *     email       -> "staging-client-{n}@cchdesign-test.com"
 *     emails[]    -> all entries replaced with the test email
 *     phone       -> "555-0100"
 *     phones[]    -> all entries replaced with "555-0100"
 *     primaryAddress / shippingAddress / billingAddress
 *                 -> street + city replaced with placeholder values,
 *                    state/zip preserved (zip is not PII on its own)
 *
 *   boards/{id}
 *     clientName  -> "[Scrubbed: {boardId}]"  (preserves which board is which)
 *     clientEmail -> matching client's scrubbed email if known, else
 *                    "staging-client-x@cchdesign-test.com"
 *
 *   members/{id}
 *     Left alone. Members are CCH staff (cindy / vanessa), not clients.
 *
 *   vendors/{id}
 *     Vendors are business contacts (not consumer PII) so by default
 *     this script leaves them alone. Pass --scrub-vendors to also
 *     scrub vendor contact emails/phones.
 *
 * Usage:
 *   node _scripts/scrub-staging.js                # dry-run (default)
 *   node _scripts/scrub-staging.js --apply        # actually write
 *   node _scripts/scrub-staging.js --apply --scrub-vendors
 *
 * Auth:
 *   STAGING write: firebase-admin with the staging service account key.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// ---------------------------------------------------------------------------
// Config

const STAGING_KEY = path.join(
  __dirname, '..', '_debug', 'service-account.json',
  'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json'
);
const STAGING_PROJECT = 'cch-studio-staging';

const argv = process.argv.slice(2);
const APPLY         = argv.includes('--apply');
const SCRUB_VENDORS = argv.includes('--scrub-vendors');

// ---------------------------------------------------------------------------
// Init + hard safety check (project_id from key JSON; Admin SDK may not
// set app.options.projectId when only a credential is supplied).

const stagingKeyJson = require(STAGING_KEY);

if (stagingKeyJson.project_id !== STAGING_PROJECT) {
  console.error('');
  console.error('FATAL: scrub-staging.js can only run against ' + STAGING_PROJECT + '.');
  console.error('       The staging key has project_id "' + stagingKeyJson.project_id + '".');
  console.error('       Aborting.');
  console.error('');
  process.exit(2);
}

const stagingApp = admin.initializeApp({
  credential: admin.credential.cert(stagingKeyJson),
  projectId: stagingKeyJson.project_id
});

const db = stagingApp.firestore();

// ---------------------------------------------------------------------------
// Replacement values

function letterFor(n) {
  // 0 -> A, 25 -> Z, 26 -> AA, ...
  let s = '';
  let x = n;
  while (true) {
    s = String.fromCharCode(65 + (x % 26)) + s;
    x = Math.floor(x / 26) - 1;
    if (x < 0) break;
  }
  return s;
}

const stats = { clients: 0, boards: 0, vendors: 0, skipped: 0, errors: 0 };
const errors = [];

const TEST_EMAIL = i => `staging-client-${i}@cchdesign-test.com`;
const TEST_PHONE = '555-0100';

function scrubAddress(addr) {
  if (!addr || typeof addr !== 'object') return addr;
  const out = Object.assign({}, addr);
  if ('street'  in out) out.street  = '100 Test Lane';
  if ('street1' in out) out.street1 = '100 Test Lane';
  if ('street2' in out) out.street2 = '';
  if ('line1'   in out) out.line1   = '100 Test Lane';
  if ('line2'   in out) out.line2   = '';
  if ('city'    in out) out.city    = 'Testville';
  return out;
}

// ---------------------------------------------------------------------------
// Scrubbers

async function scrubClients() {
  console.log('--- scrubbing clients ---');
  const snap = await db.collection('clients').get();
  let i = 0;
  const map = {}; // clientId -> scrubbed email, for later board cross-refs
  for (const doc of snap.docs) {
    i++;
    const name  = `Test Client ${letterFor(i - 1)}`;
    const email = TEST_EMAIL(i);
    const update = {
      name,
      email,
      phone: TEST_PHONE,
    };
    const d = doc.data() || {};
    if (Array.isArray(d.emails))  update.emails  = d.emails.map(_ => email);
    if (Array.isArray(d.phones))  update.phones  = d.phones.map(_ => TEST_PHONE);
    if (d.primaryAddress)  update.primaryAddress  = scrubAddress(d.primaryAddress);
    if (d.shippingAddress) update.shippingAddress = scrubAddress(d.shippingAddress);
    if (d.billingAddress)  update.billingAddress  = scrubAddress(d.billingAddress);
    map[doc.id] = { name, email };

    if (APPLY) {
      try {
        await doc.ref.set(update, { merge: true });
        stats.clients++;
      } catch (e) {
        stats.errors++;
        errors.push({ path: doc.ref.path, error: e.message });
      }
    } else {
      stats.clients++;
    }
  }
  console.log('  clients scrubbed:', stats.clients);
  return map;
}

async function scrubBoards(clientMap) {
  console.log('--- scrubbing boards (clientName / clientEmail fields only) ---');
  const snap = await db.collection('boards').get();
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const update = {};
    if ('clientName' in d)  update.clientName  = `[Scrubbed: ${doc.id}]`;
    if ('clientEmail' in d) {
      const known = d.clientId && clientMap[d.clientId];
      update.clientEmail = known ? known.email : `staging-client-x@cchdesign-test.com`;
    }
    if (Object.keys(update).length === 0) { stats.skipped++; continue; }

    if (APPLY) {
      try {
        await doc.ref.set(update, { merge: true });
        stats.boards++;
      } catch (e) {
        stats.errors++;
        errors.push({ path: doc.ref.path, error: e.message });
      }
    } else {
      stats.boards++;
    }
  }
  console.log('  boards scrubbed:', stats.boards, ' skipped:', stats.skipped);
}

async function scrubVendors() {
  if (!SCRUB_VENDORS) {
    console.log('--- skipping vendors (pass --scrub-vendors to include) ---');
    return;
  }
  console.log('--- scrubbing vendors ---');
  const snap = await db.collection('vendors').get();
  let i = 0;
  for (const doc of snap.docs) {
    i++;
    const update = {
      contactEmail: `staging-vendor-${i}@cchdesign-test.com`,
      contactPhone: TEST_PHONE
    };
    if (APPLY) {
      try {
        await doc.ref.set(update, { merge: true });
        stats.vendors++;
      } catch (e) {
        stats.errors++;
        errors.push({ path: doc.ref.path, error: e.message });
      }
    } else {
      stats.vendors++;
    }
  }
  console.log('  vendors scrubbed:', stats.vendors);
}

// ---------------------------------------------------------------------------
// Main

(async () => {
  console.log('');
  console.log('=== scrub-staging ============================================');
  console.log('Mode:           ', APPLY ? 'APPLY (will write to staging)' : 'DRY-RUN (no writes)');
  console.log('Target project: ', STAGING_PROJECT);
  console.log('Scrub vendors:  ', SCRUB_VENDORS);
  console.log('==============================================================');
  console.log('');

  const clientMap = await scrubClients();
  await scrubBoards(clientMap);
  await scrubVendors();

  console.log('');
  console.log('=== summary =================================================');
  console.log('clients:', stats.clients);
  console.log('boards: ', stats.boards);
  console.log('vendors:', stats.vendors);
  console.log('skipped:', stats.skipped);
  console.log('errors: ', stats.errors);
  if (errors.length) {
    console.log('--- first 10 errors ---');
    errors.slice(0, 10).forEach(e => console.log(' ', e.path, '::', e.error));
  }
  console.log('==============================================================');

  // Manifest
  const manifestPath = path.join(
    __dirname, '..', '_debug',
    'scrub-staging-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'
  );
  fs.writeFileSync(manifestPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    apply: APPLY,
    scrubVendors: SCRUB_VENDORS,
    stats,
    errorsSample: errors.slice(0, 50)
  }, null, 2));
  console.log('manifest:        ', manifestPath);
  console.log('');

  if (!APPLY) {
    console.log('This was a DRY RUN. To actually scrub, re-run with --apply.');
  } else {
    console.log('Staging is now scrubbed. Verify by opening:');
    console.log('  https://cch-platform-staging.web.app');
    console.log('and confirming no real client names/emails appear.');
  }

  await stagingApp.delete();
})().catch(err => {
  console.error('FATAL:', err && err.stack || err);
  process.exit(1);
});
