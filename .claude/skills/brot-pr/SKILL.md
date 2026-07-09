---
name: brot-pr
description: Run a pull-request workflow for any code change end to end — clean tree, branch off an up-to-date base, do the work committing every step, then push and open the PR and print its link. Use when the user says "/brot-pr", "let's make a PR", "start a branch for ...", "raise the PR", "open the PR", or whenever code is about to change. This is the STANDARD entry point for ALL code changes. /brot-merge lands it afterward.
argument-hint: "[--base <branch>] <what you're about to work on>"
allowed-tools: Bash Read Write Edit
---

# Run a pull-request workflow

Standard workflow for every code change. Nothing lands on `main` directly — all work rides a PR branch from here. Two skills:

1. `/brot-pr` (this skill) — clean tree, branch off a fresh base (`main` by default), do the work committing every step, push, open the PR, print its link.
2. `/brot-merge` — squash-merge, return to the base, pull.

Work to do is in `$ARGUMENTS`; if invoked bare, infer it from the conversation.

## Steps

1. Guard against unsaved work on `main`. Check first:
   ```bash
   git status --porcelain && git branch --show-current
   ```
   - Dirty tree (uncommitted/untracked): STOP. Show the changes and use `AskUserQuestion`:
     - Bring along — carry onto the new branch (`git stash` → branch → `git stash pop`).
     - Commit first — separate finished change: commit on current branch before proceeding.
     - Stash and set aside — `git stash`, leave for later.
     - Discard — destructive; only on explicit confirmation.

     Never silently proceed over a dirty tree.
   - Already on a non-`main` PR branch: ask whether to keep working on it (skip to step 3) or branch fresh.

2. Pick the base branch, then branch off an up-to-date copy of it. Resolve the base:
   - `--base <branch>` given (in `$ARGUMENTS`) → use it.
   - else on `main` → base = `main`.
   - else on some other branch `X` (an integration/feature branch like `premium-sync`) → ASK
     via `AskUserQuestion` whether to branch off `main` or off the current branch `X`. Never silently
     assume.

   Then sync + branch:
   ```bash
   git fetch origin --prune
   git checkout <base>
   git pull --ff-only                 # if the branch has no upstream: git pull origin <base> --ff-only
   git checkout -b <branch-name>
   ```

   Branch name:
   - Working a tracked ticket (via `/linear`) → `<ID>/<short-slug>` (e.g. `FIS-123/dark-mode`).
     Keep the `<ID>` prefix — `/linear` uses it to find the ticket; this skill itself stays
     tracker-agnostic.
   - No ticket → `<type>/<short-slug>`, `<type>` ∈ `feat` (new capability) · `bug` · `chore`
     (tooling/deps/refactor) · `docs` · or another sensible prefix.

   `<short-slug>` is kebab-case. Confirm: `git branch --show-current`.

   > Remember the base — step 5 opens the PR against it, and `/brot-merge` lands it into it. Pass
   > `--base <branch>` to `/brot-merge` when it isn't `main`.

3. Do the work, committing at EVERY step — not one giant commit at the end:
   ```bash
   git add -A && git commit -m "<concise, present-tense message>"
   ```
   - Each commit = a coherent, self-contained step (e.g. "scaffold app", "wire up save flow").
   - Clean tree before pushing. Confirm with `git status --porcelain` (empty).
   - Follow the repo's commit convention (short, imperative; see `git log`). End each message with the standard co-author trailer.

4. Push the branch to the remote (HTTPS — auth via the gh credential helper; never SSH), setting upstream:
   ```bash
   git push -u origin "$(git branch --show-current)"
   ```

5. Open the PR against the base from step 2. Write a real title and body — summarize what changed and
   why, derived from the commits/diff. `$ARGUMENTS` may supply a title or extra context:
   ```bash
   gh pr create --base <base> --head "$(git branch --show-current)" \
     --title "<concise title>" \
     --body "$(cat <<'EOF'
   ## Summary
   - <what changed and why>

   ## Test plan
   - <how it was verified>

   🤖 Generated with [Claude Code](https://claude.com/claude-code)
   EOF
   )"
   ```

6. End the skill by printing the PR link as the very last thing — nothing after it. Put a short
   summary of changes first, then a horizontal rule, then the link. Capture the URL `gh pr create`
   printed (or `gh pr view --json url -q .url`):
   ```
   <one-line summary>
   - <key change>
   - <key change>

   ───────────────
   👉 Your PR
   🔗 https://github.com/<owner>/<repo>/pull/<n>
   ```
   The link is the last line — no closing recap, no next-steps reminder after it. (Follow-ups still
   work the usual way: commit on this branch and push to update the PR, then `/brot-merge` when happy.)

## Relationship to other skills

Code-changing skills run inside this flow: invoke `/brot-pr`, commit every step, leave the squash-merge to `/brot-merge`.

Planning-first flow: `/linear` → `/planit` (approve) → `/brot-pr` → `/brot-merge`. `/brot-pr` is the implement-and-raise step; it assumes the plan is already approved.
