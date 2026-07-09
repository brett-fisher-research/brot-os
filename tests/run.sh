#!/usr/bin/env bash
# Test runner: execute every tests/*.test.sh AND the vitest suites; fail if any is red.
# Usage: bash tests/run.sh
set -u

DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"

total=0; failed=0
for t in "$DIR"/*.test.sh; do
  [ -e "$t" ] || continue
  total=$((total+1))
  printf '\n=== %s ===\n' "$(basename "$t")"
  if bash "$t"; then
    :
  else
    failed=$((failed+1))
    printf 'RED: %s\n' "$(basename "$t")"
  fi
done

# vitest suites (setup core matrix + effects) — one unit in the tally
printf '\n=== vitest (tests/*.test.ts) ===\n'
total=$((total+1))
if ( cd "$ROOT" && npm run --silent test:unit ); then
  :
else
  failed=$((failed+1))
  printf 'RED: vitest\n'
fi

printf '\n----- %d test unit(s), %d failed -----\n' "$total" "$failed"
[ "$failed" -eq 0 ]
