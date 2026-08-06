@echo off
setlocal
cd /d "%~dp0"
echo.
echo ULC Linz App - Release pruefen
echo ================================
node.exe "%~dp0scripts\release\run-release-check.mjs"
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="0" (
  echo ERFOLG: Der aktuelle Arbeitsstand ist fuer die Freigabe geprueft.
) else (
  echo FEHLER: Der Arbeitsstand ist NICHT freigabefaehig.
)
echo.
pause
exit /b %RC%
