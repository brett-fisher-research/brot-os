#!/usr/bin/env bash
# Rebuild a Next experiment and restart its long-lived service.
# For static experiments this just refreshes Caddy + landing (no build/service).
#
# Usage: rebuild-experiment.sh <slug>
source "$(dirname "$(readlink -f "$0")")/lib.sh"

slug="${1:?slug required}"
app_dir="$APPS_DIR/$slug"
reg_has "$slug" || die "Unknown experiment: $slug"
type="$(reg_field "$slug" type)"
[ -d "$app_dir" ] || die "App dir not found: $app_dir"

if [ "$type" = "static" ]; then
  "$ROOT/bin/render-caddy.sh"
  "$ROOT/bin/update-landing.sh"
  log "Static experiment '$slug' refreshed"
  echo "$BASE_URL/$slug/"
  exit 0
fi

if [ "$type" = "worker" ]; then
  # Background process: install deps only if it has any, then restart. No build,
  # no port, no route. (Plain zero-dep workers just restart.)
  cd "$app_dir"
  if [ -f package.json ] && grep -q '"dependencies"' package.json; then
    npm="$(npm_bin)"
    if [ -f package-lock.json ]; then "$npm" ci; else "$npm" install; fi
  fi
  systemctl --user restart "exp-$slug.service"
  log "Restarted worker exp-$slug"
  exit 0
fi

cd "$app_dir"
npm="$(npm_bin)"

log "Installing deps for '$slug'..."
if [ -f package-lock.json ]; then "$npm" ci; else "$npm" install; fi

log "Building '$slug'..."
"$npm" run build

# Next standalone output needs static assets + public/ copied alongside server.js.
if [ -d .next/standalone ]; then
  mkdir -p .next/standalone/.next
  cp -r .next/static .next/standalone/.next/static
  [ -d public ] && cp -r public .next/standalone/public || true
fi

systemctl --user restart "exp-$slug.service"
log "Restarted exp-$slug"
echo "$BASE_URL/$slug/"
