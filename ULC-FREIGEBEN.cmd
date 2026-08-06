@echo off
setlocal
cd /d "%~dp0"
echo.
echo ULC Linz App - geprueften Stand freigeben
echo ==========================================
node.exe "%~dp0scripts\release\approve-change.mjs"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo Freigabevorgang beendet.
) else (
  echo Freigabe abgebrochen. Es wurde kein ungepruefter Stand gepusht.
)
echo.
pause
exit /b %RC%
