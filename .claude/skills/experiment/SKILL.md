---
name: experiment
description: Work on an existing experiment — add features, fix bugs, change behavior. Use when the user says "/experiment", "work on <name>", "open the <name> experiment", "fix/change/add ... to <an existing experiment>". Selects the project, makes changes, then rebuilds and restarts its long-lived service.
argument-hint: "[slug] [what to change]"
allowed-tools: Bash Read Write Edit WebFetch
---

# Work on an experiment

Read `~/claude-os/CLAUDE.md` first for the invariants you must preserve
(basePath, mobile-first, never hand-edit Caddyfile/registry; and, *if this experiment already
has a PWA*, keep its manifest/service-worker scope at `/<slug>/`).

**This is a code change, so it rides on a PR.** Before touching code, invoke the **`/pr`** skill to
guard against unsaved work, branch off an up-to-date `main`, and set up the commit-at-every-step
discipline. Commit each increment as you go; don't push or open the PR here — that's `/raise`, then
`/merge` once the user is happy.

## Steps

0. **Start the PR.** Invoke **`/pr`** (e.g. `bug/<slug>-<fix>` or `feat/<slug>-<feature>`). All the
   work below happens on that branch, committed step by step.

1. **Pick the experiment.** If `$ARGUMENTS` names a slug, use it. Otherwise list them and
   ask which one:
   ```bash
   jq -r '.experiments | to_entries[] | "\(.key)  (\(.value.type))  \(.value.repo)"' \
     ~/claude-os/registry.json
   ```
   Use AskUserQuestion if it's unclear which one they mean.

2. **Work in the repo:** `cd ~/claude-os/experiments/<slug>`. Make the changes on the `/pr`
   branch from step 0, committing each increment as you go. Preserve:
   - `basePath: '/<slug>'` and `output: 'standalone'` (Next)
   - mobile-first layout
   - *if the experiment already ships a PWA*, its manifest/service-worker scope `/<slug>/`
   Do NOT edit `~/claude-os/Caddyfile` or `registry.json` by hand.

3. **Rebuild + restart** the long-lived service:
   ```bash
   ~/claude-os/bin/rebuild-experiment.sh <slug>
   ```
   (Static experiments just re-render; no build.) Check it came back:
   `systemctl --user status exp-<slug> --no-pager | head -5` and
   `curl -fsS http://127.0.0.1:<port>/<slug>/ >/dev/null && echo OK`.

4. **Verify the change** (run it, hit the route, or test) and report what you did.

5. **Make sure everything is committed** on the PR branch before handing back (per `/pr`, never
   leave uncommitted work when you yield). Don't push or open a PR here — the user runs **`/raise`**
   when they want it up, then **`/merge`** to land it.

6. **Re-print the URL:** `https://intel-nuc.mullet-ostrich.ts.net/<slug>/`
