#!/usr/bin/env bash
# Rebuild the home dashboard (apps/dashboard) Next app and restart its installed systemd
# service, then re-render Caddy LAST so the root fallback only flips to reverse_proxy after
# the service is back up (no '/' 502 window).
#
# The dashboard runs as the canonical `dashboard.service` unit (symlinked from
# apps/dashboard/deploy/dashboard.service), bound to HOME_PORT. This script restarts THAT
# unit — it must NOT generate a second, competing unit on the same port.
#
# Usage: rebuild-home.sh
source "$(dirname "$(readlink -f "$0")")/lib.sh"

SERVICE="dashboard.service"
DEPLOY_UNIT="$HOME_DIR/deploy/$SERVICE"

[ -f "$HOME_DIR/package.json" ] || die "Home app not scaffolded at $HOME_DIR (no package.json)"
[ -f "$DEPLOY_UNIT" ] || die "Dashboard unit not found at $DEPLOY_UNIT"

cd "$HOME_DIR"
npm="$(npm_bin)"

log "Installing deps for home dashboard..."
if [ -f package-lock.json ]; then "$npm" ci; else "$npm" install; fi

log "Building home dashboard..."
"$npm" run build

# Next standalone output needs static assets + public/ copied alongside server.js.
if [ -d .next/standalone ]; then
  mkdir -p .next/standalone/.next
  cp -r .next/static .next/standalone/.next/static
  [ -d public ] && cp -r public .next/standalone/public || true
fi

# Heal hosts where an older version of this script generated a competing exp-home.service on
# HOME_PORT — it crash-loops on EADDRINUSE against dashboard.service and serves a stale build.
if [ -e "$SYSTEMD_DEST/exp-home.service" ]; then
  log "Removing legacy exp-home.service (superseded by $SERVICE)"
  systemctl --user disable --now exp-home.service 2>/dev/null || true
  rm -f "$SYSTEMD_DEST/exp-home.service" "$SYSTEMD_DEST/default.target.wants/exp-home.service"
fi

# Restart the canonical installed unit so it picks up the fresh standalone build.
systemctl --user daemon-reload
systemctl --user enable --now "$DEPLOY_UNIT"   # idempotent: ensures the unit is installed
systemctl --user restart "$SERVICE"
log "Restarted $SERVICE on port $HOME_PORT"

# Render Caddy LAST: now that the service is back up, the fallback flips to
# reverse_proxy 127.0.0.1:$HOME_PORT with no 502 window.
"$ROOT/bin/render-caddy.sh"

log "Home dashboard rebuilt"
echo "$BASE_URL/"
