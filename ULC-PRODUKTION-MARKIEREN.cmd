@echo off
setlocal
cd /d "%~dp0"
echo.
echo ULC Linz App - stabilen Produktionsstand markieren
echo ==================================================
node.exe "%~dp0scripts\release\mark-production.mjs"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo Produktionsstand wurde als Git-Tag gesichert.
) else (
  echo Produktionsmarkierung abgebrochen.
)
echo.
pause
exit /b %RC%
