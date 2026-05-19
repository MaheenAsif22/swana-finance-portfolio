PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ─── USERS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT    NOT NULL,
  username   TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  pin_hash   TEXT    NOT NULL,
  role       TEXT    NOT NULL CHECK (role IN ('owner','cashier')),
  site       TEXT,
  is_active  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ─── CATEGORIES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE,
  icon  TEXT NOT NULL DEFAULT 'tag',
  color TEXT NOT NULL DEFAULT '#888888'
);

-- ─── ACCOUNTS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL UNIQUE,
  type            TEXT NOT NULL CHECK (type IN ('cash','bank','cheque')),
  opening_balance REAL NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── DAILY OPENING BALANCE ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_balance (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  date       TEXT    NOT NULL,
  amount     REAL    NOT NULL CHECK (amount >= 0),
  posted_by  INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (account_id, date)
);

-- ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  type           TEXT NOT NULL CHECK (type IN (
                   'payment','request','receipt','cheque_out','transfer'
                 )),
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                   'pending','approved','rejected','paid'
                 )),
  amount         REAL NOT NULL CHECK (amount > 0),
  description    TEXT NOT NULL,
  payee          TEXT,
  payment_method TEXT CHECK (payment_method IN (
                   'cash','cheque','online','easypay','other'
                 )),
  category_id    INTEGER REFERENCES categories(id),
  account_id     INTEGER NOT NULL DEFAULT 1 REFERENCES accounts(id),
  ref_number     TEXT,
  date           TEXT NOT NULL DEFAULT (date('now')),
  notes          TEXT,
  receipt_image  TEXT,
  created_by     INTEGER NOT NULL REFERENCES users(id),
  approved_by    INTEGER REFERENCES users(id),
  approved_at    TEXT,
  rejected_by    INTEGER REFERENCES users(id),
  rejected_at    TEXT,
  reject_reason  TEXT,
  -- WhatsApp-import provenance
  import_source  TEXT,                          -- e.g. 'whatsapp:2025-04.txt'
  import_batch   TEXT,                          -- UUID grouping all rows of one import job
  source_hash    TEXT,                          -- hash of original message body, for dedup
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── IMPORT JOBS ──────────────────────────────────────────────────────────────
-- One row per WhatsApp import upload. Lets the owner see history of imports.
CREATE TABLE IF NOT EXISTS import_jobs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id        TEXT    NOT NULL UNIQUE,
  source_file     TEXT,                              -- original filename
  started_by      INTEGER NOT NULL REFERENCES users(id),
  total_messages  INTEGER NOT NULL DEFAULT 0,
  transactions    INTEGER NOT NULL DEFAULT 0,
  duplicates      INTEGER NOT NULL DEFAULT 0,
  committed_count INTEGER NOT NULL DEFAULT 0,
  status          TEXT    NOT NULL DEFAULT 'preview' CHECK (status IN (
                    'preview','committed','cancelled'
                  )),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  committed_at    TEXT
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tx_date         ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_tx_status       ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_tx_type         ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_tx_created_by   ON transactions(created_by);
CREATE INDEX IF NOT EXISTS idx_tx_import_batch ON transactions(import_batch);
CREATE INDEX IF NOT EXISTS idx_tx_source_hash  ON transactions(source_hash);
CREATE INDEX IF NOT EXISTS idx_daily_date      ON daily_balance(date);
