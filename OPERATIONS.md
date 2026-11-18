# HMB HRIS — Operations Guide

Everything here is for the person running the server (`/var/www/html`, pm2 process `hmbHRIS`).
Requires **Node 16 or newer** (the backup code uses `stream/promises`).

## 1. What was added

| Feature | Where you see it |
|---|---|
| **Audit log** — who changed what, when, from where. Leave balances, payroll, salary and profile edits keep before/after values. Tamper-evident. | Admin → Settings → **Audit Log** |
| **Backups** — safe nightly snapshots, checked after they are made, with retention. | Admin → Settings → **Backups & Health** |
| **Safe deploy** — backup first, restart only if needed, health check, automatic rollback. | `./scripts/deploy.sh` |
| **Restore** — put a backup back; the database it replaces is kept. | `./scripts/restore.sh` |
| **Uptime alert** — a Teams message when the system is down / back. | `scripts/healthcheck.sh` (cron) |
| **"New version" notice** — open tabs are told to refresh after a deploy; an old page asks before saving. | All three portals |
| **Public-file protection** — `server.js`, `.env`, `*.db`, backups, etc. are never served from `public/`. | automatic |

## 1b. Leave balances — "deducted twice" (fixed) and how to correct people already affected

**How the system treats leave days:** filing a paid VL/SL leave *holds* its days straight away (Pending and Approved both hold them; Denied returns them). Approving a Pending leave must therefore **not** deduct again. The old code did deduct again when a leave was approved from the **Supervisor portal**.

**The fix is in `server.js`** (both approval routes use the same rule). It was proven with an 800-step random test that checks, after every step, that each balance = starting balance − days of leaves currently holding days (`tests/leave_matrix_test.js`); putting the old bug back makes that test fail within 57 steps.
**`server.js` is now self-contained** (the audit and backup modules are inlined), so deploying the fix is **replacing that one file** — no `lib/` folder needed. Check what is live:

```bash
grep -c leaveHoldsBalance /var/www/html/server.js     # 0  = the OLD double-deducting code is running
grep -c "require('./lib" /var/www/html/server.js      # must be 0 for the new self-contained file
```

**People already affected** cannot be found automatically (the database never recorded who approved a leave, or when). Use the read-only report to narrow it down:

```bash
cd /var/www/html
node scripts/leave-reconcile.js --since 2026-10-01 --detail     # use a date when the old code was live; omit --since for all time
```

It lists, per employee, the Approved + With-Pay VL/SL leaves in that period and the **most** they could be owed (the true amount is usually less: only leaves approved from the Supervisor portal were double-charged). Check those leaves with the supervisors, then correct each balance in **Edit Employee** — the Audit Log records who changed it and from what to what. The report also saves a CSV in the (private) backups folder for HR.

## 2. Files and where they go (repo layout)

```
server.js                 (repo root — replaces the old one; self-contained, lib/ is NOT required to run it)
lib/audit.js              NEW
lib/backup.js             NEW
scripts/backup.js         NEW   (+ deploy.sh, healthcheck.sh, restore.sh, leave-reconcile.js — make the .sh files executable)
public/admin.html  public/employee.html  public/supervisor.html
public/version-check.js   NEW   (must be inside public/)
OPERATIONS.md             (this file, repo root)
```

Add to `.gitignore` (never commit data):

```
db/
backups/
uploads/
node_modules/
.last-deploy
.env
ecosystem.config.js
```

Make the scripts executable once, and keep that in git:

```bash
chmod +x scripts/*.sh
git update-index --chmod=+x scripts/deploy.sh scripts/healthcheck.sh scripts/restore.sh
```

## 3. One-time setup on the server

**a) Environment variables** (put them in `ecosystem.config.js`, which is git-ignored, so `pm2 restart --update-env` keeps them):

```js
module.exports = { apps: [{
  name: 'hmbHRIS', script: 'server.js', cwd: '/var/www/html',
  env: {
    PORT: 3000,
    SESSION_SECRET: 'PASTE-A-LONG-RANDOM-STRING',        // openssl rand -hex 32
    ALERT_WEBHOOK_URL: 'https://…webhook.office.com/…',  // optional: Teams incoming webhook
    // BACKUP_DIR: '/var/www/html/backups',   BACKUP_HOUR: 2
  }
}]};
```

Then `pm2 start ecosystem.config.js` (first time) or `pm2 restart hmbHRIS --update-env`.
Everyone is signed out once when `SESSION_SECRET` is first set (sessions are kept in memory and are also lost on every restart).

**b) Teams alert** (optional but recommended): in the Teams channel → ⋯ → *Connectors / Workflows* → *Incoming Webhook* → copy the URL into `ALERT_WEBHOOK_URL`. It is used both for failed backups and for the uptime check.

**c) Uptime check** — add to cron (`crontab -e`):

```
* * * * * ALERT_WEBHOOK_URL='https://…' PORT=3000 /var/www/html/scripts/healthcheck.sh >> /var/log/hmb-health.log 2>&1
```

It alerts after **2 failed checks in a row**, once, and again when the system recovers. (A free external monitor such as UptimeRobot pointed at `https://your-host/healthz` also works and catches the case where the whole server is off.)

**d) Copy backups off the server** (a backup on the same disk does not survive a dead disk). Example nightly cron at 03:30:

```
30 3 * * * rsync -a --delete /var/www/html/backups/ backupuser@other-host:/srv/hmb-backups/
```

or `rclone sync /var/www/html/backups remote:hmb-backups`.

**e) First deployment of this release** — `deploy.sh` is not on the server yet, so do it by hand once:

```bash
cd /var/www/html && git pull
pm2 restart hmbHRIS --update-env     # or: pm2 start ecosystem.config.js
curl -s localhost:3000/healthz       # → {"ok":true,"version":"…"}
```

Then hard-refresh (Ctrl+Shift+R). From now on use `./scripts/deploy.sh`.

## 4. Everyday deploy

```bash
cd /var/www/html
./scripts/deploy.sh              # normal
./scripts/deploy.sh --dry-run    # show what would happen, change nothing
./scripts/deploy.sh --stash      # you hand-edited tracked files on the server; keep those edits
./scripts/deploy.sh --rollback   # go back to the version before the last deploy
```

What it does: fetch → refuse if there is nothing new, the branch diverged, or tracked files have uncommitted edits → **backup (`pre-deploy`)** → pull → `npm install` only if `package.json` changed → restart **only if** `server.js`, `lib/` or `package.json` changed (page-only changes need no restart and nobody is logged out) → wait for `/healthz` → **roll back automatically** if the new version does not come up.
If `--stash` finds your edits conflict with the new code it stops **before restarting** and tells you the two commands to finish.
Other options: `--yes`, `--skip-backup`, `--no-rollback`, `--force-restart`.

Rollback never touches the database. (Database changes in this system are additive, so the previous code runs fine against the current database.)

## 5. Backups

* **Automatic:** every night after 02:00 (server time), and once if a night was missed. Not at the same time as a deploy backup: a backup taken in the last 20 hours is not repeated.
* **Manual:** Admin → Backups & Health → *Back up now*, or `node scripts/backup.js`.
* **Where:** `/var/www/html/backups/` (outside `public/`, never downloadable by URL). Each backup is `hris-YYYYMMDD-HHMMSS-reason.db.gz` plus a small `.json` manifest (row counts, version, audit-log anchor).
* **Retention:** newest 14, plus the newest of each of the last 8 weeks and 6 months. Older ones are removed automatically.
* **Checked:** every backup is opened and `integrity_check`ed *as a copy* before it is kept.
* **Never copy `db/hris.db` by hand while the server runs** — the database is in WAL mode and a plain copy can miss recent changes. Use the backup tools.
* Download a backup: Backups & Health → *Download* (full admins only; it is the whole database, including pay data).

## 6. Restore

```bash
cd /var/www/html
ls backups/                                   # or see the list on the Backups & Health screen
./scripts/restore.sh backups/hris-20261113-020005-scheduled.db.gz
```

It checks the backup first, shows employee/audit counts for both, asks to confirm, stops the app, **moves the current database aside** (`db/hris.db.before-restore-<time>`, complete with its WAL), puts the backup in place, starts the app and waits for health. To undo a restore: stop the app, move the `before-restore` file back to `db/hris.db`, start the app.
**Try a restore on a spare copy once** so you know it works before you ever need it.

## 7. The audit log

**Recorded automatically:** every successful, failed or refused change request — who (account + role), when, from which address, what. Includes sign-ins and failed sign-ins, user/role/password changes, leave filed/approved/denied/edited/deleted, credits, employee profile edits, payroll saves, payslips, settings, shifts, backups and exports, and server starts (with the version, so deploys show up).
**With before/after values:** every leave-balance movement (`VL 2.95 → 0.95`, and why), credits, profile fields (pay, balances; identifiers like bank/TIN are marked "changed" without the value), and payroll — only the figures that actually changed, per employee.
**Never recorded:** passwords, API keys, tokens, signatures, request bodies in general. Routine clock punches and plain page reads are not logged.

**Screen:** filters (dates, who, area, outcome, employee, search), expandable details, CSV export. A request and the detail entries it caused are shown together (↳).
**Integrity:** the log cannot be edited or deleted through the application, and each entry is chained to the previous one. *Verify integrity* re-checks the whole chain and compares it with the audit head stored in each backup (which also catches deleted newest entries). If it ever says the log "does not check out", someone changed the database directly — don't touch anything, note the entry number shown, and investigate (database file access, `pm2` logs, who has SSH).
**Retention:** kept indefinitely (a few MB per year).

## 8. Security checklist (do these once)

1. **Change the default admin password** (`admin123`) — User Accounts → reset the `admin` password. The Backups & Health screen shows a red warning until you do.
2. **Set `SESSION_SECRET`** (see 3a).
3. **Check `public/`**: nothing but pages, scripts, images and manifests. `ls /var/www/html/public` — remove any stray `server.js`, `*.db`, `*.zip`, `.env`. (The server now refuses to serve those, but they should not be there.)
4. If the GitHub repository is not private, rotate any secret that was ever committed.
5. Put the site behind HTTPS (nginx) if it is reachable from outside the office.

## 9. Troubleshooting

| Symptom | Check |
|---|---|
| **502 Bad Gateway** | `pm2 status` · `pm2 logs hmbHRIS --lines 50 --nostream --err` · `curl -s localhost:3000/healthz` |
| Yellow bar "HMB HRIS was just updated" | A deploy happened while the page was open. Finish, then Ctrl+Shift+R. |
| A user is asked "This page is out of date… Save anyway?" | Same cause — they should refresh first. |
| "Back up now" fails | Check disk space (shown on the screen), and that `BACKUP_DIR` is writable by the pm2 user. |
| Backups stopped | Backups & Health shows an amber warning after 36 h; check `pm2 logs` for `[backup]`. |
| Deploy rolled back by itself | The new version crashed on start; `pm2 logs hmbHRIS --lines 50 --nostream --err` shows why. Your data was not touched. |

## 10. Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | 3000 | HTTP port |
| `SESSION_SECRET` | built-in default (**warns**) | Signs session cookies |
| `BACKUP_DIR` | `<app>/backups` | Where backups are kept |
| `BACKUP_HOUR` | 2 | Hour (server time) after which the nightly backup runs |
| `ALERT_WEBHOOK_URL` | — | Teams/Slack incoming webhook for failed backups & uptime alerts |
| `APP_VERSION` | git short hash | Version shown in `/healthz`, the log and the screen |
| `HRIS_DISABLE_BACKUPS` | — | `1` switches the nightly backup off (tests only) |
