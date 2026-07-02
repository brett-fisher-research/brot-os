#!/usr/bin/env bash
# Asserts the sync workflow and skills-drive-scripts philosophy are documented.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

# root blueprint
check "root CLAUDE.md documents npm run sync" 'grep -q "npm run sync" CLAUDE.md'
check "root CLAUDE.md documents /brot-sync" 'grep -q "/brot-sync" CLAUDE.md'
check "root CLAUDE.md documents sync.manifest.json" 'grep -q "sync.manifest.json" CLAUDE.md'
check "root CLAUDE.md states the skills-drive-scripts philosophy" 'grep -qi "Skills drive scripts" CLAUDE.md'

# container docs
check "dotfiles/CLAUDE.md points at root npm run sync" 'grep -q "npm run sync" dotfiles/CLAUDE.md'
check "dotfiles/CLAUDE.md references the manifest" 'grep -q "sync.manifest.json" dotfiles/CLAUDE.md'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
