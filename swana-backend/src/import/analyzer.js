'use strict';

/**
 * One-time analyzer — reads a historical WhatsApp chat .txt,
 * extracts every transaction-shaped message, and writes three
 * knowledge files used by the production importer:
 *
 *   - knowledge/payees.json       : canonical payee clusters with aliases
 *   - knowledge/categories.json   : keyword → category mapping
 *   - knowledge/stats.json        : training run summary
 *
 * Usage:
 *   node src/import/analyzer.js path/to/chat.txt
 *
 * The output files are committed to source control so the importer
 * has them available out of the box. They can be edited by hand,
 * regenerated periodically, or updated incrementally as the owner
 * corrects mistakes during real imports (see import.routes.js).
 */

const fs   = require('fs');
const path = require('path');

const { parseChat, classifyMessage } = require('./parser');
const { clusterNames }               = require('./name-cluster');
const { learnCategories }            = require('./category-learn');

const KNOWLEDGE_DIR = path.join(__dirname, '../../knowledge');

function ensureKnowledgeDir() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
}

function analyze(chatPath) {
  const startTime = Date.now();
  console.log(`\n📚  Analyzing chat: ${chatPath}\n`);

  const text     = fs.readFileSync(chatPath, 'utf8');
  const messages = parseChat(text);
  console.log(`   Parsed ${messages.length} messages from the chat`);

  // ─── Classify every message ────────────────────────────────────────────────
  const buckets = {
    system:          0,
    ack:             0,
    no_amount:       0,
    unparseable:     0,
    opening_balance: [],
    transaction:     [],
  };

  for (const msg of messages) {
    const c = classifyMessage(msg);
    switch (c.kind) {
      case 'system':          buckets.system++; break;
      case 'ack':             buckets.ack++; break;
      case 'no-amount':       buckets.no_amount++; break;
      case 'unparseable':     buckets.unparseable++; break;
      case 'opening_balance': buckets.opening_balance.push(c); break;
      case 'transaction':     buckets.transaction.push(c); break;
    }
  }

  console.log(`   ├─ ${buckets.transaction.length} transaction-shaped messages`);
  console.log(`   ├─ ${buckets.opening_balance.length} opening-balance messages`);
  console.log(`   ├─ ${buckets.ack} acknowledgement replies (skipped)`);
  console.log(`   ├─ ${buckets.no_amount} messages with no Rs amount (skipped)`);
  console.log(`   └─ ${buckets.system} system / deleted messages (skipped)`);

  // ─── Build payee clusters ──────────────────────────────────────────────────
  const payeeCounts = {};
  let withPayee = 0;
  for (const tx of buckets.transaction) {
    if (!tx.payee) continue;
    withPayee++;
    payeeCounts[tx.payee] = (payeeCounts[tx.payee] || 0) + 1;
  }
  console.log(`\n   Found ${withPayee} transactions with extractable payees`);
  console.log(`   Found ${Object.keys(payeeCounts).length} unique raw payee strings`);

  const clusters = clusterNames(payeeCounts);
  console.log(`   Clustered into ${clusters.length} canonical payees`);

  const reduction = (
    (1 - clusters.length / Object.keys(payeeCounts).length) * 100
  ).toFixed(1);
  console.log(`   Name-spelling consolidation: ${reduction}%`);

  // ─── Learn categories ──────────────────────────────────────────────────────
  console.log(`\n   Learning category keywords from ${buckets.transaction.length} messages...`);
  const { dict, stats: catStats } = learnCategories(buckets.transaction);
  const totalKeywords = Object.values(dict).reduce((s, ks) => s + ks.length, 0);
  console.log(`   Built dictionary: ${Object.keys(dict).length} categories, ${totalKeywords} keywords total`);
  console.log(`   Seed-matched transactions during training: ${catStats.matched} / ${catStats.total}`);

  // ─── Write knowledge files ─────────────────────────────────────────────────
  ensureKnowledgeDir();

  const payeesPath     = path.join(KNOWLEDGE_DIR, 'payees.json');
  const categoriesPath = path.join(KNOWLEDGE_DIR, 'categories.json');
  const statsPath      = path.join(KNOWLEDGE_DIR, 'stats.json');

  fs.writeFileSync(payeesPath,     JSON.stringify(clusters, null, 2));
  fs.writeFileSync(categoriesPath, JSON.stringify(dict, null, 2));
  fs.writeFileSync(statsPath, JSON.stringify({
    generated_at:        new Date().toISOString(),
    source_chat:         path.basename(chatPath),
    total_messages:      messages.length,
    transactions:        buckets.transaction.length,
    opening_balances:    buckets.opening_balance.length,
    acks_skipped:        buckets.ack,
    no_amount_skipped:   buckets.no_amount,
    system_skipped:      buckets.system,
    payees_unique_raw:   Object.keys(payeeCounts).length,
    payees_clustered:    clusters.length,
    categories:          Object.keys(dict).length,
    keywords_total:      totalKeywords,
    category_match_rate: (catStats.matched / catStats.total),
    runtime_ms:          Date.now() - startTime,
  }, null, 2));

  console.log(`\n   ✓ Wrote ${path.relative(process.cwd(), payeesPath)}`);
  console.log(`   ✓ Wrote ${path.relative(process.cwd(), categoriesPath)}`);
  console.log(`   ✓ Wrote ${path.relative(process.cwd(), statsPath)}`);

  console.log(`\n📚  Done in ${((Date.now() - startTime) / 1000).toFixed(2)}s\n`);

  return { clusters, dict, buckets };
}

// CLI entry point
if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node src/import/analyzer.js <path-to-chat.txt>');
    process.exit(1);
  }
  if (!fs.existsSync(arg)) {
    console.error(`File not found: ${arg}`);
    process.exit(1);
  }
  analyze(arg);
}

module.exports = { analyze };
