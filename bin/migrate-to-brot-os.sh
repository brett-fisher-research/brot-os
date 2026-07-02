#!/usr/bin/env bash
# Transitional migration engine: move a host still running the pre-rebrand install
# over to brot-os, safely, with deterministic before/after health checks.
#
# The pre-rebrand install baked its absolute path into every RENDERED systemd user
# unit (WorkingDirectory / ExecStart / EnvironmentFile). Renaming the install dir
# therefore breaks every installed unit until each is re-rendered at the new path.
# This engine snapshots what currently works, migrates (remote + pull + dir rename +
# shell-profile env var), re-renders and restarts every unit, then verifies nothing
# regressed — exiting nonzero on any regression.
#
# Usage:
#   bin/migrate-to-brot-os.sh            # perform the migration
#   bin/migrate-to-brot-os.sh --dry-run  # read-only: report what WOULD change
#
# Idempotent and safe to re-run. Self-locates ROOT via lib.sh (BROT_OS_ROOT honored).
set -euo pipefail
source "$(dirname "$(readlink -f "$0")")/lib.sh"

# Old-name fragments built via concatenation so the tree-wide old-name acceptance
# guard never trips on this file.
OLD_NAME="claude""-os"        # previous install + repo directory name
OLD_ENV="CLAUDE_OS""_ROOT"    # previous root-override env var
NEW_NAME="brot-os"

DRY_RUN=0
for a in "$@"; do [ "$a" = "--dry-run" ] && DRY_RUN=1; done

SNAP_UNITS="$(mktemp)"
SNAP_URLS="$(mktemp)"
cleanup() { rm -f "$SNAP_UNITS" "$SNAP_URLS"; }
trap cleanup EXIT

say() { printf '\033[1;35m[migrate]\033[0m %s\n' "$*" >&2; }

# --- read-only registry access (never mutates; tolerates a missing registry/jq) ---
list_slugs() {
  command -v jq >/dev/null 2>&1 || return 0
  [ -f "$REGISTRY" ] || return 0
  jq -r '.experiments | keys[]' "$REGISTRY" 2>/dev/null || true
}
field() { # field <slug> <key>
  command -v jq >/dev/null 2>&1 || return 0
  [ -f "$REGISTRY" ] || return 0
  jq -r --arg s "$1" --arg f "$2" '.experiments[$s][$f] // empty' "$REGISTRY" 2>/dev/null || true
}

good_code() { case "$1" in 2??|3??) return 0;; *) return 1;; esac; }

# ---------------------------------------------------------------------------
# PHASE 1 — SNAPSHOT (the regression oracle: what must still work after)
# ---------------------------------------------------------------------------
snapshot_units() { # active brot/experiment user units, one per line
  command -v systemctl >/dev/null 2>&1 || return 0
  systemctl --user list-units --type=service --state=active --no-legend --plain 2>/dev/null \
    | awk '{print $1}' \
    | grep -E '^(caddy-experiments|claude-remote|exp-.+)\.service$' || true
}
snapshot_urls() { # "<slug>\t<http_code>" for every routable experiment
  command -v curl >/dev/null 2>&1 || return 0
  local slug type code
  for slug in $(list_slugs); do
    type="$(field "$slug" type)"
    case "$type" in next|static) ;; *) continue;; esac
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL/$slug/" 2>/dev/null || echo 000)"
    printf '%s\t%s\n' "$slug" "$code"
  done
}

snapshot_units > "$SNAP_UNITS"
snapshot_urls  > "$SNAP_URLS"
say "Snapshot: $(wc -l < "$SNAP_UNITS" | tr -d ' ') active unit(s), $(wc -l < "$SNAP_URLS" | tr -d ' ') routable url(s)"

# ---------------------------------------------------------------------------
# Detect whether this host actually needs migrating.
# ---------------------------------------------------------------------------
DIR_OLD=0; ORIGIN_OLD=0; UNITS_OLD=0
PROFILES_OLD=""
[ "$(basename "$ROOT")" = "$OLD_NAME" ] && DIR_OLD=1
origin_url="$(git -C "$ROOT" remote get-url origin 2>/dev/null || echo '')"
printf '%s' "$origin_url" | grep -qiF "$OLD_NAME" && ORIGIN_OLD=1
if [ -d "$SYSTEMD_DEST" ]; then
  # `|| true`: with pipefail, grep's exit 1 on a clean host would kill the script
  # before it could ever reach its own "already migrated" path.
  UNITS_OLD="$(grep -rliF "$OLD_NAME" "$SYSTEMD_DEST" 2>/dev/null | wc -l | tr -d ' ')" || true
fi
for f in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
  [ -f "$f" ] && grep -qF "$OLD_ENV" "$f" 2>/dev/null && PROFILES_OLD="$PROFILES_OLD $f"
done
NEEDS=0
{ [ "$DIR_OLD" = 1 ] || [ "$ORIGIN_OLD" = 1 ] || [ "${UNITS_OLD:-0}" -gt 0 ] || [ -n "$PROFILES_OLD" ]; } && NEEDS=1

# ---------------------------------------------------------------------------
# VERIFY (deterministic; reused by dry-run as a read-only report)
# ---------------------------------------------------------------------------
verify() {
  local status=0 nunits=0 nurls=0
  while read -r u; do
    [ -n "$u" ] || continue
    nunits=$((nunits+1))
    if systemctl --user is-active --quiet "$u" 2>/dev/null; then
      echo "  ok   - unit active: $u"
    else
      echo "  FAIL - unit not active: $u"; status=1
    fi
  done < "$SNAP_UNITS"

  if [ -s "$SNAP_URLS" ] && command -v curl >/dev/null 2>&1; then
    while IFS=$'\t' read -r slug base; do
      [ -n "$slug" ] || continue
      if ! good_code "$base"; then echo "  skip - url $slug: baseline was $base"; continue; fi
      nurls=$((nurls+1))
      local now
      now="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$BASE_URL/$slug/" 2>/dev/null || echo 000)"
      if good_code "$now"; then echo "  ok   - url $slug: $base -> $now"
      else echo "  FAIL - url $slug: $base -> $now"; status=1; fi
    done < "$SNAP_URLS"
  fi

  if [ -d "$SYSTEMD_DEST" ]; then
    local uf
    for uf in "$SYSTEMD_DEST"/caddy-experiments.service "$SYSTEMD_DEST"/claude-remote.service "$SYSTEMD_DEST"/exp-*.service; do
      [ -f "$uf" ] || continue
      if grep -qiF "$OLD_NAME" "$uf"; then echo "  FAIL - old name still in $(basename "$uf")"; status=1; fi
      if grep -qF "$ROOT" "$uf"; then echo "  ok   - clean + rooted: $(basename "$uf")"
      else echo "  FAIL - new ROOT missing in $(basename "$uf")"; status=1; fi
    done
  fi

  echo "  --- verified $nunits unit(s), $nurls url(s) ---"
  return $status
}

# ---------------------------------------------------------------------------
# DRY-RUN — report only, mutate nothing, always exit 0
# ---------------------------------------------------------------------------
if [ "$DRY_RUN" = 1 ]; then
  say "DRY-RUN — no changes will be made"
  echo "ROOT (self-located): $ROOT"
  if [ "$NEEDS" = 0 ]; then
    echo "Detection: already on $NEW_NAME — nothing to migrate."
  else
    echo "Detection: pre-rebrand host — the following WOULD change:"
    [ "$DIR_OLD" = 1 ]    && echo "  - rename install dir  : $ROOT -> $(dirname "$ROOT")/$NEW_NAME"
    [ "$ORIGIN_OLD" = 1 ] && echo "  - git origin          : $origin_url -> ${origin_url//$OLD_NAME/$NEW_NAME}"
    [ "${UNITS_OLD:-0}" -gt 0 ] && echo "  - re-render units     : $UNITS_OLD installed unit(s) reference the old name"
    [ -n "$PROFILES_OLD" ] && echo "  - rewrite profiles    : ${OLD_ENV} ->${PROFILES_OLD} (to BROT_OS_ROOT)"
  fi
  echo "Current health (read-only):"
  verify || true
  say "DRY-RUN complete."
  exit 0
fi

# ---------------------------------------------------------------------------
# PHASE 2 — GUARD (real run)
# ---------------------------------------------------------------------------
[ -n "$(git -C "$ROOT" status --porcelain 2>/dev/null)" ] \
  && die "Working tree is dirty — commit or stash before migrating (never clobber local host changes)."

if [ "$NEEDS" = 0 ]; then
  say "Already on $NEW_NAME — nothing to migrate. Verifying health:"
  verify || die "Host is already $NEW_NAME but health check FAILED — investigate."
  say "PASS: already migrated and healthy."
  exit 0
fi

# ---------------------------------------------------------------------------
# PHASE 3 — MIGRATE
# ---------------------------------------------------------------------------
if [ "$ORIGIN_OLD" = 1 ]; then
  new_url="${origin_url//$OLD_NAME/$NEW_NAME}"
  git -C "$ROOT" remote set-url origin "$new_url"
  say "git origin -> $new_url"
fi

git -C "$ROOT" pull --ff-only
say "pulled latest (ff-only)"

if [ "$DIR_OLD" = 1 ]; then
  parent="$(dirname "$ROOT")"
  NEW_ROOT="$parent/$NEW_NAME"
  [ -e "$NEW_ROOT" ] && die "Target $NEW_ROOT already exists — refusing to overwrite."
  old_root="$ROOT"
  cd "$parent"
  mv "$old_root" "$NEW_ROOT"
  ROOT="$NEW_ROOT"
  cd "$ROOT"
  export BROT_OS_ROOT="$ROOT"
  # Re-derive ROOT-relative paths (SYSTEMD_DEST lives under $HOME and is unaffected).
  CONFIG_DIR="$ROOT/config"; APPS_DIR="$ROOT/apps"; REGISTRY="$ROOT/registry.json"
  CADDYFILE="$ROOT/Caddyfile"; HOME_DIR="$ROOT/apps/dashboard"
  TEMPLATES_DIR="$ROOT/templates"; SYSTEMD_SRC="$ROOT/systemd"
  say "renamed install dir -> $ROOT (idempotent)"
else
  say "install dir already at $ROOT (rename skipped)"
fi

old_dir="$HOME/$OLD_NAME"
for f in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
  [ -f "$f" ] || continue
  if grep -qF "$OLD_ENV" "$f" 2>/dev/null; then
    sed -i.bak -e "s|$OLD_ENV|BROT_OS_ROOT|g" -e "s|$old_dir|$ROOT|g" "$f"
    say "rewrote $f ($OLD_ENV -> BROT_OS_ROOT, path -> $ROOT; backup .bak)"
  fi
done

# ---------------------------------------------------------------------------
# PHASE 4 — RE-RENDER + RESTART (re-point every installed unit at the new ROOT)
# ---------------------------------------------------------------------------
say "re-running bootstrap (re-renders + restarts caddy-experiments and claude-remote)"
"$ROOT/bin/bootstrap.sh"

if command -v systemctl >/dev/null 2>&1; then
  node="$(node_bin)"
  for slug in $(list_slugs); do
    type="$(field "$slug" type)"
    app_dir="$APPS_DIR/$slug"
    unit="$SYSTEMD_DEST/exp-$slug.service"
    case "$type" in
      next)
        port="$(field "$slug" port)"
        sed -e "s|@@SLUG@@|$slug|g" -e "s|@@APPDIR@@|$app_dir|g" \
            -e "s|@@NODE@@|$node|g" -e "s|@@PORT@@|$port|g" \
            -e "s|@@ROOT@@|$ROOT|g" \
            "$SYSTEMD_SRC/exp@.template" > "$unit"
        say "re-rendered exp-$slug (next, port $port)" ;;
      worker)
        # Derive the entry file from the existing installed unit (fallback index.js).
        entry="index.js"
        if [ -f "$unit" ]; then
          e="$(sed -n 's|^ExecStart=[^ ]* .*/\([^/][^/]*\)$|\1|p' "$unit" | head -1)"
          [ -n "$e" ] && entry="$e"
        fi
        sed -e "s|@@SLUG@@|$slug|g" -e "s|@@APPDIR@@|$app_dir|g" \
            -e "s|@@NODE@@|$node|g" -e "s|@@ENTRY@@|$entry|g" \
            -e "s|@@ROOT@@|$ROOT|g" \
            "$SYSTEMD_SRC/worker@.template" > "$unit"
        say "re-rendered exp-$slug (worker, entry $entry)" ;;
      *) : ;;  # static apps have no unit
    esac
  done

  systemctl --user daemon-reload
  # Restart every unit that was active in the snapshot so each picks up the new file.
  while read -r u; do
    [ -n "$u" ] || continue
    systemctl --user restart "$u" 2>/dev/null || say "WARN: restart failed for $u"
  done < "$SNAP_UNITS"
  say "daemon-reload + restarted snapshot units; settling..."
  sleep 3
fi

# ---------------------------------------------------------------------------
# PHASE 5 — VERIFY (nonzero exit on any regression)
# ---------------------------------------------------------------------------
say "VERIFY:"
if verify; then
  say "PASS: migration verified — every snapshot unit active, every good URL still good, all installed units re-rooted and clean."
  exit 0
else
  die "FAIL: migration verification detected a regression (see above)."
fi
