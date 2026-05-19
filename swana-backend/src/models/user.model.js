'use strict';

const { getDb } = require('../../config/db');

const SAFE_COLS = 'id, name, username, role, site, is_active, created_at';

function findByUsername(username) {
  return getDb()
    .prepare('SELECT * FROM users WHERE username = ? AND is_active = 1')
    .get(username);
}

function findById(id) {
  return getDb()
    .prepare(`SELECT ${SAFE_COLS} FROM users WHERE id = ?`)
    .get(id);
}

function listAll() {
  return getDb()
    .prepare(`SELECT ${SAFE_COLS} FROM users ORDER BY role, name`)
    .all();
}

function create({ name, username, pin_hash, role, site }) {
  const db  = getDb();
  const res = db.prepare(`
    INSERT INTO users (name, username, pin_hash, role, site)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, username, pin_hash, role, site || null);
  return findById(res.lastInsertRowid);
}

function updateActive(id, is_active) {
  getDb().prepare('UPDATE users SET is_active = ? WHERE id = ?').run(is_active ? 1 : 0, id);
  return findById(id);
}

module.exports = { findByUsername, findById, listAll, create, updateActive };
