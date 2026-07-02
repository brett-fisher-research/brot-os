#!/usr/bin/env bash
# Asserts the /brot-sync skill exists, drives the script, and guards against reimplementation.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

SKILL=".claude/skills/brot-sync/SKILL.md"

check "SKILL.md exists" '[ -f "$SKILL" ]'
check "has frontmatter name" 'grep -q "^name: brot-sync" "$SKILL"'
check "drives npm run sync" 'grep -q "npm run sync" "$SKILL"'
check "guards against reimplementing sync logic" 'grep -qi "NEVER reimplement" "$SKILL"'
check "references the manifest" 'grep -q "sync.manifest.json" "$SKILL"'
check "handles dirty / unlisted / failed gaps" 'grep -q "dirty" "$SKILL" && grep -q "unlisted" "$SKILL" && grep -q "failed" "$SKILL"'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
