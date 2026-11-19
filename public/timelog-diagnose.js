#!/usr/bin/env node
'use strict';
// READ-ONLY report: for one employee and a date range, shows what the Time Logs screen would show for every day and STATES THE REASON
// whenever a day may look inaccurate. It applies the same rules as the admin Time Logs screen (same shift lookup, same late/undertime
// maths, same Absent / Leave / Holiday / Rest-day logic). It never changes anything.
//
//   node scripts/timelog-diagnose.js --employee "gerald villanueva" --from 2026-11-01 --to 2026-11-15
//   node scripts/timelog-diagnose.js --id 12 --from 2026-11-01 --to 2026-11-15
// Environment: DB_PATH (default <app>/db/hris.db)
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const root = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
const nameQ = opt('employee'), idQ = opt('id'), from = opt('from'), to = opt('to');
const DATE = /^\d{4}-\d{2}-\d{2}$/;
if ((!nameQ && !idQ) || !DATE.test(from || '') || !DATE.test(to || '') || from > to) {
  console.error('Usage: node scripts/timelog-diagnose.js --employee "first last" --from YYYY-MM-DD --to YYYY-MM-DD   (or --id N)'); process.exit(1);
}
const dbPath = process.env.DB_PATH || path.join(root, 'db', 'hris.db');
if (!fs.existsSync(dbPath)) { console.error('❌ Database not found: ' + dbPath); process.exit(1); }
const db = new Database(dbPath, { readonly: true, fileMustExist: true });
const today = opt('today') || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

// ── the same rules as the admin Time Logs screen ──────────────────────────────────────────────────────────────────────────────────────
const LUNCH_START_MIN = 12 * 60, LUNCH_LEN_MIN = 60, MERIENDA_LIMIT_MIN = 30;
function toMin(str) {
  if (!str) return null; str = String(str).trim();
  const m = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?$/); if (!m) return null;
  let h = parseInt(m[1], 10); const min = parseInt(m[2], 10), ap = m[4] && m[4].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12; if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}
const overlap = (a1, a2, b1, b2) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
function lunchWindow(startMin, dur) { for (let k = -1; k <= 1; k++) { const s = LUNCH_START_MIN + 1440 * k, e = s + LUNCH_LEN_MIN; if (s > startMin && e <= startMin + dur) return [s, e]; } return null; }
function lateMin(timeIn, start, end) {
  const ti = toMin(timeIn), st = toMin(start); if (ti == null || st == null) return 0;
  const el = (ti - st + 1440) % 1440; if (el > 720 || el === 0) return 0;
  const en = end ? toMin(end) : null, dur = en != null ? ((en - st + 1440) % 1440 || 1440) : 1440, lw = lunchWindow(st, dur);
  return lw ? Math.max(0, el - overlap(st, st + el, lw[0], lw[1])) : el;
}
function underMin(timeOut, end, start) {
  const to = toMin(timeOut), en = toMin(end); if (to == null || en == null) return 0;
  const st = start ? toMin(start) : null;
  if (st != null) {
    let dur = (en - st + 1440) % 1440; if (dur === 0) dur = 1440;
    const out = (to - st + 1440) % 1440, diff = dur - out; if (diff <= 0) return 0;
    const lw = lunchWindow(st, dur); return lw ? Math.max(0, diff - overlap(st + out, st + dur, lw[0], lw[1])) : diff;
  }
  const diff = en - to; return diff <= 0 ? 0 : diff;
}
// HALF-DAY LEAVE (same rule as the Time Logs screen): she is only expected for ONE half of the shift. The leave does not say which half, so it is
// read from the punches: in at/after the break starts = worked the afternoon (late counts from the END of the break); out by the end of the
// break = worked the morning (undertime counts from the START of the break); anything else is measured as a normal full day.
function lateUnderForDay(timeIn, timeOut, start, end, halfDay) {
  let late = lateMin(timeIn, start, end), under = underMin(timeOut, end, start), half = null;
  if (!halfDay) return { late, under, half };
  const s = toMin(start), e = toMin(end), ti = toMin(timeIn), to = toMin(timeOut);
  if (s == null || e == null) return { late, under, half };
  const dur = (e - s + 1440) % 1440 || 1440, lw = lunchWindow(s, dur);
  const bs = lw ? lw[0] - s : Math.round(dur / 2), be = lw ? lw[1] - s : Math.round(dur / 2);
  let tiEl = ti == null ? null : (ti - s + 1440) % 1440; if (tiEl != null && tiEl > 720) tiEl -= 1440;
  const toEl = to == null ? null : (to - s + 1440) % 1440;
  if (tiEl != null && tiEl >= bs) { half = 'PM'; late = Math.max(0, tiEl - be); }
  else if (toEl != null && toEl <= be && (tiEl == null || toEl >= tiEl)) { half = 'AM'; under = Math.max(0, bs - toEl); }
  return { late, under, half };
}
const fmt = (m) => m > 0 ? (Math.floor(m / 60) ? Math.floor(m / 60) + 'h ' : '') + (m % 60 ? (m % 60) + 'm' : '') : '—';
const parseOverrides = (s) => { const map = {}; String(s || '').split(',').forEach(p => { const [d, sid] = p.split(':').map(x => parseInt(x, 10)); if (!isNaN(d) && !isNaN(sid)) map[d] = sid; }); return map; };

// ── find the employee ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
let emps;
if (idQ) emps = db.prepare('SELECT * FROM employees WHERE id = ?').all(+idQ);
else { const toks = nameQ.toLowerCase().split(/[\s,]+/).filter(Boolean); emps = db.prepare('SELECT * FROM employees').all().filter(e => toks.every(t => String(e.name || '').toLowerCase().includes(t))); }
if (!emps.length) { console.error('❌ No employee matches "' + (nameQ || idQ) + '". Check how the name is spelled in Employee Records, or use --id.'); process.exit(1); }
if (emps.length > 1) { console.error('More than one employee matches. Run again with --id:'); emps.forEach(e => console.error('   --id ' + e.id + '   ' + e.name + (e.active ? '' : ' (inactive)'))); process.exit(2); }
const emp = emps[0];

// ── data ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const shifts = db.prepare('SELECT * FROM shifts').all();
let holidays = []; try { const r = db.prepare("SELECT value FROM settings WHERE key = 'holidays_json'").get(); if (r) holidays = JSON.parse(r.value); } catch (e) { /* none */ }
const holidayOn = (d) => holidays.find(h => h.date === d);
const logs = db.prepare('SELECT * FROM time_logs WHERE employee_id = ? AND log_date BETWEEN ? AND ? ORDER BY log_date, id').all(emp.id, from, to);
let offsets = []; try { const r = db.prepare("SELECT value FROM settings WHERE key = 'offsets_json'").get(); if (r) offsets = JSON.parse(r.value); } catch (e) { /* none filed */ }
const offsetsOn = (ds) => offsets.filter(o => String(o.empId) === String(emp.id) && o.date === ds);
// The Time Logs screen takes an offset off LATE first, then off UNDERTIME — which is why Late can disappear while Undertime and an "offset" badge remain.
function applyOffset(late, under, off) { let applied = 0; if (off > 0) { const fl = Math.min(late, off); late -= fl; off -= fl; applied += fl; const fu = Math.min(under, off); under -= fu; off -= fu; applied += fu; } return { late, under, applied }; }
const leaves = db.prepare('SELECT * FROM leave_records WHERE employee_id = ? AND to_date >= ? AND from_date <= ?').all(emp.id, from, to);
const ovMap = parseOverrides(emp.shift_day_overrides), assigned = shifts.find(s => s.id === emp.shift_id);
let audit = []; try { audit = db.prepare("SELECT at, actor_name, action, route, details FROM audit_log WHERE route LIKE '/api/timelogs%' ORDER BY id").all(); } catch (e) { /* no audit log yet */ }
function shiftFor(dateStr) {
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  if (ovMap[dow] != null) { const s = shifts.find(x => x.id === ovMap[dow]); if (s) return { s, src: 'day override' }; }
  if (assigned) return { s: assigned, src: 'assigned' };
  return { s: { name: 'Default', start_time: '08:00', end_time: '17:00' }, src: 'NO SHIFT ASSIGNED — default' };
}
function editsOf(row) {
  const out = [];
  for (const a of audit) { let d; try { d = JSON.parse(a.details || '{}'); } catch (e) { d = {}; }
    if (a.route === '/api/timelogs/:id' && d.params && String(d.params.id) === String(row.id)) out.push(a);
    else if (a.route === '/api/timelogs' && d.input && String(d.input.employee_id) === String(emp.id)) out.push(a); }
  return out;
}

// ── the report ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const tally = {}; const flagDays = new Set(); let okDays = 0;
console.log(`\nTime-log check for ${emp.name}  (${from} → ${to})   [read-only]`);
console.log(`Shift on record: ${assigned ? assigned.name + ' ' + assigned.start_time + '–' + assigned.end_time : 'NONE — every day is measured against the default 08:00–17:00'}` + (Object.keys(ovMap).length ? '   Day overrides: ' + Object.entries(ovMap).map(([d, sid]) => WD[d] + ' → ' + ((shifts.find(s => s.id === sid) || {}).name || 'shift #' + sid + ' (missing!)')).join(', ') : '') + '\n');
const startD = new Date(from + 'T00:00:00'), endD = new Date(to + 'T00:00:00');
for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
  const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'), dow = d.getDay(), weekend = dow === 0 || dow === 6;
  const rows = logs.filter(r => r.log_date === ds), shown = rows.length ? rows[rows.length - 1] : null;     // the screen keeps the LAST row of the day (highest id)
  const approved = leaves.find(l => l.status === 'Approved' && ds >= l.from_date && ds <= l.to_date), otherLeave = leaves.filter(l => l.status !== 'Approved' && ds >= l.from_date && ds <= l.to_date);
  const hol = holidayOn(ds), { s: shift, src } = shiftFor(ds), sStart = shift.start_time, sEnd = shift.end_time;
  const why = [];
  const flag = (code, text) => { why.push([code, text]); tally[code] = (tally[code] || 0) + 1; };
  let line = `${WD[dow]} ${ds.slice(5)}  `;
  if (!shown) {
    const orphan = offsetsOn(ds); if (orphan.length) flag('OFFSET_UNUSED', `${orphan.reduce((a, o) => a + (+o.minutes || 0), 0)} minute(s) of offset are filed for this day, but there is no punch, so the offset has nothing to apply to.`);
    if (approved) line += `ON LEAVE (${approved.type}, ${approved.pay})`;
    else if (hol) line += `HOLIDAY (${hol.name || 'holiday'})`;
    else if (weekend) line += 'rest day';
    else { line += 'ABSENT'; flag('ABSENT', 'No punch and no Approved leave on a working day, so the screen counts him ABSENT.' + (otherLeave.length ? ' A leave exists but is not Approved: ' + otherLeave.map(l => '#' + l.id + ' ' + l.type + ' is ' + l.status).join('; ') + ' — it only counts once Approved.' : ' If he did work, the punch was never recorded: use "File Punch" on that day. If he was away, a leave must be filed and Approved.')); }
  } else {
    const lu = lateUnderForDay(shown.time_in, shown.time_out, sStart, sEnd, !!(approved && approved.half_day)), rawLate = lu.late, rawUnder = shown.time_out ? lu.under : 0;
    const offs = offsetsOn(ds), offTotal = offs.reduce((a, o) => a + (+o.minutes || 0), 0), ap = applyOffset(rawLate, rawUnder, offTotal);
    line += `IN ${shown.time_in || '—'}   OUT ${shown.time_out || '—'}   | ${sStart}–${sEnd} (${shift.name}, ${src.startsWith('NO SHIFT') ? 'DEFAULT' : src}) | late ${fmt(ap.late)}  undertime ${fmt(ap.under)}` + (lu.half ? `  [half-day leave: ${lu.half === 'PM' ? 'afternoon' : 'morning'} worked]` : '') + (ap.applied ? `  offset −${ap.applied}m` : '');
    if (offs.length) {
      const notes = offs.map(o => o.note).filter(Boolean).map(n => '"' + n + '"').join('; ');
      flag('OFFSET_APPLIED', `${offTotal} minute(s) of offset ${offs.length > 1 ? '(' + offs.length + ' records) ' : ''}are filed for this day${notes ? ' — note: ' + notes : ''}. The screen takes an offset off LATE first, then off UNDERTIME: late ${fmt(rawLate)} → ${fmt(ap.late)}, undertime ${fmt(rawUnder)} → ${fmt(ap.under)}.` + (rawLate > 0 && ap.late === 0 ? ' LATE IS NOT SHOWN because the offset fully covered it.' : '') + (offTotal > ap.applied ? ` ${offTotal - ap.applied} minute(s) of the offset were not needed.` : ''));
    }
    const ti = toMin(shown.time_in), to2 = toMin(shown.time_out);
    if (rows.length > 1) flag('MULTIPLE_ROWS', `${rows.length} rows exist for this day (ids ${rows.map(r => r.id).join(', ')}). The Time Logs screen shows only ONE of them (#${shown.id}, the newest) and hides the rest, so its times may not match what he actually did that day. Hidden: ` + rows.slice(0, -1).map(r => `#${r.id} IN ${r.time_in || '—'} OUT ${r.time_out || '—'}`).join('; ') + '.');
    if (!shown.time_in) flag('NO_TIME_IN', 'This row has no time-in (usually a manual entry or an interrupted punch), so late/undertime cannot be worked out.');
    if (shown.time_in && !shown.time_out) flag('NO_TIME_OUT', ds < today ? 'Time-in was recorded but he never clocked out (or the clock-out failed). No clock-out means undertime and hours cannot be computed.' : 'Still clocked in today.');
    if (ti != null && to2 != null && to2 < ti && !(toMin(sEnd) < toMin(sStart))) flag('OUT_BEFORE_IN', 'The time-out is EARLIER than the time-in on a normal day shift. This is usually a wrong AM/PM in a manual edit, or a punch saved on the wrong date.');
    const seq = [['time-in', shown.time_in], ['lunch-out', shown.lunch_out], ['lunch-in', shown.lunch_in], ['merienda-out', shown.merienda_out], ['merienda-in', shown.merienda_in], ['time-out', shown.time_out]].filter(x => toMin(x[1]) != null);
    const crosses = toMin(sEnd) < toMin(sStart); let broken = null; if (!crosses) for (let i = 1; i < seq.length && !broken; i++) if (toMin(seq[i][1]) < toMin(seq[i - 1][1])) broken = [seq[i - 1], seq[i]];
    if (broken && !(ti != null && to2 != null && to2 < ti)) flag('PUNCH_ORDER', `Punches are out of order: ${broken[1][0]} (${broken[1][1]}) is earlier than ${broken[0][0]} (${broken[0][1]}). One of them is probably wrong or was edited.`);
    if (!!shown.lunch_out !== !!shown.lunch_in) flag('LUNCH_OPEN', 'Lunch was started but not finished (or finished without a start): only one of lunch-out / lunch-in exists.');
    if (!!shown.merienda_out !== !!shown.merienda_in) flag('MERIENDA_OPEN', 'Merienda was started but not finished (or the reverse): only one of the two merienda punches exists.');
    else if (shown.merienda_out && shown.merienda_in) { const mm = toMin(shown.merienda_in) - toMin(shown.merienda_out); if (mm > MERIENDA_LIMIT_MIN) flag('MERIENDA_OVER', `Merienda lasted ${mm} minutes; the limit is ${MERIENDA_LIMIT_MIN}.`); }
    if (src.startsWith('NO SHIFT') && (lateMin(shown.time_in, sStart, sEnd) > 0 || (shown.time_out && underMin(shown.time_out, sEnd, sStart) > 0))) flag('DEFAULT_SHIFT', 'No shift is assigned to him, so late/undertime were measured against the DEFAULT 08:00–17:00. If his real hours are different, these numbers are wrong: assign his shift in Shift Management.');
    if (src === 'day override') flag('OVERRIDE_DAY', `A ${WD[dow]} override applies: measured against ${shift.name} (${sStart}–${sEnd}), not his usual shift.`);
    if (ti != null && toMin(sStart) != null) { const early = (toMin(sStart) - ti + 1440) % 1440; if (early > 120 && early < 720 && !crosses) flag('OFF_SHIFT', `Time-in ${shown.time_in} is more than 2 hours before the shift starts (${sStart}). Check the shift assigned, or the AM/PM of the punch.`); }
    if (approved) flag('LEAVE_AND_PUNCH', approved.half_day
      ? `A HALF-DAY leave (#${approved.id} ${approved.type}, ${approved.pay}) covers this day. The screen shows a "Half Day" badge together with the late/undertime ` + (lu.half ? `for the half she worked (${lu.half === 'PM' ? 'AFTERNOON: late counts from the end of the break' : 'MORNING: undertime counts from the start of the break'}; the half is read from her punches because the leave does not record it).` : 'measured as a NORMAL day, because her punches cover the whole shift rather than one half.')
      : `An Approved leave (#${approved.id} ${approved.type}, ${approved.pay}) covers this day, but he also punched. The screen shows the punch as a normal working day and does not show the leave.`);
    if (weekend) flag('REST_DAY_PUNCH', 'He punched on a Saturday/Sunday (rest day). Late/undertime still use his shift hours.');
    if (hol) flag('HOLIDAY_PUNCH', 'He punched on a holiday (' + (hol.name || 'holiday') + ').');
    for (const r of rows) for (const a of editsOf(r)) flag('EDITED_AFTER_INSTALL', `Row #${r.id} was edited by ${a.actor_name} on ${String(a.at).slice(0, 16).replace('T', ' ')} UTC (${a.action}). The audit log records WHO and WHEN, not the old and new times.`);
  }
  console.log(line); for (const [c, t] of why) console.log(`      ⚠ ${c}: ${t}`);
  if (why.length) flagDays.add(ds); else okDays++;
}
console.log('\n' + '-'.repeat(110));
const days = Math.round((endD - startD) / 864e5) + 1;
console.log(`${days} day(s) checked: ${flagDays.size} with something to explain, ${days - flagDays.size} with nothing odd.`);
const codes = Object.keys(tally); if (codes.length) { console.log('Reasons found:  ' + codes.map(c => c + ' ×' + tally[c]).join('   ')); }
if (!codes.length) console.log('No data problems found in these records. If something still looks wrong to you, the cause is not in the punches themselves: tell us the date and what it should show.');
console.log('\nNot detectable from the data: manual edits made BEFORE the audit log was installed leave no trace in the record itself.\n');
