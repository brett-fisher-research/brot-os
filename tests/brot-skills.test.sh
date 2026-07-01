#!/usr/bin/env bash
# Asserts the six brot-* skills are in-repo, git-tracked, with intact frontmatter
# and no old-name references.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

OLD='claude''-os'

for s in board plan bot done dev template; do
  skill=".claude/skills/brot-$s/SKILL.md"
  check "brot-$s SKILL.md exists" "[ -f '$skill' ]"
  check "brot-$s frontmatter name intact" "grep -q '^name: brot-$s\$' '$skill'"
done

# brot-template ships its templates/ subdir, git-tracked.
check "brot-template/templates/ is tracked and non-empty" \
  '[ -n "$(git ls-files .claude/skills/brot-template/templates/)" ]'

# No old-name references survive in the moved skills.
check "no old name under brot-* skills" \
  '[ "$(grep -rIil "$OLD" .claude/skills/brot-* | wc -l)" -eq 0 ]'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
