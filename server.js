const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── DATABASE SETUP ───────────────────────────────────────────────────────────
const dbPath = path.join(__dirname, 'db', 'hris.db');
if (!fs.existsSync(path.join(__dirname, 'db'))) fs.mkdirSync(path.join(__dirname, 'db'));

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    employee_id INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    pos TEXT,
    dept TEXT,
    type TEXT DEFAULT 'Regular',
    start TEXT,
    bank TEXT,
    email TEXT,
    mobile TEXT,
    emergency TEXT,
    address TEXT,
    tin TEXT,
    smb REAL DEFAULT 0,
    sss REAL DEFAULT 0,
    phic REAL DEFAULT 0,
    hdmf REAL DEFAULT 0,
    mpl REAL DEFAULT 0,
    dm REAL DEFAULT 0,
    load REAL DEFAULT 0,
    wht REAL DEFAULT 0,
    vl_bal REAL DEFAULT 15,
    sl_bal REAL DEFAULT 15,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    period TEXT NOT NULL,
    days REAL DEFAULT 0,
    ot REAL DEFAULT 0,
    ot_nd REAL DEFAULT 0,
    rest_day REAL DEFAULT 0,
    holiday REAL DEFAULT 0,
    leave_pay REAL DEFAULT 0,
    commission REAL DEFAULT 0,
    other_add REAL DEFAULT 0,
    other_ded REAL DEFAULT 0,
    late REAL DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(employee_id, period),
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS time_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    log_date TEXT NOT NULL,
    time_in TEXT,
    lunch_out TEXT,
    lunch_in TEXT,
    merienda_out TEXT,
    merienda_in TEXT,
    time_out TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS leave_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    type TEXT,
    from_date TEXT,
    to_date TEXT,
    days REAL DEFAULT 0,
    reason TEXT,
    status TEXT DEFAULT 'Pending',
    pay TEXT DEFAULT 'With Pay',
    filed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS perf_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    period TEXT,
    evaluator TEXT,
    job_score TEXT,
    att_score TEXT,
    team_score TEXT,
    init_score TEXT,
    overall TEXT,
    remarks TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS disc_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    incident_date TEXT,
    type TEXT,
    level TEXT,
    sanction TEXT,
    status TEXT DEFAULT 'Open',
    details TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS payslip_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    period TEXT NOT NULL,
    pdate TEXT,
    sent_at TEXT DEFAULT (datetime('now')),
    email_sent_to TEXT,
    basic_pay REAL,
    total_earnings REAL,
    total_deductions REAL,
    net_pay REAL,
    attendance_snapshot TEXT,
    employee_snapshot TEXT,
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS supervisor_subordinates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supervisor_user_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    UNIQUE(supervisor_user_id, employee_id),
    FOREIGN KEY(supervisor_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(employee_id) REFERENCES employees(id) ON DELETE CASCADE
  );
`);

// Seed default admin account if no users exist
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get();
if (userCount.c === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare("INSERT INTO users (username, password, role) VALUES (?, ?, 'admin')").run('admin', hash);
  console.log('✅ Default admin created: username=admin, password=admin123');
}

// Seed default settings
const settingCount = db.prepare('SELECT COUNT(*) as c FROM settings').get();
if (settingCount.c === 0) {
  const defaults = {
    co_name: 'HMB Management Consultant',
    co_tin: '126-757-146-000',
    co_addr1: '21 B1 L5 Sta. Ana St',
    co_addr2: 'Pacita 1B, San Pedro, Laguna',
    co_prep: 'KMD. GRASPARIL',
    co_appr: 'KKM. BUÑAG',
    ejs_svc: '',
    ejs_tpl: '',
    ejs_key: ''
  };
  const ins = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(defaults)) ins.run(k, v);
}

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'hmb-hris-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 hours
}));
app.use(express.static(path.join(__dirname, 'public')));

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not authenticated' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  next();
}
function requireAdminOrSupervisor(req, res, next) {
  if (!req.session.user || !['admin','supervisor'].includes(req.session.user.role)) return res.status(403).json({ error: 'Not authorized' });
  next();
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.json({ success: false, error: 'Invalid username or password' });
  }
  req.session.user = { id: user.id, username: user.username, role: user.role, employee_id: user.employee_id };
  res.json({ success: true, role: user.role, username: user.username });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json(req.session.user);
});

// ─── USER MANAGEMENT (Admin) ──────────────────────────────────────────────────
app.get('/api/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, role, employee_id, created_at FROM users').all();
  res.json(users);
});

app.post('/api/users', requireAdmin, (req, res) => {
  const { username, password, role, employee_id } = req.body;
  if (!username || !password) return res.json({ success: false, error: 'Username and password required' });
  const hash = bcrypt.hashSync(password, 10);
  try {
    db.prepare('INSERT INTO users (username, password, role, employee_id) VALUES (?, ?, ?, ?)').run(username, hash, role || 'employee', employee_id || null);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: 'Username already exists' });
  }
});

app.put('/api/users/:id/password', requireAdmin, (req, res) => {
  const { password } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, req.params.id);
  res.json({ success: true });
});

app.delete('/api/users/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── SUPERVISOR: SUBORDINATE MANAGEMENT (Admin assigns) ───────────────────────
// Get all subordinates for a supervisor user
app.get('/api/supervisor/:userId/subordinates', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT ss.id, ss.employee_id, e.name, e.pos, e.dept
    FROM supervisor_subordinates ss
    JOIN employees e ON ss.employee_id = e.id
    WHERE ss.supervisor_user_id = ? AND e.active = 1
    ORDER BY e.name
  `).all(req.params.userId);
  res.json(rows);
});

// Add a subordinate to a supervisor
app.post('/api/supervisor/:userId/subordinates', requireAdmin, (req, res) => {
  const { employee_id } = req.body;
  try {
    db.prepare('INSERT INTO supervisor_subordinates (supervisor_user_id, employee_id) VALUES (?,?)').run(req.params.userId, employee_id);
    res.json({ success: true });
  } catch(e) {
    res.json({ success: false, error: 'Already assigned' });
  }
});

// Remove a subordinate from a supervisor
app.delete('/api/supervisor/:userId/subordinates/:empId', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM supervisor_subordinates WHERE supervisor_user_id=? AND employee_id=?').run(req.params.userId, req.params.empId);
  res.json({ success: true });
});

// ─── SUPERVISOR: GET THEIR OWN SUBORDINATE LIST ────────────────────────────────
app.get('/api/my/subordinates', requireAdminOrSupervisor, (req, res) => {
  if (req.session.user.role === 'admin') {
    // Admin sees all employees
    const emps = db.prepare('SELECT * FROM employees WHERE active=1 ORDER BY name').all();
    return res.json(emps.map(mapEmployee));
  }
  const rows = db.prepare(`
    SELECT e.* FROM supervisor_subordinates ss
    JOIN employees e ON ss.employee_id = e.id
    WHERE ss.supervisor_user_id = ? AND e.active = 1
    ORDER BY e.name
  `).all(req.session.user.id);
  res.json(rows.map(mapEmployee));
});

// ─── SUPERVISOR: GET LEAVES OF SUBORDINATES ────────────────────────────────────
app.get('/api/my/leaves', requireAdminOrSupervisor, (req, res) => {
  let empIds;
  if (req.session.user.role === 'admin') {
    empIds = db.prepare('SELECT id FROM employees WHERE active=1').all().map(e => e.id);
  } else {
    empIds = db.prepare('SELECT employee_id FROM supervisor_subordinates WHERE supervisor_user_id=?').all(req.session.user.id).map(r => r.employee_id);
  }
  if (!empIds.length) return res.json([]);
  const placeholders = empIds.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT l.*, e.name as emp_name, e.pos as emp_pos, e.dept as emp_dept
    FROM leave_records l JOIN employees e ON l.employee_id=e.id
    WHERE l.employee_id IN (${placeholders})
    ORDER BY l.filed_at DESC
  `).all(...empIds);
  res.json(rows.map(r => ({
    id: r.id, empId: r.employee_id, empName: r.emp_name, empPos: r.emp_pos, empDept: r.emp_dept,
    type: r.type, from: r.from_date, to: r.to_date, days: r.days,
    reason: r.reason, status: r.status, pay: r.pay, filedAt: r.filed_at
  })));
});

// ─── SUPERVISOR: APPROVE / DENY LEAVE ─────────────────────────────────────────
app.put('/api/my/leaves/:id', requireAdminOrSupervisor, (req, res) => {
  const { status, remarks } = req.body;
  if (!['Approved','Denied'].includes(status)) return res.json({ success: false, error: 'Invalid status' });

  // Verify this leave belongs to one of their subordinates (skip for admin)
  const rec = db.prepare('SELECT * FROM leave_records WHERE id=?').get(req.params.id);
  if (!rec) return res.json({ success: false, error: 'Leave record not found' });

  if (req.session.user.role !== 'admin') {
    const isSub = db.prepare('SELECT id FROM supervisor_subordinates WHERE supervisor_user_id=? AND employee_id=?').get(req.session.user.id, rec.employee_id);
    if (!isSub) return res.status(403).json({ success: false, error: 'Not your subordinate' });
  }

  db.prepare('UPDATE leave_records SET status=? WHERE id=?').run(status, req.params.id);

  // Deduct leave balance when approved with pay
  if (status === 'Approved' && rec.pay === 'With Pay') {
    if (rec.type.includes('VL') || rec.type.includes('Vacation'))
      db.prepare('UPDATE employees SET vl_bal=MAX(0,vl_bal-?) WHERE id=?').run(rec.days, rec.employee_id);
    else if (rec.type.includes('SL') || rec.type.includes('Sick'))
      db.prepare('UPDATE employees SET sl_bal=MAX(0,sl_bal-?) WHERE id=?').run(rec.days, rec.employee_id);
  }
  res.json({ success: true });
});

// ─── EMPLOYEES ────────────────────────────────────────────────────────────────
app.get('/api/employees', requireAuth, (req, res) => {
  const emps = db.prepare('SELECT * FROM employees WHERE active = 1 ORDER BY name').all();
  res.json(emps.map(mapEmployee));
});

app.post('/api/employees', requireAdmin, (req, res) => {
  const e = req.body;
  const r = db.prepare(`INSERT INTO employees (name,pos,dept,type,start,bank,email,mobile,emergency,address,tin,smb,sss,phic,hdmf,mpl,dm,load,wht,vl_bal,sl_bal)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    e.name,e.pos||'',e.dept||'',e.type||'Regular',e.start||'',e.bank||'',e.email||'',e.mobile||'',e.emergency||'',e.address||'',e.tin||'',
    +e.smb||0,+e.sss||0,+e.phic||0,+e.hdmf||0,+e.mpl||0,+e.dm||0,+e.load||0,+e.wht||0,+e.vlBal||15,+e.slBal||15
  );
  res.json({ success: true, id: r.lastInsertRowid });
});

app.put('/api/employees/:id', requireAdmin, (req, res) => {
  const e = req.body;
  db.prepare(`UPDATE employees SET name=?,pos=?,dept=?,type=?,start=?,bank=?,email=?,mobile=?,emergency=?,address=?,tin=?,
    smb=?,sss=?,phic=?,hdmf=?,mpl=?,dm=?,load=?,wht=?,vl_bal=?,sl_bal=? WHERE id=?`).run(
    e.name,e.pos||'',e.dept||'',e.type||'Regular',e.start||'',e.bank||'',e.email||'',e.mobile||'',e.emergency||'',e.address||'',e.tin||'',
    +e.smb||0,+e.sss||0,+e.phic||0,+e.hdmf||0,+e.mpl||0,+e.dm||0,+e.load||0,+e.wht||0,+e.vlBal||15,+e.slBal||15, req.params.id
  );
  res.json({ success: true });
});

app.delete('/api/employees/:id', requireAdmin, (req, res) => {
  db.prepare('UPDATE employees SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

function mapEmployee(e) {
  return {
    id: e.id, name: e.name, pos: e.pos, dept: e.dept, type: e.type,
    start: e.start, bank: e.bank, email: e.email, mobile: e.mobile,
    emergency: e.emergency, address: e.address, tin: e.tin,
    smb: e.smb, sss: e.sss, phic: e.phic, hdmf: e.hdmf, mpl: e.mpl,
    dm: e.dm, load: e.load, wht: e.wht, vlBal: e.vl_bal, slBal: e.sl_bal, active: e.active
  };
}

// ─── ATTENDANCE / PAYROLL ──────────────────────────────────────────────────────
app.get('/api/attendance', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM attendance').all();
  // Convert to nested object format { period: { empId: {...} } }
  const result = {};
  for (const r of rows) {
    if (!result[r.period]) result[r.period] = {};
    result[r.period][r.employee_id] = {
      days: r.days, ot: r.ot, otNd: r.ot_nd, restDay: r.rest_day,
      holiday: r.holiday, leave: r.leave_pay, commission: r.commission,
      otherAdd: r.other_add, otherDed: r.other_ded, late: r.late
    };
  }
  res.json(result);
});

app.post('/api/attendance', requireAdmin, (req, res) => {
  const { period, records } = req.body; // records: { empId: {...} }
  const upsert = db.prepare(`INSERT INTO attendance (employee_id, period, days, ot, ot_nd, rest_day, holiday, leave_pay, commission, other_add, other_ded, late, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(employee_id, period) DO UPDATE SET
    days=excluded.days, ot=excluded.ot, ot_nd=excluded.ot_nd, rest_day=excluded.rest_day,
    holiday=excluded.holiday, leave_pay=excluded.leave_pay, commission=excluded.commission,
    other_add=excluded.other_add, other_ded=excluded.other_ded, late=excluded.late, updated_at=datetime('now')`);
  const saveAll = db.transaction((recs) => {
    for (const [empId, a] of Object.entries(recs)) {
      upsert.run(+empId, period, +a.days||0, +a.ot||0, +a.otNd||0, +a.restDay||0, +a.holiday||0, +a.leave||0, +a.commission||0, +a.otherAdd||0, +a.otherDed||0, +a.late||0);
    }
  });
  saveAll(records);
  res.json({ success: true });
});

// Migrate existing time_logs table — add break columns if missing
try {
  db.exec(`ALTER TABLE time_logs ADD COLUMN lunch_out TEXT`);
} catch(e) {}
try {
  db.exec(`ALTER TABLE time_logs ADD COLUMN lunch_in TEXT`);
} catch(e) {}
try {
  db.exec(`ALTER TABLE time_logs ADD COLUMN merienda_out TEXT`);
} catch(e) {}
try {
  db.exec(`ALTER TABLE time_logs ADD COLUMN merienda_in TEXT`);
} catch(e) {}

// ─── TIME LOGS ────────────────────────────────────────────────────────────────
// Get logs — admin gets all with filters, employees/supervisors get their own
app.get('/api/timelogs', requireAuth, (req, res) => {
  let rows;
  if (req.session.user.role === 'admin') {
    const { employee_id, from, to } = req.query;
    let q = 'SELECT t.*, e.name as emp_name FROM time_logs t JOIN employees e ON t.employee_id=e.id WHERE 1=1';
    const params = [];
    if (employee_id) { q += ' AND t.employee_id=?'; params.push(employee_id); }
    if (from) { q += ' AND t.log_date>=?'; params.push(from); }
    if (to) { q += ' AND t.log_date<=?'; params.push(to); }
    q += ' ORDER BY t.log_date DESC, t.id ASC';
    rows = db.prepare(q).all(...params);
  } else {
    const empId = req.session.user.employee_id;
    if (!empId) return res.json([]);
    rows = db.prepare('SELECT t.*, e.name as emp_name FROM time_logs t JOIN employees e ON t.employee_id=e.id WHERE t.employee_id=? ORDER BY t.log_date DESC, t.id ASC LIMIT 60').all(empId);
  }
  res.json(rows);
});

// Helper: get today's active punch row (no time_out yet)
function getTodayRow(empId) {
  const today = new Date().toISOString().slice(0, 10);
  return { today, row: db.prepare('SELECT * FROM time_logs WHERE employee_id=? AND log_date=? ORDER BY id DESC LIMIT 1').get(empId, today) };
}
function nowPH() {
  return new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}

// TIME IN — always creates a new row for the day
app.post('/api/timelogs/timein', requireAuth, (req, res) => {
  const empId = req.session.user.employee_id;
  if (!empId) return res.json({ success: false, error: 'No employee linked to account' });
  const { today, row } = getTodayRow(empId);
  // If there's already an unfinished row, block
  if (row && !row.time_out) {
    return res.json({ success: false, error: 'Already timed in. Please time out first.' });
  }
  const now = nowPH();
  db.prepare('INSERT INTO time_logs (employee_id, log_date, time_in) VALUES (?,?,?)').run(empId, today, now);
  res.json({ success: true, time: now });
});

// LUNCH OUT
app.post('/api/timelogs/lunch-out', requireAuth, (req, res) => {
  const empId = req.session.user.employee_id;
  if (!empId) return res.json({ success: false, error: 'No employee linked to account' });
  const { row } = getTodayRow(empId);
  if (!row || !row.time_in || row.time_out) return res.json({ success: false, error: 'No active shift found.' });
  if (row.lunch_out) return res.json({ success: false, error: 'Lunch Out already recorded.' });
  const now = nowPH();
  db.prepare('UPDATE time_logs SET lunch_out=? WHERE id=?').run(now, row.id);
  res.json({ success: true, time: now });
});

// LUNCH IN
app.post('/api/timelogs/lunch-in', requireAuth, (req, res) => {
  const empId = req.session.user.employee_id;
  if (!empId) return res.json({ success: false, error: 'No employee linked to account' });
  const { row } = getTodayRow(empId);
  if (!row || !row.lunch_out) return res.json({ success: false, error: 'No Lunch Out recorded yet.' });
  if (row.lunch_in) return res.json({ success: false, error: 'Lunch In already recorded.' });
  const now = nowPH();
  db.prepare('UPDATE time_logs SET lunch_in=? WHERE id=?').run(now, row.id);
  res.json({ success: true, time: now });
});

// MERIENDA OUT
app.post('/api/timelogs/merienda-out', requireAuth, (req, res) => {
  const empId = req.session.user.employee_id;
  if (!empId) return res.json({ success: false, error: 'No employee linked to account' });
  const { row } = getTodayRow(empId);
  if (!row || !row.time_in || row.time_out) return res.json({ success: false, error: 'No active shift found.' });
  if (row.merienda_out) return res.json({ success: false, error: 'Merienda Out already recorded.' });
  const now = nowPH();
  db.prepare('UPDATE time_logs SET merienda_out=? WHERE id=?').run(now, row.id);
  res.json({ success: true, time: now });
});

// MERIENDA IN
app.post('/api/timelogs/merienda-in', requireAuth, (req, res) => {
  const empId = req.session.user.employee_id;
  if (!empId) return res.json({ success: false, error: 'No employee linked to account' });
  const { row } = getTodayRow(empId);
  if (!row || !row.merienda_out) return res.json({ success: false, error: 'No Merienda Out recorded yet.' });
  if (row.merienda_in) return res.json({ success: false, error: 'Merienda In already recorded.' });
  const now = nowPH();
  db.prepare('UPDATE time_logs SET merienda_in=? WHERE id=?').run(now, row.id);
  res.json({ success: true, time: now });
});

// TIME OUT
app.post('/api/timelogs/timeout', requireAuth, (req, res) => {
  const empId = req.session.user.employee_id;
  if (!empId) return res.json({ success: false, error: 'No employee linked to account' });
  const { row } = getTodayRow(empId);
  if (!row || !row.time_in) return res.json({ success: false, error: 'No active time-in found for today.' });
  if (row.time_out) return res.json({ success: false, error: 'Already timed out for today.' });
  const now = nowPH();
  db.prepare('UPDATE time_logs SET time_out=? WHERE id=?').run(now, row.id);
  res.json({ success: true, time: now });
});

// STATUS — returns full punch state for today
app.get('/api/timelogs/status', requireAuth, (req, res) => {
  const empId = req.session.user.employee_id;
  if (!empId) return res.json({ timeIn: null, lunchOut: null, lunchIn: null, meriendaOut: null, meriendaIn: null, timeOut: null });
  const today = new Date().toISOString().slice(0, 10);
  // Get the LATEST row for today
  const row = db.prepare('SELECT * FROM time_logs WHERE employee_id=? AND log_date=? ORDER BY id DESC LIMIT 1').get(empId, today);
  if (!row) return res.json({ timeIn: null, lunchOut: null, lunchIn: null, meriendaOut: null, meriendaIn: null, timeOut: null });
  res.json({
    timeIn:      row.time_in      || null,
    lunchOut:    row.lunch_out    || null,
    lunchIn:     row.lunch_in     || null,
    meriendaOut: row.merienda_out || null,
    meriendaIn:  row.merienda_in  || null,
    timeOut:     row.time_out     || null
  });
});

// ─── LEAVE ────────────────────────────────────────────────────────────────────
app.get('/api/leave', requireAuth, (req, res) => {
  const role = req.session.user.role;
  // Admin: all leaves
  if (role === 'admin') {
    const rows = db.prepare('SELECT l.*, e.name as emp_name FROM leave_records l JOIN employees e ON l.employee_id=e.id ORDER BY l.filed_at DESC').all();
    return res.json(rows.map(r => ({ id: r.id, empId: r.employee_id, empName: r.emp_name, type: r.type, from: r.from_date, to: r.to_date, days: r.days, reason: r.reason, status: r.status, pay: r.pay, filedAt: r.filed_at })));
  }
  // Employee/Supervisor: only their own leaves
  const empId = req.session.user.employee_id;
  if (!empId) return res.json([]);
  const rows = db.prepare('SELECT l.*, e.name as emp_name FROM leave_records l JOIN employees e ON l.employee_id=e.id WHERE l.employee_id=? ORDER BY l.filed_at DESC').all(empId);
  return res.json(rows.map(r => ({ id: r.id, empId: r.employee_id, empName: r.emp_name, type: r.type, from: r.from_date, to: r.to_date, days: r.days, reason: r.reason, status: r.status, pay: r.pay, filedAt: r.filed_at })));
});

// Employee self-service: file own leave (status always Pending)
app.post('/api/leave/file', requireAuth, (req, res) => {
  const empId = req.session.user.employee_id;
  if (!empId) return res.json({ success: false, error: 'No employee linked to account' });
  const l = req.body;
  if (!l.from || !l.to) return res.json({ success: false, error: 'Date from and to are required' });
  const r = db.prepare('INSERT INTO leave_records (employee_id, type, from_date, to_date, days, reason, status, pay) VALUES (?,?,?,?,?,?,?,?)').run(empId, l.type, l.from, l.to, +l.days||0, l.reason||'', 'Pending', 'With Pay');
  res.json({ success: true, id: r.lastInsertRowid });
});

// Employee self-service: cancel own pending leave
app.delete('/api/leave/mine/:id', requireAuth, (req, res) => {
  const empId = req.session.user.employee_id;
  if (!empId) return res.json({ success: false, error: 'No employee linked to account' });
  const rec = db.prepare('SELECT * FROM leave_records WHERE id=? AND employee_id=?').get(req.params.id, empId);
  if (!rec) return res.json({ success: false, error: 'Record not found' });
  if (rec.status !== 'Pending') return res.json({ success: false, error: 'Only pending leaves can be cancelled' });
  db.prepare('DELETE FROM leave_records WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// Employee self-service: get own leave balance
app.get('/api/leave/balance', requireAuth, (req, res) => {
  const empId = req.session.user.employee_id;
  if (!empId) return res.json({ vlBal: 0, slBal: 0 });
  const emp = db.prepare('SELECT vl_bal, sl_bal FROM employees WHERE id=?').get(empId);
  if (!emp) return res.json({ vlBal: 0, slBal: 0 });
  res.json({ vlBal: emp.vl_bal, slBal: emp.sl_bal });
});


app.post('/api/leave', requireAdmin, (req, res) => {
  const l = req.body;
  const r = db.prepare('INSERT INTO leave_records (employee_id, type, from_date, to_date, days, reason, status, pay) VALUES (?,?,?,?,?,?,?,?)').run(l.empId, l.type, l.from, l.to, +l.days||0, l.reason||'', l.status||'Pending', l.pay||'With Pay');
  // Deduct balance if approved
  if (l.status === 'Approved' && l.pay === 'With Pay') {
    const e = db.prepare('SELECT * FROM employees WHERE id=?').get(l.empId);
    if (e) {
      if (l.type.includes('VL') || l.type.includes('Vacation')) db.prepare('UPDATE employees SET vl_bal=MAX(0,vl_bal-?) WHERE id=?').run(+l.days, l.empId);
      else if (l.type.includes('SL') || l.type.includes('Sick')) db.prepare('UPDATE employees SET sl_bal=MAX(0,sl_bal-?) WHERE id=?').run(+l.days, l.empId);
    }
  }
  res.json({ success: true, id: r.lastInsertRowid });
});

app.put('/api/leave/:id', requireAdminOrSupervisor, (req, res) => {
  const { status } = req.body;
  const rec = db.prepare('SELECT * FROM leave_records WHERE id=?').get(req.params.id);
  if (!rec) return res.json({ success: false, error: 'Not found' });
  // Supervisor can only update their own subordinates' leaves
  if (req.session.user.role === 'supervisor') {
    const isSub = db.prepare('SELECT id FROM supervisor_subordinates WHERE supervisor_user_id=? AND employee_id=?').get(req.session.user.id, rec.employee_id);
    if (!isSub) return res.status(403).json({ success: false, error: 'Not your subordinate' });
  }
  db.prepare('UPDATE leave_records SET status=? WHERE id=?').run(status, req.params.id);
  // Deduct balance if approved
  if (status === 'Approved' && rec.pay === 'With Pay') {
    if (rec.type.includes('VL') || rec.type.includes('Vacation')) db.prepare('UPDATE employees SET vl_bal=MAX(0,vl_bal-?) WHERE id=?').run(rec.days, rec.employee_id);
    else if (rec.type.includes('SL') || rec.type.includes('Sick')) db.prepare('UPDATE employees SET sl_bal=MAX(0,sl_bal-?) WHERE id=?').run(rec.days, rec.employee_id);
  }
  res.json({ success: true });
});

app.delete('/api/leave/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM leave_records WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ─── PERFORMANCE ──────────────────────────────────────────────────────────────
app.get('/api/performance', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT p.*, e.name as emp_name FROM perf_records p JOIN employees e ON p.employee_id=e.id ORDER BY p.created_at DESC').all();
  res.json(rows.map(r => ({ id: r.id, empId: r.employee_id, empName: r.emp_name, period: r.period, evaluator: r.evaluator, jobScore: r.job_score, attScore: r.att_score, teamScore: r.team_score, initScore: r.init_score, overall: r.overall, remarks: r.remarks })));
});

app.post('/api/performance', requireAdmin, (req, res) => {
  const p = req.body;
  const r = db.prepare('INSERT INTO perf_records (employee_id, period, evaluator, job_score, att_score, team_score, init_score, overall, remarks) VALUES (?,?,?,?,?,?,?,?,?)').run(p.empId, p.period, p.evaluator, p.jobScore, p.attScore, p.teamScore, p.initScore, p.overall, p.remarks||'');
  res.json({ success: true, id: r.lastInsertRowid });
});

app.delete('/api/performance/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM perf_records WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ─── DISCIPLINARY ─────────────────────────────────────────────────────────────
app.get('/api/disciplinary', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT d.*, e.name as emp_name FROM disc_records d JOIN employees e ON d.employee_id=e.id ORDER BY d.created_at DESC').all();
  res.json(rows.map(r => ({ id: r.id, empId: r.employee_id, empName: r.emp_name, date: r.incident_date, type: r.type, level: r.level, sanction: r.sanction, status: r.status, details: r.details, createdAt: r.created_at })));
});

app.post('/api/disciplinary', requireAdmin, (req, res) => {
  const d = req.body;
  const r = db.prepare('INSERT INTO disc_records (employee_id, incident_date, type, level, sanction, status, details) VALUES (?,?,?,?,?,?,?)').run(d.empId, d.date, d.type, d.level, d.sanction, d.status||'Open', d.details||'');
  res.json({ success: true, id: r.lastInsertRowid });
});

app.put('/api/disciplinary/:id', requireAdmin, (req, res) => {
  db.prepare('UPDATE disc_records SET status=? WHERE id=?').run(req.body.status, req.params.id);
  res.json({ success: true });
});

app.delete('/api/disciplinary/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM disc_records WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ─── PAYSLIP HISTORY ─────────────────────────────────────────────────────────
app.get('/api/payslips', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM payslip_history ORDER BY sent_at DESC').all();
  res.json(rows.map(r => ({
    id: r.id, empId: r.employee_id, empName: JSON.parse(r.employee_snapshot||'{}').name || '', empPos: JSON.parse(r.employee_snapshot||'{}').pos || '',
    period: r.period, pdate: r.pdate, sentAt: r.sent_at, emailSentTo: r.email_sent_to,
    basicPay: r.basic_pay, totalEarnings: r.total_earnings, totalDeductions: r.total_deductions, netPay: r.net_pay,
    attendance: JSON.parse(r.attendance_snapshot||'{}'), employeeSnapshot: JSON.parse(r.employee_snapshot||'{}')
  })));
});

// Employee: view own payslips
app.get('/api/payslips/mine', requireAuth, (req, res) => {
  const empId = req.session.user.employee_id;
  if (!empId) return res.json([]);
  const rows = db.prepare('SELECT * FROM payslip_history WHERE employee_id=? ORDER BY sent_at DESC').all(empId);
  res.json(rows.map(r => ({
    id: r.id, empId: r.employee_id,
    period: r.period, pdate: r.pdate, sentAt: r.sent_at,
    basicPay: r.basic_pay, totalEarnings: r.total_earnings, totalDeductions: r.total_deductions, netPay: r.net_pay,
    attendance: JSON.parse(r.attendance_snapshot||'{}'), employeeSnapshot: JSON.parse(r.employee_snapshot||'{}')
  })));
});

app.post('/api/payslips', requireAdmin, (req, res) => {
  const h = req.body;
  db.prepare(`INSERT INTO payslip_history (employee_id, period, pdate, sent_at, email_sent_to, basic_pay, total_earnings, total_deductions, net_pay, attendance_snapshot, employee_snapshot)
    VALUES (?,?,?,datetime('now'),?,?,?,?,?,?,?)
    ON CONFLICT DO NOTHING`).run(h.empId, h.period, h.pdate, h.emailSentTo, h.basicPay, h.totalEarnings, h.totalDeductions, h.netPay, JSON.stringify(h.attendance), JSON.stringify(h.employeeSnapshot));
  res.json({ success: true });
});

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
app.get('/api/settings', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const obj = {};
  rows.forEach(r => obj[r.key] = r.value);
  res.json(obj);
});

app.post('/api/settings', requireAdmin, (req, res) => {
  const ins = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  const saveAll = db.transaction((data) => {
    for (const [k, v] of Object.entries(data)) ins.run(k, v);
  });
  saveAll(req.body);
  res.json({ success: true });
});

// ─── FULL DATA EXPORT ─────────────────────────────────────────────────────────
app.get('/api/export', requireAdmin, (req, res) => {
  const data = {
    employees: db.prepare('SELECT * FROM employees').all().map(mapEmployee),
    attendance: (() => {
      const rows = db.prepare('SELECT * FROM attendance').all();
      const r = {};
      for (const a of rows) {
        if (!r[a.period]) r[a.period] = {};
        r[a.period][a.employee_id] = { days: a.days, ot: a.ot, otNd: a.ot_nd, restDay: a.rest_day, holiday: a.holiday, leave: a.leave_pay, commission: a.commission, otherAdd: a.other_add, otherDed: a.other_ded, late: a.late };
      }
      return r;
    })(),
    leaveRecords: db.prepare('SELECT * FROM leave_records').all(),
    perfRecords: db.prepare('SELECT * FROM perf_records').all(),
    discRecords: db.prepare('SELECT * FROM disc_records').all(),
    payslipHistory: db.prepare('SELECT * FROM payslip_history').all(),
    settings: (() => { const r = {}; db.prepare('SELECT * FROM settings').all().forEach(s => r[s.key] = s.value); return r; })()
  };
  res.setHeader('Content-Disposition', `attachment; filename=HMB_HRIS_Backup_${new Date().toISOString().slice(0,10)}.json`);
  res.json(data);
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 HMB HRIS Server running on http://localhost:${PORT}`);
  console.log(`📁 Database: ${dbPath}`);
  console.log(`👤 Default admin login: admin / admin123\n`);
});
