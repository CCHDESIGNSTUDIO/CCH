const fs=require('fs');
let t=fs.readFileSync('platform/index.html','utf8');
const bad=t.indexOf('await db.collectioh');
if(bad===-1){console.log('not found');process.exit(1);}
const good=`        await db.collection('boards').doc(projectId).collection('clips').doc(clipId).update(updates);
        closeModal();
        renderProjectDetail();
      } catch(e) {
        alert('Save failed: ' + e.message);
      }
    }

    async function deleteClip(projectId, clipId) {
      if (!confirm('Delete this product? This cannot be undone.')) return;
      try {
        await db.collection('boards').doc(projectId).collection('clips').doc(clipId).delete();
        closeModal();
        renderProjectDetail();
      } catch(e) {
        alert('Delete failed: ' + e.message);
      }
    }

    function esc(t) { if (!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
    function escAttr(t) { if (!t) return ''; return t.replace(/&/g,'&amp;'); }

  </script>
</body>
</html>`;
t=t.substring(0,t.lastIndexOf('      } catc'))+good;
fs.writeFileSync('platform/index.html',t);
console.log('Done! Lines:',t.split('\n').length);