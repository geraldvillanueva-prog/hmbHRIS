#!/usr/bin/env bash
# HMB HRIS — uptime check, meant for cron:      * * * * * /var/www/html/scripts/healthcheck.sh
# Alerts a Teams/Slack channel (incoming-webhook URL in ALERT_WEBHOOK_URL) after FAILS_BEFORE_ALERT consecutive failures, and again
# when the system is back. No webhook set? It still writes to the log/cron mail. State is kept in a small file so it never repeats itself.
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT:-3000}/healthz}"
STATE_DIR="${STATE_DIR:-/tmp}"; STATE="$STATE_DIR/hmb-hris-health.state"
FAILS_BEFORE_ALERT="${FAILS_BEFORE_ALERT:-2}"; NAME="${NAME:-HMB HRIS}"; HOST=$(hostname 2>/dev/null || echo server)

fails=0; alerted=0; since=0
[ -f "$STATE" ] && . "$STATE" 2>/dev/null
save() { printf 'fails=%s\nalerted=%s\nsince=%s\n' "$fails" "$alerted" "$since" > "$STATE"; }
notify() {   # $1 = message
  local msg="$1"; echo "$(date '+%F %T') $msg"
  command -v logger >/dev/null 2>&1 && logger -t hmb-hris-health "$msg"
  [ -n "${ALERT_WEBHOOK_URL:-}" ] || return 0
  local safe; safe=$(printf '%s' "$msg" | tr -d '"\\' | tr '\n' ' ')
  curl -fsS --max-time 10 -X POST -H 'Content-Type: application/json' -d "{\"text\":\"$safe\"}" "$ALERT_WEBHOOK_URL" >/dev/null 2>&1 || echo "(could not reach the alert webhook)" >&2
}

out=$(curl -fsS --max-time 10 "$HEALTH_URL" 2>/dev/null)
if [ $? -eq 0 ] && printf '%s' "$out" | grep -q '"ok":true'; then
  if [ "$alerted" = 1 ]; then mins=$(( ( $(date +%s) - since ) / 60 )); notify "🟢 $NAME is back up on $HOST (it was down about ${mins} minute(s))."; fi
  fails=0; alerted=0; since=0; save
else
  [ "$fails" = 0 ] && since=$(date +%s)
  fails=$((fails+1))
  if [ "$fails" -ge "$FAILS_BEFORE_ALERT" ] && [ "$alerted" != 1 ]; then notify "🔴 $NAME is DOWN on $HOST — $HEALTH_URL has not answered for $fails check(s). Try: pm2 status / pm2 logs hmbHRIS --lines 40 --nostream --err"; alerted=1; fi
  save; exit 1
fi
