const fs = require("fs");
const path = require("path");
const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs } = require("firebase/firestore");

const PROD = {
  apiKey: "AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og",
  authDomain: "cch-design-boards.firebaseapp.com",
  projectId: "cch-design-boards",
  storageBucket: "cch-design-boards.firebasestorage.app",
};

const BOARD_ID = "7225-bugletrail";
const OUT = path.join(__dirname, "bugletrail-prod-po-snapshot.json");

async function main() {
  const db = getFirestore(initializeApp(PROD));
  const snap = await getDocs(collection(db, "boards", BOARD_ID, "purchaseOrders"));
  const rows = [];
  snap.forEach((d) => {
    const x = d.data() || {};
    rows.push({
      id: d.id,
      number: x.number || x.num || "",
      status: x.status || "",
      total: x.total || 0,
      paidAmount: x.paidAmount || 0,
      paymentStatus: x.paymentStatus || "",
      qbStatus: x.qbStatus || "",
      hasPaymentsArray: Array.isArray(x.payments) && x.payments.length > 0,
      paymentsCount: Array.isArray(x.payments) ? x.payments.length : 0,
    });
  });
  fs.writeFileSync(OUT, JSON.stringify({ boardId: BOARD_ID, count: rows.length, rows }, null, 2));
  console.log(`Wrote ${rows.length} rows -> ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
