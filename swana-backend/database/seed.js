'use strict';

require('dotenv').config();
const bcrypt   = require('bcryptjs');
const { getDb } = require('../config/db');
const { migrate } = require('./migrate');

const db = getDb();
migrate();

console.log('\n🌱 Seeding database...');

// ─── USERS ────────────────────────────────────────────────────────────────────
const upsertUser = db.prepare(`
  INSERT INTO users (name, username, pin_hash, role, site)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(username) DO NOTHING
`);

const USERS = [
  { name: 'Usman',    username: 'usman',   pin: '1234', role: 'owner',   site: 'Head Office' },
  { name: 'Zahid Sb', username: 'zahid',   pin: '0000', role: 'cashier', site: 'Factory – Rawalpindi' },
  { name: 'Shazada',  username: 'shazada', pin: '0000', role: 'cashier', site: 'Factory – Site 2' },
];

for (const u of USERS) {
  upsertUser.run(u.name, u.username, bcrypt.hashSync(u.pin, 10), u.role, u.site);
}
console.log('  ✓ Users');

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
const upsertCat = db.prepare(`
  INSERT INTO categories (name, icon, color)
  VALUES (?, ?, ?)
  ON CONFLICT(name) DO NOTHING
`);

const CATEGORIES = [
  ['Fuel & Petrol',     'fuel',         '#E85D24'],
  ['Meals & Food',      'utensils',     '#1D9E75'],
  ['Materials & Parts', 'package',      '#BA7517'],
  ['Labour & Wages',    'hard-hat',     '#7F77DD'],
  ['Vendor Payments',   'building-2',   '#D4537E'],
  ['Utility Bills',     'zap',          '#378ADD'],
  ['Transport & Fare',  'car',          '#639922'],
  ['Paint & Coatings',  'paint-bucket', '#888780'],
  ['Stationery',        'paperclip',    '#0F6E56'],
  ['Loans & Advances',  'hand-coins',   '#D85A30'],
  ['Medical',           'heart-pulse',  '#E24B4A'],
  ['Miscellaneous',     'tag',          '#B4B2A9'],
];

for (const c of CATEGORIES) upsertCat.run(...c);
console.log('  ✓ Categories');

// ─── ACCOUNTS ─────────────────────────────────────────────────────────────────
const upsertAcc = db.prepare(`
  INSERT INTO accounts (name, type, opening_balance)
  VALUES (?, ?, ?)
  ON CONFLICT(name) DO NOTHING
`);

upsertAcc.run('Factory Cash Box', 'cash',   15510);
upsertAcc.run('Askari Bank',      'bank',  300000);
upsertAcc.run('Meezan Bank',      'bank',  450000);
console.log('  ✓ Accounts');

// ─── DAILY BALANCE ────────────────────────────────────────────────────────────
const todayStr     = new Date().toISOString().split('T')[0];
const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

db.prepare(`
  INSERT INTO daily_balance (account_id, date, amount, posted_by)
  VALUES (1, ?, ?, 2)
  ON CONFLICT(account_id, date) DO UPDATE SET amount = excluded.amount
`).run(todayStr, 15510);

db.prepare(`
  INSERT INTO daily_balance (account_id, date, amount, posted_by)
  VALUES (1, ?, ?, 2)
  ON CONFLICT(account_id, date) DO UPDATE SET amount = excluded.amount
`).run(yesterdayStr, 22000);

console.log('  ✓ Daily balances');

// ─── TRANSACTIONS ─────────────────────────────────────────────────────────────
// Fetch IDs after seeding
const uid = (name) => db.prepare('SELECT id FROM users WHERE username = ?').get(name).id;
const cid = (name) => db.prepare('SELECT id FROM categories WHERE name = ?').get(name).id;

const ownerId    = uid('usman');
const zahidId    = uid('zahid');
const shazadaId  = uid('shazada');

const insertTx = db.prepare(`
  INSERT INTO transactions
    (type, status, amount, description, payee, payment_method,
     category_id, account_id, date, created_by, approved_by, approved_at)
  VALUES
    (@type, @status, @amount, @desc, @payee, @method,
     @catId, 1, @date, @by, @apprBy, @apprAt)
`);

const paid = (type, amount, desc, payee, method, catName, by, date) => ({
  type, status: 'paid', amount, desc, payee, method,
  catId: cid(catName), by, apprBy: ownerId,
  apprAt: new Date().toISOString(), date,
});

const pending = (amount, desc, payee, method, catName, by, date) => ({
  type: 'request', status: 'pending', amount, desc, payee, method,
  catId: cid(catName), by, apprBy: null, apprAt: null, date,
});

const seedTx = db.transaction(() => {
  // ── Today ──
  // Receipts
  insertTx.run(paid('receipt',  56580, 'Cash from Usman Sb',             'Usman',          'cash',   'Miscellaneous',     zahidId,   todayStr));
  insertTx.run(paid('receipt',  25000, 'Online transfer from Nouman',    'Nouman',         'online', 'Miscellaneous',     zahidId,   todayStr));

  // Payments
  insertTx.run(paid('payment',    500, 'Petrol for motorcycle',           'Bilal',          'cash',   'Fuel & Petrol',     zahidId,   todayStr));
  insertTx.run(paid('payment',    440, 'Screws – factory',                'Rafaquat',       'cash',   'Materials & Parts', zahidId,   todayStr));
  insertTx.run(paid('payment',   2000, 'Meal for labour',                 'Tasawar',        'cash',   'Meals & Food',      zahidId,   todayStr));
  insertTx.run(paid('payment',    180, 'Thimble',                         'Nouman',         'cash',   'Materials & Parts', zahidId,   todayStr));
  insertTx.run(paid('payment',    100, 'Surf / soap',                     'Mubin Tahir',    'cash',   'Miscellaneous',     zahidId,   todayStr));
  insertTx.run(paid('payment',    410, 'Union and socket',                'Asad',           'cash',   'Materials & Parts', zahidId,   todayStr));
  insertTx.run(paid('payment',    900, 'Wiper blade and fare',            'Abdul Quddus',   'cash',   'Transport & Fare',  zahidId,   todayStr));
  insertTx.run(paid('payment',    300, 'Petrol – motorcycle',             'Gulzareen',      'cash',   'Fuel & Petrol',     zahidId,   todayStr));
  insertTx.run(paid('payment',    360, 'Soap',                            'Fayyaz',         'cash',   'Miscellaneous',     zahidId,   todayStr));
  insertTx.run(paid('payment',    720, 'Water bottles',                    null,            'cash',   'Meals & Food',      zahidId,   todayStr));
  insertTx.run(paid('payment',   3520, 'Motorcycle tyre, meal and TCS',   'Shahzada',       'cash',   'Transport & Fare',  zahidId,   todayStr));
  insertTx.run(paid('payment',  54050, 'Contract photocopies and binding', 'Shahzada',      'cash',   'Stationery',        zahidId,   todayStr));
  insertTx.run(paid('cheque_out',48300,'DAS Pakistan – monthly invoice',  'DAS Pakistan',   'cheque', 'Vendor Payments',   zahidId,   todayStr));

  // Pending requests
  insertTx.run(pending(40000, 'Factory supplies – Q2',     'Abdul Quddus', 'cash',   'Materials & Parts', zahidId,  todayStr));
  insertTx.run(pending( 5000, 'Factory running expenses',  'Abdul Quddus', 'online', 'Miscellaneous',     zahidId,  todayStr));
  insertTx.run(pending(15000, 'Labour wages – week 2',     'Imtiaz',       'cash',   'Labour & Wages',    shazadaId,todayStr));
  insertTx.run(pending( 8500, 'Paint and primer',           'Ali Paint',    'cash',   'Paint & Coatings',  shazadaId,todayStr));

  // ── Yesterday ──
  insertTx.run(paid('receipt',   5000, 'Cash from Imran Sb',             'Imran Sb',        'cash',   'Miscellaneous',     zahidId,   yesterdayStr));
  insertTx.run(paid('payment',   2350, 'Meal for Tasawar',               'Tasawar',          'cash',   'Meals & Food',      zahidId,   yesterdayStr));
  insertTx.run(paid('payment',  41000, 'LCD and fare',                   'Nouman',           'cash',   'Miscellaneous',     zahidId,   yesterdayStr));
  insertTx.run(paid('payment',   5000, 'Loan to Ali Shan',               'Ali Shan',         'cash',   'Loans & Advances',  zahidId,   yesterdayStr));
  insertTx.run(paid('payment',    630, 'Lemon, biscuits, sugar, tea',    'Habib Ullah',      'cash',   'Meals & Food',      zahidId,   yesterdayStr));
  insertTx.run(paid('payment',   1200, 'Electricity bill partial',       'WAPDA',            'cash',   'Utility Bills',     zahidId,   yesterdayStr));
  insertTx.run(paid('payment',   3340, 'Expenditure Kamra',              'Intizar',          'cash',   'Miscellaneous',     zahidId,   yesterdayStr));

  // ── 7 days ago ──
  const d7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  insertTx.run(paid('receipt',  80000, 'Cash from Usman Sb – weekly',   'Usman',            'cash',   'Miscellaneous',     zahidId,   d7));
  insertTx.run(paid('payment',  12000, 'Wages – weekly labour',          'Imtiaz',           'cash',   'Labour & Wages',    zahidId,   d7));
  insertTx.run(paid('payment',   4500, 'Petrol – factory van',           'Bilal',            'cash',   'Fuel & Petrol',     zahidId,   d7));
  insertTx.run(paid('payment',   6200, 'Spare parts – compressor',       'Mehboob',          'cash',   'Materials & Parts', zahidId,   d7));
  insertTx.run(paid('payment',  18000, 'Gas bill',                       'SNGPL',            'cheque', 'Utility Bills',     zahidId,   d7));

  // ── 14 days ago ──
  const d14 = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
  insertTx.run(paid('receipt',  120000,'Cheque from Usman Sb',           'Usman',            'cheque', 'Miscellaneous',    zahidId,    d14));
  insertTx.run(paid('payment',   9000, 'Paint – factory floor',          'Ali Paint',        'cash',   'Paint & Coatings', shazadaId,  d14));
  insertTx.run(paid('payment',   2800, 'Meals – 2 days labour',          'Tasawar',          'cash',   'Meals & Food',     shazadaId,  d14));
  insertTx.run(paid('payment',  25000, 'Abdul Quddus – advance',         'Abdul Quddus',     'cash',   'Loans & Advances', zahidId,    d14));
  insertTx.run(paid('payment',   3100, 'TCS courier – documents',        'TCS',              'cash',   'Transport & Fare', zahidId,    d14));

  // ── 30 days ago ──
  const d30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
  insertTx.run(paid('receipt', 200000, 'Monthly cash from Usman Sb',    'Usman',             'cash',   'Miscellaneous',    zahidId,    d30));
  insertTx.run(paid('payment',  45000, 'Monthly wages – all labour',    'Imtiaz',            'cash',   'Labour & Wages',   zahidId,    d30));
  insertTx.run(paid('payment',  32000, 'Vendor – raw material',         'Arshad & Sons',     'cheque', 'Vendor Payments',  zahidId,    d30));
  insertTx.run(paid('payment',   8900, 'Petrol – monthly',              'Bilal',             'cash',   'Fuel & Petrol',    zahidId,    d30));
  insertTx.run(paid('payment',  14500, 'Utility bills – all',           'WAPDA/SNGPL',       'cash',   'Utility Bills',    zahidId,    d30));
  insertTx.run(paid('payment',   1800, 'Medical – Haji Sb treatment',   'Dr Clinic',         'cash',   'Medical',          zahidId,    d30));
});

seedTx();
console.log('  ✓ Transactions (42 records across 5 date ranges)');
console.log('\n✅ Seed complete.');
console.log('\nDemo logins:');
console.log('  username: usman   | pin: 1234 | role: owner');
console.log('  username: zahid   | pin: 0000 | role: cashier');
console.log('  username: shazada | pin: 0000 | role: cashier\n');
