'use strict';

const { getDb } = require('../../config/db');

const TX_JOIN = `
  SELECT
    t.*,
    c.name  AS category_name,
    c.icon  AS category_icon,
    c.color AS category_color,
    u.name  AS created_by_name,
    a.name  AS approved_by_name,
    r.name  AS rejected_by_name
  FROM transactions t
  LEFT JOIN categories c ON c.id = t.category_id
  LEFT JOIN users u ON u.id = t.created_by
  LEFT JOIN users a ON a.id = t.approved_by
  LEFT JOIN users r ON r.id = t.rejected_by
`;

function findById(id) {
  return getDb().prepare(`${TX_JOIN} WHERE t.id = ?`).get(id);
}

function list({ date, status, type, page = 1, limit = 50 } = {}) {
  const db     = getDb();
  const where  = [];
  const params = [];

  if (date)   { where.push('t.date = ?');   params.push(date); }
  if (status) { where.push('t.status = ?'); params.push(status); }
  if (type)   { where.push('t.type = ?');   params.push(type); }

  const clause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset = (Number(page) - 1) * Number(limit);

  const rows  = db.prepare(`${TX_JOIN} ${clause} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), offset);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM transactions t ${clause}`).get(...params).n;

  return { data: rows, total, page: Number(page), limit: Number(limit) };
}

function listPending() {
  return getDb().prepare(`${TX_JOIN} WHERE t.status = 'pending' ORDER BY t.created_at ASC`).all();
}

function create({ type, amount, description, payee, payment_method, category_id, account_id = 1, ref_number, date, notes, receipt_image, created_by, approved_by = null }) {
  const db = getDb();

  const status    = (type === 'payment' || type === 'receipt' || type === 'cheque_out') ? 'paid' : 'pending';
  const apprBy    = (status === 'paid' && approved_by) ? approved_by : null;
  const apprAt    = apprBy ? new Date().toISOString() : null;

  const res = db.prepare(`
    INSERT INTO transactions
      (type, status, amount, description, payee, payment_method,
       category_id, account_id, ref_number, date, notes, receipt_image,
       created_by, approved_by, approved_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    type, status, Number(amount), description,
    payee || null, payment_method || null, category_id || null,
    account_id, ref_number || null,
    date || new Date().toISOString().split('T')[0],
    notes || null, receipt_image || null,
    created_by, apprBy, apprAt
  );

  return findById(res.lastInsertRowid);
}

function approve(id, approved_by) {
  getDb().prepare(`
    UPDATE transactions
    SET status = 'approved', approved_by = ?, approved_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(approved_by, id);
  return findById(id);
}

function reject(id, rejected_by, reason = null) {
  getDb().prepare(`
    UPDATE transactions
    SET status = 'rejected', rejected_by = ?, rejected_at = datetime('now'),
        reject_reason = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(rejected_by, reason, id);
  return findById(id);
}

module.exports = { findById, list, listPending, create, approve, reject };
