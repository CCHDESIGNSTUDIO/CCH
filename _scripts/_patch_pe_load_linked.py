path = r'c:\Users\cindy\Dropbox\CCH-Platform-Deploy\cch-deploy\platform\index.html'
text = open(path, encoding='utf-8').read()
idx = text.find('async function _peLoadLinkedDocs(productId)')
idx2 = text.find('async function _pdShowLinkedPopover(btnEl, productId)')
cstart = text.rfind('    //', 0, idx)
new_fn = r'''    // Edit modal: linked proposals / invoices / POs (isolated — not on library list).
    // Uses libraryProductId via plCollectLibraryProductRefsForImpact.
    // FLAG: full-board scan can be slow on large catalogs; optimize with indexed refs later.
    async function _peLoadLinkedDocs(productId) {
      var pid = String(productId || '').trim();
      var poEl = document.getElementById('peProductPOs');
      var invEl = document.getElementById('peProductInvoices');
      var propEl = document.getElementById('peProductProposals');
      if (!pid || (!propEl && !invEl && !poEl)) return;

      var loadSeq = (window._peLinkedLoadSeq = (window._peLinkedLoadSeq || 0) + 1);
      var busy = '<span style="color:var(--gray-400);">Scanning projects…</span>';
      if (poEl) poEl.innerHTML = busy;
      if (invEl) invEl.innerHTML = busy;
      if (propEl) propEl.innerHTML = busy;

      function stale() { return loadSeq !== window._peLinkedLoadSeq; }

      function renderDocGroup(refs, emptyMsg, urlPath) {
        if (!refs || !refs.length) {
          return '<span style="color:var(--gray-300);">' + emptyMsg + '</span>';
        }
        var byDoc = new Map();
        refs.forEach(function(r) {
          var docId = r.proposalId || r.invoiceId || r.poId;
          if (!docId || !r.projectId) return;
          var key = r.projectId + ':' + docId;
          if (byDoc.has(key)) return;
          var num = r.proposalNum || r.invoiceNum || r.poNum || docId.slice(0, 8);
          byDoc.set(key, {
            projectId: r.projectId,
            projectName: r.projectName || r.projectId,
            docId: docId,
            num: String(num)
          });
        });
        if (!byDoc.size) {
          return '<span style="color:var(--gray-300);">' + emptyMsg + '</span>';
        }
        var html = '';
        byDoc.forEach(function(v) {
          var href = '#/project/' + encodeURIComponent(v.projectId) + '/' + urlPath + '/' + encodeURIComponent(v.docId);
          html += '<div style="padding:4px 0;border-bottom:1px solid var(--gray-100);">' +
            '<a href="' + escAttr(href) + '" style="font-weight:600;color:#0A1F3D;text-decoration:underline;font-size:12px;">' + esc(v.num) + '</a>' +
            '<div style="font-size:10px;color:var(--gray-400);margin-top:2px;">' + esc(v.projectName) + '</div>' +
            '</div>';
        });
        return html;
      }

      function failAll(msg) {
        if (stale()) return;
        var m = '<span style="color:var(--gray-500);font-size:11px;">' + msg + '</span>';
        if (propEl) propEl.innerHTML = m;
        if (invEl) invEl.innerHTML = m;
        if (poEl) poEl.innerHTML = m;
      }

      try {
        if (typeof plCollectLibraryProductRefsForImpact !== 'function') {
          failAll('Link scanner unavailable.');
          return;
        }
        var coll = await plCollectLibraryProductRefsForImpact(pid);
        if (stale()) return;
        var groups = (coll && coll.groups) || {};
        if (propEl) propEl.innerHTML = renderDocGroup(groups.proposals, 'No linked proposals found', 'proposal');
        if (invEl) invEl.innerHTML = renderDocGroup(groups.invoices, 'No linked invoices found', 'invoice');
        if (poEl) poEl.innerHTML = renderDocGroup(groups.pos, 'No linked POs found', 'po');
      } catch (e) {
        failAll('Could not load linked docs. Try again or open from the project board.');
        console.warn('[peLoadLinkedDocs]', pid, e && e.message ? e.message : e);
      }
    }

'''
text = text[:cstart] + new_fn + text[idx2:]
open(path, 'w', encoding='utf-8').write(text)
print('ok', idx - cstart, '->', len(new_fn))
