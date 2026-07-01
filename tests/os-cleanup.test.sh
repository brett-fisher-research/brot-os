#!/usr/bin/env bash
# platform-features cleanup tests: verify the platform-features manifest and the
# promote/demote-experiment flow are fully removed from the claude-os OS layer,
# with no dangling references and all bin/*.sh still parse-clean.
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

# lib.sh manifest machinery stripped
check "lib.sh manifest symbols gone" \
  '[ "$(grep -cE "FEATURES|feat_add|feat_remove|feat_has|ensure_features" bin/lib.sh)" -eq 0 ]'
check "lib.sh parses" 'bash -n bin/lib.sh'

# promote-experiment skill gone
check "promote-experiment skill dir absent" '[ ! -d .claude/skills/promote-experiment ]'

# dangling references reworded
check "unregister-experiment.sh drops promote-experiment" \
  '[ "$(grep -c "promote-experiment" bin/unregister-experiment.sh)" -eq 0 ]'
check "unregister-experiment.sh parses" 'bash -n bin/unregister-experiment.sh'
check "new-experiment SKILL.md drops promote-experiment" \
  '[ "$(grep -c "promote-experiment" .claude/skills/new-experiment/SKILL.md)" -eq 0 ]'

# OS-layer sweep + all scripts parse
check "no manifest/promote/demote refs in OS layer" \
  '[ "$(grep -rInE "platform-features|feat_add|feat_remove|feat_has|ensure_features|promote-experiment|demote-experiment" bin .claude/skills CLAUDE.md | wc -l)" -eq 0 ]'
check "every bin/*.sh parses" \
  'for f in bin/*.sh; do bash -n "$f" || exit 1; done'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
