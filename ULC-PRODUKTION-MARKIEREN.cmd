@echo off
setlocal
cd /d "%~dp0"
echo.
echo ULC Linz App - Produktion bestaetigen und lokal synchronisieren
echo ==============================================================
node.exe "%~dp0scripts\release\mark-production.mjs"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo Produktionsstand wurde als Git-Tag gesichert.
  echo Der lokale Arbeitsstand ist jetzt auf dem aktuellen main.
) else (
  echo Produktionsmarkierung oder main-Synchronisierung abgebrochen.
)
echo.
pause
exit /b %RC%
