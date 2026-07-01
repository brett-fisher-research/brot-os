---
name: brot-bot
description: Spin up ONE background coding agent to build a BROT_PLAN.md off-thread, so the main thread (the PM) stays free to chat while the code gets written. The agent codes like normal Claude Code, writes a test per leaf, ticks its own boxes, and raises the PR. Continues persistent "brot mode" from /brot-plan. Use when the user says "/brot-bot", "build the plan", or wants the brot plan executed.
---

# Brot Bot
One job: execute `BROT_PLAN.md` via a single background coding agent. Continues brot mode from [/brot-plan](../brot-plan/SKILL.md) — stay in it across turns; end only at `/brot-done`.

On entry, print this block:

```
🥨 BROT MODE · BUILDING
```

## The split (strict SRP)
Two roles, one boundary that never blurs:

- PM (this main thread): spins up the coding agent, watches it, relays status, keeps chatting with the user. The PM NEVER writes code and NEVER raises the PR — but the PM DOES run `/merge` later (after the user approves), because only the human's direct approval on the main thread can clear the merge guard.
- brot-bot (the background coding agent): owns the dev lifecycle up to the PR — code, tests, raise `/pr`. It NEVER merges and NEVER does PM work (no planning, no talking to the user about scope).

The point of the background agent: the code gets written off-thread, so the main context stays clean and the main thread stays free to chat while the build runs.

## Spinning up the agent
- Launch ONE background coding agent — a single engineer, not a crowd.
- Feed it `BROT_PLAN.md` as its spec, plus the skills philosophy and any conventions it needs.
- It builds the leaves in dependency order, exactly like a normal Claude Code session — just off the main thread.

## What the agent does per leaf
- Writes the leaf's SPECIFIC test before/with the code. Bash assertion tests (`tests/*.test.sh`) are a first-class choice alongside vite — use whichever proves the behavior most directly. Bash tests are NOT a fallback.
- Makes that test pass and keeps the whole suite green.
- Ticks its OWN checkboxes in `BROT_PLAN.md` (both the task box and its 📋 test box) as each leaf lands.
- Reads `.logs/` for dev-server / browser output when behavior needs eyeballing (see `/brot-dev`).

## Finishing
When every box is checked and the suite is green, the coding agent raises the PR via `/pr` — branch, commit every step, push, open. It does NOT merge; the PM merges later in `/brot-done`, once the user approves. It reports a concise status back to the PM (what shipped, test counts, PR URL, manual-verify notes).

- Commits and the PR are the durable public record — they must stand on their own. NEVER reference the plan's internal structure in them: no section names (e.g. "Section A"), no leaf labels (e.g. "A1"), no mention of `BROT_PLAN.md`. Describe WHAT changed and WHY, as if the plan never existed. The gitignored plan is scratch; it does not travel into git history.

## Hand off
`/brot-done` when the plan is drained and the PR is up.
