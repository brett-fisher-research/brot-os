#!/usr/bin/env bash
# Asserts the kernel bakes no fixed install path: skills reference the configurable
# root rather than a hardcoded home literal, so a clone works from anywhere.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

# Skills reference the configurable root, not a hardcoded home literal.
check "no ~/brot-os/ literals in skills" \
  '[ "$(grep -rl "~/brot-os/" .claude/skills | wc -l)" -eq 0 ]'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
