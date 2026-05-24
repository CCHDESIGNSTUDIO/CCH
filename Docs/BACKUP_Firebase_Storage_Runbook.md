# Firebase Storage Backup Runbook

**Last updated:** May 24, 2026
**Purpose:** Download the full Firebase Storage bucket (production `cch-design-boards`) to an external drive as a cold backup.
**Use case:** Insurance against Houzz/Ivy CDN expiration (May 25, 2026), Firebase outage, accidental Storage deletion, or vendor account loss.

---

## ⚠️ KNOWN GAP IN EXISTING DROPBOX BACKUP (May 24, 2026)

There is an existing partial backup at `C:\Users\cindy\Dropbox\Claude - CCH studio\Studio Firebase back up\` containing 9 zip files totaling **~618 MB**. It includes `boards.zip`, `images.zip`, `projects.zip`, per-project folders, etc.

**It does NOT include the `houzz-products/` folder** — which is **9.97 GB / 20,375 files**, the rescued Houzz product images, and the entire point of the May 25 deadline backup.

**Verify before May 25:** the `houzz-products/` folder MUST be downloaded separately. See "Priority: minimum viable backup" below for the fastest path.

---

## Priority: minimum viable backup (if time-constrained before May 25)

If you only have time/bandwidth for ONE folder, do `houzz-products/` — everything else in the bucket is either small or already backed up to the Dropbox folder above.

```powershell
gcloud auth login
gcloud config set project cch-design-boards

$dateStamp = Get-Date -Format 'yyyy-MM-dd'
$dest = "D:\CCH-Storage-Backup-$dateStamp\houzz-products"
New-Item -ItemType Directory -Path $dest -Force | Out-Null
gsutil -m rsync -r gs://cch-design-boards.firebasestorage.app/houzz-products $dest
```

That's 9.97 GB. At 50–100 Mbps, ~30 minutes. Resumable.

The full-bucket runbook below covers everything else for completeness, but `houzz-products/` is the deadline-critical piece.

---

## What this backs up

- **Bucket:** `gs://cch-design-boards.firebasestorage.app`
- **Total contents (as of May 24, 2026):** ~22,304 files, ~10.57 GB
- **Largest folder:** `houzz-products/` — 20,375 image files / 9.97 GB (rescued Houzz product images organized as `<houzzId>/<slot>.<ext>`)
- **Other folders:** `images/`, `projects/`, per-project folders, `boards/`, `library/`

---

## Prerequisites

- **Machine:** Lenovo Legion Pro 7 recommended (Toshiba external drive lives there)
- **OS:** Windows + PowerShell
- **External drive:** Toshiba 1TB connected at `D:\` (or substitute the right letter — see Step 4)
- **Google account:** `cynthiacbh@gmail.com` — owner of the `cch-design-boards` Firebase project
- **Disk free:** at least 15 GB free on destination drive (10.57 GB bucket + headroom)

---

## Step 1 — Install Google Cloud SDK (one-time, ~5 min)

If `gcloud` is already installed, skip to Step 2.

1. Download installer: **https://cloud.google.com/sdk/docs/install#windows**
2. Run installer with default options.
3. After install, **close and reopen PowerShell** so PATH refreshes.
4. Verify: `gcloud --version` should print version info. If "not recognized," reopen PowerShell or reboot.

> Note: `gcloud` and `gsutil` come together. You don't need a separate install for `gsutil`.

---

## Step 2 — Authenticate

```powershell
gcloud auth login
```

Opens browser. Sign in as `cynthiacbh@gmail.com`. Returns to terminal when done.

---

## Step 3 — Point at production

```powershell
gcloud config set project cch-design-boards
```

---

## Step 4 — Confirm the Toshiba drive letter

```powershell
Get-Volume D | Select-Object DriveLetter, FileSystemLabel, @{N='FreeGB';E={[math]::Round($_.SizeRemaining/1GB,1)}}
```

Expected output: `D | TOSHIBA EXT | ~848`.

If the Toshiba is mounted at a different letter, substitute it in the `$dest` variable in Step 6.

---

## Step 5 — Sanity-check the bucket

```powershell
gsutil du -sh gs://cch-design-boards.firebasestorage.app
```

Expected: **~10.57 GB**.

If this errors with "bucket not found," try the older URL format:

```powershell
gsutil du -sh gs://cch-design-boards.appspot.com
```

Use whichever URL works in Step 6.

---

## Step 6 — Download (resumable rsync)

```powershell
$dateStamp = Get-Date -Format 'yyyy-MM-dd'
$dest = "D:\CCH-Storage-Backup-$dateStamp"
New-Item -ItemType Directory -Path $dest -Force | Out-Null
gsutil -m rsync -r gs://cch-design-boards.firebasestorage.app $dest
```

### Why `rsync` instead of `cp -R`

- **Resumable:** if laptop sleeps or wifi drops, re-run the same command — picks up where it left off.
- **Idempotent:** only copies missing/different files on subsequent runs.
- **Safe to re-run** as many times as needed.

### Expected runtime

- At typical home wifi (50–100 Mbps): **30–60 minutes** for the full 10.6 GB.
- Plug laptop into power. Disable sleep. Don't close the lid.

### Watching progress

`-m` flag parallelizes — leave it on. You'll see file-by-file output; tens of thousands of lines. Don't worry about each one — just wait for the prompt to return.

---

## Step 7 — Verify

When `rsync` finishes:

```powershell
$dateStamp = Get-Date -Format 'yyyy-MM-dd'
$dest = "D:\CCH-Storage-Backup-$dateStamp"
Get-ChildItem -Path $dest -Recurse -File | Measure-Object -Property Length -Sum | Select-Object Count, @{N='SizeGB';E={[math]::Round($_.Sum/1GB,2)}}
```

**Expected:** ~22,304 files, ~10.57 GB.

If well short of those numbers, re-run Step 6 — `rsync` will fetch only what's missing.

---

## What you'll have on Toshiba

```
D:\CCH-Storage-Backup-YYYY-MM-DD\
├── houzz-products\               (~20,375 files, ~9.97 GB — rescued Houzz product images)
│   ├── 33490311\
│   │   └── 1.jpeg
│   ├── 33490312\
│   │   ├── 1.jpeg
│   │   ├── 2.jpeg
│   │   ├── 3.jpeg
│   │   └── 4.jpeg
│   └── ... (10,843 product folders)
├── images\                       (680 files)
├── projects\                     (566 files)
├── nieves-3920-laguna-blanca-drive-sb\
├── katke-puerto-vallarta\
├── hollister-ranch\
├── bradbury-blue-bird\
├── boards\
├── library\
├── docs\
└── _lib_designer\
```

---

## What this does NOT back up

- **Firestore database** — that's a separate export. Use `gcloud firestore export` for that.
- **Cloud Functions code** — backed up via the GitHub repo (`cch-deploy/Functions/`).
- **Hosting deployed HTML** — backed up via the GitHub repo (`cch-deploy/platform/`).
- **Houzz/Ivy CDN URLs that haven't been rescued yet** — see `CURRENT_PRIORITIES.md` URGENT #1.

---

## Cadence recommendation

- **One-time before May 25, 2026 deadline** — confirmed insurance against Ivy CDN expiration.
- **Monthly going forward** — re-run Step 6; `rsync` only fetches what's new. Each monthly backup adds a few hundred MB at most.
- **Before major migrations** — run as a pre-migration safety net.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `gcloud: not recognized` | Reopen PowerShell after install. If still broken, reboot. |
| `ERROR: (gcloud.auth.login) ... permissions` | Make sure you logged in as `cynthiacbh@gmail.com`, not a personal account. |
| `BucketNotFoundException` | Try `gs://cch-design-boards.appspot.com` instead of `.firebasestorage.app`. |
| `AccessDeniedException: 403` | Wrong account, or your account lost project access. Check Firebase console: https://console.firebase.google.com/project/cch-design-boards/settings/iam |
| Download stuck or very slow | Cancel (Ctrl+C), check wifi, re-run Step 6 — `rsync` resumes from where it stopped. |
| Toshiba disconnects mid-download | Re-plug, re-run Step 6. `rsync` resumes. |

---

## Related docs

- `CURRENT_PRIORITIES.md` — URGENT #2: verify this backup before May 25
- `STOP-READ-FIRST.md` — deploy/safety policy (this file is read-only operations, no overlap)
- `CLAUDE.md` AI Session Rule #8 — environment map (production vs staging)
