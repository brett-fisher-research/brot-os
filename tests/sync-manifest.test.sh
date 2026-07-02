#!/usr/bin/env bash
# Asserts sync.manifest.json exists, is valid JSON, and maps the tenant repos.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

check "sync.manifest.json exists" '[ -f sync.manifest.json ]'
check "manifest is tracked (not gitignored)" '! git check-ignore -q sync.manifest.json'
check "manifest parses as a JSON array" 'node -e "const m=require(\"./sync.manifest.json\"); if(!Array.isArray(m)) process.exit(1)"'
check "manifest has >= 3 entries" 'node -e "const m=require(\"./sync.manifest.json\"); process.exit(m.length>=3?0:1)"'
check "every entry has dir + repo" 'node -e "const m=require(\"./sync.manifest.json\"); process.exit(m.every(e=>typeof e.dir===\"string\"&&typeof e.repo===\"string\")?0:1)"'
check "manifest lists the three conf repos" 'grep -q nvim-conf sync.manifest.json && grep -q tmux-conf sync.manifest.json && grep -q wezterm-conf sync.manifest.json'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
