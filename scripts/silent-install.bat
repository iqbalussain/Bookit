:: BookIt Silent Installer Script
:: Usage: silent-install.bat [install_path] [quiet]
:: 
:: Parameters:
::   [install_path]  - Installation directory (default: %ProgramFiles%\BookIt)
::   [quiet]         - Silent mode with no prompts (yes/no, default: yes)
::
:: Examples:
::   silent-install.bat
::   silent-install.bat "D:\Applications\BookIt" yes
::   silent-install.bat "%ProgramFiles%\BookIt" yes
::
:: Exit Codes:
::   0 = Success
::   1 = Admin required
::   2 = Installer not found
::   3 = Installation failed

@echo off
SETLOCAL ENABLEDELAYEDEXPANSION

:: Colors (optional, for better readability)
cls
color 0A
title BookIt Silent Installer

:: ============================================================
:: ADMIN CHECK
:: ============================================================
echo Checking for administrator privileges...
net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ERROR: Administrator privileges required!
    echo Please run this script as Administrator.
    echo.
    echo Right-click silent-install.bat and select "Run as administrator"
    pause
    exit /b 1
)

:: ============================================================
:: PARSE ARGUMENTS
:: ============================================================
set "INSTALL_PATH=%ProgramFiles%\BookIt"
set "QUIET_MODE=yes"

if not "%~1"=="" (
    set "INSTALL_PATH=%~1"
)
if not "%~2"=="" (
    set "QUIET_MODE=%~2"
)

:: ============================================================
:: ENVIRONMENT SETUP
:: ============================================================
set "SCRIPT_DIR=%~dp0"
set "INSTALLER_NAME=BookIt Setup*.exe"
set "LOG_DIR=%LOCALAPPDATA%\BookIt\installer-logs"
set "LOG_FILE=%LOG_DIR%\install-%date:~-4%-%date:~-10,2%-%date:~-7,2%-%time:~0,2%-%time:~3,2%-%time:~6,2%.log"

:: Create log directory
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

echo.
echo ============================================================
echo BookIt Silent Installation
echo ============================================================
echo Installation Path: %INSTALL_PATH%
echo Quiet Mode: %QUIET_MODE%
echo Log File: %LOG_FILE%
echo Time: %date% %time%
echo ============================================================
echo.

:: ============================================================
:: LOG FUNCTION
:: ============================================================
:log_message
if not exist "%LOG_FILE%" (
    type nul > "%LOG_FILE%"
)
echo [%date% %time%] %~1 >> "%LOG_FILE%"
if /i "%QUIET_MODE%"=="no" (
    echo %~1
)
exit /b 0

:: ============================================================
:: FIND INSTALLER
:: ============================================================
echo Searching for installer...
call :log_message "=== Installation Started ==="
call :log_message "Looking for installer: %INSTALLER_NAME%"

for %%I in ("%SCRIPT_DIR%%INSTALLER_NAME%") do (
    if exist "%%I" (
        set "INSTALLER_PATH=%%I"
        call :log_message "Found installer: %%I"
    )
)

if not defined INSTALLER_PATH (
    echo ERROR: Installer not found in %SCRIPT_DIR%
    call :log_message "ERROR: No installer found matching pattern: %INSTALLER_NAME%"
    echo.
    echo Expected files like: "BookIt Setup 1.0.0.exe"
    echo.
    pause
    exit /b 2
)

:: ============================================================
:: SYSTEM CHECKS
:: ============================================================
echo Performing system checks...
call :log_message "Checking system requirements..."

:: Check Windows version
for /f "tokens=*" %%A in ('wmic os get caption ^| findstr /r "Windows"') do (
    set "OS_VERSION=%%A"
    call :log_message "OS Detected: %%A"
)

:: Check available disk space (rough check)
for /f "usebackq delims== tokens=2" %%A in (`wmic logicaldisk where name^="%INSTALL_PATH:~0,2%" get freespace /format:value`) do (
    set "FREE_SPACE=%%A"
    call :log_message "Free disk space: %%A bytes"
)

if "%FREE_SPACE%"=="" (
    call :log_message "WARNING: Could not determine free disk space"
)

:: ============================================================
:: PRE-INSTALL CHECKS
:: ============================================================
echo Verifying prerequisites...
call :log_message "Checking for conflicting processes..."

:: Kill existing BookIt processes
tasklist /FI "IMAGENAME eq BookIt.exe" 2>NUL | find /I /N "BookIt.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo Closing existing BookIt instances...
    call :log_message "Terminating existing BookIt process"
    taskkill /IM BookIt.exe /F /T 2>NUL
    timeout /t 2 /nobreak >nul
)

:: ============================================================
:: PERFORM INSTALLATION
:: ============================================================
echo.
echo Starting installation...
echo Installer: %INSTALLER_PATH%
echo.
call :log_message "Executing installer: %INSTALLER_PATH%"
call :log_message "Installation path: %INSTALL_PATH%"

if /i "%QUIET_MODE%"=="yes" (
    echo Running in silent mode (no prompts)...
    "%INSTALLER_PATH%" /S /D="%INSTALL_PATH%" /AllUsers
) else (
    echo Running in normal mode (with installer window)...
    "%INSTALLER_PATH%" /D="%INSTALL_PATH%"
)

:: ============================================================
:: VERIFY INSTALLATION
:: ============================================================
echo Verifying installation...
timeout /t 3 /nobreak >nul

if exist "%INSTALL_PATH%\BookIt.exe" (
    echo SUCCESS! BookIt installed to: %INSTALL_PATH%
    call :log_message "SUCCESS: Installation completed"
    call :log_message "BookIt.exe verified at: %INSTALL_PATH%\BookIt.exe"
    
    :: ============================================================
    :: POST-INSTALL SETUP
    :: ============================================================
    echo.
    echo Setting up shortcuts...
    call :log_message "Creating Start Menu shortcut"
    
    :: Create shortcut to desktop
    set "DESKTOP=%USERPROFILE%\Desktop"
    if not exist "%DESKTOP%\BookIt.lnk" (
        powershell -Command "$s = New-Object -COM WScript.Shell; $s.CreateShortcut('%DESKTOP%\BookIt.lnk').TargetPath = '%INSTALL_PATH%\BookIt.exe'; $s.CreateShortcut('%DESKTOP%\BookIt.lnk').Save()" 2>NUL
        call :log_message "Desktop shortcut created"
    )
    
    echo.
    echo ============================================================
    echo Installation Complete!
    echo ============================================================
    echo.
    echo Next Steps:
    echo 1. BookIt has been installed to: %INSTALL_PATH%
    echo 2. A shortcut has been created on your Desktop
    echo 3. Launch BookIt from Start Menu or Desktop shortcut
    echo 4. On first launch, the database will be created
    echo.
    echo For LAN setup, see: NETWORK_SETUP_GUIDE.md
    echo.
    
    if /i "%QUIET_MODE%"=="no" (
        echo Log file: %LOG_FILE%
        echo.
        pause
    )
    
    exit /b 0
) else (
    echo ERROR: Installation verification failed!
    echo BookIt.exe not found at: %INSTALL_PATH%
    call :log_message "ERROR: Installation verification failed"
    echo.
    echo Troubleshooting:
    echo 1. Check that you have Administrator privileges
    echo 2. Verify the installation path is accessible
    echo 3. Ensure at least 500MB free disk space
    echo 4. Disable antivirus temporarily and retry
    echo.
    echo Log file: %LOG_FILE%
    echo.
    pause
    exit /b 3
)

endlocal
