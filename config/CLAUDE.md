# config/

The `/etc` of claude-os: **secrets + host/account-specific settings**. This is the **config**
half of the mechanism-vs-config split — the kernel ships generic mechanism; this dir supplies
the values for *this* instance.

## Rules

- **Real secrets are gitignored.** Only `*.example` templates and this `CLAUDE.md` are tracked.
  `.gitignore` here keeps `config/*` out except the examples.
- **`chmod 600`** every real `.env` (e.g. `notify.env`, `cloudflare.env`).
- The kernel loads these via systemd `EnvironmentFile=` and `bin/` scripts — pointed at
  `claude-os/config/`, **not** `~/.config`, so everything lives in one place.
- To stand up a fresh instance: copy each `*.example` to its real name and fill it in.

## Files

| file | holds |
|------|-------|
| `notify.env`     | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| `cloudflare.env` | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CF_WEB_ANALYTICS_SITE_TAG` (Web Analytics / RUM), `CLOUDFLARE_ZONE_ID` (+ optional `CF_ANALYTICS_DAYS`) |
