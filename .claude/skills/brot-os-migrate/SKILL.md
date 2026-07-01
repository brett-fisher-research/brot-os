---
name: brot-os-migrate
description: One-shot transitional skill to migrate an existing pre-rebrand host over to brot-os. Use when the user says "/brot-os-migrate", "migrate this host to brot-os", or is running an older install whose systemd units still point at the old path. Runs the deterministic migration engine with before/after health checks. Removed once every host is migrated.
---

# brot-os-migrate — move a pre-rebrand host to brot-os

INTERMEDIATE / TRANSITIONAL skill. Run it ONCE on each host still running the
pre-rebrand install (e.g. the user's NUC). It will be deleted once every host is
migrated — do not build anything on top of it.

## Why it exists

The pre-rebrand install baked its absolute path into every RENDERED systemd user
unit (WorkingDirectory, ExecStart, EnvironmentFile). Renaming the install dir to
`$BROT_OS_ROOT` breaks all those units until each is re-rendered at the new path,
so services die on a bare rename. The engine does the rename AND re-renders every
unit, bracketed by deterministic health checks so a regression fails loudly.

## What it does (snapshot → migrate → verify)

- Snapshot — capture the active brot/experiment systemd user units and the HTTP
  status of every routable experiment. This is the regression oracle.
- Guard — abort on a dirty git tree; no-op if the host is already brot-os.
- Migrate — repoint `git origin`, `git pull --ff-only`, rename the install dir to
  the derived root, and rewrite the root-override env var in the user's shell
  profile to `BROT_OS_ROOT`.
- Re-render + restart — re-run `bin/bootstrap.sh`, re-render every experiment unit
  at the new root, `daemon-reload`, restart the snapshot units.
- Verify — every snapshot unit is active again, every previously-good URL is good
  again, every installed unit references the new root with zero old-name strings.
  Nonzero exit on ANY regression.

## Run it

1. Dry-run first (read-only; prints what WOULD change, mutates nothing):
   ```sh
   "$BROT_OS_ROOT/bin/migrate-to-brot-os.sh" --dry-run
   ```
2. Then the real migration:
   ```sh
   "$BROT_OS_ROOT/bin/migrate-to-brot-os.sh"
   ```
   Idempotent and safe to re-run. Exits nonzero on any verification failure.
3. On a PASS, confirm the whole suite is green on the migrated host:
   ```sh
   npm run test
   ```

## Report to the user

- The snapshot → migrate → verify outcome (PASS or the exact FAIL line).
- The new root path and that `git origin` now points at brot-os.
- The `npm run test` result on the migrated host.
- If dry-run was run first, note what it said WOULD change vs what the real run did.

## Notes

- Single job: it migrates a host. It does not touch tenant repos or GitHub settings.
- After every host is migrated, delete this skill and `bin/migrate-to-brot-os.sh`.
