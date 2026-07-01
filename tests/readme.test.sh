#!/usr/bin/env bash
# Asserts the README leads with brot-os and documents Layout + Quickstart for newcomers.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

OLD='claude''-os'

check "title line is # brot-os" '[ "$(head -1 README.md)" = "# brot-os" ]'
check "no old name in README" '! grep -Iiq "$OLD" README.md'

check "has ## Layout section" 'grep -q "^## Layout" README.md'
for d in bin config apps packages services systemd templates; do
  check "Layout names $d" "grep -Eq '\`$d/?\`' README.md"
done

check "has ## Quickstart section" 'grep -q "^## Quickstart" README.md'
check "Quickstart mentions bootstrap" 'grep -q "bootstrap" README.md'
check "Quickstart mentions BROT_OS_ROOT" 'grep -q "BROT_OS_ROOT" README.md'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
