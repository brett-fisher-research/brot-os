# packages/notify

`@claude-os/notify` — a tiny, generic primitive for a **one-way push to your phone via
Telegram**. The one shared `packages/` module that claude-os **tracks** (everything else under
`packages/` is a tenant repo), because almost any instance wants it and it carries no
host/account specifics — only mechanism.

## Mechanism vs. config

Pure **mechanism**: the code never hardcodes a token, chat id, or path. The **config** (the
secret) is read from the environment at runtime:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

On the NUC these live in `~/claude-os/config/notify.env` (gitignored, `chmod 600`) and are
injected into each `systemd --user` service via `EnvironmentFile=` (see `systemd/exp@.template`,
`worker@.template`). On any other host, set the two env vars however that host injects config.

## Usage

Server-side only (it needs the bot token — never call it from a client component).

```ts
import { notify } from "@claude-os/notify";

await notify("Job finished ✅");
await notify("Body line", { title: "Build" });   // bold title on its own line
```

`notify` resolves `true` on success and `false` on failure (missing secret, network error,
non-200) and **never throws**, so a missed notification can't take down the caller. Options:

| option   | default               | meaning                                   |
|----------|-----------------------|-------------------------------------------|
| `title`  | —                     | bold title prepended on its own line      |
| `chatId` | `TELEGRAM_CHAT_ID`    | override the destination chat             |
| `token`  | `TELEGRAM_BOT_TOKEN`  | override the bot token                    |

## Files

- `index.ts` — TypeScript source (the canonical implementation; TS is the claude-os default).
- `index.js` — runtime ESM build kept in lockstep with `index.ts`, so the package works as a
  `file:` dependency inside Next standalone builds (which can't transpile a bare `.ts` on
  import). Edit `index.ts` and mirror the change here.
- `index.d.ts` — the type contract consumers compile against.

## Consuming it

- **Plain Node / workers / services:** import by relative path or add it as a `file:` dep.
- **Next apps with `output: 'standalone'`:** add `"@claude-os/notify": "file:../../packages/notify"`
  and `install-links=true` in the app's `.npmrc` (a plain `file:` symlinks, which Turbopack can't
  read) — `npm ci` then copies the package in.
- **Shell / cron / kernel scripts:** use `bin/notify.sh` instead (same secret, same env file).

To re-derive the chat id: message the bot, then
`curl -s ".../bot<TOKEN>/getUpdates" | jq '.result[].message.chat.id'`.
