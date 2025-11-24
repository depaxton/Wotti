@echo off
chcp 65001 >nul
echo ========================================
echo יצירת קיצור דרך לשולחן העבודה - Wotti
echo ========================================
echo.

cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -File "%~dp0create-desktop-shortcut.ps1"

pause

