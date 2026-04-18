// ==================== CCH CLIENT BOARD VIEWER ====================
// Luxury client-facing board experience
// Dark aesthetic, masonry grid, star/comment, designer dashboard
// Loads from Firestore design board data

(function() {
  'use strict';

  var cbState = {
    projectId: null,
    boardId: null,
    boardData: null,
    items: [],
    stars: {},
    comments: {},
    newComment: '',
    filter: 'all',
    view: 'welcome', // welcome, board, detail, dashboard
    selectedItem: null,
    hovered: null,
    clientName: 'Client'
  };
  window.cbState = cbState;

  var GOLD = '#C8A96E';
  var DARK = '#1A1714';
  var CREAM = '#F5F0E8';
  var MUTED = '#A09882';
  var DIM = '#6B6456';

  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  function fmt$(n) { return '$' + (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

  // SVG Icons
  var starSvg = function(filled, size) {
    size = size || 18;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="' + (filled ? GOLD : 'none') + '" stroke="' + (filled ? GOLD : 'currentColor') + '" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';
  };
  var commentSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>';
  var chevronLeft = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15 18l-6-6 6-6"/></svg>';
  var chevronRight = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 18l6-6-6-6"/></svg>';
  var dashSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12h4l3-9 4 18 3-9h4"/></svg>';

  // ==================== LOAD CLIENT BOARD ====================
  window.openClientBoard = async function(projectId, boardId) {
    cbState.projectId = projectId;
    cbState.boardId = boardId;
    cbState.view = 'welcome';
    cbState.stars = {};
    cbState.comments = {};
    cbState.selectedItem = null;
    cbState.filter = 'all';

    // Load board data
    try {
      var doc = await db.collection('boards').doc(projectId).collection('designBoards').doc(boardId).get();
      if (!doc.exists) throw new Error('Board not found');
      cbState.boardData = doc.data() || {};
    } catch(e) {
      document.getElementById('contentArea').innerHTML = '<div style="padding:60px;text-align:center;color:#999;">Board not found.</div>';
      return;
    }

    // Extract product items from elements
    cbState.items = (cbState.boardData.elements || []).filter(function(el) {
      return el.type === 'product';
    }).map(function(el, idx) {
      var pack = (typeof window.cchProposalLineImagesFromSource === 'function')
        ? window.cchProposalLineImagesFromSource(el)
        : { images: el.imageUrl ? [el.imageUrl] : [], imageUrl: el.imageUrl || '', heroImageIndex: 0 };
      return {
        id: el.clipId || el.id || ('item_' + idx),
        title: el.title || 'Untitled',
        vendor: el.vendor || '',
        price: el.sellPrice ? fmt$(el.sellPrice) : '',
        cost: el.cost || 0,
        sellPrice: el.sellPrice || 0,
        imageUrl: pack.imageUrl || el.imageUrl || '',
        images: pack.images || [],
        heroImageIndex: pack.heroImageIndex || 0,
        annotation: el.annotation || ''
      };
    });

    // Load project info for client name
    try {
      var projDoc = await db.collection('projects').doc(projectId).get();
      var proj = projDoc.data();
      cbState.clientName = proj.clientName || proj.name || 'Client';
    } catch(e) {}

    // Load saved stars/comments from Firestore
    try {
      var interDoc = await db.collection('boards').doc(projectId).collection('designBoards').doc(boardId).collection('interactions').doc('data').get();
      if (interDoc.exists) {
        var d = interDoc.data();
        cbState.stars = d.stars || {};
        cbState.comments = d.comments || {};
      }
    } catch(e) {}

    renderClientBoard();

    // Auto-dismiss welcome after 3s
    setTimeout(function() {
      if (cbState.view === 'welcome') {
        cbState.view = 'board';
        renderClientBoard();
      }
    }, 3000);
  };

  // ==================== SAVE INTERACTIONS ====================
  async function saveInteractions() {
    try {
      await db.collection('boards').doc(cbState.projectId).collection('designBoards').doc(cbState.boardId).collection('interactions').doc('data').set({
        stars: cbState.stars,
        comments: cbState.comments,
        updatedAt: new Date().toISOString()
      });
    } catch(e) { console.log('Save error:', e); }
  }

  function toggleStar(id, e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    cbState.stars[id] = !cbState.stars[id];
    saveInteractions();
    renderClientBoard();
  }

  function addComment(itemId) {
    var input = document.getElementById('cb-comment-input');
    var text = input ? input.value.trim() : '';
    if (!text) return;
    if (!cbState.comments[itemId]) cbState.comments[itemId] = [];
    cbState.comments[itemId].push({
      text: text,
      author: cbState.clientName,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    if (input) input.value = '';
    saveInteractions();
    renderClientBoard();
  }
  window._cbAddComment = addComment;

  // ==================== RENDER ====================
  function renderClientBoard() {
    var C = document.getElementById('contentArea');
    var bd = cbState.boardData;
    var boardTitle = bd.title || 'Design Board';
    var boardRoom = bd.room || '';

    if (cbState.view === 'welcome') {
      C.innerHTML = renderWelcome(boardTitle);
      return;
    }
    if (cbState.view === 'detail' && cbState.selectedItem) {
      C.innerHTML = renderDetail();
      return;
    }
    if (cbState.view === 'dashboard') {
      C.innerHTML = renderDashboard(boardTitle);
      return;
    }

    // Board view
    var starCount = Object.values(cbState.stars).filter(Boolean).length;
    var displayItems = cbState.filter === 'starred' ? cbState.items.filter(function(i) { return cbState.stars[i.id]; }) : cbState.items;

    C.innerHTML =
      '<div style="width:100%;min-height:100vh;background:' + DARK + ';font-family:\'Cormorant Garamond\',Garamond,Georgia,serif;color:' + CREAM + ';">' +

        // Top bar
        '<div style="padding:20px 32px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(200,169,110,0.12);position:sticky;top:0;background:rgba(21,42,69,0.96);backdrop-filter:blur(20px);z-index:10;">' +
          '<div><span style="font-family:Playfair Display,Georgia,serif;font-size:14px;font-weight:700;color:#C4A052;letter-spacing:2px;">CCH</span><span style="font-family:Cormorant Garamond,Georgia,serif;font-size:11px;letter-spacing:3px;color:' + MUTED + ';text-transform:uppercase;margin-left:6px;">Design Inc.</span></div>' +
          '<div style="display:flex;align-items:center;gap:16px;">' +
            '<button onclick="cbSetView(\'dashboard\')" style="background:none;border:1px solid rgba(200,169,110,0.2);border-radius:4px;padding:8px 16px;color:' + MUTED + ';cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-family:inherit;">' + dashSvg + ' Dashboard</button>' +
            '<button onclick="closeCB()" style="background:none;border:1px solid rgba(200,169,110,0.2);border-radius:4px;padding:8px 16px;color:' + MUTED + ';cursor:pointer;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-family:inherit;">← Back to Project</button>' +
          '</div>' +
        '</div>' +

        // Header
        '<div style="padding:48px 32px 32px;max-width:1200px;margin:0 auto;">' +
          '<div style="font-size:11px;letter-spacing:3px;color:' + MUTED + ';text-transform:uppercase;margin-bottom:8px;">Prepared for ' + esc(cbState.clientName) + '</div>' +
          '<h1 style="font-size:44px;font-weight:300;margin:0 0 4px;font-family:\'Playfair Display\',Georgia,serif;letter-spacing:1px;">' + esc(boardTitle) + '</h1>' +
          (boardRoom ? '<div style="font-size:16px;color:' + MUTED + ';margin-bottom:32px;">' + esc(boardRoom) + '</div>' : '<div style="margin-bottom:32px;"></div>') +

          // Filter bar
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;">' +
            '<div style="display:flex;gap:4px;">' +
              filterBtn('all', 'All (' + cbState.items.length + ')') +
              filterBtn('starred', 'Starred (' + starCount + ')') +
            '</div>' +
            '<div style="font-size:12px;color:' + DIM + ';">★ Star your favorites · Click to comment</div>' +
          '</div>' +
        '</div>' +

        // Masonry grid
        '<div style="max-width:1200px;margin:0 auto;padding:0 32px 64px;">' +
          (displayItems.length === 0 ?
            '<div style="text-align:center;padding:80px 0;color:' + DIM + ';">' + starSvg(false, 32) + '<div style="font-size:18px;margin-top:16px;font-style:italic;">No starred items yet</div><div style="font-size:14px;margin-top:8px;">Browse the collection and star pieces that speak to you</div></div>'
          :
            '<div style="columns:3 280px;column-gap:20px;">' +
            displayItems.map(function(item) {
              var isHovered = cbState.hovered === item.id;
              var isStarred = cbState.stars[item.id];
              var commentCount = (cbState.comments[item.id] || []).length;

              return '<div style="break-inside:avoid;margin-bottom:20px;position:relative;cursor:pointer;border-radius:4px;overflow:hidden;" ' +
                'onmouseenter="cbHover(\'' + item.id + '\')" onmouseleave="cbHover(null)" onclick="cbOpenDetail(\'' + item.id + '\')">' +

                '<img src="' + esc(item.imageUrl) + '" style="width:100%;display:block;border-radius:4px;" onerror="this.style.background=\'#2a2520\';this.style.height=\'200px\';">' +

                // Overlay
                '<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(26,23,20,0.85) 0%,rgba(26,23,20,0.1) 50%,rgba(26,23,20,0.3) 100%);border-radius:4px;display:flex;flex-direction:column;justify-content:flex-end;padding:20px;">' +

                  // Star button
                  '<div onclick="event.stopPropagation();cbToggleStar(\'' + item.id + '\')" style="position:absolute;top:12px;right:12px;background:' + (isStarred ? 'rgba(200,169,110,0.2)' : 'rgba(26,23,20,0.5)') + ';border:1px solid rgba(200,169,110,0.3);border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:' + GOLD + ';backdrop-filter:blur(8px);transition:all 0.3s ease;">' +
                    starSvg(isStarred) +
                  '</div>' +

                  // Comment badge
                  (commentCount > 0 ? '<div style="position:absolute;top:12px;left:12px;background:rgba(26,23,20,0.6);backdrop-filter:blur(8px);border:1px solid rgba(200,169,110,0.2);border-radius:20px;padding:4px 10px;display:flex;align-items:center;gap:4px;color:' + GOLD + ';font-size:12px;">' + commentSvg + ' ' + commentCount + '</div>' : '') +

                  // Bottom info
                  '<div>' +
                    '<div style="font-size:17px;font-weight:400;margin-bottom:2px;font-family:\'Playfair Display\',Georgia,serif;">' + esc(item.title) + '</div>' +
                    '<div style="font-size:12px;color:' + GOLD + ';letter-spacing:1.5px;text-transform:uppercase;">' + esc(item.vendor) + '</div>' +
                    (item.price ? '<div style="font-size:14px;color:' + MUTED + ';margin-top:4px;">' + esc(item.price) + '</div>' : '') +
                  '</div>' +
                '</div>' +
              '</div>';
            }).join('') +
            '</div>'
          ) +
        '</div>' +

        // Footer
        '<div style="padding:32px;text-align:center;border-top:1px solid rgba(200,169,110,0.08);">' +
          '<div style="font-size:14px;font-family:Playfair Display,Georgia,serif;font-weight:700;color:#C4A052;letter-spacing:2px;">CCH <span style="font-family:Cormorant Garamond,Georgia,serif;font-size:11px;letter-spacing:4px;color:' + DIM + ';text-transform:uppercase;font-weight:400;">Design Inc. · Est. 2004</span></div>' +
          '<div style="font-size:11px;color:#4A4438;margin-top:8px;">Star items you love · Click any image to comment · Your selections help us refine your vision</div>' +
        '</div>' +
      '</div>';
  }

  // ==================== WELCOME SCREEN ====================
  function renderWelcome(boardTitle) {
    return '<div style="width:100%;height:100vh;display:flex;align-items:center;justify-content:center;background:' + DARK + ';font-family:\'Playfair Display\',Georgia,serif;" onclick="cbState.view=\'board\';renderClientBoard();">' +
      '<div style="text-align:center;animation:cbFadeIn 1s ease;">' +
        '<div style="font-size:11px;letter-spacing:6px;color:' + GOLD + ';margin-bottom:24px;text-transform:uppercase;font-family:\'Cormorant Garamond\',Garamond,Georgia,serif;">Curated for you by</div>' +
        '<div style="display:inline-flex;align-items:center;gap:2px;margin-bottom:4px;">' +
          '<span style="font-size:52px;font-weight:700;color:#C4A052;letter-spacing:3px;">CCH</span>' +
        '</div>' +
        '<div style="font-family:\'Cormorant Garamond\',Georgia,serif;font-size:14px;letter-spacing:5px;color:' + CREAM + ';text-transform:uppercase;">Design Inc.</div>' +
        '<div style="width:60px;height:1px;background:' + GOLD + ';margin:20px auto;opacity:0.6;"></div>' +
        '<div style="font-size:14px;color:' + MUTED + ';letter-spacing:3px;text-transform:uppercase;font-family:\'Cormorant Garamond\',Garamond,Georgia,serif;">' + esc(boardTitle) + '</div>' +
      '</div>' +
      '<style>@keyframes cbFadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}</style>' +
    '</div>';
  }

  // ==================== DETAIL VIEW ====================
  function renderDetail() {
    var item = cbState.selectedItem;
    if (!item) return '';
    var itemComments = cbState.comments[item.id] || [];

    return '<div style="width:100%;min-height:100vh;background:' + DARK + ';font-family:\'Cormorant Garamond\',Garamond,Georgia,serif;color:' + CREAM + ';">' +
      // Header
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:20px 32px;border-bottom:1px solid rgba(200,169,110,0.12);">' +
        '<button onclick="cbSetView(\'board\')" style="background:none;border:none;color:' + MUTED + ';cursor:pointer;display:flex;align-items:center;gap:8px;font-size:13px;letter-spacing:2px;text-transform:uppercase;font-family:inherit;">' + chevronLeft + ' Back to Board</button>' +
        '<div style="font-family:Playfair Display,Georgia,serif;font-size:14px;font-weight:700;color:#C4A052;letter-spacing:2px;">CCH <span style="font-family:Cormorant Garamond,Georgia,serif;font-size:11px;letter-spacing:3px;color:' + MUTED + ';text-transform:uppercase;font-weight:400;">Design Inc.</span></div>' +
      '</div>' +

      '<div style="display:flex;max-width:1200px;margin:0 auto;padding:40px 32px;gap:48px;flex-wrap:wrap;">' +
        // Image
        '<div style="flex:1 1 55%;min-width:300px;position:relative;">' +
          '<button onclick="cbNav(\'prev\')" style="position:absolute;left:-20px;top:50%;transform:translateY(-50%);background:rgba(26,23,20,0.8);border:1px solid rgba(200,169,110,0.2);border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:' + GOLD + ';z-index:2;">' + chevronLeft + '</button>' +
          '<img src="' + esc(item.imageUrl) + '" style="width:100%;border-radius:4px;display:block;">' +
          '<button onclick="cbNav(\'next\')" style="position:absolute;right:-20px;top:50%;transform:translateY(-50%);background:rgba(26,23,20,0.8);border:1px solid rgba(200,169,110,0.2);border-radius:50%;width:40px;height:40px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:' + GOLD + ';z-index:2;">' + chevronRight + '</button>' +
        '</div>' +

        // Info panel
        '<div style="flex:1 1 35%;min-width:280px;">' +
          '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;">' +
            '<div>' +
              '<h2 style="font-size:28px;font-weight:400;margin:0;line-height:1.3;font-family:\'Playfair Display\',Georgia,serif;">' + esc(item.title) + '</h2>' +
              '<div style="font-size:13px;color:' + GOLD + ';letter-spacing:2px;text-transform:uppercase;margin-top:8px;">' + esc(item.vendor) + '</div>' +
              (item.price ? '<div style="font-size:18px;color:' + MUTED + ';margin-top:8px;">' + esc(item.price) + '</div>' : '') +
            '</div>' +
            '<div onclick="cbToggleStar(\'' + item.id + '\')" style="background:' + (cbState.stars[item.id] ? 'rgba(200,169,110,0.15)' : 'none') + ';border:1px solid rgba(200,169,110,0.3);border-radius:50%;width:44px;height:44px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:' + GOLD + ';flex-shrink:0;">' + starSvg(cbState.stars[item.id], 22) + '</div>' +
          '</div>' +

          (item.annotation ? '<div style="font-size:14px;color:' + MUTED + ';font-style:italic;margin-bottom:16px;line-height:1.6;">' + esc(item.annotation) + '</div>' : '') +

          '<div style="width:100%;height:1px;background:rgba(200,169,110,0.12);margin:24px 0;"></div>' +

          // Comments
          '<div>' +
            '<div style="font-size:11px;letter-spacing:3px;color:' + MUTED + ';text-transform:uppercase;margin-bottom:16px;">Comments ' + (itemComments.length > 0 ? '(' + itemComments.length + ')' : '') + '</div>' +

            (itemComments.length === 0 ? '<div style="font-size:14px;color:' + DIM + ';font-style:italic;margin-bottom:16px;">Share your thoughts on this piece...</div>' : '') +

            '<div style="max-height:200px;overflow-y:auto;margin-bottom:16px;">' +
            itemComments.map(function(c) {
              return '<div style="margin-bottom:16px;padding-left:16px;border-left:2px solid rgba(200,169,110,0.2);">' +
                '<div style="font-size:14px;color:' + CREAM + ';line-height:1.6;">' + esc(c.text) + '</div>' +
                '<div style="font-size:11px;color:' + DIM + ';margin-top:4px;">' + esc(c.author) + ' · ' + esc(c.time) + '</div>' +
              '</div>';
            }).join('') +
            '</div>' +

            '<div style="display:flex;gap:8px;">' +
              '<input id="cb-comment-input" placeholder="Add a comment..." onkeydown="if(event.key===\'Enter\')_cbAddComment(\'' + item.id + '\')" style="flex:1;padding:12px 16px;background:rgba(245,240,232,0.05);border:1px solid rgba(200,169,110,0.15);border-radius:4px;color:' + CREAM + ';font-size:14px;font-family:inherit;outline:none;">' +
              '<button onclick="_cbAddComment(\'' + item.id + '\')" style="padding:12px 20px;background:' + GOLD + ';border:none;border-radius:4px;color:' + DARK + ';font-size:12px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;font-family:inherit;font-weight:600;">Send</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ==================== DASHBOARD ====================
  function renderDashboard(boardTitle) {
    var starCount = Object.values(cbState.stars).filter(Boolean).length;
    var commentCount = Object.values(cbState.comments).reduce(function(a, c) { return a + c.length; }, 0);
    var starredItems = cbState.items.filter(function(i) { return cbState.stars[i.id]; });
    var engagement = cbState.items.length > 0 ? Math.round(((starCount + commentCount) / cbState.items.length) * 100) : 0;

    return '<div style="width:100%;min-height:100vh;background:' + DARK + ';font-family:\'Cormorant Garamond\',Garamond,Georgia,serif;color:' + CREAM + ';">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:20px 32px;border-bottom:1px solid rgba(200,169,110,0.12);">' +
        '<button onclick="cbSetView(\'board\')" style="background:none;border:none;color:' + MUTED + ';cursor:pointer;display:flex;align-items:center;gap:8px;font-size:13px;letter-spacing:2px;text-transform:uppercase;font-family:inherit;">' + chevronLeft + ' Back to Board</button>' +
        '<div style="font-size:11px;letter-spacing:4px;color:' + GOLD + ';text-transform:uppercase;">Designer Dashboard</div>' +
      '</div>' +

      '<div style="max-width:900px;margin:0 auto;padding:48px 32px;">' +
        '<h1 style="font-size:36px;font-weight:300;margin:0 0 8px;font-family:\'Playfair Display\',Georgia,serif;">Client Activity</h1>' +
        '<div style="font-size:14px;color:' + MUTED + ';margin-bottom:48px;">' + esc(cbState.clientName) + ' · ' + esc(boardTitle) + '</div>' +

        // Stats
        '<div style="display:flex;gap:24px;margin-bottom:48px;flex-wrap:wrap;">' +
          statCard(cbState.items.length, 'Items Presented') +
          statCard(starCount, 'Starred') +
          statCard(commentCount, 'Comments') +
          statCard(engagement + '%', 'Engagement') +
        '</div>' +

        // Starred items
        '<div style="margin-bottom:48px;">' +
          '<div style="font-size:11px;letter-spacing:3px;color:' + GOLD + ';text-transform:uppercase;margin-bottom:20px;">Starred Selections (' + starCount + ')</div>' +
          (starCount === 0 ?
            '<div style="padding:32px;text-align:center;color:' + DIM + ';font-style:italic;border:1px dashed rgba(200,169,110,0.15);border-radius:4px;">No selections yet — client hasn\'t starred any items</div>'
          :
            '<div style="display:flex;flex-direction:column;gap:12px;">' +
            starredItems.map(function(item) {
              return '<div style="display:flex;align-items:center;gap:16px;padding:16px;background:rgba(200,169,110,0.05);border-radius:4px;border:1px solid rgba(200,169,110,0.1);">' +
                '<img src="' + esc(item.imageUrl) + '" style="width:56px;height:56px;object-fit:cover;border-radius:3px;">' +
                '<div style="flex:1;"><div style="font-size:16px;">' + esc(item.title) + '</div><div style="font-size:12px;color:' + MUTED + ';">' + esc(item.vendor) + (item.price ? ' · ' + esc(item.price) : '') + '</div></div>' +
                starSvg(true, 16) +
              '</div>';
            }).join('') +
            '</div>'
          ) +
        '</div>' +

        // Comment feed
        '<div>' +
          '<div style="font-size:11px;letter-spacing:3px;color:' + GOLD + ';text-transform:uppercase;margin-bottom:20px;">Comment Feed (' + commentCount + ')</div>' +
          (commentCount === 0 ?
            '<div style="padding:32px;text-align:center;color:' + DIM + ';font-style:italic;border:1px dashed rgba(200,169,110,0.15);border-radius:4px;">No comments yet</div>'
          :
            '<div style="display:flex;flex-direction:column;gap:12px;">' +
            cbState.items.filter(function(item) { return (cbState.comments[item.id] || []).length > 0; }).map(function(item) {
              return (cbState.comments[item.id] || []).map(function(c) {
                return '<div style="display:flex;gap:16px;padding:16px;background:rgba(245,240,232,0.03);border-radius:4px;border:1px solid rgba(200,169,110,0.08);">' +
                  '<img src="' + esc(item.imageUrl) + '" style="width:48px;height:48px;object-fit:cover;border-radius:3px;flex-shrink:0;">' +
                  '<div><div style="font-size:14px;line-height:1.6;margin-bottom:4px;">"' + esc(c.text) + '"</div><div style="font-size:11px;color:' + DIM + ';">on <span style="color:' + MUTED + ';">' + esc(item.title) + '</span> · ' + esc(c.author) + ' · ' + esc(c.time) + '</div></div>' +
                '</div>';
              }).join('');
            }).join('') +
            '</div>'
          ) +
        '</div>' +

        // Quick action: create proposal from starred
        (starCount > 0 ?
          '<div style="margin-top:48px;padding:24px;background:rgba(200,169,110,0.08);border-radius:4px;border:1px solid rgba(200,169,110,0.15);text-align:center;">' +
            '<div style="font-size:14px;color:' + MUTED + ';margin-bottom:12px;">' + starCount + ' starred items totaling ' + fmt$(starredItems.reduce(function(s, i) { return s + (i.sellPrice || 0); }, 0)) + '</div>' +
            '<button onclick="cbCreateProposal()" style="background:' + GOLD + ';border:none;border-radius:4px;padding:14px 32px;color:' + DARK + ';font-size:13px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;font-family:inherit;font-weight:600;">Create Proposal from Selections</button>' +
          '</div>'
        : '') +
      '</div>' +
    '</div>';
  }

  function statCard(value, label) {
    return '<div style="flex:1 1 180px;padding:24px;background:rgba(245,240,232,0.03);border:1px solid rgba(200,169,110,0.1);border-radius:4px;">' +
      '<div style="font-size:36px;color:' + GOLD + ';font-family:\'Playfair Display\',Georgia,serif;font-weight:300;">' + value + '</div>' +
      '<div style="font-size:11px;letter-spacing:3px;color:' + MUTED + ';text-transform:uppercase;margin-top:4px;">' + label + '</div>' +
    '</div>';
  }

  function filterBtn(key, label) {
    var active = cbState.filter === key;
    return '<button onclick="cbSetFilter(\'' + key + '\')" style="padding:8px 20px;background:' + (active ? 'rgba(200,169,110,0.12)' : 'transparent') + ';border:1px solid ' + (active ? 'rgba(200,169,110,0.3)' : 'transparent') + ';border-radius:4px;color:' + (active ? GOLD : DIM) + ';font-size:12px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;font-family:inherit;transition:all 0.3s ease;">' + label + '</button>';
  }

  // ==================== GLOBAL HANDLERS ====================
  window.cbSetView = function(v) { cbState.view = v; cbState.selectedItem = null; renderClientBoard(); };
  window.cbSetFilter = function(f) { cbState.filter = f; renderClientBoard(); };
  window.cbHover = function(id) { cbState.hovered = id; /* skip re-render for perf */ };

  window.cbToggleStar = function(id) { toggleStar(id); };

  window.cbOpenDetail = function(id) {
    cbState.selectedItem = cbState.items.find(function(i) { return i.id === id; });
    cbState.view = 'detail';
    renderClientBoard();
  };

  window.cbNav = function(dir) {
    if (!cbState.selectedItem) return;
    var idx = cbState.items.findIndex(function(i) { return i.id === cbState.selectedItem.id; });
    var next = dir === 'next' ? (idx + 1) % cbState.items.length : (idx - 1 + cbState.items.length) % cbState.items.length;
    cbState.selectedItem = cbState.items[next];
    renderClientBoard();
  };

  window.closeCB = function() {
    // Go back to the project's design boards tab
    navigate('#/project/' + cbState.projectId + '/designboards');
  };

  window.cbCreateProposal = async function() {
    var starredItems = cbState.items.filter(function(i) { return cbState.stars[i.id]; });
    if (starredItems.length === 0) return;

    var name = prompt('Proposal name:', (cbState.boardData.title || 'Board') + ' — Client Selections');
    if (!name) return;

    var items = starredItems.map(function(item) {
      var pack = (typeof window.cchProposalLineImagesFromSource === 'function')
        ? window.cchProposalLineImagesFromSource(item)
        : { images: item.imageUrl ? [item.imageUrl] : [], imageUrl: item.imageUrl || '', heroImageIndex: 0 };
      return {
        title: item.title,
        vendor: item.vendor,
        cost: item.cost || 0,
        sellingPrice: item.sellPrice || 0,
        clientPrice: item.sellPrice || 0,
        qty: 1,
        imageUrl: pack.imageUrl || item.imageUrl || '',
        images: pack.images || [],
        heroImageIndex: pack.heroImageIndex || 0,
        clipId: item.id || '',
        lineApprovalStatus: 'pending'
      };
    });

    var total = items.reduce(function(s, i) { return s + (i.clientPrice || 0); }, 0);

    try {
      var doc = await db.collection('boards').doc(cbState.projectId).collection('proposals').add({
        name: name,
        items: items,
        total: total,
        status: 'Draft',
        designBoardId: cbState.boardId,
        source: 'client-selections',
        createdAt: new Date().toISOString()
      });
      alert('Proposal created with ' + items.length + ' starred items (' + fmt$(total) + ')');
      navigate('#/project/' + cbState.projectId + '/proposal/' + doc.id);
    } catch(e) {
      alert('Error: ' + e.message);
    }
  };

})();
