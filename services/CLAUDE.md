# services/

Long-running **daemons**. A service is the right shape when something must be *alive when
nobody is calling it*, and especially when it **owns mutable state**. The owner of a data
store is a service: **all reads and writes go through its API**, so caching, validation,
invariants, logging, and observability live in exactly one place.

## Conventions

- **Each service is its own git repo** (its own GitHub repo). Gitignored by claude-os.
- **Owns its data.** A service that has state keeps a `data/` dir inside its own repo. No
  other process reaches into that data directly — clients call the API.
- **TypeScript by default.** A service is typically an API (e.g. Express) ± any frontend that
  is just *another client* of that API.
- **Self-describing contract.** Each service ships a `SERVICE_CONTRACT.md` — a short, stable,
  consumer-facing description of how to call it (endpoints, shapes), distinct from the
  `CLAUDE.md` that documents how to *work on* it. Keep it current via a skill, not by hand.
- **Run as `systemd --user`** units via the kernel; bind to `127.0.0.1`.

Examples: bookshelf, ideas, sketchpad, experiments-registry, telegram-bot.
