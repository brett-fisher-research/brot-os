---
description: >
    The ship-gate closing report, printed once after the PM merges approved PRs, stops all subagents, and verifies the plan file's boxes. The last thing the user sees for a session's build.

    Three bullet sections. Merged: each PR landed (repo, PR link, one-line change). Stopped: each background agent torn down. Plan: the plan file's path in .brot/plans/ and its box tally (files stay forever — never deleted).

---

```
╔═══════════════════════════════════════╗
║  🥨 ✅  SESSION SHIPPED                ║
╚═══════════════════════════════════════╝

Merged
- <repo> · <PR link> — <one-line change>

Stopped
- <agent name> · <repo>

Plan
- <.brot/plans/<file>> — <n>/<n> boxes ticked, archived
```
