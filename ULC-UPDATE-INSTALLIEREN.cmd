@echo off
setlocal
cd /d "%~dp0"
echo.
echo ULC Linz App - Update installieren
echo ===================================
echo Es wird ausschliesslich im Windows-Download-Ordner nach
echo ULC-Linz-App-UPDATE-*.zip gesucht. Das Manifest entscheidet,
echo welches Paket exakt zum aktuellen Git-Stand passt.
echo.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\release\install-update-package.ps1" -ProjectRoot "%~dp0"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo Updatevorgang beendet.
) else (
  echo Updatevorgang mit Fehler beendet. Es wurde kein unsicherer Stand freigegeben.
)
echo.
pause
exit /b %RC%
