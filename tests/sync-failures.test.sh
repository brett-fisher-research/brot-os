#!/usr/bin/env bash
# Behavior: bin/sync.mjs's failure contract. Each case feeds the engine a broken
# input and asserts the exact exit code + report string the kernel promises:
#   (a) a manifest that is not JSON, or is JSON but not an array, aborts non-zero
#   (b) a tenant whose `npm run setup` fails is reported setup=failed AND aborts non-zero
#   (c) a clean clone that has genuinely diverged from its remote is `failed`, not `synced`
#   (d) a .brot workspace with no manifest yet prints "nothing to sync" and exits 0
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

git_id() { git config user.email test@test && git config user.name test; }

# --- (a) malformed manifest ---------------------------------------------------
# not JSON at all
printf 'this is not json\n' > "$TMP/bad.json"
export BROT_SYNC_ROOT="$TMP"
export BROT_SYNC_MANIFEST="$TMP/bad.json"
outA1="$(node bin/sync.mjs 2>&1)"; rcA1=$?
check "non-JSON manifest exits non-zero" '[ "$rcA1" -ne 0 ]'
check "non-JSON manifest reports it cannot read the manifest" \
  'echo "$outA1" | grep -qi "cannot read manifest"'

# valid JSON, but an object not an array
printf '{ "dir": "x" }\n' > "$TMP/obj.json"
export BROT_SYNC_MANIFEST="$TMP/obj.json"
outA2="$(node bin/sync.mjs 2>&1)"; rcA2=$?
check "non-array manifest exits non-zero" '[ "$rcA2" -ne 0 ]'
check "non-array manifest reports it is not a JSON array" \
  'echo "$outA2" | grep -qi "not a JSON array"'

# --- (b) tenant setup failure -------------------------------------------------
git init -q --bare "$TMP/setupfail.git"
git clone -q "$TMP/setupfail.git" "$TMP/setupfail-seed" 2>/dev/null
cat > "$TMP/setupfail-seed/package.json" <<'EOF'
{ "name": "fix", "private": true, "scripts": { "setup": "node -e \"process.exit(1)\"" } }
EOF
( cd "$TMP/setupfail-seed" && git_id && git add . && git commit -qm setup && git push -q origin HEAD )

mkdir -p "$TMP/osB"
SF_URL="$(echo "$TMP/setupfail.git" | sed 's|\\|/|g')"
printf '[ { "dir": "tenants/fix", "repo": "%s" } ]\n' "$SF_URL" > "$TMP/osB/manifest.json"
export BROT_SYNC_ROOT="$TMP/osB"
export BROT_SYNC_MANIFEST="$TMP/osB/manifest.json"
outB="$(node bin/sync.mjs 2>&1)"; rcB=$?
check "failing tenant setup exits non-zero" '[ "$rcB" -ne 0 ]'
check "failing tenant setup is reported setup=failed" 'echo "$outB" | grep -q "setup=failed"'

# --- (c) diverged clean repo --------------------------------------------------
git init -q --bare "$TMP/div.git"
git -C "$TMP/div.git" symbolic-ref HEAD refs/heads/main
git clone -q "$TMP/div.git" "$TMP/div-seed" 2>/dev/null
( cd "$TMP/div-seed" && git_id && git checkout -q -b main \
  && echo one > file.txt && git add . && git commit -qm one && git push -q origin main )

mkdir -p "$TMP/osC"
DIV_URL="$(echo "$TMP/div.git" | sed 's|\\|/|g')"
printf '[ { "dir": "tenants/fix", "repo": "%s" } ]\n' "$DIV_URL" > "$TMP/osC/manifest.json"
export BROT_SYNC_ROOT="$TMP/osC"
export BROT_SYNC_MANIFEST="$TMP/osC/manifest.json"

# first sync clones cleanly
node bin/sync.mjs > /dev/null 2>&1
# clone gains a local commit on main; remote advances to a DIFFERENT commit -> diverged
( cd "$TMP/osC/tenants/fix" && git_id \
  && echo local > local.txt && git add . && git commit -qm local )
( cd "$TMP/div-seed" && echo remote > remote.txt && git add . && git commit -qm remote && git push -q origin main )

outC="$(node bin/sync.mjs 2>&1)"; rcC=$?
check "diverged clean clone exits non-zero" '[ "$rcC" -ne 0 ]'
check "diverged clean clone is reported failed (not synced)" \
  'echo "$outC" | grep -q "^failed .*tenants/fix"'
check "diverged clone is NOT silently reported synced" \
  '! echo "$outC" | grep -q "^synced .*tenants/fix"'

# --- (d) .brot present, no manifest -------------------------------------------
mkdir -p "$TMP/osD/.brot"
git init -q "$TMP/osD/.brot"
export BROT_SYNC_ROOT="$TMP/osD"
unset BROT_SYNC_MANIFEST   # production mode: read .brot/sync.manifest.json (absent)
outD="$(node bin/sync.mjs 2>&1)"; rcD=$?
check ".brot with no manifest exits 0" '[ "$rcD" -eq 0 ]'
check ".brot with no manifest prints nothing to sync" 'echo "$outD" | grep -q "nothing to sync"'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
