# packages/

Shared modules — **pure code with no data store of its own**. If it's just a function (get the
silver price, format a date), it's a package, not a service. The contract is the module's
**types**, checked by the compiler — no drift, no docs to keep in sync.

## Conventions

- **TypeScript by default.** Other languages allowed if genuinely needed — document the
  exception in that package's own `CLAUDE.md`.
- **`notify/` is tracked** by claude-os — it's a generic, configurable package (push a Telegram
  notification) that almost any instance wants. It reads its secret from `config/`, never
  hardcoded.
- **All other packages are tenant repos** — each its own git + GitHub repo, gitignored by
  claude-os. Imported by relative path or as a `file:` dep, per the consumer's needs.

Examples: notify (tracked), silver, books.
