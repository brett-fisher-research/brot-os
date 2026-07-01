#!/usr/bin/env bash
# Asserts the kernel resolves its own repo root and bakes no fixed install path:
# self-locating ROOT, notify.sh env file derived from ROOT, systemd units injected
# via @@ROOT@@ at setup, and skills that reference the configurable root.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Old-name path fragments built via concatenation so this file stays guard-clean.
OLD='claude''-os'

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

# Self-locating ROOT. Copy lib.sh into a throwaway repo, source it with no env set,
# and confirm ROOT resolves to that repo root (not a hardcoded home path).
tmp="$(mktemp -d)"
mkdir -p "$tmp/bin"
cp bin/lib.sh "$tmp/bin/lib.sh"
resolved="$(cd /; bash -c 'source "'"$tmp"'/bin/lib.sh"; echo "$ROOT"')"
check "lib.sh ROOT self-locates to its own repo" '[ "$resolved" = "$tmp" ]'
rm -rf "$tmp"
check "no HOME/brot-os fallback in lib.sh" '! grep -q "HOME/brot-os" bin/lib.sh'
check "no old-name HOME fallback in lib.sh" '! grep -q "HOME/$OLD" bin/lib.sh'

# notify.sh derives its env file from ROOT via lib.sh, no home-path literal.
check "notify.sh sources lib.sh" 'grep -q "lib.sh" bin/notify.sh'
check "notify.sh has no HOME/...os literal" \
  '! grep -Eq "HOME/[a-z]*-os" bin/notify.sh'

# systemd install path injected, not baked.
check "no baked %h/brot-os in unit templates" \
  '[ "$(grep -rl "%h/brot-os" systemd | wc -l)" -eq 0 ]'
check "no baked old-name path in unit templates" \
  '[ "$(grep -rl "%h/$OLD" systemd | wc -l)" -eq 0 ]'
check "caddy unit uses @@ROOT@@ placeholder" \
  'grep -q "@@ROOT@@" systemd/caddy-experiments.service'
check "bootstrap substitutes @@ROOT@@ with the resolved root" \
  'grep -q "s|@@ROOT@@|\$ROOT|g" bin/bootstrap.sh'
# Render a unit against a fake ROOT the way bootstrap does; assert it lands in output.
fake="/opt/fake-brot-root"
rendered="$(sed -e "s|@@CADDY@@|/usr/bin/caddy|g" -e "s|@@ROOT@@|$fake|g" \
  systemd/caddy-experiments.service)"
check "rendered unit contains the injected root" \
  'printf "%s" "$rendered" | grep -q "$fake/Caddyfile"'

# Skills reference the configurable root, not a hardcoded home literal.
check "no ~/brot-os/ literals in skills" \
  '[ "$(grep -rl "~/brot-os/" .claude/skills | wc -l)" -eq 0 ]'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
