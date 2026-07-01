#!/usr/bin/env bash
# Acceptance guard: nothing in the tracked tree still carries the old name.
# Scans every tracked file (case-insensitive) for the old repo name, the old root
# env var, and the old package scope. The forbidden strings are built via
# concatenation so this guard file itself never contains them.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

NAME_OLD='claude''-os'
ENV_OLD='CLAUDE_OS''_ROOT'
SCOPE_OLD='@claude''-os'

status=0
scan() { # scan <label> <pattern>
  local label="$1" pat="$2" hits
  hits="$(git ls-files -z | xargs -0 grep -Iil -e "$pat" 2>/dev/null || true)"
  if [ -n "$hits" ]; then
    printf 'FAIL: tracked files still contain %s:\n%s\n' "$label" "$hits" >&2
    status=1
  else
    printf '  ok   - no %s in tracked tree\n' "$label"
  fi
}

scan "old repo name" "$NAME_OLD"
scan "old root env var" "$ENV_OLD"
scan "old package scope" "$SCOPE_OLD"

[ "$status" -eq 0 ] && echo "PASS: acceptance guard clean"
exit "$status"
