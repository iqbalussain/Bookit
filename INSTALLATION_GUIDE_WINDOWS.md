# Bookit v12.1.0 - Installation Guide (Windows)

## Overview
Bookit is a desktop invoice and accounting management system for Windows. This guide explains how to install and use it on your PC.

## System Requirements
- **OS:** Windows 7 or later (Windows 10/11 recommended)
- **Architecture:** x64 (64-bit)
- **RAM:** Minimum 2GB (4GB+ recommended)
- **Disk Space:** ~500MB for installation

## Installation Option

### Proper Windows Installer (.exe)
Use the installer file named like `Bookit Setup 12.1.0.exe`.

**Install steps:**
1. Download `Bookit Setup 12.1.0.exe`
2. Right-click it and choose **Run as administrator**
3. If Windows SmartScreen appears, click **More info** → **Run anyway**
4. Choose the install folder
5. Keep **Desktop Shortcut** enabled if you want an icon on the desktop
6. Click **Install** and wait for setup to finish
7. Launch **Bookit** from the desktop shortcut or Start Menu

**What this installer does:**
- Installs Bookit like a normal Windows app
- Creates Start Menu and desktop shortcuts
- Keeps your company data stored separately so updates do not erase it
- Works offline after installation
- Can optionally connect to a LAN server from Settings when needed

## First Launch

1. **Run Bookit** - Open it from the desktop shortcut or Start Menu
2. **Wait for app to start** - First launch may take a few seconds as it initializes the database
3. **Enable notifications (Optional)** - Windows may ask for permission to show notifications - grant it for better experience
4. **Start using** - Dashboard will appear, ready to use

## Offline and LAN Use

- **Offline mode:** Bookit works fully on one PC with local data storage.
- **LAN client mode:** Open **Settings → Network / Multi-user**, choose **Client**, and enter the main PC server URL.
- **Example LAN URL:** `http://192.168.1.50:4000`
- If no server is configured, the app continues to run locally.

## Features

- **Invoice Management** - Create and manage invoices
- **Customer/Supplier Management** - Maintain client and vendor databases
- **Purchase Orders & Quotations** - Generate purchase orders and quotations
- **Accounting Vouchers** - Journal, contra, expense, and loan vouchers
- **Payment Tracking** - Record payments and receipts
- **Reports** - Generate financial statements and charts of accounts
- **Dashboard** - Overview of your business metrics

## Database Location

Bookit uses SQLite for data storage. Your database is stored at:
```
C:\Users\{YourUsername}\AppData\Local\Bookit\invoiceflow.db
```

### Backup Your Data
Regular backups are recommended:
1. Navigate to the folder above using Windows File Explorer
2. Copy `invoiceflow.db` to a safe location (USB drive, cloud storage, etc.)

### Restore from Backup
1. Close Bookit completely
2. Replace the current `invoiceflow.db` with your backup
3. Relaunch Bookit

## Troubleshooting

### Installer Won't Open
- **SmartScreen warning:** Click **More info** and then **Run anyway**
- **Antivirus Blocking:** Your antivirus may block a new installer on first run. Whitelist `Bookit Setup 12.1.0.exe`
- **Corrupt download:** Delete the file and download the installer again

### App Won't Start
- **Run from Start Menu:** Do not launch files from inside temporary extraction folders
- **Missing Dependencies:** Ensure you're running Windows 7 or later
- **Reinstall:** Uninstall Bookit, then run the installer again as administrator

### Database Errors
- Try deleting the database file and restarting (it will create a fresh one):
  ```
  C:\Users\{YourUsername}\AppData\Local\Bookit\invoiceflow.db
  ```
- If problems persist, restore from backup

### Performance Issues
- Close other applications to free up system memory
- Restart Windows
- Ensure at least 500MB free disk space

## Creating a Shortcut on Desktop

If you skipped shortcut creation during setup:
1. Open the **Start Menu**
2. Search for **Bookit**
3. Right-click it → **Open file location**
4. Right-click **Bookit** → **Send to** → **Desktop (create shortcut)**

## Uninstalling

Bookit uses a normal Windows installer, so removal is simple:

1. Open **Settings → Apps → Installed apps**
2. Find **Bookit** and click **Uninstall**
3. (Optional) Delete the database folder to completely remove all data:
   ```
   C:\Users\{YourUsername}\AppData\Local\Bookit\
   ```

## File Descriptions

| File | Purpose |
|------|---------|
| `Bookit.exe` / `Bookit-12.1.0.exe` | Main application executable - run this to start Bookit |
| `resources/app.asar` | Bundled application code and assets |
| `*.dll` / `*.pak` | Chromium and Electron framework dependencies |
| `*.dat` / `*.bin` | Runtime resources (internationalization, snapshots) |

##Support & Issues

If you encounter issues:
1. Check the troubleshooting section above
2. Verify your Windows is up to date (Windows Update)
3. Ensure you have write permissions to the AppData folder
4. Check anti-virus/firewall settings aren't blocking the app

## Version Information

- **Version:** 12.1.0
- **Built with:** Electron 28, React 18, SQLite3
- **Architecture:** 64-bit Windows
- **Package Date:** April 21, 2026

---

**Ready to use?** Start Bookit now by running `Bookit-12.1.0.exe`!
