/**
 * One-time migration: local Builder manifest assets -> Firebase Storage library/{category}/
 *
 * Usage:
 *   set GOOGLE_APPLICATION_CREDENTIALS=C:\path\service-account.json
 *   node migrate-builder-library-to-storage.js
 *
 * Optional env:
 *   PROJECT_ID=cch-design-boards
 *   STORAGE_BUCKET=cch-design-boards.firebasestorage.app
 *   BUILDER_ROOT="C:\Users\cindy\Dropbox\Claude - CCH studio\CCH Custom Windows, Furniture , Bedding, Pillows"
 *   MANIFEST_PATH="C:\...\Builder\manifest.json"
 */
const fs = require("fs");
const path = require("path");
const admin = require("../Functions/node_modules/firebase-admin");

const PROJECT_ID = process.env.PROJECT_ID || "cch-design-boards";
const STORAGE_BUCKET = process.env.STORAGE_BUCKET || "cch-design-boards.firebasestorage.app";
const BUILDER_ROOT = process.env.BUILDER_ROOT || String.raw`C:\Users\cindy\Dropbox\Claude - CCH studio\CCH Custom Windows, Furniture , Bedding, Pillows`;
const MANIFEST_PATH = process.env.MANIFEST_PATH || path.join(BUILDER_ROOT, "Builder", "manifest.json");
const REPORT_PATH = path.join(__dirname, "builder-library-migration-report.json");

const FOLDER_MAP = {
  "Windows": "windows",
  "Welts & Stitch details": "welts_stitches",
  "Tufting": "tufting",
  "Nailheads": "nailheads",
  "Legs & Feet": "legs_feet",
  "Bedding & Pillow Guide": "pillows_bedding",
  "Design Style Images": "design_styles",
  "Chairs": "chairs",
  "Sofas, Sec": "sofas",
  "Beds & Headboards": "beds",
  "Benches & Ottomans": "benches"
};

function safeName(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

async function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error("Manifest not found: " + MANIFEST_PATH);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  admin.initializeApp({ projectId: PROJECT_ID, storageBucket: STORAGE_BUCKET });
  const bucket = admin.storage().bucket();

  const report = {
    startedAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    bucket: STORAGE_BUCKET,
    sourceManifest: MANIFEST_PATH,
    totalCandidates: 0,
    uploaded: 0,
    skippedMissing: 0,
    skippedUnmapped: 0,
    failed: 0,
    files: []
  };

  const folders = manifest.folders || {};
  for (const [folderName, files] of Object.entries(folders)) {
    const mappedCategory = FOLDER_MAP[folderName];
    if (!mappedCategory) {
      report.skippedUnmapped += (files || []).length;
      (files || []).forEach(item => report.files.push({
        status: "skipped_unmapped",
        folderName,
        sourcePath: item.path || "",
        reason: "No folder mapping configured"
      }));
      continue;
    }
    for (const item of (files || [])) {
      report.totalCandidates += 1;
      const sourcePath = item.path || "";
      const filename = safeName(item.filename || path.basename(sourcePath));
      const absolutePath = path.join(BUILDER_ROOT, sourcePath);
      const destination = `library/${mappedCategory}/${filename}`;
      if (!fs.existsSync(absolutePath)) {
        report.skippedMissing += 1;
        report.files.push({ status: "skipped_missing", folderName, sourcePath, destination, absolutePath });
        continue;
      }
      try {
        await bucket.upload(absolutePath, {
          destination,
          metadata: {
            cacheControl: "public, max-age=3600",
            metadata: {
              sourcePath,
              sourceFolder: folderName,
              label: item.label || ""
            }
          }
        });
        report.uploaded += 1;
        report.files.push({ status: "uploaded", folderName, sourcePath, destination });
        process.stdout.write(`uploaded ${report.uploaded}/${report.totalCandidates}: ${destination}\n`);
      } catch (error) {
        report.failed += 1;
        report.files.push({ status: "failed", folderName, sourcePath, destination, error: String(error && error.message || error) });
        process.stdout.write(`FAILED: ${destination}\n`);
      }
    }
  }

  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf-8");
  console.log("\nMigration complete");
  console.log(JSON.stringify({
    totalCandidates: report.totalCandidates,
    uploaded: report.uploaded,
    skippedMissing: report.skippedMissing,
    skippedUnmapped: report.skippedUnmapped,
    failed: report.failed,
    reportPath: REPORT_PATH
  }, null, 2));
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
