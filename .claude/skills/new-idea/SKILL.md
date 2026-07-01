---
name: new-idea
description: Capture an idea or piece of research into the backlog as a markdown file under data/feature-ideas/. Use when the user says "/new-idea", "save this idea", "add to the backlog", "note this down for later", or describes something to build/explore later without building it now. The idea can be about the experiments platform itself (category platform) or a future experiment to build (category experiment). PROACTIVELY suggest this skill whenever a new idea surfaces in conversation that isn't being built right now — offer to save it with /new-idea.
argument-hint: "[the idea — or invoke bare to capture the one we were just discussing]"
allowed-tools: Bash Read Write
---

# New idea

Save an idea into the backlog at `$BROT_OS_ROOT/data/feature-ideas/<slug>.md`. The home
dashboard reads this directory at request time, so the idea appears at `/ideas/<slug>` with no
rebuild. See `$BROT_OS_ROOT/data/feature-ideas/README.md` for the schema.

The idea is in `$ARGUMENTS`. If invoked bare, capture the idea from the recent conversation.

## Steps

1. **Pick a slug.** Kebab-case, short, unique. Check for collisions:
   ```bash
   ls $BROT_OS_ROOT/data/feature-ideas/
   ```
   If the slug exists, either update that file (if it's the same idea) or pick a new slug.

2. **Classify** (infer from the idea; ask ONE question only if genuinely ambiguous):
   - `category: platform` — an idea about the experiments platform/infrastructure itself
     (hosting, the dashboard, the skills, analytics, the registry, etc.).
   - `category: experiment` — an app/experiment to build later.
   - `status: idea` by default (use `researching` if it already has substantial research).

3. **Write** `$BROT_OS_ROOT/data/feature-ideas/<slug>.md` with full frontmatter and a
   structured body. Use today's date for `created` (get it with `date +%F`):
   ```markdown
   ---
   slug: <slug>
   title: <human-readable title>
   category: platform | experiment
   status: idea
   tags: [<a>, <b>]
   created: <YYYY-MM-DD>
   ---

   ## Summary
   One short paragraph capturing the core idea.

   ## Details / Research
   Flesh out what we discussed — context, approach, any research, links.

   ## Pros / Cons     (or "## Next steps")
   ...

   ## Open questions
   ...
   ```
   Capture the actual substance discussed — don't write a stub. If real research/tradeoffs came
   up in the conversation, include them.

4. **Confirm**: print the file path and note it's live on the dashboard at
   `https://intel-nuc.mullet-ostrich.ts.net/ideas/<slug>` (no rebuild needed).

## Proactive use

If, during any conversation, a new idea comes up — for the platform or for a future experiment —
that the user isn't building right then, offer to save it: "Want me to `/new-idea` that?" Only
act after they agree (or just do it if they clearly asked to remember it).
