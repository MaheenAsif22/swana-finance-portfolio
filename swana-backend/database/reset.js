'use strict';

const fs   = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'swana.db');
const walPath = dbPath + '-wal';
const shmPath = dbPath + '-shm';

[dbPath, walPath, shmPath].forEach((f) => {
  if (fs.existsSync(f)) { fs.unlinkSync(f); console.log('  deleted', path.basename(f)); }
});

console.log('Database wiped. Running seed...\n');
require('./seed');
