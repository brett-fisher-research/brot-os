#!/usr/bin/env bash
# Asserts a manifest entry that lives directly at the brot-os root (BASE) does NOT
# turn the root into a drift-scan container: sibling root-level dirs must not be
# flagged `unlisted`, while genuine drift inside real container dirs still is.
# Also proves the root-level entry itself clones and ff-syncs (local fixtures only).
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

# two fixture "remotes": one for the root-level tenant, one for a container tenant
seed_remote "$TMP/root.git"
seed_remote "$TMP/tenant.git"
ROOT_URL="$(echo "$TMP/root.git" | sed 's|\\|/|g')"
TENANT_URL="$(echo "$TMP/tenant.git" | sed 's|\\|/|g')"

# os/ is BASE. Root-level entry ".brot" lives at BASE; "sub/one" lives under container sub/.
mkdir -p "$TMP/os"
cat > "$TMP/os/manifest.json" <<EOF
[
  { "dir": ".brot", "repo": "$ROOT_URL" },
  { "dir": "sub/one", "repo": "$TENANT_URL" }
]
EOF
export BROT_SYNC_ROOT="$TMP/os"
export BROT_SYNC_MANIFEST="$TMP/os/manifest.json"

# sibling root-level dirs that must NOT be flagged unlisted (they are kernel-like dirs)
mkdir -p "$TMP/os/bin" "$TMP/os/config"
# genuine drift: an unclaimed dir inside the real container sub/
mkdir -p "$TMP/os/sub/rogue"

out="$(node bin/sync.mjs 2>&1)"; rc=$?

check "run exits 0" '[ "$rc" -eq 0 ]'
check "root-level entry (.brot) clones" '[ -f "$TMP/os/.brot/file.txt" ]'
check "container entry (sub/one) clones" '[ -f "$TMP/os/sub/one/file.txt" ]'

# the bug: BASE-as-container would flag these root-level siblings
check "root sibling bin/ NOT flagged unlisted" '! echo "$out" | grep -q "unlisted .*[/\\\\]bin "'
check "root sibling config/ NOT flagged unlisted" '! echo "$out" | grep -q "unlisted .*[/\\\\]config "'
# the entry dir itself must never be self-flagged
check ".brot itself NOT flagged unlisted" '! echo "$out" | grep -qE "unlisted .*[/\\\\]\.brot "'

# real drift inside a real container is still surfaced
check "genuine drift sub/rogue IS flagged unlisted" 'echo "$out" | grep -q "unlisted .*rogue"'

# second run: root-level entry ff-syncs cleanly (no clone, no dirty)
out2="$(node bin/sync.mjs 2>&1)"; rc2=$?
check "second run exits 0" '[ "$rc2" -eq 0 ]'
check "root-level entry reports synced" 'echo "$out2" | grep -qE "^synced .*\.brot"'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
