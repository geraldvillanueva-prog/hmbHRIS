'use strict';
// ─────────────────────────────────────────────────────────────────────────────────────────────
// HMB HRIS — DATABASE BACKUPS
//
// The database runs in WAL mode, so copying db/hris.db with cp/rsync/OneDrive while the server is running can silently miss
// recent changes. SQLite's online-backup API takes a consistent snapshot safely, even mid-write — that is what this uses.
// Every backup is (1) integrity-checked AS A COPY, (2) compressed, and (3) described by a small manifest recording row counts and
// the head of the audit log — so deleted history can later be detected (see lib/audit.js verify()).
// Used by the server (scheduled + "Back up now") and by scripts/backup.js (e.g. before a deploy).
// ─────────────────────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const Database = require('better-sqlite3');

const TABLES = ['employees', 'users', 'leave_records', 'attendance', 'payslip_history', 'time_logs', 'audit_log'];
const NAME_RE = /^hris-\d{8}-\d{6}-[a-z0-9-]+\.db\.gz$/;
const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;

// Opening the copy to verify it can leave SQLite side files (-wal / -shm) next to it: remove all of them, not just the .db.
function cleanupTemp(tmp) { for (const f of [tmp, tmp + '-wal', tmp + '-shm', tmp + '-journal']) { try { fs.unlinkSync(f); } catch (_) { /* not there */ } } }

// Take a backup. Pass `db` (an open connection, used by the server) or `dbPath` (used by scripts).
async function createBackup({ db, dbPath, dir, reason = 'manual', version = '', now = new Date() }) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const safeReason = String(reason).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'manual';
  let base = `hris-${stamp(now)}-${safeReason}`;
  for (let n = 2; fs.existsSync(path.join(dir, base + '.db.gz')); n++) base = `hris-${stamp(now)}-${safeReason}-${n}`;   // two backups in the same second never overwrite each other
  const tmp = path.join(dir, `.${base}.tmp.db`);
  const gz = path.join(dir, base + '.db.gz');
  let src = db, own = false;
  if (!src) { src = new Database(dbPath, { readonly: true, fileMustExist: true }); own = true; }
  try { await src.backup(tmp); }
  catch (e) { cleanupTemp(tmp); throw e; }
  finally { if (own) src.close(); }

  // Verify the COPY, not the original: a backup that cannot be opened is worse than none.
  const chk = new Database(tmp, { readonly: true });
  let integrity = 'unknown'; const tables = {}; let auditHead = null;
  try {
    integrity = chk.pragma('integrity_check', { simple: true });
    for (const t of TABLES) { try { tables[t] = chk.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c; } catch (_) { /* table may not exist yet */ } }
    try { auditHead = chk.prepare('SELECT id, hash FROM audit_log ORDER BY id DESC LIMIT 1').get() || null; } catch (_) {}
  } finally { chk.close(); }
  if (integrity !== 'ok') { cleanupTemp(tmp); throw new Error('The backup failed its integrity check (' + integrity + ') and was discarded.'); }

  const rawBytes = fs.statSync(tmp).size;
  try { await pipeline(fs.createReadStream(tmp), zlib.createGzip({ level: 6 }), fs.createWriteStream(gz, { mode: 0o600 })); }
  catch (e) { try { fs.unlinkSync(gz); } catch (_) {} throw e; }
  finally { cleanupTemp(tmp); }

  const manifest = { name: base + '.db.gz', createdAt: now.toISOString(), reason: safeReason, sizeBytes: fs.statSync(gz).size, rawBytes, version,
                     integrity, tables, auditHead };
  fs.writeFileSync(path.join(dir, base + '.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 });
  return manifest;
}

// Newest first. A backup without a readable manifest is still listed (from its file time) so nothing is hidden.
function listBackups(dir) {
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => NAME_RE.test(f)); } catch (_) { return []; }
  const out = files.map(f => {
    const full = path.join(dir, f);
    let m = null;
    try { m = JSON.parse(fs.readFileSync(full.replace(/\.db\.gz$/, '.json'), 'utf8')); } catch (_) {}
    const st = fs.statSync(full);
    return m ? Object.assign({}, m, { sizeBytes: st.size }) : { name: f, createdAt: st.mtime.toISOString(), reason: 'unknown', sizeBytes: st.size, integrity: 'unknown', tables: {}, auditHead: null };
  });
  return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// Which backups to KEEP: the newest `keepRecent`, plus the newest one of each of the last `keepWeeks` weeks and `keepMonths` months.
// Everything else is pruned. Pure function (no file access) so the policy can be tested on its own.
function selectToKeep(list, now = new Date(), { keepRecent = 14, keepWeeks = 8, keepMonths = 6 } = {}) {
  const keep = new Set();
  const sorted = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  sorted.slice(0, keepRecent).forEach(b => keep.add(b.name));
  const weekKey = (d) => { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - day); return t.toISOString().slice(0, 10); };
  const monthKey = (d) => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1);
  const seenW = new Set(), seenM = new Set();
  const wOk = (d) => (now - d) / 864e5 <= keepWeeks * 7 + 7, mOk = (d) => (now - d) / 864e5 <= keepMonths * 31 + 31;
  for (const b of sorted) {                      // newest first, so the first one seen in a week/month is that week's/month's newest
    const d = new Date(b.createdAt);
    const wk = weekKey(d), mk = monthKey(d);
    if (!seenW.has(wk)) { seenW.add(wk); if (wOk(d)) keep.add(b.name); }
    if (!seenM.has(mk)) { seenM.add(mk); if (mOk(d)) keep.add(b.name); }
  }
  return keep;
}
function pruneBackups(dir, now = new Date(), policy) {
  const list = listBackups(dir);
  const keep = selectToKeep(list, now, policy);
  const removed = [];
  for (const b of list) {
    if (keep.has(b.name)) continue;
    try { fs.unlinkSync(path.join(dir, b.name)); } catch (_) {}
    try { fs.unlinkSync(path.join(dir, b.name.replace(/\.db\.gz$/, '.json'))); } catch (_) {}
    removed.push(b.name);
  }
  return removed;
}

// Run once a day, after `hour` o'clock. If a run was missed (server was down), catch up once the gap passes `maxGapHours`.
function shouldRunScheduled({ now = new Date(), lastBackupAt = null, hour = 2, minGapHours = 20, maxGapHours = 30 }) {
  if (!lastBackupAt) return true;
  const gap = (now - new Date(lastBackupAt)) / 36e5;
  if (gap >= maxGapHours) return true;
  return gap >= minGapHours && now.getHours() >= hour;
}
function nextScheduled({ now = new Date(), lastBackupAt = null, hour = 2, minGapHours = 20 }) {
  const t = new Date(now); t.setHours(hour, 0, 0, 0);
  if (t <= now) t.setDate(t.getDate() + 1);
  if (lastBackupAt) { const earliest = new Date(new Date(lastBackupAt).getTime() + minGapHours * 36e5); while (t < earliest) t.setDate(t.getDate() + 1); }
  return t;
}
function diskFreeBytes(dir) { try { const s = fs.statfsSync(dir); return Number(s.bavail) * Number(s.bsize); } catch (_) { return null; } }

module.exports = { createBackup, listBackups, selectToKeep, pruneBackups, shouldRunScheduled, nextScheduled, diskFreeBytes, NAME_RE, TABLES };
