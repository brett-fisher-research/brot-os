# claude-os

A **virtual AI OS**: a home-directory workspace driven almost entirely through Claude Code
**skills**, where the skills are the commands, the kernel is the hosting machinery, and your
projects live as self-contained repos inside well-known directories.

> Status: **custom-first**. Built for Brett's setup right now; wording in skills/kernel may be
> Brett-specific. Genericizing into a clean open-source blueprint is deliberate later work.

## Default workflow: brot 🥨

**ALWAYS start in brot board mode — no exceptions.** Every session, every task begins with
`/brot-board`, before any research, planning, or code. No matter how small or well-defined the
ask looks, open the board first. The **brot workflow is the default** for all work in claude-os;
run the full loop:

1. **Whiteboard first** — `/brot-board`. The mandatory entry point. A permissive thinking space:
   explore the codebase, search the web, weigh options, poke holes. No pressure to act; it never
   nudges toward a diff. Leave the board only when the user moves to `/brot-plan`.
2. **Plan** — `/brot-plan`. Turn the converged thinking into a recursive, deterministic plan:
   break the goal into pieces, recurse to atomic leaves, each with a specific verifiable test.
   Writes a gitignored `BROT_PLAN.md`. Enters persistent brot mode.
3. **Implement in a subagent** — `/brot-bot`. ONE background coding agent builds the plan
   off-thread (code + test per leaf, ticks its own boxes, raises `/pr`). The main thread stays
   the **PM**: it plans, relays status, chats, and merges — it never writes the code itself.
4. **Done** — `/brot-done`. PM merges the PR after you approve, tears down background agents,
   verifies every box is checked, deletes `BROT_PLAN.md`.

Support: `/brot-dev` runs the hot-reloaded dev server once in a background agent (logs to a
gitignored `.logs/`). The brot skills live in `~/.claude/skills/` (`brot-*`) — they are NOT
vendored into this repo.

## The model (think Unix)

| Unix | claude-os |
|------|-----------|
| `/bin`, coreutils | `.claude/skills/` — the commands you drive everything with |
| kernel + init | `bin/` + `systemd/` — Caddy/systemd/tailscale/cloudflare render + publish |
| `/etc` (config) | `config/` — secrets + env, **gitignored**, never tracked |
| man pages / FHS | this root `CLAUDE.md` — the single blueprint (see Layout) |
| shared libs | `packages/` |
| daemons | `services/` |
| installed programs | `apps/` |
| `/tmp`, scratch | `experiments/` |
| `/home`, `/srv` | your tenant repos (your content) |

## What this repo tracks vs. doesn't

`claude-os` tracks **only the OS layer**: skills, the kernel (`bin/`, `systemd/`, `templates/`),
this root `CLAUDE.md`, the generic `packages/notify`, and `config/*.example` templates. **Everything else is a tenant** — its own git repo living inside a container dir,
**gitignored** by claude-os (`*` + `!.gitignore` + `!CLAUDE.md` per dir; `packages/` also keeps
`notify/`). No submodules. claude-os is the OS; your projects are userland.

## Mechanism vs. config (the core discipline)

Code is **mechanism** (tracked, generic). Anything specific to a host/account/secret is
**config** (injected, gitignored). The kernel ships the *how*; `config/` supplies the *what*
(your domain, your tailnet, your tokens). When something is Brett-specific, push it toward
`config/`, not into tracked code.

## Prose style: razor

**All prose is written in razor style — no exceptions.** Chat replies, docs, READMEs, plans,
commit bodies, PR descriptions: dense, skimmable, high-signal. Section heads, bullets, nested
bullets, tables — not verbose paragraphs. Cut every word that doesn't earn its place. When in
doubt, run it through `/razor`.

## Language default

**TypeScript** is the default for anything written here (packages, services, apps). Other
languages are allowed when a tool genuinely needs them — document the exception in that
project's own `CLAUDE.md`.

## Layout

```
.claude/skills/   the commands (copied from claude-experiments, wording kept for now)
bin/ systemd/ templates/   the kernel: routing, services, publishing, notify, console-check
config/           secrets + env (GITIGNORED) + *.example templates
packages/<name>/  shared modules (notify is tracked & generic; others are tenant repos)
services/<name>/  long-running daemons that own data behind an API — each its own repo
experiments/      its OWN separate repo (a tenant, NOT claude-os) holding many self-contained
                  Next.js experiments — git work lands in that repo, never claude-os (scratch/iterate)
apps/<name>/      promoted, productionized projects — each its own repo
```

## Code changes ride a PR

All code changes in tracked claude-os and in each tenant repo go through the `/pr` → `/merge`
workflow (`/pr` branches, commits, pushes, and opens the PR; `/merge` lands it). (Exception: bulk
repo *creation* via `/swarm`, where brand-new repos are
committed + pushed directly — there is no base to PR against.)
