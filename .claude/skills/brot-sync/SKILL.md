---
name: brot-sync
description: Sync every tenant repo (dotfiles etc.) via the deterministic engine, then verify it worked and intelligently close any gaps. Runs `npm run sync` (clone missing, pull clean, skip dirty, run each tenant's setup), reads the report, and handles dirty trees, unlisted repos, and failures. Use when the user says "/brot-sync", "sync my dotfiles", "pull my configs", "sync tenants", or after pulling brot-os on another machine.
---

# Brot Sync

One job: drive `npm run sync` and make sure it actually worked. The script is the mechanism; this skill is the judgment on top.

On entry, print this block:

```
🥨 BROT SYNC
```

## The guard

NEVER reimplement sync logic — no hand-rolled clone/pull/setup loops, no reading the manifest to "do it manually". Always run the script. If the script can't handle a case, fix the script (via /pr), don't work around it.

## Run

1. `git pull --ff-only` brot-os itself first — picks up skill/engine changes from other machines. Skip if the brot-os tree is dirty; say so.
2. `npm run sync` from the brot-os root. The engine pulls the `.brot` workspace repo FIRST, then reads `.brot/sync.manifest.json` (the tenant registry lives in the workspace layer, not tracked brot-os), then per entry: clone if missing, ff-only pull if clean, skip if dirty, run the tenant's `npm run setup` when defined. Entry dirs resolve against the brot-os root.

If sync reports no `.brot` workspace, it exits non-zero and points at `npm run setup` — run that once to create or attach the workspace repo, then re-run sync.

## Verify (read the report)

Every entry should end `cloned` or `synced`, with `setup=ran` where the tenant defines setup. Anything else is a gap:

| Report line | What it means | What to do |
|---|---|---|
| `dirty <dir>` | Uncommitted tenant changes; engine skipped it | Show the diff; offer: commit via /pr in that tenant, stash, or leave and re-run later |
| `failed ... clone/pull` | Remote unreachable, auth, or diverged history | Diagnose (remote URL, credentials, `git status`); fix and re-run `npm run sync` |
| `failed ... setup` | Tenant's setup script broke on this host | Run that setup directly for full output; fix the cause (often a missing host tool — name the install command) |
| `unlisted <dir>` | Repo on disk the manifest doesn't know | Offer to add `{ dir, repo }` to `.brot/sync.manifest.json` (get repo via `git remote get-url origin`) — that edit is committed in the `.brot` workspace repo |

## Done

Report to the user in one short block: what synced, what setup ran, what needed intervention and how it was resolved. If everything is green, one line is enough.
