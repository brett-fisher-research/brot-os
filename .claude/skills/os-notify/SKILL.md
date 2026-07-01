---
name: os-notify
description: Send a one-way push notification to the user's phone via Telegram. Use when the user says "/os-notify", "ping me", "text me when done", "notify me", or asks to be alerted/messaged on completion of a long task. Composable, machine-portable primitive — any skill or script can call it.
argument-hint: [-t "Title"] <message>
---

# os-notify — push to the phone

One job: send a one-way Telegram push to the user's phone. Fire-and-forget; no inbound, no reply.

> The `os-` prefix marks this as a brot-os-specific skill (the new convention) — it depends
> on the telegram-bot service that lives inside this repo.

## Run it
The sender is a standalone, zero-dep Node CLI in its own repo: `$BROT_OS_ROOT/services/telegram-bot/bin/notify.js`.

```sh
$BROT_OS_ROOT/services/telegram-bot/bin/notify.js "Build finished ✅"
echo "piped body" | $BROT_OS_ROOT/services/telegram-bot/bin/notify.js
$BROT_OS_ROOT/services/telegram-bot/bin/notify.js -t "Deploy" "shipped to prod"   # -t = bold title
```

- `/os-notify <message>` → run the CLI with the message.
- Use `-t "Title"` for a bold title line; pass the body via args or stdin.
- It EXITS NON-ZERO on failure — surface that, don't claim success blindly.
- If `notify` is on `$PATH` (the repo's `bin`), `notify "msg"` works too.

## Credentials (machine-portable)
Resolved first-hit-wins, no secret ever in a repo:
1. `$TELEGRAM_BOT_TOKEN` / `$TELEGRAM_CHAT_ID` — environment
2. `$NOTIFY_ENV_FILE` — explicit override path
3. `~/.config/notify/notify.env` — canonical untracked fallback (chmod 600)

## First run on a new machine
```sh
git clone https://github.com/brett-fisher-research/telegram-bot.git $BROT_OS_ROOT/services/telegram-bot
mkdir -p ~/.config/notify
printf 'TELEGRAM_BOT_TOKEN=...\nTELEGRAM_CHAT_ID=...\n' > ~/.config/notify/notify.env
chmod 600 ~/.config/notify/notify.env
```
If the CLI reports missing creds, set up that file — don't hardcode tokens anywhere.

## Composition
- A terminal primitive, not part of a chain. Any skill, cron job, or build script ends by calling os-notify.
- Use it to alert the user the moment a long-running task finishes.
- The sender lives in `$BROT_OS_ROOT/services/telegram-bot` (its own repo); this skill is just the Claude-facing handle. Changes to how messages send belong in that repo, not here.
