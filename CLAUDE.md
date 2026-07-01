# claude-os

A virtual AI OS: a home-directory workspace driven almost entirely through Claude Code skills.
Skills are the commands, the kernel is the hosting machinery, projects live as self-contained
repos in well-known directories.

> Status — custom-first. Built for the user's setup now; skill/kernel wording may be
> user-specific. Genericizing into a clean open-source blueprint is deliberate later work.

## Default workflow: brot 🥨

ALWAYS start in brot board mode. No exceptions. Every session, every task begins with
`/brot-board` before any research, planning, or code — no matter how small or well-defined the
ask looks. Open the board first. The brot loop is the default for all work in claude-os:

- Whiteboard — `/brot-board`. Mandatory entry point. Permissive thinking space: explore the
  codebase, search the web, weigh options, poke holes. Never nudges toward a diff. Leave only
  when the user moves to `/brot-plan`.
- Plan — `/brot-plan`. Converged thinking → recursive, deterministic plan: goal broken to atomic
  leaves, each with a specific verifiable test. Writes a gitignored `BROT_PLAN.md`. Enters brot mode.
- Implement — `/brot-bot`. ONE background coding agent builds off-thread (code + test per leaf,
  ticks its own boxes, raises `/pr`). Main thread stays PM: plans, relays status, chats, merges —
  never writes the code itself.
- Done — `/brot-done`. PM merges after you approve, tears down background agents, verifies every
  box is checked, deletes `BROT_PLAN.md`.

Support — `/brot-dev` runs the hot-reloaded dev server once in a background agent (logs to a
gitignored `.logs/`). Brot skills live in `~/.claude/skills/` (`brot-*`); NOT vendored here.

## Prose style: razor

All prose is razor style. No exceptions. Applies to chat replies, docs, READMEs, plans, commit
bodies, PR descriptions.

- Dense, skimmable, high-signal. Section heads, bullets, nested bullets, tables — not paragraphs.
- Cut every word that doesn't earn its place.
- No `*` or `**` markdown emphasis — the user dislikes it. Use headings, backticks, CAPS, or wording.
- Refer to the user as "the user" in all prose — never by name.
- When in doubt, run it through `/razor`.

## The model (think Unix)

| Unix | claude-os |
|------|-----------|
| `/bin`, coreutils | `.claude/skills/` — the commands you drive everything with |
| kernel + init | `bin/` + `systemd/` — Caddy/systemd/tailscale/cloudflare render + publish |
| `/etc` (config) | `config/` — secrets + env, gitignored, never tracked |
| man pages / FHS | this root `CLAUDE.md` — the single blueprint (see Layout) |
| shared libs | `packages/` |
| daemons | `services/` |
| installed programs | `apps/` |
| `/tmp`, scratch | `experiments/` |
| `/home`, `/srv` | your tenant repos (your content) |

## What this repo tracks vs. doesn't

claude-os tracks only the OS layer: skills, the kernel (`bin/`, `systemd/`, `templates/`), this
root `CLAUDE.md`, the generic `packages/notify`, and `config/*.example` templates.

Everything else is a tenant — its own git repo inside a container dir, gitignored by claude-os
(`*` + `!.gitignore` + `!CLAUDE.md` per dir; `packages/` also keeps `notify/`). No submodules.
claude-os is the OS; your projects are userland.

## Mechanism vs. config (the core discipline)

- Mechanism — code: tracked, generic. The kernel ships the how.
- Config — anything host/account/secret-specific: injected, gitignored. `config/` supplies the
  what (your domain, tailnet, tokens).
- When something is user-specific, push it toward `config/`, not into tracked code.

## Language default

TypeScript for anything written here (packages, services, apps). Other languages allowed when a
tool genuinely needs them — document the exception in that project's own `CLAUDE.md`.

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

All code changes in tracked claude-os and in each tenant repo go through `/pr` → `/merge`
(`/pr` branches, commits, pushes, opens the PR; `/merge` lands it).
