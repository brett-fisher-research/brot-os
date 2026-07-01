# brot-os

A virtual AI OS: a home-directory workspace driven almost entirely through Claude Code skills.
Skills are the commands, a small kernel is the hosting machinery, projects live as self-contained
repos in well-known directories. Clone it anywhere — the kernel resolves its own repo root, so no
fixed install path is assumed.

See [`CLAUDE.md`](./CLAUDE.md) for the full model and conventions.

> Status — custom-first. Tailored to the user's setup today; genericizing into a clean
> open-source blueprint is deliberate later work.

## Layout

Think Unix. Each top-level dir maps to a role:

- `bin/` — the kernel: shell scripts that render Caddy, install systemd units, publish, notify.
- `config/` — the `/etc` of brot-os: secrets + env (GITIGNORED). Ships only `*.example` templates.
- `systemd/` — long-running service units + `@@…@@` templates the kernel fills in at setup.
- `templates/` — scaffolding materials stamped into new projects (PWA files, notify, icons).
- `packages/` — shared, generic modules (e.g. `@brot-os/notify`). Reusable across projects.
- `services/` — long-running daemons that own data behind an API — each its own repo.
- `apps/` — promoted, productionized projects — each its own repo.

Tenants (`experiments/`, `services/`, `apps/`, most of `packages/`) are their own git repos inside
container dirs and are gitignored by brot-os. brot-os is the OS; the projects are userland.

## Quickstart

1. Clone anywhere:
   ```sh
   git clone <repo-url> brot-os && cd brot-os
   ```
2. Supply config (the `/etc` layer). Copy each example and fill in real values:
   ```sh
   cp config/notify.env.example config/notify.env
   cp config/cloudflare.env.example config/cloudflare.env
   ```
3. Bootstrap the host (idempotent — installs services, renders Caddy, points Tailscale at it):
   ```sh
   bin/bootstrap.sh
   ```

The kernel self-locates its repo root, so it runs from whatever path you cloned into. To pin the
root explicitly (e.g. for a service or a non-standard checkout), set `BROT_OS_ROOT`:

```sh
BROT_OS_ROOT=/opt/brot-os bin/bootstrap.sh
```

## Tests

Bash assertion suites live in `tests/`. Canonical command:

```sh
bash tests/run.sh
```

It execs every `tests/*.test.sh` and exits non-zero if any is red. `npm test` from the repo
root runs the same thing.
