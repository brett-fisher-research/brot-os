#!/usr/bin/env bash
# Publish an experiment to the public internet at <slug>.brettfisher.dev via the Cloudflare Tunnel.
# Marks it public in the registry, creates the proxied DNS record (cert is auto-covered by
# Cloudflare's wildcard), and re-renders Caddy to host-route the subdomain. Idempotent.
#
# Prereq: bin/setup-cloudflare-tunnel.sh has been run (tunnel + cloudflared.service exist).
# Usage: bin/publish-experiment.sh <slug>
source "$(dirname "$(readlink -f "$0")")/lib.sh"

slug="${1:?usage: publish-experiment.sh <slug>}"
reg_has "$slug" || die "no such experiment: $slug"

type="$(reg_field "$slug" type)"
if [ "$type" != "static" ]; then
  die "public hosting currently supports only 'static' apps (got type=$type for '$slug').
Next apps bake basePath:'/$slug' and would 404 at a subdomain root — rebuild basePath-less first."
fi

host="$slug.$PUBLIC_DOMAIN"
cfd="$(command -v cloudflared 2>/dev/null || echo /usr/local/bin/cloudflared)"

# 1) Mark public in the registry (drives render-caddy.sh).
reg_set_public "$slug" true

# 2) Create the proxied CNAME (<slug>.brettfisher.dev -> <tunnel>.cfargotunnel.com) via the CF API.
#    Tolerate "already exists" so re-publishing is a no-op.
log "Routing DNS $host -> tunnel '$CF_TUNNEL'…"
if ! out="$("$cfd" tunnel route dns "$CF_TUNNEL" "$host" 2>&1)"; then
  if echo "$out" | grep -qiE 'already (exists|configured)|record with that host'; then
    log "DNS record for $host already exists (ok)"
  else
    die "cloudflared tunnel route dns failed:
$out"
  fi
fi

# 3) Re-render Caddy (adds the @<slug>-pub host handler) and reload.
"$ROOT/bin/render-caddy.sh"

log "Published: https://$host"
echo "https://$host"
