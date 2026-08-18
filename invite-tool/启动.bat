@echo off
title Auto-Invite Tool - yueyu
cd /d "%~dp0"
echo ================================================
echo    Auto-Invite Tool  -  yueyu
echo    Make sure Hiddify proxy is ON first
echo    (local proxy: 127.0.0.1:12334)
echo ================================================
echo.
node start.js
echo.
echo    Tool stopped.
pause
