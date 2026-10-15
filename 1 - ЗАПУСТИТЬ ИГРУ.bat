@echo off
cd /d "%~dp0"
powershell -NoProfile -File "%~dp0scripts\launch.ps1"
if errorlevel 1 pause
