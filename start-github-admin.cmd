@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required.
  pause
  exit /b 1
)
where git >nul 2>nul
if errorlevel 1 (
  echo Git is required.
  pause
  exit /b 1
)
set "STAGE_EDITOR_PORT=8794"
node manage.mjs --github --open
if errorlevel 1 pause
