---
description: >
    The PM's status report during a build: what's running and what's waiting on the user. Print it whenever an agent reports back, a PR opens, or the user asks "status".

    Two sections. Running agents: one line per background subagent — name, repo, goal (short), state (working | raising PR | stopped). Open PRs: one line per PR — repo, PR link, one-line summary of the change, and what the user should verify. Empty section? Say "none".

---

```
╔═══════════════════════════════════════╗
║  🥨 📡  STATUS                          ║
╚═══════════════════════════════════════╝

## Running agents
- <name> · <repo> · <goal in a few words> · <state>

## Open PRs
- <repo> · <PR link> — <one-line change> · verify: <what to check>
```
