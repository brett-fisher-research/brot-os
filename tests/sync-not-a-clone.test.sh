#!/usr/bin/env bash
# Asserts a manifest entry whose dir exists as a PLAIN directory inside a parent git
# repo (e.g. .brot/ hand-made inside brot-os) is reported `failed` with a
# not-a-clone message and a non-zero exit — never falsely `synced` (git walking up
# to the parent repo used to make the engine sync/report the parent). The parent
# repo must be left untouched, and the engine must not auto-delete or auto-clone
# into the existing dir.
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

seed_remote "$TMP/tenant.git"
TENANT_URL="$(echo "$TMP/tenant.git" | sed 's|\\|/|g')"

# os/ is BASE and is itself a git repo (the parent, standing in for brot-os).
mkdir -p "$TMP/os"
( cd "$TMP/os" \
  && git init -q \
  && git config user.email test@test && git config user.name test \
  && echo parent > parent.txt && git add . && git commit -qm parent )
parent_head="$(git -C "$TMP/os" rev-parse HEAD)"

# The bug setup: the entry dir exists as a plain directory inside the parent repo.
mkdir -p "$TMP/os/.brot"
echo scratch > "$TMP/os/.brot/notes.txt"

cat > "$TMP/os/manifest.json" <<EOF
[
  { "dir": ".brot", "repo": "$TENANT_URL" }
]
EOF
export BROT_SYNC_MANIFEST="$TMP/os/manifest.json"

out="$(node bin/sync.mjs 2>&1)"; rc=$?

check "run exits non-zero" '[ "$rc" -ne 0 ]'
check "report line says failed .brot" 'echo "$out" | grep -qE "^failed +\.brot"'
check "detail names the not-a-clone cause" 'echo "$out" | grep -q "exists but is not a git clone of"'
check "detail says move it aside and re-run" 'echo "$out" | grep -q "move it aside and re-run"'
check ".brot never reported synced" '! echo "$out" | grep -qE "^synced +\.brot"'

# the parent repo is untouched
check "parent repo HEAD unchanged" '[ "$(git -C "$TMP/os" rev-parse HEAD)" = "$parent_head" ]'
check "parent worktree still clean of engine writes" '[ -f "$TMP/os/parent.txt" ]'
# no auto-delete, no auto-clone into the existing dir
check "plain dir contents preserved" '[ -f "$TMP/os/.brot/notes.txt" ]'
check "no clone landed inside the plain dir" '[ ! -e "$TMP/os/.brot/.git" ]'
check "tenant file never appeared" '[ ! -f "$TMP/os/.brot/file.txt" ]'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
