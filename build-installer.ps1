# Build Wotti Installer Script
# This script builds the installer using Inno Setup Compiler

$ErrorActionPreference = "Stop"

Write-Host "=== Wotti Installer Builder ===" -ForegroundColor Cyan
Write-Host ""

# Check if Inno Setup is installed
$innoSetupPath = @(
    "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles}\Inno Setup 6\ISCC.exe",
    "${env:ProgramFiles(x86)}\Inno Setup 5\ISCC.exe",
    "${env:ProgramFiles}\Inno Setup 5\ISCC.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $innoSetupPath) {
    Write-Host "Error: Inno Setup Compiler not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Inno Setup from: https://jrsoftware.org/isinfo.php" -ForegroundColor Yellow
    Write-Host "Or specify the path to ISCC.exe manually." -ForegroundColor Yellow
    Write-Host ""
    $manualPath = Read-Host "Enter path to ISCC.exe (or press Enter to exit)"
    
    if ($manualPath -and (Test-Path $manualPath)) {
        $innoSetupPath = $manualPath
    } else {
        exit 1
    }
}

Write-Host "Found Inno Setup at: $innoSetupPath" -ForegroundColor Green
Write-Host ""

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$issFile = Join-Path $scriptDir "wotti-installer.iss"

if (-not (Test-Path $issFile)) {
    Write-Host "Error: wotti-installer.iss not found at: $issFile" -ForegroundColor Red
    exit 1
}

Write-Host "Building installer from: $issFile" -ForegroundColor Cyan
Write-Host ""

# Create installer directory if it doesn't exist
$installerDir = Join-Path $scriptDir "installer"
if (-not (Test-Path $installerDir)) {
    New-Item -ItemType Directory -Path $installerDir | Out-Null
    Write-Host "Created installer directory: $installerDir" -ForegroundColor Green
}

# Build the installer
Write-Host "Compiling installer..." -ForegroundColor Yellow
$process = Start-Process -FilePath $innoSetupPath -ArgumentList "`"$issFile`"" -Wait -PassThru -NoNewWindow

if ($process.ExitCode -eq 0) {
    Write-Host ""
    Write-Host "=== Installer built successfully! ===" -ForegroundColor Green
    Write-Host ""
    
    # Find the output file
    $outputFile = Get-ChildItem -Path $installerDir -Filter "Wotti-Setup-*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    
    if ($outputFile) {
        Write-Host "Installer location: $($outputFile.FullName)" -ForegroundColor Cyan
        Write-Host "File size: $([math]::Round($outputFile.Length / 1MB, 2)) MB" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "You can now distribute this installer to your users!" -ForegroundColor Green
    } else {
        Write-Host "Warning: Could not find the output installer file." -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "Error: Installer build failed with exit code $($process.ExitCode)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Read-Host "Press Enter to exit"

