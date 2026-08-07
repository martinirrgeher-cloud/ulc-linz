@echo off
setlocal
cd /d "%~dp0"
echo.
echo ULC Linz App - lokale Vorschau
echo ================================
echo Starte Vite unter http://127.0.0.1:5173/ ...
start "ULC Linz App - Dev Server" cmd /k "cd /d ""%~dp0"" && npm.cmd run dev -- --host 127.0.0.1"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:5173/"
echo Browser wurde geoeffnet. Den Dev-Server schliesst du im separaten Fenster mit Strg+C.
echo.
pause
