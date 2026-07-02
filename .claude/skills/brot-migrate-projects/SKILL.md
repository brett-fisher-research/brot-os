---
name: brot-migrate-projects
description: TEMPORARY one-shot migration of a live host from the apps/ tenant container to projects/. Runs bin/migrate-apps-to-projects.sh, verifies services and routes, closes gaps. Use when the user says "/brot-migrate-projects" or "migrate apps to projects" — run on the nuc after checking out the rename branch. Deleted once every host is migrated.
---

# Brot Migrate Projects

One job: drive `bin/migrate-apps-to-projects.sh` on a live Linux host (the nuc) and make sure the host actually survived the `apps/` → `projects/` rename. The script is the mechanism; this skill is the judgment on top.

TEMPORARY skill. See Removal below.

## Preconditions

- Running on the nuc (Linux, systemd user units), not the Windows dev box.
- The rename branch (or merged main) is checked out: `projects/.gitignore` exists.
- Tenant repos inside `apps/` are gitignored, so git checkout did NOT move them — that is exactly the script's job.

## Run

1. `bin/migrate-apps-to-projects.sh` from the brot-os root. Idempotent, safe to re-run. It:
   - moves leftover `apps/` entries (tenant repos, static-experiment symlinks) into `projects/`, refusing to clobber, then removes `apps/`
   - rewrites the baked absolute `.../apps` paths in `~/.config/systemd/user/exp-*.service` and `dashboard.service`, daemon-reloads, restarts the rewritten units
   - re-renders the Caddyfile via `bin/render-caddy.sh` and restarts `caddy-experiments.service`
   - verifies every `registry.json` slug resolves under `projects/` and the touched units are active; non-zero exit on any failure
2. Read the full output. `already migrated` + exit 0 means done — still run the Verify checks once.

## Verify

The script self-checks, but confirm end to end:

- `systemctl --user status dashboard.service caddy-experiments.service` — active, no restart loops.
- `systemctl --user list-units 'exp-*'` — every experiment unit active.
- `curl -fsS https://intel-nuc.mullet-ostrich.ts.net/` — dashboard responds (BASE_URL in `bin/lib.sh`).
- `curl -fsS https://intel-nuc.mullet-ostrich.ts.net/<slug>/` for at least one experiment slug from `registry.json` — route serves.

## Gaps

| Symptom | What to do |
|---|---|
| `refusing to clobber existing projects/<name>` | Something already sits at the target — diff the two, keep the real one, remove the other, re-run. |
| A unit fails to restart | `journalctl --user -u <unit> -n 50`; usually a stale path the sed missed — grep the unit file for `apps`, fix, `daemon-reload`, restart. |
| A registry slug missing under `projects/` | Static experiments are symlinks `projects/<slug> -> .../experiments/<slug>`; recreate the link if it was dropped, then `bin/render-caddy.sh` + restart caddy. |
| Dashboard 502 at `/` | Rebuild it: `bin/rebuild-home.sh`. |
| Dirty leftovers in a moved tenant repo | Leave them — the move preserves working trees; just report the dirty repo to the user. |

## Removal

This skill and `bin/migrate-apps-to-projects.sh` are transitional. Once the nuc (and any other live host) is migrated and verified, delete BOTH in a follow-up PR — the OS layer then knows only `projects/`.
