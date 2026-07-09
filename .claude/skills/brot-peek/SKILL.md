---
name: brot-peek
description: Look at the running app with headless-browser eyes via the chrome-devtools MCP server — screenshot the page into context, read console logs, scroll/click to reach a described state. Use when the user says "/brot-peek", "screenshot the app", "check the console", "what does the page look like", or whenever debugging anything with a UI — peek BEFORE asking the user for a screenshot.
---

# Brot Peek

One job: put the running app's actual state in front of the model — screenshot + console — using
the chrome-devtools MCP server (registered at user scope, headless + isolated).

On entry, print this block:

```
🥨 BROT MODE · PEEK
```

## Target URL

- Default: the running tenant dev server started by `/brot-dev` — read `.logs/dev.log` for the
  port/URL. Never start a server yourself; that's `/brot-dev`'s job.
- User named a URL or app → use that.
- Ambiguous (several servers, nothing in `.logs/`) → ask which URL before navigating.

## How to peek

Drive the MCP tools — never hand-roll shell/curl mechanics:

1. Navigate to the target URL with the chrome-devtools navigate tool.
2. Reach the state the user described BEFORE screenshotting — scroll, click, fill via the MCP
   interaction tools until the page shows what was asked about. A screenshot of the wrong state
   is noise.
3. Screenshot with format png ONLY. NEVER jpeg — chrome-devtools-mcp issue #571: Claude Code
   rejects its jpegs on Windows. Every screenshot call passes png explicitly.
4. Read the screenshot in context and say what you see — that's the deliverable.

## Console + network (debugging)

- On any error, blank page, or when debugging: pull console output via `list_console_messages`
  and the relevant network requests (list/get network request tools) before guessing.
- Write fetched console output to the gitignored `.logs/` dir (e.g. `.logs/console.log`) so it
  stays greppable by other agents and later turns — the same `.logs/` convention `/brot-dev` uses.

## Prerequisite

Chrome installed on the machine — the MCP server launches it headless. If launch fails, report
that Chrome is missing rather than retrying.

## Hand off

Composes with `/brot-dev` (supplies the server + `.logs/`) and the board's dispatched subagents —
any agent debugging a UI runs this skill proactively instead of asking the user for a screenshot.
