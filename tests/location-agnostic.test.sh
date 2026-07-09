#!/usr/bin/env bash
# Asserts the kernel bakes no fixed install path: systemd units inject their root via
# an @@ROOT@@ placeholder at setup rather than hardcoding a home path, and skills
# reference the configurable root instead of a literal.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Old-name path fragments built via concatenation so this file stays guard-clean.
OLD='claude''-os'

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

# systemd install path injected, not baked.
check "no baked %h/brot-os in unit templates" \
  '[ "$(grep -rl "%h/brot-os" systemd | wc -l)" -eq 0 ]'
check "no baked old-name path in unit templates" \
  '[ "$(grep -rl "%h/$OLD" systemd | wc -l)" -eq 0 ]'
check "caddy unit uses @@ROOT@@ placeholder" \
  'grep -q "@@ROOT@@" systemd/caddy-experiments.service'
# Render a unit against a fake ROOT the way setup does; assert it lands in output.
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
