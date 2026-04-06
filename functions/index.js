const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

const TIMELY_CLIENT_ID = "X0t2mXABI8R81qN8PDzX1iSAfMybb6cdpzfUT1Z1Otc";
const TIMELY_CLIENT_SECRET = "f71829f106a93ce3e692b7f392d457a6d95bec579932095fa368430a16b884ca";
const TIMELY_REDIRECT_URI = "https://cch-platform.web.app";
const TIMELY_ACCOUNT_ID = "874495";

exports.healthCheck = functions.https.onCall((data, context) => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Exchange Timely OAuth code for access token
exports.timelyAuth = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "https://cch-platform.web.app");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: "Missing code parameter" });

  try {
    const fetch = (await import("node-fetch")).default;
    const resp = await fetch("https://api.timelyapp.com/1.1/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: TIMELY_CLIENT_ID,
        client_secret: TIMELY_CLIENT_SECRET,
        redirect_uri: TIMELY_REDIRECT_URI,
        code: code
      }).toString()
    });
    const data = await resp.json();
    if (data.error) return res.status(400).json(data);

    // Store token in Firestore
    await db.collection("settings").doc("timely").set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      scope: data.scope || "",
      connectedAt: new Date().toISOString(),
      accountId: TIMELY_ACCOUNT_ID
    });

    return res.status(200).json({ status: "connected", expiresIn: data.expires_in });
  } catch (err) {
    console.error("[Timely Auth] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Pull time entries from Timely API
exports.timelySyncEntries = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "https://cch-platform.web.app");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    const tokenDoc = await db.collection("settings").doc("timely").get();
    if (!tokenDoc.exists) return res.status(400).json({ error: "Timely not connected" });
    const { accessToken, accountId } = tokenDoc.data();

    const startDate = req.body.startDate || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const endDate = req.body.endDate || new Date().toISOString().slice(0, 10);

    const fetch = (await import("node-fetch")).default;
    const resp = await fetch(`https://api.timelyapp.com/1.1/${accountId}/events?since=${startDate}&upto=${endDate}`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    if (resp.status === 401) return res.status(401).json({ error: "Token expired — reconnect Timely" });
    const entries = await resp.json();

    // Write each entry to Firestore
    let saved = 0;
    for (const entry of entries) {
      const docId = "timely-" + entry.id;
      // Timely API v1.1: duration is in entry.duration object
      // { total_seconds, total_hours, total_minutes, hours, minutes, seconds }
      // The top-level entry.hours field is always 0 — ignore it
      const dur = entry.duration || {};
      const durSecs = parseFloat(dur.total_seconds) || 0;
      const hoursVal = parseFloat(dur.total_hours) || (durSecs / 3600) || (parseFloat(dur.total_minutes) / 60) || 0;
      await db.collection("timelyEntries").doc(docId).set({
        source: "timely-api",
        timelyId: entry.id,
        date: entry.day || "",
        hours: hoursVal,
        minutes: Math.round(durSecs / 60),
        note: entry.note || "",
        project: entry.project ? entry.project.name : "",
        timelyProjectId: entry.project_id || "",
        member: entry.user ? entry.user.name : "",
        timelyUserId: entry.user_id || "",
        billed: entry.billed || false,
        label: entry.label_ids || [],
        createdAt: entry.created_at || "",
        updatedAt: entry.updated_at || "",
        raw: entry
      }, { merge: true });
      saved++;
    }

    return res.status(200).json({ status: "ok", fetched: entries.length, saved: saved, startDate, endDate });
  } catch (err) {
    console.error("[Timely Sync] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Timely webhook — receives hours:created, hours:updated events
exports.timelyWebhook = functions.https.onRequest(async (req, res) => {
  // Accept GET for Timely verification ping
  if (req.method === "GET") {
    return res.status(200).send("OK");
  }

  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  try {
    const payload = req.body;
    const event = payload.event || "";
    const data = payload.data || payload;

    console.log("[Timely Webhook]", event, JSON.stringify(data).substring(0, 500));

    // Extract time entry data
    const entry = data.time_entry || data.hour || data;
    if (!entry || !entry.id) {
      return res.status(200).send("No entry data");
    }

    const timelyId = String(entry.id);
    // Timely sends duration as object {total, total_with_timer} in seconds
    const rawDur = entry.duration;
    const durSecs = (rawDur && typeof rawDur === "object")
      ? (rawDur.total || 0)
      : (typeof rawDur === "number" ? (rawDur > 24 ? rawDur : rawDur * 3600) : 0);
    const durationMin = Math.round(durSecs / 60);
    const duration = durSecs / 3600; // store as decimal hours
    const date = entry.day || entry.date || new Date().toISOString().slice(0, 10);
    const note = entry.note || entry.description || "";
    const projectId = entry.project_id || "";
    const projectName = (entry.project && entry.project.name) || "";
    const userId = entry.user_id || "";
    const userName = (entry.user && entry.user.name) || "";
    const billed = entry.billed || false;

    // Write to Firestore — desktopTimeLogs style for Smart Time compatibility
    const docId = date + "-timely-" + timelyId;
    await db.collection("timelyEntries").doc(docId).set({
      source: "timely-webhook",
      timelyId: timelyId,
      date: date,
      hours: duration,
      duration: duration,
      durationMinutes: durationMin,
      note: note,
      project: projectName,
      timelyProjectId: projectId,
      member: userName,
      timelyUserId: userId,
      billed: billed,
      event: event,
      receivedAt: new Date().toISOString(),
      raw: entry
    }, { merge: true });

    console.log("[Timely Webhook] Saved:", docId, projectName, durationMin + "min");
    return res.status(200).json({ status: "ok", docId: docId });

  } catch (err) {
    console.error("[Timely Webhook] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// SEARCH INDEX + FINANCIAL SUMMARY — Denormalized for speed
// ══════════════════════════════════════════════════════════

// Callable via button in platform or scheduled
exports.rebuildSearchIndex = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "https://cch-platform.web.app");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    console.log("[SearchIndex] Starting rebuild...");
    const projSnap = await db.collection("projects").get();
    const projNames = {};
    const projClients = {};
    projSnap.forEach(d => {
      const data = d.data();
      projNames[d.id] = data.name || d.id;
      projClients[d.id] = data.clientName || "";
    });
    const projectIds = Object.keys(projNames);

    // Collect all docs
    let allItems = [];
    let stats = { projects: 0, invoices: 0, pos: 0, proposals: 0, products: 0 };

    // Projects
    projSnap.forEach(d => {
      const data = d.data();
      allItems.push({
        type: "project", id: d.id, projectId: d.id,
        title: data.name || d.id,
        subtitle: data.clientName || "",
        status: data.status || "",
        amount: parseFloat(data.designFee || data.fee || data.budget) || 0,
        vendor: "",
        number: "",
        search: [data.name, data.clientName, data.projectAddress, d.id].filter(Boolean).join(" ").toLowerCase()
      });
      stats.projects++;
    });

    // Invoices, Proposals, POs from each project
    for (const pid of projectIds) {
      const pName = projNames[pid];
      // Invoices
      try {
        const invSnap = await db.collection("boards").doc(pid).collection("invoices").get();
        invSnap.forEach(d => {
          const data = d.data();
          const num = data.invoiceNum || data.number || "";
          const total = parseFloat(data.total) || 0;
          const vendor = data.vendor || "";
          const client = data.clientName || projClients[pid] || "";
          allItems.push({
            type: "invoice", id: d.id, projectId: pid,
            title: num || d.id.slice(0, 8),
            subtitle: pName,
            status: data.status || "Draft",
            amount: total,
            vendor: vendor,
            client: client,
            number: num,
            date: data.date || data.createdAt || "",
            search: [num, pName, vendor, client, data.status, data.memo, String(total)].filter(Boolean).join(" ").toLowerCase()
          });
          stats.invoices++;
        });
      } catch (e) {}

      // Proposals
      try {
        const prSnap = await db.collection("boards").doc(pid).collection("proposals").get();
        prSnap.forEach(d => {
          const data = d.data();
          const num = data.proposalNum || data.name || data.number || "";
          const total = parseFloat(data.total) || 0;
          const itemTitles = (data.items || []).map(it => [it.title, it.vendor].filter(Boolean).join(" ")).join(" ");
          allItems.push({
            type: "proposal", id: d.id, projectId: pid,
            title: num || d.id.slice(0, 8),
            subtitle: pName,
            status: data.status || "Draft",
            amount: total,
            vendor: "",
            number: num,
            date: data.date || data.createdAt || "",
            search: [num, pName, data.status, itemTitles, String(total)].filter(Boolean).join(" ").toLowerCase()
          });
          stats.proposals++;
        });
      } catch (e) {}

      // POs
      try {
        const poSnap = await db.collection("boards").doc(pid).collection("purchaseOrders").get();
        poSnap.forEach(d => {
          const data = d.data();
          const num = data.number || data.num || data.poNum || "";
          const total = parseFloat(data.total) || 0;
          const vendor = data.vendor || "";
          allItems.push({
            type: "po", id: d.id, projectId: pid,
            title: num || d.id.slice(0, 8),
            subtitle: pName,
            status: data.status || "Draft",
            amount: total,
            vendor: vendor,
            number: num,
            date: data.date || data.orderDate || data.createdAt || "",
            search: [num, pName, vendor, data.status, data.eta, String(total)].filter(Boolean).join(" ").toLowerCase()
          });
          stats.pos++;
        });
      } catch (e) {}
    }

    // Products from master library
    try {
      const prodSnap = await db.collection("products").get();
      prodSnap.forEach(d => {
        const p = d.data();
        if (!p.title) return;
        const cost = parseFloat(p.cost || p.costPrice || p.unitCost) || 0;
        const sell = parseFloat(p.clientPrice || p.sellPrice || p.totalSelling) || 0;
        allItems.push({
          type: "product", id: d.id, projectId: "",
          title: p.title,
          subtitle: p.vendor || p.manufacturer || "",
          status: p.category || "",
          amount: sell || cost,
          vendor: p.vendor || p.manufacturer || "",
          number: p.sku || "",
          search: [p.title, p.vendor, p.manufacturer, p.category, p.sku, p.description, p.room, p.finish, p.dimensions, String(cost), String(sell)].filter(Boolean).join(" ").toLowerCase()
        });
        stats.products++;
      });
    } catch (e) {}

    // Write to _searchIndex in batches of 400
    // First, delete old index
    const oldSnap = await db.collection("_searchIndex").get();
    let delBatch = db.batch();
    let delCount = 0;
    for (const doc of oldSnap.docs) {
      delBatch.delete(doc.ref);
      delCount++;
      if (delCount % 400 === 0) { await delBatch.commit(); delBatch = db.batch(); }
    }
    if (delCount % 400 !== 0) await delBatch.commit();

    // Write new index
    let writeBatch = db.batch();
    let writeCount = 0;
    for (let i = 0; i < allItems.length; i++) {
      const item = allItems[i];
      const docRef = db.collection("_searchIndex").doc(item.type + "-" + item.id);
      writeBatch.set(docRef, item);
      writeCount++;
      if (writeCount % 400 === 0) { await writeBatch.commit(); writeBatch = db.batch(); }
    }
    if (writeCount % 400 !== 0) await writeBatch.commit();

    console.log("[SearchIndex] Done:", JSON.stringify(stats));
    return res.status(200).json({ status: "ok", total: allItems.length, stats, deletedOld: delCount });

  } catch (err) {
    console.error("[SearchIndex] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Financial summary — one doc with all KPIs
exports.rebuildFinancialSummary = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "https://cch-platform.web.app");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    console.log("[FinSummary] Starting rebuild...");
    const projSnap = await db.collection("projects").get();
    const projNames = {};
    projSnap.forEach(d => { projNames[d.id] = d.data().name || d.id; });

    let totalInvoiced = 0, totalPaid = 0, totalPOCost = 0;
    let openInvoiceCount = 0, openInvoiceAmount = 0;
    let openPOCount = 0, openPOAmount = 0;
    let invoiceCount = 0, poCount = 0, proposalCount = 0;
    const vendorSpend = {};
    const projectRevenue = {};

    for (const pid of Object.keys(projNames)) {
      const pName = projNames[pid];
      if (!projectRevenue[pName]) projectRevenue[pName] = { invoiced: 0, paid: 0, poCost: 0 };

      try {
        const invSnap = await db.collection("boards").doc(pid).collection("invoices").get();
        invSnap.forEach(d => {
          const data = d.data();
          const total = parseFloat(data.total) || 0;
          totalInvoiced += total;
          invoiceCount++;
          projectRevenue[pName].invoiced += total;
          const pmts = (data.payments || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
          if (pmts > 0) { totalPaid += pmts; projectRevenue[pName].paid += pmts; }
          else if (data.status === "Paid") { totalPaid += total; projectRevenue[pName].paid += total; }
          if (data.status !== "Paid" && data.status !== "Draft" && data.status !== "Cancelled") {
            openInvoiceCount++;
            openInvoiceAmount += total - pmts;
          }
        });
      } catch (e) {}

      try {
        const poSnap = await db.collection("boards").doc(pid).collection("purchaseOrders").get();
        poSnap.forEach(d => {
          const data = d.data();
          const total = parseFloat(data.total) || 0;
          totalPOCost += total;
          poCount++;
          projectRevenue[pName].poCost += total;
          const vendor = data.vendor || "Unknown";
          if (!vendorSpend[vendor]) vendorSpend[vendor] = 0;
          vendorSpend[vendor] += total;
          if (!["Installed", "Received", "Cancelled", "Closed", "Paid"].includes(data.status)) {
            openPOCount++;
            openPOAmount += total;
          }
        });
      } catch (e) {}

      try {
        const prSnap = await db.collection("boards").doc(pid).collection("proposals").get();
        proposalCount += prSnap.size;
      } catch (e) {}
    }

    // Time entries summary
    let totalHours = 0, billableHours = 0, billableValue = 0;
    const memberHours = {};
    try {
      const teSnap = await db.collection("timeEntries").limit(15000).get();
      teSnap.forEach(d => {
        const e = d.data();
        const hrs = parseFloat(e.hours) || 0;
        totalHours += hrs;
        if (e.billable) { billableHours += hrs; billableValue += parseFloat(e.total) || 0; }
        const member = e.member || e.user || "Unknown";
        if (!memberHours[member]) memberHours[member] = { total: 0, billable: 0, value: 0 };
        memberHours[member].total += hrs;
        if (e.billable) { memberHours[member].billable += hrs; memberHours[member].value += parseFloat(e.total) || 0; }
      });
    } catch (e) {}

    // Top vendors by spend
    const topVendors = Object.entries(vendorSpend)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([name, amount]) => ({ name, amount }));

    const summary = {
      updatedAt: new Date().toISOString(),
      totalInvoiced, totalPaid,
      totalOutstanding: totalInvoiced - totalPaid,
      totalPOCost,
      openInvoiceCount, openInvoiceAmount,
      openPOCount, openPOAmount,
      invoiceCount, poCount, proposalCount,
      projectCount: Object.keys(projNames).length,
      totalHours: Math.round(totalHours * 10) / 10,
      billableHours: Math.round(billableHours * 10) / 10,
      billableValue: Math.round(billableValue * 100) / 100,
      topVendors,
      memberHours,
      projectRevenue
    };

    await db.collection("_cache").doc("financialSummary").set(summary);
    console.log("[FinSummary] Done:", invoiceCount, "invoices,", poCount, "POs");
    return res.status(200).json({ status: "ok", summary });

  } catch (err) {
    console.error("[FinSummary] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});
