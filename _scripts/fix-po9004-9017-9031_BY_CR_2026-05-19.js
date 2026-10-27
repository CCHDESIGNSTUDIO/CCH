// Repair PO-9004 (duplicate bill merch), PO-9017 (partial ship / paid status), PO-9031 (stale ship-to address).
// READ-ONLY unless run with --apply. Backs up each PO doc before any write.
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

const APPLY = process.argv.includes('--apply');
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json',
  'cch-design-boards-firebase-adminsdk-fbsvc-d9c97d4c97.json');
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

admin.initializeApp({ credential: admin.credential.cert(require(KEY)) });
const db = admin.firestore();

const PO9031 = {
  project: 'cloud-rolling-hills',
  id: 'EfYu4Rn7DvCYLh5hL98p',
  shipToAddress: 'Designers Moving Service\n3595 Cadillac Ave Suite #102\nCosta Mesa, CA 92626',
};

const PO9004 = {
  project: '7225-bugletrail',
  id: 'cHE6A8MUqBnJFxZOJ39b',
  targetBillTotal: 517.37,
};

const PO9017 = {
  project: 'holtz-hill',
  id: 'OoJQD6lsx2xqhCYKWiZS',
};

function normTitle(t) {
  return String(t || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isDuplicateExtra(it, poLines) {
  if (!it || it.source !== 'extra') return false;
  const amt = round2(it.amount);
  const desc = normTitle(it.note || it.title);
  for (const l of poLines) {
    const lineAmt = round2(l.amount);
    if (Math.abs(lineAmt - amt) > 0.02) continue;
    const title = normTitle(l.title || l.name);
    if (!desc || desc === title || title.includes(desc) || desc.includes(title)) return true;
  }
  return false;
}

function poLineMeta(items) {
  return (items || []).map((it, i) => ({
    lineId: it.lineId || ('po_line_' + i),
    title: it.title || it.name || 'Item',
    amount: round2(it.amount != null ? it.amount : (Number(it.qty) || 0) * (Number(it.cost) || 0)),
  }));
}

function shippedLineIdsFromGroups(groups) {
  const out = new Set();
  (groups || []).forEach((g) => {
    if (String(g.documentType || '').trim() === 'confirmation') return;
    if (!String(g.vendorInvoiceNumber || '').trim()) return;
    (g.poLineIds || []).forEach((id) => { if (id) out.add(id); });
  });
  return out;
}

function openToShipAmount(doc) {
  const items = doc.items || [];
  const shipped = shippedLineIdsFromGroups(doc.vendorInvoiceGroups);
  let open = 0;
  items.forEach((it, i) => {
    const lineId = it.lineId || ('po_line_' + i);
    if (shipped.has(lineId)) return;
    open += round2(it.amount != null ? it.amount : (Number(it.qty) || 0) * (Number(it.cost) || 0));
  });
  return round2(open);
}

function recalcBillTotal(bill, items) {
  bill = bill || {};
  const poLines = (bill.poLines && bill.poLines.length) ? bill.poLines : poLineMeta(items);
  const billedIds = Array.isArray(bill.billedPoLineIds) && bill.billedPoLineIds.length
    ? bill.billedPoLineIds.slice()
    : poLines.map((l) => l.lineId);
  const poSubtotal = billedIds.reduce((s, id) => {
    const l = poLines.find((x) => x.lineId === id);
    return s + (l ? round2(l.amount) : 0);
  }, 0);
  const chargeItems = (bill.items || []).filter((it) => it && it.source !== 'po' && !isDuplicateExtra(it, poLines));
  const chargeSum = chargeItems.reduce((s, it) => s + round2(it.amount), 0);
  const vendorInvoices = (bill.vendorInvoices || []).filter((r) => {
    if (!r || r.type === 'merchandise') return true;
    return !isDuplicateExtra({ source: 'extra', note: r.description, amount: r.amount }, poLines);
  });
  return {
    poSubtotal: round2(poSubtotal),
    additionalSubtotal: round2(chargeSum),
    billTotal: round2(poSubtotal + chargeSum),
    items: poLines.filter((l) => billedIds.includes(l.lineId)).map((l) => ({
      source: 'po', title: l.title, amount: l.amount, lineId: l.lineId,
    })).concat(chargeItems),
    vendorInvoices,
    extras: round2(vendorInvoices.filter((r) => r.type === 'extra').reduce((s, r) => s + round2(r.amount), 0)),
  };
}

async function load(project, id) {
  const ref = db.collection('boards').doc(project).collection('purchaseOrders').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('PO not found: ' + project + '/' + id);
  return { ref, data: snap.data() };
}

async function backup(tag, project, id, data) {
  const dir = path.join(__dirname, '..', '_backup', 'po-fix-9004-9017-9031-2026-05-19');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, tag + '-' + project + '-' + id + '.json');
  fs.writeFileSync(file, JSON.stringify({ project, id, data }, null, 2));
  console.log('Backup:', file);
}

(async () => {
  const patches = [];

  {
    const { ref, data } = await load(PO9031.project, PO9031.id);
    console.log('\n=== PO-9031 (' + PO9031.project + ') ===');
    console.log('  shipTo:', data.shipTo);
    console.log('  shipToAddress BEFORE:', (data.shipToAddress || '').slice(0, 80));
    if (data.shipToAddress !== PO9031.shipToAddress) {
      patches.push({
        tag: 'po9031',
        ref,
        patch: { shipToAddress: PO9031.shipToAddress, updatedAt: new Date().toISOString() },
        before: data,
      });
      console.log('  shipToAddress AFTER :', PO9031.shipToAddress.slice(0, 80));
    } else {
      console.log('  (no change needed)');
    }
  }

  {
    const { ref, data } = await load(PO9004.project, PO9004.id);
    const bill = Object.assign({}, data.bill || {});
    const items = (data.items || []).slice();
    const groups = (data.vendorInvoiceGroups || []).map((g) => Object.assign({}, g));
    console.log('\n=== PO-9004 (' + PO9004.project + ') ===');
    console.log('  bill.billTotal BEFORE:', bill.billTotal);
    const recalc = recalcBillTotal(bill, items);
    bill.items = recalc.items;
    bill.vendorInvoices = recalc.vendorInvoices;
    bill.poSubtotal = recalc.poSubtotal;
    bill.additionalSubtotal = recalc.additionalSubtotal;
    bill.billTotal = PO9004.targetBillTotal;
    bill.extras = recalc.extras;
    groups.forEach((g) => {
      if (String(g.documentType || '').trim() !== 'confirmation') return;
      if ((g.poLineIds || []).includes('po_line_3') && items.length === 1) {
        g.poLineIds = ['po_line_0'];
        console.log('  confirmation poLineIds: po_line_3 -> po_line_0');
      }
    });
    console.log('  bill.billTotal AFTER :', bill.billTotal);
    const patch = { bill, vendorInvoiceGroups: groups, updatedAt: new Date().toISOString() };
    if (data.varianceAmount != null) {
      const poAt = round2(data.poTotalAtSend != null ? data.poTotalAtSend : data.total);
      patch.varianceAmount = round2(bill.billTotal - poAt);
      patch.varianceType = Math.abs(patch.varianceAmount) < 0.02 ? 'none' : (patch.varianceAmount < 0 ? 'refund_due_client' : 'additional_due');
      console.log('  varianceAmount:', patch.varianceAmount);
    }
    patches.push({ tag: 'po9004', ref, patch, before: data });
  }

  {
    const { ref, data } = await load(PO9017.project, PO9017.id);
    const bill = Object.assign({}, data.bill || {});
    const openAmt = openToShipAmount(data);
    console.log('\n=== PO-9017 (' + PO9017.project + ') ===');
    console.log('  status BEFORE:', data.status, '| shippingStatus:', data.shippingStatus);
    console.log('  open to ship (from ship invoices):', openAmt);
    console.log('  bill.billTotal BEFORE:', bill.billTotal);
    const recalc = recalcBillTotal(bill, data.items || []);
    bill.items = recalc.items;
    bill.vendorInvoices = recalc.vendorInvoices;
    bill.poSubtotal = recalc.poSubtotal;
    bill.additionalSubtotal = recalc.additionalSubtotal;
    bill.billTotal = recalc.billTotal;
    const patch = { bill, updatedAt: new Date().toISOString() };
    if (openAmt > 0.01 && String(data.status || '').toLowerCase() === 'paid') {
      patch.status = 'Partial';
      patch.shippingStatus = data.shippingStatus === 'Shipped' ? 'Partial' : (data.shippingStatus || 'Partial');
      console.log('  status AFTER: Partial (unshipped merch remains)');
    }
    if (data.varianceAmount != null) {
      const poAt = round2(data.poTotalAtSend != null ? data.poTotalAtSend : data.total);
      patch.varianceAmount = round2(bill.billTotal - poAt);
      patch.varianceType = Math.abs(patch.varianceAmount) < 0.02 ? 'none' : (patch.varianceAmount < 0 ? 'refund_due_client' : 'additional_due');
      console.log('  varianceAmount:', patch.varianceAmount, '(was', data.varianceAmount + ')');
    }
    console.log('  bill.billTotal AFTER :', bill.billTotal);
    patches.push({ tag: 'po9017', ref, patch, before: data });
  }

  console.log('\n--- Summary: ' + patches.length + ' PO(s) with patches ---');
  if (!APPLY) {
    console.log('\nDRY RUN — no writes. Re-run with --apply to write.');
    process.exit(0);
  }

  for (const p of patches) {
    await backup(p.tag, p.before.poNum || p.tag, p.ref.id, p.before);
    await p.ref.update(p.patch);
    console.log('APPLIED:', p.tag, p.ref.path);
  }
  console.log('\nDone.');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
