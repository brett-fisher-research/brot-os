#!/usr/bin/env bash
# One-time setup for the Cloudflare Tunnel that fronts public experiments.
# Prereq (human, interactive): `cloudflared tunnel login` -> writes ~/.cloudflared/cert.pem
# (authorizes the brettfisher.dev zone for non-interactive tunnel + DNS creation).
#
# Creates the named tunnel, writes a catch-all ingress config (all tunnel traffic -> Caddy :8080,
# which host-routes by <slug>.brettfisher.dev), and installs+starts the cloudflared user service.
# Idempotent: re-running reuses the existing tunnel and rewrites the config/service.
source "$(dirname "$(readlink -f "$0")")/lib.sh"

CF_DIR="$HOME/.cloudflared"
CONFIG="$CF_DIR/config.yml"
cfd_bin() { command -v cloudflared 2>/dev/null || echo /usr/local/bin/cloudflared; }
cfd="$(cfd_bin)"

[ -x "$cfd" ] || command -v cloudflared >/dev/null || die "cloudflared not installed"
[ -f "$CF_DIR/cert.pem" ] || die "missing $CF_DIR/cert.pem — run: cloudflared tunnel login"

# Find or create the named tunnel; capture its UUID.
uuid="$("$cfd" tunnel list --output json 2>/dev/null \
  | jq -r --arg n "$CF_TUNNEL" '(. // []) | .[] | select(.name==$n) | .id' | head -1)"
if [ -z "$uuid" ]; then
  log "Creating tunnel '$CF_TUNNEL'…"
  "$cfd" tunnel create "$CF_TUNNEL" >&2
  uuid="$("$cfd" tunnel list --output json 2>/dev/null \
    | jq -r --arg n "$CF_TUNNEL" '(. // []) | .[] | select(.name==$n) | .id' | head -1)"
fi
[ -n "$uuid" ] || die "could not resolve tunnel UUID for '$CF_TUNNEL'"
creds="$CF_DIR/$uuid.json"
[ -f "$creds" ] || die "missing tunnel credentials $creds (was the tunnel created on this host?)"
log "Tunnel '$CF_TUNNEL' = $uuid"

# Catch-all ingress: every hostname routed to this tunnel -> Caddy. Caddy decides the app by Host,
# so new public experiments never require editing this file or restarting the tunnel.
cat > "$CONFIG" <<YAML
tunnel: $uuid
credentials-file: $creds
ingress:
  - service: http://localhost:$CADDY_PORT
YAML
log "Wrote $CONFIG"

# Install + start the user service.
unit="$SYSTEMD_DEST/cloudflared.service"
mkdir -p "$SYSTEMD_DEST"
sed -e "s|@@CLOUDFLARED@@|$cfd|g" "$SYSTEMD_SRC/cloudflared.template" > "$unit"
systemctl --user daemon-reload
systemctl --user enable --now cloudflared.service
log "cloudflared.service enabled + started"
systemctl --user --no-pager status cloudflared.service | head -5 >&2 || true
log "Done. Publish an experiment with: bin/publish-experiment.sh <slug>"
