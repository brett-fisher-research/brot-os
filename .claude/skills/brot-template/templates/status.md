---
description: >
    The PM's status report during a build. Printed on EVERY state change — dispatch, agent report-back, PR opened, review handoff, merge, agent stopped — and whenever the user asks "status". Exactly one table per state change, covering ALL current work items, not just the one that changed.

    One markdown table, one row per work item. Work: the item in a few words. Agent: working | raising PR | waiting for human review | stopped | done. PR: the PR link, or — if none yet. PR status: not created | open | merged. No work items? Say "none".

---

```
╔═══════════════════════════════════════╗
║  🥨 📡  STATUS                          ║
╚═══════════════════════════════════════╝

| Work | Agent | PR | PR status |
|------|-------|----|-----------|
| <item in a few words> | <working / raising PR / waiting for human review / stopped / done> | <PR link or —> | <not created / open / merged> |
```
