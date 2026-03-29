@echo off
echo ============================================
echo   CCH Studio - Firebase Deploy
echo ============================================
echo.

:: Check if firebase is installed
where firebase >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Firebase CLI not found. Installing...
    npm install -g firebase-tools
    echo.
    echo Firebase installed. You need to login first:
    echo   firebase login
    echo.
    echo Then run this script again.
    pause
    exit /b
)

:: Check if logged in
firebase projects:list >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Not logged in to Firebase. Logging in...
    firebase login
    echo.
)

echo Deploying to cch-platform.web.app...
echo.
firebase deploy --only hosting
echo.
echo ============================================
echo   Deploy complete!
echo   Check: https://cch-platform.web.app
echo ============================================
pause
