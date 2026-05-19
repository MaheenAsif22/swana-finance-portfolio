'use strict';

const { getDb } = require('../../config/db');

function listAll() {
  return getDb().prepare('SELECT * FROM categories ORDER BY name').all();
}

function listPayees() {
  return getDb().prepare(`
    SELECT DISTINCT payee AS name
    FROM transactions
    WHERE payee IS NOT NULL AND payee != ''
    ORDER BY payee
  `).all();
}

function listAccounts() {
  return getDb().prepare('SELECT * FROM accounts ORDER BY id').all();
}

module.exports = { listAll, listPayees, listAccounts };
