@echo off
title Amna's Bakery Server
cd /d "%~dp0"
set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"

echo ===================================================
echo           Starting Amna's Bakery...
echo ===================================================
echo Opening website in your browser...
echo Website Link: http://localhost:3000
echo Database Link: http://localhost:3000/database
echo.
echo Press Ctrl + C to stop the server anytime.
echo ===================================================
echo.

timeout /t 2 /nobreak >nul
start "" "http://localhost:3000"
node server.js

if %errorlevel% neq 0 (
    echo.
    echo Server stopped with error.
    pause
)

