#!/usr/bin/env bash
# Build the home dashboard Next app in _home/, (re)generate + start its systemd service on the
# reserved HOME_PORT, then re-render Caddy LAST so the root fallback only flips to reverse_proxy
# after the service is up (no '/' 502 window).
#
# Usage: rebuild-home.sh
source "$(dirname "$(readlink -f "$0")")/lib.sh"

[ -f "$HOME_DIR/package.json" ] || die "Home app not scaffolded at $HOME_DIR (no package.json)"

cd "$HOME_DIR"
npm="$(npm_bin)"
node="$(node_bin)"

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

# Generate the home systemd user service from the template.
mkdir -p "$SYSTEMD_DEST"
unit="$SYSTEMD_DEST/exp-home.service"
sed \
  -e "s|@@APPDIR@@|$HOME_DIR|g" \
  -e "s|@@NODE@@|$node|g" \
  -e "s|@@PORT@@|$HOME_PORT|g" \
  -e "s|@@ROOT@@|$ROOT|g" \
  "$SYSTEMD_SRC/home.template" > "$unit"

systemctl --user daemon-reload
systemctl --user enable --now exp-home.service
systemctl --user restart exp-home.service
log "Started exp-home on port $HOME_PORT"

# Render Caddy LAST: now that server.js exists and the service is up, the fallback flips to
# reverse_proxy 127.0.0.1:$HOME_PORT.
"$ROOT/bin/render-caddy.sh"

log "Home dashboard rebuilt"
echo "$BASE_URL/"
