#!/usr/bin/env node
'use strict';
// READ-ONLY report: which employees might have lost leave days to the old "deducted again on approval" bug?
//
// The old bug charged an approved paid leave a SECOND time when it was approved from the Supervisor portal. The database never recorded
// who approved a leave or when, so the exact victims cannot be found automatically. This report narrows it down for HR:
//   • lists every APPROVED, WITH-PAY, VL/SL leave filed on/after --since (the period the old code was live), per employee
//   • shows the MOST each employee could be owed back (if every one of those approvals had been double-charged)
// HR then checks the leaves listed (who approved? supervisor portal or admin?) and corrects balances with Edit Employee — which is
// recorded in the Audit Log. This script never changes anything.
//
//   node scripts/leave-reconcile.js --since 2026-10-01            report to the screen + a CSV in the backups folder
//   node scripts/leave-reconcile.js --since 2026-10-01 --detail   also list every leave behind each number
//   node scripts/leave-reconcile.js --employee 12                 one employee only
// Environment: DB_PATH (default <app>/db/hris.db), BACKUP_DIR (CSV goes here; default <app>/backups)
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
const since = opt('since'), onlyEmp = opt('employee'), detail = args.includes('--detail');
if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) { console.error('❌ --since must look like 2026-10-01'); process.exit(1); }
const dbPath = process.env.DB_PATH || path.join(root, 'db', 'hris.db');
if (!fs.existsSync(dbPath)) { console.error('❌ Database not found: ' + dbPath); process.exit(1); }
const db = new Database(dbPath, { readonly: true, fileMustExist: true });      // read-only: cannot change anything
const isVL = (t) => t && (t.includes('VL') || t.includes('Vacation')), isSL = (t) => t && (t.includes('SL') || t.includes('Sick'));
const r2 = (x) => Math.round(x * 100) / 100;
const emps = db.prepare('SELECT id, name, vl_bal, sl_bal, active FROM employees' + (onlyEmp ? ' WHERE id = ?' : '') + ' ORDER BY name').all(...(onlyEmp ? [+onlyEmp] : []));
const q = db.prepare("SELECT * FROM leave_records WHERE employee_id = ? AND pay = 'With Pay' AND status = 'Approved' AND (? IS NULL OR substr(filed_at,1,10) >= ?) ORDER BY from_date");
const rows = [];
for (const e of emps) {
  const ls = q.all(e.id, since, since).filter(l => isVL(l.type) || isSL(l.type));
  if (!ls.length) continue;
  const vl = ls.filter(l => isVL(l.type)), sl = ls.filter(l => isSL(l.type));
  const sum = (a) => r2(a.reduce((s, l) => s + (l.days || 0), 0));
  rows.push({ id: e.id, name: e.name, active: e.active, vlNow: r2(e.vl_bal || 0), slNow: r2(e.sl_bal || 0), vlLeaves: vl, slLeaves: sl, vlDays: sum(vl), slDays: sum(sl) });
}
const pad = (s, n) => String(s).padEnd(n).slice(0, n), num = (x) => String(x).padStart(8);
console.log(`\nLeave reconciliation — approved paid VL/SL leaves${since ? ' filed on or after ' + since : ' (all time)'}   [read-only]\n`);
if (!rows.length) { console.log('No approved paid VL/SL leaves match. Nothing to review.\n'); process.exit(0); }
console.log(pad('Employee', 30) + num('VL now') + num('SL now') + num('VL appr.') + num('SL appr.') + '   Most possibly owed back (VL / SL)');
console.log('-'.repeat(100));
for (const r of rows) {
  console.log(pad(r.name + (r.active ? '' : ' (inactive)'), 30) + num(r.vlNow) + num(r.slNow) + num(r.vlDays) + num(r.slDays) + '   ' + r.vlDays + ' / ' + r.slDays);
  if (detail) for (const l of [...r.vlLeaves, ...r.slLeaves]) console.log('      leave #' + l.id + '  ' + pad(l.type, 22) + l.from_date + ' → ' + l.to_date + '  ' + l.days + ' day(s)  filed ' + String(l.filed_at || '').slice(0, 10));
}
console.log('-'.repeat(100));
console.log('"appr." = days of leaves that are Approved and With Pay. Only leaves approved from the SUPERVISOR portal while the old code was');
console.log('live could have been charged twice, so the true amount owed is usually LESS than the last column. Check each leave, then correct');
console.log('the balance in Edit Employee (the Audit Log records who changed it and from what to what).\n');
const dir = process.env.BACKUP_DIR || path.join(root, 'backups'); let csvPath = null;
try {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  csvPath = path.join(dir, 'leave-reconcile-' + new Date().toISOString().slice(0, 10) + '.csv');
  const cell = (v) => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const lines = [['employee_id', 'employee', 'active', 'vl_balance_now', 'sl_balance_now', 'approved_paid_vl_days', 'approved_paid_sl_days', 'most_possibly_owed_vl', 'most_possibly_owed_sl', 'leave_ids'].join(',')];
  for (const r of rows) lines.push([r.id, r.name, r.active ? 'yes' : 'no', r.vlNow, r.slNow, r.vlDays, r.slDays, r.vlDays, r.slDays, [...r.vlLeaves, ...r.slLeaves].map(l => l.id).join(' ')].map(cell).join(','));
  fs.writeFileSync(csvPath, '\ufeff' + lines.join('\r\n'), { mode: 0o600 });
  console.log('CSV for HR: ' + csvPath + '\n');
} catch (e) { console.error('(could not write the CSV: ' + e.message + ')'); }
