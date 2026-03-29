// ============================================================
// CCH Studio — Cloud Functions for Smart Time Integrations
// ============================================================
// YOUR STACK:
//   Teams + Outlook + Calendar  → Office 365 (Microsoft Graph)
//   Dropbox file activity       → Dropbox API
//   SketchUp + PPT              → PowerShell desktop agent
//   Canva + Chrome browsing     → CCH Clipper time-tracker.js
//   CCH Studio platform         → Built-in activity logging
// ============================================================
// DEPLOY:
//   cd C:\Users\cindy\Downloads\CCH-Platform-Deploy\cch-deploy
//   cd Functions && npm install && cd ..
//   firebase deploy --only functions
// ============================================================

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

// ==================== HELPERS ====================

async function writeTimeLogs(date, items, source) {
  const docId = `${source}-${date}`;
  const ref = db.collection("desktopTimeLogs").doc(docId);
  const existing = await ref.get();
  if (existing.exists) {
    const existingItems = (existing.data().items || []);
    const existingTitles = new Set(existingItems.map(i => i.titles));
    const newItems = items.filter(i => !existingTitles.has(i.titles));
    if (newItems.length > 0) {
      await ref.update({ items: admin.firestore.FieldValue.arrayUnion(...newItems), updatedAt: new Date().toISOString() });
    }
  } else {
    await ref.set({ date, source, items, userId: "cindy@cchdesign.com", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
}

function matchProject(text) {
  if (!text) return "";
  const t = text.toLowerCase();
  const map = {
    "whitesail": "31 Whitesail", "sahand": "31 Whitesail", "nayebaziz": "31 Whitesail",
    "bradbury": "Bradbury-High", "josh": "Bradbury-High", "susan": "Bradbury-High",
    "bugle": "Bugle Trail", "april box": "Bugle Trail", "four hands": "Bugle Trail",
    "shimano": "Shimano", "polito": "Polito BVR",
    "rolling hill": "Cloud Rolling Hills", "cloud": "Cloud Rolling Hills", "rhcc": "Cloud Rolling Hills",
    "west avalon": "West Avalon", "vaughn": "West Avalon",
    "elu": "ELU Atelier", "robert abbey": "ELU Atelier", "dana creath": "ELU Atelier",
    "hubbardton": "ELU Atelier", "discovery club": "ELU Atelier",
    "katke": "Katke", "holtz": "Holtz Hill", "aitken": "Aitken", "wolff": "Wolff",
    "vanessa": "CCH Admin", "quickbooks": "CCH Admin", "invoice": "CCH Admin"
  };
  for (const [keyword, project] of Object.entries(map)) {
    if (t.includes(keyword)) return project;
  }
  return "";
}

// ==================== 1. OFFICE 365 (Teams + Outlook + Calendar) ====================

async function getMicrosoftToken() {
  const doc = await db.collection("admin").doc("microsoft").get();
  if (!doc.exists) throw new Error("Microsoft credentials not configured. Add admin/microsoft doc.");
  const config = doc.data();
  const fetch = (await import("node-fetch")).default;
  const res = await fetch(
    `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: config.clientId, scope: "https://graph.microsoft.com/.default",
        client_secret: config.clientSecret, grant_type: "client_credentials" }) }
  );
  const json = await res.json();
  if (!json.access_token) throw new Error("Token failed: " + JSON.stringify(json));
  return json.access_token;
}

exports.syncOffice365 = functions.pubsub.schedule("every 2 hours").timeZone("America/Los_Angeles").onRun(async () => {
  try {
    const token = await getMicrosoftToken();
    const fetch = (await import("node-fetch")).default;
    const today = new Date().toISOString().slice(0, 10);
    const startOfDay = today + "T00:00:00Z";
    const endOfDay = today + "T23:59:59Z";
    const items = [];

    // --- OUTLOOK EMAILS ---
    for (const folder of ["inbox", "sentitems"]) {
      try {
        const emailRes = await fetch(
          `https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages?` +
          `$filter=receivedDateTime ge ${startOfDay} and receivedDateTime le ${endOfDay}` +
          `&$select=subject,from,receivedDateTime&$top=100&$orderby=receivedDateTime desc`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const emailData = await emailRes.json();
        const threads = {};
        (emailData.value || []).forEach(msg => {
          const subj = (msg.subject || "").replace(/^(Re:|Fwd:|FW:)\s*/gi, "").trim();
          if (!threads[subj]) threads[subj] = { count: 0, project: "" };
          threads[subj].count++;
          if (!threads[subj].project) threads[subj].project = matchProject(msg.subject + " " + (msg.from?.emailAddress?.name || ""));
        });
        Object.entries(threads).forEach(([subj, data]) => {
          items.push({ app: folder === "inbox" ? "Outlook (Received)" : "Outlook (Sent)",
            category: "Email", titles: subj, seconds: data.count * 180, count: data.count, project: data.project });
        });
      } catch (e) { console.error("Email sync:", e.message); }
    }

    // --- TEAMS CHATS ---
    try {
      const chatsRes = await fetch(`https://graph.microsoft.com/v1.0/me/chats?$top=30`,
        { headers: { Authorization: `Bearer ${token}` } });
      const chats = (await chatsRes.json()).value || [];
      for (const chat of chats.slice(0, 15)) {
        try {
          const msgRes = await fetch(
            `https://graph.microsoft.com/v1.0/me/chats/${chat.id}/messages?$top=50&$orderby=createdDateTime desc`,
            { headers: { Authorization: `Bearer ${token}` } });
          const todayMsgs = ((await msgRes.json()).value || []).filter(m => m.createdDateTime && m.createdDateTime >= startOfDay);
          if (todayMsgs.length > 0) {
            const chatName = chat.topic || (chat.chatType === "oneOnOne" ? "Direct Message" : "Group Chat");
            items.push({ app: "Microsoft Teams", category: "Communication",
              titles: "Teams: " + chatName, seconds: todayMsgs.length * 120, count: todayMsgs.length, project: matchProject(chatName) });
          }
        } catch (e) {}
      }
    } catch (e) { console.error("Teams sync:", e.message); }

    // --- CALENDAR EVENTS (identifies Teams meetings) ---
    try {
      const calRes = await fetch(
        `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${startOfDay}&endDateTime=${endOfDay}` +
        `&$select=subject,start,end,attendees,isOnlineMeeting,onlineMeetingProvider&$top=50`,
        { headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.timezone="America/Los_Angeles"' } });
      ((await calRes.json()).value || []).forEach(event => {
        const start = new Date(event.start.dateTime);
        const end = new Date(event.end.dateTime);
        const seconds = Math.round((end - start) / 1000);
        if (seconds < 60 || seconds > 28800) return;
        const isTeams = event.isOnlineMeeting && (event.onlineMeetingProvider === "teamsForBusiness" || event.onlineMeetingProvider === "teams");
        const attendees = (event.attendees || []).map(a => a.emailAddress?.name || "").join(", ");
        items.push({ app: isTeams ? "Teams Meeting" : "Outlook Calendar", category: "Communication",
          titles: event.subject || "Meeting", seconds, count: 1, project: matchProject(event.subject + " " + attendees) });
      });
    } catch (e) { console.error("Calendar sync:", e.message); }

    if (items.length > 0) {
      await writeTimeLogs(today, items, "office365");
      console.log(`Office 365 sync: ${items.length} entries`);
    }
  } catch (err) { console.error("Office 365 sync error:", err); }
  return null;
});

exports.setupMicrosoftSubscriptions = functions.https.onCall(async () => {
  const token = await getMicrosoftToken();
  const fetch = (await import("node-fetch")).default;
  const projectId = process.env.GCLOUD_PROJECT || "cch-design-boards";
  const url = `https://us-central1-${projectId}.cloudfunctions.net/microsoftWebhook`;
  const resources = [
    { resource: "/me/mailFolders/Inbox/messages", type: "email" },
    { resource: "/me/events", type: "calendar" },
    { resource: "/me/chats/getAllMessages", type: "teams" }
  ];
  const results = [];
  for (const r of resources) {
    try {
      await fetch("https://graph.microsoft.com/v1.0/subscriptions", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ changeType: "created", notificationUrl: url, resource: r.resource,
          expirationDateTime: new Date(Date.now() + 29*24*60*60*1000).toISOString(), clientState: r.type })
      });
      results.push({ resource: r.resource, status: "ok" });
    } catch (e) { results.push({ resource: r.resource, error: e.message }); }
  }
  return { results };
});

exports.microsoftWebhook = functions.https.onRequest(async (req, res) => {
  if (req.query.validationToken) return res.status(200).send(req.query.validationToken);
  const today = new Date().toISOString().slice(0, 10);
  const items = (req.body.value || []).map(n => {
    const src = n.clientState || "email";
    return { app: src === "teams" ? "Microsoft Teams" : src === "calendar" ? "Outlook Calendar" : "Outlook",
      category: src === "teams" ? "Communication" : src === "calendar" ? "Communication" : "Email",
      titles: `${n.resource}`, seconds: src === "calendar" ? 1800 : src === "teams" ? 120 : 180, count: 1, project: "" };
  });
  if (items.length > 0) await writeTimeLogs(today, items, "office365-rt");
  res.status(202).send();
});

// ==================== 2. DROPBOX ====================

exports.syncDropbox = functions.pubsub.schedule("every 3 hours").timeZone("America/Los_Angeles").onRun(async () => {
  try {
    const doc = await db.collection("admin").doc("dropbox").get();
    if (!doc.exists) { console.log("Dropbox not configured"); return null; }
    const config = doc.data();
    const fetch = (await import("node-fetch")).default;

    // Refresh token
    let token = config.accessToken;
    if (config.refreshToken) {
      try {
        const tokenRes = await fetch("https://api.dropboxapi.com/oauth2/token", {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: config.refreshToken,
            client_id: config.appKey, client_secret: config.appSecret })
        });
        const td = await tokenRes.json();
        if (td.access_token) token = td.access_token;
      } catch (e) {}
    }
    if (!token) { console.error("No Dropbox token"); return null; }

    const today = new Date().toISOString().slice(0, 10);

    // List recently modified files
    const listRes = await fetch("https://api.dropboxapi.com/2/files/search_v2", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: "*", options: { max_results: 50, order_by: { ".tag": "last_modified_time" },
        file_status: { ".tag": "active" } } })
    });

    let matches = [];
    try { matches = ((await listRes.json()).matches || []).map(m => m.metadata?.metadata || m.metadata); } catch (e) {}

    const fileGroups = {};
    matches.forEach(file => {
      if (!file || !file.server_modified) return;
      if (file.server_modified.slice(0, 10) !== today) return;

      const name = file.name || "";
      const path = file.path_display || "";
      const ext = name.split(".").pop().toLowerCase();

      let app = "Dropbox", cat = "File Management";
      if (["skp","skb"].includes(ext)) { app = "SketchUp (Dropbox)"; cat = "3D Design"; }
      else if (["pptx","ppt"].includes(ext)) { app = "PowerPoint (Dropbox)"; cat = "Presentation"; }
      else if (["docx","doc"].includes(ext)) { app = "Word (Dropbox)"; cat = "Documentation"; }
      else if (["xlsx","xls","csv"].includes(ext)) { app = "Excel (Dropbox)"; cat = "Spreadsheet"; }
      else if (["pdf"].includes(ext)) { app = "PDF (Dropbox)"; cat = "PDF Review"; }
      else if (["png","jpg","jpeg","tiff","psd","ai"].includes(ext)) { app = "Image (Dropbox)"; cat = "Design"; }

      const key = app;
      if (!fileGroups[key]) fileGroups[key] = { app, category: cat, titles: [], count: 0, projects: new Set() };
      fileGroups[key].titles.push(name);
      fileGroups[key].count++;
      const proj = matchProject(name + " " + path);
      if (proj) fileGroups[key].projects.add(proj);
    });

    const items = Object.values(fileGroups).map(g => ({
      app: g.app, category: g.category, titles: g.titles.slice(0, 5).join(" | "),
      seconds: g.count * 600, count: g.count, project: g.projects.size > 0 ? [...g.projects][0] : ""
    }));

    if (items.length > 0) {
      await writeTimeLogs(today, items, "dropbox");
      console.log(`Dropbox sync: ${items.length} file groups`);
    }
  } catch (err) { console.error("Dropbox sync error:", err); }
  return null;
});

// ==================== TWILIO + CLIPPER ====================

exports.sendClientText = functions.https.onCall(async (data) => {
  const { to, body, projectId } = data;
  const doc = await db.collection("admin").doc("twilio").get();
  if (!doc.exists) throw new functions.https.HttpsError("failed-precondition", "Twilio not configured");
  const config = doc.data();
  const twilio = require("twilio")(config.sid, config.token);
  const msg = await twilio.messages.create({ body, from: config.number, to });
  if (projectId) {
    await db.collection("boards").doc(projectId).collection("activity").add({
      type: "sms", text: `SMS to ${to}: ${body.substring(0, 60)}...`, timestamp: new Date(), icon: "📱"
    });
  }
  return { sid: msg.sid, status: msg.status };
});

exports.twilioWebhook = functions.https.onRequest(async (req, res) => {
  const from = req.body.From, body = req.body.Body;
  const today = new Date().toISOString().slice(0, 10);
  await db.collection("activity").add({ type: "sms-inbound", text: `SMS from ${from}: ${body}`,
    from, createdAt: new Date().toISOString(), icon: "📲" });
  await writeTimeLogs(today, [{ app: "SMS", category: "Communication",
    titles: `Text from ${from}: ${(body || "").substring(0, 60)}`, seconds: 120, count: 1, project: matchProject(body) }], "twilio");
  res.type("text/xml").send("<Response></Response>");
});

exports.logClipperSave = functions.https.onCall(async (data) => {
  const { projectId, productName, imageUrl, vendor, price, category } = data;
  if (!projectId) throw new functions.https.HttpsError("invalid-argument", "projectId required");
  await db.collection("boards").doc(projectId).collection("activity").add({
    type: "clip", text: `Clipped: ${productName || "product"} from ${vendor || "web"}`,
    imageUrl, price, category, timestamp: new Date(), icon: "📌"
  });
  return { success: true };
});
