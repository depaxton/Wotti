@echo off
REM Wotti Launcher Batch File
REM This file launches the PowerShell script

cd /d "%~dp0"
powershell.exe -ExecutionPolicy Bypass -File "%~dp0launch-wotti.ps1"
if errorlevel 1 (
    pause
)

