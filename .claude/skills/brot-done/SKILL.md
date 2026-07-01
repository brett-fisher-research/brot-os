---
name: brot-done
description: End brot mode and clean up. The PM (main thread) merges the open PR after the user approves, then teardown stops the dev-server and coding-agent background agents, verifies every box in BROT_PLAN.md is checked, and deletes the gitignored plan file. Use when the user says "/brot-done", "end brot mode", or the brot build is finished and merged.
---

# Brot Done
One job: end brot mode (entered via [/brot-plan](../brot-plan/SKILL.md)) and clean up.

## Merge (the PM's job)
- The PM (main thread) runs `/merge` on the open PR — but only after the user approves it. Merging lives on the main thread because the permission guard blocks a background agent from merging a PR it authored on a relayed approval; only the human's direct approval, on the main thread, counts. The coding agent (`/brot-bot`) never merges — it stops at raising `/pr`.

## Teardown
- Stop the dev-server background agent from `/brot-dev`.
- Stop the `/brot-bot` coding agent.
- Verify EVERY box in `BROT_PLAN.md` is checked. If any remain unchecked, WARN — list them — and require explicit confirmation before proceeding.
- Delete the gitignored `BROT_PLAN.md`. The durable record is the merged PRs, not this scratch file.

Then print this block:

```
🥨 BROT MODE ENDED 👋
```
