#Requires -Version 5.1
<#
.SYNOPSIS
    CCH Studio Desktop Time Agent v5.2
    Idle-aware capture + auth flush to Firestore.

.DESCRIPTION
    Polls foreground window every 15s. Flushes to desktopTimeLogs every ~90s.
    v5.2: same-app title history (Cursor/Claude/Chrome) so notes stay rich without splitting every flick.
    v5.1: Firebase Auth via .creds (v4/v5 ran without Bearer token — writes failed silently).
    v5: idle stop, max segment, read-merge-write flush.

.NOTES
    Creds file (next to this script): .creds  { "email", "refreshToken" }
    Logs: logs\agent-v5-YYYY-MM-DD.log
#>

$script:FirebaseProjectId = "cch-design-boards"
# Web API key (same as Studio client — public; auth still required for Firestore writes)
$script:FirebaseApiKey     = "AIzaSyAd24U5ArVGrA24IxNcYD2NYiTVycyF4og"
$script:UserEmail          = "cindy@cchdesign.com"
$script:PollIntervalSec    = 15
$script:FlushIntervalSec   = 90
$script:MinDurationSec     = 10
$script:IdleThresholdSec   = 120
$script:MaxSegmentSec      = 900
$script:MaxTitleLength     = 400
$script:AgentVersion       = "desktop-agent-v5.2"

$script:EmailSlug = ($script:UserEmail -split '@')[0] -replace '[^a-z0-9]','-'
$script:CredFile = Join-Path $PSScriptRoot '.creds'
$script:LogDir = Join-Path $PSScriptRoot 'logs'
$script:idToken = $null
$script:refreshToken = $null
$script:FirestoreBase = "https://firestore.googleapis.com/v1/projects/$($script:FirebaseProjectId)/databases/(default)/documents"

if (-not (Test-Path $script:LogDir)) { New-Item -ItemType Directory -Path $script:LogDir -Force | Out-Null }

function Write-AgentLog([string]$msg, [string]$color = 'Gray') {
    $line = "[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $msg
    try {
        $logFile = Join-Path $script:LogDir ("agent-v5-{0}.log" -f (Get-Date -Format 'yyyy-MM-dd'))
        Add-Content -Path $logFile -Value $line -Encoding UTF8
    } catch {}
    Write-Host $line -ForegroundColor $color
}

function Save-Creds($email, $refreshToken) {
    @{ email = $email; refreshToken = $refreshToken } | ConvertTo-Json | Set-Content $script:CredFile -Force -Encoding UTF8
}

function Load-Creds {
    if (Test-Path $script:CredFile) {
        try { return (Get-Content $script:CredFile -Raw -Encoding UTF8 | ConvertFrom-Json) } catch {}
    }
    return $null
}

function Ensure-Auth {
    if ($script:idToken) { return $true }

    $creds = Load-Creds
    if ($creds -and $creds.email) {
        $script:UserEmail = [string]$creds.email
        $script:EmailSlug = ($script:UserEmail -split '@')[0] -replace '[^a-z0-9]','-'
    }
    if ($creds -and $creds.refreshToken) {
        $script:refreshToken = [string]$creds.refreshToken
    }
    if (-not $script:refreshToken) {
        Write-AgentLog 'AUTH FAIL: no refresh token in .creds - re-login required' 'Red'
        return $false
    }

    try {
        $resp = Invoke-RestMethod -Uri ("https://securetoken.googleapis.com/v1/token?key={0}" -f $script:FirebaseApiKey) -Method Post -Body @{
            grant_type    = 'refresh_token'
            refresh_token = $script:refreshToken
        } -ErrorAction Stop
        $script:idToken = $resp.id_token
        if ($resp.refresh_token) {
            $script:refreshToken = $resp.refresh_token
            Save-Creds $script:UserEmail $script:refreshToken
        }
        Write-AgentLog ("AUTH OK as {0}" -f $script:UserEmail) 'Green'
        return $true
    }
    catch {
        Write-AgentLog ("AUTH FAIL refresh: {0}" -f $_.Exception.Message) 'Red'
        $script:idToken = $null
        return $false
    }
}

function Get-AuthHeaders {
    if (-not (Ensure-Auth)) { return $null }
    return @{ Authorization = ("Bearer {0}" -f $script:idToken) }
}

function ConvertTo-FirestoreValue($val) {
    if ($null -eq $val) { return @{ nullValue = 'NULL_VALUE' } }
    if ($val -is [int] -or $val -is [long]) { return @{ integerValue = "$val" } }
    if ($val -is [double] -or $val -is [float]) { return @{ doubleValue = $val } }
    if ($val -is [bool]) { return @{ booleanValue = $val } }
    return @{ stringValue = "$val" }
}

function ConvertTo-FirestoreMap($hash) {
    $fields = @{}
    foreach ($k in $hash.Keys) { $fields[$k] = ConvertTo-FirestoreValue $hash[$k] }
    return @{ mapValue = @{ fields = $fields } }
}

function ConvertFrom-FirestoreValue($fv) {
    if ($null -eq $fv) { return $null }
    if ($fv.stringValue -ne $null) { return $fv.stringValue }
    if ($fv.integerValue -ne $null) { return [int64]$fv.integerValue }
    if ($fv.doubleValue -ne $null) { return [double]$fv.doubleValue }
    if ($fv.booleanValue -ne $null) { return [bool]$fv.booleanValue }
    if ($fv.mapValue -and $fv.mapValue.fields) {
        $h = @{}
        foreach ($k in $fv.mapValue.fields.PSObject.Properties.Name) {
            $h[$k] = ConvertFrom-FirestoreValue $fv.mapValue.fields.$k
        }
        return $h
    }
    return $null
}

function Get-ExistingDesktopItems($dateStr) {
    $headers = Get-AuthHeaders
    if (-not $headers) { return @() }
    $docId = "$dateStr-$($script:EmailSlug)"
    $url = "$($script:FirestoreBase)/desktopTimeLogs/$docId"
    try {
        $doc = Invoke-RestMethod -Uri $url -Method Get -Headers $headers -ErrorAction Stop
        $out = @()
        if ($doc.fields -and $doc.fields.items -and $doc.fields.items.arrayValue -and $doc.fields.items.arrayValue.values) {
            foreach ($v in $doc.fields.items.arrayValue.values) {
                $item = ConvertFrom-FirestoreValue $v
                if ($item) { $out += $item }
            }
        }
        return $out
    }
    catch {
        return @()
    }
}

function Push-ToFirestore($dateStr, $items) {
    $headers = Get-AuthHeaders
    if (-not $headers) {
        Write-AgentLog 'Flush skipped - not authenticated' 'Red'
        return $false
    }
    $docId = "$dateStr-$($script:EmailSlug)"
    $url = "$($script:FirestoreBase)/desktopTimeLogs/$($docId)?updateMask.fieldPaths=date&updateMask.fieldPaths=member&updateMask.fieldPaths=uploadedAt&updateMask.fieldPaths=source&updateMask.fieldPaths=format&updateMask.fieldPaths=totalEntries&updateMask.fieldPaths=items"

    $existing = @(Get-ExistingDesktopItems -dateStr $dateStr)
    $byStart = @{}
    foreach ($ex in $existing) {
        $key = [string]$ex.startTime
        if (-not $key) { $key = [string]$ex.app + '|' + [string]$ex.seconds }
        if ($key) { $byStart[$key] = $ex }
    }
    foreach ($item in $items) {
        $key = [string]$item.startTime
        if (-not $key) { $key = [string]$item.app + '|' + [string]$item.seconds }
        if ($key) { $byStart[$key] = $item }
    }
    $merged = @($byStart.Values | Sort-Object { $_.startTime })

    $firestoreItems = @()
    foreach ($item in $merged) { $firestoreItems += ConvertTo-FirestoreMap $item }

    $body = @{
        fields = @{
            date         = @{ stringValue = $dateStr }
            member       = @{ stringValue = $script:UserEmail }
            uploadedAt   = @{ stringValue = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ') }
            source       = @{ stringValue = $script:AgentVersion }
            format       = @{ stringValue = 'timestamped' }
            totalEntries = @{ integerValue = "$($merged.Count)" }
            items        = @{ arrayValue = @{ values = $firestoreItems } }
        }
    } | ConvertTo-Json -Depth 20

    try {
        $null = Invoke-RestMethod -Uri $url -Method Patch -Headers $headers -Body $body -ContentType 'application/json; charset=utf-8' -ErrorAction Stop
        Write-AgentLog ("Flush OK: +{0} new, {1} total for {2}" -f $items.Count, $merged.Count, $dateStr) 'Green'
        return $true
    }
    catch {
        $err = $_.Exception.Message
        Write-AgentLog ("Flush ERROR {0}: {1}" -f $dateStr, $err) 'Red'
        if ($err -match '401|403|UNAUTHENTICATED') { $script:idToken = $null }
        return $false
    }
}

if (-not ([System.Management.Automation.PSTypeName]'Win32Window').Type) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32Window {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", SetLastError = true)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll", SetLastError = true)] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [StructLayout(LayoutKind.Sequential)] public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
    [DllImport("user32.dll")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
    [DllImport("kernel32.dll")] public static extern uint GetTickCount();
    public static string GetForegroundWindowTitle() {
        IntPtr hwnd = GetForegroundWindow();
        StringBuilder sb = new StringBuilder(512);
        GetWindowText(hwnd, sb, 512);
        return sb.ToString();
    }
    public static uint GetForegroundProcessId() {
        IntPtr hwnd = GetForegroundWindow();
        uint pid = 0;
        GetWindowThreadProcessId(hwnd, out pid);
        return pid;
    }
    public static uint GetIdleSeconds() {
        LASTINPUTINFO lii = new LASTINPUTINFO();
        lii.cbSize = (uint)Marshal.SizeOf(lii);
        if (!GetLastInputInfo(ref lii)) return 0;
        return (GetTickCount() - lii.dwTime) / 1000;
    }
}
"@
}

$script:OutlookApp = $null
$script:OutlookAvailable = $false

function Initialize-OutlookCOM {
    try {
        $script:OutlookApp = [Runtime.InteropServices.Marshal]::GetActiveObject('Outlook.Application')
        $script:OutlookAvailable = $true
        Write-AgentLog 'Outlook COM connected' 'Cyan'
    } catch {
        $script:OutlookAvailable = $false
        Write-AgentLog 'Outlook COM not available' 'Yellow'
    }
}

function Get-OutlookEnrichedTitle([string]$WindowTitle) {
    if (-not $script:OutlookAvailable) {
        Initialize-OutlookCOM
        if (-not $script:OutlookAvailable) { return $WindowTitle }
    }
    try {
        $inspectors = $script:OutlookApp.Inspectors
        if ($inspectors.Count -gt 0) {
            $item = $inspectors.Item(1).CurrentItem
            if ($item) {
                $subject = $item.Subject
                $sender = ''
                try { $sender = $item.SenderName } catch { try { $sender = $item.Organizer } catch {} }
                if ($subject -and $sender) { return "$subject - From: $sender" }
                elseif ($subject) { return "$subject - Outlook" }
            }
        }
        $explorer = $script:OutlookApp.ActiveExplorer()
        if ($explorer -and $explorer.Selection -and $explorer.Selection.Count -gt 0) {
            $selectedItem = $explorer.Selection.Item(1)
            if ($selectedItem) {
                $subject = $selectedItem.Subject
                $sender = ''
                try { $sender = $selectedItem.SenderName } catch { try { $sender = $selectedItem.Organizer } catch {} }
                if ($subject -and $sender) { return "$subject - From: $sender" }
                elseif ($subject) { return "$subject - Outlook" }
            }
        }
        return $WindowTitle
    } catch {
        $script:OutlookAvailable = $false
        return $WindowTitle
    }
}

function Get-BrowserWebsite([string]$WindowTitle, [string]$AppName) {
    $website = ''
    try {
        if ($WindowTitle -match '(https?://[^\s/]+)') {
            $website = $Matches[1] -replace 'https?://','' -replace '/.*',''
        } elseif ($WindowTitle -match '\s\W\s*([\w.-]+\.(com|org|net|io|dev|app|co|edu|gov))\s*\W\s') {
            $website = $Matches[1]
        }
    } catch {}
    return $website
}

function Normalize-AppName([string]$RawApp) {
    $app = $RawApp.Trim(); $low = $app.ToLower()
    if ($low -match 'chrome|google chrome') { return 'Chrome' }
    if ($low -match 'msedge|microsoft edge|edge') { return 'Microsoft Edge' }
    if ($low -match 'firefox|mozilla') { return 'Firefox' }
    if ($low -match 'powerpnt|powerpoint') { return 'PowerPoint' }
    if ($low -match '^winword$|microsoft word') { return 'Word' }
    if ($low -match '^excel$|microsoft excel') { return 'Excel' }
    if ($low -match 'outlook|^olk$') { return 'Outlook' }
    if ($low -match 'onenote') { return 'OneNote' }
    if ($low -match 'ms-teams|microsoft teams|^teams$') { return 'Microsoft Teams' }
    if ($low -match 'slack') { return 'Slack' }
    if ($low -match 'zoom') { return 'Zoom' }
    if ($low -match 'sketchup') { return 'SketchUp' }
    if ($low -match 'acrobat|acrord') { return 'Adobe Acrobat' }
    if ($low -match 'snippingtool|snipping tool') { return 'Snipping Tool' }
    if ($low -match 'explorer|file explorer') { return 'File Explorer' }
    if ($low -match 'claude') { return 'Claude' }
    if ($low -match 'cursor') { return 'Cursor' }
    return $app
}

function Add-CaptureBlock([string]$App, [string]$Title, [string]$Website, [datetime]$Start, [datetime]$End) {
    if (-not $App -or $App -eq 'Unknown') { return }
    $duration = [int]($End - $Start).TotalSeconds
    if ($duration -lt $script:MinDurationSec) { return }
    if ($Title -and $Title.Length -gt $script:MaxTitleLength) {
        $Title = $Title.Substring(0, $script:MaxTitleLength)
    }
    $entry = @{
        app = $App; title = $Title; website = $Website; seconds = $duration
        startTime = $Start.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
        endTime = $End.ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ')
        project = ''; category = 'Other'
    }
    [void]$script:captures.Add($entry)
    $displayTitle = if ($Title.Length -gt 50) { $Title.Substring(0,50) + '...' } else { $Title }
    Write-AgentLog ("Cap {0} | {1} | {2}s" -f $App, $displayTitle, $duration) 'Gray'
}

$script:captures = [System.Collections.ArrayList]::new()
$lastFlush = Get-Date
$lastApp = ''; $lastTitle = ''; $lastWebsite = ''
$script:TitleHistory = [System.Collections.Generic.List[string]]::new()
$lastStart = Get-Date
$script:IsIdlePaused = $false
$script:LastActiveAt = Get-Date

function Add-TitleHistory([string]$Title) {
    if (-not $Title -or $Title.Length -lt 2) { return }
    $t = $Title.Trim()
    foreach ($ex in $script:TitleHistory) {
        if ($ex.Equals($t, [StringComparison]::OrdinalIgnoreCase)) { return }
    }
    if ($script:TitleHistory.Count -ge 8) { $script:TitleHistory.RemoveAt(0) }
    [void]$script:TitleHistory.Add($t)
}

function Get-TitleHistoryJoined {
    if ($script:TitleHistory.Count -eq 0) { return $lastTitle }
    return ($script:TitleHistory -join ' | ')
}

Write-AgentLog '============================================' 'Cyan'
Write-AgentLog 'CCH Studio Desktop Time Agent v5.2' 'Cyan'
Write-AgentLog ("Poll {0}s | Flush {1}s | Idle {2}s" -f $script:PollIntervalSec, $script:FlushIntervalSec, $script:IdleThresholdSec) 'Cyan'

if (-not (Ensure-Auth)) {
    Write-AgentLog 'Exiting - fix .creds / sign in, then restart agent' 'Red'
    exit 1
}

Initialize-OutlookCOM
Write-AgentLog 'Tracking started' 'Green'

while ($true) {
    try {
        $now = Get-Date
        $idleSec = [Win32Window]::GetIdleSeconds()
        $isIdle = ($idleSec -ge $script:IdleThresholdSec)

        if ($isIdle) {
            if (-not $script:IsIdlePaused -and $lastApp -and $lastApp -ne 'Unknown') {
                $endAt = $script:LastActiveAt
                if ($endAt -lt $lastStart) { $endAt = $lastStart }
                Add-CaptureBlock -App $lastApp -Title (Get-TitleHistoryJoined) -Website $lastWebsite -Start $lastStart -End $endAt
                $lastApp = ''; $lastTitle = ''; $lastWebsite = ''
                $script:TitleHistory.Clear()
                Write-AgentLog ("Idle {0}s - paused" -f $idleSec) 'DarkYellow'
            }
            $script:IsIdlePaused = $true
        }
        else {
            $script:LastActiveAt = $now
            if ($script:IsIdlePaused) {
                $script:IsIdlePaused = $false
                $lastStart = $now
                $script:TitleHistory.Clear()
                Write-AgentLog 'Activity resumed' 'DarkCyan'
            }

            $rawTitle = [Win32Window]::GetForegroundWindowTitle()
            $fgPid = [Win32Window]::GetForegroundProcessId()
            $rawApp = 'Unknown'
            try {
                $proc = Get-Process -Id $fgPid -ErrorAction SilentlyContinue
                if ($proc) {
                    $rawApp = $proc.ProcessName
                    try {
                        $desc = $proc.MainModule.FileVersionInfo.FileDescription
                        if ($desc -and $desc.Length -gt 1) { $rawApp = $desc }
                    } catch {}
                }
            } catch {}

            $normalizedApp = Normalize-AppName $rawApp
            $appLow = $normalizedApp.ToLower()
            $enrichedTitle = $rawTitle
            $website = ''

            if ($appLow -eq 'outlook') {
                $comTitle = Get-OutlookEnrichedTitle -WindowTitle $rawTitle
                if ($comTitle -ne $rawTitle -and $comTitle.Length -gt 0) { $enrichedTitle = $comTitle }
            }
            elseif ($appLow -match 'chrome|edge|firefox|safari') {
                $website = Get-BrowserWebsite -WindowTitle $rawTitle -AppName $normalizedApp
                $enrichedTitle = $rawTitle
            }
            elseif ($appLow -eq 'microsoft teams') { $enrichedTitle = $rawTitle }
            elseif ($appLow -match 'word|excel|powerpoint|sketchup|layout') {
                if ($rawTitle -match '^(.+?)\s*(?:\[.*?\])?\s+\W\s+(?:Microsoft\s+)?(?:Word|Excel|PowerPoint|SketchUp|LayOut)') {
                    $enrichedTitle = ($Matches[1].Trim() + ' (' + $normalizedApp + ')')
                }
            }
            if ($enrichedTitle.Length -gt $script:MaxTitleLength) {
                $enrichedTitle = $enrichedTitle.Substring(0, $script:MaxTitleLength)
            }

            $isSameApp = ($normalizedApp -eq $lastApp)
            # Sticky apps: keep one segment and accumulate title history (richer Approve notes)
            $stickyAccumulate = ($appLow -match 'cursor|claude|chrome|edge|firefox|safari')
            $titleChanged = ($enrichedTitle -ne $lastTitle -and $lastTitle.Length -gt 0)
            $segTooLong = $false
            if ($isSameApp -and $lastApp) {
                $segTooLong = (([int]($now - $lastStart).TotalSeconds) -ge $script:MaxSegmentSec)
            }

            if ($isSameApp -and $titleChanged -and $stickyAccumulate -and -not $segTooLong) {
                Add-TitleHistory $enrichedTitle
                $lastTitle = $enrichedTitle
                if ($website) { $lastWebsite = $website }
            }
            elseif (-not $isSameApp -or $segTooLong -or ($titleChanged -and -not $stickyAccumulate)) {
                if ($lastApp -and $lastApp -ne 'Unknown') {
                    Add-CaptureBlock -App $lastApp -Title (Get-TitleHistoryJoined) -Website $lastWebsite -Start $lastStart -End $now
                }
                $lastApp = $normalizedApp
                $lastTitle = $enrichedTitle
                $lastWebsite = $website
                $lastStart = $now
                $script:TitleHistory.Clear()
                Add-TitleHistory $enrichedTitle
            }
            elseif ($isSameApp -and -not $titleChanged) {
                if ($script:TitleHistory.Count -eq 0) { Add-TitleHistory $enrichedTitle }
            }
        }

        $sinceLast = ($now - $lastFlush).TotalSeconds
        if ($sinceLast -ge $script:FlushIntervalSec -and $script:captures.Count -gt 0) {
            Write-AgentLog ("Flushing {0} entries..." -f $script:captures.Count) 'Yellow'
            $byDate = @{}
            foreach ($cap in $script:captures) {
                $dateStr = ($cap.startTime -split 'T')[0]
                if (-not $dateStr) { $dateStr = (Get-Date).ToString('yyyy-MM-dd') }
                if (-not $byDate[$dateStr]) { $byDate[$dateStr] = @() }
                $byDate[$dateStr] += $cap
            }
            $okAll = $true
            foreach ($dateStr in $byDate.Keys) {
                if (-not (Push-ToFirestore -dateStr $dateStr -items $byDate[$dateStr])) { $okAll = $false }
            }
            if ($okAll) { $script:captures.Clear() }
            $lastFlush = $now
        }
    }
    catch {
        $errMsg = $_.Exception.Message
        if ($errMsg -notmatch 'COM object|RPC server|disconnected|0x800706BA|0x80010108|0x800401FD|hexadecimal|parsing|quantifier|regex') {
            Write-AgentLog ("Error: {0}" -f $errMsg) 'Red'
        }
        if ($errMsg -match 'COM|RPC|0x800') {
            $script:OutlookAvailable = $false
            $script:OutlookApp = $null
        }
    }
    Start-Sleep -Seconds $script:PollIntervalSec
}
