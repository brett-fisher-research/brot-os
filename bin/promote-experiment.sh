#!/usr/bin/env bash
# Promote an experiment to a platform feature: add it to the sidebar manifest
# (data/platform-features.json). This script owns the manifest mutation (the
# deterministic part). The /promote-experiment skill does the rest: it MOVES the
# app into the home dashboard (_home/app/<slug>/) so it shares the dashboard's
# layout/chrome, then rebuilds _home and tears down the old standalone service
# (bin/unregister-experiment.sh). A promoted experiment is therefore a route
# segment of _home — not a separate service — and gets the sidebar for free.
#
# Usage: promote-experiment.sh <slug> [--label "Name"] [--icon "📚"]
#   label default: title-cased slug.   icon default: a neutral emoji (prefer an
#   emoji that matches the app's page <h1>; pass --icon to set it).
source "$(dirname "$(readlink -f "$0")")/lib.sh"

slug="${1:?slug required}"; shift || true
label=""; icon=""
while [ $# -gt 0 ]; do
  case "$1" in
    --label) label="${2:?}"; shift 2 ;;
    --icon)  icon="${2:?}";  shift 2 ;;
    *) die "Unknown arg: $1" ;;
  esac
done

case "$slug" in
  ideas|_next|api|static|home|favicon.ico) die "Slug '$slug' is reserved by the home dashboard" ;;
esac
reg_has "$slug" || die "Unknown experiment: $slug (not in registry.json)"
type="$(reg_field "$slug" type)"
[ "$type" = "worker" ] && die "Workers have no web page and can't be a sidebar feature"

# Defaults: title-case the slug for the label; use the app's own PWA icon.
if [ -z "$label" ]; then
  label="$(echo "$slug" | sed -E 's/[-_]/ /g' \
    | awk '{for(i=1;i<=NF;i++) $i=toupper(substr($i,1,1)) substr($i,2)}1')"
fi
[ -z "$icon" ] && icon="📦"

feat_add "$slug" "$label" "$icon" "/$slug/"
"$ROOT/bin/render-caddy.sh" >/dev/null 2>&1 || true  # idempotent; keeps everything in sync
log "Promoted '$slug' → sidebar feature \"$label\" (icon: $icon)"
log "Next (the skill does this): rebuild-home.sh, then unregister-experiment.sh $slug."
