const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, dialog, shell, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const sqlite3 = require('sqlite3').verbose();
const DiagnosticLogger = require('./diagnostic-logger.cjs');

const isDev = process.env.NODE_ENV === 'development';
const diagnostics = new DiagnosticLogger();
let mainWindow = null;
let db = null;

// ================= DATABASE =================
function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'bookit.db');
  diagnostics.log('info', `DB Path: ${dbPath}`);

  db = new sqlite3.Database(dbPath);

  db.serialize(() => {
    // Parties
    db.run(`CREATE TABLE IF NOT EXISTS parties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      sync_status INTEGER DEFAULT 0
    )`);

    // Invoices
    db.run(`CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_id INTEGER,
      invoice_no TEXT,
      total REAL,
      paid REAL DEFAULT 0,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME,
      sync_status INTEGER DEFAULT 0
    )`);

    // Invoice Items
    db.run(`CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      item_name TEXT,
      qty REAL,
      price REAL,
      total REAL
    )`);

    // Payments
    db.run(`CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_id INTEGER,
      amount REAL,
      method TEXT,
      reference TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sync_status INTEGER DEFAULT 0
    )`);

    // Settings
    db.run(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);
  });
}

// ================= IPC =================
function setupIPC() {

  // DB PATH
  ipcMain.handle('get-db-path', () => {
    return path.join(app.getPath('userData'), 'bookit.db');
  });

  // GENERIC QUERY
  ipcMain.handle('db-query', (_, sql, params = []) => {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  });

  // SAVE INVOICE
  ipcMain.handle('save-invoice', (_, invoice) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO invoices (party_id, invoice_no, total, status)
         VALUES (?, ?, ?, ?)`,
        [invoice.party_id, invoice.invoice_no, invoice.total, 'unpaid'],
        function (err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });
  });

  // GET INVOICES
  ipcMain.handle('get-invoices', () => {
    return new Promise((resolve, reject) => {
      db.all(`SELECT * FROM invoices`, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  });

  // SAVE PAYMENT
  ipcMain.handle('save-payment', (_, payment) => {
    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO payments (party_id, amount, method, reference)
         VALUES (?, ?, ?, ?)`,
        [payment.party_id, payment.amount, payment.method, payment.reference],
        function (err) {
          if (err) reject(err);
          else resolve(true);
        }
      );
    });
  });

  // BACKUP
  ipcMain.handle('backup-db', (_, dest) => {
    const dbPath = path.join(app.getPath('userData'), 'bookit.db');
    fs.copyFileSync(dbPath, dest);
    return true;
  });

  // RESTORE
  ipcMain.handle('restore-db', (_, src) => {
    const dbPath = path.join(app.getPath('userData'), 'bookit.db');
    fs.copyFileSync(src, dbPath);
    return true;
  });
}

// ================= WINDOW =================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });
}

// ================= APP =================
function initializeApp() {
  app.whenReady().then(() => {
    initDatabase();
    setupIPC();
    createWindow();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

initializeApp();