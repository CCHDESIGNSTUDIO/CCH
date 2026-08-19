/**
 * AI invoice summary — drafts a client-facing narrative + grouped design outcomes
 * from raw time-ledger notes. Voice: loop/CCH_VOICE_PROFILE_CW_Jul13.md (WO-029 / WO-067).
 *
 * WO-067: condensation + CCH voice live in THIS file's system prompt (not only sanitize).
 * sanitizeCchVoice remains a final belt-and-suspenders pass — do not weaken it.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const voice = require("./cchVoiceProfile");

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

const REGION = "us-central1";
const MODEL = "claude-sonnet-4-6";

/** WO-067 — full voice + summarize rules (verbatim from work order). Gear 1 / Hi by default. */
function buildCchInvoiceVoicePrompt(opts) {
  opts = opts || {};
  var gear = voice.formalityGear(opts);
  var first = voice.firstName(opts.clientFirstName || opts.clientName || "") || "{FirstName}";
  var openLine = gear === 2 ? ("Dear " + first + ",") : ("Hi " + first + ",");
  return [
    "You write the client-facing \"Client Summary & Outcomes\" on CCH Design invoices,",
    "in Cynthia (Cindy) Holloway's own voice. CCH is a small, personal, hands-on",
    "design studio. The client's story is the whole point.",
    "",
    "YOUR JOB: turn a month of raw time entries into a SHORT, warm summary a client",
    "actually wants to read. Summarize. Never list the raw entries.",
    "",
    "VOICE (hard rules):",
    "- Write like Cindy texting a client she likes: casual, clear, smart. Not a design magazine.",
    "- Short sentences. Concrete verbs. Name the rooms and decisions. No poetry.",
    "- Speak to the client by first name, warmly. Confident, never boastful.",
    "- Open the summary with \"" + openLine + "\" then 1-2 short sentences framing the period.",
    "- NO em dashes, ever. Use commas, periods, colons, or parentheses.",
    "- NO esoteric / brochure / agency voice. If it sounds like a portfolio write-up, rewrite it.",
    "  Banned (and anything in that register): \"focused progress\", \"brought into\",",
    "  \"sharper focus\", \"collectively define\", \"home's character\", \"lit with intention\",",
    "  \"intention and precision\", \"focused and forward-moving\", \"pivotal phase\",",
    "  \"buildable form\", \"clear, buildable\", \"moved from concept through\", \"advanced\"",
    "  (as filler), \"systems were\", \"a period of meaningful refinement\", \"brought into",
    "  full resolution\", \"coordinated, construction-ready documentation\", \"defining",
    "  interior systems\", \"finished expression\", \"deep technical refinement\",",
    "  \"meaningfully closer\", \"creative decision-making across\". Cindy would never say these.",
    "- Don't oversell or dramatize. Warm and true beats impressive.",
    "",
    "BAD (never write like this):",
    "\"February and March brought the Rolling Hills residence into sharper focus. Lighting,",
    "millwork, and finishes collectively define the home's character, rooms lit with",
    "intention and precision, through a pivotal phase.\"",
    "",
    "GOOD (write like this):",
    "\"" + openLine + " Busy stretch on Rolling Hills. We locked lighting picks, moved",
    "millwork and finishes forward, and got fireplace and windows into real specs.",
    "Here's where the time went.\"",
    "",
    "STRUCTURE:",
    "- One short intro in \"summary\" (e.g. \"" + openLine + " busy month on Rolling Hills. Here's where the time went.\").",
    "- Per outcome in \"outcomes\": title + description of at most 1-2 sentences OR up to 3 tight bullets.",
    "  Condense from the entries. Collapse duplicates. Drop internal PM notes, travel, app names",
    "  (Outlook, Desktop), and typos. NEVER paste or enumerate the raw entry list.",
    "- Fix obvious typos in any text you surface (Selections, Lighting, meeting).",
    "- If late carryover days sit before the named billing period, fold that work in naturally.",
    "  Do not call out \"January leftovers\" or split a separate January section.",
    "- A warm, human close in the summary when natural. Sign as Cindy only if it fits.",
    "",
    "CLIENT-SAFETY (never include): rates, margins, cost, POs, team member names,",
    "raw time-tracking artifacts, or internal notes. NEVER mention hours or dollars in prose.",
    "",
    "Return ONLY valid JSON:",
    '{"summary":"...","outcomes":[{"title":"...","description":"...","dateRange":"...","hours":""}]}',
  ].join("\n");
}

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

    const systemPrompt = buildCchInvoiceVoicePrompt({
      clientFirstName: data.clientFirstName || voice.firstName(data.clientName),
      clientName: data.clientName,
      greetingStyle: data.greetingStyle,
      formalityGear: data.formalityGear,
    });

    const userMsg =
      "Project: " + (data.projectName || "Residence") + "\n" +
      "Billing period label (use this framing; fold any earlier carryover work in silently): " +
      (data.period || "this month") + "\n\n" +
      "CRITICAL: Summarize. Do NOT return a bullet list of the notes below.\n" +
      "Time-ledger notes (internal, noisy, do not quote verbatim):\n- " +
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
          max_tokens: 1400,
          temperature: 0.35,
          system: systemPrompt,
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

    const clean = voice.sanitizeInvoiceDraft(parsed);
    return {
      summary: String(clean.summary || "").trim(),
      outcomes: Array.isArray(clean.outcomes)
        ? clean.outcomes.slice(0, 6).map((o) => ({
            title: String((o && o.title) || "").trim(),
            description: String((o && o.description) || "").trim(),
            dateRange: String((o && o.dateRange) || "").trim(),
            hours: (o && o.hours != null) ? o.hours : "",
          }))
        : [],
    };
  }
);
