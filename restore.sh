#!/usr/bin/env bash
# HMB HRIS — restore the database from a backup.
#   ./scripts/restore.sh backups/hris-20261113-020005-scheduled.db.gz [--yes]
# The CURRENT database is kept (as db/hris.db.before-restore-<time>) so a restore can itself be undone. The backup is checked first.
set -uo pipefail
APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PM2_APP="${PM2_APP:-hmbHRIS}"; PM2_BIN="${PM2_BIN:-pm2}"; NODE_BIN="${NODE_BIN:-node}"
PORT="${PORT:-3000}"; HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT}/healthz}"
DB="${DB_PATH:-$APP_DIR/db/hris.db}"
FILE="${1:-}"; YES=0; [ "${2:-}" = "--yes" ] && YES=1
die() { printf '\n❌ %s\n' "$*" >&2; exit 1; }
[ -n "$FILE" ] || die "Usage: $0 <backup.db.gz> [--yes]   (backups are listed in the admin screen, or: ls $APP_DIR/backups)"
[ -f "$FILE" ] || die "File not found: $FILE"
TMP="$DB.restore-tmp"; rm -f "$TMP" "$TMP-wal" "$TMP-shm"
gunzip -c "$FILE" > "$TMP" || die "Could not decompress $FILE (is it a .db.gz backup?)"

check() { "$NODE_BIN" -e '
  const D=require(process.argv[1]+"/node_modules/better-sqlite3");
  const db=new D(process.argv[2],{readonly:true,fileMustExist:true});
  const ic=db.pragma("integrity_check",{simple:true}); let n="?",a="?";
  try{n=db.prepare("SELECT COUNT(*) c FROM employees").get().c}catch(e){} try{a=db.prepare("SELECT COUNT(*) c FROM audit_log").get().c}catch(e){}
  console.log(ic+"|"+n+"|"+a); process.exit(ic==="ok"?0:3);' "$APP_DIR" "$1" 2>/dev/null; }
INFO=$(check "$TMP") || { rm -f "$TMP"; die "The backup FAILED its integrity check (${INFO:-unreadable}). Nothing was changed."; }
rm -f "$TMP-wal" "$TMP-shm"   # opening the copy to check it can leave SQLite side files behind
BK_EMP=$(printf '%s' "$INFO" | cut -d'|' -f2); BK_AUD=$(printf '%s' "$INFO" | cut -d'|' -f3)
CUR=$(check "$DB" 2>/dev/null || echo "?|?|?"); CUR_EMP=$(printf '%s' "$CUR" | cut -d'|' -f2)
printf '\nBackup:   %s\n          integrity ok · %s employees · %s audit entries\nCurrent:  %s employees\n\n' "$(basename "$FILE")" "$BK_EMP" "$BK_AUD" "$CUR_EMP"
if [ "$YES" != 1 ]; then read -r -p "Replace the current database with this backup? The server will be stopped for a few seconds. [y/N] " ans; [ "$ans" = "y" ] || [ "$ans" = "Y" ] || { rm -f "$TMP"; die "Cancelled — nothing was changed."; }; fi

TS=$(date +%Y%m%d-%H%M%S)
"$PM2_BIN" stop "$PM2_APP" >/dev/null 2>&1
SAVED="$DB.before-restore-$TS"
# Keep the replaced database COMPLETE: in WAL mode its latest writes live in the -wal file, so all three files move together.
[ -f "$DB" ] && mv "$DB" "$SAVED"; [ -f "$DB-wal" ] && mv "$DB-wal" "$SAVED-wal"; [ -f "$DB-shm" ] && mv "$DB-shm" "$SAVED-shm"
mv "$TMP" "$DB" || die "Could not put the backup in place. The previous database is at $SAVED"
"$PM2_BIN" start "$PM2_APP" >/dev/null 2>&1 || "$PM2_BIN" restart "$PM2_APP" --update-env >/dev/null 2>&1
i=0; while [ "$i" -lt 40 ]; do curl -fsS --max-time 4 "$HEALTH_URL" 2>/dev/null | grep -q '"ok":true' && { printf '✅ Restored. The server is up with %s employees.\n   The database you replaced is kept at: %s\n   (to undo: stop the server, move that file back to db/hris.db, start it)\n' "$BK_EMP" "$SAVED"; exit 0; }; sleep 1; i=$((i+1)); done
die "The database was restored but the server did not answer at $HEALTH_URL. The previous database is at $SAVED. Check: $PM2_BIN logs $PM2_APP --lines 50 --nostream --err"
