#!/usr/bin/env bash
# Asserts the workspace-layer sync contract:
#   - sync pulls the .brot workspace repo FIRST, then reads .brot/sync.manifest.json
#   - manifest entry dirs resolve against the brot-os ROOT, NOT the manifest's directory
#   - a manifest change pushed to .brot's remote is picked up on the next sync (pull-first)
#   - an absent .brot fails soft: prints an `npm run setup` hint and exits non-zero
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

seed_remote() { # $1 = bare repo path
  git init -q --bare "$1"
  local s="$TMP/seed-$(basename "$1")"
  git clone -q "$1" "$s" 2>/dev/null
  ( cd "$s" \
    && git config user.email test@test && git config user.name test \
    && echo one > file.txt && git add . && git commit -qm one && git push -q origin HEAD )
}

# two tenant "remotes" and one workspace (.brot) "remote"
seed_remote "$TMP/tenant1.git"
seed_remote "$TMP/tenant2.git"
git init -q --bare "$TMP/brot.git"
T1_URL="$(echo "$TMP/tenant1.git" | sed 's|\\|/|g')"
T2_URL="$(echo "$TMP/tenant2.git" | sed 's|\\|/|g')"
BROT_URL="$(echo "$TMP/brot.git" | sed 's|\\|/|g')"

# seed the workspace remote with a manifest listing tenant1 at a ROOT-relative dir
WS_SEED="$TMP/ws-seed"
git clone -q "$TMP/brot.git" "$WS_SEED" 2>/dev/null
( cd "$WS_SEED" && git config user.email test@test && git config user.name test \
  && printf '[ { "dir": "tenants/one", "repo": "%s" } ]\n' "$T1_URL" > sync.manifest.json \
  && git add . && git commit -qm manifest && git push -q origin HEAD )

# the brot-os ROOT for this fixture; clone the workspace into <ROOT>/.brot (production layout)
mkdir -p "$TMP/os"
git clone -q "$TMP/brot.git" "$TMP/os/.brot" 2>/dev/null
export BROT_SYNC_ROOT="$TMP/os"
unset BROT_SYNC_MANIFEST   # production mode: no override, read .brot/sync.manifest.json

out1="$(node bin/sync.mjs 2>&1)"; rc1=$?
check "run exits 0" '[ "$rc1" -eq 0 ]'
check "workspace .brot is pulled first" 'echo "$out1" | grep -q "workspace .brot: pulled"'
check "tenant resolves against ROOT (<root>/tenants/one)" '[ -f "$TMP/os/tenants/one/file.txt" ]'
check "tenant did NOT resolve under the manifest dir (.brot/tenants)" '[ ! -e "$TMP/os/.brot/tenants" ]'

# pull-first proof: push a manifest change to the workspace remote, re-sync, expect tenant2
( cd "$WS_SEED" \
  && printf '[ { "dir": "tenants/one", "repo": "%s" }, { "dir": "tenants/two", "repo": "%s" } ]\n' "$T1_URL" "$T2_URL" > sync.manifest.json \
  && git add . && git commit -qm add-two && git push -q origin HEAD )

out2="$(node bin/sync.mjs 2>&1)"; rc2=$?
check "second run exits 0" '[ "$rc2" -eq 0 ]'
check "pulled manifest change brings in tenant2" '[ -f "$TMP/os/tenants/two/file.txt" ]'

# absent .brot: fail soft with a setup hint, non-zero exit
mkdir -p "$TMP/empty"
export BROT_SYNC_ROOT="$TMP/empty"
out3="$(node bin/sync.mjs 2>&1)"; rc3=$?
check "absent .brot exits non-zero" '[ "$rc3" -ne 0 ]'
check "absent .brot points at npm run setup" 'echo "$out3" | grep -q "npm run setup"'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
