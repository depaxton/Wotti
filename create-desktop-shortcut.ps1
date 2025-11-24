# Script to create desktop shortcut for Wotti
# Run this script to create a desktop icon

$ErrorActionPreference = "Stop"

# Get paths
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktopPath "Wotti.lnk"
$iconPath = Join-Path $scriptDir "assets\images\wotti-ico.ico"
$targetPath = Join-Path $scriptDir "launch-wotti.vbs"

# Check if icon exists
if (-not (Test-Path $iconPath)) {
    Write-Host "Warning: Icon file not found at $iconPath" -ForegroundColor Yellow
    Write-Host "Shortcut will be created without custom icon." -ForegroundColor Yellow
    $iconPath = $null
}

# Check if launcher exists
if (-not (Test-Path $targetPath)) {
    Write-Host "Error: Launcher file not found at $targetPath" -ForegroundColor Red
    Write-Host "Please make sure launch-wotti.vbs exists in the project directory." -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Create WScript Shell object
$WshShell = New-Object -ComObject WScript.Shell

# Create shortcut
try {
    $Shortcut = $WshShell.CreateShortcut($shortcutPath)
    $Shortcut.TargetPath = $targetPath
    $Shortcut.WorkingDirectory = $scriptDir
    $Shortcut.Description = "Wotti - WhatsApp Integration"
    
    if ($iconPath -and (Test-Path $iconPath)) {
        $Shortcut.IconLocation = $iconPath
    }
    
    $Shortcut.Save()
    
    Write-Host "Desktop shortcut created successfully!" -ForegroundColor Green
    Write-Host "Location: $shortcutPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "You can now double-click the 'Wotti' icon on your desktop to launch the application." -ForegroundColor Cyan
} catch {
    Write-Host "Error creating shortcut: $_" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Read-Host "Press Enter to exit"

