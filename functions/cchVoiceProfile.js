/**
 * CCH voice rules for AI-generated client copy.
 * Source of truth: loop/CCH_VOICE_PROFILE_CW_Jul13.md
 */
const VOICE_SOURCE = "loop/CCH_VOICE_PROFILE_CW_Jul13.md";

const AGENCY_SPEAK_PATTERNS = [
  /a period of meaningful refinement/gi,
  /meaningful refinement/gi,
  /brought into full resolution/gi,
  /brought into clear,?\s*buildable form/gi,
  /brought the .+ into sharper focus/gi,
  /into sharper focus/gi,
  /sharper focus/gi,
  /brought into\b/gi,
  /clear,?\s*buildable form/gi,
  /collectively define(?:d)?/gi,
  /home'?s character/gi,
  /lit with intention(?: and precision)?/gi,
  /intention and precision/gi,
  /focused and forward-moving/gi,
  /pivotal phase/gi,
  /focused progress across/gi,
  /focused progress\b/gi,
  /moved from concept through/gi,
  /construction-ready documentation/gi,
  /coordinated,\s*construction-ready/gi,
  /architectural permanence/gi,
  /precision and intentionality/gi,
  /advancing the project from concept/gi,
  /the project demands/gi,
  /understated luxury/gi,
  /deep technical refinement/gi,
  /finished expression/gi,
];

function firstName(fullName) {
  var s = String(fullName || "").trim();
  if (!s) return "";
  return s.split(/\s+/)[0] || "";
}

function formalityGear(opts) {
  opts = opts || {};
  if (opts.formalityGear === 2 || opts.formalityGear === "2") return 2;
  if (String(opts.greetingStyle || "").toLowerCase() === "dear") return 2;
  return 1;
}

function sanitizeCchVoice(text) {
  var s = String(text == null ? "" : text);
  s = s.replace(/\u2014/g, ", ");
  s = s.replace(/—/g, ", ");
  AGENCY_SPEAK_PATTERNS.forEach(function (re) {
    s = s.replace(re, "");
  });
  s = s.replace(/\s+,/g, ",").replace(/,\s*,/g, ",").replace(/  +/g, " ").trim();
  return s;
}

function sanitizeInvoiceDraft(draft) {
  draft = draft || {};
  return {
    summary: sanitizeCchVoice(draft.summary),
    outcomes: Array.isArray(draft.outcomes)
      ? draft.outcomes.map(function (o) {
          o = o || {};
          return {
            title: sanitizeCchVoice(o.title),
            description: sanitizeCchVoice(o.description),
            dateRange: sanitizeCchVoice(o.dateRange),
            hours: o.hours != null ? o.hours : "",
          };
        })
      : [],
  };
}

function sanitizeProgressDraft(draft) {
  draft = draft || {};
  var hl = draft.highlight || {};
  return {
    greetingBody: sanitizeCchVoice(draft.greetingBody),
    highlight: {
      heading: sanitizeCchVoice(hl.heading),
      body: sanitizeCchVoice(hl.body),
    },
    inProgress: Array.isArray(draft.inProgress)
      ? draft.inProgress.map(function (r) {
          r = r || {};
          return {
            room: sanitizeCchVoice(r.room),
            item: sanitizeCchVoice(r.item),
            note: sanitizeCchVoice(r.note),
          };
        })
      : [],
  };
}

function buildInvoiceSystemPrompt(opts) {
  opts = opts || {};
  var gear = formalityGear(opts);
  var first = firstName(opts.clientFirstName || opts.clientName || "") || "{FirstName}";
  var openLine = gear === 2 ? ('Dear ' + first + ',') : ('Hi ' + first + ',');
  return [
    "You are Cynthia Holloway, principal designer at CCH Design Inc., writing client-facing invoice cover copy.",
    "Voice profile: " + VOICE_SOURCE + " (Gear " + gear + ").",
    "RULES:",
    "- Write in Cindy's voice: warm, plain-spoken, unpretentious, story-first. Say what actually happened.",
    "- Open the summary with \"" + openLine + "\" then 1-2 short sentences framing the period.",
    "- Group work into 2-5 design OUTCOMES (e.g. Millwork & Cabinetry, Lighting Design).",
    "- Each outcome description: plain language, short sentences. Bullets or bullet-style lines are welcome.",
    "- NEVER mention hours, rates, dollar amounts, margins, PO numbers, or that this came from a time log.",
    "- NEVER use em dashes. Use commas, periods, colons, or parentheses instead.",
    "- KILL agency-speak: never \"period of meaningful refinement,\" \"construction-ready documentation,\"",
    "  \"architectural permanence,\" \"brought into full resolution,\" \"precision and intentionality,\" or similar.",
    "- Warm close in summary when natural (e.g. \"Thanks as always,\" \"Love where this is headed.\"). Sign \"— Cindy\" only if it fits naturally.",
    "- No exclamation points. No filler.",
    "Return ONLY valid JSON:",
    '{"summary":"...","outcomes":[{"title":"...","description":"..."}]}',
  ].join("\n");
}

function buildProgressSystemPrompt(opts) {
  opts = opts || {};
  var gear = formalityGear(opts);
  var first = firstName(opts.clientFirstName || opts.clientName || "") || "{FirstName}";
  var openLine = gear === 2 ? ('Dear ' + first + ',') : ('Hi ' + first + ',');
  return [
    "You are Cynthia Holloway writing a bi-weekly client portal design update for CCH Design Inc.",
    "Voice profile: " + VOICE_SOURCE + " (Gear " + gear + ").",
    "RULES:",
    "- Warm, plain-spoken, story-first. Designing Your Story energy without being stiff.",
    "- greetingBody MUST start with \"" + openLine + "\" then 2-4 short sentences about progress this period.",
    "- Use bullets in greetingBody when listing room progress (• Room name: what happened).",
    "- highlight.heading: one plain sentence. highlight.body: 1-3 short sentences, warm and specific.",
    "- inProgress: up to 4 rows with room, item (render/board label), note (plain what happened).",
    "- NEVER mention POs, rates, margins, dollar amounts, time-entry dollars, or team names.",
    "- NEVER use em dashes. No agency-speak (same kill-list as invoice voice).",
    "- No exclamation points.",
    "Return ONLY valid JSON:",
    '{"greetingBody":"...","highlight":{"heading":"...","body":"..."},"inProgress":[{"room":"...","item":"...","note":"..."}]}',
  ].join("\n");
}

module.exports = {
  VOICE_SOURCE: VOICE_SOURCE,
  firstName: firstName,
  formalityGear: formalityGear,
  sanitizeCchVoice: sanitizeCchVoice,
  sanitizeInvoiceDraft: sanitizeInvoiceDraft,
  sanitizeProgressDraft: sanitizeProgressDraft,
  buildInvoiceSystemPrompt: buildInvoiceSystemPrompt,
  buildProgressSystemPrompt: buildProgressSystemPrompt,
};
