#!/usr/bin/env bash
# One-time host setup for the claude-os workflow.
# Safe to re-run (idempotent). Run AFTER the prerequisites in SETUP.md
# (Tailscale HTTPS enabled, caddy + jq installed, claude logged in, linger enabled).
source "$(dirname "$(readlink -f "$0")")/lib.sh"

log "Bootstrapping claude-os at $ROOT"

# 1. Structure + registry + initial Caddyfile + landing page.
mkdir -p "$APPS_DIR" "$HOME_DIR" "$TEMPLATES_DIR" "$SYSTEMD_DEST"
ensure_registry
"$ROOT/bin/render-caddy.sh"
"$ROOT/bin/update-landing.sh"

# 2. Install the two infra services, substituting absolute binary paths.
caddy="$(caddy_bin)"; claude="$(claude_bin)"; nodedir="$(dirname "$(node_bin)")"
[ -x "$caddy" ] || log "WARNING: caddy not found at '$caddy' — install it (see SETUP.md)"

sed -e "s|@@CADDY@@|$caddy|g" \
  "$SYSTEMD_SRC/caddy-experiments.service" > "$SYSTEMD_DEST/caddy-experiments.service"
sed -e "s|@@CLAUDE@@|$claude|g" -e "s|@@NODEDIR@@|$nodedir|g" \
  "$SYSTEMD_SRC/claude-remote.service" > "$SYSTEMD_DEST/claude-remote.service"

systemctl --user daemon-reload
systemctl --user enable --now caddy-experiments.service
systemctl --user enable --now claude-remote.service
log "Enabled caddy-experiments and claude-remote user services"

# 3. Point Tailscale at Caddy (one-time; persists in tailscaled state).
if tailscale serve --bg "$CADDY_PORT" 2>/tmp/ts-serve.err; then
  log "tailscale serve (HTTPS): $BASE_URL/ -> 127.0.0.1:$CADDY_PORT"
else
  log "tailscale serve failed — likely needs operator perms."
  log "  Run: sudo tailscale set --operator=\$USER   then re-run this script."
  cat /tmp/ts-serve.err >&2 || true
fi

# 3b. Redirect plain HTTP on :80 -> HTTPS. Requires port 80 to be free
#     (disable the host's leftover Apache first: sudo systemctl disable --now apache2).
if ss -tln 2>/dev/null | grep -qE '(^|[^0-9.])(0\.0\.0\.0:80|\*:80) '; then
  log "Port 80 is already in use (likely apache2). To enable the HTTP->HTTPS redirect:"
  log "  sudo systemctl disable --now apache2   then re-run this script."
elif tailscale serve --bg --http=80 "$REDIR_PORT" 2>/tmp/ts-serve80.err; then
  log "tailscale serve (HTTP->HTTPS): port 80 -> 127.0.0.1:$REDIR_PORT (redirect)"
else
  log "tailscale serve --http=80 failed:"; cat /tmp/ts-serve80.err >&2 || true
fi

echo
log "Done. Status:"
systemctl --user --no-pager status caddy-experiments claude-remote 2>/dev/null | grep -E "Active:|●" || true
echo
log "Open $BASE_URL/ from a tailnet device to confirm the landing page loads."
log "Find the 'claude-os' session in the Claude app -> Code to drive it from your phone."
