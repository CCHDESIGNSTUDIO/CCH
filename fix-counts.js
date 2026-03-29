const https = require('https');
const PROJECT_ID = 'cch-design-boards';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function get(path) {
  return new Promise((resolve, reject) => {
    https.get(BASE + path, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve({}); } });
    }).on('error', reject);
  });
}

function patch(path, fields) {
  return new Promise((resolve, reject) => {
    const mask = Object.keys(fields).map(k => 'updateMask.fieldPaths=' + k).join('&');
    const url = new URL(BASE + path + '?' + mask);
    const fObj = {};
    for (const k of Object.keys(fields)) {
      fObj[k] = typeof fields[k] === 'number' ? { integerValue: String(fields[k]) } : { stringValue: String(fields[k]) };
    }
    const body = JSON.stringify({ fields: fObj });
    const req = https.request({ hostname: url.hostname, path: url.pathname + url.search, method: 'PATCH', headers: { 'Content-Type': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve());
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function countCollection(boardId, col) {
  try {
    const res = await get(`/boards/${boardId}/${col}?pageSize=500`);
    return (res.documents || []).length;
  } catch(e) { return 0; }
}

async function main() {
  console.log('Loading all boards...');
  const res = await get('/boards?pageSize=500');
  const boards = (res.documents || []).map(d => d.name.split('/').pop());
  console.log(`Found ${boards.length} boards`);

  for (const id of boards) {
    const clips = await countCollection(id, 'clips');
    const invoices = await countCollection(id, 'invoices');
    const proposals = await countCollection(id, 'proposals');

    if (clips > 0 || invoices > 0 || proposals > 0) {
      await patch(`/boards/${id}`, { clipCount: clips, invoiceCount: invoices, proposalCount: proposals });
      console.log(`  ${id}: ${clips} clips, ${invoices} inv, ${proposals} prop`);
    }
  }
  console.log('Done!');
}

main().catch(e => console.error(e));
