#!/usr/bin/env bash
# HMB HRIS — safe deploy.
#   ./scripts/deploy.sh                 pull the latest code, restart if needed, check it came up, roll back if it did not
#   ./scripts/deploy.sh --dry-run       show what WOULD happen, change nothing
#   ./scripts/deploy.sh --stash         stash local edits to tracked files first, put them back afterwards
#   ./scripts/deploy.sh --rollback      go back to the version that was running before the last deploy
#   options: --yes (no questions)  --skip-backup  --no-rollback  --force-restart
set -uo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
PM2_APP="${PM2_APP:-hmbHRIS}"; PM2_BIN="${PM2_BIN:-pm2}"; GIT_BIN="${GIT_BIN:-git}"; NODE_BIN="${NODE_BIN:-node}"; NPM_BIN="${NPM_BIN:-npm}"
PORT="${PORT:-3000}"; HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT}/healthz}"; HEALTH_WAIT="${HEALTH_WAIT:-40}"
STATE_FILE="$APP_DIR/.last-deploy"

DRY=0; STASH=0; ROLLBACK=0; YES=0; SKIP_BACKUP=0; AUTO_ROLLBACK=1; FORCE_RESTART=0
for a in "$@"; do case "$a" in
  --dry-run) DRY=1;; --stash) STASH=1;; --rollback) ROLLBACK=1;; --yes|-y) YES=1;; --skip-backup) SKIP_BACKUP=1;; --no-rollback) AUTO_ROLLBACK=0;; --force-restart) FORCE_RESTART=1;;
  -h|--help) sed -n '2,9p' "$0"; exit 0;;
  *) echo "Unknown option: $a (see --help)"; exit 2;; esac; done

say()  { printf '%s\n' "$*"; }
step() { printf '\n▶ %s\n' "$*"; }
die()  { printf '\n❌ %s\n' "$*" >&2; exit 1; }
run()  { if [ "$DRY" = 1 ]; then printf '   [dry-run] %s\n' "$*"; else "$@"; fi; }
git_() { "$GIT_BIN" -C "$APP_DIR" "$@"; }
version_now() { git_ rev-parse --short HEAD 2>/dev/null || echo unknown; }

wait_healthy() {   # prints the version reported by the server; returns 0 once /healthz says ok
  local i=0 out
  while [ "$i" -lt "$HEALTH_WAIT" ]; do
    out=$(curl -fsS --max-time 4 "$HEALTH_URL" 2>/dev/null) && case "$out" in *'"ok":true'*) printf '%s' "$out" | sed -n 's/.*"version":"\([^"]*\)".*/\1/p'; return 0;; esac
    sleep 1; i=$((i+1))
  done; return 1
}
restart_app() { run "$PM2_BIN" restart "$PM2_APP" --update-env >/dev/null 2>&1 || run "$PM2_BIN" start "$APP_DIR/server.js" --name "$PM2_APP" --update-env >/dev/null 2>&1; }
install_deps() { ( cd "$APP_DIR" && if [ -f package-lock.json ]; then run "$NPM_BIN" ci --omit=dev --no-audit --no-fund; else run "$NPM_BIN" install --omit=dev --no-audit --no-fund; fi ); }

[ -d "$APP_DIR/.git" ] || die "$APP_DIR is not a git checkout."
cd "$APP_DIR" || die "cannot enter $APP_DIR"

# ───────────── rollback ─────────────
if [ "$ROLLBACK" = 1 ]; then
  [ -f "$STATE_FILE" ] || die "No previous deploy is recorded ($STATE_FILE is missing)."
  PREV=$(sed -n 's/^previous=//p' "$STATE_FILE"); CUR=$(version_now)
  [ -n "$PREV" ] || die "The record in $STATE_FILE has no previous version."
  step "Rollback: $CUR → $PREV"
  if [ "$YES" != 1 ] && [ "$DRY" != 1 ]; then read -r -p "   This resets the code to $PREV and restarts the server. Database is NOT touched. Continue? [y/N] " ans; [ "$ans" = "y" ] || [ "$ans" = "Y" ] || die "Cancelled."; fi
  run git_ reset --hard "$PREV" >/dev/null || die "git reset failed"
  install_deps || die "npm install failed during rollback"
  restart_app
  if [ "$DRY" = 1 ]; then say "   [dry-run] would wait for $HEALTH_URL"; exit 0; fi
  V=$(wait_healthy) || die "The server did not become healthy after the rollback. Check: $PM2_BIN logs $PM2_APP --lines 50 --nostream --err"
  say "✅ Rolled back. Server is up, running version $V."; exit 0
fi

# ───────────── deploy ─────────────
START_TS=$(date '+%Y-%m-%d %H:%M:%S'); PREV=$(version_now); PREV_FULL=$(git_ rev-parse HEAD)
step "Deploying HMB HRIS — currently running $PREV"

step "1/6  Checking for new code"
git_ fetch --quiet origin || die "git fetch failed (is the server online and the repository reachable?)"
BRANCH=$(git_ rev-parse --abbrev-ref HEAD)
REMOTE_FULL=$(git_ rev-parse "origin/$BRANCH" 2>/dev/null) || die "There is no origin/$BRANCH to deploy from."
if [ "$PREV_FULL" = "$REMOTE_FULL" ] && [ "$FORCE_RESTART" != 1 ]; then say "   Already up to date ($PREV). Nothing to deploy."; exit 0; fi
git_ merge-base --is-ancestor "$PREV_FULL" "$REMOTE_FULL" 2>/dev/null || die "This server has commits that are not in origin/$BRANCH (or the branch was rewritten), so a clean fast-forward is impossible. Nothing was changed. Look at: git log origin/$BRANCH..HEAD"
NEW=$(git_ rev-parse --short "$REMOTE_FULL")
say "   $PREV → $NEW"; git_ log --oneline "$PREV_FULL..$REMOTE_FULL" 2>/dev/null | sed 's/^/     /'
CHANGED=$(git_ diff --name-only "$PREV_FULL" "$REMOTE_FULL" 2>/dev/null)
NEED_DEPS=0; NEED_RESTART=0
printf '%s\n' "$CHANGED" | grep -Eq '^package(-lock)?\.json$' && NEED_DEPS=1
printf '%s\n' "$CHANGED" | grep -Eq '^(server\.js|lib/|package(-lock)?\.json)' && NEED_RESTART=1
[ "$FORCE_RESTART" = 1 ] && NEED_RESTART=1

DIRTY=$(git_ status --porcelain --untracked-files=no)
if [ -n "$DIRTY" ]; then
  if [ "$STASH" = 1 ]; then say "   Local edits found — they will be stashed and re-applied:"; printf '%s\n' "$DIRTY" | sed 's/^/     /'
  else printf '%s\n' "$DIRTY" | sed 's/^/     /'; die "There are uncommitted edits to tracked files on the server (listed above). Commit them, or run again with --stash. Nothing was changed."; fi
fi

if [ "$SKIP_BACKUP" = 1 ]; then step "2/6  Backup"; say "   (skipped — you asked for --skip-backup)"
else
  step "2/6  Backing up the database (safe while the server is running)"
  if [ "$DRY" = 1 ]; then say "   [dry-run] $NODE_BIN scripts/backup.js pre-deploy"; else "$NODE_BIN" "$APP_DIR/scripts/backup.js" pre-deploy || die "The backup failed, so nothing was deployed. Fix that first (or use --skip-backup if you really must)."; fi
fi

step "3/6  Pulling the new code"
if [ "$DRY" = 1 ]; then say "   [dry-run] git pull --ff-only origin $BRANCH"
else
  [ -n "$DIRTY" ] && [ "$STASH" = 1 ] && { git_ stash push -m "deploy.sh $(date +%s)" >/dev/null || die "Could not stash the local edits. Nothing was changed."; }
  if ! git_ pull --ff-only --quiet origin "$BRANCH"; then [ -n "$DIRTY" ] && [ "$STASH" = 1 ] && git_ stash pop >/dev/null 2>&1; die "git pull failed. Nothing was changed."; fi
  printf 'previous=%s\ndeployed=%s\nat=%s\n' "$PREV_FULL" "$REMOTE_FULL" "$START_TS" > "$STATE_FILE"
  if [ -n "$DIRTY" ] && [ "$STASH" = 1 ]; then
    if git_ stash pop >/dev/null 2>&1; then say "   Your local edits were put back."
    else
      printf '\n❌ The new code is pulled, but your local edits CONFLICT with it and could not be re-applied.\n   The server has NOT been restarted — the old process is still running the old code.\n   Your edits are safe in the stash. To finish:\n     1) git stash pop     (resolve the conflict in the file it names)\n     2) pm2 restart %s --update-env\n   Or give up the new code: ./scripts/deploy.sh --rollback --yes   (then: git stash pop)\n' "$PM2_APP" >&2; exit 1
    fi
  fi
fi

step "4/6  Dependencies"
if [ "$NEED_DEPS" = 1 ]; then install_deps || die "npm install failed — the new code is pulled but NOT running. Roll back with: ./scripts/deploy.sh --rollback"; else say "   unchanged"; fi

step "5/6  Restarting"
if [ "$NEED_RESTART" = 1 ]; then restart_app; else say "   Only pages/scripts changed — no restart needed (open browser tabs will be told to refresh)."; fi

step "6/6  Checking the new version is healthy"
if [ "$DRY" = 1 ]; then say "   [dry-run] would wait up to ${HEALTH_WAIT}s for $HEALTH_URL"; exit 0; fi
if V=$(wait_healthy); then
  say "✅ Deployed. Server is up and reports version: $V   (was $PREV)"
  say "   Rollback if needed:  ./scripts/deploy.sh --rollback"; exit 0
fi
printf '\n❌ The server did NOT come up healthy within %ss after the deploy.\n' "$HEALTH_WAIT" >&2
if [ "$AUTO_ROLLBACK" = 1 ]; then
  say "↩️  Rolling back automatically to $PREV (the database was not touched)…"
  git_ reset --hard "$PREV_FULL" >/dev/null && { printf '%s\n' "$CHANGED" | grep -Eq '^package(-lock)?\.json$' && install_deps; restart_app; }
  if V=$(wait_healthy); then say "✅ Rolled back — the previous version ($V) is running again. The new version has a problem; see: $PM2_BIN logs $PM2_APP --lines 50 --nostream --err"; exit 1; fi
  die "The rollback did not come up either. Restore from the backup: ./scripts/restore.sh <file>  — and check: $PM2_BIN logs $PM2_APP --lines 50 --nostream --err"
fi
die "Not rolled back (--no-rollback). Run ./scripts/deploy.sh --rollback when ready."
