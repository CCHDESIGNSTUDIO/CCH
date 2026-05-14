@echo off
echo ============================================
echo   CCH Studio - Deploy to STAGING only
echo   Target: https://cch-platform-staging.web.app
echo   Firebase project: cch-studio-staging
echo ============================================
echo.

where firebase >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Firebase CLI not found. Run: npm install -g firebase-tools
    pause
    exit /b 1
)

firebase projects:list >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Run: firebase login
    pause
    exit /b 1
)

REM Deploy target `platform` against the staging Firebase project.
REM Target `platform` resolves to site cch-platform-staging under
REM cch-studio-staging (see .firebaserc).
firebase deploy --only hosting:platform --project staging

set DEPLOY_EXIT=%ERRORLEVEL%

echo.
echo ============================================
if %DEPLOY_EXIT% EQU 0 (
    echo   Staging deploy complete.
    echo   Open:   https://cch-platform-staging.web.app
    echo   Refresh: Ctrl+Shift+R
    echo.
    echo   Verify the orange STAGING banner is visible
    echo   before you consider this build "tested."
) else (
    echo   Staging deploy FAILED. Check errors above.
    echo   Do NOT proceed to production until this is green.
)
echo ============================================
pause
exit /b %DEPLOY_EXIT%
