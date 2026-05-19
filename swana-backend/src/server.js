'use strict';

require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const morgan      = require('morgan');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const path        = require('path');
const fs          = require('fs');

// Auto-migrate schema on startup
const { getDb } = require('../config/db');
const schemaSQL  = fs.readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
getDb().exec(schemaSQL);

// Idempotent column migrations — SQLite won't add columns via CREATE TABLE IF NOT EXISTS,
// so we check + ALTER. Safe to run on every startup.
(function migrateColumns() {
  const db    = getDb();
  const cols  = db.prepare(`PRAGMA table_info(transactions)`).all().map((c) => c.name);
  const adds  = [
    ['import_source', "ALTER TABLE transactions ADD COLUMN import_source TEXT"],
    ['import_batch',  "ALTER TABLE transactions ADD COLUMN import_batch TEXT"],
    ['source_hash',   "ALTER TABLE transactions ADD COLUMN source_hash TEXT"],
  ];
  for (const [name, sql] of adds) {
    if (!cols.includes(name)) {
      try { db.exec(sql); } catch (e) { console.warn(`Migration warning (${name}):`, e.message); }
    }
  }
})();

// Routes
const authRoutes     = require('./routes/auth.routes');
const txRoutes       = require('./routes/transaction.routes');
const reportRoutes   = require('./routes/report.routes');
const categoryRoutes = require('./routes/category.routes');
const importRoutes   = require('./routes/import.routes');

const app  = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// ─── CORS ─────────────────────────────────────────────────────────────────────
// In production set ALLOWED_ORIGINS=https://yourapp.vercel.app,https://yourapp.com
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  : ['http://localhost:8081', 'http://localhost:3000', 'http://localhost:19006'];

app.use(cors({
  origin: (origin, cb) => {
    // Allow mobile apps (no origin) and listed origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ─── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 min
  max: 20,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api/', rateLimit({
  windowMs: 60 * 1000,         // 1 min
  max: 200,
  message: { error: 'Rate limit exceeded.' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// ─── Body / Logging ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '15mb' }));
app.use(morgan(isProd ? 'combined' : 'dev'));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/transactions', txRoutes);
app.use('/api/reports',      reportRoutes);
app.use('/api/categories',   categoryRoutes);
app.use('/api/import',       importRoutes);

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', env: process.env.NODE_ENV, ts: new Date().toISOString() })
);

// ─── Error handlers ───────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));

app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({
    error:  isProd ? 'Internal server error' : err.message,
  });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  Swana Finance API  [${process.env.NODE_ENV || 'development'}]`);
  console.log(`    http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
