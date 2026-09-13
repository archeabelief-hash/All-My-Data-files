@echo off
cd /d %~dp0
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install the current LTS version, then run this file again.
  pause
  exit /b 1
)
echo Starting ESOG Live Tracker...
node server.js
pause
