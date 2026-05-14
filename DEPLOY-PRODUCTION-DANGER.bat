@echo off
setlocal enabledelayedexpansion

echo.
echo ================================================================
echo                                                                .
echo   !!  PRODUCTION DEPLOY  !!                                    .
echo                                                                .
echo   Target: cch-platform.web.app  (LIVE CLIENT-FACING SITE)      .
echo                                                                .
echo   The Apr 20 outage happened because someone shipped to prod   .
echo   without testing on staging first. Do NOT repeat that.        .
echo                                                                .
echo   BEFORE CONTINUING, you must confirm ALL of the following:    .
echo                                                                .
echo    [ ] You deployed this exact build to STAGING                .
echo    [ ] You opened cch-platform-staging.web.app and tested it   .
echo    [ ] You verified no SyntaxError / no console errors         .
echo    [ ] You tested the client portal route specifically         .
echo    [ ] Cindy has approved this production push                 .
echo                                                                .
echo ================================================================
echo.

set /p CONFIRM="Type exactly:  I HAVE TESTED ON STAGING  --> "

if NOT "!CONFIRM!"=="I HAVE TESTED ON STAGING" (
    echo.
    echo ----------------------------------------------------------------
    echo  ABORTED. You did not type the confirmation string correctly.
    echo  If you have not actually tested on staging, run:
    echo      DEPLOY-STAGING.bat
    echo  first, then come back here.
    echo ----------------------------------------------------------------
    pause
    exit /b 1
)

echo.
set /p APPROVAL="Type Cindy's initials to confirm approval (CH): "
if NOT "!APPROVAL!"=="CH" (
    echo.
    echo ABORTED. Production deploys require explicit approval.
    pause
    exit /b 1
)

echo.
echo Confirmation accepted. Switching to production project...
firebase use production
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Failed to switch to production project. Aborting.
    pause
    exit /b 1
)

echo.
echo Deploying to PRODUCTION ^(cch-platform.web.app^)...
firebase deploy --only hosting:platform --project cch-design-boards

set DEPLOY_EXIT=%ERRORLEVEL%

echo.
echo Switching default project back to staging...
firebase use staging

echo.
echo ================================================================
if %DEPLOY_EXIT% EQU 0 (
    echo   Production deploy complete.
    echo   Verify:  https://cch-platform.web.app
) else (
    echo   Production deploy FAILED. Check errors above.
)
echo ================================================================
pause
exit /b %DEPLOY_EXIT%
