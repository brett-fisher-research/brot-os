#!/usr/bin/env bash
# notify.sh — one-way push to your phone via Telegram (standalone copy).
#
# VENDORED into an experiment repo for shell/cron use when it runs on its own.
# Reads TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID from the environment, or from a
# repo-local .notify.env (gitignore it). Usage:
#   ./notify.sh "Backup finished ✅"
#   echo "piped" | ./notify.sh
set -euo pipefail

ENV_FILE="${NOTIFY_ENV_FILE:-$(dirname "$0")/.notify.env}"
if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]] && [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "notify: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set" >&2
  exit 1
fi

body="${*:-$(cat)}"

http_code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
  --data-urlencode "text=${body}" \
  --data-urlencode "disable_web_page_preview=true")"

[[ "$http_code" == "200" ]] || { echo "notify: Telegram API HTTP $http_code" >&2; exit 1; }
