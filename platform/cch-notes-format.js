/**
 * Shared safe Markdown → HTML for studio Notes + client portal.
 * Escape HTML first, then format. Never innerHTML raw user text.
 * Firestore source stays markdown in `text`.
 */
(function (global) {
  'use strict';

  function _esc(s) {
    if (typeof global.esc === 'function') return global.esc(s);
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cchFormatProjectNoteHtml(text) {
    var src = String(text == null ? '' : text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!String(src).trim()) return '';

    function inlineMd(s) {
      var t = _esc(s);
      t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      t = t.replace(/(^|[^\*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
      return t;
    }

    var out = [];
    var items = []; // { level, type, html }
    var listType = null;

    function flushList() {
      if (!items.length) return;
      var html = '';
      var i = 0;
      function renderLevel(level) {
        var tag = listType || 'ul';
        var buf = '<' + tag + ' class="note-md-' + tag + '">';
        while (i < items.length && items[i].level === level) {
          buf += '<li>' + items[i].html;
          i++;
          if (i < items.length && items[i].level > level) {
            buf += renderLevel(level + 1);
          }
          buf += '</li>';
        }
        buf += '</' + tag + '>';
        return buf;
      }
      html = renderLevel(0);
      out.push(html);
      items = [];
      listType = null;
    }

    src.split('\n').forEach(function (line) {
      var m;
      if (/^\s*$/.test(line)) { flushList(); return; }
      if ((m = /^###\s+(.+)$/.exec(line))) { flushList(); out.push('<h4 class="note-md-h">' + inlineMd(m[1]) + '</h4>'); return; }
      if ((m = /^##\s+(.+)$/.exec(line))) { flushList(); out.push('<h3 class="note-md-h">' + inlineMd(m[1]) + '</h3>'); return; }
      if ((m = /^#\s+(.+)$/.exec(line))) { flushList(); out.push('<h2 class="note-md-h">' + inlineMd(m[1]) + '</h2>'); return; }
      if ((m = /^(\s*)([-*])\s+(.+)$/.exec(line))) {
        var lvl = Math.min(2, Math.floor(m[1].replace(/\t/g, '  ').length / 2));
        if (listType && listType !== 'ul') flushList();
        listType = 'ul';
        items.push({ level: lvl, type: 'ul', html: inlineMd(m[3]) });
        return;
      }
      if ((m = /^(\s*)(\d+)\.\s+(.+)$/.exec(line))) {
        var lvlN = Math.min(2, Math.floor(m[1].replace(/\t/g, '  ').length / 2));
        if (listType && listType !== 'ol') flushList();
        listType = 'ol';
        items.push({ level: lvlN, type: 'ol', html: inlineMd(m[3]) });
        return;
      }
      flushList();
      out.push('<p class="note-md-p">' + inlineMd(line) + '</p>');
    });
    flushList();
    return out.join('');
  }

  global.cchFormatProjectNoteHtml = cchFormatProjectNoteHtml;
})(typeof window !== 'undefined' ? window : global);
