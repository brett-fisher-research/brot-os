#!/usr/bin/env bash
# Asserts bin/sync.mjs runs a tenant's npm setup script and flags unlisted dirs.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
# Windows node can't resolve Git Bash /tmp paths — hand it a native path
command -v cygpath > /dev/null && TMP="$(cygpath -m "$TMP")"

# fixture remote whose setup script writes a marker file next to itself
git init -q --bare "$TMP/remote.git"
git clone -q "$TMP/remote.git" "$TMP/seed" 2>/dev/null
cat > "$TMP/seed/package.json" <<'EOF'
{ "name": "fix", "private": true, "scripts": { "setup": "node -e \"require('fs').writeFileSync(require('path').join(__dirname,'marker.txt'),'ok')\"" } }
EOF
( cd "$TMP/seed" \
  && git config user.email test@test && git config user.name test \
  && git add . && git commit -qm setup && git push -q origin HEAD )

mkdir -p "$TMP/os/tenants/rogue"   # unlisted sibling dir
REMOTE_URL="$(echo "$TMP/remote.git" | sed 's|\\|/|g')"
printf '[ { "dir": "tenants/fix", "repo": "%s" } ]\n' "$REMOTE_URL" > "$TMP/os/manifest.json"
export BROT_SYNC_ROOT="$TMP/os"
export BROT_SYNC_MANIFEST="$TMP/os/manifest.json"

out="$(node bin/sync.mjs 2>&1)"; rc=$?
check "run exits 0" '[ "$rc" -eq 0 ]'
check "setup ran (marker file written)" '[ -f "$TMP/os/tenants/fix/marker.txt" ]'
check "report says setup=ran" 'echo "$out" | grep -q "setup=ran"'
check "report flags the unlisted dir" 'echo "$out" | grep -q "^unlisted .*rogue"'

# setup is re-run on every sync (idempotent by tenant convention)
rm "$TMP/os/tenants/fix/marker.txt"
node bin/sync.mjs > /dev/null 2>&1
check "setup re-runs on every sync" '[ -f "$TMP/os/tenants/fix/marker.txt" ]'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
