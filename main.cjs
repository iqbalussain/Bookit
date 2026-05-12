const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, dialog, shell, ipcMain } = require('electron');
const sqlite3 = require('sqlite3').verbose();

let mainWindow = null;
let db = null;

const dbFileName = 'Bookit.db';

function getDbPath() {
  return path.join(app.getPath('userData'), dbFileName);
}

function getLogsPath() {
  return path.join(app.getPath('userData'), 'logs');
}

function logError(source, error, extra = {}) {
  try {
    fs.mkdirSync(getLogsPath(), { recursive: true });
    const payload = {
      time: new Date().toISOString(),
      source,
      message: error?.message || String(error),
      stack: error?.stack,
      ...extra,
    };
    fs.appendFileSync(path.join(getLogsPath(), 'main.log'), `${JSON.stringify(payload)}\n`, 'utf8');
  } catch {
    // Logging must never block app startup.
  }
}

function readLogLines() {
  const logFile = path.join(getLogsPath(), 'main.log');
  if (!fs.existsSync(logFile)) return [];
  const text = fs.readFileSync(logFile, 'utf8').trim();
  return text ? text.split(/\r?\n/) : [];
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDatabase() {
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new sqlite3.Database(dbPath);

  await run('PRAGMA journal_mode = WAL');
  await run('PRAGMA foreign_keys = ON');

  await run(`CREATE TABLE IF NOT EXISTS parties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS quotations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    number TEXT,
    client_id TEXT,
    salesman_id TEXT,
    status TEXT,
    net_total REAL,
    data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
  )`);

  await run(`CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    party_id TEXT,
    invoice_no TEXT,
    total REAL,
    status TEXT,
    data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS purchase_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id TEXT,
    invoice_no TEXT,
    total REAL,
    status TEXT,
    data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    party_id TEXT,
    invoice_id TEXT,
    amount REAL,
    method TEXT,
    reference TEXT,
    data TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT,
    type TEXT,
    kind TEXT,
    parent_id TEXT,
    is_system INTEGER DEFAULT 0,
    data TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  await run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
}

function safeHandle(channel, handler) {
  ipcMain.removeHandler(channel);
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      logError(`ipc:${channel}`, error);
      throw error;
    }
  });
}

function mapStoredJson(row) {
  if (row?.data) {
    try {
      return JSON.parse(row.data);
    } catch {
      return row;
    }
  }
  return row;
}

function setupIPC() {
  safeHandle('db-query', async (_event, sql, params = []) => {
    const text = String(sql || '').trim();
    if (!/^select\b/i.test(text)) {
      throw new Error('Only SELECT queries are allowed from the renderer.');
    }
    return all(text, Array.isArray(params) ? params : []);
  });

  safeHandle('get-parties', () => all('SELECT * FROM parties ORDER BY name COLLATE NOCASE'));

  safeHandle('get-quotations', async () => {
    const rows = await all('SELECT * FROM quotations ORDER BY created_at DESC');
    return rows.map((r) => mapStoredJson({
      id: String(r.id),
      number: r.number,
      clientId: r.client_id,
      salesmanId: r.salesman_id,
      status: r.status,
      netTotal: r.net_total,
      createdAt: r.created_at,
      updatedAt: r.updated_at || r.created_at,
      data: r.data,
    }));
  });

  safeHandle('save-quotation', (_event, q) =>
    run(
      `INSERT INTO quotations (number, client_id, salesman_id, status, net_total, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [q.number, q.clientId, q.salesmanId, q.status, Number(q.netTotal) || 0, JSON.stringify(q)]
    )
  );

  safeHandle('get-invoices', async () => {
    const rows = await all('SELECT * FROM invoices ORDER BY created_at DESC');
    return rows.map(mapStoredJson);
  });

  safeHandle('save-invoice', (_event, invoice) =>
    run(
      `INSERT INTO invoices (party_id, invoice_no, total, status, data)
       VALUES (?, ?, ?, ?, ?)`,
      [
        invoice.party_id || invoice.clientId,
        invoice.invoice_no || invoice.number,
        Number(invoice.total ?? invoice.netTotal) || 0,
        invoice.status || 'unpaid',
        JSON.stringify(invoice),
      ]
    )
  );

  safeHandle('get-purchase-invoices', async () => {
    const rows = await all('SELECT * FROM purchase_invoices ORDER BY created_at DESC');
    return rows.map(mapStoredJson);
  });

  safeHandle('save-purchase-invoice', (_event, invoice) =>
    run(
      `INSERT INTO purchase_invoices (vendor_id, invoice_no, total, status, data)
       VALUES (?, ?, ?, ?, ?)`,
      [
        invoice.vendor_id || invoice.vendorId,
        invoice.invoice_no || invoice.number,
        Number(invoice.total ?? invoice.netTotal) || 0,
        invoice.status || 'unpaid',
        JSON.stringify(invoice),
      ]
    )
  );

  safeHandle('get-payments', async () => {
    const rows = await all('SELECT * FROM payments ORDER BY created_at DESC');
    return rows.map(mapStoredJson);
  });

  safeHandle('save-payment', (_event, payment) =>
    run(
      `INSERT INTO payments (party_id, invoice_id, amount, method, reference, data)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        payment.party_id || payment.partyId,
        payment.invoice_id || payment.invoiceId,
        Number(payment.amount) || 0,
        payment.method,
        payment.reference,
        JSON.stringify(payment),
      ]
    )
  );

  safeHandle('get-accounts', async () => {
    const rows = await all('SELECT * FROM accounts ORDER BY code');
    return rows.map((r) => mapStoredJson({
      id: r.id,
      code: r.code,
      name: r.name,
      type: r.type,
      kind: r.kind,
      parentId: r.parent_id,
      isSystem: !!r.is_system,
      data: r.data,
    }));
  });

  safeHandle('save-account', (_event, account) =>
    run(
      `INSERT INTO accounts (id, code, name, type, kind, parent_id, is_system, data, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         code=excluded.code,
         name=excluded.name,
         type=excluded.type,
         kind=excluded.kind,
         parent_id=excluded.parent_id,
         is_system=excluded.is_system,
         data=excluded.data,
         updated_at=datetime('now')`,
      [
        account.id,
        account.code,
        account.name,
        account.type,
        account.kind,
        account.parentId,
        account.isSystem ? 1 : 0,
        JSON.stringify(account),
      ]
    )
  );

  safeHandle('get-business-settings', async () => {
    const rows = await all('SELECT value FROM settings WHERE key = ?', ['business']);
    if (!rows[0]?.value) return { currency: 'INR' };
    return JSON.parse(rows[0].value);
  });

  safeHandle('save-business-settings', (_event, settings) =>
    run(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ('business', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`,
      [JSON.stringify(settings)]
    )
  );

  safeHandle('get-db-path', () => getDbPath());

  safeHandle('open-db-folder', () => {
    shell.showItemInFolder(getDbPath());
    return true;
  });

  safeHandle('backup-db', async (_event, destinationPath) => {
    let filePath = destinationPath;
    if (!filePath) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Backup Database',
        defaultPath: `Bookit-backup-${new Date().toISOString().slice(0, 10)}.db`,
        filters: [{ name: 'Database', extensions: ['db'] }],
      });
      if (result.canceled) return false;
      filePath = result.filePath;
    }
    fs.copyFileSync(getDbPath(), filePath);
    return true;
  });

  safeHandle('restore-db', async (_event, sourcePath) => {
    let filePath = sourcePath;
    if (!filePath) {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Restore Database',
        filters: [{ name: 'Database', extensions: ['db'] }],
        properties: ['openFile'],
      });
      if (result.canceled || !result.filePaths.length) return false;
      filePath = result.filePaths[0];
    }
    fs.copyFileSync(filePath, getDbPath());
    return true;
  });

  safeHandle('show-save-dialog', (_event, options) => dialog.showSaveDialog(mainWindow, options));
  safeHandle('show-open-dialog', (_event, options) => dialog.showOpenDialog(mainWindow, options));

  safeHandle('renderer-error-log', (_event, payload) => {
    logError('renderer', new Error(payload?.message || 'Renderer error'), payload || {});
    return true;
  });

  safeHandle('get-diagnostic-info', () => {
    const logs = readLogLines();
    const errors = logs.filter((line) => line.toLowerCase().includes('error')).length;
    return {
      uptime: `${Math.round(process.uptime())}s`,
      totalLogs: logs.length,
      warnings: 0,
      errors,
      dbPath: getDbPath(),
    };
  });

  safeHandle('get-diagnostic-logs', () => readLogLines());

  safeHandle('open-logs-folder', () => {
    fs.mkdirSync(getLogsPath(), { recursive: true });
    shell.openPath(getLogsPath());
    return { success: true, path: getLogsPath() };
  });

  safeHandle('export-diagnostics', async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export Diagnostics',
      defaultPath: `Bookit-diagnostics-${new Date().toISOString().slice(0, 10)}.log`,
      filters: [{ name: 'Log Files', extensions: ['log', 'txt'] }],
    });
    if (result.canceled) return { success: false, canceled: true };
    const logs = readLogLines();
    fs.writeFileSync(result.filePath, logs.join('\n'), 'utf8');
    return { success: true, path: result.filePath };
  });

  safeHandle('update-get-version', () => app.getVersion());
  safeHandle('update-check-for-updates', async () => {
    if (!app.isPackaged) return { updateInfo: null };
    const { autoUpdater } = require('electron-updater');
    return autoUpdater.checkForUpdates();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logError('render-process-gone', new Error(details.reason), details);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logError('did-fail-load', new Error(errorDescription), { errorCode, validatedURL });
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    try {
      await initDatabase();
      setupIPC();
      createWindow();
    } catch (error) {
      logError('startup', error);
      dialog.showErrorBox('Bookit startup failed', error?.message || String(error));
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  app.on('before-quit', () => {
    if (db) db.close();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
