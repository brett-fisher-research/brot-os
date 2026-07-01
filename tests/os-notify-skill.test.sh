#!/usr/bin/env bash
# Asserts the os-notify skill exists, is renamed, and has the correct CLI path.
set -euo pipefail

SKILL="$(cd "$(dirname "$0")/.." && pwd)/.claude/skills/os-notify/SKILL.md"

fail() { echo "FAIL: $1" >&2; exit 1; }

[ -f "$SKILL" ] || fail "SKILL.md not found at $SKILL"

grep -q '^name: os-notify$' "$SKILL" || fail "frontmatter 'name: os-notify' missing"

grep -q '\$BROT_OS_ROOT/services/telegram-bot' "$SKILL" || fail "correct CLI path '\$BROT_OS_ROOT/services/telegram-bot' missing"

# No hardcoded home-path literals: the skill must reference the configurable root.
# Patterns built via concatenation so this file stays clean for the tree-wide guard.
if grep -Eq "~/(claude|brot)""-os" "$SKILL"; then
  fail "hardcoded home-path literal present — use \$BROT_OS_ROOT"
fi

# Stale path must be gone. Blank out the valid '.../services/telegram-bot' occurrences
# first, so only a genuine stale '~/services/telegram-bot' can match.
if sed 's#\$BROT_OS_ROOT/services/telegram-bot#XXX#g' "$SKILL" | grep -q '~/services/telegram-bot'; then
  fail "stale path '~/services/telegram-bot' still present"
fi

# Prose rules: refer to the user as "the user", never by name; no ** markdown emphasis.
if grep -q 'Brett' "$SKILL"; then
  fail "contains 'Brett' — refer to 'the user' instead"
fi

if grep -q '\*\*' "$SKILL"; then
  fail "contains '**' markdown emphasis — strip it"
fi

echo "PASS: os-notify skill"
