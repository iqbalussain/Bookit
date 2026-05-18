# BookIt LAN Network Setup Guide

This guide explains how to set up BookIt to share data across multiple PCs on your local network (LAN).

---

## Overview

**Three Usage Modes:**

1. **Standalone (Offline)** - Single PC, local data only
1. **LAN Server (Host)** - Main PC hosting shared database
1. **LAN Client** - Other PCs connecting to the server

---

## Step 1: Set Up the LAN Server (Main PC)

The server PC holds the centralized database that all client PCs connect to.

### Server Prerequisites

1. Node.js 14+ installed on the server PC
1. All PCs on the same network (router)

### Server Installation

**On your main/server PC:**

1. Open **PowerShell** or **Command Prompt** as Administrator.
1. Navigate to the BookIt server folder:

```bash
cd C:\path\to\bookit\server
```

1. Install dependencies (run once):

```bash
npm install
```

1. Start the server:

```bash
npm start
```

1. **Note the URL displayed**, for example:

```text
IQBook LAN Server running on http://192.168.1.50:4000
```

1. Keep this window **open** while using BookIt across the network.

### Finding Your Server IP Address

If the server does not display the IP, find it manually.

1. Open **PowerShell** on the server PC.
1. Run:

```bash
ipconfig
```

1. Look for **IPv4 Address** under your network adapter (usually `192.168.x.x`).
1. Your server URL will be:

```text
http://{YOUR_IP_ADDRESS}:4000
```

**Example:** If your IPv4 address is `192.168.1.50`, the URL is:

```text
http://192.168.1.50:4000
```

---

## Step 2: Verify Network Connectivity

Before connecting clients, verify the server is reachable.

**On any other PC on the same network:**

1. Open a web browser.
1. Type the server URL from Step 1:

```text
http://192.168.1.50:4000/api/health
```

1. You should see a healthy response (or success message).
1. If you see **"Cannot reach server"** → Check firewall (see Troubleshooting).

---

## Step 3: Connect a Client PC

Once the server is running, connect other PCs to it.

### Client Installation

**On each client PC:**

1. Install BookIt normally using the `.exe` installer.
1. Complete the installation.
1. Run BookIt.

### Configure Connection

**Inside BookIt application:**

1. Open BookIt on the client PC.
1. Go to **Settings** (gear icon, top navigation).
1. Click **Network / Multi-user**.
1. Select mode: **Client**.
1. Enter the server URL:

```text
http://192.168.1.50:4000
```

   (use the URL from your server PC)

1. Click **Test Connection**.
   - ✅ Success → "Connection verified"
   - ❌ Failed → Check server URL and firewall (see Troubleshooting)
1. Click **Save**.
1. BookIt will restart and sync with the server.

### Verify Connection

After saving, BookIt should:

- Display **Client mode** in Settings
- Sync data with the server PC
- Show the same data as other connected clients
- Work offline if the server goes down (cached data)

---

## Step 4: Connecting Additional Clients

Repeat **Step 3** on each additional PC:

- Install BookIt
- Open Settings → Network
- Select **Client** mode
- Enter the server URL
- Test and save

All clients will now share the same accounting database in real-time.

---

## Server Configuration (Advanced)

### Custom Data Directory

By default, server data is stored in:

```text
C:\Users\{YourUsername}\.iqbook
```

To change it, set an environment variable before starting the server:

```bash
set IQBOOK_DATA_DIR=D:\BookItData
npm start
```

### Custom Port

Default port is `4000`. To change it:

```bash
set PORT=5000
npm start
```

Then use: `http://192.168.1.50:5000` on client PCs.

---

## Common Scenarios

### Scenario 1: Server Goes Down

- Clients continue working with cached data
- Changes sync when server comes back online
- No data loss

### Scenario 2: New PC Joins Mid-Day

- Install BookIt on the new PC
- Connect to the server
- All previous data syncs automatically

### Scenario 3: Switching Between Offline and LAN

**On any client PC:**

1. Open Settings → Network.
1. Change mode from **Client** to **Standalone** (or back).
1. Click Save.
1. BookIt restarts with the new mode.

---

## Troubleshooting

### Issue: "Cannot connect to server"

#### Check #1: Server URL Format

- Ensure URL starts with `http://` (not `https://`).
- Remove trailing slashes.
- Example: ✅ `http://192.168.1.50:4000` ❌ `http://192.168.1.50:4000/`

#### Check #2: Server is Running

- Verify the server PowerShell window shows "running on http://..."
- If not, restart the server:

```bash
cd C:\path\to\bookit\server
npm start
```

#### Check #3: Network Connectivity

- Ping the server from the client PC:

```bash
ping 192.168.1.50
```

- If ping fails, devices are not on the same network.

#### Check #4: Firewall Blocking

- Windows Firewall may block port 4000.
- **Allow through firewall:**

  1. Open **Windows Defender Firewall** → **Allow an app through firewall**.
  1. Click **Allow another app**.
  1. Browse to your Node.js executable (usually `C:\Program Files\nodejs\node.exe`).
  1. Click **Add**.
  1. Restart the server.

### Issue: "Connection verified" but data doesn't sync

- Wait 5-10 seconds (sync happens in background)
- Check if you're in **Client** mode (not Standalone)
- Restart BookIt
- Check server logs for errors

### Issue: Data shows differently on different PCs

- Ensure all PCs are showing **Client** mode
- Check network connection is stable
- Allow 10 seconds for sync after any changes

### Issue: Server Computer IP Address Changed

- Find the new IP: Run `ipconfig` on server PC
- Update all client PCs with the new URL
- Test connection from each client
