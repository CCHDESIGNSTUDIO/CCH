# CCH Studio Platform — Cowork Folder Instructions

## Project
CCH Studio is a single-file web platform (`index.html`, ~17,000 lines) for CCH Design Inc, a luxury interior design firm. Firebase-hosted at cch-platform.web.app.

## File Locations
- **Local path:** `C:\Users\cindy\Dropbox\CCH-Platform-Deploy\cch-deploy\`
- **Platform source:** `platform/index.html` (the only file that matters for UI changes)
- **Firebase config:** `firebase.json`, `firestore.rules`, `storage.rules`
- **Cloud Functions:** `Functions/` folder
- **Deploy from this folder:** `cd C:\Users\cindy\Dropbox\CCH-Platform-Deploy\cch-deploy && firebase deploy --only hosting`

## Architecture (single index.html)
- Firebase Auth (email/password), Firestore database, Firebase Storage
- Firestore project: `cch-design-boards`
- Collections: `boards` (projects), `boards/{id}/clips` (room board), `boards/{id}/ideabooks`, `boards/{id}/designBoards`, `boards/{id}/invoices`, `boards/{id}/proposals`, `boards/{id}/purchaseOrders`, `timeEntries`, `desktopTimeLogs`, `activity`, `productLibrary`

## Team
- **Cynthia Holloway** (founder, cindy@cchdesign.com) — admin, $150/hr rate
- **Vanessa Holliday** (Sr. Designer, vanessa@cchdesign.com) — $75/hr rate
- TEAM_MEMBERS = ['Cynthia Holloway', 'Vanessa Holliday']
- Cynthia's name is Holloway (NOT Holliday). Vanessa's is Holliday.

## Smart Time (Time Tracker)
- Views: List, Timeline (3-panel Timely-style), Weekly, Monthly
- **Timeline:** Left=Timesheet buckets (dark, 220px), Center=time grid with capture blocks, Right=Memories panel (light, 220px)
- **Desktop Agent:** PowerShell script at `C:\Users\cindy\CCH-TimeAgent\CCH-TimeAgent.ps1` — polls active window every 15 seconds, pushes to Firestore `desktopTimeLogs` collection
- Agent v3 format: individual events with `startTime`/`endTime`, `format: "timestamped"`, doc IDs use email prefix (`2026-03-09-cindy`)
- Old v2 agent data is poisoned (shared doc IDs mixed both members' data) — scan skips any doc without `format: "timestamped"` or email-slug ID
- Member filtering uses name variants: cindy ↔ cynthia for matching
- AI categorization disabled on deployed site (needs API key server-side)
- Browser title splitting: Chrome/Edge/Firefox titles split by `|` separator into individual site captures

## Key Functions
- `autoScanCaptures()` — scans Firestore for today + yesterday + viewed day
- `_tlRenderBlocks()` — renders logged entries + capture blocks on timeline grid
- `_tlRenderMemoriesPanel()` — right panel grouping captures by app
- `_tlRenderBucketsPanel()` — left panel with drag-drop time entry buckets
- `renderTimeTimelineView()` — main 3-panel layout
- `importDesktopLog()` — file import with "Push to Timeline" option
- `currentMemberName()` — returns member name from email

## Ideabooks
- Each image card has: stars, comments, caption/price editing, Move (between sections), Copy to Room Board (with room picker), Copy to Design Board (with board picker)
- Design board elements use canvas format: `{ id, type:'image', x, y, w, h, img, title, vendor, price, rotation }`

## Active CCH Design Projects
31 Whitesail (Sahand Nayebaziz), Bradbury-High (Josh & Susan Bradbury), Bugle Trail (April Box), Cloud Rolling Hills, Shimano, Holtz Hill, Katke, Discovery Club, West Avalon (Vaughn DeWitt)

## Deploy
```
cd C:\Users\cindy\Dropbox\CCH-Platform-Deploy\cch-deploy
firebase deploy --only hosting
```
For rules: `firebase deploy --only firestore:rules`

## Style Notes
- CSS vars: `--gold`, `--black`, `--bg`, `--gray-100` through `--gray-500`, `--red`, `--green`, `--blue`
- Dark theme for timesheet panel, light for memories panel
- Gold (#C4A052) as primary accent
- Font: system stack with JetBrains Mono for numbers
