#!/usr/bin/env bash
# Asserts bin/sync.mjs recovers a clean clone left on a feature branch whose
# upstream ref was deleted (the merged --delete-branch case) — it lands on the
# default branch, fast-forwards, and reports synced (not failed).
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

# fixture: a local "remote" whose default branch is main, plus a feature branch
git init -q --bare "$TMP/remote.git"
git -C "$TMP/remote.git" symbolic-ref HEAD refs/heads/main
git clone -q "$TMP/remote.git" "$TMP/seed" 2>/dev/null
( cd "$TMP/seed" \
  && git config user.email test@test && git config user.name test \
  && git checkout -q -b main \
  && echo one > file.txt && git add . && git commit -qm one && git push -q origin main \
  && git checkout -q -b feature \
  && echo feat > feat.txt && git add . && git commit -qm feat && git push -q origin feature )

# manifest entry dir resolves relative to the manifest's directory
mkdir -p "$TMP/os"
REMOTE_URL="$(echo "$TMP/remote.git" | sed 's|\\|/|g')"
printf '[ { "dir": "tenants/fix", "repo": "%s" } ]\n' "$REMOTE_URL" > "$TMP/os/manifest.json"
export BROT_SYNC_MANIFEST="$TMP/os/manifest.json"

# clone the tenant and leave it checked out on the feature branch
node bin/sync.mjs > /dev/null 2>&1
( cd "$TMP/os/tenants/fix" && git checkout -q feature )
check "clone is on feature branch pre-sync" \
  '[ "$(git -C "$TMP/os/tenants/fix" rev-parse --abbrev-ref HEAD)" = "feature" ]'

# the merged PR case: the feature branch is deleted upstream, main advances
( cd "$TMP/seed" && git checkout -q main \
  && echo two > file2.txt && git add . && git commit -qm two && git push -q origin main \
  && git push -q origin --delete feature )

# sync must recover: prune the dead ref, land on main, ff — not hard-fail
out="$(node bin/sync.mjs 2>&1)"; rc=$?
check "orphaned-branch sync exits 0" '[ "$rc" -eq 0 ]'
check "report says synced (not failed)" 'echo "$out" | grep -q "^synced"'
check "clone landed on default branch main" \
  '[ "$(git -C "$TMP/os/tenants/fix" rev-parse --abbrev-ref HEAD)" = "main" ]'
check "clone fast-forwarded to remote commit" '[ -f "$TMP/os/tenants/fix/file2.txt" ]'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
