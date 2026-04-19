@echo off
echo ============================================
echo   CCH Studio - Deploy to STAGING only
echo   (cch-platform-staging.web.app)
echo ============================================
echo.
echo If this fails with "site not found", complete one-time setup:
echo   See STAGING-HOSTING-SETUP.md
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

firebase deploy --only hosting:platform-staging
echo.
echo ============================================
echo   Staging deploy complete (if no errors above)
echo   Open: https://cch-platform-staging.web.app
echo   Hard refresh: Ctrl+Shift+R
echo ============================================
pause
