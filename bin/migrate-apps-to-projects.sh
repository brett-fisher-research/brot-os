#!/usr/bin/env bash
# migrate-apps-to-projects.sh — one-shot host migration: apps/ -> projects/.
#
# TEMPORARY. Deleted (with .claude/skills/brot-migrate-projects) in a follow-up PR once
# every host is migrated.
#
# Run on the host (the nuc) AFTER checking out the rename branch. Idempotent, safe to
# re-run:
#   1. move leftover entries (tenant repos, symlinks) from apps/ into projects/, rmdir apps/
#   2. rewrite $ROOT/apps -> $ROOT/projects in ~/.config/systemd/user exp-*.service and
#      dashboard.service, daemon-reload, restart the rewritten units
#   3. re-render the Caddyfile and restart caddy-experiments.service
#   4. verify: every registry slug resolves under projects/, rewritten units are active
#
# Usage: migrate-apps-to-projects.sh
source "$(dirname "$(readlink -f "$0")")/lib.sh"

OLD_DIR="$ROOT/apps"
NEW_DIR="$ROOT/projects"   # == APPS_DIR after the rename; kept literal for clarity
UNIT_DIR="$SYSTEMD_DEST"

# Units still baking the old absolute path (only files that exist AND contain it).
units_with_old() {
  grep -lF "$OLD_DIR" "$UNIT_DIR"/exp-*.service "$UNIT_DIR"/dashboard.service 2>/dev/null || true
}

# --- preflight ---------------------------------------------------------------
[ -f "$NEW_DIR/.gitignore" ] \
  || die "projects/.gitignore missing — check out the rename branch first (git checkout chore/rename-apps-to-projects)"

if [ ! -e "$OLD_DIR" ] && [ -z "$(units_with_old)" ]; then
  log "already migrated: no apps/ dir, no user units reference $OLD_DIR"
  exit 0
fi

# --- 1. move leftovers apps/ -> projects/ ------------------------------------
moved=0
if [ -d "$OLD_DIR" ]; then
  shopt -s dotglob nullglob
  for entry in "$OLD_DIR"/*; do
    name="$(basename "$entry")"
    dest="$NEW_DIR/$name"
    if [ -e "$dest" ] || [ -L "$dest" ]; then
      die "refusing to clobber existing $dest (source: $entry) — resolve by hand, then re-run"
    fi
    mv "$entry" "$dest"   # mv preserves symlinks as-is (targets under experiments/ stay valid)
    moved=$(( moved + 1 ))
    log "moved apps/$name -> projects/$name"
  done
  shopt -u dotglob nullglob
  rmdir "$OLD_DIR"
  log "removed empty apps/"
fi

# --- 2. rewrite systemd user units -------------------------------------------
rewritten=()
for unit in $(units_with_old); do
  sed -i "s|$OLD_DIR|$NEW_DIR|g" "$unit"
  rewritten+=("$(basename "$unit")")
  log "rewrote $(basename "$unit"): $OLD_DIR -> $NEW_DIR"
done

if [ "${#rewritten[@]}" -gt 0 ]; then
  systemctl --user daemon-reload
  log "systemd user daemon reloaded"
  for u in "${rewritten[@]}"; do
    systemctl --user restart "$u" || die "restart failed for $u — journalctl --user -u $u"
    log "restarted $u"
  done
else
  log "no units referenced $OLD_DIR — nothing to rewrite"
fi

# --- 3. re-render Caddy, restart it -------------------------------------------
"$ROOT/bin/render-caddy.sh"
systemctl --user restart caddy-experiments.service \
  || die "caddy-experiments.service failed to restart — journalctl --user -u caddy-experiments"
log "caddy re-rendered and restarted"

# --- 4. verify -----------------------------------------------------------------
fails=0

for slug in $(reg_list_slugs); do
  if [ -e "$NEW_DIR/$slug" ] || [ -L "$NEW_DIR/$slug" ]; then
    log "verify ok: projects/$slug exists"
  else
    log "verify FAIL: registry slug '$slug' has no dir/symlink under projects/"
    fails=$(( fails + 1 ))
  fi
done

if [ "${#rewritten[@]}" -gt 0 ]; then
  for u in "${rewritten[@]}"; do
    if systemctl --user is-active --quiet "$u"; then
      log "verify ok: $u active"
    else
      log "verify FAIL: $u not active"
      fails=$(( fails + 1 ))
    fi
  done
fi

if systemctl --user is-active --quiet caddy-experiments.service; then
  log "verify ok: caddy-experiments.service active"
else
  log "verify FAIL: caddy-experiments.service not active"
  fails=$(( fails + 1 ))
fi

[ "$fails" -eq 0 ] || die "migration finished with $fails verification failure(s) — see log above"
log "migration complete: moved $moved entr(y/ies), rewrote ${#rewritten[@]} unit(s), 0 failures"
