/**
 * Staging only. Copy Cloud Rolling Hills window-treatment PowerPoint
 * pictures, tags, and design notes onto matching work orders.
 * Does not write workroomDescription or workroomCosts.
 *
 *   node _scripts/apply-rh-wt-ppt-design_BY_CURSOR_2026-10-03.js
 *   node _scripts/apply-rh-wt-ppt-design_BY_CURSOR_2026-10-03.js --apply
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const admin = require('firebase-admin');

const APPLY = process.argv.indexOf('--apply') >= 0;
const PPT = process.argv.filter(a => a !== '--apply').slice(2)[0]
  || 'C:\\Users\\cindy\\CCH Design\\Cloud - Rolling Hills - Documents\\Working Documents\\Layout Custom Work orders\\Cloud_RH_WT_CCH_Rev2.pptx';
const KEY = path.join(__dirname, '..', '_debug', 'service-account.json', 'cch-studio-staging-firebase-adminsdk-fbsvc-b93c6f1cf4.json');
const BUCKET = 'cch-studio-staging.firebasestorage.app';

const app = admin.initializeApp({
  credential: admin.credential.cert(require(KEY)),
  storageBucket: BUCKET
}, 'pptDesignStaging');
const db = app.firestore();
const bucket = app.storage().bucket();

function pptRoomCanon(s) {
  let t = String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/#/g, ' ');
  t = t.replace(/craftroom/g, 'craft room');
  t = t.replace(/reading nook/g, 'reading room');
  t = t.replace(/\bworkout\b(?!\s+room)/g, 'workout room');
  return t.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function pptRoomTokens(s) {
  const stop = { the: 1, and: 1, windows: 1, window: 1, sliders: 1, slider: 1 };
  return pptRoomCanon(s).split(' ').filter(w => w && !stop[w]);
}
function pptRoomScore(woRoom, slideLoc) {
  if (/great room dormer/i.test(woRoom) && /stair tower/i.test(slideLoc)) return 100;
  const a = pptRoomTokens(woRoom);
  const b = pptRoomTokens(slideLoc);
  if (!a.length || !b.length) return 0;
  const as = a.join(' ');
  const bs = b.join(' ');
  if (as === bs) return 100;
  if (bs.indexOf(as) >= 0 || as.indexOf(bs) >= 0) return 90 - Math.min(20, Math.abs(as.length - bs.length));
  const setb = {};
  b.forEach(t => { setb[t] = 1; });
  const hit = a.filter(t => setb[t]).length;
  if (hit >= 2 && (hit === a.length || hit >= b.length)) return hit === a.length ? 80 : 78;
  return 0;
}
function pptSlideLocation(texts) {
  for (let i = 0; i < texts.length; i++) {
    const s = String(texts[i] || '').replace(/\s+/g, ' ').trim();
    if (/^location\s*:/i.test(s)) {
      const rest = s.replace(/^location\s*:/i, '').trim();
      if (rest) return rest;
      const nxt = String(texts[i + 1] || '').trim();
      if (nxt && !/^arch/i.test(nxt)) return nxt;
    }
  }
  return '';
}
function pptSlideTag(texts) {
  for (let i = 0; i < texts.length; i++) {
    let s = String(texts[i] || '').replace(/\s+/g, ' ').trim();
    if (!/^W\s*\d/i.test(s)) continue;
    if (/hold|\bno\b/i.test(s)) continue;
    if (/[\(&]$/.test(s) && texts[i + 1]) s = (s + ' ' + texts[i + 1]).replace(/\s+/g, ' ').trim();
    return s.slice(0, 80);
  }
  return '';
}
function pptSlideDesignNotes(texts) {
  const i = texts.findIndex(t => /^design specifications$/i.test(String(t || '').trim()));
  if (i < 0) return [];
  const out = [];
  for (let k = i + 1; k < texts.length; k++) {
    const s = String(texts[k] || '').replace(/\s+/g, ' ').trim();
    if (!s) continue;
    if (/^(project|date|revision|work order)\b/i.test(s)) break;
    out.push(s);
  }
  return out.slice(0, 16);
}
function pptXmlTexts(xml) {
  const out = [];
  const re = /<a:t[^>]*>([^<]*)<\/a:t>/g;
  let m;
  while ((m = re.exec(xml))) {
    const s = m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#10;/g, ' ').trim();
    if (s) out.push(s);
  }
  return out;
}
function pptRelTargets(xml) {
  const map = {};
  const re = /<Relationship\b([^>]*)\/?>/g;
  let m;
  while ((m = re.exec(xml))) {
    const id = (m[1].match(/\bId="([^"]+)"/) || [])[1];
    const target = (m[1].match(/\bTarget="([^"]+)"/) || [])[1];
    if (id && target) map[id] = target;
  }
  return map;
}
function pptResolveTarget(target) {
  const parts = ('ppt/slides/' + target).split('/');
  const out = [];
  parts.forEach(part => {
    if (part === '..') out.pop();
    else if (part && part !== '.') out.push(part);
  });
  return out.join('/');
}
function zipIndex(buf) {
  const bytes = new Uint8Array(buf);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  const min = Math.max(0, bytes.length - 22 - 65535);
  for (let i = bytes.length - 22; i >= min; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not a pptx');
  const cdCount = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const entries = {};
  for (let n = 0; n < cdCount; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = Buffer.from(bytes.subarray(p + 46, p + 46 + nameLen)).toString('utf8');
    entries[name] = { method, compSize, localOffset };
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { bytes, view, entries };
}
function inflate(zip, entry) {
  const o = entry.localOffset;
  const nameLen = zip.view.getUint16(o + 26, true);
  const extraLen = zip.view.getUint16(o + 28, true);
  const start = o + 30 + nameLen + extraLen;
  const comp = Buffer.from(zip.bytes.subarray(start, start + entry.compSize));
  if (entry.method === 0) return comp;
  if (entry.method === 8) return zlib.inflateRawSync(comp);
  throw new Error('zip method ' + entry.method);
}
function slidePictures(xml) {
  const pics = [];
  const re = /<p:pic\b[\s\S]*?<\/p:pic>/g;
  let m;
  while ((m = re.exec(xml))) {
    const block = m[0];
    const rid = (block.match(/\br:embed="([^"]+)"/) || [])[1] || '';
    const ext = block.match(/<a:ext\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/);
    const cx = ext ? parseInt(ext[1], 10) : 0;
    const cy = ext ? parseInt(ext[2], 10) : 0;
    if (rid) pics.push({ rid, area: cx * cy });
  }
  pics.sort((a, b) => b.area - a.area);
  return pics;
}
function readSlides(pptPath) {
  const zip = zipIndex(fs.readFileSync(pptPath));
  const names = Object.keys(zip.entries).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n));
  names.sort((a, b) => parseInt(a.match(/\d+/)[0], 10) - parseInt(b.match(/\d+/)[0], 10));
  const slides = [];
  names.forEach(name => {
    const xml = inflate(zip, zip.entries[name]).toString('utf8');
    const texts = pptXmlTexts(xml);
    const loc = pptSlideLocation(texts);
    if (!loc) return;
    const num = name.match(/\d+/)[0];
    slides.push({
      loc,
      tag: pptSlideTag(texts),
      notes: pptSlideDesignNotes(texts),
      pics: slidePictures(xml),
      relName: 'ppt/slides/_rels/slide' + num + '.xml.rels',
      zip
    });
  });
  return slides;
}
function downloadUrl(dest, token) {
  return 'https://firebasestorage.googleapis.com/v0/b/' + BUCKET + '/o/' + encodeURIComponent(dest) + '?alt=media&token=' + token;
}
async function uploadImage(projectId, workOrderId, key, bytes, filename) {
  const ext = ((String(filename || '').split('.').pop() || 'jpg').toLowerCase()).replace(/[^a-z0-9]/g, '') || 'jpg';
  const type = ext === 'png' ? 'image/png' : (ext === 'gif' ? 'image/gif' : (ext === 'webp' ? 'image/webp' : 'image/jpeg'));
  const token = crypto.randomUUID();
  const dest = 'projects/' + projectId + '/workOrders/' + workOrderId + '/ppt/' + Date.now() + '-' + key + '.' + ext;
  await bucket.file(dest).save(bytes, {
    metadata: { contentType: type, metadata: { firebaseStorageDownloadTokens: token } }
  });
  return downloadUrl(dest, token);
}

async function findProject() {
  const snap = await db.collection('boards').get();
  const hits = [];
  snap.forEach(doc => {
    const d = doc.data() || {};
    const name = String(d.name || d.projectName || d.title || doc.id);
    if (/rolling/i.test(name) || /rolling/i.test(doc.id)) hits.push({ id: doc.id, name });
  });
  return hits;
}

(async function main() {
  const projects = await findProject();
  console.log('projects', projects.map(p => p.id + ' | ' + p.name).join(' || ') || 'none');
  const project = projects.find(p => /cloud/i.test(p.name) || /cloud/i.test(p.id)) || projects[0];
  if (!project) throw new Error('No Rolling Hills project on staging');
  console.log('using', project.id, project.name);
  const woSnap = await db.collection('boards').doc(project.id).collection('workOrders').get();
  const rows = [];
  woSnap.forEach(doc => rows.push({ id: doc.id, ...doc.data() }));
  console.log('work orders', rows.length);
  const slides = readSlides(PPT);
  console.log('design slides', slides.length);
  const used = {};
  const chosen = [];
  const pending = rows.filter(r => !r.category || /roller|drapery|roman|flatfold|style/i.test(r.category));
  let guard = 0;
  while (pending.length && guard < 80) {
    guard++;
    let best = null;
    let bestIdx = -1;
    pending.forEach((wo, idx) => {
      const cands = [];
      slides.forEach((s, i) => {
        if (used[i]) return;
        const sc = pptRoomScore(wo.room, s.loc);
        if (sc >= 64) cands.push({ i, sc, s });
      });
      cands.sort((a, b) => b.sc - a.sc || b.s.pics.length - a.s.pics.length);
      let pick = cands[0] || null;
      if (pick && cands[1] && pick.sc - cands[1].sc <= 8 && cands[1].s.pics.length >= pick.s.pics.length + 3) pick = cands[1];
      if (pick && (!best || pick.sc > best.sc)) { best = pick; bestIdx = idx; }
    });
    if (!best) break;
    used[best.i] = 1;
    chosen.push({ wo: pending[bestIdx], slide: best.s });
    pending.splice(bestIdx, 1);
  }
  chosen.forEach(c => {
    console.log((c.wo.workOrderNumber || c.wo.id) + ' | ' + (c.wo.room || '') + ' <= ' + c.slide.loc + ' | ' + (c.slide.tag || '-') + ' | pics ' + c.slide.pics.length + ' | hasImage ' + (c.wo.renderingUrl ? 'yes' : 'no'));
  });
  const matched = {};
  chosen.forEach(c => { matched[c.wo.id] = 1; });
  const missed = rows.filter(r => !matched[r.id] && (!r.category || /roller|drapery|roman|flatfold|style/i.test(r.category)));
  console.log('unmatched', missed.map(r => (r.workOrderNumber || r.id) + ' ' + (r.room || '')).join(', ') || 'none');
  if (!APPLY) {
    console.log('DRY RUN. Pass --apply to write staging.');
    process.exit(0);
  }
  for (let n = 0; n < chosen.length; n++) {
    const c = chosen[n];
    const wo = c.wo;
    const slide = c.slide;
    const relEntry = slide.zip.entries[slide.relName];
    const relXml = relEntry ? inflate(slide.zip, relEntry).toString('utf8') : '';
    const rels = pptRelTargets(relXml);
    const raster = [];
    for (let i = 0; i < slide.pics.length; i++) {
      const target = rels[slide.pics[i].rid];
      if (!target) continue;
      const mediaName = pptResolveTarget(target);
      if (!/\.(png|jpe?g|gif|webp)$/i.test(mediaName)) continue;
      const media = slide.zip.entries[mediaName];
      if (!media) continue;
      raster.push({ name: mediaName, entry: media });
      if (raster.length >= 5) break;
    }
    const keys = ['rendering', 'wtDetail0', 'rollerSlot0', 'rollerSlot1', 'rollerSlot2'];
    const urls = {};
    for (let i = 0; i < raster.length && i < keys.length; i++) {
      const bytes = inflate(slide.zip, raster[i].entry);
      urls[keys[i]] = await uploadImage(project.id, wo.id, keys[i], bytes, raster[i].name);
    }
    const patch = { updatedAt: admin.firestore.FieldValue.serverTimestamp(), pptDesignImportedAt: '2026-10-03' };
    if (/stair tower/i.test(slide.loc) && /great room dormer|stair tower/i.test(String(wo.room || ''))) patch.room = 'Stair Tower';
    if (slide.tag && !String(wo.location || '').trim()) patch.location = slide.tag;
    if (slide.notes && slide.notes.length) patch.notes = slide.notes;
    if (urls.rendering && !wo.renderingUrl) patch.renderingUrl = urls.rendering;
    else if (urls.rendering) patch.renderingUrl = urls.rendering;
    const sw = Object.assign({}, wo.swatchUrls || {});
    ['wtDetail0', 'rollerSlot0', 'rollerSlot1', 'rollerSlot2'].forEach(k => { if (urls[k]) sw[k] = urls[k]; });
    if (urls.wtDetail0 || urls.rollerSlot0) patch.swatchUrls = sw;
    await db.collection('boards').doc(project.id).collection('workOrders').doc(wo.id).set(patch, { merge: true });
    console.log('wrote', wo.workOrderNumber || wo.id, Object.keys(urls).length, 'images');
  }
  console.log('APPLIED', chosen.length);
  process.exit(0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
