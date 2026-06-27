---
name: merge
description: Squash-merge the open PR, return to main, and pull the latest. Use when the user says "/merge", "merge the PR", "ship it", "land it". This is the final step of the PR workflow (after /pr and /raise), run only when the user is happy with the reviewed PR. Defaults to a squash merge so main gets a single commit per PR.
argument-hint: "[optional PR number]"
allowed-tools: Bash Read
---

# Merge the pull request

Final step of the PR workflow (`/pr` → `/raise` → **`/merge`**). Run only when the user has reviewed
the PR and is happy with it. The user prefers a **squash merge** so `main` gets exactly one commit
per PR.

## Steps

1. **Identify the PR.** Use the PR for the current branch (or the number in `$ARGUMENTS`):
   ```bash
   gh pr view --json number,title,state,mergeStateStatus,headRefName
   ```
   - If it isn't open, stop and report (maybe it was already merged, or never raised — `/raise`).
   - If checks/mergeability are blocking, surface that to the user rather than force-merging.

2. **Squash-merge** and delete the branch (squash = single commit on `main`):
   ```bash
   gh pr merge <number> --squash --delete-branch
   ```
   `--delete-branch` removes both the remote and local branch.

3. **Return to `main` and pull the latest** so the local repo has the squashed commit:
   ```bash
   git checkout main
   git pull --ff-only
   ```

4. **Confirm.** Show the result: `git log --oneline -3`. Report that the PR is merged, the branch is
   cleaned up, and we're back on an up-to-date `main` — ready for the next `/pr`.
