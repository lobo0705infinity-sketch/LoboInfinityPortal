@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install.ps1" "%~1"
set "InstallResult=%ERRORLEVEL%"
echo.
pause
exit /b %InstallResult%
