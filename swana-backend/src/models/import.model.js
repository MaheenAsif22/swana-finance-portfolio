'use strict';

/**
 * Import model — orchestrates the parse → resolve → dedup → preview → commit flow
 * for WhatsApp chat imports. Owner-only feature.
 */

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const { getDb }                 = require('../../config/db');
const { parseChat, classifyMessage } = require('../import/parser');
const { resolveTransaction, buildAliasIndex } = require('../import/resolver');

const KNOWLEDGE_DIR = path.join(__dirname, '../../knowledge');

// ─── Knowledge file loaders (lazy + memoized) ────────────────────────────────
let _knowledge = null;
function loadKnowledge() {
  if (_knowledge) return _knowledge;
  const payeesPath     = path.join(KNOWLEDGE_DIR, 'payees.json');
  const categoriesPath = path.join(KNOWLEDGE_DIR, 'categories.json');
  if (!fs.existsSync(payeesPath) || !fs.existsSync(categoriesPath)) {
    throw new Error('Knowledge files missing. Run: node src/import/analyzer.js path/to/historical-chat.txt');
  }
  const payees     = JSON.parse(fs.readFileSync(payeesPath,     'utf8'));
  const categories = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));
  _knowledge = { payees, categories, aliasIdx: buildAliasIndex(payees) };
  return _knowledge;
}
function invalidateKnowledge() { _knowledge = null; }

// ─── Hash a message body for dedup ──────────────────────────────────────────
function bodyHash(date, body) {
  const norm = (body || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return crypto.createHash('sha1').update(`${date}|${norm}`).digest('hex').slice(0, 16);
}

// ─── Map category name → id (using the categories table, not knowledge) ──────
function getCategoryIdMap() {
  const rows = getDb().prepare(`SELECT id, name FROM categories`).all();
  const m    = new Map();
  for (const r of rows) m.set(r.name.toLowerCase(), r.id);
  return m;
}

// ─── Build a preview from a raw chat text ────────────────────────────────────
function buildPreview(chatText, sourceFile = null) {
  const knowledge = loadKnowledge();
  const messages  = parseChat(chatText);
  const catMap    = getCategoryIdMap();

  const transactions     = [];
  const openingBalances  = [];
  let   skipped          = 0;

  for (const m of messages) {
    const c = classifyMessage(m);
    if (c.kind === 'opening_balance') {
      openingBalances.push({
        date:   c.date,
        time:   c.time,
        sender: c.sender,
        amount: c.amount,
        body:   c.body,
        hash:   bodyHash(c.date, c.body),
      });
    } else if (c.kind === 'transaction') {
      const r = resolveTransaction(c, knowledge);
      transactions.push({
        ...r,
        hash:        bodyHash(r.date, r.description),
        categoryId:  r.category ? (catMap.get(r.category.toLowerCase()) || null) : null,
      });
    } else {
      skipped++;
    }
  }

  // Dedup: check the DB for any source_hash that already exists
  const db          = getDb();
  const stmt        = db.prepare(`SELECT 1 FROM transactions WHERE source_hash = ? LIMIT 1`);
  let alreadyInDb   = 0;
  for (const t of transactions) {
    if (stmt.get(t.hash)) { t.duplicate = true; alreadyInDb++; }
  }

  // Dedup within this batch: cashier request + owner approval often look identical
  const seenInBatch = new Set();
  let withinBatchDupes = 0;
  for (const t of transactions) {
    if (t.duplicate) continue;
    if (seenInBatch.has(t.hash)) { t.duplicate = true; withinBatchDupes++; }
    else seenInBatch.add(t.hash);
  }

  // Summary stats
  const stats = {
    totalMessages:     messages.length,
    transactions:      transactions.length,
    needsReview:       transactions.filter((t) => t.needsReview && !t.duplicate).length,
    duplicatesInDb:    alreadyInDb,
    duplicatesInBatch: withinBatchDupes,
    openingBalances:   openingBalances.length,
    skipped,
  };

  return { stats, transactions, openingBalances, sourceFile };
}

// ─── Commit a reviewed preview into the database ─────────────────────────────
// `rows` = the transactions array the owner reviewed (with possibly edited fields).
// Each row needs: type, amount, description, payee, category, paymentMethod, date, hash.
function commit({ rows, openingBalances = [], sourceFile, batchId, userId }) {
  const db        = getDb();
  const catMap    = getCategoryIdMap();
  const importLbl = `whatsapp:${sourceFile || 'unknown'}`;

  // Insert the import_jobs row first
  const jobInsert = db.prepare(`
    INSERT INTO import_jobs (batch_id, source_file, started_by, total_messages, transactions, duplicates, committed_count, status)
    VALUES (?, ?, ?, ?, ?, ?, 0, 'preview')
  `);
  const jobRow = jobInsert.run(batchId, sourceFile, userId, rows.length, rows.length, 0);

  // Insert all rows in a transaction for atomicity
  const txInsert = db.prepare(`
    INSERT INTO transactions
      (type, status, amount, description, payee, payment_method,
       category_id, account_id, date, notes,
       created_by, approved_by, approved_at,
       import_source, import_batch, source_hash)
    VALUES (?, 'approved', ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, datetime('now'), ?, ?, ?)
  `);
  const balInsert = db.prepare(`
    INSERT OR IGNORE INTO daily_balance (account_id, date, amount, posted_by)
    VALUES (1, ?, ?, ?)
  `);

  let inserted = 0, skipped = 0, balancesInserted = 0;
  const runAll = db.transaction(() => {
    for (const r of rows) {
      if (r.skip || r.duplicate) { skipped++; continue; }
      // Resolve category id from name (may have been edited)
      const catId = r.category ? (catMap.get(String(r.category).toLowerCase()) || null) : null;

      try {
        txInsert.run(
          r.type,
          Number(r.amount),
          r.description || r.body || '(imported)',
          r.payee || null,
          r.paymentMethod || null,
          catId,
          r.date,
          `Imported from WhatsApp on ${new Date().toISOString().split('T')[0]}`,
          userId,
          userId,
          importLbl,
          batchId,
          r.hash,
        );
        inserted++;
      } catch (e) {
        // Likely a CHECK constraint failure on type/amount; skip and continue
        skipped++;
      }
    }
    for (const b of openingBalances) {
      if (b.skip) continue;
      const res = balInsert.run(b.date, b.amount, userId);
      if (res.changes > 0) balancesInserted++;
    }
    // Mark job as committed
    db.prepare(`
      UPDATE import_jobs
      SET status = 'committed', committed_count = ?, duplicates = ?, committed_at = datetime('now')
      WHERE batch_id = ?
    `).run(inserted, skipped, batchId);
  });

  runAll();

  return { inserted, skipped, balancesInserted, batchId };
}

// ─── List recent import jobs ─────────────────────────────────────────────────
function listJobs(limit = 20) {
  return getDb().prepare(`
    SELECT j.*, u.name AS started_by_name
    FROM import_jobs j
    LEFT JOIN users u ON u.id = j.started_by
    ORDER BY j.created_at DESC
    LIMIT ?
  `).all(Number(limit));
}

// ─── Knowledge file accessors (for the editor screen) ────────────────────────
function getKnowledge() {
  return loadKnowledge();
}

function savePayees(payees) {
  const p = path.join(KNOWLEDGE_DIR, 'payees.json');
  fs.writeFileSync(p, JSON.stringify(payees, null, 2));
  invalidateKnowledge();
}

function saveCategories(categories) {
  const p = path.join(KNOWLEDGE_DIR, 'categories.json');
  fs.writeFileSync(p, JSON.stringify(categories, null, 2));
  invalidateKnowledge();
}

module.exports = {
  buildPreview,
  commit,
  listJobs,
  getKnowledge,
  savePayees,
  saveCategories,
  invalidateKnowledge,
};
