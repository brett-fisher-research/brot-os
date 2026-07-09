#!/usr/bin/env bash
# Asserts the string-level rebrand to brot-os: package scope, env var, and that the
# kernel/test surface carries no old-name strings.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Build the old-name patterns via concatenation so this file never contains the
# contiguous literal (keeps the tree-wide acceptance guard able to scan tests too).
OLD='claude''-os'
SCOPE_OLD='@claude''-os'

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

# Package scope.
check "package.json name is @brot-os/notify" \
  'grep -q "\"name\": \"@brot-os/notify\"" packages/notify/package.json'
check "no old package scope under packages/notify" \
  '[ "$(grep -rl "$SCOPE_OLD" packages/notify | wc -l)" -eq 0 ]'

# Non-doc string surface is clean (case-insensitive).
for d in bin tests; do
  check "no old name under $d/" \
    "[ \"\$(grep -rIil \"\$OLD\" $d | wc -l)\" -eq 0 ]"
done

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
