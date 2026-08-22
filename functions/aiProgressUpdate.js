/**
 * AI bi-weekly progress update draft — greeting + highlight + in-progress notes.
 * Voice: loop/CCH_VOICE_PROFILE_CW_Jul13.md (WO-029).
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const voice = require("./cchVoiceProfile");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

const REGION = "us-central1";
const MODEL = "claude-sonnet-4-6";

exports.draftProgressUpdate = onCall(
  { region: REGION, invoker: "public", secrets: [ANTHROPIC_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to draft an update.");
    }
    const data = request.data || {};
    const context = Array.isArray(data.contextNotes)
      ? data.contextNotes.map((n) => String(n || "").trim()).filter(Boolean)
      : [];

    const systemPrompt = voice.buildProgressSystemPrompt({
      clientFirstName: data.clientFirstName || voice.firstName(data.clientName),
      clientName: data.clientName,
      greetingStyle: data.greetingStyle,
      formalityGear: data.formalityGear,
    });

    const userMsg =
      "Project: " + (data.projectName || "Residence") + "\n" +
      "Period: " + (data.period || "this bi-weekly period") + "\n\n" +
      (context.length
        ? "Studio context (rooms, tasks, selections — use as source material, do not quote verbatim):\n- " + context.join("\n- ")
        : "No detailed context yet. Draft a warm placeholder update Cindy can edit, referencing general design progress.");

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
          max_tokens: 1200,
          system: systemPrompt,
          messages: [{ role: "user", content: userMsg }],
        }),
      });
    } catch (e) {
      throw new HttpsError("unavailable", "Could not reach the draft service.");
    }

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      console.error("[draftProgressUpdate] Anthropic error", resp.status, t.slice(0, 500));
      throw new HttpsError("internal", "Draft service error " + resp.status + " " + t.slice(0, 200));
    }

    const payload = await resp.json();
    const text = (((payload || {}).content || [])[0] || {}).text || "";

    let parsed;
    try {
      const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      throw new HttpsError("internal", "Draft service returned unparseable output.");
    }

    const clean = voice.sanitizeProgressDraft(parsed);
    return {
      greetingBody: String(clean.greetingBody || "").trim(),
      highlight: {
        heading: String((clean.highlight && clean.highlight.heading) || "").trim(),
        body: String((clean.highlight && clean.highlight.body) || "").trim(),
      },
      inProgress: Array.isArray(clean.inProgress)
        ? clean.inProgress.slice(0, 6).map((r) => ({
            room: String((r && r.room) || "").trim(),
            item: String((r && r.item) || "").trim(),
            note: String((r && r.note) || "").trim(),
          }))
        : [],
    };
  }
);
