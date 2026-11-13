'use strict';
// ─────────────────────────────────────────────────────────────────────────────────────────────
// HMB HRIS — AUDIT TRAIL
//
// Answers "who changed what, when, and from where?" for everything that changes data.
//   • Every successful (or refused) change request is recorded automatically, so routes added in future are covered too.
//   • Important cases add DETAIL events with before/after values (leave balances, payroll, salary and profile edits).
//   • The log is append-only (SQLite triggers refuse UPDATE/DELETE) and hash-chained: each row's hash covers the row
//     and the previous row's hash, so altering or removing a row later is detectable (see verify()).
//   • Passwords, tokens, signatures and API keys are never written.
// ─────────────────────────────────────────────────────────────────────────────────────────
const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Anything whose NAME looks like a secret is replaced before it can reach the log.
const SECRET_KEY = /pass(word|wd)?|secret|token|signature|(^|_)sig(_|$)|prepsig|apprsig|api[_-]?key|authorization|cookie|^key$|private/i;
const MAX_STR = 240;

function redact(v, depth = 0) {
  if (v == null) return v;
  if (typeof v === 'string') return v.length > MAX_STR ? v.slice(0, 120) + '…[' + v.length + ' chars]' : v;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (depth >= 5) return '[…]';
  if (Array.isArray(v)) {
    const out = v.slice(0, 30).map(x => redact(x, depth + 1));
    if (v.length > 30) out.push('…+' + (v.length - 30) + ' more');
    return out;
  }
  if (typeof v === 'object') {
    const out = {}; let n = 0;
    for (const [k, val] of Object.entries(v)) {
      if (++n > 60) { out['…'] = '+more keys'; break; }
      out[k] = SECRET_KEY.test(k) ? '[redacted]' : redact(val, depth + 1);
    }
    return out;
  }
  return String(v);
}

// Request fields that are safe and useful to keep when a route adds no detail of its own (nothing else from a body is kept).
const PICK = ['username', 'role', 'name', 'period', 'year', 'status', 'type', 'empId', 'employee_id', 'employeeId', 'employee_ids', 'from', 'to',
  'days', 'pay', 'halfDay', 'title', 'position', 'department', 'amount', 'all_active', 'reason', 'remarks'];
function pickInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const out = {};
  for (const k of PICK) if (body[k] !== undefined) out[k] = body[k];
  return Object.keys(out).length ? redact(out) : undefined;
}

// ── Human labels and categories ──────────────────────────────────────────────────────────────
const LABELS = {
  'POST /api/login': 'Signed in', 'POST /api/logout': 'Signed out', 'POST /api/change-password': 'Own password changed',
  'POST /api/users': 'User account created', 'PUT /api/users/:id/password': 'Password reset by admin', 'DELETE /api/users/:id': 'User account deleted',
  'PUT /api/users/:id/role': 'User role changed', 'POST /api/supervisor/:userId/subordinates': 'Supervisor assignment added', 'DELETE /api/supervisor/:userId/subordinates/:empId': 'Supervisor assignment removed',
  'POST /api/employees': 'Employee created', 'PUT /api/employees/:id': 'Employee profile saved', 'DELETE /api/employees/:id': 'Employee deleted',
  'POST /api/employees/:id/deactivate': 'Employee deactivated / reactivated', 'PUT /api/employees/:id/location-policy': 'Employee location policy changed',
  'POST /api/leave/file': 'Leave filed (by employee)', 'POST /api/leave': 'Leave filed (by admin/HR)', 'PUT /api/leave/:id': 'Leave updated / reviewed', 'DELETE /api/leave/:id': 'Leave deleted',
  'PUT /api/my/leaves/:id': 'Leave reviewed by supervisor', 'DELETE /api/leave/mine/:id': 'Leave cancelled by employee',
  'POST /api/leave-credits': 'Leave credit added', 'POST /api/leave-credits/:id/void': 'Leave credit voided',
  'POST /api/attendance': 'Payroll saved', 'POST /api/payslips': 'Payslip sent', 'POST /api/payslip-approvals': 'Payslip approval recorded', 'DELETE /api/payslip-approvals/:period': 'Payslip approval removed',
  'POST /api/timelogs': 'Time log punch filed by admin/HR', 'PATCH /api/timelogs/:id': 'Time log edited',
  'POST /api/settings': 'Settings changed', 'POST /api/shifts': 'Shift created', 'PUT /api/shifts/:id': 'Shift changed', 'DELETE /api/shifts/:id': 'Shift deleted',
  'POST /api/backups': 'Database backup created', 'POST /api/thirteenth/:year': '13th month tracker created', 'DELETE /api/thirteenth/:year': '13th month tracker deleted',
  'PUT /api/thirteenth/:year/columns': '13th month payroll dates changed', 'POST /api/thirteenth/:year/employees': '13th month employees added', 'PUT /api/thirteenth/:year/bulk': '13th month amounts saved',
  'PUT /api/thirteenth/rows/:id': '13th month row edited', 'DELETE /api/thirteenth/rows/:id': '13th month row removed',
  'POST /api/performance': 'Evaluation saved', 'DELETE /api/performance/:id': 'Evaluation deleted', 'POST /api/disciplinary': 'Disciplinary record added',
  'PUT /api/disciplinary/:id': 'Disciplinary record changed', 'DELETE /api/disciplinary/:id': 'Disciplinary record deleted'
};
function categoryFor(route) {
  const seg = (String(route).split('/')[2] || '').toLowerCase();
  if (['login', 'logout', 'users', 'supervisor', 'change-password'].includes(seg)) return 'accounts';
  if (['leave', 'leave-credits'].includes(seg) || /\/my\/leaves/.test(route)) return 'leave';
  if (['attendance', 'payslips', 'payslip-approvals', 'thirteenth'].includes(seg)) return 'payroll';
  if (['employees', 'shifts', 'benefit-types'].includes(seg)) return 'employee';
  if (seg === 'timelogs') return 'timelogs';
  if (seg === 'settings') return 'settings';
  if (seg === 'careers') return 'recruitment';
  if (seg === 'announcements' || seg === 'announcement-attachments') return 'announcements';
  if (['performance', 'disciplinary', 'evr-submissions'].includes(seg)) return 'records';
  if (['backups', 'audit', 'export'].includes(seg)) return 'system';
  return 'other';
}
function labelFor(method, route) {
  const key = method + ' ' + route;
  if (LABELS[key]) return LABELS[key];
  const noun = String(route).split('/').filter(s => s && s !== 'api' && !s.startsWith(':')).join(' ').replace(/-/g, ' ');
  const verb = { POST: 'Saved', PUT: 'Changed', PATCH: 'Changed', DELETE: 'Deleted' }[method] || method;
  return verb + ': ' + noun;
}
// Clock punches are ordinary frequent data (the time log itself is the record), so they are not audited one by one.
const SKIP = new Set(['POST /api/timelogs/timein', 'POST /api/timelogs/lunch-out', 'POST /api/timelogs/lunch-in', 'POST /api/timelogs/merienda-out',
  'POST /api/timelogs/merienda-in', 'POST /api/timelogs/timeout', 'POST /api/login']);   // login is recorded explicitly (success AND failure)

// ── hash chain ───────────────────────────────────────────────────────────────────────────────
const FIELDS = ['at', 'request_id', 'actor_id', 'actor_name', 'actor_role', 'ip', 'method', 'route', 'category', 'action', 'result', 'status',
  'employee_id', 'employee_name', 'summary', 'details'];
function hashOf(prev, row) {
  const h = crypto.createHash('sha256');
  h.update(String(prev || 'GENESIS'));
  for (const f of FIELDS) h.update('\u241F' + f + '=' + (row[f] == null ? '' : String(row[f])));
  return h.digest('hex');
}

function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;      // stop spreadsheet formula injection from user-typed text
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function createAudit(db, opts = {}) {
  const nameOf = (id) => { try { const r = db.prepare('SELECT name FROM employees WHERE id=?').get(id); return r ? r.name : null; } catch (e) { return null; } };

  function init() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        at TEXT NOT NULL,
        request_id TEXT, actor_id INTEGER, actor_name TEXT, actor_role TEXT, ip TEXT,
        method TEXT, route TEXT, category TEXT, action TEXT NOT NULL,
        result TEXT DEFAULT 'ok', status INTEGER,
        employee_id INTEGER, employee_name TEXT,
        summary TEXT, details TEXT,
        prev_hash TEXT, hash TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(at);
      CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor_name);
      CREATE INDEX IF NOT EXISTS idx_audit_cat ON audit_log(category);
      CREATE INDEX IF NOT EXISTS idx_audit_emp ON audit_log(employee_id);
      CREATE INDEX IF NOT EXISTS idx_audit_req ON audit_log(request_id);
      -- append-only: a bug (or an injected statement) cannot edit or erase history through the application
      CREATE TRIGGER IF NOT EXISTS audit_log_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
      CREATE TRIGGER IF NOT EXISTS audit_log_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT, 'audit_log is append-only'); END;
    `);
  }

  const lastHashStmt = () => db.prepare('SELECT hash FROM audit_log ORDER BY id DESC LIMIT 1');
  function record(row) {
    // Build the COMPLETE row (defaults applied) first, so what is hashed is exactly what is stored.
    const full = { request_id: null, actor_id: null, actor_name: null, actor_role: null, ip: null, method: null, route: null, category: null,
                   result: 'ok', status: null, employee_id: null, employee_name: null, summary: null, details: null, ...row };
    full.at = full.at || new Date().toISOString();
    if (full.details != null && typeof full.details !== 'string') full.details = JSON.stringify(full.details);
    const tx = db.transaction(() => {
      const last = lastHashStmt().get();
      const prev = last ? last.hash : 'GENESIS';
      const hash = hashOf(prev, full);
      const r = db.prepare(`INSERT INTO audit_log (at,request_id,actor_id,actor_name,actor_role,ip,method,route,category,action,result,status,employee_id,employee_name,summary,details,prev_hash,hash)
        VALUES (@at,@request_id,@actor_id,@actor_name,@actor_role,@ip,@method,@route,@category,@action,@result,@status,@employee_id,@employee_name,@summary,@details,@prev_hash,@hash)`)
        .run({ ...full, prev_hash: prev, hash });
      return r.lastInsertRowid;
    });
    return tx();
  }

  function actorFrom(req) {
    const u = req && req.session && req.session.user;
    return u ? { id: u.id, name: u.username, role: u.role } : null;
  }
  function ipFrom(req) {
    if (!req) return null;
    const xff = req.headers && req.headers['x-forwarded-for'];
    return (xff ? String(xff).split(',')[0].trim() : (req.socket && req.socket.remoteAddress)) || null;
  }

  // A detail event (before/after values etc.). Actor and request id come from the request that is being handled.
  function event(e) {
    try {
      const st = als.getStore();
      const actor = e.actor || (st && st.actor) || { id: null, name: 'system', role: 'system' };
      const empId = e.employeeId != null ? e.employeeId : null;
      return record({
        request_id: st ? st.reqId : null, actor_id: actor.id, actor_name: actor.name, actor_role: actor.role, ip: st ? st.ip : null,
        method: st ? st.method : null, route: st ? st.route : null, category: e.category || 'other', action: e.action,
        result: e.result || 'ok', status: e.status || null, employee_id: empId, employee_name: e.employeeName || (empId != null ? nameOf(empId) : null),
        summary: e.summary || null, details: e.details != null ? redact(e.details) : null
      });
    } catch (err) { console.error('[audit] could not write event:', err.message); return null; }
  }
  // Add context to the request being handled (merged into its automatic row).
  function note(n) {
    const st = als.getStore(); if (!st) return;
    if (n.employeeId != null) st.extra.employeeId = n.employeeId;
    if (n.summary) st.extra.summary = n.summary;
    if (n.action) st.extra.action = n.action;
    if (n.details) st.extra.details = Object.assign(st.extra.details || {}, n.details);
  }

  function middleware() {
    return (req, res, next) => {
      const st = { reqId: crypto.randomBytes(6).toString('hex'), actor: actorFrom(req), ip: ipFrom(req), method: req.method, route: null, extra: {}, body: null, done: false };
      const run = () => { if (st.done) return; st.done = true; try { finalize(req, res, st); } catch (e) { console.error('[audit] could not log request:', e.message); } };
      // Written BEFORE the reply goes out, so the log can never lag behind what the user was told (and survives a crash right after).
      const origJson = res.json.bind(res);
      res.json = (b) => { st.body = b; run(); return origJson(b); };
      res.on('finish', run);                    // replies that are not JSON (downloads etc.) are still captured
      als.run(st, next);
    };
  }
  function finalize(req, res, st) {
    if (!MUTATING.has(req.method)) return;
    const routePath = (req.route && req.route.path) || String(req.originalUrl || req.url).split('?')[0].replace(/\/+$/, '').replace(/\/\d+(?=\/|$)/g, '/:id');
    const key = req.method + ' ' + routePath;
    if (SKIP.has(key)) return;
    const code = res.statusCode;
    if (code === 401 || code === 404) return;                      // signed-out / unknown URL: noise, not activity
    if (!st.actor) return;                                         // nobody was signed in (scanners, bots, expired sessions): not activity
    const body = st.body, failed = code >= 400 || (body && body.success === false);
    const result = code === 403 ? 'denied' : (code >= 500 ? 'error' : (failed ? 'failed' : 'ok'));
    const actor = st.actor || actorFrom(req) || { id: null, name: 'anonymous', role: null };
    const params = req.params && Object.keys(req.params).length ? req.params : undefined;
    const empId = st.extra.employeeId != null ? st.extra.employeeId
      : (params && /\/employees\/:id/.test(routePath) ? +params.id
      : (req.body && (req.body.empId || req.body.employee_id || req.body.employeeId)) || null);
    const details = Object.assign({}, params ? { params } : {}, pickInput(req.body) ? { input: pickInput(req.body) } : {}, st.extra.details || {});
    if (failed && body && body.error) details.error = String(body.error).slice(0, 200);
    const action = st.extra.action || labelFor(req.method, routePath);
    record({
      request_id: st.reqId, actor_id: actor.id, actor_name: actor.name, actor_role: actor.role, ip: st.ip,
      method: req.method, route: routePath, category: categoryFor(routePath), action: result === 'denied' ? action + ' — REFUSED' : action,
      result, status: code, employee_id: empId || null, employee_name: empId ? nameOf(+empId) : null,
      summary: st.extra.summary || (result === 'ok' ? null : (details.error || ('HTTP ' + code))),
      details: Object.keys(details).length ? JSON.stringify(redact(details)) : null
    });
  }

  // ── reading ──
  function where(f) {
    const w = [], a = {};
    if (f.from) { w.push('at >= @from'); a.from = new Date(f.from).toISOString(); }
    if (f.to) { w.push('at <= @to'); a.to = new Date(f.to).toISOString(); }
    if (f.actor) { w.push('actor_name = @actor'); a.actor = f.actor; }
    if (f.category) { w.push('category = @category'); a.category = f.category; }
    if (f.result) { w.push('result = @result'); a.result = f.result; }
    if (f.employee_id) { w.push('employee_id = @eid'); a.eid = +f.employee_id; }
    if (f.request_id) { w.push('request_id = @rid'); a.rid = f.request_id; }
    if (f.q) { w.push("(action LIKE @q ESCAPE '\\' OR summary LIKE @q ESCAPE '\\' OR employee_name LIKE @q ESCAPE '\\' OR actor_name LIKE @q ESCAPE '\\' OR details LIKE @q ESCAPE '\\')"); a.q = '%' + String(f.q).replace(/[\\%_]/g, m => '\\' + m) + '%'; }
    return { sql: w.length ? 'WHERE ' + w.join(' AND ') : '', args: a };
  }
  const shape = (r) => ({ id: r.id, at: r.at, requestId: r.request_id, actor: r.actor_name, role: r.actor_role, ip: r.ip, method: r.method, route: r.route,
    category: r.category, action: r.action, result: r.result, status: r.status, employeeId: r.employee_id, employeeName: r.employee_name,
    summary: r.summary, details: r.details ? safeParse(r.details) : null });
  function safeParse(s) { try { return JSON.parse(s); } catch (e) { return s; } }
  function query(f = {}) {
    const { sql, args } = where(f);
    const limit = Math.min(Math.max(parseInt(f.limit) || 50, 1), 500), offset = Math.max(parseInt(f.offset) || 0, 0);
    const total = db.prepare(`SELECT COUNT(*) c FROM audit_log ${sql}`).get(args).c;
    const rows = db.prepare(`SELECT * FROM audit_log ${sql} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`).all(args).map(shape);
    return { total, rows, limit, offset };
  }
  function facets() {
    return {
      actors: db.prepare('SELECT DISTINCT actor_name FROM audit_log WHERE actor_name IS NOT NULL ORDER BY actor_name').all().map(r => r.actor_name),
      categories: db.prepare('SELECT DISTINCT category FROM audit_log WHERE category IS NOT NULL ORDER BY category').all().map(r => r.category)
    };
  }
  function csv(f = {}) {
    const { sql, args } = where(f);
    const head = ['id', 'time (UTC)', 'who', 'role', 'ip', 'category', 'action', 'result', 'employee', 'summary', 'details'];
    const out = [head.join(',')];
    for (const r of db.prepare(`SELECT * FROM audit_log ${sql} ORDER BY id DESC LIMIT 20000`).iterate(args)) {
      out.push([r.id, r.at, r.actor_name, r.actor_role, r.ip, r.category, r.action, r.result, r.employee_name, r.summary, r.details].map(csvCell).join(','));
    }
    return out.join('\r\n');
  }

  // Recompute the whole chain. `anchors` are [{id, hash}] recorded elsewhere (e.g. in backup manifests): they catch the one thing a
  // chain alone cannot — rows deleted from the END of the log.
  function verify(anchors = []) {
    let prev = 'GENESIS', checked = 0, lastId = 0;
    for (const r of db.prepare('SELECT * FROM audit_log ORDER BY id ASC').iterate()) {
      if (checked > 0 && r.id !== lastId + 1) return { ok: false, checked, badId: lastId + 1, reason: 'Entries are missing: the log jumps from #' + lastId + ' to #' + r.id };
      if (r.prev_hash !== prev) return { ok: false, checked, badId: r.id, reason: 'Entry #' + r.id + ' does not follow the previous one (an entry before it was removed or changed)' };
      if (hashOf(prev, r) !== r.hash) return { ok: false, checked, badId: r.id, reason: 'Entry #' + r.id + ' was altered after it was written' };
      prev = r.hash; lastId = r.id; checked++;
    }
    const bad = [];
    let anchored = 0;
    for (const a of anchors) {
      if (!a || !a.id) continue;
      const row = db.prepare('SELECT hash FROM audit_log WHERE id=?').get(a.id);
      if (!row) bad.push('Entry #' + a.id + ' recorded in a backup no longer exists (entries were deleted)');
      else if (row.hash !== a.hash) bad.push('Entry #' + a.id + ' no longer matches the copy in a backup');
      else anchored++;
    }
    if (bad.length) return { ok: false, checked, anchored, badId: null, reason: bad[0], problems: bad };
    return { ok: true, checked, anchored, headId: lastId };
  }
  function head() { return db.prepare('SELECT id, hash FROM audit_log ORDER BY id DESC LIMIT 1').get() || null; }
  function count() { return db.prepare('SELECT COUNT(*) c FROM audit_log').get().c; }

  return { init, record, event, note, middleware, query, facets, csv, verify, head, count };
}

module.exports = { createAudit, redact, hashOf, labelFor, categoryFor, csvCell, als, SECRET_KEY };
