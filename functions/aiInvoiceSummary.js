/**
 * AI invoice summary — drafts a client-facing narrative + grouped design outcomes
 * from raw time-ledger notes. The draft is editable by the user before sending.
 *
 * Gen2 callable. Requires secret ANTHROPIC_API_KEY (set per project):
 *   firebase functions:secrets:set ANTHROPIC_API_KEY --project staging
 *
 * Deploy:
 *   firebase deploy --only functions:draftInvoiceSummary --project staging
 *
 * Input  (request.data): { notes: string[], projectName?: string, period?: string }
 * Output: { summary: string, outcomes: [{ title, description, dateRange, hours }] }
 *
 * Display-only: this reads ledger note text passed from the client and returns text.
 * It does NOT write to Firestore, Product Library, or clips (document-isolation safe).
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

const REGION = "us-central1";
const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = [
  "You are the billing voice of CCH Design Inc., a luxury residential and yacht interior design firm.",
  "You turn a raw list of internal time-ledger notes into a client-facing invoice summary that communicates VALUE, not hours.",
  "Rules:",
  "- Never mention hours, rates, dollar amounts, or that this came from a time log.",
  "- Group the work into 2-5 design OUTCOMES (e.g. Construction Documentation, Lighting Design, Window Treatments, Space Planning & Millwork).",
  "- Each outcome: a short Title (2-4 words) and one elegant sentence describing what was accomplished and why it mattered to the project.",
  "- Write one short intro 'summary' sentence framing the month's work overall.",
  "- Warm, confident, understated luxury tone. No exclamation points. No filler.",
  "Return ONLY valid JSON, no prose, in this exact shape:",
  '{"summary":"...","outcomes":[{"title":"...","description":"..."}]}',
].join("\n");

exports.draftInvoiceSummary = onCall(
  { region: REGION, invoker: "public", secrets: [ANTHROPIC_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to draft a summary.");
    }
    const data = request.data || {};
    const notes = Array.isArray(data.notes)
      ? data.notes.map((n) => String(n || "").trim()).filter(Boolean)
      : [];
    if (!notes.length) {
      throw new HttpsError("invalid-argument", "No ledger notes provided to summarize.");
    }

    const userMsg =
      "Project: " + (data.projectName || "Residence") + "\n" +
      "Service period: " + (data.period || "this month") + "\n\n" +
      "Time-ledger notes (internal — do not quote verbatim):\n- " +
      notes.join("\n- ");

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
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userMsg }],
        }),
      });
    } catch (e) {
      throw new HttpsError("unavailable", "Could not reach the summary service.");
    }

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      console.error("[draftInvoiceSummary] Anthropic error", resp.status, t.slice(0, 500));
      throw new HttpsError("internal", "Summary service error " + resp.status + " " + t.slice(0, 200));
    }

    const payload = await resp.json();
    const text = (((payload || {}).content || [])[0] || {}).text || "";

    let parsed;
    try {
      const jsonStr = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      throw new HttpsError("internal", "Summary service returned unparseable output.");
    }

    return {
      summary: String(parsed.summary || "").trim(),
      outcomes: Array.isArray(parsed.outcomes)
        ? parsed.outcomes.slice(0, 6).map((o) => ({
            title: String((o && o.title) || "").trim(),
            description: String((o && o.description) || "").trim(),
            dateRange: String((o && o.dateRange) || "").trim(),
            hours: (o && o.hours != null) ? o.hours : "",
          }))
        : [],
    };
  }
);
