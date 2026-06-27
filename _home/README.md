# Home dashboard

The interactive landing page for `claude-experiments`. A Next.js app (`output: 'standalone'`)
that replaces the old auto-generated static `_home/index.html`.

It serves the **root route `/`** — so, unlike experiments, it has **NO `basePath`** (this is a
deliberate exception to the repo's basePath invariant). It runs as the `exp-home.service`
systemd user service on the **reserved port 2999** (below the 3001 experiment-port floor). Caddy
reverse-proxies the root fallback to it (see `bin/render-caddy.sh`).

## What it shows

- **Live experiments** — read from `../registry.json` at request time.
- **Ideas backlog** — read from `../data/feature-ideas/*.md` at request time, grouped by
  `category` (platform vs experiment) with a status badge. Detail pages at `/ideas/<slug>`.

Both are read on every request (pages use `export const dynamic = 'force-dynamic'`), so adding
an experiment or an idea shows up immediately with **no rebuild** of this app.

The repo root is located via `CLAUDE_EXPERIMENTS_ROOT` (set by the systemd unit); see
`lib/paths.ts`.

## Reserved slugs

Because Caddy matches `/<slug>/*` before the root fallback, experiments must never use these
slugs (they're owned by this dashboard): `ideas`, `_next`, `api`, `static`, `home`,
`favicon.ico`. Enforced in `bin/register-experiment.sh`.

## Rebuild / run

```bash
~/claude-experiments/bin/rebuild-home.sh   # build → (re)start exp-home → re-render Caddy
```
