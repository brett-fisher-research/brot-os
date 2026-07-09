#!/usr/bin/env bash
# Living invariant: PRIVACY. A personal tenant manifest lists the user's own repos;
# it lives in the .brot workspace layer and must NEVER be tracked in framework brot-os.
# A contributor who commits a root sync.manifest.json would leak private tenants - this
# asserts the root manifest stays untracked AND gitignored so a stray one can't ship.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

check "a personal manifest is never tracked at the root" '[ -z "$(git ls-files sync.manifest.json)" ]'
check "a stray root manifest is gitignored" 'git check-ignore -q sync.manifest.json'
check ".gitignore covers the manifest filename" 'grep -q "sync.manifest.json" .gitignore'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
