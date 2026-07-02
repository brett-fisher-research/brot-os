---
name: new-experiment
description: Create a brand-new experiment from an idea. Use when the user says "/new-experiment", "create a new experiment", "spin up a project/app", "make me a <thing> app/website/game", or otherwise describes something new to build and host. Scaffolds the project into the experiments repo, runs it as a long-lived service, wires up a Tailscale URL, and prints it.
argument-hint: "<describe what you want to build>"
allowed-tools: Bash Read Write Edit WebFetch
---

# New experiment

You are creating a new self-hosted experiment in `$BROT_OS_ROOT/experiments/`. Read
`$BROT_OS_ROOT/CLAUDE.md` and `$BROT_OS_ROOT/experiments/CLAUDE.md` before scaffolding — they
define the routing/basePath invariants you MUST follow. An experiment is a **plain web app**
accessed through the dashboard; it is **not a PWA by default**. (Installable-PWA support is an
optional add-on — see `$BROT_OS_ROOT/templates/PWA.md` — only when the user asks for it.)

`experiments/` is its **own separate git repo** (remote
`https://github.com/brett-fisher-research/experiments.git`), gitignored by brot-os, holding
*many* self-contained experiments — not a repo per experiment, and NOT part of the brot-os
repo. Scaffold into a new subdir `$BROT_OS_ROOT/experiments/<slug>/`; do NOT `git init` or
`gh repo create` inside it. All git work for an experiment (branch, commits, PR) happens in the
`experiments` repo, never in brot-os.

The user's idea is in `$ARGUMENTS`. Build it well, mobile-first, and end by printing the URL.

**Building an experiment is a code change, so it rides on a PR — in the `experiments` repo.**
Before scaffolding, `cd $BROT_OS_ROOT/experiments` and invoke the **`/pr`** skill there to guard
against unsaved work, branch off that repo's up-to-date `main` (e.g. `feat/<slug>`), and set up
the commit-at-every-step discipline. The branch, commits, and PR all live in the `experiments`
repo, NOT brot-os. Commit each increment as you go; `/pr` pushes and opens the PR, then
`/merge` lands it once the user is happy.

## Steps

0. **Start the PR — in the experiments repo.** `cd $BROT_OS_ROOT/experiments`, then invoke **`/pr`**
   with a `feat/<slug>` branch (off the `experiments` repo's `main`). Everything below happens on
   that branch in the `experiments` repo, committed step by step — never on a brot-os branch.

1. **Pick a slug.** Kebab-case, short, unique. Check `jq -r '.experiments|keys[]'
   $BROT_OS_ROOT/registry.json` and `ls $BROT_OS_ROOT/experiments/` to avoid collisions. If the idea
   is ambiguous in a way that changes the build, ask ONE clarifying question; otherwise proceed.

2. **Choose the tier:**
   - **static** — pure HTML/CSS/JS with no backend (e.g. "hello world", a calculator, a
     static teaching page). Fastest, lightest.
   - **next** — anything interactive/stateful/full-stack, or when the user asks for it.
     This is the default whenever in doubt.
   - **worker** — a headless long-lived process with no web UI (a bot, a poller, a queue
     consumer). No port, no Caddy route. Entry defaults to `experiments/<slug>/index.js`.
   Keep the stack minimal; don't add dependencies the idea doesn't need.

3. **Make the experiment dir — NO per-experiment GitHub repo.** Experiments live together in the
   one `experiments` repo (its own repo, separate from brot-os) so they can iterate fast and
   share code via `packages/`. Just create `$BROT_OS_ROOT/experiments/<slug>/` and build into it
   (do NOT `git init` inside it, do NOT `gh repo create` — the surrounding `experiments` repo
   already tracks it). Shared logic (data fetchers, clients) goes in `packages/<name>/` as a
   `"type": "module"` package and is imported by **relative path** (e.g.
   `import { x } from '../../../packages/<name>/index.js'`) — never copied. An experiment
   graduates to its own `projects/` repo later by hand.

4. **Scaffold.** (Run these from `$BROT_OS_ROOT/experiments/`.)
   - **next:** `npx create-next-app@latest <slug> --ts --app --eslint --no-tailwind
     --no-src-dir --use-npm --yes` (add Tailwind only if helpful). Then:
     - Set `basePath: '/<slug>'` and `output: 'standalone'` in `next.config` (see
       `$BROT_OS_ROOT/templates/next.config.snippet.js`).
     - Build the actual feature. Put any in-app routes under the App Router as normal —
       `next/link` auto-applies basePath. Make it mobile-first.
     - **Do NOT add a PWA by default** (no manifest, no service worker, no icon generation).
       It's a plain web app opened through the dashboard. *Only if the user asks for it to be
       installable*, follow the opt-in recipe in `$BROT_OS_ROOT/templates/PWA.md`.
   - **static:** write `index.html` + assets in `experiments/<slug>/` using **relative** paths.
     No manifest / service worker / icons by default — add them only if the user wants the page
     installable (opt-in: `$BROT_OS_ROOT/templates/PWA.md`).
   - **worker:** write `experiments/<slug>/index.js` (plain Node ESM, zero deps where possible)
     and a minimal `package.json` with `"type": "module"`. Long-lived loop, no HTTP server. Read
     any secrets from env (injected via `EnvironmentFile`). Put reusable fetch/client logic in
     `packages/<name>/` and import it.

4b. **Notifications.** Two ways to ping the phone (both use the shared Telegram secret, auto-
   injected into every `exp-<slug>` service via `EnvironmentFile`):
   - **One-way (any experiment):** in a **next** app, vendor the helper —
     `cp $BROT_OS_ROOT/templates/notify.ts experiments/<slug>/lib/notify.ts` — and
     `await notify("…")` from a server route/action. (Vendoring keeps a Next standalone build
     self-contained.) In shell/cron, call `$BROT_OS_ROOT/bin/notify.sh "…"`.
   - **Two-way (commands):** the two-way Telegram bot lives in `services/` — add a `/command`
     there rather than building a new bot. Don't run a second Telegram long-poller — only one
     consumer of `getUpdates` may exist.

5. **Register + run:**
   ```bash
   # static ONLY: register-experiment.sh resolves the served dir from projects/<slug>, so link it
   # to the experiment dir first (same pattern as the existing coin-bandit static experiment):
   ln -s $BROT_OS_ROOT/experiments/<slug> $BROT_OS_ROOT/projects/<slug>   # static only; gitignored, host-local

   $BROT_OS_ROOT/bin/register-experiment.sh <slug> next     # or: static | worker
   # next: then build + start:
   $BROT_OS_ROOT/bin/rebuild-experiment.sh <slug>
   # worker: register already started it; rebuild only after code changes.
   ```
   Registering writes the **canonical** `$BROT_OS_ROOT/registry.json`. The dashboard's
   experiments **listing** is served by the `experiments-registry` service (`:4001`), which the
   installed unit points at that same canonical file (`REGISTRY_PATH=$BROT_OS_ROOT/registry.json`).
   So a successful `register-experiment.sh` is all it takes for the experiment to appear in the
   dashboard — there is **no separate "add to the service" step**. (If the listing is ever stale,
   the service is reading the wrong file: check `systemctl --user show exp-experiments-registry -p
   Environment` for `REGISTRY_PATH`, then `systemctl --user restart exp-experiments-registry`.)

6. **Verify:**
   ```bash
   curl -fsS http://127.0.0.1:<port>/<slug>/ >/dev/null && echo OK   # next
   systemctl --user status exp-<slug> --no-pager | head -5           # next/static/worker
   journalctl --user -u exp-<slug> -n 30 --no-pager                  # worker: confirm it runs

   # next/static: confirm it actually shows in the dashboard listing (not just that it serves):
   curl -fsS localhost:4001/registry | jq -r '.experiments | keys[]' | grep -qx <slug> && echo LISTED
   ```

7. **Make sure everything is committed** on the PR branch from step 0 — in the `experiments` repo
   (it holds the experiment; no per-experiment repo, and nothing lands in brot-os). Per `/pr`,
   never leave uncommitted work when you hand back. `/pr` pushes and opens the PR; the user
   reviews it, then runs **`/merge`** to land it.

8. **Finish:**
   - **next/static:** print the URL prominently —
     `https://intel-nuc.mullet-ostrich.ts.net/<slug>/` — and tell the user to open it through
     the dashboard. (If they later want it installable to the home screen, mention it can be
     made a PWA via `templates/PWA.md`.)
   - **worker:** there's no URL; report that the service is running and how to trigger it
     (e.g. the bot command).
