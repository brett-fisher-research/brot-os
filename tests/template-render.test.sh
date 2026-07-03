#!/usr/bin/env bash
# Asserts templates render as real tables in the CLI: code fences delimit banner art
# only, markdown tables sit outside every fence, status.md documents URL link-shortening,
# and CLAUDE.md carries the unfenced-tables preference.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

TDIR=.claude/skills/brot-template/templates

# True when a file has a markdown table separator row (|---|-style) inside a ``` fence.
fenced_table_sep() {
  awk 'BEGIN{inf=0}
       /^```/{inf=1-inf; next}
       inf && /^[[:space:]]*\|[[:space:]:|-]*-[[:space:]:|-]*\|?[[:space:]]*$/ {found=1}
       END{exit found?0:1}' "$1"
}

# True when a file has a markdown table separator row outside every fence.
unfenced_table_sep() {
  awk 'BEGIN{inf=0}
       /^```/{inf=1-inf; next}
       !inf && /^[[:space:]]*\|[[:space:]:|-]*-[[:space:]:|-]*\|?[[:space:]]*$/ {found=1}
       END{exit found?0:1}' "$1"
}

# --- no template hides a table inside a fence --------------------------------
for t in "$TDIR"/*.md; do
  check "$(basename "$t") has no table separator inside a fence" "! fenced_table_sep '$t'"
done

# --- status template: table unfenced, frontmatter carries the rules ----------
STATUS=$TDIR/status.md
check "status.md table separator sits outside the fence" "unfenced_table_sep '$STATUS'"
check "status.md frontmatter says the fence delimits banner art only" \
  "grep -qi 'banner art only' '$STATUS'"
check "status.md frontmatter mandates URL link-shortening in cells" \
  "grep -qi 'shorten' '$STATUS' && grep -qF '[#21](url)' '$STATUS'"

# --- CLAUDE.md: unfenced-table preference -------------------------------------
check "CLAUDE.md states tables print unfenced" 'grep -qi "unfenced" CLAUDE.md'
check "CLAUDE.md prefers table output for structured info" \
  'grep -qi "table output for structured info" CLAUDE.md'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
