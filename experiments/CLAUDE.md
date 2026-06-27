# experiments/

The **scratch space** — for rapidly iterating on ideas without the overhead of standing up a
separate backend service and frontend. Self-contained Next.js apps that can read/write their
own data in-process.

## Conventions

- **This whole directory is ONE git repo** (one GitHub repo) holding *many* experiments — not
  one repo per experiment. (Contrast `apps/`, where each subdir is its own repo.)
- Gitignored by claude-os.
- Each experiment is a self-contained Next.js app (`basePath`, `output: 'standalone'`), the
  same shape experiments have always taken.
- Created via the `/new-experiment` skill, which scaffolds into this directory.
- An experiment graduates to `apps/` via `/promote-experiment` — which will ask whether to
  split it into a backend **service** + a frontend **app** when that shape fits.
