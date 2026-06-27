#!/usr/bin/env bash
# Tear down a standalone experiment service: stop + disable + remove its systemd
# unit, drop its registry entry, and re-render Caddy (so its /<slug>/* route
# disappears). The reverse of register-experiment.sh.
#
# Used when an experiment is PROMOTED into the home dashboard (moved to
# _home/app/<slug>/): it no longer runs as its own service on its own port —
# Caddy's root fallback serves /<slug>/* from _home instead. The app source move
# is done by the /promote-experiment skill; this script owns the teardown.
#
# Usage: unregister-experiment.sh <slug>
#
# NOTE: run this AFTER rebuild-home.sh has shipped the new /<slug>/ route in _home,
# so there's no window where /<slug>/ 404s.
source "$(dirname "$(readlink -f "$0")")/lib.sh"

slug="${1:?slug required}"

reg_has "$slug" || { log "'$slug' not in registry — nothing to unregister"; }

unit="exp-$slug.service"
if systemctl --user list-unit-files "$unit" >/dev/null 2>&1; then
  systemctl --user disable --now "$unit" 2>/dev/null || true
fi
rm -f "$SYSTEMD_DEST/$unit"
systemctl --user daemon-reload

reg_remove "$slug"
log "Unregistered '$slug' (service stopped + removed, registry entry dropped)"

"$ROOT/bin/render-caddy.sh"
log "Caddy re-rendered — /$slug/* now falls through to the home dashboard"
