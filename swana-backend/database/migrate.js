'use strict';

const fs   = require('fs');
const path = require('path');
const { getDb } = require('../config/db');

function migrate() {
  const db  = getDb();
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(sql);
  console.log('  ✓ Schema applied');
}

module.exports = { migrate };

if (require.main === module) {
  migrate();
}
