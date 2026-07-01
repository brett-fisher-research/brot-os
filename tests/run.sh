#!/usr/bin/env bash
# Test runner: execute every tests/*.test.sh and fail if any is red.
# Usage: bash tests/run.sh
set -u

DIR="$(cd "$(dirname "$0")" && pwd)"

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

printf '\n----- %d test file(s), %d failed -----\n' "$total" "$failed"
[ "$failed" -eq 0 ]
