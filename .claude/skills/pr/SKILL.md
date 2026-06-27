---
name: pr
description: Start a pull-request workflow for any code change. Use when the user says "/pr", "let's make a PR", "start a branch for ...", or whenever code is about to change. This is the STANDARD entry point for ALL code changes — it ensures a clean tree, branches off an up-to-date main, and enforces commit-at-every-step discipline. It does NOT push or open a PR — that happens later via /raise, then /merge.
argument-hint: "<what you're about to work on>"
allowed-tools: Bash Read Write Edit
---

# Start a pull-request workflow

This is the **standard workflow for every code change** in this repo. No code change should
happen directly on `main` — it always rides on a PR branch created here. The flow is three
skills:

1. **`/pr`** (this skill) — clean the tree, branch off an up-to-date `main`, then do the work,
   committing at every step.
2. **`/raise`** — push the branch and open the PR (only when the user invokes it).
3. **`/merge`** — squash-merge the PR, return to `main`, and pull (only when the user invokes it).

The work in `$ARGUMENTS` (if given) describes what's about to be built. If invoked bare, infer it
from the conversation.

## Steps

1. **Guard against unsaved work on `main`.** Before doing anything, check the working tree:
   ```bash
   git status --porcelain && git branch --show-current
   ```
   - **If there are uncommitted/untracked changes**, STOP and prompt the user before starting any
     work. Show them the changes and use `AskUserQuestion` to suggest a course of action:
     - **Bring them along** — carry the changes onto the new branch (`git stash` → branch →
       `git stash pop`), if they belong with this work.
     - **Commit them first** — they're a separate, finished change: commit on the current branch
       (or its own branch) before proceeding.
     - **Stash and set aside** — `git stash` and leave them for later.
     - **Discard** — only if the user explicitly confirms; this is destructive.
     Do NOT silently proceed over a dirty tree.
   - **If already on a non-`main` branch** that looks like an in-progress PR branch, ask whether
     to keep working on it (skip to step 3) or branch fresh off `main`.

2. **Branch off an up-to-date `main`.** Always sync with the remote first so the branch starts
   from the latest:
   ```bash
   git fetch origin --prune
   git checkout main
   git pull --ff-only
   git checkout -b <type>/<short-slug>
   ```
   Pick `<type>` as a **loose grouping of the kind of work** — common prefixes:
   - `feat/` — a new feature or capability
   - `bug/` — a bug fix
   - `chore/` — tooling, deps, config, scaffolding, refactors with no behavior change
   - `docs/` — documentation only
   …or another short, sensible prefix if none of these fit. `<short-slug>` is kebab-case and
   describes the work (e.g. `feat/dark-mode-toggle`, `bug/save-modal-autofill`). Confirm the
   branch: `git branch --show-current`.

3. **Do the work, committing at EVERY step.** Make the change in logical increments, and commit
   each increment as you go — not one giant commit at the end:
   ```bash
   git add -A && git commit -m "<concise, present-tense message>"
   ```
   - Each commit should be a coherent, self-contained step (e.g. "scaffold app", "add PWA
     manifest", "wire up save flow", "fix mobile layout").
   - **Always end with a clean tree when you hand control back.** Whenever you finish coding and
     return to the user — to ask a question, report progress, or wait for review — **everything
     you changed must already be committed.** Never leave uncommitted work sitting in the tree
     when you yield. Run `git status --porcelain` to confirm it's empty before handing back.
   - Follow this repo's commit-message convention (short, imperative; see `git log`). End each
     commit message with the standard co-author trailer.

4. **Stop at committed — do NOT push or open a PR.** This skill never runs `git push` or
   `gh pr create`. The branch stays local with its commits until the user explicitly invokes
   **`/raise`**. When you've finished the requested work (and committed it), tell the user it's
   ready and that they can review locally, then run `/raise` when they want the PR opened.

## Relationship to other skills

Skills that change code (`/new-experiment`, `/experiment`, `/promote-experiment`, and any future
code-change skill) **run their work inside this flow**: they invoke `/pr` first to set up the
branch, commit at every step as above, and leave pushing/PR-opening to `/raise` and `/merge`. See
`~/claude-os/CLAUDE.md` ("Code changes go through the PR workflow").
