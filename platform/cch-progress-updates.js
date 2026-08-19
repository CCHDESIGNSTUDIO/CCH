// ==================== CCH BI-WEEKLY PROGRESS UPDATES (WO-021 Phase A + WO-028 Phase B) ====================

(function() {
  'use strict';
  if (window._cchProgressUpdatesLoaded) return;
  window._cchProgressUpdatesLoaded = true;

  var BUILD = '20260714pu18';
  var SEED_DOC_ID = 'sample-february-2026';
  var SEED_PROJECT = 'cloud-rolling-hills';

  function puEsc(s) {
    if (typeof esc === 'function') return esc(s);
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function puEscAttr(s) {
    if (typeof escAttr === 'function') return escAttr(s);
    return puEsc(s).replace(/"/g, '&quot;');
  }

  function puNav(hash) {
    var h = String(hash || '');
    var attr = ' data-pu-nav="' + puEscAttr(h) + '"';
    if (typeof cpPortalNavigateOnclickAttr === 'function') return attr + ' onclick=' + cpPortalNavigateOnclickAttr(h);
    return attr + ' onclick="if(typeof navigate===\'function\')navigate(\'' + h.replace(/'/g, '\\\'') + '\')"';
  }

  /** Safe onclick= value when interpolating JSON.stringify args (avoids quote collision in attributes). */
  function puOnclickAttr(jsOneLiner) {
    if (typeof cpPortalOnclickAttr === 'function') return cpPortalOnclickAttr(jsOneLiner);
    return '"' + String(jsOneLiner).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;') + '"';
  }

  function puBindNavDelegation() {
    if (window._cchPuNavBound) return;
    window._cchPuNavBound = true;
    function go(el) {
      var hash = el && el.getAttribute && el.getAttribute('data-pu-nav');
      if (!hash) return;
      if (typeof window.navigate === 'function') window.navigate(hash);
      else location.hash = hash;
    }
    document.addEventListener('click', function(e) {
      var el = e.target && e.target.closest && e.target.closest('[data-pu-nav]');
      if (!el) return;
      e.preventDefault();
      go(el);
    });
    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var el = e.target && e.target.closest && e.target.closest('[data-pu-nav]');
      if (!el) return;
      e.preventDefault();
      go(el);
    });
  }

  function puDb() {
    try { return (typeof db !== 'undefined' && db) || firebase.firestore(); } catch (e) { return null; }
  }

  function puInjectStyles() {
    puBindNavDelegation();
    if (document.getElementById('cpPuStyles')) return;
    var el = document.createElement('style');
    el.id = 'cpPuStyles';
    el.textContent =
      '.cp-bwu-hero{position:relative;height:320px;overflow:hidden;margin:0 -24px 0;background:#22374f;}' +
      '.cp-bwu-hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}' +
      '.cp-bwu-hero-veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,31,61,.10) 0%,rgba(10,31,61,.20) 45%,rgba(10,31,61,.68) 100%);}' +
      '.cp-bwu-hero-top{position:absolute;top:26px;left:40px;right:40px;display:flex;justify-content:space-between;color:#fff;z-index:2;}' +
      '.cp-bwu-hero-cap{position:absolute;left:40px;bottom:34px;color:#fff;z-index:2;}' +
      '.cp-bwu-kick{font-size:11px;letter-spacing:.24em;text-transform:uppercase;color:rgba(255,255,255,.82);}' +
      '.cp-bwu-ttl{font-family:"Playfair Display",Georgia,serif;font-size:42px;line-height:1.08;margin:10px 0 4px;}' +
      '.cp-bwu-at{font-family:"Playfair Display",Georgia,serif;font-style:italic;font-size:22px;color:#C4A464;}' +
      '.cp-bwu-body{padding:40px 24px 48px;}' +
      '.cp-bwu-hi{font-family:"Playfair Display",Georgia,serif;font-size:24px;color:#0A1F3D;margin:0 0 8px;}' +
      '.cp-bwu-greet p{font-size:15px;line-height:26px;color:#6B7280;margin:0;}' +
      '.cp-bwu-eyebrow{font-size:11px;font-weight:500;letter-spacing:.15em;text-transform:uppercase;color:#0A1F3D;display:block;margin-bottom:20px;}' +
      '.cp-bwu-eyebrow .tick{color:#C4A464;margin-right:9px;}' +
      '.cp-bwu-sec{margin-top:46px;}' +
      '.cp-bwu-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}' +
      '.cp-bwu-room{border:1px solid #E2E2E2;background:#fff;}' +
      '.cp-bwu-room-img{position:relative;height:190px;border-bottom:1px solid #E2E2E2;background:#dfe2e7;overflow:hidden;}' +
      '.cp-bwu-room-img img{width:100%;height:100%;object-fit:cover;display:block;}' +
      '.cp-bwu-badge{position:absolute;left:12px;bottom:12px;}' +
      '.cp-bwu-room-body{padding:16px 18px 18px;}' +
      '.cp-bwu-rm{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#B08E4D;font-weight:500;}' +
      '.cp-bwu-it{font-family:"Playfair Display",Georgia,serif;font-size:17px;color:#0A1F3D;margin-top:5px;}' +
      '.cp-bwu-nt{font-size:12px;color:#9CA3AF;line-height:17px;margin-top:6px;}' +
      '.cp-bwu-hl{display:grid;grid-template-columns:1.7fr 1fr;gap:28px;align-items:stretch;}' +
      '.cp-bwu-hl-img{height:340px;border:1px solid #E2E2E2;background:#dfe2e7;overflow:hidden;}' +
      '.cp-bwu-hl-img img{width:100%;height:100%;object-fit:cover;}' +
      '.cp-bwu-hl-txt{align-self:center;}' +
      '.cp-bwu-hl-txt h3{font-family:"Playfair Display",Georgia,serif;font-size:26px;color:#0A1F3D;line-height:1.2;margin:0 0 12px;font-weight:500;}' +
      '.cp-bwu-hl-txt p{font-size:14px;line-height:24px;color:#6B7280;margin:0;}' +
      '.cp-bwu-rule{width:44px;height:2px;background:#C4A464;margin:16px 0;}' +
      '.cp-bwu-appr-col{border:1px solid #E2E2E2;background:#fff;}' +
      '.cp-bwu-appr-col.attn{border-color:#C4A464;}' +
      '.cp-bwu-appr-img{height:170px;border-bottom:1px solid #E2E2E2;background:#dfe2e7;overflow:hidden;}' +
      '.cp-bwu-appr-img img{width:100%;height:100%;object-fit:cover;}' +
      '.cp-bwu-appr-meta{padding:14px 16px;}' +
      '.cp-bwu-flag{font-size:9px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;display:block;margin-bottom:7px;color:#9CA3AF;}' +
      '.cp-bwu-appr-col.attn .cp-bwu-flag{color:#B08E4D;}' +
      '.cp-bwu-nm{font-size:15px;color:#0A1F3D;font-weight:500;}' +
      '.cp-bwu-sb{font-size:12px;color:#9CA3AF;margin-top:3px;}' +
      '.cp-bwu-pal{display:grid;grid-template-columns:repeat(6,1fr);gap:14px;}' +
      '.cp-bwu-sw{width:100%;height:96px;border:1px solid #E2E2E2;}' +
      '.cp-bwu-pal-cap{font-size:11px;color:#6B7280;margin-top:9px;text-align:center;}' +
      '.cp-bwu-two{display:grid;grid-template-columns:1fr 1fr;gap:48px;}' +
      '.cp-bwu-done-row{display:flex;align-items:center;padding:11px 0;border-bottom:1px solid #F0F0F0;}' +
      '.cp-bwu-done-row:last-child{border-bottom:none;}' +
      '.cp-bwu-done-thumb{width:64px;height:46px;flex:0 0 auto;margin-right:16px;background:#dfe2e7;border:1px solid #E2E2E2;overflow:hidden;}' +
      '.cp-bwu-done-thumb img{width:100%;height:100%;object-fit:cover;}' +
      '.cp-bwu-done-txt{font-family:"Playfair Display",Georgia,serif;font-size:16px;color:#0A1F3D;}' +
      '.cp-bwu-done-chk{margin-left:auto;color:#B08E4D;font-size:14px;}' +
      '.cp-bwu-tl{position:relative;padding-left:22px;}' +
      '.cp-bwu-tl::before{content:"";position:absolute;left:4px;top:4px;bottom:6px;width:2px;background:#E9EAEE;}' +
      '.cp-bwu-node{position:relative;margin-bottom:22px;}' +
      '.cp-bwu-node::before{content:"";position:absolute;left:-22px;top:3px;width:9px;height:9px;background:#0A1F3D;}' +
      '.cp-bwu-node.soft::before{background:#fff;border:1.5px solid #C4A464;}' +
      '.cp-bwu-wk{font-size:13px;font-weight:500;color:#0A1F3D;}' +
      '.cp-bwu-wk.next{color:#9CA3AF;}' +
      '.cp-bwu-dt{font-size:12px;color:#9CA3AF;line-height:19px;margin-top:5px;}' +
      '.cp-bwu-sign{margin-top:48px;padding-top:28px;border-top:1px solid #E2E2E2;}' +
      '.cp-bwu-sign-w{font-family:"Playfair Display",Georgia,serif;font-size:17px;color:#0A1F3D;}' +
      '.cp-bwu-sign-n{font-family:"Playfair Display",Georgia,serif;font-size:20px;color:#B08E4D;margin-top:2px;}' +
      '.cp-bwu-sign-r{font-size:12px;color:#9CA3AF;margin-top:5px;}' +
      '.cp-bwu-gift-list{display:flex;flex-direction:column;gap:0;}' +
      '.cp-bwu-gift-card{display:flex;flex-direction:row;align-items:stretch;border:1px solid transparent;border-bottom:1px solid #C4A464;cursor:pointer;background:#fff;transition:border-color .15s ease,background .15s ease;min-height:300px;}' +
      '.cp-bwu-gift-card:hover{border-color:#C4A464;background:#FAFAF8;}' +
      '.cp-bwu-gift-cover{position:relative;flex:0 0 46%;min-height:300px;background:#22374f;overflow:hidden;}' +
      '.cp-bwu-gift-cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;}' +
      '.cp-bwu-gift-cover .cp-bwu-gift-ph{position:absolute;inset:0;}' +
      '.cp-bwu-gift-veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,31,61,.10) 0%,rgba(10,31,61,.22) 48%,rgba(10,31,61,.62) 100%);pointer-events:none;}' +
      '.cp-bwu-gift-kicker{position:absolute;left:22px;bottom:20px;z-index:2;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.9);}' +
      '.cp-bwu-gift-body{flex:1;min-width:0;padding:40px 40px 40px 34px;display:flex;flex-direction:column;justify-content:center;gap:8px;}' +
      '.cp-bwu-gift-period{font-family:"Playfair Display",Georgia,serif;font-size:30px;line-height:1.12;color:#0A1F3D;font-weight:500;}' +
      '.cp-bwu-gift-subtitle{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#C4A464;font-weight:500;margin-top:2px;}' +
      '.cp-bwu-gift-teaser{font-size:14px;line-height:1.55;color:#6B7280;margin-top:8px;max-width:42em;}' +
      '.cp-bwu-gift-foot{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:14px;flex-wrap:wrap;}' +
      '.cp-bwu-gift-cta{font-size:12px;color:#C4A464;letter-spacing:.02em;white-space:nowrap;}' +
      '.cp-bwu-gift-draft{font-size:9px;font-weight:700;padding:2px 7px;margin-left:10px;vertical-align:middle;background:rgba(196,164,100,0.2);color:#8B6914;letter-spacing:.06em;text-transform:uppercase;}' +
      '.cp-bwu-teaser{border:1px solid #E2E2E2;padding:28px 32px;margin-bottom:40px;display:flex;gap:28px;align-items:flex-start;cursor:pointer;}' +
      '.cp-bwu-teaser:hover{background:#FAFAFA;}' +
      '.cp-bwu-home-card{display:flex;flex-direction:row;align-items:stretch;border:1px solid #E2E2E2;margin-bottom:40px;cursor:pointer;background:#fff;min-height:240px;overflow:hidden;transition:border-color .15s ease,background .15s ease;}' +
      '.cp-bwu-home-card:hover{border-color:#C4A464;background:#FAFAF8;}' +
      '.cp-bwu-home-cover{position:relative;flex:0 0 44%;min-height:240px;background:linear-gradient(135deg,#22374f,#8f8570);overflow:hidden;}' +
      '.cp-bwu-home-cover img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;}' +
      '.cp-bwu-home-cover-kicker{position:absolute;left:20px;bottom:18px;z-index:2;font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.92);}' +
      '.cp-bwu-home-cover-veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,31,61,.08) 0%,rgba(10,31,61,.22) 48%,rgba(10,31,61,.62) 100%);pointer-events:none;}' +
      '.cp-bwu-home-body{flex:1;min-width:0;padding:28px 32px;display:flex;flex-direction:column;justify-content:center;gap:8px;}' +
      '.cp-bwu-home-period{font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:.08em;}' +
      '.cp-bwu-home-title{font-family:"Playfair Display",Georgia,serif;font-size:24px;line-height:1.15;color:#0A1F3D;font-weight:500;}' +
      '.cp-bwu-home-teaser{font-size:14px;line-height:1.65;color:#6B7280;}' +
      '.cp-bwu-home-cta{font-size:12px;color:#C4A464;margin-top:8px;}' +
      '@media(max-width:720px){.cp-bwu-home-card{flex-direction:column;min-height:0;}.cp-bwu-home-cover{flex:none;width:100%;min-height:200px;}.cp-bwu-home-body{padding:22px 20px 24px;}.cp-bwu-home-title{font-size:20px;}}' +
      '@media(max-width:960px){.cp-bwu-grid3,.cp-bwu-pal{grid-template-columns:repeat(2,1fr);}.cp-bwu-hl,.cp-bwu-two{grid-template-columns:1fr;}.cp-bwu-ttl{font-size:32px;}}' +
      '@media(max-width:720px){.cp-bwu-gift-card{min-height:0;}.cp-bwu-gift-card{flex-direction:column;}.cp-bwu-gift-cover{flex:none;width:100%;min-height:240px;}.cp-bwu-gift-body{padding:24px 22px 26px;}.cp-bwu-gift-period{font-size:24px;}}';
    document.head.appendChild(el);
  }

  function puRingSvg(percent) {
    var p = Math.max(0, Math.min(100, parseInt(percent, 10) || 0));
    var circ = 2 * Math.PI * 18;
    var dash = (p / 100) * circ;
    return '<svg width="46" height="46" viewBox="0 0 46 46"><circle cx="23" cy="23" r="18" fill="rgba(10,31,61,.8)"/>' +
      '<circle cx="23" cy="23" r="18" fill="none" stroke="#C4A464" stroke-width="3" stroke-linecap="round" stroke-dasharray="' + dash.toFixed(1) + ' ' + circ.toFixed(1) + '" transform="rotate(-90 23 23)"/>' +
      '<text x="23" y="27.5" text-anchor="middle" fill="#fff" font-family="DM Sans,sans-serif" font-size="12" font-weight="500">' + p + '%</text></svg>';
  }

  function puPalGradient(name) {
    var n = String(name || '').toLowerCase();
    if (n.indexOf('iron') >= 0) return 'linear-gradient(135deg,#3A3B40,#54565c)';
    if (n.indexOf('brass') >= 0 || n.indexOf('gold') >= 0) return 'linear-gradient(135deg,#CBA96A,#B7913F)';
    if (n.indexOf('oak') >= 0) return 'linear-gradient(135deg,#F0EBE1,#E4DBCB)';
    if (n.indexOf('zellige') >= 0) return 'linear-gradient(135deg,#DAD2C4,#C3B7A2)';
    if (n.indexOf('linen') >= 0) return 'linear-gradient(135deg,#E9E4DA,#D8CFBE)';
    if (n.indexOf('limestone') >= 0) return 'linear-gradient(135deg,#EDE7DC,#D5CBB5)';
    return 'linear-gradient(135deg,#EDE7DC,#DCD3C4)';
  }

  function puPalSwatchHtml(p) {
    p = p || {};
    if (p.imageUrl) {
      return '<div class="cp-bwu-sw" style="overflow:hidden;padding:0;background:' + puPalGradient(p.name) + ';">' +
        '<img src="' + puEscAttr(p.imageUrl) + '" alt="" style="width:100%;height:100%;object-fit:cover;" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' +
        '</div>';
    }
    return '<div class="cp-bwu-sw" style="background:' + puPalGradient(p.name) + ';"></div>';
  }

  function puPeriodLabel(u) {
    if (u.period) return u.period;
    if (u.periodStart && u.periodEnd) return u.periodStart + ' – ' + u.periodEnd;
    return u.title || 'Update';
  }

  function puGreetingLine(u) {
    var name = String(u.greetingName || '').trim();
    var style = String(u.greetingStyle || 'hi').toLowerCase();
    if (!name) return 'Hello,';
    if (style === 'dear') return 'Dear ' + name + ',';
    return 'Hi ' + name + ',';
  }

  function puImgBlock(url, grad, h) {
    if (url) return '<img src="' + puEscAttr(url) + '" alt="" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">';
    return '<div style="width:100%;height:100%;background:' + (grad || 'linear-gradient(135deg,#c9cec2,#aeb7b0)') + ';"></div>';
  }

  function puListTeaser(u) {
    u = u || {};
    var h = u.highlight && u.highlight.heading;
    if (h && String(h).trim()) return String(h).trim();
    var g = String(u.greetingBody || '').trim();
    if (!g) return '';
    var first = g.split(/\n/)[0].replace(/\s+/g, ' ').trim();
    if (first.length > 118) first = first.slice(0, 115) + '…';
    return first;
  }

  function puGiftCoverHtml(heroUrl) {
    var inner = heroUrl
      ? '<img src="' + puEscAttr(heroUrl) + '" alt="" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' +
        '<div class="cp-bwu-gift-ph" style="display:none;"></div>'
      : '<div class="cp-bwu-gift-ph" style="background:linear-gradient(135deg,#22374f,#8f8570);"></div>';
    return '<div class="cp-bwu-gift-cover">' + inner +
      '<div class="cp-bwu-gift-veil"></div>' +
      '<div class="cp-bwu-gift-kicker">Your Bi-Weekly Update</div></div>';
  }

  window.cpPuLoadUpdates = async function(database, projectId, includeDrafts) {
    puInjectStyles();
    var rows = [];
    if (!database || !projectId) return rows;
    try {
      var snap = await database.collection('boards').doc(projectId).collection('progressUpdates')
        .orderBy('publishedAt', 'desc').get();
      snap.forEach(function(d) { rows.push({ id: d.id, ...d.data() }); });
    } catch (e) {
      try {
        var snap2 = await database.collection('boards').doc(projectId).collection('progressUpdates').get();
        snap2.forEach(function(d) { rows.push({ id: d.id, ...d.data() }); });
        rows.sort(function(a, b) {
          return String(b.publishedAt || b.createdAt || '').localeCompare(String(a.publishedAt || a.createdAt || ''));
        });
      } catch (e2) {}
    }
    if (!includeDrafts) rows = rows.filter(function(r) { return r.status === 'published'; });
    return rows;
  };

  window.cpPuLatestPublished = function(rows) {
    if (!rows || !rows.length) return null;
    var pub = rows.filter(function(r) { return r.status === 'published'; });
    return pub[0] || null;
  };

  window.cpPuBuildSeedDoc = function(heroUrl) {
    var now = '2026-02-14T18:00:00.000Z';
    return {
      title: 'February Bi-Weekly Update',
      period: 'February 1–14, 2026',
      periodStart: '2026-02-01',
      periodEnd: '2026-02-14',
      greetingName: 'Tracey',
      greetingStyle: 'hi',
      greetingBody: 'Hi Tracey, good progress this period. Here is where things stand room by room, what is ready for your eye, and what is coming next.',
      heroImageUrl: heroUrl || '',
      inProgress: [
        { room: 'Game Room', imageUrl: '', percent: 62, item: 'Enscape render · GR 6.2', note: 'Final furnishings and lantern pendants locked in.' },
        { room: 'Living Room', imageUrl: '', percent: 55, item: 'Living Room · LR 6.1', note: 'Seating, rug, and accent direction locked.' },
        { room: 'Master Bath', imageUrl: '', percent: 48, item: 'Master Bath SIMPLE', note: 'Stone and tile palette confirmed for install.' }
      ],
      highlight: {
        imageUrl: heroUrl || '',
        heading: 'The game room rendering sets the tone for the home.',
        body: 'Warm layers, tailored seating, and the lantern pendants you loved, composed as one story for Rolling Hills.'
      },
      awaitingApproval: [
        { name: 'Game Room pendants', sub: 'Living Room', imageUrl: '', needsDecision: false },
        { name: 'Master Bath stone', sub: 'Primary Bath', imageUrl: '', needsDecision: true },
        { name: 'Living Room rug', sub: 'Living Room', imageUrl: '', needsDecision: false }
      ],
      palette: [
        { name: 'Limestone', imageUrl: '' },
        { name: 'Forged Iron', imageUrl: '' },
        { name: 'Antique Brass', imageUrl: '' },
        { name: 'White Oak', imageUrl: '' },
        { name: 'Zellige', imageUrl: '' },
        { name: 'Linen', imageUrl: '' }
      ],
      completed: [
        { label: 'Game Room layout', thumbUrl: '' },
        { label: 'Living Room framework', thumbUrl: '' },
        { label: 'Master Bath palette', thumbUrl: '' }
      ],
      comingUp: [
        { week: 'Week of Feb 17', detail: 'Living Room furniture orders · rug final check', soft: false },
        { week: 'Week of Feb 24', detail: 'Master Bath tile mock-up · site walkthrough', soft: true }
      ],
      signName: 'Cynthia Holloway',
      signRole: 'CCH Design Inc. · Principal Designer',
      status: 'published',
      publishedAt: now,
      createdAt: now,
      createdBy: 'WO-021 seed',
      updatedAt: now
    };
  };

  window.cpPuEnsureSeed = async function(database, projectId, heroUrl) {
    if (!database || projectId !== SEED_PROJECT) return false;
    try {
      var existing = await database.collection('boards').doc(projectId).collection('progressUpdates').doc(SEED_DOC_ID).get();
      if (existing.exists) return false;
      var data = cpPuBuildSeedDoc(heroUrl);
      await database.collection('boards').doc(projectId).collection('progressUpdates').doc(SEED_DOC_ID).set(data);
      console.info('[CCH Progress Updates] seeded', SEED_DOC_ID, 'on', projectId);
      return true;
    } catch (e) {
      console.warn('[CCH Progress Updates] seed failed', e);
      return false;
    }
  };

  window.cpPuRenderList = function(updates, projectId, baseHash, studioAdmin) {
    puInjectStyles();
    baseHash = baseHash || ('#/clientview/' + projectId);
    var rows = (updates || []).filter(function(u) { return studioAdmin || u.status === 'published'; });
    if (!rows.length) {
      return '<div class="cp-sec-label-jx">Updates</div>' +
        '<div style="border:1px solid #E2E2E2;padding:48px 32px;text-align:center;font-size:13px;color:#6B7280;">No published updates yet. Your designer will post bi-weekly progress here.</div>';
    }
    return '<div class="cp-sec-label-jx">Updates</div>' +
      '<div style="font-size:12px;color:#6B7280;margin:-4px 0 22px;line-height:1.55;">Bi-weekly design progress — each issue is a chapter in your project story.</div>' +
      '<div class="cp-bwu-gift-list">' +
      rows.map(function(u) {
        var thumb = u.heroImageUrl || '';
        var link = baseHash + '/updates/' + encodeURIComponent(u.id);
        var draftBadge = (studioAdmin && u.status !== 'published') ? '<span class="cp-bwu-gift-draft">Draft</span>' : '';
        var editBtn = studioAdmin
          ? '<button type="button" class="cp-btn cp-btn-outline" style="padding:5px 12px;font-size:10px;white-space:nowrap;" onclick=' +
            puOnclickAttr('event.stopPropagation();cpPuOpenEditorModal(' + JSON.stringify(projectId) + ',' + JSON.stringify(u.id) + ')') +
            '>Edit</button>'
          : '';
        var teaser = puListTeaser(u);
        var subtitle = String(u.title || 'Bi-Weekly Update').trim();
        return '<article class="cp-bwu-gift-card" role="button" tabindex="0" ' + puNav(link) + '>' +
          puGiftCoverHtml(thumb) +
          '<div class="cp-bwu-gift-body">' +
            '<div class="cp-bwu-gift-period">' + puEsc(puPeriodLabel(u)) + draftBadge + '</div>' +
            '<div class="cp-bwu-gift-subtitle">' + puEsc(subtitle) + '</div>' +
            (teaser ? '<div class="cp-bwu-gift-teaser">' + puEsc(teaser) + '</div>' : '') +
            '<div class="cp-bwu-gift-foot">' +
              '<span class="cp-bwu-gift-cta">Open the issue →</span>' +
              editBtn +
            '</div>' +
          '</div>' +
        '</article>';
      }).join('') +
      '</div>';
  };

  window.cpPuRenderDetail = function(update, projectId, projName, baseHash) {
    puInjectStyles();
    if (!update) {
      return '<div style="padding:40px;color:#6B7280;">Update not found.</div>';
    }
    baseHash = baseHash || ('#/clientview/' + projectId);
    var u = update;
    var period = puPeriodLabel(u);
    var hero = u.heroImageUrl || '';
    var inProg = u.inProgress || [];
    var highlight = u.highlight || {};
    var appr = u.awaitingApproval || [];
    var palette = u.palette || [];
    var completed = u.completed || [];
    var coming = u.comingUp || [];

    var html = '<div class="cp-bwu-detail">' +
      '<div style="margin-bottom:16px;"><button type="button" class="cp-btn cp-btn-outline" style="padding:6px 12px;font-size:11px;" ' + puNav(baseHash + '/updates') + '>← All updates</button></div>' +
      '<div class="cp-bwu-hero">' +
        (hero ? '<img class="cp-bwu-hero-img" src="' + puEscAttr(hero) + '" alt="" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">' : '') +
        '<div class="cp-bwu-hero-veil"></div>' +
        '<div class="cp-bwu-hero-top"><span style="font-size:12px;letter-spacing:.32em;">CCH DESIGN</span><span style="font-size:11px;letter-spacing:.12em;color:#C4A464;text-transform:uppercase;">' + puEsc(period) + '</span></div>' +
        '<div class="cp-bwu-hero-cap"><div class="cp-bwu-kick">Your Bi-Weekly Update</div>' +
          '<div class="cp-bwu-ttl">Designing Your Story</div>' +
          '<div class="cp-bwu-at">at ' + puEsc(projName || '') + '</div></div></div>' +
      '<div class="cp-bwu-body">' +
        '<div class="cp-bwu-greet"><div class="cp-bwu-hi">' + puEsc(puGreetingLine(u)) + '</div>' +
          '<p>' + puEsc(u.greetingBody || '') + '</p></div>';

    if (inProg.length) {
      html += '<div class="cp-bwu-sec"><span class="cp-bwu-eyebrow"><span class="tick">◆</span>In Progress</span><div class="cp-bwu-grid3">' +
        inProg.map(function(r) {
          return '<div class="cp-bwu-room"><div class="cp-bwu-room-img">' + puImgBlock(r.imageUrl, 'linear-gradient(135deg,#c9cec2,#aeb7b0)') +
            '<div class="cp-bwu-badge">' + puRingSvg(r.percent) + '</div></div>' +
            '<div class="cp-bwu-room-body"><div class="cp-bwu-rm">' + puEsc(r.room || '') + '</div>' +
            '<div class="cp-bwu-it">' + puEsc(r.item || '') + '</div>' +
            (r.note ? '<div class="cp-bwu-nt">' + puEsc(r.note) + '</div>' : '') + '</div></div>';
        }).join('') + '</div></div>';
    }

    if (highlight.heading || highlight.body) {
      html += '<div class="cp-bwu-sec"><span class="cp-bwu-eyebrow"><span class="tick">◆</span>This Period\'s Highlight</span><div class="cp-bwu-hl">' +
        '<div class="cp-bwu-hl-img">' + puImgBlock(highlight.imageUrl, 'linear-gradient(120deg,#d7d2c6,#94a2ab)') + '</div>' +
        '<div class="cp-bwu-hl-txt"><h3>' + puEsc(highlight.heading || '') + '</h3><div class="cp-bwu-rule"></div>' +
        '<p>' + puEsc(highlight.body || '') + '</p></div></div></div>';
    }

    if (appr.length) {
      html += '<div class="cp-bwu-sec"><span class="cp-bwu-eyebrow"><span class="tick">◆</span>Awaiting Your Approval</span><div class="cp-bwu-grid3">' +
        appr.map(function(a) {
          var attn = a.needsDecision ? ' attn' : '';
          return '<div class="cp-bwu-appr-col' + attn + '"><div class="cp-bwu-appr-img">' + puImgBlock(a.imageUrl, 'linear-gradient(135deg,#cfd6d1,#aebbb4)') + '</div>' +
            '<div class="cp-bwu-appr-meta"><span class="cp-bwu-flag">' + (a.needsDecision ? 'Needs Your Decision' : 'For Review') + '</span>' +
            '<div class="cp-bwu-nm">' + puEsc(a.name || '') + '</div><div class="cp-bwu-sb">' + puEsc(a.sub || '') + '</div></div></div>';
        }).join('') + '</div></div>';
    }

    if (palette.length) {
      html += '<div class="cp-bwu-sec"><span class="cp-bwu-eyebrow"><span class="tick">◆</span>Your Material Palette — Confirmed</span><div class="cp-bwu-pal">' +
        palette.map(function(p) {
          return '<div>' + puPalSwatchHtml(p) + '<div class="cp-bwu-pal-cap">' + puEsc(p.name || '') + '</div></div>';
        }).join('') + '</div></div>';
    }

    if (completed.length || coming.length) {
      html += '<div class="cp-bwu-sec cp-bwu-two"><div>';
      if (completed.length) {
        html += '<span class="cp-bwu-eyebrow"><span class="tick">◆</span>Recently Completed</span><div style="margin-top:18px;">' +
          completed.map(function(c) {
            return '<div class="cp-bwu-done-row"><div class="cp-bwu-done-thumb">' + puImgBlock(c.thumbUrl, 'linear-gradient(135deg,#cdd2cb,#b0b8b1)') + '</div>' +
              '<span class="cp-bwu-done-txt">' + puEsc(c.label || c.item || '') + '</span><span class="cp-bwu-done-chk">✓</span></div>';
          }).join('') + '</div>';
      }
      html += '</div><div>';
      if (coming.length) {
        html += '<span class="cp-bwu-eyebrow"><span class="tick">◆</span>Coming Up — Next Two Weeks</span><div class="cp-bwu-tl" style="margin-top:20px;">' +
          coming.map(function(c, i) {
            return '<div class="cp-bwu-node' + (c.soft ? ' soft' : '') + '"><div class="cp-bwu-wk' + (c.soft ? ' next' : '') + '">' + puEsc(c.week || '') + '</div>' +
              '<div class="cp-bwu-dt">' + puEsc(c.detail || '') + '</div></div>';
          }).join('') + '</div>';
      }
      html += '</div></div>';
    }

    html += '<div class="cp-bwu-sign"><div class="cp-bwu-sign-w">With warmth,</div>' +
      '<div class="cp-bwu-sign-n">' + puEsc(u.signName || 'Cynthia Holloway') + '</div>' +
      '<div class="cp-bwu-sign-r">' + puEsc(u.signRole || 'CCH Design Inc. · Principal Designer') + '</div></div>' +
      '</div></div>';
    return html;
  };

  window.cpPuRenderHomeTeaser = function(latest, projectId, baseHash) {
    if (!latest || latest.status !== 'published') return '';
    puInjectStyles();
    baseHash = baseHash || ('#/clientview/' + projectId);
    var link = baseHash + '/updates/' + encodeURIComponent(latest.id);
    var thumb = latest.heroImageUrl || '';
    var teaser = puListTeaser(latest) || (latest.greetingBody || '').slice(0, 160);
    var coverInner = thumb
      ? '<img src="' + puEscAttr(thumb) + '" alt="" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">'
      : '';
    return '<div class="cp-sec-label-jx">What\'s New</div>' +
      '<div class="cp-bwu-home-card" role="link" tabindex="0" aria-label="Open bi-weekly update" ' + puNav(link) + '>' +
        '<div class="cp-bwu-home-cover">' + coverInner +
          '<div class="cp-bwu-home-cover-veil"></div>' +
          '<div class="cp-bwu-home-cover-kicker">Your Bi-Weekly Update</div></div>' +
        '<div class="cp-bwu-home-body">' +
          '<div class="cp-bwu-home-period">' + puEsc(puPeriodLabel(latest)) + '</div>' +
          '<div class="cp-bwu-home-title">Designing Your Story</div>' +
          (teaser ? '<div class="cp-bwu-home-teaser">' + puEsc(teaser) + '</div>' : '') +
          '<div class="cp-bwu-home-cta">Open the issue →</div></div></div>';
  };

  /** Fallback when only whatsNew timeline exists (no progressUpdates doc). */
  window.cpPuRenderWhatsNewHomeTeaser = function(item, projectId, baseHash, latestUpdate) {
    if (!item) return '';
    puInjectStyles();
    baseHash = baseHash || ('#/clientview/' + projectId);
    var link = item.progressUpdateId
      ? (baseHash + '/updates/' + encodeURIComponent(item.progressUpdateId))
      : ((latestUpdate && latestUpdate.id)
        ? (baseHash + '/updates/' + encodeURIComponent(latestUpdate.id))
        : (baseHash + '/updates'));
    var thumb = item.photoUrl || (latestUpdate && latestUpdate.heroImageUrl) || '';
    var coverInner = thumb
      ? '<img src="' + puEscAttr(thumb) + '" alt="" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">'
      : '';
    return '<div class="cp-sec-label-jx">' + puEsc(item.title || 'What\'s New') + '</div>' +
      '<div class="cp-bwu-home-card" role="link" tabindex="0" aria-label="Open update" ' + puNav(link) + '>' +
        '<div class="cp-bwu-home-cover">' + coverInner +
          '<div class="cp-bwu-home-cover-veil"></div>' +
          '<div class="cp-bwu-home-cover-kicker">Project Update</div></div>' +
        '<div class="cp-bwu-home-body">' +
          '<div class="cp-bwu-home-period">' + puEsc(typeof cpRelativeTimeLabel === 'function' ? cpRelativeTimeLabel(item.createdAt) : '') + '</div>' +
          '<div class="cp-bwu-home-title">What\'s New</div>' +
          '<div class="cp-bwu-home-teaser">' + puEsc(item.text || 'A new project update has been posted.') + '</div>' +
          '<div class="cp-bwu-home-cta">Read more →</div></div></div>';
  };

  window.cpPuIsWhatsNewDuplicateOfUpdate = function(whatsNewItem, latestUpdate) {
    if (!whatsNewItem || !latestUpdate || latestUpdate.status !== 'published') return false;
    var t = String(whatsNewItem.text || '').toLowerCase();
    return t.indexOf('bi-weekly') >= 0 || t.indexOf('design update') >= 0;
  };

  // ==================== WO-028 Phase B — Studio editor (admin only) ====================

  function puStudioAdmin() {
    return typeof isCCHStudioStaffSession === 'function' && isCCHStudioStaffSession();
  }

  window.cpPuRenderStudioToolbar = function(projectId, ctx) {
    if (!puStudioAdmin()) return '';
    ctx = ctx || {};
    var btns = '<button type="button" class="cp-btn cp-btn-primary" style="padding:6px 14px;font-size:11px;" onclick=' + puOnclickAttr('cpPuOpenEditorModal(' + JSON.stringify(projectId) + ',null)') + '>+ New Bi-Weekly Update</button>';
    if (ctx.updateId) {
      btns += '<button type="button" class="cp-btn cp-btn-outline" style="padding:6px 14px;font-size:11px;margin-left:8px;" onclick=' + puOnclickAttr('cpPuOpenEditorModal(' + JSON.stringify(projectId) + ',' + JSON.stringify(ctx.updateId) + ')') + '>Edit This Update</button>';
      btns += '<button type="button" class="cp-btn cp-btn-outline" style="padding:6px 14px;font-size:11px;margin-left:8px;color:#B45309;border-color:rgba(180,83,9,0.4);" onclick=' + puOnclickAttr('cpPuDeleteUpdate(' + JSON.stringify(projectId) + ',' + JSON.stringify(ctx.updateId) + ')') + '>Delete Update</button>';
    }
    return '<div class="cp-pu-studio-bar" style="margin:0 0 20px;padding:12px 16px;border:1px solid rgba(196,164,100,0.35);background:rgba(196,164,100,0.08);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">' +
      '<span style="font-size:12px;color:#5C4A2A;font-weight:600;">Studio · Bi-Weekly Update Editor</span>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' + btns + '</div></div>';
  };

  function puEditorBlankDoc(heroUrl, proj) {
    var d = cpPuBuildSeedDoc(heroUrl);
    d.status = 'draft';
    d.publishedAt = '';
    d.title = 'New Bi-Weekly Update';
    d.period = '';
    d.periodStart = '';
    d.periodEnd = '';
    if (typeof global.cchVoiceProfile !== 'undefined' && global.cchVoiceProfile.progressUpdateVoiceDefaults) {
      var vd = global.cchVoiceProfile.progressUpdateVoiceDefaults(proj || {});
      d.greetingName = vd.greetingName || d.greetingName;
      d.greetingStyle = vd.greetingStyle || d.greetingStyle;
      d.greetingBody = vd.greetingBody || d.greetingBody;
    }
    return d;
  }

  function puEditorContextNotes(st) {
    st = st || {};
    var partial = puEditorReadForm();
    if (!partial) partial = st.doc || {};
    var lines = [];
    (partial.inProgress || []).forEach(function (r) {
      if (r.room || r.note) lines.push((r.room || 'Room') + ': ' + (r.item || '') + (r.note ? '. ' + r.note : ''));
    });
    (partial.awaitingApproval || []).forEach(function (r) {
      if (r.name) lines.push('Awaiting approval: ' + r.name + (r.sub ? ' (' + r.sub + ')' : ''));
    });
    (partial.completed || []).forEach(function (r) {
      if (r.label) lines.push('Completed: ' + r.label);
    });
    (partial.comingUp || []).forEach(function (r) {
      if (r.week || r.detail) lines.push((r.week || 'Coming up') + ': ' + (r.detail || ''));
    });
    if (partial.highlight && (partial.highlight.heading || partial.highlight.body)) {
      lines.push('Highlight: ' + (partial.highlight.heading || '') + ' ' + (partial.highlight.body || ''));
    }
    return lines.filter(Boolean);
  }

  window.cpPuDraftWithAI = function () {
    var st = window._cpPuEditorState;
    if (!st) return;
    if (typeof showToast === 'function') showToast('Drafting update with AI...', 2000);
    var partial = puEditorReadForm() || st.doc || {};
    var fn;
    try { fn = firebase.app().functions('us-central1').httpsCallable('draftProgressUpdate'); } catch (e) {
      if (typeof showToast === 'function') showToast('AI not available');
      return;
    }
    var proj = st.proj || {};
    var greetStyle = partial.greetingStyle || 'hi';
    fn({
      projectName: proj.name || st.projectId || '',
      period: partial.period || partial.title || 'this period',
      clientFirstName: partial.greetingName || (global.cchVoiceProfile && global.cchVoiceProfile.firstName(proj.clientName)) || '',
      clientName: proj.clientName || '',
      greetingStyle: greetStyle,
      contextNotes: puEditorContextNotes(st)
    }).then(function (res) {
      var d = (res && res.data) || {};
      if (global.cchVoiceProfile && global.cchVoiceProfile.sanitizeProgressDraft) {
        d = global.cchVoiceProfile.sanitizeProgressDraft(d);
      }
      var bodyEl = document.getElementById('cpPuEdGreetBody');
      if (bodyEl && d.greetingBody) bodyEl.value = d.greetingBody;
      var hlHead = document.getElementById('cpPuEdHlHead');
      var hlBody = document.getElementById('cpPuEdHlBody');
      if (hlHead && d.highlight && d.highlight.heading) hlHead.value = d.highlight.heading;
      if (hlBody && d.highlight && d.highlight.body) hlBody.value = d.highlight.body;
      if (Array.isArray(d.inProgress) && d.inProgress.length) {
        st.inProgress = d.inProgress.map(function (r, i) {
          return {
            room: r.room || '',
            item: r.item || '',
            note: r.note || '',
            percent: (st.inProgress[i] && st.inProgress[i].percent) || 0,
            imageUrl: (st.inProgress[i] && st.inProgress[i].imageUrl) || ''
          };
        });
        var body = document.getElementById('cpPuEditorBody');
        if (body) body.innerHTML = puEditorRenderBody(st);
      }
      if (typeof showToast === 'function') showToast('AI draft ready — review, then Save', 3500);
    }).catch(function (e) {
      var msg = (e && e.message) || String(e);
      if (e && e.details) msg = String(e.details);
      console.error('[cpPuDraftWithAI]', e);
      if (typeof showToast === 'function') showToast('AI draft failed: ' + msg, 5000);
    });
  };

  function puEditorReadForm() {
    var st = window._cpPuEditorState;
    if (!st) return null;
    var g = function(id) { var el = document.getElementById(id); return el ? el.value : ''; };
    var gn = function(id) { var el = document.getElementById(id); return el ? !!el.checked : false; };
    var doc = {
      title: String(g('cpPuEdTitle')).trim(),
      period: String(g('cpPuEdPeriod')).trim(),
      periodStart: String(g('cpPuEdPeriodStart')).trim(),
      periodEnd: String(g('cpPuEdPeriodEnd')).trim(),
      greetingName: String(g('cpPuEdGreetName')).trim(),
      greetingStyle: (document.getElementById('cpPuEdGreetDear') && document.getElementById('cpPuEdGreetDear').checked) ? 'dear' : 'hi',
      greetingBody: String(g('cpPuEdGreetBody')).trim(),
      heroImageUrl: st.heroImageUrl || '',
      highlight: {
        imageUrl: st.highlightImageUrl || '',
        heading: String(g('cpPuEdHlHead')).trim(),
        body: String(g('cpPuEdHlBody')).trim()
      },
      signName: String(g('cpPuEdSignName')).trim(),
      signRole: String(g('cpPuEdSignRole')).trim(),
      inProgress: [],
      awaitingApproval: [],
      palette: [],
      completed: [],
      comingUp: []
    };
    (st.inProgress || []).forEach(function(row, i) {
      doc.inProgress.push({
        room: String(g('cpPuEdIpRoom' + i)).trim(),
        item: String(g('cpPuEdIpItem' + i)).trim(),
        note: String(g('cpPuEdIpNote' + i)).trim(),
        percent: Math.max(0, Math.min(100, parseInt(g('cpPuEdIpPct' + i), 10) || 0)),
        imageUrl: row.imageUrl || ''
      });
    });
    (st.awaitingApproval || []).forEach(function(row, i) {
      doc.awaitingApproval.push({
        name: String(g('cpPuEdApName' + i)).trim(),
        sub: String(g('cpPuEdApSub' + i)).trim(),
        needsDecision: gn('cpPuEdApDec' + i),
        imageUrl: row.imageUrl || ''
      });
    });
    (st.palette || []).forEach(function(row, i) {
      doc.palette.push({ name: String(g('cpPuEdPalName' + i)).trim(), imageUrl: row.imageUrl || '' });
    });
    (st.completed || []).forEach(function(row, i) {
      doc.completed.push({ label: String(g('cpPuEdDoneLabel' + i)).trim(), thumbUrl: row.thumbUrl || '' });
    });
    (st.comingUp || []).forEach(function(row, i) {
      doc.comingUp.push({
        week: String(g('cpPuEdCuWeek' + i)).trim(),
        detail: String(g('cpPuEdCuDetail' + i)).trim(),
        soft: gn('cpPuEdCuSoft' + i)
      });
    });
    return doc;
  }

  function puEditorImgSlotHtml(slotKey, url, label) {
    var thumbId = 'cpPuEdThumb_' + String(slotKey).replace(/:/g, '_');
    var thumb = url
      ? '<img src="' + puEscAttr(url) + '" alt="" style="width:100%;height:100%;object-fit:cover;" referrerpolicy="no-referrer">'
      : '<div style="width:100%;height:100%;background:linear-gradient(135deg,#c9cec2,#aeb7b0);display:flex;align-items:center;justify-content:center;font-size:10px;color:#6B7280;">No image</div>';
    return '<div style="margin-bottom:10px;">' +
      '<div style="font-size:10px;font-weight:600;color:#5C6B80;margin-bottom:6px;">' + puEsc(label) + '</div>' +
      '<div style="display:flex;gap:10px;align-items:flex-start;">' +
        '<div id="' + thumbId + '" style="width:88px;height:66px;border:1px solid #E2E2E2;overflow:hidden;flex-shrink:0;">' + thumb + '</div>' +
        '<div style="display:flex;flex-direction:column;gap:4px;">' +
          '<label class="btn btn-secondary btn-sm" style="font-size:10px;padding:4px 8px;cursor:pointer;margin:0;">Upload<input type="file" accept="image/*" style="display:none;" onchange=' + puOnclickAttr('cpPuEditorUploadFile(' + JSON.stringify(slotKey) + ',this)') + '></label>' +
          '<button type="button" class="btn btn-secondary btn-sm" style="font-size:10px;padding:4px 8px;" onclick=' + puOnclickAttr('cpPuEditorPickProjectImage(' + JSON.stringify(slotKey) + ')') + '>From room / board</button>' +
          '<button type="button" class="btn btn-secondary btn-sm" style="font-size:10px;padding:4px 8px;" onclick=' + puOnclickAttr('cpPuEditorClearImage(' + JSON.stringify(slotKey) + ')') + '>Clear</button>' +
        '</div></div></div>';
  }

  function puEditorRowHeader(title, addFn) {
    return '<div style="display:flex;justify-content:space-between;align-items:center;margin:18px 0 10px;">' +
      '<div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#0A1F3D;">' + puEsc(title) + '</div>' +
      '<button type="button" class="btn btn-secondary btn-sm" style="font-size:10px;padding:4px 10px;" onclick="' + addFn + '">+ Add row</button></div>';
  }

  function puEditorRenderBody(st) {
    var d = st.doc;
    var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">' +
      '<div><label style="font-size:10px;font-weight:600;color:#5C6B80;">Title</label><input id="cpPuEdTitle" class="form-input" style="width:100%;font-size:12px;" value="' + puEscAttr(d.title || '') + '"></div>' +
      '<div><label style="font-size:10px;font-weight:600;color:#5C6B80;">Period label</label><input id="cpPuEdPeriod" class="form-input" style="width:100%;font-size:12px;" value="' + puEscAttr(d.period || '') + '" placeholder="February 1–14, 2026"></div>' +
      '<div><label style="font-size:10px;font-weight:600;color:#5C6B80;">Period start</label><input id="cpPuEdPeriodStart" type="date" class="form-input" style="width:100%;font-size:12px;" value="' + puEscAttr(d.periodStart || '') + '"></div>' +
      '<div><label style="font-size:10px;font-weight:600;color:#5C6B80;">Period end</label><input id="cpPuEdPeriodEnd" type="date" class="form-input" style="width:100%;font-size:12px;" value="' + puEscAttr(d.periodEnd || '') + '"></div></div>';

    html += puEditorImgSlotHtml('hero', st.heroImageUrl, 'Cover / hero image');

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:10px;">' +
      '<div><label style="font-size:10px;font-weight:600;color:#5C6B80;">Greeting name</label><input id="cpPuEdGreetName" class="form-input" style="width:100%;font-size:12px;" value="' + puEscAttr(d.greetingName || '') + '"></div>' +
      '<div><label style="font-size:10px;font-weight:600;color:#5C6B80;">Greeting style</label><div style="margin-top:6px;font-size:12px;">' +
        '<label style="margin-right:14px;"><input type="radio" name="cpPuEdGreetStyle" id="cpPuEdGreetHi" ' + (d.greetingStyle !== 'dear' ? 'checked' : '') + '> Hi</label>' +
        '<label><input type="radio" name="cpPuEdGreetStyle" id="cpPuEdGreetDear" ' + (d.greetingStyle === 'dear' ? 'checked' : '') + '> Dear</label></div></div></div>' +
      '<div style="margin-bottom:14px;"><label style="font-size:10px;font-weight:600;color:#5C6B80;">Greeting body</label><textarea id="cpPuEdGreetBody" class="form-textarea" rows="3" style="width:100%;font-size:12px;">' + puEsc(d.greetingBody || '') + '</textarea></div>';

    html += puEditorRowHeader('In Progress', 'cpPuEditorAddRow("inProgress")');
    (st.inProgress || []).forEach(function(row, i) {
      html += '<div style="border:1px solid #E2E2E2;padding:12px;margin-bottom:10px;background:#FAFAFA;">' +
        '<div style="display:flex;justify-content:flex-end;margin-bottom:6px;"><button type="button" class="btn btn-secondary btn-sm" style="font-size:9px;padding:2px 8px;" onclick="cpPuEditorRemoveRow(\'inProgress\',' + i + ')">Remove</button></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 80px;gap:8px;margin-bottom:8px;">' +
          '<input id="cpPuEdIpRoom' + i + '" class="form-input" placeholder="Room" style="font-size:11px;" value="' + puEscAttr(row.room || '') + '">' +
          '<input id="cpPuEdIpItem' + i + '" class="form-input" placeholder="Item / render label" style="font-size:11px;" value="' + puEscAttr(row.item || '') + '">' +
          '<input id="cpPuEdIpPct' + i + '" class="form-input" type="number" min="0" max="100" placeholder="%" style="font-size:11px;" value="' + puEscAttr(row.percent != null ? row.percent : '') + '"></div>' +
        '<textarea id="cpPuEdIpNote' + i + '" class="form-textarea" rows="2" placeholder="Note" style="width:100%;font-size:11px;margin-bottom:8px;">' + puEsc(row.note || '') + '</textarea>' +
        puEditorImgSlotHtml('inProgress:' + i, row.imageUrl, 'Room image') + '</div>';
    });

    html += puEditorRowHeader('This Period\'s Highlight', '');
    html += '<div style="border:1px solid #E2E2E2;padding:12px;margin-bottom:14px;background:#FAFAFA;">' +
      puEditorImgSlotHtml('highlight', st.highlightImageUrl, 'Highlight image') +
      '<input id="cpPuEdHlHead" class="form-input" placeholder="Heading" style="width:100%;font-size:11px;margin-bottom:8px;" value="' + puEscAttr((d.highlight || {}).heading || '') + '">' +
      '<textarea id="cpPuEdHlBody" class="form-textarea" rows="3" placeholder="Body" style="width:100%;font-size:11px;">' + puEsc((d.highlight || {}).body || '') + '</textarea></div>';

    html += puEditorRowHeader('Awaiting Approval', 'cpPuEditorAddRow("awaitingApproval")');
    (st.awaitingApproval || []).forEach(function(row, i) {
      html += '<div style="border:1px solid #E2E2E2;padding:12px;margin-bottom:10px;background:#FAFAFA;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
          '<label style="font-size:11px;"><input type="checkbox" id="cpPuEdApDec' + i + '" ' + (row.needsDecision ? 'checked' : '') + '> Needs decision</label>' +
          '<button type="button" class="btn btn-secondary btn-sm" style="font-size:9px;padding:2px 8px;" onclick="cpPuEditorRemoveRow(\'awaitingApproval\',' + i + ')">Remove</button></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">' +
          '<input id="cpPuEdApName' + i + '" class="form-input" placeholder="Name" style="font-size:11px;" value="' + puEscAttr(row.name || '') + '">' +
          '<input id="cpPuEdApSub' + i + '" class="form-input" placeholder="Sub / room" style="font-size:11px;" value="' + puEscAttr(row.sub || '') + '"></div>' +
        puEditorImgSlotHtml('awaitingApproval:' + i, row.imageUrl, 'Approval image') + '</div>';
    });

    html += puEditorRowHeader('Material Palette', 'cpPuEditorAddRow("palette")');
    (st.palette || []).forEach(function(row, i) {
      html += '<div style="border:1px solid #E2E2E2;padding:12px;margin-bottom:10px;background:#FAFAFA;">' +
        '<div style="display:flex;justify-content:flex-end;margin-bottom:6px;"><button type="button" class="btn btn-secondary btn-sm" style="font-size:9px;padding:2px 8px;" onclick="cpPuEditorRemoveRow(\'palette\',' + i + ')">Remove</button></div>' +
        '<input id="cpPuEdPalName' + i + '" class="form-input" placeholder="Material name" style="width:100%;font-size:11px;margin-bottom:8px;" value="' + puEscAttr(row.name || '') + '">' +
        puEditorImgSlotHtml('palette:' + i, row.imageUrl, 'Swatch image (optional)') + '</div>';
    });

    html += puEditorRowHeader('Recently Completed', 'cpPuEditorAddRow("completed")');
    (st.completed || []).forEach(function(row, i) {
      html += '<div style="border:1px solid #E2E2E2;padding:12px;margin-bottom:10px;background:#FAFAFA;">' +
        '<div style="display:flex;justify-content:flex-end;margin-bottom:6px;"><button type="button" class="btn btn-secondary btn-sm" style="font-size:9px;padding:2px 8px;" onclick="cpPuEditorRemoveRow(\'completed\',' + i + ')">Remove</button></div>' +
        '<input id="cpPuEdDoneLabel' + i + '" class="form-input" placeholder="Label" style="width:100%;font-size:11px;margin-bottom:8px;" value="' + puEscAttr(row.label || '') + '">' +
        puEditorImgSlotHtml('completed:' + i, row.thumbUrl, 'Thumbnail') + '</div>';
    });

    html += puEditorRowHeader('Coming Up', 'cpPuEditorAddRow("comingUp")');
    (st.comingUp || []).forEach(function(row, i) {
      html += '<div style="border:1px solid #E2E2E2;padding:12px;margin-bottom:10px;background:#FAFAFA;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
          '<label style="font-size:11px;"><input type="checkbox" id="cpPuEdCuSoft' + i + '" ' + (row.soft ? 'checked' : '') + '> Tentative</label>' +
          '<button type="button" class="btn btn-secondary btn-sm" style="font-size:9px;padding:2px 8px;" onclick="cpPuEditorRemoveRow(\'comingUp\',' + i + ')">Remove</button></div>' +
        '<input id="cpPuEdCuWeek' + i + '" class="form-input" placeholder="Week label" style="width:100%;font-size:11px;margin-bottom:8px;" value="' + puEscAttr(row.week || '') + '">' +
        '<textarea id="cpPuEdCuDetail' + i + '" class="form-textarea" rows="2" placeholder="Detail" style="width:100%;font-size:11px;">' + puEsc(row.detail || '') + '</textarea></div>';
    });

    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px;">' +
      '<div><label style="font-size:10px;font-weight:600;color:#5C6B80;">Sign name</label><input id="cpPuEdSignName" class="form-input" style="width:100%;font-size:12px;" value="' + puEscAttr(d.signName || '') + '"></div>' +
      '<div><label style="font-size:10px;font-weight:600;color:#5C6B80;">Sign role</label><input id="cpPuEdSignRole" class="form-input" style="width:100%;font-size:12px;" value="' + puEscAttr(d.signRole || '') + '"></div></div>';

    return html;
  }

  function puEditorSyncStateFromDoc(doc) {
    doc = doc || {};
    return {
      projectId: '',
      updateId: '',
      doc: doc,
      heroImageUrl: doc.heroImageUrl || '',
      highlightImageUrl: (doc.highlight || {}).imageUrl || '',
      inProgress: (doc.inProgress || []).map(function(r) { return Object.assign({}, r); }),
      awaitingApproval: (doc.awaitingApproval || []).map(function(r) { return Object.assign({}, r); }),
      palette: (doc.palette || []).map(function(r) { return Object.assign({}, r); }),
      completed: (doc.completed || []).map(function(r) { return Object.assign({ thumbUrl: r.thumbUrl || '' }, r); }),
      comingUp: (doc.comingUp || []).map(function(r) { return Object.assign({}, r); })
    };
  }

  function puEditorSetImage(slotKey, url) {
    var st = window._cpPuEditorState;
    if (!st) return;
    url = String(url || '').trim();
    if (slotKey === 'hero') st.heroImageUrl = url;
    else if (slotKey === 'highlight') st.highlightImageUrl = url;
    else if (slotKey.indexOf('inProgress:') === 0) {
      var i = parseInt(slotKey.split(':')[1], 10);
      if (st.inProgress[i]) st.inProgress[i].imageUrl = url;
    } else if (slotKey.indexOf('awaitingApproval:') === 0) {
      var a = parseInt(slotKey.split(':')[1], 10);
      if (st.awaitingApproval[a]) st.awaitingApproval[a].imageUrl = url;
    } else if (slotKey.indexOf('palette:') === 0) {
      var p = parseInt(slotKey.split(':')[1], 10);
      if (st.palette[p]) st.palette[p].imageUrl = url;
    } else if (slotKey.indexOf('completed:') === 0) {
      var c = parseInt(slotKey.split(':')[1], 10);
      if (st.completed[c]) st.completed[c].thumbUrl = url;
    }
    var thumbId = 'cpPuEdThumb_' + String(slotKey).replace(/:/g, '_');
    var el = document.getElementById(thumbId);
    if (el) {
      el.innerHTML = url
        ? '<img src="' + puEscAttr(url) + '" alt="" style="width:100%;height:100%;object-fit:cover;" referrerpolicy="no-referrer">'
        : '<div style="width:100%;height:100%;background:linear-gradient(135deg,#c9cec2,#aeb7b0);display:flex;align-items:center;justify-content:center;font-size:10px;color:#6B7280;">No image</div>';
    }
    if (url) void puEditorAutosaveDraftFlush();
  }

  var _puAutosaveTimer = null;
  var _puAutosavePromise = null;

  function puEditorAutosaveDraft() {
    var st = window._cpPuEditorState;
    if (!st || !st.projectId || !st.updateId) return;
    clearTimeout(_puAutosaveTimer);
    _puAutosaveTimer = setTimeout(function() { void puEditorAutosaveDraftFlush(); }, 400);
  }

  /** Write full draft doc — queued so back-to-back image uploads cannot drop the first save. */
  async function puEditorAutosaveDraftFlush() {
    var st = window._cpPuEditorState;
    if (!st || !st.projectId || !st.updateId) return;
    if (_puAutosavePromise) {
      st._puAutosavePending = true;
      return _puAutosavePromise;
    }
    var database = puDb();
    if (!database) return;
    var partial = puEditorReadForm();
    if (!partial) return;
    var now = new Date().toISOString();
    partial.updatedAt = now;
    var existingStatus = String((st.doc && st.doc.status) || 'draft');
    partial.status = existingStatus === 'published' ? 'published' : 'draft';
    if (existingStatus === 'published' && st.doc && st.doc.publishedAt) partial.publishedAt = st.doc.publishedAt;
    partial.createdAt = partial.createdAt || (st.doc && st.doc.createdAt) || now;
    partial.createdBy = partial.createdBy || (st.doc && st.doc.createdBy) ||
      ((typeof currentUser !== 'undefined' && currentUser && currentUser.email) || 'studio');
    var docRef = database.collection('boards').doc(st.projectId).collection('progressUpdates').doc(st.updateId);
    _puAutosavePromise = docRef.set(partial, { merge: true }).then(function() {
      st.isPersisted = true;
      st.doc = Object.assign({}, st.doc || {}, partial);
    }).catch(function(e) {
      console.warn('[cpPu] autosave draft', e);
    }).finally(function() {
      _puAutosavePromise = null;
      if (st._puAutosavePending) {
        st._puAutosavePending = false;
        void puEditorAutosaveDraftFlush();
      }
    });
    return _puAutosavePromise;
  }

  window.cpPuEditorClearImage = function(slotKey) { puEditorSetImage(slotKey, ''); };

  window.cpPuShouldDeferPortalRefresh = function() {
    return !!document.getElementById('cpPuEditorOverlay');
  };

  window.cpPuScheduleDeferredPortalRefresh = function(projectId, focusProposalId, forcedPage) {
    window._cpPuDeferPortalRefresh = {
      projectId: projectId,
      focusProposalId: focusProposalId == null ? null : focusProposalId,
      forcedPage: forcedPage == null ? null : forcedPage,
      at: Date.now()
    };
  };

  window.cpPuFlushDeferredPortalRefresh = function() {
    var d = window._cpPuDeferPortalRefresh;
    if (!d || !d.projectId) return;
    window._cpPuDeferPortalRefresh = null;
    var hash = String(location.hash || '');
    if (hash.indexOf('/clientview/' + d.projectId) < 0) return;
    if (typeof renderClientPortal === 'function') {
      void renderClientPortal(d.projectId, d.focusProposalId, d.forcedPage);
    }
  };

  function puEditorCloseOverlay() {
    window.cpPuClosePickOverlay();
    var ov = document.getElementById('cpPuEditorOverlay');
    if (ov) ov.remove();
    window._cpPuEditorState = null;
    void window.cpPuFlushDeferredPortalRefresh();
  }

  /** Confirm above editor/picker overlays (cchDialog uses z-index 1200 — too low). */
  function puEditorConfirm(message, title, opts) {
    opts = opts || {};
    return new Promise(function(resolve) {
      var prev = document.getElementById('cpPuConfirmOverlay');
      if (prev) prev.remove();
      var wrap = document.createElement('div');
      wrap.id = 'cpPuConfirmOverlay';
      wrap.style.cssText = 'position:fixed;inset:0;z-index:7000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:20px;';
      var confirmText = opts.confirmText || 'Confirm';
      var cancelText = opts.cancelText || 'Cancel';
      var danger = !!opts.danger;
      wrap.innerHTML =
        '<div style="background:#fff;width:min(420px,92vw);border:1px solid #E2E2E2;box-shadow:0 12px 40px rgba(0,0,0,0.2);" onclick="event.stopPropagation()">' +
          '<div style="padding:14px 16px;border-bottom:1px solid #E2E2E2;font-size:14px;font-weight:600;color:#0A1F3D;">' + puEsc(title || 'Confirm') + '</div>' +
          '<div style="padding:14px 16px;font-size:13px;line-height:1.55;color:#0F1A2E;white-space:pre-wrap;">' + puEsc(message || '') + '</div>' +
          '<div style="padding:12px 16px;border-top:1px solid #E2E2E2;display:flex;justify-content:flex-end;gap:8px;">' +
            '<button type="button" id="cpPuConfirmCancel" class="btn btn-secondary" style="font-size:12px;">' + puEsc(cancelText) + '</button>' +
            '<button type="button" id="cpPuConfirmOk" class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" style="font-size:12px;">' + puEsc(confirmText) + '</button>' +
          '</div></div>';
      function done(ok) {
        try { document.removeEventListener('keydown', onKey, true); } catch (_e) {}
        wrap.remove();
        resolve(!!ok);
      }
      function onKey(ev) {
        if (ev.key === 'Escape' || ev.keyCode === 27) { ev.preventDefault(); done(false); }
      }
      wrap.onclick = function(e) { if (e.target === wrap) done(false); };
      wrap.querySelector('#cpPuConfirmCancel').onclick = function() { done(false); };
      wrap.querySelector('#cpPuConfirmOk').onclick = function() { done(true); };
      document.body.appendChild(wrap);
      document.addEventListener('keydown', onKey, true);
    });
  }

  function puEditorRequestClose() {
    puEditorConfirm(
      'Close the editor? Image uploads auto-save; unsaved text may be lost.',
      'Close editor',
      { confirmText: 'Close' }
    ).then(function(ok) {
      if (ok) puEditorCloseOverlay();
    });
  }
  window.puEditorRequestClose = puEditorRequestClose;

  function puFirebaseStorageRef() {
    try {
      if (typeof storage !== 'undefined' && storage && typeof storage.ref === 'function') return storage;
      if (typeof firebase !== 'undefined' && firebase.storage) return firebase.storage();
    } catch (_e) {}
    return null;
  }

  function puGuessImageContentType(file, path) {
    if (file && file.type && String(file.type).indexOf('image/') === 0) return file.type;
    var ext = String((file && file.name) || path || '').split('.').pop().toLowerCase();
    if (ext === 'png') return 'image/png';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'svg') return 'image/svg+xml';
    if (ext === 'heic' || ext === 'heif') return 'image/heic';
    return 'image/jpeg';
  }

  /** Upload to Firebase Storage — works in Studio (index.html) and client portal (client.html). */
  async function puUploadImageToStorage(file, path) {
    if (typeof uploadImageToStorage === 'function') return uploadImageToStorage(file, path);
    var stor = puFirebaseStorageRef();
    if (!stor) throw new Error('Firebase Storage not available on this page');
    var signedIn = false;
    try {
      if (typeof auth !== 'undefined' && auth.currentUser) signedIn = true;
      else if (firebase.auth && firebase.auth().currentUser) signedIn = true;
    } catch (_a) {}
    if (!signedIn) throw new Error('Sign in to CCH Studio to upload images');
    if (!path) path = 'boards/progressUpdates/' + Date.now() + '-' + String(file.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
    var ref = stor.ref(path);
    var meta = { contentType: puGuessImageContentType(file, path) };
    await ref.put(file, meta);
    return await ref.getDownloadURL();
  }

  window.cpPuEditorUploadFile = async function(slotKey, input) {
    var st = window._cpPuEditorState;
    if (!st || !input || !input.files || !input.files[0]) return;
    var file = input.files[0];
    try {
      if (typeof showToast === 'function') showToast('Uploading image…');
      var safe = String(file.name || 'image').replace(/[^a-zA-Z0-9._-]/g, '_');
      var path = 'boards/' + st.projectId + '/progressUpdates/' + st.updateId + '/' + Date.now() + '-' + safe;
      var url = await puUploadImageToStorage(file, path);
      puEditorSetImage(slotKey, url);
      await puEditorAutosaveDraftFlush();
      if (typeof showToast === 'function') showToast('Image uploaded');
    } catch (e) {
      console.error('[cpPuEditorUploadFile]', e);
      if (typeof showToast === 'function') showToast('Upload failed: ' + (e.message || e), 'error');
    }
    input.value = '';
  };

  function puRenderableImageUrl(u) {
    u = String(u || '').trim();
    if (!u || u.indexOf('data:') === 0 || u.indexOf('blob:') === 0) return '';
    if (typeof cchInvoiceImageUrlIsRenderable === 'function' && !cchInvoiceImageUrlIsRenderable(u)) return '';
    if (/^https?:\/\//i.test(u) || u.indexOf('firebasestorage.googleapis.com') >= 0) return u;
    if (typeof _resolveImgSrc === 'function') {
      var resolved = String(_resolveImgSrc(u) || '').trim();
      if (resolved && (/^https?:\/\//i.test(resolved) || resolved.indexOf('firebasestorage.googleapis.com') >= 0)) return resolved;
    }
    return '';
  }

  function puClipImageUrl(clip) {
    clip = clip || {};
    try {
      if (typeof cchPickPreferredProductImageUrl === 'function') {
        var pref = puRenderableImageUrl(cchPickPreferredProductImageUrl(clip));
        if (pref) return pref;
      }
    } catch (_e0) {}
    try {
      if (typeof cchProposalLineImagesFromSource === 'function') {
        var pack = cchProposalLineImagesFromSource(clip);
        if (pack && pack.imageUrl) {
          var fromPack = puRenderableImageUrl(pack.imageUrl);
          if (fromPack) return fromPack;
        }
      }
    } catch (_e1) {}
    return puRenderableImageUrl(clip.imageUrl || clip.image || clip.thumbnail || clip.thumb || '');
  }

  function puEscImgSrc(u) {
    u = puRenderableImageUrl(u);
    if (!u) return '';
    if (typeof _escImgSrcAttr === 'function') return _escImgSrcAttr(u);
    return puEscAttr(u);
  }

  function puCoerceImageList(arr) {
    if (!arr) return [];
    return Array.isArray(arr) ? arr : [];
  }

  /** Room-board clips + inspiration boards, grouped for the picker dropdowns. */
  window.cpPuLoadImagePickerData = async function(projectId) {
    var out = { rooms: [], inspiration: [] };
    var database = puDb();
    if (!database || !projectId) return out;
    var roomMap = {};
    var seenUrl = {};
    function pushItem(bucket, id, label, url, sub) {
      url = puRenderableImageUrl(url);
      if (!url || seenUrl[url]) return;
      seenUrl[url] = true;
      if (!bucket[id]) bucket[id] = { id: id, label: label, items: [] };
      bucket[id].items.push({ url: url, label: sub || label });
    }
    try {
      var clipSnap = await database.collection('boards').doc(projectId).collection('clips').limit(500).get();
      clipSnap.forEach(function(doc) {
        var cd = Object.assign({ id: doc.id }, doc.data() || {});
        if (typeof boardClipIsTimeBillingRow === 'function' && boardClipIsTimeBillingRow(cd)) return;
        var room = String(cd.room || cd.roomName || 'Unassigned').trim() || 'Unassigned';
        var url = puClipImageUrl(cd);
        if (!url) return;
        pushItem(roomMap, room, room, url, String(cd.title || cd.name || 'Item').trim());
        puCoerceImageList(cd.images).forEach(function(u, i) {
          var iu = typeof u === 'string' ? u : (u && (u.imageUrl || u.url));
          pushItem(roomMap, room, room, iu, String(cd.title || 'Item').trim() + ' (' + (i + 2) + ')');
        });
      });
    } catch (e) { console.warn('[cpPu] room clips', e); }
    out.rooms = Object.keys(roomMap).sort(function(a, b) { return a.localeCompare(b, undefined, { sensitivity: 'base' }); })
      .map(function(k) { return roomMap[k]; })
      .filter(function(g) { return g.items && g.items.length; });

    var ibMap = {};
    try {
      var ibSnap = await database.collection('boards').doc(projectId).collection('ideabooks').limit(80).get();
      ibSnap.forEach(function(doc) {
        var bd = doc.data() || {};
        var name = String(bd.title || bd.name || 'Inspiration board').trim() || 'Inspiration board';
        puCoerceImageList(bd.images).forEach(function(entry, i) {
          var url = typeof entry === 'string' ? entry : (entry && (entry.imageUrl || entry.url || entry.src));
          var cap = typeof entry === 'object' && entry ? String(entry.caption || entry.title || '').trim() : '';
          pushItem(ibMap, doc.id, name, url, cap || ('Image ' + (i + 1)));
        });
      });
    } catch (e2) { console.warn('[cpPu] ideabooks', e2); }
    out.inspiration = Object.keys(ibMap).sort(function(a, b) {
      return (ibMap[a].label || '').localeCompare(ibMap[b].label || '', undefined, { sensitivity: 'base' });
    }).map(function(k) { return ibMap[k]; }).filter(function(g) { return g.items && g.items.length; });

    return out;
  };

  window.cpPuClosePickOverlay = function() {
    var ov = document.getElementById('cpPuPickOverlay');
    if (!ov) return;
    if (ov._cpPuPickEsc) {
      try { document.removeEventListener('keydown', ov._cpPuPickEsc, true); } catch (_e) {}
      ov._cpPuPickEsc = null;
    }
    ov.remove();
  };

  window.cpPuForceCloseAllPuModals = function() {
    var confirmOv = document.getElementById('cpPuConfirmOverlay');
    if (confirmOv) confirmOv.remove();
    window.cpPuClosePickOverlay();
    puEditorCloseOverlay();
  };

  function puPickGroupsForSource(state) {
    if (!state || !state.data) return [];
    return state.source === 'inspiration' ? (state.data.inspiration || []) : (state.data.rooms || []);
  }

  function puPickActiveGroup(state) {
    var groups = puPickGroupsForSource(state);
    if (!groups.length) return null;
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].id === state.groupId) return groups[i];
    }
    return groups[0];
  }

  function puPickRenderGrid(overlay) {
    var state = overlay._cpPuPickState;
    var grid = overlay.querySelector('#cpPuPickGrid');
    var countEl = overlay.querySelector('#cpPuPickCount');
    if (!grid || !state) return;
    var group = puPickActiveGroup(state);
    if (!group || !group.items.length) {
      grid.innerHTML = '<div style="font-size:13px;color:#6B7280;padding:12px 0;">No images in this ' +
        (state.source === 'inspiration' ? 'board' : 'room') + ' yet. Try another or upload from computer.</div>';
      if (countEl) countEl.textContent = '';
      return;
    }
    if (countEl) countEl.textContent = group.items.length + ' image' + (group.items.length === 1 ? '' : 's');
    grid.innerHTML = group.items.map(function(im) {
      var src = puEscImgSrc(im.url);
      return '<button type="button" data-pu-pick-url="' + puEscAttr(im.url) + '" style="border:1px solid #E2E2E2;padding:0;background:#fff;cursor:pointer;text-align:left;width:132px;">' +
        (src
          ? '<img src="' + src + '" alt="" style="width:132px;height:99px;object-fit:cover;display:block;" referrerpolicy="no-referrer" onerror="this.style.display=\'none\'">'
          : '<div style="width:132px;height:99px;background:#ECEFF3;display:flex;align-items:center;justify-content:center;font-size:10px;color:#6B7280;">No preview</div>') +
        '<span style="display:block;font-size:10px;padding:5px 6px;color:#5C6B80;max-width:132px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + puEsc(im.label || 'Image') + '</span></button>';
    }).join('');
  }

  function puPickOverlayBind(overlay) {
    var state = overlay._cpPuPickState;
    var sourceSel = overlay.querySelector('#cpPuPickSource');
    var groupSel = overlay.querySelector('#cpPuPickGroup');
    var sourceLabel = overlay.querySelector('#cpPuPickGroupLabel');
    var grid = overlay.querySelector('#cpPuPickGrid');

    function refreshGroupOptions() {
      if (!groupSel || !state) return;
      var groups = puPickGroupsForSource(state);
      if (!groups.length) {
        groupSel.innerHTML = '<option value="">— None —</option>';
        state.groupId = '';
        puPickRenderGrid(overlay);
        return;
      }
      if (!state.groupId || !groups.some(function(g) { return g.id === state.groupId; })) {
        state.groupId = groups[0].id;
      }
      groupSel.innerHTML = groups.map(function(g) {
        return '<option value="' + puEscAttr(g.id) + '"' + (g.id === state.groupId ? ' selected' : '') + '>' +
          puEsc(g.label) + ' (' + g.items.length + ')</option>';
      }).join('');
      puPickRenderGrid(overlay);
    }

    if (sourceSel) {
      sourceSel.value = state.source;
      sourceSel.onchange = function() {
        state.source = sourceSel.value === 'inspiration' ? 'inspiration' : 'rooms';
        if (sourceLabel) sourceLabel.textContent = state.source === 'inspiration' ? 'Inspiration board' : 'Room';
        state.groupId = '';
        refreshGroupOptions();
      };
    }
    if (groupSel) {
      groupSel.onchange = function() {
        state.groupId = groupSel.value || '';
        puPickRenderGrid(overlay);
      };
    }
    if (grid) {
      grid.addEventListener('click', function(e) {
        var btn = e.target && e.target.closest && e.target.closest('[data-pu-pick-url]');
        if (!btn || !state) return;
        e.preventDefault();
        e.stopPropagation();
        var url = btn.getAttribute('data-pu-pick-url') || '';
        if (!url) return;
        window.cpPuEditorApplyPick(state.slotKey, url);
      });
    }
    var closeBtn = overlay.querySelector('#cpPuPickCloseX');
    var cancelBtn = overlay.querySelector('#cpPuPickCancel');
    if (closeBtn) closeBtn.onclick = function(e) { e.stopPropagation(); window.cpPuClosePickOverlay(); };
    if (cancelBtn) cancelBtn.onclick = function(e) { e.stopPropagation(); window.cpPuClosePickOverlay(); };
    overlay.onclick = function(e) { if (e.target === overlay) window.cpPuClosePickOverlay(); };
    overlay._cpPuPickEsc = function(ev) {
      if (ev.key === 'Escape' || ev.keyCode === 27) {
        ev.preventDefault();
        ev.stopPropagation();
        window.cpPuClosePickOverlay();
      }
    };
    document.addEventListener('keydown', overlay._cpPuPickEsc, true);
    refreshGroupOptions();
  }

  window.cpPuCollectProjectImages = async function(projectId) {
    var flat = [];
    var data = await cpPuLoadImagePickerData(projectId);
    (data.rooms || []).concat(data.inspiration || []).forEach(function(g) {
      (g.items || []).forEach(function(im) { flat.push({ url: im.url, label: (g.label || '') + ' · ' + (im.label || 'Image') }); });
    });
    return flat;
  };

  window.cpPuEditorPickProjectImage = async function(slotKey) {
    var st = window._cpPuEditorState;
    if (!st) return;
    window.cpPuClosePickOverlay();
    var data;
    try {
      data = await cpPuLoadImagePickerData(st.projectId);
    } catch (e) {
      console.error('[cpPuEditorPickProjectImage]', e);
      if (typeof showToast === 'function') showToast('Could not load project images', 'error');
      return;
    }
    if (!data.rooms.length && !data.inspiration.length) {
      if (typeof showToast === 'function') showToast('No room board or inspiration images yet — upload from computer.', 'warning');
      return;
    }
    var source = data.rooms.length ? 'rooms' : 'inspiration';
    var groups = source === 'rooms' ? data.rooms : data.inspiration;
    var overlay = document.createElement('div');
    overlay.id = 'cpPuPickOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:6001;display:flex;align-items:center;justify-content:center;padding:24px;';
    overlay._cpPuPickState = {
      slotKey: slotKey,
      data: data,
      source: source,
      groupId: groups[0] ? groups[0].id : ''
    };
    var hasRooms = data.rooms.length > 0;
    var hasIb = data.inspiration.length > 0;
    var sourceOpts = (hasRooms ? '<option value="rooms">Room Board</option>' : '') +
      (hasIb ? '<option value="inspiration">Inspiration Board</option>' : '');
    overlay.innerHTML =
      '<div style="background:#fff;width:min(760px,96vw);max-height:88vh;display:flex;flex-direction:column;border-radius:4px;box-shadow:0 12px 40px rgba(0,0,0,0.2);" onclick="event.stopPropagation()">' +
        '<div style="padding:14px 18px;border-bottom:1px solid #E2E2E2;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">' +
          '<div><strong style="font-size:15px;">Add from Room / Inspiration Board</strong>' +
          '<div style="font-size:11px;color:#6B7280;margin-top:3px;">Same sources as Design Boards — pick a room or board, then click an image.</div></div>' +
          '<button type="button" id="cpPuPickCloseX" style="border:none;background:none;font-size:22px;cursor:pointer;line-height:1;">&times;</button></div>' +
        '<div style="padding:14px 18px 0;display:grid;grid-template-columns:1fr 1fr;gap:12px;flex-shrink:0;">' +
          '<div><label style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9CA3AF;display:block;margin-bottom:4px;">Source</label>' +
            '<select id="cpPuPickSource" class="form-input" style="width:100%;font-size:13px;font-weight:600;">' + sourceOpts + '</select></div>' +
          '<div><label id="cpPuPickGroupLabel" style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#9CA3AF;display:block;margin-bottom:4px;">' +
            (source === 'inspiration' ? 'Inspiration board' : 'Room') + '</label>' +
            '<select id="cpPuPickGroup" class="form-input" style="width:100%;font-size:13px;font-weight:600;"></select></div></div>' +
        '<div style="padding:8px 18px 0;font-size:11px;color:#6B7280;flex-shrink:0;"><span id="cpPuPickCount"></span></div>' +
        '<div id="cpPuPickGrid" style="padding:14px 18px;overflow:auto;flex:1;display:flex;flex-wrap:wrap;gap:10px;align-content:flex-start;min-height:120px;"></div>' +
        '<div style="padding:12px 18px;border-top:1px solid #E2E2E2;display:flex;justify-content:flex-end;flex-shrink:0;">' +
          '<button type="button" class="btn btn-secondary" id="cpPuPickCancel">Cancel</button></div></div>';
    document.body.appendChild(overlay);
    puPickOverlayBind(overlay);
  };

  window.cpPuEditorApplyPick = function(slotKey, url) {
    window.cpPuClosePickOverlay();
    puEditorSetImage(slotKey, url);
    void puEditorAutosaveDraftFlush();
  };

  window.cpPuEditorAddRow = function(section) {
    var st = window._cpPuEditorState;
    if (!st) return;
    var partial = puEditorReadForm();
    st.doc = partial;
    st.heroImageUrl = partial.heroImageUrl;
    st.highlightImageUrl = partial.highlight.imageUrl;
    st.inProgress = partial.inProgress;
    st.awaitingApproval = partial.awaitingApproval;
    st.palette = partial.palette;
    st.completed = partial.completed;
    st.comingUp = partial.comingUp;
    if (section === 'inProgress') st.inProgress.push({ room: '', item: '', note: '', percent: 0, imageUrl: '' });
    else if (section === 'awaitingApproval') st.awaitingApproval.push({ name: '', sub: '', needsDecision: false, imageUrl: '' });
    else if (section === 'palette') st.palette.push({ name: '', imageUrl: '' });
    else if (section === 'completed') st.completed.push({ label: '', thumbUrl: '' });
    else if (section === 'comingUp') st.comingUp.push({ week: '', detail: '', soft: false });
    var body = document.getElementById('cpPuEditorBody');
    if (body) body.innerHTML = puEditorRenderBody(st);
  };

  window.cpPuEditorRemoveRow = function(section, idx) {
    var st = window._cpPuEditorState;
    if (!st) return;
    var partial = puEditorReadForm();
    st.doc = partial;
    st.heroImageUrl = partial.heroImageUrl;
    st.highlightImageUrl = partial.highlight.imageUrl;
    st.inProgress = partial.inProgress;
    st.awaitingApproval = partial.awaitingApproval;
    st.palette = partial.palette;
    st.completed = partial.completed;
    st.comingUp = partial.comingUp;
    if (section === 'inProgress') st.inProgress.splice(idx, 1);
    else if (section === 'awaitingApproval') st.awaitingApproval.splice(idx, 1);
    else if (section === 'palette') st.palette.splice(idx, 1);
    else if (section === 'completed') st.completed.splice(idx, 1);
    else if (section === 'comingUp') st.comingUp.splice(idx, 1);
    var body = document.getElementById('cpPuEditorBody');
    if (body) body.innerHTML = puEditorRenderBody(st);
  };

  window.cpPuPreviewUpdate = async function(projectId, updateId) {
    var database = puDb();
    if (!database) return;
    projectId = String(projectId || '').trim();
    updateId = String(updateId || '').trim();
    var doc = null;
    try {
      var snap = await database.collection('boards').doc(projectId).collection('progressUpdates').doc(updateId).get();
      if (snap.exists) doc = Object.assign({ id: snap.id }, snap.data());
    } catch (e) {}
    if (!doc) {
      if (typeof showToast === 'function') showToast('Update not found', 'error');
      return;
    }
    var projName = projectId;
    try {
      var b = await database.collection('boards').doc(projectId).get();
      if (b.exists) projName = (b.data() || {}).name || (b.data() || {}).projectName || projectId;
    } catch (e) {}
    puInjectStyles();
    var overlay = document.createElement('div');
    overlay.id = 'cpPuPreviewOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:5000;overflow:auto;padding:20px;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    var inner = typeof cpPuRenderDetail === 'function'
      ? cpPuRenderDetail(doc, projectId, projName, '#/clientview/' + projectId)
      : '<div style="padding:40px;color:#6B7280;">Preview unavailable.</div>';
    overlay.innerHTML = '<div style="max-width:920px;margin:0 auto;background:#F7F5F0;position:relative;">' +
      '<button type="button" onclick="document.getElementById(\'cpPuPreviewOverlay\').remove()" style="position:sticky;top:12px;float:right;margin:12px 12px 0 0;border:1px solid #E2E2E2;background:#fff;padding:6px 14px;font-size:12px;cursor:pointer;z-index:2;">✕ Close</button>' +
      '<div style="clear:both;">' + inner + '</div></div>';
    document.body.appendChild(overlay);
  };

  function cpPuAfterUpdateMutation(projectId) {
    var hash = String(location.hash || '');
    if (typeof renderClientPortal === 'function' && hash.indexOf('/clientview/' + projectId) >= 0) {
      if (/\/updates\/[^/?#]+/.test(hash)) {
        var dest = '#/clientview/' + projectId + '/updates';
        if (typeof navigate === 'function') navigate(dest);
        else location.hash = dest;
      } else {
        void renderClientPortal(projectId);
      }
      return;
    }
    if (typeof renderProjectDetail === 'function' && hash.indexOf('/project/' + projectId) >= 0) {
      void renderProjectDetail();
    }
  }

  window.cpPuDeleteUpdate = async function(projectId, updateId) {
    if (!puStudioAdmin()) {
      if (typeof showToast === 'function') showToast('Admin only', 'warning');
      return;
    }
    projectId = String(projectId || '').trim();
    updateId = String(updateId || '').trim();
    if (!projectId || !updateId) return;
    var database = puDb();
    if (!database) return;
    var snap;
    try {
      snap = await database.collection('boards').doc(projectId).collection('progressUpdates').doc(updateId).get();
    } catch (e) {
      if (typeof showToast === 'function') showToast('Delete failed: ' + (e.message || e), 'error');
      return;
    }
    if (!snap.exists) {
      var ov0 = document.getElementById('cpPuEditorOverlay');
      if (ov0) ov0.remove();
      if (typeof showToast === 'function') showToast('Nothing to delete (unsaved draft)', 'warning');
      return;
    }
    var data = snap.data() || {};
    var label = puPeriodLabel(Object.assign({ id: updateId }, data)) || updateId;
    var msg = updateId === SEED_DOC_ID
      ? 'Delete the Rolling Hills sample update?\n\nThis removes the demo seed (' + label + ').'
      : 'Delete this bi-weekly update?\n\n' + label + '\n\nThis cannot be undone.';
    var confirmed = await puEditorConfirm(msg, 'Delete update', { confirmText: 'Delete', danger: true });
    if (!confirmed) return;
    try {
      await database.collection('boards').doc(projectId).collection('progressUpdates').doc(updateId).delete();
      var ov = document.getElementById('cpPuEditorOverlay');
      if (ov) puEditorCloseOverlay();
      if (typeof showToast === 'function') showToast('Update deleted');
      cpPuAfterUpdateMutation(projectId);
    } catch (e) {
      if (typeof showToast === 'function') showToast('Delete failed: ' + (e.message || e), 'error');
    }
  };

  window.cpPuEditorSave = async function(publish) {
    var st = window._cpPuEditorState;
    if (!st) return;
    var database = puDb();
    if (!database) return;
    clearTimeout(_puAutosaveTimer);
    if (_puAutosavePromise) {
      try { await _puAutosavePromise; } catch (_eWait) {}
    }
    var partial = puEditorReadForm();
    if (!partial) return;
    var now = new Date().toISOString();
    partial.updatedAt = now;
    partial.status = publish ? 'published' : 'draft';
    if (publish) partial.publishedAt = now;
    if (!partial.createdAt) partial.createdAt = now;
    partial.createdBy = partial.createdBy || ((typeof currentUser !== 'undefined' && currentUser && currentUser.email) || 'studio');
    try {
      await database.collection('boards').doc(st.projectId).collection('progressUpdates').doc(st.updateId).set(partial, { merge: true });
      st.isPersisted = true;
      st.doc = Object.assign({}, st.doc || {}, partial);
      if (publish) {
        await database.collection('boards').doc(st.projectId).collection('whatsNew').add({
          text: 'New bi-weekly design update' + (partial.period ? ': ' + partial.period : ''),
          photoUrl: partial.heroImageUrl || '',
          progressUpdateId: st.updateId,
          createdAt: now,
          createdBy: (typeof currentUser !== 'undefined' && currentUser && currentUser.email) || ''
        });
        var ovPub = document.getElementById('cpPuEditorOverlay');
        if (ovPub) puEditorCloseOverlay();
        if (typeof showToast === 'function') showToast('Bi-weekly update published');
        cpPuAfterUpdateMutation(st.projectId);
      } else {
        if (typeof showToast === 'function') showToast('Draft saved — images stored');
      }
    } catch (e) {
      if (typeof showToast === 'function') showToast('Save failed: ' + (e.message || e), 'error');
    }
  };

  window.cpPuOpenEditorModal = async function(projectId, updateId) {
    if (!puStudioAdmin()) {
      if (typeof showToast === 'function') showToast('Admin only', 'warning');
      return;
    }
    var database = puDb();
    if (!database) return;
    projectId = String(projectId || '').trim();
    var heroUrl = '';
    var boardData = {};
    try {
      var b = await database.collection('boards').doc(projectId).get();
      if (b.exists) {
        boardData = b.data() || {};
        heroUrl = String(boardData.heroImageUrl || '').trim();
      }
    } catch (e) {}
    var doc;
    var isPersisted = false;
    if (updateId) {
      try {
        var snap = await database.collection('boards').doc(projectId).collection('progressUpdates').doc(updateId).get();
        doc = snap.exists ? Object.assign({ id: snap.id }, snap.data()) : null;
        isPersisted = !!snap.exists;
      } catch (e) { doc = null; }
      if (!doc) {
        if (typeof showToast === 'function') showToast('Update not found', 'error');
        return;
      }
      updateId = String(updateId);
    } else {
      updateId = 'update-' + Date.now();
      doc = puEditorBlankDoc(heroUrl, boardData);
    }
    window._cpPuEditorState = puEditorSyncStateFromDoc(doc);
    window._cpPuEditorState.projectId = projectId;
    window._cpPuEditorState.updateId = updateId;
    window._cpPuEditorState.isPersisted = isPersisted;
    window._cpPuEditorState.proj = boardData;
    var overlay = document.createElement('div');
    overlay.id = 'cpPuEditorOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:5000;display:flex;align-items:center;justify-content:center;padding:20px;';
    /* Backdrop click intentionally disabled — accidental clicks while scrolling were closing the editor. */
    var deleteBtn = isPersisted
      ? '<button type="button" class="btn btn-secondary" style="color:#B45309;border-color:rgba(180,83,9,0.35);" onclick=' + puOnclickAttr('cpPuDeleteUpdate(' + JSON.stringify(projectId) + ',' + JSON.stringify(updateId) + ')') + '>Delete</button>'
      : '<span></span>';
    overlay.innerHTML = '<div style="background:#fff;width:min(920px,96vw);max-height:92vh;display:flex;flex-direction:column;border-radius:4px;box-shadow:0 12px 40px rgba(0,0,0,0.2);" onclick="event.stopPropagation()">' +
      '<div style="padding:14px 18px;border-bottom:1px solid #E2E2E2;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">' +
        '<div><strong style="font-size:15px;">Edit Bi-Weekly Update</strong>' +
        '<div style="font-size:10px;color:#9CA3AF;margin-top:2px;">' + puEsc(updateId) + (doc.status === 'draft' ? ' · DRAFT' : '') + '</div></div>' +
        '<button type="button" class="btn btn-secondary btn-sm" style="font-size:11px;margin-right:8px;" onclick=' + puOnclickAttr('cpPuDraftWithAI()') + '>✨ Draft with AI</button>' +
        '<button type="button" onclick="puEditorRequestClose()" title="Close editor" style="border:none;background:none;font-size:22px;cursor:pointer;line-height:1;">&times;</button></div>' +
      '<div id="cpPuEditorBody" style="padding:16px 18px;overflow:auto;flex:1;"></div>' +
      '<div style="padding:12px 18px;border-top:1px solid #E2E2E2;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-shrink:0;">' +
        deleteBtn +
        '<div style="display:flex;gap:10px;">' +
        '<button type="button" class="btn btn-secondary" onclick="cpPuEditorSave(false)">Save draft</button>' +
        '<button type="button" class="btn btn-primary" onclick="cpPuEditorSave(true)">Publish</button></div></div></div>';
    document.body.appendChild(overlay);
    document.getElementById('cpPuEditorBody').innerHTML = puEditorRenderBody(window._cpPuEditorState);
  };

  console.info('[CCH Progress Updates] build ' + BUILD);
  puBindNavDelegation();
})();
