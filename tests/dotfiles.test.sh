#!/usr/bin/env bash
# Asserts the dotfiles/ tenant container exists, ignores tenants, and is documented.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

# A1 — container scaffolding
check "dotfiles/.gitignore exists" '[ -f dotfiles/.gitignore ]'
check "dotfiles/CLAUDE.md exists" '[ -f dotfiles/CLAUDE.md ]'
check "tenant repos are ignored" 'git check-ignore -q dotfiles/some-repo'
check "CLAUDE.md is NOT ignored" '! git check-ignore -q dotfiles/CLAUDE.md'
check ".gitignore is NOT ignored" '! git check-ignore -q dotfiles/.gitignore'
check "CLAUDE.md states npm run setup convention" 'grep -q "npm run setup" dotfiles/CLAUDE.md'
check "CLAUDE.md names the three config repos" 'grep -q "nvim-conf" dotfiles/CLAUDE.md && grep -q "wezterm-conf" dotfiles/CLAUDE.md && grep -q "tmux-conf" dotfiles/CLAUDE.md'

# A2 — documented in the blueprint
check "root CLAUDE.md Layout mentions dotfiles/" 'grep -q "dotfiles/" CLAUDE.md'
check "README Layout mentions dotfiles/" 'grep -q "dotfiles/" README.md'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
