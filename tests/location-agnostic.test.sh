#!/usr/bin/env bash
# Living invariant: PORTABILITY. A skill must carry no machine-specific hardcoded
# path, so a fresh clone works from any location and any user's home. A contributor
# who bakes in `~/brot-os/...` (or similar) breaks portability - this catches it.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

# Skills resolve the repo root at runtime; no home-literal path is baked in.
check "skills carry no ~/brot-os/ machine-path literal" \
  '[ "$(grep -rl "~/brot-os/" .claude/skills | wc -l)" -eq 0 ]'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
