#!/usr/bin/env bash
# Asserts the os-notify skill exists, is renamed, and has the correct CLI path.
set -euo pipefail

SKILL="$(cd "$(dirname "$0")/.." && pwd)/.claude/skills/os-notify/SKILL.md"

fail() { echo "FAIL: $1" >&2; exit 1; }

[ -f "$SKILL" ] || fail "SKILL.md not found at $SKILL"

grep -q '^name: os-notify$' "$SKILL" || fail "frontmatter 'name: os-notify' missing"

grep -q '~/claude-os/services/telegram-bot' "$SKILL" || fail "correct CLI path '~/claude-os/services/telegram-bot' missing"

# Stale path must be gone. Blank out the valid '~/claude-os/...' occurrences first,
# so only a genuine stale '~/services/telegram-bot' can match.
if sed 's#~/claude-os/services/telegram-bot#XXX#g' "$SKILL" | grep -q '~/services/telegram-bot'; then
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
