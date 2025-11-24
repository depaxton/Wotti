# Wotti Launcher Script
# Checks if the app is already running, and either opens browser or starts the app

$ErrorActionPreference = "Stop"

# Configuration
$PORT = 5000
$APP_URL = "http://localhost:$PORT"
$APP_DIR = $PSScriptRoot
$NODE_SCRIPT = "index.js"
$PROCESS_NAME = "WOTTI"

# Function to check if port is in use
function Test-Port {
    param([int]$Port)
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue
        return $connection
    } catch {
        return $false
    }
}

# Function to check if process is running by checking command line
function Test-ProcessRunning {
    param([string]$ProcessName)
    try {
        # Use WMI to check command line of node processes
        $processes = Get-WmiObject Win32_Process -Filter "name='node.exe'" -ErrorAction SilentlyContinue | Where-Object {
            $_.CommandLine -like "*$NODE_SCRIPT*" -and
            $_.CommandLine -like "*$APP_DIR*"
        }
        return ($processes -ne $null -and $processes.Count -gt 0)
    } catch {
        # Fallback: just check if any node process exists
        $nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
        return ($nodeProcesses.Count -gt 0)
    }
}

# Function to open browser
function Open-Browser {
    param([string]$Url)
    Write-Host "Opening browser to $Url..." -ForegroundColor Green
    Start-Process $Url
}

# Function to start the application
function Start-Application {
    Write-Host "Starting Wotti application..." -ForegroundColor Green
    
    # Change to app directory
    Set-Location $APP_DIR
    
    # Check if node_modules exists
    if (-not (Test-Path "node_modules")) {
        Write-Host "node_modules not found. Please run 'npm install' first." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
    
    # Start the application
    try {
        # Use Start-Process to run in new window, but keep it visible
        $processInfo = New-Object System.Diagnostics.ProcessStartInfo
        $processInfo.FileName = "node"
        $processInfo.Arguments = "`"$NODE_SCRIPT`""
        $processInfo.WorkingDirectory = $APP_DIR
        $processInfo.UseShellExecute = $false
        $processInfo.CreateNoWindow = $false
        
        $process = [System.Diagnostics.Process]::Start($processInfo)
        
        Write-Host "Application started. Process ID: $($process.Id)" -ForegroundColor Green
        Write-Host "Opening browser in 3 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        Open-Browser -Url $APP_URL
    } catch {
        Write-Host "Failed to start application: $_" -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit 1
    }
}

# Main logic
Write-Host "Wotti Launcher" -ForegroundColor Cyan
Write-Host "==============" -ForegroundColor Cyan
Write-Host ""

# Check if port is in use
$portInUse = Test-Port -Port $PORT

if ($portInUse) {
    Write-Host "Application is already running on port $PORT" -ForegroundColor Yellow
    Write-Host "Opening browser..." -ForegroundColor Green
    Open-Browser -Url $APP_URL
} else {
    # Port is not in use, but check for processes anyway
    $processRunning = Test-ProcessRunning -ProcessName $PROCESS_NAME
    
    if ($processRunning) {
        Write-Host "Found running processes. Opening browser..." -ForegroundColor Yellow
        Open-Browser -Url $APP_URL
    } else {
        # Start the application
        Start-Application
    }
}

