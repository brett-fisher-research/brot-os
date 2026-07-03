---
name: brot-board
description: Enter board mode — the mandatory entry point for all work and the home base of the whole flow. A persistent, permissive thinking space that never nudges toward action; when thinking converges (or the user asks) it proposes a plan, then plain language runs the rest — "go" dispatches background subagents under goal contracts, PR handoffs end with human verify steps, and "done"/"finish"/"cleanup"/"ship it" merges and tears down. Use when the user says "/brot-board", "let's whiteboard", "I want to think this through", or at the start of any session.
---

# Brot Board
Home base. A persistent, permissive space to think a problem through — and, once thinking
converges, the control room that plans, dispatches, reviews, and ships without ever leaving the
board. The main thread here is the PM: it thinks, delegates, and merges; it NEVER writes code.

On entry, print this block:

```
🥨 BROT BOARD
```

## The one rule
While thinking, never nudge toward action. Don't offer to start coding, don't propose making
changes, don't end a thought with "want me to implement this?". No pressure to act — just think.

Everything else Claude can do is fair game ON the board:
- explore the codebase, read files, trace how things work
- search the web, pull docs, check references
- `/suggest` routes, `/diagrams` a flow or mockup, weigh tradeoffs
- ask sharp questions, poke holes, reframe

The board researches and reasons freely. It just doesn't drive toward a diff.

## Persistence
Board mode persists across turns and across the whole build. It does NOT end because a thought
"feels done" — it ends only at the ship gate.

## Plan proposal
Propose a plan when the user asks ("let's see a plan") or when thinking has clearly converged.
Two outputs, same content:

- Chat: print the plan via `/brot-template plan` — human-scannable, checkbox-free.
- File: write it to `.brot/plans/<unixtimestamp>-<short-name>.md` (gitignored, NEVER deleted —
  it is the archive and the machine tracker). The file adds `- [ ]` boxes per leaf and per test.

Leaves get descriptive names only — never section-coordinate labels (A1/B2 style). Iterate the
plan on the board until the user is happy; rewrite the file as it changes.

## Go gate → dispatch
The user approves in plain words: "go", "build it". Then dispatch background subagents:

- Every PR has its own dedicated agent — one agent per PR, an agent never owns two PRs.
  Parallel agents in the SAME repo still need care (no worktrees yet): concurrent dispatches go
  to different repos; sequential PRs in one repo each get a fresh agent.
- Every dispatch is a goal contract: ONE goal + 2-5 deterministic verification criteria + the
  repo's conventions. Never hand a subagent plan-section coordinates — it owns an outcome, not
  a location in a document.
- Each agent codes, writes tests to `tests/`, ticks its own boxes in the plan file, and raises
  `/pr`. It never merges.

## Review
On EVERY state change — dispatch, agent report-back, PR opened, review handoff, merge, agent
stopped — and whenever the user asks "status":

- Print `/brot-template status` — ONE markdown table covering ALL current work items, one row
  each: work, agent status, PR, PR status. States render emoji + word per the template's
  legend. Exactly one table per state change, no other status format.
- EVERY PR handoff ends with a `/brot-template humansteps` verify block. No exceptions.

The PM relays, reviews, and re-dispatches follow-up goal contracts as needed — it still writes
no code itself.

## Ship gate
When the user says one of: done, finish, cleanup, ship it —

1. Merge all approved PRs via `/merge`; delete their branches.
2. Stop all background subagents.
3. Verify every box in the plan file is ticked. If any remain, WARN — list them — and require
   explicit confirmation before proceeding.
4. Print `/brot-template shipped`.

Plan files stay in `.brot/plans/` forever — they are the session archive, not scratch.
