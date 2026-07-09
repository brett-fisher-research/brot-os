# brot-os

A virtual AI OS: one macro repo hosting many gitignored tenant repos, driven almost entirely
through Claude Code skills. Skills are the commands, a small kernel is the hosting machinery,
projects live as self-contained repos in well-known directories. Clone it anywhere — the kernel
resolves its own repo root, so no fixed install path is assumed.

See [`CLAUDE.md`](./CLAUDE.md) for the full model and conventions.

> Status — custom-first. Tailored to the user's setup today; genericizing into a clean
> open-source blueprint is deliberate later work.

## Opinions

What the framework believes, in one line each (the why lives in `CLAUDE.md`):

1. Skills are the interface; deterministic mechanics live in scripts skills call (`npm run test/dev/setup/sync`).
2. The main thread is a PM that never writes code — subagents do all the work.
3. Every subagent gets a goal contract: one goal, deterministic verification criteria.
4. Tests pin BEHAVIOR and read as documentation; no tombstones, no prose-greps; one `npm test` (vitest) covers bash + TS.
5. Every repo carries a `package.json` with standard verbs: `test`, `dev`, `setup`.
6. All code changes ride a PR (`/pr` → human review → `/merge`). Nothing lands directly.
7. Mechanism vs config: tracked code is generic; anything host/account/secret-specific lives in gitignored `config/`.
8. Razor prose everywhere: dense, skimmable, no bold/italic markdown emphasis, the user is "the user".
9. brot-os is a macro repo: one OS repo hosting many gitignored tenant repos; sync via manifest.

## Workflow

Every session enters through `/brot-board` — a persistent thinking space that never nudges
toward action. From there the flow is plain language: board → plan (proposed on ask or
convergence, archived to gitignored `.brot/plans/`) → go ("go", "build it" dispatches background
subagents, one per repo) → review (each agent raises a PR; every handoff ends with human verify
steps) → ship ("done" / "finish" / "cleanup" / "ship it" merges approved PRs and tears down).
The main thread stays PM throughout — it never writes code.

## Layout

Think Unix. Each top-level dir maps to a role:

- `bin/` — the sync + setup core: `sync.mjs` (tenant sync) and `setup.ts` (workspace bootstrap).
- `config/` — the `/etc` of brot-os: secrets + env (GITIGNORED). Ships only `*.example` templates.
- `packages/` — shared, generic modules (e.g. `@brot-os/notify`). Reusable across projects.
- `services/` — long-running daemons that own data behind an API — each its own repo.
- `projects/` — promoted, productionized projects — each its own repo.
- `dotfiles/` — tool-config repos (nvim-conf, wezterm-conf, tmux-conf) — each its own repo with an
  idempotent `npm run setup`.
- `.brot/` — plan archive (gitignored, never deleted): timestamped plan files agents tick as work lands.

Tenants (`services/`, `projects/`, `dotfiles/`, most of `packages/`) are their own git repos inside
container dirs and are gitignored by brot-os. brot-os is the OS; the projects are userland.

## Quickstart

1. Clone anywhere:
   ```sh
   git clone <repo-url> brot-os && cd brot-os
   ```
2. Supply config (the `/etc` layer). Copy each example and fill in real values:
   ```sh
   cp config/notify.env.example config/notify.env
   ```
3. Bootstrap the workspace (idempotent):
   ```sh
   npm run setup
   ```
4. Sync every tenant repo listed in the manifest (clone missing, ff-pull clean, run each
   tenant's setup):
   ```sh
   npm run sync
   ```

## Tests

Tests live in `tests/`. One command runs everything:

```sh
npm test
```

It is a single `vitest run` covering both the TypeScript suites and the bash assertion suites
(`tests/bash.test.ts` globs every `tests/*.test.sh` and runs each as one case). Exits non-zero if
any is red.

What a test in here is for:

- Pin BEHAVIOR: given an input, assert the output or effect. A good test reads as documentation -
  "what does this code do?".
- Named living invariants are allowed (and only these): portability (a clone runs anywhere),
  privacy (a personal manifest never ships in framework brot-os).
- Not allowed: tombstone tests (asserting a removed/renamed thing stays gone) or prose-greps
  (asserting a doc or skill file contains some phrase).
