/**
 * Fix-It bot — AI first-responder for Bugs & Requests threads (WO-025).
 * Guide + triage only; posts assistant reply into feedbackRequests/{id}/messages.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const voice = require("./cchVoiceProfile");
const { FIXIT_KNOWLEDGE } = require("./cchFixItKnowledge");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

const REGION = "us-central1";
const MODEL = "claude-sonnet-4-6";

const FIXIT_TEAM_EMAILS = [
  "cindy@cchdesign.com",
  "cynthia@cchdesign.com",
  "cynthiacbh@gmail.com",
  "vanessa@cchdesign.com",
  "vanessaholliday@cchdesign.com",
  "vholliday@cchdesign.com",
];

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

function assertFixItTeam(request) {
  if (!request || !request.auth) {
    throw new HttpsError("unauthenticated", "Sign in to use Fix-It.");
  }
  const email = String(request.auth.token.email || "").toLowerCase().trim();
  if (!FIXIT_TEAM_EMAILS.includes(email)) {
    throw new HttpsError("permission-denied", "Fix-It is for CCH team members only.");
  }
  return email;
}

function buildSystemPrompt() {
  return [
    "You are the CCH Fix-It Assistant inside Bugs & Requests for CCH Design Inc.",
    "Your job: unblock Vanessa and Cindy with how-tos, workarounds, and triage. You do NOT change data.",
    "Voice: warm, plain, short sentences. No em dashes. No agency-speak. No financial details (margins, PO costs, rates).",
    "",
    "KNOWLEDGE BASE:",
    FIXIT_KNOWLEDGE,
    "",
    "When the user reports a problem:",
    "1. Acknowledge in one sentence.",
    "2. If you know a workaround from the knowledge base, give numbered steps.",
    "3. If it looks like a code defect, say Cindy will track it; simple bugs ship to production, features go staging first.",
    "4. Ask at most ONE clarifying question if needed (which project, which invoice #, steps to reproduce).",
    "5. Never pretend you fixed Firestore, synced QuickBooks, or deployed code.",
    "",
    "Return ONLY valid JSON:",
    '{"reply":"...","classification":"Bug|Feature|HowTo|KnownIssue|Question","suggestedPriority":"Low|Medium|High|Critical","escalate":true|false,"escalationNote":"short note for Cindy or empty string"}',
  ].join("\n");
}

function parseBotJson(text) {
  const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const parsed = JSON.parse(jsonStr);
  return {
    reply: voice.sanitizeCchVoice(String(parsed.reply || "").trim()),
    classification: String(parsed.classification || "Question").trim(),
    suggestedPriority: String(parsed.suggestedPriority || "Medium").trim(),
    escalate: !!parsed.escalate,
    escalationNote: voice.sanitizeCchVoice(String(parsed.escalationNote || "").trim()),
  };
}

function normalizeUnreadBy(obj) {
  return { owner: !!(obj && obj.owner), vanessa: !!(obj && obj.vanessa) };
}

exports.cchFixItBot = onCall(
  { region: REGION, invoker: "public", secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 60 },
  async (request) => {
    assertFixItTeam(request);
    const data = request.data || {};
    const requestId = String(data.requestId || "").trim();
    const trigger = String(data.trigger || "new").trim();
    if (!requestId) {
      throw new HttpsError("invalid-argument", "requestId is required.");
    }

    const reqRef = db.collection("feedbackRequests").doc(requestId);
    const reqSnap = await reqRef.get();
    if (!reqSnap.exists) {
      throw new HttpsError("not-found", "Request not found.");
    }
    const reqData = reqSnap.data() || {};

    const msgsSnap = await reqRef.collection("messages").orderBy("createdAt", "asc").get();
    const messages = [];
    msgsSnap.forEach((d) => messages.push({ id: d.id, ...d.data() }));

    if (trigger === "new") {
      const hasAssistant = messages.some((m) => m.authorRole === "assistant");
      if (hasAssistant) {
        return { ok: true, skipped: true, reason: "assistant_exists" };
      }
    }

    if (trigger === "reply") {
      const last = messages[messages.length - 1];
      if (!last || last.authorRole === "assistant") {
        return { ok: true, skipped: true, reason: "no_user_reply" };
      }
      const recentAssistant = messages.slice(-3).some((m) => m.authorRole === "assistant");
      const lastAt = last.createdAt ? new Date(last.createdAt).getTime() : 0;
      if (recentAssistant && Date.now() - lastAt < 15000) {
        return { ok: true, skipped: true, reason: "recent_assistant" };
      }
    }

    const threadLines = messages.map((m) => {
      const role = m.authorRole === "assistant" ? "Assistant" : (m.authorName || m.authorRole || "User");
      return role + ": " + String(m.text || "").trim();
    });

    const userMsg = [
      "Trigger: " + trigger,
      "Report type: " + (reqData.type || "Bug"),
      "Module: " + (reqData.module || (reqData.context && reqData.context.pageLabel) || "Studio"),
      "Title: " + (reqData.title || ""),
      "Description: " + (reqData.description || ""),
      "Status: " + (reqData.status || "New"),
      "Priority: " + (reqData.priority || "Medium"),
      "",
      "Thread:",
      threadLines.length ? threadLines.join("\n") : "(no messages yet)",
    ].join("\n");

    let resp;
    try {
      resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY.value(),
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 900,
          system: buildSystemPrompt(),
          messages: [{ role: "user", content: userMsg }],
        }),
      });
    } catch (e) {
      throw new HttpsError("unavailable", "Could not reach Fix-It service.");
    }

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      console.error("[cchFixItBot] Anthropic error", resp.status, t.slice(0, 500));
      throw new HttpsError("internal", "Fix-It service error " + resp.status);
    }

    const payload = await resp.json();
    const text = (((payload || {}).content || [])[0] || {}).text || "";

    let bot;
    try {
      bot = parseBotJson(text);
    } catch (e) {
      throw new HttpsError("internal", "Fix-It returned unparseable output.");
    }

    if (!bot.reply) {
      throw new HttpsError("internal", "Fix-It returned an empty reply.");
    }

    const now = new Date().toISOString();
    const creatorRole = String(reqData.createdByRole || "owner");
    const ub = normalizeUnreadBy(reqData.unreadBy);
    if (creatorRole === "owner" || creatorRole === "vanessa") {
      ub[creatorRole] = true;
    } else {
      ub.owner = true;
    }

    const metaUpdate = {
      lastMessage: {
        text: bot.reply.length > 100 ? bot.reply.slice(0, 99) + "…" : bot.reply,
        authorRole: "assistant",
        at: now,
      },
      updatedAt: now,
      received: true,
      unreadBy: ub,
      fixItClassification: bot.classification,
      fixItSuggestedPriority: bot.suggestedPriority,
      fixItEscalate: bot.escalate,
    };
    if (bot.escalationNote) metaUpdate.fixItEscalationNote = bot.escalationNote;
    if (trigger === "new" && bot.suggestedPriority && !reqData.priority) {
      metaUpdate.priority = bot.suggestedPriority;
    }

    await reqRef.collection("messages").add({
      authorRole: "assistant",
      authorName: "CCH Fix-It",
      authorEmail: "",
      text: bot.reply,
      createdAt: now,
      fixItMeta: {
        classification: bot.classification,
        suggestedPriority: bot.suggestedPriority,
        escalate: bot.escalate,
        escalationNote: bot.escalationNote || "",
      },
    });
    await reqRef.update(metaUpdate);

    return {
      ok: true,
      reply: bot.reply,
      classification: bot.classification,
      suggestedPriority: bot.suggestedPriority,
      escalate: bot.escalate,
    };
  }
);
