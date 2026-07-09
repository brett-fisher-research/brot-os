#!/usr/bin/env bash
# Asserts the tenant manifest has moved OUT of tracked brot-os into the .brot workspace:
# a root sync.manifest.json is untracked AND gitignored (a regenerated one stays local).
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

check "root sync.manifest.json is NOT tracked" '[ -z "$(git ls-files sync.manifest.json)" ]'
check "root sync.manifest.json is gitignored" 'git check-ignore -q sync.manifest.json'
check ".gitignore names the workspace manifest path" 'grep -q "sync.manifest.json" .gitignore'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
