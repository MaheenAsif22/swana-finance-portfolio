'use strict';

const { getDb } = require('../../config/db');

function dailyReport(date) {
  const db = getDb();

  const opening = db.prepare(
    `SELECT amount FROM daily_balance WHERE date = ? ORDER BY id DESC LIMIT 1`
  ).get(date);

  const agg = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'receipt' AND status IN ('paid','approved') THEN amount ELSE 0 END), 0) AS total_in,
      COALESCE(SUM(CASE WHEN type IN ('payment','cheque_out') AND status IN ('paid','approved') THEN amount ELSE 0 END), 0) AS total_out,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) AS pending_total,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending_count
    FROM transactions WHERE date = ?
  `).get(date);

  const transactions = db.prepare(`
    SELECT t.*, c.name AS category_name, c.color AS category_color, u.name AS created_by_name
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    LEFT JOIN users u ON u.id = t.created_by
    WHERE t.date = ?
    ORDER BY t.created_at DESC
  `).all(date);

  const openingAmt = opening?.amount ?? 0;
  return {
    date,
    opening_balance:  openingAmt,
    total_received:   agg.total_in,
    total_paid:       agg.total_out,
    closing_balance:  openingAmt + agg.total_in - agg.total_out,
    pending_count:    agg.pending_count,
    pending_total:    agg.pending_total,
    transactions,
  };
}

function summaryReport(from, to) {
  const db = getDb();

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type='receipt' AND status IN ('paid','approved') THEN amount ELSE 0 END),0) AS total_in,
      COALESCE(SUM(CASE WHEN type IN ('payment','cheque_out') AND status IN ('paid','approved') THEN amount ELSE 0 END),0) AS total_out,
      COALESCE(SUM(CASE WHEN status='pending' THEN amount ELSE 0 END),0) AS total_pending,
      COUNT(CASE WHEN status='pending' THEN 1 END) AS pending_count,
      COUNT(*) AS tx_count
    FROM transactions WHERE date BETWEEN ? AND ?
  `).get(from, to);

  const by_category = db.prepare(`
    SELECT c.name, c.color, c.icon,
           COALESCE(SUM(t.amount),0) AS total,
           COUNT(*) AS count
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.date BETWEEN ? AND ?
      AND t.type IN ('payment','cheque_out')
      AND t.status IN ('paid','approved')
    GROUP BY t.category_id
    ORDER BY total DESC
  `).all(from, to);

  const by_day = db.prepare(`
    SELECT date,
           COALESCE(SUM(CASE WHEN type='receipt' THEN amount ELSE 0 END),0)                      AS received,
           COALESCE(SUM(CASE WHEN type IN ('payment','cheque_out') THEN amount ELSE 0 END),0)  AS spent
    FROM transactions
    WHERE date BETWEEN ? AND ? AND status IN ('paid','approved')
    GROUP BY date ORDER BY date ASC
  `).all(from, to);

  const top_payees = db.prepare(`
    SELECT payee, COALESCE(SUM(amount),0) AS total, COUNT(*) AS count
    FROM transactions
    WHERE date BETWEEN ? AND ? AND payee IS NOT NULL
      AND type IN ('payment','cheque_out') AND status IN ('paid','approved')
    GROUP BY payee ORDER BY total DESC LIMIT 10
  `).all(from, to);

  return { period: { from, to }, totals, by_category, by_day, top_payees };
}

function getBalance(date) {
  const db  = getDb();
  const row = db.prepare(
    `SELECT * FROM daily_balance WHERE date = ? ORDER BY id DESC LIMIT 1`
  ).get(date);
  return { date, amount: row?.amount ?? null, posted: !!row };
}

function upsertBalance(account_id, date, amount, posted_by) {
  getDb().prepare(`
    INSERT INTO daily_balance (account_id, date, amount, posted_by)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(account_id, date) DO UPDATE SET amount = excluded.amount
  `).run(account_id, date, amount, posted_by);
  return getBalance(date);
}

function allBalances(account_id) {
  return getDb().prepare(`
    SELECT db.*, u.name AS posted_by_name
    FROM daily_balance db
    LEFT JOIN users u ON u.id = db.posted_by
    WHERE db.account_id = ?
    ORDER BY db.date DESC
    LIMIT 90
  `).all(account_id);
}

module.exports = { dailyReport, summaryReport, getBalance, upsertBalance, allBalances };
