#!/usr/bin/env bash
# Asserts the initiatives layer is wired in: initiative template exists (banner, legend,
# description frontmatter), brot-template lists it, brot-initiative skill covers its four
# verbs, brot-board carries the log + ship-gate hooks, plan.md documents the optional
# initiative frontmatter link, and CLAUDE.md documents the layer.
set -u

# Byte-match emoji: some greps (git-bash grep 3.0) miss astral-plane chars in UTF-8 locales.
export LC_ALL=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

TDIR=.claude/skills/brot-template/templates
TPL=$TDIR/initiative.md
SKILL=.claude/skills/brot-initiative/SKILL.md
BOARD=.claude/skills/brot-board/SKILL.md

# --- initiative template -------------------------------------------------------
check "initiative.md exists" "[ -f '$TPL' ]"
check "initiative.md has the INITIATIVE banner" "grep -q 'INITIATIVE' '$TPL'"
check "initiative.md frontmatter has a description key" "grep -q '^description:' '$TPL'"
check "initiative.md carries the full status legend" \
  "grep -q '🟢 active' '$TPL' && grep -q '💭 fuzzy' '$TPL' && grep -q '⬜ not started' '$TPL' \
   && grep -q '🌙 paused' '$TPL' && grep -q '🏁 done' '$TPL' && grep -q '🧊 iced' '$TPL'"
check "initiative.md states files live at .brot/initiatives/<slug>.md" \
  "grep -q '.brot/initiatives/<slug>.md' '$TPL'"
check "initiative.md forbids checkboxes" "grep -qi 'no checkboxes' '$TPL'"

# --- brot-template registration ------------------------------------------------
check "brot-template SKILL.md lists the initiative template" \
  "grep -q 'initiative' .claude/skills/brot-template/SKILL.md"

# --- brot-initiative skill -----------------------------------------------------
check "brot-initiative SKILL.md exists" "[ -f '$SKILL' ]"
for verb in Create Resume Log Close; do
  check "brot-initiative covers $verb" "grep -q '## $verb' '$SKILL'"
done
check "brot-initiative description triggers on 'start a new initiative'" \
  "grep -q 'start a new initiative' '$SKILL'"
check "brot-initiative description triggers on 'close out the initiative'" \
  "grep -q 'close out the initiative' '$SKILL'"

# --- brot-board hooks ----------------------------------------------------------
check "brot-board offers to log to an initiative while whiteboarding" \
  "grep -q '/brot-initiative' '$BOARD'"
check "brot-board ship gate appends a session log entry to the initiative" \
  "grep -qi 'session log entry' '$BOARD'"

# --- plan template link --------------------------------------------------------
check "plan.md description mentions optional initiative frontmatter" \
  "grep -q 'initiative: <slug>' '$TDIR/plan.md'"

# --- CLAUDE.md -----------------------------------------------------------------
check "CLAUDE.md has an Initiatives section" "grep -q '^## Initiatives' CLAUDE.md"
check "CLAUDE.md layout lists .brot/initiatives/" "grep -q '.brot/initiatives/' CLAUDE.md"

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
