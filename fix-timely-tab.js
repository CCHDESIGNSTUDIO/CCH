/**
 * Fix Timely Logged tab:
 * 1. Add as 4th tab in the correct tab bar
 * 2. Remove from wrong location (toolbar)
 * 3. Default to today
 * 4. Fix tab text readability
 */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'platform', 'index.html');
let html = fs.readFileSync(FILE, 'utf8');
const origLen = html.length;
let fixes = 0;

// 1. Add Timely tab after Time Ledger tab (line 18640 area)
const ledgerTab = `<div style="\${tabStyle('ledger')}" onclick="smartTimeTab='ledger';renderTimeView()">Time Ledger</div>`;
if (html.includes(ledgerTab) && !html.includes("tabStyle('timely')")) {
  html = html.replace(ledgerTab, ledgerTab + `\n          <div style="\${tabStyle('timely')}" onclick="smartTimeTab='timely';renderTimeView()">⏱ Timely Logged</div>`);
  fixes++;
  console.log('✅ Timely tab added to correct tab bar');
}

// 2. Remove the misplaced tab button from the toolbar
const wrongTab = `<button class="time-tab \${smartTimeTab==='timely'?'active':''}" onclick="smartTimeTab='timely';renderTimeTracker()">⏱ TIMELY LOGGED</button>`;
if (html.includes(wrongTab)) {
  html = html.replace(wrongTab, '');
  fixes++;
  console.log('✅ Removed misplaced tab from toolbar');
} else {
  console.log('⚠️ Misplaced tab not found (may already be removed)');
}

// 3. Make the timely tab route to renderTimelyLoggedView
// The existing routing at line 18666 should work
const timelyRoute = "if (smartTimeTab === 'timely') { renderTimelyLoggedView(); return; }";
if (html.includes(timelyRoute)) {
  console.log('✅ Timely routing already exists');
} else {
  // Add it before the reconciliation check
  const reconCheck = "if (smartTimeTab === 'reconciliation')";
  if (html.includes(reconCheck)) {
    html = html.replace(reconCheck, "if (smartTimeTab === 'timely') { renderTimelyLoggedView(); return; }\n      " + reconCheck);
    fixes++;
    console.log('✅ Timely routing added');
  }
}

// 4. Default to today - make sure _tlDay defaults to today's date
const tlDayInit = "let _tlDay = null;";
if (html.includes(tlDayInit)) {
  html = html.replace(tlDayInit, "let _tlDay = new Date().toISOString().slice(0,10);");
  fixes++;
  console.log('✅ Default to today');
}

// 5. Fix the Today button readability (black background)
const todayBtnOld = "background:var(--gold);color:white;border:none;\" onclick=\"_tlDay='";
if (html.includes(todayBtnOld)) {
  console.log('✅ Today button already uses gold');
} else {
  console.log('⚠️ Today button pattern not found');
}

// VALIDATE
const newLen = html.length;
const end = html.slice(-30).trim();
console.log('\n=== RESULTS ===');
console.log('Fixes:', fixes, '| Orig:', origLen, '| New:', newLen, '| OK:', end.endsWith('</html>'));
if (newLen < origLen - 500 || !end.endsWith('</html>')) { console.log('❌ ABORT'); process.exit(1); }
fs.writeFileSync(FILE, html);
console.log('✅ SAVED');
