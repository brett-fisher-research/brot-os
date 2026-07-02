#!/usr/bin/env bash
# Asserts bin/sync.mjs clones missing repos, is idempotent, and never touches dirty ones.
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

# fixture: a local "remote" with one commit
git init -q --bare "$TMP/remote.git"
git clone -q "$TMP/remote.git" "$TMP/seed" 2>/dev/null
( cd "$TMP/seed" \
  && git config user.email test@test && git config user.name test \
  && echo one > file.txt && git add . && git commit -qm one && git push -q origin HEAD )

# manifest: entry dir resolves relative to the manifest's directory
mkdir -p "$TMP/os/tenants"
REMOTE_URL="$(echo "$TMP/remote.git" | sed 's|\\|/|g')"
printf '[ { "dir": "tenants/fix", "repo": "%s" } ]\n' "$REMOTE_URL" > "$TMP/os/manifest.json"
export BROT_SYNC_MANIFEST="$TMP/os/manifest.json"

# run 1: clones
out1="$(node bin/sync.mjs 2>&1)"; rc1=$?
check "first run exits 0" '[ "$rc1" -eq 0 ]'
check "first run clones the repo" '[ -f "$TMP/os/tenants/fix/file.txt" ]'
check "report says cloned" 'echo "$out1" | grep -q "^cloned"'

# run 2: idempotent no-op pull
out2="$(node bin/sync.mjs 2>&1)"; rc2=$?
check "second run exits 0" '[ "$rc2" -eq 0 ]'
check "report says synced" 'echo "$out2" | grep -q "^synced"'

# remote gains a commit -> pull brings it in
( cd "$TMP/seed" && echo two > file2.txt && git add . && git commit -qm two && git push -q origin HEAD )
node bin/sync.mjs > /dev/null 2>&1
check "pull fetches new remote commit" '[ -f "$TMP/os/tenants/fix/file2.txt" ]'

# dirty repo: skipped, flagged, untouched
echo local-edit > "$TMP/os/tenants/fix/file.txt"
out3="$(node bin/sync.mjs 2>&1)"; rc3=$?
check "dirty run still exits 0" '[ "$rc3" -eq 0 ]'
check "report flags dirty" 'echo "$out3" | grep -q "^dirty"'
check "dirty edit untouched" 'grep -q local-edit "$TMP/os/tenants/fix/file.txt"'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
