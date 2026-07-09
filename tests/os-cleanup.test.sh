#!/usr/bin/env bash
# platform-features cleanup tests: verify the platform-features manifest and the
# promote/demote-experiment flow are fully removed from the brot-os OS layer,
# with no dangling references.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0
ok()   { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad()  { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

# manifest + data dir gone
check "manifest file absent" '[ ! -e data/platform-features.json ]'
check "data/ dir absent"     '[ ! -d data ]'

# promote + demote scripts gone
check "promote-experiment.sh absent" '[ ! -e bin/promote-experiment.sh ]'
check "demote-experiment.sh absent"  '[ ! -e bin/demote-experiment.sh ]'

# promote-experiment skill gone
check "promote-experiment skill dir absent" '[ ! -d .claude/skills/promote-experiment ]'

# OS-layer sweep
check "no manifest/promote/demote refs in OS layer" \
  '[ "$(grep -rInE "platform-features|feat_add|feat_remove|feat_has|ensure_features|promote-experiment|demote-experiment" bin .claude/skills CLAUDE.md | wc -l)" -eq 0 ]'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
