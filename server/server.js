/**
 * IQBook LAN Server
 *
 * Standalone Express + SQLite (better-sqlite3, WAL mode) backend that lets
 * multiple PCs on the same LAN share one centralized accounting database.
 *
 *   1. Install once on the main/server PC:   cd server && npm install
 *   2. Run:                                  npm start
 *   3. Note the LAN URL it prints, e.g.      http://192.168.1.50:4000
 *   4. In each client PC's app, open Settings → Network and paste that URL.
 *
 * Concurrency: each row carries a `version` integer. Updates require the
 * client's known version; a mismatch returns 409 Conflict with the latest
 * row, and the client can decide whether to merge or reload.
 */

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PORT = process.env.PORT || 4000;
const DATA_DIR = process.env.IQBOOK_DATA_DIR || path.join(os.homedir(), '.iqbook');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'iqbook-lan.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');         // concurrent readers + one writer
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// ---------- Schema ----------
// Generic key-value JSON store per collection, with version + updated_at.
// Keeps the server thin while the client holds the typed shape.
db.exec(`
  CREATE TABLE IF NOT EXISTS records (
    collection TEXT NOT NULL,
    id         TEXT NOT NULL,
    data       TEXT NOT NULL,
    version    INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL,
    deleted    INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (collection, id)
  );
  CREATE INDEX IF NOT EXISTS idx_records_updated ON records(collection, updated_at);

  CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    data       TEXT NOT NULL,
    version    INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS posting_idempotency (
    idempotency_key TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  );
`);

// Whitelist of collections the API will accept.
const COLLECTIONS = new Set([
  'clients', 'items', 'quotations', 'invoices', 'purchaseInvoices', 'salesmen',
  'payments', 'vouchers', 'journalEntries', 'accounts', 'companies',
  'audit',
]);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Tiny request log (helps debug from client PCs)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${req.ip}`);
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: DB_PATH, time: Date.now() });
});

// ---------- Records (collections) ----------

const stmtList = db.prepare(
  `SELECT id, data, version, updated_at FROM records WHERE collection = ? AND deleted = 0`
);
const stmtGet = db.prepare(
  `SELECT id, data, version, updated_at FROM records WHERE collection = ? AND id = ? AND deleted = 0`
);
const stmtInsert = db.prepare(
  `INSERT INTO records (collection, id, data, version, updated_at, deleted)
   VALUES (?, ?, ?, 1, ?, 0)`
);
const stmtUpdate = db.prepare(
  `UPDATE records SET data = ?, version = version + 1, updated_at = ?
   WHERE collection = ? AND id = ? AND version = ?`
);
const stmtUpsertForce = db.prepare(
  `INSERT INTO records (collection, id, data, version, updated_at, deleted)
   VALUES (?, ?, ?, 1, ?, 0)
   ON CONFLICT(collection, id) DO UPDATE SET
     data = excluded.data,
     version = records.version + 1,
     updated_at = excluded.updated_at,
     deleted = 0`
);
const stmtSoftDelete = db.prepare(
  `UPDATE records SET deleted = 1, version = version + 1, updated_at = ?
   WHERE collection = ? AND id = ?`
);
const stmtChangedSince = db.prepare(
  `SELECT id, data, version, updated_at, deleted FROM records
   WHERE collection = ? AND updated_at > ?`
);
const stmtJournalEntriesByRef = db.prepare(
  `SELECT id, data, version, updated_at FROM records
   WHERE collection = 'journalEntries'
     AND deleted = 0
     AND json_extract(data, '$.referenceType') = 'sales_invoice'
     AND json_extract(data, '$.referenceId') = ?`
);
const stmtDeleteJournalEntriesByRef = db.prepare(
  `UPDATE records
   SET deleted = 1, version = version + 1, updated_at = ?
   WHERE collection = 'journalEntries'
     AND deleted = 0
     AND json_extract(data, '$.referenceType') = 'sales_invoice'
     AND json_extract(data, '$.referenceId') = ?`
);
const stmtIdempotencySeen = db.prepare(
  `SELECT idempotency_key FROM posting_idempotency WHERE idempotency_key = ?`
);
const stmtIdempotencyInsert = db.prepare(
  `INSERT INTO posting_idempotency (idempotency_key, created_at) VALUES (?, ?)`
);

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function invoiceVatTotal(invoice) {
  const items = Array.isArray(invoice?.items) ? invoice.items : [];
  return items.reduce((sum, item) => sum + toNumber(item?.vatAmount), 0);
}

function buildSalesInvoicePostingEntry(invoice, version) {
  const nowIso = new Date().toISOString();
  const vatTotal = invoiceVatTotal(invoice);
  const invoiceTotal = toNumber(invoice?.netTotal);
  const revenue = Math.max(0, invoiceTotal - vatTotal);
  return {
    id: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: nowIso,
    reference: invoice.number,
    referenceType: 'sales_invoice',
    referenceId: invoice.id,
    description: `Sales Invoice ${invoice.number}`,
    lines: [
      { accountId: 'acc-1100', debit: invoiceTotal, credit: 0 },
      { accountId: 'acc-4000', debit: 0, credit: revenue },
      ...(vatTotal > 0 ? [{ accountId: 'acc-2000', debit: 0, credit: vatTotal }] : []),
    ],
    createdAt: nowIso,
    idempotencyKey: `sales_invoice:${invoice.id}:${version}`,
  };
}

function buildSalesInvoiceReversalEntry(invoice, previousEntry, version) {
  const nowIso = new Date().toISOString();
  return {
    id: `srv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: nowIso,
    reference: `${invoice.number}-REV`,
    referenceType: 'sales_invoice',
    referenceId: invoice.id,
    description: `Reversal before repost (${invoice.number})`,
    lines: (previousEntry.lines || []).map((line) => ({
      accountId: line.accountId,
      debit: toNumber(line.credit),
      credit: toNumber(line.debit),
      ...(line.description ? { description: line.description } : {}),
    })),
    createdAt: nowIso,
    idempotencyKey: `sales_invoice:${invoice.id}:${version}:reversal:${previousEntry.id}`,
    reversalOf: previousEntry.id,
  };
}

const applySalesInvoiceRepost = db.transaction((invoice, version) => {
  const idempotencyKey = `sales_invoice:${invoice.id}:${version}`;
  if (stmtIdempotencySeen.get(idempotencyKey)) {
    return { skipped: true, idempotencyKey };
  }

  const existingEntries = stmtJournalEntriesByRef
    .all(invoice.id)
    .map((row) => JSON.parse(row.data));

  const now = Date.now();
  if (existingEntries.length > 0) {
    const reversalEntries = existingEntries.map((entry) =>
      buildSalesInvoiceReversalEntry(invoice, entry, version)
    );

    stmtDeleteJournalEntriesByRef.run(now, invoice.id);
    for (const reversal of reversalEntries) {
      stmtUpsertForce.run('journalEntries', reversal.id, JSON.stringify(reversal), now);
    }
  }

  const freshPosting = buildSalesInvoicePostingEntry(invoice, version);
  stmtUpsertForce.run('journalEntries', freshPosting.id, JSON.stringify(freshPosting), now);
  stmtIdempotencyInsert.run(idempotencyKey, now);
  return { skipped: false, idempotencyKey };
});

function checkCollection(req, res) {
  if (!COLLECTIONS.has(req.params.collection)) {
    res.status(400).json({ error: `Unknown collection: ${req.params.collection}` });
    return false;
  }
  return true;
}

// For future server-generated PDF endpoints, call this helper before sending the PDF buffer/stream.
function setPdfAttachmentHeaders(res, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
}

app.get('/api/records/:collection', (req, res) => {
  if (!checkCollection(req, res)) return;
  const rows = stmtList.all(req.params.collection);
  res.json(rows.map(r => ({ ...JSON.parse(r.data), _version: r.version, _updatedAt: r.updated_at })));
});

app.get('/api/records/:collection/changes', (req, res) => {
  if (!checkCollection(req, res)) return;
  const since = Number(req.query.since) || 0;
  const rows = stmtChangedSince.all(req.params.collection, since);
  res.json({
    serverTime: Date.now(),
    changes: rows.map(r => ({
      id: r.id,
      data: r.deleted ? null : JSON.parse(r.data),
      version: r.version,
      updatedAt: r.updated_at,
      deleted: !!r.deleted,
    })),
  });
});

app.post('/api/records/:collection', (req, res) => {
  if (!checkCollection(req, res)) return;
  const obj = req.body;
  if (!obj || !obj.id) return res.status(400).json({ error: 'Missing id' });
  const now = Date.now();
  try {
    stmtUpsertForce.run(req.params.collection, obj.id, JSON.stringify(obj), now);
    if (req.params.collection === 'invoices') {
      const version = Number(obj._version) || 1;
      applySalesInvoiceRepost(obj, version);
    }
    const row = stmtGet.get(req.params.collection, obj.id);
    res.json({ ...obj, _version: row.version, _updatedAt: row.updated_at });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.put('/api/records/:collection/:id', (req, res) => {
  if (!checkCollection(req, res)) return;
  const { collection, id } = req.params;
  const obj = req.body;
  const expected = Number(obj._version) || 0;
  const existing = stmtGet.get(collection, id);
  const now = Date.now();
  if (!existing) {
    stmtInsert.run(collection, id, JSON.stringify(obj), now);
    const row = stmtGet.get(collection, id);
    return res.json({ ...obj, _version: row.version, _updatedAt: row.updated_at });
  }
  if (expected && expected !== existing.version) {
    return res.status(409).json({
      error: 'Version conflict',
      latest: { ...JSON.parse(existing.data), _version: existing.version, _updatedAt: existing.updated_at },
    });
  }
  const result = stmtUpdate.run(JSON.stringify(obj), now, collection, id, existing.version);
  if (result.changes === 0) {
    const row = stmtGet.get(collection, id);
    return res.status(409).json({
      error: 'Version conflict',
      latest: { ...JSON.parse(row.data), _version: row.version, _updatedAt: row.updated_at },
    });
  }
  if (collection === 'invoices') {
    const version = existing.version + 1;
    applySalesInvoiceRepost(obj, version);
  }
  const row = stmtGet.get(collection, id);
  res.json({ ...obj, _version: row.version, _updatedAt: row.updated_at });
});

app.delete('/api/records/:collection/:id', (req, res) => {
  if (!checkCollection(req, res)) return;
  stmtSoftDelete.run(Date.now(), req.params.collection, req.params.id);
  res.json({ ok: true });
});

// ---------- Settings (single document keys) ----------
app.get('/api/settings/:key', (req, res) => {
  const row = db.prepare(`SELECT data, version, updated_at FROM settings WHERE key = ?`).get(req.params.key);
  if (!row) return res.json(null);
  res.json({ ...JSON.parse(row.data), _version: row.version, _updatedAt: row.updated_at });
});

app.put('/api/settings/:key', (req, res) => {
  const now = Date.now();
  db.prepare(`
    INSERT INTO settings (key, data, version, updated_at) VALUES (?, ?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET data = excluded.data, version = settings.version + 1, updated_at = excluded.updated_at
  `).run(req.params.key, JSON.stringify(req.body), now);
  res.json({ ok: true, updatedAt: now });
});

// ---------- Start ----------
function lanAddresses() {
  const out = [];
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const it of ifs[name]) {
      if (it.family === 'IPv4' && !it.internal) out.push(it.address);
    }
  }
  return out;
}

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n========================================');
  console.log('  IQBook LAN Server is running');
  console.log('========================================');
  console.log(`  Database:  ${DB_PATH}`);
  console.log(`  Local:     http://localhost:${PORT}`);
  for (const ip of lanAddresses()) {
    console.log(`  LAN:       http://${ip}:${PORT}`);
  }
  console.log('========================================');
  console.log('  Open Settings → Network on each client PC');
  console.log('  and paste one of the LAN URLs above.');
  console.log('========================================\n');
});
