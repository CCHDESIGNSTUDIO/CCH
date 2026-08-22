/**
 * Pepper Speak — ElevenLabs TTS.
 * Returns base64 MP3. API key stays in Firebase secrets (never in the browser).
 * Allowlisted voice IDs only (Cindy's three picks, Jul 26 2026).
 *
 * Studio team: Elise / Jessa / Vanessa, longer replies.
 * Client portal: Elise only, short ack/hello/deflect lines (no team sign-in required).
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const ELEVENLABS_API_KEY = defineSecret("ELEVENLABS_API_KEY");
const REGION = "us-central1";
const MODEL_ID = "eleven_turbo_v2_5";
const MAX_CHARS = 2500;
const MAX_CHARS_CLIENT = 320;
const ELISE_ID = "EST9Ui6982FZPSi7gCHi";

const STUDIO_TEAM_EMAILS = [
  "cindy@cchdesign.com", "cynthia@cchdesign.com", "cynthiacbh@gmail.com",
  "vanessa@cchdesign.com", "vanessaholliday@cchdesign.com", "vholliday@cchdesign.com",
];

/** Cindy-selected library voices — do not accept arbitrary IDs from the client. */
const ALLOWED_VOICES = {
  EST9Ui6982FZPSi7gCHi: "Elise – Warm, Natural and Engaging",
  yj30vwTGJxSHezdAGsv9: "Jessa – Easygoing and Effortless",
  "8DzKSPdgEQPaK5vKG0Rs": "Vanessa – Beach Girl",
};

function studioEmailFromRequest(request) {
  if (!request || !request.auth) return "";
  const email = String(request.auth.token.email || "").toLowerCase().trim();
  return STUDIO_TEAM_EMAILS.includes(email) ? email : "";
}

/**
 * Studio team: full allowlist.
 * Client portal (unauth or non-team): Elise only + short phrases.
 */
function assertCanSpeak(request, voiceId, text) {
  const email = studioEmailFromRequest(request);
  if (email) return { mode: "studio", email: email };
  const data = (request && request.data) || {};
  const clientPortal = data.clientPortal === true || data.clientPortal === "true";
  if (!clientPortal) {
    throw new HttpsError("unauthenticated", "Sign in to use Pepper Speak.");
  }
  if (voiceId !== ELISE_ID) {
    throw new HttpsError("permission-denied", "Client portal Pepper uses Elise only.");
  }
  if (String(text || "").length > MAX_CHARS_CLIENT) {
    throw new HttpsError("invalid-argument", "Phrase too long for client Pepper.");
  }
  return { mode: "client", email: "" };
}

exports.cchPepperSpeak = onCall(
  {
    region: REGION,
    invoker: "public",
    secrets: [ELEVENLABS_API_KEY],
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (request) => {
    const data = request.data || {};
    const voiceId = String(data.voiceId || "").trim();
    let text = String(data.text || "").trim();

    if (!voiceId || !ALLOWED_VOICES[voiceId]) {
      throw new HttpsError("invalid-argument", "Unknown or disallowed Pepper voice.");
    }
    if (!text || text === "…" || text === "(no reply)") {
      throw new HttpsError("invalid-argument", "Nothing to speak.");
    }
    const who = assertCanSpeak(request, voiceId, text);
    const maxLen = who.mode === "client" ? MAX_CHARS_CLIENT : MAX_CHARS;
    if (text.length > maxLen) {
      text = text.slice(0, maxLen);
    }

    const key = ELEVENLABS_API_KEY.value();
    if (!key) {
      throw new HttpsError("failed-precondition", "ElevenLabs is not configured on this environment.");
    }

    let resp;
    try {
      resp = await fetch(
        "https://api.elevenlabs.io/v1/text-to-speech/" + encodeURIComponent(voiceId) +
          "?output_format=mp3_44100_128",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "xi-api-key": key,
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: text,
            model_id: MODEL_ID,
            // Pepper delivery: slightly faster, polished; accent comes from the chosen voice (e.g. Elise).
            voice_settings: {
              stability: 0.42,
              similarity_boost: 0.78,
              style: 0.28,
              speed: 1.12,
              use_speaker_boost: true,
            },
          }),
        }
      );
    } catch (e) {
      console.error("[cchPepperSpeak] fetch failed", e && e.message);
      throw new HttpsError("unavailable", "Could not reach ElevenLabs.");
    }

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("[cchPepperSpeak] ElevenLabs error", resp.status, errText.slice(0, 400));
      throw new HttpsError("internal", "ElevenLabs returned an error (" + resp.status + ").");
    }

    const buf = Buffer.from(await resp.arrayBuffer());
    if (!buf.length) {
      throw new HttpsError("internal", "ElevenLabs returned empty audio.");
    }

    return {
      ok: true,
      voiceId: voiceId,
      voiceName: ALLOWED_VOICES[voiceId],
      mimeType: "audio/mpeg",
      audioBase64: buf.toString("base64"),
    };
  }
);
