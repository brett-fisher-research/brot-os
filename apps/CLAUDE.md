# apps/

Promoted, productionized projects — graduated from `experiments/`. Each app earns its own
identity.

## Conventions

- **Each app is its own git repo** (its own GitHub repo). Gitignored by claude-os. (Contrast
  `experiments/`, which is a single repo of many.)
- Typically a promoted experiment. Promotion via `/promote-experiment`, which **asks** whether
  to split a Next.js experiment into a backend **service** (in `services/`) + a frontend
  **app** here that calls it — the right move when the thing owns data others will want.
- Public apps are served at their own subdomain via the Cloudflare tunnel kernel (e.g.
  monty-hall → `monty-hall.brettfisher.dev`).

Examples: monty-hall.
