# claude-os

A **virtual AI OS**: a home-directory workspace driven almost entirely through Claude Code
**skills**, where the skills are the commands, the kernel is the hosting machinery, and your
projects live as self-contained repos inside well-known directories.

> Status: **custom-first**. Built for Brett's setup right now; wording in skills/kernel may be
> Brett-specific. Genericizing into a clean open-source blueprint is deliberate later work.

## The model (think Unix)

| Unix | claude-os |
|------|-----------|
| `/bin`, coreutils | `.claude/skills/` — the commands you drive everything with |
| kernel + init | `bin/` + `systemd/` — Caddy/systemd/tailscale/cloudflare render + publish |
| `/etc` (config) | `config/` — secrets + env, **gitignored**, never tracked |
| man pages / FHS | per-directory `CLAUDE.md` blueprints |
| shared libs | `packages/` |
| daemons | `services/` |
| installed programs | `apps/` |
| `/tmp`, scratch | `experiments/` |
| `/home`, `/srv` | your tenant repos (your content) |

## What this repo tracks vs. doesn't

`claude-os` tracks **only the OS layer**: skills, the kernel (`bin/`, `systemd/`, `templates/`),
the per-directory `CLAUDE.md` blueprints, the generic `packages/notify`, and `config/*.example`
templates. **Everything else is a tenant** — its own git repo living inside a container dir,
**gitignored** by claude-os (`*` + `!.gitignore` + `!CLAUDE.md` per dir; `packages/` also keeps
`notify/`). No submodules. claude-os is the OS; your projects are userland.

## Mechanism vs. config (the core discipline)

Code is **mechanism** (tracked, generic). Anything specific to a host/account/secret is
**config** (injected, gitignored). The kernel ships the *how*; `config/` supplies the *what*
(your domain, your tailnet, your tokens). When something is Brett-specific, push it toward
`config/`, not into tracked code.

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
