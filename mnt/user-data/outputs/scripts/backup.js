#!/usr/bin/env node
'use strict';
// Take a database backup from the command line — works whether or not the server is running (it uses SQLite's online-backup API,
// which is safe against a live WAL-mode database; do NOT just `cp db/hris.db`).
//   node scripts/backup.js            → reason "manual"
//   node scripts/backup.js pre-deploy → reason "pre-deploy" (used by deploy.sh)
// Environment: DB_PATH (default <app>/db/hris.db), BACKUP_DIR (default <app>/backups)
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const backup = require(path.join(root, 'lib', 'backup'));
const dbPath = process.env.DB_PATH || path.join(root, 'db', 'hris.db');
const dir = process.env.BACKUP_DIR || path.join(root, 'backups');
const reason = process.argv[2] || 'manual';
let version = '';
try { version = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).toString().trim(); } catch (e) { /* not a git checkout */ }
(async () => {
  const m = await backup.createBackup({ dbPath, dir, reason, version });
  const removed = backup.pruneBackups(dir);
  const mb = (m.sizeBytes / 1048576).toFixed(2);
  console.log(`✅ Backup created: ${path.join(dir, m.name)}  (${mb} MB, integrity ${m.integrity}, ${m.tables.employees ?? '?'} employees)`);
  if (removed.length) console.log(`   ${removed.length} old backup(s) removed by the retention policy.`);
})().catch(e => { console.error('❌ Backup FAILED:', e.message); process.exit(1); });
