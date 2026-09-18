@echo off
setlocal
cd /d "%~dp0apps\web"
set "BEAUTY_NODE=node"
where node >nul 2>nul
if errorlevel 1 set "BEAUTY_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist node_modules\next\dist\bin\next (
  echo Install Node.js, then run npm ci inside apps\web first.
  pause
  exit /b 1
)
if not exist .next\BUILD_ID (
  "%BEAUTY_NODE%" node_modules\next\dist\bin\next build --turbopack
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo.
echo Open http://127.0.0.1:3000 in your browser.
echo Choose Client, Beauty store owner, then Continue.
echo Keep this window open while using the app. Press Ctrl+C to stop.
echo.
"%BEAUTY_NODE%" node_modules\next\dist\bin\next start --hostname 127.0.0.1 --port 3000
pause
