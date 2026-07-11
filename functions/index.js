/** Gen2 Cloud Functions (matches production deploy — Gen1 manifest caused "Cannot set CPU" errors). */
const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWritten, onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

/** Normalize Timely / Studio project label for board matching (mirrors client `_normProjectLabelForBoard`). */
function normTimelyProjectName(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/[\u2013\u2014]/g, "-");
}
function slugTimelyProjectName(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

/** Load all boards once; used by Timely sync/webhook to set `projectId` (CCH board id) on `timelyEntries`. */
async function loadBoardsLookupForTimely() {
  const snap = await db.collection("boards").get();
  const boardsArr = [];
  snap.forEach((d) => {
    const id = String(d.id || "").trim();
    if (!id) return;
    const bd = d.data() || {};
    const nm = String(bd.name || bd.title || "").trim();
    boardsArr.push({ id, nameNorm: normTimelyProjectName(nm) });
  });
  return boardsArr;
}

/** Resolve CCH Firestore board id from Timely project name (best-effort; returns "" if ambiguous). */
function resolveCchBoardIdFromBoardsArray(boardsArr, projectName) {
  const want = normTimelyProjectName(projectName);
  if (!want) return "";
  const wantSlug = slugTimelyProjectName(projectName);
  const nameExact = boardsArr.filter((b) => b.nameNorm === want);
  if (nameExact.length === 1) return nameExact[0].id;
  const slugHit = boardsArr.filter((b) => b.id.toLowerCase() === wantSlug);
  if (slugHit.length === 1) return slugHit[0].id;
  if (want.length >= 8) {
    const fuzzy = boardsArr.filter(
      (b) => b.nameNorm && (b.nameNorm.includes(want) || want.includes(b.nameNorm))
    );
    if (fuzzy.length === 1) return fuzzy[0].id;
  }
  if (want.length >= 4 && want.length < 8) {
    const fuzzyShort = boardsArr.filter((b) => b.nameNorm && b.nameNorm.includes(want));
    if (fuzzyShort.length === 1) return fuzzyShort[0].id;
  }
  const projLow = String(projectName || "").trim().toLowerCase();
  for (let i = 0; i < boardsArr.length; i++) {
    if (boardsArr[i].id.toLowerCase() === projLow) return boardsArr[i].id;
  }
  return "";
}

let _timelyBoardsLookupCache = null;
let _timelyBoardsLookupCacheAt = 0;
const TIMELY_BOARDS_CACHE_MS = 5 * 60 * 1000;

async function getBoardsLookupForTimelyCached() {
  const now = Date.now();
  if (_timelyBoardsLookupCache && now - _timelyBoardsLookupCacheAt < TIMELY_BOARDS_CACHE_MS) {
    return _timelyBoardsLookupCache;
  }
  _timelyBoardsLookupCache = await loadBoardsLookupForTimely();
  _timelyBoardsLookupCacheAt = now;
  return _timelyBoardsLookupCache;
}

const TIMELY_CLIENT_ID = "X0t2mXABI8R81qN8PDzX1iSAfMybb6cdpzfUT1Z1Otc";
const TIMELY_CLIENT_SECRET = "f71829f106a93ce3e692b7f392d457a6d95bec579932095fa368430a16b884ca";
const TIMELY_REDIRECT_URI = "https://cch-platform.web.app";
const TIMELY_ACCOUNT_ID = "874495";

const REGION = "us-central1";
const CORS_STUDIO = "https://cch-platform.web.app";
const HTTP_STUDIO = { region: REGION, cors: CORS_STUDIO, invoker: "public" };
const CALLABLE_PUBLIC = { region: REGION, invoker: "public" };

exports.healthCheck = onCall(CALLABLE_PUBLIC, (request) => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

const STUDIO_CALLABLE = { region: REGION, invoker: "public", timeoutSeconds: 60, memory: "256MiB" };

function assertStudioUser(request) {
  if (!request || !request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to CCH Studio first.");
  }
}

function guessImageMimeFromUrl(url) {
  const u = String(url || "").toLowerCase().split("?")[0];
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".webp")) return "image/webp";
  if (u.endsWith(".gif")) return "image/gif";
  if (u.endsWith(".svg")) return "image/svg+xml";
  return "image/jpeg";
}

function assertRemoteImageUrlAllowed(url) {
  const raw = String(url || "").trim();
  if (!/^https?:\/\//i.test(raw)) {
    throw new HttpsError("invalid-argument", "imageUrl must be http(s)");
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (e) {
    throw new HttpsError("invalid-argument", "imageUrl is not a valid URL");
  }
  const host = String(parsed.hostname || "").toLowerCase();
  if (!host || host === "localhost" || host.endsWith(".local")) {
    throw new HttpsError("invalid-argument", "URL host not allowed");
  }
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)) {
    throw new HttpsError("invalid-argument", "URL host not allowed");
  }
  return raw;
}

function sniffImageMime(buf) {
  if (!buf || buf.length < 12) return "";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("utf8", 0, 5).trim().startsWith("<svg")) return "image/svg+xml";
  return "";
}

function resolveMaybeRelativeUrl(raw, baseUrl) {
  let u = String(raw || "").trim();
  if (!u) return "";
  if (u.startsWith("//")) u = "https:" + u;
  else if (u.startsWith("/")) {
    try {
      u = new URL(u, baseUrl).href;
    } catch (e) {
      return "";
    }
  }
  return u;
}

function extractImageCandidateFromHtml(html, baseUrl) {
  const text = String(html || "");
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const abs = resolveMaybeRelativeUrl(m[1], baseUrl);
      if (abs) return abs;
    }
  }
  const imgMatch = text.match(/<img[^>]+(?:data-src|data-lazy-src|src)=["']([^"']+\.(?:jpe?g|png|webp|gif)[^"']*)["']/i);
  if (imgMatch && imgMatch[1]) {
    const abs = resolveMaybeRelativeUrl(imgMatch[1], baseUrl);
    if (abs) return abs;
  }
  return "";
}

async function fetchRemoteImageBuffer(url, depth) {
  depth = depth || 0;
  url = assertRemoteImageUrlAllowed(url);
  let origin = "";
  try {
    origin = new URL(url).origin + "/";
  } catch (e) {
    origin = "";
  }
  const resp = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      Referer: origin,
      "Accept-Language": "en-US,en;q=0.9"
    },
    redirect: "follow"
  });
  if (!resp.ok) {
    throw new HttpsError("failed-precondition", "Could not fetch image (HTTP " + resp.status + ")");
  }
  const ct = String(resp.headers.get("content-type") || "").toLowerCase();
  const buf = Buffer.from(await resp.arrayBuffer());
  if (buf.length < 32) {
    throw new HttpsError("invalid-argument", "Image empty or too small");
  }
  if (buf.length > 12 * 1024 * 1024) {
    throw new HttpsError("invalid-argument", "Image too large (max 12MB)");
  }
  const sniffed = sniffImageMime(buf);
  if (sniffed) {
    return { buf, mime: sniffed };
  }
  if ((ct.includes("text/html") || ct.includes("application/xhtml")) && depth < 2) {
    const html = buf.toString("utf8");
    const candidate = extractImageCandidateFromHtml(html, url);
    if (candidate && candidate !== url) {
      return fetchRemoteImageBuffer(candidate, depth + 1);
    }
    throw new HttpsError(
      "invalid-argument",
      "That looks like a product page link, not a direct image. Right-click the photo and choose Copy image address."
    );
  }
  if (ct && !ct.startsWith("image/") && !ct.includes("octet-stream") && !ct.includes("svg")) {
    throw new HttpsError(
      "invalid-argument",
      "URL did not return an image (got " + (ct.split(";")[0] || "unknown") + ")"
    );
  }
  const mime = ct.startsWith("image/") ? ct.split(";")[0].trim() : guessImageMimeFromUrl(url);
  return { buf, mime };
}

/** Server-side fetch for vendor image URLs (browser CORS blocks alfresco etc.). */
exports.importDesignBoardImageFromUrl = onCall(STUDIO_CALLABLE, async (request) => {
  assertStudioUser(request);
  const data = request.data || {};
  const projectId = String(data.projectId || "").trim();
  const boardId = String(data.boardId || "").trim();
  const imageUrl = String(data.imageUrl || "").trim();
  if (!projectId || !boardId || !imageUrl) {
    throw new HttpsError("invalid-argument", "projectId, boardId, and imageUrl are required");
  }
  const { buf, mime } = await fetchRemoteImageBuffer(imageUrl);
  let ext = "jpeg";
  if (mime.indexOf("png") >= 0) ext = "png";
  else if (mime.indexOf("webp") >= 0) ext = "webp";
  else if (mime.indexOf("gif") >= 0) ext = "gif";
  else if (mime.indexOf("svg") >= 0) ext = "svg";
  const ts = Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  const path = "projects/" + projectId + "/designboards/" + boardId + "/" + ts + "." + ext;
  const bucket = admin.storage().bucket();
  const token = require("crypto").randomUUID();
  const file = bucket.file(path);
  await file.save(buf, {
    metadata: {
      contentType: mime,
      metadata: { firebaseStorageDownloadTokens: token }
    }
  });
  const encoded = encodeURIComponent(path);
  const downloadUrl =
    "https://firebasestorage.googleapis.com/v0/b/" + bucket.name + "/o/" + encoded + "?alt=media&token=" + token;
  return { downloadUrl, path, contentType: mime };
});

// Exchange Timely OAuth code for access token
exports.timelyAuth = onRequest(HTTP_STUDIO, async (req, res) => {
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

/** Refresh Timely OAuth access token (stored on settings/timely). */
async function refreshTimelyAccessToken(fetch, refreshToken) {
  const resp = await fetch("https://api.timelyapp.com/1.1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: TIMELY_CLIENT_ID,
      client_secret: TIMELY_CLIENT_SECRET,
      refresh_token: refreshToken
    }).toString()
  });
  const data = await resp.json();
  if (!resp.ok || data.error || !data.access_token) {
    throw new Error(data.error_description || data.error || "Timely token refresh failed");
  }
  await db.collection("settings").doc("timely").set({
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in,
    tokenType: data.token_type,
    refreshedAt: new Date().toISOString()
  }, { merge: true });
  return data.access_token;
}

/** Paginate Timely /events — default API page size is small; without this, only the first page syncs. */
async function fetchAllTimelyEvents(fetch, accountId, accessToken, startDate, endDate) {
  const perPage = 1000;
  let page = 1;
  const all = [];
  for (;;) {
    const url = `https://api.timelyapp.com/1.1/${accountId}/events?since=${encodeURIComponent(startDate)}&upto=${encodeURIComponent(endDate)}&page=${page}&per_page=${perPage}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (resp.status === 401) {
      const err = new Error("Token expired");
      err.status = 401;
      throw err;
    }
    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Timely API ${resp.status}: ${body.slice(0, 300)}`);
    }
    const batch = await resp.json();
    const rows = Array.isArray(batch) ? batch : (batch && Array.isArray(batch.events) ? batch.events : []);
    if (!rows.length) break;
    all.push(...rows);
    if (rows.length < perPage) break;
    page++;
    if (page > 50) {
      console.warn("[Timely Sync] Stopped after 50 pages (" + all.length + " events)");
      break;
    }
  }
  return all;
}

// Pull time entries from Timely API
exports.timelySyncEntries = onRequest(HTTP_STUDIO, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "https://cch-platform.web.app");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    const tokenDoc = await db.collection("settings").doc("timely").get();
    if (!tokenDoc.exists) return res.status(400).json({ error: "Timely not connected" });
    const tokenData = tokenDoc.data();
    let accessToken = tokenData.accessToken;
    const accountId = tokenData.accountId || TIMELY_ACCOUNT_ID;
    const refreshToken = tokenData.refreshToken;

    const startDate = req.body.startDate || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const endDate = req.body.endDate || new Date().toISOString().slice(0, 10);

    const fetch = (await import("node-fetch")).default;
    let entries;
    try {
      entries = await fetchAllTimelyEvents(fetch, accountId, accessToken, startDate, endDate);
    } catch (syncErr) {
      if (syncErr.status === 401 && refreshToken) {
        accessToken = await refreshTimelyAccessToken(fetch, refreshToken);
        entries = await fetchAllTimelyEvents(fetch, accountId, accessToken, startDate, endDate);
      } else if (syncErr.status === 401) {
        return res.status(401).json({ error: "Token expired — reconnect Timely in Settings" });
      } else {
        throw syncErr;
      }
    }

    const boardsArr = await loadBoardsLookupForTimely();

    let saved = 0;
    for (const entry of entries) {
      if (!entry || entry.id == null) continue;
      const docId = "timely-" + entry.id;
      const dur = entry.duration || {};
      const durSecs = parseFloat(dur.total_seconds) || 0;
      const hoursVal = parseFloat(dur.total_hours) || (durSecs / 3600) || (parseFloat(dur.total_minutes) / 60) || 0;
      const projectName = entry.project ? entry.project.name : "";
      const cchProjectId = resolveCchBoardIdFromBoardsArray(boardsArr, projectName);
      const row = {
        source: "timely-api",
        timelyId: entry.id,
        date: entry.day || "",
        hours: hoursVal,
        minutes: Math.round(durSecs / 60),
        note: entry.note || "",
        project: projectName,
        timelyProjectId: entry.project_id || "",
        member: entry.user ? entry.user.name : "",
        timelyUserId: entry.user_id || "",
        billed: entry.billed || false,
        label: entry.label_ids || [],
        createdAt: entry.created_at || "",
        updatedAt: entry.updated_at || "",
        raw: entry
      };
      if (cchProjectId) row.projectId = cchProjectId;
      await db.collection("timelyEntries").doc(docId).set(row, { merge: true });
      saved++;
    }

    const monthPrefix = endDate.slice(0, 7);
    const currentMonthFetched = entries.filter((e) => String(e.day || "").startsWith(monthPrefix)).length;
    return res.status(200).json({
      status: "ok",
      fetched: entries.length,
      saved,
      startDate,
      endDate,
      currentMonth: monthPrefix,
      currentMonthFetched
    });
  } catch (err) {
    console.error("[Timely Sync] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Timely webhook — receives hours:created, hours:updated events
exports.timelyWebhook = onRequest(HTTP_STUDIO, async (req, res) => {
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
    const timelyApiProjectId = entry.project_id || "";
    const projectName = (entry.project && entry.project.name) || "";
    const userId = entry.user_id || "";
    const userName = (entry.user && entry.user.name) || "";
    const billed = entry.billed || false;

    const boardsArr = await getBoardsLookupForTimelyCached();
    const cchProjectId = resolveCchBoardIdFromBoardsArray(boardsArr, projectName);

    // Write to Firestore — desktopTimeLogs style for Smart Time compatibility
    const docId = date + "-timely-" + timelyId;
    const whRow = {
      source: "timely-webhook",
      timelyId: timelyId,
      date: date,
      hours: duration,
      duration: duration,
      durationMinutes: durationMin,
      note: note,
      project: projectName,
      timelyProjectId: timelyApiProjectId,
      member: userName,
      timelyUserId: userId,
      billed: billed,
      event: event,
      receivedAt: new Date().toISOString(),
      raw: entry
    };
    if (cchProjectId) whRow.projectId = cchProjectId;
    await db.collection("timelyEntries").doc(docId).set(whRow, { merge: true });

    console.log("[Timely Webhook] Saved:", docId, projectName, durationMin + "min");
    return res.status(200).json({ status: "ok", docId: docId });

  } catch (err) {
    console.error("[Timely Webhook] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
// QUICKBOOKS INTEGRATION
// ══════════════════════════════════════════════════════════

// QuickBooks credentials are loaded from Firebase Functions secrets.
const QB_CLIENT_ID = process.env.QB_CLIENT_ID || "";
const QB_CLIENT_SECRET = process.env.QB_CLIENT_SECRET || "";
const QB_REALM_ID = "1389735275";
// Sandbox (only if qbauth.html uses sandbox client id instead):
// const QB_CLIENT_ID = "ABIdgpUOB12gSW5FUrfixcQRQXtLNlRr4SXf0kkpxUSpe35qFR";
// const QB_CLIENT_SECRET = "AWNiPZvn8eFOLeiAhBtXZlUWRwPWulAZpSpiAAEc";
// const QB_REALM_ID = "9341456810119653";

// Studio account IDs in QB (Production)
const QB_ACCOUNTS = {
  R1: "380", // R1 - Studio Product Sales
  R2: "381", // R2 - Studio Design Fees
  R3: "382", // R3 - Studio Shipping
  R4: "383", // R4 - Studio Prepaid Tax
  R5: "384", // R5 - Studio Reimbursable
  C1: "385", // C1 - Studio Product Cost
  C2: "386", // C2 - Studio Freight/Shipping
  C3: "387", // C3 - Studio Sales Tax Paid
  C4: "388", // C4 - Studio Subcontractors
  C5: "389", // C5 - Studio Samples
  C6: "261"  // C - Cost of Labor (native QB; used by item Labor 7554)
};

/** QuickBooks service/non-inventory item IDs for Studio push (production realm). */
const QB_ITEM_IDS = {
  product: "7718",
  designFee: "7719",
  shipping: "7720",
  tax: "7721",
  reimbursable: "7722",
  subcontractor: "7723",
  sample: "7724",
  /** Item "Travel & Expenses" — E - Travel Expense; T&E time-billing lines (not Studio Reimbursable). */
  travelExpense: "1083",
  /** Item "Labor" — ExpenseAccountRef C - Cost of Labor (261). Trade/install labor, not C4 Subcontractors. */
  labor: "7554"
};

function qbLaborItemRef() {
  return { value: QB_ITEM_IDS.labor, name: "Labor" };
}

/** Windows, upholstery, wallpaper install, and category Labor → C - Cost of Labor (not Subcontractors). */
function qbStudioLineLooksLikeLabor(item) {
  const et = String(item.expenseType || item.itemType || "").toLowerCase();
  if (et === "labor") return true;
  const cat = String(item.category || item.type || "").toLowerCase();
  if (/\blabor\b/.test(cat)) return true;
  const title = String(item.title || item.name || "").toLowerCase();
  if (/\b(install(?:ation)?|wall\s*paper\s*install|wall\s*covering\s*install|upholster|window\s*treat|window\s*install)\b/.test(title)) {
    return true;
  }
  const blob = [title, String(item.description || "").slice(0, 160).toLowerCase()].join(" ");
  if (/\b(install(?:ation)?|wall\s*paper\s*install|wall\s*covering\s*install|upholster|window\s*treat)\b/.test(blob)) {
    return true;
  }
  return false;
}

/** True vendor subcontractor lines only — not trade labor / installation. */
function qbStudioLineLooksLikeSubcontractor(item) {
  if (qbStudioLineLooksLikeLabor(item)) return false;
  const blob = [
    item.category,
    item.type,
    item.title,
    item.name,
    item.description
  ]
    .map((s) => String(s || "").toLowerCase())
    .join(" ");
  return /\bsubcontractor\b/.test(blob);
}

function qbDesignFeeItemRef() {
  return { value: QB_ITEM_IDS.designFee, name: "Studio Design Fee" };
}

function qbProductItemRef() {
  return { value: QB_ITEM_IDS.product, name: "Studio Product" };
}

function qbTravelExpenseItemRef() {
  return { value: QB_ITEM_IDS.travelExpense, name: "Travel & Expenses" };
}

/** T&E / travel time-billing — Travel & Expenses (1083), not Studio Reimbursable. */
function qbStudioLineLooksLikeTravelExpense(item) {
  const cat = qbStudioLineCategoryFields(item);
  const title = String(item.title || item.name || "").toLowerCase();
  const head = cat + " " + title;
  if (/\bt&\s*e\b/.test(head)) return true;
  if (/\btravel\b/.test(head) && /\b(expense|entertainment|mileage|pick\s*up|delivery|site\s+visit)\b/.test(head)) {
    return true;
  }
  return false;
}

/** Category/service fields only (not description marketing copy). */
function qbStudioLineCategoryFields(item) {
  return [
    item.category,
    item.qbCategory,
    item.qbLineCategory,
    item.qbAccount,
    item.type,
    item.billingCategory,
    item.service
  ]
    .map((s) => String(s || "").toLowerCase())
    .join(" ");
}

/**
 * R2 — Studio Design Fees. Authoritative category rules (must run before product heuristics).
 * Design Service(s), Design Fee, Studio Design, Project Management → never Product Sales.
 */
function qbStudioLineIsDesignServiceCategory(item) {
  if (qbStudioLineLooksLikeTravelExpense(item)) return false;
  const cat = qbStudioLineCategoryFields(item);
  if (/design\s+services?|design\s+fee|studio\s+design|project\s+manag/.test(cat)) return true;
  const title = String(item.title || item.name || "").toLowerCase();
  if (/^cch\s+(design|client\s+project|project\s+manag|blended\s+design|admin)/.test(title)) return true;
  if (/\bcch\s+design\b/.test(cat) || /\bclient\s+project\s+support\b/.test(cat)) return true;
  const et = String(item.expenseType || item.itemType || "").toLowerCase();
  if (et === "service") {
    if (/design|project\s+manag|client\s+project|time\s+billing|professional\s+service|consultation|hourly/.test(cat + " " + title)) {
      return true;
    }
  }
  return false;
}

/** R1 — Studio Product Sales. Explicit merchandise categories only. */
function qbStudioLineIsProductSalesCategory(item) {
  const cat = qbStudioLineCategoryFields(item);
  return /\b(product|furniture|lighting|hardware|accessor|inventory)\b/.test(cat);
}

/** Physical furnishings — never Studio Design Fee (ignore "designed" in marketing copy). */
function qbStudioLineLooksLikeProduct(item) {
  if (qbStudioLineIsDesignServiceCategory(item)) return false;
  const et = String(item.expenseType || item.itemType || "").toLowerCase();
  if (et === "service") return false;
  if (et === "product" || et === "sample") return true;
  if (qbStudioLineIsProductSalesCategory(item)) return true;
  const title = String(item.title || item.name || "").toLowerCase();
  const cat = String(item.category || "").toLowerCase();
  const cost = parseFloat(item.cost) || 0;
  const mkup = parseFloat(item.markupPct) || 0;
  if (/\b(bowl|vase|tray|riser|cutting\s+board|display\s+stand|sconce|lantern|chandelier|pendant|picture\s+light|flush\s*mount|semi[- ]?flush|bracketed|homeware|organizer)\b/.test(title)) {
    return true;
  }
  if (/accessor|lighting|furniture|mirror|rug|tile|fabric|bedding|art|wallpaper|homeware|kitchen|furnish/.test(cat) && cost > 0) {
    return true;
  }
  if (cost > 0 && mkup > 0.25) return true;
  return false;
}

/**
 * Single QB ItemRef picker for invoice push, PO push, and vendor bills.
 * Design services → 7719 (R2). Merchandise → 7718 (R1). Labor → 7554 (C - Cost of Labor).
 */
function qbItemRefForStudioLine(item) {
  if (!item) return qbProductItemRef();
  const et = String(item.expenseType || item.itemType || "").toLowerCase();
  if (et === "discount") {
    return { name: "Discount / Credit" };
  }
  if (et === "retainer_credit") {
    return { name: "Other:misc income retainer payment" };
  }
  if (qbStudioLineLooksLikeLabor(item)) return qbLaborItemRef();
  if (qbStudioLineLooksLikeTravelExpense(item)) return qbTravelExpenseItemRef();

  const catHead = qbStudioLineCategoryFields(item);
  if (/\b(shipping|freight|delivery)\b/.test(catHead)) {
    return { value: QB_ITEM_IDS.shipping, name: "Studio Shipping" };
  }
  if (/\btax\b/.test(catHead)) {
    return { value: QB_ITEM_IDS.tax, name: "Studio Prepaid Tax" };
  }
  if (/\bsample\b/.test(catHead)) {
    return { value: QB_ITEM_IDS.sample, name: "Studio Sample" };
  }

  if (qbStudioLineIsDesignServiceCategory(item)) return qbDesignFeeItemRef();
  if (qbStudioLineIsProductSalesCategory(item)) return qbProductItemRef();
  if (qbStudioLineLooksLikeProduct(item)) return qbProductItemRef();

  const title = String(item.title || item.name || "").toLowerCase();
  if (/\breimburse/.test(catHead + " " + title)) {
    return { value: QB_ITEM_IDS.reimbursable, name: "Studio Reimbursable" };
  }
  if (qbStudioLineLooksLikeSubcontractor(item)) {
    return { value: QB_ITEM_IDS.subcontractor, name: "Studio Subcontractor" };
  }

  if (et === "service") return qbDesignFeeItemRef();

  return qbProductItemRef();
}

/** PO / vendor bill — same mapping as invoice push. */
function qbItemRefForStudioExpenseLine(item) {
  return qbItemRefForStudioLine(item);
}

const QBConfig = () => ({
  clientId: QB_CLIENT_ID,
  clientSecret: QB_CLIENT_SECRET,
  realmId: QB_REALM_ID,
  apiBase: "https://quickbooks.api.intuit.com"
});

/** Allowed redirect_uri values passed to Intuit OAuth (must match developer portal exactly). */
const QB_OAUTH_REDIRECTS = new Set([
  "https://cch-platform.web.app/qbauth.html",
  "https://cch-platform.web.app"
]);

const QB_REDIRECT_URI_DEFAULT = "https://cch-platform.web.app/qbauth.html";
const QB_SECRET_NAMES = ["QB_CLIENT_ID", "QB_CLIENT_SECRET"];
const QB_HTTP = { region: REGION, cors: CORS_STUDIO, secrets: QB_SECRET_NAMES, invoker: "public" };
const QB_CALLABLE = { region: REGION, secrets: QB_SECRET_NAMES, invoker: "public" };
const QB_BATCH_CALLABLE = { ...QB_CALLABLE, timeoutSeconds: 300, memory: "512MiB" };
const TIMELY_BACKFILL_CALLABLE = { region: REGION, timeoutSeconds: 540, memory: "512MiB" };

function ensureQbSecrets() {
  if (!QB_CLIENT_ID || !QB_CLIENT_SECRET) {
    throw new HttpsError(
      "failed-precondition",
      "QuickBooks secrets missing. Set QB_CLIENT_ID and QB_CLIENT_SECRET in Firebase Functions secrets."
    );
  }
}

// ─── QB OAUTH: Start authorization flow ─────────────────────────
exports.qbAuthStart = onRequest(QB_HTTP, async (req, res) => {
  ensureQbSecrets();
  const state = Math.random().toString(36).substring(2, 15);
  await db.collection("admin").doc("qb_oauth_state").set({ state, createdAt: new Date().toISOString() });

  const authUrl = "https://appcenter.intuit.com/connect/oauth2?" + new URLSearchParams({
    client_id: QB_CLIENT_ID,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: QB_REDIRECT_URI_DEFAULT,
    state: state
  }).toString();

  res.redirect(authUrl);
});

// ─── QB OAUTH: Exchange code for tokens (callable from frontend) ──
exports.qbAuthCallback = onCall(QB_CALLABLE, async (request) => {
  assertQbAdmin(request);
  ensureQbSecrets();

  const { code, realmId, redirectUri } = request.data || {};
  if (!code) throw new HttpsError("invalid-argument", "Authorization code required");

  const redirect = (redirectUri && QB_OAUTH_REDIRECTS.has(String(redirectUri).trim()))
    ? String(redirectUri).trim()
    : QB_REDIRECT_URI_DEFAULT;

  const fetch = (await import("node-fetch")).default;
  const basicAuth = Buffer.from(QB_CLIENT_ID + ":" + QB_CLIENT_SECRET).toString("base64");

  const tokenRes = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + basicAuth
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirect
    }).toString()
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new HttpsError("internal", "Token exchange failed: " + err);
  }

  const tokens = await tokenRes.json();

  await db.collection("admin").doc("qb").set({
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    realmId: realmId || QB_REALM_ID,
    connectedAt: new Date().toISOString(),
    tokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return { success: true, realmId: realmId || QB_REALM_ID };
  }
);

// ─── TOKEN MANAGEMENT ────────────────────────────────────────────
async function getQBAccessToken() {
  ensureQbSecrets();
  const qbDoc = await db.collection("admin").doc("qb").get();
  const config = qbDoc.data();
  if (!config || !config.refreshToken) {
    throw new HttpsError("failed-precondition",
      "QuickBooks not connected. Add refreshToken to Firestore admin/qb document.");
  }

  const basicAuth = Buffer.from(QB_CLIENT_ID + ":" + QB_CLIENT_SECRET).toString("base64");
  const fetch = (await import("node-fetch")).default;

  const res = await fetch("https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": "Basic " + basicAuth
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: config.refreshToken
    }).toString()
  });

  if (!res.ok) {
    const err = await res.text();
    const hint = /invalid_grant|Incorrect Token type or clientID/i.test(err)
      ? " Reconnect at https://cch-platform.web.app/qbauth.html (Connect to QuickBooks) so admin/qb gets a new refresh token for the current QB_CLIENT_ID secret."
      : "";
    throw new HttpsError("failed-precondition", "Token refresh failed: " + err + hint);
  }

  const tokens = await res.json();

  // Save the new refresh token (they rotate)
  await db.collection("admin").doc("qb").update({
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    tokenUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { accessToken: tokens.access_token, realmId: config.realmId || QB_REALM_ID };
}

/** Billing admins: verify OAuth refresh works (same path as Sync QB paid). */
exports.qbConnectionStatus = onCall(QB_CALLABLE, async (request) => {
  assertQbAdmin(request);
  try {
    const { realmId } = await getQBAccessToken();
    const qbDoc = await db.collection("admin").doc("qb").get();
    const config = qbDoc.data() || {};
    return {
      ok: true,
      realmId: realmId || config.realmId || QB_REALM_ID,
      tokenUpdatedAt: config.tokenUpdatedAt || null,
      connectedAt: config.connectedAt || null
    };
  } catch (err) {
    const msg = err && err.message ? String(err.message) : String(err);
    return { ok: false, message: msg };
  }
});

function clipSourceIsClipper(data) {
  const s = String((data && data.source) || "").toLowerCase();
  return s.includes("clipper") || s === "cch-studio-clipper";
}

/** Process 1: clipper → products/ first, then clip carries libraryProductId (selections use same id). */
async function createLibraryProductFromClipServer(projectId, item) {
  const pack = { imageUrl: item.imageUrl || item.image || "", images: Array.isArray(item.images) ? item.images : [] };
  const imgs = pack.images.length ? pack.images.slice() : (pack.imageUrl ? [String(pack.imageUrl)] : []);
  const heroIdx = Math.max(0, Math.min(parseInt(item.heroImageIndex, 10) || 0, Math.max(0, imgs.length - 1)));
  const imageUrl = imgs[heroIdx] || imgs[0] || pack.imageUrl || "";
  const qty = parseFloat(item.qty) || 1;
  let cost = parseFloat(item.cost || item.unitCost || item.costPrice) || 0;
  if (!cost && item.totalCost) cost = parseFloat(item.totalCost) / qty;
  let price = parseFloat(item.clientPrice || item.sellPrice || item.price) || 0;
  let defMk = 30;
  try {
    const ps = await db.collection("boards").doc(projectId).get();
    if (ps.exists) {
      const x = parseFloat(ps.data().defaultProductMarkupPct);
      if (!isNaN(x)) defMk = x;
    }
  } catch (_eMk) { /* ignore */ }
  let boardName = null;
  try {
    const bs = await db.collection("boards").doc(projectId).get();
    if (bs.exists) boardName = String(bs.data().name || "").trim() || null;
  } catch (_eBn) { /* ignore */ }
  const nowIso = new Date().toISOString();
  const srcLabel = item.source || "cch-studio-clipper";
  const data = {
    title: String(item.title || item.name || "Untitled").trim() || "Untitled",
    vendor: String(item.vendor || item.manufacturer || "").trim(),
    libraryItemKind: "product",
    imageUrl: imageUrl || null,
    projectId,
    project: boardName,
    source: clipSourceIsClipper(srcLabel) ? "cch-studio-clipper" : srcLabel,
    updatedAt: nowIso,
    createdAt: nowIso,
    productLifecycle: "active"
  };
  if (imgs.length) data.images = imgs;
  if (item.category) data.category = String(item.category).trim();
  if (item.room) data.room = String(item.room).trim();
  if (item.sku) data.sku = String(item.sku).trim();
  if (cost > 0) data.costPrice = cost;
  if (price > 0) data.sellPrice = price;
  const vu = String(item.productUrl || item.vendorUrl || item.pageUrl || item.sourceUrl || "").trim();
  if (vu) {
    data.vendorUrl = vu;
    data.productUrl = vu;
    data.pageUrl = vu;
  }
  const notes = String(item.description || item.clientDescription || "").trim();
  if (notes) {
    data.description = notes;
    data.clientDescription = notes;
  }
  const ref = await db.collection("products").add(data);
  try {
    await db.collection("productLibrary").doc(ref.id).set(
      Object.assign({}, data, { unitCost: data.costPrice }),
      { merge: true }
    );
  } catch (_ePl) { /* legacy mirror optional */ }
  return ref.id;
}

exports.onClipCreatedEnsureLibraryProduct = onDocumentCreated(
  { document: "boards/{projectId}/clips/{clipId}", region: REGION },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() || {};
    if (String(data.libraryProductId || data.linkedLibraryProductId || "").trim()) return;
    if (!clipSourceIsClipper(data)) return;
    const { projectId, clipId } = event.params;
    try {
      const libId = await createLibraryProductFromClipServer(projectId, data);
      await snap.ref.update({
        libraryProductId: libId,
        updatedAt: new Date().toISOString()
      });
      console.log("[onClipCreatedEnsureLibraryProduct]", projectId, clipId, libId);
    } catch (err) {
      console.error("[onClipCreatedEnsureLibraryProduct]", projectId, clipId, err.message || err);
    }
  }
);

// ─── QB API HELPER ───────────────────────────────────────────────
async function qbApiCall(method, endpoint, accessToken, realmId, body) {
  const { apiBase } = QBConfig();
  const url = `${apiBase}/v3/company/${realmId}/${endpoint}`;
  const fetch = (await import("node-fetch")).default;

  const options = {
    method,
    headers: {
      "Authorization": "Bearer " + accessToken,
      "Content-Type": "application/json",
      "Accept": "application/json"
    }
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const data = await res.json();

  if (data.Fault) {
    const errMsg = data.Fault.Error ? data.Fault.Error.map(e => e.Message + " (" + e.Detail + ")").join("; ") : "Unknown QB error";
    throw new HttpsError("internal", "QB API Error: " + errMsg);
  }

  return data;
}

// Same billing admins as Firestore rules `isAdmin` + platform ADMIN_EMAILS
const QB_ADMIN_EMAILS = [
  "cindy@cchdesign.com",
  "cynthia@cchdesign.com",
  "cynthiacbh@gmail.com"
];

/** Gen2 https.onCall invokes (request) — auth is on request, payload on request.data (not v1's context). */
function assertQbAdmin(request) {
  if (!request || !request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required");
  }
  const email = (request.auth.token.email || "").toLowerCase();
  if (!QB_ADMIN_EMAILS.includes(email)) {
    throw new HttpsError(
      "permission-denied",
      "Only billing admins can use QuickBooks from CCH Studio."
    );
  }
}

// Invoice / PO push — billing admins + Vanessa (creates docs, pushes per workflow)
const QB_PUSH_EMAILS = QB_ADMIN_EMAILS.concat([
  "vanessa@cchdesign.com",
  "vanessaholliday@cchdesign.com",
  "vholliday@cchdesign.com",
]);

function assertQbPushAllowed(request) {
  if (!request || !request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required");
  }
  const email = (request.auth.token.email || "").toLowerCase();
  if (!QB_PUSH_EMAILS.includes(email)) {
    throw new HttpsError(
      "permission-denied",
      "You are not authorized to push documents to QuickBooks."
    );
  }
}

/** Vendor bill push targets live QuickBooks — never staging Firebase project. */
function assertQbBillPushEnvironment() {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";
  if (projectId === "cch-studio-staging") {
    throw new HttpsError(
      "failed-precondition",
      "QuickBooks bill push is disabled on staging. Receive and edit bills in Studio here; push from production only."
    );
  }
}

/**
 * One-shot / dry-run: set CCH `projectId` on all `timelyEntries` from `project` name (Admin only).
 * Call from Studio signed in as billing admin: httpsCallable with `{ apply: false }` then `{ apply: true }`.
 */
exports.backfillTimelyEntriesProjectId = onCall(TIMELY_BACKFILL_CALLABLE, async (request) => {
    if (!request.auth || !request.auth.token.email) {
      throw new HttpsError("unauthenticated", "Sign in required");
    }
    const email = String(request.auth.token.email).toLowerCase();
    if (!QB_ADMIN_EMAILS.includes(email)) {
      throw new HttpsError("permission-denied", "Billing admin only");
    }
    const apply = !!(request.data && request.data.apply);
    const boardsArr = await loadBoardsLookupForTimely();
    let checked = 0;
    let skippedNoProject = 0;
    let unchanged = 0;
    let toChange = 0;
    let applied = 0;
    let errors = 0;
    const samples = [];
    let lastDoc = null;
    let pageIdx = 0;
    const nowIso = () => new Date().toISOString();
    /* eslint-disable no-await-in-loop */
    while (pageIdx < 2000) {
      pageIdx++;
      let q = db.collection("timelyEntries").orderBy(admin.firestore.FieldPath.documentId()).limit(350);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;
      const pending = [];
      snap.forEach((doc) => {
        const d = doc.data() || {};
        const projectName = String(d.project || "").trim();
        if (!projectName) {
          skippedNoProject++;
          return;
        }
        checked++;
        const cur = String(d.projectId || "").trim();
        const resolved = resolveCchBoardIdFromBoardsArray(boardsArr, projectName);
        if (!resolved || resolved === cur) {
          unchanged++;
          return;
        }
        toChange++;
        if (samples.length < 18) {
          samples.push(`${doc.id}  "${projectName}"  ${cur || "(no id)"}  →  ${resolved}`);
        }
        pending.push({ ref: doc.ref, resolved });
      });
      if (apply && pending.length) {
        for (let pi = 0; pi < pending.length; pi += 400) {
          const slice = pending.slice(pi, pi + 400);
          const batch = db.batch();
          slice.forEach((item) => {
            batch.update(item.ref, { projectId: item.resolved, updatedAt: nowIso() });
          });
          try {
            await batch.commit();
            applied += slice.length;
          } catch (be) {
            console.error("[backfillTimelyEntriesProjectId] batch", be);
            for (const item of slice) {
              try {
                await item.ref.update({ projectId: item.resolved, updatedAt: nowIso() });
                applied++;
              } catch (e1) {
                errors++;
              }
            }
          }
        }
      }
      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < 350) break;
    }
    return {
      ok: true,
      apply,
      checked,
      skippedNoProject,
      unchanged,
      toChange,
      applied,
      errors,
      samples
    };
  });

const QB_PUSH_LOCK_FIELD = "qbPushLockAt";
const QB_PUSH_LOCK_TTL_MS = 3 * 60 * 1000;

/** Serialize concurrent QB pushes so double-clicks do not create duplicate QB docs. */
async function beginQbDocumentPush(docRef) {
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Document not found");
    }
    const d = snap.data();
    if (d.qbDocId) {
      return { alreadySynced: true, qbDocId: d.qbDocId };
    }
    const lockAt = d[QB_PUSH_LOCK_FIELD];
    if (lockAt && typeof lockAt.toMillis === "function") {
      const ageMs = Date.now() - lockAt.toMillis();
      if (ageMs >= 0 && ageMs < QB_PUSH_LOCK_TTL_MS) {
        throw new HttpsError(
          "resource-exhausted",
          "QuickBooks push already in progress for this document. Wait a minute and try again."
        );
      }
    }
    transaction.update(docRef, {
      [QB_PUSH_LOCK_FIELD]: admin.firestore.FieldValue.serverTimestamp()
    });
    return { alreadySynced: false };
  });
}

async function clearQbPushLock(docRef) {
  await docRef.update({
    [QB_PUSH_LOCK_FIELD]: admin.firestore.FieldValue.delete()
  }).catch(() => {});
}

function _httpsErrStatus(code) {
  const m = {
    "invalid-argument": 400,
    "not-found": 404,
    "failed-precondition": 412,
    "resource-exhausted": 429,
    "permission-denied": 403,
    "unauthenticated": 401,
    "internal": 500
  };
  return m[code] || 500;
}

/** Studio line amount for QB push (merchandise; matches invoiceLineAmountForTotals). */
function qbStudioInvoiceLineAmount(item) {
  const qty = Math.max(parseFloat(item.qty || 1) || 1, 0.0001);
  const cost = parseFloat(item.cost) || 0;
  const mkup = parseFloat(item.markupPct) || 0;
  let sell =
    parseFloat(item.amount || item.clientPrice || item.lineTotal || item.total || item.totalSelling || 0) || 0;
  const rate = parseFloat(item.rate || item.unitPrice) || 0;
  if (!sell && rate > 0) sell = Math.round(rate * qty * 100) / 100;
  if (sell < 0) return sell;
  const et = String(item.expenseType || item.itemType || "").toLowerCase();
  if (et === "discount" || et === "retainer_credit") {
    let amt = sell;
    if (!amt) amt = parseFloat(item.cost) || 0;
    if (et === "retainer_credit" && amt > 0) amt = -Math.abs(amt);
    return amt;
  }
  if (cost > 0) return Math.round(cost * qty * (1 + mkup / 100) * 100) / 100;
  return sell || 0;
}

/** CA-style taxable flag for QB TaxCodeRef (TAX / NON). */
function qbStudioInvoiceLineTaxable(item) {
  if (!item) return false;
  const et = String(item.expenseType || item.itemType || "").toLowerCase();
  if (et === "sales_tax" || et === "discount" || et === "retainer_credit") return false;
  const blob = [item.title, item.name, item.category, item.service, item.billingCategory, item.description]
    .map((s) => String(s || "").toLowerCase())
    .join(" ");
  if (/design\s+service|professional\s+service|time\s+billing|smart\s*time|consultation|hourly|project manag/.test(blob)) {
    return false;
  }
  if (/\blabor\b/.test(String(item.category || "").toLowerCase()) || /\b(install(?:ation)?|wall\s*paper\s*install)\b/.test(blob)) {
    return false;
  }
  if (item.taxable === false || item.taxable === "off" || item.taxable === "non-taxable") return false;
  if (item.taxable === true || item.taxable === "on" || item.taxable === "taxable") return true;
  const cat = String(item.category || "").toLowerCase();
  if (/lighting|furniture|fabric|rug|tile|stone|product|appliance|hardware|bedding|mirror|art|wallpaper/.test(cat)) {
    return true;
  }
  if (et === "service") return false;
  return (parseFloat(item.cost) || 0) > 0 || et === "product" || !et;
}

/** Effective client sales-tax rate: invoice rate if > 0, else project rate. (0 on the doc must NOT block the project rate.) */
function qbEffectiveInvoiceTaxRate(invoice, proj) {
  let rate = parseFloat(invoice && invoice.taxRate);
  if (Number.isFinite(rate) && rate > 0) return rate;
  rate = parseFloat(proj && proj.taxRate);
  return Number.isFinite(rate) && rate > 0 ? rate : 0;
}

/** Client sales tax for QB — uses taxAmount/tax on doc or computes from taxable lines × taxRate. */
function qbStudioInvoiceSalesTax(invoice, proj) {
  const explicit = parseFloat(invoice.tax ?? invoice.taxAmount);
  if (Number.isFinite(explicit) && explicit > 0.01) return Math.round(explicit * 100) / 100;
  const taxRate = qbEffectiveInvoiceTaxRate(invoice, proj);
  if (taxRate <= 0) return 0;
  let taxableSub = 0;
  for (const item of invoice.items || []) {
    if (qbStudioInvoiceLineTaxable(item)) taxableSub += qbStudioInvoiceLineAmount(item);
  }
  return Math.round(taxableSub * (taxRate / 100) * 100) / 100;
}

/**
 * QuickBooks invoice create/update path. Intuit OAuth is refreshed automatically from
 * Firestore admin/qb (no Intuit login per push). This function has no Firebase user check.
 */
async function runPushInvoiceToQBCore(projectId, docId, sendEmail) {
  const docRef = db.collection("boards").doc(projectId).collection("invoices").doc(docId);
  const snap = await docRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Invoice not found");
  const invoice = snap.data();

  if (invoice.qbDocId) {
    if (invoice.qbPushPending) {
      await docRef.update({
        qbPushPending: false,
        qbPushSendEmail: admin.firestore.FieldValue.delete()
      }).catch(() => {});
    }
    return { success: true, message: "Already synced to QB", qbDocId: invoice.qbDocId };
  }

  const projSnap = await db.collection("boards").doc(projectId).get();
  const proj = projSnap.exists ? projSnap.data() : {};
  const clientEmail = proj.clientEmail || invoice.clientEmail || "";
  const displayNameCandidates = qbCustomerDisplayNameCandidates(proj, invoice, projectId);

  if (!displayNameCandidates.length) {
    throw new HttpsError("failed-precondition",
      "Set the project name and/or client name on the project (or qbCustomerId under Integrations) before pushing to QuickBooks.");
  }

  if (!invoice.items || invoice.items.length === 0) {
    throw new HttpsError("failed-precondition",
      "Invoice has no line items. Add items before pushing to QB.");
  }

  const pushState = await beginQbDocumentPush(docRef);
  if (pushState.alreadySynced) {
    return { success: true, message: "Already synced to QB", qbDocId: pushState.qbDocId };
  }

  try {
    const { accessToken, realmId } = await getQBAccessToken();

    const projRef = db.collection("boards").doc(projectId);
    const customerId = await resolveQbCustomerIdForPush(
      accessToken,
      realmId,
      displayNameCandidates,
      clientEmail,
      projRef,
      proj
    );

    const QB_ITEMS = QB_ITEM_IDS;

    function qbInvoiceLineLabel(item) {
      const t = String((item && (item.title || item.name)) || "").trim();
      const low = t.toLowerCase();
      if (t && low !== "item" && low !== "general item" && low !== "general" && low !== "untitled") return t;
      const svc = String((item && (item.service || item.billingCategory)) || "").trim();
      if (svc) return svc;
      const d = String((item && item.description) || "").trim();
      if (d) {
        const beforeDash = (d.split(/\s[\u2014—]\s/)[0] || d.split(" - ")[0] || d).replace(/\s*\([^)]*\)\s*$/, "").trim();
        if (beforeDash) return beforeDash;
        const p = d.match(/^(.+?)\s*\(/);
        if (p && p[1]) return p[1].trim();
      }
      const cat = String((item && (item.category || item.type)) || "").trim();
      if (cat) return cat;
      return t || "service";
    }

    function pickItemRef(item) {
      return qbItemRefForStudioLine(item);
    }

    const salesTaxForQb = qbStudioInvoiceSalesTax(invoice, proj);

    const lineItems = (invoice.items || []).map((item, idx) => {
      const qty = Math.max(parseFloat(item.qty || 1) || 1, 0.0001);
      const lineTotal = qbStudioInvoiceLineAmount(item);
      const lineLabel = qbInvoiceLineLabel(item);
      const lineTaxable = qbStudioInvoiceLineTaxable(item);
      let restDesc = String((item && item.description) || "").trim();
      if (restDesc && lineLabel && restDesc.toLowerCase().startsWith(lineLabel.toLowerCase())) {
        restDesc = restDesc.slice(lineLabel.length).replace(/^\s*\([^)]*\)\s*[\u2014—\-]\s*/, "").trim();
      }
      return {
        LineNum: idx + 1,
        Amount: lineTotal,
        Description: [
          lineLabel,
          restDesc && restDesc.toLowerCase() !== lineLabel.toLowerCase() ? restDesc : "",
          item.vendor ? "(" + item.vendor + ")" : "",
          item.room || item.category || ""
        ].filter(Boolean).join(" — "),
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: pickItemRef(item),
          Qty: qty,
          UnitPrice: lineTotal / qty,
          TaxCodeRef: { value: lineTaxable ? "TAX" : "NON" }
        }
      };
    });

    /** Vendor pre-paid tax pass-through only — not client sales tax (that uses TaxCodeRef + TxnTaxDetail). */
    if (invoice.tax && parseFloat(invoice.tax) > 0 && String(invoice._qbTaxLineKind || "") === "prepaid") {
      lineItems.push({
        Amount: parseFloat(invoice.tax),
        Description: "Prepaid Sales Tax",
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: QB_ITEMS.tax, name: "Studio Prepaid Tax" },
          Qty: 1,
          UnitPrice: parseFloat(invoice.tax),
          TaxCodeRef: { value: "NON" }
        }
      });
    }

    if (invoice.shipping && parseFloat(invoice.shipping) > 0) {
      lineItems.push({
        Amount: parseFloat(invoice.shipping),
        Description: "Shipping & Handling",
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: {
          ItemRef: { value: QB_ITEMS.shipping, name: "Studio Shipping" },
          Qty: 1,
          UnitPrice: parseFloat(invoice.shipping)
        }
      });
    }

    const dueDate = invoice.dueDate ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const qbInvoice = {
      Line: lineItems,
      CustomerRef: { value: customerId },
      DocNumber: invoice.invoiceNum || invoice.number || docId.slice(0, 10),
      TxnDate: invoice.date || new Date().toISOString().split("T")[0],
      DueDate: dueDate,
      EmailStatus: sendEmail !== false ? "NeedToSend" : "NotSet",
      BillEmail: clientEmail ? { Address: clientEmail } : undefined,
      CustomerMemo: { value: "Thank you for your business — CCH Design" },
      PrivateNote: "Pushed from CCH Studio. Project: " + (proj.name || projectId)
    };
    if (salesTaxForQb > 0.02) {
      qbInvoice.TxnTaxDetail = { TotalTax: salesTaxForQb };
    }

    const result = await qbApiCall("POST", "invoice", accessToken, realmId, qbInvoice);
    const qbInv = result.Invoice || {};
    const qbId = qbInv.Id;

    await docRef.update({
      qbDocId: qbId,
      qbSyncDate: admin.firestore.FieldValue.serverTimestamp(),
      qbSynced: true,
      qbStatus: "sent",
      qbInvoiceNum: qbInv.DocNumber,
      qbPushedSalesTax: salesTaxForQb > 0.02 ? salesTaxForQb : 0,
      qbPushedWithSalesTax: salesTaxForQb > 0.02,
      taxAmount: salesTaxForQb > 0.02 ? salesTaxForQb : (invoice.taxAmount || null),
      qbPushPending: false,
      qbPushSendEmail: admin.firestore.FieldValue.delete(),
      qbPushLastError: admin.firestore.FieldValue.delete(),
      [QB_PUSH_LOCK_FIELD]: admin.firestore.FieldValue.delete()
    });

    return {
      success: true,
      qbDocId: qbId,
      qbInvoiceNum: qbInv.DocNumber,
      qbSalesTaxPushed: salesTaxForQb,
      emailSent: sendEmail !== false && !!clientEmail
    };
  } catch (err) {
    await clearQbPushLock(docRef);
    throw err;
  }
}

// Ordered QuickBooks Customer DisplayName tries: project/job labels first (QB often uses
// "7225 Bugletrail" or "Green Hixon"), then person client name. Deduped case-insensitively.
function qbCustomerDisplayNameCandidates(proj, invoice, projectId) {
  const out = [];
  const seen = new Set();
  function add(raw) {
    const t = String(raw || "").trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  }
  const p = proj || {};
  const inv = invoice || {};
  const clientLower = String(p.clientName || inv.clientName || inv.client || "").trim().toLowerCase();

  add(p.name);
  add(p.projectName);
  add(inv.projectName);
  add(p.title);
  add(p.slug);

  const pn = String(p.name || "").trim();
  if (pn) {
    const parts = pn
      .split(/\s*[\u2013\u2014\-]\s*/)
      .map(s => s.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      // Avoid "Client - Green Hixon" matching QB "Client" before "Green Hixon": try longer /
      // job-code-like segments before short segments that may equal a person name.
      const sorted = parts.slice().sort((a, b) => {
        const da = /^\d/.test(a);
        const db = /^\d/.test(b);
        if (da !== db) return da ? -1 : 1;
        const la = a.toLowerCase();
        const lb = b.toLowerCase();
        const ea = clientLower && la === clientLower;
        const eb = clientLower && lb === clientLower;
        if (ea !== eb) return ea ? 1 : -1;
        return b.length - a.length;
      });
      sorted.forEach(add);
    }
  }

  add(p.clientName);
  add(inv.clientName);
  add(inv.client);
  if (out.length === 0 && projectId) {
    add(String(projectId).replace(/-/g, " "));
  }
  return out;
}

// ─── RESOLVE QB CUSTOMER (no auto-create) ────────────────────────
// 1) boards/{projectId}.qbCustomerId (numeric QB Id) wins.
// 2) Else try each DisplayName candidate (project name before client name) against QuickBooks;
//    on first match persist qbCustomerId on the board.
// 3) Else failed-precondition — Studio must not create new QB customers from a push.
async function resolveQbCustomerIdForPush(accessToken, realmId, displayNameCandidates, clientEmail, projRef, proj) {
  const candidates = Array.isArray(displayNameCandidates)
    ? displayNameCandidates.map(c => String(c || "").trim()).filter(Boolean)
    : [];

  const existingQbId = proj && proj.qbCustomerId != null ? String(proj.qbCustomerId).trim() : "";
  if (existingQbId && /^\d+$/.test(existingQbId)) {
    return existingQbId;
  }

  if (!candidates.length) {
    throw new HttpsError(
      "invalid-argument",
      "No project or client names available to match a QuickBooks customer."
    );
  }

  for (const tryDisplay of candidates) {
    const searchName = tryDisplay.replace(/'/g, "\\'");
    const query = `select * from Customer where DisplayName = '${searchName}'`;
    const searchResult = await qbApiCall("GET",
      "query?query=" + encodeURIComponent(query), accessToken, realmId);

    if (searchResult.QueryResponse && searchResult.QueryResponse.Customer &&
        searchResult.QueryResponse.Customer.length > 0) {
      const id = searchResult.QueryResponse.Customer[0].Id;
      if (projRef) {
        await projRef.update({ qbCustomerId: id }).catch(() => {});
      }
      return id;
    }
  }

  throw new HttpsError(
    "failed-precondition",
    "QuickBooks: no customer is linked to this project. Creating new QuickBooks customers from Studio is disabled. " +
      "Set qbCustomerId on the project (Integrations), or use a QuickBooks customer DisplayName that matches the " +
      "project name or client name. Names tried (in order): " +
      candidates.slice(0, 8).map(c => "\"" + c + "\"").join(", ") +
      (candidates.length > 8 ? " …" : "") + "."
  );
}

// ─── RESOLVE QB VENDOR (no auto-create) ──────────────────────────
// 1) vendors collection doc where name == PO vendor string and qbVendorId set.
// 2) Else exact Vendor DisplayName in QuickBooks; on match persist qbVendorId on that vendor doc.
// 3) Else failed-precondition.
async function resolveQbVendorIdForPush(accessToken, realmId, vendorName) {
  const vn = (vendorName || "").trim();
  if (!vn) {
    throw new HttpsError("invalid-argument", "Vendor name is required");
  }

  let vendorDocRef = null;
  try {
    const vs = await db.collection("vendors").where("name", "==", vn).limit(1).get();
    if (!vs.empty) {
      vendorDocRef = vs.docs[0].ref;
      const vd = vs.docs[0].data() || {};
      const qid = vd.qbVendorId != null ? String(vd.qbVendorId).trim() : "";
      if (qid && /^\d+$/.test(qid)) {
        return qid;
      }
    }
  } catch (e) {
    console.warn("[resolveQbVendorIdForPush] Firestore vendors lookup:", e && e.message);
  }

  const searchName = vn.replace(/'/g, "\\'");
  const query = `select * from Vendor where DisplayName = '${searchName}'`;
  const searchResult = await qbApiCall("GET",
    "query?query=" + encodeURIComponent(query), accessToken, realmId);

  if (searchResult.QueryResponse && searchResult.QueryResponse.Vendor &&
      searchResult.QueryResponse.Vendor.length > 0) {
    const id = searchResult.QueryResponse.Vendor[0].Id;
    if (vendorDocRef) {
      await vendorDocRef.update({ qbVendorId: id }).catch(() => {});
    }
    return id;
  }

  throw new HttpsError(
    "failed-precondition",
    "QuickBooks: no vendor is linked for \"" + vn + "\". Creating new QuickBooks vendors from Studio is disabled. " +
      "In Studio → Vendors → Edit this vendor (name must match the PO vendor field exactly) and set QuickBooks vendor Id, " +
      "or create the vendor in QuickBooks with DisplayName exactly matching the PO vendor name."
  );
}

// ─── PUSH INVOICE → QB (callable: requires CCH Firebase sign-in on allow-list) ──
exports.pushInvoiceToQB = onCall(QB_CALLABLE, async (request) => {
  assertQbPushAllowed(request);

  const { projectId, docId, sendEmail } = request.data || {};
  if (!projectId || !docId) {
    throw new HttpsError("invalid-argument", "projectId and docId required");
  }

  return runPushInvoiceToQBCore(projectId, docId, sendEmail !== false);
  }
);

/** Numeric QuickBooks entity id from Firestore (not DocNumber like INV-6012). */
function _qbInvoiceEntityId(data) {
  if (!data) return "";
  const raw = data.qbDocId || data.qbInvoiceId || data.qbId;
  if (raw == null || String(raw).trim() === "") return "";
  const s = String(raw).trim();
  if (/^\d+$/.test(s)) return s;
  return "";
}

/** DocNumber strings to try in QB SQL when qbDocId is missing or non-numeric. */
function _studioInvoiceDocNumberCandidates(existing) {
  if (!existing) return [];
  const out = [];
  const seen = new Set();
  function add(raw) {
    if (raw == null) return;
    let t = String(raw).trim();
    if (!t) return;
    t = t.replace(/%20/gi, " ").replace(/\s+/g, " ").trim();
    t = t.replace(/\s*-\s*Paid$/i, "").replace(/\s*-\s*Partially\s*Paid$/i, "").trim();
    if (!t) return;
    const variants = new Set([t]);
    const core = t.replace(/^INV-?/i, "").trim();
    if (core) {
      variants.add("INV-" + core);
      variants.add("INV-" + core.replace(/^0+/, "") || core);
      variants.add(core);
    }
    for (const v of variants) {
      const k = v.toLowerCase();
      if (v && !seen.has(k)) {
        seen.add(k);
        out.push(v);
      }
    }
  }
  add(existing.invoiceNum);
  add(existing.number);
  add(existing.displayNumber);
  add(existing.invoiceNumber);
  const qraw = existing.qbDocId || existing.qbInvoiceId || existing.qbId;
  if (qraw != null && String(qraw).trim() && !/^\d+$/.test(String(qraw).trim())) {
    add(String(qraw).trim());
  }
  return out;
}

/**
 * GET invoice by numeric id, or query QB by DocNumber when Studio only has INV-xxxx / wrong qbDocId.
 * @returns {{ qbInv: object, canonicalQbId: string }}
 */
async function fetchQBInvoiceForStudio(accessToken, realmId, existing) {
  const numeric = _qbInvoiceEntityId(existing);
  const minor = "minorversion=65";
  if (numeric) {
    const invResp = await qbApiCall(
      "GET",
      "invoice/" + encodeURIComponent(numeric) + "?" + minor,
      accessToken,
      realmId,
      null
    );
    const qbInv = invResp && invResp.Invoice;
    if (!qbInv) {
      throw new HttpsError("internal", "QuickBooks returned no invoice for id " + numeric);
    }
    return { qbInv, canonicalQbId: String(qbInv.Id || numeric) };
  }

  const candidates = _studioInvoiceDocNumberCandidates(existing);
  if (!candidates.length) {
    throw new HttpsError(
      "failed-precondition",
      "No way to find this invoice in QuickBooks: add the numeric Id (open the invoice in QB → copy Id from the URL), or ensure Studio invoice # matches QB DocNumber, then retry."
    );
  }

  for (const docNum of candidates) {
    const safe = String(docNum).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const q = "select * from Invoice where DocNumber = '" + safe + "'";
    const endpoint = "query?query=" + encodeURIComponent(q) + "&" + minor;
    const res = await qbApiCall("GET", endpoint, accessToken, realmId, null);
    const fr = (res.QueryResponse && res.QueryResponse.Invoice) || [];
    const list = Array.isArray(fr) ? fr : (fr ? [fr] : []);
    if (list.length === 1) {
      const qbInv = list[0];
      return { qbInv, canonicalQbId: String(qbInv.Id) };
    }
    if (list.length > 1) {
      throw new HttpsError(
        "failed-precondition",
        "Multiple QuickBooks invoices match DocNumber '" + docNum + "'. In QB, remove duplicates or set qbDocId to the numeric Id of the correct invoice."
      );
    }
  }

  throw new HttpsError(
    "not-found",
    "No QuickBooks invoice found for DocNumber tries: " + candidates.slice(0, 6).join(", ")
  );
}

/**
 * Pull Payment transactions linked to a QB invoice (LinkedTxn + customer fallback query).
 * @returns {Promise<Array<{amount:number,date:string,method:string,note:string,qbPaymentId:string,qbInvoiceTxnId:string,reference:string}>>}
 */
async function pullQbPaymentLinesForInvoice(accessToken, realmId, qbInv) {
  const out = [];
  const invId = String((qbInv && qbInv.Id) || "").trim();
  if (!invId) return out;
  const seen = new Set();

  async function addFromPaymentEntity(paymentData, fallbackAmt) {
    if (!paymentData) return;
    const payId = String(paymentData.Id || "").trim();
    if (!payId || seen.has(payId)) return;
    let applied = 0;
    let matched = false;
    for (const line of paymentData.Line || []) {
      const invLinks = (line.LinkedTxn || []).filter(
        (t) => t.TxnType === "Invoice" && String(t.TxnId) === invId
      );
      if (!invLinks.length) continue;
      matched = true;
      const lineAmt = parseFloat(line.Amount);
      applied += Number.isFinite(lineAmt) && lineAmt > 0 ? lineAmt : 0;
    }
    if (!matched && fallbackAmt > 0.01) applied = fallbackAmt;
    if (!matched) return;
    seen.add(payId);
    const txnDate =
      (paymentData.TxnDate && String(paymentData.TxnDate).slice(0, 10)) ||
      new Date().toISOString().slice(0, 10);
    out.push({
      amount: Math.round(applied * 100) / 100,
      date: txnDate,
      method: paymentData.PaymentMethodRef
        ? paymentData.PaymentMethodRef.name || "QuickBooks"
        : "QuickBooks",
      note: "Synced from QuickBooks",
      qbPaymentId: payId,
      qbInvoiceTxnId: invId,
      reference: String(paymentData.PaymentRefNum || paymentData.Id || "").trim(),
      qbPaymentLineKey: qbInvoicePaymentLineKey(payId, invId, applied)
    });
  }

  for (const link of qbInv.LinkedTxn || []) {
    if (link.TxnType !== "Payment" || !link.TxnId) continue;
    try {
      const pr = await qbApiCall(
        "GET",
        "payment/" + encodeURIComponent(String(link.TxnId)) + "?minorversion=65",
        accessToken,
        realmId,
        null
      );
      await addFromPaymentEntity(pr.Payment, parseFloat(pr.Payment && pr.Payment.TotalAmt) || 0);
    } catch (e) {
      console.warn("[pullQbPaymentLinesForInvoice] payment GET", link.TxnId, e.message);
    }
  }

  if (!out.length && qbInv.CustomerRef && qbInv.CustomerRef.value) {
    const cust = String(qbInv.CustomerRef.value).replace(/'/g, "\\'");
    const q =
      "select * from Payment where CustomerRef = '" + cust + "' MAXRESULTS 200";
    try {
      const res = await qbApiCall(
        "GET",
        "query?query=" + encodeURIComponent(q) + "&minorversion=65",
        accessToken,
        realmId,
        null
      );
      const list = (res.QueryResponse && res.QueryResponse.Payment) || [];
      const payments = Array.isArray(list) ? list : list ? [list] : [];
      for (const stub of payments) {
        if (!stub || !stub.Id) continue;
        try {
          const pr = await qbApiCall(
            "GET",
            "payment/" + encodeURIComponent(String(stub.Id)) + "?minorversion=65",
            accessToken,
            realmId,
            null
          );
          await addFromPaymentEntity(pr.Payment, parseFloat(pr.Payment && pr.Payment.TotalAmt) || 0);
        } catch (e) {
          console.warn("[pullQbPaymentLinesForInvoice] customer payment GET", stub.Id, e.message);
        }
      }
    } catch (e) {
      console.warn("[pullQbPaymentLinesForInvoice] customer query", e.message);
    }
  }

  return out;
}

/** Stable dedupe key for QB invoice payment rows (ignores dollars-vs-cents line-key drift). */
function qbInvoicePaymentDedupeKey(row) {
  if (!row) return "";
  const qb = String(row.qbPaymentId || "").trim();
  if (!qb) return "";
  const amt = Math.round((parseFloat(row.amount) || 0) * 100) / 100;
  const inv = String(row.qbInvoiceTxnId || "").trim();
  const d = String(row.date || "").slice(0, 10);
  return "qb:" + qb + ":" + (inv || "-") + ":" + amt + ":" + d;
}

/** Canonical QB line fingerprint — amount suffix is always cents. */
function qbInvoicePaymentLineKey(payId, invId, amount) {
  const amt = Math.round((parseFloat(amount) || 0) * 100) / 100;
  return String(payId) + "|" + String(invId) + "|" + String(Math.round(amt * 100));
}

function dedupeInvoicePaymentRowsServer(payments) {
  if (!Array.isArray(payments) || payments.length <= 1) return payments || [];
  const seenQb = new Set();
  const seenOther = new Set();
  const out = [];
  for (const p of payments) {
    const qbKey = qbInvoicePaymentDedupeKey(p);
    if (qbKey) {
      if (seenQb.has(qbKey)) continue;
      seenQb.add(qbKey);
      out.push(p);
      continue;
    }
    const qk = String(p.qbPaymentLineKey || "").trim();
    const qb = String(p.qbPaymentId || "").trim();
    const id = String(p.id || "").trim();
    const amt = Math.round((parseFloat(p.amount) || 0) * 100) / 100;
    const d = String(p.date || "").trim();
    const note = String(p.note || p.reference || "").trim().slice(0, 120);
    const key =
      qk ||
      (qb ? "qb:" + qb + ":" + amt + ":" + d : "") ||
      (id ? "id:" + id : "") ||
      "fp:" + d + "|" + amt + "|" + note;
    if (seenOther.has(key)) continue;
    seenOther.add(key);
    out.push(p);
  }
  return out;
}

function mergeQbPaymentRowsIntoPatch(existing, patch, qbPayRows, refTotal, qbBalance) {
  if (!qbPayRows || !qbPayRows.length) return;
  let payLines = Array.isArray(existing.payments) ? existing.payments.slice() : [];
  const seenQb = new Set(payLines.map(qbInvoicePaymentDedupeKey).filter(Boolean));
  const seenQk = new Set(
    payLines.map((p) => String(p.qbPaymentLineKey || "").trim()).filter(Boolean)
  );
  qbPayRows.forEach((row) => {
    const qbKey = qbInvoicePaymentDedupeKey(row);
    if (qbKey && seenQb.has(qbKey)) return;
    const key = String(row.qbPaymentLineKey || "").trim();
    if (!qbKey && key && seenQk.has(key)) return;
    if (qbKey) seenQb.add(qbKey);
    if (key) seenQk.add(key);
    payLines.push(row);
  });
  payLines = dedupeInvoicePaymentRowsServer(payLines);
  const paidSum = payLines.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const latestDate = qbPayRows
    .map((p) => String(p.date || "").slice(0, 10))
    .filter(Boolean)
    .sort()
    .pop();
  patch.payments = payLines;
  patch.paymentCount = payLines.length;
  if (latestDate) {
    patch.qbPaymentDate = latestDate;
    if (!existing.datePaid) patch.datePaid = latestDate;
  }
  // QB is source of truth: if QB shows the invoice fully paid ($0 balance), mark Paid
  // even when the Studio total drifted higher (lines/tax edited after QB was paid).
  const qbFullyPaid =
    qbBalance != null && qbBalance !== "" && Number.isFinite(parseFloat(qbBalance)) && parseFloat(qbBalance) <= 0.02;
  if (qbFullyPaid || (refTotal > 0.01 && paidSum >= refTotal - 0.02)) {
    patch.status = "Paid";
    patch.qbStatus = "paid";
    patch.paidAmount = qbFullyPaid ? Math.max(paidSum, refTotal) : paidSum;
    patch.balance = 0;
    if (qbFullyPaid && refTotal > 0.01 && paidSum < refTotal - 0.02) {
      patch.qbTotalMismatch = {
        studioTotal: Math.round(refTotal * 100) / 100,
        qbCollected: Math.round(paidSum * 100) / 100,
        note: "QB fully paid; Studio total higher (edited after QB paid)",
        flaggedAt: new Date().toISOString()
      };
    }
    patch.qbPaymentConfirmation =
      "QB payment" +
      (qbPayRows[0] && qbPayRows[0].qbPaymentId ? " " + qbPayRows[0].qbPaymentId : "") +
      " · $" +
      paidSum.toFixed(2) +
      (latestDate ? " on " + latestDate : "");
  } else if (paidSum > 0.02) {
    patch.status = "Partially Paid";
    patch.qbStatus = "partial";
    patch.paidAmount = paidSum;
    patch.balance = Math.max(0, refTotal - paidSum);
    patch.qbPaymentConfirmation =
      "QB paid $" +
      paidSum.toFixed(2) +
      " · Studio total $" +
      refTotal.toFixed(2) +
      (latestDate ? " · " + latestDate : "");
  }
}

/**
 * Build Firestore patch from QB Invoice GET (TotalAmt, Balance).
 * When Balance is ~0, marks Studio invoice Paid + qbStatus paid and aligns payments if needed.
 */
function buildFirestorePatchFromQBInvoice(existing, qbInv, qbPayRows) {
  const totalAmt = parseFloat(qbInv.TotalAmt) || 0;
  let balance = qbInv.Balance;
  if (balance == null || balance === "") balance = totalAmt;
  balance = parseFloat(balance);
  if (!Number.isFinite(balance)) balance = totalAmt;
  const paidFromQb = Math.max(0, totalAmt - balance);
  const studioTotal = parseFloat(existing.total) || 0;
  const refTotal = studioTotal > 0.01 ? studioTotal : totalAmt;

  const updates = {
    qbBalanceSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    qbApiTotalAmt: totalAmt,
    qbApiBalance: balance,
    updatedAt: new Date().toISOString()
  };

  const payLines = Array.isArray(existing.payments) ? existing.payments.slice() : [];
  const paidSum = payLines.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  if (refTotal <= 0.01) {
    updates.qbStatus = balance <= 0.02 ? "paid" : "sent";
    return updates;
  }

  if (balance <= 0.02) {
    const payDateFromRows =
      qbPayRows && qbPayRows.length
        ? qbPayRows
            .map((p) => String(p.date || "").slice(0, 10))
            .filter(Boolean)
            .sort()
            .pop()
        : "";
    const paidDate =
      payDateFromRows ||
      (existing.qbPaymentDate && String(existing.qbPaymentDate).slice(0, 10)) ||
      (existing.datePaid && String(existing.datePaid).slice(0, 10)) ||
      (qbInv.TxnDate && String(qbInv.TxnDate).slice(0, 10)) ||
      new Date().toISOString().slice(0, 10);
    if (!existing.datePaid) updates.datePaid = paidDate;
    updates.qbPaymentDate = payDateFromRows || paidDate;
    if (qbPayRows && qbPayRows.length) {
      mergeQbPaymentRowsIntoPatch(existing, updates, qbPayRows, refTotal, balance);
    } else {
      const qbPaidAmt = Math.round(paidFromQb * 100) / 100;
      if (payLines.length === 0 && qbPaidAmt > 0.02) {
        updates.payments = [{
          amount: qbPaidAmt,
          date: paidDate,
          method: "QuickBooks",
          note: "Paid in QuickBooks (merchandise per QB invoice total)",
          source: "QuickBooks"
        }];
        updates.paymentCount = 1;
      }
      // QB balance is ~0 here, so QB considers the invoice fully paid. Trust QB and mark
      // Paid even if the Studio total is higher (edited after QB was paid); flag the gap.
      const rowsPaid = (updates.payments || payLines).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      const paidAmt = rowsPaid > 0.02 ? rowsPaid : qbPaidAmt;
      updates.status = "Paid";
      updates.qbStatus = "paid";
      updates.paidAmount = Math.max(paidAmt, refTotal);
      updates.balance = 0;
      if (refTotal > 0.01 && paidAmt < refTotal - 0.02) {
        updates.qbTotalMismatch = {
          studioTotal: Math.round(refTotal * 100) / 100,
          qbCollected: Math.round(paidAmt * 100) / 100,
          note: "QB fully paid; Studio total higher (edited after QB paid)",
          flaggedAt: new Date().toISOString()
        };
      }
    }
  } else if (paidFromQb > 0.02) {
    if (qbPayRows && qbPayRows.length) {
      mergeQbPaymentRowsIntoPatch(existing, updates, qbPayRows, refTotal, balance);
    } else {
      updates.status = "Partially Paid";
      updates.qbStatus = "partial";
      updates.paidAmount = paidFromQb;
      updates.balance = Math.max(0, refTotal - paidFromQb);
    }
  } else {
    updates.qbStatus = "sent";
  }

  return updates;
}

/** Pull one invoice from QuickBooks by qbDocId and update paid status / balance fields in Firestore. */
exports.syncInvoiceBalanceFromQB = onCall(QB_CALLABLE, async (request) => {
    assertQbPushAllowed(request);
    const { projectId, invoiceId } = request.data || {};
    if (!projectId || !invoiceId) {
      throw new HttpsError("invalid-argument", "projectId and invoiceId required");
    }
    const docRef = db.collection("boards").doc(projectId).collection("invoices").doc(invoiceId);
    const snap = await docRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Invoice not found");
    const existing = snap.data();
    const { accessToken, realmId } = await getQBAccessToken();
    const { qbInv, canonicalQbId } = await fetchQBInvoiceForStudio(accessToken, realmId, existing);
    let qbPayRows = [];
    try {
      qbPayRows = await pullQbPaymentLinesForInvoice(accessToken, realmId, qbInv);
    } catch (e) {
      console.warn("[syncInvoiceBalanceFromQB] payment pull", e.message);
    }
    const patch = buildFirestorePatchFromQBInvoice(existing, qbInv, qbPayRows);
    const prevQb = String(existing.qbDocId || existing.qbInvoiceId || "").trim();
    if (canonicalQbId && prevQb !== canonicalQbId) {
      patch.qbDocId = canonicalQbId;
    }
    await docRef.update(patch);
    return {
      success: true,
      qbId: canonicalQbId,
      totalAmt: patch.qbApiTotalAmt,
      balance: patch.qbApiBalance,
      status: patch.status || existing.status,
      qbStatus: patch.qbStatus || existing.qbStatus,
      qbPaymentDate: patch.qbPaymentDate || existing.qbPaymentDate || "",
      paymentLinesPulled: qbPayRows.length
    };
  }
);

/**
 * Shared batch-refresh logic: scan boards' invoice subcollections and refresh paid status
 * from QuickBooks (GET per row). Used by the manual callable and the twice-daily scheduler.
 */
async function runBatchInvoiceBalanceSync(opts) {
  const maxInvoices = Math.min(
    Math.max(parseInt(String(opts && opts.maxInvoices != null ? opts.maxInvoices : 200), 10) || 200, 1),
    500
  );
  const onlyProjectId = opts && opts.onlyProjectId ? String(opts.onlyProjectId).trim() : "";
  const { accessToken, realmId } = await getQBAccessToken();
  let boardsSnap;
  if (onlyProjectId) {
    const one = await db.collection("boards").doc(onlyProjectId).get();
    boardsSnap = one.exists ? { docs: [one] } : { docs: [] };
  } else {
    boardsSnap = await db.collection("boards").get();
  }
  let scanned = 0;
  let updated = 0;
  let errors = 0;
  const sampleErrors = [];

  outer: for (const boardDoc of boardsSnap.docs) {
    const projectId = boardDoc.id;
    let invSnap;
    try {
      invSnap = await db.collection("boards").doc(projectId).collection("invoices").get();
    } catch (e) {
      continue;
    }
    for (const invDoc of invSnap.docs) {
      if (scanned >= maxInvoices) break outer;
      const data = invDoc.data();
      const qbId = _qbInvoiceEntityId(data);
      const docNumCandidates = _studioInvoiceDocNumberCandidates(data);
      if (!qbId && !docNumCandidates.length) continue;
      scanned++;
      try {
        const { qbInv, canonicalQbId } = await fetchQBInvoiceForStudio(accessToken, realmId, data);
        let qbPayRows = [];
        try {
          qbPayRows = await pullQbPaymentLinesForInvoice(accessToken, realmId, qbInv);
        } catch (pe) {
          console.warn("[runBatchInvoiceBalanceSync] payment pull", invDoc.id, pe.message);
        }
        const patch = buildFirestorePatchFromQBInvoice(data, qbInv, qbPayRows);
        const prevQb = String(data.qbDocId || data.qbInvoiceId || "").trim();
        if (canonicalQbId && prevQb !== canonicalQbId) {
          patch.qbDocId = canonicalQbId;
        }
        await invDoc.ref.update(patch);
        updated++;
      } catch (e) {
        errors++;
        const msg = (e && e.message) ? e.message : String(e);
        if (sampleErrors.length < 10) sampleErrors.push(invDoc.id + ": " + msg);
      }
    }
  }

  return { success: true, scanned, updated, errors, sampleErrors };
}

/**
 * Scan all boards' invoice subcollections and refresh paid status from QuickBooks (GET per row).
 * Run from Studio when payments were recorded in QB but webhook did not update Firestore.
 */
exports.batchSyncInvoiceBalancesFromQB = onCall(QB_BATCH_CALLABLE, async (request) => {
    assertQbPushAllowed(request);
    return runBatchInvoiceBalanceSync({
      maxInvoices: request.data && request.data.maxInvoices,
      onlyProjectId: request.data && request.data.projectId
    });
  });

/**
 * Twice-daily automatic QB balance/payment refresh (07:00 and 16:00 America/Los_Angeles).
 * Backstop for the webhook: catches payments QB recorded without firing the webhook.
 */
exports.scheduledQbInvoiceSync = onSchedule(
  {
    schedule: "0 7,16 * * *",
    timeZone: "America/Los_Angeles",
    region: REGION,
    secrets: QB_SECRET_NAMES,
    timeoutSeconds: 540,
    memory: "512MiB"
  },
  async () => {
    try {
      const result = await runBatchInvoiceBalanceSync({ maxInvoices: 500 });
      console.log("[scheduledQbInvoiceSync]", JSON.stringify(result));
    } catch (e) {
      console.error("[scheduledQbInvoiceSync] failed:", e && e.message ? e.message : e);
    }
  }
);

/**
 * Same push as pushInvoiceToQB without Firebase user — for Zapier/n8n/cron.
 * Set QB_AUTOMATION_SECRET in Functions environment, redeploy, then:
 * POST .../pushInvoiceToQBAutomated
 * Header: Authorization: Bearer <QB_AUTOMATION_SECRET>
 * Body: { "projectId": "...", "docId": "...", "sendEmail": false }
 *
 * QuickBooks OAuth still uses admin/qb refresh token (fully automatic; no Intuit login per request).
 */
exports.pushInvoiceToQBAutomated = onRequest(QB_HTTP, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const configured = process.env.QB_AUTOMATION_SECRET || "";
  if (!configured) {
    return res.status(503).json({
      error: "Automation not configured: add QB_AUTOMATION_SECRET to Firebase Functions env and redeploy."
    });
  }

  const hdr = req.get("authorization") || "";
  const bearer = hdr.startsWith("Bearer ") ? hdr.slice(7).trim() : "";
  const body = req.body || {};
  const bodySecret = body.secret ? String(body.secret) : "";
  if (bearer !== configured && bodySecret !== configured) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const projectId = body.projectId;
  const docId = body.docId;
  if (!projectId || !docId) {
    return res.status(400).json({ error: "projectId and docId required in JSON body" });
  }

  try {
    const out = await runPushInvoiceToQBCore(projectId, docId, body.sendEmail !== false);
    return res.json(out);
  } catch (e) {
    if (e instanceof HttpsError) {
      return res.status(_httpsErrStatus(e.code)).json({ error: e.message, code: e.code });
    }
    console.error("[pushInvoiceToQBAutomated]", e);
    return res.status(500).json({ error: e.message || "Push failed" });
  }
});

/**
 * When an invoice is saved with qbPushPending: true, run the same QB push as the callable
 * (uses admin/qb token — no Intuit login). Clears the flag on success; on failure sets
 * qbPushLastError and clears pending so the user can fix and queue again.
 */
exports.processInvoiceQBPushPending = onDocumentWritten(
  {
    document: "boards/{projectId}/invoices/{invoiceId}",
    region: REGION,
    secrets: QB_SECRET_NAMES
  },
  async (event) => {
    const snap = event.data.after;
    if (!snap || !snap.exists) return;

    const data = snap.data();
    const { projectId, invoiceId } = event.params;

    if (!data.qbPushPending) return;
    if (data.qbDocId) {
      await snap.ref.update({ qbPushPending: false }).catch(() => {});
      return;
    }

    const sendEmail = data.qbPushSendEmail !== false;

    try {
      await runPushInvoiceToQBCore(projectId, invoiceId, sendEmail);
    } catch (e) {
      const msg =
        e instanceof HttpsError
          ? e.message
          : (e && e.message) || String(e);
      console.error("[processInvoiceQBPushPending]", projectId, invoiceId, msg);
      await snap.ref
        .update({
          qbPushPending: false,
          qbPushLastError: msg,
          qbPushErrorAt: admin.firestore.FieldValue.serverTimestamp()
        })
        .catch(() => {});
    }
  });

// ─── PUSH PO → QB (as Purchase Order) ───────────────────────────
exports.pushPOToQB = onCall(QB_CALLABLE, async (request) => {
  assertQbPushAllowed(request);

  const { projectId, docId } = request.data || {};
  const docRef = db.collection("boards").doc(projectId).collection("purchaseOrders").doc(docId);
  const snap = await docRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "PO not found");
  const po = snap.data();

  if (po.qbDocId) {
    return { success: true, message: "Already synced", qbDocId: po.qbDocId };
  }

  // Validation: require vendor
  const vendorName = po.vendor || po.vendorName || "";
  if (!vendorName) {
    throw new HttpsError("failed-precondition",
      "Vendor name is required. Set the vendor on this PO before pushing to QB.");
  }

  // Validation: require at least one line item
  if (!po.items || po.items.length === 0) {
    throw new HttpsError("failed-precondition",
      "PO has no line items. Add items before pushing to QB.");
  }

  const pushState = await beginQbDocumentPush(docRef);
  if (pushState.alreadySynced) {
    return { success: true, message: "Already synced", qbDocId: pushState.qbDocId };
  }

  try {
  const { accessToken, realmId } = await getQBAccessToken();
  const vendorId = await resolveQbVendorIdForPush(accessToken, realmId, vendorName);

  // Studio QB Item IDs for PO expense mapping
  function pickPOItemRef(item) {
    return qbItemRefForStudioExpenseLine(item);
  }

  const lineItems = (po.items || []).map((item, idx) => {
    const qty = Math.max(parseFloat(item.qty || 1) || 1, 0.0001);
    const lineTotal = parseFloat(item.cost || item.amount || item.total || item.lineTotal || 0) || 0;
    return {
      LineNum: idx + 1,
      Amount: lineTotal,
      Description: [item.title || item.name || "Item", item.sku || ""].filter(Boolean).join(" — "),
      DetailType: "ItemBasedExpenseLineDetail",
      ItemBasedExpenseLineDetail: {
        ItemRef: pickPOItemRef(item),
        Qty: qty,
        UnitPrice: lineTotal / qty
      }
    };
  });

  // PO documents do not carry tax — vendor tax belongs on the vendor bill (bill.tax / pre-paid tax).

  // Add shipping line if present
  if (po.shipping && parseFloat(po.shipping) > 0) {
    lineItems.push({
      Amount: parseFloat(po.shipping),
      Description: "Shipping & Freight",
      DetailType: "ItemBasedExpenseLineDetail",
      ItemBasedExpenseLineDetail: {
        ItemRef: { value: QB_ITEMS_PO.shipping, name: "Studio Shipping" },
        Qty: 1,
        UnitPrice: parseFloat(po.shipping)
      }
    });
  }

  const qbPO = {
    Line: lineItems,
    VendorRef: { value: vendorId },
    DocNumber: po.number || po.num || docId.slice(0, 10),
    TxnDate: po.date || new Date().toISOString().split("T")[0],
    PrivateNote: "CCH Studio. Project: " + projectId
  };

  const result = await qbApiCall("POST", "purchaseorder", accessToken, realmId, qbPO);
  const qbId = result.PurchaseOrder.Id;

  await docRef.update({
    qbDocId: qbId,
    qbSyncDate: admin.firestore.FieldValue.serverTimestamp(),
    qbSynced: true,
    qbStatus: "sent",
    [QB_PUSH_LOCK_FIELD]: admin.firestore.FieldValue.delete()
  });

  return { success: true, qbDocId: qbId };
  } catch (err) {
    await clearQbPushLock(docRef);
    throw err;
  }
  }
);

/** Vendor bill on PO doc — lock; create or update same qbBillId. */
async function beginQbBillPush(docRef) {
  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(docRef);
    if (!snap.exists) {
      throw new HttpsError("not-found", "PO not found");
    }
    const d = snap.data();
    const bill = d.bill || {};
    if (!bill.received) {
      throw new HttpsError(
        "failed-precondition",
        "Receive the vendor bill in Studio first (PO + additional charges), then push the bill to QuickBooks."
      );
    }
    const lockAt = bill.qbPushLockAt;
    if (lockAt && typeof lockAt.toMillis === "function") {
      const ageMs = Date.now() - lockAt.toMillis();
      if (ageMs >= 0 && ageMs < QB_PUSH_LOCK_TTL_MS) {
        throw new HttpsError(
          "resource-exhausted",
          "QuickBooks bill sync already in progress. Wait a minute and try again."
        );
      }
    }
    transaction.update(docRef, {
      "bill.qbPushLockAt": admin.firestore.FieldValue.serverTimestamp()
    });
    const existingId = bill.qbBillId ? String(bill.qbBillId).trim() : "";
    return { isUpdate: !!existingId, qbBillId: existingId };
  });
}

function vendorInvoiceSourceToQb(source) {
  const s = String(source || "").toLowerCase();
  if (s === "freight" || s === "shipping") return "freight";
  if (s === "tax") return "tax";
  if (s === "labor" || s === "installation" || s === "install") return "labor";
  if (s === "price_change" || s === "price") return "price_change";
  if (s === "merchandise" || s === "product") return "merchandise";
  return "extra";
}

/** Build QB Bill line items from Studio po.bill (PO lines + vendorInvoices / charge items). */
function poLineTitlesFromBill(bill, poLineIds) {
  if (!Array.isArray(poLineIds) || !poLineIds.length) return [];
  const lines = Array.isArray(bill.poLines) && bill.poLines.length
    ? bill.poLines
    : (Array.isArray(bill.items) ? bill.items.filter((it) => it.source === "po") : []);
  return poLineIds.map((id) => {
    const hit = lines.find((l) => l.lineId === id);
    return hit ? (hit.title || "Item") : null;
  }).filter(Boolean);
}

/** Houzz/QB convention: PO-12931 → BL-12931 (QB Bill DocNumber mirrors PO, not PO-12931-BILL). */
function qbBillDocNumberFromPo(poNum) {
  const raw = String(poNum || "").trim();
  if (!raw) return "BL-";
  if (/^BL-/i.test(raw)) return raw;
  const suffix = raw.replace(/^PO-/i, "");
  return "BL-" + suffix;
}

/** DocNumbers to try when linking an existing Houzz/QB bill before creating a duplicate. */
function qbBillDocNumberCandidates(poNum) {
  const primary = qbBillDocNumberFromPo(poNum);
  const raw = String(poNum || "").trim();
  const suffix = raw.replace(/^PO-/i, "");
  const out = [];
  function add(s) {
    const t = String(s || "").trim();
    if (t && !out.includes(t)) out.push(t);
  }
  add(primary);
  add(raw);
  if (suffix && suffix !== raw) add(suffix);
  return out;
}

/** Query QB for an existing Bill by DocNumber (BL-12931, etc.). */
async function findQBBillByDocNumber(accessToken, realmId, docNumberCandidates) {
  const minor = "minorversion=65";
  for (const docNum of docNumberCandidates || []) {
    const safe = String(docNum).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const q = "select * from Bill where DocNumber = '" + safe + "'";
    const endpoint = "query?query=" + encodeURIComponent(q) + "&" + minor;
    const res = await qbApiCall("GET", endpoint, accessToken, realmId, null);
    const fr = (res.QueryResponse && res.QueryResponse.Bill) || [];
    const list = Array.isArray(fr) ? fr : (fr ? [fr] : []);
    if (list.length === 1) return list[0];
    if (list.length > 1) {
      throw new HttpsError(
        "failed-precondition",
        "Multiple QuickBooks bills match DocNumber '" + docNum + "'. Remove duplicates in QB or set bill.qbBillId on the PO."
      );
    }
  }
  return null;
}

/**
 * Resolve QB Bill for push: stored qbBillId, else link existing Houzz BL- bill by DocNumber.
 * @returns {Promise<{ bill: object, linkedExisting: boolean }|null>}
 */
async function fetchQBBillForStudioPush(accessToken, realmId, pushState, docNumberCandidates) {
  if (pushState.isUpdate && pushState.qbBillId) {
    try {
      const fetched = await qbApiCall("GET", "bill/" + pushState.qbBillId, accessToken, realmId);
      const existing = fetched.Bill;
      if (existing && existing.Id) {
        return { bill: existing, linkedExisting: false };
      }
    } catch (_e) {
      /* qbBillId stale — fall through to DocNumber lookup */
    }
  }
  const found = await findQBBillByDocNumber(accessToken, realmId, docNumberCandidates);
  if (found && found.Id) {
    return { bill: found, linkedExisting: true };
  }
  return null;
}

/** Clean vendor invoice / SO refs (Houzz imports often have %20 or literal % before "Quote"). */
function sanitizeVendorInvRef(raw) {
  let t = String(raw || "").trim();
  if (!t) return "";
  try {
    t = decodeURIComponent(t.replace(/\+/g, " "));
  } catch (_e) {
    t = t.replace(/%20/gi, " ");
  }
  return t.replace(/\s+/g, " ").trim();
}

function buildVendorBillQbLineItems(po, bill, opts) {
  opts = opts || {};
  const customerId = opts.customerId ? String(opts.customerId).trim() : "";

  function itemRefForSource(source, poLineItem) {
    if (poLineItem) return qbItemRefForStudioLine(poLineItem);
    const s = String(source || "").toLowerCase();
    if (s === "labor") return qbLaborItemRef();
    if (s === "freight") return { value: QB_ITEM_IDS.shipping, name: "Studio Shipping" };
    if (s === "tax") return { value: QB_ITEM_IDS.tax, name: "Studio Prepaid Tax" };
    if (s === "merchandise") return qbProductItemRef();
    return qbProductItemRef();
  }
  function expenseLine(amount, description, source, lineNum, poLineItem) {
    const amt = Math.round((parseFloat(amount) || 0) * 100) / 100;
    if (Math.abs(amt) < 0.01) return null;
    const ref = itemRefForSource(source, poLineItem);
    const qty = 1;
    const detail = {
      ItemRef: ref,
      Qty: qty,
      UnitPrice: Math.abs(amt) / qty
    };
    if (customerId && /^\d+$/.test(customerId)) {
      detail.CustomerRef = { value: customerId };
    }
    return {
      LineNum: lineNum,
      Amount: Math.abs(amt),
      Description: description,
      DetailType: "ItemBasedExpenseLineDetail",
      ItemBasedExpenseLineDetail: detail
    };
  }

  const poNum = po.number || po.num || po.poNum || "";
  const billTotal = Math.round((parseFloat(bill.billTotal) || 0) * 100) / 100;
  const invRef = sanitizeVendorInvRef(bill.vendorInvoiceNumber);
  const txnDate = (bill.vendorInvoiceDate || po.date || new Date().toISOString()).toString().slice(0, 10);
  const docNumber = qbBillDocNumberFromPo(poNum).slice(0, 21);
  const privateNote =
    "CCH Studio vendor bill · PO " + poNum +
    (invRef ? " · Vendor inv " + invRef : "") +
    (billTotal > 0.01 ? " · Total $" + billTotal.toFixed(2) : "");

  /** QB gets one line — the vendor bill total Studio recorded (detail stays in Studio only). */
  if (billTotal > 0.01) {
    const desc = ["Vendor bill", poNum ? "PO " + poNum : "", invRef ? "Inv " + invRef : ""]
      .filter(Boolean)
      .join(" · ");
    const ln = expenseLine(billTotal, desc, "merchandise", 1);
    return { lineItems: ln ? [ln] : [], txnDate, docNumber, privateNote };
  }

  return { lineItems: [], txnDate, docNumber, privateNote };
}

async function clearQbBillPushLock(docRef) {
  await docRef.update({
    "bill.qbPushLockAt": admin.firestore.FieldValue.delete()
  }).catch(() => {});
}

// ─── PUSH VENDOR BILL → QB (Bill entity only — never BillPayment / never Studio paid status) ──
exports.pushBillToQB = onCall(QB_CALLABLE, async (request) => {
  assertQbPushAllowed(request);
  assertQbBillPushEnvironment();

  const { projectId, docId, syncPayments, paymentOnly, markPaid } = request.data || {};
  if (syncPayments || paymentOnly || markPaid) {
    throw new HttpsError(
      "failed-precondition",
      "Bill-only workflow: vendor bill lines only. Studio payment/paid status is never pushed to QuickBooks."
    );
  }
  if (!projectId || !docId) {
    throw new HttpsError("invalid-argument", "projectId and docId required");
  }

  const docRef = db.collection("boards").doc(projectId).collection("purchaseOrders").doc(docId);
  const snap = await docRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "PO not found");
  const po = snap.data();
  const bill = po.bill || {};

  const vendorName = String(bill.billFromVendor || po.vendor || po.vendorName || "").trim();
  if (!vendorName) {
    throw new HttpsError("failed-precondition", "Vendor name is required on the PO (or Bill from on the vendor bill).");
  }
  const billTotal = Math.round((parseFloat(bill.billTotal) || 0) * 100) / 100;
  if (billTotal <= 0.01) {
    throw new HttpsError(
      "failed-precondition",
      "Vendor bill total is required before pushing to QuickBooks. Receive the vendor bill in Studio and enter the total first."
    );
  }

  const pushState = await beginQbBillPush(docRef);

  try {
    const { accessToken, realmId } = await getQBAccessToken();
    const vendorId = await resolveQbVendorIdForPush(accessToken, realmId, vendorName);
    const poNum = po.number || po.num || po.poNum || docId.slice(0, 10);

    let customerId = null;
    try {
      const projRef = db.collection("boards").doc(projectId);
      const projSnap = await projRef.get();
      const proj = projSnap.exists ? projSnap.data() : {};
      customerId = await resolveQbCustomerIdForPush(
        accessToken,
        realmId,
        qbCustomerDisplayNameCandidates(proj, null, projectId),
        proj.clientEmail || "",
        projRef,
        proj
      );
    } catch (custErr) {
      console.warn("[pushBillToQB] customer match skipped:", custErr && custErr.message ? custErr.message : custErr);
    }

    const { lineItems, txnDate, docNumber, privateNote } = buildVendorBillQbLineItems(po, bill, { customerId });
    const docNumberCandidates = qbBillDocNumberCandidates(poNum);

    if (!lineItems.length) {
      throw new HttpsError("failed-precondition", "Vendor bill has no billable lines to push.");
    }

    let qbBillId;
    let message;
    let wasUpdate = false;
    let linkedExisting = false;

    const existingResult = await fetchQBBillForStudioPush(
      accessToken, realmId, pushState, docNumberCandidates
    );

    if (existingResult) {
      wasUpdate = true;
      linkedExisting = existingResult.linkedExisting;
      const existing = existingResult.bill;
      const qbBillPayload = {
        Id: existing.Id,
        SyncToken: existing.SyncToken,
        sparse: true,
        Line: lineItems,
        VendorRef: existing.VendorRef || { value: vendorId },
        DocNumber: docNumber,
        TxnDate: txnDate || existing.TxnDate,
        PrivateNote: privateNote + " · Project " + projectId
      };
      const result = await qbApiCall("POST", "bill", accessToken, realmId, qbBillPayload);
      qbBillId = result.Bill && result.Bill.Id;
      if (!qbBillId) {
        throw new HttpsError("internal", "QuickBooks did not return a Bill Id after update.");
      }
      message = linkedExisting
        ? "Linked to existing QuickBooks Bill " + docNumber + " and updated to vendor bill total"
        : "QuickBooks Bill updated to vendor bill total";
    } else {
      const qbBillPayload = {
        Line: lineItems,
        VendorRef: { value: vendorId },
        DocNumber: docNumber,
        TxnDate: txnDate,
        PrivateNote: privateNote + " · Project " + projectId
      };
      const result = await qbApiCall("POST", "bill", accessToken, realmId, qbBillPayload);
      qbBillId = result.Bill && result.Bill.Id;
      if (!qbBillId) {
        throw new HttpsError("internal", "QuickBooks did not return a Bill Id.");
      }
      message = "Vendor bill pushed to QuickBooks as " + docNumber;
    }

    const ts = new Date().toISOString();
    const storedDocNumber = existingResult && existingResult.bill && existingResult.bill.DocNumber
      ? String(existingResult.bill.DocNumber)
      : docNumber;
    const patch = {
      "bill.qbBillId": String(qbBillId),
      "bill.qbSyncedAt": ts,
      "bill.qbSyncedTotal": billTotal,
      "bill.qbDocNumber": storedDocNumber,
      "bill.qbPushLockAt": admin.firestore.FieldValue.delete(),
      lastQbBillPushAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (linkedExisting) patch["bill.qbLinkedExisting"] = true;
    else patch["bill.qbLinkedExisting"] = admin.firestore.FieldValue.delete();
    await docRef.update(patch);

    return {
      success: true,
      qbBillId: String(qbBillId),
      qbDocNumber: storedDocNumber,
      message,
      updated: wasUpdate,
      linkedExisting
    };
  } catch (err) {
    await clearQbBillPushLock(docRef);
    throw err;
  }
});

// ─── DELETE FROM QB (when deleted in Studio) ─────────────────────
exports.deleteFromQB = onCall(QB_CALLABLE, async (request) => {
  assertQbAdmin(request);

  const { qbDocId, docType } = request.data || {}; // docType: "invoice" or "purchaseorder"
  if (!qbDocId || !docType) {
    throw new HttpsError("invalid-argument", "qbDocId and docType required");
  }

  const { accessToken, realmId } = await getQBAccessToken();

  // QB requires SyncToken for delete — fetch the entity first
  const entityType = docType === "invoice" ? "Invoice" : "PurchaseOrder";
  const endpoint = docType === "invoice" ? "invoice" : "purchaseorder";
  const fetched = await qbApiCall("GET", `${endpoint}/${qbDocId}`, accessToken, realmId);
  const entity = fetched[entityType];

  if (!entity) {
    throw new HttpsError("not-found", "QB document not found: " + qbDocId);
  }

  // QB delete = POST with Id + SyncToken + operation=delete
  await qbApiCall("POST", `${endpoint}?operation=delete`, accessToken, realmId, {
    Id: qbDocId,
    SyncToken: entity.SyncToken
  });

  return { success: true, deleted: qbDocId };
  }
);

// ─── SETUP STUDIO ACCOUNTS IN QB ─────────────────────────────────
exports.qbSetupAccounts = onCall(QB_CALLABLE, async (request) => {
  assertQbAdmin(request);

  const { accessToken, realmId } = await getQBAccessToken();

  const accounts = [
    // Income accounts
    { Name: "R1 - Studio Product Sales", AccountType: "Income", AccountSubType: "SalesOfProductIncome" },
    { Name: "R2 - Studio Design Fees", AccountType: "Income", AccountSubType: "ServiceFeeIncome" },
    { Name: "R3 - Studio Shipping", AccountType: "Income", AccountSubType: "OtherPrimaryIncome" },
    { Name: "R4 - Studio Prepaid Tax", AccountType: "Income", AccountSubType: "OtherPrimaryIncome" },
    { Name: "R5 - Studio Reimbursable", AccountType: "Income", AccountSubType: "OtherPrimaryIncome" },
    // COGS accounts
    { Name: "C1 - Studio Product Cost", AccountType: "Cost of Goods Sold", AccountSubType: "SuppliesMaterialsCogs" },
    { Name: "C2 - Studio Freight/Shipping", AccountType: "Cost of Goods Sold", AccountSubType: "ShippingFreightDeliveryCos" },
    { Name: "C3 - Studio Sales Tax Paid", AccountType: "Cost of Goods Sold", AccountSubType: "OtherCostsOfServiceCos" },
    { Name: "C4 - Studio Subcontractors", AccountType: "Cost of Goods Sold", AccountSubType: "OtherCostsOfServiceCos" },
    { Name: "C5 - Studio Samples", AccountType: "Cost of Goods Sold", AccountSubType: "OtherCostsOfServiceCos" },
    { Name: "C6 - Cost of Labor", AccountType: "Cost of Goods Sold", AccountSubType: "OtherCostsOfServiceCos" }
  ];

  const created = [];
  const skipped = [];

  for (const acct of accounts) {
    // Check if already exists
    const query = `select * from Account where Name = '${acct.Name.replace(/'/g, "\\'")}'`;
    const search = await qbApiCall("GET", "query?query=" + encodeURIComponent(query), accessToken, realmId);
    if (search.QueryResponse && search.QueryResponse.Account && search.QueryResponse.Account.length > 0) {
      skipped.push({ name: acct.Name, id: search.QueryResponse.Account[0].Id });
      continue;
    }

    const result = await qbApiCall("POST", "account", accessToken, realmId, acct);
    created.push({ name: acct.Name, id: result.Account.Id });
  }

  // Save account IDs to Firestore for use in push functions
  const accountMap = {};
  for (const a of [...created, ...skipped]) {
    const key = a.name.split(" - ")[0].trim(); // R1, R2, C1, etc.
    accountMap[key] = a.id;
  }
  if (!accountMap.C6) {
    try {
      const laborQuery = "select Id, Name from Account where Name like '%Cost of Labor%' MAXRESULTS 5";
      const laborSearch = await qbApiCall("GET", "query?query=" + encodeURIComponent(laborQuery), accessToken, realmId);
      const laborHits = (laborSearch.QueryResponse && laborSearch.QueryResponse.Account) || [];
      if (laborHits.length) {
        accountMap.C6 = laborHits[0].Id;
        skipped.push({ name: laborHits[0].Name + " (linked as C6)", id: laborHits[0].Id });
      }
    } catch (e) {
      console.warn("[qbSetupAccounts] C6 Cost of Labor lookup:", e && e.message);
    }
  }
  await db.collection("admin").doc("qb").update({ accountMap });

  return { success: true, created, skipped, accountMap };
  }
);

// ─── QB WEBHOOK (payments → Studio invoices/POs, activity feed, Teams) ──
const STUDIO_APP_URL = "https://cch-platform.web.app";

function projectIdFromBoardSubdocRef(docRef) {
  const parts = String(docRef.path || "").split("/");
  return parts[0] === "boards" && parts.length >= 2 ? parts[1] : "";
}

function studioDocRefTotal(existing) {
  return parseFloat(existing.total || existing.amount || 0) || 0;
}

async function loadTeamsIntegrations() {
  try {
    const snap = await db.collection("settings").doc("integrations").get();
    return snap.exists ? snap.data() || {} : {};
  } catch (e) {
    return {};
  }
}

function getTeamsWebhookForType(integrations, type) {
  const ch = integrations || {};
  if ((type === "payment" || type === "qb_sync") && ch.teamsPaymentsWebhook) {
    return String(ch.teamsPaymentsWebhook).trim();
  }
  if (
    (type === "invoice" || type === "proposal" || type === "po" || type === "payment") &&
    ch.teamsFinancialsWebhook
  ) {
    return String(ch.teamsFinancialsWebhook).trim();
  }
  return String(ch.teamsWebhookUrl || "").trim();
}

async function postTeamsAdaptiveCard(webhookUrl, title, body, linkUrl) {
  if (!webhookUrl) return;
  const card = {
    type: "message",
    attachments: [{
      contentType: "application/vnd.microsoft.card.adaptive",
      contentUrl: null,
      content: {
        $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
        type: "AdaptiveCard",
        version: "1.4",
        body: [
          { type: "TextBlock", text: title, weight: "Bolder", size: "Medium", wrap: true },
          { type: "TextBlock", text: body, wrap: true, spacing: "Small" },
          {
            type: "TextBlock",
            text: new Date().toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit"
            }),
            size: "Small",
            isSubtle: true,
            spacing: "Small"
          }
        ],
        actions: linkUrl
          ? [{ type: "Action.OpenUrl", title: "View in CCH Studio", url: linkUrl }]
          : []
      }
    }]
  };
  const resp = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(card)
  });
  if (!resp.ok) {
    console.warn("[qbWebhook] Teams HTTP", resp.status);
  }
}

async function recordQbPaymentStudioSideEffects(opts) {
  const { projectId, collection, docId, docLabel, amount, newStatus, qbPaymentId, paymentStatus } = opts;
  if (!projectId || !collection || !docId) return;

  const ts = new Date().toISOString();
  const wasPaid =
    newStatus === "Paid" || String(paymentStatus || "").toLowerCase() === "paid";
  let projectName = projectId;
  try {
    const bSnap = await db.collection("boards").doc(projectId).get();
    if (bSnap.exists) projectName = bSnap.data().name || projectId;
  } catch (e) { /* ignore */ }

  const activityEntry = {
    action: wasPaid ? "paid" : "payment_recorded",
    details:
      (wasPaid ? "Paid via QuickBooks: " : "Payment from QuickBooks: ") +
      docLabel +
      (amount > 0 ? " · $" + amount.toFixed(2) : ""),
    userName: "QuickBooks",
    userEmail: "qb-webhook@cchdesign.com",
    timestamp: ts
  };

  await db
    .collection("boards")
    .doc(projectId)
    .collection(collection)
    .doc(docId)
    .update({
      activityLog: admin.firestore.FieldValue.arrayUnion(activityEntry),
      lastQbWebhookAt: admin.firestore.FieldValue.serverTimestamp()
    })
    .catch((e) => console.warn("[qbWebhook] doc activityLog", e.message));

  const typeLabel = collection === "purchaseOrders" ? "PO" : "Invoice";
  const desc =
    typeLabel +
    " " +
    docLabel +
    (wasPaid ? " marked Paid in QuickBooks" : " — payment recorded in QuickBooks") +
    (amount > 0 ? " · $" + amount.toFixed(2) : "") +
    " — " +
    projectName;

  await db
    .collection("activity")
    .add({
      type: collection === "purchaseOrders" ? "po" : "invoice",
      action: wasPaid ? "paid" : "payment_recorded",
      description: desc,
      projectId,
      projectName,
      user: "qb-webhook",
      timestamp: ts,
      createdAt: ts,
      meta: { docId, collection, qbPaymentId: qbPaymentId || "", source: "qb-webhook" }
    })
    .catch((e) => console.warn("[qbWebhook] activity collection", e.message));

  const integrations = await loadTeamsIntegrations();
  const webhookUrl = getTeamsWebhookForType(integrations, "payment");
  const link = STUDIO_APP_URL + "/#/project/" + encodeURIComponent(projectId);
  await postTeamsAdaptiveCard(
    webhookUrl,
    wasPaid ? "💳 Paid in QuickBooks" : "💳 QuickBooks payment",
    desc,
    link
  ).catch((e) => console.warn("[qbWebhook] Teams", e.message));
}

async function findStudioInvoiceByQbTxnId(qbInvoiceTxnId) {
  const id = String(qbInvoiceTxnId || "").trim();
  if (!id) return null;
  const q = await db.collectionGroup("invoices").where("qbDocId", "==", id).limit(1).get();
  return q.empty ? null : q.docs[0];
}

async function findStudioPoByQbTxnId(qbPoTxnId) {
  const id = String(qbPoTxnId || "").trim();
  if (!id) return null;
  const q = await db.collectionGroup("purchaseOrders").where("qbDocId", "==", id).limit(1).get();
  return q.empty ? null : q.docs[0];
}

async function findStudioPoByQbBillId(qbBillTxnId) {
  const id = String(qbBillTxnId || "").trim();
  if (!id) return null;
  const q = await db.collectionGroup("purchaseOrders").where("bill.qbBillId", "==", id).limit(1).get();
  return q.empty ? null : q.docs[0];
}

/** BillPayment cleared in QB → update Studio PO (match on bill.qbBillId, not PO). */
async function applyQbBillPaymentToStudioPo(poDoc, opts) {
  const { lineAmt, entity, bp, qbBillId } = opts;
  const existing = poDoc.data();
  const clearedExisting = existing.paymentCleared || {};
  if (
    clearedExisting.qbBillPaymentId &&
    String(clearedExisting.qbBillPaymentId) === String(entity.id)
  ) {
    return;
  }

  const payments = Array.isArray(existing.payments) ? existing.payments.slice() : [];
  const fingerprint =
    "bp|" + String(entity.id) + "|" + String(qbBillId) + "|" + String(Math.round(lineAmt * 100) / 100);
  if (payments.some((p) => String(p.qbPaymentLineKey || "") === fingerprint)) {
    return;
  }

  payments.push({
    amount: lineAmt,
    date: bp.TxnDate,
    method: "QuickBooks",
    note: "Vendor payment (BillPayment) matched to Studio bill",
    qbPaymentId: entity.id,
    qbBillId: String(qbBillId),
    qbPaymentLineKey: fingerprint
  });

  const billTotal =
    (existing.bill && parseFloat(existing.bill.billTotal)) ||
    parseFloat(existing.bill && existing.bill.poSubtotal) ||
    studioDocRefTotal(existing);
  const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
  const fullyPaid = billTotal > 0.01 && totalPaid >= billTotal - 0.02;
  const patch = {
    payments,
    paidAmount: fullyPaid && billTotal > 0.01 ? billTotal : totalPaid,
    paymentCount: payments.length,
    paymentStatus: fullyPaid ? "paid" : "partial",
    qbPaymentConfirmation:
      "QB BillPayment " + String(entity.id) + " · $" + lineAmt.toFixed(2)
  };
  if (fullyPaid) {
    patch.status = "Paid";
    patch.qbStatus = "paid";
  } else if (totalPaid > 0.02) {
    patch.qbStatus = "partial";
  }

  const clearedAt = new Date().toISOString();
  patch.paymentCleared = {
    amount: lineAmt,
    clearedAt,
    qbBillId: String(qbBillId),
    qbBillPaymentId: String(entity.id),
    qbTransactionId: String(bp.Id || entity.id)
  };
  patch.poStatus = "cleared";

  await poDoc.ref.update(patch);

  const projectId = projectIdFromBoardSubdocRef(poDoc.ref);
  const docLabel = existing.number || existing.num || existing.poNum || poDoc.id;

  await db
    .collection("boards")
    .doc(projectId)
    .collection("notifications")
    .add({
      type: "qb_payment_matched",
      poNumber: String(docLabel),
      poId: poDoc.id,
      projectId,
      amount: lineAmt,
      createdAt: clearedAt,
      seenBy: [],
      data: {
        vendor: existing.vendor || "",
        clearedAt,
        qbBillPaymentId: String(entity.id),
        qbBillId: String(qbBillId)
      }
    })
    .catch((e) => console.warn("[qbWebhook] qb_payment_matched notification", e.message));

  await recordQbPaymentStudioSideEffects({
    projectId,
    collection: "purchaseOrders",
    docId: poDoc.id,
    docLabel: String(docLabel),
    amount: lineAmt,
    newStatus: fullyPaid ? "Paid" : "Partially Paid",
    paymentStatus: patch.paymentStatus,
    qbPaymentId: entity.id
  });
}

async function refreshInvoiceBalanceFromQb(invDocRef, accessToken, realmId) {
  try {
    const snap = await invDocRef.get();
    if (!snap.exists) return null;
    const existing = snap.data();
    const { qbInv } = await fetchQBInvoiceForStudio(accessToken, realmId, existing);
    let qbPayRows = [];
    try {
      qbPayRows = await pullQbPaymentLinesForInvoice(accessToken, realmId, qbInv);
    } catch (e) {
      console.warn("[qbWebhook] payment pull", e.message);
    }
    const balancePatch = buildFirestorePatchFromQBInvoice(existing, qbInv, qbPayRows);
    if (Object.keys(balancePatch).length) {
      await invDocRef.update(balancePatch);
    }
    return balancePatch.status || existing.status;
  } catch (e) {
    console.warn("[qbWebhook] balance refresh", invDocRef.id, e.message);
    const snap = await invDocRef.get().catch(() => null);
    return snap && snap.exists ? snap.data().status : null;
  }
}

async function processQbCustomerPaymentEntity(entity, accessToken, realmId) {
  const payment = await qbApiCall("GET", "payment/" + entity.id, accessToken, realmId);
  const paymentData = payment.Payment;
  if (!paymentData) return;

  const lineList = paymentData.Line || [];
  for (const line of lineList) {
    if (!line.LinkedTxn || !line.LinkedTxn.length) continue;
    const invLinks = line.LinkedTxn.filter((t) => t.TxnType === "Invoice");
    if (!invLinks.length) continue;

    const lineAmtRaw = parseFloat(line.Amount);
    const lineAmt = Number.isFinite(lineAmtRaw) && lineAmtRaw > 0
      ? lineAmtRaw
      : lineList.length === 1
        ? parseFloat(paymentData.TotalAmt) || 0
        : 0;
    const perInvoice =
      invLinks.length === 1
        ? lineAmt
        : lineAmt / invLinks.length;

    for (const txn of invLinks) {
      const invDoc = await findStudioInvoiceByQbTxnId(txn.TxnId);
      if (!invDoc) {
        console.warn("[qbWebhook] No Studio invoice for QB Invoice Id", txn.TxnId);
        continue;
      }

      const existing = invDoc.data();
      const payments = Array.isArray(existing.payments) ? existing.payments.slice() : [];
      const lineFingerprint = qbInvoicePaymentLineKey(entity.id, txn.TxnId, perInvoice);
      if (payments.some((p) => String(p.qbPaymentLineKey || "") === lineFingerprint)) {
        continue;
      }
      if (payments.some((p) => qbInvoicePaymentDedupeKey(p) === qbInvoicePaymentDedupeKey({
        qbPaymentId: entity.id,
        qbInvoiceTxnId: String(txn.TxnId),
        amount: perInvoice,
        date: paymentData.TxnDate
      }))) {
        continue;
      }

      payments.push({
        amount: perInvoice,
        date: paymentData.TxnDate,
        method: paymentData.PaymentMethodRef
          ? paymentData.PaymentMethodRef.name
          : "QB Payment",
        note: "Auto-synced from QuickBooks",
        qbPaymentId: entity.id,
        qbInvoiceTxnId: String(txn.TxnId),
        qbPaymentLineKey: lineFingerprint
      });

      const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      const total = studioDocRefTotal(existing);
      const newStatus = total > 0.01 && totalPaid >= total - 0.02 ? "Paid" : "Partially Paid";
      const qbStatus = newStatus === "Paid" ? "paid" : "partial";
      const patch = {
        payments,
        status: newStatus,
        qbStatus,
        paidAmount: newStatus === "Paid" && total > 0.01 ? total : totalPaid,
        paymentCount: payments.length,
        qbPaymentConfirmation:
          "QB payment " +
          String(entity.id) +
          " · $" +
          (perInvoice || 0).toFixed(2) +
          " on " +
          (paymentData.TxnDate || "")
      };
      if (newStatus === "Paid" && !existing.datePaid) {
        patch.datePaid =
          (paymentData.TxnDate && String(paymentData.TxnDate).slice(0, 10)) ||
          new Date().toISOString().slice(0, 10);
      }

      await invDoc.ref.update(patch);
      const finalStatus = await refreshInvoiceBalanceFromQb(invDoc.ref, accessToken, realmId);

      const projectId = projectIdFromBoardSubdocRef(invDoc.ref);
      const docLabel =
        existing.invoiceNum || existing.number || existing.displayNumber || invDoc.id;
      await recordQbPaymentStudioSideEffects({
        projectId,
        collection: "invoices",
        docId: invDoc.id,
        docLabel: String(docLabel),
        amount: perInvoice,
        newStatus: finalStatus || newStatus,
        qbPaymentId: entity.id
      });
    }
  }
}

async function processQbBillPaymentEntity(entity, accessToken, realmId) {
  const bpResp = await qbApiCall("GET", "billpayment/" + entity.id, accessToken, realmId);
  const bp = bpResp.BillPayment;
  if (!bp) return;

  const seenPo = new Set();
  for (const line of bp.Line || []) {
    const lineAmt = parseFloat(line.Amount) || parseFloat(bp.TotalAmt) || 0;
    for (const txn of line.LinkedTxn || []) {
      if (txn.TxnType !== "Bill") continue;

      let bill;
      try {
        const billResp = await qbApiCall("GET", "bill/" + txn.TxnId, accessToken, realmId);
        bill = billResp.Bill;
      } catch (e) {
        console.warn("[qbWebhook] Bill fetch", txn.TxnId, e.message);
        continue;
      }
      if (!bill) continue;

      const qbBillId = String(txn.TxnId);
      const poByStudioBill = await findStudioPoByQbBillId(qbBillId);
      if (poByStudioBill) {
        await applyQbBillPaymentToStudioPo(poByStudioBill, {
          lineAmt,
          entity,
          bp,
          qbBillId
        });
        continue;
      }

      const poLinks = (bill.LinkedTxn || []).filter((t) => t.TxnType === "PurchaseOrder");
      for (const poTxn of poLinks) {
        const poQbId = String(poTxn.TxnId);
        if (seenPo.has(poQbId)) continue;
        seenPo.add(poQbId);

        const poDoc = await findStudioPoByQbTxnId(poQbId);
        if (!poDoc) {
          console.warn("[qbWebhook] No Studio PO for QB PO Id", poQbId);
          continue;
        }

        const existing = poDoc.data();
        const clearedExisting = existing.paymentCleared || {};
        if (
          clearedExisting.qbBillPaymentId &&
          String(clearedExisting.qbBillPaymentId) === String(entity.id)
        ) {
          continue;
        }

        const payments = Array.isArray(existing.payments) ? existing.payments.slice() : [];
        const fingerprint =
          "bp|" + String(entity.id) + "|" + poQbId + "|" + String(Math.round(lineAmt * 100) / 100);
        if (payments.some((p) => String(p.qbPaymentLineKey || "") === fingerprint)) {
          continue;
        }

        payments.push({
          amount: lineAmt,
          date: bp.TxnDate,
          method: "QuickBooks",
          note: "Vendor payment (BillPayment) from QuickBooks",
          qbPaymentId: entity.id,
          qbBillId: String(txn.TxnId),
          qbPaymentLineKey: fingerprint
        });

        const totalPaid = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
        const total = studioDocRefTotal(existing);
        const fullyPaid = total > 0.01 && totalPaid >= total - 0.02;
        const patch = {
          payments,
          paidAmount: fullyPaid && total > 0.01 ? total : totalPaid,
          paymentCount: payments.length,
          paymentStatus: fullyPaid ? "paid" : "partial",
          qbPaymentConfirmation:
            "QB BillPayment " + String(entity.id) + " · $" + lineAmt.toFixed(2)
        };
        if (fullyPaid) {
          patch.status = "Paid";
          patch.qbStatus = "paid";
        } else if (totalPaid > 0.02) {
          patch.qbStatus = "partial";
        }

        const clearedAt = new Date().toISOString();
        patch.paymentCleared = {
          amount: lineAmt,
          clearedAt,
          qbBillId: String(txn.TxnId),
          qbBillPaymentId: String(entity.id),
          qbTransactionId: String(bp.Id || entity.id)
        };
        patch.poStatus = "cleared";

        await poDoc.ref.update(patch);

        const projectId = projectIdFromBoardSubdocRef(poDoc.ref);
        const docLabel = existing.number || existing.num || existing.poNum || poDoc.id;

        const notifTs = clearedAt;
        await db
          .collection("boards")
          .doc(projectId)
          .collection("notifications")
          .add({
            type: "qb_payment_matched",
            poNumber: String(docLabel),
            poId: poDoc.id,
            projectId,
            amount: lineAmt,
            createdAt: notifTs,
            seenBy: [],
            data: {
              vendor: existing.vendor || "",
              clearedAt,
              qbBillPaymentId: String(entity.id),
              qbBillId: String(txn.TxnId)
            }
          })
          .catch((e) => console.warn("[qbWebhook] qb_payment_matched notification", e.message));

        await recordQbPaymentStudioSideEffects({
          projectId,
          collection: "purchaseOrders",
          docId: poDoc.id,
          docLabel: String(docLabel),
          amount: lineAmt,
          newStatus: fullyPaid ? "Paid" : "Partially Paid",
          paymentStatus: patch.paymentStatus,
          qbPaymentId: entity.id
        });
      }
    }
  }
}

async function processQbPurchaseOrderClosed(entity, accessToken, realmId) {
  const poResp = await qbApiCall("GET", "purchaseorder/" + entity.id, accessToken, realmId);
  const qpo = poResp.PurchaseOrder;
  if (!qpo) return;

  const closed =
    qpo.POStatus === "Closed" ||
    qpo.POStatus === "Received" ||
    parseFloat(qpo.Balance || qpo.TotalAmt) <= 0.02;
  if (!closed) return;

  const poDoc = await findStudioPoByQbTxnId(String(qpo.Id));
  if (!poDoc) return;

  const existing = poDoc.data();
  const total = studioDocRefTotal(existing) || parseFloat(qpo.TotalAmt) || 0;
  const patch = {
    status: "Paid",
    qbStatus: "paid",
    paymentStatus: "paid",
    paidAmount: total > 0.01 ? total : parseFloat(existing.paidAmount) || 0,
    qbPaymentConfirmation: "QB PO " + String(qpo.POStatus || "closed") + " in QuickBooks"
  };
  if (!existing.datePaid && qpo.TxnDate) {
    patch.datePaid = String(qpo.TxnDate).slice(0, 10);
  }

  await poDoc.ref.update(patch);

  const projectId = projectIdFromBoardSubdocRef(poDoc.ref);
  const docLabel = existing.number || existing.num || existing.poNum || poDoc.id;
  await recordQbPaymentStudioSideEffects({
    projectId,
    collection: "purchaseOrders",
    docId: poDoc.id,
    docLabel: String(docLabel),
    amount: patch.paidAmount,
    newStatus: "Paid",
    paymentStatus: "paid",
    qbPaymentId: "po-" + String(entity.id)
  });
}

exports.qbWebhook = onRequest(QB_HTTP, async (req, res) => {
  // Intuit webhook URL verification (challenge echo)
  const challenge = req.query && (req.query.challenge || req.query.verifier);
  if (challenge) {
    res.status(200).send(String(challenge));
    return;
  }

  if (req.method === "GET") {
    res.status(200).send("OK");
    return;
  }

  if (req.method !== "POST") {
    res.status(200).send("OK");
    return;
  }

  const body = req.body;
  if (!body || !body.eventNotifications) {
    res.status(200).send("OK");
    return;
  }

  let accessToken;
  let realmId;
  try {
    const tok = await getQBAccessToken();
    accessToken = tok.accessToken;
    realmId = tok.realmId;
  } catch (e) {
    console.error("[qbWebhook] QB auth failed:", e);
    res.status(200).send("OK");
    return;
  }

  for (const notification of body.eventNotifications) {
    for (const entity of (notification.dataChangeEvent || {}).entities || []) {
      const op = entity.operation;
      const isCreateOrUpdate = op === "Create" || op === "Update";

      try {
        if (entity.name === "Payment" && isCreateOrUpdate) {
          await processQbCustomerPaymentEntity(entity, accessToken, realmId);
        } else if (entity.name === "BillPayment" && isCreateOrUpdate) {
          await processQbBillPaymentEntity(entity, accessToken, realmId);
        } else if (entity.name === "PurchaseOrder" && isCreateOrUpdate) {
          await processQbPurchaseOrderClosed(entity, accessToken, realmId);
        }
      } catch (e) {
        console.error("[qbWebhook]", entity.name, entity.id, op, e);
      }
    }
  }

  res.status(200).send("OK");
});

// ══════════════════════════════════════════════════════════
// SEARCH INDEX + FINANCIAL SUMMARY — Denormalized for speed
// ══════════════════════════════════════════════════════════

// Callable via button in platform or scheduled
exports.rebuildSearchIndex = onRequest(HTTP_STUDIO, async (req, res) => {
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
      const addrBits = [data.projectAddress, data.address, data.city, data.state, data.zip, data.phone].filter(Boolean).join(" ");
      const notesBit = String(data.notes || data.description || "").slice(0, 500);
      allItems.push({
        type: "project", id: d.id, projectId: d.id,
        title: data.name || d.id,
        subtitle: data.clientName || "",
        status: data.status || "",
        amount: parseFloat(data.designFee || data.fee || data.budget) || 0,
        vendor: "",
        number: "",
        search: [data.name, data.clientName, addrBits, notesBit, data.status, data.slug, d.id].filter(Boolean).join(" ").toLowerCase()
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
exports.rebuildFinancialSummary = onRequest(HTTP_STUDIO, async (req, res) => {
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

// ─── PUSH POs → Airtable (CCH Delivery Receiving base) ─────────
const { pushPOsToAirtable: runAirtablePoPush } = require("./lib/airtable-po-push.js");

const AIRTABLE_SECRET_NAMES = ["AIRTABLE_PAT"];
const AIRTABLE_CALLABLE = {
  region: REGION,
  secrets: AIRTABLE_SECRET_NAMES,
  timeoutSeconds: 540,
  memory: "512MiB",
  invoker: "public"
};

function assertAirtablePushAllowed(request) {
  assertQbPushAllowed(request);
}

exports.pushPOsToAirtable = onCall(AIRTABLE_CALLABLE, async (request) => {
  assertAirtablePushAllowed(request);

  const pat = String(process.env.AIRTABLE_PAT || "").trim();
  if (!pat) {
    throw new HttpsError(
      "failed-precondition",
      "Airtable is not configured. Set the AIRTABLE_PAT secret on this Firebase project."
    );
  }

  const data = request.data || {};
  const scope = String(data.scope || "po").toLowerCase();
  const projectId = data.projectId ? String(data.projectId).trim() : "";
  const poId = data.poId ? String(data.poId).trim() : "";

  if (scope !== "po" && scope !== "project" && scope !== "firm") {
    throw new HttpsError("invalid-argument", 'scope must be "po", "project", or "firm"');
  }
  if ((scope === "po" || scope === "project") && !projectId) {
    throw new HttpsError("invalid-argument", "projectId is required for this scope");
  }
  if (scope === "po" && !poId) {
    throw new HttpsError("invalid-argument", "poId is required for scope po");
  }

  try {
    const result = await runAirtablePoPush({
      db,
      storage: admin.storage(),
      pat,
      scope,
      projectId: projectId || undefined,
      poId: poId || undefined,
      dryRun: false
    });
    return {
      success: true,
      pos: result.pos,
      lines: result.lines,
      imagesAttached: result.imagesAttached,
      imagesSkipped: result.imagesSkipped,
      message: "Pushed " + result.pos + " PO" + (result.pos !== 1 ? "s" : "") +
        " (" + result.lines + " line" + (result.lines !== 1 ? "s" : "") + ") to Airtable."
    };
  } catch (err) {
    const msg = (err && err.message) ? String(err.message) : String(err);
    if (/Airtable 422/.test(msg)) {
      throw new HttpsError(
        "invalid-argument",
        "Airtable rejected a field — check column names match the receiving base. " + msg.slice(0, 240)
      );
    }
    if (/not found/i.test(msg)) {
      throw new HttpsError("not-found", msg.slice(0, 300));
    }
    console.error("[pushPOsToAirtable]", msg);
    throw new HttpsError("internal", msg.slice(0, 500));
  }
});

/** AI invoice summary — requires ANTHROPIC_API_KEY secret on this Firebase project. */
exports.draftInvoiceSummary = require("./aiInvoiceSummary").draftInvoiceSummary;
