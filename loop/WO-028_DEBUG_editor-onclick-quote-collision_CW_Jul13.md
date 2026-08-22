# WO-028 DEBUG · Bi-Weekly Update Editor console errors — root cause found (onclick quote collision) · CW Jul 13
For Cursor. The editor renders but throws `SyntaxError: Unexpected end of input`. Diagnosed from the current
device file (`node --check cch-progress-updates.js` PASSES; index.html tail intact — so NOT a truncation/module
syntax break). The break is in **runtime-generated inline onclick attributes**.

## Root cause (confirmed, cch-progress-updates.js)
Buttons are built as double-quoted `onclick="..."` with **`JSON.stringify()` string args inside**. JSON.stringify
emits **double-quoted** strings, so the first inner `"` closes the `onclick` attribute. The browser then compiles
a truncated handler like `cpPuOpenEditorModal(` → **Unexpected end of input**, and the leftover `"sample-february-
2026"` / `"updates"` fragments are why Chrome names the VM script after the update id/route.

Example, cch-progress-updates.js:283 (the Edit button):
```
onclick="event.stopPropagation();cpPuOpenEditorModal(' + JSON.stringify(projectId) + ',' + JSON.stringify(u.id) + ')"
```
renders to (broken):
```
onclick="event.stopPropagation();cpPuOpenEditorModal("cloud-rolling-hills","sample-february-2026")"
                                                      ^ this quote ends the attribute
```

## Sites to fix (all the same collision — double-quoted onclick + JSON.stringify string)
- **:283** Edit button (list row)
- **:411** "+ New Bi-Weekly Update"
- **:413** "Edit This Update"
- **:501 / :502** `cpPuEditorPickProjectImage` / `cpPuEditorClearImage` (JSON.stringify(slotKey))
- **:696** `cpPuEditorApplyPick(... , JSON.stringify(im.url))` — image URL with a `"`/`&` is extra fragile
- Audit the whole file: `grep -n 'onclick="[^"]*JSON.stringify' cch-progress-updates.js` and fix each.
- (The integer-index removes at :532/:552/:562/:570/:580 use `\'inProgress\',' + i` — single-quoted, FINE.)

## The fix (pick one, be consistent)
1. **Preferred — reuse the existing safe helper.** index.html already builds these correctly at :68842 via
   `cpPortalOnclickAttr('cpPuOpenEditorModal(' + JSON.stringify(projectId) + ',null)')` (returns a properly
   escaped `onclick=...` attribute). Route every editor button through `cpPortalOnclickAttr(...)` instead of
   hand-writing `onclick="..."`.
2. Or **single-quote the attribute**: `onclick='cpPuOpenEditorModal(' + JSON.stringify(projectId) + ',' + JSON.stringify(u.id) + ')'`
   (double quotes from JSON.stringify don't collide with single-quoted attributes). Still HTML-escape if a value
   could contain a single quote.
3. Or **HTML-escape the built string**: wrap the interpolated JSON so `"` → `&quot;` in the attribute.
Do NOT leave `onclick="...JSON.stringify..."`. Image URLs and any caption/id can contain characters that break it.

## NOT the bug (tell Cindy — ignore these)
The `content.bundle.js` / `getUnderlyingImg` / "Invalid attempt to destructure non-iterable instance" errors are
from a **browser extension** injecting into the page (CCH is a single vanilla file, no bundler / no
content.bundle.js). Confirm by reloading in an Incognito window with extensions off — those vanish; only the
editor error is CCH's. Don't chase them.

## Verify (Claude, staging)
After fix: open the update, click Edit / New / Edit This Update, the image pickers, and Apply — no
"Unexpected end of input" in console, editor opens and saves. `node --check cch-progress-updates.js` clean.
Screenshot console (clean) to loop/verify/WO-028/.
