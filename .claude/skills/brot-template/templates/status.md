---
description: >
    The PM's status report during a build. Printed on EVERY state change — dispatch, agent report-back, PR opened, review handoff, merge, agent stopped — and whenever the user asks "status". Exactly one table per state change, covering ALL current work items, not just the one that changed.

    One markdown table, one row per work item. Work: the item in a few words. Dir: the directory the agent works in, as a tenant path relative to the brot-os root (`projects/duree`, `services/foo`) — brot-os itself abbreviates to `./` since the user always works from the root. Agent: the agent's state. PR: the PR link, or — if none yet. PR status: the PR's state. No work items? Say "none".

    States render emoji + word, always this legend, never emoji alone.
    Agent: 🔨 working · 📤 raising PR · 👀 waiting for human review · 🛑 stopped · ✅ done.
    PR status: ⬜ not created · 🟢 open · 🟣 merged.

    Rendering: the code fence below delimits the banner art ONLY. The table (and any prose) prints OUTSIDE any fence — the CLI renders markdown tables as boxed tables only when unfenced; a fenced table shows raw pipes. Shorten raw URLs in table cells to link form like [#21](url) so columns stay narrow.

    Cells stay terse — a table wider than the terminal degrades into key-value blocks. Work: a few words, no parenthetical detail dumps. PR: always short link form like [#21](url). Dir: the bare tenant path or ./.

---

```
╔═══════════════════════════════════════╗
║  🥨 📡  STATUS                          ║
╚═══════════════════════════════════════╝
```

| Work | Dir | Agent | PR | PR status |
|------|-----|-------|----|-----------|
| <item in a few words> | <tenant path like projects/duree, or ./ for brot-os> | <🔨 working / 📤 raising PR / 👀 waiting for human review / 🛑 stopped / ✅ done> | <link like [#21](url) or —> | <⬜ not created / 🟢 open / 🟣 merged> |
