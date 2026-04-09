/**
 * Add Timely Logged view to Smart Time
 * Shows Timely entries with approve/reject to push to Time Ledger
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'platform', 'index.html');
let html = fs.readFileSync(FILE, 'utf8');
const origLen = html.length;
let fixes = 0;

// 1. Add "Timely" tab button next to Smart Time / Reconciliation / Time Ledger
const tabArea = html.indexOf("TIME RECONCILIATION");
if (tabArea > 0) {
  const tabLine = html.lastIndexOf('<button', tabArea);
  // Find the end of the Time Ledger tab button
  const ledgerTab = html.indexOf('TIME LEDGER', tabArea);
  if (ledgerTab > 0) {
    const ledgerBtnEnd = html.indexOf('</button>', ledgerTab) + 9;
    if (ledgerBtnEnd > 9) {
      const timelyTab = '\n          <button class="time-tab ${smartTimeTab===\'timely\'?\'active\':\'\'}" onclick="smartTimeTab=\'timely\';renderTimeTracker()">⏱ TIMELY LOGGED</button>';
      // Check if already exists
      if (!html.includes('TIMELY LOGGED')) {
        html = html.slice(0, ledgerBtnEnd) + timelyTab + html.slice(ledgerBtnEnd);
        fixes++;
        console.log('✅ Timely Logged tab button added');
      }
    }
  }
}

// 2. Add the timely view rendering in the renderTimeView function
// Find where smartTimeTab is checked for different views
const tabSwitch = html.indexOf("smartTimeTab === 'ledger'");
if (tabSwitch > 0) {
  // Find the closing brace of the ledger condition
  // Add a new condition for timely tab
  const afterLedger = html.indexOf("} else", tabSwitch + 50);
  if (afterLedger > 0 && !html.includes("smartTimeTab === 'timely'")) {
    const timelyCondition = " else if (smartTimeTab === 'timely') {\n      renderTimelyLoggedView();\n      return;\n    }";
    html = html.slice(0, afterLedger) + timelyCondition + html.slice(afterLedger);
    fixes++;
    console.log('✅ Timely tab routing added');
  }
}

// 3. Add the renderTimelyLoggedView function
if (!html.includes('function renderTimelyLoggedView')) {
  const viewFunc = `
    async function renderTimelyLoggedView() {
      var T = document.getElementById('contentArea');
      T.innerHTML = '<div style="text-align:center;padding:60px;color:var(--gray-400);">Loading Timely entries...</div>';

      try {
        // Load from timelyEntries collection
        var snap = await db.collection('timelyEntries').orderBy('date', 'desc').limit(200).get();
        var entries = [];
        snap.forEach(function(d) { entries.push({id: d.id, ...d.data()}); });

        // Also check which ones are already in timeEntries (approved)
        var approvedIds = new Set();
        var teSnap = await db.collection('timeEntries').where('source', '==', 'timely').limit(500).get();
        teSnap.forEach(function(d) { var data = d.data(); if (data.timelyId) approvedIds.add(String(data.timelyId)); });

        // Group by date
        var byDate = {};
        entries.forEach(function(e) {
          var d = e.date || 'Unknown';
          if (!byDate[d]) byDate[d] = [];
          byDate[d].push(e);
        });
        var dates = Object.keys(byDate).sort().reverse();

        var totalHours = entries.reduce(function(s, e) { return s + (parseFloat(e.totalHours) || 0); }, 0);
        var pendingCount = entries.filter(function(e) { return !approvedIds.has(String(e.timelyId)); }).length;

        T.innerHTML =
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">' +
            '<h2 style="margin:0;font-size:18px;">⏱ Timely Logged Entries</h2>' +
            '<div style="display:flex;gap:8px;">' +
              '<button class="btn btn-primary btn-sm" onclick="approveAllTimely()">✓ Approve All Pending (' + pendingCount + ')</button>' +
              '<button class="btn btn-secondary btn-sm" onclick="syncTimelyNow()">🔄 Sync from Timely</button>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:16px;margin-bottom:20px;">' +
            '<div style="padding:12px 20px;background:rgba(200,185,154,0.08);border:1px solid rgba(200,185,154,0.15);flex:1;">' +
              '<div style="font-size:11px;color:var(--gray-400);text-transform:uppercase;">Total Entries</div>' +
              '<div style="font-size:24px;font-weight:700;color:var(--gold);font-family:monospace;">' + entries.length + '</div>' +
            '</div>' +
            '<div style="padding:12px 20px;background:rgba(200,185,154,0.08);border:1px solid rgba(200,185,154,0.15);flex:1;">' +
              '<div style="font-size:11px;color:var(--gray-400);text-transform:uppercase;">Total Hours</div>' +
              '<div style="font-size:24px;font-weight:700;color:var(--gold);font-family:monospace;">' + totalHours.toFixed(1) + 'h</div>' +
            '</div>' +
            '<div style="padding:12px 20px;background:rgba(200,185,154,0.08);border:1px solid rgba(200,185,154,0.15);flex:1;">' +
              '<div style="font-size:11px;color:var(--gray-400);text-transform:uppercase;">Pending Approval</div>' +
              '<div style="font-size:24px;font-weight:700;color:' + (pendingCount > 0 ? '#E65100' : '#388E3C') + ';font-family:monospace;">' + pendingCount + '</div>' +
            '</div>' +
          '</div>' +
          dates.map(function(date) {
            var dayEntries = byDate[date];
            var dayTotal = dayEntries.reduce(function(s, e) { return s + (parseFloat(e.totalHours) || 0); }, 0);
            return '<div style="margin-bottom:24px;">' +
              '<div style="font-size:14px;font-weight:600;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid var(--gold);">' + date + ' <span style="font-size:12px;color:var(--gray-400);font-weight:400;">' + dayTotal.toFixed(1) + 'h · ' + dayEntries.length + ' entries</span></div>' +
              '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
                '<thead><tr style="border-bottom:1px solid var(--border,#eee);">' +
                  '<th style="padding:8px;text-align:left;font-size:11px;color:var(--gray-400);width:30px;">☑</th>' +
                  '<th style="padding:8px;text-align:left;font-size:11px;color:var(--gray-400);">Project</th>' +
                  '<th style="padding:8px;text-align:left;font-size:11px;color:var(--gray-400);">Member</th>' +
                  '<th style="padding:8px;text-align:left;font-size:11px;color:var(--gray-400);">Note</th>' +
                  '<th style="padding:8px;text-align:right;font-size:11px;color:var(--gray-400);">Hours</th>' +
                  '<th style="padding:8px;text-align:center;font-size:11px;color:var(--gray-400);">Status</th>' +
                  '<th style="padding:8px;text-align:center;font-size:11px;color:var(--gray-400);">Actions</th>' +
                '</tr></thead><tbody>' +
                dayEntries.map(function(e) {
                  var isApproved = approvedIds.has(String(e.timelyId));
                  var hrs = parseFloat(e.totalHours) || 0;
                  return '<tr style="border-bottom:1px solid var(--border,#eee);' + (isApproved ? 'opacity:0.5;' : '') + '">' +
                    '<td style="padding:8px;"><input type="checkbox" class="timely-check" data-id="' + escAttr(e.id) + '" ' + (isApproved ? 'disabled checked' : '') + '></td>' +
                    '<td style="padding:8px;font-weight:600;">' + esc(e.project || 'No Project') + '</td>' +
                    '<td style="padding:8px;color:var(--gray-500);">' + esc(e.member || e.memberEmail || '') + '</td>' +
                    '<td style="padding:8px;color:var(--gray-500);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escAttr(e.note || '') + '">' + esc(e.note || '—') + '</td>' +
                    '<td style="padding:8px;text-align:right;font-weight:600;font-family:monospace;color:var(--gold);">' + hrs.toFixed(1) + 'h</td>' +
                    '<td style="padding:8px;text-align:center;">' + (isApproved ? '<span style="color:#388E3C;font-size:11px;font-weight:600;">✓ Logged</span>' : '<span style="color:#E65100;font-size:11px;">Pending</span>') + '</td>' +
                    '<td style="padding:8px;text-align:center;">' +
                      (isApproved ? '—' : '<button class="btn btn-primary btn-sm" style="font-size:10px;padding:2px 8px;" onclick="approveTimelyEntry(\\'' + escAttr(e.id) + '\\')">✓ Approve</button>') +
                    '</td>' +
                  '</tr>';
                }).join('') +
              '</tbody></table></div>';
          }).join('');

      } catch(e) {
        T.innerHTML = '<div style="color:var(--red);padding:40px;text-align:center;">Error loading Timely entries: ' + esc(e.message) + '</div>';
      }
    }

    async function approveTimelyEntry(timelyDocId) {
      try {
        var doc = await db.collection('timelyEntries').doc(timelyDocId).get();
        if (!doc.exists) { showToast('Entry not found', 'error'); return; }
        var e = doc.data();

        // Create a time entry in our ledger
        await db.collection('timeEntries').add({
          date: e.date || '',
          project: e.project || '',
          member: e.member || e.memberEmail || '',
          hours: parseFloat(e.totalHours) || 0,
          description: e.note || '',
          service: e.note || '',
          billable: e.billable || false,
          source: 'timely',
          timelyId: e.timelyId || '',
          timelyDocId: timelyDocId,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('✓ Approved and logged');
        renderTimelyLoggedView();
      } catch(err) { showToast('Error: ' + err.message, 'error'); }
    }

    async function approveAllTimely() {
      if (!confirm('Approve all pending Timely entries and add them to the Time Ledger?')) return;
      showToast('Approving...');
      try {
        var snap = await db.collection('timelyEntries').limit(500).get();
        var approvedIds = new Set();
        var teSnap = await db.collection('timeEntries').where('source', '==', 'timely').limit(500).get();
        teSnap.forEach(function(d) { var data = d.data(); if (data.timelyId) approvedIds.add(String(data.timelyId)); });

        var count = 0;
        for (var doc of snap.docs) {
          var e = doc.data();
          if (approvedIds.has(String(e.timelyId))) continue;
          await db.collection('timeEntries').add({
            date: e.date || '', project: e.project || '',
            member: e.member || e.memberEmail || '',
            hours: parseFloat(e.totalHours) || 0,
            description: e.note || '', service: e.note || '',
            billable: e.billable || false, source: 'timely',
            timelyId: e.timelyId || '', timelyDocId: doc.id,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
          count++;
        }
        showToast('Approved ' + count + ' entries');
        renderTimelyLoggedView();
      } catch(err) { showToast('Error: ' + err.message, 'error'); }
    }

    async function syncTimelyNow() {
      showToast('Syncing from Timely...');
      try {
        var resp = await fetch('https://us-central1-cch-design-boards.cloudfunctions.net/timelySyncEntries', {
          method: 'POST', headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({startDate: new Date(Date.now() - 30*86400000).toISOString().slice(0,10), endDate: new Date().toISOString().slice(0,10)})
        });
        var result = await resp.json();
        showToast('Synced ' + (result.saved || 0) + ' entries from Timely');
        renderTimelyLoggedView();
      } catch(err) { showToast('Sync error: ' + err.message, 'error'); }
    }
`;
  const insertPoint = html.indexOf('function closeModal()');
  if (insertPoint > 0) {
    html = html.slice(0, insertPoint) + viewFunc + '\n    ' + html.slice(insertPoint);
    fixes++;
    console.log('✅ Timely Logged view + approve/sync functions');
  }
}

// 4. Update the Cloud Function token to use the permanent one
// This is in Firestore settings/timely - already updated

// VALIDATE
const newLen = html.length;
const end = html.slice(-30).trim();
console.log('\n=== RESULTS ===');
console.log('Fixes:', fixes, '| Orig:', origLen, '| New:', newLen, '| Diff:', newLen - origLen, '| OK:', end.endsWith('</html>'));
if (newLen < origLen - 100 || !end.endsWith('</html>')) { console.log('❌ ABORT'); process.exit(1); }
fs.writeFileSync(FILE, html);
console.log('✅ SAVED');
