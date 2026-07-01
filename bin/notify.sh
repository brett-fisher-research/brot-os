#!/usr/bin/env bash
# notify.sh — send a one-way push to your phone via Telegram.
#
# Usage:
#   bin/notify.sh "Build finished ✅"
#   echo "piped message" | bin/notify.sh
#   bin/notify.sh -t "Title" "body line"      # -t prepends a bold title
#
# Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from the environment, or from
# the host secret file if unset. Exits non-zero on failure so callers (cron,
# rebuild scripts, systemd) can detect a missed notification.
set -euo pipefail

# Resolve ROOT (self-locating; honours BROT_OS_ROOT) so the env file follows the install.
source "$(dirname "$(readlink -f "$0")")/lib.sh"
ENV_FILE="${NOTIFY_ENV_FILE:-$CONFIG_DIR/notify.env}"
if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]] && [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "notify: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set (looked in env and $ENV_FILE)" >&2
  exit 1
fi

title=""
if [[ "${1:-}" == "-t" ]]; then
  title="$2"; shift 2
fi

# Message body: args if given, else stdin.
if [[ $# -gt 0 ]]; then
  body="$*"
else
  body="$(cat)"
fi

text="$body"
if [[ -n "$title" ]]; then
  text="*${title}*"$'\n'"${body}"
fi

http_code="$(curl -s -o /tmp/notify-resp.$$ -w '%{http_code}' \
  --max-time 15 \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
  --data-urlencode "text=${text}" \
  --data-urlencode "parse_mode=Markdown" \
  --data-urlencode "disable_web_page_preview=true")"

if [[ "$http_code" != "200" ]]; then
  echo "notify: Telegram API returned HTTP $http_code" >&2
  cat /tmp/notify-resp.$$ >&2 2>/dev/null || true
  rm -f /tmp/notify-resp.$$
  exit 1
fi
rm -f /tmp/notify-resp.$$
