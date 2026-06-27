#!/usr/bin/env bash
# Reverse of publish-experiment.sh: stop serving an experiment at <slug>.brettfisher.dev.
# Clears the public flag and re-renders Caddy (the host handler disappears, so the subdomain
# falls through to the root fallback). The DNS record itself is left in place — remove it in the
# Cloudflare dashboard if you want the subdomain to stop resolving entirely (harmless to leave).
# Usage: bin/unpublish-experiment.sh <slug>
source "$(dirname "$(readlink -f "$0")")/lib.sh"

slug="${1:?usage: unpublish-experiment.sh <slug>}"
reg_has "$slug" || die "no such experiment: $slug"

reg_set_public "$slug" false
"$ROOT/bin/render-caddy.sh"

log "Unpublished '$slug' (Caddy no longer host-routes $slug.$PUBLIC_DOMAIN)."
log "To stop it resolving, delete the $slug.$PUBLIC_DOMAIN DNS record in the Cloudflare dashboard."
