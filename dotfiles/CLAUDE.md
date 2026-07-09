# dotfiles/

Container for the user's tool-config repos. Tenants, not brot-os code.

## Convention

- One config repo per tool: `nvim-conf`, `wezterm-conf`, `tmux-conf`, `zshrc-config`
  (installs `~/.zshrc`).
- `dotclaude` installs the user's `~/.claude` config — settings plus skills — a directory-merge
  setup (repo files merged into `~/.claude`) rather than a single-file copy.
- Each is its own git repo under `github.com/brett-fisher-research`, cloned into this dir.
- Each exposes an idempotent `npm run setup` that copies its config into the tool's platform
  location (e.g. `%LOCALAPPDATA%\nvim`, `~/.wezterm.lua`, `~/.zshrc`, `~/.claude`).
- Don't cd in here to pull or setup — run `npm run sync` (or `/brot-sync`) from the brot-os
  root: it pulls every repo listed in `.brot/sync.manifest.json` (the workspace-layer registry)
  and drives each `npm run setup`.
- The repo is the single source of truth — edit config in the repo, re-sync; never edit
  the installed copy.

## Tracking

- Everything here is gitignored by brot-os (`*` + `!.gitignore` + `!CLAUDE.md`). No submodules.
- Git work (branches, PRs) happens inside each tenant repo, never in brot-os.
