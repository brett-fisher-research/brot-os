#!/usr/bin/env bash
# Asserts the npm wiring for sync: package.json points sync -> node bin/sync.mjs and
# the engine file exists. Instant, no network - a live sync is proven by sync-engine.test.sh.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

check "package.json wires sync -> bin/sync.mjs" 'node -e "const p=require(\"./package.json\"); process.exit(p.scripts.sync===\"node bin/sync.mjs\"?0:1)"'
check "bin/sync.mjs exists" '[ -f bin/sync.mjs ]'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
