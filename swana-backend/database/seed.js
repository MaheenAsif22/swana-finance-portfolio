'use strict';

const path    = require('path');
const bcrypt  = require('bcryptjs');
const { getDb } = require('../config/db');

const db = getDb();

console.log('🌱  Seeding demo database...');

// ─── Users ────────────────────────────────────────────────────────────────────
const users = [
  { name: 'Admin User',   username: 'admin',    pin: '1234', role: 'owner',   site: 'Head Office' },
  { name: 'Cashier One',  username: 'cashier1', pin: '0000', role: 'cashier', site: 'Branch A'    },
  { name: 'Cashier Two',  username: 'cashier2', pin: '0000', role: 'cashier', site: 'Branch B'    },
];

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (name, username, pin_hash, role, site)
  VALUES (@name, @username, @pin_hash, @role, @site)
`);

for (const u of users) {
  insertUser.run({ ...u, pin_hash: bcrypt.hashSync(u.pin, 10) });
}
console.log(`  ✓ ${users.length} users`);

// ─── Categories ───────────────────────────────────────────────────────────────
const categories = [
  { name: 'Salaries',       icon: 'people',        color: '#4CAF50' },
  { name: 'Utilities',      icon: 'flash',         color: '#2196F3' },
  { name: 'Transport',      icon: 'car',           color: '#FF9800' },
  { name: 'Office',         icon: 'briefcase',     color: '#9C27B0' },
  { name: 'Maintenance',    icon: 'construct',     color: '#F44336' },
  { name: 'Supplies',       icon: 'cube',          color: '#00BCD4' },
  { name: 'Miscellaneous',  icon: 'ellipsis-h',    color: '#607D8B' },
];

const insertCat = db.prepare(`
  INSERT OR IGNORE INTO categories (name, icon, color) VALUES (@name, @icon, @color)
`);
for (const c of categories) insertCat.run(c);
console.log(`  ✓ ${categories.length} categories`);

// ─── Accounts ─────────────────────────────────────────────────────────────────
const accounts = [
  { name: 'Main Cash',    type: 'cash',   opening_balance: 50000 },
  { name: 'Bank Account', type: 'bank',   opening_balance: 200000 },
  { name: 'Cheque Book',  type: 'cheque', opening_balance: 0 },
];

const insertAcc = db.prepare(`
  INSERT OR IGNORE INTO accounts (name, type, opening_balance) VALUES (@name, @type, @opening_balance)
`);
for (const a of accounts) insertAcc.run(a);
console.log(`  ✓ ${accounts.length} accounts`);

// ─── Sample Transactions ──────────────────────────────────────────────────────
const transactions = [
  { type: 'payment',  status: 'approved', amount: 15000, description: 'Monthly salaries',      payee: 'Staff',        payment_method: 'cash',   category_id: 1, account_id: 1, date: '2025-01-05', created_by: 1, approved_by: 1 },
  { type: 'payment',  status: 'approved', amount: 3200,  description: 'Electricity bill',       payee: 'Utility Co',   payment_method: 'online', category_id: 2, account_id: 2, date: '2025-01-08', created_by: 2, approved_by: 1 },
  { type: 'receipt',  status: 'approved', amount: 45000, description: 'Client payment received',payee: 'Client A',     payment_method: 'cheque', category_id: 7, account_id: 2, date: '2025-01-10', created_by: 1, approved_by: 1 },
  { type: 'payment',  status: 'pending',  amount: 8500,  description: 'Vehicle fuel',           payee: 'Vendor 1',     payment_method: 'cash',   category_id: 3, account_id: 1, date: '2025-01-12', created_by: 2, approved_by: null },
  { type: 'payment',  status: 'approved', amount: 2100,  description: 'Office stationery',      payee: 'Supplier A',   payment_method: 'cash',   category_id: 6, account_id: 1, date: '2025-01-15', created_by: 3, approved_by: 1 },
  { type: 'payment',  status: 'rejected', amount: 12000, description: 'Equipment repair',       payee: 'Contractor X', payment_method: 'cash',   category_id: 5, account_id: 1, date: '2025-01-18', created_by: 2, approved_by: null },
  { type: 'receipt',  status: 'approved', amount: 30000, description: 'Advance from client',    payee: 'Client B',     payment_method: 'online', category_id: 7, account_id: 2, date: '2025-01-20', created_by: 1, approved_by: 1 },
  { type: 'payment',  status: 'approved', amount: 5500,  description: 'Internet & phone bills',  payee: 'Utility Co',   payment_method: 'online', category_id: 2, account_id: 2, date: '2025-01-22', created_by: 1, approved_by: 1 },
  { type: 'payment',  status: 'pending',  amount: 9800,  description: 'Raw material purchase',  payee: 'Supplier B',   payment_method: 'cheque', category_id: 6, account_id: 3, date: '2025-01-25', created_by: 3, approved_by: null },
  { type: 'payment',  status: 'approved', amount: 1800,  description: 'Miscellaneous expenses', payee: 'Vendor 2',     payment_method: 'cash',   category_id: 7, account_id: 1, date: '2025-01-28', created_by: 2, approved_by: 1 },
];

const insertTx = db.prepare(`
  INSERT INTO transactions
    (type, status, amount, description, payee, payment_method, category_id, account_id, date, created_by, approved_by)
  VALUES
    (@type, @status, @amount, @description, @payee, @payment_method, @category_id, @account_id, @date, @created_by, @approved_by)
`);
for (const t of transactions) insertTx.run(t);
console.log(`  ✓ ${transactions.length} sample transactions`);

console.log('\n✅  Demo database ready!');
console.log('\nDemo login credentials:');
console.log('  username: admin     PIN: 1234  (owner)');
console.log('  username: cashier1  PIN: 0000  (cashier)');
console.log('  username: cashier2  PIN: 0000  (cashier)');