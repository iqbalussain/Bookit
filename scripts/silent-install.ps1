# BookIt Silent Installation Script (PowerShell)
# 
# Usage:
#   .\silent-install.ps1 -InstallerPath "C:\path\to\BookIt Setup.exe"
#   .\silent-install.ps1 -InstallerPath "C:\path\to\BookIt Setup.exe" -InstallPath "D:\BookIt"
#   .\silent-install.ps1 -InstallerPath "C:\path\to\BookIt Setup.exe" -NoRestart
#
# Prerequisites:
#   - Run as Administrator
#   - PowerShell Execution Policy allows scripts: Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
#
# Parameters:
#   -InstallerPath  : Full path to BookIt Setup.exe (required)
#   -InstallPath    : Installation directory (default: C:\Program Files\BookIt)
#   -NoRestart      : Do not restart after installation (default: restart if needed)
#   -Quiet          : No console output except errors (default: verbose)
#   -LogPath        : Custom log file path (default: %APPDATA%\BookIt\installer-logs\)

param(
    [Parameter(Mandatory=$false)]
    [string]$InstallerPath,
    
    [Parameter(Mandatory=$false)]
    [string]$InstallPath = "$env:ProgramFiles\BookIt",
    
    [Parameter(Mandatory=$false)]
    [switch]$NoRestart,
    
    [Parameter(Mandatory=$false)]
    [switch]$Quiet,
    
    [Parameter(Mandatory=$false)]
    [string]$LogPath
)

# ============================================================
# CONFIGURATION
# ============================================================

$ScriptVersion = "1.0.0"
$AppName = "BookIt"
$MinDiskSpace = 500MB  # 500 MB minimum

# Setup logging
if (-not $LogPath) {
    $LogDir = "$env:LOCALAPPDATA\BookIt\installer-logs"
    $LogFile = "$LogDir\install-$(Get-Date -Format 'yyyy-MM-dd-HH-mm-ss').log"
} else {
    $LogFile = $LogPath
    $LogDir = Split-Path $LogFile
}

# Create log directory if not exists
if (-not (Test-Path $LogDir)) {
    New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

# ============================================================
# LOGGING FUNCTION
# ============================================================

function Write-Log {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Message,
        
        [Parameter(Mandatory=$false)]
        [ValidateSet('Info', 'Warn', 'Error', 'Success')]
        [string]$Level = 'Info'
    )
    
    $Timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $LogMessage = "[$Timestamp] [$Level] $Message"
    
    # Write to file
    Add-Content -Path $LogFile -Value $LogMessage -ErrorAction SilentlyContinue
    
    # Write to console
    if (-not $Quiet) {
        switch ($Level) {
            'Error'   { Write-Host $LogMessage -ForegroundColor Red }
            'Warn'    { Write-Host $LogMessage -ForegroundColor Yellow }
            'Success' { Write-Host $LogMessage -ForegroundColor Green }
            default   { Write-Host $LogMessage -ForegroundColor Gray }
        }
    }
}

function Write-Header {
    param([string]$Text)
    if (-not $Quiet) {
        Write-Host ""
        Write-Host "============================================================" -ForegroundColor Cyan
        Write-Host $Text -ForegroundColor Cyan
        Write-Host "============================================================" -ForegroundColor Cyan
        Write-Host ""
    }
}

# ============================================================
# MAIN INSTALLATION LOGIC
# ============================================================

Write-Header "BookIt Silent Installer v$ScriptVersion"
Write-Log "Installation started by user: $env:USERNAME on machine: $env:COMPUTERNAME"
Write-Log "Log file: $LogFile"

# ============================================================
# ADMIN CHECK
# ============================================================

Write-Log "Checking for Administrator privileges..."
$principalContext = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object System.Security.Principal.WindowsPrincipal($principalContext)
$isAdmin = $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Log "ERROR: Administrator privileges required!" "Error"
    Write-Host "ERROR: This script requires Administrator privileges." -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Red
    exit 1
}

Write-Log "✓ Administrator privileges confirmed"

# ============================================================
# FIND INSTALLER
# ============================================================

Write-Log "Searching for installer..."

if ([string]::IsNullOrEmpty($InstallerPath)) {
    # Auto-detect in current directory
    $CurrentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $Installers = Get-ChildItem "$CurrentDir\BookIt Setup*.exe" -ErrorAction SilentlyContinue
    
    if ($Installers) {
        $InstallerPath = $Installers[0].FullName
        Write-Log "Auto-detected installer: $InstallerPath"
    } else {
        Write-Log "ERROR: Installer not found. Use -InstallerPath to specify location" "Error"
        Write-Host "ERROR: Installer not found!" -ForegroundColor Red
        Write-Host "Usage: .\silent-install.ps1 -InstallerPath 'C:\Path\To\BookIt Setup.exe'" -ForegroundColor Yellow
        exit 2
    }
} else {
    $InstallerPath = $InstallerPath
}

if (-not (Test-Path $InstallerPath)) {
    Write-Log "ERROR: Installer not found at: $InstallerPath" "Error"
    Write-Host "ERROR: File not found: $InstallerPath" -ForegroundColor Red
    exit 2
}

$InstallerSize = (Get-Item $InstallerPath).Length / 1MB
Write-Log "✓ Installer found: $InstallerPath (Size: $($InstallerSize.ToString('F2')) MB)"

# ============================================================
# SYSTEM CHECKS
# ============================================================

Write-Header "System Verification"

# Check OS
$OSInfo = Get-CimInstance Win32_OperatingSystem
Write-Log "OS: $($OSInfo.Caption) Build: $($OSInfo.BuildNumber)"

# Check Windows 7+
$OSVersion = [Environment]::OSVersion.Version
if ($OSVersion.Major -lt 6 -or ($OSVersion.Major -eq 6 -and $OSVersion.Minor -lt 1)) {
    Write-Log "ERROR: Windows 7 or later required" "Error"
    Write-Host "ERROR: Windows 7 or later is required. You have: $($OSInfo.Caption)" -ForegroundColor Red
    exit 3
}

# Check disk space
$Drive = $InstallPath.Substring(0, 2)
$DiskSpace = (Get-PSDrive $Drive.TrimEnd(':') | Select-Object -ExpandProperty Free)

if ($DiskSpace -lt $MinDiskSpace) {
    Write-Log "ERROR: Insufficient disk space. Required: $(500)MB, Available: $($DiskSpace/1MB)MB" "Error"
    Write-Host "ERROR: Not enough disk space!" -ForegroundColor Red
    Write-Host "Required: 500MB, Available: $($DiskSpace/1MB)MB" -ForegroundColor Red
    exit 3
}

Write-Log "✓ Disk space: $(($DiskSpace/1GB).ToString('F1')) GB available"

# Check CPU cores
$CpuInfo = Get-CimInstance Win32_Processor
Write-Log "CPU: $($CpuInfo.Name) Cores: $($CpuInfo.NumberOfCores)"

# Check RAM
$RamInfo = Get-CimInstance Win32_ComputerSystem
$RamGB = $RamInfo.TotalPhysicalMemory / 1GB
Write-Log "RAM: $($RamGB.ToString('F1')) GB"

# ============================================================
# PRE-INSTALL TASKS
# ============================================================

Write-Header "Pre-Installation Tasks"

# Stop running BookIt instances
Write-Log "Checking for running BookIt processes..."
$BookItProcesses = Get-Process -Name BookIt -ErrorAction SilentlyContinue

if ($BookItProcesses) {
    Write-Log "Terminating BookIt process..."
    $BookItProcesses | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Log "✓ BookIt process terminated"
} else {
    Write-Log "✓ No BookIt processes running"
}

# Create installation directory
if (-not (Test-Path $InstallPath)) {
    Write-Log "Creating installation directory: $InstallPath"
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
}

Write-Log "✓ Installation directory ready: $InstallPath"

# ============================================================
# PERFORM INSTALLATION
# ============================================================

Write-Header "Installing BookIt"

Write-Log "Executing installer with parameters:"
Write-Log "  Path: $InstallerPath"
Write-Log "  Destination: $InstallPath"
Write-Log "  Mode: Silent (no user prompts)"

try {
    $ProcessParams = @{
        FilePath     = $InstallerPath
        ArgumentList = "/S /D=$InstallPath /AllUsers"
        NoNewWindow  = $true
        Wait         = $true
        PassThru     = $true
    }
    
    $Process = Start-Process @ProcessParams
    $ExitCode = $Process.ExitCode
    
    Write-Log "Installation process completed with exit code: $ExitCode"
    
    if ($ExitCode -ne 0) {
        Write-Log "WARNING: Installer exited with code $ExitCode (may still be installing)" "Warn"
    }
} catch {
    Write-Log "ERROR: Failed to execute installer: $_" "Error"
    Write-Host "ERROR: Installation failed!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 3
}

# ============================================================
# POST-INSTALL VERIFICATION
# ============================================================

Write-Header "Verifying Installation"

Start-Sleep -Seconds 3

if (Test-Path "$InstallPath\BookIt.exe") {
    Write-Log "✓ BookIt.exe successfully installed"
    $ExeSize = (Get-Item "$InstallPath\BookIt.exe").Length / 1MB
    Write-Log "  Binary size: $($ExeSize.ToString('F2')) MB"
    
    # Check if shortcuts directory exists
    $ShortcutsPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\BookIt"
    if (Test-Path $ShortcutsPath) {
        Write-Log "✓ Start Menu shortcuts created"
    }
    
    # Create desktop shortcut if not exists
    $DesktopShortcut = "$env:USERPROFILE\Desktop\BookIt.lnk"
    if (-not (Test-Path $DesktopShortcut)) {
        Write-Log "Creating desktop shortcut..."
        $Shell = New-Object -ComObject WScript.Shell
        $Shortcut = $Shell.CreateShortCut($DesktopShortcut)
        $Shortcut.TargetPath = "$InstallPath\BookIt.exe"
        $Shortcut.WorkingDirectory = $InstallPath
        $Shortcut.Description = "BookIt - Accounting Management System"
        $Shortcut.Save()
        Write-Log "✓ Desktop shortcut created"
    }
    
    # ============================================================
    # SUCCESS
    # ============================================================
    
    Write-Header "Installation Successful!"
    Write-Log "Installation completed successfully" "Success"
    
    if (-not $Quiet) {
        Write-Host "✓ BookIt has been installed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Installation Details:" -ForegroundColor Yellow
        Write-Host "  Location: $InstallPath"
        Write-Host "  Version: $ScriptVersion"
        Write-Host "  Log file: $LogFile"
        Write-Host ""
        Write-Host "Next Steps:" -ForegroundColor Yellow
        Write-Host "  1. Find 'BookIt' in Start Menu or Desktop shortcut"
        Write-Host "  2. Click to launch the application"
        Write-Host "  3. On first launch, the database will be created"
        Write-Host ""
        Write-Host "For LAN setup, see NETWORK_SETUP_GUIDE.md in the docs folder" -ForegroundColor Cyan
        Write-Host ""
    }
    
    Write-Log "Installation completed. Ready for use."
    exit 0
    
} else {
    # ============================================================
    # FAILURE
    # ============================================================
    
    Write-Log "ERROR: Installation verification failed - BookIt.exe not found at $InstallPath" "Error"
    Write-Header "Installation Failed!"
    
    Write-Host "✗ Installation could not be verified." -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting:" -ForegroundColor Yellow
    Write-Host "  1. Run this script as Administrator"
    Write-Host "  2. Ensure at least 500MB free disk space"
    Write-Host "  3. Disable antivirus temporarily and retry"
    Write-Host "  4. Close all other applications"
    Write-Host "  5. Check log file for details: $LogFile"
    Write-Host ""
    
    if (-not $Quiet) {
        Write-Host "Log file contents:" -ForegroundColor Cyan
        Get-Content $LogFile | Select-Object -Last 20
    }
    
    exit 3
}
