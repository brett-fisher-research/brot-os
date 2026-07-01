#!/usr/bin/env bash
# Shared helpers for the brot-os workflow.
# Source this from other scripts:  source "$(dirname "$0")/lib.sh"
set -euo pipefail

# Self-locate the repo root so brot-os installs at any path. Override with BROT_OS_ROOT.
ROOT="${BROT_OS_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CONFIG_DIR="$ROOT/config"   # the /etc of brot-os: secrets + env (gitignored)
APPS_DIR="$ROOT/apps"
REGISTRY="$ROOT/registry.json"
CADDYFILE="$ROOT/Caddyfile"
HOME_DIR="$ROOT/apps/dashboard"
TEMPLATES_DIR="$ROOT/templates"
SYSTEMD_SRC="$ROOT/systemd"
SYSTEMD_DEST="$HOME/.config/systemd/user"
TS_HOST="intel-nuc.mullet-ostrich.ts.net"
BASE_URL="https://$TS_HOST"
PUBLIC_DOMAIN="brettfisher.dev"     # public apex; experiments publish to <slug>.$PUBLIC_DOMAIN
CF_TUNNEL="claude-experiments"      # named Cloudflare tunnel (existing tunnel on the NUC; see bin/setup-cloudflare-tunnel.sh)
CADDY_PORT="8080"
REDIR_PORT="8081"   # Caddy site that 301-redirects plain HTTP -> HTTPS
PORT_BASE=3001
HOME_PORT=2999      # reserved fixed port for the home dashboard (dashboard.service); below PORT_BASE so alloc_port never collides (3000 is taken by an unrelated app)
GH_OWNER="bandrewfisher"

# --- binary resolution (nvm-safe: resolve at call time, bake absolute path) ---
node_bin() { command -v node; }
npm_bin()  { command -v npm; }
npx_bin()  { command -v npx; }
caddy_bin() { command -v caddy 2>/dev/null || echo /usr/bin/caddy; }
claude_bin() { command -v claude 2>/dev/null || echo "$HOME/.local/bin/claude"; }

# --- registry helpers (registry.json is the single source of truth) ---
ensure_registry() {
  [ -f "$REGISTRY" ] || echo '{"experiments":{}}' > "$REGISTRY"
}

reg_get() { # reg_get <jq-filter>
  ensure_registry
  jq -r "$1" "$REGISTRY"
}

reg_has() { # reg_has <slug> -> exit 0 if present
  ensure_registry
  [ "$(jq -r --arg s "$1" '.experiments | has($s)' "$REGISTRY")" = "true" ]
}

reg_list_slugs() {
  ensure_registry
  jq -r '.experiments | keys[]' "$REGISTRY"
}

reg_field() { # reg_field <slug> <field>
  ensure_registry
  jq -r --arg s "$1" --arg f "$2" '.experiments[$s][$f] // empty' "$REGISTRY"
}

# True if something is already LISTENing on the given TCP port (any iface).
port_in_use() { # port_in_use <port>
  ss -ltn 2>/dev/null | grep -qE "[:.]$1[[:space:]]"
}

# Allocate the next free port: max(existing)+1 floored at PORT_BASE, then skip
# any port already held by a live listener (e.g. an unrelated app on this host).
alloc_port() {
  ensure_registry
  local cand
  cand=$(jq -r --argjson base "$PORT_BASE" \
    '[.experiments[].port // empty] + [($base-1)] | max + 1' "$REGISTRY")
  while port_in_use "$cand"; do cand=$(( cand + 1 )); done
  echo "$cand"
}

# Upsert an experiment into the registry.
# reg_add <slug> <type> <port|null> <repo>
reg_add() {
  ensure_registry
  local slug="$1" type="$2" port="$3" repo="$4"
  local created; created="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local portjson="$port"
  [ "$port" = "null" ] || portjson="$port"
  jq --arg s "$slug" --arg t "$type" --argjson p "$portjson" \
     --arg r "$repo" --arg c "$created" \
     '.experiments[$s] = {type:$t, port:$p, repo:$r, created:$c}' \
     "$REGISTRY" > "$REGISTRY.tmp" && mv "$REGISTRY.tmp" "$REGISTRY"
}

reg_remove() { # reg_remove <slug>
  ensure_registry
  jq --arg s "$1" 'del(.experiments[$s])' "$REGISTRY" > "$REGISTRY.tmp" \
    && mv "$REGISTRY.tmp" "$REGISTRY"
}

# Mark/unmark an experiment as publicly hosted at <slug>.$PUBLIC_DOMAIN (via Cloudflare Tunnel).
# Sets just the `public` field, preserving the rest of the entry (reg_add stays registration-only).
reg_set_public() { # reg_set_public <slug> <true|false>
  ensure_registry
  jq --arg s "$1" --argjson v "$2" '.experiments[$s].public = $v' \
     "$REGISTRY" > "$REGISTRY.tmp" && mv "$REGISTRY.tmp" "$REGISTRY"
}

reg_is_public() { # reg_is_public <slug> -> exit 0 if publicly hosted
  ensure_registry
  [ "$(jq -r --arg s "$1" '.experiments[$s].public // false' "$REGISTRY")" = "true" ]
}

log() { printf '\033[1;36m[experiments]\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31m[experiments] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }
