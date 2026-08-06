@echo off
setlocal
cd /d "%~dp0"
echo.
echo ULC Linz App - neue Aenderung starten
echo ======================================
node.exe "%~dp0scripts\release\start-change.mjs"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo Vorgang erfolgreich.
) else (
  echo Vorgang mit Fehler beendet. Es wurde kein unsicherer Stand freigegeben.
)
echo.
pause
exit /b %RC%
