/**
 * Niice / Houzz board folder audit. READ-ONLY.
 *  - Walk every entry in `Claude - CCH studio/Niice board downloads/Niice/`
 *  - Folders = boards. For each, count images inside.
 *  - Loose files = unsorted images (separate bucket).
 *  - Classify each folder name as project-linked vs style-reference vs unclear.
 *  - Output CSV + console summary.
 */
const fs = require('fs');
const path = require('path');

const ROOT = String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\Niice board downloads\Niice`;
const OUT_CSV = String.raw`C:\Users\cindy\Dropbox\CCH-Platform-Deploy\cch-deploy\_debug\niice-audit.csv`;

const IMG_EXT = /\.(jpe?g|png|gif|webp|tiff?|bmp|heic|heif)$/i;
const csvEsc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

// SKIP — explicit do-not-import per Cynthia (May 8)
const SKIP_PATTERNS = [
  /\bwilliams\b/i,
  /\bdarren\b/i,
];

// HOLD — defer for later decision (May 8)
const HOLD_PATTERNS = [
  /^lighting(\s*\d+)?$/i,    // "lighting", "lighting 2"
];

// Project name patterns — folder name → Studio project mapping
// Each entry: { match: regex, project: studio project slug/key }
const PROJECT_MAP = [
  // Cynthia's May 8 clarifications
  { match: /^pv\b|^pv\s|puerto?\s*vallarta/i, project: 'katke' },
  { match: /\bhollister\b/i,                  project: 'bradbury-sr' },
  { match: /\brenee\b/i,                      project: 'renee-alexander' },
  { match: /\blepak\b/i,                      project: 'lepak' },
  { match: /\bnieves\b/i,                     project: 'nieves' },
  // CLAUDE.md + memory project list
  { match: /^2149\b/i,                        project: '2149-ocean' },
  { match: /^7225\b|bugle\s*trail/i,          project: '7225-bugletrail' },
  { match: /aitken/i,                         project: 'aitken' },
  { match: /angela.*shipp|\bshipp\b/i,        project: 'angela-shipp' },
  { match: /\bavalos\b/i,                     project: 'avalos' },
  { match: /\bbradbury\b/i,                   project: 'bradbury' },
  { match: /\bbrine\b/i,                      project: 'brine' },
  { match: /shimano|calvin/i,                 project: 'calvin-shimano' },
  { match: /\bcastleberry\b/i,                project: 'castleberry' },
  { match: /\bchristopher\b/i,                project: 'christopher' },
  { match: /\bcloud\b|rolling\s*hills|huntington\s*beach|mustang|parker|susan/i, project: 'cloud' },
  { match: /\bcomrie\b/i,                     project: 'comrie' },
  { match: /coure.*alene|coeur.*alene/i,      project: 'coeur-dalene' },
  { match: /\bcypress\b/i,                    project: 'cypress' },
  { match: /\bderk\b/i,                       project: 'derk' },
  { match: /ellen\s*&?\s*erin/i,              project: 'ellen-erin' },
  { match: /\bgoldenrod\b/i,                  project: 'goldenrod' },
  { match: /hannah/i,                         project: 'hannah' },
  { match: /\bhicks\b/i,                      project: 'hicks' },
  { match: /\bholtz\b/i,                      project: 'holtz-hill' },
  { match: /\bkatke\b/i,                      project: 'katke' },
  { match: /\bkerr\b/i,                       project: 'kerr' },
  { match: /\bkron\b/i,                       project: 'kron' },
  { match: /kuzmik/i,                         project: 'melissa-kron' },
  { match: /\blam\b/i,                        project: 'lam' },
  { match: /jen.*mumford/i,                   project: 'jen-mumford' },
  { match: /\bloree\b|scarborough/i,          project: 'loree-scarborough' },
  { match: /\blynn\b/i,                       project: 'lynn-gregory' },
  { match: /\bmoelke\b/i,                     project: 'moelke' },
  { match: /modern\s*farmhouse/i,             project: 'modern-farmhouse' },
  { match: /\bnayebaziz\b|whitesail|31\s*whitesail/i, project: '31-whitesail' },
  { match: /\boakdale\b/i,                    project: 'oakdale' },
  { match: /\bsahand\b/i,                     project: 'sahand-nayebaziz' },
  { match: /\bsurf\s*ranch\b/i,               project: 'bradbury-sr' },   // May 8 — Surf Ranch routes to Bradbury/Hollister
  { match: /stalcup/i,                        project: 'stalcup' },
  { match: /teresa\s*polito/i,                project: 'teresa-polito' },
  { match: /\btheresa\b/i,                    project: 'theresa' },
  { match: /tony/i,                           project: 'tony' },
  { match: /\bvaughn\b/i,                     project: 'vaughn' },
  { match: /\bwest\s*avalon\b/i,              project: 'west-avalon' },
];

// Style / reference / concept pattern — generic categories
const STYLE_PATTERNS = [
  /^accessories$/i, /\bart\b/i, /\bbarstools?\b/i, /\bbedrooms?\b/i,
  /^black,?\s*white\s*&?\s*wood/i,
  /\bcabinets?\b/i, /^closets?\b/i, /\bcoastal\b/i,
  /^cocktail\s*tables?/i, /^dining/i, /^doors$/i, /\bdrapery\b/i,
  /^fabrics?$/i, /^flooring$/i, /\bhardware\b/i,
  /^kitchens?$/i, /\bligh?ting\b/i, /^master\s*bath/i,
  /^modern\b|^mediterranean\b|^french\b|^english\b|^traditional\b/i,
  /\boutdoor\b/i, /^paint(\s*schedule)?$/i, /^patios?$/i,
  /^pendants?$/i, /^pillows?$/i, /\bpowder\b/i,
  /^rugs?$/i, /^sconces?$/i, /^shelves|^shelving/i,
  /^stairs?$/i, /\bstone\b/i, /^style/i,
  /\btextiles?\b/i, /\btile\b/i, /^vintage\b/i,
  /^wallpaper/i, /^windows?$/i,
  /^cch\b/i,   // CCH Fabrics, CCH - Textiles
];

function classify(name) {
  for (const re of SKIP_PATTERNS) if (re.test(name)) return { cat: 'skip', project: null };
  for (const re of HOLD_PATTERNS) if (re.test(name)) return { cat: 'hold', project: null };
  for (const m of PROJECT_MAP) if (m.match.test(name)) return { cat: 'project', project: m.project };
  for (const re of STYLE_PATTERNS) if (re.test(name)) return { cat: 'style', project: null };
  return { cat: 'unclear', project: null };
}

function countImages(folderPath) {
  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    let images = 0, subfolders = 0, otherFiles = 0;
    for (const e of entries) {
      if (e.isDirectory()) subfolders++;
      else if (IMG_EXT.test(e.name)) images++;
      else otherFiles++;
    }
    return { images, subfolders, otherFiles };
  } catch (e) {
    return { images: 0, subfolders: 0, otherFiles: 0, err: e.message };
  }
}

const entries = fs.readdirSync(ROOT, { withFileTypes: true });
console.log(`Root entries: ${entries.length}\n`);

const folders = [], looseFiles = [];
for (const e of entries) {
  if (e.isDirectory()) folders.push(e.name);
  else looseFiles.push(e.name);
}

const looseImageCount = looseFiles.filter(n => IMG_EXT.test(n)).length;
const looseOther = looseFiles.length - looseImageCount;

console.log(`Folders (potential boards): ${folders.length}`);
console.log(`Loose images:               ${looseImageCount}`);
console.log(`Loose other files:          ${looseOther}`);

const records = [];
const counts = { project: 0, style: 0, unclear: 0, skip: 0, hold: 0 };
const imgCounts = { project: 0, style: 0, unclear: 0, skip: 0, hold: 0 };
const projectGroups = {};   // project slug → array of folders

for (const name of folders) {
  const fp = path.join(ROOT, name);
  const { images, subfolders, otherFiles } = countImages(fp);
  const { cat, project } = classify(name);
  counts[cat]++;
  imgCounts[cat] += images;
  if (cat === 'project' && project) {
    if (!projectGroups[project]) projectGroups[project] = [];
    projectGroups[project].push({ name, images });
  }
  records.push({ name, classification: cat, project: project || '', images, subfolders, otherFiles });
}

records.sort((a, b) => {
  const order = { unclear: 0, project: 1, style: 2, hold: 3, skip: 4 };
  if (order[a.classification] !== order[b.classification]) return order[a.classification] - order[b.classification];
  if (a.project !== b.project) return (a.project || '').localeCompare(b.project || '');
  return a.name.localeCompare(b.name);
});

console.log(`\n--- Classification ---`);
console.log(`  Project-linked:  ${String(counts.project).padStart(3)} folders, ${imgCounts.project} images   (across ${Object.keys(projectGroups).length} projects)`);
console.log(`  Style/reference: ${String(counts.style).padStart(3)} folders, ${imgCounts.style} images`);
console.log(`  Unclear:         ${String(counts.unclear).padStart(3)} folders, ${imgCounts.unclear} images`);
console.log(`  HOLD (defer):    ${String(counts.hold).padStart(3)} folders, ${imgCounts.hold} images`);
console.log(`  SKIP:            ${String(counts.skip).padStart(3)} folders, ${imgCounts.skip} images`);
console.log(`  Total:           ${String(folders.length).padStart(3)} folders, ${folders.reduce((s, name) => s + records.find(r => r.name === name).images, 0)} images`);

console.log(`\n--- PER-PROJECT folder counts (each folder = its own Inspiration section, NEVER consolidated) ---`);
const projOrder = Object.keys(projectGroups).sort((a, b) => projectGroups[b].reduce((s, f) => s + f.images, 0) - projectGroups[a].reduce((s, f) => s + f.images, 0));
for (const p of projOrder) {
  const items = projectGroups[p];
  const totalImg = items.reduce((s, f) => s + f.images, 0);
  console.log(`  [${p}]  ${items.length} board(s), ${totalImg} images`);
  for (const f of items) console.log(`    • ${f.name.padEnd(40)} (${f.images} images)`);
}

console.log(`\n--- UNCLEAR folders (need your call: project? style? skip?) ---`);
for (const r of records.filter(r => r.classification === 'unclear')) {
  console.log(`  ${r.name.padEnd(40)} images=${r.images}${r.subfolders ? '  subfolders=' + r.subfolders : ''}`);
}

console.log(`\n--- Top 20 PROJECT folders by image count ---`);
const proj = records.filter(r => r.classification === 'project').sort((a, b) => b.images - a.images).slice(0, 20);
for (const r of proj) console.log(`  ${r.name.padEnd(40)} images=${r.images}`);

console.log(`\n--- Top 20 STYLE folders by image count ---`);
const sty = records.filter(r => r.classification === 'style').sort((a, b) => b.images - a.images).slice(0, 20);
for (const r of sty) console.log(`  ${r.name.padEnd(40)} images=${r.images}`);

// CSV
const lines = ['classification,folder,images,subfolders,otherFiles'];
for (const r of records) lines.push([r.classification, r.name, r.images, r.subfolders, r.otherFiles].map(csvEsc).join(','));
fs.writeFileSync(OUT_CSV, lines.join('\n'));
console.log(`\nManifest: ${OUT_CSV}`);
