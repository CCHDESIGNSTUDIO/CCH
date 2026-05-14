@echo off
echo.
echo ================================================================
echo                                                                .
echo   DEPLOY.bat has been DISABLED as of May 13, 2026.             .
echo                                                                .
echo   Reason: too many production deploys were happening without   .
echo   staging tests, including the Apr 20 outage.                  .
echo                                                                .
echo   Use one of these instead:                                    .
echo                                                                .
echo     DEPLOY-STAGING.bat                                         .
echo         -- Default. Ships to cch-platform-staging.web.app.     .
echo         -- Always start here.                                  .
echo                                                                .
echo     DEPLOY-PRODUCTION-DANGER.bat                               .
echo         -- Only after staging is tested AND Cindy approves.    .
echo         -- Requires typed confirmation.                        .
echo                                                                .
echo   Read STOP-READ-FIRST.md before any deploy.                   .
echo                                                                .
echo ================================================================
echo.
pause
exit /b 1
