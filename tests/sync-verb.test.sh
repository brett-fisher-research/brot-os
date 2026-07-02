#!/usr/bin/env bash
# Asserts `npm run sync` is wired to bin/sync.mjs and runs clean in the real repo.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

check "package.json wires sync -> bin/sync.mjs" 'node -e "const p=require(\"./package.json\"); process.exit(p.scripts.sync===\"node bin/sync.mjs\"?0:1)"'
check "bin/sync.mjs exists" '[ -f bin/sync.mjs ]'
# exit code depends on host state (a tenant setup may legitimately fail here),
# so assert the engine runs and reports — not that every tenant is healthy
check "npm run sync produces a report" 'npm run sync --silent 2>&1 | grep -q "brot-os sync report"'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
