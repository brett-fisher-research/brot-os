---
name: brot-plan
description: Turn a goal (usually post-/brot-board) into a recursive, deterministic plan. Break the goal into big pieces, then recurse each into sub-steps until every leaf is an atomic unit of work with a verifiable test. Enters persistent "brot mode". Use when the user says "/brot-plan" or wants a fractal plan before building.
---

# Brot Plan
One job: turn a goal into a recursive, deterministic plan. This enters brot mode — a persistent build mode (plan → code → done) that survives turns and ends only at `/brot-done`, just like `/brot-board` persists until you leave it.

On entry, print this block:

```
🥨 BROT MODE · PLANNING
```

## Plan recursively (the whole point)
- Lock the high-level goal first — `/brot-template goal` is the contract for what "done" means overall.
- Break the goal into 2-3 big pieces.
- RECURSE each piece into 2-3 sub-steps, and each of those again, until every leaf is atomic — a single unit of work. The rule: don't stop at the top pieces (the old mistake); recurse all the way to atomic leaves.
- Surface only 1-3 tasks at a time per level so the plan stays skimmable.
- EVERY leaf carries a SPECIFIC, verifiable test — never a vague "done when it works".
- Order leaves by dependency so they can be built in sequence.
- Early leaf: "stand up the `tests/` harness if absent."

## Test convention
Each leaf names its own test. Two first-class choices — pick whichever proves the behavior most directly:
- Bash assertion tests (`tests/*.test.sh`): grep for required content, assert files exist/absent, `git check-ignore`, assert forbidden words are gone. Best for structural/behavioral checks that are awkward in vite. NOT a fallback — a first-class default.
- Vite tests: for JS/TS units with real logic.
A leaf is "done" only when its named test passes AND the whole suite stays green.

## Output
Use `/brot-template plan` for the shape. PRINT the recursive plan in chat for approval. THEN write it to a gitignored `BROT_PLAN.md` at the project root: nested `- [ ]` checkboxes, a 🎯 goal and a `- [ ]` 📋 test box per leaf, emojis as visual anchors.

## Hand off
Stay in brot mode. `/brot-bot` spins up the background coding agent to build the plan; `/brot-done` cleans up and exits.
