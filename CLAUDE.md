# brot-os

A virtual AI OS: one macro repo hosting many gitignored tenant repos, driven almost entirely
through Claude Code skills. Skills are the commands, the kernel (`bin/` + `systemd/`) is the
hosting machinery, projects live as self-contained repos in well-known directories. brot-os is
the OS; your projects are userland.

> Status — custom-first. Built for the user's setup now; skill/kernel wording may be
> user-specific. Genericizing into a clean open-source blueprint is deliberate later work.

## Opinions

The framework is opinionated. Each opinion, and why it holds:

1. Skills are the interface; deterministic mechanics live in scripts skills call (`npm run
   test/dev/setup/sync`) — judgment stays with the model, mechanics never get guessed at.
2. The main thread is a PM that never writes code — subagents do all the work, so the
   conversation stays free for steering.
3. Every subagent gets a goal contract: one goal, deterministic verification criteria — agents
   own outcomes, not step lists.
4. Tests live in `tests/`; bash assertion suites are first-class alongside vite — every claim of
   done is checkable.
5. Every repo carries a `package.json` with standard verbs: `test`, `dev`, `setup` — the same
   muscle memory works in every tenant.
6. All code changes ride a PR (`/pr` → human review → `/merge`); nothing lands directly — the
   human gate is the quality bar.
7. Mechanism vs config: tracked code is generic; anything host/account/secret-specific lives in
   gitignored `config/` — the repo stays shareable.
8. Razor prose everywhere: dense, skimmable, no bold/italic markdown emphasis, the user is "the
   user" — attention is the scarce resource.
9. brot-os is a macro repo: one OS repo hosting many gitignored tenant repos, synced via
   manifest — one clone bootstraps a whole machine.

## The workflow: board → plan → go → review → ship 🥨

ALWAYS start in board mode. No exceptions. Every session, every task begins with `/brot-board`
before any research, planning, or code — no matter how small the ask looks. The board is the one
manual entry point; everything after it moves on plain language.

- Board — `/brot-board`, mandatory. A persistent, permissive thinking space: explore the
  codebase, search the web, weigh options, poke holes. Never nudges toward action.
- Plan — proposed by the board when the user asks ("let's see a plan") or thinking has clearly
  converged. Printed in chat via the plan template (human-scannable, checkbox-free) AND written
  to `.brot/plans/<unixtimestamp>-<short-name>.md` — gitignored, NEVER deleted. The file carries
  `- [ ]` boxes per leaf + test; it is the archive and the machine tracker agents tick.
- Go gate — the user approves in plain words: "go", "build it". The PM then dispatches
  background subagents. Every PR has its own dedicated agent — one agent per PR, an agent never
  owns two PRs. No worktrees yet, so concurrent dispatches go to different repos; sequential
  PRs in one repo each get a fresh agent.
- Dispatch — every dispatch is a goal contract: one goal + 2-5 deterministic verification
  criteria + repo conventions. Subagents are NEVER given plan-section coordinates — they own an
  outcome, not a location in a document.
- Review — each agent codes, writes tests to `tests/`, ticks its boxes in the plan file, raises
  `/pr`. On EVERY state change (dispatch, agent report-back, PR opened, review handoff, merge,
  agent stopped) the PM prints the status template: ONE markdown table covering all current
  work items — work, agent status, PR, PR status. EVERY PR handoff also ends with a humansteps
  verify block.
- Ship gate — when the user says one of: done, finish, cleanup, ship it — the PM merges all
  approved PRs via `/merge`, deletes branches, stops all subagents, verifies plan boxes are
  ticked (warn + confirm if not), and prints the shipped template. Plan files stay in
  `.brot/plans/`.

Support — `/brot-dev` runs the hot-reloaded dev server once in a background agent (logs to a
gitignored `.logs/`). Brot skills live in-repo under `.claude/skills/` (`brot-*`), git-tracked
and native to brot-os. When debugging anything with a UI, agents proactively screenshot and
read the console via the chrome-devtools MCP (`/brot-peek`) BEFORE asking the user for a
screenshot. Setup prerequisite: Chrome installed per machine.

## Initiatives

Long-term AI+human goals — weeks/months, generic (a product launch, learning piano) — tracked
above plans. One file per initiative at `.brot/initiatives/<slug>.md` — gitignored, NEVER
deleted, human-readable first (emoji statuses, no checkboxes, no bold). Same board-first flow:
initiatives are created, resumed, and closed on the board. Sessions proactively route "start a
new initiative", "work on the <name> initiative", "close out the initiative" — and loggable
moments in conversation — to `/brot-initiative`. Plans an initiative spawns may link back via
optional `initiative: <slug>` frontmatter in the plan file — additive record-keeping only.

## The PM rule (standing constitution)

The main thread is the PM. It NEVER writes code — in any mode, at any point in the session,
including follow-ups after a PR. Coding, research, and writing work is ALWAYS delegated to
subagents. Code changes ride subagent → `/pr` → human review → PM `/merge`. This holds even
when a fix looks one-line trivial: skills load transiently, this rule does not.

## Skills drive scripts (the operating philosophy)

The user drives everything through skills, from the brot-os root — 99% of the time. Skills do
the judgment; deterministic work belongs in scripts the skills call, so Claude never guesses at
mechanics:

- Deterministic → npm scripts. Always simple, memorable root verbs: `npm run test`,
  `npm run sync`, `npm run setup`, `npm run dev`. Scripts are idempotent and safe to re-run.
- Judgment → skills. A skill runs the script, reads its output, verifies it worked, and handles
  the gaps (e.g. `/brot-sync` wraps `npm run sync`).
- Never `cd` into a tenant to run things by hand — root verbs and skills reach in for you.
- If a skill is hand-rolling steps a script could own, that's a bug: move the mechanics into a
  script and have the skill drive it.

## Tenant sync

`sync.manifest.json` (tracked, at root) maps tenant dirs to their remotes. `npm run sync` reads
it and per entry: clones if missing, ff-only pulls if clean, skips dirty repos, then runs the
tenant's idempotent `npm run setup` when defined — and reports (including repos on disk the
manifest doesn't list). `/brot-sync` wraps it with verification and gap-handling. Cross-machine
flow: pull brot-os, run `/brot-sync` (or `npm run sync`), done.

## Prose style: razor

All prose is razor style. No exceptions. Applies to chat replies, docs, READMEs, plans, commit
bodies, PR descriptions.

- Dense, skimmable, high-signal. Section heads, bullets, nested bullets, tables — not paragraphs.
- Cut every word that doesn't earn its place.
- No `*` or `**` markdown emphasis — the user dislikes it. Use headings, backticks, CAPS, or wording.
- Refer to the user as "the user" in all prose — never by name.
- Markdown tables always print unfenced — the CLI renders them boxed only outside code fences.
  Prefer table output for structured info.
- When in doubt, run it through `/razor`.

## The model (think Unix)

| Unix | brot-os |
|------|-----------|
| `/bin`, coreutils | `.claude/skills/` — the commands you drive everything with |
| kernel + init | `bin/` + `systemd/` — Caddy/systemd/tailscale/cloudflare render + publish |
| `/etc` (config) | `config/` — secrets + env, gitignored, never tracked |
| man pages / FHS | this root `CLAUDE.md` — the single blueprint (see Layout) |
| shared libs | `packages/` |
| daemons | `services/` |
| installed programs | `projects/` |
| `/tmp`, scratch | `experiments/` |
| `/home`, `/srv` | your tenant repos (your content) |

## What this repo tracks vs. doesn't

brot-os tracks only the OS layer: skills, the kernel (`bin/`, `systemd/`, `templates/`), this
root `CLAUDE.md`, the generic `packages/notify`, and `config/*.example` templates.

Everything else is a tenant — its own git repo inside a container dir, gitignored by brot-os
(`*` + `!.gitignore` + `!CLAUDE.md` per dir; `packages/` also keeps `notify/`). No submodules.
brot-os is the OS; your projects are userland.

## Mechanism vs. config (the core discipline)

- Mechanism — code: tracked, generic. The kernel ships the how.
- Config — anything host/account/secret-specific: injected, gitignored. `config/` supplies the
  what (your domain, tailnet, tokens).
- When something is user-specific, push it toward `config/`, not into tracked code.

## Language default

TypeScript for anything written here (packages, services, projects). Other languages allowed when a
tool genuinely needs them — document the exception in that project's own `CLAUDE.md`.

## Layout

```
.claude/skills/   the commands — git-tracked in-repo, native to brot-os
bin/ systemd/ templates/   the kernel: routing, services, publishing, notify, console-check
config/           secrets + env (GITIGNORED) + *.example templates
packages/<name>/  shared modules (notify is tracked & generic; others are tenant repos)
services/<name>/  long-running daemons that own data behind an API — each its own repo
experiments/      its OWN separate repo (a tenant, NOT brot-os) holding many self-contained
                  Next.js experiments — git work lands in that repo, never brot-os (scratch/iterate)
projects/<name>/  promoted, productionized projects — each its own repo
dotfiles/<tool>-conf/  tool-config repos (nvim-conf, wezterm-conf, tmux-conf) — each its own repo,
                  each with an idempotent `npm run setup`
sync.manifest.json  tracked registry: tenant dir → remote, read by `npm run sync` (bin/sync.mjs)
.brot/plans/      plan archive (GITIGNORED, never deleted): <unixtimestamp>-<short-name>.md
                  trackers with checkboxes agents tick
.brot/initiatives/  long-term goal trackers (GITIGNORED, never deleted): <slug>.md — human-readable,
                  emoji statuses, no checkboxes; driven by /brot-initiative
```

## Code changes ride a PR

All code changes in tracked brot-os and in each tenant repo go through `/pr` → `/merge`
(`/pr` branches, commits, pushes, opens the PR; `/merge` lands it).
