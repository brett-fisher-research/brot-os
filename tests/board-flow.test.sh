#!/usr/bin/env bash
# Asserts the board-centric workflow: brot-board runs the whole loop (plan proposal,
# go-gate dispatch, review, ship gate), retired skills are gone, docs carry the
# standing rules + opinions, templates match the flow, and .brot/ is plumbing-ready.
set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

pass=0; fail=0
ok()  { pass=$((pass+1)); printf '  ok   - %s\n' "$1"; }
bad() { fail=$((fail+1)); printf '  FAIL - %s\n' "$1"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1"; fi; }

# Assembled so this tracked file never contains the retired names/paths verbatim.
OLD_TRACKER='BROT_''PLAN.md'

# --- CLAUDE.md: standing constitution -------------------------------------
check "CLAUDE.md has an Opinions section" 'grep -q "^## Opinions" CLAUDE.md'
check "CLAUDE.md numbers at least 9 opinions" 'grep -cE "^[0-9]+\. " CLAUDE.md | awk "{exit (\$1>=9)?0:1}"'
check "CLAUDE.md states the PM-never-codes rule" 'grep -q "NEVER writes code" CLAUDE.md'
check "CLAUDE.md names the ship vocabulary" 'grep -q "done, finish, cleanup, ship it" CLAUDE.md'
check "CLAUDE.md names the go vocabulary" 'grep -Fq "\"go\", \"build it\"" CLAUDE.md'
check "CLAUDE.md documents goal contracts" 'grep -qi "goal contract" CLAUDE.md'
check "CLAUDE.md caps one subagent per repo" 'grep -qi "one subagent max per repo" CLAUDE.md'
check "CLAUDE.md documents the plan archive dir" 'grep -q "\.brot/plans/" CLAUDE.md'
check "CLAUDE.md documents board entry as mandatory" 'grep -q "/brot-board" CLAUDE.md'

for cmd in plan bot done; do
  check "CLAUDE.md has no /brot-$cmd command" "! grep -q \"brot-$cmd\" CLAUDE.md"
  check "README has no /brot-$cmd command" "! grep -q \"brot-$cmd\" README.md"
done

# --- README: newcomer mirror -----------------------------------------------
check "README has an Opinions section" 'grep -q "^## Opinions" README.md'
check "README has a Workflow section" 'grep -q "^## Workflow" README.md'
check "README notes .brot/" 'grep -q "\.brot/" README.md'

# --- brot-board: the whole loop lives here ---------------------------------
BOARD=.claude/skills/brot-board/SKILL.md
check "brot-board exists" "[ -f $BOARD ]"
check "brot-board keeps the never-nudge rule" "grep -qi 'never nudge toward action' $BOARD"
check "brot-board describes plan proposal" "grep -qi 'plan proposal' $BOARD"
check "brot-board writes plan files to .brot/plans/" "grep -q '\.brot/plans/' $BOARD"
check "brot-board describes dispatch" "grep -qi 'dispatch' $BOARD"
check "brot-board dispatches goal contracts" "grep -qi 'goal contract' $BOARD"
check "brot-board describes the ship gate" "grep -qi 'ship gate' $BOARD"
check "brot-board keeps the entry block" "grep -q 'BROT BOARD' $BOARD"
check "brot-board requires humansteps on PR handoff" "grep -qi 'humansteps' $BOARD"

# --- retired skills are gone ------------------------------------------------
for s in plan bot done; do
  check "retired skill dir brot-$s absent" "[ ! -e .claude/skills/brot-$s ]"
done

# --- brot-template: list matches disk ---------------------------------------
TDIR=.claude/skills/brot-template/templates
TSKILL=.claude/skills/brot-template/SKILL.md
for t in goal plan humansteps status shipped; do
  check "template $t.md on disk" "[ -f $TDIR/$t.md ]"
  check "brot-template lists $t" "grep -q '^- \`$t\`' $TSKILL"
done
check "exactly 5 templates on disk" '[ "$(ls "$TDIR" | wc -l)" -eq 5 ]'

# --- every template opens with an ASCII box header ---------------------------
for t in goal plan humansteps status shipped; do
  check "template $t.md has a box header" \
    "grep -q '╔' $TDIR/$t.md && grep -q '║' $TDIR/$t.md && grep -q '╚' $TDIR/$t.md"
done

# --- plan template ------------------------------------------------------------
PLAN=$TDIR/plan.md
check "plan template forbids coordinate labels" "grep -qi 'forbid' $PLAN"
check "plan template body has no coordinate labels" \
  '! sed -n "/^\`\`\`/,/^\`\`\`/p" "$PLAN" | grep -qE "\b[A-Z][0-9]+\b"'
check "plan template notes the tracker file convention" "grep -q '\.brot/plans/' $PLAN"
check "plan template has a verification section" "grep -qi 'verification' $PLAN"

# --- status template ----------------------------------------------------------
STATUS=$TDIR/status.md
check "status template exists" "[ -f $STATUS ]"
check "status template has running-agents section" "grep -qi 'running agents' $STATUS"
check "status template has open-PRs section" "grep -qi 'open PRs' $STATUS"

# --- shipped template -----------------------------------------------------------
SHIPPED=$TDIR/shipped.md
check "shipped template exists" "[ -f $SHIPPED ]"
check "shipped template has an ASCII box" "grep -q '╔' $SHIPPED && grep -q '╚' $SHIPPED"
check "shipped template announces the ship" "grep -q 'SESSION SHIPPED' $SHIPPED"
for section in Merged Stopped Plan; do
  check "shipped template has $section section" "grep -q '^$section' $SHIPPED"
done

# --- humansteps template ----------------------------------------------------------
check "humansteps mandates verify on PR handoff" \
  'grep -qi "PR handoff" "$TDIR/humansteps.md"'

# --- plumbing ------------------------------------------------------------------
check ".brot/ is gitignored" 'git check-ignore -q .brot/plans/x.md'
check "no retired tracker filename in tracked files" \
  '[ "$(git grep -I -l "$OLD_TRACKER" -- . | wc -l)" -eq 0 ]'
# Lines that name the forbidden style in order to ban it are exempt.
check "no coordinate labels in docs or skills" \
  '! git grep -IhE "\b[A-Z][0-9]+\b" -- CLAUDE.md README.md ".claude/skills" | grep -v "style" | grep -qE "\b[A-Z][0-9]+\b"'

printf '\n%d passed, %d failed\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
