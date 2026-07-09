---
name: brot-merge
description: Squash-merge the open PR, return to the base branch, and pull the latest. Use when the user says "/brot-merge", "merge the PR", "ship it", "land it". This is the final step of the PR workflow (after /brot-pr), run only when the user is happy with the reviewed PR. Defaults to a squash merge into main; pass --base for an integration branch.
argument-hint: "[--base <branch>] [PR number]"
allowed-tools: Bash Read
---

# Merge the pull request

Final step of the PR workflow (`/brot-pr` → `/brot-merge`). Run only when the user has reviewed
the PR and is happy with it. The user prefers a squash merge so the base gets exactly one commit
per PR.

This skill is self-contained git/gh only — it knows nothing about issue trackers. (If the work is
tracked in Linear, `/linear` marks the ticket Done after this runs.)

## Steps

1. Resolve the base + identify the PR. Base = `--base <branch>` from `$ARGUMENTS`, else `main`.
   Use the PR for the current branch (or the number in `$ARGUMENTS`):
   ```bash
   gh pr view --json number,title,state,mergeStateStatus,headRefName,baseRefName
   ```
   - If it isn't open, stop and report (maybe already merged, or never opened — `/brot-pr`).
   - If checks/mergeability are blocking, surface that to the user rather than force-merging.
   - Sanity: `baseRefName` should match the resolved base.

2. Squash-merge and delete the branch (squash = single commit on the base):
   ```bash
   gh pr merge <number> --squash --delete-branch
   ```
   `--delete-branch` removes both the remote and local branch.

3. Return to the base and pull the latest so the local repo has the squashed commit:
   ```bash
   git checkout <base>
   git pull --ff-only
   ```

4. Confirm. Show the result: `git log --oneline -3`. Report that the PR is merged, the branch is
   cleaned up, and we're back on an up-to-date base — ready for the next `/brot-pr`.
