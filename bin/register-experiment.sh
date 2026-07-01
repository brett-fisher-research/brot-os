#!/usr/bin/env bash
# Register an experiment: assign a port (Next), generate+start its systemd service,
# update the registry, re-render Caddy, and refresh the landing page.
#
# Usage:
#   register-experiment.sh <slug> next   [port]    # HTTP app behind Caddy
#   register-experiment.sh <slug> static            # static files behind Caddy
#   register-experiment.sh <slug> worker [entry]    # long-lived process, no port/route
#                                                   #   (entry defaults to index.js)
#
# Experiments live in this monorepo, so no GitHub repo is created (repo field is
# left empty). One is only spun off later if an experiment "goes viral".
source "$(dirname "$(readlink -f "$0")")/lib.sh"

slug="${1:?slug required}"
type="${2:?type required (next|static|worker)}"
arg3="${3:-}"          # next: forced port · worker: entry file
forced_port="$arg3"
entry="${arg3:-index.js}"
repo=""
app_dir="$APPS_DIR/$slug"

# These top-level paths are owned by the home dashboard (root app); a same-named experiment
# would shadow them in Caddy. Reject before anything else.
case "$slug" in
  ideas|experiments|_next|api|static|home|favicon.ico|platform-sidebar.js)
    die "Slug '$slug' is reserved by the home dashboard" ;;
esac

[ -d "$app_dir" ] || die "App dir not found: $app_dir"
case "$type" in next|static|worker) ;; *) die "type must be 'next', 'static', or 'worker'";; esac

if [ "$type" = "static" ]; then
  reg_add "$slug" static null "$repo"
  log "Registered static experiment '$slug'"
elif [ "$type" = "worker" ]; then
  # Long-lived background process: no port, no Caddy route. Generate its unit
  # from the worker template and start it.
  reg_add "$slug" worker null "$repo"
  [ -f "$app_dir/$entry" ] || die "Worker entry not found: $app_dir/$entry"
  mkdir -p "$SYSTEMD_DEST"
  node="$(node_bin)"
  unit="$SYSTEMD_DEST/exp-$slug.service"
  sed \
    -e "s|@@SLUG@@|$slug|g" \
    -e "s|@@APPDIR@@|$app_dir|g" \
    -e "s|@@NODE@@|$node|g" \
    -e "s|@@ENTRY@@|$entry|g" \
    -e "s|@@ROOT@@|$ROOT|g" \
    "$SYSTEMD_SRC/worker@.template" > "$unit"
  systemctl --user daemon-reload
  systemctl --user enable --now "exp-$slug.service"
  log "Registered worker experiment '$slug' (entry $entry, service exp-$slug)"
  "$ROOT/bin/render-caddy.sh"
  log "Worker '$slug' running (no URL — it's a background process)."
  exit 0
else
  if reg_has "$slug"; then
    port="$(reg_field "$slug" port)"
  else
    port="${forced_port:-$(alloc_port)}"
  fi
  reg_add "$slug" next "$port" "$repo"

  # Generate the per-experiment systemd user service from the template.
  mkdir -p "$SYSTEMD_DEST"
  node="$(node_bin)"
  unit="$SYSTEMD_DEST/exp-$slug.service"
  sed \
    -e "s|@@SLUG@@|$slug|g" \
    -e "s|@@APPDIR@@|$app_dir|g" \
    -e "s|@@NODE@@|$node|g" \
    -e "s|@@PORT@@|$port|g" \
    -e "s|@@ROOT@@|$ROOT|g" \
    "$SYSTEMD_SRC/exp@.template" > "$unit"

  systemctl --user daemon-reload
  systemctl --user enable --now "exp-$slug.service"
  log "Registered Next experiment '$slug' on port $port (service exp-$slug)"
fi

"$ROOT/bin/render-caddy.sh"
"$ROOT/bin/update-landing.sh"

echo "$BASE_URL/$slug/"
