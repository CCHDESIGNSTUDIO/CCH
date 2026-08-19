// CCH voice rules for AI-generated client copy (browser mirror of Functions/cchVoiceProfile.js)
// Source of truth: loop/CCH_VOICE_PROFILE_CW_Jul13.md
(function (global) {
  'use strict';
  if (global._cchVoiceProfileLoaded) return;
  global._cchVoiceProfileLoaded = true;

  var VOICE_SOURCE = 'loop/CCH_VOICE_PROFILE_CW_Jul13.md';
  var AGENCY_SPEAK_PATTERNS = [
    /a period of meaningful refinement/gi,
    /meaningful refinement/gi,
    /brought into full resolution/gi,
    /construction-ready documentation/gi,
    /coordinated,\s*construction-ready/gi,
    /architectural permanence/gi,
    /precision and intentionality/gi,
    /advancing the project from concept/gi,
    /the project demands/gi,
    /understated luxury/gi
  ];

  function firstName(fullName) {
    var s = String(fullName || '').trim();
    if (!s) return '';
    return s.split(/\s+/)[0] || '';
  }

  function formalityGear(opts) {
    opts = opts || {};
    if (opts.formalityGear === 2 || opts.formalityGear === '2') return 2;
    if (String(opts.greetingStyle || '').toLowerCase() === 'dear') return 2;
    return 1;
  }

  function sanitizeCchVoice(text) {
    var s = String(text == null ? '' : text);
    s = s.replace(/\u2014/g, ', ').replace(/—/g, ', ');
    AGENCY_SPEAK_PATTERNS.forEach(function (re) { s = s.replace(re, ''); });
    return s.replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/  +/g, ' ').trim();
  }

  function clientGreetingStyleFromProject(proj) {
    proj = proj || {};
    var s = String(proj.progressUpdateGreetingStyle || proj.clientGreetingStyle || proj.invoiceGreetingStyle || 'hi').toLowerCase();
    return s === 'dear' ? 'dear' : 'hi';
  }

  function progressUpdateVoiceDefaults(proj) {
    proj = proj || {};
    var name = firstName(proj.clientName || proj.billingContactName || proj.client || '');
    var style = clientGreetingStyleFromProject(proj);
    return {
      greetingName: name,
      greetingStyle: style,
      greetingBody: style === 'dear'
        ? 'Here is where your project stands this period, what is ready for your review, and what is coming next.'
        : 'Good progress this period. Here is where things stand room by room, what is ready for your eye, and what is coming next.'
    };
  }

  function sanitizeInvoiceDraft(draft) {
    draft = draft || {};
    return {
      summary: sanitizeCchVoice(draft.summary),
      outcomes: Array.isArray(draft.outcomes) ? draft.outcomes.map(function (o) {
        o = o || {};
        return {
          title: sanitizeCchVoice(o.title),
          description: sanitizeCchVoice(o.description),
          dateRange: sanitizeCchVoice(o.dateRange),
          hours: o.hours != null ? o.hours : ''
        };
      }) : []
    };
  }

  function sanitizeProgressDraft(draft) {
    draft = draft || {};
    var hl = draft.highlight || {};
    return {
      greetingBody: sanitizeCchVoice(draft.greetingBody),
      highlight: { heading: sanitizeCchVoice(hl.heading), body: sanitizeCchVoice(hl.body) },
      inProgress: Array.isArray(draft.inProgress) ? draft.inProgress.map(function (r) {
        r = r || {};
        return { room: sanitizeCchVoice(r.room), item: sanitizeCchVoice(r.item), note: sanitizeCchVoice(r.note) };
      }) : []
    };
  }

  global.cchVoiceProfile = {
    VOICE_SOURCE: VOICE_SOURCE,
    firstName: firstName,
    formalityGear: formalityGear,
    sanitizeCchVoice: sanitizeCchVoice,
    sanitizeInvoiceDraft: sanitizeInvoiceDraft,
    sanitizeProgressDraft: sanitizeProgressDraft,
    clientGreetingStyleFromProject: clientGreetingStyleFromProject,
    progressUpdateVoiceDefaults: progressUpdateVoiceDefaults
  };
})(typeof window !== 'undefined' ? window : this);
