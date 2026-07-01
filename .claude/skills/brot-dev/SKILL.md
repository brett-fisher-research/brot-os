---
name: brot-dev
description: Start the hot-reloaded dev server ONCE in a background agent at session start, so it isn't constantly stopped/restarted and doesn't collide with a server the user already has running. Logs go to a gitignored .logs/ dir; browser console logs land somewhere greppable too. The server dies with the Claude Code session. Use when the user says "/brot-dev", "start the dev server", or at the start of a brot build that needs a running app.
---

# Brot Dev
One job: run the project's hot-reloaded dev server in a background agent, started once by the PM (main thread) at session start.

On entry, print this block:

```
🥨 BROT MODE · DEV SERVER
```

## Why the PM owns it
The PM (main thread) is the single source of truth for "is the server up". Starting it once, in one place, avoids two problems: the server getting constantly started/stopped mid-build, and a second server colliding with one the user already started by hand. Before starting, check whether a server is already running on the expected port — if so, adopt it, don't spawn a duplicate.

## How
- Launch the dev server (hot reload on) inside ONE background agent so it persists across turns and stays off the main thread.
- The background agent — and the server with it — dies when the Claude Code session ends. No orphaned processes to clean up by hand.

## Logs (the convention every brot skill knows)
- Dev-server output → a gitignored `.logs/` dir at the project root (e.g. `.logs/dev.log`). Add `.logs/` to `.gitignore` if absent.
- Browser console logs must land somewhere greppable too — `.logs/browser.log`. Driving the page with Playwright is an acceptable way to capture console output to that file.
- Any brot skill (notably `/brot-bot`) reads `.logs/` to see what the running app is doing instead of starting its own server.

## Hand off
Runs alongside `/brot-bot` (the coding agent reads `.logs/` while it builds). Torn down in `/brot-done` when brot mode ends.
