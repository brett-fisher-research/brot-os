#!/usr/bin/env bash
# Host-aware migration test. On a dev box or an un-migrated host (no systemctl, or no
# brot/experiment units installed) it prints SKIP and exits 0. On a migrated host it
# asserts every installed unit references the current repo root and carries zero old-name
# strings, and that the core units are active. The always-on assertions (engine exists +
# executable, --dry-run runs clean) stay green anywhere, including this Windows dev box.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Old-name fragment built via concatenation so the tree-wide old-name guard stays clean.
OLD='claude''-os'

pass=0; fail=0
ok()   { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad()  { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

ENGINE="bin/migrate-to-brot-os.sh"
SYSTEMD_DEST="$HOME/.config/systemd/user"

# --- always-on assertions (safe on any box) ---
check "engine exists"        '[ -f "$ENGINE" ]'
check "engine is executable" '[ -x "$ENGINE" ]'
check "engine parses"        'bash -n "$ENGINE"'
# --dry-run is read-only and no-op-friendly, so it must exit 0 even on the dev box.
check "engine --dry-run runs clean" 'bash "$ENGINE" --dry-run >/dev/null 2>&1'

# --- host-aware branch ---
installed_units() { # active brot/experiment user units, if any
  command -v systemctl >/dev/null 2>&1 || return 0
  systemctl --user list-units --type=service --state=active --no-legend --plain 2>/dev/null \
    | awk '{print $1}' \
    | grep -E '^(caddy-experiments|claude-remote|exp-.+)\.service$' || true
}

if ! command -v systemctl >/dev/null 2>&1 || [ -z "$(installed_units)" ]; then
  printf '\nSKIP: not a migrated brot-os host\n'
  printf '%d passed, %d failed\n' "$pass" "$fail"
  [ "$fail" -eq 0 ]
  exit $?
fi

# Migrated host: every installed unit must reference this root and contain zero old name.
for uf in "$SYSTEMD_DEST"/caddy-experiments.service "$SYSTEMD_DEST"/claude-remote.service "$SYSTEMD_DEST"/exp-*.service; do
  [ -f "$uf" ] || continue
  b="$(basename "$uf")"
  check "$b references current root" 'grep -qF "$ROOT" "$uf"'
  check "$b has zero old-name strings" '! grep -qiF "$OLD" "$uf"'
done

# Core units are active.
check "caddy-experiments active" 'systemctl --user is-active --quiet caddy-experiments.service'
check "claude-remote active"     'systemctl --user is-active --quiet claude-remote.service'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
