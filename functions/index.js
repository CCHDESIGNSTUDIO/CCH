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
      await db.collection("timelyEntries").doc(docId).set({
        source: "timely-api",
        timelyId: entry.id,
        date: entry.day || "",
        hours: entry.hours || 0,
        minutes: Math.round((entry.hours || 0) * 60),
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
    const duration = entry.duration || entry.hours || 0;
    const durationMin = typeof duration === "number" && duration < 24
      ? Math.round(duration * 60)  // hours format
      : Math.round(duration / 60); // seconds format
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
