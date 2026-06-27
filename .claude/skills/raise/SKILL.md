---
name: raise
description: Push the current PR branch and open the pull request. Use when the user says "/raise", "raise the PR", "open the PR", "put up the PR". This is step 2 of the PR workflow (after /pr sets up the branch and the work is committed); the user reviews the opened PR and suggests follow-ups, then invokes /merge when happy.
argument-hint: "[optional PR title / extra context]"
allowed-tools: Bash Read
---

# Raise the pull request

Step 2 of the PR workflow (`/pr` → **`/raise`** → `/merge`). The branch already exists with its
commits; this skill pushes it and opens the PR. After it's up, the user reviews and may ask for
follow-up changes (which become more commits on the same branch — keep committing at every step
per `/pr`), then runs **`/merge`** when satisfied.

## Steps

1. **Sanity-check the branch.** Make sure we're on a PR branch with a clean tree and commits ahead
   of `main`:
   ```bash
   git branch --show-current        # must NOT be main
   git status --porcelain           # must be empty — commit anything outstanding first
   git log --oneline origin/main..HEAD
   ```
   - If on `main`, stop — there's nothing to raise; the user likely needs `/pr` first.
   - If the tree is dirty, commit the remaining work (per `/pr`) before pushing.
   - If there are no commits ahead of `main`, stop and tell the user.

2. **Push the branch** to the remote (HTTPS — auth via the gh credential helper; never SSH), setting
   upstream:
   ```bash
   git push -u origin "$(git branch --show-current)"
   ```

3. **Open the PR** with `gh`. Base is `main`. Write a real title and body — summarize what changed
   and why, derived from the commits/diff. `$ARGUMENTS` may supply a title or extra context:
   ```bash
   gh pr create --base main --head "$(git branch --show-current)" \
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

4. **Report the PR URL** (`gh pr view --web` is optional). Remind the user: review it, request any
   follow-ups (they'll be added as further commits on this branch), and invoke **`/merge`** when
   they're happy.
