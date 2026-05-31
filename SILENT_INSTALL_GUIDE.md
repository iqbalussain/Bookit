# BookIt Silent Installation Guide

This guide explains how to install BookIt on Windows using silent/unattended mode, ideal for deploying to multiple PCs with minimal user interaction.

---

## Overview

**Three Installation Methods:**

1. **GUI Installer** - Standard Windows installer with user prompts
1. **Batch Script** - Silent installation with `.bat` file (simple)
1. **PowerShell Script** - Silent installation with `.ps1` file (advanced)

---

## Method 1: Batch Script (simple)

### Quick Start

1. Download: `BookIt Setup 1.0.0.exe` and `scripts/silent-install.bat`
1. Place both in the same folder
1. Right-click `silent-install.bat` → **Run as administrator**
1. Wait for installation to complete

### Command Line Usage

Open **Command Prompt as Administrator** and run:

```cmd
cd C:\path\to\scripts
silent-install.bat
```

### With Custom Installation Path

```cmd
silent-install.bat "D:\Applications\BookIt"
```

### With Custom Path and Quiet Mode

```cmd
silent-install.bat "C:\Program Files\BookIt" yes
```

### Batch Script Parameters

| Parameter | Description | Default |
| `[install_path]` Installation directory | `%ProgramFiles%\\BookIt` |
| `[quiet]` | Silent mode with no prompts (yes/no) | `yes` |

### Batch Script Exit Codes

| Code | Meaning |
| `0` | Success |
| `1` | Administrator privileges required |
| `2` | Installer not found |
| `3` | Installation failed |

### Example Batch Commands

```cmd
:: Install to default location
silent-install.bat

:: Install to custom location
silent-install.bat "D:\BookIt"

:: Install to custom location with verbose output
silent-install.bat "C:\Program Files\BookIt" no
```

### Batch Script Logging

After installation, logs are saved to:

```text
%LOCALAPPDATA%\BookIt\installer-logs\
```

Example path:

```text
C:\Users\JohnDoe\AppData\Local\BookIt\installer-logs\install-2024-04-24-14-30-45.log
```

---

## Method 2: PowerShell Script (advanced)

More flexible deployment with advanced options.

### Prerequisites

1. **Run PowerShell as Administrator**
1. Allow script execution:

```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

### PowerShell Quick Start

```powershell
cd C:\path\to\scripts
.\silent-install.ps1 -InstallerPath "C:\BookIt Setup 1.0.0.exe"
```

### PowerShell Parameters

| Parameter | Description | Default |
| `-InstallerPath` | Full path to BookIt Setup.exe | Auto-detect in script dir |
| `-InstallPath` | Installation directory | `$env:ProgramFiles\\BookIt` |
| `-NoRestart` | Do not restart after install | (Restart if needed) |
| `-Quiet` | Suppress console output | (Verbose mode) |
| `-LogPath` | Custom log file location | Auto-generated |

### PowerShell Examples

**Basic installation:**

```powershell
.\silent-install.ps1 -InstallerPath "C:\BookIt Setup 1.0.0.exe"
```

**Custom installation path:**

```powershell
.\silent-install.ps1 -InstallerPath "C:\BookIt Setup 1.0.0.exe" -InstallPath "D:\Apps\BookIt"
```

**Silent with no console output:**

```powershell
.\silent-install.ps1 -InstallerPath "C:\BookIt Setup 1.0.0.exe" -Quiet
```

**No automatic restart:**

```powershell
.\silent-install.ps1 -InstallerPath "C:\BookIt Setup 1.0.0.exe" -Quiet -NoRestart
```

**All options:**

```powershell
.\silent-install.ps1 `
  -InstallerPath "C:\Installers\BookIt Setup 1.0.0.exe" `
  -InstallPath "D:\Software\BookIt" `
  -Quiet `
  -NoRestart `
  -LogPath "C:\Logs\bookit-install.log"
```

### PowerShell Exit Codes

| Code | Meaning |
| `0` | Success |
| `1` | Administrator privileges required |
| `2` | Installer not found |
| `3` | Installation failed (insufficient space, disk error, etc.) |

### PowerShell Logging

Logs saved to:

```text
%LOCALAPPDATA%\BookIt\installer-logs\install-YYYY-MM-DD-HH-MM-SS.log
```

View logs during installation:

```powershell
Get-Content "C:\Users\<YourName>\AppData\Local\BookIt\installer-logs\*.log" -Tail 50
```

---

## Batch Deployment (Multiple PCs)

### Method 1: Group Policy (Enterprise)

**On Domain Controller:**

1. Create shared network folder: `\\server\bookit-deploy`
1. Copy installer and script
1. Create group policy to run batch script at startup:
   - **Group Policy Editor** → **Computer Configuration** → **Windows Settings** → **Scripts** → **Startup**
   - Add: `\\server\bookit-deploy\silent-install.bat`

**On Each Client (runs at next startup):**

```cmd
gpupdate /force
```

### Method 2: PowerShell Remote Execution

**From Administrator PC:**

```powershell
# Define target computers
$Computers = @(
    "PC01",
    "PC02",
    "PC03",
    "PC04"
)

# Define installer and script paths
$InstallerPath = "\\server\bookit-deploy\BookIt Setup 1.0.0.exe"
$ScriptPath = "\\server\bookit-deploy\silent-install.ps1"

# Run installation on each computer
foreach ($Computer in $Computers) {
    Write-Host "Installing BookIt on $Computer..."
    
    Invoke-Command -ComputerName $Computer -ScriptBlock {
        param($Installer, $Script)
        & $Script -InstallerPath $Installer -Quiet
    } -ArgumentList $InstallerPath, $ScriptPath
    
    Write-Host "$Computer installation completed"
    Start-Sleep -Seconds 5
}

Write-Host "All installations completed!"
```

### Method 3: Network Share with Batch File

**Setup network share:**

1. Copy installer to: `\\server\bookit-deploy\BookIt Setup.exe`
1. Copy batch script to: `\\server\bookit-deploy\silent-install.bat`
1. Create a wrapper batch file: `deploy-all.bat`

**deploy-all.bat:**

```batch
@echo off
REM Run installation from network share
net use Z: \\server\bookit-deploy /persistent:yes
cd Z:
silent-install.bat "C:\Program Files\BookIt"
pause
```

**Distribute deploy-all.bat to each PC:**

- Email it to users with instructions: "Run as Administrator"
- Or copy to a shared folder with shortcut

---

## Troubleshooting Silent Install

### Issue: "Access Denied" or permission error

#### Fix

- Run Command Prompt/PowerShell as Administrator
- Batch: Right-click → **Run as administrator**
- PowerShell: Run PowerShell as Administrator first

### Issue: "Installer not found"

#### Fix 2

- Ensure `BookIt Setup.exe` is in the same folder as the script
- Use full path to installer:

```cmd
silent-install.bat "C:\path\BookIt Setup 1.0.0.exe"
```

### Issue: Installation hangs or takes very long

#### Fix 1

- Check antivirus - may be scanning installer
- Temporarily disable antivirus
- Check available disk space (minimum 500MB needed)
- Look for error in log file

### Issue: Exit code 3 (Installation failed)

#### Fix 12

1. Check log file:

```text
C:\Users\<YourName>\AppData\Local\BookIt\installer-logs\
```

1. Common causes:
   - Not enough disk space (need 500MB+)
   - Antivirus blocking installation
   - Corrupted installer file
   - Invalid installation path

### Issue: Need to view installation logs

#### How to view logs

```cmd
type "%LOCALAPPDATA%\BookIt\installer-logs\*.log"
```

```cmd
explorer "%LOCALAPPDATA%\BookIt\installer-logs\"
```

---

## Verification After Installation

### Check Installation

Verify BookIt was installed:

```cmd
REM Check if BookIt.exe exists
if exist "C:\Program Files\BookIt\BookIt.exe" (
    echo Installation successful!
) else (
    echo Installation failed!
)
```

### Launch BookIt

From command line:

```cmd
start "C:\Program Files\BookIt\BookIt.exe"
```

From PowerShell:

```powershell
& "C:\Program Files\BookIt\BookIt.exe"
```

### Check Database Creation

On first launch, BookIt creates database at:

```text
%LOCALAPPDATA%\bookit\invoiceflow.db
```

Verify it exists:

```cmd
dir "%LOCALAPPDATA%\bookit\invoiceflow.db"
```

---

## Silent Install Best Practices

### For Enterprise Deployments

1. **Test on single PC first** - Ensure script works in your environment
1. **Document the process** - For future reference and troubleshooting
1. **Use network shares** - `\\server\share` for centralized deployment
1. **Schedule off-hours** - Deploy during maintenance windows
1. **Keep logs** - Save installation logs for audit trail
1. **Plan for failures** - Have rollback procedure if needed

### Installation Path Recommendations

| Environment | Path |
| Standard | `C:\Program Files\BookIt` |
| Applications drive | `D:\Applications\BookIt` |
| Custom configuration | `/D=<Your Path>` |

### Network Considerations

- **Bandwidth**: Installer is ~200MB, plan for network load
- **Speed**: Local copy faster than network share
- **Reliability**: Retry mechanism not built-in, add logic if needed

---

## Uninstallation

### Remove BookIt

```cmd
cd "C:\Program Files\BookIt"
uninstall.exe /S
```

Or use Control Panel → Programs → Uninstall a Program

### Keep Data During Uninstall

Database is stored separately, uninstalling does NOT delete your data:

```text
C:\Users\<YourName>\AppData\Local\bookit\invoiceflow.db
```

#### Backup before uninstall

```cmd
copy "%LOCALAPPDATA%\bookit\invoiceflow.db" "D:\Backup\invoiceflow.db"
```

---

## Technical Details

### Squirrel Windows Installer

BookIt uses Squirrel.Windows for installation. Command-line options:

| Option | Description |
| `/S` | Silent installation |
| `/D=` | Installation directory |
| `/AllUsers` | Install for all users (requires admin) |

### What Gets Installed

- **Application executable**: `BookIt.exe`
- **Dependencies**: Chromium, Node modules (bundled)
- **Registry entries**: For shortcuts, associations
- **Start Menu shortcuts**: `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\BookIt`
- **Desktop shortcuts**: `%USERPROFILE%\Desktop\BookIt.lnk`

### Database Location

SQLite database is stored in user's local data folder:

```text
%LOCALAPPDATA%\bookit\invoiceflow.db
```
